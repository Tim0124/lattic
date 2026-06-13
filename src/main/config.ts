import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface AppConfig {
  /** vault 根目錄；首次啟動的預設值 */
  vaultPath: string
  /** 問答 / agent 使用的 Ollama 模型 */
  chatModel: string
  /** 向量 embedding 使用的 Ollama 模型 */
  embedModel: string
  /** 問答檢索的 chunk 數 */
  searchTopK: number
}

const DEFAULTS: AppConfig = {
  // 空字串代表「尚未設定」：首次啟動會引導使用者選擇 vault 資料夾
  vaultPath: '',
  chatModel: 'gemma4:e4b',
  embedModel: 'bge-m3',
  searchTopK: 5
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

let cache: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cache) return cache
  try {
    const saved = JSON.parse(readFileSync(configPath(), 'utf-8')) as Partial<AppConfig>
    cache = {
      vaultPath: saved.vaultPath || DEFAULTS.vaultPath,
      chatModel: saved.chatModel || DEFAULTS.chatModel,
      embedModel: saved.embedModel || DEFAULTS.embedModel,
      searchTopK: typeof saved.searchTopK === 'number' ? saved.searchTopK : DEFAULTS.searchTopK
    }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  cache = { ...getConfig(), ...patch }
  writeFileSync(configPath(), JSON.stringify(cache))
  return cache
}

export function setVaultPath(vaultPath: string): void {
  setConfig({ vaultPath })
}
