// ==========================================================
// 🖥️ CREAR UN SERVIDOR (menú Multiplayer → "Create Server")
//
//  Paso 1 · Elegir el mundo: primero los mundos ABIERTOS ahora (pestañas de arriba) y después los guardados en "My Worlds".
//           Un mundo que ya está abierto sale una sola vez (arriba): si lo eliges se usa esa pestaña, no se abre una copia.
//  Paso 2 · Vista previa del mundo a la izquierda y, a la derecha: cantidad de jugadores, Access (Público / Amigos / Privado)
//           y el botón para iniciar. Ya iniciado, ahí mismo sale la lista de jugadores en línea para INVITARLOS.
//  Ya no hay códigos de sala: se entra por la lista de servidores públicos, con una invitación (🔔) o pidiendo entrar
//  (botón "Join" junto al nombre de alguien en la lista Online, scripts/join-requests.js). Por dentro la sala sigue teniendo
//  su ID (PeerJS lo necesita), pero nadie tiene que copiarlo ni escribirlo.
// ==========================================================
(function () {
    'use strict';
    const MAX_MB = 25;                             // un mundo más pesado tarda demasiado en llegarle a los demás
    const SW = window.mbwServerWizard = { sel: null, list: [], timer: null, starting: false };

    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function hosting() { return typeof isHost !== 'undefined' && isHost && !!window.currentRoomId; }
    function starting() { return typeof isHost !== 'undefined' && isHost && !window.currentRoomId; }
    function tabs() { return (typeof WorldTabsManager !== 'undefined' && Array.isArray(WorldTabsManager.openWorlds)) ? WorldTabsManager : null; }
    function nameOfTab(t) { return String(t.filename || 'world').replace(/\.mbw$/i, ''); }
    function fmtBytes(b) { return typeof window.formatBytes === 'function' ? window.formatBytes(b) : (b / 1048576).toFixed(2) + ' MB'; }
    const DEFAULT_THUMB = 'assets/Superflat World.png';

    // ------------------------------------------------------------------ paso 1: la lista de mundos
    SW.openCreate = function () {
        if (hosting() || starting()) { setMpView('create-setup'); return; }   // ya hay una sala: se muestra (no se crea otra)
        setMpView('create-world');
    };
    async function loadList() {
        const T = tabs();
        const open = T ? T.openWorlds.map(t => ({ kind: 'open', id: t.id, name: nameOfTab(t), active: t.id === T.activeWorldId })) : [];
        let saved = [];
        try { saved = (typeof localDB !== 'undefined') ? (localDB.getWorldsLight ? await localDB.getWorldsLight() : await localDB.getWorlds()) : []; } catch (e) { saved = []; }
        const byName = new Map(saved.map(w => [w.name, w]));
        open.forEach(o => { const w = byName.get(o.name); if (w) { o.thumb = w.thumb || ''; o.date = w.date; o.size = w.size; } });
        const openNames = new Set(open.map(o => o.name));
        const rest = saved.filter(w => !openNames.has(w.name))                     // (el que ya está abierto no se repite)
            .sort((a, b) => (b.date || 0) - (a.date || 0))
            .map(w => ({ kind: 'saved', name: w.name, thumb: w.thumb || '', date: w.date, size: w.size }));
        open.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));               // el que estás viendo, primero
        return open.concat(rest);
    }
    function card(it, i) {
        const thumb = it.thumb || DEFAULT_THUMB;
        const badge = it.kind === 'open'
            ? '<span class="sw-badge sw-badge-open">' + esc(it.active ? tr('sw_badge_active', 'You are here') : tr('sw_badge_open', 'Open')) + '</span>' : '';
        const meta = it.kind === 'open'
            ? esc(tr('sw_meta_open', 'Open in a tab'))
            : esc(it.date ? tr('sw_saved_on', 'Saved {date}', { date: new Date(it.date).toLocaleDateString() }) : tr('sw_saved', 'Saved worlds'));
        return '<button type="button" class="sw-card' + (it.kind === 'open' ? ' sw-card-open' : '') + '" data-i="' + i + '">' +
            '<span class="sw-card-img" style="background-image:url(&quot;' + esc(thumb).replace(/\(/g, '%28').replace(/\)/g, '%29') + '&quot;)"></span>' +
            '<span class="sw-card-text"><b class="sw-card-name">' + esc(it.name) + '</b><small>' + meta + '</small></span>' + badge + '</button>';
    }
    async function renderWorlds() {
        const box = $('sw-world-list'); if (!box) return;
        box.innerHTML = '<p class="sw-empty">' + esc(tr('sw_loading', 'Loading worlds...')) + '</p>';
        const list = SW.list = await loadList();
        const open = list.filter(x => x.kind === 'open'), saved = list.filter(x => x.kind === 'saved');
        let html = '';
        if (open.length) html += '<div class="sw-section">' + esc(tr('sw_open_now', 'Open now')) + '</div><div class="sw-grid">' + open.map(it => card(it, list.indexOf(it))).join('') + '</div>';
        html += '<div class="sw-section">' + esc(tr('sw_saved', 'Saved worlds')) + '</div>';
        html += saved.length ? '<div class="sw-grid">' + saved.map(it => card(it, list.indexOf(it))).join('') + '</div>'
            : '<p class="sw-empty">' + esc(open.length ? tr('sw_none_saved', 'You have no other saved worlds.') : tr('sw_none_at_all', 'You have no worlds yet: open or create one first.')) + '</p>';
        box.innerHTML = html;
        box.querySelectorAll('.sw-card').forEach(b => { b.onclick = () => SW.pick(SW.list[Number(b.dataset.i)]); });
    }

    // ------------------------------------------------------------------ paso 2: vista previa + opciones
    SW.pick = function (it) {
        if (!it) return;
        SW.sel = it;
        setMpView('create-setup');
    };
    function drawPreview() {
        const box = $('sw-preview'); if (!box) return;
        box.innerHTML = '';
        const it = SW.sel;
        const T = tabs();
        const isActive = it ? (it.kind === 'open' && T && T.activeWorldId === it.id) : true;
        const main = $('canvas');
        if (isActive && main && main.width) {
            // el mundo abierto: lo que se ve ahora en el editor
            const c = document.createElement('canvas');
            c.width = 480; c.height = Math.round(480 * main.height / main.width) || 270;
            const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
            try { g.drawImage(main, 0, 0, c.width, c.height); } catch (e) { /* sin dibujo */ }
            c.className = 'sw-preview-canvas';
            box.appendChild(c);
        } else {
            const d = document.createElement('div');
            d.className = 'sw-preview-img';
            d.style.backgroundImage = 'url("' + String((it && it.thumb) || DEFAULT_THUMB).replace(/"/g, '%22') + '")';
            box.appendChild(d);
        }
    }
    const ACCESS = ['public', 'friends_only', 'private'];
    function accessText(a) {
        return a === 'private' ? tr('sw_acc_private', 'Private') : a === 'friends_only' ? tr('sw_acc_friends', 'Friends') : tr('sw_acc_public', 'Public');
    }
    function accessDesc(a) {
        return a === 'private' ? tr('sw_acc_private_d', 'Hidden from the list: only the people you invite or let in.')
            : a === 'friends_only' ? tr('sw_acc_friends_d', 'Only your friends see it in the list.')
                : tr('sw_acc_public_d', 'Anyone can see it in Public Servers and join.');
    }
    function optionsHTML() {
        const lim = Math.max(2, Number(window.multiplayerPlayerLimit) || 2);
        const acc = ACCESS.indexOf(window.multiplayerAccess) >= 0 ? window.multiplayerAccess : 'public';
        let h = '<div class="sw-label">' + esc(tr('sw_players', 'Players')) + '</div><div class="sw-seg sw-players">';
        for (let n = 2; n <= 6; n++) h += '<button type="button" class="sw-seg-btn' + (n === lim ? ' on' : '') + '" data-n="' + n + '">' + n + '</button>';
        h += '</div><div class="sw-label">' + esc(tr('sw_access', 'Access')) + '</div><div class="sw-seg sw-access">';
        ACCESS.forEach(a => { h += '<button type="button" class="sw-seg-btn' + (a === acc ? ' on' : '') + '" data-a="' + a + '">' + esc(accessText(a)) + '</button>'; });
        h += '</div><p class="sw-desc">' + esc(accessDesc(acc)) + '</p>';
        return h;
    }
    function renderRight() {
        const R = $('sw-right'); if (!R) return;
        const live = hosting() || starting();
        let h = '';
        if (!live) {
            h += optionsHTML();
            h += '<div class="sw-label">' + esc(tr('sw_invites', 'Invitations')) + '</div>';
            h += '<p class="sw-info">' + esc(tr('sw_invites_info', 'No codes needed: when the server starts you can invite players from here, and anyone can ask to join from the Online list.')) + '</p>';
            h += '<button type="button" id="sw-start" class="sw-btn sw-btn-green sw-btn-big"' + (SW.starting || !SW.sel ? ' disabled' : '') + '>' + esc(SW.starting ? tr('sw_starting', 'Starting...') : tr('sw_start', 'Start server')) + '</button>';
            h += '<button type="button" class="sw-btn sw-btn-gray" id="sw-back-list">⬅ ' + esc(tr('sw_back', 'Back')) + '</button>';
        } else {
            const n = (window.roomPlayers || []).length || 1, max = Number(window.multiplayerPlayerLimit) || 2;
            h += '<div class="sw-live-head"><span class="sw-dot' + (hosting() ? '' : ' sw-dot-wait') + '"></span>' + esc(hosting() ? tr('sw_running', 'Server running') : tr('sw_starting', 'Starting...')) + '</div>';
            h += '<div class="sw-live-stats" id="sw-live-stats">' + esc(tr('sw_players_now', 'Players: {n}/{max}', { n: n, max: max })) + '</div>';
            h += optionsHTML();
            h += '<div class="sw-label">' + esc(tr('sw_in_server', 'Players in your world')) + '</div>';
            h += '<div id="sw-perm-list" class="sw-invite-list sw-perm-list">' + permRows() + '</div>';
            h += '<p class="sw-info">' + esc(tr('sw_perm_hint', 'New players can only watch. Choose Edit to let someone change the world.')) + '</p>';
            h += '<div class="sw-label">' + esc(tr('sw_invite_players', 'Invite players')) + '</div>';
            h += '<div id="sw-invite-list" class="sw-invite-list">' + inviteRows() + '</div>';
            h += '<p class="sw-info">' + esc(tr('sw_ask_hint', 'Players can also press Join next to your name in the Online list to ask to come in.')) + '</p>';
            h += '<div class="sw-row"><button type="button" class="sw-btn sw-btn-red" id="sw-close">' + esc(tr('sw_close', 'Close server')) + '</button>' +
                '<button type="button" class="sw-btn sw-btn-gray" id="sw-to-servers">' + esc(tr('sw_to_servers', 'Public servers')) + '</button></div>';
        }
        R.innerHTML = h;
        R.querySelectorAll('.sw-players .sw-seg-btn').forEach(b => { b.onclick = () => SW.setPlayers(Number(b.dataset.n)); });
        R.querySelectorAll('.sw-access .sw-seg-btn').forEach(b => { b.onclick = () => SW.setAccess(b.dataset.a); });
        const st = $('sw-start'); if (st) st.onclick = () => SW.start();
        const bl = $('sw-back-list'); if (bl) bl.onclick = () => SW.openCreate();
        const cl = $('sw-close'); if (cl) cl.onclick = () => SW.close();
        const ts = $('sw-to-servers'); if (ts) ts.onclick = () => setMpView('join');
        R.querySelectorAll('.sw-inv-btn').forEach(b => { b.onclick = (e) => SW.invite(b.dataset.uid, b.dataset.name, e); });
        R.querySelectorAll('.sw-perm-seg .sw-seg-btn').forEach(b => {
            b.onclick = () => { if (typeof window.mpSetCanEdit === 'function') window.mpSetCanEdit(b.dataset.uid, b.dataset.can === '1'); renderRight(); };
        });
        const ch = $('sw-change'); if (ch) ch.style.display = live ? 'none' : '';
    }
    function renderLeft() {
        drawPreview();
        const it = SW.sel;
        const nm = it ? it.name : (($('filename-display') || {}).value || 'world');
        $('sw-world-name').textContent = nm;
        let meta = '';
        if (it && it.kind === 'open') meta = it.active ? tr('sw_badge_active', 'You are here') : tr('sw_meta_open', 'Open in a tab');
        else if (it && it.date) meta = tr('sw_saved_on', 'Saved {date}', { date: new Date(it.date).toLocaleDateString() });
        if (it && it.size) meta += (meta ? ' · ' : '') + fmtBytes(it.size);
        $('sw-world-meta').textContent = meta;
    }
    function renderSetup() { renderLeft(); renderRight(); }

    SW.setPlayers = function (n) {
        n = Math.max(2, Math.min(6, Number(n) || 2));
        if (typeof window.setMpLimit === 'function') window.setMpLimit(n); else window.multiplayerPlayerLimit = n;
        window.multiplayerPlayerLimit = n;
        if (hosting() && window.myRoomRef) window.myRoomRef.update({ maxPlayers: n });
        renderRight();
    };
    SW.setAccess = function (a) {
        if (ACCESS.indexOf(a) < 0) return;
        window.multiplayerAccess = a;
        if (hosting() && window.myRoomRef) window.myRoomRef.update({ access: a });
        renderRight();
    };

    // ------------------------------------------------------------------ los que ya están: ¿solo ven o pueden editar?
    function permRows() {
        const me = localStorage.getItem('mbw_uid');
        const list = (window.roomPlayers || []).filter(p => p && p.uid && p.uid !== me);
        if (!list.length) return '<p class="sw-empty">' + esc(tr('sw_no_players_yet', 'Nobody has joined yet.')) + '</p>';
        return list.map(p => {
            const pfp = (window.isRealPfp && window.isRealPfp(p.pfp)) ? p.pfp : 'assets/default pfp.png';
            const can = !!p.canEdit;
            return '<div class="sw-inv-row"><span class="sw-inv-av" style="background-image:url(&quot;' + esc(pfp) + '&quot;)"></span>' +
                '<span class="sw-inv-name">' + esc(p.name || 'Player') + '</span>' +
                '<span class="sw-seg sw-perm-seg">' +
                '<button type="button" class="sw-seg-btn' + (can ? '' : ' on') + '" data-uid="' + esc(p.uid) + '" data-can="0">👁 ' + esc(tr('sw_perm_view', 'View')) + '</button>' +
                '<button type="button" class="sw-seg-btn' + (can ? ' on' : '') + '" data-uid="' + esc(p.uid) + '" data-can="1">✏️ ' + esc(tr('sw_perm_edit', 'Edit')) + '</button>' +
                '</span></div>';
        }).join('');
    }

    // ------------------------------------------------------------------ a quién invitar (ya iniciado)
    function inviteRows() {
        const users = window.lastKnownUsers || {};
        const me = localStorage.getItem('mbw_uid');
        const friends = (typeof misAmigosConfirmados !== 'undefined' && Array.isArray(misAmigosConfirmados)) ? misAmigosConfirmados : [];
        const inRoom = new Set((window.roomPlayers || []).map(p => p.uid));
        const list = Object.keys(users).map(k => users[k]).filter(u => u && u.uid && u.uid !== me && !(window.isBlocked && window.isBlocked(u.uid)));
        list.sort((a, b) => (friends.includes(b.uid) ? 1 : 0) - (friends.includes(a.uid) ? 1 : 0) || String(a.username || '').localeCompare(String(b.username || '')));
        if (!list.length) return '<p class="sw-empty">' + esc(tr('sw_nobody', 'Nobody else is online right now.')) + '</p>';
        const now = Date.now();
        return list.map(u => {
            const pfp = (window.isRealPfp && window.isRealPfp(u.pfp)) ? u.pfp : 'assets/default pfp.png';
            let btn;
            if (inRoom.has(u.uid)) btn = '<span class="sw-inv-state">' + esc(tr('sw_in_world', 'In your world')) + '</span>';
            else if (window.inviteCooldowns && window.inviteCooldowns[u.uid] && now < window.inviteCooldowns[u.uid]) btn = '<span class="sw-inv-state sw-inv-sent">✓ ' + esc(tr('sw_invited', 'Invited')) + '</span>';
            else btn = '<button type="button" class="sw-inv-btn" data-uid="' + esc(u.uid) + '" data-name="' + esc(u.username || 'Player') + '"' + (hosting() ? '' : ' disabled') + '>' + esc(tr('sw_invite', 'Invite')) + '</button>';
            return '<div class="sw-inv-row"><span class="sw-inv-av" style="background-image:url(&quot;' + esc(pfp) + '&quot;)"></span>' +
                '<span class="sw-inv-name">' + esc(u.username || 'Player') + (friends.includes(u.uid) ? ' <small class="sw-friend">' + esc(tr('sw_friend', 'Friend')) + '</small>' : '') + '</span>' + btn + '</div>';
        }).join('');
    }
    SW.invite = function (uid, name, e) {
        if (!hosting() || typeof window.sendServerInvite !== 'function') return;
        window.sendServerInvite(uid, name, e);
        renderRight();
        setTimeout(() => { if (isVisible()) renderRight(); }, 15100);
    };

    // ------------------------------------------------------------------ iniciar / cerrar
    function waitLoaded(ms) {
        return new Promise(resolve => {
            const t0 = Date.now();
            (function check() {
                const o = $('loading-overlay');
                const busy = o && getComputedStyle(o).display !== 'none';
                if (!busy && typeof mbwom !== 'undefined' && mbwom.world) { resolve(true); return; }
                if (Date.now() - t0 > (ms || 120000)) { resolve(false); return; }
                setTimeout(check, 120);
            })();
        });
    }
    // miniatura chiquita para la lista de servidores (no se sube la captura entera a Firebase)
    function smallThumb(src) {
        return new Promise(resolve => {
            const make = (img) => {
                try {
                    const c = document.createElement('canvas'); c.width = 160; c.height = 90;
                    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
                    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
                    if (!w || !h) { resolve(null); return; }
                    const s = Math.max(160 / w, 90 / h);
                    g.drawImage(img, (160 - w * s) / 2, (90 - h * s) / 2, w * s, h * s);
                    resolve(c.toDataURL('image/jpeg', 0.7));
                } catch (e) { resolve(null); }   // (una imagen "sin permiso" no se puede convertir)
            };
            if (src && src.tagName === 'CANVAS') { make(src); return; }
            if (!src) { resolve(null); return; }
            const im = new Image();
            im.onload = () => make(im); im.onerror = () => resolve(null);
            im.src = src;
        });
    }
    SW.start = async function () {
        const it = SW.sel;
        if (!it || SW.starting || hosting()) return false;
        SW.starting = true; renderRight();
        try {
            const T = tabs();
            if (it.kind === 'open') {
                if (T && T.activeWorldId !== it.id && T.openWorlds.some(t => t.id === it.id)) T.switchWorld(it.id);   // esa pestaña (sin abrir otra copia)
            } else {
                const data = await localDB.loadWorld(it.name);
                if (!data) { alert(tr('msg_read_error', 'Error while reading the file.')); return false; }
                const mb = new Blob([data]).size / 1048576;
                if (mb > MAX_MB) { alert(tr('sw_too_heavy', 'This world is too heavy to share ({mb} MB; the limit is {max} MB).', { mb: mb.toFixed(1), max: MAX_MB })); return false; }
                await loadSavedLocalWorld(it.name);
                await waitLoaded();
                const T2 = tabs();
                if (T2) SW.sel = { kind: 'open', id: T2.activeWorldId, name: it.name, active: true, thumb: it.thumb, date: it.date, size: it.size };
            }
            if (typeof window.openFileMenu === 'function' && $('backstage-menu') && $('backstage-menu').style.display !== 'flex') window.openFileMenu('multiplayer');
            window.mpSelectedMapName = it.name;
            window.mpSelectedMapData = null;
            window.mpSelectedMapThumb = await smallThumb(it.kind === 'open' && it.active ? $('canvas') : (it.thumb || null));
            if (!(Number(window.multiplayerPlayerLimit) >= 2)) window.multiplayerPlayerLimit = 2;
            if (ACCESS.indexOf(window.multiplayerAccess) < 0) window.multiplayerAccess = 'public';
            window.hostMultiplayerSession();
            setMpView('create-setup');
            return true;
        } finally {
            SW.starting = false;
            if (isVisible()) renderSetup();
        }
    };
    SW.close = function () {
        setMpView('home');          // (cierra la sala: misma limpieza de siempre)
        SW.sel = null;
        setMpView('join');
    };

    // ------------------------------------------------------------------ enganches
    function isVisible() { const v = $('mp-view-create-setup'); return !!v && v.style.display !== 'none'; }
    function refreshMain() {
        const b = $('mp-create-btn'); if (!b) return;
        const live = hosting() || starting();
        const span = b.querySelector('span');
        if (span) { span.setAttribute('data-i18n', live ? 'sw_manage' : 'mp_create_server'); span.textContent = live ? tr('sw_manage', 'My server') : tr('mp_create_server', 'Create Server'); }
        b.classList.toggle('sw-live', live);
    }
    SW.onView = function (v) {
        clearInterval(SW.timer); SW.timer = null;
        if (v === 'create-world') { SW.sel = null; renderWorlds(); }
        if (v === 'create-setup') {
            if (!SW.sel && !hosting() && !starting()) { setMpView('create-world'); return; }
            renderSetup();
            // mientras se ve: la cuenta de jugadores y la lista de invitar se mantienen al día
            let last = '';
            SW.timer = setInterval(() => {
                if (!isVisible()) { clearInterval(SW.timer); SW.timer = null; return; }
                const key = [hosting(), starting(), (window.roomPlayers || []).map(p => p.uid + (p.canEdit ? '+' : '-')).join(','), window.multiplayerPlayerLimit, window.multiplayerAccess, Object.keys(window.lastKnownUsers || {}).join(',')].join('|');
                if (key !== last) { last = key; renderRight(); }
            }, 700);
        }
        if (v === 'join') refreshMain();
    };
    // al entrar a la pestaña Multiplayer con una sala abierta, se ve la sala
    const origSwitch = window.switchBackstageTab;
    if (typeof origSwitch === 'function') {
        window.switchBackstageTab = function (tab) {
            const r = origSwitch.apply(this, arguments);
            if (tab === 'multiplayer') { refreshMain(); }
            return r;
        };
    }
    window.serverWizardOnLanguageChanged = function () { if (isVisible()) renderSetup(); else { const v = $('mp-view-create-world'); if (v && v.style.display !== 'none') renderWorlds(); } refreshMain(); };
    setInterval(refreshMain, 2000);
})();
