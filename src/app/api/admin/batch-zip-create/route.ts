import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'
import JSZip from 'jszip'

// Skapa en enskild batch ZIP
export async function POST(request: NextRequest) {
  try {
    console.log('🔨 === CREATE SINGLE BATCH ZIP ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId, batchNumber, batchSize = 50, maxFileSize = 20 * 1024 * 1024 } = await request.json()
    
    if (!customerId || !batchNumber) {
      return NextResponse.json({ error: 'Customer ID and batch number required' }, { status: 400 })
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

    // Beräkna offset för denna batch
    const offset = (batchNumber - 1) * batchSize

    // Hämta filer för denna batch (bara rimligt stora filer)
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_size, folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .lt('file_size', maxFileSize) // Bara filer under 20MB
      .order('original_name', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (filesError || !files || files.length === 0) {
      return NextResponse.json({ 
        error: `No suitable files found for batch ${batchNumber}`,
        customer: customer.name,
        note: `Only files under ${maxFileSize / 1024 / 1024}MB are included`
      }, { status: 404 })
    }

    console.log(`📁 Creating batch ${batchNumber}: ${files.length} files for ${customer.name}`)

    // Skapa ZIP för denna batch
    const zip = new JSZip()
    let processedFiles = 0
    let totalSize = 0
    let skippedFiles = 0

    for (const file of files) {
      try {
        console.log(`📄 Adding file ${processedFiles + 1}/${files.length}: ${file.original_name}`)
        
        const fileBuffer = await r2Service.getFile(file.filename)
        
        // Skapa mappstruktur i ZIP
        let zipEntryName = file.original_name
        if (file.folder_path && file.folder_path !== 'root') {
          zipEntryName = `${file.folder_path}/${file.original_name}`
        }
        
        zip.file(zipEntryName, fileBuffer)
        
        processedFiles++
        totalSize += file.file_size || 0
        
      } catch (fileError) {
        console.error(`❌ Error adding file ${file.original_name}:`, fileError)
        skippedFiles++
      }
    }

    if (processedFiles === 0) {
      return NextResponse.json({
        error: `No files could be processed for batch ${batchNumber}`,
        customer: customer.name
      }, { status: 400 })
    }

    // Generera ZIP
    console.log(`⚡ Generating batch ZIP ${batchNumber}...`)
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 3 } // Måttlig komprimering för balans
    })

    console.log(`✅ Batch ZIP ${batchNumber} created: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Ladda upp batch ZIP
    const zipPath = `prebuilt-zips/${customerId}/batch_${batchNumber}.zip`
    await r2Service.uploadFile(zipBuffer, zipPath, 'application/zip', customerId)

    // Skapa batch metadata
    const metadata = {
      customer_id: customerId,
      customer_name: customer.name,
      batch_number: batchNumber,
      batch_size: batchSize,
      processed_files: processedFiles,
      skipped_files: skippedFiles,
      total_file_size: totalSize,
      zip_size: zipBuffer.length,
      max_file_size_limit: maxFileSize,
      built_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    const metadataPath = `prebuilt-zips/${customerId}/batch_${batchNumber}_metadata.json`
    await r2Service.uploadFile(
      Buffer.from(JSON.stringify(metadata, null, 2)),
      metadataPath,
      'application/json',
      customerId
    )

    return NextResponse.json({
      success: true,
      action: 'batch_zip_created',
      customer: customer.name,
      batchNumber,
      zipPath,
      fileCount: processedFiles,
      skippedFiles,
      zipSize: zipBuffer.length,
      totalFileSize: totalSize,
      metadata,
      downloadUrl: `https://dk-leverans.vercel.app/api/customer/download/batch?customerId=${customerId}&batch=${batchNumber}`
    })

  } catch (error) {
    console.error('❌ Batch ZIP creation error:', error)
    return NextResponse.json({
      error: 'Failed to create batch ZIP',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
