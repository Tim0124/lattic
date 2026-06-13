import { createHash } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { vault } from './vault'
import { embed } from './ollama'
import { getConfig } from './config'
import type { IndexStatus, SearchResult } from '../share/types'

interface Chunk {
  heading: string
  text: string
  /** 已 normalize 的向量，搜尋時直接做 dot product */
  embedding: number[]
}

interface FileEntry {
  title: string
  hash: string
  chunks: Chunk[]
}

interface StoreShape {
  model: string
  files: Record<string, FileEntry>
}

export interface RetrievedChunk {
  path: string
  title: string
  heading: string
  text: string
  score: number
}

/** 超過此長度的 heading section 才細切 */
const MAX_CHUNK = 1200
const SPLIT_SIZE = 1000
const OVERLAP = 200
/** 搜尋結果相關度門檻（cosine）；低於此分視為弱相關，不顯示 */
const SEARCH_MIN_SCORE = 0.5

function chunkContent(content: string): { heading: string; text: string }[] {
  const sections: { heading: string; lines: string[] }[] = [{ heading: '', lines: [] }]
  for (const line of content.split('\n')) {
    const m = /^#{1,6}\s+(.*)/.exec(line)
    if (m) sections.push({ heading: m[1].trim(), lines: [] })
    else sections[sections.length - 1].lines.push(line)
  }
  const chunks: { heading: string; text: string }[] = []
  for (const s of sections) {
    const text = s.lines.join('\n').trim()
    if (!text) continue
    if (text.length <= MAX_CHUNK) {
      chunks.push({ heading: s.heading, text })
      continue
    }
    for (let i = 0; i < text.length; i += SPLIT_SIZE - OVERLAP) {
      const piece = text.slice(i, i + SPLIT_SIZE).trim()
      if (piece) chunks.push({ heading: s.heading, text: piece })
    }
  }
  return chunks
}

function normalize(v: number[]): number[] {
  let sq = 0
  for (const x of v) sq += x * x
  const norm = Math.sqrt(sq) || 1
  return v.map((x) => x / norm)
}

function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

class Indexer {
  private files = new Map<string, FileEntry>()
  private status: IndexStatus = { state: 'idle', indexedFiles: 0, totalFiles: 0, chunks: 0 }
  private statusListeners = new Set<(s: IndexStatus) => void>()
  private storePath = ''
  private syncing = false
  private pendingSync = false
  private forceRebuild = false

  async init(): Promise<void> {
    this.storePath = join(app.getPath('userData'), 'vector-index.json')
    try {
      const store = JSON.parse(await readFile(this.storePath, 'utf-8')) as StoreShape
      // 換 embedding 模型時整個索引作廢重建
      if (store.model === getConfig().embedModel) {
        this.files = new Map(Object.entries(store.files))
      }
    } catch {
      // 沒有既有索引，從零開始
    }
    void this.sync()
  }

  getStatus(): IndexStatus {
    return this.status
  }

  onStatus(cb: (s: IndexStatus) => void): void {
    this.statusListeners.add(cb)
  }

  /** 捨棄所有已嵌入的向量，從頭重新建立索引 */
  async rebuild(): Promise<void> {
    this.forceRebuild = true
    await this.sync()
  }

  /** 與 vault 現況對齊：新增/變更的檔案 re-embed，刪除的移出索引 */
  async sync(): Promise<void> {
    if (this.syncing) {
      this.pendingSync = true
      return
    }
    this.syncing = true
    try {
      // forceRebuild 在取得鎖後才清空，確保清空原子地發生在 sync pass 開始
      if (this.forceRebuild) {
        this.forceRebuild = false
        this.files.clear()
      }
      const notes = vault.listNotes()
      const alive = new Set(notes.map((n) => n.path))
      for (const path of [...this.files.keys()]) {
        if (!alive.has(path)) this.files.delete(path)
      }

      const toEmbed: { path: string; title: string; hash: string; content: string }[] = []
      for (const note of notes) {
        const doc = await vault.readNote(note.path)
        if (!doc) continue
        const hash = createHash('sha1').update(doc.content).digest('hex')
        if (this.files.get(note.path)?.hash === hash) continue
        toEmbed.push({ path: note.path, title: note.title, hash, content: doc.content })
      }

      if (toEmbed.length === 0) {
        this.setStatus({
          state: 'ready',
          indexedFiles: 0,
          totalFiles: 0,
          chunks: this.chunkCount()
        })
        return
      }

      this.setStatus({
        state: 'indexing',
        indexedFiles: 0,
        totalFiles: toEmbed.length,
        chunks: this.chunkCount()
      })

      for (let i = 0; i < toEmbed.length; i++) {
        const file = toEmbed[i]
        const pieces = chunkContent(file.content)
        let chunks: Chunk[] = []
        if (pieces.length > 0) {
          const inputs = pieces.map(
            (p) => `${file.title}${p.heading ? ' > ' + p.heading : ''}\n${p.text}`
          )
          const vectors = await embed(inputs)
          chunks = pieces.map((p, j) => ({ ...p, embedding: normalize(vectors[j]) }))
        }
        this.files.set(file.path, { title: file.title, hash: file.hash, chunks })
        this.setStatus({
          state: 'indexing',
          indexedFiles: i + 1,
          totalFiles: toEmbed.length,
          chunks: this.chunkCount()
        })
      }

      await this.save()
      this.setStatus({ state: 'ready', indexedFiles: 0, totalFiles: 0, chunks: this.chunkCount() })
    } catch (err) {
      this.setStatus({
        state: 'error',
        indexedFiles: 0,
        totalFiles: 0,
        chunks: this.chunkCount(),
        error: err instanceof Error ? err.message : String(err)
      })
    } finally {
      this.syncing = false
      if (this.pendingSync) {
        this.pendingSync = false
        void this.sync()
      }
    }
  }

  /** 取回完整 chunk 內文，供 RAG context 使用 */
  async retrieve(query: string, k = 8): Promise<RetrievedChunk[]> {
    const [queryVec] = await embed([query])
    const q = normalize(queryVec)
    const results: RetrievedChunk[] = []
    for (const [path, file] of this.files) {
      for (const chunk of file.chunks) {
        results.push({
          path,
          title: file.title,
          heading: chunk.heading,
          text: chunk.text,
          score: dot(q, chunk.embedding)
        })
      }
    }
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, k)
  }

  async search(query: string, k = 8): Promise<SearchResult[]> {
    const chunks = await this.retrieve(query, k)
    // 只留相關度達門檻的；若全部偏低，至少給最相關的一筆，避免空結果
    const strong = chunks.filter((c) => c.score >= SEARCH_MIN_SCORE)
    const picked = strong.length > 0 ? strong : chunks.slice(0, 1)
    return picked.map(({ text, ...rest }) => ({ ...rest, snippet: text.slice(0, 160) }))
  }

  private chunkCount(): number {
    let n = 0
    for (const f of this.files.values()) n += f.chunks.length
    return n
  }

  private setStatus(s: IndexStatus): void {
    this.status = s
    this.statusListeners.forEach((cb) => cb(s))
  }

  private async save(): Promise<void> {
    const store: StoreShape = {
      model: getConfig().embedModel,
      files: Object.fromEntries(this.files)
    }
    await writeFile(this.storePath, JSON.stringify(store))
  }
}

export const indexer = new Indexer()
