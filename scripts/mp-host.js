// ==========================================================
// 👑 MIGRACIÓN DE ANFITRIÓN + ↩️ DESHACER POR JUGADOR (va después de scripts/multiplayer.js)
//
//  · Si el anfitrión se va (sale, cierra la pestaña del mundo, cierra el navegador o se le cae el internet),
//    el servidor NO se cierra: otro jugador pasa a ser el anfitrión y los demás se reconectan solos con él.
//    Todos ya tienen el mundo, así que no se vuelve a descargar.
//    Quién sigue: primero los que pueden editar, en el orden en que entraron; después los demás.
//    Cada uno sabe el orden porque el anfitrión manda la lista de jugadores y los ajustes de la sala ("room_cfg").
//  · Deshacer por jugador: Ctrl+Z solo deshace lo que hiciste TÚ. Lo que hacen los demás (rellenar, pegar, borrar)
//    ya no entra en tu historial, y si alguien cambió un bloque después de ti, tu Ctrl+Z no se lo borra.
// ==========================================================
(function () {
    'use strict';
    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function inMp() { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; }
    function amHost() { return typeof isHost !== 'undefined' && !!isHost; }
    function myUid() { return localStorage.getItem('mbw_uid'); }
    function myName() { return localStorage.getItem('mbw_username') || 'Player'; }
    function players() { return Array.isArray(window.roomPlayers) ? window.roomPlayers : []; }
    function toast(title, body) {
        if (typeof window.mpToast === 'function') window.mpToast(title, body || '');
        else if (typeof showDesktopNotification === 'function') showDesktopNotification(title, body || '', 'assets/default pfp.png');
    }
    function chatNote(text) { try { if (typeof window.agregarMensajeChatPublico === 'function') window.agregarMensajeChatPublico('Server', text); } catch (e) { /* nada */ } }

    // =====================================================================
    // ajustes de la sala (los manda el anfitrión; los jugadores los guardan por si les toca ser anfitrión)
    // =====================================================================
    function baseId(id) { return String(id || '').split('-m')[0]; }
    function hostCfg() {
        return {
            base: baseId(window.currentRoomId), gen: window.mpGen || 0, hostUid: myUid(), hostName: myName(),
            access: window.multiplayerAccess || 'public', max: window.multiplayerPlayerLimit || 5,
            mapName: window.mpSelectedMapName || null, mapThumb: window.mpSelectedMapThumb || null,
            perms: Object.assign({}, window.mpEditPerms || {}),
            levels: Object.assign({}, window.mpPermLevels || {}),
            permWorld: window.mpPermWorldKey || null
        };
    }
    window.mpHostCfg = hostCfg;
    let lastCfgSig = '', lastCfgAt = 0;
    function broadcastCfg(force) {
        if (!inMp() || !amHost() || typeof enviarMensajeEnRed !== 'function') return;
        const cfg = hostCfg(), sig = JSON.stringify(cfg);
        if (!force && sig === lastCfgSig && Date.now() - lastCfgAt < 10000) return;
        lastCfgSig = sig; lastCfgAt = Date.now();
        enviarMensajeEnRed({ tipo: 'room_cfg', cfg: cfg });
    }
    setInterval(function () { broadcastCfg(false); }, 1500);

    // Orden de sucesión: primero los que pueden editar (en el orden en que entraron), luego los demás
    function successors(cfg) {
        const list = players().filter(p => p && p.uid && p.uid !== cfg.hostUid && p.peerId);
        return list.filter(p => p.canEdit).concat(list.filter(p => !p.canEdit));
    }
    window.mpSuccessors = function () { return successors(window.mpRoomCfg || hostCfg()).map(p => p.name); };

    // =====================================================================
    // el anfitrión se va: avisa a todos que el servidor sigue con otro
    // =====================================================================
    window.mpHostLeaving = function () {
        if (!amHost() || !inMp() || typeof misClientes === 'undefined' || !misClientes.length) return false;
        const cfg = hostCfg();
        cfg.players = players();
        misClientes.forEach(c => { try { c.send({ tipo: 'host_migra', cfg: cfg }); } catch (e) { /* nada */ } });
        return true;
    };
    window.addEventListener('beforeunload', function () { try { window.mpHostLeaving(); } catch (e) { /* nada */ } });

    // =====================================================================
    // un jugador perdió al anfitrión: buscar (o ser) el nuevo
    // =====================================================================
    const TRY_MS = 10000;     // cuánto se espera a cada candidato antes de pasar al siguiente
    window.mpMigrating = null;
    window.mpMigrateOnHostLost = function (conn) {
        if (window.mpMigrating) return true;   // (un intento de conexión que falló mientras buscamos al nuevo)
        if (!inMp() || amHost() || conn.__kicked || conn.__hostClosed || conn.__byMe) return false;
        const cfg = (conn.__migrate) || window.mpRoomCfg;
        if (!cfg || !cfg.base) return false;
        if (conn.__migrate && Array.isArray(conn.__migrate.players)) window.roomPlayers = conn.__migrate.players;
        const cands = successors(cfg);
        if (!cands.length) return false;
        const M = window.mpMigrating = { cfg: cfg, cands: cands, idx: -1, gen: (cfg.gen || 0) + 1, timer: null, conn: null, t0: Date.now() };
        // limpieza de lo del anfitrión viejo
        if (typeof miConexionAlHost !== 'undefined') miConexionAlHost = null;
        if (window.networkCursors) Object.keys(window.networkCursors).forEach(k => { if (!players().some(p => p.peerId === k) || (players().find(p => p.peerId === k) || {}).uid === cfg.hostUid) delete window.networkCursors[k]; });
        window.spectatingTargetId = null;
        window.roomPlayers = players().filter(p => p.uid !== cfg.hostUid);
        if (typeof window.renderLivePlayers === 'function') window.renderLivePlayers();
        toast('👑 ' + tr('mig_title', 'The host left'), tr('mig_body', 'Changing host… the server keeps going.'));
        setStatus('🟡 ' + tr('mig_status', 'Changing host…'), '#f1c40f');
        next(M);
        return true;
    };
    function idFor(M, i) { return M.cfg.base + '-m' + M.gen + '-' + i; }
    function setStatus(text, color) { const s = document.getElementById('multiplayer-status'); if (s) { s.style.display = 'block'; s.innerText = 'Status: ' + text; s.style.color = color; } }
    function next(M) {
        if (window.mpMigrating !== M) return;
        clearTimeout(M.timer);
        M.idx++;
        if (M.idx >= M.cands.length) { giveUp(M); return; }
        const c = M.cands[M.idx];
        if (c.uid === myUid()) becomeHost(M, idFor(M, M.idx));
        else connectTo(M, idFor(M, M.idx), c);
    }
    function giveUp(M) {
        window.mpMigrating = null;
        try { if (typeof window.disconnectFromMultiplayer === 'function') window.disconnectFromMultiplayer(true); } catch (e) { /* nada */ }
        alert(tr('msg_disconnected', 'Disconnected from Server.'));
    }
    function done(M, newHostName, newHostUid) {
        clearTimeout(M.timer);
        window.mpMigrating = null;
        window.mpLastHostMsg = Date.now();
        window.mpGen = M.gen;
        window.mpRoomCfg = Object.assign({}, M.cfg, { gen: M.gen, hostUid: newHostUid, hostName: newHostName });
        chatNote('👑 ' + tr('mig_new_host', '{name} is the new host.', { name: newHostName }));
        toast('👑 ' + tr('mig_done_title', 'New host'), tr('mig_new_host', '{name} is the new host.', { name: newHostName }));
    }

    // ----- me toca: soy el anfitrión nuevo
    function becomeHost(M, id) {
        const cfg = M.cfg;
        try { if (peer) { const old = peer; setTimeout(() => { try { old.destroy(); } catch (e) { /* nada */ } }, 0); } } catch (e) { /* nada */ }
        isHost = true;
        misClientes = [];
        window.mpEditPerms = Object.assign({}, cfg.perms || {});
        window.mpPermLevels = Object.assign({}, cfg.levels || {});
        window.mpPermWorldKey = cfg.permWorld || cfg.mapName || window.mpPermWorldKey;
        window.multiplayerAccess = cfg.access || 'public';
        window.multiplayerPlayerLimit = cfg.max || 5;
        if (cfg.mapName) window.mpSelectedMapName = cfg.mapName;
        if (cfg.mapThumb) window.mpSelectedMapThumb = cfg.mapThumb;
        window.mpPrevOrder = players().map(p => p.uid);   // el orden en que habían entrado
        const np = new Peer(id);
        peer = np;
        M.timer = setTimeout(() => { if (window.mpMigrating === M) { isHost = false; next(M); } }, TRY_MS);
        np.on('open', function (pid) {
            if (window.mpMigrating !== M) return;
            window.currentRoomId = pid;
            window.roomPlayers = [{ uid: myUid(), name: myName(), pfp: localStorage.getItem('mbw_profile_pic') || 'assets/default pfp.png', peerId: pid, canEdit: true }];
            isMultiplayer = true;
            const pin = document.getElementById('my-peer-id'); if (pin) pin.value = pid;
            setStatus('1/' + window.multiplayerPlayerLimit + ' Players 🟢', '#4CAF50');
            try {
                if (typeof database !== 'undefined') {
                    window.myRoomRef = database.ref('servers/' + pid);
                    window.myRoomRef.set({ hostName: myName(), hostUid: myUid(), mapName: window.mpSelectedMapName || null, mapThumb: window.mpSelectedMapThumb || null,
                        access: window.multiplayerAccess, currentPlayers: 1, maxPlayers: window.multiplayerPlayerLimit,
                        timestamp: (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue) ? firebase.database.ServerValue.TIMESTAMP : Date.now() });
                    window.myRoomRef.onDisconnect().remove();
                }
            } catch (e) { /* nada */ }
            if (typeof window.renderLivePlayers === 'function') window.renderLivePlayers();
            if (typeof window.renderPresenceList === 'function') window.renderPresenceList();
            done(M, myName(), myUid());
            broadcastCfg(true);
        });
        np.on('connection', function (conn) {
            if (misClientes.length >= window.multiplayerPlayerLimit - 1) {
                conn.on('open', () => { conn.send({ tipo: 'error_conexion', mensaje: 'Server is full.' }); setTimeout(() => conn.close(), 500); });
                return;
            }
            setupHostConnection(conn);
        });
        np.on('error', function (err) {
            if (window.mpMigrating === M && err && err.type === 'unavailable-id') { isHost = false; next(M); }
        });
    }

    // ----- le toca a otro: conectarme con él (con reintentos)
    function connectTo(M, id, cand) {
        const deadline = Date.now() + TRY_MS;
        setStatus('🟡 ' + tr('mig_connecting', 'Connecting to the new host ({name})…', { name: cand.name }), '#f1c40f');
        function attempt() {
            if (window.mpMigrating !== M) return;
            if (Date.now() > deadline) { next(M); return; }
            if (!peer || peer.destroyed || peer.disconnected) { M.timer = setTimeout(attempt, 800); return; }
            let conn;
            try { conn = peer.connect(id, { reliable: true }); } catch (e) { M.timer = setTimeout(attempt, 1200); return; }
            M.conn = conn;
            conn.__migrated = true;
            let opened = false;
            conn.on('open', function () {
                if (window.mpMigrating !== M) { try { conn.close(); } catch (e) { /* nada */ } return; }
                opened = true;
                clearTimeout(M.timer);
                miConexionAlHost = conn;
                isMultiplayer = true;
                window.currentRoomId = id;
                done(M, cand.name, cand.uid);
                setStatus('CONNECTED! 🟢', '#4CAF50');
            });
            setupClientConnection(conn);   // (manda quién soy en cuanto se abre; con "migrated" no se baja el mapa otra vez)
            conn.on('close', function () { if (!opened && window.mpMigrating === M) { clearTimeout(M.timer); M.timer = setTimeout(attempt, 600); } });
            M.timer = setTimeout(function () { if (!opened && window.mpMigrating === M) { try { conn.close(); } catch (e) { /* nada */ } attempt(); } }, 1800);
        }
        attempt();
    }

    // =====================================================================
    // 💓 "sigo aquí": si el anfitrión se cae de golpe (se cerró el navegador, se fue el internet), la conexión
    // puede tardar mucho en darse cuenta. Cada uno avisa cada 2.5 s; 9 s sin saber del anfitrión = se fue.
    // =====================================================================
    const HB_MS = 2500, HOST_LOST_MS = 9000, GUEST_LOST_MS = 20000;
    setInterval(function () {
        if (!inMp()) return;
        const now = Date.now();
        if (amHost()) {
            (typeof misClientes !== 'undefined' ? misClientes.slice() : []).forEach(function (c) {
                if (!c.open) return;
                try { c.send({ tipo: 'hb' }); } catch (e) { /* nada */ }
                if (c.__hb && now - (c.__lastSeen || now) > GUEST_LOST_MS) { try { c.close(); } catch (e) { /* nada */ } }   // ese jugador ya no responde
            });
        } else if (!window.mpMigrating && !window.mpReconnecting && typeof miConexionAlHost !== 'undefined' && miConexionAlHost && miConexionAlHost.open) {
            try { miConexionAlHost.send({ tipo: 'hb' }); } catch (e) { /* nada */ }
            const last = window.mpLastHostMsg || now;
            if (now - last > HOST_LOST_MS && window.mpRoomCfg) {
                const c = miConexionAlHost;
                c.__lost = true;
                // 📡 ¿el que se quedó sin internet soy YO? entonces no se busca anfitrión nuevo: se vuelve a entrar solo (scripts/mp-mod.js)
                if (typeof window.mpMeOffline === 'function' && window.mpMeOffline() && typeof window.mpTryReconnect === 'function' && window.mpTryReconnect(c)) { try { c.__byMe = true; c.close(); } catch (e) { /* nada */ } }
                else if (window.mpMigrateOnHostLost(c)) { try { c.__byMe = true; c.close(); } catch (e) { /* nada */ } }
            }
        }
    }, HB_MS);

    // =====================================================================
    // mensajes nuevos
    // =====================================================================
    let recvHooked = false;      // (una sola vez: si otro archivo se engancha después, aquí no se vuelve a envolver; antes los mensajes pasaban 2 o 3 veces)
    function hookReceive() {
        const orig = window.recibirMensajeDeRed;
        if (recvHooked || typeof orig !== 'function' || orig.__mpHost) return;
        recvHooked = true;
        const w = function (d) {
            if (d && d.tipo === 'room_cfg') { if (!amHost() && d.cfg) { window.mpRoomCfg = d.cfg; window.mpGen = d.cfg.gen || 0; } return; }
            if (d && d.tipo === 'host_migra') return;
            if (d && d.tipo === 'player_info' && amHost()) setTimeout(function () { broadcastCfg(true); }, 300);   // el que entra sabe enseguida los ajustes
            // lo que hacen los demás no entra en MI historial de deshacer
            const hm = (typeof historyManager !== 'undefined') ? historyManager : null;
            if (hm) hm.muted = (hm.muted || 0) + 1;
            try { return orig.apply(this, arguments); }
            finally {
                if (hm) hm.muted--;
                // anfitrión nuevo: los que se reconectan quedan en el MISMO orden de antes (para la próxima sucesión)
                if (d && d.tipo === 'player_info' && amHost() && Array.isArray(window.mpPrevOrder) && Array.isArray(window.roomPlayers)) {
                    const ord = window.mpPrevOrder, me = myUid();
                    const rank = p => p.uid === me ? -1 : (ord.indexOf(p.uid) < 0 ? 1e6 : ord.indexOf(p.uid));
                    const before = window.roomPlayers.map(p => p.uid).join();
                    window.roomPlayers.sort((a, b) => rank(a) - rank(b));
                    if (window.roomPlayers.map(p => p.uid).join() !== before && typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'sync_players', players: window.roomPlayers });
                }
            }
        };
        w.__mpHost = true;
        window.recibirMensajeDeRed = w;
    }

    // =====================================================================
    // ↩️ deshacer por jugador
    // =====================================================================
    const KEYS = ['type', 'states1', 'states2', 'states3', 'firstTimes', 'chests', 'toSmelt', 'toGrow', 'water', 'wheat', 'toBrew', 'signs', 'hasSignal'];
    function norm(st) {
        if (!st || st.type == null || st.type === '' || st.type === 'air') return 'null';
        const o = {};
        KEYS.forEach(k => { const v = st[k]; if (v !== undefined && v !== null && v !== '') o[k] = v; });
        return JSON.stringify(o);
    }
    window.mpBlockKey = norm;
    function hookHistory() {
        const hm = (typeof historyManager !== 'undefined') ? historyManager : null;
        if (!hm || hm.__mpHost) return !!hm;
        hm.__mpHost = true;
        ['startAction', 'recordChange', 'recordMobChange', 'recordVehicleChange', 'commitAction'].forEach(function (name) {
            const f = hm[name];
            hm[name] = function () { if (this.muted > 0) return; return f.apply(this, arguments); };
        });
        // en un servidor: deshacer / rehacer solo toca lo que sigue como TÚ lo dejaste
        const ab = hm.applyBlockState;
        let expect = null;   // lo que debería haber ahora en la casilla para poder cambiarla
        hm.applyBlockState = function (x, y, state) {
            if (expect !== null && inMp() && typeof mbwom !== 'undefined') {
                if (norm(mbwom.getBlockState(x, y)) !== expect) { hm.skipped = (hm.skipped || 0) + 1; return; }
            }
            return ab.apply(this, arguments);
        };
        function run(which) {
            const stackFrom = which === 'undo' ? hm.undoStack : hm.redoStack;
            const batch = stackFrom[stackFrom.length - 1];
            if (!batch) return hm['__' + which]();
            // por cada cambio de bloque, lo que esperamos encontrar: al deshacer, lo que TÚ pusiste; al rehacer, lo que había antes
            const exp = new Map();
            batch.forEach(c => { if (c.type !== 'mob' && c.type !== 'vehicle') exp.set(c.x + ',' + c.y, norm(which === 'undo' ? c.new : c.old)); });
            const aB = hm.applyBlockState;
            hm.skipped = 0;
            hm.applyBlockState = function (x, y, state) { expect = exp.has(x + ',' + y) ? exp.get(x + ',' + y) : null; try { return aB.call(hm, x, y, state); } finally { expect = null; } };
            try { return hm['__' + which](); }
            finally {
                hm.applyBlockState = aB;
                if (hm.skipped && inMp()) toast('↩️ ' + tr('undo_skip_title', 'Undo'), tr('undo_skip_body', '{n} block(s) were changed by another player after you, so they were not undone.', { n: hm.skipped }));
            }
        }
        hm.__undo = hm.undo; hm.__redo = hm.redo;
        hm.undo = function () { return run('undo'); };
        hm.redo = function () { return run('redo'); };
        return true;
    }

    function init() { hookReceive(); hookHistory(); }
    init();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('load', init);
})();
