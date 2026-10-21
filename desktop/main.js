'use strict';
/*
 * 포켓 메모 for Windows
 * 웹앱(moonoverlap.github.io/memo)을 그대로 띄우고, 메모마다 따로 스티커 창을 만들어
 * 📌로 다른 프로그램 위에 항상 떠 있게 한다. 메모 내용·동기화는 웹앱(Firebase)이 맡는다.
 */
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// 개발 중에만 다른 주소로 시험할 수 있게 (설치본에서는 무시)
const DEV_URL = !app.isPackaged && process.env.POCKET_MEMO_URL;
const APP_URL = DEV_URL || 'https://moonoverlap.github.io/memo/';
const APP_ORIGIN = new URL(APP_URL).origin;
if (!app.isPackaged && process.env.POCKET_MEMO_USERDATA) app.setPath('userData', process.env.POCKET_MEMO_USERDATA);
const ICON = path.join(__dirname, 'assets', 'icon.ico');
const PRELOAD = path.join(__dirname, 'preload.js');
const NOTE_MIN = { w: 160, h: 110 };
const HEX = /^#[0-9a-fA-F]{6}$/;
const NOTE_ID = /^[A-Za-z0-9_-]{1,128}$/;

app.setAppUserModelId('com.moonoverlap.pocketmemo');

let mainWin = null;
let tray = null;
let quitting = false;
const notes = new Map(); // 메모 id → 스티커 창

/* ── 창 상태 저장 (위치·크기·고정·열림) ── */
let state = { main: null, notes: {} };
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (s && typeof s === 'object') state = { main: s.main || null, notes: s.notes && typeof s.notes === 'object' ? s.notes : {} };
  } catch (e) { /* 처음 실행 */ }
}
let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer);
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch (e) { /* 다음에 다시 저장 */ }
}
function saveState() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }

/* ── 주소 확인 ── */
function isAppUrl(u) {
  try {
    const x = new URL(u);
    return x.origin === APP_ORIGIN && (x.pathname === '/memo' || x.pathname.startsWith('/memo/'));
  } catch (e) { return false; }
}
const fromApp = (e) => !!(e.senderFrame && isAppUrl(e.senderFrame.url));
const isWeb = (u) => /^https?:\/\//i.test(u);

function onScreen(b) {
  if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40;
  });
}
const clamp = (v, min, max, d) => (Number.isFinite(Number(v)) ? Math.round(Math.min(max, Math.max(min, Number(v)))) : d);

function offlinePage(target) {
  const html = '<!doctype html><meta charset="utf-8"><title>포켓 메모</title>'
    + '<body style="margin:0;height:100vh;display:grid;place-items:center;background:#FFF4A8;color:#2A2718;'
    + 'font-family:\'Malgun Gothic\',sans-serif;text-align:center;-webkit-app-region:drag">'
    + '<div><p style="margin:0 0 12px;font-size:14px">인터넷에 연결되지 않았어요.</p>'
    + '<button style="-webkit-app-region:no-drag;border:0;border-radius:8px;padding:8px 14px;background:#295BFF;color:#fff;font:inherit;cursor:pointer" '
    + 'onclick="location.href=' + JSON.stringify(target).replace(/"/g, '&quot;') + '">다시 시도</button>'
    + '<button style="-webkit-app-region:no-drag;margin-left:6px;border:0;border-radius:8px;padding:8px 14px;background:rgba(0,0,0,.08);font:inherit;cursor:pointer" onclick="window.close()">닫기</button>'
    + '</div></body>';
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

/* ── 모든 창 공통: 링크는 기본 브라우저로, 메모 새 창은 스티커 창으로 ── */
function wire(win, url) {
  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url: u }) => {
    if (isAppUrl(u)) {
      const id = new URL(u).searchParams.get('note');
      if (id) openNote(id, {});
      return { action: 'deny' };
    }
    if (isWeb(u)) shell.openExternal(u);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, u) => {
    if (isAppUrl(u)) return;
    e.preventDefault();
    if (isWeb(u)) shell.openExternal(u);
  });
  wc.on('did-fail-load', (_e, code, _desc, failedUrl, isMain) => {
    if (isMain && code !== -3 && isAppUrl(failedUrl)) wc.loadURL(offlinePage(url));
  });
  // 오른쪽 클릭: 잘라내기·복사·붙여넣기
  wc.on('context-menu', (_e, p) => {
    const items = [];
    if (p.isEditable) {
      items.push(
        { label: '실행 취소', role: 'undo', enabled: p.editFlags.canUndo },
        { label: '다시 실행', role: 'redo', enabled: p.editFlags.canRedo },
        { type: 'separator' },
        { label: '잘라내기', role: 'cut', enabled: p.editFlags.canCut },
        { label: '복사', role: 'copy', enabled: p.editFlags.canCopy },
        { label: '붙여넣기', role: 'paste', enabled: p.editFlags.canPaste },
        { type: 'separator' },
        { label: '모두 선택', role: 'selectAll' },
      );
    } else if (p.selectionText) {
      items.push({ label: '복사', role: 'copy' });
    }
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  win.on('session-end', () => { quitting = true; saveNow(); });
  // 혹시 첫 화면이 늦으면 그래도 보여주기
  setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) win.show(); }, 5000);
}

const webPrefs = () => ({ preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false });

/* ── 메모 목록 창 ── */
function showMain() {
  if (mainWin && !mainWin.isDestroyed()) {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show(); mainWin.focus();
    return;
  }
  const m = state.main || {};
  const width = clamp(m.width, 320, 4000, 1100);
  const height = clamp(m.height, 360, 3000, 760);
  const pos = onScreen({ x: m.x, y: m.y, width, height }) ? { x: m.x, y: m.y } : {};
  mainWin = new BrowserWindow({
    width, height, ...pos, minWidth: 320, minHeight: 360, show: false,
    backgroundColor: '#F4F6FB', icon: ICON, title: '포켓 메모', autoHideMenuBar: true, webPreferences: webPrefs(),
  });
  mainWin.removeMenu();
  if (m.maximized) mainWin.maximize();
  wire(mainWin, APP_URL);
  mainWin.loadURL(APP_URL);
  mainWin.once('ready-to-show', () => mainWin && mainWin.show());
  const remember = () => {
    if (!mainWin || mainWin.isDestroyed()) return;
    state.main = { ...mainWin.getNormalBounds(), maximized: mainWin.isMaximized() };
    saveState();
  };
  ['resize', 'move', 'maximize', 'unmaximize'].forEach((ev) => mainWin.on(ev, remember));
  mainWin.webContents.on('did-finish-load', sendOpenNotes);
  mainWin.on('closed', () => { mainWin = null; });
}

/* ── 메모 스티커 창 ── */
function openNote(id, opts) {
  if (typeof id !== 'string' || !NOTE_ID.test(id)) return false;
  opts = opts && typeof opts === 'object' ? opts : {};
  const ex = notes.get(id);
  if (ex && !ex.isDestroyed()) {
    if (ex.isMinimized()) ex.restore();
    ex.show(); ex.focus();
    return true;
  }
  const saved = state.notes[id] || {};
  const width = clamp(saved.width != null ? saved.width : opts.w, NOTE_MIN.w, 1600, 300);
  const height = clamp(saved.height != null ? saved.height : opts.h, NOTE_MIN.h, 1200, 360);
  let x = saved.x, y = saved.y;
  if (!onScreen({ x, y, width, height })) {
    // 새 메모는 화면 오른쪽 위부터 조금씩 비켜서 놓기
    const a = screen.getPrimaryDisplay().workArea;
    const k = notes.size % 8;
    x = a.x + a.width - width - 24 - k * 28;
    y = a.y + 24 + k * 28;
  }
  const pinned = typeof saved.pinned === 'boolean' ? saved.pinned : opts.pinned !== false;
  const bg = HEX.test(saved.bg || '') ? saved.bg : (HEX.test(opts.bg || '') ? opts.bg : '#FFF4A8');

  const win = new BrowserWindow({
    width, height, x, y, minWidth: NOTE_MIN.w, minHeight: NOTE_MIN.h,
    frame: false, show: false, backgroundColor: bg, icon: ICON, title: '포켓 메모',
    alwaysOnTop: pinned, webPreferences: webPrefs(),
  });
  if (pinned) win.setAlwaysOnTop(true, 'floating');
  notes.set(id, win);
  state.notes[id] = { ...saved, x, y, width, height, pinned, bg, open: true };
  saveState();
  sendOpenNotes();

  const url = APP_URL + '?note=' + encodeURIComponent(id);
  wire(win, url);
  win.loadURL(url);
  win.once('ready-to-show', () => win.show());
  const remember = () => {
    if (win.isDestroyed() || !state.notes[id]) return;
    const b = win.getBounds();
    Object.assign(state.notes[id], { x: b.x, y: b.y, width: b.width, height: b.height });
    saveState();
  };
  win.on('move', remember);
  win.on('resize', remember);
  win.on('closed', () => {
    notes.delete(id);
    if (!quitting && state.notes[id]) { state.notes[id].open = false; saveState(); }
    sendOpenNotes();
  });
  return true;
}

function idOf(w) { for (const [id, x] of notes) if (x === w) return id; return null; }
function sendOpenNotes() {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('notes:changed', [...notes.keys()]);
}
function bringNotesFront() {
  notes.forEach((w) => { if (!w.isDestroyed()) { if (w.isMinimized()) w.restore(); w.show(); } });
}

/* ── 웹앱 ↔ 프로그램 연결 ── */
ipcMain.handle('note:open', (e, id, opts) => (fromApp(e) ? openNote(id, opts) : false));
ipcMain.handle('note:close', (e, id) => {
  if (!fromApp(e)) return false;
  const w = notes.get(id);
  if (w && !w.isDestroyed()) w.close();
  return true;
});
ipcMain.handle('note:list', (e) => (fromApp(e) ? [...notes.keys()] : []));
ipcMain.handle('win:getPinned', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  return !!(w && w.isAlwaysOnTop());
});
ipcMain.handle('win:setPinned', (e, v) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || !fromApp(e)) return false;
  w.setAlwaysOnTop(!!v, 'floating');
  const id = idOf(w);
  if (id && state.notes[id]) { state.notes[id].pinned = !!v; saveState(); }
  return w.isAlwaysOnTop();
});
ipcMain.on('win:setColor', (e, hex) => {
  if (!fromApp(e) || !HEX.test(String(hex))) return;
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  w.setBackgroundColor(hex);
  const id = idOf(w);
  if (id && state.notes[id]) { state.notes[id].bg = hex; saveState(); }
});
ipcMain.on('win:close', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w && fromApp(e)) w.close();
});

/* ── 트레이 아이콘 ── */
function buildTray() {
  tray = new Tray(ICON);
  tray.setToolTip('포켓 메모');
  const menu = () => Menu.buildFromTemplate([
    { label: '메모 목록 열기', click: showMain },
    { label: '띄운 메모 모두 앞으로', enabled: notes.size > 0, click: bringNotesFront },
    { type: 'separator' },
    {
      label: 'Windows 시작 시 실행', type: 'checkbox',
      checked: app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
    },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.on('click', showMain);
  tray.on('right-click', () => tray.popUpContextMenu(menu()));
}

/* ── 시작 ── */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
  app.on('before-quit', () => { quitting = true; saveNow(); });
  app.on('window-all-closed', () => { saveNow(); app.quit(); });
  app.whenReady().then(() => {
    loadState();
    if (process.platform === 'win32') buildTray();
    const startHidden = process.argv.includes('--hidden');
    Object.keys(state.notes)
      .filter((id) => state.notes[id] && state.notes[id].open)
      .forEach((id) => openNote(id, {}));
    if (!startHidden) showMain();
  });
}
