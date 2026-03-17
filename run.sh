#!/bin/bash

# SENTINEL 1930 - Automated Startup Script
# Purpose: Install dependencies and start all services concurrently.

echo "🛡️ Starting SENTINEL 1930 - National Intelligence Grid..."

# 1. Check for Node.js and Python
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python3 is not installed."
    exit 1
fi

# 2. Install Root Dependencies
echo "📦 Installing root management tools..."
npm install

# 3. Install Sub-module Dependencies
echo "📦 Installing Dashboard dependencies..."
cd dashboard && npm install && cd ..

echo "📦 Installing Simulation Portal dependencies..."
cd simulation-app && npm install && cd ..

# 4. Setup Backend Environment
echo "📦 Setting up Backend Virtual Environment..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
cd ..

# 5. Launch All Services
echo "🚀 Launching Unified Grid (Dashboard: 3000 | Simulation: 3001 | API: 8000)..."
npm run dev:all
