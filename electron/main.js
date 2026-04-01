'use strict'
// Aloha from Pearl City! 🌺

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const Store = require('electron-store')
const path  = require('path')
const fs    = require('fs')

const store = new Store({ encryptionKey: 'autoiq-v1-secure' })

let win, tray

const APP = {
  name:        'Auto IQ',
  color:       '#FFB800',
  bgColor:     '#080808',
  width:       1200,
  height:      820,
  minWidth:    900,
  minHeight:   640,
  trayTooltip: 'Auto IQ — AI Vehicle Repair Estimation',
  icon:        path.join(__dirname, '../icons/icon-512.png'),
  trayIcon:    path.join(__dirname, '../icons/icon-192.png'),
}

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus() }
})

function createWindow () {
  win = new BrowserWindow({
    width:     store.get('win.width',  APP.width),
    height:    store.get('win.height', APP.height),
    x:         store.get('win.x'),
    y:         store.get('win.y'),
    minWidth:  APP.minWidth,
    minHeight: APP.minHeight,
    frame:        false,
    backgroundColor: APP.bgColor,
    show: false,
    webPreferences: {
      preload:         path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      webSecurity:      true,
      spellcheck:       false,
    },
    icon: APP.icon,
  })

  win.loadFile(path.join(__dirname, '../index.html'))

  // No white flash
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
    if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify()
  })

  // Persist window state
  const saveState = () => {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isMaximized()) return
    const [w, h] = win.getSize()
    const [x, y] = win.getPosition()
    store.set({ 'win.width': w, 'win.height': h, 'win.x': x, 'win.y': y })
  }
  win.on('resize', saveState)
  win.on('move',   saveState)

  // Hide to tray on close
  win.on('close', e => {
    if (!app.isQuitting) { e.preventDefault(); win.hide() }
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

function createTray () {
  let icon
  try {
    icon = nativeImage.createFromPath(APP.trayIcon).resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip(APP.trayTooltip)

  const menu = Menu.buildFromTemplate([
    { label: '🚗 Auto IQ', enabled: false },
    { type: 'separator' },
    { label: 'Open',         click: () => { win.show(); win.focus() } },
    { label: 'New Estimate', click: () => { win.show(); win.focus(); win.webContents.send('navigate', 'intake') } },
    { label: 'History',     click: () => { win.show(); win.focus(); win.webContents.send('navigate', 'history') } },
    { type: 'separator' },
    { label: 'Quit Auto IQ', click: () => { app.isQuitting = true; app.quit() } },
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', () => { win.show(); win.focus() })
}

// ── IPC handlers ───────────────────────────────────────────

ipcMain.handle('window:minimize',    () => win.minimize())
ipcMain.handle('window:maximize',    () => win.isMaximized() ? win.unmaximize() : win.maximize())
ipcMain.handle('window:close',       () => win.hide())
ipcMain.handle('window:isMaximized', () => win.isMaximized())

ipcMain.handle('notify', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: APP.icon }).show()
  }
})

// Open image file for damage photo upload via Electron dialog
ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    title: 'Select Damage Photo',
  })
  if (result.canceled || !result.filePaths.length) return null
  try {
    const data = fs.readFileSync(result.filePaths[0])
    const ext  = path.extname(result.filePaths[0]).toLowerCase().replace('.', '')
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch { return null }
})

// Save estimate JSON via Electron dialog
ipcMain.handle('dialog:saveEstimate', async (_, { filename, content }) => {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: filename || 'autoiq-estimate.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Save Repair Estimate',
  })
  if (result.canceled) return false
  try { fs.writeFileSync(result.filePath, content, 'utf8'); return true } catch { return false }
})

ipcMain.handle('store:get',    (_, key)        => store.get(key))
ipcMain.handle('store:set',    (_, key, value) => store.set(key, value))
ipcMain.handle('store:delete', (_, key)        => store.delete(key))
ipcMain.handle('store:clear',  ()              => store.clear())

ipcMain.handle('shell:openExternal', (_, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    return shell.openExternal(url)
  }
})

ipcMain.handle('app:version', () => app.getVersion())

// Auto-updater
autoUpdater.on('update-available',  () => { if (win) win.webContents.send('update:available') })
autoUpdater.on('update-downloaded', () => { if (win) win.webContents.send('update:ready') })
ipcMain.handle('update:install', () => { app.isQuitting = true; autoUpdater.quitAndInstall() })

// GPU perf
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')

app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('window-all-closed', e => {
  // Keep alive in tray
  e.preventDefault()
})

app.on('before-quit', () => {
  app.isQuitting = true
})
