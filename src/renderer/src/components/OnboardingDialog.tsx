import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import type { OllamaStatus } from 'src/share/types'
import { useI18n } from '../lib/i18n'

interface OnboardingDialogProps {
  status: OllamaStatus
  onRecheck: () => Promise<void>
  onDismiss: () => void
}

function CommandRow({ cmd }: { cmd: string }): React.JSX.Element {
  return (
    <code className="block rounded-md bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-100 dark:bg-zinc-800">
      {cmd}
    </code>
  )
}

export function OnboardingDialog({
  status,
  onRecheck,
  onDismiss
}: OnboardingDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [checking, setChecking] = useState(false)

  const recheck = async (): Promise<void> => {
    setChecking(true)
    try {
      await onRecheck()
    } finally {
      setChecking(false)
    }
  }

  const missing: { label: string; model: string }[] = []
  if (status.running && !status.chatReady)
    missing.push({ label: t('onboarding.chatModel'), model: status.chatModel })
  if (status.running && !status.embedReady)
    missing.push({ label: t('onboarding.embedModel'), model: status.embedModel })

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-[460px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </span>
            <h2 className="text-base font-semibold">{t('onboarding.title')}</h2>
          </div>

          {!status.running ? (
            <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <p>{t('onboarding.notRunning')}</p>
              <CommandRow cmd="brew install ollama" />
              <CommandRow cmd="ollama serve" />
              <p>{t('onboarding.thenPull')}</p>
              <CommandRow cmd={`ollama pull ${status.chatModel}`} />
              <CommandRow cmd={`ollama pull ${status.embedModel}`} />
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t('onboarding.runningButMissing')}
              </p>
              {missing.map((m) => (
                <div key={m.model}>
                  <div className="mb-1 text-xs text-zinc-400">{m.label}</div>
                  <CommandRow cmd={`ollama pull ${m.model}`} />
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-zinc-400">{t('onboarding.footer')}</p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onDismiss}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {t('onboarding.skip')}
            </button>
            <button
              onClick={recheck}
              disabled={checking}
              className="bg-primary text-primary-fg flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t('onboarding.recheck')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
