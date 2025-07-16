'use client'

import { useTheme } from '../contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={() => {
        // Temporary debug to check if toggle works
        console.log('Theme before toggle:', theme)
        toggleTheme()
        setTimeout(() => {
          console.log('Theme after toggle:', theme === 'dark' ? 'light' : 'dark')
          console.log('HTML classes:', document.documentElement.className)
        }, 100)
      }}
      className="group relative p-2 sm:p-3 rounded-xl transition-all duration-300 shadow-sm"
      style={{
        backgroundColor: theme === 'dark' ? '#374151' : '#f1f5f9',
        borderColor: theme === 'dark' ? '#4b5563' : '#e2e8f0',
        color: theme === 'dark' ? '#d1d5db' : '#475569',
        border: '1px solid'
      }}
      title={theme === 'light' ? 'Växla till mörkt läge' : 'Växla till ljust läge'}
    >
      <div className="relative w-5 h-5 sm:w-6 sm:h-6">
        {/* Sun icon */}
        <svg 
          className={`absolute inset-0 w-5 h-5 sm:w-6 sm:h-6 transition-all duration-500 transform ${
            theme === 'light' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-75'
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        
        {/* Moon icon */}
        <svg 
          className={`absolute inset-0 w-5 h-5 sm:w-6 sm:h-6 transition-all duration-500 transform ${
            theme === 'dark' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 -rotate-90 scale-75'
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </div>
      
      {/* Hover effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300"/>
    </button>
  )
}
