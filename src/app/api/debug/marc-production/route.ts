import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const MARC_EMAIL = 'marc.zorjan@gotevent.se'
    const MARC_ID = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'
    
    // 1. Find Marc by email
    const { data: marcByEmail, error: emailError } = await supabase
      .from('customers')
      .select('id, email, name, status')
      .eq('email', MARC_EMAIL)
      .single()
    
    // 2. Find Marc by ID
    const { data: marcById, error: idError } = await supabase
      .from('customers')
      .select('id, email, name, status')
      .eq('id', MARC_ID)
      .single()
    
    // 3. Count files by email-derived customer ID
    let filesByEmail = 0
    if (marcByEmail?.id) {
      const { count } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', marcByEmail.id)
        .eq('is_deleted', false)
      filesByEmail = count || 0
    }
    
    // 4. Count files by known ID
    const { count: filesByKnownId } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', MARC_ID)
      .eq('is_deleted', false)
    
    // 5. Sample files to see what's there
    const { data: sampleFiles } = await supabase
      .from('files')
      .select('id, original_name, customer_id, is_deleted, is_trashed')
      .eq('customer_id', MARC_ID)
      .limit(3)
    
    const result = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      marcByEmail: {
        found: !!marcByEmail,
        data: marcByEmail,
        error: emailError?.message
      },
      marcById: {
        found: !!marcById,
        data: marcById,
        error: idError?.message
      },
      fileCounts: {
        byEmailDerivedId: filesByEmail,
        byKnownId: filesByKnownId || 0
      },
      sampleFiles,
      diagnosis: {
        customerIdMismatch: marcByEmail?.id !== MARC_ID,
        expectedId: MARC_ID,
        actualId: marcByEmail?.id,
        filesExist: (filesByKnownId || 0) > 0
      }
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
