// =====================================================================
// 📍 Elegir en el mapa la nueva posición del Player (pestaña Player > Location)
// =====================================================================
// Al tocar el botón, un Player "fantasma" (medio transparente) sigue al cursor; con un clic se queda ahí.
// La posición acepta decimales (se guarda con 2): los pies del Player quedan justo donde está la punta del cursor.
// Esc o "Cancel" lo cancela. En celular / tablet: se arrastra para mover el mapa, se toca donde va y se confirma.
(function () {
    'use strict';
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
    let picking = null;      // { ghost: {x, y} | null, stop: fn }

    // Punto EXACTO del mundo (con decimales) bajo una posición de la pantalla
    function worldExact(ev) {
        const cv = document.getElementById('canvas');
        if (!cv || typeof camera === 'undefined' || typeof tileSize === 'undefined') return null;
        const r = cv.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return null;
        const cx = (ev.clientX - r.left) * (cv.width / r.width), cy = cv.height - (ev.clientY - r.top) * (cv.height / r.height);
        return { x: camera.x + cx / tileSize, y: camera.y + cy / tileSize };
    }
    const r2 = function (v) { return Math.round(v * 100) / 100; };

    function apply(p) {
        const w = (typeof mbwom !== 'undefined') ? mbwom.world : null;
        if (!w || !p) return;
        w.worldX = r2(p.x);
        w.worldY = -r2(p.y);                     // (en el archivo la Y del Player va con el signo al revés)
        if (typeof mbwom.currentScene !== 'undefined') w.scene = mbwom.currentScene;   // queda en la dimensión que se está viendo
        if (typeof window.populateLocationSettings === 'function') window.populateLocationSettings();
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }

    // El fantasma se dibuja con el mismo dibujo del Player (drawPlayer de main.js), medio transparente.
    // main.js lo llama DESPUÉS de la oscuridad, para que se vea bien aunque esté bajo tierra.
    function drawGhost() {
        if (!picking || !picking.ghost || typeof mbwom === 'undefined' || !mbwom.world || typeof ctx === 'undefined') return;
        if (typeof window.drawPlayer !== 'function') return;
        const w = mbwom.world;
        const keep = { x: w.worldX, y: w.worldY, s: w.scene, sel: window.mbwPlayerSelected };
        try {
            w.worldX = picking.ghost.x; w.worldY = -picking.ghost.y;
            if (typeof mbwom.currentScene !== 'undefined') w.scene = mbwom.currentScene;
            window.mbwPlayerSelected = false;
            ctx.save(); ctx.globalAlpha = 0.55;
            window.drawPlayer();
        } finally {
            ctx.restore();
            w.worldX = keep.x; w.worldY = keep.y; w.scene = keep.s; window.mbwPlayerSelected = keep.sel;
        }
    }

    function start() {
        if (picking) { picking.stop(false); return; }       // tocar el botón otra vez = cancelar
        if (typeof mbwom === 'undefined' || !mbwom.world) return;
        const el = function (tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
        const banner = el('div', 'cb-pick-banner pp-pick-banner');
        const txt = el('span', null, tr('pp_pick_banner', 'Click on the map to place the Player. Esc cancels.'));
        const pos = el('b', 'cb-pick-pos');
        const cancel = el('button', 'cb-btn', tr('cb_cancel', 'Cancel')); cancel.type = 'button';
        banner.appendChild(txt); banner.appendChild(pos); banner.appendChild(cancel);
        document.body.appendChild(banner);
        document.body.classList.add('cb-picking');
        const btn = document.getElementById('btn-player-pick'); if (btn) btn.classList.add('active');
        const showPos = function (g) { pos.textContent = g ? 'X: ' + r2(g.x) + '  Y: ' + r2(g.y) : ''; };
        const inUi = function (e) { return !!(e.target && e.target.closest && e.target.closest('.pp-pick-banner, #ribbon, #top-area, .modal, .mbw-modal-overlay')); };
        const onCanvas = function (e) { return !inUi(e) && !!worldExact(e); };
        const touchMode = !!(window.mbwMobile && window.mbwMobile.touch);
        const swallow = function (e) { if (!onCanvas(e)) return; e.stopImmediatePropagation(); e.preventDefault(); };
        const onMove = function (e) {
            if (touchMode) return;
            const g = worldExact(e);
            picking.ghost = g; showPos(g);
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        };
        const onUp = function (e) {
            if (touchMode || !onCanvas(e)) return;
            if (e.button !== undefined && e.button !== 0) return;
            e.stopImmediatePropagation(); e.preventDefault();
            const g = worldExact(e);
            if (!g) return;
            stop(true);
            apply(g);
        };
        const onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); stop(false); } };
        let okBtn = null;
        if (touchMode) {
            // dedos: mobile.js mueve el mapa; un toque llama a pickCb (pone el fantasma) y "Confirm" lo deja ahí
            banner.classList.add('cb-pick-touch');
            txt.textContent = tr('pp_pick_banner_touch', 'Drag to move the map and tap where the Player goes.');
            okBtn = el('button', 'cb-btn cb-btn-ok', tr('cb_confirm', 'Confirm')); okBtn.type = 'button'; okBtn.disabled = true;
            banner.insertBefore(okBtn, cancel);
            okBtn.addEventListener('click', function () { if (!picking || !picking.ghost) return; const g = picking.ghost; stop(true); apply(g); });
            window.mbwMobile.pickCb = function (x, y) {
                const g = worldExact({ clientX: x, clientY: y });
                if (!g || !picking) return;
                picking.ghost = g; showPos(g); okBtn.disabled = false;
                if (typeof worldDirty !== 'undefined') worldDirty = true;
            };
        }
        const down = touchMode ? ['pointerdown', 'mousedown', 'click', 'contextmenu'] : ['pointerdown', 'mousedown', 'touchstart', 'click', 'contextmenu'];
        function stop(done) {
            down.forEach(function (n) { window.removeEventListener(n, swallow, true); });
            window.removeEventListener('pointerup', onUp, true);
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('keydown', onKey, true);
            if (touchMode && window.mbwMobile) window.mbwMobile.pickCb = null;
            banner.remove(); document.body.classList.remove('cb-picking');
            if (btn) btn.classList.remove('active');
            picking = null;
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
        down.forEach(function (n) { window.addEventListener(n, swallow, true); });
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('keydown', onKey, true);
        cancel.addEventListener('click', function () { stop(false); });
        picking = { ghost: null, stop: stop };
    }
    window.mbwPlayerPick = { start: start, active: function () { return !!picking; }, apply: apply, drawGhost: drawGhost };
})();
