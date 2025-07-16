import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'
import { deleteThumbnail, getThumbnailPath } from '../../../../../lib/thumbnail-generator'

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
    const customerId = searchParams.get('customerId')
    const folderPath = searchParams.get('folderPath') // För att filtrera på specifik mapp

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    // Bygg query för filer
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)

    // Filtrera på mapp om specificerad
    if (folderPath !== null) {
      query = query.eq('folder_path', folderPath || '')
    }

    const { data: files, error } = await query.order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching files:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Lägg till formaterad filstorlek och generera nedladdningslänkar
    const filesWithDetails = await Promise.all(
      (files || []).map(async (file) => {
        try {
          // Generera signerad URL för säker nedladdning
          const downloadUrl = await r2Service.getSignedDownloadUrl(file.filename, 3600) // 1 timme
          
          return {
            ...file,
            formatted_size: r2Service.formatFileSize(file.file_size),
            download_url: downloadUrl,
            file_extension: file.original_name.split('.').pop()?.toLowerCase() || '',
            is_image: file.file_type.startsWith('image/'),
            is_video: file.file_type.startsWith('video/'),
            folder_display: file.folder_path || 'Rot'
          }
        } catch (urlError) {
          console.error(`Error generating URL for file ${file.id}:`, urlError)
          return {
            ...file,
            formatted_size: r2Service.formatFileSize(file.file_size),
            download_url: null,
            file_extension: file.original_name.split('.').pop()?.toLowerCase() || '',
            is_image: file.file_type.startsWith('image/'),
            is_video: file.file_type.startsWith('video/'),
            folder_display: file.folder_path || 'Rot',
            error: 'Failed to generate download URL'
          }
        }
      })
    )

    return NextResponse.json({
      files: filesWithDetails,
      total_files: filesWithDetails.length,
      total_size: files?.reduce((acc, file) => acc + file.file_size, 0) || 0
    })

  } catch (error) {
    console.error('Files API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    const customerId = searchParams.get('customerId')

    if (!fileId || !customerId) {
      return NextResponse.json({ 
        error: 'File ID and Customer ID are required' 
      }, { status: 400 })
    }

    // Hämta filinformation först
    const { data: file, error: fetchError } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .single()

    if (fetchError || !file) {
      return NextResponse.json({ 
        error: 'File not found' 
      }, { status: 404 })
    }

    try {
      // Ta bort från R2
      await r2Service.deleteFile(file.file_path)
      console.log(`✅ Deleted file from R2: ${file.file_path}`)
      
      // Ta bort thumbnail om det finns
      if (file.thumbnail_url) {
        const thumbnailPath = getThumbnailPath(file.file_path, 'jpeg')
        await deleteThumbnail(thumbnailPath)
        console.log(`✅ Deleted thumbnail: ${thumbnailPath}`)
      }
      
    } catch (r2Error) {
      console.error('Warning: Failed to delete from R2:', r2Error)
      // Fortsätt ändå för att markera som borttagen i databasen
    }

    // Markera som borttagen i databasen (soft delete)
    const { error: deleteError } = await supabaseAdmin
      .from('files')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', fileId)
      .eq('customer_id', customerId)

    if (deleteError) {
      console.error('Database delete error:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete file from database',
        details: deleteError.message
      }, { status: 500 })
    }

    console.log(`✅ File ${file.filename} deleted successfully`)

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
      deletedFile: {
        id: file.id,
        filename: file.filename,
        file_path: file.file_path
      }
    })

  } catch (error) {
    console.error('File deletion error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
