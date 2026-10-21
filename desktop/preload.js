'use strict';
// 웹앱에서 쓸 수 있는 PC 프로그램 기능 (메모 창 열기·닫기, 항상 위 고정)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pocketDesktop', {
  isDesktop: true,
  openNote: (id, opts) => ipcRenderer.invoke('note:open', String(id), opts && typeof opts === 'object' ? { ...opts } : {}),
  closeNote: (id) => ipcRenderer.invoke('note:close', String(id)),
  getOpenNotes: () => ipcRenderer.invoke('note:list'),
  onNotesChanged: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('notes:changed', (_e, ids) => cb(Array.isArray(ids) ? ids.slice() : []));
  },
  getPinned: () => ipcRenderer.invoke('win:getPinned'),
  setPinned: (v) => ipcRenderer.invoke('win:setPinned', !!v),
  setColor: (hex) => ipcRenderer.send('win:setColor', String(hex)),
  close: () => ipcRenderer.send('win:close'),
});
