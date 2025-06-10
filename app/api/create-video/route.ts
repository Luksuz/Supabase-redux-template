import { NextRequest, NextResponse } from 'next/server';
import { CreateVideoRequestBody, CreateVideoResponse } from '@/types/video-generation';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Shotstack API settings from environment variables
const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY || 'ovtvkcufDaBDRJnsTLHkMB3eLG6ytwlRoUAPAHPq';
const SHOTSTACK_ENDPOINT = process.env.SHOTSTACK_ENDPOINT || 'https://api.shotstack.io/edit/stage';

export async function POST(request: NextRequest) {
  try {
    const body: CreateVideoRequestBody = await request.json();
    const { 
      audioUrl, 
      videoUrl, 
      subtitlesUrl, 
      userId, 
      quality, 
      fontFamily = 'Arial',
      fontColor = '#ffffff',
      fontSize = 24,
      strokeWidth = 2,
      videoDuration,
      audioDuration,
      loopCount
    } = body;
    
    console.log(`🎬 Video creation request:
      - Video URL: ${videoUrl}
      - Audio URL: ${audioUrl}
      - Subtitles URL: ${subtitlesUrl ? 'YES' : 'NO'}
      - Quality: ${quality}
      - Font: ${fontFamily}
      - Font Color: ${fontColor}
      - Font Size: ${fontSize}px
      - Stroke Width: ${strokeWidth}px
      - Video Duration: ${videoDuration}s
      - Audio Duration: ${audioDuration}s
      - Loop Count: ${loopCount}
      - User ID: ${userId}
    `);

    // Validate inputs
    if (!videoUrl) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Video URL is required.' }, { status: 400 });
    }
    if (!audioUrl) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Audio URL is required.' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json<CreateVideoResponse>({ error: 'User ID is required.' }, { status: 400 });
    }

    // Generate a unique ID for this video
    const videoId = uuidv4();
    console.log(`Starting Shotstack video creation with ID: ${videoId} for user: ${userId}`);

    // Set quality parameters for Shotstack
    const resolution = 'sd'; // Always use SD as requested
    const outputFormat = 'mp4';

    // Initialize tracks array for Shotstack
    let tracks = [];

    // Track for subtitles (captions) - Add this first if it exists
    if (subtitlesUrl) {
      console.log(`Adding subtitles to Shotstack video: ${subtitlesUrl}`);
      const captionTrack = {
        clips: [
          {
            asset: {
              type: "caption",
              src: subtitlesUrl,
              font: {
                family: fontFamily,
                weight: 1000,
                size: fontSize,
                color: fontColor,
              },
              stroke: {
                color: "#000000",
                width: strokeWidth
              }
            },
            start: 0,
            length: audioDuration || 300, // Use audio duration if available
            position: "bottom",
          }
        ]
      };
      tracks.push(captionTrack);
    }

    // Track for the main video - Use the pre-looped video carefully with proper timing
    // If audio duration is longer than video duration, create multiple clips with overlaps
    const targetDuration = audioDuration || 300
    const videoClips = []
    const overlapDuration = 0.1 // 100ms overlap to prevent gaps
    
    if (videoDuration && targetDuration > videoDuration) {
      // Need to loop the video multiple times to match audio duration
      const loopsNeeded = Math.ceil(targetDuration / videoDuration)
      console.log(`🔄 Creating ${loopsNeeded} video clips with overlaps to match ${targetDuration}s audio`)
      
      for (let i = 0; i < loopsNeeded; i++) {
        const startTime = i * videoDuration
        const clipLength = Math.min(videoDuration, targetDuration - startTime)
        const needsOverlap = i < loopsNeeded - 1 && startTime + clipLength < targetDuration
        
        videoClips.push({
          asset: {
            type: "video",
            src: videoUrl,
            // Ensure audio from video doesn't interfere with our audio track
            volume: 0
          },
          start: startTime,
          length: clipLength + (needsOverlap ? overlapDuration : 0),
          fit: "cover"
        })
      }
    } else {
      // Single clip is sufficient
      videoClips.push({
        asset: {
          type: "video",
          src: videoUrl,
          // Ensure audio from video doesn't interfere with our audio track
          volume: 0
        },
        start: 0,
        length: targetDuration,
        fit: "cover"
      })
    }
    
    const videoTrack = {
      clips: videoClips
    };
    tracks.push(videoTrack);

    // Track for audio
    const audioTrack = {
      clips: [
        {
          asset: {
            type: "audio",
            src: audioUrl
          },
          start: 0,
          length: audioDuration || 300,
        }
      ]
    };
    tracks.push(audioTrack);

    // Create Shotstack timeline
    const timeline = {
      background: "#000000",
      tracks: tracks
    };

    // Create Shotstack output configuration with custom size and low quality
    const output = {
      format: outputFormat,
      size: {
        width: 1280,
        height: 720
      },
      fps: 25,
      quality: "low",
      aspectRatio: "16:9" // Note: 1080x720 is actually 3:2 ratio, but keeping 16:9 for compatibility
    };

    // Create Shotstack edit
    const edit = {
      timeline: timeline,
      output: output
    };

    // Save JSON payload locally for inspection
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    try {
      const payloadDir = path.join(os.tmpdir(), 'shotstack-payloads');
      await fs.mkdir(payloadDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const payloadFile = path.join(payloadDir, `shotstack-payload-${timestamp}-${videoId.slice(0, 8)}.json`);
      
      await fs.writeFile(payloadFile, JSON.stringify(edit, null, 2));
      console.log(`💾 Shotstack payload saved to: ${payloadFile}`);
    } catch (saveError) {
      console.warn(`⚠️ Could not save payload for inspection:`, saveError);
    }

    console.log(`🎬 Sending request to Shotstack API with ${videoTrack.clips.length} video clips...`);
    
    // Send request to Shotstack
    const shotstackResponse = await fetch(`${SHOTSTACK_ENDPOINT}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(edit)
    });

    if (!shotstackResponse.ok) {
      const errorText = await shotstackResponse.text();
      console.error(`Shotstack API error: ${shotstackResponse.status} ${shotstackResponse.statusText}`, errorText);
      throw new Error(`Shotstack API error: ${shotstackResponse.statusText}`);
    }

    const shotstackData = await shotstackResponse.json();
    const shotstackId = shotstackData.response?.id;

    if (!shotstackId) {
      throw new Error('No Shotstack render ID returned');
    }

    console.log(`✅ Shotstack render started with ID: ${shotstackId}`);

    // Save video record to database
    const supabase = await createClient();
    
    const videoRecord = {
      id: videoId,
      user_id: userId,
      status: 'processing',
      image_urls: [], // Empty for new workflow but kept for DB compatibility
      audio_url: audioUrl,
      subtitles_url: subtitlesUrl || null,
      final_video_url: null,
      thumbnail_url: null,
      shotstack_id: shotstackId,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: dbError } = await supabase
      .from('video_records')
      .insert([videoRecord]);

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue anyway, as Shotstack job is already started
    }

    console.log(`✅ Video creation initiated successfully!`);

    return NextResponse.json<CreateVideoResponse>({
      message: 'Video rendering started successfully',
      video_id: videoId,
      shotstack_id: shotstackId
    });

  } catch (error: any) {
    console.error(`❌ Error in create-video route:`, error);
    return NextResponse.json<CreateVideoResponse>(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 