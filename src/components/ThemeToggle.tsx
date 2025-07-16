'use client'

import { useTheme } from '../contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  const handleClick = () => {
    console.log('ThemeToggle: Button clicked, current theme:', theme)
    console.log('ThemeToggle: HTML classes before toggle:', document.documentElement.className)
    toggleTheme()
    setTimeout(() => {
      console.log('ThemeToggle: HTML classes after toggle:', document.documentElement.className)
      console.log('ThemeToggle: Has dark class:', document.documentElement.classList.contains('dark'))
    }, 100)
  }

  return (
    <button
      onClick={handleClick}
      className={`group relative p-2 sm:p-3 rounded-xl transition-all duration-300 shadow-sm border
        ${theme === 'dark' 
          ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' 
          : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
        }`}
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
