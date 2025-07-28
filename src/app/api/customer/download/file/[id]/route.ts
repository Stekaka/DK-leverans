import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../../../lib/cloudflare-r2'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// GET /api/customer/download/file/[id] - Download the completed ZIP
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const downloadId = params.id
    
    // Verifierar session
    const sessionToken = request.cookies.get('customer_session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Ingen session' }, { status: 401 })
    }

    let customerId: string
    try {
      const decoded = Buffer.from(sessionToken, 'base64').toString()
      customerId = decoded.split(':')[0]
    } catch {
      return NextResponse.json({ error: 'Ogiltig session' }, { status: 401 })
    }

    // Hämta download job
    const { data: job, error } = await supabaseAdmin
      .from('download_jobs')
      .select('*')
      .eq('id', downloadId)
      .eq('customer_id', customerId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 })
    }

    if (job.status !== 'completed' || !job.zip_filename) {
      return NextResponse.json({ error: 'Download not ready' }, { status: 400 })
    }

    // Kontrollera att jobbet inte har upphört
    if (new Date(job.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Download har upphört' }, { status: 410 })
    }

    // Hämta ZIP-filen från R2
    const zipBuffer = await r2Service.getFile(job.zip_filename)
    
    // Extrahera filnamn från zip_filename
    const fileName = job.zip_filename.split('/').pop() || 'download.zip'

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error('File download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
