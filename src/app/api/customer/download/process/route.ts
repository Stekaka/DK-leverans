import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../../lib/cloudflare-r2'
import archiver from 'archiver'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// POST /api/customer/download/process - Bakgrundsprocess för ZIP-skapande
export async function POST(request: NextRequest) {
  try {
    const { downloadId, customerId } = await request.json()
    
    console.log(`[ZIP-PROCESSOR] Starting background ZIP creation for download ${downloadId}`)

    // Hämta download job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('download_jobs')
      .select('*')
      .eq('id', downloadId)
      .eq('customer_id', customerId)
      .single()

    if (jobError || !job) {
      console.error(`[ZIP-PROCESSOR] Job not found: ${downloadId}`)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Uppdatera status till "processing"
    await supabaseAdmin
      .from('download_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString() 
      })
      .eq('id', downloadId)

    // Hämta filer
    const { data: files, error: filesError } = await supabaseAdmin
      .from('files')
      .select('id, customer_id, filename, original_name, file_type, file_size')
      .in('id', job.file_ids)
      .eq('customer_id', customerId)

    if (filesError || !files || files.length === 0) {
      await supabaseAdmin
        .from('download_jobs')
        .update({ status: 'failed', error: 'Files not found' })
        .eq('id', downloadId)
      
      return NextResponse.json({ error: 'Files not found' }, { status: 404 })
    }

    // Hämta customer info
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single()

    const zipName = `${(customer?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}_complete_${Date.now()}.zip`
    
    console.log(`[ZIP-PROCESSOR] Creating ZIP with ${files.length} files: ${zipName}`)

    // Skapa ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 6 }
    })

    let archiveFinished = false
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    
    archive.on('end', () => {
      archiveFinished = true
    })
    
    archive.on('error', (err) => {
      throw err
    })

    // Lägg till alla filer
    let processedFiles = 0
    for (const file of files) {
      try {
        console.log(`[ZIP-PROCESSOR] Adding file ${processedFiles + 1}/${files.length}: ${file.original_name}`)
        
        const fileBuffer = await r2Service.getFile(file.filename)
        archive.append(fileBuffer, { name: file.original_name })
        
        processedFiles++
        
        // Uppdatera progress var 10:e fil
        if (processedFiles % 10 === 0) {
          await supabaseAdmin
            .from('download_jobs')
            .update({ 
              processed_files: processedFiles,
              progress: Math.round((processedFiles / files.length) * 100)
            })
            .eq('id', downloadId)
        }
        
      } catch (error) {
        console.error(`[ZIP-PROCESSOR] Error adding file ${file.original_name}:`, error)
      }
    }

    // Finalisera ZIP
    console.log(`[ZIP-PROCESSOR] Finalizing ZIP...`)
    archive.finalize()

    // Vänta på att ZIP ska bli klar
    while (!archiveFinished) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const zipBuffer = Buffer.concat(chunks)
    console.log(`[ZIP-PROCESSOR] ZIP created: ${zipBuffer.length} bytes`)

    // Ladda upp ZIP till R2
    const zipFileName = `downloads/${downloadId}/${zipName}`
    await r2Service.uploadFile(zipBuffer, zipFileName, 'application/zip', customerId)

    // Uppdatera job som klar
    await supabaseAdmin
      .from('download_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        zip_filename: zipFileName,
        zip_size: zipBuffer.length,
        processed_files: processedFiles
      })
      .eq('id', downloadId)

    console.log(`[ZIP-PROCESSOR] Download ${downloadId} completed successfully`)

    return NextResponse.json({ 
      success: true, 
      downloadId,
      zipSize: zipBuffer.length,
      processedFiles 
    })

  } catch (error: any) {
    console.error('[ZIP-PROCESSOR] Error:', error)
    
    // Markera job som failed
    const { downloadId } = await request.json().catch(() => ({}))
    if (downloadId) {
      await supabaseAdmin
        .from('download_jobs')
        .update({ 
          status: 'failed', 
          error: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', downloadId)
    }

    return NextResponse.json(
      { error: 'ZIP creation failed' },
      { status: 500 }
    )
  }
}
