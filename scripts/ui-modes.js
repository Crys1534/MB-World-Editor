// ==========================================================
// 🧘 MODOS DE PANTALLA (Ronda 13)
// ----------------------------------------------------------
// Aquí viven:
//   · Modo Zen            (botón 🧘 de la barra de estado + tecla H, que se puede cambiar en Ajustes > Controls).
//                         Es el modo para trabajar en pantalla completa: el mundo ocupa toda la ventana, la barra lateral y la hotbar
//                         flotan (semitransparentes) y las barras de arriba, de la izquierda y de abajo se ESCONDEN y salen solas
//                         al acercar el mouse a su borde (antes esto eran dos cosas separadas: Zen y "auto-ocultar"; ahora es una).
//   · Paneles flotantes   (la barra lateral y la hotbar flotan sobre el mundo, semitransparentes, también fuera del Zen)
//   · Opacidad de los paneles flotantes
//   · Límite de FPS       (sin límite, 60 o 30; el que dibuja es mainLoop en main.js)
//   · El globito discreto de mensajes nuevos
//   · El aviso de "pantalla completa" (para marcar el botón ⛶)
//
// El tamaño del lienzo sale de las variables CSS --ws-top / --ws-left / --ws-bottom (ver style.css, "MODO ZEN"):
// cada modo solo pone una clase en <body> y el CSS hace el resto. Después se llama a resizeCanvas() (main.js), que
// mantiene la cámara centrada, así que el mundo no salta al esconder o mostrar barras.
// ==========================================================
(function () {
    'use strict';

    const KEY = { float: 'mbw_float_panels', opacity: 'mbw_panel_opacity', fps: 'mbw_fps_limit' };
    const body = document.body;
    const root = document.documentElement;
    const $ = (id) => document.getElementById(id);

    function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function write(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* almacenamiento bloqueado: simplemente no se recuerda */ } }

    // El Zen NO se recuerda al recargar (así nadie se encuentra con el editor "vacío" sin saber por qué); lo demás sí.
    const state = { zen: false, float: false, opacity: 85, fps: 0 };
    window.uiModes = state;

    state.float = read(KEY.float) === '1';
    const savedOpacity = parseInt(read(KEY.opacity), 10);
    if (savedOpacity >= 20 && savedOpacity <= 100) state.opacity = savedOpacity;
    const savedFps = parseInt(read(KEY.fps), 10);
    state.fps = (savedFps === 30 || savedFps === 60) ? savedFps : 0;
    window.fpsLimit = state.fps;


    // ─────────────────────────────────────────────
    // Aplicar el estado a la pantalla
    // ─────────────────────────────────────────────
    function placeHotbar() {
        const hb = $('hotbar-container'), floatBox = $('float-hotbar'), ribbonBox = $('ribbon-hotbar-content');
        if (!hb || !floatBox || !ribbonBox) return;
        const floating = state.zen || state.float;
        // La hotbar se MUDA de sitio (no se copia): sigue siendo la misma, con sus casillas y su selección
        if (floating && hb.parentNode !== floatBox) floatBox.insertBefore(hb, floatBox.firstChild);
        else if (!floating && hb.parentNode !== ribbonBox) ribbonBox.insertBefore(hb, ribbonBox.firstChild);
    }

    function measureTopArea() {
        const t = $('top-area');
        if (t && t.offsetHeight > 0) root.style.setProperty('--top-area-h', t.offsetHeight + 'px');
    }

    function relayout() {
        // Si el espacio del mundo cambió de tamaño se avisa como si la ventana hubiera cambiado ("resize"): así se ajustan a la vez
        // el lienzo (resizeCanvas, que deja la cámara centrada), el de la lluvia y el de la cuadrícula.
        const ws = $('workspace'), cv = $('canvas');
        if (ws && cv && (cv.width !== ws.clientWidth || cv.height !== ws.clientHeight)) {
            try { window.dispatchEvent(new Event('resize')); } catch (e) { if (typeof resizeCanvas === 'function') resizeCanvas(); }
        }
    }

    function syncControls() {
        const set = (id, fn) => { const el = $(id); if (el) fn(el); };
        set('float-panels-toggle', (el) => { el.checked = state.float; });
        set('panel-opacity-slider', (el) => { el.value = state.opacity; });
        set('panel-opacity-display', (el) => { el.textContent = state.opacity + '%'; });
        set('fps-limit-select', (el) => { el.value = String(state.fps); });
        set('zen-btn', (el) => { el.classList.toggle('active', state.zen); });
    }

    function sync() {
        const floating = state.zen || state.float;
        const hide = state.zen;   // en Zen las barras se esconden y salen al acercar el mouse al borde
        body.classList.toggle('zen-mode', state.zen);
        body.classList.toggle('float-panels', state.float);
        body.classList.toggle('panels-floating', floating);
        body.classList.toggle('ui-autohide', hide);
        if (!hide) { clearReveal(); }
        root.style.setProperty('--panel-opacity', (state.opacity / 100).toFixed(2));
        placeHotbar();
        measureTopArea();
        syncControls();
        relayout();
    }

    // ─────────────────────────────────────────────
    // Lo que usa el resto del editor (botones, atajos, Ajustes)
    // ─────────────────────────────────────────────
    window.toggleZenMode = function (force) {
        const on = (typeof force === 'boolean') ? force : !state.zen;
        if (on === state.zen) return;
        zenByFullscreen = false;   // si la persona lo cambia a mano, ya no es "cosa de la pantalla completa"
        state.zen = on;
        sync();
    };

    // Ronda 16: el botón ⛶ también activa el Zen. Se recuerda si FUE la pantalla completa la que lo encendió, para apagarlo
    // al salir de ella (con ⛶, con Esc o como sea). Si el Zen ya estaba encendido de antes, o la persona lo cambia a mano
    // mientras tanto, la pantalla completa no lo toca.
    let zenByFullscreen = false;
    window.zenForFullscreen = function (on) {
        if (on) {
            if (state.zen) return;
            zenByFullscreen = true;
            state.zen = true;
            sync();
        } else if (zenByFullscreen) {
            zenByFullscreen = false;
            if (state.zen) { state.zen = false; sync(); }
        }
    };

    window.setFloatPanels = function (on) {
        state.float = !!on;
        write(KEY.float, state.float ? '1' : '0');
        sync();
    };

    window.setPanelOpacity = function (v) {
        let n = parseInt(v, 10);
        if (isNaN(n)) return;
        n = Math.max(20, Math.min(100, n));
        state.opacity = n;
        write(KEY.opacity, n);
        root.style.setProperty('--panel-opacity', (n / 100).toFixed(2));
        syncControls();
    };

    window.setFpsLimit = function (v) {
        const n = parseInt(v, 10);
        state.fps = (n === 30 || n === 60) ? n : 0;
        window.fpsLimit = state.fps;
        write(KEY.fps, state.fps);
        syncControls();
    };

    // ¿Está la persona en un modo "sin distracciones"? (Zen o pantalla completa)
    window.mbwFocusModeActive = function () {
        return !!(state.zen || document.fullscreenElement || document.webkitFullscreenElement);
    };

    // ─────────────────────────────────────────────
    // Auto-ocultar: las barras salen al acercar el mouse al borde
    // ─────────────────────────────────────────────
    const EDGE = 7;              // píxeles del borde que "llaman" a la barra
    const HIDE_DELAY = 350;      // espera antes de esconderla (para no parpadear)
    const timers = { top: null, left: null, bottom: null };
    let last = { x: -1, y: -1, t: null, b: 0 };

    function panelEl(name) { return $(name === 'top' ? 'top-area' : name === 'left' ? 'toolbar-sidebar' : 'status-bar'); }
    function inside(el, target) { return !!(el && target && el.contains(target)); }
    // "Foco que cuenta": una casilla de texto (o algo al que se llegó con la tecla Tab). Un botón en el que solo se hizo clic con el
    // mouse conserva el foco, pero eso NO debe dejar la barra abierta para siempre.
    function focusIn(el) {
        const a = document.activeElement;
        if (!el || !a || a === document.body || !el.contains(a)) return false;
        try { return a.matches(':focus-visible'); } catch (e) { return false; }
    }

    function wantedNow(name) {
        const free = !last.b;   // con un botón del mouse apretado (pintando, arrastrando) el borde no abre nada
        const el = panelEl(name);
        if (name === 'top') return (free && last.y >= 0 && last.y <= EDGE) || inside(el, last.t) || focusIn(el);
        if (name === 'left') return (free && last.x >= 0 && last.x <= EDGE) || inside(el, last.t) || focusIn(el);
        return (free && last.y >= 0 && last.y >= window.innerHeight - EDGE) || inside(el, last.t) || focusIn(el);
    }

    function reveal(name) {
        if (timers[name]) { clearTimeout(timers[name]); timers[name] = null; }
        body.classList.add('reveal-' + name);
    }

    function scheduleHide(name) {
        if (timers[name]) return;
        timers[name] = setTimeout(function () {
            timers[name] = null;
            if (!state.zen || wantedNow(name)) return;
            body.classList.remove('reveal-' + name);
        }, HIDE_DELAY);
    }

    function clearReveal() {
        ['top', 'left', 'bottom'].forEach(function (n) {
            if (timers[n]) { clearTimeout(timers[n]); timers[n] = null; }
            body.classList.remove('reveal-' + n);
        });
    }

    function evaluate() {
        if (!state.zen) return;
        ['top', 'left', 'bottom'].forEach(function (n) {
            if (wantedNow(n)) reveal(n);
            else if (body.classList.contains('reveal-' + n)) scheduleHide(n);
        });
    }

    document.addEventListener('mousemove', function (e) {
        last = { x: e.clientX, y: e.clientY, t: e.target, b: e.buttons };
        evaluate();
    }, true);
    root.addEventListener('mouseleave', function () {
        last = { x: -1, y: -1, t: null, b: 0 };
        evaluate();
    });
    // Con el teclado (Tab) también se puede llegar a la barra de arriba: mientras tenga el foco se queda a la vista
    document.addEventListener('focusin', function () { if (state.zen && focusIn(panelEl('top'))) reveal('top'); });
    document.addEventListener('focusout', function () { setTimeout(evaluate, 0); });

    if (typeof ResizeObserver === 'function' && $('top-area')) {
        try { new ResizeObserver(measureTopArea).observe($('top-area')); } catch (e) { /* sin ResizeObserver: queda la medida de fábrica */ }
    }

    // ─────────────────────────────────────────────
    // Pantalla completa: se marca el botón ⛶ y se revisa el tamaño del lienzo (la cámara se queda en el centro)
    // ─────────────────────────────────────────────
    function onFullscreenChange() {
        const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        body.classList.toggle('is-fullscreen', fs);
        const b = $('fullscreen-btn');
        if (b) b.classList.toggle('active', fs);
        if (!fs) window.zenForFullscreen(false);   // al salir de la pantalla completa se apaga el Zen que ella encendió
        relayout();
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    // ─────────────────────────────────────────────
    // 💬 Globito discreto de mensajes nuevos
    // ─────────────────────────────────────────────
    // Chiquito, abajo a la derecha, con foto + nombre + un pedacito del mensaje. Se va solo a los 6 segundos
    // (se queda mientras el mouse está encima). Un clic abre el chat; la ✕ lo cierra.
    // Todo el texto entra con textContent (nunca como HTML): un nombre o mensaje raro no puede ejecutar nada.
    const BUBBLE_MS = 6000;
    let bubble = null, bubbleCount = 0, bubbleTimer = null, bubbleClick = null, bubbleHover = false;
    let elPfp, elName, elMsg, elCount;

    function safeIcon(u) {
        u = String(u || '');
        return /^(assets\/|data:image\/|https:\/\/)/.test(u) ? u : 'assets/default pfp.png';
    }

    function buildBubble() {
        bubble = document.createElement('div');
        bubble.id = 'msg-bubble';
        bubble.setAttribute('role', 'status');
        bubble.setAttribute('aria-live', 'polite');

        elPfp = document.createElement('div'); elPfp.className = 'mb-pfp';
        const text = document.createElement('div'); text.className = 'mb-text';
        elName = document.createElement('span'); elName.className = 'mb-name';
        elMsg = document.createElement('span'); elMsg.className = 'mb-msg';
        text.appendChild(elName); text.appendChild(elMsg);
        elCount = document.createElement('div'); elCount.className = 'mb-count';
        const x = document.createElement('button'); x.className = 'mb-x'; x.type = 'button'; x.textContent = '✕';
        x.setAttribute('aria-label', 'Close');

        bubble.appendChild(elPfp); bubble.appendChild(text); bubble.appendChild(elCount); bubble.appendChild(x);

        bubble.addEventListener('click', function () {
            const cb = bubbleClick;
            window.hideMessageBubble();
            if (typeof cb === 'function') { try { cb(); } catch (e) { /* un fallo al abrir el chat no debe romper nada más */ } }
        });
        x.addEventListener('click', function (ev) { ev.stopPropagation(); window.hideMessageBubble(); });
        bubble.addEventListener('mouseenter', function () { bubbleHover = true; clearTimeout(bubbleTimer); });
        bubble.addEventListener('mouseleave', function () { bubbleHover = false; armBubbleTimer(); });
        document.body.appendChild(bubble);
    }

    function armBubbleTimer() {
        clearTimeout(bubbleTimer);
        if (bubbleHover) return;
        bubbleTimer = setTimeout(function () { window.hideMessageBubble(); }, BUBBLE_MS);
    }

    window.showMessageBubble = function (name, text, icon, onClick) {
        if (!bubble) buildBubble();
        const visible = bubble.classList.contains('show') && bubble.classList.contains('in');
        bubbleCount = visible ? bubbleCount + 1 : 1;
        bubbleClick = onClick;
        elName.textContent = String(name || '').slice(0, 30);
        elMsg.textContent = String(text == null ? '' : text).replace(/\s+/g, ' ').slice(0, 80);
        elPfp.style.backgroundImage = 'url(' + JSON.stringify(safeIcon(icon)) + ')';
        elCount.textContent = String(bubbleCount);
        elCount.style.display = bubbleCount > 1 ? 'block' : 'none';
        bubble.classList.add('show');
        requestAnimationFrame(function () { bubble.classList.add('in'); });
        armBubbleTimer();
    };

    window.hideMessageBubble = function () {
        if (!bubble) return;
        clearTimeout(bubbleTimer);
        bubbleCount = 0;
        bubbleClick = null;
        bubble.classList.remove('in');
        setTimeout(function () { if (!bubble.classList.contains('in')) bubble.classList.remove('show'); }, 220);
    };

    // ─────────────────────────────────────────────
    // Arranque
    // ─────────────────────────────────────────────
    sync();
    onFullscreenChange();
})();
