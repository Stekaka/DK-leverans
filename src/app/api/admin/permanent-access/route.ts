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

// Aktivera permanent access för kund (efter betalning)
export async function POST(request: NextRequest) {
  try {
    await verifyAdminSession(request)

    const body = await request.json()
    const { 
      customerId, 
      paymentReference, 
      amountPaid = 1500, 
      storageLimitGb = 500,
      durationYears = 1 
    } = body

    if (!customerId || !paymentReference) {
      return NextResponse.json({ 
        error: 'Customer ID and payment reference required' 
      }, { status: 400 })
    }

    // Kontrollera att kunden finns
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Beräkna utgångsdatum (1 år framåt)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + durationYears)

    // Skapa permanent access purchase record
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('permanent_access_purchases')
      .insert({
        customer_id: customerId,
        amount_paid: amountPaid,
        storage_limit_gb: storageLimitGb,
        expires_at: expiresAt.toISOString(),
        payment_reference: paymentReference,
        status: 'active'
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('Error creating permanent access purchase:', purchaseError)
      return NextResponse.json({ 
        error: 'Failed to create permanent access' 
      }, { status: 500 })
    }

    // Uppdatera customer med permanent access
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        has_permanent_access: true,
        permanent_access_expires_at: expiresAt.toISOString(),
        access_status: 'permanent'
      })
      .eq('id', customerId)

    if (updateError) {
      console.error('Error updating customer with permanent access:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update customer access' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Permanent access activated',
      customer: {
        id: customerId,
        name: customer.name,
        email: customer.email
      },
      purchase: {
        id: purchase.id,
        amountPaid,
        storageLimitGb,
        expiresAt: expiresAt.toISOString(),
        paymentReference
      }
    })

  } catch (error: any) {
    console.error('Permanent Access API Error:', error)
    if (error.message.includes('admin')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Hämta permanent access-köp för en kund
export async function GET(request: NextRequest) {
  try {
    await verifyAdminSession(request)

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    // Hämta permanent access purchases
    const { data: purchases, error } = await supabaseAdmin
      .from('permanent_access_purchases')
      .select('*')
      .eq('customer_id', customerId)
      .order('purchase_date', { ascending: false })

    if (error) {
      console.error('Error fetching permanent access purchases:', error)
      return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 })
    }

    return NextResponse.json({
      customerId,
      purchases: purchases || []
    })

  } catch (error: any) {
    console.error('Get Permanent Access API Error:', error)
    if (error.message.includes('admin')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Förnya permanent access (årlig förnyelse)
export async function PUT(request: NextRequest) {
  try {
    await verifyAdminSession(request)

    const body = await request.json()
    const { purchaseId, durationYears = 1 } = body

    if (!purchaseId) {
      return NextResponse.json({ error: 'Purchase ID required' }, { status: 400 })
    }

    // Hämta befintligt köp
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('permanent_access_purchases')
      .select('*')
      .eq('id', purchaseId)
      .single()

    if (purchaseError || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // Beräkna nytt utgångsdatum
    const currentExpiry = new Date(purchase.expires_at)
    const newExpiry = new Date(currentExpiry)
    newExpiry.setFullYear(newExpiry.getFullYear() + durationYears)

    // Uppdatera purchase
    const { error: updatePurchaseError } = await supabaseAdmin
      .from('permanent_access_purchases')
      .update({
        expires_at: newExpiry.toISOString(),
        status: 'active'
      })
      .eq('id', purchaseId)

    if (updatePurchaseError) {
      console.error('Error renewing permanent access:', updatePurchaseError)
      return NextResponse.json({ 
        error: 'Failed to renew permanent access' 
      }, { status: 500 })
    }

    // Uppdatera customer
    const { error: updateCustomerError } = await supabaseAdmin
      .from('customers')
      .update({
        permanent_access_expires_at: newExpiry.toISOString(),
        access_status: 'permanent'
      })
      .eq('id', purchase.customer_id)

    if (updateCustomerError) {
      console.error('Error updating customer renewal:', updateCustomerError)
    }

    return NextResponse.json({
      success: true,
      message: `Permanent access renewed for ${durationYears} year(s)`,
      purchase: {
        id: purchaseId,
        previousExpiry: purchase.expires_at,
        newExpiry: newExpiry.toISOString(),
        durationYears
      }
    })

  } catch (error: any) {
    console.error('Renew Permanent Access API Error:', error)
    if (error.message.includes('admin')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
