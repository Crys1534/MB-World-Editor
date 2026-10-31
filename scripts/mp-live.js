// ==========================================================
// 👥 MULTIJUGADOR EN VIVO (va después de scripts/multiplayer.js)
//
//  · La pestaña del servidor: el mundo del servidor es UNA pestaña. Si cierras esa pestaña, sales del servidor.
//    Si te cambias a otra pestaña (otro mundo), lo que hagas ahí no se manda, y lo que hagan los demás se guarda
//    y se aplica cuando regresas a la pestaña del servidor.
//  · Permisos: el anfitrión decide quién puede EDITAR el mundo. Los que entran solo pueden VER
//    (mirar, seleccionar, espectear), hasta que el anfitrión les da permiso.
//  · Cámaras: cada jugador avisa dónde está mirando. Espectear sigue la CÁMARA del otro (no su cursor, que mareaba),
//    y el clic derecho en su foto (arriba) te lleva a donde está mirando.
//  · Selecciones: todos ven lo que los demás seleccionan con Select, Free form y Magic wand (con el color de cada quien).
// ==========================================================
(function () {
    'use strict';
    const L = window.mbwLive = { cams: {}, sels: {}, queue: [], lastCan: null, noticeAt: 0, sentAway: false, lastCamKey: '', lastCamAt: 0, lastSelSig: '', lastSelAt: 0 };

    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function $(id) { return document.getElementById(id); }
    function tabs() { return (typeof WorldTabsManager !== 'undefined' && WorldTabsManager && Array.isArray(WorldTabsManager.openWorlds)) ? WorldTabsManager : null; }
    function inMp() { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; }
    function amHost() { return typeof isHost !== 'undefined' && !!isHost; }
    function myPeerId() { try { return (typeof peer !== 'undefined' && peer) ? peer.id : null; } catch (e) { return null; } }
    function myUid() { return localStorage.getItem('mbw_uid'); }
    function myName() { return localStorage.getItem('mbw_username') || 'Player'; }
    function players() { return Array.isArray(window.roomPlayers) ? window.roomPlayers : []; }
    function playerByPeer(id) { return players().find(p => p.peerId === id) || null; }
    function dirty() { /* cursores, selecciones y marcos se pintan solos en cada cuadro; los bloques se rehacen solos si la cámara se mueve */ }
    function toast(title, body) {
        if (typeof window.mpToast === 'function') window.mpToast(title, body || '');
        else if (typeof showDesktopNotification === 'function') showDesktopNotification(title, body || '', 'assets/default pfp.png');
    }
    function curScene() { return (typeof mbwom !== 'undefined' && mbwom.currentScene) || 1; }

    // Color de cada jugador (siempre el mismo para el mismo nombre): cursor, selección y su nombre
    window.mpPlayerColor = function (name, alpha) {
        let h = 0; const s = String(name || '?');
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        const hue = (h * 47) % 360;
        return alpha === undefined ? 'hsl(' + hue + ', 85%, 62%)' : 'hsla(' + hue + ', 85%, 62%, ' + alpha + ')';
    };

    // ------------------------------------------------------------------ la pestaña del servidor
    window.mpWorldTabId = null;
    window.mpMarkServerTab = function () {
        const T = tabs();
        window.mpWorldTabId = T ? T.activeWorldId : null;
        L.queue = [];
        paintTabs();
        paintPills();
    };
    // ¿Estoy viendo el mundo del servidor? (si no hay servidor, o no se sabe cuál es, se cuenta como que sí)
    window.mpOnServerTab = function () {
        if (!inMp() || !window.mpWorldTabId) return true;
        const T = tabs();
        if (!T || !T.openWorlds.some(w => w.id === window.mpWorldTabId)) return true;
        return T.activeWorldId === window.mpWorldTabId;
    };
    // Lo que llega del servidor mientras veo otra pestaña se guarda (se aplica al volver)
    window.mpQueueIfAway = function (d) {
        if (window.mpOnServerTab()) return false;
        L.queue.push(d);
        return true;
    };
    // Hace algo con el mundo del servidor aunque se esté viendo otra pestaña (por ejemplo, mandarle el mapa a alguien que entra)
    window.mpWithServerTab = function (fn) {
        const T = tabs();
        if (!T || window.mpOnServerTab()) return fn();
        const back = T.activeWorldId;
        try { T.switchWorld(window.mpWorldTabId); return fn(); }
        finally { if (T.openWorlds.some(w => w.id === back)) T.switchWorld(back); }
    };
    function replayQueue() {
        if (!L.queue.length || !window.mpOnServerTab()) return;
        const q = L.queue; L.queue = [];
        q.forEach(d => { try { recibirMensajeDeRed(d); } catch (e) { console.error('mp replay:', e); } });
        dirty();
    }
    function paintTabs() {
        document.querySelectorAll('#world-tabs .world-tab').forEach(el => el.classList.remove('mp-server-tab'));
        const T = tabs();
        if (!T || !inMp() || !window.mpWorldTabId) return;
        const i = T.openWorlds.findIndex(w => w.id === window.mpWorldTabId);
        const el = document.querySelectorAll('#world-tabs .world-tab')[i];
        if (el) { el.classList.add('mp-server-tab'); el.title = tr('mp_server_tab', 'This world is the server'); }
    }
    function leaveBecauseClosed(wasHost) {
        if (typeof window.disconnectFromMultiplayer === 'function') window.disconnectFromMultiplayer(true);
        if (window.mbwServerWizard && typeof window.mbwServerWizard.onView === 'function') { try { window.mbwServerWizard.sel = null; } catch (e) { /* nada */ } }
        toast('🚪 ' + tr('mp_left_title', 'Left the server'), wasHost
            ? tr('mp_left_closed_host', "You closed the server's world, so the server was closed.")
            : tr('mp_left_closed_guest', "You closed the server's world, so you left the server."));
    }
    function hookTabs() {
        const T = tabs();
        if (!T || T.__mpHooked) return !!T;
        T.__mpHooked = true;
        const sw = T.switchWorld;
        T.switchWorld = function () {
            const r = sw.apply(this, arguments);
            if (inMp() && window.mpWorldTabId && this.activeWorldId === window.mpWorldTabId) {
                replayQueue();
                if (typeof window.mpResetWorldWatch === 'function') window.mpResetWorldWatch();
            }
            L.lastCamKey = ''; L.lastSelSig = '';            // se avisa enseguida dónde estoy
            paintPills();
            return r;
        };
        const cw = T.closeWorld;
        T.closeWorld = function (id) {
            const was = inMp() && !!window.mpWorldTabId && id === window.mpWorldTabId, host = amHost();
            const r = cw.apply(this, arguments);
            if (was) leaveBecauseClosed(host);
            return r;
        };
        const rt = T.renderTabs;
        T.renderTabs = function () { const r = rt.apply(this, arguments); paintTabs(); return r; };
        return true;
    }
    if (!hookTabs()) document.addEventListener('DOMContentLoaded', hookTabs);

    // Al salir del servidor (por lo que sea) se olvida todo esto
    window.mpLiveReset = function () {
        window.mpWorldTabId = null;
        L.queue = []; L.cams = {}; L.sels = {}; L.lastCan = null; L.sentAway = false; L.lastCamKey = ''; L.lastSelSig = '';
        document.body.classList.remove('is-spectating');
        paintTabs(); paintPills(); dirty();
    };
    window.mpForgetPeer = function (peerId) {
        delete L.cams[peerId]; delete L.sels[peerId];
        if (window.networkCursors) delete window.networkCursors[peerId];
        dirty();
    };

    // ------------------------------------------------------------------ permisos
    // ¿Puedo cambiar el mundo? Sí, si no estoy en un servidor, si soy el anfitrión, si estoy viendo otra pestaña,
    // o si el anfitrión me dio permiso.
    window.mpCanEdit = function () {
        if (!inMp() || amHost()) return true;
        if (!window.mpOnServerTab()) return true;
        const me = players().find(p => p.uid === myUid());
        return !!(me && me.canEdit);
    };
    // (anfitrión) dar o quitar el permiso de editar
    window.mpSetCanEdit = function (uid, can) {
        if (!amHost() || !uid) return;
        window.mpEditPerms = window.mpEditPerms || {};
        window.mpEditPerms[uid] = !!can;
        const p = players().find(x => x.uid === uid);
        if (p) p.canEdit = !!can;
        if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'sync_players', players: window.roomPlayers });
        if (typeof window.renderLivePlayers === 'function') window.renderLivePlayers();
        const nm = p ? p.name : 'Player';
        toast(can ? '✏️ ' + tr('mp_perm_title', 'Permissions') : '👁 ' + tr('mp_perm_title', 'Permissions'),
            can ? tr('mp_perm_given', '{name} can now edit the world.', { name: nm }) : tr('mp_perm_removed', '{name} can now only watch.', { name: nm }));
    };
    window.mpViewOnlyNotice = function () {
        const now = Date.now();
        if (now - L.noticeAt < 4000) return;
        L.noticeAt = now;
        toast('👁 ' + tr('mp_view_only', 'View only'), tr('mp_view_only_tip', "The host hasn't let you edit this world yet. You can look around, select and spectate."));
        const pill = $('mp-pill-view');
        if (pill) { pill.classList.remove('mp-pill-flash'); void pill.offsetWidth; pill.classList.add('mp-pill-flash'); }
    };
    window.mpAfterPlayersSync = function () {
        // ¿cambió mi permiso?
        if (inMp() && !amHost()) {
            const me = players().find(p => p.uid === myUid());
            const can = !!(me && me.canEdit);
            if (L.lastCan !== null && can !== L.lastCan) {
                toast(can ? '✏️ ' + tr('mp_perm_title', 'Permissions') : '👁 ' + tr('mp_perm_title', 'Permissions'),
                    can ? tr('mp_can_edit_now', 'The host let you edit the world!') : tr('mp_view_now', 'Now you can only watch this world.'));
            }
            L.lastCan = can;
        }
        // los que ya no están: fuera su cursor, su cámara y su selección
        const here = new Set(players().map(p => p.peerId));
        Object.keys(L.cams).forEach(id => { if (!here.has(id)) delete L.cams[id]; });
        Object.keys(L.sels).forEach(id => { if (!here.has(id)) delete L.sels[id]; });
        if (window.networkCursors) Object.keys(window.networkCursors).forEach(id => { if (!here.has(id)) delete window.networkCursors[id]; });
        if (window.spectatingTargetId && !here.has(window.spectatingTargetId)) stopSpectating(true);
        paintPills(); dirty();
    };

    // Bloqueos para quien solo puede ver (y mientras se espectea): el lienzo solo deja mirar, seleccionar y la vista de relación de aspecto
    const VIEW_TOOLS = ['select', 'lasso', 'magic', 'aspect'];
    function viewOnly() { return !window.mpCanEdit(); }
    function onCanvas(e) { return !!e.target && (e.target.id === 'canvas'); }
    function tool() { return typeof currentTool !== 'undefined' ? currentTool : ''; }
    window.addEventListener('mousedown', function (e) {
        if (!onCanvas(e) || !inMp()) return;
        if (window.spectatingTargetId) { e.stopImmediatePropagation(); e.preventDefault(); return; }   // viendo a otro: solo se mira
        if (!viewOnly()) return;
        if (e.button === 0 && VIEW_TOOLS.indexOf(tool()) >= 0) return;
        e.stopImmediatePropagation(); e.preventDefault();
        window.mpViewOnlyNotice();
    }, true);
    window.addEventListener('dblclick', function (e) {
        if (!onCanvas(e) || !inMp() || (!viewOnly() && !window.spectatingTargetId)) return;
        e.stopImmediatePropagation(); e.preventDefault();
    }, true);
    window.addEventListener('keydown', function (e) {
        if (!inMp() || !viewOnly()) return;
        const t = e.target, tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
        const ctrl = e.ctrlKey || e.metaKey;
        if (e.code === 'Delete' || (ctrl && ['KeyZ', 'KeyY', 'KeyX', 'KeyV'].indexOf(e.code) >= 0)) {
            e.stopImmediatePropagation(); e.preventDefault();
            window.mpViewOnlyNotice();
        }
    }, true);
    // Lo que cambia el mundo desde botones y menús (rellenar, pegar, borrar, deshacer, cofres, letreros...)
    function guard(name, netArg) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__mpGuard) return;
        const g = function () {
            const fromNet = netArg !== undefined && arguments[netArg] === true;
            if (!fromNet && inMp() && viewOnly()) { window.mpViewOnlyNotice(); return; }
            return orig.apply(this, arguments);
        };
        g.__mpGuard = true;
        window[name] = g;
    }
    function guardAll() {
        guard('deleteSelection', 0);
        guard('cutSelection');
        guard('performPaste', 3);
        guard('bucketFill', 2);
        guard('fillSelectionWithBucket');
        guard('buildPixelArtInWorld');
        guard('openChestEditor');
        guard('openSignEditor');
        guard('openMobFromWorld');
        guard('pasteMobFromClipboard');
        if (typeof historyManager !== 'undefined' && historyManager && !historyManager.__mpGuard) {
            historyManager.__mpGuard = true;
            ['undo', 'redo'].forEach(k => {
                const o = historyManager[k];
                if (typeof o !== 'function') return;
                historyManager[k] = function () {
                    if (inMp() && viewOnly()) { window.mpViewOnlyNotice(); return; }
                    return o.apply(this, arguments);
                };
            });
        }
    }
    guardAll();
    window.addEventListener('load', guardAll);

    // ------------------------------------------------------------------ cámaras
    window.mpOnCamera = function (d) {
        if (!d || !d.peerId) return;
        L.cams[d.peerId] = { x: Number(d.x), y: Number(d.y), z: d.z, s: Number(d.s) || 1, away: !!d.away, name: d.autor || '', t: Date.now() };
        dirty();
    };
    function viewSize() { return { w: canvas.width / tileSize, h: canvas.height / tileSize }; }
    setInterval(function () {
        if (!inMp() || window.mpMapDownload || !myPeerId() || typeof enviarMensajeEnRed !== 'function') return;
        if (!window.mpOnServerTab()) {
            if (!L.sentAway) { enviarMensajeEnRed({ tipo: 'camara', peerId: myPeerId(), autor: myName(), away: true }); L.sentAway = true; L.lastCamKey = ''; }
            return;
        }
        if (typeof mbwom === 'undefined' || !mbwom.scene || typeof camera === 'undefined' || !(tileSize > 0)) return;
        const v = viewSize();
        const x = Math.round((camera.x + v.w / 2) * 100) / 100, y = Math.round((camera.y + v.h / 2) * 100) / 100;
        const z = typeof currentZoomIndex !== 'undefined' ? currentZoomIndex : 8, s = curScene();
        const key = x + ',' + y + ',' + z + ',' + s;
        const now = Date.now();
        if (key === L.lastCamKey && now - L.lastCamAt < 2500 && !L.sentAway) return;
        L.lastCamKey = key; L.lastCamAt = now; L.sentAway = false;
        enviarMensajeEnRed({ tipo: 'camara', peerId: myPeerId(), autor: myName(), x: x, y: y, z: z, s: s });
    }, 110);

    // Pone la cámara para que el centro de la vista quede en (cx, cy) de la dimensión s
    function centerOn(cx, cy, s, zoomIndex) {
        if (typeof mbwom === 'undefined' || !mbwom.world) return false;
        if (s && s !== curScene() && mbwom.world['scene' + s] && typeof changeDimension === 'function') changeDimension(s);
        if (zoomIndex !== undefined && zoomIndex !== null && typeof currentZoomIndex !== 'undefined' && zoomIndex !== currentZoomIndex
            && !(window.mbwAspect && window.mbwAspect.active) && typeof updateZoomSlider === 'function') updateZoomSlider(zoomIndex);
        const v = viewSize();
        let nx = cx - v.w / 2, ny = cy - v.h / 2;
        if (!window.smoothScroll) { nx = Math.round(nx); ny = Math.round(ny); }
        camera.x = nx; camera.y = ny; camera._tx = nx; camera._ty = ny; camera.velX = 0; camera.velY = 0;
        dirty();
        return true;
    }

    // ------------------------------------------------------------------ espectear
    // Sigue la CÁMARA del otro jugador (lo que él está viendo), con su zoom y su dimensión. Lo llama scripts/input.js
    // en cada cuadro mientras se espectea; si devuelve true, el teclado no mueve la cámara.
    window.mpSpectateStep = function (fs) {
        const id = window.spectatingTargetId;
        if (!id) return false;
        if (!inMp()) { window.spectatingTargetId = null; document.body.classList.remove('is-spectating'); paintPills(); return false; }
        if (!playerByPeer(id)) { stopSpectating(true); return false; }
        const cam = L.cams[id];
        if (!cam || cam.away || !isFinite(cam.x) || !isFinite(cam.y)) return true;     // todavía no se sabe dónde mira (o está en otro mundo): la cámara se queda quieta
        if (cam.s && cam.s !== curScene()) { centerOn(cam.x, cam.y, cam.s, cam.z); return true; }
        if (cam.z !== undefined && typeof currentZoomIndex !== 'undefined' && cam.z !== currentZoomIndex && !(window.mbwAspect && window.mbwAspect.active)) updateZoomSlider(cam.z);
        const v = viewSize();
        const tx = cam.x - v.w / 2, ty = cam.y - v.h / 2;
        if (!window.smoothScroll) {
            const rx = Math.round(tx), ry = Math.round(ty);
            if (rx !== camera.x || ry !== camera.y) { camera.x = rx; camera.y = ry; dirty(); }
            return true;
        }
        const dx = tx - camera.x, dy = ty - camera.y;
        if (Math.abs(dx) > 80 || Math.abs(dy) > 80) { camera.x = tx; camera.y = ty; }
        else {
            const f = 1 - Math.pow(0.8, fs || 1);                 // se acerca suave (sin brincos aunque los avisos lleguen de a poquito)
            camera.x += dx * f; camera.y += dy * f;
            if (Math.abs(tx - camera.x) * tileSize < 0.3) camera.x = tx;
            if (Math.abs(ty - camera.y) * tileSize < 0.3) camera.y = ty;
        }
        camera._tx = camera.x; camera._ty = camera.y; camera.velX = 0; camera.velY = 0;
        if (dx || dy) dirty();
        return true;
    };
    function stopSpectating(targetLeft) {
        const id = window.spectatingTargetId;
        if (!id) return;
        const p = playerByPeer(id);
        if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'spectator_update', targetPeer: id, spectatorName: myName(), spectating: false });
        window.spectatingTargetId = null;
        document.body.classList.remove('is-spectating');
        if (targetLeft) toast('👁 ' + tr('mp_spec_title', 'Spectator mode'), tr('mp_spec_left', '{name} left the server.', { name: (p && p.name) || (L.cams[id] && L.cams[id].name) || 'Player' }));
        if (typeof window.renderLivePlayers === 'function') window.renderLivePlayers();
        paintPills(); dirty();
    }
    window.mpStopSpectating = function () { stopSpectating(false); };
    // Clic en la foto de un jugador (arriba): empezar o dejar de espectearlo. Al dejarlo, la cámara se queda donde está.
    window.toggleSpectatorMode = function (targetPeerId, targetName) {
        if (!inMp() || !targetPeerId) return;
        if (targetPeerId === myPeerId()) return;
        if (window.spectatingTargetId === targetPeerId) { stopSpectating(false); return; }
        if (window.mySpectators && window.mySpectators.has(targetName)) {     // si él ya me está viendo a mí, se haría un círculo
            toast('🚫 ' + tr('mp_spec_title', 'Spectator mode'), tr('mp_spec_loop', '{name} is already spectating you.', { name: targetName }));
            return;
        }
        if (window.spectatingTargetId) stopSpectating(false);
        window.spectatingTargetId = targetPeerId;
        document.body.classList.add('is-spectating');
        if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'spectator_update', targetPeer: targetPeerId, spectatorName: myName(), spectating: true });
        const cam = L.cams[targetPeerId];
        if (cam && !cam.away) centerOn(cam.x, cam.y, cam.s, cam.z);           // de una vez donde está mirando (luego lo sigue suave)
        if (typeof isDraggingMob !== 'undefined' && isDraggingMob) { isDraggingMob = false; draggedMob = null; }
        if (typeof mouse !== 'undefined') { mouse.left = false; mouse.right = false; }
        toast('👁 ' + tr('mp_spec_title', 'Spectator mode'), tr('mp_spec_start', "You're following {name}'s camera.", { name: targetName }));
        if (typeof window.renderLivePlayers === 'function') window.renderLivePlayers();
        paintPills();
    };
    // Clic DERECHO en la foto de un jugador: la cámara va a donde él está mirando (una sola vez, sin seguirlo)
    window.mpGoToPlayer = function (peerId) {
        if (!inMp() || !peerId) return;
        const p = playerByPeer(peerId);
        const name = (p && p.name) || 'Player';
        if (window.spectatingTargetId) stopSpectating(false);
        const cam = L.cams[peerId];
        let ok = false;
        if (cam && !cam.away && isFinite(cam.x)) ok = centerOn(cam.x, cam.y, cam.s, cam.z);
        else {
            const cur = window.networkCursors && window.networkCursors[peerId];
            if (cur && isFinite(cur.x)) ok = centerOn(cur.x + 0.5, cur.y + 0.5, cur.scene || curScene());
        }
        if (ok) toast('📍 ' + name, tr('mp_goto_done', 'Camera moved to {name}.', { name: name }));
        else toast('📍 ' + name, cam && cam.away ? tr('mp_goto_away', '{name} is looking at another world right now.', { name: name }) : tr('mp_goto_none', "We don't know where {name} is yet.", { name: name }));
    };

    // ------------------------------------------------------------------ selecciones de los demás
    function selSig(sel) {
        if (!sel || !sel.type) return 'none';
        const p1 = sel.p1 ? sel.p1.x + ':' + sel.p1.y : '', p2 = sel.p2 ? sel.p2.x + ':' + sel.p2.y : '';
        const pts = sel.points || [], path = sel.path || [], subs = sel.subRects || [];
        const lastPt = pts.length ? pts[pts.length - 1].x + ':' + pts[pts.length - 1].y : '';
        const lastPath = path.length ? path[path.length - 1].x + ':' + path[path.length - 1].y : '';
        return [sel.type, p1, p2, subs.length, path.length, lastPath, pts.length, lastPt, sel.dragging ? 1 : 0].join('|');
    }
    function packSel(sel) {
        if (!sel || !sel.type) return null;
        if (sel.type === 'magic') {
            const pts = sel.points || [];
            if (!pts.length) return null;
            // en filas: [y, x desde, x hasta] (mucho más corto que mandar cada cuadro)
            const rows = new Map();
            pts.forEach(p => { let a = rows.get(p.y); if (!a) rows.set(p.y, a = []); a.push(p.x); });
            const runs = [];
            rows.forEach((xs, y) => {
                xs.sort((a, b) => a - b);
                let s = xs[0], e = xs[0];
                for (let i = 1; i < xs.length; i++) { if (xs[i] === e + 1) e = xs[i]; else if (xs[i] !== e) { runs.push([y, s, e]); s = e = xs[i]; } }
                runs.push([y, s, e]);
            });
            return { t: 'magic', runs: runs };
        }
        if (sel.type === 'poly') {
            const path = sel.path || [];
            if (path.length < 2) return null;
            return { t: 'poly', path: path.map(p => [p.x, p.y]), open: !!sel.dragging };
        }
        const rects = (sel.subRects || []).map(r => [r.p1.x, r.p1.y, r.p2.x, r.p2.y]);
        if (sel.p1 && sel.p2) rects.push([sel.p1.x, sel.p1.y, sel.p2.x, sel.p2.y]);
        if (!rects.length) return null;
        return { t: 'rect', r: rects };
    }
    setInterval(function () {
        if (!inMp() || window.mpMapDownload || !myPeerId() || typeof enviarMensajeEnRed !== 'function') return;
        const onTab = window.mpOnServerTab();
        const sig = onTab ? selSig(window.selection) + '|' + curScene() : 'away';
        if (sig === L.lastSelSig) return;
        L.lastSelSig = sig;
        enviarMensajeEnRed({ tipo: 'seleccion', peerId: myPeerId(), autor: myName(), s: curScene(), sel: onTab ? packSel(window.selection) : null });
    }, 150);

    // Lo que llega: se arma una sola vez el dibujo (en coordenadas del mundo) para pintarlo rápido en cada cuadro
    window.mpOnSelection = function (d) {
        if (!d || !d.peerId) return;
        if (!d.sel) { delete L.sels[d.peerId]; dirty(); return; }
        const shape = buildShape(d.sel);
        if (!shape) { delete L.sels[d.peerId]; dirty(); return; }
        L.sels[d.peerId] = { name: d.autor || 'Player', s: Number(d.s) || 1, shape: shape };
        dirty();
    };
    // y = -fila (en el lienzo, más arriba = número más grande)
    function buildShape(sel) {
        const fill = new Path2D(), line = new Path2D();
        let minX = Infinity, maxY = -Infinity;
        if (sel.t === 'rect' && Array.isArray(sel.r)) {
            sel.r.forEach(r => {
                const x1 = Math.min(r[0], r[2]), x2 = Math.max(r[0], r[2]), y1 = Math.min(r[1], r[3]), y2 = Math.max(r[1], r[3]);
                fill.rect(x1, -(y2 + 1), x2 - x1 + 1, y2 - y1 + 1);
                line.rect(x1, -(y2 + 1), x2 - x1 + 1, y2 - y1 + 1);
                minX = Math.min(minX, x1); maxY = Math.max(maxY, y2 + 1);
            });
        } else if (sel.t === 'poly' && Array.isArray(sel.path) && sel.path.length > 1) {
            sel.path.forEach((p, i) => { if (i) line.lineTo(p[0], -p[1]); else line.moveTo(p[0], -p[1]); minX = Math.min(minX, p[0]); maxY = Math.max(maxY, p[1]); });
            if (!sel.open && sel.path.length > 2) {
                sel.path.forEach((p, i) => { if (i) fill.lineTo(p[0], -p[1]); else fill.moveTo(p[0], -p[1]); });
                fill.closePath(); line.closePath();
            }
        } else if (sel.t === 'magic' && Array.isArray(sel.runs) && sel.runs.length) {
            const cells = new Set();
            sel.runs.forEach(r => { for (let x = r[1]; x <= r[2]; x++) cells.add(x + ',' + r[0]); });
            sel.runs.forEach(r => {
                const y = r[0];
                fill.rect(r[1], -(y + 1), r[2] - r[1] + 1, 1);
                minX = Math.min(minX, r[1]); maxY = Math.max(maxY, y + 1);
                for (let x = r[1]; x <= r[2]; x++) {
                    if (!cells.has((x + 1) + ',' + y)) { line.moveTo(x + 1, -y); line.lineTo(x + 1, -(y + 1)); }
                    if (!cells.has((x - 1) + ',' + y)) { line.moveTo(x, -y); line.lineTo(x, -(y + 1)); }
                    if (!cells.has(x + ',' + (y + 1))) { line.moveTo(x, -(y + 1)); line.lineTo(x + 1, -(y + 1)); }
                    if (!cells.has(x + ',' + (y - 1))) { line.moveTo(x, -y); line.lineTo(x + 1, -y); }
                }
            });
        } else return null;
        if (!isFinite(minX)) return null;
        return { fill: fill, line: line, labelX: minX, labelY: maxY, poly: sel.t === 'poly' };
    }
    // Lo llama main.js en cada cuadro (después de lo propio y antes de los cursores)
    window.mpDrawRemoteSelections = function (ctx) {
        if (!inMp() || !window.mpOnServerTab()) return;
        const ids = Object.keys(L.sels);
        if (!ids.length) return;
        const s = curScene(), ts = tileSize;
        ids.forEach(id => {
            const it = L.sels[id];
            if (!it || it.s !== s) return;
            const cam = L.cams[id];
            if (cam && cam.away) return;
            const col = window.mpPlayerColor(it.name), colA = window.mpPlayerColor(it.name, it.shape.poly ? 0.12 : 0.18);
            ctx.save();
            ctx.setTransform(ts, 0, 0, ts, -camera.x * ts, canvas.height + camera.y * ts);
            ctx.fillStyle = colA;
            ctx.fill(it.shape.fill);
            ctx.strokeStyle = col;
            ctx.lineWidth = 2 / ts;
            ctx.setLineDash([6 / ts, 4 / ts]);
            ctx.lineDashOffset = -(Date.now() / 60) / ts;
            ctx.stroke(it.shape.line);
            ctx.restore();
            // el nombre de quien seleccionó, arriba a la izquierda
            const sx = (it.shape.labelX - camera.x) * ts, sy = canvas.height - (it.shape.labelY - camera.y) * ts;
            ctx.save();
            ctx.font = "15px 'Pixeltype', sans-serif";
            const w = ctx.measureText(it.name).width + 10;
            ctx.fillStyle = col;
            ctx.fillRect(sx, sy - 17, w, 16);
            ctx.fillStyle = '#10131a';
            ctx.textBaseline = 'middle';
            ctx.fillText(it.name, sx + 5, sy - 9);
            ctx.restore();
        });
    };
    // ¿Se dibuja el cursor de ese jugador? (no si está en otra dimensión o viendo otro mundo)
    window.mpCursorVisible = function (key, cur) {
        if (!window.mpOnServerTab()) return false;
        const cam = L.cams[key];
        if (cam && cam.away) return false;
        if (cur && cur.scene && cur.scene !== curScene()) return false;
        return true;
    };

    // ------------------------------------------------------------------ avisos arriba del mundo ("Solo ver", "Viendo a ...")
    function paintPills() {
        let box = $('mp-pills');
        if (!box) {
            const ws = $('workspace');
            if (!ws) return;
            box = document.createElement('div');
            box.id = 'mp-pills';
            box.setAttribute('data-no-icons', '');
            ws.appendChild(box);
        }
        let h = '';
        if (inMp() && window.spectatingTargetId) {
            const p = playerByPeer(window.spectatingTargetId);
            const nm = (p && p.name) || 'Player';
            const cam = L.cams[window.spectatingTargetId];
            h += '<div class="mp-pill mp-pill-spec" style="--pc:' + window.mpPlayerColor(nm) + '"><span class="mp-pill-eye">' + (window.mbwIcon ? window.mbwIcon('eye') : '👁') + '</span>' +
                '<span>' + esc(tr('mp_spectating', 'Watching {name}', { name: nm })) + (cam && cam.away ? ' · ' + esc(tr('mp_spec_away', 'in another world')) : '') + '</span>' +
                '<button type="button" class="mp-pill-btn" onclick="mpStopSpectating()">' + esc(tr('mp_spec_stop', 'Stop')) + '</button></div>';
        }
        if (inMp() && !amHost() && window.mpWorldTabId && window.mpOnServerTab() && !window.mpCanEdit()) {
            h += '<div class="mp-pill mp-pill-view" id="mp-pill-view" title="' + esc(tr('mp_view_only_tip', "The host hasn't let you edit this world yet. You can look around, select and spectate.")) + '">' +
                '<span class="mp-pill-eye">' + (window.mbwIcon ? window.mbwIcon('eye') : '👁') + '</span><span>' + esc(tr('mp_view_only', 'View only')) + '</span></div>';
        }
        box.innerHTML = h;
        box.style.display = h ? '' : 'none';
    }
    window.mpPaintPills = paintPills;
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    // por si algo cambió sin aviso (permiso, pestaña...)
    let lastPillKey = '';
    setInterval(function () {
        const key = [inMp(), amHost(), window.mpWorldTabId, window.mpOnServerTab(), window.mpCanEdit(), window.spectatingTargetId, (L.cams[window.spectatingTargetId] || {}).away].join('|');
        if (key !== lastPillKey) { lastPillKey = key; paintPills(); paintTabs(); }
    }, 500);
    window.mpLiveOnLanguageChanged = function () { lastPillKey = ''; paintPills(); paintTabs(); };
})();
