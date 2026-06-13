import { defineConfig } from 'vitest/config'

// 只測純邏輯層（renderer 的 lib/*、share/*）；不碰 Electron 主進程 IPC
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
