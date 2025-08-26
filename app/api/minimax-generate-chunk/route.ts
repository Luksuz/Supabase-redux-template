import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export const runtime = 'nodejs'

interface RequestBody {
  text: string
  voice: string
  model?: string
  chunkIndex: number
  sessionId: string
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice, model = 'speech-02-hd', chunkIndex, sessionId } = (await request.json()) as RequestBody

    if (!text || !voice || typeof chunkIndex !== 'number' || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: text, voice, chunkIndex, sessionId' },
        { status: 400 }
      )
    }

    // Call MiniMax API
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID
    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY

    if (!MINIMAX_GROUP_ID || !MINIMAX_API_KEY) {
      return NextResponse.json(
        { error: 'MiniMax credentials are not configured' },
        { status: 500 }
      )
    }

    const mmResp = await fetch(`https://api.minimaxi.chat/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        text,
        stream: false,
        subtitle_enable: false,
        voice_setting: { voice_id: voice, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      }),
    })

    if (!mmResp.ok) {
      const body = await mmResp.text().catch(() => '')
      return NextResponse.json(
        { error: `MiniMax API error: ${mmResp.status} ${mmResp.statusText}. ${body}` },
        { status: 500 }
      )
    }

    const mmData = await mmResp.json()
    const hexString: string | undefined = mmData?.data?.audio
    if (!hexString) {
      return NextResponse.json(
        { error: 'MiniMax did not return audio data' },
        { status: 500 }
      )
    }

    // Convert hex to buffer
    const bytes = new Uint8Array(hexString.length / 2)
    for (let i = 0; i < hexString.length; i += 2) {
      bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
    }

    const buffer = Buffer.from(bytes)

    // Persist to temp session folder
    const tempDir = path.join(os.tmpdir(), 'wellsaid-audio', sessionId)
    await fs.mkdir(tempDir, { recursive: true })
    const fileName = `chunk_${String(chunkIndex).padStart(4, '0')}.mp3`
    const filePath = path.join(tempDir, fileName)
    await fs.writeFile(filePath, buffer)

    return NextResponse.json({
      success: true,
      localFilePath: filePath,
      chunkIndex,
      bytes: buffer.length,
    })
  } catch (error: any) {
    console.error('❌ MiniMax chunk generation error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to generate MiniMax audio chunk' },
      { status: 500 }
    )
  }
}




