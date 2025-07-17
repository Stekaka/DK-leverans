import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// Hjälpfunktion för att verifiera customer session
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

export async function POST(request: NextRequest) {
  try {
    // Verifiera customer session
    const customer = await verifyCustomerSession(request)

    const { fileId, action } = await request.json()

    if (!fileId || !action) {
      return NextResponse.json(
        { error: 'fileId och action krävs' },
        { status: 400 }
      )
    }

    if (!['trash', 'restore', 'delete_forever'].includes(action)) {
      return NextResponse.json(
        { error: 'Ogiltig action. Tillåtna: trash, restore, delete_forever' },
        { status: 400 }
      )
    }

    // Kontrollera att filen tillhör kunden
    const { data: file, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, original_name, is_trashed, is_deleted')
      .eq('id', fileId)
      .eq('customer_id', customer.id)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'Filen hittades inte' },
        { status: 404 }
      )
    }

    let updateData: any = {}
    let message = ''

    switch (action) {
      case 'trash':
        if (file.is_trashed) {
          return NextResponse.json(
            { error: 'Filen är redan i papperskorgen' },
            { status: 400 }
          )
        }
        updateData = { is_trashed: true }
        message = `Filen "${file.original_name}" flyttades till papperskorgen`
        break

      case 'restore':
        if (!file.is_trashed) {
          return NextResponse.json(
            { error: 'Filen är inte i papperskorgen' },
            { status: 400 }
          )
        }
        updateData = { is_trashed: false }
        message = `Filen "${file.original_name}" återställdes från papperskorgen`
        break

      case 'delete_forever':
        if (!file.is_trashed) {
          return NextResponse.json(
            { error: 'Filen måste först flyttas till papperskorgen' },
            { status: 400 }
          )
        }
        updateData = { is_deleted: true }
        message = `Filen "${file.original_name}" raderades permanent`
        break
    }

    // Uppdatera filen
    const { error: updateError } = await supabaseAdmin
      .from('files')
      .update(updateData)
      .eq('id', fileId)
      .eq('customer_id', customer.id)

    if (updateError) {
      console.error('Error updating file trash status:', updateError)
      return NextResponse.json(
        { error: 'Kunde inte uppdatera fil' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message,
      action,
      fileId
    })

  } catch (error: any) {
    console.error('Trash API Error:', error)
    if (error.message.includes('session') || error.message.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
