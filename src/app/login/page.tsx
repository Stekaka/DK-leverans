'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Kontrollera om användaren redan är inloggad
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        if (response.ok) {
          // Användaren är redan inloggad, omdirigera till dashboard
          router.push('/dashboard')
        }
      } catch (error) {
        // Ignorera fel, användaren är inte inloggad
      }
    }
    
    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      })

      const result = await response.json()

      if (response.ok) {
        // Inloggning lyckades - redirect till dashboard
        router.push('/dashboard')
      } else {
        setError(result.error || 'Inloggning misslyckades')
      }
    } catch (error) {
      setError('Ett fel uppstod. Försök igen.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Simple Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-40 h-40 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-20 w-32 h-32 bg-gradient-to-br from-yellow-600/15 to-yellow-500/15 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-32 left-1/3 w-48 h-48 bg-gradient-to-br from-yellow-500/8 to-yellow-600/8 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>
      
      <div className="relative w-full max-w-md mx-auto">
        <div className="text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8">
            <span className="text-yellow-500">Drönar</span>kompaniet
          </div>
          <div className="mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-white via-yellow-100 to-yellow-200 bg-clip-text text-transparent mb-3 sm:mb-4">
              Logga in på ditt konto
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              Använd de inloggningsuppgifter ni fått via e-post
            </p>
            <div className="w-20 sm:w-24 h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-600 mx-auto mt-3 sm:mt-4 rounded-full"></div>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto mt-6 sm:mt-8">
        <div className="relative backdrop-blur-sm bg-white/10 py-8 sm:py-12 px-6 sm:px-8 lg:px-12 border border-white/20 rounded-xl sm:rounded-2xl overflow-hidden">
          
          {error && (
            <div className="relative mb-4 sm:mb-6 backdrop-blur-sm bg-red-500/20 border border-red-400/30 text-red-200 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl">
              <div className="flex">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-300 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}
          
          <form className="relative space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-yellow-100 mb-2">
                  E-postadress
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 sm:px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/30 rounded-lg sm:rounded-xl placeholder-slate-300 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all duration-300 hover:bg-white/15 text-sm sm:text-base"
                    placeholder="din@email.se"
                  />
                  {/* Input glow effect */}
                  <div className="absolute inset-0 rounded-lg sm:rounded-xl opacity-0 bg-gradient-to-r from-yellow-400/20 to-yellow-500/20 blur-xl transition-opacity duration-300 pointer-events-none"></div>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-yellow-100 mb-2">
                  Lösenord
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 sm:px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/30 rounded-lg sm:rounded-xl placeholder-slate-300 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all duration-300 hover:bg-white/15 text-sm sm:text-base"
                    placeholder="Ditt lösenord"
                  />
                  {/* Input glow effect */}
                  <div className="absolute inset-0 rounded-lg sm:rounded-xl opacity-0 bg-gradient-to-r from-yellow-400/20 to-yellow-500/20 blur-xl transition-opacity duration-300 pointer-events-none"></div>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-yellow-500 bg-white/10 border border-white/30 rounded focus:ring-yellow-400 focus:ring-2"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-300">
                  Kom ihåg mig (håll mig inloggad)
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg sm:rounded-xl text-white bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loggar in...
                  </div>
                ) : (
                  'Logga in'
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-4 sm:mt-6">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-slate-300">
                Har ni inte fått inloggningsuppgifter än?{' '}
                <a href="mailto:info@dronarkompaniet.se" className="font-medium text-yellow-400 hover:text-yellow-300">
                  Kontakta oss
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-yellow-600 hover:text-yellow-700 font-medium">
          ← Tillbaka till startsidan
        </Link>
      </div>
    </div>
  )
}
