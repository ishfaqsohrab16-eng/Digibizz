# LMS DigiLMS Frontend

A modern responsive Learning Management System built with React, TypeScript, and Tailwind CSS.

## Setup Instructions

1. Install dependencies:
   ```bash
   # Option 1: Use npm directly
   npm install

   # Option 2: Use the setup script
   chmod +x setup.sh
   ./setup.sh
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Features

- Responsive layout for desktop and mobile devices
- Interactive sidebar navigation
  - Desktop: Expands on hover and collapses when mouse leaves
  - Mobile: Opens via a hamburger menu and closes on item selection
- Student and course management interfaces
- Modern UI components built with Tailwind CSS

## Project Structure

- `/src/components/layout` - Layout components including Sidebar and Navbar
- `/src/App.tsx` - Main application component and routes
- `/src/index.css` - Global styles and Tailwind utilities

## Dependencies

- React 18
- React Router
- TypeScript
- Tailwind CSS
- Font Awesome icons
