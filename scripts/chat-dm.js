// ==========================================
// CHAT PRIVADO (MENSAJES DIRECTOS) — ESTILO DISCORD
// ==========================================
// Todo lo que dibuja y controla la conversación privada vive aquí:
//   - la lista de chats (barra de la izquierda)
//   - la conversación (mensajes agrupados, separadores de día, "NUEVOS")
//   - "Visto" / "Enviado", responder, editar, borrar, reaccionar
//   - menú de clic derecho, panel de emojis, silenciar chat
//
// El aspecto (colores, tamaños) está en chat-dm.css.
// El envío de un mensaje (sendPrivateMessage) y las amistades siguen en
// multiplayer.js. Este archivo se carga DESPUÉS de multiplayer.js y
// multiplayer-ui.js, y usa sus variables (database, currentChatId, etc.).
//
// CARGA DE MENSAJES: al abrir un chat solo se bajan los últimos
// DM_INITIAL_MESSAGES (6). Si tienes más sin leer, se bajan esos
// (hasta DM_MAX_INITIAL). Al subir con la rueda del mouse (o con el botón
// "Cargar mensajes anteriores") se bajan DM_OLDER_PAGE más cada vez.

const DM_INITIAL_MESSAGES = 6;    // mensajes que se cargan al abrir un chat
const DM_OLDER_PAGE = 20;         // mensajes que se cargan cada vez que subes
const DM_MAX_INITIAL = 50;        // tope si tienes muchos mensajes sin leer
const DM_GROUP_MS = 7 * 60 * 1000;// mensajes seguidos de la misma persona (7 min) se agrupan
const DM_FAR_FROM_BOTTOM = 400;   // a partir de aquí aparece "Ir a los mensajes recientes"
const DM_QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👀'];

// Iconos (SVG simples, para que se vean igual en todos los sistemas)
const DM_ICONS = {
    reply: '<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.42l-2.34-2.34a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    kebab: '<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    emoji: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-11c.83 0 1.5-.67 1.5-1.5S16.33 6 15.5 6 14 6.67 14 7.5 14.67 9 15.5 9zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 6 8.5 6 7 6.67 7 7.5 7.67 9 8.5 9zm3.5 9.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    bellOff: '<svg viewBox="0 0 24 24"><path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.1.89 2 2 2zm6-7.32V11c0-3.08-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12L18 14.68z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    archive: '<svg viewBox="0 0 24 24"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>',
    unarchive: '<svg viewBox="0 0 24 24"><path d="M20.55 5.22l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.15.55L3.46 5.22C3.17 5.57 3 6.01 3 6.5V19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.49-.17-.93-.45-1.28zM12 9.5l5.5 5.5H14v2h-4v-2H6.5L12 9.5zM5.12 5l.82-1h12l.93 1H5.12z"/></svg>'
};

// Estado de la conversación que está abierta ahora mismo
const dmState = {
    token: 0,              // sube cada vez que se abre/cierra un chat: así ignoramos respuestas tardías de Firebase
    chatId: null,
    msgs: [],              // [{ key, msg }] en orden (el más viejo primero)
    byKey: new Map(),      // key -> msg (siempre la versión más reciente)
    rows: new Map(),       // key -> elemento HTML de esa fila
    hasMore: false,        // ¿hay mensajes más viejos en Firebase?
    loadingOlder: false,
    firstUnreadKey: null,  // dónde dibujar la línea roja "NUEVOS"
    newWhileAway: 0,       // mensajes que llegaron mientras mirabas más arriba
    liveQuery: null, onAdded: null, onChanged: null,
    typingRef: null, typingCb: null,
    statusRef: null, statusCb: null
};
const dmDrafts = {};       // texto a medias por chat (se guarda al cambiar de chat)
const dmTyping = { chatId: null, lastSent: 0, timer: null, armedFor: null };
let dmChatCache = [];      // última lista de chats (para filtrarla al buscar sin volver a pedirla)

window.editingMsgKey = null;
window.editingMsgChatId = null;

// ------------------------------------------
// Ayudas pequeñas
// ------------------------------------------
function $dm(id) { return document.getElementById(id); }
function dmMyUid() { return localStorage.getItem('mbw_uid'); }
function dmEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
}
function dmT(key, fallback) {
    if (typeof window.t !== 'function') return fallback || key;
    const v = window.t(key);
    return (v && v !== key) ? v : (fallback || key);
}
function dmLocale() {
    const l = (typeof currentLang !== 'undefined' && currentLang) || 'es';
    return l === 'es' ? 'es-MX' : (l === 'pt' ? 'pt-BR' : 'en-US');
}
function dmSafePfp(p) {
    return (typeof p === 'string' && p.trim() !== '' && p !== 'undefined' && p !== 'null') ? p : MP_DEFAULT_PFP;
}
function dmAvatar(src, sizeCls) {
    const img = dmEl('img', 'dc-avatar ' + (sizeCls || ''));
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.src = dmSafePfp(src);
    img.onerror = () => { img.onerror = null; img.src = MP_DEFAULT_PFP; };
    return img;
}
function dmIcon(btn, svg) { btn.innerHTML = svg; return btn; }  // svg = constante de DM_ICONS (texto fijo, no viene de usuarios)
function dmTs(msg) { const n = Number(msg && msg.timestamp); return n > 0 ? n : Date.now(); }
function dmTime(ts) { return new Date(ts).toLocaleTimeString(dmLocale(), { hour: 'numeric', minute: '2-digit' }); }
function dmDayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
function dmDayLabel(ts) {
    const d = new Date(ts), today = new Date(), y = new Date();
    y.setDate(y.getDate() - 1);
    if (dmDayKey(ts) === dmDayKey(today.getTime())) return dmT('dm_today', 'Hoy');
    if (dmDayKey(ts) === dmDayKey(y.getTime())) return dmT('dm_yesterday', 'Ayer');
    return d.toLocaleDateString(dmLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}
function dmStamp(ts) {  // "Hoy a las 10:32 p. m."
    const time = dmTime(ts), today = new Date(), y = new Date();
    y.setDate(y.getDate() - 1);
    if (dmDayKey(ts) === dmDayKey(today.getTime())) return dmT('dm_today_at', 'Hoy a las {time}').replace('{time}', time);
    if (dmDayKey(ts) === dmDayKey(y.getTime())) return dmT('dm_yesterday_at', 'Ayer a las {time}').replace('{time}', time);
    return new Date(ts).toLocaleDateString(dmLocale()) + ' ' + time;
}
function dmNameColor(uid) {  // cada persona tiene su color, como los roles de Discord
    let h = 0;
    const s = String(uid || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ', 65%, var(--dc-name-l))';
}
function dmCur(key) { return dmState.byKey.get(key); }

// ------------------------------------------
// Silenciar chats (solo se guarda en este navegador)
// ------------------------------------------
window.getMutedChats = function() {
    try {
        const m = JSON.parse(localStorage.getItem('mbw_muted_chats') || '{}');
        return (m && typeof m === 'object') ? m : {};
    } catch (e) { return {}; }
};
window.isChatMuted = function(uid) {
    return !!uid && !!window.getMutedChats()[uid];
};
window.toggleChatMute = function(uid) {
    if (!uid) return;
    const m = window.getMutedChats();
    if (m[uid]) delete m[uid]; else m[uid] = true;
    try { localStorage.setItem('mbw_muted_chats', JSON.stringify(m)); } catch (e) {}
    dmUpdateMuteButton();
    const list = $dm('full-chat-list-container');
    if (list) window.renderChatList(list);
    if (typeof window.refreshSocialBadges === 'function') window.refreshSocialBadges();
    const name = (currentChatPartner && currentChatPartner.uid === uid) ? currentChatPartner.name : '';
    if (typeof window.mpToast === 'function') {
        window.mpToast(m[uid] ? dmT('dm_muted_toast', '🔕 Chat silenciado') : dmT('dm_unmuted_toast', '🔔 Notificaciones activadas'), name);
    }
};
function dmUpdateMuteButton() {
    const btn = $dm('dm-mute-btn');
    if (!btn) return;
    const uid = currentChatPartner && currentChatPartner.uid;
    const muted = window.isChatMuted(uid);
    dmIcon(btn, muted ? DM_ICONS.bellOff : DM_ICONS.bell);
    btn.classList.toggle('is-on', muted);
    btn.title = muted ? dmT('dm_unmute', 'Activar notificaciones') : dmT('dm_mute', 'Silenciar chat');
}

// ------------------------------------------
// Archivar chats (solo se guarda en este navegador, igual que silenciar)
// ------------------------------------------
// Archivar solo ESCONDE el chat de la lista principal y lo manda a la sección "Archivados". No borra nada, ni mensajes ni el chat,
// y nada en el editor borra chats por su cuenta (no hay borrado automático): un chat archivado se queda así hasta que lo desarchives.
window.getArchivedChats = function() {
    try {
        const m = JSON.parse(localStorage.getItem('mbw_archived_chats') || '{}');
        return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
    } catch (e) { return {}; }
};
window.isChatArchived = function(uid) {
    return !!uid && !!window.getArchivedChats()[uid];
};
window.toggleChatArchive = function(uid) {
    if (!uid) return;
    const m = window.getArchivedChats();
    if (m[uid]) delete m[uid]; else m[uid] = true;
    try { localStorage.setItem('mbw_archived_chats', JSON.stringify(m)); } catch (e) {}
    if (m[uid]) dmArchivedOpen = true;   // para que se vea a dónde se fue el chat
    const list = $dm('full-chat-list-container');
    if (list) window.renderChatList(list);
    const name = (currentChatPartner && currentChatPartner.uid === uid) ? currentChatPartner.name : '';
    if (typeof window.mpToast === 'function') {
        window.mpToast(m[uid] ? dmT('dm_archived_toast', '📦 Chat archivado') : dmT('dm_unarchived_toast', '📤 Chat desarchivado'), name);
    }
};
let dmArchivedOpen = false;   // ¿está abierta la sección "Archivados" de la lista?

// ------------------------------------------
// Texto de un mensaje: enlaces, coordenadas y emotes (sin riesgo de HTML)
// ------------------------------------------
function dmAppendPlain(el, seg) {
    const esc = window.escapeHTML || function(s) { return s; };
    const mm = seg.match(/^(\s*)([\s\S]*?)(\s*)$/);
    let html = esc(mm[1]);
    if (mm[2]) html += (typeof window.parseEmotes === 'function') ? window.parseEmotes(esc(mm[2])) : esc(mm[2]);
    html += esc(mm[3]);
    const span = document.createElement('span');
    span.innerHTML = html;   // todo el texto del usuario ya viene escapado; solo los emotes propios son <img>
    el.appendChild(span);
}
function dmLink(url) {
    const a = dmEl('a', 'dc-link', url);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.addEventListener('click', (e) => e.stopPropagation());
    return a;
}
function dmCoord(x, y) {
    const s = dmEl('span', 'dc-coord', '[' + x + ', ' + y + ']');
    s.title = dmT('dm_teleport', 'Teletransportar');
    s.addEventListener('click', (e) => {
        e.stopPropagation();
        // (la cámara del editor es una "const" de main.js, por eso se usa typeof y no window.camera)
        if (typeof camera !== 'undefined') {
            camera.x = x;
            camera.y = y;
            if (typeof worldDirty !== 'undefined') worldDirty = true;
            if (typeof closeFileMenu === 'function') closeFileMenu();
        }
    });
    return s;
}
function dmFillText(el, rawText) {
    const text = String(rawText === undefined || rawText === null ? '' : rawText);
    // 1) enlaces  2) coordenadas (x:10 y:20  /  10,20). Los enlaces se cortan primero para no dañarlos.
    const re = /(https?:\/\/[^\s<]+)|(?:x:\s*)?(-?\d+)\s*(?:,|y:)\s*(-?\d+)/gi;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) dmAppendPlain(el, text.slice(last, m.index));
        if (m[1]) {
            let url = m[1], tail = '';
            const t = url.match(/[.,;:!?)\]]+$/);   // la puntuación final no es parte del enlace
            if (t) { tail = t[0]; url = url.slice(0, url.length - tail.length); }
            if (/^https?:\/\/.+/i.test(url)) { el.appendChild(dmLink(url)); if (tail) dmAppendPlain(el, tail); }
            else dmAppendPlain(el, m[0]);
        } else {
            el.appendChild(dmCoord(parseInt(m[2], 10), parseInt(m[3], 10)));
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) dmAppendPlain(el, text.slice(last));
}

// ------------------------------------------
// Construcción de una fila (un mensaje)
// ------------------------------------------
function dmCanGroup(prev, cur) {
    if (!prev) return false;
    if (cur.msg.replyTo) return false;                       // una respuesta siempre abre grupo nuevo
    if (prev.msg.sender !== cur.msg.sender) return false;
    const a = dmTs(prev.msg), b = dmTs(cur.msg);
    if (dmDayKey(a) !== dmDayKey(b)) return false;
    return Math.abs(b - a) < DM_GROUP_MS;
}

function dmBuildReplyRef(rt) {
    const ref = dmEl('div', 'dc-reply-ref');
    ref.appendChild(dmEl('span', 'dc-reply-name', '@' + (rt.senderName || '?')));
    const txt = dmEl('span', 'dc-reply-text');
    dmAppendPlain(txt, String(rt.text || '').replace(/\s+/g, ' ').slice(0, 140));
    ref.appendChild(txt);
    ref.addEventListener('click', (e) => { e.stopPropagation(); dmJumpTo(rt.msgId); });
    return ref;
}

// ------------------------------------------
// Reacciones: cada persona puede dejar VARIAS por mensaje.
// Se guardan así:   reactions/{uid}/{emoji} = hora en que se puso
// (el formato viejo, reactions/{uid} = "👍" con una sola, se sigue leyendo bien)
// ------------------------------------------
const DM_REACTION_MAX_LEN = 16;
// Firebase no deja usar . $ # [ ] / ni caracteres de control en una clave
function dmReactionValid(e) {
    return typeof e === 'string' && e.length > 0 && e.length <= DM_REACTION_MAX_LEN && !/[.$#\[\]\/\u0000-\u001f\u007f]/.test(e);
}
// { emoji: hora } de UNA persona (acepta el formato nuevo y el viejo)
function dmUserReactions(raw) {
    const out = {};
    if (typeof raw === 'string') { if (raw) out[raw] = 1; }
    else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const e in raw) { const v = raw[e]; if (e && v) out[e] = (typeof v === 'number') ? v : 1; }
    }
    return out;
}
// Lista de reacciones de un mensaje, en el orden en que fueron apareciendo: [{ emoji, uids, ts }]
function dmReactionList(msg) {
    const all = (msg && msg.reactions && typeof msg.reactions === 'object') ? msg.reactions : null;
    if (!all) return [];
    const map = new Map();
    Object.keys(all).forEach(uid => {
        const mine = dmUserReactions(all[uid]);
        Object.keys(mine).forEach(e => {
            let r = map.get(e);
            if (!r) { r = { emoji: e, uids: [], ts: mine[e] }; map.set(e, r); }
            r.uids.push(uid);
            if (mine[e] < r.ts) r.ts = mine[e];
        });
    });
    return [...map.values()].sort((a, b) => (a.ts - b.ts) || (a.emoji < b.emoji ? -1 : 1));
}
function dmReactorName(uid) {
    if (uid === dmMyUid()) return localStorage.getItem('mbw_username') || 'Player';
    if (currentChatPartner && uid === currentChatPartner.uid) return currentChatPartner.name;
    return '?';
}

function dmBuildReactions(key, msg) {
    if (msg.isDeleted) return null;
    const list = dmReactionList(msg);
    if (!list.length) return null;
    const myUID = dmMyUid();
    const wrap = dmEl('div', 'dc-reactions');
    list.forEach(r => {
        const mine = r.uids.indexOf(myUID) >= 0;
        const b = dmEl('button', 'dc-reaction' + (mine ? ' mine' : ''));
        b.type = 'button';
        b.title = r.uids.map(dmReactorName).join(', ');
        b.setAttribute('aria-pressed', mine ? 'true' : 'false');
        b.appendChild(dmEl('span', 'dc-reaction-emoji', r.emoji.slice(0, DM_REACTION_MAX_LEN)));
        b.appendChild(dmEl('span', 'dc-reaction-count', String(r.uids.length)));
        b.addEventListener('click', (ev) => { ev.stopPropagation(); window.toggleReaction(key, r.emoji); });
        wrap.appendChild(b);
    });
    return wrap;
}

function dmBuildToolbar(key, isMe) {
    const bar = dmEl('div', 'dc-msg-toolbar');
    const add = (svg, title, fn) => {
        const b = dmEl('button', 'dc-tool-btn');
        b.type = 'button';
        b.title = title;
        dmIcon(b, svg);
        b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(b); });
        bar.appendChild(b);
    };
    const live = dmCur(key);
    if (live && !live.isDeleted) {
        add(DM_ICONS.emoji, dmT('dm_react', 'Reaccionar'), (b) => {
            const r = b.getBoundingClientRect();
            dmOpenMenu(r.left, r.bottom + 4, (menu) => dmAddReactStrip(menu, key, true));   // este cuadro se queda abierto: así se ponen varias
        });
        add(DM_ICONS.reply, dmT('dm_reply', 'Responder'), () => { const m = dmCur(key); if (m && !m.isDeleted) window.setReply(key, m.senderName, m.text); });
        if (isMe) add(DM_ICONS.edit, dmT('dm_edit', 'Editar'), () => { const m = dmCur(key); if (m && !m.isDeleted) window.startEditMessage(key, m); });
    }
    add(DM_ICONS.more, dmT('dm_more', 'Más'), (b) => {
        const r = b.getBoundingClientRect();
        window.showChatContextMenu(r.right - 190, r.bottom + 4, key, dmCur(key), isMe);
    });
    return bar;
}

function dmBuildRow(entry, prev) {
    const key = entry.key, msg = entry.msg;
    const myUID = dmMyUid();
    const isMe = msg.sender === myUID;
    const start = !dmCanGroup(prev, entry);
    const ts = dmTs(msg);

    const row = dmEl('div', 'dc-msg' + (isMe ? ' is-me' : '') + (start ? ' is-start' : ' is-cont') + (msg.isDeleted ? ' is-deleted' : '') + (msg.replyTo && !msg.isDeleted ? ' has-reply' : ''));
    row.dataset.key = key;

    const authorUid = isMe ? myUID : (currentChatPartner ? currentChatPartner.uid : msg.sender);
    if (start) {
        const pfp = isMe ? (localStorage.getItem('mbw_profile_pic') || MP_DEFAULT_PFP) : (currentChatPartner ? currentChatPartner.pfp : MP_DEFAULT_PFP);
        row.appendChild(dmAvatar(pfp, 'dc-avatar-md dc-msg-avatar'));
    } else {
        row.appendChild(dmEl('span', 'dc-msg-hovertime', dmTime(ts)));
    }

    const body = dmEl('div', 'dc-msg-body');
    if (msg.replyTo && !msg.isDeleted) body.appendChild(dmBuildReplyRef(msg.replyTo));

    if (start) {
        const head = dmEl('div', 'dc-msg-head');
        const author = dmEl('span', 'dc-msg-author', isMe ? (localStorage.getItem('mbw_username') || msg.senderName || 'Player') : (currentChatPartner ? currentChatPartner.name : (msg.senderName || '?')));
        author.style.color = dmNameColor(authorUid);
        head.appendChild(author);
        const time = dmEl('span', 'dc-msg-time', dmStamp(ts));
        time.title = new Date(ts).toLocaleString(dmLocale());
        head.appendChild(time);
        body.appendChild(head);
    }

    const text = dmEl('div', 'dc-msg-text');
    text.id = 'msg-text-' + key;
    if (msg.isDeleted) {
        text.textContent = '🚫 ' + dmT('dm_deleted', 'Este mensaje fue eliminado');
    } else {
        dmFillText(text, msg.text);
        if (msg.isEdited) text.appendChild(dmEl('span', 'dc-edited', '(' + dmT('dm_edited', 'editado') + ')'));
    }
    body.appendChild(text);

    const reactions = dmBuildReactions(key, msg);
    if (reactions) body.appendChild(reactions);

    row.appendChild(body);
    row.appendChild(dmBuildToolbar(key, isMe));

    row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.showChatContextMenu(e.clientX, e.clientY, key, dmCur(key), isMe);
    });

    dmState.rows.set(key, row);
    return row;
}

function dmBuildDayDivider(ts) {
    const d = dmEl('div', 'dc-day-divider');
    d.appendChild(dmEl('span', null, dmDayLabel(ts)));
    return d;
}
function dmBuildNewDivider() {
    const d = dmEl('div', 'dc-new-divider');
    d.appendChild(dmEl('span', 'dc-new-pill', dmT('dm_new', 'Nuevos')));
    return d;
}

// Parte de arriba de la conversación: "cargar anteriores" o la bienvenida
function dmBuildTop() {
    const p = currentChatPartner || { name: '?', pfp: MP_DEFAULT_PFP };
    if (dmState.hasMore) {
        const btn = dmEl('button', 'dc-load-older', dmT('dm_load_older', 'Cargar mensajes anteriores'));
        btn.type = 'button';
        btn.id = 'dm-load-older';
        btn.addEventListener('click', dmLoadOlder);
        return btn;
    }
    const w = dmEl('div', 'dc-welcome');
    w.appendChild(dmAvatar(p.pfp, 'dc-avatar-lg'));
    w.appendChild(dmEl('h3', 'dc-welcome-title', p.name));
    const sub = dmEl('p', 'dc-welcome-sub', dmT('dm_welcome', 'Este es el comienzo de tu historial de mensajes directos con '));
    sub.appendChild(dmEl('strong', null, p.name));
    sub.appendChild(document.createTextNode('.'));
    w.appendChild(sub);
    return w;
}

// ------------------------------------------
// Pintar la conversación
// ------------------------------------------
let dmLastScrollTop = 0;
function dmRenderAll() {
    const box = $dm('full-dm-messages');
    if (!box) return;
    dmLastScrollTop = 0;
    box.textContent = '';
    dmState.rows.clear();
    box.appendChild(dmBuildTop());

    let prev = null, lastDay = '';
    dmState.msgs.forEach(entry => {
        const ts = dmTs(entry.msg);
        const day = dmDayKey(ts);
        if (day !== lastDay) { box.appendChild(dmBuildDayDivider(ts)); lastDay = day; prev = null; }
        if (entry.key === dmState.firstUnreadKey) { box.appendChild(dmBuildNewDivider()); prev = null; }
        box.appendChild(dmBuildRow(entry, prev));
        prev = entry;
    });
    dmUpdateSeen();
}

// Agrega un mensaje nuevo al final (sin volver a pintar todo)
function dmAppendEntry(entry) {
    const box = $dm('full-dm-messages');
    if (!box) return;
    const idx = dmState.msgs.length - 1;               // el nuevo ya está en msgs
    const prev = idx > 0 ? dmState.msgs[idx - 1] : null;
    const ts = dmTs(entry.msg);
    let usePrev = prev;
    if (!prev || dmDayKey(dmTs(prev.msg)) !== dmDayKey(ts)) {
        box.appendChild(dmBuildDayDivider(ts));
        usePrev = null;
    }
    box.appendChild(dmBuildRow(entry, usePrev));
    dmUpdateSeen();
}

// Cambió un mensaje (editado, borrado, reacción, visto): se vuelve a pintar solo esa fila
function dmApplyChange(key, msg) {
    dmState.byKey.set(key, msg);
    const idx = dmState.msgs.findIndex(e => e.key === key);
    if (idx < 0) return;
    dmState.msgs[idx].msg = msg;
    const old = dmState.rows.get(key);
    if (!old || !old.isConnected) return;
    const box = $dm('full-dm-messages');
    const wasNear = dmNearBottom(60);
    const prev = idx > 0 ? dmState.msgs[idx - 1] : null;
    const sameDay = prev && dmDayKey(dmTs(prev.msg)) === dmDayKey(dmTs(msg));
    // (igual que en dmRenderAll: después de un separador de día o de la línea "NUEVOS" se abre un grupo nuevo)
    const fresh = dmBuildRow(dmState.msgs[idx], (sameDay && key !== dmState.firstUnreadKey) ? prev : null);
    old.replaceWith(fresh);
    dmUpdateSeen();
    if (box && wasNear) dmScrollBottom();
}

function dmJumpTo(key) {
    const row = dmState.rows.get(key);
    if (!row || !row.isConnected) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.remove('dc-flash');
    void row.offsetWidth;
    row.classList.add('dc-flash');
    setTimeout(() => row.classList.remove('dc-flash'), 1900);
}

// "Visto" / "Enviado": solo bajo MI último mensaje (como en Instagram o Messenger)
function dmUpdateSeen() {
    const box = $dm('full-dm-messages');
    if (!box) return;
    const old = box.querySelector('.dc-seen');
    if (old) old.remove();
    const myUID = dmMyUid();
    let last = null;
    for (let i = dmState.msgs.length - 1; i >= 0; i--) {
        const e = dmState.msgs[i];
        if (e.msg.sender === myUID && !e.msg.isDeleted) { last = e; break; }
    }
    if (!last) return;
    const row = dmState.rows.get(last.key);
    if (!row || !row.isConnected) return;
    const read = last.msg.status === 'read';
    const el = dmEl('div', 'dc-seen' + (read ? ' is-read' : ''));
    el.appendChild(dmEl('span', 'dc-seen-ticks', read ? '✓✓' : '✓'));
    let label = read ? dmT('dm_seen', 'Visto') : dmT('dm_sent', 'Enviado');
    if (read && Number(last.msg.readAt) > 0) label += ' · ' + dmTime(Number(last.msg.readAt));
    el.appendChild(dmEl('span', null, label));
    const body = row.querySelector('.dc-msg-body');
    if (body) body.appendChild(el);
}

// ------------------------------------------
// Scroll y botón "mensajes nuevos"
// ------------------------------------------
function dmNearBottom(px) {
    const box = $dm('full-dm-messages');
    if (!box) return true;
    return box.scrollHeight - box.scrollTop - box.clientHeight < (px || 60);
}
function dmScrollBottom() {
    const box = $dm('full-dm-messages');
    if (!box) return;
    box.scrollTop = box.scrollHeight;
    // las imágenes (emotes, fotos) pueden terminar de cargar después: lo repetimos al siguiente cuadro
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}
function dmUpdatePill() {
    const pill = $dm('chat-scroll-bottom-btn');
    const box = $dm('full-dm-messages');
    if (!pill || !box) return;
    const far = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (far < 80) { dmState.newWhileAway = 0; pill.style.display = 'none'; return; }
    if (dmState.newWhileAway > 0) {
        const n = dmState.newWhileAway;
        pill.textContent = '↓ ' + (n === 1 ? dmT('dm_new_one', '1 mensaje nuevo') : dmT('dm_new_many', '{n} mensajes nuevos').replace('{n}', n));
        pill.style.display = 'block';
    } else if (far > DM_FAR_FROM_BOTTOM) {
        pill.textContent = '↓ ' + dmT('dm_jump', 'Ir a los mensajes recientes');
        pill.style.display = 'block';
    } else {
        pill.style.display = 'none';
    }
}

// ------------------------------------------
// Leer mensajes: "Visto" y contador de la lista
// ------------------------------------------
function dmViewActive() {
    const a = $dm('full-chat-active');
    return !!(a && a.offsetWidth > 0 && document.visibilityState === 'visible');
}
window.dmMarkRead = function(forceUnreadReset) {
    if (!dmState.chatId || !currentChatPartner || !dmViewActive()) return;
    const myUID = dmMyUid();
    if (!myUID) return;
    const updates = {};
    let n = 0;
    dmState.msgs.forEach(e => {
        if (e.msg.sender !== myUID && e.msg.status !== 'read') {
            updates[e.key + '/status'] = 'read';
            updates[e.key + '/readAt'] = firebase.database.ServerValue.TIMESTAMP;
            n++;
        }
    });
    if (n > 0) database.ref('private_chats/' + dmState.chatId).update(updates).catch(() => {});
    if (n > 0 || forceUnreadReset) {
        // El contador de la lista solo se toca si el registro ya existe (así no se crean registros vacíos)
        const ref = database.ref('user_chats/' + myUID + '/' + currentChatPartner.uid);
        ref.once('value').then(s => { if (s.exists() && s.val().unreadCount) ref.update({ unreadCount: 0 }); });
    }
};

// ------------------------------------------
// Carga de mensajes (solo los últimos, y más al subir)
// ------------------------------------------
function dmSnapToArray(snap) {
    const arr = [];
    snap.forEach(c => { arr.push({ key: c.key, msg: c.val() || {} }); });   // (sin "return": si no, forEach se detiene)
    return arr;
}

function dmLoadInitial(token, unread) {
    const chatId = dmState.chatId;
    const n = Math.min(DM_MAX_INITIAL, Math.max(DM_INITIAL_MESSAGES, Number(unread) || 0));
    database.ref('private_chats/' + chatId).orderByKey().limitToLast(n + 1).once('value').then(snap => {
        if (token !== dmState.token) return;
        const arr = dmSnapToArray(snap);
        let hasMore = false;
        if (arr.length > n) { arr.shift(); hasMore = true; }   // el de más: solo sirve para saber que hay más atrás
        const myUID = dmMyUid();
        dmState.msgs = arr;
        dmState.byKey = new Map(arr.map(e => [e.key, e.msg]));
        dmState.hasMore = hasMore;
        const firstUnread = arr.find(e => e.msg.sender !== myUID && e.msg.status !== 'read');
        dmState.firstUnreadKey = firstUnread ? firstUnread.key : null;
        dmRenderAll();
        dmScrollBottom();
        dmAttachLive(token);
        window.dmMarkRead(true);
    }, err => {
        if (token !== dmState.token) return;
        console.error('No se pudieron cargar los mensajes:', err);
        const box = $dm('full-dm-messages');
        if (box) { box.textContent = ''; box.appendChild(dmEl('div', 'dc-load-error', dmT('dm_load_error', 'No se pudieron cargar los mensajes.'))); }
    });
}

function dmLoadOlder() {
    if (!dmState.chatId || dmState.loadingOlder || !dmState.hasMore || !dmState.msgs.length) return;
    const token = dmState.token;
    dmState.loadingOlder = true;
    const btn = $dm('dm-load-older');
    if (btn) { btn.disabled = true; btn.textContent = dmT('dm_loading', 'Cargando…'); }
    const oldestKey = dmState.msgs[0].key;
    // endAt(oldestKey) incluye al más viejo que ya tenemos (último de la lista) -> lo quitamos
    database.ref('private_chats/' + dmState.chatId).orderByKey().endAt(oldestKey).limitToLast(DM_OLDER_PAGE + 2).once('value').then(snap => {
        if (token !== dmState.token) return;
        const arr = dmSnapToArray(snap);
        if (arr.length && arr[arr.length - 1].key === oldestKey) arr.pop();
        let hasMore = false;
        if (arr.length > DM_OLDER_PAGE) { arr.shift(); hasMore = true; }
        arr.forEach(e => dmState.byKey.set(e.key, e.msg));
        dmState.msgs = arr.concat(dmState.msgs);
        dmState.hasMore = hasMore;
        dmState.loadingOlder = false;
        const box = $dm('full-dm-messages');
        const prevH = box ? box.scrollHeight : 0, prevTop = box ? box.scrollTop : 0;
        dmRenderAll();
        if (box) box.scrollTop = box.scrollHeight - prevH + prevTop;   // la pantalla no "salta"
    }, err => {
        dmState.loadingOlder = false;
        console.error('No se pudieron cargar los mensajes anteriores:', err);
        const b = $dm('dm-load-older');
        if (b) { b.disabled = false; b.textContent = dmT('dm_load_older', 'Cargar mensajes anteriores'); }
    });
}

// Escucha en vivo: desde el mensaje más viejo que mostramos hacia adelante
function dmAttachLive(token) {
    const first = dmState.msgs.length ? dmState.msgs[0].key : null;
    let q = database.ref('private_chats/' + dmState.chatId).orderByKey();
    if (first) q = q.startAt(first);
    dmState.liveQuery = q;
    dmState.onAdded = q.on('child_added', snap => dmOnAdded(token, snap));
    dmState.onChanged = q.on('child_changed', snap => dmOnChanged(token, snap));
}

function dmOnAdded(token, snap) {
    if (token !== dmState.token) return;
    const key = snap.key, msg = snap.val();
    if (!msg) return;
    if (dmState.byKey.has(key)) {   // ya lo teníamos (carga inicial): solo revisamos si cambió
        if (JSON.stringify(dmState.byKey.get(key)) !== JSON.stringify(msg)) dmApplyChange(key, msg);
        return;
    }
    const myUID = dmMyUid();
    const isMe = msg.sender === myUID;
    const wasNear = dmNearBottom(80);
    const entry = { key, msg };
    dmState.byKey.set(key, msg);
    const last = dmState.msgs[dmState.msgs.length - 1];
    if (!last || key > last.key) {
        dmState.msgs.push(entry);
        dmAppendEntry(entry);
    } else {   // llegó fuera de orden (raro): volvemos a pintar todo
        dmState.msgs.push(entry);
        dmState.msgs.sort((a, b) => (a.key < b.key ? -1 : 1));
        dmRenderAll();
    }

    if (isMe || wasNear) {
        dmScrollBottom();
        dmState.newWhileAway = 0;
    } else {
        dmState.newWhileAway++;
    }
    dmUpdatePill();

    if (!isMe) {
        if (dmViewActive() && !window.isChatMuted(currentChatPartner && currentChatPartner.uid) && typeof audioManager !== 'undefined') {
            audioManager.playTone(600, 'sine', 0.05, 0.1);
        }
        window.dmMarkRead();
    }
}
function dmOnChanged(token, snap) {
    if (token !== dmState.token) return;
    const msg = snap.val();
    if (msg) dmApplyChange(snap.key, msg);
}

// ------------------------------------------
// Apagar todo lo del chat abierto (cambiar de chat, cerrar el panel...)
// ------------------------------------------
window.closeDmListeners = function() {
    dmState.token++;
    if (dmState.liveQuery) {
        if (dmState.onAdded) dmState.liveQuery.off('child_added', dmState.onAdded);
        if (dmState.onChanged) dmState.liveQuery.off('child_changed', dmState.onChanged);
    }
    dmState.liveQuery = dmState.onAdded = dmState.onChanged = null;
    if (dmState.typingRef && dmState.typingCb) dmState.typingRef.off('value', dmState.typingCb);
    dmState.typingRef = dmState.typingCb = null;
    if (dmState.statusRef && dmState.statusCb) dmState.statusRef.off('value', dmState.statusCb);
    dmState.statusRef = dmState.statusCb = null;
    dmStopTyping();
    dmState.loadingOlder = false;
    dmState.newWhileAway = 0;
    dmState.chatId = null;
    const pill = $dm('chat-scroll-bottom-btn');
    if (pill) pill.style.display = 'none';
    const ti = $dm('dm-typing-indicator');
    if (ti) ti.classList.remove('is-on');
};

// ------------------------------------------
// "Estoy escribiendo..." (lo que yo aviso)
// ------------------------------------------
function dmTypingPing() {
    if (!currentChatId) return;
    const myUID = dmMyUid();
    if (!myUID) return;
    if (dmTyping.chatId !== currentChatId) {   // cambié de chat escribiendo: aviso que dejé el anterior
        dmStopTyping();
        dmTyping.chatId = currentChatId;
        dmTyping.lastSent = 0;
    }
    const now = Date.now();
    if (now - dmTyping.lastSent > 2500) {     // como mucho una escritura cada 2.5 s (antes era una por tecla)
        const ref = database.ref('typing_status/' + dmTyping.chatId + '/' + myUID);
        ref.set(true);
        if (dmTyping.armedFor !== dmTyping.chatId) { ref.onDisconnect().set(false); dmTyping.armedFor = dmTyping.chatId; }
        dmTyping.lastSent = now;
    }
    clearTimeout(dmTyping.timer);
    dmTyping.timer = setTimeout(dmStopTyping, 3000);
}
function dmStopTyping() {
    clearTimeout(dmTyping.timer);
    const myUID = dmMyUid();
    if (dmTyping.chatId && dmTyping.lastSent && myUID) {
        database.ref('typing_status/' + dmTyping.chatId + '/' + myUID).set(false);
    }
    dmTyping.lastSent = 0;
}
// sendPrivateMessage (multiplayer.js) llama a esto después de enviar
window.dmOnMessageSent = function() {
    clearTimeout(dmTyping.timer);
    dmTyping.lastSent = 0;
    const input = $dm('full-dm-input');
    if (input) dmAutoResize(input);
    dmUpdateSendBtn();
    dmScrollBottom();
};

// ------------------------------------------
// Responder y editar (barras sobre la caja de escribir)
// ------------------------------------------
function dmSyncComposerBars() {
    const composer = $dm('dc-composer');
    const reply = $dm('full-chat-reply-preview');
    const edit = $dm('dm-edit-bar');
    const has = (reply && !reply.hidden) || (edit && !edit.hidden);
    if (composer) composer.classList.toggle('has-bar', !!has);
}
window.setReply = function(msgId, senderName, text) {
    if (window.editingMsgKey) window.cancelEdit();
    replyingTo = { msgId: msgId, senderName: senderName, text: String(text || '').slice(0, 200) };
    const bar = $dm('full-chat-reply-preview');
    if (bar) {
        bar.textContent = '';
        const t = dmEl('div', 'dc-bar-text');
        t.appendChild(document.createTextNode(dmT('dm_replying_to', 'Respondiendo a') + ' '));
        t.appendChild(dmEl('strong', null, senderName || '?'));
        bar.appendChild(t);
        const x = dmEl('button', 'dc-bar-close');
        x.type = 'button';
        x.title = dmT('dm_cancel', 'Cancelar');
        dmIcon(x, DM_ICONS.close);
        x.addEventListener('click', () => window.cancelReply());
        bar.appendChild(x);
        bar.hidden = false;
    }
    dmSyncComposerBars();
    const input = $dm('full-dm-input');
    if (input) input.focus();
};
window.cancelReply = function() {
    replyingTo = null;
    const bar = $dm('full-chat-reply-preview');
    if (bar) { bar.hidden = true; bar.textContent = ''; }
    dmSyncComposerBars();
};
window.startEditMessage = function(key, msg) {
    if (!msg || msg.isDeleted) return;
    if (replyingTo) window.cancelReply();
    const input = $dm('full-dm-input');
    if (!input) return;
    window.editingMsgKey = key;
    window.editingMsgChatId = currentChatId;   // para no arrastrar la edición a otro chat
    input.value = msg.text || '';
    dmAutoResize(input);
    dmUpdateSendBtn();
    const bar = $dm('dm-edit-bar');
    if (bar) {
        bar.textContent = '';
        const t = dmEl('div', 'dc-bar-text');
        t.appendChild(dmEl('strong', null, dmT('dm_editing', 'Editando mensaje')));
        t.appendChild(dmEl('span', 'dc-bar-quote', dmT('dm_esc_cancel', 'Esc para cancelar')));
        bar.appendChild(t);
        const x = dmEl('button', 'dc-bar-close');
        x.type = 'button';
        x.title = dmT('dm_cancel', 'Cancelar');
        dmIcon(x, DM_ICONS.close);
        x.addEventListener('click', () => window.cancelEdit());
        bar.appendChild(x);
        bar.hidden = false;
    }
    dmSyncComposerBars();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
};
// Termina el modo edición sin tocar el texto (lo llama sendPrivateMessage al guardar)
window.dmEditFinished = function() {
    const bar = $dm('dm-edit-bar');
    if (bar) { bar.hidden = true; bar.textContent = ''; }
    dmSyncComposerBars();
};
// Cancela la edición y limpia la caja
window.cancelEdit = function() {
    window.editingMsgKey = null;
    window.editingMsgChatId = null;
    const input = $dm('full-dm-input');
    if (input) { input.value = ''; dmAutoResize(input); dmUpdateSendBtn(); }
    window.dmEditFinished();
};
// Al cambiar de chat no arrastramos una edición ni una respuesta a medias
function resetChatComposer() {
    if (window.editingMsgKey) window.cancelEdit();
    if (replyingTo) window.cancelReply();
}

// Si lo que cambió fue el ÚLTIMO mensaje, la lista de chats también debe mostrar el texto nuevo
window.dmSyncLastMsg = function(key, text) {
    const last = dmState.msgs[dmState.msgs.length - 1];
    if (!last || last.key !== key || !currentChatPartner) return;
    const me = dmMyUid(), other = currentChatPartner.uid;
    [['user_chats/' + me + '/' + other], ['user_chats/' + other + '/' + me]].forEach(p => {
        const ref = database.ref(p[0]);
        ref.once('value').then(s => { if (s.exists()) ref.update({ lastMsg: text }); }).catch(() => {});
    });
};

// Pone o quita UNA reacción mía (las demás mías no se tocan). Devuelve una promesa: 'added', 'removed' o null (no se pudo).
window.toggleReaction = function(msgKey, emoji) {
    const myUID = dmMyUid();
    if (!currentChatId || !myUID || !dmReactionValid(emoji)) return Promise.resolve(null);
    const ref = database.ref('private_chats/' + currentChatId + '/' + msgKey + '/reactions/' + myUID);
    return ref.once('value').then(snap => {
        const raw = snap.val();
        const mine = dmUserReactions(raw);
        const adding = !mine[emoji];
        const stamp = (firebase.database.ServerValue && firebase.database.ServerValue.TIMESTAMP) || Date.now();
        let done;
        if (typeof raw === 'string') {   // formato viejo (una sola): se pasa al nuevo de una vez, sin perder la que ya tenía
            if (adding) mine[emoji] = stamp; else delete mine[emoji];
            done = Object.keys(mine).length ? ref.set(mine) : ref.remove();
        } else {
            done = adding ? ref.child(emoji).set(stamp) : ref.child(emoji).remove();
        }
        return Promise.resolve(done).then(() => (adding ? 'added' : 'removed'));
    }).catch(err => { console.error('No se pudo cambiar la reacción:', err); return null; });
};

// ------------------------------------------
// Menús flotantes (clic derecho, "⋯", cabecera)
// ------------------------------------------
function dmGetMenu() {
    let menu = $dm('chat-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'chat-context-menu';
        menu.className = 'dc-menu';
        document.body.appendChild(menu);
        document.addEventListener('mousedown', (e) => { if (!menu.contains(e.target)) menu.style.display = 'none'; });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.style.display = 'none'; });
        window.addEventListener('resize', () => { menu.style.display = 'none'; });
    }
    return menu;
}
function dmOpenMenu(x, y, build) {
    const menu = dmGetMenu();
    menu.textContent = '';
    build(menu);
    menu.style.display = 'flex';
    menu.style.left = '0px';
    menu.style.top = '0px';
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
}
function dmMenuItem(menu, label, svg, fn, danger) {
    const it = dmEl('div', 'dc-menu-item' + (danger ? ' danger' : ''));
    it.appendChild(dmEl('span', null, label));
    if (svg) { const i = document.createElement('span'); i.innerHTML = svg; it.appendChild(i.firstChild); }
    it.addEventListener('click', () => { menu.style.display = 'none'; fn(); });
    menu.appendChild(it);
    return it;
}
// Fila de emojis rápidos. Las que YA puse están marcadas (.on). Con keepOpen el cuadro no se cierra
// al elegir, para poder poner varias seguidas.
function dmAddReactStrip(menu, key, keepOpen) {
    const strip = dmEl('div', 'dc-menu-react' + (keepOpen ? ' solo' : ''));
    const mineNow = dmUserReactions(((dmCur(key) || {}).reactions || {})[dmMyUid()]);
    DM_QUICK_REACTIONS.forEach(emoji => {
        const b = dmEl('button', 'dc-menu-react-btn' + (mineNow[emoji] ? ' on' : ''), emoji);
        b.type = 'button';
        b.setAttribute('aria-pressed', mineNow[emoji] ? 'true' : 'false');
        b.addEventListener('click', () => {
            if (!keepOpen) { menu.style.display = 'none'; window.toggleReaction(key, emoji); return; }
            b.disabled = true;   // (evita dos clics seguidos sobre el mismo emoji antes de que termine de guardarse)
            window.toggleReaction(key, emoji).then(res => {
                b.disabled = false;
                if (res) { b.classList.toggle('on', res === 'added'); b.setAttribute('aria-pressed', res === 'added' ? 'true' : 'false'); }
            });
        });
        strip.appendChild(b);
    });
    menu.appendChild(strip);
}
function dmReactionsAllowed(msg) { return !!msg && !msg.isDeleted; }

// Clic derecho (o "⋯") sobre un mensaje. Siempre usa la versión MÁS NUEVA del mensaje.
window.showChatContextMenu = function(x, y, msgKey, msgFromCaller, isMe) {
    const msg = dmCur(msgKey) || msgFromCaller;
    if (!msg) return;
    dmOpenMenu(x, y, (menu) => {
        if (dmReactionsAllowed(msg)) {
            dmAddReactStrip(menu, msgKey);
            menu.appendChild(dmEl('div', 'dc-menu-sep'));
        }
        if (!msg.isDeleted) {
            dmMenuItem(menu, dmT('dm_reply', 'Responder'), DM_ICONS.reply, () => window.setReply(msgKey, msg.senderName, msg.text));
            if (isMe) dmMenuItem(menu, dmT('dm_edit_msg', 'Editar mensaje'), DM_ICONS.edit, () => window.startEditMessage(msgKey, dmCur(msgKey) || msg));
            dmMenuItem(menu, dmT('dm_copy', 'Copiar texto'), DM_ICONS.copy, () => {
                const text = (dmCur(msgKey) || msg).text || '';
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
            });
        }
        if (isMe && !msg.isDeleted) {
            menu.appendChild(dmEl('div', 'dc-menu-sep'));
            dmMenuItem(menu, dmT('dm_delete', 'Eliminar mensaje'), DM_ICONS.trash, () => {
                if (!currentChatId) return;
                const deletedText = '🚫 Este mensaje fue eliminado';
                database.ref('private_chats/' + currentChatId + '/' + msgKey).update({ isDeleted: true, text: deletedText })
                    .then(() => window.dmSyncLastMsg(msgKey, deletedText))
                    .catch(err => console.error('Error al borrar:', err));
            }, true);
        }
    });
};

// Menú "⋮" de la cabecera: silenciar, añadir/eliminar amigo, bloquear
window.showChatHeaderMenu = function(anchor) {
    const partner = currentChatPartner;
    if (!partner) return;
    const r = anchor.getBoundingClientRect();
    dmOpenMenu(r.right - 200, r.bottom + 6, (menu) => {
        const muted = window.isChatMuted(partner.uid);
        dmMenuItem(menu, muted ? dmT('dm_unmute', 'Activar notificaciones') : dmT('dm_mute', 'Silenciar chat'), muted ? DM_ICONS.bell : DM_ICONS.bellOff, () => window.toggleChatMute(partner.uid));
        const archived = window.isChatArchived(partner.uid);
        dmMenuItem(menu, archived ? dmT('dm_unarchive', 'Desarchivar chat') : dmT('dm_archive', 'Archivar chat'), archived ? DM_ICONS.unarchive : DM_ICONS.archive, () => window.toggleChatArchive(partner.uid));
        menu.appendChild(dmEl('div', 'dc-menu-sep'));
        if (misAmigosConfirmados.includes(partner.uid)) {
            dmMenuItem(menu, '❌ ' + dmT('dm_remove_friend', 'Eliminar amigo'), null, () => window.removeFriend(partner.uid, partner.name), true);
        } else {
            dmMenuItem(menu, '➕ ' + dmT('dm_add_friend', 'Añadir amigo'), null, () => window.sendFriendRequest(partner.uid, partner.name));
        }
        dmMenuItem(menu, '🚫 ' + dmT('dm_block', 'Bloquear'), null, () => window.blockUser(partner.uid, partner.name), true);
    });
};

// ------------------------------------------
// Caja de escribir: eventos, emojis
// ------------------------------------------
function dmAutoResize(input) {
    input.style.height = 'auto';
    const h = Math.min(input.scrollHeight, 200);
    input.style.height = h + 'px';
    input.style.overflowY = input.scrollHeight > 200 ? 'auto' : 'hidden';
}
function dmUpdateSendBtn() {
    const btn = $dm('btn-dm-send');
    const input = $dm('full-dm-input');
    if (btn && input) btn.classList.toggle('is-ready', input.value.trim() !== '');
}
function dmInsertAtCursor(input, text) {
    const s = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const e = typeof input.selectionEnd === 'number' ? input.selectionEnd : s;
    input.value = input.value.slice(0, s) + text + input.value.slice(e);
    const pos = s + text.length;
    input.focus();
    input.setSelectionRange(pos, pos);
    input.dispatchEvent(new Event('input'));   // así se ajusta la altura y se avisa "escribiendo"
}

function dmBuildEmojiPanel(wrap, input) {
    const panel = dmEl('div', 'dc-emoji-panel');
    panel.id = 'dm-emoji-panel';
    const tabs = dmEl('div', 'dc-emoji-tabs');
    const content = dmEl('div', 'dc-emoji-content');

    const showCategory = (catId, tabEl) => {
        tabs.querySelectorAll('.dc-emoji-tab').forEach(t => t.classList.remove('active'));
        if (tabEl) tabEl.classList.add('active');
        content.textContent = '';
        const grid = dmEl('div', 'dc-emoji-grid');
        if (catId === 'custom') {
            content.appendChild(dmEl('div', 'dc-emoji-title', 'Custom Emotes'));
            Object.keys(window.customEmotes || {}).forEach(name => {
                const b = dmEl('button', 'dc-emoji-item');
                b.type = 'button';
                b.title = ':' + name + ':';
                const img = document.createElement('img');
                img.src = window.customEmotes[name];
                img.alt = name;
                b.appendChild(img);
                b.addEventListener('click', () => { dmInsertAtCursor(input, ':' + name + ': '); panel.classList.remove('is-open'); });
                grid.appendChild(b);
            });
        } else {
            const cat = (window.emojiCategories || []).find(c => c.id === catId);
            if (!cat) return;
            content.appendChild(dmEl('div', 'dc-emoji-title', cat.name));
            cat.items.forEach(emj => {
                const b = dmEl('button', 'dc-emoji-item', emj);
                b.type = 'button';
                b.addEventListener('click', () => dmInsertAtCursor(input, emj));
                grid.appendChild(b);
            });
        }
        content.appendChild(grid);
        content.scrollTop = 0;
    };

    const addTab = (icon, title, catId) => {
        const t = dmEl('button', 'dc-emoji-tab', icon);
        t.type = 'button';
        t.title = title;
        t.addEventListener('click', () => showCategory(catId, t));
        tabs.appendChild(t);
        return t;
    };
    addTab('⭐', 'Custom Emotes', 'custom');
    let firstTab = null;
    (window.emojiCategories || []).forEach((cat, i) => { const t = addTab(cat.icon, cat.name, cat.id); if (i === 0) firstTab = t; });

    panel.appendChild(tabs);
    panel.appendChild(content);
    wrap.appendChild(panel);
    if (window.emojiCategories && window.emojiCategories.length) showCategory(window.emojiCategories[0].id, firstTab);
    return panel;
}
function dmToggleEmojiPanel() {
    const input = $dm('full-dm-input');
    if (!input) return;
    const wrap = input.closest('.dc-input-wrap');
    if (!wrap) return;
    let panel = $dm('dm-emoji-panel');
    if (!panel) panel = dmBuildEmojiPanel(wrap, input);
    panel.classList.toggle('is-open');
}

function initDmComposer() {
    const input = $dm('full-dm-input');
    if (!input || input.dataset.dcBound === '1') return;
    input.dataset.dcBound = '1';

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            sendPrivateMessage();
            return;
        }
        if (e.key === 'Escape') {
            const panel = $dm('dm-emoji-panel');
            if (panel && panel.classList.contains('is-open')) { panel.classList.remove('is-open'); return; }
            if (window.editingMsgKey) { e.preventDefault(); window.cancelEdit(); return; }
            if (replyingTo) { e.preventDefault(); window.cancelReply(); return; }
        }
        // Flecha arriba con la caja vacía = editar mi último mensaje (como en Discord)
        if (e.key === 'ArrowUp' && input.value === '' && !window.editingMsgKey) {
            const myUID = dmMyUid();
            for (let i = dmState.msgs.length - 1; i >= 0; i--) {
                const m = dmState.msgs[i];
                if (m.msg.sender === myUID && !m.msg.isDeleted) { e.preventDefault(); window.startEditMessage(m.key, m.msg); break; }
            }
        }
    });
    input.addEventListener('input', () => {
        dmAutoResize(input);
        dmUpdateSendBtn();
        if (input.value.trim() === '') dmStopTyping(); else dmTypingPing();
    });

    const emojiBtn = $dm('btn-dm-emoji');
    if (emojiBtn) { dmIcon(emojiBtn, DM_ICONS.emoji); emojiBtn.addEventListener('click', (e) => { e.stopPropagation(); dmToggleEmojiPanel(); }); }

    // El panel de emojis se cierra al hacer clic en cualquier otro lado
    document.addEventListener('mousedown', (e) => {
        const panel = $dm('dm-emoji-panel');
        if (!panel || !panel.classList.contains('is-open')) return;
        if (panel.contains(e.target) || (emojiBtn && emojiBtn.contains(e.target))) return;
        panel.classList.remove('is-open');
    });

    const box = $dm('full-dm-messages');
    if (box) {
        box.addEventListener('scroll', () => {
            dmUpdatePill();
            // Solo cuando la persona SUBE y llega arriba. Los saltos automáticos hacia abajo
            // (abrir el chat, mensaje nuevo, anclar tras cargar anteriores) no cuentan.
            const goingUp = box.scrollTop < dmLastScrollTop;
            dmLastScrollTop = box.scrollTop;
            if (goingUp && box.scrollTop < 120) dmLoadOlder();
        });
        // Con pocos mensajes (por ejemplo solo 6) la pantalla no tiene scroll: la rueda hacia arriba también pide más
        box.addEventListener('wheel', (e) => { if (e.deltaY < 0 && box.scrollTop <= 0) dmLoadOlder(); }, { passive: true });
    }
    const pill = $dm('chat-scroll-bottom-btn');
    if (pill) pill.addEventListener('click', () => { dmState.newWhileAway = 0; dmScrollBottom(); pill.style.display = 'none'; });

    const muteBtn = $dm('dm-mute-btn');
    if (muteBtn) muteBtn.addEventListener('click', () => { if (currentChatPartner) window.toggleChatMute(currentChatPartner.uid); });
    const menuBtn = $dm('chat-header-menu-btn');
    if (menuBtn) { dmIcon(menuBtn, DM_ICONS.kebab); menuBtn.addEventListener('click', (e) => { e.stopPropagation(); window.showChatHeaderMenu(menuBtn); }); }
    const sendBtn = $dm('btn-dm-send');
    if (sendBtn) { dmIcon(sendBtn, DM_ICONS.send); sendBtn.addEventListener('click', () => sendPrivateMessage()); }
    dmUpdateMuteButton();

    const search = $dm('dc-chat-search');
    if (search) search.addEventListener('input', () => dmPaintChatList($dm('full-chat-list-container')));

    // Al volver a la pestaña o a la ventana, marcamos como leído lo que llegó mientras no mirabas
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') window.dmMarkRead(); });
    window.addEventListener('focus', () => window.dmMarkRead());
}

// ------------------------------------------
// Lista de chats (barra izquierda)
// ------------------------------------------
function dmUpdateUserPanel() {
    const pfp = $dm('dc-me-pfp'), nm = $dm('dc-me-name');
    if (pfp) { pfp.onerror = () => { pfp.onerror = null; pfp.src = MP_DEFAULT_PFP; }; pfp.src = dmSafePfp(localStorage.getItem('mbw_profile_pic')); }
    if (nm) nm.textContent = localStorage.getItem('mbw_username') || 'Player';
}

// Una fila de la lista de chats (la usan la lista principal y la sección "Archivados")
function dmBuildChatRow(chat, activeUid, viewingNow) {
    const isActive = activeUid === chat.uid;
    const muted = window.isChatMuted(chat.uid);
    const unread = (chat.unreadCount > 0) && !(isActive && viewingNow);
    const row = dmEl('div', 'dc-chat-item' + (isActive ? ' active' : '') + (unread ? ' unread' : '') + (muted ? ' muted' : ''));
    row.dataset.uid = chat.uid;
    row.addEventListener('click', () => window.openPrivateChat(chat.uid, chat.name, chat.pfp));
    // Clic derecho sobre un chat: archivar / silenciar sin tener que abrirlo
    row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        dmOpenMenu(e.clientX, e.clientY, (menu) => {
            const archived = window.isChatArchived(chat.uid);
            dmMenuItem(menu, archived ? dmT('dm_unarchive', 'Desarchivar chat') : dmT('dm_archive', 'Archivar chat'), archived ? DM_ICONS.unarchive : DM_ICONS.archive, () => window.toggleChatArchive(chat.uid));
            dmMenuItem(menu, muted ? dmT('dm_unmute', 'Activar notificaciones') : dmT('dm_mute', 'Silenciar chat'), muted ? DM_ICONS.bell : DM_ICONS.bellOff, () => window.toggleChatMute(chat.uid));
        });
    });

    const av = dmEl('div', 'dc-chat-avatar');
    av.appendChild(dmAvatar(chat.pfp, 'dc-avatar-sm'));
    av.appendChild(dmEl('span', 'dc-status-dot' + (chat.isOnline ? ' is-online' : '')));
    row.appendChild(av);

    const meta = dmEl('div', 'dc-chat-meta');
    meta.appendChild(dmEl('div', 'dc-chat-name', chat.name));
    meta.appendChild(dmEl('div', 'dc-chat-sub' + (chat.lastMsg ? '' : ' is-empty'), chat.lastMsg || dmT('dm_no_messages', 'Sin mensajes')));
    row.appendChild(meta);

    if (muted) { const mi = document.createElement('span'); mi.className = 'dc-mute-icon'; mi.innerHTML = DM_ICONS.bellOff; mi.firstChild.setAttribute('fill', 'currentColor'); row.appendChild(mi); }
    if (unread) row.appendChild(dmEl('div', 'dc-badge', chat.unreadCount > 99 ? '99+' : String(chat.unreadCount)));
    return row;
}

function dmPaintChatList(container) {
    if (!container) return;
    const search = $dm('dc-chat-search');
    const q = search ? search.value.trim().toLowerCase() : '';
    const shown = q ? dmChatCache.filter(c => String(c.name).toLowerCase().includes(q)) : dmChatCache;

    const keepScroll = container.scrollTop;   // al repintar la lista (p. ej. al abrir un chat) NO debe saltar hasta arriba
    container.textContent = '';
    // Los chats archivados no salen en la lista principal: van en una fila "Archivados" arriba de todo (como en WhatsApp)
    const archivedMap = window.getArchivedChats();
    const mainChats = shown.filter(c => !archivedMap[c.uid]);
    const archivedChats = shown.filter(c => archivedMap[c.uid]);

    if (shown.length === 0) {
        container.appendChild(dmEl('div', 'dc-chat-empty', q ? dmT('dm_no_results', 'Sin resultados.') : dmT('dm_no_chats', 'No hay chats ni amigos disponibles.')));
        return;
    }
    const activeUid = currentChatPartner ? currentChatPartner.uid : null;
    const viewingNow = dmViewActive();
    const frag = document.createDocumentFragment();

    // Fila "Archivados" ARRIBA de la lista (como en WhatsApp). Se abre y se cierra con un clic. Si estás buscando, o el chat que
    // tienes abierto está archivado, se abre sola. A la derecha: globito rojo si hay archivados con mensajes nuevos, y cuántos hay.
    if (archivedChats.length > 0) {
        const open = dmArchivedOpen || !!q || archivedChats.some(c => c.uid === activeUid);
        const unreadArchived = archivedChats.reduce((n, c) => n + ((c.unreadCount > 0 && !window.isChatMuted(c.uid)) ? 1 : 0), 0);
        const head = dmEl('div', 'dc-archived-head' + (open ? ' is-open' : ''));
        head.id = 'dc-archived-head';
        head.setAttribute('role', 'button');
        head.title = dmT('dm_archived_hint', 'Los chats archivados nunca se borran solos');
        const ico = document.createElement('span'); ico.className = 'dc-archived-icon'; ico.innerHTML = DM_ICONS.archive; head.appendChild(ico);
        head.appendChild(dmEl('span', 'dc-archived-label', dmT('dm_archived_section', 'Archivados')));
        if (unreadArchived > 0) head.appendChild(dmEl('span', 'dc-badge', String(unreadArchived)));
        head.appendChild(dmEl('span', 'dc-archived-count', String(archivedChats.length)));
        head.appendChild(dmEl('span', 'dc-archived-arrow', open ? '▾' : '▸'));
        head.addEventListener('click', () => { dmArchivedOpen = !open; dmPaintChatList(container); });
        frag.appendChild(head);
        if (open) {
            const box = dmEl('div', 'dc-archived-list');
            archivedChats.forEach(chat => box.appendChild(dmBuildChatRow(chat, activeUid, viewingNow)));
            frag.appendChild(box);
        }
    }

    mainChats.forEach(chat => frag.appendChild(dmBuildChatRow(chat, activeUid, viewingNow)));
    if (mainChats.length === 0 && archivedChats.length > 0) {
        frag.appendChild(dmEl('div', 'dc-chat-empty', q ? dmT('dm_no_results', 'Sin resultados.') : dmT('dm_all_archived', 'Todos tus chats están archivados.')));
    }
    container.appendChild(frag);
    container.scrollTop = keepScroll;
}

window.renderChatList = function(container) {
    if (!container) return;
    const myUID = dmMyUid();
    if (!myUID) return;
    dmUpdateUserPanel();

    database.ref('friends/' + myUID).once('value', (friendsSnap) => {
        const friends = friendsSnap.val() || {};
        database.ref('user_chats/' + myUID).once('value', (snapshot) => {
            const myChats = snapshot.val() || {};
            const chatEntries = {};

            // Unificamos chats existentes y amigos
            for (const uid in myChats) { chatEntries[uid] = myChats[uid]; }
            for (const uid in friends) {
                if (!chatEntries[uid]) chatEntries[uid] = { lastMsg: '', timestamp: 0, unreadCount: 0 };
            }

            // "Unknown User": el nombre y la foto se buscan en varios lados
            // (usuarios en línea, el registro del chat, el registro del amigo).
            dmChatCache = Object.keys(chatEntries)
                .filter(uid => !window.isBlocked(uid))
                .map(uid => {
                    const rec = chatEntries[uid] || {};
                    const info = window.resolveChatInfo(uid, rec, friends[uid]);
                    return { uid, ...rec, name: info.name, pfp: info.pfp, isOnline: info.online, isFriend: (uid in friends) };
                })
                // Un registro vacío (sin mensajes, sin ser amigo, sin nombre conocido) no aporta nada
                .filter(c => c.lastMsg || c.isFriend || window.isRealName(c.name))
                .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

            dmPaintChatList(container);
        });
    });
};

// ------------------------------------------
// Abrir una conversación
// ------------------------------------------
let dmLastStatus = null;
function dmUpdateHeaderStatus(status) {
    dmLastStatus = status || null;
    const textEl = $dm('chat-header-status-text');
    const dotEl = $dm('chat-status-dot');
    if (!textEl || !dotEl) return;
    if (status && status.isOnline) {
        textEl.textContent = dmT('dm_active_now', 'Activo ahora');
        textEl.classList.add('is-online');
        dotEl.classList.add('is-online');
    } else {
        textEl.textContent = status ? (typeof window.formatTimeAgo === 'function' ? window.formatTimeAgo(status.lastSeen) : dmT('dm_offline', 'Desconectado')) : dmT('dm_offline', 'Desconectado');
        textEl.classList.remove('is-online');
        dotEl.classList.remove('is-online');
    }
}

// Si cambian el idioma con el chat abierto, se vuelven a pintar los textos que ya estaban en pantalla
window.dmOnLanguageChanged = function() {
    try {
        if (dmState.chatId) {
            dmRenderAll();
            dmUpdateHeaderStatus(dmLastStatus);
            dmUpdateMuteButton();
            dmScrollBottom();
        }
        const list = $dm('full-chat-list-container');
        if (list && typeof window.renderChatList === 'function') window.renderChatList(list);
    } catch (e) { console.warn('[chat] idioma:', e); }
};

window.openPrivateChat = function(otherUid, otherName, otherPfp) {
    // 🚫 No se abre el chat de alguien bloqueado
    if (window.isBlocked(otherUid)) {
        window.mpToast('🚫 Bloqueado', 'Desbloquea a ' + (otherName || 'este usuario') + ' para escribirle.');
        return;
    }
    const myUID = dmMyUid();
    if (!myUID || !otherUid) return;

    // El nombre/foto que nos llegan pueden venir vacíos o con valores de relleno
    // ("Unknown User", "undefined"). Los resolvemos aquí para no guardarlos nunca como reales.
    const resolved = window.resolveChatInfo(otherUid, { name: otherName, pfp: otherPfp });
    otherName = resolved.name;
    otherPfp = resolved.pfp;

    initDmComposer();

    const placeholder = $dm('full-chat-placeholder');
    const activeChat = $dm('full-chat-active');
    if (placeholder) placeholder.style.display = 'none';
    if (activeChat) activeChat.style.display = 'flex';

    // Borrador: el texto a medias se queda con SU chat
    const input = $dm('full-dm-input');
    const newChatId = myUID < otherUid ? myUID + '_' + otherUid : otherUid + '_' + myUID;
    const changed = newChatId !== currentChatId;
    if (changed && currentChatId && input && !window.editingMsgKey) dmDrafts[currentChatId] = input.value;

    window.closeDmListeners();            // apaga lo del chat anterior
    if (changed) resetChatComposer();

    currentChatId = newChatId;
    currentChatPartner = { uid: otherUid, name: otherName, pfp: otherPfp };
    const token = dmState.token;
    dmState.chatId = newChatId;
    dmState.msgs = [];
    dmState.byKey = new Map();
    dmState.rows.clear();
    dmState.hasMore = false;
    dmState.firstUnreadKey = null;

    if (changed && input) { input.value = dmDrafts[newChatId] || ''; dmAutoResize(input); dmUpdateSendBtn(); }

    // Cabecera
    const headerName = $dm('full-chat-header-name');
    const headerPfp = $dm('full-chat-header-pfp');
    if (headerName) headerName.textContent = otherName;
    if (headerPfp) { headerPfp.onerror = () => { headerPfp.onerror = null; headerPfp.src = MP_DEFAULT_PFP; }; headerPfp.src = dmSafePfp(otherPfp); }
    const st = $dm('chat-header-status-text');
    if (st) { st.textContent = dmT('dm_loading', 'Cargando…'); st.classList.remove('is-online'); }
    const dot = $dm('chat-status-dot');
    if (dot) dot.classList.remove('is-online');
    dmUpdateMuteButton();

    const box = $dm('full-dm-messages');
    if (box) { box.textContent = ''; box.appendChild(dmEl('div', 'dc-loading', dmT('dm_loading', 'Cargando…'))); }

    // Estado de la otra persona (activo ahora / hace X)
    dmState.statusRef = database.ref('users_status/' + otherUid);
    dmState.statusCb = dmState.statusRef.on('value', snap => dmUpdateHeaderStatus(snap.val()));

    // "Está escribiendo..." de la otra persona
    const ti = $dm('dm-typing-indicator');
    dmState.typingRef = database.ref('typing_status/' + newChatId + '/' + otherUid);
    dmState.typingCb = dmState.typingRef.on('value', snap => {
        if (!ti) return;
        if (snap.val() === true) {
            ti.querySelector('.dc-typing-name').textContent = otherName;
            ti.classList.add('is-on');
            if (dmNearBottom(80)) dmScrollBottom();
        } else {
            ti.classList.remove('is-on');
        }
    });

    // Cuántos mensajes sin leer hay (para mostrar todos los nuevos aunque sean más de 6)
    const myChatRef = database.ref('user_chats/' + myUID + '/' + otherUid);
    myChatRef.once('value').then(
        snap => { if (token === dmState.token) dmLoadInitial(token, snap.exists() ? Number(snap.val().unreadCount) || 0 : 0); },
        () => { if (token === dmState.token) dmLoadInitial(token, 0); }
    );

    // Lista de la izquierda (para marcar este chat como abierto)
    const list = $dm('full-chat-list-container');
    if (list) window.renderChatList(list);

    if (input) input.focus();
};

// Preparar la caja de escribir en cuanto exista en la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initDmComposer, 0));
} else {
    setTimeout(initDmComposer, 0);
}
