'use server'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Hårdkodad admin-inloggning för nu
    if (username === 'admin' && password === 'dk2025!') {
      // Skapa admin session
      const cookieStore = await cookies()
      cookieStore.set('admin-session', 'authenticated', {
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
