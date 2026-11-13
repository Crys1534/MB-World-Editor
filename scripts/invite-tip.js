// ==========================================================
// ＋ INVITAR A EDITAR + 💡 RECOMENDACIÓN (una sola vez)
//
//  · Junto a las caras de los que están en tu mapa (arriba a la derecha; clic en una = espectear) hay un botón ＋.
//    Abre la lista de TODOS los jugadores que alguna vez abrieron el editor (los conectados primero) para invitarlos
//    a editar tu mapa. Si todavía no tienes sala, se crea una privada para editar juntos (no es un servidor:
//    el mapa se sigue editando). A quien no está conectado le llega la invitación cuando vuelva a abrir el editor.
//  · La primera vez que se abre un mundo en el editor, se oscurece todo y solo se ilumina esa zona, con el consejo
//    "¡Invita a otras personas para ayudar a editar tu mapa!". Sale una sola vez (mbw_invite_tip_seen).
// ==========================================================
(function () {
    'use strict';
    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
    function db() { return typeof database !== 'undefined' && database ? database : null; }
    function myUid() { return localStorage.getItem('mbw_uid'); }
    function inMp() { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; }
    function amHost() { return typeof isHost !== 'undefined' && !!isHost; }
    const TIP_KEY = 'mbw_invite_tip_seen';

    // ---------------------------------------------------------- el botón ＋
    function ensureButton() {
        if ($('mp-invite-plus')) return $('mp-invite-plus');
        const live = $('mp-live-players'); if (!live || !live.parentNode) return null;
        const wrap = document.createElement('div'); wrap.id = 'mp-live-zone'; wrap.className = 'mp-live-zone';
        live.parentNode.insertBefore(wrap, live);
        wrap.appendChild(live);
        const b = document.createElement('button');
        b.type = 'button'; b.id = 'mp-invite-plus'; b.className = 'mp-invite-plus'; b.textContent = '+';
        b.title = tr('it_plus_tip', 'Invite someone to help edit your map');
        b.addEventListener('click', function (e) { e.stopPropagation(); togglePicker(); });
        wrap.appendChild(b);
        return b;
    }

    // ---------------------------------------------------------- la lista de jugadores (todos los que alguna vez abrieron el editor)
    let people = null, loading = null;
    function loadPeople() {
        if (people) return Promise.resolve(people);
        if (loading) return loading;
        const D = db(); if (!D) return Promise.resolve([]);
        loading = D.ref('visitas_editor').once('value').then(function (snap) {
            const v = snap.val() || {}, by = {};
            Object.keys(v).forEach(function (k) {
                const r = v[k]; if (!r || typeof r !== 'object' || !r.uid) return;
                const uid = String(r.uid); if (!/^[\w-]{4,40}$/.test(uid) || /^zztest/.test(uid)) return;
                const name = String(r.nombre || '').trim(); const t = Number(r.fecha) || 0;
                const cur = by[uid] || (by[uid] = { uid: uid, name: '', t: 0 });
                if (t >= cur.t) { cur.t = t; if (name) cur.name = name; } else if (!cur.name && name) cur.name = name;
            });
            people = Object.keys(by).map(k => by[k]).filter(p => p.name && p.uid !== myUid());
            return people;
        }).catch(function () { people = []; return people; }).finally(function () { loading = null; });
        return loading;
    }
    function onlineMap() { return window.lastKnownUsers || {}; }
    let picker = null;
    function closePicker() { if (picker) { picker.remove(); picker = null; } }
    function togglePicker() {
        if (picker) { closePicker(); return; }
        if (window.mbwServerMap && window.mbwServerMap.isMap && window.mbwServerMap.isMap()) { alert(tr('it_server_map', 'This is a server map: it cannot be edited, so you cannot invite people to edit it.')); return; }
        if (inMp() && !amHost()) { alert(tr('it_not_host', 'You are in someone else\'s room: only the host can invite.')); return; }
        const b = ensureButton(); if (!b) return;
        picker = document.createElement('div'); picker.id = 'it-picker'; picker.className = 'it-picker';
        picker.innerHTML = '<div class="it-head">' + esc(tr('it_title', 'Invite to edit your map')) + '</div>' +
            '<input type="text" class="it-search" placeholder="' + esc(tr('it_search', 'Search a player…')) + '">' +
            '<div class="it-list"><p class="it-empty">' + esc(tr('it_loading', 'Loading players…')) + '</p></div>' +
            '<p class="it-note">' + esc(tr('it_note', 'If they are not online, they will get the invitation when they open the editor.')) + '</p>';
        ['pointerdown', 'mousedown', 'keydown', 'wheel'].forEach(n => picker.addEventListener(n, e => e.stopPropagation()));
        document.body.appendChild(picker);
        const r = b.getBoundingClientRect();
        picker.style.top = Math.round(r.bottom + 8) + 'px';
        picker.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - picker.offsetWidth - 8, r.right - picker.offsetWidth))) + 'px';
        const input = picker.querySelector('.it-search');
        input.addEventListener('input', paint);
        loadPeople().then(paint);
        setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    }
    function outside(e) { if (picker && !picker.contains(e.target) && e.target.id !== 'mp-invite-plus') { closePicker(); document.removeEventListener('pointerdown', outside, true); } }
    function paint() {
        if (!picker) return;
        const list = picker.querySelector('.it-list'), q = String(picker.querySelector('.it-search').value || '').toLowerCase().trim();
        const on = onlineMap(), inRoom = new Set((window.roomPlayers || []).map(p => p.uid));
        const all = (people || []).slice();
        Object.keys(on).forEach(k => { const u = on[k]; if (u && u.uid && u.uid !== myUid() && !all.some(p => p.uid === u.uid)) all.push({ uid: u.uid, name: u.username || 'Player', t: Date.now() }); });
        all.forEach(p => { const u = Object.keys(on).map(k => on[k]).find(x => x && x.uid === p.uid); p.online = !!u; if (u && u.username) p.name = u.username; p.pfp = u && u.pfp; });
        const rows = all.filter(p => !(window.isBlocked && window.isBlocked(p.uid)) && (!q || p.name.toLowerCase().includes(q)))
            .sort((a, b) => (b.online - a.online) || (b.t - a.t)).slice(0, 200);
        if (!rows.length) { list.innerHTML = '<p class="it-empty">' + esc(people ? tr('it_none', 'No players found.') : tr('it_loading', 'Loading players…')) + '</p>'; return; }
        const now = Date.now();
        list.innerHTML = rows.map(p => {
            const pfp = (window.isRealPfp && window.isRealPfp(p.pfp)) ? p.pfp : 'assets/default pfp.png';
            let btn;
            if (inRoom.has(p.uid)) btn = '<span class="it-state">' + esc(tr('sw_in_world', 'In your world')) + '</span>';
            else if (window.inviteCooldowns && window.inviteCooldowns[p.uid] && now < window.inviteCooldowns[p.uid]) btn = '<span class="it-state it-sent">✓ ' + esc(tr('sw_invited', 'Invited')) + '</span>';
            else btn = '<button type="button" class="it-inv" data-uid="' + esc(p.uid) + '">' + esc(tr('sw_invite', 'Invite')) + '</button>';
            return '<div class="it-row"><span class="it-av" style="background-image:url(&quot;' + esc(pfp) + '&quot;)"></span><span class="it-name">' + esc(p.name) +
                (p.online ? ' <i class="it-dot" title="' + esc(tr('it_online', 'Online')) + '"></i>' : '') + '</span>' + btn + '</div>';
        }).join('');
        list.querySelectorAll('.it-inv').forEach(b => b.addEventListener('click', () => invite(b.dataset.uid, (rows.find(p => p.uid === b.dataset.uid) || {}).name || 'Player')));
    }
    function invite(uid, name) {
        const go = function () { if (typeof window.sendServerInvite === 'function') window.sendServerInvite(uid, name); paint(); setTimeout(paint, 15100); };
        if (amHost() && window.currentRoomId) { go(); return; }
        if (typeof window.mbwEnsureEditRoom !== 'function') return;
        window.mbwEnsureEditRoom().then(go).catch(() => alert(tr('it_room_fail', 'Could not open your room to invite people. Try again.')));
    }

    // ---------------------------------------------------------- 💡 la recomendación (una sola vez)
    function seen() { try { return localStorage.getItem(TIP_KEY) === '1'; } catch (e) { return true; } }
    function markSeen() { try { localStorage.setItem(TIP_KEY, '1'); } catch (e) { /* nada */ } }
    function visible(el) { return !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'; }
    function editorIdle() {
        if (typeof mbwom === 'undefined' || !mbwom.world || window.mbwPlaying) return false;
        if (inMp() && !amHost()) return false;                              // (en la sala de otra persona no)
        const lo = $('loading-overlay'), bs = $('boot-splash'), fmn = $('backstage-menu');
        if (lo && getComputedStyle(lo).display !== 'none') return false;
        if (bs && getComputedStyle(bs).display !== 'none') return false;
        if (fmn && getComputedStyle(fmn).display !== 'none') return false;
        if (document.querySelector('.modal[style*="display: block"], .modal[style*="display: flex"]')) return false;
        if (window.mbwServerMap && window.mbwServerMap.isMap && window.mbwServerMap.isMap()) return false;
        return true;
    }
    function showTip() {
        const b = ensureButton(); if (!b || !visible(b)) return false;
        markSeen();
        const zone = $('mp-live-zone') || b;
        const r = zone.getBoundingClientRect(), pad = 10;
        const side = Math.max(r.width, r.height) + pad * 2;                // (un cuadrado alrededor de la zona)
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ov = document.createElement('div'); ov.id = 'it-spot'; ov.className = 'it-spot';
        const hole = document.createElement('div'); hole.className = 'it-hole';
        hole.style.left = Math.round(cx - side / 2) + 'px'; hole.style.top = Math.round(cy - side / 2) + 'px';
        hole.style.width = Math.round(side) + 'px'; hole.style.height = Math.round(side) + 'px';
        const tip = document.createElement('div'); tip.className = 'it-bubble';
        tip.innerHTML = '<b>💡 ' + esc(tr('it_tip_title', 'Invite other people to help edit your map!')) + '</b>' +
            '<p>' + esc(tr('it_tip_body', 'The people who join your map show up here (click one to see what they are doing). Press + to invite a player.')) + '</p>' +
            '<div class="it-bub-btns"><button type="button" class="it-bub-inv">＋ ' + esc(tr('it_tip_invite', 'Invite someone')) + '</button><button type="button" class="it-bub-ok">' + esc(tr('it_tip_ok', 'Got it')) + '</button></div>';
        ov.appendChild(hole); ov.appendChild(tip);
        document.body.appendChild(ov);
        const tw = Math.min(320, window.innerWidth - 24);
        tip.style.width = tw + 'px';
        tip.style.top = Math.round(cy + side / 2 + 12) + 'px';
        tip.style.left = Math.round(Math.max(12, Math.min(window.innerWidth - tw - 12, cx - tw / 2))) + 'px';
        const close = () => ov.remove();
        tip.querySelector('.it-bub-ok').addEventListener('click', close);
        tip.querySelector('.it-bub-inv').addEventListener('click', () => { close(); togglePicker(); });
        hole.addEventListener('click', () => { close(); togglePicker(); });
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        return true;
    }
    let idleSince = 0;
    function tick() {
        ensureButton();
        if (seen() || $('it-spot')) return;
        if (!editorIdle()) { idleSince = 0; return; }
        if (!idleSince) idleSince = Date.now();
        if (Date.now() - idleSince > 1500) showTip();
    }
    setInterval(tick, 700);

    window.mbwInviteTip = { tick: tick, idle: editorIdle, show: showTip, picker: togglePicker, close: closePicker, people: loadPeople, reset: function () { try { localStorage.removeItem(TIP_KEY); } catch (e) { /* nada */ } } };
})();
