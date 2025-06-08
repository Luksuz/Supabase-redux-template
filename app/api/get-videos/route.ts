import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VideoRecord } from '@/types/video-generation';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user from Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    console.log(`📋 Fetching videos for authenticated user: ${userId}`);
    
    const { data: videos, error } = await supabase
      .from('video_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching videos from database:', error);
      return NextResponse.json(
        { error: 'Failed to fetch videos.', details: error.message },
        { status: 500 }
      );
    }

    // Transform database records to VideoRecord format
    const videoRecords: VideoRecord[] = videos.map(video => ({
      id: video.id,
      user_id: video.user_id,
      status: video.status,
      shotstack_id: video.shotstack_id,
      image_urls: video.image_urls,
      audio_url: video.audio_url,
      subtitles_url: video.subtitles_url || undefined,
      final_video_url: video.final_video_url || undefined,
      thumbnail_url: video.thumbnail_url,
      error_message: video.error_message || undefined,
      created_at: video.created_at,
      updated_at: video.updated_at,
      // Parse metadata from error_message field if it exists and looks like JSON
      metadata: (() => {
        try {
          if (video.error_message && video.error_message.startsWith('{')) {
            return JSON.parse(video.error_message);
          }
          return undefined;
        } catch {
          return undefined;
        }
      })()
    }));

    console.log(`✅ Successfully fetched ${videoRecords.length} videos for user: ${userId}`);

    return NextResponse.json({
      videos: videoRecords,
      count: videoRecords.length
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/get-videos route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 