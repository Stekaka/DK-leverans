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

export async function POST(request: NextRequest) {
  try {
    const { customer_id } = await request.json()

    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    }

    console.log(`[FILE-REPAIR] Starting repair process for customer ${customer_id}`)

    // Hämta alla filer för kunden
    const { data: files, error: dbError } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('is_deleted', false)

    if (dbError) {
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 })
    }

    const repairResults = {
      total_files: files?.length || 0,
      accessible_files: 0,
      inaccessible_files: 0,
      marked_as_deleted: 0,
      errors: [] as string[]
    }

    // Kontrollera varje fil
    for (const file of files || []) {
      try {
        console.log(`[FILE-REPAIR] Checking file: ${file.original_name} (${file.filename})`)
        
        try {
          // Försök hämta filen från R2
          await r2Service.getFile(file.filename)
          repairResults.accessible_files++
          console.log(`[FILE-REPAIR] ✅ File accessible: ${file.original_name}`)
        } catch (r2Error) {
          console.log(`[FILE-REPAIR] ❌ File not accessible: ${file.original_name} - ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`)
          repairResults.inaccessible_files++
          
          // Om filen inte finns i R2, markera som borttagen i databasen
          if (r2Error instanceof Error && (
            r2Error.message.includes('NoSuchKey') || 
            r2Error.message.includes('Not Found') ||
            r2Error.message.includes('does not exist')
          )) {
            console.log(`[FILE-REPAIR] Marking file as deleted: ${file.id}`)
            
            const { error: updateError } = await supabaseAdmin
              .from('files')
              .update({ 
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deletion_reason: 'File not found in R2 storage during repair'
              })
              .eq('id', file.id)

            if (updateError) {
              repairResults.errors.push(`Failed to mark file ${file.original_name} as deleted: ${updateError.message}`)
            } else {
              repairResults.marked_as_deleted++
              console.log(`[FILE-REPAIR] Successfully marked file as deleted: ${file.original_name}`)
            }
          } else {
            repairResults.errors.push(`File ${file.original_name}: ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`)
          }
        }
      } catch (error) {
        const errorMsg = `Unexpected error checking file ${file.original_name}: ${error instanceof Error ? error.message : String(error)}`
        repairResults.errors.push(errorMsg)
        console.error(`[FILE-REPAIR] ${errorMsg}`)
      }
    }

    console.log(`[FILE-REPAIR] Repair complete:`, repairResults)

    return NextResponse.json({
      success: true,
      customer_id,
      results: repairResults,
      message: `Repair complete. ${repairResults.accessible_files} files OK, ${repairResults.inaccessible_files} had issues, ${repairResults.marked_as_deleted} marked as deleted.`
    })

  } catch (error) {
    console.error('[FILE-REPAIR] Error:', error)
    return NextResponse.json({
      error: 'Repair process failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
