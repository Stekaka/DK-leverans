import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// PUT /api/customer/rating - Uppdatera filbetyg
export async function PUT(request: NextRequest) {
  try {
    const { fileId, rating, notes } = await request.json()

    // Validera input
    if (!fileId || !rating) {
      return NextResponse.json(
        { error: 'File ID och rating krävs' },
        { status: 400 }
      )
    }

    if (!['unrated', 'favorite', 'good', 'poor'].includes(rating)) {
      return NextResponse.json(
        { error: 'Ogiltigt betyg. Tillåtna värden: unrated, favorite, good, poor' },
        { status: 400 }
      )
    }

    // Verifiera session med samma metod som customer/files API
    const customer = await verifyCustomerSession(request)
    const customerId = customer.id

    // Verifiera att kunden äger filen
    const { data: file, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, customer_id')
      .eq('id', fileId)
      .eq('customer_id', customerId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'Fil inte hittad eller åtkomst nekad' },
        { status: 404 }
      )
    }

    // Uppdatera betyg
    const { error: updateError } = await supabaseAdmin
      .from('files')
      .update({
        customer_rating: rating,
        customer_notes: notes || null,
        rating_updated_at: new Date().toISOString()
      })
      .eq('id', fileId)

    if (updateError) {
      console.error('Database error updating rating:', updateError)
      return NextResponse.json(
        { error: 'Kunde inte uppdatera betyg' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Betyg uppdaterat'
    })

  } catch (error: any) {
    console.error('Rating API error:', error)
    
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
