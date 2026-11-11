// =====================================================================
// 🧩 DIBUJO POR TROZOS (▶ Modo Jugar)
// =====================================================================
// Antes, cada cuadro de la pantalla se volvía a dibujar bloque por bloque (miles de dibujos por cuadro).
// Ahora el mundo se guarda dibujado en "trozos" de 16 × 16 bloques: cada trozo se dibuja UNA vez y después solo se pega
// (unas pocas decenas de dibujos por cuadro). Un trozo se vuelve a dibujar solo cuando cambia algo dentro de él.
//   · Cómo sabe que cambió: guarda qué dibujo tenía cada bloque (worldCache); si alguno es otro, se redibuja. Así funciona
//     con cualquier forma de cambiar un bloque (romper, poner, pistones, otro jugador, explosiones, deshacer...).
//   · Los bloques animados (lana arcoíris, magma, fuego) no van dentro del trozo: se dibujan encima en cada cuadro.
//   · Solo con un tamaño de bloque entero (si no, quedarían rayitas entre trozos): si no, se dibuja como siempre.
//   · Se guardan como mucho los trozos que caben en ~3 pantallas; los que no se usan hace más tiempo se borran.
// main.js lo llama desde renderWorldToBuffer / renderSmoothBuffers con mbwChunks.draw(...). Si devuelve false, main.js dibuja como antes.
// =====================================================================
(function () {
    'use strict';
    const C = 16;                                             // bloques por lado de cada trozo
    const cache = new Map();                                  // 'escena|cx|cy' → { cv, refs, anim, img, used }
    let cacheTs = 0, useTick = 0, stats = { built: 0, blits: 0 };
    let forced = null;                                        // (pruebas: true / false fuerza encendido / apagado)
    function on() {
        if (forced !== null) return forced;
        try { if (localStorage.getItem('mbw_chunk_render') === '0') return false; } catch (e) { /* nada */ }
        return !!window.mbwPlaying;
    }
    function ready() { const im = window.images && window.images.blocks; return !!(im && im.complete && im.naturalWidth > 0); }
    function cacheOf(x, y) { const wc = window.worldCache; return wc && wc[x] ? wc[x][y] : undefined; }
    function scene() { try { return (typeof mbwom !== 'undefined' && mbwom.currentScene) || 1; } catch (e) { return 1; } }

    function build(ch, cx, cy, ts) {
        const S = C * ts;
        if (!ch.cv) { ch.cv = document.createElement('canvas'); }
        if (ch.cv.width !== S || ch.cv.height !== S) { ch.cv.width = S; ch.cv.height = S; }
        const g = ch.cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, S, S);
        const refs = ch.refs || (ch.refs = new Array(C * C));
        const anim = [];
        const tw = ts + 0.8;
        for (let i = 0; i < C; i++) {
            const wx = cx * C + i;
            for (let j = 0; j < C; j++) {
                const wy = cy * C + j, o = cacheOf(wx, wy);
                refs[i * C + j] = o;
                if (o == null) continue;
                if (o.rb || o.an) { anim.push(i, j); continue; }      // (animado: se dibuja encima en cada cuadro)
                drawBlock(o, { x: i * ts, y: S - j * ts, width: tw, height: -tw }, g);
            }
        }
        ch.anim = anim; ch.img = window.images.blocks; ch.wc = window.worldCache;
        stats.built++;
    }
    function stale(ch, cx, cy) {
        if (!ch.refs || ch.img !== window.images.blocks || ch.wc !== window.worldCache) return true;
        const r = ch.refs;
        for (let i = 0; i < C; i++) {
            const col = window.worldCache[cx * C + i];
            for (let j = 0; j < C; j++) { const o = col ? col[cy * C + j] : undefined; if (o !== r[i * C + j]) return true; }
        }
        return false;
    }
    // Dibuja en tctx los bloques de x0..x0+w-1 y y0..y0+h-1: el bloque (wx, wy) va en x = (wx - x0)·ts y su borde de abajo en
    // baseH - (wy - y0)·ts (igual que los ciclos de main.js). Devuelve false si no se puede (main.js dibuja como siempre).
    function draw(tctx, x0, y0, w, h, baseH) {
        if (!on() || !ready() || typeof drawBlock !== 'function' || !window.worldCache) return false;
        const ts = tileSize;
        if (!(ts > 0) || ts !== Math.round(ts) || ts > 96) return false;
        if (ts !== cacheTs) { cache.clear(); cacheTs = ts; }
        const sc = scene(), S = C * ts, tw = ts + 0.8;
        const cx0 = Math.floor(x0 / C), cx1 = Math.floor((x0 + w - 1) / C), cy0 = Math.floor(y0 / C), cy1 = Math.floor((y0 + h - 1) / C);
        useTick++;
        const animList = [];
        for (let cx = cx0; cx <= cx1; cx++) {
            if (cx < 0) continue;
            for (let cy = cy0; cy <= cy1; cy++) {
                if (cy < 0) continue;
                const k = sc + '|' + cx + '|' + cy;
                let ch = cache.get(k);
                if (!ch) { ch = {}; cache.set(k, ch); }
                if (stale(ch, cx, cy)) build(ch, cx, cy, ts);
                ch.used = useTick;
                const px = (cx * C - x0) * ts, bottom = baseH - (cy * C - y0) * ts;
                tctx.drawImage(ch.cv, px, bottom - S);
                stats.blits++;
                for (let a = 0; a < ch.anim.length; a += 2) animList.push(cx * C + ch.anim[a], cy * C + ch.anim[a + 1]);
            }
        }
        for (let a = 0; a < animList.length; a += 2) {
            const wx = animList[a], wy = animList[a + 1];
            if (wx < x0 || wx >= x0 + w || wy < y0 || wy >= y0 + h) continue;
            let o = cacheOf(wx, wy); if (o == null) continue;
            if (window.mbwAnimatedTile) o = window.mbwAnimatedTile(o, wx, wy);
            drawBlock(o, { x: (wx - x0) * ts, y: baseH - (wy - y0) * ts, width: tw, height: -tw }, tctx);
        }
        trim((cx1 - cx0 + 1) * (cy1 - cy0 + 1));
        return true;
    }
    function trim(visible) {
        const max = Math.max(24, visible * 3);
        if (cache.size <= max) return;
        const arr = Array.from(cache.entries()).sort(function (a, b) { return (a[1].used || 0) - (b[1].used || 0); });
        for (let i = 0; i < arr.length - max; i++) { const ch = arr[i][1]; if (ch.cv) { ch.cv.width = ch.cv.height = 0; } cache.delete(arr[i][0]); }
    }
    window.mbwChunks = {
        draw: draw,
        clear: function () { cache.forEach(function (ch) { if (ch.cv) ch.cv.width = ch.cv.height = 0; }); cache.clear(); },
        force: function (v) { forced = (v === true || v === false) ? v : null; },
        stats: function () { return { chunks: cache.size, built: stats.built, blits: stats.blits, size: C }; },
        size: C
    };
})();
