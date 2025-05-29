import { NextRequest, NextResponse } from 'next/server'
import { uploadApiKeysToDatabase } from '@/lib/wellsaid-utils'

export async function POST(request: NextRequest) {
  try {
    const { apiKeysText, userId = 'unknown_user' } = await request.json()

    if (!apiKeysText || typeof apiKeysText !== 'string') {
      return NextResponse.json(
        { error: 'API keys text is required' },
        { status: 400 }
      )
    }

    console.log(`🔑 Uploading API keys for user: ${userId}`)

    const result = await uploadApiKeysToDatabase(apiKeysText, userId)

    if (result.success) {
      console.log(`✅ Successfully uploaded ${result.count} API keys`)
      return NextResponse.json({
        success: true,
        count: result.count,
        message: `Successfully uploaded ${result.count} API keys`
      })
    } else {
      console.error(`❌ Failed to upload API keys: ${result.error}`)
      return NextResponse.json(
        { error: result.error || 'Failed to upload API keys' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error in API keys upload:', error)
    return NextResponse.json(
      { error: 'Internal server error during API keys upload' },
      { status: 500 }
    )
  }
} 