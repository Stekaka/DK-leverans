import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'
import { generateThumbnail } from '../../../../../lib/thumbnail-generator'

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

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD CALLBACK ===')
    
    // Kontrollera admin-autentisering
    const adminPassword = request.headers.get('x-admin-password')
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      console.log('❌ Unauthorized callback access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UploadCallbackRequest = await request.json()
    const { customerId, uploadedFiles } = body

    console.log(`📝 Processing upload callback for ${uploadedFiles.length} files`)
    console.log(`👤 Customer ID: ${customerId}`)

    // Verifiera att kunden finns
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.log('❌ Customer not found:', customerError)
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Registrera alla filer i databasen
    const dbFiles = []
    
    for (const file of uploadedFiles) {
      // Generera thumbnail för bilder (TODO: Implementera för direktuppladdade filer)
      let thumbnailUrl = null
      if (file.type.startsWith('image/')) {
        try {
          // TODO: Hämta fil från R2 och generera thumbnail
          // För nu hoppar vi över thumbnail-generering för direktuppladdade filer
          console.log(`📷 Thumbnail generation for direct uploads not yet implemented: ${file.originalName}`)
        } catch (thumbError) {
          console.warn(`⚠️ Failed to generate thumbnail for ${file.originalName}:`, thumbError)
        }
      }

      dbFiles.push({
        customer_id: customerId,
        filename: file.originalName,
        file_path: file.fileKey,
        file_size: file.size,
        file_type: file.type,
        folder_path: file.folderPath || '',
        thumbnail_url: thumbnailUrl,
        uploaded_at: new Date().toISOString()
      })
    }

    // Bulk insert till databasen
    const { data: insertedFiles, error: insertError } = await supabase
      .from('files')
      .insert(dbFiles)
      .select()

    if (insertError) {
      console.error('❌ Database insert error:', insertError)
      return NextResponse.json({ 
        error: 'Failed to register files in database',
        details: insertError.message
      }, { status: 500 })
    }

    console.log(`✅ Successfully registered ${insertedFiles?.length || 0} files in database`)

    return NextResponse.json({
      success: true,
      registeredFiles: insertedFiles?.length || 0,
      customer: customer.name
    })

  } catch (error) {
    console.error('❌ Upload callback error:', error)
    return NextResponse.json({ 
      error: 'Upload callback failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
