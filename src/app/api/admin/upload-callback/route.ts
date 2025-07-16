import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'
import { generateThumbnail, uploadThumbnail, isImageFile } from '../../../../../lib/thumbnail-generator'
import { r2Service } from '../../../../../lib/cloudflare-r2'

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
    
    // Kontrollera admin-autentisering - samma logik som presigned-upload
    const adminPassword = request.headers.get('x-admin-password')
    
    // Lista av giltiga lösenord för debug (samma som presigned-upload)
    const validPasswords = [
      'DronarkompanietAdmin2025!', // Utan ö - ska vara detta
      'DrönarkompanietAdmin2025!', // Med ö - original
      process.env.ADMIN_PASSWORD, // Environment variabel
      'admin123' // Backup
    ].filter(p => p) // Ta bort undefined värden
    
    console.log('🔐 Received password:', adminPassword?.substring(0, 15) + '...')
    console.log('🔐 Environment password:', process.env.ADMIN_PASSWORD?.substring(0, 15) + '...')
    console.log('🔐 Valid passwords count:', validPasswords.length)
    
    const isValidPassword = adminPassword && validPasswords.includes(adminPassword)
    
    if (!isValidPassword) {
      console.log('❌ Unauthorized callback access attempt')
      console.log('❌ Tested against:', validPasswords.map(p => p?.substring(0, 15) + '...'))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('✅ Admin password accepted:', adminPassword?.substring(0, 15) + '...')

    const body: UploadCallbackRequest = await request.json()
    const { customerId, uploadedFiles } = body

    console.log(`📝 Processing upload callback for ${uploadedFiles.length} files`)
    console.log(`👤 Customer ID: ${customerId}`)
    console.log(`📋 Files:`, uploadedFiles.map(f => f.originalName).join(', '))

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
      // Generera thumbnail för bilder
      let thumbnailUrl = null
      if (isImageFile(file.originalName)) {
        try {
          console.log(`📷 Generating thumbnail for: ${file.originalName}`)
          
          // Hämta originalfilen från R2
          const imageBuffer = await r2Service.getFile(file.fileKey)
          
          // Generera och ladda upp thumbnail
          const thumbnailPath = await uploadThumbnail(
            file.originalName,
            imageBuffer,
            `customers/${customerId}/${file.folderPath}`,
            { width: 300, height: 200, quality: 80, format: 'jpeg' }
          )
          
          if (thumbnailPath) {
            // Skapa full URL för thumbnail
            thumbnailUrl = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${thumbnailPath}`
            console.log(`✅ Thumbnail generated successfully: ${thumbnailPath}`)
          }
        } catch (thumbError) {
          console.warn(`⚠️ Failed to generate thumbnail for ${file.originalName}:`, thumbError)
        }
      }

      dbFiles.push({
        customer_id: customerId,
        filename: file.fileKey, // Filnamn i R2 (med timestamp)
        original_name: file.originalName, // Original filnamn från upload
        file_size: file.size,
        file_type: file.type,
        cloudflare_url: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${file.fileKey}`,
        folder_path: file.folderPath || '',
        thumbnail_url: thumbnailUrl,
        uploaded_at: new Date().toISOString()
      })
    }

    console.log(`💾 Preparing to insert ${dbFiles.length} files into database`)
    console.log(`📋 Database files:`, dbFiles.map(f => ({ 
      filename: f.filename, 
      original_name: f.original_name, 
      folder_path: f.folder_path 
    })))

    // Bulk insert till databasen
    const { data: insertedFiles, error: insertError } = await supabase
      .from('files')
      .insert(dbFiles)
      .select()

    if (insertError) {
      console.error('❌ Database insert error:', insertError)
      console.error('❌ Insert error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      })
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
