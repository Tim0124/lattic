import { getConfig } from './config'
import type { OllamaStatus } from '../share/types'

export const OLLAMA_URL = 'http://localhost:11434'

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 列出本機 Ollama 已安裝的模型名稱 */
export async function listModels(): Promise<string[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`)
  if (!res.ok) throw new Error(`Ollama tags 失敗 (${res.status})`)
  const data = (await res.json()) as { models?: { name: string }[] }
  return (data.models ?? []).map((m) => m.name).sort((a, b) => a.localeCompare(b))
}

/** 判斷某模型是否已安裝（無 tag 的名稱視同 :latest） */
function isInstalled(name: string, installed: string[]): boolean {
  if (installed.includes(name)) return true
  return name.includes(':') ? false : installed.includes(`${name}:latest`)
}

/** 檢查 Ollama 是否在運行、設定的模型是否都已安裝 */
export async function getStatus(): Promise<OllamaStatus> {
  const { chatModel, embedModel } = getConfig()
  try {
    const installed = await listModels()
    return {
      running: true,
      installed,
      chatModel,
      embedModel,
      chatReady: isInstalled(chatModel, installed),
      embedReady: isInstalled(embedModel, installed)
    }
  } catch {
    return {
      running: false,
      installed: [],
      chatModel,
      embedModel,
      chatReady: false,
      embedReady: false
    }
  }
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
      model: getConfig().chatModel,
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
    body: JSON.stringify({ model: getConfig().embedModel, input: inputs })
  })
  if (!res.ok) {
    throw new Error(`Ollama embed 失敗 (${res.status})：${await res.text()}`)
  }
  const data = (await res.json()) as { embeddings: number[][] }
  return data.embeddings
}
