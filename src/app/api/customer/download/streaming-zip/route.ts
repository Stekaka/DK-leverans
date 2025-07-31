import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../../lib/cloudflare-r2'
import JSZip from 'jszip'

// Streaming ZIP för att undvika timeout - skapar EN stor ZIP
export async function GET(request: NextRequest) {
  try {
    console.log('🌊 === STREAMING ZIP CREATION ===')
    
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const adminPassword = request.headers.get('x-admin-password')
    
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return new Response('Unauthorized', { status: 401 })
    }
    
    if (!customerId) {
      return new Response('Customer ID required', { status: 400 })
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
      .select('id, name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return new Response('Customer not found', { status: 404 })
    }

    // Hämta ALLA filer för kunden
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_size, folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .order('folder_path', { ascending: true })
      .order('original_name', { ascending: true })

    if (filesError || !files || files.length === 0) {
      return new Response('No files found', { status: 404 })
    }

    console.log(`🗜️ Creating streaming ZIP for ${customer.name}: ${files.length} files`)

    // Skapa ZIP med streaming för att undvika memory issues
    const zip = new JSZip()
    let processedFiles = 0

    // Processa filer i små grupper för att undvika memory problem
    const batchSize = 5
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      
      for (const file of batch) {
        try {
          // Skippa extremt stora filer för att undvika memory problem
          if (file.file_size && file.file_size > 500 * 1024 * 1024) { // 500MB limit
            console.warn(`⚠️ Skipping large file: ${file.original_name} (${(file.file_size / 1024 / 1024).toFixed(2)} MB)`)
            continue
          }

          console.log(`📄 Adding ${processedFiles + 1}/${files.length}: ${file.original_name}`)
          
          const fileBuffer = await r2Service.getFile(file.filename)
          
          // Skapa mappstruktur i ZIP
          let zipEntryName = file.original_name
          if (file.folder_path && file.folder_path !== 'root') {
            zipEntryName = `${file.folder_path}/${file.original_name}`
          }
          
          zip.file(zipEntryName, fileBuffer)
          processedFiles++
          
        } catch (fileError) {
          console.error(`❌ Error adding file ${file.original_name}:`, fileError)
        }
      }
      
      // Kort paus mellan batches för att ge systemet tid att andas
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    console.log(`🔄 Generating final ZIP with ${processedFiles} files...`)

    // Generera ZIP som stream med minimal komprimering för hastighet
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'STORE', // Ingen komprimering = snabbast
      streamFiles: true
    })

    console.log(`✅ ZIP generated: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Returnera ZIP direkt som download
    const fileName = `${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_alla_filer.zip`
    
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ Streaming ZIP error:', error)
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500 
    })
  }
}
