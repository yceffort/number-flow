import {fileURLToPath} from 'node:url'

import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // 구형 Chrome 테스트를 위해 빌드 산출물 타깃을 낮춘다:
    target: 'chrome66',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        panel: fileURLToPath(new URL('./panel.html', import.meta.url)),
        selftest: fileURLToPath(new URL('./selftest.html', import.meta.url)),
      },
    },
  },
})
