import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../../../lib/cloudflare-r2'

// Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// GET /api/customer/files/[id]/download - Ladda ner en enskild fil
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const fileId = params.id
  let customerId: string | null = null
  
  try {
    console.log(`[SINGLE-FILE-DOWNLOAD] Starting download for file ID: ${fileId}`)

    // Hämta session token från header eller cookie
    const authHeader = request.headers.get('authorization')
    const sessionToken = request.cookies.get('supabase-auth-token')?.value
    
    // Försök autentisera med session token
    if (sessionToken) {
      try {
        // Här borde vi validera session token, men för nu använder vi en enklare approach
        // Hämta customer ID från URL eller annan parameter
        const url = new URL(request.url)
        const customerIdParam = url.searchParams.get('customer_id')
        if (customerIdParam) {
          customerId = customerIdParam
        }
      } catch (error) {
        console.log('[SINGLE-FILE-DOWNLOAD] Session validation failed:', error)
      }
    }

    // Om ingen customer ID från session, försök från request
    if (!customerId) {
      const url = new URL(request.url)
      customerId = url.searchParams.get('customer_id')
    }

    if (!customerId) {
      console.log('[SINGLE-FILE-DOWNLOAD] No customer ID found')
      return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 })
    }

    console.log(`[SINGLE-FILE-DOWNLOAD] Customer ID: ${customerId}`)

    // Hämta fil-information och kontrollera ägarskap
    const { data: file, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, customer_id, filename, original_name, file_type, file_size, is_deleted, is_trashed, uploaded_at')
      .eq('id', fileId)
      .eq('customer_id', customerId)
      .single()

    if (fileError || !file) {
      console.log(`[SINGLE-FILE-DOWNLOAD] File not found or access denied.`)
      console.log(`[SINGLE-FILE-DOWNLOAD] File ID: ${fileId}, Customer ID: ${customerId}`)
      console.log(`[SINGLE-FILE-DOWNLOAD] Database error:`, fileError)
      
      // Detaljerad feldiagnostik
      if (fileError?.code === 'PGRST116') {
        // Ingen rad hittades - kolla om filen finns för någon annan kund
        const { data: anyFile } = await supabaseAdmin
          .from('files')
          .select('id, customer_id, is_deleted, is_trashed')
          .eq('id', fileId)
          .single()
        
        if (anyFile) {
          console.log(`[SINGLE-FILE-DOWNLOAD] File exists but belongs to customer ${anyFile.customer_id}, requested by ${customerId}`)
          console.log(`[SINGLE-FILE-DOWNLOAD] File status: deleted=${anyFile.is_deleted}, trashed=${anyFile.is_trashed}`)
          return NextResponse.json({ error: 'Fil hittades inte eller åtkomst nekad' }, { status: 404 })
        } else {
          console.log(`[SINGLE-FILE-DOWNLOAD] File ${fileId} does not exist in database at all`)
          return NextResponse.json({ error: 'Filen existerar inte' }, { status: 404 })
        }
      }
      
      return NextResponse.json({ error: 'Fil hittades inte eller åtkomst nekad' }, { status: 404 })
    }

    // Kontrollera filstatus
    if (file.is_deleted) {
      console.log(`[SINGLE-FILE-DOWNLOAD] File ${fileId} is marked as deleted`)
      return NextResponse.json({ error: 'Filen är borttagen' }, { status: 410 })
    }

    if (file.is_trashed) {
      console.log(`[SINGLE-FILE-DOWNLOAD] File ${fileId} is in trash`)
      return NextResponse.json({ error: 'Filen finns i papperskorgen' }, { status: 410 })
    }

    console.log(`[SINGLE-FILE-DOWNLOAD] Found file: ${file.original_name} (${file.file_size} bytes)`)
    console.log(`[SINGLE-FILE-DOWNLOAD] R2 filename: ${file.filename}`)

    // Ladda ner fil från R2 med detaljerad felhantering
    let fileBuffer: Buffer
    try {
      fileBuffer = await r2Service.getFile(file.filename)
      console.log(`[SINGLE-FILE-DOWNLOAD] Successfully downloaded ${file.original_name} from R2 (${fileBuffer.length} bytes)`)
      
      // Kontrollera att filstorleken stämmer
      if (fileBuffer.length !== file.file_size) {
        console.warn(`[SINGLE-FILE-DOWNLOAD] Size mismatch: DB says ${file.file_size}, got ${fileBuffer.length}`)
      }
    } catch (r2Error) {
      console.error(`[SINGLE-FILE-DOWNLOAD] R2 Error for file ${file.filename}:`, r2Error)
      
      // Specifik R2 felhantering
      if (r2Error instanceof Error) {
        if (r2Error.message.includes('NoSuchKey') || r2Error.message.includes('Not Found')) {
          console.log(`[SINGLE-FILE-DOWNLOAD] File not found in R2 storage: ${file.filename}`)
          return NextResponse.json({ 
            error: 'Filen finns inte längre i lagringen', 
            details: `R2 key: ${file.filename}` 
          }, { status: 404 })
        } else if (r2Error.message.includes('Access Denied') || r2Error.message.includes('403')) {
          console.log(`[SINGLE-FILE-DOWNLOAD] Access denied to R2 file: ${file.filename}`)
          return NextResponse.json({ 
            error: 'Åtkomst nekad till filen', 
            details: 'R2 access denied' 
          }, { status: 403 })
        } else if (r2Error.message.includes('timeout')) {
          console.log(`[SINGLE-FILE-DOWNLOAD] Timeout downloading from R2: ${file.filename}`)
          return NextResponse.json({ 
            error: 'Timeout vid nedladdning från lagring', 
            details: 'R2 timeout' 
          }, { status: 504 })
        }
      }
      
      throw r2Error // Re-throw för generisk felhantering
    }

    // Returnera filen
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': file.file_type || 'application/octet-stream',
        'Content-Length': file.file_size.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_name)}"`,
        // CORS headers för client-side access
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',  
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })

  } catch (error) {
    console.error('[SINGLE-FILE-DOWNLOAD] Error:', error)
    console.error('[SINGLE-FILE-DOWNLOAD] Stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('[SINGLE-FILE-DOWNLOAD] File ID:', fileId)
    console.error('[SINGLE-FILE-DOWNLOAD] Customer ID:', customerId)
    
    // Ge mer specifik felhantering
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Fil-nedladdning timeout. Filen kan vara för stor.' },
          { status: 504 }
        )
      } else if (error.message.includes('Failed to retrieve file')) {
        return NextResponse.json(
          { error: 'Kunde inte hämta fil från lagring' },
          { status: 404 }
        )
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Ett fel uppstod vid nedladdning av filen',
        details: error instanceof Error ? error.message : 'Okänt fel'
      },
      { status: 500 }
    )
  }
}
