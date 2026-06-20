import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Aktiviert die React-Transformation und den schnellen Vite-Entwicklungsserver.
export default defineConfig({
  plugins: [react()],
})
