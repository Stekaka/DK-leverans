'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'
import { customerService, fileService, utils } from '../../../../lib/database'
import { generatePassword, generateSimplePassword, generateCustomerPassword } from '../../../../lib/password-generator'
import type { Customer } from '../../../../lib/supabase'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('customers')
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [showFileManager, setShowFileManager] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [fileStats, setFileStats] = useState({ totalFiles: 0, totalSize: 0, customerFileCounts: {} as { [key: string]: number } })
  const [loading, setLoading] = useState(true)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    project: '',
    password: ''
  })
  const [isCreating, setIsCreating] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [folderPath, setFolderPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [customerFiles, setCustomerFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [allFolders, setAllFolders] = useState<string[]>(['']) // Include root folder

  // Ladda data när komponenten mountas
  useEffect(() => {
    loadData()
  }, [])

  // Ladda filer när folderPath ändras
  useEffect(() => {
    if (selectedCustomer && showFileManager) {
      loadCustomerFiles(selectedCustomer.id, folderPath)
    }
  }, [folderPath, selectedCustomer, showFileManager])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await customerService.getAllCustomers()
      setCustomers(data.customers)
      setFileStats(data.fileStats)
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Fel vid laddning av data. Kontrollera Supabase-anslutningen.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    
    try {
      // Skapa kund via API
      const result = await customerService.createCustomer({
        name: newCustomer.name,
        email: newCustomer.email,
        project: newCustomer.project,
        password: newCustomer.password
      })
      
      // Uppdatera lokal state
      setCustomers(prev => [result.customer, ...prev])
      
      alert(`Kundkonto skapat för ${newCustomer.name}!\n\nAnvändarnamn: ${newCustomer.email}\nLösenord: ${result.password}\n\nEtt e-postmeddelande med dessa inloggningsuppgifter har skickats till ${newCustomer.email}`)
      
      // Återställ formuläret
      setNewCustomer({ name: '', email: '', project: '', password: '' })
      setShowCreateCustomer(false)
    } catch (error: any) {
      console.error('Error creating customer:', error)
      alert('Fel vid skapande av kund: ' + error.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleManageFiles = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setSelectedFiles([]) // Reset selected files
    setFolderPath('') // Reset to root folder
    setNewFolderName('')
    setCustomerFiles([])
    setShowFileManager(true)
    
    // Load files for this customer
    await loadCustomerFiles(customer.id)
  }

  // Lösenordsgenerering funktioner
  const generatePasswordForCustomer = (type: 'secure' | 'simple' | 'custom') => {
    let newPassword = ''
    
    switch (type) {
      case 'secure':
        newPassword = generatePassword({ length: 12, includeSymbols: false })
        break
      case 'simple':
        newPassword = generateSimplePassword()
        break
      case 'custom':
        if (newCustomer.name) {
          newPassword = generateCustomerPassword(newCustomer.name)
        } else {
          newPassword = generateSimplePassword()
        }
        break
    }
    
    setNewCustomer(prev => ({ ...prev, password: newPassword }))
  }

  const loadCustomerFiles = async (customerId: string, folderPathFilter?: string) => {
    try {
      setLoadingFiles(true)
      
      // Ladda filer
      const filesParams = new URLSearchParams({ customerId })
      if (folderPathFilter !== undefined) {
        filesParams.append('folderPath', folderPathFilter)
      }
      
      const filesResponse = await fetch(`/api/admin/files?${filesParams}`)
      const filesResult = await filesResponse.json()
      
      // Ladda alla mappar för denna kund
      const foldersResponse = await fetch(`/api/admin/folders?customerId=${customerId}`)
      const foldersResult = await foldersResponse.json()
      
      if (filesResponse.ok && foldersResponse.ok) {
        setCustomerFiles(filesResult.files || [])
        setAllFolders(foldersResult.folders || [''])
      } else {
        console.error('Error loading files or folders:', filesResult.error || foldersResult.error)
      }
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoadingFiles(false)
    }
  }

  const createFolder = async (customerId: string, folderPath: string) => {
    try {
      const response = await fetch('/api/admin/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'createFolder',
          customerId, 
          folderPath 
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        // Refresh folders list
        if (selectedCustomer) {
          await loadCustomerFiles(selectedCustomer.id, folderPath)
        }
        return true
      } else {
        alert('Fel vid skapande av mapp: ' + result.error)
        return false
      }
    } catch (error) {
      alert('Fel vid skapande av mapp: ' + error)
      return false
    }
  }

  const moveFileToFolder = async (fileId: string, newFolderPath: string) => {
    try {
      const response = await fetch('/api/admin/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, newFolderPath })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        // Refresh files for current customer
        if (selectedCustomer) {
          await loadCustomerFiles(selectedCustomer.id, folderPath)
        }
        return true
      } else {
        alert('Fel vid flytt av fil: ' + result.error)
        return false
      }
    } catch (error) {
      alert('Fel vid flytt av fil: ' + error)
      return false
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileSelect called')
    console.log('e.target.files:', e.target.files)
    
    if (e.target.files) {
      const files = Array.from(e.target.files)
      console.log('Selected files:', files.map(f => ({ name: f.name, size: f.size, type: f.type })))
      setSelectedFiles(prev => {
        const newFiles = [...prev, ...files]
        console.log('Updated selectedFiles:', newFiles.map(f => f.name))
        return newFiles
      })
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUploadFiles = async () => {
    console.log('handleUploadFiles called')
    console.log('selectedCustomer:', selectedCustomer)
    console.log('selectedFiles:', selectedFiles)
    
    if (!selectedCustomer || selectedFiles.length === 0) {
      alert('Välj filer att ladda upp')
      return
    }

    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('customerId', selectedCustomer.id)
      formData.append('folderPath', folderPath) // Lägg till mapp-info
      
      console.log('Adding files to FormData...')
      selectedFiles.forEach((file, index) => {
        console.log(`Adding file ${index}:`, file.name, file.size, file.type)
        formData.append('files', file)
      })

      console.log('FormData created with customerId:', selectedCustomer.id)
      console.log('FormData has files:', formData.has('files'))

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      console.log('Response content-type:', response.headers.get('content-type'))

      let result
      try {
        const responseText = await response.text()
        console.log('Raw response text:', responseText.substring(0, 500))
        
        // Försök parsa som JSON endast om content-type är JSON
        if (response.headers.get('content-type')?.includes('application/json')) {
          result = JSON.parse(responseText)
        } else {
          throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 200)}`)
        }
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error(`Invalid server response: ${parseError}`)
      }

      console.log('Upload result:', result)

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }
      
      // Hantera partiella framgångar
      if (result.errorCount > 0) {
        alert(`Upload delvis lyckad!\n✅ ${result.successCount} filer uppladdade\n❌ ${result.errorCount} filer misslyckades\n\nFel:\n${result.errors?.join('\n') || 'Okända fel'}`)
      } else {
        alert(`✅ Alla ${result.successCount} filer uppladdades framgångsrikt!`)
      }
      
      setSelectedFiles([])
      
      // Reload data to update file counts and customer files
      await loadData()
      if (selectedCustomer) {
        await loadCustomerFiles(selectedCustomer.id, folderPath)
      }
      
    } catch (error: any) {
      console.error('Error uploading files:', error)
      alert('Fel vid uppladdning: ' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendPassword = async (customer: Customer) => {
    try {
      const newPassword = utils.generatePassword()
      
      // Uppdatera lösenord via API
      await customerService.updateCustomer(customer.id, {
        password_hash: newPassword // Hash lösenordet med bcrypt i produktion
      })
      
      alert(`Nytt lösenord skickat till ${customer.email}!\n\nNytt lösenord: ${newPassword}\n\nKunden kommer att få ett e-postmeddelande med det nya lösenordet.`)
    } catch (error: any) {
      console.error('Error sending password:', error)
      alert('Fel vid skickande av lösenord: ' + error.message)
    }
  }

  const handleDeleteCustomer = async (customer: Customer) => {
    if (confirm(`Är du säker på att du vill ta bort kunden "${customer.name}"?\n\nDetta kommer att radera alla filer och kan inte ångras.`)) {
      try {
        await customerService.deleteCustomer(customer.id)
        setCustomers(prev => prev.filter(c => c.id !== customer.id))
        alert(`Kunden "${customer.name}" har tagits bort.`)
      } catch (error: any) {
        console.error('Error deleting customer:', error)
        alert('Fel vid borttagning av kund: ' + error.message)
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCustomer(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-drone-cloud to-yellow-50">
      {/* Header - Mobile Optimized */}
      <header className="bg-white shadow-sm border-b border-yellow-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex justify-between items-center py-3">
              <DrönarkompanietLogo variant="text" size="sm" />
              <button className="text-slate-600 hover:text-yellow-700 text-sm">
                Logga ut
              </button>
            </div>
            <div className="pb-3">
              <span className="text-xs text-slate-600 font-medium">Admin Panel</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-slate-600">Inloggad som: Admin</span>
                <span className="text-slate-300">•</span>
                <Link href="/" className="text-yellow-600 hover:text-yellow-700 text-xs">
                  Till kundportal
                </Link>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <DrönarkompanietLogo variant="full" size="md" />
              <div className="border-l border-gray-300 pl-4">
                <span className="text-sm text-slate-600 font-medium">Admin Panel</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">Inloggad som: Admin</span>
              <Link href="/" className="text-yellow-600 hover:text-yellow-700">
                Till kundportal
              </Link>
              <button className="text-slate-600 hover:text-yellow-700">
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Stats - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600">{loading ? '...' : customers.length}</div>
            <div className="text-xs sm:text-sm text-slate-600">Totala kunder</div>
          </div>
          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600">
              {loading ? '...' : customers.filter(c => c.status === 'active').length}
            </div>
            <div className="text-xs sm:text-sm text-slate-600">Aktiva konton</div>
          </div>
          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-500">
              {loading ? '...' : fileStats.totalFiles}
            </div>
            <div className="text-xs sm:text-sm text-slate-600">Uppladdade filer</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg border border-yellow-50">
            <div className="text-3xl font-bold text-yellow-700">
              {loading ? '...' : utils.formatFileSize(fileStats.totalSize)}
            </div>
            <div className="text-sm text-slate-600">Total lagring</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customers'
                  ? 'border-yellow-600 text-yellow-600'
                  : 'border-transparent text-slate-600 hover:text-yellow-700 hover:border-yellow-50'
              }`}
            >
              Kundhantering
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Ladda upp material
            </button>
          </nav>
        </div>

        {/* Customer Management Tab */}
        {activeTab === 'customers' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Kundkonton</h2>
              <button
                onClick={() => setShowCreateCustomer(true)}
                disabled={loading}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
              >
                + Skapa nytt kundkonto
              </button>
            </div>

            {loading ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Laddar kunddata...</p>
              </div>
            ) : (
              /* Customer List */
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kund
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projekt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Filer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Senaste åtkomst
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Åtgärder
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.project}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          customer.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.status === 'active' ? 'Aktiv' : 'Utgången'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fileStats.customerFileCounts[customer.id] || 0} filer
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.last_access ? utils.formatDate(customer.last_access) : 'Aldrig'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button 
                          onClick={() => handleManageFiles(customer)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Hantera filer
                        </button>
                        <button 
                          onClick={() => handleSendPassword(customer)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Skicka lösenord
                        </button>
                        <button 
                          onClick={() => handleDeleteCustomer(customer)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Ta bort
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Ladda upp material</h2>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Välj kund
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500">
                  <option value="">Välj kund...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.project}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ladda upp filer
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-yellow-600 hover:text-yellow-500 focus-within:outline-none">
                        <span>Ladda upp filer</span>
                        <input type="file" className="sr-only" multiple accept="image/*,video/*" />
                      </label>
                      <p className="pl-1">eller dra och släpp</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, MP4 upp till 100MB per fil</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors">
                  Ladda upp material
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Customer Modal */}
        {showCreateCustomer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Skapa nytt kundkonto</h3>
              
              <form id="create-customer-form" className="space-y-4" onSubmit={handleCreateCustomer}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kundnamn *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={newCustomer.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Anna Svensson"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-post *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={newCustomer.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="anna@exempel.se"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Projektnamn *
                  </label>
                  <input
                    type="text"
                    name="project"
                    required
                    value={newCustomer.project}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Fastighetsfotografering Villa Danderyd"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lösenord *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      name="password"
                      required
                      value={newCustomer.password}
                      onChange={handleInputChange}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 font-mono"
                      placeholder="Generera eller skriv eget lösenord"
                    />
                    <button
                      type="button"
                      onClick={() => generatePasswordForCustomer('secure')}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      title="Generera säkert lösenord"
                    >
                      🔒
                    </button>
                    <button
                      type="button"
                      onClick={() => generatePasswordForCustomer('simple')}
                      className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                      title="Generera enkelt lösenord"
                    >
                      📝
                    </button>
                    <button
                      type="button"
                      onClick={() => generatePasswordForCustomer('custom')}
                      className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                      title="Generera baserat på namn"
                    >
                      👤
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    🔒 Säkert (12 tecken) • 📝 Enkelt (uttalbart) • 👤 Baserat på namn
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
                  <strong>Info:</strong> Lösenordet kommer att skickas till kundens e-post tillsammans med inloggningsuppgifterna.
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateCustomer(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Avbryt
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreating || !newCustomer.name || !newCustomer.email || !newCustomer.project || !newCustomer.password}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isCreating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Skapar konto...
                      </>
                    ) : (
                      'Skapa konto'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* File Manager Modal */}
        {showFileManager && selectedCustomer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Filhantering</h3>
                    <p className="text-sm text-gray-600">{selectedCustomer.name} - {selectedCustomer.project}</p>
                  </div>
                  <button
                    onClick={() => setShowFileManager(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {/* Folder Navigation */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Mapp: {folderPath || 'Rot'}</h4>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Ny mapp..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md"
                      />
                      <button
                        onClick={async () => {
                          if (newFolderName.trim() && selectedCustomer) {
                            const newPath = folderPath ? `${folderPath}/${newFolderName.trim()}` : newFolderName.trim()
                            const success = await createFolder(selectedCustomer.id, newPath)
                            if (success) {
                              setFolderPath(newPath)
                              setNewFolderName('')
                            }
                          }
                        }}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200"
                      >
                        Skapa mapp
                      </button>
                    </div>
                  </div>
                  
                  {/* Breadcrumbs */}
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                    <button
                      onClick={() => setFolderPath('')}
                      className="hover:text-yellow-600"
                    >
                      Rot
                    </button>
                    {folderPath.split('/').filter(Boolean).map((folder, index, array) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span>/</span>
                        <button
                          onClick={() => setFolderPath(array.slice(0, index + 1).join('/'))}
                          className="hover:text-yellow-600"
                        >
                          {folder}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload Area */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Ladda upp nya filer {folderPath && `till "${folderPath}"`}
                  </h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-yellow-600 hover:text-yellow-500">
                        <span>Välj filer</span>
                        <input 
                          type="file" 
                          className="sr-only" 
                          multiple 
                          accept="image/*,video/*" 
                          onChange={handleFileSelect}
                        />
                      </label>
                      <p className="pl-1">eller dra och släpp här</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">PNG, JPG, MP4, MOV upp till 100MB per fil</p>
                  </div>
                </div>

                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Valda filer ({selectedFiles.length})</h4>
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {file.type.startsWith('image/') ? (
                                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File List */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Filer i {folderPath || 'Rot'} ({customerFiles.filter(f => (f.folder_path || '') === folderPath).length})
                  </h4>
                  
                  {loadingFiles ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                      <p>Laddar filer...</p>
                    </div>
                  ) : customerFiles.filter(f => (f.folder_path || '') === folderPath).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <p>Inga filer i denna mapp</p>
                      <p className="text-sm">Använd uppladdningsområdet ovan för att lägga till filer</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {customerFiles.filter(f => (f.folder_path || '') === folderPath).map((file) => (
                        <div key={file.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate" title={file.original_name}>
                                {file.original_name}
                              </p>
                              <p className="text-xs text-gray-500">{file.formatted_size}</p>
                            </div>
                            <div className="ml-2 flex-shrink-0">
                              {file.is_image ? (
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>
                          </div>
                          
                          {/* Image Preview */}
                          {file.is_image && file.download_url && (
                            <div className="mb-3 bg-gray-100 rounded-md overflow-hidden">
                              <img 
                                src={file.download_url} 
                                alt={file.original_name}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                            <span>{new Date(file.uploaded_at).toLocaleDateString('sv-SE')}</span>
                            <span>{file.file_type.split('/')[1]?.toUpperCase()}</span>
                          </div>
                          
                          {/* Move to folder dropdown */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Flytta till mapp:
                            </label>
                            <select
                              value={file.folder_path || ''}
                              onChange={async (e) => {
                                const newPath = e.target.value
                                if (newPath !== (file.folder_path || '')) {
                                  const success = await moveFileToFolder(file.id, newPath)
                                  if (success) {
                                    // File moved successfully
                                  }
                                }
                              }}
                              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                            >
                              <option value="" className="font-medium">📁 Rot</option>
                              {allFolders.filter(f => f !== '').map(folder => (
                                <option key={folder} value={folder} className="font-medium">
                                  📁 {folder}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="flex space-x-2">
                            {file.download_url ? (
                              <a
                                href={file.download_url}
                                download={file.original_name}
                                className="flex-1 text-center px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors"
                              >
                                Ladda ner
                              </a>
                            ) : (
                              <span className="flex-1 text-center px-3 py-1 text-xs bg-gray-100 text-gray-500 rounded-md">
                                Ej tillgänglig
                              </span>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Är du säker på att du vill ta bort denna fil?')) {
                                  // TODO: Implement delete functionality
                                  console.log('Delete file:', file.id)
                                }
                              }}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                            >
                              Ta bort
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Show all available folders */}
                  {allFolders.filter(f => f !== '' && f !== folderPath).length > 0 && (
                    <div className="mt-6">
                      <h5 className="text-sm font-medium text-gray-700 mb-3">Tillgängliga mappar</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {allFolders
                          .filter(f => f !== '' && f !== folderPath)
                          .map((folder) => (
                            <button
                              key={folder}
                              onClick={() => {
                                setFolderPath(folder)
                                loadCustomerFiles(selectedCustomer!.id, folder)
                              }}
                              className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                              </svg>
                              <span className="text-sm font-medium text-gray-900 truncate">{folder}</span>
                              <span className="ml-2 text-xs text-gray-500">
                                ({customerFiles.filter(f => (f.folder_path || '') === folder).length})
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Show folders/subfolders if any */}
                  {(() => {
                    const subfoldersSet = new Set(
                      customerFiles
                        .filter(f => (f.folder_path || '').startsWith(folderPath) && (f.folder_path || '') !== folderPath)
                        .map(f => {
                          const fileFolderPath = f.folder_path || ''
                          const relativePath = folderPath ? fileFolderPath.slice(folderPath.length + 1) : fileFolderPath
                          return relativePath.split('/')[0]
                        })
                        .filter(Boolean)
                    )
                    const subfolders = Array.from(subfoldersSet)
                    
                    return subfolders.length > 0 && (
                      <div className="mt-6">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Undermappar</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {subfolders.map((subfolder) => (
                            <button
                              key={subfolder}
                              onClick={() => {
                                const newPath = folderPath ? `${folderPath}/${subfolder}` : subfolder
                                setFolderPath(newPath)
                                loadCustomerFiles(selectedCustomer!.id, newPath)
                              }}
                              className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                              </svg>
                              <span className="text-sm font-medium text-gray-900 truncate">{subfolder}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Total lagring: <span className="font-medium">12.4 MB</span>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => setShowFileManager(false)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-white"
                    >
                      Stäng
                    </button>
                    <button 
                      onClick={handleUploadFiles}
                      disabled={selectedFiles.length === 0 || isUploading}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isUploading ? 'Laddar upp...' : `Ladda upp ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
