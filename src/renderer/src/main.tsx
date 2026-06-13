import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { I18nProvider } from './lib/i18n'
import { applyTheme, loadThemeSettings } from './lib/theme'

// render 前先套用主題，避免啟動時閃過預設配色
applyTheme(loadThemeSettings())

// 資料來源是本機 IPC，且 vault 變動有事件驅動 invalidation，不需要時間性的 stale 重抓
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity } }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>
)
