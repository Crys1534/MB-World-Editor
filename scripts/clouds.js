// =====================================================================
// ☁ Nubes en el cielo (como en el juego)
// =====================================================================
// Copiado de cómo las hace Mine Blocks (clase Clouds del juego):
//  · Son cuadros blancos medio transparentes (20%), de 26/30 de bloque, en 3 filas, justo arriba del techo del mundo
//    (Y 121 a 123, en todos los mundos).
//  · Se mueven poco a poco hacia la derecha (0.5 px por cuadro del juego, a 50 cuadros por segundo) y no se mueven con la cámara
//    de lado a lado: se ven "lejanas", siempre pasando por la pantalla.
//  · Van saliendo por la izquierda en grupos al azar (nubes de varios cuadros); algunas aparecen o se borran poco a poco.
//  · Con lluvia o tormenta se ponen grises (oscuras) y hay más.
//  · Solo en el mundo normal (no en el Nether ni en el End).
// View > Sky > Clouds las prende o apaga (se recuerda en este navegador).
(function () {
    'use strict';
    const KEY = 'mbw_clouds';
    const PX = 30;                     // en el juego 30 px = 1 bloque
    const SIZE = 26 / PX;              // tamaño de cada cuadro de nube, en bloques
    const C = { on: true, list: [], count: 0, start: false, filledFor: null, last: 0 };
    try { C.on = localStorage.getItem(KEY) !== '0'; } catch (e) { /* sin almacenamiento */ }

    function rainLevel() {
        let r = 0;
        try { if (typeof mbwom !== 'undefined' && mbwom.world && Number(mbwom.world.raining) > 0) r = Number(mbwom.world.raining); } catch (e) { /* nada */ }
        try { if (!r && typeof isRaining !== 'undefined' && isRaining) r = 1; } catch (e) { /* nada */ }
        return Math.min(2, r);
    }
    // Altura del techo del mundo: SIEMPRE 120 (la de Mine Blocks), así las nubes salen en Y 121 a 123 en todos los mundos.
    // (Antes se usaba el dato worldHeight del mundo y, si no lo traía, lo alto de las columnas; en muchos mundos eso daba otra
    //  altura y las nubes salían más abajo o más arriba.)
    function worldTop() { return 120; }
    function make(x, y) {
        // 1 de cada 10 nubes empieza invisible y aparece poco a poco
        const fade = Math.random() < 0.1;
        return { x: x, y: y, alpha: fade ? 0 : 1, upTween: fade, alphaUp: false, alphaDown: false, rain: rainLevel() > 0 };
    }
    // una columna de nubes (hasta 3 cuadros, uno por fila), con las mismas probabilidades que el juego
    function column(x, add) {
        const r = rainLevel();
        if (((Math.random() * (5 - 2 * r)) | 0) === 0 && !C.start) C.start = true;
        if (C.start) {
            [SIZE, 0, -SIZE].forEach(function (row) { if (((Math.random() * (5 + 3 * r)) | 0) !== 0) add(make(x, row)); });
            if (((Math.random() * (10 + 3 * r)) | 0) === 1) C.start = false;
        }
    }
    function fill(widthBlocks) {
        C.list = []; C.start = false; C.count = 0;
        const cols = Math.ceil(widthBlocks / SIZE + 1);
        for (let i = 0; i < cols; i++) column(i * SIZE - SIZE / 2, function (c) { C.list.push(c); });
    }
    function step(frames, widthBlocks) {
        // frames = cuántos cuadros del juego (a 50 por segundo) pasaron
        C.count += 0.5 / PX * frames;
        while (C.count >= SIZE) { C.count -= SIZE; column(-SIZE / 2, function (c) { C.list.unshift(c); }); }
        const r = rainLevel();
        for (let i = 0; i < C.list.length; i++) {
            const c = C.list[i];
            c.x += 0.5 / PX * frames;
            if (Math.random() < 1.6666666666666666e-4 * frames) { if (c.upTween) c.alphaUp = true; else c.alphaDown = true; }
            if (c.alphaUp) { if (c.alpha < 1) c.alpha = Math.min(1, c.alpha + 0.01 * frames); else { c.alphaUp = false; c.upTween = false; } }
            if (c.alphaDown) { if (c.alpha > 0) c.alpha = Math.max(0, c.alpha - 0.01 * frames); else { c.alphaDown = false; c.upTween = true; } }
            if (r > 0) c.rain = true;
        }
        // las que ya salieron por la derecha se quitan
        const edge = widthBlocks + SIZE;
        let cut = -1;
        for (let i = 0; i < C.list.length; i++) if (C.list[i].x >= edge) { cut = i; break; }
        if (cut > -1) C.list = C.list.filter(function (c) { return c.x < edge; });
    }
    function draw(ctx) {
        if (!C.on || typeof mbwom === 'undefined' || !mbwom.world || typeof camera === 'undefined' || typeof tileSize === 'undefined') return;
        const scene = (typeof mbwom.currentScene !== 'undefined') ? mbwom.currentScene : 1;
        if (scene !== 1) return;
        const cv = ctx.canvas;
        const widthBlocks = cv.width / tileSize;
        const now = performance.now();
        const key = mbwom.world;               // otro mundo = nubes nuevas
        if (C.filledFor !== key) { C.filledFor = key; fill(widthBlocks); C.last = now; }
        let frames = (now - (C.last || now)) / 20; C.last = now;
        if (frames > 25) frames = 25;           // (si la pestaña estuvo escondida, no salta todo de golpe)
        if (frames > 0) step(frames, widthBlocks);
        // altura: arriba del techo del mundo, como el juego (filas a +1, 0 y -1 cuadro de esa altura)
        const baseY = Math.floor(worldTop() + 3.3333333333333335);
        const sz = SIZE * tileSize;
        const yTopScreen = function (rowY) { return cv.height - ((baseY + rowY + SIZE / 2) - camera.y) * tileSize; };
        if (yTopScreen(SIZE) > cv.height + sz || yTopScreen(-SIZE) + sz < -sz) return;   // fuera de la vista
        ctx.save();
        for (let i = 0; i < C.list.length; i++) {
            const c = C.list[i];
            if (c.alpha <= 0) continue;
            const sx = Math.round((c.x - SIZE / 2) * tileSize), sy = Math.round(yTopScreen(c.y));
            if (sx > cv.width || sx + sz < 0) continue;
            ctx.fillStyle = c.rain ? 'rgba(0, 0, 0, ' + (0.2 * c.alpha) + ')' : 'rgba(255, 255, 255, ' + (0.2 * c.alpha) + ')';
            ctx.fillRect(sx, sy, Math.ceil(sz), Math.ceil(sz));
        }
        ctx.restore();
    }
    function set(on) {
        C.on = !!on;
        try { localStorage.setItem(KEY, C.on ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
        const t = document.getElementById('clouds-toggle'); if (t) t.checked = C.on;
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
    window.mbwClouds = { draw: draw, set: set, isOn: function () { return C.on; }, _state: C, _fill: fill, SIZE: SIZE };
    function syncToggle() { const t = document.getElementById('clouds-toggle'); if (t) t.checked = C.on; }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncToggle); else syncToggle();
})();
