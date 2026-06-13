import { vaultUrl } from './utils'

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|avif|bmp)$/i

/**
 * 把 Obsidian 語法轉成標準 markdown：
 * - `![[img.png]]`、`![[img.png|300]]` → `![](vault://...)`，由 main 的 vault:// protocol 提供檔案
 * - `[[筆記]]`、`[[筆記|別名]]`、`![[筆記]]`（transclusion 先當連結） → `[文字](wiki:...)`
 */
export function preprocessObsidian(md: string): string {
  return md
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, rawTarget: string) => {
      const target = rawTarget.trim()
      if (IMAGE_EXT.test(target)) {
        return `![${target}](${vaultUrl(target)})`
      }
      return `[${target}](wiki:${encodeURIComponent(target)})`
    })
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, rawTarget: string, alias?: string) => {
      const target = rawTarget.trim()
      return `[${alias?.trim() || target}](wiki:${encodeURIComponent(target)})`
    })
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
