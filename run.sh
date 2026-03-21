#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting DRISHYAM AI local stack..."

if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is not installed."
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: python3 is not installed."
    exit 1
fi

cd "$ROOT_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing workspace dependencies..."
    npm install
else
    echo "Workspace dependencies already present. Skipping npm install."
fi

if [ ! -d "backend/venv" ]; then
    echo "Creating backend virtual environment..."
    python3 -m venv backend/venv
fi

if ! backend/venv/bin/python -c "import fastapi" >/dev/null 2>&1; then
    echo "Installing backend dependencies..."
    backend/venv/bin/pip install -r backend/requirements.txt
else
    echo "Backend dependencies already present."
fi

echo "Admin login: admin / password123"
echo "Privileged MFA OTP: 19301930"
echo "Backend will fall back to local SQLite if Supabase is unavailable."
echo "Launching services on API :8000, dashboard :3000, simulation :3001"

npm run dev:all
