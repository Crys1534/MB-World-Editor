// ==========================================================
// 💾 EL SERVIDOR PERMANENTE DE CRYSTAL (va después de scripts/mp-mod.js)
//
//  · Hay UN solo servidor guardado en línea, el de la dueña del editor (sus cuentas: OWNERS).
//  · Solo ella lo abre y solo ella es su anfitriona: si se va, el servidor se cierra para todos (no pasa a otro
//    jugador) y el mundo queda guardado. Los demás lo ven en la lista ("🔒 cerrado") y entran cuando ella lo abre.
//  · Mientras está abierto, se guarda en Firebase 15 s después de abrirlo, cada 2 minutos (si cambió) y al salir.
//    Jugando (Modo Jugar) se guarda lo que pasó jugando (menos en una prueba 🧪). Solo se guarda UNA copia.
//  · Cualquier servidor que ella abra se puede volver "su servidor permanente" con la casilla 💾
//    (menú del servidor o menú de pausa > Servidor). Abrirlo desde la lista ya lo trae puesto.
//
//  Firebase:  saved_servers/mbweCrystal = datos pequeños para la lista (nombre, foto, ajustes, rev...)
//             saved_worlds/mbweCrystal/r/<rev>/<n> = el mundo, comprimido (gzip) en pedazos de 512 KB
// ==========================================================
(function () {
    'use strict';
    const META = 'saved_servers', DATA = 'saved_worlds';
    const KEY = 'mbweCrystal';
    // las cuentas de Crystal (Web, APK, Local/Admin, PC, Tablet)
    const OWNERS = ['usr_7tsrn0vvl', 'usr_4dc3r36gm', 'usr_e6hrzt2ju', 'usr_1ryd13wnc', 'usr_l7jbkwc50'];
    const CHUNK = 512 * 1024;
    const EVERY = 2 * 60 * 1000;           // guardar como mucho cada 2 minutos
    const FIRST = 15 * 1000;               // primer guardado: 15 s después de abrirlo
    const LOCK_MS = 90 * 1000;

    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function db() { return typeof database !== 'undefined' && database ? database : null; }
    function inMp() { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; }
    function amHost() { return typeof isHost !== 'undefined' && !!isHost; }
    function myUid() { return localStorage.getItem('mbw_uid'); }
    function myName() { return localStorage.getItem('mbw_username') || 'Player'; }
    function owners() { return OWNERS.concat(Array.isArray(window.MBW_SAVED_OWNERS) ? window.MBW_SAVED_OWNERS : []); }
    function isOwner() { return owners().indexOf(myUid()) >= 0; }
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
    function canSave() {
        return !st.denied && isOwner() && !!window.mpOfficial && inMp() && amHost() && !!db() && typeof mbwom !== 'undefined' && !!mbwom.world;
    }
    function worldJson() {
        const F = fm(); if (!F || typeof F.prepareNetworkJson !== 'function') return null;
        window.__mbwSaveLive = true;
        try { const d = F.prepareNetworkJson(); return d && d.json; } finally { window.__mbwSaveLive = false; }
    }
    async function saveNow(why) {
        if (!canSave() || st.busy) return false;
        // (todo lo del mundo se toma AHORA, antes de esperar nada: si se está yendo, ya no estará después)
        let json;
        try { json = worldJson(); } catch (e) { console.warn('💾 saved server: world', e); return false; }
        if (!json) return false;
        const h = hash(json);
        if (h === st.last && why !== 'force') { st.lastAt = Date.now(); return false; }
        const bans = {}; try { const B = mbwom.world.mbweBans; if (B && typeof B === 'object') Object.keys(B).forEach(u => { if (/^[\w-]{4,40}$/.test(u)) bans[u] = true; }); } catch (e) { /* nada */ }
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
            for (let i = 0; i < n; i++) await D.ref(DATA + '/' + KEY + '/r/' + rev + '/' + i).set(data.slice(i * CHUNK, (i + 1) * CHUNK));
            const mref = D.ref(META + '/' + KEY);
            const old = (await mref.once('value')).val() || {};
            const meta = Object.assign({}, cfg, {
                ownerName: myName().slice(0, 40), ownerUid: myUid(),
                mapThumb: (thumb.length < 90000 && /^(assets\/|data:image\/(png|jpeg|webp);base64,)/.test(thumb)) ? thumb : (old.mapThumb || null),
                bans: bans, rev: rev, chunks: n, bytes: data.length, rawBytes: json.length,
                savedAt: firebase.database.ServerValue.TIMESTAMP, v: 2
            });
            await mref.set(meta);
            if (old.rev && old.rev !== rev) D.ref(DATA + '/' + KEY + '/r/' + old.rev).remove().catch(() => {});
            st.last = h; st.lastAt = Date.now(); st.status = 'saved';
            console.log('💾 Servidor permanente guardado en línea (' + (data.length / 1048576).toFixed(2) + ' MB, ' + why + ')');
            return true;
        } catch (e) {
            st.status = 'error';
            // (si Firebase todavía no tiene las reglas de saved_servers / saved_worlds, no se vuelve a intentar en esta sesión)
            if (/permission/i.test(String(e && (e.code || e.message)))) { st.denied = true; console.warn('💾 Servidor permanente: Firebase no deja escribir en saved_servers / saved_worlds (faltan las reglas).'); }
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
    // al salir del servidor: se guarda antes de cerrar
    const origDisc = window.disconnectFromMultiplayer;
    if (typeof origDisc === 'function') {
        window.disconnectFromMultiplayer = function () {
            try { if (canSave()) saveNow('leave'); } catch (e) { /* nada */ }
            st.started = 0; st.lastAt = 0; st.last = null;
            window.mpOfficial = false;
            return origDisc.apply(this, arguments);
        };
    }

    // ------------------------------------------------------------------ la lista de servidores
    let saved, watching = false;
    const listeners = [];
    function watch(cb) {
        if (cb && listeners.indexOf(cb) < 0) listeners.push(cb);
        const D = db(); if (!D || watching) return;
        watching = true;
        D.ref(META + '/' + KEY).on('value', function (snap) { saved = snap.val() || null; listeners.forEach(f => { try { f(); } catch (e) { /* nada */ } }); },
            function () { saved = null; watching = false; });   // (sin permiso para leer: no sale)
    }
    function friendsOf() { return (typeof misAmigosConfirmados !== 'undefined' && Array.isArray(misAmigosConfirmados)) ? misAmigosConfirmados : []; }
    function canSee(s) {
        if (isOwner()) return true;
        const me = myUid();
        if (s.bans && me && s.bans[me]) return false;
        if (s.access === 'private') return false;
        if (s.access === 'friends_only') return owners().some(u => friendsOf().indexOf(u) >= 0);
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
        const s = saved;
        if (!s || !s.rev) return '';
        if (Object.keys(active || {}).some(id => active[id] && active[id].official)) return '';   // está abierto ahora: sale arriba como siempre
        if (!canSee(s)) return '';
        const mine = isOwner();
        const raw = String(s.mapThumb || '');
        const thumb = /^(assets\/[\w\- .\/]+\.(png|jpg|jpeg|gif|webp)|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=]+)$/i.test(raw) ? raw : 'assets/Superflat World.png';
        const desc = s.desc ? `<span class="ss-desc">${esc(String(s.desc).slice(0, 120))}</span>` : '';
        const mb = (Number(s.bytes) || 0) / 1048576;
        const right = mine
            ? `<button type="button" class="ss-del" title="${esc(tr('ss_delete', 'Delete'))}">🗑</button><button type="button" class="ss-open">${esc(tr('ss_open', 'OPEN'))}</button>`
            : `<span class="ss-closed">🔒 ${esc(tr('ss_closed', 'Closed'))}</span>`;
        return `<div class="ss-head">💾 ${esc(mine ? tr('ss_title_mine', 'Your permanent server (open it to be the host)') : tr('ss_title', 'Permanent server'))}</div>
                <div class="ss-row">
                    <div class="ss-left">
                        <div class="ss-thumb" style="background-image: url(&quot;${esc(thumb)}&quot;);"></div>
                        <div style="min-width: 0;">
                            <strong class="ss-name">${esc(s.mapName || 'World')}</strong>
                            <span class="ss-sub">${esc(mine ? tr('ss_saved_ago', 'saved {when}', { when: ago(s.savedAt) }) + (mb >= .05 ? ' · ' + mb.toFixed(1) + ' MB' : '') : tr('ss_wait_owner', 'Opens when {name} comes in', { name: s.ownerName || 'Crystal' }))}</span>
                            ${desc}
                        </div>
                    </div>
                    <div class="ss-right"><span class="ss-max">0/${Number(s.max) | 0}</span>${right}</div>
                </div>`;
    }
    function bind(root) {
        if (!root) return;
        root.querySelectorAll('.ss-open').forEach(b => b.addEventListener('click', () => openSaved()));
        root.querySelectorAll('.ss-del').forEach(b => b.addEventListener('click', () => {
            if (!isOwner()) return;
            if (!confirm(tr('ss_delete_confirm', 'Delete your permanent server? The world saved online will be lost (your own copies are not touched).'))) return;
            removeSaved();
        }));
    }
    function removeSaved() {
        const D = db(); if (!D || !isOwner()) return Promise.resolve();
        return Promise.all([D.ref(DATA + '/' + KEY).remove(), D.ref(META + '/' + KEY).remove()]).catch(e => console.warn('💾 delete', e));
    }

    // ------------------------------------------------------------------ abrirlo (solo la dueña; ella es la anfitriona)
    const op = { busy: false };
    async function openSaved() {
        const D = db(); if (!D || !isOwner() || op.busy) return false;
        const s = saved;
        if (!s || !s.rev) return false;
        if (inMp()) {
            if (!confirm(tr('ss_leave_confirm', 'You are in a server. Leave it to open this one?'))) return false;
            try { window.disconnectFromMultiplayer(true); } catch (e) { /* nada */ }
        }
        op.busy = true;
        const me = myUid(), lockRef = D.ref(META + '/' + KEY + '/lock');
        try {
            // 🔒 (por si lo abre a la vez desde dos aparatos)
            const tx = await lockRef.transaction(function (cur) {
                if (cur && cur.uid !== me && Date.now() - Number(cur.at || 0) < LOCK_MS) return;
                return { uid: me, at: Date.now() };
            });
            if (!tx.committed) { alert(tr('ss_busy', 'It is being opened from another device right now. Try again in a moment.')); return false; }
            toast('💾 ' + tr('ss_opening', 'Downloading the world…'), String(s.mapName || ''));
            if (typeof updateLoadingBar === 'function') { const ov = document.getElementById('loading-overlay'); if (ov) ov.style.display = 'flex'; updateLoadingBar(5, tr('ss_opening', 'Downloading the world…')); }
            const meta = (await D.ref(META + '/' + KEY).once('value')).val() || s;
            const n = Math.max(1, Number(meta.chunks) || 1);
            let got = 0;
            const parts = await Promise.all(Array.from({ length: n }, (_, i) => D.ref(DATA + '/' + KEY + '/r/' + meta.rev + '/' + i).once('value').then(sn => {
                got++; if (typeof updateLoadingBar === 'function') updateLoadingBar(5 + Math.round(got / n * 15), tr('ss_opening', 'Downloading the world…'));
                return sn.val();
            })));
            if (parts.some(p => typeof p !== 'string')) throw new Error('missing pieces');
            const json = await unpack(parts.join(''));
            const fname = String(meta.mapName || 'World').replace(/[\\/:*?"<>|]/g, '_') + '.mbw';
            if (typeof window.loadWorldFromJson !== 'function') throw new Error('no loader');
            await window.loadWorldFromJson(json, fname);
            await new Promise(r => setTimeout(r, 300));
            window.mpSelectedMapName = meta.mapName || 'World';
            window.mpSelectedMapThumb = meta.mapThumb || null;
            window.mpSelectedMapData = null;
            window.multiplayerAccess = meta.access || 'public';
            window.multiplayerPlayerLimit = Math.max(2, Math.min(6, Number(meta.max) || 5));
            st.last = hash(json); st.lastAt = 0; st.started = 0;      // (recién bajado: no se vuelve a subir si nada cambia)
            window.hostMultiplayerSession({ perms: meta.perms || {}, levels: meta.levels || {}, desc: meta.desc || '', official: true });
            if (meta.permWorld) window.mpPermWorldKey = meta.permWorld;
            if (typeof window.mpMarkServerTab === 'function') { try { window.mpMarkServerTab(); } catch (e) { /* nada */ } }
            const t0 = Date.now();
            const iv = setInterval(() => { if ((window.currentRoomId && amHost()) || Date.now() - t0 > 20000) { clearInterval(iv); lockRef.remove().catch(() => {}); } }, 500);
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

    // ------------------------------------------------------------------ "este es mi servidor permanente" (casilla)
    function setOfficial(on) {
        if (!isOwner() || !amHost() || !inMp()) return false;
        on = !!on;
        if (on && saved && saved.rev && saved.mapName && saved.mapName !== window.mpSelectedMapName &&
            !confirm(tr('ss_replace_confirm', 'Your permanent server has the world "{name}". Replace it with this one?', { name: saved.mapName }))) return false;
        window.mpOfficial = on;
        try { if (window.myRoomRef) window.myRoomRef.update({ official: on ? true : null }); } catch (e) { /* nada */ }
        try { if (typeof enviarMensajeEnRed === 'function' && typeof window.mpHostCfg === 'function') enviarMensajeEnRed({ tipo: 'room_cfg', cfg: window.mpHostCfg() }); } catch (e) { /* nada */ }
        if (on) { st.last = null; st.lastAt = 0; st.started = Date.now(); saveNow('force'); }
        return true;
    }
    function checkboxRow(cls) {
        if (!isOwner() || !amHost() || !inMp()) return null;
        const lab = document.createElement('label'); lab.className = cls || 'ss-official';
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!window.mpOfficial;
        c.addEventListener('change', function () { if (!setOfficial(c.checked)) c.checked = !!window.mpOfficial; });
        const sp = document.createElement('span'); sp.textContent = '💾 ' + tr('ss_official', 'My permanent server (saved online)');
        lab.title = tr('ss_official_tip', 'Saved online every 2 minutes and when you leave. Only you can open it again from the server list, and only you are its host: when you leave, it closes for everyone.');
        lab.appendChild(c); lab.appendChild(sp);
        return lab;
    }

    window.mbwSavedServers = { watch: watch, html: html, bind: bind, open: openSaved, save: saveNow, remove: removeSaved, setOfficial: setOfficial, checkboxRow: checkboxRow, isOwner: isOwner, state: st, pack: pack, unpack: unpack, data: () => saved, KEY: KEY };
})();
