import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Skapa respons som rensar session-cookies
    const response = NextResponse.json({ success: true, message: 'Utloggad' })
    
    // Rensa admin session cookie (om den finns)
    response.cookies.delete('admin_session')
    
    // Rensa customer session cookie också för säkerhets skull
    response.cookies.delete('customer_session')
    
    return response
  } catch (error) {
    console.error('Admin logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
