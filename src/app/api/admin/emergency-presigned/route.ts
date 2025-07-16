import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client } from '../../../../../lib/cloudflare-r2'
import { supabase } from '../../../../../lib/supabase'

interface PresignedUploadRequest {
  customerId: string
  files: {
    name: string
    size: number
    type: string
    folderPath?: string
  }[]
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== EMERGENCY PRESIGNED UPLOAD (NO AUTH) ===')
    
    const body: PresignedUploadRequest = await request.json()
    const { customerId, files } = body

    console.log(`📝 Generating presigned URLs for ${files.length} files`)
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

    // Generera presigned URLs för varje fil
    const presignedUrls = []
    
    for (const file of files) {
      // Skapa unik filsökväg
      const timestamp = Date.now()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const fileKey = file.folderPath 
        ? `customers/${customerId}/${file.folderPath}/${timestamp}_${sanitizedName}`
        : `customers/${customerId}/${timestamp}_${sanitizedName}`

      console.log(`🔑 Generating presigned URL for: ${fileKey}`)

      // Skapa presigned URL för R2 upload
      const putCommand = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
        Key: fileKey,
        ContentType: file.type,
        ContentLength: file.size,
        Metadata: {
          'original-name': file.name,
          'customer-id': customerId,
          'upload-timestamp': timestamp.toString()
        }
      })

      try {
        const presignedUrl = await getSignedUrl(r2Client, putCommand, { 
          expiresIn: 3600 // 1 timme
        })

        presignedUrls.push({
          fileKey,
          presignedUrl,
          originalName: file.name,
          size: file.size,
          type: file.type,
          folderPath: file.folderPath || ''
        })

        console.log(`✅ Generated presigned URL for: ${file.name}`)
      } catch (urlError) {
        console.error(`❌ Failed to generate presigned URL for ${file.name}:`, urlError)
        return NextResponse.json({ 
          error: `Failed to generate upload URL for ${file.name}` 
        }, { status: 500 })
      }
    }

    console.log(`✅ Generated ${presignedUrls.length} presigned URLs successfully`)

    return NextResponse.json({
      success: true,
      presignedUrls,
      customer: customer.name
    })

  } catch (error) {
    console.error('❌ Emergency presigned upload error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate presigned URLs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
