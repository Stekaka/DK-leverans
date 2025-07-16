import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // Enkel miljövariabel-kontroll UTAN autentisering
    return NextResponse.json({
      adminPasswordSet: !!process.env.ADMIN_PASSWORD,
      adminPasswordPreview: process.env.ADMIN_PASSWORD ? `${process.env.ADMIN_PASSWORD.substring(0, 15)}...` : 'NOT SET',
      adminPasswordLength: process.env.ADMIN_PASSWORD?.length || 0,
      r2Set: !!process.env.CLOUDFLARE_R2_BUCKET_NAME,
      supabaseSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to check environment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
