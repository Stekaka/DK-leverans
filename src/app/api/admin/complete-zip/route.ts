import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'
import JSZip from 'jszip'

// Skapar EN stor ZIP-fil med ALLA filer - optimerad för Marc's dataset
export async function POST(request: NextRequest) {
  try {
    console.log('🎯 === CREATE SINGLE COMPLETE ZIP ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId, maxFileSizeMB = 100 } = await request.json()
    
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

    const maxFileSize = maxFileSizeMB * 1024 * 1024 // Convert to bytes

    // Hämta ALLA filer (men skippa extremt stora)
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_size, folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .lt('file_size', maxFileSize) // Bara filer under size limit
      .order('folder_path', { ascending: true })
      .order('original_name', { ascending: true })

    if (filesError || !files || files.length === 0) {
      return NextResponse.json({ 
        error: 'No suitable files found',
        customer: customer.name,
        note: `Only files under ${maxFileSizeMB}MB are included`
      }, { status: 404 })
    }

    console.log(`🗜️ Creating complete ZIP for ${customer.name}: ${files.length} files`)

    // Skapa ZIP med ALLA filer
    const zip = new JSZip()
    let processedFiles = 0
    let totalSize = 0
    let skippedFiles = 0

    // Process files med memory-friendly approach
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        console.log(`📄 Adding ${i + 1}/${files.length}: ${file.original_name}`)
        
        const fileBuffer = await r2Service.getFile(file.filename)
        
        // Skapa mappstruktur i ZIP
        let zipEntryName = file.original_name
        if (file.folder_path && file.folder_path !== 'root') {
          zipEntryName = `${file.folder_path}/${file.original_name}`
        }
        
        zip.file(zipEntryName, fileBuffer)
        
        processedFiles++
        totalSize += file.file_size || 0
        
        // Progress log varje 25:e fil
        if (processedFiles % 25 === 0) {
          console.log(`📦 Progress: ${processedFiles}/${files.length} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`)
        }
        
        // Yield to event loop every 10 files
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
      } catch (fileError) {
        console.error(`❌ Error adding file ${file.original_name}:`, fileError)
        skippedFiles++
      }
    }

    if (processedFiles === 0) {
      return NextResponse.json({
        error: 'No files could be processed',
        customer: customer.name
      }, { status: 400 })
    }

    // Generera COMPLETE ZIP
    console.log(`🔄 Generating complete ZIP with ${processedFiles} files...`)
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 } // Minimal komprimering för hastighet
    })

    const zipSizeMB = zipBuffer.length / 1024 / 1024
    console.log(`✅ Complete ZIP created: ${zipSizeMB.toFixed(2)} MB`)

    // Ladda upp den KOMPLETTA ZIP:en till R2
    const zipPath = `prebuilt-zips/${customerId}/COMPLETE_ALL_FILES.zip`
    await r2Service.uploadFile(zipBuffer, zipPath, 'application/zip', customerId)

    // Skapa metadata för kompletta ZIP:en
    const metadata = {
      customer_id: customerId,
      customer_name: customer.name,
      customer_email: customer.email,
      file_count: processedFiles,
      skipped_files: skippedFiles,
      total_files_size: totalSize,
      zip_size: zipBuffer.length,
      max_file_size_limit: maxFileSize,
      built_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'COMPLETE_ZIP'
    }

    const metadataPath = `prebuilt-zips/${customerId}/COMPLETE_metadata.json`
    await r2Service.uploadFile(
      Buffer.from(JSON.stringify(metadata, null, 2)),
      metadataPath,
      'application/json',
      customerId
    )

    // Spara referens i databasen
    const { error: dbError } = await supabase
      .from('prebuilt_zips')
      .upsert({
        customer_id: customerId,
        zip_path: zipPath,
        metadata_path: metadataPath,
        file_count: processedFiles,
        zip_size: zipBuffer.length,
        built_at: new Date().toISOString(),
        expires_at: metadata.expires_at
      })

    if (dbError) {
      console.warn('⚠️ Failed to save ZIP reference to database:', dbError)
    }

    console.log(`🎉 Successfully created COMPLETE ZIP for ${customer.name}`)

    return NextResponse.json({
      success: true,
      action: 'complete_zip_created',
      customer: customer.name,
      zipPath,
      fileCount: processedFiles,
      skippedFiles,
      zipSize: zipBuffer.length,
      zipSizeMB: zipSizeMB,
      totalFileSize: totalSize,
      metadata,
      downloadUrl: `https://dk-leverans.vercel.app/api/customer/download/prebuilt?customerId=${customerId}`,
      note: `COMPLETE ZIP with ALL ${processedFiles} files (under ${maxFileSizeMB}MB each)`
    })

  } catch (error) {
    console.error('❌ Complete ZIP error:', error)
    return NextResponse.json({
      error: 'Failed to create complete ZIP',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
