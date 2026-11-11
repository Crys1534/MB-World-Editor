// =====================================================================
// ⏸ MENÚ DE PAUSA DEL MODO JUGAR (como el del juego) + lista de jugadores con Tab
// =====================================================================
// Se abre con Esc o con el engranaje ⚙ de arriba a la derecha (casi transparente; al pasar el mouse se ve completo).
//   · Back to Game · Options · Save and Quit (guarda todo lo que pasó jugando; ver play-mode.js saveAndQuit)
//   · El ANFITRIÓN de una sala además tiene "Server": nombre del mundo y descripción (salen en la lista de servidores), cuántos
//     pueden entrar (máximo 6), quién puede entrar y si los invitados pueden usar comandos.
//   · A la derecha: los jugadores (los conectados y los que alguna vez entraron a jugar este mundo, con su última conexión).
//   · Options: salto automático, resolución (cuántos bloques se ven), partículas, animaciones, efectos de pantalla, transiciones,
//     volumen de la lluvia y de la música.
// Un jugador solo: el juego se detiene mientras el menú está abierto. En una partida no (los demás siguen), pero tu Player no se mueve.
// Tab: muestra / esconde la lista de jugadores con barras de conexión (ping).
// Todo el texto que viene de otras personas (nombres) entra como TEXTO (textContent).
(function () {
    'use strict';
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
    const MAX = 6;
    let root = null, page = 'main', tabEl = null, tabTimer = 0;
    const el = function (tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const M = function () { return window.mbwMpPlay || null; };
    const P = function () { return window.mbwPlay || null; };
    const inRoom = function () { try { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; } catch (e) { return false; } };
    const amHost = function () { try { return typeof isHost !== 'undefined' && !!isHost; } catch (e) { return false; } };
    const hostOfRoom = function () { return inRoom() && amHost(); };

    // ------------------------------------------------------------------ barras de conexión
    function bars(ping, online) {
        const b = el('span', 'pm-bars');
        const n = !online ? 0 : ping <= 100 ? 4 : ping <= 200 ? 3 : ping <= 400 ? 2 : 1;
        const col = n >= 3 ? '#4caf50' : n === 2 ? '#f0b429' : '#e74c3c';
        for (let i = 1; i <= 4; i++) { const s = el('i'); s.style.height = (3 + i * 3) + 'px'; s.style.background = i <= n ? col : 'rgba(255,255,255,.18)'; b.appendChild(s); }
        b.title = online ? (ping ? ping + ' ms' : tr('pm_ping_good', 'Good connection')) : tr('pm_offline', 'Offline');
        return b;
    }
    function ago(t) {
        if (!t) return '';
        try { if (typeof window.formatTimeAgo === 'function') return window.formatTimeAgo(t); } catch (e) { /* nada */ }
        const m = Math.round((Date.now() - t) / 60000);
        return m < 1 ? tr('pm_just_now', 'just now') : m < 60 ? m + ' min' : Math.round(m / 60) + ' h';
    }
    function playerRows(box, withLast) {
        box.textContent = '';
        const list = (M() && M().playerList) ? M().playerList() : [{ name: (localStorage.getItem('mbw_username') || 'Player'), online: true, me: true, host: true, ping: 0 }];
        const on = list.filter(function (p) { return p.online; }), off = list.filter(function (p) { return !p.online; }).sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
        const head = el('div', 'pm-pl-head', tr('pm_players', 'Players') + ' (' + on.length + '/' + (inRoom() ? Math.min(MAX, Number(window.multiplayerPlayerLimit) || MAX) : 1) + ')');
        box.appendChild(head);
        on.concat(withLast ? off : []).forEach(function (p) {
            const r = el('div', 'pm-pl-row' + (p.online ? '' : ' off'));
            const dot = el('span', 'pm-dot'); r.appendChild(dot);
            const nm = el('span', 'pm-pl-name', String(p.name || 'Player')); r.appendChild(nm);
            if (p.host) r.appendChild(el('span', 'pm-tag', '👑'));
            if (p.me) r.appendChild(el('span', 'pm-tag pm-me', tr('pm_you', 'you')));
            if (!p.online) r.appendChild(el('span', 'pm-last', ago(p.last)));
            r.appendChild(bars(p.ping || 0, p.online));
            box.appendChild(r);
        });
        if (withLast && !off.length && !inRoom()) box.appendChild(el('div', 'pm-pl-note', tr('pm_solo_note', 'Playing on your own. In a multiplayer room, everyone who plays this world shows up here.')));
    }

    // ------------------------------------------------------------------ el menú
    function build() {
        root = el('div', 'pm-overlay');
        root.id = 'play-menu';
        root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        // (Esc lo maneja play-mode.js; aquí solo si estás escribiendo en una caja del menú, donde el juego no escucha)
        root.addEventListener('keydown', function (e) { e.stopPropagation(); const t = e.target; if (e.key === 'Escape' && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) { e.preventDefault(); back(); } });
        root.addEventListener('keyup', function (e) { e.stopPropagation(); });
        document.body.appendChild(root);
    }
    function btn(label, cls, fn) { const b = el('button', 'pm-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); return b; }
    function show(p) {
        page = p;
        if (!root) build();
        root.textContent = '';
        const box = el('div', 'pm-box');
        const left = el('div', 'pm-left'), right = el('div', 'pm-right');
        box.appendChild(left); box.appendChild(right);
        root.appendChild(box);
        if (p === 'main') {
            left.appendChild(el('h2', 'pm-title', hostOfRoom() ? tr('pm_title_host', 'Game menu (host)') : tr('pm_title', 'Game menu')));
            left.appendChild(btn(tr('pm_back', 'Back to Game'), 'pm-primary', close));
            left.appendChild(btn(tr('pm_options', 'Options'), '', function () { show('options'); }));
            if (hostOfRoom()) left.appendChild(btn(tr('pm_server', 'Server settings'), '', function () { show('server'); }));
            const guest = M() && M().on && M().role === 'guest';
            left.appendChild(btn(guest ? tr('pm_quit_guest', 'Save and Quit (leave the game)') : tr('pm_quit', 'Save and Quit'), 'pm-quit', function () { closeNow(); if (P() && P().saveAndQuit) P().saveAndQuit(); }));
            left.appendChild(el('p', 'pm-hint', guest ? tr('pm_quit_guest_hint', 'Your Player (inventory and position) stays saved in this world for next time.') : tr('pm_quit_hint', 'Everything that happened while playing is saved. How the world was before playing stays in the version history (Play mode column).')));
        } else if (p === 'options') {
            left.appendChild(el('h2', 'pm-title', tr('pm_options', 'Options')));
            left.appendChild(optionsForm());
            left.appendChild(btn('← ' + tr('pm_done', 'Done'), 'pm-primary', function () { show('main'); }));
        } else if (p === 'server') {
            left.appendChild(el('h2', 'pm-title', tr('pm_server', 'Server settings')));
            left.appendChild(serverForm());
            left.appendChild(btn('← ' + tr('pm_done', 'Done'), 'pm-primary', function () { show('main'); }));
        }
        const pl = el('div', 'pm-players');
        right.appendChild(pl);
        playerRows(pl, true);
        clearInterval(tabTimer);
        tabTimer = setInterval(function () { if (root && root.style.display !== 'none') playerRows(pl, true); }, 2000);
        const first = left.querySelector('button'); if (first && !document.body.classList.contains('is-touch')) setTimeout(function () { try { first.focus(); } catch (e) { /* nada */ } }, 0);
    }
    function row(label, input, hint) {
        const r = el('label', 'pm-row');
        r.appendChild(el('span', 'pm-row-l', label));
        r.appendChild(input);
        if (hint) r.title = hint;
        return r;
    }
    function check(on, fn) { const c = el('input'); c.type = 'checkbox'; c.checked = !!on; c.addEventListener('change', function () { fn(c.checked); }); return c; }
    function select(opts, cur, fn) {
        const s = el('select', 'pm-sel');
        opts.forEach(function (o) { const op = el('option', null, o[1]); op.value = o[0]; if (String(o[0]) === String(cur)) op.selected = true; s.appendChild(op); });
        s.addEventListener('change', function () { fn(s.value); });
        return s;
    }
    function range(ch) {
        const r = el('input', 'pm-range'); r.type = 'range'; r.min = 0; r.max = 100;
        const a = window.audioSettings || {}; r.value = a[ch] == null ? (ch === 'music' ? 70 : 100) : a[ch];
        r.addEventListener('input', function () { if (typeof window.updateAudioChannel === 'function') window.updateAudioChannel(ch, r.value); });
        return r;
    }
    function optionsForm() {
        const f = el('div', 'pm-form');
        const o = (P() && P().opts) ? P().opts() : {};
        const set = function (k) { return function (v) { if (P() && P().setOpt) P().setOpt(k, v); }; };
        f.appendChild(row(tr('pm_autojump', 'Auto-jump (1 block)'), check(o.autoJump, set('autoJump')), tr('pm_autojump_tip', 'Walking into a 1-block step jumps by itself, like in Minecraft')));
        f.appendChild(row(tr('pm_res', 'Screen size (blocks you see)'), select([['default', tr('pm_res_default', 'Game (18 × 14)')], ['4:3', '4:3 (20 × 15)'], ['16:9', '16:9 (27 × 15)']], o.res || 'default', set('res'))));
        f.appendChild(row(tr('pm_particles', 'Particles'), select([['all', tr('pm_all', 'All')], ['some', tr('pm_some', 'Some')], ['none', tr('pm_none', 'None')]], o.particles || 'all', set('particles'))));
        f.appendChild(row(tr('pm_anims', 'Block animations'), check(o.anims !== false, set('anims'))));
        f.appendChild(row(tr('pm_effects', 'Screen effects (damage flash, lightning)'), check(o.effects !== false, set('effects'))));
        f.appendChild(row(tr('pm_transitions', 'Menu transitions'), check(o.transitions !== false, set('transitions'))));
        f.appendChild(row(tr('config_vol_weather', 'Rain and storm'), range('weather')));
        f.appendChild(row(tr('config_vol_music', 'Music'), range('music')));
        return f;
    }
    function serverForm() {
        const f = el('div', 'pm-form');
        const ref = window.myRoomRef || null;
        const nm = el('input', 'pm-in'); nm.type = 'text'; nm.maxLength = 40; nm.value = window.mpSelectedMapName || (document.getElementById('filename-display') || {}).value || '';
        nm.addEventListener('change', function () { const v = nm.value.trim().slice(0, 40); if (!v) return; window.mpSelectedMapName = v; if (ref) ref.update({ mapName: v }); });
        f.appendChild(row(tr('pm_world_name', 'World name (server list)'), nm));
        const ds = el('textarea', 'pm-in pm-desc'); ds.maxLength = 120; ds.rows = 2; ds.value = window.mpRoomDesc || '';
        ds.addEventListener('change', function () { const v = ds.value.trim().slice(0, 120); window.mpRoomDesc = v; if (ref) ref.update({ desc: v }); });
        f.appendChild(row(tr('pm_world_desc', 'Description (server list)'), ds));
        const cur = Math.max(2, Math.min(MAX, Number(window.multiplayerPlayerLimit) || 2));
        f.appendChild(row(tr('pm_max_players', 'Players at the same time (max 6)'), select([2, 3, 4, 5, 6].map(function (n) { return [n, String(n)]; }), cur, function (v) {
            const n = Math.max(2, Math.min(MAX, Number(v) || 2));
            let done = false;
            try { if (window.mbwServerWizard && window.mbwServerWizard.setPlayers) { window.mbwServerWizard.setPlayers(n); done = true; } } catch (e) { done = false; }
            if (!done) { window.multiplayerPlayerLimit = n; if (ref) ref.update({ maxPlayers: n }); }
        })));
        f.appendChild(row(tr('pm_access', 'Who can join'), select([['public', tr('pm_access_public', 'Everyone')], ['friends_only', tr('pm_access_friends', 'Friends only')], ['private', tr('pm_access_private', 'Only with an invitation')]], window.multiplayerAccess || 'public', function (v) {
            let done = false;
            try { if (window.mbwServerWizard && window.mbwServerWizard.setAccess) { window.mbwServerWizard.setAccess(v); done = true; } } catch (e) { done = false; }
            if (!done) { window.multiplayerAccess = v; if (ref) ref.update({ access: v }); }
        })));
        f.appendChild(row(tr('pm_guest_cmds', 'Guests can use commands'), check(M() && M().allowCmds ? M().allowCmds() : false, function (on) { if (M() && M().setAllowCmds) M().setAllowCmds(on); }), tr('pm_guest_cmds_tip', 'By default only the host can use commands (gamemode, tp, give...)')));
        return f;
    }
    function open() {
        if (!P() || !P().isPlaying()) return;
        if (P().setPaused) P().setPaused(true);
        show('main');
        root.style.display = 'flex';
        hideTab();
    }
    function closeNow() { if (root) root.style.display = 'none'; clearInterval(tabTimer); if (P() && P().setPaused) P().setPaused(false); }
    function close() { closeNow(); }
    function isOpen() { return !!(root && root.style.display !== 'none' && root.parentNode); }
    function back() { if (page !== 'main') show('main'); else close(); }

    // ------------------------------------------------------------------ Tab: lista de jugadores
    function showTab() {
        if (!tabEl) { tabEl = el('div', 'pm-tablist'); tabEl.id = 'play-tablist'; document.body.appendChild(tabEl); }
        playerRows(tabEl, false);
        tabEl.style.display = 'block';
        clearInterval(showTab.t); showTab.t = setInterval(function () { if (tabEl && tabEl.style.display !== 'none') playerRows(tabEl, false); }, 1000);
    }
    function hideTab() { if (tabEl) tabEl.style.display = 'none'; clearInterval(showTab.t); }
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || !P() || !P().isPlaying()) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        if (isOpen()) return;
        e.preventDefault(); e.stopPropagation();
        if (e.repeat) return;
        if (tabEl && tabEl.style.display === 'block') hideTab(); else showTab();
    }, true);
    // al salir del Modo Jugar, todo se esconde
    setInterval(function () { if (!(P() && P().isPlaying())) { if (isOpen()) closeNow(); hideTab(); } }, 500);

    window.mbwPlayMenu = { open: open, close: function (silent) { closeNow(); }, back: back, isOpen: isOpen, toggleTab: function () { if (tabEl && tabEl.style.display === 'block') hideTab(); else showTab(); }, showPage: show };
})();
