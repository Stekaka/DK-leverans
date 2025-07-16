import fs from 'fs/promises'
import path from 'path'

// Temporär lokal fillagring medan vi löser Cloudflare R2 problem
export const localFileService = {
  async uploadFile(
    file: Buffer,
    fileName: string,
    contentType: string,
    customerId: string
  ): Promise<string> {
    try {
      // Skapa uploads mapp om den inte finns
      const uploadsDir = path.join(process.cwd(), 'uploads', 'customers', customerId)
      await fs.mkdir(uploadsDir, { recursive: true })

      // Skapa unik filsökväg
      const timestamp = Date.now()
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = path.join(uploadsDir, `${timestamp}_${cleanFileName}`)

      // Spara filen lokalt
      await fs.writeFile(filePath, file)

      // Returnera lokal URL
      return `/uploads/customers/${customerId}/${timestamp}_${cleanFileName}`
    } catch (error) {
      console.error('Error saving file locally:', error)
      throw new Error('Failed to save file locally')
    }
  },

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), filePath)
      await fs.unlink(fullPath)
    } catch (error) {
      console.error('Error deleting local file:', error)
      throw new Error('Failed to delete local file')
    }
  },

  getFileKeyFromUrl(url: string): string {
    return url.replace('/uploads/', '')
  },

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}
