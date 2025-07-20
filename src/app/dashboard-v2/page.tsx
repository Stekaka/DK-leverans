'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'
import ThemeToggle from '@/components/ThemeToggle'
import AccessPopup from '@/components/AccessPopup'
import ImageGallery from '@/components/ImageGallery'
import OrganizeModal from '@/components/OrganizeModal'
import { useTheme } from '@/contexts/ThemeContext'
import { CustomerFile, Customer } from '@/types/customer'
import {
  FolderIcon,
  TrashIcon,
  StarIcon,
  VideoCameraIcon,
  DocumentIcon,
  PhotoIcon,
  EyeIcon,
  PencilIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowPathIcon,
  CheckIcon,
  HandThumbUpIcon,
  HandThumbDownIcon
} from '@heroicons/react/24/outline'

export default function CustomerDashboardV2() {
  const { theme } = useTheme()
  const router = useRouter()
  
  // Core state
  const [files, setFiles] = useState<CustomerFile[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Active tab and view state
  const [activeTab, setActiveTab] = useState('files')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [viewType, setViewType] = useState<'all' | 'folder' | 'root' | 'trash'>('all')
  const [currentFolder, setCurrentFolder] = useState('')
  
  // Filter and search state
  const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'favorite' | 'good' | 'poor' | 'unrated'>('all')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  
  // Modal and UI state
  const [showAccessPopup, setShowAccessPopup] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryStartIndex, setGalleryStartIndex] = useState(0)
  const [fileToOrganize, setFileToOrganize] = useState<CustomerFile | null>(null)
  const [showOrganizeModal, setShowOrganizeModal] = useState(false)
  
  // Access information
  const [accessInfo, setAccessInfo] = useState<{
    type: string
    expiresAt?: string
    daysRemaining: number
    storageUsedGb?: number
    storageLimitGb?: number
    isPermanent: boolean
    hasAccess: boolean
    isExpired?: boolean
  } | null>(null)

  // Load files function
  const loadFiles = async (folderPath?: string, newViewType?: 'all' | 'folder' | 'root' | 'trash') => {
    try {
      setLoading(true)
      setError(null)
      
      // Använd provided parametrar eller nuvarande state
      const folder = folderPath !== undefined ? folderPath : currentFolder
      const viewTypeToUse = newViewType !== undefined ? newViewType : viewType
      
      let url: string
      const timestamp = Date.now() // Cache-busting
      if (viewTypeToUse === 'all') {
        url = `/api/customer/files?view=all&t=${timestamp}`
      } else if (viewTypeToUse === 'root') {
        url = `/api/customer/files?folderPath=&t=${timestamp}`
      } else if (viewTypeToUse === 'trash') {
        url = `/api/customer/files?view=trash&t=${timestamp}`
      } else {
        url = `/api/customer/files?folderPath=${encodeURIComponent(folder)}&t=${timestamp}`
      }
      
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
        setCustomer(data.customer || null)
        setAccessInfo(data.access || null)
      } else if (response.status === 401) {
        router.push('/login')
        return
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Kunde inte ladda filer')
        setAccessInfo({ 
          isExpired: true, 
          hasAccess: false, 
          isPermanent: false, 
          daysRemaining: 0,
          type: 'expired'
        })
      }
    } catch (error) {
      console.error('Error loading files:', error)
      setError('Ett fel uppstod vid laddning av filer')
      setAccessInfo(null)
    } finally {
      setLoading(false)
    }
  }

  // Navigation function
  const navigateToFolder = async (folderPath: string, newViewType?: 'all' | 'folder' | 'root' | 'trash') => {
    setCurrentFolder(folderPath)
    
    let viewTypeToSet: 'all' | 'folder' | 'root' | 'trash'
    if (newViewType) {
      viewTypeToSet = newViewType
    } else if (folderPath === '' && viewType !== 'trash') {
      viewTypeToSet = 'root'
    } else if (viewType === 'trash') {
      viewTypeToSet = 'trash'
    } else {
      viewTypeToSet = 'folder'
    }
    
    setViewType(viewTypeToSet)
    await loadFiles(folderPath, viewTypeToSet)
  }

  // Logout function
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
      router.push('/')
    }
  }

  // Gallery functions
  const openGallery = (startIndex: number) => {
    setGalleryStartIndex(startIndex)
    setShowGallery(true)
  }

  // Get computed data
  const folders = Array.from(new Set(files
    .map(file => file.customer_folder_path || file.folder_path)
    .filter(path => path && path !== '')
  )).sort()

  const filteredFiles = files.filter(file => {
    if (filter === 'images') return file.is_image
    if (filter === 'videos') return file.is_video
    if (filter === 'favorite') return file.customer_rating === 'favorite'
    if (filter === 'good') return file.customer_rating === 'good'
    if (filter === 'poor') return file.customer_rating === 'poor'
    return true
  })

  const totalFiles = files.length
  const totalImages = files.filter(f => f.is_image).length
  const totalVideos = files.filter(f => f.is_video).length
  const totalFavorites = files.filter(f => f.customer_rating === 'favorite').length
  const totalGood = files.filter(f => f.customer_rating === 'good').length

  // Load data on mount
  useEffect(() => {
    checkSession()
  }, [])

  // Check session and load initial data
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

  // Trash action handler
  const handleTrashAction = async (fileId: string, action: 'trash' | 'restore' | 'delete_forever') => {
    try {
      console.log('Starting trash action:', { fileId, action, currentViewType: viewType })
      
      const response = await fetch('/api/customer/trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          action
        })
      })

      const result = await response.json()

      if (response.ok) {
        console.log('Trash action success:', result.message)
        await loadFiles(currentFolder, viewType)
        // Don't show alert in clean design
      } else {
        console.error('Trash action failed:', result)
        alert('Fel: ' + result.error)
      }
    } catch (error) {
      console.error('Error with trash action:', error)
      alert('Ett fel uppstod vid hantering av filen')
    }
  }

  return (
    <div className={`min-h-screen transition-colors ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-slate-900 to-slate-800' 
        : 'bg-gradient-to-br from-slate-50 to-yellow-50'
    }`}>
      {/* Header - Same as admin design */}
      <header className={`shadow-sm border-b transition-colors ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-700'
          : 'bg-white border-yellow-50'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center space-x-3">
                <DrönarkompanietLogo size="sm" />
                <div>
                  <span className={`text-xs font-medium ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>Leveransportal</span>
                  <div className={`text-xs ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                  }`}>{customer?.name}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                <button 
                  onClick={logout}
                  className={`text-sm transition-colors ${
                    theme === 'dark' 
                      ? 'text-slate-400 hover:text-yellow-400' 
                      : 'text-slate-600 hover:text-yellow-700'
                  }`}
                >
                  Logga ut
                </button>
              </div>
            </div>
            <div className="pb-3">
              <div className="flex items-center space-x-2">
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>Projekt: {customer?.project}</span>
                <span className={`${
                  theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
                }`}>•</span>
                <Link href="/dashboard" className={`text-xs transition-colors ${
                  theme === 'dark' 
                    ? 'text-yellow-400 hover:text-yellow-300' 
                    : 'text-yellow-600 hover:text-yellow-700'
                }`}>
                  Till gamla portalen
                </Link>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <DrönarkompanietLogo size="md" />
              </Link>
              <div className={`border-l pl-4 ${
                theme === 'dark' ? 'border-slate-600' : 'border-gray-300'
              }`}>
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>Leveransportal</span>
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                }`}>{customer?.name} - {customer?.project}</div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className={`text-sm transition-colors ${
                theme === 'dark' 
                  ? 'text-yellow-400 hover:text-yellow-300' 
                  : 'text-yellow-600 hover:text-yellow-700'
              }`}>
                Till gamla portalen
              </Link>
              <ThemeToggle />
              <button 
                onClick={logout}
                className={`text-sm transition-colors ${
                  theme === 'dark' 
                    ? 'text-slate-400 hover:text-yellow-400' 
                    : 'text-slate-600 hover:text-yellow-700'
                }`}
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Access Status Banner */}
        {accessInfo && (
          <div className="mb-6">
            {accessInfo.isExpired ? (
              <div className={`rounded-lg p-3 sm:p-4 shadow-sm ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-red-900/20 to-red-800/20 border border-red-700/50'
                  : 'bg-gradient-to-r from-red-50 to-red-100 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg 
                                    flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-red-200' : 'text-red-800'
                      }`}>
                        <span className="font-semibold">Åtkomst upphörd.</span> Se alternativen för att återfå åtkomst till dina filer.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <button
                      onClick={() => setShowAccessPopup(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md transition-colors text-xs font-medium whitespace-nowrap"
                    >
                      Förläng
                    </button>
                  </div>
                </div>
              </div>
            ) : !accessInfo.isPermanent && accessInfo.daysRemaining <= 7 ? (
              <div className={`rounded-lg p-3 sm:p-4 shadow-sm ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-700/50'
                  : 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg 
                                    flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-orange-200' : 'text-orange-800'
                      }`}>
                        <span className="font-semibold">Upphör snart!</span> Dina filer är tillgängliga i {accessInfo.daysRemaining} dag{accessInfo.daysRemaining !== 1 ? 'ar' : ''} till.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <button
                      onClick={() => setShowAccessPopup(true)}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md transition-colors text-xs font-medium whitespace-nowrap"
                    >
                      Förläng
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6">
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'
            }`}>
              {loading ? '...' : totalFiles}
            </div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Totalt filer</div>
          </div>
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            }`}>
              {loading ? '...' : totalImages}
            </div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Bilder</div>
          </div>
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            }`}>
              {loading ? '...' : totalVideos}
            </div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Videor</div>
          </div>
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            }`}>
              {loading ? '...' : totalFavorites}
            </div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Favoriter</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`border-b mb-6 transition-colors ${
          theme === 'dark' ? 'border-slate-600' : 'border-gray-200'
        }`}>
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => {
                setActiveTab('files')
                if (viewType === 'trash') {
                  setViewType('all')
                  loadFiles('', 'all')
                }
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'files'
                  ? theme === 'dark'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-yellow-600 text-yellow-600'
                  : theme === 'dark'
                    ? 'border-transparent text-slate-400 hover:text-yellow-300 hover:border-slate-500'
                    : 'border-transparent text-slate-600 hover:text-yellow-700 hover:border-yellow-50'
              }`}
            >
              Mina filer ({totalFiles})
            </button>
            <button
              onClick={() => {
                setActiveTab('favorites')
                if (viewType === 'trash') {
                  setViewType('all')
                  loadFiles('', 'all')
                }
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'favorites'
                  ? theme === 'dark'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-yellow-600 text-yellow-600'
                  : theme === 'dark'
                    ? 'border-transparent text-slate-400 hover:text-yellow-300 hover:border-slate-500'
                    : 'border-transparent text-slate-600 hover:text-yellow-700 hover:border-yellow-50'
              }`}
            >
              Favoriter ({totalFavorites})
            </button>
            <button
              onClick={() => {
                setActiveTab('trash')
                setViewType('trash')
                loadFiles('', 'trash')
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'trash'
                  ? theme === 'dark'
                    ? 'border-red-400 text-red-400'
                    : 'border-red-600 text-red-600'
                  : theme === 'dark'
                    ? 'border-transparent text-slate-400 hover:text-red-300 hover:border-slate-500'
                    : 'border-transparent text-slate-600 hover:text-red-700 hover:border-red-50'
              }`}
            >
              Papperskorg
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            </div>
          ) : error ? (
            <div className={`text-center py-12 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <p>Det uppstod ett fel: {error}</p>
            </div>
          ) : activeTab === 'files' ? (
            <FilesContent />
          ) : activeTab === 'favorites' ? (
            <FavoritesContent />
          ) : activeTab === 'trash' ? (
            <TrashContent />
          ) : null}
        </div>
      </div>

      {/* Modals */}
      {showAccessPopup && (
        <AccessPopup 
          isOpen={showAccessPopup}
          onClose={() => setShowAccessPopup(false)}
        />
      )}

      {showGallery && (
        <ImageGallery
          files={filteredFiles}
          initialIndex={galleryStartIndex}
          onClose={() => setShowGallery(false)}
          onRatingChange={updateRating}
        />
      )}

      {showOrganizeModal && fileToOrganize && (
        <OrganizeModal
          isOpen={showOrganizeModal}
          file={fileToOrganize}
          onClose={() => {
            setShowOrganizeModal(false)
            setFileToOrganize(null)
          }}
          onSave={handleOrganizeFile}
        />
      )}
    </div>
  )

  // Update rating function
  async function updateRating(fileId: string, rating: string) {
    try {
      const response = await fetch('/api/customer/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, rating })
      })

      if (response.ok) {
        setFiles(prevFiles =>
          prevFiles.map(file =>
            file.id === fileId ? { ...file, customer_rating: rating as 'unrated' | 'favorite' | 'good' | 'poor' } : file
          )
        )
      }
    } catch (error) {
      console.error('Error updating rating:', error)
    }
  }

  // Handle file organization
  async function handleOrganizeFile(fileId: string, displayName: string, customerFolderPath: string) {
    try {
      const response = await fetch('/api/customer/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, displayName, customerFolderPath })
      })

      if (response.ok) {
        await loadFiles(currentFolder, viewType)
      } else {
        const error = await response.json()
        alert('Fel vid organisering: ' + error.error)
      }
    } catch (error) {
      console.error('Error organizing file:', error)
      alert('Ett fel uppstod vid organisering')
    }
  }

  // Files Content Component
  function FilesContent() {
    const displayFiles = filteredFiles.filter(file => !file.is_trashed)

    return (
      <div className="space-y-4">
        {/* Navigation and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateToFolder('', 'all')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  viewType === 'all'
                    ? theme === 'dark'
                      ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alla filer
              </button>
              <button
                onClick={() => navigateToFolder('', 'root')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  viewType === 'root'
                    ? theme === 'dark'
                      ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4" />
                  Root
                </div>
              </button>
            </div>

            {/* Folder navigation */}
            {folders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {folders.map(folder => (
                  <button
                    key={folder}
                    onClick={() => navigateToFolder(folder, 'folder')}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      currentFolder === folder && viewType === 'folder'
                        ? theme === 'dark'
                          ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                          : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        : theme === 'dark'
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FolderIcon className="w-4 h-4" />
                      {folder}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode and Filter */}
          <div className="flex items-center gap-3">
            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600 text-slate-300'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              <option value="all">Alla filer</option>
              <option value="images">Bilder</option>
              <option value="videos">Videor</option>
              <option value="favorite">Favoriter</option>
              <option value="good">Bra</option>
              <option value="poor">Mindre bra</option>
              <option value="unrated">Ej betygsatta</option>
            </select>

            {/* View Mode */}
            <div className={`flex rounded-md border ${
              theme === 'dark' ? 'border-slate-600' : 'border-gray-300'
            }`}>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-sm rounded-l-md transition-colors ${
                  viewMode === 'grid'
                    ? theme === 'dark'
                      ? 'bg-yellow-900/50 text-yellow-400'
                      : 'bg-yellow-100 text-yellow-800'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  Grid
                </div>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm rounded-r-md transition-colors ${
                  viewMode === 'list'
                    ? theme === 'dark'
                      ? 'bg-yellow-900/50 text-yellow-400'
                      : 'bg-yellow-100 text-yellow-800'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ListBulletIcon className="w-4 h-4" />
                  Lista
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* File Display */}
        {displayFiles.length === 0 ? (
          <div className={`text-center py-12 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <p>Inga filer hittades för aktuell vy</p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView files={displayFiles} />
        ) : (
          <ListView files={displayFiles} />
        )}
      </div>
    )
  }

  // Favorites Content Component
  function FavoritesContent() {
    const favoriteFiles = files.filter(file => file.customer_rating === 'favorite' && !file.is_trashed)

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className={`text-lg font-medium ${
            theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
          }`}>
            Dina favoriter ({favoriteFiles.length})
          </h3>
          
          {/* View Mode */}
          <div className={`flex rounded-md border ${
            theme === 'dark' ? 'border-slate-600' : 'border-gray-300'
          }`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm rounded-l-md transition-colors ${
                viewMode === 'grid'
                  ? theme === 'dark'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-yellow-100 text-yellow-800'
                  : theme === 'dark'
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Squares2X2Icon className="w-4 h-4" />
                Grid
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm rounded-r-md transition-colors ${
                viewMode === 'list'
                  ? theme === 'dark'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-yellow-100 text-yellow-800'
                  : theme === 'dark'
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <ListBulletIcon className="w-4 h-4" />
                Lista
              </div>
            </button>
          </div>
        </div>

        {favoriteFiles.length === 0 ? (
          <div className={`text-center py-12 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <p>Du har inga favoriter än. Markera filer som favoriter för att se dem här!</p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView files={favoriteFiles} />
        ) : (
          <ListView files={favoriteFiles} />
        )}
      </div>
    )
  }

  // Trash Content Component
  function TrashContent() {
    const trashedFiles = files.filter(file => file.is_trashed)

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className={`text-lg font-medium ${
            theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
          }`}>
            Papperskorg ({trashedFiles.length})
          </h3>
          
          {/* View Mode */}
          <div className={`flex rounded-md border ${
            theme === 'dark' ? 'border-slate-600' : 'border-gray-300'
          }`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm rounded-l-md transition-colors ${
                viewMode === 'grid'
                  ? theme === 'dark'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-yellow-100 text-yellow-800'
                  : theme === 'dark'
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Squares2X2Icon className="w-4 h-4" />
                Grid
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm rounded-r-md transition-colors ${
                viewMode === 'list'
                  ? theme === 'dark'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-yellow-100 text-yellow-800'
                  : theme === 'dark'
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <ListBulletIcon className="w-4 h-4" />
                Lista
              </div>
            </button>
          </div>
        </div>

        {trashedFiles.length === 0 ? (
          <div className={`text-center py-12 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <p>Papperskorgen är tom</p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView files={trashedFiles} isTrash={true} />
        ) : (
          <ListView files={trashedFiles} isTrash={true} />
        )}
      </div>
    )
  }

  // Grid View Component
  function GridView({ files, isTrash = false }: { files: CustomerFile[], isTrash?: boolean }) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {files.map((file, index) => (
          <div key={file.id} className={`group relative rounded-lg overflow-hidden shadow-lg border transition-all duration-200 hover:shadow-xl ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
            {/* Image/Video Preview */}
            <div 
              className="aspect-square bg-gray-100 dark:bg-slate-700 cursor-pointer"
              onClick={() => !isTrash && openGallery(index)}
            >
              {file.thumbnail_url ? (
                <img
                  src={file.thumbnail_url}
                  alt={file.display_name || file.name_for_display}
                  className="w-full h-full object-cover"
                />
              ) : file.is_image ? (
                <img
                  src={file.download_url || ''}
                  alt={file.display_name || file.name_for_display}
                  className="w-full h-full object-cover"
                />
              ) : file.is_video ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-slate-600">
                  <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 5v10l7-5-7-5z"/>
                  </svg>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-slate-600">
                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                  </svg>
                </div>
              )}

              {/* Video indicator */}
              {file.is_video && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 5v10l7-5-7-5z"/>
                  </svg>
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="p-3">
              <h3 className={`text-sm font-medium truncate ${
                theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
              }`}>
                {file.display_name || file.name_for_display}
              </h3>
              
              {/* Rating and Actions */}
              <div className="flex items-center justify-between mt-2">
                {!isTrash ? (
                  <>
                    {/* Rating buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => updateRating(file.id, file.customer_rating === 'favorite' ? '' : 'favorite')}
                        className={`p-1 rounded transition-colors ${
                          file.customer_rating === 'favorite'
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:text-yellow-400'
                              : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        <StarIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateRating(file.id, file.customer_rating === 'good' ? '' : 'good')}
                        className={`p-1 rounded transition-colors ${
                          file.customer_rating === 'good'
                            ? 'text-green-500 hover:text-green-600'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:text-green-400'
                              : 'text-gray-400 hover:text-green-500'
                        }`}
                      >
                        <HandThumbUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateRating(file.id, file.customer_rating === 'poor' ? '' : 'poor')}
                        className={`p-1 rounded transition-colors ${
                          file.customer_rating === 'poor'
                            ? 'text-red-500 hover:text-red-600'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:text-red-400'
                              : 'text-gray-400 hover:text-red-500'
                        }`}
                      >
                        <HandThumbDownIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setFileToOrganize(file)
                          setShowOrganizeModal(true)
                        }}
                        className={`p-1 rounded transition-colors ${
                          theme === 'dark'
                            ? 'text-slate-400 hover:text-blue-400'
                            : 'text-gray-400 hover:text-blue-500'
                        }`}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTrashAction(file.id, 'trash')}
                        className={`p-1 rounded transition-colors ${
                          theme === 'dark'
                            ? 'text-slate-400 hover:text-red-400'
                            : 'text-gray-400 hover:text-red-500'
                        }`}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleTrashAction(file.id, 'restore')}
                      className={`p-1 rounded transition-colors ${
                        theme === 'dark'
                          ? 'text-slate-400 hover:text-green-400'
                          : 'text-gray-400 hover:text-green-500'
                      }`}
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Är du säker på att du vill ta bort filen permanent? Detta kan inte ångras.')) {
                          handleTrashAction(file.id, 'delete_forever')
                        }
                      }}
                      className={`p-1 rounded transition-colors ${
                        theme === 'dark'
                          ? 'text-slate-400 hover:text-red-400'
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // List View Component
  function ListView({ files, isTrash = false }: { files: CustomerFile[], isTrash?: boolean }) {
    return (
      <div className={`overflow-hidden rounded-lg border ${
        theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
      }`}>
        <div className={`${
          theme === 'dark' ? 'bg-slate-800' : 'bg-white'
        }`}>
          {files.map((file, index) => (
            <div key={file.id} className={`flex items-center p-4 border-b hover:bg-opacity-50 transition-colors ${
              theme === 'dark'
                ? 'border-slate-700 hover:bg-slate-700'
                : 'border-gray-100 hover:bg-gray-50'
            }`}>
              {/* Thumbnail */}
              <div 
                className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => !isTrash && openGallery(index)}
              >
                {file.thumbnail_url ? (
                  <img
                    src={file.thumbnail_url}
                    alt={file.display_name || file.name_for_display}
                    className="w-full h-full object-cover"
                  />
                ) : file.is_image ? (
                  <img
                    src={file.download_url || ''}
                    alt={file.display_name || file.name_for_display}
                    className="w-full h-full object-cover"
                  />
                ) : file.is_video ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-slate-600">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 5v10l7-5-7-5z"/>
                    </svg>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-slate-600">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="ml-4 flex-1 min-w-0">
                <h3 className={`text-sm font-medium truncate ${
                  theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {file.display_name || file.name_for_display}
                </h3>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {file.is_image ? 'Bild' : file.is_video ? 'Video' : 'Fil'} • {(file.file_size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>

              {/* Rating and Actions */}
              <div className="flex items-center space-x-2 ml-4">
                {!isTrash ? (
                  <>
                    {/* Rating buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => updateRating(file.id, file.customer_rating === 'favorite' ? '' : 'favorite')}
                        className={`p-1.5 rounded transition-colors ${
                          file.customer_rating === 'favorite'
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:text-yellow-400'
                              : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        <StarIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateRating(file.id, file.customer_rating === 'good' ? '' : 'good')}
                        className={`p-1.5 rounded transition-colors ${
                          file.customer_rating === 'good'
                            ? 'text-green-500 hover:text-green-600'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:text-green-400'
                              : 'text-gray-400 hover:text-green-500'
                        }`}
                      >
                        <HandThumbUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateRating(file.id, file.customer_rating === 'poor' ? '' : 'poor')}
                        className={`p-1.5 rounded transition-colors ${
                          file.customer_rating === 'poor'
                            ? 'text-red-500 hover:text-red-600'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:text-red-400'
                              : 'text-gray-400 hover:text-red-500'
                        }`}
                      >
                        <HandThumbDownIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setFileToOrganize(file)
                          setShowOrganizeModal(true)
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          theme === 'dark'
                            ? 'text-slate-400 hover:text-blue-400'
                            : 'text-gray-400 hover:text-blue-500'
                        }`}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTrashAction(file.id, 'trash')}
                        className={`p-1.5 rounded transition-colors ${
                          theme === 'dark'
                            ? 'text-slate-400 hover:text-red-400'
                            : 'text-gray-400 hover:text-red-500'
                        }`}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleTrashAction(file.id, 'restore')}
                      className={`p-1.5 rounded transition-colors ${
                        theme === 'dark'
                          ? 'text-slate-400 hover:text-green-400'
                          : 'text-gray-400 hover:text-green-500'
                      }`}
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Är du säker på att du vill ta bort filen permanent? Detta kan inte ångras.')) {
                          handleTrashAction(file.id, 'delete_forever')
                        }
                      }}
                      className={`p-1.5 rounded transition-colors ${
                        theme === 'dark'
                          ? 'text-slate-400 hover:text-red-400'
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
}
