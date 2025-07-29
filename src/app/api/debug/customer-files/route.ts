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
    const MARC_CUSTOMER_ID = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'
    
    console.log('🔍 DEBUG: Checking Marc Zorjan customer and files...')
    
    // 1. Kontrollera customer
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, email, name, status, created_at')
      .eq('id', MARC_CUSTOMER_ID)
      .single()
    
    console.log('👤 Customer query result:', { customer, customerError })
    
    // 2. Kontrollera filer UTAN sessionvalidering
    const { data: files, error: filesError } = await supabaseAdmin
      .from('files')
      .select('id, original_name, file_size, is_deleted, is_trashed, uploaded_at')
      .eq('customer_id', MARC_CUSTOMER_ID)
      .eq('is_deleted', false)
      .limit(10)
    
    console.log('📁 Files query result:', { filesCount: files?.length, filesError })
    
    // 3. Testa customer files API logik
    let customerFilesApiResult = null
    if (customer?.status === 'active') {
      const { data: apiFiles, error: apiError } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('customer_id', MARC_CUSTOMER_ID)
        .eq('is_deleted', false)
      
      customerFilesApiResult = {
        filesCount: apiFiles?.length,
        error: apiError?.message
      }
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      customer: {
        found: !!customer,
        data: customer,
        error: customerError?.message
      },
      files: {
        directQuery: {
          count: files?.length || 0,
          error: filesError?.message,
          samples: files?.slice(0, 3)
        },
        customerApiLogic: customerFilesApiResult
      },
      diagnosis: {
        customerExists: !!customer,
        customerActive: customer?.status === 'active',
        filesExist: (files?.length || 0) > 0,
        potentialIssues: [] as string[]
      }
    }
    
    // Diagnos
    if (!customer) {
      result.diagnosis.potentialIssues.push('Customer not found in database')
    } else if (customer.status !== 'active') {
      result.diagnosis.potentialIssues.push(`Customer status is '${customer.status}', not 'active'`)
    }
    
    if (filesError) {
      result.diagnosis.potentialIssues.push(`Files query error: ${filesError.message}`)
    } else if ((files?.length || 0) === 0) {
      result.diagnosis.potentialIssues.push('No files found for customer')
    }
    
    console.log('📊 DEBUG RESULT:', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('💥 DEBUG ERROR:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}
