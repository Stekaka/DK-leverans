import { NextRequest, NextResponse } from 'next/server'
import { r2Service } from '../../../../../lib/cloudflare-r2'

export async function GET() {
  try {
    // Kontrollera miljövariabler
    const envCheck = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasR2AccountId: !!process.env.CLOUDFLARE_R2_ACCOUNT_ID,
      hasR2AccessKey: !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      hasR2SecretKey: !!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      hasR2Bucket: !!process.env.CLOUDFLARE_R2_BUCKET_NAME,
      hasAdminUsername: !!process.env.ADMIN_USERNAME,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
    }

    const missingVars = Object.entries(envCheck)
      .filter(([_, hasVar]) => !hasVar)
      .map(([varName]) => varName)

    // Testa R2-anslutning
    let r2Test = { success: false, message: 'Not tested' }
    if (envCheck.hasR2AccountId && envCheck.hasR2AccessKey && envCheck.hasR2SecretKey && envCheck.hasR2Bucket) {
      r2Test = await r2Service.testConnection()
    }

    return NextResponse.json({
      status: 'ok',
      environmentCheck: envCheck,
      missingVariables: missingVars,
      r2ConnectionTest: r2Test,
      timestamp: new Date().toISOString(),
      region: process.env.VERCEL_REGION || 'local',
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Test upload endpoint called')
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))
    
    const formData = await request.formData()
    console.log('FormData keys:', Array.from(formData.keys()))
    
    return NextResponse.json({
      status: 'test-success',
      message: 'Test upload endpoint working',
      formDataKeys: Array.from(formData.keys()),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Test upload error:', error)
    return NextResponse.json({
      status: 'test-error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
