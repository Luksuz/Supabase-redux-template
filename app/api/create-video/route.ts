import { NextRequest, NextResponse } from 'next/server';
import { CreateVideoRequestBody, CreateVideoResponse } from '@/types/video-generation';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { uploadFileToSupabase } from "@/lib/upload-file";
import os from 'os';
import path from 'path';
import fsPromises from 'fs/promises';

// Shotstack API settings from environment variables
const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY
const SHOTSTACK_ENDPOINT = process.env.SHOTSTACK_ENDPOINT

/**
 * Apply text transformation to SRT content based on textTransform setting
 */
function applyTextTransform(srt: string, textTransform: 'none' | 'uppercase'): string {
  if (textTransform === 'none') {
    return srt; // No transformation
  }

  console.log(`🔄 Applying text transform: ${textTransform}`);
  
  try {
    const lines = srt.split('\n');
    const transformedLines = lines.map(line => {
      const trimmedLine = line.trim();
      
      // Skip index lines (pure numbers)
      if (trimmedLine.match(/^\d+$/)) {
        return line;
      }
      
      // Skip timestamp lines (contains -->)
      if (trimmedLine.includes('-->')) {
        return line;
      }
      
      // Skip empty lines
      if (trimmedLine === '') {
        return line;
      }
      
      // Transform text lines
      switch (textTransform) {
        case 'uppercase':
          return trimmedLine.toUpperCase();
        default:
          return line;
      }
    });
    
    console.log(`✅ Text transform ${textTransform} applied successfully`);
    return transformedLines.join('\n');
    
  } catch (error) {
    console.error('❌ Error applying text transform:', error);
    return srt; // Return original on error
  }
}

/**
 * Download, transform, and re-upload SRT file
 */
async function processSubtitleFile(
  subtitlesUrl: string, 
  textTransform: 'none' | 'uppercase'
): Promise<string> {
  if (textTransform === 'none') {
    console.log('📝 No text transform needed, using original subtitles URL');
    return subtitlesUrl; // No processing needed
  }

  console.log(`📥 Processing subtitle file with transform: ${textTransform}`);
  
  const tempDir = path.join(os.tmpdir(), 'subtitle_processing');
  await fsPromises.mkdir(tempDir, { recursive: true });
  
  const originalFileName = path.basename(new URL(subtitlesUrl).pathname);
  const tempFilePath = path.join(tempDir, originalFileName);
  
  try {
    // Download original SRT file
    console.log('📥 Downloading original SRT file...');
    const response = await fetch(subtitlesUrl);
    if (!response.ok) {
      throw new Error(`Failed to download SRT file: ${response.statusText}`);
    }
    
    const originalSrtContent = await response.text();
    console.log('✅ Original SRT downloaded successfully');
    
    // Apply text transformation
    const transformedSrtContent = applyTextTransform(originalSrtContent, textTransform);
    
    // Write transformed content to temp file
    await fsPromises.writeFile(tempFilePath, transformedSrtContent, 'utf-8');
    
    // Upload transformed file to same location (overwrite)
    const urlParts = new URL(subtitlesUrl);
    const supabasePath = urlParts.pathname.replace('/storage/v1/object/public/files/', '');
    
    console.log(`☁️ Uploading transformed SRT to: ${supabasePath}`);
    const newSubtitlesUrl = await uploadFileToSupabase(
      tempFilePath,
      supabasePath,
      'text/srt'
    );
    
    if (!newSubtitlesUrl) {
      throw new Error('Failed to upload transformed SRT file');
    }
    
    console.log('✅ Transformed SRT uploaded successfully');
    return newSubtitlesUrl;
    
  } catch (error) {
    console.error('❌ Error processing subtitle file:', error);
    // Return original URL on error
    return subtitlesUrl;
  } finally {
    // Cleanup temp file
    try {
      await fsPromises.unlink(tempFilePath);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
    }
  }
}

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
    // Map font family names to Shotstack-compatible names
    const getShotstackFontFamily = (fontFamily: string): string => {
      const fontMap: Record<string, string> = {
        'Arapey Regular': 'serif', // Fallback to serif
        'Clear Sans': 'sans-serif', // Fallback to sans-serif
        'Didact Gothic': 'Didact Gothic',
        'Montserrat ExtraBold': 'Montserrat',
        'Montserrat SemiBold': 'Montserrat',
        'OpenSans Bold': 'Open Sans',
        'Permanent Marker': 'Permanent Marker',
        'Roboto': 'Roboto',
        'Sue Ellen Francisco': 'cursive', // Fallback to cursive
        'UniNeue': 'sans-serif', // Fallback to sans-serif
        'WorkSans Light': 'Work Sans'
      }
      
      return fontMap[fontFamily] || 'Montserrat'
    }

    // Get the user from the authenticated session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const authenticatedUserId = user.id;
    console.log(`🔐 Authenticated user: ${authenticatedUserId}`);

    const body: CreateVideoRequestBody = await request.json();
    const { 
      imageUrls, 
      mediaTypes, 
      audioUrl, 
      audioDuration, 
      subtitlesUrl, 
      thumbnailUrl, 
      segmentTimings, 
      musicUrl, 
      musicVolume, 
      muteStockVideo,
      brightness,
      voiceVolume,
      overlayEffects,
      // Subtitle styling properties
      fontFamily,
      fontSize,
      fontColor,
      fontWeight,
      strokeWidth,
      marginTop,
      marginLeft,
      marginRight,
      textTransform
    } = body;
    console.log(`🖼️ Image URLs: ${imageUrls}`);
    console.log(`🎭 Media Types: ${mediaTypes}`);
    console.log(`🎵 Audio URL: ${audioUrl}`);
    console.log(`⏱️ Audio Duration: ${audioDuration ? `${audioDuration}s` : 'not provided'}`);
    console.log(`📝 Subtitles URL: ${subtitlesUrl}`);
    console.log(`👤 User ID: ${authenticatedUserId}`);
    console.log(`📷 Thumbnail URL: ${thumbnailUrl}`);
    console.log(`⏱️ Segment Timings: ${segmentTimings}`);
    console.log(`🎶 Music URL: ${musicUrl}`);
    console.log(`🔊 Music Volume: ${musicVolume}`);
    console.log(`🔇 Mute Stock Video: ${muteStockVideo}`);
    console.log(`🌞 Brightness: ${brightness || 0}`);
    console.log(`🔊 Voice Volume: ${voiceVolume !== undefined ? `${Math.round(voiceVolume * 100)}%` : '100%'}`);
    console.log(`✨ Overlay Effects: ${overlayEffects?.length ? overlayEffects.join(', ') : 'none'}`);
    console.log(`📋 Text Transform: ${textTransform}`);
    console.log(`🎨 Font Color: ${fontColor || '#ffffff'}`);
    console.log(`📝 Font Family: ${fontFamily || 'Montserrat ExtraBold'}`);
    console.log(`📏 Font Size: ${fontSize || 24}px`);

    
    console.log(`📋 Video creation request:
      - Images: ${imageUrls?.length || 0}
      - Audio URL: ${audioUrl ? 'YES' : 'NO'}
      - Audio Duration: ${audioDuration ? `${audioDuration}s` : 'not provided'}
      - Subtitles URL: ${subtitlesUrl ? 'YES' : 'NO'}
      - Background Music: ${musicUrl ? 'YES' : 'NO'}
      - Music Volume: ${musicVolume ? `${Math.round(musicVolume * 100)}%` : 'N/A'}
      - Mute Stock Video: ${muteStockVideo ? 'YES' : 'NO'}
      - Overlay Effects: ${overlayEffects?.length ? `YES (${overlayEffects.join(', ')})` : 'NO'}
      - Segment timings: ${segmentTimings ? 'YES (segmented video)' : 'NO (traditional video)'}
      - User ID: ${authenticatedUserId}
    `);

    // Validate inputs
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Image URLs are required.' }, { status: 400 });
    }
    if (!audioUrl) {
      return NextResponse.json<CreateVideoResponse>({ error: 'Audio URL is required.' }, { status: 400 });
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
    console.log(`Starting video creation with ID: ${videoId} for user: ${authenticatedUserId}`);

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
      console.log('Using traditional video timing with audio duration...');
      
      // Use passed duration or fallback to getting it from audio file
      const audioDurationValue = audioDuration || await getAudioDuration(audioUrl);
      
      // If we can't get audio duration, default to 5 minutes
      totalDuration = audioDurationValue || 300; 
      // Each image gets equal time in the slideshow
      imageDuration = totalDuration / imageUrls.length;
      
      console.log(`Traditional video configuration:
        - Total duration: ${totalDuration.toFixed(1)} seconds
        - Number of images: ${imageUrls.length}
        - Duration per image: ${imageDuration.toFixed(1)} seconds
        - Duration source: ${audioDuration ? 'frontend' : 'fallback'}`);
    }
    
    // Initialize tracks array
    let tracks = [];

    // Track for overlay effects (if overlayEffects is present) - Must be first for proper layering
    if (overlayEffects && overlayEffects.length > 0) {
        // Map overlay effect to URL
        const getOverlayUrl = (effect: string): string => {
            const overlayMap: Record<string, string> = {
                'dust': 'https://byktarizdjtreqwudqmv.supabase.co/storage/v1/object/public/video-generator/overlay.webm',
                'fire-particles': 'https://wbbhdqthxqdzzdandrfy.supabase.co/storage/v1/object/public/audio/drive-download-20250803T085638Z-1-001/Fire%20Particles%20Overlay.mov',
                'screen-displacement': 'https://wbbhdqthxqdzzdandrfy.supabase.co/storage/v1/object/public/audio/drive-download-20250803T085638Z-1-001/screen-displacement-map-glitch-effect-digital-pixe-2024-07-17-05-42-56-utc.mov',
                'snow-falling': 'https://wbbhdqthxqdzzdandrfy.supabase.co/storage/v1/object/public/audio/drive-download-20250803T085638Z-1-001/snow-falling-2023-11-27-04-51-47-utc.mp4'
            }
            return overlayMap[effect] || ''
        }

        console.log(`✨ Adding ${overlayEffects.length} overlay effects (first tracks for proper layering)`);
        
        // Create a track for each overlay effect
        overlayEffects.forEach((effect, index) => {
            const overlayUrl = getOverlayUrl(effect);
            if (overlayUrl) {
                const overlayTrack = {
                    clips: [{
                        asset: {
                            type: "video",
                            src: overlayUrl,
                            volume: 0 // Mute overlay video audio to avoid interference
                        },
                        start: 0,
                        length: totalDuration,
                        fit: "cover",
                        opacity: 0.2 // Match the opacity from your example
                    }]
                };
                tracks.push(overlayTrack);
                
                console.log(`   ✨ Overlay track ${index + 1} added: ${effect} with opacity 0.2`);
            } else {
                console.warn(`⚠️ Unknown overlay effect: ${effect}`);
            }
        });
    }

    // Track for subtitles (captions) - Add after overlay if it exists
    if (subtitlesUrl) {
      console.log(`Adding subtitles to video: ${subtitlesUrl}`);
      const transformedSubtitlesUrl = await processSubtitleFile(subtitlesUrl, textTransform || 'uppercase');
      const resolvedFontColor = fontColor || '#ffffff';
      console.log(`🎨 Resolved font color for Shotstack: ${resolvedFontColor}`);
      
      const captionTrack = {
        clips: [
          {
            asset: {
              type: "caption",
              src: transformedSubtitlesUrl,
              font: {
                family: getShotstackFontFamily(fontFamily || 'Montserrat ExtraBold'),
                size: fontSize || 24,
                color: resolvedFontColor,
                weight: fontWeight || '700',
                stroke: "#000000",
                strokeWidth: strokeWidth || 2
              },
              background: {
                color: "#ffffff",
                opacity: 0,
                padding: 12,
              },
              // Apply margin positioning
              margin: {
                top: marginTop || 0.75,
                left: marginLeft || 0,
                right: marginRight || 0
              }
            },
            start: 0,
            length: totalDuration
          }
        ]
      };
      tracks.push(captionTrack);
    }

    // Track for images - Create slideshow with timing based on mode
    if (isSegmentedVideo && segmentTimings) {
      // Segmented video: use precise timing with static images
      console.log(`🎬 Creating segmented video with ${imageUrls.length} precisely timed media assets:`);
      let currentTime = 0;
      const imageClips = imageUrls.map((url, index) => {
        const duration = segmentTimings[index].duration;
        const startTime = currentTime;
        const assetType = mediaTypes && mediaTypes[index] ? mediaTypes[index] : 'image';
        
        console.log(`   Segment ${index + 1}: ${duration.toFixed(2)}s at ${startTime.toFixed(2)}s (${assetType})`);
        if (assetType === 'video' && muteStockVideo) {
          console.log(`   🔇 Muting stock video audio for segment ${index + 1}`);
        }
        if (brightness !== undefined && brightness !== 0) {
          const effectType = brightness > 0 ? 'lighten' : 'darken';
          const opacityValue = brightness > 0 ? Math.min(1, 1 + (brightness / 100)) : Math.max(0.2, 1 + (brightness / 100));
          console.log(`   🌞 Applying chroma-based brightness effect: ${brightness} (${effectType}, opacity: ${opacityValue.toFixed(2)}) for segment ${index + 1}`);
        }
        
        // Create brightness effect using chroma key approach
        const getBrightnessEffect = (brightnessValue: number) => {
          if (brightnessValue === 0) return {}
          
          if (brightnessValue > 0) {
            // For brighter effect, use opacity and overlay technique
            return {
              opacity: Math.min(1, 1 + (brightnessValue / 100)),
              filter: "lighten"
            }
          } else {
            // For darker effect, use chroma-like overlay with dark color
            return {
              opacity: Math.max(0.2, 1 + (brightnessValue / 100)),
              filter: "darken"
            }
          }
        }

        const clip = {
          asset: {
            type: assetType,
            src: url,
            // Apply volume 0 to video assets if muteStockVideo is enabled
            ...(assetType === 'video' && muteStockVideo && { volume: 0 })
          },
          start: startTime,
          length: duration,
          fit: "cover",
          // Apply brightness effect using chroma key approach
          ...(brightness !== undefined && brightness !== 0 && getBrightnessEffect(brightness))
        };
        
        currentTime += duration;
        return clip;
      });

      const imageTrack = {
        clips: imageClips
      };
      tracks.push(imageTrack);
    } else {
      // Traditional video: equal timing for all images with static display
      console.log(`🎬 Creating traditional slideshow with ${imageUrls.length} media assets:`);
      const imageClips = imageUrls.map((url, index) => {
        const startTime = index * imageDuration;
        const assetType = mediaTypes && mediaTypes[index] ? mediaTypes[index] : 'image';
        
        console.log(`   Asset ${index + 1}: ${assetType} display, ${imageDuration.toFixed(2)}s at ${startTime.toFixed(2)}s`);
        if (assetType === 'video' && muteStockVideo) {
          console.log(`   🔇 Muting stock video audio for asset ${index + 1}`);
        }
        if (brightness !== undefined && brightness !== 0) {
          const effectType = brightness > 0 ? 'lighten' : 'darken';
          const opacityValue = brightness > 0 ? Math.min(1, 1 + (brightness / 100)) : Math.max(0.2, 1 + (brightness / 100));
          console.log(`   🌞 Applying chroma-based brightness effect: ${brightness} (${effectType}, opacity: ${opacityValue.toFixed(2)}) for asset ${index + 1}`);
        }
        
        // Create brightness effect using chroma key approach for traditional video
        const getBrightnessEffectTraditional = (brightnessValue: number) => {
          if (brightnessValue === 0) return {}
          
          if (brightnessValue > 0) {
            // For brighter effect, use opacity and overlay technique
            return {
              opacity: Math.min(1, 1 + (brightnessValue / 100)),
              filter: "lighten"
            }
          } else {
            // For darker effect, use chroma-like overlay with dark color
            return {
              opacity: Math.max(0.2, 1 + (brightnessValue / 100)),
              filter: "darken"
            }
          }
        }

        return {
          asset: {
            type: assetType,
            src: url,
            // Apply volume 0 to video assets if muteStockVideo is enabled
            ...(assetType === 'video' && muteStockVideo && { volume: 0 })
          },
          start: startTime,
          length: imageDuration,
          fit: "cover",
          // Apply brightness effect using chroma key approach
          ...(brightness !== undefined && brightness !== 0 && getBrightnessEffectTraditional(brightness))
        };
      });

      const imageTrack = {
        clips: imageClips
      };
      tracks.push(imageTrack);
    }

    // Track for main audio (if audioUrl is present)
    if (audioUrl) {
        const resolvedVoiceVolume = voiceVolume !== undefined ? voiceVolume : 1.0;
        console.log(`🎤 Setting voice track volume to: ${Math.round(resolvedVoiceVolume * 100)}%`);
        
        const audioTrack = {
            clips: [{
                asset: {
                    type: "audio",
                    src: audioUrl,
                    volume: resolvedVoiceVolume // Apply user-controlled voice volume
                },
                start: 0,
                length: totalDuration // Audio plays for the whole duration
            }]
        };
        tracks.push(audioTrack);
    }

    // Track for background music (if musicUrl is present)
    if (musicUrl && musicVolume) {
        console.log(`🎶 Adding background music track: volume ${Math.round(musicVolume * 100)}%`);
        
        // For music looping, we need to estimate the music duration and create multiple clips
        // Most music tracks are between 30-300 seconds, we'll assume 60 seconds as default
        const estimatedMusicDuration = 60; // seconds - could be made configurable
        
        // Calculate how many loops we need to cover the total video duration
        const numberOfLoops = Math.ceil(totalDuration / estimatedMusicDuration);
        
        console.log(`🔄 Music looping: estimated music duration ${estimatedMusicDuration}s, video duration ${totalDuration.toFixed(1)}s, creating ${numberOfLoops} loops`);
        
        // Create multiple clips of the same music to loop throughout the video
        const musicClips = [];
        for (let i = 0; i < numberOfLoops; i++) {
            const startTime = i * estimatedMusicDuration;
            const clipLength = Math.min(estimatedMusicDuration, totalDuration - startTime);
            
            // Only add clip if it has meaningful duration (at least 1 second)
            if (clipLength >= 1) {
                musicClips.push({
                    asset: {
                        type: "audio",
                        src: musicUrl,
                        volume: musicVolume
                    },
                    start: startTime,
                    length: clipLength
                });
                
                console.log(`   🎵 Music clip ${i + 1}: starts at ${startTime.toFixed(1)}s, length ${clipLength.toFixed(1)}s`);
            }
        }
        
        const musicTrack = {
            clips: musicClips
        };
        tracks.push(musicTrack);
    }


    
    // Log the track structure for debugging
    // console.log('📊 Final track structure:');
    // tracks.forEach((track, index) => {
    //   const assetType = track.clips[0]?.asset?.type || 'unknown';
    //   console.log(`  Track ${index}: ${assetType}`);
    // });

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

    // Write payload to JSON file for debugging
    try {
      const payloadFileName = `shotstack-payload-${videoId}-${Date.now()}.json`;
      const payloadPath = join(process.cwd(), 'debug', payloadFileName);
      
      // Create debug directory if it doesn't exist
      const debugDir = join(process.cwd(), 'debug');
      try {
        const fs = require('fs');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
      } catch (dirError) {
        console.warn('Could not create debug directory:', dirError);
      }
      
      // Write the payload with pretty formatting
      const formattedPayload = {
        metadata: {
          videoId: videoId,
          timestamp: new Date().toISOString(),
          videoType: isSegmentedVideo ? 'Segmented' : 'Traditional',
          totalDuration: totalDuration,
          imageCount: imageUrls.length,
          hasAudio: !!audioUrl,
          hasSubtitles: !!subtitlesUrl,
          hasMusic: !!musicUrl,
          musicVolume: musicVolume ? `${Math.round(musicVolume * 100)}%` : 'N/A',
          muteStockVideo: muteStockVideo,
          overlayEffects: overlayEffects?.length ? overlayEffects.join(', ') : 'none'
        },
        payload: shotstackPayload
      };
      
      writeFileSync(payloadPath, JSON.stringify(formattedPayload, null, 2));
      console.log(`📄 Shotstack payload saved to: ${payloadPath}`);
    } catch (writeError) {
      console.warn('Could not write payload to file:', writeError);
    }

    console.log(JSON.stringify(shotstackPayload, null, 2));

    console.log("📤 Sending Shotstack API request with payload summary:");
    console.log(`- Video type: ${isSegmentedVideo ? 'Segmented' : 'Traditional'}`);
    console.log(`- Total tracks: ${tracks.length}`);
    console.log(`- Media assets: ${imageUrls.length}`);
    console.log(`- Audio: ${audioUrl ? 'YES' : 'NO'}`);
    console.log(`- Voice Volume: ${voiceVolume !== undefined ? `${Math.round(voiceVolume * 100)}%` : '100%'}`);
    console.log(`- Background Music: ${musicUrl ? 'YES' : 'NO'}`);
    console.log(`- Music Volume: ${musicUrl && musicVolume ? `${Math.round(musicVolume * 100)}%` : 'N/A'}`);
    console.log(`- Mute Stock Video: ${muteStockVideo ? 'YES' : 'NO'}`);
    console.log(`- Brightness: ${brightness !== undefined && brightness !== 0 ? `${brightness > 0 ? '+' : ''}${brightness} (chroma-based ${brightness > 0 ? 'lighten' : 'darken'})` : 'Normal (0)'}`);
    console.log(`- Overlay Effects: ${overlayEffects?.length ? `YES (${overlayEffects.join(', ')})` : 'NO'}`);
    console.log(`- Subtitles: ${subtitlesUrl ? 'YES' : 'NO'}`);
    console.log(`- Font Color: ${fontColor || '#ffffff'}`);
    console.log(`- Total duration: ${totalDuration.toFixed(2)}s`);
    
    // Make Shotstack API call BEFORE creating database record
    const shotstackResponse = await fetch(`${SHOTSTACK_ENDPOINT}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SHOTSTACK_API_KEY || ''
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
        user_id: authenticatedUserId,
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