// ==========================================================
// 🎞️ EDITOR SECRETO DE ANIMACIONES
// Se abre con Ctrl + Shift + Alt + A (o escribiendo openAnimEditor() en la consola). No tiene botón en la interfaz.
// Muestra todos los bloques que tienen animación (magma, fuego, lana / lana teñida / alfombra arcoíris) y deja cambiar
// sus cuadros eligiéndolos en blocks.png: clic en un cuadro de la hoja = agregarlo al final.
// Cada cuadro se puede voltear (⇋), mover (◀ ▶) o quitar (✕). También la velocidad y (magma / fuego) la transparencia en el mundo.
// · "Save" guarda en ESTE navegador (mbw_anim_frames) y el mundo se ve así enseguida.
// · "Download anim-frames.js" baja el archivo para dejarlo fijo para TODOS: reemplaza scripts/anim-frames.js por ese archivo.
// ==========================================================
(function () {
    'use strict';
    const LS = 'mbw_anim_frames';
    const NAMES = ['magma', 'fire', 'cloth_rainbow', 'bdcloth_rainbow', 'carpet_rainbow'];
    const LABEL = { magma: 'Magma', fire: 'Fire', cloth_rainbow: 'Rainbow wool', bdcloth_rainbow: 'Rainbow dyed wool', carpet_rainbow: 'Rainbow carpet' };
    const RB_PREFIX = { cloth_rainbow: 'cloth_', bdcloth_rainbow: 'bdcloth_', carpet_rainbow: 'carpet_' };
    const SHEET_SCALE = 2;
    function tr(k, fb) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb) : fb; }
    function $(id) { return document.getElementById(id); }
    function img() { return window.images && window.images.blocks; }
    function readLS() { try { return JSON.parse(localStorage.getItem(LS) || 'null') || {}; } catch (e) { return {}; } }
    function writeLS(o) { try { localStorage.setItem(LS, JSON.stringify(o)); return true; } catch (e) { return false; } }

    // Los cuadros de fábrica de la lana arcoíris son las 12 lanas: aquí se escriben como [columna, fila]
    function defaultFrames(name) {
        const D = window.MBW_ANIM_DEFAULTS[name];
        if (D.frames) return D.frames.map(f => f.slice());
        const TM = window.texturesMap, pre = RB_PREFIX[name];
        return window.rainbowAnim.order.map(c => TM[pre + c]).filter(Boolean).map(t => [t.x / 16, t.y / 16]);
    }
    function currentConfig(name) {
        const cfg = window.mbwAnimConfig(name);
        const D = window.MBW_ANIM_DEFAULTS[name];
        return {
            frames: Array.isArray(cfg.frames) ? cfg.frames.map(f => f.slice()) : defaultFrames(name),
            ms: cfg.ms, alpha: cfg.alpha !== undefined ? cfg.alpha : (D.alpha !== undefined ? D.alpha : 1), blend: !!D.blend
        };
    }

    const st = { open: false, sel: 'magma', draft: null, dirty: false, timer: null, t0: 0 };
    window.mbwAnimEditor = { state: st };

    function build() {
        if ($('anim-editor-modal')) return;
        const m = document.createElement('div');
        m.id = 'anim-editor-modal';
        m.className = 'modal';
        m.innerHTML =
            '<div class="modal-content mbw-standard-modal ae-box">' +
            '<div class="mbw-modal-header"><h3 class="ae-title"></h3><span class="mbw-close-btn" id="ae-close">&times;</span></div>' +
            '<div class="ae-body">' +
            '  <div class="ae-list" id="ae-list"></div>' +
            '  <div class="ae-main">' +
            '    <div class="ae-top">' +
            '      <canvas id="ae-preview" width="16" height="16" class="ae-preview"></canvas>' +
            '      <div class="ae-props">' +
            '        <div class="ae-name" id="ae-name"></div>' +
            '        <label class="ae-row"><span class="ae-lbl" id="ae-ms-lbl"></span><input type="number" id="ae-ms" min="30" max="60000" step="10"> ms</label>' +
            '        <label class="ae-row" id="ae-alpha-row"><span class="ae-lbl" id="ae-alpha-lbl"></span><input type="range" id="ae-alpha" min="10" max="100" step="5"><b id="ae-alpha-v"></b></label>' +
            '        <div class="ae-hint" id="ae-hint"></div>' +
            '      </div>' +
            '    </div>' +
            '    <div class="ae-frames-h" id="ae-frames-h"></div>' +
            '    <div class="ae-frames" id="ae-frames"></div>' +
            '    <div class="ae-sheet-h"><span id="ae-sheet-h"></span><label class="ae-goto"><span id="ae-goto-lbl"></span><input type="number" id="ae-goto" min="0" max="233"></label></div>' +
            '    <div class="ae-sheet" id="ae-sheet"><canvas id="ae-sheet-cv"></canvas><div class="ae-hover" id="ae-hover"></div></div>' +
            '    <div class="ae-actions">' +
            '      <button type="button" id="ae-reset" class="ae-btn"></button>' +
            '      <button type="button" id="ae-export" class="ae-btn"></button>' +
            '      <span class="ae-saved" id="ae-saved"></span>' +
            '      <button type="button" id="ae-save" class="ae-btn ae-primary"></button>' +
            '    </div>' +
            '  </div>' +
            '</div></div>';
        document.body.appendChild(m);
        $('ae-close').onclick = close;
        m.addEventListener('mousedown', e => { if (e.target === m) close(); });
        $('ae-ms').addEventListener('input', () => { const v = Number($('ae-ms').value); if (v >= 30 && v <= 60000) { st.draft.ms = v; touch(); } });
        $('ae-alpha').addEventListener('input', () => { st.draft.alpha = Number($('ae-alpha').value) / 100; $('ae-alpha-v').textContent = Math.round(st.draft.alpha * 100) + '%'; touch(); });
        $('ae-goto').addEventListener('change', () => { const r = Math.max(0, Math.min(233, Math.floor(Number($('ae-goto').value) || 0))); $('ae-sheet').scrollTop = r * 16 * SHEET_SCALE - 8; });
        $('ae-save').onclick = save;
        $('ae-reset').onclick = resetSel;
        $('ae-export').onclick = exportFile;
        const sheet = $('ae-sheet'), cv = $('ae-sheet-cv'), hover = $('ae-hover');
        cv.addEventListener('mousemove', e => {
            const t = tileAtEvent(e);
            hover.style.display = 'block';
            hover.style.left = (t.c * 16 * SHEET_SCALE) + 'px'; hover.style.top = (t.r * 16 * SHEET_SCALE) + 'px';
            hover.title = t.c + ', ' + t.r;
        });
        cv.addEventListener('mouseleave', () => { hover.style.display = 'none'; });
        cv.addEventListener('click', e => { const t = tileAtEvent(e); addFrame(t.c, t.r); });
        void sheet;
    }
    function tileAtEvent(e) {
        const cv = $('ae-sheet-cv'), r = cv.getBoundingClientRect();
        const c = Math.floor((e.clientX - r.left) / (16 * SHEET_SCALE)), row = Math.floor((e.clientY - r.top) / (16 * SHEET_SCALE));
        return { c: Math.max(0, Math.min(16, c)), r: Math.max(0, Math.min(233, row)) };
    }
    function texts() {
        const m = $('anim-editor-modal'); if (!m) return;
        m.querySelector('.ae-title').textContent = tr('ae_title', '🎞️ Block animations (secret)');
        $('ae-ms-lbl').textContent = tr('ae_speed', 'Time per frame');
        $('ae-alpha-lbl').textContent = tr('ae_alpha', 'Opacity in the world');
        $('ae-frames-h').textContent = tr('ae_frames', 'Frames (in order):');
        $('ae-sheet-h').textContent = tr('ae_sheet', 'blocks.png: click a tile to add it as the last frame');
        $('ae-goto-lbl').textContent = tr('ae_goto', 'Go to row');
        $('ae-reset').textContent = tr('ae_reset', 'Back to default');
        $('ae-export').textContent = tr('ae_export', 'Download anim-frames.js');
        $('ae-save').textContent = tr('ae_save', 'Save');
    }
    function drawSheet() {
        const im = img(), cv = $('ae-sheet-cv');
        if (!im || !im.complete || !im.naturalWidth) { setTimeout(drawSheet, 300); return; }
        cv.width = im.naturalWidth * SHEET_SCALE; cv.height = im.naturalHeight * SHEET_SCALE;
        // su tamaño en pantalla = su tamaño real (si no, la regla general "canvas { width: 100%; height: 100% }" la aplasta)
        cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(im, 0, 0, cv.width, cv.height);
        g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
        for (let x = 0; x <= cv.width; x += 16 * SHEET_SCALE) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, cv.height); g.stroke(); }
        for (let y = 0; y <= cv.height; y += 16 * SHEET_SCALE) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(cv.width, y + 0.5); g.stroke(); }
    }
    function tileCanvas(f, size) {
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        c.style.width = size + 'px'; c.style.height = size + 'px';
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        const im = img();
        if (im && im.complete && im.naturalWidth) {
            if (f[2] === 'flip') { g.translate(16, 0); g.scale(-1, 1); }
            g.drawImage(im, f[0] * 16, f[1] * 16, 16, 16, 0, 0, 16, 16);
        }
        return c;
    }
    function renderList() {
        const L = $('ae-list'); L.innerHTML = '';
        NAMES.forEach(n => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'ae-item' + (n === st.sel ? ' on' : ''); b.dataset.name = n;
            const cfg = n === st.sel && st.draft ? st.draft : currentConfig(n);
            b.appendChild(tileCanvas(cfg.frames[0] || [0, 0], 32));
            const s = document.createElement('span'); s.textContent = tr('ae_n_' + n, LABEL[n]); b.appendChild(s);
            if (readLS()[n]) { const d = document.createElement('i'); d.className = 'ae-mod'; d.title = tr('ae_modified', 'Changed in this browser'); b.appendChild(d); }
            b.onclick = () => { if (st.dirty && !confirmLeave()) return; select(n); };
            L.appendChild(b);
        });
    }
    function confirmLeave() { return true; }   // (los cambios sin guardar se pierden al cambiar de bloque; se avisa con el punto en "Save")
    function renderFrames() {
        const F = $('ae-frames'); F.innerHTML = '';
        st.draft.frames.forEach((f, i) => {
            const box = document.createElement('div'); box.className = 'ae-frame';
            box.appendChild(tileCanvas(f, 40));
            const n = document.createElement('small'); n.textContent = (i + 1) + ' · ' + f[0] + ',' + f[1]; box.appendChild(n);
            const tools = document.createElement('div'); tools.className = 'ae-ftools';
            const mk = (txt, tip, fn, dis) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = tip; b.disabled = !!dis; b.onclick = fn; tools.appendChild(b); return b; };
            mk('◀', tr('ae_left', 'Move left'), () => { swap(i, i - 1); }, i === 0);
            const fl = mk('⇋', tr('ae_flip', 'Flip left ↔ right'), () => { if (f[2] === 'flip') f.length = 2; else f[2] = 'flip'; touch(); renderFrames(); });
            if (f[2] === 'flip') fl.classList.add('on');
            if (st.draft.blend) fl.disabled = true;           // (la lana arcoíris mezcla colores: no se voltea)
            mk('▶', tr('ae_right', 'Move right'), () => { swap(i, i + 1); }, i === st.draft.frames.length - 1);
            mk('✕', tr('ae_remove', 'Remove'), () => { if (st.draft.frames.length <= 1) return; st.draft.frames.splice(i, 1); touch(); renderFrames(); }, st.draft.frames.length <= 1);
            box.appendChild(tools);
            F.appendChild(box);
        });
    }
    function swap(a, b) {
        const F = st.draft.frames; if (b < 0 || b >= F.length) return;
        const t = F[a]; F[a] = F[b]; F[b] = t; touch(); renderFrames();
    }
    function addFrame(c, r) {
        if (!st.draft) return;
        if (st.draft.frames.length >= 64) return;
        st.draft.frames.push([c, r]); touch(); renderFrames();
        const F = $('ae-frames'); F.scrollLeft = F.scrollWidth;
    }
    function touch() { st.dirty = true; $('ae-saved').textContent = tr('ae_unsaved', '● Not saved'); $('ae-saved').className = 'ae-saved warn'; }
    function select(n) {
        st.sel = n; st.draft = currentConfig(n); st.dirty = false;
        $('ae-name').textContent = tr('ae_n_' + n, LABEL[n]);
        $('ae-ms').value = st.draft.ms;
        $('ae-alpha-row').style.display = st.draft.blend ? 'none' : '';
        $('ae-alpha').value = Math.round(st.draft.alpha * 100); $('ae-alpha-v').textContent = Math.round(st.draft.alpha * 100) + '%';
        $('ae-ms-lbl').textContent = st.draft.blend ? tr('ae_speed_blend', 'Time per color (shared by all rainbow blocks)') : tr('ae_speed', 'Time per frame');
        $('ae-hint').textContent = st.draft.blend ? tr('ae_hint_blend', 'Each frame fades smoothly into the next one, and the last one fades into the first.') : tr('ae_hint', 'All blocks of this kind change frame at the same time.');
        $('ae-saved').textContent = readLS()[n] ? tr('ae_custom', 'Using your frames') : tr('ae_default', 'Using the default frames');
        $('ae-saved').className = 'ae-saved';
        $('ae-reset').disabled = !readLS()[n];   // ya está como de fábrica: no hay nada que regresar
        renderList(); renderFrames();
        const first = st.draft.frames[0];
        if (first) { $('ae-goto').value = first[1]; $('ae-sheet').scrollTop = Math.max(0, first[1] * 16 * SHEET_SCALE - 40); }
    }
    // Vista previa: igual que en el mundo (con fundido para la lana arcoíris)
    function drawPreview() {
        const cv = $('ae-preview'); if (!cv || !st.draft) return;
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 16, 16);
        const im = img(); if (!im || !im.complete || !im.naturalWidth) return;
        const F = st.draft.frames, n = F.length; if (!n) return;
        const t = (performance.now() - st.t0) / st.draft.ms;
        const i = Math.floor(t) % n;
        const draw = (f, a) => {
            g.save(); g.globalAlpha = a;
            if (f[2] === 'flip') { g.translate(16, 0); g.scale(-1, 1); }
            g.drawImage(im, f[0] * 16, f[1] * 16, 16, 16, 0, 0, 16, 16);
            g.restore();
        };
        if (st.draft.blend) { draw(F[i], 1); draw(F[(i + 1) % n], t - Math.floor(t)); }
        else draw(F[i], st.draft.alpha);
    }
    function save() {
        const o = readLS();
        const n = st.sel, d = st.draft, D = window.MBW_ANIM_DEFAULTS[n];
        const entry = { frames: d.frames.map(f => f.slice()), ms: d.ms };
        if (!d.blend) entry.alpha = d.alpha;
        o[n] = entry;
        if (d.blend) NAMES.forEach(k => { if (RB_PREFIX[k] && o[k]) o[k].ms = d.ms; });   // (las tres lanas arcoíris comparten el mismo reloj)
        writeLS(o);
        if (d.blend) window.rainbowAnim.period = d.ms;
        void D;
        st.dirty = false;
        window.mbwAnimReload();
        $('ae-saved').textContent = tr('ae_saved', '✔ Saved in this browser'); $('ae-saved').className = 'ae-saved ok';
        $('ae-reset').disabled = false;
        renderList();
    }
    function resetSel() {
        const o = readLS(); delete o[st.sel]; writeLS(o);
        if (window.MBW_ANIM_DEFAULTS[st.sel].blend) window.rainbowAnim.period = window.MBW_ANIM_DEFAULTS[st.sel].ms;
        window.mbwAnimReload();
        select(st.sel);
    }
    // El archivo scripts/anim-frames.js con TODO lo que vale ahora (lo de fábrica no se escribe)
    function exportFile() {
        if (st.dirty) save();
        const out = {};
        NAMES.forEach(n => {
            const c = currentConfig(n), D = window.MBW_ANIM_DEFAULTS[n];
            const same = JSON.stringify(c.frames) === JSON.stringify(defaultFrames(n)) && c.ms === D.ms && (D.blend || c.alpha === (D.alpha !== undefined ? D.alpha : 1));
            if (same) return;
            out[n] = { frames: c.frames, ms: c.ms };
            if (!D.blend) out[n].alpha = c.alpha;
        });
        const body = '// 🎞️ Cuadros de las animaciones de bloques (magma, fuego, lana / alfombra arcoíris) para TODOS los que usan el editor.\n' +
            '// Hecho con el editor secreto de animaciones (Ctrl + Shift + Alt + A). Vacío = los de fábrica (scripts/rendering.js).\n' +
            '// Cada cuadro es [columna, fila] de blocks.png (en cuadros de 16 px); "flip" = volteado de izquierda a derecha.\n' +
            'window.MBW_ANIM_FRAMES = ' + JSON.stringify(out, null, 2) + ';\n';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([body], { type: 'application/javascript' }));
        a.download = 'anim-frames.js';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        st.lastExport = body;
    }
    function open() {
        build(); texts();
        $('anim-editor-modal').style.display = 'block';
        st.open = true; st.t0 = performance.now();
        drawSheet();
        select(st.sel);
        clearInterval(st.timer); st.timer = setInterval(drawPreview, 40);
    }
    function close() {
        const m = $('anim-editor-modal'); if (m) m.style.display = 'none';
        st.open = false; clearInterval(st.timer); st.timer = null;
    }
    window.openAnimEditor = open;
    window.closeAnimEditor = close;
    // al cargar: la velocidad guardada de la lana arcoíris
    try {
        ['cloth_rainbow', 'bdcloth_rainbow', 'carpet_rainbow'].some(function (k) {
            const c = window.mbwAnimConfig(k);
            if (c && c.ms && c.ms !== window.MBW_ANIM_DEFAULTS[k].ms) { window.rainbowAnim.period = c.ms; return true; }
            return false;
        });
    } catch (e) { /* de fábrica */ }

    // La combinación secreta: Ctrl + Shift + Alt + A
    window.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey && e.shiftKey && e.altKey)) return;
        if (e.code !== 'KeyA') return;
        e.preventDefault();
        if (st.open) close(); else open();
    }, true);
})();
