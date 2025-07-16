import React from 'react'

interface LogoProps {
  className?: string
  variant?: 'full' | 'icon' | 'text'
  size?: 'sm' | 'md' | 'lg'
}

export default function DrönarkompanietLogo({ 
  className = '', 
  variant = 'full',
  size = 'md'
}: LogoProps) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12', 
    lg: 'h-16'
  }

  const ElegantDroneIcon = () => (
    <svg 
      className={`${sizeClasses[size]} w-auto filter drop-shadow-lg`}
      viewBox="0 0 80 80"
      fill="none"
    >
      <defs>
        {/* Elegant Gradients */}
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f7e394" />
          <stop offset="25%" stopColor="#d4af37" />
          <stop offset="75%" stopColor="#b8941f" />
          <stop offset="100%" stopColor="#9c7a0a" />
        </linearGradient>
        
        <linearGradient id="blackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#262626" />
          <stop offset="50%" stopColor="#171717" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        
        <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e6c547" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
        
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f7e394" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#d4af37" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#b8941f" stopOpacity="0.3" />
        </radialGradient>
        
        {/* Professional Filters */}
        <filter id="elegantGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#d4af37" floodOpacity="0.4"/>
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f7e394" floodOpacity="0.2"/>
        </filter>
        
        <filter id="luxuryDepth" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.3"/>
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.2"/>
        </filter>
        
        <filter id="goldShine" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#f7e394" floodOpacity="0.6"/>
        </filter>
      </defs>
      
      {/* Professional Drone Body - Hexagonal Design */}
      <g transform="translate(40, 40)">
        {/* Main Body */}
        <path 
          d="M-12 -20 L12 -20 L24 0 L12 20 L-12 20 L-24 0 Z" 
          fill="url(#blackGradient)" 
          filter="url(#luxuryDepth)"
          stroke="url(#goldGradient)" 
          strokeWidth="1.5"
        />
        
        {/* Inner Luxury Frame */}
        <path 
          d="M-10 -16 L10 -16 L20 0 L10 16 L-10 16 L-20 0 Z" 
          fill="none" 
          stroke="url(#goldAccent)" 
          strokeWidth="1"
          opacity="0.8"
        />
        
        {/* Central Professional Core */}
        <circle r="8" fill="url(#coreGlow)" filter="url(#elegantGlow)" className="animate-pulse-slow"/>
        <circle r="6" fill="none" stroke="#f7e394" strokeWidth="0.5" opacity="0.7"/>
        <circle r="4" fill="url(#goldGradient)" opacity="0.9"/>
        <circle r="2.5" fill="#0a0a0a" filter="url(#goldShine)"/>
        <circle r="1.5" fill="url(#goldAccent)" className="animate-glow"/>
        
        {/* Elegant Details */}
        <g stroke="url(#goldGradient)" strokeWidth="0.8" opacity="0.8">
          <path d="M-15 -10 L-10 -10 L-10 -6" fill="none" strokeLinecap="round"/>
          <path d="M15 -10 L10 -10 L10 -6" fill="none" strokeLinecap="round"/>
          <path d="M-15 10 L-10 10 L-10 6" fill="none" strokeLinecap="round"/>
          <path d="M15 10 L10 10 L10 6" fill="none" strokeLinecap="round"/>
          <circle cx="-10" cy="-10" r="1" fill="url(#goldAccent)"/>
          <circle cx="10" cy="-10" r="1" fill="url(#goldAccent)"/>
          <circle cx="-10" cy="10" r="1" fill="url(#goldAccent)"/>
          <circle cx="10" cy="10" r="1" fill="url(#goldAccent)"/>
        </g>
        
        {/* Professional Status Indicators */}
        <g className="animate-pulse">
          <rect x="-18" y="-2" width="8" height="1" rx="0.5" fill="url(#goldGradient)" opacity="0.9"/>
          <rect x="10" y="-2" width="8" height="1" rx="0.5" fill="url(#goldGradient)" opacity="0.9"/>
          <rect x="-1" y="-18" width="1" height="8" rx="0.5" fill="url(#goldAccent)" opacity="0.9"/>
          <rect x="0" y="-18" width="1" height="8" rx="0.5" fill="url(#goldAccent)" opacity="0.9"/>
        </g>
      </g>
      
      {/* Professional Propeller Arms */}
      <g stroke="url(#blackGradient)" strokeWidth="4" strokeLinecap="round" opacity="0.9">
        <line x1="28" y1="28" x2="10" y2="10" />
        <line x1="52" y1="28" x2="70" y2="10" />
        <line x1="28" y1="52" x2="10" y2="70" />
        <line x1="52" y1="52" x2="70" y2="70" />
      </g>
      
      {/* Luxury Propeller Units */}
      <g filter="url(#elegantGlow)">
        {/* Top Left */}
        <g transform="translate(10, 10)">
          <circle r="12" fill="none" stroke="url(#goldGradient)" strokeWidth="2" opacity="0.8"/>
          <circle r="8" fill="url(#blackGradient)" opacity="0.7"/>
          <circle r="4" fill="url(#coreGlow)" className="animate-pulse"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(30)" className="animate-rotate-slow"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(120)" className="animate-rotate-slow"/>
        </g>
        
        {/* Top Right */}
        <g transform="translate(70, 10)">
          <circle r="12" fill="none" stroke="url(#goldGradient)" strokeWidth="2" opacity="0.8"/>
          <circle r="8" fill="url(#blackGradient)" opacity="0.7"/>
          <circle r="4" fill="url(#coreGlow)" className="animate-pulse"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(-30)" className="animate-rotate-slow"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(-120)" className="animate-rotate-slow"/>
        </g>
        
        {/* Bottom Left */}
        <g transform="translate(10, 70)">
          <circle r="12" fill="none" stroke="url(#goldGradient)" strokeWidth="2" opacity="0.8"/>
          <circle r="8" fill="url(#blackGradient)" opacity="0.7"/>
          <circle r="4" fill="url(#coreGlow)" className="animate-pulse"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(60)" className="animate-rotate-slow"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(150)" className="animate-rotate-slow"/>
        </g>
        
        {/* Bottom Right */}
        <g transform="translate(70, 70)">
          <circle r="12" fill="none" stroke="url(#goldGradient)" strokeWidth="2" opacity="0.8"/>
          <circle r="8" fill="url(#blackGradient)" opacity="0.7"/>
          <circle r="4" fill="url(#coreGlow)" className="animate-pulse"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(-60)" className="animate-rotate-slow"/>
          <ellipse rx="7" ry="1.5" fill="url(#goldAccent)" opacity="0.6" transform="rotate(-150)" className="animate-rotate-slow"/>
        </g>
      </g>
      
      {/* Professional Camera System */}
      <g transform="translate(40, 65)">
        <circle r="10" fill="url(#blackGradient)" filter="url(#luxuryDepth)"/>
        <circle r="8" fill="url(#goldGradient)" opacity="0.9"/>
        <circle r="6" fill="url(#blackGradient)"/>
        <circle r="4.5" fill="none" stroke="url(#goldAccent)" strokeWidth="0.8" opacity="0.8"/>
        <circle r="3.5" fill="url(#coreGlow)" className="animate-pulse-slow"/>
        <circle r="2.5" fill="#0a0a0a"/>
        <circle r="1.8" fill="url(#goldGradient)" className="animate-glow"/>
        <circle r="1" fill="#f7e394"/>
        
        {/* Professional Lens Details */}
        <g stroke="url(#goldAccent)" strokeWidth="0.5" opacity="0.6">
          <circle r="6.5" fill="none"/>
          <circle r="4.8" fill="none"/>
          <circle r="3.2" fill="none"/>
        </g>
      </g>
      
      {/* Elegant Accent Lines */}
      <g stroke="url(#goldGradient)" strokeWidth="1.2" opacity="0.7" strokeLinecap="round" className="animate-pulse">
        <line x1="30" y1="30" x2="24" y2="24"/>
        <line x1="50" y1="30" x2="56" y2="24"/>
        <line x1="30" y1="50" x2="24" y2="56"/>
        <line x1="50" y1="50" x2="56" y2="56"/>
      </g>
    </svg>
  )

  if (variant === 'icon') {
    return (
      <div className={`flex items-center ${className}`}>
        <ElegantDroneIcon />
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className={`flex items-center ${className}`}>
        <span className={`font-bold bg-gradient-to-r from-yellow-500 via-yellow-600 to-gray-900 bg-clip-text text-transparent ${
          size === 'sm' ? 'text-lg' : 
          size === 'md' ? 'text-xl' : 
          'text-2xl'
        }`}>
          Drönarkompaniet
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-6 ${className}`}>
      <div className="relative">
        <ElegantDroneIcon />
        {/* Elegant scanning effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent animate-scan pointer-events-none rounded-full"></div>
      </div>
      <div className="flex flex-col relative">
        {/* Main brand name with luxury effects */}
        <div className="relative overflow-hidden">
          <span className={`relative z-10 font-bold bg-gradient-to-r from-yellow-500 via-yellow-600 to-gray-900 bg-clip-text text-transparent leading-tight tracking-tight ${
            size === 'sm' ? 'text-base' : 
            size === 'md' ? 'text-lg' : 
            'text-xl'
          }`}>
            Drönarkompaniet
          </span>
          {/* Gold shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent animate-shimmer bg-[length:200%_100%] pointer-events-none"></div>
        </div>
        
        {/* Subtitle with elegant styling */}
        <div className="relative flex items-center space-x-2">
          <div className={`w-2 h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-600 ${
            size === 'sm' ? 'w-1' : size === 'md' ? 'w-2' : 'w-3'
          }`}></div>
          <span className={`font-semibold bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 bg-clip-text text-transparent tracking-wider uppercase ${
            size === 'sm' ? 'text-xs' : 
            size === 'md' ? 'text-sm' : 
            'text-base'
          }`}>
            LEVERANSPORTAL
          </span>
          <div className={`w-2 h-0.5 bg-gradient-to-r from-yellow-600 to-yellow-500 ${
            size === 'sm' ? 'w-1' : size === 'md' ? 'w-2' : 'w-3'
          }`}></div>
          {/* Elegant status indicator */}
          <div className={`w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse shadow-glow-sm ${
            size === 'sm' ? 'w-1 h-1' : size === 'md' ? 'w-1.5 h-1.5' : 'w-2 h-2'
          }`}></div>
        </div>
        
        {/* Elegant accent lines */}
        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-yellow-500/50 to-transparent"></div>
        <div className="absolute -right-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-yellow-600/50 to-transparent"></div>
      </div>
    </div>
  )
}
