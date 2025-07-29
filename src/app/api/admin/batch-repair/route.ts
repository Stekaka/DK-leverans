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

export async function POST(request: NextRequest) {
  try {
    const { customer_id, batch_size = 50, skip_r2_check = false } = await request.json()

    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    }

    console.log(`[BATCH-REPAIR] Starting batch repair for customer ${customer_id} (batch_size: ${batch_size})`)

    // Hämta alla filer för kunden
    const { data: files, error: dbError } = await supabaseAdmin
      .from('files')
      .select('id, original_name, filename, file_size, is_deleted')
      .eq('customer_id', customer_id)
      .eq('is_deleted', false)
      .limit(1000) // Safety limit

    if (dbError) {
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 })
    }

    const totalFiles = files?.length || 0
    console.log(`[BATCH-REPAIR] Found ${totalFiles} files to check`)

    if (skip_r2_check) {
      // Riskabel men snabb lösning: markera alla som borttagna utan R2-kontroll
      console.log(`[BATCH-REPAIR] SKIP R2 CHECK MODE - marking all files as deleted`)
      
      const fileIds = files?.map(f => f.id) || []
      
      if (fileIds.length > 0) {
        const { error: bulkUpdateError } = await supabaseAdmin
          .from('files')
          .update({ 
            is_deleted: true,
            // deleted_at: new Date().toISOString(), // Column doesn't exist
            // deletion_reason: 'Bulk deletion - R2 sync issues' // Column doesn't exist
          })
          .in('id', fileIds)

        if (bulkUpdateError) {
          return NextResponse.json({ 
            error: 'Bulk update failed', 
            details: bulkUpdateError 
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          mode: 'BULK_DELETE',
          customer_id,
          total_files: totalFiles,
          deleted_files: fileIds.length,
          message: `BULK MODE: Marked ${fileIds.length} files as deleted without R2 check`
        })
      }
    }

    // Normal batch processing (limited for timeout)
    const batchResults = {
      total_files: totalFiles,
      processed: 0,
      accessible_files: 0,
      marked_as_deleted: 0,
      errors: [] as string[]
    }

    // Process only first batch to avoid timeout
    const batch = files?.slice(0, batch_size) || []
    console.log(`[BATCH-REPAIR] Processing first ${batch.length} files`)

    for (const file of batch) {
      try {
        // Quick timeout check for each file
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('File check timeout')), 3000)
        )

        try {
          // This would timeout on missing files, which is what we want to catch
          await Promise.race([
            fetch(`${process.env.CLOUDFLARE_R2_ENDPOINT || 'dummy'}/${file.filename}`, { method: 'HEAD' }),
            timeoutPromise
          ])
          
          batchResults.accessible_files++
          console.log(`[BATCH-REPAIR] ✅ ${file.original_name}`)
        } catch (checkError) {
          // File likely missing - mark as deleted
          console.log(`[BATCH-REPAIR] ❌ Missing: ${file.original_name}`)
          
          const { error: updateError } = await supabaseAdmin
            .from('files')
            .update({ 
              is_deleted: true,
              // deleted_at: new Date().toISOString(), // Column doesn't exist
              // deletion_reason: 'File not accessible during batch repair' // Column doesn't exist
            })
            .eq('id', file.id)

          if (updateError) {
            batchResults.errors.push(`Failed to mark ${file.original_name} as deleted`)
          } else {
            batchResults.marked_as_deleted++
          }
        }

        batchResults.processed++
      } catch (error) {
        batchResults.errors.push(`Error processing ${file.original_name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'BATCH_PROCESS',
      customer_id,
      results: batchResults,
      remaining_files: Math.max(0, totalFiles - batch_size),
      message: `Processed ${batchResults.processed}/${totalFiles} files. ${batchResults.marked_as_deleted} marked as deleted.`
    })

  } catch (error) {
    console.error('[BATCH-REPAIR] Error:', error)
    return NextResponse.json({
      error: 'Batch repair failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
