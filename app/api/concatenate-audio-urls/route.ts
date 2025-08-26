import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

export const runtime = 'nodejs'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { audioDataUrls } = await request.json()

    if (!audioDataUrls || !Array.isArray(audioDataUrls) || audioDataUrls.length === 0) {
      return NextResponse.json({ error: 'audioDataUrls array is required' }, { status: 400 })
    }

    // Create temp dir
    const tempDir = path.join(os.tmpdir(), 'concat-dataurls', `session-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    try {
      // Write each data URL to a temp mp3 file
      const filePaths: string[] = []
      for (let i = 0; i < audioDataUrls.length; i++) {
        const url = audioDataUrls[i]
        const match = typeof url === 'string' ? url.match(/^data:audio\/mp3;base64,(.+)$/) : null
        if (!match) {
          return NextResponse.json({ error: `Invalid data URL at index ${i}` }, { status: 400 })
        }
        const base64Data = match[1]
        const buffer = Buffer.from(base64Data, 'base64')
        const filePath = path.join(tempDir, `part_${String(i).padStart(3, '0')}.mp3`)
        await fs.writeFile(filePath, buffer)
        filePaths.push(filePath)
      }

      // Build concat file
      const concatFile = path.join(tempDir, 'concat.txt')
      const concatContent = filePaths.map(fp => `file '${fp}'`).join('\n')
      await fs.writeFile(concatFile, concatContent)

      // Concatenate
      const outputPath = path.join(tempDir, 'output.mp3')
      const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy "${outputPath}"`
      await execAsync(ffmpegCmd)

      // Read output and return as data URL
      const outBuf = await fs.readFile(outputPath)
      const dataUrl = `data:audio/mp3;base64,${outBuf.toString('base64')}`

      return NextResponse.json({ success: true, audioUrl: dataUrl })
    } finally {
      // Cleanup
      try {
        const files = await fs.readdir(tempDir)
        for (const f of files) {
          try { await fs.unlink(path.join(tempDir, f)) } catch {}
        }
        try { await fs.rmdir(tempDir) } catch {}
      } catch {}
    }
  } catch (error: any) {
    console.error('❌ concatenate-audio-urls error:', error)
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 })
  }
}




