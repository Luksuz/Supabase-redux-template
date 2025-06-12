# YouTube API Setup

## Environment Variables

Add the following to your `.env.local` file:

```
YOUTUBE_API_KEY=your_youtube_api_key_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
```

## Getting a YouTube API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create credentials (API Key)
5. Copy the API key and add it to your `.env.local` file

## Setting up OAuth2 for Enhanced Features

To enable caption downloading and enhanced YouTube access:

### 1. Create OAuth2 Credentials

1. In the same Google Cloud Console project
2. Go to "Credentials" and click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the consent screen first if prompted
4. Choose "Web application" as the application type
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (for development)
   - `https://yourdomain.com/api/auth/callback/google` (for production)

### 2. Configure OAuth Consent Screen

1. Go to "OAuth consent screen" in Google Cloud Console
2. Choose "External" user type (unless you have a Google Workspace)
3. Fill in the required information:
   - App name: Your app name
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `../auth/youtube.readonly`
5. Add test users if in testing mode

### 3. Generate NextAuth Secret

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

## API Key Restrictions (Recommended)

For security, restrict your API key to:
- Application restrictions: HTTP referrers (web sites)
- API restrictions: YouTube Data API v3

## Features

### Basic Access (API Key Only)
- Search for videos by keywords
- Search within specific channels
- View available caption tracks
- Get video metadata (title, description, publish date, etc.)

### Enhanced Access (OAuth2 Required)
- Download caption content in SRT format
- Access private/unlisted videos (if you have permission)
- Higher rate limits
- Full YouTube API access

## Usage

1. **Basic Search**: Works without authentication using API key
2. **Sign In**: Click "Sign in for Enhanced Features" to authenticate with Google
3. **Download Captions**: When authenticated, use "Download Captions" button to get SRT files
4. **View Captions**: Click "View Captions" to see available tracks and preview content

## Troubleshooting

### "Access blocked" error
- Make sure your OAuth consent screen is properly configured
- Add your domain to authorized redirect URIs
- Verify the YouTube API is enabled

### "Invalid client" error
- Check that your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
- Ensure the redirect URI matches exactly

### Rate limiting
- The API has quotas; authenticated requests have higher limits
- Consider implementing caching for frequently accessed data

Note: Caption content download requires OAuth2 authentication, which is not implemented in this basic version. The tool shows available caption tracks only. 