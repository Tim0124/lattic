import type { WebContents } from 'electron'
import { indexer } from './indexer'
import { OLLAMA_URL, CHAT_MODEL } from './ollama'
import { vault } from './vault'
import type { ChatMessage, ChatSource } from '../share/types'

const SYSTEM_PROMPT = `你是使用者個人 wiki 的助理，根據檢索到的筆記片段回答問題。
- 回答時優先依據筆記內容，並指出資訊來自哪篇筆記（用筆記標題稱呼）
- 筆記裡沒有的資訊，明確說「筆記裡沒有相關內容」，需要時再以一般知識補充並註明
- 用繁體中文回答，技術術語保留英文`

const TOP_K = 5
/** 送進模型的對話歷史字元上限。num_ctx 8192 還要容納 system prompt、檢索片段與輸出 */
const HISTORY_CHAR_BUDGET = 4000
/** 使用者以 `/` 指定引用的筆記，每篇注入的字元上限 */
const REF_CHAR_CAP = 4000
const MAX_REFS = 4

/**
 * 從最新往回保留對話訊息，累積字元超過預算就停，避免長對話塞爆模型 context。
 * 永遠保留最後一則（當前問題）；修剪後若開頭是 assistant 則去掉，維持 user 起頭。
 */
function pruneHistory(messages: ChatMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = []
  let chars = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    chars += messages[i].content.length
    if (i < messages.length - 1 && chars > HISTORY_CHAR_BUDGET) break
    kept.unshift(messages[i])
  }
  if (kept.length > 1 && kept[0].role === 'assistant') kept.shift()
  return kept
}

class ChatService {
  private controllers = new Map<string, AbortController>()

  /** 檢索 + 串流生成。回覆透過 chat:chunk / chat:done / chat:error 事件推給 renderer */
  async ask(
    sender: WebContents,
    id: string,
    messages: ChatMessage[],
    refPaths: string[] = []
  ): Promise<void> {
    const controller = new AbortController()
    this.controllers.set(id, controller)
    let sources: ChatSource[] = []
    try {
      const question = messages[messages.length - 1]?.content ?? ''

      // 使用者以 `/` 明確指定筆記時，只用這些筆記當 context 與來源，跳過籠統的向量檢索
      const refDocs = (
        await Promise.all(refPaths.slice(0, MAX_REFS).map((p) => vault.readNote(p)))
      ).filter((d): d is NonNullable<typeof d> => d !== null)

      let context: string
      if (refDocs.length > 0) {
        context =
          '使用者指定參考的筆記：\n\n' +
          refDocs.map((d) => `《${d.title}》\n${d.content.slice(0, REF_CHAR_CAP)}`).join('\n\n')
        sources = refDocs.map((d) => ({ path: d.path, title: d.title, heading: '', score: 1 }))
      } else {
        const chunks = await indexer.retrieve(question, TOP_K)
        // 來源 chip 依筆記去重（chunks 已按分數排序，每篇保留分數最高的那段）
        const seenPaths = new Set<string>()
        sources = []
        for (const c of chunks) {
          if (seenPaths.has(c.path)) continue
          seenPaths.add(c.path)
          sources.push({ path: c.path, title: c.title, heading: c.heading, score: c.score })
        }
        context =
          chunks.length > 0
            ? '以下是檢索到的筆記片段：\n\n' +
              chunks
                .map(
                  (c, i) => `【${i + 1}】${c.title}${c.heading ? ' > ' + c.heading : ''}\n${c.text}`
                )
                .join('\n\n')
            : '（沒有檢索到相關筆記）'
      }
      const pruned = pruneHistory(messages)

      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          model: CHAT_MODEL,
          stream: true,
          options: { num_ctx: 8192 },
          messages: [
            {
              role: 'system',
              content: `${SYSTEM_PROMPT}\n\n${context}`
            },
            ...pruned
          ]
        })
      })
      if (!res.ok || !res.body) {
        throw new Error(`Ollama chat 失敗 (${res.status})：${await res.text()}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const data = JSON.parse(line) as { message?: { content?: string } }
          const delta = data.message?.content
          if (delta && !sender.isDestroyed()) sender.send('chat:chunk', { id, delta })
        }
      }
      if (!sender.isDestroyed()) sender.send('chat:done', { id, sources })
    } catch (err) {
      if (sender.isDestroyed()) return
      if (controller.signal.aborted) {
        // 使用者主動停止：保留已生成內容，正常收尾
        sender.send('chat:done', { id, sources })
      } else {
        sender.send('chat:error', {
          id,
          message: err instanceof Error ? err.message : String(err)
        })
      }
    } finally {
      this.controllers.delete(id)
    }
  }

  stop(id: string): void {
    this.controllers.get(id)?.abort()
  }
}

export const chat = new ChatService()
