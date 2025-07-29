import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Batch-byggare för förbyggda ZIP:ar för alla/valda kunder
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 === BATCH PREBUILT ZIP GENERATOR ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    const validPasswords = [
      'DronarkompanietAdmin2025!',
      'DrönarkompanietAdmin2025!',
      process.env.ADMIN_PASSWORD,
      'admin123'
    ].filter(p => p)
    
    if (!adminPassword || !validPasswords.includes(adminPassword)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerIds, forceRebuild = true, maxConcurrent = 2 } = await request.json()

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

    let customersToProcess: any[] = []

    if (customerIds && Array.isArray(customerIds)) {
      // Specifika kunder
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, email')
        .in('id', customerIds)
      
      if (error) throw error
      customersToProcess = customers || []
    } else {
      // Alla kunder med filer
      const { data: customers, error } = await supabase
        .from('customers')
        .select(`
          id, name, email,
          files!inner(id)
        `)
        .eq('files.is_deleted', false)
        .eq('files.is_trashed', false)
      
      if (error) throw error
      customersToProcess = customers || []
    }

    console.log(`📦 Processing ${customersToProcess.length} customers`)

    const results = {
      total: customersToProcess.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      details: [] as any[]
    }

    // Bearbeta kunder i batchar för att inte överbelasta systemet
    for (let i = 0; i < customersToProcess.length; i += maxConcurrent) {
      const batch = customersToProcess.slice(i, i + maxConcurrent)
      
      console.log(`📦 Processing batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.length} customers`)

      const batchPromises = batch.map(async (customer) => {
        try {
          console.log(`🔄 Building ZIP for ${customer.name} (${customer.email})`)
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/prebuilt-zip`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-password': adminPassword
            },
            body: JSON.stringify({
              customerId: customer.id,
              forceRebuild
            })
          })

          if (response.ok) {
            const result = await response.json()
            console.log(`✅ Success for ${customer.name}: ${result.fileCount} files, ${(result.zipSize / 1024 / 1024).toFixed(1)} MB`)
            
            results.successful++
            results.details.push({
              customer: customer.name,
              email: customer.email,
              success: true,
              fileCount: result.fileCount,
              zipSize: result.zipSize,
              action: result.action
            })
          } else {
            const errorText = await response.text()
            console.error(`❌ Failed for ${customer.name}: ${response.status} - ${errorText}`)
            
            results.failed++
            results.errors.push(`${customer.name}: ${errorText}`)
            results.details.push({
              customer: customer.name,
              email: customer.email,
              success: false,
              error: errorText
            })
          }
        } catch (error) {
          console.error(`❌ Error processing ${customer.name}:`, error)
          
          results.failed++
          results.errors.push(`${customer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          results.details.push({
            customer: customer.name,
            email: customer.email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
        
        results.processed++
      })

      // Vänta på att batchen ska bli klar
      await Promise.all(batchPromises)
      
      // Kort paus mellan batchar
      if (i + maxConcurrent < customersToProcess.length) {
        console.log('⏱️ Pausing between batches...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`🎉 Batch processing complete: ${results.successful}/${results.total} successful`)

    return NextResponse.json({
      success: true,
      results,
      summary: `Processed ${results.total} customers: ${results.successful} successful, ${results.failed} failed`
    })

  } catch (error) {
    console.error('❌ Batch ZIP generation error:', error)
    return NextResponse.json({
      error: 'Batch processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Status för batch-operation eller lista på kunder som behöver ZIP:ar
export async function GET(request: NextRequest) {
  try {
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

    // Hämta alla kunder och deras ZIP-status
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select(`
        id, name, email, created_at,
        files!inner(id),
        prebuilt_zips(built_at, expires_at, file_count, zip_size)
      `)
      .eq('files.is_deleted', false)
      .eq('files.is_trashed', false)

    if (customersError) throw customersError

    // Analysera varje kund
    const analysis = customers?.map(customer => {
      const zip = customer.prebuilt_zips?.[0]
      const hasZip = !!zip
      const isExpired = zip ? Date.now() > new Date(zip.expires_at).getTime() : false
      
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        hasFiles: customer.files.length > 0,
        hasZip,
        isExpired,
        needsZip: !hasZip || isExpired,
        zipInfo: zip ? {
          builtAt: zip.built_at,
          expiresAt: zip.expires_at,
          fileCount: zip.file_count,
          zipSize: zip.zip_size
        } : null
      }
    }) || []

    const summary = {
      totalCustomers: analysis.length,
      customersWithFiles: analysis.filter(c => c.hasFiles).length,
      customersWithZip: analysis.filter(c => c.hasZip).length,
      customersWithExpiredZip: analysis.filter(c => c.hasZip && c.isExpired).length,
      customersNeedingZip: analysis.filter(c => c.needsZip).length
    }

    return NextResponse.json({
      summary,
      customers: analysis
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get batch status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
