// ==========================================================
// 💬 CHAT / CONSOLA DEL MUNDO: botones de comandos, ⌨ teclado del celular y el botón 💬 del editor
//
//  · Al abrir el chat (editor o Modo Jugar) salen botones grandes, uno debajo de otro (como en Minecraft):
//      Teleport ›  →  Quién ›  (los jugadores con la cabeza de su skin)  /  Dónde ›  (los ⭐ marcadores del mundo)
//      Game mode ›  →  Survival / Creative / Adventure / Spectator
//      Weather ›    →  Clear / Rain / Thunder
//      Time ›       →  Day / Night
//  · En el celular el teclado NO se abre solo: sale al tocar la caja de texto. Cuando sale, la caja se sube justo arriba del teclado.
//  · Editor: un botón con el dibujo del chat (assets/chat.png) al lado de la hotbar abre el chat (en la PC también con T o Enter).
// ==========================================================
(function () {
    'use strict';
    const tr = (k, fb) => { try { const s = window.tmsg ? window.tmsg(k, fb) : fb; return s || fb; } catch (e) { return fb; } };
    const touch = () => document.body.classList.contains('is-touch') || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const CHAT_ICON = 'assets/chat.png';
    window.MBW_CHAT_ICON = CHAT_ICON;

    // ------------------------------------------------------------------ ⌨ alto del teclado del celular → --kb
    function kb() {
        const vv = window.visualViewport;
        let h = 0;
        if (vv) h = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        if (h < 60) h = 0;                                            // (barras del navegador que aparecen y desaparecen: no es el teclado)
        document.documentElement.style.setProperty('--kb', h + 'px');
        document.body.classList.toggle('kb-open', h > 0);
        const c = document.getElementById('chat-container');
        if (c) c.style.bottom = (h ? h + 6 : 48) + 'px';
    }
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', kb); window.visualViewport.addEventListener('scroll', kb); }
    window.addEventListener('resize', kb);
    window.mbwKbUpdate = kb;

    // ------------------------------------------------------------------ 🙂 la cabeza de la skin de un jugador (8×8 de la imagen)
    function head(sk) {
        const cv = document.createElement('canvas');
        cv.width = 8; cv.height = 8; cv.className = 'qc-head';
        const sheet = (sk && window.mbwPlaySkinSheet ? window.mbwPlaySkinSheet(sk) : null) || (window.mbwPlay && window.mbwPlay.frank);
        const draw = function () { try { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 8, 8); c.drawImage(sheet, 4, 2, 8, 8, 0, 0, 8, 8); } catch (e) { /* nada */ } };
        if (sheet) { if (sheet.complete !== false && (sheet.naturalWidth || sheet.width)) draw(); else sheet.addEventListener('load', draw, { once: true }); }
        return cv;
    }
    window.mbwSkinHead = head;

    // ------------------------------------------------------------------ los botones (sirve para el editor y para el Modo Jugar)
    // ctx = { run(cmd), players() → [{ name, sk }], tpPlayer(p), marks() → [{ name, x, y, dim }], tpMark(b) }
    window.mbwQuickCmd = function (box, ctx) {
        let path = [];
        function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
        function btn(label, sub, onClick, opt) {
            const b = el('button', 'qc-btn' + (opt && opt.cls ? ' ' + opt.cls : ''));
            b.type = 'button';
            if (opt && opt.icon) b.appendChild(opt.icon);
            b.appendChild(el('span', 'qc-l', label));
            if (sub) b.appendChild(el('span', 'qc-sub', sub));
            if (opt && opt.more) b.appendChild(el('span', 'qc-arrow', '›'));
            b.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); });   // (no le quita el foco a la caja)
            b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
            return b;
        }
        const go = function (k) { return function () { path.push(k); render(); }; };
        const run = function (c) { return function () { path = []; ctx.run(c); }; };
        function render() {
            box.innerHTML = '';
            const col = el('div', 'qc');
            const p = path.join('/');
            if (path.length) col.appendChild(btn('‹ ' + tr('qc_back', 'Back'), '', function () { path.pop(); render(); }, { cls: 'qc-back' }));
            if (!p) {
                if (ctx.back && ctx.back()) col.appendChild(btn('💀 ' + tr('qc_back_death', 'Back to where I died'), '/back', run('/back'), { cls: 'qc-death' }));
                col.appendChild(btn(tr('qc_tp', 'Teleport'), '/tp', go('tp'), { more: true }));
                col.appendChild(btn(tr('qc_gamemode', 'Game mode'), '/gamemode', go('gamemode'), { more: true }));
                col.appendChild(btn(tr('qc_weather', 'Weather'), '/weather', go('weather'), { more: true }));
                col.appendChild(btn(tr('qc_time', 'Time'), '/time', go('time'), { more: true }));
            } else if (p === 'tp') {
                col.appendChild(btn(tr('qc_who', 'Who'), tr('qc_who_sub', 'go to a player'), go('who'), { more: true }));
                col.appendChild(btn(tr('qc_where', 'Where'), tr('qc_where_sub', 'go to a bookmark'), go('where'), { more: true }));
            } else if (p === 'tp/who') {
                const L = (ctx.players && ctx.players()) || [];
                if (!L.length) col.appendChild(el('div', 'qc-empty', tr('qc_no_players', 'There are no other players here right now.')));
                L.forEach(function (pl) { col.appendChild(btn(pl.name, '', function () { path = []; ctx.tpPlayer(pl); }, { icon: head(pl.sk), cls: 'qc-pl' })); });
            } else if (p === 'tp/where') {
                const L = (ctx.marks && ctx.marks()) || [];
                if (!L.length) col.appendChild(el('div', 'qc-empty', tr('qc_no_marks', 'This world has no bookmarks yet (View > Bookmarks in the editor).')));
                const DN = { 1: '', 2: ' · ' + tr('dim_nether', 'Nether'), 3: ' · ' + tr('dim_end', 'End') };
                L.forEach(function (b) { col.appendChild(btn('⭐ ' + b.name, 'X ' + b.x + '  Y ' + b.y + (DN[b.dim] || ''), function () { path = []; ctx.tpMark(b); })); });
            } else if (p === 'gamemode') {
                [['survival', 'Survival'], ['creative', 'Creative'], ['adventure', 'Adventure'], ['spectator', 'Spectator']].forEach(function (g) { col.appendChild(btn(tr('qc_gm_' + g[0], g[1]), '', run('/gamemode ' + g[0]))); });
            } else if (p === 'weather') {
                [['clear', 'Clear'], ['rain', 'Rain'], ['thunder', 'Thunder']].forEach(function (g) { col.appendChild(btn(tr('qc_w_' + g[0], g[1]), '', run('/weather ' + g[0]))); });
            } else if (p === 'time') {
                [['day', 'Day'], ['night', 'Night']].forEach(function (g) { col.appendChild(btn(tr('qc_t_' + g[0], g[1]), '', run('/time set ' + g[0]))); });
            }
            box.appendChild(col);
            box.style.display = 'block';
        }
        return { reset: function () { path = []; render(); }, render: render, path: function () { return path.slice(); } };
    };

    // ------------------------------------------------------------------ ⭐ marcadores del mundo (los del editor, View > Bookmarks)
    function marks() { try { return (window.mbwBookmarks && window.mbwBookmarks.list()) || []; } catch (e) { return []; } }
    window.mbwChatMarks = marks;

    // ------------------------------------------------------------------ editor: el chat de abajo (#chat-container)
    const ed = { panel: null, open: false };
    const playing = () => !!(window.mbwPlay && window.mbwPlay.isPlaying && window.mbwPlay.isPlaying());
    function edTp(x, y, dim) {
        if (typeof mbwom === 'undefined' || !mbwom.world) return;
        if (dim && (mbwom.currentScene || 1) !== dim) {
            if (!mbwom.world['scene' + dim]) { say('Error', tr('ex_bm_dim_missing', 'That dimension is not generated in this world.')); return; }
            if (typeof changeDimension === 'function') changeDimension(dim);
        }
        mbwom.world.worldX = Number(x) + .5; mbwom.world.worldY = -Number(y);
        if (window.mbwBookmarks && window.mbwBookmarks.center) window.mbwBookmarks.center(Math.floor(x), Math.floor(y));
        if (typeof worldDirty !== 'undefined') { try { worldDirty = true; } catch (e) { /* nada */ } }
    }
    window.mbwEditorTp = edTp;
    function say(a, t) { if (typeof window.agregarMensajeChatPublico === 'function') window.agregarMensajeChatPublico(a, t); }
    const me = () => { try { return localStorage.getItem('mbw_username') || 'Player'; } catch (e) { return 'Player'; } };
    const edCtx = {
        run: function (c) { edDone(); say(me(), c); if (typeof window.processLocalCommand === 'function') window.processLocalCommand(c); },
        players: function () {
            const N = window.networkCursors || {}, now = Date.now();
            return Object.keys(N).map(function (k) { return N[k]; }).filter(function (p) { return p && p.name && now - (p.lastUpdate || 0) < 20000; })
                .map(function (p) { return { name: String(p.name), sk: p.sk || '', x: p.x, y: p.y, dim: p.scene || 1 }; });
        },
        tpPlayer: function (p) { edDone(); say(me(), '/tp @' + p.name); edTp(Math.floor(p.x), Math.floor(p.y), p.dim); say('System', tr('qc_tp_done', 'Teleported to {name}.').replace('{name}', p.name)); },
        marks: marks,
        tpMark: function (b) { edDone(); say(me(), '/tp ' + b.x + ' ' + b.y); edTp(b.x, b.y, b.dim); say('System', tr('qc_tp_done', 'Teleported to {name}.').replace('{name}', b.name)); }
    };
    function edParts() {
        const c = document.getElementById('chat-container'), inp = document.getElementById('chat-input');
        if (!c || !inp) return null;
        let q = document.getElementById('chat-quick');
        if (!q) {
            q = document.createElement('div'); q.id = 'chat-quick'; q.className = 'qc-box';
            c.insertBefore(q, inp);
            ed.panel = window.mbwQuickCmd(q, edCtx);
            // ✕ para cerrar (en el celular no hay Esc)
            const x = document.createElement('button'); x.type = 'button'; x.id = 'chat-close'; x.textContent = '✕';
            x.addEventListener('pointerdown', function (e) { e.preventDefault(); });
            x.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); edClose(); });
            c.appendChild(x);
            inp.addEventListener('input', function () { q.style.display = inp.value.trim() ? 'none' : 'block'; if (!inp.value.trim()) ed.panel.render(); });
            inp.addEventListener('focus', function () { setTimeout(kb, 300); });
        }
        return { c: c, inp: inp, q: q };
    }
    function edOpen(prefix) {
        const P = edParts(); if (!P) return;
        ed.open = true;
        document.body.classList.add('ed-chat-open');
        P.c.style.display = 'block'; P.inp.style.display = 'block';
        P.inp.value = prefix || '';
        P.q.style.display = P.inp.value.trim() ? 'none' : 'block';
        ed.panel.reset();
        const md = document.getElementById('chat-messages'); if (md) md.style.display = md.children.length ? '' : 'none';   // (sin mensajes: sin la caja negra vacía)
        try { clearTimeout(chatFadeTimeout); } catch (e) { /* nada */ }
        kb();
        // 📱 en el celular el teclado no sale solo (sale al tocar la caja)
        if (touch() && !prefix) { try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* nada */ } return; }
        setTimeout(function () { P.inp.focus(); }, 10);
    }
    function edClose() {
        const P = edParts(); if (!P) return;
        ed.open = false;
        document.body.classList.remove('ed-chat-open');
        P.inp.value = ''; P.inp.blur(); P.inp.style.display = 'none'; P.q.style.display = 'none';
        P.c.style.display = 'none';
    }
    // ya se mandó algo: se cierra la parte de escribir y los mensajes se quedan unos segundos (como al presionar Enter)
    function edDone() {
        const P = edParts(); if (!P) return;
        ed.open = false;
        document.body.classList.remove('ed-chat-open');
        P.inp.value = ''; P.inp.blur(); P.inp.style.display = 'none'; P.q.style.display = 'none';
        fade();
    }
    function fade() {
        try { clearTimeout(chatFadeTimeout); chatFadeTimeout = setTimeout(function () { if (!ed.open) { const c = document.getElementById('chat-container'); if (c) c.style.display = 'none'; } }, 6000); } catch (e) { /* nada */ }
    }
    // mientras el chat está abierto (aunque no se esté escribiendo, en el celular) un mensaje nuevo no lo cierra
    const wrapSay = function () {
        const f = window.agregarMensajeChatPublico;
        if (typeof f !== 'function' || f.__qc) return;
        const g = function () {
            const r = f.apply(this, arguments);
            const md = document.getElementById('chat-messages'); if (md) md.style.display = '';
            if (ed.open) { const P = edParts(); if (P) { P.c.style.display = 'block'; P.inp.style.display = 'block'; } try { clearTimeout(chatFadeTimeout); } catch (e) { /* nada */ } }
            return r;
        };
        g.__qc = true; window.agregarMensajeChatPublico = g;
    };
    window.mbwEditorChat = { open: edOpen, close: edClose, isOpen: function () { return ed.open; } };
    // T / Enter / Esc del editor (antes de los de multiplayer.js, que abrían el chat con el teclado del celular)
    document.addEventListener('keydown', function (e) {
        if (playing()) return;
        const inp = document.getElementById('chat-input'); if (!inp) return;
        if (e.target === inp) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); edClose(); }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); const t = inp.value.trim(); if (t && typeof window.enviarChatPublico === 'function') { ed.open = false; window.enviarChatPublico(); edDone(); } else edClose(); }
            return;
        }
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 't' || e.key === 'T' || e.key === 'Enter' || e.key === '/') {
            if (document.querySelector('.modal[style*="display: block"], .modal[style*="display:block"]')) return;
            e.preventDefault(); e.stopImmediatePropagation();
            edOpen(e.key === '/' ? '/' : '');
        }
    }, true);

    // el botón del editor (al lado de la hotbar)
    function edButton() {
        const hb = document.getElementById('float-hotbar'); if (!hb || document.getElementById('float-chat-btn')) return;
        const b = document.createElement('button');
        b.type = 'button'; b.id = 'float-chat-btn';
        b.title = tr('qc_open_chat', 'Chat / commands (T)');
        b.innerHTML = '<img src="' + CHAT_ICON + '" alt="">';
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (ed.open) edClose(); else edOpen(''); });
        hb.insertBefore(b, hb.firstChild);
    }
    function init() { edButton(); wrapSay(); kb(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    setTimeout(function () { edButton(); wrapSay(); }, 1500);
})();
