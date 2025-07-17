import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

interface UploadCallbackRequest {
  customerId: string
  uploadedFiles: {
    fileKey: string
    originalName: string
    size: number
    type: string
    folderPath: string
  }[]
  duplicateAction?: 'skip' | 'replace' // För dubbletthantering
}

interface FileProcessResult {
  fileKey: string
  originalName: string
  status: 'inserted' | 'skipped' | 'replaced' | 'error'
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 === SMART UPLOAD CALLBACK ===')
    console.log('📅 Timestamp:', new Date().toISOString())
    
    // Autentisering
    const adminPassword = request.headers.get('x-admin-password')
    const validPasswords = [
      'DronarkompanietAdmin2025!',
      'DrönarkompanietAdmin2025!',
      process.env.ADMIN_PASSWORD,
      'admin123'
    ].filter(p => p)
    
    if (!adminPassword || !validPasswords.includes(adminPassword)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UploadCallbackRequest = await request.json()
    const { customerId, uploadedFiles, duplicateAction = 'skip' } = body

    console.log('📝 Processing:', uploadedFiles.length, 'files for customer:', customerId)
    console.log('🔄 Duplicate action:', duplicateAction)

    const results: FileProcessResult[] = []

    // Bearbeta varje fil individuellt för bättre felhantering
    for (const file of uploadedFiles) {
      try {
        // Kontrollera om fil redan finns
        const { data: existingFile, error: checkError } = await supabase
          .from('files')
          .select('id, original_name, filename')
          .eq('customer_id', customerId)
          .eq('original_name', file.originalName)
          .eq('is_deleted', false)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          // Fel vid kontroll (inte "inga rader funna")
          console.error(`❌ Error checking duplicate for ${file.originalName}:`, checkError)
          results.push({
            fileKey: file.fileKey,
            originalName: file.originalName,
            status: 'error',
            error: `Check failed: ${checkError.message}`
          })
          continue
        }

        if (existingFile) {
          // Fil med samma namn finns redan
          console.log(`🔄 Duplicate found for ${file.originalName}`)
          
          if (duplicateAction === 'skip') {
            results.push({
              fileKey: file.fileKey,
              originalName: file.originalName,
              status: 'skipped'
            })
            console.log(`⏭️ Skipped duplicate: ${file.originalName}`)
            continue
          } else if (duplicateAction === 'replace') {
            // Ersätt befintlig fil
            const { error: updateError } = await supabase
              .from('files')
              .update({
                filename: file.fileKey,
                file_size: file.size,
                file_type: file.type,
                folder_path: file.folderPath,
                cloudflare_url: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${file.fileKey}`,
                uploaded_at: new Date().toISOString()
              })
              .eq('id', existingFile.id)

            if (updateError) {
              console.error(`❌ Error replacing ${file.originalName}:`, updateError)
              results.push({
                fileKey: file.fileKey,
                originalName: file.originalName,
                status: 'error',
                error: `Replace failed: ${updateError.message}`
              })
            } else {
              results.push({
                fileKey: file.fileKey,
                originalName: file.originalName,
                status: 'replaced'
              })
              console.log(`🔄 Replaced: ${file.originalName}`)
            }
            continue
          }
        }

        // Ny fil - infoga
        const dbFile = {
          customer_id: customerId,
          filename: file.fileKey,
          original_name: file.originalName,
          file_size: file.size,
          file_type: file.type,
          folder_path: file.folderPath || null,
          cloudflare_url: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${file.fileKey}`,
          uploaded_at: new Date().toISOString(),
          is_deleted: false
        }

        const { error: insertError } = await supabase
          .from('files')
          .insert([dbFile])

        if (insertError) {
          console.error(`❌ Error inserting ${file.originalName}:`, insertError)
          results.push({
            fileKey: file.fileKey,
            originalName: file.originalName,
            status: 'error',
            error: `Insert failed: ${insertError.message}`
          })
        } else {
          results.push({
            fileKey: file.fileKey,
            originalName: file.originalName,
            status: 'inserted'
          })
          console.log(`✅ Inserted: ${file.originalName}`)
        }

      } catch (fileError) {
        console.error(`❌ Unexpected error processing ${file.originalName}:`, fileError)
        results.push({
          fileKey: file.fileKey,
          originalName: file.originalName,
          status: 'error',
          error: `Unexpected error: ${fileError instanceof Error ? fileError.message : 'Unknown'}`
        })
      }
    }

    // Sammanfatta resultat
    const summary = {
      total: results.length,
      inserted: results.filter(r => r.status === 'inserted').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      replaced: results.filter(r => r.status === 'replaced').length,
      errors: results.filter(r => r.status === 'error').length
    }

    console.log('📊 Processing summary:', summary)

    return NextResponse.json({
      success: true,
      summary,
      results,
      message: `Processed ${summary.total} files: ${summary.inserted} inserted, ${summary.skipped} skipped, ${summary.replaced} replaced, ${summary.errors} errors`
    })

  } catch (error) {
    console.error('❌ Callback error:', error)
    return NextResponse.json({ 
      error: 'Callback failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
