import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves a project site under /<repo>/, so the production build is
// based at /spacesim/. The dev server stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/spacesim/' : '/',
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.glsl', '**/*.vert', '**/*.frag'],
}))
