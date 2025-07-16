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

// Verifiera admin-session
async function verifyAdminSession(request: NextRequest) {
  const sessionToken = request.cookies.get('admin_session')?.value
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!sessionToken || !adminPassword) {
    throw new Error('Ingen giltig admin-session')
  }

  const decoded = Buffer.from(sessionToken, 'base64').toString()
  if (decoded !== adminPassword) {
    throw new Error('Ogiltig admin-session')
  }
}

// Förläng kundaccess (7, 14 eller 30 dagar)
export async function POST(request: NextRequest) {
  try {
    await verifyAdminSession(request)

    const body = await request.json()
    const { customerId, extensionDays, reason } = body

    if (!customerId || !extensionDays) {
      return NextResponse.json({ error: 'Customer ID and extension days required' }, { status: 400 })
    }

    if (![7, 14, 30].includes(extensionDays)) {
      return NextResponse.json({ error: 'Extension must be 7, 14 or 30 days' }, { status: 400 })
    }

    // Hämta nuvarande kunddata
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Beräkna ny utgångsdatum
    const currentExpiry = customer.access_expires_at ? new Date(customer.access_expires_at) : new Date()
    const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + (extensionDays * 24 * 60 * 60 * 1000))

    // Uppdatera customer
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        access_expires_at: newExpiry.toISOString(),
        access_status: 'active'
      })
      .eq('id', customerId)

    if (updateError) {
      console.error('Error updating customer access:', updateError)
      return NextResponse.json({ error: 'Failed to extend access' }, { status: 500 })
    }

    // Logga förlängningen
    const { error: logError } = await supabaseAdmin
      .from('access_extensions')
      .insert({
        customer_id: customerId,
        extended_by_admin: 'admin', // Kan utökas med specifik admin-identitet
        extension_days: extensionDays,
        previous_expiry: customer.access_expires_at,
        new_expiry: newExpiry.toISOString(),
        reason: reason || 'Admin extension'
      })

    if (logError) {
      console.error('Error logging extension:', logError)
      // Fortsätt även om loggning misslyckas
    }

    return NextResponse.json({
      success: true,
      message: `Access extended by ${extensionDays} days`,
      customer: {
        id: customerId,
        name: customer.name,
        previousExpiry: customer.access_expires_at,
        newExpiry: newExpiry.toISOString(),
        extensionDays
      }
    })

  } catch (error: any) {
    console.error('Extend Access API Error:', error)
    if (error.message.includes('admin')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Hämta förlängningshistorik för en kund
export async function GET(request: NextRequest) {
  try {
    await verifyAdminSession(request)

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    // Hämta förlängningshistorik
    const { data: extensions, error } = await supabaseAdmin
      .from('access_extensions')
      .select('*')
      .eq('customer_id', customerId)
      .order('extended_at', { ascending: false })

    if (error) {
      console.error('Error fetching extensions:', error)
      return NextResponse.json({ error: 'Failed to fetch extensions' }, { status: 500 })
    }

    return NextResponse.json({
      customerId,
      extensions: extensions || []
    })

  } catch (error: any) {
    console.error('Get Extensions API Error:', error)
    if (error.message.includes('admin')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
