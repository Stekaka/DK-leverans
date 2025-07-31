import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'
import JSZip from 'jszip'

// Använd Edge Runtime för längre timeout
export const runtime = 'edge'

// Service för att skapa och hantera förbyggda ZIP-filer för kunder
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 === PREBUILT ZIP GENERATOR ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    const validPasswords = [
      'DronarkompanietAdmin2025!',
      'DrönarkompanietAdmin2025!',
      process.env.ADMIN_PASSWORD,
      'admin123'
    ].filter(p => p)
    
    if (!adminPassword || !validPasswords.includes(adminPassword)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId, forceRebuild = false } = await request.json()
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    console.log(`📦 Building ZIP for customer: ${customerId}`)

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

    // Kontrollera om ZIP redan finns och är aktuell
    const zipPath = `prebuilt-zips/${customerId}/complete_archive.zip`
    const zipMetadataPath = `prebuilt-zips/${customerId}/metadata.json`

    if (!forceRebuild) {
      try {
        // Kontrollera om ZIP finns och metadata
        const existingMetadata = await r2Service.getFile(zipMetadataPath)
        const metadata = JSON.parse(existingMetadata.toString())
        
        // Kontrollera om ZIP är aktuell (skapad inom senaste 24h och samma antal filer)
        const lastBuilt = new Date(metadata.built_at)
        const hoursOld = (Date.now() - lastBuilt.getTime()) / (1000 * 60 * 60)
        
        if (hoursOld < 24 && metadata.file_count > 0) {
          console.log(`♻️ Using existing ZIP (${hoursOld.toFixed(1)}h old, ${metadata.file_count} files)`)
          return NextResponse.json({
            success: true,
            action: 'used_existing',
            zipPath,
            fileCount: metadata.file_count,
            zipSize: metadata.zip_size,
            builtAt: metadata.built_at
          })
        }
      } catch (metadataError) {
        console.log('📝 No existing ZIP metadata found, building new one')
      }
    }

    // Hämta alla aktiva filer för kunden
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_type, file_size, folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .order('folder_path', { ascending: true })
      .order('original_name', { ascending: true })

    if (filesError || !files || files.length === 0) {
      console.log(`❌ No files found for customer ${customerId}`)
      return NextResponse.json({ 
        error: 'No files found for customer',
        customer: customer.name 
      }, { status: 404 })
    }

    console.log(`📁 Found ${files.length} files to archive`)

    // Skapa ZIP med JSZip istället för archiver
    const zip = new JSZip()
    let processedFiles = 0
    let totalSize = 0

    for (const file of files) {
      try {
        console.log(`📄 Adding file ${processedFiles + 1}/${files.length}: ${file.original_name}`)
        
        const fileBuffer = await r2Service.getFile(file.filename)
        
        // Skapa mappstruktur i ZIP baserat på folder_path
        let zipEntryName = file.original_name
        if (file.folder_path && file.folder_path !== 'root') {
          zipEntryName = `${file.folder_path}/${file.original_name}`
        }
        
        zip.file(zipEntryName, fileBuffer)
        
        processedFiles++
        totalSize += file.file_size || 0
        
        // Progress log varje 50:e fil
        if (processedFiles % 50 === 0) {
          console.log(`📦 Progress: ${processedFiles}/${files.length} files processed`)
        }
        
      } catch (fileError) {
        console.error(`❌ Error adding file ${file.original_name}:`, fileError)
        // Fortsätt med andra filer
      }
    }

    // Generera ZIP
    console.log(`🔄 Generating ZIP with ${processedFiles} files...`)
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 } // Balans mellan hastighet och storlek
    })

    console.log(`✅ ZIP created: ${zipBuffer.length} bytes (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`)

    // Ladda upp ZIP till R2
    await r2Service.uploadFile(
      zipBuffer, 
      zipPath, 
      'application/zip',
      customerId
    )

    // Skapa och ladda upp metadata
    const metadata = {
      customer_id: customerId,
      customer_name: customer.name,
      customer_email: customer.email,
      file_count: processedFiles,
      total_files_size: totalSize,
      zip_size: zipBuffer.length,
      built_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dagar
    }

    await r2Service.uploadFile(
      Buffer.from(JSON.stringify(metadata, null, 2)),
      zipMetadataPath,
      'application/json',
      customerId
    )

    // Spara referens i databasen
    const { error: dbError } = await supabase
      .from('prebuilt_zips')
      .upsert({
        customer_id: customerId,
        zip_path: zipPath,
        metadata_path: zipMetadataPath,
        file_count: processedFiles,
        zip_size: zipBuffer.length,
        built_at: new Date().toISOString(),
        expires_at: metadata.expires_at
      })

    if (dbError) {
      console.warn('⚠️ Failed to save ZIP reference to database:', dbError)
      // Inte kritiskt - ZIP:en finns i R2
    }

    console.log(`🎉 Successfully built ZIP for ${customer.name}: ${processedFiles} files, ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    return NextResponse.json({
      success: true,
      action: 'built_new',
      customer: customer.name,
      zipPath,
      fileCount: processedFiles,
      zipSize: zipBuffer.length,
      builtAt: metadata.built_at,
      expiresAt: metadata.expires_at
    })

  } catch (error) {
    console.error('❌ Prebuilt ZIP error:', error)
    return NextResponse.json({
      error: 'Failed to build ZIP',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Hämta information om förbyggd ZIP
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const zipMetadataPath = `prebuilt-zips/${customerId}/metadata.json`
    
    try {
      const metadataBuffer = await r2Service.getFile(zipMetadataPath)
      const metadata = JSON.parse(metadataBuffer.toString())
      
      // Kontrollera om ZIP har gått ut
      const expiresAt = new Date(metadata.expires_at)
      const isExpired = Date.now() > expiresAt.getTime()
      
      return NextResponse.json({
        exists: true,
        expired: isExpired,
        metadata
      })
      
    } catch (notFoundError) {
      return NextResponse.json({
        exists: false,
        metadata: null
      })
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check ZIP status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
