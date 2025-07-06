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
      fontFamily = 'Roboto',
      fontColor = '#ffffff',
      fontSize = 24,
      strokeWidth = 2,
      fontWeight = '1000',
      textTransform = 'none',
      audioDuration,
      // New video mode options
      videoMode = 'traditional',
      zoomEffect = false,
      dustOverlay = false,
      introImages,
      introDuration = 60,
      loopImageUrl,
      useEqualIntroDuration = true
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
    console.log(`🎞️ Video Mode: ${videoMode}`);
    console.log(`🔍 Zoom Effect: ${zoomEffect ? 'YES' : 'NO'}`);
    console.log(`✨ Dust Overlay: ${dustOverlay ? 'YES' : 'NO'}`);
    if (videoMode === 'option2') {
      console.log(`⏰ Intro Duration: ${introDuration}s`);
      console.log(`🖼️ Intro Images: ${introImages?.length || 0}`);
      console.log(`🔄 Loop Image URL: ${loopImageUrl ? 'YES' : 'NO'}`);
      console.log(`⚖️ Equal Intro Duration: ${useEqualIntroDuration ? 'YES' : 'NO'}`);
    }

    
    console.log(`📋 Video creation request:
      - Video Mode: ${videoMode}
      - Images: ${imageUrls?.length || 0}
      - Audio URL: ${audioUrl ? 'YES' : 'NO'}
      - Compressed Audio URL: ${compressedAudioUrl ? 'YES' : 'NO'}
      - Subtitles URL: ${subtitlesUrl ? 'YES' : 'NO'}
      - Segment timings: ${segmentTimings ? 'YES (segmented video)' : 'NO (equal timing)'}
      - Include Overlay: ${includeOverlay ? 'YES' : 'NO'}
      - Enable Overlay: ${enableOverlay}
      - Enable Zoom: ${enableZoom}
      - Enable Subtitles: ${enableSubtitles}
      - Quality: ${quality}
      - Zoom Effect: ${zoomEffect}
      - Dust Overlay: ${dustOverlay}
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

    // Get total audio duration first
    if (audioDuration && audioDuration > 0) {
      totalDuration = audioDuration;
      console.log(`✅ Using provided audio duration: ${totalDuration.toFixed(2)} seconds`);
    } else {
      console.warn('⚠️ No audio duration provided, using fallback duration of 300 seconds');
      totalDuration = 300;
    }

    if (segmentTimings && segmentTimings.length > 0) {
      // Segmented video (custom segment timing): use precise timing from segment timings
      isSegmentedVideo = true;
      totalDuration = segmentTimings.reduce((sum, timing) => sum + timing.duration, 0);
      imageDuration = 0; // Not used for segmented videos
      
      console.log(`Segmented video configuration:
        - Total duration: ${totalDuration.toFixed(2)} seconds
        - Number of segments: ${segmentTimings.length}
        - Individual durations: ${segmentTimings.map(t => t.duration.toFixed(2)).join(', ')}s`);
    } else if (videoMode === 'traditional') {
      // Traditional mode: distribute images equally across entire video duration
      imageDuration = totalDuration / imageUrls.length;
      
      console.log(`Traditional video configuration:
        - Total duration: ${totalDuration.toFixed(1)} seconds
        - Number of images: ${imageUrls.length}
        - Each image duration: ${imageDuration.toFixed(1)} seconds`);
    } else if (videoMode === 'option1') {
      // Option 1: Loop all images with zoom effects throughout entire duration
      // Calculate how many complete cycles we can fit
      const timePerImage = 3; // 3 seconds per image in the loop
      const cycleTime = imageUrls.length * timePerImage;
      
      console.log(`Option 1 video configuration:
        - Total duration: ${totalDuration.toFixed(1)} seconds
        - Images looping with zoom effects
        - Time per image: ${timePerImage} seconds
        - Complete cycles: ${Math.floor(totalDuration / cycleTime)}`);
    } else if (videoMode === 'option2') {
      // Option 2: Intro sequence + loop last image
      const actualIntroDuration = Math.min(introDuration, totalDuration - 10); // Leave at least 10s for loop
      const loopDuration = totalDuration - actualIntroDuration;
      
      console.log(`Option 2 video configuration:
        - Total duration: ${totalDuration.toFixed(1)} seconds
        - Intro duration: ${actualIntroDuration.toFixed(1)} seconds
        - Loop duration: ${loopDuration.toFixed(1)} seconds
        - Intro images: ${introImages?.length || 0}
        - Loop image: ${loopImageUrl ? 'YES' : 'NO'}`);
    }
    
    // Check if the dust overlay is accessible and if overlay is enabled
    const shouldIncludeOverlay = (includeOverlay || enableOverlay || dustOverlay);
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
      // Handle different video modes
      if (videoMode === 'traditional') {
        // Traditional mode: distribute images equally across entire duration
        console.log(`🎬 Creating traditional video with equal timing across ${totalDuration.toFixed(1)}s:`);
        
        const imageClips = imageUrls.map((url, index) => {
          const startTime = index * imageDuration;
          
          console.log(`   Image ${index + 1}: ${imageDuration.toFixed(2)}s at ${startTime.toFixed(2)}s`);
          
          return {
            asset: {
              type: "image",
              src: url
            },
            start: startTime,
            length: imageDuration,
            effect: enableZoom ? "zoomIn" : undefined,
            fit: "cover"
          };
        });

        const imageTrack = {
          clips: imageClips
        };
        tracks.push(imageTrack);
        
      } else if (videoMode === 'option1') {
        // Option 1: Loop all images with zoom effects throughout entire duration
        console.log(`🎬 Creating Option 1 video with looping images and zoom effects:`);
        
        const timePerImage = 3; // 3 seconds per image in the loop
        const imageClips = [];
        let currentTime = 0;
        
        while (currentTime < totalDuration) {
          for (let i = 0; i < imageUrls.length && currentTime < totalDuration; i++) {
            const remainingTime = totalDuration - currentTime;
            const clipDuration = Math.min(timePerImage, remainingTime);
            
            imageClips.push({
              asset: {
                type: "image",
                src: imageUrls[i]
              },
              start: currentTime,
              length: clipDuration,
              effect: zoomEffect ? (Math.random() > 0.5 ? "zoomIn" : "zoomOut") : undefined,
              fit: "cover"
            });
            
            currentTime += clipDuration;
          }
        }
        
        console.log(`   Created ${imageClips.length} image clips for looping`);
        
        const imageTrack = {
          clips: imageClips
        };
        tracks.push(imageTrack);
        
      } else if (videoMode === 'option2') {
        // Option 2: Intro sequence + loop last image
        console.log(`🎬 Creating Option 2 video with intro sequence + loop:`);
        
        const actualIntroDuration = Math.min(introDuration, totalDuration - 10);
        const loopDuration = totalDuration - actualIntroDuration;
        const imageClips = [];
        
        // Create intro sequence
        if (introImages && introImages.length > 0) {
          let currentTime = 0;
          
          for (const introImage of introImages.sort((a, b) => a.order - b.order)) {
            if (currentTime >= actualIntroDuration) break;
            
            const clipDuration = Math.min(introImage.duration, actualIntroDuration - currentTime);
            
            imageClips.push({
              asset: {
                type: "image",
                src: introImage.imageUrl
              },
              start: currentTime,
              length: clipDuration,
              effect: "slideLeft",
              fit: "cover"
            });
            
            currentTime += clipDuration;
            console.log(`   Intro image ${introImage.order}: ${clipDuration.toFixed(2)}s at ${(currentTime - clipDuration).toFixed(2)}s`);
          }
        }
        
        // Create loop sequence with the selected loop image
        if (loopImageUrl && loopDuration > 0) {
          const zoomCycleDuration = 15; // Each zoom cycle (in + out) lasts 15 seconds
          let loopStartTime = actualIntroDuration;
          
          while (loopStartTime < totalDuration) {
            const remainingTime = totalDuration - loopStartTime;
            const cycleDuration = Math.min(zoomCycleDuration, remainingTime);
            
            if (zoomEffect) {
              // Alternate between zoom in and zoom out
              const isZoomIn = Math.floor((loopStartTime - actualIntroDuration) / zoomCycleDuration) % 2 === 0;
              
              imageClips.push({
                asset: {
                  type: "image",
                  src: loopImageUrl
                },
                start: loopStartTime,
                length: cycleDuration,
                effect: isZoomIn ? "zoomIn" : "zoomOut",
                fit: "cover"
              });
            } else {
              imageClips.push({
                asset: {
                  type: "image",
                  src: loopImageUrl
                },
                start: loopStartTime,
                length: cycleDuration,
                fit: "cover"
              });
            }
            
            loopStartTime += cycleDuration;
          }
          
          console.log(`   Loop sequence: ${loopDuration.toFixed(2)}s with ${zoomEffect ? 'zoom effects' : 'static display'}`);
        }
        
        const imageTrack = {
          clips: imageClips
        };
        tracks.push(imageTrack);
        
      } else {
        // Fallback to traditional mode if videoMode is not recognized
        console.log(`🎬 Unknown video mode "${videoMode}", falling back to traditional:`);
        
        const imageClips = imageUrls.map((url, index) => {
          const startTime = index * imageDuration;
          
          return {
            asset: {
              type: "image",
              src: url
            },
            start: startTime,
            length: imageDuration,
            effect: enableZoom ? "zoomIn" : undefined,
            fit: "cover"
          };
        });

        const imageTrack = {
          clips: imageClips
        };
        tracks.push(imageTrack);
      }
    }

    // Track for main audio (use original audio for video, fallback to compressed)
    const audioUrlToUse = audioUrl || compressedAudioUrl;
    
    if (audioUrlToUse) {
        console.log(`🎵 Using ${audioUrl ? 'original' : 'compressed'} audio for video: ${audioUrlToUse}`);
        
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

    // Log payload summary instead of full JSON to avoid memory issues with large base64 data
    console.log("📤 Shotstack payload summary:");
    console.log(`- Timeline tracks: ${timeline.tracks.length}`);
    console.log(`- Output format: ${outputConfig.format}`);
    console.log(`- Output size: ${outputConfig.size.width}x${outputConfig.size.height}`);
    console.log(`- Callback URL: ${process.env.SHOTSTACK_CALLBACK_URL ? 'Set' : 'Not set'}`);

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
      console.log("Shotstack API error:", shotstackResponse);
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
    } : {
      type: videoMode,
      video_mode: videoMode,
      total_duration: totalDuration,
      scenes_count: imageUrls.length,
      zoom_effect: zoomEffect,
      dust_overlay: dustOverlay,
      ...(videoMode === 'option2' && {
        intro_duration: introDuration,
        intro_images_count: introImages?.length || 0,
        loop_image_url: loopImageUrl
      })
    };
    
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
        // Store metadata in error_message field for now (temporary solution)
        error_message: JSON.stringify(metadata),
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

    console.log(`✅ ${videoMode} video record created successfully with Shotstack ID: ${shotstackId}`);

    // Return success response with video ID and shotstack ID
    return NextResponse.json<CreateVideoResponse>({
      message: `${videoMode} video creation job started successfully`,
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