'use strict'
// preload.js — Auto IQ Electron contextBridge
// Aloha from Pearl City!
// #ASSUMPTION: contextIsolation=true, nodeIntegration=false always

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize:    ()      => ipcRenderer.invoke('window:minimize'),
  maximize:    ()      => ipcRenderer.invoke('window:maximize'),
  close:       ()      => ipcRenderer.invoke('window:close'),
  isMaximized: ()      => ipcRenderer.invoke('window:isMaximized'),

  // Notifications
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),

  // File dialogs
  openImage:     ()                      => ipcRenderer.invoke('dialog:openImage'),
  saveEstimate:  (filename, content)     => ipcRenderer.invoke('dialog:saveEstimate', { filename, content }),

  // Persistent store (encrypted)
  storeGet:    key         => ipcRenderer.invoke('store:get', key),
  storeSet:    (key, val)  => ipcRenderer.invoke('store:set', key, val),
  storeDelete: key         => ipcRenderer.invoke('store:delete', key),
  storeClear:  ()          => ipcRenderer.invoke('store:clear'),

  // External links
  openExternal: url => ipcRenderer.invoke('shell:openExternal', url),

  // App version
  version: () => ipcRenderer.invoke('app:version'),

  // Auto-update
  onUpdateAvailable: cb => ipcRenderer.on('update:available', cb),
  onUpdateReady:     cb => ipcRenderer.on('update:ready',     cb),
  installUpdate:     ()  => ipcRenderer.invoke('update:install'),

  // Navigation from tray menu
  onNavigate: cb => ipcRenderer.on('navigate', (_, screen) => cb(screen)),
})
