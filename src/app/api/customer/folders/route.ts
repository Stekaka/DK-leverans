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

export async function GET(request: NextRequest) {
  try {
    // Verifiera customer session
    const customer = await verifyCustomerSession(request)

    const { searchParams } = new URL(request.url)
    const parentPath = searchParams.get('parent') || searchParams.get('parentPath') || ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    console.log(`Folders API: customer=${customer.id}, parent="${parentPath}", sort=${sortBy}_${sortOrder}`)

    // Hämta alla unika mappsökvägar för kunden
    let query = supabaseAdmin
      .from('files')
      .select('customer_folder_path')
      .eq('customer_id', customer.id)
      .eq('is_deleted', false)
      .eq('is_trashed', false)
      .not('customer_folder_path', 'is', null)
      .not('customer_folder_path', 'eq', '')

    const { data: folderData, error } = await query

    if (error) {
      console.error('Error fetching folders:', error)
      return NextResponse.json({ 
        error: 'Kunde inte hämta mappar', 
        details: String(error) || 'Okänt fel'
      }, { status: 500 })
    }

    // Extrahera unika mappnamn och filtrera baserat på parent
    const folderPaths = new Set<string>()
    
    folderData?.forEach(item => {
      if (item.customer_folder_path) {
        const path = item.customer_folder_path
        
        // Om vi söker efter en specifik parent-mapp
        if (parentPath) {
          if (path.startsWith(parentPath + '/')) {
            // Hämta nästa nivå efter parent
            const relativePath = path.substring(parentPath.length + 1)
            const nextFolder = relativePath.split('/')[0]
            if (nextFolder) {
              folderPaths.add(parentPath + '/' + nextFolder)
            }
          }
        } else {
          // Root-nivå: bara första delen av sökvägen
          const firstFolder = path.split('/')[0]
          if (firstFolder) {
            folderPaths.add(firstFolder)
          }
        }
      }
    })

    // Konvertera till array och sortera
    let folders = Array.from(folderPaths).map(path => {
      const name = path.split('/').pop() || path
      return {
        id: path,
        name: name,
        path: path,
        type: 'folder' as const,
        created_at: new Date().toISOString() // Placeholder
      }
    })

    // Sortera mapparna
    folders.sort((a, b) => {
      let compareA: string | number = a.name
      let compareB: string | number = b.name
      
      if (sortBy === 'date') {
        compareA = a.created_at
        compareB = b.created_at
      }
      
      if (typeof compareA === 'string' && typeof compareB === 'string') {
        const result = compareA.localeCompare(compareB, 'sv')
        return sortOrder === 'desc' ? -result : result
      }
      
      return 0
    })

    console.log(`Folders API: Found ${folders.length} folders in "${parentPath}"`)

    // Extract just the folder names as strings for React compatibility
    const folderNames = folders.map(folder => folder.name)

    const response = NextResponse.json({
      folders: folderNames,
      parent: parentPath,
      sortBy,
      sortOrder,
      customer: {
        name: customer.name,
        project: customer.project
      }
    })

    // Cache-headers
    response.headers.set('Cache-Control', 'no-cache, must-revalidate')
    response.headers.set('ETag', `"folders-${customer.id}-${Date.now()}"`)
    
    return response

    // Hämta alla mappar för kunden (från files och folders tabeller)
    const { data: fileFolders, error: fileError } = await supabaseAdmin
      .from('files')
      .select('folder_path, customer_folder_path')
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
    
    // Lägg till mappar från filer (prioritera kundspecifika mappar)
    fileFolders?.forEach(f => {
      // Använd customer_folder_path om det finns, annars fallback till folder_path
      const folderPath = f.customer_folder_path || f.folder_path
      if (folderPath) {
        allFolderPaths.add(folderPath)
        // Lägg till föräldermappar för nested paths
        const parts = folderPath.split('/')
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
