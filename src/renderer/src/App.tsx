import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'
import {
  Bot,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Settings
} from 'lucide-react'
import logo from './assets/logo.svg'
import type { SearchResult, IndexStatus, VaultFile, OllamaStatus } from 'src/share/types'
import { NoteTree } from './components/NoteTree'
import { NoteView } from './components/NoteView'
import { SearchBar } from './components/SearchBar'
import { SearchResults } from './components/SearchResults'
import { ChatPanel } from './components/ChatPanel'
import { AgentPanel } from './components/AgentPanel'
import { TabBar } from './components/TabBar'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable'
import { Spotlight } from './components/ui/spotlight'
import { TextGenerateEffect } from './components/ui/text-generate-effect'
import { SettingsDialog } from './components/SettingsDialog'
import { OnboardingDialog } from './components/OnboardingDialog'
import { VaultSetup } from './components/VaultSetup'
import { useTheme } from './lib/theme'
import { createWikiResolver } from './lib/wikilink'
import { MediaView } from './components/MediaView'
import { useFiles, useNote, useVaultInvalidation } from './lib/queries'
import { useI18n } from './lib/i18n'
import { cn } from './lib/utils'

const TABS_KEY = 'my-wiki-tabs'

function loadTabs(): { open: string[]; active: string | null } {
  try {
    const p = JSON.parse(localStorage.getItem(TABS_KEY) ?? '')
    return {
      open: Array.isArray(p.open) ? p.open : [],
      active: typeof p.active === 'string' ? p.active : null
    }
  } catch {
    return { open: [], active: null }
  }
}

function IndexStatusBadge({
  status,
  onRebuild
}: {
  status: IndexStatus
  onRebuild: () => void
}): React.JSX.Element | null {
  const { t } = useI18n()
  if (status.state === 'idle') return null
  const indexing = status.state === 'indexing'
  const dot = {
    indexing: 'bg-amber-400 animate-pulse',
    ready: 'bg-emerald-400',
    error: 'bg-red-500'
  }[status.state]
  const text = {
    indexing: t('index.indexing', { done: status.indexedFiles, total: status.totalFiles }),
    ready: t('index.ready', { chunks: status.chunks }),
    error: t('index.error', { error: status.error ?? '' })
  }[status.state]
  return (
    <div className="flex items-center gap-1.5 border-t border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400" title={text}>
        {text}
      </span>
      <button
        onClick={onRebuild}
        disabled={indexing}
        title={t('index.rebuild')}
        className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <RefreshCw className={cn('h-3 w-3', indexing && 'animate-spin')} />
      </button>
    </div>
  )
}

function Welcome(): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="var(--secondary)" />
      <div
        className="absolute inset-0 [background-image:radial-gradient(circle,rgb(0_0_0/0.04)_1px,transparent_1px)] [background-size:20px_20px] dark:[background-image:radial-gradient(circle,rgb(255_255_255/0.06)_1px,transparent_1px)]"
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-3 px-8 text-center">
        <TextGenerateEffect words={t('welcome.title')} gradient className="text-3xl" />
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
          {t('welcome.subtitle1')}
          <br />
          {t('welcome.subtitle2')}
        </p>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [openPaths, setOpenPaths] = useState<string[]>(() => loadTabs().open)
  const [activePath, setActivePath] = useState<string | null>(() => loadTabs().active)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'agent'>('chat')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  // null = 載入中；'' = 尚未選擇 vault（顯示引導）；非空 = 已設定
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const { t } = useI18n()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const { settings: themeSettings, update: updateTheme } = useTheme()

  const { data: files = [] } = useFiles()
  const notes = useMemo(() => files.filter((f) => f.kind === 'note'), [files])
  const fileMap = useMemo(() => new Map(files.map((f) => [f.path, f])), [files])
  // 開啟的分頁；過濾掉已不存在的檔案（vault 變動或還原舊狀態時）
  const tabs = useMemo(
    () => openPaths.map((p) => fileMap.get(p)).filter((f): f is VaultFile => !!f),
    [openPaths, fileMap]
  )
  const activeFile = activePath ? (fileMap.get(activePath) ?? null) : null
  const { data: doc } = useNote(activeFile?.kind === 'note' ? activeFile.path : null)
  useVaultInvalidation()

  // 開啟（或聚焦已開啟的）筆記分頁
  const openNote = useCallback((path: string) => {
    setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
    setActivePath(path)
  }, [])

  const closeTab = useCallback(
    (path: string) => {
      const idx = openPaths.indexOf(path)
      const next = openPaths.filter((p) => p !== path)
      setOpenPaths(next)
      if (activePath === path) {
        setActivePath(next.length ? next[Math.min(idx, next.length - 1)] : null)
      }
    },
    [openPaths, activePath]
  )

  // 分頁狀態持久化
  useEffect(() => {
    localStorage.setItem(TABS_KEY, JSON.stringify({ open: openPaths, active: activePath }))
  }, [openPaths, activePath])

  // Cmd/Ctrl+W 關閉目前分頁（由 main 的 before-input-event 觸發）
  useEffect(() => {
    return window.api.onCloseTabShortcut(() => {
      if (activePath) closeTab(activePath)
    })
  }, [activePath, closeTab])

  useEffect(() => {
    void window.api.getIndexStatus().then(setIndexStatus)
    return window.api.onIndexStatus(setIndexStatus)
  }, [])

  useEffect(() => {
    void window.api.getOllamaStatus().then(setOllamaStatus)
  }, [])

  useEffect(() => {
    void window.api.getVaultPath().then(setVaultPath)
  }, [])

  // 首次引導：選擇 vault 資料夾。setRoot 會觸發 vault:changed → useVaultInvalidation 重抓筆記
  const pickVault = useCallback(async () => {
    const picked = await window.api.pickVault()
    if (picked) setVaultPath(picked)
  }, [])

  const ollamaReady =
    !!ollamaStatus && ollamaStatus.running && ollamaStatus.chatReady && ollamaStatus.embedReady

  const recheckOllama = useCallback(async () => {
    const s = await window.api.getOllamaStatus()
    setOllamaStatus(s)
    // 模型就緒 → 建立索引（首次啟動時的索引可能因缺模型而失敗）
    if (s.running && s.chatReady && s.embedReady) void window.api.rebuildIndex()
  }, [])

  // 全域快捷鍵：Cmd/Ctrl+K 聚焦搜尋、Cmd/Ctrl+, 開設定
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const resolveWikiTarget = useMemo(() => createWikiResolver(notes), [notes])

  // 尚未選擇 vault：顯示全螢幕引導，取代主介面
  if (vaultPath === '') {
    return <VaultSetup onPick={pickVault} />
  }

  return (
    <div className="relative h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <ResizablePanelGroup direction="horizontal" autoSaveId="my-wiki-layout">
        {/* 左欄：導覽 */}
        <ResizablePanel
          ref={leftPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={20}
          minSize={14}
          maxSize={32}
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => setLeftCollapsed(false)}
        >
          <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
              <img src={logo} alt="Lattic" className="h-6 w-6 rounded-md shadow-sm" />
              <span className="text-[13px] font-semibold tracking-tight">Lattic</span>
              <span className="ml-auto rounded-full bg-zinc-200/70 px-1.5 text-[10px] tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {notes.length}
              </span>
              <button
                onClick={() => setSettingsOpen(true)}
                title={t('sidebar.settings')}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => leftPanelRef.current?.collapse()}
                title={t('sidebar.collapse')}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
            <SearchBar
              onResults={setResults}
              disabled={indexStatus?.state === 'indexing'}
              inputRef={searchInputRef}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {results ? (
                <SearchResults results={results} onSelect={openNote} />
              ) : (
                <NoteTree files={files} selectedPath={activePath} onSelect={openNote} />
              )}
            </div>
            {indexStatus && (
              <IndexStatusBadge
                status={indexStatus}
                onRebuild={() => void window.api.rebuildIndex()}
              />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 中欄：分頁 + 閱讀區 */}
        <ResizablePanel defaultSize={52} minSize={30}>
          <div className="flex h-full flex-col">
            {tabs.length > 0 && (
              <TabBar
                tabs={tabs}
                activePath={activePath}
                onSelect={setActivePath}
                onClose={closeTab}
              />
            )}
            <div className="min-h-0 flex-1">
              {activeFile && activeFile.kind !== 'note' ? (
                <MediaView key={activeFile.path} file={activeFile} />
              ) : doc ? (
                <NoteView
                  key={doc.path}
                  doc={doc}
                  resolveWikiTarget={resolveWikiTarget}
                  onNavigate={openNote}
                />
              ) : (
                <Welcome />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右欄：AI */}
        <ResizablePanel
          ref={rightPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={28}
          minSize={18}
          maxSize={42}
          onCollapse={() => setRightCollapsed(true)}
          onExpand={() => setRightCollapsed(false)}
        >
          <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex h-11 shrink-0 items-center gap-1 border-b border-zinc-200 px-2 dark:border-zinc-800">
              <button
                onClick={() => rightPanelRef.current?.collapse()}
                title={t('panel.collapseAi')}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
              {(
                [
                  { key: 'chat', label: t('panel.chat'), Icon: MessagesSquare },
                  { key: 'agent', label: t('panel.agent'), Icon: Bot }
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[13px] transition-colors',
                    activeTab === key
                      ? 'text-secondary bg-white font-medium shadow-sm dark:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {/* 切 tab 保持 mounted，保留對話歷史與進行中的 streaming / agent run */}
            <div className={cn('min-h-0 flex-1', activeTab !== 'chat' && 'hidden')}>
              <ChatPanel onOpenNote={openNote} files={files} />
            </div>
            <div className={cn('min-h-0 flex-1', activeTab !== 'agent' && 'hidden')}>
              <AgentPanel onOpenNote={openNote} files={files} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* 側欄收合後的浮動展開鈕 */}
      {leftCollapsed && (
        <button
          onClick={() => leftPanelRef.current?.expand()}
          title={t('sidebar.expand')}
          className="absolute top-2.5 left-2 z-20 rounded-md border border-zinc-200 bg-white/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}
      {rightCollapsed && (
        <button
          onClick={() => rightPanelRef.current?.expand()}
          title={t('panel.expandAi')}
          className="absolute top-2.5 right-2 z-20 rounded-md border border-zinc-200 bg-white/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={themeSettings}
        onChange={updateTheme}
      />

      {ollamaStatus && !ollamaReady && !onboardingDismissed && (
        <OnboardingDialog
          status={ollamaStatus}
          onRecheck={recheckOllama}
          onDismiss={() => setOnboardingDismissed(true)}
        />
      )}
    </div>
  )
}

export default App
