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

// Hjälpfunktion för att verifiera customer session
async function verifyCustomerSession(request: NextRequest) {
  const sessionToken = request.cookies.get('customer_session')?.value

  if (!sessionToken) {
    throw new Error('Ingen session hittades')
  }

  let customerId: string
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString()
    customerId = decoded.split(':')[0]
  } catch {
    throw new Error('Ogiltig session')
  }

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, project, status')
    .eq('id', customerId)
    .eq('status', 'active')
    .single()

  if (error || !customer) {
    throw new Error('Session har upphört')
  }

  return customer
}

export async function GET(request: NextRequest) {
  try {
    // Verifiera customer session
    const customer = await verifyCustomerSession(request)

    const { searchParams } = new URL(request.url)
    const folderPath = searchParams.get('folderPath') // För mappfiltrering
    const viewMode = searchParams.get('view') // 'all', 'trash' för papperskorg, annars mappfiltrering

    // Bygg query för filer
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('is_deleted', false)

    // Hantera papperskorg-vy
    if (viewMode === 'trash') {
      query = query.eq('is_trashed', true)
    } else {
      // Normal vy OCH "all"-vy: visa bara filer som inte är i papperskorgen
      query = query.eq('is_trashed', false)
      
      // Filtrera på mapp om specificerad och inte "alla filer"-vy
      if (folderPath !== null && viewMode !== 'all') {
        if (folderPath === '') {
          // Root-mapp: visa bara filer som faktiskt ligger i root
          // (customer_folder_path är null eller tom sträng)
          query = query.or(`customer_folder_path.is.null,customer_folder_path.eq.`)
        } else {
          // Specifik mapp: visa bara filer med exakt denna customer_folder_path
          query = query.eq('customer_folder_path', folderPath)
        }
      }
    }
    // Nu filtrerar ALLA normala vyer (inklusive 'all') bort is_trashed=true filer
    // Bara 'trash'-vyn visar papperskorg-filer

    const { data: files, error } = await query.order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching customer files:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Debug: Logga hur många filer som hittades och deras trash-status
    console.log(`Files API: Found ${files?.length || 0} files for viewMode=${viewMode}, customer=${customer.id}`)
    if (files) {
      const trashedCount = files.filter(f => f.is_trashed).length
      const normalCount = files.filter(f => !f.is_trashed).length
      console.log(`Files breakdown: ${normalCount} normal, ${trashedCount} trashed`)
    }

    // Hämta access-information separat (icke-blockerande)
    let accessInfo = null
    try {
      const { data: accessCheck, error: accessError } = await supabaseAdmin
        .rpc('check_customer_access', { customer_uuid: customer.id })

      if (!accessError && accessCheck && accessCheck[0]) {
        accessInfo = accessCheck[0]
      }
    } catch (accessError) {
      console.error('Error checking access (non-blocking):', accessError)
      // Fortsätt ändå med filvisning
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
            file_extension: (file.display_name || file.original_name).split('.').pop()?.toLowerCase() || '',
            is_image: file.file_type.startsWith('image/'),
            is_video: file.file_type.startsWith('video/'),
            folder_display: file.customer_folder_path || file.folder_path || 'Rot',
            uploaded_date: new Date(file.uploaded_at).toLocaleDateString('sv-SE'),
            // Använd display_name om det finns, annars original_name
            name_for_display: file.display_name || file.original_name,
            // Behåll båda för referens
            original_name: file.original_name,
            display_name: file.display_name
          }
        } catch (urlError) {
          console.error(`Error generating URL for file ${file.id}:`, urlError)
          return {
            ...file,
            formatted_size: r2Service.formatFileSize(file.file_size),
            download_url: null,
            file_extension: (file.display_name || file.original_name).split('.').pop()?.toLowerCase() || '',
            is_image: file.file_type.startsWith('image/'),
            is_video: file.file_type.startsWith('video/'),
            folder_display: file.customer_folder_path || file.folder_path || 'Rot',
            uploaded_date: new Date(file.uploaded_at).toLocaleDateString('sv-SE'),
            error: 'Failed to generate download URL',
            // Använd display_name om det finns, annars original_name
            name_for_display: file.display_name || file.original_name,
            // Behåll båda för referens
            original_name: file.original_name,
            display_name: file.display_name
          }
        }
      })
    )

    return NextResponse.json({
      files: filesWithDetails,
      total_files: filesWithDetails.length,
      total_size: files?.reduce((acc, file) => acc + file.file_size, 0) || 0,
      customer: {
        name: customer.name,
        project: customer.project
      },
      access: accessInfo ? {
        type: accessInfo.access_type,
        expiresAt: accessInfo.expires_at,
        daysRemaining: accessInfo.days_remaining,
        storageUsedGb: accessInfo.storage_used_gb,
        storageLimitGb: accessInfo.storage_limit_gb,
        isPermanent: accessInfo.access_type === 'permanent',
        hasAccess: accessInfo.has_access
      } : null
    })

  } catch (error: any) {
    console.error('Customer Files API Error:', error)
    if (error.message.includes('session') || error.message.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
