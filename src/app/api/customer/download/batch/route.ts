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
    customerId = decoded.split(':')[0]
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
    throw new Error('Session har upphört')
  }

  return customer
}

// POST /api/customer/download/batch - Batch nedladdning med automatisk ZIP
export async function POST(request: NextRequest) {
  try {
    // Verifiera session
    const customer = await verifyCustomerSession(request)
    const customerId = customer.id

    const { fileIds } = await request.json()

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'Filer krävs för batch-nedladdning' }, { status: 400 })
    }

    // Hämta alla filer och verifiera ägarskap
    const { data: files, error: filesError } = await supabaseAdmin
      .from('files')
      .select('id, customer_id, filename, original_name, file_type, file_size')
      .in('id', fileIds)
      .eq('customer_id', customerId)

    if (filesError || !files || files.length === 0) {
      return NextResponse.json(
        { error: 'Inga filer hittades eller åtkomst nekad' },
        { status: 404 }
      )
    }

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
    console.log(`Adding ${files.length} files to ZIP...`)
    for (const file of files) {
      try {
        console.log(`Adding ${file.original_name} to ZIP...`)
        const fileBuffer = await r2Service.getFile(file.filename)
        archive.append(fileBuffer, { name: file.original_name })
        console.log(`Successfully added ${file.original_name} (${fileBuffer.length} bytes)`)
      } catch (error) {
        console.error(`Error adding file ${file.original_name}:`, error)
        // Fortsätt med andra filer även om en misslyckas
      }
    }

    // Finalisera ZIP:en
    console.log('Finalizing ZIP archive...')
    archive.finalize()

    // Vänta på att ZIP:en ska bli klar
    while (!archiveFinished) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Kombinera alla chunks
    const zipBuffer = Buffer.concat(chunks)
    console.log(`ZIP created successfully, size: ${zipBuffer.length} bytes`)

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error: any) {
    console.error('Batch download API error:', error)
    
    // Hantera session-fel specifikt
    if (error.message?.includes('session') || error.message?.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Serverfel vid batch-nedladdning' },
      { status: 500 }
    )
  }
}
