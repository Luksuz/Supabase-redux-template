import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fsPromises from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import { uploadFileToSupabase } from "@/lib/wellsaid-utils";
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateSubtitlesRequestBody {
    audioUrl: string;
    userId?: string;
}

// Comprehensive SRT reformatting utility
function reformatSrtContent(srt: string): string {
    console.log("🔄 Starting SRT reformatting with 4-word segments and precise timing...")

    try {
        const lines = srt.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        const subtitles: Array<{
            index: number
            startTime: string
            endTime: string
            text: string
        }> = []

        // Parse existing SRT format with stricter index detection
        let i = 0
        while (i < lines.length) {
            const indexLine = lines[i]
            const nextLine = lines[i + 1]
            // Treat as a new block only if current line is digits and the next line is a timing line
            if (!indexLine || !/^\d+$/.test(indexLine) || !nextLine || !nextLine.includes('-->')) {
                i++
                continue
            }

            const timingLine = nextLine
            const textLines: string[] = []

            // Collect all text lines for this subtitle until the next index+timing pair
            let j = i + 2
            while (
                j < lines.length &&
                !( /^\d+$/.test(lines[j]) && (j + 1 < lines.length) && lines[j + 1].includes('-->') )
            ) {
                if (lines[j].includes('-->')) { // skip any accidental timing-like lines inside text
                    j++
                    continue
                }
                textLines.push(lines[j])
                j++
            }

            const [startTime, endTime] = timingLine.split(' --> ')
            const text = textLines.join(' ').trim().toUpperCase()

            if (text) {
                subtitles.push({
                    index: parseInt(indexLine),
                    startTime: startTime.trim(),
                    endTime: endTime.trim(),
                    text
                })
            }

            i = j
        }

        console.log(`📊 Parsed ${subtitles.length} original subtitle segments`)

        // Split into 4-word segments with precise integer millisecond distribution
        const reformattedSubtitles: Array<{
            index: number
            startTime: string
            endTime: string
            text: string
        }> = []

        let newIndex = 1

        for (const subtitle of subtitles) {
            const words = subtitle.text.split(/\s+/).filter(word => word.length > 0)

            // If very short or zero duration, keep as-is
            const startMs = timeToMs(subtitle.startTime)
            const endMs = timeToMs(subtitle.endTime)
            const totalDurationMs = Math.max(0, endMs - startMs)

            if (words.length <= 4 || totalDurationMs === 0) {
                reformattedSubtitles.push({
                    index: newIndex++,
                    startTime: subtitle.startTime,
                    endTime: subtitle.endTime,
                    text: words.join(' ')
                })
                continue
            }

            // Build segments of up to 4 words
            const segments: string[] = []
            for (let k = 0; k < words.length; k += 4) {
                segments.push(words.slice(k, k + 4).join(' '))
            }

            const n = segments.length
            const base = Math.floor(totalDurationMs / n)
            let remainder = totalDurationMs - base * n // ensure exact sum

            let cursor = startMs
            for (let k = 0; k < n; k++) {
                const extra = remainder > 0 ? 1 : 0
                const dur = k === n - 1
                    ? (endMs - cursor) // force exact end on last
                    : base + extra
                if (remainder > 0 && k < n - 1) remainder -= 1

                const segStart = cursor
                const segEnd = segStart + Math.max(0, dur)
                cursor = segEnd

                reformattedSubtitles.push({
                    index: newIndex++,
                    startTime: msToTime(segStart),
                    endTime: msToTime(segEnd),
                    text: segments[k]
                })
            }
        }

        console.log(`✅ Reformatted into ${reformattedSubtitles.length} segments (4 words max each, precise timing)`)

        // Generate new SRT content without index lines to avoid index showing as caption
        const reformattedSrt = reformattedSubtitles
            .map(sub => `${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`)
            .join('\n')

        return reformattedSrt

    } catch (error) {
        console.error('❌ Error reformatting SRT:', error)
        // Fallback to original on error
        return srt
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

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { audioUrl, userId = "unknown_user" } = body as GenerateSubtitlesRequestBody;

    if (!audioUrl) {
        return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error("OpenAI API key is not configured.");
        return NextResponse.json({ error: 'OpenAI API key is not configured.' }, { status: 500 });
    }
    
    const tempDir = path.join(os.tmpdir(), 'audio_downloads_srt');
    await fsPromises.mkdir(tempDir, { recursive: true });
    
    let extension = '.tmp';
    try {
        const urlPath = new URL(audioUrl).pathname;
        const ext = path.extname(urlPath);
        if (ext) extension = ext;
    } catch (e) {
        console.warn('Could not parse audio URL for extension, using .tmp: ' + audioUrl);
    }
    const tempFileName = uuidv4() + extension;
    const tempFilePath = path.join(tempDir, tempFileName);

    try {
        console.log("🔤 Downloading audio from: " + audioUrl + " to " + tempFilePath);
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok || !audioResponse.body) {
            throw new Error("Failed to download audio file: " + audioResponse.statusText);
        }
        
        // Stream download to temporary file
        const fileStream = createWriteStream(tempFilePath);
        const reader = audioResponse.body.getReader();
        
        await new Promise<void>((resolve, reject) => {
            fileStream.on('open', async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value) fileStream.write(value);
                    }
                    fileStream.end();
                } catch (streamError) {
                    reject(streamError);
                }
            });
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
        
        console.log("📥 Audio downloaded successfully. Generating subtitles with Whisper...");

        const transcription = await openai.audio.transcriptions.create({
            file: createReadStream(tempFilePath),
            model: "whisper-1",
            response_format: "srt",
        });
        
        const rawSrt = transcription as unknown as string; 
        
        if (typeof rawSrt !== 'string' || rawSrt.trim() === '') {
            console.error("OpenAI Whisper did not return a valid non-empty SRT string.");
            throw new Error('Failed to generate valid SRT data from OpenAI.');
        }
        
        console.log("🔤 Raw SRT generated. Reformatting for precise timing...");
        const reformattedSrt = reformatSrtContent(rawSrt);

        const srtFileName = 'subtitles_' + Date.now() + '.srt';
        const destinationPath = 'subtitles/' + srtFileName;
        
        // Convert string to buffer for upload
        const srtBuffer = Buffer.from(reformattedSrt, 'utf-8');
        
        // Create temporary file for upload
        const tempSrtPath = path.join(tempDir, srtFileName);
        await fsPromises.writeFile(tempSrtPath, srtBuffer);

        const supabaseUrl = await uploadFileToSupabase(
            tempSrtPath,
            destinationPath,
            'text/srt'
        );

        if (!supabaseUrl) {
            throw new Error("Failed to upload reformatted SRT to Supabase.");
        }

        // Clean up temporary SRT file
        await fsPromises.unlink(tempSrtPath);

        console.log("✅ Subtitles generated and uploaded: " + supabaseUrl);
        return NextResponse.json({ 
            success: true,
            subtitlesUrl: supabaseUrl,
            message: "Subtitles generated successfully"
        });

    } catch (error: any) {
        console.error("❌ Error generating subtitles: " + error.message + (error.stack ? " Stack: " + error.stack : ""));
        return NextResponse.json({ error: error.message || "Failed to generate subtitles" }, { status: 500 });
    } finally {
        try {
            await fsPromises.unlink(tempFilePath);
            console.log("🧹 Cleaned up temporary audio file: " + tempFilePath);
        } catch (cleanupError: any) {
            if (cleanupError.code !== 'ENOENT') {
                 console.warn("⚠️ Failed to clean up temporary audio file " + tempFilePath + ": " + cleanupError.message);
            }
        }
    }
} 