import { useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import type { SearchResult } from 'src/share/types'

interface SearchBarProps {
  onResults: (results: SearchResult[] | null) => void
  disabled: boolean
}

export function SearchBar({ onResults, disabled }: SearchBarProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const clear = (): void => {
    setQuery('')
    onResults(null)
  }

  const runSearch = async (): Promise<void> => {
    const q = query.trim()
    if (!q) {
      onResults(null)
      return
    }
    setSearching(true)
    try {
      onResults(await window.api.search(q))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="p-2">
      <div className="relative">
        {searching ? (
          <Loader2 className="text-primary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 animate-spin" />
        ) : (
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        )}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.trim() === '') onResults(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runSearch()
            if (e.key === 'Escape') clear()
          }}
          placeholder={disabled ? '索引建立中…' : '語意搜尋'}
          disabled={disabled}
          className="focus:border-primary focus:ring-primary-soft w-full rounded-lg border border-zinc-200 bg-white py-1.5 pr-7 pl-8 text-[13px] shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {query && (
          <button
            onClick={clear}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
