import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SearchX } from 'lucide-react'
import type { SearchResult } from 'src/share/types'
import { useI18n } from '../lib/i18n'

interface SearchResultsProps {
  results: SearchResult[]
  onSelect: (path: string) => void
}

/** 卡片 hover 背景採 Aceternity Card Hover Effect 的 layoutId 手法 */
export function SearchResults({ results, onSelect }: SearchResultsProps): React.JSX.Element {
  const { t } = useI18n()
  const [hovered, setHovered] = useState<number | null>(null)

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-zinc-400">
        <SearchX className="h-6 w-6" />
        <span className="text-sm">{t('search.empty')}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1 p-2">
      {results.map((r, i) => (
        <button
          key={`${r.path}-${i}`}
          onClick={() => onSelect(r.path)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="relative rounded-lg p-2.5 text-left"
        >
          <AnimatePresence>
            {hovered === i && (
              <motion.span
                layoutId="searchHoverBackground"
                className="absolute inset-0 rounded-lg bg-zinc-200/70 dark:bg-zinc-800"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.1 } }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-10">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                {r.title}
              </span>
              <span className="bg-primary-soft text-primary shrink-0 rounded-full px-1.5 text-[10px] tabular-nums">
                {r.score.toFixed(2)}
              </span>
            </div>
            {r.heading && (
              <div className="mt-0.5 truncate text-xs text-zinc-500"># {r.heading}</div>
            )}
            <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {r.snippet}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
