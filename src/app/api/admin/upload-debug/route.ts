import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== UPLOAD DEBUG TEST ===')
    
    // Test 1: Kolla environment variables
    const envCheck = {
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      adminPasswordLength: process.env.ADMIN_PASSWORD?.length || 0,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasR2AccountId: !!process.env.CLOUDFLARE_R2_ACCOUNT_ID,
      hasR2BucketName: !!process.env.CLOUDFLARE_R2_BUCKET_NAME
    }

    console.log('🔍 Environment check:', envCheck)

    // Test 2: Testa direkt databasanslutning
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Test 3: Hämta kunder
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .limit(3)

    console.log('👥 Customers test:', { 
      success: !customerError, 
      error: customerError,
      customerCount: customers?.length || 0 
    })

    if (customerError || !customers || customers.length === 0) {
      return NextResponse.json({
        error: 'Database connection failed',
        envCheck,
        customerError
      })
    }

    // Test 4: Kolla files tabellstruktur
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', { 
        sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'files' ORDER BY ordinal_position` 
      })

    console.log('📋 Files table structure:', { columns, columnsError })

    // Test 5: Försök skapa en testfil
    const testCustomer = customers[0]
    const testFile = {
      customer_id: testCustomer.id,
      filename: `test_${Date.now()}_debug.jpg`,
      original_name: 'debug-test.jpg',
      file_size: 1024,
      file_type: 'image/jpeg',
      cloudflare_url: `https://example.com/test.jpg`,
      folder_path: 'debug-test',
      uploaded_at: new Date().toISOString()
    }

    console.log('🧪 Attempting to insert test file:', testFile)

    const { data: insertResult, error: insertError } = await supabase
      .from('files')
      .insert([testFile])
      .select()

    console.log('💾 Insert result:', { 
      success: !insertError, 
      error: insertError,
      insertedCount: insertResult?.length || 0 
    })

    return NextResponse.json({
      success: true,
      envCheck,
      customerCount: customers.length,
      testCustomer: { id: testCustomer.id, name: testCustomer.name },
      columnsAvailable: columns?.length || 0,
      insertTest: {
        success: !insertError,
        error: insertError,
        insertedCount: insertResult?.length || 0
      }
    })

  } catch (error) {
    console.error('❌ Debug test failed:', error)
    return NextResponse.json({ 
      error: 'Debug test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
