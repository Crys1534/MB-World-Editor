// =====================================================================
// 💬 MINI CHAT (como las burbujas de Messenger)
// =====================================================================
// Al tocar la burbuja redonda de una persona (scripts/ui-modes.js → mbwChatHead) se abre esta mini ventana flotante, abajo a la
// derecha, encima de lo que estés haciendo: se leen los últimos mensajes y se puede contestar sin abrir el menú Multiplayer.
//   · "—" (o un clic en la cabecera, o en su burbuja) la minimiza: vuelve a ser solo la burbuja con la foto.
//   · "✕" cierra el chat (la burbuja se va). "⤢" lo abre en el chat grande.
//   · Mientras la ventana está abierta y a la vista, los mensajes que llegan se marcan como leídos.
//   · Enter envía; Shift+Enter hace un salto de línea. El texto a medias se guarda por chat mientras la página está abierta.
// Usa los mismos datos que el chat grande (private_chats/, user_chats/, typing_status/, users_status/) y envía con
// window.dmSendTo (multiplayer.js), así todo lo que se manda desde aquí es idéntico a lo que se manda desde el chat grande.
// Todo el texto que llega de otras personas entra como TEXTO (textContent / dmFillText): un mensaje raro no puede ejecutar nada.
// =====================================================================
(function () {
    'use strict';

    const MAX_MSGS = 40;                                   // mensajes que se ven (los últimos); para más, el chat grande
    const DEFAULT_PFP = 'assets/default pfp.png';
    const T = function (k, fb, vars) {
        if (typeof window.tmsg === 'function') return window.tmsg(k, fb, vars || null);
        let s = fb; if (vars) Object.keys(vars).forEach(function (n) { s = s.replace('{' + n + '}', vars[n]); }); return s;
    };
    function myUid() { try { return localStorage.getItem('mbw_uid'); } catch (e) { return null; } }
    function db() { try { return (typeof database !== 'undefined' && database) ? database : null; } catch (e) { return null; } }
    function safePfp(u) { u = String(u || ''); return /^(assets\/|data:image\/|https:\/\/)/.test(u) ? u : DEFAULT_PFP; }
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function focusHidden() { return typeof window.mbwFocusModeActive === 'function' && window.mbwFocusModeActive(); }

    const mc = {
        root: null, pfp: null, name: null, status: null, msgs: null, typing: null, input: null, send: null, note: null,
        uid: null, who: '', face: '', chatId: null, open: false, token: 0,
        rows: new Map(),                                   // key -> { m, row }
        subs: [],                                          // [ref, evento, función] para apagarlos al cerrar
        drafts: {}, typingSent: 0, typingTimer: null, readTimer: null, lastStatus: null, theyType: false, focusAtOpen: false
    };

    // ------------------------------------------------------------------ la ventana
    function build() {
        if (mc.root) return;
        const r = el('div', 'mc'); r.id = 'mini-chat'; r.setAttribute('role', 'dialog');
        const head = el('div', 'mc-head');
        const pfp = el('img', 'mc-pfp'); pfp.alt = ''; pfp.onerror = function () { pfp.onerror = null; pfp.src = DEFAULT_PFP; };
        const who = el('div', 'mc-who');
        const name = el('div', 'mc-name'); const status = el('div', 'mc-status');
        who.appendChild(name); who.appendChild(status);
        const mk = function (cls, txt, fn) { const b = el('button', 'mc-btn ' + cls, txt); b.type = 'button'; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); return b; };
        const full = mk('mc-full', '⤢', openFull);
        const min = mk('mc-min', '—', minimize);
        const x = mk('mc-close', '✕', function () { close(); });
        head.appendChild(pfp); head.appendChild(who); head.appendChild(full); head.appendChild(min); head.appendChild(x);
        head.addEventListener('click', minimize);          // como en Messenger: tocar la cabecera la minimiza
        const msgs = el('div', 'mc-msgs'); msgs.setAttribute('role', 'log'); msgs.setAttribute('aria-live', 'polite');
        const typing = el('div', 'mc-typing');
        const note = el('div', 'mc-note');
        const comp = el('div', 'mc-compose');
        const input = el('textarea', 'mc-in'); input.rows = 1; input.maxLength = 1000; input.spellcheck = true;
        const send = el('button', 'mc-send', '➤'); send.type = 'button';
        comp.appendChild(input); comp.appendChild(send);
        r.appendChild(head); r.appendChild(msgs); r.appendChild(typing); r.appendChild(note); r.appendChild(comp);
        document.body.appendChild(r);
        input.addEventListener('keydown', function (e) {
            e.stopPropagation();                           // las teclas son para escribir, no atajos del editor
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendNow(); }
            else if (e.key === 'Escape') { e.preventDefault(); minimize(); }
        });
        input.addEventListener('keyup', function (e) { e.stopPropagation(); });
        input.addEventListener('input', function () { autoSize(); updateSendBtn(); if (input.value.trim()) typingPing(); else stopTyping(); });
        send.addEventListener('click', sendNow);
        msgs.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });   // la rueda no hace zoom en el mapa
        r.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        mc.root = r; mc.pfp = pfp; mc.name = name; mc.status = status; mc.msgs = msgs; mc.typing = typing; mc.input = input; mc.send = send; mc.note = note;
        mc.btnFull = full; mc.btnMin = min; mc.btnClose = x;
        texts();
    }
    function texts() {
        if (!mc.root) return;
        mc.root.setAttribute('aria-label', T('mc_title', 'Chat with {name}', { name: mc.who || '' }));
        mc.btnFull.title = T('mc_full', 'Open in the big chat'); mc.btnFull.setAttribute('aria-label', mc.btnFull.title);
        mc.btnMin.title = T('mc_min', 'Minimize'); mc.btnMin.setAttribute('aria-label', mc.btnMin.title);
        mc.btnClose.title = T('mc_close', 'Close chat'); mc.btnClose.setAttribute('aria-label', mc.btnClose.title);
        mc.input.placeholder = T('mc_placeholder', 'Write a message…');
        mc.send.title = T('mc_send', 'Send'); mc.send.setAttribute('aria-label', mc.send.title);
        paintStatus();
        paintTyping();
        mc.rows.forEach(function (e, key) { const n = buildRow(key, e.m); e.row.replaceWith(n); e.row = n; });
        paintSeen();
        paintNote();
    }
    function autoSize() { const i = mc.input; i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 96) + 'px'; }
    function updateSendBtn() { mc.send.disabled = !mc.input.value.trim() || isBlockedNow(); }
    function isBlockedNow() { return !!(mc.uid && typeof window.isBlocked === 'function' && window.isBlocked(mc.uid)); }
    function paintNote() {
        const b = isBlockedNow();
        mc.note.textContent = b ? T('mc_blocked', 'You blocked this person. Unblock them to write.') : '';
        mc.note.style.display = b ? '' : 'none';
        mc.input.disabled = b;
        updateSendBtn();
    }
    // En Zen / pantalla completa la ventana se esconde... salvo que la hayas abierto ahí mismo (desde el globito de aviso)
    function visibleNow() { return mc.open && !!mc.uid && (!focusHidden() || mc.focusAtOpen); }
    function render() {
        if (!focusHidden()) mc.focusAtOpen = false;
        if (!mc.root) return;
        const v = visibleNow();
        mc.root.classList.toggle('show', v);
        document.body.classList.toggle('has-mini-chat', v);
    }

    // ------------------------------------------------------------------ mensajes
    function fmtTime(ts) {
        const n = Number(ts); if (!(n > 0)) return '';
        try { return new Date(n).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
    }
    function buildRow(key, m) {
        const me = myUid();
        const mine = m.sender === me;
        const row = el('div', 'mc-row ' + (mine ? 'me' : 'them')); row.dataset.key = key;
        const b = el('div', 'mc-bubble');
        if (m.replyTo && typeof m.replyTo === 'object' && !m.isDeleted) {
            const q = el('div', 'mc-quote');
            q.textContent = String(m.replyTo.senderName || '?').slice(0, 30) + ': ' + String(m.replyTo.text || '').slice(0, 90);
            b.appendChild(q);
        }
        const t = el('div', 'mc-text');
        if (m.isDeleted) { t.classList.add('deleted'); t.textContent = T('mc_deleted', 'Message deleted'); }
        else if (typeof dmFillText === 'function') { try { dmFillText(t, String(m.text == null ? '' : m.text)); } catch (e) { t.textContent = String(m.text == null ? '' : m.text); } }
        else t.textContent = String(m.text == null ? '' : m.text);
        b.appendChild(t);
        if (m.isEdited && !m.isDeleted) b.appendChild(el('span', 'mc-edited', T('mc_edited', '(edited)')));
        b.title = fmtTime(m.timestamp);
        row.appendChild(b);
        return row;
    }
    function nearBottom() { const b = mc.msgs; return b.scrollHeight - b.scrollTop - b.clientHeight < 60; }
    function toBottom() { mc.msgs.scrollTop = mc.msgs.scrollHeight; }
    function addRow(key, m) {
        if (!m || typeof m !== 'object' || mc.rows.has(key)) { if (m && mc.rows.has(key)) changeRow(key, m); return; }
        const stick = nearBottom() || m.sender === myUid();
        const row = buildRow(key, m);
        // en orden por clave (las claves de Firebase van en orden de llegada)
        const firstBigger = Array.from(mc.rows.keys()).filter(function (k) { return k > key; }).sort()[0];
        if (firstBigger) mc.msgs.insertBefore(row, mc.rows.get(firstBigger).row);
        else mc.msgs.appendChild(row);
        mc.rows.set(key, { m: m, row: row });
        // nunca más de MAX_MSGS en pantalla: se quitan los más viejos
        if (mc.rows.size > MAX_MSGS) {
            const keys = Array.from(mc.rows.keys()).sort();
            keys.slice(0, mc.rows.size - MAX_MSGS).forEach(function (k) { const e = mc.rows.get(k); if (e) e.row.remove(); mc.rows.delete(k); });
        }
        const empty = mc.msgs.querySelector('.mc-empty'); if (empty) empty.remove();
        paintSeen();
        if (stick) toBottom();
        if (m.sender !== myUid()) scheduleRead();
    }
    function changeRow(key, m) {
        const e = mc.rows.get(key);
        if (!e || !m) return;
        e.m = m;
        const n = buildRow(key, m); e.row.replaceWith(n); e.row = n;
        paintSeen();
    }
    // "Visto" debajo de mi último mensaje cuando la otra persona ya lo leyó
    function paintSeen() {
        const old = mc.msgs.querySelector('.mc-seen'); if (old) old.remove();
        const me = myUid();
        const keys = Array.from(mc.rows.keys()).sort();
        let last = null;
        for (let i = keys.length - 1; i >= 0; i--) { const e = mc.rows.get(keys[i]); if (e.m.sender === me) { last = e; break; } if (e.m.sender !== me) break; }
        if (last && last.m.status === 'read' && !last.m.isDeleted) last.row.appendChild(el('div', 'mc-seen', T('mc_seen', 'Seen')));
    }
    function paintStatus() {
        const s = mc.lastStatus;
        if (!mc.status) return;
        if (s && s.isOnline) { mc.status.textContent = T('dm_active_now', 'Active now'); mc.status.classList.add('on'); }
        else {
            mc.status.classList.remove('on');
            mc.status.textContent = (s && s.lastSeen && typeof window.formatTimeAgo === 'function') ? window.formatTimeAgo(s.lastSeen) : '';
        }
    }
    function paintTyping() {
        if (!mc.typing) return;
        mc.typing.textContent = mc.theyType ? T('mc_typing', '{name} is typing…', { name: mc.who }) : '';
        mc.typing.classList.toggle('on', !!mc.theyType);
    }

    // ------------------------------------------------------------------ escuchar a Firebase (solo el chat abierto en la mini ventana)
    function listen(ref, evt, fn) { ref.on(evt, fn); mc.subs.push([ref, evt, fn]); }
    function detach() {
        mc.subs.forEach(function (s) { try { s[0].off(s[1], s[2]); } catch (e) { /* ya no estaba */ } });
        mc.subs = [];
        mc.token++;
    }
    function attach() {
        const d = db(); if (!d || !mc.chatId) return;
        const token = ++mc.token;
        const q = d.ref('private_chats/' + mc.chatId).orderByKey().limitToLast(MAX_MSGS);
        listen(q, 'child_added', function (snap) { if (token === mc.token) addRow(snap.key, snap.val()); });
        listen(q, 'child_changed', function (snap) { if (token === mc.token) changeRow(snap.key, snap.val()); });
        listen(d.ref('typing_status/' + mc.chatId + '/' + mc.uid), 'value', function (snap) { if (token !== mc.token) return; mc.theyType = snap.val() === true; paintTyping(); if (mc.theyType && nearBottom()) toBottom(); });
        listen(d.ref('users_status/' + mc.uid), 'value', function (snap) { if (token !== mc.token) return; mc.lastStatus = snap.val() || null; paintStatus(); });
        // si el chat está vacío, se dice
        q.once('value').then(function (snap) {
            if (token !== mc.token) return;
            if (!snap.exists() && !mc.rows.size && !mc.msgs.querySelector('.mc-empty')) mc.msgs.appendChild(el('div', 'mc-empty', T('mc_empty', 'No messages yet. Say hi!')));
        }).catch(function () { /* sin conexión */ });
    }

    // ------------------------------------------------------------------ leído
    function scheduleRead() { clearTimeout(mc.readTimer); mc.readTimer = setTimeout(markRead, 60); }
    function markRead() {
        const d = db(), me = myUid();
        if (!d || !me || !visibleNow() || document.visibilityState !== 'visible') return;
        const upd = {}; let n = 0;
        mc.rows.forEach(function (e, key) {
            if (e.m.sender !== me && e.m.status !== 'read' && !e.m.isDeleted) {
                upd[key + '/status'] = 'read';
                upd[key + '/readAt'] = firebase.database.ServerValue.TIMESTAMP;
                n++;
            }
        });
        if (n) d.ref('private_chats/' + mc.chatId).update(upd).catch(function () { /* sin conexión */ });
        const ref = d.ref('user_chats/' + me + '/' + mc.uid);
        ref.once('value').then(function (s) { if (s.exists() && s.val() && s.val().unreadCount) ref.update({ unreadCount: 0 }); }).catch(function () { /* sin conexión */ });
    }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') scheduleRead(); });

    // ------------------------------------------------------------------ "está escribiendo…" (lo que aviso yo)
    function typingPing() {
        const d = db(), me = myUid(); if (!d || !me || !mc.chatId) return;
        const now = Date.now();
        if (now - mc.typingSent > 2500) {
            const ref = d.ref('typing_status/' + mc.chatId + '/' + me);
            try { ref.set(true); ref.onDisconnect().set(false); } catch (e) { /* sin conexión */ }
            mc.typingSent = now; mc.typingChat = mc.chatId;
        }
        clearTimeout(mc.typingTimer);
        mc.typingTimer = setTimeout(stopTyping, 3000);
    }
    function stopTyping() {
        clearTimeout(mc.typingTimer);
        const d = db(), me = myUid();
        if (d && me && mc.typingSent && mc.typingChat) { try { d.ref('typing_status/' + mc.typingChat + '/' + me).set(false); } catch (e) { /* nada */ } }
        mc.typingSent = 0;
    }

    // ------------------------------------------------------------------ enviar
    function sendNow() {
        const text = mc.input.value.trim();
        if (!text || !mc.uid) return;
        if (typeof window.dmSendTo !== 'function') return;
        const ok = window.dmSendTo({ uid: mc.uid, name: mc.who, pfp: mc.face }, text);
        if (!ok) return;
        mc.input.value = '';
        if (mc.chatId) delete mc.drafts[mc.chatId];
        autoSize(); updateSendBtn(); stopTyping();
        mc.input.focus();
    }

    // ------------------------------------------------------------------ abrir / minimizar / cerrar
    function open(uid, name, pfp) {
        const me = myUid();
        if (!uid || !me || !db()) return false;
        if (typeof window.isBlocked === 'function' && window.isBlocked(uid)) {
            if (typeof window.mpToast === 'function') window.mpToast('🚫', T('mc_blocked', 'You blocked this person. Unblock them to write.'));
            return false;
        }
        const inf = (typeof window.resolveChatInfo === 'function') ? window.resolveChatInfo(uid, { name: name, pfp: pfp }) : { name: name || '?', pfp: pfp };
        build();
        if (mc.uid !== uid) {
            if (mc.chatId) { mc.drafts[mc.chatId] = mc.input.value; stopTyping(); }
            detach();
            mc.uid = uid;
            mc.chatId = me < uid ? me + '_' + uid : uid + '_' + me;
            mc.rows.clear(); mc.msgs.textContent = '';
            mc.lastStatus = null; mc.theyType = false;
            mc.input.value = mc.drafts[mc.chatId] || '';
            attach();
        }
        mc.who = String(inf.name || '?'); mc.face = inf.pfp;
        mc.name.textContent = mc.who;
        mc.pfp.src = safePfp(inf.pfp);
        mc.open = true;
        mc.focusAtOpen = focusHidden();
        texts();
        autoSize();
        render();
        if (window.mbwChatHead) { window.mbwChatHead.pin(uid, mc.who, inf.pfp); window.mbwChatHead.setActive(uid); }
        setTimeout(function () { toBottom(); try { mc.input.focus(); } catch (e) { /* sin foco */ } }, 0);
        scheduleRead();
        return true;
    }
    function minimize() {
        if (!mc.root || !mc.open) return;
        mc.open = false;
        stopTyping();
        render();
        if (window.mbwChatHead) window.mbwChatHead.setActive(null);
    }
    function close(fromHead) {
        if (!mc.uid) return;
        const uid = mc.uid;
        if (mc.chatId) mc.drafts[mc.chatId] = mc.input.value;
        stopTyping();
        detach();
        mc.open = false; mc.uid = null; mc.chatId = null;
        mc.rows.clear(); if (mc.msgs) mc.msgs.textContent = '';
        render();
        if (window.mbwChatHead && !fromHead) window.mbwChatHead.unpin(uid);
        if (window.mbwChatHead) window.mbwChatHead.setActive(null);
    }
    function openFull() {
        const u = { uid: mc.uid, name: mc.who, pfp: mc.face };
        if (!u.uid) return;
        close();
        if (typeof window.openFileMenu === 'function') window.openFileMenu('multiplayer');
        setTimeout(function () {
            if (typeof window.openMpSidebar === 'function') window.openMpSidebar('chats');
            setTimeout(function () { if (typeof window.openPrivateChat === 'function') window.openPrivateChat(u.uid, u.name, u.pfp); }, 60);
        }, 100);
    }

    // La ✕ de la burbuja cierra también su mini ventana
    if (window.mbwChatHead && typeof window.mbwChatHead.onDismiss === 'function') {
        window.mbwChatHead.onDismiss(function (uid) { if (mc.uid === uid) close(true); });
    }
    // Zen / pantalla completa: la ventana se esconde (y vuelve al salir)
    try { new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* sin observador */ }
    document.addEventListener('fullscreenchange', render);

    window.mbwMiniChat = {
        open: open,
        minimize: minimize,
        close: function () { close(); },
        refresh: function () { render(); if (mc.root && mc.uid) paintNote(); },
        isOpenFor: function (uid) { return !!uid && mc.uid === uid; },
        // ¿La persona está viendo ahora mismo este chat en la mini ventana? (abierta, no minimizada, pestaña a la vista)
        isViewing: function (uid) { return !!uid && mc.uid === uid && visibleNow() && document.visibilityState === 'visible'; },
        markRead: scheduleRead,
        state: function () { return { uid: mc.uid, open: mc.open, shown: !!(mc.root && mc.root.classList.contains('show')), msgs: mc.rows.size, chatId: mc.chatId }; }
    };
    window.miniChatOnLanguageChanged = function () { texts(); };
})();
