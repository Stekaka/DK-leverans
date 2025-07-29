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
    console.log(`[EMERGENCY-RESTORE] CRITICAL: Restoring all files for marc.zorjan customer`)

    // Hardcoded för säkerhets skull - marc.zorjan customer ID
    const customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'

    // Återställ ALLA filer för denna kund - DIRECT SQL
    const { data: directUpdate, error: directError } = await supabaseAdmin
      .from('files')
      .update({ is_deleted: false })
      .eq('customer_id', customer_id)
      .eq('is_deleted', true)
      .select('id, original_name')

    if (directError) {
      return NextResponse.json({ 
        error: 'Direct update failed', 
        details: directError
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      method: 'direct_update',
      customer_id,
      restored_files: directUpdate || [],
      restored_count: directUpdate?.length || 0,
      message: `EMERGENCY: Restored ${directUpdate?.length || 0} files for marc.zorjan customer`
    })

  } catch (error) {
    console.error('[EMERGENCY-RESTORE] CRITICAL ERROR:', error)
    return NextResponse.json({
      error: 'CRITICAL: Emergency restore failed completely',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// GET endpoint för att kontrollera status
export async function GET() {
  try {
    const customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'

    const { data: status, error } = await supabaseAdmin
      .from('files')
      .select('is_deleted, original_name')
      .eq('customer_id', customer_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = status?.length || 0
    const active = status?.filter(f => !f.is_deleted).length || 0
    const deleted = status?.filter(f => f.is_deleted).length || 0

    return NextResponse.json({
      customer_id,
      total_files: total,
      active_files: active,
      deleted_files: deleted,
      status: deleted === 0 ? 'RESTORED' : 'NEEDS_RESTORE',
      sample_files: status?.slice(0, 5).map(f => ({
        name: f.original_name,
        deleted: f.is_deleted
      })) || []
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Status check failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
