'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'
import { ArrowUpTrayIcon, FolderIcon, UserIcon, LinkIcon } from '@heroicons/react/24/outline'

interface Customer {
  id: string
  name: string
  project: string
  email: string
}

export default function AdminQuickUploadPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [folderName, setFolderName] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [uploadResults, setUploadResults] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    checkAdminAccess()
    loadCustomers()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const response = await fetch('/api/admin/password-check')
      if (!response.ok) {
        router.push('/admin')
        return
      }
    } catch (error) {
      router.push('/admin')
    }
  }

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/admin/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files)
    setUploadResults([])
  }

  const uploadFiles = async () => {
    if (!selectedCustomer || !files || files.length === 0) {
      alert('Välj kund och filer först')
      return
    }

    setUploading(true)
    setUploadProgress({})
    setUploadResults([])

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileName = `quick_upload_${Date.now()}_${file.name}`
        
        // Uppdatera progress
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

        // Skapa presigned URL
        const presignedResponse = await fetch('/api/admin/presigned-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: fileName,
            fileType: file.type,
            customerId: selectedCustomer.id,
            folderPath: folderName || 'Quick Upload'
          })
        })

        if (!presignedResponse.ok) {
          throw new Error(`Kunde inte skapa upload-länk för ${file.name}`)
        }

        const { uploadUrl, fileRecord } = await presignedResponse.json()

        // Ladda upp till R2
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          }
        })

        if (!uploadResponse.ok) {
          throw new Error(`Upload misslyckades för ${file.name}`)
        }

        // Markera som slutförd
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
        
        // Bekräfta upload
        await fetch('/api/admin/upload-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: fileRecord.id,
            success: true
          })
        })

        setUploadResults(prev => [...prev, `✅ ${file.name} - Uppladdad!`])
      }

      alert(`${files.length} filer uppladdade till ${selectedCustomer.name}!`)
      
      // Rensa formulär
      setFiles(null)
      setFolderName('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setUploadProgress({})

    } catch (error) {
      console.error('Upload error:', error)
      alert('Ett fel uppstod vid uppladdning: ' + (error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const generateQuickLink = (customer: Customer) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/quick?customer=${customer.id}`
  }

  const copyQuickLink = (customer: Customer) => {
    const link = generateQuickLink(customer)
    navigator.clipboard.writeText(link)
    alert(`Länk kopierad för ${customer.name}!`)
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
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Quick Upload</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Snabb filuppladdning för kunder
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Tillbaka till admin
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Upload Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <ArrowUpTrayIcon className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Ladda upp filer
              </h2>
            </div>

            <div className="space-y-4">
              {/* Välj kund */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Välj kund
                </label>
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value)
                    setSelectedCustomer(customer || null)
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">-- Välj kund --</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.project}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mappnamn */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Mappnamn (valfritt)
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Quick Upload"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              {/* Filval */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Välj filer
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="w-full text-slate-900 dark:text-white"
                />
              </div>

              {/* Upload-knapp */}
              <button
                onClick={uploadFiles}
                disabled={!selectedCustomer || !files || uploading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Laddar upp...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    <span>Ladda upp {files ? `(${files.length} filer)` : ''}</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress */}
            {Object.keys(uploadProgress).length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Progress:</h3>
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{fileName}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1">
                      <div 
                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {uploadResults.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Resultat:</h3>
                <div className="space-y-1">
                  {uploadResults.map((result, index) => (
                    <p key={index} className="text-xs text-green-600 dark:text-green-400">
                      {result}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Customer Quick Links */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <LinkIcon className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Kundlänkar
              </h2>
            </div>

            <div className="space-y-3">
              {customers.map(customer => (
                <div key={customer.id} className="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <UserIcon className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {customer.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {customer.project}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyQuickLink(customer)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                    >
                      Kopiera länk
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Så här fungerar det:
              </h3>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <li>• Ladda upp filer för en kund</li>
                <li>• Kopiera kundens länk</li>
                <li>• Skicka länken till kunden</li>
                <li>• Kunden kan ladda ner filerna direkt</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
