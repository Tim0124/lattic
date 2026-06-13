import { FileText, Globe, Image, X } from 'lucide-react'
import type { VaultFile, VaultFileKind } from 'src/share/types'
import { cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'

const KIND_ICONS: Record<VaultFileKind, typeof FileText> = {
  note: FileText,
  image: Image,
  html: Globe
}

interface TabBarProps {
  tabs: VaultFile[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function TabBar({ tabs, activePath, onSelect, onClose }: TabBarProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className="flex h-11 shrink-0 items-stretch overflow-x-auto border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      {tabs.map((tab) => {
        const active = tab.path === activePath
        const Icon = KIND_ICONS[tab.kind]
        return (
          <div
            key={tab.path}
            onClick={() => onSelect(tab.path)}
            title={tab.path}
            className={cn(
              'group flex max-w-[200px] shrink-0 cursor-pointer items-center gap-1.5 border-r border-zinc-200 px-3 text-[13px] dark:border-zinc-800',
              active
                ? 'bg-white font-medium text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            )}
          >
            <Icon
              className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-zinc-400')}
            />
            <span className="truncate">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.path)
              }}
              title={t('tab.close')}
              className="ml-1 shrink-0 rounded p-0.5 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
