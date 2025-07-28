import JSZip from 'jszip'

export interface ProgressCallback {
  (progress: number, current: number, total: number, fileName?: string): void
}

export interface DownloadProgress {
  total: number
  downloaded: number
  currentFile?: string
  phase: 'downloading' | 'creating' | 'saving'
  percentage: number
}

/**
 * Client-side ZIP creation för stora nedladdningar
 * Laddar ner filer parallellt och skapar ZIP lokalt i webbläsaren
 */
export class ClientZipCreator {
  private zip: JSZip
  private abortController: AbortController | null = null

  constructor() {
    this.zip = new JSZip()
  }

  /**
   * Skapa och ladda ner EN enda ZIP-fil med alla valda filer
   */
  async createAndDownloadZip(
    files: Array<{ id: string; original_name: string; download_url: string | null }>,
    zipFileName: string = 'files.zip',
    onProgress?: ProgressCallback,
    concurrency: number = 6
  ): Promise<boolean> {
    try {
      this.abortController = new AbortController()
      
      console.log(`🚀 CLIENT-ZIP: Starting download of ${files.length} files`)
      
      // Fase 1: Ladda ner alla filer och lägg till i ZIP
      await this.downloadAndAddFiles(files, onProgress, concurrency)
      
      // Fas 2: Skapa ZIP-blob
      if (onProgress) onProgress(95, files.length, files.length, 'Skapar ZIP-fil...')
      console.log('📦 CLIENT-ZIP: Generating ZIP blob...')
      
      const zipBlob = await this.zip.generateAsync({
        type: 'blob',
        compression: 'STORE', // Ingen kompression för hastighet
        compressionOptions: { level: 0 }
      })

      console.log(`✅ CLIENT-ZIP: ZIP created successfully (${(zipBlob.size / (1024 * 1024 * 1024)).toFixed(1)} GB)`)

      // Fas 3: Spara ZIP-filen
      if (onProgress) onProgress(100, files.length, files.length, 'Sparar ZIP-fil...')
      
      this.downloadBlob(zipBlob, zipFileName)
      
      return true
    } catch (error) {
      console.error('❌ CLIENT-ZIP: Error creating ZIP:', error)
      throw error
    }
  }

  /**
   * Ladda ner filer parallellt och lägg till i ZIP
   */
  private async downloadAndAddFiles(
    files: Array<{ id: string; original_name: string; download_url: string | null }>,
    onProgress?: ProgressCallback,
    concurrency: number = 6
  ): Promise<void> {
    const downloadPromises: Promise<void>[] = []
    let completedCount = 0

    // Skapa download-chunks för parallelism
    for (let i = 0; i < files.length; i += concurrency) {
      const chunk = files.slice(i, i + concurrency)
      
      const chunkPromises = chunk.map(async (file) => {
        try {
          if (!file.download_url) {
            console.warn(`⚠️ CLIENT-ZIP: No download URL for file: ${file.original_name}`)
            return
          }

          console.log(`📥 CLIENT-ZIP: Downloading ${file.original_name}`)
          
          const response = await fetch(file.download_url, {
            signal: this.abortController?.signal
          })

          if (!response.ok) {
            throw new Error(`Failed to download ${file.original_name}: ${response.status}`)
          }

          const fileBlob = await response.blob()
          
          // Lägg till filen i ZIP:en
          this.zip.file(file.original_name, fileBlob)
          
          completedCount++
          const progress = Math.round((completedCount / files.length) * 90) // 90% för download-fasen
          
          if (onProgress) {
            onProgress(progress, completedCount, files.length, file.original_name)
          }

          console.log(`✅ CLIENT-ZIP: Added ${file.original_name} to ZIP (${completedCount}/${files.length})`)
          
        } catch (error) {
          console.error(`❌ CLIENT-ZIP: Failed to download ${file.original_name}:`, error)
          throw error
        }
      })

      downloadPromises.push(...chunkPromises)
      
      // Vänta på att denna chunk ska slutföras innan vi startar nästa
      await Promise.all(chunkPromises)
    }
  }

  /**
   * Ladda ner blob som fil
   */
  private downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Rensa URL efter en kort stund
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 1000)
  }

  /**
   * Avbryt pågående nedladdning
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      console.log('🛑 CLIENT-ZIP: Download aborted by user')
    }
  }

  /**
   * Kontrollera om webbläsaren stöder stora filer
   */
  static checkBrowserSupport(): { supported: boolean; message?: string } {
    try {
      // Testa om JSZip och Blob är tillgängliga
      if (typeof JSZip === 'undefined') {
        return { supported: false, message: 'JSZip library inte tillgänglig' }
      }

      if (typeof Blob === 'undefined') {
        return { supported: false, message: 'Blob API inte stödd' }
      }

      // Kontrollera ungefärlig RAM (Chrome endast)
      const navigator = window.navigator as any
      if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        return { 
          supported: true, 
          message: 'Varning: Låg RAM-mängd upptäckt. Stora ZIP-filer kan vara långsamma.' 
        }
      }

      return { supported: true }
    } catch (error) {
      return { supported: false, message: 'Kunde inte kontrollera webbläsarstöd' }
    }
  }
}

export default ClientZipCreator
