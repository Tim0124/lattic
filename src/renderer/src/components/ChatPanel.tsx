import { useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Eraser, FileText, Sparkles } from 'lucide-react'
import type { ChatMessage, ChatSource, VaultFile } from 'src/share/types'
import { cn } from '../lib/utils'
import { ChatInput } from './ChatInput'
import { useI18n } from '../lib/i18n'

interface UiMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  error?: string
}

interface ChatPanelProps {
  onOpenNote: (path: string) => void
  files: VaultFile[]
}

export function ChatPanel({ onOpenNote, files }: ChatPanelProps): React.JSX.Element {
  const { t } = useI18n()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [refs, setRefs] = useState<VaultFile[]>([])
  const [pendingId, setPendingId] = useState<string | null>(null)
  const pendingRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const notes = useMemo(() => files.filter((f) => f.kind === 'note'), [files])

  useEffect(() => {
    pendingRef.current = pendingId
  }, [pendingId])

  const patchLast = (patch: Partial<UiMessage> | ((m: UiMessage) => Partial<UiMessage>)): void => {
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...last, ...(typeof patch === 'function' ? patch(last) : patch) }
      return next
    })
  }

  useEffect(() => {
    const unsubs = [
      window.api.onChatChunk(({ id, delta }) => {
        if (id !== pendingRef.current) return
        patchLast((m) => ({ content: m.content + delta }))
      }),
      window.api.onChatDone(({ id, sources }) => {
        if (id !== pendingRef.current) return
        patchLast({ sources })
        setPendingId(null)
      }),
      window.api.onChatError(({ id, message }) => {
        if (id !== pendingRef.current) return
        patchLast({ error: message })
        setPendingId(null)
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const send = (): void => {
    const q = input.trim()
    if (!q || pendingId) return
    const id = crypto.randomUUID()
    const history: ChatMessage[] = [
      ...messages
        .filter((m) => !m.error && m.content)
        .map(({ role, content }) => ({ role, content })),
      { role: 'user', content: q }
    ]
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: '' }
    ])
    const refPaths = refs.map((r) => r.path)
    setInput('')
    setRefs([])
    setPendingId(id)
    void window.api.chatAsk(id, history, refPaths)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-3 pt-2">
        <button
          onClick={() => setMessages([])}
          disabled={pendingId !== null || messages.length === 0}
          title={t('chat.clear')}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <Eraser className="h-3 w-3" />
          {t('chat.clear')}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-12 text-center">
            <div className="bg-secondary-soft flex h-10 w-10 items-center justify-center rounded-full">
              <Sparkles className="text-secondary h-5 w-5" />
            </div>
            <p className="text-sm text-zinc-400">
              {t('chat.emptyTitle')}
              <br />
              {t('chat.emptyHint')}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('text-sm', m.role === 'user' && 'flex justify-end')}>
            {m.role === 'user' ? (
              <div className="bg-primary text-primary-fg max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm">
                {m.content}
              </div>
            ) : (
              <div className="space-y-2">
                {m.content ? (
                  <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                  </div>
                ) : (
                  !m.error && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span className="bg-secondary h-2 w-2 animate-pulse rounded-full" />
                      {t('chat.retrieving')}
                    </div>
                  )
                )}
                {m.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                    {m.error}
                  </div>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.sources.map((s, j) => (
                      <button
                        key={`${s.path}-${j}`}
                        onClick={() => onOpenNote(s.path)}
                        title={`${s.path}${s.heading ? ' # ' + s.heading : ''}`}
                        className="hover:border-secondary hover:text-secondary flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <FileText className="h-3 w-3" />
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-200 p-2.5 dark:border-zinc-800">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={send}
          onStop={() => pendingId && void window.api.chatStop(pendingId)}
          pending={pendingId !== null}
          placeholder={t('chat.inputPlaceholder')}
          hint={t('chat.inputHint')}
          files={notes}
          refs={refs}
          onAddRef={(f) =>
            setRefs((prev) => (prev.some((r) => r.path === f.path) ? prev : [...prev, f]))
          }
          onRemoveRef={(path) => setRefs((prev) => prev.filter((r) => r.path !== path))}
        />
      </div>
    </div>
  )
}
