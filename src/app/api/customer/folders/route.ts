import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Hämta alla mappar för kunden (från files och folders tabeller)
    const { data: fileFolders, error: fileError } = await supabaseAdmin
      .from('files')
      .select('folder_path')
      .eq('customer_id', customer.id)
      .eq('is_deleted', false)

    const { data: explicitFolders, error: folderError } = await supabaseAdmin
      .from('folders')
      .select('folder_path')
      .eq('customer_id', customer.id)

    if (fileError || folderError) {
      console.error('Error fetching folders:', fileError || folderError)
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
    }

    // Kombinera alla mappar och ta bort dubletter
    const allFolderPaths = new Set(['']) // Start med rot
    
    // Lägg till mappar från filer
    fileFolders?.forEach(f => {
      if (f.folder_path) {
        allFolderPaths.add(f.folder_path)
        // Lägg till föräldermappar för nested paths
        const parts = f.folder_path.split('/')
        for (let i = 1; i < parts.length; i++) {
          allFolderPaths.add(parts.slice(0, i).join('/'))
        }
      }
    })

    // Lägg till explicit skapade mappar
    explicitFolders?.forEach(f => {
      allFolderPaths.add(f.folder_path)
      // Lägg till föräldermappar för nested paths
      const parts = f.folder_path.split('/')
      for (let i = 1; i < parts.length; i++) {
        allFolderPaths.add(parts.slice(0, i).join('/'))
      }
    })

    return NextResponse.json({
      folders: Array.from(allFolderPaths).sort()
    })

  } catch (error: any) {
    console.error('Customer Folders API Error:', error)
    if (error.message.includes('session') || error.message.includes('Session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
