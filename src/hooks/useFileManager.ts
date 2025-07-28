'use client'

import { useState, useCallback } from 'react'

export interface FileItem {
  id: string
  original_name: string
  display_name?: string
  file_size: number
  formatted_size: string
  customer_folder_path?: string
  is_trashed: boolean
  is_favorite: boolean
  rating?: number
  download_url?: string
  thumbnail_url?: string
  file_extension: string
  uploaded_at: string
}

export interface Folder {
  id: string
  name: string
  path: string
  type: 'folder'
  created_at: string
}

export const useFileManager = (customerId?: string) => {
  const [files, setFiles] = useState<FileItem[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Cache för att förbättra prestanda
  const [cache, setCache] = useState<Map<string, any>>(new Map())

  const loadFiles = useCallback(async (
    folderPath = '', 
    viewMode = 'folder', 
    sortBy = 'name', 
    sortOrder = 'asc'
  ) => {
    if (!customerId) return
    
    const cacheKey = `files-${folderPath}-${viewMode}-${sortBy}-${sortOrder}`
    
    // Kolla cache först
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey)
      if (Date.now() - cachedData.timestamp < 10000) { // 10 sekunder cache
        setFiles(cachedData.files)
        return
      }
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        folder: folderPath,
        view: viewMode,
        sortBy,
        sortOrder
      })
      
      const response = await fetch(`/api/customer/files?${params}`)
      
      if (!response.ok) {
        throw new Error('Kunde inte ladda filer')
      }
      
      const data = await response.json()
      setFiles(data.files || [])
      
      // Uppdatera cache
      setCache(prev => new Map(prev).set(cacheKey, {
        files: data.files || [],
        timestamp: Date.now()
      }))
      
    } catch (err) {
      console.error('Error loading files:', err)
      setError(err instanceof Error ? err.message : 'Kunde inte ladda filer')
    } finally {
      setLoading(false)
    }
  }, [customerId, cache])

  const loadFolders = useCallback(async (parentPath = '', sortBy = 'name', sortOrder = 'asc') => {
    if (!customerId) return
    
    const cacheKey = `folders-${parentPath}-${sortBy}-${sortOrder}`
    
    // Kolla cache först
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey)
      if (Date.now() - cachedData.timestamp < 10000) { // 10 sekunder cache
        setFolders(cachedData.folders)
        return
      }
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        parent: parentPath,
        sortBy,
        sortOrder
      })
      
      const response = await fetch(`/api/customer/folders?${params}`)
      
      if (!response.ok) {
        throw new Error('Kunde inte ladda mappar')
      }
      
      const data = await response.json()
      setFolders(data.folders || [])
      
      // Uppdatera cache
      setCache(prev => new Map(prev).set(cacheKey, {
        folders: data.folders || [],
        timestamp: Date.now()
      }))
      
    } catch (err) {
      console.error('Error loading folders:', err)
      setError(err instanceof Error ? err.message : 'Kunde inte ladda mappar')
    } finally {
      setLoading(false)
    }
  }, [customerId, cache])

  const moveFile = useCallback(async (fileId: string, newFolderPath: string, newName?: string) => {
    try {
      const response = await fetch('/api/customer/organize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          customerFolderPath: newFolderPath,
          displayName: newName
        })
      })
      
      if (!response.ok) {
        throw new Error('Kunde inte flytta fil')
      }
      
      // Rensa cache för att tvinga om-laddning
      setCache(new Map())
      
      return true
    } catch (err) {
      console.error('Error moving file:', err)
      setError(err instanceof Error ? err.message : 'Kunde inte flytta fil')
      return false
    }
  }, [])

  const trashFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch('/api/customer/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          action: 'trash'
        })
      })
      
      if (!response.ok) {
        throw new Error('Kunde inte flytta till papperskorg')
      }
      
      // Uppdatera files state direkt för bättre UX
      setFiles(prev => prev.filter(f => f.id !== fileId))
      
      // Rensa cache
      setCache(new Map())
      
      return true
    } catch (err) {
      console.error('Error trashing file:', err)
      setError(err instanceof Error ? err.message : 'Kunde inte flytta till papperskorg')
      return false
    }
  }, [])

  const restoreFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch('/api/customer/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          action: 'restore'
        })
      })
      
      if (!response.ok) {
        throw new Error('Kunde inte återställa fil')
      }
      
      // Uppdatera files state direkt för bättre UX
      setFiles(prev => prev.filter(f => f.id !== fileId))
      
      // Rensa cache
      setCache(new Map())
      
      return true
    } catch (err) {
      console.error('Error restoring file:', err)
      setError(err instanceof Error ? err.message : 'Kunde inte återställa fil')
      return false
    }
  }, [])

  const clearCache = useCallback(() => {
    setCache(new Map())
  }, [])

  return {
    files,
    folders,
    loading,
    error,
    loadFiles,
    loadFolders,
    moveFile,
    trashFile,
    restoreFile,
    clearCache
  }
}
