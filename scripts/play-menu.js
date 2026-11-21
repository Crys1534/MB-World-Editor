// =====================================================================
// ⏸ MENÚ DE PAUSA DEL MODO JUGAR (como el del juego) + lista de jugadores con Tab
// =====================================================================
// Se abre con Esc o con el engranaje ⚙ de arriba a la derecha (casi transparente; al pasar el mouse se ve completo).
//   · Back to Game · Options · Save and Quit (guarda todo lo que pasó jugando; ver play-mode.js saveAndQuit)
//   · El ANFITRIÓN de una sala además tiene "Server": nombre del mundo y descripción (salen en la lista de servidores), cuántos
//     pueden entrar (máximo 6), quién puede entrar y si los invitados pueden usar comandos.
//   · A la derecha: los jugadores (los conectados y los que alguna vez entraron a jugar este mundo, con su última conexión).
//   · Options: salto automático, resolución (cuántos bloques se ven), partículas, animaciones, efectos de pantalla, transiciones,
//     volumen de la lluvia y de la música.
// Un jugador solo: el juego se detiene mientras el menú está abierto. En una partida no (los demás siguen), pero tu Player no se mueve.
// Tab: muestra / esconde la lista de jugadores con barras de conexión (ping).
// Todo el texto que viene de otras personas (nombres) entra como TEXTO (textContent).
(function () {
    'use strict';
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
    const MAX = 6;
    let root = null, page = 'main', tabEl = null, tabTimer = 0;
    const el = function (tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const M = function () { return window.mbwMpPlay || null; };
    const P = function () { return window.mbwPlay || null; };
    const inRoom = function () { try { return typeof isMultiplayer !== 'undefined' && !!isMultiplayer; } catch (e) { return false; } };
    const amHost = function () { try { return typeof isHost !== 'undefined' && !!isHost; } catch (e) { return false; } };
    const hostOfRoom = function () { return inRoom() && amHost() && (typeof window.mbwIsBoss !== 'function' || window.mbwIsBoss()); };   // (👑 en un servidor permanente: solo su creador)

    // ------------------------------------------------------------------ barras de conexión
    function bars(ping, online) {
        const b = el('span', 'pm-bars');
        const n = !online ? 0 : ping <= 100 ? 4 : ping <= 200 ? 3 : ping <= 400 ? 2 : 1;
        const col = n >= 3 ? '#4caf50' : n === 2 ? '#f0b429' : '#e74c3c';
        for (let i = 1; i <= 4; i++) { const s = el('i'); s.style.height = (3 + i * 3) + 'px'; s.style.background = i <= n ? col : 'rgba(255,255,255,.18)'; b.appendChild(s); }
        b.title = online ? (ping ? ping + ' ms' : tr('pm_ping_good', 'Good connection')) : tr('pm_offline', 'Offline');
        return b;
    }
    // (solo el tiempo: "12 minutos", "3 horas", "2 días")
    function ago(t) {
        if (!t) return '';
        const m = Math.max(0, Math.floor((Date.now() - t) / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24);
        const f = function (n, one, many, fb1, fbn) { return n === 1 ? tr(one, fb1) : tr(many, fbn).replace('{n}', n); };
        if (m < 1) return tr('pm_just_now', 'just now');
        if (m < 60) return f(m, 'pm_t_min1', 'pm_t_min', '1 minute', '{n} minutes');
        if (h < 24) return f(h, 'pm_t_h1', 'pm_t_h', '1 hour', '{n} hours');
        return f(d, 'pm_t_d1', 'pm_t_d', '1 day', '{n} days');
    }
    function playerRows(box, withLast) {
        box.textContent = '';
        const list = (M() && M().playerList) ? M().playerList() : [{ name: (localStorage.getItem('mbw_username') || 'Player'), online: true, me: true, host: true, ping: 0 }];
        const on = list.filter(function (p) { return p.online; }), off = list.filter(function (p) { return !p.online; }).sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
        // (el límite es de conectados A LA VEZ; la lista muestra a TODOS los que alguna vez jugaron)
        const lim = inRoom() ? Math.min(MAX, Number(window.multiplayerPlayerLimit) || MAX) : 1;
        const head = el('div', 'pm-pl-head', tr('pm_players', 'Players') + ' · ' + on.length + '/' + lim + ' ' + tr('pm_online_now', 'online') + (withLast && off.length ? ' · ' + list.length + ' ' + tr('pm_total', 'total') : ''));
        box.appendChild(head);
        on.concat(withLast ? off : []).forEach(function (p) {
            const r = el('div', 'pm-pl-row' + (p.online ? '' : ' off'));
            const dot = el('span', 'pm-dot'); r.appendChild(dot);
            const nm = el('span', 'pm-pl-name', String(p.name || 'Player')); r.appendChild(nm);
            if (p.host) r.appendChild(el('span', 'pm-tag', '👑'));
            if (p.me) r.appendChild(el('span', 'pm-tag pm-me', tr('pm_you', 'you')));
            if (!p.online) r.appendChild(el('span', 'pm-last', ago(p.last)));
            else if (p.editing) r.appendChild(el('span', 'pm-last', '✏️ ' + tr('pm_editing', 'editor')));
            r.appendChild(bars(p.ping || 0, p.online));
            // 🎒 el que lleva la partida puede ver y cambiar el inventario de los demás (scripts/mp-inv.js)
            if (!p.me && p.uid && window.mbwMpInv && window.mbwMpInv.canUse()) r.appendChild(btn('🎒', 'pm-mini pm-inv', function () { window.mbwMpInv.open(p.uid, p.name); }));
            // ⭐ y sus marcadores (aunque no esté conectado)
            const MK = window.mbwPlay && window.mbwPlay.marks;
            if (!p.me && p.uid && MK && MK.canSeeOthers && MK.canSeeOthers()) { const mb = btn('⭐', 'pm-mini pm-mk', function () { MK.showOf(p.uid, p.name); }); mb.title = tr('mk_of_btn', 'See their markers'); r.appendChild(mb); }
            box.appendChild(r);
        });
        if (withLast && !off.length && !inRoom()) box.appendChild(el('div', 'pm-pl-note', tr('pm_solo_note', 'Playing on your own. In a multiplayer room, everyone who plays this world shows up here.')));
    }

    // ------------------------------------------------------------------ el menú
    function build() {
        root = el('div', 'pm-overlay');
        root.id = 'play-menu';
        root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        // (Esc lo maneja play-mode.js; aquí solo si estás escribiendo en una caja del menú, donde el juego no escucha)
        root.addEventListener('keydown', function (e) { e.stopPropagation(); const t = e.target; if (e.key === 'Escape' && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) { e.preventDefault(); back(); } });
        root.addEventListener('keyup', function (e) { e.stopPropagation(); });
        document.body.appendChild(root);
    }
    function btn(label, cls, fn) { const b = el('button', 'pm-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); return b; }
    function show(p) {
        page = p;
        if (!root) build();
        root.textContent = '';
        const box = el('div', 'pm-box');
        const left = el('div', 'pm-left'), right = el('div', 'pm-right');
        box.appendChild(left);
        // 🧑 la skin, grande, en su propia columna (solo en la pantalla principal del menú)
        if (p === 'main') { const mid = el('div', 'pm-mid'); mid.appendChild(skinRow()); box.appendChild(mid); box.classList.add('pm-3col'); }
        box.appendChild(right);
        root.appendChild(box);
        if (p === 'main') {
            left.appendChild(el('h2', 'pm-title', hostOfRoom() ? tr('pm_title_host', 'Game menu (host)') : tr('pm_title', 'Game menu')));
            left.appendChild(btn(tr('pm_back', 'Back to Game'), 'pm-primary', close));
            left.appendChild(btn(tr('pm_options', 'Options'), '', function () { show('options'); }));
            if (window.mbwAch) left.appendChild(btn('🏆 ' + tr('pm_ach', 'Achievements'), '', function () { show('ach'); }));
            if (hostOfRoom()) left.appendChild(btn(tr('pm_server', 'Server settings'), '', function () { show('server'); }));
            const guest = M() && M().on && M().role === 'guest';
            const test = !!(P() && P().isTest && P().isTest());
            const srv = !test && typeof isMultiplayer !== 'undefined' && isMultiplayer && !!window.mpServerKind;   // 🚪 en un servidor: se sale por completo
            const perm = srv && !!(window.mbwIsPermServerWorld && typeof mbwom !== 'undefined' && window.mbwIsPermServerWorld(mbwom.world));
            left.appendChild(btn(test ? '🧪 ' + tr('pm_quit_test', 'Quit test (nothing is saved)') : srv ? tr('pm_quit_server', 'Save and leave the server') : guest ? tr('pm_quit_guest', 'Save and Quit (leave the game)') : tr('pm_quit', 'Save and Quit'), 'pm-quit', function () { closeNow(); if (P() && P().saveAndQuit) P().saveAndQuit(); }));
            if (srv) left.appendChild(el('p', 'pm-hint', perm ? tr('pm_quit_server_perm_hint', 'You leave the server completely and its tab closes. This permanent server is saved online only (never in My Worlds). The others keep playing.') : tr('pm_quit_server_hint', 'You leave the server completely and its tab closes. Your copy of the world is saved in My Worlds. The others keep playing.')));
            else
            left.appendChild(el('p', 'pm-hint', test ? tr('pm_quit_test_hint', 'This is a test: when you leave, the world goes back to how it was before playing.') : guest ? tr('pm_quit_guest_hint2', 'Everything that happened is saved in your copy of the world (and your Player in the host\'s). The others keep playing.') : inRoom() ? tr('pm_quit_host_hint', 'Everything that happened is saved in your world. The others keep playing (one of them takes over the game).') : tr('pm_quit_hint', 'Everything that happened while playing is saved. How the world was before playing stays in the version history (Play mode column).')));
        } else if (p === 'options') {
            left.appendChild(el('h2', 'pm-title', tr('pm_options', 'Options')));
            left.appendChild(optionsForm());
            left.appendChild(btn('← ' + tr('pm_done', 'Done'), 'pm-primary', function () { show('main'); }));
        } else if (p === 'ach') {
            left.appendChild(el('h2', 'pm-title', '🏆 ' + tr('pm_ach', 'Achievements')));
            left.appendChild(achList());
            left.appendChild(btn('← ' + tr('pm_done', 'Done'), 'pm-primary', function () { show('main'); }));
        } else if (p === 'server') {
            left.appendChild(el('h2', 'pm-title', tr('pm_server', 'Server settings')));
            left.appendChild(serverForm());
            left.appendChild(btn('← ' + tr('pm_done', 'Done'), 'pm-primary', function () { show('main'); }));
        }
        const pl = el('div', 'pm-players');
        right.appendChild(pl);
        playerRows(pl, true);
        clearInterval(tabTimer);
        tabTimer = setInterval(function () { if (root && root.style.display !== 'none') playerRows(pl, true); }, 2000);
        const first = left.querySelector('button'); if (first && !document.body.classList.contains('is-touch')) setTimeout(function () { try { first.focus(); } catch (e) { /* nada */ } }, 0);
    }
    // 🏆 Logros de todos los que alguna vez jugaron en este mundo, de más a menos. Clic en un jugador = ver cuáles tiene.
    let achOpen = null;
    function achList() {
        const A = window.mbwAch, box = el('div', 'pm-ach');
        const me = localStorage.getItem('mbw_uid') || 'local';
        const list = A.ranking();
        if (achOpen == null) achOpen = me;
        if (!list.length) box.appendChild(el('div', 'pm-pl-note', tr('pm_ach_none', 'Nobody has achievements yet.')));
        list.forEach(function (r, n) {
            const row = el('button', 'pm-ach-row' + (r.uid === me ? ' me' : '') + (achOpen === r.uid ? ' open' : ''));
            row.type = 'button';
            row.appendChild(el('span', 'pm-ach-pos', '#' + (n + 1)));
            row.appendChild(el('span', 'pm-ach-name', r.name + (r.uid === me ? ' (' + tr('pm_you', 'you') + ')' : '')));
            row.appendChild(el('span', 'pm-ach-num', r.count + ' / ' + A.count));
            const bar = el('span', 'pm-ach-bar'); const fill = el('i'); fill.style.width = Math.round(100 * r.count / A.count) + '%'; bar.appendChild(fill); row.appendChild(bar);
            row.addEventListener('click', function () { achOpen = achOpen === r.uid ? '' : r.uid; show('ach'); });
            box.appendChild(row);
            if (achOpen === r.uid) {
                const g = el('div', 'pm-ach-grid');
                for (let i = 0; i < A.count; i++) {
                    const has = !!(r.a && r.a[i]);
                    const t = el('div', 'pm-ach-it' + (has ? ' got' : ''));
                    t.appendChild(el('span', 'pm-ach-ic', has ? A.icon(i) : '🔒'));
                    t.appendChild(el('span', 'pm-ach-tx', A.name(i)));
                    g.appendChild(t);
                }
                box.appendChild(g);
            }
        });
        return box;
    }
    // 🧑 Skin: se elige de la galería de skins (la ven todos; se recuerda en este navegador para todos los mundos)
    function skinRow() {
        const r = el('div', 'pm-skin pm-skin-big');
        r.appendChild(el('div', 'pm-skin-name', String(localStorage.getItem('mbw_username') || 'Player')));
        const cur = (P() && P().skin) ? P().skin() : '';
        const pv = el('canvas', 'pm-skin-pv'); pv.width = 16; pv.height = 22;
        const btns = el('div', 'pm-skin-btns');
        const drawPv = function () {
            const cx = pv.getContext('2d'); cx.clearRect(0, 0, 16, 22); cx.imageSmoothingEnabled = false;
            const id = (P() && P().skin) ? P().skin() : '';
            const sk = id && window.mbwPlaySkinSheet ? window.mbwPlaySkinSheet(id) : null;
            const im = sk || (P() && P().frank);
            if (im && (im.naturalWidth || im.width)) cx.drawImage(im, 0, 0, 16, 22, 0, 0, 16, 22);
            else if (id) setTimeout(drawPv, 400);
        };
        drawPv();
        r.appendChild(pv);
        r.appendChild(btns);
        btns.appendChild(btn('🧑 ' + tr('pm_skin', 'Skin'), 'pm-skin-btn', function () {
            if (typeof window.openSkinGallery !== 'function') return;
            window.openSkinGallery({ pick: function (id) {
                if (P() && P().setSkin) P().setSkin(id);
                try { if (typeof window.closeSkinGallery === 'function') window.closeSkinGallery(); } catch (e) { /* nada */ }
                if (root && root.style.display !== 'none') show(page);
            } });
            const m = document.getElementById('sg-modal'); if (m) m.style.zIndex = '100080';   // (encima del menú)
        }));
        if (cur) btns.appendChild(btn('↺ ' + tr('pm_skin_default', 'Default'), 'pm-skin-def', function () { if (P() && P().setSkin) P().setSkin(''); show(page); }));
        r.title = tr('pm_skin_tip', 'Choose a skin from the skin gallery. Everyone in the game sees it, in every world.');
        return r;
    }
    function galleryOpen() { try { return !!(window.mbwSkinGallery && window.mbwSkinGallery.state && window.mbwSkinGallery.state.open); } catch (e) { return false; } }
    function row(label, input, hint) {
        const r = el('label', 'pm-row');
        r.appendChild(el('span', 'pm-row-l', label));
        r.appendChild(input);
        if (hint) r.title = hint;
        return r;
    }
    function check(on, fn) { const c = el('input'); c.type = 'checkbox'; c.checked = !!on; c.addEventListener('change', function () { fn(c.checked); }); return c; }
    function select(opts, cur, fn) {
        const s = el('select', 'pm-sel');
        opts.forEach(function (o) { const op = el('option', null, o[1]); op.value = o[0]; if (String(o[0]) === String(cur)) op.selected = true; s.appendChild(op); });
        s.addEventListener('change', function () { fn(s.value); });
        return s;
    }
    function range(ch) {
        const r = el('input', 'pm-range'); r.type = 'range'; r.min = 0; r.max = 100;
        const a = window.audioSettings || {}; r.value = a[ch] == null ? (ch === 'music' ? 70 : 100) : a[ch];
        r.addEventListener('input', function () { if (typeof window.updateAudioChannel === 'function') window.updateAudioChannel(ch, r.value); });
        return r;
    }
    // ⚙ Opciones en PESTAÑAS: General (cómo se juega, sonido) y Rendimiento (todo lo que hace que vaya más rápido).
    //    Se ve como las ventanas de inventario del juego (gris claro con relieve) y cada opción lleva un dibujo del juego.
    let optTab = 'general';
    function ico(id, ex) {                                           // (el dibujo de un objeto / bloque del juego, en pixel art)
        const c = el('canvas', 'pm-ico'); c.width = 16; c.height = 16;
        try { const im = P() && P().iconFor ? P().iconFor(id, ex || {}) : null; if (im) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, 16, 16); } } catch (e) { /* nada */ }
        return c;
    }
    function orow(icon, label, input, hint) {
        const r = row(label, input, hint);
        r.classList.add('pm-orow');
        if (icon) r.insertBefore(icon, r.firstChild); else r.insertBefore(el('span', 'pm-ico pm-ico-none'), r.firstChild);
        return r;
    }
    function optionsForm() {
        const wrap = el('div', 'pm-opt mb-win');
        const tabs = el('div', 'pm-opt-tabs');
        const body = el('div', 'pm-form pm-oform');
        [['general', 'pm_tab_general', 'General', 'IronPickaxe'], ['perf', 'pm_tab_perf', 'Performance', 'clock']].forEach(function (t) {
            const b = btn('', 'pm-opt-tab' + (optTab === t[0] ? ' on' : ''), function () { optTab = t[0]; tabs.querySelectorAll('.pm-opt-tab').forEach(function (x) { x.classList.toggle('on', x === b); }); fill(); });
            b.appendChild(ico(t[3])); b.appendChild(el('span', null, tr(t[1], t[2])));
            b.dataset.tab = t[0];
            tabs.appendChild(b);
        });
        const fill = function () {
            body.textContent = '';
            const o = (P() && P().opts) ? P().opts() : {};
            const set = function (k) { return function (v) { if (P() && P().setOpt) P().setOpt(k, v); }; };
            const touch = document.body.classList.contains('is-touch');
            const A = function (icon, label, input, hint) { body.appendChild(orow(icon ? ico(icon[0], icon[1]) : null, label, input, hint)); };
            if (optTab === 'general') {
                A(['feather'], tr('pm_autojump', 'Auto-jump (1 block)'), check(o.autoJump, set('autoJump')), tr('pm_autojump_tip', 'Walking into a 1-block step jumps by itself, like in Minecraft'));
                A(['compass'], tr('pm_coords', 'Show coordinates'), check(o.coords, set('coords')));
                if (!touch) A(['IronPickaxe'], tr('pm_oldstyle', 'Old Style mining'), check(o.oldStyle === true, set('oldStyle')), tr('pm_oldstyle_tip', 'Like on phones: left click breaks OR builds, you choose with the ⛏ / 🧱 button next to the hotbar (or the R key). Right click still places / uses.'));
                if (touch) A(['gss'], tr('pm_loupe', 'Magnifier when you touch the map'), check(o.loupe !== false, set('loupe')), tr('pm_loupe_tip', 'Shows in big what is under your finger, so you can see which block you touch'));
                A(['wr'], tr('config_vol_weather', 'Rain and storm'), range('weather'));
                A(['jl'], tr('config_vol_music', 'Music'), range('music'));
            } else {
                const cl = o.clouds === false || o.clouds === 'off' ? 'off' : o.clouds === 'fast' ? 'fast' : 'fancy';
                A(['clock'], tr('pm_fps', 'Frames per second'), select([['25', '25 fps'], ['30', '30 fps'], ['50', '50 fps (' + tr('pm_fps_game', 'like the game') + ')'], ['60', '60 fps']], String(o.fps || 50), set('fps')), tr('pm_fps_tip', 'How many times per second the screen is drawn. The game itself always runs at 50 steps per second: fewer fps = less work for your device.'));
                A(['paper'], tr('pm_fps_show', 'Show FPS on screen'), check(o.fpsShow === true, set('fpsShow')));
                A(['compass'], tr('pm_res', 'Screen size (blocks you see)'), select([['default', tr('pm_res_default', 'Game (18 × 14)')], ['4:3', '4:3 (20 × 15)'], ['16:9', '16:9 (27 × 15)']], o.res || 'default', set('res')));
                A(['ob'], tr('pm_shadows', 'Shadows (underground darkness)'), select([['soft', tr('pm_sh_soft', 'Soft')], ['simple', tr('pm_sh_simple', 'Simple (no light circles)')], ['off', tr('pm_off', 'Off')]], o.shadows || 'soft', set('shadows')), tr('pm_shadows_tip', 'Simple: the darkness stays, but torches do not light circles around them. Off: no darkness underground (night still gets darker).'));
                A(['light'], tr('pm_lighting', 'Lighting'), select([['smooth', tr('pm_light_smooth', 'Smooth gradients')], ['blocky', tr('pm_light_blocky', 'By whole blocks')]], o.lighting || 'smooth', set('lighting')));
                A(['glow'], tr('pm_lightq', 'Torch light quality'), select([['high', tr('pm_q_high', 'High')], ['medium', tr('pm_q_medium', 'Medium')], ['low', tr('pm_q_low', 'Low')]], o.lightQ || 'high', set('lightQ')), tr('pm_lightq_tip', 'High: every light. Medium: the 24 closest. Low: the 10 closest and no colored glow (lava, glowstone...).'));
                A(['dye_white'], tr('pm_particles', 'Particles'), select([['all', tr('pm_all', 'All')], ['some', tr('pm_some', 'Some')], ['none', tr('pm_none', 'None')]], o.particles || 'all', set('particles')));
                A(['magma'], tr('pm_anims', 'Block animations'), check(o.anims !== false, set('anims')));
                A(['la'], tr('pm_liq_anim', 'Water and lava animation'), check(o.liqAnim !== false, set('liqAnim')));
                A(['fire'], tr('pm_fire_anim', 'Fire animation'), check(o.fireAnim !== false, set('fireAnim')));
                A(['lv'], tr('pm_fast_leaves', 'Fast leaves (opaque)'), check(o.fastLeaves === true, set('fastLeaves')), tr('pm_fast_leaves_tip', 'Tree leaves are drawn solid instead of see-through, like "Fast" graphics in Minecraft.'));
                A(['web'], tr('pm_clouds', 'Clouds'), select([['fancy', tr('pm_clouds_fancy', 'Fancy (moving)')], ['fast', tr('pm_clouds_fast', 'Fast (still)')], ['off', tr('pm_off', 'Off')]], cl, function (v) { set('clouds')(v === 'fancy' ? true : v === 'off' ? false : 'fast'); }));
                A(['wr'], tr('pm_rain', 'Rain'), select([['many', tr('pm_rain_many', 'Many drops')], ['few', tr('pm_rain_few', 'Few drops')]], o.rain || 'many', set('rain')));
                A(['potion', { type: 'water' }], tr('pm_bubbles', 'Bubbles under water'), check(o.bubbles !== false, set('bubbles')));
                A(['ebook'], tr('pm_glint2', 'Enchantment glint (armor and items)'), check(o.glint !== false, set('glint')));
                A(['sl'], tr('pm_bgmove', 'Moving background trees'), check(o.bgMove !== false, set('bgMove')));
                A(['TNT'], tr('pm_effects', 'Screen effects (damage flash, lightning)'), check(o.effects !== false, set('effects')));
                A(['sign'], tr('pm_transitions', 'Menu transitions'), check(o.transitions !== false, set('transitions')));
            }
        };
        fill();
        wrap.appendChild(tabs);
        wrap.appendChild(body);
        return wrap;
    }
    // 🛠 Ajustes del servidor, con el mismo estilo de ventana del juego que Options y en PESTAÑAS:
    //    General (nombre, descripción, cuántos a la vez, quién entra, permanente) · Players (quién está, invitar) · Rules (modo de juego y comandos)
    let srvTab = 'general';
    function serverForm() {
        const wrap = el('div', 'pm-opt mb-win pm-srv');
        const tabs = el('div', 'pm-opt-tabs');
        const body = el('div', 'pm-form pm-oform');
        [['general', 'pm_tab_general', 'General', 'sign'], ['people', 'pm_tab_people', 'Players', 'feather'], ['rules', 'pm_tab_rules', 'Rules', 'ebook']].forEach(function (t) {
            const b = btn('', 'pm-opt-tab' + (srvTab === t[0] ? ' on' : ''), function () { srvTab = t[0]; tabs.querySelectorAll('.pm-opt-tab').forEach(function (x) { x.classList.toggle('on', x === b); }); fill(); });
            b.appendChild(ico(t[3])); b.appendChild(el('span', null, tr(t[1], t[2])));
            b.dataset.tab = t[0];
            tabs.appendChild(b);
        });
        const fill = function () {
            body.textContent = '';
            const ref = window.myRoomRef || null;
            const A = function (icon, label, input, hint) { body.appendChild(orow(icon ? ico(icon[0], icon[1]) : null, label, input, hint)); };
            if (srvTab === 'general') {
                const nm = el('input', 'pm-in'); nm.type = 'text'; nm.maxLength = 40; nm.value = window.mpSelectedMapName || (document.getElementById('filename-display') || {}).value || '';
                nm.addEventListener('change', function () { const v = nm.value.trim().slice(0, 40); if (!v) return; window.mpSelectedMapName = v; if (ref) ref.update({ mapName: v }); });
                A(['sign'], tr('pm_world_name', 'World name (server list)'), nm);
                const ds = el('textarea', 'pm-in pm-desc'); ds.maxLength = 120; ds.rows = 2; ds.value = window.mpRoomDesc || '';
                ds.addEventListener('change', function () { const v = ds.value.trim().slice(0, 120); window.mpRoomDesc = v; if (ref) ref.update({ desc: v }); });
                A(['paper'], tr('pm_world_desc', 'Description (server list)'), ds);
                const cur = Math.max(2, Math.min(MAX, Number(window.multiplayerPlayerLimit) || 2));
                A(['compass'], tr('pm_max_players', 'Players at the same time (max 6)'), select([2, 3, 4, 5, 6].map(function (n) { return [n, String(n)]; }), cur, function (v) {
                    const n = Math.max(2, Math.min(MAX, Number(v) || 2));
                    let done = false;
                    try { if (window.mbwServerWizard && window.mbwServerWizard.setPlayers) { window.mbwServerWizard.setPlayers(n); done = true; } } catch (e) { done = false; }
                    if (!done) { window.multiplayerPlayerLimit = n; if (ref) ref.update({ maxPlayers: n }); }
                }), tr('pm_max_players_tip', 'Only how many can be connected at once. Everyone who ever played still shows in the Players list.'));
                A(['ob'], tr('pm_access', 'Who can join'), select([['public', tr('pm_access_public', 'Everyone')], ['friends_only', tr('pm_access_friends', 'Friends only')], ['private', tr('pm_access_private', 'Only with an invitation')]], window.multiplayerAccess || 'public', function (v) {
                    let done = false;
                    try { if (window.mbwServerWizard && window.mbwServerWizard.setAccess) { window.mbwServerWizard.setAccess(v); done = true; } } catch (e) { done = false; }
                    if (!done) { window.multiplayerAccess = v; if (ref) ref.update({ access: v }); }
                }));
                // 💾 guardar el servidor en línea para que se pueda volver a abrir cuando ya no quede nadie (scripts/mp-saved.js)
                const sr = window.mbwSavedServers && window.mbwSavedServers.checkboxRow('ss-official pm-ss');
                if (sr) { const r = el('div', 'pm-row pm-orow pm-ssrow'); r.appendChild(ico('clock')); r.appendChild(sr); body.appendChild(r); }
            } else if (srvTab === 'people') {
                body.appendChild(peopleBox());
            } else {
                // 🎮 con qué modo de juego entran los jugadores NUEVOS (nunca el del anfitrión)
                if (M() && M().setNewGm) A(['IronPickaxe'], tr('pm_new_gm', 'Game mode for new players'), select([['0', tr('gm_survival', 'Survival')], ['1', tr('gm_creative', 'Creative')], ['2', tr('gm_adventure', 'Adventure')], ['3', tr('gm_spectator', 'Spectator')]], String(M().newGm()), function (v) { M().setNewGm(v); }), tr('pm_new_gm_tip', 'The first time someone joins, they start with an empty inventory, full health and this game mode.'));
                A(['ebook'], tr('pm_guest_cmds', 'Guests can use commands'), check(M() && M().allowCmds ? M().allowCmds() : false, function (on) { if (M() && M().setAllowCmds) M().setAllowCmds(on); }), tr('pm_guest_cmds_tip', 'By default only the host can use commands (gamemode, tp, give...)'));
            }
        };
        fill();
        wrap.appendChild(tabs);
        wrap.appendChild(body);
        return wrap;
    }
    function peopleBox() {
        const box = el('div', 'pm-people');
        const me = localStorage.getItem('mbw_uid');
        const inRoom = (window.roomPlayers || []).filter(function (q) { return q && q.uid && q.uid !== me; });
        box.appendChild(el('div', 'pm-sub', tr('pm_in_world', 'In your world')));
        if (!inRoom.length) box.appendChild(el('div', 'pm-pl-note', tr('pm_nobody_in', 'Nobody else is in your world.')));
        inRoom.forEach(function (q) {
            const r = el('div', 'pm-prow'); r.appendChild(el('span', 'pm-pl-name', String(q.name || q.username || 'Player')));
            const nm = String(q.name || q.username || 'Player');
            const b = btn(tr('pm_kick', 'Kick'), 'pm-mini pm-kick', function () { if (typeof window.kickPlayer === 'function') window.kickPlayer(q.uid, nm); setTimeout(function () { show(page); }, 900); });
            const bb = btn(tr('pm_ban', 'Ban'), 'pm-mini pm-ban', function () { if (typeof window.banPlayer === 'function') window.banPlayer(q.uid, nm); setTimeout(function () { show(page); }, 900); });
            const muted = typeof window.mpIsMuted === 'function' && window.mpIsMuted(q.uid);
            const bm = btn(muted ? tr('pm_unmute', 'Unmute') : tr('pm_mute', 'Mute'), 'pm-mini pm-mute' + (muted ? ' on' : ''), function () { if (typeof window.mutePlayer === 'function') window.mutePlayer(q.uid, nm); show(page); });
            if (muted) r.appendChild(el('span', 'pm-pl-tag', '🔇'));
            r.appendChild(bm); r.appendChild(b); r.appendChild(bb); box.appendChild(r);
        });
        // 🚫 baneados de este mundo (se pueden desbanear)
        const banned = typeof window.mpBanList === 'function' ? window.mpBanList() : [];
        if (banned.length) {
            box.appendChild(el('div', 'pm-sub', tr('pm_banned', 'Banned')));
            banned.forEach(function (bq) {
                const r = el('div', 'pm-prow'); r.appendChild(el('span', 'pm-pl-name', bq.name));
                r.appendChild(btn(tr('pm_unban', 'Unban'), 'pm-mini pm-unban', function () { if (typeof window.mpUnban === 'function') window.mpUnban(bq.uid); show(page); }));
                box.appendChild(r);
            });
        }
        const users = window.lastKnownUsers || {};
        const friends = (typeof misAmigosConfirmados !== 'undefined' && Array.isArray(misAmigosConfirmados)) ? misAmigosConfirmados : [];
        const inSet = new Set(inRoom.map(function (q) { return q.uid; }));
        const list = Object.keys(users).map(function (k) { return users[k]; }).filter(function (u) { return u && u.uid && u.uid !== me && !inSet.has(u.uid) && !(window.isBlocked && window.isBlocked(u.uid)); })
            .sort(function (a, b) { return (friends.includes(b.uid) ? 1 : 0) - (friends.includes(a.uid) ? 1 : 0) || String(a.username || '').localeCompare(String(b.username || '')); }).slice(0, 30);
        box.appendChild(el('div', 'pm-sub', tr('pm_invite_title', 'Invite (online now)')));
        if (!list.length) box.appendChild(el('div', 'pm-pl-note', tr('pm_nobody_online', 'Nobody else is online right now.')));
        const now = Date.now();
        list.forEach(function (u) {
            const r = el('div', 'pm-prow'); r.appendChild(el('span', 'pm-pl-name', String(u.username || 'Player') + (friends.includes(u.uid) ? ' ⭐' : '')));
            const sent = window.inviteCooldowns && window.inviteCooldowns[u.uid] && now < window.inviteCooldowns[u.uid];
            const b = btn(sent ? '✓ ' + tr('pm_invited', 'Invited') : tr('pm_invite', 'Invite'), 'pm-mini pm-inv', function () { if (typeof window.sendServerInvite === 'function') window.sendServerInvite(u.uid, String(u.username || 'Player')); b.textContent = '✓ ' + tr('pm_invited', 'Invited'); b.disabled = true; });
            if (sent) b.disabled = true;
            r.appendChild(b); box.appendChild(r);
        });
        return box;
    }
    function open() {
        if (!P() || !P().isPlaying()) return;
        if (P().setPaused) P().setPaused(true);
        show('main');
        root.style.display = 'flex';
        hideTab();
    }
    function closeNow() { if (galleryOpen()) { try { window.closeSkinGallery(); } catch (e) { /* nada */ } } if (root) root.style.display = 'none'; clearInterval(tabTimer); if (P() && P().setPaused) P().setPaused(false); }
    function close() { closeNow(); }
    function isOpen() { return !!(root && root.style.display !== 'none' && root.parentNode); }
    function back() {
        if (galleryOpen()) { try { window.closeSkinGallery(); } catch (e) { /* nada */ } return; }   // (Esc: primero se cierra la galería)
        if (page !== 'main') show('main'); else close();
    }

    // ------------------------------------------------------------------ Tab: lista de jugadores
    function showTab() {
        if (!tabEl) { tabEl = el('div', 'pm-tablist'); tabEl.id = 'play-tablist'; document.body.appendChild(tabEl); }
        playerRows(tabEl, false);
        tabEl.style.display = 'block';
        clearInterval(showTab.t); showTab.t = setInterval(function () { if (tabEl && tabEl.style.display !== 'none') playerRows(tabEl, false); }, 1000);
    }
    function hideTab() { if (tabEl) tabEl.style.display = 'none'; clearInterval(showTab.t); }
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || !P() || !P().isPlaying()) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        if (isOpen()) return;
        e.preventDefault(); e.stopPropagation();
        if (e.repeat) return;
        if (tabEl && tabEl.style.display === 'block') hideTab(); else showTab();
    }, true);
    // al salir del Modo Jugar, todo se esconde
    setInterval(function () { if (!(P() && P().isPlaying())) { if (isOpen()) closeNow(); hideTab(); } }, 500);

    window.mbwPlayMenu = { open: open, close: function (silent) { closeNow(); }, back: back, isOpen: isOpen, toggleTab: function () { if (tabEl && tabEl.style.display === 'block') hideTab(); else showTab(); }, showPage: show };
})();
