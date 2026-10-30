// MB World Editor — versión de PC (Electron)
//
// Cómo funciona:
//  • La ventana abre la página de siempre (https://crys1534.github.io/MB-World-Editor/).
//    Así, con internet, el programa siempre tiene la versión más nueva del editor, sin reinstalar nada.
//  • Cada archivo de la página que llega se guarda en una copia local. Sin internet, el programa usa esa
//    copia (y si todavía no hay ninguna, la que viene dentro del instalador). La dirección es la misma
//    en los dos casos, así que los mundos guardados, el perfil y los ajustes nunca se pierden ni se separan.
//  • Doble clic en un archivo .mbw → se abre en el editor (si el programa ya está abierto, en una pestaña nueva).

const { app, BrowserWindow, protocol, net, shell, ipcMain, dialog, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SITE_ORIGIN = 'https://crys1534.github.io';
const SITE_PATH = '/MB-World-Editor/';
const SITE = SITE_ORIGIN + SITE_PATH;
const START_URL = SITE + 'index.html';
const RELEASES_API = 'https://api.github.com/repos/Crys1534/MB-World-Editor/releases/latest';
const RELEASES_PAGE = 'https://github.com/Crys1534/MB-World-Editor/releases/latest';

// Servidores cuyos archivos se guardan para usarlos sin internet (la página y sus librerías)
const CACHE_HOSTS = new Set(['crys1534.github.io', 'www.gstatic.com', 'unpkg.com', 'cdnjs.cloudflare.com']);

const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'build');
const BUNDLED_SITE = path.join(RES, 'site');
const BUNDLED_VENDOR = path.join(RES, 'vendor');

const MIME = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mbw': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

// Para las pruebas: MBW_OFFLINE=1 hace como si no hubiera internet
const FORCE_OFFLINE = process.env.MBW_OFFLINE === '1';

if (process.env.MBW_USER_DATA) app.setPath('userData', process.env.MBW_USER_DATA);   // (para las pruebas)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();   // ya hay uno abierto: él abre el archivo (ver 'second-instance')

let win = null;
let cacheDir = null;
const pendingFiles = new Map();   // id → { name, text }
let nextFileId = 1;
let pageReady = false;
const queuedPaths = [];

// ------------------------------------------------------------------ copia local ("caché")
function cacheKey(url) { return crypto.createHash('sha1').update(url).digest('hex'); }

function isCacheable(u) {
    if (!CACHE_HOSTS.has(u.hostname)) return false;
    if (u.hostname === 'crys1534.github.io') return u.pathname.startsWith(SITE_PATH);
    return true;
}

function bundledPathFor(u) {
    let rel;
    if (u.hostname === 'crys1534.github.io') {
        rel = decodeURIComponent(u.pathname.slice(SITE_PATH.length));
        if (!rel || rel.endsWith('/')) rel += 'index.html';
        return safeJoin(BUNDLED_SITE, rel);
    }
    rel = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    return safeJoin(path.join(BUNDLED_VENDOR, u.hostname), rel);
}

function safeJoin(base, rel) {
    const p = path.normalize(path.join(base, rel));
    return p.startsWith(base) ? p : null;
}

function mimeFor(p) { return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'; }

function readCached(url) {
    try {
        const k = cacheKey(url);
        const meta = JSON.parse(fs.readFileSync(path.join(cacheDir, k + '.json'), 'utf8'));
        const body = fs.readFileSync(path.join(cacheDir, k + '.bin'));
        return { body, type: meta.type };
    } catch (e) { return null; }
}

function writeCached(url, body, type) {
    const k = cacheKey(url);
    const tmp = path.join(cacheDir, k + '.tmp');
    fs.promises.writeFile(tmp, body)
        .then(() => fs.promises.rename(tmp, path.join(cacheDir, k + '.bin')))
        .then(() => fs.promises.writeFile(path.join(cacheDir, k + '.json'), JSON.stringify({ url, type, time: Date.now() })))
        .catch(() => { /* sin espacio o sin permiso: no pasa nada, solo no se guarda */ });
}

function offlineResponse(u) {
    // 1) la copia guardada la última vez que hubo internet
    let hit = readCached(u.href);
    if (!hit && u.search) hit = readCached(u.origin + u.pathname);
    if (hit) return new Response(hit.body, { status: 200, headers: { 'content-type': hit.type || mimeFor(u.pathname), 'x-mbw-source': 'cache' } });
    // 2) la copia que viene dentro del instalador
    const p = bundledPathFor(u);
    if (p) {
        try {
            const body = fs.readFileSync(p);
            return new Response(body, { status: 200, headers: { 'content-type': mimeFor(p), 'x-mbw-source': 'bundled' } });
        } catch (e) { /* no viene incluido */ }
    }
    return null;
}

function cleanHeaders(h) {
    const out = new Headers();
    h.forEach((v, k) => {
        const key = k.toLowerCase();
        if (key === 'content-encoding' || key === 'content-length' || key === 'transfer-encoding' || key === 'set-cookie') return;
        out.append(k, v);
    });
    out.set('x-mbw-source', 'network');
    return out;
}

async function fetchWithTimeout(url, headers, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await net.fetch(url, { headers, signal: ctrl.signal, cache: 'no-cache', bypassCustomProtocolHandlers: true });
    } finally { clearTimeout(t); }
}

async function handleHttps(req) {
    let u;
    try { u = new URL(req.url); } catch (e) { return net.fetch(req, { bypassCustomProtocolHandlers: true }); }
    const cacheable = req.method === 'GET' && isCacheable(u);
    const isRange = !!req.headers.get('range');

    if (!cacheable || isRange) {
        if (FORCE_OFFLINE && cacheable) { const r = offlineResponse(u); if (r) return r; return Response.error(); }
        if (FORCE_OFFLINE) return Response.error();
        try { return await net.fetch(req, { bypassCustomProtocolHandlers: true }); }
        catch (e) {
            if (cacheable) { const r = offlineResponse(u); if (r) return r; }
            throw e;
        }
    }

    // Archivo de la página o de sus librerías: primero internet (lo más nuevo), si no, la copia local
    let resp = null;
    if (!FORCE_OFFLINE) {
        const headers = {};
        req.headers.forEach((v, k) => { if (!/^(range|if-none-match|if-modified-since)$/i.test(k)) headers[k] = v; });
        const isDoc = req.destination === 'document' || /\.html?$/i.test(u.pathname) || u.pathname.endsWith('/');
        try { resp = await fetchWithTimeout(u.href, headers, isDoc ? 8000 : 15000); } catch (e) { resp = null; }
    }
    if (resp && resp.ok) {
        const body = Buffer.from(await resp.arrayBuffer());
        const type = resp.headers.get('content-type') || mimeFor(u.pathname);
        writeCached(u.href, body, type);
        return new Response(body, { status: resp.status, headers: cleanHeaders(resp.headers) });
    }
    if (resp && resp.status >= 400 && resp.status < 500) {
        // el archivo de verdad no existe (404): eso se respeta
        return new Response(Buffer.from(await resp.arrayBuffer()), { status: resp.status, headers: cleanHeaders(resp.headers) });
    }
    const off = offlineResponse(u);
    if (off) return off;
    if (resp) return new Response(Buffer.from(await resp.arrayBuffer()), { status: resp.status, headers: cleanHeaders(resp.headers) });
    return Response.error();
}

// ------------------------------------------------------------------ ventana
function statePath() { return path.join(app.getPath('userData'), 'window-state.json'); }
function loadState() {
    try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch (e) { return null; }
}
function saveState() {
    if (!win || win.isDestroyed()) return;
    try {
        const s = { bounds: win.getNormalBounds(), maximized: win.isMaximized() };
        fs.writeFileSync(statePath(), JSON.stringify(s));
    } catch (e) { /* nada */ }
}

function createWindow() {
    const st = loadState();
    win = new BrowserWindow({
        width: st && st.bounds ? st.bounds.width : 1366,
        height: st && st.bounds ? st.bounds.height : 820,
        x: st && st.bounds ? st.bounds.x : undefined,
        y: st && st.bounds ? st.bounds.y : undefined,
        minWidth: 800,
        minHeight: 500,
        show: false,
        backgroundColor: '#1b2838',
        title: 'MB World Editor',
        icon: path.join(__dirname, '..', 'resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
            backgroundThrottling: false
        }
    });
    if (st && st.maximized) win.maximize();
    win.once('ready-to-show', () => win.show());
    win.on('close', saveState);

    const wc = win.webContents;

    // Enlaces que salen de la página (Discord, GitHub...) → el navegador normal
    wc.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    wc.on('will-navigate', (e, url) => {
        if (url.startsWith(SITE)) return;
        e.preventDefault();
        if (/^file:/i.test(url)) {   // un archivo soltado fuera de la zona del editor
            try { const p = decodeURIComponent(new URL(url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); if (/\.mbw$/i.test(p)) openPaths([p]); } catch (err) { /* nada */ }
            return;
        }
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    });

    // Teclas del programa (el menú de arriba está quitado para no robarle atajos al editor)
    wc.on('before-input-event', (e, input) => {
        if (input.type !== 'keyDown') return;
        if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
        else if (input.control && input.shift && (input.key === 'I' || input.key === 'i')) { wc.toggleDevTools(); e.preventDefault(); }
        else if (input.control && input.shift && (input.key === 'R' || input.key === 'r')) { wc.reloadIgnoringCache(); e.preventDefault(); }
    });

    wc.on('did-start-navigation', (e) => { if (e.isMainFrame && !e.isSameDocument) pageReady = false; });
    wc.on('did-finish-load', () => {
        pageReady = true;
        const paths = queuedPaths.splice(0);
        if (paths.length) openPaths(paths);
    });
    wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
        if (!isMainFrame || code === -3) return;   // -3 = cancelado (normal)
        wc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorPage()));
    });
    wc.on('render-process-gone', (e, details) => {
        if (details.reason === 'clean-exit') return;
        const r = dialog.showMessageBoxSync(win, { type: 'error', buttons: [t('reload'), t('close')], message: t('crashed') });
        if (r === 0) wc.loadURL(START_URL); else win.close();
    });

    if (process.env.MBW_SMOKE) smokeTest(wc);
    wc.loadURL(START_URL);
}

// Prueba automática (la usa GitHub al fabricar el instalador): abre, espera al editor y al mundo, anota y cierra
function smokeTest(wc) {
    wc.once('did-finish-load', async () => {
        let r = {};
        const want = mbwPathsFrom(process.argv).map(p => path.basename(p));
        for (let i = 0; i < 120; i++) {
            try {
                r = await wc.executeJavaScript('({ url: location.href, editor: typeof readWorldFile === "function", desktop: !!window.mbwDesktop, '
                    + 'tabs: (typeof WorldTabsManager !== "undefined" ? WorldTabsManager.openWorlds.map(w => w.filename || "") : []), '
                    + 'world: typeof mbwom !== "undefined" && !!mbwom.world })');
            } catch (e) { r = { error: String(e) }; }
            r.ok = !!(r.editor && r.desktop && want.every(n => (r.tabs || []).includes(n)) && (!want.length || r.world));
            if (r.ok) break;
            await new Promise(res => setTimeout(res, 1000));
        }
        r.want = want; r.version = app.getVersion();
        try { fs.writeFileSync(process.env.MBW_SMOKE, JSON.stringify(r, null, 2)); } catch (e) { /* nada */ }
        app.quit();
    });
}

function errorPage() {
    return '<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#1b2838;color:#fff;font:16px sans-serif;text-align:center">'
        + '<div><h2>' + t('noInternetTitle') + '</h2><p>' + t('noInternetText') + '</p>'
        + '<button onclick="location.href=\'' + START_URL + '\'" style="font-size:16px;padding:10px 24px;border:0;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer">' + t('retry') + '</button></div></body>';
}

// ------------------------------------------------------------------ abrir archivos .mbw
function mbwPathsFrom(argv) {
    return argv.slice(1).filter(a => !a.startsWith('-') && /\.mbw$/i.test(a) && fs.existsSync(a));
}

function openPaths(paths) {
    if (!win || win.isDestroyed()) { queuedPaths.push(...paths); return; }
    if (!pageReady) { queuedPaths.push(...paths); return; }
    paths.forEach((p, i) => setTimeout(() => openOne(p), i * 1500));   // varios a la vez: uno tras otro
}

async function openOne(p) {
    let text;
    try { text = await fs.promises.readFile(p, 'utf8'); }
    catch (e) { dialog.showMessageBox(win, { type: 'error', message: t('cantRead') + '\n' + p }); return; }
    const id = nextFileId++;
    pendingFiles.set(id, { name: path.basename(p), text });
    if (win.isMinimized()) win.restore();
    win.focus();
    // En la página: espera a que el editor esté listo y abre el archivo como si lo hubieran soltado encima
    const js = '(async function(){'
        + 'for (let i = 0; i < 300; i++) { if (typeof readWorldFile === "function" && typeof fileManager !== "undefined" && document.readyState === "complete") break; await new Promise(r => setTimeout(r, 100)); }'
        + 'const f = await window.mbwDesktop.takeFile(' + id + '); if (!f) return false;'
        + 'try { if (typeof closeFileMenu === "function") closeFileMenu(); } catch (e) {}'
        + 'const file = new File([f.text], f.name, { type: "text/plain" });'
        + 'fileManager.file = file; readWorldFile(file); return true;'
        + '})()';
    win.webContents.executeJavaScript(js).catch(() => { /* la página cambió mientras tanto */ });
}

ipcMain.handle('mbw:take-file', (e, id) => {
    const f = pendingFiles.get(id);
    pendingFiles.delete(id);
    return f || null;
});
ipcMain.handle('mbw:info', () => ({ version: app.getVersion(), platform: process.platform }));

// ------------------------------------------------------------------ aviso de versión nueva del programa
function newer(a, b) {   // ¿a es más nueva que b?
    const pa = String(a).replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
    return false;
}

async function checkForUpdate() {
    if (FORCE_OFFLINE || process.env.MBW_NO_UPDATE_CHECK === '1') return;
    try {
        const r = await net.fetch(RELEASES_API, { headers: { 'accept': 'application/vnd.github+json', 'user-agent': 'MB-World-Editor-Desktop' }, bypassCustomProtocolHandlers: true });
        if (!r.ok) return;
        const rel = await r.json();
        const tag = rel.tag_name || '';
        if (!/^desktop-v/i.test(tag) || !newer(tag, app.getVersion())) return;
        const skipFile = path.join(app.getPath('userData'), 'skip-version.txt');
        let skipped = ''; try { skipped = fs.readFileSync(skipFile, 'utf8').trim(); } catch (e) { /* nada */ }
        if (skipped === tag) return;
        const res = await dialog.showMessageBox(win, {
            type: 'info', buttons: [t('download'), t('later'), t('skip')], defaultId: 0, cancelId: 1,
            title: 'MB World Editor', message: t('updateTitle'), detail: t('updateText').replace('{v}', tag.replace(/^desktop-v/i, ''))
        });
        if (res.response === 0) shell.openExternal(rel.html_url || RELEASES_PAGE);
        else if (res.response === 2) { try { fs.writeFileSync(skipFile, tag); } catch (e) { /* nada */ } }
    } catch (e) { /* sin internet: otro día */ }
}

// ------------------------------------------------------------------ textos (español / inglés / portugués)
const TEXT = {
    es: { reload: 'Volver a cargar', close: 'Cerrar', crashed: 'El editor se cerró por un error. ¿Volver a cargarlo?', noInternetTitle: 'Sin internet', noInternetText: 'La primera vez, el programa necesita internet para descargar el editor. Conéctate y vuelve a intentarlo.', retry: 'Reintentar', cantRead: 'No se pudo leer el archivo:', download: 'Descargar', later: 'Más tarde', skip: 'Saltar esta versión', updateTitle: '¡Hay una versión nueva del programa!', updateText: 'Ya salió la versión {v} de MB World Editor para PC. El editor ya se actualiza solo; esta versión nueva mejora el programa en sí.' },
    pt: { reload: 'Recarregar', close: 'Fechar', crashed: 'O editor fechou por um erro. Recarregar?', noInternetTitle: 'Sem internet', noInternetText: 'Na primeira vez, o programa precisa de internet para baixar o editor. Conecte-se e tente de novo.', retry: 'Tentar de novo', cantRead: 'Não foi possível ler o arquivo:', download: 'Baixar', later: 'Mais tarde', skip: 'Pular esta versão', updateTitle: 'Há uma nova versão do programa!', updateText: 'Saiu a versão {v} do MB World Editor para PC. O editor já se atualiza sozinho; esta nova versão melhora o próprio programa.' },
    en: { reload: 'Reload', close: 'Close', crashed: 'The editor closed because of an error. Reload it?', noInternetTitle: 'No internet', noInternetText: 'The first time, the program needs internet to download the editor. Connect and try again.', retry: 'Try again', cantRead: 'Could not read the file:', download: 'Download', later: 'Later', skip: 'Skip this version', updateTitle: 'A new version of the program is available!', updateText: 'MB World Editor for PC {v} is out. The editor already updates by itself; this new version improves the program itself.' }
};
function t(k) {
    const loc = (app.getLocale() || 'en').slice(0, 2).toLowerCase();
    return (TEXT[loc] || TEXT.en)[k] || TEXT.en[k] || k;
}

// ------------------------------------------------------------------ arranque
app.on('second-instance', (e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    const paths = mbwPathsFrom(argv);
    if (paths.length) openPaths(paths);
});

app.whenReady().then(() => {
    if (!gotLock) return;
    cacheDir = path.join(app.getPath('userData'), 'offline-cache');
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) { /* nada */ }
    Menu.setApplicationMenu(null);

    protocol.handle('https', handleHttps);

    // Permisos: solo la página del editor puede pedirlos
    const ses = session.defaultSession;
    const ALLOWED = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'pointerLock', 'notifications', 'fileSystem', 'media']);
    ses.setPermissionRequestHandler((wc, perm, cb, details) => {
        const origin = (details && (details.requestingUrl || details.securityOrigin)) || '';
        cb(origin.startsWith(SITE_ORIGIN) && ALLOWED.has(perm));
    });

    queuedPaths.push(...mbwPathsFrom(process.argv));
    createWindow();
    setTimeout(checkForUpdate, 8000);
});

app.on('window-all-closed', () => app.quit());
