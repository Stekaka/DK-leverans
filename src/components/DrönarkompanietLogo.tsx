import React from 'react'
import Image from 'next/image'

interface DrönarkompanietLogoProps {
  className?: string
  width?: number
  height?: number
  size?: 'sm' | 'md' | 'lg'
}

export default function DrönarkompanietLogo({ 
  className = "", 
  width, 
  height,
  size = 'md'
}: DrönarkompanietLogoProps) {
  // Set dimensions based on size if width/height not provided
  let logoWidth = width
  let logoHeight = height
  
  if (!width || !height) {
    switch (size) {
      case 'sm':
        logoWidth = 120
        logoHeight = 36
        break
      case 'lg':
        logoWidth = 300
        logoHeight = 90
        break
      default: // 'md'
        logoWidth = 200
        logoHeight = 60
        break
    }
  }

  return (
    <Image
      src="/dronarkompaniet-logo.png"
      alt="Drönarkompaniet"
      width={logoWidth}
      height={logoHeight}
      className={className}
      priority
    />
  )
}
