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
      videoUrls = [], // Add video URLs support
      // New ordered content arrays that preserve reordering
      orderedContentUrls,
      orderedContentTypes,
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
      // Simplified video effects
      zoomEffect = false,
      dustOverlay = false,
      // Custom music properties
      useCustomMusic = false,
      customMusicFiles = []
    } = body;
    
    console.log(`🖼️ Image URLs: ${imageUrls?.length || 0} images`);
    console.log(`🎬 Video URLs: ${videoUrls?.length || 0} videos`);
    console.log(`🔄 Ordered Content: ${orderedContentUrls ? orderedContentUrls.length + ' items (reordered)' : 'Using legacy mode'}`);
    console.log(`🎵 Audio URL: ${audioUrl}`);
    console.log(`🗜️ Compressed Audio URL: ${compressedAudioUrl}`);
    console.log(`📝 Subtitles URL: ${subtitlesUrl}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📷 Thumbnail URL: ${thumbnailUrl}`);
    console.log(`⏱️ Segment Timings: ${segmentTimings ? segmentTimings.length + ' segments' : 'No custom timing'}`);
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
    console.log(`🔍 Zoom Effect: ${zoomEffect ? 'YES' : 'NO'}`);
    console.log(`✨ Dust Overlay: ${dustOverlay ? 'YES' : 'NO'}`);
    console.log(`🎶 Custom Music: ${useCustomMusic ? 'YES' : 'NO'}`);
    if (useCustomMusic) {
      console.log(`🎵 Music Files: ${customMusicFiles?.length || 0}`);
    }
    
    // Log ordered content details if available
    if (orderedContentUrls && orderedContentTypes) {
      console.log(`🎯 Ordered sequence:`, orderedContentTypes.map((type, i) => `${i+1}. ${type}`).join(', '));
    }

    // Calculate total content count - prioritize ordered content if available
    let totalImages, totalVideos, totalContent;
    
    if (orderedContentUrls && orderedContentTypes) {
      // Use ordered content arrays when available (preserves reordering)
      totalContent = orderedContentUrls.length;
      totalImages = orderedContentTypes.filter(type => type === 'image').length;
      totalVideos = orderedContentTypes.filter(type => type === 'video').length;
      console.log(`📊 Using ordered content: ${totalContent} total (${totalImages} images, ${totalVideos} videos)`);
    } else {
      // Fallback to legacy arrays for backward compatibility
      totalImages = imageUrls?.length || 0;
      totalVideos = videoUrls?.length || 0;
      totalContent = totalImages + totalVideos;
      console.log(`📊 Using legacy content arrays: ${totalContent} total (${totalImages} images, ${totalVideos} videos)`);
    }
    
    console.log(`📋 Mixed content video creation request:
      - Images: ${totalImages}
      - Videos: ${totalVideos}
      - Total content pieces: ${totalContent}
      - Audio URL: ${audioUrl ? 'YES' : 'NO'}
      - Compressed Audio URL: ${compressedAudioUrl ? 'YES' : 'NO'}
      - Subtitles URL: ${subtitlesUrl ? 'YES' : 'NO'}
      - Segment timings: ${segmentTimings ? 'YES (custom durations)' : 'NO (equal timing)'}
      - Include Overlay: ${includeOverlay ? 'YES' : 'NO'}
      - Enable Overlay: ${enableOverlay}
      - Enable Zoom: ${enableZoom}
      - Enable Subtitles: ${enableSubtitles}
      - Quality: ${quality}
      - Zoom Effect: ${zoomEffect}
      - Dust Overlay: ${dustOverlay}
      - Custom Music: ${useCustomMusic}
      - Subtitle Styling: ${fontFamily}, ${fontColor}, ${fontSize}px, ${strokeWidth}px stroke, ${fontWeight}, ${textTransform}
      - User ID: ${userId}
    `);

    // Validate inputs
    if (totalContent === 0) {
      return NextResponse.json<CreateVideoResponse>({ error: 'At least one image or video is required.' }, { status: 400 });
    }
    if (!audioUrl) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Audio URL is required.' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json<CreateVideoResponse>({ error: 'User ID is required.' }, { status: 400 });
    }

    // Validate arrays
    if (imageUrls && (!Array.isArray(imageUrls))) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Image URLs must be an array.' }, { status: 400 });
    }
    if (videoUrls && (!Array.isArray(videoUrls))) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Video URLs must be an array.' }, { status: 400 });
    }

    // Validate segment timings if provided
    if (segmentTimings) {
      if (!Array.isArray(segmentTimings) || segmentTimings.length === 0) {
        return NextResponse.json<CreateVideoResponse>({ error: 'Segment timings must be a non-empty array when provided.' }, { status: 400 });
      }
      if (segmentTimings.length !== totalContent) {
        return NextResponse.json<CreateVideoResponse>({ 
          error: `Number of segment timings (${segmentTimings.length}) must match total content count (${totalContent}: ${totalImages} images + ${totalVideos} videos).` 
        }, { status: 400 });
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
      // Mixed content with custom segment timing: use precise timing from segment timings
      isSegmentedVideo = true;
      totalDuration = segmentTimings.reduce((sum, timing) => sum + timing.duration, 0);
      imageDuration = 0; // Not used for segmented videos
      
      console.log(`Mixed content video with custom timing:
        - Total duration: ${totalDuration.toFixed(2)} seconds
        - Total content pieces: ${totalContent} (${totalImages} images + ${totalVideos} videos)
        - Number of segments: ${segmentTimings.length}
        - Individual durations: ${segmentTimings.map(t => t.duration.toFixed(2)).join(', ')}s`);
    } else {
      // Traditional mode: distribute content equally across entire video duration
      imageDuration = totalDuration / totalContent;
      
      console.log(`Mixed content video with equal timing:
        - Total duration: ${totalDuration.toFixed(1)} seconds
        - Total content pieces: ${totalContent} (${totalImages} images + ${totalVideos} videos)
        - Each content piece duration: ${imageDuration.toFixed(1)} seconds`);
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

    // Track for mixed content (images and videos) - Create timeline respecting custom order
    console.log(`🎬 Creating mixed content video with ${totalImages} images and ${totalVideos} videos:`);
    
    const mediaClips: any[] = [];
    let currentTime = 0;
    
    if (orderedContentUrls && orderedContentTypes) {
      // Use ordered content arrays to preserve exact reordering sequence
      console.log(`🔄 Processing content using ordered arrays (preserves custom reordering)`);
      
      orderedContentUrls.forEach((url, index) => {
        const assetType = orderedContentTypes[index];
        const duration = isSegmentedVideo && segmentTimings ? segmentTimings[index].duration : imageDuration;
        const startTime = currentTime;
        
        console.log(`   Processing ${assetType} at position ${index + 1}: ${url.substring(0, 50)}...`);
        
        // Verify the URL format (should be actual URL, not ID:index format)
        if (url.includes(':') && !url.startsWith('http')) {
          console.warn(`⚠️ WARNING: Asset URL appears to be in ID format: ${url}`);
        }
        
        const clip = {
          asset: {
            type: assetType,
            src: url
          },
          start: startTime,
          length: duration,
          ...(assetType === 'image' && zoomEffect && { effect: index % 2 === 0 ? "zoomIn" : "zoomOut" }),
          fit: "cover"
        };
        
        mediaClips.push(clip);
        console.log(`   ✅ ${assetType.charAt(0).toUpperCase() + assetType.slice(1)} ${index + 1}: ${duration.toFixed(2)}s at ${startTime.toFixed(2)}s`);
        console.log(`   🎯 Asset URL: ${url}`);
        
        currentTime += duration;
      });
    } else {
      // Fallback to legacy processing for backward compatibility
      console.log(`🔄 Processing content using legacy arrays (images first, then videos)`);
      
      const allUrls = [...(imageUrls || []), ...(videoUrls || [])];
      const imageUrlSet = new Set(imageUrls || []);
      
      allUrls.forEach((url, index) => {
        const isImage = imageUrlSet.has(url);
        const assetType = isImage ? 'image' : 'video';
        const duration = isSegmentedVideo && segmentTimings ? segmentTimings[index].duration : imageDuration;
        const startTime = currentTime;
        
        console.log(`   Processing ${assetType} at position ${index + 1}: ${url.substring(0, 50)}...`);
        
        // Verify the URL format (should be actual URL, not ID:index format)
        if (url.includes(':') && !url.startsWith('http')) {
          console.warn(`⚠️ WARNING: Legacy path - Asset URL appears to be in ID format: ${url}`);
        }
        
        const clip = {
          asset: {
            type: assetType,
            src: url
          },
          start: startTime,
          length: duration,
          ...(isImage && zoomEffect && { effect: index % 2 === 0 ? "zoomIn" : "zoomOut" }),
          fit: "cover"
        };
        
        mediaClips.push(clip);
        console.log(`   ✅ ${assetType.charAt(0).toUpperCase() + assetType.slice(1)} ${index + 1}: ${duration.toFixed(2)}s at ${startTime.toFixed(2)}s`);
        
        currentTime += duration;
      });
    }

    const mediaTrack = {
      clips: mediaClips
    };
    tracks.push(mediaTrack);

    // Handle audio tracks - custom music or default audio
    if (useCustomMusic && customMusicFiles && customMusicFiles.length > 0) {
        console.log(`🎶 Using custom music: ${customMusicFiles.length} file(s)`);
        
        if (customMusicFiles.length === 1) {
            // Single file - loop continuously
            const musicFile = customMusicFiles[0];
            console.log(`🔄 Looping single music file: ${musicFile.name}`);
            
            const audioTrack = {
                clips: [{
                    asset: {
                        type: "audio",
                        src: musicFile.url,
                        volume: 0.7 // Slightly lower volume for background music
                    },
                    start: 0,
                    length: totalDuration,
                    loop: true // Enable looping for single file
                }]
            };
            tracks.push(audioTrack);
        } else {
            // Multiple files - play in sequence and loop the sequence
            console.log(`🎵 Creating sequence from ${customMusicFiles.length} music files`);
            
            const audioClips: any[] = [];
            let currentTime = 0;
            let sequenceIndex = 0;
            
            // Calculate total duration of one sequence
            const sequenceDuration = customMusicFiles.reduce((total, file) => {
                return total + (file.duration || 30); // Default 30s if duration unknown
            }, 0);
            
            console.log(`📊 Music sequence duration: ${sequenceDuration.toFixed(1)}s, Video duration: ${totalDuration.toFixed(1)}s`);
            
            // Generate clips to fill the entire video duration
            while (currentTime < totalDuration) {
                for (const musicFile of customMusicFiles) {
                    if (currentTime >= totalDuration) break;
                    
                    const fileDuration = musicFile.duration || 30;
                    const clipDuration = Math.min(fileDuration, totalDuration - currentTime);
                    
                    audioClips.push({
                        asset: {
                            type: "audio",
                            src: musicFile.url,
                            volume: 0.7
                        },
                        start: currentTime,
                        length: clipDuration
                    });
                    
                    console.log(`   Adding ${musicFile.name}: ${clipDuration.toFixed(1)}s at ${currentTime.toFixed(1)}s`);
                    currentTime += clipDuration;
                }
                sequenceIndex++;
            }
            
            const audioTrack = {
                clips: audioClips
            };
            tracks.push(audioTrack);
            
            console.log(`✅ Created ${audioClips.length} audio clips covering ${currentTime.toFixed(1)}s (${sequenceIndex} sequences)`);
        }
    } else {
        // Use default audio (speech/narration)
        const audioUrlToUse = audioUrl || compressedAudioUrl;
        
        if (audioUrlToUse) {
            console.log(`🎵 Using ${audioUrl ? 'original' : 'compressed'} speech audio for video: ${audioUrlToUse}`);
            
            const audioTrack = {
                clips: [{
                    asset: {
                        type: "audio",
                        src: audioUrlToUse,
                        volume: 1 // Full volume for speech
                    },
                    start: 0,
                    length: totalDuration
                }]
            };
            tracks.push(audioTrack);
        } else {
            console.warn('⚠️ No audio URL provided for video generation');
        }
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
    console.log(`- Video type: ${isSegmentedVideo ? 'Mixed Content (Custom Timing)' : 'Mixed Content (Equal Timing)'}`);
    console.log(`- Total tracks: ${tracks.length}`);
    console.log(`- Images: ${totalImages}`);
    console.log(`- Videos: ${totalVideos}`);
    console.log(`- Total content: ${totalContent}`);
    console.log(`- Audio: ${audioUrl ? 'YES' : 'NO'}`);
    console.log(`- Compressed Audio: ${compressedAudioUrl ? 'YES' : 'NO'}`);
    console.log(`- Subtitles: ${subtitlesUrl && enableSubtitles ? 'YES' : subtitlesUrl ? 'DISABLED' : 'NO'}`);
    console.log(`- Overlay: ${isOverlayAvailable ? 'YES' : shouldIncludeOverlay ? 'UNAVAILABLE' : 'DISABLED'}`);
    console.log(`- Zoom Effects: ${zoomEffect ? 'YES' : 'NO'}`);
    console.log(`- Quality: ${quality}`);
    console.log(`- Total duration: ${totalDuration.toFixed(2)}s`);
    
    // Make Shotstack API call BEFORE creating database record

    console.log("Shotstack payload:", JSON.stringify(shotstackPayload, null, 2));
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
      console.error('Shotstack API error:', JSON.stringify(errorData));
      
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
    
    // Prepare metadata for mixed content videos
    const metadata = {
      type: isSegmentedVideo ? 'mixed-content-custom' : 'mixed-content-equal',
      segment_timings: isSegmentedVideo ? segmentTimings : undefined,
      total_duration: totalDuration,
      content_count: totalContent,
      image_count: totalImages,
      video_count: totalVideos,
      zoom_effect: zoomEffect,
      dust_overlay: dustOverlay,
      custom_music: useCustomMusic,
      music_files_count: useCustomMusic ? customMusicFiles?.length || 0 : 0
    };
    
    const { error: dbError } = await supabase
      .from('video_records')
      .insert({
        id: videoId,
        user_id: userId,
        status: 'processing',
        shotstack_id: shotstackId,
        image_urls: imageUrls || [],
        audio_url: audioUrl,
        compressed_audio_url: compressedAudioUrl,
        subtitles_url: subtitlesUrl,
        // Use provided thumbnail URL, or fall back to first image if available, or empty string
        thumbnail_url: thumbnailUrl || (imageUrls && imageUrls[0]) || '',
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

    console.log(`✅ Mixed content video record created successfully with Shotstack ID: ${shotstackId}`);
    console.log(`📊 Final video composition: ${totalImages} images + ${totalVideos} videos = ${totalContent} total content pieces`);

    // Return success response with video ID and shotstack ID
    return NextResponse.json<CreateVideoResponse>({
      message: `Mixed content video creation job started successfully (${totalImages} images + ${totalVideos} videos)`,
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