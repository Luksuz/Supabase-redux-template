#!/usr/bin/env python3
"""
Test script for YouTube Captions Server
"""

import requests
import json
import time

# Server configuration
BASE_URL = "http://localhost:5000"
TEST_VIDEO_ID = "dQw4w9WgXcQ"  # Rick Roll - known to have captions

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure it's running.")
        return False

def test_simple_captions():
    """Test simple caption retrieval"""
    print(f"🎬 Testing simple captions for video: {TEST_VIDEO_ID}")
    try:
        response = requests.get(f"{BASE_URL}/captions/{TEST_VIDEO_ID}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Got captions: {len(data['captions'])} snippets")
            print(f"   Language: {data['language']} ({data['language_code']})")
            print(f"   Generated: {data['is_generated']}")
            return True
        else:
            print(f"❌ Failed to get captions: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_srt_format():
    """Test SRT format output"""
    print("📄 Testing SRT format...")
    try:
        response = requests.get(f"{BASE_URL}/captions/{TEST_VIDEO_ID}?format=srt")
        if response.status_code == 200:
            srt_content = response.text
            if "00:00:" in srt_content and "-->" in srt_content:
                print("✅ SRT format looks correct")
                return True
            else:
                print("❌ SRT format doesn't look right")
                return False
        else:
            print(f"❌ Failed to get SRT: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_list_transcripts():
    """Test listing available transcripts"""
    print("📋 Testing transcript listing...")
    try:
        response = requests.get(f"{BASE_URL}/list/{TEST_VIDEO_ID}")
        if response.status_code == 200:
            data = response.json()
            transcripts = data['available_transcripts']
            print(f"✅ Found {len(transcripts)} available transcripts")
            for transcript in transcripts[:3]:  # Show first 3
                print(f"   - {transcript['language']} ({transcript['language_code']}) "
                      f"Generated: {transcript['is_generated']}")
            return True
        else:
            print(f"❌ Failed to list transcripts: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_advanced_captions():
    """Test advanced caption endpoint"""
    print("🚀 Testing advanced captions endpoint...")
    try:
        payload = {
            "video_id": TEST_VIDEO_ID,
            "languages": ["en"],
            "format": "json",
            "preserve_formatting": True
        }
        response = requests.post(f"{BASE_URL}/captions", json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Advanced endpoint works: {len(data['captions'])} snippets")
            return True
        else:
            print(f"❌ Advanced endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("🎯 YouTube Captions Server Test Suite")
    print("=" * 50)
    
    tests = [
        test_health_check,
        test_simple_captions,
        test_srt_format,
        test_list_transcripts,
        test_advanced_captions
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()  # Empty line between tests
        time.sleep(1)  # Small delay between tests
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Server is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 