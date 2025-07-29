import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const MARC_CUSTOMER_ID = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'
    
    console.log('🚨 EMERGENCY RESTORE: Starting full restore for Marc Zorjan')
    
    // 1. Aktivera kunden
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .update({ status: 'active' })
      .eq('id', MARC_CUSTOMER_ID)
    
    if (customerError) {
      throw new Error(`Customer update failed: ${customerError.message}`)
    }
    
    // 2. Aktivera alla filer
    const { error: filesError } = await supabaseAdmin
      .from('files')
      .update({ 
        is_deleted: false, 
        is_trashed: false 
      })
      .eq('customer_id', MARC_CUSTOMER_ID)
    
    if (filesError) {
      throw new Error(`Files update failed: ${filesError.message}`)
    }
    
    // 3. Kontrollera resultat - kund
    const { data: customer, error: customerCheckError } = await supabaseAdmin
      .from('customers')
      .select('id, email, name, status, created_at')
      .eq('id', MARC_CUSTOMER_ID)
      .single()
    
    if (customerCheckError) {
      throw new Error(`Customer check failed: ${customerCheckError.message}`)
    }
    
    // 4. Kontrollera resultat - filer
    const { data: fileStats, error: statsError } = await supabaseAdmin
      .from('files')
      .select('id, is_deleted, is_trashed, file_size')
      .eq('customer_id', MARC_CUSTOMER_ID)
    
    if (statsError) {
      throw new Error(`File stats failed: ${statsError.message}`)
    }
    
    const totalFiles = fileStats?.length || 0
    const activeFiles = fileStats?.filter(f => !f.is_deleted).length || 0
    const notTrashedFiles = fileStats?.filter(f => !f.is_trashed).length || 0
    const totalSize = fileStats?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0
    
    // 5. Hämta exempel-filer
    const { data: sampleFiles, error: sampleError } = await supabaseAdmin
      .from('files')
      .select('id, original_name, file_size, is_deleted, is_trashed, uploaded_at')
      .eq('customer_id', MARC_CUSTOMER_ID)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false })
      .limit(5)
    
    if (sampleError) {
      throw new Error(`Sample files failed: ${sampleError.message}`)
    }
    
    const result = {
      success: true,
      customer,
      fileStats: {
        totalFiles,
        activeFiles,
        notTrashedFiles,
        totalSizeBytes: totalSize,
        totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2)
      },
      sampleFiles
    }
    
    console.log('✅ EMERGENCY RESTORE: Completed successfully', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('💥 EMERGENCY RESTORE: Failed', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}
