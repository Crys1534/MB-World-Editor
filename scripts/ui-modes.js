// ==========================================================
// 🧘 MODOS DE PANTALLA (Ronda 13)
// ----------------------------------------------------------
// Aquí viven:
//   · Modo Zen            (botón ⛶ de la barra de estado, que lo activa junto con la pantalla completa, + tecla H, que se puede cambiar en Ajustes > Controls).
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

    // la barra de herramientas y la hotbar SIEMPRE flotan (ya no hay otra opción).
    // (MBW_LEGACY_LAYOUT solo lo usan las pruebas automáticas viejas, que revisan la pantalla de antes)
    const legacyLayout = !!window.MBW_LEGACY_LAYOUT;
    state.float = legacyLayout ? read(KEY.float) !== '0' : true;
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
        state.float = legacyLayout ? !!on : true;   // (siempre flotantes; se deja la función por si algo la llama)
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
    // 💬 Burbujas de chat ("cabezas de chat", como Messenger)
    // ─────────────────────────────────────────────
    // Una burbuja redonda POR PERSONA, con su foto y el número de mensajes sin leer, apiladas abajo a la derecha.
    //   · Un clic abre la mini ventana de chat de esa persona (scripts/mini-chat.js) para leer y contestar sin salir del editor.
    //     Un clic en la burbuja de la ventana que ya está abierta la minimiza (vuelve a ser solo la burbuja).
    //   · La burbuja de un chat que abriste se queda (aunque ya no haya nada sin leer) hasta que la cierras con su ✕.
    //   · La ✕ de una burbuja la esconde; vuelve si esa persona escribe algo nuevo.
    //   · Si hay más de 4, la última es "+N" y abre la lista de chats completa.
    // multiplayer.js manda los chats sin leer con mbwChatHead.sync([...]) y dice cómo abrir un chat con setOpener(fn).
    // Todo el texto entra con textContent y la foto pasa por safeIcon (nada de HTML ajeno).
    const MAX_HEADS = 4;
    const head = { box: null, items: [], total: 0, pinned: [], dismissed: {}, seen: {}, active: null, opener: null, onDismiss: null, list: [] };
    const tm = function (k, fb, vars) { return (typeof window.tmsg === 'function') ? window.tmsg(k, fb, vars || null) : fb.replace('{n}', vars && vars.n != null ? vars.n : ''); };
    function headTip(it) {
        const who = String(it.name || '').slice(0, 30);
        const what = it.count > 0 ? tm('chat_head_tip', 'New messages: {n}. Click to open.', { n: it.count }) : tm('chat_head_open', 'Click to open the chat.');
        return (who ? who + ' — ' : '') + what;
    }
    // Las burbujas que se ven: los chats abiertos en mini ventana + los que tienen mensajes sin leer (sin los que cerraste con ✕)
    function headList() {
        const by = {}, out = [];
        head.pinned.forEach(function (p) {
            if (head.dismissed[p.uid]) return;
            const o = { uid: p.uid, name: p.name, pfp: p.pfp, count: 0, ts: 0, at: p.at, pinned: true };
            by[p.uid] = o; out.push(o);
        });
        head.items.forEach(function (i) {
            if (head.dismissed[i.uid]) return;
            const o = by[i.uid];
            if (o) { o.count = i.count; o.ts = i.ts || 0; if (i.name) o.name = i.name; if (i.pfp) o.pfp = i.pfp; return; }
            out.push({ uid: i.uid, name: i.name, pfp: i.pfp, count: i.count, ts: i.ts || 0, at: 0, pinned: false });
        });
        out.sort(function (a, b) { return Math.max(b.ts, b.at) - Math.max(a.ts, a.at); });
        return out;
    }
    function buildBox() {
        const box = document.createElement('div');
        box.id = 'chat-heads';
        document.body.appendChild(box);
        head.box = box;
    }
    function makeHead(it) {
        const el = document.createElement('div');
        el.className = 'chat-head'; el.setAttribute('role', 'button'); el.tabIndex = 0; el.dataset.uid = it.uid;
        const pfp = document.createElement('div'); pfp.className = 'ch-pfp';
        pfp.style.backgroundImage = 'url(' + JSON.stringify(safeIcon(it.pfp)) + ')';
        const count = document.createElement('div'); count.className = 'ch-count';
        count.textContent = it.count > 99 ? '99+' : String(it.count);
        if (!(it.count > 0)) count.style.display = 'none';
        const x = document.createElement('button'); x.type = 'button'; x.className = 'ch-x'; x.textContent = '✕';
        x.setAttribute('aria-label', tm('chat_head_close', 'Hide'));
        el.appendChild(pfp); el.appendChild(count); el.appendChild(x);
        el.title = headTip(it);
        el.setAttribute('aria-label', el.title);
        el.classList.toggle('on', head.active === it.uid);
        el.addEventListener('click', function () { clickHead(it); });
        el.addEventListener('keydown', function (e) { if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); clickHead(it); } });
        x.addEventListener('click', function (e) { e.stopPropagation(); dismissHead(it.uid); });
        return el;
    }
    function makeMore(n, rest) {
        const el = document.createElement('div');
        el.className = 'chat-head ch-more'; el.setAttribute('role', 'button'); el.tabIndex = 0;
        const t = document.createElement('div'); t.className = 'ch-more-n'; t.textContent = '+' + n;
        el.appendChild(t);
        el.title = tm('chat_head_more', '{n} more chats. Click to see all your chats.', { n: n });
        el.setAttribute('aria-label', el.title);
        const go = function () { if (typeof head.opener === 'function') { try { head.opener(null, rest); } catch (e) { /* sin romper nada */ } } };
        el.addEventListener('click', go);
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        return el;
    }
    function clickHead(it) {
        // la burbuja de la mini ventana que está abierta: la minimiza
        if (head.active === it.uid && window.mbwMiniChat && typeof window.mbwMiniChat.minimize === 'function') { window.mbwMiniChat.minimize(); return; }
        if (typeof head.opener === 'function') { try { head.opener([{ uid: it.uid, name: it.name, pfp: it.pfp, count: it.count, ts: it.ts }]); } catch (e) { /* un fallo al abrir no debe romper nada más */ } }
        // si no quedó abierta en mini ventana (se abrió el chat grande), la burbuja se esconde hasta que llegue algo nuevo
        if (!head.pinned.some(function (p) { return p.uid === it.uid; })) head.dismissed[it.uid] = true;
        renderHead();
    }
    function dismissHead(uid) {
        head.dismissed[uid] = true;
        head.pinned = head.pinned.filter(function (p) { return p.uid !== uid; });
        if (head.active === uid) head.active = null;
        if (typeof head.onDismiss === 'function') { try { head.onDismiss(uid); } catch (e) { /* nada */ } }
        renderHead();
    }
    let headObs = null;
    function renderHead() {
        paintHead();
        if (headObs) headObs.takeRecords();     // los cambios de clase que acabo de hacer yo no deben volver a llamarme
    }
    function paintHead() {
        const focus = typeof window.mbwFocusModeActive === 'function' && window.mbwFocusModeActive();
        const list = focus ? [] : headList();
        head.list = list;
        const show = list.length > 0;
        document.body.classList.toggle('has-chat-head', show);
        if (!head.box) { if (!show) return; buildBox(); }
        head.box.textContent = '';
        head.box.classList.toggle('show', show);
        if (!show) return;
        const shown = list.length > MAX_HEADS ? list.slice(0, MAX_HEADS - 1) : list;
        shown.forEach(function (it) { head.box.appendChild(makeHead(it)); });
        if (list.length > MAX_HEADS) head.box.appendChild(makeMore(list.length - shown.length, list.slice(shown.length)));
        if (window.mbwMiniChat && typeof window.mbwMiniChat.refresh === 'function') window.mbwMiniChat.refresh();
    }
    window.mbwChatHead = {
        // items: [{ uid, name, pfp, count, ts }] solo de chats con mensajes sin leer (sin silenciados ni bloqueados)
        sync: function (items) {
            items = (Array.isArray(items) ? items : []).filter(function (i) { return i && i.uid && i.count > 0; });
            items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
            const seen = {};
            items.forEach(function (i) {
                if ((Number(i.count) || 0) > (head.seen[i.uid] || 0)) delete head.dismissed[i.uid];   // esa persona escribió algo nuevo: su burbuja vuelve
                seen[i.uid] = Number(i.count) || 0;
            });
            head.seen = seen;
            head.items = items;
            head.total = items.reduce(function (n, i) { return n + (Number(i.count) || 0); }, 0);
            renderHead();
        },
        setOpener: function (fn) { head.opener = fn; },
        onDismiss: function (fn) { head.onDismiss = fn; },
        // La mini ventana avisa qué chat tiene abierto (su burbuja se queda) y cuál está a la vista ahora
        pin: function (uid, name, pfp) {
            if (!uid) return;
            delete head.dismissed[uid];
            head.pinned = head.pinned.filter(function (p) { return p.uid !== uid; });
            head.pinned.unshift({ uid: uid, name: name, pfp: pfp, at: Date.now() });
            renderHead();
        },
        unpin: function (uid) { head.pinned = head.pinned.filter(function (p) { return p.uid !== uid; }); if (head.active === uid) head.active = null; renderHead(); },
        setActive: function (uid) { head.active = uid || null; renderHead(); },
        refresh: renderHead,
        state: function () {
            const shown = !!(head.box && head.box.classList.contains('show'));
            return { total: head.total, shown: shown, heads: head.list.map(function (i) { return i.uid; }), active: head.active, pinned: head.pinned.map(function (p) { return p.uid; }), chats: head.items.length };
        }
    };
    // Al entrar o salir del Zen / pantalla completa las burbujas se esconden o vuelven
    try { headObs = new MutationObserver(function () { renderHead(); }); headObs.observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* sin observador: se actualiza con el próximo mensaje */ }
    document.addEventListener('fullscreenchange', function () { renderHead(); });

    // ─────────────────────────────────────────────
    // ⬆️ Botón para esconder / mostrar las barras de arriba (top-area), en todos lados.
    // En la computadora solo aparece con el mouse dentro de las barras de arriba (o pegado al borde de arriba
    // cuando están escondidas); con los dedos se ve siempre.
    // ─────────────────────────────────────────────
    const TOP_KEY = 'mbw_top_hidden';
    state.topHidden = read(TOP_KEY) === '1';
    const CHEV_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const CHEV_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    let topBtn = null, topHideTimer = 0;
    function ttx(k, fb) { const v = (typeof window.tmsg === 'function') ? window.tmsg(k, fb) : fb; return v || fb; }
    function topBottom() {
        const t = $('top-area');
        return (!state.topHidden && t && t.offsetHeight > 0) ? Math.round(t.getBoundingClientRect().bottom) : 0;
    }
    function topBtnUpdate() {
        if (!topBtn) return;
        topBtn.innerHTML = state.topHidden ? CHEV_DOWN : CHEV_UP;
        topBtn.title = state.topHidden ? ttx('top_show', 'Show the top bars') : ttx('top_hide', 'Hide the top bars');
        topBtn.setAttribute('aria-label', topBtn.title);
        topBtn.style.top = Math.max(0, topBottom()) + 'px';
    }
    window.setTopAreaHidden = function (on) {
        state.topHidden = !!on;
        write(TOP_KEY, state.topHidden ? '1' : '0');
        if (state.topHidden && window.mbwMobile && typeof window.mbwMobile.closeDrawer === 'function') window.mbwMobile.closeDrawer();
        body.classList.toggle('top-hidden', state.topHidden);
        measureTopArea();
        relayout();
        topBtnUpdate();
        requestAnimationFrame(function () { relayout(); topBtnUpdate(); });
    };
    window.toggleTopArea = function () { window.setTopAreaHidden(!state.topHidden); };
    window.topAreaOnLanguageChanged = topBtnUpdate;
    (function makeTopBtn() {
        topBtn = document.createElement('button');
        topBtn.id = 'top-toggle';
        topBtn.type = 'button';
        topBtn.addEventListener('click', function (e) { e.stopPropagation(); window.toggleTopArea(); });
        document.body.appendChild(topBtn);
        body.classList.toggle('top-hidden', state.topHidden);
        topBtnUpdate();
        document.addEventListener('mousemove', function (e) {
            if (body.classList.contains('is-touch')) return;
            const near = e.clientY <= topBottom() + 24;   // (incluye el propio botón, que cuelga justo debajo)
            if (near) { clearTimeout(topHideTimer); topBtn.classList.add('show'); }
            else if (topBtn.classList.contains('show')) { clearTimeout(topHideTimer); topHideTimer = setTimeout(function () { topBtn.classList.remove('show'); }, 350); }
        }, { passive: true });
        document.documentElement.addEventListener('mouseleave', function () { clearTimeout(topHideTimer); topHideTimer = setTimeout(function () { topBtn.classList.remove('show'); }, 350); });
        window.addEventListener('resize', topBtnUpdate);
        if (window.ResizeObserver && $('top-area')) new ResizeObserver(topBtnUpdate).observe($('top-area'));
    })();

    // ─────────────────────────────────────────────
    // Arranque
    // ─────────────────────────────────────────────
    sync();
    onFullscreenChange();
    if (state.topHidden) window.setTopAreaHidden(true);
})();
