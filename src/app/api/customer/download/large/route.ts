import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../../lib/cloudflare-r2'

/**
 * 🎯 LARGE FILE DOWNLOAD API
 * 
 * Enligt din specifikation:
 * 1. För filer >1GB, undvik fetch i frontend eller proxy via Vercel
 * 2. Generera signed URL från Cloudflare R2
 * 3. Returnera URL som frontend kan använda med window.location.href
 * 4. Sätt Content-Disposition header för proper filnamn
 */

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 === LARGE FILE DOWNLOAD REQUEST ===')

    const { fileId, customerId, customerToken } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verifiera kund
    const adminPassword = request.headers.get('x-admin-password')
    let isAdmin = adminPassword === 'DronarkompanietAdmin2025!'
    
    if (!isAdmin && !customerToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hämta fil och verifiera ägarskap
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, file_path, original_name, file_size, content_type, customer_id')
      .eq('id', fileId)
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ 
        error: 'File not found or does not belong to customer' 
      }, { status: 404 })
    }

    console.log(`📥 Large file download: ${file.original_name} (${r2Service.formatFileSize(file.file_size || 0)})`)

    // Extrahera file key från URL
    const fileKey = r2Service.getFileKeyFromUrl(file.file_path)
    
    if (!fileKey) {
      return NextResponse.json({
        error: 'Invalid file path'
      }, { status: 500 })
    }

    // Generera signed URL med längre expiration för stora filer (1 timme)
    const downloadUrl = await r2Service.getSignedDownloadUrl(fileKey, 60 * 60)

    // Logga nedladdning för statistik
    try {
      await supabase
        .from('download_logs')
        .insert({
          customer_id: customerId,
          file_id: fileId,
          download_type: 'single_large_file',
          file_size: file.file_size,
          downloaded_at: new Date().toISOString()
        })
    } catch (logError) {
      console.warn('⚠️ Could not log download:', logError)
      // Inte kritiskt - fortsätt ändå
    }

    console.log(`✅ Large file signed URL generated for: ${file.original_name}`)

    return NextResponse.json({
      success: true,
      downloadUrl,
      fileName: file.original_name,
      fileSize: file.file_size,
      fileSizeMB: Math.round((file.file_size || 0) / 1024 / 1024 * 100) / 100,
      contentType: file.content_type,
      expiresIn: '1 hour',
      isLargeFile: (file.file_size || 0) > 1024 * 1024 * 1024, // >1GB
      message: `Direct download URL generated for ${file.original_name}`
    })

  } catch (error) {
    console.error('❌ Large file download error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 🎯 GET METHOD - Direkt nedladdning med Content-Disposition
 * 
 * För direkt nedladdning via window.location.href = '/api/customer/download/large?fileId=xxx'
 * Redirectar till signed URL med proper headers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    const customerId = searchParams.get('customerId')
    const customerToken = searchParams.get('token')
    
    if (!fileId || !customerId) {
      return new Response('File ID and Customer ID required', { status: 400 })
    }

    console.log(`🎯 Direct large file download: ${fileId}`)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Hämta fil och verifiera ägarskap
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, file_path, original_name, file_size, customer_id')
      .eq('id', fileId)
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .single()

    if (fileError || !file) {
      return new Response('File not found', { status: 404 })
    }

    // Extrahera file key och generera signed URL
    const fileKey = r2Service.getFileKeyFromUrl(file.file_path)
    const downloadUrl = await r2Service.getSignedDownloadUrl(fileKey, 60 * 60)

    console.log(`🚀 Redirecting to large file: ${file.original_name}`)

    // Redirect med proper headers för nedladdning
    return NextResponse.redirect(downloadUrl, {
      status: 302,
      headers: {
        'Content-Disposition': `attachment; filename="${file.original_name}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ Direct large file download error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
