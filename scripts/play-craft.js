// =====================================================================
// 🛠 CRAFTEO DEL MODO JUGAR — busca qué sale de lo que hay en la cuadrícula (2×2 en el inventario, 3×3 en la mesa de crafteo)
// =====================================================================
// Copia de Inventory.doWhatYouDoWithWheatThins del juego (código decompilado de Mine Blocks): mismas reglas y mismo orden
// (gana la primera receta de la lista que encaja). Las recetas están en scripts/play-recipes.js (window.MB_RECIPES).
// Un objeto de la cuadrícula = { id, qty, dmg, extras } (o null = vacío). La cuadrícula es una lista de size×size, fila por fila.
//   mbwCraft.match(grid, size)  → [id, cantidad, daño, extras] o null
//   mbwCraft.consume(grid)      → quita 1 de cada espacio usado (las cubetas llenas dejan la cubeta vacía)
// =====================================================================
(function () {
    'use strict';
    const COLORS = ['white', 'lightgray', 'gray', 'black', 'brown', 'purple', 'magenta', 'red', 'orange', 'pink', 'yellow', 'lightgreen', 'green', 'cyan', 'lightblue', 'blue'];
    // qué tinte da cada color (Colors.colors[c].dye en el juego): "DYE" = el objeto dye con extras.type = color
    const DYE_ITEM = { white: 'bonem', black: 'ink', blue: 'll', brown: 'ccb' };
    const FULL_BUCKET = { mbk: 1, wbk: 1, lbk: 1, abk: 1 };
    const ex = (it) => (it && it.extras && typeof it.extras === 'object') ? it.extras : {};
    const typeOf = (it) => ex(it).type;
    function clone(o) { try { return JSON.parse(JSON.stringify(o == null ? {} : o)); } catch (e) { return {}; } }
    // Game.hasExtras: todas las claves pedidas son iguales en el objeto
    function hasExtras(have, need) { if (!need) return true; have = have || {}; return Object.keys(need).every((k) => have[k] == need[k]); }
    function sameExtras(a, b) { return JSON.stringify(sortObj(a || {})) === JSON.stringify(sortObj(b || {})); }
    function sortObj(o) { if (!o || typeof o !== 'object' || Array.isArray(o)) return o; const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = sortObj(o[k]); }); return r; }

    function match(grid, size) {
        const R = window.MB_RECIPES;
        if (!Array.isArray(R) || !Array.isArray(grid)) return null;
        const n = size * size;
        const cell = (i) => grid[i] || null;
        // only(list): todos los espacios con algo son justo los de la lista (y esos tienen algo)
        const only = (list) => { for (let i = 0; i < n; i++) { const inL = list.indexOf(i) >= 0; if (inL && !cell(i)) return false; if (!inL && cell(i)) return false; } return true; };
        if (only([])) return null;
        let first = -1; for (let i = 0; i < n; i++) if (cell(i)) { first = i; break; }
        // el primer espacio con algo, por filas (para las recetas "relative")
        let fx = 0, fy = 0; outer: for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (cell(y * size + x)) { fx = x; fy = y; break outer; }
        // containItems: cada objeto de la cuadrícula usa una entrada distinta y se usan todas
        const contains = (inputs) => {
            const used = inputs.map(() => false);
            for (let i = 0; i < n; i++) {
                const c = cell(i); if (!c) continue;
                let ok = false;
                for (let k = 0; k < inputs.length; k++) {
                    if (used[k]) continue;
                    const q = inputs[k];
                    if (typeof q === 'string') { if (c.id === q) { used[k] = ok = true; break; } }
                    else if (q.exactExtras == 1) { if (c.id === q.ty && sameExtras(ex(c), q.extra)) { used[k] = ok = true; break; } }
                    else if (c.id === q.ty && hasExtras(ex(c), q.extra)) { used[k] = ok = true; break; }
                }
                if (!ok) return false;
            }
            return used.every(Boolean);
        };
        const out = (o, extra, dmg) => [o[0], o[1], dmg != null ? dmg : (o[2] || 0), extra != null ? extra : clone(o[3] || {})];
        for (let r = 0; r < R.length; r++) {
            const rc = R[r], t = rc.t;
            if (t === 'absolute' || t === 'relative') {
                let ok = true; const usedIdx = [];
                for (let k = 0; k < rc.i.length; k++) {
                    const m = rc.i[k];
                    const gx = t === 'relative' ? fx + m.x : m.x, gy = t === 'relative' ? fy + m.y : m.y;
                    if (gx < 0 || gy < 0 || gx >= size || gy >= size) { ok = false; break; }
                    const idx = gy * size + gx, c = cell(idx);
                    let hit = false;
                    if (c) {
                        if (c.id === m.ty) hit = !((m.damage != null && (c.dmg || 0) != m.damage) || (m.type != null && typeOf(c) != m.type));
                        else if (m.ty2 != null && c.id === m.ty2) hit = !((m.damage2 != null && (c.dmg || 0) != m.damage2) || (m.type2 != null && typeOf(c) != m.type2));
                    }
                    if (!hit) { ok = false; break; }
                    usedIdx.push(idx);
                }
                if (ok && only(usedIdx)) return out(rc.o);
            } else if (t === 'large box') {
                if (size === 3) { let ok = true; for (let i = 0; i < 9; i++) if (!cell(i) || cell(i).id !== rc.i) { ok = false; break; } if (ok) return out(rc.o); }
            } else if (t === 'contains') {
                if (contains(rc.i)) return out(rc.o);
            } else if (t === 'rainbow') {
                const seen = []; let ok = true;
                for (let i = 0; i < n && ok; i++) { const c = cell(i); if (!c) continue; if (c.id !== 'cloth') { ok = false; break; } const ty = typeOf(c); if (ty != null && ty !== 'rainbow') { if (seen.indexOf(ty) >= 0 || seen.length > 7) ok = false; else seen.push(ty); } }
                if (ok && seen.length === 7) return out(rc.o);
            } else if (t === 'rainbowcap') {
                const seen = []; let paper = false, ok = true;
                for (let i = 0; i < n && ok; i++) {
                    const c = cell(i); if (!c) continue;
                    let key = null;
                    if (c.id === 'dye') { if (typeOf(c) != null) key = 'dye:' + typeOf(c); }
                    else if (c.id === 'll' || c.id === 'bonem' || c.id === 'ink') key = c.id;
                    else if (c.id === 'paper' && !paper) { paper = true; continue; }
                    else { ok = false; break; }
                    if (key) { if (seen.indexOf(key) >= 0 || seen.length > 3) ok = false; else seen.push(key); }
                }
                if (ok && seen.length === 3 && paper) return out(rc.o);
            } else if (t === 'carpet') {
                for (let i = 0; i < n - 1; i++) {
                    const c = cell(i), right = (i % size) < size - 1 ? i + 1 : -1;
                    if (c && c.id === 'cloth' && right >= 0) { const d = cell(right); if (d && d.id === c.id && typeOf(d) === typeOf(c) && only([i, right])) { const e = clone(rc.o[3] || {}); e.type = typeOf(c); return out(rc.o, e); } }
                }
            } else if (t === 'keepextra') {
                if (first >= 0 && contains(rc.i) && only([first])) { const e = clone(rc.o[3] || {}); Object.assign(e, clone(ex(cell(first)))); return out(rc.o, e); }
            } else if (t === 'dye' || t === 'dyekeepextra') {
                const excl = rc.x || {};
                let col = '', dyeId = '';
                for (let k = 0; k < COLORS.length; k++) {
                    const c = COLORS[k]; if (excl[c]) continue;
                    const d = DYE_ITEM[c];
                    const extra = d ? { ty: d, extra: {} } : { ty: 'dye', extra: { type: c } };
                    if (contains(rc.i.concat([extra]))) { col = c; dyeId = d || 'dye'; break; }
                }
                if (col) {
                    let e = clone(rc.o[3] || {}), dmg = rc.o[2] || 0;
                    if (t === 'dyekeepextra') for (let i = 0; i < n; i++) { const c = cell(i); if (c && c.id !== dyeId) { e = Object.assign(e, clone(ex(c))); dmg = c.dmg || 0; break; } }
                    e.type = col;
                    return out(rc.o, e, dmg);
                }
            } else if (t === 'fix') {
                if (first < 0) continue;
                const a = cell(first), life = typeof window.itemMaxDurability === 'function' ? window.itemMaxDurability(a.id) : 0;
                if (!life) continue;
                let p = -1; for (let i = first + 1; i < n; i++) if (cell(i) && cell(i).id === a.id) { p = i; break; }
                if (p >= 0 && only([first, p])) return [a.id, 1, Math.max(0, Math.round(-1.3 * life + 1.15 * (a.dmg || 0) + 1.15 * (cell(p).dmg || 0))), clone(rc.o[3] || {})];
            }
        }
        return null;
    }
    // se tomó el resultado: 1 menos de cada espacio con algo (una cubeta llena deja la cubeta vacía, como en el juego)
    function consume(grid) {
        for (let i = 0; i < grid.length; i++) {
            const c = grid[i]; if (!c) continue;
            if (FULL_BUCKET[c.id]) { grid[i] = { id: 'bk', qty: 1, dmg: 0, extras: {} }; continue; }
            grid[i] = c.qty > 1 ? { id: c.id, qty: c.qty - 1, dmg: c.dmg || 0, extras: c.extras } : null;
        }
    }
    window.mbwCraft = { match: match, consume: consume, count: function () { return (window.MB_RECIPES || []).length; } };
})();
