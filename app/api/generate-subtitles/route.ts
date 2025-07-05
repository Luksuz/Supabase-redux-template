import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fsPromises from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import { uploadFileToSupabase } from "@/lib/upload-file";
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateSubtitlesRequestBody {
    audioUrl?: string;
    compressedAudioUrl?: string;  // Preferred for subtitle generation
    userId?: string;
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
    const { audioUrl, compressedAudioUrl, userId = "unknown_user" } = body as GenerateSubtitlesRequestBody;

    if (!audioUrl && !compressedAudioUrl) {
        return NextResponse.json({ error: 'Audio URL or compressedAudioUrl is required' }, { status: 400 });
    }

    // Use compressed audio URL if available (preferred for subtitles), otherwise use original
    const selectedAudioUrl = compressedAudioUrl || audioUrl!;

    if (!process.env.OPENAI_API_KEY) {
        console.error("OpenAI API key is not configured.");
        return NextResponse.json({ error: 'OpenAI API key is not configured.' }, { status: 500 });
    }
    
    const tempDir = path.join(os.tmpdir(), 'audio_downloads_srt');
    await fsPromises.mkdir(tempDir, { recursive: true });
    
    let extension = '.tmp';
    try {
        const urlPath = new URL(selectedAudioUrl).pathname;
        const ext = path.extname(urlPath);
        if (ext) extension = ext;
    } catch (e) {
        console.warn('Could not parse audio URL for extension, using .tmp: ' + selectedAudioUrl);
    }
    const tempFileName = uuidv4() + extension;
    const tempFilePath = path.join(tempDir, tempFileName);

    try {
        console.log("🔤 Downloading audio from: " + selectedAudioUrl + " to " + tempFilePath);
        const audioResponse = await fetch(selectedAudioUrl);
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
        
        console.log("�� Raw SRT generated. Uploading original to Supabase...");

        const srtFileName = 'subtitles_' + Date.now() + '.srt';
        const destinationPath = 'subtitles/' + srtFileName;
        
        // Convert string to buffer for upload
        const srtBuffer = Buffer.from(rawSrt, 'utf-8');
        
        // Create temporary file for upload
        const tempSrtPath = path.join(tempDir, srtFileName);
        await fsPromises.writeFile(tempSrtPath, srtBuffer);

        const supabaseUrl = await uploadFileToSupabase(
            tempSrtPath,
            destinationPath,
            'text/srt'
        );

        if (!supabaseUrl) {
            throw new Error("Failed to upload original SRT to Supabase.");
        }

        // Clean up temporary SRT file
        await fsPromises.unlink(tempSrtPath);

        console.log("✅ Original subtitles generated and uploaded: " + supabaseUrl);
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