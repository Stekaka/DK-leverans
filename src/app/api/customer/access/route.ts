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

    // Kontrollera access med enkel SQL-query istället för funktion
    console.log('Checking access for customer:', customer.id)
    
    // Först kolla permanent access
    const { data: permanentAccess, error: permanentError } = await supabaseAdmin
      .from('permanent_access_purchases')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('expires_at', { ascending: false, nullsFirst: true })
      .limit(1)
      .single()

    if (!permanentError && permanentAccess) {
      console.log('Customer has permanent access')
      const daysRemaining = permanentAccess.expires_at 
        ? Math.ceil((new Date(permanentAccess.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 999999

      return NextResponse.json({
        customer: {
          id: customer.id,
          name: customer.name,
          project: customer.project,
          email: customer.email
        },
        access: {
          hasAccess: true,
          accessType: 'permanent',
          expiresAt: permanentAccess.expires_at,
          daysRemaining: daysRemaining,
          storageUsedGb: customer.total_storage_used ? (customer.total_storage_used / 1024 / 1024 / 1024) : 0,
          storageLimitGb: permanentAccess.storage_limit_gb || 500,
          isExpired: false,
          isPermanent: true
        }
      })
    }

    // Kolla vanlig access baserat på customer.access_expires_at
    const hasAccess = customer.access_expires_at ? new Date(customer.access_expires_at) > new Date() : true
    const daysRemaining = customer.access_expires_at 
      ? Math.ceil((new Date(customer.access_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 30

    console.log('Access check result:', { hasAccess, daysRemaining, expiresAt: customer.access_expires_at })

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        project: customer.project,
        email: customer.email
      },
      access: {
        hasAccess: hasAccess,
        accessType: hasAccess ? 'active' : 'expired',
        expiresAt: customer.access_expires_at,
        daysRemaining: Math.max(0, daysRemaining),
        storageUsedGb: customer.total_storage_used ? (customer.total_storage_used / 1024 / 1024 / 1024) : 0,
        storageLimitGb: 0,
        isExpired: !hasAccess,
        isPermanent: false
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
