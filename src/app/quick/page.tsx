'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'
import { ArrowDownTrayIcon, FolderIcon, DocumentIcon } from '@heroicons/react/24/outline'

interface FileItem {
  id: string
  filename: string
  original_name: string
  file_size: number
  file_type: string
  folder_path: string
  uploaded_at: string
  download_url: string
  formatted_size: string
  file_extension: string
  is_image: boolean
  is_video: boolean
}

interface Customer {
  id: string
  name: string
  project: string
  email: string
}

export default function QuickPortalPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    // Kolla om det finns en customer ID i URL
    const urlParams = new URLSearchParams(window.location.search)
    const customerIdFromUrl = urlParams.get('customer')
    
    if (customerIdFromUrl) {
      // Autentisera med quick access
      authenticateQuickAccess(customerIdFromUrl)
    } else {
      // Normal access-kontroll
      checkAccess()
    }
  }, [])

  const authenticateQuickAccess = async (customerId: string) => {
    try {
      const response = await fetch('/api/quick-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      })

      if (!response.ok) {
        throw new Error('Quick access failed')
      }

      const data = await response.json()
      setCustomer(data.customer)
      loadFiles()
    } catch (error) {
      console.error('Quick access error:', error)
      setError('Kunde inte komma åt filerna. Kontrollera länken.')
      setLoading(false)
    }
  }

  const checkAccess = async () => {
    try {
      const response = await fetch('/api/customer/access')
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Kunde inte kontrollera access')
      }

      const data = await response.json()
      setCustomer(data.customer)
      
      if (data.access.hasAccess) {
        loadFiles()
      } else {
        setError('Din access har upphört. Kontakta Drönarkompaniet för förlängning.')
        setLoading(false)
      }
    } catch (error) {
      console.error('Error checking access:', error)
      setError('Ett fel uppstod vid laddning')
      setLoading(false)
    }
  }

  const loadFiles = async () => {
    try {
      const response = await fetch('/api/customer/files')
      
      if (!response.ok) {
        throw new Error('Kunde inte ladda filer')
      }

      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error loading files:', error)
      setError('Kunde inte ladda filer')
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async (file: FileItem) => {
    setDownloadingFiles(prev => new Set(prev).add(file.id))
    
    try {
      const response = await fetch(`/api/customer/download?fileId=${file.id}`)
      
      if (!response.ok) {
        throw new Error('Nedladdning misslyckades')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert('Nedladdning misslyckades')
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
    }
  }

  const downloadAll = async () => {
    if (files.length === 0) return
    
    // För stora batch-requests (>20 filer), dela upp i mindre delar (Vercel timeout fix)
    if (files.length > 20) {
      const confirmLarge = confirm(
        `Du vill ladda ner ${files.length} filer. Detta kommer att delas upp i ${Math.ceil(files.length / 20)} separata ZIP-filer (max 20 per ZIP på grund av serverlimiter). Fortsätt?`
      )
      if (!confirmLarge) return
      
      // Dela upp i grupper om 20 filer
      const chunks = []
      for (let i = 0; i < files.length; i += 20) {
        chunks.push(files.slice(i, i + 20))
      }
      
      // Ladda ner varje grupp
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        try {
          console.log(`[QUICK-DOWNLOAD] Downloading chunk ${i + 1}/${chunks.length} with ${chunk.length} files`)
          
          const response = await fetch('/api/customer/download/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileIds: chunk.map(f => f.id) })
          })

          if (response.ok) {
            const blob = await response.blob()
            const contentDisposition = response.headers.get('Content-Disposition')
            const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `${customer?.project || 'files'}_part_${i + 1}.zip`
            
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.style.display = 'none'
            
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
            
            console.log(`[QUICK-DOWNLOAD] Downloaded chunk ${i + 1}/${chunks.length} successfully`)
            
            // Kort paus mellan nedladdningar
            if (i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          } else {
            const errorData = await response.json()
            console.error(`Chunk ${i + 1} download failed:`, errorData)
            alert(`Fel vid nedladdning av del ${i + 1}: ${errorData.error || 'Okänt fel'}`)
          }
        } catch (error) {
          console.error(`Chunk ${i + 1} download error:`, error)
          alert(`Ett fel uppstod vid nedladdning av del ${i + 1}`)
        }
      }
      return
    }
    
    // Normal batch download för ≤20 filer
    try {
      const fileIds = files.map(f => f.id)
      const response = await fetch('/api/customer/download/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Batch-nedladdning misslyckades')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `${customer?.project || 'files'}_alla_filer.zip`
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Batch download error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Okänt fel'
      alert(`Kunde inte ladda ner alla filer: ${errorMessage}`)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/login')
    }
  }

  // Gruppera filer per mapp
  const filesByFolder = files.reduce((acc, file) => {
    const folder = file.folder_path || 'Huvudmapp'
    if (!acc[folder]) acc[folder] = []
    acc[folder].push(file)
    return acc
  }, {} as Record<string, FileItem[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Laddar dina filer...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ett fel uppstod</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Försök igen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <DrönarkompanietLogo size="sm" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Filportal</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {customer?.name} - {customer?.project}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {files.length > 0 && (
                <button
                  onClick={downloadAll}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>Ladda ner alla ({files.length})</span>
                </button>
              )}
              <button
                onClick={logout}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {files.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon className="h-24 w-24 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Inga filer än</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Dina filer kommer att visas här när de laddas upp.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(filesByFolder).map(([folderName, folderFiles]) => (
              <div key={folderName} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center space-x-3">
                    <FolderIcon className="h-6 w-6 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {folderName}
                    </h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      ({folderFiles.length} filer)
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {folderFiles.map((file) => (
                      <div 
                        key={file.id}
                        className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3 flex-1">
                            <DocumentIcon className="h-8 w-8 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {file.original_name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {file.formatted_size}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => downloadFile(file)}
                          disabled={downloadingFiles.has(file.id)}
                          className="w-full bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center space-x-2"
                        >
                          {downloadingFiles.has(file.id) ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Laddar ner...</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              <span>Ladda ner</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
