// ==========================================================
// 🔭 VISTA DE LEJOS (zoom de 3 % a 10 %): rápida aunque se vea el mundo entero
//
// Por qué se trababa: el mundo se dibuja cuadro por cuadro (un "dibujo" de blocks.png por cada bloque). Con zoom 100 % se
// ven ~90 x 45 = 4 000 bloques; con zoom 10 % se ven ~875 x 420 = 370 000, y con 3 % casi 4 millones. Y cada vez que la cámara
// pasa a otro cuadro (al moverte, eso pasa en CADA fotograma porque un bloque mide 1 o 2 píxeles) se vuelven a dibujar todos.
//
// Cómo se arregla: cuando un bloque mide menos de 4 píxeles en la pantalla, el mundo se dibuja desde un "mapa" del mundo
// entero hecho UNA sola vez, con 1 píxel por bloque (el color promedio de su dibujo). En cada fotograma solo se copia el
// pedazo que se ve, estirado (UNA sola operación, mida lo que mida el mundo). Al editar un bloque solo cambia su píxel.
// El fondo (cielo / Nether / End) también se guarda hecho y solo se rehace si cambia el tamaño de la ventana o el zoom.
// Con zoom de 25 % para arriba se usa el dibujo normal (ahí sí se ven los dibujos de cada bloque).
// ==========================================================
(function () {
    'use strict';
    const MAX_TS = 4;                         // menos de 4 píxeles por bloque = vista de lejos
    const F = window.mbwFarView = { enabled: true, stats: { builds: 0, pixels: 0, draws: 0, mode: 'normal', bgBuilds: 0, fallback: false } };

    const map = document.createElement('canvas');          // 1 píxel = 1 bloque (el mundo entero)
    const mctx = map.getContext('2d', { willReadFrequently: false });
    let builtFor = null, dirty = true, mapH = 0;
    let pending = [];                                      // bloques editados desde el último fotograma
    let wasFar = false;

    // ------------------------------------------------ color promedio de cada dibujo de bloque
    let atlas = null;                                      // los píxeles de blocks.png (null = aún no, false = no se pueden leer)
    let small = null;                                      // blocks.png achicado 16 veces (para cuando no se pueden leer sus píxeles)
    const colorByPos = new Map();                          // 'x,y' de blocks.png -> color (RGBA en un número)
    const colorByImg = new WeakMap();                      // dibujos sueltos (el fence que se conecta)
    function blocksImg() { const im = window.images && window.images.blocks; return im && im.complete && im.naturalWidth ? im : null; }
    function readAtlas() {
        if (atlas !== null) return atlas;
        const im = blocksImg();
        if (!im) return null;
        try {
            const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
            const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
            atlas = { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data };
        } catch (e) { atlas = false; F.stats.fallback = true; }      // (abierto como archivo: el navegador no deja leer la imagen)
        return atlas;
    }
    function avgOf(d, w, x0, y0) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let y = y0; y < y0 + 16; y++) for (let x = x0; x < x0 + 16; x++) {
            const p = (y * w + x) * 4, al = d[p + 3];
            if (!al) continue;
            r += d[p] * al; g += d[p + 1] * al; b += d[p + 2] * al; a += al;
        }
        if (!a) return 0;
        const A = Math.round(a / 256);
        return ((A << 24) | (Math.round(b / a) << 16) | (Math.round(g / a) << 8) | Math.round(r / a)) >>> 0;
    }
    function colorOf(t) {
        if (t.img) {
            if (colorByImg.has(t.img)) return colorByImg.get(t.img);
            let v = 0x80808080;
            try {
                const c = document.createElement('canvas'); c.width = 16; c.height = 16;
                const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(t.img, 0, 0, 16, 16, 0, 0, 16, 16);
                v = avgOf(x.getImageData(0, 0, 16, 16).data, 16, 0, 0);
            } catch (e) { /* sin permiso para leer: gris */ }
            colorByImg.set(t.img, v);
            return v;
        }
        const k = t.x + ',' + t.y;
        let v = colorByPos.get(k);
        if (v === undefined) {
            const A = atlas;
            v = (A && t.x >= 0 && t.y >= 0 && t.x + 16 <= A.w && t.y + 16 <= A.h) ? avgOf(A.d, A.w, t.x, t.y) : 0;
            colorByPos.set(k, v);
        }
        return v;
    }
    function smallAtlas() {
        if (small) return small;
        const im = blocksImg(); if (!im) return null;
        small = document.createElement('canvas');
        small.width = Math.ceil(im.naturalWidth / 16); small.height = Math.ceil(im.naturalHeight / 16);
        const x = small.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(im, 0, 0, small.width, small.height);
        return small;
    }

    // ------------------------------------------------ el mapa
    function worldH(wc) {
        let h = 0;
        const sc = (typeof mbwom !== 'undefined' && Array.isArray(mbwom.scene)) ? mbwom.scene : null;
        if (sc) for (let x = 0; x < sc.length; x++) { const c = sc[x]; if (c && c.length > h) h = c.length; }
        for (let x = 0; x < wc.length; x++) { const c = wc[x]; if (c && c.length > h) h = c.length; }
        return h;
    }
    function build() {
        const wc = window.worldCache;
        if (!wc || !blocksImg()) return false;
        const A = readAtlas();
        if (A === null) return false;
        const W = Math.max(1, wc.length), H = Math.max(1, worldH(wc));
        if (map.width !== W || map.height !== H) { map.width = W; map.height = H; } else mctx.clearRect(0, 0, W, H);
        mapH = H;
        if (A) {
            const img = mctx.createImageData(W, H);
            const px = new Uint32Array(img.data.buffer);
            for (let x = 0; x < wc.length; x++) {
                const col = wc[x]; if (!col) continue;
                for (let y = 0; y < col.length; y++) { const t = col[y]; if (t) px[(H - 1 - y) * W + x] = colorOf(t); }
            }
            mctx.putImageData(img, 0, 0);
        } else {                                        // sin poder leer blocks.png: cada bloque se copia de la hoja achicada
            const s = smallAtlas(); if (!s) return false;
            mctx.imageSmoothingEnabled = false;
            for (let x = 0; x < wc.length; x++) {
                const col = wc[x]; if (!col) continue;
                for (let y = 0; y < col.length; y++) { const t = col[y]; if (t) drawOne(t, x, H - 1 - y); }
            }
        }
        builtFor = wc; dirty = false; pending = [];
        F.stats.builds++;
        return true;
    }
    function drawOne(t, x, row) {
        if (t.img) { try { mctx.drawImage(t.img, 0, 0, 16, 16, x, row, 1, 1); } catch (e) { /* aún no cargó */ } return; }
        mctx.drawImage(small, t.x / 16, t.y / 16, 1, 1, x, row, 1, 1);
    }
    let one = null, oneData = null, one32 = null;
    function setPixel(x, y) {
        const wc = window.worldCache;
        if (x < 0 || y < 0 || x >= map.width || y >= mapH) { dirty = true; return; }   // fuera del mapa (el mundo creció): se rehace entero
        const t = wc[x] ? wc[x][y] : null;
        const row = mapH - 1 - y;
        if (atlas) {
            if (!one) { one = mctx.createImageData(1, 1); oneData = one.data; one32 = new Uint32Array(oneData.buffer); }
            one32[0] = t ? colorOf(t) : 0;
            mctx.putImageData(one, x, row);
        } else {
            mctx.clearRect(x, row, 1, 1);
            if (t && smallAtlas()) drawOne(t, x, row);
        }
        F.stats.pixels++;
    }
    function applyPending() {
        if (pending.length > 20000) { dirty = true; pending = []; return; }
        for (let i = 0; i < pending.length; i += 2) setPixel(pending[i], pending[i + 1]);
        pending = [];
    }

    // ------------------------------------------------ el fondo (no se mueve con la cámara: se guarda hecho)
    const bg = document.createElement('canvas');
    const bgx = bg.getContext('2d', { alpha: false });
    let bgKey = '';
    function bgReady(k) { const im = window.images && window.images[k]; return im && im.complete && im.naturalWidth ? 1 : 0; }
    function background(c, W, H) {
        const sc = (typeof mbwom !== 'undefined' && mbwom.currentScene) || 1;
        const key = [W, H, typeof currentZoom !== 'undefined' ? currentZoom : 0, sc, window.showDimBackgrounds ? 1 : 0, bgReady('overworld-bg'), bgReady('nether-bg'), bgReady('end-bg')].join('|');
        if (key !== bgKey) {
            if (bg.width !== W || bg.height !== H) { bg.width = W; bg.height = H; }
            if (typeof paintWorldBackground === 'function') paintWorldBackground(bgx, W, H);
            else { bgx.fillStyle = '#7385B9'; bgx.fillRect(0, 0, W, H); }
            bgKey = key; F.stats.bgBuilds++;
        }
        c.drawImage(bg, 0, 0);
    }

    // ------------------------------------------------ dibujar
    function useFar() { return F.enabled && typeof tileSize !== 'undefined' && tileSize > 0 && tileSize < MAX_TS && window.worldCache && typeof camera !== 'undefined'; }
    function drawFar() {
        if (window.worldCache !== builtFor) dirty = true;
        if (dirty) { if (!build()) return false; }
        else if (pending.length) applyPending();
        if (dirty && !build()) return false;
        const W = canvas.width, H = canvas.height, ts = tileSize;
        background(ctx, W, H);
        const sw = W / ts, sh = H / ts;
        const sx = camera.x, sy = mapH - (camera.y + sh);
        // la parte del mapa que cae dentro de la pantalla (lo de afuera del mundo queda con el fondo)
        const x0 = Math.max(0, sx), y0 = Math.max(0, sy);
        const x1 = Math.min(map.width, sx + sw), y1 = Math.min(mapH, sy + sh);
        if (x1 > x0 && y1 > y0) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(map, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * ts, (y0 - sy) * ts, (x1 - x0) * ts, (y1 - y0) * ts);
            ctx.restore();
        }
        F.stats.draws++;
        return true;
    }

    const origDraw = window.drawWorld;
    if (typeof origDraw === 'function') {
        window.drawWorld = function () {
            if (useFar() && drawFar()) { wasFar = true; F.stats.mode = 'far'; return; }
            if (wasFar) { wasFar = false; if (typeof worldDirty !== 'undefined') worldDirty = true; }   // al volver a acercarse: el dibujo normal se rehace
            F.stats.mode = 'normal';
            return origDraw.apply(this, arguments);
        };
    }
    // Cada bloque editado cambia solo su píxel; un mundo nuevo (o otra pestaña / dimensión) rehace el mapa
    const origRB = window.renderBlock;
    if (typeof origRB === 'function') {
        window.renderBlock = function (x, y) {
            const r = origRB.apply(this, arguments);
            if (!dirty) pending.push(x, y, x - 1, y, x + 1, y);     // (el fence de al lado puede cambiar de dibujo)
            return r;
        };
    }
    ['initializeWorldCache', 'initializeWorldCacheAsync'].forEach(function (name) {
        const orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () {
            dirty = true;
            const r = orig.apply(this, arguments);
            if (r && typeof r.then === 'function') r.then(function () { dirty = true; });
            return r;
        };
    });
    F.invalidate = function () { dirty = true; };
    F.map = map;
    F.colorAt = function (x, y) {                        // (para las pruebas) el color del mapa en un bloque
        if (dirty || pending.length) { if (dirty) build(); else applyPending(); }
        try { const d = mctx.getImageData(x, mapH - 1 - y, 1, 1).data; return [d[0], d[1], d[2], d[3]]; } catch (e) { return null; }
    };
})();
