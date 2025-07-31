import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'
import JSZip from 'jszip'

// FAST ZIP CREATION - Optimerad för hastighet
export async function POST(request: NextRequest) {
  try {
    console.log('⚡ === FAST PREBUILT ZIP ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId, maxFiles = 20 } = await request.json()
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Hämta kundinformation
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Hämta begränsat antal filer (för att undvika timeout)
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_size, folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .lt('file_size', 10 * 1024 * 1024) // Bara filer under 10MB
      .order('file_size', { ascending: true }) // Börja med små filer
      .limit(maxFiles)

    if (filesError || !files || files.length === 0) {
      return NextResponse.json({ 
        error: 'No suitable files found for customer',
        customer: customer.name 
      }, { status: 404 })
    }

    console.log(`📁 Processing ${files.length} small files for ${customer.name}`)

    // Skapa ZIP snabbt
    const zip = new JSZip()
    let processedFiles = 0
    let totalSize = 0

    for (const file of files) {
      try {
        console.log(`📄 Adding ${processedFiles + 1}/${files.length}: ${file.original_name}`)
        
        const fileBuffer = await r2Service.getFile(file.filename)
        
        // Lägg till fil i ZIP
        zip.file(file.original_name, fileBuffer)
        
        processedFiles++
        totalSize += file.file_size || 0
        
      } catch (fileError) {
        console.error(`❌ Error adding file ${file.original_name}:`, fileError)
      }
    }

    // Generera ZIP snabbt utan komprimering
    console.log(`⚡ Generating fast ZIP...`)
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'STORE' // Ingen komprimering = snabbare
    })

    console.log(`✅ Fast ZIP created: ${(zipBuffer.length / 1024).toFixed(2)} KB`)

    // Ladda upp ZIP
    const zipPath = `prebuilt-zips/${customerId}/fast_${Date.now()}.zip`
    await r2Service.uploadFile(zipBuffer, zipPath, 'application/zip', customerId)

    return NextResponse.json({
      success: true,
      action: 'fast_zip_created',
      customer: customer.name,
      zipPath,
      fileCount: processedFiles,
      zipSize: zipBuffer.length,
      totalFileSize: totalSize,
      note: `Fast ZIP with ${processedFiles} small files (under 10MB each)`
    })

  } catch (error) {
    console.error('❌ Fast ZIP error:', error)
    return NextResponse.json({
      error: 'Failed to create fast ZIP',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
