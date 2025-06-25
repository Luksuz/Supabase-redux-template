#!/usr/bin/env python3
"""
YouTube Captions Server
A Flask API server for retrieving YouTube video captions/transcripts.
"""

import os
import re
import logging
import random
import requests
from typing import Dict, List, Optional, Any, Tuple

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

# Webshare.io API configuration
WEBSHARE_API_TOKEN = "zo1xnhylf67y6pg94bhvz951wgcc27l55hh6j14n"
WEBSHARE_API_URL = "https://proxy.webshare.io/api/v2/proxy/list/"

# Available proxies from webshare.io (fallback list)
PROXY_LIST = [
    {
        'address': '198.23.239.134',
        'port': 6540,
        'username': 'otknvhqu',
        'password': '1xy56rpgg2in'
    },
    {
        'address': '207.244.217.165',
        'port': 6712,
        'username': 'otknvhqu',
        'password': '1xy56rpgg2in'
    },
    {
        'address': '107.172.163.27',
        'port': 6543,
        'username': 'otknvhqu',
        'password': '1xy56rpgg2in'
    },
    {
        'address': '23.94.138.75',
        'port': 6349,
        'username': 'otknvhqu',
        'password': '1xy56rpgg2in'
    },
    {
        'address': '216.10.27.159',
        'port': 6837,
        'username': 'otknvhqu',
        'password': '1xy56rpgg2in'
    },
    {
        'address': '136.0.207.84',
        'port': 6661,
        'username': 'otknvhqu',
        'password': '1xy56rpgg2in'
    },
    {
        'address': '64.64.118.149',
        'port': 6732,
        'username': 'otknvhqu',
        'password': '1xy56rpgg2in'
    }
]

def fetch_fresh_proxies() -> List[Dict[str, Any]]:
    """
    Fetch fresh proxy list from webshare.io API.
    
    Returns:
        List of proxy configurations or empty list if API call fails
    """
    try:
        headers = {
            'Authorization': f'Token {WEBSHARE_API_TOKEN}'
        }
        
        params = {
            'mode': 'direct',
            'page': '1',
            'page_size': '25'
        }
        
        response = requests.get(WEBSHARE_API_URL, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        fresh_proxies = []
        
        for proxy in data.get('results', []):
            if proxy.get('valid', False):  # Only use valid proxies
                fresh_proxies.append({
                    'address': proxy['proxy_address'],
                    'port': proxy['port'],
                    'username': proxy['username'],
                    'password': proxy['password']
                })
        
        logger.info(f"Fetched {len(fresh_proxies)} fresh proxies from webshare.io API")
        return fresh_proxies
        
    except Exception as e:
        logger.warning(f"Failed to fetch fresh proxies from API: {str(e)}")
        return []

def get_proxy_list() -> List[Dict[str, Any]]:
    """
    Get proxy list, attempting to fetch fresh proxies first, falling back to static list.
    
    Returns:
        List of proxy configurations
    """
    fresh_proxies = fetch_fresh_proxies()
    if fresh_proxies:
        return fresh_proxies
    else:
        logger.info("Using fallback proxy list")
        return PROXY_LIST

def get_proxy_config(proxy_info: Dict[str, Any]) -> Dict[str, str]:
    """
    Convert proxy info to the format expected by YouTubeTranscriptApi.
    
    Args:
        proxy_info: Dictionary containing proxy address, port, username, password
        
    Returns:
        Proxy configuration dictionary
    """
    proxy_url = f"http://{proxy_info['username']}:{proxy_info['password']}@{proxy_info['address']}:{proxy_info['port']}"
    return {
        "http": proxy_url,
        "https": proxy_url
    }

def fetch_transcript_with_proxy_rotation(video_id: str, language: str = 'en') -> Tuple[List[Dict], Optional[str]]:
    """
    Fetch transcript using proxy rotation. Try each proxy until one works.
    
    Args:
        video_id: YouTube video ID
        language: Language code for transcript
        
    Returns:
        Tuple of (transcript_data, successful_proxy_address) or raises exception if all proxies fail
    """
    # Randomize proxy order to distribute load
    shuffled_proxies = get_proxy_list().copy()
    random.shuffle(shuffled_proxies)
    
    last_error = None
    
    for proxy_info in shuffled_proxies:
        try:
            proxy_config = get_proxy_config(proxy_info)
            proxy_address = f"{proxy_info['address']}:{proxy_info['port']}"
            
            logger.info(f"Attempting to fetch transcript for {video_id} using proxy {proxy_address}")
            
            # Attempt to fetch transcript with current proxy
            transcript = YouTubeTranscriptApi.get_transcript(
                video_id, 
                languages=[language],
                proxies=proxy_config
            )
            
            logger.info(f"Successfully fetched transcript for {video_id} using proxy {proxy_address}")
            return transcript, proxy_address
            
        except YouTubeRequestFailed as e:
            logger.warning(f"Proxy {proxy_address} failed for video {video_id}: {str(e)}")
            last_error = e
            continue
        except Exception as e:
            logger.warning(f"Unexpected error with proxy {proxy_address} for video {video_id}: {str(e)}")
            last_error = e
            continue
    
    # If we get here, all proxies failed
    logger.error(f"All proxies failed for video {video_id}. Last error: {str(last_error)}")
    if last_error:
        raise last_error
    else:
        raise YouTubeRequestFailed("All proxies failed")

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
                
                # Fetch transcript using proxy rotation
                transcript, proxy_address = fetch_transcript_with_proxy_rotation(extracted_id, language)
                
                # Convert to SRT format
                srt_content = convert_to_srt_format(transcript)
                
                # Get video title (we'll use video ID as fallback since we don't have title from transcript API)
                video_title = f"Video {extracted_id}"
                
                # Create successful result
                results.append({
                    'videoId': extracted_id,
                    'success': True,
                    'srtContent': srt_content,
                    'videoTitle': video_title,
                    'proxyAddress': proxy_address
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
                error_message = str(e)
                if "All proxies failed" in error_message:
                    logger.error(f"All proxies failed for video {video_id}: {error_message}")
                    results.append({
                        'videoId': video_id,
                        'success': False,
                        'error': 'All proxies failed - YouTube may be blocking requests'
                    })
                else:
                    logger.error(f"YouTube request failed for video {video_id}: {error_message}")
                    results.append({
                        'videoId': video_id,
                        'success': False,
                        'error': f'YouTube request failed: {error_message}'
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

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint that also tests proxy functionality.
    
    Response:
    {
        "status": "healthy",
        "proxies": {
            "total": 10,
            "fresh_available": true,
            "fallback_count": 7
        },
        "server": {
            "port": 3001,
            "debug": false
        }
    }
    """
    try:
        # Test proxy availability
        fresh_proxies = fetch_fresh_proxies()
        proxy_info = {
            "total": len(get_proxy_list()),
            "fresh_available": len(fresh_proxies) > 0,
            "fallback_count": len(PROXY_LIST)
        }
        
        server_info = {
            "port": int(os.environ.get('PORT', 3001)),
            "debug": os.environ.get('DEBUG', 'False').lower() == 'true'
        }
        
        return jsonify({
            "status": "healthy",
            "proxies": proxy_info,
            "server": server_info
        })
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
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