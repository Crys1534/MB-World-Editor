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
// APROXIMADO / NO INCLUIDO (se dice para no engañar): la lava no prende fuego, no hay día/noche ni clima, no aparecen
// mobs nuevos solos, no hay redstone, ni crafteo, ni encantamientos, ni efectos de pociones, ni crías / domesticar.
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
        tmp: new Map(), drops: [], falling: [], arrows: [], sandCheck: new Map(), liqFresh: new Set(), orbs: [], xpT: 0,
        tick: 0, acc: 0, last: 0, raf: 0, mine: null, placeDelay: 0, useTimer: -1, msg: '', msgT: 0,
        sign: { text: '', a: 0, on: false }, iname: { key: null, text: '', t: 0 },
        touchMode: 'mine'
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
        if (w.gamemode != 1 && w.gamemode != 3 && !(w.dead > 0)) { best = PLAYER_ID; bd2 = Math.pow(w.worldX - m.x, 2) + Math.pow(w.worldY - m.y, 2); }
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
        if (!it || bd(it[0], 'tool') != 1) return;
        const life = bd(it[0], 'life');
        if (life == null) return;
        it[2] = (Number(it[2]) || 0) + 1;
        if (it[2] >= life) inv()[selIndex()] = empty();
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
        const o = { id: String(id), n: count | 0, dmg: dmg || 0, ex: extras || {}, x: x, y: y, vx: migSpeed(4 * Math.random() - 2), vy: migSpeed(-4), age: 0 };
        S.drops.push(o);
        // 🎮 multijugador: todos ven el objeto (con un número para saber cuál es) y cae igual en todas las pantallas
        if (S.mp && window.mbwMpPlay) { o.nid = window.mbwMpPlay.myId() + ':' + S.dropBase + ':' + (++S.dropSeq); mpSend({ tipo: 'juego_suelta', d: packDrop(o) }); }
    }
    const packDrop = (o) => ({ nid: o.nid, id: o.id, n: o.n, dmg: o.dmg, ex: o.ex, x: o.x, y: o.y, vx: o.vx, vy: o.vy, age: o.age | 0 });
    const dropIdx = (nid) => { for (let i = 0; i < S.drops.length; i++) if (S.drops[i].nid === nid) return i; return -1; };
    function tickDrops() {
        const w = W();
        for (let i = S.drops.length - 1; i >= 0; i--) {
            const d = S.drops[i];
            d.age++;
            d.vy = Math.min(migSpeed(14), d.vy + .5);
            d.vx *= .9;
            const nx = d.x + d.vx / 30, ny = d.y + d.vy / 30;
            if (!collision(nx - .15, ny - .25, .3, 0, .1, true, false)) d.x = nx; else d.vx = 0;
            if (collision(d.x - .15, ny, .3, 0, .1, true, false)) { d.vy = 0; } else d.y = ny;
            if (d.age > 300 * FPS || d.y > 10) { S.drops.splice(i, 1); continue; }
            if (d.age > 25 && !(w.dead > 0) && w.gamemode != 3 && Math.abs(d.x - w.worldX) < 1.5 && Math.abs(d.y - (w.worldY - 1)) < 1.5) {
                // 🎮 invitado: se lo pide al anfitrión (si dos lo tocan a la vez, se lo lleva el primero)
                if (S.mp && d.nid && mpGuest()) { if (!d.pend || S.tick - d.pend > 75) { d.pend = S.tick; mpSend({ tipo: 'juego_toma', nid: d.nid }); } continue; }
                const n0 = d.n;
                const left = addToInventory(d.id, d.n, d.dmg, d.ex);
                if (left <= 0) S.drops.splice(i, 1); else d.n = left;
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
    function checkSand(x, y) {
        const t = fg(x, y);
        if (PLANTS[t]) { if (!plantSupported(x, y, t)) mineBlock(x, y, true); return; }
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
    function sneakOrUse() { return S.p.sneaking || S.useTimer > -1; }
    function ouch(b, a, c) {
        const w = W();
        if (w.dead > 0 || w.gamemode == 1 || w.gamemode == 3) return;
        if (['anvil', 'fall', 'lava', 'acid', 'explosion', 'fire', 'lightning', 'attack', 'arrow', 'cactus'].indexOf(c) >= 0) {
            let d = 1;
            for (let p = 0; p < w.armors.length; p++) {
                const ar = w.armors[p];
                if (!ar || !ar[0] || ar[0] === 'air') continue;
                const id = String(ar[0]);
                let B = 1;
                if (c === 'anvil' && p === 0) {
                    a *= id.substr(0, 7) === 'Leather' ? .8 : id.substr(0, 4) === 'Gold' ? .6 : id.substr(0, 4) === 'Iron' ? .4 : id.substr(0, 7) === 'Diamond' ? .3 : id.substr(0, 6) === 'Dragon' ? .2 : 1;
                    continue;
                }
                const life = bd(id, 'life');
                if (life != null && (Number(ar[1]) || 0) <= life) {
                    B = id.substr(0, 7) === 'Leather' ? .72 - Math.random() * .08 : id.substr(0, 4) === 'Gold' ? .6 - Math.random() * .16 : id.substr(0, 4) === 'Iron' ? .48 - Math.random() * .2 : id.substr(0, 7) === 'Diamond' ? .4 - Math.random() * .28 : id.substr(0, 6) === 'Dragon' ? .36 - Math.random() * .32 : 1;
                    if (id.substr(0, 6) === 'Dragon' && (c === 'fire' || c === 'lightning' || c === 'lava')) B *= Math.pow(Math.random(), 3);
                    ar[1] = (Number(ar[1]) || 0) + a * (1 - B) * .75;             // la armadura se gasta
                    if (ar[1] >= life && bd(id, 'tool') == 1) w.armors[p] = ['air', 0, {}];
                }
                d -= .25 * (1 - B);
            }
            a *= Math.max(0, d);
        }
        if (a !== 0) { w.health -= Math.ceil(a); if (a > 0) { S.p.hurt = 10; buzz(Math.min(120, 35 + 10 * Math.ceil(a))); snd(Math.random() < .5 ? 'ouch1' : 'ouch2', { vary: .3 }); } hud.dirty = true; }
    }
    const key2 = (n) => !!S.keys[n];
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
            const sp = 2.2, spr = sp + 2.2;
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
            if (key2('up')) {
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
                        else if (!P.falling) jb = 15;
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
        if (!(w.health <= 0 || (w.dead | 0) !== 0)) return;
        w.dead = (w.dead | 0) + 1;
        if (w.dead === 1) {
            const by = (S.mp && S.lastPvp && Date.now() - S.lastPvp.t < 5000) ? S.lastPvp.name : '';
            flashMsg(by ? tr('mpplay_killed_by', '💀 {name} defeated you').replace('{name}', by) : tr('play_dead', '💀 You died'));
            if (S.mp) mpSend({ tipo: 'juego_muerte', autor: myNameNet(), por: by });
        }
        if (w.dead <= 30) return;
        if (gameRule('keepinventory') != true) {                      // suelta todo (como el juego)
            const list = inv();
            for (let i = 0; i < 45; i++) if (!isEmpty(list[i])) { addDrop(list[i][0], w.worldX, w.worldY, list[i][1], list[i][2], list[i][3]); list[i] = empty(); }
            for (let i = 0; i < 4; i++) { const ar = w.armors[i]; if (ar && ar[0] && ar[0] !== 'air') addDrop(ar[0], w.worldX, w.worldY, 1, ar[1], ar[2]); w.armors[i] = ['air', 0, {}]; }
            dropXP(w.worldX, w.worldY - .5, Math.floor(.5 * (Number(w.experience) || 0)), 0, true);   // la mitad de la experiencia
            w.experience = 0;
        }
        w.xSpeed = 0; w.ySpeed = 0; w.health = 20; w.food = 1000; w.dead = 0;
        const sp = spawnPoint();
        w.worldX = sp.x; w.worldY = sp.y;
        S.p = newPlayer();
        hud.dirty = true;
        camSnap();
    }
    function spawnPoint() {
        const s = mbwom.spawnPoint;
        if (s && typeof s === 'object' && isFinite(Number(s.x)) && isFinite(Number(s.y))) return { x: Number(s.x), y: Number(s.y) };
        return { x: S.start.x, y: S.start.y };
    }

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
            if (a.followItems && a.followItems[selType()] && w.gamemode != 3 && Math.pow(w.worldX - m.x, 2) + Math.pow(w.worldY - m.y, 2) < 49) { m.focus = PLAYER_ID; busy = true; }
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
    function hurtMob(id, amount, cause, by) {
        const m = mbwom.mobs[id]; if (!m || m.dead > 0) return;
        const a = D.mobs[m.type] || {};
        if (!isFinite(Number(m.health))) m.health = maxHealth(m);
        if (m.type === 'cow' && m.variant === 'cowctus' && cause === 'cactus') return;
        m.health = Math.round(m.health - amount);
        if (amount > 0) mobSnd(m, 'hurt');
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
    function killMob(id, m) {
        const a = D.mobs[m.type] || {};
        const d = tmpOf(id);
        m.dead = 1;
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
            o.age++;
            const dx = w.worldX - o.x, dy = (w.worldY - .9) - o.y, dist = Math.hypot(dx, dy);
            const alive = !(w.dead > 0) && w.gamemode != 3;
            if (alive && o.age > 15 && dist < 6) { const f = (1 - dist / 6) * .9 + .2; o.vx += dx / dist * f; o.vy += dy / dist * f; o.vx *= .88; o.vy *= .88; }
            else { o.vy = Math.min(migSpeed(14), o.vy + .4); o.vx *= .9; }
            const nx = o.x + o.vx / 30, ny = o.y + o.vy / 30;
            if (dist < 6 && alive) { o.x = nx; o.y = ny; }
            else {
                if (!collision(nx - .1, o.y - .2, .2, 0, .1, true, false)) o.x = nx; else o.vx = 0;
                if (collision(o.x - .1, ny, .2, 0, .1, true, false)) o.vy = 0; else o.y = ny;
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
            r.age++;
            r.vy += .25; r.vx *= .995;
            r.x += r.vx / 30; r.y += r.vy / 30;
            if (r.age > 400 || collision(r.x, r.y, 0, 0, .1, true, false)) { S.arrows.splice(i, 1); continue; }
            if (r.ghost) continue;                                     // 🎮 (invitado: la flecha es del anfitrión, solo se ve)
            const dmg = Math.max(1, Math.round(Math.hypot(r.vx, r.vy) / 4));
            const pb = mobBounds(PLAYER_ID);
            if (r.x > pb.l && r.x < pb.r && r.y > pb.t && r.y < pb.b) { ouch(1, dmg, 'arrow'); S.arrows.splice(i, 1); continue; }
            if (mpHost()) {
                const R = window.mbwMpPlay.remotes; let hit = null;
                for (const k in R) { const b = plBounds(RP + k); if (b && r.x > b.l && r.x < b.r && r.y > b.t && r.y < b.b) { hit = RP + k; break; } }
                if (hit) { hitRemote(hit, dmg, 'arrow'); S.arrows.splice(i, 1); }
            }
        }
    }
    function mobTick(id, c) {
        const a = D.mobs[c.type];
        if (!a) return;
        const w = W(), d = tmpOf(id);
        if (c.dead > 0) { c.dead++; c.speedX = 0; if (c.dead > 40) { delete mbwom.mobs[id]; S.tmp.delete(id); } return; }
        if (!isFinite(Number(c.health))) c.health = maxHealth(c);
        if (c.health <= 0) { killMob(id, c); return; }
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
        calcTarget(id, c, a, d);
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
                ouch(1, Math.max(1, c.attackDamage != null ? c.attackDamage : a.attackDamage != null ? a.attackDamage : 2), 'attack');
            }
            did = true; tx = w.worldX; ty = w.worldY;
        } else if (c.target != null && mbwom.mobs[c.target]) {
            if (a.attackContact == 1 && intersects(mobBounds(id), mobBounds(c.target))) { c.attackCooldown = a.attackFrequency || 26; hurtMob(c.target, a.attackDamage != null ? a.attackDamage : 2, 'attack', id); }
            did = true; tx = mbwom.mobs[c.target].x; ty = mbwom.mobs[c.target].y;
        }
        const dist = Math.hypot(tx - c.x, ty - c.y);
        if (a.attackBow == 1) { if (did && dist < 10) { shootArrow(c, { x: tx, y: ty - 1 }); c.attackCooldown = a.attackFrequency || 40; } else c.attackCooldown = -30; }
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
    function blockDist(bx, by) { const w = W(); return Math.hypot(Math.floor(w.worldX) - bx, Math.floor(-w.worldY) - (by - 1)); }
    function mobUnderMouse(mw) {
        const w = W();
        if (typeof window.findMobAt !== 'function') return null;
        const hit = window.findMobAt(mw.x, mw.y);
        if (!hit || !mbwom.mobs[hit.key] || mbwom.mobs[hit.key].dead > 0) return null;
        const m = hit.mob;
        if (Math.hypot(m.x - w.worldX, m.y - w.worldY) > 3.5) return null;
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
    function mineBlock(x, y, byCmd) {
        const w = W();
        const t = fg(x, y);
        if (t === 'air' || (t === 'br' && w.gamemode != 1)) return;
        const s1 = st(x, y);
        const chestItems = (t === 'chest' && mbwom.chests && Array.isArray(mbwom.chests[key(x, y)])) ? mbwom.chests[key(x, y)] : null;
        if (!byCmd) blockSnd(t, 'break', x, y);
        setBlock(x, y, null);
        if (w.gamemode == 1) return;
        if (!byCmd) damageTool();
        const dw = bd(t, 'dropsWith');
        const tool = selType();
        if (dw && !dw[tool]) return;                               // hace falta la herramienta correcta para que suelte algo
        let drop = bd(t, 'dropDifferent');
        if (drop === 'na') drop = null; else if (drop == null) drop = t;
        if (t === 'lv' || t.substr(0, 2) === 'lv') drop = Math.random() < 1 / 12 ? 'sl' : null;   // (hojas: aproximado)
        if (Array.isArray(drop)) drop = drop[0];
        const ex = (typeof s1 === 'string' && s1 && (t === 'cloth' || t === 'carpet' || t === 'bdcloth' || t === 'bed')) ? { type: s1 } : {};
        if (drop) addDrop(drop, x + .5, -y - .5, 1, 0, ex);
        if (chestItems) chestItems.forEach(function (it) { if (!isEmpty(it)) addDrop(it[0], x + .5, -y - .5, it[1], it[2], it[3]); });
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
        setBlock(bx, by, id, s1);
        blockSnd(id, 'place', bx, by);
        reduceSelected(1);
        return true;
    }
    // 🚪 Puertas y trampillas de madera (Block_Door.toggle / Block_TrapDoor.useEvent) y 🎵 bloque musical (Block_Note.useEvent2):
    // la puerta tiene 2 partes (1 = abajo, 2 = arriba abiertas; 3 = abajo, 4 = arriba cerradas). Las de hierro no se abren a mano.
    function useBlock(x, y) {
        const t = fg(x, y);
        let m = /^(dr|bdr)([1-4])$/.exec(t);
        if (m) {
            const b = m[1], n = +m[2];
            const low = (n === 1 || n === 3) ? y : y - 1;
            const open = n === 1 || n === 2;
            const s0 = st(x, low), s1 = st(x, low + 1);
            setBlock(x, low, b + (open ? '3' : '1'), s0); setBlock(x, low + 1, b + (open ? '4' : '2'), s1);
            sndAt(open ? 'doorclose' : 'dooropen', x + .5, -(y + .5));
            return true;
        }
        // 🚧 puerta de cerca (de madera o del Nether): abrir (se puede pasar) / cerrar. Abierta = states true (Game: 1 == states)
        if (t === 'fncg' || t === 'nfncg') {
            const open = st(x, y) == 1;
            const ns = { type: t }; if (!open) ns.states1 = true;
            mbwom.setBlockState(x, y, ns);
            if (typeof window.renderBlock === 'function') window.renderBlock(x, y);
            sndAt(open ? 'doorclose' : 'dooropen', x + .5, -(y + .5));
            return true;
        }
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
    window.mbwPlay.addDrop = function (id, x, y, n) { addDrop(id, x, y, n || 1, 0, {}); };                  // (lo usan las pruebas)
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
    function attackPlayer(peerId) {
        const w = W(), r = window.mbwMpPlay.remotes[peerId]; if (!r) return;
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
            if (!(S.mouse.right || S.mouse.rightEdge) || bd(selType(), 'food') == null) S.useTimer = -1;
            else if (--S.useTimer === 0) {
                const fd = bd(selType(), 'food');
                // 🔊 al terminar: "drink" para lo que se bebe, si no uno de los 4 "eat"
                if (bd(selType(), 'drink') != null || selType() === 'potion') snd('drink' + ((Math.random() * 2 | 0) + 1)); else snd('eat' + ((Math.random() * 4 | 0) + 1));
                const ate = selType();
                if (fd && fd.hunger != null) w.food = Math.min(1000, w.food + fd.hunger);
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
            return;
        }
        const mw = mouseWorld();
        // un clic rapidísimo (se suelta antes del siguiente paso) cuenta igual una vez
        const right = S.mouse.right || S.mouse.rightEdge, left = S.mouse.left || S.mouse.leftEdge, rightFresh = S.mouse.rightEdge;
        S.mouse.rightEdge = false; S.mouse.leftEdge = false;
        if (right) {
            if (selType() === 'cbook') { if (rightFresh) useCommandBook(); S.mine = null; return; }      // (una vez por clic)
            const bx = Math.floor(mw.x), by = Math.floor(mw.y);
            if (rightFresh && BOX[fg(bx, by)] && blockDist(bx, by) <= REACH + 1) { openBox(bx, by); return; }   // clic derecho en un cofre / horno: se abre
            if (rightFresh && !S.p.sneaking && blockDist(bx, by) <= REACH + 1 && useBlock(bx, by)) { S.mine = null; S.swing = 15; return; }   // puertas, trampillas, bloque musical
            S.rightFresh = rightFresh;
            if (S.placeDelay >= 6 && placeBlock(mw)) { S.placeDelay = 0; S.swing = 15; }
            S.rightFresh = false;
            S.mine = null;
            return;
        }
        if (!left) { S.mine = null; return; }
        if (S.placeDelay < 6) return;
        const mid = mobUnderMouse(mw);
        if (mid) { attackMob(mid); buzz(15); S.swing = 15; S.placeDelay = 0; S.mine = null; return; }
        const pid = playerUnderMouse(mw);                              // 🎮 otro jugador
        if (pid) { attackPlayer(pid); buzz(15); S.swing = 15; S.placeDelay = 0; S.mine = null; return; }
        const bx = Math.floor(mw.x), by = Math.floor(mw.y);
        const t = fg(bx, by);
        if (t === 'air' || bd(t, 'liquid') == 1 || (t === 'br' && w.gamemode != 1) || blockDist(bx, by) > REACH + 1) { S.mine = null; return; }
        if (!S.mine || S.mine.x !== bx || S.mine.y !== by || S.mine.t !== t) {
            const n = w.gamemode == 1 ? 0 : miningTime(t);
            if (n < 0) { S.mine = null; return; }
            S.mine = { x: bx, y: by, t: t, left: n, total: Math.max(1, n) };
            if (t === 'note' && n > 0) playNote(bx, by);                // (al pegarle suena la nota, sin cambiarla)
        }
        if (S.mine.left > 0 && (S.mine.total - S.mine.left) % 26 === 0) blockSnd(t, 'mine', bx, by);   // 🔊 picando: cada medio segundo
        if (S.mine.left <= 0) { mineBlock(bx, by); buzz(22); S.mine = null; S.placeDelay = w.gamemode == 1 ? 0 : 6; return; }
        if (S.mine.left % 13 === 0) buzz(6);                         // (picando: golpecitos suaves)
        S.mine.left--;
    }


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
    // cambiar de dimensión jugando (1 = Overworld, 2 = Nether, 3 = End); devuelve true si se pudo
    function changeDimension(n) {
        n = Number(n);
        if (!(n >= 1 && n <= 3)) return false;
        if ((mbwom.currentScene || 1) === n) return true;
        if (typeof window.mbwPlayChangeDim === 'function') return !!window.mbwPlayChangeDim(n);
        return false;
    }
    function runCommand(raw) {
        const w = W();
        let c = String(raw || '').trim();
        if (c[0] === '/' || c[0] === '\\') c = c.slice(1);
        const d = c.toLowerCase().split(/\s+/).filter(Boolean);
        if (!d.length) return;
        if (d[0] === 'cls') { cmdLog.length = 0; chat.dirty = true; return; }
        if (!cheatsOn()) { say('[INFO] ' + tr('play_cheats_off', 'Commands are disabled in this world. Turn on "Commands" in World Settings (the game would not run them either).')); return; }
        const fb = gameRule('sendcommandfeedback') !== false;
        const info = (t) => { if (fb) say('[INFO] ' + t); };
        switch (d[0]) {
            case 'tp': {
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
                if (!mbwom.spawnPoint || typeof mbwom.spawnPoint !== 'object') { mbwom.spawnPoint = { x: S.start.x, y: S.start.y }; mbwom.world['spawnPoint' + S.scene] = mbwom.spawnPoint; }
                const sp = mbwom.spawnPoint;
                if (d[1] === 'set') {
                    if (d.length === 2) { sp.x = w.worldX; sp.y = w.worldY; info('Your home position has been set to your current position.'); return; }
                    const x = coord(d[2], 'x'), y = coord(d[3], 'y'); if (isNaN(x) || isNaN(y)) { say('[INFO] home <get|set [~]x [~]y>'); return; }
                    sp.x = x; sp.y = -y; info('Your home position has been set to x=' + Math.floor(100 * x) / 100 + ', y=' + Math.floor(100 * y) / 100 + '.'); return;
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
            case 'say': say('[SAY] ' + String(raw).replace(/^[\/\\]?\s*say\s*/i, '')); return;
            case 'time': if (d[1] === 'set' && d[2] != null) { const v = d[2] === 'day' ? 0 : d[2] === 'night' ? 50 : Math.floor(+d[2] % 100); if (!isNaN(v)) { w.tim = v; info('Time set to ' + v + '. (Play mode has no day/night yet)'); return; } } if (d[1] === 'get') { say('[INFO] The time is ' + (w.tim | 0) + '.'); return; } say('[INFO] time <get|set <t|day|night>>'); return;
            case 'weather': { const v = d[1] === 'set' ? d[2] : d[1]; const n = (v === 'clear' || v === '0') ? 0 : (v === 'rain' || v === '1') ? 1 : (v === 'thunder' || v === '2') ? 2 : -1; if (n < 0) { say('[INFO] weather <get|set <clear|rain|thunder>>'); return; } w.raining = n; if (typeof setWeatherEffect === 'function') { try { setWeatherEffect(['clear', 'rain', 'thunder'][n]); } catch (e) { /* nada */ } } info('Weather set to ' + ['clear', 'rain', 'thunder'][n] + '.'); return; }
            case 'difficulty': { if (['peaceful', 'easy', 'normal', 'hard'].indexOf(d[1]) < 0) { say('[INFO] difficulty peaceful|easy|normal|hard'); return; } w.difficulty = d[1]; info('Difficulty set to ' + d[1] + '.'); return; }
            case 'xp': { let v = d[1] === 'add' ? d[2] : d[1]; if (v == null) { say('[INFO] xp [add] value[L]'); return; } v = /l$/.test(v) ? 100 * parseFloat(v) : parseFloat(v); if (isNaN(v)) { say('[INFO] xp [add] value[L]'); return; } w.experience = Math.max(0, Math.min(1e6, Math.floor((d[1] === 'add' ? (w.experience || 0) : 0) + v))); info('experience set to ' + w.experience + '.'); return; }
            case 'help': say('[INFO] tp give clear setblock fill clone summon kill heal gamemode gamerule home explode say time weather difficulty xp'); return;
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
    const BOX = { chest: 1, oven: 1, dispense: 1, dropper: 1 };
    // el aviso de abajo: "Doble clic para abrir el cofre" (en el celular, "Toca dos veces..."), según el bloque bajo el cursor
    function boxLabel(t) {
        const touch = document.body.classList.contains('is-touch');
        const what = t === 'oven' ? tr('play_box_furnace', 'the furnace') : t === 'dispense' ? tr('play_box_dispenser', 'the dispenser') : t === 'dropper' ? tr('play_box_dropper', 'the dropper') : tr('play_box_chest', 'the chest');
        return (touch ? tr('play_dbl_tap_open', 'Double-tap to open {what}') : tr('play_dbl_click_open', 'Double-click to open {what}')).replace('{what}', what);
    }
    function openBox(x, y) {
        const t = fg(x, y);
        let ok = false;
        if (t === 'chest' && typeof window.openChestEditor === 'function') ok = window.openChestEditor(x, y);
        else if (t === 'oven' && typeof window.openFurnaceEditor === 'function') ok = window.openFurnaceEditor(x, y);
        else if ((t === 'dispense' || t === 'dropper') && typeof window.openDispenserEditor === 'function') ok = window.openDispenserEditor(x, y);
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
        // (solo cuenta si de verdad se ve: una ventana abierta pero escondida dejaba al Player congelado)
        const shown = function (el) { return !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none'); };
        const m = document.getElementById('inventory-modal');
        if (m && m.style.display === 'block' && shown(m)) return true;
        const cb = document.getElementById('command-book-modal');
        return !!(cb && cb.style.display && cb.style.display !== 'none' && shown(cb));
    }

    // ------------------------------------------------------------------ paso del juego
    function step() {
        S.tick++;
        const w = W();
        intervals();
        deathCheck();
        if (modalOpen()) { S.keys = {}; S.mouse.left = S.mouse.right = S.mouse.leftEdge = S.mouse.rightEdge = false; S.mine = null; }
        if (!(w.dead > 0)) { mineAndPlace(); doPlayerLogic(); }
        // el botón "Open": el bloque bajo el cursor (si se abre y está a la mano) o, si no, el más cercano; se revisa 10 veces por segundo
        if (S.tick % 5 === 0) { const b = findBox(); const k = b ? b.x + ',' + b.y + ',' + b.t : ''; if (k !== (S.box ? S.box.x + ',' + S.box.y + ',' + S.box.t : '')) { S.box = b; hud.dirty = true; } }
        // arena / grava que hay que revisar
        if (S.sandCheck.size) {
            let n = 0;
            const due = [];
            S.sandCheck.forEach(function (t, k) { if (t <= S.tick && n < 400) { due.push(k); n++; } });
            due.forEach(function (k) { if (S.sandCheck.get(k) > S.tick) return; S.sandCheck.delete(k); const pp = k.split(','); checkSand(+pp[0], +pp[1]); });   // (si el de abajo acaba de caer, este espera 2 pasos más)
        }
        tickLiquids();
        tickFalling();
        tickDrops();
        tickOrbs();
        tickArrows();
        const px = w.worldX;
        // 🎮 en multijugador el anfitrión mueve también los mobs que están cerca de los otros jugadores; el invitado no los mueve: le llegan
        const pxs = [px];
        if (mpHost()) { const R = window.mbwMpPlay.remotes; for (const k in R) { const r = remoteOf(RP + k); if (r) pxs.push(r.tx); } }
        if (mpGuest()) { if (window.mbwMpPlay.mobLerp) window.mbwMpPlay.mobLerp(); }
        else for (const id in mbwom.mobs) {
            const m = mbwom.mobs[id];
            if (!m || !m.type) continue;
            const mx = Number(m.x);
            if (!pxs.some(function (q) { return Math.abs(mx - q) <= 40; })) continue;   // lejos: quieto (como el juego fuera de pantalla)
            try { mobTick(id, m); } catch (e) { if (!S.mobErr) { S.mobErr = true; console.warn('play mob', e); } }
        }
        if (S.msgT > 0) S.msgT--;
        tickSign();
        if (S.iname.t > 0) S.iname.t--;
        if (S.tick % 10 === 0) tickAmbience();
    }
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
        let n = 0;
        while (S.acc >= 1000 / FPS && n < 6) { try { step(); } catch (e) { console.error('play step', e); } S.acc -= 1000 / FPS; n++; }
        if (n >= 6) S.acc = 0;
        camFollow(.25);
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        hud.update();
    }

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
        if (S.p && S.p.hurt > 0 || w.dead > 0) { c2.fillStyle = w.dead > 0 ? 'rgba(140,0,0,.35)' : 'rgba(255,0,0,.12)'; c2.fillRect(0, 0, canvas.width, canvas.height); }
        c2.restore();
        if (S.p && S.p.hurt > 0) S.p.hurt--;
    }

    // ------------------------------------------------------------------ HUD (vida, comida, aire, hotbar, botones)
    const hud = {
        el: null, dirty: true,
        build: function () {
            const el = this.el = document.createElement('div');
            el.id = 'mbw-play-hud';
            el.innerHTML =
                '<div class="ph-top"><button type="button" class="ph-stop">■ <span></span></button><div class="ph-msg"></div></div>' +
                '<button type="button" class="ph-chat-btn">💬</button>' +
                '<div class="ph-bars"><div class="ph-hearts"></div><div class="ph-right"><div class="ph-air"></div><div class="ph-food"></div></div></div>' +
                '<div class="ph-xp"><div class="ph-xp-fill"></div><b class="ph-xp-lv"></b></div>' +
                '<div class="ph-iname"></div>' +
                '<div class="ph-hotbar"></div>' +
                '<div class="ph-sign"><div class="ph-sign-t"></div></div>' +
                '<button type="button" class="ph-inv">🎒</button>' +
                '<div class="ph-open" style="display:none"></div>' +
                '<div class="ph-joy"><div class="ph-knob"></div></div>' +
                '<div class="ph-pad2"><button type="button" data-k="down" class="ph-sneak">⇩</button><button type="button" data-k="up" class="ph-jump">⇧</button><button type="button" class="ph-mode">⛏</button></div>';
            document.body.appendChild(el);
            el.querySelector('.ph-stop').addEventListener('click', function (e) { e.stopPropagation(); stopPlay(); });
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
            el.querySelector('.ph-chat-btn').addEventListener('click', function (e) { e.stopPropagation(); if (chat.open) chat.close(); else chat.show(''); });
            const mb = el.querySelector('.ph-mode');
            mb.addEventListener('click', function (e) { e.stopPropagation(); S.touchMode = S.touchMode === 'mine' ? 'place' : 'mine'; hud.dirty = true; });
            el.querySelector('.ph-hotbar').addEventListener('click', function (e) {
                const s = e.target.closest('[data-i]'); if (!s) return;
                e.stopPropagation(); W().selectedInventoryItem = +s.getAttribute('data-i'); hud.dirty = true;
            });
            this.texts();
        },
        texts: function () { if (!this.el) return; chat.texts(); this.el.querySelector('.ph-chat-btn').title = tr('play_chat_tip', 'Chat / commands (T)'); this.el.querySelector('.ph-stop span').textContent = tr('play_stop', 'Stop'); this.el.querySelector('.ph-stop').title = tr('play_stop_tip', 'Stop playing (Esc): everything goes back to how it was'); },
        update: function () {
            if (!this.el) return;
            const w = W();
            const um = modalOpen();                                   // con el inventario / un cofre / un horno abierto, el HUD se esconde (no tapa la ventana)
            if (um !== this.underModal) { this.underModal = um; this.el.classList.toggle('under-modal', um); }
            const msg = this.el.querySelector('.ph-msg');
            const mtxt = S.msgT > 0 ? S.msg : '';
            if (msg.textContent !== mtxt) msg.textContent = mtxt;
            chat.render();
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
        destroy: function () { if (chat.open) chat.close(); chat.el = null; chat.input = null; if (this.el) this.el.remove(); this.el = null; }
    };
    function flashMsg(t) { S.msg = t; S.msgT = 2 * FPS; }
    // 💬 Chat / consola de comandos del mundo (T, Enter o / para abrirlo; en el celular, el botón 💬).
    // Se escribe un comando del juego (con o sin "/"): tp, give, gamemode, time, weather, clone, fill, summon... y Enter.
    // ↑ / ↓ recuerdan lo último que se escribió.
    // ⌨ Autocompletar: mientras se escribe salen sugerencias (el comando y lo que va en cada parte); Tab completa (otra vez Tab = la
    // siguiente); en el celular se toca la sugerencia.
    const CMDS = {
        tp: ['[~]x [~]y', 'Teleport'], give: ['item [amount] [damage]', 'Give an item'], clear: ['[item] [max]', 'Clear the inventory'],
        setblock: ['block [~]x [~]y [replace|keep|destroy]', 'Place a block'], fill: ['block [~]x [~]y width height', 'Fill an area'],
        clone: ['[~]x1 [~]y1 width height [~]xDest [~]yDest [move]', 'Copy an area'], summon: ['mob [quantity] [~]x [~]y', 'Spawn a mob'],
        kill: ['', 'Die'], heal: ['', 'Full health'], gamemode: ['survival|creative|adventure|spectator', 'Change game mode'],
        gamerule: ['rule true|false', 'Change a game rule'], home: ['[set]', 'Go to (or set) the spawn point'], explode: ['size [~]x [~]y', 'Explosion'],
        say: ['message', 'Write in the chat'], time: ['get|set <t|day|night>', 'Time of day'], weather: ['get|set <clear|rain|thunder>', 'Weather'],
        difficulty: ['peaceful|easy|normal|hard', 'Difficulty'], xp: ['[add] value[L]', 'Experience (L = levels)'], help: ['', 'List of commands'], cls: ['', 'Clear the chat']
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
            case 'tp': case 'clone': case 'explode': return (cmd === 'explode' ? i >= 2 : true) ? ['~'] : null;
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
    function quickCmds() {
        const l = ['/gamemode survival', '/gamemode creative', '/gamemode adventure', '/gamemode spectator', '/tp '];
        // 🎮 en una partida: /tp @nombre de cada jugador
        if (S.mp && window.mbwMpPlay) { const R = window.mbwMpPlay.remotes || {}; Object.keys(R).forEach(function (k) { if (R[k] && R[k].name) l.push('/tp @' + R[k].name); }); }
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
            this.el.classList.add('open'); this.input.value = prefix || ''; this.hi = -1; this.dirty = true; this.tabBase = null; this.tabN = 0; this.sug();
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
                // caja vacía: siempre a la mano los comandos de siempre (un toque los pone; los que no piden nada más se mandan con ➤)
                this.cur = null;
                box.innerHTML = '<div class="ph-sug-list ph-sug-quick">' + quickCmds().map(function (c) { return '<button type="button" data-q="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
                box.style.display = 'block';
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
                if (S.mp && t[0] !== '/' && t[0] !== '\\') {
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
            lines.forEach(function (l) {
                const d = document.createElement('div');
                d.textContent = l.t;
                if (!chat.open && now - l.at > 9000) d.className = 'fade';
                if (/^> /.test(l.t)) d.classList.add('me');
                log.appendChild(d);
            });
        }
    };
    window.mbwPlay.chat = chat;
    // 🕹️ Joystick (celular): un círculo; el punto del centro se arrastra con el dedo.
    // A los lados = caminar; hasta la orilla = correr; arriba = saltar (o subir volando); abajo = agacharse (o bajar volando).
    function joystick(base) {
        if (!base) return;
        const knob = base.querySelector('.ph-knob');
        let id = null, edge = 0;
        const set = function (dx, dy) {
            const d = Math.hypot(dx, dy), m = Math.min(1, d);
            const nx = d > 0 ? dx / d * m : 0, ny = d > 0 ? dy / d * m : 0;
            knob.style.transform = 'translate(' + (nx * 38) + 'px,' + (ny * 38) + 'px)';
            S.keys.left = nx < -0.3; S.keys.right = nx > 0.3;
            S.keys.up = ny < -0.6; S.keys.down = ny > 0.65;
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
        const end = function (e) { if (e.pointerId !== id) return; e.preventDefault(); e.stopPropagation(); id = null; edge = 0; set(0, 0); S.keys.left = S.keys.right = S.keys.up = S.keys.down = false; base.classList.remove('on', 'run'); };
        base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
        S.joyReset = function () { id = null; edge = 0; knob.style.transform = ''; base.classList.remove('on', 'run'); };
    }

    // ------------------------------------------------------------------ teclado / mouse / dedos (mientras se juega, el editor no los recibe)
    const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'down' };
    function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
    function toggleInv() {
        const m = document.getElementById('inventory-modal');
        if (m && m.style.display === 'block') { if (typeof toggleInventory === 'function') toggleInventory(); }
        else if (typeof window.togglePlayerInventory === 'function') { S.keys = {}; window.togglePlayerInventory(); }
        hud.dirty = true;
    }
    function onKeyDown(e) {
        if (!S.playing || typing(e)) return;
        if (modalOpen()) {                                           // con el inventario / un cofre abierto: las teclas son de la ventana
            if (e.code === 'KeyE' || e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeModals(); hud.dirty = true; }
            return;
        }
        if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stopPlay(); return; }
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
            S.placeDelay = 99;
            try { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); } catch (er) { /* nada */ }
        } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
            S.mouse.left = false; S.mouse.right = false;
            if (e.pointerType === 'touch') S.mouse.inside = false;
        }
    }
    function swallow(e) { if (S.playing && onCanvas(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }
    function onWheel(e) { if (!S.playing || !onCanvas(e)) return; e.preventDefault(); e.stopImmediatePropagation(); const w = W(); w.selectedInventoryItem = (selIndex() + (e.deltaY > 0 ? 1 : 8)) % 9; hud.dirty = true; }
    function onBlur() { S.keys = {}; S.mouse.left = S.mouse.right = false; }

    // ------------------------------------------------------------------ entrar / salir
    function syncScene() {
        const cur = (typeof mbwom.currentScene !== 'undefined') ? mbwom.currentScene : 1;
        mbwom.sceneList.forEach(function (k) { if (mbwom[k] !== undefined) mbwom.world[k + cur] = mbwom[k]; });
        return cur;
    }
    function startPlay() {
        if (S.playing) return;
        if (typeof mbwom === 'undefined' || !mbwom.world || !mbwom.scene) { alert(tr('play_no_world', 'Open or create a world first')); return; }
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
        try { snap = JSON.stringify(mbwom.world); } catch (e) { alert(tr('play_snap_err', 'Could not take the snapshot of the world, so Play mode did not start.')); return; }
        S.snapshot = snap; S.scene = cur;
        S.old = { tool: (typeof currentTool !== 'undefined') ? currentTool : null, smooth: window.smoothScroll, cam: { x: camera.x, y: camera.y }, scrollOffset: null };
        const w = mbwom.world;
        if (typeof mbwom.mobs !== 'object' || !mbwom.mobs) { mbwom.mobs = {}; w['mobs' + cur] = mbwom.mobs; }
        // el Player: el del mundo (su posición, inventario y vida). Si está en otra dimensión o no tiene posición, aparece en el centro de la pantalla.
        const sameScene = (w.scene || 1) === cur;
        let px = Number(w.worldX), py = Number(w.worldY);
        if (!sameScene || !isFinite(px) || !isFinite(py)) {
            const sp = mbwom.spawnPoint;
            if (sp && isFinite(Number(sp.x)) && isFinite(Number(sp.y)) && sameScene) { px = Number(sp.x); py = Number(sp.y); }
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
        S.p = newPlayer(); S.tmp = new Map(); S.drops = []; S.falling = []; S.arrows = []; S.orbs = []; S.liqFresh = new Set(); S.sandCheck = new Map(); S.dropSeq = 0; S.dropBase = Date.now().toString(36); S.lastPvp = null; S.tick = 0; S.acc = 0; S.last = 0; S.mine = null; S.useTimer = -1; S.keys = {}; S.mouse.left = S.mouse.right = false; S.mobErr = false;
        // arena y grava cerca: se revisan para que caigan si no tienen nada abajo
        const x0 = Math.max(0, Math.floor(px) - 60), x1 = Math.floor(px) + 60;
        for (let x = x0; x <= x1; x++) { const col = mbwom.scene[x]; if (!col) continue; for (let y = 0; y < col.length; y++) if (col[y] === 'sd' || col[y] === 'gv') S.sandCheck.set(x + ',' + y, 2); }
        S.playing = true; S.mp = mpMode; S.openBoxAt = null;
        window.mbwPlaying = true;
        document.body.classList.add('mbw-playing');
        // el bloque Barrier no se ve jugando: si el mundo tiene alguno, el dibujo del mundo se rehace sin ellos
        try { if ((mbwom.scene || []).some(function (c) { return c && c.indexOf('b') >= 0; }) && typeof initializeWorldCache === 'function') initializeWorldCache(); } catch (e) { /* nada */ }
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
            const d = A.defaults || { w: 18, h: 14 };
            A.startView(d.w, d.h);
        }
        try { if (typeof selectTool === 'function') selectTool('move'); } catch (e) { /* nada */ }
        try { if (typeof toggleMobInfo === 'function') toggleMobInfo(false); } catch (e) { /* nada */ }
        hud.build(); hud.dirty = true;
        camSnap();
        S.raf = requestAnimationFrame(frame);
        flashMsg(tr('play_started', '▶ Playing! Esc or ■ Stop to go back'));
        syncButton();
        if (S.mp && window.mbwMpPlay) { try { window.mbwMpPlay.afterStart(); } catch (e) { console.error('mp-play start', e); } }
    }
    // Vuelve a poner la foto del mundo (en el mismo objeto "world", así lo que lo tenga guardado sigue apuntando bien)
    function restoreSnapshot() {
        const w = mbwom.world;
        const fresh = JSON.parse(S.snapshot);
        Object.keys(w).forEach(function (k) { delete w[k]; });
        Object.assign(w, fresh);
        mbwom.loadScene(S.scene);
        mbwom.currentScene = S.scene;
    }
    function closeModals() {
        const m = document.getElementById('inventory-modal');
        if (m && m.style.display === 'block' && typeof toggleInventory === 'function') { try { toggleInventory(); } catch (e) { m.style.display = 'none'; } }
        ['sign-editor-modal', 'command-book-modal'].forEach(function (id) { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    }
    function stopPlay() {
        if (!S.playing) return;
        closeModals();                                              // (con el juego todavía activo: lo del cofre no entra al historial)
        const wasMp = S.mp;
        if (wasMp && window.mbwMpPlay) { try { window.mbwMpPlay.beforeStop(); } catch (e) { console.error('mp-play stop', e); } }
        S.mp = false; S.openBoxAt = null;
        S.playing = false;
        cancelAnimationFrame(S.raf);
        try { restoreSnapshot(); } catch (e) { console.error('play restore', e); alert('Error restoring the world: ' + e.message); }
        S.snapshot = null; S.drops = []; S.falling = []; S.arrows = []; S.orbs = []; S.tmp = new Map(); S.keys = {}; S.mine = null;
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
        if (wasMp && window.mbwMpPlay) { try { window.mbwMpPlay.afterStop(); } catch (e) { console.error('mp-play after stop', e); } }
    }
    window.mbwStartPlay = startPlay;
    window.mbwStopPlay = stopPlay;
    window.mbwTogglePlay = function () { if (S.playing) stopPlay(); else startPlay(); };

    // Mientras se juega, lo que se guarda / descarga / sube es la FOTO (el mundo de antes de jugar)
    function withSnapshot(fn, self, args) {
        if (!S.playing || !S.snapshot) return fn.apply(self, args);
        const liveWorld = mbwom.world;
        const cur = syncScene();
        const tmpW = JSON.parse(S.snapshot);
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
                if (!(S.mp && t.indexOf('juego_') === 0) && t !== 'chat' && t !== 'spectator_update') return;
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
        if (S.p && S.p.xScale < 0) c2.scale(-1, 1);
        if (S.p && S.p.hurt > 0) c2.globalAlpha = 0.85;
        c2.drawImage(frank, fr.f * 16, 0, 16, 22, -pw / 2, -ph, pw, ph);
        c2.globalAlpha = 1;
        try {
            const pArmor = window.mbwPlayerArmorMob && window.mbwPlayerArmorMob();
            if (pArmor && typeof drawMobArmorOverlay === 'function') drawMobArmorOverlay(c2, pArmor, -pw / 2, -ph, pw, ph);
        } catch (e) { /* nada */ }
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
        b.title = S.playing ? tr('play_stop_tip', 'Stop playing (Esc): everything goes back to how it was') : tr('play_btn_tip', 'Play the map to test it. When you stop, the blocks, mobs and Player go back to where they were.');
        const ic = b.querySelector('.pb-ic');
        if (ic) ic.textContent = S.playing ? '■' : '▶';
    }
    function init() {
        window.mbwPlay.flash = flashMsg;
        // 🎮 Etapa 2 (scripts/mp-play.js)
        window.mbwPlay.net = {
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
            setArrows: function (list) { S.arrows = (list || []).map(function (r) { return { x: r[0], y: r[1], vx: r[2], vy: r[3], age: 0, ghost: true }; }); },
            arrows: function () { return S.arrows; },
            forget: function (id) { S.tmp.delete(id); },
            heldId: function () { return selType(); },
            gm: function () { return W().gamemode; },
            say: function (t) { say(String(t)); chat.dirty = true; },
            flash: flashMsg,
            // objetos en el suelo
            dropIn: function (o) {
                if (!S.playing || !o || !o.nid || dropIdx(o.nid) >= 0) return;
                S.drops.push({ nid: String(o.nid), id: String(o.id), n: o.n | 0, dmg: o.dmg || 0, ex: o.ex || {}, x: Number(o.x), y: Number(o.y), vx: Number(o.vx) || 0, vy: Number(o.vy) || 0, age: o.age | 0 });
            },
            dropsPack: function () { return S.drops.filter(function (d) { return d.nid; }).map(packDrop); },
            // (anfitrión) un invitado quiere recogerlo: se lo lleva si todavía está
            dropGrant: function (nid, peerId) {
                const i = dropIdx(nid); if (i < 0 || !peerId) return;
                const d = S.drops[i]; S.drops.splice(i, 1);
                mpSend({ tipo: 'juego_tomado', nid: nid, n: 0, a: peerId, item: [d.id, d.n, d.dmg, d.ex] });
            },
            dropTaken: function (m) {
                if (!S.playing) return;
                const i = dropIdx(m.nid);
                if (i >= 0) { if (m.n > 0) { S.drops[i].n = m.n | 0; S.drops[i].pend = 0; } else S.drops.splice(i, 1); }
                // a mí me tocó: a mi inventario (si no cabe todo, lo que sobra se vuelve a tirar)
                if (m.a && window.mbwMpPlay && m.a === window.mbwMpPlay.myId() && Array.isArray(m.item)) {
                    const it = m.item, left = addToInventory(String(it[0]), it[1] | 0, it[2] || 0, it[3] || {});
                    if (left > 0) { const w = W(); addDrop(String(it[0]), w.worldX, w.worldY - .5, left, it[2] || 0, it[3] || {}); }
                    hud.dirty = true;
                }
            },
            // otro jugador me pegó
            pvp: function (dmg, kx, name) {
                const w = W(); if (!S.playing || w.dead > 0 || w.gamemode == 1 || w.gamemode == 3) return;
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
            if (S.playing && S.enteredFs && !(document.fullscreenElement || document.webkitFullscreenElement)) { S.enteredFs = false; stopPlay(); }
            else if (S.playing) { try { window.dispatchEvent(new Event('resize')); } catch (e) { /* nada */ } }
        }); });
        window.addEventListener('resize', function () { if (S.playing && window.mbwAspect && window.mbwAspect.refit) setTimeout(function () { window.mbwAspect.refit(); camSnap(); }, 0); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
