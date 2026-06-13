import { watch, type FSWatcher } from 'chokidar'
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join, resolve, extname, basename } from 'path'
import matter from 'gray-matter'
import type { VaultFile, VaultFileKind, NoteDoc } from '../share/types'

const IGNORED_DIRS = new Set(['.obsidian', '.trash', '.git'])
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.bmp'])
const HTML_EXTS = new Set(['.html', '.htm'])

function kindOf(ext: string): VaultFileKind | null {
  if (ext === '.md') return 'note'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (HTML_EXTS.has(ext)) return 'html'
  return null
}

class VaultService {
  private root = ''
  /** relPath -> VaultFile（樹上顯示的檔案：note / image / html） */
  private files = new Map<string, VaultFile>()
  /** 小寫檔名（含副檔名）-> relPath，供 Obsidian 式短檔名解析（附件用） */
  private filesByName = new Map<string, string>()
  private watcher: FSWatcher | null = null
  private changeListeners = new Set<() => void>()
  private debounceTimer: NodeJS.Timeout | null = null

  async init(root: string): Promise<void> {
    this.root = root
    await this.scan()
    this.startWatching()
  }

  getRoot(): string {
    return this.root
  }

  /** 切換 vault 根目錄：關閉舊 watcher、重掃、重啟 watcher，並通知變動以觸發 reindex 與 UI 更新 */
  async setRoot(root: string): Promise<void> {
    this.root = root
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    await this.scan()
    this.startWatching()
    this.changeListeners.forEach((cb) => cb())
  }

  private startWatching(): void {
    this.watcher = watch(this.root, {
      ignored: (path) => basename(path).startsWith('.') || IGNORED_DIRS.has(basename(path)),
      ignoreInitial: true
    })
    this.watcher.on('all', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        void this.scan().then(() => {
          this.changeListeners.forEach((cb) => cb())
        })
      }, 300)
    })
  }

  onChange(cb: () => void): void {
    this.changeListeners.add(cb)
  }

  /** 樹上顯示的所有檔案 */
  listFiles(): VaultFile[] {
    return [...this.files.values()].sort((a, b) => a.path.localeCompare(b.path, 'zh-Hant'))
  }

  /** 僅 markdown 筆記（索引、agent、wikilink 解析用） */
  listNotes(): VaultFile[] {
    return this.listFiles().filter((f) => f.kind === 'note')
  }

  async readNote(relPath: string): Promise<NoteDoc | null> {
    const abs = this.toAbsolute(relPath)
    const meta = this.files.get(relPath)
    if (!abs || meta?.kind !== 'note') return null
    const raw = await readFile(abs, 'utf-8')
    let content = raw
    let data: Record<string, unknown> = {}
    try {
      ;({ content, data } = matter(raw))
    } catch {
      // frontmatter 不是合法 YAML（如部分 skill 檔）：整份當內文處理
    }
    return {
      path: relPath,
      title: meta.title,
      content,
      frontmatter: data,
      mtime: meta.mtime
    }
  }

  noteExists(relPath: string): boolean {
    return this.files.get(relPath)?.kind === 'note'
  }

  /** 建立或覆寫筆記。寫入後 watcher 會自動觸發 rescan 與 reindex */
  async writeNote(relPath: string, content: string): Promise<string> {
    const withExt = relPath.endsWith('.md') ? relPath : `${relPath}.md`
    const abs = this.toAbsolute(withExt)
    if (!abs) throw new Error(`路徑不在 vault 內：${relPath}`)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content, 'utf-8')
    return abs.slice(this.root.length + 1)
  }

  /**
   * 解析 vault 內檔案的相對路徑為絕對路徑，防止 path traversal。
   * 支援完整相對路徑，或 Obsidian 式的純檔名（取 filesByName 對照）。
   */
  toAbsolute(relPath: string): string | null {
    const candidate = relPath.includes('/')
      ? relPath
      : (this.filesByName.get(relPath.toLowerCase()) ?? relPath)
    const abs = resolve(this.root, candidate)
    if (!abs.startsWith(this.root + '/')) return null
    return abs
  }

  private async scan(): Promise<void> {
    const files = new Map<string, VaultFile>()
    const filesByName = new Map<string, string>()

    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue
        const abs = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(abs)
          continue
        }
        const relPath = abs.slice(this.root.length + 1)
        filesByName.set(entry.name.toLowerCase(), relPath)
        const ext = extname(entry.name).toLowerCase()
        const kind = kindOf(ext)
        if (!kind) continue
        const s = await stat(abs)
        const folder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : ''
        files.set(relPath, {
          path: relPath,
          title: kind === 'note' ? basename(entry.name, '.md') : entry.name,
          folder,
          kind,
          mtime: s.mtimeMs
        })
      }
    }

    await walk(this.root)
    this.files = files
    this.filesByName = filesByName
  }
}

export const vault = new VaultService()
