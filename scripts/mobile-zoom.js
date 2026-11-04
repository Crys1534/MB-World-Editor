// =====================================================================
// 🔍 Zoom flotante para el celular
// =====================================================================
// En el celular la barra de abajo (con el zoom) no se ve. Aquí hay un botón redondo abajo a la derecha:
// al tocarlo salen un "−" a su izquierda y un "+" a su derecha (y arriba se ve el % de zoom). Se vuelven a esconder solos.
// Usa las mismas funciones que la barra de abajo (zoomHUD), así que el zoom suave y el bloqueo de la relación de aspecto funcionan igual.
(function () {
    'use strict';
    const body = document.body;
    let root = null, main = null, minus = null, plus = null, pct = null, hideTimer = 0, open = false;
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };

    function build() {
        root = document.createElement('div'); root.id = 'mbw-zoom-fab';
        const mk = function (cls, txt) { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = txt; return b; };
        minus = mk('zf-side zf-minus', '−');
        plus = mk('zf-side zf-plus', '+');
        main = mk('zf-main', '');
        main.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.2 15.2L21 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';   // (dibujo fijo, sin datos de nadie)
        pct = document.createElement('span'); pct.className = 'zf-pct';
        root.appendChild(minus); root.appendChild(main); root.appendChild(plus); root.appendChild(pct);
        document.body.appendChild(root);
        main.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!open); });
        minus.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
        plus.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
        root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });   // los toques aquí no pintan en el mundo
        texts();
    }
    function texts() {
        if (!root) return;
        main.title = tr('tooltip_zoom_fab', 'Zoom'); main.setAttribute('aria-label', main.title);
        minus.title = tr('tooltip_zoom_out', 'Zoom Out'); minus.setAttribute('aria-label', minus.title);
        plus.title = tr('tooltip_zoom_in', 'Zoom In'); plus.setAttribute('aria-label', plus.title);
    }
    function paint() {
        if (!root) return;
        pct.textContent = (typeof currentZoom !== 'undefined' ? currentZoom : 100) + '%';
        const atMin = typeof currentZoomIndex !== 'undefined' && currentZoomIndex <= 0;
        const atMax = typeof currentZoomIndex !== 'undefined' && typeof ZOOM_LEVELS !== 'undefined' && currentZoomIndex >= ZOOM_LEVELS.length - 1;
        minus.disabled = atMin; plus.disabled = atMax;
    }
    function arm() { clearTimeout(hideTimer); hideTimer = setTimeout(function () { setOpen(false); }, 3500); }
    function setOpen(on) {
        open = !!on;
        root.classList.toggle('open', open);
        main.setAttribute('aria-expanded', open ? 'true' : 'false');
        clearTimeout(hideTimer);
        if (open) { paint(); arm(); }
    }
    function step(d) {
        if (typeof window.zoomHUD === 'function') window.zoomHUD(d);
        paint(); arm();
    }
    function refresh() {
        // celular = pantalla táctil con la pantalla física chica (un celular en vertical puede salir como "tablet" por lo ancho de las barras)
        let small = false;
        try { small = Math.min(screen.width, screen.height) <= 600; } catch (e) { /* nada */ }
        const phone = body.classList.contains('is-phone') || (body.classList.contains('is-touch') && small);
        body.classList.toggle('has-zoom-fab', phone);
        if (phone && !root) build();
        if (root) { root.style.display = phone ? '' : 'none'; if (!phone) setOpen(false); else paint(); }
    }
    // toca el mundo = se esconde
    document.addEventListener('pointerdown', function (e) { if (open && root && !root.contains(e.target)) setOpen(false); }, true);
    // la clase is-phone la pone mobile.js (puede cambiar al girar el celular)
    try { new MutationObserver(refresh).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* sin observador: se revisa al cargar */ }
    window.addEventListener('mbw-lang-changed', texts);
    // si el zoom cambia con los dedos, el % se actualiza
    setInterval(function () { if (open) paint(); }, 400);
    refresh();
    window.mbwZoomFab = { refresh: refresh, isOpen: function () { return open; } };
})();
