import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Globe, Image } from 'lucide-react'
import type { VaultFile, VaultFileKind } from 'src/share/types'
import { cn } from '../lib/utils'

const FILE_ICONS: Record<VaultFileKind, typeof FileText> = {
  note: FileText,
  image: Image,
  html: Globe
}

interface FolderNode {
  name: string
  path: string
  folders: FolderNode[]
  files: VaultFile[]
}

function buildTree(files: VaultFile[]): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: [], files: [] }
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
      files: []
    }
    parent.folders.push(node)
    folderMap.set(path, node)
    return node
  }

  for (const file of files) {
    ensureFolder(file.folder).files.push(file)
  }
  return root
}

interface NoteTreeProps {
  files: VaultFile[]
  selectedPath: string | null
  onSelect: (path: string) => void
}

export function NoteTree({ files, selectedPath, onSelect }: NoteTreeProps): React.JSX.Element {
  const tree = useMemo(() => buildTree(files), [files])
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
    for (const file of folder.files) {
      const selected = file.path === selectedPath
      const FileIcon = FILE_ICONS[file.kind]
      items.push(
        <button
          key={file.path}
          style={indent}
          onClick={() => onSelect(file.path)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px]',
            selected
              ? 'bg-primary-soft text-primary font-medium'
              : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800'
          )}
        >
          <FileIcon
            className={cn(
              'ml-[18px] h-3.5 w-3.5 shrink-0',
              selected ? 'text-primary' : 'text-zinc-400'
            )}
          />
          <span className="truncate">{file.title}</span>
        </button>
      )
    }
    return items
  }

  return <nav className="flex flex-col gap-px p-2">{renderFolder(tree, 0)}</nav>
}
