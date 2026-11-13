// ==========================================================
// 🔒 MAPAS DE SERVIDOR: SOLO PLAY Y TEST (va después de scripts/mp-live.js)
//
//  · Un mundo con el que se crea un SERVIDOR ("Create Server" o un servidor permanente) queda marcado para siempre
//    (mbweServerMap en el mundo): ya no se edita; solo funcionan Play y Test. Antes de crearlo se avisa.
//  · Las salas para editar juntos (invitar con "+", "Pedir entrar") NO son servidores: ahí se sigue editando.
//  · Al crear o abrir un servidor, el anfitrión entra solo al Modo Jugar; los demás, al entrar, también (scripts/mp-play.js).
// ==========================================================
(function () {
    'use strict';
    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    function W() { return (typeof mbwom !== 'undefined' && mbwom.world) ? mbwom.world : null; }
    function isMap() { const w = W(); return !!(w && w.mbweServerMap); }
    function locked() { return isMap() && !window.mbwPlaying; }
    const VIEW_TOOLS = ['select', 'lasso', 'magic', 'aspect', 'eyedropper'];
    function tool() { return typeof currentTool !== 'undefined' ? currentTool : ''; }

    let lastNotice = 0;
    function notice() {
        const now = Date.now(); if (now - lastNotice < 1500) return; lastNotice = now;
        const msg = '🔒 ' + tr('sm_locked_msg', 'This is a server map: it cannot be edited. Use Play or Test.');
        if (typeof window.flashToast === 'function') window.flashToast(msg);
        else if (typeof window.mpToast === 'function') window.mpToast('🔒', msg);
    }

    // ---------------------------------------------------------- avisar y marcar (al crear un servidor)
    function confirmLock() {
        if (isMap()) return true;
        return confirm(tr('sm_warn', 'This world will become a SERVER MAP:\n\n• From now on it can no longer be edited, only played (Play and Test).\n• This stays like that even after you close the server.\n\nTip: if you want to keep editing it, make a copy first (File > Save As).\n\nCreate the server?'));
    }
    function lockWorld() {
        const w = W(); if (!w || w.mbweServerMap) return;
        w.mbweServerMap = true;
        try { if (typeof worldDirty !== 'undefined') worldDirty = true; } catch (e) { /* nada */ }
        try { const F = window.fileManager || (typeof fileManager !== 'undefined' ? fileManager : null); if (F && F.saveLocal) F.saveLocal(false); } catch (e) { /* nada */ }
        sync();
    }
    // el anfitrión entra solo al Modo Jugar en cuanto el servidor está listo
    function startPlaying() {
        const t0 = Date.now();
        const iv = setInterval(function () {
            const ready = typeof isHost !== 'undefined' && isHost && window.currentRoomId && typeof mbwom !== 'undefined' && mbwom.world;
            if (ready || Date.now() - t0 > 20000) {
                clearInterval(iv);
                if (!ready || window.mbwPlaying) return;
                try { if (typeof window.closeFileMenu === 'function') window.closeFileMenu(); } catch (e) { /* nada */ }
                try { if (typeof window.mbwStartPlay === 'function') window.mbwStartPlay(); } catch (e) { console.warn('server play', e); }
            }
        }, 300);
    }

    // ---------------------------------------------------------- bloquear la edición
    function onCanvas(e) { return !!e.target && e.target.id === 'canvas'; }
    window.addEventListener('mousedown', function (e) {
        if (!onCanvas(e) || !locked()) return;
        if (e.button === 1) return;                                          // (rueda: mover la cámara)
        if (e.button === 0 && VIEW_TOOLS.indexOf(tool()) >= 0) return;      // (seleccionar y mirar sí)
        e.stopImmediatePropagation(); e.preventDefault();
        notice();
    }, true);
    window.addEventListener('dblclick', function (e) {
        if (!onCanvas(e) || !locked()) return;
        e.stopImmediatePropagation(); e.preventDefault();
    }, true);
    window.addEventListener('keydown', function (e) {
        if (!locked()) return;
        const t = e.target, tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
        const ctrl = e.ctrlKey || e.metaKey;
        if (e.code === 'Delete' || e.code === 'Backspace' || (ctrl && ['KeyZ', 'KeyY', 'KeyX', 'KeyV'].indexOf(e.code) >= 0)) {
            e.stopImmediatePropagation(); e.preventDefault(); notice();
        }
    }, true);
    function guard(name) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__smGuard) return;
        const g = function () { if (locked()) { notice(); return; } return orig.apply(this, arguments); };
        g.__smGuard = true;
        window[name] = g;
    }
    function guardAll() {
        ['deleteSelection', 'cutSelection', 'performPaste', 'bucketFill', 'fillSelectionWithBucket', 'buildPixelArtInWorld', 'openChestEditor', 'openFurnaceEditor',
            'openSignEditor', 'openMobFromWorld', 'pasteMobFromClipboard', 'activatePasteMode', 'toggleInventory', 'openStructuresModal', 'openMobsModal', 'openPixelArtModal'].forEach(guard);
        if (typeof historyManager !== 'undefined' && historyManager && !historyManager.__smGuard) {
            historyManager.__smGuard = true;
            ['undo', 'redo'].forEach(k => {
                const o = historyManager[k]; if (typeof o !== 'function') return;
                historyManager[k] = function () { if (locked()) { notice(); return; } return o.apply(this, arguments); };
            });
        }
    }
    window.addEventListener('load', function () { setTimeout(guardAll, 0); });

    // ---------------------------------------------------------- se ve bloqueado (cinta, herramientas, hotbar)
    let banner = null;
    function sync() {
        const on = locked();
        document.body.classList.toggle('mbw-server-map', on);
        if (on && !banner) {
            banner = document.createElement('div');
            banner.id = 'sm-banner';
            const ws = document.getElementById('workspace');
            (ws || document.body).appendChild(banner);
        }
        if (banner) {
            banner.style.display = on ? '' : 'none';
            banner.textContent = '🔒 ' + tr('sm_banner', 'Server map: only Play and Test');
            banner.title = tr('sm_banner_tip', 'This world was used to create a server, so it can no longer be edited.');
        }
        if (on && VIEW_TOOLS.indexOf(tool()) < 0 && typeof window.selectTool === 'function') { try { window.selectTool('select'); } catch (e) { /* nada */ } }
    }
    setInterval(sync, 500);

    window.mbwServerMap = { isMap: isMap, locked: locked, confirmLock: confirmLock, lock: lockWorld, startPlaying: startPlaying, sync: sync };
})();
