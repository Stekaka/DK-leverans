import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../../lib/cloudflare-r2'
import archiver from 'archiver'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Admin client som bara körs på servern
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Verifierar customer session
async function verifyCustomerSession(request: NextRequest) {
  const sessionToken = request.cookies.get('customer_session')?.value
  if (!sessionToken) {
    throw new Error('Ingen session hittades')
  }

  let customerId: string
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString()
    const parts = decoded.split(':')
    customerId = parts[0]
    
    // Kolla om det är en quick-access token med expiration
    if (parts.length >= 3 && parts[1] === 'quick') {
      const expiresAt = parseInt(parts[2])
      if (Date.now() > expiresAt) {
        throw new Error('Quick access token har upphört')
      }
    }
  } catch {
    throw new Error('Ogiltig session')
  }

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, project, status')
    .eq('id', customerId)
    .eq('status', 'active')
    .single()

  if (error || !customer) {
    // För test-customers, skapa mock data
    if (customerId === 'test-marc-zorjan') {
      return {
        id: 'test-marc-zorjan',
        name: 'Marc Zorjan',
        email: 'marc.zorjan@gotevent.se',
        project: 'Götevent projekt',
        status: 'active'
      }
    }
    throw new Error('Session har upphört')
  }

  return customer
}

// GET /api/customer/download/batch - Return method info (debugging)
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Batch download API - use POST method',
    methods: ['POST'],
    timestamp: new Date().toISOString()
  }, { status: 200 })
}

// OPTIONS /api/customer/download/batch - CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// POST /api/customer/download/batch - Batch nedladdning med automatisk ZIP
// Force deployment: 2025-07-28 10:40
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log(`[BATCH-DOWNLOAD] Starting batch download at ${new Date().toISOString()}`)
  
  try {
    // Verifiera session
    const customer = await verifyCustomerSession(request)
    const customerId = customer.id
    console.log(`[BATCH-DOWNLOAD] Customer verified: ${customer.email}`)

    const { fileIds } = await request.json()
    console.log(`[BATCH-DOWNLOAD] Requested files: ${fileIds?.length || 0}`)

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      console.log(`[BATCH-DOWNLOAD] Invalid fileIds: ${JSON.stringify(fileIds)}`)
      return NextResponse.json({ error: 'Filer krävs för batch-nedladdning' }, { status: 400 })
    }

    // Begränsa till max 20 filer åt gången för att undvika timeout på Vercel (10s limit)
    if (fileIds.length > 20) {
      console.log(`[BATCH-DOWNLOAD] Too many files requested: ${fileIds.length} (max 20 per batch for Vercel)`)
      return NextResponse.json({ 
        error: `För många filer (${fileIds.length}). Max 20 filer per nedladdning på grund av serverlimiter. Frontend delar upp automatiskt.` 
      }, { status: 400 })
    }

    // Hämta alla filer och verifiera ägarskap
    console.log(`[BATCH-DOWNLOAD] Fetching file metadata from database...`)
    const { data: files, error: filesError } = await supabaseAdmin
      .from('files')
      .select('id, customer_id, filename, original_name, file_type, file_size')
      .in('id', fileIds)
      .eq('customer_id', customerId)

    if (filesError || !files || files.length === 0) {
      console.log(`[BATCH-DOWNLOAD] No files found or access denied. Error:`, filesError)
      return NextResponse.json(
        { error: 'Inga filer hittades eller åtkomst nekad' },
        { status: 404 }
      )
    }

    console.log(`[BATCH-DOWNLOAD] Found ${files.length} files in database`)

    // Beräkna total storlek
    const totalSize = files.reduce((acc, file) => acc + (file.file_size || 0), 0)
    const totalSizeGB = totalSize / (1024 * 1024 * 1024)
    
    console.log(`Batch download: ${files.length} files, total size: ${totalSizeGB.toFixed(2)} GB`)

    // Om total storlek > 5GB eller > 10 filer, skapa ZIP
    const shouldZip = totalSizeGB > 5 || files.length > 10

    if (!shouldZip && files.length === 1) {
      // Enstaka fil under 5GB - returnera direkt
      const file = files[0]
      const fileBuffer = await r2Service.getFile(file.filename)
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.original_name}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    // Skapa ZIP för flera filer eller stora nedladdningar
    const zipName = `${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_files_${new Date().getTime()}.zip`
    
    console.log(`Creating ZIP archive: ${zipName}`)
    
    // Skapa ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 6 } // Komprimering nivå (0-9)
    })

    let archiveFinished = false
    const chunks: Buffer[] = []

    // Samla alla ZIP chunks
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    
    archive.on('end', () => {
      console.log('Archive finalized')
      archiveFinished = true
    })
    
    archive.on('error', (err) => {
      console.error('Archive error:', err)
      throw err
    })

    // Lägg till alla filer i ZIP:en sekventiellt (undvik parallella requests till R2)
    console.log(`[BATCH-DOWNLOAD] Adding ${files.length} files to ZIP...`)
    let addedFiles = 0
    let failedFiles = 0
    
    for (const file of files) {
      try {
        const fileStartTime = Date.now()
        console.log(`[BATCH-DOWNLOAD] [${addedFiles + 1}/${files.length}] Adding ${file.original_name} to ZIP...`)
        
        const fileBuffer = await r2Service.getFile(file.filename)
        archive.append(fileBuffer, { name: file.original_name })
        
        const fileEndTime = Date.now()
        addedFiles++
        console.log(`[BATCH-DOWNLOAD] [${addedFiles}/${files.length}] Successfully added ${file.original_name} (${fileBuffer.length} bytes) in ${fileEndTime - fileStartTime}ms`)
        
        // Progress update every 10 files
        if (addedFiles % 10 === 0) {
          const elapsed = Date.now() - startTime
          console.log(`[BATCH-DOWNLOAD] Progress: ${addedFiles}/${files.length} files (${((addedFiles/files.length)*100).toFixed(1)}%) in ${elapsed}ms`)
        }
        
      } catch (error) {
        failedFiles++
        console.error(`[BATCH-DOWNLOAD] Error adding file ${file.original_name}:`, error)
        // Fortsätt med andra filer även om en misslyckas
      }
    }

    console.log(`[BATCH-DOWNLOAD] Completed adding files: ${addedFiles} successful, ${failedFiles} failed`)

    // Finalisera ZIP:en
    console.log(`[BATCH-DOWNLOAD] Finalizing ZIP archive...`)
    archive.finalize()

    // Vänta på att ZIP:en ska bli klar med timeout
    console.log(`[BATCH-DOWNLOAD] Waiting for ZIP finalization...`)
    let waitTime = 0
    const maxWaitTime = 30000 // 30 seconds max wait for finalization
    
    while (!archiveFinished && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waitTime += 100
    }

    if (!archiveFinished) {
      console.error(`[BATCH-DOWNLOAD] ZIP finalization timeout after ${maxWaitTime}ms`)
      throw new Error('ZIP creation timeout')
    }

    // Kombinera alla chunks
    const zipBuffer = Buffer.concat(chunks)
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    console.log(`[BATCH-DOWNLOAD] ZIP created successfully:`)
    console.log(`[BATCH-DOWNLOAD] - Files: ${addedFiles}/${files.length} (${failedFiles} failed)`)
    console.log(`[BATCH-DOWNLOAD] - ZIP size: ${zipBuffer.length} bytes (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
    console.log(`[BATCH-DOWNLOAD] - Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`)
    console.log(`[BATCH-DOWNLOAD] - Average per file: ${(totalTime / files.length).toFixed(0)}ms`)

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error: any) {
    const endTime = Date.now()
    const totalTime = endTime - startTime
    console.error(`[BATCH-DOWNLOAD] ERROR after ${totalTime}ms:`, error)
    
    // Hantera session-fel specifikt
    if (error.message?.includes('session') || error.message?.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    
    // Hantera timeout-fel
    if (error.message?.includes('timeout')) {
      return NextResponse.json({ error: 'ZIP-skapandet tog för lång tid. Försök med färre filer.' }, { status: 408 })
    }
    
    return NextResponse.json(
      { error: 'Serverfel vid batch-nedladdning' },
      { status: 500 }
    )
  }
}
