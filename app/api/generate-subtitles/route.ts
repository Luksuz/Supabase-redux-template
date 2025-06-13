import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fsPromises from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import { uploadFileToSupabase } from "@/lib/wellsaid-utils";
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateSubtitlesRequestBody {
    audioUrl: string;
    userId?: string;
}

// Simple SRT reformatting utility
function reformatSrtContent(srt: string): string {
    return srt
        .split('\n')
        .map(line => {
            const trimmedLine = line.trim();
            
            // Skip empty lines
            if (trimmedLine.length === 0) return trimmedLine;
            
            // Skip sequence numbers (lines with only digits)
            if (/^\d+$/.test(trimmedLine)) return trimmedLine;
            
            // Skip timestamp lines (format: 00:00:00,000 --> 00:00:00,000)
            if (/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(trimmedLine)) {
                return trimmedLine;
            }
            
            // Convert subtitle text to uppercase
            return trimmedLine.toUpperCase();
        })
        .filter(line => line.length > 0)
        .join('\n') + '\n';
}

// Helper function to convert seconds to SRT timestamp format
function secondsToSrtTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Helper function to parse SRT timestamp to seconds
function srtTimestampToSeconds(timestamp: string): number {
    const [time, ms] = timestamp.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    const milliseconds = parseInt(ms);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

// Helper function to offset SRT timestamps
function offsetSrtTimestamps(srtContent: string, offsetSeconds: number): string {
    const lines = srtContent.split('\n');
    let entryNumber = 1;
    
    return lines.map(line => {
        // Check if line is a timestamp line
        if (/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(line.trim())) {
            const [startTimestamp, endTimestamp] = line.trim().split(' --> ');
            const startSeconds = srtTimestampToSeconds(startTimestamp) + offsetSeconds;
            const endSeconds = srtTimestampToSeconds(endTimestamp) + offsetSeconds;
            
            return `${secondsToSrtTimestamp(startSeconds)} --> ${secondsToSrtTimestamp(endSeconds)}`;
        }
        // Check if line is a sequence number - renumber sequentially
        else if (/^\d+$/.test(line.trim())) {
            const currentNumber = entryNumber++;
            return currentNumber.toString();
        }
        return line;
    }).join('\n');
}

// Helper function to combine two SRT files
function combineSrtFiles(srt1: string, srt2: string, chunk1Duration: number): string {
    const reformattedSrt1 = reformatSrtContent(srt1);
    const offsetSrt2 = offsetSrtTimestamps(srt2, chunk1Duration);
    const reformattedSrt2 = reformatSrtContent(offsetSrt2);
    
    // Remove trailing whitespace and ensure proper ending
    const cleanSrt1 = reformattedSrt1.trim();
    const cleanSrt2 = reformattedSrt2.trim();
    
    // Combine with proper spacing
    return cleanSrt1 + '\n\n' + cleanSrt2 + '\n';
}

// Helper function to get audio duration
async function getAudioDuration(filePath: string): Promise<number> {
    try {
        const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`);
        const duration = parseFloat(stdout.trim());
        
        if (isNaN(duration) || duration <= 0) {
            throw new Error(`Invalid audio duration: ${stdout.trim()}`);
        }
        
        return duration;
    } catch (error) {
        console.error('Error getting audio duration:', error);
        throw new Error('Failed to get audio duration');
    }
}

// Helper function to split audio into chunks
async function splitAudioIntoChunks(inputPath: string, tempDir: string): Promise<{ chunk1Path: string; chunk2Path: string; chunk1Duration: number; chunk2Duration: number }> {
    const duration = await getAudioDuration(inputPath);
    const midPoint = duration / 2;
    
    const chunk1Path = path.join(tempDir, `chunk1_${uuidv4()}.webm`);
    const chunk2Path = path.join(tempDir, `chunk2_${uuidv4()}.webm`);
    
    console.log(`🔪 Splitting ${duration.toFixed(2)}s audio into 2 chunks at ${midPoint.toFixed(2)}s`);
    
    // Split audio into two chunks
    const chunk1Promise = execAsync(`ffmpeg -i "${inputPath}" -t ${midPoint} -c copy "${chunk1Path}"`);
    const chunk2Promise = execAsync(`ffmpeg -i "${inputPath}" -ss ${midPoint} -c copy "${chunk2Path}"`);
    
    await Promise.all([chunk1Promise, chunk2Promise]);
    
    // Get duration of chunk1 for proper SRT offsetting
    const chunk1Duration = await getAudioDuration(chunk1Path);
    const chunk2Duration = duration - midPoint;
    
    console.log(`✅ Audio split complete: chunk1=${chunk1Duration.toFixed(2)}s, chunk2=${chunk2Duration.toFixed(2)}s`);
    
    return { chunk1Path, chunk2Path, chunk1Duration, chunk2Duration };
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
    
    const tempDir = path.join(os.tmpdir(), 'audio_downloads_srt', uuidv4());
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
        
        console.log("📥 Audio downloaded successfully. Checking duration for chunking strategy...");

        // Get audio duration to determine if chunking is needed
        const audioDuration = await getAudioDuration(tempFilePath);
        console.log(`⏱️ Audio duration: ${audioDuration.toFixed(2)}s`);

        // If audio is longer than 2 hours (7200 seconds), split into chunks
        const shouldChunk = audioDuration > 3600;
        
        if (shouldChunk) {
            console.log("🔄 Audio is longer than 1 hour, splitting into chunks to avoid timeout...");
            
            const { chunk1Path, chunk2Path, chunk1Duration } = await splitAudioIntoChunks(tempFilePath, tempDir);
            
            console.log("🎤 Starting parallel transcription of both chunks...");
            
            // Transcribe both chunks in parallel
            const transcriptionPromises = [
                openai.audio.transcriptions.create({
                    file: createReadStream(chunk1Path),
                    model: "whisper-1",
                    response_format: "srt",
                }),
                openai.audio.transcriptions.create({
                    file: createReadStream(chunk2Path),
                    model: "whisper-1",
                    response_format: "srt",
                })
            ];
            
            const [chunk1Transcription, chunk2Transcription] = await Promise.all(transcriptionPromises);
            
            const chunk1Srt = chunk1Transcription as unknown as string;
            const chunk2Srt = chunk2Transcription as unknown as string;
            
            if (typeof chunk1Srt !== 'string' || chunk1Srt.trim() === '' ||
                typeof chunk2Srt !== 'string' || chunk2Srt.trim() === '') {
                console.error("OpenAI Whisper did not return valid SRT strings for chunks.");
                throw new Error('Failed to generate valid SRT data from audio chunks.');
            }
            
            console.log("🔤 Both chunk transcriptions completed. Combining SRT files...");
            
            // Combine the SRT files with proper time offsetting
            const combinedSrt = combineSrtFiles(chunk1Srt, chunk2Srt, chunk1Duration);
            
            console.log("☁️ Combined SRT created. Uploading to Supabase...");

            const srtFileName = 'subtitles_chunked_' + Date.now() + '.srt';
            const destinationPath = 'subtitles/' + srtFileName;
            
            // Convert string to buffer for upload
            const srtBuffer = Buffer.from(combinedSrt, 'utf-8');
            
            // Create temporary file for upload
            const tempSrtPath = path.join(tempDir, srtFileName);
            await fsPromises.writeFile(tempSrtPath, srtBuffer);

            const supabaseUrl = await uploadFileToSupabase(
                tempSrtPath,
                destinationPath,
                'text/srt'
            );

            if (!supabaseUrl) {
                throw new Error("Failed to upload combined SRT to Supabase.");
            }

            // Clean up chunk files
            await Promise.all([
                fsPromises.unlink(chunk1Path).catch(() => {}),
                fsPromises.unlink(chunk2Path).catch(() => {}),
                fsPromises.unlink(tempSrtPath).catch(() => {})
            ]);

            console.log("✅ Chunked subtitles generated and uploaded: " + supabaseUrl);
            return NextResponse.json({ 
                success: true,
                subtitlesUrl: supabaseUrl,
                message: "Subtitles generated successfully from chunked audio",
                chunked: true,
                totalDuration: audioDuration,
                chunkCount: 2
            });
            
        } else {
            console.log("📝 Audio duration is acceptable, processing as single file...");
            
            // Process as single file (original logic)
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
            
            console.log("🔤 Raw SRT generated. Reformatting...");
            const reformattedSrt = reformatSrtContent(rawSrt);
            console.log("☁️ SRT reformatted. Uploading to Supabase...");

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
                message: "Subtitles generated successfully",
                chunked: false,
                totalDuration: audioDuration
            });
        }

    } catch (error: any) {
        console.error("❌ Error generating subtitles: " + error.message + (error.stack ? " Stack: " + error.stack : ""));
        return NextResponse.json({ error: error.message || "Failed to generate subtitles" }, { status: 500 });
    } finally {
        try {
            // Clean up temporary directory
            await fsPromises.rm(tempDir, { recursive: true, force: true });
            console.log("🧹 Cleaned up temporary directory: " + tempDir);
        } catch (cleanupError: any) {
            console.warn("⚠️ Failed to clean up temporary directory " + tempDir + ": " + cleanupError.message);
        }
    }
} 