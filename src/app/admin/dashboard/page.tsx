'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'
import DirectUploadComponent from '@/components/DirectUploadComponent'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { customerService, fileService, utils } from '../../../../lib/database'
import { generatePassword, generateSimplePassword, generateCustomerPassword } from '../../../../lib/password-generator'
import type { Customer } from '../../../../lib/supabase'

export default function AdminDashboard() {
  const { theme } = useTheme()
  const router = useRouter()
  
  // Logout-funktion för admin
  const logout = async () => {
    try {
      // Rensa admin session (om någon)
      await fetch('/api/auth/admin/logout', { method: 'POST' })
      // Gå till startsidan
      router.push('/')
    } catch (error) {
      console.error('Admin logout failed:', error)
      // Gå till startsidan även vid fel
      router.push('/')
    }
  }
  
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
  // Ta bort gamla upload-relaterade state som inte behövs längre
  const [folderPath, setFolderPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [customerFiles, setCustomerFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [allFolders, setAllFolders] = useState<string[]>(['']) // Include root folder
  
  // Access management state
  const [customersWithAccess, setCustomersWithAccess] = useState<{ [key: string]: any }>({})
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showPermanentModal, setShowPermanentModal] = useState(false)
  const [selectedCustomerForAccess, setSelectedCustomerForAccess] = useState<Customer | null>(null)
  const [extensionDays, setExtensionDays] = useState(30)
  const [extensionReason, setExtensionReason] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  
  // Mobile UX state
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

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
      
      // Load access information for all customers
      setTimeout(() => loadAllCustomerAccess(), 500) // Small delay to avoid too many concurrent requests
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

  // Funktioner för filhantering och mappstöd

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

  // Load customer access information
  const loadCustomerAccess = async (customerId: string) => {
    try {
      console.log('Loading access for customer:', customerId)
      const response = await fetch(`/api/customer/access?customerId=${customerId}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Access data for', customerId, ':', data)
        
        // Kontrollera att vi faktiskt fick access data
        if (data && data.access) {
          setCustomersWithAccess(prev => ({
            ...prev,
            [customerId]: data.access
          }))
        } else {
          console.warn('No access data returned for customer:', customerId)
          // Sätt en default access status
          setCustomersWithAccess(prev => ({
            ...prev,
            [customerId]: {
              hasAccess: false,
              accessType: 'expired',
              isExpired: true,
              daysRemaining: 0,
              storageUsedGb: 0,
              storageLimitGb: 0
            }
          }))
        }
      } else {
        console.error('Failed to load access for customer', customerId, ':', response.status)
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error details:', errorData)
        
        // Sätt en error status så vi inte visar "Laddar..." för evigt
        setCustomersWithAccess(prev => ({
          ...prev,
          [customerId]: {
            hasAccess: false,
            accessType: 'error',
            isExpired: true,
            daysRemaining: 0,
            storageUsedGb: 0,
            storageLimitGb: 0,
            error: errorData.error || 'Kunde inte ladda access data'
          }
        }))
      }
    } catch (error) {
      console.error('Error loading customer access:', error)
      
      // Sätt en error status så vi inte visar "Laddar..." för evigt
      setCustomersWithAccess(prev => ({
        ...prev,
        [customerId]: {
          hasAccess: false,
          accessType: 'error',
          isExpired: true,
          daysRemaining: 0,
          storageUsedGb: 0,
          storageLimitGb: 0,
          error: 'Nätverksfel vid laddning av access data'
        }
      }))
    }
  }

  // Load access for all customers
  const loadAllCustomerAccess = async () => {
    for (const customer of customers) {
      await loadCustomerAccess(customer.id)
    }
  }

  // Extend customer access
  const handleExtendAccess = async () => {
    if (!selectedCustomerForAccess) return

    try {
      const response = await fetch('/api/admin/extend-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerForAccess.id,
          extensionDays,
          reason: extensionReason
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Access för "${selectedCustomerForAccess.name}" har förlängts med ${extensionDays} dagar`)
        await loadCustomerAccess(selectedCustomerForAccess.id)
        setShowExtendModal(false)
        setExtensionReason('')
      } else {
        const error = await response.json()
        alert('Fel vid förlängning: ' + error.error)
      }
    } catch (error) {
      console.error('Error extending access:', error)
      alert('Ett fel uppstod vid förlängning')
    }
  }

  // Activate permanent access
  const handleActivatePermanentAccess = async () => {
    if (!selectedCustomerForAccess || !paymentReference) return

    try {
      const response = await fetch('/api/admin/permanent-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerForAccess.id,
          paymentReference
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Permanent access för "${selectedCustomerForAccess.name}" har aktiverats`)
        await loadCustomerAccess(selectedCustomerForAccess.id)
        setShowPermanentModal(false)
        setPaymentReference('')
      } else {
        const error = await response.json()
        alert('Fel vid aktivering: ' + error.error)
      }
    } catch (error) {
      console.error('Error activating permanent access:', error)
      alert('Ett fel uppstod vid aktivering')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCustomer(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-yellow-50 dark:from-slate-900 dark:to-slate-800 transition-colors">
      {/* Header - Mobile Optimized */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-yellow-50 dark:border-slate-700 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center space-x-3">
                <DrönarkompanietLogo size="sm" />
                <div>
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Leveransportal</span>
                  <div className="text-xs text-slate-500 dark:text-slate-500">Admin Panel</div>
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
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">Inloggad som: Admin</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <Link href="/admin/quick-upload" className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors">
                  Quick Upload
                </Link>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <Link href="/" className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 text-xs transition-colors">
                  Till kundportal
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
              <div className="border-l border-gray-300 dark:border-slate-600 pl-4">
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Leveransportal</span>
                <div className="text-xs text-slate-500 dark:text-slate-500">Admin Panel</div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">Inloggad som: Admin</span>
              <Link href="/admin/quick-upload" className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors">
                Quick Upload
              </Link>
              <Link href="/" className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 transition-colors">
                Till kundportal
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
        {/* Stats - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600 dark:text-yellow-400">{loading ? '...' : customers.length}</div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Totala kunder</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {loading ? '...' : customers.filter(c => c.status === 'active').length}
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Aktiva konton</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-500 dark:text-yellow-400">
              {loading ? '...' : fileStats.totalFiles}
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Uppladdade filer</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 lg:p-6 rounded-lg shadow-lg border border-yellow-50 dark:border-slate-700 transition-colors">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-700 dark:text-yellow-400">
              {loading ? '...' : utils.formatFileSize(fileStats.totalSize)}
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Total lagring</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-600 mb-6 transition-colors">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'customers'
                  ? 'border-yellow-600 text-yellow-600 dark:text-yellow-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:border-yellow-50 dark:hover:border-slate-500'
              }`}
            >
              Kundhantering
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'upload'
                  ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Kundkonton</h2>
              <button
                onClick={() => setShowCreateCustomer(true)}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                + Skapa nytt kundkonto
              </button>
            </div>

            {loading ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center transition-colors">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-slate-400">Laddar kunddata...</p>
              </div>
            ) : (
              <>
                {/* Mobile Customer Cards */}
                <div className="block lg:hidden space-y-4">
                  {customers.map((customer) => {
                    const accessInfo = customersWithAccess[customer.id]
                    const isExpanded = expandedCustomer === customer.id
                    
                    return (
                      <div key={customer.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                        {/* Card Header - Always Visible */}
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                          onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                  {customer.name}
                                </h3>
                                <div className="flex items-center space-x-2">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    customer.status === 'active' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                  }`}>
                                    {customer.status === 'active' ? 'Aktiv' : 'Utgången'}
                                  </span>
                                  <svg 
                                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">
                                {customer.email}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-600 dark:text-slate-300">
                                  {customer.project}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                  {fileStats.customerFileCounts[customer.id] || 0} filer
                                </span>
                              </div>
                              
                              {/* Access Status */}
                              <div className="mt-2">
                                {accessInfo ? (
                                  accessInfo.accessType === 'permanent' ? (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                      ♾️ Permanent
                                    </span>
                                  ) : !accessInfo.hasAccess ? (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                                      ❌ Utgången
                                    </span>
                                  ) : accessInfo.daysRemaining <= 7 ? (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                                      ⚠️ {accessInfo.daysRemaining} dagar
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                                      ✅ {accessInfo.daysRemaining} dagar
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-gray-400">Laddar...</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-200 dark:border-slate-600">
                            <div className="pt-4 space-y-3">
                              {/* Access Details */}
                              {accessInfo && (
                                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
                                  <h4 className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">📊 Access Information</h4>
                                  <div className="space-y-1 text-xs text-gray-600 dark:text-slate-400">
                                    {accessInfo.accessType === 'permanent' ? (
                                      <>
                                        <div>Type: Permanent access</div>
                                        <div>Storage: {accessInfo.storageUsedGb?.toFixed(1) || 0}GB/{accessInfo.storageLimitGb}GB</div>
                                      </>
                                    ) : (
                                      <>
                                        <div>Utgår: {accessInfo.expiresAt ? new Date(accessInfo.expiresAt).toLocaleDateString('sv-SE') : 'Okänt'}</div>
                                        <div>Senast aktiv: {customer.last_access ? new Date(customer.last_access).toLocaleString('sv-SE') : 'Aldrig'}</div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleManageFiles(customer)
                                  }}
                                  className="text-center py-2 px-3 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200 rounded-lg text-xs font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                                >
                                  📁 Hantera filer
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSendPassword(customer)
                                  }}
                                  className="text-center py-2 px-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200 rounded-lg text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                >
                                  🔑 Lösenord
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedCustomerForAccess(customer)
                                    setShowExtendModal(true)
                                  }}
                                  className="text-center py-2 px-3 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 rounded-lg text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                  ⏰ Förläng
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedCustomerForAccess(customer)
                                    setShowPermanentModal(true)
                                  }}
                                  className="text-center py-2 px-3 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 rounded-lg text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                >
                                  ♾️ Permanent
                                </button>
                              </div>
                              
                              {/* Delete Button */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCustomer(customer)
                                }}
                                className="w-full text-center py-2 px-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                              >
                                🗑️ Ta bort kund
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden transition-colors">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Kund
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Projekt
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Filer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Filaccess
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Senaste åtkomst
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Åtgärder
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {customers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{customer.name}</div>
                              <div className="text-sm text-gray-500 dark:text-slate-400">{customer.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                            {fileStats.customerFileCounts[customer.id] || 0} filer
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                            {(() => {
                              const accessInfo = customersWithAccess[customer.id]
                              if (!accessInfo) return 'Laddar...'
                              
                              // Visa error om det finns ett
                              if (accessInfo.accessType === 'error') {
                                return (
                                  <div>
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                      Fel
                                    </span>
                                    <div className="text-xs mt-1 text-red-600">
                                      {accessInfo.error || 'Okänt fel'}
                                    </div>
                                  </div>
                                )
                              }
                              
                              if (accessInfo.accessType === 'permanent') {
                                return (
                                  <div>
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                      Permanent
                                    </span>
                                    <div className="text-xs mt-1">
                                      {accessInfo.storageUsedGb?.toFixed(1) || 0}GB/{accessInfo.storageLimitGb}GB
                                    </div>
                                  </div>
                                )
                              } else if (!accessInfo.hasAccess) {
                                return (
                                  <div>
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                      Utgången
                                    </span>
                                    <div className="text-xs mt-1">
                                      {accessInfo.expiresAt ? new Date(accessInfo.expiresAt).toLocaleDateString('sv-SE') : 'Okänt'}
                                    </div>
                                  </div>
                                )
                              } else if (accessInfo.daysRemaining <= 7) {
                                return (
                                  <div>
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                      {accessInfo.daysRemaining} dagar kvar
                                    </span>
                                    <div className="text-xs mt-1">
                                      Utgår: {accessInfo.expiresAt ? new Date(accessInfo.expiresAt).toLocaleDateString('sv-SE') : 'Okänt'}
                                    </div>
                                  </div>
                                )
                              } else {
                                return (
                                  <div>
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                      {accessInfo.daysRemaining} dagar kvar
                                    </span>
                                    <div className="text-xs mt-1">
                                      Utgår: {accessInfo.expiresAt ? new Date(accessInfo.expiresAt).toLocaleDateString('sv-SE') : 'Okänt'}
                                    </div>
                                  </div>
                                )
                              }
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                            {customer.last_access ? utils.formatDate(customer.last_access) : 'Aldrig'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col space-y-1">
                              <div className="flex space-x-2">
                                <button 
                                  onClick={() => handleManageFiles(customer)}
                                  className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 transition-colors text-xs"
                                >
                                  Hantera filer
                                </button>
                                <button 
                                  onClick={() => handleSendPassword(customer)}
                                  className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors text-xs"
                                >
                                  Skicka lösenord
                                </button>
                              </div>
                              <div className="flex space-x-2">
                                <button 
                                  onClick={() => {
                                    setSelectedCustomerForAccess(customer)
                                    setShowExtendModal(true)
                                  }}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors text-xs"
                                >
                                  Förläng access
                                </button>
                                <button 
                                  onClick={() => {
                                    setSelectedCustomerForAccess(customer)
                                    setShowPermanentModal(true)
                                  }}
                                  className="text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 transition-colors text-xs"
                                >
                                  Permanent access
                                </button>
                              </div>
                              <button 
                                onClick={() => handleDeleteCustomer(customer)}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors text-xs self-start"
                              >
                                Ta bort
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-6">Ladda upp material</h2>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 transition-colors">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Välj kund
                </label>
                <select 
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value)
                    setSelectedCustomer(customer || null)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-colors"
                >
                  <option value="">Välj kund...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.project}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer ? (
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-6 transition-colors">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">
                    Direktuppladdning till Cloudflare R2
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    🚀 Ingen storleksbegränsning - filer laddas direkt till molnlagring
                  </p>
                  <DirectUploadComponent
                    customerId={selectedCustomer.id}
                    adminPassword="DronarkompanietAdmin2025!"
                    onUploadComplete={() => {
                      // Upload completed
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p>Välj en kund för att ladda upp filer</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Customer Modal */}
        {showCreateCustomer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-slate-900 dark:bg-opacity-70 flex items-center justify-center p-4 z-50 transition-colors">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">Skapa nytt kundkonto</h3>
              
              <form id="create-customer-form" className="space-y-4" onSubmit={handleCreateCustomer}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Kundnamn *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={newCustomer.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-colors"
                    placeholder="Anna Svensson"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    E-post *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={newCustomer.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-colors"
                    placeholder="anna@exempel.se"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Projektnamn *
                  </label>
                  <input
                    type="text"
                    name="project"
                    required
                    value={newCustomer.project}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-colors"
                    placeholder="Fastighetsfotografering Villa Danderyd"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Lösenord *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      name="password"
                      required
                      value={newCustomer.password}
                      onChange={handleInputChange}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 font-mono bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-colors"
                      placeholder="Generera eller skriv eget lösenord"
                    />
                    <button
                      type="button"
                      onClick={() => generatePasswordForCustomer('secure')}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                      title="Generera säkert lösenord"
                    >
                      🔒
                    </button>
                    <button
                      type="button"
                      onClick={() => generatePasswordForCustomer('simple')}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors"
                      title="Generera enkelt lösenord"
                    >
                      📝
                    </button>
                    <button
                      type="button"
                      onClick={() => generatePasswordForCustomer('custom')}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm transition-colors"
                      title="Generera baserat på namn"
                    >
                      👤
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    🔒 Säkert (12 tecken) • 📝 Enkelt (uttalbart) • 👤 Baserat på namn
                  </div>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded text-sm text-yellow-800 dark:text-yellow-200 transition-colors">
                  <strong>Info:</strong> Lösenordet kommer att skickas till kundens e-post tillsammans med inloggningsuppgifterna.
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateCustomer(false)}
                    className="px-4 py-2 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreating || !newCustomer.name || !newCustomer.email || !newCustomer.project || !newCustomer.password}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
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
          <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden transition-colors">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Filhantering</h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{selectedCustomer.name} - {selectedCustomer.project}</p>
                  </div>
                  <button
                    onClick={() => setShowFileManager(false)}
                    className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-800 transition-colors">
                {/* Folder Navigation */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Mapp: {folderPath || 'Rot'}</h4>
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

                {/* Direct Upload Component */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-200 mb-3">
                    Ladda upp nya filer {folderPath && `till "${folderPath}"`}
                  </h4>
                  <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
                    <DirectUploadComponent
                      customerId={selectedCustomer.id}
                      adminPassword="DronarkompanietAdmin2025!"
                      onUploadComplete={() => {
                        // Ladda om filer efter upload
                        loadCustomerFiles(selectedCustomer.id, folderPath)
                      }}
                    />
                  </div>
                </div>

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
                              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
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
                                className="flex-1 text-center px-3 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
                              >
                                Ladda ner
                              </a>
                            ) : (
                              <span className="flex-1 text-center px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md">
                                Ej tillgänglig
                              </span>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Är du säker på att du vill ta bort denna fil?')) {
                                  // TODO: Implement delete functionality
                                }
                              }}
                              className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
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
              
              <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 transition-colors">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    Total lagring: <span className="font-medium">12.4 MB</span>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => setShowFileManager(false)}
                      className="px-4 py-2 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-white dark:hover:bg-slate-700 bg-white dark:bg-slate-800 transition-colors"
                    >
                      Stäng
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
