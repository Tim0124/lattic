export type VaultFileKind = 'note' | 'image' | 'html'

export interface VaultFile {
  /** 相對 vault 根目錄的路徑，如 "folder/note.md" */
  path: string
  /** 檔名（note 不含副檔名，即 Obsidian 的筆記標題；其他保留副檔名） */
  title: string
  /** 所在資料夾相對路徑，根目錄為 "" */
  folder: string
  kind: VaultFileKind
  mtime: number
}

export interface SearchResult {
  path: string
  title: string
  heading: string
  snippet: string
  score: number
}

export interface IndexStatus {
  state: 'idle' | 'indexing' | 'ready' | 'error'
  /** 本輪需要 embed 的檔案中已完成的數量 */
  indexedFiles: number
  /** 本輪需要 embed 的檔案總數 */
  totalFiles: number
  /** 索引內的 chunk 總數 */
  chunks: number
  error?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSource {
  path: string
  title: string
  heading: string
  score: number
}

export interface ChatChunkEvent {
  id: string
  delta: string
}

export interface ChatDoneEvent {
  id: string
  sources: ChatSource[]
}

export interface ChatErrorEvent {
  id: string
  message: string
}

export type AgentStep =
  | { type: 'tool'; tool: string; args: Record<string, unknown>; result: string }
  | { type: 'final'; content: string }
  | { type: 'error'; message: string }

export interface AgentStepEvent {
  id: string
  step: AgentStep
}

export type AgentWriteMode = 'create' | 'overwrite' | 'append'

export interface AgentWriteRequest {
  /** agent run id */
  id: string
  /** 這次寫入請求的 id，回覆確認時用 */
  requestId: string
  path: string
  /** create/overwrite 為完整內容；append 為要追加的片段 */
  content: string
  mode: AgentWriteMode
}

export interface NoteDoc {
  path: string
  title: string
  /** 去除 frontmatter 後的 markdown 內文 */
  content: string
  frontmatter: Record<string, unknown>
  mtime: number
}
