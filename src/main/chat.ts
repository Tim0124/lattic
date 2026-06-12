import type { WebContents } from 'electron'
import { indexer } from './indexer'
import { OLLAMA_URL, CHAT_MODEL } from './ollama'
import type { ChatMessage, ChatSource } from '../share/types'

const SYSTEM_PROMPT = `你是使用者個人 wiki 的助理，根據檢索到的筆記片段回答問題。
- 回答時優先依據筆記內容，並指出資訊來自哪篇筆記（用筆記標題稱呼）
- 筆記裡沒有的資訊，明確說「筆記裡沒有相關內容」，需要時再以一般知識補充並註明
- 用繁體中文回答，技術術語保留英文`

const TOP_K = 5

class ChatService {
  private controllers = new Map<string, AbortController>()

  /** 檢索 + 串流生成。回覆透過 chat:chunk / chat:done / chat:error 事件推給 renderer */
  async ask(sender: WebContents, id: string, messages: ChatMessage[]): Promise<void> {
    const controller = new AbortController()
    this.controllers.set(id, controller)
    let sources: ChatSource[] = []
    try {
      const question = messages[messages.length - 1]?.content ?? ''
      const chunks = await indexer.retrieve(question, TOP_K)
      sources = chunks.map((c) => ({
        path: c.path,
        title: c.title,
        heading: c.heading,
        score: c.score
      }))
      const context =
        chunks.length > 0
          ? chunks
              .map(
                (c, i) => `【${i + 1}】${c.title}${c.heading ? ' > ' + c.heading : ''}\n${c.text}`
              )
              .join('\n\n')
          : '（沒有檢索到相關筆記）'

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
              content: `${SYSTEM_PROMPT}\n\n以下是檢索到的筆記片段：\n\n${context}`
            },
            ...messages
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
