import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: These should be in environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase URL or Service Role Key is not defined in environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
    const { assetUrl, promptId, bucket } = await request.json();

    if (!assetUrl || !promptId || !bucket) {
        return NextResponse.json({ error: 'Missing parameters: assetUrl, promptId, and bucket are required.' }, { status: 400 });
    }

    try {
        const assetResponse = await fetch(assetUrl);
        if (!assetResponse.ok) {
            const errorText = await assetResponse.text();
            throw new Error(`Failed to fetch asset from URL: ${assetResponse.status} ${assetResponse.statusText}. Details: ${errorText}`);
        }
        const blob = await assetResponse.blob();
        
        // Mime type to extension mapping, can be expanded
        const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/tiff': 'tiff',
            'image/svg+xml': 'svg',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/avi': 'avi',
            'video/mov': 'mov',
            'video/quicktime': 'mov',
            'video/x-msvideo': 'avi',
            'video/3gpp': '3gp',
            'video/x-flv': 'flv',
            'video/x-ms-wmv': 'wmv',
        };
        
        // Try to get extension from MIME type first
        let extension = mimeToExt[blob.type];
        
        // If MIME type doesn't match known types, try to extract from URL
        if (!extension) {
            try {
                const url = new URL(assetUrl);
                const urlPath = url.pathname;
                const urlExtension = urlPath.split('.').pop()?.toLowerCase();
                
                // Common video/image extensions
                const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 
                                       'mp4', 'webm', 'avi', 'mov', '3gp', 'flv', 'wmv'];
                
                if (urlExtension && validExtensions.includes(urlExtension)) {
                    extension = urlExtension;
                }
            } catch (urlError) {
                console.warn('Failed to parse URL for extension:', urlError);
            }
        }
        
        // Final fallback: use the second part of MIME type or 'bin'
        if (!extension) {
            extension = blob.type.split('/')[1] || 'bin';
        }
        
        console.log(`📁 File info: MIME type: ${blob.type}, Extension: ${extension}, URL: ${assetUrl}`);
        
        const fileName = `${promptId}-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, blob, {
                contentType: blob.type,
                upsert: true,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

        // Return both the public URL and the relative path for different use cases
        return NextResponse.json({ 
            publicUrl,
            fileName,
            bucket,
            relativePath: fileName // Just the filename for path-based access
        });
    } catch (error: any) {
        console.error('Error in /api/upload-from-url:', error);
        return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
    }
} 