import JSZip from 'jszip'
import { saveAs } from 'file-saver'

interface FileForDownload {
  id: string
  original_name: string
  download_url: string // Detta ska vara DIREKT R2 URL, inte vår API proxy
}

export interface ProgressCallback {
  (progress: number, current: number, total: number, fileName?: string, downloadSpeed?: string, eta?: string, failedFiles?: string[]): void
}

class Semaphore {
  private permits: number
  private queue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--
        resolve()
      } else {
        this.queue.push(() => {
          this.permits--
          resolve()
        })
      }
    })
  }

  release(): void {
    this.permits++
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

export class TurboZipCreator {
  private zip: JSZip
  private aborted: boolean = false
  private failedFiles: string[] = []
  private downloadStats = {
    startTime: 0,
    totalBytes: 0,
    downloadedBytes: 0
  }

  constructor() {
    this.zip = new JSZip()
  }

  static checkBrowserSupport(): { supported: boolean; missingFeatures: string[] } {
    const missingFeatures: string[] = []
    
    if (typeof JSZip === 'undefined') {
      missingFeatures.push('JSZip library')
    }
    
    if (!window.fetch) {
      missingFeatures.push('Fetch API')
    }
    
    if (!window.AbortController) {
      missingFeatures.push('AbortController')
    }
    
    if (!window.File || !window.FileReader || !window.Blob) {
      missingFeatures.push('File APIs')
    }
    
    return {
      supported: missingFeatures.length === 0,
      missingFeatures
    }
  }

  abort(): void {
    this.aborted = true
  }

  getFailedFiles(): string[] {
    return [...this.failedFiles]
  }

  private async downloadFileDirectly(
    file: FileForDownload,
    semaphore: Semaphore,
    onProgress?: ProgressCallback,
    currentIndex: number = 0,
    totalFiles: number = 0
  ): Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }> {
    const maxRetries = 2 // Mindre retries för hastighet
    let lastError: string = ''

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.aborted) {
        return { success: false, error: 'Aborted' }
      }

      await semaphore.acquire()

      try {
        console.log(`🚀 TURBO-ZIP: Direct download attempt ${attempt} for ${file.original_name}`)
        
        // DIREKT fetch till R2 utan vår API proxy
        const startTime = Date.now()
        const response = await fetch(file.download_url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache'
          },
          signal: AbortSignal.timeout(15000) // 15s timeout för hastighet
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const buffer = await response.arrayBuffer()
        const downloadTime = Date.now() - startTime
        const fileSizeMB = buffer.byteLength / (1024 * 1024)
        const speedMBps = fileSizeMB / (downloadTime / 1000)

        console.log(`✅ TURBO-ZIP: Downloaded ${file.original_name} (${fileSizeMB.toFixed(2)} MB in ${downloadTime}ms, ${speedMBps.toFixed(2)} MB/s)`)

        // Uppdatera statistik
        this.downloadStats.downloadedBytes += buffer.byteLength
        const overallSpeedMBps = (this.downloadStats.downloadedBytes / (1024 * 1024)) / ((Date.now() - this.downloadStats.startTime) / 1000)

        if (onProgress) {
          const progress = ((currentIndex + 1) / totalFiles) * 100
          const speedText = `${overallSpeedMBps.toFixed(1)} MB/s`
          const remainingFiles = totalFiles - currentIndex - 1
          const avgTimePerFile = (Date.now() - this.downloadStats.startTime) / (currentIndex + 1)
          const etaSeconds = (remainingFiles * avgTimePerFile) / 1000
          const etaText = etaSeconds > 60 ? `${Math.round(etaSeconds / 60)} min` : `${Math.round(etaSeconds)} sek`

          onProgress(progress, currentIndex + 1, totalFiles, file.original_name, speedText, etaText, this.failedFiles)
        }

        return { success: true, buffer }

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        console.warn(`⚠️ TURBO-ZIP: Attempt ${attempt} failed for ${file.original_name}: ${lastError}`)
        
        if (attempt < maxRetries) {
          // Exponential backoff men kort för hastighet
          await new Promise(resolve => setTimeout(resolve, Math.min(500 * attempt, 2000)))
        }
      } finally {
        semaphore.release()
      }
    }

    console.error(`❌ TURBO-ZIP: All attempts failed for ${file.original_name}: ${lastError}`)
    this.failedFiles.push(file.original_name)
    
    if (onProgress) {
      const progress = ((currentIndex + 1) / totalFiles) * 100
      onProgress(progress, currentIndex + 1, totalFiles, file.original_name, '', '', this.failedFiles)
    }

    return { success: false, error: lastError }
  }

  async createAndDownloadZip(
    files: FileForDownload[],
    zipName: string,
    onProgress?: ProgressCallback,
    maxConcurrent: number = 8, // Öka från 2 till 8 för hastighet!
    customerId?: string
  ): Promise<boolean> {
    try {
      if (files.length === 0) {
        throw new Error('Inga filer att ladda ner')
      }

      console.log(`🚀 TURBO-ZIP: Starting TURBO download of ${files.length} files with ${maxConcurrent} concurrent connections`)

      this.downloadStats.startTime = Date.now()
      this.downloadStats.totalBytes = 0
      this.downloadStats.downloadedBytes = 0
      this.failedFiles = []

      const semaphore = new Semaphore(maxConcurrent)

      // Ladda ner alla filer med höj parallelism
      const downloadPromises = files.map((file, index) =>
        this.downloadFileDirectly(file, semaphore, onProgress, index, files.length)
      )

      const results = await Promise.all(downloadPromises)

      if (this.aborted) {
        return false
      }

      // Lägg till lyckade filer till ZIP
      let successfulFiles = 0
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const file = files[i]

        if (result.success && result.buffer) {
          this.zip.file(file.original_name, result.buffer)
          successfulFiles++
        }
      }

      if (successfulFiles === 0) {
        throw new Error('Inga filer kunde laddas ner')
      }

      console.log(`🚀 TURBO-ZIP: Creating ZIP with ${successfulFiles}/${files.length} successful files`)

      // Uppdatera progress för ZIP-skapande
      if (onProgress) {
        onProgress(95, files.length, files.length, '', '', 'Skapar ZIP...', this.failedFiles)
      }

      // Generera ZIP med högsta hastighet
      const zipBlob = await this.zip.generateAsync({
        type: 'blob',
        compression: 'STORE', // Ingen komprimering för hastighet
        compressionOptions: { level: 0 }
      })

      if (this.aborted) {
        return false
      }

      // Uppdatera progress för nedladdning
      if (onProgress) {
        onProgress(100, files.length, files.length, '', '', 'Sparar fil...', this.failedFiles)
      }

      // Spara filen
      saveAs(zipBlob, zipName)

      const totalTime = (Date.now() - this.downloadStats.startTime) / 1000
      const avgSpeedMBps = (this.downloadStats.downloadedBytes / (1024 * 1024)) / totalTime

      console.log(`✅ TURBO-ZIP: Complete! ${successfulFiles} files in ${totalTime.toFixed(1)}s (avg ${avgSpeedMBps.toFixed(2)} MB/s)`)

      return true

    } catch (error) {
      console.error('❌ TURBO-ZIP: Error:', error)
      return false
    }
  }
}
