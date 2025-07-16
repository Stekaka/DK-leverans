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

    // EMERGENCY MODE: Skip customer verification completely
    console.log('🚨 EMERGENCY MODE: Skipping customer verification for upload')
    console.log('🚨 This allows upload regardless of customer existence in database')

    // Generera presigned URLs för varje fil
    const presignedUrls = []
    
    for (const file of files) {
      // Skapa unik filsökväg med förbättrad mappstruktur-stöd
      const timestamp = Date.now()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-åäöÅÄÖ]/g, '_') // Tillåt svenska tecken
      
      // Bygg filsökväg med mappstruktur
      let fileKey: string
      if (file.folderPath) {
        // Sanitize folder path men behåll struktur
        const sanitizedFolderPath = file.folderPath.replace(/[^a-zA-Z0-9._\/-åäöÅÄÖ]/g, '_')
        fileKey = `customers/${customerId}/${sanitizedFolderPath}/${timestamp}_${sanitizedName}`
      } else {
        fileKey = `customers/${customerId}/${timestamp}_${sanitizedName}`
      }

      console.log(`🔑 Generating presigned URL for: ${fileKey}`)
      console.log(`📁 Original folder path: ${file.folderPath || '<root>'}`)
      console.log(`📄 File size: ${(file.size / (1024 * 1024)).toFixed(1)} MB`)

      // TURBO R2: Skapa presigned URL för R2 upload - MAXIMUM PERFORMANCE OPTIMERING
      const putCommand = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
        Key: fileKey,
        ContentType: file.type || 'application/octet-stream',
        ContentLength: file.size,
        Metadata: {
          'original-name': file.name,
          'customer-id': customerId,
          'upload-timestamp': timestamp.toString(),
          'folder-path': file.folderPath || '',
          'file-size': file.size.toString()
        },
        // TURBO: Maximal R2 prestanda-optimering
        StorageClass: 'STANDARD',
        ServerSideEncryption: undefined, // Undvik overhead
        CacheControl: 'no-cache', // Undvik cache-konflikter
        // Ta bort onödiga headers för snabbare processing
      })

      try {
        // TURBO: Optimerade inställningar för maximal hastighet
        const presignedUrl = await getSignedUrl(r2Client, putCommand, { 
          expiresIn: 14400, // 4 timmar för extra säkerhet på stora filer
          signableHeaders: new Set(['content-type']), // Minimala headers för R2 speed
          unhoistableHeaders: new Set(), // Låt R2 optimera headers
        })

        presignedUrls.push({
          fileKey,
          presignedUrl,
          originalName: file.name,
          size: file.size,
          type: file.type,
          folderPath: file.folderPath || ''
        })

        console.log(`✅ TURBO: Generated optimized presigned URL for: ${file.name}`)
      } catch (urlError) {
        console.error(`❌ TURBO FAILED: Failed to generate presigned URL for ${file.name}:`, urlError)
        return NextResponse.json({ 
          error: `Failed to generate upload URL for ${file.name}` 
        }, { status: 500 })
      }
    }

    console.log(`✅ Generated ${presignedUrls.length} presigned URLs successfully`)

    return NextResponse.json({
      success: true,
      presignedUrls,
      customer: `Emergency Upload (${customerId})`
    })

  } catch (error) {
    console.error('❌ Emergency presigned upload error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate presigned URLs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
