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

export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json()

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    // Hämta kund information
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Skapa en enkel session-token för quick access (giltig i 24h)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)
    
    const quickToken = Buffer.from(`${customerId}:quick:${expiresAt.getTime()}`).toString('base64')

    // Sätt cookie för quick access
    const response = NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        project: customer.project,
        email: customer.email
      },
      expiresAt: expiresAt.toISOString()
    })

    response.cookies.set('customer_session', quickToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 timmar
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Quick access error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
