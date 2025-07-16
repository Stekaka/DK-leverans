import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Service } from '../../../../../lib/cloudflare-r2'

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
