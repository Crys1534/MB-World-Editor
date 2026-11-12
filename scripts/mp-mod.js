// ==========================================================
// 🛡 EXPULSAR, BANEAR Y SILENCIAR + 🔄 RECONECTAR SOLO (va después de scripts/mp-host.js)
//
//  · El anfitrión puede expulsar (kick: puede volver a entrar), banear (ban: ya no puede entrar a este mundo)
//    y silenciar (mute: sigue jugando pero sus mensajes del chat no le llegan a nadie).
//    Desde el menú de pausa del Modo Jugar, desde la lista de jugadores del editor o con comandos:
//    /kick nombre · /ban nombre · /unban nombre · /banlist · /mute nombre · /unmute nombre
//    Los baneados y silenciados se guardan EN EL MUNDO (mbweBans / mbweMutes), así siguen así la próxima vez,
//    y se les pasan a todos los jugadores (por si a alguno le toca ser el anfitrión nuevo).
//  · Si a un jugador se le cae el internet, ya no lo saca del servidor: se queda esperando y vuelve a entrar solo
//    en cuanto regresa la conexión (hasta 2 minutos). Si estaba jugando, sigue en la partida.
// ==========================================================
(function () {
    'use strict';
    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function inMp() { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; }
    function amHost() { return typeof isHost !== 'undefined' && !!isHost; }
    function myUid() { return localStorage.getItem('mbw_uid'); }
    function players() { return Array.isArray(window.roomPlayers) ? window.roomPlayers : []; }
    function clients() { return (typeof misClientes !== 'undefined' && Array.isArray(misClientes)) ? misClientes : []; }
    function W() { return (typeof mbwom !== 'undefined' && mbwom.world) ? mbwom.world : null; }
    function list(key) { const w = W(); if (!w) return {}; if (!w[key] || typeof w[key] !== 'object' || Array.isArray(w[key])) w[key] = {}; return w[key]; }
    const bans = () => list('mbweBans'), mutes = () => list('mbweMutes');
    function unsaved() { if (typeof window.markWorldUnsaved === 'function') { try { window.markWorldUnsaved(); } catch (e) { /* nada */ } } }
    function toast(title, body) {
        if (typeof window.mpToast === 'function') window.mpToast(title, body || '');
        else if (typeof showDesktopNotification === 'function') showDesktopNotification(title, body || '', 'assets/default pfp.png');
    }
    function chatNote(text) {
        try { if (typeof window.agregarMensajeChatPublico === 'function') window.agregarMensajeChatPublico('Server', text); } catch (e) { /* nada */ }
        try { if (window.mbwMpPlay && window.mbwMpPlay.on && window.mbwMpPlay.sysSay) window.mbwMpPlay.sysSay(text); } catch (e) { /* nada */ }
    }
    function connOf(uid) { const p = players().find(q => q.uid === uid); return p ? clients().find(c => c.peer === p.peerId) : null; }
    function syncAll() { if (amHost() && inMp() && typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'sync_players', players: window.roomPlayers }); }
    function refreshLists() {
        if (typeof window.renderLivePlayers === 'function') { try { window.renderLivePlayers(); } catch (e) { /* nada */ } }
        if (typeof window.renderPresenceList === 'function') { try { window.renderPresenceList(); } catch (e) { /* nada */ } }
    }

    window.mpIsBanned = uid => !!(uid && bans()[uid]);
    window.mpIsMuted = uid => !!(uid && mutes()[uid]);
    window.mpBanList = () => Object.keys(bans()).map(uid => ({ uid: uid, name: String(bans()[uid] || 'Player') }));
    window.mpAmMuted = () => !amHost() && inMp() && !!window.mpMeMuted;

    // ---------------------------------------------------------------- 🥾 expulsar (sin preguntar: la pregunta la hace quien llama)
    function kick(uid, ban) {
        const c = connOf(uid);
        if (!c) return false;
        try { c.send({ tipo: 'kicked', ban: ban ? 1 : 0, mensaje: ban ? tr('mp_banned_msg', 'You were banned from this server.') : tr('mp_kicked_msg', 'You were kicked from the server by the host.') }); } catch (e) { /* nada */ }
        c.__kickedByHost = true;
        setTimeout(() => { try { c.close(); } catch (e) { /* nada */ } }, 500);
        return true;
    }
    window.mpKick = function (uid, name) {
        if (!amHost() || !uid || uid === myUid()) return false;
        if (!kick(uid, false)) return false;
        chatNote('🥾 ' + tr('mp_kicked_note', '{name} was kicked.', { name: name || 'Player' }));
        return true;
    };
    // ---------------------------------------------------------------- 🚫 banear / desbanear
    window.mpBan = function (uid, name) {
        if (!amHost() || !uid || uid === myUid()) return false;
        const p = players().find(q => q.uid === uid);
        bans()[uid] = String(name || (p && p.name) || 'Player').slice(0, 40);
        unsaved();
        kick(uid, true);
        chatNote('🚫 ' + tr('mp_banned_note', '{name} was banned.', { name: bans()[uid] }));
        syncAll(); refreshLists();
        return true;
    };
    window.mpUnban = function (uid) {
        if (!amHost() || !bans()[uid]) return false;
        const n = bans()[uid];
        delete bans()[uid];
        unsaved(); syncAll(); refreshLists();
        chatNote('✅ ' + tr('mp_unbanned_note', '{name} can join again.', { name: n }));
        return true;
    };
    // ---------------------------------------------------------------- 🔇 silenciar
    window.mpMute = function (uid, name, on) {
        if (!amHost() || !uid || uid === myUid()) return false;
        const p = players().find(q => q.uid === uid);
        const nm = String(name || (p && p.name) || 'Player').slice(0, 40);
        if (on === undefined) on = !mutes()[uid];
        if (on) mutes()[uid] = nm; else delete mutes()[uid];
        unsaved();
        const c = connOf(uid);
        if (c) { try { c.send({ tipo: 'silenciado', on: on ? 1 : 0 }); } catch (e) { /* nada */ } }
        chatNote((on ? '🔇 ' : '🔊 ') + (on ? tr('mp_muted_note', '{name} was muted.', { name: nm }) : tr('mp_unmuted_note', '{name} can chat again.', { name: nm })));
        syncAll(); refreshLists();
        return true;
    };

    // ---------------------------------------------------------------- comandos del chat: /kick /ban /unban /banlist /mute /unmute
    window.MP_MOD_CMDS = ['kick', 'ban', 'unban', 'banlist', 'mute', 'unmute'];
    window.mpModCommand = function (cmd, arg) {
        if (!inMp()) return tr('mp_mod_solo', 'This only works in a multiplayer world.');
        if (!amHost()) return tr('mp_mod_host', 'Only the host can do that.');
        const who = String(arg || '').trim().replace(/^@/, '');
        if (cmd === 'banlist') {
            const l = window.mpBanList();
            return l.length ? tr('mp_banlist', 'Banned: {list}', { list: l.map(b => b.name).join(', ') }) : tr('mp_banlist_none', 'Nobody is banned.');
        }
        if (!who) return '/' + cmd + ' ' + tr('mp_mod_usage', 'player_name');
        const low = who.toLowerCase();
        if (cmd === 'unban') {
            const b = window.mpBanList().find(x => x.name.toLowerCase() === low || x.uid === who);
            if (!b) return tr('mp_mod_not_banned', '"{name}" is not banned.', { name: who });
            window.mpUnban(b.uid); return tr('mp_unbanned_note', '{name} can join again.', { name: b.name });
        }
        const p = players().find(q => q.uid !== myUid() && (String(q.name || '').toLowerCase() === low || q.uid === who))
            || players().find(q => q.uid !== myUid() && String(q.name || '').toLowerCase().indexOf(low) === 0);
        if (!p) return tr('mpplay_tp_noone', 'There is no player called "{name}" in this game.', { name: who });
        if (cmd === 'kick') { window.mpKick(p.uid, p.name); return tr('mp_kicked_note', '{name} was kicked.', { name: p.name }); }
        if (cmd === 'ban') { window.mpBan(p.uid, p.name); return tr('mp_banned_note', '{name} was banned.', { name: p.name }); }
        if (cmd === 'mute') { window.mpMute(p.uid, p.name, true); return tr('mp_muted_note', '{name} was muted.', { name: p.name }); }
        if (cmd === 'unmute') { window.mpMute(p.uid, p.name, false); return tr('mp_unmuted_note', '{name} can chat again.', { name: p.name }); }
        return '';
    };

    // ---------------------------------------------------------------- (anfitrión) alguien dice quién es: ¿está baneado? ¿ya estaba (se reconectó)?
    window.mpModOnJoin = function (conn, data) {
        if (!data || !data.uid) return false;
        if (bans()[data.uid]) {
            conn.__banned = true;
            try { conn.send({ tipo: 'kicked', ban: 1, mensaje: tr('mp_banned_msg', 'You were banned from this server.') }); } catch (e) { /* nada */ }
            setTimeout(() => { try { conn.close(); } catch (e) { /* nada */ } }, 500);
            return true;
        }
        // 🔄 volvió alguien que se había caído: su conexión vieja (que todavía no se daba por perdida) se cierra sin avisos
        const old = players().find(p => p.uid === data.uid);
        if (old && old.peerId && old.peerId !== data.peerId) {
            const oc = clients().find(c => c.peer === old.peerId && c !== conn);
            if (oc) { oc.__replaced = true; setTimeout(() => { try { oc.close(); } catch (e) { /* nada */ } }, 50); }
        }
        return false;
    };
    // (anfitrión) un mensaje de chat de alguien silenciado no se pasa a nadie
    window.mpModDropChat = function (conn, data) {
        if (!data) return false;
        const isChat = data.tipo === 'chat' || (data.tipo === 'juego_sys' && data.k === 'say');
        if (!isChat) return false;
        const p = players().find(q => q.peerId === conn.peer);
        if (!p || !mutes()[p.uid]) return false;
        try { conn.send({ tipo: 'silenciado', on: 1 }); } catch (e) { /* nada */ }
        return true;
    };

    // ---------------------------------------------------------------- lo que se manda: la lista de jugadores lleva quién está baneado/silenciado
    let sendHooked = false, recvHooked = false;      // (una sola vez cada uno)
    function hookSend() {
        const o = window.enviarMensajeEnRed;
        if (sendHooked || typeof o !== 'function' || o.__mpMod) return;
        sendHooked = true;
        const w = function (d) {
            if (d && d.tipo === 'sync_players' && amHost()) {
                const m = mutes();
                (d.players || []).forEach(p => { if (p) p.muted = !!m[p.uid]; });
                d.mod = { bans: Object.assign({}, bans()), mutes: Object.assign({}, m) };
            }
            if (d && d.tipo === 'chat' && window.mpAmMuted()) { mutedNotice(); return; }   // (estoy silenciado: no se manda)
            return o.apply(this, arguments);
        };
        w.__mpMod = true;
        window.enviarMensajeEnRed = w;
    }
    function hookRecv() {
        const o = window.recibirMensajeDeRed;
        if (recvHooked || typeof o !== 'function' || o.__mpMod) return;
        recvHooked = true;
        const w = function (d) {
            if (d && d.tipo === 'ender_cofre') { if (typeof window.playerInvEnderSync === 'function') window.playerInvEnderSync(d.l); return; }   // 🟪 el cofre de ender (uno para todos)
            if (d && d.tipo === 'silenciado') { if (!amHost()) { window.mpMeMuted = !!d.on; toast(d.on ? '🔇 ' + tr('mp_you_muted', 'The host muted you: your messages are not sent.') : '🔊 ' + tr('mp_you_unmuted', 'The host unmuted you: you can chat again.')); } return; }
            if (d && d.tipo === 'sync_players' && !amHost()) {
                const me = (d.players || []).find(p => p && p.uid === myUid());
                if (me) window.mpMeMuted = !!me.muted;
                if (d.mod && W()) { W().mbweBans = Object.assign({}, d.mod.bans || {}); W().mbweMutes = Object.assign({}, d.mod.mutes || {}); }
            }
            return o.apply(this, arguments);
        };
        w.__mpMod = true;
        // (que los demás enganches —mp-play, mp-host— sigan viendo su marca)
        Object.keys(o).forEach(k => { try { w[k] = o[k]; } catch (e) { /* nada */ } });
        window.recibirMensajeDeRed = w;
    }
    let lastMutedNote = 0;
    function mutedNotice() {
        if (Date.now() - lastMutedNote < 1500) return;
        lastMutedNote = Date.now();
        toast('🔇 ' + tr('mp_you_muted', 'The host muted you: your messages are not sent.'));
    }
    window.mpMutedNotice = mutedNotice;

    // =====================================================================
    // 🔄 RECONECTAR SOLO
    // =====================================================================
    const RC_MAX_MS = 120000, RC_EVERY = 3000;
    window.mpReconnecting = null;
    function meOffline() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
        try { if (typeof peer !== 'undefined' && peer && (peer.disconnected || peer.destroyed)) return true; } catch (e) { /* nada */ }
        return false;
    }
    window.mpMeOffline = meOffline;
    function setStatus(text, color) { const s = document.getElementById('multiplayer-status'); if (s) { s.style.display = 'block'; s.innerText = 'Status: ' + text; s.style.color = color; } }
    function playingInGame() { return !!(window.mbwMpPlay && window.mbwMpPlay.on && window.mbwPlay && window.mbwPlay.isPlaying && window.mbwPlay.isPlaying()); }
    function banner(show, text) {
        let b = document.getElementById('mp-reconnect-banner');
        if (!show) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('div'); b.id = 'mp-reconnect-banner'; b.className = 'mp-reconnect-banner'; document.body.appendChild(b); }
        b.textContent = text;
    }
    // ¿a qué id(s) le intento? el anfitrión de siempre y, por si el anfitrión cambió mientras no estaba, los ids que usaría el nuevo
    function targets(R) {
        const out = [R.hostId];
        const cfg = window.mpRoomCfg;
        if (cfg && cfg.base) { const g = (cfg.gen || 0) + 1; for (let i = 0; i < 6; i++) out.push(cfg.base + '-m' + g + '-' + i); }
        return out.filter((x, i, a) => x && a.indexOf(x) === i);
    }
    // conn = la conexión que se perdió. true = me encargo yo (no hay que dar el aviso de "Desconectado")
    window.mpTryReconnect = function (conn) {
        if (window.mpReconnecting) return true;
        if (!conn || conn.__kicked || conn.__hostClosed || conn.__byMe || amHost()) return false;
        const hostId = conn.peer;
        if (!hostId) return false;
        const R = window.mpReconnecting = { hostId: hostId, t0: Date.now(), tries: 0, timer: null, play: playingInGame(), np: null };
        if (typeof miConexionAlHost !== 'undefined') miConexionAlHost = null;
        window.networkCursors = {};
        setStatus('🟡 ' + tr('mp_reconnecting', 'Connection lost: reconnecting…'), '#f1c40f');
        banner(true, '📡 ' + tr('mp_reconnecting', 'Connection lost: reconnecting…'));
        if (window.mbwMpPlay && window.mbwMpPlay.sysSay) window.mbwMpPlay.sysSay('📡 ' + tr('mp_reconnecting', 'Connection lost: reconnecting…'));
        schedule(R, 1200);
        return true;
    };
    function schedule(R, ms) { clearTimeout(R.timer); R.timer = setTimeout(function () { attempt(R); }, ms); }
    function giveUp(R) {
        if (window.mpReconnecting !== R) return;
        clearTimeout(R.timer);
        window.mpReconnecting = null;
        banner(false);
        try { if (R.np) R.np.destroy(); } catch (e) { /* nada */ }
        try { if (typeof window.disconnectFromMultiplayer === 'function') window.disconnectFromMultiplayer(true); } catch (e) { /* nada */ }
        alert(tr('mp_reconnect_fail', 'Could not reconnect to the server. Check your internet and join again.'));
    }
    window.mpCancelReconnect = function () { const R = window.mpReconnecting; if (!R) return; clearTimeout(R.timer); window.mpReconnecting = null; banner(false); try { if (R.np && R.np !== peer) R.np.destroy(); } catch (e) { /* nada */ } };
    function attempt(R) {
        if (window.mpReconnecting !== R) return;
        if (Date.now() - R.t0 > RC_MAX_MS) { giveUp(R); return; }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { schedule(R, RC_EVERY); return; }   // (sin internet: se espera)
        R.tries++;
        banner(true, '📡 ' + tr('mp_reconnecting_n', 'Connection lost: reconnecting… (try {n})', { n: R.tries }));
        // un "Peer" nuevo cada vez (con otra id: así el anfitrión no confunde la conexión nueva con la vieja)
        try { if (R.np) { const o = R.np; R.np = null; setTimeout(() => { try { o.destroy(); } catch (e) { /* nada */ } }, 0); } } catch (e) { /* nada */ }
        try { if (typeof peer !== 'undefined' && peer && peer !== R.np) { const o = peer; setTimeout(() => { try { o.destroy(); } catch (e) { /* nada */ } }, 0); } } catch (e) { /* nada */ }
        let np;
        try { np = new Peer(); } catch (e) { schedule(R, RC_EVERY); return; }
        R.np = np;
        peer = np;
        const ids = targets(R);
        let done = false, pending = ids.length;
        const fail = () => { if (done || window.mpReconnecting !== R) return; if (--pending <= 0) schedule(R, RC_EVERY); };
        np.on('error', function () { if (!done && window.mpReconnecting === R && np.disconnected) schedule(R, RC_EVERY); });
        np.on('open', function () {
            if (window.mpReconnecting !== R) return;
            ids.forEach(function (id) {
                let conn;
                try { conn = np.connect(id, { reliable: true }); } catch (e) { fail(); return; }
                conn.__migrated = R.play;            // jugando: ya tengo el mundo (no se vuelve a bajar); editando: se baja otra vez, por si cambió
                let opened = false;
                conn.on('open', function () {
                    if (done || window.mpReconnecting !== R) { try { conn.__byMe = true; conn.close(); } catch (e) { /* nada */ } return; }
                    opened = true; done = true;
                    clearTimeout(R.timer);
                    window.mpReconnecting = null;
                    miConexionAlHost = conn;
                    isMultiplayer = true;
                    window.mpLastHostMsg = Date.now();
                    banner(false);
                    setStatus('CONNECTED! 🟢', '#4CAF50');
                    toast('📡 ' + tr('mp_reconnected', 'Reconnected!'));
                    if (window.mbwMpPlay && window.mbwMpPlay.sysSay) window.mbwMpPlay.sysSay('📡 ' + tr('mp_reconnected', 'Reconnected!'));
                    // jugando: pedir lo que cambió mientras no estaba
                    setTimeout(function () { try { if (window.mbwMpPlay && window.mbwMpPlay.afterReconnect) window.mbwMpPlay.afterReconnect(); } catch (e) { /* nada */ } }, 400);
                });
                setupClientConnection(conn);
                conn.on('error', function () { if (!opened) fail(); });
                conn.on('close', function () { if (!opened) fail(); });
                setTimeout(function () { if (!opened && !done) { try { conn.__byMe = true; conn.close(); } catch (e) { /* nada */ } fail(); } }, 6000);
            });
        });
        // si ni siquiera llega al servidor de conexiones en 8 s, otra vez
        setTimeout(function () { if (!done && window.mpReconnecting === R && !np.open) schedule(R, 500); }, 8000);
    }
    window.addEventListener('online', function () { const R = window.mpReconnecting; if (R) schedule(R, 300); });

    hookSend(); hookRecv();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hookSend(); hookRecv(); });
    setTimeout(function () { hookSend(); hookRecv(); }, 1600);
})();
