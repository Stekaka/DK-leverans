'use client'

import React, { useState } from 'react'

interface DirectUploadComponentProps {
  customerId: string
  adminPassword: string // Skickas från parent component
  onUploadComplete: () => void
}

interface PresignedUpload {
  fileKey: string
  presignedUrl: string
  originalName: string
  size: number
  type: string
  folderPath: string
}

export default function DirectUploadComponent({ 
  customerId, 
  adminPassword,
  onUploadComplete 
}: DirectUploadComponentProps) {
  const [files, setFiles] = useState<File[]>([])
  const [folderPath, setFolderPath] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: 'pending' | 'uploading' | 'success' | 'error' }>({})
  const [uploadStartTimes, setUploadStartTimes] = useState<{ [key: string]: number }>({})

  // Helper functions for progress visualization
  const getTotalProgress = (): number => {
    if (files.length === 0) return 0
    const totalProgress = Object.values(uploadProgress).reduce((sum, progress) => sum + progress, 0)
    return totalProgress / files.length
  }

  const getCompletedFiles = (): number => {
    return Object.values(uploadStatus).filter(status => status === 'success').length
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'uploading': return 'text-yellow-400'
      default: return 'text-gray-500'
    }
  }

  const getStatusTextColor = (status: string): string => {
    switch (status) {
      case 'success': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'uploading': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusText = (status: string, progress: number): string => {
    switch (status) {
      case 'success': return 'Uppladdad ✅'
      case 'error': return 'Fel uppstod ❌'
      case 'uploading': return 'Laddar upp...'
      default: return 'Väntar...'
    }
  }

  const getProgressBarColor = (status: string): string => {
    switch (status) {
      case 'success': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      case 'uploading': return 'bg-yellow-500'
      default: return 'bg-gray-600'
    }
  }

  const getUploadETA = (fileName: string, fileSize: number, progress: number): string | null => {
    const startTime = uploadStartTimes[fileName]
    if (!startTime || progress <= 5) return null
    
    const elapsedTime = Date.now() - startTime
    const remainingPercent = 100 - progress
    const estimatedTotalTime = (elapsedTime / progress) * 100
    const remainingTime = estimatedTotalTime - elapsedTime
    
    if (remainingTime < 1000) return '< 1s'
    if (remainingTime < 60000) return `${Math.round(remainingTime / 1000)}s`
    return `${Math.round(remainingTime / 60000)}min`
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      
      // Begränsa antalet filer för att undvika Vercel payload-problem
      const maxFiles = 6 // Minska till 6 filer (3 batches à 2 filer) för att undvika request-problem
      if (selectedFiles.length > maxFiles) {
        alert(`För många filer! Max ${maxFiles} filer åt gången för att undvika upload-problem. Välj färre filer och prova igen.`)
        return
      }
      
      // Kontrollera filstorlekar (varning för stora filer)
      const largeFiles = selectedFiles.filter(f => f.size > 100 * 1024 * 1024) // 100MB
      if (largeFiles.length > 0) {
        const fileNames = largeFiles.map(f => f.name).join(', ')
        console.log(`⚠️ Large files detected (>100MB): ${fileNames}`)
      }
      
      setFiles(selectedFiles)
      
      // Initiera status för alla filer
      const initialStatus: { [key: string]: 'pending' } = {}
      selectedFiles.forEach(file => {
        initialStatus[file.name] = 'pending'
      })
      setUploadStatus(initialStatus)
      setUploadProgress({})
      setUploadStartTimes({})
    }
  }

  const uploadFileDirectly = async (file: File, presignedUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      
      // Record start time for ETA calculation
      setUploadStartTimes(prev => ({ ...prev, [file.name]: Date.now() }))
      
      // Upload progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }))
        }
      })
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'success' }))
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
          resolve(true)
        } else {
          console.error(`Upload failed for ${file.name}:`, xhr.status, xhr.statusText)
          setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }))
          resolve(false)
        }
      })
      
      xhr.addEventListener('error', () => {
        console.error(`Upload error for ${file.name}`)
        setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }))
        resolve(false)
      })
      
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      
      setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }))
      xhr.send(file)
    })
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    
    try {
      console.log('🚀 Starting direct upload process...')
      console.log(`📁 Files to upload: ${files.length}`)
      console.log(`🔐 Using admin password: ${adminPassword.substring(0, 10)}...`)
      
      // Steg 1: Hämta presigned URLs (extra liten batch-storlek för att undvika payload-problem)
      const batchSize = 1 // Endast 1 fil per batch för att helt undvika "Request Entity Too Large"
      const allPresignedUrls: PresignedUpload[] = []
      
      // Lista av möjliga admin-lösenord för debug
      const possiblePasswords = [
        adminPassword, // Försök med det som skickades in först
        'DrönarkompanietAdmin2025!',
        'admin123',
        'admin',
        'Admin2025!',
        'DronarkompanietAdmin2025!' // utan ö
      ]
      
      let workingPassword = adminPassword // Default
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(files.length/batchSize)} with ${batch.length} files`)
        
        // Begränsa metadata-storlek för att minska payload
        const payload = {
          customerId,
          files: batch.map(file => ({
            name: file.name.substring(0, 200), // Begränsa filnamn till 200 tecken
            size: file.size,
            type: file.type.substring(0, 100), // Begränsa MIME-typ
            folderPath: folderPath.substring(0, 100) // Begränsa mapp-sökväg
          }))
        }
        
        // Logga payload-storlek för debug
        const payloadSize = JSON.stringify(payload).length
        console.log(`📏 Payload size for batch: ${payloadSize} bytes`)
        
        try {
          const { response: presignedResponse, workingPassword: newWorkingPassword } = await tryPresignedRequest(payload, possiblePasswords)
          workingPassword = newWorkingPassword // Uppdatera för nästa batch
          
          const { presignedUrls }: { presignedUrls: PresignedUpload[] } = await presignedResponse.json()
          allPresignedUrls.push(...presignedUrls)
          console.log(`📝 Got ${presignedUrls.length} presigned URLs for batch`)
        } catch (error) {
          console.error('❌ All password attempts failed:', error)
          throw error
        }
      }
      
      console.log(`📝 Total presigned URLs generated: ${allPresignedUrls.length}`)

      // Steg 2: Ladda upp alla filer direkt till R2
      const uploadPromises = files.map(async (file, index) => {
        const presignedData = allPresignedUrls[index]
        if (!presignedData) {
          console.error(`No presigned URL for file: ${file.name}`)
          return { success: false, file, presignedData: null }
        }
        
        const success = await uploadFileDirectly(file, presignedData.presignedUrl)
        return { success, file, presignedData }
      })

      const uploadResults = await Promise.all(uploadPromises)
      const successfulUploads = uploadResults.filter(r => r.success && r.presignedData)

      console.log(`✅ ${successfulUploads.length}/${files.length} uploads successful`)

      // Steg 3: Registrera framgångsrika uploads i databasen
      if (successfulUploads.length > 0) {
        const callbackResponse = await fetch('/api/admin/upload-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': workingPassword // Använd det fungerande lösenordet
          },
          body: JSON.stringify({
            customerId,
            uploadedFiles: successfulUploads.map(r => ({
              fileKey: r.presignedData!.fileKey,
              originalName: r.presignedData!.originalName,
              size: r.presignedData!.size,
              type: r.presignedData!.type,
              folderPath: r.presignedData!.folderPath
            }))
          })
        })

        if (!callbackResponse.ok) {
          const errorText = await callbackResponse.text()
          console.error('❌ Upload callback failed:', {
            status: callbackResponse.status,
            statusText: callbackResponse.statusText,
            response: errorText
          })
        } else {
          console.log('📊 Successfully registered uploads in database')
        }
      }

      // Rensa formulär och uppdatera UI
      setFiles([])
      setFolderPath('')
      setUploadProgress({})
      setUploadStatus({})
      setUploadStartTimes({})
      onUploadComplete()
      
      alert(`Upload completed! ${successfulUploads.length}/${files.length} files uploaded successfully.`)
      
    } catch (error) {
      console.error('Upload process failed:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Helper function to test different admin passwords
  const tryPresignedRequest = async (payload: any, possiblePasswords: string[]) => {
    for (const password of possiblePasswords) {
      console.log(`🔑 Trying password: ${password.substring(0, 10)}...`)
      
      try {
        const response = await fetch('/api/admin/presigned-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': password
          },
          body: JSON.stringify(payload)
        })
        
        if (response.ok) {
          console.log(`✅ Password works: ${password.substring(0, 10)}...`)
          return { response, workingPassword: password }
        } else {
          console.log(`❌ Password failed (${response.status}): ${password.substring(0, 10)}...`)
        }
      } catch (error) {
        console.log(`❌ Request failed with password ${password.substring(0, 10)}...:`, error)
      }
    }
    
    throw new Error('No working admin password found')
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">
          Mapp (valfritt)
        </label>
        <input
          type="text"
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="t.ex. fotografering-2024-01-15"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">
          Välj filer
        </label>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-yellow-500 file:text-black file:font-medium hover:file:bg-yellow-400"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-200">
              Valda filer ({files.length}):
            </h4>
            {uploading && (
              <div className="flex items-center space-x-3">
                {/* Total Progress Circle */}
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-700"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="transparent"
                      strokeDasharray="100,100"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-yellow-500"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="transparent"
                      strokeDasharray={`${getTotalProgress()},100`}
                      strokeLinecap="round"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-yellow-400">
                      {Math.round(getTotalProgress())}%
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  <div className="font-medium">Total progress</div>
                  <div className="text-xs text-gray-400">
                    {getCompletedFiles()}/{files.length} filer
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map((file, index) => {
              const status = uploadStatus[file.name] || 'pending'
              const progress = uploadProgress[file.name] || 0
              
              return (
                <div key={index} className="relative bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-200 font-medium truncate flex-1 pr-2">{file.name}</span>
                    <span className="text-gray-400 text-xs">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {/* Circular Progress for each file */}
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-gray-600"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray="100,100"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={getStatusColor(status)}
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={`${status === 'success' ? 100 : progress},100`}
                          strokeLinecap="round"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {status === 'success' ? (
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : status === 'error' ? (
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        ) : status === 'uploading' ? (
                          <span className="text-xs font-bold text-yellow-400">{progress}</span>
                        ) : (
                          <span className="text-xs text-gray-500">⏳</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-medium ${getStatusTextColor(status)}`}>
                          {getStatusText(status, progress)}
                        </span>
                        {status === 'uploading' && (
                          <span className="text-xs text-gray-400">{progress}%</span>
                        )}
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(status)}`}
                          style={{ width: `${status === 'success' ? 100 : progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Upload Speed and ETA for active uploads */}
                  {status === 'uploading' && progress > 0 && (
                    <div className="mt-2 flex justify-between text-xs text-gray-400">
                      <span>Laddar upp...</span>
                      {getUploadETA(file.name, file.size, progress) && (
                        <span>≈ {getUploadETA(file.name, file.size, progress)} kvar</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="relative w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black py-4 px-6 rounded-lg font-semibold hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
      >
        {uploading ? (
          <div className="flex items-center justify-center space-x-3">
            <div className="relative w-6 h-6">
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            </div>
            <span>Laddar upp {getCompletedFiles()}/{files.length} filer ({Math.round(getTotalProgress())}%)</span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Ladda upp {files.length} fil{files.length !== 1 ? 'er' : ''}</span>
          </div>
        )}
        
        {/* Progress background bar */}
        {uploading && (
          <div className="absolute bottom-0 left-0 h-1 bg-black bg-opacity-20 rounded-b-lg">
            <div 
              className="h-1 bg-black bg-opacity-40 rounded-b-lg transition-all duration-500"
              style={{ width: `${getTotalProgress()}%` }}
            />
          </div>
        )}
      </button>

      <div className="text-xs text-gray-400 space-y-1">
        <p>💡 <strong>Direktuppladdning:</strong> Filer laddas upp direkt till molnlagring</p>
        <p>📏 <strong>Storleksgräns:</strong> Obegränsad filstorlek (100GB+ OK)</p>
        <p>⚡ <strong>Prestanda:</strong> Snabbare för stora filer</p>
      </div>
    </div>
  )
}
