import { NextRequest, NextResponse } from 'next/server';
import { CreateVideoRequestBody, CreateVideoResponse } from '@/types/video-generation';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Shotstack API settings from environment variables
const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY || 'ovtvkcufDaBDRJnsTLHkMB3eLG6ytwlRoUAPAHPq';
const SHOTSTACK_ENDPOINT = process.env.SHOTSTACK_ENDPOINT || 'https://api.shotstack.io/edit/v1';

// Dust overlay URL
const DUST_OVERLAY_URL = 'https://byktarizdjtreqwudqmv.supabase.co/storage/v1/object/public/video-generator/overlay.webm';

/**
 * Checks if a URL is accessible by making a HEAD request
 * @param url URL to check
 * @returns boolean indicating if the URL is accessible
 */
async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn(`Failed to access URL: ${url}`, error);
    return false;
  }
}

/**
 * Get audio duration from URL using ffprobe
 * @param audioUrl URL of the audio file
 * @returns Promise<number> duration in seconds, or null if unable to determine
 */
async function getAudioDuration(audioUrl: string): Promise<number | null> {
  try {
    const { spawn } = require('child_process');
    
    console.log(`🎵 Getting audio duration using ffprobe for: ${audioUrl}`);
    
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        audioUrl
      ]);

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code: number) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          if (!isNaN(duration) && duration > 0) {
            console.log(`✅ Audio duration detected: ${duration.toFixed(2)} seconds`);
            resolve(duration);
          } else {
            console.warn(`⚠️ Invalid duration from ffprobe: ${output.trim()}`);
            resolve(null);
          }
        } else {
          console.error(`❌ ffprobe failed with code ${code}:`, errorOutput);
          resolve(null);
        }
      });

      ffprobe.on('error', (error: Error) => {
        console.error(`❌ ffprobe spawn error:`, error.message);
        resolve(null);
      });

      // Set timeout to avoid hanging
      setTimeout(() => {
        ffprobe.kill();
        console.warn(`⏰ ffprobe timeout for ${audioUrl}`);
        resolve(null);
      }, 10000); // 10 second timeout
    });
  } catch (error) {
    console.error('❌ Error in getAudioDuration:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateVideoRequestBody = await request.json();
    const { 
      imageUrls, 
      audioUrl, 
      compressedAudioUrl, 
      subtitlesUrl, 
      userId, 
      thumbnailUrl, 
      segmentTimings, 
      includeOverlay,
      quality = 'low',
      enableOverlay = true,
      enableZoom = true,
      enableSubtitles = true,
      // Add subtitle styling properties from frontend
      fontFamily = 'Arial',
      fontColor = '#ffffff',
      fontSize = 24,
      strokeWidth = 2,
      fontWeight = '1000',
      textTransform = 'none',
      audioDuration
    } = body;
    
    console.log(`🖼️ Image URLs: ${imageUrls}`);
    console.log(`🎵 Audio URL: ${audioUrl}`);
    console.log(`🗜️ Compressed Audio URL: ${compressedAudioUrl}`);
    console.log(`📝 Subtitles URL: ${subtitlesUrl}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📷 Thumbnail URL: ${thumbnailUrl}`);
    console.log(`⏱️ Segment Timings: ${segmentTimings}`);
    console.log(`✨ Include Overlay: ${includeOverlay ? 'YES' : 'NO'}`);
    console.log(`🎬 Quality: ${quality}`);
    console.log(`🌟 Enable Overlay: ${enableOverlay}`);
    console.log(`🔍 Enable Zoom: ${enableZoom}`);
    console.log(`📄 Enable Subtitles: ${enableSubtitles}`);
    console.log(`🎨 Font Family: ${fontFamily}`);
    console.log(`🎨 Font Color: ${fontColor}`);
    console.log(`🎨 Font Size: ${fontSize}px`);
    console.log(`🎨 Stroke Width: ${strokeWidth}px`);
    console.log(`🎨 Font Weight: ${fontWeight}`);
    console.log(`🎨 Text Transform: ${textTransform}`);

    
    console.log(`📋 Video creation request:
      - Images: ${imageUrls?.length || 0}
      - Audio URL: ${audioUrl ? 'YES' : 'NO'}
      - Compressed Audio URL: ${compressedAudioUrl ? 'YES' : 'NO'}
      - Subtitles URL: ${subtitlesUrl ? 'YES' : 'NO'}
      - Segment timings: ${segmentTimings ? 'YES (segmented video)' : 'NO (traditional video)'}
      - Include Overlay: ${includeOverlay ? 'YES' : 'NO'}
      - Enable Overlay: ${enableOverlay}
      - Enable Zoom: ${enableZoom}
      - Enable Subtitles: ${enableSubtitles}
      - Quality: ${quality}
      - Subtitle Styling: ${fontFamily}, ${fontColor}, ${fontSize}px, ${strokeWidth}px stroke, ${fontWeight}, ${textTransform}
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
      // Traditional video: get audio duration and use new timeline structure
      console.log('Using provided audio duration for traditional video timeline...');
      
      // Use provided audio duration if available, otherwise fallback to default
      if (audioDuration && audioDuration > 0) {
        totalDuration = audioDuration;
        console.log(`✅ Using provided audio duration: ${totalDuration.toFixed(2)} seconds`);
      } else {
        console.warn('⚠️ No audio duration provided, using fallback duration of 300 seconds');
        totalDuration = 300;
      }
      
      // First minute is for alternating images, or shorter if audio is shorter
      const firstPartDuration = Math.min(60, totalDuration * 0.6); 
      // Image display time depends on how many images we have
      imageDuration = Math.floor(firstPartDuration / imageUrls.length);
      
      console.log(`Traditional video configuration:
        - Total duration: ${totalDuration.toFixed(1)} seconds (${audioDuration ? 'provided' : 'fallback'})
        - First part (alternating images): ${firstPartDuration.toFixed(1)} seconds
        - Each image display time: ${imageDuration.toFixed(1)} seconds
        - Second part (zoom effect): ${Math.max(totalDuration - firstPartDuration, 10).toFixed(1)} seconds`);
    }
    
    // Check if the dust overlay is accessible and if overlay is enabled
    const shouldIncludeOverlay = (includeOverlay || enableOverlay);
    let isOverlayAvailable = false;
    
    if (shouldIncludeOverlay) {
      isOverlayAvailable = await isUrlAccessible(DUST_OVERLAY_URL);
      console.log(`Dust overlay availability check: ${isOverlayAvailable ? 'Available and enabled' : 'Not available'}`);
    } else {
      console.log(`Dust overlay disabled by user settings`);
    }

    // Initialize tracks array
    let tracks = [];

    // Track for subtitles (captions) - Add this first if it exists and is enabled
    if (subtitlesUrl && enableSubtitles) {
      console.log(`Adding subtitles to video: ${subtitlesUrl}`);
      console.log(`Subtitle styling: ${fontFamily}, ${fontColor}, ${fontSize}px, ${strokeWidth}px stroke, ${fontWeight}, ${textTransform}`);
      
      const captionTrack = {
        clips: [
          {
            asset: {
              type: "caption",
              src: subtitlesUrl,
              font: {
                family: fontFamily,
                size: fontSize,
                color: fontColor,
                weight: fontWeight,
              },
              stroke: {
                color: "#000000",
                width: strokeWidth
              }
            },
            start: 0,
            length: totalDuration,
            position: "bottom",
            offset: {
              y: 0.05
            }
          }
        ]
      };
      tracks.push(captionTrack);
    } else if (subtitlesUrl && !enableSubtitles) {
      console.log(`Subtitles available but disabled by user: ${subtitlesUrl}`);
    } else if (!subtitlesUrl && enableSubtitles) {
      console.log(`Subtitles enabled but no subtitles URL provided`);
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
          fit: "contain"
        };
        
        currentTime += duration;
        return clip;
      });

      const imageTrack = {
        clips: imageClips
      };
      tracks.push(imageTrack);
    } else {
      // Traditional video: new timeline structure with alternating images and zoom effects
      console.log(`🎬 Creating traditional video with new timeline structure:`);
      
      const firstPartDuration = Math.min(60, totalDuration * 0.6);
      const secondPartDuration = Math.max(totalDuration - firstPartDuration, 10);
      
      // Create multiple clips for zoom in/out effect
      const zoomClips = [];
      
      if (enableZoom) {
        const zoomDuration = 15; // Each zoom cycle lasts 15 seconds
        const numZoomCycles = Math.ceil(secondPartDuration / (zoomDuration * 2));
        
        for (let i = 0; i < numZoomCycles; i++) {
          // Add zoom in clip
          zoomClips.push({
            asset: {
              type: "image",
              src: imageUrls[imageUrls.length - 1]
            },
            start: firstPartDuration + (i * zoomDuration * 2),
            length: zoomDuration,
            effect: "zoomIn",
            fit: "cover"
          });
          
          // Add zoom out clip if there's still time left
          if (firstPartDuration + (i * zoomDuration * 2) + zoomDuration < totalDuration) {
            zoomClips.push({
              asset: {
                type: "image",
                src: imageUrls[imageUrls.length - 1]
              },
              start: firstPartDuration + (i * zoomDuration * 2) + zoomDuration,
              length: Math.min(zoomDuration, totalDuration - (firstPartDuration + (i * zoomDuration * 2) + zoomDuration)),
              effect: "zoomOut",
              fit: "cover"
            });
          }
        }
      } else {
        // If zoom is disabled, just show the last image statically
        zoomClips.push({
          asset: {
            type: "image",
            src: imageUrls[imageUrls.length - 1]
          },
          start: firstPartDuration,
          length: secondPartDuration,
          fit: "cover"
        });
      }

      const imageTrack = {
        clips: [
          ...imageUrls.map((url, index) => ({
            asset: {
              type: "image",
              src: url
            },
            start: index * imageDuration,
            length: imageDuration,
            effect: "zoomIn", // Always use zoomIn for first minute
            fit: "cover"
          })),
          ...zoomClips // Last image zoom in/out
        ]
      };
      tracks.push(imageTrack);
    }

    // Track for main audio (use compressed audio if available, fallback to regular audio)
    const audioUrlToUse = compressedAudioUrl || audioUrl;
    
    if (audioUrlToUse) {
        console.log(`🎵 Using ${compressedAudioUrl ? 'compressed' : 'original'} audio for video: ${audioUrlToUse}`);
        
        const audioTrack = {
            clips: [{
                asset: {
                    type: "audio",
                    src: audioUrlToUse,
                    volume: 1 // Ensure audio is audible
                },
                start: 0,
                length: totalDuration // Audio plays for the whole duration
            }]
        };
        tracks.push(audioTrack);
    } else {
        console.warn('⚠️ No audio URL provided for video generation');
    }

    // Prepend dust overlay track if available (becomes the first track)
    if (isOverlayAvailable) {
      console.log(`✨ Adding dust overlay to video: ${DUST_OVERLAY_URL}`);
      const overlayTrack = {
        clips: [
          {
            asset: {
              type: "video",
              src: DUST_OVERLAY_URL,
              volume: 0
            },
            start: 0,
            length: totalDuration,
            fit: "cover",
            opacity: 0.15 // Much lower opacity to prevent darkening (was 0.5)
          }
        ]
      };
      tracks.unshift(overlayTrack);
    }
    
    // Log the track structure for debugging
    console.log('📊 Final track structure:');
    tracks.forEach((track, index) => {
      const assetType = track.clips[0]?.asset?.type || 'unknown';
      const isOverlay = assetType === 'video' && track.clips[0]?.asset?.src === DUST_OVERLAY_URL;
      console.log(`  Track ${index}: ${assetType}${isOverlay ? ' (dust overlay)' : ''}`);
    });

    const timeline: any = {
      tracks: tracks
    };

    const outputConfig: any = {
      format: "mp4",
      size: {
        width: 1280,
        height: 720
      }
    };

    // Only add quality parameter if it's 'low'
    if (quality === 'low') {
      outputConfig.quality = "low";
    }

    const shotstackPayload = {
      timeline: timeline,
      output: outputConfig,
      callback: process.env.SHOTSTACK_CALLBACK_URL
    };

    console.log(JSON.stringify(shotstackPayload, null, 2));

    console.log("📤 Sending Shotstack API request with payload summary:");
    console.log(`- Video type: ${isSegmentedVideo ? 'Segmented' : 'Traditional'}`);
    console.log(`- Total tracks: ${tracks.length}`);
    console.log(`- Images: ${imageUrls.length}`);
    console.log(`- Audio: ${audioUrl ? 'YES' : 'NO'}`);
    console.log(`- Compressed Audio: ${compressedAudioUrl ? 'YES' : 'NO'}`);
    console.log(`- Subtitles: ${subtitlesUrl && enableSubtitles ? 'YES' : subtitlesUrl ? 'DISABLED' : 'NO'}`);
    console.log(`- Overlay: ${isOverlayAvailable ? 'YES' : shouldIncludeOverlay ? 'UNAVAILABLE' : 'DISABLED'}`);
    console.log(`- Zoom Effects: ${enableZoom ? 'YES' : 'NO'}`);
    console.log(`- Quality: ${quality}`);
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
      .from('video_records')
      .insert({
        id: videoId,
        user_id: userId,
        status: 'processing',
        shotstack_id: shotstackId,
        image_urls: imageUrls,
        audio_url: audioUrl,
        compressed_audio_url: compressedAudioUrl,
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