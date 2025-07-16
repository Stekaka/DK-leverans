'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

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

interface ImageGalleryProps {
  files: CustomerFile[]
  onRatingChange: (fileId: string, rating: string, notes?: string) => void
  onClose: () => void
  initialIndex?: number
}

export default function ImageGallery({ 
  files, 
  onRatingChange, 
  onClose, 
  initialIndex = 0 
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const currentFile = files[currentIndex]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      } else if (e.key === '1') {
        handleRating('poor')
      } else if (e.key === '2') {
        handleRating('good')
      } else if (e.key === '3') {
        handleRating('favorite')
      } else if (e.key === '0') {
        handleRating('unrated')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex])

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % files.length)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + files.length) % files.length)
  }

  const handleRating = async (rating: string) => {
    setIsLoading(true)
    try {
      await onRatingChange(currentFile.id, rating, currentFile.customer_notes)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotesUpdate = async () => {
    setIsLoading(true)
    try {
      await onRatingChange(currentFile.id, currentFile.customer_rating, notes)
      setShowNotesModal(false)
      setNotes('')
    } finally {
      setIsLoading(false)
    }
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'favorite': return 'text-yellow-500'
      case 'good': return 'text-green-500'
      case 'poor': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'favorite':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        )
      case 'good':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'poor':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 text-white p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold truncate">{currentFile.original_name}</h3>
              <span className="text-sm opacity-75">
                {currentIndex + 1} av {files.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Image */}
        <div className="flex-1 flex items-center justify-center p-8 pt-20 pb-32">
          {currentFile.is_image ? (
            <div className="relative max-w-full max-h-full">
              <img
                src={currentFile.download_url || '/placeholder-image.png'}
                alt={currentFile.original_name}
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-white">
              <svg className="w-24 h-24 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-lg mb-2">Video Preview</p>
              <p className="text-sm opacity-75">{currentFile.original_name}</p>
              <button
                onClick={() => window.open(currentFile.download_url || '', '_blank')}
                className="mt-4 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                Öppna Video
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        {files.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Rating Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm">Betygsätt:</span>
              
              {/* Rating Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleRating('favorite')}
                  disabled={isLoading}
                  className={`p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors ${
                    currentFile.customer_rating === 'favorite' ? 'bg-yellow-500 bg-opacity-30' : ''
                  }`}
                  title="Favorit (Tangent: 3)"
                >
                  <div className={getRatingColor('favorite')}>
                    {getRatingIcon('favorite')}
                  </div>
                </button>

                <button
                  onClick={() => handleRating('good')}
                  disabled={isLoading}
                  className={`p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors ${
                    currentFile.customer_rating === 'good' ? 'bg-green-500 bg-opacity-30' : ''
                  }`}
                  title="Bra (Tangent: 2)"
                >
                  <div className={getRatingColor('good')}>
                    {getRatingIcon('good')}
                  </div>
                </button>

                <button
                  onClick={() => handleRating('poor')}
                  disabled={isLoading}
                  className={`p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors ${
                    currentFile.customer_rating === 'poor' ? 'bg-red-500 bg-opacity-30' : ''
                  }`}
                  title="Mindre bra (Tangent: 1)"
                >
                  <div className={getRatingColor('poor')}>
                    {getRatingIcon('poor')}
                  </div>
                </button>

                <button
                  onClick={() => handleRating('unrated')}
                  disabled={isLoading}
                  className={`p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors ${
                    currentFile.customer_rating === 'unrated' ? 'bg-gray-500 bg-opacity-30' : ''
                  }`}
                  title="Ta bort betyg (Tangent: 0)"
                >
                  <div className={getRatingColor('unrated')}>
                    {getRatingIcon('unrated')}
                  </div>
                </button>
              </div>

              {/* Notes Button */}
              <button
                onClick={() => {
                  setNotes(currentFile.customer_notes || '')
                  setShowNotesModal(true)
                }}
                className="p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                title="Lägg till anteckningar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>

            {/* Current Rating Display */}
            <div className="flex items-center space-x-2">
              <span className="text-sm">Aktuellt:</span>
              <div className={`flex items-center space-x-1 ${getRatingColor(currentFile.customer_rating)}`}>
                {getRatingIcon(currentFile.customer_rating)}
                <span className="text-sm capitalize">
                  {currentFile.customer_rating === 'unrated' ? 'Ej betygsatt' :
                   currentFile.customer_rating === 'favorite' ? 'Favorit' :
                   currentFile.customer_rating === 'good' ? 'Bra' : 'Mindre bra'}
                </span>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-2 text-xs opacity-75">
            ESC: Stäng | ←→: Navigera | 0: Ej betygsatt | 1: Mindre bra | 2: Bra | 3: Favorit
          </div>
        </div>
      </div>

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Anteckningar</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lägg till dina anteckningar..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none text-gray-900"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Avbryt
              </button>
              <button
                onClick={handleNotesUpdate}
                disabled={isLoading}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                {isLoading ? 'Sparar...' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
