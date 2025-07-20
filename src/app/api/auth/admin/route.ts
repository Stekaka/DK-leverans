'use server'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    // Hämta admin-lösenord från environment variable
    const adminPassword = process.env.ADMIN_PASSWORD || 'dk2025!'

    // Verifiera admin-inloggning
    if (username === 'admin' && password === adminPassword) {
      // Skapa admin session token (base64 av lösenordet för enkel verifiering)
      const sessionToken = Buffer.from(adminPassword).toString('base64')
      
      const cookieStore = await cookies()
      cookieStore.set('admin_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 // 24 timmar
      })

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Felaktiga inloggningsuppgifter' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid inloggning' },
      { status: 500 }
    )
  }
}
