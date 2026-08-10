import { defineConfig } from 'vite'
import reactSWC from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactSWC()],
  css: {
    // Ensure CSS processing happens correctly
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  }
})
