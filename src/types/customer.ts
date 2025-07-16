export interface CustomerFile {
  id: string
  original_name: string
  display_name?: string
  name_for_display: string
  file_type: string
  file_size: number
  formatted_size: string
  download_url: string | null
  thumbnail_url: string | null
  is_image: boolean
  is_video: boolean
  folder_path: string
  customer_folder_path?: string
  folder_display: string
  uploaded_date: string
  uploaded_at: string
  customer_rating: 'unrated' | 'favorite' | 'good' | 'poor'
  customer_notes?: string
  organization_updated_at?: string
}

export interface Customer {
  id: string
  name: string
  project: string
}
