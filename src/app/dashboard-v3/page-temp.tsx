'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardV3() {
  const router = useRouter()
  
  // Temporär redirect till dashboard för att undvika React serialization error
  useEffect(() => {
    router.push('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 dark:text-slate-400">Omdirigerar...</p>
      </div>
    </div>
  )
}
