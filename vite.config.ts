import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://daniel-beachy.github.io/game-pass-companion-v1/
export default defineConfig({
  base: '/game-pass-companion-v1/',
  plugins: [react()],
})
