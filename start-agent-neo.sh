#!/bin/bash

# Agent Neo DApp Startup Script
# This script starts the Agent Neo decentralized AI agent DApp

echo "🚀 Starting Agent Neo DApp..."
echo "============================="

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python not found. Please install Python 3."
    exit 1
fi

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📁 Working directory: $SCRIPT_DIR"
echo "🐍 Using Python: $PYTHON_CMD"

# Start the development server
echo "🌐 Starting development server on http://127.0.0.1:8000"
echo "📱 The Agent Neo DApp will be available at:"
echo "   http://127.0.0.1:8000"
echo ""
echo "✨ Features available:"
echo "   - Progressive Web App (PWA) installation"
echo "   - Offline functionality"
echo "   - Native P2P networking with WebRTC"
echo "   - Decentralized task processing"
echo "   - Resource monitoring and management"
echo "   - Cryptographic identity and guild system"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo "============================="

# Change to the script directory and start the server
cd "$SCRIPT_DIR"
$PYTHON_CMD -m http.server 8000 --bind 127.0.0.1