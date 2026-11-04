// ==========================================================
// 🛠️ HERRAMIENTAS DE EDICIÓN EXTRA
//  · Move + selección: si hay un área seleccionada (Select, Lazo o Varita) y eliges Move, esa área se puede arrastrar.
//    Mientras tanto todo lo demás queda bloqueado hasta que presionas Enter / "Aplicar" o Esc / "Cancelar"
//    (como cuando transformas una selección en Photoshop). Nada se cambia en el mundo hasta que aplicas.
//  · Formas: Línea, Rectángulo, Triángulo y Círculo, sólidas o solo borde. Usan las casillas 1 (borde) y 2 (relleno)
//    de la barra rápida; las otras 7 quedan apagadas mientras la herramienta está elegida. Shift = forma "pareja".
//  · Gotero: clic en un bloque del mapa = ese bloque pasa a la casilla elegida de la barra rápida.
// ==========================================================
(function () {
    'use strict';

    function t(k, fb) { try { const v = (typeof window.t === 'function') ? window.t(k) : null; return (v && v !== k) ? v : fb; } catch (e) { return fb; } }
    function tool() { return typeof currentTool !== 'undefined' ? currentTool : window.currentTool; }
    function setToolRaw(n) { try { currentTool = n; } catch (e) { window.currentTool = n; } }
    function worldOk() { return typeof mbwom !== 'undefined' && mbwom && Array.isArray(mbwom.scene); }
    function inMp() { return typeof isMultiplayer !== 'undefined' && isMultiplayer; }
    function canEdit() { return !inMp() || typeof window.mpCanEdit !== 'function' || window.mpCanEdit(); }
    function viewOnlyNotice() { if (typeof window.mpViewOnlyNotice === 'function') window.mpViewOnlyNotice(); }
    function typing() {
        const a = document.activeElement; if (!a) return false;
        const tag = a.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!a.isContentEditable;
    }
    function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
    function dirty() { try { worldDirty = true; } catch (e) { window.worldDirty = true; } }
    function redraw(x, y) { if (typeof window.renderBlock === 'function') window.renderBlock(x, y); }
    function hb() { return (typeof hotbar !== 'undefined' && hotbar && hotbar.slots) ? hotbar : null; }
    function sel() { return window.selection; }
    function hasSel() {
        const s = sel(); if (!s) return false;
        if (s.type === 'magic') return !!(s.points && s.points.length);
        if (s.type === 'poly') return !!(s.path && s.path.length > 2);
        return !!((s.p1 && s.p2) || (s.subRects && s.subRects.length));
    }
    function scn() { return (worldOk() && mbwom.currentScene) || 1; }

    // ---------- cambios en el mundo (con historial y red) ----------
    // list = [[x, y, estado|null], ...]
    function applyChanges(list, mobMoves) {
        if (!list.length && !(mobMoves && mobMoves.length)) return;
        const hm = (typeof historyManager !== 'undefined') ? historyManager : null;
        if (hm) hm.startAction();
        const net = [];
        for (let i = 0; i < list.length; i++) {
            const x = list[i][0], y = list[i][1], st = list[i][2];
            if (x < 0 || y < 0) continue;
            const old = mbwom.getBlockState(x, y);
            const oldReal = (old && old.type != null) ? old : null;
            if (!oldReal && !st) continue;
            if (oldReal && st && JSON.stringify(oldReal) === JSON.stringify(st)) continue;
            if (hm) hm.recordChange(x, y, oldReal, st);
            if (st) mbwom.setBlockState(x, y, clone(st));
            else {
                mbwom.setBlockState(x, y, { type: null });   // quita también sus datos (cofre, letrero, variante...)
                if (mbwom.scene[x]) delete mbwom.scene[x][y];
            }
            redraw(x, y);
            net.push([x, y, st ? clone(st) : null]);
        }
        (mobMoves || []).forEach(function (mv) {
            const m = mbwom.mobs && mbwom.mobs[mv.key];
            if (!m) return;
            const before = clone(m);
            m.x = Number(m.x) + mv.dx;
            m.y = Number(m.y) - mv.dy;   // los mobs guardan la altura al revés (y negativa)
            if (hm) hm.recordMobChange(mv.key, before, m);
            if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'accion_mover_mob', id: mv.key, x: m.x, y: m.y });
        });
        if (hm) hm.commitAction();
        if (typeof enviarMensajeEnRed === 'function') {
            for (let i = 0; i < net.length; i += 1500) enviarMensajeEnRed({ tipo: 'accion_lote', cambios: net.slice(i, i + 1500) });
        }
        dirty();
    }
    window.mbwApplyBlockChanges = applyChanges;

    // ---------- dibujo ----------
    function screenOf(x, y) {
        return { sx: (x - camera.x) * tileSize, sy: canvas.height - (y - camera.y) * tileSize };
    }
    function visible(x, y) {
        const p = screenOf(x, y);
        return !(p.sx + tileSize < 0 || p.sx > canvas.width || p.sy < 0 || p.sy - tileSize > canvas.height);
    }
    function drawState(ctx, st, x, y) {
        if (!st || !st.type || typeof getBlockObject !== 'function' || typeof drawBlock !== 'function') return;
        let tex = null;
        try { tex = getBlockObject(st); } catch (e) { tex = null; }
        if (!tex || typeof tex.x !== 'number') return;
        const p = screenOf(x, y);
        drawBlock(tex, { x: p.sx, y: p.sy, width: tileSize, height: -tileSize });
    }

    // =====================================================================
    // 1) MOVE + SELECCIÓN
    // =====================================================================
    let X = null;   // la selección que se está moviendo
    const MAX_MOVE = 400000;

    function selectionCells() {
        if (typeof getSelectionBounds !== 'function' || typeof isPointSelected !== 'function') return null;
        const b = getSelectionBounds();
        if (!b || !isFinite(b.minX)) return null;
        const area = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
        if (area > MAX_MOVE * 4) return { tooBig: true };
        const cells = [];
        for (let x = Math.max(0, b.minX); x <= b.maxX; x++) {
            for (let y = Math.max(0, b.minY); y <= b.maxY; y++) {
                if (!isPointSelected(x, y)) continue;
                const st = mbwom.getBlockState(x, y);
                if (st && st.type != null) cells.push({ x: x, y: y, st: clone(st) });
                if (cells.length > MAX_MOVE) return { tooBig: true };
            }
        }
        return { cells: cells, bounds: b };
    }
    function selectionMobs() {
        const out = [];
        if (!mbwom.mobs || typeof isPointSelected !== 'function') return out;
        const s = scn();
        Object.keys(mbwom.mobs).forEach(function (k) {
            const m = mbwom.mobs[k];
            if (!m || (Number(m.scene) || 1) !== s) return;
            const cx = Math.floor(Number(m.x)), cy = Math.floor(-Number(m.y) + 0.001);
            if (isPointSelected(cx, cy)) out.push(k);
        });
        return out;
    }

    function confirmBar(show) {
        let bar = document.getElementById('mbw-move-confirm');
        if (!show) { if (bar) bar.remove(); return; }
        if (bar) return;
        bar = document.createElement('div');
        bar.id = 'mbw-move-confirm';
        bar.innerHTML = '<span class="mmc-title"></span>' +
            '<button type="button" class="mmc-apply"></button>' +
            '<button type="button" class="mmc-cancel"></button>' +
            '<span class="mmc-hint"></span>';
        bar.querySelector('.mmc-title').textContent = t('mv_title', 'Move selection');
        bar.querySelector('.mmc-apply').textContent = '✔ ' + t('mv_apply', 'Apply');
        bar.querySelector('.mmc-cancel').textContent = '✖ ' + t('mv_cancel', 'Cancel');
        bar.querySelector('.mmc-hint').textContent = t('mv_hint', 'Drag to move · Enter = apply · Esc = cancel');
        bar.querySelector('.mmc-apply').onclick = function (e) { e.stopPropagation(); applyMove(); };
        bar.querySelector('.mmc-cancel').onclick = function (e) { e.stopPropagation(); cancelMove(); };
        document.body.appendChild(bar);
    }

    function startMove() {
        if (!worldOk() || !hasSel()) return false;
        if (!canEdit()) { viewOnlyNotice(); return true; }
        const got = selectionCells();
        if (!got) return false;
        if (got.tooBig) { alert(t('mv_too_big', 'That selection is too big to move at once.')); return true; }
        X = { cells: got.cells, bounds: got.bounds, mobs: selectionMobs(), dx: 0, dy: 0, drag: null, back: (sel().type === 'poly') ? 'lasso' : 'select' };
        X.set = new Set(X.cells.map(c => c.x + ',' + c.y));
        setToolRaw('transform');
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const mb = document.getElementById('tool-move'); if (mb) mb.classList.add('active');
        document.body.classList.add('mbw-transforming');
        confirmBar(true);
        return true;
    }
    function shiftSelection(dx, dy) {
        const s = sel(); if (!s) return;
        const mv = p => { if (p) { p.x += dx; p.y += dy; } };
        mv(s.p1); mv(s.p2);
        (s.subRects || []).forEach(r => { mv(r.p1); mv(r.p2); });
        (s.path || []).forEach(mv);
        if (s.points && s.points.length) {
            s.points.forEach(mv);
            s.pointSet = new Set(s.points.map(p => p.x + ',' + p.y));
        }
    }
    function endMove() {
        const back = X ? X.back : 'select';
        X = null;
        document.body.classList.remove('mbw-transforming');
        confirmBar(false);
        setToolRaw('move');   // para que selectTool no crea que ya estaba en esa herramienta
        if (typeof origSelectTool === 'function') origSelectTool(back);
    }
    function applyMove() {
        if (!X) return;
        const dx = X.dx, dy = X.dy;
        if (dx || dy) {
            const map = new Map();
            X.cells.forEach(c => map.set(c.x + ',' + c.y, [c.x, c.y, null]));
            X.cells.forEach(c => { const nx = c.x + dx, ny = c.y + dy; if (nx >= 0 && ny >= 0) map.set(nx + ',' + ny, [nx, ny, c.st]); });
            applyChanges(Array.from(map.values()), X.mobs.map(k => ({ key: k, dx: dx, dy: dy })));
            shiftSelection(dx, dy);
        }
        endMove();
    }
    function cancelMove() { if (X) endMove(); }
    window.mbwMove = { active: function () { return !!X; }, start: startMove, apply: applyMove, cancel: cancelMove, state: function () { return X; },
        nudge: function (dx, dy) { if (X) { X.dx += dx; X.dy += dy; } } };

    function drawMove(ctx) {
        if (!X) return;
        ctx.save();
        // dónde estaba (hueco oscuro)
        ctx.fillStyle = 'rgba(15, 18, 28, 0.55)';
        for (let i = 0; i < X.cells.length; i++) {
            const c = X.cells[i];
            if (!visible(c.x, c.y)) continue;
            const p = screenOf(c.x, c.y);
            ctx.fillRect(p.sx, p.sy, tileSize, -tileSize);
        }
        // dónde va
        ctx.globalAlpha = 0.92;
        for (let i = 0; i < X.cells.length; i++) {
            const c = X.cells[i];
            const nx = c.x + X.dx, ny = c.y + X.dy;
            if (!visible(nx, ny)) continue;
            drawState(ctx, c.st, nx, ny);
        }
        ctx.globalAlpha = 1;
        const b = X.bounds;
        const a = screenOf(b.minX + X.dx, b.maxY + 1 + X.dy);
        const w = (b.maxX - b.minX + 1) * tileSize, h = (b.maxY - b.minY + 1) * tileSize;
        ctx.setLineDash([6, 4]); ctx.lineDashOffset = -(Date.now() / 60) % 20;
        ctx.strokeStyle = '#FFD24A'; ctx.lineWidth = 2;
        ctx.strokeRect(a.sx, a.sy, w, h);
        ctx.setLineDash([]);
        ctx.restore();
    }

    // =====================================================================
    // 2) FORMAS
    // =====================================================================
    const SHAPES = ['line', 'rect', 'tri', 'circle'];
    let shapeKind = 'rect', shapeFill = false;
    try { const s = JSON.parse(localStorage.getItem('mbw_shape_opts') || 'null'); if (s) { if (SHAPES.indexOf(s.kind) >= 0) shapeKind = s.kind; shapeFill = !!s.fill; } } catch (e) { /* nada */ }
    function saveShapeOpts() { try { localStorage.setItem('mbw_shape_opts', JSON.stringify({ kind: shapeKind, fill: shapeFill })); } catch (e) { /* nada */ } }
    let drag = null;   // { x0, y0, x1, y1 }
    const MAX_SHAPE = 250000;

    function line(x0, y0, x1, y1) {
        const pts = [[x0, y0]];
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy, x = x0, y = y0, guard = 0;
        while ((x !== x1 || y !== y1) && guard++ < 200000) {
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
            pts.push([x, y]);
        }
        return pts;
    }
    // Devuelve { border: [[x,y]...], fill: [[x,y]...] }
    function shapeCells(kind, x0, y0, x1, y1, constrain) {
        if (constrain) {
            if (kind === 'line') {
                const dx = x1 - x0, dy = y1 - y0, ax = Math.abs(dx), ay = Math.abs(dy);
                if (ax > ay * 2) y1 = y0; else if (ay > ax * 2) x1 = x0;
                else { const m = Math.max(ax, ay); x1 = x0 + Math.sign(dx || 1) * m; y1 = y0 + Math.sign(dy || 1) * m; }
            } else {
                const m = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
                x1 = x0 + Math.sign((x1 - x0) || 1) * m; y1 = y0 + Math.sign((y1 - y0) || 1) * m;
            }
        }
        if (kind === 'line') return { border: line(x0, y0, x1, y1), fill: [] };
        const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
        const W = maxX - minX + 1, H = maxY - minY + 1;
        if (W * H > MAX_SHAPE) return { border: [], fill: [], tooBig: true };
        let inside;
        if (kind === 'rect') inside = () => true;
        else if (kind === 'circle') {
            const cx = minX + W / 2, cy = minY + H / 2, rx = W / 2, ry = H / 2;
            inside = (x, y) => { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; return u * u + v * v <= 1.0001; };
        } else {
            // triángulo con la punta arriba: base abajo (minY), punta en el centro de arriba (maxY)
            const ax = minX + W / 2, ay = maxY + 1, bx = minX, by = minY, cx2 = maxX + 1, cy2 = minY;
            const area = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (rx - px) * (qy - py);
            inside = (x, y) => {
                const px = x + 0.5, py = y + 0.5;
                const d1 = area(bx, by, cx2, cy2, px, py), d2 = area(cx2, cy2, ax, ay, px, py), d3 = area(ax, ay, bx, by, px, py);
                return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
            };
        }
        const inSet = new Set();
        for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) if (inside(x, y)) inSet.add(x + ',' + y);
        if (kind === 'tri') { for (let x = minX; x <= maxX; x++) inSet.add(x + ',' + minY); inSet.add(Math.floor(minX + (W - 1) / 2) + ',' + maxY); }
        const border = [], fill = [];
        inSet.forEach(function (k) {
            const i = k.indexOf(','), x = +k.slice(0, i), y = +k.slice(i + 1);
            const edge = x === minX || x === maxX || y === minY || y === maxY ||
                !inSet.has((x + 1) + ',' + y) || !inSet.has((x - 1) + ',' + y) || !inSet.has(x + ',' + (y + 1)) || !inSet.has(x + ',' + (y - 1));
            if (kind === 'rect') (edge ? border : fill).push([x, y]);
            else (edge ? border : fill).push([x, y]);
        });
        return { border: border, fill: fill };
    }
    function shapePlan() {
        if (!drag) return null;
        const h = hb(); if (!h) return null;
        const bs = h.slots[0] && h.slots[0].type ? h.slots[0] : null;
        const fs = h.slots[1] && h.slots[1].type ? h.slots[1] : null;
        const cells = shapeCells(shapeKind, drag.x0, drag.y0, drag.x1, drag.y1, !!drag.shift);
        return { cells: cells, borderState: bs, fillState: (shapeFill && shapeKind !== 'line') ? (fs || bs) : null };
    }
    function drawShape(ctx) {
        if (!drag) return;
        const p = shapePlan(); if (!p) return;
        ctx.save();
        ctx.globalAlpha = 0.6;
        const paint = (list, st) => list.forEach(c => {
            if (!visible(c[0], c[1])) return;
            if (st) drawState(ctx, st, c[0], c[1]);
            else { const s = screenOf(c[0], c[1]); ctx.fillStyle = 'rgba(255,80,80,.5)'; ctx.fillRect(s.sx, s.sy, tileSize, -tileSize); }
        });
        paint(p.cells.border, p.borderState);
        if (p.fillState) paint(p.cells.fill, p.fillState);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#4DA6FF'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        const all = p.cells.border.concat(p.fillState ? p.cells.fill : []);
        if (all.length) {
            let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
            all.forEach(q => { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); });
            const s = screenOf(a, d + 1);
            ctx.strokeRect(s.sx, s.sy, (b - a + 1) * tileSize, (d - c + 1) * tileSize);
            ctx.setLineDash([]);
            ctx.font = 'bold 12px Segoe UI, sans-serif'; ctx.textAlign = 'left';
            const txt = (b - a + 1) + ' × ' + (d - c + 1);
            ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(s.sx, s.sy - 18, ctx.measureText(txt).width + 10, 16);
            ctx.fillStyle = '#fff'; ctx.fillText(txt, s.sx + 5, s.sy - 6);
        }
        ctx.restore();
    }
    function commitShape() {
        const p = shapePlan(); drag = null;
        if (!p) return;
        if (p.cells.tooBig) { alert(t('shape_too_big', 'That shape is too big.')); return; }
        if (!p.borderState) { alert(t('shape_need_block', 'Put a block in slot 1 of the hotbar first (slot 2 = fill).')); return; }
        const list = p.cells.border.map(c => [c[0], c[1], p.borderState]);
        if (p.fillState) p.cells.fill.forEach(c => list.push([c[0], c[1], p.fillState]));
        applyChanges(list.filter(c => c[0] >= 0 && c[1] >= 0));
    }

    // =====================================================================
    // eventos del lienzo (después de los del editor, así mouse.worldX ya está al día)
    // =====================================================================
    function hookCanvas() {
        const cv = document.getElementById('canvas');
        if (!cv || cv.__mbwEditTools) return;
        cv.__mbwEditTools = true;
        cv.addEventListener('mousedown', function (e) {
            if (!worldOk() || mouse.worldX == null) return;
            const tl = tool();
            if (tl === 'transform' && X && e.button === 0) {
                X.drag = { sx: mouse.worldX - X.dx, sy: mouse.worldY - X.dy };
            } else if (tl === 'shapes' && (e.button === 0 || e.button === 2)) {
                if (!canEdit()) return;
                drag = { x0: mouse.worldX, y0: mouse.worldY, x1: mouse.worldX, y1: mouse.worldY, shift: e.shiftKey };
            } else if (tl === 'eyedropper' && (e.button === 0 || e.button === 2)) {
                if (typeof eyedropper === 'function') eyedropper(mouse.worldX, mouse.worldY);
                const h = document.querySelector('.hotbar-slot.active');
                if (h) { h.classList.remove('mbw-picked'); void h.offsetWidth; h.classList.add('mbw-picked'); }
            }
        });
        cv.addEventListener('mousemove', function (e) {
            if (mouse.worldX == null) return;
            if (X && X.drag) { X.dx = mouse.worldX - X.drag.sx; X.dy = mouse.worldY - X.drag.sy; }
            if (drag) { drag.x1 = mouse.worldX; drag.y1 = mouse.worldY; drag.shift = e.shiftKey; }
        });
        window.addEventListener('mouseup', function () {
            if (X) X.drag = null;
            if (drag) setTimeout(commitShape, 0);   // después de que el editor cierre su propio paso del historial
        });
        cv.addEventListener('mouseleave', function () { if (X) X.drag = null; });
    }

    // Teclado mientras se mueve una selección (y casillas 1/2 con Formas)
    window.addEventListener('keydown', function (e) {
        if (typing()) return;
        if (X) {
            if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); applyMove(); return; }
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancelMove(); return; }
            const blocked = /^(Digit\d|Key[ZXCVERYMBQ]|Delete|Backspace|Tab)$/;
            if (blocked.test(e.code) || e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopImmediatePropagation(); }
            return;
        }
        if (drag && e.key === 'Escape') { drag = null; e.preventDefault(); return; }
        if (tool() === 'shapes' && /^Digit\d$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const n = parseInt(e.code.charAt(5), 10);
            e.stopImmediatePropagation(); e.preventDefault();
            if (n === 1 || n === 2) { slotIndex = n - 1; if (typeof updateHotbarSelection === 'function') updateHotbarSelection(); }
        }
    }, true);

    // =====================================================================
    // selectTool: Move con selección = mover el área; Formas apaga las casillas 3–9
    // =====================================================================
    let origSelectTool = null;
    function wrapSelectTool() {
        const orig = window.selectTool;
        if (typeof orig !== 'function' || orig.__mbwEdit) return;
        origSelectTool = orig;
        const w = function (name) {
            if (X) cancelMove();
            if (name === 'move' && hasSel() && worldOk() && startMove()) { afterTool(); return; }
            const r = orig.apply(this, arguments);
            afterTool();
            return r;
        };
        w.__mbwEdit = true;
        window.selectTool = w;
        try { selectTool = w; } catch (e) { /* nada */ }
    }
    function afterTool() {
        const on = tool() === 'shapes';
        document.body.classList.toggle('mbw-shapes-on', on);
        if (on && typeof slotIndex !== 'undefined' && slotIndex > 1) {
            slotIndex = 0;
            if (typeof updateHotbarSelection === 'function') updateHotbarSelection();
        }
        if (!on) drag = null;
        const sb = document.getElementById('tool-shapes');
        if (sb) sb.classList.toggle('active', on);
    }

    // ---------- botón de Formas y su menú ----------
    const SHAPE_ICON = { line: 'shape-line', rect: 'shape-rect', tri: 'shape-tri', circle: 'shape-circle' };
    const SHAPE_NAME = { line: ['shape_line', 'Line'], rect: ['shape_rect', 'Rectangle'], tri: ['shape_tri', 'Triangle'], circle: ['shape_circle', 'Circle'] };
    function svg(name) { return '<svg class="mbw-ic" aria-hidden="true" focusable="false"><use href="#ic-' + name + '"></use></svg>'; }
    function paintShapeButton() {
        const b = document.getElementById('tool-shapes'); if (!b) return;
        b.innerHTML = svg(SHAPE_ICON[shapeKind]) + '<span class="mbw-flyout-mark"></span>';
        b.title = t('tooltip_tool_shapes', 'Shapes') + ' — ' + t(SHAPE_NAME[shapeKind][0], SHAPE_NAME[shapeKind][1]);
        const f = document.getElementById('shapes-flyout'); if (!f) return;
        f.querySelectorAll('[data-shape]').forEach(x => x.classList.toggle('on', x.getAttribute('data-shape') === shapeKind));
        f.querySelectorAll('[data-fill]').forEach(x => x.classList.toggle('on', (x.getAttribute('data-fill') === '1') === shapeFill));
    }
    function buildFlyout() {
        const b = document.getElementById('tool-shapes');
        if (!b || document.getElementById('shapes-flyout')) return;
        const f = document.createElement('div');
        f.id = 'shapes-flyout';
        let html = '<div class="sf-row">';
        SHAPES.forEach(k => { html += '<button type="button" class="sf-btn" data-shape="' + k + '" title="' + t(SHAPE_NAME[k][0], SHAPE_NAME[k][1]) + '">' + svg(SHAPE_ICON[k]) + '<span>' + t(SHAPE_NAME[k][0], SHAPE_NAME[k][1]) + '</span></button>'; });
        html += '</div><div class="sf-row sf-mode">' +
            '<button type="button" class="sf-btn" data-fill="1">' + svg('fill-solid') + '<span>' + t('shape_solid', 'Solid') + '</span></button>' +
            '<button type="button" class="sf-btn" data-fill="0">' + svg('fill-outline') + '<span>' + t('shape_outline', 'Outline') + '</span></button>' +
            '</div><div class="sf-hint">' + t('shape_hint', 'Slot 1 = border · Slot 2 = fill · Shift = even shape') + '</div>';
        f.innerHTML = html;
        document.body.appendChild(f);
        let hideT = null;
        function place() {
            const r = b.getBoundingClientRect();
            f.style.left = Math.round(r.right + 8) + 'px';
            f.style.top = Math.round(Math.max(8, Math.min(window.innerHeight - f.offsetHeight - 8, r.top - 6))) + 'px';
        }
        function open() { clearTimeout(hideT); f.classList.add('show'); place(); }
        function closeSoon() { clearTimeout(hideT); hideT = setTimeout(() => f.classList.remove('show'), 260); }
        window.mbwShapesFlyout = { open: open, close: function () { f.classList.remove('show'); } };
        const touch = () => document.body.classList.contains('is-touch');
        b.addEventListener('mouseenter', () => { if (!touch()) open(); });
        b.addEventListener('mouseleave', () => { if (!touch()) closeSoon(); });
        f.addEventListener('mouseenter', () => clearTimeout(hideT));
        f.addEventListener('mouseleave', () => { if (!touch()) closeSoon(); });
        b.addEventListener('click', function () {
            if (typeof window.selectTool === 'function') window.selectTool('shapes');
            if (touch()) { if (f.classList.contains('show')) f.classList.remove('show'); else open(); }
        });
        f.addEventListener('click', function (e) {
            const s = e.target.closest('[data-shape]'), m = e.target.closest('[data-fill]');
            if (s) { shapeKind = s.getAttribute('data-shape'); f.classList.remove('show'); }
            if (m) shapeFill = m.getAttribute('data-fill') === '1';
            if (!s && !m) return;
            saveShapeOpts(); paintShapeButton();
            if (tool() !== 'shapes' && typeof window.selectTool === 'function') window.selectTool('shapes');
        });
        document.addEventListener('pointerdown', function (e) {
            if (!f.classList.contains('show')) return;
            if (e.target.closest('#shapes-flyout') || e.target.closest('#tool-shapes')) return;
            f.classList.remove('show');
        }, true);
        paintShapeButton();
    }
    window.mbwShapes = {
        get: function () { return { kind: shapeKind, fill: shapeFill }; },
        set: function (k, fill) { if (SHAPES.indexOf(k) >= 0) shapeKind = k; if (fill !== undefined) shapeFill = !!fill; saveShapeOpts(); paintShapeButton(); },
        cells: shapeCells, plan: shapePlan,
        begin: function (x, y) { drag = { x0: x, y0: y, x1: x, y1: y }; }, to: function (x, y) { if (drag) { drag.x1 = x; drag.y1 = y; } }, end: commitShape
    };

    // ---------- brillo del botón Move cuando hay algo seleccionado ----------
    setInterval(function () {
        const mb = document.getElementById('tool-move'); if (!mb) return;
        const tl = tool();
        mb.classList.toggle('mbw-glow', !X && hasSel() && (tl === 'select' || tl === 'lasso' || tl === 'magic'));
    }, 200);

    // dibujo: lo llama main.js en cada cuadro (antes de la relación de aspecto)
    window.mbwEditToolsDraw = function (ctx) {
        if (typeof camera === 'undefined' || typeof tileSize === 'undefined') return;
        try { drawMove(ctx); } catch (e) { /* nada */ }
        try { drawShape(ctx); } catch (e) { /* nada */ }
    };

    function init() { wrapSelectTool(); hookCanvas(); buildFlyout(); afterTool(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.addEventListener('load', init);
    window.addEventListener('mbw-lang-changed', function () {
        const f = document.getElementById('shapes-flyout'); if (f) { f.remove(); buildFlyout(); }
    });
})();
