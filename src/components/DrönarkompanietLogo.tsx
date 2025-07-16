import React from 'react'
import Image from 'next/image'

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
    sm: { height: 32, width: 120 },
    md: { height: 48, width: 180 }, 
    lg: { height: 64, width: 240 }
  }

  const { height, width } = sizeClasses[size]

  if (variant === 'text') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <span className="font-bold text-xl text-yellow-400">Drönarkompaniet</span>
        <span className="text-sm text-gray-300 -mt-1">Leveransportal</span>
      </div>
    )
  }

  if (variant === 'icon') {
    return (
      <div className={`relative ${className}`} style={{ height, width: height }}>
        <Image
          src="/dronarkompaniet-logo.png"
          alt="Drönarkompaniet"
          width={height}
          height={height}
          className="object-contain filter drop-shadow-lg"
          priority
        />
      </div>
    )
  }

  // variant === 'full' - Logo med text under
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{ height, width }}>
        <Image
          src="/dronarkompaniet-logo.png"
          alt="Drönarkompaniet"
          width={width}
          height={height}
          className="object-contain filter drop-shadow-lg"
          priority
        />
      </div>
      <div className="flex flex-col items-center mt-2">
        <span className="font-bold text-lg text-yellow-400">Drönarkompaniet</span>
        <span className="text-sm text-gray-300 -mt-1">Leveransportal</span>
      </div>
    </div>
  )
}
