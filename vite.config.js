import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // 🟢 KEEPS TAILWIND AND CLOUDFLARE INTACT
  plugins: [react(), tailwindcss(), cloudflare()],
  
  // 🟢 NGROK & SERVER CONFIGURATION
  server: {
    // Setting this to true (like you had it) is actually the perfect catch-all for Ngrok
    allowedHosts: true, 
    // This ensures live-reloading (HMR) doesn't break over the Ngrok connection
    hmr: {
      clientPort: 443 
    }
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