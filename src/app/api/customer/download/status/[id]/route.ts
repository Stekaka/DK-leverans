import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// GET /api/customer/download/status/[id] - Check download status
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const downloadId = params.id
    
    // Verifierar session (samma som andra APIs)
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

    // Om jobbet är klart, generera temporär nedladdningslänk
    let downloadUrl = null
    if (job.status === 'completed' && job.zip_filename) {
      // Skapa temporär signerad URL (gäller i 1 timme)
      downloadUrl = `/api/customer/download/file/${downloadId}`
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress || 0,
      totalFiles: job.total_files,
      processedFiles: job.processed_files || 0,
      zipSize: job.zip_size,
      error: job.error,
      downloadUrl,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      expiresAt: job.expires_at
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 })
  }
}
