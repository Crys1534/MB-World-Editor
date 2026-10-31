// ==========================================================
// 👁 RELACIÓN DE ASPECTO (botón con un ojo en la barra de herramientas)
//
//  Sirve para ver cómo se ve el mapa dentro del juego: solo se ve un área del tamaño elegido y lo demás queda oscuro.
//  1) Clic en el ojo: aparece un rectángulo de 18 x 14 bloques (el tamaño de fábrica) que sigue al mouse.
//     Un clic lo pone ahí; arrastrando se elige otro tamaño. Esc cancela.
//  2) Ya puesto: la vista queda en el centro de la pantalla, el zoom se bloquea (se queda el que estaba)
//     y se puede seguir editando y moviendo la cámara (W A S D) como siempre.
//  3) El ojo cambia a un ojo tachado en rojo: clic ahí y se quita.
// ==========================================================
(function () {
    'use strict';
    const DEF_W = 18, DEF_H = 14;
    const A = window.mbwAspect = { active: false, picking: false, w: DEF_W, h: DEF_H, prevTool: 'pencil', drag: null, zoomNoticeAt: 0 };

    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function $(id) { return document.getElementById(id); }
    function dirty() { /* lo de encima del mundo (el marco, los letreros) se pinta solo en cada cuadro */ }
    function tool() { return typeof currentTool !== 'undefined' ? currentTool : ''; }
    function setTool(t) { if (typeof selectTool === 'function') selectTool(t); else window.currentTool = t; }
    function hasWorld() { return typeof mbwom !== 'undefined' && !!mbwom.scene; }

    // ------------------------------------------------------------------ el botón
    function paintButton() {
        const b = $('tool-aspect');
        if (!b) return;
        const use = b.querySelector('use');
        if (use) use.setAttribute('href', A.active ? '#ic-eye-off' : '#ic-eye');
        const key = A.active ? 'tooltip_tool_aspect_off' : 'tooltip_tool_aspect';
        b.setAttribute('data-i18n-title', key);
        b.title = A.active ? tr(key, 'Turn off the aspect ratio view') : tr(key, 'Aspect ratio: see only an area, like in the game');
        b.classList.toggle('aspect-on', A.active);
        const zs = $('zoom-slider');
        if (zs) zs.disabled = A.active;
        document.body.classList.toggle('aspect-view-on', A.active);
    }
    A.button = function () {
        if (A.active) { A.off(); return; }
        if (A.picking || tool() === 'aspect') { cancelPick(); return; }
        A.prevTool = tool() && tool() !== 'aspect' ? tool() : 'pencil';
        A.picking = true;
        A.drag = null;
        setTool('aspect');
        dirty();
    };
    function cancelPick() {
        A.picking = false; A.drag = null;
        if (tool() === 'aspect') setTool(A.prevTool || 'pencil');
        dirty();
    }
    A.off = function () {
        if (!A.active) return;
        // que el centro de la vista siga en el mismo lugar al volver al zoom de antes
        const cx = camera.x + canvas.width / tileSize / 2, cy = camera.y + canvas.height / tileSize / 2;
        A.active = false;
        if (A.prevZoomIndex !== undefined) setZoomIndex(A.prevZoomIndex);
        let nx = cx - canvas.width / tileSize / 2, ny = cy - canvas.height / tileSize / 2;
        if (!window.smoothScroll) { nx = Math.round(nx); ny = Math.round(ny); }
        camera.x = nx; camera.y = ny; camera._tx = nx; camera._ty = ny; camera.velX = 0; camera.velY = 0;
        paintButton();
        dirty();
    };
    A.zoomBlocked = function () {
        const now = Date.now();
        if (now - A.zoomNoticeAt < 2500) return;
        A.zoomNoticeAt = now;
        A.flash = { text: tr('aspect_zoom_locked', 'Zoom is locked while the aspect ratio view is on.'), until: now + 1800 };
        dirty();
    };

    // ------------------------------------------------------------------ elegir el área
    function cellUnderMouse() {
        if (typeof mouse === 'undefined' || mouse.worldX == null || mouse.worldY == null) return null;
        return { x: mouse.worldX, y: mouse.worldY };
    }
    // el rectángulo que se ve ahora: el de fábrica centrado en el mouse, o el que se está arrastrando
    function pickRect() {
        const c = cellUnderMouse();
        if (!c) return null;
        if (A.drag && (A.drag.x !== c.x || A.drag.y !== c.y)) {
            const x1 = Math.min(A.drag.x, c.x), x2 = Math.max(A.drag.x, c.x), y1 = Math.min(A.drag.y, c.y), y2 = Math.max(A.drag.y, c.y);
            return { x1: x1, y1: y1, w: Math.max(2, x2 - x1 + 1), h: Math.max(2, y2 - y1 + 1), custom: true };
        }
        const o = A.drag || c;
        return { x1: o.x - Math.floor(DEF_W / 2), y1: o.y - Math.floor(DEF_H / 2), w: DEF_W, h: DEF_H };
    }
    function frameOffsets() {
        const cols = canvas.width / tileSize, rows = canvas.height / tileSize;
        return { offX: Math.floor((cols - A.w) / 2), offY: Math.floor((rows - A.h) / 2) };
    }
    // El área se dibuja con el zoom más grande en el que cabe completa (así se ve nítida) y luego se ESTIRA
    // hasta llenar todo el lienzo (sin margen negro). Al quitar la vista vuelve el zoom de antes.
    function setZoomIndex(i) {
        if (typeof updateZoomSlider !== 'function' || i === currentZoomIndex) return;
        A.allowZoom = true;
        try { updateZoomSlider(i); } finally { A.allowZoom = false; }
    }
    function fitZoom() {
        if (typeof ZOOM_LEVELS === 'undefined' || typeof BASE_TILE_SIZE === 'undefined') return;
        let best = 0;
        for (let i = 0; i < ZOOM_LEVELS.length; i++) {
            const ts = BASE_TILE_SIZE * ZOOM_LEVELS[i] / 100;
            if (A.w * ts <= canvas.width && A.h * ts <= canvas.height) best = i;
        }
        setZoomIndex(best);
    }
    // dónde queda el área en el lienzo (antes de estirarla), en píxeles enteros
    function frameRect() {
        const o = frameOffsets(), ts = tileSize;
        const fx = Math.round(o.offX * ts), fw = Math.round(A.w * ts), fh = Math.round(A.h * ts);
        const fy = Math.round(canvas.height - (o.offY + A.h) * ts);
        return { x: fx, y: fy, w: fw, h: fh };
    }
    A.frame = frameRect;
    // Dónde se dibuja el área en la pantalla: lo más grande que cabe SIN deformar los bloques (siguen cuadrados), centrada.
    function screenRect() {
        const f = frameRect(), W = canvas.width, H = canvas.height;
        const k = Math.min(W / f.w, H / f.h);
        const w = Math.round(f.w * k), h = Math.round(f.h * k);
        return { x: Math.floor((W - w) / 2), y: Math.floor((H - h) / 2), w: w, h: h, f: f };
    }
    A.screen = screenRect;
    // Un punto de la pantalla (estirada) -> el punto del lienzo sin estirar (para que el mouse caiga en el bloque correcto)
    A.mapOffset = function (ox, oy) {
        if (!A.active) return { x: ox, y: oy };
        const r = screenRect(), f = r.f;
        const px = Math.max(0, Math.min(r.w - 0.01, ox - r.x)), py = Math.max(0, Math.min(r.h - 0.01, oy - r.y));   // (en el borde negro cuenta como la orilla del área)
        return { x: f.x + px * f.w / r.w, y: f.y + py * f.h / r.h };
    };
    A.mapClient = function (cx, cy) {
        if (!A.active) return { x: cx, y: cy };
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / (r.width || 1), sy = canvas.height / (r.height || 1);
        const m = A.mapOffset((cx - r.left) * sx, (cy - r.top) * sy);
        return { x: r.left + m.x / sx, y: r.top + m.y / sy };
    };
    function activate(r) {
        A.picking = false; A.drag = null;
        A.w = r.w; A.h = r.h;
        A.active = true;
        A.prevZoomIndex = currentZoomIndex;
        fitZoom();
        // la cámara se acomoda para que esa área quede justo en el centro de la pantalla
        const o = frameOffsets();
        camera.x = r.x1 - o.offX; camera.y = r.y1 - o.offY;
        camera._tx = camera.x; camera._ty = camera.y; camera.velX = 0; camera.velY = 0;
        setTool(A.prevTool && A.prevTool !== 'aspect' ? A.prevTool : 'pencil');
        paintButton();
        A.flash = { text: tr('aspect_on', 'Aspect ratio view: {w} × {h} blocks. Zoom is locked.', { w: A.w, h: A.h }), until: Date.now() + 2600 };
        dirty();
    }
    function attach() {
        const cv = $('canvas');
        if (!cv || cv.__aspect) return;
        cv.__aspect = true;
        cv.addEventListener('mousedown', function (e) {
            if (tool() !== 'aspect' || e.button !== 0 || !hasWorld()) return;
            A.picking = true;
            A.drag = cellUnderMouse();
        });
        window.addEventListener('mouseup', function (e) {
            if (tool() !== 'aspect' || !A.drag || e.button !== 0) return;
            const r = pickRect();
            A.drag = null;
            if (r) activate(r);
        });
        // El mouse sobre la vista estirada: cada evento del lienzo se "des-estira" antes de que lo use el editor
        ['mousemove', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(function (type) {
            window.addEventListener(type, function (e) {
                if (!A.active || e.target !== cv) return;
                const r = cv.getBoundingClientRect();
                const m = A.mapClient(e.clientX, e.clientY);
                const ox = m.x - r.left, oy = m.y - r.top;
                try {
                    Object.defineProperty(e, 'offsetX', { value: ox, configurable: true });
                    Object.defineProperty(e, 'offsetY', { value: oy, configurable: true });
                    Object.defineProperty(e, 'clientX', { value: m.x, configurable: true });
                    Object.defineProperty(e, 'clientY', { value: m.y, configurable: true });
                    Object.defineProperty(e, 'pageX', { value: m.x + window.scrollX, configurable: true });
                    Object.defineProperty(e, 'pageY', { value: m.y + window.scrollY, configurable: true });
                    Object.defineProperty(e, 'x', { value: m.x, configurable: true });
                    Object.defineProperty(e, 'y', { value: m.y, configurable: true });
                } catch (err) { /* nada */ }
            }, true);
        });
        // si el lienzo cambia de tamaño (pantalla completa, ventana...), se vuelve a buscar el zoom que mejor queda
        window.addEventListener('resize', function () { if (A.active) setTimeout(fitZoom, 0); });
        window.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (tool() === 'aspect') { cancelPick(); e.preventDefault(); }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();

    // si se cambia a otra herramienta a mitad de elegir, se deja de elegir
    setInterval(function () { if (A.picking && tool() !== 'aspect') { A.picking = false; A.drag = null; dirty(); } }, 300);

    // ------------------------------------------------------------------ dibujar (lo llama main.js al final de cada cuadro)
    function label(ctx, text, x, y, align) {
        ctx.save();
        ctx.font = "600 13px 'Segoe UI', Arial, sans-serif";
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';            // (el dibujo de los nombres de los jugadores deja el texto centrado)
        const w = ctx.measureText(text).width + 16;
        let lx = align === 'center' ? x - w / 2 : x;
        lx = Math.max(4, Math.min(canvas.width - w - 4, lx));
        const ly = Math.max(4, Math.min(canvas.height - 26, y));
        ctx.fillStyle = 'rgba(16, 19, 26, 0.88)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, ly, w, 22, 11); else ctx.rect(lx, ly, w, 22);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, lx + 8, ly + 11.5);
        ctx.restore();
    }
    A.draw = function (ctx) {
        if (!hasWorld()) return;
        const ts = tileSize;
        if (tool() === 'aspect') {
            const r = pickRect();
            if (r) {
                const sx = (r.x1 - camera.x) * ts, sy = canvas.height - (r.y1 + r.h - camera.y) * ts;
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.fillRect(sx, sy, r.w * ts, r.h * ts);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 5]);
                ctx.lineDashOffset = -(Date.now() / 50);
                ctx.strokeRect(sx, sy, r.w * ts, r.h * ts);
                ctx.restore();
                label(ctx, r.w + ' × ' + r.h, sx, sy - 27);
            }
            label(ctx, tr('aspect_pick', 'Click to place the {w} × {h} view, or drag to choose another size. Esc cancels.', { w: DEF_W, h: DEF_H }), canvas.width / 2, 10, 'center');
        }
        if (A.active) {
            // se copia solo el área y se agranda lo más que cabe sin deformar los bloques (sin suavizar, como en el juego)
            const sr = screenRect(), f = sr.f;
            if (f.w > 0 && f.h > 0) {
                if (!A.buf) A.buf = document.createElement('canvas');
                if (A.buf.width !== f.w || A.buf.height !== f.h) { A.buf.width = f.w; A.buf.height = f.h; }
                const g = A.buf.getContext('2d');
                g.clearRect(0, 0, f.w, f.h);
                g.drawImage(canvas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.imageSmoothingEnabled = false;
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(A.buf, 0, 0, f.w, f.h, sr.x, sr.y, sr.w, sr.h);
                ctx.restore();
            }
            label(ctx, A.w + ' × ' + A.h, sr.x + 8, sr.y + sr.h - 30);
        }
        if (A.flash) {
            if (Date.now() > A.flash.until) A.flash = null;
            else label(ctx, A.flash.text, canvas.width / 2, 10, 'center');
        }
    };

    window.aspectOnLanguageChanged = paintButton;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintButton); else paintButton();
})();
