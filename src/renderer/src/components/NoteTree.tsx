import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import type { NoteMeta } from 'src/share/types'
import { cn } from '../lib/utils'

interface FolderNode {
  name: string
  path: string
  folders: FolderNode[]
  notes: NoteMeta[]
}

function buildTree(notes: NoteMeta[]): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: [], notes: [] }
  const folderMap = new Map<string, FolderNode>([['', root]])

  const ensureFolder = (path: string): FolderNode => {
    const existing = folderMap.get(path)
    if (existing) return existing
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    const parent = ensureFolder(parentPath)
    const node: FolderNode = {
      name: path.slice(path.lastIndexOf('/') + 1),
      path,
      folders: [],
      notes: []
    }
    parent.folders.push(node)
    folderMap.set(path, node)
    return node
  }

  for (const note of notes) {
    ensureFolder(note.folder).notes.push(note)
  }
  return root
}

interface NoteTreeProps {
  notes: NoteMeta[]
  selectedPath: string | null
  onSelect: (path: string) => void
}

export function NoteTree({ notes, selectedPath, onSelect }: NoteTreeProps): React.JSX.Element {
  const tree = useMemo(() => buildTree(notes), [notes])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (path: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderFolder = (folder: FolderNode, depth: number): React.JSX.Element[] => {
    const indent = { paddingLeft: `${depth * 14 + 8}px` }
    const items: React.JSX.Element[] = []
    for (const child of folder.folders) {
      const isCollapsed = collapsed.has(child.path)
      const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown
      const FolderIcon = isCollapsed ? Folder : FolderOpen
      items.push(
        <button
          key={child.path}
          style={indent}
          onClick={() => toggle(child.path)}
          className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px] font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ChevronIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
          <span className="truncate">{child.name}</span>
        </button>
      )
      if (!isCollapsed) items.push(...renderFolder(child, depth + 1))
    }
    for (const note of folder.notes) {
      const selected = note.path === selectedPath
      items.push(
        <button
          key={note.path}
          style={indent}
          onClick={() => onSelect(note.path)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px]',
            selected
              ? 'bg-primary-soft text-primary font-medium'
              : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800'
          )}
        >
          <FileText
            className={cn(
              'ml-[18px] h-3.5 w-3.5 shrink-0',
              selected ? 'text-primary' : 'text-zinc-400'
            )}
          />
          <span className="truncate">{note.title}</span>
        </button>
      )
    }
    return items
  }

  return <nav className="flex flex-col gap-px p-2">{renderFolder(tree, 0)}</nav>
}
