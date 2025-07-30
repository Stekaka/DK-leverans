import { NextRequest, NextResponse } from 'next/server'

// MINIMAL HELLO WORLD TEST
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Hello from prebuilt-zip API!",
    timestamp: new Date().toISOString(),
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({
      message: "POST received",
      body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      error: "Failed to parse JSON",
      timestamp: new Date().toISOString()
    }, { status: 400 })
  }
}
