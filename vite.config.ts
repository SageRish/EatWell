import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => ({
  root: path.resolve(__dirname, 'src'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/index.html'),
  sidebar: path.resolve(__dirname, 'src/sidebar/index.html'),
  options: path.resolve(__dirname, 'src/options/index.html'),
        // background and content are built as entry points
        background: path.resolve(__dirname, 'src/background.ts'),
        content: path.resolve(__dirname, 'src/contentScript.tsx')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    sourcemap: mode !== 'production'
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, 'src')]
    }
  }
}))
