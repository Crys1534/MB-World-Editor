// ==========================================================
// 💾 SERVIDORES PERMANENTES: 9 LUGARES EN LÍNEA (va después de scripts/mp-mod.js)
//
//  · Hay 9 lugares ("slot1" … "slot9"). Cualquiera que tenga un servidor abierto lo puede volver permanente con la
//    casilla 💾 (menú del servidor o menú de pausa > Servidor), mientras quede un lugar libre.
//  · Cuando ya no queda nadie, el servidor sigue en la lista de servidores y cualquiera que pueda entrar
//    ("Quién puede entrar", baneados) lo ABRE y pasa a ser el anfitrión. Si el anfitrión se va y quedan jugadores,
//    otro sigue de anfitrión (y sigue guardando).
//  · Mientras está abierto, se guarda en Firebase 15 s después de abrirlo, cada minuto (si cambió) y al salir.
//    Jugando (Modo Jugar) se guarda lo que pasó jugando (menos en una prueba 🧪). Solo se guarda UNA copia por lugar.
//  · Su creador lo puede quitar (🗑 en la lista o quitando la casilla) y el lugar queda libre. Crystal (ADMINS) puede
//    quitar cualquiera.
//
//  Firebase:  saved_servers/slotN = datos pequeños para la lista (nombre, dueño, foto, ajustes, rev...)
//             saved_worlds/slotN/r/<rev>/<n> = el mundo, comprimido (gzip) en pedazos de 512 KB
//  (El servidor que antes estaba en "mbweCrystal" se pasa solo al primer lugar libre.)
// ==========================================================
(function () {
    'use strict';
    const META = 'saved_servers', DATA = 'saved_worlds';
    const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9'];
    const LEGACY = 'mbweCrystal';
    // las cuentas de Crystal (Web, APK, Local/Admin, PC, Tablet): pueden quitar cualquier servidor permanente
    const ADMINS = ['usr_7tsrn0vvl', 'usr_4dc3r36gm', 'usr_e6hrzt2ju', 'usr_1ryd13wnc', 'usr_l7jbkwc50'];
    const CHUNK = 512 * 1024;
    const EVERY = 60 * 1000;               // guardar cada minuto (si algo cambió)
    const FIRST = 15 * 1000;               // primer guardado: 15 s después de abrirlo
    const LOCK_MS = 90 * 1000;
    const CLAIM_MS = 3 * 60 * 1000;        // un lugar apartado que nunca llegó a guardarse se vuelve a liberar

    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function db() { return typeof database !== 'undefined' && database ? database : null; }
    function inMp() { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; }
    function amHost() { return typeof isHost !== 'undefined' && !!isHost; }
    function myUid() { return localStorage.getItem('mbw_uid'); }
    function myName() { return localStorage.getItem('mbw_username') || 'Player'; }
    function admins() { return ADMINS.concat(Array.isArray(window.MBW_SAVED_ADMINS) ? window.MBW_SAVED_ADMINS : []); }
    function isAdmin() { return admins().indexOf(myUid()) >= 0; }
    function isAdminUid(u) { return !!u && admins().indexOf(String(u)) >= 0; }
    const okSlot = (k) => SLOTS.indexOf(String(k)) >= 0;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
    function toast(title, body) {
        if (typeof window.mpToast === 'function') window.mpToast(title, body || '');
        else if (typeof showDesktopNotification === 'function') showDesktopNotification(title, body || '', 'assets/default pfp.png');
    }
    function fm() { return window.fileManager || (typeof fileManager !== 'undefined' ? fileManager : null); }

    // ------------------------------------------------------------------ comprimir (gzip + base64)
    async function pack(str) {
        if (typeof CompressionStream === 'undefined') return 'raw:' + str;
        const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
        const u8 = new Uint8Array(buf); let bin = '';
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return 'gz:' + btoa(bin);
    }
    async function unpack(s) {
        s = String(s || '');
        if (s.slice(0, 4) === 'raw:') return s.slice(4);
        if (s.slice(0, 3) !== 'gz:') throw new Error('bad data');
        const bin = atob(s.slice(3)), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
    function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }

    // ------------------------------------------------------------------ guardar
    const st = { last: null, lastAt: 0, busy: false, started: 0, status: '', denied: false };
    function mySlot() { return okSlot(window.mpSlot) ? window.mpSlot : null; }
    function canSave() {
        return !st.denied && !!mySlot() && inMp() && amHost() && !window.mpMigrating && !!db() && typeof mbwom !== 'undefined' && !!mbwom.world;
    }
    // 🛡 Lo que se sube es SIEMPRE el mundo de la pestaña del servidor, y solo si ese mundo trae la marca de este lugar
    //    (mbweSlot = "slotN", se pone al abrirlo o al volverlo permanente). Antes se subía el mundo que estuviera a la vista:
    //    si el anfitrión tenía abierta otra pestaña (u otro mundo suyo), ESE mundo reemplazaba al servidor permanente.
    function tabs() { return typeof WorldTabsManager !== 'undefined' ? WorldTabsManager : null; }
    function serverTabGone() { const T = tabs(); return !!(window.mpWorldTabId && T && !T.openWorlds.some(w => w.id === window.mpWorldTabId)); }
    function onServerWorld(fn) {
        if (serverTabGone()) return null;                                   // (la pestaña del servidor ya se cerró: no hay nada que subir)
        return typeof window.mpWithServerTab === 'function' ? window.mpWithServerTab(fn) : fn();
    }
    let warnedAt = 0;
    function refuse(k, why) {
        st.status = 'blocked';
        console.warn('🛡 Servidor permanente ' + k + ': NO se guardó (' + why + ').');
        if (Date.now() - warnedAt > 60000) { warnedAt = Date.now(); toast('🛡 ' + tr('ss_guard_title', 'Permanent server protected'), tr('ss_guard_body', 'The world open now is not the server world, so it was NOT saved over the server.')); }
        return null;
    }
    function worldJson(k) {
        const F = fm(); if (!F || typeof F.prepareNetworkJson !== 'function') return null;
        const r = onServerWorld(function () {
            const w = typeof mbwom !== 'undefined' ? mbwom.world : null;
            if (!w || w.mbweSlot !== k) return { bad: w ? 'the world has no mark of ' + k + (w.mbweSlot ? ' (it is from ' + w.mbweSlot + ')' : '') : 'no world' };
            window.__mbwSaveLive = true;
            try { const d = F.prepareNetworkJson(); return { json: d && d.json }; } finally { window.__mbwSaveLive = false; }
        });
        if (!r) return refuse(k, 'the server tab is closed');
        if (r.bad) return refuse(k, r.bad);
        return r.json || null;
    }
    // la marca del lugar va en el mundo de la pestaña del servidor
    function stamp(k) { onServerWorld(function () { if (typeof mbwom !== 'undefined' && mbwom.world) { if (k) mbwom.world.mbweSlot = k; else delete mbwom.world.mbweSlot; } }); }
    window.mbwIsPermServerWorld = function (w) { return !!(w && okSlot(w.mbweSlot)); };
    async function saveNow(why) {
        if (!canSave() || st.busy) return false;
        const k = mySlot();
        // (todo lo del mundo se toma AHORA, antes de esperar nada: si el anfitrión se está yendo, ya no estará después)
        let json;
        try { json = worldJson(k); } catch (e) { console.warn('💾 saved server: world', e); return false; }
        if (!json) return false;
        const h = hash(json);
        if (h === st.last && why !== 'force') { st.lastAt = Date.now(); return false; }
        const bans = {}; try { const B = mbwom.world.mbweBans; if (B && typeof B === 'object') Object.keys(B).forEach(u => { if (/^[\w-]{4,40}$/.test(u)) bans[u] = true; }); } catch (e) { /* nada */ }
        const owner = window.mpSlotOwner || { uid: myUid(), name: myName() };
        const cfg = {
            mapName: String(window.mpSelectedMapName || 'World').slice(0, 40),
            desc: String(window.mpRoomDesc || '').slice(0, 120),
            access: ['public', 'friends_only', 'private'].indexOf(window.multiplayerAccess) >= 0 ? window.multiplayerAccess : 'public',
            max: Math.max(2, Math.min(6, Number(window.multiplayerPlayerLimit) || 5)),
            perms: Object.assign({}, window.mpEditPerms || {}), levels: Object.assign({}, window.mpPermLevels || {}),
            permWorld: window.mpPermWorldKey || null
        };
        const thumb = String(window.mpSelectedMapThumb || '');
        st.busy = true; st.status = 'saving';
        try {
            const data = await pack(json);
            const n = Math.ceil(data.length / CHUNK) || 1;
            const rev = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
            const D = db();
            for (let i = 0; i < n; i++) await D.ref(DATA + '/' + k + '/r/' + rev + '/' + i).set(data.slice(i * CHUNK, (i + 1) * CHUNK));
            const mref = D.ref(META + '/' + k);
            const old = (await mref.once('value')).val() || {};
            if (old.ownerUid && owner.uid && old.ownerUid !== owner.uid) {      // (el lugar ya es de otro: se quitó y lo tomó alguien más)
                D.ref(DATA + '/' + k + '/r/' + rev).remove().catch(() => {});
                window.mpSlot = null; st.status = 'lost';
                return false;
            }
            const meta = Object.assign({}, cfg, {
                ownerUid: old.ownerUid || owner.uid || myUid(), ownerName: String(old.ownerName || owner.name || myName()).slice(0, 40),
                lastHostName: myName().slice(0, 40),
                mapThumb: (thumb.length < 90000 && /^(assets\/|data:image\/(png|jpeg|webp);base64,)/.test(thumb)) ? thumb : (old.mapThumb || null),
                bans: bans, rev: rev, chunks: n, bytes: data.length, rawBytes: json.length,
                savedAt: firebase.database.ServerValue.TIMESTAMP, v: 3
            });
            await mref.set(meta);
            if (old.rev && old.rev !== rev) D.ref(DATA + '/' + k + '/r/' + old.rev).remove().catch(() => {});
            st.last = h; st.lastAt = Date.now(); st.status = 'saved';
            console.log('💾 Servidor permanente guardado en línea (' + k + ', ' + (data.length / 1048576).toFixed(2) + ' MB, ' + why + ')');
            return true;
        } catch (e) {
            st.status = 'error';
            // (si Firebase todavía no tiene las reglas de saved_servers / saved_worlds, no se vuelve a intentar en esta sesión)
            if (/permission/i.test(String(e && (e.code || e.message)))) { st.denied = true; console.warn('💾 Servidores permanentes: Firebase no deja escribir en saved_servers / saved_worlds (faltan las reglas).'); }
            else console.warn('💾 saved server: upload failed', e);
            return false;
        } finally { st.busy = false; }
    }
    setInterval(function () {
        if (!canSave()) { if (!inMp()) st.started = 0; return; }
        const now = Date.now();
        if (!st.started) st.started = now;
        if (st.lastAt === 0) { if (now - st.started >= FIRST) saveNow('first'); return; }
        if (now - st.lastAt >= EVERY) saveNow('auto');
    }, 5000);
    // al salir del servidor (el anfitrión): se guarda antes de cerrar
    const origDisc = window.disconnectFromMultiplayer;
    if (typeof origDisc === 'function') {
        window.disconnectFromMultiplayer = function () {
            try { if (canSave()) saveNow('leave'); } catch (e) { /* nada */ }
            st.started = 0; st.lastAt = 0; st.last = null;
            window.mpSlot = null; window.mpSlotOwner = null;
            return origDisc.apply(this, arguments);
        };
    }

    // ------------------------------------------------------------------ la lista de servidores
    let saved = null, watching = false;
    const listeners = [];
    function watch(cb) {
        if (cb && listeners.indexOf(cb) < 0) listeners.push(cb);
        const D = db(); if (!D || watching) return;
        watching = true;
        D.ref(META).on('value', function (snap) {
            saved = snap.val() || {};
            migrateLegacy();
            listeners.forEach(f => { try { f(); } catch (e) { /* nada */ } });
        }, function () { saved = {}; watching = false; });   // (sin permiso para leer: no hay lista)
    }
    function friendsOf() { return (typeof misAmigosConfirmados !== 'undefined' && Array.isArray(misAmigosConfirmados)) ? misAmigosConfirmados : []; }
    function canSee(s) {
        const me = myUid();
        if (s.ownerUid === me || isAdmin()) return true;
        if (s.bans && me && s.bans[me]) return false;
        if (s.access === 'private') return false;
        if (s.access === 'friends_only') return friendsOf().indexOf(s.ownerUid) >= 0;
        return true;
    }
    const canRemove = (s) => !!s && (s.ownerUid === myUid() || isAdmin());
    function ago(ts) {
        const sec = Math.max(0, (Date.now() - Number(ts || 0)) / 1000);
        let lang = 'en'; try { lang = (localStorage.getItem('mbw_lang') || document.documentElement.lang || 'en').slice(0, 2); } catch (e) { /* nada */ }
        try {
            const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
            if (sec < 60) return rtf.format(0, 'second');
            if (sec < 3600) return rtf.format(-Math.round(sec / 60), 'minute');
            if (sec < 86400) return rtf.format(-Math.round(sec / 3600), 'hour');
            return rtf.format(-Math.round(sec / 86400), 'day');
        } catch (e) { return new Date(Number(ts)).toLocaleString(); }
    }
    function used() { return SLOTS.filter(k => saved && saved[k] && (saved[k].rev || (Date.now() - Number(saved[k].claimedAt || 0) < CLAIM_MS))); }
    function html(active) {
        watch();
        if (!saved) return '';
        const live = {}; Object.keys(active || {}).forEach(id => { const a = active[id]; if (a && okSlot(a.slot)) live[a.slot] = id; });
        let out = '', count = 0;
        SLOTS.filter(k => saved[k] && saved[k].rev).sort((a, b) => Number(saved[b].savedAt || 0) - Number(saved[a].savedAt || 0)).forEach(function (k) {
            const s = saved[k];
            if (live[k] || !canSee(s)) return;                      // (abierto ahora: sale arriba como siempre)
            const raw = String(s.mapThumb || '');
            const thumb = /^(assets\/[\w\- .\/]+\.(png|jpg|jpeg|gif|webp)|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=]+)$/i.test(raw) ? raw : 'assets/Superflat World.png';
            const desc = s.desc ? `<span class="ss-desc">${esc(String(s.desc).slice(0, 120))}</span>` : '';
            const mb = (Number(s.bytes) || 0) / 1048576;
            count++;
            out += `
                <div class="ss-row">
                    <div class="ss-left">
                        <div class="ss-thumb" style="background-image: url(&quot;${esc(thumb)}&quot;);"></div>
                        <div style="min-width: 0;">
                            <strong class="ss-name">${esc(s.mapName || 'World')}</strong>
                            <span class="ss-sub">${esc(tr('ss_by', 'by {name}', { name: s.ownerName || 'Player' }) + ' · ' + tr('ss_saved_ago', 'saved {when}', { when: ago(s.savedAt) }) + (mb >= .05 ? ' · ' + mb.toFixed(1) + ' MB' : ''))}</span>
                            ${desc}
                        </div>
                    </div>
                    <div class="ss-right"><span class="ss-max">0/${Number(s.max) | 0}</span>${canRemove(s) ? `<button type="button" class="ss-del" data-ss="${k}" title="${esc(tr('ss_delete', 'Remove'))}">🗑</button>` : ''}<button type="button" class="ss-open" data-ss="${k}">${esc(tr('ss_open', 'OPEN'))}</button></div>
                </div>`;
        });
        const head = `<div class="ss-head">💾 ${esc(tr('ss_title9', 'Permanent servers ({n} of 9 places used): open one to be the host', { n: used().length }))}</div>`;
        return count ? head + out : '';
    }
    function bind(root) {
        if (!root) return;
        root.querySelectorAll('.ss-open').forEach(b => b.addEventListener('click', () => openSaved(b.getAttribute('data-ss'))));
        root.querySelectorAll('.ss-del').forEach(b => b.addEventListener('click', () => {
            const k = b.getAttribute('data-ss'), s = saved && saved[k];
            if (!canRemove(s)) return;
            if (!confirm(tr('ss_delete_confirm', 'Remove this permanent server? The world saved online is deleted and the place is free for another server (your own copies are not touched).'))) return;
            removeSaved(k);
        }));
    }
    function removeSaved(k) {
        const D = db(); if (!D || !okSlot(k)) return Promise.resolve();
        if (saved && saved[k] && !canRemove(saved[k])) return Promise.resolve();
        if (window.mpSlot === k) { window.mpSlot = null; window.mpSlotOwner = null; stamp(null); try { if (window.myRoomRef) window.myRoomRef.update({ slot: null }); } catch (e) { /* nada */ } }
        return Promise.all([D.ref(DATA + '/' + k).remove(), D.ref(META + '/' + k).remove()]).catch(e => console.warn('💾 delete', e));
    }

    // (el servidor de antes, en "mbweCrystal", pasa al primer lugar libre)
    let migrating = false;
    async function migrateLegacy() {
        const D = db(); if (!D || migrating || !saved) return;
        migrating = true;
        try {
            const old = (await D.ref(META + '/' + LEGACY).once('value')).val();
            if (!old || !old.rev) return;
            const k = SLOTS.find(s => !saved[s]); if (!k) return;
            const tx = await D.ref(META + '/' + k).transaction(cur => cur ? undefined : { claimedAt: Date.now(), ownerUid: old.ownerUid || null });
            if (!tx.committed) return;
            const n = Math.max(1, Number(old.chunks) || 1);
            for (let i = 0; i < n; i++) {
                const p = (await D.ref(DATA + '/' + LEGACY + '/r/' + old.rev + '/' + i).once('value')).val();
                if (typeof p !== 'string') { await D.ref(META + '/' + k).remove(); return; }
                await D.ref(DATA + '/' + k + '/r/' + old.rev + '/' + i).set(p);
            }
            const meta = Object.assign({}, old); delete meta.lock; meta.v = 3;
            await D.ref(META + '/' + k).set(meta);
            await Promise.all([D.ref(DATA + '/' + LEGACY).remove(), D.ref(META + '/' + LEGACY).remove()]);
            console.log('💾 Servidor permanente pasado de ' + LEGACY + ' a ' + k);
        } catch (e) { /* (sin permiso o ya lo pasó otro) */ } finally { migrating = false; }
    }

    // ------------------------------------------------------------------ abrirlo (cualquiera que pueda entrar: pasa a ser el anfitrión)
    const op = { busy: false };
    async function openSaved(k) {
        const D = db(); if (!D || op.busy || !okSlot(k)) return false;
        const s = saved && saved[k];
        if (!s || !s.rev || !canSee(s)) return false;
        // ¿alguien lo abrió hace un momento? Entonces se entra a ese
        const act = window.__mbwLastServers || {};
        const liveId = Object.keys(act).find(id => act[id] && act[id].slot === k);
        if (liveId) { if (typeof joinMultiplayerSession === 'function') joinMultiplayerSession(liveId); return true; }
        if (inMp()) {
            if (!confirm(tr('ss_leave_confirm', 'You are in a server. Leave it to open this one?'))) return false;
            try { window.disconnectFromMultiplayer(true); } catch (e) { /* nada */ }
        }
        op.busy = true;
        const me = myUid(), lockRef = D.ref(META + '/' + k + '/lock');
        try {
            // 🔒 que no lo abran dos personas a la vez
            const tx = await lockRef.transaction(function (cur) {
                if (cur && cur.uid !== me && Date.now() - Number(cur.at || 0) < LOCK_MS) return;
                return { uid: me, at: Date.now() };
            });
            if (!tx.committed) { alert(tr('ss_busy', 'Someone else is opening this server right now. Try again in a moment.')); return false; }
            toast('💾 ' + tr('ss_opening', 'Downloading the world…'), String(s.mapName || ''));
            if (typeof updateLoadingBar === 'function') { const ov = document.getElementById('loading-overlay'); if (ov) ov.style.display = 'flex'; updateLoadingBar(5, tr('ss_opening', 'Downloading the world…')); }
            const meta = (await D.ref(META + '/' + k).once('value')).val() || s;
            const n = Math.max(1, Number(meta.chunks) || 1);
            let got = 0;
            const parts = await Promise.all(Array.from({ length: n }, (_, i) => D.ref(DATA + '/' + k + '/r/' + meta.rev + '/' + i).once('value').then(sn => {
                got++; if (typeof updateLoadingBar === 'function') updateLoadingBar(5 + Math.round(got / n * 15), tr('ss_opening', 'Downloading the world…'));
                return sn.val();
            })));
            if (parts.some(p => typeof p !== 'string')) throw new Error('missing pieces');
            const json = await unpack(parts.join(''));
            const fname = String(meta.mapName || 'World').replace(/[\\/:*?"<>|]/g, '_') + '.mbw';
            if (typeof window.loadWorldFromJson !== 'function') throw new Error('no loader');
            await window.loadWorldFromJson(json, fname, { fromServer: true });
            await new Promise(r => setTimeout(r, 300));
            try { mbwom.world.mbweServerMap = true; mbwom.world.mbweSlot = k; } catch (e) { /* nada */ }   // (un mapa de servidor: solo Play y Test · 🛡 la marca de su lugar)
            window.mpSelectedMapName = meta.mapName || 'World';
            window.mpSelectedMapThumb = meta.mapThumb || null;
            window.mpSelectedMapData = null;
            window.multiplayerAccess = meta.access || 'public';
            window.multiplayerPlayerLimit = Math.max(2, Math.min(6, Number(meta.max) || 5));
            st.last = hash(json); st.lastAt = 0; st.started = 0;      // (recién bajado: no se vuelve a subir si nada cambia)
            window.hostMultiplayerSession({ perms: meta.perms || {}, levels: meta.levels || {}, desc: meta.desc || '', slot: k, slotOwner: { uid: meta.ownerUid || null, name: meta.ownerName || 'Player' }, server: true });
            if (meta.permWorld) window.mpPermWorldKey = meta.permWorld;
            if (typeof window.mpMarkServerTab === 'function') { try { window.mpMarkServerTab(); } catch (e) { /* nada */ } }
            const t0 = Date.now();
            const iv = setInterval(() => { if ((window.currentRoomId && amHost()) || Date.now() - t0 > 20000) { clearInterval(iv); lockRef.remove().catch(() => {}); } }, 500);
            if (window.mbwServerMap && window.mbwServerMap.startPlaying) window.mbwServerMap.startPlaying();
            toast('💾 ' + tr('ss_opened', 'Server open'), tr('ss_opened_body', 'You are the host of {name}.', { name: meta.mapName || 'World' }));
            return true;
        } catch (e) {
            console.warn('💾 open saved server', e);
            lockRef.remove().catch(() => {});
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.display = 'none';
            alert(tr('ss_open_fail', 'Could not open the saved server.'));
            return false;
        } finally { op.busy = false; }
    }

    // ------------------------------------------------------------------ "hacerlo permanente" (casilla)
    async function setPermanent(on) {
        const D = db(); if (!D || !amHost() || !inMp()) return false;
        if (!on) {
            const k = mySlot(); if (!k) return true;
            const s = saved && saved[k];
            if (s && !canRemove(s)) { alert(tr('ss_not_yours', 'Only the person who made it permanent can remove it.')); return false; }
            if (!confirm(tr('ss_delete_confirm', 'Remove this permanent server? The world saved online is deleted and the place is free for another server (your own copies are not touched).'))) return false;
            await removeSaved(k);
            try { if (window.myRoomRef) window.myRoomRef.update({ slot: null }); } catch (e) { /* nada */ }
            sendCfg();
            return true;
        }
        if (mySlot()) return true;
        watch();
        // el primer lugar libre (se aparta con una transacción para que dos no tomen el mismo)
        let k = null;
        for (const s of SLOTS) {
            const tx = await D.ref(META + '/' + s).transaction(cur => {
                if (cur && (cur.rev || Date.now() - Number(cur.claimedAt || 0) < CLAIM_MS)) return;   // (ocupado)
                return { claimedAt: Date.now(), ownerUid: myUid(), ownerName: myName().slice(0, 40) };
            }).catch(() => null);
            if (tx && tx.committed) { k = s; break; }
        }
        if (!k) { alert(tr('ss_full', 'The 9 places for permanent servers are taken. When someone removes theirs, a place becomes free.')); return false; }
        window.mpSlot = k; window.mpSlotOwner = { uid: myUid(), name: myName() };
        stamp(k);                                                            // 🛡 el mundo del servidor queda marcado con su lugar
        try { if (window.myRoomRef) window.myRoomRef.update({ slot: k }); } catch (e) { /* nada */ }
        sendCfg();
        st.last = null; st.lastAt = 0; st.started = Date.now();
        saveNow('force');
        return true;
    }
    function sendCfg() { try { if (typeof enviarMensajeEnRed === 'function' && typeof window.mpHostCfg === 'function') enviarMensajeEnRed({ tipo: 'room_cfg', cfg: window.mpHostCfg() }); } catch (e) { /* nada */ } }
    function checkboxRow(cls) {
        if (!amHost() || !inMp() || !window.mpServerKind) return null;   // (solo en servidores, no en salas para editar juntos)
        watch();
        const lab = document.createElement('label'); lab.className = cls || 'ss-official';
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!mySlot();
        c.addEventListener('change', function () { c.disabled = true; setPermanent(c.checked).then(ok => { c.disabled = false; c.checked = !!mySlot(); if (!ok) c.checked = !!mySlot(); }); });
        const sp = document.createElement('span');
        const free = 9 - used().length;
        sp.textContent = '💾 ' + (mySlot() ? tr('ss_official_on', 'Permanent server (saved online)') : tr('ss_official_free', 'Make it permanent ({n} of 9 places free)', { n: Math.max(0, free) }));
        lab.title = tr('ss_official_tip', 'Saved online every minute and when the host leaves. When nobody is playing, anyone who can join can open it again from the server list and be the host.');
        lab.appendChild(c); lab.appendChild(sp);
        return lab;
    }

    window.mbwSavedServers = { ready: function () { return saved !== null && saved !== undefined; }, get: function (k) { return saved ? saved[k] || null : null; }, slots: SLOTS, watch: watch, html: html, bind: bind, open: openSaved, save: saveNow, remove: removeSaved, setPermanent: setPermanent, checkboxRow: checkboxRow, isAdmin: isAdmin, isAdminUid: isAdminUid, state: st, pack: pack, unpack: unpack, list: () => saved, used: used, SLOTS: SLOTS };
})();
