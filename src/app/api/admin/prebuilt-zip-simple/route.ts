import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'

// SIMPLIFIED VERSION - utan archiver för att testa
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 === PREBUILT ZIP SIMPLE VERSION ===')
    
    // Auth check
    const adminPassword = request.headers.get('x-admin-password')
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId, forceRebuild = false } = await request.json()
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    console.log(`📦 Simulating ZIP build for customer: ${customerId}`)

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

    // Hämta alla filer för kunden
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, filename, original_name, file_type, file_size, folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .order('folder_path', { ascending: true })
      .order('original_name', { ascending: true })

    if (filesError || !files || files.length === 0) {
      console.log(`❌ No files found for customer ${customerId}`)
      return NextResponse.json({ 
        error: 'No files found for customer',
        customer: customer.name 
      }, { status: 404 })
    }

    console.log(`📁 Found ${files.length} files for ${customer.name}`)

    // Simulera ZIP-skapning utan att faktiskt skapa ZIP
    const totalSize = files.reduce((sum, file) => sum + (file.file_size || 0), 0)
    const estimatedZipSize = Math.floor(totalSize * 0.7) // Uppskattat 30% komprimering

    const zipPath = `prebuilt-zips/${customerId}/complete_archive.zip`
    const zipMetadataPath = `prebuilt-zips/${customerId}/metadata.json`

    // Skapa metadata utan att skapa ZIP
    const metadata = {
      customer_id: customerId,
      customer_name: customer.name,
      customer_email: customer.email,
      file_count: files.length,
      total_files_size: totalSize,
      zip_size: estimatedZipSize,
      built_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dagar
      simulated: true // Flagga för att visa att detta är simulerat
    }

    // Ladda upp endast metadata (inte ZIP)
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
        zip_size: estimatedZipSize,
        built_at: new Date().toISOString(),
        expires_at: metadata.expires_at
      })

    if (dbError) {
      console.warn('⚠️ Failed to save ZIP reference to database:', dbError)
    }

    console.log(`🎉 Successfully simulated ZIP for ${customer.name}: ${files.length} files, estimated ${(estimatedZipSize / 1024 / 1024).toFixed(2)} MB`)

    return NextResponse.json({
      success: true,
      action: 'simulated_build',
      customer: customer.name,
      zipPath,
      fileCount: files.length,
      totalSize,
      estimatedZipSize,
      builtAt: metadata.built_at,
      expiresAt: metadata.expires_at,
      note: 'This is a simulation without actual ZIP creation'
    })

  } catch (error) {
    console.error('❌ Prebuilt ZIP simple error:', error)
    return NextResponse.json({
      error: 'Failed to simulate ZIP build',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
