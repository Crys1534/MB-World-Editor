// ==========================================================
// 🚪 PEDIR ENTRAR AL MUNDO DE OTRO JUGADOR (lista "Online" del menú Multiplayer)
// · El que pide: botón "Ask to join" junto a la persona. Se guarda la solicitud en private_chats/jr_{suUID}/{miUID}
//   y se espera la respuesta (hasta 2 minutos).
//   ¿Por qué ahí y no en un nodo propio "join_requests"? Las reglas de Firebase del proyecto solo dejan escribir en los nodos
//   que ya existen (online_users, private_chats, typing_status...), así que un nodo nuevo se rechazaba y la otra persona
//   nunca recibía nada. "jr_..." nunca choca con un chat de verdad (esos se llaman usr_..._usr_...). Si ese lugar fallara,
//   se intenta en typing_status/jr_{suUID}/{miUID}; el que recibe escucha los dos.
// · El que está editando: le sale un aviso con Aceptar / Rechazar. Si acepta y todavía no tenía sala, se crea una sala
//   privada (no aparece en la lista pública) con el mundo que tiene abierto; la respuesta lleva el ID de la sala.
// · Al aceptar, el que pidió entra solo a la sala. Si rechaza (o no contesta), se le avisa.
// Todo usa Firebase (como las invitaciones y los amigos) y la conexión normal de PeerJS (scripts/multiplayer.js).
// ==========================================================
(function () {
    'use strict';
    const TTL = 120000;                      // una solicitud vale 2 minutos
    const COOLDOWN = 15000;                  // no se puede volver a pedir a la misma persona hasta pasados 15 s
    const SLOTS = ['private_chats/jr_', 'typing_status/jr_'];   // dónde se guardan (en orden de preferencia)
    const st = { sent: {}, watching: {}, pops: {}, hostReady: false, slotOf: {}, reqSlot: {}, offset: 0 };
    window.mbwJoinRequests = st;
    function me() { try { return localStorage.getItem('mbw_uid'); } catch (e) { return null; } }
    function myName() { return localStorage.getItem('mbw_username') || 'Player'; }
    function myPfp() { return localStorage.getItem('mbw_profile_pic') || 'assets/default pfp.png'; }
    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : fb.replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function toast(title, body, icon) { if (typeof window.mpToast === 'function') window.mpToast(title, body, icon); }
    function db() { return typeof database !== 'undefined' ? database : null; }
    function worldName() {
        const w = document.getElementById('filename-display');
        return (w && w.value) ? w.value : 'world';
    }
    function userInfo(uid) {
        const u = window.lastKnownUsers && window.lastKnownUsers[uid];
        return u ? { name: u.username || 'Player', pfp: u.pfp || 'assets/default pfp.png', world: u.worldName || '' } : { name: 'Player', pfp: 'assets/default pfp.png', world: '' };
    }
    function rerender() { if (typeof window.renderPresenceList === 'function') window.renderPresenceList(); }
    function path(slot, target, from) { return SLOTS[slot] + target + '/' + from; }
    function now() { return Date.now() + (st.offset || 0); }   // la hora del servidor (los relojes de las computadoras no siempre coinciden)
    // guarda en el primer lugar que Firebase acepte
    function writeFirst(target, from, value, i) {
        i = i || 0;
        const d = db();
        return d.ref(path(i, target, from)).set(value).then(() => i, (e) => {
            if (i + 1 < SLOTS.length) return writeFirst(target, from, value, i + 1);
            throw e;
        });
    }

    // ---------------------------------------------------------------- el que pide
    window.mbwJoinPending = function (uid) { const t = st.sent[uid]; return !!t && Date.now() - t < TTL; };
    window.mbwJoinCooling = function (uid) { const t = st.sent[uid]; return !!t && Date.now() - t < COOLDOWN; };
    window.requestJoinWorld = function (uid) {
        const d = db(), mine = me();
        if (!d || !mine || !uid || uid === mine) return false;
        if (typeof window.isBlocked === 'function' && window.isBlocked(uid)) return false;
        if (window.mbwJoinCooling(uid)) return false;
        const who = userInfo(uid);
        st.sent[uid] = Date.now();
        const req = { name: myName(), pfp: myPfp(), world: worldName(), status: 'pending', time: firebase.database.ServerValue.TIMESTAMP };
        writeFirst(uid, mine, req).then((slot) => {
            st.slotOf[uid] = slot;
            toast(tr('jr_sent_t', '🚪 Request sent'), tr('jr_sent', 'Waiting for {name} to let you in...', { name: who.name }), who.pfp);
            watchAnswer(uid, who);
        }, () => {
            delete st.sent[uid];
            toast(tr('jr_err_t', '⚠️ Request not sent'), tr('jr_err', 'Could not reach {name}. Check your connection and try again.', { name: who.name }), who.pfp);
            rerender();
        });
        rerender();
        setTimeout(rerender, COOLDOWN + 100);
        return true;
    };
    function watchAnswer(uid, who) {
        const d = db(), mine = me();
        const ref = d.ref(path(st.slotOf[uid] || 0, uid, mine));
        if (st.watching[uid]) ref.off('value', st.watching[uid]);
        let done = false;
        const finish = () => { done = true; ref.off('value', cb); delete st.watching[uid]; clearTimeout(timer); rerender(); };
        const cb = (snap) => {
            if (done) return;
            const v = snap.val();
            if (!v) return;
            if (v.status === 'accepted' && v.roomId) {
                finish();
                ref.remove();
                delete st.sent[uid];
                toast(tr('jr_ok_t', '✅ Request accepted'), tr('jr_ok', '{name} let you in. Joining their world...', { name: who.name }), who.pfp);
                joinRoom(String(v.roomId));
            } else if (v.status === 'declined' || v.status === 'busy') {
                finish();
                ref.remove();
                toast(tr('jr_no_t', '🚪 Request declined'), v.status === 'busy' ? tr('jr_busy', '{name} cannot receive players right now.', { name: who.name }) : tr('jr_no', '{name} did not let you in this time.', { name: who.name }), who.pfp);
            }
        };
        const timer = setTimeout(() => {
            if (done) return;
            finish();
            ref.once('value').then(s => { const v = s.val(); if (v && v.status === 'pending') ref.remove(); });
            toast(tr('jr_timeout_t', '🚪 No answer'), tr('jr_timeout', '{name} did not answer your request.', { name: who.name }), who.pfp);
        }, TTL);
        st.watching[uid] = cb;
        ref.on('value', cb);
    }
    function joinRoom(roomId) {
        try {
            if (typeof openFileMenu === 'function') openFileMenu('multiplayer');
            if (typeof setMpView === 'function') setMpView('join');
            const inp = document.getElementById('join-peer-id'); if (inp) inp.value = roomId;
        } catch (e) { /* sin interfaz */ }
        if (typeof window.joinMultiplayerSession === 'function') window.joinMultiplayerSession(roomId, true);
        st.lastJoin = roomId;
    }

    // ---------------------------------------------------------------- el que está editando
    function listen() {
        const d = db(), mine = me();
        if (!d || !mine || st.hostReady) return !!st.hostReady;
        st.hostReady = true;
        try { d.ref('.info/serverTimeOffset').on('value', (s) => { st.offset = Number(s && s.val()) || 0; }); } catch (e) { /* sin hora del servidor */ }
        SLOTS.forEach((slotPath, slot) => {
            const ref = d.ref(slotPath + mine);
            const fail = () => { /* sin permiso para leer aquí: se usa el otro lugar */ };
            ref.on('child_added', (snap) => onRequest(snap.key, snap.val(), slot), fail);
            ref.on('child_changed', (snap) => onRequest(snap.key, snap.val(), slot), fail);
            ref.on('child_removed', (snap) => { if (st.reqSlot[snap.key] === slot) closePop(snap.key); }, fail);
        });
        return true;
    }
    function myRef(fromUid) { return db().ref(path(st.reqSlot[fromUid] || 0, me(), fromUid)); }
    function onRequest(fromUid, req, slot) {
        if (!req || typeof req !== 'object' || req.status !== 'pending') { if (st.reqSlot[fromUid] === slot) closePop(fromUid); return; }
        st.reqSlot[fromUid] = slot;
        if (typeof window.isBlocked === 'function' && window.isBlocked(fromUid)) { myRef(fromUid).remove(); return; }
        const t = Number(req.time) || 0;
        if (t && now() - t > TTL + 30000) { myRef(fromUid).remove(); return; }   // vieja: ya nadie la espera
        if (typeof isMultiplayer !== 'undefined' && isMultiplayer && typeof isHost !== 'undefined' && !isHost) {   // estoy en la sala de otro
            myRef(fromUid).update({ status: 'busy' });
            return;
        }
        showPop(fromUid, req);
    }
    function showPop(fromUid, req) {
        closePop(fromUid);
        let stack = document.getElementById('jr-stack');
        if (!stack) { stack = document.createElement('div'); stack.id = 'jr-stack'; document.body.appendChild(stack); }
        const box = document.createElement('div');
        box.className = 'jr-pop'; box.dataset.uid = fromUid;
        const av = document.createElement('div'); av.className = 'jr-av';
        av.style.backgroundImage = 'url("' + String(window.isRealPfp && window.isRealPfp(req.pfp) ? req.pfp : 'assets/default pfp.png').replace(/"/g, '%22') + '")';
        const tx = document.createElement('div'); tx.className = 'jr-text';
        const b = document.createElement('b'); b.textContent = tr('jr_ask_t', '{name} wants to join your world', { name: String(req.name || 'Player').slice(0, 40) });
        const sm = document.createElement('span'); sm.textContent = tr('jr_ask', 'Let them in to edit "{world}" with you?', { world: worldName() });
        tx.appendChild(b); tx.appendChild(sm);
        const btns = document.createElement('div'); btns.className = 'jr-btns';
        const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'jr-ok'; ok.textContent = tr('jr_accept', 'Accept');
        const no = document.createElement('button'); no.type = 'button'; no.className = 'jr-no'; no.textContent = tr('jr_decline', 'Decline');
        ok.onclick = () => { ok.disabled = no.disabled = true; window.acceptJoinRequest(fromUid); };
        no.onclick = () => window.declineJoinRequest(fromUid);
        btns.appendChild(ok); btns.appendChild(no);
        box.appendChild(av); box.appendChild(tx); box.appendChild(btns);
        stack.appendChild(box);
        st.pops[fromUid] = { el: box, timer: setTimeout(() => closePop(fromUid), TTL) };
        if (typeof audioManager !== 'undefined' && audioManager.playTone) { try { audioManager.playTone(660, 'sine', 0.12, 0.25); } catch (e) { /* sin sonido */ } }
    }
    function closePop(uid) {
        const p = st.pops[uid];
        if (!p) return;
        clearTimeout(p.timer); p.el.remove(); delete st.pops[uid];
    }
    // Una sala para recibir gente: la que ya tengo, o una nueva PRIVADA con el mundo abierto
    function ensureRoom() {
        return new Promise((resolve, reject) => {
            if (typeof isHost !== 'undefined' && isHost && window.currentRoomId) {
                // si ya está llena, se hace lugar para una persona más
                const full = typeof misClientes !== 'undefined' && misClientes.length >= window.multiplayerPlayerLimit - 1;
                if (full) { window.multiplayerPlayerLimit++; if (window.myRoomRef) window.myRoomRef.update({ maxPlayers: window.multiplayerPlayerLimit }); }
                resolve(window.currentRoomId); return;
            }
            if (typeof mbwom === 'undefined' || !mbwom.world) { reject(new Error('no world')); return; }
            window.mpSelectedMapName = worldName();
            window.mpSelectedMapThumb = null;
            window.multiplayerAccess = 'private';
            if (!(window.multiplayerPlayerLimit >= 2)) window.multiplayerPlayerLimit = 2;
            window.hostMultiplayerSession();
            const t0 = Date.now();
            const iv = setInterval(() => {
                if (window.currentRoomId && typeof isHost !== 'undefined' && isHost) { clearInterval(iv); resolve(window.currentRoomId); }
                else if (Date.now() - t0 > 15000) { clearInterval(iv); reject(new Error('timeout')); }
            }, 100);
        });
    }
    window.acceptJoinRequest = function (fromUid) {
        const ref = myRef(fromUid);
        return ensureRoom().then((roomId) => {
            closePop(fromUid);
            return ref.update({ status: 'accepted', roomId: roomId, hostName: myName() }).then(() => {
                toast(tr('jr_letin_t', '🚪 Letting them in'), tr('jr_letin', 'They are joining your world now.'));
                setTimeout(() => { ref.once('value').then(s => { if (s.val()) ref.remove(); }); }, 30000);
                return roomId;
            });
        }, (e) => {
            closePop(fromUid);
            ref.update({ status: 'busy' });
            toast(tr('jr_fail_t', '⚠️ Could not open your world'), e && e.message === 'no world' ? tr('jr_fail_world', 'Open a world first to receive players.') : tr('jr_fail', 'The room could not be created. Try again.'));
            return null;
        });
    };
    window.declineJoinRequest = function (fromUid) {
        closePop(fromUid);
        return myRef(fromUid).update({ status: 'declined' });
    };

    // se empieza a escuchar en cuanto haya Firebase y un usuario (sin rendirse: al principio cada medio segundo, luego cada 3 s)
    let tries = 0;
    (function boot() { if (listen()) return; tries++; setTimeout(boot, tries < 120 ? 500 : 3000); })();
})();
