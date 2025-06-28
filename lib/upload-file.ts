import { createClient } from "@/lib/supabase/server";

export async function uploadFileToSupabase(
    filePath: string, 
    destination: string, 
    contentType: string
  ): Promise<string | null> {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase Admin client is not initialized. Cannot upload file.");
      return null;
    }
  
    try {
      const fs = await import('fs/promises');
      const fileBuffer = await fs.readFile(filePath);
      
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(destination, fileBuffer, {
          contentType: contentType,
          upsert: true
        });
  
      if (error) {
        console.error("Error uploading file to Supabase:", error);
        return null;
      }
  
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(destination);
  
      return publicUrl;
  
    } catch (err: any) {
      console.error("Error uploading file:", err);
      return null;
    }
  }