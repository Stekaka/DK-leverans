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
      console.log('Found saved theme:', savedTheme)
      setTheme(savedTheme)
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const systemTheme = prefersDark ? 'dark' : 'light'
      console.log('Using system theme:', systemTheme)
      setTheme(systemTheme)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Apply theme to document
    console.log('Applying theme to document:', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      console.log('Added dark class to html')
    } else {
      document.documentElement.classList.remove('dark')
      console.log('Removed dark class from html')
    }
    
    // Save to localStorage
    localStorage.setItem('dk-theme', theme)
  }, [theme, mounted])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    console.log('Toggling theme from', theme, 'to', newTheme)
    setTheme(newTheme)
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
