// ==========================================================
// 📱 CELULAR (ACOSTADO) Y TABLET
//
// 1) DEDOS SOBRE EL MUNDO
//    · 1 dedo  = la herramienta elegida (Lápiz pone el bloque de la mano, Borrador quita, Cubeta rellena, Move agarra mobs,
//                Seleccionar marca...). Por dentro se "traduce" a clics del mouse, así todas las herramientas funcionan igual.
//    · 2 dedos = arrastrar mueve el mundo; pellizcar (abrir / cerrar los dedos) cambia el zoom alrededor de los dedos.
//    · Tocar con 2 dedos (sin moverlos) = Deshacer.
//    · Con Move: tocar 2 veces un mob = abrir su ventana (como el doble clic); dejar el dedo quieto ~½ segundo sobre un cofre
//      o un letrero = abrirlo (como el clic derecho).
//    El primer dedo espera un instante (90 ms) antes de pintar, por si enseguida llega el segundo: así mover el mundo con 2
//    dedos no deja manchas.
// 2) PANTALLA
//    · Pone en <body> la clase is-touch (pantalla táctil) y además is-phone (celular) o is-tablet. El CSS (style.css,
//      "CELULAR Y TABLET") acomoda todo: en el celular las barras de arriba se achican y la cinta de opciones se abre como un
//      cajón al tocar su pestaña (y se cierra al tocar el mundo).
//    · Las ventanas que no caben en la pantalla se achican solas (zoom) para caber; si aun así no caben, se desplazan.
//    Para probar en la computadora: agrega ?mobile=phone o ?mobile=tablet a la dirección (o ?mobile=off para quitarlo).
// ==========================================================
(function () {
    'use strict';
    const body = document.body, root = document.documentElement;
    const M = window.mbwMobile = { mode: 'desktop', touch: false, stats: { taps: 0, strokes: 0, pans: 0, pinches: 0, undos: 0, dbl: 0, longs: 0, fits: 0 } };
    const $ = (id) => document.getElementById(id);

    // ------------------------------------------------------------------ ¿qué pantalla es?
    function forced() {
        try {
            const q = new URLSearchParams(location.search).get('mobile');
            if (q) { localStorage.setItem('mbw_force_mobile', q === 'off' ? '' : q); return q; }
            return localStorage.getItem('mbw_force_mobile') || '';
        } catch (e) { return ''; }
    }
    function detect() {
        const f = forced();
        let touch;
        if (f === 'off') touch = false;
        else if (f) touch = true;
        else touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && window.matchMedia && matchMedia('(hover: none)').matches);
        const shortSide = Math.min(window.innerWidth, window.innerHeight);
        let mode = 'desktop';
        if (f === 'phone' || f === 'tablet') mode = f;
        else if (touch) mode = shortSide <= 540 ? 'phone' : 'tablet';
        const was = M.mode;
        M.mode = mode; M.touch = touch;
        body.classList.toggle('is-touch', touch);
        body.classList.toggle('is-phone', mode === 'phone');
        body.classList.toggle('is-tablet', mode === 'tablet');
        body.classList.toggle('is-portrait', window.innerHeight > window.innerWidth);
        if (was !== mode) closeDrawer();
        layout();
    }

    // ------------------------------------------------------------------ medidas (celular): el mundo empieza justo bajo las barras
    let lastTop = -1;
    function layout() {
        const top = $('top-area');
        if (M.mode === 'phone' && top) {
            const h = Math.round(top.getBoundingClientRect().height);
            if (h > 0 && h !== lastTop) { lastTop = h; root.style.setProperty('--m-top', h + 'px'); }
        }
        const T = (typeof WorldTabsManager !== 'undefined' && WorldTabsManager.openWorlds) ? WorldTabsManager.openWorlds.length : 1;
        body.classList.toggle('single-tab', M.touch && T <= 1);   // (solo hace falta en celular / tablet)
        relayout();
    }
    function relayout() {
        const ws = $('workspace'), cv = $('canvas');
        if (ws && cv && (cv.width !== ws.clientWidth || cv.height !== ws.clientHeight)) {
            try { window.dispatchEvent(new Event('resize')); } catch (e) { if (typeof resizeCanvas === 'function') resizeCanvas(); }
        }
    }

    // ------------------------------------------------------------------ cinta de opciones como cajón (celular)
    function drawerOpen() { return body.classList.contains('ribbon-open'); }
    function closeDrawer() { body.classList.remove('ribbon-open'); }
    M.closeDrawer = closeDrawer;
    const origOpenTab = window.openTab;
    if (typeof origOpenTab === 'function') {
        window.openTab = function (name) {
            const pane = $('tab-' + name);
            const wasActive = pane && pane.classList.contains('active');
            const r = origOpenTab.apply(this, arguments);
            if (M.mode === 'phone') {
                if (wasActive && drawerOpen()) closeDrawer(); else body.classList.add('ribbon-open');
            }
            return r;
        };
    }

    // ------------------------------------------------------------------ ventanas que caben en la pantalla
    const FIT_MIN = { phone: 0.6, tablet: 0.72 };
    function contentOf(m) {
        for (const c of m.children) { if (c.nodeType === 1 && getComputedStyle(c).display !== 'none' && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') return c; }
        return null;
    }
    function shown(m) { return m.style.display && m.style.display !== 'none' && getComputedStyle(m).display !== 'none'; }
    function innerScroller(c) {
        let level = [c], n = 0;
        for (let d = 0; d < 4 && level.length; d++) {
            const next = [];
            for (const e of level) for (const k of e.children) {
                if (++n > 400) return false;
                if (k.scrollHeight > k.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(k).overflowY)) return true;
                next.push(k);
            }
            level = next;
        }
        return false;
    }
    function fit(m) {
        const c = contentOf(m);
        if (!c) return;
        const reset = () => { c.style.zoom = ''; if (c.dataset.mFit) { c.style.maxWidth = ''; c.style.maxHeight = ''; c.style.marginTop = ''; c.style.marginBottom = ''; c.style.flexShrink = ''; delete c.dataset.mFit; } m.classList.remove('m-fit-scroll'); };
        reset();
        if (!M.touch) return;
        const vv = window.visualViewport;
        const vw = Math.min(window.innerWidth, vv ? Math.round(vv.width * vv.scale) : window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
        const vh = Math.min(window.innerHeight, vv ? Math.round(vv.height * vv.scale) : window.innerHeight);
        // su tamaño de diseño, sin los topes "% de la pantalla" que la apretaban (y la cortaban o la aplastaban por dentro)
        const cs0 = getComputedStyle(c);
        // ventana hecha para bajar entera por dentro (Configuración...); si ya trae su propia lista que baja
        // (Inventario) no: ahí se achica toda, para que se vea completa (la hotbar de abajo incluida)
        const scrolls = /auto|scroll/.test(cs0.overflowY) && cs0.maxHeight !== 'none' && !innerScroller(c);
        c.dataset.mFit = '1'; c.style.maxWidth = 'none'; c.style.maxHeight = 'none'; c.style.flexShrink = '0';   // (en ventanas "flex" la de adentro se encogía)
        let w = c.offsetWidth, h = c.offsetHeight;
        if (scrolls || h > vh * 1.6) { c.style.maxHeight = ''; h = c.offsetHeight; }       // esas (y las listas largas) siguen bajando por dentro
        if (!w || !h || (w <= vw - 8 && h <= vh - 8)) { reset(); return; }      // ya cabe tal como se diseñó: se deja igual
        let s = Math.min(1, (vw - 8) / w, (vh - 8) / h);
        const min = FIT_MIN[M.mode] || 0.75;
        if (s < min) s = min;
        if (s < 0.985) {
            c.style.zoom = String(Math.floor(s * 1000) / 1000); M.stats.fits++;
            if (getComputedStyle(c).position !== 'absolute') { c.style.marginTop = '4px'; c.style.marginBottom = '4px'; }   // (sin el margen de arriba de siempre: cabe más)
        }
        if (h * s > vh - 4 || w * s > vw - 4) m.classList.add('m-fit-scroll');
    }
    function fitAll() { document.querySelectorAll('.modal, .mbw-modal-overlay').forEach(m => { if (shown(m)) fit(m); }); }
    M.fitAll = fitAll;
    const mo = new MutationObserver(function (recs) {
        let any = false;
        recs.forEach(r => {
            const t = r.target;
            if (t.nodeType === 1 && t.classList && (t.classList.contains('modal') || t.classList.contains('mbw-modal-overlay')) && r.attributeName === 'style') {
                if (shown(t)) { any = true; closeDrawer(); }
            }
        });
        if (any) requestAnimationFrame(() => requestAnimationFrame(fitAll));
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });

    // ------------------------------------------------------------------ dedos sobre el mundo
    const canvas = $('canvas');
    const T = { mode: null, pts: new Map(), startT: 0, start: null, timer: 0, longTimer: 0, btn: 0, lastTap: null, g: null, undoBase: -1, oneAt: 0 };
    const HOLD_MS = 90, LONG_MS = 520, TAP_MOVE = 10, DBL_MS = 320;
    function tool() { return typeof currentTool !== 'undefined' ? currentTool : ''; }
    function fire(type, x, y, button) {
        const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: button || 0, buttons: type === 'mouseup' ? 0 : (button === 2 ? 2 : 1), detail: type === 'dblclick' ? 2 : 1 });
        canvas.dispatchEvent(ev);
    }
    function undoLen() { try { return historyManager.undoStack.length; } catch (e) { return -1; } }
    function beginOne() {
        if (T.mode !== 'pending') return;
        clearTimeout(T.timer);
        T.mode = 'one';
        T.btn = tool() === 'pencil' ? 2 : 0;           // con el Lápiz el clic que PONE el bloque es el derecho (el izquierdo rompe)
        T.oneAt = performance.now();
        T.undoBase = undoLen();
        fire('mousemove', T.start.x, T.start.y);
        fire('mousedown', T.start.x, T.start.y, T.btn);
        M.stats.strokes++;
    }
    function endOne(later) {
        if (T.mode !== 'one') return;
        const p = T.last || T.start, btn = T.btn;
        T.mode = null;
        // un toque rápido: el botón se "suelta" 2 fotogramas después, para que el Lápiz / Borrador alcancen a actuar
        // (ellos trabajan en cada fotograma mientras el botón está apretado)
        if (later) { T.releasing = true; requestAnimationFrame(() => requestAnimationFrame(() => { T.releasing = false; fire('mouseup', p.x, p.y, btn); })); }
        else fire('mouseup', p.x, p.y, btn);
    }
    function longPress() {
        if (!(T.mode === 'pending' || T.mode === 'one') || T.moved) return;
        if (tool() !== 'move' || (typeof isDraggingMob !== 'undefined' && isDraggingMob)) return;
        if (T.mode === 'one') { fire('mouseup', T.start.x, T.start.y, T.btn); }
        clearTimeout(T.timer);
        T.mode = 'done';
        fire('mousemove', T.start.x, T.start.y);
        fire('mousedown', T.start.x, T.start.y, 2);
        fire('mouseup', T.start.x, T.start.y, 2);
        M.stats.longs++;
    }
    // Mover (Move) con UN dedo: si el dedo empieza sobre un mob, lo agarra (como siempre);
    // si empieza en un lugar vacío, arrastra el mapa. Tocar un cofre o un letrero lo abre.
    // con la relación de aspecto puesta, la imagen está estirada: el dedo se "des-estira" (scripts/aspect-view.js)
    function unstretch(x, y) { return (window.mbwAspect && window.mbwAspect.active) ? window.mbwAspect.mapClient(x, y) : { x: x, y: y }; }
    function worldAt(x, y) {
        const u = unstretch(x, y); x = u.x; y = u.y;
        const r = canvas.getBoundingClientRect();
        const sx = (x - r.left) * (canvas.width / r.width);
        const cy = canvas.height - (y - r.top) * (canvas.height / r.height);
        return { wx: camera.x + sx / tileSize, wy: camera.y + cy / tileSize };
    }
    function mobUnder(x, y) {
        try {
            fire('mousemove', x, y);
            if (typeof findMobAt !== 'function' || typeof mouse === 'undefined') return false;
            return !!findMobAt(camera.x + mouse.canvasX / tileSize, camera.y + mouse.canvasY / tileSize);
        } catch (e) { return false; }
    }
    function openableUnder(x, y) {
        try {
            fire('mousemove', x, y);
            const bs = mbwom.getBlockState(mouse.worldX, mouse.worldY);
            return !!bs && (bs.type === 'chest' || bs.type === 'sign');
        } catch (e) { return false; }
    }
    function startPan() {
        clearTimeout(T.timer); clearTimeout(T.longTimer);
        T.mode = 'pan';
        const w = worldAt(T.start.x, T.start.y);
        T.pan = { wx: w.wx, wy: w.wy };
        panTo(T.last);
    }
    function panTo(p) {
        const g = T.pan; if (!g || !p) return;
        p = unstretch(p.x, p.y);
        const r = canvas.getBoundingClientRect();
        const sx = (p.x - r.left) * (canvas.width / r.width);
        const cy = canvas.height - (p.y - r.top) * (canvas.height / r.height);
        let nx = g.wx - sx / tileSize, ny = g.wy - cy / tileSize;
        if (!window.smoothScroll) { nx = Math.round(nx); ny = Math.round(ny); }
        if (nx !== camera.x || ny !== camera.y) { camera.x = nx; camera.y = ny; camera._tx = nx; camera._ty = ny; camera.velX = 0; camera.velY = 0; M.stats.pans++; }
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
    function mid() {
        const a = Array.from(T.pts.values());
        return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1 };
    }
    function startGesture() {
        clearTimeout(T.timer); clearTimeout(T.longTimer);
        if (T.mode === 'one') {
            // el primer dedo ya empezó a pintar justo antes del segundo: se termina y, si alcanzó a cambiar algo, se deshace
            const quick = performance.now() - T.oneAt < 350;
            endOne();
            if (quick && T.undoBase >= 0 && undoLen() > T.undoBase && (tool() === 'pencil' || tool() === 'eraser')) { try { historyManager.undo(); } catch (e) { /* nada */ } }
        }
        T.mode = 'two';
        const m = mid(), r = canvas.getBoundingClientRect();
        const cx = m.x - r.left, cy = canvas.height - (m.y - r.top) * (canvas.height / r.height);
        const sx = cx * (canvas.width / r.width);
        T.g = { d0: m.d, z0: currentZoom, wx: camera.x + sx / tileSize, wy: camera.y + cy / tileSize, t0: performance.now(), moved: 0, m0: m };
    }
    function moveGesture() {
        const g = T.g; if (!g) return;
        const m = mid(), r = canvas.getBoundingClientRect();
        g.moved = Math.max(g.moved, Math.hypot(m.x - g.m0.x, m.y - g.m0.y), Math.abs(m.d - g.d0));
        // zoom: el nivel más cercano (en escala "de veces") a lo que piden los dedos
        const want = g.z0 * (m.d / g.d0);
        let best = currentZoomIndex, bestD = Infinity;
        for (let i = 0; i < ZOOM_LEVELS.length; i++) { const dd = Math.abs(Math.log(ZOOM_LEVELS[i] / want)); if (dd < bestD) { bestD = dd; best = i; } }
        if (best !== currentZoomIndex && g.moved > 6) { updateZoomSlider(best); M.stats.pinches++; }
        // el punto del mundo que estaba entre los dedos se queda entre los dedos (eso también mueve el mundo)
        const sx = (m.x - r.left) * (canvas.width / r.width);
        const cy = canvas.height - (m.y - r.top) * (canvas.height / r.height);
        let nx = g.wx - sx / tileSize, ny = g.wy - cy / tileSize;
        if (!window.smoothScroll) { nx = Math.round(nx); ny = Math.round(ny); }
        if (nx !== camera.x || ny !== camera.y) { camera.x = nx; camera.y = ny; camera._tx = nx; camera._ty = ny; camera.velX = 0; camera.velY = 0; M.stats.pans++; }
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
    function onStart(e) {
        if (!canvas) return;
        e.preventDefault();
        closeDrawer();
        for (const t of e.changedTouches) T.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
        if (T.pts.size === 1 && (T.mode === null || T.mode === 'done') && !T.releasing) {
            const t = e.changedTouches[0];
            T.mode = 'pending'; T.moved = false;
            T.start = { x: t.clientX, y: t.clientY }; T.last = T.start; T.startT = performance.now();
            T.moveTool = tool() === 'move';
            T.onMob = T.moveTool ? mobUnder(T.start.x, T.start.y) : false;
            // con Move sobre un lugar vacío no se "aprieta" nada: o es un toque, o es arrastrar el mapa
            if (!T.moveTool || T.onMob) T.timer = setTimeout(beginOne, HOLD_MS);
            T.longTimer = setTimeout(longPress, LONG_MS);
        } else if (T.pts.size === 2 && T.mode !== 'two') {
            startGesture();
        }
    }
    function onMove(e) {
        e.preventDefault();
        for (const t of e.changedTouches) if (T.pts.has(t.identifier)) T.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
        if (T.mode === 'two' && T.pts.size >= 2) { moveGesture(); return; }
        if (T.mode === 'pan') { const t = e.changedTouches[0]; T.last = { x: t.clientX, y: t.clientY }; panTo(T.last); return; }
        if (T.mode !== 'pending' && T.mode !== 'one') return;
        const t = e.changedTouches[0];
        T.last = { x: t.clientX, y: t.clientY };
        if (Math.hypot(T.last.x - T.start.x, T.last.y - T.start.y) > TAP_MOVE) { T.moved = true; clearTimeout(T.longTimer); }
        if (T.mode === 'pending' && T.moved && T.moveTool && !T.onMob) { startPan(); return; }
        if (T.mode === 'pending' && T.moved) {
            // empieza a pintar: el primer fotograma pinta donde se apoyó el dedo; el movimiento llega un fotograma después
            // (así el Lápiz rellena la línea desde ahí y no se salta la primera casilla)
            beginOne();
            const p = T.last;
            requestAnimationFrame(() => { if (T.mode === 'one') fire('mousemove', (T.last || p).x, (T.last || p).y); });
            return;
        }
        if (T.mode === 'one') fire('mousemove', T.last.x, T.last.y);
    }
    function onEnd(e) {
        e.preventDefault();
        for (const t of e.changedTouches) T.pts.delete(t.identifier);
        clearTimeout(T.longTimer);
        if (T.mode === 'two') {
            if (T.pts.size === 0) {
                const g = T.g;
                // tocar con dos dedos sin moverlos = Deshacer
                if (g && g.moved < 12 && performance.now() - g.t0 < 350) { try { historyManager.undo(); M.stats.undos++; } catch (err) { /* nada */ } }
                T.mode = null; T.g = null;
            }
            return;                                     // (si queda un dedo, no pinta hasta levantar todos)
        }
        if (T.pts.size > 0) return;
        const now = performance.now();
        if (T.mode === 'pan') { T.mode = null; T.pan = null; T.lastTap = null; return; }
        if (T.mode === 'pending' && T.moveTool && !T.onMob && openableUnder(T.start.x, T.start.y)) {
            // Move: tocar un cofre o un letrero lo abre (igual que el clic derecho en la computadora)
            clearTimeout(T.timer);
            fire('mousedown', T.start.x, T.start.y, 2);
            fire('mouseup', T.start.x, T.start.y, 2);
            M.stats.taps++; M.stats.opens = (M.stats.opens || 0) + 1;
            T.mode = null; T.lastTap = null;
            return;
        }
        if (T.mode === 'pending') {                     // un toque rápido: clic
            beginOne();
            endOne(true);
            M.stats.taps++;
            const p = T.start;
            if (T.lastTap && now - T.lastTap.t < DBL_MS && Math.hypot(p.x - T.lastTap.x, p.y - T.lastTap.y) < 24) {
                fire('dblclick', p.x, p.y, 0); M.stats.dbl++; T.lastTap = null;
            } else T.lastTap = { x: p.x, y: p.y, t: now };
        } else if (T.mode === 'one') {
            endOne();
            T.lastTap = null;
        }
        T.mode = null;
    }
    if (canvas) {
        canvas.addEventListener('touchstart', onStart, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        canvas.addEventListener('touchend', onEnd, { passive: false });
        canvas.addEventListener('touchcancel', onEnd, { passive: false });
    }
    // Safari: que pellizcar sobre el editor no agrande la página entera
    ['gesturestart', 'gesturechange'].forEach(n => document.addEventListener(n, function (e) { if (body.classList.contains('is-touch')) e.preventDefault(); }, { passive: false }));
    // tocar el mundo (o fuera de la cinta) cierra el cajón
    document.addEventListener('pointerdown', function (e) {
        if (!drawerOpen()) return;
        const rib = $('ribbon');
        if (rib && rib.contains(e.target)) return;
        if (e.target.closest && e.target.closest('.modal, .mbw-modal-overlay, #backstage-menu')) return;
        closeDrawer();
    }, true);

    // ------------------------------------------------------------------ arranque y cambios
    window.addEventListener('resize', function () { detect(); if (M.touch) fitAll(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { detect(); fitAll(); }, 250); });
    if (window.ResizeObserver && $('top-area')) new ResizeObserver(() => layout()).observe($('top-area'));
    if (typeof WorldTabsManager !== 'undefined' && typeof WorldTabsManager.renderTabs === 'function') {
        const origRender = WorldTabsManager.renderTabs;
        WorldTabsManager.renderTabs = function () { const r = origRender.apply(this, arguments); layout(); return r; };
    }
    // botón de pantalla completa en la barra de arriba (en el celular la barra de abajo, donde vive, no se muestra)
    (function addFullscreen() {
        const rg = document.querySelector('#top-bar .right-group');
        const can = document.fullscreenEnabled || document.webkitFullscreenEnabled;
        const inApp = /MBWEApp\//.test(navigator.userAgent);   // la app de Android ya es pantalla completa
        if (inApp) document.documentElement.classList.add('is-app');
        if (!rg || !can || inApp || $('m-fullscreen-btn')) return;
        const b = document.createElement('button');
        b.id = 'm-fullscreen-btn'; b.type = 'button'; b.className = 'icon-btn icon-only';
        b.setAttribute('data-i18n-title', 'tooltip_fullscreen'); b.title = 'Fullscreen';
        b.textContent = '⛶';
        b.onclick = function () { if (typeof window.toggleFullscreenHUD === 'function') window.toggleFullscreenHUD(); };
        rg.insertBefore(b, rg.firstChild);
    })();
    detect();
    window.addEventListener('load', detect);
})();
