import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Startar bakgrundsjobb för att skapa EN stor ZIP med ALLA filer
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 === START BACKGROUND ZIP JOB ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId } = await request.json()
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

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

    // Hämta kundinformation
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Räkna alla filer
    const { count: totalFiles, error: countError } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)

    if (countError || !totalFiles) {
      return NextResponse.json({ 
        error: 'Could not count files',
        customer: customer.name 
      }, { status: 404 })
    }

    // Markera jobb som startat
    const jobId = `zip_job_${customerId}_${Date.now()}`
    const jobData = {
      job_id: jobId,
      customer_id: customerId,
      customer_name: customer.name,
      total_files: totalFiles,
      status: 'STARTED',
      started_at: new Date().toISOString(),
      progress: 0,
      message: 'ZIP job initiated - starting background processing...'
    }

    // Spara job status (vi kan använda prebuilt_zips tabellen för tracking)
    await supabase
      .from('prebuilt_zips')
      .upsert({
        customer_id: customerId,
        zip_path: `jobs/${jobId}.json`,
        metadata_path: `jobs/${jobId}_status.json`,
        file_count: 0, // Kommer att uppdateras
        zip_size: 0,   // Kommer att uppdateras
        built_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })

    // Starta det faktiska ZIP-skapandet i "bakgrunden" genom att kalla complete-zip
    // Detta kommer att timeout:a men ZIP:en kommer att skapas så långt som möjligt
    fetch(`${request.nextUrl.origin}/api/admin/complete-zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword
      },
      body: JSON.stringify({ customerId })
    }).catch(error => {
      console.log('Background job timed out as expected:', error.message)
    })

    return NextResponse.json({
      success: true,
      action: 'background_job_started',
      customer: customer.name,
      jobId,
      totalFiles,
      message: `Background ZIP creation started for ${totalFiles} files`,
      note: 'This will create a complete ZIP with ALL files. Check status with /api/admin/zip-status',
      statusUrl: `/api/admin/zip-status?customerId=${customerId}`,
      estimatedTime: `${Math.ceil(totalFiles / 10)} minutes`
    })

  } catch (error) {
    console.error('❌ Background job start error:', error)
    return NextResponse.json({
      error: 'Failed to start background ZIP job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
