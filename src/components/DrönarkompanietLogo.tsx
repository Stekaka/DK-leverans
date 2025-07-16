import React from 'react'
import Image from 'next/image'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function DrönarkompanietLogo({ 
  className = '', 
  size = 'md'
}: LogoProps) {
  const sizeClasses = {
    sm: { height: 32, width: 80 },
    md: { height: 48, width: 120 }, 
    lg: { height: 64, width: 160 }
  }

  const { height, width } = sizeClasses[size]

  return (
    <div className={`relative ${className}`} style={{ height, width }}>
      <Image
        src="/dronarkompaniet-logo.png"
        alt="Drönarkompaniet"
        width={width}
        height={height}
        className="object-contain filter drop-shadow-lg"
        priority
      />
    </div>
  )
}
