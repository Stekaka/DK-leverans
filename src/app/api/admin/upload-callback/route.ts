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
    console.log('🚀 === UPLOAD CALLBACK STARTED === [v1.1]')
    console.log('📅 Timestamp:', new Date().toISOString())
    
    // Debug: Environment check
    console.log('🔍 Environment check:', {
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasR2AccountId: !!process.env.CLOUDFLARE_R2_ACCOUNT_ID,
      hasR2BucketName: !!process.env.CLOUDFLARE_R2_BUCKET_NAME
    })
    
    // Kontrollera admin-autentisering - samma logik som presigned-upload
    const adminPassword = request.headers.get('x-admin-password')
    
    // Lista av giltiga lösenord för debug (samma som presigned-upload)
    const validPasswords = [
      'DronarkompanietAdmin2025!', // Utan ö - ska vara detta
      'DrönarkompanietAdmin2025!', // Med ö - original
      process.env.ADMIN_PASSWORD, // Environment variabel
      'admin123' // Backup
    ].filter(p => p) // Ta bort undefined värden
    
    console.log('🔐 Auth debug:', {
      receivedPassword: adminPassword?.substring(0, 15) + '...',
      envPassword: process.env.ADMIN_PASSWORD?.substring(0, 15) + '...',
      validPasswordsCount: validPasswords.length,
      allHeaders: Object.fromEntries(request.headers.entries())
    })
    
    const isValidPassword = adminPassword && validPasswords.includes(adminPassword)
    
    if (!isValidPassword) {
      console.log('❌ AUTHENTICATION FAILED')
      console.log('❌ Tested passwords:', validPasswords.map(p => p?.substring(0, 15) + '...'))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('✅ Authentication successful')

    const body: UploadCallbackRequest = await request.json()
    const { customerId, uploadedFiles } = body

    console.log('📝 Request data:', {
      customerId,
      fileCount: uploadedFiles.length,
      files: uploadedFiles.map(f => ({ name: f.originalName, size: f.size, folder: f.folderPath }))
    })

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

      const dbFile: any = {
        customer_id: customerId,
        filename: file.fileKey, // Filnamn i R2 (med timestamp)
        original_name: file.originalName, // Original filnamn från upload
        file_size: file.size,
        file_type: file.type,
        cloudflare_url: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${file.fileKey}`,
        uploaded_at: new Date().toISOString()
      }

      // Lägg till thumbnail_url om den finns
      if (thumbnailUrl) {
        dbFile.thumbnail_url = thumbnailUrl
      }

      // Lägg till folder_path om kolumnen finns (graceful degradation)
      if (file.folderPath) {
        dbFile.folder_path = file.folderPath
      }

      dbFiles.push(dbFile)
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
