import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fefdf8',
          100: '#fdf9e7',
          500: '#d4af37',
          600: '#b8941f',
          700: '#9c7a0a',
          800: '#806400',
          900: '#664f00',
        },
        // Drönarkompaniet Professional Brand Colors
        brand: {
          gold: '#d4af37',        // Signature gold
          'gold-light': '#e6c547', // Lighter gold
          'gold-dark': '#b8941f',  // Darker gold
          black: '#0a0a0a',        // Deep black
          'gray-dark': '#1a1a1a',  // Dark gray
          'gray-medium': '#404040', // Medium gray
          'gray-light': '#e5e5e5',  // Light gray
          white: '#ffffff',         // Pure white
          'off-white': '#fafafa',   // Off white
        },
        // Refined grayscale palette
        slate: {
          50: '#fafafa',
          100: '#f5f5f5', 
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        gold: {
          50: '#fefdf8',
          100: '#fdf9e7',
          200: '#fbf0c9',
          300: '#f7e394',
          400: '#f1d056',
          500: '#d4af37',
          600: '#b8941f',
          700: '#9c7a0a',
          800: '#806400',
          900: '#664f00',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'rotate-slow': 'rotate 20s linear infinite',
        'tech-slide': 'techSlide 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'shimmer': 'shimmer 2.5s linear infinite',
        'scan': 'scan 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { 
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.3), 0 0 40px rgba(212, 175, 55, 0.1)' 
          },
          '100%': { 
            boxShadow: '0 0 40px rgba(212, 175, 55, 0.6), 0 0 80px rgba(212, 175, 55, 0.2)' 
          },
        },
        techSlide: {
          '0%': { 
            transform: 'translateX(-100%) skewX(-5deg)',
            opacity: '0'
          },
          '100%': { 
            transform: 'translateX(0) skewX(0deg)',
            opacity: '1'
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        scan: {
          '0%, 100%': { 
            transform: 'translateX(-100%)',
            opacity: '0'
          },
          '50%': { 
            transform: 'translateX(0%)',
            opacity: '1'
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(212, 175, 55, 0.3)',
        'glow-md': '0 0 20px rgba(212, 175, 55, 0.4)',
        'glow-lg': '0 0 40px rgba(212, 175, 55, 0.5)',
        'elegant': '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(212, 175, 55, 0.05)',
        'luxury': '0 8px 32px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(212, 175, 55, 0.1)',
      },
      backgroundImage: {
        'elegant-grid': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d4af37' fill-opacity='0.03'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2z'/%3E%3C/g%3E%3C/svg%3E\")",
        'luxury-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}

export default config
