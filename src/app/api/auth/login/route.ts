import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-post och lösenord krävs' }, { status: 400 })
    }

    console.log(`Login attempt for email: ${email}`)

    // Hitta kunden i databasen
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('id, name, email, project, status, password_hash')
      .eq('email', email.toLowerCase())
      .eq('status', 'active')
      .single()

    if (error || !customer) {
      console.log(`Customer not found or inactive for email: ${email}`)
      return NextResponse.json({ 
        error: 'Ogiltiga inloggningsuppgifter eller kontot är inaktivt' 
      }, { status: 401 })
    }

    // Kontrollera lösenord mot det sparade lösenordet
    // (I produktion: använd bcrypt för att jämföra hashade lösenord)
    if (!customer.password_hash || password !== customer.password_hash) {
      console.log(`Password mismatch for email: ${email}`)
      return NextResponse.json({ 
        error: 'Ogiltiga inloggningsuppgifter' 
      }, { status: 401 })
    }

    console.log(`Successful login for customer: ${customer.name} (${customer.email})`)

    // Skapa en enkel session token (i produktion: använd JWT)
    const sessionToken = Buffer.from(`${customer.id}:${Date.now()}`).toString('base64')

    // Uppdatera last_access
    await supabaseAdmin
      .from('customers')
      .update({ last_access: new Date().toISOString() })
      .eq('id', customer.id)

    // Sätt session cookie
    const response = NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        project: customer.project
      }
    })

    // HttpOnly cookie för säkerhet
    response.cookies.set('customer_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dagar
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Login API Error:', error)
    return NextResponse.json({ error: 'Inloggning misslyckades' }, { status: 500 })
  }
}
