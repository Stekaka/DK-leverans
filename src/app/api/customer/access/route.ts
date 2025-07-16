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
    // Verifiera customer session
    const customer = await verifyCustomerSession(request)

    // Kontrollera access med vår SQL-funktion
    const { data: accessCheck, error } = await supabaseAdmin
      .rpc('check_customer_access', { customer_uuid: customer.id })

    if (error) {
      console.error('Error checking customer access:', error)
      return NextResponse.json({ error: 'Failed to check access' }, { status: 500 })
    }

    const accessInfo = accessCheck[0]

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
