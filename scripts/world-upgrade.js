// ==========================================================
// 🕰 MUNDOS VIEJOS: se ponen al día como lo hace el juego (World.updateWorldVersion de Mine Blocks 1.31.2)
//
//  Los mundos de versiones anteriores guardaban las cosas distinto. Por ejemplo, hasta la 1.30.3 la posición del
//  jugador, los mobs, los objetos tirados, el spawn... se guardaban en PÍXELES (×30), así que el editor ponía la
//  cámara lejísimos del mapa y el mundo se veía vacío. El juego los convierte al abrirlos; aquí se hace lo mismo
//  (paso por paso, según la versión del mundo) antes de dibujarlo.
//
//  window.mbwUpgradeWorld(world) → { from, to, changed } (cambia el objeto del mundo directamente)
// ==========================================================
(function () {
    'use strict';
    const LATEST = '1.31.2';
    const SCENES = [0, 1, 2, 3];

    // (igual que World.versionToNumber: las 1.30.4 en adelante cuentan como "2.x")
    function vnum(v) {
        const b = String(v == null ? '' : v).split('.');
        while (b.length < 4) b.push('0');
        const p = (s) => { const n = parseInt(s, 10); return isNaN(n) ? 0 : n; };
        if (b[0] === '1' && (p(b[1]) > 30 || (p(b[1]) === 30 && p(b[2]) > 3))) b[0] = '2';
        let a = 0;
        for (let i = 0; i < b.length; i++) a += p(b[i]) * Math.pow(1000, b.length - i - 1);
        return a;
    }
    const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
    const keysOf = (o) => (o && typeof o === 'object') ? Object.keys(o) : [];
    const sp = (v) => (Number(v) || 0) / 2;                       // Game.migrateSpeed
    const item = (id, n, d, ex) => [id, n, d || 0, ex || {}];

    // ---------------------------------------------------- cambiar nombres de objetos / bloques (World.migrateItems)
    // regla: [de, a, tipo, dónde]  · tipo true = el resto del nombre es el color ("clothred" → cloth + red)
    //                               · tipo "texto" = ese color · tipo false = sin color
    //                               · dónde: "block" (solo el mapa), "item" (solo objetos), "both"
    function migrateItems(w, rules) {
        const match = (id, r) => typeof id === 'string' && id.substr(0, (r[2] === true ? r[0] : r[1]).length) === r[0];
        const fixItem = (it, idIdx, exIdx) => {
            if (!Array.isArray(it) || it[idIdx] == null) return;
            const id = String(it[idIdx]);
            for (const r of rules) {
                if (r[3] === 'block') continue;
                if (!match(id, r) || id === r[1]) continue;
                if (r[2] === true) { if (!isObj(it[exIdx])) it[exIdx] = {}; it[exIdx].type = id.substr(r[0].length); }
                else if (r[2] !== false) { if (!isObj(it[exIdx])) it[exIdx] = {}; it[exIdx].type = r[2]; }
                it[idIdx] = r[1];
                break;
            }
        };
        (Array.isArray(w.inventoryList) ? w.inventoryList : []).forEach((it) => fixItem(it, 0, 3));
        SCENES.forEach((f) => {
            const drops = w['drops' + f];
            keysOf(drops).forEach((k) => { const d = drops[k]; if (Array.isArray(d) && isNaN(parseFloat(String(d[2])))) fixItem(d, 2, 6); });
            if (typeof w['states' + f] === 'string') w['states' + f] = {};
            const sc = w['scene' + f], st = w['states' + f];
            if (Array.isArray(sc)) {
                for (let x = 0; x < sc.length; x++) {
                    const col = sc[x];
                    if (!Array.isArray(col)) continue;
                    for (let y = 0; y < col.length; y++) {
                        const t = col[y];
                        if (t == null) continue;
                        if (t === 'dispense' || t === 'dropper') {
                            const box = isObj(st) ? st['blockX' + x + 'Y' + y + '_2'] : null;
                            if (Array.isArray(box)) box.forEach((it) => fixItem(it, 0, 3));
                            continue;
                        }
                        if (!isNaN(parseFloat(t))) continue;
                        for (const r of rules) {
                            if (r[3] === 'item') continue;
                            if (!match(t, r) || !(t !== r[1] || r[0] === r[1])) continue;
                            if (r[2] === true || (r[2] !== false)) {
                                if (!isObj(w['states' + f])) w['states' + f] = {};
                                w['states' + f]['blockX' + x + 'Y' + y] = r[2] === true ? t.substr(r[0].length) : r[2];
                            }
                            col[y] = r[1];
                            break;
                        }
                    }
                }
            }
            const ch = w['chests' + f];
            keysOf(ch).forEach((k) => { if (Array.isArray(ch[k])) ch[k].forEach((it) => fixItem(it, 0, 3)); });
        });
        const ec = w.enderChests;
        keysOf(ec).forEach((k) => { if (Array.isArray(ec[k])) ec[k].forEach((it) => fixItem(it, 0, 3)); });
    }

    // ---------------------------------------------------- mobs guardados como lista (antes de la 1.29)
    function mobFromArray(l, playerId) {
        const M = {
            type: l[0], id: l[1], scene: l[2], name: null, variant: '', babyTimer: 0, breedTimer: 0, x: l[3], y: l[4],
            speedX: parseInt(String(l[5]), 10) || 0, speedY: parseInt(String(l[6]), 10) || 0, direction: 1, health: l[7],
            keys: { left: l[8], right: l[9], up: l[10] }, target: null, focus: null, riddenBy: null, riding: null, leash: null,
            inventory: [], handItems: [], armor: [], defaultDrops: true, handDropChances: [.085, .085], armorDropChances: [.085, .085, .085, .085],
            persists: false, air: 0, airTimer: 0, startUnderwaterTimer: 0, animationType: 'idle', animationFrame: 0, attackCooldown: 0, hitCooldown: 0,
            lastDamageType: '', lastDamageID: '', ticksSinceLastDamageID: 0, falling: false, wasFalling: false, wasFallingSpeed: 0, effects: {}
        };
        const tgt = (v) => { M.focus = v; M.target = v; };
        switch (M.type) {
            case 'chicken': M.target = l[11]; M.name = l[12]; if (l[13] == 1) { M.armor[0] = item('ShadesCap', 1, 0); M.armorDropChances[0] = 1; } break;
            case 'cow': if (l[10] == 1) M.variant = 'mooshroom'; tgt(l[11]); M.name = l[12]; break;
            case 'creeper': M.charged = false; M.fuse = l[11]; tgt(l[12]); M.name = l[13]; break;
            case 'dummy': M.type = 'spawnskin'; tgt(l[11]); M.skin = l[12]; M.name = l[13]; break;
            case 'enderdragon': tgt(l[11]); M.nextSpotX = l[12]; M.nextSpotY = l[13]; M.official = l[14]; M.endTimer = l[15]; M.endingX = l[16]; M.endingY = l[17]; M.name = l[18]; M.flyBob = 0; M.flameBallThread = 0; M.flameBallDelay = 0; break;
            case 'enderman': tgt(l[11]); if (l[12] == 1) M.handItems[0] = [l[12], 1, 0, {}]; M.name = l[14]; M.teleportDistance = 10; break;
            case 'magmacube': case 'slime': tgt(l[11]); M.size = Math.log(l[12] / 15) / Math.log(2) + 1; M.name = l[13]; break;
            case 'netherwalker': M.type = 'nethereye'; tgt(l[11]); M.name = l[12]; break;
            case 'pig': if (l[11] == 1) M.saddleItem = ['saddle', 1, 0, {}]; M.riddenBy = l[12]; tgt(l[13]); M.name = l[14]; break;
            case 'rabbit': tgt(l[11]); M.rabbitType = l[12]; M.name = l[13]; break;
            case 'sheep': M.color = l[11]; M.sheared = l[12]; M.eating = false; tgt(l[13]); M.name = l[14]; break;
            case 'skeleton': M.handItems[0] = item('bow', 1, Math.floor(50 * Math.random() + 10)); tgt(l[11]); M.name = l[12]; break;
            case 'blaze': case 'ghast': case 'snowgolem': case 'spider': case 'zombie': tgt(l[11]); M.name = l[12]; break;
            case 'squid': tgt(l[11]); M.name = l[12]; M.actualRotation = l[13]; M.rotationDirection = l[14]; M.cooldownSpeed = l[15]; M.actualSpeed = l[16]; M.movementCooldown = l[17]; M.rotationSpeed = l[18]; break;
            case 'wolf': tgt(l[11]); M.tameable = true; M.tamed = l[12] == 1; M.tamedBy = M.tamed ? playerId : null; M.sitting = l[13]; M.name = l[14]; M.collarColor = l[15]; break;
            case 'zombiepigman': tgt(l[11]); M.name = l[12]; if (l[13] == 1) M.handItems[0] = [l[13], 1, 0, {}]; M.aggressiveness = l[14]; break;
        }
        return M;
    }

    // ---------------------------------------------------- ponerse al día
    function upgrade(w) {
        if (!isObj(w)) return { changed: false };
        const from = typeof w.worldVer === 'string' ? w.worldVer : '';
        const v = vnum(from);
        if (from && v >= vnum(LATEST)) return { from: from, to: from, changed: false };
        if (!from) return { from: '', to: '', changed: false };   // (sin versión: no se sabe de cuándo es; lo revisa el validador)
        const playerId = (w.fileInfo && w.fileInfo.author) || 'player';

        if (v < vnum('1.27')) {
            const a = w.achieve;
            if (typeof a === 'number' && (a | 0) === a) {
                const T = { 1: [1], 2: [1, 0, 1], 3: [1, 0, 1, 1], 4: [1, 1, 1, 1], 5: [1, 1, 1, 1, 1], 6: [1, 1, 1, 1, 1, 0, 0, 0, 0, 1], 7: [1, 1, 1, 1, 1, 1, 0, 0, 0, 1],
                    8: [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9: [1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1] };
                const base = [1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1].concat(new Array(20).fill(0));
                w.achieve = T[a] || (a <= 11 ? base.concat([1]) : a === 12 ? base.concat([1, 1]) : a <= 15 ? base.slice(0, 34).concat([1, 1, 1]) : a === 16 ? base.slice(0, 34).concat([1, 1, 1, 1, 1]) : a === 17 ? base.slice(0, 34).concat([1, 1, 1, 1, 1, 1]) : [0]);
            }
            if (w.keepInventory != null) { if (!isObj(w.gameRules)) w.gameRules = {}; w.gameRules.keepinventory = w.keepInventory; w.gameRules.dodaylightcycle = w.doDaylightCycle; w.gameRules.dofiretick = w.doFireTick; }
            if (w.firstTimes1 == null && w.firstTimes != null) { w.firstTimes1 = w.firstTimes; delete w.firstTimes; }
            SCENES.forEach((f) => { const d = w['drops' + f]; keysOf(d).forEach((k) => { if (Array.isArray(d[k]) && !isNaN(parseInt(d[k][2], 10))) delete d[k]; }); });
        }
        if (v < vnum('1.28')) {
            migrateItems(w, [['cloth', 'cloth', true, 'both'], ['dye', 'dye', true, 'item']]);
            SCENES.forEach((f) => {
                const sm = w['toSmelt' + f];
                keysOf(sm).forEach((k) => { const a = sm[k]; if (!Array.isArray(a)) return; sm[k] = { input: item(a[0], a[1], 0), fuel: item(a[2], a[3], 0), smeltTimer: a[4], fuelTimer: a[4], fuelTimerTotal: a[8], output: item(a[5], a[6], 0) }; });
                const conv = (name, fn) => { const o = w[name + f]; keysOf(o).forEach((k) => { if (Array.isArray(o[k])) o[k] = fn(o[k]); }); };
                conv('spears', (m) => ({ x: m[1], y: m[2], speedX: m[4], speedY: m[5], rotation: (m[3] + 90) / 180 * Math.PI, shotBy: m[7], timer: 0 }));
                conv('arrows', (a) => ({ x: a[1], y: a[2], speedX: a[3], speedY: a[4], rotation: (a[5] + 90) / 180 * Math.PI, shotBy: a[7], punch: a[8], power: a[9], flame: a[10], infinity: a[11] }));
                conv('shurikens', (m) => ({ x: m[1], y: m[2], speedX: m[3], speedY: m[4], rotation: 0, shotBy: m[6], type: 'bone', timer: 0 }));
                conv('fireballs', (m) => ({ x: m[1], y: m[2], speedX: m[3], speedY: m[4], shotBy: m[5] }));
            });
        }
        if (v < vnum('1.29')) {
            SCENES.forEach((f) => { const ms = w['mobs' + f]; keysOf(ms).forEach((k) => { if (Array.isArray(ms[k])) ms[k] = mobFromArray(ms[k], playerId); }); });
            if (isObj(w.chests1) && w.chests1.ender != null) { w.enderChests = {}; w.enderChests[playerId] = w.chests1.ender; delete w.chests1.ender; }
            if (w.worldX != null) w.worldX = 275 - w.worldX;
            if (w.worldY != null) w.worldY = 200 - w.worldY;
            SCENES.forEach((f) => {
                const s = w['spawnPoint' + f]; if (Array.isArray(s)) w['spawnPoint' + f] = [275 - s[0], 200 - s[1]];
                const c = w['carts' + f];
                if (c != null) {
                    const out = {};
                    keysOf(c).forEach((k) => { const m = c[k]; if (Array.isArray(m)) out['cart' + m[0]] = { id: 'cart' + m[0], x: m[1], y: m[2], speedX: m[3], speedY: m[4], riddenBy: m[5], onActivator: m[6], type: m[7], health: 3, tilt: 0, onRail: 0 }; });
                    w['carts' + f] = out;
                }
            });
            if (Array.isArray(w.portalCoords) && w.portalCoords.length >= 2) w.portalCoords = [275 - w.portalCoords[0], 200 - w.portalCoords[1]];
            migrateItems(w, [['bed', 'bed', 'red', 'item'], ['bed1', 'bed1', 'red', 'block'], ['bed2', 'bed2', 'red', 'block']]);
            w.gamemode = w.creative == 1 ? 1 : 0;
            w.spawnskinNum = w.dummyNum;
        }
        if (v < vnum('1.29.1')) {
            SCENES.forEach((f) => { const ms = w['mobs' + f]; keysOf(ms).forEach((k) => { const M = ms[k]; if (isObj(M) && M.type === 'chicken' && Array.isArray(M.handItems) && M.handItems[0] && M.handItems[0][0] === 'ShadesCap') { M.armor = Array.isArray(M.armor) ? M.armor : []; M.armor[0] = item('ShadesCap', 1, 0); M.armorDropChances = Array.isArray(M.armorDropChances) ? M.armorDropChances : [.085, .085, .085, .085]; M.armorDropChances[0] = 1; M.handItems.splice(0, 1); } }); });
        }
        if (v < vnum('1.30')) {
            const flam = (t) => { try { const B = window.MB_PLAY_DATA && window.MB_PLAY_DATA.blocks; return !!(B && B[t] && B[t].flammable); } catch (e) { return false; } };
            SCENES.forEach((f) => {
                const of = w['onFire' + f]; if (!isObj(of)) return;
                Object.keys(of).forEach((k) => {
                    const m = /^blockX(-?\d+)Y(-?\d+)$/.exec(k); if (!m) return;
                    const x = +m[1], y = +m[2], sc = w['scene' + f];
                    if (Array.isArray(sc) && Array.isArray(sc[x]) && sc[x][y] != null && flam(sc[x][y])) sc[x][y] = 'fire';
                    delete of[k];
                });
            });
        }
        if (v < vnum('2.0')) {                                         // (hasta la 1.30.3) de píxeles a bloques
            SCENES.forEach((f) => {
                const bl = w['balloons' + f];
                keysOf(bl).forEach((k) => { const o = bl[k]; if (!isObj(o)) return; ['x', 'y', 'stringX', 'stringY'].forEach((q) => { if (o[q] != null) o[q] = o[q] / 30; }); ['speedX', 'speedY', 'stringSpeedX', 'stringSpeedY'].forEach((q) => { if (o[q] != null) o[q] = sp(o[q]); }); });
                const dr = w['drops' + f];
                keysOf(dr).forEach((k) => { const d = dr[k]; if (Array.isArray(d)) { d[0] = d[0] / 30; d[1] = d[1] / 30; } });
                const xo = w['xpOrbs' + f];
                if (!Array.isArray(xo)) keysOf(xo).forEach((k) => { const o = xo[k]; if (Array.isArray(o)) { o[1] = o[1] / 30; o[2] = o[2] / 30; } });
                const fb = w['fallingBlocks' + f];
                keysOf(fb).forEach((k) => { const o = fb[k]; if (Array.isArray(o)) { o[2] = o[2] / 30; o[3] = o[3] / 30; } });
                const s = w['spawnPoint' + f]; if (Array.isArray(s)) w['spawnPoint' + f] = [s[0] / 30, s[1] / 30];
                const rf = w['rafts' + f];
                keysOf(rf).forEach((k) => { const o = rf[k]; if (Array.isArray(o)) { o[1] = o[1] / 30; o[2] = o[2] / 30; o[3] = sp(o[3]); o[4] = sp(o[4]); } });
                const fl = w['flameballs' + f];
                keysOf(fl).forEach((k) => { const a = fl[k]; if (!Array.isArray(a)) return; const by = String(a[5]); fl[k] = { x: a[1] / 30, y: a[2] / 30, speedX: sp(a[3]), speedY: sp(a[4]), shotBy: by.substr(0, 3) === 'new' ? by.substr(3) : a[5] }; });
                ['arrows', 'spears', 'shurikens', 'splashPotions', 'carts', 'mobs'].forEach((name) => {
                    const o = w[name + f];
                    keysOf(o).forEach((k) => { const m = o[k]; if (!isObj(m)) return; m.x = (Number(m.x) || 0) / 30; m.y = (Number(m.y) || 0) / 30; m.speedX = sp(m.speedX); m.speedY = sp(m.speedY); });
                });
            });
            if (Array.isArray(w.portalCoords) && w.portalCoords.length >= 2) w.portalCoords = [w.portalCoords[0] / 30, w.portalCoords[1] / 30];
            if (w.worldX != null) w.worldX = w.worldX / 30;
            if (w.worldY != null) w.worldY = w.worldY / 30;
        }
        if (v < vnum('1.30.4')) migrateItems(w, [['cl', 'clore', false, 'block'], ['dm', 'dmore', false, 'block'], ['cy', 'cy1', false, 'block']]);
        w.worldVer = LATEST;
        if (isObj(w.fileInfo)) w.fileInfo.version = LATEST;
        return { from: from, to: LATEST, changed: true };
    }

    window.mbwUpgradeWorld = upgrade;
    window.mbwVersionNumber = vnum;
})();
