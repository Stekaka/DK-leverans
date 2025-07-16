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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      
      // Begränsa antalet filer för att undvika Vercel payload-problem
      const maxFiles = 10
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
    }
  }

  const uploadFileDirectly = async (file: File, presignedUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      
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
      
      // Steg 1: Hämta presigned URLs (begränsa batch-storlek)
      const batchSize = 5 // Begränsa till 5 filer per batch för att undvika payload-problem
      const allPresignedUrls: PresignedUpload[] = []
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(files.length/batchSize)} with ${batch.length} files`)
        
        const presignedResponse = await fetch('/api/admin/presigned-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword
          },
          body: JSON.stringify({
            customerId,
            files: batch.map(file => ({
              name: file.name,
              size: file.size,
              type: file.type,
              folderPath
            }))
          })
        })

        if (!presignedResponse.ok) {
          const errorText = await presignedResponse.text()
          console.error('❌ Presigned upload request failed:', {
            status: presignedResponse.status,
            statusText: presignedResponse.statusText,
            response: errorText
          })
          throw new Error(`Failed to get presigned URLs: ${presignedResponse.status} ${presignedResponse.statusText} - ${errorText}`)
        }

        const { presignedUrls }: { presignedUrls: PresignedUpload[] } = await presignedResponse.json()
        allPresignedUrls.push(...presignedUrls)
        console.log(`📝 Got ${presignedUrls.length} presigned URLs for batch`)
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
            'x-admin-password': adminPassword
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
      onUploadComplete()
      
      alert(`Upload completed! ${successfulUploads.length}/${files.length} files uploaded successfully.`)
      
    } catch (error) {
      console.error('Upload process failed:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
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
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-200">
            Valda filer ({files.length}):
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {files.map((file, index) => {
              const status = uploadStatus[file.name] || 'pending'
              const progress = uploadProgress[file.name] || 0
              
              return (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-800 rounded text-sm">
                  <span className="text-gray-300 truncate flex-1">{file.name}</span>
                  <span className="text-gray-400 text-xs mx-2">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <div className="flex items-center space-x-2">
                    {status === 'uploading' && (
                      <div className="w-16 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                    <span className={`text-xs font-medium ${
                      status === 'success' ? 'text-green-400' :
                      status === 'error' ? 'text-red-400' :
                      status === 'uploading' ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {status === 'success' ? '✅' :
                       status === 'error' ? '❌' :
                       status === 'uploading' ? `${progress}%` :
                       '⏳'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="w-full bg-yellow-500 text-black py-3 px-4 rounded-lg font-semibold hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Laddar upp...' : `Ladda upp ${files.length} fil(er)`}
      </button>

      <div className="text-xs text-gray-400 space-y-1">
        <p>💡 <strong>Direktuppladdning:</strong> Filer laddas upp direkt till molnlagring</p>
        <p>📏 <strong>Storleksgräns:</strong> Obegränsad filstorlek (100GB+ OK)</p>
        <p>⚡ <strong>Prestanda:</strong> Snabbare för stora filer</p>
      </div>
    </div>
  )
}
