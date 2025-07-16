import { supabase } from './supabase'
import type { Customer, FileRecord } from './supabase'

// Customer management functions (använder API-routes för admin-operationer)
export const customerService = {
  // Hämta alla kunder (via API)
  async getAllCustomers(): Promise<{ customers: Customer[], fileStats: any }> {
    const response = await fetch('/api/admin/customers')
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch customers')
    }
    
    return response.json()
  },

  // Skapa ny kund (via API)
  async createCustomer(customerData: {
    name: string
    email: string
    project: string
    password?: string
  }): Promise<{ customer: Customer, password: string }> {
    const response = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create customer')
    }
    
    return response.json()
  },

  // Uppdatera kund (via API)
  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const response = await fetch(`/api/admin/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update customer')
    }
    
    const result = await response.json()
    return result.customer
  },

  // Ta bort kund (via API)
  async deleteCustomer(id: string): Promise<void> {
    const response = await fetch(`/api/admin/customers/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete customer')
    }
  },

  // Uppdatera senaste åtkomst (direkt till Supabase för kund-operationer)
  async updateLastAccess(email: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ last_access: new Date().toISOString() })
      .eq('email', email)

    if (error) {
      console.error('Error updating last access:', error)
      throw error
    }
  }
}

// File management functions (behåller gamla implementationen tills vidare)
export const fileService = {
  // Hämta filer för en kund
  async getCustomerFiles(customerId: string): Promise<FileRecord[]> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching files:', error)
      throw error
    }

    return data || []
  },

  // Lägg till fil-metadata
  async addFileRecord(fileData: {
    customer_id: string
    filename: string
    original_name: string
    file_size: number
    file_type: string
    cloudflare_url: string
    thumbnail_url?: string
  }): Promise<FileRecord> {
    const { data, error } = await supabase
      .from('files')
      .insert([fileData])
      .select()
      .single()

    if (error) {
      console.error('Error adding file record:', error)
      throw error
    }

    return data
  },

  // Ta bort fil (soft delete)
  async deleteFile(id: string): Promise<void> {
    const { error } = await supabase
      .from('files')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  }
}

// Utility functions
export const utils = {
  // Generera säkert lösenord
  generatePassword(length: number = 8): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  },

  // Formatera filstorlek
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  // Formatera datum
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('sv-SE')
  }
}
