import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        preset: 'node-server',
      },
    }),
    react(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
})
