import { GripVertical } from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function ResizablePanelGroup({
  className,
  ...props
}: ComponentProps<typeof PanelGroup>): React.JSX.Element {
  return <PanelGroup className={cn('flex h-full w-full', className)} {...props} />
}

export const ResizablePanel = Panel

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof PanelResizeHandle> & { withHandle?: boolean }): React.JSX.Element {
  return (
    <PanelResizeHandle
      className={cn(
        'group relative flex w-px items-center justify-center bg-zinc-200 transition-colors',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-1.5 after:-translate-x-1/2',
        'hover:bg-primary data-[resize-handle-state=drag]:bg-primary',
        'dark:bg-zinc-800',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-7 w-3.5 items-center justify-center rounded-sm border border-zinc-200 bg-white opacity-0 transition-opacity group-hover:opacity-100 group-data-[resize-handle-state=drag]:opacity-100 dark:border-zinc-700 dark:bg-zinc-800">
          <GripVertical className="h-3 w-3 text-zinc-400" />
        </div>
      )}
    </PanelResizeHandle>
  )
}
