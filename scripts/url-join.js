// ==========================================================
// 🔗 LINKS PARA ENTRAR A UN SERVIDOR (va después de scripts/mp-saved.js)
//
//  · Servidor permanente:  …/MB-World-Editor/?server=slot3   → el link NUNCA cambia. Al abrirlo:
//      si alguien lo tiene abierto, entras a esa partida; si no, se abre y tú quedas de anfitrión (igual que el botón Open).
//  · Sala de ahora:        …/MB-World-Editor/?join=<id>       → sirve mientras esa sala siga abierta.
//  · Botón 🔗 en cada servidor de la lista (Multijugador) y al lado del ＋ cuando estás en una sala: copia el link.
//  · El link se quita de la barra de direcciones al usarlo (si recargas la página no vuelve a entrar solo).
// ==========================================================
(function () {
    'use strict';
    const tr = (k, fb, v) => { try { const s = typeof window.tmsg === 'function' ? window.tmsg(k, fb, v) : null; return (s && s !== k ? s : String(fb)).replace(/\{(\w+)\}/g, (m, q) => (v && v[q] !== undefined ? v[q] : m)); } catch (e) { return fb; } };
    const $ = (id) => document.getElementById(id);
    const SLOT_RE = /^slot[1-9]$/, ROOM_RE = /^[\w-]{3,80}$/;
    const base = () => location.origin + location.pathname;
    function linkFor(kind, id) { return base() + '?' + kind + '=' + encodeURIComponent(id); }
    window.mbwServerLink = function (slotOrRoom) {
        const v = String(slotOrRoom || '');
        return SLOT_RE.test(v) ? linkFor('server', v) : linkFor('join', v);
    };
    function toast(t, sub) { if (typeof window.mpToast === 'function') window.mpToast('🔗', t, sub); else if (typeof window.flashToast === 'function') window.flashToast(t); }
    function copy(text) {
        const done = () => toast(tr('uj_copied', 'Link copied! Send it to whoever you want to join.'), text);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { prompt(tr('uj_copy_manual', 'Copy this link:'), text); });
        else prompt(tr('uj_copy_manual', 'Copy this link:'), text);
    }
    window.mbwCopyServerLink = function (slotOrRoom) { copy(window.mbwServerLink(slotOrRoom)); };

    // ---------------------------------------------------------- 🔗 en la lista de servidores
    function linkBtn(target) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'uj-link srv-icon'; b.textContent = '🔗';
        b.title = tr('uj_copy_tip', 'Copy a link to join this server');
        b.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); window.mbwCopyServerLink(target); });
        return b;
    }
    function decorate(list) {
        if (!list) return;
        list.querySelectorAll('.ss-open[data-ss]').forEach((o) => {
            if (o.parentNode.querySelector('.uj-link')) return;
            o.parentNode.insertBefore(linkBtn(o.getAttribute('data-ss')), o);
        });
        const act = window.__mbwLastServers || {};
        list.querySelectorAll('.mp-join-btn[data-room]').forEach((o) => {
            const row = o.parentNode; if (!row || row.querySelector('.uj-link')) return;
            const room = o.getAttribute('data-room');
            if (!room || !act[room]) return;
            const s = act[room];
            row.insertBefore(linkBtn(s && SLOT_RE.test(String(s.slot || '')) ? s.slot : room), o);
        });
    }
    function watchList() {
        const list = $('public-servers-list');
        if (!list || list.__ujObs) return;
        list.__ujObs = new MutationObserver(() => decorate(list));
        list.__ujObs.observe(list, { childList: true });
        decorate(list);
    }

    // ---------------------------------------------------------- 🔗 al lado del ＋ (estando en una sala)
    function syncRoomButton() {
        const zone = $('mp-live-zone');
        const inRoom = typeof isMultiplayer !== 'undefined' && isMultiplayer && !!window.currentRoomId;
        let b = $('uj-room-link');
        if (!zone || !inRoom) { if (b) b.style.display = 'none'; return; }
        if (!b) {
            b = document.createElement('button'); b.type = 'button'; b.id = 'uj-room-link'; b.className = 'mp-invite-plus uj-room-link'; b.textContent = '🔗';
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const room = window.currentRoomId;
                if (window.mpSlot && SLOT_RE.test(window.mpSlot)) { window.mbwCopyServerLink(window.mpSlot); return; }
                // (invitado en un servidor permanente: se pregunta cuál es, para dar el link que no cambia)
                const p = (typeof database !== 'undefined' && database) ? database.ref('servers/' + room + '/slot').once('value') : Promise.reject();
                p.then((sn) => { const k = sn.val(); window.mbwCopyServerLink(SLOT_RE.test(String(k || '')) ? k : room); }).catch(() => window.mbwCopyServerLink(room));
            });
            zone.appendChild(b);
        }
        b.title = window.mpSlot ? tr('uj_room_tip_perm', 'Copy the link of this permanent server (it never changes)') : tr('uj_room_tip', 'Copy a link to join this room');
        b.style.display = '';
    }
    setInterval(() => { try { watchList(); syncRoomButton(); } catch (e) { /* nada */ } }, 1000);

    // ---------------------------------------------------------- al abrir la página con ?server= o ?join=
    const q = new URLSearchParams(location.search);
    const wantServer = q.get('server'), wantRoom = q.get('join');
    const want = SLOT_RE.test(wantServer || '') ? { kind: 'server', id: wantServer } : (ROOM_RE.test(wantRoom || '') ? { kind: 'join', id: wantRoom } : null);
    window.mbwUrlJoin = want;                                        // (pruebas)
    if (!want) return;
    try { q.delete('server'); q.delete('join'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash); } catch (e) { /* nada */ }

    function appReady() {
        const ov = $('loading-overlay');
        return typeof mbwom !== 'undefined' && mbwom.world && (!ov || getComputedStyle(ov).display === 'none') && typeof database !== 'undefined' && database && typeof window.joinMultiplayerSession === 'function';
    }
    let tries = 0;
    function go() {
        if (++tries > 240) { alert(tr('uj_fail', 'Could not open the server from the link. Try again from Multiplayer.')); return; }
        if (!appReady()) { setTimeout(go, 500); return; }
        toast(tr('uj_entering', 'Entering the server from the link…'));
        if (want.kind === 'join') {
            database.ref('servers/' + want.id).once('value').then((s) => {
                if (!s.val()) { alert(tr('uj_room_gone', 'That room is not open any more. Ask for a new link (or the link of the permanent server).')); return; }
                try { if (typeof closeFileMenu === 'function') closeFileMenu(); } catch (e) { /* nada */ }
                window.joinMultiplayerSession(want.id);
            }).catch(() => window.joinMultiplayerSession(want.id));
            return;
        }
        const SS = window.mbwSavedServers;
        if (!SS) { setTimeout(go, 500); return; }
        SS.watch();
        database.ref('servers').once('value').then((snap) => {
            window.__mbwLastServers = snap.val() || {};
            const wait = (n) => {
                if (!SS.ready()) { if (n < 40) setTimeout(() => wait(n + 1), 250); else alert(tr('uj_fail', 'Could not open the server from the link. Try again from Multiplayer.')); return; }
                const s = SS.get(want.id);
                if (!s || !s.rev) { alert(tr('uj_server_gone', 'That permanent server does not exist any more.')); return; }
                try { if (typeof closeFileMenu === 'function') closeFileMenu(); } catch (e) { /* nada */ }
                SS.open(want.id).then((ok) => { if (ok === false) alert(tr('uj_fail', 'Could not open the server from the link. Try again from Multiplayer.')); });
            };
            wait(0);
        }).catch(() => setTimeout(go, 1000));
    }
    setTimeout(go, 300);
})();
