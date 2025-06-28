const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const API_KEY = process.env.STORYBLOCKS_PUBLIC_API_KEY;
const PRIVATE_KEY = process.env.STORYBLOCKS_PRIVATE_API_KEY;
const PROJECT_ID = process.env.STORYBLOCKS_PROJECT_ID || 'test_project';
const USER_ID = process.env.STORYBLOCKS_USER_ID || 'test_user';

if (!API_KEY || !PRIVATE_KEY) {
  throw new Error('Storyblocks API keys are not configured.');
}

function getStoryblocksUrl(resource, searchParams) {
  const expires = Math.floor(Date.now() / 1000) + 3600; // Expires in 1 hour

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
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `https://api.storyblocks.com${resource}?${queryString}`;
}

// Image Search
const imageResource = '/api/v2/images/search';
const imageParams = {
  keywords: 'nature', // example search
  results_per_page: '5'
};
const imageUrl = getStoryblocksUrl(imageResource, imageParams);

const requestOptions = {
  method: 'GET',
  redirect: 'follow'
};

console.log('Fetching images...');
fetch(imageUrl, requestOptions)
  .then(response => response.text())
  .then(result => console.log('Image search results:', result))
  .catch(error => console.log('error', error));

// Video Search
const videoResource = '/api/v2/videos/search';
const videoParams = {
  keywords: 'ocean', // example search
  results_per_page: '5'
};
const videoUrl = getStoryblocksUrl(videoResource, videoParams);

console.log('\nFetching videos...');
fetch(videoUrl, requestOptions)
  .then(response => response.text())
  .then(result => console.log('Video search results:', result))
  .catch(error => console.log('error', error));


// video response
// {
//   "total_results": 1,
//   "results": [
//     {
//       "id": 11851,
//       "title": "Slow Motion Falling Money",
//       "type": "footage",
//       "contentClass": "video",
//       "is_new": false,
//       "thumbnail_url": "https://d2v9y0dukr6mq2.cloudfront.net/video/thumbnail/slow-motion-falling-money_-jjatxweb__S0000.jpg",
//       "preview_urls": {
//         "_180p": "https://d2v9y0dukr6mq2.cloudfront.net/video...",
//         "_360p": "https://d2v9y0dukr6mq2.cloudfront.net/video...",
//         "_480p": "https://d2v9y0dukr6mq2.cloudfront.net/video...",
//         "_720p": "https://d2v9y0dukr6mq2.cloudfront.net/video..."
//       },
//       "duration": 21,
//       "durationMs": 20670
//     }
//   ]
// }







// image response
// {
//   "total_results": 1,
//   "results": [
//     {
//       "id": 800953,
//       "title": "Deep space background with nebulae",
//       "type": "photo",
//       "contentClass": "image",
//       "is_new": false,
//       "thumbnail_url": "https://d1yn1kh78jj1rr.cloudfront.net/image/thumbnail/rDtN98Qoishumwih/deep-space-background-with-nebulae_r7NpVyflR_thumb.jpg",
//       "preview_url": "https://d1yn1kh78jj1rr.cloudfront.net/image/preview/..."
//     }
//   ]
// }