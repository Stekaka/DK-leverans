'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageGallery from '../../components/ImageGallery'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'
import ThemeToggle from '@/components/ThemeToggle'

interface CustomerFile {
  id: string
  original_name: string
  file_type: string
  file_size: number
  formatted_size: string
  download_url: string | null
  thumbnail_url: string | null
  is_image: boolean
  is_video: boolean
  folder_path: string
  folder_display: string
  uploaded_date: string
  uploaded_at: string
  customer_rating: 'unrated' | 'favorite' | 'good' | 'poor'
  customer_notes?: string
}

interface Customer {
  id: string
  name: string
  project: string
}

export default function DashboardPage() {
  const [files, setFiles] = useState<CustomerFile[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [currentFolder, setCurrentFolder] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'favorite' | 'good' | 'poor' | 'unrated'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showGallery, setShowGallery] = useState(false)
  const [galleryStartIndex, setGalleryStartIndex] = useState(0)
  const router = useRouter()

  // Verifiera session och ladda data vid start
  useEffect(() => {
    checkSession()
  }, [])

  // Ladda mappar när filer laddas
  useEffect(() => {
    if (files.length > 0) {
      loadFolders()
    }
  }, [files])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        if (data.customer) {
          setCustomer(data.customer)
          loadFiles()
        } else {
          router.push('/login')
        }
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Session check failed:', error)
      router.push('/login')
    }
  }

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/customer/files')
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Kunde inte ladda filer')
      }
    } catch (error) {
      console.error('Error loading files:', error)
      setError('Ett fel uppstod vid laddning av filer')
    } finally {
      setLoading(false)
    }
  }

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/customer/folders')
      if (response.ok) {
        const result = await response.json()
        setFolders(result.folders || [])
      }
    } catch (error) {
      console.error('Error loading folders:', error)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
      router.push('/login')
    }
  }

  // Filter filer baserat på aktuell filter-inställning
  const filteredFiles = files.filter(file => {
    switch (filter) {
      case 'images':
        return file.is_image
      case 'videos':
        return file.is_video
      case 'favorite':
        return file.customer_rating === 'favorite'
      case 'good':
        return file.customer_rating === 'good'
      case 'poor':
        return file.customer_rating === 'poor'
      case 'unrated':
        return file.customer_rating === 'unrated'
      default:
        return true
    }
  })

  // Räkna rating-statistik
  const totalFavorites = files.filter(f => f.customer_rating === 'favorite').length
  const totalGood = files.filter(f => f.customer_rating === 'good').length
  const totalPoor = files.filter(f => f.customer_rating === 'poor').length
  const totalUnrated = files.filter(f => f.customer_rating === 'unrated').length

  // Hantera val av filer
  const toggleSelection = (fileId: string) => {
    setSelectedItems(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }

  const selectAll = () => {
    setSelectedItems(filteredFiles.map(file => file.id))
  }

  const clearSelection = () => {
    setSelectedItems([])
  }

  // Ladda ner filer
  const downloadFile = async (file: CustomerFile) => {
    try {
      const response = await fetch(`/api/customer/download?fileId=${file.id}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.original_name
        link.style.display = 'none'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } else {
        const errorData = await response.json()
        alert(`Kunde inte ladda ner filen: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Ett fel uppstod vid nedladdning')
    }
  }

  const downloadSelected = async () => {
    const selectedFiles = filteredFiles.filter(file => selectedItems.includes(file.id))
    
    if (selectedFiles.length === 0) {
      alert('Inga filer valda för nedladdning')
      return
    }

    if (selectedFiles.length === 1) {
      await downloadFile(selectedFiles[0])
    } else {
      try {
        const response = await fetch('/api/customer/download/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: selectedFiles.map(f => f.id) })
        })

        if (response.ok) {
          const blob = await response.blob()
          const contentDisposition = response.headers.get('Content-Disposition')
          const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `selected_files_${new Date().getTime()}.zip`
          
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          link.style.display = 'none'
          
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          
          setSelectedItems([])
        } else {
          const errorData = await response.json()
          alert(`Kunde inte ladda ner filerna: ${errorData.error || 'Okänt fel'}`)
        }
      } catch (error) {
        console.error('Batch download error:', error)
        alert('Ett fel uppstod vid batch-nedladdning')
      }
    }
  }

  const downloadAll = async () => {
    if (filteredFiles.length === 0) {
      alert('Inga filer att ladda ner')
      return
    }

    if (filteredFiles.length === 1) {
      await downloadFile(filteredFiles[0])
    } else {
      try {
        const response = await fetch('/api/customer/download/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: filteredFiles.map(f => f.id) })
        })

        if (response.ok) {
          const blob = await response.blob()
          const contentDisposition = response.headers.get('Content-Disposition')
          const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `all_files_${new Date().getTime()}.zip`
          
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          link.style.display = 'none'
          
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        } else {
          const errorData = await response.json()
          alert(`Kunde inte ladda ner filerna: ${errorData.error || 'Okänt fel'}`)
        }
      } catch (error) {
        console.error('Batch download error:', error)
        alert('Ett fel uppstod vid batch-nedladdning')
      }
    }
  }

  // Hantera mappnavigering
  const navigateToFolder = (folderPath: string) => {
    setCurrentFolder(folderPath)
    setSelectedItems([])
  }

  const navigateUp = () => {
    if (currentFolder) {
      const parentPath = currentFolder.split('/').slice(0, -1).join('/')
      navigateToFolder(parentPath)
    }
  }

  // Hantera rating-uppdateringar
  const updateFileRating = async (fileId: string, rating: string, notes?: string) => {
    try {
      const response = await fetch('/api/customer/rating', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, rating, notes }),
      })

      if (response.ok) {
        setFiles(prevFiles => 
          prevFiles.map(file => 
            file.id === fileId 
              ? { ...file, customer_rating: rating as any, customer_notes: notes }
              : file
          )
        )
      } else {
        const error = await response.json()
        alert('Kunde inte uppdatera betyg: ' + error.error)
      }
    } catch (error) {
      console.error('Error updating rating:', error)
      alert('Ett fel uppstod vid uppdatering av betyg')
    }
  }

  // Hantera gallery
  const openGallery = (startIndex: number) => {
    setGalleryStartIndex(startIndex)
    setShowGallery(true)
  }

  const closeGallery = () => {
    setShowGallery(false)
  }

  // Räkna statistik
  const totalFiles = files.length
  const totalImages = files.filter(f => f.is_image).length
  const totalVideos = files.filter(f => f.is_video).length
  const totalSize = files.reduce((sum, f) => sum + f.file_size, 0)
  const formattedTotalSize = totalSize > 1024 * 1024 * 1024 
    ? `${(totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB`
    : totalSize > 1024 * 1024
    ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
    : `${(totalSize / 1024).toFixed(1)} KB`

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-yellow-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-200 border-t-yellow-600 mx-auto mb-6"></div>
          <p className="text-slate-600 dark:text-slate-300 text-lg">Laddar dina filer...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-yellow-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center transition-colors">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Försök igen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-yellow-50 dark:from-slate-900 dark:to-slate-800 transition-colors">
      {/* Header - Modern Design Matching Admin Panel */}
      <header className="bg-white dark:bg-slate-800 shadow-lg border-b border-yellow-100 dark:border-slate-700 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex justify-between items-center py-3">
              <DrönarkompanietLogo variant="text" size="sm" />
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                <button 
                  onClick={logout}
                  className="text-slate-600 dark:text-slate-400 hover:text-yellow-700 dark:hover:text-yellow-400 text-sm transition-colors"
                >
                  Logga ut
                </button>
              </div>
            </div>
            <div className="pb-3">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Kundportal</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{customer?.name}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <Link href="/admin" className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 text-xs transition-colors">
                  Till admin
                </Link>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <DrönarkompanietLogo variant="full" size="md" />
              <div className="border-l border-gray-300 dark:border-slate-600 pl-4">
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Kundportal</span>
                <div className="text-xs text-slate-500 dark:text-slate-500">{customer?.project}</div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">{customer?.name}</span>
              <Link href="/admin" className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 transition-colors">
                Till admin
              </Link>
              <ThemeToggle />
              <button 
                onClick={logout}
                className="text-slate-600 dark:text-slate-400 hover:text-yellow-700 dark:hover:text-yellow-400 transition-colors"
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Download All Button - Now Prominent */}
        <div className="mb-6">
          <button 
            onClick={downloadAll}
            disabled={filteredFiles.length === 0}
            className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 
                       text-white px-6 py-3 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed 
                       flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl border border-yellow-400/50 
                       text-sm font-medium"
          >
            {filteredFiles.length > 1 ? (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>Ladda ner alla som ZIP ({filteredFiles.length} filer)</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>{filteredFiles.length === 0 ? 'Inga filer att ladda ner' : 'Ladda ner fil'}</span>
              </>
            )}
          </button>
        </div>

        {/* Smart ZIP Info */}
        {(filteredFiles.length > 10 || formattedTotalSize.includes('GB')) && (
          <div className="mb-6 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 
                          rounded-xl p-4 sm:p-6 border border-yellow-200 dark:border-yellow-700/50 shadow-sm transition-colors">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl 
                              flex items-center justify-center shadow-md flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                  Smart ZIP-nedladdning aktiverad
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                  {filteredFiles.length > 10 ? 
                    `Med ${filteredFiles.length} filer kommer de automatiskt att zippas för enklare nedladdning.` :
                    `Med ${formattedTotalSize} kommer filerna automatiskt att zippas för snabbare nedladdning.`
                  }
                  {" "}ZIP aktiveras automatiskt för {'>'}10 filer eller {'>'}5GB total storlek.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600 dark:text-yellow-400">{totalFiles}</div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Totala filer</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">{totalImages}</div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Bilder</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600 dark:text-purple-400">{totalVideos}</div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Videor</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600 dark:text-orange-400">{formattedTotalSize}</div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Total storlek</div>
          </div>
        </div>

        {/* Folder Navigation */}
        {folders.length > 0 && (
          <div className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex items-center space-x-3 mb-4">
                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mappar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigateToFolder('')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentFolder === '' 
                      ? 'bg-yellow-600 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Alla filer
                </button>
                {folders.map(folder => (
                  <button
                    key={folder}
                    onClick={() => navigateToFolder(folder)}
                    className={`px-3 py-2 rounded-lg text-sm truncate max-w-48 transition-colors ${
                      currentFolder === folder 
                        ? 'bg-yellow-600 text-white shadow-md' 
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                    title={folder || 'Root'}
                  >
                    {folder || 'Root'}
                  </button>
                ))}
              </div>
              {currentFolder && (
                <button
                  onClick={navigateUp}
                  className="mt-3 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 text-sm transition-colors"
                >
                  ← Tillbaka till överordnad mapp
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-slate-700 transition-colors space-y-4">
            {/* Filter Row */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtyp:</span>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === 'all' 
                      ? 'bg-yellow-600 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Alla ({totalFiles})
                </button>
                <button
                  onClick={() => setFilter('images')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === 'images' 
                      ? 'bg-green-600 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Bilder ({totalImages})
                </button>
                <button
                  onClick={() => setFilter('videos')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === 'videos' 
                      ? 'bg-purple-600 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Videor ({totalVideos})
                </button>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Betyg:</span>
                <button
                  onClick={() => setFilter('favorite')}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center space-x-1 transition-colors ${
                    filter === 'favorite' 
                      ? 'bg-yellow-500 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>Favoriter ({totalFavorites})</span>
                </button>
                <button
                  onClick={() => setFilter('good')}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center space-x-1 transition-colors ${
                    filter === 'good' 
                      ? 'bg-green-500 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Bra ({totalGood})</span>
                </button>
                <button
                  onClick={() => setFilter('poor')}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center space-x-1 transition-colors ${
                    filter === 'poor' 
                      ? 'bg-red-500 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Dåliga ({totalPoor})</span>
                </button>
                <button
                  onClick={() => setFilter('unrated')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === 'unrated' 
                      ? 'bg-gray-500 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Ej betygsatt ({totalUnrated})
                </button>
              </div>
            </div>

            {/* Selection Actions */}
            {selectedItems.length > 0 && (
              <div className="border-t border-gray-200 dark:border-slate-600 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    {selectedItems.length} filer valda
                  </span>
                  <button
                    onClick={downloadSelected}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm 
                               flex items-center space-x-2 transition-colors shadow-md"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {selectedItems.length > 1 ? `Ladda ner som ZIP` : 'Ladda ner'}
                    </span>
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 
                               text-sm transition-colors"
                  >
                    Rensa val
                  </button>
                  <button
                    onClick={selectAll}
                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 
                               text-sm transition-colors"
                  >
                    Välj alla ({filteredFiles.length})
                  </button>
                </div>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="border-t border-gray-200 dark:border-slate-600 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Visningsläge:</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-yellow-600 text-white shadow-md' 
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-yellow-600 text-white shadow-md' 
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* File Display */}
        {filteredFiles.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 sm:p-12 text-center border border-gray-100 dark:border-slate-700 transition-colors">
            <svg className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Inga filer hittades</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {currentFolder ? `Mappen "${currentFolder}" är tom.` : 'Du har inga filer än.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredFiles.map((file, index) => (
              <div
                key={file.id}
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all 
                           cursor-pointer border border-gray-100 dark:border-slate-700 ${
                  selectedItems.includes(file.id) ? 'ring-2 ring-yellow-500' : ''
                }`}
                onClick={() => toggleSelection(file.id)}
              >
                <div className="relative">
                  <div 
                    className="aspect-video bg-slate-100 dark:bg-slate-700 flex items-center justify-center 
                               hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (file.is_image) {
                        openGallery(index)
                      } else {
                        downloadFile(file)
                      }
                    }}
                  >
                    {file.is_image ? (
                      file.thumbnail_url ? (
                        <img
                          src={file.thumbnail_url}
                          alt={file.original_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <svg className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block">Tryck för att visa</span>
                        </div>
                      )
                    ) : (
                      <div className="text-center p-4">
                        <svg className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block">Tryck för att öppna</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Selection indicator */}
                  {selectedItems.includes(file.id) && (
                    <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate mb-2" title={file.original_name}>
                    {file.original_name}
                  </h3>
                  
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-3">
                    <span>{file.formatted_size}</span>
                    <span>{new Date(file.uploaded_at).toLocaleDateString('sv-SE')}</span>
                  </div>
                  
                  {/* Rating Stars */}
                  <div className="flex items-center space-x-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={(e) => {
                          e.stopPropagation()
                          const rating = star <= 2 ? 'poor' : star <= 3 ? 'good' : 'favorite'
                          updateFileRating(file.id, rating)
                        }}
                        className={`text-lg transition-colors ${
                          file.customer_rating === 'favorite' && star >= 4 ? 'text-yellow-400' :
                          file.customer_rating === 'good' && star >= 2 && star <= 3 ? 'text-yellow-400' :
                          file.customer_rating === 'poor' && star <= 2 ? 'text-red-400' :
                          'text-slate-300 dark:text-slate-600 hover:text-yellow-400'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadFile(file)
                      }}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm transition-colors"
                    >
                      Ladda ner
                    </button>
                    
                    {file.is_image && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openGallery(index)
                        }}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 
                                   text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors"
                      >
                        👁️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-slate-700 transition-colors">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Fil
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Storlek
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Betyg
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Åtgärder
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredFiles.map((file, index) => (
                    <tr 
                      key={file.id} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${
                        selectedItems.includes(file.id) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                      }`}
                      onClick={() => toggleSelection(file.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 mr-3">
                            {file.is_image ? (
                              <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="h-8 w-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs" title={file.original_name}>
                              {file.original_name}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {file.file_type.split('/')[1]?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        {file.formatted_size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {new Date(file.uploaded_at).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={(e) => {
                                e.stopPropagation()
                                const rating = star <= 2 ? 'poor' : star <= 3 ? 'good' : 'favorite'
                                updateFileRating(file.id, rating)
                              }}
                              className={`text-sm transition-colors ${
                                file.customer_rating === 'favorite' && star >= 4 ? 'text-yellow-400' :
                                file.customer_rating === 'good' && star >= 2 && star <= 3 ? 'text-yellow-400' :
                                file.customer_rating === 'poor' && star <= 2 ? 'text-red-400' :
                                'text-slate-300 dark:text-slate-600 hover:text-yellow-400'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadFile(file)
                            }}
                            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 transition-colors"
                          >
                            Ladda ner
                          </button>
                          {file.is_image && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openGallery(index)
                              }}
                              className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors"
                            >
                              Visa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Image Gallery Modal */}
      {showGallery && (
        <ImageGallery
          files={filteredFiles}
          onRatingChange={updateFileRating}
          onClose={closeGallery}
          initialIndex={galleryStartIndex}
        />
      )}
    </div>
  )
}
