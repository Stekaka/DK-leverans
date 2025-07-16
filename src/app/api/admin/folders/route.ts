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

// GET - Hämta mappstruktur för en kund
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    // Hämta alla mappar för kunden (från files och folders tabeller)
    const { data: fileFolders, error: fileError } = await supabaseAdmin
      .from('files')
      .select('folder_path')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)

    const { data: explicitFolders, error: folderError } = await supabaseAdmin
      .from('folders')
      .select('folder_path')
      .eq('customer_id', customerId)

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

  } catch (error) {
    console.error('Folders API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Skapa ny mapp eller flytta fil
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Skapa ny mapp
    if (body.action === 'createFolder') {
      const { customerId, folderPath } = body
      
      if (!customerId || !folderPath) {
        return NextResponse.json({ error: 'Customer ID and folder path are required' }, { status: 400 })
      }

      // Skapa mappen i folders tabellen
      const { data, error } = await supabaseAdmin
        .from('folders')
        .upsert({ 
          customer_id: customerId, 
          folder_path: folderPath 
        }, { 
          onConflict: 'customer_id,folder_path' 
        })
        .select()

      if (error) {
        console.error('Error creating folder:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Folder created successfully',
        folder: data?.[0]
      })
    }
    
    // Flytta fil till ny mapp (befintlig funktionalitet)
    else {
      const { fileId, newFolderPath } = body

      if (!fileId) {
        return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
      }

      // Uppdatera filens mapp
      const { data, error } = await supabaseAdmin
        .from('files')
        .update({ 
          folder_path: newFolderPath || ''
        })
        .eq('id', fileId)
        .select()
        .single()

      if (error) {
        console.error('Error moving file:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        message: 'File moved successfully',
        file: data
      })
    }

  } catch (error) {
    console.error('Folders API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
