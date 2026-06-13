import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/** 首次啟動、尚未設定過 vault 時的預設路徑 */
const DEFAULT_VAULT_PATH = ''

interface AppConfig {
  vaultPath: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

let cache: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cache) return cache
  try {
    const saved = JSON.parse(readFileSync(configPath(), 'utf-8')) as Partial<AppConfig>
    cache = { vaultPath: saved.vaultPath || DEFAULT_VAULT_PATH }
  } catch {
    cache = { vaultPath: DEFAULT_VAULT_PATH }
  }
  return cache
}

export function setVaultPath(vaultPath: string): void {
  cache = { ...getConfig(), vaultPath }
  writeFileSync(configPath(), JSON.stringify(cache))
}
