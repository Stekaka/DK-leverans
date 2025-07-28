'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderIcon, 
  ArrowDownTrayIcon, 
  StarIcon,
  MagnifyingGlassIcon,
  UserIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

interface Customer {
  id: string
  name: string
  project: string
  email: string
}

interface Access {
  hasAccess: boolean
  accessType: string
  expiresAt: string | null
  daysRemaining: number
  isExpired: boolean
  isPermanent: boolean
}

interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size?: number
  created_at: string
  folder_path: string
  rating?: number
  is_favorite?: boolean
  file_url?: string
  thumbnail_url?: string
}

export default function DashboardV3() {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentFolder, setCurrentFolder] = useState('')
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [])

  useEffect(() => {
    if (customer) {
      loadFiles()
    }
  }, [customer, currentFolder])

  const checkAccess = async () => {
    try {
      const response = await fetch('/api/customer/access')
      if (!response.ok) {
        // Istället för att redirecta, visa en enkel login-form
        setLoading(false)
        return
      }
      
      const data = await response.json()
      setCustomer(data.customer)
      setAccess(data.access)
      
      if (!data.access.hasAccess) {
        setLoading(false)
        return
      }
    } catch (error) {
      console.error('Access check failed:', error)
      setLoading(false)
    }
  }

  const loadFiles = async () => {
    try {
      const response = await fetch(`/api/customer/files?folder=${encodeURIComponent(currentFolder)}`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/customer/download?fileId=${fileId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const handleFolderClick = (folderPath: string) => {
    setCurrentFolder(folderPath)
  }

  const handleBackClick = () => {
    const pathParts = currentFolder.split('/').filter(p => p)
    pathParts.pop()
    setCurrentFolder(pathParts.join('/'))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      })
      
      if (response.ok) {
        // Login lyckades, kolla access igen
        await checkAccess()
      } else {
        const error = await response.json()
        alert('Inloggning misslyckades: ' + (error.error || 'Okänt fel'))
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('Inloggning misslyckades: Nätverksfel')
    } finally {
      setLoginLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      router.push('/login')
    }
  }

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const folders = filteredFiles.filter(f => f.type === 'folder')
  const regularFiles = filteredFiles.filter(f => f.type === 'file')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Laddar...</div>
      </div>
    )
  }

  // Visa login-form om ingen kund är inloggad
  if (!customer || !access) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 p-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Dashboard Simplified
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Logga in för att komma åt dina filer
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  E-postadress
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={loginData.email}
                  onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Din e-postadress"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Lösenord
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Ditt lösenord"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loginLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Loggar in...' : 'Logga in'}
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                För test: använd e-post test@example.com och lösenord test123
              </p>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard Simplified
              </h1>
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <UserIcon className="h-4 w-4" />
                <span>{customer?.name}</span>
                <span>•</span>
                <span>{customer?.project}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {access && (
                <div className="hidden sm:flex items-center space-x-2 text-sm">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    access.isPermanent 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : access.hasAccess 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {access.isPermanent ? 'Permanent' : `${access.daysRemaining} dagar kvar`}
                  </div>
                </div>
              )}
              
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        {currentFolder && (
          <div className="mb-6">
            <button
              onClick={handleBackClick}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              ← Tillbaka
            </button>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Mapp: {currentFolder || 'Rot'}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Sök filer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Files Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => handleFolderClick(folder.folder_path + '/' + folder.name)}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer group"
            >
              <div className="flex items-center space-x-3">
                <FolderIcon className="h-8 w-8 text-blue-500 group-hover:text-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {folder.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Mapp
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Files */}
          {regularFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {file.is_favorite && (
                    <StarIcon className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                  {file.rating && file.rating > 0 && (
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={`h-3 w-3 ${
                            i < file.rating!
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {file.thumbnail_url && (
                <div className="mb-3">
                  <img
                    src={file.thumbnail_url}
                    alt={file.name}
                    className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
                  />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Okänd storlek'}
                </p>
                
                <button
                  onClick={() => handleDownload(file.id, file.name)}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  Ladda ner
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Inga filer hittades som matchar din sökning.' : 'Inga filer hittades i denna mapp.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
