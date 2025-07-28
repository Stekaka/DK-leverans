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

// PUT /api/customer/organize - Organisera fil (byt namn eller flytta till mapp)
export async function PUT(request: NextRequest) {
  try {
    const { fileId, displayName, customerFolderPath } = await request.json()

    // Validering
    if (!fileId) {
      return NextResponse.json({ error: 'Fil-ID krävs' }, { status: 400 })
    }

    if (!displayName && customerFolderPath === undefined) {
      return NextResponse.json({ error: 'Minst ett av displayName eller customerFolderPath krävs' }, { status: 400 })
    }

    // Verifiera customer session
    const customer = await verifyCustomerSession(request)

    // Kontrollera att filen tillhör kunden
    const { data: existingFile, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, original_name, folder_path, display_name, customer_folder_path')
      .eq('id', fileId)
      .eq('customer_id', customer.id)
      .eq('is_deleted', false)
      .single()

    if (fileError || !existingFile) {
      return NextResponse.json({ error: 'Filen hittades inte' }, { status: 404 })
    }

    console.log(`Organize API: Updating file ${fileId} for customer ${customer.id}`, {
      displayName,
      customerFolderPath,
      existingName: existingFile.display_name || existingFile.original_name,
      existingPath: existingFile.customer_folder_path
    })

    // Preparera uppdateringsdata
    const updateData: any = {
      organization_updated_at: new Date().toISOString()
    }

    if (displayName !== undefined) {
      // Validera filnamn (inga farliga tecken)
      const validName = displayName.trim()
      if (validName.length === 0) {
        return NextResponse.json({ error: 'Filnamn kan inte vara tomt' }, { status: 400 })
      }
      if (validName.length > 255) {
        return NextResponse.json({ error: 'Filnamn är för långt (max 255 tecken)' }, { status: 400 })
      }
      
      // Behåll fil-extension från ursprungligt namn om det inte finns i det nya namnet
      const originalExtension = existingFile.original_name.split('.').pop()
      if (originalExtension && !validName.includes('.')) {
        updateData.display_name = `${validName}.${originalExtension}`
      } else {
        updateData.display_name = validName
      }
    }

    if (customerFolderPath !== undefined) {
      // Validera mappsökväg
      const validPath = (customerFolderPath || '').trim()
      if (validPath.length > 500) {
        return NextResponse.json({ error: 'Mappsökväg är för lång (max 500 tecken)' }, { status: 400 })
      }
      
      // Rensa bort farliga tecken och normalisera sökvägen
      const cleanPath = validPath
        .replace(/[<>:"|?*]/g, '') // Ta bort farliga tecken
        .replace(/\/+/g, '/') // Normalisera flera snedstreck
        .replace(/^\/|\/$/g, '') // Ta bort ledande/avslutande snedstreck
      
      updateData.customer_folder_path = cleanPath
    }

    // Uppdatera filen
    const { data: updatedFile, error: updateError } = await supabaseAdmin
      .from('files')
      .update(updateData)
      .eq('id', fileId)
      .eq('customer_id', customer.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating file organization:', updateError)
      return NextResponse.json({ error: 'Kunde inte uppdatera filorganisation' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      file: {
        id: updatedFile.id,
        display_name: updatedFile.display_name,
        customer_folder_path: updatedFile.customer_folder_path,
        original_name: updatedFile.original_name,
        folder_path: updatedFile.folder_path,
        organization_updated_at: updatedFile.organization_updated_at
      }
    })

  } catch (error: any) {
    console.error('Customer Organization API Error:', error)
    if (error.message.includes('session') || error.message.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/customer/organize/folders - Hämta alla kundmappar
export async function GET(request: NextRequest) {
  try {
    // Verifiera customer session
    const customer = await verifyCustomerSession(request)

    // Hämta alla unika mappar som kunden har skapat
    const { data: folders, error } = await supabaseAdmin
      .from('files')
      .select('customer_folder_path')
      .eq('customer_id', customer.id)
      .eq('is_deleted', false)
      .not('customer_folder_path', 'is', null)

    if (error) {
      console.error('Error fetching customer folders:', error)
      return NextResponse.json({ error: 'Kunde inte hämta mappar' }, { status: 500 })
    }

    // Skapa unik lista av mappar och sortera dem
    const uniqueFolders = Array.from(
      new Set(
        (folders || [])
          .map(f => f.customer_folder_path)
          .filter(path => path && path.trim() !== '')
      )
    ).sort()

    return NextResponse.json({
      folders: uniqueFolders,
      total: uniqueFolders.length
    })

  } catch (error: any) {
    console.error('Customer Folders API Error:', error)
    if (error.message.includes('session') || error.message.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
