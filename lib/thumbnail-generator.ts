import sharp from 'sharp'
import { r2Service } from './cloudflare-r2'

interface ThumbnailOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'webp' | 'png'
}

export async function generateThumbnail(
  imageBuffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer> {
  const {
    width = 300,
    height = 200,
    quality = 80,
    format = 'jpeg'
  } = options

  try {
    let pipeline = sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })

    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality })
        break
      case 'webp':
        pipeline = pipeline.webp({ quality })
        break
      case 'png':
        pipeline = pipeline.png({ quality })
        break
    }

    return await pipeline.toBuffer()
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    throw new Error('Failed to generate thumbnail')
  }
}

export async function uploadThumbnail(
  originalFileName: string,
  imageBuffer: Buffer,
  customerPath: string,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  try {
    // Generera thumbnail
    const thumbnailBuffer = await generateThumbnail(imageBuffer, options)
    
    // Skapa thumbnail filename och path
    const fileExt = originalFileName.split('.').pop()?.toLowerCase()
    const baseName = originalFileName.replace(/\.[^/.]+$/, '')
    const thumbnailName = `${baseName}_thumb.${options.format || 'jpeg'}`
    
    // Skapa thumbnail path (lägg thumbnails i egen mapp)
    const thumbnailPath = customerPath.includes('/') 
      ? `${customerPath.split('/').slice(0, -1).join('/')}/thumbnails/${thumbnailName}`
      : `thumbnails/${thumbnailName}`

    // Ladda upp thumbnail till R2
    const fileUrl = await r2Service.uploadFile(
      thumbnailBuffer,
      thumbnailName,
      `image/${options.format || 'jpeg'}`,
      customerPath.split('/')[0] // customer ID är första delen av path
    )

    return thumbnailPath
  } catch (error) {
    console.error('Error uploading thumbnail:', error)
    return null
  }
}

export async function deleteThumbnail(thumbnailPath: string): Promise<boolean> {
  try {
    await r2Service.deleteFile(thumbnailPath)
    return true
  } catch (error) {
    console.error('Error deleting thumbnail:', error)
    return false
  }
}

export function getThumbnailPath(originalPath: string, format: string = 'jpeg'): string {
  const pathParts = originalPath.split('/')
  const fileName = pathParts.pop() || ''
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  const thumbnailName = `${baseName}_thumb.${format}`
  
  if (pathParts.length > 0) {
    return `${pathParts.join('/')}/thumbnails/${thumbnailName}`
  } else {
    return `thumbnails/${thumbnailName}`
  }
}

export function isImageFile(fileName: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg']
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return imageExtensions.includes(ext)
}

export function getVideoThumbnailPath(originalPath: string): string {
  const pathParts = originalPath.split('/')
  const fileName = pathParts.pop() || ''
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  const thumbnailName = `${baseName}_thumb.jpeg`
  
  if (pathParts.length > 0) {
    return `${pathParts.join('/')}/thumbnails/${thumbnailName}`
  } else {
    return `thumbnails/${thumbnailName}`
  }
}

// För video thumbnails kan vi lägga till ffmpeg senare
export async function generateVideoThumbnail(
  videoBuffer: Buffer,
  timeOffset: number = 1
): Promise<Buffer | null> {
  // TODO: Implementera med ffmpeg för video thumbnails
  // För nu returnerar vi null och använder en placeholder
  console.log('Video thumbnail generation not implemented yet')
  return null
}
