// ==========================================================
// 🎒 (anfitrión del server) VER Y CAMBIAR EL INVENTARIO DE OTRO JUGADOR, en el Modo Jugar
//
//  · Menú de pausa > Jugadores: al lado de cada jugador, el botón 🎒 (solo lo ve quien lleva la partida).
//  · Si está conectado: se le pide su inventario y los cambios le llegan al momento.
//    Si no está: se cambia lo que el mundo guardó de él (lo tendrá al volver a entrar).
//  · Se toca una casilla y luego: 🗑 quitar · 📥 tomarlo (pasa a mi inventario) · 📤 poner lo que tengo en la mano.
//  · Al lado sale MI inventario: se toca una casilla de un lado y luego una del otro, y las cosas se pasan (o se cambian).
//    Una mía elegida + 📤 = se la doy (va a su primer lugar libre).
//  · Crystal (los admins de scripts/mp-saved.js) también lo puede usar, con los que están conectados.
//  Mensajes: juego_inv_pedir { a } · juego_inv { para, inv, armors } · juego_inv_poner { a, k: 'i'|'a', i, it }
// ==========================================================
(function () {
    'use strict';
    const tr = (k, fb, v) => { try { let s = window.tmsg ? window.tmsg(k, fb) : fb; s = s || fb; if (v) Object.keys(v).forEach(function (q) { s = s.split('{' + q + '}').join(v[q]); }); return s; } catch (e) { return fb; } };
    const M = () => window.mbwMpPlay;
    const send = (d) => { if (typeof window.enviarMensajeEnRed === 'function') window.enviarMensajeEnRed(d); };
    const me = () => (M() && M().myId) ? M().myId() : null;
    const empty = () => ['air', 0, 0, {}];
    const isEmpty = (it) => !Array.isArray(it) || !it[0] || it[0] === 'air' || !(Number(it[1]) > 0);
    const V = { open: false, uid: null, peer: null, name: '', inv: null, armors: null, sel: null, el: null, waiting: false };

    function isLeader() { const m = M(); return !!(m && m.on && m.role === 'host'); }
    const myUid = () => { try { return localStorage.getItem('mbw_uid') || ''; } catch (e) { return ''; } };
    function admin() { try { return !!(window.mbwSavedServers && window.mbwSavedServers.isAdmin && window.mbwSavedServers.isAdmin()); } catch (e) { return false; } }
    function adminUid(u) { try { return !!(window.mbwSavedServers && window.mbwSavedServers.isAdminUid && window.mbwSavedServers.isAdminUid(u)); } catch (e) { return false; } }
    function canUse() { const m = M(); return isLeader() || !!(m && m.on && admin()); }
    // (¿me puede pedir/cambiar el inventario? el que lleva la partida o Crystal)
    function trusted(d) { const m = M(); return !!(d.peerId && ((m.role === 'guest' && d.peerId === m.leaderPeer) || adminUid(d.uid))); }
    function myInv() { try { return mbwom.world.inventoryList; } catch (e) { return null; } }
    function mineChanged() {
        if (window.mbwPlay && window.mbwPlay.hudDirty) window.mbwPlay.hudDirty();
        try { if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh(); } catch (e) { /* nada */ }
    }
    function peerOf(uid) { const m = M(); if (!m || !m.remotes) return null; return Object.keys(m.remotes).find(function (k) { return m.remotes[k] && m.remotes[k].uid === uid; }) || null; }
    function rec(uid) { const P = (typeof mbwom !== 'undefined' && mbwom.world && mbwom.world.mbwePlayers) || {}; return P[uid] || null; }

    // ------------------------------------------------------------------ la ventana
    function build() {
        const el = V.el = document.createElement('div');
        el.id = 'mp-inv-view';
        el.innerHTML = '<div class="miv-win"><div class="miv-head"><span class="miv-title"></span><button type="button" class="miv-x">✕</button></div>' +
            '<div class="miv-note"></div><div class="miv-sides"><div class="miv-side"><div class="miv-body"><div class="miv-armor"></div><div class="miv-grid"></div></div></div>' +
            '<div class="miv-side miv-mine"><div class="miv-sub"></div><div class="miv-grid miv-mygrid"></div></div></div>' +
            '<div class="miv-sel"></div><div class="miv-btns"><button type="button" class="miv-del"></button><button type="button" class="miv-take"></button><button type="button" class="miv-give"></button></div></div>';
        ['pointerdown', 'keydown', 'keyup', 'wheel'].forEach(function (n) { el.addEventListener(n, function (e) { e.stopPropagation(); }); });
        el.querySelector('.miv-x').addEventListener('click', close);
        el.addEventListener('click', function (e) { if (e.target === el) close(); });
        el.querySelector('.miv-del').addEventListener('click', function () { act('del'); });
        el.querySelector('.miv-take').addEventListener('click', function () { act('take'); });
        el.querySelector('.miv-give').addEventListener('click', function () { act('give'); });
        document.body.appendChild(el);
    }
    function slot(it, key) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'miv-slot' + (V.sel === key ? ' on' : '');
        const cv = document.createElement('canvas'); cv.width = cv.height = 32; b.appendChild(cv);
        if (!isEmpty(it)) {
            try { const im = window.mbwPlay && window.mbwPlay.iconFor ? window.mbwPlay.iconFor(it[0], it[3] || {}) : null; if (im) { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(im, 0, 0, 32, 32); } } catch (e) { /* nada */ }
            if (Number(it[1]) > 1) { const n = document.createElement('span'); n.className = 'miv-n'; n.textContent = String(it[1]); b.appendChild(n); }
            b.title = String(it[0]);
        }
        b.addEventListener('click', function () { pick(key); });
        return b;
    }
    const side = (key) => (key && key[0] === 'm') ? 'me' : 'them';
    // tocar una casilla: si ya había una elegida del OTRO lado, se pasan las cosas entre las dos
    function pick(key) {
        if (V.sel && V.sel !== key && side(V.sel) !== side(key)) { const a = V.sel; V.sel = null; moveBetween(a, key); render(); return; }
        V.sel = V.sel === key ? null : key; render();
    }
    function itemAt(key) {
        if (!key) return null; const k = key[0], i = Number(key.slice(1));
        if (k === 'm') { const l = myInv(); return l ? l[i] || null : null; }
        if (k === 'a') { const a = (V.armors || [])[i]; return a && a[0] && a[0] !== 'air' ? [a[0], 1, a[1] || 0, a[2] || {}] : null; }
        return (V.inv || [])[i] || null;
    }
    const ARMOR = /(Cap|Shirt|Pants|Shoes)$/;
    const ARMOR_SLOT = ['Cap', 'Shirt', 'Pants', 'Shoes'];
    function fitsArmor(i, it) { return isEmpty(it) || new RegExp(ARMOR_SLOT[i] + '$').test(String(it[0])); }
    function setMine(i, it) { const l = myInv(); if (!l) return; l[i] = isEmpty(it) ? empty() : JSON.parse(JSON.stringify(it)); mineChanged(); }
    const sameKind = (a, b) => !isEmpty(a) && !isEmpty(b) && a[0] === b[0] && !(Number(a[2]) || 0) && !(Number(b[2]) || 0) && JSON.stringify(a[3] || {}) === JSON.stringify(b[3] || {});
    // pasar de una casilla a otra (de su inventario al mío o al revés): se juntan si son iguales; si no, se cambian
    function moveBetween(from, to) {
        if (!V.inv) return;
        const A = itemAt(from), B = itemAt(to);
        if (isEmpty(A) && isEmpty(B)) return;
        const put = function (key, it) { if (key[0] === 'm') setMine(Number(key.slice(1)), it); else setSlot(key, it); };
        const armorOk = function (key, it) { return key[0] !== 'a' || fitsArmor(Number(key.slice(1)), it); };
        if (sameKind(A, B) && to[0] !== 'a') {
            const n = Math.min(64, Number(B[1]) + Number(A[1])), moved = n - Number(B[1]);
            put(to, [B[0], n, B[2] || 0, B[3] || {}]);
            put(from, Number(A[1]) - moved > 0 ? [A[0], Number(A[1]) - moved, A[2] || 0, A[3] || {}] : null);
            return;
        }
        if (!armorOk(to, A) || !armorOk(from, B)) { flash(tr('miv_not_armor', 'Only that kind of armor goes in that slot.')); return; }
        put(to, A); put(from, B);
    }
    function flash(t) { try { if (window.mbwPlay && window.mbwPlay.net && window.mbwPlay.net.flash) window.mbwPlay.net.flash(t); } catch (e) { /* nada */ } }
    function firstFree() { for (let i = 0; i < 45; i++) if (isEmpty(V.inv[i])) return i; return -1; }
    function render() {
        if (!V.el) build();
        const el = V.el;
        el.style.display = 'flex';
        el.querySelector('.miv-title').textContent = '🎒 ' + tr('miv_title', 'Inventory of {name}', { name: V.name });
        el.querySelector('.miv-note').textContent = V.waiting ? tr('miv_loading', 'Asking for the inventory…') : (V.peer ? tr('miv_online', 'Online: changes reach them right away.') : tr('miv_offline', 'Not connected: they will get these changes when they come back.'));
        const ar = el.querySelector('.miv-armor'), gr = el.querySelector('.miv-grid');
        ar.innerHTML = ''; gr.innerHTML = '';
        if (V.inv) {
            for (let i = 0; i < 4; i++) { const a = (V.armors || [])[i]; ar.appendChild(slot(a && a[0] && a[0] !== 'air' ? [a[0], 1, a[1] || 0, a[2] || {}] : null, 'a' + i)); }
            // las 4 filas del inventario y abajo la hotbar (como en el juego)
            for (let i = 9; i < 45; i++) gr.appendChild(slot(V.inv[i], 'i' + i));
            for (let i = 0; i < 9; i++) { const s = slot(V.inv[i], 'i' + i); s.classList.add('miv-hot'); gr.appendChild(s); }
        }
        // 👜 mi inventario, al lado
        const mg = el.querySelector('.miv-mygrid'), L = myInv() || [];
        mg.innerHTML = '';
        el.querySelector('.miv-sub').textContent = '👜 ' + tr('miv_mine', 'My inventory');
        for (let i = 9; i < 45; i++) mg.appendChild(slot(L[i], 'm' + i));
        for (let i = 0; i < 9; i++) { const s = slot(L[i], 'm' + i); s.classList.add('miv-hot'); mg.appendChild(s); }
        const it = itemAt(V.sel);
        const mineSel = side(V.sel) === 'me';
        el.querySelector('.miv-sel').textContent = V.sel ? ((mineSel ? '👜 ' : '') + (isEmpty(it) ? tr('miv_empty_slot', 'Empty slot') : String(it[0]) + (Number(it[1]) > 1 ? ' ×' + it[1] : '')) + '  ·  ' + tr('miv_then', 'now tap a slot on the other side to move it'))
            : tr('miv_pick2', 'Tap a slot, then a slot on the other side to move things between the two inventories.');
        const mine = mineSel ? it : myHand();
        el.querySelector('.miv-del').textContent = '🗑 ' + tr('miv_del', 'Remove');
        el.querySelector('.miv-take').textContent = '📥 ' + tr('miv_take', 'Take it');
        el.querySelector('.miv-give').textContent = '📤 ' + (mineSel ? tr('miv_give_it', 'Give it') : tr('miv_give', 'Put what I hold'));
        el.querySelector('.miv-del').disabled = !V.sel || mineSel || isEmpty(it);
        el.querySelector('.miv-take').disabled = !V.sel || mineSel || isEmpty(it);
        el.querySelector('.miv-give').disabled = !V.sel || !V.inv || isEmpty(mine) || (mineSel ? firstFree() < 0 : (V.sel[0] === 'a' && !fitsArmor(Number(V.sel.slice(1)), mine)));
    }
    function myHand() { try { const w = mbwom.world; return w.inventoryList[w.selectedInventoryItem | 0]; } catch (e) { return null; } }
    function close() { V.open = false; V.sel = null; if (V.el) V.el.style.display = 'none'; }

    // ------------------------------------------------------------------ cambiar una casilla
    function setSlot(key, it) {
        const k = key[0], i = Number(key.slice(1));
        if (k === 'a') { V.armors = V.armors || []; V.armors[i] = isEmpty(it) ? ['air', 0, {}] : [it[0], it[2] || 0, it[3] || {}]; }
        else { V.inv[i] = isEmpty(it) ? empty() : JSON.parse(JSON.stringify(it)); }
        if (V.peer) send({ tipo: 'juego_inv_poner', a: V.peer, peerId: me(), uid: myUid(), k: k, i: i, it: isEmpty(it) ? null : it });
        else { const r = rec(V.uid); if (r) { r.inv = V.inv; r.armors = V.armors; if (typeof worldDirty !== 'undefined') { try { worldDirty = true; } catch (e) { /* nada */ } } } }
    }
    function act(what) {
        if (!V.sel || !V.inv) return;
        const it = itemAt(V.sel);
        if (what === 'del') setSlot(V.sel, null);
        else if (what === 'take') {
            const left = window.mbwPlay && window.mbwPlay.give ? window.mbwPlay.give(it[0], Number(it[1]) || 1, Number(it[2]) || 0, it[3] || {}) : Number(it[1]);
            if (left >= Number(it[1])) return;
            const rest = left > 0 ? [it[0], left, it[2], it[3]] : null;
            setSlot(V.sel, rest);
        } else if (what === 'give' && side(V.sel) === 'me') {           // 📤 una casilla mía: se la doy (a su primer lugar libre)
            const f = firstFree(); if (f < 0 || isEmpty(it)) return;
            const i = Number(V.sel.slice(1));
            setSlot('i' + f, it);
            if (Number(mbwom.world.gamemode) !== 1) setMine(i, null);
            V.sel = null;
        } else if (what === 'give') {
            const h = myHand(); if (isEmpty(h)) return;
            setSlot(V.sel, JSON.parse(JSON.stringify(h)));
            const w = mbwom.world; if (Number(w.gamemode) !== 1) w.inventoryList[w.selectedInventoryItem | 0] = empty();
            if (window.mbwPlay && window.mbwPlay.hudDirty) window.mbwPlay.hudDirty();
        }
        render();
    }

    // ------------------------------------------------------------------ abrir (desde el menú de pausa)
    function openFor(uid, name) {
        if (!canUse()) return false;
        const peer = peerOf(uid);
        if (!isLeader() && !peer) { flash(tr('miv_need_online', 'That player is not connected right now.')); return false; }
        V.open = true; V.uid = uid; V.name = String(name || 'Player'); V.sel = null;
        V.peer = peer;
        const r = rec(uid);
        V.inv = r && Array.isArray(r.inv) ? r.inv.slice(0, 45).map(function (q) { return Array.isArray(q) ? q : empty(); }) : null;
        while (V.inv && V.inv.length < 45) V.inv.push(empty());
        V.armors = r && Array.isArray(r.armors) ? r.armors.slice(0, 4) : [['air', 0, {}], ['air', 0, {}], ['air', 0, {}], ['air', 0, {}]];
        if (V.peer) { V.waiting = true; send({ tipo: 'juego_inv_pedir', a: V.peer, peerId: me(), uid: myUid() }); }
        else { V.waiting = false; if (!V.inv) { V.inv = []; for (let i = 0; i < 45; i++) V.inv.push(empty()); } }
        render();
        return true;
    }

    // ------------------------------------------------------------------ red
    function onNet(d) {
        const m = M(); if (!m || !m.on) return;
        const t = d.tipo;
        // (invitado) el que lleva la partida me pide mi inventario / me cambia una casilla
        if (t === 'juego_inv_pedir' && d.a === me() && trusted(d)) { reply(d.peerId); return; }
        if (t === 'juego_inv_poner' && d.a === me() && trusted(d)) {
            const w = mbwom.world, i = Number(d.i) | 0, it = Array.isArray(d.it) && typeof d.it[0] === 'string' ? [d.it[0].slice(0, 60), Math.max(0, Math.min(64, Number(d.it[1]) || 0)), Number(d.it[2]) || 0, (d.it[3] && typeof d.it[3] === 'object') ? d.it[3] : {}] : null;
            if (d.k === 'a' && i >= 0 && i < 4) w.armors[i] = it ? [it[0], it[2], it[3]] : ['air', 0, {}];
            else if (d.k === 'i' && i >= 0 && i < 45) w.inventoryList[i] = it || empty();
            if (window.mbwPlay && window.mbwPlay.hudDirty) window.mbwPlay.hudDirty();
            try { if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh(); } catch (e) { /* nada */ }
            reply(d.peerId);
            return;
        }
        // (anfitrión) llegó su inventario
        if (t === 'juego_inv' && d.para === me() && V.open && d.peerId === V.peer) {
            V.waiting = false;
            V.inv = Array.isArray(d.inv) ? d.inv.slice(0, 45) : V.inv; while (V.inv && V.inv.length < 45) V.inv.push(empty());
            V.armors = Array.isArray(d.armors) ? d.armors.slice(0, 4) : V.armors;
            const r = rec(V.uid); if (r) { r.inv = V.inv; r.armors = V.armors; }
            render();
        }
    }
    function reply(to) { const w = mbwom.world; send({ tipo: 'juego_inv', para: to, peerId: me(), inv: JSON.parse(JSON.stringify(w.inventoryList || [])), armors: JSON.parse(JSON.stringify(w.armors || [])) }); }

    window.mbwMpInv = { open: openFor, close: close, onNet: onNet, canUse: canUse, state: V, move: moveBetween, pick: pick };
})();
