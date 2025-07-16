import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('=== TEST UPLOAD CALLBACK ===')
    
    // Hämta första kunden för test
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .limit(1)

    if (customerError || !customers || customers.length === 0) {
      console.error('❌ No customers found:', customerError)
      return NextResponse.json({ error: 'No customers found' }, { status: 404 })
    }

    const testCustomer = customers[0]
    console.log('📋 Test customer:', testCustomer)

    // Testa upload-callback med dummy data
    const testUploadData = {
      customerId: testCustomer.id,
      uploadedFiles: [
        {
          fileKey: `customers/${testCustomer.id}/test_${Date.now()}_test.jpg`,
          originalName: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          folderPath: 'test-folder'
        }
      ]
    }

    console.log('🧪 Test upload data:', testUploadData)

    // Anropa upload-callback
    const callbackResponse = await fetch(`${request.nextUrl.origin}/api/admin/upload-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': 'DronarkompanietAdmin2025!'
      },
      body: JSON.stringify(testUploadData)
    })

    const callbackResult = await callbackResponse.json()
    
    console.log('📊 Callback response:', {
      status: callbackResponse.status,
      result: callbackResult
    })

    return NextResponse.json({
      success: true,
      testCustomer,
      callbackStatus: callbackResponse.status,
      callbackResult
    })

  } catch (error) {
    console.error('❌ Test error:', error)
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
