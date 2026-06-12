import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Eraser, FileText, SendHorizontal, Sparkles, Square } from 'lucide-react'
import type { ChatMessage, ChatSource } from 'src/share/types'
import { cn } from '../lib/utils'

interface UiMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  error?: string
}

interface ChatPanelProps {
  onOpenNote: (path: string) => void
}

export function ChatPanel({ onOpenNote }: ChatPanelProps): React.JSX.Element {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const pendingRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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
    setInput('')
    setPendingId(id)
    void window.api.chatAsk(id, history)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-3 pt-2">
        <button
          onClick={() => setMessages([])}
          disabled={pendingId !== null || messages.length === 0}
          title="清除對話"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <Eraser className="h-3 w-3" />
          清除
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-12 text-center">
            <div className="bg-secondary-soft flex h-10 w-10 items-center justify-center rounded-full">
              <Sparkles className="text-secondary h-5 w-5" />
            </div>
            <p className="text-sm text-zinc-400">
              問任何問題
              <br />
              我會先檢索你的筆記再回答
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
                      檢索筆記中…
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
        <div className="focus-within:border-primary focus-within:ring-primary-soft rounded-xl border border-zinc-200 bg-white shadow-sm focus-within:ring-2 dark:border-zinc-700 dark:bg-zinc-900">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder="輸入問題…"
            className="w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none placeholder:text-zinc-400"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
              Enter 送出 · Shift+Enter 換行
            </span>
            {pendingId ? (
              <button
                onClick={() => void window.api.chatStop(pendingId)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                title="停止"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="from-primary to-secondary text-primary-fg flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm hover:opacity-85 disabled:opacity-40"
                title="送出"
              >
                <SendHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
