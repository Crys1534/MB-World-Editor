// =====================================================================
// 🪜 Botones flotantes de Espejo y Girar en el celular (escaleras y losas)
// =====================================================================
// En el celular no se ve la cinta de arriba con los botones Mirror / Rotate. Cuando el bloque de la casilla elegida es una
// escalera o una losa, aparecen dos botones redondos arriba del botón de zoom (abajo a la derecha):
//   · Girar  = lo mismo que el botón Rotate (rotateFromButton, scripts/tools.js).
//   · Espejo = escalera: la voltea de izquierda a derecha (1↔2, 3↔4, como Mirror del portapapeles); losa: de abajo a arriba (1↔2),
//              porque una losa no tiene lado izquierdo / derecho.
// Con otra herramienta (Select, Move...) pasan al Lápiz para que se vea el bloque cambiado, igual que Rotate.
(function () {
    'use strict';
    const body = document.body;
    let root = null, bMirror = null, bRotate = null, last = '';
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
    function heldFamily() {
        try {
            if (typeof hotbar === 'undefined' || !hotbar.slots || typeof slotIndex === 'undefined') return null;
            const s = hotbar.slots[slotIndex];
            if (!s || typeof window.variantFamilyFor !== 'function') return null;
            const f = window.variantFamilyFor(s.type);
            return (f === 'stair' || f === 'slab') ? f : null;
        } catch (e) { return null; }
    }
    function build() {
        root = document.createElement('div'); root.id = 'mbw-block-fab'; root.style.display = 'none';
        const mk = function (id, icon) {
            const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'bf-btn';
            b.innerHTML = '<svg class="mbw-ic" aria-hidden="true" focusable="false"><use href="#' + icon + '"></use></svg>';   // (dibujo fijo del editor)
            return b;
        };
        bMirror = mk('bf-mirror', 'ic-mirror'); bRotate = mk('bf-rotate', 'ic-rotate');
        root.appendChild(bMirror); root.appendChild(bRotate);
        document.body.appendChild(root);
        root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });   // los toques aquí no pintan en el mundo
        bRotate.addEventListener('click', function (e) { e.stopPropagation(); if (typeof window.rotateFromButton === 'function') window.rotateFromButton(); });
        bMirror.addEventListener('click', function (e) { e.stopPropagation(); mirror(); });
        texts();
    }
    function texts() {
        if (!root) return;
        bMirror.title = tr('tooltip_mirror', 'Mirror'); bMirror.setAttribute('aria-label', bMirror.title);
        bRotate.title = tr('tooltip_rotate', 'Rotate'); bRotate.setAttribute('aria-label', bRotate.title);
    }
    function mirror() {
        const fam = heldFamily();
        if (!fam) return false;
        const copy = structuredClone(hotbar.slots[slotIndex]);
        let ok = false;
        if (fam === 'stair') ok = typeof window.flipBlockVariant === 'function' && window.flipBlockVariant(copy, 'h');
        else {
            const cur = Number(copy.states1);
            const to = cur === 1 ? 2 : cur === 2 ? 1 : null;
            if (to !== null && (!window.texturesMap || window.texturesMap[copy.type + '_' + to])) { copy.states1 = (typeof copy.states1 === 'string') ? String(to) : to; ok = true; }
        }
        if (!ok) return false;
        if (typeof currentTool !== 'undefined' && !['pencil', 'bucket', 'line', 'rect-shape', 'circle'].includes(currentTool) && typeof selectTool === 'function') selectTool('pencil');
        hotbar.slots[slotIndex] = copy;
        if (typeof renderHotbarUI === 'function') renderHotbarUI();
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        return true;
    }
    function refresh() {
        let small = false;
        try { small = Math.min(screen.width, screen.height) <= 600; } catch (e) { /* nada */ }
        const phone = body.classList.contains('is-phone') || (body.classList.contains('is-touch') && small);
        const fam = phone ? heldFamily() : null;
        const key = String(fam) + (typeof slotIndex !== 'undefined' ? ':' + slotIndex : '');
        if (key === last && root) return;
        last = key;
        if (fam && !root) build();
        if (root) root.style.display = fam ? 'flex' : 'none';
    }
    window.mbwBlockFab = { refresh: refresh, mirror: mirror };
    window.addEventListener('mbw-lang-changed', texts);
    setInterval(refresh, 250);
    refresh();
})();
