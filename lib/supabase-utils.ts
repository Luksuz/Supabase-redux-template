import { createClient } from '@/lib/supabase/client'
import fs from 'fs/promises'

// Initialize Supabase client
const supabase = createClient()

/**
 * Uploads a file to Supabase storage and returns the public URL
 * @param filePath Local file path to upload
 * @param destinationPath Destination path in Supabase storage
 * @param contentType MIME type of the file
 * @returns Public URL of the uploaded file or null if failed
 */
export async function uploadFileToSupabase(
  filePath: string, 
  destinationPath: string, 
  contentType: string = 'application/octet-stream'
): Promise<string | null> {
  try {
    console.log(`☁️ Uploading file to Supabase: ${filePath} -> ${destinationPath}`)
    
    // Read the file
    const fileBuffer = await fs.readFile(filePath)
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('generated-content')
      .upload(destinationPath, fileBuffer, {
        contentType: contentType,
        upsert: true
      })

    if (error) {
      console.error('Error uploading file to Supabase:', error)
      return null
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-content')
      .getPublicUrl(destinationPath)

    console.log(`✅ File uploaded successfully: ${publicUrl}`)
    return publicUrl

  } catch (err: any) {
    console.error('Error uploading file to Supabase:', err)
    return null
  }
} 