import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Public client för kundanvändning
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types för TypeScript
export interface Customer {
  id: string
  name: string
  email: string
  project: string
  password_hash?: string
  created_at: string
  status: 'active' | 'expired'
  last_access?: string
  updated_at?: string
}

export interface FileRecord {
  id: string
  customer_id: string
  filename: string
  original_name: string
  file_size: number
  file_type: string
  cloudflare_url: string
  thumbnail_url?: string
  uploaded_at: string
}
