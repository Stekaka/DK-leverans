import { createClient } from '@supabase/supabase-js'
import { r2Service } from './cloudflare-r2'
import JSZip from 'jszip'

/**
 * 🚀 AUTO ZIP GENERATOR 
 * 
 * Skapar automatiskt en "bundle ZIP" för kunden när filer laddas upp
 * Enligt din specifikation: kund-id_bundle.zip lagras i R2
 */

export class AutoZipGenerator {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  /**
   * Skapar eller uppdaterar bundle ZIP för en kund
   * Anropas automatiskt när nya filer laddas upp
   */
  async createOrUpdateBundleZip(customerId: string): Promise<{
    success: boolean
    bundleUrl?: string
    fileCount?: number
    zipSize?: number
    error?: string
  }> {
    try {
      console.log(`🎯 Auto-generating bundle ZIP for customer: ${customerId}`)

      // Hämta alla kundens filer
      const { data: files, error: filesError } = await this.supabase
        .from('files')
        .select('file_path, original_name, file_size')
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .eq('is_trashed', false)

      if (filesError || !files || files.length === 0) {
        return {
          success: false,
          error: `No files found for customer ${customerId}`
        }
      }

      console.log(`📁 Found ${files.length} files to bundle`)

      // Skapa ZIP med JSZip
      const zip = new JSZip()
      let totalSize = 0

      // Lägg till varje fil i ZIP:en
      for (const file of files) {
        try {
          console.log(`📥 Adding file: ${file.original_name}`)
          
          // Hämta filen från R2
          const fileData = await r2Service.getFile(file.file_path)
          if (!fileData) {
            console.warn(`⚠️ Could not fetch file: ${file.file_path}`)
            continue
          }

          // Lägg till i ZIP med original namn
          zip.file(file.original_name, fileData)
          totalSize += file.file_size || 0

        } catch (fileError) {
          console.error(`❌ Error adding file ${file.original_name}:`, fileError)
          // Fortsätt med nästa fil istället för att krascha
        }
      }

      console.log(`📦 Generating ZIP buffer...`)
      
      // Generera ZIP buffer
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })

      console.log(`💾 ZIP generated: ${zipBuffer.length} bytes`)

      // Upload till R2 med bundle naming
      const bundlePath = `bundles/${customerId}_bundle.zip`
      
      // R2 service har uploadFile(buffer, fileName, contentType, customerId) signature
      const uploadUrl = await r2Service.uploadFile(
        zipBuffer,
        `${customerId}_bundle.zip`,
        'application/zip',
        customerId
      )

      if (!uploadUrl) {
        return {
          success: false,
          error: `Failed to upload bundle ZIP to R2`
        }
      }

      // Spara metadata i databasen
      await this.saveBundleMetadata(customerId, bundlePath, files.length, zipBuffer.length)

      // Generera signed URL för direkt nedladdning
      const signedUrl = await r2Service.getSignedDownloadUrl(bundlePath, 24 * 60 * 60) // 24h expiry

      console.log(`✅ Bundle ZIP created successfully: ${bundlePath}`)

      return {
        success: true,
        bundleUrl: signedUrl,
        fileCount: files.length,
        zipSize: zipBuffer.length
      }

    } catch (error) {
      console.error('❌ Auto ZIP generation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Spara bundle metadata i databasen
   */
  private async saveBundleMetadata(
    customerId: string, 
    bundlePath: string, 
    fileCount: number, 
    zipSize: number
  ) {
    try {
      const { error } = await this.supabase
        .from('customer_bundles')
        .upsert({
          customer_id: customerId,
          bundle_path: bundlePath,
          file_count: fileCount,
          bundle_size: zipSize,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })

      if (error) {
        console.error('❌ Failed to save bundle metadata:', error)
      } else {
        console.log('✅ Bundle metadata saved')
      }
    } catch (error) {
      console.error('❌ Error saving bundle metadata:', error)
    }
  }

  /**
   * Hämta befintlig bundle för kund
   */
  async getBundleForCustomer(customerId: string): Promise<{
    bundleUrl?: string
    fileCount?: number
    bundleSize?: number
    createdAt?: string
    exists: boolean
  }> {
    try {
      const { data, error } = await this.supabase
        .from('customer_bundles')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return { exists: false }
      }

      // Kolla om bundle fortfarande finns och inte är expired
      const now = new Date()
      const expiresAt = new Date(data.expires_at)
      
      if (expiresAt < now) {
        console.log(`🗑️ Bundle expired for customer ${customerId}`)
        return { exists: false }
      }

      // Generera ny signed URL
      const signedUrl = await r2Service.getSignedDownloadUrl(data.bundle_path, 24 * 60 * 60)

      return {
        bundleUrl: signedUrl,
        fileCount: data.file_count,
        bundleSize: data.bundle_size,
        createdAt: data.created_at,
        exists: true
      }

    } catch (error) {
      console.error('❌ Error getting bundle for customer:', error)
      return { exists: false }
    }
  }

  /**
   * Triggas automatiskt när nya filer laddas upp
   * Anropas från upload endpoints
   */
  async onFileUploaded(customerId: string) {
    console.log(`🔔 File uploaded for customer ${customerId} - regenerating bundle ZIP`)
    
    // Regenerera bundle i bakgrunden (fire and forget)
    this.createOrUpdateBundleZip(customerId).catch(error => {
      console.error('❌ Background bundle generation failed:', error)
    })
  }
}

// Singleton instance
export const autoZipGenerator = new AutoZipGenerator()
