import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { vault } from './vault'
import { indexer } from './indexer'
import { chat } from './chat'
import { agent } from './agent'
import type { ChatMessage } from '../share/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // vault:// 提供筆記內的圖片等附件，路徑解析限制在 vault 目錄內
  protocol.handle('vault', (request) => {
    const relPath = decodeURIComponent(request.url.slice('vault://'.length))
    const abs = vault.toAbsolute(relPath)
    if (!abs) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(abs).toString())
  })

  await vault.init()

  vault.onChange(() => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('vault:changed')
    })
    void indexer.sync()
  })

  indexer.onStatus((status) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('index:status', status)
    })
  })
  void indexer.init()

  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('vault:list', () => vault.listNotes())
  ipcMain.handle('vault:read', (_event, relPath: string) => vault.readNote(relPath))
  ipcMain.handle('search:query', (_event, query: string, k?: number) => indexer.search(query, k))
  ipcMain.handle('index:status', () => indexer.getStatus())
  ipcMain.handle('chat:ask', (event, id: string, messages: ChatMessage[]) => {
    void chat.ask(event.sender, id, messages)
  })
  ipcMain.handle('chat:stop', (_event, id: string) => chat.stop(id))
  ipcMain.handle('agent:run', (event, id: string, task: string) => {
    void agent.run(event.sender, id, task)
  })
  ipcMain.handle('agent:stop', (_event, id: string) => agent.stop(id))
  ipcMain.handle('agent:resolve-write', (_event, requestId: string, approved: boolean) =>
    agent.resolveWrite(requestId, approved)
  )

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
