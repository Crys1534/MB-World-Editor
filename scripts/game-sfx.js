// ==========================================================
// 🔊 SONIDOS DEL JUEGO (los 262 archivos de Mine Blocks 2.0.0, en assets/sfx/...)
//
// Todo pasa por aquí: el editor (poner / borrar bloques, poner mobs, botones, avisos del chat) y el Modo Jugar
// (pasos, picar, romper, mobs, explosiones, agua, música...). Las reglas salen del código del juego:
//   · Game.requestSound: el volumen baja con la distancia al Player (a ~13 cuadros ya no se oye) y suena más a la
//     izquierda o a la derecha según dónde esté; "vary" cambia un poquito el tono para que no suene siempre igual.
//   · Game.blockSound: el sonido de cada bloque (piedra, pasto, madera, "smush" para tierra / arena / lana...).
//   · Entity_Mob: cada mob tiene sus sonidos (idle de vez en cuando, hurt al lastimarse, death al morir).
// Los volúmenes salen de Configuration > Sound (General, Efectos, Interfaz, Notificaciones y Música).
// Los datos (qué archivo es cada sonido, los de cada mob y cada bloque) están en scripts/game-sfx-data.js.
// ==========================================================
(function () {
    'use strict';

    const DATA = window.MB_SFX_DATA || { files: {}, mobs: {}, blocks: {} };
    const FILES = DATA.files, LOWER = {};
    Object.keys(FILES).forEach(function (k) { LOWER[k.toLowerCase()] = k; });
    function resolve(n) { if (n == null) return null; n = String(n); return FILES[n] ? n : (LOWER[n.toLowerCase()] || null); }
    function urlOf(n) { return 'assets/sfx/' + FILES[n] + '.mp3'; }
    function pick(list) { return list && list.length ? list[Math.random() * list.length | 0] : null; }

    const KEY = { clicks: 'mbw_sfx_clicks', editorAmb: 'mbw_sfx_editor_ambience' };
    function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function write(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* no se recuerda */ } }

    const X = window.mbSfx = {
        clicks: read(KEY.clicks) !== '0',               // sonido de los botones (el "hit" del menú del juego), prendido de fábrica
        editorAmbience: read(KEY.editorAmb) === '1',    // música y ambiente (lluvia, Nether, End) también mientras se edita; apagado de fábrica
        stats: { played: 0, last: '', failed: 0 }
    };

    // 0..1: General x el canal (sfx, ui, notif, music)
    function channelVol(ch) {
        const a = window.audioSettings || {};
        const m = a.master == null ? 100 : Number(a.master), c = a[ch] == null ? (ch === 'music' ? 70 : 100) : Number(a[ch]);
        return Math.max(0, Math.min(1, m / 100)) * Math.max(0, Math.min(1, c / 100));
    }
    X.channelVol = channelVol;
    // Game.getVolumeToPlayer / getPanToPlayer (dx, dy en cuadros desde el Player)
    function distVol(dx, dy) { return Math.max(Math.min(100 - Math.sqrt(dx * dx + dy * dy) * 7.5, 100), 0) / 100; }
    function panOf(dx) { return Math.max(-1, Math.min(1, dx / 6.666666666666667)); }

    // ---------------------------------------------------------- reproductor (Web Audio, y si no se puede: <audio>)
    let ac = null;
    function ctx() {
        if (ac === null) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = false; } }
        return ac || null;
    }
    function unlock() { const c = ctx(); if (c && c.state === 'suspended') c.resume().catch(function () { /* nada */ }); }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, unlock, { capture: true, passive: true }); });

    const buffers = new Map();                           // nombre -> Promise<AudioBuffer|null>
    function load(n) {
        if (!buffers.has(n)) {
            const c = ctx();
            const p = (!c || typeof fetch !== 'function') ? Promise.resolve(null) :
                fetch(urlOf(n)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
                    .then(function (b) { return new Promise(function (res, rej) { c.decodeAudioData(b, res, rej); }); })
                    .catch(function () { return null; });
            buffers.set(n, p);
        }
        return buffers.get(n);
    }
    X.preload = function (names) { (names || []).forEach(function (n) { n = resolve(n); if (n) load(n); }); };

    const voices = {};                                    // nombre -> voces sonando (como el "soundCarousel" del juego: 5 a la vez)
    function track(n, h) { const v = voices[n] = voices[n] || []; v.push(h); while (v.length > 5) { const o = v.shift(); try { o.stop(); } catch (e) { /* nada */ } } }
    function untrack(n, h) { const v = voices[n]; if (!v) return; const i = v.indexOf(h); if (i >= 0) v.splice(i, 1); }

    // X.play(nombre, { dx, dy, vol, vary, rate, ch, loop, offset }) -> { stop(), setVolume(v) } o null
    X.play = function (name, o) {
        o = o || {};
        const n = resolve(name);
        if (!n) return null;
        const ch = o.ch || 'sfx';
        let v = (o.vol == null ? 1 : o.vol);
        if (o.dx != null || o.dy != null) v *= distVol(o.dx || 0, o.dy || 0);
        const base = v;
        v *= channelVol(ch);
        if (v < .002 && !o.loop) return null;
        const rate = Math.pow(2, (2 * Math.random() - 1) * (o.vary || 0) / 10) * (o.rate || 1);
        const pan = o.dx != null ? panOf(o.dx) : 0;
        const h = { name: n, ch: ch, base: base, stopped: false, src: null, gain: null, el: null };
        h.stop = function () { h.stopped = true; untrack(n, h); try { if (h.src) h.src.stop(); } catch (e) { /* nada */ } if (h.el) { try { h.el.pause(); } catch (e) { /* nada */ } } };
        h.setVolume = function (b) { h.base = b; const vv = Math.max(0, b * channelVol(ch)); if (h.gain) h.gain.gain.value = vv; if (h.el) h.el.volume = Math.min(1, vv); };
        h.refresh = function () { h.setVolume(h.base); };
        const fallback = function () {
            if (h.stopped) return;
            try {
                const a = new Audio(urlOf(n));
                a.volume = Math.min(1, v); a.loop = !!o.loop;
                try { a.playbackRate = rate; a.preservesPitch = false; } catch (e) { /* nada */ }
                if (o.offset) { try { a.currentTime = o.offset; } catch (e) { /* nada */ } }
                a.onended = function () { untrack(n, h); };
                h.el = a;
                a.play().catch(function () { X.stats.failed++; });
            } catch (e) { X.stats.failed++; }
        };
        const c = ctx();
        if (c && c.state !== 'closed') {
            load(n).then(function (buf) {
                if (h.stopped) return;
                if (!buf) { fallback(); return; }
                const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.loop = !!o.loop;
                const g = c.createGain(); g.gain.value = v;
                src.connect(g);
                let out = g;
                if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
                out.connect(c.destination);
                src.onended = function () { untrack(n, h); };
                h.src = src; h.gain = g;
                try { src.start(0, Math.min(o.offset || 0, Math.max(0, buf.duration - .05))); } catch (e) { /* nada */ }
            });
        } else fallback();
        track(n, h);
        X.stats.played++; X.stats.last = n;
        return h;
    };
    X.ui = function (name, vol) { return X.play(name, { ch: 'ui', vol: vol == null ? 1 : vol }); };
    X.notif = function (name, vol) { return X.play(name || 'scavengerChat', { ch: 'notif', vol: vol == null ? 1 : vol }); };

    // ---------------------------------------------------------- sonidos que se repiten (lluvia, bajo el agua, Nether...)
    const loops = {};
    // X.loop(clave, nombre, volumen, canal): deja sonando UNA vez ese sonido (si ya suena, solo le cambia el volumen); nombre = null lo quita
    X.loop = function (key, name, vol, ch) {
        const cur = loops[key];
        if (!name || !(vol > 0)) { if (cur) { cur.stop(); delete loops[key]; } return null; }
        if (cur && cur.name === resolve(name)) { if (Math.abs(cur.base - vol) > .01) cur.setVolume(vol); return cur; }
        if (cur) cur.stop();
        const h = X.play(name, { vol: vol, ch: ch || 'sfx', loop: true });
        if (h) loops[key] = h; else delete loops[key];
        return h;
    };
    X.stopLoops = function () { Object.keys(loops).forEach(function (k) { loops[k].stop(); delete loops[k]; }); };
    X.loopsOn = function () { return Object.keys(loops); };

    // ---------------------------------------------------------- música (una sola a la vez, canal "music")
    let music = null;
    X.music = function (name) {
        if (music) { music.stop(); music = null; }
        if (name) music = X.play(name, { ch: 'music', vol: 1 });
        return music;
    };
    X.musicName = function () { return music && !music.stopped ? music.name : ''; };
    X.stopMusic = function () { X.music(null); };
    // si se mueve un volumen en Configuration, lo que ya suena cambia al momento
    X.refresh = function () {
        Object.keys(loops).forEach(function (k) { loops[k].refresh(); });
        if (music) music.refresh();
    };

    // ---------------------------------------------------------- bloques (Game.blockSound)
    const GLASS = { gs: 1, bdgs: 1, glow: 1, ice: 1, fice: 1 };
    function baseId(id) {
        id = String(id || '');
        if (DATA.blocks[id] || GLASS[id]) return id;
        const u = id.split('_')[0];
        if (DATA.blocks[u] || GLASS[u]) return u;
        return id;
    }
    X.blockKind = function (id) {
        const b = baseId(id);
        if (b === 'slimeb') return 'slime';
        return DATA.blocks[b] || null;
    };
    // kind: 'place' | 'break' | 'step' | 'mine'. Devuelve true si sonó algo.
    X.block = function (id, kind, dx, dy, vol) {
        const b = baseId(id);
        if (!b || b === 'air' || b === 'wr') return false;
        const o = { dx: dx, dy: dy, vol: vol == null ? 1 : vol, vary: 1 };
        if (kind === 'break' && GLASS[b]) return !!X.play('glass' + ((Math.random() * 3 | 0) + 1), o);
        if (b === 'slimeb') return !!X.play('slimeland' + ((Math.random() * 4 | 0) + 1), o);
        const k = DATA.blocks[b];
        if (k === 'stone') return !!X.play('stone', o);
        if (k === 'grass') return !!X.play('crunch' + ((Math.random() * 3 | 0) + 1), o);
        if (k === 'wood') return !!X.play('wood', o);
        if (k === 'mush') return !!X.play('smush', o);
        return false;
    };

    // ---------------------------------------------------------- mobs (Entity_Mob: sounds.idle / hurt / death / aggroIdle)
    const MOB_ALIAS = { dog: 'wolf', zombiepigman: 'zombie', pigman: 'zombie', mushroom: 'cow', cowctus: 'cow', 'mushroom cow': 'cow', 'cowctus cow': 'cow', bunny: 'rabbit', netherwalker: 'nethereye' };
    X.mobInfo = function (type) {
        type = String(type || '').toLowerCase();
        return DATA.mobs[type] || DATA.mobs[MOB_ALIAS[type]] || null;
    };
    // kind: 'idle' | 'hurt' | 'death' | 'aggro' | 'any' (al poner un mob en el editor: el que tenga)
    X.mob = function (type, kind, dx, dy, baby) {
        const t = String(type || '').toLowerCase();
        const info = X.mobInfo(t);
        const s = info ? info.sounds : {};
        let list = null;
        if (kind === 'aggro') list = s.aggroIdle || s.idle;
        else if (kind === 'any') list = s.idle || s.aggroIdle || s.hurt;
        else list = s[kind];
        if ((t === 'wolf' || t === 'dog') && kind === 'any') list = ['Bark1', 'Bark2', 'Bark3', 'Bark4', 'Bark5', 'Bark6', 'Bark7', 'Bark8', 'Bark9', 'Bark10'];
        const n = pick(list);
        if (!n) return null;
        return X.play(n, { dx: dx, dy: dy, rate: baby ? 1.3 : 1 });
    };
    X.mobIdleChance = function (type) { const i = X.mobInfo(type); return i && i.sounds && (i.sounds.idle || i.sounds.aggroIdle) ? 1 / (i.freq || 200) : 0; };

    // ---------------------------------------------------------- 🖱 botones de la interfaz (el "hit" del juego al apretar un botón)
    const CLICKABLE = 'button, [role="button"], .ribbon-btn, .ribbon-btn-large, .inv-item, .tab-btn, .file-menu-item, .settings-tab, summary';
    let lastClick = 0;
    document.addEventListener('pointerdown', function (e) {
        if (!X.clicks || e.button > 0) return;
        const t = e.target && e.target.closest ? e.target.closest(CLICKABLE) : null;
        if (!t || t.disabled || t.closest('#mbw-play-hud')) return;        // (en el Modo Jugar los botones del HUD no hacen ruido)
        const now = performance.now(); if (now - lastClick < 60) return; lastClick = now;
        X.ui('hit', .8);
    }, true);

    // ---------------------------------------------------------- 🌧 lluvia, truenos, Nether / End y música mientras se edita (opcional)
    function scene() { return (typeof mbwom !== 'undefined' && mbwom.currentScene) ? mbwom.currentScene : 1; }
    function raining() { try { return typeof isRaining !== 'undefined' && !!isRaining; } catch (e) { return false; } }
    X.isRaining = raining;
    X.thunder = function () {                         // lo llama la animación del clima cuando cae un relámpago (ui-handler.js)
        if (!(window.mbwPlaying || X.editorAmbience) || scene() !== 1) return;
        if (Math.random() < .4) X.play('closeThunder' + ((Math.random() * 4 | 0) + 1), { vol: .9, ch: 'weather' });
        else X.play('distantThunder' + ((Math.random() * 10 | 0) + 1), { vol: .8, ch: 'weather' });
    };
    // cada medio segundo: la lluvia, el ambiente de la dimensión y la música del menú (solo editando, si está prendido)
    let editorSongTimer = 0;
    setInterval(function () {
        if (window.mbwPlaying) return;                // (el Modo Jugar maneja lo suyo: scripts/play-mode.js)
        if (!X.editorAmbience) { X.loop('rain', null); X.loop('dim', null); if (X.musicName() === 'mainSong') X.stopMusic(); return; }
        const sc = scene();
        X.loop('rain', raining() && sc === 1 ? 'rainsound' : null, .5, 'weather');
        X.loop('dim', sc === 2 ? 'Nether' : sc === 3 ? 'EnderBG' : null, .5);
        if (!X.musicName()) { if (--editorSongTimer <= 0) { X.music('mainSong'); editorSongTimer = 2 * (60 + Math.random() * 60) | 0; } }
    }, 500);

    // ---------------------------------------------------------- Configuration > Sound
    X.setClicks = function (on) { X.clicks = !!on; write(KEY.clicks, on ? '1' : '0'); sync(); };
    X.setEditorAmbience = function (on) {
        X.editorAmbience = !!on; write(KEY.editorAmb, on ? '1' : '0');
        if (!on && !window.mbwPlaying) { X.stopLoops(); X.stopMusic(); }
        editorSongTimer = 0; sync();
    };
    function sync() {
        const a = document.getElementById('sfx-clicks-toggle'); if (a) a.checked = X.clicks;
        const b = document.getElementById('sfx-editor-amb-toggle'); if (b) b.checked = X.editorAmbience;
    }
    X.sync = sync;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
