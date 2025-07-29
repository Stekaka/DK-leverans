/**
 * Progressive File Downloader
 * Laddar ner flera filer en efter en utan ZIP-komprimering
 * Filerna sparas direkt i webbläsarens Downloads-mapp
 */

export interface ProgressiveDownloadProgress {
  currentFile: number
  totalFiles: number
  // Aliases for backward compatibility  
  completed: number
  total: number
  currentFileName: string
  downloadSpeed: string
  eta: string
  failedFiles: Array<{ file: any; error: string }>
  completedFiles: string[]
  phase: 'downloading' | 'completed' | 'cancelled'
  downloadedBytes?: number
  totalBytes?: number
}

export interface ProgressiveDownloadCallback {
  (progress: ProgressiveDownloadProgress): void
}

export class ProgressiveDownloader {
  private abortController: AbortController | null = null
  private startTime: number = 0
  private totalBytesDownloaded: number = 0
  private failedFiles: Array<{ file: any; error: string }> = []
  private completedFiles: string[] = []

  /**
   * Ladda ner flera filer progressivt (en efter en)
   */
  async downloadFiles(
    files: Array<{ id: string; original_name: string; file_size: number }>,
    onProgress?: ProgressiveDownloadCallback,
    customerId?: string
  ): Promise<{ success: boolean; completed: number; failed: number }> {
    try {
      this.abortController = new AbortController()
      this.startTime = Date.now()
      this.totalBytesDownloaded = 0
      this.failedFiles = []
      this.completedFiles = []

      console.log(`🚀 PROGRESSIVE-DOWNLOAD: Starting download of ${files.length} files`)

      for (let i = 0; i < files.length; i++) {
        if (this.abortController?.signal.aborted) {
          console.log('🛑 PROGRESSIVE-DOWNLOAD: Download cancelled by user')
          break
        }

        const file = files[i]
        const progress = this.calculateProgress(i + 1, files.length, file.original_name)
        
        // Uppdatera progress före nedladdning
        if (onProgress) {
          onProgress({
            ...progress,
            phase: 'downloading'
          })
        }

        try {
          await this.downloadSingleFile(file, customerId)
          this.completedFiles.push(file.original_name)
          this.totalBytesDownloaded += file.file_size
          
          console.log(`✅ PROGRESSIVE-DOWNLOAD: Completed ${file.original_name} (${i + 1}/${files.length})`)
          
          // Kort paus mellan nedladdningar för stabilitet
          if (i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Okänt fel'
          this.failedFiles.push({ file, error: errorMessage })
          console.error(`❌ PROGRESSIVE-DOWNLOAD: Failed to download ${file.original_name}:`, errorMessage)
        }

        // Uppdatera progress efter varje fil
        const updatedProgress = this.calculateProgress(i + 1, files.length, file.original_name)
        if (onProgress) {
          onProgress({
            ...updatedProgress,
            phase: i === files.length - 1 ? 'completed' : 'downloading'
          })
        }
      }

      const completed = this.completedFiles.length
      const failed = this.failedFiles.length
      
      console.log(`📊 PROGRESSIVE-DOWNLOAD: Completed ${completed}/${files.length} files (${failed} failed)`)
      
      return {
        success: completed > 0,
        completed,
        failed
      }

    } catch (error) {
      console.error('❌ PROGRESSIVE-DOWNLOAD: Unexpected error:', error)
      return {
        success: false,
        completed: this.completedFiles.length,
        failed: files.length - this.completedFiles.length
      }
    }
  }

  /**
   * Ladda ner en enskild fil direkt till Downloads
   */
  private async downloadSingleFile(
    file: { id: string; original_name: string; file_size: number },
    customerId?: string
  ): Promise<void> {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📥 PROGRESSIVE-DOWNLOAD: Downloading ${file.original_name} (attempt ${attempt}/${maxRetries})`)

        // Skapa download URL
        let downloadUrl = `/api/customer/files/${file.id}/download`
        if (customerId) {
          downloadUrl += `?customer_id=${encodeURIComponent(customerId)}`
        }

        // Timeout för varje nedladdning
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => {
          timeoutController.abort()
        }, 120000) // 2 minuters timeout per fil

        try {
          const response = await fetch(downloadUrl, {
            method: 'GET',
            credentials: 'include',
            signal: timeoutController.signal
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const fileBlob = await response.blob()
          
          // Ladda ner filen direkt med webbläsarens inbyggda funktion
          this.downloadBlob(fileBlob, file.original_name)
          
          clearTimeout(timeoutId)
          return // Success!

        } finally {
          clearTimeout(timeoutId)
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < maxRetries) {
          console.warn(`⚠️ PROGRESSIVE-DOWNLOAD: Attempt ${attempt}/${maxRetries} failed, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      }
    }

    throw lastError || new Error(`Failed to download ${file.original_name}`)
  }

  /**
   * Ladda ner blob som fil (samma som ZIP-versionen)
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
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 1000)
  }

  /**
   * Beräkna progress och statistik
   */
  private calculateProgress(
    currentFile: number, 
    totalFiles: number, 
    currentFileName: string
  ): Omit<ProgressiveDownloadProgress, 'phase'> {
    const elapsedTime = (Date.now() - this.startTime) / 1000
    
    // Beräkna hastighet
    let downloadSpeed = '0 MB/s'
    if (elapsedTime > 0 && this.totalBytesDownloaded > 0) {
      const speed = this.totalBytesDownloaded / elapsedTime
      if (speed > 1024 * 1024) {
        downloadSpeed = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`
      } else if (speed > 1024) {
        downloadSpeed = `${(speed / 1024).toFixed(1)} KB/s`
      } else {
        downloadSpeed = `${speed.toFixed(0)} B/s`
      }
    }

    // Beräkna ETA
    let eta = 'Beräknar...'
    if (currentFile > 0 && elapsedTime > 0) {
      const remainingFiles = totalFiles - currentFile
      const avgTimePerFile = elapsedTime / currentFile
      const remainingSeconds = remainingFiles * avgTimePerFile
      
      if (remainingSeconds > 3600) {
        const hours = Math.floor(remainingSeconds / 3600)
        const minutes = Math.floor((remainingSeconds % 3600) / 60)
        eta = `${hours}h ${minutes}m`
      } else if (remainingSeconds > 60) {
        const minutes = Math.floor(remainingSeconds / 60)
        const seconds = Math.floor(remainingSeconds % 60)
        eta = `${minutes}m ${seconds}s`
      } else {
        eta = `${Math.floor(remainingSeconds)}s`
      }
    }

    return {
      currentFile,
      totalFiles,
      completed: currentFile, // Alias for backward compatibility
      total: totalFiles, // Alias for backward compatibility  
      currentFileName,
      downloadSpeed,
      eta,
      failedFiles: [...this.failedFiles],
      completedFiles: [...this.completedFiles],
      downloadedBytes: this.totalBytesDownloaded,
      totalBytes: 0 // We don't track total bytes in this implementation
    }
  }

  /**
   * Avbryt pågående nedladdning
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      console.log('🛑 PROGRESSIVE-DOWNLOAD: Download aborted by user')
    }
  }

  /**
   * Få statistik över nedladdningen
   */
  getStats(): {
    completedFiles: string[]
    failedFiles: Array<{ file: any; error: string }>
    totalBytesDownloaded: number
    elapsedTime: number
  } {
    return {
      completedFiles: [...this.completedFiles],
      failedFiles: [...this.failedFiles],
      totalBytesDownloaded: this.totalBytesDownloaded,
      elapsedTime: this.startTime ? (Date.now() - this.startTime) / 1000 : 0
    }
  }
}

export default ProgressiveDownloader
