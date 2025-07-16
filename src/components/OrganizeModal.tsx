'use client'

import { useState, useEffect } from 'react'
import { CustomerFile } from '@/types/customer'

interface OrganizeModalProps {
  file: CustomerFile | null
  isOpen: boolean
  onClose: () => void
  onSave: (fileId: string, displayName: string, customerFolderPath: string) => Promise<void>
}

export default function OrganizeModal({ file, isOpen, onClose, onSave }: OrganizeModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [customerFolderPath, setCustomerFolderPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [availableFolders, setAvailableFolders] = useState<string[]>([])
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Uppdatera värden när filen ändras
  useEffect(() => {
    if (file) {
      setDisplayName(file.name_for_display)
      setCustomerFolderPath(file.customer_folder_path || '')
      loadAvailableFolders()
    }
  }, [file])

  // Ladda befintliga mappar
  const loadAvailableFolders = async () => {
    try {
      const response = await fetch('/api/customer/organize')
      if (response.ok) {
        const data = await response.json()
        setAvailableFolders(data.folders || [])
      }
    } catch (error) {
      console.error('Kunde inte ladda mappar:', error)
    }
  }

  const handleSave = async () => {
    if (!file) return

    setIsLoading(true)
    try {
      const finalFolderPath = showCreateFolder && newFolderName.trim() 
        ? newFolderName.trim() 
        : customerFolderPath

      await onSave(file.id, displayName.trim(), finalFolderPath)
      onClose()
    } catch (error) {
      console.error('Kunde inte spara ändringar:', error)
      alert('Kunde inte spara ändringar. Försök igen.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave()
    }
  }

  if (!isOpen || !file) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Organisera fil
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Ursprungligt namn (visas bara för referens) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ursprungligt namn
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg">
              {file.original_name}
            </div>
          </div>

          {/* Nytt namn */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Visningsnamn
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg 
                       focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500
                       bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="Ange nytt namn för filen..."
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Detta namn visas bara för dig. Ursprungligt namn behålls för admin.
            </p>
          </div>

          {/* Mapp */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mapp
            </label>
            
            {!showCreateFolder ? (
              <div className="space-y-2">
                <select
                  value={customerFolderPath}
                  onChange={(e) => setCustomerFolderPath(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg 
                           focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500
                           bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="">Rot (ingen mapp)</option>
                  {availableFolders.map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                </select>
                
                <button
                  type="button"
                  onClick={() => setShowCreateFolder(true)}
                  className="text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 
                           flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Skapa ny mapp</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg 
                           focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500
                           bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="Ange mappnamn..."
                />
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateFolder(false)
                      setNewFolderName('')
                    }}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Organisera dina filer i mappar för bättre översikt.
            </p>
          </div>
        </div>

        {/* Knappar */}
        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-slate-600">
          <div className="flex-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <span>Ctrl+Enter för att spara snabbt</span>
          </div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200
                     transition-colors"
          >
            Avbryt
          </button>
          
          <button
            onClick={handleSave}
            disabled={isLoading || !displayName.trim()}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
          >
            {isLoading ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}
