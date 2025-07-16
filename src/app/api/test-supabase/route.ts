import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('Testing Supabase connection...')
    console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET')
    console.log('SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        supabaseUrl: !!supabaseUrl,
        serviceKey: !!supabaseServiceKey
      }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Test simple query
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .limit(1)

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({
        error: 'Supabase query failed',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      customerCount: data?.length || 0,
      sampleCustomer: data?.[0] || null,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Test error:', error)
    return NextResponse.json({
      error: 'Exception occurred',
      message: error.message
    }, { status: 500 })
  }
}
