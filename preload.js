const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('liciStorage', {
  // Lưu / đọc / xóa
  save: (key, value) => ipcRenderer.invoke('save-data', key, value),
  load: (key) => ipcRenderer.invoke('load-data', key),
  remove: (key) => ipcRenderer.invoke('remove-data', key),
  listKeys: () => ipcRenderer.invoke('list-data'),

  // Sao lưu / phục hồi / thư mục
  backup: () => ipcRenderer.invoke('backup-data'),
  restore: () => ipcRenderer.invoke('restore-data'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),

  // Xuất file
  exportPDF: (name) => ipcRenderer.invoke('export-pdf', name),
  exportJSON: (name, data) => ipcRenderer.invoke('export-json', name, data)
});
