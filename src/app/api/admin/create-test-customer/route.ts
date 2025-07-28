import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

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
    // Skapa testkund
    const testEmail = 'test@example.com'
    const testPassword = 'test123'
    const passwordHash = await bcrypt.hash(testPassword, 10)
    
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .upsert({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: testEmail,
        name: 'Test Kund',
        project: 'Test Projekt',
        password_hash: passwordHash,
        status: 'active',
        access_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dagar framåt
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating test customer:', error)
      return NextResponse.json({ error: 'Failed to create test customer' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Test customer created successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        project: customer.project
      },
      credentials: {
        email: testEmail,
        password: testPassword
      }
    })

  } catch (error: any) {
    console.error('Create test customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
