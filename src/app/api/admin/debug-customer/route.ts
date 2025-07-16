import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('=== DEBUG CUSTOMER CHECK ===')
    
    // Kontrollera admin-autentisering
    const adminPassword = request.headers.get('x-admin-password')
    console.log('🔐 Received admin password:', adminPassword ? `${adminPassword.substring(0, 15)}...` : 'NONE')
    console.log('🔐 Expected admin password:', process.env.ADMIN_PASSWORD ? `${process.env.ADMIN_PASSWORD.substring(0, 15)}...` : 'NONE')
    console.log('🔐 Password match:', adminPassword === process.env.ADMIN_PASSWORD)
    
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      console.log('❌ Unauthorized admin access attempt')
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: {
          hasPassword: !!adminPassword,
          hasEnvPassword: !!process.env.ADMIN_PASSWORD,
          match: adminPassword === process.env.ADMIN_PASSWORD
        }
      }, { status: 401 })
    }

    const body = await request.json()
    const { customerId } = body

    console.log(`👤 Looking for customer ID: ${customerId}`)

    // Lista alla kunder först
    const { data: allCustomers, error: allError } = await supabase
      .from('customers')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: false })

    console.log('📋 All customers in database:', allCustomers?.length || 0)
    if (allCustomers) {
      allCustomers.forEach((customer, index) => {
        console.log(`  ${index + 1}. ${customer.name} (${customer.id}) - ${customer.email}`)
      })
    }

    // Verifiera att kunden finns
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.log('❌ Customer not found:', customerError)
      return NextResponse.json({ 
        error: 'Customer not found',
        details: {
          requestedId: customerId,
          totalCustomers: allCustomers?.length || 0,
          availableIds: allCustomers?.map(c => c.id) || [],
          customerError: customerError?.message
        }
      }, { status: 404 })
    }

    console.log('✅ Customer found:', customer)
    return NextResponse.json({ 
      success: true,
      customer,
      allCustomers: allCustomers?.map(c => ({ id: c.id, name: c.name, email: c.email }))
    })

  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
