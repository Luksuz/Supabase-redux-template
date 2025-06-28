import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const API_KEY = process.env.STORYBLOCKS_PUBLIC_API_KEY;
const PRIVATE_KEY = process.env.STORYBLOCKS_PRIVATE_API_KEY;
const PROJECT_ID = process.env.STORYBLOCKS_PROJECT_ID || 'test_project';
const USER_ID = process.env.STORYBLOCKS_USER_ID || 'test_user';

function getStoryblocksUrl(resource: string, searchParams: Record<string, string>) {
  const expires = Math.floor(Date.now() / 1000) + 3600; // Expires in 1 hour

  if (!PRIVATE_KEY) {
      throw new Error('STORYBLOCKS_PRIVATE_API_KEY is not set');
  }

  const hmac = crypto.createHmac('sha256', PRIVATE_KEY + expires);
  hmac.update(resource);
  const signature = hmac.digest('hex');

  const allParams = {
    APIKEY: API_KEY,
    EXPIRES: expires.toString(),
    HMAC: signature,
    project_id: PROJECT_ID,
    user_id: USER_ID,
    ...searchParams
  };

  const queryString = Object.entries(allParams)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join('&');

  return `https://api.storyblocks.com${resource}?${queryString}`;
}

async function makeApiRequest(url: string) {
    try {
        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Storyblocks API error:', response.status, errorData);
            throw new Error(`Storyblocks API request failed with status ${response.status}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error making Storyblocks API request:', error);
        throw error;
    }
}

function formatStoryblocksImages(data: any) {
    if (!data.results || data.results.length === 0) return [];
    return data.results.map((image: any) => ({
        id: image.id,
        url: image.preview_url,
        thumbnail: image.thumbnail_url,
        source: 'storyblocks',
        photographer: image.title, // No photographer field, using title
        type: 'image',
    }));
}

function formatStoryblocksVideos(data: any) {
    if (!data.results || data.results.length === 0) return [];
    return data.results.map((video: any) => ({
        id: video.id,
        url: video.preview_urls?._720p || video.preview_urls?._480p || video.preview_urls?._360p,
        thumbnail: video.thumbnail_url,
        source: 'storyblocks',
        photographer: video.title, // No photographer field, using title
        type: 'video',
    }));
}

export async function POST(request: NextRequest) {
    if (!API_KEY || !PRIVATE_KEY) {
        return NextResponse.json({ error: 'Storyblocks API keys are not configured.' }, { status: 500 });
    }

    try {
        const { query, type = 'image' } = await request.json();
        if (!query) {
            return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
        }

        let resource: string;
        let params: Record<string, string>;

        if (type === 'video') {
            resource = '/api/v2/videos/search';
            params = {
                keywords: query,
                results_per_page: '9',
            };
        } else {
            resource = '/api/v2/images/search';
            params = {
                keywords: query,
                results_per_page: '9',
            };
        }
        
        const url = getStoryblocksUrl(resource, params);
        const data = await makeApiRequest(url);

        const results = type === 'video' ? formatStoryblocksVideos(data) : formatStoryblocksImages(data);

        if (results.length === 0) {
            return NextResponse.json({ results: [], message: `No ${type}s found on Storyblocks.` });
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
} 