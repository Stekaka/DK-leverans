import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    serviceKeyStart: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 8) || 'undefined',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
  })
}
