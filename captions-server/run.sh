#!/bin/bash

# YouTube Captions Server Startup Script

echo "🎬 Starting YouTube Captions Server..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3 first."
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "📦 Installing dependencies..."
    pip3 install -r requirements.txt
else
    echo "❌ requirements.txt not found!"
    exit 1
fi

# Set environment variables
export PORT=${PORT:-5000}
export DEBUG=${DEBUG:-False}

echo "🚀 Starting server on port $PORT..."
echo "📡 Server will be available at: http://localhost:$PORT"
echo "🔍 Health check: http://localhost:$PORT/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the Flask app
python3 app.py 