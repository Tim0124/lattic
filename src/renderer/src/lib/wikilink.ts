import { vaultUrl } from './utils'

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|avif|bmp)$/i

// fenced code block（```…```）或 inline code（`…`）整段保護，內部的 [[...]] 不轉換
const CODE_SEGMENT = /(```[\s\S]*?```|`[^`\n]*`)/g

function replaceWikilinks(text: string, transclude: boolean): string {
  return text
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, rawTarget: string) => {
      const target = rawTarget.trim()
      if (IMAGE_EXT.test(target)) {
        return `![${target}](${vaultUrl(target)})`
      }
      // 非圖片的 ![[筆記]]：transclude 模式產生內嵌標記，否則退回普通連結（避免巢狀內嵌遞迴）
      const scheme = transclude ? 'transclude' : 'wiki'
      return `[${target}](${scheme}:${encodeURIComponent(target)})`
    })
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, rawTarget: string, alias?: string) => {
      const target = rawTarget.trim()
      return `[${alias?.trim() || target}](wiki:${encodeURIComponent(target)})`
    })
}

/**
 * 把 Obsidian 語法轉成標準 markdown：
 * - `![[img.png]]`、`![[img.png|300]]` → `![](vault://...)`，由 main 的 vault:// protocol 提供檔案
 * - `[[筆記]]`、`[[筆記|別名]]` → `[文字](wiki:...)`
 * - `![[筆記]]` → `[文字](transclude:...)`（內嵌）；`opts.transclude: false` 時退回 `wiki:` 連結，
 *   用於被內嵌的內容本身，避免巢狀 transclusion 無限遞迴（單層內嵌）
 * code block 與 inline code 內的內容保持原樣不轉換。
 */
export function preprocessObsidian(md: string, opts?: { transclude?: boolean }): string {
  const transclude = opts?.transclude ?? true
  // split 帶 capturing group：code 區段落在奇數 index 原樣保留，其餘片段才做 wikilink 轉換
  return md
    .split(CODE_SEGMENT)
    .map((part, i) => (i % 2 === 0 ? replaceWikilinks(part, transclude) : part))
    .join('')
}

/**
 * 從 markdown 取出指定標題（heading 文字，不含 #）的段落：該標題行起，到下一個同級或更高級
 * 標題前為止。找不到回 null（呼叫端可決定 fallback 整篇）。
 */
export function extractSection(md: string, heading: string): string | null {
  const lines = md.split('\n')
  const norm = heading.trim().toLowerCase()
  let start = -1
  let level = 0
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i])
    if (m && m[2].trim().toLowerCase() === norm) {
      start = i
      level = m[1].length
      break
    }
  }
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s+/.exec(lines[i])
    if (m && m[1].length <= level) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n').trim()
}

/** 從筆記清單建立 wikilink target → 筆記路徑的解析函式（比照 Obsidian：標題或完整路徑皆可） */
export function createWikiResolver(
  notes: { title: string; path: string }[]
): (target: string) => string | null {
  const map = new Map<string, string>()
  for (const n of notes) {
    map.set(n.path.slice(0, -'.md'.length).toLowerCase(), n.path)
  }
  // 標題後設定，路徑撞名時以標題（短寫法）優先
  for (const n of notes) {
    map.set(n.title.toLowerCase(), n.path)
  }
  return (target) => {
    const key = target.split('#')[0].trim().toLowerCase()
    return map.get(key) ?? null
  }
}
