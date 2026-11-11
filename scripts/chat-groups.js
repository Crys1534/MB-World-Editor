// =====================================================================
// 👥 GRUPOS DE CHAT (el grupo de cada mundo) + 📌 MENSAJES FIJADOS + 🧵 HILOS (como Discord)
// =====================================================================
// · El grupo de un mundo: cuando alguien entra a la sala (server) de un mundo, el anfitrión crea (una sola vez) el grupo de ese
//   mundo y mete a cada jugador que entra. El id del grupo se guarda en el mundo (mbweGroupId), así la próxima vez que se abra
//   la sala de ese mismo mundo se usa el mismo grupo. Mientras estás en la sala, el grupo tiene su burbuja fija (no se quita).
//   El primer mensaje del grupo dice la fecha en que se creó. Cuando alguien se desconecta, un mensaje del sistema lo dice;
//   y el último en irse queda marcado: "fue el último en desconectarse: tiene la versión más nueva del mundo".
// · Datos (Firebase):
//     groups/{gid}           = { name, owner, created, members: { uid: nombre }, lastLeft: { uid, name, at } }
//     private_chats/{gid}    = los mensajes (igual que un chat privado; los del sistema llevan system: true)
//     user_chats/{uid}/{gid} = la fila del chat en la lista de cada miembro (isGroup: true, nombre del grupo, sin leer...)
// · Fijar: cualquier mensaje de cualquier chat (privado o grupo) se puede fijar (varios). En el menú ⋮ de la cabecera:
//   "Mensajes fijados" muestra la lista; tocar uno lo busca en la conversación.
// · Hilos: desde un mensaje, "Crear hilo" (con nombre). Los mensajes del hilo van en private_chats/{chat}__t__{mensaje};
//   el mensaje de origen muestra "🧵 nombre · N mensajes" y al tocarlo se abre el hilo en un panel al lado.
// Todo lo que escribe la gente se muestra como TEXTO (textContent).
// =====================================================================
(function () {
    'use strict';
    const GROUP_PFP = 'assets/Overworld icon.png';
    const T = function (k, fb, vars) { let s = (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; if (vars) Object.keys(vars).forEach(function (n) { s = s.split('{' + n + '}').join(String(vars[n])); }); return s; };
    const db = function () { try { return (typeof database !== 'undefined' && database) ? database : null; } catch (e) { return null; } };
    const me = function () { try { return localStorage.getItem('mbw_uid'); } catch (e) { return null; } };
    const myName = function () { try { return localStorage.getItem('mbw_username') || 'Player'; } catch (e) { return 'Player'; } };
    const myPfp = function () { try { return localStorage.getItem('mbw_profile_pic') || 'assets/default pfp.png'; } catch (e) { return 'assets/default pfp.png'; } };
    const TS = function () { try { return firebase.database.ServerValue.TIMESTAMP; } catch (e) { return Date.now(); } };
    const INC = function (n) { try { return firebase.database.ServerValue.increment(n); } catch (e) { return n; } };
    const el = function (tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

    window.mbwIsGroup = function (id) { return /^g_[A-Za-z0-9_-]{4,80}$/.test(String(id || '')); };
    window.mbwGroupPfp = GROUP_PFP;

    // --- miembros (con caché) ---
    const memberCache = {};
    function members(gid) {
        const d = db(); if (!d) return Promise.resolve({});
        if (memberCache[gid]) return Promise.resolve(memberCache[gid]);
        return d.ref(window.mbwGroupRef(gid) + '/members').once('value').then(function (s) { const m = s.val() || {}; memberCache[gid] = m; setTimeout(function () { delete memberCache[gid]; }, 20000); return m; });
    }
    window.mbwGroupMembers = members;
    // dónde se guardan los datos del grupo (nombre, dueño, miembros). Va dentro de private_chats (que las reglas de
    // Firebase ya dejan escribir), en una llave aparte: un nodo nuevo "groups/" no se pudo crear con las reglas actuales.
    window.mbwGroupRef = function (gid) { return 'private_chats/' + gid + '__info'; };
    function groupInfo(gid) { const d = db(); return d ? d.ref(window.mbwGroupRef(gid)).once('value').then(function (s) { return s.val() || null; }) : Promise.resolve(null); }
    window.mbwGroupInfo = groupInfo;

    // la fila del grupo en la lista de chats de cada miembro (sube los "sin leer" de los demás)
    function touchLists(gid, name, last, skipMe) {
        const d = db(), uid = me(); if (!d) return Promise.resolve();
        return members(gid).then(function (m) {
            Object.keys(m).forEach(function (u) {
                const rec = { isGroup: true, name: String(name || 'Group'), pfp: GROUP_PFP, lastMsg: String(last || '').slice(0, 120), timestamp: TS() };
                rec.unreadCount = (u === uid && skipMe !== false) ? 0 : INC(1);
                d.ref('user_chats/' + u + '/' + gid).update(rec).catch(function () { /* nada */ });
            });
        });
    }

    // ✉️ mandar un mensaje al grupo (lo usan el chat grande y el mini chat, por window.dmSendTo)
    window.mbwGroupSend = function (gid, text, extra) {
        const d = db(), uid = me(); if (!d || !uid || !window.mbwIsGroup(gid)) return false;
        const msg = { sender: uid, senderName: myName(), senderPfp: myPfp(), text: String(text), timestamp: TS(), status: 'sent' };
        if (extra && extra.replyTo) msg.replyTo = extra.replyTo;
        d.ref('private_chats/' + gid).push(msg);
        groupInfo(gid).then(function (g) { touchLists(gid, g && g.name, myName() + ': ' + text); });
        return true;
    };
    // 🤖 un mensaje del sistema en el grupo (kind: 'created' | 'joined' | 'left' | 'last')
    function systemMsg(gid, kind, data, text) {
        const d = db(); if (!d) return;
        const msg = { sender: 'system', senderName: 'System', system: true, kind: kind, text: String(text || ''), timestamp: TS(), status: 'sent' };
        if (data) msg.data = data;
        d.ref('private_chats/' + gid).push(msg);
        groupInfo(gid).then(function (g) { touchLists(gid, g && g.name, text, false); });
    }
    window.mbwGroupSystem = systemMsg;
    // el texto de un mensaje del sistema, en el idioma de quien lo lee
    window.mbwSystemText = function (msg) {
        const dd = msg && msg.data || {};
        const when = function (t) { try { return new Date(Number(t) || Date.now()).toLocaleString(typeof dmLocale === 'function' ? dmLocale() : undefined, { dateStyle: 'long', timeStyle: 'short' }); } catch (e) { return new Date(Number(t) || Date.now()).toLocaleString(); } };
        switch (msg && msg.kind) {
            case 'created': return '📅 ' + T('grp_created', 'Group of the world "{world}" created on {date}', { world: dd.world || '?', date: when(msg.timestamp) });
            case 'joined': return '→ ' + T('grp_joined', '{name} joined the world', { name: dd.name || '?' });
            case 'left': return '← ' + T('grp_left', '{name} disconnected from the world', { name: dd.name || '?' });
            case 'last': return '🔚 ' + T('grp_last', '{name} was the last one to disconnect: they have the most recent version of the world', { name: dd.name || '?' });
            default: return String(msg && msg.text || '');
        }
    };

    // ------------------------------------------------------------------ el grupo del mundo (lo maneja el anfitrión de la sala)
    function worldName() { try { return String((document.getElementById('filename-display') || {}).value || window.mpSelectedMapName || (mbwom.world && mbwom.world.fileInfo && mbwom.world.fileInfo.name) || 'World').replace(/\.mbw$/i, '').trim().slice(0, 60) || 'World'; } catch (e) { return 'World'; } }
    let creating = null;                                   // (un solo grupo aunque entren dos a la vez)
    function ensureWorldGroup() {
        const d = db(), uid = me(); if (!d || !uid || typeof mbwom === 'undefined' || !mbwom.world) return Promise.resolve(null);
        const w = mbwom.world;
        let gid = w.mbweGroupId;
        if (window.mbwIsGroup(gid)) {
            // el id está guardado en el mundo: si el grupo no existe en la base de datos (no se pudo crear), se crea ahora
            return d.ref(window.mbwGroupRef(gid) + '/created').once('value').then(function (s) { return s.exists() ? gid : makeGroup(gid); }).catch(function () { return gid; });
        }
        if (creating) return creating;
        gid = 'g_' + uid.replace(/[^A-Za-z0-9]/g, '').slice(0, 20) + '_' + Date.now().toString(36);
        creating = makeGroup(gid).then(function (g) {
            creating = null;
            if (g) { w.mbweGroupId = g; if (typeof window.markWorldUnsaved === 'function') { try { window.markWorldUnsaved(); } catch (e) { /* nada */ } } }
            return g;
        }, function (e) { creating = null; throw e; });
        return creating;
    }
    function makeGroup(gid) {
        const d = db(), uid = me();
        const name = '🌍 ' + worldName(), mem = {}; mem[uid] = myName();
        return d.ref(window.mbwGroupRef(gid)).set({ name: name, owner: uid, created: TS(), members: mem }).then(function () {
            memberCache[gid] = mem;
            systemMsg(gid, 'created', { world: worldName() }, 'Group created');
            return gid;
        });
    }
    // (anfitrión) entró alguien: al grupo del mundo (y se avisa a la sala cuál es, para su burbuja)
    window.mbwWorldGroupJoin = function (uid, name) {
        if (!uid || uid === me()) return;
        ensureWorldGroup().then(function (gid) {
            if (!gid) return;
            const d = db();
            return d.ref(window.mbwGroupRef(gid) + '/members/' + uid).once('value').then(function (s) {
                const isNew = !s.exists();
                return d.ref(window.mbwGroupRef(gid) + '/members/' + uid).set(String(name || 'Player')).then(function () {
                    delete memberCache[gid];
                    if (isNew) systemMsg(gid, 'joined', { name: String(name || 'Player') }, String(name || 'Player') + ' joined');
                    else return groupInfo(gid).then(function (g) { d.ref('user_chats/' + uid + '/' + gid).update({ isGroup: true, name: (g && g.name) || 'Group', pfp: GROUP_PFP }); });
                });
            }).then(function () {
                pinBubble(gid);
                if (typeof enviarMensajeEnRed === 'function') { try { enviarMensajeEnRed({ tipo: 'grupo_mundo', gid: gid }); } catch (e) { /* nada */ } }
            });
        }).catch(function (e) { console.warn('world group', e); });
    };
    // (anfitrión) un invitado pregunta cuál es el grupo (no le llegó el aviso): se le vuelve a mandar (y se le agrega si faltaba)
    window.mbwWorldGroupAsk = function (uid, name) {
        if (uid) return window.mbwWorldGroupJoin(uid, name);
        ensureWorldGroup().then(function (gid) { if (gid && typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'grupo_mundo', gid: gid }); });
    };
    // (invitado) si a los pocos segundos de entrar no me llegó el grupo, lo pido (hasta 3 veces)
    let askN = 0, inSince = 0;
    setInterval(function () {
        try {
            const mp = typeof isMultiplayer !== 'undefined' && isMultiplayer, host = typeof isHost !== 'undefined' && isHost;
            if (!mp || host) { inSince = 0; askN = 0; return; }
            if (!inSince) { inSince = Date.now(); return; }
            if (pinnedGid || askN >= 3 || Date.now() - inSince < 8000 * (askN + 1)) return;
            askN++;
            if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'grupo_pedir', uid: me(), name: myName() });
        } catch (e) { /* nada */ }
    }, 2000);
    // (anfitrión) alguien se fue; si ya no queda nadie más, ese fue el último
    window.mbwWorldGroupLeft = function (uid, name, nobodyLeft) {
        const gid = (typeof mbwom !== 'undefined' && mbwom.world) ? mbwom.world.mbweGroupId : null;
        if (!window.mbwIsGroup(gid)) return;
        systemMsg(gid, 'left', { name: String(name || 'Player') }, String(name || 'Player') + ' left');
        const d = db(); if (d) d.ref(window.mbwGroupRef(gid) + '/lastLeft').set({ uid: uid || '', name: String(name || 'Player'), at: TS() });
        if (nobodyLeft) systemMsg(gid, 'last', { name: String(name || 'Player') }, String(name || 'Player') + ' was the last one');
    };
    // (anfitrión) cierra la sala: él es el último en irse
    window.mbwWorldGroupClosing = function () {
        const gid = (typeof mbwom !== 'undefined' && mbwom.world) ? mbwom.world.mbweGroupId : null;
        if (!window.mbwIsGroup(gid)) return;
        const n = myName();
        systemMsg(gid, 'left', { name: n }, n + ' left');
        systemMsg(gid, 'last', { name: n }, n + ' was the last one');
        const d = db(); if (d) d.ref(window.mbwGroupRef(gid) + '/lastLeft').set({ uid: me() || '', name: n, at: TS() });
        unpinBubble();
    };
    // 🫧 la burbuja fija del grupo del mundo (mientras estás en la sala)
    let pinnedGid = null;
    function pinBubble(gid) {
        if (!window.mbwChatHead || !gid) return;
        pinnedGid = gid;
        groupInfo(gid).then(function (g) { window.mbwChatHead.pin(gid, (g && g.name) || T('grp_world', 'World group'), GROUP_PFP, true); });
    }
    function unpinBubble() { if (pinnedGid && window.mbwChatHead) window.mbwChatHead.unpin(pinnedGid, true); pinnedGid = null; }
    window.mbwWorldGroupBubble = pinBubble;
    window.mbwWorldGroupUnbubble = unpinBubble;
    window.mbwWorldGroupId = function () { return pinnedGid; };
    // al salir de la sala, la burbuja fija se quita
    setInterval(function () { try { if (pinnedGid && !(typeof isMultiplayer !== 'undefined' && isMultiplayer)) unpinBubble(); } catch (e) { /* nada */ } }, 2000);

    // ------------------------------------------------------------------ 📌 fijar mensajes
    window.mbwPinToggle = function (chatId, key, on) {
        const d = db(); if (!d || !chatId || !key) return Promise.resolve();
        return d.ref('private_chats/' + chatId + '/' + key).update(on ? { pinned: true, pinnedBy: myName(), pinnedAt: TS() } : { pinned: null, pinnedBy: null, pinnedAt: null });
    };
    window.mbwPinnedList = function (chatId) {
        const d = db(); if (!d || !chatId) return Promise.resolve([]);
        return d.ref('private_chats/' + chatId).once('value').then(function (s) {
            const out = []; s.forEach(function (c) { const v = c.val(); if (v && v.pinned && !v.isDeleted) out.push({ key: c.key, msg: v }); });
            return out.sort(function (a, b) { return (Number(b.msg.pinnedAt) || 0) - (Number(a.msg.pinnedAt) || 0); });
        });
    };
    window.mbwShowPinned = function (chatId, anchor, onPick) {
        let box = document.getElementById('dc-pins');
        if (box) { box.remove(); return; }
        box = el('div', 'dc-pins'); box.id = 'dc-pins';
        box.appendChild(el('div', 'dc-pins-head', '📌 ' + T('dm_pinned', 'Pinned messages')));
        const list = el('div', 'dc-pins-list'); list.appendChild(el('div', 'dc-pins-empty', T('dm_loading', 'Loading…'))); box.appendChild(list);
        const x = el('button', 'dc-pins-x', '✕'); x.type = 'button'; x.addEventListener('click', function () { box.remove(); }); box.appendChild(x);
        document.body.appendChild(box);
        try { const r = anchor.getBoundingClientRect(); box.style.top = (r.bottom + 6) + 'px'; box.style.left = Math.max(8, Math.min(window.innerWidth - 340, r.right - 330)) + 'px'; } catch (e) { /* nada */ }
        window.mbwPinnedList(chatId).then(function (items) {
            list.textContent = '';
            if (!items.length) { list.appendChild(el('div', 'dc-pins-empty', T('dm_no_pins', 'No pinned messages yet. Right-click a message → Pin.'))); return; }
            items.forEach(function (it) {
                const row = el('div', 'dc-pin-row');
                row.appendChild(el('div', 'dc-pin-who', (it.msg.system ? 'System' : (it.msg.senderName || '?')) + ' · ' + new Date(Number(it.msg.timestamp) || Date.now()).toLocaleDateString()));
                row.appendChild(el('div', 'dc-pin-text', it.msg.system ? window.mbwSystemText(it.msg) : String(it.msg.text || '')));
                const un = el('button', 'dc-pin-un', T('dm_unpin', 'Unpin')); un.type = 'button';
                un.addEventListener('click', function (e) { e.stopPropagation(); window.mbwPinToggle(chatId, it.key, false).then(function () { row.remove(); }); });
                row.appendChild(un);
                row.addEventListener('click', function () { box.remove(); if (typeof onPick === 'function') onPick(it.key); });
                list.appendChild(row);
            });
        });
    };

    // ------------------------------------------------------------------ 🧵 hilos
    const threadPath = function (chatId, key) { return chatId + '__t__' + key; };
    window.mbwThreadCreate = function (chatId, key, msg) {
        const d = db(); if (!d || !chatId || !key) return;
        const def = String((msg && msg.text) || '').replace(/\s+/g, ' ').slice(0, 40) || T('dm_thread', 'Thread');
        askName(T('dm_thread_name', 'Thread name:'), def, function (name) {
            const nm = String(name).trim().slice(0, 60) || def;
            d.ref('private_chats/' + chatId + '/' + key + '/thread').set({ name: nm, count: 0, by: myName(), created: TS() }).then(function () { window.mbwThreadOpen(chatId, key); });
        });
    };
    // una ventanita para escribir el nombre del hilo (window.prompt no funciona en la app de PC)
    function askName(label, def, done) {
        const old = document.getElementById('dc-ask'); if (old) old.remove();
        const bg = el('div', 'dc-ask-bg'); bg.id = 'dc-ask';
        const box = el('form', 'dc-ask');
        box.appendChild(el('div', 'dc-ask-title', '🧵 ' + label));
        const inp = el('input', 'dc-ask-in'); inp.type = 'text'; inp.maxLength = 60; inp.value = def; box.appendChild(inp);
        const row = el('div', 'dc-ask-row');
        const no = el('button', 'dc-ask-no', T('cancel', 'Cancel')); no.type = 'button';
        const ok = el('button', 'dc-ask-ok', T('dm_create_thread', 'Create thread')); ok.type = 'submit';
        row.appendChild(no); row.appendChild(ok); box.appendChild(row); bg.appendChild(box);
        document.body.appendChild(bg);
        ['keydown', 'keyup', 'keypress'].forEach(function (n) { inp.addEventListener(n, function (e) { e.stopPropagation(); if (n === 'keydown' && e.key === 'Escape') bg.remove(); }); });
        no.addEventListener('click', function () { bg.remove(); });
        bg.addEventListener('mousedown', function (e) { if (e.target === bg) bg.remove(); });
        box.addEventListener('submit', function (e) { e.preventDefault(); bg.remove(); done(inp.value); });
        setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { /* nada */ } }, 20);
    }
    let thr = null;
    window.mbwThreadOpen = function (chatId, key) {
        const d = db(); if (!d || !chatId || !key) return;
        window.mbwThreadClose();
        const host = document.getElementById('full-chat-active') || document.body;
        const p = el('div', 'dc-thread'); p.id = 'dc-thread';
        const head = el('div', 'dc-thread-head'); const ttl = el('span', 'dc-thread-title', '🧵 …'); head.appendChild(ttl);
        const x = el('button', 'dc-thread-x', '✕'); x.type = 'button'; x.addEventListener('click', window.mbwThreadClose); head.appendChild(x);
        const origin = el('div', 'dc-thread-origin');
        const list = el('div', 'dc-thread-list');
        const form = el('form', 'dc-thread-form'); const inp = el('input', 'dc-thread-in'); inp.type = 'text'; inp.maxLength = 1000; inp.placeholder = T('dm_thread_ph', 'Reply in the thread…');
        const send = el('button', 'dc-thread-send', '➤'); send.type = 'submit'; form.appendChild(inp); form.appendChild(send);
        [head, origin, list, form].forEach(function (n) { p.appendChild(n); });
        host.appendChild(p);
        ['keydown', 'keyup', 'keypress'].forEach(function (n) { inp.addEventListener(n, function (e) { e.stopPropagation(); }); });
        const parentRef = d.ref('private_chats/' + chatId + '/' + key);
        parentRef.once('value').then(function (s) {
            const m = s.val() || {};
            ttl.textContent = '🧵 ' + String((m.thread && m.thread.name) || T('dm_thread', 'Thread'));
            origin.textContent = (m.senderName || '?') + ': ' + String(m.text || '');
        });
        const ref = d.ref('private_chats/' + threadPath(chatId, key));
        const onAdd = function (snap) {
            const m = snap.val() || {};
            const row = el('div', 'dc-thread-msg');
            const h = el('div', 'dc-thread-who'); h.appendChild(el('b', null, String(m.senderName || '?'))); h.appendChild(el('span', null, ' ' + new Date(Number(m.timestamp) || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })));
            row.appendChild(h);
            const t = el('div', 'dc-thread-text'); if (typeof dmFillText === 'function') dmFillText(t, String(m.text || '')); else t.textContent = String(m.text || '');
            row.appendChild(t);
            list.appendChild(row); list.scrollTop = list.scrollHeight;
        };
        ref.on('child_added', onAdd);
        thr = { ref: ref, cb: onAdd, el: p, chatId: chatId, key: key };
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const text = inp.value.trim(); if (!text) return;
            inp.value = '';
            ref.push({ sender: me(), senderName: myName(), text: text, timestamp: TS() });
            parentRef.child('thread').update({ count: INC(1), last: TS(), lastBy: myName() });
        });
        setTimeout(function () { try { inp.focus(); } catch (e) { /* nada */ } }, 30);
    };
    window.mbwThreadClose = function () { if (thr) { try { thr.ref.off('child_added', thr.cb); } catch (e) { /* nada */ } if (thr.el) thr.el.remove(); thr = null; } };
    window.mbwThreadState = function () { return thr ? { chatId: thr.chatId, key: thr.key } : null; };
})();
