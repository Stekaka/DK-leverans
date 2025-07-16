import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Test upload API called')
    
    // Kolla environment variables
    const envCheck = {
      CLOUDFLARE_R2_ENDPOINT: !!process.env.CLOUDFLARE_R2_ENDPOINT,
      CLOUDFLARE_R2_ACCESS_KEY_ID: !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: !!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      CLOUDFLARE_R2_BUCKET_NAME: !!process.env.CLOUDFLARE_R2_BUCKET_NAME,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
    
    console.log('Environment variables:', envCheck)
    
    const formData = await request.formData()
    const customerId = formData.get('customerId') as string
    const files = formData.getAll('files') as File[]
    
    console.log('Received data:', {
      customerId,
      filesCount: files.length,
      fileNames: files.map(f => f.name)
    })
    
    return NextResponse.json({
      success: true,
      message: 'Test upload successful',
      data: {
        customerId,
        filesCount: files.length,
        fileNames: files.map(f => f.name),
        envCheck
      }
    })
    
  } catch (error) {
    console.error('Test upload error:', error)
    return NextResponse.json({ 
      error: 'Test upload failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
