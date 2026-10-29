// ==========================================================
// scripts/world-extras.js  —  tres herramientas nuevas para el mundo
//   1. Marcadores (⭐): guardas lugares con nombre y saltas a ellos            (pestaña View)
//   2. Editor de letreros: clic derecho con Move sobre un letrero              (signs1/2/3 del mundo)
//   3. Vagonetas y balsas: se ponen desde la pestaña Home y se mueven con Move (carts1/2/3 y rafts1/2/3)
//   + Lana arcoíris animada: cambia por los 16 colores de lana (rendering.js tiene los dibujos "vivos"; aquí se avanza el cuadro y solo se redibuja si se ve)
// main.js llama a window.mbwExtras.beforeMobs() / afterMobs() en cada fotograma (protegido con try/catch).
// ==========================================================
(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);
    function tx(key, fallback) {
        try {
            const v = typeof window.t === 'function' ? window.t(key) : key;
            return (v && v !== key) ? v : (fallback !== undefined ? fallback : key);
        } catch (e) { return fallback !== undefined ? fallback : key; }
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function worldReady() { return typeof mbwom !== 'undefined' && !!mbwom && !!mbwom.scene && !!mbwom.world; }
    function curScene() { return (typeof mbwom !== 'undefined' && mbwom && mbwom.currentScene) || 1; }
    function sx(wx) { return (wx - camera.x) * tileSize; }                       // x de pantalla de una coordenada del mundo
    function sy(wy) { return canvas.height - (wy - camera.y) * tileSize; }       // y de pantalla (wy = borde de abajo del cuadro wy)
    function mouseToWorld(ev) {
        const r = canvas.getBoundingClientRect();
        const px = (ev.clientX - r.left) * (canvas.width / (r.width || canvas.width));
        const py = (ev.clientY - r.top) * (canvas.height / (r.height || canvas.height));
        return { x: camera.x + px / tileSize, y: camera.y + (canvas.height - py) / tileSize };
    }
    function netSend(msg) { try { if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed(msg); } catch (e) { /* sin red */ } }
    function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
    function openMod(id) { if (typeof openModal === 'function') openModal(id); else { const m = $(id); if (m) m.style.display = 'block'; } }
    function closeMod(id) { if (typeof closeModal === 'function') closeModal(id); else { const m = $(id); if (m) m.style.display = 'none'; } }

    // Ventana pequeña con el estilo de las demás (se crea una sola vez)
    function ensureModal(id, width) {
        let m = $(id);
        if (m) return m;
        m = document.createElement('div');
        m.id = id; m.className = 'modal'; m.style.zIndex = '2600';
        m.innerHTML = '<div class="modal-content mbw-standard-modal ex-modal" style="width:' + width + 'px;height:auto;max-height:92vh;margin:4vh auto;">' +
            '<div class="mbw-modal-header"><h3 class="ex-title"></h3><span class="mbw-close-btn" data-ex-close>&times;</span></div>' +
            '<div class="mbw-modal-body ex-body"></div></div>';
        document.body.appendChild(m);
        m.querySelector('[data-ex-close]').onclick = function () { closeMod(id); };
        return m;
    }

    // El mundo tiene `signs1/2/3`, `carts1/2/3`, `rafts1/2/3`. Si la dimensión no los trae vienen como el número 0:
    // se crea un objeto vacío y se engancha también al mundo para que se guarde.
    function worldObj(name, scn, create) {
        if (!worldReady()) return null;
        scn = scn || curScene();
        if (scn === curScene()) {
            const o = mbwom[name];
            if (o && typeof o === 'object') return o;
            if (!create) return null;
            const n = {}; mbwom[name] = n; mbwom.world[name + scn] = n; return n;
        }
        const o = mbwom.world[name + scn];
        if (o && typeof o === 'object') return o;
        if (!create) return null;
        const n = {}; mbwom.world[name + scn] = n; return n;
    }
    function snapshotView() { worldDirty = true; }

    // ------------------------------------------------------------------
    // 0. LANA ARCOÍRIS: cambia de color; la foto del mundo solo se repinta si hay lana arcoíris a la vista
    // ------------------------------------------------------------------
    let rbLastCheck = 0;
    function rainbowVisible() {
        const A = window.rainbowAnim, wc = window.worldCache;
        if (!A || !wc) return false;
        const X0 = Math.max(0, Math.floor(camera.x) - 1), X1 = Math.min(wc.length - 1, Math.ceil(camera.x + canvas.width / tileSize) + 1);
        const Y0 = Math.max(0, Math.floor(camera.y) - 1), Y1 = Math.ceil(camera.y + canvas.height / tileSize) + 1;
        for (let x = X0; x <= X1; x++) {
            const col = wc[x];
            if (!col) continue;
            const top = Math.min(col.length - 1, Y1);
            for (let y = Y0; y <= top; y++) if (A.isLive(col[y])) return true;
        }
        return false;
    }
    let bkLast = null;
    function rainbowTick() {
        const A = window.rainbowAnim;
        if (!A) return;
        const now = performance.now();
        // (con las animaciones apagadas el reloj de la lana se queda quieto; magma y fuego tampoco cambian)
        const q = (window.mbwAnimationsOn === false && A.started) ? A.q : Math.floor(now / A.period * A.sub);
        const bk = window.blockAnim ? window.blockAnim.clock() : 0;
        if (A.started && q === A.q && bk === bkLast) return;
        // con muchísimos cuadros en pantalla (zoom muy alejado) repintar tantas veces por segundo pesaría: se espacia
        const cells = (typeof grid !== 'undefined' && grid.width && grid.height) ? grid.width * grid.height : 0;
        const gap = cells > 20000 ? 400 : (cells > 6000 ? 200 : 0);
        if (A.started && now - rbLastCheck < gap) return;
        rbLastCheck = now;
        bkLast = bk;
        A.setClock(q);
        if (rainbowVisible()) worldDirty = true;
    }
    window.mbwRainbowTick = rainbowTick;
    window.mbwRainbowVisible = rainbowVisible;

    // ------------------------------------------------------------------
    // 1. MARCADORES
    // ------------------------------------------------------------------
    const BM_KEY = 'mbw_bookmarks', BM_PINS_KEY = 'mbw_bookmarks_pins';
    let bmAll = null;
    let bmPins = lsGet(BM_PINS_KEY, '1') !== '0';
    function worldKey() { const d = $('filename-display'); return ((d && d.value) || 'world').trim() || 'world'; }
    function bmLoad() {
        if (bmAll) return bmAll;
        try { bmAll = JSON.parse(lsGet(BM_KEY, '{}')) || {}; } catch (e) { bmAll = {}; }
        if (typeof bmAll !== 'object' || Array.isArray(bmAll)) bmAll = {};
        return bmAll;
    }
    function bmList() { const l = bmLoad()[worldKey()]; return Array.isArray(l) ? l : []; }
    function bmWrite(list) {
        const all = bmLoad();
        if (list.length) all[worldKey()] = list; else delete all[worldKey()];
        lsSet(BM_KEY, JSON.stringify(all));
        snapshotView();
    }
    window.addEventListener('storage', function (e) { if (e.key === BM_KEY) bmAll = null; });

    // ---- Marcar con el mouse: se cierra la ventana, el cursor pasa a cruz y el clic en el mapa guarda el marcador ----
    const pick = { on: false, name: '', has: false, x: 0, y: 0 };
    function pickBanner(show) {
        let el = $('ex-pick-banner');
        if (!show) { if (el) el.style.display = 'none'; return; }
        if (!el) {
            el = document.createElement('div'); el.id = 'ex-pick-banner';
            document.body.appendChild(el);
        }
        el.textContent = tx('ex_bm_pick_hint', 'Click on the map where you want the bookmark. Esc or right-click cancels.');
        el.style.display = 'block';
    }
    function startPick(name) {
        if (!worldReady()) return;
        pick.on = true; pick.name = String(name || ''); pick.has = false;
        closeMod('ex-bookmarks-modal');
        document.body.classList.add('ex-picking');
        pickBanner(true);
        worldDirty = true;
    }
    function endPick(reopen, msg) {
        if (!pick.on) return;
        pick.on = false; pick.has = false;
        document.body.classList.remove('ex-picking');
        pickBanner(false);
        worldDirty = true;
        if (reopen) { bmRender(); openMod('ex-bookmarks-modal'); if (msg) bmMsg(msg); }
    }
    function pickSpot(ev) {
        const w = mouseToWorld(ev);
        return { x: Math.floor(w.x), y: Math.floor(w.y), dim: curScene() };
    }
    function pickBlock(e) {
        if (!pick.on) return;
        const onCanvas = e.target === canvas;
        if (e.type === 'keydown') {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); endPick(true); }
            return;
        }
        if (!onCanvas) return;
        if (e.type === 'mousemove') { const p = pickSpot(e); pick.x = p.x; pick.y = p.y; pick.has = true; worldDirty = true; return; }
        // cualquier otro gesto sobre el mapa se queda aquí: no llega a la herramienta activa
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === 'contextmenu' || (e.button !== undefined && e.button === 2)) { if (e.type === 'contextmenu') endPick(true); return; }
        if (e.type === 'mousedown' || e.type === 'pointerdown' || e.type === 'touchstart') {
            const src = e.touches && e.touches[0] ? e.touches[0] : e;
            const p = pickSpot(src);
            const b = bmAdd(p, pick.name);
            const label = b ? (b.name + '  (X ' + p.x + ', Y ' + p.y + ')') : '';
            endPick(true, b ? tx('ex_bm_saved', 'Saved:') + ' ' + label : '');
        }
    }
    ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'touchstart', 'mousemove', 'keydown'].forEach(function (n) {
        window.addEventListener(n, pickBlock, true);
    });
    function drawPickGhost() {
        if (!pick.on || !pick.has) return;
        const px = sx(pick.x + 0.5), py = sy(pick.y + 0.5);
        const r = Math.max(8, Math.min(16, tileSize * 0.7));
        ctx.save();
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
        ctx.strokeRect(sx(pick.x), sy(pick.y + 1), tileSize, tileSize);
        ctx.globalAlpha = 0.8;
        starPath(ctx, px, py, r);
        ctx.fillStyle = '#FFD700'; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#7a5a00'; ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.shadowColor = 'black'; ctx.shadowBlur = 4; ctx.fillStyle = '#FFFFFF';
        ctx.fillText('X ' + pick.x + '  Y ' + pick.y, px, py - r - 6);
        ctx.restore();
    }

    function playerSpot() {
        const w = mbwom.world;
        if (!w || w.worldX === undefined || w.worldX === null || w.worldY === undefined || w.worldY === null) return null;
        const x = Number(w.worldX), y = -Number(w.worldY);
        if (!isFinite(x) || !isFinite(y)) return null;
        return { x: Math.round(x), y: Math.round(y), dim: w.scene || 1 };
    }
    function centerCameraOn(x, y) {
        camera.x = x + 0.5 - (canvas.width / tileSize) / 2;
        camera.y = y + 0.5 - (canvas.height / tileSize) / 2;
        if (!window.smoothScroll) { camera.x = Math.round(camera.x); camera.y = Math.round(camera.y); }
        else if (typeof snapSmoothCamera === 'function') snapSmoothCamera();
        camera.velX = 0; camera.velY = 0; camera.accX = 0; camera.accY = 0; camera.lastMoveTime = null;
        camera._tx = camera.x; camera._ty = camera.y;
        worldDirty = true;
    }
    function bmAdd(spot, name) {
        if (!worldReady() || !spot) return null;
        const list = bmList().slice();
        name = String(name || '').trim().slice(0, 40) || (tx('ex_bm_default_name', 'Place') + ' ' + (list.length + 1));
        const b = { id: 'bm' + Date.now().toString(36) + Math.floor(Math.random() * 1000), name: name, x: spot.x, y: spot.y, dim: spot.dim };
        list.push(b);
        bmWrite(list);
        return b;
    }
    function bmGo(id) {
        if (!worldReady()) return false;
        const b = bmList().find((q) => q.id === id);
        if (!b) return false;
        if (curScene() !== b.dim) {
            if (!mbwom.world['scene' + b.dim]) { bmMsg(tx('ex_bm_dim_missing', 'That dimension is not generated in this world.')); return false; }
            if (typeof changeDimension === 'function') changeDimension(b.dim);
        }
        centerCameraOn(b.x, b.y);
        return true;
    }
    function bmDelete(id) { bmWrite(bmList().filter((q) => q.id !== id)); }
    function bmRename(id, name) {
        const list = bmList().map((q) => q.id === id ? Object.assign({}, q, { name: String(name || '').trim().slice(0, 40) || q.name }) : q);
        bmWrite(list);
    }
    function bmMsg(text) { const el = $('ex-bm-msg'); if (el) { el.textContent = text || ''; } }

    const DIM_ICON = { 1: 'assets/Overworld icon.png', 2: 'assets/Nether icon.png', 3: 'assets/End icon.png' };
    function bmRender() {
        const m = ensureModal('ex-bookmarks-modal', 520);
        m.querySelector('.ex-title').textContent = '⭐ ' + tx('ex_bm_title', 'Bookmarks');
        const list = bmList();
        const body = m.querySelector('.ex-body');
        let h = '<div class="ex-row"><input type="text" id="ex-bm-name" maxlength="40" placeholder="' + esc(tx('ex_bm_name_ph', 'Name (e.g. my house)')) + '">' +
            '<button class="ex-btn" id="ex-bm-pick">' + '📍 ' + esc(tx('ex_bm_pick', 'Mark with the mouse')) + '</button>' +
            '<button class="ex-btn" id="ex-bm-add-player">' + esc(tx('ex_bm_add_player', 'Add at Player')) + '</button></div>' +
            '<div class="ex-hint" id="ex-bm-msg"></div><div class="ex-list" id="ex-bm-list">';
        if (!worldReady()) h += '<div class="ex-empty">' + esc(tx('ex_bm_no_world', 'Open a world first.')) + '</div>';
        else if (!list.length) h += '<div class="ex-empty">' + esc(tx('ex_bm_empty', 'No bookmarks yet in this world.')) + '</div>';
        list.forEach(function (b) {
            h += '<div class="ex-item" data-id="' + esc(b.id) + '"><img class="ex-dim" src="' + (DIM_ICON[b.dim] || DIM_ICON[1]) + '" alt="">' +
                '<input type="text" class="ex-bm-rename" maxlength="40" value="' + esc(b.name) + '" title="' + esc(tx('ex_bm_rename', 'Rename')) + '">' +
                '<span class="ex-coords">X ' + b.x + '  Y ' + b.y + '</span>' +
                '<button class="ex-btn ex-go">' + esc(tx('ex_bm_go', 'Go')) + '</button>' +
                '<button class="ex-btn ex-del" title="' + esc(tx('ex_bm_delete', 'Delete')) + '">🗑️</button></div>';
        });
        h += '</div><label class="ex-check"><input type="checkbox" id="ex-bm-pins"' + (bmPins ? ' checked' : '') + '> ' + esc(tx('ex_bm_pins', 'Show bookmarks on the map')) + '</label>';
        body.innerHTML = h;
        const nameEl = $('ex-bm-name');
        $('ex-bm-pick').onclick = function () { if (!worldReady()) return; startPick(nameEl.value); };
        $('ex-bm-add-player').onclick = function () {
            if (!worldReady()) return;
            const p = playerSpot();
            if (!p) { bmMsg(tx('ex_bm_no_player', 'This world has no Player position.')); return; }
            bmAdd(p, nameEl.value); nameEl.value = ''; bmRender();
        };
        nameEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('ex-bm-pick').click(); } });
        body.querySelectorAll('.ex-item').forEach(function (row) {
            const id = row.getAttribute('data-id');
            row.querySelector('.ex-go').onclick = function () { if (bmGo(id)) closeMod('ex-bookmarks-modal'); };
            row.querySelector('.ex-del').onclick = function () { bmDelete(id); bmRender(); };
            const inp = row.querySelector('.ex-bm-rename');
            inp.addEventListener('change', function () { bmRename(id, inp.value); });
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
        });
        $('ex-bm-pins').onchange = function () { bmPins = this.checked; lsSet(BM_PINS_KEY, bmPins ? '1' : '0'); snapshotView(); };
    }
    window.openBookmarks = function () { bmRender(); openMod('ex-bookmarks-modal'); };

    function starPath(c, cx, cy, r) {
        c.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
            const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
            if (i) c.lineTo(px, py); else c.moveTo(px, py);
        }
        c.closePath();
    }
    function drawPins() {
        if (!bmPins || !worldReady()) return;
        const list = bmList();
        if (!list.length) return;
        const scn = curScene();
        const r = Math.max(7, Math.min(14, tileSize * 0.6));
        ctx.save();
        ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (b.dim !== scn) continue;
            const px = sx(b.x + 0.5), py = sy(b.y + 0.5);
            if (px < -120 || px > canvas.width + 120 || py < -40 || py > canvas.height + 40) continue;
            starPath(ctx, px, py, r);
            ctx.fillStyle = '#FFD700'; ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = '#7a5a00'; ctx.stroke();
            ctx.shadowColor = 'black'; ctx.shadowBlur = 4; ctx.fillStyle = '#FFFFFF';
            ctx.fillText(b.name, px, py - r - 4);
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    // ------------------------------------------------------------------
    // 3. LETREROS
    // ------------------------------------------------------------------
    const SIGN_MAX_LINES = 3, SIGN_LINE_MAX = 21, SIGN_TOTAL_MAX = 45;     // como el juego: 3 renglones, 21 por renglón, 45 en total
    function signKey(x, y) { return 'blockX' + x + 'Y' + y; }
    function signText(x, y) {
        const o = worldObj('signs', curScene(), false);
        const v = o ? o[signKey(x, y)] : undefined;
        return (typeof v === 'string') ? v : '';
    }
    function splitLines(text) { return String(text || '').split(/\r\n|\r|\n/); }
    // Dibuja el texto sobre el tablero del letrero: (x, y) = esquina de arriba a la izquierda del cuadro, size = lado en píxeles.
    // Cada línea se ajusta al ancho por separado (una línea larga ya no encoge a las demás) y la letra es la misma de la interfaz.
    const SIGN_FONT = '"Pixeltype", "Courier New", monospace';
    const SIGN_FONT_K = 1.9;          // tamaño de letra = alto de línea x K (la fuente Pixeltype es chica por dentro)
    function paintSignText(c, text, x, y, size) {
        const lines = splitLines(text).slice(0, SIGN_MAX_LINES);
        if (!lines.some((l) => l.length)) return;
        const ax = x + size * 1.3 / 16, aw = size * 13.4 / 16, ay = y + size * 1.0 / 16, ah = size * 6.0 / 16;   // el tablero visible: casi todo el ancho y 6 de alto (de 16)
        const lh = ah / SIGN_MAX_LINES;
        const base = lh * SIGN_FONT_K;
        c.save();
        c.beginPath(); c.rect(ax, ay, aw, ah); c.clip();
        c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#1a1816';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.length) continue;
            c.font = base + 'px ' + SIGN_FONT;
            const w = c.measureText(line).width;
            let fs = base;
            if (w > aw) { fs = Math.max(base * aw / w, base * 0.55); c.font = fs + 'px ' + SIGN_FONT; }
            c.fillText(line, ax + aw / 2, ay + lh * (i + 0.55), aw);       // si aun así no cabe, se aprieta a lo ancho
        }
        c.restore();
    }
    // Tapa los garabatos del dibujo del letrero (solo cuando hay texto que mostrar)
    function paintSignBoard(c, x, y, size) {
        c.save();
        c.fillStyle = '#b07836'; c.fillRect(x + size / 16, y + size / 16, size * 14 / 16, size * 6 / 16);
        c.fillStyle = '#755836'; c.fillRect(x + size / 16, y + size * 7 / 16, size * 14 / 16, size / 16);
        c.restore();
    }
    let signKeysCache = { obj: null, n: -1, list: [] };
    function signList() {
        const o = worldObj('signs', curScene(), false);
        if (!o) return [];
        const keys = Object.keys(o);
        if (signKeysCache.obj === o && signKeysCache.n === keys.length) return signKeysCache.list;
        const list = [];
        for (let i = 0; i < keys.length; i++) {
            const m = /^blockX(-?\d+)Y(-?\d+)$/.exec(keys[i]);
            if (m) list.push({ key: keys[i], x: +m[1], y: +m[2] });
        }
        signKeysCache = { obj: o, n: keys.length, list: list };
        return list;
    }
    function drawSigns() {
        if (!worldReady() || tileSize < 32) return;
        const o = worldObj('signs', curScene(), false);
        if (!o) return;
        const list = signList();
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            const px = sx(s.x), py = sy(s.y + 1);
            if (px < -tileSize || px > canvas.width || py < -tileSize || py > canvas.height) continue;
            if (mbwom.getBlock(s.x, s.y) !== 'sign') continue;
            const text = o[s.key];
            if (typeof text !== 'string' || !text.replace(/[\r\n\s]/g, '')) continue;
            paintSignBoard(ctx, px, py, tileSize);
            paintSignText(ctx, text, px, py, tileSize);
        }
    }
    // Cuadrito con el texto completo al pasar el mouse por un letrero (sirve con cualquier zoom)
    let tipEl = null, tipShown = '';
    function signTip() {
        if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'ex-sign-tip'; tipEl.style.display = 'none'; document.body.appendChild(tipEl); }
        let show = '';
        if (worldReady() && mouse && mouse.canvasX !== null && mouse.canvasY !== null && mouse.worldX !== null && !window.mbwSignHoverOff) {
            const t = mbwom.getBlock(mouse.worldX, mouse.worldY);
            if (t === 'sign') show = signText(mouse.worldX, mouse.worldY);
        }
        if (!show || !show.replace(/[\r\n\s]/g, '')) { if (tipEl.style.display !== 'none') { tipEl.style.display = 'none'; tipShown = ''; } return; }
        if (tipShown !== show) { tipEl.textContent = splitLines(show).join('\n'); tipShown = show; }
        const r = canvas.getBoundingClientRect();
        tipEl.style.left = Math.round(r.left + mouse.canvasX + 14) + 'px';
        tipEl.style.top = Math.round(r.top + (canvas.height - mouse.canvasY) + 14) + 'px';
        tipEl.style.display = 'block';
    }
    canvas.addEventListener('mouseleave', function () { window.mbwSignHoverOff = true; if (tipEl) tipEl.style.display = 'none'; });
    canvas.addEventListener('mouseenter', function () { window.mbwSignHoverOff = false; });

    let signEditing = null;
    // Tablero de madera (el dibujo de "wp" del bloque, repetido y agrandado) para que la ventana se parezca a la del juego
    let plankUrl = null;
    function plankBackground() {
        if (plankUrl !== null) return plankUrl;
        try {
            const T = window.texturesMap && window.texturesMap.wp, im = window.images && window.images.blocks;
            if (!T || !im || !im.complete || !im.naturalWidth) return '';
            const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
            const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
            c.drawImage(im, T.x, T.y, 16, 16, 0, 0, 16, 16);
            plankUrl = cv.toDataURL('image/png');
        } catch (e) { plankUrl = ''; }
        return plankUrl;
    }
    // Quita lo que sobre: 21 por renglón y 45 en total (se recorta desde el final)
    function fitSignLines(lines) {
        let left = SIGN_TOTAL_MAX;
        return lines.slice(0, SIGN_MAX_LINES).map(function (l) {
            const t = String(l == null ? '' : l).replace(/[\r\n]/g, ' ').slice(0, Math.min(SIGN_LINE_MAX, left));
            left -= t.length;
            return t;
        });
    }
    function signRender() {
        let m = $('ex-sign-modal');
        if (!m) {
            m = document.createElement('div'); m.id = 'ex-sign-modal'; m.className = 'modal ex-sign-overlay'; m.style.zIndex = '2600';
            document.body.appendChild(m);
            m.addEventListener('mousedown', function (e) { if (e.target === m) closeSign(true); });
        }
        let ui = $('ex-signui');
        if (!ui) { ui = document.createElement('div'); ui.id = 'ex-signui'; m.appendChild(ui); }
        let h = '<div class="ex-signui-title">' + esc(tx('ex_sign_title', 'Sign')) + '</div>' +
            '<div class="ex-signui-board" id="ex-sign-board">';
        for (let i = 0; i < SIGN_MAX_LINES; i++) h += '<input type="text" class="ex-sign-line" maxlength="' + SIGN_LINE_MAX + '" autocomplete="off" spellcheck="false" aria-label="' + esc(tx('ex_sign_line', 'Line')) + ' ' + (i + 1) + '">';
        h += '</div><div class="ex-signui-bar"><span class="ex-signui-count" id="ex-sign-count"></span>' +
            '<button type="button" class="ex-signui-btn" id="ex-sign-close">' + esc(tx('ex_sign_close', 'Close')) + '</button></div>' +
            '<div class="ex-signui-hint">' + esc(tx('ex_sign_hint', 'Up to 3 lines: 21 characters per line, 45 in total.')) + '</div>';
        ui.innerHTML = h;
        const board = $('ex-sign-board'), bg = plankBackground();
        if (bg) board.style.backgroundImage = 'url(' + bg + ')';
        const inputs = Array.from(ui.querySelectorAll('.ex-sign-line'));
        const lines = fitSignLines(splitLines(signEditing.text));
        inputs.forEach(function (inp, i) { inp.value = lines[i] || ''; });
        function current() { return inputs.map((i) => i.value); }
        function total() { return current().reduce((a, l) => a + l.length, 0); }
        function count() { const el = $('ex-sign-count'); if (el) { const t = total(); el.textContent = t + ' / ' + SIGN_TOTAL_MAX; el.classList.toggle('full', t >= SIGN_TOTAL_MAX); } }
        // el total de 45 manda: si te pasas, se corta lo último que escribiste
        function enforce(inp) {
            let others = 0; inputs.forEach(function (o) { if (o !== inp) others += o.value.length; });
            const room = Math.max(0, SIGN_TOTAL_MAX - others);
            if (inp.value.length > room) inp.value = inp.value.slice(0, room);
            count();
        }
        inputs.forEach(function (inp, i) {
            inp.addEventListener('input', function () { enforce(inp); });
            inp.addEventListener('paste', function (e) {
                const txt = (e.clipboardData || window.clipboardData) ? String((e.clipboardData || window.clipboardData).getData('text') || '') : '';
                if (!/[\r\n]/.test(txt)) return;                       // texto de una sola línea: lo maneja el navegador
                e.preventDefault();
                const parts = txt.split(/\r\n|\r|\n/);
                const all = current(); for (let k = 0; k < parts.length && i + k < SIGN_MAX_LINES; k++) all[i + k] = parts[k];
                const fit = fitSignLines(all);
                inputs.forEach(function (o, k) { o.value = fit[k] || ''; });
                count();
            });
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); if (i < inputs.length - 1) inputs[i + 1].focus(); else closeSign(true); }
                else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); inputs[i - 1].focus(); }
                else if (e.key === 'ArrowDown' && i < inputs.length - 1) { e.preventDefault(); inputs[i + 1].focus(); }
            });
        });
        count();
        $('ex-sign-close').onclick = function () { closeSign(true); };
        signEditing.read = current;
        return inputs;
    }
    // Cerrar = guardar (igual que el botón Close del juego)
    function closeSign(save) {
        const m = $('ex-sign-modal');
        if (save && signEditing && typeof signEditing.read === 'function') signSave(signEditing.read());
        if (m) closeMod('ex-sign-modal');
        signEditing = null;
    }
    window.addEventListener('keydown', function (e) {
        const m = $('ex-sign-modal');
        if (!m || m.style.display !== 'block' || e.key !== 'Escape') return;
        e.preventDefault(); e.stopImmediatePropagation();
        closeSign(true);
    }, true);
    function signSave(lines) {
        if (!signEditing || !worldReady()) return;
        const x = signEditing.x, y = signEditing.y;
        if (mbwom.getBlock(x, y) !== 'sign') return;
        const sep = /\r/.test(signEditing.text) && !/\n/.test(signEditing.text) ? '\r' : '\n';   // se respeta el separador que ya usaba ese letrero
        let text = fitSignLines(lines).join(sep);
        text = text.replace(new RegExp('(' + (sep === '\r' ? '\\r' : '\\n') + ')+$'), '');
        const before = mbwom.getBlockState(x, y);
        const signs = worldObj('signs', curScene(), true);
        const key = signKey(x, y);
        if (text.replace(/[\r\n\s]/g, '')) signs[key] = text; else delete signs[key];
        const after = mbwom.getBlockState(x, y);
        if (typeof historyManager !== 'undefined') { historyManager.startAction(); historyManager.recordChange(x, y, before, after); historyManager.commitAction(); }
        netSend({ tipo: 'actualizar_bloque', x: x, y: y, estado: after });
        signKeysCache = { obj: null, n: -1, list: [] };
        snapshotView();
    }
    window.openSignEditor = function (x, y) {
        if (!worldReady() || mbwom.getBlock(x, y) !== 'sign') return false;
        signEditing = { x: x, y: y, text: signText(x, y) };
        const inputs = signRender();
        openMod('ex-sign-modal');
        setTimeout(function () { try { inputs[0].focus(); inputs[0].select(); } catch (e) { /* sin foco */ } }, 30);
        return true;
    };
    window.mbwSignText = signText;

    // ------------------------------------------------------------------
    // 4. VAGONETAS Y BALSAS
    // ------------------------------------------------------------------
    // Vagoneta: carts{N}['cart123'] = { x (centro), y (NEGATIVO: -pies), onRail, speedX, speedY, type ('' | chest | oven | TNT), id, health, tilt, onActivator, riddenBy }
    // Balsa:    rafts{N}['raft123'] = ['raft123', x, -y, 0, velocidad, null]
    const KINDS = {
        cart: { store: 'carts', prefix: 'cart', tex: 'cart', hitW: 1.4, hitH: 1.0, hitY: 0 },
        raft: { store: 'rafts', prefix: 'raft', tex: 'raft', hitW: 1.4, hitH: 1.0, hitY: 0 }
    };
    const CART_CONTENT = ['', 'chest', 'oven', 'TNT'];
    function vehPos(kind, d) { return kind === 'cart' ? { x: Number(d.x), y: -Number(d.y) } : { x: Number(d[1]), y: -Number(d[2]) }; }
    function vehSetPos(kind, d, x, y) { if (kind === 'cart') { d.x = x; d.y = -y; } else { d[1] = x; d[2] = -y; } }
    function vehAll(scn) {
        const out = [];
        ['cart', 'raft'].forEach(function (kind) {
            const o = worldObj(KINDS[kind].store, scn || curScene(), false);
            if (!o) return;
            Object.keys(o).forEach(function (id) {
                const d = o[id];
                if (!d || typeof d !== 'object') return;
                const p = vehPos(kind, d);
                if (!isFinite(p.x) || !isFinite(p.y)) return;
                out.push({ kind: kind, id: id, d: d, x: p.x, y: p.y });
            });
        });
        return out;
    }
    function vehGet(kind, id, scn) { const o = worldObj(KINDS[kind].store, scn, false); return o ? o[id] : undefined; }
    function newId(kind) { return KINDS[kind].prefix + Math.floor(Math.random() * 2147483647); }
    function newVehicle(kind, id, x, y, content) {
        if (kind === 'cart') return { x: x, y: -y, onRail: 0, speedX: 0, speedY: 0, type: content || '', id: id, health: 3, tilt: 0, onActivator: false, riddenBy: null };
        return [id, x, -y, 0, 0, null];
    }
    // Pone / cambia / quita una vagoneta o balsa (también lo usan Deshacer y Rehacer). state = null borra.
    window.mbwSetVehicleState = function (kind, scn, id, state, silent) {
        if (!worldReady() || !KINDS[kind]) return;
        const o = worldObj(KINDS[kind].store, scn, true);
        if (state) o[id] = JSON.parse(JSON.stringify(state)); else delete o[id];
        if (vsel && vsel.kind === kind && vsel.id === id && !state) vsel = null;
        if (!silent) netSend({ tipo: 'accion_vehiculo', clase: kind, escena: scn, id: id, datos: state ? o[id] : null });
        snapshotView();
    };
    // Mensaje de otro jugador
    window.mbwApplyRemoteVehicle = function (m) {
        if (!m || !KINDS[m.clase] || !worldReady() || typeof m.id !== 'string') return;
        window.mbwSetVehicleState(m.clase, m.escena || 1, m.id, m.datos || null, true);
    };
    function recordVeh(kind, scn, id, before, after) {
        if (typeof historyManager === 'undefined') return;
        historyManager.startAction();
        if (typeof historyManager.recordVehicleChange === 'function') historyManager.recordVehicleChange(kind, scn, id, before, after);
        historyManager.commitAction();
    }

    // --- Dibujo ---
    function vehTexture(kind) { return window.texturesMap && window.texturesMap[KINDS[kind].tex]; }
    function drawVehicleAt(c, kind, d, px, pyFeet, alpha) {
        const T = vehTexture(kind), im = window.images && window.images.blocks;
        if (!T || !im || !im.complete || !im.naturalWidth) return;
        c.save();
        c.imageSmoothingEnabled = false;
        if (alpha !== undefined) c.globalAlpha = alpha;
        // el dibujo mide 2 cuadros de ancho x 1 de alto; los pies van abajo y la x es el centro
        // (la balsa trae 4 píxeles vacíos abajo: se baja un poco para que se vea apoyada en el agua)
        const drop = kind === 'raft' ? tileSize * 0.19 : 0;
        // lo que lleva la vagoneta (cofre / horno / TNT) se dibuja PRIMERO, y la vagoneta encima:
        // así parece que va metido dentro (solo asoma la parte de arriba por el borde)
        if (kind === 'cart' && d && d.type) {
            const k = d.type === 'oven' ? 'oven' : d.type;
            const R = (typeof getBlockObject === 'function') ? getBlockObject({ type: k }) : null;
            if (R) { const s = tileSize * 0.75; c.drawImage(im, R.x, R.y, 16, 16, px - s / 2, pyFeet - tileSize * 0.3 - s, s, s); }
        }
        c.drawImage(im, T.x, T.y, 32, 16, px - tileSize, pyFeet - tileSize + drop, tileSize * 2, tileSize);
        c.restore();
    }
    function vehBox(v) {   // caja para hacer clic (en coordenadas del mundo): sobre el dibujo visible, con un poco de margen
        const K = KINDS[v.kind];
        const base = v.kind === 'raft' ? -0.05 : 0;
        return { l: v.x - K.hitW / 2, r: v.x + K.hitW / 2, b: v.y + base - 0.05, t: v.y + base + (v.kind === 'cart' ? 0.95 : 0.8) };
    }
    let vsel = null;           // { kind, id }
    function drawVehicles() {
        if (!worldReady()) return;
        const list = vehAll();
        for (let i = 0; i < list.length; i++) {
            const v = list[i];
            const px = sx(v.x), py = sy(v.y);
            if (px < -tileSize * 2 || px > canvas.width + tileSize * 2 || py < -tileSize * 2 || py > canvas.height + tileSize * 3) continue;
            drawVehicleAt(ctx, v.kind, v.d, px, py);
            if (vsel && vsel.kind === v.kind && vsel.id === v.id && typeof currentTool !== 'undefined' && currentTool === 'move') {
                const b = vehBox(v);
                ctx.save();
                ctx.fillStyle = 'rgba(0, 120, 215, 0.3)'; ctx.strokeStyle = '#0078D7'; ctx.lineWidth = 2;
                ctx.fillRect(sx(b.l), sy(b.t), (b.r - b.l) * tileSize, (b.t - b.b) * tileSize);
                ctx.strokeRect(sx(b.l), sy(b.t), (b.r - b.l) * tileSize, (b.t - b.b) * tileSize);
                ctx.restore();
            }
        }
    }
    function vehAt(wx, wy) {
        const list = vehAll();
        let hit = null;
        for (let i = 0; i < list.length; i++) {
            const b = vehBox(list[i]);
            if (wx >= b.l && wx <= b.r && wy >= b.b && wy <= b.t) hit = list[i];     // el último de la lista se dibuja encima
        }
        return hit;
    }
    window.mbwVehicleAt = vehAt;
    window.mbwVehicles = vehAll;

    // --- Poner ---
    let toSpawn = { kind: 'cart', content: '' };
    window.mbwSelectVehicleTool = function (kind) {
        if (!KINDS[kind]) return;
        toSpawn.kind = kind;
        const sel = $('ex-veh-content');
        toSpawn.content = (kind === 'cart' && sel) ? sel.value : '';
        if (typeof selectTool === 'function') selectTool('spawn_vehicle'); else window.currentTool = 'spawn_vehicle';
        syncVehicleButtons();
    };
    window.mbwSetCartContent = function (v) { toSpawn.content = v; };
    function syncVehicleButtons() {
        const active = (typeof currentTool !== 'undefined' && currentTool === 'spawn_vehicle');
        ['cart', 'raft'].forEach(function (k) { const b = $('btn-veh-' + k); if (b) b.classList.toggle('active', active && toSpawn.kind === k); });
    }
    function snapPlacement(kind, wx, wy) {
        let x = wx, y = wy;
        const bx = Math.floor(wx), by = Math.floor(wy);
        if (kind === 'cart') {
            const t = mbwom.getBlock(bx, by);
            if (typeof t === 'string' && /^rail/.test(t)) { x = bx + 0.5; y = by + 0.1; return { x: x, y: y, onRail: 1 }; }
        } else {
            for (let k = 0; k <= 3; k++) {   // si hay agua justo debajo del puntero, la balsa se apoya en la superficie
                const t = mbwom.getBlock(bx, by - k), up = mbwom.getBlock(bx, by - k + 1);
                if (t === 'wr' && up !== 'wr') { return { x: wx, y: by - k + 1 - 0.04, onRail: 0 }; }
                if (t && t !== 'air' && t !== 'wr') break;
            }
        }
        return { x: x, y: y, onRail: 0 };
    }
    function placeVehicle(wx, wy) {
        const kind = toSpawn.kind, scn = curScene();
        const p = snapPlacement(kind, wx, wy);
        const id = newId(kind);
        const d = newVehicle(kind, id, p.x, p.y, kind === 'cart' ? toSpawn.content : '');
        if (kind === 'cart' && p.onRail) d.onRail = 1;
        window.mbwSetVehicleState(kind, scn, id, d);
        recordVeh(kind, scn, id, null, d);
        vsel = null;
        if (typeof audioManager !== 'undefined' && audioManager.playTone) { try { audioManager.playTone(300, 'triangle', 0.1, 0.1); } catch (e) { /* sin sonido */ } }
        return id;
    }
    window.mbwPlaceVehicle = function (kind, x, y, content) { toSpawn.kind = kind; toSpawn.content = content || ''; return placeVehicle(x, y); };

    // --- Mover / seleccionar / borrar / editar (herramienta Move) ---
    let drag = null;          // { kind, id, dx, dy, before, moved }
    let lastLive = 0;
    function mobUnder(wx, wy) { try { return (typeof findMobAt === 'function') ? findMobAt(wx, wy) : null; } catch (e) { return null; } }
    canvas.addEventListener('mousedown', function (ev) {
        if (!worldReady() || window.profileLocked) return;
        const tool = (typeof currentTool !== 'undefined') ? currentTool : '';
        const w = mouseToWorld(ev);
        if (tool === 'spawn_vehicle' && ev.button === 0) {
            placeVehicle(w.x, w.y);
            ev.stopImmediatePropagation(); ev.preventDefault();
            return;
        }
        if (tool !== 'move') return;
        const mob = mobUnder(w.x, w.y);
        const v = mob ? null : vehAt(w.x, w.y);
        if (!v) { if (ev.button === 0) vsel = null; return; }
        if (ev.button === 2) {
            vsel = { kind: v.kind, id: v.id };
            window.mbwOpenVehicleEditor(v.kind, v.id);
            ev.stopImmediatePropagation(); ev.preventDefault();
            return;
        }
        if (ev.button !== 0) return;
        // se suelta lo que hubiera seleccionado de mobs
        try { if (typeof selectedMob !== 'undefined') { selectedMob = null; selectedMobKey = null; } if (typeof toggleMobInfo === 'function') toggleMobInfo(false); } catch (e) { /* sin mob */ }
        vsel = { kind: v.kind, id: v.id };
        drag = { kind: v.kind, id: v.id, dx: v.x - w.x, dy: v.y - w.y, before: JSON.parse(JSON.stringify(v.d)), moved: false, scn: curScene() };
        snapshotView();
        ev.stopImmediatePropagation(); ev.preventDefault();
    }, true);
    window.addEventListener('mousemove', function (ev) {
        if (!drag || !worldReady()) return;
        const d = vehGet(drag.kind, drag.id, drag.scn);
        if (!d) { drag = null; return; }
        const w = mouseToWorld(ev);
        vehSetPos(drag.kind, d, w.x + drag.dx, w.y + drag.dy);
        drag.moved = true;
        if (drag.kind === 'cart') { d.speedX = 0; d.speedY = 0; d.onRail = 0; }
        const now = Date.now();
        if (now - lastLive > 50) { lastLive = now; netSend({ tipo: 'accion_vehiculo', clase: drag.kind, escena: drag.scn, id: drag.id, datos: d }); }
        snapshotView();
    });
    window.addEventListener('mouseup', function () {
        if (!drag) return;
        const dr = drag; drag = null;
        const d = vehGet(dr.kind, dr.id, dr.scn);
        if (!d || !dr.moved) return;
        // si queda sobre un riel (vagoneta) o sobre agua (balsa) se acomoda; si no, queda donde se soltó
        const p = vehPos(dr.kind, d);
        const sn = snapPlacement(dr.kind, p.x, p.y);
        if (dr.kind === 'cart' && sn.onRail) { vehSetPos('cart', d, sn.x, sn.y); d.onRail = 1; }
        if (dr.kind === 'raft') vehSetPos('raft', d, sn.x, sn.y);
        recordVeh(dr.kind, dr.scn, dr.id, dr.before, d);
        netSend({ tipo: 'accion_vehiculo', clase: dr.kind, escena: dr.scn, id: dr.id, datos: d });
        snapshotView();
    });
    window.addEventListener('keydown', function (ev) {
        if (!vsel || !worldReady() || window.profileLocked) return;
        if (ev.code !== 'Delete' && ev.code !== 'Backspace') return;
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (typeof currentTool === 'undefined' || currentTool !== 'move') return;
        deleteVehicle(vsel.kind, vsel.id);
        ev.preventDefault();
    });
    function deleteVehicle(kind, id) {
        const scn = curScene(), d = vehGet(kind, id, scn);
        if (!d) return;
        const before = JSON.parse(JSON.stringify(d));
        window.mbwSetVehicleState(kind, scn, id, null);
        recordVeh(kind, scn, id, before, null);
        vsel = null;
    }
    window.mbwDeleteVehicle = deleteVehicle;
    window.mbwSelectedVehicle = function () { return vsel; };

    // Ventana de la vagoneta / balsa (clic derecho con Move)
    let vedit = null;
    window.mbwOpenVehicleEditor = function (kind, id) {
        const d = vehGet(kind, id, curScene());
        if (!d) return false;
        vedit = { kind: kind, id: id, scn: curScene() };
        const m = ensureModal('ex-vehicle-modal', 380);
        m.querySelector('.ex-title').textContent = (kind === 'cart' ? '🚃 ' + tx('ex_veh_cart', 'Minecart') : '🛶 ' + tx('ex_veh_raft', 'Raft'));
        const p = vehPos(kind, d);
        let h = '<div class="ex-hint">X ' + p.x.toFixed(2) + '   Y ' + p.y.toFixed(2) + '</div>';
        if (kind === 'cart') {
            h += '<label class="ex-field">' + esc(tx('ex_veh_content', 'Content')) + '<select id="ex-veh-edit-content">' +
                CART_CONTENT.map((c) => '<option value="' + c + '"' + ((d.type || '') === c ? ' selected' : '') + '>' + esc(contentName(c)) + '</option>').join('') + '</select></label>';
        }
        h += '<div class="ex-row ex-right"><button class="ex-btn" id="ex-veh-delete">🗑️ ' + esc(tx('ex_veh_delete', 'Delete')) + '</button>' +
            '<button class="ex-btn ex-primary" id="ex-veh-close">' + esc(tx('ex_veh_close', 'Close')) + '</button></div>';
        m.querySelector('.ex-body').innerHTML = h;
        const sel = $('ex-veh-edit-content');
        if (sel) sel.onchange = function () {
            const cur = vehGet(vedit.kind, vedit.id, vedit.scn); if (!cur) return;
            const before = JSON.parse(JSON.stringify(cur));
            cur.type = sel.value;
            window.mbwSetVehicleState(vedit.kind, vedit.scn, vedit.id, cur);
            recordVeh(vedit.kind, vedit.scn, vedit.id, before, cur);
        };
        $('ex-veh-delete').onclick = function () { deleteVehicle(vedit.kind, vedit.id); closeMod('ex-vehicle-modal'); };
        $('ex-veh-close').onclick = function () { closeMod('ex-vehicle-modal'); };
        openMod('ex-vehicle-modal');
        return true;
    };
    function contentName(c) {
        return c === 'chest' ? tx('ex_veh_chest', 'Chest') : c === 'oven' ? tx('ex_veh_oven', 'Furnace') : c === 'TNT' ? 'TNT' : tx('ex_veh_empty', 'Empty');
    }
    function drawVehicleGhost() {
        if (typeof currentTool === 'undefined' || currentTool !== 'spawn_vehicle' || !worldReady()) return;
        if (mouse.canvasX === null || mouse.canvasY === null || window.mbwSignHoverOff) return;
        const wx = camera.x + mouse.canvasX / tileSize, wy = camera.y + mouse.canvasY / tileSize;
        const p = snapPlacement(toSpawn.kind, wx, wy);
        const fake = toSpawn.kind === 'cart' ? { type: toSpawn.content } : null;
        drawVehicleAt(ctx, toSpawn.kind, fake, sx(p.x), sy(p.y), 0.6);
    }

    // Íconos de los botones (se pintan cuando blocks.png ya cargó) y textos
    function paintVehicleIcons() {
        const im = window.images && window.images.blocks;
        if (!im || !im.complete || !im.naturalWidth || !window.texturesMap) return false;
        ['cart', 'raft'].forEach(function (k) {
            const cv = $('ex-veh-icon-' + k), T = vehTexture(k);
            if (!cv || !T) return;
            const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = false;
            c.drawImage(im, T.x, T.y, 32, 16, 0, 0, cv.width, cv.height);
        });
        return true;
    }
    function refreshStatic() {
        const sel = $('ex-veh-content');
        if (sel) { const cur = sel.value; sel.innerHTML = CART_CONTENT.map((c) => '<option value="' + c + '">' + esc(contentName(c)) + '</option>').join(''); sel.value = cur; }
    }
    window.mbwExtrasOnLanguageChanged = function () {
        refreshStatic();
        const bm = $('ex-bookmarks-modal'); if (bm && bm.style.display === 'block') bmRender();
    };

    // ------------------------------------------------------------------
    // Enganches con main.js
    // ------------------------------------------------------------------
    let lastActiveSync = '';
    window.mbwExtras = {
        beforeMobs: function () {
            if (!worldReady()) return;
            rainbowTick();
            drawSigns();
            drawVehicles();
        },
        afterMobs: function () {
            if (!worldReady()) return;
            drawPins();
            drawPickGhost();
            drawVehicleGhost();
            signTip();
            const s = (typeof currentTool !== 'undefined' ? currentTool : '') + '|' + toSpawn.kind;
            if (s !== lastActiveSync) { lastActiveSync = s; syncVehicleButtons(); }
        }
    };

    function init() {
        refreshStatic();
        try { if (document.fonts && document.fonts.load) document.fonts.load('16px "Pixeltype"').then(function () { worldDirty = true; }, function () { /* sin la fuente se usa otra */ }); } catch (e) { /* sin fuentes */ }
        let tries = 0;
        const t = setInterval(function () { if (paintVehicleIcons() || ++tries > 100) clearInterval(t); }, 200);
        if (typeof setLanguage === 'function' && window.mbwExtrasOnLanguageChanged) { /* setLanguage ya llama a mbwExtrasOnLanguageChanged */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
