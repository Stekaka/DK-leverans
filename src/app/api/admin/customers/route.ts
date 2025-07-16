import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Admin client som bara körs på servern
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Hämta fil-statistik också
    const { data: filesData, error: filesError } = await supabaseAdmin
      .from('files')
      .select('customer_id, file_size')
      .eq('is_deleted', false)

    if (filesError) {
      console.error('Error fetching file stats:', filesError)
      return NextResponse.json({ error: filesError.message }, { status: 500 })
    }

    // Beräkna fil-statistik
    const totalFiles = filesData?.length || 0
    const totalSize = filesData?.reduce((acc, file) => acc + file.file_size, 0) || 0
    
    const customerFileCounts: { [customerId: string]: number } = {}
    filesData?.forEach(file => {
      customerFileCounts[file.customer_id] = (customerFileCounts[file.customer_id] || 0) + 1
    })

    return NextResponse.json({
      customers: data || [],
      fileStats: { totalFiles, totalSize, customerFileCounts }
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, project, password } = body

    if (!name || !email || !project) {
      return NextResponse.json({ error: 'Namn, e-post och projekt krävs' }, { status: 400 })
    }

    // Använd medskickat lösenord eller generera ett nytt
    let finalPassword = password
    if (!finalPassword) {
      // Generera lösenord om inget är angivet
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
      finalPassword = ''
      for (let i = 0; i < 8; i++) {
        finalPassword += chars.charAt(Math.floor(Math.random() * chars.length))
      }
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert([{
        name,
        email,
        project,
        password_hash: finalPassword // I produktion: hash med bcrypt
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'En kund med denna e-postadress finns redan!' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      customer: data,
      password: finalPassword 
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
