import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  VaultFile,
  NoteDoc,
  SearchResult,
  IndexStatus,
  ChatMessage,
  ChatChunkEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  AgentStepEvent,
  AgentWriteRequest
} from '../share/types'

function subscribe<T>(channel: string): (cb: (payload: T) => void) => () => void {
  return (cb) => {
    const listener = (_e: unknown, payload: T): void => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  listFiles: (): Promise<VaultFile[]> => ipcRenderer.invoke('vault:files'),
  getVaultPath: (): Promise<string> => ipcRenderer.invoke('config:get-vault-path'),
  pickVault: (): Promise<string | null> => ipcRenderer.invoke('config:pick-vault'),
  readNote: (relPath: string): Promise<NoteDoc | null> => ipcRenderer.invoke('vault:read', relPath),
  search: (query: string, k?: number): Promise<SearchResult[]> =>
    ipcRenderer.invoke('search:query', query, k),
  getIndexStatus: (): Promise<IndexStatus> => ipcRenderer.invoke('index:status'),
  rebuildIndex: (): Promise<void> => ipcRenderer.invoke('index:rebuild'),
  chatAsk: (id: string, messages: ChatMessage[]): Promise<void> =>
    ipcRenderer.invoke('chat:ask', id, messages),
  chatStop: (id: string): Promise<void> => ipcRenderer.invoke('chat:stop', id),
  onVaultChanged: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('vault:changed', listener)
    return () => ipcRenderer.removeListener('vault:changed', listener)
  },
  onIndexStatus: subscribe<IndexStatus>('index:status'),
  onCloseTabShortcut: subscribe<void>('shortcut:close-tab'),
  onChatChunk: subscribe<ChatChunkEvent>('chat:chunk'),
  onChatDone: subscribe<ChatDoneEvent>('chat:done'),
  onChatError: subscribe<ChatErrorEvent>('chat:error'),
  agentRun: (id: string, task: string): Promise<void> => ipcRenderer.invoke('agent:run', id, task),
  agentStop: (id: string): Promise<void> => ipcRenderer.invoke('agent:stop', id),
  agentResolveWrite: (requestId: string, approved: boolean): Promise<void> =>
    ipcRenderer.invoke('agent:resolve-write', requestId, approved),
  onAgentStep: subscribe<AgentStepEvent>('agent:step'),
  onAgentWriteRequest: subscribe<AgentWriteRequest>('agent:write-request')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
