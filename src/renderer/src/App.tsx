import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Bot, MessagesSquare, Settings } from 'lucide-react'
import type { SearchResult, IndexStatus } from 'src/share/types'
import { NoteTree } from './components/NoteTree'
import { NoteView } from './components/NoteView'
import { SearchBar } from './components/SearchBar'
import { SearchResults } from './components/SearchResults'
import { ChatPanel } from './components/ChatPanel'
import { AgentPanel } from './components/AgentPanel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable'
import { Spotlight } from './components/ui/spotlight'
import { TextGenerateEffect } from './components/ui/text-generate-effect'
import { SettingsDialog } from './components/SettingsDialog'
import { useTheme } from './lib/theme'
import { createWikiResolver } from './lib/wikilink'
import { MediaView } from './components/MediaView'
import { useFiles, useNote, useVaultInvalidation } from './lib/queries'
import { cn } from './lib/utils'

function IndexStatusBadge({ status }: { status: IndexStatus }): React.JSX.Element | null {
  if (status.state === 'idle') return null
  const dot = {
    indexing: 'bg-amber-400 animate-pulse',
    ready: 'bg-emerald-400',
    error: 'bg-red-500'
  }[status.state]
  const text = {
    indexing: `索引中 ${status.indexedFiles}/${status.totalFiles}…`,
    ready: `${status.chunks} chunks`,
    error: `索引失敗：${status.error}`
  }[status.state]
  return (
    <div className="flex items-center gap-1.5 border-t border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      <span className="truncate text-[11px] text-zinc-400" title={text}>
        {text}
      </span>
    </div>
  )
}

function Welcome(): React.JSX.Element {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="var(--secondary)" />
      <div
        className="absolute inset-0 [background-image:radial-gradient(circle,rgb(0_0_0/0.04)_1px,transparent_1px)] [background-size:20px_20px] dark:[background-image:radial-gradient(circle,rgb(255_255_255/0.06)_1px,transparent_1px)]"
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-3 px-8 text-center">
        <TextGenerateEffect words="你的筆記，你的模型" gradient className="text-3xl" />
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
          從左側選擇或搜尋一篇筆記開始閱讀，
          <br />
          或在右側用本地 AI 問答與交辦任務
        </p>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'agent'>('chat')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { settings: themeSettings, update: updateTheme } = useTheme()

  const { data: files = [] } = useFiles()
  const notes = useMemo(() => files.filter((f) => f.kind === 'note'), [files])
  const selectedFile = useMemo(
    () => files.find((f) => f.path === selectedPath) ?? null,
    [files, selectedPath]
  )
  const { data: doc } = useNote(selectedFile?.kind === 'note' ? selectedFile.path : null)
  useVaultInvalidation()

  useEffect(() => {
    void window.api.getIndexStatus().then(setIndexStatus)
    return window.api.onIndexStatus(setIndexStatus)
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

  return (
    <div className="h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <ResizablePanelGroup direction="horizontal" autoSaveId="my-wiki-layout">
        {/* 左欄：導覽 */}
        <ResizablePanel defaultSize={20} minSize={14} maxSize={32}>
          <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
              <div className="from-primary to-secondary flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br shadow-sm">
                <BookOpen className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[13px] font-semibold tracking-tight">My Wiki</span>
              <span className="ml-auto rounded-full bg-zinc-200/70 px-1.5 text-[10px] tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {notes.length}
              </span>
              <button
                onClick={() => setSettingsOpen(true)}
                title="設定"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
            <SearchBar
              onResults={setResults}
              disabled={indexStatus?.state === 'indexing'}
              inputRef={searchInputRef}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {results ? (
                <SearchResults results={results} onSelect={setSelectedPath} />
              ) : (
                <NoteTree files={files} selectedPath={selectedPath} onSelect={setSelectedPath} />
              )}
            </div>
            {indexStatus && <IndexStatusBadge status={indexStatus} />}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 中欄：閱讀區 */}
        <ResizablePanel defaultSize={52} minSize={30}>
          {selectedFile && selectedFile.kind !== 'note' ? (
            <MediaView file={selectedFile} onClose={() => setSelectedPath(null)} />
          ) : doc ? (
            <NoteView
              key={doc.path}
              doc={doc}
              resolveWikiTarget={resolveWikiTarget}
              onNavigate={setSelectedPath}
              onClose={() => setSelectedPath(null)}
            />
          ) : (
            <Welcome />
          )}
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右欄：AI */}
        <ResizablePanel defaultSize={28} minSize={18} maxSize={42}>
          <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex h-11 shrink-0 items-center gap-1 border-b border-zinc-200 px-2 dark:border-zinc-800">
              {(
                [
                  { key: 'chat', label: '問答', Icon: MessagesSquare },
                  { key: 'agent', label: 'Agent', Icon: Bot }
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
              <ChatPanel onOpenNote={setSelectedPath} />
            </div>
            <div className={cn('min-h-0 flex-1', activeTab !== 'agent' && 'hidden')}>
              <AgentPanel onOpenNote={setSelectedPath} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={themeSettings}
        onChange={updateTheme}
      />
    </div>
  )
}

export default App
