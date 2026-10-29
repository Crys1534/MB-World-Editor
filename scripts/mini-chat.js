// =====================================================================
// 💬 MINI CHAT (como las burbujas de Messenger)
// =====================================================================
// Al tocar la burbuja redonda de una persona (scripts/ui-modes.js → mbwChatHead) se abre esta mini ventana flotante, abajo a la
// derecha, encima de lo que estés haciendo. Tiene lo mismo que el chat grande:
//   · mensajes con separadores por día, "Visto / Enviado", "está escribiendo…", activo ahora, cargar mensajes anteriores
//   · al pasar el mouse por un mensaje: reaccionar 😀, responder ↩, editar ✎ (los míos) y ⋯ (más)
//   · clic derecho en un mensaje: reacciones rápidas (+ el selector completo), responder, editar, copiar, eliminar (los míos)
//   · reacciones con emojis y con los emotes propios (:minifrank:), VARIAS por persona; tocar una reacción la pone o la quita
//   · caja de escribir con emojis/emotes, barra de "Respondiendo a…" / "Editando mensaje" (Esc cancela), ↑ edita el último mío
//   · menú ⋮: silenciar, archivar, añadir/eliminar amigo, bloquear
//   · "—" (o un clic en la cabecera, o en su burbuja) la minimiza: vuelve a ser solo la burbuja con la foto. "✕" cierra. "⤢" abre el chat grande.
// Usa los mismos datos que el chat grande (private_chats/, user_chats/, typing_status/, users_status/), envía con window.dmSendTo
// (multiplayer.js) y reacciona con window.toggleReaction (chat-dm.js), así todo queda guardado exactamente igual.
// Todo el texto que llega de otras personas entra como TEXTO (textContent / dmFillText): un mensaje raro no puede ejecutar nada.
// =====================================================================
(function () {
    'use strict';

    const FIRST = 30;                                      // mensajes que se bajan al abrir (los últimos)
    const PAGE = 20;                                       // cuántos más con "Cargar mensajes anteriores"
    const GROUP_MS = 7 * 60 * 1000;                        // mensajes seguidos de la misma persona (7 min) van juntitos
    const DELETED_TEXT = '🚫 Este mensaje fue eliminado'; // (el mismo texto que guarda el chat grande)
    const DEFAULT_PFP = 'assets/default pfp.png';
    const T = function (k, fb, vars) {
        if (typeof window.tmsg === 'function') return window.tmsg(k, fb, vars || null);
        let s = fb; if (vars) Object.keys(vars).forEach(function (n) { s = s.replace('{' + n + '}', vars[n]); }); return s;
    };
    const dmt = function (k, fb) { return (typeof dmT === 'function') ? dmT(k, fb) : fb; };
    const ICON = function (name) { try { return (typeof DM_ICONS !== 'undefined' && DM_ICONS[name]) || ''; } catch (e) { return ''; } };
    function myUid() { try { return localStorage.getItem('mbw_uid'); } catch (e) { return null; } }
    function myName() { try { return localStorage.getItem('mbw_username') || 'Player'; } catch (e) { return 'Player'; } }
    function db() { try { return (typeof database !== 'undefined' && database) ? database : null; } catch (e) { return null; } }
    function safePfp(u) { u = String(u || ''); return /^(assets\/|data:image\/|https:\/\/)/.test(u) ? u : DEFAULT_PFP; }
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function focusHidden() { return typeof window.mbwFocusModeActive === 'function' && window.mbwFocusModeActive(); }
    function iconBtn(cls, svgName, fallback, title, fn) {
        const b = el('button', cls); b.type = 'button';
        const svg = ICON(svgName);
        if (svg) b.innerHTML = svg; else b.textContent = fallback;   // (svg = constante fija de chat-dm.js, no viene de usuarios)
        if (title) { b.title = title; b.setAttribute('aria-label', title); }
        b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); });
        return b;
    }
    function menuOpen() { const m = document.getElementById('chat-context-menu'); return !!(m && m.style.display !== 'none' && m.offsetWidth > 0); }
    function closeMenu() { const m = document.getElementById('chat-context-menu'); if (m) m.style.display = 'none'; }

    const mc = {
        root: null, uid: null, who: '', face: '', chatId: null, open: false, token: 0, loaded: false,
        msgs: new Map(),                                   // key -> mensaje (los que se ven)
        subs: [],                                          // [ref, evento, función] para apagarlos al cerrar
        hasMore: false, loadingOlder: false,
        reply: null,                                       // { msgId, senderName, text } al responder
        edit: null,                                        // clave del mensaje mío que se está editando
        drafts: {}, typingSent: 0, typingTimer: null, typingChat: null, readTimer: null, renderTimer: null, stickNext: false,
        lastStatus: null, theyType: false, focusAtOpen: false
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
        const muted = el('span', 'mc-muted'); muted.innerHTML = ICON('bellOff');
        const menu = iconBtn('mc-btn mc-menu', 'kebab', '⋮', '', openHeadMenu);
        const full = iconBtn('mc-btn mc-full', '', '⤢', '', openFull);
        const min = iconBtn('mc-btn mc-min', '', '—', '', minimize);
        const x = iconBtn('mc-btn mc-close', '', '✕', '', function () { close(); });
        [pfp, who, muted, menu, full, min, x].forEach(function (n) { head.appendChild(n); });
        head.addEventListener('click', minimize);          // como en Messenger: tocar la cabecera la minimiza
        const msgs = el('div', 'mc-msgs'); msgs.setAttribute('role', 'log'); msgs.setAttribute('aria-live', 'polite');
        const typing = el('div', 'mc-typing');
        const note = el('div', 'mc-note');
        const bar = el('div', 'mc-bar'); bar.hidden = true;
        const comp = el('div', 'mc-compose');
        const emoji = iconBtn('mc-emoji', 'emoji', '😀', '', function (b) { window.dmOpenEmojiInsert && window.dmOpenEmojiInsert(b, insertAtCursor); });
        const input = el('textarea', 'mc-in'); input.rows = 1; input.maxLength = 2000; input.spellcheck = true;
        const send = el('button', 'mc-send'); send.type = 'button';
        if (ICON('send')) send.innerHTML = ICON('send'); else send.textContent = '➤';
        comp.appendChild(emoji); comp.appendChild(input); comp.appendChild(send);
        [head, msgs, typing, note, bar, comp].forEach(function (n) { r.appendChild(n); });
        document.body.appendChild(r);
        input.addEventListener('keydown', onKey);
        input.addEventListener('keyup', function (e) { e.stopPropagation(); });
        input.addEventListener('input', function () { autoSize(); updateSendBtn(); if (input.value.trim()) typingPing(); else stopTyping(); });
        send.addEventListener('click', sendNow);
        msgs.addEventListener('wheel', function (e) { e.stopPropagation(); if (e.deltaY < 0 && msgs.scrollTop <= 0) loadOlder(); }, { passive: true });   // la rueda no hace zoom en el mapa
        r.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        Object.assign(mc, { root: r, pfp: pfp, name: name, status: status, mutedEl: muted, msgsEl: msgs, typing: typing, note: note, bar: bar, input: input, send: send,
            btnMenu: menu, btnFull: full, btnMin: min, btnClose: x, btnEmoji: emoji });
        texts();
    }
    function setTip(b, k, fb) { const t = T(k, fb); b.title = t; b.setAttribute('aria-label', t); }
    function texts() {
        if (!mc.root) return;
        mc.root.setAttribute('aria-label', T('mc_title', 'Chat with {name}', { name: mc.who || '' }));
        setTip(mc.btnMenu, 'mc_menu', 'Options');
        setTip(mc.btnFull, 'mc_full', 'Open in the big chat');
        setTip(mc.btnMin, 'mc_min', 'Minimize');
        setTip(mc.btnClose, 'mc_close', 'Close chat');
        setTip(mc.btnEmoji, 'mc_emoji', 'Emojis and emotes');
        setTip(mc.send, 'mc_send', 'Send');
        mc.input.placeholder = T('mc_placeholder', 'Write a message…');
        mc.mutedEl.title = T('mc_muted', 'Muted');
        paintStatus(); paintTyping(); paintNote(); paintBar(); paintMuted();
        if (mc.uid) renderMsgs({ keep: true });
    }
    function autoSize() { const i = mc.input; i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 110) + 'px'; }
    function updateSendBtn() { mc.send.disabled = !mc.input.value.trim() || isBlockedNow(); }
    function isBlockedNow() { return !!(mc.uid && typeof window.isBlocked === 'function' && window.isBlocked(mc.uid)); }
    function paintNote() {
        const b = isBlockedNow();
        mc.note.textContent = b ? T('mc_blocked', 'You blocked this person. Unblock them to write.') : '';
        mc.note.style.display = b ? '' : 'none';
        mc.input.disabled = b;
        updateSendBtn();
    }
    function paintMuted() { if (mc.mutedEl) mc.mutedEl.style.display = (mc.uid && typeof window.isChatMuted === 'function' && window.isChatMuted(mc.uid)) ? '' : 'none'; }
    function insertAtCursor(text) {
        const i = mc.input;
        const s = typeof i.selectionStart === 'number' ? i.selectionStart : i.value.length;
        const e = typeof i.selectionEnd === 'number' ? i.selectionEnd : s;
        i.value = i.value.slice(0, s) + text + i.value.slice(e);
        const pos = s + text.length;
        i.focus(); try { i.setSelectionRange(pos, pos); } catch (err) { /* nada */ }
        i.dispatchEvent(new Event('input'));
    }
    // En Zen / pantalla completa la ventana se esconde... salvo que la hayas abierto ahí mismo (desde el globito de aviso)
    function visibleNow() { return mc.open && !!mc.uid && (!focusHidden() || mc.focusAtOpen); }
    function paintVisibility() {
        if (!focusHidden()) mc.focusAtOpen = false;
        if (!mc.root) return;
        const v = visibleNow();
        mc.root.classList.toggle('show', v);
        document.body.classList.toggle('has-mini-chat', v);
    }

    // ------------------------------------------------------------------ dibujar los mensajes
    function tsOf(m) { const n = Number(m && m.timestamp); return n > 0 ? n : Date.now(); }
    function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
    function dayLabel(ts) { return (typeof dmDayLabel === 'function') ? dmDayLabel(ts) : new Date(ts).toLocaleDateString(); }
    // solo la hora (el día ya lo dicen los separadores "Hoy", "Ayer"...)
    function fmtTime(ts) { try { return (typeof dmTime === 'function') ? dmTime(ts) : new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
    function sortedKeys() { return Array.from(mc.msgs.keys()).sort(); }
    function canGroup(prev, m) {
        if (!prev || m.replyTo) return false;
        if (prev.sender !== m.sender) return false;
        const a = tsOf(prev), b = tsOf(m);
        return dayKey(a) === dayKey(b) && Math.abs(b - a) < GROUP_MS;
    }
    function nameOf(uid) { return uid === myUid() ? myName() : (uid === mc.uid ? mc.who : '?'); }
    function nearBottom() { const b = mc.msgsEl; return b.scrollHeight - b.scrollTop - b.clientHeight < 60; }
    function toBottom() { const b = mc.msgsEl; b.scrollTop = b.scrollHeight; requestAnimationFrame(function () { b.scrollTop = b.scrollHeight; }); }
    function scheduleRender(stick) {
        if (stick) mc.stickNext = true;
        if (mc.renderTimer) return;
        mc.renderTimer = setTimeout(function () { mc.renderTimer = null; const s = mc.stickNext || nearBottom(); mc.stickNext = false; renderMsgs({ stick: s }); }, 0);
    }
    function renderMsgs(opts) {
        opts = opts || {};
        const box = mc.msgsEl;
        if (!box) return;
        const prevH = box.scrollHeight, prevTop = box.scrollTop;
        const stick = opts.keep ? nearBottom() : !!opts.stick;
        box.textContent = '';
        const keys = sortedKeys();
        const me = myUid();
        if (mc.hasMore) {
            const b = el('button', 'mc-older', mc.loadingOlder ? dmt('dm_loading', 'Loading…') : dmt('dm_load_older', 'Load older messages'));
            b.type = 'button'; b.disabled = mc.loadingOlder; b.addEventListener('click', loadOlder);
            box.appendChild(b);
        } else if (!keys.length && mc.loaded) box.appendChild(el('div', 'mc-empty', T('mc_empty', 'No messages yet. Say hi!')));
        let lastMine = null;
        for (let i = keys.length - 1; i >= 0; i--) { const m = mc.msgs.get(keys[i]); if (m.sender === me && !m.isDeleted) { lastMine = keys[i]; break; } }
        let prev = null, lastDay = '';
        keys.forEach(function (k) {
            const m = mc.msgs.get(k);
            const ts = tsOf(m), day = dayKey(ts);
            if (day !== lastDay) { const d = el('div', 'mc-day'); d.appendChild(el('span', null, dayLabel(ts))); box.appendChild(d); lastDay = day; prev = null; }
            box.appendChild(buildRow(k, m, canGroup(prev, m), k === lastMine));
            prev = m;
        });
        if (opts.anchorOlder) box.scrollTop = box.scrollHeight - prevH + prevTop;
        else if (stick) toBottom();
        else box.scrollTop = prevTop;
    }
    function buildRow(k, m, cont, isLastMine) {
        const me = myUid();
        const mine = m.sender === me;
        const row = el('div', 'mc-row ' + (mine ? 'me' : 'them') + (cont ? ' cont' : '') + (m.isDeleted ? ' deleted' : ''));
        row.dataset.key = k;
        const line = el('div', 'mc-line');
        const b = el('div', 'mc-bubble');
        if (m.replyTo && typeof m.replyTo === 'object' && !m.isDeleted) {
            const q = el('div', 'mc-quote');
            q.appendChild(el('span', 'mc-quote-name', String(m.replyTo.senderName || '?').slice(0, 30)));
            const qt = el('span', 'mc-quote-text');
            qt.textContent = String(m.replyTo.text == null ? '' : m.replyTo.text).replace(/\s+/g, ' ').slice(0, 120);
            q.appendChild(qt);
            q.addEventListener('click', function (e) { e.stopPropagation(); jumpTo(m.replyTo.msgId); });
            b.appendChild(q);
        }
        const t = el('div', 'mc-text');
        if (m.isDeleted) { t.classList.add('deleted'); t.textContent = T('mc_deleted', 'Message deleted'); }
        else if (typeof dmFillText === 'function') { try { dmFillText(t, String(m.text == null ? '' : m.text)); } catch (e) { t.textContent = String(m.text == null ? '' : m.text); } }
        else t.textContent = String(m.text == null ? '' : m.text);
        b.appendChild(t);
        if (m.isEdited && !m.isDeleted) b.appendChild(el('span', 'mc-edited', T('mc_edited', '(edited)')));
        b.title = fmtTime(tsOf(m));
        line.appendChild(b);
        if (!m.isDeleted) line.appendChild(buildTools(k, mine));
        row.appendChild(line);
        if (!m.isDeleted && typeof dmReactionList === 'function') {
            const list = dmReactionList(m);
            if (list.length) row.appendChild(buildReactions(k, list));
        }
        if (isLastMine) {
            const read = m.status === 'read';
            row.appendChild(el('div', read ? 'mc-seen' : 'mc-sent', read ? '✓✓ ' + T('mc_seen', 'Seen') : '✓ ' + dmt('dm_sent', 'Sent')));
        }
        row.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); openMsgMenu(e.clientX, e.clientY, k); });
        return row;
    }
    function buildTools(k, mine) {
        const t = el('div', 'mc-tools');
        t.appendChild(iconBtn('mc-tool mc-t-react', 'emoji', '😀', dmt('dm_react', 'Add reaction'), function (b) { window.dmOpenReactPicker(b, reactCtx(k)); }));
        t.appendChild(iconBtn('mc-tool mc-t-reply', 'reply', '↩', dmt('dm_reply', 'Reply'), function () { startReply(k); }));
        if (mine) t.appendChild(iconBtn('mc-tool mc-t-edit', 'edit', '✎', dmt('dm_edit', 'Edit'), function () { startEdit(k); }));
        t.appendChild(iconBtn('mc-tool mc-t-more', 'more', '⋯', dmt('dm_more', 'More'), function (b) { const r = b.getBoundingClientRect(); openMsgMenu(r.left, r.bottom + 4, k); }));
        return t;
    }
    function buildReactions(k, list) {
        const me = myUid();
        const wrap = el('div', 'mc-reacts');
        list.forEach(function (r) {
            const mine = r.uids.indexOf(me) >= 0;
            const b = el('button', 'mc-react' + (mine ? ' mine' : ''));
            b.type = 'button';
            b.title = r.uids.map(nameOf).join(', ');
            b.setAttribute('aria-pressed', mine ? 'true' : 'false');
            b.dataset.emoji = r.emoji;
            if (typeof window.dmReactionGlyph === 'function') b.appendChild(window.dmReactionGlyph(r.emoji, 'mc-react-emoji'));
            else b.appendChild(el('span', 'mc-react-emoji', r.emoji));
            b.appendChild(el('span', 'mc-react-n', String(r.uids.length)));
            b.addEventListener('click', function (e) { e.stopPropagation(); reactCtx(k).toggle(r.emoji); });
            wrap.appendChild(b);
        });
        return wrap;
    }
    function jumpTo(key) {
        const row = key && mc.msgsEl.querySelector('.mc-row[data-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
        if (!row) return;
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.remove('mc-flash'); void row.offsetWidth; row.classList.add('mc-flash');
        setTimeout(function () { row.classList.remove('mc-flash'); }, 1600);
    }

    // ------------------------------------------------------------------ acciones sobre un mensaje
    // Mis reacciones de un mensaje y cómo cambiar una (lo usan los botones, el selector y el menú)
    function reactCtx(k) {
        return {
            mine: function () { const m = mc.msgs.get(k) || {}; return (typeof dmUserReactions === 'function') ? dmUserReactions((m.reactions || {})[myUid()]) : {}; },
            toggle: function (emoji) {
                if (typeof window.toggleReaction !== 'function') return Promise.resolve(null);
                return window.toggleReaction(k, emoji, mc.chatId).then(function (res) { refreshMsg(k); return res; });
            }
        };
    }
    // Vuelve a leer UN mensaje (los anteriores que se cargaron a mano no se escuchan en vivo)
    function refreshMsg(k) {
        const d = db(); if (!d || !mc.chatId || !k) return;
        const token = mc.token;
        d.ref('private_chats/' + mc.chatId + '/' + k).once('value').then(function (s) {
            if (token !== mc.token) return;
            const v = s.val();
            if (v && typeof v === 'object') { mc.msgs.set(k, v); scheduleRender(); }
        }).catch(function () { /* sin conexión */ });
    }
    function openMsgMenu(x, y, k) {
        const m = mc.msgs.get(k);
        if (!m || m.isDeleted || typeof window.dmOpenMenu !== 'function') return;
        const mine = m.sender === myUid();
        window.dmOpenMenu(x, y, function (menu) {
            if (typeof dmAddReactStrip === 'function') { dmAddReactStrip(menu, k, false, reactCtx(k)); menu.appendChild(el('div', 'dc-menu-sep')); }
            window.dmMenuItem(menu, dmt('dm_reply', 'Reply'), ICON('reply'), function () { startReply(k); });
            if (mine) window.dmMenuItem(menu, dmt('dm_edit_msg', 'Edit message'), ICON('edit'), function () { startEdit(k); });
            window.dmMenuItem(menu, dmt('dm_copy', 'Copy text'), ICON('copy'), function () { copyText(k); });
            if (mine) { menu.appendChild(el('div', 'dc-menu-sep')); window.dmMenuItem(menu, dmt('dm_delete', 'Delete message'), ICON('trash'), function () { deleteMsg(k); }, true); }
        });
    }
    function startReply(k) {
        const m = mc.msgs.get(k); if (!m || m.isDeleted) return;
        mc.edit = null;
        mc.reply = { msgId: k, senderName: m.sender === myUid() ? myName() : (mc.who || m.senderName || '?'), text: String(m.text == null ? '' : m.text).slice(0, 200) };
        paintBar(); mc.input.focus();
    }
    function cancelReply() { mc.reply = null; paintBar(); }
    function startEdit(k) {
        const m = mc.msgs.get(k); if (!m || m.isDeleted || m.sender !== myUid()) return;
        if (mc.chatId && !mc.edit) mc.drafts[mc.chatId] = mc.input.value;
        mc.reply = null; mc.edit = k;
        mc.input.value = String(m.text == null ? '' : m.text);
        autoSize(); updateSendBtn(); paintBar();
        mc.input.focus(); try { mc.input.setSelectionRange(mc.input.value.length, mc.input.value.length); } catch (e) { /* nada */ }
    }
    function cancelEdit() {
        mc.edit = null;
        mc.input.value = (mc.chatId && mc.drafts[mc.chatId]) || '';
        autoSize(); updateSendBtn(); paintBar();
    }
    function paintBar() {
        if (!mc.bar) return;
        mc.bar.textContent = '';
        if (!mc.reply && !mc.edit) { mc.bar.hidden = true; return; }
        const t = el('div', 'mc-bar-text');
        if (mc.edit) { t.appendChild(el('strong', null, dmt('dm_editing', 'Editing message'))); t.appendChild(el('span', 'mc-bar-sub', ' · ' + dmt('dm_esc_cancel', 'Esc to cancel'))); }
        else { t.appendChild(document.createTextNode(dmt('dm_replying_to', 'Replying to') + ' ')); t.appendChild(el('strong', null, mc.reply.senderName)); t.appendChild(el('span', 'mc-bar-sub', ' ' + mc.reply.text.replace(/\s+/g, ' ').slice(0, 60))); }
        mc.bar.appendChild(t);
        mc.bar.appendChild(iconBtn('mc-bar-x', 'close', '✕', dmt('dm_cancel', 'Cancel'), function () { if (mc.edit) cancelEdit(); else cancelReply(); mc.input.focus(); }));
        mc.bar.hidden = false;
    }
    function copyText(k) {
        const m = mc.msgs.get(k); if (!m) return;
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(m.text || '')).catch(function () { /* sin permiso */ }); } catch (e) { /* nada */ }
    }
    // Si lo que cambió es el ÚLTIMO mensaje, la lista de chats de los dos también muestra el texto nuevo
    function syncLast(k, text) {
        const keys = sortedKeys();
        if (keys[keys.length - 1] !== k) return;
        const d = db(), me = myUid(); if (!d || !me || !mc.uid) return;
        ['user_chats/' + me + '/' + mc.uid, 'user_chats/' + mc.uid + '/' + me].forEach(function (p) {
            const ref = d.ref(p);
            ref.once('value').then(function (s) { if (s.exists()) ref.update({ lastMsg: text }); }).catch(function () { /* nada */ });
        });
    }
    function deleteMsg(k) {
        const d = db(), m = mc.msgs.get(k);
        if (!d || !m || m.sender !== myUid() || !mc.chatId) return;
        d.ref('private_chats/' + mc.chatId + '/' + k).update({ isDeleted: true, text: DELETED_TEXT })
            .then(function () { syncLast(k, DELETED_TEXT); refreshMsg(k); })
            .catch(function (err) { console.error('No se pudo borrar:', err); });
        if (mc.edit === k) cancelEdit();
    }
    function saveEdit(k, text) {
        const d = db(), m = mc.msgs.get(k);
        if (!d || !m || m.sender !== myUid() || !mc.chatId) return false;
        d.ref('private_chats/' + mc.chatId + '/' + k).update({ text: text, isEdited: true })
            .then(function () { syncLast(k, text); refreshMsg(k); })
            .catch(function (err) { console.error('No se pudo editar:', err); });
        return true;
    }

    // ------------------------------------------------------------------ teclado de la caja de escribir
    function onKey(e) {
        e.stopPropagation();                               // las teclas son para escribir, no atajos del editor
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendNow(); return; }
        if (e.key === 'Escape') {
            e.preventDefault();
            if (menuOpen()) { closeMenu(); return; }
            if (mc.edit) { cancelEdit(); return; }
            if (mc.reply) { cancelReply(); return; }
            minimize();
            return;
        }
        // Flecha arriba con la caja vacía = editar mi último mensaje (como en el chat grande)
        if (e.key === 'ArrowUp' && mc.input.value === '' && !mc.edit) {
            const me = myUid(), keys = sortedKeys();
            for (let i = keys.length - 1; i >= 0; i--) { const m = mc.msgs.get(keys[i]); if (m.sender === me && !m.isDeleted) { e.preventDefault(); startEdit(keys[i]); break; } }
        }
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
        const q = d.ref('private_chats/' + mc.chatId).orderByKey().limitToLast(FIRST);
        listen(q, 'child_added', function (snap) {
            if (token !== mc.token) return;
            const v = snap.val(); if (!v || typeof v !== 'object') return;
            const isNew = !mc.msgs.has(snap.key);
            mc.msgs.set(snap.key, v);
            scheduleRender(isNew && v.sender === myUid());
            if (v.sender !== myUid()) scheduleRead();
        });
        listen(q, 'child_changed', function (snap) {
            if (token !== mc.token) return;
            const v = snap.val(); if (!v || typeof v !== 'object') return;
            mc.msgs.set(snap.key, v);
            scheduleRender();
        });
        listen(d.ref('typing_status/' + mc.chatId + '/' + mc.uid), 'value', function (snap) { if (token !== mc.token) return; mc.theyType = snap.val() === true; paintTyping(); if (mc.theyType && nearBottom()) toBottom(); });
        listen(d.ref('users_status/' + mc.uid), 'value', function (snap) { if (token !== mc.token) return; mc.lastStatus = snap.val() || null; paintStatus(); });
        q.once('value').then(function (snap) {
            if (token !== mc.token) return;
            mc.loaded = true;
            mc.hasMore = snap.numChildren() >= FIRST;
            renderMsgs({ stick: true });
        }).catch(function () { mc.loaded = true; });
    }
    function loadOlder() {
        const d = db();
        if (!d || mc.loadingOlder || !mc.hasMore || !mc.chatId) return;
        const keys = sortedKeys(), oldest = keys[0];
        if (!oldest) { mc.hasMore = false; renderMsgs({ keep: true }); return; }
        const token = mc.token;
        mc.loadingOlder = true; renderMsgs({ keep: true });
        d.ref('private_chats/' + mc.chatId).orderByKey().endAt(oldest).limitToLast(PAGE + 1).once('value').then(function (snap) {
            if (token !== mc.token) return;
            let n = 0;
            snap.forEach(function (ch) { const v = ch.val(); if (ch.key !== oldest && !mc.msgs.has(ch.key) && v && typeof v === 'object') { mc.msgs.set(ch.key, v); n++; } });
            mc.hasMore = n >= PAGE; mc.loadingOlder = false;
            renderMsgs({ anchorOlder: true });
        }).catch(function () { mc.loadingOlder = false; renderMsgs({ keep: true }); });
    }
    function paintStatus() {
        const s = mc.lastStatus;
        if (!mc.status) return;
        if (s && s.isOnline) { mc.status.textContent = dmt('dm_active_now', 'Active now'); mc.status.classList.add('on'); }
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

    // ------------------------------------------------------------------ leído
    function scheduleRead() { clearTimeout(mc.readTimer); mc.readTimer = setTimeout(markRead, 60); }
    function markRead() {
        const d = db(), me = myUid();
        if (!d || !me || !visibleNow() || document.visibilityState !== 'visible') return;
        const upd = {}; let n = 0;
        mc.msgs.forEach(function (m, key) {
            if (m.sender !== me && m.status !== 'read' && !m.isDeleted) {
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
        const d = db(), me = myUid(); if (!d || !me || !mc.chatId || mc.edit) return;
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
        if (!text || !mc.uid || isBlockedNow()) return;
        if (mc.edit) {
            if (!saveEdit(mc.edit, text)) return;
            mc.edit = null;
            mc.input.value = (mc.chatId && mc.drafts[mc.chatId]) || '';
            autoSize(); updateSendBtn(); paintBar(); stopTyping();
            mc.input.focus();
            return;
        }
        if (typeof window.dmSendTo !== 'function') return;
        const ok = window.dmSendTo({ uid: mc.uid, name: mc.who, pfp: mc.face }, text, mc.reply ? { replyTo: mc.reply } : null);
        if (!ok) return;
        mc.reply = null; paintBar();
        mc.input.value = '';
        if (mc.chatId) delete mc.drafts[mc.chatId];
        autoSize(); updateSendBtn(); stopTyping();
        mc.stickNext = true;
        mc.input.focus();
    }

    // ------------------------------------------------------------------ menú ⋮ de la cabecera
    function openHeadMenu(btn) {
        const uid = mc.uid, name = mc.who;
        if (!uid || typeof window.dmOpenMenu !== 'function') return;
        const r = btn.getBoundingClientRect();
        window.dmOpenMenu(r.right - 210, r.bottom + 6, function (menu) {
            const muted = typeof window.isChatMuted === 'function' && window.isChatMuted(uid);
            window.dmMenuItem(menu, muted ? dmt('dm_unmute', 'Turn notifications on') : dmt('dm_mute', 'Mute chat'), ICON(muted ? 'bell' : 'bellOff'), function () { if (window.toggleChatMute) window.toggleChatMute(uid); paintMuted(); });
            const arch = typeof window.isChatArchived === 'function' && window.isChatArchived(uid);
            window.dmMenuItem(menu, arch ? dmt('dm_unarchive', 'Unarchive chat') : dmt('dm_archive', 'Archive chat'), ICON(arch ? 'unarchive' : 'archive'), function () { if (window.toggleChatArchive) window.toggleChatArchive(uid); });
            menu.appendChild(el('div', 'dc-menu-sep'));
            let friends = [];
            try { if (typeof misAmigosConfirmados !== 'undefined' && Array.isArray(misAmigosConfirmados)) friends = misAmigosConfirmados; } catch (e) { friends = []; }
            if (friends.indexOf(uid) >= 0) window.dmMenuItem(menu, '❌ ' + dmt('dm_remove_friend', 'Remove friend'), null, function () { if (window.removeFriend) window.removeFriend(uid, name); }, true);
            else window.dmMenuItem(menu, '➕ ' + dmt('dm_add_friend', 'Add friend'), null, function () { if (window.sendFriendRequest) window.sendFriendRequest(uid, name); });
            window.dmMenuItem(menu, '🚫 ' + dmt('dm_block', 'Block'), null, function () { if (window.blockUser) window.blockUser(uid, name); setTimeout(paintNote, 400); }, true);
        });
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
            if (mc.chatId) { if (!mc.edit) mc.drafts[mc.chatId] = mc.input.value; stopTyping(); }
            detach();
            mc.uid = uid;
            mc.chatId = me < uid ? me + '_' + uid : uid + '_' + me;
            mc.msgs = new Map(); mc.msgsEl.textContent = '';
            mc.loaded = false; mc.hasMore = false; mc.loadingOlder = false;
            mc.reply = null; mc.edit = null;
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
        paintVisibility();
        if (window.mbwChatHead) { window.mbwChatHead.pin(uid, mc.who, inf.pfp); window.mbwChatHead.setActive(uid); }
        setTimeout(function () { toBottom(); try { mc.input.focus(); } catch (e) { /* sin foco */ } }, 0);
        scheduleRead();
        return true;
    }
    function minimize() {
        if (!mc.root || !mc.open) return;
        mc.open = false;
        stopTyping();
        closeMenu();
        paintVisibility();
        if (window.mbwChatHead) window.mbwChatHead.setActive(null);
    }
    function close(fromHead) {
        if (!mc.uid) return;
        const uid = mc.uid;
        if (mc.chatId && !mc.edit) mc.drafts[mc.chatId] = mc.input.value;
        stopTyping();
        detach();
        closeMenu();
        mc.open = false; mc.uid = null; mc.chatId = null;
        mc.msgs = new Map(); if (mc.msgsEl) mc.msgsEl.textContent = '';
        mc.reply = null; mc.edit = null; paintBar();
        paintVisibility();
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
    try { new MutationObserver(paintVisibility).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* sin observador */ }
    document.addEventListener('fullscreenchange', paintVisibility);

    window.mbwMiniChat = {
        open: open,
        minimize: minimize,
        close: function () { close(); },
        refresh: function () { paintVisibility(); if (mc.root && mc.uid) { paintNote(); paintMuted(); } },
        isOpenFor: function (uid) { return !!uid && mc.uid === uid; },
        // ¿La persona está viendo ahora mismo este chat en la mini ventana? (abierta, no minimizada, pestaña a la vista)
        isViewing: function (uid) { return !!uid && mc.uid === uid && visibleNow() && document.visibilityState === 'visible'; },
        markRead: scheduleRead,
        loadOlder: loadOlder,
        state: function () { return { uid: mc.uid, open: mc.open, shown: !!(mc.root && mc.root.classList.contains('show')), msgs: mc.msgs.size, chatId: mc.chatId, hasMore: mc.hasMore, reply: mc.reply ? mc.reply.msgId : null, edit: mc.edit }; }
    };
    window.miniChatOnLanguageChanged = function () { texts(); };
})();
