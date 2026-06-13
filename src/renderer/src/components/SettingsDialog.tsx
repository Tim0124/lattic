import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FolderOpen, Monitor, Moon, Sun, X } from 'lucide-react'
import type { AppSettings } from 'src/share/types'
import { PALETTES, type ThemeSettings } from '../lib/theme'
import { cn } from '../lib/utils'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  settings: ThemeSettings
  onChange: (patch: Partial<ThemeSettings>) => void
}

const MODES = [
  { key: 'light', label: '淺色', Icon: Sun },
  { key: 'dark', label: '深色', Icon: Moon },
  { key: 'system', label: '跟隨系統', Icon: Monitor }
] as const

function ModelSelect({
  value,
  models,
  onChange
}: {
  value: string
  models: string[]
  onChange: (v: string) => void
}): React.JSX.Element {
  // 目前選用的模型若不在清單中（已移除或 Ollama 未啟動），仍保留為選項
  const options = models.includes(value) ? models : [value, ...models]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="focus:border-primary max-w-[190px] truncate rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800"
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  )
}

export function SettingsDialog({
  open,
  onClose,
  settings,
  onChange
}: SettingsDialogProps): React.JSX.Element {
  const [vaultPath, setVaultPath] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    if (!open) return
    void window.api.getVaultPath().then(setVaultPath)
    void window.api.getSettings().then(setAppSettings)
    void window.api
      .listModels()
      .then(setModels)
      .catch(() => setModels([]))
  }, [open])

  const updateSettings = (patch: Partial<AppSettings>): void => {
    setAppSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    void window.api.setSettings(patch)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const pickVault = async (): Promise<void> => {
    const picked = await window.api.pickVault()
    if (picked) setVaultPath(picked)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-[420px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">設定</h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-zinc-500">Vault 資料夾</div>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
                <FolderOpen className="h-4 w-4 shrink-0 text-amber-500/80" />
                <span
                  className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300"
                  title={vaultPath}
                  dir="rtl"
                >
                  {vaultPath || '載入中…'}
                </span>
                <button
                  onClick={pickVault}
                  className="bg-primary text-primary-fg shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium hover:opacity-90"
                >
                  變更
                </button>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">變更後會重新掃描並建立索引</p>
            </div>

            {appSettings && (
              <div className="mt-4">
                <div className="text-xs font-medium text-zinc-500">模型與檢索</div>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">
                      問答 / Agent 模型
                    </span>
                    <ModelSelect
                      value={appSettings.chatModel}
                      models={models}
                      onChange={(v) => updateSettings({ chatModel: v })}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">Embedding 模型</span>
                    <ModelSelect
                      value={appSettings.embedModel}
                      models={models}
                      onChange={(v) => updateSettings({ embedModel: v })}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">
                      檢索 chunk 數（top-k）
                    </span>
                    <span className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={appSettings.searchTopK}
                        onChange={(e) => updateSettings({ searchTopK: Number(e.target.value) })}
                        className="accent-primary w-28"
                      />
                      <span className="w-4 text-right text-xs tabular-nums text-zinc-500">
                        {appSettings.searchTopK}
                      </span>
                    </span>
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">更換 Embedding 模型會重建整個索引</p>
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-medium text-zinc-500">外觀</div>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                {MODES.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => onChange({ mode: key })}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors',
                      settings.mode === key
                        ? 'bg-white font-medium text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-zinc-500">主題色</div>
              <div className="mt-3 flex items-center gap-4">
                {PALETTES.map((p) => {
                  const selected = settings.palette === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => onChange({ palette: p.id })}
                      title={p.name}
                      className={cn(
                        'h-12 w-12 rounded-full transition-all hover:scale-105',
                        selected &&
                          'ring-primary ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900'
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})`
                      }}
                    />
                  )
                })}
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-zinc-400">設定即時生效並自動儲存</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
