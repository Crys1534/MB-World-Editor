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
    // Comandos que entiende el juego, con un ejemplo para insertar
    const COMMANDS = [
        ['clear', 'clear'], ['clone', 'clone'], ['difficulty', 'difficulty hard'], ['enchant', 'enchant'], ['explode', 'explode 3'], ['fill', 'fill'],
        ['gamemode', 'gamemode 1'], ['gamerule', 'gamerule keepinventory true'], ['give', 'give'], ['heal', 'heal'], ['help', 'help'], ['home', 'home'],
        ['kill', 'kill'], ['lightning', 'lightning'], ['say', 'say Hello!'], ['seed', 'seed'], ['setblock', 'setblock'], ['spawnskin', 'spawnskin'],
        ['summon', 'summon'], ['time', 'time'], ['tp', 'tp'], ['weather', 'weather clear'], ['xp', 'xp']
    ];
    const NAMES = COMMANDS.map(function (c) { return c[0]; });
    let modal = null, editIndex = null, f = {};
    const tr = function (k, fb) { try { return (typeof window.tmsg === 'function' && window.tmsg(k, fb)) || fb; } catch (e) { return fb; } };
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
        head.appendChild(f.icon); head.appendChild(f.title); head.appendChild(x);
        const row = function (labelEl, inputEl) { const r = el('div', 'cb-row'); r.appendChild(labelEl); r.appendChild(inputEl); return r; };
        f.nameL = el('label', 'cb-label'); f.name = el('input', 'cb-input'); f.name.type = 'text'; f.name.maxLength = MAX_NAME;
        f.cmdL = el('label', 'cb-label'); f.cmd = el('input', 'cb-input'); f.cmd.type = 'text'; f.cmd.maxLength = MAX_CMD; f.cmd.spellcheck = false; f.cmd.autocomplete = 'off';
        f.pickL = el('label', 'cb-label'); f.pick = el('select', 'cb-input');
        f.usesL = el('label', 'cb-label'); f.uses = el('input', 'cb-input'); f.uses.type = 'number'; f.uses.min = '1'; f.uses.max = String(MAX_USES); f.uses.step = '1';
        f.usesH = el('div', 'cb-hint');
        f.msg = el('div', 'cb-msg'); f.cheats = el('div', 'cb-hint');
        const btns = el('div', 'cb-btns');
        f.save = el('button', 'cb-btn cb-save'); f.save.type = 'button';
        f.cancel = el('button', 'cb-btn'); f.cancel.type = 'button';
        btns.appendChild(f.save); btns.appendChild(f.cancel);
        [head, row(f.nameL, f.name), row(f.cmdL, f.cmd), row(f.pickL, f.pick), row(f.usesL, f.uses), f.usesH, f.msg, f.cheats, btns].forEach(function (n) { box.appendChild(n); });
        modal.appendChild(box); document.body.appendChild(modal);
        f.pick.addEventListener('change', function () { const v = f.pick.value; if (v) { f.cmd.value = v; f.pick.value = ''; validate(); f.cmd.focus(); } });
        f.cmd.addEventListener('input', validate);
        f.save.addEventListener('click', onSave); f.cancel.addEventListener('click', close);
        modal.addEventListener('mousedown', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function (e) { if (modal.style.display !== 'none' && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);
        f.cmd.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); onSave(); } });
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
        COMMANDS.forEach(function (c) { const o = el('option', '', c[0]); o.value = c[1]; f.pick.appendChild(o); });
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
        return r;
    }
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
        setTimeout(function () { f.cmd.focus(); }, 30);
    }
    function close() { if (modal) modal.style.display = 'none'; }
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
