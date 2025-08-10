import { NextRequest, NextResponse } from 'next/server';
import { getStoryblocksSearchUrl, isStoryblocksConfigured } from '@/lib/storyblocks-utils';

export async function POST(request: NextRequest) {
  if (!isStoryblocksConfigured()) {
    return NextResponse.json({ error: 'Storyblocks API not configured.' }, { status: 500 });
  }

  try {
    const { keywords, ...otherParams } = await request.json();

    if (!keywords) {
      return NextResponse.json({ error: 'Keywords are required for music search.' }, { status: 400 });
    }
    
    const searchParams = {
        keywords,
        content_type: 'music',
        results_per_page: '20',
        ...otherParams,
    };
    
    const url = getStoryblocksSearchUrl(searchParams);

    const storyblocksResponse = await fetch(url);

    console.log('Storyblocks response:', storyblocksResponse)
    if (!storyblocksResponse.ok) {
        const errorText = await storyblocksResponse.text();
        console.error('Storyblocks API error:', errorText);
        throw new Error(`Storyblocks search failed: ${storyblocksResponse.statusText}`);
    }

    const data = await storyblocksResponse.json();

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in music search route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
