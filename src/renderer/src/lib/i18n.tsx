/* eslint-disable react-refresh/only-export-components -- context provider 檔需同時匯出 Provider 與 hook/常數 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Lang = 'zh-Hant' | 'en'

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'zh-Hant', label: '繁體中文' },
  { id: 'en', label: 'English' }
]

const STORAGE_KEY = 'lattic-lang'

type Dict = Record<string, string>

const zhHant: Dict = {
  'app.name': 'Lattic',
  'sidebar.settings': '設定',
  'sidebar.collapse': '收合側欄',
  'sidebar.expand': '展開側欄',
  'search.placeholder': '語意搜尋',
  'search.indexing': '索引建立中…',
  'search.clear': '清除',
  'search.empty': '沒有找到相關內容',
  'index.indexing': '索引中 {done}/{total}…',
  'index.ready': '{chunks} chunks',
  'index.error': '索引失敗：{error}',
  'index.rebuild': '重建索引',
  'panel.chat': '問答',
  'panel.agent': 'Agent',
  'panel.collapseAi': '收合 AI 面板',
  'panel.expandAi': '展開 AI 面板',
  'welcome.title': '你的筆記，你的模型',
  'welcome.subtitle1': '從左側選擇或搜尋一篇筆記開始閱讀，',
  'welcome.subtitle2': '或在右側用本地 AI 問答與交辦任務',
  'note.close': '關閉筆記',
  'tab.close': '關閉分頁',
  'find.placeholder': '在筆記內尋找',
  'find.prev': '上一筆（Shift+Enter）',
  'find.next': '下一筆（Enter）',
  'find.close': '關閉（Esc）',
  'media.zoomOut': '縮小',
  'media.zoomIn': '放大',
  'media.reset': '重設',
  'chat.clear': '清除',
  'chat.emptyTitle': '問任何問題',
  'chat.emptyHint': '我會先檢索你的筆記再回答',
  'chat.retrieving': '檢索筆記中…',
  'chat.inputPlaceholder': '輸入問題…（打 / 引用筆記）',
  'chat.inputHint': 'Enter 送出 · Shift+Enter 換行 · / 引用筆記',
  'chat.send': '送出',
  'chat.stop': '停止',
  'chatinput.removeRef': '移除引用',
  'agent.emptyHint1': '交辦任務，例如',
  'agent.emptyExample': '「整理所有提到 RAG 的筆記，寫一篇總覽」',
  'agent.emptyHint2': '寫入筆記前會先徵求你的同意',
  'agent.running': '執行中…',
  'agent.inputPlaceholder': '交辦任務…（打 / 引用筆記）',
  'agent.inputHint': 'Enter 執行 · Shift+Enter 換行 · / 引用筆記',
  'agent.execute': '執行',
  'agent.createTitle': 'Agent 想建立新筆記',
  'agent.overwriteTitle': 'Agent 想覆寫筆記',
  'agent.appendTitle': 'Agent 想追加內容到筆記',
  'agent.confirmCreate': '同意建立',
  'agent.confirmOverwrite': '同意覆寫',
  'agent.confirmAppend': '同意追加',
  'agent.appendHint': '以下內容會接到筆記末端：',
  'agent.reject': '拒絕',
  'settings.title': '設定',
  'settings.vault': 'Vault 資料夾',
  'settings.vaultChange': '變更',
  'settings.vaultHint': '變更後會重新掃描並建立索引',
  'settings.modelsSection': '模型與檢索',
  'settings.chatModel': '問答 / Agent 模型',
  'settings.embedModel': 'Embedding 模型',
  'settings.topK': '檢索 chunk 數（top-k）',
  'settings.modelsHint': '更換 Embedding 模型會重建整個索引',
  'settings.appearance': '外觀',
  'settings.light': '淺色',
  'settings.dark': '深色',
  'settings.system': '跟隨系統',
  'settings.theme': '主題色',
  'settings.language': '語言',
  'onboarding.title': '需要先設定本地 AI',
  'onboarding.notRunning':
    '找不到正在運行的 Ollama。Lattic 的搜尋與問答都靠本機 Ollama，請先安裝並啟動它：',
  'onboarding.thenPull': '啟動後再 pull 需要的模型：',
  'onboarding.runningButMissing': 'Ollama 已在運行，但還缺少需要的模型：',
  'onboarding.footer': '裝好後按「重新檢查」；模型就緒後會自動開始建立索引。也可在設定中更換模型。',
  'onboarding.skip': '先略過',
  'onboarding.recheck': '重新檢查',
  'onboarding.chatModel': '問答 / Agent 模型',
  'onboarding.embedModel': 'Embedding 模型',
  'transclude.loading': '載入內嵌筆記…',
  'transclude.notFound': '找不到內嵌的筆記：{target}',
  'transclude.sectionNotFound': '找不到段落「{anchor}」，顯示整篇',
  'vaultSetup.title': '選擇你的 Vault 資料夾',
  'vaultSetup.desc': 'Lattic 會讀取這個資料夾裡的 Markdown 筆記與附件，所有處理都在本機完成。',
  'vaultSetup.pick': '選擇資料夾'
}

const en: Dict = {
  'app.name': 'Lattic',
  'sidebar.settings': 'Settings',
  'sidebar.collapse': 'Collapse sidebar',
  'sidebar.expand': 'Expand sidebar',
  'search.placeholder': 'Semantic search',
  'search.indexing': 'Indexing…',
  'search.clear': 'Clear',
  'search.empty': 'No relevant results',
  'index.indexing': 'Indexing {done}/{total}…',
  'index.ready': '{chunks} chunks',
  'index.error': 'Index failed: {error}',
  'index.rebuild': 'Rebuild index',
  'panel.chat': 'Chat',
  'panel.agent': 'Agent',
  'panel.collapseAi': 'Collapse AI panel',
  'panel.expandAi': 'Expand AI panel',
  'welcome.title': 'Your notes, your model',
  'welcome.subtitle1': 'Pick or search a note on the left to start reading,',
  'welcome.subtitle2': 'or use the local AI on the right to ask and delegate tasks',
  'note.close': 'Close note',
  'tab.close': 'Close tab',
  'find.placeholder': 'Find in note',
  'find.prev': 'Previous (Shift+Enter)',
  'find.next': 'Next (Enter)',
  'find.close': 'Close (Esc)',
  'media.zoomOut': 'Zoom out',
  'media.zoomIn': 'Zoom in',
  'media.reset': 'Reset',
  'chat.clear': 'Clear',
  'chat.emptyTitle': 'Ask anything',
  'chat.emptyHint': "I'll search your notes first, then answer",
  'chat.retrieving': 'Searching notes…',
  'chat.inputPlaceholder': 'Ask a question… (type / to reference a note)',
  'chat.inputHint': 'Enter to send · Shift+Enter for newline · / to reference',
  'chat.send': 'Send',
  'chat.stop': 'Stop',
  'chatinput.removeRef': 'Remove reference',
  'agent.emptyHint1': 'Delegate a task, e.g.',
  'agent.emptyExample': '"Summarize all notes mentioning RAG into an overview"',
  'agent.emptyHint2': 'It will ask for confirmation before writing notes',
  'agent.running': 'Running…',
  'agent.inputPlaceholder': 'Delegate a task… (type / to reference a note)',
  'agent.inputHint': 'Enter to run · Shift+Enter for newline · / to reference',
  'agent.execute': 'Run',
  'agent.createTitle': 'Agent wants to create a note',
  'agent.overwriteTitle': 'Agent wants to overwrite a note',
  'agent.appendTitle': 'Agent wants to append to a note',
  'agent.confirmCreate': 'Allow create',
  'agent.confirmOverwrite': 'Allow overwrite',
  'agent.confirmAppend': 'Allow append',
  'agent.appendHint': 'The following will be appended to the note:',
  'agent.reject': 'Reject',
  'settings.title': 'Settings',
  'settings.vault': 'Vault folder',
  'settings.vaultChange': 'Change',
  'settings.vaultHint': 'Changing it re-scans and rebuilds the index',
  'settings.modelsSection': 'Models & retrieval',
  'settings.chatModel': 'Chat / Agent model',
  'settings.embedModel': 'Embedding model',
  'settings.topK': 'Retrieved chunks (top-k)',
  'settings.modelsHint': 'Changing the embedding model rebuilds the whole index',
  'settings.appearance': 'Appearance',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.system': 'System',
  'settings.theme': 'Theme color',
  'settings.language': 'Language',
  'onboarding.title': 'Set up local AI first',
  'onboarding.notRunning':
    "Can't find a running Ollama. Lattic's search and chat rely on local Ollama — please install and start it:",
  'onboarding.thenPull': 'Then pull the required models:',
  'onboarding.runningButMissing': 'Ollama is running, but the required models are missing:',
  'onboarding.footer':
    'After installing, click "Re-check"; indexing starts automatically once models are ready. You can also change models in Settings.',
  'onboarding.skip': 'Skip for now',
  'onboarding.recheck': 'Re-check',
  'onboarding.chatModel': 'Chat / Agent model',
  'onboarding.embedModel': 'Embedding model',
  'transclude.loading': 'Loading embedded note…',
  'transclude.notFound': 'Embedded note not found: {target}',
  'transclude.sectionNotFound': 'Section "{anchor}" not found, showing whole note',
  'vaultSetup.title': 'Choose your vault folder',
  'vaultSetup.desc':
    'Lattic reads the Markdown notes and attachments in this folder. Everything runs locally.',
  'vaultSetup.pick': 'Choose folder'
}

const resources: Record<Lang, Dict> = { 'zh-Hant': zhHant, en }

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh-Hant' || saved === 'en') return saved
  } catch {
    // ignore
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en'
}

export type TFunc = (key: keyof typeof zhHant, params?: Record<string, string | number>) => string

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFunc
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Lang>(detectLang)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])

  const t = useCallback<TFunc>(
    (key, params) => {
      const template = resources[lang][key] ?? resources['zh-Hant'][key] ?? String(key)
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
    },
    [lang]
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
