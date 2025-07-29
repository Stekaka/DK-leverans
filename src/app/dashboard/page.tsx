'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageGallery from '../../components/ImageGallery'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'
import ThemeToggle from '@/components/ThemeToggle'
import OrganizeModal from '@/components/OrganizeModal'
import AccessPopup from '@/components/AccessPopup'
import { useTheme } from '@/contexts/ThemeContext'
import { CustomerFile, Customer } from '@/types/customer'
import ClientZipCreator, { ProgressCallback } from '@/lib/client-zip'
import ProgressiveDownloader, { ProgressiveDownloadCallback, ProgressiveDownloadProgress } from '@/lib/progressive-downloader'

// Utility function for formatting file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function DashboardPage() {
  const { theme } = useTheme()
  
  const [files, setFiles] = useState<CustomerFile[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [currentFolder, setCurrentFolder] = useState('')
  const [viewType, setViewType] = useState<'all' | 'folder' | 'root' | 'trash'>('all') // Uppdaterad med trash
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'favorite' | 'good' | 'poor' | 'unrated'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showGallery, setShowGallery] = useState(false)
  const [galleryStartIndex, setGalleryStartIndex] = useState(0)
  const [showOrganizeModal, setShowOrganizeModal] = useState(false)
  const [fileToOrganize, setFileToOrganize] = useState<CustomerFile | null>(null)
  const [showAccessPopup, setShowAccessPopup] = useState(false)
  const [accessInfo, setAccessInfo] = useState<{
    type: string
    expiresAt?: string
    daysRemaining: number
    storageUsedGb: number
    storageLimitGb: number
    isPermanent: boolean
    isExpired?: boolean
    canExtend?: boolean
  } | null>(null)
  const [activeDownloads, setActiveDownloads] = useState<Map<string, {
    id: string
    status: string
    progress: number
    totalFiles: number
    processedFiles: number
  }>>(new Map())

  // Client-side ZIP state
  const [isCreatingClientZip, setIsCreatingClientZip] = useState(false)
  const [clientZipProgress, setClientZipProgress] = useState({ 
    current: 0, total: 0, fileName: '', phase: 'downloading' as 'downloading' | 'creating' | 'saving',
    downloadSpeed: '', eta: '', failedFiles: [] as string[]
  })
  const [clientZipCreator, setClientZipCreator] = useState<ClientZipCreator | null>(null)
  const [isDownloadMinimized, setIsDownloadMinimized] = useState(false)
  const [showFailedFilesModal, setShowFailedFilesModal] = useState(false)

  // Progressive Download state
  const [isProgressiveDownloading, setIsProgressiveDownloading] = useState(false)
  const [progressiveDownloadProgress, setProgressiveDownloadProgress] = useState<ProgressiveDownloadProgress>({
    currentFile: 0,
    totalFiles: 0,
    completed: 0, // Alias for backward compatibility
    total: 0, // Alias for backward compatibility
    currentFileName: '',
    downloadSpeed: '',
    eta: '',
    failedFiles: [],
    completedFiles: [],
    phase: 'downloading',
    downloadedBytes: 0,
    totalBytes: 0
  })
  const [progressiveDownloader, setProgressiveDownloader] = useState<ProgressiveDownloader | null>(null)

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

  const loadFiles = async (folderPath?: string, newViewType?: 'all' | 'folder' | 'root' | 'trash') => {
    try {
      setLoading(true)
      
      // Använd provided parametrar eller nuvarande state
      const folder = folderPath !== undefined ? folderPath : currentFolder
      const viewTypeToUse = newViewType !== undefined ? newViewType : viewType
      
      let url: string
      const timestamp = Date.now() // Cache-busting
      if (viewTypeToUse === 'all') {
        // "Alla filer"-vy: visa alla filer oavsett mapp
        url = `/api/customer/files?view=all&t=${timestamp}`
      } else if (viewTypeToUse === 'root') {
        // Root-mapp: bara filer i root
        url = `/api/customer/files?folderPath=&t=${timestamp}`
      } else if (viewTypeToUse === 'trash') {
        // Papperskorg: bara filer i papperskorgen
        url = `/api/customer/files?view=trash&t=${timestamp}`
      } else {
        // Specifik mapp
        url = `/api/customer/files?folderPath=${encodeURIComponent(folder)}&t=${timestamp}`
      }
      
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
        setAccessInfo(data.access || null)
      } else if (response.status === 403) {
        // Access har upphört
        const errorData = await response.json()
        setFiles([])
        setError(errorData.message || 'Åtkomst nekad')
        setAccessInfo({ 
          isExpired: true, 
          canExtend: errorData.canExtend,
          type: 'expired',
          daysRemaining: 0,
          storageUsedGb: 0,
          storageLimitGb: 0,
          isPermanent: false
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Kunde inte ladda ner filer')
        setAccessInfo(null)
      }
    } catch (error) {
      console.error('Error loading files:', error)
      setError('Ett fel uppstod vid laddning av filer')
      setAccessInfo(null)
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
      // Rensa customer session
      await fetch('/api/auth/session', { method: 'DELETE' })
      // Gå till startsidan
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
      // Gå till startsidan även vid fel
      router.push('/')
    }
  }

  // Filter filer baserat på aktuell filter-inställning
  // Observera: Mappfiltrering sker nu på serversidan
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
        link.download = file.name_for_display
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

  // Client-side ZIP creation
  const createClientZip = async (filesToZip: CustomerFile[], zipName: string) => {
    try {
      setIsCreatingClientZip(true)
      setClientZipProgress({ current: 0, total: filesToZip.length, fileName: '', phase: 'downloading', downloadSpeed: '', eta: '', failedFiles: [] })

      // Kontrollera webbläsarstöd
      const browserSupport = ClientZipCreator.checkBrowserSupport()
      if (!browserSupport.supported) {
        alert(`Din webbläsare stöder inte stora ZIP-nedladdningar: ${browserSupport.message}`)
        return false
      }

      if (browserSupport.message) {
        console.warn('Browser support warning:', browserSupport.message)
      }

      // Skapa ZIP creator
      const zipCreator = new ClientZipCreator()
      setClientZipCreator(zipCreator)

      // Progress callback
      const onProgress: ProgressCallback = (progress, current, total, fileName, downloadSpeed, eta, failedFiles) => {
        setClientZipProgress({
          current,
          total,
          fileName: fileName || '',
          phase: progress >= 90 ? (progress >= 98 ? 'saving' : 'creating') : 'downloading',
          downloadSpeed: downloadSpeed || '',
          eta: eta || '',
          failedFiles: failedFiles || []
        })
      }

      // Förbered filer för nedladdning
      const downloadableFiles = filesToZip.map(file => ({
        id: file.id,
        original_name: file.original_name,
        download_url: file.download_url
      }))

      console.log(`🚀 CLIENT-ZIP: Starting creation of ${zipName} with ${filesToZip.length} files`)
      
      // Skapa och ladda ner ZIP
      const success = await zipCreator.createAndDownloadZip(
        downloadableFiles,
        zipName,
        onProgress,
        1, // Minska parallelism till 1 för maximal stabilitet
        customer?.id // Skicka med customer ID för authentication
      )

      if (success) {
        console.log(`✅ CLIENT-ZIP: Successfully created and downloaded ${zipName}`)
        
        // Kontrollera om det finns misslyckade filer
        const failedFiles = zipCreator.getFailedFiles()
        if (failedFiles.length > 0) {
          setShowFailedFilesModal(true)
          console.warn(`⚠️ CLIENT-ZIP: ${failedFiles.length} files failed to download:`, failedFiles)
        }
        
        return true
      } else {
        throw new Error('ZIP creation failed')
      }

    } catch (error) {
      console.error('❌ CLIENT-ZIP: Error creating ZIP:', error)
      alert(`Ett fel uppstod vid skapande av ZIP-fil: ${error instanceof Error ? error.message : 'Okänt fel'}`)
      return false
    } finally {
      setIsCreatingClientZip(false)
      setClientZipCreator(null)
      setClientZipProgress({ current: 0, total: 0, fileName: '', phase: 'downloading', downloadSpeed: '', eta: '', failedFiles: [] })
      setIsDownloadMinimized(false) // Reset minimized state
    }
  }

  // Progressive Download (filer laddas ner en efter en direkt till Downloads)
  const createProgressiveDownload = async (filesToDownload: CustomerFile[]) => {
    try {
      setIsProgressiveDownloading(true)
      setProgressiveDownloadProgress({
        currentFile: 0,
        totalFiles: filesToDownload.length,
        completed: 0,
        total: filesToDownload.length,
        currentFileName: '',
        downloadSpeed: '',
        eta: '',
        failedFiles: [],
        completedFiles: [],
        phase: 'downloading',
        downloadedBytes: 0,
        totalBytes: 0
      })

      // Skapa progressive downloader
      const downloader = new ProgressiveDownloader()
      setProgressiveDownloader(downloader)

      // Progress callback
      const onProgress: ProgressiveDownloadCallback = (progress) => {
        setProgressiveDownloadProgress(progress)
      }

      // Förbered filer för nedladdning
      const downloadableFiles = filesToDownload.map(file => ({
        id: file.id,
        original_name: file.original_name,
        file_size: file.file_size
      }))

      console.log(`🚀 PROGRESSIVE-DOWNLOAD: Starting download of ${filesToDownload.length} files`)
      
      // Starta progressive nedladdning
      const result = await downloader.downloadFiles(
        downloadableFiles,
        onProgress,
        customer?.id
      )

      if (result.success) {
        console.log(`✅ PROGRESSIVE-DOWNLOAD: Completed ${result.completed}/${filesToDownload.length} files`)
        
        if (result.failed > 0) {
          alert(`${result.completed} filer laddades ner framgångsrikt.\n${result.failed} filer misslyckades.`)
        } else {
          alert(`Alla ${result.completed} filer laddades ner framgångsrikt!`)
        }
        
        return true
      } else {
        throw new Error('Progressive download failed')
      }

    } catch (error) {
      console.error('❌ PROGRESSIVE-DOWNLOAD: Error:', error)
      alert(`Ett fel uppstod vid nedladdning: ${error instanceof Error ? error.message : 'Okänt fel'}`)
      return false
    } finally {
      setIsProgressiveDownloading(false)
      setProgressiveDownloader(null)
      setProgressiveDownloadProgress({
        currentFile: 0,
        totalFiles: 0,
        completed: 0,
        total: 0,
        currentFileName: '',
        downloadSpeed: '',
        eta: '',
        failedFiles: [],
        completedFiles: [],
        phase: 'completed',
        downloadedBytes: 0,
        totalBytes: 0
      })
    }
  }

  // Avbryt progressive download
  const cancelProgressiveDownload = () => {
    if (progressiveDownloader) {
      progressiveDownloader.abort()
      setIsProgressiveDownloading(false)
      setProgressiveDownloader(null)
      setProgressiveDownloadProgress({
        currentFile: 0,
        totalFiles: 0,
        completed: 0,
        total: 0,
        currentFileName: '',
        downloadSpeed: '',
        eta: '',
        failedFiles: [],
        completedFiles: [],
        phase: 'cancelled',
        downloadedBytes: 0,
        totalBytes: 0
      })
    }
  }

  // Avbryt client-side ZIP creation
  const cancelClientZip = () => {
    if (clientZipCreator) {
      clientZipCreator.abort()
      setIsCreatingClientZip(false)
      setClientZipCreator(null)
      setClientZipProgress({ current: 0, total: 0, fileName: '', phase: 'downloading', downloadSpeed: '', eta: '', failedFiles: [] })
      setIsDownloadMinimized(false) // Reset minimized state
    }
  }

  const downloadSelected = async () => {
    // Förhindra parallella nedladdningar
    if (isCreatingClientZip || isProgressiveDownloading) {
      alert('En nedladdning pågår redan. Vänta tills den är klar.')
      return
    }

    const selectedFiles = filteredFiles.filter(file => selectedItems.includes(file.id))
    
    if (selectedFiles.length === 0) {
      alert('Inga filer valda för nedladdning')
      return
    }

    if (selectedFiles.length === 1) {
      await downloadFile(selectedFiles[0])
      return
    }

    // Beräkna total storlek
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.file_size, 0)
    const totalSizeGB = totalSize / (1024 * 1024 * 1024)
    
    console.log(`Download request: ${selectedFiles.length} files, ${totalSizeGB.toFixed(1)} GB`)

    // Ge användaren val mellan ZIP och Progressive nedladdning
    const downloadChoice = confirm(
      `Välj nedladdningsmetod för ${selectedFiles.length} filer (${totalSizeGB.toFixed(1)} GB):\n\n` +
      `🔄 KLICKA OK för SEPARATA FILER (rekommenderas)\n` +
      `   → Filerna laddas ner direkt en efter en\n` +
      `   → Ingen väntetid, filerna sparas direkt\n` +
      `   → Mer tillförlitligt för stora nedladdningar\n\n` +
      `❌ KLICKA AVBRYT för ZIP-FIL\n` +
      `   → Alla filer i en enda ZIP-fil\n` +
      `   → Kräver mer minne och kan ta längre tid`
    )
    
    if (downloadChoice) {
      // Progressive download
      await createProgressiveDownload(selectedFiles)
      if (progressiveDownloadProgress.phase === 'completed') {
        setSelectedItems([]) // Rensa val efter framgångsrik nedladdning
      }
    } else {
      // ZIP download
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')
      const zipFileName = `valda_filer_${timestamp}.zip`
      const success = await createClientZip(selectedFiles, zipFileName)
      if (success) {
        setSelectedItems([]) // Rensa val efter framgångsrik nedladdning
      }
    }
  }

  // 🎯 Funktion för att försöka använda förbyggd ZIP
  const tryDownloadPrebuiltZip = async (): Promise<{ success: boolean; reason?: string }> => {
    try {
      console.log('🔍 Checking prebuilt ZIP availability...')
      
      if (!customer?.id) {
        return { success: false, reason: 'No customer ID' }
      }

      // Kontrollera om förbyggd ZIP finns
      const checkResponse = await fetch(`/api/admin/prebuilt-zip?customerId=${customer.id}`)
      
      if (!checkResponse.ok) {
        return { success: false, reason: 'Failed to check ZIP status' }
      }

      const checkResult = await checkResponse.json()
      
      if (!checkResult.exists) {
        return { success: false, reason: 'No prebuilt ZIP exists' }
      }

      if (checkResult.expired) {
        return { success: false, reason: 'Prebuilt ZIP has expired' }
      }

      const metadata = checkResult.metadata
      
      // Fråga användaren om de vill använda den förbyggda ZIP:en
      const usePrebuilt = confirm(
        `🎉 SNABBNEDLADDNING TILLGÄNGLIG!\n\n` +
        `En färdig ZIP-fil med alla dina ${metadata.file_count} filer finns redan klar.\n` +
        `ZIP-storlek: ${(metadata.zip_size / 1024 / 1024).toFixed(1)} MB\n` +
        `Skapad: ${new Date(metadata.built_at).toLocaleString('sv-SE')}\n\n` +
        `🚀 KLICKA OK för OMEDELBAR NEDLADDNING\n` +
        `   → ZIP-filen börjar ladda ner direkt\n` +
        `   → Ingen väntetid eller bearbetning\n` +
        `   → Alla filer inkluderade med mappstruktur\n\n` +
        `❌ KLICKA AVBRYT för att välja annan metod`
      )

      if (!usePrebuilt) {
        return { success: false, reason: 'User declined prebuilt ZIP' }
      }

      // Ladda ner den förbyggda ZIP:en
      console.log('🚀 Downloading prebuilt ZIP...')
      
      const zipUrl = `/api/customer/download/prebuilt?customerId=${customer.id}`
      const link = document.createElement('a')
      link.href = zipUrl
      link.download = `${customer.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'customer'}_complete_archive.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      return { success: true }

    } catch (error) {
      console.error('❌ Error checking prebuilt ZIP:', error)
      return { success: false, reason: 'Error checking ZIP' }
    }
  }

  const downloadAll = async () => {
    // Förhindra parallella nedladdningar
    if (isCreatingClientZip || isProgressiveDownloading) {
      alert('En nedladdning pågår redan. Vänta tills den är klar.')
      return
    }

    if (filteredFiles.length === 0) {
      alert('Inga filer att ladda ner')
      return
    }

    if (filteredFiles.length === 1) {
      await downloadFile(filteredFiles[0])
      return
    }

    // Beräkna total storlek
    const totalSize = filteredFiles.reduce((sum, file) => sum + file.file_size, 0)
    const totalSizeGB = totalSize / (1024 * 1024 * 1024)
    
    console.log(`Download ALL request: ${filteredFiles.length} files, ${totalSizeGB.toFixed(1)} GB`)

    // 🎯 SMART LOGIK: Försök använda förbyggd ZIP först (endast för "alla filer")
    if (viewType === 'all' && currentFolder === '') {
      console.log('🔍 Checking for prebuilt ZIP for all files...')
      
      const prebuiltResult = await tryDownloadPrebuiltZip()
      if (prebuiltResult.success) {
        console.log('✅ Used prebuilt ZIP successfully')
        return
      } else {
        console.log('⚠️ Prebuilt ZIP not available:', prebuiltResult.reason)
      }
    }

    // Ge användaren val mellan ZIP och Progressive nedladdning
    const downloadChoice = confirm(
      `Välj nedladdningsmetod för ALLA ${filteredFiles.length} filer (${totalSizeGB.toFixed(1)} GB):\n\n` +
      `🔄 KLICKA OK för SEPARATA FILER (rekommenderas för stora nedladdningar)\n` +
      `   → Filerna laddas ner direkt en efter en till Downloads-mappen\n` +
      `   → Ingen väntetid, filerna sparas direkt när de är klara\n` +
      `   → Mer tillförlitligt och snabbare för stora mängder data\n` +
      `   → Mindre minnesanvändning\n\n` +
      `❌ KLICKA AVBRYT för EN ZIP-FIL\n` +
      `   → Alla filer packas i en enda ZIP-fil\n` +
      `   → Kräver mer minne och längre väntetid\n` +
      `   → Kan misslyckas vid mycket stora nedladdningar`
    )
    
    if (downloadChoice) {
      // Progressive download
      await createProgressiveDownload(filteredFiles)
    } else {
      // ZIP download
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')
      const zipFileName = `alla_filer_${timestamp}.zip`
      await createClientZip(filteredFiles, zipFileName)
    }
  }

  // Hantera mappnavigering
  const navigateToFolder = async (folderPath: string, newViewType?: 'all' | 'folder' | 'root' | 'trash') => {
    setCurrentFolder(folderPath)
    setSelectedItems([])
    
    let viewTypeToSet: 'all' | 'folder' | 'root' | 'trash'
    if (newViewType) {
      viewTypeToSet = newViewType
    } else if (folderPath === '' && viewType === 'all') {
      viewTypeToSet = 'all'
    } else if (folderPath === '') {
      viewTypeToSet = 'root'
    } else {
      viewTypeToSet = 'folder'
    }
    
    setViewType(viewTypeToSet)
    await loadFiles(folderPath, viewTypeToSet)
  }

  const navigateUp = async () => {
    if (currentFolder) {
      const parentPath = currentFolder.split('/').slice(0, -1).join('/')
      await navigateToFolder(parentPath)
    }
  }

  // Hantera rating-uppdateringar
  const updateFileRating = async (fileId: string, rating: string, notes?: string) => {
    // Optimistisk uppdatering - uppdatera UI direkt
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              customer_rating: rating as 'unrated' | 'favorite' | 'good' | 'poor',
              customer_notes: notes || file.customer_notes
            }
          : file
      )
    )

    try {
      const response = await fetch('/api/customer/rating', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, rating, notes }),
      })

      if (!response.ok) {
        // Om API-anropet misslyckas, återställ till föregående tillstånd
        const error = await response.json()
        console.error('Rating update failed:', error)
        
        // Ladda om filerna för att återställa korrekt state
        await loadFiles()
        alert('Kunde inte uppdatera betyg: ' + error.error)
      }
    } catch (error) {
      console.error('Error updating rating:', error)
      
      // Ladda om filerna för att återställa korrekt state
      await loadFiles()
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

  // Async download status tracking
  const checkDownloadStatus = async (downloadId: string) => {
    try {
      const response = await fetch(`/api/customer/download/status/${downloadId}`)
      
      if (response.ok) {
        const status = await response.json()
        
        setActiveDownloads(prev => new Map(prev.set(downloadId, {
          id: downloadId,
          status: status.status,
          progress: status.progress,
          totalFiles: status.totalFiles,
          processedFiles: status.processedFiles
        })))

        if (status.status === 'completed' && status.downloadUrl) {
          // Auto-download when ready
          const link = document.createElement('a')
          link.href = status.downloadUrl
          link.style.display = 'none'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          
          // Remove from active downloads after 5 seconds
          setTimeout(() => {
            setActiveDownloads(prev => {
              const newMap = new Map(prev)
              newMap.delete(downloadId)
              return newMap
            })
          }, 5000)
          
          alert(`ZIP-fil med ${status.totalFiles} filer har laddats ner!`)
        } else if (status.status === 'failed') {
          alert(`ZIP-skapandet misslyckades: ${status.error || 'Okänt fel'}`)
          setActiveDownloads(prev => {
            const newMap = new Map(prev)
            newMap.delete(downloadId)
            return newMap
          })
        } else if (status.status === 'preparing' || status.status === 'processing') {
          // Continue polling
          setTimeout(() => checkDownloadStatus(downloadId), 2000)
        }
      } else {
        console.error('Failed to check download status')
      }
    } catch (error) {
      console.error('Error checking download status:', error)
    }
  }

  // Öppna organiseringsmodal
  const openOrganizeModal = (file: CustomerFile) => {
    setFileToOrganize(file)
    setShowOrganizeModal(true)
  }

  // Stäng organiseringsmodal
  const closeOrganizeModal = () => {
    setShowOrganizeModal(false)
    setFileToOrganize(null)
  }

  // Spara filorganisation
  const saveFileOrganization = async (fileId: string, displayName: string, customerFolderPath: string) => {
    // Optimistisk uppdatering - uppdatera UI direkt
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              display_name: displayName,
              name_for_display: displayName,
              customer_folder_path: customerFolderPath,
              folder_display: customerFolderPath || '/'
            }
          : file
      )
    )

    // Uppdatera mapplistan om en ny mapp skapades
    if (customerFolderPath && !folders.includes(customerFolderPath)) {
      setFolders(prev => [...prev, customerFolderPath].sort())
    }

    try {
      const response = await fetch('/api/customer/organize', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          displayName,
          customerFolderPath
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Om API-anropet misslyckas, ladda om filerna för att återställa korrekt state
        await loadFiles()
        throw new Error(errorData.error || 'Kunde inte spara ändringar')
      }

    } catch (error) {
      console.error('Error saving file organization:', error)
      throw error
    }
  }

  // Hantera papperskorg-åtgärder
  const handleTrashAction = async (fileId: string, action: 'trash' | 'restore' | 'delete_forever') => {
    try {
      console.log('Starting trash action:', { fileId, action, currentViewType: viewType })
      
      // Hitta filen först för debug
      const targetFile = files.find(f => f.id === fileId)
      if (targetFile) {
        console.log('Target file before action:', { 
          id: targetFile.id, 
          name: targetFile.name_for_display, 
          is_trashed: targetFile.is_trashed 
        })
      }
      
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
      console.log('Trash API response:', { status: response.status, result })

      if (response.ok) {
        console.log('Trash action success:', result.message)
        
        // Ladda om filer efter framgångsrik operation för att säkerställa korrekt state
        console.log('Reloading files after trash action...')
        await loadFiles(currentFolder, viewType)
        
        // Visa framgångsmeddelande
        alert(result.message)
      } else {
        console.error('Trash action failed:', result)
        alert('Fel: ' + result.error)
      }
    } catch (error) {
      console.error('Error with trash action:', error)
      alert('Ett fel uppstod vid hantering av filen')
    }
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
    <div className={`min-h-screen transition-colors ${
      theme === 'dark' 
        ? 'dark bg-slate-900 text-white' 
        : 'bg-slate-50 text-gray-900'
    }`}>
      {/* Header */}
      <header className={`pt-20 pb-4 border-b-2 transition-colors ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-600'
          : 'bg-white border-yellow-200'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center space-x-3">
                <DrönarkompanietLogo size="sm" />
                <div>
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Leveransportal</span>
                  <div className="text-xs text-slate-500 dark:text-slate-500">{customer?.name}</div>
                </div>
              </div>
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
              {/* Admin-länk borttagen från kundportal */}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <DrönarkompanietLogo size="md" />
              </Link>
              <div className="border-l border-gray-300 dark:border-slate-600 pl-4">
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Leveransportal</span>
                <div className="text-xs text-slate-500 dark:text-slate-500">{customer?.project}</div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">{customer?.name}</span>
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

        {/* Minimized Download Widget */}
        {isCreatingClientZip && (
          <div className="fixed top-4 right-4 z-50 max-w-xs w-full">
            <div className={`rounded-xl shadow-2xl border backdrop-blur-sm transition-all duration-300 ${
              theme === 'dark'
                ? 'bg-slate-800/95 border-slate-700'
                : 'bg-white/95 border-gray-200'
            } ${isDownloadMinimized ? 'transform scale-95' : ''}`}>
              
              {isDownloadMinimized ? (
                /* Minimized View */
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        ZIP ({clientZipProgress.total > 0 ? Math.round((clientZipProgress.current / clientZipProgress.total) * 100) : 0}%)
                      </span>
                      {clientZipProgress.downloadSpeed && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {clientZipProgress.downloadSpeed}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setIsDownloadMinimized(false)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Expandera"
                      >
                        <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                      <button
                        onClick={cancelClientZip}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Avbryt"
                      >
                        <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Mini progress bar */}
                  <div className={`w-full h-1 rounded-full overflow-hidden mt-2 ${
                    theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
                  }`}>
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300"
                      style={{ 
                        width: `${clientZipProgress.total > 0 ? Math.round((clientZipProgress.current / clientZipProgress.total) * 100) : 0}%` 
                      }}
                    ></div>
                  </div>
                  {/* ETA in minimized view */}
                  {clientZipProgress.eta && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                      {clientZipProgress.eta} kvar
                    </div>
                  )}
                </div>
              ) : (
                /* Expanded View */
                <div className="p-4">
                  {/* Header with minimize/close */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        ZIP Download
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setIsDownloadMinimized(true)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Minimera"
                      >
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <button
                        onClick={cancelClientZip}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Avbryt nedladdning"
                      >
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className={`w-full h-2 rounded-full overflow-hidden ${
                      theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
                    }`}>
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300 ease-out"
                        style={{ 
                          width: `${clientZipProgress.total > 0 ? Math.round((clientZipProgress.current / clientZipProgress.total) * 100) : 0}%` 
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        {clientZipProgress.total > 0 ? Math.round((clientZipProgress.current / clientZipProgress.total) * 100) : 0}%
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {clientZipProgress.current} / {clientZipProgress.total}
                      </span>
                    </div>
                    {/* Speed and ETA row */}
                    {(clientZipProgress.downloadSpeed || clientZipProgress.eta) && (
                      <div className="flex justify-between items-center mt-1">
                        {clientZipProgress.downloadSpeed && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            ⚡ {clientZipProgress.downloadSpeed}
                          </span>
                        )}
                        {clientZipProgress.eta && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            ⏱️ {clientZipProgress.eta} kvar
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                    {clientZipProgress.phase === 'downloading' && (
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Laddar ner filer...</span>
                      </div>
                    )}
                    {clientZipProgress.phase === 'creating' && (
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Skapar ZIP-fil...</span>
                      </div>
                    )}
                    {clientZipProgress.phase === 'saving' && (
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                        </svg>
                        <span>Sparar fil...</span>
                      </div>
                    )}
                  </div>

                  {/* Failed files indicator */}
                  {clientZipProgress.failedFiles && clientZipProgress.failedFiles.length > 0 && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 mb-2">
                      ⚠️ {clientZipProgress.failedFiles.length} filer misslyckades
                    </div>
                  )}

                  {/* Current file (truncated) */}
                  {clientZipProgress.fileName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={clientZipProgress.fileName}>
                      {clientZipProgress.fileName}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progressive Download Progress Widget */}
        {isProgressiveDownloading && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-lg rounded-xl shadow-2xl p-6 ${
              theme === 'dark' 
                ? 'bg-gray-800 border border-gray-700' 
                : 'bg-white border border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full 
                               flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>Laddar ner filer</span>
              </h3>

              <div className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                      Nedladdning pågår...
                    </span>
                    <span className={`font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                      {progressiveDownloadProgress.completed}/{progressiveDownloadProgress.total}
                    </span>
                  </div>
                  
                  <div className={`w-full h-2 rounded-full overflow-hidden ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                      style={{ 
                        width: `${progressiveDownloadProgress.total > 0 
                          ? (progressiveDownloadProgress.completed / progressiveDownloadProgress.total) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                      {progressiveDownloadProgress.total > 0 
                        ? Math.round((progressiveDownloadProgress.completed / progressiveDownloadProgress.total) * 100) 
                        : 0}%
                    </span>
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                      {formatFileSize(progressiveDownloadProgress.downloadedBytes || 0)} / {formatFileSize(progressiveDownloadProgress.totalBytes || 0)}
                    </span>
                  </div>
                </div>

                {/* Failed files indicator */}
                {progressiveDownloadProgress.failedFiles && progressiveDownloadProgress.failedFiles.length > 0 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mb-2">
                    ⚠️ {progressiveDownloadProgress.failedFiles.length} filer misslyckades
                  </div>
                )}

                {/* Current file (truncated) */}
                {progressiveDownloadProgress.currentFileName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={progressiveDownloadProgress.currentFileName}>
                    {progressiveDownloadProgress.currentFileName}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={cancelProgressiveDownload}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
            ) : accessInfo.daysRemaining <= 7 && !accessInfo.isPermanent ? (
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
            ) : accessInfo.isPermanent ? (
              <div className={`rounded-xl p-4 sm:p-6 shadow-sm ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/50'
                  : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
              }`}>
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl 
                                  flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-2 ${
                      theme === 'dark' ? 'text-green-200' : 'text-green-800'
                    }`}>
                      Permanent Access Aktiv
                    </h3>
                    <div className={`text-sm space-y-1 ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}>
                      <p>Du har permanent åtkomst till dina filer!</p>
                      <p>Lagring: {accessInfo.storageUsedGb?.toFixed(1) || 0} GB av {accessInfo.storageLimitGb} GB använt</p>
                      {accessInfo.expiresAt && (
                        <p>Förnyelse: {new Date(accessInfo.expiresAt).toLocaleDateString('sv-SE')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`rounded-lg p-3 sm:p-4 shadow-sm ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-700/50'
                  : 'bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg 
                                    flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-blue-200' : 'text-blue-800'
                      }`}>
                        Dina filer är tillgängliga i {accessInfo.daysRemaining} dag{accessInfo.daysRemaining !== 1 ? 'ar' : ''} till. Vill du ha längre tid?
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAccessPopup(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors text-xs font-medium whitespace-nowrap ml-3"
                  >
                    Förläng
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                  {filteredFiles.length > 100 ? 'Stor nedladdning - automatisk uppdelning' : 'Smart ZIP-nedladdning aktiverad'}
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                  {filteredFiles.length > 100 ? (
                    <>Med {filteredFiles.length} filer kommer nedladdningen automatiskt att delas upp i {Math.ceil(filteredFiles.length / 100)} separata ZIP-filer (max 100 filer per ZIP). Detta förbättrar prestanda och tillförlitlighet.</>
                  ) : filteredFiles.length > 10 ? 
                    `Med ${filteredFiles.length} filer kommer de automatiskt att zippas för enklare nedladdning.` :
                    `Med ${formattedTotalSize} kommer filerna automatiskt att zippas för snabbare nedladdning.`
                  }
                  {" "}ZIP aktiveras automatiskt för {'>'}{filteredFiles.length > 100 ? '10' : '10'} filer eller {'>'}5GB total storlek.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700' 
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            }`}>{totalFiles}</div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Totala filer</div>
          </div>
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700' 
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            }`}>{totalImages}</div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Bilder</div>
          </div>
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700' 
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            }`}>{totalVideos}</div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Videor</div>
          </div>
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700' 
              : 'bg-white border-yellow-50'
          }`}>
            <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
              theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
            }`}>{formattedTotalSize}</div>
            <div className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Total storlek</div>
          </div>
        </div>

        {/* Folder Navigation */}
        {folders.length > 0 && (
          <div className="mb-6">
            <div className={`rounded-xl shadow-lg p-4 sm:p-6 border transition-colors ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center space-x-3 mb-4">
                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>Mappar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigateToFolder('', 'all')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    viewType === 'all' 
                      ? 'bg-yellow-600 text-white shadow-md' 
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Alla filer
                </button>
                <button
                  onClick={() => navigateToFolder('', 'root')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    viewType === 'root' 
                      ? 'bg-yellow-600 text-white shadow-md' 
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Root
                </button>
                {folders.map(folder => (
                  <button
                    key={folder}
                    onClick={() => navigateToFolder(folder, 'folder')}
                    className={`px-3 py-2 rounded-lg text-sm truncate max-w-48 transition-colors ${
                      currentFolder === folder && viewType === 'folder'
                        ? 'bg-yellow-600 text-white shadow-md' 
                        : theme === 'dark'
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={folder}
                  >
                    {folder}
                  </button>
                ))}
                <button
                  onClick={() => navigateToFolder('', 'trash')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${
                    viewType === 'trash' 
                      ? 'bg-red-600 text-white shadow-md' 
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Papperskorg</span>
                </button>
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
          <div className={`rounded-xl shadow-lg p-4 sm:p-6 border transition-colors space-y-4 ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-100'
          }`}>
            {/* Filter Row */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>Filtyp:</span>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === 'all' 
                      ? 'bg-yellow-600 text-white shadow-md' 
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Alla ({totalFiles})
                </button>
                <button
                  onClick={() => setFilter('images')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === 'images' 
                      ? 'bg-green-600 text-white shadow-md' 
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Bilder ({totalImages})
                </button>
                <button
                  onClick={() => setFilter('videos')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === 'videos' 
                      ? 'bg-purple-600 text-white shadow-md' 
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Videor ({totalVideos})
                </button>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>Betyg:</span>
                <button
                  onClick={() => setFilter('favorite')}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center space-x-1 transition-colors ${
                    filter === 'favorite' 
                      ? 'bg-yellow-500 text-white shadow-md' 
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                      : theme === 'dark'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>Visningsläge:</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-yellow-600 text-white shadow-md' 
                        : theme === 'dark'
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                        : theme === 'dark'
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          <div className={`rounded-xl shadow-lg p-8 sm:p-12 text-center border transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-100'
          }`}>
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
                className={`group rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all 
                           cursor-pointer border ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-gray-100'
                } ${
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
                      file.thumbnail_url || file.download_url ? (
                        <img
                          src={file.thumbnail_url || file.download_url || '/placeholder-image.png'}
                          alt={file.name_for_display}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to download_url if thumbnail fails
                            const target = e.target as HTMLImageElement
                            if (target.src === file.thumbnail_url && file.download_url) {
                              target.src = file.download_url
                            }
                          }}
                        />
                      ) : (
                        <div className="text-center p-4">
                          <svg className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block">Tryck för att visa</span>
                        </div>
                      )
                    ) : file.is_video ? (
                      <div className="relative w-full h-full">
                        {file.thumbnail_url ? (
                          <img
                            src={file.thumbnail_url}
                            alt={file.name_for_display}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <svg className="w-12 h-12 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {/* Video overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                          <div className="bg-white dark:bg-gray-100 bg-opacity-90 dark:bg-opacity-90 rounded-full p-3">
                            <svg className="w-8 h-8 text-slate-800 dark:text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 5v10l8-5-8-5z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                          VIDEO
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <svg className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block">Tryck för att ladda ner</span>
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

                  {/* Comment indicator with expanding banner */}
                  {file.customer_notes && file.customer_notes.trim() !== '' && (
                    <div className="absolute top-2 left-2 group/comment z-10">
                      {/* Comment icon */}
                      <div className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg hover:bg-blue-600 transition-colors duration-200 relative z-20">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      
                      {/* Expanding comment banner */}
                      <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-3 py-2 rounded-lg shadow-xl 
                                    opacity-0 group-hover/comment:opacity-100 transform scale-95 group-hover/comment:scale-100
                                    transition-all duration-200 ease-out whitespace-nowrap max-w-xs z-10
                                    origin-left overflow-hidden">
                        <div className="flex items-center space-x-2">
                          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                          </svg>
                          <span className="truncate" style={{ maxWidth: '200px' }}>
                            {file.customer_notes}
                          </span>
                        </div>
                        {/* Arrow pointing to the icon */}
                        <div className="absolute left-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 
                                      border-l-transparent border-r-transparent border-t-blue-500"></div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate mb-2" title={file.name_for_display}>
                      {file.name_for_display}
                    </h3>
                  
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-3">
                    <span>{file.formatted_size}</span>
                    <span>{new Date(file.uploaded_at).toLocaleDateString('sv-SE')}</span>
                  </div>
                  
                  {/* Rating with specific icons */}
                  <div className="flex items-center justify-center mb-3">
                    {file.customer_rating === 'favorite' ? (
                      <div className="flex items-center space-x-1 text-yellow-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-xs text-yellow-600 dark:text-yellow-400">Favorit</span>
                      </div>
                    ) : file.customer_rating === 'good' ? (
                      <div className="flex items-center space-x-1 text-green-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-green-600 dark:text-green-400">Bra</span>
                      </div>
                    ) : file.customer_rating === 'poor' ? (
                      <div className="flex items-center space-x-1 text-red-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-red-600 dark:text-red-400">Mindre bra</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Ej betygsatt</span>
                      </div>
                    )}
                  </div>

                  {/* Quick rating buttons */}
                  <div className="flex justify-center space-x-1 mb-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateFileRating(file.id, 'poor')
                      }}
                      className={`p-2 rounded transition-colors touch-manipulation ${
                        file.customer_rating === 'poor' 
                          ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' 
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                      title="Mindre bra"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateFileRating(file.id, 'good')
                      }}
                      className={`p-2 rounded transition-colors touch-manipulation ${
                        file.customer_rating === 'good' 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' 
                          : 'text-gray-400 hover:text-green-500'
                      }`}
                      title="Bra"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateFileRating(file.id, 'favorite')
                      }}
                      className={`p-2 rounded transition-colors touch-manipulation ${
                        file.customer_rating === 'favorite' 
                          ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400' 
                          : 'text-gray-400 hover:text-yellow-500'
                      }`}
                      title="Favorit"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateFileRating(file.id, 'unrated')
                      }}
                      className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Ta bort betyg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
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
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openOrganizeModal(file)
                      }}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 
                                 text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors"
                      title="Organisera fil"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    {viewType === 'trash' ? (
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTrashAction(file.id, 'restore')
                          }}
                          className="px-3 py-2 bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 
                                     text-green-700 dark:text-green-300 rounded-lg text-sm transition-colors"
                          title="Återställ fil"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Är du säker på att du vill radera denna fil permanent? Denna åtgärd kan inte ångras.')) {
                              handleTrashAction(file.id, 'delete_forever')
                            }
                          }}
                          className="px-3 py-2 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 
                                     text-red-700 dark:text-red-300 rounded-lg text-sm transition-colors"
                          title="Radera permanent"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('Grid: Clicking trash on file:', { id: file.id, name: file.name_for_display })
                          handleTrashAction(file.id, 'trash')
                        }}
                        className="px-3 py-2 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 
                                   text-red-700 dark:text-red-300 rounded-lg text-sm transition-colors"
                        title="Flytta till papperskorg"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    
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
          <div className={`rounded-xl shadow-lg overflow-hidden border transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-100'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead className={`border-b ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <tr>
                    <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Fil
                    </th>
                    <th className={`hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Storlek
                    </th>
                    <th className={`hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Datum
                    </th>
                    <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Betyg
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Åtgärder
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  theme === 'dark'
                    ? 'bg-slate-800 divide-slate-700'
                    : 'bg-white divide-slate-200'
                }`}>
                  {filteredFiles.map((file, index) => (
                    <tr 
                      key={file.id} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${
                        selectedItems.includes(file.id) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                      }`}
                      onClick={() => toggleSelection(file.id)}
                    >
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 mr-2 sm:mr-3">
                            {file.is_image ? (
                              file.thumbnail_url || file.download_url ? (
                                <img
                                  src={file.thumbnail_url || file.download_url || '/placeholder-image.png'}
                                  alt={file.name_for_display}
                                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover border border-gray-200 dark:border-slate-600"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    if (target.src === file.thumbnail_url && file.download_url) {
                                      target.src = file.download_url
                                    }
                                  }}
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )
                            ) : file.is_video ? (
                              file.thumbnail_url ? (
                                <div className="relative h-12 w-12 rounded-lg overflow-hidden">
                                  <img
                                    src={file.thumbnail_url}
                                    alt={file.name_for_display}
                                    className="h-12 w-12 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M8 5v10l8-5-8-5z"/>
                                    </svg>
                                  </div>
                                </div>
                              ) : (
                                <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                  <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <svg className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-32 sm:max-w-xs" title={file.name_for_display}>
                                {file.name_for_display}
                              </div>
                              {/* Comment indicator in list view */}
                              {file.customer_notes && file.customer_notes.trim() !== '' && (
                                <div 
                                  className="text-blue-500 hover:text-blue-600 transition-colors"
                                  title={`Kommentar: ${file.customer_notes}`}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {file.file_type.split('/')[1]?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        {file.formatted_size}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {new Date(file.uploaded_at).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {file.customer_rating === 'favorite' ? (
                            <div className="flex items-center space-x-1 text-yellow-500">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-xs">Favorit</span>
                            </div>
                          ) : file.customer_rating === 'good' ? (
                            <div className="flex items-center space-x-1 text-green-500">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs">Bra</span>
                          </div>
                          ) : file.customer_rating === 'poor' ? (
                            <div className="flex items-center space-x-1 text-red-500">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs">Mindre bra</span>
                          </div>
                          ) : (
                            <div className="flex items-center space-x-1 text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs">Ej betygsatt</span>
                          </div>
                          )}
                          
                          {/* Quick rating buttons for list view */}
                          <div className="flex space-x-1 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateFileRating(file.id, 'poor')
                              }}
                              className={`p-1.5 rounded transition-colors touch-manipulation ${
                                file.customer_rating === 'poor' 
                                  ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' 
                                  : 'text-gray-400 hover:text-red-500'
                              }`}
                              title="Mindre bra"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateFileRating(file.id, 'good')
                              }}
                              className={`p-1.5 rounded transition-colors touch-manipulation ${
                                file.customer_rating === 'good' 
                                  ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' 
                                  : 'text-gray-400 hover:text-green-500'
                              }`}
                              title="Bra"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="sr-only">Bra</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateFileRating(file.id, 'favorite')
                              }}
                              className={`p-1.5 rounded transition-colors touch-manipulation ${
                                file.customer_rating === 'favorite' 
                                  ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400' 
                                  : 'text-gray-400 hover:text-yellow-500'
                              }`}
                              title="Favorit"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="sr-only">Favorit</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateFileRating(file.id, 'unrated')
                              }}
                              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              title="Ta bort betyg"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-1 sm:space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadFile(file)
                            }}
                            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 transition-colors text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">Ladda ner</span>
                            <span className="sm:hidden">⬇️</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openOrganizeModal(file)
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors text-xs sm:text-sm"
                            title="Organisera fil"
                          >
                            <span className="hidden sm:inline">Organisera</span>
                            <span className="sm:hidden">📁</span>
                          </button>
                          {viewType === 'trash' ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTrashAction(file.id, 'restore')
                                }}
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors text-xs sm:text-sm"
                                title="Återställ fil"
                              >
                                <span className="hidden sm:inline">Återställ</span>
                                <span className="sm:hidden">↩️</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm('Är du säker på att du vill radera denna fil permanent? Denna åtgärd kan inte ångras.')) {
                                    handleTrashAction(file.id, 'delete_forever')
                                  }
                                }}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors text-xs sm:text-sm"
                                title="Radera permanent"
                              >
                                <span className="hidden sm:inline">Radera</span>
                                <span className="sm:hidden">🗑️</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                console.log('List: Clicking trash on file:', { id: file.id, name: file.name_for_display })
                                handleTrashAction(file.id, 'trash')
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors text-xs sm:text-sm"
                              title="Flytta till papperskorg"
                            >
                              <span className="hidden sm:inline">Papperskorg</span>
                              <span className="sm:hidden">🗑️</span>
                            </button>
                          )}
                          {file.is_image && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openGallery(index)
                              }}
                              className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors text-xs sm:text-sm"
                            >
                              <span className="hidden sm:inline">Visa</span>
                              <span className="sm:hidden">👁️</span>
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

      {/* Organize Modal */}
      {showOrganizeModal && fileToOrganize && (
        <OrganizeModal
          file={fileToOrganize}
          isOpen={showOrganizeModal}
          onClose={closeOrganizeModal}
          onSave={saveFileOrganization}
        />
      )}

      {/* Failed Files Modal */}
      {showFailedFilesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`relative p-6 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 ${
            theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'
          }`}>
            <h3 className="text-lg font-semibold mb-4 text-yellow-600">
              ⚠️ Vissa filer kunde inte laddas ner
            </h3>
            
            <div className="mb-4">
              <p className="text-sm mb-2">
                ZIP-filen skapades framgångsrikt, men följande filer kunde inte inkluderas:
              </p>
              
              <div className="max-h-32 overflow-y-auto border rounded p-2 text-xs">
                {clientZipProgress.failedFiles.map((fileName, index) => (
                  <div key={index} className="py-1 border-b last:border-b-0">
                    {fileName}
                  </div>
                ))}
              </div>
              
              <p className="text-xs mt-2 text-gray-500">
                {clientZipProgress.failedFiles.length} av {clientZipProgress.total} filer misslyckades
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowFailedFilesModal(false)}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Popup */}
      <AccessPopup
        isOpen={showAccessPopup}
        onClose={() => setShowAccessPopup(false)}
        daysRemaining={accessInfo?.daysRemaining}
        isPermanent={accessInfo?.isPermanent}
      />
    </div>
  )
}
