import { useLayoutEffect, useRef, useState } from 'react'
import { FileText, SendHorizontal, Square, X } from 'lucide-react'
import type { VaultFile } from 'src/share/types'
import { cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onStop?: () => void
  pending: boolean
  placeholder: string
  hint: string
  /** `/` 選單可挑選的筆記 */
  files: VaultFile[]
  /** 已引用的筆記（顯示為上方 chip） */
  refs: VaultFile[]
  onAddRef: (file: VaultFile) => void
  onRemoveRef: (path: string) => void
}

interface Trigger {
  /** `/` 的索引位置 */
  at: number
  /** `/` 到游標之間的查詢字串 */
  query: string
}

/** 找出游標前是否有有效的 `/` 觸發（位於行首或空白後、且與游標間無空白） */
function detectTrigger(text: string, cursor: number): Trigger | null {
  const slash = text.lastIndexOf('/', cursor - 1)
  if (slash < 0) return null
  const before = text[slash - 1]
  if (before !== undefined && !/\s/.test(before)) return null
  const query = text.slice(slash + 1, cursor)
  if (/\s/.test(query)) return null
  return { at: slash, query }
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  pending,
  placeholder,
  hint,
  files,
  refs,
  onAddRef,
  onRemoveRef
}: ChatInputProps): React.JSX.Element {
  const { t } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [trigger, setTrigger] = useState<Trigger | null>(null)
  const [selected, setSelected] = useState(0)
  /** select 後要設定的游標位置，於 value 更新後套用 */
  const pendingCursor = useRef<number | null>(null)

  const matches = trigger
    ? files.filter((f) => {
        const q = trigger.query.toLowerCase()
        return f.title.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
      })
    : []

  // 自動長高
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  // select 後還原游標
  useLayoutEffect(() => {
    if (pendingCursor.current === null) return
    const el = textareaRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(pendingCursor.current, pendingCursor.current)
    }
    pendingCursor.current = null
  }, [value])

  // 鍵盤移動時讓選中項捲入可視範圍
  useLayoutEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const sync = (text: string, cursor: number): void => {
    onChange(text)
    setTrigger(detectTrigger(text, cursor))
    setSelected(0)
  }

  const choose = (file: VaultFile): void => {
    if (!trigger) return
    const cursor = textareaRef.current?.selectionStart ?? value.length
    // 移除輸入框裡的 `/query`，改以上方 chip 呈現引用
    const next = value.slice(0, trigger.at) + value.slice(cursor)
    pendingCursor.current = trigger.at
    setTrigger(null)
    onChange(next)
    onAddRef(file)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (trigger && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => (s + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => (s - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        choose(matches[selected])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setTrigger(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="focus-within:border-primary focus-within:ring-primary-soft relative rounded-xl border border-zinc-200 bg-white shadow-sm focus-within:ring-2 dark:border-zinc-700 dark:bg-zinc-900">
      {trigger && matches.length > 0 && (
        <div
          ref={listRef}
          className="absolute bottom-full left-0 mb-1 max-h-60 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {matches.map((f, i) => (
            <button
              key={f.path}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(f)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
                i === selected ? 'bg-zinc-100 dark:bg-zinc-700' : ''
              )}
            >
              <FileText
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  i === selected ? 'text-primary' : 'text-zinc-400'
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-zinc-800 dark:text-zinc-100">
                  {f.title}
                </span>
                {f.folder && (
                  <span className="block truncate text-[10px] text-zinc-400">{f.folder}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      {refs.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pt-2.5">
          {refs.map((r) => (
            <span
              key={r.path}
              title={r.path}
              className="bg-primary-soft text-primary flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs"
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="max-w-[140px] truncate">{r.title}</span>
              <button
                onClick={() => onRemoveRef(r.path)}
                title={t('chatinput.removeRef')}
                className="rounded hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        rows={2}
        onChange={(e) => sync(e.target.value, e.target.selectionStart)}
        onKeyDown={onKeyDown}
        onClick={(e) => {
          setTrigger(detectTrigger(value, e.currentTarget.selectionStart))
          setSelected(0)
        }}
        placeholder={placeholder}
        className="max-h-[200px] w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none placeholder:text-zinc-400"
      />
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-[10px] text-zinc-300 dark:text-zinc-600">{hint}</span>
        {pending ? (
          <button
            onClick={onStop}
            title={t('chat.stop')}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!value.trim()}
            title={t('chat.send')}
            className="from-primary to-secondary text-primary-fg flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm hover:opacity-85 disabled:opacity-40"
          >
            <SendHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
