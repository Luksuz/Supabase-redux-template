import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
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

async function downloadAudioWithYtDlp(videoId: string, outputDir: string): Promise<{ success: boolean; audioPath?: string; title?: string; error?: string }> {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`
    
    // Define output template - yt-dlp will replace %(title)s with the actual title
    const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s')
    // yt-dlp command: use the smallest available audio format
    // "worstaudio" in yt-dlp means the lowest available audio quality stream.
    // For YouTube, this is usually a low-bitrate m4a or webm audio stream.
    // The --audio-quality 9 flag (for ffmpeg) means the lowest quality for mp3 conversion.
    // This combination will result in the worst (lowest) audio quality output.
    const ytDlpArgs = [
      '-f', 'worstaudio',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '9', // 0=best, 9=worst for mp3
      '--output', outputTemplate,
      '--no-playlist',
      '--no-warnings',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      url
    ]
    console.log(`📥 Starting yt-dlp download for video: ${videoId}`)
    console.log(`🔧 Command: yt-dlp ${ytDlpArgs.join(' ')}`)
    
    const ytDlpProcess = spawn('yt-dlp', ytDlpArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    let stdoutData = ''
    let stderrData = ''
    
    ytDlpProcess.stdout.on('data', (data) => {
      const output = data.toString()
      stdoutData += output
      console.log(`yt-dlp stdout: ${output.trim()}`)
    })
    
    ytDlpProcess.stderr.on('data', (data) => {
      const output = data.toString()
      stderrData += output
      // yt-dlp outputs progress to stderr, so we log it
      if (output.includes('[download]') || output.includes('[ExtractAudio]')) {
        console.log(`yt-dlp progress: ${output.trim()}`)
      } else {
        console.warn(`yt-dlp stderr: ${output.trim()}`)
      }
    })
    
    ytDlpProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          // Find the downloaded file
          const files = await fs.readdir(outputDir)
          const audioFile = files.find(file => file.endsWith('.mp3'))
          
          if (audioFile) {
            const audioPath = path.join(outputDir, audioFile)
            // Extract title from filename (remove .mp3 extension)
            const title = audioFile.replace('.mp3', '')
            
            console.log(`✅ Successfully downloaded: ${title}`)
            resolve({
              success: true,
              audioPath,
              title: title.replace(/[^\w\s-]/g, '').trim() // Clean up title
            })
          } else {
            console.error('❌ Audio file not found after download')
            resolve({
              success: false,
              error: 'Audio file not found after download'
            })
          }
        } catch (error) {
          console.error('❌ Error finding downloaded file:', error)
          resolve({
            success: false,
            error: `Error finding downloaded file: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }
      } else {
        const errorMessage = stderrData || `yt-dlp process exited with code ${code}`
        console.error(`❌ yt-dlp failed with code ${code}:`, errorMessage)
        
        // Check for specific error patterns
        if (stderrData.includes('Sign in to confirm you\'re not a bot')) {
          resolve({
            success: false,
            error: 'YouTube is requesting bot verification. This may be due to rate limiting or IP blocking.'
          })
        } else if (stderrData.includes('Video unavailable')) {
          resolve({
            success: false,
            error: 'Video is unavailable or private'
          })
        } else if (stderrData.includes('Requested format is not available')) {
          resolve({
            success: false,
            error: 'Requested audio format is not available for this video'
          })
        } else {
          resolve({
            success: false,
            error: errorMessage
          })
        }
      }
    })
    
    ytDlpProcess.on('error', (error) => {
      console.error('❌ Failed to start yt-dlp process:', error)
      resolve({
        success: false,
        error: `Failed to start yt-dlp: ${error.message}. Make sure yt-dlp is installed and available in PATH.`
      })
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

  console.log(`✅ Subtitles generated for ${videoTitle}`)
  
  return {
    srtContent: reformattedSrt,
    size: Buffer.byteLength(reformattedSrt, 'utf-8')
  }
}

async function downloadAndTranscribeVideo(videoId: string): Promise<SubtitleFile> {
  // Create temporary directory for this download
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'youtube-audio-'))
  
  try {
    console.log(`📥 Processing video: ${videoId}`)
    
    // Download audio using yt-dlp CLI
    const downloadResult = await downloadAudioWithYtDlp(videoId, tempDir)
    
    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'Download failed')
    }
    
    const { audioPath, title } = downloadResult
    const videoTitle = title || `Video ${videoId}`
    
    // Generate subtitles
    const { srtContent, size } = await generateSubtitles(audioPath!, videoTitle)

    // Clean up audio file and temp directory
    await fs.unlink(audioPath!)
    await fs.rmdir(tempDir)

    return {
      videoId,
      title: videoTitle,
      filename: `${videoTitle.replace(/[^\w\s-]/g, '_')}_subtitles.srt`,
      srtContent,
      size,
      status: 'completed'
    }

  } catch (error) {
    console.error(`Error processing video ${videoId}:`, error)
    
    // Clean up temp directory on error
    try {
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file))
      }
      await fs.rmdir(tempDir)
    } catch (cleanupError) {
      console.warn('Failed to clean up temp directory:', cleanupError)
    }
    
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
    const maxConcurrent = 2 // Limited for Whisper API rate limits and to avoid overwhelming yt-dlp
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
    usage: 'Use POST method with video IDs to download audio and generate subtitles using yt-dlp CLI',
    requirements: 'Ensure yt-dlp is installed and available in system PATH'
  })
} 