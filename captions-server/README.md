# YouTube Captions Server

A Flask-based API server for retrieving YouTube video captions/transcripts using the YouTube Transcript API.

## Features

- 🎯 **Extract captions from any YouTube video** with available transcripts
- 🌍 **Multi-language support** with automatic language detection
- 🔄 **Translation capabilities** using YouTube's built-in translation
- 📄 **Multiple output formats**: JSON, SRT, WebVTT, and plain text
- 🚀 **RESTful API** with comprehensive error handling
- 🔍 **Flexible input** - accepts YouTube URLs or video IDs
- 📋 **List available transcripts** for any video

## Installation

1. **Clone or create the project directory:**
```bash
mkdir captions-server
cd captions-server
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Run the server:**
```bash
python app.py
```

The server will start on `http://localhost:5000` by default.

## API Endpoints

### 1. Health Check
```
GET /
GET /health
```
Returns server status and available endpoints.

### 2. Simple Caption Retrieval
```
GET /captions/<video_id>
```

**Parameters:**
- `video_id`: YouTube video ID or full URL
- `languages` (query): Comma-separated language codes (default: 'en')
- `format` (query): Output format - 'json', 'srt', 'vtt', 'txt' (default: 'json')
- `translate` (query): Language code to translate to

**Example:**
```bash
# Get English captions as JSON
curl "http://localhost:5000/captions/dQw4w9WgXcQ"

# Get Spanish captions as SRT
curl "http://localhost:5000/captions/dQw4w9WgXcQ?languages=es&format=srt"

# Get captions and translate to German
curl "http://localhost:5000/captions/dQw4w9WgXcQ?translate=de"
```

### 3. Advanced Caption Retrieval
```
POST /captions
```

**Request Body (JSON):**
```json
{
  "video_id": "dQw4w9WgXcQ",
  "languages": ["en", "es"],
  "format": "json",
  "translate": "de",
  "preserve_formatting": true
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/captions \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "dQw4w9WgXcQ",
    "languages": ["en"],
    "format": "srt",
    "preserve_formatting": true
  }'
```

### 4. List Available Transcripts
```
GET /list/<video_id>
```

Lists all available transcripts for a video, including language information and translation capabilities.

**Example:**
```bash
curl "http://localhost:5000/list/dQw4w9WgXcQ"
```

## Response Formats

### JSON Response (default)
```json
{
  "video_id": "dQw4w9WgXcQ",
  "language": "English",
  "language_code": "en",
  "is_generated": false,
  "captions": [
    {
      "text": "We're no strangers to love",
      "start": 0.0,
      "duration": 3.5
    }
  ],
  "total_snippets": 42
}
```

### SRT Format
```
1
00:00:00,000 --> 00:00:03,500
We're no strangers to love

2
00:00:03,500 --> 00:00:07,000
You know the rules and so do I
```

### WebVTT Format
```
WEBVTT

00:00:00.000 --> 00:00:03.500
We're no strangers to love

00:00:03.500 --> 00:00:07.000
You know the rules and so do I
```

### Plain Text Format
```
We're no strangers to love
You know the rules and so do I
```

## Supported Input Formats

The server accepts various YouTube URL formats:

- `dQw4w9WgXcQ` (video ID)
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`
- `https://www.youtube.com/embed/dQw4w9WgXcQ`

## Language Codes

Common language codes:
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `ja` - Japanese
- `ko` - Korean
- `zh` - Chinese

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400` - Bad Request (invalid video ID/URL)
- `404` - Not Found (no transcripts available, video unavailable)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

Example error response:
```json
{
  "error": "No transcript found in languages: ['en']"
}
```

## Environment Variables

- `PORT` - Server port (default: 5000)
- `DEBUG` - Enable debug mode (default: False)

## Production Deployment

For production deployment, use a WSGI server like Gunicorn:

```bash
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

## Docker Deployment

Create a `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app.py .
EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

Build and run:
```bash
docker build -t captions-server .
docker run -p 5000:5000 captions-server
```

## Rate Limiting & IP Blocks

YouTube may block requests from cloud providers or after too many requests. If you encounter issues:

1. **Use residential proxies** (as mentioned in the YouTube Transcript API docs)
2. **Implement request throttling**
3. **Add retry logic with exponential backoff**

## Integration Examples

### JavaScript/Node.js
```javascript
// Get captions
const response = await fetch('http://localhost:5000/captions/dQw4w9WgXcQ');
const data = await response.json();
console.log(data.captions);

// Advanced request
const advancedResponse = await fetch('http://localhost:5000/captions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    video_id: 'dQw4w9WgXcQ',
    languages: ['en'],
    format: 'srt'
  })
});
```

### Python
```python
import requests

# Simple request
response = requests.get('http://localhost:5000/captions/dQw4w9WgXcQ')
data = response.json()

# Advanced request
response = requests.post('http://localhost:5000/captions', json={
    'video_id': 'dQw4w9WgXcQ',
    'languages': ['en'],
    'translate': 'es'
})
```

### cURL
```bash
# Get captions as SRT file
curl "http://localhost:5000/captions/dQw4w9WgXcQ?format=srt" -o captions.srt

# List available transcripts
curl "http://localhost:5000/list/dQw4w9WgXcQ" | jq .
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built using the excellent [YouTube Transcript API](https://github.com/jdepoix/youtube-transcript-api)
- Flask web framework
- All contributors to the open source libraries used 