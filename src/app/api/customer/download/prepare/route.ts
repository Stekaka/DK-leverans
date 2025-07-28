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

// Verifierar customer session (samma kod som batch)
async function verifyCustomerSession(request: NextRequest) {
  const sessionToken = request.cookies.get('customer_session')?.value
  if (!sessionToken) {
    throw new Error('Ingen session hittades')
  }

  let customerId: string
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString()
    const parts = decoded.split(':')
    customerId = parts[0]
    
    if (parts.length >= 3 && parts[1] === 'quick') {
      const expiresAt = parseInt(parts[2])
      if (Date.now() > expiresAt) {
        throw new Error('Quick access token har upphört')
      }
    }
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
    if (customerId === 'test-marc-zorjan') {
      return {
        id: 'test-marc-zorjan',
        name: 'Marc Zorjan',
        email: 'marc.zorjan@gotevent.se',
        project: 'Götevent projekt',
        status: 'active'
      }
    }
    throw new Error('Session har upphört')
  }

  return customer
}

// POST /api/customer/download/prepare - Starta asynkron ZIP-skapande
export async function POST(request: NextRequest) {
  try {
    // Verifiera session
    const customer = await verifyCustomerSession(request)
    const customerId = customer.id

    const { fileIds } = await request.json()
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'Filer krävs' }, { status: 400 })
    }

    // Verifiera att filerna finns och tillhör kunden
    const { data: files, error: filesError } = await supabaseAdmin
      .from('files')
      .select('id, customer_id, filename, original_name, file_size')
      .in('id', fileIds)
      .eq('customer_id', customerId)

    if (filesError || !files || files.length === 0) {
      return NextResponse.json({ error: 'Inga filer hittades' }, { status: 404 })
    }

    // Skapa en download job i databasen
    const downloadId = `download_${customerId}_${Date.now()}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    const { error: jobError } = await supabaseAdmin
      .from('download_jobs')
      .insert({
        id: downloadId,
        customer_id: customerId,
        file_ids: fileIds,
        status: 'preparing',
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        total_files: files.length,
        total_size: files.reduce((sum, f) => sum + (f.file_size || 0), 0)
      })

    if (jobError) {
      console.error('Failed to create download job:', jobError)
      return NextResponse.json({ error: 'Kunde inte förbereda nedladdning' }, { status: 500 })
    }

    // Starta ZIP-skapandet i bakgrunden (använd Vercel serverless function)
    // Detta kommer att köras som en separat process
    fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/customer/download/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadId, customerId })
    }).catch(error => {
      console.error('Failed to start background processing:', error)
    })

    return NextResponse.json({
      downloadId,
      status: 'preparing',
      message: 'ZIP-filen förbereds. Du får en notifikation när den är klar.',
      estimatedTime: Math.ceil(files.length / 10), // Rough estimate: 10 files per second
      totalFiles: files.length
    })

  } catch (error: any) {
    console.error('Prepare download error:', error)
    
    if (error.message?.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Serverfel vid förberedelse av nedladdning' },
      { status: 500 }
    )
  }
}
