import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../../lib/cloudflare-r2'
import JSZip from 'jszip'

/**
 * 🎯 DOWNLOAD SELECTED FILES API
 * 
 * Enligt din specifikation:
 * 1. Ta emot lista med filvägar från frontend
 * 2. Skapa temporär ZIP-fil i minnet med JSZip
 * 3. Ladda upp till R2 temp-downloads/ med kort expiration (10 min)
 * 4. Returnera signed URL för direkt nedladdning
 * 5. Frontend navigerar till URL med window.location.href
 */

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 === DOWNLOAD SELECTED FILES REQUEST ===')

    const { selectedFiles, customerId, customerToken, zipName } = await request.json()
    
    if (!selectedFiles || !Array.isArray(selectedFiles) || selectedFiles.length === 0) {
      return NextResponse.json({ error: 'No files selected' }, { status: 400 })
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    console.log(`📥 Creating ZIP for ${selectedFiles.length} selected files`)

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

    // Hämta kundinformation
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verifiera att alla filer tillhör kunden
    const { data: customerFiles, error: filesError } = await supabase
      .from('files')
      .select('id, file_path, original_name, file_size')
      .eq('customer_id', customerId)
      .in('id', selectedFiles)
      .eq('is_deleted', false)
      .eq('is_trashed', false)

    if (filesError || !customerFiles || customerFiles.length === 0) {
      return NextResponse.json({ 
        error: 'No valid files found or files do not belong to customer' 
      }, { status: 404 })
    }

    if (customerFiles.length !== selectedFiles.length) {
      console.warn(`⚠️ Requested ${selectedFiles.length} files but found ${customerFiles.length} valid files`)
    }

    console.log(`✅ Found ${customerFiles.length} valid files for ZIP creation`)

    // Skapa ZIP med JSZip
    const zip = new JSZip()
    let totalOriginalSize = 0
    let processedFiles = 0

    console.log('📦 Starting ZIP creation...')

    // Lägg till varje fil i ZIP:en
    for (const file of customerFiles) {
      try {
        console.log(`📥 Processing file ${processedFiles + 1}/${customerFiles.length}: ${file.original_name}`)
        
        // Hämta filen från R2
        const fileKey = r2Service.getFileKeyFromUrl(file.file_path)
        const fileData = await r2Service.getFile(fileKey)
        
        if (!fileData) {
          console.warn(`⚠️ Could not fetch file: ${file.original_name}`)
          continue
        }

        // Lägg till i ZIP med säkert filnamn
        const safeFileName = file.original_name.replace(/[<>:"/\\|?*]/g, '_')
        zip.file(safeFileName, fileData)
        
        totalOriginalSize += file.file_size || 0
        processedFiles++

        console.log(`✅ Added ${file.original_name} (${r2Service.formatFileSize(file.file_size || 0)})`)

      } catch (fileError) {
        console.error(`❌ Error processing file ${file.original_name}:`, fileError)
        // Fortsätt med nästa fil istället för att krascha
      }
    }

    if (processedFiles === 0) {
      return NextResponse.json({
        error: 'No files could be processed for ZIP creation'
      }, { status: 500 })
    }

    console.log(`📦 Generating ZIP buffer for ${processedFiles} files...`)
    
    // Generera ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    console.log(`💾 ZIP generated: ${r2Service.formatFileSize(zipBuffer.length)} (compressed from ${r2Service.formatFileSize(totalOriginalSize)})`)

    // Skapa unikt namn för temp ZIP
    const timestamp = Date.now()
    const safeZipName = (zipName || `${customer.company_name}_selected_files`).replace(/[^a-zA-Z0-9-_]/g, '_')
    const tempZipPath = `temp-downloads/${customerId}/${timestamp}_${safeZipName}.zip`
    
    // Ladda upp till R2 temp-downloads
    const uploadUrl = await r2Service.uploadFile(
      zipBuffer,
      `${safeZipName}.zip`,
      'application/zip',
      `temp/${customerId}`
    )

    if (!uploadUrl) {
      return NextResponse.json({
        error: 'Failed to upload temporary ZIP to storage'
      }, { status: 500 })
    }

    console.log(`🌩️ Temporary ZIP uploaded: ${tempZipPath}`)

    // Generera signed URL med kort expiration (10 minuter)
    const tempFileKey = r2Service.getFileKeyFromUrl(uploadUrl)
    const downloadUrl = await r2Service.getSignedDownloadUrl(tempFileKey, 10 * 60) // 10 minuter

    // Spara temp download info för cleanup (optional)
    try {
      await supabase
        .from('temp_downloads')
        .insert({
          customer_id: customerId,
          file_path: tempZipPath,
          file_count: processedFiles,
          original_size: totalOriginalSize,
          zip_size: zipBuffer.length,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
          created_at: new Date().toISOString()
        })
    } catch (tempError) {
      console.warn('⚠️ Could not save temp download info:', tempError)
      // Inte kritiskt - fortsätt ändå
    }

    console.log(`✅ Selected files ZIP created successfully`)

    return NextResponse.json({
      success: true,
      downloadUrl,
      customer: customer.company_name,
      selectedFileCount: processedFiles,
      totalSelectedFiles: selectedFiles.length,
      originalSize: totalOriginalSize,
      zipSize: zipBuffer.length,
      zipSizeMB: Math.round(zipBuffer.length / 1024 / 1024 * 100) / 100,
      compressionRatio: Math.round((1 - zipBuffer.length / totalOriginalSize) * 100),
      expiresIn: '10 minutes',
      message: `ZIP with ${processedFiles} selected files created and ready for download`
    })

  } catch (error) {
    console.error('❌ Download selected files error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 🎯 GET METHOD - Direkt nedladdning av temp ZIP
 * 
 * För direkt nedladdning via window.location.href
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tempId = searchParams.get('tempId')
    const customerId = searchParams.get('customerId')
    
    if (!tempId || !customerId) {
      return new Response('Invalid download link', { status: 400 })
    }

    console.log(`🎯 Direct temp download: ${tempId}`)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Hämta temp download info
    const { data: tempDownload, error } = await supabase
      .from('temp_downloads')
      .select('*')
      .eq('id', tempId)
      .eq('customer_id', customerId)
      .single()

    if (error || !tempDownload) {
      return new Response('Download link not found or expired', { status: 404 })
    }

    // Kolla expiration
    const now = new Date()
    const expiresAt = new Date(tempDownload.expires_at)
    
    if (expiresAt < now) {
      return new Response('Download link has expired', { status: 410 })
    }

    // Generera ny signed URL och redirect
    const downloadUrl = await r2Service.getSignedDownloadUrl(tempDownload.file_path, 60) // 1 min
    
    return NextResponse.redirect(downloadUrl, 302)

  } catch (error) {
    console.error('❌ Direct temp download error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
