import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'
import { uploadThumbnail, isImageFile } from '../../../../../lib/thumbnail-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called')
    
    // Validera environment variables
    if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID || !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || !process.env.CLOUDFLARE_R2_BUCKET_NAME) {
      console.error('Missing Cloudflare R2 environment variables:', {
        hasAccountId: !!process.env.CLOUDFLARE_R2_ACCOUNT_ID,
        hasAccessKey: !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        hasBucket: !!process.env.CLOUDFLARE_R2_BUCKET_NAME
      })
      return NextResponse.json({ error: 'Server configuration error - missing R2 credentials' }, { status: 500 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (parseError) {
      console.error('Error parsing form data:', parseError)
      return NextResponse.json({ error: 'Invalid form data format' }, { status: 400 })
    }
    const customerId = formData.get('customerId') as string
    const files = formData.getAll('files') as File[]
    const folderPath = formData.get('folderPath') as string || ''

    console.log('Customer ID:', customerId)
    console.log('Files count:', files.length)
    console.log('Folder path:', folderPath)

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Kontrollera att kunden finns
    console.log('Checking customer exists...')
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('Customer not found:', customerError)
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    console.log('Customer found:', customer.name)

    const uploadResults = []
    const uploadErrors = []

    // Ladda upp varje fil
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        console.log(`Processing file ${i + 1}/${files.length}: ${file.name}, size: ${file.size}, type: ${file.type}`)
        
        // Validera filstorlek (100MB max)
        const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
        if (file.size > MAX_FILE_SIZE) {
          const error = `File ${file.name} is too large: ${Math.round(file.size / 1024 / 1024)}MB (max 100MB)`
          console.warn(error)
          uploadErrors.push(error)
          continue
        }

        // Validera filtyp
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'video/mp4', 'video/mov', 'video/avi', 'video/quicktime'
        ]
        
        if (!allowedTypes.includes(file.type)) {
          const error = `File ${file.name} has unsupported type: ${file.type}`
          console.warn(error)
          uploadErrors.push(error)
          continue
        }

        // Konvertera fil till Buffer
        console.log('Converting file to buffer...')
        let arrayBuffer
        let buffer
        
        try {
          arrayBuffer = await file.arrayBuffer()
          buffer = Buffer.from(arrayBuffer)
        } catch (bufferError) {
          const error = `Failed to read file ${file.name}: ${bufferError}`
          console.error(error)
          uploadErrors.push(error)
          continue
        }

        // Ladda upp till Cloudflare R2 med retry-logik
        console.log(`Uploading ${file.name} to Cloudflare R2... (attempt 1/3)`)
        let cloudflareUrl
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            cloudflareUrl = await r2Service.uploadFile(
              buffer,
              file.name,
              file.type,
              customerId
            )
            console.log(`Upload successful on attempt ${attempt}:`, cloudflareUrl)
            break
          } catch (uploadError) {
            console.error(`Upload attempt ${attempt} failed for ${file.name}:`, uploadError)
            
            if (attempt === 3) {
              throw uploadError
            }
            
            // Vänta lite mellan försök
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          }
        }
        
        if (!cloudflareUrl) {
          throw new Error('Failed to get upload URL after 3 attempts')
        }

        // Generera thumbnail för bilder
        let thumbnailUrl = null
        if (isImageFile(file.name)) {
          try {
            console.log('Generating thumbnail for image...')
            const customerPath = `customers/${customerId}/${folderPath ? folderPath + '/' : ''}${file.name}`
            thumbnailUrl = await uploadThumbnail(file.name, buffer, customerPath, {
              width: 300,
              height: 200,
              quality: 80,
              format: 'jpeg'
            })
            console.log('Thumbnail generated:', thumbnailUrl)
          } catch (thumbnailError) {
            console.error('Error generating thumbnail:', thumbnailError)
            // Fortsätt även om thumbnail misslyckas
          }
        }

        // Spara fil-metadata i Supabase
        const { data: fileRecord, error: fileError } = await supabaseAdmin
          .from('files')
          .insert([{
            customer_id: customerId,
            filename: r2Service.getFileKeyFromUrl(cloudflareUrl),
            original_name: file.name,
            file_size: file.size,
            file_type: file.type,
            cloudflare_url: cloudflareUrl,
            thumbnail_url: thumbnailUrl,
            folder_path: folderPath || '',
          }])
          .select()
          .single()

        if (fileError) {
          console.error('Error saving file metadata:', fileError)
          // Försök ta bort filen från R2 om metadata-sparandet misslyckades
          try {
            await r2Service.deleteFile(r2Service.getFileKeyFromUrl(cloudflareUrl))
          } catch (deleteError) {
            console.error('Error cleaning up R2 file:', deleteError)
          }
          throw new Error(`Failed to save metadata for ${file.name}: ${fileError.message}`)
        }

        uploadResults.push({
          ...fileRecord,
          formatted_size: r2Service.formatFileSize(file.size)
        })

        console.log(`Successfully processed file ${i + 1}/${files.length}: ${file.name}`)

      } catch (fileError) {
        const errorMsg = `Error uploading file ${file.name}: ${fileError instanceof Error ? fileError.message : String(fileError)}`
        console.error(errorMsg)
        uploadErrors.push(errorMsg)
        continue
      }
    }

    // Returnera resultat även om vissa filer misslyckades
    const response: any = {
      message: `Processing complete: ${uploadResults.length} successful, ${uploadErrors.length} failed`,
      files: uploadResults,
      customer: customer.name,
      totalFiles: files.length,
      successCount: uploadResults.length,
      errorCount: uploadErrors.length
    }

    if (uploadErrors.length > 0) {
      response.errors = uploadErrors
    }

    if (uploadResults.length === 0) {
      return NextResponse.json({ 
        error: 'No files were successfully uploaded', 
        details: uploadErrors
      }, { status: 400 })
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Upload API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
