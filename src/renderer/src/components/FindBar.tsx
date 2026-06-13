import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useI18n } from '../lib/i18n'

interface FindBarProps {
  query: string
  onQueryChange: (q: string) => void
  count: number
  current: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

const navButtonClass =
  'flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700'

export function FindBar({
  query,
  onQueryChange,
  count,
  current,
  onNext,
  onPrev,
  onClose,
  inputRef
}: FindBarProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className="absolute top-2 right-4 z-20 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white py-1 pr-1 pl-2.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) onPrev()
            else onNext()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        placeholder={t('find.placeholder')}
        className="w-40 bg-transparent text-sm outline-none placeholder:text-zinc-400"
      />
      <span className="w-12 shrink-0 text-center text-xs tabular-nums text-zinc-400">
        {query ? `${count ? current + 1 : 0}/${count}` : ''}
      </span>
      <button onClick={onPrev} disabled={!count} title={t('find.prev')} className={navButtonClass}>
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={onNext} disabled={!count} title={t('find.next')} className={navButtonClass}>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={onClose} title={t('find.close')} className={navButtonClass}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
