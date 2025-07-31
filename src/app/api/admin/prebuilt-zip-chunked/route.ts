import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'

// CHUNKED VERSION - för stora dataset som Marc's 54.3GB
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 === PREBUILT ZIP CHUNKED VERSION ===')
    
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

    const { customerId, forceRebuild = false } = await request.json()
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    console.log(`📦 Processing chunked ZIP for customer: ${customerId}`)

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

    // Kontrollera storleken först
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_type, file_size, folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .order('folder_path', { ascending: true })
      .order('original_name', { ascending: true })

    if (filesError || !files || files.length === 0) {
      return NextResponse.json({ 
        error: 'No files found for customer',
        customer: customer.name 
      }, { status: 404 })
    }

    const totalSize = files.reduce((sum, file) => sum + (file.file_size || 0), 0)
    const totalSizeGB = totalSize / (1024 * 1024 * 1024)

    console.log(`📊 Dataset analysis: ${files.length} files, ${totalSizeGB.toFixed(2)} GB total`)

    // För stora dataset (>10GB) - använd simplified approach
    if (totalSizeGB > 10) {
      console.log('🔄 Large dataset detected - using reference-only approach')
      
      const zipPath = `prebuilt-zips/${customerId}/complete_archive.zip`
      const zipMetadataPath = `prebuilt-zips/${customerId}/metadata.json`

      // Skapa metadata med file listing
      const metadata = {
        customer_id: customerId,
        customer_name: customer.name,
        customer_email: customer.email,
        file_count: files.length,
        total_files_size: totalSize,
        size_gb: totalSizeGB,
        built_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        approach: 'large_dataset_reference',
        files: files.map(f => ({
          name: f.original_name,
          size: f.file_size,
          folder: f.folder_path,
          r2_path: f.filename
        })),
        note: 'För stora dataset använd progressive download istället för ZIP'
      }

      // Ladda upp metadata
      await r2Service.uploadFile(
        Buffer.from(JSON.stringify(metadata, null, 2)),
        zipMetadataPath,
        'application/json',
        customerId
      )

      // Spara referens i databasen
      const { error: dbError } = await supabase
        .from('prebuilt_zips')
        .upsert({
          customer_id: customerId,
          zip_path: zipPath,
          metadata_path: zipMetadataPath,
          file_count: files.length,
          zip_size: 0, // Ingen faktisk ZIP för stora dataset
          built_at: new Date().toISOString(),
          expires_at: metadata.expires_at
        })

      if (dbError) {
        console.warn('⚠️ Database save warning:', dbError)
      }

      return NextResponse.json({
        success: true,
        action: 'large_dataset_reference',
        customer: customer.name,
        fileCount: files.length,
        totalSizeGB: totalSizeGB,
        recommendation: 'Use progressive download for datasets over 10GB',
        metadata: {
          path: zipMetadataPath,
          approach: 'reference_only'
        },
        builtAt: metadata.built_at,
        note: 'Prebuilt ZIP not practical for 50GB+ datasets - use progressive download instead'
      })
    }

    // För mindre dataset (<10GB) - försök skapa ZIP
    return NextResponse.json({
      success: false,
      error: 'Small dataset ZIP creation not implemented in chunked version',
      recommendation: 'Use regular prebuilt-zip endpoint for datasets under 10GB'
    }, { status: 501 })

  } catch (error) {
    console.error('❌ Chunked ZIP error:', error)
    return NextResponse.json({
      error: 'Failed to process chunked ZIP',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
