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
    .select('*')
    .eq('id', customerId)
    .eq('status', 'active')
    .single()

  if (error || !customer) {
    throw new Error('Session har upphört')
  }

  return customer
}

export async function GET(request: NextRequest) {
  try {
    // Hämta customer ID från query parameter för admin-användning
    const { searchParams } = new URL(request.url)
    const customerIdParam = searchParams.get('customerId')
    
    // Alternativt: kolla Customer-Session header för admin-användning
    const customerSessionHeader = request.headers.get('Customer-Session')
    
    let customer
    
    if (customerIdParam || customerSessionHeader) {
      // Admin-användning: hämta specifik kund
      const targetCustomerId = customerIdParam || customerSessionHeader
      const { data: customerData, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', targetCustomerId)
        .single()
        
      if (error || !customerData) {
        console.error('Admin access check - customer not found:', targetCustomerId, error)
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
      customer = customerData
    } else {
      // Normal kundanvändning: verifiera session
      customer = await verifyCustomerSession(request)
    }

    // Kontrollera access med vår SQL-funktion
    console.log('Checking access for customer:', customer.id)
    const { data: accessCheck, error } = await supabaseAdmin
      .rpc('check_customer_access', { customer_uuid: customer.id })

    if (error) {
      console.error('Error checking customer access:', error)
      console.error('Customer ID:', customer.id)
      console.error('Function call failed:', error.message)
      return NextResponse.json({ error: 'Failed to check access', details: error.message }, { status: 500 })
    }

    if (!accessCheck || accessCheck.length === 0) {
      console.error('No access data returned for customer:', customer.id)
      return NextResponse.json({ error: 'No access data found' }, { status: 500 })
    }

    const accessInfo = accessCheck[0]
    console.log('Access check result:', accessInfo)

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        project: customer.project,
        email: customer.email
      },
      access: {
        hasAccess: accessInfo.has_access,
        accessType: accessInfo.access_type,
        expiresAt: accessInfo.expires_at,
        daysRemaining: accessInfo.days_remaining,
        storageUsedGb: accessInfo.storage_used_gb,
        storageLimitGb: accessInfo.storage_limit_gb,
        isExpired: !accessInfo.has_access && accessInfo.access_type === 'expired',
        isPermanent: accessInfo.access_type === 'permanent'
      }
    })

  } catch (error: any) {
    console.error('Customer Access API Error:', error)
    if (error.message.includes('session') || error.message.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
