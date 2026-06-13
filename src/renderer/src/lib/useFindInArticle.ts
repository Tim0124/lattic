import { useCallback, useEffect, useRef, useState } from 'react'

const ALL = 'vault-find'
const CURRENT = 'vault-find-current'

const supported = typeof Highlight !== 'undefined' && typeof CSS !== 'undefined' && !!CSS.highlights

function collectRanges(root: HTMLElement, query: string): Range[] {
  const ranges: Range[] = []
  const q = query.toLowerCase()
  if (!q) return ranges
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = (node.nodeValue ?? '').toLowerCase()
    let from = text.indexOf(q)
    while (from !== -1) {
      const range = document.createRange()
      range.setStart(node, from)
      range.setEnd(node, from + q.length)
      ranges.push(range)
      from = text.indexOf(q, from + q.length)
    }
    node = walker.nextNode()
  }
  return ranges
}

interface FindState {
  count: number
  /** 目前命中的索引（0-based） */
  current: number
  next: () => void
  prev: () => void
}

/**
 * 用 CSS Custom Highlight API 在容器內標記關鍵字命中，並支援上下筆切換。
 * 不修改 react-markdown 產出的 DOM，避免與 React 重繪衝突。
 * query 為空字串時清除所有 highlight。
 */
export function useFindInArticle(
  containerRef: React.RefObject<HTMLElement | null>,
  query: string,
  /** 內容變動（切換筆記）時觸發重新計算 */
  contentKey: string
): FindState {
  const rangesRef = useRef<Range[]>([])
  const [count, setCount] = useState(0)
  const [current, setCurrent] = useState(0)

  const paint = useCallback((idx: number) => {
    if (!supported) return
    const ranges = rangesRef.current
    CSS.highlights.set(ALL, new Highlight(...ranges))
    const active = ranges[idx]
    if (active) {
      CSS.highlights.set(CURRENT, new Highlight(active))
      active.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else {
      CSS.highlights.delete(CURRENT)
    }
  }, [])

  useEffect(() => {
    if (!supported) return
    const root = containerRef.current
    const clear = (): void => {
      CSS.highlights.delete(ALL)
      CSS.highlights.delete(CURRENT)
    }
    if (!root || !query) {
      rangesRef.current = []
      setCount(0)
      setCurrent(0)
      clear()
      return
    }
    const ranges = collectRanges(root, query)
    rangesRef.current = ranges
    setCount(ranges.length)
    setCurrent(0)
    paint(0)
    return clear
  }, [query, contentKey, containerRef, paint])

  const go = useCallback(
    (dir: 1 | -1) => {
      const n = rangesRef.current.length
      if (!n) return
      setCurrent((c) => {
        const next = (c + dir + n) % n
        paint(next)
        return next
      })
    },
    [paint]
  )

  return {
    count,
    current,
    next: useCallback(() => go(1), [go]),
    prev: useCallback(() => go(-1), [go])
  }
}
