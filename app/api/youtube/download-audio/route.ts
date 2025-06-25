import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { createWriteStream, createReadStream } from 'fs'
// @ts-ignore - ytdl-core doesn't have proper TypeScript definitions
import ytdl from 'ytdl-core'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface AudioDownloadRequest {
  videoIds: string[]
}

interface SubtitleFile {
  videoId: string
  title: string
  filename: string
  srtContent: string
  size: number
  status: 'processing' | 'completed' | 'error' | 'downloading' | 'transcribing'
  progress?: string
}

// Comprehensive SRT reformatting utility
function reformatSrtContent(srt: string): string {
  console.log("🔄 Starting SRT reformatting with 4-word segments...")
  
  try {
    const lines = srt.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const subtitles: Array<{
      index: number
      startTime: string
      endTime: string
      text: string
    }> = []
    
    // Parse existing SRT format
    let i = 0
    while (i < lines.length) {
      const indexLine = lines[i]
      if (!indexLine || !indexLine.match(/^\d+$/)) {
        i++
        continue
      }
      
      const timingLine = lines[i + 1]
      const textLines: string[] = []
      
      // Collect all text lines for this subtitle
      let j = i + 2
      while (j < lines.length && !lines[j].match(/^\d+$/)) {
        if (lines[j].includes('-->')) {
          j++
          continue
        }
        textLines.push(lines[j])
        j++
      }
      
      if (timingLine && timingLine.includes('-->')) {
        const [startTime, endTime] = timingLine.split(' --> ')
        const text = textLines.join(' ').trim()
        
        if (text) {
          subtitles.push({
            index: parseInt(indexLine),
            startTime: startTime.trim(),
            endTime: endTime.trim(),
            text
          })
        }
      }
      
      i = j
    }
    
    console.log(`📊 Parsed ${subtitles.length} original subtitle segments`)
    
    // Split into 4-word segments with distributed timing
    const reformattedSubtitles: Array<{
      index: number
      startTime: string
      endTime: string
      text: string
    }> = []
    
    let newIndex = 1
    
    for (const subtitle of subtitles) {
      const words = subtitle.text.split(/\s+/).filter(word => word.length > 0)
      
      if (words.length <= 4) {
        // Keep as is if 4 words or fewer
        reformattedSubtitles.push({
          ...subtitle,
          index: newIndex++
        })
      } else {
        // Split into segments of max 4 words
        const segments: string[] = []
        for (let i = 0; i < words.length; i += 4) {
          segments.push(words.slice(i, i + 4).join(' '))
        }
        
        // Calculate timing for each segment
        const totalDurationMs = timeToMs(subtitle.endTime) - timeToMs(subtitle.startTime)
        const segmentDurationMs = Math.floor(totalDurationMs / segments.length)
        
        for (let i = 0; i < segments.length; i++) {
          const segmentStartMs = timeToMs(subtitle.startTime) + (i * segmentDurationMs)
          const segmentEndMs = i === segments.length - 1 
            ? timeToMs(subtitle.endTime) // Last segment gets the exact end time
            : segmentStartMs + segmentDurationMs
          
          reformattedSubtitles.push({
            index: newIndex++,
            startTime: msToTime(segmentStartMs),
            endTime: msToTime(segmentEndMs),
            text: segments[i]
          })
        }
      }
    }
    
    console.log(`✅ Reformatted into ${reformattedSubtitles.length} segments (4 words max each)`)
    
    // Generate new SRT content
    const reformattedSrt = reformattedSubtitles
      .map(sub => `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`)
      .join('\n')
    
    return reformattedSrt
    
  } catch (error) {
    console.error('❌ Error reformatting SRT:', error)
    // Fallback to simple cleanup if parsing fails
    return srt
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n') + '\n'
  }
}

// Helper function to convert SRT time format to milliseconds
function timeToMs(timeStr: string): number {
  // Format: HH:MM:SS,mmm
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/)
  if (!match) {
    console.warn(`⚠️ Invalid time format: ${timeStr}`)
    return 0
  }
  
  const hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const seconds = parseInt(match[3])
  const milliseconds = parseInt(match[4])
  
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds
}

// Helper function to convert milliseconds to SRT time format
function msToTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const milliseconds = ms % 1000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

async function compressAudioWithFFmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🗜️ Compressing audio with FFmpeg...")
    
    // Aggressive compression settings for Whisper processing
    const ffmpegArgs = [
      '-i', inputPath,
      '-ab', '32k',        // Very low bitrate
      '-ar', '22050',      // Low sample rate
      '-ac', '1',          // Mono
      '-f', 'mp3',         // MP3 format
      '-y',                // Overwrite output file
      outputPath
    ]

    const ffmpeg = spawn('ffmpeg', ffmpegArgs)

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('time=')) {
        process.stdout.write('\r🗜️ Compressing... ')
      }
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Audio compression completed')
        resolve()
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`))
      }
    })

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg error: ${error.message}`))
    })
  })
}

async function generateSubtitles(audioPath: string, videoTitle: string): Promise<{ srtContent: string; size: number }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured")
  }

  console.log("🔤 Generating subtitles with Whisper...")

  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-1",
    response_format: "srt",
  })
  
  const rawSrt = transcription as unknown as string
  
  if (typeof rawSrt !== 'string' || rawSrt.trim() === '') {
    throw new Error('Failed to generate valid SRT data from OpenAI.')
  }
  
  console.log("🔤 Raw SRT generated. Reformatting...")
  const reformattedSrt = reformatSrtContent(rawSrt)

  console.log(`✅ Subtitles generated locally`)
  
  return {
    srtContent: reformattedSrt,
    size: Buffer.byteLength(reformattedSrt, 'utf-8')
  }
}

async function downloadAndTranscribeVideo(videoId: string): Promise<SubtitleFile> {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  
  try {
    // Validate URL
    const isValid = ytdl.validateURL(url)
    if (!isValid) {
      throw new Error('Invalid YouTube URL')
    }

    // Get video info
    const info = await ytdl.getInfo(url)
    const videoTitle = info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, "") // sanitize filename
    
    // Create temporary directory for this download
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'youtube-audio-'))
    const tempOutput = path.join(tempDir, `${videoTitle}_temp.mp3`)
    const finalOutput = path.join(tempDir, `${videoTitle}.mp3`)

    console.log(`📥 Downloading audio for: ${videoTitle}`)
    
    // Download audio
    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(tempOutput)
      
      ytdl(url, { 
        quality: "highestaudio",
        filter: "audioonly",
        format: "mp3"
      })
        .pipe(writeStream)
        .on("finish", () => {
          console.log(`Downloaded raw audio for ${videoTitle}`)
          resolve()
        })
        .on("error", (err: Error) => {
          console.error("Error writing file:", err)
          reject(err)
        })
    })

    // Compress with FFmpeg
    try {
      await compressAudioWithFFmpeg(tempOutput, finalOutput)
      await fs.unlink(tempOutput) // Remove temp file
      console.log("🧹 Cleaned up temporary file")
    } catch (ffmpegError: unknown) {
      const errorMessage = ffmpegError instanceof Error ? ffmpegError.message : 'Unknown FFmpeg error'
      console.warn("FFmpeg compression failed, using original file:", errorMessage)
      await fs.rename(tempOutput, finalOutput)
    }

    // Generate subtitles
    const { srtContent, size } = await generateSubtitles(finalOutput, videoTitle)

    // Clean up audio file
    await fs.unlink(finalOutput)
    await fs.rmdir(tempDir)

    return {
      videoId,
      title: videoTitle,
      filename: `${videoTitle}_subtitles.srt`,
      srtContent,
      size,
      status: 'completed'
    }

  } catch (error) {
    console.error(`Error processing video ${videoId}:`, error)
    return {
      videoId,
      title: `Video ${videoId}`,
      filename: '',
      srtContent: '',
      size: 0,
      status: 'error',
      progress: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { videoIds }: AudioDownloadRequest = await request.json()
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Please provide an array of video IDs' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured for subtitle generation' },
        { status: 500 }
      )
    }

    console.log(`Starting audio download and transcription for ${videoIds.length} videos`)
    
    // Process videos in parallel with limited concurrency
    const maxConcurrent = 2 // Reduced for Whisper API rate limits
    const subtitleFiles: SubtitleFile[] = []
    
    for (let i = 0; i < videoIds.length; i += maxConcurrent) {
      const batch = videoIds.slice(i, i + maxConcurrent)
      const batchResults = await Promise.all(
        batch.map(videoId => downloadAndTranscribeVideo(videoId))
      )
      subtitleFiles.push(...batchResults)
    }

    console.log(`Completed processing ${subtitleFiles.length} videos`)
    
    return NextResponse.json({
      success: true,
      subtitleFiles
    })

  } catch (error) {
    console.error('Audio download and transcription error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Audio download and subtitle generation API is working',
    method: 'GET',
    usage: 'Use POST method with video IDs to download audio and generate subtitles locally'
  })
} 