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
            'image/png': 'png',
            'image/gif': 'gif',
            'video/mp4': 'mp4',
            'image/webp': 'webp',
        };
        const extension = mimeToExt[blob.type] || blob.type.split('/')[1] || 'bin';
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

        return NextResponse.json({ publicUrl });
    } catch (error: any) {
        console.error('Error in /api/upload-from-url:', error);
        return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
    }
} 