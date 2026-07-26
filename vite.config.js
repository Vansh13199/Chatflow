import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Build optimizations
  build: {
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: true,
    },

    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-emoji': ['emoji-picker-react'],
        },
        // Smaller chunk names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Enable source maps only in development
    sourcemap: false,

    // Reduce chunk size warning threshold
    chunkSizeWarningLimit: 500,

    // CSS code splitting
    cssCodeSplit: true,
  },

  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'emoji-picker-react'],
    exclude: [],
  },

  // Enable gzip compression analysis
  esbuild: {
    // Remove legal comments for smaller bundle
    legalComments: 'none',
  },
})