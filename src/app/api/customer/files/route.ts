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

    // Kontrollera access med vår SQL-funktion
    const { data: accessCheck, error: accessError } = await supabaseAdmin
      .rpc('check_customer_access', { customer_uuid: customer.id })

    if (accessError) {
      console.error('Error checking customer access:', accessError)
      return NextResponse.json({ error: 'Failed to check access' }, { status: 500 })
    }

    const accessInfo = accessCheck[0]

    // Om access har upphört, returnera meddelande istället för filer
    if (!accessInfo.has_access) {
      return NextResponse.json({
        error: 'Access expired',
        message: 'Din åtkomst till filerna har upphört. Kontakta oss för att förlänga.',
        accessExpired: true,
        expiredAt: accessInfo.expires_at,
        canExtend: true // Kunden kan kontakta för förlängning
      }, { status: 403 })
    }

    // Kontrollera storage limit för permanent access
    if (accessInfo.access_type === 'permanent' && accessInfo.storage_limit_gb > 0) {
      if (accessInfo.storage_used_gb > accessInfo.storage_limit_gb) {
        return NextResponse.json({
          error: 'Storage limit exceeded',
          message: `Du har överskridit din lagringsgräns på ${accessInfo.storage_limit_gb} GB. Kontakta oss för att uppgradera.`,
          storageExceeded: true,
          storageUsed: accessInfo.storage_used_gb,
          storageLimit: accessInfo.storage_limit_gb
        }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const folderPath = searchParams.get('folderPath') // För mappfiltrering

    // Bygg query för filer
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('is_deleted', false)

    // Filtrera på mapp om specificerad (använd customer_folder_path för kundvy, fallback till folder_path)
    if (folderPath !== null) {
      // För att matcha både customer_folder_path och folder_path (fallback)
      query = query.or(`customer_folder_path.eq.${folderPath || ''},and(customer_folder_path.is.null,folder_path.eq.${folderPath || ''})`)
    }

    const { data: files, error } = await query.order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching customer files:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`Fetched ${files?.length || 0} files for customer ${customer.id}`)
    if (files && files.length > 0) {
      console.log('Sample file data:', {
        id: files[0].id,
        customer_rating: files[0].customer_rating,
        customer_notes: files[0].customer_notes ? 'has notes' : 'no notes'
      })
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
      access: {
        type: accessInfo.access_type,
        expiresAt: accessInfo.expires_at,
        daysRemaining: accessInfo.days_remaining,
        storageUsedGb: accessInfo.storage_used_gb,
        storageLimitGb: accessInfo.storage_limit_gb,
        isPermanent: accessInfo.access_type === 'permanent'
      }
    })

  } catch (error: any) {
    console.error('Customer Files API Error:', error)
    if (error.message.includes('session') || error.message.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
