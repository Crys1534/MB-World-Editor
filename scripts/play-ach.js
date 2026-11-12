// ==========================================================
// 🏆 LOGROS DEL MODO JUGAR (los 46 de Mine Blocks: Game.achievements / unlockAchieve)
//
//  · Se ganan jugando (picar madera, hacer una mesa de crafteo, matar un zombi, dormir en una cama...). Sale un aviso arriba.
//  · Se guardan EN EL MUNDO (mbweAch): { uid: { n: nombre, a: { número: cuándo } } }, así se ven los logros de TODOS los que
//    alguna vez jugaron en ese mundo. En multijugador cada logro se avisa a todos (juego_logro) y el que entra recibe la tabla.
//  · Menú de pausa > Logros: los jugadores ordenados de más logros a menos.
// ==========================================================
(function () {
    'use strict';
    const NAMES = ['Mine a block of wood', 'Place a block', 'Open the inventory', 'Craft a crafting table', 'Craft a wooden pickaxe', 'Craft a stone pickaxe', 'Craft an iron pickaxe', 'Make a furnace', 'Make an iron ingot', 'Make some torches', 'Grow a tree', 'Tame a dog', 'Slay a pig', 'Slay a cow', 'Slay a sheep', 'Slay a zombie', 'Slay a skeleton', 'Slay a spider', 'Slay a nethereye', 'Slay a blaze', 'Slay an enderman', 'Slay a creeper', 'Defeat a flaming chicken', 'Grow a farm', 'Make a cake', 'Eat some food', 'Use a bed', 'Mine obsidian', 'Mine gold', 'Mine diamonds', 'Make portal stone', 'Travel to the nether', 'Open a door with wiring', 'Fire a bow', 'Teleport with enderpearl', 'Unlock the ender portal', 'Slay the ender dragon', 'Slay a slime', 'Slay a magma cube', 'Fish a fish', 'Use an anvil', 'Slay a zombie pigman', 'Slay a ghast by its fireball', 'Brew a potion', 'Breed two animals', 'Enchant an item'];
    const ICONS = ['🪵', '🧱', '🎒', '🛠', '⛏', '⛏', '⛏', '🔥', '⚙', '🕯', '🌳', '🐕', '🐷', '🐄', '🐑', '🧟', '💀', '🕷', '👁', '🔥', '🟪', '💥', '🐔', '🌾', '🎂', '🍖', '🛏', '⬛', '🟨', '💎', '🧱', '🌋', '🚪', '🏹', '🔮', '🟢', '🐉', '🟩', '🟧', '🎣', '⚒', '🐖', '👻', '🧪', '🐣', '✨'];
    const tr = (k, fb, v) => { try { const s = window.tmsg ? window.tmsg(k, fb, v) : fb; return s || fb; } catch (e) { return fb; } };
    const W = () => (typeof mbwom !== 'undefined' && mbwom.world) ? mbwom.world : null;
    const myUid = () => { try { return localStorage.getItem('mbw_uid') || 'local'; } catch (e) { return 'local'; } };
    const myName = () => { try { return localStorage.getItem('mbw_username') || 'Player'; } catch (e) { return 'Player'; } };
    const playing = () => !!(window.mbwPlay && window.mbwPlay.isPlaying && window.mbwPlay.isPlaying());
    let keep = {};                                                   // copia (el Modo Jugar pone el mundo de antes al salir de una prueba)
    function table() {
        const w = W(); if (!w) return keep;
        if (!w.mbweAch || typeof w.mbweAch !== 'object' || Array.isArray(w.mbweAch)) w.mbweAch = {};
        return w.mbweAch;
    }
    function entry(t, uid, name) {
        let r = t[uid];
        if (!r || typeof r !== 'object') r = t[uid] = { n: name || 'Player', a: {} };
        if (!r.a || typeof r.a !== 'object') r.a = {};
        if (name) r.n = String(name).slice(0, 40);
        return r;
    }
    function remember() { try { keep = JSON.parse(JSON.stringify(table())); } catch (e) { /* nada */ } }
    function dirty() { if (typeof worldDirty !== 'undefined') { try { worldDirty = true; } catch (e) { /* nada */ } } }
    function send(d) { try { if (window.mbwMpPlay && window.mbwMpPlay.on && typeof window.enviarMensajeEnRed === 'function') window.enviarMensajeEnRed(d); } catch (e) { /* nada */ } }

    let toastEl = null, toastT = 0;
    function toast(i, who) {
        if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ach-toast'; document.body.appendChild(toastEl); }
        toastEl.innerHTML = '';
        const ic = document.createElement('div'); ic.className = 'ach-toast-ic'; ic.textContent = ICONS[i] || '🏆';
        const tx = document.createElement('div');
        const t1 = document.createElement('div'); t1.className = 'ach-toast-t'; t1.textContent = who ? tr('ach_got_other', '{name} got an achievement!', { name: who }) : tr('ach_got', 'Achievement get!');
        const t2 = document.createElement('div'); t2.className = 'ach-toast-n'; t2.textContent = name(i);
        tx.appendChild(t1); tx.appendChild(t2);
        toastEl.appendChild(ic); toastEl.appendChild(tx);
        toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
        clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, who ? 2500 : 3800);
    }
    function name(i) { return tr('ach_' + i, NAMES[i] || '?'); }

    const A = window.mbwAch = {
        count: NAMES.length,
        name: name, icon: function (i) { return ICONS[i] || '🏆'; },
        // yo gané el logro i (solo jugando). true = era nuevo
        unlock: function (i) {
            i = i | 0;
            if (!playing() || i < 0 || i >= NAMES.length) return false;
            const r = entry(table(), myUid(), myName());
            if (r.a[i]) return false;
            r.a[i] = Date.now();
            remember(); dirty();
            toast(i);
            try { if (window.mbSfx && window.mbSfx.play) window.mbSfx.play('levelup'); } catch (e) { /* nada */ }
            send({ tipo: 'juego_logro', uid: myUid(), n: myName(), i: i, t: r.a[i] });
            return true;
        },
        has: function (i, uid) { const r = table()[uid || myUid()]; return !!(r && r.a && r.a[i]); },
        // de otro jugador (multijugador)
        apply: function (uid, nm, i, ts) {
            if (!uid) return;
            const r = entry(table(), String(uid), nm);
            if (i == null) { remember(); return; }
            i = i | 0; if (i < 0 || i >= NAMES.length || r.a[i]) return;
            r.a[i] = Number(ts) || Date.now();
            remember(); dirty();
            if (playing() && uid !== myUid()) toast(i, r.n);
        },
        // juntar una tabla entera (la del anfitrión, o la copia al salir de jugar)
        merge: function (t) {
            if (!t || typeof t !== 'object') return;
            const mine = table();
            Object.keys(t).forEach(function (uid) {
                const o = t[uid]; if (!o || typeof o !== 'object') return;
                const r = entry(mine, uid, o.n);
                Object.keys(o.a || {}).forEach(function (k) { if (!r.a[k]) r.a[k] = o.a[k]; });
            });
            remember();
        },
        table: function () { return table(); },
        // al empezar a jugar: entro a la lista (aunque no tenga logros todavía)
        start: function () { entry(table(), myUid(), myName()); remember(); },
        afterRestore: function () { const k = keep; A.merge(k); },
        // la lista para el menú: [{ uid, name, count, a }] de más logros a menos
        ranking: function () {
            const t = table();
            return Object.keys(t).map(function (uid) { const r = t[uid] || {}; const a = r.a || {}; return { uid: uid, name: String(r.n || 'Player'), count: Object.keys(a).filter(function (k) { return a[k]; }).length, a: a }; })
                .sort(function (x, y) { return y.count - x.count || x.name.localeCompare(y.name); });
        }
    };
})();
