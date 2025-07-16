import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 konfiguration (S3-kompatibel)
export const r2Client = new S3Client({
  region: 'auto', // Cloudflare R2 använder 'auto'
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Viktigt för R2-kompatibilitet
})

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!

export const r2Service = {
  // Test R2 connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Testing R2 connection...')
      console.log('Account ID:', process.env.CLOUDFLARE_R2_ACCOUNT_ID)
      console.log('Access Key ID:', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.substring(0, 10) + '...')
      console.log('Bucket:', BUCKET_NAME)
      
      // Enkel test med små data
      const testKey = `test/connection-test-${Date.now()}.txt`
      const testData = Buffer.from('Connection test from DK Leverans')
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: testData,
        ContentType: 'text/plain',
      })

      await r2Client.send(command)
      
      // Ta bort test-filen
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      })
      await r2Client.send(deleteCommand)
      
      return { success: true, message: 'R2 connection successful' }
    } catch (error) {
      console.error('R2 connection test failed:', error)
      return { 
        success: false, 
        message: `R2 connection failed: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  },

  // Ladda upp fil till R2
  async uploadFile(
    file: Buffer,
    fileName: string,
    contentType: string,
    customerId: string
  ): Promise<string> {
    try {
      console.log('R2 uploadFile called with:', {
        fileName,
        contentType,
        customerId,
        fileSize: file.length,
        bucketName: BUCKET_NAME,
        endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      })

      // Skapa unik filsökväg: customer_id/timestamp_original_filename
      const timestamp = Date.now()
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const key = `customers/${customerId}/${timestamp}_${cleanFileName}`

      console.log('Generated key:', key)

      // Dela upp stora filer för bättre hantering
      const isLargeFile = file.length > 10 * 1024 * 1024 // 10MB
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: contentType,
        // Lägg till timeout för stora filer
        ...(isLargeFile && {
          Metadata: {
            'upload-type': 'large-file'
          }
        })
      })

      console.log(`Sending PutObjectCommand to R2 (${isLargeFile ? 'large file' : 'normal file'})...`)
      
      // Använd timeout för att undvika hängande requests
      const uploadPromise = r2Client.send(command)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), 60000)
      )
      
      await Promise.race([uploadPromise, timeoutPromise])
      console.log('PutObjectCommand successful')

      // Returnera den publika URL:en
      const url = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`
      console.log('Generated URL:', url)
      return url
    } catch (error) {
      console.error('Error uploading to R2:', error)
      console.error('R2 Client config:', {
        endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.substring(0, 10) + '...',
        bucket: BUCKET_NAME,
        accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID
      })
      
      // Ge mer specifik felmeddelande
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
          throw new Error(`Upload timeout or connection reset for file. File might be too large or connection unstable.`)
        } else if (error.message.includes('Access Denied') || error.message.includes('403')) {
          throw new Error(`Access denied to R2 storage. Check credentials and bucket permissions.`)
        } else if (error.message.includes('NoSuchBucket') || error.message.includes('404')) {
          throw new Error(`R2 bucket not found. Check bucket name: ${BUCKET_NAME}`)
        }
      }
      
      throw new Error('Failed to upload file to cloud storage: ' + (error instanceof Error ? error.message : String(error)))
    }
  },

  // Generera en signerad URL för säker nedladdning
  async getSignedDownloadUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      })

      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn })
      return signedUrl
    } catch (error) {
      console.error('Error generating signed URL:', error)
      throw new Error('Failed to generate download URL')
    }
  },

  // Ta bort fil från R2
  async deleteFile(fileKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      })

      await r2Client.send(command)
    } catch (error) {
      console.error('Error deleting from R2:', error)
      throw new Error('Failed to delete file from cloud storage')
    }
  },

  // Generera thumbnail för bilder (placeholder - implementera med sharp senare)
  async generateThumbnail(
    originalFile: Buffer,
    contentType: string,
    fileName: string,
    customerId: string
  ): Promise<string | null> {
    // För nu returnerar vi null - implementera senare med sharp
    if (!contentType.startsWith('image/')) {
      return null
    }

    // TODO: Implementera thumbnail-generering med sharp
    // const thumbnailBuffer = await sharp(originalFile)
    //   .resize(200, 200, { fit: 'cover' })
    //   .jpeg({ quality: 80 })
    //   .toBuffer()

    // const thumbnailKey = `thumbnails/${customerId}/${Date.now()}_thumb_${fileName}`
    // await this.uploadFile(thumbnailBuffer, thumbnailKey, 'image/jpeg', customerId)
    // return `${process.env.CLOUDFLARE_R2_ENDPOINT}/${BUCKET_NAME}/${thumbnailKey}`

    return null
  },

  // Utility för att extrahera filnyckel från URL
  getFileKeyFromUrl(url: string): string {
    const urlParts = url.split(`/${BUCKET_NAME}/`)
    return urlParts[1] || ''
  },

  // Formatera filstorlek
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  // Hämta fil från R2
  async getFile(fileKey: string): Promise<Buffer> {
    try {
      console.log('Getting file from R2:', fileKey)
      
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      })

      const response = await r2Client.send(command)
      
      if (!response.Body) {
        throw new Error('No file body received')
      }

      // Konvertera stream till Buffer på ett mer effektivt sätt
      const chunks: Buffer[] = []
      const reader = response.Body.transformToWebStream().getReader()
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(Buffer.from(value))
        }
      } finally {
        reader.releaseLock()
      }
      
      // Kombinera alla chunks till en Buffer
      return Buffer.concat(chunks)
    } catch (error) {
      console.error('Error getting file from R2:', error)
      throw new Error('Failed to retrieve file from cloud storage')
    }
  },
}
