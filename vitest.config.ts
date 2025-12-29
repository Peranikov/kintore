import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  test: {
    // デフォルトはnode環境（高速）
    // Reactコンポーネントテストは @vitest-environment jsdom で個別指定
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
