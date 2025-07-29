import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    const fileId = searchParams.get('file_id')

    if (!customerId) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    }

    // Hämta alla filer från databasen för denna kund
    const { data: files, error: dbError } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .eq('is_trashed', false)

    if (dbError) {
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 })
    }

    console.log(`[FILE-SYNC-DEBUG] Found ${files?.length || 0} files in database for customer ${customerId}`)

    // Testa varje fil för tillgänglighet
    const fileTests = await Promise.all(
      (files || []).map(async (file) => {
        const testResult = {
          id: file.id,
          original_name: file.original_name,
          display_name: file.display_name,
          filename: file.filename,
          file_size: file.file_size,
          file_type: file.file_type,
          database_ok: true,
          r2_accessible: false,
          r2_error: null as string | null,
          download_url_ok: false,
          download_url_error: null as string | null,
          uploaded_at: file.uploaded_at
        }

        // Testa R2 tillgänglighet
        try {
          console.log(`[FILE-SYNC-DEBUG] Testing R2 access for: ${file.filename}`)
          await r2Service.getFile(file.filename)
          testResult.r2_accessible = true
          console.log(`[FILE-SYNC-DEBUG] ✅ R2 file accessible: ${file.filename}`)
        } catch (error) {
          testResult.r2_error = error instanceof Error ? error.message : String(error)
          console.log(`[FILE-SYNC-DEBUG] ❌ R2 file NOT accessible: ${file.filename} - ${testResult.r2_error}`)
        }

        // Testa signed URL generering
        try {
          await r2Service.getSignedDownloadUrl(file.filename, 60) // 1 minut
          testResult.download_url_ok = true
          console.log(`[FILE-SYNC-DEBUG] ✅ Download URL generation OK: ${file.filename}`)
        } catch (error) {
          testResult.download_url_error = error instanceof Error ? error.message : String(error)
          console.log(`[FILE-SYNC-DEBUG] ❌ Download URL generation FAILED: ${file.filename} - ${testResult.download_url_error}`)
        }

        return testResult
      })
    )

    // Filtrera problemfiler
    const problemFiles = fileTests.filter(f => !f.r2_accessible || !f.download_url_ok)
    const healthyFiles = fileTests.filter(f => f.r2_accessible && f.download_url_ok)

    console.log(`[FILE-SYNC-DEBUG] Summary: ${healthyFiles.length} healthy, ${problemFiles.length} problem files`)

    // Om en specifik fil efterfrågas
    if (fileId) {
      const specificFile = fileTests.find(f => f.id === fileId)
      if (!specificFile) {
        return NextResponse.json({ error: 'File not found in database' }, { status: 404 })
      }
      return NextResponse.json({ file: specificFile })
    }

    return NextResponse.json({
      customer_id: customerId,
      total_files: fileTests.length,
      healthy_files: healthyFiles.length,
      problem_files: problemFiles.length,
      files: fileTests,
      problem_summary: problemFiles.map(f => ({
        id: f.id,
        name: f.original_name,
        r2_accessible: f.r2_accessible,
        r2_error: f.r2_error,
        download_url_ok: f.download_url_ok,
        download_url_error: f.download_url_error
      }))
    })

  } catch (error) {
    console.error('[FILE-SYNC-DEBUG] Error:', error)
    return NextResponse.json({
      error: 'Debug API error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
