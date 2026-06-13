import { app, shell, BrowserWindow, dialog, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { vault } from './vault'
import { indexer } from './indexer'
import { chat } from './chat'
import { agent } from './agent'
import { getConfig, setVaultPath } from './config'
import type { ChatMessage } from '../share/types'

// 必須在 app ready 前註冊：standard 讓 vault:// 的 URL 解析與子資源
// 相對路徑行為跟 http 一致，secure 避免被視為不安全內容而擋下
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vault',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

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

  // Cmd/Ctrl+W 關閉目前分頁，而非關閉視窗。
  // 在 main 攔截才能同時擋掉系統選單的 Close Window 快捷鍵
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      (input.meta || input.control) &&
      input.key.toLowerCase() === 'w'
    ) {
      event.preventDefault()
      mainWindow.webContents.send('shortcut:close-tab')
    }
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

  // vault:// 提供筆記內的圖片、HTML 等附件，路徑解析限制在 vault 目錄內。
  // URL 格式為 vault://media/<路徑>：standard scheme 會解析並小寫化 host，
  // 用固定的假 host 墊著，實際路徑放 pathname 以保留大小寫
  protocol.handle('vault', (request) => {
    const { pathname } = new URL(request.url)
    const relPath = decodeURIComponent(pathname.slice(1))
    const abs = vault.toAbsolute(relPath)
    if (!abs) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(abs).toString())
  })

  await vault.init(getConfig().vaultPath)

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
  ipcMain.handle('config:get-vault-path', () => vault.getRoot())
  ipcMain.handle('config:pick-vault', async () => {
    const result = await dialog.showOpenDialog({
      title: '選擇 vault 資料夾',
      properties: ['openDirectory'],
      defaultPath: vault.getRoot()
    })
    const picked = result.filePaths[0]
    if (result.canceled || !picked) return null
    setVaultPath(picked)
    await vault.setRoot(picked)
    return picked
  })
  ipcMain.handle('vault:files', () => vault.listFiles())
  ipcMain.handle('vault:read', (_event, relPath: string) => vault.readNote(relPath))
  ipcMain.handle('search:query', (_event, query: string, k?: number) => indexer.search(query, k))
  ipcMain.handle('index:status', () => indexer.getStatus())
  ipcMain.handle('index:rebuild', () => indexer.rebuild())
  ipcMain.handle('chat:ask', (event, id: string, messages: ChatMessage[], refPaths?: string[]) => {
    void chat.ask(event.sender, id, messages, refPaths)
  })
  ipcMain.handle('chat:stop', (_event, id: string) => chat.stop(id))
  ipcMain.handle('agent:run', (event, id: string, task: string, refPaths?: string[]) => {
    void agent.run(event.sender, id, task, refPaths)
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
