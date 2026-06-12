export const OLLAMA_URL = 'http://localhost:11434'

export const EMBED_MODEL = 'bge-m3'
export const CHAT_MODEL = 'gemma4:e4b'

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 非串流的單次生成，agent loop 每回合需要完整輸出才能 parse */
export async function chatOnce(
  messages: OllamaChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    signal,
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: false,
      messages,
      // 預設 num_ctx 4096 會被工具結果塞爆（截掉 system prompt 後模型輸出空字串）
      options: { temperature: 0.2, num_ctx: 8192 }
    })
  })
  if (!res.ok) {
    throw new Error(`Ollama chat 失敗 (${res.status})：${await res.text()}`)
  }
  const data = (await res.json()) as { message: { content: string } }
  return data.message.content
}

export async function embed(inputs: string[]): Promise<number[][]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs })
  })
  if (!res.ok) {
    throw new Error(`Ollama embed 失敗 (${res.status})：${await res.text()}`)
  }
  const data = (await res.json()) as { embeddings: number[][] }
  return data.embeddings
}
