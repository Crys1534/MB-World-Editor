// ==========================================================
// 💾 SERVIDORES GUARDADOS EN LÍNEA (va después de scripts/mp-mod.js)
//
//  · Mientras un servidor está abierto, el anfitrión guarda el mundo en Firebase cada 2 minutos (si cambió),
//    al poco de abrirlo y al salir. Si el anfitrión se va, el que sigue de anfitrión sigue guardando.
//  · Cuando ya no queda nadie, el servidor sigue en la lista de servidores ("💾 Guardado") y cualquiera que
//    pueda entrar (según "Quién puede entrar" y la lista de baneados) lo puede ABRIR: se baja el mundo y esa
//    persona pasa a ser el anfitrión, con los mismos ajustes, permisos y código del servidor.
//  · Jugando (Modo Jugar), lo que se guarda es lo que pasó jugando (menos en una prueba 🧪).
//  · El creador lo puede borrar de la lista (🗑). Si nadie lo abre en 30 días, se borra solo.
//
//  Firebase:  saved_servers/<código>  = datos pequeños para la lista (nombre, dueño, foto, ajustes, rev...)
//             saved_worlds/<código>/r/<rev>/<n> = el mundo, comprimido (gzip) en pedazos de 512 KB
// ==========================================================
(function () {
    'use strict';
    const META = 'saved_servers', DATA = 'saved_worlds';
    const CHUNK = 512 * 1024;
    const EVERY = 2 * 60 * 1000;           // guardar como mucho cada 2 minutos
    const FIRST = 15 * 1000;               // primer guardado: 15 s después de abrir el servidor
    const EXPIRE = 30 * 24 * 3600 * 1000;  // sin abrirse en 30 días: se borra
    const LOCK_MS = 90 * 1000;

    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function db() { return typeof database !== 'undefined' && database ? database : null; }
    function inMp() { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; }
    function amHost() { return typeof isHost !== 'undefined' && !!isHost; }
    function myUid() { return localStorage.getItem('mbw_uid'); }
    function myName() { return localStorage.getItem('mbw_username') || 'Player'; }
    function baseId(id) { return String(id || '').split('-m')[0]; }
    function curBase() { return baseId(window.currentRoomId); }
    const okKey = (k) => /^[A-Za-z0-9]{4,20}$/.test(String(k || ''));
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
    const st = { last: null, lastAt: 0, busy: false, started: 0, base: null, status: '' };
    function canSave() {
        return !st.denied && inMp() && amHost() && window.mpPersist !== false && !!db() && typeof mbwom !== 'undefined' && !!mbwom.world && okKey(curBase()) && !window.mpMigrating;
    }
    function worldJson() {
        const F = fm(); if (!F || typeof F.prepareNetworkJson !== 'function') return null;
        window.__mbwSaveLive = true;
        try { const d = F.prepareNetworkJson(); return d && d.json; } finally { window.__mbwSaveLive = false; }
    }
    async function saveNow(why) {
        if (!canSave() || st.busy) return false;
        const base = curBase();
        // (todo lo del mundo se toma AHORA, antes de esperar nada: si el anfitrión se está yendo, ya no estará después)
        let json;
        try { json = worldJson(); } catch (e) { console.warn('💾 saved server: world', e); return false; }
        if (!json) return false;
        const h = hash(json);
        if (h === st.last && st.base === base && why !== 'force') { st.lastAt = Date.now(); return false; }
        const owner = window.mpOwner || { uid: myUid(), name: myName() };
        const bans = {}; try { const B = mbwom.world.mbweBans; if (B && typeof B === 'object') Object.keys(B).forEach(u => { if (okKey(u) || /^[\w-]{4,40}$/.test(u)) bans[u] = true; }); } catch (e) { /* nada */ }
        const cfg = {
            mapName: String(window.mpSelectedMapName || 'World').slice(0, 40),
            desc: String(window.mpRoomDesc || '').slice(0, 120),
            access: ['public', 'friends_only', 'private'].indexOf(window.multiplayerAccess) >= 0 ? window.multiplayerAccess : 'public',
            max: Math.max(2, Math.min(6, Number(window.multiplayerPlayerLimit) || 5)),
            perms: Object.assign({}, window.mpEditPerms || {}), levels: Object.assign({}, window.mpPermLevels || {}),
            permWorld: window.mpPermWorldKey || null, gen: Number(window.mpGen) || 0
        };
        const thumb = String(window.mpSelectedMapThumb || '');
        st.busy = true; st.status = 'saving';
        try {
            const data = await pack(json);
            const n = Math.ceil(data.length / CHUNK) || 1;
            const rev = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
            const D = db();
            for (let i = 0; i < n; i++) await D.ref(DATA + '/' + base + '/r/' + rev + '/' + i).set(data.slice(i * CHUNK, (i + 1) * CHUNK));
            const mref = D.ref(META + '/' + base);
            const old = (await mref.once('value')).val() || {};
            const meta = Object.assign({}, cfg, {
                ownerUid: old.ownerUid || owner.uid || myUid(), ownerName: String(old.ownerName || owner.name || myName()).slice(0, 40),
                lastHostName: myName().slice(0, 40), lastHostUid: myUid(),
                mapThumb: (thumb.length < 90000 && /^(assets\/|data:image\/(png|jpeg|webp);base64,)/.test(thumb)) ? thumb : (old.mapThumb || null),
                bans: bans, rev: rev, chunks: n, bytes: data.length, rawBytes: json.length,
                savedAt: firebase.database.ServerValue.TIMESTAMP, openedAt: old.openedAt || firebase.database.ServerValue.TIMESTAMP, v: 1
            });
            await mref.set(meta);
            if (old.rev && old.rev !== rev) D.ref(DATA + '/' + base + '/r/' + old.rev).remove().catch(() => {});
            st.last = h; st.lastAt = Date.now(); st.base = base; st.status = 'saved';
            console.log('💾 Servidor guardado en línea (' + base + ', ' + (data.length / 1048576).toFixed(2) + ' MB, ' + why + ')');
            return true;
        } catch (e) {
            st.status = 'error';
            // (si Firebase todavía no tiene las reglas de saved_servers / saved_worlds, no se vuelve a intentar en esta sesión)
            if (/permission/i.test(String(e && (e.code || e.message)))) { st.denied = true; console.warn('💾 Servidores guardados: Firebase no deja escribir en saved_servers / saved_worlds (faltan las reglas).'); }
            else console.warn('💾 saved server: upload failed', e);
            return false;
        } finally { st.busy = false; }
    }
    setInterval(function () {
        if (!canSave()) { if (!inMp()) { st.started = 0; } return; }
        const now = Date.now();
        if (curBase() !== st.base && !st.started) st.started = now;
        if (!st.started) st.started = now;
        if (st.lastAt === 0 || st.base !== curBase()) { if (now - st.started >= FIRST) saveNow('first'); return; }
        if (now - st.lastAt >= EVERY) saveNow('auto');
    }, 5000);
    // al salir del servidor (el anfitrión): se guarda antes de cerrar
    const origDisc = window.disconnectFromMultiplayer;
    if (typeof origDisc === 'function') {
        window.disconnectFromMultiplayer = function () {
            try { if (canSave()) saveNow('leave'); } catch (e) { /* nada */ }
            st.started = 0; st.lastAt = 0;
            return origDisc.apply(this, arguments);
        };
    }

    // ------------------------------------------------------------------ la lista
    let saved = null, watching = false;
    const listeners = [];
    function watch(cb) {
        if (cb && listeners.indexOf(cb) < 0) listeners.push(cb);
        const D = db(); if (!D || watching) return;
        watching = true;
        D.ref(META).on('value', function (snap) { saved = snap.val() || {}; listeners.forEach(f => { try { f(); } catch (e) { /* nada */ } }); },
            function () { saved = {}; watching = false; });   // (sin permiso para leer: no hay lista de guardados)
    }
    function friendsOf() { return (typeof misAmigosConfirmados !== 'undefined' && Array.isArray(misAmigosConfirmados)) ? misAmigosConfirmados : []; }
    function canSee(s) {
        const me = myUid();
        if (s.ownerUid === me) return true;
        if (s.bans && me && s.bans[me]) return false;
        if (s.access === 'private') return false;
        if (s.access === 'friends_only') return friendsOf().indexOf(s.ownerUid) >= 0;
        return true;
    }
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
    function html(active) {
        watch();
        if (!saved) return '';
        const live = {}; Object.keys(active || {}).forEach(id => { live[baseId(id)] = id; });
        const me = myUid(), now = Date.now();
        let out = '', count = 0;
        Object.keys(saved).sort((a, b) => Number(saved[b].savedAt || 0) - Number(saved[a].savedAt || 0)).forEach(function (k) {
            const s = saved[k];
            if (!s || !okKey(k) || !s.rev) return;
            if (live[k]) return;                                    // está abierto ahora: sale arriba como siempre
            if (now - Number(s.openedAt || s.savedAt || now) > EXPIRE) { removeSaved(k, s, true); return; }
            if (!canSee(s)) return;
            const mine = s.ownerUid === me;
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
                            <span class="ss-sub">${esc(tr('ss_owner', 'Created by {name}', { name: s.ownerName || 'Player' }))} · ${esc(tr('ss_saved_ago', 'saved {when}', { when: ago(s.savedAt) }))}${mb >= .05 ? ' · ' + mb.toFixed(1) + ' MB' : ''}</span>
                            ${desc}
                        </div>
                    </div>
                    <div class="ss-right">
                        <span class="ss-max">0/${Number(s.max) | 0}</span>
                        ${mine ? `<button type="button" class="ss-del" data-ss="${esc(k)}" title="${esc(tr('ss_delete', 'Delete'))}">🗑</button>` : ''}
                        <button type="button" class="ss-open" data-ss="${esc(k)}">${esc(tr('ss_open', 'OPEN'))}</button>
                    </div>
                </div>`;
        });
        if (!count) return '';
        return `<div class="ss-head">💾 ${esc(tr('ss_title', 'Saved servers (nobody is playing: open one to be the host)'))}</div>` + out;
    }
    function bind(root) {
        if (!root) return;
        root.querySelectorAll('.ss-open').forEach(b => b.addEventListener('click', () => openSaved(b.getAttribute('data-ss'))));
        root.querySelectorAll('.ss-del').forEach(b => b.addEventListener('click', () => {
            const k = b.getAttribute('data-ss'), s = saved && saved[k];
            if (!s || s.ownerUid !== myUid()) return;
            if (!confirm(tr('ss_delete_confirm', 'Delete this saved server? The world saved online will be lost (your own copies are not touched).'))) return;
            removeSaved(k, s, false);
        }));
    }
    function removeSaved(k, s, quiet) {
        const D = db(); if (!D || !okKey(k)) return Promise.resolve();
        return Promise.all([D.ref(DATA + '/' + k).remove(), D.ref(META + '/' + k).remove()]).catch(e => { if (!quiet) console.warn('💾 delete', e); });
    }

    // ------------------------------------------------------------------ abrirlo (yo paso a ser el anfitrión)
    const op = { busy: false };
    async function openSaved(k) {
        const D = db(); if (!D || !okKey(k) || op.busy) return false;
        const s = saved && saved[k];
        if (!s || !s.rev) return false;
        if (!canSee(s)) return false;
        // ¿alguien lo abrió hace un momento? Entonces se entra a ese
        const act = window.__mbwLastServers || {};
        const liveId = Object.keys(act).find(id => baseId(id) === k);
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
                if (cur && cur.uid !== me && Date.now() - Number(cur.at || 0) < LOCK_MS) return;   // (lo está abriendo otro)
                return { uid: me, name: myName().slice(0, 40), at: Date.now() };
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
            await window.loadWorldFromJson(json, fname);
            await new Promise(r => setTimeout(r, 300));
            // mismos ajustes que tenía; yo soy el anfitrión
            window.mpSelectedMapName = meta.mapName || 'World';
            window.mpSelectedMapThumb = meta.mapThumb || null;
            window.mpSelectedMapData = null;
            window.multiplayerAccess = meta.access || 'public';
            window.multiplayerPlayerLimit = Math.max(2, Math.min(6, Number(meta.max) || 5));
            const gen = (Number(meta.gen) || 0) + 1 + Math.floor(Math.random() * 1000);
            st.last = null; st.lastAt = 0; st.started = 0;
            window.hostMultiplayerSession({
                peerId: k + '-m' + gen, gen: gen, perms: meta.perms || {}, levels: meta.levels || {}, persist: true, desc: meta.desc || '',
                owner: { uid: meta.ownerUid, name: meta.ownerName }
            });
            if (meta.permWorld) window.mpPermWorldKey = meta.permWorld;
            if (typeof window.mpMarkServerTab === 'function') { try { window.mpMarkServerTab(); } catch (e) { /* nada */ } }
            D.ref(META + '/' + k + '/openedAt').set(firebase.database.ServerValue.TIMESTAMP).catch(() => {});
            // (cuando ya está en la lista de abiertos, se suelta el candado)
            const t0 = Date.now();
            const iv = setInterval(() => { if ((window.currentRoomId && baseId(window.currentRoomId) === k) || Date.now() - t0 > 20000) { clearInterval(iv); lockRef.remove().catch(() => {}); } }, 500);
            if (typeof setMpView === 'function') { try { setMpView('create-setup'); } catch (e) { /* nada */ } }
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

    // ------------------------------------------------------------------ dejar de guardarlo (ajustes del servidor)
    function setPersist(on) {
        window.mpPersist = !!on;
        try { if (typeof enviarMensajeEnRed === 'function' && typeof window.mpHostCfg === 'function') enviarMensajeEnRed({ tipo: 'room_cfg', cfg: window.mpHostCfg() }); } catch (e) { /* nada */ }
        if (on) { st.last = null; st.lastAt = 0; st.started = Date.now() - FIRST; }
        else { const k = curBase(); if (okKey(k) && saved && saved[k] && (saved[k].ownerUid === myUid() || amHost())) removeSaved(k, saved[k], true); }
    }

    window.mbwSavedServers = { watch: watch, html: html, bind: bind, open: openSaved, save: saveNow, remove: removeSaved, setPersist: setPersist, state: st, pack: pack, unpack: unpack, list: () => saved };
})();
