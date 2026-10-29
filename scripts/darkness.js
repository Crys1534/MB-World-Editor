// ==========================================================
// 🌑 OSCURIDAD BAJO TIERRA + ✨ AURAS DE LUZ + 🗺️ FRANJA DE BIOMAS   (solo visual: nada de esto se guarda en el mundo)
//
// · Oscuridad: en el Overworld, mientras más abajo, más oscuro. Y 90 = la oscuridad más leve, Y 66 (y más abajo) = la más oscura.
//   Se apaga / prende en la pestaña View (grupo "Darkness"); viene prendida. La primera vez que alguien la ve, sale un aviso
//   que dice que se puede apagar ahí (y un botón para apagarla en ese momento).
// · Auras: alrededor del jugador y de algunas luces la oscuridad no llega (un círculo con borde suave):
//     antorcha = radio grande · antorcha de redstone = radio chico · lámpara de redstone encendida y jack o'lantern = radio grande
//     coral lantern = radio grande y además un brillo magenta · odd torch = al revés: hace un círculo de OSCURIDAD mediano.
// · Biomas: una franja de colores arriba del mundo con el bioma de cada columna (biomeList del mundo). Pestaña View, grupo "Biomes".
//
// Cómo se dibuja (rápido): se arma una imagen chiquita con UN píxel por cuadro del mundo (negro con más o menos transparencia)
// y se estira sobre la pantalla con suavizado, así las orillas quedan en degradado. Solo se rehace cuando la cámara cambia de cuadro,
// cuando se edita algo o cuando se mueve el jugador.
// ==========================================================
(function () {
    'use strict';

    const KEY = { dark: 'mbw_darkness', biomes: 'mbw_show_biomes', notice: 'mbw_dark_notice_seen' };
    function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function write(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* no se recuerda */ } }
    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : fb; }

    const D = window.mbwDarkness = {
        on: read(KEY.dark) !== '0',            // de fábrica: prendida
        biomes: read(KEY.biomes) === '1',
        TOP: 90, BOTTOM: 66,                   // Y donde empieza (lo más leve) y donde ya es lo más oscuro
        MIN: 0.14, MAX: 0.86,                  // qué tan oscuro en Y 90 y en Y 66 (1 = negro)
        rev: 0,                                // sube cada vez que se edita el mundo (para rehacer la imagen)
        stats: { builds: 0, lights: 0, maxAlpha: 0, drawn: false }
    };

    // Las luces (radio en cuadros). "dark" = en vez de quitar oscuridad, la pone (odd torch). "color" = brillo de color.
    const LIGHTS = {
        torch: { r: 6.5 },
        redstone: { r: 3.5 },
        lamp: { r: 6.5 },
        jack: { r: 6.5 },
        coral: { r: 6, color: [255, 70, 225] },
        odd: { r: 4.5, dark: 0.75 },
        player: { r: 3.5 }
    };
    D.LIGHTS = LIGHTS;
    let lightOf = null;   // Map: dibujo del bloque (de texturesMap) -> tipo de luz
    function buildLightMap() {
        const TM = window.texturesMap;
        if (!TM) return null;
        const m = new Map();
        const add = (keys, kind) => keys.forEach(k => { if (TM[k]) m.set(TM[k], kind); });
        add(['th_1', 'th_2', 'th_3', 'th'], 'torch');
        add(['rstorch', 'rstorch_1', 'rstorch_2', 'rstorch_3'], 'redstone');
        add(['ortorch_1', 'ortorch_2', 'ortorch_3', 'ortorch'], 'odd');
        add(['light_true'], 'lamp');
        add(['jl'], 'jack');
        add(['lant_1', 'lant_2', 'lant_3', 'lant'], 'coral');
        return m;
    }
    D.lightKindAt = function (x, y) {
        if (!lightOf) lightOf = buildLightMap();
        const wc = window.worldCache;
        const o = wc && wc[x] ? wc[x][y] : null;
        return o && lightOf ? (lightOf.get(o) || null) : null;
    };

    // Qué tan oscuro es la fila Y (0 = nada, 1 = negro), sin contar luces
    D.darkAt = function (y) {
        if (y > D.TOP) return 0;
        if (y <= D.BOTTOM) return D.MAX;
        return D.MIN + (D.MAX - D.MIN) * (D.TOP - y) / (D.TOP - D.BOTTOM);
    };

    function scene() { return (typeof mbwom !== 'undefined' && mbwom.currentScene) ? mbwom.currentScene : 1; }
    function ready() {
        return typeof mbwom !== 'undefined' && mbwom.scene && window.worldCache && typeof camera !== 'undefined' && typeof tileSize !== 'undefined' && tileSize > 0 && typeof canvas !== 'undefined';
    }
    function playerTile() {
        const w = (typeof mbwom !== 'undefined') ? mbwom.world : null;
        if (!w || w.worldX === undefined || w.worldY === undefined) return null;
        if ((w.scene || 1) !== scene()) return null;
        const px = Number(w.worldX), py = -Number(w.worldY);
        if (!isFinite(px) || !isFinite(py)) return null;
        return { x: px, y: py + 1 };       // el centro del cuerpo (los pies + 1 cuadro)
    }

    // ---------------------------------------------------------
    // La imagen de la oscuridad (1 píxel = 1 cuadro)
    // ---------------------------------------------------------
    const mask = document.createElement('canvas');
    const mctx = mask.getContext('2d');
    let maskKey = '', maskInfo = null, lastForce = 0;
    const cacheIds = new WeakMap(); let cacheSeq = 0;
    function cacheId(o) { if (!o) return 0; let id = cacheIds.get(o); if (!id) { id = ++cacheSeq; cacheIds.set(o, id); } return id; }

    function build(X0, Y0, w, h) {
        if (!lightOf) lightOf = buildLightMap();
        const A = new Float32Array(w * h);
        const Y1 = Y0 + h - 1;
        let any = false;
        for (let j = 0; j < h; j++) {                      // fila j de la imagen = Y1 - j en el mundo (arriba en la pantalla = Y más alto)
            const a = D.darkAt(Y1 - j);
            if (a > 0) any = true;
            if (a === 0) continue;
            for (let i = 0; i < w; i++) A[j * w + i] = a;
        }
        // luces cercanas (también las que están un poco fuera de la pantalla: su círculo se alcanza a ver)
        const R = 7;
        const wc = window.worldCache || [];
        const glows = [], found = [];
        const xa = Math.max(0, X0 - R), xb = Math.min(wc.length - 1, X0 + w - 1 + R);
        const ya = Math.max(0, Y0 - R), yb = Y1 + R;
        if (lightOf && lightOf.size) {
            for (let x = xa; x <= xb; x++) {
                const col = wc[x];
                if (!col) continue;
                const top = Math.min(col.length - 1, yb);
                for (let y = ya; y <= top; y++) {
                    const o = col[y];
                    if (o === undefined || o === null) continue;
                    const k = lightOf.get(o);
                    if (k) found.push({ x: x + 0.5, y: y + 0.5, kind: k });
                }
            }
        }
        const pt = playerTile();
        if (pt) found.push({ x: pt.x, y: pt.y, kind: 'player' });
        D.stats.lights = found.length;
        // primero las que quitan oscuridad, después las odd torch (su oscuridad gana)
        found.sort((p, q) => (LIGHTS[p.kind].dark ? 1 : 0) - (LIGHTS[q.kind].dark ? 1 : 0));
        for (let n = 0; n < found.length; n++) {
            const L = found[n], def = LIGHTS[L.kind];
            const r = def.r, core = r * 0.4;
            const i0 = Math.max(0, Math.floor(L.x - r - X0)), i1 = Math.min(w - 1, Math.ceil(L.x + r - X0));
            const j0 = Math.max(0, Math.floor(Y1 - (L.y + r))), j1 = Math.min(h - 1, Math.ceil(Y1 - (L.y - r)));
            for (let j = j0; j <= j1; j++) {
                const cy = Y1 - j + 0.5;
                for (let i = i0; i <= i1; i++) {
                    const cx = X0 + i + 0.5;
                    const d = Math.sqrt((cx - L.x) * (cx - L.x) + (cy - L.y) * (cy - L.y));
                    if (d >= r) continue;
                    const s = d <= core ? 1 : 1 - (d - core) / (r - core);      // 1 en el centro → 0 en la orilla
                    const k = j * w + i;
                    if (def.dark) { const v = def.dark * s; if (v > A[k]) { A[k] = v; any = true; } }
                    else A[k] = A[k] * (1 - s);
                }
            }
            if (def.color) glows.push({ x: L.x, y: L.y, r: r, color: def.color, k: 0.18 + 0.4 * (D.darkAt(Math.floor(L.y)) / D.MAX) });
        }
        if (mask.width !== w || mask.height !== h) { mask.width = w; mask.height = h; }
        let maxA = 0, firstRow = h;
        const img = mctx.createImageData(w, h), px = img.data;
        for (let k = 0; k < A.length; k++) {
            const a = A[k];
            if (a > maxA) maxA = a;
            if (a > 0.004 && firstRow === h) firstRow = Math.floor(k / w);
            const p = k * 4;
            px[p] = 4; px[p + 1] = 4; px[p + 2] = 14; px[p + 3] = Math.round(a * 255);
        }
        mctx.putImageData(img, 0, 0);
        // Se estira UNA vez a tamaño de pantalla (con suavizado = degradado) y en cada cuadro solo se copia (rápido)
        const ts = tileSize, bw = Math.ceil(w * ts), bh = Math.ceil(h * ts);
        const top = Math.max(0, Math.floor((firstRow - 1) * ts));        // (las filas de arriba sin oscuridad no se copian)
        if (maxA >= 0.004 && bw * bh <= 16000000) {
            if (big.width !== bw || big.height !== bh) { big.width = bw; big.height = bh; } else bctx.clearRect(0, 0, bw, bh);
            bctx.imageSmoothingEnabled = true;
            bctx.drawImage(mask, 0, 0, w, h, 0, 0, w * ts, h * ts);
        }
        D.stats.builds++;
        D.stats.maxAlpha = maxA;
        return { X0: X0, Y0: Y0, w: w, h: h, ts: ts, top: top, bw: bw, bh: bh, empty: !any || maxA < 0.004, glows: glows, maxA: maxA, bigOk: bw * bh <= 16000000 };
    }
    const big = document.createElement('canvas');
    const bctx = big.getContext('2d');

    function drawDarkness(c) {
        if (!D.on || scene() !== 1) { D.stats.drawn = false; return; }
        const ts = tileSize;
        const X0 = Math.floor(camera.x) - 1, Y0 = Math.floor(camera.y) - 1;
        const w = Math.ceil(canvas.width / ts) + 3, h = Math.ceil(canvas.height / ts) + 3;
        if (w * h > 1200000) { D.stats.drawn = false; return; }            // zoom tan alejado que no vale la pena
        const pt = playerTile();
        const key = [X0, Y0, w, h, ts, D.rev, cacheId(window.worldCache), pt ? Math.floor(pt.x * 2) + ',' + Math.floor(pt.y * 2) : '-'].join('|');
        const now = performance.now();
        if (key !== maskKey || !maskInfo || now - lastForce > 1500) {
            maskInfo = build(X0, Y0, w, h);
            maskKey = key; lastForce = now;
        }
        const M = maskInfo;
        D.stats.drawn = !M.empty;
        if (M.empty) return;
        const dx = (M.X0 - camera.x) * ts, dy = canvas.height - (M.Y0 + M.h - camera.y) * ts;
        c.save();
        if (M.bigOk) {
            const sy = M.top, sh = M.bh - M.top;
            if (sh > 0) c.drawImage(big, 0, sy, M.bw, sh, Math.round(dx), Math.round(dy + sy), M.bw, sh);
        } else {
            c.imageSmoothingEnabled = true;
            c.drawImage(mask, 0, 0, M.w, M.h, dx, dy, M.w * ts, M.h * ts);
        }
        // brillo de color (coral lantern)
        if (M.glows.length) {
            c.globalCompositeOperation = 'screen';
            M.glows.forEach(function (g) {
                const sx = (g.x - camera.x) * ts, sy = canvas.height - (g.y - camera.y) * ts, rr = g.r * ts;
                const grad = c.createRadialGradient(sx, sy, 0, sx, sy, rr);
                const col = g.color.join(',');
                grad.addColorStop(0, 'rgba(' + col + ',' + g.k.toFixed(3) + ')');
                grad.addColorStop(0.45, 'rgba(' + col + ',' + (g.k * 0.55).toFixed(3) + ')');
                grad.addColorStop(1, 'rgba(' + col + ',0)');
                c.fillStyle = grad;
                c.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
            });
        }
        c.restore();
        if (M.maxA >= 0.3) maybeNotice();
    }

    // ---------------------------------------------------------
    // Aviso de la primera vez
    // ---------------------------------------------------------
    let noticeShown = false;
    function maybeNotice() {
        if (noticeShown || read(KEY.notice) === '1') return;
        noticeShown = true;
        write(KEY.notice, '1');
        const box = document.createElement('div');
        box.id = 'dark-notice';
        box.innerHTML = '<div class="dn-icon" aria-hidden="true"></div><div class="dn-text"><b class="dn-title"></b><span class="dn-body"></span></div>' +
            '<div class="dn-btns"><button type="button" class="dn-off"></button><button type="button" class="dn-ok"></button></div>';
        box.querySelector('.dn-title').textContent = tr('dark_notice_title', 'Underground darkness');
        box.querySelector('.dn-body').textContent = tr('dark_notice_body', 'Below Y 90 the world gets darker the deeper you go (torches and the player light it up). You can turn it off any time in View > Darkness.');
        box.querySelector('.dn-off').textContent = tr('dark_notice_off', 'Turn it off');
        box.querySelector('.dn-ok').textContent = tr('dark_notice_ok', 'Got it');
        const close = () => { box.classList.remove('show'); setTimeout(() => box.remove(), 250); };
        box.querySelector('.dn-off').onclick = () => { window.setDarkness(false); close(); };
        box.querySelector('.dn-ok').onclick = close;
        (document.getElementById('workspace') || document.body).appendChild(box);
        requestAnimationFrame(() => box.classList.add('show'));
        D.noticeEl = box;
    }

    // ---------------------------------------------------------
    // 🗺️ Franja de biomas
    // ---------------------------------------------------------
    const BIOME_COLORS = {
        forest: '#2f8f3a', plain: '#9ccc3d', desert: '#e3cf7a', mountain: '#8d8d8d',
        water: '#3b6fe0', ruins: '#9a6a3a', mushroom: '#b24fc9'
    };
    D.BIOME_COLORS = BIOME_COLORS;
    function biomeList() {
        const w = (typeof mbwom !== 'undefined') ? mbwom.world : null;
        return w && Array.isArray(w.biomeList) ? w.biomeList : null;
    }
    D.biomeAt = function (x) {
        const b = biomeList();
        if (!b || x < 0 || x >= b.length) return null;
        return typeof b[x] === 'string' ? b[x] : null;
    };
    D.biomeName = function (id) {
        if (!id) return '';
        return tr('biome_' + id, id.charAt(0).toUpperCase() + id.slice(1));
    };
    D.bandHeight = function () { return 14; };
    function drawBiomes(c) {
        if (!D.biomes || scene() !== 1) return;
        const b = biomeList();
        if (!b) return;
        const ts = tileSize, H = D.bandHeight();
        const X0 = Math.floor(camera.x), X1 = Math.ceil(camera.x + canvas.width / ts);
        c.save();
        c.font = 'bold 11px Arial, sans-serif';
        c.textBaseline = 'middle';
        let x = X0;
        while (x <= X1) {
            const id = (x >= 0 && x < b.length) ? b[x] : null;
            let e = x;
            while (e + 1 <= X1 && ((e + 1 >= 0 && e + 1 < b.length) ? b[e + 1] : null) === id) e++;
            const sx = Math.round((x - camera.x) * ts), ex = Math.round((e + 1 - camera.x) * ts);
            c.fillStyle = id ? (BIOME_COLORS[id] || '#666') : 'rgba(0,0,0,0.35)';
            c.globalAlpha = id ? 0.9 : 1;
            c.fillRect(sx, 0, ex - sx, H);
            c.globalAlpha = 1;
            if (id && ex - Math.max(sx, 0) > 54) {
                const label = D.biomeName(id);
                const lx = Math.max(sx, 0) + 5;
                c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.fillStyle = '#fff';
                c.strokeText(label, lx, H / 2 + 0.5); c.fillText(label, lx, H / 2 + 0.5);
            }
            x = e + 1;
        }
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(0, H, canvas.width, 1);
        c.restore();
    }
    // El texto que se agrega a "X: .. Y: .." (abajo a la izquierda) con el bioma de la columna del mouse
    window.mbwBiomeLabel = function (x) {
        if (!D.biomes || scene() !== 1) return '';
        const id = D.biomeAt(x);
        return id ? '  ·  ' + D.biomeName(id) : '';
    };

    // ---------------------------------------------------------
    // Enganche con main.js (se llama en cada cuadro, después del jugador)
    // ---------------------------------------------------------
    D.draw = function (c) {
        if (!ready()) return;
        try { drawDarkness(c); } catch (e) { if (!D.err) { D.err = true; console.error('darkness:', e); } }
        try { drawBiomes(c); } catch (e) { if (!D.err2) { D.err2 = true; console.error('biomes:', e); } }
    };
    D.invalidate = function () { D.rev++; };

    // Cada edición del mundo (renderBlock) o mundo nuevo (initializeWorldCache) rehace la imagen de la oscuridad
    ['renderBlock', 'initializeWorldCache', 'initializeWorldCacheAsync'].forEach(function (name) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__dkWrapped) return;
        const wrapped = function () { D.rev++; lightOf = lightOf || null; return orig.apply(this, arguments); };
        wrapped.__dkWrapped = true;
        window[name] = wrapped;
    });

    // ---------------------------------------------------------
    // Botones (pestaña View) y Configuration > Display
    // ---------------------------------------------------------
    function sync() {
        const a = document.getElementById('darkness-toggle'); if (a) a.checked = D.on;
        const b = document.getElementById('biomes-toggle'); if (b) b.checked = D.biomes;
        const c = document.getElementById('animations-toggle'); if (c) c.checked = window.mbwAnimationsOn !== false;
    }
    window.setDarkness = function (on) {
        D.on = !!on;
        write(KEY.dark, on ? '1' : '0');
        if (!on && D.noticeEl) { D.noticeEl.remove(); D.noticeEl = null; }
        sync();
    };
    window.setShowBiomes = function (on) {
        D.biomes = !!on;
        write(KEY.biomes, on ? '1' : '0');
        sync();
    };
    window.mbwDarknessSync = sync;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
