import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // Använd det enkla lösenordet
    const currentPassword = 'dk2025!'
    
    return NextResponse.json({
      currentAdminPassword: currentPassword,
      currentPasswordLength: currentPassword.length,
      message: 'Using simplified password',
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
