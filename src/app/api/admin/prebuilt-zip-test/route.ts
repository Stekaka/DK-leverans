import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// MINIMAL TEST VERSION - utan archiver
export async function GET(request: NextRequest) {
  const customerId = request.nextUrl.searchParams.get('customerId') || 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'
  return await testPrebuiltZip(customerId)
}

export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json()
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }
    return await testPrebuiltZip(customerId)
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}

async function testPrebuiltZip(customerId: string) {
  try {
    console.log('🧪 === PREBUILT ZIP TEST ===')
    console.log(`🔍 Testing for customer: ${customerId}`)

    // Test 1: Environment variables
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    const hasR2Config = !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID

    console.log('🔧 Environment check:', { hasSupabaseUrl, hasServiceKey, hasR2Config })

    // Test 2: Supabase connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('📡 Attempting Supabase connection...')

    // Test 3: Customer lookup
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', customerId)
      .single()

    if (customerError) {
      console.error('❌ Customer error:', customerError)
      return NextResponse.json({ 
        error: 'Customer lookup failed',
        details: customerError.message,
        supabaseStatus: 'error'
      }, { status: 500 })
    }

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    console.log('✅ Customer found:', customer.name)

    // Test 4: Files lookup
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_size')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .limit(5) // Bara första 5 filerna för test

    if (filesError) {
      console.error('❌ Files error:', filesError)
      return NextResponse.json({
        error: 'Files lookup failed',
        details: filesError.message,
        customer: customer.name
      }, { status: 500 })
    }

    console.log(`📁 Found ${files?.length || 0} files (showing first 5)`)

    // Test 5: Prebuilt zips table check
    const { data: zipData, error: zipError } = await supabase
      .from('prebuilt_zips')
      .select('*')
      .eq('customer_id', customerId)
      .limit(1)

    console.log('🗄️ Prebuilt zips table check:', { 
      hasError: !!zipError, 
      errorMessage: zipError?.message,
      hasData: !!zipData 
    })

    return NextResponse.json({
      success: true,
      test: 'complete',
      customer: customer.name,
      fileCount: files?.length || 0,
      environment: { hasSupabaseUrl, hasServiceKey, hasR2Config },
      prebuiltZipsTable: {
        accessible: !zipError,
        error: zipError?.message || null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Test error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
