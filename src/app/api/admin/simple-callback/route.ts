import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

interface UploadCallbackRequest {
  customerId: string
  uploadedFiles: {
    fileKey: string
    originalName: string
    size: number
    type: string
    folderPath: string
  }[]
}

// Hjälpfunktion för att trigga ZIP-ombyggnad i bakgrunden
async function triggerPrebuiltZipUpdate(customerId: string, adminPassword: string) {
  try {
    console.log(`🔄 Triggering ZIP rebuild for customer: ${customerId}`)
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/prebuilt-zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword
      },
      body: JSON.stringify({
        customerId,
        forceRebuild: true
      })
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ ZIP rebuild triggered: ${result.fileCount} files`)
    } else {
      console.warn(`⚠️ ZIP rebuild failed: ${response.status}`)
    }
  } catch (error) {
    console.warn('⚠️ ZIP rebuild request failed:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 === SIMPLE UPLOAD CALLBACK ===')
    console.log('📅 Timestamp:', new Date().toISOString())
    
    // Enkel autentisering
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

    const body: UploadCallbackRequest = await request.json()
    const { customerId, uploadedFiles } = body

    console.log('📝 Processing:', uploadedFiles.length, 'files for customer:', customerId)

    // Enkel datastruktur som matchar grundläggande files-tabell
    const dbFiles = uploadedFiles.map(file => ({
      customer_id: customerId,
      filename: file.fileKey,
      original_name: file.originalName, // Lägg till original_name
      file_size: file.size,
      file_type: file.type,
      cloudflare_url: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${file.fileKey}`,
      uploaded_at: new Date().toISOString(),
      is_deleted: false
    }))

    console.log('💾 Inserting files:', dbFiles.length)

    // Försök infoga i databasen
    const { data: insertedFiles, error: insertError } = await supabase
      .from('files')
      .insert(dbFiles)
      .select()

    if (insertError) {
      console.error('❌ Insert error:', insertError)
      return NextResponse.json({ 
        error: 'Database insert failed',
        details: insertError.message,
        code: insertError.code
      }, { status: 500 })
    }

    console.log('✅ Successfully inserted:', insertedFiles?.length || 0, 'files')

    // 🎯 TRIGGER: Bygg förbestämd ZIP för kunden (async i bakgrunden)
    triggerPrebuiltZipUpdate(customerId, adminPassword).catch((zipError: any) => {
      console.warn('⚠️ Failed to trigger ZIP rebuild:', zipError)
      // Inte kritiskt - filerna är sparade
    })

    return NextResponse.json({
      success: true,
      registeredFiles: insertedFiles?.length || 0,
      message: 'Files registered successfully'
    })

  } catch (error) {
    console.error('❌ Callback error:', error)
    return NextResponse.json({ 
      error: 'Callback failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
