import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // host: true, // This maps to 0.0.0.0 (listen on all local IPs)
    // port: 3000, // 👈 Changing port to 3000 to avoid permission issues
  },
})