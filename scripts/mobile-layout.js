// =====================================================================
// 📱 Orden de herramientas en el celular
// =====================================================================
// Para que la barra de herramientas de la izquierda no sea tan larga en el celular:
//   · "Relación de aspecto" (ojo) se pasa a la pestaña View (grupo "Aspect ratio").
//   · "Captura de pantalla" (cámara) se pasa a la izquierda del botón Download.
// Son los MISMOS botones (solo se cambian de lugar), así que siguen funcionando igual. Desde la Snapshot 39 se mueven igual en la computadora.
(function () {
    'use strict';
    const body = document.body;
    const $ = (id) => document.getElementById(id);
    let home = null;      // { aspect: next sibling, shots: next sibling }
    function place() {
        const side = $('toolbar-sidebar'), asp = $('tool-aspect'), shot = $('tool-screenshot');
        const slot = $('view-aspect-slot'), dl = $('export-dropdown-container');
        if (!side || !asp || !shot) return;
        if (!home) home = { aspect: asp.nextSibling, shot: shot.nextSibling };
        // (antes solo en el celular; ahora también en la computadora: el ojo va a View y la cámara junto a Download)
        const phone = true;
        body.classList.toggle('phone-tools-moved', phone);
        if (phone) {
            if (slot && asp.parentNode !== slot) { slot.appendChild(asp); asp.classList.add('ribbon-btn-large'); }
            if (dl && dl.parentNode && shot.parentNode !== dl.parentNode) { dl.parentNode.insertBefore(shot, dl); shot.classList.add('tool-in-topbar'); }
        } else {
            if (asp.parentNode !== side) { asp.classList.remove('ribbon-btn-large'); side.insertBefore(asp, home.aspect && home.aspect.parentNode === side ? home.aspect : $('tool-shapes')); }
            if (shot.parentNode !== side) { shot.classList.remove('tool-in-topbar'); side.appendChild(shot); }
        }
    }
    try { new MutationObserver(place).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* sin observador */ }
    window.mbwPhoneToolsPlace = place;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place); else place();
    window.addEventListener('load', place);
})();

// =====================================================================
// 🗑 Celular: botón para eliminar el mob seleccionado
// =====================================================================
// Con la herramienta Move, al tocar un mob queda seleccionado. En el celular no hay tecla Delete, así que aparece un botón rojo.
(function () {
    'use strict';
    let btn = null, shown = false;
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
    function phone() {
        let small = false;
        try { small = Math.min(screen.width, screen.height) <= 600; } catch (e) { /* nada */ }
        return document.body.classList.contains('is-phone') || (document.body.classList.contains('is-touch') && small);
    }
    function build() {
        btn = document.createElement('button'); btn.type = 'button'; btn.id = 'mbw-del-mob'; btn.style.display = 'none';
        const t = document.createElement('span'); t.className = 'dm-txt';
        btn.appendChild(t);
        btn.insertAdjacentHTML('afterbegin', '<svg class="mbw-ic" aria-hidden="true" focusable="false"><use href="#ic-trash"></use></svg>');   // (dibujo fijo del editor)
        document.body.appendChild(btn);
        btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        btn.addEventListener('click', function (e) { e.stopPropagation(); if (typeof window.mbwDeleteSelectedMob === 'function') window.mbwDeleteSelectedMob(); refresh(); });
        texts();
    }
    function texts() { if (btn) { btn.querySelector('.dm-txt').textContent = tr('mob_delete_btn', 'Delete mob'); btn.title = tr('mob_delete_btn', 'Delete mob'); } }
    function refresh() {
        const on = phone() && typeof selectedMobKey !== 'undefined' && !!selectedMobKey && typeof mbwom !== 'undefined' && !!(mbwom.mobs && mbwom.mobs[selectedMobKey]);
        if (on === shown && btn) return;
        shown = on;
        if (on && !btn) build();
        if (btn) btn.style.display = on ? 'flex' : 'none';
    }
    window.mbwDelMobFab = { refresh: refresh };
    window.addEventListener('mbw-lang-changed', texts);
    setInterval(refresh, 250);
})();
