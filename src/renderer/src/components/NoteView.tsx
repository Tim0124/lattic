import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FolderOpen, X } from 'lucide-react'
import type { NoteDoc } from 'src/share/types'
import { preprocessObsidian } from '../lib/wikilink'
import { cn, vaultUrl } from '../lib/utils'

interface NoteViewProps {
  doc: NoteDoc
  resolveWikiTarget: (target: string) => string | null
  onNavigate: (path: string) => void
  onClose: () => void
}

export function NoteView({
  doc,
  resolveWikiTarget,
  onNavigate,
  onClose
}: NoteViewProps): React.JSX.Element {
  const content = useMemo(() => preprocessObsidian(doc.content), [doc.content])
  const folder = doc.path.includes('/') ? doc.path.slice(0, doc.path.lastIndexOf('/')) : ''

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        {folder && (
          <>
            <FolderOpen className="h-3.5 w-3.5 text-zinc-400" />
            <span className="truncate text-xs text-zinc-400">{folder.replaceAll('/', ' / ')}</span>
            <span className="text-zinc-300 dark:text-zinc-600">/</span>
          </>
        )}
        <span className="truncate text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
          {doc.title}
        </span>
        <button
          onClick={onClose}
          title="關閉筆記"
          className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <article className="prose prose-zinc dark:prose-invert prose-headings:scroll-mt-4 mx-auto max-w-3xl px-10 py-10">
          <h1>{doc.title}</h1>
          <Markdown
            remarkPlugins={[remarkGfm]}
            // react-markdown 預設會濾掉非 http 開頭的 URL，這裡放行自訂的 wiki: 與 vault:
            urlTransform={(url) => url}
            components={{
              a: ({ href, children }) => {
                if (href?.startsWith('wiki:')) {
                  const target = decodeURIComponent(href.slice('wiki:'.length))
                  const resolved = resolveWikiTarget(target)
                  return (
                    <a
                      href="#"
                      title={target}
                      onClick={(e) => {
                        e.preventDefault()
                        if (resolved) onNavigate(resolved)
                      }}
                      className={cn(
                        'no-underline',
                        resolved
                          ? 'bg-primary-soft text-primary rounded-sm px-1 hover:opacity-75'
                          : 'cursor-default rounded-sm bg-zinc-100 px-1 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                      )}
                    >
                      {children}
                    </a>
                  )
                }
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                )
              },
              img: ({ src, alt }) => {
                const finalSrc =
                  typeof src === 'string' && !/^(https?|vault|data):/.test(src)
                    ? vaultUrl(decodeURI(src))
                    : src
                return <img src={finalSrc} alt={alt ?? ''} className="rounded-lg" />
              }
            }}
          >
            {content}
          </Markdown>
        </article>
      </div>
    </div>
  )
}
