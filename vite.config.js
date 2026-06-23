import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 🟢 KEEPS TAILWIND AND CLOUDFLARE INTACT
  plugins: [
    react(), 
    tailwindcss(), 
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Black Hills Nightlife',
        short_name: 'BHNL',
        description: 'The ultimate nightlife and entertainment guide for the Black Hills.',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  
  // 🟢 NGROK & SERVER CONFIGURATION
  server: {
    // Setting this to true (like you had it) is actually the perfect catch-all for Ngrok
    allowedHosts: true, 
    // 🟢 THE FIX: Disables the broken WebSocket overlay crashing the app on ngrok
    hmr: false 
  },

  // 🟢 CODE-SPLITTING & BUILD OPTIMIZATION
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // This splits all third-party node_modules into a separate "vendor" file
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            return 'vendor'; // All other third-party libraries
          }
        }
      }
    },
    // Slightly increases the warning limit since we are explicitly handling chunks
    chunkSizeWarningLimit: 1000 
  }
})