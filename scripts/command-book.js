// =====================================================================
// 📕 Create Command Book (grupo "Custom Items")
// =====================================================================
// El Command Book ("cbook") es un libro del juego que ejecuta un comando al hacer clic derecho con él en la mano.
// En el juego sus datos son: command (el texto del comando) y uses (cuántas veces se puede usar; si no tiene, es infinito).
// Aquí se crea uno con nombre, comando y usos, y se guarda en la pestaña Custom del inventario (clave 'mbw_custom_items',
// igual que los demás objetos personalizados): ["cbook", 1, 0, { command, uses?, name? }].
// Para que el comando funcione en el juego, el mundo debe tener los comandos activados (casilla "Commands").
// La lista de comandos válidos sale del código del juego (Game.interpretCommand).
(function () {
    'use strict';
    const KEY = 'mbw_custom_items';
    const MAX_CMD = 200, MAX_NAME = 40, MAX_USES = 9999;
    // Comandos que entiende el juego (Game.interpretCommand). usage = su texto de ayuda en el juego; ex = ejemplo para insertar;
    // slots = dónde van las coordenadas "x y" (at = posición de la palabra, contando el comando como 0; need = cuántas palabras hacen falta antes).
    const COMMANDS = [
        { n: 'clear', usage: 'clear itemname [quantity|-1] [damage|-1] [data_tags]', ex: 'clear' },
        { n: 'clone', usage: 'clone [~]x1 [~]y1 width height [~]xDest [~]yDest', ex: 'clone', slots: [{ at: 1, need: 1, l: 'cb_pick_source' }, { at: 5, need: 5, l: 'cb_pick_dest' }] },
        { n: 'difficulty', usage: 'difficulty peaceful|easy|normal|hard', ex: 'difficulty hard' },
        { n: 'enchant', usage: 'enchant enchantment_id', ex: 'enchant' },
        { n: 'explode', usage: 'explode size [[~]x [~]y]', ex: 'explode 3', slots: [{ at: 2, need: 2 }] },
        { n: 'fill', usage: 'fill block_type [~]x [~]y width height', ex: 'fill', slots: [{ at: 2, need: 2 }] },
        { n: 'gamemode', usage: 'gamemode survival|creative|adventure|spectator', ex: 'gamemode creative' },
        { n: 'gamerule', usage: 'gamerule rule [true|false]', ex: 'gamerule keepinventory true' },
        { n: 'give', usage: 'give itemname [quantity] [damage] [data_tags]', ex: 'give' },
        { n: 'heal', usage: 'heal', ex: 'heal' },
        { n: 'help', usage: 'help', ex: 'help' },
        { n: 'home', usage: 'home get | home set [~]x [~]y', ex: 'home get', slots: [{ at: 2, need: 2, when: function (t) { return t[1] === 'set'; } }] },
        { n: 'kill', usage: 'kill', ex: 'kill' },
        { n: 'lightning', usage: 'lightning [[~]x [~]y]', ex: 'lightning', slots: [{ at: 1, need: 1 }] },
        { n: 'say', usage: 'say message', ex: 'say Hello!' },
        { n: 'seed', usage: 'seed', ex: 'seed' },
        { n: 'setblock', usage: 'setblock block_type [~]x [~]y [replace|keep|destroy]', ex: 'setblock', slots: [{ at: 2, need: 2 }] },
        { n: 'spawnskin', usage: 'spawnskin', ex: 'spawnskin' },
        { n: 'summon', usage: 'summon mob_type [quantity] [[~]x [~]y] [data_tags]', ex: 'summon pig 1', slots: [{ at: 3, need: 3 }] },
        { n: 'time', usage: 'time get | time set t|day|night', ex: 'time set day' },
        { n: 'tp', usage: 'tp [~]x [~]y', ex: 'tp', slots: [{ at: 1, need: 1 }] },
        { n: 'weather', usage: 'weather clear|rain|thunder', ex: 'weather clear' },
        { n: 'xp', usage: 'xp [add] value[L]', ex: 'xp add 10' }
    ];
    const NAMES = COMMANDS.map(function (c) { return c.n; });
    const byName = function (n) { for (let i = 0; i < COMMANDS.length; i++) if (COMMANDS[i].n === n) return COMMANDS[i]; return null; };
    // Valores sugeridos para la palabra N de un comando: [comando][posición] -> lista
    const ARGS = {
        gamemode: { 1: ['survival', 'creative', 'adventure', 'spectator'] },
        weather: { 1: ['clear', 'rain', 'thunder'] },
        difficulty: { 1: ['peaceful', 'easy', 'normal', 'hard'] },
        time: { 1: ['get', 'set'], 2: ['day', 'night'] },
        home: { 1: ['get', 'set'] },
        xp: { 1: ['add'] },
        gamerule: { 2: ['true', 'false'] },
        setblock: { 4: ['replace', 'keep', 'destroy'] }
    };
    // Los comandos usan el "identificador" del bloque (stone, glowstone, command_book...), no el id interno del editor
    function blockIds() { const b = window.MB_GAME && window.MB_GAME.identifiers; return b ? Object.keys(b) : []; }
    function blockName(id) { const b = window.MB_GAME && window.MB_GAME.identifiers && window.MB_GAME.identifiers[id]; return b ? b[1] : ''; }
    function argList(cmd, pos) {
        if (ARGS[cmd] && ARGS[cmd][pos]) return ARGS[cmd][pos].map(function (v) { return { v: v, d: '' }; });
        const g = window.MB_GAME;
        if (cmd === 'gamerule' && pos === 1 && g && g.gameRules) return Object.keys(g.gameRules).map(function (v) { return { v: v, d: '' }; });
        if (pos === 1 && (cmd === 'setblock' || cmd === 'fill' || cmd === 'give' || cmd === 'clear')) return blockIds().map(function (id) { return { v: id, d: blockName(id) }; });
        if (pos === 1 && cmd === 'summon' && g && g.mobs) return Object.keys(g.mobs).filter(function (k) { return k !== 'player'; }).map(function (k) { return { v: k, d: g.mobs[k].name }; });
        return [];
    }
    let modal = null, editIndex = null, f = {}, sugBox = null, sugItems = [], sugSel = 0, sugRange = null, picking = null;
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
    // Celular / tablet: el teclado NO se abre solo al abrir la ventana (solo cuando se toca un cuadro de texto),
    // y se puede cerrar con el botón ⌨ de arriba, tocando fuera de los cuadros o con "Listo" del teclado.
    const isTouch = function () { return !!((window.mbwMobile && window.mbwMobile.touch) || document.body.classList.contains('is-touch') || document.body.classList.contains('is-phone')); };
    const focusCmd = function () { if (!isTouch() && f.cmd) f.cmd.focus(); };
    const el = function (tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    function load() { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function save(a) { localStorage.setItem(KEY, JSON.stringify(a)); }

    window.mbwCommandBookCheck = function (text) {
        const t = String(text == null ? '' : text).trim().replace(/^[\/\\]/, '').trim();
        if (!t) return { ok: false, reason: 'empty' };
        const first = t.split(/\s+/)[0].toLowerCase();
        if (NAMES.indexOf(first) < 0 && first !== 'cheats' && first !== 'cls') return { ok: true, warn: 'unknown', word: first };
        return { ok: true };
    };

    function drawIcon(cv) {
        if (!cv) return;
        const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
        try {
            const o = (typeof getBlockObject === 'function') ? getBlockObject({ type: 'cbook' }) : null;
            if (o && window.images && window.images.blocks && window.images.blocks.complete) ctx.drawImage(window.images.blocks, o.x, o.y, 16, 16, 0, 0, cv.width, cv.height);
        } catch (e) { /* sin imagen todavía */ }
    }
    window.mbwCommandBookIcons = function () { drawIcon(document.getElementById('cb-btn-icon')); if (f.icon) drawIcon(f.icon); };

    function build() {
        if (modal) return;
        modal = el('div', 'cb-modal'); modal.id = 'command-book-modal'; modal.style.display = 'none';
        const box = el('div', 'cb-box'); box.setAttribute('role', 'dialog');
        const head = el('div', 'cb-head');
        f.icon = el('canvas', 'cb-icon'); f.icon.width = 48; f.icon.height = 48;
        f.title = el('div', 'cb-title');
        const x = el('button', 'cb-x', '✕'); x.type = 'button'; x.addEventListener('click', close);
        f.kb = el('button', 'cb-kb'); f.kb.type = 'button'; f.kb.style.display = 'none';
        f.kb.innerHTML = '⌨<small>▾</small>'; f.kb.title = tr('cb_hide_keyboard', 'Hide keyboard');
        f.kb.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        f.kb.addEventListener('click', function () { const a = document.activeElement; if (a && a.blur) a.blur(); f.kb.style.display = 'none'; });
        head.appendChild(f.icon); head.appendChild(f.title); head.appendChild(f.kb); head.appendChild(x);
        const row = function (labelEl, inputEl) { const r = el('div', 'cb-row'); r.appendChild(labelEl); r.appendChild(inputEl); return r; };
        f.nameL = el('label', 'cb-label'); f.name = el('input', 'cb-input'); f.name.type = 'text'; f.name.maxLength = MAX_NAME;
        f.cmdL = el('label', 'cb-label'); f.cmd = el('input', 'cb-input'); f.cmd.type = 'text'; f.cmd.maxLength = MAX_CMD; f.cmd.spellcheck = false; f.cmd.autocomplete = 'off';
        f.pickL = el('label', 'cb-label'); f.pick = el('select', 'cb-input');
        f.usesL = el('label', 'cb-label'); f.uses = el('input', 'cb-input'); f.uses.type = 'number'; f.uses.min = '1'; f.uses.max = String(MAX_USES); f.uses.step = '1';
        f.usesH = el('div', 'cb-hint');
        f.usage = el('div', 'cb-usage'); f.slots = el('div', 'cb-slots'); f.slotHint = el('div', 'cb-hint');
        f.msg = el('div', 'cb-msg'); f.cheats = el('div', 'cb-hint');
        const btns = el('div', 'cb-btns');
        f.save = el('button', 'cb-btn cb-save'); f.save.type = 'button';
        f.cancel = el('button', 'cb-btn'); f.cancel.type = 'button';
        btns.appendChild(f.save); btns.appendChild(f.cancel);
        [head, row(f.nameL, f.name), row(f.cmdL, f.cmd), f.usage, f.slots, f.slotHint, row(f.pickL, f.pick), row(f.usesL, f.uses), f.usesH, f.msg, f.cheats, btns].forEach(function (n) { box.appendChild(n); });
        modal.appendChild(box); document.body.appendChild(modal);
        f.pick.addEventListener('change', function () { const v = f.pick.value; if (v) { f.cmd.value = v; f.pick.value = ''; validate(); focusCmd(); } });
        f.cmd.enterKeyHint = 'done'; f.name.enterKeyHint = 'done'; f.uses.enterKeyHint = 'done';
        [f.name, f.cmd, f.uses].forEach(function (inp) {
            inp.addEventListener('focus', function () { if (isTouch()) f.kb.style.display = ''; });
            inp.addEventListener('blur', function () { setTimeout(function () { const a = document.activeElement; if (!a || [f.name, f.cmd, f.uses].indexOf(a) < 0) f.kb.style.display = 'none'; }, 0); });
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && isTouch()) { e.preventDefault(); e.stopImmediatePropagation(); hideSug(); inp.blur(); } }, true);
        });
        // tocar fuera de los cuadros de texto cierra el teclado
        box.addEventListener('pointerdown', function (e) {
            if (!isTouch()) return;
            const t = e.target; if (t && t.closest && t.closest('input,select,textarea,button,.cb-sug')) return;
            const a = document.activeElement; if (a && a.blur && box.contains(a)) a.blur();
        });
        f.cmd.addEventListener('input', function () { validate(); suggest(); });
        f.cmd.addEventListener('click', suggest);
        f.cmd.addEventListener('blur', function () { setTimeout(hideSug, 150); });
        f.cmd.addEventListener('keydown', onSugKey, true);
        f.save.addEventListener('click', onSave); f.cancel.addEventListener('click', close);
        modal.addEventListener('mousedown', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function (e) {
            if (modal.style.display === 'none' || e.key !== 'Escape') return;
            e.stopPropagation();
            if (sugBox && sugBox.style.display !== 'none') { hideSug(); return; }   // primero se cierra la lista de sugerencias
            close();
        }, true);
        f.cmd.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !(sugBox && sugBox.style.display !== 'none')) { e.preventDefault(); onSave(); } });
        texts();
    }
    function texts() {
        if (!modal) return;
        f.title.textContent = editIndex === null ? tr('cb_title', 'Create Command Book') : tr('cb_title_edit', 'Edit Command Book');
        f.nameL.textContent = tr('cb_name', 'Name (optional)');
        f.name.placeholder = tr('cb_name_ph', 'Command Book');
        f.cmdL.textContent = tr('cb_command', 'Command');
        f.cmd.placeholder = tr('cb_command_ph', 'e.g. weather clear');
        f.pickL.textContent = tr('cb_pick', 'Insert an example');
        f.pick.textContent = '';
        const o0 = el('option', '', tr('cb_pick_ph', '— choose a command —')); o0.value = ''; f.pick.appendChild(o0);
        COMMANDS.forEach(function (c) { const o = el('option', '', c.n); o.value = c.ex; f.pick.appendChild(o); });
        f.usesL.textContent = tr('cb_uses', 'Uses (optional)');
        f.usesH.textContent = tr('cb_uses_hint', 'Empty = unlimited. With a number, the book disappears when the uses run out.');
        f.cheats.textContent = tr('cb_cheats', 'In the game the book only works if the world has commands enabled ("Commands" checkbox in World Settings).');
        f.save.textContent = tr('cb_save', 'Save to Custom');
        f.cancel.textContent = tr('cb_cancel', 'Cancel');
        validate();
    }
    window.mbwCommandBookOnLanguageChanged = texts;
    function validate() {
        const r = window.mbwCommandBookCheck(f.cmd.value);
        f.save.disabled = !r.ok;
        f.msg.className = 'cb-msg' + (r.warn ? ' warn' : '');
        if (!r.ok) f.msg.textContent = tr('cb_empty', 'Write the command the book will run.');
        else if (r.warn) f.msg.textContent = tr('cb_unknown', 'The game does not know the command "{w}". The book will be saved anyway.').replace('{w}', r.word);
        else f.msg.textContent = '';
        paintUsage();
        return r;
    }
    function tokens() { return f.cmd.value.trim().replace(/^[\/\\]/, '').trim().split(/\s+/).filter(Boolean); }
    function paintUsage() {
        const t = tokens(), c = t.length ? byName((t[0] || '').toLowerCase()) : null;
        f.usage.textContent = c ? tr('cb_usage', 'Usage') + ': ' + c.usage : '';
        f.usage.style.display = c ? '' : 'none';
        f.slots.textContent = ''; f.slotHint.textContent = '';
        if (!c || !c.slots) return;
        c.slots.forEach(function (sl) {
            if (sl.when && !sl.when(t)) return;
            const b = el('button', 'cb-btn cb-pos', '📍 ' + tr(sl.l || 'cb_pick_pos', 'Pick position on the map')); b.type = 'button';
            const ready = t.length >= sl.need;
            b.disabled = !ready;
            b.addEventListener('click', function () { startPick(sl, c); });
            f.slots.appendChild(b);
            if (!ready) f.slotHint.textContent = tr('cb_pick_need', 'Write the first values of the command first (before the position).');
        });
    }
    // ---- sugerencias al escribir (comandos y valores)
    function hideSug() { if (sugBox) sugBox.style.display = 'none'; sugItems = []; sugRange = null; }
    function suggest() {
        if (!sugBox) { sugBox = el('div', 'cb-sug'); sugBox.style.display = 'none'; document.body.appendChild(sugBox); }
        const v = f.cmd.value, pos = typeof f.cmd.selectionStart === 'number' ? f.cmd.selectionStart : v.length;
        const before = v.slice(0, pos);
        const m = /(\S*)$/.exec(before), cur = m ? m[1] : '', start = pos - cur.length;
        const words = before.slice(0, start).trim().replace(/^[\/\\]/, '').trim().split(/\s+/).filter(Boolean);
        const idx = words.length;                                   // posición de la palabra que se está escribiendo
        let list = [];
        const q = cur.replace(/^[\/\\]/, '').toLowerCase();
        if (idx === 0) list = COMMANDS.map(function (c) { return { v: c.n, d: c.usage }; });
        else list = argList(words[0].toLowerCase(), idx);
        list = list.filter(function (o) { return !q || o.v.toLowerCase().indexOf(q) === 0 || (idx > 0 && q.length > 1 && ((o.d || '').toLowerCase().indexOf(q) >= 0 || o.v.toLowerCase().indexOf(q) >= 0)); });
        if (q) list = list.filter(function (o) { return o.v.toLowerCase().indexOf(q) === 0; }).concat(list.filter(function (o) { return o.v.toLowerCase().indexOf(q) !== 0; }));   // primero los que empiezan igual
        if (list.length === 1 && list[0].v.toLowerCase() === q) list = [];
        sugItems = list.slice(0, 8);
        sugRange = [start + (idx === 0 && /^[\/\\]/.test(cur) ? 1 : 0), pos];
        if (sugSel >= sugItems.length) sugSel = 0;
        paintSug();
    }
    function paintSug() {
        if (!sugItems.length) { hideSug(); return; }
        sugBox.textContent = '';
        sugItems.forEach(function (o, i) {
            const r = el('div', 'cb-sug-item' + (i === sugSel ? ' on' : ''));
            r.appendChild(el('b', null, o.v));
            if (o.d) r.appendChild(el('span', null, o.d));
            r.addEventListener('mousedown', function (e) { e.preventDefault(); pickSug(i); });
            sugBox.appendChild(r);
        });
        sugBox.style.display = 'flex';
        const rc = f.cmd.getBoundingClientRect();
        sugBox.style.left = Math.max(8, rc.left) + 'px';
        sugBox.style.width = Math.min(rc.width, window.innerWidth - 16) + 'px';
        const h = sugBox.offsetHeight;
        sugBox.style.top = (rc.bottom + 2 + h > window.innerHeight - 8 ? Math.max(8, rc.top - h - 2) : rc.bottom + 2) + 'px';
    }
    function pickSug(i) {
        const o = sugItems[i]; if (!o || !sugRange) return;
        const v = f.cmd.value, ins = o.v + ' ';
        f.cmd.value = v.slice(0, sugRange[0]) + ins + v.slice(sugRange[1]);
        const pos = sugRange[0] + ins.length;
        hideSug();
        f.cmd.focus(); try { f.cmd.setSelectionRange(pos, pos); } catch (e) { /* nada */ }
        validate(); suggest();
    }
    function onSugKey(e) {
        if (!sugBox || sugBox.style.display === 'none' || !sugItems.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); sugSel = (sugSel + 1) % sugItems.length; paintSug(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); sugSel = (sugSel - 1 + sugItems.length) % sugItems.length; paintSug(); }
        else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); pickSug(sugSel); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hideSug(); }
    }
    // ---- elegir una posición en el mapa
    function worldAt(ev) {
        const cv = document.getElementById('canvas');
        if (!cv || typeof camera === 'undefined' || typeof tileSize === 'undefined') return null;
        const r = cv.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return null;
        const cx = (ev.clientX - r.left) * (cv.width / r.width), cy = cv.height - (ev.clientY - r.top) * (cv.height / r.height);
        return { x: Math.floor(camera.x + cx / tileSize), y: Math.floor(camera.y + cy / tileSize) };
    }
    function startPick(slot, cmd) {
        if (picking) return;
        const banner = el('div', 'cb-pick-banner');
        const txt = el('span', null, tr('cb_pick_banner', 'Click on the map to choose the position. Esc cancels.'));
        const pos = el('b', 'cb-pick-pos');
        const cancel = el('button', 'cb-btn', tr('cb_cancel', 'Cancel')); cancel.type = 'button';
        banner.appendChild(txt); banner.appendChild(pos); banner.appendChild(cancel);
        document.body.appendChild(banner);
        document.body.classList.add('cb-picking');
        modal.style.display = 'none'; hideSug();
        const swallow = function (e) {
            if (e.target && e.target.closest && e.target.closest('.cb-pick-banner')) return;
            e.stopImmediatePropagation(); e.preventDefault();
        };
        const onMove = function (e) { const w = worldAt(e); pos.textContent = w ? 'X: ' + w.x + '  Y: ' + w.y : ''; };
        const onUp = function (e) {
            if (touchMode) return;
            if (e.target && e.target.closest && e.target.closest('.cb-pick-banner')) return;
            const w = worldAt(e);
            if (!w) return;
            stop(true);
            insertPos(slot, w.x, w.y);
        };
        const onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); stop(false); } };
        // Celular / tablet: los dedos los maneja mobile.js (mover el mapa, zoom con dos dedos); un toque deja una marca y se pide confirmación
        const touchMode = !!(window.mbwMobile && window.mbwMobile.touch);
        let chosen = null, raf = 0, marker = null, okBtn = null;
        if (touchMode) {
            banner.classList.add('cb-pick-touch');
            txt.textContent = tr('cb_pick_banner_touch', 'Drag to move the map and tap to mark the position.');
            okBtn = el('button', 'cb-btn cb-btn-ok', tr('cb_confirm', 'Confirm')); okBtn.type = 'button'; okBtn.disabled = true;
            banner.insertBefore(okBtn, cancel);
            marker = el('div', 'cb-pick-marker'); marker.style.display = 'none'; document.body.appendChild(marker);
            okBtn.addEventListener('click', function () { if (!chosen) return; const c = chosen; stop(true); insertPos(slot, c.x, c.y); });
            const place = function () {
                if (chosen && typeof camera !== 'undefined') {
                    const cv = document.getElementById('canvas'), r = cv.getBoundingClientRect();
                    const sx = ((chosen.x + 0.5) - camera.x) * tileSize, sy = cv.height - ((chosen.y + 0.5) - camera.y) * tileSize;
                    let px = r.left + sx * (r.width / cv.width), py = r.top + sy * (r.height / cv.height);
                    if (window.mbwAspect && window.mbwAspect.active && window.mbwAspect.mapWorld) { /* con Aspect activo la marca puede salir corrida; el valor sí es correcto */ }
                    const inside = px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
                    marker.style.display = inside ? 'block' : 'none';
                    marker.style.left = px + 'px'; marker.style.top = py + 'px';
                    marker.style.width = marker.style.height = Math.max(14, tileSize * (r.width / cv.width)) + 'px';
                }
                raf = requestAnimationFrame(place);
            };
            raf = requestAnimationFrame(place);
            window.mbwMobile.pickCb = function (x, y) {
                const w = worldAt({ clientX: x, clientY: y });
                if (!w) return;
                chosen = w; pos.textContent = 'X: ' + w.x + '  Y: ' + w.y; okBtn.disabled = false;
            };
        }
        const down = touchMode ? ['pointerdown', 'mousedown', 'click', 'contextmenu'] : ['pointerdown', 'mousedown', 'touchstart', 'click', 'contextmenu'];
        function stop(done) {
            down.forEach(function (n) { window.removeEventListener(n, swallow, true); });
            window.removeEventListener('pointerup', onUp, true);
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('keydown', onKey, true);
            if (touchMode) { cancelAnimationFrame(raf); if (marker) marker.remove(); if (window.mbwMobile) window.mbwMobile.pickCb = null; }
            banner.remove(); document.body.classList.remove('cb-picking'); picking = null;
            // el clic que eligió la posición no debe llegar a las herramientas: se espera a que se suelte
            setTimeout(function () { modal.style.display = 'flex'; focusCmd(); }, done ? 60 : 0);
        }
        down.forEach(function (n) { window.addEventListener(n, swallow, true); });
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('keydown', onKey, true);
        cancel.addEventListener('click', function () { stop(false); });
        picking = { stop: stop };
    }
    // Pone "x y" en el lugar de la posición (reemplaza si ya había números ahí)
    function insertPos(slot, x, y) {
        const t = tokens();
        const head = f.cmd.value.trim().match(/^[\/\\]?/)[0];
        while (t.length < slot.at) t.push('');
        t[slot.at] = String(x); t[slot.at + 1] = String(y);
        f.cmd.value = head + t.filter(function (w, i) { return w !== '' || i >= slot.at; }).join(' ');
        validate();
    }
    window.mbwCommandBookPick = { insertPos: insertPos };
    function open(index) {
        build();
        editIndex = (typeof index === 'number' && index >= 0) ? index : null;
        f.name.value = ''; f.cmd.value = ''; f.uses.value = '';
        if (editIndex !== null) {
            const it = load()[editIndex];
            if (it && it[0] === 'cbook') {
                const n = it[3] || {};
                f.name.value = typeof n.name === 'string' ? n.name : (typeof n.nameChange === 'string' ? n.nameChange : '');
                f.cmd.value = typeof n.command === 'string' ? n.command : '';
                f.uses.value = Number.isFinite(Number(n.uses)) && Number(n.uses) > 0 ? String(Math.floor(Number(n.uses))) : '';
            } else editIndex = null;
        }
        texts();
        modal.style.display = 'flex';
        drawIcon(f.icon);
        // La ventana se abre SIN ningún cuadro elegido (en el celular así no sale el teclado solo); se escribe al tocar un cuadro
        try { if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* nada */ }
    }
    function close() { hideSug(); if (picking) picking.stop(false); if (modal) modal.style.display = 'none'; }
    function onSave() {
        const r = validate();
        if (!r.ok) return;
        const cmd = f.cmd.value.trim().slice(0, MAX_CMD);
        const extra = { command: cmd };
        const u = parseInt(f.uses.value, 10);
        if (Number.isFinite(u) && u > 0) extra.uses = Math.min(u, MAX_USES);
        const nm = f.name.value.trim().slice(0, MAX_NAME);
        if (nm) extra.name = nm;
        const list = load();
        if (editIndex !== null && list[editIndex] && list[editIndex][0] === 'cbook') list[editIndex] = ['cbook', 1, 0, extra];
        else list.push(['cbook', 1, 0, extra]);
        save(list);
        close();
        if (typeof populateInventory === 'function') { try { populateInventory(); } catch (e) { /* inventario cerrado */ } }
    }
    window.openCommandBookModal = open;
    window.addEventListener('mbw-lang-changed', texts);
    window.addEventListener('load', function () { setTimeout(window.mbwCommandBookIcons, 600); setTimeout(window.mbwCommandBookIcons, 2500); });
})();
