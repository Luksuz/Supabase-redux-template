from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import os
import tempfile
import json
from urllib.parse import urlparse, parse_qs

app = Flask(__name__)

# Enable CORS for all routes
CORS(app, origins=[
    "http://localhost:3000",  # Next.js development server
    "http://127.0.0.1:3000",
    "https://localhost:3000", 
    "https://127.0.0.1:3000",
    # Add production domains here if needed
])

def extract_video_id(url):
    """Extract video ID from various YouTube URL formats"""
    try:
        parsed = urlparse(url)
        if parsed.hostname in ['youtu.be']:
            return parsed.path[1:]
        elif parsed.hostname in ['www.youtube.com', 'youtube.com', 'm.youtube.com']:
            if parsed.path == '/watch':
                return parse_qs(parsed.query)['v'][0]
            elif parsed.path.startswith('/embed/'):
                return parsed.path.split('/')[2]
            elif parsed.path.startswith('/v/'):
                return parsed.path.split('/')[2]
        return None
    except:
        return None

def convert_vtt_to_srt(vtt_content):
    """Convert VTT content to SRT format"""
    lines = vtt_content.split('\n')
    srt_lines = []
    subtitle_counter = 1
    current_subtitle = {}
    
    for line in lines:
        line = line.strip()
        
        # Skip VTT header and empty lines at the start
        if line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:'):
            continue
            
        # Check if line contains timestamp
        if '-->' in line:
            # Convert VTT timestamp format to SRT format
            timestamp_line = line.replace('.', ',')
            # Remove any additional VTT formatting
            timestamp_line = timestamp_line.split(' ')[0] + ' --> ' + timestamp_line.split(' ')[2]
            current_subtitle['timestamp'] = timestamp_line
        elif line and 'timestamp' in current_subtitle and 'text' not in current_subtitle:
            # This is the subtitle text
            # Remove VTT tags like <c>, </c>, etc.
            clean_text = line
            for tag in ['<c>', '</c>', '<c.colorCCCCCC>', '<c.colorE5E5E5>']:
                clean_text = clean_text.replace(tag, '')
            current_subtitle['text'] = clean_text
            
            # Add complete subtitle to SRT
            srt_lines.append(str(subtitle_counter))
            srt_lines.append(current_subtitle['timestamp'])
            srt_lines.append(current_subtitle['text'])
            srt_lines.append('')  # Empty line
            
            subtitle_counter += 1
            current_subtitle = {}
    
    return '\n'.join(srt_lines)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'captions-server',
        'version': '1.0.0'
    })

@app.route('/extract-subtitles', methods=['POST'])
def extract_subtitles():
    """Extract subtitles from YouTube video using yt-dlp"""
    try:
        data = request.get_json()
        
        if not data or 'videoId' not in data:
            return jsonify({
                'success': False,
                'error': 'videoId is required'
            }), 400
        
        video_id = data['videoId']
        language = data.get('language', 'en')
        
        # Construct YouTube URL
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        
        print(f"🎬 Extracting subtitles for video: {video_id}")
        print(f"🌐 Language: {language}")
        
        # Create temporary directory for subtitle files
        with tempfile.TemporaryDirectory() as temp_dir:
            # yt-dlp options
            ydl_opts = {
                'writeautomaticsub': True,
                'writesubtitles': True,
                'skip_download': True,
                'subtitleslangs': [language],
                'subtitlesformat': 'vtt',  # Get VTT first, then convert to SRT
                'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
                'quiet': True,  # Reduce output noise
                'no_warnings': True,
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # Extract video info
                    info = ydl.extract_info(video_url, download=False)
                    video_title = info.get('title', f'Video {video_id}')
                    
                    print(f"📺 Video title: {video_title}")
                    
                    # Check if subtitles are available
                    subtitles = info.get('subtitles', {})
                    automatic_captions = info.get('automatic_captions', {})
                    
                    if language not in subtitles and language not in automatic_captions:
                        return jsonify({
                            'success': False,
                            'error': f'No subtitles available in language: {language}',
                            'availableLanguages': list(subtitles.keys()) + list(automatic_captions.keys())
                        }), 404
                    
                    # Download subtitles
                    ydl.download([video_url])
                    
                    # Find the downloaded subtitle file
                    subtitle_file = None
                    for file in os.listdir(temp_dir):
                        if file.endswith(f'.{language}.vtt'):
                            subtitle_file = os.path.join(temp_dir, file)
                            break
                    
                    if not subtitle_file or not os.path.exists(subtitle_file):
                        return jsonify({
                            'success': False,
                            'error': 'Subtitle file not found after download'
                        }), 500
                    
                    # Read and convert VTT to SRT
                    with open(subtitle_file, 'r', encoding='utf-8') as f:
                        vtt_content = f.read()
                    
                    srt_content = convert_vtt_to_srt(vtt_content)
                    
                    if not srt_content.strip():
                        return jsonify({
                            'success': False,
                            'error': 'Empty subtitle content after conversion'
                        }), 500
                    
                    print(f"✅ Successfully extracted subtitles for {video_id}")
                    print(f"📝 SRT content length: {len(srt_content)} characters")
                    
                    return jsonify({
                        'success': True,
                        'videoId': video_id,
                        'videoTitle': video_title,
                        'language': language,
                        'srtContent': srt_content,
                        'size': len(srt_content.encode('utf-8')),
                        'method': 'yt-dlp'
                    })
                    
            except yt_dlp.DownloadError as e:
                error_msg = str(e)
                print(f"❌ yt-dlp download error: {error_msg}")
                
                # Check if it's a subtitle-specific error
                if 'subtitle' in error_msg.lower() or 'caption' in error_msg.lower():
                    return jsonify({
                        'success': False,
                        'error': f'No subtitles available for this video: {error_msg}',
                        'fallbackRecommended': True
                    }), 404
                else:
                    return jsonify({
                        'success': False,
                        'error': f'Failed to download video info: {error_msg}',
                        'fallbackRecommended': True
                    }), 500
                    
            except Exception as e:
                print(f"❌ Unexpected error during subtitle extraction: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': f'Unexpected error: {str(e)}',
                    'fallbackRecommended': True
                }), 500
        
    except Exception as e:
        print(f"❌ Server error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}',
            'fallbackRecommended': True
        }), 500

@app.route('/extract-multiple', methods=['POST'])
def extract_multiple_subtitles():
    """Extract subtitles for multiple videos"""
    try:
        data = request.get_json()
        
        if not data or 'videoIds' not in data:
            return jsonify({
                'success': False,
                'error': 'videoIds array is required'
            }), 400
        
        video_ids = data['videoIds']
        language = data.get('language', 'en')
        
        if not isinstance(video_ids, list):
            return jsonify({
                'success': False,
                'error': 'videoIds must be an array'
            }), 400
        
        results = []
        
        for video_id in video_ids:
            try:
                # Make internal request to single extraction endpoint
                single_result = extract_subtitles_internal(video_id, language)
                results.append(single_result)
            except Exception as e:
                print(f"❌ Error processing video {video_id}: {str(e)}")
                results.append({
                    'success': False,
                    'videoId': video_id,
                    'error': str(e),
                    'fallbackRecommended': True
                })
        
        # Count successful extractions
        successful = sum(1 for r in results if r.get('success', False))
        
        return jsonify({
            'success': True,
            'totalVideos': len(video_ids),
            'successful': successful,
            'failed': len(video_ids) - successful,
            'results': results
        })
        
    except Exception as e:
        print(f"❌ Server error in batch processing: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

def extract_subtitles_internal(video_id, language='en'):
    """Internal function to extract subtitles for a single video"""
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
    with tempfile.TemporaryDirectory() as temp_dir:
        ydl_opts = {
            'writeautomaticsub': True,
            'writesubtitles': True,
            'skip_download': True,
            'subtitleslangs': [language],
            'subtitlesformat': 'vtt',
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            video_title = info.get('title', f'Video {video_id}')
            
            subtitles = info.get('subtitles', {})
            automatic_captions = info.get('automatic_captions', {})
            
            if language not in subtitles and language not in automatic_captions:
                raise Exception(f'No subtitles available in language: {language}')
            
            ydl.download([video_url])
            
            subtitle_file = None
            for file in os.listdir(temp_dir):
                if file.endswith(f'.{language}.vtt'):
                    subtitle_file = os.path.join(temp_dir, file)
                    break
            
            if not subtitle_file or not os.path.exists(subtitle_file):
                raise Exception('Subtitle file not found after download')
            
            with open(subtitle_file, 'r', encoding='utf-8') as f:
                vtt_content = f.read()
            
            srt_content = convert_vtt_to_srt(vtt_content)
            
            if not srt_content.strip():
                raise Exception('Empty subtitle content after conversion')
            
            return {
                'success': True,
                'videoId': video_id,
                'videoTitle': video_title,
                'language': language,
                'srtContent': srt_content,
                'size': len(srt_content.encode('utf-8')),
                'method': 'yt-dlp'
            }

if __name__ == '__main__':
    print("🚀 Starting Captions Server...")
    print("📡 Available endpoints:")
    print("  - GET  /health")
    print("  - POST /extract-subtitles")
    print("  - POST /extract-multiple")
    print("🌐 CORS enabled for localhost:3000")
    
    app.run(host='0.0.0.0', port=3001, debug=True) 