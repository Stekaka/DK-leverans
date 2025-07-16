'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageGallery from '../../components/ImageGallery'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'

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

  // Ladda filer när mapp ändras
  useEffect(() => {
    if (customer) {
      loadFiles(currentFolder)
    }
  }, [currentFolder, customer])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const result = await response.json()
        setCustomer(result.customer)
        await loadFolders()
        await loadFiles('')
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Session check failed:', error)
      router.push('/login')
    }
  }

  const loadFiles = async (folderPath: string = '') => {
    try {
      setLoading(true)
      const params = folderPath ? `?folderPath=${encodeURIComponent(folderPath)}` : ''
      const response = await fetch(`/api/customer/files${params}`)
      
      if (response.ok) {
        const result = await response.json()
        setFiles(result.files || [])
        if (result.customer && !customer) {
          setCustomer(result.customer)
        }
      } else if (response.status === 401) {
        router.push('/login')
      } else {
        setError('Kunde inte ladda filer')
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
      // Använd vår nedladdnings-API som returnerar filen direkt
      const response = await fetch(`/api/customer/download?fileId=${file.id}`)
      
      if (response.ok) {
        const blob = await response.blob()
        
        // Skapa en nedladdningslänk med ett unikt namn
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.original_name
        link.style.display = 'none'
        
        // Lägg till länken i DOM, klicka och ta bort
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Rensa upp blob URL
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
      // Enstaka fil - använd vanlig nedladdning
      await downloadFile(selectedFiles[0])
    } else {
      // Flera filer - använd batch API med automatisk ZIP
      try {
        const response = await fetch('/api/customer/download/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileIds: selectedFiles.map(f => f.id)
          })
        })

        if (response.ok) {
          const blob = await response.blob()
          
          // Hämta filnamn från Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition')
          const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `selected_files_${new Date().getTime()}.zip`
          
          // Skapa nedladdningslänk
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          link.style.display = 'none'
          
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          
          // Rensa val efter lyckad nedladdning
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
      // Enstaka fil - använd vanlig nedladdning
      await downloadFile(filteredFiles[0])
    } else {
      // Flera filer - använd batch API med automatisk ZIP
      try {
        const response = await fetch('/api/customer/download/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileIds: filteredFiles.map(f => f.id)
          })
        })

        if (response.ok) {
          const blob = await response.blob()
          
          // Hämta filnamn från Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition')
          const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `all_files_${new Date().getTime()}.zip`
          
          // Skapa nedladdningslänk
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId, rating, notes }),
      })

      if (response.ok) {
        // Uppdatera lokalt state
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-200 border-t-yellow-600 mx-auto mb-6"></div>
          <p className="text-slate-600 text-lg">Laddar dina filer...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-drone-cloud to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
          >
            Försök igen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Advanced Header */}
      <header className="relative bg-gradient-to-r from-slate-900 via-yellow-900 to-slate-900 shadow-tech border-b border-yellow-500/20 overflow-hidden">
        {/* Tech background */}
        <div className="absolute inset-0 bg-tech-grid opacity-10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-24 bg-gradient-to-r from-yellow-500/10 to-yellow-400/10 blur-2xl"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-20 bg-gradient-to-l from-yellow-500/15 to-yellow-600/15 blur-xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-6">
              <DrönarkompanietLogo variant="full" size="md" className="text-white" />
              <div className="flex items-center space-x-4">
                <div className="w-0.5 h-12 bg-gradient-to-b from-transparent via-yellow-400/60 to-transparent"></div>
                <div className="backdrop-blur-sm bg-white/10 rounded-xl px-6 py-3 border border-white/20">
                  <span className="text-white font-medium">
                    {customer?.name}
                  </span>
                  <div className="text-yellow-300 text-sm font-medium">
                    {customer?.project}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={downloadAll}
                disabled={filteredFiles.length === 0}
                className="group relative bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white px-6 py-3 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-glow-sm hover:shadow-glow-md border border-yellow-400/50"
              >
                {filteredFiles.length > 1 ? (
                  <>
                    <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Ladda ner alla som ZIP ({filteredFiles.length})</span>
                  </>
                ) : (
                  <span>Ladda ner ({filteredFiles.length})</span>
                )}
              </button>
                <button 
                  onClick={logout}
                  className="group relative text-white/70 hover:text-white transition-all duration-300 p-3 rounded-xl hover:bg-white/10 border border-white/20 hover:border-white/30"
                  title="Logga ut"
                >
                  <svg className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content with Tech Styling */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Smart ZIP Info */}
          {(filteredFiles.length > 10 || formattedTotalSize.includes('GB')) && (
            <div className="relative mb-6 backdrop-blur-sm bg-gradient-to-r from-yellow-500/20 to-yellow-500/20 rounded-2xl p-6 border border-yellow-400/30 shadow-tech overflow-hidden">
              {/* Tech background */}
              <div className="absolute inset-0 bg-tech-circuit opacity-5"></div>
              <div className="relative flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-glow-sm">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-yellow-100 bg-clip-text text-transparent">Smart ZIP-nedladdning aktiverad</h3>
                  <p className="text-yellow-100">
                    {filteredFiles.length > 10 ? 
                      `Med ${filteredFiles.length} filer kommer de automatiskt att zippas för enklare nedladdning.` :
                      `Med ${formattedTotalSize} kommer filerna automatiskt att zippas för snabbare nedladdning.`
                    }
                    {" "}ZIP aktiveras automatiskt för {'>'}10 filer eller {'>'}5GB total storlek.
                  </p>
                </div>
                {/* Tech accent */}
                <div className="w-1 h-16 bg-gradient-to-b from-yellow-400 to-yellow-500 rounded-full opacity-60"></div>
              </div>
            </div>
          )}

          {/* Mappnavigering */}
          {folders.length > 0 && (
            <div className="mb-6">
              <div className="backdrop-blur-sm bg-white/10 rounded-2xl shadow-tech p-6 border border-white/20 relative overflow-hidden">
                {/* Tech background */}
                <div className="absolute inset-0 bg-tech-grid opacity-5"></div>
                <div className="relative flex items-center space-x-3 mb-4">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Mappar:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigateToFolder('')}
                  className={`px-3 py-1 rounded text-sm ${
                    currentFolder === '' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Alla filer
                </button>
                {folders.map(folder => (
                  <button
                    key={folder}
                    onClick={() => navigateToFolder(folder)}
                    className={`px-3 py-1 rounded text-sm ${
                      currentFolder === folder ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {folder || 'Root'}
                  </button>
                ))}
              </div>
              {currentFolder && (
                <button
                  onClick={navigateUp}
                  className="mt-2 text-yellow-600 hover:text-yellow-800 text-sm"
                >
                  ← Tillbaka
                </button>
              )}
            </div>
          </div>
        )}

        {/* Statistik */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{totalFiles}</div>
                <div className="text-sm text-gray-600">Totala filer</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{totalImages}</div>
                <div className="text-sm text-gray-600">Bilder</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{totalVideos}</div>
                <div className="text-sm text-gray-600">Videor</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{formattedTotalSize}</div>
                <div className="text-sm text-gray-600">Total storlek</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Filter:</span>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded text-sm ${filter === 'all' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Alla ({totalFiles})
                </button>
                <button
                  onClick={() => setFilter('images')}
                  className={`px-3 py-1 rounded text-sm ${filter === 'images' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Bilder ({totalImages})
                </button>
                <button
                  onClick={() => setFilter('videos')}
                  className={`px-3 py-1 rounded text-sm ${filter === 'videos' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Videor ({totalVideos})
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Betyg:</span>
                <button
                  onClick={() => setFilter('favorite')}
                  className={`px-3 py-1 rounded text-sm flex items-center space-x-1 ${filter === 'favorite' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>({totalFavorites})</span>
                </button>
                <button
                  onClick={() => setFilter('good')}
                  className={`px-3 py-1 rounded text-sm flex items-center space-x-1 ${filter === 'good' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>({totalGood})</span>
                </button>
                <button
                  onClick={() => setFilter('poor')}
                  className={`px-3 py-1 rounded text-sm flex items-center space-x-1 ${filter === 'poor' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>({totalPoor})</span>
                </button>
                <button
                  onClick={() => setFilter('unrated')}
                  className={`px-3 py-1 rounded text-sm ${filter === 'unrated' ? 'bg-gray-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Ej betygsatt ({totalUnrated})
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {selectedItems.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{selectedItems.length} valda</span>
                  <button
                    onClick={downloadSelected}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center space-x-1"
                  >
                    {selectedItems.length > 1 ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span>Ladda ner ZIP</span>
                      </>
                    ) : (
                      <span>Ladda ner</span>
                    )}
                  </button>
                  {selectedItems.length > 1 && (
                    <span className="text-xs text-gray-500">
                      (Auto-ZIP för flera filer)
                    </span>
                  )}
                  <button
                    onClick={clearSelection}
                    className="text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Rensa
                  </button>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={selectAll}
                  disabled={filteredFiles.length === 0}
                  className="text-yellow-600 hover:text-yellow-800 text-sm disabled:opacity-50"
                >
                  Välj alla
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filvisning */}
        {filteredFiles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inga filer hittades</h3>
            <p className="text-gray-600">
              {currentFolder ? `Mappen "${currentFolder}" är tom.` : 'Du har inga filer än.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFiles.map((file, index) => (
              <div
                key={file.id}
                className={`bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                  selectedItems.includes(file.id) ? 'ring-2 ring-yellow-500' : ''
                }`}
                onClick={() => toggleSelection(file.id)}
              >
                <div className="relative">
                  <div 
                    className="aspect-video bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
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
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-gray-500 mt-1 block">Klicka för att visa</span>
                        </div>
                      )
                    ) : (
                      <div className="text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-500 mt-1 block">Klicka för att öppna</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute top-2 right-2">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedItems.includes(file.id) 
                        ? 'bg-yellow-600 border-yellow-600' 
                        : 'bg-white border-gray-300'
                    }`}>
                      {selectedItems.includes(file.id) && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Rating Badge */}
                  {file.customer_rating !== 'unrated' && (
                    <div className="absolute top-2 left-2">
                      <div className={`p-1 rounded-full ${
                        file.customer_rating === 'favorite' ? 'bg-yellow-500' :
                        file.customer_rating === 'good' ? 'bg-green-500' :
                        'bg-red-500'
                      }`}>
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          {file.customer_rating === 'favorite' ? (
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          ) : file.customer_rating === 'good' ? (
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          ) : (
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          )}
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadFile(file)
                      }}
                      className="bg-black bg-opacity-50 text-white p-1 rounded hover:bg-opacity-70"
                      title="Ladda ner"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadFile(file)
                      }}
                      className="bg-black bg-opacity-50 text-white p-1 rounded hover:bg-opacity-70"
                      title="Ladda ner"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm truncate" title={file.original_name}>
                    {file.original_name}
                  </h3>
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>{file.formatted_size}</span>
                    <span>{new Date(file.uploaded_at).toLocaleDateString('sv-SE')}</span>
                  </div>
                  {file.folder_path && (
                    <div className="mt-1 text-xs text-yellow-600 truncate">
                      📁 {file.folder_display}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List view
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Namn
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Storlek
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mapp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Åtgärder
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedItems.includes(file.id) ? 'bg-yellow-50' : ''
                    }`}
                    onClick={() => toggleSelection(file.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center ${
                          selectedItems.includes(file.id) 
                            ? 'bg-yellow-600 border-yellow-600' 
                            : 'border-gray-300'
                        }`}>
                          {selectedItems.includes(file.id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900" title={file.original_name}>
                          {file.original_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        file.is_image ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {file.is_image ? 'Bild' : 'Video'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.formatted_size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(file.uploaded_at).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.folder_display || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadFile(file)
                        }}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Ladda ner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
