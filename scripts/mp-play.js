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
// TODAVÍA NO (Etapas 2 y 3): cada quien mueve sus propios mobs (no son los mismos para todos), los mobs no persiguen a los
// otros jugadores, no se pueden pegar entre jugadores, y los objetos tirados en el suelo son de cada quien.
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
        dirty: new Set(),     // 'escena|x|y' que cambié yo
        known: new Map(),     // 'escena|x|y' -> cómo está (JSON), para no mandar lo mismo dos veces
        changes: new Map(),   // (anfitrión) todo lo que cambió en la partida: para los que entran tarde
        queue: [],            // cambios de alguien que estaba editando (se ponen al terminar)
        applying: false,
        timer: 0, alive: 0, banner: null
    };
    window.mbwMpPlay = M;

    const inMp = function () { return !!g('isMultiplayer'); };
    const amHost = function () { return !!g('isHost'); };
    const myPeer = function () { const p = g('peer'); return p && p.id ? p.id : 'me'; };
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
        hideBanner();
        if (M.role === 'host') {
            M.session = true; M.changes = new Map(); M.hostName = myName();
            send({ tipo: 'juego_inicio', autor: myName(), peerId: myPeer() });
            M.alive = setInterval(function () { if (M.on && M.role === 'host') send({ tipo: 'juego_activo', autor: myName(), peerId: myPeer() }); }, ALIVE_MS);
            flash(tr('mpplay_started', '▶ Game started! Everyone in the room can join'));
        } else {
            // la arena y la grava sueltas del mundo ya las tiró el anfitrión al empezar: aquí no se vuelven a tirar (saldrían repetidas)
            try { window.mbwPlay.state.sandCheck = new Map(); } catch (e) { /* nada */ }
            send({ tipo: 'juego_pedir', peerId: myPeer() });          // entré: ¿qué ya cambió en la partida?
        }
        sendMe();
        clearInterval(M.timer);
        M.timer = setInterval(tick, SEND_MS);
    };
    M.beforeStop = function () {
        if (!M.on) return;
        try { flush(); } catch (e) { /* nada */ }
        if (M.role === 'host') { send({ tipo: 'juego_fin', peerId: myPeer() }); M.session = false; M.changes = new Map(); }
        else send({ tipo: 'juego_salir', peerId: myPeer() });
        clearInterval(M.timer); clearInterval(M.alive); M.timer = 0; M.alive = 0;
        M.on = false; M.remotes = {};
    };
    // ya se puso el mundo de antes de jugar: ahora van los cambios de quien estaba editando mientras tanto
    M.afterStop = function () {
        const q = M.queue; M.queue = [];
        q.forEach(function (d) { try { window.recibirMensajeDeRed(d); } catch (e) { console.error('mp-play queue', e); } });
        if (typeof window.mpResetWorldWatch === 'function') { try { window.mpResetWorldWatch(); } catch (e) { /* nada */ } }
        if (M.session && !amHost()) showBanner();
    };

    // ------------------------------------------------------------------ cada 100 ms mientras se juega
    function tick() {
        if (!M.on) return;
        if (!playing()) { M.on = false; clearInterval(M.timer); return; }
        // se cayó el anfitrión (o yo pasé a ser el anfitrión porque el otro se fue): la partida se acaba
        if (M.role === 'guest' && (!inMp() || amHost() || g('miConexionAlHost') !== M.conn)) {
            M.role = 'gone';
            stopGame(tr('mpplay_host_left', 'The host left: the game ended.'));
            return;
        }
        sendMe();
        flush();
        const now = Date.now();
        Object.keys(M.remotes).forEach(function (k) { if (now - M.remotes[k].t > STALE_MS) delete M.remotes[k]; });
    }
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
            h: (P && P.p && P.p.hurt > 0) ? 1 : 0, d: (Number(w.dead) > 0) ? 1 : 0
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
            M.session = true; M.hostName = d.autor || 'Host'; M.lastAlive = Date.now();
            if (!M.on && onServerTab() && (isNew || !M.banner)) showBanner();
            return;
        }
        if (t === 'juego_fin') {
            M.session = false; hideBanner();
            if (M.on && M.role === 'guest') stopGame(tr('mpplay_ended', 'The host ended the game. The world is back to how it was.'));
            return;
        }
        if (t === 'juego_salir') { delete M.remotes[d.peerId]; if (typeof worldDirty !== 'undefined') worldDirty = true; return; }
        if (!M.on) return;                                            // (lo de abajo solo sirve jugando)
        if (t === 'juego_jugador') { onPlayer(d); return; }
        if (t === 'juego_bloques' || t === 'juego_cambios') { applyBlocks(Number(d.s) || 1, d.c); return; }
        if (t === 'juego_pedir' && M.role === 'host') { sendChangesTo(d.peerId); return; }
    }
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
        if (typeof window.recibirMensajeDeRed === 'function' && !window.recibirMensajeDeRed.__mpPlay) {
            const o = window.recibirMensajeDeRed;
            const nw = function (d) {
                if (d && typeof d.tipo === 'string' && d.tipo.indexOf('juego_') === 0) { try { onMessage(d); } catch (e) { console.error('mp-play', e); } return; }
                if (M.on && typeof g('mpIsWorldChange') === 'function' && g('mpIsWorldChange')(d)) { M.queue.push(JSON.parse(JSON.stringify(d))); return; }
                return o.apply(this, arguments);
            };
            nw.__mpPlay = true;
            window.recibirMensajeDeRed = nw;
        }
        // 2) cada bloque que cambio yo jugando se apunta para mandarlo
        if (typeof mbwom !== 'undefined' && typeof mbwom.setBlockState === 'function' && !mbwom.setBlockState.__mpPlay) {
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
