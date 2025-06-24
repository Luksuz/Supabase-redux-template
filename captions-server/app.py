#!/usr/bin/env python3
"""
YouTube Captions Server
A Flask API server for retrieving YouTube video captions/transcripts.
"""

import os
import re
import logging
from typing import Dict, List, Optional, Any

from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled, 
    NoTranscriptFound, 
    VideoUnavailable,
    YouTubeRequestFailed
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def extract_video_id(url_or_id: str) -> Optional[str]:
    """
    Extract YouTube video ID from various URL formats or return the ID if already provided.
    
    Args:
        url_or_id: YouTube URL or video ID
        
    Returns:
        Video ID or None if invalid
    """
    # If it looks like a video ID already (11 characters, alphanumeric + - and _)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    
    # Extract from various YouTube URL formats
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/v/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    
    return None

def convert_to_srt_format(transcript_data: List[Dict]) -> str:
    """
    Convert transcript data to SRT format.
    
    Args:
        transcript_data: Raw transcript data from YouTube API
        
    Returns:
        SRT formatted string
    """
    srt_content = ""
    
    for i, entry in enumerate(transcript_data, 1):
        start_time = entry['start']
        duration = entry['duration']
        end_time = start_time + duration
        text = entry['text']
        
        # Convert seconds to SRT time format (HH:MM:SS,mmm)
        def seconds_to_srt_time(seconds):
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millisecs = int((seconds % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"
        
        start_srt = seconds_to_srt_time(start_time)
        end_srt = seconds_to_srt_time(end_time)
        
        srt_content += f"{i}\n{start_srt} --> {end_srt}\n{text}\n\n"
    
    return srt_content.strip()

@app.route('/extract-multiple', methods=['POST'])
def extract_multiple():
    """
    Extract captions for multiple YouTube videos.
    
    Request body (JSON):
    {
        "videoIds": ["video_id1", "video_id2", ...],
        "language": "en"
    }
    
    Response:
    {
        "success": true,
        "results": [
            {
                "videoId": "video_id1",
                "success": true,
                "srtContent": "SRT content here",
                "videoTitle": "Video Title"
            },
            {
                "videoId": "video_id2", 
                "success": false,
                "error": "No transcript found"
            }
        ]
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        video_ids = data.get('videoIds', [])
        language = data.get('language', 'en')
        
        if not video_ids:
            return jsonify({
                'success': False,
                'error': 'videoIds array is required'
            }), 400
        
        logger.info(f"Processing {len(video_ids)} videos for language: {language}")
        
        results = []
        
        for video_id in video_ids:
            try:
                # Extract video ID if URL is provided
                extracted_id = extract_video_id(video_id)
                if not extracted_id:
                    logger.warning(f"Invalid video ID or URL: {video_id}")
                    results.append({
                        'videoId': video_id,
                        'success': False,
                        'error': 'Invalid video ID or URL'
                    })
                    continue
                
                logger.info(f"Fetching captions for video: {extracted_id}")
                
                # Fetch transcript using static method with proxy support
                transcript = YouTubeTranscriptApi.get_transcript(
                    extracted_id, 
                    languages=[language],
                    proxies={"http": "http://otknvhqu:1xy56rpgg2in@198.23.239.134:6540", 
                            "https": "http://otknvhqu:1xy56rpgg2in@198.23.239.134:6540"}
                )
                
                # Convert to SRT format
                srt_content = convert_to_srt_format(transcript)
                
                # Get video title (we'll use video ID as fallback since we don't have title from transcript API)
                video_title = f"Video {extracted_id}"
                
                # Create successful result
                results.append({
                    'videoId': extracted_id,
                    'success': True,
                    'srtContent': srt_content,
                    'videoTitle': video_title
                })
                
                logger.info(f"Successfully extracted captions for {extracted_id}")
                
            except TranscriptsDisabled:
                logger.warning(f"Transcripts disabled for video: {video_id}")
                results.append({
                    'videoId': video_id,
                    'success': False,
                    'error': 'Transcripts are disabled for this video'
                })
            except NoTranscriptFound:
                logger.warning(f"No transcript found for video: {video_id} in language: {language}")
                results.append({
                    'videoId': video_id,
                    'success': False,
                    'error': f'No transcript found in language: {language}'
                })
            except VideoUnavailable:
                logger.warning(f"Video unavailable: {video_id}")
                results.append({
                    'videoId': video_id,
                    'success': False,
                    'error': 'Video is unavailable'
                })
            except YouTubeRequestFailed as e:
                logger.error(f"YouTube request failed for video {video_id}: {str(e)}")
                results.append({
                    'videoId': video_id,
                    'success': False,
                    'error': f'YouTube request failed: {str(e)}'
                })
            except Exception as e:
                logger.error(f"Unexpected error processing video {video_id}: {str(e)}")
                results.append({
                    'videoId': video_id,
                    'success': False,
                    'error': f'Unexpected error: {str(e)}'
                })
        
        # Count successful and failed results
        successful_count = sum(1 for result in results if result['success'])
        failed_count = len(results) - successful_count
        
        # Return response matching the expected format
        response = {
            'success': True,
            'results': results
        }
        
        logger.info(f"Completed processing: {successful_count} successful, {failed_count} failed")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))  # Changed default port to 3001 to match your request
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting YouTube Captions Server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug) 