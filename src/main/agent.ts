import { randomUUID } from 'crypto'
import type { WebContents } from 'electron'
import { vault } from './vault'
import { indexer } from './indexer'
import { chatOnce, type OllamaChatMessage } from './ollama'
import type { AgentStep, AgentWriteMode, AgentWriteRequest } from '../share/types'

const SYSTEM_PROMPT = `你是個人 wiki 的 agent，使用工具完成使用者交辦的任務。

可用工具：
- search_notes：語意搜尋筆記。args: {"query": "搜尋內容"}
- list_notes：列出所有筆記路徑。args: {}
- read_note：讀取一篇筆記的完整內容。args: {"path": "筆記路徑"}（使用 search/list 回傳的路徑）
- append_note：在既有筆記末端追加內容（不會動到原有內容，較安全），會經過使用者確認。args: {"path": "筆記路徑", "content": "要追加的 markdown"}
- write_note：建立新筆記或覆寫整篇，會經過使用者確認。args: {"path": "筆記路徑", "content": "完整 markdown 內容"}

規則：
- 每次回覆只輸出一個 JSON 物件，不要有任何其他文字
- 呼叫工具：{"tool": "工具名", "args": {...}}
- 任務完成：{"final": "給使用者的繁體中文總結"}
- 只是要在既有筆記補充內容時，優先用 append_note；只有要整篇重寫時才用 write_note
- 用 write_note 覆寫既有筆記前，先用 read_note 看過原內容，content 必須是修改後的完整內容
- 找不到需要的資訊就在 final 裡誠實說明，不要捏造`

const MAX_STEPS = 10
const READ_CAP = 6000
const TOOL_RESULT_PREFIX = '工具結果：'
/** 保留最近幾個完整工具結果，更早的截短，避免多步任務塞爆 context */
const KEEP_FULL_RESULTS = 2
const OLD_RESULT_CAP = 400

function pruneHistory(messages: OllamaChatMessage[]): OllamaChatMessage[] {
  const toolIdx = messages
    .map((m, i) => (m.role === 'user' && m.content.startsWith(TOOL_RESULT_PREFIX) ? i : -1))
    .filter((i) => i >= 0)
  const keepFull = new Set(toolIdx.slice(-KEEP_FULL_RESULTS))
  return messages.map((m, i) => {
    if (!toolIdx.includes(i) || keepFull.has(i) || m.content.length <= OLD_RESULT_CAP) return m
    return { ...m, content: m.content.slice(0, OLD_RESULT_CAP) + '\n…（較早的結果已截短）' }
  })
}

/** 把 JSON 字串字面值內的裸換行/tab escape 掉——小模型最常見的 JSON 錯誤 */
function escapeRawNewlinesInStrings(s: string): string {
  let out = ''
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (ch === '\\') {
        out += ch + (s[i + 1] ?? '')
        i++
        continue
      }
      if (ch === '"') inStr = false
      else if (ch === '\n') {
        out += '\\n'
        continue
      } else if (ch === '\r') {
        out += '\\r'
        continue
      } else if (ch === '\t') {
        out += '\\t'
        continue
      }
      out += ch
    } else {
      if (ch === '"') inStr = true
      out += ch
    }
  }
  return out
}

function unescapeJsonString(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

/**
 * 模型輸出可能包夾 code fence、前後雜訊、字串內裸換行，甚至 JSON 沒寫完就停，
 * 依序用「直接 parse → 修復後 parse → salvage final 內容」三層寬容度處理。
 */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidates = [text.trim(), fenced?.[1]?.trim()].filter(Boolean) as string[]
  const start = text.indexOf('{')
  if (start >= 0) {
    let depth = 0
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      if (text[i] === '}' && --depth === 0) {
        candidates.push(text.slice(start, i + 1))
        break
      }
    }
  }
  for (const c of candidates) {
    for (const variant of [c, escapeRawNewlinesInStrings(c)]) {
      try {
        const parsed = JSON.parse(variant)
        if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
      } catch {
        // 試下一個候選
      }
    }
  }
  // 長字串常見：內容沒 escape 乾淨或 JSON 沒收尾。針對兩種長內容輸出做 salvage
  const finalSalvage = /^\s*\{\s*"final"\s*:\s*"([\s\S]*)$/.exec(text.trim())
  if (finalSalvage) {
    return { final: unescapeJsonString(finalSalvage[1].replace(/"\s*\}\s*$/, '')) }
  }
  const writeSalvage =
    /"tool"\s*:\s*"(write_note|append_note)"[\s\S]*?"path"\s*:\s*"([^"]+)"[\s\S]*?"content"\s*:\s*"([\s\S]*)$/.exec(
      text
    )
  if (writeSalvage) {
    const content = writeSalvage[3].replace(/"\s*\}\s*\}\s*$/, '')
    return {
      tool: writeSalvage[1],
      args: { path: writeSalvage[2], content: unescapeJsonString(content) }
    }
  }
  return null
}

class AgentService {
  private controllers = new Map<string, AbortController>()
  private pendingWrites = new Map<string, (approved: boolean) => void>()

  async run(sender: WebContents, id: string, task: string): Promise<void> {
    const controller = new AbortController()
    this.controllers.set(id, controller)
    const emit = (step: AgentStep): void => {
      if (!sender.isDestroyed()) sender.send('agent:step', { id, step })
    }
    const messages: OllamaChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: task }
    ]
    try {
      let invalidCount = 0
      for (let step = 0; step < MAX_STEPS; step++) {
        const output = await chatOnce(pruneHistory(messages), controller.signal)
        messages.push({ role: 'assistant', content: output })
        const parsed = extractJson(output)

        if (!parsed) {
          if (++invalidCount >= 2) {
            // 連續 parse 失敗：當成最終回答，不再空轉
            emit({ type: 'final', content: output })
            return
          }
          messages.push({
            role: 'user',
            content:
              '你的輸出不是合法 JSON，剛才的動作「沒有」被執行。請重新輸出一個 JSON 物件：{"tool": ..., "args": ...} 或 {"final": ...}，字串內的換行必須寫成 \\n'
          })
          continue
        }
        invalidCount = 0

        if (typeof parsed.final === 'string') {
          emit({ type: 'final', content: parsed.final })
          return
        }

        const tool = typeof parsed.tool === 'string' ? parsed.tool : ''
        const args = (parsed.args ?? {}) as Record<string, unknown>
        const result = await this.runTool(sender, id, tool, args, controller.signal)
        emit({ type: 'tool', tool, args, result: result.slice(0, 500) })
        messages.push({ role: 'user', content: `${TOOL_RESULT_PREFIX}\n${result}` })
      }
      emit({ type: 'error', message: `超過 ${MAX_STEPS} 步仍未完成，已停止` })
    } catch (err) {
      if (controller.signal.aborted) {
        emit({ type: 'error', message: '已停止' })
      } else {
        emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    } finally {
      this.controllers.delete(id)
    }
  }

  stop(id: string): void {
    this.controllers.get(id)?.abort()
  }

  resolveWrite(requestId: string, approved: boolean): void {
    this.pendingWrites.get(requestId)?.(approved)
    this.pendingWrites.delete(requestId)
  }

  private async runTool(
    sender: WebContents,
    id: string,
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<string> {
    switch (tool) {
      case 'search_notes': {
        const query = String(args.query ?? '')
        if (!query) return '錯誤：缺少 query'
        const results = await indexer.search(query, 8)
        if (results.length === 0) return '沒有找到相關筆記'
        return results
          .map((r) => `- ${r.path}${r.heading ? ' # ' + r.heading : ''}\n  ${r.snippet}`)
          .join('\n')
      }
      case 'list_notes':
        return vault
          .listNotes()
          .map((n) => `- ${n.path}`)
          .join('\n')
      case 'read_note': {
        const path = String(args.path ?? '')
        const doc = await vault.readNote(path)
        if (!doc) return `錯誤：找不到筆記 ${path}`
        return doc.content.length > READ_CAP
          ? doc.content.slice(0, READ_CAP) + '\n…（內容過長已截斷）'
          : doc.content
      }
      case 'write_note': {
        const path = String(args.path ?? '')
        const content = String(args.content ?? '')
        if (!path || !content) return '錯誤：write_note 需要 path 與 content'
        const mode = vault.noteExists(path.endsWith('.md') ? path : `${path}.md`)
          ? 'overwrite'
          : 'create'
        const approved = await this.requestWriteApproval(sender, id, path, content, mode, signal)
        if (!approved) return '使用者拒絕了這次寫入。請尊重這個決定，不要重試相同內容。'
        const written = await vault.writeNote(path, content)
        return `已寫入 ${written}`
      }
      case 'append_note': {
        const path = String(args.path ?? '')
        const content = String(args.content ?? '')
        if (!path || !content) return '錯誤：append_note 需要 path 與 content'
        const approved = await this.requestWriteApproval(
          sender,
          id,
          path,
          content,
          'append',
          signal
        )
        if (!approved) return '使用者拒絕了這次追加。請尊重這個決定，不要重試相同內容。'
        const written = await vault.appendNote(path, content)
        return `已追加至 ${written}`
      }
      default:
        return `錯誤：沒有 ${tool} 這個工具`
    }
  }

  private requestWriteApproval(
    sender: WebContents,
    id: string,
    path: string,
    content: string,
    mode: AgentWriteMode,
    signal: AbortSignal
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = randomUUID()
      this.pendingWrites.set(requestId, resolve)
      signal.addEventListener('abort', () => {
        this.pendingWrites.delete(requestId)
        resolve(false)
      })
      const payload: AgentWriteRequest = { id, requestId, path, content, mode }
      if (sender.isDestroyed()) {
        resolve(false)
        return
      }
      sender.send('agent:write-request', payload)
    })
  }
}

export const agent = new AgentService()
