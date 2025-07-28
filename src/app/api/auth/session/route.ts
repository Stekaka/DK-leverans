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

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('customer_session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Ingen session hittades' }, { status: 401 })
    }

    // Dekoda session token
    let customerId: string
    try {
      const decoded = Buffer.from(sessionToken, 'base64').toString()
      const parts = decoded.split(':')
      customerId = parts[0]
      
      // Kolla om det är en quick-access token med expiration
      if (parts.length >= 3 && parts[1] === 'quick') {
        const expiresAt = parseInt(parts[2])
        if (Date.now() > expiresAt) {
          return NextResponse.json({ error: 'Quick access token har upphört' }, { status: 401 })
        }
      }
    } catch {
      return NextResponse.json({ error: 'Ogiltig session' }, { status: 401 })
    }

    // Verifiera att kunden finns och är aktiv
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('id, name, email, project, status')
      .eq('id', customerId)
      .eq('status', 'active')
      .single()

    if (error || !customer) {
      // För test-customers, skapa mock data
      if (customerId === 'test-marc-zorjan') {
        const testCustomer = {
          id: 'test-marc-zorjan',
          name: 'Marc Zorjan',
          email: 'marc.zorjan@gotevent.se',
          project: 'Götevent projekt'
        }
        return NextResponse.json({ customer: testCustomer })
      }
      return NextResponse.json({ error: 'Session har upphört' }, { status: 401 })
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        project: customer.project
      }
    })

  } catch (error) {
    console.error('Session verification error:', error)
    return NextResponse.json({ error: 'Session verification misslyckades' }, { status: 500 })
  }
}

// Logout
export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Ta bort session cookie
  response.cookies.set('customer_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })

  return response
}
