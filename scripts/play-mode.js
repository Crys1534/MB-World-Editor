// =====================================================================
// ▶️ MODO JUGAR — probar el mapa dentro del editor
// =====================================================================
// Qué hace:
//   • El botón ▶ Play (barra de arriba) toma una FOTO completa del mundo (bloques, mobs, Player, cofres, hornos...)
//     y deja jugar el mapa con el Player del mundo: su posición, su inventario y su vida.
//   • Al salir (botón ■ Stop o Esc) la foto se vuelve a poner TAL CUAL: los bloques, los mobs y el Player regresan a
//     donde estaban antes de jugar. Nada de lo que pasa jugando se guarda ni entra al historial (Ctrl+Z).
//   • Mientras se juega, guardar / descargar / autoguardar usan la foto (el mundo de antes de jugar), nunca el mundo jugado.
//
// De dónde salen las reglas: del código decompilado de Mine Blocks 2.0.0 (Game.js, World.js, entities/Entity_Mob.js,
// entities/Entity_FallingBlock.js, blocks/Block_Sand.js). Las tablas de bloques y mobs están en scripts/play-data.js.
//   - Player: Game.doPlayerLogic (caminar, correr con doble toque, saltar, agacharse, escaleras, losas, agua, telarañas,
//     hielo, arena de almas, escalar escaleras de mano / cuerdas, caer y daño por caída, ahogarse, asfixia, lava, ácido,
//     cactus, magma, vacío), Game.collision (choques), Game.ouch (daño y armadura), Game.inGame1 (morir y reaparecer),
//     Game.onCertainInterval (hambre y curarse solo).
//   - Picar / poner: Game.mineAndPlaceCode + startMiningBlock (tiempo de picado por herramienta, qué suelta cada bloque).
//   - Mobs: Entity_Mob.run + mobCalculateTarget + mobAttack + hurtMob (caminar al azar, perseguir, saltar, no tirarse por
//     barrancos, nadar, daño, empujón al pegarles, creeper que explota, esqueleto que dispara flechas).
//   - Arena y grava que caen, TNT (con mechero), explosiones (Game.explode).
//   - Agua, lava y ácido que corren (blocks/Block_Water.js, Block_Lava.js, Block_Acid.js), cubetas, plantas que se rompen sin
//     soporte (placeOn / Block_Cactus), hornos que funden (Game.onCertainInterval → toSmelt), experiencia (dropXP / experience),
//     lo que suelta cada mob (Entity_Mob.killMob) y a quién persigue (mobCalculateTarget: comida en la mano, lobo, gólem, enderman).
//   - Día y noche, camas, cultivos, harina de hueso, mechero (fuego y portal), soporte de pociones, criar animales (crías),
//     ordeñar, balsas y vagonetas: ver el bloque "🌙 DÍA Y NOCHE" más abajo.
// APROXIMADO / NO INCLUIDO (se dice para no engañar): la lava no prende fuego; la pesca, cómo se extiende el fuego y cómo se
// mueven la balsa y la vagoneta no vienen en el código decompilado (son aproximados). Mine Blocks no tiene tocadiscos (jukebox).
// Cómo se mueven las bolitas de experiencia no viene en el código decompilado: es aproximado. Los mobs que vuelan o nadan
// (murciélago, ghast, calamar, blaze, ojo del Nether, dragón) usan una versión simple de su movimiento.
// El alcance de las manos (5 bloques) no aparece en el código decompilado: es un valor estimado.
// =====================================================================
(function () {
    'use strict';
    const D = window.MB_PLAY_DATA || { blocks: {}, mobs: {} };
    const FPS = 50;                                   // el juego corre a 50 pasos por segundo (Main.js: set_fps(50))
    const migAcc = (b, a) => b / 2 / (1 + Math.sqrt(a));
    const migDamp = (b) => Math.sqrt(b);
    const migSpeed = (b) => b / 2;
    const REACH = 5;                                  // (estimado)
    const PLAYER_ID = '__player__';
    const tr = (k, fb, p) => { try { const v = window.tmsg ? window.tmsg(k, fb, p) : fb; return v || fb; } catch (e) { return fb; } };
    const bd = (id, p) => { const o = D.blocks[id]; return o ? o[p] : undefined; };
    const modulus = (a, b) => { const r = a % b; return r < 0 ? r + b : r; };
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ------------------------------------------------------------------ estado
    const S = {
        playing: false, snapshot: null, scene: 1, old: null,
        p: null, keys: {}, dbl: {}, mouse: { x: 0, y: 0, left: false, right: false, inside: false, leftEdge: false, rightEdge: false },
        tmp: new Map(), drops: [], falling: [], arrows: [], shots: [], fballs: [], eyes: [], draw: null, sandCheck: new Map(), leafQ: new Map(), liqFresh: new Set(), orbs: [], xpT: 0,
        tick: 0, acc: 0, last: 0, raf: 0, mine: null, placeDelay: 0, useTimer: -1, msg: '', msgT: 0,
        sign: { text: '', a: 0, on: false }, iname: { key: null, text: '', t: 0 },
        touchMode: 'mine', fires: new Set(), ride: null, bob: null, sleep: null
    };
    window.mbwPlay = { isPlaying: () => S.playing, state: S };
    // un punto del mundo (y hacia arriba) -> punto de la pantalla (con la vista del juego estirada). Lo usan las pruebas.
    window.mbwPlay.toClient = function (wx, wy) {
        const cv = document.getElementById('canvas'), r = cv.getBoundingClientRect();
        let X = (wx - camera.x) * tileSize, Y = cv.height - (wy - camera.y) * tileSize;
        const A = window.mbwAspect;
        if (A && A.active && A.screen) { const sr = A.screen(), f = sr.f; X = sr.x + (X - f.x) * sr.w / f.w; Y = sr.y + (Y - f.y) * sr.h / f.h; }
        return { x: r.left + X * r.width / cv.width, y: r.top + Y * r.height / cv.height };
    };

    // ------------------------------------------------------------------ mundo
    const W = () => mbwom.world;
    function fg(x, y) {
        x = Math.floor(x); y = Math.floor(y);
        const sc = mbwom.scene;
        if (!sc || x < 0 || y < 0) return 'air';
        const col = sc[x];
        if (!col) return 'air';
        const v = col[y];
        return (v === null || v === undefined || v === '' || v === 0) ? 'air' : String(v);
    }
    const key = (x, y) => 'blockX' + x + 'Y' + y;
    const ach = (n) => { try { if (window.mbwAch) window.mbwAch.unlock(n); } catch (e) { /* nada */ } };   // 🏆 logro (scripts/play-ach.js)
    const nearMe = (x, y, r) => { const w = W(); return Math.hypot(x - w.worldX, y - w.worldY) <= (r || 8); };
    // 🔊 sonidos del juego (scripts/game-sfx.js). gx, gy = posición como la guarda el juego (y hacia abajo = negativo,
    // igual que worldY y los mobs): el volumen baja con la distancia al Player y suena del lado donde está.
    const SFX = () => window.mbSfx || null;
    function sndAt(name, gx, gy, o) {
        const X = SFX(); if (!X || !S.playing) return null;
        o = Object.assign({}, o || {});
        if (gx != null) { const w = W(); o.dx = gx - w.worldX; o.dy = gy - w.worldY; }
        return X.play(name, o);
    }
    function snd(name, o) { return sndAt(name, null, null, o); }
    function blockSnd(t, kind, bx, by, vol) { const X = SFX(); if (!X || !S.playing) return; const w = W(); X.block(t, kind, bx + .5 - w.worldX, -(by + .5) - w.worldY, vol); }
    function mobSnd(m, kind) { const X = SFX(); if (!X || !S.playing || !m) return; const w = W(); X.mob(m.type, kind, m.x - w.worldX, m.y - w.worldY, m.babyTimer > 0); }
    const st = (x, y) => (mbwom.states ? mbwom.states[key(x, y)] : undefined);
    // 🎮 multijugador: un cambio que no pasa por setBlockState (nota, nivel del agua...) se apunta para mandarlo a los demás
    const netMark = (x, y) => { const N = window.mbwMpPlay; if (S.mp && N && N.mark) N.mark(x, y); };
    // 🎮 invitado en una partida: lo que pasa SOLO en el mundo (agua que corre, hornos) lo hace el anfitrión y le llega por la red
    const mpGuest = () => !!(S.mp && window.mbwMpPlay && window.mbwMpPlay.role === 'guest');
    const mpHost = () => !!(S.mp && window.mbwMpPlay && window.mbwMpPlay.role === 'host');
    // 👑 Crystal (los admins de scripts/mp-saved.js): comandos sin restricciones, como el anfitrión
    // 🏠 el anfitrión de la SALA (comandos sin límite). Ojo: la partida la puede llevar otro jugador (el que empezó a jugar): eso es mpHost()
    const roomHost = () => !!(S.mp && typeof isHost !== 'undefined' && isHost);
    const isAdminMe = () => { try { return !!(window.mbwSavedServers && window.mbwSavedServers.isAdmin && window.mbwSavedServers.isAdmin()); } catch (e) { return false; } };
    const isAdminUid = (u) => { try { return !!(window.mbwSavedServers && window.mbwSavedServers.isAdminUid && window.mbwSavedServers.isAdminUid(u)); } catch (e) { return false; } };
    const myUidNet = () => { try { return localStorage.getItem('mbw_uid') || ''; } catch (e) { return ''; } };
    const mpSend = (d) => { if (!S.mp || typeof window.enviarMensajeEnRed !== 'function') return; if (!d.peerId && window.mbwMpPlay && window.mbwMpPlay.myId) d.peerId = window.mbwMpPlay.myId(); window.enviarMensajeEnRed(d); };
    // 🎮 Etapa 2: los OTROS jugadores, para los mobs del anfitrión. Su id para los mobs es 'rp:' + su peerId.
    const RP = 'rp:';
    const isRemoteId = (id) => typeof id === 'string' && id.indexOf(RP) === 0;
    const isPl = (id) => id === PLAYER_ID || isRemoteId(id);
    function remoteOf(id) {
        const N = window.mbwMpPlay; if (!S.mp || !N || !N.remotes || !isRemoteId(id)) return null;
        const r = N.remotes[id.slice(RP.length)];
        if (!r || r.d || r.s !== (mbwom.currentScene || 1) || Date.now() - r.t > 3000 || r.gm == 3) return null;
        return r;
    }
    function plPos(id) { if (id === PLAYER_ID) { const w = W(); return { x: w.worldX, y: w.worldY }; } const r = remoteOf(id); return r ? { x: r.tx, y: r.ty } : null; }
    function plBounds(id) { const p = plPos(id); return p ? { l: p.x - .4, r: p.x + .4, t: p.y - 1.9, b: p.y } : null; }
    // el jugador (yo o uno de los otros) más cercano al que un mob hostil puede perseguir (no en creativo ni espectador)
    function nearestPl(m) {
        const w = W(); let best = null, bd2 = Infinity;
        if (w.gamemode != 1 && w.gamemode != 3 && !(w.dead > 0) && !effLv('invisibility')) { best = PLAYER_ID; bd2 = Math.pow(w.worldX - m.x, 2) + Math.pow(w.worldY - m.y, 2); }
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const r = remoteOf(RP + k); if (!r || r.gm == 1) continue; const dd = Math.pow(r.tx - m.x, 2) + Math.pow(r.ty - m.y, 2); if (dd < bd2) { bd2 = dd; best = RP + k; } } }
        return best;
    }
    // golpe a otro jugador (lo manda el anfitrión; el otro se lo quita de su vida)
    function hitRemote(id, amount, cause) { if (!isRemoteId(id)) return; mpSend({ tipo: 'juego_golpe', a: id.slice(RP.length), dmg: amount, causa: cause }); }
    function setBlock(x, y, type, st1) {
        if (x < 0 || y < 0) return;
        const s = { type: (type && type !== 'air') ? type : null };
        if (st1 !== undefined && s.type) s.states1 = st1;
        mbwom.setBlockState(x, y, s);
        if (typeof window.renderBlock === 'function') window.renderBlock(x, y);
        // lo que había encima puede caerse (Block_Sand.inter: se revisa 2 pasos después)
        S.sandCheck.set(x + ',' + (y + 1), S.tick + 2);
        S.sandCheck.set(x + ',' + y, S.tick + 2);
        S.sandCheck.set((x - 1) + ',' + y, S.tick + 2);              // (el cactus se rompe si le ponen algo al lado)
        S.sandCheck.set((x + 1) + ',' + y, S.tick + 2);
    }
    function getWater(x, y) { const w = mbwom.water && mbwom.water[key(x, y)]; return Array.isArray(w) ? w : [0, 0]; }
    function gameRule(name) {
        const w = W();
        const gr = w && (w.gameRules || w.gamerules);
        if (gr && typeof gr === 'object' && name in gr) return gr[name];
        return undefined;
    }

    // Game.collision — ¿hay algo sólido en el rectángulo (x, y, ancho c, alto d), revisado cada "f"?
    // (y del juego crece hacia ABAJO: el bloque es floor(-y))
    function collision(b, a, c, d, f, l, g, k) {
        if (k == null) k = false; if (g == null) g = true; if (l == null) l = true;
        for (let n = b; n - (b + c) <= f / 2; n += f) {
            for (let m = a; m - (a + d) <= f / 2; m += f) {
                const p = Math.floor(n), Q = Math.floor(-m);
                let h = fg(p, Q);
                if (k && bd(h, 'liquidCollision') == 1) return true;
                if (bd(h, g ? 'walkThroughBlockHit' : 'walkThroughBlock') != 1) {
                    if (bd(h, 'halfBlock') == 1) {
                        if (st(p, Q) == 2) { if (modulus(-m, 1) > .5) return true; }
                        else if (modulus(-m, 1) < .5) return true;
                    } else if (bd(h, 'stairBlock') == 1) {
                        const s = st(p, Q);
                        if (s == 4) { if (modulus(n, 1) < .5 || modulus(-m, 1) > .5) return true; }
                        else if (s == 2) { if (modulus(n, 1) < .5 || modulus(-m, 1) < .5) return true; }
                        else if (s == 3) { if (modulus(n, 1) > .5 || modulus(-m, 1) > .5) return true; }
                        else if (modulus(n, 1) > .5 || modulus(-m, 1) < .5) return true;
                    } else if (h.substr(0, 2) === 'lp') {
                        if (modulus(-m, 1) < .5) return true;
                    } else if (h === 'bed1' || h === 'bed2') {
                        if (modulus(-m, 1) < .5) return true;            // 🛏 (solo en el Modo Jugar del editor) la cama choca como una losa: medio bloque
                    } else return true;
                } else if (h.substr(-3) === 'fnc') {
                    if ((fg(p - 1, Q).split('g')[0] !== h && bd(fg(p - 1, Q), 'walkThroughBlockHit') == 1 || fg(p + 1, Q).split('g')[0] !== h && bd(fg(p + 1, Q), 'walkThroughBlockHit') == 1) && modulus(n, 1) > 1 / 3 && modulus(n, 1) < 2 / 3) return true;
                } else if (h.substr(-4) === 'fncg' && st(p, Q) != 1) {
                    if (modulus(n, 1) > 1 / 3 && modulus(n, 1) < 2 / 3) return true;
                } else if (h === 'ibar') {
                    if ((fg(p - 1, Q) !== 'ibar' && bd(fg(p - 1, Q), 'walkThroughBlockHit') == 1 || fg(p + 1, Q) !== 'ibar' && bd(fg(p + 1, Q), 'walkThroughBlockHit') == 1) && modulus(n, 1) > 1 / 3 && modulus(n, 1) < 2 / 3) return true;
                } else if (l) {
                    h = fg(p, Q - 1);
                    const x2 = fg(p, Q - 2);
                    if (modulus(n, 1) > 1 / 3 && modulus(n, 1) < 2 / 3) {
                        if (h.substr(-3) === 'fnc') {
                            if (fg(p - 1, Q - 1).split('g')[0] !== h && bd(fg(p - 1, Q - 1), 'walkThroughBlockHit') == 1 || fg(p + 1, Q - 1).split('g')[0] !== h && bd(fg(p + 1, Q - 1), 'walkThroughBlockHit') == 1) return true;
                        } else if (x2.substr(-3) === 'fnc' && bd(h, 'walkThroughBlockHit') == 1) {
                            if (fg(p - 1, Q - 2).split('g')[0] !== x2 && bd(fg(p - 1, Q - 2), 'walkThroughBlockHit') == 1 || fg(p + 1, Q - 2).split('g')[0] !== x2 && bd(fg(p + 1, Q - 2), 'walkThroughBlockHit') == 1) return true;
                        } else if (h.substr(-4) === 'fncg' && st(p, Q - 1) != 1 || x2.substr(-4) === 'fncg' && st(p, Q - 2) != 1 && bd(h, 'walkThroughBlockHit') == 1) return true;
                    }
                }
            }
        }
        return false;
    }
    function collisionWithLiquid(b, a, c, d, f) {
        for (let n = b; n - (b + c) <= f / 2; n += f) for (let m = a; m - (a + d) <= f / 2; m += f) if (bd(fg(Math.floor(n), Math.floor(-m)), 'liquidCollision') == 1) return true;
        return false;
    }

    // ------------------------------------------------------------------ inventario
    const empty = () => ['air', 0, 0, {}];
    const isEmpty = (it) => !it || it[0] == null || it[0] === '' || it[0] === 'air' || it[0] === 'na' || !(Number(it[1]) >= 1);
    function inv() {
        const w = W();
        if (!Array.isArray(w.inventoryList)) w.inventoryList = [];
        while (w.inventoryList.length < 45) w.inventoryList.push(empty());
        if (typeof w.selectedInventoryItem !== 'number') w.selectedInventoryItem = 0;
        if (!Array.isArray(w.armors)) w.armors = [];
        while (w.armors.length < 4) w.armors.push(['air', 0, {}]);
        return w.inventoryList;
    }
    const selIndex = () => Math.max(0, Math.min(8, W().selectedInventoryItem | 0));
    const selItem = () => { const it = inv()[selIndex()]; return isEmpty(it) ? null : it; };
    const selType = () => { const it = selItem(); return it ? String(it[0]) : 'air'; };
    const selExtra = () => { const it = selItem(); return (it && it[3] && typeof it[3] === 'object') ? it[3] : {}; };
    const maxStack = (id) => bd(id, 'unstackable') == 1 ? 1 : 64;
    function sameExtras(a, b) { try { return JSON.stringify(a || {}) === JSON.stringify(b || {}); } catch (e) { return false; } }
    function addToInventory(id, count, dmg, extras) {
        const list = inv();
        const max = maxStack(id);
        let left = count | 0;
        for (let i = 0; i < 45 && left > 0; i++) {
            const it = list[i];
            if (!isEmpty(it) && it[0] === id && (Number(it[2]) || 0) === (Number(dmg) || 0) && sameExtras(it[3], extras) && it[1] < max) {
                const m = Math.min(left, max - it[1]); it[1] += m; left -= m;
            }
        }
        for (let i = 0; i < 45 && left > 0; i++) {
            if (isEmpty(list[i])) { const m = Math.min(left, max); list[i] = [id, m, dmg || 0, JSON.parse(JSON.stringify(extras || {}))]; left -= m; }
        }
        hud.dirty = true;
        return left;
    }
    function reduceSelected(n) {
        if (W().gamemode == 1) return;
        const list = inv(), i = selIndex();
        const it = list[i];
        if (isEmpty(it)) return;
        it[1] -= n;
        if (it[1] <= 0) list[i] = empty();
        hud.dirty = true;
    }
    function damageTool() {
        if (W().gamemode == 1) return;
        const it = selItem();
        if (!it || it[0] === 'bl') return;
        const life = bd(it[0], 'life');
        if (life == null) return;
        // (irrompible / irrompibilidad I-IV: como Game.damageTool se gasta con probabilidad 2/3, 1/2, 1/3 o 1/4)
        const ex = it[3] || {};
        if (ex.unbreakable != null) return;
        const P = ex.unbreaking1 != null ? 2 / 3 : ex.unbreaking2 != null ? 1 / 2 : ex.unbreaking3 != null ? 1 / 3 : ex.unbreaking4 != null ? 1 / 4 : 1;
        if (P < 1 && Math.random() >= P) return;
        it[2] = (Number(it[2]) || 0) + 1;
        if (it[2] >= life) { inv()[selIndex()] = empty(); flashMsg('💥 ' + tr('play_tool_broke', 'Your tool broke!')); }
        hud.dirty = true;
    }

    // 📳 Vibración (celular): al romper un bloque, mientras se pica (suave) y al recibir daño. Se apaga en Configuración.
    const VIB_KEY = 'mbw_play_vibrate';
    function vibOn() { try { if (localStorage.getItem(VIB_KEY) === '0') return false; } catch (e) { /* nada */ } return !!(navigator.vibrate && (document.body.classList.contains('is-touch') || (window.matchMedia && matchMedia('(pointer: coarse)').matches))); }
    function buzz(ms) { if (!S.playing || !vibOn()) return; try { navigator.vibrate(ms); S.lastBuzz = { ms: ms, at: performance.now() }; } catch (e) { /* nada */ } }
    window.setPlayVibration = function (on) { try { localStorage.setItem(VIB_KEY, on ? '1' : '0'); } catch (e) { /* no se recuerda */ } };
    (function () { const sync = function () { const c = document.getElementById('play-vibrate-toggle'); if (c) { let v = true; try { v = localStorage.getItem(VIB_KEY) !== '0'; } catch (e) { /* nada */ } c.checked = v; } }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync(); })();

    // ------------------------------------------------------------------ objetos tirados en el suelo
    function addDrop(id, x, y, count, dmg, extras) {
        if (!id || id === 'air' || id === 'na' || !(count > 0)) return;
        const o = { id: String(id), n: count | 0, dmg: dmg || 0, ex: extras || {}, x: x, y: y, vx: migSpeed(4 * Math.random() - 2), vy: migSpeed(-4), age: 0, born: Date.now() };
        S.drops.push(o);
        // 🎮 multijugador: todos ven el objeto (con un número para saber cuál es) y cae igual en todas las pantallas
        if (S.mp && window.mbwMpPlay) { o.nid = window.mbwMpPlay.myId() + ':' + S.dropBase + ':' + (++S.dropSeq); mpSend({ tipo: 'juego_suelta', d: packDrop(o) }); }
    }
    const packDrop = (o, sc) => ({ nid: o.nid, id: o.id, n: o.n, dmg: o.dmg, ex: o.ex, x: o.x, y: o.y, vx: o.vx, vy: o.vy, age: o.age | 0, born: o.born || Date.now(), s: sc || mbwom.currentScene || 1 });
    // 🖥 SERVIDORES: los objetos tirados duran 24 horas (cada uno cuenta su propio tiempo, desde que cayó) y se guardan con el
    //   mundo del servidor (mbweDrops), así siguen ahí aunque el servidor se cierre y se vuelva a abrir. Fuera de un servidor:
    //   como en el juego, 5 minutos.
    const DROP_DAY = 24 * 60 * 60 * 1000;
    function isServer() { const w = W(); return !!(S.mp && !S.test && (window.mpServerKind || (w && w.mbweServerMap))); }
    function packAllDrops() {
        const out = [];
        S.drops.forEach(function (d) { if (d.nid) out.push(packDrop(d)); });
        Object.keys(S.dimStash || {}).forEach(function (k) { ((S.dimStash[k] || {}).drops || []).forEach(function (d) { if (d.nid) out.push(packDrop(d, Number(k))); }); });
        return out;
    }
    // (el que lleva la partida, al empezar: vuelven los objetos que estaban tirados, menos los que ya cumplieron 24 h)
    function restoreServerDrops() {
        S.dropsRestored = true;
        const w = W(), L = Array.isArray(w.mbweDrops) ? w.mbweDrops : [];
        if (!L.length) return;
        const now = Date.now(), cur = mbwom.currentScene || 1, sent = [];
        L.forEach(function (o) {
            if (!o || !o.nid || !(now - (Number(o.born) || 0) < DROP_DAY) || dropIdx(o.nid) >= 0) return;
            const d = { nid: String(o.nid), id: String(o.id), n: o.n | 0, dmg: o.dmg || 0, ex: o.ex || {}, x: Number(o.x), y: Number(o.y), vx: 0, vy: 0, age: o.age | 0, born: Number(o.born) };
            const sc = Number(o.s) || 1;
            if (sc === cur) S.drops.push(d);
            else { S.dimStash = S.dimStash || {}; const b = S.dimStash[sc] = S.dimStash[sc] || {}; b.drops = b.drops || []; b.drops.push(d); }
            sent.push(packDrop(d, sc));
        });
        for (let i = 0; i < sent.length; i += 40) mpSend({ tipo: 'juego_suelos', l: sent.slice(i, i + 40) });
    }
    window.mbwPlay.serverDrops = { pack: function () { return packAllDrops(); }, isServer: function () { return isServer(); }, DAY: DROP_DAY };   // (pruebas)
    const dropIdx = (nid) => { for (let i = 0; i < S.drops.length; i++) if (S.drops[i].nid === nid) return i; return -1; };
    // 🧭 ¿x está lejos de todos los jugadores? (S.simX = sus x, se calcula al empezar cada paso)
    const SIM_DIST = 64, MOB_SIM = 40;
    function simFar(x, r) {
        const L = S.simX; if (!L || !L.length) return false;
        r = r || SIM_DIST; x = Number(x);
        if (!(x === x)) return false;
        for (let i = 0; i < L.length; i++) if (Math.abs(x - L[i]) <= r) return false;
        return true;
    }
    window.mbwPlay.simFar = function (x, r) { return simFar(x, r); };   // (lo usan las pruebas)
    // 🫳 los objetos se toman casi enseguida (4 pasos = 0.08 s); los que tiras tú esperan un poco (si no, los vuelves a tomar)
    const PICKUP_DELAY = 4, THROW_DELAY = 40;
    let lastPop = 0;
    function pickSnd() { const n = performance.now(); if (n - lastPop < 60) return; lastPop = n; snd('pop', { vary: .45 }); }   // 🔊 el "pop" del juego
    window.mbwPlay.pickSnd = pickSnd;
    function solidAt(x, y) { const t = fg(x, y); return t !== 'air' && bd(t, 'walkThroughBlockHit') != 1 && bd(t, 'halfBlock') != 1 && bd(t, 'stairBlock') != 1; }   // (los objetos tirados atraviesan hojas, troncos, plantas...)
    function dropStuck(d) { return solidAt(Math.floor(d.x), Math.floor(-d.y)); }
    function freeNear(bx, by) {                                    // el hueco libre más cercano (primero arriba, luego a los lados)
        for (let r = 1; r <= 4; r++) {
            const c = [[0, r], [-r, 0], [r, 0], [-r, r], [r, r], [0, -r], [-r, -r], [r, -r]];
            for (let i = 0; i < c.length; i++) { const x = bx + c[i][0], y = by + c[i][1]; if (y >= 0 && !solidAt(x, y)) return [x, y]; }
        }
        return null;
    }
    window.mbwPlay.mineBlock = function (x, y) { mineBlock(x, y); };   // (lo usan las pruebas)
    window.mbwPlay.mobMoving = function (id) { if (!S.playing) return null; const d = S.tmp.get(id); return d && d.keys ? !!(d.keys.left || d.keys.right) : null; };   // 🐺 (scripts/mob-anim.js: para animar al caminar)
    window.mbwPlay.placeAt = function (x, y) { return placeBlock({ x: x + .5, y: y + .5 }); };   // (lo usan las pruebas)
    window.mbwPlay.dropStuck = function (i) { const d = S.drops[i]; return d ? dropStuck(d) : null; };
    function tickDrops() {
        const w = W();
        const srv = isServer(), now = Date.now();
        if (srv && !S.dropsRestored && mpHost()) restoreServerDrops();
        if (srv && S.tick % 50 === 0) Object.keys(S.dimStash || {}).forEach(function (k) { const b = S.dimStash[k]; if (b && b.drops) b.drops = b.drops.filter(function (d) { return now - (d.born || now) < DROP_DAY; }); });
        for (let i = S.drops.length - 1; i >= 0; i--) {
            const d = S.drops[i];
            if (srv && now - (d.born || now) >= DROP_DAY) { S.drops.splice(i, 1); continue; }   // 🖥 (24 h tirado: se limpia, este solo)
            if (simFar(d.x)) continue;                              // 🧭 lejos de todos los jugadores: quieto
            d.age++;
            // 🧱 atrapado dentro de un bloque sólido (p. ej. rompiste grava y cayó la de arriba): sale al hueco libre más cercano
            if (d.age % 4 === 1 && dropStuck(d)) { const f = freeNear(Math.floor(d.x), Math.floor(-d.y)); if (f) { d.x = f[0] + .5; d.y = -(f[1] + .5); d.vx = 0; d.vy = 0; } }
            d.vy = Math.min(migSpeed(14), d.vy + .5);
            d.vx *= .9;
            const nx = d.x + d.vx / 30, ny = d.y + d.vy / 30;
            if (!collision(nx - .15, ny - .25, .3, 0, .1, true, true)) d.x = nx; else d.vx = 0;
            if (collision(d.x - .15, ny, .3, 0, .1, true, true)) { d.vy = 0; } else d.y = ny;
            if ((!srv && d.age > 300 * FPS) || d.y > 10) { S.drops.splice(i, 1); continue; }   // (fuera de un servidor: 5 minutos, como el juego)
            if (d.age > (d.pd != null ? d.pd : PICKUP_DELAY) && !(w.dead > 0) && w.gamemode != 3 && Math.abs(d.x - w.worldX) < 1.5 && Math.abs(d.y - (w.worldY - 1)) < 1.5) {
                // 🎮 invitado: se lo pide al anfitrión (si dos lo tocan a la vez, se lo lleva el primero)
                if (S.mp && d.nid && mpGuest()) { if (!d.pend || S.tick - d.pend > 75) { d.pend = S.tick; mpSend({ tipo: 'juego_toma', nid: d.nid }); } continue; }
                const n0 = d.n;
                const left = addToInventory(d.id, d.n, d.dmg, d.ex);
                if (left <= 0) S.drops.splice(i, 1); else d.n = left;
                if (left !== n0) pickSnd();
                if (S.mp && d.nid && left !== n0) mpSend({ tipo: 'juego_tomado', nid: d.nid, n: Math.max(0, left) });
            }
        }
    }

    // ------------------------------------------------------------------ arena / grava / TNT que caen (Entity_FallingBlock)
    // 🌵 Plantas que necesitan algo abajo (cactus, bambú, caña, flores, hongos, pasto alto, semillas...): si se lo quitan, se
    // rompen y sueltan su objeto (como en el juego: placeOn de BlockData + Block_Cactus.frameEvent).
    const PLANTS = { sl: 1, ct: 1, sw: 1, fw1: 1, fw2: 1, ms1: 1, ms2: 1, bb: 1, sc: 1, lgr: 1, shrub: 1, ds: 1, seed: 1, carrot: 1, potato: 1, nw: 1, bseed: 1, gasd: 1, lp: 1, pseed: 1, wseed: 1, moss: 1 };
    function matchPlaceOn(x, y, po) {                               // Game.matchBlockDataPlaceOn: [abajo, a los lados, arriba]
        const ok = function (set, n) { return !!(set && typeof set === 'object' && !Array.isArray(set) && (set.SOLID ? bd(n, 'walkThroughBlock') != 1 : set[n])); };
        const okSide = function (set) { return !!(set && typeof set === 'object' && !Array.isArray(set) && (set.SOLID ? (bd(fg(x - 1, y), 'walkThroughBlock') != 1 || bd(fg(x + 1, y), 'walkThroughBlock') != 1) : (set[fg(x - 1, y)] || set[fg(x + 1, y)]))); };
        return ok(po[0], fg(x, y - 1)) || ok(po[2], fg(x, y + 1)) || okSide(po[1]);
    }
    function plantSupported(x, y, t) {
        if (t === 'ct') {                                            // cactus: arena o cactus abajo y nada sólido a los lados
            const b = fg(x, y - 1);
            return (b === 'sd' || b === 'ct') && bd(fg(x - 1, y), 'waterWalkThroughBlock') == 1 && bd(fg(x + 1, y), 'waterWalkThroughBlock') == 1;
        }
        const po = bd(t, 'placeOn');
        return !Array.isArray(po) || matchPlaceOn(x, y, po);
    }
    // 🔥 antorchas: necesitan algo sólido donde están pegadas (abajo; o la pared, si están en la pared). Si no, se caen
    const TORCH_STICK = { th: 1, rstorch: 1, ortorch: 1 };
    function torchSupported(x, y) {
        const s1 = Number(st(x, y)), solid = function (q) { return q !== 'air' && bd(q, 'walkThroughBlock') == null && bd(q, 'liquid') == null; };
        if (s1 === 2) return solid(fg(x - 1, y));
        if (s1 === 3) return solid(fg(x + 1, y));
        return solid(fg(x, y - 1));
    }
    function checkSand(x, y) {
        const t = fg(x, y);
        if (PLANTS[t]) { if (!plantSupported(x, y, t)) mineBlock(x, y, true); return; }
        if (TORCH_STICK[t]) { if (!torchSupported(x, y)) mineBlock(x, y, true); return; }
        if (bd(t, 'falls') != 1) return;
        const below = fg(x, y - 1);
        if (below === 'la' || below === 'ad') { setBlock(x, y, null); return; }
        if (below === 'air' || bd(below, 'replaceable') == 1) {
            const s1 = st(x, y);
            setBlock(x, y, null);
            S.falling.push({ t: t, s: s1, x: x + .5, y: -y - .5, vx: 0, vy: 0, tnt: false, fuse: 0 });
        }
    }
    function igniteTNT(x, y) {
        sndAt('fuse', x + .5, -(y + .5));
        setBlock(x, y, null);
        S.falling.push({ t: 'TNT', x: x + .5, y: -y - .5, vx: migSpeed(2 * Math.random() - 1), vy: migSpeed(-5), tnt: true, fuse: 0 });
    }
    function tickFalling() {
        for (let i = S.falling.length - 1; i >= 0; i--) {
            const e = S.falling[i];
            if (simFar(e.x)) continue;
            if (e.tnt) { e.fuse++; if (e.fuse >= 200) { S.falling.splice(i, 1); explode(e.x | 0, -e.y | 0, 6, PLAYER_ID); continue; } }
            e.vy = Math.min(migSpeed(14), Math.max(migSpeed(-30), e.vy + .5));
            e.vx = Math.min(migSpeed(50), Math.max(migSpeed(-50), e.vx * migDamp(.98)));
            if (collision(e.x + (-14 + e.vx / migSpeed(1)) / 30, e.y - .4333, 1 / 30, .8667, 1 / 6, true, false)) { e.x = Math.round(e.x - .5) + .5; e.vx = Math.abs(e.vx) / 2; }
            if (collision(e.x + (14 + e.vx / migSpeed(1)) / 30, e.y - .4333, 1 / 30, .8667, 1 / 6, true, false)) { e.x = Math.round(e.x - .5) + .5; e.vx = -Math.abs(e.vx) / 2; }
            let landed = false;
            if (collision(e.x + (-5 + e.vx / migSpeed(1)) / 30, e.y + (-15 + e.vy / migSpeed(1)) / 30, 1 / 3, 1 / 30, 1 / 6, true, false)) { e.vy = 0; e.vx *= .5; e.y = Math.ceil(2 * e.y) / 2; }
            if (collision(e.x + (-5 + e.vx / migSpeed(1)) / 30, e.y + (15 + e.vy / migSpeed(1)) / 30, 1 / 30, 1 / 30, 1 / 6, true, false) || collision(e.x + (5 + e.vx / migSpeed(1)) / 30, e.y + (15 + e.vy / migSpeed(1)) / 30, 1 / 30, 1 / 30, 1 / 6, true, false)) { landed = true; e.vy = 0; e.vx *= .8; e.y = Math.ceil(2 * e.y) / 2; }
            e.y += e.vy / 30; e.x += e.vx / 30;
            if (e.y >= 1) { S.falling.splice(i, 1); continue; }
            if (!e.tnt && Math.round(e.vx) === 0 && landed) {
                const bx = Math.floor(e.x), by = Math.floor(-e.y);
                const here = fg(bx, by);
                if (here === 'air' || bd(here, 'replaceable') == 1) { setBlock(bx, by, e.t, e.s); if (e.t === 'anvil') sndAt('anvilsound', bx + .5, -(by + .5), { vol: .5 }); else blockSnd(e.t, 'place', bx, by); }
                else if (W().gamemode != 1) addDrop(e.t, e.x, e.y, 1);
                S.falling.splice(i, 1);
            }
        }
    }

    // ------------------------------------------------------------------ 💧 agua, lava y ácido que corren (blocks/Block_Water.js, Block_Lava.js, Block_Acid.js)
    // Cada bloque de líquido se revisa cada 12 ticks del juego a 25 fps (= 24 pasos aquí). Los niveles son [izquierda, derecha]:
    // 10,10 = fuente (lleno), 9,9 = chorro que cae, menos = la orilla que va bajando. El agua corre de lado hasta el nivel 3 y la
    // lava y el ácido hasta el 5 (por eso llegan menos lejos). Si se les quita lo que las alimenta, se secan. El agua que toca lava
    // fuente la vuelve obsidiana y la que toca lava que corre (o ácido) la vuelve piedra (cobblestone). Dos fuentes de agua con un
    // hueco en medio hacen una fuente nueva. En el Nether el agua se evapora. El ácido además quema lo que tiene "acidBurn".
    // (No incluido: que la lava prenda fuego a lo de alrededor.)
    const LIQ_MIN = { wr: 3, la: 5, ad: 5 };
    const LIQ_EVERY = Math.floor(12 * FPS / 25);
    const isLiq = (t) => t === 'wr' || t === 'la' || t === 'ad';
    function lvOf(x, y) {                                           // Game.getWater
        const v = mbwom.water && mbwom.water[key(x, y)];
        if (Array.isArray(v)) return v;
        return bd(fg(x, y), 'liquid') == 1 ? [10, 10] : [0, 0];
    }
    const fullLiq = (x, y) => { const v = lvOf(x, y); return v[0] == 10 && v[1] == 10; };
    function setLiq(x, y, L, lv) {
        if (x < 0 || y < 0) return;
        mbwom.setBlockState(x, y, { type: L, water: (lv[0] == 10 && lv[1] == 10) ? undefined : [lv[0], lv[1]] });
        if (typeof window.renderBlock === 'function') window.renderBlock(x, y);
        S.liqFresh.add(x + ',' + y);
        S.sandCheck.set(x + ',' + (y + 1), S.tick + 2); S.sandCheck.set((x - 1) + ',' + y, S.tick + 2); S.sandCheck.set((x + 1) + ',' + y, S.tick + 2);
    }
    function liqLevel(x, y, lv) {                                   // solo cambia el nivel (el dibujo de la orilla)
        if (!mbwom.water) mbwom.water = {};
        if (lv[0] == 10 && lv[1] == 10) delete mbwom.water[key(x, y)]; else mbwom.water[key(x, y)] = [lv[0], lv[1]];
        if (typeof window.renderBlock === 'function') window.renderBlock(x, y);
        netMark(x, y);
    }
    function liqGone(x, y) { if (mbwom.water) delete mbwom.water[key(x, y)]; setBlock(x, y, null); }
    function liqStep(x, y, L) {                                     // ifWater(): devuelve false si el bloque se secó
        const lv = lvOf(x, y).slice(), M = LIQ_MIN[L];
        const below = fg(x, y - 1);
        if (below === L && mbwom.water && Array.isArray(mbwom.water[key(x, y - 1)])) { const b = mbwom.water[key(x, y - 1)]; if (b[0] < 9 || b[1] < 9) liqLevel(x, y - 1, [9, 9]); }
        const eats = (n) => n === 'air' || bd(n, 'waterWalkThroughBlock') == 1 || (L === 'ad' && bd(n, 'acidBurn') == 1);
        if (y - 1 >= 0 && eats(below)) {                             // cae
            if (below !== 'air') mineBlock(x, y - 1, true);
            setLiq(x, y - 1, L, [9, 9]);
            return true;
        }
        if (!(lv[0] == 10 && lv[1] == 10)) {
            if (!(lv[0] == 9 && lv[1] == 9)) {
                if (lv[0] > lv[1]) { const n = isLiq(fg(x - 1, y)) ? lvOf(x - 1, y)[1] : -1; if (Math.min(n, 9) != Math.min(lv[0], 9)) { liqGone(x, y); return false; } }
                else if (lv[0] < lv[1]) { const n = isLiq(fg(x + 1, y)) ? lvOf(x + 1, y)[0] : -1; if (Math.min(n, 9) != Math.min(lv[1], 9)) { liqGone(x, y); return false; } }
                else { liqGone(x, y); return false; }
            } else if (fg(x, y + 1) !== L) { liqGone(x, y); return false; }
        } else if (L === 'wr') {                                      // dos fuentes con un hueco en medio: fuente nueva
            [-1, 1].forEach(function (s1) {
                const n = fg(x + s1, y);
                if ((n === 'air' || (n === 'wr' && !fullLiq(x + s1, y))) && fg(x + 2 * s1, y) === 'wr' && fullLiq(x + 2 * s1, y)) setLiq(x + s1, y, 'wr', [10, 10]);
            });
        }
        if (bd(fg(x, y - 1), 'liquid') != 1) {                        // corre a los lados
            const l0 = Math.min(lv[0], 9), l1 = Math.min(lv[1], 9);
            const nl = fg(x - 1, y);
            if ((eats(nl) || (nl === L && Math.min(lvOf(x - 1, y)[0], 9) < l0 - 1)) && M <= lv[0] - 1 && lv[0] <= lv[1] && x - 1 >= 0) {
                if (nl !== 'air') { if (L === 'wr') mineBlock(x - 1, y, true); else setBlock(x - 1, y, null); }
                setLiq(x - 1, y, L, [Math.floor(l0 - 1), Math.floor(l0)]);
            }
            const nr = fg(x + 1, y);
            if ((eats(nr) || (nr === L && Math.min(lvOf(x + 1, y)[1], 9) < l1 - 1)) && M <= lv[1] - 1 && lv[0] >= lv[1]) {
                if (nr !== 'air') { if (L === 'wr') mineBlock(x + 1, y, true); else setBlock(x + 1, y, null); }
                setLiq(x + 1, y, L, [Math.floor(l1), Math.floor(l1 - 1)]);
            }
        }
        return true;
    }
    function waterTouch(x, y) {                                     // el agua apaga la lava / el ácido que toca
        [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(function (o) {
            const X = x + o[0], Y = y + o[1], n = fg(X, Y);
            if (n !== 'la' && n !== 'ad') return;
            const ob = n === 'la' && fullLiq(X, Y);
            if (S.tick - (S.lastSizzle || -99) > 15) { S.lastSizzle = S.tick; sndAt('sizzle', X + .5, -(Y + .5)); }   // (si la lava sigue cayendo, no a cada rato)
            if (mbwom.water) delete mbwom.water[key(X, Y)];
            setBlock(X, Y, ob ? 'ob' : 'cs');
        });
        // columnas de burbujas: magma abajo = jala hacia abajo, arena de almas = empuja hacia arriba
        if (fullLiq(x, y) && mbwom.states) {
            const b = fg(x, y - 1), sb = st(x, y - 1), k = key(x, y);
            const was = mbwom.states[k];
            if (b === 'magma' || (b === 'wr' && sb == -1)) mbwom.states[k] = -1;
            else if (b === 'ssd' || (b === 'wr' && sb == 1)) mbwom.states[k] = 1;
            else if (mbwom.states[k] == 1 || mbwom.states[k] == -1) delete mbwom.states[k];
            if (was !== mbwom.states[k]) netMark(x, y);
        }
    }
    function tickLiquids() {
        if (S.tick % LIQ_EVERY !== 0) return;
        if (mpGuest()) return;
        const w = W(), sc = mbwom.scene; if (!sc) return;
        // alrededor del Player (en multijugador, el anfitrión también alrededor de cada jugador que está en esta dimensión)
        const centers = [Math.floor(w.worldX)];
        if (S.mp && window.mbwMpPlay) { const R = window.mbwMpPlay.remotes || {}, cs = mbwom.currentScene || 1; Object.keys(R).forEach(function (k) { if (R[k].s === cs && isFinite(R[k].tx)) centers.push(Math.floor(R[k].tx)); }); }
        const cols = new Set();
        centers.forEach(function (px) { for (let x = Math.max(0, px - 48), x1 = Math.min(sc.length - 1, px + 48); x <= x1; x++) cols.add(x); });
        const nether = (mbwom.currentScene || 1) == 2;
        S.liqFresh = new Set();
        const list = [];
        Array.from(cols).sort(function (a, b) { return a - b; }).forEach(function (x) { const col = sc[x]; if (!col) return; for (let y = 0; y < col.length; y++) { const t = col[y]; if (t === 'wr' || t === 'la' || t === 'ad') list.push(x, y); } });
        for (let i = 0; i < list.length; i += 2) {
            const x = list[i], y = list[i + 1], L = fg(x, y);
            if (!isLiq(L) || S.liqFresh.has(x + ',' + y)) continue;
            if (L === 'wr' && nether) { liqGone(x, y); continue; }
            if (liqStep(x, y, L) && L === 'wr') waterTouch(x, y);
            // el agua que corre suena de vez en cuando (Block_Water: 1 entre 1000 por paso, y no dos seguidos)
            if (L === 'wr' && fg(x, y) === 'wr' && !fullLiq(x, y) && Math.random() < .001 * LIQ_EVERY && S.tick - (S.lastWaterSnd || -99) > 10) {
                S.lastWaterSnd = S.tick; sndAt('water' + ((Math.random() * 6 | 0) + 1), x + .5, -(y + .5), { vol: .2, vary: 1, rate: .9 });
            }
        }
    }
    function gameRuleOn(name) { const v = gameRule(name); return v === undefined || v === null || v === true || v === 1 || v === '1' || v === 'true'; }

    // ------------------------------------------------------------------ explosión (Game.explode)
    function explode(b, a, c, byId, fromNet) {
        const w = W();
        sndAt('boom', b + .5, -(a + .5));
        // 🎮 los demás también la sienten (cada quien se quita su vida; los mobs los lastima el anfitrión)
        if (S.mp && !fromNet) mpSend({ tipo: 'juego_boom', x: b, y: a, c: c, s: mbwom.currentScene || 1 });
        if (!mpGuest()) for (const id in mbwom.mobs) {
            const m = mbwom.mobs[id];
            if (!m || !(m.health > 0) || m.dead > 0) continue;
            if (Math.abs(m.x - (b + .5)) < c && Math.abs(-m.y - (a + .5)) < c) hurtMob(id, 4 * Math.max(0, c - Math.hypot(m.x - (b + .5), -m.y - (a + .5))) | 0, 'explosion', byId);
        }
        if (Math.abs(w.worldX - (b + .5)) < c && Math.abs(-w.worldY - (a + .5)) < c) ouch(1, Math.max(0, 4 * (c - Math.hypot(w.worldX - (b + .5), -w.worldY - (a + .5)) | 0)), 'explosion');
        if (fg(b, a + 1) === 'wr' || fg(b, a - 1) === 'wr' || fg(b + 1, a) === 'wr' || fg(b - 1, a) === 'wr') return;
        const strong = ['b', 'br', 'stairbr', 'halfbr', 'ob', 'stairob', 'halfob', 'portalstone', 'pf', 'bdob'];
        const r = Math.round(c / 2);
        for (let T = (b - r) | 0; T < (b + r + 1 | 0); T++) for (let B = (a - r) | 0; B < (a + r + 1 | 0); B++) {
            const t = fg(T, B);
            if (t === 'air') continue;
            const inside = (b === T && a === B) || ((T - b) * (T - b) + (B - a) * (B - a) <= c * c && (4 * Math.random() | 0) !== 0);
            if (!inside) continue;
            if (t === 'TNT') { igniteTNT(T, B); continue; }
            if (strong.indexOf(t) >= 0 || bd(t, 'liquid') == 1) continue;
            setBlock(T, B, null);
        }
        flashMsg('💥');
    }

    function netBoom(b, a, c, by) {
        const w = W();
        sndAt('boom', b + .5, -(a + .5));
        if (!mpGuest()) for (const id in mbwom.mobs) {
            const m = mbwom.mobs[id];
            if (!m || !(m.health > 0) || m.dead > 0) continue;
            if (Math.abs(m.x - (b + .5)) < c && Math.abs(-m.y - (a + .5)) < c) hurtMob(id, 4 * Math.max(0, c - Math.hypot(m.x - (b + .5), -m.y - (a + .5))) | 0, 'explosion', by);
        }
        if (Math.abs(w.worldX - (b + .5)) < c && Math.abs(-w.worldY - (a + .5)) < c) ouch(1, Math.max(0, 4 * (c - Math.hypot(w.worldX - (b + .5), -w.worldY - (a + .5)) | 0)), 'explosion');
    }

    // ------------------------------------------------------------------ Player
    function newPlayer() {
        return {
            falling: false, wasFalling: false, wasFallingSpeed: 0, wasFallingAndNotFalling: 0, suffocate: 0,
            rightable: true, leftable: true, rightSprinting: 0, leftSprinting: 0, jumpTimer: 0, sneaking: false,
            inWater: false, airTimer: 30, startUnderwaterTimer: 0, distanceX: 0, xScale: 1, hurt: 0, keysX: false
        };
    }
    // 🛡 cuánto protege lo que traes puesto, de 0 a 20 (10 iconos). Sale de cómo el juego quita el daño (ouch): cada pieza
    // quita 25 % × (1 − B) del daño, con B según el material (cuero .68, oro .52, hierro .38, diamante .26, dragón .2, en promedio).
    // Las piezas rotas o que no protegen (gorro de fiesta, lentes...) no cuentan.
    const ARMOR_B = [['Leather', .68], ['Gold', .52], ['Iron', .38], ['Diamond', .26], ['Dragon', .2]];
    function armorPoints(w) {
        let f = 0;
        const A = (w && w.armors) || [];
        for (let p = 0; p < A.length && p < 4; p++) {
            const ar = A[p]; if (!ar || !ar[0] || ar[0] === 'air') continue;
            const id = String(ar[0]), life = bd(id, 'life');
            if (life == null || (Number(ar[1]) || 0) > life) continue;
            for (let k = 0; k < ARMOR_B.length; k++) if (id.indexOf(ARMOR_B[k][0]) === 0) { f += .25 * (1 - ARMOR_B[k][1]); break; }
        }
        return Math.min(20, Math.round(f * 20));
    }
    window.mbwPlay.armorPoints = function () { return armorPoints(W()); };
    function sneakOrUse() { return S.p.sneaking || S.useTimer > -1; }
    // 🛡 Game.damageArmor: se gasta (con "irrompible" no; con Unbreaking menos) y si llega a su vida, se rompe
    function damageArmor(p, a) {
        const w = W(), ar = w.armors[p];
        if (w.gamemode == 1 || !ar || !ar[0] || ar[0] === 'air') return;
        const ex = ar[2] || {}, life = bd(String(ar[0]), 'life');
        if (ex.unbreakable != null || life == null) return;
        const P = ex.unbreaking1 != null ? 2 / 3 : ex.unbreaking2 != null ? 1 / 2 : ex.unbreaking3 != null ? 1 / 3 : ex.unbreaking4 != null ? 1 / 4 : 1;
        if (P < 1 && Math.random() >= P) return;
        ar[1] = (Number(ar[1]) || 0) + Math.round(a);
        if (Number(ar[1]) >= Number(life)) { w.armors[p] = ['air', 0, {}]; flashMsg('💥 ' + tr('play_armor_broke', 'Your armor broke!')); }
        hud.dirty = true;
        try { if (typeof window.playerInvRefresh === 'function' && document.getElementById('inventory-modal') && document.getElementById('inventory-modal').style.display === 'block') window.playerInvRefresh(); } catch (e) { /* nada */ }
    }
    function ouch(b, a, c) {
        const w = W();
        if (w.dead > 0 || w.gamemode == 1 || w.gamemode == 3) return;
        S.lastHurt = { c: c, mob: S.hitBy && Date.now() - S.hitBy.t < 300 ? S.hitBy.m : (c === 'attack' || c === 'arrow' ? (S.lastHurt && S.lastHurt.mob) : null) }; S.hitBy = null;
        if (effLv('fireresistance') && (c === 'fire' || c === 'lava' || c === 'burning')) return;   // (poción de resistencia al fuego)
        if (['anvil', 'fall', 'lava', 'acid', 'explosion', 'fire', 'lightning', 'attack', 'arrow', 'cactus'].indexOf(c) >= 0) {
            let d = 1;
            for (let p = 0; p < w.armors.length; p++) {
                const ar = w.armors[p];
                if (!ar || !ar[0] || ar[0] === 'air') continue;
                const id = String(ar[0]);
                let B = 1;
                if (c === 'anvil' && p === 0) {
                    damageArmor(p, Math.ceil(a / 2));
                    if (!w.armors[p] || w.armors[p][0] === 'air') continue;
                    a *= id.substr(0, 7) === 'Leather' ? .8 : id.substr(0, 4) === 'Gold' ? .6 : id.substr(0, 4) === 'Iron' ? .4 : id.substr(0, 7) === 'Diamond' ? .3 : id.substr(0, 6) === 'Dragon' ? .2 : 1;
                    continue;
                }
                const life = bd(id, 'life');
                const ex = ar[2] || {}, k = ex.protection1 != null ? .02 : ex.protection2 != null ? .035 : ex.protection3 != null ? .05 : ex.protection4 != null ? .065 : 0;
                if (life != null && (Number(ar[1]) || 0) <= life) {
                    B = id.substr(0, 7) === 'Leather' ? .72 - Math.random() * (.08 + 4 * k) : id.substr(0, 4) === 'Gold' ? .6 - Math.random() * (.16 + 4 * k) : id.substr(0, 4) === 'Iron' ? .48 - Math.random() * (.2 + 4 * k) : id.substr(0, 7) === 'Diamond' ? .4 - Math.random() * (.28 + 4 * k) : id.substr(0, 6) === 'Dragon' ? .36 - Math.random() * (.32 + 4 * k) : 1;
                    if (id.substr(0, 6) === 'Dragon' && (c === 'fire' || c === 'lightning' || c === 'lava')) B *= Math.pow(Math.random(), 3);
                }
                damageArmor(p, a * (1 - B) * .75);                           // la armadura se gasta (Game.damageArmor)
                d -= .25 * (1 - B);
            }
            a *= Math.max(0, d);
        }
        if (a !== 0) { w.health -= Math.ceil(a); if (a > 0) { S.p.hurt = 10; buzz(Math.min(120, 35 + 10 * Math.ceil(a))); snd(Math.random() < .5 ? 'ouch1' : 'ouch2', { vary: .3 }); } hud.dirty = true; }
    }
    const key2 = (n) => !!S.keys[n];
    // ⚙ Opciones del Modo Jugar (menú de pausa > Options; se recuerdan en este navegador). scripts/play-menu.js las cambia.
    const OPT_KEY = 'mbw_play_opts';
    const OPT_DEF = { autoJump: true, res: 'default', particles: 'all', anims: true, effects: true, transitions: true, coords: false, loupe: true };
    const OPTS = (function () { let o = {}; try { o = JSON.parse(localStorage.getItem(OPT_KEY) || '{}') || {}; } catch (e) { o = {}; } return Object.assign({}, OPT_DEF, o); })();
    const RES = { default: null, '4:3': { w: 20, h: 15 }, '16:9': { w: 27, h: 15 } };   // cuántos bloques se ven (ancho x alto)
    function applyOpts() {
        document.body.classList.toggle('play-no-trans', OPTS.transitions === false);
        if (S.playing) {
            const A = window.mbwAspect, r = RES[OPTS.res] || null;
            if (A && A.startView) { const d = r || A.defaults || { w: 18, h: 14 }; A.startView(d.w, d.h); }
            if (typeof window.setAnimationsEnabled === 'function' && S.old) window.setAnimationsEnabled(OPTS.anims !== false ? S.old.anims !== false : false);
            camSnap();
        }
    }
    function setOpt(k, v) { if (!(k in OPT_DEF)) return; OPTS[k] = v; try { localStorage.setItem(OPT_KEY, JSON.stringify(OPTS)); } catch (e) { /* nada */ } applyOpts(); }
    // 🦘 salto automático de 1 bloque: caminando contra un escalón de 1 bloque (con lugar arriba), salta solo
    function autoJumpNow(bx, by) {
        const P = S.p;
        // (recién caído de algo alto: se espera a estar bien parado unos pasos; si no, al aterrizar saltaba solo)
        if (P.falling || Math.abs(W().ySpeed || 0) > .5) { P.ajGround = 0; return false; }
        P.ajGround = (P.ajGround || 0) + 1;
        if (!OPTS.autoJump || P.sneaking || key2('down') || P.ajGround < 4) return false;   // (agachado: nunca)
        const dir = key2('right') ? 1 : key2('left') ? -1 : 0;
        if (!dir) return false;
        const w = W(), fx = Math.floor(w.worldX + dir * .9);              // (el bloque que está a 0.9 cuadros adelante)
        if (fx === bx) return false;
        const fy = Math.floor(-w.worldY + .1);                            // (la fila de los pies: parado, el Player se hunde 1/15 en el piso)
        const solid = function (x, y) { const t = fg(x, y); return t !== 'air' && bd(t, 'walkThroughBlockHit') != 1 && bd(t, 'liquid') == null; };
        if (solid(bx, fy)) return false;                                  // (los pies todavía metidos en el piso: no está parado arriba)
        const t = fg(fx, fy);
        if (bd(t, 'halfBlock') == 1 || bd(t, 'stairBlock') == 1) return false;   // (losas y escaleras: no)
        return solid(fx, fy) && !solid(fx, fy + 1) && !solid(fx, fy + 2) && !solid(bx, fy + 2);
    }
    function doPlayerLogic() {
        const w = W(), P = S.p;
        P.blockX = Math.floor(w.worldX);
        P.blockY = Math.floor(-w.worldY);
        const bx = P.blockX, by = P.blockY;
        P.standingOn1 = fg(w.worldX + .3, by);
        P.standingOn2 = fg(w.worldX - .3, by);
        const cantMove = w.dead > 0;
        if (w.gamemode == 3) {                                  // espectador: vuela atravesando todo
            P.keysX = false;
            if (!cantMove) {
                if (key2('left')) { w.xSpeed -= migAcc(1, .94); P.xScale = 1; P.keysX = true; }
                if (key2('right')) { w.xSpeed += migAcc(1, .94); P.xScale = -1; P.keysX = true; }
                if (key2('up')) w.ySpeed += migAcc(1, .94);
                if (key2('down')) w.ySpeed -= migAcc(1, .94);
            }
            w.xSpeed *= migDamp(.94); w.ySpeed *= migDamp(.94);
            w.worldX += w.xSpeed / 30; w.worldY -= w.ySpeed / 30;
            return;
        }
        P.blockAtFeet = fg(bx, by); P.blockAtLegs = fg(bx, by + 1); P.blockAtHead = fg(bx, by + 2);
        P.sneaking = !(!key2('down') || w.fly || cantMove);
        let b = w.worldX, a = w.worldY;
        if (!collision(b - .3, a + 1 / 30, .6, 0, .1, false)) {
            const c0 = -modulus(-w.worldY, 1);
            if (fg(bx, by) === 'st' && -.5 < c0 && !w.fly) {
                if (P.sneaking && S.tick % 16 === 0) w.worldY += .6; else if (Math.abs(.5 + c0) > 1 / 15) w.worldY -= .5 + c0;
                P.falling = false;
            } else if (!P.wasFalling && w.ySpeed <= 0 && (bd(fg(bx, by), 'stairBlock') == 1 || bd(fg(bx, by - 1), 'stairBlock') == 1) && !w.fly) {
                w.worldY += .5; P.falling = false;
            } else P.falling = true;
        }
        if (!P.falling) { if (P.wasFalling) P.wasFallingSpeed = -w.ySpeed; w.ySpeed = 0; }
        let c = true;
        if (P.wasFalling && !P.falling) {
            if (P.wasFallingAndNotFalling <= 0) {                     // 🔊 al caer al suelo: el sonido del bloque (o el del bloque de slime)
                const lx = Math.floor(w.worldX), ly = Math.floor(-w.worldY);    // (dónde quedó ya en el suelo)
                let g = fg(lx, ly), gy = ly;
                if (g === 'air' || bd(g, 'walkThroughBlock') == 1) { g = fg(lx, ly - 1); gy = ly - 1; }
                if (g === 'slimeb') snd('slimeblockland'); else blockSnd(g, 'step', lx, gy);
            }
            P.wasFallingAndNotFalling = 3;
            if (P.blockAtFeet.substr(0, 3) === 'bed') P.wasFallingSpeed *= .6;
            else if (P.blockAtFeet === 'slimeb' && !P.sneaking) {
                if (P.wasFallingSpeed > migSpeed(6)) { w.ySpeed = .78 * Math.max(0, P.wasFallingSpeed - migSpeed(5)); P.wasFallingSpeed = 0; w.worldY -= w.ySpeed / 2 / 30; snd('slimeblockjump'); }
                else w.ySpeed = 0;
            }
            if (P.wasFallingSpeed > migSpeed(23)) {                // daño por caída
                P.wasFallingSpeed -= migSpeed(14);
                let bb = 0, big = false, dmg = 0;
                while (P.wasFallingSpeed >= 0) { bb += 2; if (bb > 10) big = true; ++dmg; P.wasFallingSpeed -= Math.max(migSpeed(11 - bb), migSpeed(1)); }
                if (dmg > 0) ouch(1 + (big ? 1 : 0), dmg, 'fall');
            }
        } else P.wasFallingAndNotFalling--;
        if (w.gamemode == 1 && w.fly) { w.ySpeed *= migDamp(.2); P.falling = false; }
        // atrapado dentro de un bloque: se ahoga y lo empuja hacia afuera
        if (bd(P.blockAtLegs, 'walkThroughBlockHit') == null && P.blockAtLegs.substr(-3, 2) !== 'dr' && P.blockAtLegs !== 'lp') {
            if (P.suffocate === 0) { P.suffocate = 15; ouch(1, 1, 'suffocate'); }
            P.suffocate--;
            if (bd(fg(bx - 1, by + 1), 'walkThroughBlockHit') != null) w.worldX -= .5;
            else if (bd(fg(bx + 1, by + 1), 'walkThroughBlockHit') != null) w.worldX += .5;
            else if (bd(fg(bx, by + 2), 'walkThroughBlockHit') != null) w.worldY -= .5;
            else if (bd(fg(bx, by), 'walkThroughBlockHit') != null) w.worldY += .5;
            else if (bd(fg(bx, by - 1), 'walkThroughBlockHit') != null) w.worldY += .5;
        } else P.suffocate = 0;
        const dS = 0;                                              // (encantamiento Depth Strider: no incluido)
        [1, 2].forEach(function (o) {                             // corriente del agua
            const k = key(bx, by + o);
            if (mbwom.water && mbwom.water[k] && !w.fly) {
                const wa = getWater(bx, by + o);
                if (wa[0] > wa[1]) w.xSpeed -= migAcc(1 - dS, .55); else if (wa[0] < wa[1]) w.xSpeed += migAcc(1 - dS, .55);
                const s = mbwom.states ? mbwom.states[k] : undefined;
                if (s == 1) w.ySpeed += migAcc(3, .42); else if (s == -1 && P.falling) w.ySpeed -= migAcc(2, .42);
            }
        });
        b = w.worldX; a = w.worldY;
        let f = b + 2 / 3, l = b - 2 / 3;
        if (P.rightSprinting > 0 && bd(fg(Math.floor(b) + 1, Math.floor(-a) + 1), 'stairBlock') != 1) f += Math.floor(-w.xSpeed / 2) / 30;
        if (P.leftSprinting > 0 && bd(fg(Math.floor(b) - 1, Math.floor(-a) + 1), 'stairBlock') != 1) l += Math.floor(-w.xSpeed / 2) / 30;
        if (collision(f, a - 1.8333, 0, 1.1667, .1333)) { P.rightable = false; P.rightSprinting = 0; if (w.xSpeed < 0) w.xSpeed = 0; }
        if (collision(l, a - 1.8333, 0, 1.1667, .1333)) { P.leftable = false; P.leftSprinting = 0; if (w.xSpeed > 0) w.xSpeed = 0; }
        if (collision(b - 1 / 6, a - 2, 1 / 3, 0, .1333, false)) { c = false; if (w.ySpeed > 0) { w.ySpeed = -Math.abs(w.ySpeed / 2); w.worldY -= w.ySpeed / 30; } }
        if (!w.fly) {
            if (fg(bx, by + 1) === 'web' || fg(bx, by + 2) === 'web') { P.rightSprinting = P.leftSprinting = 0; w.xSpeed *= migDamp(.2); w.ySpeed *= migDamp(.2); }
            if (fg(bx, by) === 'ssd' || fg(bx, by) === 'slimeb') w.xSpeed *= migDamp(.5);
            if (fg(bx, by + 1) === 'wr' || fg(bx, by + 2) === 'wr') { P.rightSprinting = P.leftSprinting = 0; w.xSpeed *= migDamp(.7 + .3 * dS); w.ySpeed *= migDamp(.7 + .3 * dS); }
        }
        // mover (en pasitos, chocando)
        if (Math.abs(w.xSpeed) < migSpeed(.25)) w.xSpeed = 0;
        if (Math.abs(w.ySpeed) < migSpeed(.2)) {
            w.ySpeed = 0; b = w.worldX; a = w.worldY;
            if (!collision(b, a - 1 / 30, 0, 0, 1 / 30, false) && collision(b, a + 2 / 30, 0, 0, 1 / 30, false)) w.worldY += 1 / 30;
        } else {
            w.worldY -= w.ySpeed / 30;
            b = w.worldX; a = w.worldY;
            let dd = 0;
            for (dd = 0; dd <= Math.floor(Math.abs(w.ySpeed / 2)) && collision(b - (9 + w.xSpeed) / 30, a + (w.ySpeed / Math.abs(w.ySpeed / 2) * dd - 4) / 30, .6, 0, 1 / 30, false);) ++dd;
            w.worldY += w.ySpeed / Math.abs(w.ySpeed / 2) * dd / 30;
            a = w.worldY;
        }
        for (let s = 0; s < 5; s++) {
            if (sneakOrUse() && !P.falling && !w.fly) {               // agachado no se cae de las orillas
                if (w.xSpeed > 0) { if (!collision(b - .3, w.worldY, .5333, .6667, 1 / 6)) { w.xSpeed = 0; break; } }
                else if (w.xSpeed < 0 && !collision(b - .2333, w.worldY, .5333, .6667, 1 / 6)) { w.xSpeed = 0; break; }
            }
            w.worldX -= w.xSpeed / 5 / 30;
            b = w.worldX;
            for (let ff = 9; ff > 0 && collision(b - .3, a - .1333, .6, 1 / 30, .1, false) && !collision(b - .3, a - 1.8333, .6, 1 / 30, .1, false); ff--) { w.worldY -= 1 / 15; w.ySpeed = 0; a = w.worldY; }
        }
        // agua: aire y ahogarse
        const head2 = fg(bx, by + 2);
        if (head2 === 'sw' || head2 === 'wr' && (!(mbwom.water && mbwom.water[key(bx, by + 2)]) || getWater(bx, by + 2)[0] >= 9 || getWater(bx, by + 2)[1] >= 9)) {
            P.startUnderwaterTimer = 5;
            P.airTimer--;
            if (effLv('waterbreathing')) { P.airTimer = 60; w.air = 11; }        // (poción de respirar bajo el agua)
            if (P.airTimer <= 0) { P.airTimer = 60; if (!(w.air > 0)) ouch(1, 1, 'water'); else w.air--; hud.dirty = true; }
            P.inWater = true;
        } else {
            if (w.air !== 11) hud.dirty = true;
            w.air = 11; P.airTimer = 30;
            if (P.startUnderwaterTimer <= 0) P.inWater = false; else P.startUnderwaterTimer--;
        }
        // 🔊 con la cabeza bajo el agua suena "underwater" (sin parar) y al salir, "splash"
        if (P.inWater && !P.uwSnd) { P.uwSnd = true; if (SFX()) SFX().loop('underwater', 'underwater', .8); }
        else if (!P.inWater && P.uwSnd) { P.uwSnd = false; if (SFX()) SFX().loop('underwater', null); snd('splash'); }
        if (P.falling) {
            w.xSpeed *= bd(fg(bx, by + 1), 'liquid') != null ? migDamp(.55) : migDamp(.6);
            w.ySpeed -= migAcc(2, .94);
        } else if (fg(bx, by) === 'ice' || fg(bx, by) === 'fice') w.xSpeed *= migDamp(.9);
        else w.xSpeed *= migDamp(.7);
        if (bd(fg(bx, by + 1), 'climbable') == 1 && !w.fly) {
            w.ySpeed *= migDamp(.75);
            if ((fg(bx, by + 1) === 'ladder' || fg(bx, by + 1) === 'rp') && P.sneaking && Math.abs(w.ySpeed) < 5) w.ySpeed = 0;
        }
        if (S.tick % (FPS / 25 * 15) === 0) {                     // daño por bloques (cada 0.6 s)
            if ((P.blockAtFeet === 'ct' || P.blockAtLegs === 'ct' || P.blockAtHead === 'ct') && !P.sneaking) ouch(1, 1, 'cactus');
            if (P.blockAtFeet === 'la' && P.falling || P.blockAtLegs === 'la' || P.blockAtHead === 'la') ouch(1, 5, 'lava');
            else if (P.blockAtFeet === 'ad' && P.falling || P.blockAtLegs === 'ad' || P.blockAtHead === 'ad') ouch(1, 5, 'acid');
            else if (P.blockAtFeet === 'magma' && !P.sneaking) ouch(1, 2, 'lava');
            if (P.blockAtFeet === 'fire' || P.blockAtLegs === 'fire' || P.blockAtHead === 'fire') ouch(1, 1, 'fire');   // 🔥 el bloque de fuego quema
        }
        P.keysX = false;
        if (!cantMove) {                                           // caminar y correr
            const ek = Math.max(.2, 1 + .2 * effLv('speed') - .15 * effLv('slowness'));      // (pociones de velocidad / lentitud)
            const sp = 2.2 * ek, spr = sp + 2.2 * ek;
            if (key2('right')) {
                if (P.rightable) {
                    P.xScale = -1;
                    w.xSpeed -= sneakOrUse() ? migAcc(.5, .7) : P.rightSprinting !== 0 ? migAcc(spr, .7) : migAcc(sp, .7);
                    P.keysX = true;
                }
            } else P.rightSprinting = 0;
            if (key2('left')) {
                if (P.leftable) {
                    P.xScale = 1;
                    w.xSpeed += sneakOrUse() ? migAcc(.5, .7) : P.leftSprinting !== 0 ? migAcc(spr, .7) : migAcc(sp, .7);
                    P.keysX = true;
                }
            } else P.leftSprinting = 0;
            // saltar / trepar
            P.jumpTimer--;
            if (key2('up') || autoJumpNow(bx, by)) {
                let jb = 0;
                const climbLow = bd(fg(bx, by), 'climbable') == 1 && bd(fg(bx, by + 1), 'climbable') != 1 && bd(fg(bx, by + 2), 'climbable') != 1 && bd(fg(bx, by + 3), 'climbable') != 1;
                const climbHere = bd(fg(bx, by + 1), 'climbable') == 1 && bd(fg(bx, by + 2), 'walkThroughBlockHit') == 1;
                if (climbLow || climbHere) {
                    if (c) {
                        if (w.fly) { w.ySpeed = migSpeed(7); w.worldY -= .1167; }
                        else {
                            jb = bd(fg(bx, by + 1), 'liquidCollision') == 1 ? 4.4 : 3;
                            if (w.ySpeed < 10) w.ySpeed += migAcc(jb, .7);
                            if (!P.falling) w.worldY -= jb / 2 / 30;
                        }
                    }
                } else if (P.jumpTimer <= 0) {
                    P.jumpTimer = (fg(bx, by) === 'st' && fg(bx, by + 1) !== 'st') ? Math.floor(12 * FPS / 25) : Math.floor(6 * FPS / 25);
                    if (c) {
                        if (fg(bx, by).substr(0, 3) === 'bed' && !P.falling) jb = 17;
                        else if (fg(bx, by) === 'web' || fg(bx, by + 1) === 'web') jb = 2;
                        else if (!P.falling) jb = 15 + 3 * effLv('jumpboost');    // (poción de salto)
                    }
                    if (jb > 0 && jb > w.ySpeed) { w.ySpeed = migSpeed(jb); w.worldY -= jb / 2 / 30; }
                } else if (w.fly && c && !P.falling) { w.ySpeed = migSpeed(7); w.worldY -= .1167; }
            }
            if (w.gamemode == 1 && w.fly && key2('down')) w.ySpeed -= migAcc(30, .7);
        }
        // 🔊 pasos: cada cuadro que se camina suena el bloque de abajo (Game: distanceX > 1 -> blockSound)
        if (!w.fly && w.gamemode != 3 && !(w.dead > 0)) {
            P.distanceX += Math.abs(w.xSpeed) / 30;
            if (P.distanceX > 1) { P.distanceX = 0; if (!P.falling) blockSnd(fg(bx, by), 'step', bx, by, .6); }
        }
        P.wasFalling = P.falling;
        P.falling = false;
        P.rightable = P.leftable = true;
        if (sneakOrUse()) P.rightSprinting = P.leftSprinting = 0;
        if (P.leftSprinting > 0) P.leftSprinting++;
        if (P.rightSprinting > 0) P.rightSprinting++;
        if (P.leftSprinting >= 15 * FPS) P.leftSprinting = 0;
        if (P.rightSprinting >= 15 * FPS) P.rightSprinting = 0;
        if (w.food <= 300) P.leftSprinting = P.rightSprinting = 0;
    }

    // 🍗 ¿se puede comer? (Game.canEatFood: con hambre (≤ 900), o si cura y falta vida, o si tiene efectos)
    function canEat(id) {
        const f = bd(id, 'food'), w = W(); if (!f) return false;
        return w.food <= 900 || (f.health != null && w.health < 20) || f.effects != null;
    }
    // ✨ efectos en el Player (Game.addEffect / manageEffects): regeneración, hambre, veneno
    function addEffect(type, duration, level) {
        const w = W(); if (!w.effects || typeof w.effects !== 'object') w.effects = {};
        w.effects[type] = { duration: duration, level: level || 1, potency: 1 };
        // vida al instante (pociones de curación / daño): como Game.manageEffects "heartsexponential", perLevel 2 / −3
        if (type === 'instanthealth' || type === 'instantdamage') {
            const per = type === 'instanthealth' ? 2 : -3, amt = per * 2 * Math.pow(2, Math.min(15, Math.max(0, (level || 1) - 1)));
            const nv = Math.floor(Math.min(20, w.health + amt));
            if (nv < Math.min(20, w.health)) ouch(1, w.health - nv, 'potion'); else w.health = nv;
            delete w.effects[type]; hud.dirty = true;
        }
    }
    // nivel de un efecto que tengo puesto (0 = no lo tengo)
    function effLv(type) { const E = W().effects; const e = E && E[type]; return (e && e.duration > 0) ? (e.level || 1) : 0; }
    window.mbwPlay.effect = effLv;
    // 🧪 el dibujo de cada efecto (assets/UI)
    const EFFECT_ICONS = { speed: 1987, slowness: 1989, poison: 1991, regeneration: 1993, strength: 1995, weakness: 1997, fireresistance: 1999, waterbreathing: 2001, jumpboost: 2003, invisibility: 2005, nightvision: 2007 };
    const EFFECT_NAMES = { speed: 'Speed', slowness: 'Slowness', jumpboost: 'Jump Boost', fireresistance: 'Fire Resistance', waterbreathing: 'Water Breathing', nightvision: 'Night Vision', invisibility: 'Invisibility', strength: 'Strength', weakness: 'Weakness', poison: 'Poison', regeneration: 'Regeneration', hunger: 'Hunger' };
    // 🧪 tomar una poción (Game.useItem con "potion"): sus efectos y queda la botella vacía
    function potionOf(it) { const ex = it && it[3] && typeof it[3] === 'object' ? it[3] : {}; return { type: String(ex.type || 'empty'), splash: String(ex.category || '').toLowerCase() === 'splash', custom: Array.isArray(ex.effects) ? ex.effects : null }; }
    function potionEffects(po) {
        if (po.custom) return po.custom.map(function (e) { return [String(e.type), Number(e.duration) || 0, Number(e.level) || 1]; });
        const P = (D.potions || {})[po.type]; return P ? P.e : [];
    }
    function drinkable(it) { if (!it || it[0] !== 'potion') return false; const po = potionOf(it); return po.type !== 'empty'; }
    function applyPotion(po, who) {
        potionEffects(po).forEach(function (e) {
            if (who === PLAYER_ID) addEffect(e[0], e[1], e[2]);
            else {                                                     // a un mob: curación / daño al instante y veneno
                const m = mbwom.mobs[who]; if (!m) return;
                const und = m.type === 'zombie' || m.type === 'skeleton' || m.type === 'zombiepigman';
                if (e[0] === 'instanthealth' || e[0] === 'instantdamage') {
                    const per = (e[0] === 'instanthealth' ? 2 : -3) * (und ? -1 : 1), amt = per * 2 * Math.pow(2, Math.max(0, e[2] - 1));
                    if (amt < 0) hurtMob(who, -amt, 'potion', PLAYER_ID); else m.health = Math.min(maxHealth(m), (Number(m.health) || 0) + amt);
                } else if (e[0] === 'poison' && !und) hurtMob(who, Math.min(Math.max(0, (Number(m.health) || 0) - 1), 2 * e[2]), 'potion', PLAYER_ID);
            }
        });
    }
    // 💥 poción arrojadiza: se rompe un poco adelante y le pega a todo lo que está cerca (también a ti si estás cerca)
    function splashPotion(it) {
        const w = W(), po = potionOf(it), mw = mouseWorld();
        const dx = mw.x - w.worldX, dy = mw.y - (-w.worldY + 1.5), d = Math.max(.01, Math.hypot(dx, dy)), r = Math.min(4, d);
        const px = w.worldX + dx / d * r, py = -w.worldY + 1.5 + dy / d * r;
        if (Math.hypot(px - w.worldX, py - (-w.worldY + 1)) < 2.5) applyPotion(po, PLAYER_ID);
        for (const id in mbwom.mobs) { const m = mbwom.mobs[id]; if (m && Math.hypot(m.x - px, -m.y + .5 - py) < 2.5) applyPotion(po, id); }
        const P = (D.potions || {})[po.type], c = P && P.c ? 'rgb(' + P.c.map(function (v) { return Math.round(Math.min(1, v) * 255); }).join(',') + ')' : '#7fb2ff';
        for (let i = 0; i < 18; i++) addPart({ x: px + (Math.random() - .5) * .4, y: py, vx: (Math.random() - .5) * .14, vy: Math.random() * .12, g: .008, life: 30, size: .1, col: c });
        snd('glass' + ((Math.random() * 3 | 0) + 1));
        if (w.gamemode != 1) reduceSelected(1);
        hud.dirty = true;
    }
    function tickEffects() {
        const w = W(), E = w.effects; if (!E || typeof E !== 'object') return;
        Object.keys(E).forEach(function (k) {
            const e = E[k]; if (!e || typeof e !== 'object') { delete E[k]; return; }
            if (S.tick % FPS === 0) { if (!(e.duration > 0)) { delete E[k]; return; } e.duration--; }
            const lv = e.level || 1;
            if (k === 'hunger') { if (w.food > 20 && S.tick % FPS === 0) w.food -= Math.floor(6.25 * lv); }
            else if (k === 'poison') { if (S.tick % Math.max(1, Math.floor(2 * FPS / Math.pow(2, lv))) === 0 && w.health > 1) ouch(1, 1, 'poison'); }
            else if (k === 'regeneration') { if (S.tick % Math.max(1, Math.floor(2.5 * FPS / Math.pow(2, lv))) === 0) { if (w.health < 20) w.health += 1; if (w.food < 1000) w.food += 50; hud.dirty = true; } }
        });
    }

    // hambre, curarse, vacío (Game.onCertainInterval)
    function intervals() {
        const w = W(), P = S.p, t = S.tick;
        if (!(w.dead > 0)) tickEffects();
        if (t % (300 * FPS / 25 | 0) === 0) { if (w.food / 100 < 1 && w.health > 5 && w.difficulty !== 'peaceful') ouch(1, 1, 'hunger'); }
        if (t % (156 * FPS / 25 | 0) === (45 * FPS / 25 | 0)) { w.food -= 3; if (w.food / 100 >= 6 && w.food / 100 <= 9) w.health += 1; hud.dirty = true; }
        if (t % (63 * FPS / 25 | 0) === (33 * FPS / 25 | 0)) { if (w.food / 100 > 9 || w.difficulty === 'peaceful') { w.health += 1; hud.dirty = true; } }
        if (t % (27 * FPS / 25 | 0) === (FPS / 25 | 0)) {
            if (P.blockY < -5) ouch(1, 4, 'void');
            if (w.gamemode == 1 && P.blockY < -40 && !(w.dead > 0)) w.dead = 1;
            if (P.keysX) w.food -= 3;
            if (P.leftSprinting > 0 || P.rightSprinting > 0) w.food -= 5;
            tickFurnaces();
            tickBrewing();
        }
        if (w.food < 0) w.food = 0;
        if (w.health > 20 || w.gamemode == 1) w.health = 20;
        if (w.food > 1000 || w.gamemode == 1) w.food = 1000;
        w.health = Math.floor(w.health); w.food = Math.floor(w.food);
    }
    // 🔥 Hornos (Game.onCertainInterval → world.toSmelt): cada ~1 segundo. Si hay algo para fundir y combustible, el combustible se
    // gasta (carbón = 80 vueltas, madera = 15...), y cada 10 vueltas con fuego sale 1 objeto (≈ 10 s). La cubeta de lava deja la
    // cubeta vacía. Si la salida está llena (64) o es otra cosa, se detiene. Meter TNT al horno... explota.
    function tickFurnaces() {
        if (mpGuest()) return;
        const T = mbwom.toSmelt;
        if (!T || typeof T !== 'object') return;
        const nil = () => ['air', 0, 0, {}];
        const emptyIt = (v) => !Array.isArray(v) || !v[0] || v[0] === 'air' || v[0] === 'na' || !(Number(v[1]) >= 1);
        let changed = false;
        Object.keys(T).forEach(function (k) {
            const l = T[k];
            if (!l || typeof l !== 'object') { delete T[k]; return; }
            const m = /^blockX(-?\d+)Y(-?\d+)$/.exec(k); if (!m) return;
            const bx = +m[1], by = +m[2];
            if (fg(bx, by) !== 'oven') return;
            ['input', 'fuel', 'output'].forEach(function (q) { if (!Array.isArray(l[q])) l[q] = nil(); else if (l[q][1] === '') l[q][1] = 1; });
            if (l.fuelTimer == null) l.fuelTimer = 0;
            if (l.smeltTimer == null) l.smeltTimer = 0;
            const before = JSON.stringify(l);
            const inId = String(l.input[0]);
            if (l.fuelTimer == 0 && !emptyIt(l.fuel) && !emptyIt(l.input)) {
                const fv = bd(String(l.fuel[0]), 'fuel');
                if (fv) {
                    l.fuelTimerTotal = fv; l.fuelTimer = fv;
                    if (l.fuel[1] == 1) { if (l.fuel[0] === 'lbk') l.fuel = ['bk', 1, 0, {}]; else l.fuel = nil(); }
                    else l.fuel[1]--;
                }
            }
            if (l.fuelTimer > 0) {
                l.fuelTimer--;
                const into = bd(inId, 'smeltsInto');
                const out = l.output;
                const same = () => Array.isArray(into) ? (out[0] === into[0] && out[3] && out[3].type === into[1]) : out[0] === into;
                if (into != null && !emptyIt(l.input) && Number(out[1]) != 64 && (emptyIt(out) || same())) {
                    l.smeltTimer += 1;
                    if (l.smeltTimer >= 10) {
                        l.smeltTimer = 0;
                        l.input[1]--;
                        if (inId === 'TNT') { if (l.input[1] <= 0) l.input = nil(); explode(bx, by, 5, PLAYER_ID); changed = true; return; }
                        if (emptyIt(out)) l.output = Array.isArray(into) ? [into[0], 0, 0, { type: into[1] }] : [into, 0, 0, {}];
                        l.output[1] = (Number(l.output[1]) || 0) + 1;
                        if (l.output[0] === 'ii' && nearMe(bx + .5, -by, 10)) ach(8);
                        if (l.input[1] <= 0) l.input = nil();
                    }
                }
            } else l.smeltTimer = 0;
            if (emptyIt(l.input)) l.input = nil();
            if (emptyIt(l.fuel)) l.fuel = nil();
            if (emptyIt(l.output)) l.output = nil();
            if (JSON.stringify(l) !== before) { changed = true; netMark(bx, by); }
        });
        if (changed && typeof window.playerInvFurnaceTick === 'function') window.playerInvFurnaceTick();
    }
    function deathCheck() {
        const w = W();
        if (!(w.health <= 0 || (w.dead | 0) !== 0)) { if (deathUi.el && deathUi.el.style.display === 'flex') deathUi.hide(); return; }   // (revivió por otro lado: /heal, el anfitrión...)
        w.dead = (w.dead | 0) + 1;
        if (w.dead === 1) {
            S.deathPos = { x: Number(w.worldX), y: Number(w.worldY), s: mbwom.currentScene || 1, v: (S.lastHurt && S.lastHurt.c) === 'void' };   // ↩ para /back
            const by = (S.mp && S.lastPvp && Date.now() - S.lastPvp.t < 5000) ? S.lastPvp.name : '';
            if (S.mp) mpSend({ tipo: 'juego_muerte', autor: myNameNet(), por: by });
            flashMsg(by ? tr('mpplay_killed_by', '💀 {name} defeated you').replace('{name}', by) : tr('play_dead', '💀 You died'));
            S.dropped = false; S.respawnReq = false;
            deathUi.show(by ? tr('mpplay_killed_by', '💀 {name} defeated you').replace('{name}', by).replace('💀 ', '') : deathText(), Math.floor(Number(w.experience) || 0));
            for (let i = 0; i < 18; i++) addPart({ x: w.worldX + (Math.random() - .5) * .8, y: -w.worldY + Math.random() * 1.8, vx: (Math.random() - .5) * .06, vy: Math.random() * .05, life: 30, size: .12, col: Math.random() < .5 ? '#d8d8d8' : '#9a9a9a' });   // 💨
        }
        if (w.dead === 30 && !S.dropped) { S.dropped = true; dropAll(); }
        if (w.dead <= 30 || !S.respawnReq) return;                       // ☠ pantalla de muerte: espera a "Respawn"
        if (!S.dropped) { S.dropped = true; dropAll(); }
        S.respawnReq = false; deathUi.hide();
        w.xSpeed = 0; w.ySpeed = 0; w.health = 20; w.food = 1000; w.dead = 0;
        if ((mbwom.currentScene || 1) !== 1 && dimReady(1)) { stopSpect(true); changeDim(1, 'respawn'); }    // (como el juego: se revive en el Overworld)
        const sp = spawnPoint();
        w.worldX = sp.x; w.worldY = sp.y;
        S.p = newPlayer();
        hud.dirty = true;
        camSnap();
        if (S.deathPos) say('[INFO] 💡 ' + tr('play_back_tip', 'Type /back to go back to where you died.'));
    }
    function dropAll() {
        const w = W();
        if (gameRule('keepinventory') != true) {                      // suelta todo (como el juego)
            const list = inv();
            for (let i = 0; i < 45; i++) if (!isEmpty(list[i])) { addDrop(list[i][0], w.worldX, w.worldY, list[i][1], list[i][2], list[i][3]); list[i] = empty(); }
            for (let i = 0; i < 4; i++) { const ar = w.armors[i]; if (ar && ar[0] && ar[0] !== 'air') addDrop(ar[0], w.worldX, w.worldY, 1, ar[1], ar[2]); w.armors[i] = ['air', 0, {}]; }
            dropXP(w.worldX, w.worldY - .5, Math.floor(.5 * (Number(w.experience) || 0)), 0, true);   // la mitad de la experiencia
            w.experience = 0;
        }
    }
    // ☠ por qué morí (lo último que me dolió)
    function deathText() {
        const h = S.lastHurt || {}, c = h.c || '', mob = h.mob ? (D.mobs[h.mob] && D.mobs[h.mob].name) || h.mob : '';
        const T = {
            attack: mob ? tr('death_slain_by', 'You were slain by {mob}') : tr('death_slain', 'You were slain'),
            arrow: mob ? tr('death_shot_by', 'You were shot by {mob}') : tr('death_shot', 'You were shot'),
            fall: tr('death_fall', 'You fell from a high place'), lava: tr('death_lava', 'You tried to swim in lava'), acid: tr('death_acid', 'You fell into acid'),
            fire: tr('death_fire', 'You went up in flames'), burning: tr('death_fire', 'You went up in flames'), water: tr('death_drown', 'You drowned'),
            explosion: tr('death_boom', 'You blew up'), hunger: tr('death_starve', 'You starved to death'), cactus: tr('death_cactus', 'You were pricked to death'),
            suffocate: tr('death_suffocate', 'You suffocated in a wall'), void: tr('death_void', 'You fell out of the world'), poison: tr('death_poison', 'You were poisoned'),
            lightning: tr('death_lightning', 'You were struck by lightning'), anvil: tr('death_anvil', 'You were squashed by a falling anvil')
        };
        return (T[c] || tr('death_generic', 'You died')).replace('{mob}', mob);
    }
    const deathUi = {
        el: null,
        show: function (why, score) {
            if (!document.getElementById('mbw-play-hud')) return;
            if (!this.el) {
                const el = this.el = document.createElement('div');
                el.className = 'ph-death';
                el.innerHTML = '<div class="ph-death-in"><h2></h2><div class="ph-death-why"></div><div class="ph-death-score"></div><div class="ph-death-back"></div><button type="button" class="ph-death-re"></button><button type="button" class="ph-death-quit"></button></div>';
                el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
                el.querySelector('.ph-death-re').addEventListener('click', function (e) { e.stopPropagation(); S.respawnReq = true; this.disabled = true; });
                el.querySelector('.ph-death-quit').addEventListener('click', function (e) { e.stopPropagation(); if (window.mbwPlayMenu && window.mbwPlayMenu.open) window.mbwPlayMenu.open(); });
                document.getElementById('mbw-play-hud').appendChild(el);
            }
            const el = this.el;
            el.querySelector('h2').textContent = tr('death_title', 'You died!');
            el.querySelector('.ph-death-why').textContent = why || '';
            el.querySelector('.ph-death-score').innerHTML = '';
            const sc = document.createElement('span'); sc.textContent = tr('death_score', 'Score') + ': '; const b = document.createElement('b'); b.textContent = String(score || 0);
            el.querySelector('.ph-death-score').appendChild(sc); el.querySelector('.ph-death-score').appendChild(b);
            const re = el.querySelector('.ph-death-re'); re.textContent = tr('death_respawn', 'Respawn'); re.disabled = true;
            el.querySelector('.ph-death-quit').textContent = tr('death_menu', 'Menu');
            el.querySelector('.ph-death-back').textContent = '💡 ' + tr('death_back_tip', 'After you respawn, type /back to come back here.');
            setTimeout(function () { re.disabled = false; }, 900);           // (un ratito, para no darle sin querer)
            el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
            el.style.display = 'flex';
        },
        hide: function () { if (this.el) { this.el.style.display = 'none'; this.el.classList.remove('show'); } }
    };
    window.mbwPlay.respawn = function () { S.respawnReq = true; };
    function spawnPoint() {
        return spGet() || ((S.scene || 1) === (mbwom.currentScene || 1) ? { x: S.start.x, y: S.start.y } : safeSpot(dimWidth() / 2, -120));
    }
    // 🏠 el spawn / /home del mundo. En el archivo del juego va como [x, y] (World.js saveItem("spawnPoint" + escena, [x, y]))
    function spGet() {
        const s = mbwom.spawnPoint;
        if (Array.isArray(s) && s.length >= 2 && isFinite(Number(s[0])) && isFinite(Number(s[1]))) return { x: Number(s[0]), y: Number(s[1]) };
        if (s && typeof s === 'object' && isFinite(Number(s.x)) && isFinite(Number(s.y))) return { x: Number(s.x), y: Number(s.y) };
        return null;
    }
    function spSet(x, y) {
        mbwom.spawnPoint = [Number(x), Number(y)];
        mbwom.world['spawnPoint' + (mbwom.currentScene || S.scene || 1)] = mbwom.spawnPoint;
    }
    window.mbwPlay.spawnGet = spGet;

    // ------------------------------------------------------------------ mobs (Entity_Mob.run)
    function mobBounds(id) {
        if (id === PLAYER_ID) { const w = W(); return { l: w.worldX - .4, r: w.worldX + .4, t: w.worldY - 1.9, b: w.worldY }; }
        if (isRemoteId(id)) return plBounds(id);
        const m = mbwom.mobs[id]; if (!m) return null;
        const a = D.mobs[m.type]; const cb = (a && a.collisionBounds) || { x: -.4, y: -1.8, w: .8, h: 1.8 };
        let k = (m.babyTimer > 0) ? .7 : 1;
        if ((m.type === 'slime' || m.type === 'magmacube') && m.size > 0) k *= m.size / 2 + .5;
        return { l: m.x + cb.x * k, r: m.x + (cb.x + cb.w) * k, t: m.y + cb.y * k, b: m.y + (cb.y + cb.h) * k };
    }
    function cbounds(m) {
        const a = D.mobs[m.type]; const cb = (a && a.collisionBounds) || { x: -.4, y: -1.8, w: .8, h: 1.8 };
        let k = (m.babyTimer > 0) ? .7 : 1;
        if ((m.type === 'slime' || m.type === 'magmacube') && m.size > 0) k *= m.size / 2 + .5;
        return { left: cb.x * k, right: (cb.x + cb.w) * k, top: cb.y * k, bottom: (cb.y + cb.h) * k, width: cb.w * k, height: cb.h * k };
    }
    const intersects = (A, B) => !(B.r <= A.l || B.l >= A.r || B.t >= A.b || B.b <= A.t);
    function tmpOf(id) {
        let d = S.tmp.get(id);
        if (!d) { d = { keys: { left: false, right: false, up: false }, leftable: true, rightable: true, wasFallingAndNotFalling: 0, following: false, isFrightened: false, followPoint: { x: 0, y: 0 }, followMin: .5, followMax: 12, hurt: 0 }; S.tmp.set(id, d); }
        return d;
    }
    function alignment(m) { if (m.aggro != null) return m.aggro; const a = D.mobs[m.type] || {}; return a.hostile ? 'hostile' : a.neutral ? 'neutral' : 'passive'; }
    // (Entity_Mob.mobIsAggro) hostil, enojado, el pollo cuando se quema, o el lobo / gólem de nieve persiguiendo a su presa
    function isAggro(m) {
        const a = D.mobs[m.type] || {};
        if (alignment(m) === 'hostile' || m.aggressiveness > 0) return true;
        if (a.hostileOnFire == 1 && m.__id && tmpOf(m.__id).onFire > 0) return true;
        const t = m.target != null && !isPl(m.target) ? mbwom.mobs[m.target] : null;
        return !!(a.randomlyHostileTowards && t && a.randomlyHostileTowards[t.type]);
    }
    // (Entity_Mob.mobCalculateTarget) a quién persigue / mira cada mob:
    //  • los hostiles persiguen al Player (si no está en creativo / espectador); los neutrales solo si les pegan (y su grupo con ellos)
    //  • los pacíficos que se asustan (cerdo, vaca, oveja, pollo, conejo) corren sin rumbo un rato después de que les pegan
    //  • el lobo a veces caza ovejas y pollos; el gólem de nieve ataca a los monstruos que tiene cerca
    //  • los animales siguen al Player si tiene en la mano su comida (trigo, zanahoria, semillas...)
    //  • el lobo domesticado sigue a su dueño y se teletransporta a su lado si se queda lejos (si no está sentado)
    function calcTarget(id, m, a, d) {
        const w = W();
        m.__id = id;
        if (alignment(m) === 'passive' && !isAggro(m) && (a.doFrightenedRunning != 1 || Math.random() < 1 / (30 * FPS))) { m.target = null; m.focus = null; }
        if (m.target === PLAYER_ID) { if (w.dead > 0) { m.target = null; m.aggressiveness = 0; } }
        else if (isRemoteId(m.target)) { if (!remoteOf(m.target)) { m.target = null; m.aggressiveness = 0; if (m.focus === m.target) m.focus = null; } }
        else if (m.target != null && (!mbwom.mobs[m.target] || mbwom.mobs[m.target].dead > 0)) { m.target = null; m.aggressiveness = 0; }
        if (m.tamed && isPl(m.target)) { m.target = null; m.aggressiveness = 0; }
        if (isRemoteId(m.focus) && !remoteOf(m.focus)) m.focus = null;
        if (w.gamemode == 3) { if (m.target === PLAYER_ID) { m.target = null; m.aggressiveness = 0; } if (m.focus === PLAYER_ID) m.focus = null; }
        if (a.randomlyHostileTowards && !(a.tameable && m.tamed)) {
            if (m.target == null) {
                if (Math.random() < (a.randomlyHostileChance || 0)) {
                    let best = '', bd2 = 1e3;
                    for (const k in mbwom.mobs) { const o = mbwom.mobs[k]; if (!o || k === id || !a.randomlyHostileTowards[o.type] || o.dead > 0) continue; const dd = Math.pow(o.x - m.x, 2) + Math.pow(o.y - m.y, 2); if (dd < bd2) { bd2 = dd; best = k; } }
                    if (best && bd2 < 64) m.target = best;
                }
            } else if (m.target !== PLAYER_ID && Math.random() < (a.randomlyForgetHostility || 0) && mbwom.mobs[m.target] && a.randomlyHostileTowards[mbwom.mobs[m.target].type]) m.target = null;
        }
        d.isFrightened = a.doFrightenedRunning == 1 && m.target != null;
        d.followMin = .5; d.followMax = 12; d.following = false; d.teleportWhenAway = 0;
        let near = true, busy = false;
        if (isAggro(m)) {
            if (m.target == null) {
                if (!mpHost()) { if (w.gamemode != 1 && w.gamemode != 3) m.focus = m.target = PLAYER_ID; }
                else { const np = nearestPl(m); if (np) m.focus = m.target = np; }             // 🎮 el jugador más cercano
            } else {
                // 🎮 si persigue a un jugador y otro le queda mucho más cerca, a veces se cambia (si no está enojado con el primero)
                if (mpHost() && isPl(m.target) && !(m.aggressiveness > 0) && Math.random() < 1 / FPS) {
                    const np = nearestPl(m), a1 = plPos(m.target), a2 = np && plPos(np);
                    if (np && np !== m.target && a1 && a2 && Math.hypot(a2.x - m.x, a2.y - m.y) + 3 < Math.hypot(a1.x - m.x, a1.y - m.y)) m.target = np;
                }
                m.focus = m.target;
            }
        } else {
            if ((m.breedTimer > 0 || m.babyTimer > 0) && breedFocus(id, m)) busy = true;             // 🐣 busca pareja / sigue a sus papás
            else if (a.followItems && a.followItems[selType()] && w.gamemode != 3 && Math.pow(w.worldX - m.x, 2) + Math.pow(w.worldY - m.y, 2) < 49) { m.focus = PLAYER_ID; busy = true; }
            else if (a.followItems && mpHost()) {                         // 🎮 también siguen a otro jugador con su comida en la mano
                const R = window.mbwMpPlay.remotes;
                for (const k in R) { const r = remoteOf(RP + k); if (r && r.it && a.followItems[r.it] && Math.pow(r.tx - m.x, 2) + Math.pow(r.ty - m.y, 2) < 49) { m.focus = RP + k; busy = true; break; } }
            }
        }
        if (!busy) {
            if (a.tameable == 1 && m.tamed) { if (m.target == null) { m.focus = PLAYER_ID; near = false; d.followMin = 4; d.followMax = 20; if (!m.sitting) d.teleportWhenAway = 20; } }
            else if (alignment(m) !== 'hostile' && !(m.aggressiveness > 0) && !isAggro(m)) m.focus = null;
        }
        if (isPl(m.focus)) {
            const fp = plPos(m.focus);
            if (fp) { d.followPoint.x = fp.x; d.followPoint.y = fp.y - .95; d.following = true; }
        } else if (m.focus != null && mbwom.mobs[m.focus]) {
            const ob = mobBounds(m.focus);
            d.followPoint.x = (ob.l + ob.r) / 2; d.followPoint.y = (ob.t + ob.b) / 2; d.following = true;
        }
        if (d.teleportWhenAway > 0 && m.focus === PLAYER_ID && Math.hypot(w.worldX - m.x, w.worldY - m.y) > d.teleportWhenAway) { m.x = w.worldX; m.y = w.worldY; m.speedX = 0; m.speedY = 0; }
    }
    // El enderman se teletransporta a veces solo, y cuando le pegan (1 de cada 3): a un lugar libre cerca (aproximado)
    function teleportMob(m) {
        for (let n = 0; n < 24; n++) {
            const x = Math.floor(m.x + (Math.random() * 32 - 16)), y0 = Math.floor(-m.y) + Math.floor(Math.random() * 16 - 8);
            for (let y = y0; y > y0 - 8 && y > 0; y--) {
                if (bd(fg(x, y - 1), 'walkThroughBlock') != 1 && bd(fg(x, y - 1), 'liquid') == null && fg(x, y) === 'air' && fg(x, y + 1) === 'air' && fg(x, y + 2) === 'air') { sndAt('tp1', m.x, m.y); m.x = x + .5; m.y = -y; m.speedX = m.speedY = 0; sndAt('tp2', m.x, m.y); return true; }
            }
        }
        return false;
    }
    function maxHealth(m) { const a = D.mobs[m.type] || {}; if ((m.type === 'slime' || m.type === 'magmacube') && m.size > 0) return Math.pow(2, m.size) * (a.health || 4) / 2; return a.health || 10; }
    // ✨ partículas: un mob lastimado (unas chispitas rojas) y comiendo (migajas del color de la comida)
    function hurtParts(id, m, amount) {
        if (OPTS.particles === 'none') return;
        const b = mobBounds(id); if (!b) return;
        const n = Math.min(10, 3 + Math.ceil(amount));
        for (let i = 0; i < n; i++) addPart({ x: b.l + Math.random() * (b.r - b.l), y: -(b.t + Math.random() * (b.b - b.t)), vx: (Math.random() - .5) * .07, vy: Math.random() * .06, g: .006, life: 16, size: .08, col: Math.random() < .6 ? '#c81e1e' : '#ff5a5a' });
    }
    const crumbCol = {};
    function eatParts(id) {
        if (OPTS.particles === 'none') return;
        let cols = crumbCol[id];
        if (!cols) {
            cols = ['#b5793b', '#8a5a2b'];
            try {                                                       // (los colores de su dibujo)
                const im = iconFor(id, {}), cv = document.createElement('canvas'); cv.width = cv.height = 8;
                const c = cv.getContext('2d'); c.drawImage(im, 0, 0, 8, 8); const d = c.getImageData(0, 0, 8, 8).data, L = [];
                for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) L.push('rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')');
                if (L.length > 3) cols = L;
            } catch (e) { /* nada */ }
            crumbCol[id] = cols;
        }
        const w = W(), dir = S.p && S.p.xScale < 0 ? -1 : 1;
        for (let i = 0; i < 3; i++) addPart({ x: w.worldX + dir * .35 + (Math.random() - .5) * .2, y: -w.worldY + 1.45, vx: dir * Math.random() * .04, vy: Math.random() * .05, g: .006, life: 18, size: .07, col: cols[Math.random() * cols.length | 0] });
    }
    function hurtMob(id, amount, cause, by) {
        const m = mbwom.mobs[id]; if (!m || m.dead > 0) return;
        if (by === PLAYER_ID && cause === 'attack') amount = Math.max(.5, amount + 3 * effLv('strength') - 4 * effLv('weakness'));   // (pociones de fuerza / debilidad)
        const a = D.mobs[m.type] || {};
        if (!isFinite(Number(m.health))) m.health = maxHealth(m);
        if (m.type === 'cow' && m.variant === 'cowctus' && cause === 'cactus') return;
        m.health = Math.round(m.health - amount);
        if (amount > 0) { mobSnd(m, 'hurt'); hurtParts(id, m, amount); }
        if (by) m.lastDamageID = by;
        if (cause === 'lava' || cause === 'fire') tmpOf(id).onFire = 8 * FPS;     // (si muere quemándose suelta la carne cocida)
        if ((cause === 'attack' || cause === 'projectile') && by && by !== id) {
            m.target = by;
            if (a.groupAttack && isPl(by)) {
                for (const k in mbwom.mobs) { const o = mbwom.mobs[k]; if (o && o.type === m.type && !o.tamed && Math.abs(o.x - m.x) < 15 && Math.abs(o.y - m.y) < 9) { o.target = by; if (alignment(o) !== 'passive') o.aggressiveness = Math.random() * FPS * 50 + 100 * FPS; } }
            }
            if (alignment(m) !== 'passive') m.aggressiveness = Math.random() * FPS * 50 + 100 * FPS;
        }
        const d = tmpOf(id); d.hurt = 10;
        if (a.teleports && m.health > 0 && Math.random() < (a.teleportOnDamageChance || 0)) teleportMob(m);
        if (Math.random() < 1 / 3) d.keys.up = true;
    }
    // Lo que suelta un mob al morir (Entity_Mob.killMob, tal cual): sus drops (con "botín" del encantamiento Looting, si murió
    // quemándose suelta la carne cocida, la oveja suelta lana de su color si no estaba trasquilada, los bebés no sueltan...),
    // lo que traía en las manos / su armadura / la silla, y experiencia si lo mató el Player (o su lobo).
    const KILL_ACH = { pig: 12, cow: 13, sheep: 14, zombie: 15, skeleton: 16, spider: 17, nethereye: 18, blaze: 19, enderman: 20, creeper: 21, enderdragon: 36, slime: 37, magmacube: 38, zombiepigman: 41 };
    function killMob(id, m) {
        const a = D.mobs[m.type] || {};
        const d = tmpOf(id);
        m.dead = 1;
        // 🏆 logro de matar (al que lo mató; si fue otro jugador, se le manda a él)
        let ka = KILL_ACH[m.type];
        if (m.type === 'cow' && m.variant) ka = 13;
        if (m.type === 'chicken' && d.onFire > 0) ka = 22;
        if (ka != null) { if (m.lastDamageID === PLAYER_ID) ach(ka); else if (mpHost() && isRemoteId(m.lastDamageID)) mpSend({ tipo: 'juego_logro_dar', a: m.lastDamageID.slice(RP.length), i: ka }); }
        // 🎮 si lo mató otro jugador, la experiencia le sale a ÉL, en su pantalla (lo que suelta cae al suelo y lo ven todos)
        const lootTo = (mpHost() && isRemoteId(m.lastDamageID)) ? m.lastDamageID.slice(RP.length) : null;
        if (lootTo) S.lootTo = [];
        try { killMobLoot(id, m, a, d, !!lootTo); } finally {
            if (lootTo) { const l = S.lootTo; S.lootTo = null; if (l.length) mpSend({ tipo: 'juego_botin', a: lootTo, l: l }); }
        }
    }
    function killMobLoot(id, m, a, d, remoteKill) {
        mobSnd(m, 'death');
        if (m.type === 'enderdragon' && SFX()) SFX().music('enderdragondeath');
        if (gameRuleOn('domobloot')) {
            const ex = selExtra();
            const loot = ex.looting3 != null ? 1 : ex.looting2 != null ? 2 / 3 : ex.looting1 != null ? 1 / 3 : 0;
            let list = [];
            if (m.defaultDrops !== false && m.defaultDrops !== 0) list = list.concat(a.drops || []);
            if (Array.isArray(m.drops)) list = list.concat(m.drops);
            const rnd = { 0: Math.random() };
            const onFire = d.onFire > 0;
            const cmp = { '==': (x, y) => x == y, '!=': (x, y) => x != y, '>=': (x, y) => parseFloat(x) >= y, '>': (x, y) => parseFloat(x) > y, '<=': (x, y) => parseFloat(x) <= y, '<': (x, y) => parseFloat(x) < y };
            for (let k = list.length - 1; k >= 0; k--) {
                const n = list[k];
                if (!n || !n.type) continue;
                if (n.onFire === true && !onFire) continue;
                if (n.onFire === false && onFire) continue;
                if (n.properties && typeof n.properties === 'object') {
                    let bad = false;
                    for (const q in n.properties) { const pr = n.properties[q]; if (Array.isArray(pr) && cmp[pr[0]] && !cmp[pr[0]](m[q] === undefined ? (pr[1] === false ? false : m[q]) : m[q], pr[1])) { bad = true; break; } }
                    if (bad) continue;
                }
                if ((n.isBaby == true) !== (m.babyTimer > 0)) continue;
                if (n.isVariant != null && (m.variant != n.isVariant || (('' === m.variant || m.variant == null) && n.isVariant === 'normal'))) continue;
                if (n.isDimension != null && (mbwom.currentScene || 1) != n.isDimension) continue;
                if (n.isSheared != null && !!m.sheared !== !!n.isSheared) continue;
                if (n.rare) {
                    const rn = n.rare.randomNum || 0; if (rnd[rn] == null) rnd[rn] = Math.random();
                    const v = rnd[rn] * (1 - (n.rare.lootingBonusChances || 0) * loot);
                    if (v < n.rare.lowerBound || v >= n.rare.upperBound) continue;
                }
                let q = n.quantity | 0;
                if (n.randomBonus != null) q += Math.random() * (n.randomBonus + 1) | 0;
                if (n.lootBonus != null) q += (.6 * Math.random() + .4) * loot * (n.lootBonus + 1) | 0;
                const xe = n.extras ? JSON.parse(JSON.stringify(n.extras)) : {};
                if (n.setColor && m.color != null) xe.type = m.color;
                if (q > 0) addDrop(n.type, m.x, m.y - .5, q, n.damage || 0, xe);
            }
            const it = (v) => Array.isArray(v) && v[0] && v[0] !== 'air' && Number(v[1]) > 0;
            const hand = Array.isArray(m.handItems) ? m.handItems : [], hch = Array.isArray(m.handDropChances) ? m.handDropChances : [];
            for (let i = 0; i < 2; i++) if (it(hand[i]) && Math.random() < (Number(hch[i]) || 0) + .01 * loot) addDrop(hand[i][0] === 'wd1' ? 'wd' : hand[i][0], m.x, m.y - .5, hand[i][1], hand[i][2], hand[i][3]);
            const arm = Array.isArray(m.armor) ? m.armor : [], ach = Array.isArray(m.armorDropChances) ? m.armorDropChances : [];
            for (let i = 0; i < 4; i++) if (it(arm[i]) && Math.random() < (Number(ach[i]) || 0) + .01 * loot) addDrop(arm[i][0], m.x, m.y - .5, arm[i][1], arm[i][2], arm[i][3]);
            if (it(m.saddleItem)) addDrop(m.saddleItem[0], m.x, m.y - .5, m.saddleItem[1], m.saddleItem[2], m.saddleItem[3]);
        }
        const byPlayer = m.lastDamageID === PLAYER_ID || remoteKill || (m.lastDamageID && mbwom.mobs[m.lastDamageID] && mbwom.mobs[m.lastDamageID].type === 'wolf' && mbwom.mobs[m.lastDamageID].tamed);
        if (byPlayer) dropXP(m.x, m.y - .5, a.xp || 0);
        if ((m.type === 'slime' || m.type === 'magmacube') && m.size > 1) {   // los slimes grandes se parten en chicos (y sueltan experiencia)
            dropXP(m.x, m.y - .5, Math.pow(2, m.size - 1) | 0);
            const keep = S.lootTo; S.lootTo = null;             // (los slimes chicos sí salen en el mundo de todos)
            for (let i = 0; i < 2; i++) spawnMob(m.type, m.x + (i ? .3 : -.3), m.y, { size: m.size - 1 });
            S.lootTo = keep;
        }
    }

    // ------------------------------------------------------------------ ✨ experiencia (Game.dropXP / world.experience)
    // 100 de experiencia = 1 nivel. Las bolitas caen, se juntan hacia el Player cuando está cerca y al tocarlo se suman.
    // Al morir se suelta la mitad (en una bolita) y se pierde el resto (si la regla keepInventory está apagada).
    // (Cómo se mueven las bolitas no viene en el código decompilado: es aproximado.)
    function dropXP(x, y, v, extra, one) {
        v = Math.max(0, v + Math.random() * (extra || 0));
        if (!v) return;
        if (S.lootTo) { S.lootTo.push(['x', x, y, v]); return; }
        const n = one ? 1 : Math.max(1, Math.log(v) / Math.log(2.5)) | 0;
        const each = Math.floor(v / n);
        for (let i = 0; i < n; i++) {
            const val = i === n - 1 ? v : each; v -= each;
            S.orbs.push({ x: x, y: y, vx: migSpeed(6 * Math.random() - 3), vy: migSpeed(6 * Math.random() - 3), v: val, age: 0 });
        }
    }
    function tickOrbs() {
        const w = W();
        for (let i = S.orbs.length - 1; i >= 0; i--) {
            const o = S.orbs[i];
            if (simFar(o.x)) continue;
            o.age++;
            const dx = w.worldX - o.x, dy = (w.worldY - .9) - o.y, dist = Math.hypot(dx, dy);
            const alive = !(w.dead > 0) && w.gamemode != 3;
            if (alive && o.age > 15 && dist < 6) { const f = (1 - dist / 6) * .9 + .2; o.vx += dx / dist * f; o.vy += dy / dist * f; o.vx *= .88; o.vy *= .88; }
            else { o.vy = Math.min(migSpeed(14), o.vy + .4); o.vx *= .9; }
            const nx = o.x + o.vx / 30, ny = o.y + o.vy / 30;
            if (dist < 6 && alive) { o.x = nx; o.y = ny; }
            else {
                if (!collision(nx - .1, o.y - .2, .2, 0, .1, true, true)) o.x = nx; else o.vx = 0;
                if (collision(o.x - .1, ny, .2, 0, .1, true, true)) o.vy = 0; else o.y = ny;
            }
            if (o.age > 300 * FPS || o.y > 10) { S.orbs.splice(i, 1); continue; }
            if (alive && o.age > 15 && dist < .9) {
                const xp0 = Number(w.experience) || 0;
                w.experience = Math.max(0, Math.min(1e6, Math.floor(xp0 + o.v)));
                // 🔊 Entity_XP: "levelup" cada 500 de experiencia; si no, uno de los 5 "orb"
                sndAt(Math.floor(xp0 / 500) !== Math.floor(w.experience / 500) ? 'levelup' : 'orb' + ((Math.random() * 5 | 0) + 1), o.x, o.y);
                S.orbs.splice(i, 1); hud.dirty = true; S.xpT = 8;
                buzz(8);
            }
        }
    }

    function spawnMob(type, x, y, extra) {
        let n = 1, id;
        do id = 'play_mob' + (n++) + '_' + S.tick; while (mbwom.mobs[id]);
        const m = Object.assign({ type: type, x: x, y: y, speedX: 0, speedY: 0, direction: 0, falling: true, health: 0 }, extra || {});
        m.health = maxHealth(m);
        mbwom.mobs[id] = m;
        // 🎮 invitado: el mob lo crea el anfitrión (este de aquí dura un instante, para que el que lo pidió pueda ajustarlo, y se quita)
        if (mpGuest()) setTimeout(function () { const mm = mbwom.mobs[id]; if (!mm) return; delete mbwom.mobs[id]; S.tmp.delete(id); mpSend({ tipo: 'juego_mob_nuevo', m: JSON.parse(JSON.stringify(mm)) }); }, 0);
        return id;
    }
    function shootArrow(m, target) {
        const t = Math.atan2(target.y - Math.abs(target.x - m.x) / 5 - (m.y - 1.5), target.x - m.x) + (2 * Math.random() - 1) / 20;
        sndAt('bowsfx', m.x, m.y - 1.5);
        S.arrows.push({ x: m.x, y: m.y - 1.5, vx: migSpeed(20 * Math.cos(t)), vy: migSpeed(20 * Math.sin(t)), by: m, age: 0 });
    }
    function tickArrows() {
        const w = W();
        for (let i = S.arrows.length - 1; i >= 0; i--) {
            const r = S.arrows[i];
            if (simFar(r.x)) continue;
            r.age++;
            r.vy += .25; r.vx *= .995;
            r.x += r.vx / 30; r.y += r.vy / 30;
            if (r.age > 400 || collision(r.x, r.y, 0, 0, .1, true, true)) { S.arrows.splice(i, 1); continue; }
            if (r.ghost) continue;                                     // 🎮 (invitado: la flecha es del anfitrión, solo se ve)
            const dmg = Math.max(1, Math.round(Math.hypot(r.vx, r.vy) / 4));
            const pb = mobBounds(PLAYER_ID);
            if (r.x > pb.l && r.x < pb.r && r.y > pb.t && r.y < pb.b) { S.hitBy = { m: 'skeleton', t: Date.now() }; ouch(1, dmg, 'arrow'); S.arrows.splice(i, 1); continue; }
            if (mpHost()) {
                const R = window.mbwMpPlay.remotes; let hit = null;
                for (const k in R) { const b = plBounds(RP + k); if (b && r.x > b.l && r.x < b.r && r.y > b.t && r.y < b.b) { hit = RP + k; break; } }
                if (hit) { hitRemote(hit, dmg, 'arrow'); S.arrows.splice(i, 1); }
            }
        }
    }
    // ---------------------------------------------------------------- 🏹 lo que lanza el Player (Entity_Projectile del juego)
    //  · arco / shuriken de hueso / lanza: se mantiene el clic derecho para tensar y al soltar sale (más fuerza mientras más se tensa)
    //  · bola de nieve: sale al hacer clic. Las flechas y shurikens que caen en un bloque se quedan clavados y se pueden recoger.
    //  · huevo (a veces sale un pollito), huevo de fuego (prende fuego donde cae) y perla de ender (te lleva a donde cae): también se tensan
    const SHOT = { bow: 'arrow', bshur: 'shuriken', spear: 'spear', snowb: 'snowball', egg: 'egg', fireegg: 'fireegg', ep: 'pearl' };
    const SHOT_ITEM = { arrow: 'arrow', shuriken: 'bshur', spear: 'spear', snowball: 'snowb', egg: 'egg', fireegg: 'fireegg', pearl: 'ep' };
    const SHOT_BREAKS = { snowball: 1, egg: 1, fireegg: 1, pearl: 1 };    // (estos no se quedan clavados: se rompen al caer)
    function invFind(id) { const L = inv(); for (let i = 0; i < 45; i++) { const it = L[i]; if (!isEmpty(it) && it[0] === id && Number(it[1]) > 0) return i; } return -1; }
    function invTake(i) { const L = inv(), it = L[i]; if (isEmpty(it)) return; it[1] -= 1; if (it[1] <= 0) L[i] = empty(); hud.dirty = true; }
    function aimFrom(mw) { const w = W(); return Math.atan2(-mw.y - (w.worldY - 1.5), mw.x - w.worldX); }
    function canDraw(id) { return id !== 'bow' || W().gamemode == 1 || invFind('arrow') >= 0; }
    // soltar: p = cuánto se tensó (0..1)
    function fireShot(kind, ang, p) {
        const w = W(), ex = selExtra();
        let sp;
        if (kind === 'snowball') sp = migSpeed(20);
        else sp = migSpeed(17 * Math.max(0, Math.min(1, p)) + 6);
        const o = { kind: kind, x: w.worldX + Math.cos(ang) * sp / 30 * 3, y: w.worldY - 1.5 + Math.sin(ang) * sp / 30 * 3, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: ang, age: 0, cd: (.4 * FPS) | 0, hurtCd: 0 };
        if (kind === 'snowball') { o.x = w.worldX + 20 * Math.cos(ang) / 30; o.y = w.worldY - 1.5 + 20 * Math.sin(ang) / 30; }
        if (kind === 'arrow') {
            if (w.gamemode != 1) { ach(33); if (ex.infinity == null) { const i = invFind('arrow'); if (i < 0) return false; invTake(i); } else o.inf = true; } else o.inf = true;
            o.power = ex.power3 != null ? 3 : ex.power2 != null ? 2 : ex.power1 != null ? 1 : 0;
            o.punch = ex.punch2 != null ? 2 : ex.punch1 != null ? 1 : 0;
            if (ex.flame1 != null || ex.flame != null) o.flame = true;
            damageTool(); snd('bowsfx');
        } else { if (w.gamemode == 1) o.inf = true; reduceSelected(1); snd(kind === 'shuriken' ? 'shurikenthrow' : 'throwsfx'); }
        S.shots.push(o);
        // 🎮 los demás lo ven volar (solo se dibuja allá: el daño lo manda quien lo tiró)
        mpSend({ tipo: 'juego_tiro', k: kind, x: o.x, y: o.y, vx: o.vx, vy: o.vy, s: mbwom.currentScene || 1 });
        return true;
    }
    // lo que tiró otro jugador: solo para verlo
    function ghostShot(d) {
        if (!d || !SHOT_ITEM[d.k] || Number(d.s) !== (mbwom.currentScene || 1)) return;
        const n = (v) => { v = Number(v); return isFinite(v) ? v : 0; };
        S.shots.push({ kind: String(d.k), x: n(d.x), y: n(d.y), vx: n(d.vx), vy: n(d.vy), rot: Math.atan2(n(d.vy), n(d.vx)), age: 0, cd: 0, hurtCd: 0, ghost: true, inf: true });
    }
    // 🥚 🔥 🟣 al caer (o pegarle a un mob): x, y = donde cayó; bx, by = el bloque de aire de antes (para el pollito, el fuego o llegar)
    function shotImpact(o, mobId) {
        if (o.ghost) return;
        const w = W();
        const px = o.x - o.vx / 30, py = o.y - o.vy / 30;               // (el punto de antes de chocar)
        if (o.kind === 'egg') {
            for (let i = 0; i < 6; i++) addPart({ x: o.x + (Math.random() - .5) * .3, y: -o.y + (Math.random() - .5) * .3, vx: (Math.random() - .5) * .06, vy: Math.random() * .05, g: .006, life: 16, size: .08, col: '#f3ead2' });
            if ((Math.random() * 8 | 0) === 0) {
                const n = (Math.random() * 32 | 0) === 0 ? 4 : 1;
                for (let k = 0; k < n; k++) newMobAny({ type: 'chicken', x: px, y: py + .5, babyTimer: 1200 * FPS });
            }
        } else if (o.kind === 'fireegg') {
            sndAt('firethrow', o.x, o.y);
            const bx = Math.floor(px), by = Math.floor(-py);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx === 0 && dy === 0) || Math.random() < .5) { if (canFireExistAt(bx + dx, by + dy)) putFire(bx + dx, by + dy); }
            if (mobId && !mpGuest()) { tmpOf(mobId).onFire = 8 * FPS; hurtMob(mobId, 2, 'fire', PLAYER_ID); }
        } else if (o.kind === 'pearl') {
            // 🟣 llego a donde cayó (un poquito antes del bloque, para no quedar adentro) y me duele un poco
            let tx = px, ty = py;
            const b = mobBounds(PLAYER_ID), hh = b.b - b.t;
            for (let k = 0; k < 12 && collision(tx - .3, ty - hh, .6, hh - .05, .1); k++) { tx -= o.vx / 30 / 3; ty -= o.vy / 30 / 3 + .05; }
            w.worldX = tx; w.worldY = ty; w.xSpeed = 0; w.ySpeed = 0; w.riding = '';
            if (S.p) { S.p.falling = S.p.wasFalling = false; S.p.wasFallingSpeed = 0; }
            camSnap();
            for (let i = 0; i < 14; i++) addPart({ x: tx + (Math.random() - .5) * .8, y: -ty + 1 + (Math.random() - .5) * 1.6, vx: (Math.random() - .5) * .05, vy: (Math.random() - .5) * .05, life: 22, size: .1, col: '#b04ad8', glow: true });
            sndAt('Portal' + ((Math.random() * 5 | 0) + 1), tx, ty);
            if (w.gamemode != 1) ouch(1, 2, 'fall');
            ach(34);
        }
    }
    function newMobAny(m) { const ex = Object.assign({}, m); delete ex.type; delete ex.x; delete ex.y; return spawnMob(m.type, m.x, m.y, ex); }
    function shotDmg(o) { return o.kind === 'arrow' ? 3 + 3 * (o.power || 0) : (o.kind === 'snowball' || o.kind === 'egg' || o.kind === 'pearl' || o.kind === 'fireegg') ? 0 : 3; }
    function shotHitMob(o, id) {
        const m = mbwom.mobs[id]; if (!m) return;
        let dmg = shotDmg(o);
        if (o.kind === 'snowball') dmg = (m.type === 'snowgolem') ? 0 : (Math.random() < 1 / 3 || m.type === 'blaze' || m.type === 'enderman') ? 1 : 0;
        const kx = (o.vx > 0 ? 1 : -1) * (5 + 5 * (o.punch || 0)), ky = migSpeed(3 + 5 * (o.punch || 0));
        if (mpGuest()) { mpSend({ tipo: 'juego_pega', id: id, dmg: dmg, kx: kx, ky: ky, loot: 0 }); if (dmg > 0) mobSnd(m, 'hurt'); }
        else {
            if (o.kind === 'snowball' && m.type === 'snowgolem') m.health = Math.min((Number(m.health) || 0) + 1, 20);
            else if (dmg > 0) hurtMob(id, dmg, 'projectile', PLAYER_ID);
            m.speedX = (Number(m.speedX) || 0) + kx;
            m.speedY = ky;
            if (o.flame) tmpOf(id).onFire = 8 * FPS;
        }
        if (o.kind === 'snowball') splashSnow(o.x, o.y);
    }
    function splashSnow(x, y) { for (let i = 0; i < 8; i++) addPart({ x: x + (Math.random() - .5) * .4, y: -y + (Math.random() - .5) * .4, vx: (Math.random() - .5) * .08, vy: Math.random() * .06, g: .006, life: 18, size: .09, col: '#f4f8ff' }); }
    function tickShots() {
        const w = W(), list = S.shots;
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            if (simFar(o.x)) continue;
            if (++o.age > 60 * FPS) { list.splice(i, 1); continue; }
            if (o.cd > 0) o.cd--;
            if (o.stuck) {                                              // clavada: se puede recoger
                if (o.inf || o.ghost || w.gamemode == 3 || o.cd > 0) continue;
                const pb = mobBounds(PLAYER_ID);
                if (pb && o.x > pb.l - .33 && o.x < pb.r + .33 && o.y > pb.t - .33 && o.y < pb.b + .33) {
                    if (addToInventory(SHOT_ITEM[o.kind], 1, 0, {}) === 0) { pickSnd(); list.splice(i, 1); }
                }
                continue;
            }
            if (o.kind === 'shuriken') o.rot += (o.vx > 0 ? 1 : -1) * (Math.abs(o.vx) + Math.abs(o.vy)) / 10;
            else o.rot = Math.atan2(o.vy, o.vx);
            o.x += o.vx / 30; o.y += o.vy / 30;
            if (o.hurtCd > 0) o.hurtCd--;
            else if (!o.ghost) {
                let hit = null;
                for (const k in mbwom.mobs) {
                    const m = mbwom.mobs[k]; if (!m || m.dead > 0) continue;
                    const b = mobBounds(k);
                    if (b && o.x > b.l && o.x < b.r && o.y > b.t && o.y < b.b) { hit = k; break; }
                }
                if (hit) {
                    shotHitMob(o, hit);
                    if (SHOT_BREAKS[o.kind]) { shotImpact(o, hit); list.splice(i, 1); continue; }
                    // la lanza a veces sigue; lo demás se queda en el mob (se va)
                    if (o.kind === 'spear' && Math.random() >= 1 / 3) { o.hurtCd = 5; o.vx *= .3; o.vy = 0; }
                    else { list.splice(i, 1); continue; }
                }
            }
            const bx = Math.floor(o.x), by = Math.floor(-o.y), here = fg(bx, by);
            if (!o.ghost) { const ck = crystalAt(o.x, o.y); if (ck) { breakCrystal(ck); list.splice(i, 1); continue; } }   // 💎 una flecha rompe el cristal
            if (collision(o.x, o.y, 0, 0, .1, true, true)) {
                if (o.kind === 'snowball') { splashSnow(o.x, o.y); list.splice(i, 1); continue; }
                if (SHOT_BREAKS[o.kind] || o.ghost) { shotImpact(o, null); list.splice(i, 1); continue; }
                o.vx = o.vy = 0; o.stuck = true; o.cd = 0;
                sndAt('Trrrr', o.x, o.y);
                continue;
            }
            if (here === 'la') { if (SHOT_BREAKS[o.kind]) { list.splice(i, 1); continue; } o.flame = true; }
            else if (here === 'ad') { list.splice(i, 1); continue; }
            else if (here === 'wr') o.flame = false;
            o.vy += .25; o.vx *= .995;
        }
    }
    function drawShots(c2) {
        S.shots.forEach(function (o) {
            const p = toScreen(o.x, o.y), s = tileSize * (o.kind === 'snowball' ? .4 : o.kind === 'spear' ? 1.1 : .7);
            const img = iconFor(SHOT_ITEM[o.kind], {});
            c2.save(); c2.translate(p.x, p.y);
            // los dibujos del arco y la lanza apuntan en diagonal (↗): se giran 45° menos
            c2.rotate(o.rot + (o.kind === 'arrow' || o.kind === 'spear' ? Math.PI / 4 : 0));
            try { c2.drawImage(img, -s / 2, -s / 2, s, s); } catch (e) { /* nada */ }
            if (o.flame) { c2.fillStyle = 'rgba(255,140,0,.45)'; c2.fillRect(-s / 4, -s / 4, s / 2, s / 2); }
            c2.restore();
        });
        // 🏹 tensando: el arco (o lo que se va a lanzar) en la mano, apuntando al mouse; la flecha se va jalando hacia atrás
        if (S.draw) {
            const w = W(), k = Math.min(1, S.draw.t / drawFull(S.draw.id)), ang = aimFrom(mouseWorld());
            const b = (k * 10 + 27) / 30 * .85;                                   // (Game.useItemAnimation: bowDrawbackX / Y)
            const hp = toScreen(w.worldX + Math.cos(ang) * b, w.worldY - 1.5 + Math.sin(ang) * b), s = tileSize * .8;
            c2.save(); c2.imageSmoothingEnabled = false; c2.translate(hp.x, hp.y); c2.rotate(ang + Math.PI / 4);
            try {
                c2.drawImage(iconFor(S.draw.id, selExtra()), -s / 2, -s / 2, s, s);
                if (S.draw.id === 'bow') { const back = tileSize * .32 * k; c2.translate(-back * Math.SQRT1_2, back * Math.SQRT1_2); c2.drawImage(iconFor('arrow', {}), -s / 2, -s / 2, s, s); }
            } catch (e) { /* nada */ }
            c2.restore();
        }
        // tensando el arco: una barrita sobre el Player
        if (S.draw && S.draw.t > 2) {
            const w = W(), p = toScreen(w.worldX, w.worldY - 2.2), k = Math.min(1, S.draw.t / drawFull(S.draw.id)), bw = tileSize * .9;
            c2.fillStyle = 'rgba(0,0,0,.55)'; c2.fillRect(p.x - bw / 2 - 1, p.y - 1, bw + 2, 5);
            c2.fillStyle = k >= 1 ? '#7dff6a' : '#ffd23f'; c2.fillRect(p.x - bw / 2, p.y, bw * k, 3);
        }
    }
    const drawFull = (id) => (bd(id, 'timerToUse') || 80) | 0;          // (el juego cuenta cuadros de verdad: 80 = 1.6 s a 50 por segundo)
    // (cada paso, desde mineAndPlace) tensar y soltar
    function tickDraw(right, rightFresh, mw) {
        const id = selType();
        if (S.draw && (S.draw.id !== id || S.draw.slot !== selIndex() || modalOpen() || W().dead > 0)) S.draw = null;
        if (S.draw && !right) {                                         // soltó: sale disparado
            const d = S.draw; S.draw = null;
            fireShot(SHOT[d.id], aimFrom(mw), Math.min(1, d.t / drawFull(d.id)));
            S.swing = 15; S.placeDelay = 0;
            return true;
        }
        if (S.draw) { S.draw.t++; return true; }
        return false;
    }
    function startDraw(rightFresh) {
        const id = selType();
        if (!SHOT[id]) return false;
        if (id === 'snowb') { if (rightFresh) { fireShot('snowball', aimFrom(mouseWorld()), 1); S.swing = 15; } return true; }
        if (!rightFresh) return true;
        if (!canDraw(id)) return true;
        S.draw = { id: id, slot: selIndex(), t: 0 };
        return true;
    }
    // ---------------------------------------------------------------- 🐉 EL ENDER DRAGON (World.js mobData.enderdragon)
    //  · vuela de un lugar a otro (a veces cerca de ti), rompe los bloques que toca (en el End), te pega si lo tocas y a veces
    //    escupe una ráfaga de bolas de fuego. Los cristales del End (world.enderCrystals) lo curan: rómpelos primero (con un golpe o una flecha).
    //  · arriba sale su barra de vida. Al morir sube brillando, suelta escamas de dragón y experiencia; si es el del End ("official"):
    //    logro "Slay the ender dragon" y aparece el portal de salida (con su cofre: diamantes y el huevo del dragón).
    const DRG_HP = 333;
    function endCrystals() { const o = mbwom.world && mbwom.world.enderCrystals; return ((mbwom.currentScene || 1) === 3 && o && typeof o === 'object') ? o : null; }
    function colTop(x) { const col = mbwom.scene && mbwom.scene[x]; if (!col) return 0; let t = col.length; while (t > 0 && !col[t - 1]) t--; return t; }
    function dragonTick(id, c, a, d) {
        const w = W();
        c.x = Number(c.x) || 0; c.y = Number(c.y) || 0;
        if (!isFinite(Number(c.health))) c.health = DRG_HP;
        if (c.dead > 0) { dragonDying(id, c); return; }
        if (c.health <= 0) {
            c.dead = 1; c.speedX = c.speedY = 0;
            mobSnd(c, 'death'); if (SFX()) SFX().music('enderdragondeath');
            return;
        }
        c.flyBob = ((Number(c.flyBob) || 0) + 1) % 100000;
        // 💎 el cristal más cercano (a menos de 30) lo va curando
        const C = endCrystals(); d.beam = null;
        if (C) { let best = 30; Object.keys(C).forEach(function (k) { const q = C[k]; if (!Array.isArray(q)) return; const dd = Math.hypot(c.x - q[0] - .5, c.y + q[1] + .5); if (dd <= best) { best = dd; d.beam = k; } }); }
        if (d.beam && c.flyBob % ((80 / 25 * FPS) | 0) === 0) c.health = Math.min(c.health + 1, DRG_HP);
        if (mpGuest()) return;
        // 🧱 rompe lo que toca (en el End)
        const f = Math.floor(c.x), g = Math.floor(-c.y);
        if ((mbwom.currentScene || 1) === 3 && c.flyBob % 3 === 0) {
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                const t = fg(f + dx, g + dy);
                if (t && t !== 'air' && bd(t, 'dragonDontBreak') != 1 && bd(t, 'liquid') != 1 && t !== 'br' && t !== 'b') { setBlock(f + dx, g + dy, null); if (Math.random() < .5) addPart({ x: f + dx + .5, y: g + dy + .5, vx: (Math.random() - .5) * .1, vy: (Math.random() - .5) * .1, life: 18, size: .14, col: 'rgba(255,255,255,.6)' }); }
            }
        }
        // 🎯 a dónde va (como el juego: llega cerca o, de vez en cuando, cambia)
        if (c.spotX == null || (Math.abs(c.spotX - c.x) < 5 && Math.abs(c.spotY - c.y) < 5) || Math.random() < 1 / (100 * FPS / 25)) {
            if ((mbwom.currentScene || 1) !== 3 || Math.random() < 1 / 3) { c.spotX = w.worldX + 50 * Math.random() - 25; c.spotY = w.worldY + 30 * Math.random() - 20 - 2; }
            else { const sx = Math.random() * Math.max(30, dimWidth() / 3 - 30) + 15; c.spotX = sx; c.spotY = -(colTop(Math.floor(sx)) + 8 + 14 * Math.random()); }
            c.spotY = Math.min(c.spotY, -(colTop(Math.floor(c.spotX)) + 4));   // (siempre por arriba del suelo)
        }
        const dx = c.spotX - c.x, dy = c.spotY - c.y, dd = Math.max(.01, Math.hypot(dx, dy));
        c.speedX = (Number(c.speedX) || 0) * .985 + dx / dd * .006;
        c.speedY = (Number(c.speedY) || 0) * .985 + dy / dd * .006;
        const vm = Math.hypot(c.speedX, c.speedY), VMAX = .2;
        if (vm > VMAX) { c.speedX *= VMAX / vm; c.speedY *= VMAX / vm; }
        c.x += c.speedX; c.y += c.speedY + Math.sin(c.flyBob / 9) * .015;
        if (Math.abs(c.speedX) > .01) c.direction = c.speedX > 0 ? 1 : 0;
        if (c.y < -400) c.y = -400;
        // 🔥 ráfaga de bolas de fuego hacia el Player
        if (!(c.fbN > 0) && Math.random() < 1 / (200 * FPS / 25) && w.gamemode != 3 && Math.hypot(w.worldX - c.x, w.worldY - c.y) < 40) c.fbN = 5 + (Math.random() * 5 | 0);
        if (c.fbN > 0 && c.flyBob % 6 === 0) { c.fbN--; shootFireball(id, { x: c.x + (c.direction === 1 ? 2.5 : -2.5), y: c.y + 2 }, w.worldX, w.worldY - 1, false); }
        // 💥 si me toca: me pega y me empuja
        if (!(c.attackCooldown > 0)) {
            if (w.gamemode != 1 && w.gamemode != 3 && !(w.dead > 0) && intersects(mobBounds(id), mobBounds(PLAYER_ID))) {
                c.attackCooldown = 40; S.hitBy = { m: 'enderdragon', t: Date.now() };
                ouch(1, 5, 'attack'); w.xSpeed = (w.worldX > c.x ? 1 : -1) * migSpeed(14); w.ySpeed = migSpeed(8);
            }
        } else c.attackCooldown--;
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const b = plBounds(RP + k); if (b && !(c['hitR' + k] > 0) && intersects(mobBounds(id), b)) { c['hitR' + k] = 40; hitRemote(RP + k, 5, 'attack'); } if (c['hitR' + k] > 0) c['hitR' + k]--; } }
    }
    function dragonDying(id, c) {
        c.dead++;
        const T = 600;
        if (c.dead < T) {
            c.y -= c.dead < 300 ? .06 : c.dead < 340 ? .035 : c.dead < 360 ? .012 : 0;
            if (Math.random() < .5) addPart({ x: c.x + (Math.random() - .5) * 6, y: -c.y + (Math.random() - .5) * 4, vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2, life: 26, size: .18, col: Math.random() < .5 ? '#ffe6ff' : '#d58cff', glow: true });
            if (c.dead % 10 === 0 && !mpGuest()) { addDrop('dscl', c.x + 20 * Math.random() - 10, c.y - 1 + 2 * Math.random(), 1); dropXP(c.x, c.y, 20, 0, true); }
            return;
        }
        // ☠ se acabó
        if (!mpGuest()) {
            if (c.official) {
                const by = c.lastDamageID;
                if (by === PLAYER_ID || nearMe(c.x, c.y, 80)) ach(36);
                if (mpHost() && isRemoteId(by)) mpSend({ tipo: 'juego_logro_dar', a: by.slice(RP.length), i: 36 });
                exitPortal();
                flashMsg('🐉 ' + tr('play_dragon_dead', 'The Ender Dragon was defeated!'));
                say('[INFO] 🐉 ' + tr('play_dragon_dead', 'The Ender Dragon was defeated!'));
                if (typeof window.celebrate === 'function') { try { window.celebrate(); } catch (e) { /* nada */ } }
            } else for (let i = 0; i < 15; i++) { addDrop('dscl', c.x + 6 * Math.random() - 3, c.y - 1 + 2 * Math.random(), 1); }
        }
        delete mbwom.mobs[id]; S.tmp.delete(id);
        S.boss = null;
    }
    // 🌀 el portal de regreso (World.js: 7 marcos con ojo junto a donde estás y el cofre con 16 diamantes y el huevo del dragón)
    function exitPortal() {
        const w = W(); if (W().defeatedEnder && mbwom.world.mbweExitPortal) return;
        const left = w.worldX <= dimWidth() / 6, step = left ? 1 : -1;
        const c0 = Math.round(w.worldX + 10 * step); let cx = c0, tries = 30;
        while (tries-- > 0 && !(mbwom.scene[cx] && fg(cx, colTop(cx) - 1) === 'es')) cx += step;
        if (tries < 0) cx = c0;                                          // (sin piedra del End cerca: junto a ti)
        const dy = colTop(cx);
        for (let m = 0; m < 7; m++) { const x = cx + m * step; setBlock(x, dy, 'pf', 2); for (let k = 1; k <= 3; k++) setBlock(x, dy + k, null); }
        const chx = cx + 7 * step;
        setBlock(chx, dy, 'chest');
        let ch = mbwom.chests; if (!ch || typeof ch !== 'object') { ch = {}; mbwom.chests = ch; mbwom.world['chests' + (mbwom.currentScene || 1)] = ch; }
        const L = []; for (let i = 0; i < 27; i++) L.push(empty());
        L[11] = ['dm', 8, 0, {}]; L[13] = ['degg', 1, 0, {}]; L[15] = ['dm', 8, 0, {}];
        ch[key(chx, dy)] = L;
        w.defeatedEnder = true; mbwom.world.mbweExitPortal = [cx, dy];
    }
    // 💎 cristales del End: se dibujan sobre su pilar; con un golpe o una flecha explotan
    function crystalAt(gx, gy) { const C = endCrystals(); if (!C) return null; for (const k in C) { const q = C[k]; if (Array.isArray(q) && Math.abs(q[0] + .5 - gx) < .8 && Math.abs(-(q[1] + .5) - gy) < .9) return k; } return null; }
    function breakCrystal(k) {
        const C = endCrystals(); if (!C || !C[k]) return false;
        const q = C[k]; delete C[k];
        explode(q[0] + .5, q[1] + .5, 3, PLAYER_ID);
        return true;
    }
    function drawDragonExtras(c2) {
        const C = endCrystals();
        if (C) Object.keys(C).forEach(function (k) {
            const q = C[k]; if (!Array.isArray(q)) return;
            const p = toScreen(q[0] + .5, -(q[1] + .5)), r = tileSize * (.42 + .06 * Math.sin(S.tick / 8)), a2 = S.tick / 20;
            c2.save(); c2.translate(p.x, p.y); c2.rotate(a2);
            c2.fillStyle = 'rgba(230,120,255,.35)'; c2.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
            c2.rotate(-a2 * 2); c2.strokeStyle = '#f7d7ff'; c2.lineWidth = 2; c2.strokeRect(-r, -r, r * 2, r * 2);
            c2.fillStyle = '#c04df0'; c2.fillRect(-r / 2, -r / 2, r, r);
            c2.restore();
        });
        // el rayo del cristal que lo está curando
        for (const id in mbwom.mobs) {
            const m = mbwom.mobs[id]; if (!m || m.type !== 'enderdragon') continue;
            const d = S.tmp.get(id); if (!d || !d.beam || !C || !C[d.beam]) continue;
            const q = C[d.beam], a = toScreen(q[0] + .5, -(q[1] + .5)), b = toScreen(m.x, m.y);
            c2.save(); c2.strokeStyle = 'rgba(255,170,255,.8)'; c2.lineWidth = Math.max(2, tileSize / 10); c2.setLineDash([tileSize / 4, tileSize / 6]); c2.lineDashOffset = -S.tick;
            c2.beginPath(); c2.moveTo(a.x, a.y); c2.lineTo(b.x, b.y); c2.stroke(); c2.restore();
        }
    }
    // la barra de vida del jefe (arriba al centro), si hay un dragón cerca
    function bossUpdate() {
        const w = W(); let best = null, bd2 = 120;
        for (const id in mbwom.mobs) { const m = mbwom.mobs[id]; if (!m || m.type !== 'enderdragon') continue; const dd = Math.hypot(m.x - w.worldX, m.y - w.worldY); if (dd < bd2) { bd2 = dd; best = m; } }
        const root = document.getElementById('mbw-play-hud'); if (!root) return;
        let el = root.querySelector('.ph-boss');
        if (!best) { if (el) el.style.display = 'none'; return; }
        if (!el) { el = document.createElement('div'); el.className = 'ph-boss'; el.innerHTML = '<div class="ph-boss-n"></div><div class="ph-boss-bar"><div class="ph-boss-fill"></div></div>'; root.appendChild(el); }
        el.style.display = 'block';
        const n = tr('mob_enderdragon', 'Ender Dragon'); const ne = el.querySelector('.ph-boss-n'); if (ne.textContent !== n) ne.textContent = n;
        el.querySelector('.ph-boss-fill').style.width = Math.max(0, Math.min(100, (Number(best.health) || 0) / DRG_HP * 100)) + '%';
    }
    function mobTick(id, c) {
        const a = D.mobs[c.type];
        if (!a) return;
        const w = W(), d = tmpOf(id);
        if (c.type === 'enderdragon') { dragonTick(id, c, a, d); return; }   // 🐉
        if (c.dead > 0) { c.dead++; c.speedX = 0; if (c.dead > 40) { delete mbwom.mobs[id]; S.tmp.delete(id); } return; }
        if (!isFinite(Number(c.health))) c.health = maxHealth(c);
        if (c.health <= 0) { killMob(id, c); return; }
        if (c.breedTimer || c.babyTimer > 0) breedTick(id, c);            // 🐣 criar / crecer
        // 🔊 de vez en cuando su sonido (Entity_Mob: 1 entre idleSoundFrequency por paso; si persigue al Player, el de "aggroIdle")
        if (SFX()) { const si = SFX().mobInfo(c.type); if (si && si.sounds.idle && Math.random() * (si.freq || 200) <= 1) mobSnd(c, si.sounds.aggroIdle && c.target === PLAYER_ID ? 'aggro' : 'idle'); }
        c.x = Number(c.x) || 0; c.y = Number(c.y) || 0;
        if (!isFinite(c.speedX)) c.speedX = 0; if (!isFinite(c.speedY)) c.speedY = 0;
        const f = Math.floor(c.x), g = Math.floor(-c.y);
        if (!(c.hitCooldown > 0)) {
            c.hitCooldown = 40;
            if (a.burnsInLava == 1 && (fg(f, g) === 'la' || fg(f, g + 1) === 'la')) hurtMob(id, 5, 'lava');
            else if (a.burnsInAcid == 1 && (fg(f, g) === 'ad' || fg(f, g + 1) === 'ad')) hurtMob(id, 5, 'acid');
            else if (fg(f, g) === 'magma' && bd(fg(f, g + 1), 'waterCollision') != 1) hurtMob(id, 2, 'lava');
            else if (a.burnsInLava == 1 && (fg(f, g) === 'fire' || fg(f, g + 1) === 'fire')) hurtMob(id, 1, 'fire');     // 🔥 el bloque de fuego también quema
            else if (!(c.type === 'wolf' && c.tamed) && !(c.type === 'cow' && c.variant === 'cowctus') && a.cactusDamage !== false && a.cactusDamage !== 0 && (fg(f, g) === 'ct' || fg(f, g + 1) === 'ct')) hurtMob(id, 1, 'cactus');
        } else c.hitCooldown--;
        if (!d.far || (S.tick + (d.salt || (d.salt = 1 + (Math.random() * 3 | 0)))) % 4 === 0) calcTarget(id, c, a, d);   // ⚡ lejos (más de 24 bloques): piensa 1 de cada 4 pasos
        if (a.teleports && Math.random() < (a.teleportRandomChance || 0)) teleportMob(c);
        const K = d.keys, fr = d.isFrightened, hops = a.hops == 1;
        const flying = a.special && a.special.indexOf('specialGravityFunction') >= 0;
        if (a.aiType !== 'custom') {
            if (!hops || !c.falling) {
                if (Math.random() < (a.percentageChanceToDoMovement || 0) * (fr ? 3 : 1)) {
                    if (Math.random() < (a.percentageChanceToStopMoving || 0) * (fr ? .5 : 1)) { if (hops) K.up = false; K.left = false; K.right = false; }
                    const p = Math.random(), pd = (a.percentageChanceToChangeDirection || 0) * (fr ? 4 : 1);
                    if (p < pd) { if (hops) K.up = true; K.left = true; K.right = false; }
                    else if (p < 2 * pd) { if (hops) K.up = true; K.left = false; K.right = true; }
                    if (Math.random() < (a.percentageChanceToJump || 0) * (fr ? 3 : 1)) K.up = true; else if (!hops) K.up = false;
                }
                if (a.jumpAttack == 1 && d.following && Math.abs(c.x - d.followPoint.x) < 3 && d.followMax >= 3 && Math.random() < 2 / FPS) K.up = true;
                if (d.following && !fr) {
                    if (Math.abs(c.y - d.followPoint.y) < d.followMax / 2) {
                        if (Math.abs(c.x - d.followPoint.x) <= d.followMax) {
                            if (Math.abs(c.x - d.followPoint.x) >= d.followMin && Math.random() < (a.percentageChanceToUpdatePursuit != null ? a.percentageChanceToUpdatePursuit : .2)) {
                                if (c.x - d.followPoint.x > 0) { if (hops) K.up = true; K.left = true; K.right = false; }
                                else { if (hops) K.up = true; K.right = true; K.left = false; }
                            }
                        } else if (c.aggressiveness > 0) c.aggressiveness--;
                        if (a.followVertically == 1) {
                            if (c.y - d.followPoint.y < -d.followMax / 2 && c.y - d.followPoint.y > 0) K.up = true;
                            else if (c.y - d.followPoint.y > -d.followMax / 2 && c.y - d.followPoint.y < 0) K.up = false;
                        }
                    } else if (c.aggressiveness > 0) c.aggressiveness--;
                }
            } else if (hops) K.up = false;
            if (c.babyTimer > 0) c.babyTimer = Math.max(0, c.babyTimer - 1);
            if (a.ignoreCliffs != 1 && !flying) {                  // no tirarse por un barranco
                const p = (K.right ? .5 : 0) + (K.left ? -.5 : 0);
                if (p !== 0 && !collision(c.x + p, c.y, 0, 3, .5, true, true, true)) { if (p > 0) K.right = false; else K.left = false; if (hops) K.up = true; }
            }
            [1, 2].forEach(function (o) {                           // corriente del agua
                const k = key(f, g + o);
                if (mbwom.water && mbwom.water[k]) {
                    const wa = getWater(f, g + o);
                    if (wa[0] > wa[1]) c.speedX += migAcc(1, .7); else if (wa[0] < wa[1]) c.speedX -= migAcc(1, .7);
                    const s = mbwom.states ? mbwom.states[k] : undefined;
                    if (s == 1) c.speedY += migAcc(3, .6); else if (s == -1 && c.falling) c.speedY -= migAcc(2, .6);
                }
            });
            if (bd(fg(f, g + 1), 'walkThroughBlockHit') == null) {
                if (bd(fg(f - 1, g + 1), 'walkThroughBlockHit') == 1) c.speedX -= migAcc(1, .7);
                else if (bd(fg(f + 1, g + 1), 'walkThroughBlockHit') == 1) c.speedX += migAcc(1, .7);
                else c.falling = true;
            }
            if (a.ignoreWeb != 1 && (fg(f, g + 1) === 'web' || fg(f, g + 2) === 'web')) { c.speedX *= migDamp(.2); c.speedY *= migDamp(.2); }
            if (fg(f, g) === 'ssd' || fg(f, g) === 'slimeb') c.speedX *= migDamp(.5);
            const cb = cbounds(c);
            if (collision(c.x + .7 * cb.left, c.y - 1 / 3, .7 * cb.width, 0, .1333, false) && !collision(c.x + .7 * cb.left, c.y - 1.5, .7 * cb.width, 0, .1333, false)) c.y -= .5;
            c.wasFalling = c.falling == true;
            let p = c.falling = true;
            d.rightable = true; d.leftable = true;
            let t = false, wv = false, C = c.x, v = c.y;
            const r = Math.max(1, Math.ceil(Math.sqrt(c.speedX * c.speedX + c.speedY * c.speedY))) | 0;
            for (let B = 0; B < r; B++) {
                if (!wv) C = c.x + c.speedX * (B + 1) / r / 30;
                if (!t) {
                    v = c.y - c.speedY * (B + 1) / r / 30;
                    if (collision(C + .7 * cb.left, v + 1 / 30, .7 * cb.width, 0, .1333, false)) { t = true; c.falling = false; if (c.wasFalling) c.wasFallingSpeed = -c.speedY; c.speedY = 0; }
                    if (collision(C + .7 * cb.left, v + cb.top, .7 * cb.width, 0, .1333, false)) { p = false; if (c.speedY > 0) { t = true; c.speedY = -Math.abs(c.speedY / 2); } }
                }
                if (!wv) {
                    if (collision(C + cb.left, v + cb.top, 0, Math.max(0, cb.height - .6), .1333)) {
                        d.leftable = false;
                        if (a.climbsWalls == 1) { if (Math.random() < 1 / 60) K.up = !K.up; }
                        else { if (Math.random() <= .1) { K.up = true; K.left = true; } if (Math.random() <= .1) { K.up = false; K.left = false; } }
                        if (c.speedX < 0) { wv = true; c.speedX = 0; }
                    }
                    if (collision(C + cb.right, v + cb.top, 0, Math.max(0, cb.height - .6), .1333)) {
                        d.rightable = false;
                        if (a.climbsWalls == 1) { if (Math.random() < 1 / 60) K.up = !K.up; }
                        else { if (Math.random() <= .1) { K.up = true; K.right = true; } if (Math.random() <= .1) { K.up = false; K.right = false; } }
                        if (c.speedX > 0) { wv = true; c.speedX = 0; }
                    }
                }
            }
            if (d.following && !fr && Math.abs(c.x - d.followPoint.x) >= d.followMin && Math.abs(C - d.followPoint.x) < d.followMin) { K.left = false; K.right = false; }
            c.x = C; c.y = v;
            if (c.wasFalling && !c.falling) {                         // aterrizó: daño por caída
                d.wasFallingAndNotFalling = 6;
                if (fg(Math.floor(c.x), Math.floor(-(c.y + 1))).substr(0, 3) === 'bed') c.wasFallingSpeed *= migDamp(.6);
                else if (fg(Math.floor(c.x), Math.floor(-(c.y + 1))) === 'slimeb') { if (c.wasFallingSpeed > migSpeed(6)) { c.speedY = .78 * Math.max(0, c.wasFallingSpeed - migSpeed(5)); c.wasFallingSpeed = 0; c.y -= c.speedY / 2 / 30; } else c.speedY = 0; }
                if (a.takesFallDamage !== false && a.takesFallDamage !== 0 && c.wasFallingSpeed > migSpeed(23) && !flying) {
                    c.wasFallingSpeed -= migSpeed(14);
                    let B = 0, dm = 0;
                    while (c.wasFallingSpeed >= 0) { B += 2; ++dm; c.wasFallingSpeed -= migSpeed(Math.max(11 - B, 1)); }
                    if (dm > 0) hurtMob(id, dm, 'fall');
                }
                if (c.speedY <= 0) c.y = .5 * Math.round(c.y / .5) + 1 / 6;
            } else d.wasFallingAndNotFalling--;
            if (!flying && collisionWithLiquid(c.x + .7 * cb.left, c.y - cb.top, .7 * cb.width, cb.height, .5)) K.up = true;   // nada hacia arriba
            const headB = fg(f, Math.floor(g + .8 * cb.height));
            if (bd(headB, 'liquidCollision') == 1 && a.special.indexOf('specialFunction') < 0 || bd(headB, 'liquidCollision') == 1 && c.type !== 'squid') {
                c.airTimer = (c.airTimer == null ? 60 : c.airTimer) - 1; c.startUnderwaterTimer = 5;
                if (c.airTimer <= 0) { c.airTimer = 60; if (!(c.air > 0)) hurtMob(id, 1, 'drown'); else c.air--; }
            } else { c.air = 11; c.airTimer = 60; }
            if (flying) {                                               // voladores / nadadores: versión simple
                c.speedY *= migDamp(.9); c.speedX *= migDamp(.9);
                if (Math.random() < .03) c.speedY += migSpeed(4 * Math.random() - 2);
                if (d.following && !fr && c.type !== 'bat' && c.type !== 'squid') { c.speedX += Math.sign(d.followPoint.x - c.x) * .05; c.speedY += Math.sign(c.y - d.followPoint.y - 2) * .04; }
                if (c.type === 'squid' && bd(fg(f, g + 1), 'liquid') == null) c.speedY -= migAcc(2, .97);
            } else if (c.falling) {
                c.speedX *= bd(fg(f, g + 1), 'liquidCollision') == 1 ? migDamp(.55) : migDamp(.65);
                c.speedY -= migAcc(a.fallSpeed != null ? a.fallSpeed : 2, .97);
            } else if (fg(f, g) === 'ice' || fg(f, g) === 'fice') c.speedX *= migDamp(.9);
            else c.speedX *= migDamp(.7);
            if (bd(fg(f, g + 1), 'climbable') == 1) c.speedY *= migDamp(.6);
            if (a.float == 1) { const mx = migSpeed(a.floatMaxSpeed != null ? a.floatMaxSpeed : 3); c.speedY = Math.max(-mx, Math.min(mx, c.speedY)); }
            let ws = a.walkSpeed || 1;
            if (c.type === 'slime' || c.type === 'magmacube') ws = .6 * (c.size || 1) + .3;
            let mv = ws;
            if (fr) mv += ws * ((a.sprintMultiplier || 1) - 1);
            if (c.babyTimer > 0) mv *= 1.2;
            if (K.left && d.leftable) { if (!hops || c.falling) c.speedX -= migAcc(mv, .97); c.direction = 0; }
            if (K.right && d.rightable) { if (!hops || c.falling) c.speedX += migAcc(mv, .97); c.direction = 1; }
            // ataques
            if (a.attackExplode == 1) {
                if (c.target != null) {
                    if (!(c.fuse > 0)) { const tb = isPl(c.target) ? mobBounds(c.target) : null; if (tb && intersects(mobBounds(id), tb)) { c.fuse = 1; sndAt('fuse', c.x, c.y); } }
                    else {
                        const tp = isPl(c.target) ? (plPos(c.target) || c) : (mbwom.mobs[c.target] || c);
                        if (Math.pow(tp.x - c.x, 2) + Math.pow(tp.y - c.y, 2) >= 25) { if (c.fuse > 0) c.fuse--; }
                        else if (c.fuse < (a.fuseLength || 140)) c.fuse++;
                        else { explode(c.x, -c.y, c.charged ? 8 : 4, id); c.health = 0; delete mbwom.mobs[id]; S.tmp.delete(id); return; }
                    }
                } else if (c.fuse > 0) c.fuse--;
            } else if (!(c.attackCooldown > 0)) mobAttack(id, c, a);
            else c.attackCooldown--;
            if (a.climbsWalls == 1) {
                if (c.falling && collision(c.x + cb.left - 1 / 6, c.y + cb.top, 0, Math.max(0, cb.height + .3), .2) || collision(c.x + cb.right + 1 / 6, c.y + cb.top, 0, Math.max(0, cb.height + .3), .2)) { c.speedY *= migDamp(.7); if (K.up) c.speedY += migAcc(3, .97); }
                else if (Math.random() < .05) K.up = false;
            }
            if (K.up && !flying) {
                let B = 0;
                if (a.float == 1) { if (p) B = (a.floatJump != null ? a.floatJump : 2); c.speedY += migAcc(B, .97); c.y -= B / 2 / 30; }
                else if (bd(fg(f, g), 'climbable') == 1 && bd(fg(f, g + 1), 'climbable') != 1 && bd(fg(f, g + 2), 'climbable') != 1 && bd(fg(f, g + 3), 'climbable') != 1 || bd(fg(f, g + 1), 'climbable') == 1 && bd(fg(f, g + 2), 'walkThroughBlockHit') == 1) {
                    if (p) { B = 3 * (a.jumpSpeedMultiplier != null ? a.jumpSpeedMultiplier : 1); c.speedY += migAcc(B, .7); if (!c.falling) c.y -= B / 2 / 30; }
                } else if (p) {
                    if (fg(f, g).substr(0, 3) === 'bed' && !c.falling) B = 17;
                    else if (a.ignoreWeb != 1 && (fg(f, g) === 'web' || fg(f, g + 1) === 'web')) B = 2;
                    else if (!c.falling) B = 15;
                    if (B > 0) {
                        B *= a.jumpSpeedMultiplier != null ? a.jumpSpeedMultiplier : 1;
                        if (c.type === 'slime' || c.type === 'magmacube') B *= .2 * (c.size || 1) + .6;
                        if (B > c.speedY) { c.speedY = migSpeed(B); c.y -= B / 2 / 30; }
                    }
                }
            }
        }
        if (d.hurt > 0) d.hurt--;
        if (d.onFire > 0) {
            // 🔥 quemándose (al salir de la lava o del fuego): 1 de daño por segundo; el agua lo apaga. Los que no se queman (blaze, ghast...) no
            if (fg(f, g) === 'wr' || fg(f, g + 1) === 'wr' || a.burnsInLava != 1) d.onFire = 0;
            else { d.onFire--; if (d.onFire % FPS === 0 && fg(f, g) !== 'la' && fg(f, g + 1) !== 'la') hurtMob(id, 1, 'burning'); }   // ('burning' no vuelve a prender el fuego)
        }
        if (c.y > 10) { delete mbwom.mobs[id]; S.tmp.delete(id); }     // cayó al vacío
    }
    function mobAttack(id, c, a) {
        const w = W();
        if (!isAggro(c) || (c.tamed && c.sitting)) return;
        const toPlayer = (c.target == null && w.gamemode != 1 || c.target === PLAYER_ID) && w.gamemode != 3;
        let did = false, tx = 0, ty = -1e4;
        if (isRemoteId(c.target)) {                                    // 🎮 persigue a otro jugador
            const rb = plBounds(c.target);
            if (rb) {
                if (a.attackContact == 1 && intersects(mobBounds(id), rb) && (c.type !== 'slime' || (c.size || 1) > 1)) {
                    c.attackCooldown = a.attackFrequency || 26;
                    hitRemote(c.target, Math.max(1, c.attackDamage != null ? c.attackDamage : a.attackDamage != null ? a.attackDamage : 2), 'attack');
                }
                const rp = plPos(c.target); did = true; tx = rp.x; ty = rp.y;
            }
        } else if (toPlayer) {
            if (a.attackContact == 1 && intersects(mobBounds(id), mobBounds(PLAYER_ID)) && (c.type !== 'slime' || (c.size || 1) > 1)) {
                c.attackCooldown = a.attackFrequency || 26;
                S.hitBy = { m: c.type, t: Date.now() };
                ouch(1, Math.max(1, c.attackDamage != null ? c.attackDamage : a.attackDamage != null ? a.attackDamage : 2), 'attack');
            }
            did = true; tx = w.worldX; ty = w.worldY;
        } else if (c.target != null && mbwom.mobs[c.target]) {
            if (a.attackContact == 1 && intersects(mobBounds(id), mobBounds(c.target))) { c.attackCooldown = a.attackFrequency || 26; hurtMob(c.target, a.attackDamage != null ? a.attackDamage : 2, 'attack', id); }
            did = true; tx = mbwom.mobs[c.target].x; ty = mbwom.mobs[c.target].y;
        }
        const dist = Math.hypot(tx - c.x, ty - c.y);
        if (a.attackBow == 1) { if (did && dist < 10) { shootArrow(c, { x: tx, y: ty - 1 }); c.attackCooldown = a.attackFrequency || 40; } else c.attackCooldown = -30; }
        // 🔥 ghast (una bola grande que explota) y blaze (tres bolitas que queman) — Entity_Mob: attackCharge / attackTripleCharge
        if (c.type === 'ghast') { if (did && dist < 28 && dist > 3) { shootFireball(id, c, tx, ty - 1, true); c.attackCooldown = a.attackFrequency || 180; } else c.attackCooldown = -30; }
        else if (c.type === 'blaze') {
            if (did && dist < 16) {
                c.burst = (c.burst > 0 ? c.burst : 3) - 1;
                shootFireball(id, c, tx, ty - 1, false);
                c.attackCooldown = c.burst > 0 ? 15 : (a.attackFrequency || 400) / 2 * (Math.random() + .5);
            } else c.attackCooldown = -30;
        }
    }
    // ---------------------------------------------------------------- 🔥 bolas de fuego (Entity_Projectile "fireball")
    //  · la del ghast vuela derecho y explota al chocar; si el Player le pega (clic) se regresa: si le pega al ghast que la tiró,
    //    le quita 20 y sale el logro "Slay a ghast by its fireball".
    //  · las del blaze son chiquitas: queman (al Player o al mob) y prenden fuego donde caen.
    function shootFireball(id, m, tx, ty, big) {
        const t = Math.atan2(ty - m.y, tx - m.x) + (big ? 5 : 15) * (Math.random() - .5) / 180 * Math.PI, sp = migSpeed(9);
        const off = big ? 3 : 1;
        S.fballs.push({ x: m.x + off * Math.cos(t), y: m.y - (big ? 2 : 1) + off * Math.sin(t), vx: sp * Math.cos(t), vy: sp * Math.sin(t), by: id, big: big, age: 0, ret: null });
        sndAt('firethrow', m.x, m.y);
    }
    function deflectFireball(mw) {
        const w = W(), gx = mw.x, gy = -mw.y;
        for (let i = 0; i < S.fballs.length; i++) {
            const f = S.fballs[i];
            if (Math.hypot(f.x - gx, f.y - gy) > 1.3 || Math.hypot(f.x - w.worldX, f.y - (w.worldY - 1)) > REACH + 1) continue;
            const ang = Math.atan2(gy - (w.worldY - 1.5), gx - w.worldX), sp = Math.max(migSpeed(9), Math.hypot(f.vx, f.vy));
            const back = Math.atan2(-f.vy, -f.vx);                       // (más o menos hacia donde vino, ajustado a donde se apuntó)
            const a2 = back + Math.max(-.6, Math.min(.6, Math.atan2(Math.sin(ang - back), Math.cos(ang - back))));
            f.vx = Math.cos(a2) * sp; f.vy = Math.sin(a2) * sp; f.ret = PLAYER_ID; f.age = 0;
            snd('Trrrr');
            return true;
        }
        return false;
    }
    function fireballHit(f, mobId) {
        if (f.big) {
            if (f.ret === PLAYER_ID && mobId && mobId === f.by && mbwom.mobs[f.by] && mbwom.mobs[f.by].type === 'ghast') { ach(42); hurtMob(f.by, 20, 'projectile', PLAYER_ID); }
            explode(f.x, -f.y, 2, f.ret === PLAYER_ID ? PLAYER_ID : f.by);
        } else {
            const bx = Math.floor(f.x - f.vx / 30), by = Math.floor(-(f.y - f.vy / 30));
            if (canFireExistAt(bx, by)) putFire(bx, by);
            if (mobId && mbwom.mobs[mobId]) { tmpOf(mobId).onFire = 5 * FPS; hurtMob(mobId, 5, 'fire', f.ret === PLAYER_ID ? PLAYER_ID : f.by); }
        }
    }
    function tickFireballs() {
        if (!S.fballs.length) return;
        const w = W();
        for (let i = S.fballs.length - 1; i >= 0; i--) {
            const f = S.fballs[i];
            if (++f.age > 12 * FPS) { S.fballs.splice(i, 1); continue; }
            f.x += f.vx / 30; f.y += f.vy / 30;
            if (f.ghost) continue;                                       // (la del anfitrión: aquí solo se ve)
            if (Math.random() < .5) addPart({ x: f.x + (Math.random() - .5) * .3, y: -f.y + (Math.random() - .5) * .3, vx: 0, vy: .01, life: 12, size: f.big ? .14 : .08, col: Math.random() < .5 ? '#ff9a1f' : '#ffd84a', glow: true });
            // al Player (y a los otros jugadores, desde el anfitrión)
            if (f.ret !== PLAYER_ID && w.gamemode != 3 && !(w.dead > 0)) {
                const pb = mobBounds(PLAYER_ID);
                if (f.x > pb.l - .2 && f.x < pb.r + .2 && f.y > pb.t && f.y < pb.b) {
                    if (w.gamemode != 1) { ouch(1, f.big ? 6 : 5, f.big ? 'explosion' : 'fire'); }
                    if (f.big) explode(f.x, -f.y, 2, f.by); else fireballHit(f, null);
                    S.fballs.splice(i, 1); continue;
                }
                if (mpHost()) {
                    const R = window.mbwMpPlay.remotes; let hit = null;
                    for (const k in R) { const b = plBounds(RP + k); if (b && f.x > b.l && f.x < b.r && f.y > b.t && f.y < b.b) { hit = RP + k; break; } }
                    if (hit) { hitRemote(hit, f.big ? 6 : 5, f.big ? 'explosion' : 'fire'); if (f.big) explode(f.x, -f.y, 2, f.by); S.fballs.splice(i, 1); continue; }
                }
            }
            // a los mobs (no al que la tiró, salvo que se la regresaron)
            let mh = null;
            for (const k in mbwom.mobs) {
                if (k === f.by && f.ret !== PLAYER_ID) continue;
                const m = mbwom.mobs[k]; if (!m || m.dead > 0) continue;
                const b = mobBounds(k);
                if (b && f.x > b.l && f.x < b.r && f.y > b.t && f.y < b.b) { mh = k; break; }
            }
            if (mh) { fireballHit(f, mh); S.fballs.splice(i, 1); continue; }
            if (collision(f.x, f.y, 0, 0, .1, true, true) || bd(fg(Math.floor(f.x), Math.floor(-f.y)), 'liquid') == 1) { if (fg(Math.floor(f.x), Math.floor(-f.y)) !== 'wr') fireballHit(f, null); S.fballs.splice(i, 1); continue; }
        }
    }
    function drawFireballs(c2) {
        S.fballs.forEach(function (f) {
            const p = toScreen(f.x, f.y), r = tileSize * (f.big ? .5 : .22);
            const g = c2.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, '#fff6c0'); g.addColorStop(.45, '#ffb21f'); g.addColorStop(1, 'rgba(220,60,0,0)');
            c2.fillStyle = g; c2.beginPath(); c2.arc(p.x, p.y, r, 0, Math.PI * 2); c2.fill();
        });
    }

    // ------------------------------------------------------------------ picar y poner (Game.mineAndPlaceCode)
    function mouseWorld() {
        const cv = document.getElementById('canvas');
        const r = cv.getBoundingClientRect();
        let cx = S.mouse.x, cy = S.mouse.y;
        if (window.mbwAspect && window.mbwAspect.active && window.mbwAspect.mapClient) { const u = window.mbwAspect.mapClient(cx, cy); cx = u.x; cy = u.y; }
        const px = (cx - r.left) * (cv.width / r.width), py = cv.height - (cy - r.top) * (cv.height / r.height);
        return { x: camera.x + px / tileSize, y: camera.y + py / tileSize };   // y hacia ARRIBA (como el editor)
    }
    window.mbwPlay.mouseWorld = function () { return mouseWorld(); };   // (lo usan las pruebas)
    function blockDist(bx, by) { const w = W(); return Math.hypot(Math.floor(w.worldX) - bx, Math.floor(-w.worldY) - (by - 1)); }
    function mobUnderMouse(mw) {
        const w = W();
        if (typeof window.findMobAt !== 'function') return null;
        const hit = window.findMobAt(mw.x, mw.y);
        if (!hit || !mbwom.mobs[hit.key] || mbwom.mobs[hit.key].dead > 0) return null;
        const m = hit.mob;
        if (Math.hypot(m.x - w.worldX, m.y - w.worldY) > (m.type === 'enderdragon' ? 12 : 3.5)) return null;   // (el dragón es enorme)
        return hit.key;
    }
    function miningTime(t) {
        const mi = bd(t, 'mining');
        const tool = selType();
        let f = null;
        if (mi && bd(tool, 'tool') == 1 && mi[tool] != null) f = mi[tool];
        else if (mi && mi.None != null) f = mi.None;
        if (f == null) return -1;                                   // no se puede picar
        if (S.p.inWater) f *= 2;
        return (Math.max(1, Math.floor(f)) / 25 * FPS) | 0;
    }
    // 🛏🚪 bloques de 2 partes: al quitar una, la otra también se quita (sin soltar nada; la que se rompió ya suelta 1)
    const DOOR_PART = /^(dr|bdr|idr)([1-4])$/;
    function removePartner(x, y, t, s1) {
        let px = null, py = null, ok = null;
        if (t === 'bed1') { px = x + 1; py = y; ok = /^bed[12]$/; }
        else if (t === 'bed2') { px = x - 1; py = y; ok = /^bed[12]$/; }
        else if (DOOR_PART.test(t)) { const n = +t.slice(-1), fam = t.slice(0, -1); px = x; py = (n === 1 || n === 3) ? y + 1 : y - 1; ok = new RegExp('^' + fam + '[1-4]$'); }
        else if (/^s?piston[12]$/.test(t)) {
            const v = DIRV[Number(s1) || 1] || DIRV[1], head = t.slice(-1) === '1';
            px = head ? x + v[0] : x - v[0]; py = head ? y + v[1] : y - v[1]; ok = head ? /^s?piston2$/ : /^s?piston1$/;
        }
        if (px == null || py < 0 || !ok.test(fg(px, py))) return;
        setBlock(px, py, null);
    }
    // 🌱 Hierba alta (Game.mineBlock "lgr"): con tijeras o toque de seda suelta la hierba; si no, cada semilla tiene su probabilidad
    //    (fortuna sube un poco cada una): trigo 1 de 5, remolacha 1 de 30, calabaza 1 de 70, sandía 1 de 90
    function heldEnch() { const it = selItem(); return (it && it[3] && typeof it[3] === 'object') ? it[3] : {}; }
    function fortuneLv() { const e = heldEnch(); for (let n = 3; n >= 1; n--) if (e['fortune' + n] != null) return n; return 0; }
    function grassDrops(x, y, tool) {
        const B = fortuneLv(), px = x + .5, py = -(y + .5);
        if (tool === 'Shear' || heldEnch().silkTouch != null) { addDrop('lgr', px, py, 1, 0, {}); return; }
        const r = (n) => Math.random() * n | 0;
        if (r(5 + r(B + 1)) >= 4) addDrop('seed', px, py, 1, 0, {});
        if (r(30 + 2 * r(B + 1)) >= 29) addDrop('bseed', px, py, 1, 0, {});
        if (r(70 + 3 * r(B + 1)) >= 69) addDrop('pseed', px, py, 1, 0, {});
        if (r(90 + 3 * r(B + 1)) >= 89) addDrop('wseed', px, py, 1, 0, {});
    }
    window.mbwPlay.grassDrops = grassDrops;
    function mineBlock(x, y, byCmd) {
        const w = W();
        const t = fg(x, y);
        if (t === 'air' || (t === 'br' && w.gamemode != 1)) return;
        const s1 = st(x, y);
        const chestItems = (t === 'chest' && mbwom.chests && Array.isArray(mbwom.chests[key(x, y)])) ? mbwom.chests[key(x, y)] : null;
        const cropN = CROPS[t] ? cropStage(x, y) : 0;
        const brewData = (t === 'brew' && mbwom.toBrew && mbwom.toBrew[key(x, y)]) ? JSON.parse(JSON.stringify(mbwom.toBrew[key(x, y)])) : null;
        if (!byCmd) blockSnd(t, 'break', x, y);
        if (!byCmd) { if (t === 'wd1' || t === 'wd') ach(0); else if (t === 'ob') ach(27); else if (t === 'gd') ach(28); else if (t === 'dmore') ach(29); }
        setBlock(x, y, null);
        removePartner(x, y, t, s1);                                    // 🛏🚪 la otra mitad (cama, puerta, pistón) se va sin soltar nada, como Game.requestRemove
        // 🧊 el hielo (y el hielo escarchado y la caña de azúcar del agua) deja agua al romperlo, como Game.mineBlock (en el Nether se evapora)
        if (!byCmd && (t === 'ice' || t === 'fice' || t === 'sw')) { if ((mbwom.currentScene || 1) == 2) sndAt('sizzle', x + .5, -(y + .5)); else setLiq(x, y, 'wr', [10, 10]); }
        if (w.gamemode == 1) return;
        if (!byCmd) damageTool();
        const dw = bd(t, 'dropsWith');
        const tool = selType();
        if (dw && !dw[tool]) return;                               // hace falta la herramienta correcta para que suelte algo
        if (t === 'lgr') { grassDrops(x, y, tool); return; }        // 🌱 la hierba alta suelta semillas (Game.mineBlock)
        let drop = bd(t, 'dropDifferent');
        if (drop === 'na') drop = null; else if (drop == null) drop = t;
        if (t === 'lv' || t.substr(0, 2) === 'lv') {                // hojas: a veces un brote; 🍎 las que tienen fruta sueltan su fruta
            const fruit = { lv1: 'ap', lv2: 'or', lv3: 'gap', lv4: 'lemon' }[t];
            if (fruit) addDrop(fruit, x + .5, -y - .5, 1, 0, {});
            drop = Math.random() < 1 / 12 ? 'sl' : null;
        }
        if (Array.isArray(drop)) drop = drop[0];
        let ex = (typeof s1 === 'string' && s1 && (t === 'cloth' || t === 'carpet' || t === 'bdcloth' || t === 'bed' || t === 'bed1' || t === 'bed2')) ? { type: s1 } : {};
        if (drop === 'bed' && !ex.type) ex = { type: 'red' };            // (camas viejas sin color: rojas, como World.migrateItems)
        if (drop) addDrop(drop, x + .5, -y - .5, 1, 0, ex);
        if (chestItems) chestItems.forEach(function (it) { if (!isEmpty(it)) addDrop(it[0], x + .5, -y - .5, it[1], it[2], it[3]); });
        if (CROPS[t]) cropDrops(t, cropN, x, y);                       // 🌾 el cultivo grande suelta su cosecha
        if (brewData) [brewData.input, brewData.fuel].concat(brewData.output || []).forEach(function (it) { if (!isEmpty(it)) addDrop(it[0], x + .5, -y - .5, it[1], it[2], it[3]); });
        if (brewData && mbwom.toBrew) delete mbwom.toBrew[key(x, y)];
    }
    const WALLY = { lant: 1, th: 1, ortorch: 1, rstorch: 1, button: 1, lever: 1 };
    function placeBlock(mw) {
        const w = W();
        const bx = Math.floor(mw.x), by = Math.floor(mw.y);
        const it = selItem();
        if (!it) return false;
        let id = String(it[0]);
        // el inventario del editor guarda algunos bloques con su variante ("lant_1", "th_2"...): se pone el bloque normal con esa variante
        let varS1;
        if (bd(id, 'placeable') != 1) { const mv = /^(.+)_([0-9]+)$/.exec(id); if (mv && bd(mv[1], 'placeable') == 1) { id = mv[1]; varS1 = Number(mv[2]); } }
        const here = fg(bx, by);
        // usar un objeto
        if (here === 'TNT' && id === 'fas') { igniteTNT(bx, by); damageTool(); return true; }
        if (id === 'mbk') { if (S.useTimer < 0) S.useTimer = ((bd(id, 'timerToUse') || 50) / 25 * FPS) | 0; return false; }   // 🥛 leche
        if (id === 'potion' && drinkable(it)) {                        // 🧪 pociones: arrojadiza = se lanza; normal = se toma (como comer)
            if (potionOf(it).splash) { splashPotion(it); return true; }
            if (S.useTimer < 0) S.useTimer = ((bd(id, 'timerToUse') || 50) / 25 * FPS) | 0;
            return false;
        }
        const food = bd(id, 'food');
        if (food && bd(id, 'placeable') != 1) { if (canEat(id) && S.useTimer < 0) S.useTimer = ((bd(id, 'timerToUse') || 50) / 25 * FPS) | 0; return false; }
        if (id === 'megg' && it[3] && it[3].type) { if (blockDist(bx, by) <= REACH) { spawnMob(String(it[3].type), bx + .5, -by - .01); reduceSelected(1); return true; } return false; }
        // 🪣 cubetas: la vacía recoge una fuente de agua / lava / ácido; la llena la pone
        const BUCKET = { wbk: 'wr', lbk: 'la', abk: 'ad' }, FILL = { wr: 'wbk', la: 'lbk', ad: 'abk' };
        if (id === 'bk' || BUCKET[id]) {
            if (!S.rightFresh || blockDist(bx, by) > REACH) return false;    // (una vez por clic, como el juego: waitTillRightMouseIsUp)
            if (id === 'bk') {
                if (!(FILL[here] && fullLiq(bx, by))) return false;
                liqGone(bx, by);
                if (w.gamemode != 1) { reduceSelected(1); const left = addToInventory(FILL[here], 1, 0, {}); if (left > 0) addDrop(FILL[here], w.worldX, w.worldY - 1, left); }
                return true;
            }
            if (!(here === 'air' || bd(here, 'replaceable') == 1 || (isLiq(here) && !fullLiq(bx, by)))) return false;
            if (here !== 'air' && !isLiq(here)) mineBlock(bx, by, true);
            if ((mbwom.currentScene || 1) == 2 && id === 'wbk') { flashMsg('💨'); sndAt('sizzle', bx + .5, -(by + .5)); }
            else setLiq(bx, by, BUCKET[id], [10, 10]);
            if (w.gamemode != 1) { inv()[selIndex()] = ['bk', 1, 0, {}]; hud.dirty = true; }
            return true;
        }
        if (bd(id, 'placeable') != 1) return false;
        if (blockDist(bx, by) > REACH) return false;
        if (!(here === 'air' || bd(here, 'liquid') != null || bd(here, 'replaceable') != null)) return false;
        if (here === id) return false;
        // tiene que estar al lado de algo (o delante de un fondo)
        const nb = [fg(bx + 1, by), fg(bx - 1, by), fg(bx, by + 1), fg(bx, by - 1)];
        if (!nb.some((n) => n !== 'air' && bd(n, 'liquid') == null) && bd(here, 'backdrop') == null) return false;
        const po = bd(id, 'placeOn');
        if (po && Array.isArray(po)) {
            const below = fg(bx, by - 1);
            const okBelow = po[0] && typeof po[0] === 'object' && (po[0].SOLID ? bd(below, 'walkThroughBlock') != 1 : po[0][below]);
            const okAbove = po[2] && typeof po[2] === 'object' && (po[2].SOLID ? bd(fg(bx, by + 1), 'walkThroughBlock') != 1 : po[2][fg(bx, by + 1)]);
            const okSide = po[1] && typeof po[1] === 'object' && (po[1].SOLID ? (bd(fg(bx - 1, by), 'walkThroughBlock') != 1 || bd(fg(bx + 1, by), 'walkThroughBlock') != 1) : (po[1][fg(bx - 1, by)] || po[1][fg(bx + 1, by)]));
            if (!okBelow && !okAbove && !okSide) return false;
        }
        // no ponerlo encima del Player o de un mob
        if (!(bd(id, 'walkThroughBlockHit') && !bd(id, 'actuallyHasCollisionThough'))) {
            const P = S.p, pxL = Math.floor(w.worldX - (10 + (sneakOrUse() ? 4 : 0)) / 30), pxR = Math.floor(w.worldX + (10 + (sneakOrUse() ? 4 : 0)) / 30);
            if ((bx === pxL || bx === pxR) && (by === P.blockY + 1 || by === P.blockY + 2)) return false;
            for (const k in mbwom.mobs) { const b2 = mobBounds(k); if (b2 && bx + 1 > b2.l && bx < b2.r && -by > b2.t && -by - 1 < b2.b) return false; }
        }
        let s1 = varS1;
        if (it[3] && typeof it[3].type === 'string') s1 = it[3].type;   // color de la lana, de la cama, etc.
        // antorchas, coral lantern, palanca, botón: se pegan al piso (1) o a la pared de la izquierda (2) / derecha (3), como Game.placeBlock
        if (WALLY[id]) {
            const solid = function (x, y) { const t = fg(x, y); return t !== 'air' && bd(t, 'walkThroughBlock') == null; };
            const px = Math.floor(w.worldX), order = px === bx ? [[0, -1, 1], [-1, 0, 2], [1, 0, 3]] : px < bx ? [[1, 0, 3], [0, -1, 1], [-1, 0, 2]] : [[-1, 0, 2], [0, -1, 1], [1, 0, 3]];
            const o = order.find(function (q) { return solid(bx + q[0], by + q[1]); });
            if (!o) return false;
            s1 = o[2];
        }
        // 🧱 losas: pegada ABAJO de un bloque = mitad de arriba (2); encima de un bloque = mitad de abajo (1).
        //    🪜 escaleras: miran al jugador (el escalón bajo hacia donde está) y, pegadas a un techo o muy arriba de él, al revés.
        if (bd(id, 'halfBlock') == 1 || bd(id, 'stairBlock') == 1) {
            const sol = function (x, y) { const t = fg(x, y); return t !== 'air' && bd(t, 'walkThroughBlock') == null && bd(t, 'liquid') == null; };
            const below = sol(bx, by - 1), above = sol(bx, by + 1);
            if (bd(id, 'halfBlock') == 1) s1 = (!below && (above || mw.y - by > .5)) ? 2 : 1;   // (de lado, sin nada arriba ni abajo: la mitad donde tocaste)
            else {
                const px = Number(w.worldX), eye = -Number(w.worldY) + 1.6;                  // (los ojos del jugador)
                const rightOfMe = bx + .5 >= px;                                             // (a mi derecha: el escalón sube hacia la derecha)
                const upside = !below && (above || by + .5 > eye);                           // (pegada a un techo, o de lado más arriba de mis ojos: al revés)
                s1 = rightOfMe ? (upside ? 3 : 1) : (upside ? 4 : 2);
            }
        }
        // 🛏 cama: 2 bloques (bed1 aquí, bed2 a la derecha), los dos con el color; 🚪 puertas: 2 bloques (abajo y arriba). Como Game.placeBlock
        if (id === 'bed') {
            const r = fg(bx + 1, by);
            if (r !== 'air' && bd(r, 'replaceable') == null && bd(r, 'liquid') == null) return false;
            const col = typeof s1 === 'string' && s1 ? s1 : 'white';
            setBlock(bx, by, 'bed1', col); setBlock(bx + 1, by, 'bed2', col);
            blockSnd('bed1', 'place', bx, by); reduceSelected(1);
            return true;
        }
        const DOORS = { dr: ['dr1', 'dr2'], bbdr: ['bdr1', 'bdr2'], idr: ['idr3', 'idr4'] };
        if (DOORS[id]) {
            const up = fg(bx, by + 1);
            if (fg(bx, by - 1) === 'air' || !(up === 'air' || bd(up, 'replaceable') != null)) return false;
            const side = Math.floor(w.worldX) > bx ? 1 : 2;
            setBlock(bx, by, DOORS[id][0], side); setBlock(bx, by + 1, DOORS[id][1], side);
            blockSnd(DOORS[id][0], 'place', bx, by); reduceSelected(1);
            return true;
        }
        setBlock(bx, by, id, s1);
        blockSnd(id, 'place', bx, by);
        reduceSelected(1);
        return true;
    }
    // 🚪 Puertas y trampillas de madera (Block_Door.toggle / Block_TrapDoor.useEvent) y 🎵 bloque musical (Block_Note.useEvent2):
    // la puerta tiene 2 partes (1 = abajo, 2 = arriba abiertas; 3 = abajo, 4 = arriba cerradas). Las de hierro no se abren a mano.
    // 🚪 abrir / cerrar una puerta (las dos partes). Con la mano: madera y abedul; con redstone (placas, palancas…): también la de hierro
    function doorToggle(x, y) {
        const m = /^(dr|bdr|idr)([1-4])$/.exec(fg(x, y)); if (!m) return false;
        const b = m[1], n = +m[2];
        const low = (n === 1 || n === 3) ? y : y - 1;
        const open = n === 1 || n === 2;
        const s0 = st(x, low), s1 = st(x, low + 1);
        setBlock(x, low, b + (open ? '3' : '1'), s0); setBlock(x, low + 1, b + (open ? '4' : '2'), s1);
        sndAt(open ? 'doorclose' : 'dooropen', x + .5, -(y + .5));
        return true;
    }
    function useBlock(x, y) {
        const t = fg(x, y);
        if (t === 'bed1' || t === 'bed2') return useBed(x, y, t);          // 🛏 dormir
        // 🎂 pastel (y pastel de cactus): una rebanada (+1 muslito); son 7 rebanadas (maxState 7); la de cactus pica un poco
        if (t === 'cake' || t === 'ccake') {
            const w = W();
            if (w.food >= 1000 && w.gamemode != 1) return true;               // (lleno: no come)
            const n = (Number(st(x, y)) || 0) + 1;
            w.food = Math.min(1000, (Number(w.food) || 0) + 100);
            if (t === 'ccake') ouch(1, 1, 'cactus');
            snd('eat' + ((Math.random() * 4 | 0) + 1));
            if (n >= 7) setBlock(x, y, null); else setBlock(x, y, t, n);
            hud.dirty = true;
            return true;
        }
        if (/^(dr|bdr)([1-4])$/.test(t)) return doorToggle(x, y);         // (la de hierro solo con redstone, como en el juego)
        // 🚧 puerta de cerca (de madera o del Nether): abrir (se puede pasar) / cerrar. Abierta = states true (Game: 1 == states)
        if (t === 'fncg' || t === 'nfncg') {
            const open = st(x, y) == 1;
            const ns = { type: t }; if (!open) ns.states1 = true;
            mbwom.setBlockState(x, y, ns);
            if (typeof window.renderBlock === 'function') window.renderBlock(x, y);
            sndAt(open ? 'doorclose' : 'dooropen', x + .5, -(y + .5));
            return true;
        }
        // 🔘 botón: da señal 1 segundo
        if (t === 'button') { S.btn = S.btn || new Map(); S.btn.set(x + ',' + y, S.tick + 2 * FPS); sndAt('on', x + .5, -(y + .5)); return true; }   // (2 segundos)
        // 🕹 palanca: prender / apagar (states2 = 1 encendida)
        if (t === 'lever') {
            const cur = mbwom.getBlockState(x, y), on = Number(cur.states2) === 1;
            const ns = { type: 'lever', states1: cur.states1 != null ? cur.states1 : 1 }; if (!on) ns.states2 = 1;
            mbwom.setBlockState(x, y, ns);
            if (typeof window.renderBlock === 'function') window.renderBlock(x, y);
            sndAt(on ? 'off' : 'on', x + .5, -(y + .5));
            return true;
        }
        if (t === 'td1' || t === 'td2') {
            const s0 = st(x, y);
            setBlock(x, y, t === 'td2' ? 'td1' : 'td2', s0);
            sndAt(t === 'td2' ? 'dooropen' : 'doorclose', x + .5, -(y + .5));
            return true;
        }
        if (t === 'note') {
            if (!mbwom.states) mbwom.states = {};
            let v = (parseInt(mbwom.states[key(x, y)], 10) || 0) + 1; if (v > 25) v = 1;
            mbwom.states[key(x, y)] = v; netMark(x, y);
            playNote(x, y);
            return true;
        }
        return false;
    }
    function playNote(x, y) {
        const X = SFX(); if (!X) return;
        const v = Math.max(1, Math.min(25, parseInt(st(x, y), 10) || 1));
        const k = X.blockKind(fg(x, y - 1));                     // lo que hay abajo decide el instrumento
        const name = k === 'stone' ? 'kick' : k === 'wood' ? 'bass' + v : k === 'mush' ? 'snare' : 'piano' + v;
        sndAt(name, x + .5, -(y + .5));
    }
    window.mbwPlay.useBlock = function (x, y) { return useBlock(x, y); };
    window.mbwPlay.hurtMob = function (id, n) { hurtMob(id, n, 'attack', PLAYER_ID); };     // (lo usan las pruebas)
    window.mbwPlay.explode = function (x, y, r) { explode(x, y, r || 3, PLAYER_ID); };
    window.mbwPlay.runCommand = function (t) { runCommand(t); };                              // (lo usan las pruebas)
    window.mbwPlay.addDrop = function (id, x, y, n) { addDrop(id, x, y, n || 1, 0, {}); };
    window.mbwPlay.dropItem = function (id, n, dmg, extras) { const w = W(); addDrop(id, w.worldX, w.worldY - 1, n || 1, dmg || 0, extras || {}); };   // (lo que no cabe al cerrar el crafteo)                  // (lo usan las pruebas)
    window.mbwPlay.openBox = function (x, y) { return openBox(x, y); };                                       // (lo usan las pruebas)
    // 🎮 ¿hay otro jugador bajo el mouse (y a la mano: 3.5 bloques)?
    function playerUnderMouse(mw) {
        if (!S.mp || !window.mbwMpPlay) return null;
        const w = W(), R = window.mbwMpPlay.remotes, gy = -mw.y;
        let best = null, bdist = Infinity;
        for (const k in R) {
            const r = remoteOf(RP + k); if (!r) continue;
            const b = plBounds(RP + k);
            if (mw.x < b.l - .15 || mw.x > b.r + .15 || gy < b.t - .1 || gy > b.b + .1) continue;
            const dd = Math.hypot(r.tx - w.worldX, r.ty - w.worldY);
            if (dd <= 3.5 && dd < bdist) { bdist = dd; best = k; }
        }
        return best;
    }
    // 🎮 pegarle a otro jugador: el golpe (con la fuerza de lo que tengo en la mano, como a un mob) y un empujón le llegan a él
    const PVP_COOLDOWN = 1500;                                           // ⏱ entre un golpe y otro a un jugador (ms)
    function attackPlayer(peerId) {
        const w = W(), r = window.mbwMpPlay.remotes[peerId]; if (!r) return;
        if (Date.now() - (S.pvpAt || 0) < PVP_COOLDOWN) return;
        S.pvpAt = Date.now();
        let b = 0, kb = 0, dmg;
        const hs = bd(selType(), 'hitStrength');
        if (hs == null) { if (w.ySpeed < -1) { ++b; kb += 3; } dmg = Math.max(1, 1 + b); }
        else { if (w.ySpeed < -1) { b += Math.floor((hs + b) * ((20 * Math.random() | 0) + 30) / 100); kb += 3; } dmg = Math.max(1, hs + b | 0); damageTool(); }
        const sprint = (S.p.leftSprinting !== 0 || S.p.rightSprinting !== 0);
        mpSend({ tipo: 'juego_pvp', a: peerId, dmg: dmg, kx: (r.tx > w.worldX ? 1 : -1) * (5 + (sprint ? 8 : 0) + kb), autor: myNameNet() });
    }
    const myNameNet = () => { try { return localStorage.getItem('mbw_username') || 'Player'; } catch (e) { return 'Player'; } };
    function attackMob(mid) {
        const w = W(), m = mbwom.mobs[mid];
        if (!m) return;
        if (mpGuest()) {                                               // 🎮 el mob es del anfitrión: le mando el golpe
            let b = 0, kb = 0, dmg;
            const hs = bd(selType(), 'hitStrength');
            if (hs == null) { if (w.ySpeed < -1) { ++b; kb += 5; } dmg = Math.max(1, 1 + b); }
            else { if (w.ySpeed < -1) { b += Math.floor((hs + b) * ((20 * Math.random() | 0) + 30) / 100); kb += 5; } dmg = Math.max(1, hs + b | 0); damageTool(); }
            const sprint = (S.p.leftSprinting !== 0 || S.p.rightSprinting !== 0);
            const ex = selExtra();
            mpSend({ tipo: 'juego_pega', id: mid, dmg: dmg, kx: (m.x > w.worldX ? 1 : -1) * (7 + (sprint ? 15 : 0) + kb), ky: migSpeed(4 + (sprint ? 4 : 0) + kb / 4), loot: ex.looting3 != null ? 3 : ex.looting2 != null ? 2 : ex.looting1 != null ? 1 : 0 });
            mobSnd(m, 'hurt');
            return;
        }
        let b = 0, kb = 0;
        const hs = bd(selType(), 'hitStrength');
        if (hs == null) {
            if (w.ySpeed < -1) { ++b; kb += 5; }
            hurtMob(mid, Math.max(1, 1 + b), 'attack', PLAYER_ID);
        } else {
            if (w.ySpeed < -1) { b += Math.floor((hs + b) * ((20 * Math.random() | 0) + 30) / 100); kb += 5; }
            hurtMob(mid, Math.max(1, hs + b | 0), 'attack', PLAYER_ID);
            damageTool();
        }
        const sprint = (S.p.leftSprinting !== 0 || S.p.rightSprinting !== 0);
        m.speedX = (Number(m.speedX) || 0) + (m.x > w.worldX ? 1 : -1) * (7 + (sprint ? 15 : 0) + kb);
        const cb = cbounds(m);
        if (collision(m.x + .7 * cb.left, m.y + 1, .7 * cb.width, 0, 4, false)) { m.speedY = (Number(m.speedY) || 0) + migSpeed(4 + (sprint ? 4 : 0) + kb / 4); m.y -= 1 / 3; }
    }
    function mineAndPlace() {
        const w = W();
        if (w.dead > 0 || w.gamemode == 3) { S.mine = null; return; }
        S.placeDelay++;
        if (w.gamemode == 1 && selType().substr(-5) !== 'Sword') S.placeDelay += 6;
        if (S.useTimer > -1) {                                    // comiendo
            if (!(S.mouse.right || S.mouse.rightEdge) || (bd(selType(), 'food') == null && !drinkable(selItem()) && selType() !== 'mbk')) S.useTimer = -1;
            else if (selType() === 'mbk') { if (--S.useTimer === 0) { drinkMilk(); S.useTimer = -1; } }
            else if (--S.useTimer === 0 && selType() === 'potion') {     // 🧪 se terminó de tomar la poción
                const po = potionOf(selItem());
                snd('drink' + ((Math.random() * 2 | 0) + 1));
                applyPotion(po, PLAYER_ID);
                if (w.gamemode != 1) { reduceSelected(1); if (addToInventory('potion', 1, 0, { type: 'empty' }) > 0) addDrop('potion', w.worldX, w.worldY, 1, 0, { type: 'empty' }); }
                S.useTimer = -1; hud.dirty = true;
            }
            else if (S.useTimer === 0) {
                const fd = bd(selType(), 'food');
                // 🔊 al terminar: "drink" para lo que se bebe, si no uno de los 4 "eat"
                if (bd(selType(), 'drink') != null || selType() === 'potion') snd('drink' + ((Math.random() * 2 | 0) + 1)); else snd('eat' + ((Math.random() * 4 | 0) + 1));
                const ate = selType();
                if (fd && fd.hunger != null) w.food = Math.min(1000, w.food + fd.hunger);
                ach(25);
                if (fd && fd.health != null) w.health = Math.min(20, w.health + fd.health);
                // efectos (como el juego: la manzana dorada regenera, la carne cruda da hambre, la papa venenosa envenena...)
                if (fd && fd.effects) Object.keys(fd.effects).forEach(function (k) { const e = fd.effects[k]; if (e.chance == null || Math.random() < 1 / e.chance) addEffect(k, e.duration == null ? 10 : e.duration, 1); });
                reduceSelected(1); S.useTimer = -1; hud.dirty = true;
                // las sopas y el helado dejan el plato; los jugos, la botella vacía (Game.useUpItem)
                if (w.gamemode != 1) {
                    if (ate === 'rabbitsoup' || ate === 'beetsoup' || ate === 'soup' || ate === 'icec') addDrop('bowl', w.worldX, w.worldY, 1, 0, {});
                    else if (ate === 'lade' || ate === 'orade' || ate === 'apade') addDrop('potion', w.worldX, w.worldY, 1, 0, { type: 'empty' });
                }
            } else if (S.useTimer % 20 === 0) snd('eat' + ((Math.random() * 2 | 0) + 1), { vol: .3 });   // (mientras come: mordiditas suaves)
            if (S.useTimer > 0 && S.useTimer % 6 === 0 && selType() !== 'potion' && selType() !== 'mbk') eatParts(selType());   // 🍖 migajitas
            return;
        }
        const mw = mouseWorld();
        // un clic rapidísimo (se suelta antes del siguiente paso) cuenta igual una vez
        const right = S.mouse.right || S.mouse.rightEdge, left = S.mouse.left || S.mouse.leftEdge, rightFresh = S.mouse.rightEdge, leftFresh = S.mouse.leftEdge;
        S.mouse.rightEdge = false; S.mouse.leftEdge = false;
        if (tickDraw(right, rightFresh, mw)) { S.mine = null; return; }    // 🏹 tensando / soltando el arco
        if (right) {
            if (selType() === 'cbook') { if (rightFresh) useCommandBook(); S.mine = null; return; }      // (una vez por clic)
            const bx = Math.floor(mw.x), by = Math.floor(mw.y);
            if (rightFresh && BOX[fg(bx, by)] && blockDist(bx, by) <= REACH + 1) { openBox(bx, by); return; }   // clic derecho en un cofre / horno: se abre
            if (rightFresh && !S.ride) { const v = vehicleUnderMouse(mw); if (v && Math.hypot(vPos(v.kind, v.d).x - W().worldX, vPos(v.kind, v.d).y - W().worldY) < 4 && mount(v.kind, v.id)) { S.mine = null; return; } }   // 🛶🚃 subirse
            if (rightFresh && selType() !== 'bl') { const bk = balloonAt(mw.x, -mw.y, 'string'); if (bk && grabBalloon(bk)) { S.mine = null; return; } }   // 🎈 agarrar un globo
            if (rightFresh && useOnMob(mw)) { S.mine = null; S.swing = 15; return; }                   // 🐄 criar / ordeñar
            if (rightFresh && useItemLife(mw, bx, by)) { S.mine = null; S.swing = 15; return; }        // 🔥 mechero, 🎣 caña, azadón, harina de hueso, balsa, vagoneta
            if (rightFresh && !S.p.sneaking && blockDist(bx, by) <= REACH + 1 && useBlock(bx, by)) { S.mine = null; S.swing = 15; return; }   // puertas, trampillas, bloque musical, camas
            if (SHOT[selType()]) { startDraw(rightFresh); S.mine = null; return; }      // 🏹 arco, ❄ bola de nieve, shuriken de hueso, lanza
            S.rightFresh = rightFresh;
            if (S.placeDelay >= 6 && placeBlock(mw)) { S.placeDelay = 0; S.swing = 15; ach(1); const px2 = Math.floor(mw.x), py2 = Math.floor(mw.y); golemCheck(px2, py2); if (CROPS[fg(px2, py2)] && !cropStage(px2, py2)) setCrop(px2, py2, 1); }
            S.rightFresh = false;
            S.mine = null;
            return;
        }
        if (!left) { S.mine = null; return; }
        if (leftFresh) { const v = vehicleUnderMouse(mw); if (v && (!S.ride || S.ride.id !== v.id)) { breakVehicle(v); S.mine = null; S.swing = 15; return; } }   // 🛶🚃 romper
        if (S.placeDelay < 6) return;
        if (leftFresh) { const bk = balloonAt(mw.x, -mw.y, 'body'); if (bk && popBalloon(bk)) { S.swing = 15; S.placeDelay = 0; S.mine = null; return; } }   // 🎈 ¡pop!
        if (leftFresh) { const ck = crystalAt(mw.x, -mw.y); if (ck && blockDist(Math.floor(mw.x), Math.floor(mw.y)) <= REACH + 1 && breakCrystal(ck)) { S.swing = 15; S.placeDelay = 0; S.mine = null; return; } }   // 💎
        if (leftFresh && deflectFireball(mw)) { S.swing = 15; S.placeDelay = 0; S.mine = null; return; }   // 🔥 regresarle la bola de fuego al ghast
        const mid = mobUnderMouse(mw);
        if (mid) { attackMob(mid); buzz(15); S.swing = 15; S.placeDelay = 0; S.mine = null; return; }
        const pid = playerUnderMouse(mw);                              // 🎮 otro jugador
        if (pid) { attackPlayer(pid); buzz(15); S.swing = 15; S.placeDelay = 0; S.mine = null; return; }
        // ⛏🎯 (app de Android + herramienta: el bloque más cercano hacia donde apunta el dedo)
        const sm = smartOn() ? smartTarget(w, mw) : null;
        S.smart = sm;
        if (sm) { mineTick(w, sm.x, sm.y); return; }
        if (smartOn()) { S.mine = null; return; }                           // (no hay nada que picar en esa dirección)
        mineTick(w, Math.floor(mw.x), Math.floor(mw.y));
    }
    // ⛏ picar el bloque (bx, by) un paso (sirve para el dedo / mouse y para el trazo de abajo). true = se rompió
    function mineTick(w, bx, by) {
        const t = fg(bx, by);
        if (t === 'air' || bd(t, 'liquid') == 1 || (t === 'br' && w.gamemode != 1) || blockDist(bx, by) > REACH + 1) { S.mine = null; return false; }
        if (!S.mine || S.mine.x !== bx || S.mine.y !== by || S.mine.t !== t) {
            const n = w.gamemode == 1 ? 0 : miningTime(t);
            if (n < 0) { S.mine = null; return false; }
            S.mine = { x: bx, y: by, t: t, left: n, total: Math.max(1, n) };
            if (t === 'note' && n > 0) playNote(bx, by);                // (al pegarle suena la nota, sin cambiarla)
        }
        if (S.mine.left > 0 && (S.mine.total - S.mine.left) % 26 === 0) blockSnd(t, 'mine', bx, by);   // 🔊 picando: cada medio segundo
        if (S.mine.left <= 0) { mineBlock(bx, by); buzz(22); S.mine = null; S.placeDelay = w.gamemode == 1 ? 0 : 6; return true; }
        if (S.mine.left % 13 === 0) buzz(6);                         // (picando: golpecitos suaves)
        S.mine.left--;
        return false;
    }

    // ------------------------------------------------------------------ ⛏🎯 cursor inteligente (solo en la app de Android, con herramientas)
    //   Como en Terraria: con pico, pala, hacha o espada, aunque el dedo apunte más lejos, se pica el bloque MÁS CERCANO
    //   en esa dirección (en línea recta desde el Player hacia el dedo). Así se hacen túneles rectos o en curva moviendo el dedo.
    const SMART_TOOL = /(Pickaxe|Axe|Shovel|Sword)$/;
    function smartOn() { return document.documentElement.classList.contains('is-app') && S.touchHeld === true && SMART_TOOL.test(selType()) && S.touchMode !== 'place'; }
    function smartTarget(w, mw) {
        const px = Number(w.worldX), py = -Number(w.worldY) + 1.2;            // (desde el pecho del Player)
        const dx = mw.x - px, dy = mw.y - py, len = Math.hypot(dx, dy);
        if (len < 0.01) return null;
        const ux = dx / len, uy = dy / len, max = Math.min(len, REACH + 1.5);
        let lx = null, ly = null;
        for (let d = 0.3; d <= max; d += 0.08) {
            const bx = Math.floor(px + ux * d), by = Math.floor(py + uy * d);
            if (bx === lx && by === ly) continue; lx = bx; ly = by;
            if (blockDist(bx, by) > REACH + 1) break;
            const t = fg(bx, by);
            if (t === 'air' || bd(t, 'liquid') == 1) continue;
            if (bd(t, 'walkThroughBlockHit') == 1 && bd(t, 'solid') != 1 && d < max - 0.6) continue;   // (pasto, flores, antorchas: solo si es justo donde apuntas)
            if (t === 'br' && w.gamemode != 1) return null;
            if (w.gamemode != 1 && miningTime(t) < 0) return null;
            return { x: bx, y: by };
        }
        return null;
    }
    window.mbwPlay.smartTarget = function () { return S.smart ? { x: S.smart.x, y: S.smart.y } : null; };   // (pruebas)


    // ------------------------------------------------------------------ Command Book (Game.interpretCommand)
    // Los mismos comandos del juego y con las mismas coordenadas: x hacia la derecha, y hacia ARRIBA (número de bloque), "~" = desde el Player.
    // (Los data_tags {…} no se usan aquí; lightning, spawnskin, enchant y seed solo avisan.)
    function ident(name) {
        const I = (window.MB_GAME && window.MB_GAME.identifiers) || {};
        name = String(name || '').toLowerCase();
        if (I[name]) return I[name][0];
        if (D.blocks[name]) return name;                              // (también se acepta el id interno)
        return null;
    }
    const MOB_ALIAS = { bunny: 'rabbit', dog: 'wolf', cowctus: 'cow', mooshroom: 'cow', netherwalker: 'nethereye', octopus: 'squid', pigman: 'zombiepigman' };
    function coord(v, axis) {
        const w = W();
        if (v == null) return NaN;
        v = String(v);
        if (v[0] === '~') { const r = v.slice(1); const n = r === '' ? 0 : parseFloat(r); if (isNaN(n)) return NaN; return axis === 'y' ? n - w.worldY : n + w.worldX; }
        const n = parseFloat(v); return (String(n) === v || /^-?\d+(\.\d+)?$/.test(v)) ? n : NaN;
    }
    // Lo que dicen los comandos va al chat (abajo a la izquierda, como en el juego): cada línea se ve 10 segundos;
    // con el chat abierto se ven las últimas.
    const cmdLog = [];
    function say(t) { cmdLog.push({ t: String(t), at: performance.now() }); if (cmdLog.length > 60) cmdLog.shift(); chat.dirty = true; }
    window.mbwPlay.chatLog = function () { return cmdLog.map(function (l) { return l.t; }); };
    // ¿el mundo tiene los comandos activados? (casilla "Commands" de World Settings; en el juego, sin eso ni el chat ni los Command Books hacen nada)
    function cheatsOn() {
        const cb = document.getElementById('cheats');
        if (cb) return !!cb.checked;
        const c = W().cheats; return c === true || c === 1;
    }
    // 🌀 cambiar de dimensión jugando (1 = Overworld, 2 = Nether, 3 = End); devuelve true si se pudo
    function changeDimension(n) { return changeDim(n, 'cmd'); }
    const DIM_KEYS = { overworld: 1, o: 1, '1': 1, nether: 2, n: 2, '2': 2, end: 3, e: 3, '3': 3, the_end: 3 };
    function dimName(n) { return [null, tr('dim_overworld', 'Overworld'), tr('dim_nether', 'Nether'), tr('dim_end', 'End')][n] || '?'; }
    // ¿esa dimensión existe en este mundo? (el juego la genera la primera vez que se entra; aquí no se puede generar)
    function dimReady(n) { const c = mbwom.world && mbwom.world['scene' + n]; return Array.isArray(c) && c.some(function (col) { return col && col.length; }); }
    function dimWidth() { const n = Number(W().worldWidth); return n > 0 ? n : ((mbwom.scene || []).length || 1000); }
    // dónde puede pararse el Player en la columna x (fila de los pies y): libre los pies y la cabeza, algo firme abajo, sin lava / ácido / fuego
    function standable(x, y) {
        const hard = function (yy) { const t = fg(x, yy); return t !== 'air' && bd(t, 'walkThroughBlock') != 1; };
        const bad = function (yy) { const t = fg(x, yy); return t === 'la' || t === 'ad' || t === 'fire'; };
        return y >= 1 && !hard(y) && !hard(y + 1) && !bad(y) && !bad(y + 1) && hard(y - 1);
    }
    function safeSpot(x, y) {
        const bx = Math.floor(x), by = Math.floor(-y);
        for (let d = 0; d <= 90; d++) {
            if (standable(bx, by - d)) return { x: bx + .5, y: -(by - d) };
            if (d && standable(bx, by + d)) return { x: bx + .5, y: -(by + d) };
        }
        const col = mbwom.scene[bx] || []; let top = col.length; while (top > 0 && !col[top - 1]) top--;
        return { x: bx + .5, y: -Math.max(top, 1) };
    }
    // Game.usePortal: kind 1 = portal del Nether, 2 = portal del End
    function usePortal(kind) {
        const sc = mbwom.currentScene || 1;
        if (kind === 2) changeDim(sc === 3 ? 1 : 3, 'portal');
        else { changeDim(sc === 2 ? 1 : 2, 'portal'); if ((mbwom.currentScene || 1) === 2) ach(31); }
    }
    function changeDim(n, why) {
        n = Number(n);
        const from = mbwom.currentScene || 1;
        if (!(n >= 1 && n <= 3) || !S.playing) return false;
        if (from === n) return true;
        if (!dimReady(n)) { const m = tr('play_dim_missing', 'The {dim} is not generated in this world (open it once in the game first).').replace('{dim}', dimName(n)); flashMsg(m); say('[INFO] ' + m); return false; }
        const w = W();
        closeModals(); S.openBoxAt = null; S.mine = null; S.useTimer = -1;
        if (from === 1) w.portalCoords = [Number(w.worldX), Number(w.worldY)];        // (para volver del Nether a donde estaba)
        // lo que estaba suelto en esta dimensión se queda aquí (al volver sigue)
        S.dimStash = S.dimStash || {};
        S.dimStash[from] = { drops: S.drops, orbs: S.orbs, falling: S.falling, arrows: S.arrows }; S.shots = []; S.fballs = []; S.eyes = []; S.draw = null;
        syncScene();
        snapDim(n);                                                        // 📸 primera vez en esta dimensión: su foto (todavía sin cambios)
        mbwom.loadScene(n); mbwom.currentScene = n; w.scene = n;
        if (typeof mbwom.mobs !== 'object' || !mbwom.mobs) { mbwom.mobs = {}; w['mobs' + n] = mbwom.mobs; }
        const st = S.dimStash[n] || {}; delete S.dimStash[n];
        S.drops = st.drops || []; S.orbs = st.orbs || []; S.falling = st.falling || []; S.arrows = st.arrows || [];
        S.tmp = new Map(); S.liqFresh = new Set(); S.sandCheck = new Map(); S.leafQ = new Map(); S.parts = []; S.wetWas = {}; S.spawnT = new Map(); S.spawnOn = new Set(); S.rsOn = new Map(); S.rsReady = false;
        // a dónde llega (Game.usePortal): Overworld = donde se entró al portal (o el spawn); Nether = mitad del mundo, y 30; End = un sexto, y 53
        const wd = dimWidth();
        let to;
        if (n === 1) { const pc = w.portalCoords; to = (from === 2 && Array.isArray(pc) && isFinite(Number(pc[0])) && isFinite(Number(pc[1]))) ? { x: Number(pc[0]), y: Number(pc[1]) } : (spGet() || { x: wd / 2, y: -120 }); }
        else if (n === 2) to = { x: wd / 2, y: -30 };
        else to = { x: wd / 6, y: -53 };
        to = safeSpot(to.x, to.y);
        w.worldX = to.x; w.worldY = to.y; w.xSpeed = 0; w.ySpeed = 0; w.riding = '';
        if (S.p) { S.p.falling = S.p.wasFalling = false; S.p.wasFallingSpeed = 0; S.p.wasFallingAndNotFalling = 0; S.p.suffocate = 0; S.p.jumpTimer = 0; }
        S.portalLock = true;                                           // (llega parado en el portal: hay que salir antes de volver a usarlo)
        try { if (typeof initializeWorldCache === 'function') initializeWorldCache(); } catch (e) { /* nada */ }
        try { if (typeof window.syncDimensionIcon === 'function') window.syncDimensionIcon(); } catch (e) { /* nada */ }
        try { const X = SFX(); if (X) { X.stopLoops(); X.stopMusic(); } } catch (e) { /* nada */ }
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        hud.dirty = true; camSnap();
        if (why === 'portal') sndAt('Portal' + ((Math.random() * 5 | 0) + 1));
        flashMsg('🌀 ' + dimName(n));
        if (S.mp) mpSend({ tipo: 'juego_sys', autor: myNameNet(), k: 'dim', n: n });
        return true;
    }
    window.mbwPlayChangeDim = function (n) { return changeDim(n, 'cmd'); };
    // 👁 /spectate
    function findRemote(name) {
        const R = (S.mp && window.mbwMpPlay) ? window.mbwMpPlay.remotes : {};
        const want = String(name || '').replace(/^@/, '').toLowerCase();
        const k = Object.keys(R || {}).find(function (q) { return String(R[q].name || '').toLowerCase() === want; });
        return k ? { id: k, r: R[k] } : null;
    }
    function spectFollow() {
        const R = window.mbwMpPlay && window.mbwMpPlay.remotes, r = R && R[S.spect];
        if (!S.mp || !r || Date.now() - r.t > 5000) { stopSpect(); return; }
        if (key2('down')) { stopSpect(); return; }                        // (Shift: dejar de seguir)
        if (r.s !== (mbwom.currentScene || 1) && !changeDim(r.s, 'spect')) { stopSpect(); return; }
        const w = W(); w.worldX = Number(r.tx); w.worldY = Number(r.ty); w.xSpeed = 0; w.ySpeed = 0;
    }
    function stopSpect(silent) {
        if (!S.spect) return;
        const n = S.spectName || ''; S.spect = null; S.spectName = '';
        if (!silent) say('[INFO] ' + tr('play_spect_stop', 'You stopped spectating {name}.').replace('{name}', n));
        hud.dirty = true;
    }
    window.mbwPlay.spectating = function () { return S.spect ? S.spectName : ''; };
    window.mbwPlay.changeDim = changeDim;
    window.mbwPlay.usePortal = usePortal;
    // ↩ /back: al lugar donde moriste (si caíste al vacío, al suelo más cercano de ahí)
    //   Se espera 3 segundos antes de ir. Solo 1 vez cada hora (en una partida), menos el anfitrión (y Crystal).
    const TP_WAIT = 3000, BACK_EVERY = 60 * 60 * 1000, BACK_KEY = 'mbw_back_at';
    function backFree() { return !S.mp || roomHost() || isAdminMe(); }
    function doBack() {
        const w = W(), b = S.deathPos;
        if (!b) { say('[INFO] ' + tr('play_back_none', 'You have not died yet: /back takes you to the place where you died.')); return; }
        if (w.dead > 0) { say('[INFO] ' + tr('play_back_dead', 'Respawn first, then type /back.')); return; }
        if (S.backWait) { say('[INFO] ' + tr('play_back_already', 'Wait, you are already going back...')); return; }
        let last = 0; try { last = Number(localStorage.getItem(BACK_KEY)) || 0; } catch (e) { /* nada */ }
        if (!backFree() && Date.now() - last < BACK_EVERY) {
            const m = Math.ceil((BACK_EVERY - (Date.now() - last)) / 60000);
            say('[INFO] ' + tr('play_back_cool', 'You can only use /back once every hour. Try again in {n} min.').replace('{n}', m)); return;
        }
        say('[INFO] ' + tr('play_back_wait', 'Teleporting you back to where you died in 3 seconds...'));
        S.backWait = setTimeout(function () {
            S.backWait = 0;
            if (!S.playing || W().dead > 0) return;
            if (!backFree()) { try { localStorage.setItem(BACK_KEY, String(Date.now())); } catch (e) { /* nada */ } }
            backNow(b);
        }, TP_WAIT);
    }
    function backNow(b) {
        const w = W();
        if (b.s !== (mbwom.currentScene || 1) && !changeDim(b.s, 'cmd')) { say('[INFO] ' + tr('play_back_dim', 'You cannot go back to that dimension right now.')); return; }
        let x = b.x, y = b.y;
        if (b.v || -y < 1) { const p = safeSpot(x, -2); x = p.x; y = p.y; }
        w.worldX = x; w.worldY = y; w.xSpeed = 0; w.ySpeed = 0; w.riding = '';
        if (S.p) { S.p.falling = S.p.wasFalling = false; S.p.wasFallingSpeed = 0; S.p.wasFallingAndNotFalling = 0; S.p.suffocate = 0; S.p.jumpTimer = 0; }
        S.mine = null; stopSpect(true); camSnap(); hud.dirty = true;
        say('[INFO] ' + tr('play_back_done', 'Back where you died (x:{x}, y:{y}).').replace('{x}', Math.floor(x)).replace('{y}', Math.floor(-y)));
    }
    // 👑 (anfitrión / Crystal) usar un comando sobre otro jugador: se le manda y él lo hace en su partida (scripts/mp-play.js → net.cmd)
    const OTHERS = { tp: 1, heal: 1, kill: 1, give: 1, clear: 1, gamemode: 2 };
    function targets(tag) {
        const want = String(tag || '').replace(/^@/, '').toLowerCase();
        const R = (S.mp && window.mbwMpPlay) ? window.mbwMpPlay.remotes || {} : {};
        const live = Object.keys(R).filter(function (k) { return R[k] && R[k].name; });
        if (want === 'me' || want === 's' || want === String(myNameNet()).toLowerCase()) return [{ me: true, name: myNameNet() }];
        const f = findRemote(want); if (f) return [{ id: f.id, name: f.r.name, r: f.r }];
        if (want === 'a' || want === 'all' || want === 'everyone') return [{ me: true, name: myNameNet() }].concat(live.map(function (k) { return { id: k, name: R[k].name, r: R[k] }; }));
        return null;
    }
    // ⏱ "Teletransportándote con @Ana..." y a los 3 segundos se va (a donde esté Ana EN ESE MOMENTO)
    function tpToPlayerSoon(name, cmd, s) {
        say('[INFO] ' + tr('play_tp_wait', 'Teleporting you to @{name}... in 3 seconds!').replace('{name}', name));
        clearTimeout(S.tpWait);
        S.tpWait = setTimeout(function () {
            S.tpWait = 0;
            if (!S.playing || W().dead > 0) return;
            const f = findRemote(name);
            if (f) { cmd = '/tp ' + Number(f.r.tx) + ' ' + (-Number(f.r.ty)); s = Number(f.r.s) || 1; }
            if (s && s !== (mbwom.currentScene || 1) && !changeDim(s, 'cmd')) return;
            runCommand(cmd, { forced: true }); hud.dirty = true;
        }, TP_WAIT);
    }
    function onOthers(c, d, boss) {
        const at = OTHERS[d[0]]; if (!at || !S.mp) return false;
        const raw = c.split(/\s+/), tag = raw[at];
        if (!tag || tag[0] !== '@') return false;
        if (d[0] === 'tp' && raw.length === 2) return false;                 // (/tp @Ana solo: ir YO a donde está Ana)
        const T = targets(tag);
        if (!T) { say('[INFO] ' + tr('mpplay_tp_noone', 'There is no player called "{name}" in this game.').replace('{name}', tag.slice(1))); return true; }
        if (!boss && T.some(function (t) { return !t.me; })) { say('[INFO] ' + tr('play_cmd_others_host', 'Only the host can use commands on other players.')); return true; }
        const w = W(), sc = mbwom.currentScene || 1;
        let cmd = '', s = 0, dn = '';
        if (d[0] === 'tp') {
            if (d[2] === 'dimension' || d[2] === 'dim') cmd = '/tp dimension ' + (d[3] || '');
            else if (raw[2] && raw[2][0] === '@') {
                const D2 = targets(raw[2]);
                if (!D2 || D2.length !== 1) { say('[INFO] ' + tr('mpplay_tp_noone', 'There is no player called "{name}" in this game.').replace('{name}', raw[2].slice(1))); return true; }
                const t = D2[0];
                if (t.me) { cmd = '/tp ' + Number(w.worldX) + ' ' + (-Number(w.worldY)); s = sc; }
                else { cmd = '/tp ' + Number(t.r.tx) + ' ' + (-Number(t.r.ty)); s = Number(t.r.s) || 1; }
                dn = t.name;                                                  // (⏱ con otro jugador: aviso y 3 segundos de espera)
            } else {
                if (raw[2] == null || raw[3] == null) { say('[INFO] tp @player x y  ·  tp @player @player'); return true; }
                if (/~/.test(raw[2] + raw[3])) cmd = '/tp ' + raw[2] + ' ' + raw[3];   // (~ = desde donde está ese jugador)
                else {
                    const x = parseFloat(raw[2]), y = parseFloat(raw[3]);
                    if (isNaN(x) || isNaN(y)) { say('[INFO] Invalid location.'); return true; }
                    cmd = '/tp ' + x + ' ' + y; s = sc;                         // (en MI dimensión)
                }
            }
        } else if (d[0] === 'gamemode') cmd = '/gamemode ' + (raw[1] || '');
        else cmd = '/' + d[0] + (raw.length > 2 ? ' ' + raw.slice(2).join(' ') : '');
        T.forEach(function (t) {
            if (t.me) {
                if (dn) { if (dn !== myNameNet()) tpToPlayerSoon(dn, cmd, s); return; }
                if (s && s !== (mbwom.currentScene || 1) && !changeDim(s, 'cmd')) return;
                runCommand(cmd, { forced: true });
            } else mpSend({ tipo: 'juego_cmd', a: t.id, c: cmd, s: s, dn: dn, uid: myUidNet(), autor: myNameNet() });
        });
        const others = T.filter(function (t) { return !t.me; }).map(function (t) { return t.name; });
        if (others.length) say('[INFO] 👑 ' + tr('play_cmd_sent', '{cmd} → {names}').replace('{cmd}', cmd).replace('{names}', others.join(', ')));
        return true;
    }
    function runCommand(raw, opt) {
        opt = opt || {};
        const w = W();
        let c = String(raw || '').trim();
        if (c[0] === '/' || c[0] === '\\') c = c.slice(1);
        const d = c.toLowerCase().split(/\s+/).filter(Boolean);
        if (!d.length) return;
        if (d[0] === 'cls') { cmdLog.length = 0; chat.dirty = true; return; }
        // 🛡 /kick /ban /unban /banlist /mute /unmute: solo el anfitrión del servidor (scripts/mp-mod.js); no dependen de "Commands" del mundo
        if (window.MP_MOD_CMDS && window.MP_MOD_CMDS.indexOf(d[0]) >= 0 && typeof window.mpModCommand === 'function') { say('[INFO] ' + window.mpModCommand(d[0], c.split(/\s+/).slice(1).join(' '))); return; }
        // ↩ /back: todos lo pueden usar siempre (aunque no tengan permiso para comandos): volver a donde moriste
        if (d[0] === 'back') { doBack(); return; }
        // 👑 el anfitrión y Crystal: sin restricciones (también lo que el anfitrión manda hacer a otro jugador: opt.forced)
        const boss = !!opt.forced || roomHost() || isAdminMe();
        // 🎮 en una partida, por defecto SOLO el anfitrión puede usar comandos (él lo puede permitir en su menú de pausa)
        if (!boss && S.mp && !(window.mbwMpPlay && (mpHost() ? window.mbwMpPlay.allowCmds() : window.mbwMpPlay.guestCmds))) {   /* (también el invitado que empezó la partida) */ say('[INFO] ' + tr('mpplay_cmds_host', 'Only the host can use commands in this game.')); return; }
        // (el anfitrión de una partida siempre puede usar comandos, aunque el mundo los tenga apagados)
        if (!boss && !cheatsOn()) { say('[INFO] ' + tr('play_cheats_off', 'Commands are disabled in this world. Turn on "Commands" in World Settings (the game would not run them either).')); return; }
        const fb = gameRule('sendcommandfeedback') !== false;
        // (en una partida, lo que dice un comando también les sale a los demás, como en el juego: "[Ana: ...]")
        const info = (t) => { if (!fb) return; say('[INFO] ' + t); if (S.mp) mpSend({ tipo: 'juego_sys', autor: myNameNet(), k: 'cmd', t: String(t).slice(0, 200) }); };
        // 👑 comandos sobre OTRO jugador: /tp @Ana x y · /tp @Ana @me · /tp @a @me · /heal @Ana · /kill @Ana · /gamemode creative @Ana · /give @Ana item · /clear @Ana
        if (!opt.forced && onOthers(c, d, boss)) return;
        switch (d[0]) {
            case 'spectate': {
                // 👁 /spectate @jugador: tu cámara sigue a otro jugador (te pone en modo espectador). /spectate solo: dejar de seguir. Shift también.
                if (!d[1]) { if (S.spect) stopSpect(); else say('[INFO] spectate @player'); return; }
                const f = findRemote(c.split(/\s+/)[1]);
                if (!f) { say('[INFO] ' + (S.mp ? tr('mpplay_tp_noone', 'There is no player called "{name}" in this game.').replace('{name}', String(d[1]).replace(/^@/, '')) : tr('play_spect_solo', 'There are no other players here: /spectate works in a multiplayer game.'))); return; }
                if (f.r.s !== (mbwom.currentScene || 1) && !changeDim(f.r.s, 'spect')) return;
                if (w.gamemode != 3) { w.gamemode = 3; w.fly = true; document.body.classList.add('play-survival'); }
                S.spect = f.id; S.spectName = f.r.name;
                w.worldX = f.r.tx; w.worldY = f.r.ty; w.xSpeed = 0; w.ySpeed = 0; camSnap(); hud.dirty = true;
                info(tr('play_spect_now', 'Now spectating {name}. Press Shift (or /spectate) to stop.').replace('{name}', f.r.name)); return;
            }
            case 'tp': {
                // 🌀 /tp dimension overworld|nether|end
                if (d[1] === 'dimension' || d[1] === 'dim') {
                    const n = DIM_KEYS[d[2] || ''];
                    if (!n) { say('[INFO] tp dimension overworld|nether|end'); return; }
                    if ((mbwom.currentScene || 1) === n) { say('[INFO] ' + tr('play_dim_here', 'You are already in the {dim}.').replace('{dim}', dimName(n))); return; }
                    if (changeDim(n, 'cmd')) info('WHOOSH! ' + tr('play_dim_went', 'You are in the {dim} now.').replace('{dim}', dimName(n)));
                    return;
                }
                // 🎮 /tp @nombre: ir a donde está otro jugador de la partida
                if (d[1] && d[1][0] === '@') {
                    const want = c.split(/\s+/)[1].slice(1).toLowerCase();
                    const R = (S.mp && window.mbwMpPlay) ? window.mbwMpPlay.remotes : {};
                    const k = Object.keys(R || {}).find(function (q) { return String(R[q].name || '').toLowerCase() === want; });
                    if (!k) { say('[INFO] ' + tr('mpplay_tp_noone', 'There is no player called "{name}" in this game.').replace('{name}', want)); return; }
                    const r = R[k];
                    if (r.s !== (mbwom.currentScene || 1)) { if (!changeDimension(r.s)) { say('[INFO] ' + tr('mpplay_tp_dim', '{name} is in another dimension.').replace('{name}', r.name)); return; } }
                    d[1] = String(r.tx); d[2] = String(-r.ty);
                }
                const x = coord(d[1], 'x'), y = coord(d[2], 'y');
                if (isNaN(x) || isNaN(y) || x < -100 || x > 1e4 || y < -100 || y > 1e3) { say('[INFO] Invalid location.'); return; }
                w.worldX = x; w.worldY = -y; w.xSpeed = 0; w.ySpeed = 0; w.riding = '';
                if (S.p) { S.p.falling = S.p.wasFalling = false; S.p.wasFallingSpeed = 0; S.p.wasFallingAndNotFalling = 0; S.p.suffocate = 0; S.p.jumpTimer = 0; }
                S.mine = null;
                camSnap();
                info('WHOOSH! Teleported to x:' + Math.floor(100 * x) / 100 + ', y:' + Math.floor(100 * y) / 100); return;
            }
            case 'give': {
                const id = ident(d[1]); if (!id) { say('[INFO] "' + (d[1] || '') + '" is not a proper item ID.'); return; }
                let q = d[2] != null ? parseInt(d[2], 10) : 1; if (!(q >= 1 && q < 1e4)) q = 1;
                let dm = null; if (d[3] != null && bd(id, 'tool') == 1) { const n = parseInt(d[3], 10); dm = n < 0 ? (bd(id, 'life') - Math.abs(n)) | 0 : n; }
                addDrop(id, w.worldX, w.worldY, q, dm || 0, {}); if (S.drops.length) S.drops[S.drops.length - 1].age = 30;
                info('Gave ' + q + ' "' + d[1] + '".'); return;
            }
            case 'clear': {
                const list = inv(); let n = 0;
                if (d[1]) {
                    const id = ident(d[1]); if (!id) { say('[INFO] "' + d[1] + '" is not a proper item ID.'); return; }
                    let max = d[2] != null && parseInt(d[2], 10) >= 0 ? parseInt(d[2], 10) : Infinity;
                    for (let i = 0; i < 45 && n < max; i++) if (!isEmpty(list[i]) && list[i][0] === id) { const m = Math.min(list[i][1], max - n); list[i][1] -= m; n += m; if (list[i][1] <= 0) list[i] = empty(); }
                } else { for (let i = 0; i < 45; i++) if (!isEmpty(list[i])) { n += list[i][1]; list[i] = empty(); } }
                hud.dirty = true; info(n ? 'Cleared ' + n + ' item' + (n === 1 ? '' : 's') + '.' : 'No items were found.'); return;
            }
            case 'setblock': {
                if (d.length < 4) { say('[INFO] setblock block_type [~]x [~]y [replace|keep|destroy]'); return; }
                let id = d[1] === 'air' ? 'air' : ident(d[1]);
                if (!id || (id !== 'air' && bd(id, 'placeable') != 1)) { say('[INFO] "' + d[1] + '" is not a placeable block.'); return; }
                const x = Math.floor(coord(d[2], 'x')), y = Math.floor(coord(d[3], 'y'));
                if (isNaN(x) || isNaN(y)) { say('[INFO] Invalid location.'); return; }
                const mode = d[4] || 'replace';
                if (['keep', 'replace', 'destroy'].indexOf(mode) < 0) { say('[INFO] Expected [replace|keep|destroy].'); return; }
                if (mode === 'keep' && fg(x, y) !== 'air') { info('0 blocks set.'); return; }
                let st1; if (id === 'dtg') { id = 'dt'; st1 = 1; }
                if (mode === 'destroy') mineBlock(x, y, true);
                setBlock(x, y, id === 'air' ? null : id, st1);
                info('1 block set.'); return;
            }
            case 'fill': {
                if (d.length < 6) { say('[INFO] fill block_type [~]x [~]y width height'); return; }
                let id = d[1] === 'air' ? 'air' : ident(d[1]);
                if (!id || (id !== 'air' && bd(id, 'placeable') != 1)) { say('[INFO] "' + d[1] + '" is not a placeable block.'); return; }
                const x = Math.floor(coord(d[2], 'x')), y = Math.floor(coord(d[3], 'y')), ww = Math.floor(+d[4]), hh = Math.floor(+d[5]);
                if ([x, y, ww, hh].some(isNaN)) { say('[INFO] X2 and Y2 should be numeric.'); return; }
                if ((ww + 1) * (hh + 1) > 1e4) { say('[INFO] You may not involve more than a 10000-block region.'); return; }
                const mode = d[6] || 'replace', only = mode === 'replace' && d[7] ? ident(d[7]) : null;
                let st1; if (id === 'dtg') { id = 'dt'; st1 = 1; }
                let n = 0;
                for (let X = x; X < x + ww; X++) for (let Y = y; Y < y + hh; Y++) {
                    if (Y < 0) continue;
                    const edge = X === x || X === x + ww - 1 || Y === y || Y === y + hh - 1;
                    const here = fg(X, Y);
                    if (mode === 'keep' && here !== 'air') continue;
                    if (only && here !== only) continue;
                    if ((mode === 'hollow' || mode === 'hallow') && !edge) { setBlock(X, Y, null); continue; }
                    if (mode === 'outline' && !edge) continue;
                    if (mode === 'destroy') mineBlock(X, Y, true);
                    setBlock(X, Y, id === 'air' ? null : id, st1); n++;
                }
                info(n + ' block' + (n === 1 ? '' : 's') + ' filled.'); return;
            }
            case 'clone': {
                if (d.length < 7) { say('[INFO] clone [~]x1 [~]y1 width height [~]xDest [~]yDest'); return; }
                const x1 = Math.floor(coord(d[1], 'x')), y1 = Math.floor(coord(d[2], 'y')), ww = Math.floor(+d[3]), hh = Math.floor(+d[4]), x2 = Math.floor(coord(d[5], 'x')), y2 = Math.floor(coord(d[6], 'y'));
                if ([x1, y1, ww, hh, x2, y2].some(isNaN) || ww < 0 || hh < 0) { say('[INFO] Invalid coordinates.'); return; }
                if (ww * hh > 1e4) { say('[INFO] You may not involve more than a 10000-block region.'); return; }
                const filt = d[7] || 'replace', move = d[8] === 'move', mask = d[9] ? (d[9] === 'air' ? 'air' : ident(d[9])) : null;
                const copy = [];
                for (let X = x1; X < x1 + ww; X++) for (let Y = y1; Y < y1 + hh; Y++) {
                    if (Y < 0) continue;
                    const t = fg(X, Y);
                    if (filt === 'filtered' && t !== mask) continue;
                    if (filt === 'masked' && t === 'air') continue;
                    copy.push({ dx: X - x1, dy: Y - y1, s: JSON.parse(JSON.stringify(mbwom.getBlockState(X, Y))) });
                }
                if (move) copy.forEach(function (c2) { setBlock(x1 + c2.dx, y1 + c2.dy, null); });
                copy.forEach(function (c2) { const X = x2 + c2.dx, Y = y2 + c2.dy; if (Y < 0) return; mbwom.setBlockState(X, Y, c2.s); if (typeof window.renderBlock === 'function') window.renderBlock(X, Y); S.sandCheck.set(X + ',' + Y, S.tick + 2); });
                info(copy.length + ' block' + (copy.length === 1 ? '' : 's') + ' cloned'); return;
            }
            case 'summon': {
                const t0 = d[1] || ''; const t = MOB_ALIAS[t0] || t0;
                if (!D.mobs[t] || t === 'player') { say('[INFO] "' + t0 + '" is not a mob.'); return; }
                let q = 1; if (d[2] != null) { q = parseInt(d[2], 10); if (!(q >= 1 && q <= 20)) { say('[INFO] Quantity must a number from 1-20.'); return; } }
                let x = w.worldX, y = w.worldY;
                if (d.length >= 5) { const a = coord(d[3], 'x'), b = coord(d[4], 'y'); if (isNaN(a) || isNaN(b)) { say('[INFO] Invalid location.'); return; } x = a; y = -b; }
                for (let i = 0; i < q; i++) { const id = spawnMob(t, x, y, (t0 === 'cowctus' || t0 === 'mooshroom') ? { variant: t0 } : null); if (t === 'slime' || t === 'magmacube') { mbwom.mobs[id].size = 1 + (3 * Math.random() | 0); mbwom.mobs[id].health = maxHealth(mbwom.mobs[id]); } }
                info('Summoned ' + q + ' ' + t0 + (q === 1 ? '' : 's') + '.'); return;
            }
            case 'kill': w.dead = 1; info('O_O'); return;
            case 'heal': w.health = 20; hud.dirty = true; info('Health restored.'); return;
            case 'gamemode': {
                const v = d[1]; const g = (v === 'survival' || v === 's' || v === '0') ? 0 : (v === 'creative' || v === 'c' || v === '1') ? 1 : (v === 'adventure' || v === 'a' || v === '2') ? 2 : (v === 'spectator' || v === 'sp' || v === '3') ? 3 : -1;
                if (g < 0) { say('[INFO] gamemode survival|creative|adventure|spectator'); return; }
                w.gamemode = g; if (g === 3) w.fly = true; else if (g !== 1) w.fly = false;
                if (g !== 3) stopSpect(true);
                document.body.classList.toggle('play-survival', g != 1); hud.dirty = true;
                info('You are now in ' + ['survival', 'creative', 'adventure', 'spectator'][g] + ' mode.'); return;
            }
            case 'gamerule': {
                const rules = ['keepinventory', 'mobgriefing', 'dodaylightcycle', 'dofiretick', 'passivemobs', 'domobloot', 'sendcommandfeedback'];
                if (d.length !== 3 || rules.indexOf(d[1]) < 0) { say('[INFO] Unknown game rule.'); return; }
                if (!w.gameRules || typeof w.gameRules !== 'object') w.gameRules = {};
                w.gameRules[d[1]] = d[2] === 'true' || d[2] === '1';
                info(d[1] + ' = ' + w.gameRules[d[1]]); return;
            }
            case 'home': {
                const sp = spawnPoint();
                if (d[1] === 'set') {
                    if (d.length === 2) { spSet(w.worldX, w.worldY); info('Your home position has been set to your current position.'); return; }
                    const x = coord(d[2], 'x'), y = coord(d[3], 'y'); if (isNaN(x) || isNaN(y)) { say('[INFO] home <get|set [~]x [~]y>'); return; }
                    spSet(x, -y); info('Your home position has been set to x=' + Math.floor(100 * x) / 100 + ', y=' + Math.floor(100 * y) / 100 + '.'); return;
                }
                if (d[1] === 'get') { say('[INFO] Your current home position: x=' + Math.floor(sp.x * 100) / 100 + ', y=' + Math.floor(-sp.y * 100) / 100 + '.'); return; }
                w.worldX = sp.x; w.worldY = sp.y; w.xSpeed = 0; w.ySpeed = 0; camSnap(); info('Welcome home!'); return;
            }
            case 'explode': {
                const n = parseFloat(d[1]); if (!(n >= 1 && n <= 10)) { say('[INFO] Explosion size must be a number from 1 to 10.'); return; }
                if (d.length >= 4) { const x = coord(d[2], 'x'), y = coord(d[3], 'y'); if (isNaN(x) || isNaN(y)) { say('[INFO] X and Y should be numbers.'); return; } explode(Math.floor(x), Math.floor(y), n, PLAYER_ID); }
                else explode(Math.floor(w.worldX), Math.floor(-w.worldY), n, PLAYER_ID);
                return;
            }
            case 'say': { const m = String(raw).replace(/^[\/\\]?\s*say\s*/i, ''); say('[SAY] ' + m); if (S.mp) mpSend({ tipo: 'juego_sys', autor: myNameNet(), k: 'say', t: m.slice(0, 200) }); return; }
            case 'time': if (d[1] === 'set' && d[2] != null) { const v = d[2] === 'day' ? 0 : d[2] === 'night' ? 50 : Math.floor(+d[2] % 100); if (!isNaN(v)) { w.tim = v; info('Time set to ' + v + '.'); return; } } if (d[1] === 'get') { say('[INFO] The time is ' + (w.tim | 0) + '.'); return; } say('[INFO] time <get|set <t|day|night>>'); return;
            case 'weather': { const v = d[1] === 'set' ? d[2] : d[1]; const n = (v === 'clear' || v === '0') ? 0 : (v === 'rain' || v === '1') ? 1 : (v === 'thunder' || v === '2') ? 2 : -1; if (n < 0) { say('[INFO] weather <get|set <clear|rain|thunder>>'); return; } w.raining = n; if (typeof setWeatherEffect === 'function') { try { setWeatherEffect(['clear', 'rain', 'thunder'][n]); } catch (e) { /* nada */ } } info('Weather set to ' + ['clear', 'rain', 'thunder'][n] + '.'); return; }
            case 'difficulty': { if (['peaceful', 'easy', 'normal', 'hard'].indexOf(d[1]) < 0) { say('[INFO] difficulty peaceful|easy|normal|hard'); return; } w.difficulty = d[1]; info('Difficulty set to ' + d[1] + '.'); return; }
            case 'xp': { let v = d[1] === 'add' ? d[2] : d[1]; if (v == null) { say('[INFO] xp [add] value[L]'); return; } v = /l$/.test(v) ? 100 * parseFloat(v) : parseFloat(v); if (isNaN(v)) { say('[INFO] xp [add] value[L]'); return; } w.experience = Math.max(0, Math.min(1e6, Math.floor((d[1] === 'add' ? (w.experience || 0) : 0) + v))); info('experience set to ' + w.experience + '.'); return; }
            case 'help': say('[INFO] tp give clear setblock fill clone summon kill heal gamemode gamerule home explode say time weather difficulty xp back'); if (S.mp && boss) say('[INFO] ' + tr('play_cmd_others_help', 'On other players: /tp @name x y · /tp @name @me · /tp @a @me · /heal @name · /kill @name · /gamemode creative @name · /give @name item · /clear @name')); return;
            default: say('[INFO] Command not recognised: ' + d[0]);
        }
    }
    function useCommandBook() {
        const it = selItem();
        if (!it || it[0] !== 'cbook') return false;
        const ex = it[3] || {};
        if (typeof ex.command !== 'string' || !ex.command.trim()) { say('[INFO] This Command Book has no command.'); return true; }
        try { runCommand(ex.command); } catch (e) { say('[INFO] Error: ' + e.message); }
        if (ex.uses != null && W().gamemode != 1) {
            if (ex.uses > 0) ex.uses -= 1;
            if (ex.uses === 0) inv()[selIndex()] = empty();
            hud.dirty = true;
        }
        return true;
    }
    window.mbwPlayCommand = runCommand;

    // ------------------------------------------------------------------ cofres y hornos (abrir)
    const BOX = { chest: 1, oven: 1, dispense: 1, dropper: 1, enchant: 1, craft: 1, brew: 1, anvil: 1, echest: 1 };
    // el aviso de abajo: "Doble clic para abrir el cofre" (en el celular, "Toca dos veces..."), según el bloque bajo el cursor
    function boxLabel(t) {
        const touch = document.body.classList.contains('is-touch');
        const what = t === 'craft' ? tr('play_box_craft', 'the crafting table') : t === 'brew' ? tr('play_box_brew', 'the brewing stand') : t === 'anvil' ? tr('play_box_anvil', 'the anvil') : t === 'echest' ? tr('play_box_echest', 'the ender chest') : t === 'enchant' ? tr('play_box_enchant', 'the enchantment table') : t === 'oven' ? tr('play_box_furnace', 'the furnace') : t === 'dispense' ? tr('play_box_dispenser', 'the dispenser') : t === 'dropper' ? tr('play_box_dropper', 'the dropper') : tr('play_box_chest', 'the chest');
        return (touch ? tr('play_dbl_tap_open', 'Double-tap to open {what}') : tr('play_dbl_click_open', 'Double-click to open {what}')).replace('{what}', what);
    }
    function openBox(x, y) {
        const t = fg(x, y);
        let ok = false;
        if (t === 'chest' && typeof window.openChestEditor === 'function') ok = window.openChestEditor(x, y);
        else if (t === 'oven' && typeof window.openFurnaceEditor === 'function') ok = window.openFurnaceEditor(x, y);
        else if ((t === 'dispense' || t === 'dropper') && typeof window.openDispenserEditor === 'function') ok = window.openDispenserEditor(x, y);
        else if (t === 'enchant') ok = openEnchant(x, y);
        else if (t === 'craft' && typeof window.openCraftingTable === 'function') ok = window.openCraftingTable(x, y);   // 🛠 mesa de crafteo: 3×3
        else if (t === 'brew' && typeof window.openBrewingStand === 'function') ok = window.openBrewingStand(x, y);   // 🧪 soporte de pociones
        else if (t === 'anvil' && typeof window.openAnvil === 'function') ok = window.openAnvil(x, y);                 // ⚒ yunque
        else if (t === 'echest' && typeof window.openEnderChest === 'function') { ok = window.openEnderChest(x, y); if (ok) sndAt('chestopen', x + .5, -(y + .5)); }   // 🟪 cofre de ender
        if (ok) {
            S.keys = {}; S.mouse.left = S.mouse.right = false; S.mine = null; S.openBoxAt = { x: x, y: y };
            // el último clic (o toque) del doble clic cae sobre la ventana que se acaba de abrir: ese no cuenta (si no, tomaba un objeto)
            const until = performance.now() + 450;
            const eat = function (e) { if (performance.now() > until) { off(); return; } e.stopImmediatePropagation(); e.preventDefault(); };
            const names = ['pointerup', 'mouseup', 'click', 'dblclick', 'touchend', 'contextmenu'];
            const off = function () { names.forEach(function (n) { window.removeEventListener(n, eat, true); }); };
            names.forEach(function (n) { window.addEventListener(n, eat, true); });
            setTimeout(off, 500);
        }
        return ok;
    }
    function findBox() {                                             // el cofre / horno bajo el mouse (si está al alcance) o el más cercano
        const w = W();
        if (S.mouse.inside) { const mw = mouseWorld(); const bx = Math.floor(mw.x), by = Math.floor(mw.y); if (BOX[fg(bx, by)] && blockDist(bx, by) <= REACH + 1) return { x: bx, y: by, t: fg(bx, by) }; }
        const px = Math.floor(w.worldX), py = Math.floor(-w.worldY);
        let best = null, bdst = Infinity;
        for (let x = px - REACH; x <= px + REACH; x++) for (let y = py - REACH; y <= py + REACH + 2; y++) {
            const t = fg(x, y); if (!BOX[t]) continue;
            const dd = blockDist(x, y); if (dd <= REACH + 1 && dd < bdst) { bdst = dd; best = { x: x, y: y, t: t }; }
        }
        return best;
    }
    function modalOpen() {
        if (S.paused) return true;                                   // ⏸ con el menú de pausa abierto no se mueve el Player
        // (solo cuenta si de verdad se ve: una ventana abierta pero escondida dejaba al Player congelado)
        const shown = function (el) { return !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none'); };
        const m = document.getElementById('inventory-modal');
        if (m && m.style.display === 'block' && shown(m)) return true;
        if (S.ench) return true;
        const cb = document.getElementById('command-book-modal');
        return !!(cb && cb.style.display && cb.style.display !== 'none' && shown(cb));
    }

    // ✨ MESA DE ENCANTAMIENTOS ("enchant"), como el juego (Inventory.arrange / buyEnchant y Game.enchant):
    //   · eliges un objeto de tu inventario que se pueda encantar (herramienta, arma, armadura, arco, caña, libro o poción)
    //   · salen 3 opciones con palabras al azar y su costo en niveles; más libreros (Bookshelf) cerca = opciones más caras y mejores
    //   · al pagar (100 de experiencia por nivel; en creativo no cuesta) el juego reparte encantamientos al azar que quepan en esos niveles
    //   · libro → libro encantado · poción → Bottle o' Enchanting (10 niveles)
    const ENCH_WORDS = 'wind earth mind time energy evolve twist rise spark sense focus ether war shadow freeze zanz notch jeb ghostid jawn igp mcman dekdev adee weasel'.split(' ');
    const ENCH_BOOK_TYPES = ['Caps', 'Shirts', 'Pants', 'Shoes', 'Swords', 'Axes', 'Pickaxes', 'Shovels', 'Shears', 'FishingRods', 'Bows'];
    function enchTypeOf(id) { if (id === 'book') return 'Random'; return (D.enchItems || {})[id] || null; }
    function hasEnch(it) { const ex = it && it[3]; return !!(ex && typeof ex === 'object' && Object.keys(ex).some(function (k) { return ex[k] === 'enchant'; })); }
    function enchantable(it) { if (!it || isEmpty(it)) return false; if (it[0] === 'potion') return true; return !!enchTypeOf(it[0]) && !hasEnch(it); }
    function bookshelvesNear(x, y) { let n = 0; for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) if (fg(x + dx, y + dy) === 'books') n++; return Math.min(15, n); }
    function enchArrange(books, potion) {
        let c = Math.floor(8 * Math.random()) + 1 + Math.floor(books / 2) + Math.floor(Math.random() * (books + 1));
        const d = Math.floor(Math.max(c / 3, 1)), f = Math.floor(2 * c / 3 + 1);
        c = Math.floor(Math.max(c, 2 * books));
        const words = function () { let t = ''; const n = Math.floor(2 * Math.random()) + 3; for (let i = 0; i < n; i++) t += ENCH_WORDS[Math.random() * ENCH_WORDS.length | 0] + ' '; return t.trim(); };
        if (potion) return [{ lvl: 10, text: words() }];
        return [{ lvl: d, text: words() }, { lvl: f, text: words() }, { lvl: c, text: words() }];
    }
    // Game.enchant: reparte encantamientos al azar que quepan en "lvl" niveles
    function enchRoll(type, lvl) {
        const T = D.enchTypes || {};
        if (type === 'Random') type = ENCH_BOOK_TYPES[Math.random() * ENCH_BOOK_TYPES.length | 0];
        const table = T[type]; if (!table) return {};
        const keys = Object.keys(table), got = {}, fam = {};
        let f = lvl;
        for (let g = 0; g < 16 && f >= 1; g++) {
            let k = 0, B = '';
            for (let M = 0; M < 6; M++) {
                const m = keys[Math.random() * keys.length | 0], cost = table[m], fm = m.slice(0, -1);
                const clash = (m === 'silkTouch' && fam.fortune != null) || (m.slice(0, 7) === 'fortune' && got.silkTouch != null) || (m.slice(0, 11) === 'frostWalker' && fam.depthStride != null) || (m.slice(0, 12) === 'depthStrider' && fam.frostWalke != null);
                if (cost <= f && cost > k && fam[fm] == null && !clash) { k = cost; B = m; }
            }
            if (!B) continue;                                          // (esta vuelta no tocó ninguno que cupiera: se intenta otra vez)
            got[B] = k; fam[B.slice(0, -1)] = k; f -= k;
        }
        return got;
    }
    function enchLabel(k) { try { if (typeof mbwEnchLabel === 'function') return mbwEnchLabel(k); } catch (e) { /* nada */ } return k; }
    function openEnchant(x, y) {
        closeModals();
        S.ench = { x: x, y: y, slot: -1, opts: [], books: bookshelvesNear(x, y) };
        let el = document.getElementById('play-enchant');
        if (!el) {
            el = document.createElement('div'); el.id = 'play-enchant'; el.className = 'pe-overlay';
            el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
            el.addEventListener('click', function (e) { e.stopPropagation(); });
            document.body.appendChild(el);
        }
        el.style.display = 'flex';
        drawEnchant();
        return true;
    }
    function closeEnchant() { S.ench = null; const el = document.getElementById('play-enchant'); if (el) el.style.display = 'none'; hud.dirty = true; }
    function drawEnchant() {
        const el = document.getElementById('play-enchant'); if (!el || !S.ench) return;
        const E = S.ench, w = W(), list = inv(), lv = Math.floor((Number(w.experience) || 0) / 100), crea = w.gamemode == 1;
        const mk = function (tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
        el.textContent = '';
        const box = mk('div', 'pe-box'); el.appendChild(box);
        const head = mk('div', 'pe-head'); head.appendChild(mk('span', 'pe-title', tr('play_enchant_title', 'Enchantment Table')));
        const x = mk('button', 'pe-x', '✕'); x.type = 'button'; x.addEventListener('click', closeEnchant); head.appendChild(x);
        box.appendChild(head);
        const body = mk('div', 'pe-body'); box.appendChild(body);
        // izquierda: el objeto elegido + niveles + libreros
        const left = mk('div', 'pe-left'); body.appendChild(left);
        const slot = mk('div', 'pe-slot');
        const it = E.slot >= 0 ? list[E.slot] : null;
        if (it && !isEmpty(it)) { const c = iconFor(it[0], it[3]); const cv = mk('canvas'); cv.width = 16; cv.height = 16; cv.getContext('2d').drawImage(c, 0, 0); slot.appendChild(cv); slot.title = itemDisplayName(it); }
        left.appendChild(slot);
        left.appendChild(mk('div', 'pe-info', tr('play_enchant_levels', 'Your levels: {n}').replace('{n}', crea ? '∞' : lv)));
        left.appendChild(mk('div', 'pe-info', '📚 ' + tr('play_enchant_books', 'Bookshelves: {n}').replace('{n}', E.books)));
        // derecha: las 3 opciones
        const right = mk('div', 'pe-opts'); body.appendChild(right);
        if (E.slot < 0) right.appendChild(mk('div', 'pe-hint', tr('play_enchant_pick', 'Pick an item from your inventory below.')));
        E.opts.forEach(function (o, i) {
            const can = crea || lv >= o.lvl;
            const b = mk('button', 'pe-opt' + (can ? '' : ' no')); b.type = 'button';
            b.appendChild(mk('span', 'pe-words', o.text));
            b.appendChild(mk('span', 'pe-lvl', String(o.lvl)));
            b.title = can ? tr('play_enchant_cost', 'Costs {n} levels').replace('{n}', o.lvl) : tr('play_enchant_need', 'You need {n} levels').replace('{n}', o.lvl);
            if (can) b.addEventListener('click', function () { buyEnchant(i); });
            else b.disabled = true;
            right.appendChild(b);
        });
        // abajo: los objetos del inventario que se pueden encantar
        const grid = mk('div', 'pe-inv'); box.appendChild(grid);
        let any = false;
        for (let i = 0; i < 45; i++) {
            const q = list[i]; if (!enchantable(q)) continue; any = true;
            const s2 = mk('button', 'pe-it' + (i === E.slot ? ' sel' : '')); s2.type = 'button';
            const cv = mk('canvas'); cv.width = 16; cv.height = 16; cv.getContext('2d').drawImage(iconFor(q[0], q[3]), 0, 0); s2.appendChild(cv);
            if ((q[1] | 0) > 1) s2.appendChild(mk('span', 'pe-n', String(q[1])));
            s2.title = itemDisplayName(q);
            s2.addEventListener('click', function () { E.slot = i; E.opts = enchArrange(E.books, q[0] === 'potion'); drawEnchant(); });
            grid.appendChild(s2);
        }
        if (!any) grid.appendChild(mk('div', 'pe-hint', tr('play_enchant_none', 'Nothing to enchant: tools, weapons, armor, bows, fishing rods, books or potions (without enchantments).')));
        if (E.done) { box.appendChild(mk('div', 'pe-done', E.done)); }
    }
    function buyEnchant(i) {
        const E = S.ench; if (!E || E.slot < 0) return;
        const w = W(), list = inv(), it = list[E.slot], o = E.opts[i];
        if (!it || !o || !enchantable(it)) return;
        const crea = w.gamemode == 1, lv = Math.floor((Number(w.experience) || 0) / 100);
        if (!crea && lv < o.lvl) return;
        // (de una pila de libros o pociones se encanta solo uno)
        let target = it;
        if ((it[1] | 0) > 1 && (it[0] === 'book' || it[0] === 'potion')) { it[1] = (it[1] | 0) - 1; target = [it[0], 1, it[2] || 0, {}]; }
        if (target[0] === 'potion') {
            if (!crea) w.experience = Math.floor(Math.max(0, (Number(w.experience) || 0) - 1000));
            target[0] = 'boe'; target[3] = {};
            E.done = '✨ ' + itemDisplayName(target);
        } else {
            const type = enchTypeOf(target[0]);
            if (target[0] === 'book') target[0] = 'ebook';
            if (!crea) w.experience = Math.floor(Math.max(0, (Number(w.experience) || 0) - 100 * o.lvl));
            const got = enchRoll(type, o.lvl);
            if (!target[3] || typeof target[3] !== 'object' || Array.isArray(target[3])) target[3] = {};
            Object.keys(got).forEach(function (k) { target[3][k] = 'enchant'; });
            ach(45);
            E.done = '✨ ' + Object.keys(got).map(enchLabel).join(', ');
        }
        if (target !== it && addToInventory(target[0], 1, target[2], target[3]) > 0) addDrop(target[0], w.worldX, w.worldY - .5, 1, target[2], target[3]);
        E.slot = -1; E.opts = [];
        sndAt('levelup');
        hud.dirty = true;
        try { if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh(); } catch (e) { /* nada */ }
        drawEnchant();
    }
    window.mbwPlay.enchant = { open: openEnchant, close: closeEnchant, roll: enchRoll, arrange: enchArrange, state: function () { return S.ench; } };

    // =====================================================================
    // 🌙 DÍA Y NOCHE · 🛏 CAMAS · 🌾 CULTIVOS · 🔥 MECHERO Y FUEGO · 🎣 PESCA · 🧪 SOPORTE DE POCIONES · 🐄 CRÍAS Y LECHE · 🛶 BALSAS · 🚃 VAGONETAS
    // Del código decompilado de Mine Blocks 2.0.0: Game.onCertainInterval (la hora sube 1 cada 12 s: 0 a 99, de 50 en adelante es de noche;
    // cultivos: cada 12 s, 1 de 10 sube de etapa hasta 7; soporte de pociones: recetas de Game.potionData, polvo de blaze = 20 usos),
    // Game.mineAndPlaceCode (dormir, mechero, ordeñar, criar, balsa, vagoneta), Entity_Mob.run (crías: 5 s juntos y sale la cría, que tarda
    // 20 minutos en crecer). APROXIMADO (no viene en el código decompilado): la pesca (Entity_Bobber), cómo se extiende el fuego y cómo
    // se mueven la balsa y la vagoneta.
    // =====================================================================
    const DAY_TICKS = (300 * FPS / 25) | 0;
    function tickTime() {
        if (mpGuest() || S.tick % DAY_TICKS !== 0 || gameRule('dodaylightcycle') === false) return;
        const w = W();
        w.tim = (Number(w.tim) || 0) + 1;
        if (w.tim >= 100) { w.tim = 0; w.day = (Number(w.day) || 0) + 1; }
    }
    // qué tan oscura es la noche (0 = de día); la usa scripts/darkness.js
    function nightAlpha() {
        if (!S.playing || (mbwom.currentScene || 1) !== 1) return 0;
        const t = Number(W().tim) || 0;
        const N = 0.62;
        let a = t < 42 ? 0 : t < 52 ? N * (t - 42) / 10 : t < 92 ? N : N * (100 - t) / 8;
        a += (Number(W().raining) || 0) * 0.08;
        return Math.max(0, Math.min(.75, a));
    }
    window.mbwPlay.nightAlpha = nightAlpha;
    window.mbwPlay.dayFrac = function () { return gameRule('dodaylightcycle') === false ? 0 : (S.tick % DAY_TICKS) / DAY_TICKS; };   // ☀️ (lo que va de la hora actual: main.js mueve el sol)
    window.mbwPlay.setTime = function (t) { W().tim = Math.max(0, Math.min(99, Math.floor(Number(t) || 0))); };

    // ---------------------------------------------------------------- 🛏 dormir
    function useBed(x, y, t) {
        const w = W();
        if ((mbwom.currentScene || 1) !== 1) { explode(x, y, 5, null); return true; }     // (en el Nether y el End la cama explota)
        if ((Number(w.tim) || 0) < 50) { flashMsg(tr('play_bed_day', 'You can only sleep at night!')); say('[INFO] ' + tr('play_bed_day', 'You can only sleep at night!')); return true; }
        if (S.sleep) return true;
        const hx = t === 'bed2' ? x - 1 : x;
        spSet(hx + 1, -(y + 1));                                       // la cama es tu nuevo lugar para aparecer
        S.sleep = { t: 0, x: hx + 1, y: y, back: { x: w.worldX, y: w.worldY } };
        w.worldX = hx + 1; w.worldY = -(y + .55);                       // 🛏 acostado en la cama
        w.xSpeed = 0; w.ySpeed = 0; S.keys = {};
        info2(tr('play_bed_spawn', 'Respawn point set.'));
        return true;
    }
    function info2(t) { flashMsg(t); }
    function tickSleep() {
        if (!S.sleep) return;
        S.keys = {};
        if (++S.sleep.t < 4 * FPS) return;
        const sl = S.sleep;
        S.sleep = null;
        const w = W();
        if (sl.back) { w.worldX = sl.back.x; w.worldY = sl.back.y; } else { w.worldX = sl.x; w.worldY = -(sl.y + 1); }   // (se levanta donde estaba parado)
        if (S.p) S.p.falling = true;
        S.wake = performance.now();                                    // ☀ la pantalla se aclara poco a poco
        if (mpGuest()) mpSend({ tipo: 'juego_tiempo', tim: 2 });
        w.tim = 2; w.day = (Number(w.day) || 0) + 1;
        flashMsg('☀ ' + tr('play_good_morning', 'Good morning!'));
        ach(26);
        hud.dirty = true;
    }

    // ---------------------------------------------------------------- 🌾 cultivos
    const CROPS = { seed: 1, carrot: 1, potato: 1, bseed: 1, wseed: 1, pseed: 1, nw: 1 };
    function cropStage(x, y) { const v = mbwom.wheat && mbwom.wheat[key(x, y)]; return Number(v) || 0; }
    function setCrop(x, y, n) {
        const s = mbwom.getBlockState(x, y); if (!s || !s.type) return;
        s.wheat = n; mbwom.setBlockState(x, y, s);
        if (typeof window.renderBlock === 'function') window.renderBlock(x, y);
    }
    window.mbwPlay.cropStage = cropStage;
    function tickCrops() {
        if (mpGuest() || S.tick % DAY_TICKS !== 7) return;
        const Wh = mbwom.wheat; if (!Wh || typeof Wh !== 'object') return;
        Object.keys(Wh).forEach(function (k) {
            const m = /^blockX(-?\d+)Y(-?\d+)$/.exec(k); if (!m) return;
            const x = +m[1], y = +m[2], t = fg(x, y);
            if (!CROPS[t]) { delete Wh[k]; return; }
            if (simFar(x + .5)) return;
            if ((10 * Math.random() | 0) !== 1) return;
            const n = Number(Wh[k]) || 0;
            if (n < 7) { setCrop(x, y, n + 1); if (n + 1 === 7 && nearMe(x + .5, -y, 24)) ach(23); return; }
            if ((t === 'wseed' || t === 'pseed') && Math.random() < 1 / 3) growFruit(x, y, t === 'wseed' ? 'mel' : 'pk');
        });
    }
    // el tallo de sandía / calabaza ya grande: pone la fruta al lado (en tierra o tierra arada)
    function growFruit(x, y, fruit) {
        const s = Number(st(x, y)) || 0;
        if ((s === 1 && fg(x + 1, y) === fruit) || (s === -1 && fg(x - 1, y) === fruit)) return;
        const soil = (xx) => { const b = fg(xx, y - 1); return b === 'dt' || b === 'farm'; };
        let p = fg(x - 1, y) !== 'air' ? 1 : fg(x + 1, y) !== 'air' ? -1 : (Math.random() < .5 ? 1 : -1);
        if (fg(x + p, y) !== 'air' || !soil(x + p)) { p = -p; if (fg(x + p, y) !== 'air' || !soil(x + p)) return; }
        const cur = mbwom.getBlockState(x, y); cur.states1 = p; mbwom.setBlockState(x, y, cur);
        setBlock(x + p, y, fruit);
    }
    // lo que suelta un cultivo grande (además de su semilla). B = suerte (fortuna): no incluida
    function cropDrops(t, n, x, y) {
        const X = x + .5, Y = -y - .5, B = 0, r3 = () => (3 * Math.random() + (Math.random() * (B + 1) | 0)) | 0;
        if (t === 'seed') { if (n === 7) { addDrop('wheat', X, Y, 1, 0, {}); if (r3() >= 2) addDrop('seed', X, Y, 1, 0, {}); if (r3() >= 2) addDrop('seed', X, Y, 1, 0, {}); } return; }
        const ripe = n === 7 || (n === 6 && r3() >= 2);
        if (!ripe) return;
        if (t === 'carrot') addDrop('carrot', X, Y, 1, 0, {});
        else if (t === 'potato') { if (Math.random() < .2) addDrop('ppotato', X, Y, 1, 0, {}); addDrop('potato', X, Y, r3() + 1, 0, {}); }
        else if (t === 'nw') addDrop('nw', X, Y, r3() + 1, 0, {});
        else if (t === 'bseed') addDrop('beet', X, Y, (4 * Math.random() | 0) + 1, 0, {});
    }
    // 🦴 harina de hueso (Game.useBonemeal): retoño → árbol, hongo → hongo gigante, cultivo → listo para cosechar,
    // pasto o arena → plantas alrededor (flores, pasto alto, cactus...), agua → algas en el fondo
    const airUp = (x, y, n) => { for (let i = 1; i <= n; i++) if (fg(x, y + i) !== 'air') return false; return true; };
    function useBonemeal(x, y) {
        const t = fg(x, y);
        if (t === 'sl') {
            if (fg(x, y - 1) !== 'dt' || !airUp(x, y, 7)) return false;
            growTree(x, y, false); growParts(x, y);
            return true;
        }
        if (t === 'ms1' || t === 'ms2') {
            const b = fg(x, y - 1);
            if ((b !== 'dt' && b !== 'myc') || !airUp(x, y, 5)) return false;
            giantMushroom(x, y, t === 'ms1' ? 1 : 2); growParts(x, y);
            return true;
        }
        if (CROPS[t] && t !== 'nw') { if (cropStage(x, y) === 7) return false; setCrop(x, y, 7); ach(23); growParts(x, y); return true; }
        const grass = (X, Y) => fg(X, Y) === 'dt' && Number(st(X, Y)) === 1;
        if (grass(x, y) || t === 'sd') {
            const r = (n) => (Math.random() * n | 0) === 0;
            for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) {
                const X = x + dx, Y = y + dy;
                if (fg(X, Y + 1) !== 'air' || r(3)) continue;
                if (grass(X, Y)) {
                    setBlock(X, Y + 1, r(30) ? 'sl' : r(30) ? 'sc' : r(5) ? 'fw1' : r(5) ? 'fw2' : r(5) ? 'shrub' : r(15) ? 'ms1' : r(15) ? 'ms2' : 'lgr');
                } else if (fg(X, Y) === 'sd') {
                    const L = fg(X - 1, Y + 1), R = fg(X + 1, Y + 1);
                    if (r(5)) { if (L === 'air' && R === 'air') setBlock(X, Y + 1, 'ct'); }
                    else if (L !== 'ct' && R !== 'ct') setBlock(X, Y + 1, r(3) ? 'shrub' : 'ds');
                }
            }
            growParts(x, y + 1);
            return true;
        }
        if (t === 'wr' && fullLiq(x, y)) {
            for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) {
                const X = x + dx, Y = y + dy, g = fg(X, Y);
                if ((g !== 'sd' && g !== 'dt') || fg(X, Y + 1) !== 'wr' || !fullLiq(X, Y + 1)) continue;
                if (bd(fg(X - 1, Y), 'waterWalkThroughBlock') == 1 || bd(fg(X + 1, Y), 'waterWalkThroughBlock') == 1 || Math.random() < 1 / 3) continue;
                setBlock(X, Y + 1, 'sw');
            }
            growParts(x, y);
            return true;
        }
        return false;
    }
    // 🌳 Game.makeTree: tronco de 5 (o 6) y copa de hojas (a veces con manzanas, naranjas o limones; el dorado, manzanas doradas)
    function growTree(x, y, gold) {
        setBlock(x, y, 'wd1');
        ach(10);
        const f = Math.random() * 23 | 0;
        const fruit = gold ? 'lv3' : f < 13 ? 'lv' : f < 16 ? 'lv1' : f < 20 ? 'lv2' : 'lv4';
        const put = (X, Y, t) => { const h = fg(X, Y); if (h === 'air' || h === 'sl' || h === 'gasd' || h.substr(0, 2) === 'lv') setBlock(X, Y, t); };
        for (let i = 0; i <= 4; i++) put(x, y + i, 'wd1');
        const big = (Math.random() * 2 | 0) === 0;
        if (big) put(x, y + 5, 'wd1');
        const L = big ? [[-2, 3], [0, 3], [-2, 4], [0, 4], [-3, 4], [1, 4], [-4, 5], [-3, 5], [-2, 5], [0, 5], [1, 5], [2, 5], [-1, 6], [-2, 6], [-3, 6], [-4, 6], [0, 6], [1, 6], [2, 6], [-1, 7], [-2, 7], [-3, 7], [0, 7], [1, 7], [-1, 8], [-2, 8], [0, 8]]
            : [[-2, 3], [0, 3], [-2, 4], [0, 4], [-3, 4], [1, 4], [-2, 5], [-3, 5], [-1, 5], [0, 5], [1, 5], [-1, 6], [0, 6], [-2, 6]];
        L.forEach(function (q) { const X = x + 1 + q[0], Y = y + q[1]; if (fg(X, Y) === 'air') put(X, Y, (Math.random() * 4 | 0) === 1 ? fruit : 'lv'); });
    }
    // 🍄 Game.makeGiantMushroom
    function giantMushroom(x, y, kind) {
        const c = kind === 1 ? [['msb4', 0, 0], ['msb4', 0, 1], ['msb4', 0, 2], ['msb4', 0, 3], ['msb4', 0, 4], ['msb3', 0, 5], ['msb3', 1, 5], ['msb3', 2, 5], ['msb3', 3, 5], ['msb3', -1, 5], ['msb3', -2, 5], ['msb3', -3, 5]]
            : [['msb2', 0, 0], ['msb2', 0, 1], ['msb2', 0, 2], ['msb2', 0, 3], ['msb2', 0, 4], ['msb1', 0, 5], ['msb1', 1, 5], ['msb1', 2, 5], ['msb1', -1, 5], ['msb1', -2, 5], ['msb1', -3, 4], ['msb1', 3, 4], ['msb1', -3, 3], ['msb1', 3, 3], ['msb1', -3, 2], ['msb1', 3, 2]];
        setBlock(x, y, kind === 1 ? 'msb4' : 'msb2');
        c.forEach(function (q) { const X = x + q[1], Y = y + q[2] - 1; if (fg(X, Y) === 'air') setBlock(X, Y, q[0]); });
    }
    // 🌱 los retoños crecen solos (Game: cada ~6 s, 1 entre 70 cada uno; sobre tierra, con 7 de aire arriba). Solo cerca de los jugadores.
    function tickSaplings() {
        if (mpGuest() || S.tick % ((156 / 25 * FPS) | 0) !== ((45 / 25 * FPS) | 0)) return;
        const xs = (S.simX && S.simX.length) ? S.simX : [W().worldX];
        const seen = new Set();
        xs.forEach(function (px) {
            for (let x = Math.floor(px) - 48; x <= Math.floor(px) + 48; x++) {
                if (seen.has(x)) continue; seen.add(x);
                const col = mbwom.scene && mbwom.scene[x]; if (!col) continue;
                for (let y = 1; y < col.length; y++) {
                    const t = fg(x, y);
                    if (t !== 'sl' && t !== 'gasd') continue;
                    if ((Math.random() * 70 | 0) !== 1 || !airUp(x, y, 7)) continue;
                    const b = fg(x, y - 1);
                    if (t === 'sl' && b !== 'dt' && b !== 'cdt') continue;
                    if (t === 'gasd') { if (b === 'gb') setBlock(x, y - 1, 'gdt'); else if (b === 'gdt') setBlock(x, y - 1, 'dt'); else continue; }
                    growTree(x, y, t === 'gasd');
                }
            }
        });
    }
    function growParts(x, y) { for (let i = 0; i < 6; i++) addPart({ x: x + Math.random(), y: y + Math.random(), vy: .01, life: 30, size: .1, col: '#7dff6a', glow: true }); }
    // 🪓 azadón: la tierra (o el pasto) con aire arriba se vuelve tierra arada
    function useHoe(x, y) {
        const t = fg(x, y);
        if ((t !== 'dt' && t !== 'cdt') || fg(x, y + 1) !== 'air') return false;
        setBlock(x, y, 'farm');
        sndAt('crunch' + ((Math.random() * 3 | 0) + 1), x + .5, -(y + .5));
        damageTool();
        return true;
    }

    // ---------------------------------------------------------------- 🔥 mechero y fuego
    function canBeOnFire(x, y) { const t = fg(x, y); return t === 'n' || t === 'magma' || bd(t, 'flammable') == 1; }
    function canFireExistAt(x, y) { const t = fg(x, y); if (t !== 'air' && t !== 'fire') return false; return canBeOnFire(x - 1, y) || canBeOnFire(x + 1, y) || canBeOnFire(x, y - 1) || canBeOnFire(x, y + 1); }
    function putFire(x, y) { if (fg(x, y) !== 'air') return false; setBlock(x, y, 'fire'); S.fires.add(key(x, y)); sndAt('fire1', x + .5, -(y + .5)); return true; }
    function useFlint(mw, bx, by) {
        const mid = mobUnderMouse(mw);
        if (mid) { tmpOf(mid).onFire = 8 * FPS; damageTool(); return true; }
        if (blockDist(bx, by) > REACH + 1) return false;
        const P = (x, y) => fg(x, y) === 'portalstone';
        if (canFireExistAt(bx, by) || (fg(bx, by) === 'air' && P(bx, by - 1))) {
            // 🌀 marco de piedra del portal (2 de ancho): se prende el portal al Nether
            if (P(bx, by - 1) && P(bx + 1, by - 1) && P(bx + 2, by - 1) && P(bx + 2, by) && P(bx - 1, by - 1) && P(bx - 1, by) && fg(bx + 1, by) === 'air') { setBlock(bx, by, 'portal'); setBlock(bx + 1, by, 'portal'); damageTool(); ach(31); return true; }
            if (P(bx, by - 1) && P(bx - 1, by - 1) && P(bx - 2, by - 1) && P(bx - 2, by) && P(bx + 1, by - 1) && P(bx + 1, by) && fg(bx - 1, by) === 'air') { setBlock(bx, by, 'portal'); setBlock(bx - 1, by, 'portal'); damageTool(); ach(31); return true; }
            if (canFireExistAt(bx, by) && putFire(bx, by)) { damageTool(); return true; }
            return false;
        }
        if (canBeOnFire(bx, by)) {
            const w = W();
            if (canFireExistAt(bx, by + 1)) { if (putFire(bx, by + 1)) { damageTool(); return true; } return false; }
            const side = Math.floor(w.worldX) < bx ? -1 : 1;
            if (canFireExistAt(bx + side, by) && putFire(bx + side, by)) { damageTool(); return true; }
        }
        return false;
    }
    // cada medio segundo: el fuego sin nada que quemar se apaga; con "dofiretick" quema y se pasa a lo que arde junto a él
    function tickFire() {
        if (mpGuest()) return;
        if (S.tick % 100 === 11) {                                     // (los fuegos que ya había cerca)
            const w = W(), px = Math.floor(w.worldX), py = Math.floor(-w.worldY);
            for (let x = px - 16; x <= px + 16; x++) { const col = mbwom.scene[x]; if (!col) continue; for (let y = Math.max(0, py - 12); y <= py + 12; y++) if (col[y] === 'fire' || fg(x, y) === 'fire') S.fires.add(key(x, y)); }
        }
        if (S.tick % 25 !== 4 || !S.fires.size) return;
        const spread = gameRule('dofiretick') !== false;
        Array.from(S.fires).forEach(function (k) {
            const m = /^blockX(-?\d+)Y(-?\d+)$/.exec(k); if (!m) { S.fires.delete(k); return; }
            const x = +m[1], y = +m[2];
            if (fg(x, y) !== 'fire') { S.fires.delete(k); return; }
            if (simFar(x + .5)) return;
            if (!canFireExistAt(x, y) || fg(x, y + 1) === 'wr' || (W().raining && Math.random() < .2)) { setBlock(x, y, null); S.fires.delete(k); return; }
            if (!spread) return;
            const eternal = fg(x, y - 1) === 'n' || fg(x, y - 1) === 'magma';
            const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            if (Math.random() < .12) {                                    // quema algo de al lado (se vuelve fuego)
                const q = N[Math.random() * 4 | 0], X = x + q[0], Y = y + q[1];
                const t = fg(X, Y);
                if (t !== 'n' && t !== 'magma' && bd(t, 'flammable') == 1) {
                    if (t === 'TNT') { setBlock(X, Y, null); igniteTNT(X, Y); }
                    else { setBlock(X, Y, 'fire'); S.fires.add(key(X, Y)); }
                }
            }
            if (Math.random() < .08) {                                    // salta a un hueco cercano que tenga algo que arda
                const X = x + (Math.random() * 3 | 0) - 1, Y = y + (Math.random() * 3 | 0) - 1;
                if (fg(X, Y) === 'air' && canFireExistAt(X, Y)) { setBlock(X, Y, 'fire'); S.fires.add(key(X, Y)); }
            }
            if (!eternal && Math.random() < .03) { setBlock(x, y, null); S.fires.delete(k); }
        });
    }

    // ---------------------------------------------------------------- 🎣 pesca (aproximada)
    const FISH = [['rf', .6], ['salmon', .25], ['puff', .13], ['clown', .02]];
    function useRod(mw) {
        const w = W();
        if (S.bob) {                                                    // recoger
            const b = S.bob; S.bob = null;
            if (b.bite > 0) {
                let r = Math.random(), id = 'rf';
                for (let i = 0; i < FISH.length; i++) { if (r < FISH[i][1]) { id = FISH[i][0]; break; } r -= FISH[i][1]; }
                const left = addToInventory(id, 1, 0, {});
                if (left > 0) addDrop(id, w.worldX, w.worldY - 1, left, 0, {});
                dropXP(w.worldX, w.worldY - 1, 1, 5);
                sndAt('splash', b.x, b.y);
                flashMsg('🎣 ' + tr('play_fish_caught', 'You caught a fish!'));
                ach(39);
            }
            damageTool();
            return true;
        }
        const hx = w.worldX, hy = w.worldY - 1.4;
        const ang = Math.atan2(-mw.y - hy, mw.x - hx);
        const sp = .55 * Math.max(.4, Math.min(1, Math.hypot(mw.x - hx, -mw.y - hy) / 9));   // (cae más o menos donde se tocó)
        S.bob = { x: hx, y: hy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - .12, wet: false, wait: 0, bite: 0, age: 0 };
        snd('throwsfx');
        return true;
    }
    function tickBobber() {
        const b = S.bob; if (!b) return;
        const w = W();
        if (selType() !== 'fr' || w.dead > 0 || Math.hypot(b.x - w.worldX, b.y - w.worldY) > 28 || ++b.age > 120 * FPS) { S.bob = null; return; }
        const bx = Math.floor(b.x), by = Math.floor(-b.y);
        const wet = isWet(fg(bx, by));
        if (!b.wet) {
            if (wet) { b.wet = true; b.vx *= .2; b.vy = 0; splash(b.x, -b.y, 6); sndAt('splash', b.x, b.y); b.wait = (5 + Math.random() * 25) * FPS | 0; return; }
            if (b.stuck) return;
            b.vy += .015; b.vx *= .995;
            const nx = b.x + b.vx, ny = b.y + b.vy;
            const t = fg(Math.floor(nx), Math.floor(-ny));
            if (t !== 'air' && bd(t, 'walkThroughBlock') != 1 && !isWet(t)) { b.stuck = true; b.vx = b.vy = 0; return; }
            b.x = nx; b.y = ny;
            return;
        }
        // flotando: se queda en la superficie del agua
        let top = by; while (isWet(fg(bx, top + 1)) && top < by + 30) top++;
        const want = -(top + 1) + .15 + (b.bite > 0 ? .25 : 0);
        b.y += (want - b.y) * .2; b.x += b.vx; b.vx *= .9;
        if (!isWet(fg(Math.floor(b.x), top))) { b.wet = false; return; }
        if (b.bite > 0) { if (--b.bite === 0) b.wait = (5 + Math.random() * 25) * FPS | 0; return; }
        if (--b.wait <= 0) { b.bite = (1.2 * FPS) | 0; splash(b.x, -b.y, 10); sndAt('splash', b.x, b.y); buzz(30); }
    }
    function drawBobber(c2) {
        const b = S.bob; if (!b) return;
        const w = W(), h = toScreen(w.worldX + (S.p && S.p.dir < 0 ? -.35 : .35), w.worldY - 1.5), p = toScreen(b.x, b.y);
        c2.strokeStyle = 'rgba(230,230,230,.9)'; c2.lineWidth = 1;
        c2.beginPath(); c2.moveTo(h.x, h.y); c2.quadraticCurveTo((h.x + p.x) / 2, Math.max(h.y, p.y) + tileSize * .4, p.x, p.y); c2.stroke();
        const s = Math.max(3, tileSize * .22);
        c2.fillStyle = '#e8e8e8'; c2.fillRect(p.x - s / 2, p.y - s, s, s / 2);
        c2.fillStyle = '#d42a2a'; c2.fillRect(p.x - s / 2, p.y - s / 2, s, s / 2);
    }

    // ---------------------------------------------------------------- 🧪 soporte de pociones (Game.potionData: ingrediente → poción)
    const BREW = {"water": {"nw": "awkward", "se": "mundane", "bp": "mundane", "gt": "mundane", "rfoot": "mundane", "gmels": "mundane", "sugar": "mundane", "magmac": "mundane", "rsd": "mundane", "yellowdust": "thick", "fse": "weakness"}, "awkward": {"gcarrot": "nightvision", "magmac": "fireresistance", "rfoot": "leaping", "sugar": "swiftness", "puff": "waterbreathing", "gmels": "healing", "se": "poison", "gt": "regeneration", "bp": "strength"}, "nightvision": {"fse": "invisibility", "rsd": "nightvision+"}, "nightvision+": {"fse": "invisibility+"}, "invisibility": {"rsd": "invisibility+"}, "fireresistance": {"rsd": "fireresistance+"}, "leaping": {"fse": "slowness", "rsd": "leaping+", "yellowdust": "leaping2"}, "leaping+": {"fse": "slowness+"}, "slowness": {"rsd": "slowness+"}, "swiftness": {"fse": "slowness", "rsd": "swiftness+", "yellowdust": "swiftness2"}, "swiftness+": {"fse": "slowness+"}, "waterbreathing": {"rsd": "waterbreathing+"}, "healing": {"fse": "harming", "yellowdust": "healing2"}, "healing2": {"fse": "harming2"}, "harming": {"yellowdust": "harming2"}, "poison": {"fse": "harming", "rsd": "poison+", "yellowdust": "poison2"}, "poison2": {"fse": "harming2"}, "regeneration": {"rsd": "regeneration+", "yellowdust": "regeneration2"}, "strength": {"rsd": "strength+", "yellowdust": "strength2"}, "weakness": {"rsd": "weakness+"}};
    window.MB_BREW = BREW;
    function brewTarget(p, ing) {
        if (!Array.isArray(p) || p[0] !== 'potion' || !(Number(p[1]) >= 1)) return null;
        const ex = (p[3] && typeof p[3] === 'object') ? p[3] : {};
        const r = BREW[String(ex.type || 'empty')];
        if (r && r[ing]) return { type: r[ing] };
        if (ing === 'gp' && String(ex.category || '').toLowerCase() !== 'splash' && ex.type && ex.type !== 'empty') return { splash: true };
        return null;
    }
    // cada ~1 s (con los hornos): con polvo de blaze (20 usos) y un ingrediente que le sirva a alguna botella, en 20 vueltas sale la poción
    function tickBrewing() {
        if (mpGuest()) return;
        const T = mbwom.toBrew; if (!T || typeof T !== 'object') return;
        const nil = () => ['air', 0, 0, {}];
        const emptyIt = (v) => !Array.isArray(v) || !v[0] || v[0] === 'air' || !(Number(v[1]) >= 1);
        let changed = false;
        Object.keys(T).forEach(function (k) {
            const l = T[k]; if (!l || typeof l !== 'object') return;
            const m = /^blockX(-?\d+)Y(-?\d+)$/.exec(k); if (!m) return;
            const bx = +m[1], by = +m[2];
            if (fg(bx, by) !== 'brew') return;
            if (!Array.isArray(l.input)) l.input = nil();
            if (!Array.isArray(l.fuel)) l.fuel = nil();
            if (!Array.isArray(l.output)) l.output = [nil(), nil(), nil()];
            while (l.output.length < 3) l.output.push(nil());
            l.fuelUsed = Number(l.fuelUsed) || 0; l.brewTimer = Number(l.brewTimer) || 0;
            const before = JSON.stringify(l);
            if (l.fuelUsed <= 0 && l.fuel[0] === 'bp' && Number(l.fuel[1]) > 0) { l.fuelUsed = 20; l.fuel[1]--; if (l.fuel[1] <= 0) l.fuel = nil(); }
            const ing = emptyIt(l.input) ? null : String(l.input[0]);
            const ok = l.fuelUsed > 0 && ing && l.output.some(function (p) { return !!brewTarget(p, ing); });
            if (ok) {
                l.brewTimer++;
                if (l.brewTimer >= 20) {
                    l.brewTimer = 0;
                    l.output.forEach(function (p) {
                        const r = brewTarget(p, ing); if (!r) return;
                        p[3] = Object.assign({}, p[3] || {});
                        if (r.type) { p[3].type = r.type; delete p[3].effects; } else p[3].category = 'splash';
                    });
                    l.fuelUsed--;
                    l.input[1]--; if (l.input[1] <= 0) l.input = nil();
                    sndAt('drink1', bx + .5, -(by + .5), { vol: .4 });
                    if (nearMe(bx + .5, -by, 10)) ach(43);
                }
            } else l.brewTimer = 0;
            if (JSON.stringify(l) !== before) { changed = true; netMark(bx, by); }
        });
        if (changed && typeof window.playerInvFurnaceTick === 'function') window.playerInvFurnaceTick();
    }

    // ---------------------------------------------------------------- 🐄 criar animales, crías, ordeñar
    function canBreed(m) {
        const a = D.mobs[m.type] || {};
        if (!a.canBreed || (Number(m.breedTimer) || 0) !== 0 || Number(m.babyTimer) > 0) return false;
        if (a.tameable && (!m.tamed || Number(m.health) < maxHealth(m))) return false;
        return true;
    }
    function hearts(m, n) { for (let i = 0; i < n; i++) addPart({ x: m.x + (Math.random() - .5) * .8, y: -m.y + 1.2 + Math.random() * .5, vy: .015, life: 35, size: .16, col: '#ff4d7a', glow: true }); }
    // darle de comer a un mob (su comida de criar): se "enamora" 30 s; a una cría la hace crecer más rápido
    function feedMob(id, itemId) {
        const m = mbwom.mobs[id]; if (!m || m.dead > 0) return false;
        const a = D.mobs[m.type]; if (!a || !a.breedItems || !a.breedItems[itemId]) return false;
        if (Number(m.babyTimer) > 0) { m.babyTimer = Math.floor(m.babyTimer * .8); growParts(m.x - .5, -m.y); return true; }
        if (!canBreed(m)) return false;
        m.breedTimer = 30 * FPS; m.breedTarget = '';
        hearts(m, 5);
        return true;
    }
    window.mbwPlay.feedMob = feedMob;
    // (en mobTick) los relojes de criar y de crecer, y que salga la cría
    function breedTick(id, m) {
        if (Number(m.breedTimer) > 0) {
            m.breedTimer = Math.max(0, m.breedTimer - 1);
            if (Math.random() < 1 / FPS) hearts(m, 1);
            if (m.breedTimer <= 0) {
                m.breedTimer = 0;
                const o = m.breedTarget && mbwom.mobs[m.breedTarget];
                if (o && Math.pow(o.x - m.x, 2) + Math.pow(o.y - m.y, 2) < 6.25) {
                    const ex = { variant: m.variant, babyTimer: 1200 * FPS, parents: [id, m.breedTarget] };
                    if (m.type === 'wolf') { ex.tamed = true; ex.tamedBy = Math.random() < .5 ? m.tamedBy : o.tamedBy; }
                    if (m.type === 'sheep' || m.type === 'wolf') { const col = Math.random() < .5 ? m.color : o.color; if (col != null) ex.color = col; }
                    spawnMob(m.type, (m.x + o.x) / 2, (m.y + o.y) / 2, ex);
                    dropXP(m.x, m.y - 1, 3);
                    if (nearMe(m.x, m.y, 16)) ach(44);
                    hearts(m, 6);
                    m.breedTimer = o.breedTimer = -300 * FPS;
                } else if (o) o.breedTimer = 0;
            }
        } else if (Number(m.breedTimer) < 0) m.breedTimer = Math.min(0, m.breedTimer + 1);
        if (Number(m.babyTimer) > 0) m.babyTimer = Math.max(0, m.babyTimer - 1);
    }
    // (en calcTarget) el enamorado busca pareja (de su tipo, a menos de 5 bloques); la cría sigue a sus papás. true = ya sabe a quién ir
    function breedFocus(id, m) {
        if (Number(m.breedTimer) > 0) {
            const o = m.breedTarget && mbwom.mobs[m.breedTarget];
            if (!o || o.type !== m.type || !(o.breedTimer > 0) || o.variant !== m.variant || o.babyTimer > 0 || (o.breedTarget !== id && o.breedTarget)) {
                m.breedTarget = '';
                for (const k in mbwom.mobs) {
                    if (k === id) continue;
                    const p = mbwom.mobs[k];
                    if (!p || p.type !== m.type || !(p.breedTimer > 0) || p.variant !== m.variant || p.babyTimer > 0 || (p.breedTarget !== id && p.breedTarget)) continue;
                    if (Math.pow(p.x - m.x, 2) + Math.pow(p.y - m.y, 2) > 25) continue;
                    p.breedTimer = 5 * FPS; m.breedTimer = 5 * FPS; p.breedTarget = id; m.breedTarget = k;
                    break;
                }
            }
            if (m.breedTarget) { m.focus = m.breedTarget; return true; }
        }
        if (Number(m.babyTimer) > 0 && Array.isArray(m.parents)) {
            let best = null, bd2 = Infinity;
            m.parents.forEach(function (pid) { const p = mbwom.mobs[pid]; if (!p) return; const dd = Math.pow(p.x - m.x, 2) + Math.pow(p.y - m.y, 2); if (dd < bd2) { bd2 = dd; best = pid; } });
            if (best && bd2 > 9) { m.focus = best; return true; }
        }
        return false;
    }
    // clic derecho sobre un mob con algo en la mano: criar / ordeñar. true = se usó
    function useOnMob(mw) {
        const mid = mobUnderMouse(mw); if (!mid) return false;
        const m = mbwom.mobs[mid], id = selType(), w = W();
        if (id === 'bk' && m.type === 'cow' && !(Number(m.babyTimer) > 0)) {          // 🥛 ordeñar
            if (w.gamemode != 1) { const it = selItem(); if (it[1] > 1) { it[1]--; const left = addToInventory('mbk', 1, 0, {}); if (left > 0) addDrop('mbk', w.worldX, w.worldY - 1, 1); } else inv()[selIndex()] = ['mbk', 1, 0, {}]; }
            sndAt('cow' + ((Math.random() * 4 | 0) + 1), m.x, m.y - 1);
            hud.dirty = true;
            return true;
        }
        if (id === 'bone' && m.type === 'wolf' && !m.tamed) {                         // 🐕 domesticar un lobo con huesos (1 de cada 3)
            reduceSelected(1);
            if ((3 * Math.random() | 0) === 0) { m.tamed = true; m.tamedBy = 'player'; m.target = null; m.aggressiveness = 0; hearts(m, 6); ach(11); if (mpGuest()) mpSend({ tipo: 'juego_domar', id: mid }); }
            else for (let i = 0; i < 4; i++) addPart({ x: m.x + (Math.random() - .5), y: -m.y + 1 + Math.random() * .5, vy: .02, life: 25, size: .1, col: '#777' });
            return true;
        }
        const a = D.mobs[m.type];
        if (a && a.breedItems && a.breedItems[id]) {
            if (mpGuest()) { if (!(Number(m.babyTimer) > 0) && !canBreed(m)) return false; mpSend({ tipo: 'juego_cria', id: mid, it: id }); hearts(m, 4); reduceSelected(1); return true; }
            if (feedMob(mid, id)) { reduceSelected(1); return true; }
        }
        return false;
    }

    // ---------------------------------------------------------------- 🛶 balsas y 🚃 vagonetas (aproximado)
    function vStore(kind, create) {
        const n = kind === 'cart' ? 'carts' : 'rafts';
        let o = mbwom[n];
        if (!o || typeof o !== 'object') { if (!create) return null; o = {}; mbwom[n] = o; mbwom.world[n + (mbwom.currentScene || 1)] = o; }
        return o;
    }
    function vPos(kind, d) { return kind === 'cart' ? { x: Number(d.x), y: Number(d.y) } : { x: Number(d[1]), y: Number(d[2]) }; }
    function vSet(kind, d, x, y) { if (kind === 'cart') { d.x = x; d.y = y; } else { d[1] = x; d[2] = y; } }
    function vehicleUnderMouse(mw) {
        let best = null;
        ['cart', 'raft'].forEach(function (kind) {
            const o = vStore(kind, false); if (!o) return;
            Object.keys(o).forEach(function (id) {
                const d = o[id]; if (!d || typeof d !== 'object') return;
                const p = vPos(kind, d), h = -p.y;
                if (Math.abs(mw.x - p.x) <= .75 && mw.y >= h - .1 && mw.y <= h + 1) best = { kind: kind, id: id, d: d };
            });
        });
        return best;
    }
    const isRail = (t) => typeof t === 'string' && t.slice(0, 4) === 'rail';
    function placeVehicle(id, bx, by) {
        const w = W();
        if (id === 'raft') {
            if (!isWet(fg(bx, by))) return false;
            let top = by; while (isWet(fg(bx, top + 1))) top++;
            const rid = 'raft' + (1e9 * Math.random() | 0);
            vStore('raft', true)[rid] = [rid, bx + .5, -(top + .85), 0, 0, null];
            reduceSelected(1);
            mount('raft', rid);
            return true;
        }
        if (id.slice(0, 4) === 'cart' && isRail(fg(bx, by))) {
            const cid = 'cart' + (1e9 * Math.random() | 0);
            const kind = { cart: '', cartchest: 'chest', cartoven: 'oven', cartTNT: 'TNT' }[id];
            vStore('cart', true)[cid] = { x: bx + .5, y: -by, onRail: 1, speedX: 0, speedY: 0, type: kind || '', id: cid, health: 3, tilt: 0, onActivator: false, riddenBy: null };
            reduceSelected(1);
            sndAt('stone', bx + .5, -by);
            return true;
        }
        return false;
    }
    function mount(kind, id) {
        const o = vStore(kind, false), d = o && o[id]; if (!d) return false;
        if (kind === 'cart' && d.type) return false;                       // (con cofre, horno o TNT no se puede subir)
        S.ride = { kind: kind, id: id, vs: 0 };
        W().riding = id;
        if (kind === 'cart') d.riddenBy = 'player'; else d[5] = 'player';
        return true;
    }
    function dismount() {
        const r = S.ride; S.ride = null;
        const w = W(); w.riding = '';
        if (!r) return;
        const o = vStore(r.kind, false), d = o && o[r.id];
        if (d) { if (r.kind === 'cart') d.riddenBy = null; else d[5] = null; const p = vPos(r.kind, d); w.worldX = p.x; w.worldY = p.y - 1; }
        w.xSpeed = 0; w.ySpeed = 0;
        if (S.p) S.p.wasFallingSpeed = 0;
    }
    function breakVehicle(v) {
        const o = vStore(v.kind, false); if (!o) return;
        const p = vPos(v.kind, v.d);
        if (S.ride && S.ride.id === v.id) dismount();
        delete o[v.id];
        if (W().gamemode != 1) {
            if (v.kind === 'raft') addDrop('raft', p.x, p.y - .5, 1);
            else addDrop(v.d.type ? 'cart' + v.d.type : 'cart', p.x, p.y - .5, 1);
        }
        sndAt('wood', p.x, p.y);
    }
    const vSolid = (x, y) => { const t = fg(x, y); return t !== 'air' && bd(t, 'walkThroughBlock') != 1 && bd(t, 'liquid') == null && !isRail(t); };
    function tickVehicles() {
        ['raft', 'cart'].forEach(function (kind) {
            const o = vStore(kind, false); if (!o) return;
            Object.keys(o).forEach(function (id) {
                const d = o[id]; if (!d || typeof d !== 'object') return;
                const p = vPos(kind, d);
                if (simFar(p.x)) return;
                const riding = !!(S.ride && S.ride.id === id);
                const inp = riding ? (key2('right') ? 1 : 0) - (key2('left') ? 1 : 0) : 0;
                let x = p.x, h = -p.y, vx = kind === 'cart' ? (Number(d.speedX) || 0) : (Number(d[4]) || 0), vs = kind === 'cart' ? (Number(d.speedY) || 0) : (Number(d[3]) || 0);
                const bx = Math.floor(x);
                if (kind === 'raft') {
                    const row = Math.floor(h - .3);
                    if (isWet(fg(bx, row)) || isWet(fg(bx, row + 1))) {
                        let top = row; while (isWet(fg(bx, top + 1)) && top < row + 20) top++;
                        h += ((top + .85) - h) * .2; vs = 0;
                        vx = vx * .96 + inp * .01; vx = Math.max(-.2, Math.min(.2, vx));
                    } else {
                        vs = Math.min(.6, vs + .02); h -= vs;
                        if (vSolid(bx, Math.floor(h))) { h = Math.floor(h) + 1; vs = 0; }
                        vx = vx * .6 + inp * .004;
                    }
                } else {
                    const ry = Math.floor(h + .05);
                    const t = fg(bx, ry);
                    if (isRail(t)) {
                        vs = 0; h = ry;
                        vx = vx * .996 + inp * .006;
                        if (t === 'railp') {
                            const sig = mbwom.hasSignal && mbwom.hasSignal[key(bx, ry)], on = Array.isArray(sig) ? Number(sig[0]) > 0 : !!sig;
                            if (on) { if (Math.abs(vx) < .02) vx = (vx >= 0 ? 1 : -1) * .05 * (inp || (vx >= 0 ? 1 : -1)); vx += (vx >= 0 ? 1 : -1) * .02; }
                            else vx *= .8;
                        }
                        if (t === 'raila' && riding && Math.abs(vx) > .01) { const sig = mbwom.hasSignal && mbwom.hasSignal[key(bx, ry)]; if (Array.isArray(sig) ? Number(sig[0]) > 0 : !!sig) dismount(); }
                        vx = Math.max(-.3, Math.min(.3, vx));
                        // siguiente cuadro: riel igual, un escalón arriba o uno abajo
                        const nx = x + vx, nbx = Math.floor(nx);
                        if (nbx !== bx) {
                            if (isRail(fg(nbx, ry))) { /* sigue */ }
                            else if (isRail(fg(nbx, ry + 1)) && !vSolid(bx, ry + 1)) h = ry + 1;
                            else if (isRail(fg(nbx, ry - 1))) h = ry - 1;
                            else if (vSolid(nbx, ry)) vx = -vx * .3;
                        }
                    } else {
                        vs = Math.min(.6, vs + .02); h -= vs;
                        if (vSolid(bx, Math.floor(h)) || isRail(fg(bx, Math.floor(h)))) { h = Math.floor(h) + (isRail(fg(bx, Math.floor(h))) ? 0 : 1); vs = 0; }
                        vx = vx * .85 + inp * .003;
                    }
                }
                // choque con un bloque sólido
                const nx = x + vx;
                if (vSolid(Math.floor(nx + (vx > 0 ? .5 : -.5)), Math.floor(h + .2)) && !(kind === 'cart' && isRail(fg(Math.floor(nx), Math.floor(h + .05))))) vx = 0;
                else x = nx;
                vSet(kind, d, x, -h);
                if (kind === 'cart') { d.speedX = vx; d.speedY = vs; d.onRail = isRail(fg(Math.floor(x), Math.floor(h + .05))) ? 1 : 0; }
                else { d[4] = vx; d[3] = vs; }
            });
        });
        // el que va subido se mueve con la balsa / vagoneta
        if (S.ride) {
            const o = vStore(S.ride.kind, false), d = o && o[S.ride.id];
            if (!d) { dismount(); return; }
            const w = W(), p = vPos(S.ride.kind, d);
            w.worldX = p.x; w.worldY = p.y - (S.ride.kind === 'cart' ? .35 : .25); w.xSpeed = 0; w.ySpeed = 0;
            if (S.p) { S.p.wasFallingSpeed = 0; S.p.falling = false; }
            if (key2('down')) dismount();                                      // (agacharse = bajarse)
        }
    }
    window.mbwPlay.life = { brewTick: function () { tickBrewing(); }, cropTick: function () { const t = S.tick; S.tick = DAY_TICKS * 3 + 7; tickCrops(); S.tick = t; }, fireTick: function () { const t = S.tick; S.tick = 29; tickFire(); S.tick = t; }, bob: function () { return S.bob; }, sleeping: function () { return !!S.sleep; }, fires: function () { return S.fires; }, shots: function () { return S.shots; }, fballs: function () { return S.fballs; }, drawing: function () { return S.draw; }, bonemeal: function (x, y) { return useBonemeal(x, y); }, saplingTick: function () { const t = S.tick, R = Math.random; S.tick = (45 / 25 * FPS) | 0; Math.random = function () { return 1 / 70 + 1e-6; }; try { tickSaplings(); } finally { Math.random = R; S.tick = t; } } };   // (lo usan las pruebas)
    // ⚒ se usó el yunque: suena, logro, y 12 % de que se gaste (3 golpes y se rompe)
    window.mbwPlay.anvilUsed = function (x, y) {
        sndAt('anvilsound', x + .5, -(y + .5));
        ach(40);
        if (fg(x, y) !== 'anvil' || W().gamemode == 1 || Math.random() >= .12) return '';
        const n = (Number(st(x, y)) || 1) + 1;
        if (n > 3) { setBlock(x, y, null); sndAt('anvilsound', x + .5, -(y + .5), { rate: .6 }); return 'broke'; }
        setBlock(x, y, 'anvil', n); return 'worn';
    };
    window.mbwPlay.onCrafted = function (id) { const M = { craft: 3, WoodenPickaxe: 4, StonePickaxe: 5, IronPickaxe: 6, oven: 7, th: 9, cake: 24, portalstone: 30 }; if (M[id] != null) ach(M[id]); };
    window.mbwPlay.ride = function () { return S.ride ? { kind: S.ride.kind, id: S.ride.id } : null; };
    window.mbwPlay.placeVehicle = placeVehicle;

    // ---------------------------------------------------------------- 🥛 tomar leche: quita los efectos y deja la cubeta
    function drinkMilk() {
        const w = W();
        w.effects = {};
        snd('drink' + ((Math.random() * 2 | 0) + 1));
        if (w.gamemode != 1) inv()[selIndex()] = ['bk', 1, 0, {}];
        hud.dirty = true;
    }

    // ---------------------------------------------------------------- todo lo de arriba, cada paso
    function tickLife() {
        tickTime();
        tickSleep();
        tickCrops();
        tickFire();
        tickBobber();
        tickVehicles();
    }
    // lo que se usa con clic derecho (una vez por clic). true = se usó
    function useItemLife(mw, bx, by) {
        const id = selType();
        if (id === 'fas') return useFlint(mw, bx, by);
        if (id === 'fr') return useRod(mw);
        if (id === 'eoe') return useEye(mw, bx, by);
        if (id === 'bl') return useBalloon(mw, bx, by);
        if (blockDist(bx, by) > REACH + 1) return false;
        if (/Hoe$/.test(id)) return useHoe(bx, by);
        if (id === 'bonem') { if (useBonemeal(bx, by)) { reduceSelected(1); return true; } return false; }
        if (id === 'raft' || id.slice(0, 4) === 'cart') return placeVehicle(id, bx, by);
        return false;
    }

    // ---------------------------------------------------------------- 🟢 OJO DE ENDER y el portal del End
    //  · en un marco del portal ("pf") vacío: el ojo se queda puesto (estado 2: el marco con el ojo verde).
    //    Cuando TODOS los marcos de la fila tienen ojo, el portal se abre (logro "Unlock the ender portal") y al pararse encima se va al End.
    //  · en otra parte (en el mundo normal): se avienta y vuela hacia el portal más cercano; luego cae (a veces se rompe).
    function pfRow(x, y) {                                            // los marcos seguidos de esa fila
        let a = x, b = x;
        while (fg(a - 1, y) === 'pf' && x - a < 30) a--;
        while (fg(b + 1, y) === 'pf' && b - x < 30) b++;
        const L = []; for (let i = a; i <= b; i++) L.push(i);
        return L;
    }
    // (una fila de 3 o más marcos: se abre cuando TODOS tienen ojo · 1 o 2 marcos sueltos con ojo, hechos en el editor: ya funcionan)
    function pfOpen(x, y) { if (fg(x, y) !== 'pf') return false; const L = pfRow(x, y); return L.every(function (i) { return Number(st(i, y)) === 2; }); }
    window.mbwPlay.pfOpen = pfOpen;
    function useEye(mw, bx, by) {
        const w = W();
        if (fg(bx, by) === 'pf' && blockDist(bx, by) <= REACH + 1) {
            if (Number(st(bx, by)) === 2) return false;
            setBlock(bx, by, 'pf', 2);
            if (w.gamemode != 1) reduceSelected(1);
            sndAt('Portal' + ((Math.random() * 5 | 0) + 1), bx + .5, -(by + .5));
            for (let i = 0; i < 8; i++) addPart({ x: bx + .5 + (Math.random() - .5) * .8, y: by + 1.1, vx: (Math.random() - .5) * .03, vy: .03, life: 20, size: .09, col: '#3fd27a', glow: true });
            if (pfRow(bx, by).length >= 3 && pfOpen(bx, by)) { ach(35); sndAt('portal', bx + .5, -(by + .5)); flashMsg('🟢 ' + tr('play_end_open', 'The End portal is open!')); }
            return true;
        }
        if ((mbwom.currentScene || 1) !== 1) return false;
        const t = nearestPf();
        const dir = t ? (t.x + .5 > w.worldX ? 1 : -1) : (Math.random() < .5 ? -1 : 1);
        S.eyes.push({ x: w.worldX, y: w.worldY - 1.6, dir: dir, age: 0, tx: t ? t.x + .5 : null });
        if (w.gamemode != 1) reduceSelected(1);
        snd('throwsfx');
        return true;
    }
    let pfCache = null;
    function nearestPf() {
        const w = W(), now = performance.now();
        if (!pfCache || now - pfCache.t > 15000) {
            const L = [];
            const sc = mbwom.scene || [];
            for (let x = 0; x < sc.length; x++) { const col = sc[x]; if (!col) continue; for (let y = 0; y < col.length; y++) if (col[y] === 'pf') { L.push({ x: x, y: y }); break; } }
            pfCache = { t: now, list: L };
        }
        let best = null, bd2 = Infinity;
        pfCache.list.forEach(function (q) { const d = Math.abs(q.x + .5 - w.worldX); if (d < bd2) { bd2 = d; best = q; } });
        return best;
    }
    function tickEyes() {
        for (let i = S.eyes.length - 1; i >= 0; i--) {
            const e = S.eyes[i];
            e.age++;
            if (e.age < 2.2 * FPS) {
                e.y -= .03 * (1 - e.age / (2.2 * FPS)) + .005;                // sube...
                const near = e.tx != null && Math.abs(e.tx - e.x) < 1.5;
                if (!near) e.x += e.dir * .09;                             // ...y vuela hacia el portal
                if (Math.random() < .6) addPart({ x: e.x + (Math.random() - .5) * .3, y: -e.y + (Math.random() - .5) * .3, vx: 0, vy: 0, life: 14, size: .07, col: '#a24fe0', glow: true });
            } else {                                                       // ...y cae: 4 de 5 veces se puede recoger
                S.eyes.splice(i, 1);
                if (Math.random() < .8) addDrop('eoe', e.x, e.y, 1, 0, {});
                else { sndAt('glass1', e.x, e.y); for (let k = 0; k < 10; k++) addPart({ x: e.x, y: -e.y, vx: (Math.random() - .5) * .08, vy: Math.random() * .06, life: 18, size: .07, col: '#3fd27a' }); }
            }
        }
    }
    function drawEyes(c2) {
        S.eyes.forEach(function (e) { const p = toScreen(e.x, e.y), s2 = tileSize * .55; try { c2.drawImage(iconFor('eoe', {}), p.x - s2 / 2, p.y - s2 / 2, s2, s2); } catch (er) { /* nada */ } });
    }

    // ---------------------------------------------------------------- 🎈 GLOBOS (Game: world.balloons)
    //  · en la mano: flota arriba del Player.
    //  · clic derecho en una cerca: se amarra ahí · en un mob: lo amarra y lo va levantando · en otra parte: se suelta y se va volando.
    //  · clic derecho en el hilo de un globo: lo vuelves a agarrar · clic izquierdo en el globo: ¡pop!
    const BAL_COLORS = { red: '#e33b3b', orange: '#f08a24', yellow: '#f5d327', lime: '#7fd13b', green: '#3c9a3c', lightblue: '#6cc3f0', cyan: '#2fb5b5', blue: '#3a5be0', purple: '#9b4fd8', magenta: '#d64fc2', pink: '#f5a2c4', white: '#f2f2f2', lightgray: '#bdbdbd', gray: '#6e6e6e', black: '#2a2a2a', brown: '#8b5a2b' };
    const balColor = (t) => BAL_COLORS[String(t || 'red').toLowerCase()] || BAL_COLORS.red;
    const FENCE = { fnc: 1, nfnc: 1, fncg: 1, nfncg: 1 };
    function bStore(create) {
        let o = mbwom.balloons;
        if (!o || typeof o !== 'object' || Array.isArray(o)) { if (!create) return null; o = {}; mbwom.balloons = o; mbwom.world['balloons' + (mbwom.currentScene || 1)] = o; }
        return o;
    }
    function balAnchor(b) {                                           // a dónde va amarrado el hilo (null = suelto)
        const a = b.attached; if (!a) return null;
        if (a.type === 'block') { if (!FENCE[fg(a.x, a.y)]) { b.attached = null; return null; } return { x: a.x + .5, y: -a.y - .9 }; }
        if (a.type === 'mob') { const m = mbwom.mobs[a.id]; if (!m || m.dead > 0) { b.attached = null; return null; } const mb = mobBounds(a.id); return mb ? { x: (mb.l + mb.r) / 2, y: mb.t + .1 } : null; }
        return null;
    }
    function useBalloon(mw, bx, by) {
        const w = W(), it = selItem(), ex = (it && it[3]) || {};
        const life = Math.max(1, (bd('bl', 'life') || 10) - (Number(it[2]) || 0));
        const b = { x: w.worldX + .3, y: w.worldY - 3.3, sx: w.worldX + .3, sy: w.worldY - 1, type: ex.type || 'red', life: life, attached: null, vx: 0, vy: 0, age: 0 };
        const hit = typeof window.findMobAt === 'function' ? window.findMobAt(mw.x, mw.y) : null;
        const mid = hit && mbwom.mobs[hit.key] && !(mbwom.mobs[hit.key].dead > 0) && Math.hypot(hit.mob.x - w.worldX, hit.mob.y - w.worldY) <= REACH + 1 ? hit.key : null;
        if (FENCE[fg(bx, by)] && blockDist(bx, by) <= REACH + 1) b.attached = { type: 'block', x: bx, y: by };
        else if (mid && mbwom.mobs[mid] && mbwom.mobs[mid].type !== 'enderdragon') b.attached = { type: 'mob', id: mid };
        const st0 = bStore(true);
        let n = 1, id; do id = 'balloon' + (n++); while (st0[id]);
        st0[id] = b;
        inv()[selIndex()] = empty(); hud.dirty = true;
        snd('throwsfx');
        return true;
    }
    function balloonAt(gx, gy, part) {                                // part: 'body' (el globo) o 'string' (la punta del hilo)
        const o = bStore(false); if (!o) return null;
        for (const k in o) {
            const b = o[k]; if (!b) continue;
            if (part === 'body' ? Math.hypot(b.x - gx, b.y + .1 - gy) < .65 : Math.abs(b.sx - gx) < 1 && Math.abs(b.sy - gy) < 1) return k;
        }
        return null;
    }
    function grabBalloon(k) {
        const o = bStore(false), b = o && o[k]; if (!b) return false;
        const ex = { type: b.type || 'red' };
        if (addToInventory('bl', 1, Math.max(0, (bd('bl', 'life') || 10) - (b.life || 10)), ex) > 0) return false;
        delete o[k]; pickSnd();
        return true;
    }
    function popBalloon(k) {
        const o = bStore(false), b = o && o[k]; if (!b) return false;
        delete o[k];
        sndAt('pop', b.x, b.y);
        for (let i = 0; i < 10; i++) addPart({ x: b.x + (Math.random() - .5) * .5, y: -b.y + (Math.random() - .5) * .5, vx: (Math.random() - .5) * .1, vy: (Math.random() - .5) * .1, life: 14, size: .09, col: balColor(b.type) });
        return true;
    }
    function tickBalloons() {
        const o = bStore(false); if (!o) return;
        const lift = {};
        for (const k in o) {
            const b = o[k]; if (!b || typeof b !== 'object') { delete o[k]; continue; }
            b.x = Number(b.x) || 0; b.y = Number(b.y) || 0; b.age = (b.age || 0) + 1;
            const an = balAnchor(b);
            if (an) {
                // amarrado: el globo se queda flotando 2.5 arriba de donde está amarrado (meciéndose)
                const tx = an.x + Math.sin((S.tick + k.length * 40) / 40) * .25, ty = an.y - 2.5;
                b.vx = (b.vx || 0) * .9 + (tx - b.x) * .02; b.vy = (b.vy || 0) * .9 + (ty - b.y) * .02;
                b.sx = an.x; b.sy = an.y;
                if (b.attached.type === 'mob') lift[b.attached.id] = (lift[b.attached.id] || 0) + 1;
            } else {
                // suelto: sube y se va (a los 40 s, o muy arriba, desaparece)
                b.vy = (b.vy || 0) * .98 - .002; b.vx = (b.vx || 0) * .98 + Math.sin(b.age / 50) * .0008;
                b.sx = b.x; b.sy = b.y + 2.4;
                if (b.age > 40 * FPS || b.y < -300) { delete o[k]; continue; }
            }
            b.x += b.vx; b.y += b.vy;
        }
        // 🐔 los mobs con globos suben (más globos, más rápido)
        if (!mpGuest()) Object.keys(lift).forEach(function (id) { const m = mbwom.mobs[id]; if (!m) return; const sp = migSpeed(Math.min(4, 1.2 * lift[id])); m.speedY = Math.max(Number(m.speedY) || 0, sp); m.y -= m.falling ? sp / 2 / 30 : .3; m.falling = true; });
    }
    function drawBalloons(c2) {
        const o = bStore(false), w = W();
        const one = function (x, y, sx, sy, col) {
            const p = toScreen(x, y), q = toScreen(sx, sy), r = tileSize * .5;
            c2.save();
            c2.strokeStyle = 'rgba(240,240,240,.85)'; c2.lineWidth = Math.max(1, tileSize / 24);
            c2.beginPath(); c2.moveTo(p.x, p.y + r * 1.1); c2.quadraticCurveTo((p.x + q.x) / 2 + r * .3, (p.y + q.y) / 2, q.x, q.y); c2.stroke();
            c2.fillStyle = col; c2.beginPath(); c2.ellipse(p.x, p.y, r * .85, r, 0, 0, Math.PI * 2); c2.fill();
            c2.beginPath(); c2.moveTo(p.x - r * .18, p.y + r * 1.12); c2.lineTo(p.x + r * .18, p.y + r * 1.12); c2.lineTo(p.x, p.y + r * .9); c2.fill();
            c2.fillStyle = 'rgba(255,255,255,.45)'; c2.beginPath(); c2.ellipse(p.x - r * .3, p.y - r * .35, r * .18, r * .28, -.5, 0, Math.PI * 2); c2.fill();
            c2.restore();
        };
        if (o) for (const k in o) { const b = o[k]; if (b) one(b.x, b.y, b.sx, b.sy, balColor(b.type)); }
        // el que tengo en la mano
        if (selType() === 'bl' && !(w.dead > 0)) { const it = selItem(), hx = w.worldX + (S.p && S.p.xScale < 0 ? -.35 : .35); one(hx + Math.sin(S.tick / 35) * .15, w.worldY - 3.4, hx, w.worldY - 1.1, balColor(it && it[3] && it[3].type)); }
    }

    // ---------------------------------------------------------------- ⛄ GÓLEM DE NIEVE: calabaza (o calabaza con luz) arriba de 2 bloques de nieve
    function golemCheck(x, y) {
        const t = fg(x, y);
        if ((t !== 'pk' && t !== 'jl') || fg(x, y - 1) !== 'snowblock' || fg(x, y - 2) !== 'snowblock') return false;
        [0, 1, 2].forEach(function (k) { setBlock(x, y - k, null); });
        const id = spawnMob('snowgolem', x + .5, -(y - 2));
        for (let i = 0; i < 16; i++) addPart({ x: x + .5 + (Math.random() - .5), y: y - 1 + (Math.random() - .5) * 2.4, vx: (Math.random() - .5) * .06, vy: Math.random() * .05, life: 22, size: .1, col: '#ffffff' });
        sndAt('snow1', x + .5, -(y - 1));
        return !!id;
    }

    // ------------------------------------------------------------------ paso del juego
    function step() {
        S.tick++;
        const w = W();
        intervals();
        deathCheck();
        if (modalOpen()) { S.keys = {}; S.mouse.left = S.mouse.right = S.mouse.leftEdge = S.mouse.rightEdge = false; S.mine = null; }
        if (!(w.dead > 0)) { mineAndPlace(); if (!S.ride && !S.sleep) doPlayerLogic(); }
        tickLife();
        if (S.spect) spectFollow();
        if (S.ench && (fg(S.ench.x, S.ench.y) !== 'enchant' || Math.pow(S.ench.x + .5 - w.worldX, 2) + Math.pow(-S.ench.y - .5 - w.worldY, 2) > 36)) closeEnchant();   // (lejos o la rompieron)
        // 🌀 portales: el del Nether (bloque "portal") y el del End (marco del portal encendido, estado 2). Como el juego, se cambia
        // al final del paso. Hay que salir del portal antes de volver a usarlo (se llega parado en él).
        if (!(w.dead > 0) && w.gamemode != 3) {
            const bx = Math.floor(w.worldX), by = Math.floor(-w.worldY);
            const isP = function (x, y) { return fg(x, y) === 'portal'; };
            const nether = isP(bx, by) || isP(bx, by + 1) || isP(Math.floor(w.worldX - .3), by) || isP(Math.floor(w.worldX + .3), by);
            const isF = function (x, y) { return fg(x, y) === 'pf' && Number(st(x, y)) === 2 && pfOpen(x, y); };   // (toda la fila con ojos)
            const end = !nether && (isF(bx, by) || isF(bx, by - 1));
            // (como pediste: hay que quedarse 4 segundos en el portal; la pantalla se va poniendo morada)
            if (nether || end) { if (!S.portalLock) { S.portalT = (S.portalT || 0) + 1; S.portalKind = nether ? 1 : 2; if (S.portalT === 1) sndAt('Portal' + ((Math.random() * 5 | 0) + 1)); if (S.portalT >= 4 * FPS) { S.portalLock = true; S.portalT = 0; S.portalGo = S.portalKind; } } }
            else { S.portalLock = false; S.portalT = 0; }
        }
        // el botón "Open": el bloque bajo el cursor (si se abre y está a la mano) o, si no, el más cercano; se revisa 10 veces por segundo
        if (S.tick % 5 === 0) { const b = findBox(); const k = b ? b.x + ',' + b.y + ',' + b.t : ''; if (k !== (S.box ? S.box.x + ',' + S.box.y + ',' + S.box.t : '')) { S.box = b; hud.dirty = true; } }
        // arena / grava que hay que revisar
        if (S.sandCheck.size) {
            let n = 0;
            const due = [];
            S.sandCheck.forEach(function (t, k) { if (t <= S.tick && n < 400) { due.push(k); n++; } });
            due.forEach(function (k) { if (S.sandCheck.get(k) > S.tick) return; S.sandCheck.delete(k); const pp = k.split(','); checkSand(+pp[0], +pp[1]); });   // (si el de abajo acaba de caer, este espera 2 pasos más)
        }
        // 🧭 distancia de simulación: dónde están los jugadores (una vez por paso). Lo que está a más de SIM_DIST bloques
        // de todos se queda quieto (mobs, objetos tirados, flechas, bolitas de experiencia, bloques cayendo, líquidos).
        const px = w.worldX;
        // 🎮 en multijugador el anfitrión mueve también los mobs que están cerca de los otros jugadores; el invitado no los mueve: le llegan
        const pxs = [px];
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const r = remoteOf(RP + k); if (r) pxs.push(r.tx); } }
        S.simX = pxs; S.plPos = null;
        tickLiquids();
        tickFalling();
        tickDrops();
        tickOrbs();
        tickArrows();
        tickSaplings();
        tickShots();
        tickEyes();
        tickBalloons();
        tickFireballs();
        if (mpGuest()) { if (window.mbwMpPlay.mobLerp) window.mbwMpPlay.mobLerp(); }
        else for (const id in mbwom.mobs) {
            const m = mbwom.mobs[id];
            if (!m || !m.type) continue;
            if (m.mbweSp && S.tick % 2 === 0 && despawnCheck(id, m, S.plPos || (S.plPos = allPlPos()))) continue;   // 👻 lejos de todos: desaparece
            if (simFar(m.x, MOB_SIM)) continue;                                  // lejos: quieto (como el juego fuera de pantalla)
            if (S.tick % 10 === 0) tmpOf(id).far = simFar(m.x, 24);
            try { mobTick(id, m); } catch (e) { if (!S.mobErr) { S.mobErr = true; console.warn('play mob', e); } }
        }
        if (S.msgT > 0) S.msgT--;
        tickSign();
        if (S.iname.t > 0) S.iname.t--;
        if (S.tick % 10 === 0) tickAmbience();
        if (S.tick % 10 === 5) tickSpawners();
        if (S.tick % 4 === 2) tickRedstone();
        if (S.tick % 5 === 3) tickLeaves();
        tickParticles();
        if (S.portalGo) { const k = S.portalGo; S.portalGo = 0; usePortal(k); }
    }
    // ✨ PARTÍCULAS (menú de pausa > Options > Particles: All / Some / None), como el juego:
    //   · lava y ácido con aire arriba: de vez en cuando "revienta" una burbujita (Block_Lava: lavabubble) — naranja / verde
    //   · antorchas: flamita y humo (la de redstone: polvito rojo) · spawner de monstruos encendido: humo y flamitas
    //   · agua: al entrar o salir del agua (tú y los otros jugadores) salpica; debajo del agua salen burbujas
    // Solo se ven: no cambian nada del mundo. "Some" = menos y sin las de los bloques del fondo.
    S.parts = [];
    function partLevel() { return OPTS.particles === 'none' ? 0 : OPTS.particles === 'some' ? 1 : 2; }
    function addPart(o) { if (S.parts.length >= 500) return; const life = o.life || 25; S.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 1, size: .1, col: '#fff', max: life, life: life }, o)); }
    const TORCHES = { th: 'fire', ortorch: 'fire', rstorch: 'red' };
    const isWet = function (t) { return t === 'wr' || t === 'sw'; };
    function openAbove(x, y) { const t = fg(x, y + 1); return t === 'air' || (bd(t, 'walkThroughBlockHit') == 1 && bd(t, 'liquid') == null && !isWet(t)); }
    function torchTip(x, y) { const o = Number(st(x, y)); return o === 2 ? { x: x + .68, y: y + .72 } : o === 3 ? { x: x + .32, y: y + .72 } : { x: x + .5, y: y + .66 }; }
    function liquidPop(x, y, t) {
        const acid = t === 'ad';
        const col = acid ? ['#9dff5a', '#54d62c', '#d8ffb0'] : ['#ffb02e', '#ff7a12', '#ffe07a'];
        const n = 1 + (Math.random() * 3 | 0);
        for (let i = 0; i < n; i++) addPart({ x: x + .2 + Math.random() * .6, y: y + 1, vx: (Math.random() - .5) * .05, vy: .06 + Math.random() * .08, g: .006, life: 30 + (Math.random() * 25 | 0), size: .08 + Math.random() * .06, col: col[i % 3], glow: true });
    }
    function torchPuff(x, y, kind) {
        const p = torchTip(x, y);
        if (kind === 'red') { addPart({ x: p.x + (Math.random() - .5) * .15, y: p.y, vx: (Math.random() - .5) * .006, vy: .008 + Math.random() * .01, life: 30, size: .07, col: '#ff3b2f', glow: true }); return; }
        if (Math.random() < .5) addPart({ x: p.x + (Math.random() - .5) * .1, y: p.y, vy: .004, life: 12, size: .08, col: '#ffd24a', glow: true });
        addPart({ x: p.x + (Math.random() - .5) * .1, y: p.y + .08, vx: (Math.random() - .5) * .006, vy: .018 + Math.random() * .01, drag: .97, life: 40, size: .09, col: 'rgba(70,70,70,.8)' });
    }
    function splash(x, y, n) {
        for (let i = 0; i < n; i++) addPart({ x: x + (Math.random() - .5) * .9, y: y, vx: (Math.random() - .5) * .12, vy: .08 + Math.random() * .12, g: .012, life: 28 + (Math.random() * 14 | 0), size: .07 + Math.random() * .05, col: i % 3 ? '#4f8dff' : '#a9d0ff' });
    }
    function bubble(x, y) { addPart({ kind: 'bubble', x: x + (Math.random() - .5) * .5, y: y, vx: (Math.random() - .5) * .01, vy: .03 + Math.random() * .02, life: 70, size: .08 + Math.random() * .05, col: 'rgba(200,230,255,.9)', ring: true }); }
    function emitBlockParts(L) {
        if (typeof camera === 'undefined' || !mbwom.scene) return;
        const x0 = Math.floor(camera.x) - 1, x1 = Math.ceil(camera.x + canvas.width / tileSize) + 1;
        const y0 = Math.max(0, Math.floor(camera.y) - 1), y1 = Math.ceil(camera.y + canvas.height / tileSize) + 1;
        if ((x1 - x0) * (y1 - y0) > 9000) return;                      // (zoom muy alejado: no)
        const k = L === 2 ? 1 : .3;
        for (let x = x0; x <= x1; x++) {
            const col = mbwom.scene[x]; if (!col) continue;
            const top = Math.min(y1, col.length - 1);
            for (let y = y0; y <= top; y++) {
                const t = col[y]; if (!t) continue;
                if (t === 'la' || t === 'ad') { if (L === 2 && Math.random() < .006 && openAbove(x, y)) liquidPop(x, y, t); }
                else if (TORCHES[t]) { if (Math.random() < .14 * k) torchPuff(x, y, TORCHES[t]); }
                else if (t === 'mobSpawner') { if (Math.random() < .25 * k && S.spawnOn && S.spawnOn.has(x + ',' + y)) { addPart({ x: x + .2 + Math.random() * .6, y: y + .2 + Math.random() * .6, vy: .012, life: 18, size: .09, col: '#ffcf4a', glow: true }); addPart({ x: x + Math.random(), y: y + .5 + Math.random() * .5, vy: .02, drag: .97, life: 35, size: .1, col: 'rgba(60,60,60,.75)' }); } }
            }
        }
    }
    // ¿entró o salió del agua? (el Player y los otros jugadores) — salpicada; debajo del agua, burbujas
    function waterParts(L) {
        const w = W();
        const bodies = [{ k: 'me', x: Number(w.worldX), y: -Number(w.worldY), ok: !(w.dead > 0) && w.gamemode != 3 }];
        if (S.mp && window.mbwMpPlay) { const R = window.mbwMpPlay.remotes || {}; Object.keys(R).forEach(function (q) { const r = remoteOf(RP + q); if (r) bodies.push({ k: q, x: Number(r.tx), y: -Number(r.ty), ok: true }); }); }
        S.wetWas = S.wetWas || {};
        bodies.forEach(function (b) {
            if (!b.ok || !isFinite(b.x) || !isFinite(b.y)) return;
            const bx = Math.floor(b.x), by = Math.floor(b.y);
            const wet = isWet(fg(bx, by)) || isWet(fg(bx, by + 1));
            const was = S.wetWas[b.k];
            if (was !== undefined && wet !== was) {
                let sy = by; for (let i = 0; i < 4 && isWet(fg(bx, sy + 1)); i++) sy++;      // (la superficie del agua)
                splash(b.x, (wet ? sy : by) + (wet ? 1 : .2), L === 2 ? 10 : 4);
            }
            S.wetWas[b.k] = wet;
            if (isWet(fg(bx, by + 1)) && Math.random() < (L === 2 ? .08 : .03)) bubble(b.x, b.y + 1.5);   // (la cabeza debajo del agua)
        });
    }
    function tickParticles() {
        const L = partLevel();
        if (!L) { if (S.parts.length) S.parts.length = 0; return; }
        if (S.tick % 2 === 0) emitBlockParts(L);
        waterParts(L);
        for (let i = S.parts.length - 1; i >= 0; i--) {
            const p = S.parts[i];
            p.vy -= p.g; p.vx *= p.drag; p.vy *= p.drag;
            p.x += p.vx; p.y += p.vy; p.life--;
            if (p.kind === 'bubble' && !isWet(fg(Math.floor(p.x), Math.floor(p.y)))) p.life = 0;   // (la burbuja revienta al salir del agua)
            if (p.life <= 0) S.parts.splice(i, 1);
        }
    }
    function drawParticles(c2) {
        if (!S.parts.length) return;
        const ts = tileSize;
        for (let i = 0; i < S.parts.length; i++) {
            const p = S.parts[i];
            const q = toScreen(p.x, -p.y), sz = Math.max(2, p.size * ts);
            c2.globalAlpha = Math.max(0, Math.min(1, (p.life / p.max) * 1.6));
            if (p.ring) { c2.strokeStyle = p.col; c2.lineWidth = Math.max(1, sz / 4); c2.strokeRect(Math.round(q.x - sz / 2), Math.round(q.y - sz / 2), Math.round(sz), Math.round(sz)); }
            else { c2.fillStyle = p.col; c2.fillRect(Math.round(q.x - sz / 2), Math.round(q.y - sz / 2), Math.round(sz), Math.round(sz)); }
        }
        c2.globalAlpha = 1;
    }
    window.mbwPlay.particles = function () { return S.parts; };
    // ❤ La vida de los mobs y de los otros jugadores en corazones (a los jugadores también el hambre) y 🎒 la casilla con lo que
    // agarró un jugador cuando cambia de casilla (yo y los demás), arriba de la cabeza
    const heartImg = new Image(); heartImg.src = 'assets/HEALTH.png';
    const foodImg = new Image(); foodImg.src = 'assets/HUNGER.png';
    function iconSet(img) {
        if (!(img.complete && img.naturalWidth)) return null;
        if (img.__set) return img.__set;
        const mk = function (fn) { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; fn(x); return c; };
        const empty = mk(function (x) { x.drawImage(img, 0, 0, 32, 32); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgba(25,25,25,.6)'; x.fillRect(0, 0, 32, 32); });
        const full = mk(function (x) { x.drawImage(img, 0, 0, 32, 32); });
        const half = mk(function (x) { x.drawImage(empty, 0, 0); x.drawImage(img, 0, 0, 16, 32, 0, 0, 16, 32); });
        return (img.__set = { f: full, h: half, e: empty });
    }
    // una fila (o dos) de corazones / muslos: val y max en medios (como la vida: 20 = 10 corazones). Devuelve cuánto ocupó de alto.
    function iconRows(c2, set, val, max, cx, bottom, sz) {
        const n = Math.ceil(max / 2);
        if (n > 20) {                                                  // muchísima vida (el dragón): un corazón y el número
            const fs = Math.max(9, Math.round(sz * 1.05));
            c2.font = 'bold ' + fs + 'px Arial, sans-serif'; c2.textAlign = 'left'; c2.textBaseline = 'middle';
            const txt = Math.max(0, Math.ceil(val)) + ' / ' + max, tw = c2.measureText(txt).width;
            const x = cx - (sz + 3 + tw) / 2, y = bottom - sz;
            c2.drawImage(set.f, x, y, sz, sz);
            c2.fillStyle = 'rgba(0,0,0,.6)'; c2.fillText(txt, x + sz + 4, y + sz / 2 + 1); c2.fillStyle = '#fff'; c2.fillText(txt, x + sz + 3, y + sz / 2);
            return sz;
        }
        const rows = n > 10 ? 2 : 1, per = Math.min(10, n);
        for (let i = 0; i < n; i++) {
            const row = Math.floor(i / 10), col = i % 10;
            const k = val >= (i + 1) * 2 ? 'f' : val >= i * 2 + 1 ? 'h' : 'e';
            c2.drawImage(set[k], Math.round(cx - per * sz / 2 + col * sz), Math.round(bottom - sz * (row + 1)), sz, sz);
        }
        return rows * sz;
    }
    function slotBox(c2, id, cx, bottom, sz, a) {
        c2.globalAlpha = a;
        c2.fillStyle = 'rgba(30,30,30,.85)'; c2.fillRect(Math.round(cx - sz / 2), Math.round(bottom - sz), sz, sz);
        c2.strokeStyle = '#d8d8d8'; c2.lineWidth = Math.max(1, sz / 14); c2.strokeRect(Math.round(cx - sz / 2) + .5, Math.round(bottom - sz) + .5, sz - 1, sz - 1);
        if (id && id !== 'air') { const p = Math.round(sz * .14); c2.drawImage(iconFor(id), Math.round(cx - sz / 2) + p, Math.round(bottom - sz) + p, sz - 2 * p, sz - 2 * p); }
        c2.globalAlpha = 1;
    }
    function drawBars(c2) {
        const hs = iconSet(heartImg), fs2 = iconSet(foodImg);
        const ts = tileSize, sz = Math.max(6, Math.round(ts * .24)), now = Date.now();
        const vx0 = camera.x - 2, vx1 = camera.x + canvas.width / ts + 2;
        c2.imageSmoothingEnabled = false;
        // los mobs
        if (hs) for (const id in mbwom.mobs) {
            const m = mbwom.mobs[id];
            if (!m || !m.type || m.dead > 0 || m.x < vx0 || m.x > vx1) continue;
            const mx = maxHealth(m), hp = Math.max(0, Math.min(mx, Number(m.health)));
            if (!isFinite(hp)) continue;
            // arriba del dibujo del mob y de su nombre (main.js drawMobs: el nombre va 8 px arriba del dibujo)
            let dh = 2; try { if (typeof getMobDrawInfo === 'function') dh = getMobDrawInfo(m, true).h || 2; } catch (e) { /* nada */ }
            const top = toScreen(m.x, m.y).y - dh * ts;
            iconRows(c2, hs, hp, mx, (m.x - camera.x) * ts, top - (window.hideMobNames ? 4 : 22), sz);
        }
        // los otros jugadores: vida y hambre arriba de su nombre (en supervivencia y aventura), y su casilla al cambiarla
        const fsN = Math.max(10, Math.round(ts * .42)), ph = ts * 2;
        if (S.mp && window.mbwMpPlay) {
            const MP = window.mbwMpPlay, R = MP.remotes || {};
            Object.keys(R).forEach(function (k) {
                const r = remoteOf(RP + k); if (!r || r.iv) return;
                const pos = MP.posOf ? MP.posOf(k) : { x: r.tx, y: r.ty };
                const sx = (pos.x - camera.x) * ts, feet = canvas.height - (-pos.y - camera.y) * ts;
                let bottom = feet - ph - fsN - 11;
                if ((r.gm == 0 || r.gm == 2) && hs && isFinite(Number(r.hp))) {
                    bottom -= iconRows(c2, hs, Number(r.hp), 20, sx, bottom, sz) + 2;
                    if (fs2 && isFinite(Number(r.fd))) bottom -= iconRows(c2, fs2, Number(r.fd) / 50, 20, sx, bottom, sz) + 2;
                }
                if (r.selT && now - r.selT < 1500) slotBox(c2, r.it, sx, bottom - 2, Math.round(ts * .7), Math.min(1, (1500 - (now - r.selT)) / 400));
            });
        }
        // yo: la casilla nueva arriba de la cabeza
        const w = W(), si = selIndex();
        if (S.selPrev === undefined || S.selPrev === null) S.selPrev = si;
        else if (S.selPrev !== si) { S.selPrev = si; S.selShow = now; }
        if (S.selShow && now - S.selShow < 1500 && !(w.dead > 0) && w.gamemode != 3) {
            const sx = (Number(w.worldX) - camera.x) * ts, feet = canvas.height - (-Number(w.worldY) - camera.y) * ts;
            slotBox(c2, selType(), sx, feet - ph - 6, Math.round(ts * .7), Math.min(1, (1500 - (now - S.selShow)) / 400));
        }
    }


    // 👾 SPAWNER DE MONSTRUOS ("mobSpawner", los de los calabozos): con un jugador a menos de 16 cuadros, cada 10 a 40 segundos
    // saca de 1 a 4 monstruos del Overworld (zombi, esqueleto, araña o creeper; nunca lobos) cerca de él, en un lugar libre,
    // si no hay ya 6 monstruos alrededor. Solo lo hace quien mueve los mobs (solo o el anfitrión de la partida).
    const SPAWNER_MOBS = ['zombie', 'skeleton', 'spider', 'creeper'];
    // 🍃 Hojas que se quedan sin árbol: si se quita un tronco (madera wd / wd1), las hojas que tenía cerca se revisan; las que
    // ya no tienen madera a 6 bloques o menos se van deshaciendo poco a poco, una por una (como en Minecraft). Sueltan a veces
    // un brote, y las que tienen fruta sueltan su fruta. Las hojas que se pusieron lejos de cualquier árbol NO se tocan (solo
    // se revisan las que estaban cerca de un tronco que se quitó). En multijugador lo hace quien lleva la partida.
    const LEAF_FRUIT = { lv: null, lv1: 'ap', lv2: 'or', lv3: 'gap', lv4: 'lemon' }, LOGS = { wd: 1, wd1: 1 }, LEAF_R = 6;
    function isLeaf(t) { return Object.prototype.hasOwnProperty.call(LEAF_FRUIT, t); }
    function logNear(x, y) {
        for (let dx = -LEAF_R; dx <= LEAF_R; dx++) for (let dy = -LEAF_R; dy <= LEAF_R; dy++) if (dx * dx + dy * dy <= LEAF_R * LEAF_R && LOGS[fg(x + dx, y + dy)]) return true;
        return false;
    }
    function leafLogGone(x, y) {                                   // se quitó un tronco en (x, y): sus hojas cercanas a la lista
        if (!S.playing || !S.leafQ) return;
        const R = LEAF_R + 1;
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
            const lx = x + dx, ly = y + dy;
            if (ly < 0 || !isLeaf(fg(lx, ly))) continue;
            const k = lx + ',' + ly;
            if (!S.leafQ.has(k)) S.leafQ.set(k, S.tick + 20 + (Math.random() * 220 | 0));   // (cada una a su tiempo: se ven caer de a poco)
        }
    }
    function allPlPos() {                                                    // dónde están los jugadores (x, y del mundo)
        const w = W(), out = [[Number(w.worldX), Number(w.worldY)]];
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const r = remoteOf(RP + k); if (r) out.push([Number(r.tx), Number(r.ty)]); } }
        return out;
    }
    function tickLeaves() {
        if (!S.leafQ.size || mpGuest()) return;
        let done = 0;
        for (const [k, at] of S.leafQ) {
            if (at > S.tick) continue;
            S.leafQ.delete(k);
            const i = k.indexOf(','), x = +k.slice(0, i), y = +k.slice(i + 1), t = fg(x, y);
            if (!isLeaf(t) || logNear(x, y)) continue;               // ya no está, o todavía tiene un tronco cerca
            setBlock(x, y, null);
            for (let n = 0; n < 7; n++) addPart({ x: x + Math.random(), y: y + Math.random(), vx: (Math.random() - .5) * .04, vy: -Math.random() * .03, g: .004, life: 26 + (Math.random() * 18 | 0), size: .09, col: n % 2 ? '#3f8f2c' : '#5fb240' });
            if (Math.random() < 1 / 20) addDrop('sl', x + .5, -y - .5, 1, 0, {});
            if (LEAF_FRUIT[t]) addDrop(LEAF_FRUIT[t], x + .5, -y - .5, 1, 0, {});
            if (++done >= 2) break;                                    // (como mucho 2 por vez)
        }
    }
    // cualquier cambio de bloque (míos, de otro jugador, de un pistón, de una explosión...) pasa por mbwom.setBlockState
    function hookLeafWatch() {
        if (typeof mbwom === 'undefined' || typeof mbwom.setBlockState !== 'function') return;
        let f = mbwom.setBlockState; for (let n = 0; f && n < 6; n++) { if (f.__leaf) return; f = f.__inner; }
        const o = mbwom.setBlockState;
        const nw = function (x, y, s) {
            const was = S.playing ? fg(x, y) : null;
            const r = o.apply(this, arguments);
            if (was && LOGS[was] && !(s && LOGS[s.type])) { try { leafLogGone(x, y); } catch (e) { /* nada */ } }
            return r;
        };
        nw.__leaf = true; nw.__inner = o;
        Object.keys(o).forEach(function (k) { if (k !== '__inner') nw[k] = o[k]; });   // (las marcas de los otros enganches se conservan)
        mbwom.setBlockState = nw;
    }
    window.mbwPlay.leaves = { pending: function () { return S.leafQ ? S.leafQ.size : 0; }, logGone: function (x, y) { leafLogGone(x, y); }, tick: function () { tickLeaves(); } };
    function tickSpawners() {
        if (mpGuest() || !mbwom.scene) return;
        const w = W(), pl = [{ x: Number(w.worldX), y: -Number(w.worldY) }];
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const r = remoteOf(RP + k); if (r) pl.push({ x: Number(r.tx), y: -Number(r.ty) }); } }
        const seen = new Set(), on = new Set();
        S.spawnT = S.spawnT || new Map();
        pl.forEach(function (p) {
            const px = Math.floor(p.x), py = Math.floor(p.y);
            for (let x = px - 16; x <= px + 16; x++) {
                const col = mbwom.scene[x]; if (!col) continue;
                for (let y = Math.max(0, py - 16); y <= Math.min(col.length - 1, py + 16); y++) {
                    if (col[y] !== 'mobSpawner') continue;
                    const k = x + ',' + y; if (seen.has(k)) continue; seen.add(k); on.add(k);
                    let t = S.spawnT.get(k); if (t === undefined) t = Math.round(FPS * (10 + Math.random() * 30));
                    t -= 10;                                           // (se revisa cada 10 pasos)
                    if (t <= 0) { spawnerFire(x, y); t = Math.round(FPS * (10 + Math.random() * 30)); }
                    S.spawnT.set(k, t);
                }
            }
        });
        S.spawnOn = on;
    }
    function spawnerFire(x, y) {
        let near = 0;
        for (const id in mbwom.mobs) { const m = mbwom.mobs[id]; if (m && SPAWNER_MOBS.indexOf(m.type) >= 0 && Math.abs(m.x - x) < 9 && Math.abs(-m.y - y) < 9) near++; }
        if (near >= 6) return;
        let spawned = 0; for (const id in mbwom.mobs) { const m = mbwom.mobs[id]; if (m && m.mbweSp) spawned++; }
        if (spawned >= MOB_CAP) return;                                        // (tope de mobs de spawner en la dimensión)
        const n = Math.min(6 - near, 1 + (Math.random() * 4 | 0));
        for (let i = 0; i < n; i++) {
            const type = SPAWNER_MOBS[Math.random() * SPAWNER_MOBS.length | 0];
            if (!D.mobs[type]) continue;
            for (let tries = 0; tries < 8; tries++) {
                const sx = x + Math.round((Math.random() * 2 - 1) * 4), sy = y + Math.round(Math.random() * 2 - 1);
                if (sx === x && sy === y) continue;
                if (!standable(sx, sy)) continue;
                spawnMob(type, sx + .5, -sy, { mbweSp: 1 });                    // (marcado: puede desaparecer si queda lejos)
                for (let j = 0; j < 6; j++) addPart({ x: sx + Math.random(), y: sy + Math.random() * 1.6, vy: .02, drag: .96, life: 30, size: .14, col: 'rgba(90,90,90,.8)' });
                break;
            }
        }
    }
    window.mbwPlay.spawnerFire = spawnerFire;
    // 👻 Mobs lejanos que desaparecen (como en Minecraft): solo los que salieron de un spawner jugando (los que pusiste en el editor
    // NUNCA desaparecen), y no si tienen nombre o están domesticados. A más de 64 bloques de todos los jugadores: se van ya;
    // entre 32 y 64: poco a poco (1 de cada 800 por paso). Así no se juntan cientos de mobs lejos que nadie ve.
    const MOB_CAP = 40, DESPAWN_NEAR = 32, DESPAWN_FAR = 64;
    function despawnCheck(id, m, pls) {
        if (!m.mbweSp || m.name || m.nameChange || m.tamed) return false;
        let d = Infinity; const mx = Number(m.x), my = Number(m.y);
        for (let i = 0; i < pls.length; i++) { const dx = mx - pls[i][0], dy = my - pls[i][1]; const dd = Math.sqrt(dx * dx + dy * dy); if (dd < d) d = dd; }
        if (d > DESPAWN_FAR || (d > DESPAWN_NEAR && Math.random() < 1 / 800)) { delete mbwom.mobs[id]; if (S.mp && window.mbwMpPlay && window.mbwMpPlay.mobGone) { try { window.mbwMpPlay.mobGone(id); } catch (e) { /* nada */ } } return true; }
        return false;
    }
    window.mbwPlay.despawn = { cap: MOB_CAP, check: function (id) { const m = mbwom.mobs[id], w = W(); return m ? despawnCheck(id, m, [[Number(w.worldX), Number(w.worldY)]]) : false; } };

    // 🔴 REDSTONE en el Modo Jugar (12 veces por segundo, cerca de los jugadores; en una partida lo hace solo quien la lleva)
    //   Fuentes (fuerza 15): palanca encendida, antorcha de redstone, botón apretado (1 segundo), placa de presión con alguien encima.
    //   El polvo de redstone ("rsd") lleva la señal y pierde 1 de fuerza por cada polvo (llega a 15 polvos); sube y baja escalones.
    //   Lo que toca una fuente, un polvo encendido o un bloque sólido que está junto a ellos, recibe señal:
    //     lámpara de redstone (se prende) · puertas y trampillas (se abren) · puertas de cerca · pistón y pistón pegajoso (empujan
    //     hasta 12 bloques; el pegajoso jala al regresar) · dispenser (dispara o avienta lo que tiene) · dropper (lo suelta)
    //     · TNT (se prende) · bloque musical (suena).  El polvo encendido se dibuja rojo brillante (hasSignal = [fuerza]).
    const DOOR_RE = /^(dr|bdr|bbdr|idr)([1-4])$/;
    const IMMOVABLE = { br: 1, b: 1, ob: 1, portal: 1, pf: 1, chest: 1, oven: 1, dispense: 1, dropper: 1, sign: 1, enchant: 1, brew: 1, piston1: 1, spiston1: 1, piston2: 1, spiston2: 1, mobSpawner: 1, bed1: 1, bed2: 1 };
    const DIRV = { 1: [0, 1], 2: [1, 0], 3: [0, -1], 4: [-1, 0] };
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    function rsKey(x, y) { return x + ',' + y; }
    function rsSource(x, y, t) {
        if (t === 'lever') return Number((mbwom.getBlockState(x, y) || {}).states2) === 1;
        if (t === 'rstorch') return true;
        if (t === 'button') return (S.btn && S.btn.get(rsKey(x, y)) > S.tick);
        if (t === 'pp' || t === 'wpp') return !!(S.plates && S.plates.has(rsKey(x, y))) || !!(S.plateHold && S.plateHold.get(rsKey(x, y)) > S.tick);   // (al bajarse, 2 s más)
        return false;
    }
    function rsSolid(t) { return !!t && t !== 'air' && bd(t, 'walkThroughBlock') != 1 && bd(t, 'liquid') == null; }
    function rsConsumer(t) { return t === 'light' || t === 'railp' || t === 'raila' || DOOR_RE.test(t) || t === 'td1' || t === 'td2' || t === 'fncg' || t === 'nfncg' || t === 'dispense' || t === 'dropper' || t === 'piston' || t === 'spiston' || t === 'piston1' || t === 'spiston1' || t === 'TNT' || t === 'note'; }
    function tickRedstone() {
        if (mpGuest() || !mbwom.scene) return;
        const w = W();
        // quién está parado en una placa de presión
        S.plates = new Set();
        const feet = function (x, y) { const k = rsKey(Math.floor(x), Math.floor(-y + .1)); S.plates.add(k); };
        if (!(w.dead > 0) && w.gamemode != 3) feet(w.worldX, w.worldY);
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const r = remoteOf(RP + k); if (r) feet(r.tx, r.ty); } }
        for (const id in mbwom.mobs) { const m = mbwom.mobs[id]; if (m && !(m.dead > 0)) feet(m.x, m.y); }
        S.drops.forEach(function (d) { feet(d.x, d.y - .05); });     // (también los objetos tirados aprietan la placa)
        // ⏱ la placa sigue apretada 2 segundos después de bajarse (así la puerta queda abierta 2 s y luego se cierra sola)
        S.plateHold = S.plateHold || new Map();
        S.plates.forEach(function (k) { const c = k.split(','), t = fg(+c[0], +c[1]); if (t === 'pp' || t === 'wpp') S.plateHold.set(k, S.tick + 2 * FPS); });
        if (S.plateHold.size > 200) S.plateHold.forEach(function (v, k) { if (v <= S.tick) S.plateHold.delete(k); });
        // la zona: alrededor de cada jugador
        const centers = [[Math.floor(w.worldX), Math.floor(-w.worldY)]];
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const r = remoteOf(RP + k); if (r) centers.push([Math.floor(r.tx), Math.floor(-r.ty)]); } }
        const RX = 32, RY = 24, power = new Map(), sources = [], consumers = [], dusts = [];
        const seen = new Set();
        centers.forEach(function (c) {
            for (let x = c[0] - RX; x <= c[0] + RX; x++) {
                const col = mbwom.scene[x]; if (!col) continue;
                for (let y = Math.max(0, c[1] - RY); y <= Math.min(col.length - 1, c[1] + RY); y++) {
                    const t = col[y]; if (!t) continue;
                    const k = rsKey(x, y); if (seen.has(k)) continue; seen.add(k);
                    if (t === 'rsd') dusts.push([x, y]);
                    else if (rsSource(x, y, t)) sources.push([x, y]);
                    if (rsConsumer(t)) consumers.push([x, y, t]);
                }
            }
        });
        // el polvo: desde las fuentes, perdiendo 1 por paso
        const q = [];
        sources.forEach(function (sc) { N4.forEach(function (d) { const x = sc[0] + d[0], y = sc[1] + d[1]; if (fg(x, y) === 'rsd' && (power.get(rsKey(x, y)) || 0) < 15) { power.set(rsKey(x, y), 15); q.push([x, y, 15]); } }); });
        while (q.length) {
            const c = q.shift(); if (c[2] <= 1) continue;
            [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) {
                const x = c[0] + d[0], y = c[1] + d[1]; if (fg(x, y) !== 'rsd') return;
                const k = rsKey(x, y); if ((power.get(k) || 0) >= c[2] - 1) return;
                power.set(k, c[2] - 1); q.push([x, y, c[2] - 1]);
            });
        }
        // ¿le llega señal a (x, y)? (junto a una fuente o a un polvo encendido, o a un bloque sólido que está junto a ellos)
        const hot = new Set();
        sources.forEach(function (c) { hot.add(rsKey(c[0], c[1])); });
        power.forEach(function (v, k) { if (v > 0) hot.add(k); });
        // (palanca, antorcha, botón y placa también encienden lo que está en diagonal: radio de 1 bloque alrededor)
        const src = new Set(); sources.forEach(function (c) { src.add(rsKey(c[0], c[1])); });
        const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
        const near = function (x, y) { return N4.some(function (d) { return hot.has(rsKey(x + d[0], y + d[1])); }) || N8.some(function (d) { return src.has(rsKey(x + d[0], y + d[1])); }); };
        const fed = function (x, y) {
            if (near(x, y)) return true;
            return N4.some(function (d) { const bx = x + d[0], by = y + d[1]; return rsSolid(fg(bx, by)) && !rsConsumer(fg(bx, by)) && near(bx, by); });
        };
        // dibujar el polvo (encendido / apagado)
        dusts.forEach(function (c) {
            const k = rsKey(c[0], c[1]), v = power.get(k) || 0, cur = mbwom.getBlockState(c[0], c[1]) || {};
            const was = Array.isArray(cur.hasSignal) ? Number(cur.hasSignal[0]) || 0 : 0;
            if (was !== v) { const ns = JSON.parse(JSON.stringify(cur)); ns.type = 'rsd'; ns.hasSignal = v > 0 ? [v] : undefined; mbwom.setBlockState(c[0], c[1], ns); if (typeof window.renderBlock === 'function') window.renderBlock(c[0], c[1]); }
        });
        // lo que recibe la señal
        S.rsOn = S.rsOn || new Map();
        const first = !S.rsReady; S.rsReady = true;
        consumers.forEach(function (c) {
            const x = c[0], y = c[1], t = c[2];
            let on;
            const dm = DOOR_RE.exec(t);
            if (dm && (dm[2] === '2' || dm[2] === '4')) return;              // (la puerta se maneja desde su parte de abajo)
            if (dm) on = fed(x, y) || fed(x, y + 1);
            else on = fed(x, y);
            const k = rsKey(x, y), prev = S.rsOn.get(k);
            S.rsOn.set(k, on);
            if (t === 'light') { const cur = mbwom.getBlockState(x, y) || {}, was = Array.isArray(cur.hasSignal) && Number(cur.hasSignal[0]) > 0; if (was !== on) { const ns = JSON.parse(JSON.stringify(cur)); ns.type = 'light'; ns.hasSignal = on ? [15] : undefined; mbwom.setBlockState(x, y, ns); if (typeof window.renderBlock === 'function') window.renderBlock(x, y); } return; }
            if (t === 'railp' || t === 'raila') { const was = !!(mbwom.hasSignal && mbwom.hasSignal[key(x, y)]); if (was !== on) { if (!mbwom.hasSignal || typeof mbwom.hasSignal !== 'object') { mbwom.hasSignal = {}; mbwom.world['hasSignal' + (mbwom.currentScene || 1)] = mbwom.hasSignal; } if (on) mbwom.hasSignal[key(x, y)] = [15]; else delete mbwom.hasSignal[key(x, y)]; } return; }   // 🚃 rieles con energía
            if (prev === on || (prev === undefined && !on)) return;          // (solo cuando cambia)
            if (dm) { const cur = DOOR_RE.exec(fg(x, y)); if (cur) { const isOpen = cur[2] === '1'; if (isOpen !== on) { doorToggle(x, y); if (on && nearMe(x + .5, -y, 10)) ach(32); } } return; }
            if (t === 'td1' || t === 'td2') { if ((t === 'td1') !== on) useBlock(x, y); return; }
            if (t === 'fncg' || t === 'nfncg') { if ((st(x, y) == 1) !== on) useBlock(x, y); return; }
            if (t === 'piston' || t === 'spiston' || t === 'piston1' || t === 'spiston1') { pistonSet(x, y, on); return; }
            if (!on || first) return;                                      // (de aquí en adelante: solo al prenderse)
            if (t === 'TNT') igniteTNT(x, y);
            else if (t === 'note') playNote(x, y);
            else if (t === 'dispense' || t === 'dropper') dispenseOne(x, y, t);
        });
    }
    // pistón: extender (empuja hasta 12 bloques) / regresar (el pegajoso jala el de enfrente)
    function pistonSet(x, y, on) {
        const t = fg(x, y), sticky = t.charAt(0) === 's', base = sticky ? 'spiston' : 'piston';
        const dir = Number(st(x, y)) || 1, v = DIRV[dir] || DIRV[1];
        const ext = t === base + '1';
        if (on && !ext) {
            const line = []; let cx = x + v[0], cy = y + v[1];
            while (fg(cx, cy) !== 'air' && bd(fg(cx, cy), 'replaceable') != 1 && fg(cx, cy) !== 'wr' && fg(cx, cy) !== 'la') {
                if (IMMOVABLE[fg(cx, cy)] || line.length >= 12 || cy < 0) return;
                line.push([cx, cy]); cx += v[0]; cy += v[1];
            }
            for (let i = line.length - 1; i >= 0; i--) {                  // (de la punta hacia el pistón, para no pisar nada)
                const a = line[i], stt = JSON.parse(JSON.stringify(mbwom.getBlockState(a[0], a[1]) || {}));
                mbwom.setBlockState(a[0] + v[0], a[1] + v[1], stt); if (typeof window.renderBlock === 'function') window.renderBlock(a[0] + v[0], a[1] + v[1]);
            }
            setBlock(x + v[0], y + v[1], base + '2', dir);
            setBlock(x, y, base + '1', dir);
            sndAt('piston', x + .5, -(y + .5));
        } else if (!on && ext) {
            const ax = x + v[0], ay = y + v[1];
            if (fg(ax, ay) === base + '2') setBlock(ax, ay, null);
            if (sticky) {
                const fx = ax + v[0], fy = ay + v[1], ft = fg(fx, fy);
                if (ft !== 'air' && !IMMOVABLE[ft] && bd(ft, 'liquid') == null && fg(ax, ay) === 'air') {
                    const stt = JSON.parse(JSON.stringify(mbwom.getBlockState(fx, fy) || {}));
                    mbwom.setBlockState(ax, ay, stt); if (typeof window.renderBlock === 'function') window.renderBlock(ax, ay);
                    setBlock(fx, fy, null);
                }
            }
            setBlock(x, y, base, dir);
            sndAt('piston', x + .5, -(y + .5));
        }
    }
    // dispenser: dispara flechas / avienta lo demás; dropper: suelta. Hacia donde mira (states 1 arriba, 2 derecha, 3 abajo, 4 izquierda)
    function dispenseOne(x, y, t) {
        const key = 'blockX' + x + 'Y' + y + '_2';
        const list = mbwom.states && Array.isArray(mbwom.states[key]) ? mbwom.states[key] : null;
        if (!list) { sndAt('off', x + .5, -(y + .5)); return; }
        const idx = []; list.forEach(function (it, i) { if (it && !isEmpty(it)) idx.push(i); });
        if (!idx.length) { sndAt('off', x + .5, -(y + .5)); return; }
        const i = idx[Math.random() * idx.length | 0], it = list[i];
        const dir = Number(st(x, y)) || 2, v = DIRV[dir] || DIRV[2];
        const ox = x + .5 + v[0] * .7, oy = -(y + .5) - v[1] * .7;
        if (t === 'dispense' && it[0] === 'arrow') {
            S.arrows.push({ x: ox, y: oy, vx: migSpeed(22 * v[0]), vy: migSpeed(-22 * v[1] - (v[1] ? 0 : 2)), by: null, age: 0 });
            sndAt('bowsfx', ox, oy);
        } else if (t === 'dispense' && it[0] === 'fireegg') {
            explode(x + v[0] * 3, y + v[1] * 3, 1.5, null);
        } else {
            addDrop(String(it[0]), ox, oy, 1, it[2] || 0, it[3] || {});
            const d = S.drops[S.drops.length - 1]; if (d) { d.vx = 4 * v[0] + (Math.random() - .5); d.vy = -4 * v[1] - 1; }
            sndAt('off', x + .5, -(y + .5));
        }
        it[1] = (it[1] | 0) - 1; if (it[1] <= 0) list[i] = ['air', 0, 0, {}];
        netMark(x, y);
    }
    window.mbwPlay.redstone = { tick: function () { tickRedstone(); }, piston: pistonSet, dispense: dispenseOne };

    // 🎵🌧 Música (Game.onCertainInterval: en el Overworld, una canción al azar cada 4 a 6 minutos), lluvia, el sonido del Nether
    // y del End, y el fuego / los portales que estén cerca (Block_Fire, Block_Portal: de vez en cuando, desde donde están)
    function tickAmbience() {
        const X = SFX(); if (!X) return;
        const w = W(), sc = mbwom.currentScene || 1;
        if (sc === 1) {
            S.musicT -= 10;
            if (S.musicT <= 0) { S.musicT = FPS * (120 * Math.random() + 240) | 0; if (!X.musicName()) X.music('song' + ((Math.random() * 5 | 0) + 1)); }
        }
        X.loop('rain', X.isRaining() && sc === 1 ? 'rainsound' : null, .6, 'weather');
        X.loop('dim', sc === 2 ? 'Nether' : sc === 3 ? 'EnderBG' : null, .5);
        const px = Math.floor(w.worldX), py = Math.floor(-w.worldY);
        for (let x = px - 14; x <= px + 14; x++) for (let y = py - 10; y <= py + 12; y++) {
            const t = fg(x, y);
            if (t === 'fire' && Math.random() < .025 && S.tick - (S.lastFireSnd || -99) > 5) { S.lastFireSnd = S.tick; sndAt('fire' + ((Math.random() * 5 | 0) + 1), x + .5, -(y + .5)); }
            else if (t === 'portal' && Math.random() < .0025) sndAt('Portal' + ((Math.random() * 5 | 0) + 1), x + .5, -(y + .5));
        }
    }
    // 🪧 Letreros: si el jugador está parado frente a un letrero, su texto sale arriba en un tablero que aparece y se desvanece
    // poco a poco (como Game.showSign / renderSign del juego: +0.05 por cuadro al estar ahí, −0.05 al irse; aquí a 50 pasos, la mitad)
    function signTextAt(x, y) {
        if (fg(x, y) !== 'sign') return null;
        const o = mbwom.signs, v = o && typeof o === 'object' ? o[key(Math.floor(x), Math.floor(y))] : undefined;
        return typeof v === 'string' ? v : '';
    }
    function tickSign() {
        const w = W(), P = S.p, G = S.sign;
        let t = null;
        if (P && !(w.dead > 0)) {
            const by = Math.floor(-w.worldY);
            const xs = [w.worldX, w.worldX - .3, w.worldX + .3];
            for (let k = 0; k < xs.length && t === null; k++) for (let dy = 1; dy <= 2 && t === null; dy++) t = signTextAt(xs[k], by + dy);
        }
        if (t !== null && t.replace(/[\r\n\s]/g, '')) { G.text = t; G.a = Math.min(1, G.a + .025); G.on = true; }
        else { G.a = Math.max(0, G.a - .025); G.on = false; }
    }
    // Nombre del objeto de la mano: al cambiar de casilla (o de objeto) sale encima de la hotbar ~2 s y se desvanece
    const NAMES = {};
    function itemDisplayName(it) {
        const ex = (it && it[3] && typeof it[3] === 'object') ? it[3] : {};
        if (typeof ex.nameChange === 'string' && ex.nameChange.trim()) return ex.nameChange;
        const id = String(it[0]);
        if (!NAMES.__built) {
            const I = (window.MB_GAME && window.MB_GAME.identifiers) || {};
            Object.keys(I).forEach(function (k) { const v = I[k]; if (Array.isArray(v) && v[0] != null && !(v[0] in NAMES)) NAMES[v[0]] = v[1] || k; });
            NAMES.__built = true;
        }
        if (NAMES[id]) return NAMES[id];
        return id.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, function (c) { return c.toUpperCase(); });
    }
    window.mbwPlayItemName = itemDisplayName;
    function camSnap() { camFollow(1, 1); }
    // la cámara sigue al Player: de lado se desliza suave (kx); de arriba a abajo va pegada (ky = 1), así al caer rápido
    // el Player no se queda más abajo del centro de la pantalla
    function camFollow(k, ky) {
        if (ky == null) ky = 1;
        const w = W();
        let tx = w.worldX - (canvas.width / tileSize) / 2, ty = (-w.worldY + 1) - (canvas.height / tileSize) / 2;
        const A = window.mbwAspect;
        if (A && A.active && A.offsets) {                          // con la vista del juego: el Player en el centro del recuadro
            const o = A.offsets();
            tx = w.worldX - A.w / 2 - o.offX; ty = (-w.worldY + 1) - A.h / 2 - o.offY;
        }
        camera.x += (tx - camera.x) * k; camera.y += (ty - camera.y) * ky;
        camera._tx = camera.x; camera._ty = camera.y; camera.velX = 0; camera.velY = 0;
    }
    function frame(ts) {
        if (!S.playing) return;
        S.raf = requestAnimationFrame(frame);
        if (!S.last) S.last = ts;
        S.acc += Math.min(200, ts - S.last); S.last = ts;
        if (S.paused && !S.mp) { S.acc = 0; if (typeof worldDirty !== 'undefined') worldDirty = true; hud.update(); return; }   // ⏸ (solo: el mundo se detiene)
        let n = 0;
        while (S.acc >= 1000 / FPS && n < 6) { try { step(); } catch (e) { console.error('play step', e); } S.acc -= 1000 / FPS; n++; }
        if (n >= 6) S.acc = 0;
        camFollow(.25);
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        hud.update();
        loupe.update();
    }

    // ------------------------------------------------------------------ 🔍 lupa (celular): el dedo tapa el bloque que tocas
    //   Mientras el dedo está sobre el mapa, arriba sale una burbuja redonda con lo que hay debajo, en grande (×2.2),
    //   y el bloque elegido marcado (blanco = lo alcanzas · rojo = está lejos). Se apaga en Pausa > Opciones.
    const loupe = {
        el: null, cx: null, on: false,
        D: 132, Z: 2.2,
        down: function (e) { if (OPTS.loupe === false) return; S.touchAt = { id: e.pointerId, t: performance.now() }; },
        up: function (e) { if (S.touchAt && (!e || e.pointerId === S.touchAt.id)) S.touchAt = null; this.hide(); },
        hide: function () { if (this.el && this.on) { this.el.style.display = 'none'; this.on = false; } },
        make: function () {
            if (this.el) return;
            const c = document.createElement('canvas');
            c.id = 'ph-loupe';
            const dpr = Math.min(3, window.devicePixelRatio || 1);
            c.width = c.height = Math.round(this.D * dpr);
            document.body.appendChild(c);
            this.el = c; this.cx = c.getContext('2d');
        },
        update: function () {
            const t = S.touchAt;
            if (!t || OPTS.loupe === false || !S.playing || S.paused || performance.now() - t.t < 70) { this.hide(); return; }
            const cv = document.getElementById('canvas'); if (!cv) return;
            this.make();
            const r = cv.getBoundingClientRect(), fx = S.mouse.x, fy = S.mouse.y;
            if (fx < r.left || fx > r.right || fy < r.top || fy > r.bottom) { this.hide(); return; }
            const D = this.D, Z = this.Z, c = this.el, x = this.cx, k = c.width / D;
            // dónde va: arriba del dedo; si no cabe, a un lado
            let lx = fx - D / 2, ly = fy - D - 46;
            if (ly < 6) { ly = Math.max(6, fy - D / 2); lx = fx + 56 + D <= window.innerWidth - 6 ? fx + 56 : fx - 56 - D; }
            lx = Math.max(6, Math.min(window.innerWidth - D - 6, lx));
            c.style.left = Math.round(lx) + 'px'; c.style.top = Math.round(ly) + 'px';
            if (!this.on) { c.style.display = 'block'; this.on = true; }
            // lo que hay debajo del dedo (píxeles del lienzo del juego)
            const sx = cv.width / r.width, sy = cv.height / r.height;
            const half = D / Z / 2;
            x.setTransform(1, 0, 0, 1, 0, 0);
            x.clearRect(0, 0, c.width, c.height);
            x.save();
            x.beginPath(); x.arc(c.width / 2, c.height / 2, c.width / 2, 0, Math.PI * 2); x.clip();
            x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
            x.imageSmoothingEnabled = false;
            try { x.drawImage(cv, (fx - r.left - half) * sx, (fy - r.top - half) * sy, half * 2 * sx, half * 2 * sy, 0, 0, c.width, c.height); } catch (e) { /* nada */ }
            // el bloque elegido
            const mw = mouseWorld(), bx = S.smart ? S.smart.x : Math.floor(mw.x), by = S.smart ? S.smart.y : Math.floor(mw.y);   // (⛏🎯 el que de verdad se pica)
            const a = window.mbwPlay.toClient(bx, by + 1), b = window.mbwPlay.toClient(bx + 1, by);
            const map = function (px, py) { return { x: (px - (fx - half)) * Z * k, y: (py - (fy - half)) * Z * k }; };
            const p0 = map(a.x, a.y), p1 = map(b.x, b.y);
            const far = blockDist(bx, by) > REACH;
            x.lineWidth = 2.5 * k;
            x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeRect(p0.x - 1.5 * k, p0.y - 1.5 * k, p1.x - p0.x + 3 * k, p1.y - p0.y + 3 * k);
            x.strokeStyle = far ? '#ff5555' : '#ffffff'; x.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
            // la punta del dedo
            x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(c.width / 2, c.height / 2, 2.2 * k, 0, Math.PI * 2); x.fill();
            x.restore();
            // el borde
            x.lineWidth = 3 * k; x.strokeStyle = 'rgba(255,255,255,.85)';
            x.beginPath(); x.arc(c.width / 2, c.height / 2, c.width / 2 - 1.5 * k, 0, Math.PI * 2); x.stroke();
        }
    };
    window.mbwPlay.loupe = loupe;

    // ------------------------------------------------------------------ dibujar (encima del dibujo del editor)
    function iconFor(id, extras) {
        const k = id + '|' + (extras && extras.type || '');
        let c = iconFor.cache[k];
        if (c) return c;
        c = document.createElement('canvas'); c.width = c.height = 16;
        try {
            const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
            const sst = { type: id === 'bed' ? 'bed1' : id };
            const v = window.itemTexVariant ? window.itemTexVariant(id, 0, extras) : undefined;
            if (v !== undefined) sst.states1 = v;
            const ro = typeof getBlockObject === 'function' ? getBlockObject(sst) : null;
            if (ro && window.drawItemIcon && window.images && window.images.blocks && window.images.blocks.complete) window.drawItemIcon(cx, ro, id, extras, 0, 0, 16, 16);
            else { cx.fillStyle = '#888'; cx.fillRect(2, 2, 12, 12); }
        } catch (e) { /* nada */ }
        iconFor.cache[k] = c;
        return c;
    }
    iconFor.cache = {};
    function toScreen(gx, gy) { return { x: (gx - camera.x) * tileSize, y: canvas.height - ((-gy) - camera.y) * tileSize }; }
    function drawExtras() {
        if (!S.playing) return;
        const c2 = window.ctx || (typeof ctx !== 'undefined' ? ctx : null);
        if (!c2) return;
        c2.save();
        c2.imageSmoothingEnabled = false;
        S.drops.forEach(function (d) { const p = toScreen(d.x, d.y); const s = tileSize * .5; c2.drawImage(iconFor(d.id, d.ex), p.x - s / 2, p.y - s + Math.sin((S.tick + d.age) / 12) * 2, s, s); });
        S.falling.forEach(function (e) { const p = toScreen(e.x, e.y); const s = tileSize; c2.drawImage(iconFor(e.t, e.s ? { type: e.s } : {}), p.x - s / 2, p.y - s / 2, s, s); if (e.tnt && (e.fuse >> 3) % 2) { c2.fillStyle = 'rgba(255,255,255,.55)'; c2.fillRect(p.x - s / 2, p.y - s / 2, s, s); } });
        c2.strokeStyle = '#d9c9a3'; c2.lineWidth = Math.max(1, tileSize / 12);
        S.orbs.forEach(function (o) {                                  // ✨ bolitas de experiencia
            const p = toScreen(o.x, o.y), r = tileSize * (.12 + Math.min(.12, o.v / 400)), pulse = .75 + .25 * Math.sin((S.tick + o.age) / 4);
            c2.fillStyle = 'rgba(140,255,60,' + (.85 * pulse) + ')'; c2.strokeStyle = 'rgba(40,90,0,.9)'; c2.lineWidth = Math.max(1, tileSize / 16);
            c2.beginPath(); c2.arc(p.x, p.y - r, r, 0, Math.PI * 2); c2.fill(); c2.stroke();
            c2.fillStyle = 'rgba(255,255,170,' + pulse + ')'; c2.beginPath(); c2.arc(p.x - r * .3, p.y - r * 1.3, r * .35, 0, Math.PI * 2); c2.fill();
        });
        S.arrows.forEach(function (r) { const p = toScreen(r.x, r.y); const a = Math.atan2(r.vy, r.vx); c2.beginPath(); c2.moveTo(p.x, p.y); c2.lineTo(p.x - Math.cos(a) * tileSize * .6, p.y - Math.sin(a) * tileSize * .6); c2.stroke(); });
        drawParticles(c2);
        drawBalloons(c2);
        if (S.sleep) {                                                    // 💤
            const w0 = W(), t0 = S.sleep.t;
            c2.save(); c2.fillStyle = '#fff'; c2.strokeStyle = 'rgba(0,0,0,.6)'; c2.lineWidth = 3; c2.textAlign = 'center';
            for (let k = 0; k < 3; k++) {
                const ph0 = ((t0 + k * 25) % 75) / 75, p0 = toScreen(w0.worldX - 1.1 + ph0 * .6, w0.worldY - .6 - ph0 * 1.6);
                c2.globalAlpha = Math.sin(ph0 * Math.PI); c2.font = 'bold ' + Math.round(tileSize * (.35 + ph0 * .3)) + 'px Arial';
                c2.strokeText('Z', p0.x, p0.y); c2.fillText('Z', p0.x, p0.y);
            }
            c2.restore();
        }
        drawDragonExtras(c2);
        drawShots(c2);
        drawEyes(c2);
        drawFireballs(c2);
        if (S.emote) { const b0 = mobBounds(PLAYER_ID), p0 = toScreen(W().worldX, b0.t); if (!drawEmote(c2, S.emote, p0.x, p0.y)) S.emote = null; }
        drawBobber(c2);
        drawBars(c2);
        if (S.smart && S.mouse.left) {                         // ⛏🎯 el bloque que se está picando con el cursor inteligente
            const p = toScreen(S.smart.x, -S.smart.y - 1);
            c2.save(); c2.lineWidth = Math.max(2, tileSize / 9);
            c2.strokeStyle = 'rgba(0,0,0,.6)'; c2.strokeRect(p.x - 1, p.y - 1, tileSize + 2, tileSize + 2);
            c2.strokeStyle = 'rgba(255,230,90,.95)'; c2.strokeRect(p.x + 1, p.y + 1, tileSize - 2, tileSize - 2);
            c2.restore();
        }
        if (S.mine && S.mine.total > 1) {                       // grietas del bloque que se pica
            const k = 1 - S.mine.left / S.mine.total;
            const p = toScreen(S.mine.x, -S.mine.y);
            c2.fillStyle = 'rgba(0,0,0,' + (.15 + .45 * k) + ')';
            c2.fillRect(p.x, p.y - tileSize, tileSize, tileSize);
            c2.strokeStyle = 'rgba(255,255,255,.7)'; c2.lineWidth = 1;
            c2.strokeRect(p.x + .5, p.y - tileSize + .5, tileSize - 1, tileSize - 1);
        }
        if (S.mouse.inside && !(W().dead > 0)) {                 // recuadro del bloque bajo el mouse
            const mw = mouseWorld(); const bx = Math.floor(mw.x), by = Math.floor(mw.y);
            const ok = blockDist(bx, by) <= REACH + 1;
            const p = toScreen(bx, -by);
            const barrier = mbwom.getBlock(bx, by) === 'b';            // un Barrier (no se ve): el recuadro sale azul
            c2.strokeStyle = barrier ? 'rgba(60,150,255,.95)' : ok ? 'rgba(255,255,255,.85)' : 'rgba(255,80,80,.6)'; c2.lineWidth = 2;
            c2.strokeRect(p.x + 1, p.y - tileSize + 1, tileSize - 2, tileSize - 2);
        }
        const w = W();
        if (S.sleep) { c2.fillStyle = 'rgba(0,0,10,' + Math.min(.92, S.sleep.t / (2.5 * FPS)) + ')'; c2.fillRect(0, 0, canvas.width, canvas.height); }   // 🛏 durmiendo
        else if (S.wake) { const k = 1 - (performance.now() - S.wake) / 1400; if (k <= 0) S.wake = 0; else { c2.fillStyle = 'rgba(0,0,10,' + (.92 * k) + ')'; c2.fillRect(0, 0, canvas.width, canvas.height); } }   // ☀ despertando
        if ((S.p && S.p.hurt > 0 && OPTS.effects !== false) || w.dead > 0) { c2.fillStyle = w.dead > 0 ? 'rgba(140,0,0,.35)' : 'rgba(255,0,0,.12)'; c2.fillRect(0, 0, canvas.width, canvas.height); }
        try { marks.arrows(c2); } catch (e) { /* nada */ }
        c2.restore();
        if (S.p && S.p.hurt > 0) S.p.hurt--;
    }

    // ------------------------------------------------------------------ ⭐ marcadores (todos pueden, sin permisos; hasta 10)
    //   Botón ⭐ al lado de ⚙: poner un marcador donde estás (con nombre), ver a qué distancia está cada uno y borrarlos.
    //   Son los mismos marcadores del editor (View > Bookmarks, de cada quien). En el mapa salen como estrellas y, si están
    //   fuera de la pantalla, una flechita en la orilla dice hacia dónde quedan y a cuántos bloques.
    const MARKS_MAX = 10;
    const marks = {
        open: false,
        list: function () { try { return (window.mbwBookmarks && window.mbwBookmarks.list()) || []; } catch (e) { return []; } },
        toggle: function (on) { this.open = on == null ? !this.open : !!on; this.render(); },
        // ➜ ir a un marcador: cualquiera, sin permisos de comandos; se espera 3 segundos (como /back)
        go: function (b) {
            if (!b) return;
            const w = W();
            if (w.dead > 0) return;
            clearTimeout(S.markWait);
            say('[INFO] ⭐ ' + tr('play_marks_wait', 'Teleporting you to "{name}" in 3 seconds...').replace('{name}', b.name));
            flashMsg('⭐ ' + tr('play_marks_wait', 'Teleporting you to "{name}" in 3 seconds...').replace('{name}', b.name));
            S.markWait = setTimeout(function () {
                S.markWait = 0;
                const w2 = W();
                if (!S.playing || w2.dead > 0) return;
                const dim = Number(b.dim) || 1;
                if (dim !== (mbwom.currentScene || 1)) {
                    if (!mbwom.world['scene' + dim]) { say('[INFO] ' + tr('ex_bm_dim_missing', 'That dimension is not generated in this world.')); return; }
                    if (!changeDim(dim, 'cmd')) { say('[INFO] ' + tr('play_back_dim', 'You cannot go back to that dimension right now.')); return; }
                }
                const p = safeSpot(Number(b.x) + .5, -Number(b.y));
                w2.worldX = p.x; w2.worldY = p.y; w2.xSpeed = 0; w2.ySpeed = 0; w2.riding = '';
                if (S.p) { S.p.falling = S.p.wasFalling = false; S.p.wasFallingSpeed = 0; S.p.wasFallingAndNotFalling = 0; S.p.suffocate = 0; S.p.jumpTimer = 0; }
                S.mine = null; S.ride = null; camSnap(); hud.dirty = true;
                say('[INFO] ⭐ ' + tr('play_marks_done', 'You are at "{name}".').replace('{name}', b.name));
            }, TP_WAIT);
        },
        dist: function (b) { const w = W(); return Math.round(Math.hypot(Number(b.x) + .5 - Number(w.worldX), Number(b.y) - (-Number(w.worldY)))); },
        render: function () {
            const box = hud.el && hud.el.querySelector('.ph-marks'); if (!box) return;
            box.style.display = this.open ? '' : 'none';
            if (hud.el) hud.el.classList.toggle('marks-open', this.open);
            if (!this.open) return;
            const L = this.list(), cur = mbwom.currentScene || 1, DN = ['', '', ' (Nether)', ' (End)'];
            box.innerHTML = '';
            const head = document.createElement('div'); head.className = 'ph-mk-head';
            head.textContent = '⭐ ' + tr('play_marks', 'Markers') + ' (' + L.length + '/' + MARKS_MAX + ')';
            const x = document.createElement('button'); x.type = 'button'; x.className = 'ph-mk-x'; x.textContent = '✕'; x.onclick = function () { marks.toggle(false); };
            head.appendChild(x); box.appendChild(head);
            const form = document.createElement('form'); form.className = 'ph-mk-add'; form.autocomplete = 'off';
            const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 40; inp.placeholder = tr('play_marks_name', 'Name (optional)');
            ['keydown', 'keyup', 'keypress'].forEach(function (n) { inp.addEventListener(n, function (e) { e.stopPropagation(); }); });
            const add = document.createElement('button'); add.type = 'submit'; add.textContent = '➕ ' + tr('play_marks_add', 'Mark here');
            const full = L.length >= MARKS_MAX;
            add.disabled = full; inp.disabled = full;
            form.appendChild(inp); form.appendChild(add);
            form.onsubmit = function (e) {
                e.preventDefault();
                if (marks.list().length >= MARKS_MAX || !window.mbwBookmarks || !window.mbwBookmarks.add) return;
                const w = W();
                const b = window.mbwBookmarks.add({ x: Math.floor(Number(w.worldX)), y: Math.round(-Number(w.worldY)), dim: mbwom.currentScene || 1 }, inp.value);
                if (b) flashMsg('⭐ ' + tr('play_marks_saved', 'Marker saved: {name}').replace('{name}', b.name));
                marks.render();
            };
            box.appendChild(form);
            if (full) { const n = document.createElement('div'); n.className = 'ph-mk-note'; n.textContent = tr('play_marks_full', 'You have 10 markers (the limit). Delete one to add another.'); box.appendChild(n); }
            const ul = document.createElement('div'); ul.className = 'ph-mk-list';
            if (!L.length) { const n = document.createElement('div'); n.className = 'ph-mk-note'; n.textContent = tr('play_marks_none', 'No markers yet. Go somewhere and press "Mark here".'); ul.appendChild(n); }
            L.forEach(function (b) {
                const r = document.createElement('div'); r.className = 'ph-mk-row'; r.dataset.id = b.id;
                const nm = document.createElement('span'); nm.className = 'ph-mk-name'; nm.textContent = '⭐ ' + b.name; r.appendChild(nm);
                const at = document.createElement('span'); at.className = 'ph-mk-at'; at.textContent = 'X ' + b.x + ' · Y ' + b.y + (DN[b.dim] || '');
                r.appendChild(at);
                const d = document.createElement('span'); d.className = 'ph-mk-d'; d.textContent = b.dim === cur ? marks.dist(b) + ' m' : '—'; r.appendChild(d);
                const goB = document.createElement('button'); goB.type = 'button'; goB.className = 'ph-mk-go'; goB.textContent = '➜'; goB.title = tr('play_marks_go', 'Go there (3 seconds)');
                goB.onclick = function () { marks.toggle(false); marks.go(b); };
                r.appendChild(goB);
                const del = document.createElement('button'); del.type = 'button'; del.className = 'ph-mk-del'; del.textContent = '🗑'; del.title = tr('play_marks_del', 'Delete');
                del.onclick = function () { if (window.mbwBookmarks && window.mbwBookmarks.remove) window.mbwBookmarks.remove(b.id); marks.render(); };
                r.appendChild(del);
                ul.appendChild(r);
            });
            box.appendChild(ul);
        },
        distances: function () {
            const box = hud.el && hud.el.querySelector('.ph-marks'); if (!box) return;
            const cur = mbwom.currentScene || 1, L = this.list();
            box.querySelectorAll('.ph-mk-row').forEach(function (r) { const b = L.find(function (q) { return q.id === r.dataset.id; }); const d = r.querySelector('.ph-mk-d'); if (b && d) d.textContent = b.dim === cur ? marks.dist(b) + ' m' : '—'; });
        },
        // ➜ flechitas en la orilla para los marcadores que no se ven
        arrows: function (c2) {
            const L = this.list(); if (!L.length) return;
            const cur = mbwom.currentScene || 1;
            const A = window.mbwAspect, f = (A && A.active && A.frame) ? A.frame() : { x: 0, y: 0, w: canvas.width, h: canvas.height };
            const cx = f.x + f.w / 2, cy = f.y + f.h / 2, pad = Math.max(18, tileSize * .9);
            c2.save();
            c2.font = 'bold ' + Math.max(11, Math.round(tileSize * .42)) + 'px Arial'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
            const used = [], lh = Math.max(14, Math.round(tileSize * .55));
            L.slice().sort(function (a, b2) { return marks.dist(a) - marks.dist(b2); }).forEach(function (b) {
                if (b.dim !== cur) return;
                const p = toScreen(Number(b.x) + .5, -(Number(b.y) + .5));
                if (p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h) return;   // (se ve: ya está la estrella)
                const dx = p.x - cx, dy = p.y - cy;
                const k = Math.min((f.w / 2 - pad) / Math.abs(dx || 1e-6), (f.h / 2 - pad) / Math.abs(dy || 1e-6));
                const ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx), s = Math.max(9, tileSize * .38);
                c2.save(); c2.translate(ax, ay); c2.rotate(ang);
                c2.beginPath(); c2.moveTo(s, 0); c2.lineTo(-s * .7, -s * .75); c2.lineTo(-s * .35, 0); c2.lineTo(-s * .7, s * .75); c2.closePath();
                c2.fillStyle = '#FFD700'; c2.fill(); c2.lineWidth = 1.5; c2.strokeStyle = '#7a5a00'; c2.stroke();
                c2.restore();
                // (el nombre va del lado de adentro de la flecha, sin taparla)
                const side = ax <= f.x + pad + 2 ? 'left' : ax >= f.x + f.w - pad - 2 ? 'right' : 'center';
                c2.textAlign = side;
                const lx = side === 'left' ? ax + s * 1.4 : side === 'right' ? ax - s * 1.4 : Math.max(f.x + 60, Math.min(f.x + f.w - 60, ax));
                let ty = side === 'center' ? ay - Math.sin(ang) * s * 2.2 : ay;
                // (varios hacia el mismo lado: los nombres van uno debajo del otro, el más cercano primero)
                for (let g = 0; g < 12 && used.some(function (u) { return Math.abs(u.x - lx) < 110 && Math.abs(u.y - ty) < lh; }); g++) ty += lh;
                ty = Math.max(f.y + 10, Math.min(f.y + f.h - 10, ty));
                used.push({ x: lx, y: ty });
                c2.shadowColor = 'black'; c2.shadowBlur = 4; c2.fillStyle = '#fff';
                c2.fillText(b.name + ' · ' + marks.dist(b) + ' m', lx, ty);
                c2.shadowBlur = 0;
            });
            c2.restore();
        }
    };
    window.mbwPlay.marks = marks;

    // ------------------------------------------------------------------ 👥 tabla de jugadores conectados (a la derecha, en partidas)
    //   De más a menos logros. El anfitrión sale en celeste.
    const ptab = {
        update: function () {
            const box = hud.el && hud.el.querySelector('.ph-ptab'); if (!box) return;
            const M = window.mbwMpPlay;
            const on = !!(S.mp && M && M.playerList);
            box.style.display = on ? '' : 'none';
            if (!on) return;
            const cnt = {};
            try { (window.mbwAch ? window.mbwAch.ranking() : []).forEach(function (r) { cnt[r.uid] = r.count; }); } catch (e) { /* nada */ }
            const list = M.playerList().filter(function (p) { return p.online; })
                .map(function (p) { return { name: String(p.name || 'Player'), host: !!p.host, me: !!p.me, n: cnt[p.uid] || 0 }; })
                .sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); });
            const key = JSON.stringify(list);
            if (key === this.key) return; this.key = key;
            box.innerHTML = '';
            const h = document.createElement('div'); h.className = 'ph-pt-head'; h.textContent = '👥 ' + tr('pm_players', 'Players') + ' (' + list.length + ')'; box.appendChild(h);
            list.slice(0, 16).forEach(function (p, i) {
                const r = document.createElement('div'); r.className = 'ph-pt-row' + (p.host ? ' host' : '') + (p.me ? ' me' : '');
                const a = document.createElement('span'); a.className = 'ph-pt-pos'; a.textContent = (i + 1) + '.'; r.appendChild(a);
                const n = document.createElement('span'); n.className = 'ph-pt-name'; n.textContent = p.name + (p.host ? ' 👑' : ''); r.appendChild(n);
                const c = document.createElement('span'); c.className = 'ph-pt-ach'; c.textContent = '🏆 ' + p.n; r.appendChild(c);
                box.appendChild(r);
            });
        }
    };
    window.mbwPlay.ptab = ptab;

    // ------------------------------------------------------------------ HUD (vida, comida, aire, hotbar, botones)
    const hud = {
        el: null, dirty: true,
        build: function () {
            const el = this.el = document.createElement('div');
            el.id = 'mbw-play-hud';
            this.areaKey = null; this.effKey = null;                       // (HUD nuevo: se vuelve a acomodar)
            ptab.key = null; marks.open = false;
            el.innerHTML =
                // (lo de la cámara: viñeta, ⏸ y 💬, coordenadas, efectos y el morado del portal van DENTRO del recuadro de la cámara)
                '<div class="ph-area"><div class="ph-vig"></div><div class="ph-portal"></div>' +
                '<div class="ph-top"><div class="ph-topbtns"><button type="button" class="ph-marks-btn" aria-label="Markers">⭐</button><button type="button" class="ph-gear" aria-label="Menu">⚙</button></div><div class="ph-msg"></div></div>' +
                '<div class="ph-marks" style="display:none"></div><div class="ph-ptab" style="display:none"></div>' +
                '<button type="button" class="ph-chat-btn"><img src="assets/chat.png" alt=""></button><div class="ph-coords"></div><div class="ph-effects"></div></div>' +
                '<div class="ph-bars"><div class="ph-left"><div class="ph-armor"></div><div class="ph-hearts"></div></div><div class="ph-right"><div class="ph-air"></div><div class="ph-food"></div></div></div>' +
                '<div class="ph-xp"><div class="ph-xp-fill"></div><b class="ph-xp-lv"></b></div>' +
                '<div class="ph-iname"></div>' +
                '<div class="ph-hotbar"></div>' +
                '<div class="ph-sign"><div class="ph-sign-t"></div></div>' +
                '<button type="button" class="ph-inv">🎒</button>' +
                '<div class="ph-open" style="display:none"></div>' +
                '<div class="ph-joy"><div class="ph-knob"></div></div>' +
                '<div class="ph-pad2"><button type="button" data-k="down" class="ph-sneak">⇩</button><button type="button" data-k="up" class="ph-jump">⇧</button><button type="button" class="ph-mode">⛏</button></div>';
            document.body.appendChild(el);
            el.querySelector('.ph-gear').addEventListener('click', function (e) { e.stopPropagation(); openPause(); });
            el.querySelector('.ph-marks-btn').addEventListener('click', function (e) { e.stopPropagation(); marks.toggle(); });
            ['pointerdown', 'mousedown', 'touchstart', 'click', 'wheel'].forEach(function (n) { el.querySelector('.ph-marks').addEventListener(n, function (e) { e.stopPropagation(); }); });
            joystick(el.querySelector('.ph-joy'));
            el.querySelectorAll('[data-k]').forEach(function (b) {
                const k = b.getAttribute('data-k');
                const on = function (e) {
                    e.preventDefault(); e.stopPropagation(); S.keys[k] = true; b.classList.add('on');
                    if (k === 'up') {                                     // tocar 2 veces rápido el botón de saltar: volar (creativo)
                        const now = performance.now(), w = W();
                        if (now - (S.dbl.touchUp || 0) < 320 && w.gamemode == 1) { w.fly = !w.fly; flashMsg(w.fly ? tr('play_fly_on', 'Flying') : tr('play_fly_off', 'Not flying')); S.dbl.touchUp = 0; }
                        else S.dbl.touchUp = now;
                    }
                };
                const off = function (e) { e.preventDefault(); e.stopPropagation(); S.keys[k] = false; b.classList.remove('on'); };
                b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
            });
            el.querySelector('.ph-inv').addEventListener('click', function (e) { e.stopPropagation(); toggleInv(); });
            chat.build(el);
            emo.build(el);
            el.querySelector('.ph-chat-btn').addEventListener('click', function (e) { e.stopPropagation(); if (chat.open) chat.close(); else chat.show(''); });
            const mb = el.querySelector('.ph-mode');
            mb.addEventListener('click', function (e) { e.stopPropagation(); S.touchMode = S.touchMode === 'mine' ? 'place' : 'mine'; hud.dirty = true; });
            el.querySelector('.ph-hotbar').addEventListener('click', function (e) {
                const s = e.target.closest('[data-i]'); if (!s) return;
                e.stopPropagation(); W().selectedInventoryItem = +s.getAttribute('data-i'); hud.dirty = true;
            });
            this.texts();
        },
        // el recuadro de la cámara (Aspect) en la pantalla: ahí van los botones, la viñeta, las coordenadas...
        place: function (w) {
            const ar = this.el.querySelector('.ph-area'); if (!ar || typeof canvas === 'undefined') return;
            const br = canvas.getBoundingClientRect(), k = canvas.width ? br.width / canvas.width : 1, A = window.mbwAspect;
            let r = { x: 0, y: 0, w: canvas.width, h: canvas.height };
            try { if (A && A.active && A.screen) r = A.screen(); } catch (e) { /* nada */ }
            const key = [br.left, br.top, k, r.x, r.y, r.w, r.h].map(Math.round).join(',');
            if (key !== this.areaKey) {
                this.areaKey = key; ar.style.left = (br.left + r.x * k) + 'px'; ar.style.top = (br.top + r.y * k) + 'px'; ar.style.width = (r.w * k) + 'px'; ar.style.height = (r.h * k) + 'px';
                // 💬 el chat / la consola también dentro del recuadro de la cámara (no en las barras negras)
                const ce = this.el.querySelector('.ph-chat');
                if (ce) {
                    const L = br.left + r.x * k, gapB = Math.max(0, window.innerHeight - (br.top + (r.y + r.h) * k));
                    ce.style.left = (L + 10) + 'px'; ce.style.maxWidth = Math.max(200, r.w * k - 20) + 'px';
                    ce.style.transform = gapB > 0 ? 'translateY(-' + Math.round(gapB) + 'px)' : '';
                }
            }
            // coordenadas (Options > Coordinates)
            const co = ar.querySelector('.ph-coords');
            co.style.display = OPTS.coords ? 'block' : 'none';
            if (OPTS.coords) { const t = 'X: ' + Math.floor(Number(w.worldX)) + '   Y: ' + Math.floor(-Number(w.worldY)); if (co.textContent !== t) co.textContent = t; }
            // efectos que tengo puestos (pociones, comida...) con el tiempo que les queda
            const ef = ar.querySelector('.ph-effects'), E = w.effects || {};
            const et = Object.keys(E).filter(function (q) { return E[q] && E[q].duration > 0 && EFFECT_NAMES[q]; }).map(function (q) { const e = E[q], sec = Math.max(0, e.duration | 0); return q + '~' + EFFECT_NAMES[q] + (e.level > 1 ? ' ' + ['', 'I', 'II', 'III', 'IV'][Math.min(4, e.level)] : '') + '  ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }).join('|');
            if (et !== this.effKey) { this.effKey = et; ef.textContent = ''; et.split('|').forEach(function (q) {
                if (!q) return;
                const sp = document.createElement('span'), k = q.slice(0, q.indexOf('~'));
                if (EFFECT_ICONS[k]) { const im = document.createElement('img'); im.src = 'assets/UI/' + EFFECT_ICONS[k] + '.png'; im.alt = ''; sp.appendChild(im); }   // 🧪 su dibujo
                sp.appendChild(document.createTextNode(q.slice(q.indexOf('~') + 1))); ef.appendChild(sp);
            }); }
            ef.style.top = OPTS.coords ? '90px' : '68px';
            // 🌀 parado en un portal: la pantalla se pone morada poco a poco (4 segundos)
            const pt = ar.querySelector('.ph-portal'), pk = Math.min(1, (S.portalT || 0) / (4 * FPS));
            const po = (pk * (S.portalKind === 2 ? .7 : .55)).toFixed(2);
            if (pt.style.opacity !== po) { pt.style.opacity = po; pt.style.background = S.portalKind === 2 ? 'radial-gradient(ellipse at center, rgba(10,0,30,.6), rgba(0,0,0,.95))' : 'radial-gradient(ellipse at center, rgba(150,40,220,.35), rgba(90,0,160,.85))'; }
        },
        texts: function () { if (!this.el) return; chat.texts(); this.el.querySelector('.ph-chat-btn').title = tr('play_chat_tip', 'Chat / commands (T)'); this.el.querySelector('.ph-gear').title = tr('play_menu_tip', 'Menu (Esc)'); },
        update: function () {
            if (!this.el) return;
            const w = W();
            this.place(w);
            try { emo.update(); } catch (e) { /* nada */ }
            if (S.tick % 5 === 0) { try { bossUpdate(); } catch (e) { /* nada */ } }
            const um = modalOpen();                                   // con el inventario / un cofre / un horno abierto, el HUD se esconde (no tapa la ventana)
            if (um !== this.underModal) { this.underModal = um; this.el.classList.toggle('under-modal', um); }
            const msg = this.el.querySelector('.ph-msg');
            const mtxt = S.msgT > 0 ? S.msg : '';
            if (msg.textContent !== mtxt) msg.textContent = mtxt;
            chat.render();
            if (S.tick % 25 === 0) { try { ptab.update(); } catch (e) { /* nada */ } }
            if (marks.open && S.tick % 15 === 0) { try { marks.distances(); } catch (e) { /* nada */ } }
            // 🪧 el letrero que se está leyendo
            const sg = this.el.querySelector('.ph-sign'), G = S.sign;
            if (G.a > 0) {
                const st = sg.querySelector('.ph-sign-t');
                if (st.textContent !== G.text) st.textContent = G.text;
            }
            const so = G.a.toFixed(2);
            if (sg.style.opacity !== so) { sg.style.opacity = so; sg.style.display = G.a > 0 ? 'block' : 'none'; }
            // nombre del objeto que se acaba de elegir
            const ni = this.el.querySelector('.ph-iname'), cur = selItem(), nk = selIndex() + ':' + (cur ? String(cur[0]) + '|' + JSON.stringify(cur[3] || {}) : '');
            const si = selIndex();
            if (S.selSnd !== null && S.selSnd !== si) snd('tick');            // 🔊 cambiar de casilla: "tick", como el juego
            S.selSnd = si;
            if (S.iname.key === null) S.iname.key = nk;                        // al empezar no se muestra
            else if (nk !== S.iname.key) { S.iname.key = nk; S.iname.text = cur ? itemDisplayName(cur) : ''; S.iname.t = cur ? Math.round(2.2 * FPS) : 0; }
            const na = S.iname.t > 0 ? Math.min(1, S.iname.t / (0.5 * FPS)) : 0;
            if (ni.textContent !== S.iname.text) ni.textContent = S.iname.text;
            const nao = na.toFixed(2);
            if (ni.style.opacity !== nao) ni.style.opacity = nao;
            const ap = armorPoints(w);                                  // 🛡 la armadura cambió (se la puso, se gastó...)
            if (ap !== this.armKey) { this.armKey = ap; this.dirty = true; }
            if (!this.dirty) return;
            this.dirty = false;
            const surv = w.gamemode != 1 && w.gamemode != 3;
            let h = '';
            // vida (assets/HEALTH.png) a la izquierda y hambre (assets/HUNGER.png) a la derecha, como en Minecraft;
            // las dos barras se vacían de derecha a izquierda
            const icon = function (st) { return '<i class="' + st + '"><u></u></i>'; };
            if (surv) {
                const hp = Math.max(0, w.health | 0);
                for (let i = 0; i < 10; i++) h += icon(hp >= (i + 1) * 2 ? 'f' : hp === i * 2 + 1 ? 'h' : 'e');
            }
            this.el.querySelector('.ph-hearts').innerHTML = h;
            // 🛡 barra de armadura arriba de los corazones (solo si traes algo que protege), como en Minecraft
            let am = '';
            if (surv && ap > 0) for (let i = 0; i < 10; i++) am += icon(ap >= (i + 1) * 2 ? 'f' : ap === i * 2 + 1 ? 'h' : 'e');
            this.el.querySelector('.ph-armor').innerHTML = am;
            let fd = '';
            if (surv) { const f = Math.max(0, (w.food | 0) / 50); for (let i = 0; i < 10; i++) fd += icon(f >= (i + 1) * 2 ? 'f' : f >= i * 2 + 1 ? 'h' : 'e'); }
            this.el.querySelector('.ph-food').innerHTML = fd;
            let ai = '';
            if (surv && w.air < 11) for (let i = 0; i < 10; i++) ai += '<i class="' + (w.air > i ? 'f' : 'e') + '">●</i>';
            this.el.querySelector('.ph-air').innerHTML = ai;
            // ✨ barra de experiencia (10 partes) y el nivel encima, como en el juego (100 de experiencia = 1 nivel)
            const xp = Math.max(0, Number(w.experience) || 0), lvl = Math.floor(xp / 100);
            const xb = this.el.querySelector('.ph-xp');
            xb.style.display = w.gamemode == 3 ? 'none' : '';
            this.el.querySelector('.ph-xp-fill').style.width = ((xp % 100) / 100 * 100).toFixed(1) + '%';
            const xl = this.el.querySelector('.ph-xp-lv'); xl.textContent = lvl > 0 ? lvl : ''; xb.title = tr('play_xp_tip', 'Experience: {n} (level {l})', { n: xp, l: lvl });
            const hb = this.el.querySelector('.ph-hotbar');
            hb.innerHTML = '';
            const list = inv(), sel = selIndex();
            for (let i = 0; i < 9; i++) {
                const s = document.createElement('div');
                s.className = 'ph-slot' + (i === sel ? ' sel' : '');
                s.setAttribute('data-i', i);
                const it = list[i];
                if (!isEmpty(it)) {
                    const c = document.createElement('canvas'); c.width = c.height = 16;
                    c.getContext('2d').drawImage(iconFor(String(it[0]), it[3] || {}), 0, 0);
                    if (window.mbwDrawDurBar && Number(it[2]) > 0) window.mbwDrawDurBar(c.getContext('2d'), 16, it[2], String(it[0]));   // 🔧 cuánto le queda a la herramienta
                    s.appendChild(c);
                    if (it[1] > 1) { const n = document.createElement('b'); n.textContent = it[1]; s.appendChild(n); }
                    s.title = String(it[0]);
                }
                hb.appendChild(s);
            }
            const ob = this.el.querySelector('.ph-open');
            ob.style.display = S.box ? '' : 'none';
            if (S.box) ob.textContent = boxLabel(S.box.t);
            this.el.querySelector('.ph-inv').title = tr('play_inv', 'Inventory (E)');
            this.el.querySelector('.ph-mode').textContent = S.touchMode === 'mine' ? '⛏' : '🧱';
            this.el.querySelector('.ph-mode').title = S.touchMode === 'mine' ? tr('play_mode_mine', 'Tap = break / hit') : tr('play_mode_place', 'Tap = place / use');
        },
        destroy: function () { if (chat.open) chat.close(); chat.el = null; chat.input = null; chat.qc = null; emo.el = null; emo.picking = false; if (this.el) this.el.remove(); this.el = null; }
    };
    function flashMsg(t) { S.msg = t; S.msgT = 2 * FPS; }
    // 💬 Chat / consola de comandos del mundo (T, Enter o / para abrirlo; en el celular, el botón 💬).
    // Se escribe un comando del juego (con o sin "/"): tp, give, gamemode, time, weather, clone, fill, summon... y Enter.
    // ↑ / ↓ recuerdan lo último que se escribió.
    // ⌨ Autocompletar: mientras se escribe salen sugerencias (el comando y lo que va en cada parte); Tab completa (otra vez Tab = la
    // siguiente); en el celular se toca la sugerencia.
    const CMDS = {
        tp: ['[~]x [~]y | @player | dimension overworld|nether|end', 'Teleport'], spectate: ['@player', 'Follow another player'], give: ['item [amount] [damage]', 'Give an item'], clear: ['[item] [max]', 'Clear the inventory'],
        setblock: ['block [~]x [~]y [replace|keep|destroy]', 'Place a block'], fill: ['block [~]x [~]y width height', 'Fill an area'],
        clone: ['[~]x1 [~]y1 width height [~]xDest [~]yDest [move]', 'Copy an area'], summon: ['mob [quantity] [~]x [~]y', 'Spawn a mob'],
        kill: ['', 'Die'], heal: ['', 'Full health'], gamemode: ['survival|creative|adventure|spectator', 'Change game mode'],
        gamerule: ['rule true|false', 'Change a game rule'], home: ['[set]', 'Go to (or set) the spawn point'], explode: ['size [~]x [~]y', 'Explosion'],
        say: ['message', 'Write in the chat'], time: ['get|set <t|day|night>', 'Time of day'], weather: ['get|set <clear|rain|thunder>', 'Weather'],
        difficulty: ['peaceful|easy|normal|hard', 'Difficulty'], xp: ['[add] value[L]', 'Experience (L = levels)'], help: ['', 'List of commands'], cls: ['', 'Clear the chat'], back: ['', 'Go back to where you died'],
        kick: ['@player', 'Kick a player (host)'], ban: ['@player', 'Ban a player from this world (host)'], unban: ['player', 'Let a banned player join again (host)'],
        banlist: ['', 'Who is banned (host)'], mute: ['@player', 'Mute a player in the chat (host)'], unmute: ['@player', 'Unmute a player (host)']
    };
    const GAMERULES = ['keepinventory', 'mobgriefing', 'dodaylightcycle', 'dofiretick', 'passivemobs', 'domobloot', 'sendcommandfeedback'];
    function argOptions(cmd, i, prev) {                               // lo que puede ir en la parte i (1 = la primera después del comando)
        const I = (window.MB_GAME && window.MB_GAME.identifiers) || {};
        const items = () => Object.keys(I).map(function (k) { return k.trim(); });
        const blocks = () => Object.keys(I).filter(function (k) { const id = I[k][0]; return bd(id, 'placeable') == 1; }).map(function (k) { return k.trim(); });
        const mobs = () => Object.keys(D.mobs).filter(function (k) { return k !== 'player'; }).concat(Object.keys(MOB_ALIAS));
        switch (cmd) {
            case 'give': case 'clear': return i === 1 ? items() : null;
            case 'setblock': return i === 1 ? ['air'].concat(blocks()) : i === 4 ? ['replace', 'keep', 'destroy'] : (i === 2 || i === 3) ? ['~'] : null;
            case 'fill': return i === 1 ? ['air'].concat(blocks()) : (i === 2 || i === 3) ? ['~'] : null;
            case 'summon': return i === 1 ? mobs() : (i === 3 || i === 4) ? ['~'] : null;
            case 'tp': {
                if (i === 2 && (prev[1] === 'dimension' || prev[1] === 'dim')) return ['overworld', 'nether', 'end'];
                if (i === 1) return ['~', 'dimension'].concat(playerTags());
                return ['~'];
            }
            case 'spectate': case 'kick': case 'ban': case 'mute': case 'unmute': return i === 1 ? playerTags() : null;
            case 'unban': return i === 1 ? (typeof window.mpBanList === 'function' ? window.mpBanList().map(function (b) { return b.name; }) : []) : null;
            case 'clone': case 'explode': return (cmd === 'explode' ? i >= 2 : true) ? ['~'] : null;
            case 'gamemode': return i === 1 ? ['survival', 'creative', 'adventure', 'spectator'] : null;
            case 'gamerule': return i === 1 ? GAMERULES : i === 2 ? ['true', 'false'] : null;
            case 'time': return i === 1 ? ['set', 'get'] : (i === 2 && prev[1] === 'set') ? ['day', 'night'] : null;
            case 'weather': return i === 1 ? ['set', 'get', 'clear', 'rain', 'thunder'] : (i === 2 && prev[1] === 'set') ? ['clear', 'rain', 'thunder'] : null;
            case 'difficulty': return i === 1 ? ['peaceful', 'easy', 'normal', 'hard'] : null;
            case 'home': return i === 1 ? ['set'] : null;
            case 'xp': return i === 1 ? ['add'] : null;
        }
        return null;
    }
    function suggest(text) {                                          // → { hint, list, tokStart }
        const slash = /^\s*[\/\\]/.test(text) ? text.match(/^\s*[\/\\]/)[0].length : 0;
        const body = text.slice(slash);
        const parts = body.split(' ');
        const cur = parts[parts.length - 1].toLowerCase();
        const tokStart = text.length - parts[parts.length - 1].length;
        if (parts.length === 1) {
            const list = Object.keys(CMDS).filter(function (c) { return c.indexOf(cur) === 0; });
            return { list: list, tokStart: tokStart, cmd: true };
        }
        const cmd = parts[0].toLowerCase();
        if (!CMDS[cmd]) return { list: [], tokStart: tokStart, hint: '' };
        const hint = '/' + cmd + ' ' + CMDS[cmd][0];
        let opts = argOptions(cmd, parts.length - 1, parts.map(function (t) { return t.toLowerCase(); })) || [];
        if (opts.length === 1 && opts[0] === '~') opts = cur === '' ? ['~'] : [];
        const list = opts.filter(function (o) { return o.indexOf(cur) === 0 && o !== cur; }).slice(0, 60);
        return { list: list, tokStart: tokStart, hint: hint };
    }
    // comandos que siempre salen al abrir el chat (con la caja vacía)
    function playerTags() { const R = (S.mp && window.mbwMpPlay) ? window.mbwMpPlay.remotes || {} : {}; return Object.keys(R).filter(function (k) { return R[k] && R[k].name; }).map(function (k) { return '@' + R[k].name; }); }
    function quickCmds() {
        const l = ['/gamemode survival', '/gamemode creative', '/gamemode adventure', '/gamemode spectator', '/tp '];
        if (S.deathPos) l.unshift('/back');                                  // ↩ (después de morir)
        // 🎮 en una partida: /tp @nombre y /spectate @nombre de cada jugador
        playerTags().forEach(function (t) { l.push('/tp ' + t); });
        const sc = mbwom.currentScene || 1;
        [1, 2, 3].forEach(function (n) { if (n !== sc && dimReady(n)) l.push('/tp dimension ' + ['', 'overworld', 'nether', 'end'][n]); });
        playerTags().forEach(function (t) { l.push('/spectate ' + t); });
        return l;
    }
    const chat = {
        open: false, dirty: true, hist: [], hi: -1, el: null,
        build: function (root) {
            const el = this.el = document.createElement('div');
            el.className = 'ph-chat';
            el.innerHTML = '<div class="ph-chat-log"></div><div class="ph-chat-sug"></div><form class="ph-chat-form" autocomplete="off"><input class="ph-chat-in" type="text" maxlength="200" spellcheck="false" autocapitalize="off" autocorrect="off" enterkeyhint="send"><button type="submit" class="ph-chat-send">➤</button><button type="button" class="ph-chat-x">✕</button></form>';
            root.appendChild(el);
            const inp = this.input = el.querySelector('.ph-chat-in');
            el.querySelector('.ph-chat-form').addEventListener('submit', function (e) { e.preventDefault(); chat.send(); });
            el.querySelector('.ph-chat-x').addEventListener('click', function (e) { e.stopPropagation(); chat.close(); });
            inp.addEventListener('input', function () { chat.tabN = 0; chat.tabBase = null; chat.sug(); });
            el.querySelector('.ph-chat-sug').addEventListener('click', function (e) {
                const q = e.target.closest && e.target.closest('[data-q]');
                if (q) {                                                  // comando rápido
                    e.preventDefault(); e.stopPropagation();
                    const c = q.getAttribute('data-q'), more = / $/.test(c);
                    inp.value = c; chat.tabBase = null; chat.sug();
                    if (more || !document.body.classList.contains('is-touch')) { inp.focus(); try { inp.setSelectionRange(c.length, c.length); } catch (er) { /* nada */ } }
                    return;
                }
                const b = e.target.closest && e.target.closest('[data-s]'); if (!b) return;
                e.preventDefault(); e.stopPropagation(); chat.apply(b.getAttribute('data-s'));
                if (!document.body.classList.contains('is-touch')) inp.focus();
            });
            inp.addEventListener('keydown', function (e) {
                e.stopPropagation();
                if (e.key === 'Tab') { e.preventDefault(); chat.tab(); return; }
                if (e.key === 'Escape') { e.preventDefault(); chat.close(); }
                else if (e.key === 'ArrowUp' && chat.hist.length) { e.preventDefault(); chat.hi = Math.max(0, (chat.hi < 0 ? chat.hist.length : chat.hi) - 1); inp.value = chat.hist[chat.hi]; }
                else if (e.key === 'ArrowDown' && chat.hi >= 0) { e.preventDefault(); chat.hi++; if (chat.hi >= chat.hist.length) { chat.hi = -1; inp.value = ''; } else inp.value = chat.hist[chat.hi]; }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { chat.tabBase = null; chat.sug(); }
            });
            inp.addEventListener('keyup', function (e) { e.stopPropagation(); });
            el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
            this.texts();
        },
        texts: function () { if (!this.input) return; this.input.placeholder = tr('play_chat_ph', 'Type a command (tp, give, gamemode, time...) and press Enter'); },
        show: function (prefix) {
            if (!this.el) return;
            this.open = true; S.keys = {}; S.mouse.left = S.mouse.right = false; S.mine = null;
            if (S.joyReset) S.joyReset();
            this.el.classList.add('open'); this.input.value = prefix || ''; this.hi = -1; this.dirty = true; this.tabBase = null; this.tabN = 0;
            if (this.qc) { const bx = this.el.querySelector('.ph-chat-sug'); if (bx) bx.innerHTML = ''; this.qc.reset(); }   // (siempre empieza en la primera lista)
            this.sug();
            if (window.mbwKbUpdate) window.mbwKbUpdate();
            const inp = this.input;
            // 📱 en el celular NO se abre el teclado solo: salen las sugerencias para tocarlas (el teclado sale al tocar la caja)
            if (document.body.classList.contains('is-touch') && !prefix) { try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* nada */ } return; }
            setTimeout(function () { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* nada */ } }, 0);
        },
        close: function () { if (!this.el) return; this.open = false; this.el.classList.remove('open'); this.input.blur(); this.dirty = true; this.sug(); },
        // sugerencias
        sug: function () {
            const box = this.el && this.el.querySelector('.ph-chat-sug'); if (!box) return;
            const v = this.open ? this.input.value : '';
            if (!this.open) { box.innerHTML = ''; box.style.display = 'none'; this.cur = null; return; }
            if (!v.trim()) {
                // caja vacía: botones grandes (Teleport ›, Game mode ›, Weather ›, Time ›), como en Minecraft
                this.cur = null;
                if (!this.qc && window.mbwQuickCmd) this.qc = window.mbwQuickCmd(box, quickCtx);
                if (this.qc) { if (!box.querySelector('.qc')) this.qc.render(); box.style.display = 'block'; }
                return;
            }
            const r = this.cur = suggest(this.tabBase != null ? this.tabBase : v);
            let h = '';
            if (r.hint) h += '<div class="ph-sug-hint">' + esc(r.hint) + '</div>';
            if (r.list.length) {
                h += '<div class="ph-sug-list">' + r.list.slice(0, 12).map(function (o, i) {
                    const d = r.cmd ? ' <i>' + esc(CMDS[o][0]) + '</i>' : '';
                    return '<button type="button" data-s="' + esc(o) + '"' + (i === ((chat.tabN || 1) - 1) % Math.min(12, r.list.length) && chat.tabBase != null ? ' class="on"' : '') + '>' + esc(o) + d + '</button>';
                }).join('') + (r.list.length > 12 ? '<span class="ph-sug-more">+' + (r.list.length - 12) + '</span>' : '') + '</div>';
            }
            box.innerHTML = h; box.style.display = h ? 'block' : 'none';
        },
        apply: function (word) {                                      // pone la sugerencia en la parte que se está escribiendo
            const base = this.input.value, r = suggest(base);
            this.input.value = base.slice(0, r.tokStart) + word + ' ';
            this.tabBase = null; this.tabN = 0;
            try { this.input.setSelectionRange(this.input.value.length, this.input.value.length); } catch (e) { /* nada */ }
            this.sug();
        },
        tab: function () {                                            // Tab: la 1.ª sugerencia; otra vez Tab = la siguiente
            if (this.tabBase == null) this.tabBase = this.input.value;
            const r = suggest(this.tabBase);
            if (!r.list.length) { this.tabBase = null; return; }
            const n = this.tabN = (this.tabN || 0) + 1;
            const word = r.list[(n - 1) % r.list.length];
            this.input.value = this.tabBase.slice(0, r.tokStart) + word;
            if (r.list.length === 1) { this.input.value += ' '; this.tabBase = null; this.tabN = 0; }
            try { this.input.setSelectionRange(this.input.value.length, this.input.value.length); } catch (e) { /* nada */ }
            this.sug();
        },
        send: function () {
            const t = this.input.value.trim();
            this.input.value = '';
            if (t) {
                if (this.hist[this.hist.length - 1] !== t) this.hist.push(t);
                if (this.hist.length > 30) this.hist.shift();
                if (S.mp && t[0] !== '/' && t[0] !== '\\' && typeof window.mpAmMuted === 'function' && window.mpAmMuted()) {
                    say('[INFO] ' + tr('mp_you_muted', 'The host muted you: your messages are not sent.'));   // 🔇
                } else if (S.mp && t[0] !== '/' && t[0] !== '\\') {
                    // 🎮 en una partida, lo que no es comando es un mensaje para los demás (también sale en el chat de la sala)
                    const me = myNameNet();
                    say('<' + me + '> ' + t);
                    mpSend({ tipo: 'chat', autor: me, texto: t });
                    if (typeof window.agregarMensajeChatPublico === 'function') { try { window.agregarMensajeChatPublico(me, t); } catch (e) { /* nada */ } }
                } else {
                    say('> ' + t);
                    try { runCommand(t); } catch (e) { say('[INFO] Error: ' + e.message); }
                }
                hud.dirty = true;
            }
            this.close();
        },
        render: function () {
            if (!this.el) return;
            const now = performance.now();
            const lines = this.open ? cmdLog.slice(-12) : cmdLog.filter(function (l) { return now - l.at < 10000; }).slice(-6);
            const key = (this.open ? 'o' : 'c') + lines.map(function (l) { return l.t + (now - l.at > 9000 && !chat.open ? '~' : ''); }).join('\n');
            if (key === this.last && !this.dirty) return;
            this.last = key; this.dirty = false;
            const log = this.el.querySelector('.ph-chat-log');
            log.innerHTML = '';
            const names = chatNames();
            lines.forEach(function (l) {
                const d = document.createElement('div');
                paintNames(d, l.t, names);
                if (!chat.open && now - l.at > 9000) d.className = 'fade';
                if (/^> /.test(l.t)) d.classList.add('me');
                log.appendChild(d);
            });
        }
    };
    window.mbwPlay.chat = chat;
    // 🎨 los nombres de los jugadores en el chat: en negritas y cada uno con su color (siempre el mismo para el mismo nombre)
    const NAME_COLORS = ['#55ffff', '#ffff55', '#ff9de2', '#7dff7d', '#ffb347', '#9fb4ff', '#ff7b7b', '#d6a6ff'];
    function nameColor(n) { let h = 0; const s = String(n).toLowerCase(); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return NAME_COLORS[h % NAME_COLORS.length]; }
    function chatNames() {
        const L = [myNameNet()];
        const R = (S.mp && window.mbwMpPlay) ? window.mbwMpPlay.remotes || {} : {};
        Object.keys(R).forEach(function (k) { if (R[k] && R[k].name) L.push(String(R[k].name)); });
        if (window.mbwMpPlay && window.mbwMpPlay.hostName) L.push(String(window.mbwMpPlay.hostName));
        return L.filter(function (n, i) { return n && n.length > 1 && L.indexOf(n) === i; }).sort(function (a, b) { return b.length - a.length; });
    }
    function paintNames(el, text, names) {
        text = String(text);
        // (también el que habla en "<Ana> hola" o "[Ana: ...]", aunque ya no esté en la partida)
        const m = /^<([^>]{1,40})> /.exec(text) || /^\[([^\]:]{1,40})[:\]]/.exec(text);
        const list = names.slice(); if (m && m[1] !== 'INFO' && m[1] !== 'SAY' && list.indexOf(m[1]) < 0) list.unshift(m[1]);
        if (!list.length) { el.textContent = text; return; }
        const esc = function (q) { return q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
        const re = new RegExp('(^|[^\\w])(@?)(' + list.map(esc).join('|') + ')(?![\\w])', 'g');
        let last = 0, r;
        while ((r = re.exec(text))) {
            const at = r.index + r[1].length;
            if (at > last) el.appendChild(document.createTextNode(text.slice(last, at)));
            const b = document.createElement('b'); b.className = 'ph-name'; b.textContent = r[2] + r[3]; b.style.color = nameColor(r[3]);
            el.appendChild(b);
            last = at + r[2].length + r[3].length;
            re.lastIndex = last;
        }
        if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
    }
    window.mbwPlay.paintNames = paintNames;
    // lo que hacen los botones grandes del chat (scripts/world-chat.js)
    const quickCtx = {
        run: function (c) { chat.close(); say('> ' + c); try { runCommand(c); } catch (e) { say('[INFO] Error: ' + e.message); } hud.dirty = true; },
        players: function () {
            const R = (S.mp && window.mbwMpPlay) ? window.mbwMpPlay.remotes || {} : {};
            return Object.keys(R).filter(function (k) { return R[k] && R[k].name; }).map(function (k) { return { name: String(R[k].name), sk: R[k].sk || '', id: k }; });
        },
        tpPlayer: function (p) {
            const R = (S.mp && window.mbwMpPlay) ? window.mbwMpPlay.remotes || {} : {}, r = R[p.id];
            if (!r) { chat.close(); say('[INFO] ' + tr('mpplay_tp_noone', 'There is no player called "{name}" in this game.').replace('{name}', p.name)); return; }
            if (!/\s/.test(p.name)) { quickCtx.run('/tp @' + p.name); return; }
            chat.close(); say('> /tp @' + p.name);
            if (r.s !== (mbwom.currentScene || 1) && !changeDimension(r.s)) { say('[INFO] ' + tr('mpplay_tp_dim', '{name} is in another dimension.').replace('{name}', p.name)); return; }
            try { runCommand('/tp ' + r.tx + ' ' + (-r.ty)); } catch (e) { /* nada */ }
        },
        marks: function () { return window.mbwChatMarks ? window.mbwChatMarks() : []; },
        back: function () { return !!S.deathPos; },                          // ↩ botón /back arriba de todo (después de morir)
        tpMark: function (b) { chat.close(); marks.go(b); hud.dirty = true; }   // ⭐ (cualquiera, sin permisos, a los 3 segundos)
    };
    // ---------------------------------------------------------------- 😀 EMOTES
    // Al pasar el mouse sobre mi personaje (en el celular: al tocarlo) sale arriba un botón con el dibujo del chat; al tocarlo, los
    // emotes (los mismos del chat de la sala: window.customEmotes). El elegido sale arriba de mi cabeza 3 segundos y lo ven todos.
    const EMO_MS = 3000, emoImgs = {};
    function emoImg(n) { const src = (window.customEmotes || {})[n]; if (!src) return null; let i = emoImgs[n]; if (!i) { i = emoImgs[n] = new Image(); i.src = src; } return i; }
    function doEmote(n) {
        if (!(window.customEmotes || {})[n]) return false;
        S.emote = { e: n, t: Date.now() };
        mpSend({ tipo: 'juego_emote', e: n, autor: myNameNet() });
        emo.pick(false); emo.until = 0;
        return true;
    }
    // (cx, cy) = en la pantalla, el centro de arriba de la cabeza
    function drawEmote(c2, e, cx, cy) {
        if (!e) return false;
        const age = Date.now() - e.t; if (age > EMO_MS || age < 0) return false;
        const im = emoImg(e.e); if (!im || !im.complete || !im.naturalWidth) return true;
        const pop = Math.min(1, age / 160), out = age > EMO_MS - 350 ? Math.max(0, (EMO_MS - age) / 350) : 1;
        const s = Math.max(18, tileSize * 1.05) * (.55 + .45 * pop), pad = s * .14, bw = s + pad * 2, by = cy - bw - 8;
        c2.save();
        c2.globalAlpha = out;
        c2.fillStyle = 'rgba(255,255,255,.93)'; c2.strokeStyle = 'rgba(0,0,0,.55)'; c2.lineWidth = 2;
        c2.beginPath();
        c2.rect(cx - bw / 2, by, bw, bw);
        c2.moveTo(cx - 5, by + bw); c2.lineTo(cx, by + bw + 6); c2.lineTo(cx + 5, by + bw);
        c2.fill(); c2.stroke();
        c2.imageSmoothingEnabled = false;
        c2.drawImage(im, cx - s / 2, by + pad, s, s);
        c2.restore();
        return true;
    }
    window.mbwPlay.drawEmote = drawEmote;
    window.mbwPlay.iconFor = function (id, ex) { return iconFor(id, ex || {}); };
    window.mbwPlay.give = function (id, n, dmg, ex) { return addToInventory(id, n, dmg, ex); };
    window.mbwPlay.hudDirty = function () { hud.dirty = true; };
    window.mbwPlay.emote = doEmote;
    function overMe() {
        const w = W(); if (!w || w.dead > 0) return false;
        const mw = mouseWorld(), b = mobBounds(PLAYER_ID), y = -mw.y;
        return mw.x >= b.l - .25 && mw.x <= b.r + .25 && y >= b.t - .35 && y <= b.b + .05;
    }
    const emo = {
        el: null, until: 0, over: false, picking: false,
        build: function (root) {
            const el = this.el = document.createElement('div');
            el.className = 'ph-emote';
            el.innerHTML = '<div class="ph-emote-pick"></div><button type="button" class="ph-emote-btn"><img src="assets/chat.png" alt=""></button>';
            root.appendChild(el);
            const btn = el.querySelector('.ph-emote-btn');
            btn.title = tr('play_emote_tip', 'Emotes');
            btn.addEventListener('click', function (e) { e.stopPropagation(); emo.pick(!emo.picking); });
            el.addEventListener('pointerenter', function () { emo.over = true; });
            el.addEventListener('pointerleave', function () { emo.over = false; emo.until = performance.now() + 700; });
            el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        },
        pick: function (on) {
            this.picking = !!on;
            if (!this.el) return;
            const p = this.el.querySelector('.ph-emote-pick');
            if (on) {
                p.innerHTML = '';
                Object.keys(window.customEmotes || {}).forEach(function (n) {
                    const b = document.createElement('button'); b.type = 'button'; b.title = ':' + n + ':'; b.setAttribute('data-e', n);
                    const im = document.createElement('img'); im.src = window.customEmotes[n]; im.alt = n; b.appendChild(im);
                    b.addEventListener('click', function (e) { e.stopPropagation(); doEmote(n); });
                    p.appendChild(b);
                });
                this.until = performance.now() + 6000;
            }
            this.el.classList.toggle('picking', this.picking);
        },
        update: function () {
            if (!this.el) return;
            const now = performance.now();
            if (!S.playing || chat.open || S.paused || modalOpen()) { this.el.style.display = 'none'; this.picking = false; this.el.classList.remove('picking'); return; }
            if (S.mouse.inside && !document.body.classList.contains('is-touch') && overMe()) this.until = now + 900;
            const on = this.over || this.picking || now < this.until;
            this.el.style.display = on ? 'flex' : 'none';
            if (!on) return;
            const w = W(), b = mobBounds(PLAYER_ID);
            const p = window.mbwPlay.toClient(w.worldX, -b.t), p1 = window.mbwPlay.toClient(w.worldX, -b.t + 1);
            const k = Math.max(.2, Math.abs(p.y - p1.y) / Math.max(1, tileSize));   // (cuántos px de la pantalla mide 1 px del dibujo, con el zoom)
            const up = (S.emote && Date.now() - S.emote.t < EMO_MS) ? (Math.max(18, tileSize * 1.05) * 1.3 + 16) * k : 0;   // (si hay un emote, el botón va más arriba)
            this.el.style.left = p.x + 'px';
            this.el.style.top = (p.y - up - 6) + 'px';
        }
    };
    window.mbwPlay.emoteUi = emo;
    // 🕹️ Joystick (celular): un círculo; el punto del centro se arrastra con el dedo.
    // Solo izquierda y derecha: a los lados = caminar; hasta la orilla = correr. (Saltar / bajar: los botones ⇧ y ⇩.)
    function joystick(base) {
        if (!base) return;
        const knob = base.querySelector('.ph-knob');
        let id = null, edge = 0;
        const set = function (dx) {
            const nx = Math.max(-1, Math.min(1, dx));
            knob.style.transform = 'translateX(' + (nx * 46) + 'px)';
            S.keys.left = nx < -0.3; S.keys.right = nx > 0.3;
            const run = Math.abs(nx) > 0.88 ? (nx > 0 ? 1 : -1) : 0;
            if (run !== edge) {                                           // llegar a la orilla = empezar a correr (como el doble toque)
                const w = W();
                if (run && S.p && w.food > 300 && !S.keys.down) { if (run > 0) S.p.rightSprinting = 1; else S.p.leftSprinting = 1; }
                edge = run;
            }
            base.classList.toggle('run', !!run && !!S.p && (S.p.leftSprinting > 0 || S.p.rightSprinting > 0));
        };
        const at = function (e) { const r = base.getBoundingClientRect(); return { dx: (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy: (e.clientY - (r.top + r.height / 2)) / (r.height / 2) }; };
        base.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); id = e.pointerId; try { base.setPointerCapture(id); } catch (er) { /* nada */ } const p = at(e); set(p.dx, p.dy); base.classList.add('on'); });
        base.addEventListener('pointermove', function (e) { if (e.pointerId !== id) return; e.preventDefault(); e.stopPropagation(); const p = at(e); set(p.dx, p.dy); });
        const end = function (e) { if (e.pointerId !== id) return; e.preventDefault(); e.stopPropagation(); id = null; edge = 0; set(0, 0); S.keys.left = S.keys.right = false; base.classList.remove('on', 'run'); };
        base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
        S.joyReset = function () { id = null; edge = 0; knob.style.transform = ''; base.classList.remove('on', 'run'); };
    }

    // ------------------------------------------------------------------ teclado / mouse / dedos (mientras se juega, el editor no los recibe)
    const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'down' };
    function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
    function toggleInv() {
        const m = document.getElementById('inventory-modal');
        if (m && m.style.display === 'block') { if (typeof toggleInventory === 'function') toggleInventory(); }
        else if (typeof window.togglePlayerInventory === 'function') { S.keys = {}; window.togglePlayerInventory(); ach(2); }
        hud.dirty = true;
    }
    function onKeyDown(e) {
        if (!S.playing || typing(e)) return;
        if (S.paused) {                                              // ⏸ el menú de pausa: Esc lo cierra
            if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (window.mbwPlayMenu) { if (window.mbwPlayMenu.back) window.mbwPlayMenu.back(); else window.mbwPlayMenu.close(); } }
            return;
        }
        if (modalOpen()) {                                           // con el inventario / un cofre abierto: las teclas son de la ventana
            if (e.code === 'KeyE' || e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeModals(); hud.dirty = true; }
            return;
        }
        if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); openPause(); return; }   // ⏸ Esc abre el menú de pausa (como el juego)
        if (e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); toggleInv(); return; }
        if (e.code === 'KeyT' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === '/') { e.preventDefault(); e.stopImmediatePropagation(); chat.show(e.key === '/' ? '/' : ''); return; }
        const k = KEYMAP[e.code];
        const w = W();
        if (k) {
            if (!e.repeat) {
                const now = performance.now();
                const lastT = S.dbl[k] || 0;
                if (now - lastT < 300) {                                // doble toque: correr / volar (creativo)
                    if (k === 'left' && w.food > 300) S.p.leftSprinting = 1;
                    if (k === 'right' && w.food > 300) S.p.rightSprinting = 1;
                    if (k === 'up' && w.gamemode == 1) w.fly = !w.fly;
                }
                S.dbl[k] = now;
            }
            S.keys[k] = true;
        }
        const dg = /^Digit([1-9])$/.exec(e.code);
        if (dg) { w.selectedInventoryItem = +dg[1] - 1; hud.dirty = true; }
        if (e.code === 'KeyQ' && !(w.dead > 0)) {                    // tirar el objeto
            const it = selItem();
            if (it) { addDrop(it[0], w.worldX + (S.p.xScale < 0 ? 1.2 : -1.2), w.worldY - 1.2, 1, it[2], it[3]); S.drops[S.drops.length - 1].age = -40; reduceSelected(1); }
        }
        e.preventDefault(); e.stopImmediatePropagation();
    }
    function onKeyUp(e) {
        if (!S.playing || typing(e) || modalOpen()) return;
        const k = KEYMAP[e.code];
        if (k) { S.keys[k] = false; if (k === 'left' && !S.keys.left) { /* nada */ } }
        e.preventDefault(); e.stopImmediatePropagation();
    }
    function onCanvas(e) { const cv = document.getElementById('canvas'); return e.target === cv || (cv && e.target && e.target.closest && e.target.closest('#canvas-container') && !e.target.closest('#mbw-play-hud')); }
    function onPointer(e) {
        if (!S.playing) return;
        if (e.target && e.target.closest && e.target.closest('#mbw-play-hud')) return;
        const cv = document.getElementById('canvas');
        if (!cv) return;
        if (e.type === 'pointermove' || e.type === 'mousemove') {
            S.mouse.x = e.clientX; S.mouse.y = e.clientY;
            const r = cv.getBoundingClientRect();
            S.mouse.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            if (onCanvas(e)) e.stopImmediatePropagation();
            return;
        }
        if (!onCanvas(e)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === 'pointerdown') {
            S.mouse.x = e.clientX; S.mouse.y = e.clientY; S.mouse.inside = true;
            if (e.pointerType === 'touch' && overMe()) { emo.until = performance.now() + 4500; return; }   // 😀 tocar a mi personaje: el botón de emotes
            // (en el celular, tocar con un Command Book en la mano lo usa, sin importar si está en ⛏ o 🧱)
            const right = e.button === 2 || (e.pointerType === 'touch' && (S.touchMode === 'place' || selType() === 'cbook'));
            // dos toques / dos clics rápidos sobre un cofre o un horno: se abre
            if (!right || e.pointerType === 'touch') {
                const mw = mouseWorld(), bx = Math.floor(mw.x), by = Math.floor(mw.y), now = performance.now();
                const L = S.lastTap;
                S.lastTap = { x: bx, y: by, t: now };
                if (L && now - L.t < 380 && L.x === bx && L.y === by && BOX[fg(bx, by)] && blockDist(bx, by) <= REACH + 1) { S.lastTap = null; openBox(bx, by); return; }
            }
            if (right) { S.mouse.right = true; S.mouse.rightEdge = true; } else { S.mouse.left = true; S.mouse.leftEdge = true; }
            if (e.pointerType === 'touch') loupe.down(e);                    // 🔍
            S.touchHeld = e.pointerType === 'touch';                         // ⛏🎯
            S.placeDelay = 99;
            try { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); } catch (er) { /* nada */ }
        } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
            S.mouse.left = false; S.mouse.right = false;
            loupe.up(e);
            S.touchHeld = false; S.smart = null;
            if (e.pointerType === 'touch') S.mouse.inside = false;
        }
    }
    function swallow(e) { if (S.playing && onCanvas(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }
    function onWheel(e) { if (!S.playing || !onCanvas(e)) return; e.preventDefault(); e.stopImmediatePropagation(); const w = W(); w.selectedInventoryItem = (selIndex() + (e.deltaY > 0 ? 1 : 8)) % 9; hud.dirty = true; }
    function onBlur() { S.keys = {}; S.mouse.left = S.mouse.right = false; }

    // ------------------------------------------------------------------ entrar / salir
    // ---- foto por partes: { base: el mundo sin las listas de cada dimensión, dims: { n: listas de esa dimensión } } (texto JSON)
    function dimKeys(n) { return mbwom.sceneList.map(function (k) { return k + n; }); }
    function snapTake(cur, lazy) {
        const w = mbwom.world;
        if (!lazy) return { full: JSON.stringify(w) };
        const skip = {}; [1, 2, 3].forEach(function (n) { dimKeys(n).forEach(function (k) { skip[k] = 1; }); });
        const base = {}; Object.keys(w).forEach(function (k) { if (!skip[k]) base[k] = w[k]; });
        const sn = { base: JSON.stringify(base), dims: {}, order: Object.keys(w) };
        sn.dims[cur] = snapDimJSON(cur);
        return sn;
    }
    function snapDimJSON(n) { const w = mbwom.world, o = {}; dimKeys(n).forEach(function (k) { if (w[k] !== undefined) o[k] = w[k]; }); return JSON.stringify(o); }
    function snapDim(n) { const sn = S.snapshot; if (sn && !sn.full && !sn.dims[n]) sn.dims[n] = snapDimJSON(n); }   // (antes de entrar a esa dimensión)
    // el mundo de antes de jugar (objeto nuevo): las dimensiones que nunca se visitaron se copian tal como están (no cambiaron)
    function snapWorld() {
        const sn = S.snapshot; if (!sn) return null;
        if (sn.full) return JSON.parse(sn.full);
        const o = JSON.parse(sn.base), w = mbwom.world;
        [1, 2, 3].forEach(function (n) {
            if (sn.dims[n]) Object.assign(o, JSON.parse(sn.dims[n]));
            else dimKeys(n).forEach(function (k) { if (w[k] !== undefined) o[k] = JSON.parse(JSON.stringify(w[k])); });
        });
        // las claves en el mismo orden que tenía el mundo (así el archivo queda igual que antes de jugar)
        const r = {};
        (sn.order || []).forEach(function (k) { if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; });
        Object.keys(o).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(r, k)) r[k] = o[k]; });
        return r;
    }
    window.mbwPlay.snapWorld = function () { return snapWorld(); };   // el mundo de antes de jugar (copia nueva)
    window.mbwPlay.snapInfo = function () { const sn = S.snapshot; return sn ? (sn.full ? { full: true } : { dims: Object.keys(sn.dims).map(Number) }) : null; };   // (lo usan las pruebas)
    function syncScene() {
        const cur = (typeof mbwom.currentScene !== 'undefined') ? mbwom.currentScene : 1;
        mbwom.sceneList.forEach(function (k) { if (mbwom[k] !== undefined) mbwom.world[k + cur] = mbwom[k]; });
        return cur;
    }
    function startPlay(sopts) {
        if (S.playing) return;
        S.test = !!(sopts && sopts.test);                                 // 🧪 Test: nada se guarda
        if (typeof mbwom === 'undefined' || !mbwom.world || !mbwom.scene) { alert(tr('play_no_world', 'Open or create a world first')); return; }
        hookLeafWatch();                                                  // 🍃 (una sola vez)
        // 🎮 en una sala de multijugador: se juega todos juntos (scripts/mp-play.js). Viendo otro mundo (otra pestaña): solo.
        let mpMode = false;
        if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
            const N = window.mbwMpPlay;
            if (!N) { alert(tr('play_no_mp', 'Play mode is not available inside a multiplayer room.')); return; }
            const how = N.beforeStart();
            if (!how) return;
            mpMode = how === 'mp';
        }
        if (!window.MB_PLAY_DATA) { alert('play-data.js missing'); return; }
        const cur = syncScene();
        let snap;
        // 📸 la foto del mundo de antes de jugar. Solo: se toma de la dimensión donde estás; el Nether y el End se fotografían
        // la primera vez que entras (antes de que cambie nada ahí) → empezar a jugar es más rápido. En multijugador, todo de una vez.
        try { snap = snapTake(cur, !mpMode); } catch (e) { alert(tr('play_snap_err', 'Could not take the snapshot of the world, so Play mode did not start.')); return; }
        S.snapshot = snap; S.scene = cur;
        S.old = { tool: (typeof currentTool !== 'undefined') ? currentTool : null, smooth: window.smoothScroll, cam: { x: camera.x, y: camera.y }, scrollOffset: null, anims: window.mbwAnimationsOn !== false };
        S.paused = false;
        const w = mbwom.world;
        if (typeof mbwom.mobs !== 'object' || !mbwom.mobs) { mbwom.mobs = {}; w['mobs' + cur] = mbwom.mobs; }
        // el Player: el del mundo (su posición, inventario y vida). Si está en otra dimensión o no tiene posición, aparece en el centro de la pantalla.
        const sameScene = (w.scene || 1) === cur;
        let px = Number(w.worldX), py = Number(w.worldY);
        if (!sameScene || !isFinite(px) || !isFinite(py)) {
            const sp = spGet();
            if (sp && sameScene) { px = sp.x; py = sp.y; }
            else { px = camera.x + (canvas.width / tileSize) / 2; py = -(camera.y + (canvas.height / tileSize) / 2); }
        }
        w.worldX = px; w.worldY = py; w.scene = cur;
        S.start = { x: px, y: py };
        S.sign = { text: '', a: 0, on: false }; S.iname = { key: null, text: '', t: 0 };
        S.musicT = FPS * (15 + Math.random() * 25) | 0; S.selSnd = null;          // (la primera canción sale a los 15-40 s)
        if (window.mbSfx) { window.mbSfx.stopLoops(); window.mbSfx.stopMusic(); }   // (lo que sonaba editando)
        w.xSpeed = 0; w.ySpeed = 0; w.dead = 0;
        if (!isFinite(Number(w.health))) w.health = 20;
        if (!isFinite(Number(w.food))) w.food = 1000;
        if (!isFinite(Number(w.air))) w.air = 11;
        w.gamemode = Number(w.gamemode) || 0;
        const gmEl = document.getElementById('gamemode');
        if (gmEl && gmEl.value !== '') w.gamemode = Number(gmEl.value) || 0;
        if (w.gamemode != 1) w.fly = false;
        inv();
        for (const id in mbwom.mobs) { const m = mbwom.mobs[id]; if (m && typeof m === 'object') { m.target = null; m.focus = null; m.speedX = Number(m.speedX) || 0; m.speedY = Number(m.speedY) || 0; } }
        S.dropsRestored = false;
        S.p = newPlayer(); S.tmp = new Map(); S.drops = []; S.falling = []; S.arrows = []; S.shots = []; S.fballs = []; S.eyes = []; S.draw = null; S.orbs = []; S.liqFresh = new Set(); S.sandCheck = new Map(); S.leafQ = new Map(); S.dropSeq = 0; S.dropBase = Date.now().toString(36); S.lastPvp = null; S.parts = []; S.wetWas = {}; S.spawnT = new Map(); S.spawnOn = new Set(); S.selShow = null; S.selPrev = null; S.rsOn = new Map(); S.rsReady = false; S.btn = new Map(); S.plates = new Set(); S.portalLock = true; S.portalGo = 0; S.dimStash = {}; S.spect = null; S.tick = 0; S.acc = 0; S.last = 0; S.mine = null; S.useTimer = -1; S.keys = {}; S.mouse.left = S.mouse.right = false; S.mobErr = false;
        // arena y grava cerca: se revisan para que caigan si no tienen nada abajo
        const x0 = Math.max(0, Math.floor(px) - 60), x1 = Math.floor(px) + 60;
        for (let x = x0; x <= x1; x++) { const col = mbwom.scene[x]; if (!col) continue; for (let y = 0; y < col.length; y++) if (col[y] === 'sd' || col[y] === 'gv') S.sandCheck.set(x + ',' + y, 2); }
        S.playing = true; S.mp = mpMode; S.openBoxAt = null; S.ride = null; try { if (window.mbwAch) window.mbwAch.start(); } catch (e) { /* nada */ }
        S.ride = null; S.bob = null; S.sleep = null; S.fires = new Set();
        window.mbwPlaying = true;
        document.body.classList.add('mbw-playing');
        // el bloque Barrier no se ve jugando: si el mundo tiene alguno, el dibujo del mundo se rehace sin ellos
        // (y el tronco de árbol "wd1" se ve igual que la madera "wd")
        try { if ((mbwom.scene || []).some(function (c) { return c && (c.indexOf('b') >= 0 || c.indexOf('wd1') >= 0); }) && typeof initializeWorldCache === 'function') initializeWorldCache(); } catch (e) { /* nada */ }
        window.smoothScroll = true;
        // pantalla completa + solo el mapa (el CSS de body.mbw-playing esconde todo el editor) + la vista del juego (Aspect, medidas de fábrica)
        S.old.fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        S.enteredFs = false;
        if (!S.old.fs && !document.documentElement.classList.contains('is-app')) {
            const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) { try { const pr = req.call(el); S.enteredFs = true; if (pr && pr.catch) pr.catch(function () { S.enteredFs = false; }); } catch (e) { S.enteredFs = false; } }
        }
        document.body.classList.toggle('play-survival', w.gamemode != 1);
        try { window.dispatchEvent(new Event('resize')); } catch (e) { /* nada */ }
        const A = window.mbwAspect;
        if (A && A.startView) {
            S.old.aspect = A.active ? { w: A.w, h: A.h } : null;
            const d = RES[OPTS.res] || A.defaults || { w: 18, h: 14 };      // (Options > Resolution)
            A.startView(d.w, d.h);
        }
        try { if (typeof selectTool === 'function') selectTool('move'); } catch (e) { /* nada */ }
        try { if (typeof toggleMobInfo === 'function') toggleMobInfo(false); } catch (e) { /* nada */ }
        hud.build(); hud.dirty = true;
        applyOpts();
        camSnap();
        S.raf = requestAnimationFrame(frame);
        flashMsg(S.test ? tr('play_test_started', '🧪 Testing: nothing you do will be saved. Esc or ⚙ opens the menu') : tr('play_started2', '▶ Playing! Esc or ⚙ opens the menu'));
        syncButton();
        if (S.mp && window.mbwMpPlay) { try { window.mbwMpPlay.afterStart(); } catch (e) { console.error('mp-play start', e); } }
    }
    // Vuelve a poner la foto del mundo (en el mismo objeto "world", así lo que lo tenga guardado sigue apuntando bien)
    function restoreSnapshot() {
        const w = mbwom.world;
        const fresh = snapWorld();
        Object.keys(w).forEach(function (k) { delete w[k]; });
        Object.assign(w, fresh);
        mbwom.loadScene(S.scene);
        mbwom.currentScene = S.scene;
    }
    function closeModals() {
        if (S.ench) closeEnchant();
        const m = document.getElementById('inventory-modal');
        if (m && m.style.display === 'block' && typeof toggleInventory === 'function') { try { toggleInventory(); } catch (e) { m.style.display = 'none'; } }
        ['sign-editor-modal', 'command-book-modal'].forEach(function (id) { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    }
    function openPause() {
        if (!S.playing) return;
        if (window.mbwPlayMenu && window.mbwPlayMenu.open) { window.mbwPlayMenu.open(); return; }
        saveAndQuit();
    }
    // 💾 "Save and Quit": se sale del Modo Jugar GUARDANDO todo lo que pasó (bloques, cofres, mobs, el Player...). Antes se guarda en
    // el historial de versiones (columna "Modo Jugar") cómo estaba el mundo antes de jugar, por si se quiere volver.
    // Un invitado de una partida: guarda su Player en el mundo del anfitrión y sale (su copia del mundo se la manda el anfitrión).
    function saveAndQuit() {
        if (!S.playing) return;
        if (S.test) { stopPlay({ keep: false }); flashToast('🧪 ' + tr('play_test_done', 'Test finished: nothing was saved')); return; }
        // (todos — anfitrión e invitados — se quedan con lo que pasó en SU copia del mundo y la guardan; los demás siguen jugando)
        let pre = null;
        const fm = window.fileManager || (typeof fileManager !== 'undefined' ? fileManager : null);
        try { if (fm && fm.prepareData) { const d = fm.prepareData(); pre = d && d.textData; } } catch (e) { pre = null; }   // (jugando, prepareData da el mundo de ANTES)
        stopPlay({ keep: true });
        if (fm && typeof fm.saveLocal === 'function') {
            Promise.resolve(fm.saveLocal(false, { playBackup: pre })).then(function () {
                const t = document.createElement('div'); t.className = 'play-saved-toast'; t.textContent = '💾 ' + tr('play_saved', 'World saved (Play mode)');
                document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
            }).catch(function (e) { console.error('play save', e); });
        }
    }
    window.mbwPlay.saveAndQuit = saveAndQuit;
    window.mbwPlay.isTest = function () { return !!(S.playing && S.test); };
    function flashToast(text) { const t = document.createElement('div'); t.className = 'play-saved-toast'; t.textContent = text; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
    window.mbwPlay.setMp = function (on) { S.mp = !!on; };
    window.mbwPlay.setPaused = function (on) { S.paused = !!on; S.keys = {}; S.mouse.left = S.mouse.right = false; S.mine = null; hud.dirty = true; };
    window.mbwPlay.opts = function () { return Object.assign({}, OPTS); };
    window.mbwPlay.setOpt = setOpt;
    window.mbwPlay.RES = RES;
    function stopPlay(opts) {
        if (!S.playing) return;
        S.touchAt = null; loupe.hide();
        // ¿lo que pasó jugando se queda? Sí (todo se guarda), menos para un invitado de una partida: su copia vuelve a como estaba
        // y el anfitrión le manda el mundo nuevo
        const keep = (opts && opts.keep != null) ? !!opts.keep : !S.test;
        S.paused = false;
        if (window.mbwPlayMenu && window.mbwPlayMenu.close) { try { window.mbwPlayMenu.close(true); } catch (e) { /* nada */ } }
        closeModals();                                              // (con el juego todavía activo: lo del cofre no entra al historial)
        const wasMp = S.mp;
        if (wasMp && window.mbwMpPlay) { try { window.mbwMpPlay.beforeStop(); } catch (e) { console.error('mp-play stop', e); } }
        S.mp = false; S.openBoxAt = null;
        S.playing = false;
        cancelAnimationFrame(S.raf);
        if (keep) { try { const cs = syncScene(); mbwom.world.scene = mbwom.world.scene || cs; S.keptAt = Date.now(); if (typeof window.markWorldUnsaved === 'function') window.markWorldUnsaved(); } catch (e) { console.error('play keep', e); } }
        else { try { restoreSnapshot(); } catch (e) { console.error('play restore', e); alert('Error restoring the world: ' + e.message); } }
        try { if (window.mbwAch) window.mbwAch.afterRestore(); } catch (e) { /* nada */ }   // 🏆 los logros no se pierden
        S.snapshot = null; S.drops = []; S.falling = []; S.arrows = []; S.shots = []; S.fballs = []; S.eyes = []; S.draw = null; S.orbs = []; S.tmp = new Map(); S.keys = {}; S.mine = null;
        if (window.mbSfx) { window.mbSfx.stopLoops(); window.mbSfx.stopMusic(); }   // 🔊 se apaga la música, la lluvia, bajo el agua...
        try { const gw = document.getElementById('gr-weather'); if (gw && typeof setWeatherEffect === 'function') setWeatherEffect(gw.value); } catch (e) { /* nada */ }   // (el clima vuelve al de World Settings)
        window.mbwPlaying = false;
        document.body.classList.remove('mbw-playing', 'play-survival');
        hud.destroy();
        const A = window.mbwAspect;
        if (A && A.off) { try { A.off(); if (S.old && S.old.aspect && A.startView) A.startView(S.old.aspect.w, S.old.aspect.h); } catch (e) { /* nada */ } }
        if (S.enteredFs && (document.fullscreenElement || document.webkitFullscreenElement)) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* nada */ } }
        S.enteredFs = false;
        try { window.dispatchEvent(new Event('resize')); } catch (e) { /* nada */ }
        if (S.old) {
            window.smoothScroll = S.old.smooth;
            camera.x = S.old.cam.x; camera.y = S.old.cam.y; camera._tx = camera.x; camera._ty = camera.y; camera.velX = 0; camera.velY = 0;
            try { if (S.old.tool && typeof selectTool === 'function') selectTool(S.old.tool); } catch (e) { /* nada */ }
        }
        try { if (typeof initializeWorldCache === 'function') initializeWorldCache(); } catch (e) { /* nada */ }
        try { if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh(); } catch (e) { /* nada */ }
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        syncButton();
        if (wasMp && window.mbwMpPlay) { try { window.mbwMpPlay.afterStop(keep); } catch (e) { console.error('mp-play after stop', e); } }
        if (S.old && typeof window.setAnimationsEnabled === 'function' && S.old.anims != null) { try { window.setAnimationsEnabled(S.old.anims); } catch (e) { /* nada */ } }
        document.body.classList.remove('play-no-trans');
    }
    window.mbwStartPlay = startPlay;
    window.mbwStopPlay = stopPlay;
    window.mbwTogglePlay = function () { if (S.playing) openPause(); else startPlay(); };

    // Mientras se juega, lo que se guarda / descarga / sube es la FOTO (el mundo de antes de jugar)
    function withSnapshot(fn, self, args) {
        if (!S.playing || !S.snapshot) return fn.apply(self, args);
        if (window.__mbwSaveLive && !S.test) { syncScene(); if (isServer()) mbwom.world.mbweDrops = packAllDrops(); return fn.apply(self, args); }   // 💾 servidor guardado en línea: con lo que pasó jugando (y lo tirado en el suelo)
        const liveWorld = mbwom.world;
        const cur = syncScene();
        const tmpW = snapWorld();
        mbwom.world = tmpW; mbwom.loadScene(S.scene);
        try { return fn.apply(self, args); }
        finally { mbwom.world = liveWorld; mbwom.loadScene(cur); }
    }
    function wrapSaves() {
        const fm = window.fileManager || (typeof fileManager !== 'undefined' ? fileManager : null);
        if (fm && !fm.__playWrapped) {
            fm.__playWrapped = true;
            ['prepareData', 'prepareNetworkJson'].forEach(function (n) { const o = fm[n]; if (typeof o === 'function') fm[n] = function () { return withSnapshot(o, this, arguments); }; });
            const ld = fm.load; if (typeof ld === 'function') fm.load = function () { if (S.playing) stopPlay(); return ld.apply(this, arguments); };
        }
        // Deshacer / Rehacer mientras se juega movería el historial del editor sin que el mundo de antes cambie: se ignora
        const hm = (typeof historyManager !== 'undefined') ? historyManager : null;
        if (hm && !hm.__playWrapped) {
            hm.__playWrapped = true;
            ['undo', 'redo'].forEach(function (n) { const o = hm[n]; if (typeof o === 'function') hm[n] = function () { if (S.playing) { flashMsg(tr('play_no_undo', 'Undo is off while playing')); return; } return o.apply(this, arguments); }; });
            // lo que se cambie jugando (un cofre, un horno) no entra al historial: al parar se vuelve a la foto
            ['startAction', 'recordChange', 'recordMobChange', 'recordMobPlacement', 'commitAction'].forEach(function (n) { const o = hm[n]; if (typeof o === 'function') hm[n] = function () { if (S.playing) return; return o.apply(this, arguments); }; });
        }
        const wt = (typeof WorldTabsManager !== 'undefined') ? WorldTabsManager : null;
        if (wt && !wt.__playWrapped) {
            wt.__playWrapped = true;
            ['switchWorld', 'addWorld', 'closeWorld', 'saveCurrentWorldStateToMemory'].forEach(function (n) { const o = wt[n]; if (typeof o === 'function') wt[n] = function () { if (S.playing) stopPlay(); return o.apply(this, arguments); }; });
        }
    }
    function wrapNet() {
        if (typeof window.enviarMensajeEnRed !== 'function' || window.enviarMensajeEnRed.__play) return;
        const o = window.enviarMensajeEnRed;
        // (jugando solo salen los mensajes de la partida en multijugador, el chat y el espectador; lo demás del editor no)
        const nw = function (d) {
            if (S.playing) {
                const t = d && typeof d.tipo === 'string' ? d.tipo : '';
                if (!(S.mp && t.indexOf('juego_') === 0) && t !== 'chat' && t !== 'spectator_update' && t !== 'ender_cofre') return;   // (el cofre de ender sí: es de todos)
            }
            return o.apply(this, arguments);
        };
        nw.__play = true;
        window.enviarMensajeEnRed = nw;
    }
    // 🧔 Frank (assets/mobs/Frank.png): el Player animado mientras se juega. 17 cuadros de 16×22:
    // 0 quieto · 1-5 caminar · 6-7 agachado · 8 saltar / en el aire · 9-13 picar / golpear · 14 lastimado · 15 sentado · 16 vagoneta.
    // El dibujo mira a la izquierda; hacia la derecha se voltea.
    const frank = new Image();
    frank.src = 'assets/mobs/Frank.png';
    window.mbwPlay.frank = frank;
    const FR = { idle: [0], walk: [1, 2, 3, 4, 5], sneak: [6, 7], jump: [8], mine: [9, 10, 11, 12, 13], hurt: [14], sit: [15], cart: [16] };
    function frankFrame() {
        const w = W(), P = S.p;
        if (!P) return { a: 'idle', f: 0 };
        const ax = Number(w.worldX), last = P.animX === undefined ? ax : P.animX;
        P.animX = ax;
        P.walkDist = (P.walkDist || 0) + Math.abs(ax - last);
        const moving = Math.abs(ax - last) > 0.002 || P.keysX;
        // (P.falling se borra al final de cada paso: lo que dice si está en el aire es wasFalling / la velocidad hacia arriba)
        const climbing = bd(fg(Math.floor(ax), Math.floor(-Number(w.worldY)) + 1), 'climbable') == 1;
        const inAir = (P.wasFalling || Math.abs(Number(w.ySpeed) || 0) > 0.01) && !w.fly && !P.inWater && !climbing && w.gamemode != 3;
        let a = 'idle';
        if (P.hurt > 0) a = 'hurt';
        else if ((S.swing || 0) > 0 || S.mine) a = 'mine';
        else if (inAir) a = 'jump';                                        // en el aire: solo el salto (nunca caminar)
        else if (P.sneaking) a = 'sneak';
        else if (moving) a = 'walk';
        const L = FR[a];
        let i = 0;
        if (a === 'walk') i = Math.floor(P.walkDist / 0.32) % L.length;
        else if (a === 'sneak') i = moving ? Math.floor(P.walkDist / 0.3) % L.length : 0;
        else if (a === 'mine') i = Math.floor(S.tick / 3) % L.length;
        return { a: a, f: L[i] };
    }
    // 🧑 la skin del Player jugando (de la galería de skins; misma tira de 17 cuadros de 16×22 que Frank). Se recuerda en este
    // navegador para todos los mundos ('mbw_play_skin') y los demás la ven (va en juego_jugador).
    const SKIN_KEY = 'mbw_play_skin';
    S.skin = (function () { try { const v = localStorage.getItem(SKIN_KEY) || ''; return /^[0-9]{1,12}$/.test(v) ? v : ''; } catch (e) { return ''; } })();
    function skinSheet(id) {
        if (!id || typeof window.getSpawnskinImage !== 'function') return null;
        const im = window.getSpawnskinImage(id);
        const wd = im ? (im.naturalWidth || im.width || 0) : 0;
        return (im && !im.hasFailed && wd >= 16 && (im.complete !== false)) ? im : null;
    }
    window.mbwPlaySkinSheet = skinSheet;
    // 🧍 la skin del jugador (de frente) con su armadura, para el inventario. Devuelve false si la imagen todavía no está.
    window.mbwPlay.drawPreview = function (cv) {
        const c2 = cv && cv.getContext && cv.getContext('2d'); if (!c2) return false;
        const sk = skinSheet(S.skin), sheet = sk || frank;
        if (!(sheet && (sheet.naturalWidth || sheet.width))) return false;
        c2.clearRect(0, 0, cv.width, cv.height);
        c2.imageSmoothingEnabled = false;
        const k = Math.min(cv.width / 16, cv.height / 22), pw = 16 * k, ph = 22 * k, x = (cv.width - pw) / 2, y = cv.height - ph;
        c2.drawImage(sheet, 0, 0, 16, 22, x, y, pw, ph);
        try { const pa = window.mbwPlayerArmorMob && window.mbwPlayerArmorMob(); if (pa && typeof drawMobArmorOverlay === 'function') drawMobArmorOverlay(c2, pa, x, y, pw, ph); } catch (e) { /* nada */ }
        return true;
    };
    window.mbwPlay.skin = function () { return S.skin; };
    window.mbwPlay.setSkin = function (id) {
        id = /^[0-9]{1,12}$/.test(String(id || '')) ? String(id) : '';
        S.skin = id;
        try { if (id) localStorage.setItem(SKIN_KEY, id); else localStorage.removeItem(SKIN_KEY); } catch (e) { /* nada */ }
        if (id) skinSheet(id);                                         // (que empiece a bajarse)
        hud.dirty = true; if (typeof worldDirty !== 'undefined') worldDirty = true;
    };
    // 🪓 lo que traigo en la mano, dibujado EN la mano del Player (y se mueve con la animación de picar).
    //   Se dibuja con el Player mirando a la izquierda (como el dibujo); si mira a la derecha, el que llama ya volteó todo.
    //   Mano (centro, en píxeles del cuadro de 16×22) para cada uno de los 17 cuadros, y cuánto se gira la herramienta al picar.
    const HAND = [[4, 15], [4, 14], [4, 14], [4, 14], [4, 15], [4, 15], [4, 16], [4, 16], [3, 14], [1, 8], [2, 7], [1, 8], [1, 14], [2, 15], [3, 16], [7, 13], [7, 12]];
    const SWING = { 9: .75, 10: 1, 11: .6, 12: -.45, 13: -.85 };
    const TOOL_HELD = /(Sword|Pickaxe|Axe|Shovel|Hoe|Shears?)$|^(bow|fr|FishingRod|fas|stick|bone|blaze|cos|coas)$/;
    function drawHeld(c2, id, f, pw, ph) {
        id = String(id || '');
        if (!id || id === 'air' || id === 'bl') return;                    // (el globo se dibuja aparte)
        if (/(Cap|Shirt|Pants|Shoes)$/.test(id)) return;
        const hp = HAND[f] || HAND[0], u = pw / 16;
        const hx = -pw / 2 + hp[0] * u, hy = -ph + hp[1] * (ph / 22);
        const im = iconFor(id, {});
        const tool = TOOL_HELD.test(id) || (bd(id, 'tool') == 1 && bd(id, 'placeable') != 1);
        const block = !tool && bd(id, 'placeable') == 1;
        const sz = (tool ? 8 : block ? 5 : 6.5) * u;
        c2.save();
        c2.translate(hx, hy);
        c2.rotate(SWING[f] || 0);
        c2.imageSmoothingEnabled = false;
        if (tool) { c2.scale(-1, 1); c2.drawImage(im, -sz * .22, -sz * .78, sz, sz); }   // (el mango en la mano y la punta hacia adelante y arriba)
        else c2.drawImage(im, -sz * .6, -sz * .55, sz, sz);
        c2.restore();
    }
    window.mbwPlay.drawHeld = drawHeld;
    function drawFrank() {
        if (!(frank.complete && frank.naturalWidth >= 272)) return false;
        const w = W();
        if (!w || w.worldX === undefined) return false;
        if ((w.scene || 1) !== (mbwom.currentScene || 1)) return true;
        if (w.dead > 0) return true;                                   // muerto: no se dibuja
        const c2 = window.ctx || (typeof ctx !== 'undefined' ? ctx : null);
        if (!c2) return false;
        const sx = (Number(w.worldX) - camera.x) * tileSize, sy = canvas.height - (-Number(w.worldY) - camera.y) * tileSize;
        const pw = tileSize * 16 / 11, ph = tileSize * 2;           // (16×22 píxeles: 2 cuadros de alto, como el Player del editor)
        const fr = frankFrame();
        S.frankAnim = fr.a; S.frankF = fr.f;          // (el cuadro también se manda a los demás en multijugador)
        c2.save();
        c2.imageSmoothingEnabled = false;
        c2.translate(sx, sy);
        if (S.sleep) { c2.translate(ph / 2, -pw / 2 + tileSize * .12); c2.rotate(-Math.PI / 2); }   // 🛏 acostado (la cabeza hacia la cabecera)
        else if (S.p && S.p.xScale < 0) c2.scale(-1, 1);
        if (S.p && S.p.hurt > 0) c2.globalAlpha = 0.85;
        const sk = skinSheet(S.skin), sheet = sk || frank;
        const nf = Math.max(1, Math.floor((sheet.naturalWidth || sheet.width) / 16)), fi = fr.f < nf ? fr.f : 0;
        c2.drawImage(sheet, fi * 16, 0, 16, 22, -pw / 2, -ph, pw, ph);
        c2.globalAlpha = 1;
        try {
            const pArmor = window.mbwPlayerArmorMob && window.mbwPlayerArmorMob();
            if (pArmor && typeof drawMobArmorOverlay === 'function') drawMobArmorOverlay(c2, pArmor, -pw / 2, -ph, pw, ph);
        } catch (e) { /* nada */ }
        if (!S.sleep && !effLv('invisibility')) { try { drawHeld(c2, selType(), fr.f, pw, ph); } catch (e) { /* nada */ } }
        c2.restore();
        if (S.swing > 0) S.swing--;
        return true;
    }

    // dibujar encima: se envuelve drawPlayer (el editor lo llama en cada cuadro, después de los mobs)
    function wrapDraw() {
        if (typeof window.drawPlayer !== 'function' || window.drawPlayer.__play) return;
        const o = window.drawPlayer;
        const nw = function () {
            if (S.playing) {
                if (S.mp && window.mbwMpPlay) { try { window.mbwMpPlay.draw(); } catch (e) { /* nada */ } }   // 🎮 los otros jugadores (debajo del mío)
                if (!drawFrank()) o.apply(this, arguments);
                drawExtras();
                return;
            }
            return o.apply(this, arguments);
        };
        nw.__play = true;
        window.drawPlayer = nw;
    }

    // ------------------------------------------------------------------ botón ▶ Play
    function syncButton() {
        const b = document.getElementById('btn-play-mode');
        if (!b) return;
        b.classList.toggle('playing', S.playing);
        const sp = b.querySelector('span');
        if (sp) sp.textContent = S.playing ? tr('play_stop', 'Stop') : tr('play_btn', 'Play');
        b.title = S.playing ? tr('play_menu_tip', 'Menu (Esc)') : tr('play_btn_tip2', 'Play this world. Esc or ⚙ opens the menu; "Save and Quit" keeps what happened.');
        const ic = b.querySelector('.pb-ic');
        if (ic) ic.textContent = S.playing ? '■' : '▶';
    }
    // ▶ el botón Play flota sobre el mapa, arriba a la derecha (más grande); jugando se esconde (arriba sale el ⚙ del menú)
    // 🧪 al pasar el mouse por Play sale "Test": jugar SIN guardar nada (al salir, el mundo queda como estaba)
    function floatButton() {
        const b = document.getElementById('btn-play-mode'), ws = document.getElementById('workspace');
        if (!b || !ws || (b.parentNode && b.parentNode.classList && b.parentNode.classList.contains('play-float-wrap'))) return;
        const wrap = document.createElement('div'); wrap.className = 'play-float-wrap';
        b.classList.add('play-float');
        const t = document.createElement('button'); t.type = 'button'; t.id = 'btn-play-test'; t.className = 'btn-play-mode play-float btn-play-test';
        const ic = document.createElement('b'); ic.className = 'pb-ic'; ic.textContent = '🧪';
        const sp = document.createElement('span'); sp.setAttribute('data-i18n', 'play_test_btn'); sp.textContent = tr('play_test_btn', 'Test');
        t.appendChild(ic); t.appendChild(document.createTextNode(' ')); t.appendChild(sp);
        t.title = tr('play_test_tip', 'Test: play without saving anything. When you leave, the world stays as it was.');
        t.addEventListener('click', function (e) { e.stopPropagation(); startPlay({ test: true }); });
        wrap.appendChild(b); wrap.appendChild(t);
        ws.appendChild(wrap);
    }
    window.mbwStartTest = function () { startPlay({ test: true }); };
    function init() {
        window.mbwPlay.flash = flashMsg;
        floatButton();
        // 🎮 Etapa 2 (scripts/mp-play.js)
        window.mbwPlay.net = {
            // 👑 el anfitrión (o Crystal) usó un comando sobre mí
            cmd: function (d) {
                const M = window.mbwMpPlay;
                if (!S.playing || !d || !M || d.peerId === (M.myId && M.myId())) return false;
                const ok = (d.peerId && (d.peerId === M.leaderPeer || (M.roomHostPeer && d.peerId === M.roomHostPeer()))) || isAdminUid(d.uid);
                if (!ok) return false;
                const c = String(d.c || '').slice(0, 200);
                if (!/^\/(tp|heal|kill|give|clear|gamemode)(\s|$)/.test(c)) return false;
                const s = Number(d.s) || 0;
                if (d.dn && /^\/tp /.test(c)) { tpToPlayerSoon(String(d.dn).slice(0, 40), c, s); return true; }   // ⏱ con otro jugador: en 3 segundos
                if (s && s !== (mbwom.currentScene || 1) && !changeDim(s, 'cmd')) return false;
                say('[INFO] 👑 ' + tr('play_cmd_by', '{name} used {cmd} on you.').replace('{name}', String(d.autor || 'Host')).replace('{cmd}', c.split(' ')[0]));
                runCommand(c, { forced: true }); hud.dirty = true;
                return true;
            },
            hurtMe: function (amount, cause) { if (S.playing) ouch(1, Number(amount) || 0, String(cause || 'attack')); },
            hitMob: function (id, dmg, kx, ky, by, loot) {
                const m = mbwom.mobs[id]; if (!S.playing || !m || m.dead > 0) return;
                hurtMob(id, Math.max(0, Number(dmg) || 0), 'attack', by);
                m.speedX = (Number(m.speedX) || 0) + (Number(kx) || 0);
                const cb = cbounds(m);
                if (ky && collision(m.x + .7 * cb.left, m.y + 1, .7 * cb.width, 0, 4, false)) { m.speedY = (Number(m.speedY) || 0) + Number(ky); m.y -= 1 / 3; }
            },
            boom: function (x, y, c, by) { if (S.playing) netBoom(Number(x), Number(y), Number(c), by); },
            loot: function (list) {
                if (!S.playing || !Array.isArray(list)) return;
                list.forEach(function (e) { if (e[0] === 'd') addDrop(e[1], e[2], e[3], e[4], e[5], e[6]); else if (e[0] === 'x') dropXP(e[1], e[2], e[3], 0, true); });
            },
            newMob: function (m) { if (!S.playing || !m || !m.type || !D.mobs[m.type]) return null; const id = spawnMob(String(m.type), Number(m.x) || 0, Number(m.y) || 0); Object.keys(m).forEach(function (k) { if (k !== 'type') mbwom.mobs[id][k] = m[k]; }); return id; },
            setArrows: function (list) {
                list = list || [];
                S.arrows = list.filter(function (r) { return !r[4]; }).map(function (r) { return { x: r[0], y: r[1], vx: r[2], vy: r[3], age: 0, ghost: true }; });
                S.fballs = list.filter(function (r) { return r[4]; }).map(function (r) { return { x: r[0], y: r[1], vx: r[2], vy: r[3], big: r[4] === 1, age: 0, ghost: true }; });   // 🔥 (las bolas de fuego del anfitrión)
            },
            arrows: function () { return S.arrows.concat(S.fballs.filter(function (f) { return !f.ghost; }).map(function (f) { return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, fb: f.big ? 1 : 2 }; })); },                  // (lo que tira el Player va aparte: juego_tiro)
            shot: function (d) { ghostShot(d); },
            forget: function (id) { S.tmp.delete(id); },
            heldId: function () { return selType(); },
            gm: function () { return W().gamemode; },
            say: function (t) { say(String(t)); chat.dirty = true; },
            flash: flashMsg,
            // objetos en el suelo
            dropIn: function (o) {
                if (!S.playing || !o || !o.nid || dropIdx(o.nid) >= 0) return;
                const d = { nid: String(o.nid), id: String(o.id), n: o.n | 0, dmg: o.dmg || 0, ex: o.ex || {}, x: Number(o.x), y: Number(o.y), vx: Number(o.vx) || 0, vy: Number(o.vy) || 0, age: o.age | 0, born: Number(o.born) || Date.now() };
                const sc = Number(o.s) || 0;
                // (un objeto que cayó en otra dimensión se guarda para cuando vaya allá)
                if (sc && sc !== (mbwom.currentScene || 1)) { S.dimStash = S.dimStash || {}; const b = S.dimStash[sc] = S.dimStash[sc] || {}; b.drops = b.drops || []; if (!b.drops.some(function (q) { return q.nid === d.nid; })) b.drops.push(d); return; }
                S.drops.push(d);
            },
            dropsPack: function () {
                const out = S.drops.filter(function (d) { return d.nid; }).map(function (d) { return packDrop(d); });
                Object.keys(S.dimStash || {}).forEach(function (k) { ((S.dimStash[k] || {}).drops || []).forEach(function (d) { if (d.nid) out.push(packDrop(d, Number(k))); }); });
                return out;
            },
            // (anfitrión) un invitado quiere recogerlo: se lo lleva si todavía está
            dropGrant: function (nid, peerId) {
                if (!peerId) return;
                let d = null; const i = dropIdx(nid);
                if (i >= 0) { d = S.drops[i]; S.drops.splice(i, 1); }
                else Object.keys(S.dimStash || {}).forEach(function (k) { const b = S.dimStash[k]; if (d || !b || !b.drops) return; const j = b.drops.findIndex(function (q) { return q.nid === nid; }); if (j >= 0) { d = b.drops[j]; b.drops.splice(j, 1); } });   // (en otra dimensión)
                if (!d) return;
                mpSend({ tipo: 'juego_tomado', nid: nid, n: 0, a: peerId, item: [d.id, d.n, d.dmg, d.ex] });
            },
            dropTaken: function (m) {
                if (!S.playing) return;
                Object.keys(S.dimStash || {}).forEach(function (k) { const b = S.dimStash[k]; if (b && b.drops) { const j = b.drops.findIndex(function (q) { return q.nid === m.nid; }); if (j >= 0) { if (m.n > 0) b.drops[j].n = m.n | 0; else b.drops.splice(j, 1); } } });
                const i = dropIdx(m.nid);
                if (i >= 0) { if (m.n > 0) { S.drops[i].n = m.n | 0; S.drops[i].pend = 0; } else S.drops.splice(i, 1); }
                // a mí me tocó: a mi inventario (si no cabe todo, lo que sobra se vuelve a tirar)
                if (m.a && window.mbwMpPlay && m.a === window.mbwMpPlay.myId() && Array.isArray(m.item)) {
                    const it = m.item, left = addToInventory(String(it[0]), it[1] | 0, it[2] || 0, it[3] || {});
                    if (left < (it[1] | 0)) pickSnd();
                    if (left > 0) { const w = W(); addDrop(String(it[0]), w.worldX, w.worldY - .5, left, it[2] || 0, it[3] || {}); }
                    hud.dirty = true;
                }
            },
            // 💾 (invitado) mis datos guardados en el mundo del anfitrión; la primera vez: aparezco en el /home o el spawn
            loadMine: function (data, spawn) {
                const w = W(); if (!S.playing) return;
                if (data && typeof data === 'object') {
                    if (isFinite(Number(data.x)) && isFinite(Number(data.y)) && (data.s == null || Number(data.s) === (mbwom.currentScene || 1))) { w.worldX = Number(data.x); w.worldY = Number(data.y); }
                    if (Array.isArray(data.inv)) w.inventoryList = JSON.parse(JSON.stringify(data.inv));
                    if (Array.isArray(data.armors)) w.armors = JSON.parse(JSON.stringify(data.armors));
                    if (isFinite(Number(data.health)) && Number(data.health) > 0) w.health = Number(data.health);
                    if (isFinite(Number(data.food))) w.food = Number(data.food);
                    if (isFinite(Number(data.xp))) w.experience = Number(data.xp);
                    if (isFinite(Number(data.sel))) w.selectedInventoryItem = Number(data.sel) | 0;
                    if (data.gm != null && data.gm !== '' && isFinite(Number(data.gm))) {   // (su modo de juego: cada quien el suyo)
                        const g = Number(data.gm) | 0; w.gamemode = g; if (g === 3) w.fly = true; else if (g !== 1) w.fly = false;
                        document.body.classList.toggle('play-survival', g != 1);
                    }
                } else if (spawn && isFinite(Number(spawn.x)) && isFinite(Number(spawn.y))) { w.worldX = Number(spawn.x); w.worldY = Number(spawn.y); }
                w.xSpeed = 0; w.ySpeed = 0; inv(); hud.dirty = true; camSnap();
                try { if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh(); } catch (e) { /* nada */ }
            },
            // otro jugador me pegó
            pvp: function (dmg, kx, name) {
                const w = W(); if (!S.playing || w.dead > 0 || w.gamemode == 1 || w.gamemode == 3) return;
                S.pvpGot = S.pvpGot || {}; const nk = String(name || 'Player');      // (también aquí: no más de 1 golpe cada 1.5 s del mismo jugador)
                if (Date.now() - (S.pvpGot[nk] || 0) < PVP_COOLDOWN - 150) return;
                S.pvpGot[nk] = Date.now();
                S.lastPvp = { name: String(name || 'Player'), t: Date.now() };
                ouch(1, Math.max(0, Number(dmg) || 0), 'attack');
                w.xSpeed = (Number(w.xSpeed) || 0) - (Number(kx) || 0);      // (en el juego, xSpeed positivo mueve al Player a la IZQUIERDA)
                if (!S.p.falling) { w.ySpeed = Math.max(Number(w.ySpeed) || 0, migSpeed(5)); w.worldY -= 1 / 30; }
            }
        };
        wrapSaves(); wrapDraw(); wrapNet();
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        ['pointerdown', 'pointerup', 'pointercancel', 'pointermove'].forEach(function (n) { window.addEventListener(n, onPointer, true); });
        ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend'].forEach(function (n) { window.addEventListener(n, swallow, { capture: true, passive: false }); });
        window.addEventListener('mousemove', function (e) { if (S.playing && onCanvas(e)) e.stopImmediatePropagation(); }, true);
        window.addEventListener('wheel', onWheel, { capture: true, passive: false });
        window.addEventListener('blur', onBlur);
        window.addEventListener('beforeunload', function () { if (S.playing) { try { restoreSnapshot(); } catch (e) { /* nada */ } } });
        window.addEventListener('mbw-lang-changed', function () { syncButton(); hud.texts(); });
        syncButton();
        setTimeout(function () { wrapSaves(); wrapDraw(); wrapNet(); }, 1500);
        ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (n) { document.addEventListener(n, function () {
            // Esc en pantalla completa: el navegador sale de pantalla completa (y no avisa la tecla): se deja de jugar también
            if (S.playing && S.enteredFs && !(document.fullscreenElement || document.webkitFullscreenElement)) { S.enteredFs = false; openPause(); }   // (salir de pantalla completa: abre el menú de pausa)
            else if (S.playing) { try { window.dispatchEvent(new Event('resize')); } catch (e) { /* nada */ } }
        }); });
        window.addEventListener('resize', function () { if (S.playing && window.mbwAspect && window.mbwAspect.refit) setTimeout(function () { window.mbwAspect.refit(); camSnap(); }, 0); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
