import { useEffect, useMemo, useRef, useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { NoteDoc } from 'src/share/types'
import { preprocessObsidian, extractSection } from '../lib/wikilink'
import { cn, vaultUrl } from '../lib/utils'
import { useFindInArticle } from '../lib/useFindInArticle'
import { useNote } from '../lib/queries'
import { useI18n } from '../lib/i18n'
import { FindBar } from './FindBar'

interface ResolveCtx {
  resolveWikiTarget: (target: string) => string | null
  onNavigate: (path: string) => void
}

/** 取相對路徑的所在資料夾，根層回 '' */
function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/** 內嵌另一篇筆記（單層）：被嵌內容內的 ![[...]] 不再展開，避免遞迴 */
function Transclusion({
  target,
  resolveWikiTarget,
  onNavigate
}: { target: string } & ResolveCtx): React.JSX.Element {
  const { t } = useI18n()
  const [namePart, anchor] = useMemo(() => {
    const idx = target.indexOf('#')
    return idx === -1 ? [target, ''] : [target.slice(0, idx), target.slice(idx + 1)]
  }, [target])
  const path = useMemo(() => resolveWikiTarget(namePart), [resolveWikiTarget, namePart])
  const { data: doc, isLoading } = useNote(path)

  const components = useMemo(
    () => createMarkdownComponents({ resolveWikiTarget, onNavigate, baseDir: dirOf(path ?? '') }),
    [resolveWikiTarget, onNavigate, path]
  )

  const inner = useMemo(() => {
    if (!doc) return { content: '', sectionMissing: false }
    const section = anchor ? extractSection(doc.content, anchor) : null
    const body = section ?? doc.content
    return {
      content: preprocessObsidian(body, { transclude: false }),
      sectionMissing: anchor !== '' && section === null
    }
  }, [doc, anchor])

  const wrapper =
    'my-3 block rounded-lg border-l-2 border-primary/40 bg-zinc-50/70 px-4 py-1 dark:bg-zinc-900/50'

  if (!path) {
    return (
      <span className={cn(wrapper, 'text-sm text-zinc-400')}>
        {t('transclude.notFound', { target })}
      </span>
    )
  }
  if (isLoading || !doc) {
    return <span className={cn(wrapper, 'text-sm text-zinc-400')}>{t('transclude.loading')}</span>
  }

  return (
    <span className={wrapper}>
      <button
        onClick={() => onNavigate(path)}
        className="text-primary mt-1 mb-0.5 block text-xs font-medium hover:underline"
      >
        {doc.title}
        {anchor && ` › ${anchor}`}
      </button>
      {inner.sectionMissing && (
        <span className="mb-1 block text-xs text-amber-500">
          {t('transclude.sectionNotFound', { anchor })}
        </span>
      )}
      <Markdown remarkPlugins={[remarkGfm]} urlTransform={(url) => url} components={components}>
        {inner.content}
      </Markdown>
    </span>
  )
}

/** 建立 react-markdown 的自訂渲染器；主文與內嵌共用，確保 wiki link / 圖片解析一致 */
function createMarkdownComponents({
  resolveWikiTarget,
  onNavigate,
  baseDir
}: ResolveCtx & { baseDir: string }): Components {
  return {
    // 含 transclusion 的段落攤平成 Fragment，避免 transclusion 區塊（block）被包進 <p> 造成非法巢狀
    p({ node, children }) {
      const hasTransclude = node?.children.some(
        (c) =>
          c.type === 'element' &&
          c.tagName === 'a' &&
          String(c.properties?.href ?? '').startsWith('transclude:')
      )
      return hasTransclude ? <>{children}</> : <p>{children}</p>
    },
    a({ href, children }) {
      if (href?.startsWith('transclude:')) {
        const target = decodeURIComponent(href.slice('transclude:'.length))
        return (
          <Transclusion
            target={target}
            resolveWikiTarget={resolveWikiTarget}
            onNavigate={onNavigate}
          />
        )
      }
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
    img({ src, alt }) {
      const finalSrc =
        typeof src === 'string' && !/^(https?|vault|data):/.test(src)
          ? vaultUrl(decodeURI(src), baseDir)
          : src
      return <img src={finalSrc} alt={alt ?? ''} className="rounded-lg" />
    }
  }
}

interface NoteViewProps {
  doc: NoteDoc
  resolveWikiTarget: (target: string) => string | null
  onNavigate: (path: string) => void
}

export function NoteView({ doc, resolveWikiTarget, onNavigate }: NoteViewProps): React.JSX.Element {
  const content = useMemo(() => preprocessObsidian(doc.content), [doc.content])

  const articleRef = useRef<HTMLElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [query, setQuery] = useState('')
  const find = useFindInArticle(articleRef, findOpen ? query : '', doc.path)

  const components = useMemo(
    () => createMarkdownComponents({ resolveWikiTarget, onNavigate, baseDir: dirOf(doc.path) }),
    [resolveWikiTarget, onNavigate, doc.path]
  )

  // 切換筆記由 App 端的 key 觸發 remount 來重置搜尋狀態

  // Cmd/Ctrl+F：開啟文內搜尋並聚焦
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFindOpen(true)
        findInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (findOpen) findInputRef.current?.focus()
  }, [findOpen])

  return (
    <div className="relative flex h-full flex-col">
      {findOpen && (
        <FindBar
          query={query}
          onQueryChange={setQuery}
          count={find.count}
          current={find.current}
          onNext={find.next}
          onPrev={find.prev}
          onClose={() => setFindOpen(false)}
          inputRef={findInputRef}
        />
      )}
      <div className="flex-1 overflow-y-auto">
        <article
          ref={articleRef}
          className="prose prose-zinc dark:prose-invert prose-headings:scroll-mt-4 mx-auto max-w-3xl px-10 py-10"
        >
          <Markdown
            remarkPlugins={[remarkGfm]}
            // react-markdown 預設會濾掉非 http 開頭的 URL，這裡放行自訂的 wiki: 與 vault:
            urlTransform={(url) => url}
            components={components}
          >
            {content}
          </Markdown>
        </article>
      </div>
    </div>
  )
}
