import JSZip from 'jszip'

export interface ProgressCallback {
  (progress: number, current: number, total: number, fileName?: string, downloadSpeed?: string, eta?: string, failedFiles?: string[]): void
}

export interface DownloadProgress {
  total: number
  downloaded: number
  currentFile?: string
  phase: 'downloading' | 'creating' | 'saving'
  percentage: number
}

/**
 * Semaphore för att begränsa samtidiga operationer
 */
class Semaphore {
  private permits: number
  private queue: Array<(value: unknown) => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    if (this.permits > 0) {
      this.permits--
      try {
        return await task()
      } finally {
        this.release()
      }
    }

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.release()
        }
      })
    })
  }

  private release(): void {
    this.permits++
    if (this.queue.length > 0) {
      this.permits--
      const next = this.queue.shift()
      if (next) next(undefined)
    }
  }
}

/**
 * Client-side ZIP creation för stora nedladdningar
 * Laddar ner filer parallellt och skapar ZIP lokalt i webbläsaren
 */
export class ClientZipCreator {
  private zip: JSZip
  private abortController: AbortController | null = null
  private downloadStartTime: number = 0
  private totalBytesDownloaded: number = 0
  private downloadSpeedHistory: number[] = []
  private failedFiles: Array<{ file: any; error: string }> = []

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
    concurrency: number = 6,
    customerId?: string
  ): Promise<boolean> {
    try {
      this.abortController = new AbortController()
      this.downloadStartTime = Date.now()
      this.totalBytesDownloaded = 0
      this.downloadSpeedHistory = []
      this.failedFiles = []
      
      console.log(`🚀 CLIENT-ZIP: Starting download of ${files.length} files`)
      
      // Fase 1: Ladda ner alla filer och lägg till i ZIP
      await this.downloadAndAddFiles(files, onProgress, 2, customerId) // Minska till 2 samtidiga
      
      // Kontrollera om det finns misslyckade filer
      if (this.failedFiles.length > 0) {
        console.warn(`⚠️ CLIENT-ZIP: ${this.failedFiles.length} files failed to download but continuing with ZIP creation`)
        const failedFileNames = this.failedFiles.map(f => f.file.original_name)
        console.warn('Failed files:', failedFileNames)
      }
      
      const successfulFiles = files.length - this.failedFiles.length
      console.log(`📊 CLIENT-ZIP: ${successfulFiles}/${files.length} files successfully downloaded`)
      
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
   * Ladda ner filer med begränsad parallelism och retry-logik
   */
  private async downloadAndAddFiles(
    files: Array<{ id: string; original_name: string; download_url: string | null }>,
    onProgress?: ProgressCallback,
    concurrency: number = 2, // Minska till 2 samtidiga downloads
    customerId?: string
  ): Promise<void> {
    let completedCount = 0
    const semaphore = new Semaphore(concurrency)

    // Dela upp filer i småre batches för att inte överbelasta servern
    const batchSize = 10
    for (let batchStart = 0; batchStart < files.length; batchStart += batchSize) {
      const batch = files.slice(batchStart, Math.min(batchStart + batchSize, files.length))
      
      console.log(`🔄 CLIENT-ZIP: Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${batch.length} files)`)
      
      // Skapa alla download-promises för denna batch
      const downloadPromises = batch.map(async (file) => {
        return semaphore.acquire(async () => {
          return this.downloadFileWithRetry(file, customerId, 3, 2000) // 3 försök, 2s väntan
        })
      })

      // Vänta på alla nedladdningar i denna batch
      const results = await Promise.allSettled(downloadPromises)
      
      // Lägg till framgångsrika filer i ZIP och hantera progress
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const file = batch[i]
        
        if (result.status === 'fulfilled') {
          const fileBlob = result.value
          this.zip.file(file.original_name, fileBlob)
          completedCount++
          
          // Uppdatera hastighetsberäkningar
          this.totalBytesDownloaded += fileBlob.size
          const { downloadSpeed, eta } = this.calculateDownloadStats(completedCount, files.length)
          
          const progress = Math.round((completedCount / files.length) * 90) // 90% för download-fasen
          
          if (onProgress) {
            onProgress(progress, completedCount, files.length, file.original_name, downloadSpeed, eta, this.failedFiles.map(f => f.file.original_name))
          }

          console.log(`✅ CLIENT-ZIP: Added ${file.original_name} to ZIP (${completedCount}/${files.length}) - Speed: ${downloadSpeed}`)
        } else {
          // Samla misslyckade filer istället för att kasta fel
          const errorMessage = result.reason.message || 'Okänt fel'
          this.failedFiles.push({ file, error: errorMessage })
          console.error(`❌ CLIENT-ZIP: Failed to download ${file.original_name}:`, errorMessage)
          
          // Uppdatera progress även för misslyckade filer
          const totalProcessed = completedCount + this.failedFiles.length
          const progress = Math.round((totalProcessed / files.length) * 90)
          const { downloadSpeed, eta } = this.calculateDownloadStats(completedCount, files.length)
          
          if (onProgress) {
            onProgress(progress, totalProcessed, files.length, `❌ ${file.original_name}`, downloadSpeed, eta, this.failedFiles.map(f => f.file.original_name))
          }
        }
      }
      
      // Liten paus mellan batches för att inte överbelasta servern
      if (batchStart + batchSize < files.length) {
        console.log('⏱️ CLIENT-ZIP: Brief pause between batches...')
        await new Promise(resolve => setTimeout(resolve, 500)) // 500ms paus
      }
    }
  }

  /**
   * Ladda ner en fil med retry-logik
   */
  private async downloadFileWithRetry(
    file: { id: string; original_name: string; download_url: string | null },
    customerId?: string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<Blob> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📥 CLIENT-ZIP: Downloading ${file.original_name} (attempt ${attempt}/${maxRetries})`)
        
        // Skapa URL med customer_id som query parameter
        let downloadUrl = `/api/customer/files/${file.id}/download`
        if (customerId) {
          downloadUrl += `?customer_id=${encodeURIComponent(customerId)}`
        }
        
        console.log(`🔗 CLIENT-ZIP: Using download URL: ${downloadUrl}`)
        
        // Använd vårt API som proxy istället för direkt R2-access
        const response = await fetch(downloadUrl, {
          method: 'GET',
          credentials: 'include', // Inkludera cookies för authentication
          signal: this.abortController?.signal
        })

        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`
          throw new Error(errorMsg)
        }

        const fileBlob = await response.blob()
        console.log(`✅ CLIENT-ZIP: Downloaded ${file.original_name} (${(fileBlob.size / (1024 * 1024)).toFixed(1)} MB)`)
        
        return fileBlob
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`⚠️ CLIENT-ZIP: Attempt ${attempt}/${maxRetries} failed for ${file.original_name}:`, lastError.message)
        
        // Om det inte är sista försöket, vänta innan retry
        if (attempt < maxRetries) {
          const delay = retryDelay * attempt // Exponential backoff
          console.log(`⏱️ CLIENT-ZIP: Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error(`Failed to download ${file.original_name} after ${maxRetries} attempts`)
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
   * Beräkna nedladdningshastighet och uppskattad tid kvar
   */
  private calculateDownloadStats(completedFiles: number, totalFiles: number): { downloadSpeed: string; eta: string } {
    const currentTime = Date.now()
    const elapsedTime = (currentTime - this.downloadStartTime) / 1000 // sekunder
    
    if (elapsedTime === 0 || this.totalBytesDownloaded === 0) {
      return { downloadSpeed: '0 MB/s', eta: 'Beräknar...' }
    }
    
    // Beräkna genomsnittshastighet i bytes per sekund
    const currentSpeed = this.totalBytesDownloaded / elapsedTime
    
    // Håll en rullande historik av hastigheter för jämnare visning
    this.downloadSpeedHistory.push(currentSpeed)
    if (this.downloadSpeedHistory.length > 10) {
      this.downloadSpeedHistory.shift()
    }
    
    // Använd medelvärde av senaste hastigheterna
    const avgSpeed = this.downloadSpeedHistory.reduce((a, b) => a + b, 0) / this.downloadSpeedHistory.length
    
    // Formatera hastighet
    let speedDisplay: string
    if (avgSpeed > 1024 * 1024 * 1024) {
      speedDisplay = `${(avgSpeed / (1024 * 1024 * 1024)).toFixed(1)} GB/s`
    } else if (avgSpeed > 1024 * 1024) {
      speedDisplay = `${(avgSpeed / (1024 * 1024)).toFixed(1)} MB/s`
    } else if (avgSpeed > 1024) {
      speedDisplay = `${(avgSpeed / 1024).toFixed(1)} KB/s`
    } else {
      speedDisplay = `${avgSpeed.toFixed(0)} B/s`
    }
    
    // Beräkna uppskattad tid kvar
    let etaDisplay: string
    if (completedFiles >= totalFiles) {
      etaDisplay = 'Klar!'
    } else {
      const remainingFiles = totalFiles - completedFiles
      const avgTimePerFile = elapsedTime / completedFiles
      const remainingSeconds = remainingFiles * avgTimePerFile
      
      if (remainingSeconds > 3600) {
        const hours = Math.floor(remainingSeconds / 3600)
        const minutes = Math.floor((remainingSeconds % 3600) / 60)
        etaDisplay = `${hours}h ${minutes}m`
      } else if (remainingSeconds > 60) {
        const minutes = Math.floor(remainingSeconds / 60)
        const seconds = Math.floor(remainingSeconds % 60)
        etaDisplay = `${minutes}m ${seconds}s`
      } else {
        etaDisplay = `${Math.floor(remainingSeconds)}s`
      }
    }
    
    return { downloadSpeed: speedDisplay, eta: etaDisplay }
  }

  /**
   * Få lista över misslyckade filer
   */
  getFailedFiles(): Array<{ file: any; error: string }> {
    return this.failedFiles
  }

  /**
   * Avbryt pågående nedladdning
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.downloadStartTime = 0
      this.totalBytesDownloaded = 0
      this.downloadSpeedHistory = []
      this.failedFiles = []
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
