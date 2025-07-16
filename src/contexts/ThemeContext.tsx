'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Check localStorage for saved theme or system preference
    const savedTheme = localStorage.getItem('dk-theme') as Theme
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setTheme(savedTheme)
      console.log('ThemeProvider: Loaded saved theme:', savedTheme)
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const systemTheme = prefersDark ? 'dark' : 'light'
      setTheme(systemTheme)
      console.log('ThemeProvider: Using system theme:', systemTheme)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Apply theme to document - only use 'dark' class for Tailwind
    const htmlElement = document.documentElement
    
    if (theme === 'dark') {
      htmlElement.classList.add('dark')
      console.log('ThemeProvider: Applied dark mode, HTML classes:', htmlElement.className)
    } else {
      htmlElement.classList.remove('dark')
      console.log('ThemeProvider: Applied light mode, HTML classes:', htmlElement.className)
    }
    
    // Save to localStorage
    localStorage.setItem('dk-theme', theme)
  }, [theme, mounted])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    console.log('ThemeProvider: Toggling from', theme, 'to', newTheme)
    setTheme(newTheme)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <div>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
