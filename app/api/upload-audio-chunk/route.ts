import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Get the user from the authenticated session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { audioData, chunkId, projectName } = await request.json()

    if (!audioData || !chunkId) {
      return NextResponse.json({
        success: false,
        error: 'Audio data and chunk ID are required'
      }, { status: 400 })
    }

    // Convert base64 audio data to buffer
    let audioBuffer: Buffer
    if (audioData.startsWith('data:audio')) {
      // Handle data URL format
      const base64Data = audioData.split(',')[1]
      audioBuffer = Buffer.from(base64Data, 'base64')
    } else {
      // Handle plain base64
      audioBuffer = Buffer.from(audioData, 'base64')
    }

    // Create storage file name with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedProjectName = projectName?.replace(/[^a-zA-Z0-9-_]/g, '_') || 'audio'
    const storageFileName = `audio-chunks/${user.id}/${sanitizedProjectName}_${chunkId}_${timestamp}.mp3`
    
    console.log(`📤 Uploading audio chunk to Supabase storage: ${storageFileName}`)

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(storageFileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`Failed to upload to storage: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(storageFileName)

    const publicUrl = urlData.publicUrl
    console.log(`✅ Audio chunk uploaded successfully: ${publicUrl}`)

    return NextResponse.json({
      success: true,
      audioUrl: publicUrl,
      storageFileName: storageFileName,
      audioSize: audioBuffer.length
    })

  } catch (error) {
    console.error('Audio chunk upload error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload audio chunk'
    }, { status: 500 })
  }
}