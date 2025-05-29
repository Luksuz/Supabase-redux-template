import { NextRequest, NextResponse } from 'next/server'
import { getApiKeyStatistics } from '@/lib/wellsaid-utils'

export async function GET(request: NextRequest) {
  try {
    console.log(`📊 Fetching API key statistics`)

    const result = await getApiKeyStatistics()

    if (result.success) {
      console.log(`✅ API key statistics retrieved successfully`)
      return NextResponse.json({
        success: true,
        validCount: result.validCount,
        invalidCount: result.invalidCount,
        totalCount: result.totalCount,
        usageLimitReached: result.usageLimitReached,
        averageUsage: result.averageUsage,
        message: `Found ${result.validCount} valid API keys out of ${result.totalCount} total`
      })
    } else {
      console.error(`❌ Failed to get API key statistics: ${result.error}`)
      return NextResponse.json(
        { error: result.error || 'Failed to get API key statistics' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error in API key statistics:', error)
    return NextResponse.json(
      { error: 'Internal server error during API key statistics retrieval' },
      { status: 500 }
    )
  }
} 