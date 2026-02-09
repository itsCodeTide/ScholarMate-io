#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "--- Installing Python Dependencies ---"
pip install -r requirements.txt

echo "--- Installing Node Dependencies ---"
cd frontend
npm install

echo "--- Building Frontend ---"
npm run build

echo "--- Build Complete ---"
# Return to root for gunicorn
cd ..
