import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Admin client som bara körs på servern
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Verifierar customer session (samma som i customer/files/route.ts)
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

// GET /api/customer/download?fileId=xxx - Ladda ner fil
export async function GET(request: NextRequest) {
  try {
    // Verifiera session
    const customer = await verifyCustomerSession(request)
    const customerId = customer.id

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID krävs' }, { status: 400 })
    }

    // Verifiera att kunden äger filen
    const { data: file, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, customer_id, filename, original_name, file_type')
      .eq('id', fileId)
      .eq('customer_id', customerId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'Fil inte hittad eller åtkomst nekad' },
        { status: 404 }
      )
    }

    if (!file.filename) {
      return NextResponse.json(
        { error: 'Filnyckel inte tillgänglig' },
        { status: 404 }
      )
    }

    try {
      // Hämta filen från Cloudflare R2 med vår R2-service
      console.log('Downloading file with key:', file.filename)
      const fileBuffer = await r2Service.getFile(file.filename)
      
      // Returnera filen med rätt headers för TVINGAD nedladdning
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream', // Tvingar nedladdning
          'Content-Disposition': `attachment; filename="${file.original_name}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

    } catch (downloadError) {
      console.error('Error downloading file:', downloadError)
      return NextResponse.json(
        { error: 'Kunde inte ladda ner fil' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Download API error:', error)
    
    // Hantera session-fel specifikt
    if (error.message?.includes('session') || error.message?.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Serverfel' },
      { status: 500 }
    )
  }
}
