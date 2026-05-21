#!/bin/bash

echo "Installing dependencies for the LMS-Digibizz frontend..."

# Make sure we're in the frontend directory
cd "$(dirname "$0")"

# Install dependencies
npm install

# Ensure the correct Vite plugin is installed
npm install @vitejs/plugin-react-swc --save-dev

echo "Setup complete! You can now run 'npm run dev' to start the development server."
