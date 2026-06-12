import { watch, type FSWatcher } from 'chokidar'
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join, resolve, extname, basename } from 'path'
import matter from 'gray-matter'
import type { NoteMeta, NoteDoc } from '../share/types'

export const VAULT_PATH = ''

const IGNORED_DIRS = new Set(['.obsidian', '.trash', '.git'])

class VaultService {
  /** relPath -> NoteMeta */
  private notes = new Map<string, NoteMeta>()
  /** 小寫檔名（含副檔名）-> relPath，供 Obsidian 式短檔名解析（附件用） */
  private filesByName = new Map<string, string>()
  private watcher: FSWatcher | null = null
  private changeListeners = new Set<() => void>()
  private debounceTimer: NodeJS.Timeout | null = null

  async init(): Promise<void> {
    await this.scan()
    this.watcher = watch(VAULT_PATH, {
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

  listNotes(): NoteMeta[] {
    return [...this.notes.values()].sort((a, b) => a.path.localeCompare(b.path, 'zh-Hant'))
  }

  async readNote(relPath: string): Promise<NoteDoc | null> {
    const abs = this.toAbsolute(relPath)
    const meta = this.notes.get(relPath)
    if (!abs || !meta) return null
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
    return this.notes.has(relPath)
  }

  /** 建立或覆寫筆記。寫入後 watcher 會自動觸發 rescan 與 reindex */
  async writeNote(relPath: string, content: string): Promise<string> {
    const withExt = relPath.endsWith('.md') ? relPath : `${relPath}.md`
    const abs = this.toAbsolute(withExt)
    if (!abs) throw new Error(`路徑不在 vault 內：${relPath}`)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content, 'utf-8')
    return abs.slice(VAULT_PATH.length + 1)
  }

  /**
   * 解析 vault 內檔案的相對路徑為絕對路徑，防止 path traversal。
   * 支援完整相對路徑，或 Obsidian 式的純檔名（取 filesByName 對照）。
   */
  toAbsolute(relPath: string): string | null {
    const candidate = relPath.includes('/')
      ? relPath
      : (this.filesByName.get(relPath.toLowerCase()) ?? relPath)
    const abs = resolve(VAULT_PATH, candidate)
    if (!abs.startsWith(VAULT_PATH + '/')) return null
    return abs
  }

  private async scan(): Promise<void> {
    const notes = new Map<string, NoteMeta>()
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
        const relPath = abs.slice(VAULT_PATH.length + 1)
        filesByName.set(entry.name.toLowerCase(), relPath)
        if (extname(entry.name) === '.md') {
          const s = await stat(abs)
          const folder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : ''
          notes.set(relPath, {
            path: relPath,
            title: basename(entry.name, '.md'),
            folder,
            mtime: s.mtimeMs
          })
        }
      }
    }

    await walk(VAULT_PATH)
    this.notes = notes
    this.filesByName = filesByName
  }
}

export const vault = new VaultService()
