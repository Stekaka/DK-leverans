import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // Returnera potentiella lösenord för debug
    const possiblePasswords = [
      'DrönarkompanietAdmin2025!',
      'admin123', 
      'admin',
      'Admin2025!',
      'DronarkompanietAdmin2025!', // utan ö
      process.env.ADMIN_PASSWORD || 'NOT_SET'
    ]

    return NextResponse.json({
      currentAdminPassword: process.env.ADMIN_PASSWORD || 'NOT_SET',
      currentPasswordLength: process.env.ADMIN_PASSWORD?.length || 0,
      possiblePasswords: possiblePasswords,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV
      }
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to check passwords',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
