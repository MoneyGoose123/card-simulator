import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages（サブパス）でも動くよう相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
