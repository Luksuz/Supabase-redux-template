import { NextRequest, NextResponse } from 'next/server';
import { CreateVideoRequestBody, CreateVideoResponse } from '@/types/video-generation';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Shotstack API settings from environment variables
const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY || 'ovtvkcufDaBDRJnsTLHkMB3eLG6ytwlRoUAPAHPq';
const SHOTSTACK_ENDPOINT = process.env.SHOTSTACK_ENDPOINT || 'https://api.shotstack.io/edit/stage';

/**
 * Get audio duration from URL by fetching audio metadata
 * @param audioUrl URL of the audio file
 * @returns Promise<number> duration in seconds, or null if unable to determine
 */
async function getAudioDuration(audioUrl: string): Promise<number | null> {
  try {
    // For now, we'll return a default duration since we don't have ffprobe on the server
    // In a production environment, you'd want to implement proper audio duration detection
    console.log(`Getting audio duration for: ${audioUrl}`)
    return 300; // Default to 5 minutes
  } catch (error) {
    console.error('Error getting audio duration:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateVideoRequestBody = await request.json();
    const { imageUrls, audioUrl, subtitlesUrl, userId, thumbnailUrl, segmentTimings } = body;
    console.log(`🖼️ Image URLs: ${imageUrls}`);
    console.log(`🎵 Audio URL: ${audioUrl}`);
    console.log(`📝 Subtitles URL: ${subtitlesUrl}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📷 Thumbnail URL: ${thumbnailUrl}`);
    console.log(`⏱️ Segment Timings: ${segmentTimings}`);

    
    console.log(`📋 Video creation request:
      - Images: ${imageUrls?.length || 0}
      - Audio URL: ${audioUrl ? 'YES' : 'NO'}
      - Subtitles URL: ${subtitlesUrl ? 'YES' : 'NO'}
      - Segment timings: ${segmentTimings ? 'YES (segmented video)' : 'NO (traditional video)'}
      - User ID: ${userId}
    `);

    // Validate inputs
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Image URLs are required.' }, { status: 400 });
    }
    if (!audioUrl) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Audio URL is required.' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json<CreateVideoResponse>({ error: 'User ID is required.' }, { status: 400 });
    }

    // Validate segment timings if provided
    if (segmentTimings) {
      if (!Array.isArray(segmentTimings) || segmentTimings.length === 0) {
        return NextResponse.json<CreateVideoResponse>({ error: 'Segment timings must be a non-empty array when provided.' }, { status: 400 });
      }
      if (segmentTimings.length !== imageUrls.length) {
        return NextResponse.json<CreateVideoResponse>({ error: 'Number of segment timings must match number of images.' }, { status: 400 });
      }
    }

    // Generate a unique ID for this video
    const videoId = uuidv4();
    console.log(`Starting video creation with ID: ${videoId} for user: ${userId}`);

    // Determine video creation mode and calculate durations
    let totalDuration: number;
    let imageDuration: number;
    let isSegmentedVideo = false;

    if (segmentTimings && segmentTimings.length > 0) {
      // Segmented video: use precise timing from segment timings
      isSegmentedVideo = true;
      totalDuration = segmentTimings.reduce((sum, timing) => sum + timing.duration, 0);
      imageDuration = 0; // Not used for segmented videos
      
      console.log(`Segmented video configuration:
        - Total duration: ${totalDuration.toFixed(2)} seconds
        - Number of segments: ${segmentTimings.length}
        - Individual durations: ${segmentTimings.map(t => t.duration.toFixed(2)).join(', ')}s`);
    } else {
      // Traditional video: get audio duration and divide equally
      console.log('Getting audio duration for traditional video timeline...');
      const audioDuration = await getAudioDuration(audioUrl);
      
      // If we can't get audio duration, default to 5 minutes
      totalDuration = audioDuration || 300; 
      // Each image gets equal time in the slideshow
      imageDuration = totalDuration / imageUrls.length;
      
      console.log(`Traditional video configuration:
        - Total duration: ${totalDuration.toFixed(1)} seconds
        - Number of images: ${imageUrls.length}
        - Duration per image: ${imageDuration.toFixed(1)} seconds`);
    }
    
    // Initialize tracks array
    let tracks = [];

    // Track for subtitles (captions) - Add this first if it exists
    if (subtitlesUrl) {
      console.log(`Adding subtitles to video: ${subtitlesUrl}`);
      const captionTrack = {
        clips: [
          {
            asset: {
              type: "caption",
              src: subtitlesUrl,
              font: {
                size: 70,
              },
              background: {
                padding: 15,
              },
            },
            start: 0,
            length: totalDuration,
            position: "bottom",
            
          }
        ]
      };
      tracks.push(captionTrack);
    }

    // Track for images - Create slideshow with timing based on mode
    if (isSegmentedVideo && segmentTimings) {
      // Segmented video: use precise timing with sliding transitions
      console.log(`🎬 Creating segmented video with ${imageUrls.length} precisely timed segments:`);
      let currentTime = 0;
      const imageClips = imageUrls.map((url, index) => {
        const duration = segmentTimings[index].duration;
        const startTime = currentTime;
        
        // Cycle through sliding effects for visual variety
        const slideEffects = ["slideLeft", "slideRight", "slideUp", "slideDown"];
        const selectedEffect = slideEffects[index % slideEffects.length];
        
        console.log(`   Segment ${index + 1}: ${duration.toFixed(2)}s at ${startTime.toFixed(2)}s (${selectedEffect})`);
        
        const clip = {
          asset: {
            type: "image",
            src: url
          },
          start: startTime,
          length: duration,
          effect: selectedEffect,
          fit: "cover"
        };
        
        currentTime += duration;
        return clip;
      });

      const imageTrack = {
        clips: imageClips
      };
      tracks.push(imageTrack);
    } else {
      // Traditional video: equal timing for all images with sliding transitions
      console.log(`🎬 Creating traditional slideshow with ${imageUrls.length} images:`);
      const imageClips = imageUrls.map((url, index) => {
        const startTime = index * imageDuration;
        // Cycle through sliding effects for visual variety
        const slideEffects = ["slideLeft", "slideRight", "slideUp", "slideDown"];
        const selectedEffect = slideEffects[index % slideEffects.length];
        
        console.log(`   Image ${index + 1}: ${selectedEffect} effect, ${imageDuration.toFixed(2)}s at ${startTime.toFixed(2)}s`);
        
        return {
          asset: {
            type: "image",
            src: url
          },
          start: startTime,
          length: imageDuration,
          effect: selectedEffect,
          fit: "cover"
        };
      });

      const imageTrack = {
        clips: imageClips
      };
      tracks.push(imageTrack);
    }

    // Track for main audio (if audioUrl is present)
    if (audioUrl) {
        const audioTrack = {
            clips: [{
                asset: {
                    type: "audio",
                    src: audioUrl,
                    volume: 1 // Ensure audio is audible
                },
                start: 0,
                length: totalDuration // Audio plays for the whole duration
            }]
        };
        tracks.push(audioTrack);
    }
    
    // Log the track structure for debugging
    console.log('📊 Final track structure:');
    tracks.forEach((track, index) => {
      const assetType = track.clips[0]?.asset?.type || 'unknown';
      console.log(`  Track ${index}: ${assetType}`);
    });

    const timeline: any = {
      tracks: tracks
    };

    const shotstackPayload = {
      timeline: timeline,
      output: {
        format: "mp4",
        size: {
          width: 1280,
          height: 720
        }
      },
      callback: process.env.SHOTSTACK_CALLBACK_URL
    };

    console.log(JSON.stringify(shotstackPayload, null, 2));

    console.log("📤 Sending Shotstack API request with payload summary:");
    console.log(`- Video type: ${isSegmentedVideo ? 'Segmented' : 'Traditional'}`);
    console.log(`- Total tracks: ${tracks.length}`);
    console.log(`- Images: ${imageUrls.length}`);
    console.log(`- Audio: ${audioUrl ? 'YES' : 'NO'}`);
    console.log(`- Subtitles: ${subtitlesUrl ? 'YES' : 'NO'}`);
    console.log(`- Total duration: ${totalDuration.toFixed(2)}s`);
    
    // Make Shotstack API call BEFORE creating database record
    const shotstackResponse = await fetch(`${SHOTSTACK_ENDPOINT}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SHOTSTACK_API_KEY
      },
      body: JSON.stringify(shotstackPayload),
    });

    // If Shotstack returns an error, return it directly to user without saving any record
    if (!shotstackResponse.ok) {
      const errorData = await shotstackResponse.json();
      console.error('Shotstack API error:', errorData);
      
      return NextResponse.json<CreateVideoResponse>(
        { 
          error: 'Failed to create video with Shotstack API', 
          details: errorData.message || JSON.stringify(errorData) 
        },
        { status: shotstackResponse.status }
      );
    }

    const responseData = await shotstackResponse.json();
    const shotstackId = responseData.response.id;
    console.log("Response from Shotstack API:", responseData);
    console.log("Shotstack ID:", shotstackId);

    // Only create database record AFTER Shotstack successfully accepts the job
    const supabase = await createClient();
    
    // Prepare metadata for segmented videos
    const metadata = isSegmentedVideo && segmentTimings ? {
      type: 'segmented',
      segment_timings: segmentTimings,
      total_duration: totalDuration,
      scenes_count: imageUrls.length
    } : null;
    
    const { error: dbError } = await supabase
      .from('video_records_rezu')
      .insert({
        id: videoId,
        user_id: userId,
        status: 'processing',
        shotstack_id: shotstackId,
        image_urls: imageUrls,
        audio_url: audioUrl,
        subtitles_url: subtitlesUrl,
        // Use provided thumbnail URL if available, otherwise fall back to first image
        thumbnail_url: thumbnailUrl || imageUrls[0],
        // Store metadata in error_message field for segmented videos (temporary solution)
        error_message: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Error creating video record in database:', dbError);
      return NextResponse.json<CreateVideoResponse>(
        { error: 'Failed to create video record.', details: dbError.message },
        { status: 500 }
      );
    }

    console.log(`✅ ${isSegmentedVideo ? 'Segmented' : 'Traditional'} video record created successfully with Shotstack ID: ${shotstackId}`);

    // Return success response with video ID and shotstack ID
    return NextResponse.json<CreateVideoResponse>({
      message: `${isSegmentedVideo ? 'Segmented' : 'Traditional'} video creation job started successfully`,
      video_id: videoId,
      shotstack_id: shotstackId
    }, { status: 202 });

  } catch (error: any) {
    console.error('Error in /api/create-video route:', error);
    return NextResponse.json<CreateVideoResponse>(
      { error: 'Failed to process video creation request', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 