// ==========================================================
// 🩺 REVISAR Y REPARAR MUNDOS con las reglas del juego original (scripts/game-data.js)
//  · mbwCheckWorld(world, { repair: true/false, safeOnly: true/false }) -> { issues: [...], fixed: n }
//  · Al GUARDAR se reparan solas las cosas seguras (no cambian cómo se ve el mundo):
//      versión del mundo, bloques guardados con nombre de variante ("dt_1"), nombres viejos del editor,
//      datos sueltos de bloques que ya no existen, cofres / inventario incompletos, reglas mal escritas...
//  · Lo que sí cambiaría algo (bloques, objetos o mobs que el juego no conoce) solo se avisa en la ventana
//    "Revisar mundo" (World Info), y ahí se puede reparar con un botón.
// ==========================================================
(function () {
    'use strict';
    const G = () => window.MB_GAME;
    function t(k, fb) { try { const v = (typeof window.t === 'function') ? window.t(k) : null; return (v && v !== k) ? v : fb; } catch (e) { return fb; } }

    // nombres que usaba el editor y que el juego llama de otra forma
    const ALIAS = { frodcarrot: 'coas', bsed: 'bseed', Scepter: 'scepter' };
    // firstTimes: el juego guarda "true" (casi siempre en agua / lava / ácido, que todavía se van a mover) y "false".
    //   "false" es lo mismo que no tener nada (hay miles de bloques iguales con false y sin dato), así que los false se quitan:
    //   en mundos grandes eran ¼ del archivo. Los "true" NO se tocan.
    const BLOCK_DATA = ['states', 'chests', 'toSmelt', 'water', 'wheat', 'toBrew', 'signs', 'hasSignal', 'toGrow'];
    const CROPS = ['wseed', 'pseed', 'seed', 'carrot', 'potato', 'nw', 'bseed'];
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    const SAFE = { ver: 1, sceneNum: 1, variantId: 1, alias: 1, nullData: 1, orphan: 1, ftFalse: 1, chestPad: 1, chestBadSlot: 1, invPad: 1, stack: 1, rules: 1, crop: 1, achieve: 1, signType: 1, numbers: 1 };

    function known(id) { return typeof id === 'string' && G().has(id); }
    // "dt_1" -> { base: 'dt', v: 1 }
    function splitVariant(id) {
        if (typeof id !== 'string') return null;
        const i = id.indexOf('_'); if (i <= 0) return null;
        const base = id.slice(0, i), rest = id.slice(i + 1);
        if (!known(base) || rest === '') return null;
        return { base: base, v: /^\d+$/.test(rest) ? parseInt(rest, 10) : rest };
    }
    function emptyItem() { return ['air', 0, 0, {}]; }
    function isEmptyItem(it) { return it == null || !Array.isArray(it) || it[0] == null || it[0] === '' || it[0] === 'air' || it[0] === 'na' || !(Number(it[1]) > 0); }

    function check(world, opts) {
        opts = opts || {};
        const repair = !!opts.repair, safeOnly = !!opts.safeOnly;
        const issues = {};
        let fixed = 0;
        function add(code, sev, sample, canFix) {
            const it = issues[code] || (issues[code] = { code: code, sev: sev, count: 0, samples: [], fixable: !!canFix });
            it.count++;
            if (it.samples.length < 6 && sample !== undefined) it.samples.push(sample);
            const doFix = repair && canFix && (!safeOnly || SAFE[code]);
            if (doFix) { fixed++; it.fixed = (it.fixed || 0) + 1; }
            return doFix;
        }
        if (!world || typeof world !== 'object') return { issues: [], fixed: 0 };
        const g = G();
        if (!g) return { issues: [], fixed: 0 };

        // ---- versión del mundo: sin ella el juego cree que es un mundo MUY viejo y lo "actualiza" (y lo puede romper)
        if (typeof world.worldVer !== 'string' || !world.worldVer) { if (add('ver', 'error', String(world.worldVer), true)) world.worldVer = g.version; }
        if ([1, 2, 3].indexOf(Number(world.sceneNum)) < 0 && world.sceneNum !== undefined) { if (add('sceneNum', 'warn', String(world.sceneNum), true)) world.sceneNum = 1; }
        ['worldX', 'worldY', 'health', 'food', 'experience'].forEach(function (k) {
            if (world[k] !== undefined && world[k] !== null && !isFinite(Number(world[k]))) { if (add('numbers', 'warn', k + ' = ' + world[k], true)) world[k] = 0; }
            else if (typeof world[k] === 'string' && world[k] !== '' && isFinite(Number(world[k]))) { if (add('numbers', 'info', k, true)) world[k] = Number(world[k]); }
        });

        // ---- bloques de cada dimensión
        for (let s = 1; s <= 3; s++) {
            const scene = world['scene' + s];
            if (!Array.isArray(scene)) continue;
            const states = isObj(world['states' + s]) ? world['states' + s] : (world['states' + s] = {});
            // (opts.skipBlocks: al guardar seguido sin haber cambiado ningún bloque, no hace falta revisar los miles de bloques otra vez)
            if (!opts.skipBlocks) for (let x = 0; x < scene.length; x++) {
                const col = scene[x];
                if (!Array.isArray(col)) { if (col != null && add('badColumn', 'error', 'x=' + x, true)) scene[x] = []; continue; }
                for (let y = 0; y < col.length; y++) {
                    const id = col[y];
                    if (id == null || id === '' || id === 'air' || id === 0 || id === '0') continue;
                    if (typeof id === 'string' && known(id)) continue;
                    const key = 'blockX' + x + 'Y' + y;
                    if (typeof id === 'string' && ALIAS[id]) { if (add('alias', 'warn', id + ' → ' + ALIAS[id], true)) col[y] = ALIAS[id]; continue; }
                    const sv = splitVariant(id);
                    if (sv) {
                        if (add('variantId', 'error', id + ' (' + x + ', ' + y + ')', true)) {
                            col[y] = sv.base;
                            if (states[key] === undefined || states[key] === null || states[key] === '') states[key] = sv.v;
                        }
                        continue;
                    }
                    if (add('unknownBlock', 'error', String(id) + ' (' + x + ', ' + y + ')', true)) col[y] = null;
                }
            }
            // datos sueltos: datos de un bloque que ya no está (pasaba al borrar con el editor)
            BLOCK_DATA.forEach(function (k) {
                const d = world[k + s];
                if (!isObj(d)) return;
                for (const key in d) {
                    if (d[key] === null) { if (add('nullData', 'info', k + ' ' + key, true)) delete d[key]; continue; }
                    const m = /^blockX(\d+)Y(\d+)(?:_[23])?$/.exec(key);
                    if (!m) continue;
                    const bx = +m[1], by = +m[2];
                    const here = scene[bx] && scene[bx][by];
                    if (here == null || here === '' || here === 'air') { if (add('orphan', 'info', k + ' ' + key, true)) delete d[key]; }
                }
            });
            // 🧹 marcas de "primera vez" en false (= lo mismo que no tenerlas)
            const ft = world['firstTimes' + s];
            if (isObj(ft)) {
                const off = Object.keys(ft).filter(function (key) { return ft[key] === false || ft[key] === null; });
                if (off.length) {
                    const doFix = add('ftFalse', 'info', off.length + ' (dim ' + s + ')', true);
                    issues.ftFalse.count += off.length - 1;
                    if (doFix) off.forEach(function (key) { delete ft[key]; });
                }
            }
            // cofres: 27 casillas, objetos que existan
            const chests = world['chests' + s];
            if (isObj(chests)) for (const key in chests) checkContainer(chests, key, g.chestSlots, 'chest ' + key);
            // letreros: texto
            const signs = world['signs' + s];
            if (isObj(signs)) for (const key in signs) if (signs[key] != null && typeof signs[key] !== 'string') { if (add('signType', 'warn', key, true)) signs[key] = String(signs[key]); }
            // cultivos: crecimiento 1 a 7
            const wheat = world['wheat' + s];
            if (isObj(wheat)) for (const key in wheat) {
                const m = /^blockX(\d+)Y(\d+)$/.exec(key); if (!m) continue;
                const type = scene[+m[1]] && scene[+m[1]][+m[2]];
                if (CROPS.indexOf(type) < 0) continue;
                const v = Number(wheat[key]);
                if (!(v >= 1 && v <= 7) || v !== Math.floor(v)) { if (add('crop', 'warn', key + ' = ' + wheat[key], true)) wheat[key] = Math.max(1, Math.min(7, Math.round(v) || 1)); }
            }
            // mobs que el juego no conoce
            const mobs = world['mobs' + s];
            if (isObj(mobs)) for (const key in mobs) {
                const mob = mobs[key];
                if (!isObj(mob)) { if (add('badMob', 'error', key, true)) delete mobs[key]; continue; }
                const type = mob.type;
                if (typeof type === 'string' && type.indexOf('custom_') === 0) continue;
                if (!g.mobs[type]) { if (add('unknownMob', 'warn', key + ': ' + type, true)) delete mobs[key]; continue; }
                if (!isFinite(Number(mob.x)) || !isFinite(Number(mob.y))) { if (add('numbers', 'warn', key + ' x/y', true)) { mob.x = Number(mob.x) || 0; mob.y = Number(mob.y) || 0; } }
            }
        }
        if (isObj(world.enderChests)) for (const key in world.enderChests) checkContainer(world.enderChests, key, g.chestSlots, 'ender chest ' + key);

        // ---- inventario del jugador (45) y armadura (4)
        if (Array.isArray(world.inventoryList)) {
            const inv = world.inventoryList;
            if (inv.length < g.inventorySlots) { if (add('invPad', 'warn', inv.length + ' / ' + g.inventorySlots, true)) while (inv.length < g.inventorySlots) inv.push(emptyItem()); }
            for (let i = 0; i < inv.length; i++) checkItem(inv, i, 'inventory #' + (i + 1));
        }
        if (Array.isArray(world.armors)) {
            const ar = world.armors;
            if (ar.length < g.armorSlots) { if (add('invPad', 'warn', 'armor ' + ar.length + ' / 4', true)) while (ar.length < g.armorSlots) ar.push(['air', 0, {}]); }
            for (let i = 0; i < ar.length; i++) {
                const it = ar[i];
                if (!Array.isArray(it) || isEmptyItem(it)) continue;
                if (!known(it[0]) && !ALIAS[it[0]]) { if (add('unknownItem', 'warn', 'armor: ' + it[0], true)) ar[i] = ['air', 0, {}]; }
                else if (ALIAS[it[0]]) { if (add('alias', 'warn', it[0] + ' → ' + ALIAS[it[0]], true)) it[0] = ALIAS[it[0]]; }
            }
        }

        // ---- reglas del juego: verdadero / falso
        if (world.gameRules !== undefined && world.gameRules !== null && !isObj(world.gameRules)) { if (add('rules', 'error', typeof world.gameRules, true)) world.gameRules = {}; }
        if (isObj(world.gameRules)) for (const k in world.gameRules) {
            const v = world.gameRules[k];
            if (typeof v === 'boolean') continue;
            const b = (v === 1 || v === '1' || String(v).toLowerCase() === 'true');
            if (add('rules', 'warn', k + ' = ' + v, true)) world.gameRules[k] = b;
        }
        // ---- logros: lista de 1 / vacío, máximo 46
        if (world.achieve !== undefined && world.achieve !== null) {
            if (!Array.isArray(world.achieve)) { if (typeof world.achieve !== 'number' && add('achieve', 'warn', typeof world.achieve, true)) world.achieve = []; }
            else if (world.achieve.length > g.achievements) { if (add('achieve', 'info', world.achieve.length + ' / ' + g.achievements, true)) world.achieve.length = g.achievements; }
        }

        function checkContainer(map, key, size, label) {
            const c = map[key];
            if (c === null || c === undefined) return;                     // (ya se quitó arriba si era un dato vacío)
            if (!Array.isArray(c)) { if (add('chestBadSlot', 'error', label, true)) map[key] = Array.from({ length: size }, emptyItem); return; }
            if (c.length < size) { if (add('chestPad', 'warn', label + ' (' + c.length + ' / ' + size + ')', true)) while (c.length < size) c.push(emptyItem()); }
            for (let i = 0; i < c.length; i++) checkItem(c, i, label + ' #' + (i + 1));
        }
        function checkItem(arr, i, label) {
            const it = arr[i];
            if (!it) return;                 // null, 0, "": el juego también deja casillas vacías así
            if (!Array.isArray(it)) { if (add('chestBadSlot', 'error', label, true)) arr[i] = emptyItem(); return; }
            if (isEmptyItem(it)) return;
            let id = it[0];
            if (ALIAS[id]) { if (add('alias', 'warn', id + ' → ' + ALIAS[id], true)) { it[0] = ALIAS[id]; id = it[0]; } }
            if (!known(id)) { if (add('unknownItem', 'warn', label + ': ' + id, true)) arr[i] = emptyItem(); return; }
            const n = Number(it[1]);
            const max = g.flag(id, 'unstackable') ? 1 : g.maxStack;
            if (n > max || n !== Math.floor(n)) { if (add('stack', 'warn', label + ': ' + id + ' × ' + it[1], true)) it[1] = Math.max(1, Math.min(max, Math.floor(n) || 1)); }
        }

        const order = { error: 0, warn: 1, info: 2 };
        const list = Object.keys(issues).map(k => issues[k]).sort((a, b) => order[a.sev] - order[b.sev] || b.count - a.count);
        return { issues: list, fixed: fixed };
    }
    window.mbwCheckWorld = check;
    window.mbwWorldAliases = ALIAS;

    // ---------- ventana "Revisar mundo" ----------
    const TEXT = {
        ver: ['val_ver', 'The world has no version: the game would think it is very old and "update" it (and could break it).'],
        sceneNum: ['val_scenenum', 'The saved dimension is not valid.'],
        variantId: ['val_variant', 'Blocks saved with the name of a variant (for example "dt_1"): the game does not know them.'],
        alias: ['val_alias', 'Old editor names that the game calls differently.'],
        unknownBlock: ['val_unknown_block', 'Blocks that do not exist in the game.'],
        badColumn: ['val_bad_column', 'Broken columns of blocks.'],
        orphan: ['val_orphan', 'Leftover data of blocks that are not there any more (chests, signs, variants...).'],
        nullData: ['val_null_data', 'Empty block data (it came from an old multiplayer bug).'],
        ftFalse: ['val_ft_false', '"First time" marks that say "no" (they are the same as having nothing: they only make the file heavier).'],
        chestPad: ['val_chest_pad', 'Chests with fewer than 27 slots.'],
        chestBadSlot: ['val_chest_bad', 'Broken chest slots.'],
        unknownItem: ['val_unknown_item', 'Items that do not exist in the game (in chests or in the inventory).'],
        stack: ['val_stack', 'Stacks bigger than the game allows (64, or 1 for tools and armor).'],
        invPad: ['val_inv_pad', 'Incomplete player inventory.'],
        rules: ['val_rules', 'Game rules that are not true / false.'],
        achieve: ['val_achieve', 'Badly saved achievements.'],
        crop: ['val_crop', 'Crops with a growth outside 1–7.'],
        signType: ['val_sign', 'Signs whose text is not text.'],
        unknownMob: ['val_unknown_mob', 'Mobs that do not exist in the game (the game ignores them).'],
        badMob: ['val_bad_mob', 'Broken mobs.'],
        numbers: ['val_numbers', 'Numbers saved as text or not valid.']
    };
    function liveWorld() {
        if (typeof mbwom === 'undefined' || !mbwom.world) return null;
        const cur = mbwom.currentScene || 1;
        (mbwom.sceneList || []).forEach(k => { if (mbwom[k] !== undefined) mbwom.world[k + cur] = mbwom[k]; });
        return mbwom.world;
    }
    function afterRepair() {
        if (typeof mbwom !== 'undefined' && typeof mbwom.loadScene === 'function') {
            const cur = mbwom.currentScene || 1;
            mbwom.loadScene(cur); mbwom.currentScene = cur;
        }
        if (typeof initializeWorldCache === 'function') initializeWorldCache();
        try { worldDirty = true; } catch (e) { window.worldDirty = true; }
        if (typeof window.mbwMarkUnsaved === 'function') window.mbwMarkUnsaved();
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
    window.openWorldCheck = function () {
        const w = liveWorld();
        let m = document.getElementById('mbw-check-modal');
        if (!m) {
            m = document.createElement('div');
            m.id = 'mbw-check-modal';
            m.className = 'mbw-check-modal';
            document.body.appendChild(m);
            m.addEventListener('click', e => { if (e.target === m) m.remove(); });
        }
        if (!w) { m.innerHTML = '<div class="mcm-box"><p>' + esc(t('val_no_world', 'Open a world first.')) + '</p><button class="mcm-close">OK</button></div>'; m.querySelector('.mcm-close').onclick = () => m.remove(); return; }
        const res = check(w, { repair: false });
        let html = '<div class="mcm-box"><div class="mcm-head"><h3>🩺 ' + esc(t('val_title', 'Check world')) + '</h3><span class="mcm-x">×</span></div>';
        html += '<p class="mcm-sub">' + esc(t('val_sub', 'Checked with the rules of the original game (Mine Blocks 1.31.2).')) + '</p>';
        if (!res.issues.length) html += '<div class="mcm-ok">✅ ' + esc(t('val_all_ok', 'Everything is fine: the game can open this world without problems.')) + '</div>';
        else {
            html += '<ul class="mcm-list">';
            res.issues.forEach(function (it) {
                const tx = TEXT[it.code] || [it.code, it.code];
                html += '<li class="sev-' + it.sev + '"><b>' + (it.sev === 'error' ? '⛔' : it.sev === 'warn' ? '⚠️' : 'ℹ️') + ' ' + esc(t(tx[0], tx[1])) + '</b> <span class="mcm-n">× ' + it.count + '</span>' +
                    (it.samples.length ? '<div class="mcm-sample">' + it.samples.map(esc).join(' · ') + (it.count > it.samples.length ? ' …' : '') + '</div>' : '') + '</li>';
            });
            html += '</ul>';
        }
        html += '<div class="mcm-actions">' + (res.issues.length ? '<button class="mcm-fix">🔧 ' + esc(t('val_fix_all', 'Repair all')) + '</button>' : '') + '<button class="mcm-close">' + esc(t('val_close', 'Close')) + '</button></div></div>';
        m.innerHTML = html;
        m.querySelector('.mcm-x').onclick = () => m.remove();
        m.querySelector('.mcm-close').onclick = () => m.remove();
        const fx = m.querySelector('.mcm-fix');
        if (fx) fx.onclick = function () {
            if (typeof isMultiplayer !== 'undefined' && isMultiplayer) { alert(t('val_no_mp', 'You cannot repair the world while you are on a server.')); return; }
            const r = check(liveWorld(), { repair: true });
            afterRepair();
            m.remove();
            alert('🔧 ' + t('val_fixed_n', 'Repaired: {n}').replace('{n}', r.fixed));
        };
    };
})();

// Aviso chiquito al abrir un mundo que tiene cosas que el juego no conoce (y que no se arreglan solas)
(function () {
    'use strict';
    function t(k, fb) { try { const v = (typeof window.t === 'function') ? window.t(k) : null; return (v && v !== k) ? v : fb; } catch (e) { return fb; } }
    const LOUD = { unknownBlock: 1, unknownItem: 1, unknownMob: 1, badMob: 1, badColumn: 1, chestBadSlot: 1 };
    window.mbwWorldCheckNotice = function (chk) {
        const left = (chk && chk.issues || []).filter(i => LOUD[i.code] && !(i.fixed >= i.count));
        const old = document.getElementById('mbw-check-toast'); if (old) old.remove();
        if (!left.length) return;
        const n = left.reduce((a, i) => a + i.count, 0);
        const d = document.createElement('div');
        d.id = 'mbw-check-toast';
        d.innerHTML = '<span></span><button type="button"></button><b class="mct-x">×</b>';
        d.querySelector('span').textContent = '🩺 ' + t('val_toast', 'This world has {n} thing(s) the game does not know.').replace('{n}', n);
        d.querySelector('button').textContent = t('val_toast_btn', 'Check');
        d.querySelector('button').onclick = function () { d.remove(); if (typeof window.openWorldCheck === 'function') window.openWorldCheck(); };
        d.querySelector('.mct-x').onclick = function () { d.remove(); };
        document.body.appendChild(d);
        setTimeout(function () { if (d.parentNode) d.remove(); }, 15000);
    };
})();
