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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const name = searchParams.get('name')

    let query = supabaseAdmin
      .from('customers')
      .select('id, email, name, project, status, created_at')
      .eq('status', 'active')

    if (email) {
      query = query.ilike('email', `%${email}%`)
    }
    
    if (name) {
      query = query.ilike('name', `%${name}%`)
    }

    const { data: customers, error } = await query.limit(20)

    if (error) {
      console.error('Error searching customers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Lägg till fil-antal för varje kund
    const customersWithStats = await Promise.all(
      (customers || []).map(async (customer) => {
        const { data: files, error: filesError } = await supabaseAdmin
          .from('files')
          .select('id, file_size, is_deleted, is_trashed')
          .eq('customer_id', customer.id)

        const activeFiles = files?.filter(f => !f.is_deleted && !f.is_trashed) || []
        const totalSize = activeFiles.reduce((sum, f) => sum + (f.file_size || 0), 0)

        return {
          ...customer,
          file_count: activeFiles.length,
          total_size: totalSize,
          total_size_formatted: formatFileSize(totalSize)
        }
      })
    )

    return NextResponse.json({
      customers: customersWithStats,
      total: customersWithStats.length,
      query: { email, name }
    })

  } catch (error) {
    console.error('[CUSTOMER-SEARCH] Error:', error)
    return NextResponse.json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// Hjälpfunktion för filstorlek
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
