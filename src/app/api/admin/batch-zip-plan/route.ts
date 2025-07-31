import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// BATCH ZIP STRATEGY - Skapar flera små ZIP:ar istället för en stor
export async function POST(request: NextRequest) {
  try {
    console.log('📦 === BATCH ZIP STRATEGY ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId, batchSize = 50 } = await request.json()
    
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

    // Räkna totalt antal filer
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

    // Beräkna antal batches
    const numberOfBatches = Math.ceil(totalFiles / batchSize)
    
    console.log(`📊 Customer ${customer.name}: ${totalFiles} files, ${numberOfBatches} batches of ${batchSize}`)

    // Skapa batch info för varje grupp
    const batches = []
    for (let i = 0; i < numberOfBatches; i++) {
      const offset = i * batchSize
      batches.push({
        batch_number: i + 1,
        batch_id: `batch_${i + 1}_of_${numberOfBatches}`,
        offset: offset,
        limit: batchSize,
        estimated_files: Math.min(batchSize, totalFiles - offset),
        zip_path: `prebuilt-zips/${customerId}/batch_${i + 1}_of_${numberOfBatches}.zip`,
        status: 'pending'
      })
    }

    // Spara batch plan i databasen för tracking
    const batchPlan = {
      customer_id: customerId,
      customer_name: customer.name,
      total_files: totalFiles,
      number_of_batches: numberOfBatches,
      batch_size: batchSize,
      batches: batches,
      created_at: new Date().toISOString(),
      status: 'planned'
    }

    // Spara plan i databas (vi kan skapa en egen tabell för detta)
    const { error: planError } = await supabase
      .from('prebuilt_zips')
      .upsert({
        customer_id: customerId,
        zip_path: `batch-plan/${customerId}/plan.json`,
        metadata_path: `batch-plan/${customerId}/plan.json`,
        file_count: totalFiles,
        zip_size: 0, // Kommer att uppdateras när batches är klara
        built_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })

    if (planError) {
      console.warn('⚠️ Could not save batch plan:', planError)
    }

    return NextResponse.json({
      success: true,
      strategy: 'batch_plan_created',
      customer: customer.name,
      totalFiles,
      numberOfBatches,
      batchSize,
      batches,
      recommendation: {
        message: `Instead of one huge ZIP (54.3GB), create ${numberOfBatches} smaller ZIPs`,
        next_steps: [
          `Call /api/admin/batch-zip-create with batch numbers to create individual ZIPs`,
          `Each batch will be ~${Math.round(totalFiles / numberOfBatches)} files`,
          `Customer can download each batch separately or use our combine tool`
        ]
      }
    })

  } catch (error) {
    console.error('❌ Batch plan error:', error)
    return NextResponse.json({
      error: 'Failed to create batch plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
