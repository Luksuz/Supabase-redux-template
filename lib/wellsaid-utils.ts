
import { createClient } from '@/lib/supabase/client'

// Initialize Supabase admin client
const supabaseAdmin = createClient()

/**
 * Uploads API keys from a text file to the api_keys_profiles table
 * @param apiKeysText Text content with one API key per line
 * @param userId User ID for logging purposes
 * @returns Object with success status and details
 */
export async function uploadApiKeysToDatabase(apiKeysText: string, userId: string): Promise<{ success: boolean; error?: string; count?: number }> {
  if (!supabaseAdmin) {
    console.error("Supabase Admin client is not initialized. Cannot upload API keys.");
    return { success: false, error: "Supabase Admin client not initialized." };
  }

  try {
    // Split text by lines and filter out empty lines
    const apiKeys = apiKeysText
      .split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    if (apiKeys.length === 0) {
      return { success: false, error: "No valid API keys found in the uploaded file." };
    }

    console.log(`Uploading ${apiKeys.length} API keys to database for user ${userId}`);

    // Prepare data for insertion
    const apiKeyRecords = apiKeys.map(apiKey => ({
      api_key: apiKey,
      is_valid: true,
      use_count: 0 // Initialize usage count to 0
    }));

    // Insert API keys into the database
    const { data, error } = await supabaseAdmin
      .from('api_keys_profiles')
      .insert(apiKeyRecords)
      .select();

    if (error) {
      console.error("Error inserting API keys into database:", error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Successfully uploaded ${apiKeys.length} API keys to database`);
    return { success: true, count: apiKeys.length };

  } catch (err: any) {
    console.error("Error uploading API keys:", err);
    return { success: false, error: err.message || "An unexpected error occurred during API key upload." };
  }
}

/**
 * Gets the first valid API key from the database for WellSaid Labs
 * Excludes keys that have reached the 50-usage limit
 * @returns The first valid API key or null if none found
 */
export async function getValidApiKey(): Promise<string | null> {
  if (!supabaseAdmin) {
    console.error("Supabase Admin client is not initialized. Cannot get API key.");
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('api_keys_profiles')
      .select('api_key, use_count')
      .eq('is_valid', true)
      .lt('use_count', 50) // Only get keys with less than 50 uses
      .order('use_count', { ascending: true }) // Prefer keys with lower usage
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn("No valid API keys found with usage under 50");
        return null;
      }
      console.error("Error fetching valid API key:", error);
      return null;
    }

    if (!data || !data.api_key) {
      console.warn("No valid API keys found in database");
      return null;
    }

    console.log(`✅ Retrieved valid API key from database (current usage: ${data.use_count}/50)`);
    console.log(`🔑 API key: ${data.api_key}`);
    return data.api_key;

  } catch (err: any) {
    console.error("Error getting valid API key:", err);
    return null;
  }
}

/**
 * Increments the usage count for an API key and marks it as invalid if it reaches 50 uses
 * @param apiKey The API key to increment usage for
 * @returns Success status and whether the key was marked invalid
 */
export async function incrementApiKeyUsage(apiKey: string): Promise<{ success: boolean; markedInvalid: boolean; newCount: number }> {
  if (!supabaseAdmin) {
    console.error("Supabase Admin client is not initialized. Cannot increment API key usage.");
    return { success: false, markedInvalid: false, newCount: 0 };
  }

  try {
    // First, get the current usage count
    const { data: currentData, error: fetchError } = await supabaseAdmin
      .from('api_keys_profiles')
      .select('use_count, is_valid')
      .eq('api_key', apiKey)
      .single();

    if (fetchError) {
      console.error("Error fetching current API key usage:", fetchError);
      return { success: false, markedInvalid: false, newCount: 0 };
    }

    const currentCount = currentData.use_count || 0;
    const newCount = currentCount + 1;
    const shouldMarkInvalid = newCount >= 50;

    // Update the usage count and potentially mark as invalid
    const { error: updateError } = await supabaseAdmin
      .from('api_keys_profiles')
      .update({ 
        use_count: newCount,
        is_valid: shouldMarkInvalid ? false : currentData.is_valid
      })
      .eq('api_key', apiKey);

    if (updateError) {
      console.error("Error updating API key usage:", updateError);
      return { success: false, markedInvalid: false, newCount: currentCount };
    }

    if (shouldMarkInvalid) {
      console.log(`🚫 API key marked as invalid after reaching ${newCount} uses`);
    } else {
      console.log(`📊 API key usage incremented to ${newCount}/50`);
    }

    return { 
      success: true, 
      markedInvalid: shouldMarkInvalid, 
      newCount: newCount 
    };

  } catch (err: any) {
    console.error("Error incrementing API key usage:", err);
    return { success: false, markedInvalid: false, newCount: 0 };
  }
}

/**
 * Marks an API key as invalid in the database
 * @param apiKey The API key to mark as invalid
 * @returns Success status
 */
export async function markApiKeyAsInvalid(apiKey: string): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("Supabase Admin client is not initialized. Cannot mark API key as invalid.");
    return false;
  }

  try {
    const { error } = await supabaseAdmin
      .from('api_keys_profiles')
      .update({ is_valid: false })
      .eq('api_key', apiKey);

    if (error) {
      console.error("Error marking API key as invalid:", error);
      return false;
    }

    console.log("✅ Marked API key as invalid in database");
    return true;

  } catch (err: any) {
    console.error("Error marking API key as invalid:", err);
    return false;
  }
}

/**
 * Uploads a file to Supabase Storage
 * @param filePath Local file path
 * @param destination Destination path in storage
 * @param contentType MIME type of the file
 * @returns Public URL or null if failed
 */
export async function uploadFileToSupabase(
  filePath: string, 
  destination: string, 
  contentType: string
): Promise<string | null> {
  if (!supabaseAdmin) {
    console.error("Supabase Admin client is not initialized. Cannot upload file.");
    return null;
  }

  try {
    const fs = await import('fs/promises');
    const fileBuffer = await fs.readFile(filePath);
    
    const { data, error } = await supabaseAdmin.storage
      .from('images')
      .upload(destination, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error("Error uploading file to Supabase:", error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(destination);

    return publicUrl;

  } catch (err: any) {
    console.error("Error uploading file:", err);
    return null;
  }
}

/**
 * Gets statistics about API keys in the database
 * @returns Object with counts of valid and invalid API keys, plus usage statistics
 */
export async function getApiKeyStatistics(): Promise<{ 
  success: boolean; 
  validCount: number; 
  invalidCount: number; 
  totalCount: number; 
  usageLimitReached: number;
  averageUsage: number;
  error?: string 
}> {
  if (!supabaseAdmin) {
    console.error("Supabase Admin client is not initialized. Cannot get API key statistics.");
    return { 
      success: false, 
      validCount: 0, 
      invalidCount: 0, 
      totalCount: 0, 
      usageLimitReached: 0,
      averageUsage: 0,
      error: "Supabase Admin client not initialized." 
    };
  }

  try {
    // Get all API keys with their usage data
    const { data: allKeys, error: allKeysError } = await supabaseAdmin
      .from('api_keys_profiles')
      .select('is_valid, use_count');

    if (allKeysError) {
      console.error("Error fetching API key data:", allKeysError);
      return { 
        success: false, 
        validCount: 0, 
        invalidCount: 0, 
        totalCount: 0, 
        usageLimitReached: 0,
        averageUsage: 0,
        error: allKeysError.message 
      };
    }

    const validKeys = allKeys.filter(key => key.is_valid);
    const invalidKeys = allKeys.filter(key => !key.is_valid);
    const usageLimitReached = allKeys.filter(key => (key.use_count || 0) >= 50).length;
    
    // Calculate average usage
    const totalUsage = allKeys.reduce((sum, key) => sum + (key.use_count || 0), 0);
    const averageUsage = allKeys.length > 0 ? Math.round((totalUsage / allKeys.length) * 100) / 100 : 0;

    const validCount = validKeys.length;
    const invalidCount = invalidKeys.length;
    const totalCount = allKeys.length;

    console.log(`✅ API Key Statistics: ${validCount} valid, ${invalidCount} invalid, ${totalCount} total, ${usageLimitReached} reached limit, avg usage: ${averageUsage}`);
    
    return {
      success: true,
      validCount,
      invalidCount,
      totalCount,
      usageLimitReached,
      averageUsage
    };

  } catch (err: any) {
    console.error("Error getting API key statistics:", err);
    return { 
      success: false, 
      validCount: 0, 
      invalidCount: 0, 
      totalCount: 0, 
      usageLimitReached: 0,
      averageUsage: 0,
      error: err.message || "An unexpected error occurred." 
    };
  }
} 