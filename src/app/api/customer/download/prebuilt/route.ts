import { NextRequest, NextResponse } from 'next/server'
import { r2Service } from '../../../../../../lib/cloudflare-r2'
import { createClient } from '@supabase/supabase-js'

// Hjälpfunktion för att verifiera kundsession (förenklad version)
async function verifyCustomerSession(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value
  
  if (!sessionToken) {
    throw new Error('No session token')
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

  // Hämta session från databas
  const { data: session, error } = await supabase
    .from('customer_sessions')
    .select('*, customers(*)')
    .eq('session_token', sessionToken)
    .eq('is_active', true)
    .single()

  if (error || !session) {
    throw new Error('Invalid session')
  }

  return session.customers
}

// GET - Ladda ner förbyggd ZIP för kund
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 === PREBUILT ZIP DOWNLOAD ===')
    
    // Verifiera session
    const customer = await verifyCustomerSession(request)
    const customerId = customer.id
    
    console.log(`📦 Downloading prebuilt ZIP for customer: ${customer.email}`)

    // Kontrollera att customerId matchar (extra säkerhet)
    const searchParams = request.nextUrl.searchParams
    const requestedCustomerId = searchParams.get('customerId')
    
    if (requestedCustomerId && requestedCustomerId !== customerId) {
      console.warn('⚠️ Customer ID mismatch in request')
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const zipPath = `prebuilt-zips/${customerId}/complete_archive.zip`
    const zipMetadataPath = `prebuilt-zips/${customerId}/metadata.json`

    try {
      // Kontrollera metadata först
      const metadataBuffer = await r2Service.getFile(zipMetadataPath)
      const metadata = JSON.parse(metadataBuffer.toString())
      
      // Kontrollera om ZIP har gått ut
      const expiresAt = new Date(metadata.expires_at)
      if (Date.now() > expiresAt.getTime()) {
        console.warn('⚠️ Prebuilt ZIP has expired')
        return NextResponse.json({ 
          error: 'ZIP file has expired',
          expired_at: metadata.expires_at 
        }, { status: 410 })
      }

      // Hämta ZIP-filen
      console.log(`📁 Fetching ZIP file: ${zipPath}`)
      const zipBuffer = await r2Service.getFile(zipPath)
      
      console.log(`✅ ZIP file found: ${zipBuffer.length} bytes`)

      // Skapa filnamn baserat på kundnamn
      const sanitizedCustomerName = customer.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'customer'
      const zipFileName = `${sanitizedCustomerName}_complete_archive.zip`

      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFileName}"`,
          'Content-Length': zipBuffer.length.toString(),
          'Cache-Control': 'private, no-cache',
          'X-File-Count': metadata.file_count.toString(),
          'X-Built-At': metadata.built_at,
        }
      })

    } catch (fileError) {
      if (fileError instanceof Error && fileError.message.includes('not found')) {
        console.warn('⚠️ Prebuilt ZIP not found')
        return NextResponse.json({ 
          error: 'No prebuilt ZIP available',
          message: 'A ZIP file is being prepared for you. Please try the regular download options.'
        }, { status: 404 })
      }
      
      throw fileError
    }

  } catch (error) {
    console.error('❌ Prebuilt ZIP download error:', error)
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    return NextResponse.json({
      error: 'Failed to download ZIP',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
