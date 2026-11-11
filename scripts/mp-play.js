// =====================================================================
// 🎮 JUGAR EN MULTIJUGADOR (como un mundo LAN de Minecraft) — Etapa 1
// =====================================================================
// Cada quien juega en su propia computadora o celular, con SU Player (su vida, su comida, su inventario), en el mismo mundo.
//   • El anfitrión aprieta ▶ Play: empieza la partida. A los demás de la sala les sale un aviso con el botón "▶ Join".
//   • Cada jugador ve a los otros moverse (el mismo dibujo del Player del juego, con su nombre arriba).
//   • Lo que uno rompe o pone (y lo que cambia en un cofre, una puerta, el agua que corre...) les llega a los demás.
//   • Quien entra tarde recibe todo lo que ya se cambió en la partida.
//   • Un jugador puede salirse (■ Stop) y volver a entrar con el aviso. Cuando el anfitrión para, la partida se acaba para todos
//     y el mundo de todos regresa a como estaba antes de jugar (igual que el Modo Jugar normal).
//   • Si alguien EDITA el mundo (sin jugar) mientras otros juegan, sus cambios se guardan y se ponen al terminar la partida.
//   • Lo que pasa solo en el mundo (agua, lava y ácido que corren, hornos que funden, arena y grava sueltas al empezar) lo hace el
//     anfitrión, alrededor de cada jugador, y les llega a los demás (así no sale distinto en cada pantalla).
// ETAPA 2 (mobs compartidos):
//   • Los mobs los mueve SOLO el anfitrión (cerca de cualquier jugador) y les llegan a los demás 10 veces por segundo; en cada
//     pantalla se deslizan suave entre un dato y otro. Las flechas de los esqueletos también se ven.
//   • Los hostiles persiguen al jugador más cercano (también a los invitados); los animales siguen a quien tenga su comida.
//   • Cuando un mob le pega a un invitado (golpe, flecha), el anfitrión le avisa y el invitado pierde vida en su pantalla.
//   • Cuando un invitado le pega a un mob, el golpe va al anfitrión; si lo mata, la experiencia le sale al invitado.
//   • Las explosiones (creeper, TNT) lastiman a todos los que estén cerca; a los mobs los lastima el anfitrión.
//   • Un mob que crea un invitado (huevo, /summon) lo crea el anfitrión.
// ETAPA 3:
//   • Pegarse entre jugadores: clic izquierdo sobre otro jugador (a la mano) = golpe con la fuerza de lo que tengo en la mano y un
//     empujón. Si alguien muere, a todos les sale quién lo derrotó (o que murió).
//   • Objetos en el suelo: lo que se tira (al romper un bloque, lo que suelta un mob, lo que se suelta al morir...) lo ven todos y
//     cae igual en todas las pantallas. Recogerlo lo decide el anfitrión: se lo lleva el primero que lo toca (no se duplica).
//   • Chat: en una partida, lo que se escribe con T (sin "/") les llega a los demás (en el chat del juego y en el de la sala).
// TODAVÍA NO: los mobs de una dimensión donde no está el anfitrión se quedan quietos.
// Mensajes (no son "cambios del mundo": el anfitrión los pasa a todos, aunque el jugador solo pueda ver):
//   juego_inicio / juego_activo (anfitrión: hay partida) · juego_fin (anfitrión: se acabó) · juego_jugador (dónde estoy y cómo me veo)
//   juego_salir (me salí) · juego_bloques (bloques que cambiaron) · juego_pedir (entré tarde: ¿qué cambió?) · juego_cambios (respuesta)
(function () {
    'use strict';
    const SEND_MS = 100;            // cada cuánto se manda la posición y los bloques (10 veces por segundo)
    const ALIVE_MS = 2000;          // el anfitrión avisa "hay partida" cada 2 s
    const STALE_MS = 3500;          // un jugador que no manda nada en 3.5 s se deja de dibujar
    const CHUNK = 300;              // bloques por mensaje al ponerse al día
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
    // variables de multiplayer.js (son "let" globales: se leen directo, con typeof por si todavía no existen)
    const G = {
        isMultiplayer: function () { return typeof isMultiplayer !== 'undefined' && isMultiplayer; },
        isHost: function () { return typeof isHost !== 'undefined' && isHost; },
        peer: function () { return typeof peer !== 'undefined' ? peer : null; },
        miConexionAlHost: function () { return typeof miConexionAlHost !== 'undefined' ? miConexionAlHost : null; },
        misClientes: function () { return typeof misClientes !== 'undefined' ? misClientes : []; },
        mpInScene: function () { return typeof mpInScene === 'function' ? mpInScene : null; },
        mpIsWorldChange: function () { return typeof mpIsWorldChange === 'function' ? mpIsWorldChange : null; }
    };
    const g = function (name) { return G[name] ? G[name]() : undefined; };

    const M = {
        on: false,            // estoy jugando en la partida de la sala
        role: null,           // 'host' | 'guest' (con qué papel empecé)
        conn: null,           // (invitado) la conexión con la que empecé
        session: false,       // hay partida en la sala
        hostName: '',
        lastAlive: 0,
        remotes: {},          // peerId -> jugador de otro
        mobSig: new Map(),    // (anfitrión) id -> cómo estaba el mob la última vez que se mandó completo
        mobSent: new Set(),   // (anfitrión) mobs que ya se mandaron (para avisar cuando desaparecen)
        mobFullAt: 0,
        mobT: new Map(),      // (invitado) id -> de dónde a dónde se desliza el mob
        dirty: new Set(),     // 'escena|x|y' que cambié yo
        known: new Map(),     // 'escena|x|y' -> cómo está (JSON), para no mandar lo mismo dos veces
        changes: new Map(),   // (anfitrión) todo lo que cambió en la partida: para los que entran tarde
        queue: [],            // cambios de alguien que estaba editando (se ponen al terminar)
        applying: false,
        timer: 0, alive: 0, banner: null
    };
    window.mbwMpPlay = M;
    M.myId = function () { return myPeer(); };

    const inMp = function () { return !!g('isMultiplayer'); };
    const amHost = function () { return !!g('isHost'); };
    const myPeer = function () { const p = g('peer'); return p && p.id ? p.id : 'me'; };
    const myUid = function () { try { return localStorage.getItem('mbw_uid') || ''; } catch (e) { return ''; } };
    const myName = function () { try { return localStorage.getItem('mbw_username') || 'Player'; } catch (e) { return 'Player'; } };
    const onServerTab = function () { return typeof window.mpOnServerTab !== 'function' || window.mpOnServerTab(); };
    const curScene = function () { return (typeof mbwom !== 'undefined' && (mbwom.currentScene || 1)) || 1; };
    const send = function (d) { if (typeof window.enviarMensajeEnRed === 'function') window.enviarMensajeEnRed(d); };
    const flash = function (t) { try { if (window.mbwPlay && window.mbwPlay.flash) window.mbwPlay.flash(t); } catch (e) { /* nada */ } };
    const jsonOf = function (st) { try { return JSON.stringify(st); } catch (e) { return ''; } };
    const playing = function () { return !!(window.mbwPlay && window.mbwPlay.isPlaying()); };

    // ------------------------------------------------------------------ entrar / salir (lo llama play-mode.js)
    // ¿Se puede empezar a jugar? 'mp' = en la partida de la sala · 'solo' = solo (estoy viendo otro mundo) · false = no
    M.beforeStart = function () {
        if (!inMp()) return 'solo';
        if (!onServerTab()) return 'solo';
        if (amHost()) return 'mp';
        if (M.session && Date.now() - M.lastAlive < ALIVE_MS * 3) return 'mp';
        alert(tr('mpplay_wait_host', 'Only the host can start a game. When the host presses ▶ Play, you can join.'));
        return false;
    };
    M.afterStart = function () {
        M.on = true; M.role = amHost() ? 'host' : 'guest'; M.conn = g('miConexionAlHost');
        M.dirty = new Set(); M.known = new Map(); M.remotes = {}; M.queue = [];
        M.mobSig = new Map(); M.mobSent = new Set(); M.mobFullAt = 0; M.mobT = new Map();
        hideBanner();
        if (M.role === 'host') {
            M.session = true; M.changes = new Map(); M.hostName = myName();
            send({ tipo: 'juego_inicio', autor: myName(), peerId: myPeer() });
            M.alive = setInterval(function () { if (M.on && M.role === 'host') send({ tipo: 'juego_activo', autor: myName(), peerId: myPeer(), cmds: allowCmds() }); }, ALIVE_MS);
            flash(tr('mpplay_started', '▶ Game started! Everyone in the room can join'));
        } else {
            // la arena y la grava sueltas del mundo ya las tiró el anfitrión al empezar: aquí no se vuelven a tirar (saldrían repetidas)
            try { window.mbwPlay.state.sandCheck = new Map(); } catch (e) { /* nada */ }
            send({ tipo: 'juego_pedir', peerId: myPeer(), uid: myUid(), autor: myName() });   // entré: ¿qué ya cambió? ¿dónde estaba yo?
        }
        sendMe();
        clearInterval(M.timer);
        M.timer = setInterval(tick, SEND_MS);
    };
    M.beforeStop = function () {
        if (!M.on) return;
        try { flush(); } catch (e) { /* nada */ }
        if (M.role === 'host') { send({ tipo: 'juego_fin', peerId: myPeer() }); M.session = false; M.changes = new Map(); }
        else { M.saveMine(); send({ tipo: 'juego_salir', peerId: myPeer() }); }
        clearInterval(M.timer); clearInterval(M.alive); M.timer = 0; M.alive = 0;
        M.on = false; M.remotes = {}; M.mobT = new Map(); M.mobSig = new Map(); M.mobSent = new Set();
    };
    // ya se puso el mundo de antes de jugar: ahora van los cambios de quien estaba editando mientras tanto
    M.afterStop = function (kept) {
        const q = M.queue; M.queue = [];
        q.forEach(function (d) { try { window.recibirMensajeDeRed(d); } catch (e) { console.error('mp-play queue', e); } });
        // (anfitrión) lo que pasó jugando se quedó en su mundo (y ya con lo que editaron los demás mientras): se lo manda a todos,
        // así todos tienen el mismo mundo
        if (kept && amHost()) {
            (g('misClientes') || []).forEach(function (c) { if (c && c.open && typeof window.mpSendWorld === 'function') { try { window.mpSendWorld(c, !!c.__gz, { quiet: true }); } catch (e) { /* nada */ } } });
        }
        if (typeof window.mpResetWorldWatch === 'function') { try { window.mpResetWorldWatch(); } catch (e) { /* nada */ } }
        if (M.session && !amHost()) showBanner();
    };

    // ------------------------------------------------------------------ cada 100 ms mientras se juega
    function tick() {
        if (!M.on) return;
        if (!playing()) { M.on = false; clearInterval(M.timer); return; }
        // se fue el anfitrión: la partida SIGUE. Si yo quedé de anfitrión (el servidor pasó a mí), ahora mando yo; si cambió el
        // anfitrión, sigo con el nuevo; si ya no hay sala, sigo jugando solo.
        if (M.role === 'guest') {
            if (inMp() && amHost()) promoteToHost();
            else if (!inMp()) { goSolo(); return; }
            else if (g('miConexionAlHost') !== M.conn) { M.conn = g('miConexionAlHost'); M.lastAlive = Date.now(); }
        }
        if (M.role === 'host' && !inMp()) { goSolo(); return; }
        if (M.role === 'guest' && Date.now() - M.lastSaveSent > 2000) M.saveMine();
        if (Date.now() - M.lastPing > 3000) { M.lastPing = Date.now(); if (M.role === 'guest') send({ tipo: 'juego_ping', peerId: myPeer(), t: Date.now() }); }
        sendMe();
        flush();
        if (M.role === 'host') sendMobs();
        const now = Date.now();
        Object.keys(M.remotes).forEach(function (k) { if (now - M.remotes[k].t > STALE_MS) delete M.remotes[k]; });
    }
    function promoteToHost() {
        M.role = 'host'; M.session = true; M.changes = new Map(); M.hostName = myName();
        clearInterval(M.alive);
        M.alive = setInterval(function () { if (M.on && M.role === 'host') send({ tipo: 'juego_activo', autor: myName(), peerId: myPeer(), cmds: allowCmds() }); }, ALIVE_MS);
        send({ tipo: 'juego_activo', autor: myName(), peerId: myPeer(), cmds: allowCmds() });
        flash(tr('mpplay_now_host', 'The host left: you are the host now and the game goes on'));
    }
    function goSolo() {
        clearInterval(M.timer); clearInterval(M.alive); M.timer = 0; M.alive = 0;
        M.on = false; M.role = 'solo'; M.remotes = {}; M.session = false;
        if (window.mbwPlay && window.mbwPlay.setMp) window.mbwPlay.setMp(false);
        flash(tr('mpplay_solo', 'The room closed: you keep playing on your own'));
    }
    // ¿los invitados pueden usar comandos? (por defecto NO: solo el anfitrión. Se cambia en el menú de pausa del anfitrión)
    function allowCmds() { try { return !!(mbwom.world && mbwom.world.mbweAllowCmds); } catch (e) { return false; } }
    M.allowCmds = allowCmds;
    M.guestCmds = false;
    M.setAllowCmds = function (on) { if (!mbwom.world) return; mbwom.world.mbweAllowCmds = !!on; if (M.on && M.role === 'host') send({ tipo: 'juego_activo', autor: myName(), peerId: myPeer(), cmds: !!on }); };
    // 💾 los datos de MI Player en este mundo (invitado): posición, dimensión, inventario, armadura, vida, comida, experiencia...
    function myData() {
        const w = mbwom.world || {};
        return { x: Number(w.worldX), y: Number(w.worldY), s: curScene(), inv: JSON.parse(JSON.stringify(w.inventoryList || [])), armors: JSON.parse(JSON.stringify(w.armors || [])),
            health: Number(w.health), food: Number(w.food), xp: Number(w.experience) || 0, sel: w.selectedInventoryItem | 0, gm: Number(w.gamemode) || 0 };
    }
    M.lastSaveSent = 0; M.lastPing = 0; M.ping = 0;
    M.saveMine = function () {
        if (!M.on || M.role !== 'guest') return;
        M.lastSaveSent = Date.now();
        send({ tipo: 'juego_guardo', peerId: myPeer(), uid: myUid(), autor: myName(), data: myData() });
    };
    // (anfitrión) guarda en el mundo los datos del Player de cada invitado (se guardan con el mundo al hacer "Save and Quit")
    function storePlayer(uid, name, data, online) {
        if (!uid || !mbwom.world) return;
        const P = mbwom.world.mbwePlayers = (mbwom.world.mbwePlayers && typeof mbwom.world.mbwePlayers === 'object') ? mbwom.world.mbwePlayers : {};
        const cur = P[uid] || {};
        P[uid] = Object.assign(cur, data || {}, { name: String(name || cur.name || 'Player'), last: Date.now() });
    }
    M.storePlayer = storePlayer;
    function stopGame(msg) {
        if (typeof window.mbwStopPlay === 'function') window.mbwStopPlay();
        if (msg) setTimeout(function () { notice(msg); }, 50);
    }

    // dónde estoy y cómo me veo (el cuadro del dibujo del Player)
    function sendMe() {
        if (typeof mbwom === 'undefined' || !mbwom.world) return;
        const w = mbwom.world, P = window.mbwPlay && window.mbwPlay.state;
        send({
            tipo: 'juego_jugador', peerId: myPeer(), autor: myName(),
            x: Math.round(Number(w.worldX) * 1000) / 1000, y: Math.round(Number(w.worldY) * 1000) / 1000,
            s: curScene(), f: (P && P.frankF) || 0, fl: (P && P.p && P.p.xScale < 0) ? 1 : 0,
            h: (P && P.p && P.p.hurt > 0) ? 1 : 0, d: (Number(w.dead) > 0) ? 1 : 0,
            gm: Number(w.gamemode) || 0, it: (window.mbwPlay.net ? window.mbwPlay.net.heldId() : ''),
            uid: myUid(), p: M.role === 'host' ? 0 : (M.ping | 0), sel: w.selectedInventoryItem | 0
        });
    }

    // ------------------------------------------------------------------ bloques
    M.mark = function (x, y, s) {
        if (!M.on || M.applying) return;
        M.dirty.add((s || (mbwom.sceneIndex || curScene())) + '|' + x + '|' + y);
    };
    function stateIn(s, x, y) {
        const get = function () { const v = mbwom.getBlockState(x, y); return v ? JSON.parse(JSON.stringify(v)) : {}; };
        if (s === curScene() || typeof g('mpInScene') !== 'function') return get();
        let out = {}; g('mpInScene')(s, function () { out = get(); }); return out;
    }
    function flush() {
        if (!M.on || typeof mbwom === 'undefined' || !mbwom.scene) return;
        // el cofre o el horno que tengo abierto: se revisa cada vez (lo que se mueve adentro no pasa por setBlockState)
        const P = window.mbwPlay && window.mbwPlay.state;
        const modal = document.getElementById('inventory-modal');
        if (P && P.openBoxAt && modal && modal.style.display === 'block') M.dirty.add(curScene() + '|' + P.openBoxAt.x + '|' + P.openBoxAt.y);
        if (!M.dirty.size) return;
        const by = {};
        M.dirty.forEach(function (k) {
            const p = k.split('|'), s = Number(p[0]), x = Number(p[1]), y = Number(p[2]);
            const st = stateIn(s, x, y), j = jsonOf(st);
            if (M.known.get(k) === j) return;
            M.known.set(k, j);
            if (M.role === 'host') M.changes.set(k, st);
            (by[s] = by[s] || []).push([x, y, st]);
        });
        M.dirty.clear();
        Object.keys(by).forEach(function (s) {
            const list = by[s];
            for (let i = 0; i < list.length; i += CHUNK) send({ tipo: 'juego_bloques', s: Number(s), c: list.slice(i, i + CHUNK) });
        });
    }
    function applyBlocks(s, list) {
        if (!Array.isArray(list) || typeof mbwom === 'undefined' || !mbwom.scene) return;
        const run = function () {
            list.forEach(function (c) {
                const x = Number(c[0]), y = Number(c[1]), st = c[2] || {};
                if (!(x >= 0 && y >= 0)) return;
                const k = s + '|' + x + '|' + y, j = jsonOf(st);
                M.known.set(k, j);
                if (M.role === 'host') M.changes.set(k, st);
                if (jsonOf(JSON.parse(JSON.stringify(mbwom.getBlockState(x, y) || {}))) === j) return;
                M.applying = true;
                try { mbwom.setBlockState(x, y, st); } finally { M.applying = false; }
                if (s === curScene() && typeof window.renderBlock === 'function') window.renderBlock(x, y);
            });
        };
        if (s === curScene() || typeof g('mpInScene') !== 'function') run();
        else { M.applying = true; try { g('mpInScene')(s, run); } finally { M.applying = false; } }
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
    // (anfitrión) a uno que entró tarde: todo lo que ya cambió en la partida, por partes
    function sendChangesTo(peerId) {
        const list = g('misClientes') || [];
        const conn = list.find(function (c) { return c.peer === peerId; });
        if (!conn || !conn.open) return;
        const by = {};
        M.changes.forEach(function (st, k) { const p = k.split('|'); (by[p[0]] = by[p[0]] || []).push([Number(p[1]), Number(p[2]), st]); });
        Object.keys(by).forEach(function (s) {
            const l = by[s];
            for (let i = 0; i < l.length; i += CHUNK) { try { conn.send({ tipo: 'juego_cambios', s: Number(s), c: l.slice(i, i + CHUNK), retransmitido: true }); } catch (e) { /* nada */ } }
        });
    }

    // ------------------------------------------------------------------ lo que llega de la red
    function onMessage(d) {
        const t = d.tipo;
        if (t === 'juego_inicio' || t === 'juego_activo') {
            if (amHost()) return;
            const isNew = !M.session || t === 'juego_inicio';
            M.session = true; M.hostName = d.autor || 'Host'; M.lastAlive = Date.now(); M.guestCmds = !!d.cmds;
            if (!M.on && onServerTab() && (isNew || !M.banner)) showBanner();
            return;
        }
        if (t === 'juego_fin') {
            M.session = false; hideBanner();
            if (M.on && M.role === 'guest') stopGame(tr('mpplay_ended2', 'The host ended the game. Everything that happened was saved.'));
            return;
        }
        if (t === 'juego_salir') { delete M.remotes[d.peerId]; if (typeof worldDirty !== 'undefined') worldDirty = true; return; }
        // (anfitrión) los datos del Player de un invitado: se guardan aunque yo ya haya terminado (llegan justo al terminar)
        if (t === 'juego_guardo') { if (amHost() && d.uid) storePlayer(String(d.uid), d.autor, d.data); return; }
        if (!M.on) return;                                            // (lo de abajo solo sirve jugando)
        if (t === 'juego_jugador') { onPlayer(d); return; }
        if (t === 'juego_bloques' || t === 'juego_cambios') { applyBlocks(Number(d.s) || 1, d.c); return; }
        if (t === 'juego_pedir' && M.role === 'host') { sendChangesTo(d.peerId); sendMobListTo(d.peerId); sendDropsTo(d.peerId); sendPlayerTo(d.peerId, d.uid, d.autor); return; }
        if (t === 'juego_tuyo') { if (M.role === 'guest' && window.mbwPlay.net && window.mbwPlay.net.loadMine) window.mbwPlay.net.loadMine(d.data, d.spawn); M.guestCmds = !!d.cmds; return; }
        if (t === 'juego_ping') { if (M.role === 'host') { const c = (g('misClientes') || []).find(function (q) { return q.peer === d.peerId; }); if (c && c.open) { try { c.send({ tipo: 'juego_pong', t: d.t, retransmitido: true }); } catch (e) { /* nada */ } } } return; }
        if (t === 'juego_pong') { if (M.role === 'guest' && d.t) M.ping = Math.max(0, Date.now() - Number(d.t)); return; }
        const N = window.mbwPlay && window.mbwPlay.net; if (!N) return;
        // objetos en el suelo
        if (t === 'juego_suelta') { if (d.peerId !== myPeer()) N.dropIn(d.d); return; }
        if (t === 'juego_suelos') { (d.l || []).forEach(function (o) { N.dropIn(o); }); return; }
        if (t === 'juego_toma') { if (M.role === 'host') N.dropGrant(String(d.nid), d.peerId); return; }
        if (t === 'juego_tomado') { if (d.peerId !== myPeer()) N.dropTaken(d); return; }
        // pegarse entre jugadores / muertes
        if (t === 'juego_pvp') { if (d.a === myPeer()) N.pvp(d.dmg, d.kx, d.autor); return; }
        if (t === 'juego_muerte') {
            if (d.peerId === myPeer()) return;
            const msg = d.por ? tr('mpplay_death_by', '{name} was defeated by {by}').replace('{name}', String(d.autor || 'Player')).replace('{by}', String(d.por))
                : tr('mpplay_death', '{name} died').replace('{name}', String(d.autor || 'Player'));
            N.say('💀 ' + msg); N.flash('💀 ' + msg);
            return;
        }
        if (t === 'juego_mobs') { applyMobs(d); return; }
        if (t === 'juego_mobs_lista') { if (M.role === 'guest' && Number(d.s) === curScene() && Array.isArray(d.ids)) { const keep = new Set(d.ids); Object.keys(mbwom.mobs || {}).forEach(function (id) { if (!keep.has(id)) { delete mbwom.mobs[id]; M.mobT.delete(id); N.forget(id); } }); } return; }
        if (t === 'juego_golpe') { if (d.a === myPeer()) N.hurtMe(d.dmg, d.causa); return; }
        if (t === 'juego_botin') { if (d.a === myPeer()) N.loot(d.l); return; }
        if (t === 'juego_pega') { if (M.role === 'host' && d.peerId) N.hitMob(String(d.id), d.dmg, d.kx, d.ky, 'rp:' + d.peerId, d.loot); return; }
        if (t === 'juego_boom') { if (Number(d.s) === curScene() && d.peerId !== myPeer()) N.boom(d.x, d.y, d.c, d.peerId ? 'rp:' + d.peerId : null); return; }
        if (t === 'juego_mob_nuevo') { if (M.role === 'host') N.newMob(d.m); return; }
    }

    // ------------------------------------------------------------------ 🐷 mobs (Etapa 2)
    const r3 = function (v) { return Math.round(Number(v) * 1000) / 1000; };
    // lo que NO cuenta para decidir si el mob cambió "en serio" (esto cambia todo el tiempo y va en los datos de posición)
    const VOLATILE = { x: 1, y: 1, speedX: 1, speedY: 1, direction: 1, falling: 1, wasFalling: 1, wasFallingSpeed: 1, hitCooldown: 1, attackCooldown: 1, aggressiveness: 1, target: 1, focus: 1, airTimer: 1, air: 1, startUnderwaterTimer: 1, fuse: 1, dead: 1, __id: 1, lastDamageID: 1, babyTimer: 1 };
    function sigOf(m) { const o = {}; Object.keys(m).forEach(function (k) { if (!VOLATILE[k]) o[k] = m[k]; }); return jsonOf(o); }
    // (anfitrión) los mobs que están cerca de algún jugador, 10 veces por segundo
    function sendMobs() {
        if (typeof mbwom === 'undefined' || !mbwom.mobs || !mbwom.world) return;
        const sc = curScene(), now = Date.now();
        const xs = [Number(mbwom.world.worldX)];
        Object.keys(M.remotes).forEach(function (k) { const r = M.remotes[k]; if (r.s === sc && now - r.t < STALE_MS) xs.push(r.tx); });
        const full = now - M.mobFullAt > 2000; if (full) M.mobFullAt = now;      // cada 2 s todo completo (por si alguien se perdió algo)
        const p = [], f = {}, g = [];
        let nf = 0;
        Object.keys(mbwom.mobs).forEach(function (id) {
            const m = mbwom.mobs[id]; if (!m || !m.type) return;
            const mx = Number(m.x); if (!xs.some(function (q) { return Math.abs(mx - q) < 48; })) return;
            const sig = sigOf(m);
            M.mobSent.add(id);
            if (full || M.mobSig.get(id) !== sig) { f[id] = JSON.parse(JSON.stringify(m)); M.mobSig.set(id, sig); nf++; }
            else p.push([id, r3(m.x), r3(m.y), m.direction | 0, m.dead | 0, m.fuse | 0]);
        });
        M.mobSent.forEach(function (id) { if (!mbwom.mobs[id]) { g.push(id); M.mobSent.delete(id); M.mobSig.delete(id); } });
        const N = window.mbwPlay.net, arr = N ? N.arrows() : [];
        const a = (arr || []).filter(function (r) { return !r.ghost && xs.some(function (q) { return Math.abs(r.x - q) < 48; }); }).map(function (r) { return [r3(r.x), r3(r.y), r3(r.vx), r3(r.vy)]; });
        if (!p.length && !nf && !g.length && !a.length && !M.hadArrows) return;
        M.hadArrows = a.length > 0;
        send({ tipo: 'juego_mobs', s: sc, p: p, f: f, g: g, a: a });
    }
    function sendDropsTo(peerId) {
        const conn = (g('misClientes') || []).find(function (c) { return c.peer === peerId; });
        const N = window.mbwPlay && window.mbwPlay.net;
        if (!conn || !conn.open || !N) return;
        const l = N.dropsPack();
        for (let i = 0; i < l.length; i += CHUNK) { try { conn.send({ tipo: 'juego_suelos', l: l.slice(i, i + CHUNK), retransmitido: true }); } catch (e) { /* nada */ } }
    }
    function sendPlayerTo(peerId, uid, name) {
        const conn = (g('misClientes') || []).find(function (c) { return c.peer === peerId; });
        if (!conn || !conn.open || !mbwom.world) return;
        const P = mbwom.world.mbwePlayers || {};
        const rec = uid && P[uid] ? P[uid] : null;
        if (uid && !rec) storePlayer(uid, name, {});                 // (queda en la lista de los que alguna vez entraron)
        // la primera vez aparece en el /home (spawn) del mundo; si no hay, donde está el Player del mundo
        const hs = window.mbwPlay && window.mbwPlay.spawnGet ? window.mbwPlay.spawnGet() : null;
        const sp = hs || { x: Number(mbwom.world.worldX), y: Number(mbwom.world.worldY) };
        try { conn.send({ tipo: 'juego_tuyo', data: rec && rec.inv ? rec : null, spawn: sp, cmds: allowCmds(), retransmitido: true }); } catch (e) { /* nada */ }
    }
    // la lista de jugadores (menú de pausa / Tab): los conectados ahora y los que alguna vez entraron a jugar este mundo
    M.playerList = function () {
        const out = [], seen = {};
        const meUid = myUid();
        out.push({ name: myName(), uid: meUid, online: true, me: true, host: amHost() || !inMp(), ping: M.role === 'host' || !M.on ? 0 : M.ping });
        seen[meUid] = 1;
        Object.keys(M.remotes).forEach(function (k) { const r = M.remotes[k]; out.push({ name: r.name, uid: r.uid, online: true, host: M.role === 'guest' && r.name === M.hostName, ping: r.ping || 0 }); if (r.uid) seen[r.uid] = 1; });
        const P = (mbwom.world && mbwom.world.mbwePlayers) || {};
        Object.keys(P).forEach(function (u) { if (seen[u]) return; out.push({ name: P[u].name || 'Player', uid: u, online: false, last: P[u].last || 0 }); });
        return out;
    };
    function sendMobListTo(peerId) {
        M.mobFullAt = 0;                                           // al que entró tarde: todo completo en el siguiente envío
        const conn = (g('misClientes') || []).find(function (c) { return c.peer === peerId; });
        if (!conn || !conn.open || !mbwom.mobs) return;
        try { conn.send({ tipo: 'juego_mobs_lista', s: curScene(), ids: Object.keys(mbwom.mobs), retransmitido: true }); } catch (e) { /* nada */ }
    }
    // (invitado) los mobs que mandó el anfitrión
    function slideTo(id, m, x, y) {
        const now = Date.now(), t = M.mobT.get(id);
        const cur = t ? lerpPos(t, now) : { x: Number(m.x), y: Number(m.y) };
        const far = !isFinite(cur.x) || Math.abs(x - cur.x) > 6 || Math.abs(y - cur.y) > 6;
        M.mobT.set(id, { fx: far ? x : cur.x, fy: far ? y : cur.y, tx: x, ty: y, t0: now });
        m.x = far ? x : cur.x; m.y = far ? y : cur.y;
    }
    function applyMobs(d) {
        if (M.role !== 'guest' || Number(d.s) !== curScene() || !mbwom.mobs) return;
        const N = window.mbwPlay.net;
        const f = d.f || {};
        Object.keys(f).forEach(function (id) {
            const o = f[id]; if (!o || !o.type) return;
            const old = mbwom.mobs[id];
            const x = Number(o.x), y = Number(o.y);
            if (old) { o.x = old.x; o.y = old.y; }
            mbwom.mobs[id] = o;
            slideTo(id, o, x, y);
        });
        (d.p || []).forEach(function (q) {
            const m = mbwom.mobs[q[0]]; if (!m) return;
            m.direction = q[3]; m.dead = q[4]; m.fuse = q[5];
            slideTo(q[0], m, q[1], q[2]);
        });
        (d.g || []).forEach(function (id) { delete mbwom.mobs[id]; M.mobT.delete(id); N.forget(id); });
        N.setArrows(d.a || []);
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
    // (invitado) en cada paso del juego: los mobs se deslizan hacia donde dijo el anfitrión
    M.mobLerp = function () {
        if (!M.on || M.role !== 'guest' || !mbwom.mobs) return;
        const now = Date.now();
        M.mobT.forEach(function (t, id) {
            const m = mbwom.mobs[id]; if (!m) { M.mobT.delete(id); return; }
            const p = lerpPos(t, now); m.x = p.x; m.y = p.y;
        });
    };
    function onPlayer(d) {
        const id = d.peerId; if (!id || id === myPeer()) return;
        const now = Date.now();
        let r = M.remotes[id];
        if (!r) {
            r = M.remotes[id] = { x: d.x, y: d.y, fx: d.x, fy: d.y, tx: d.x, ty: d.y, t0: now };
            flash(tr('mpplay_joined', '{name} joined the game').replace('{name}', String(d.autor || 'Player')));
        } else {
            const cur = lerpPos(r, now);
            const far = Math.abs(d.x - cur.x) > 6 || Math.abs(d.y - cur.y) > 6;   // se teletransportó: sin deslizar
            r.fx = far ? d.x : cur.x; r.fy = far ? d.y : cur.y; r.tx = d.x; r.ty = d.y; r.t0 = now;
        }
        r.name = String(d.autor || 'Player'); r.s = Number(d.s) || 1; r.f = d.f | 0; r.fl = !!d.fl; r.h = !!d.h; r.d = !!d.d; r.t = now;
        r.gm = Number(d.gm) || 0; r.it = String(d.it || ''); r.uid = d.uid ? String(d.uid) : r.uid; r.ping = Number(d.p) || 0;
        if (r.sel !== (d.sel | 0)) { r.selT = now; r.sel = d.sel | 0; }                  // (cambió de casilla: se muestra arriba de él un ratito)
        if (M.role === 'host' && r.uid && mbwom.world && mbwom.world.mbwePlayers && mbwom.world.mbwePlayers[r.uid]) {   // (dónde está, al momento)
            const rec = mbwom.world.mbwePlayers[r.uid];
            if (isFinite(Number(d.x)) && isFinite(Number(d.y)) && !d.d) { rec.x = Number(d.x); rec.y = Number(d.y); rec.s = r.s; }
            rec.last = now;
        }
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
    function lerpPos(r, now) {
        const k = Math.max(0, Math.min(1, (now - r.t0) / (SEND_MS * 1.2)));
        return { x: r.fx + (r.tx - r.fx) * k, y: r.fy + (r.ty - r.fy) * k };
    }

    // ------------------------------------------------------------------ dibujar a los demás (play-mode.js lo llama en cada cuadro)
    M.draw = function () {
        if (!M.on) return;
        const ids = Object.keys(M.remotes); if (!ids.length) return;
        const frank = window.mbwPlay && window.mbwPlay.frank;
        const c2 = window.ctx || (typeof ctx !== 'undefined' ? ctx : null);
        if (!c2 || !frank || !(frank.complete && frank.naturalWidth >= 272)) return;
        const now = Date.now(), sc = curScene();
        const pw = tileSize * 16 / 11, ph = tileSize * 2;
        ids.forEach(function (id) {
            const r = M.remotes[id];
            if (r.s !== sc || r.d) return;
            const p = lerpPos(r, now);
            if (r.tx !== r.fx || r.ty !== r.fy) { if (typeof worldDirty !== 'undefined') worldDirty = true; }
            const sx = (p.x - camera.x) * tileSize, sy = canvas.height - (-p.y - camera.y) * tileSize;
            if (sx < -pw * 2 || sx > canvas.width + pw * 2 || sy < -ph || sy > canvas.height + ph * 2) return;
            c2.save();
            c2.imageSmoothingEnabled = false;
            c2.translate(sx, sy);
            c2.save();
            if (r.fl) c2.scale(-1, 1);
            if (r.h) c2.globalAlpha = 0.85;
            c2.drawImage(frank, Math.max(0, Math.min(16, r.f)) * 16, 0, 16, 22, -pw / 2, -ph, pw, ph);
            if (r.h) { c2.globalCompositeOperation = 'source-atop'; c2.fillStyle = 'rgba(255,0,0,0.35)'; c2.fillRect(-pw / 2, -ph, pw, ph); }
            c2.restore();
            // el nombre arriba de la cabeza
            const fs = Math.max(10, Math.round(tileSize * 0.42));
            c2.font = 'bold ' + fs + 'px Arial, sans-serif';
            c2.textAlign = 'center'; c2.textBaseline = 'bottom';
            const tw = c2.measureText(r.name).width;
            c2.fillStyle = 'rgba(0,0,0,0.45)';
            c2.fillRect(-tw / 2 - 4, -ph - fs - 8, tw + 8, fs + 5);
            c2.fillStyle = '#fff';
            c2.fillText(r.name, 0, -ph - 5);
            c2.restore();
        });
    };

    // ------------------------------------------------------------------ aviso "hay partida: ▶ Join"
    function showBanner() {
        if (M.banner || M.on || amHost()) return;
        const b = document.createElement('div');
        b.className = 'mpplay-banner';
        const t = document.createElement('span');
        t.textContent = '🎮 ' + tr('mpplay_banner', '{name} started a game in this world.').replace('{name}', M.hostName || 'Host');
        const join = document.createElement('button'); join.type = 'button'; join.className = 'mpplay-join';
        join.textContent = tr('mpplay_join', '▶ Join');
        join.addEventListener('click', function () { if (typeof window.mbwStartPlay === 'function') window.mbwStartPlay(); });
        const x = document.createElement('button'); x.type = 'button'; x.className = 'mpplay-x'; x.textContent = '✕';
        x.title = tr('mpplay_later', 'Not now');
        x.addEventListener('click', hideBanner);
        b.appendChild(t); b.appendChild(join); b.appendChild(x);
        document.body.appendChild(b);
        M.banner = b;
    }
    function hideBanner() { if (M.banner) { M.banner.remove(); M.banner = null; } }
    function notice(msg) {
        const n = document.createElement('div');
        n.className = 'mpplay-banner mpplay-notice';
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(function () { n.remove(); }, 4500);
    }
    // si el anfitrión se fue sin avisar, el aviso se quita solo
    setInterval(function () {
        if (M.session && !amHost() && Date.now() - M.lastAlive > ALIVE_MS * 3) { M.session = false; hideBanner(); }
        if (M.banner && (!inMp() || !onServerTab())) hideBanner();
    }, 1000);

    // ------------------------------------------------------------------ enganches
    function hook() {
        // 1) los mensajes de la partida + guardar para después lo que edita alguien mientras se juega
        if (!M.recvHooked && typeof window.recibirMensajeDeRed === 'function' && !window.recibirMensajeDeRed.__mpPlay) {
            M.recvHooked = true;            // (una sola vez: antes, con mp-host.js, se envolvían uno al otro y los mensajes salían 2 o 3 veces)
            const o = window.recibirMensajeDeRed;
            const nw = function (d) {
                if (d && typeof d.tipo === 'string' && d.tipo.indexOf('juego_') === 0) { try { onMessage(d); } catch (e) { console.error('mp-play', e); } return; }
                if (M.on && typeof g('mpIsWorldChange') === 'function' && g('mpIsWorldChange')(d)) { M.queue.push(JSON.parse(JSON.stringify(d))); return; }
                if (M.on && d && d.tipo === 'chat' && d.texto != null && window.mbwPlay && window.mbwPlay.net) {
                    try { window.mbwPlay.net.say((d.autor && d.autor !== 'System' ? '<' + d.autor + '> ' : '') + String(d.texto)); } catch (e) { /* nada */ }
                }
                return o.apply(this, arguments);
            };
            nw.__mpPlay = true;
            window.recibirMensajeDeRed = nw;
        }
        // 2) cada bloque que cambio yo jugando se apunta para mandarlo
        if (!M.sbsHooked && typeof mbwom !== 'undefined' && typeof mbwom.setBlockState === 'function' && !mbwom.setBlockState.__mpPlay) {
            M.sbsHooked = true;
            const o2 = mbwom.setBlockState;
            const nw2 = function (x, y) { const r = o2.apply(this, arguments); if (M.on && !M.applying) M.mark(x, y); return r; };
            nw2.__mpPlay = true;
            mbwom.setBlockState = nw2;
        }
    }
    hook();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
    setTimeout(hook, 1500);
    window.addEventListener('beforeunload', function () { if (M.on) { try { M.beforeStop(); } catch (e) { /* nada */ } } });
})();
