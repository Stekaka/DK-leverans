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

export async function POST(request: NextRequest) {
  try {
    const { customer_id } = await request.json()

    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    }

    console.log(`[EMERGENCY-RESTORE] Attempting to restore deleted files for customer ${customer_id}`)

    // Återställ alla raderade filer för denna kund
    const { data: restoredFiles, error: restoreError } = await supabaseAdmin
      .from('files')
      .update({ is_deleted: false })
      .eq('customer_id', customer_id)
      .eq('is_deleted', true)
      .select('id, original_name')

    if (restoreError) {
      return NextResponse.json({ 
        error: 'Restore failed', 
        details: restoreError 
      }, { status: 500 })
    }

    const restoredCount = restoredFiles?.length || 0
    console.log(`[EMERGENCY-RESTORE] Successfully restored ${restoredCount} files`)

    return NextResponse.json({
      success: true,
      customer_id,
      restored_files: restoredCount,
      files: restoredFiles?.map(f => f.original_name) || [],
      message: `EMERGENCY RESTORE: Successfully restored ${restoredCount} files for customer`
    })

  } catch (error) {
    console.error('[EMERGENCY-RESTORE] Error:', error)
    return NextResponse.json({
      error: 'Emergency restore failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
