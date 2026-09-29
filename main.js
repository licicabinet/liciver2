const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== Thư mục lưu dữ liệu =====
// Windows: C:\Users\<Tên>\AppData\Roaming\lici-kitchen\data\
const DATA_DIR = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    title: 'TỦ BẾP INOX LICI — Tính giá & Báo giá',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Cho phép in PDF
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ============================================================
   IPC — Lưu / đọc / sao lưu / phục hồi dữ liệu
   ============================================================ */

// Ghi 1 key vào file JSON
ipcMain.handle('save-data', async (event, key, value) => {
  try {
    const safeKey = String(key).replace(/[^a-z0-9_\-]/gi, '_');
    const file = path.join(DATA_DIR, safeKey + '.json');
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf-8');
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Đọc 1 key
ipcMain.handle('load-data', async (event, key) => {
  try {
    const safeKey = String(key).replace(/[^a-z0-9_\-]/gi, '_');
    const file = path.join(DATA_DIR, safeKey + '.json');
    if (!fs.existsSync(file)) return { ok: true, data: null };
    const raw = fs.readFileSync(file, 'utf-8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Xóa 1 key
ipcMain.handle('remove-data', async (event, key) => {
  try {
    const safeKey = String(key).replace(/[^a-z0-9_\-]/gi, '_');
    const file = path.join(DATA_DIR, safeKey + '.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Liệt kê toàn bộ key đã lưu
ipcMain.handle('list-data', async () => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    return { ok: true, keys: files.map(f => f.replace('.json', '')) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Sao lưu toàn bộ ra 1 file
ipcMain.handle('backup-data', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Sao lưu toàn bộ dữ liệu LICI',
    defaultPath: `LICI_backup_${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Backup', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    const all = { _meta: { exportedAt: new Date().toISOString(), version: app.getVersion() } };
    fs.readdirSync(DATA_DIR).forEach(f => {
      if (f.endsWith('.json')) {
        const key = f.replace('.json', '');
        try {
          all[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
        } catch (e) {}
      }
    });
    fs.writeFileSync(filePath, JSON.stringify(all, null, 2), 'utf-8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Phục hồi từ file backup
ipcMain.handle('restore-data', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn file sao lưu để phục hồi',
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };

  try {
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const data = JSON.parse(raw);
    let count = 0;
    Object.keys(data).forEach(key => {
      if (key === '_meta') return;
      const safeKey = key.replace(/[^a-z0-9_\-]/gi, '_');
      fs.writeFileSync(
        path.join(DATA_DIR, safeKey + '.json'),
        JSON.stringify(data[key], null, 2),
        'utf-8'
      );
      count++;
    });
    return { ok: true, count, needRestart: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Mở thư mục dữ liệu bằng Explorer
ipcMain.handle('open-data-folder', async () => {
  try {
    await shell.openPath(DATA_DIR);
    return { ok: true, path: DATA_DIR };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Trả về đường dẫn thư mục dữ liệu
ipcMain.handle('get-data-path', () => {
  return { ok: true, path: DATA_DIR };
});

// Xuất PDF (dùng printToPDF của Electron — nét hơn in trình duyệt)
ipcMain.handle('export-pdf', async (event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Lưu báo giá PDF',
    defaultPath: defaultName || `BaoGia_LICI_${Date.now()}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    const pdf = await mainWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    });
    fs.writeFileSync(filePath, pdf);
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Xuất JSON đơn hàng hiện tại
ipcMain.handle('export-json', async (event, defaultName, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Lưu dữ liệu JSON',
    defaultPath: defaultName || `LICI_${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
