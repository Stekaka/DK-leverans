import { NextRequest, NextResponse } from 'next/server'
import { r2Service } from '../../../../../lib/cloudflare-r2'
import { generateThumbnail, uploadThumbnail, isImageFile } from '../../../../../lib/thumbnail-generator'

export async function POST(request: NextRequest) {
  try {
    console.log('=== THUMBNAIL TEST ===')
    
    // Kontrollera admin-autentisering
    const adminPassword = request.headers.get('x-admin-password')
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      console.log('❌ Unauthorized thumbnail test access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fileKey, customerId } = body

    if (!fileKey || !customerId) {
      return NextResponse.json({ 
        error: 'Missing required parameters: fileKey, customerId' 
      }, { status: 400 })
    }

    console.log(`🧪 Testing thumbnail generation for: ${fileKey}`)
    
    // Kontrollera om det är en bildfil
    const fileName = fileKey.split('/').pop() || ''
    if (!isImageFile(fileName)) {
      return NextResponse.json({ 
        success: false,
        error: 'File is not an image'
      })
    }

    try {
      // Hämta originalfilen från R2
      console.log(`📁 Fetching file from R2: ${fileKey}`)
      const imageBuffer = await r2Service.getFile(fileKey)
      console.log(`✅ File fetched, size: ${imageBuffer.length} bytes`)
      
      // Generera och ladda upp thumbnail
      console.log(`🎨 Generating thumbnail...`)
      const thumbnailPath = await uploadThumbnail(
        fileName,
        imageBuffer,
        `customers/${customerId}`,
        { width: 300, height: 200, quality: 80, format: 'jpeg' }
      )
      
      if (thumbnailPath) {
        const thumbnailUrl = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${thumbnailPath}`
        console.log(`✅ Thumbnail generated successfully: ${thumbnailPath}`)
        
        return NextResponse.json({
          success: true,
          thumbnailPath,
          thumbnailUrl,
          originalFile: fileKey,
          originalSize: imageBuffer.length
        })
      } else {
        return NextResponse.json({ 
          success: false,
          error: 'Failed to generate thumbnail'
        })
      }

    } catch (thumbError) {
      console.error('❌ Thumbnail generation error:', thumbError)
      return NextResponse.json({ 
        success: false,
        error: 'Thumbnail generation failed',
        details: thumbError instanceof Error ? thumbError.message : 'Unknown error'
      })
    }

  } catch (error) {
    console.error('❌ Thumbnail test error:', error)
    return NextResponse.json({ 
      error: 'Thumbnail test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
