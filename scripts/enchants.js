// ==========================================================================================
// ✨ ENCANTAMIENTOS DE MINE BLOCKS (lista única que usan TODAS las pantallas del editor)
// ------------------------------------------------------------------------------------------
// Fuentes:
//   · Wiki oficial "Enchanting" (nombre, nivel máximo y en qué objetos va cada uno).
//   · Claves REALES que guarda el juego en los mundos .mbw (se revisaron las estructuras de la comunidad):
//       - Con niveles:  nombre + número              ->  "sharpness4", "protectionFire3", "unbreaking4"
//       - De un solo nivel:  solo el nombre, SIN número ->  "silkTouch", "fireAspect", "flame", "infinity", "aguaAffinity"
//       - Van dentro de los "extras" del objeto con el valor "enchant":  { "sharpness4": "enchant" }
//       - Ojo con los nombres raros del juego: "protectionFalling" = Feather Falling, "aguaAffinity" = Aqua Affinity (con "agua").
// Este archivo se carga ANTES de ui-handler.js. Define:
//   MBW_ENCHANTS            lista de familias { id, name, max, on:[tipos de objeto] }
//   mbwEnchKey(id, nivel)   clave que escribe el juego
//   mbwEnchParse(clave)     { fam, level } (también entiende las claves viejas que escribía este editor)
//   mbwEnchLabel(clave)     "Sharpness IV", "Silk Touch"...
//   mbwEnchNormalize(obj)   copia del objeto con las claves viejas convertidas a las del juego
//   mbwEnchKind(idObjeto)   'sword' | 'axe' | 'pickaxe' | 'shovel' | 'hoe' | 'shear' | 'bow' | 'rod' | 'tool' | 'cap' | 'shirt' | 'pants' | 'shoes' | 'book' | 'other'
//   mbwEnchFamiliesFor(id)  familias que se le pueden poner a ese objeto
//   mbwEnchTable()          { clave: texto } con TODAS las claves (lo usa enchantTranslations)
//   mbwEnchPicker(host, o)  selector con acordeones (lo comparten el Creador de objetos y los drops del Mob Browser)
// ==========================================================================================
var MBW_ENCH_ARMOR = ['cap', 'shirt', 'pants', 'shoes'];
var MBW_ENCH_MELEE = ['sword', 'axe'];
var MBW_ENCHANTS = [
    // General: "cualquier herramienta" (wiki). Se le permite también a armas, armadura, arco y caña.
    { id: 'unbreaking', name: 'Unbreaking', max: 4, on: ['sword', 'axe', 'pickaxe', 'shovel', 'hoe', 'shear', 'bow', 'rod', 'tool', 'cap', 'shirt', 'pants', 'shoes'] },
    // Armas
    { id: 'sharpness', name: 'Sharpness', max: 4, on: MBW_ENCH_MELEE },
    { id: 'smite', name: 'Smite', max: 4, on: MBW_ENCH_MELEE },
    { id: 'baneOfArthropods', name: 'Bane of Arthropods', max: 3, on: MBW_ENCH_MELEE },
    { id: 'knockback', name: 'Knockback', max: 3, on: MBW_ENCH_MELEE },
    { id: 'fireAspect', name: 'Fire Aspect', max: 1, on: MBW_ENCH_MELEE },
    { id: 'looting', name: 'Looting', max: 3, on: MBW_ENCH_MELEE },
    // Herramientas
    { id: 'efficiency', name: 'Efficiency', max: 2, on: ['pickaxe', 'axe', 'shovel', 'shear'] },
    { id: 'silkTouch', name: 'Silk Touch', max: 1, on: ['pickaxe', 'axe', 'shovel', 'shear'] },
    { id: 'fortune', name: 'Fortune', max: 3, on: ['pickaxe', 'axe', 'shovel'] },
    // Arco
    { id: 'power', name: 'Power', max: 3, on: ['bow'] },
    { id: 'punch', name: 'Punch', max: 2, on: ['bow'] },
    { id: 'flame', name: 'Flame', max: 1, on: ['bow'] },
    { id: 'infinity', name: 'Infinity', max: 1, on: ['bow'] },
    // Armadura
    { id: 'protection', name: 'Protection', max: 5, on: MBW_ENCH_ARMOR },
    { id: 'protectionFire', name: 'Fire Protection', max: 3, on: MBW_ENCH_ARMOR },
    { id: 'protectionBlast', name: 'Blast Protection', max: 3, on: MBW_ENCH_ARMOR },
    { id: 'protectionProjectile', name: 'Projectile Protection', max: 3, on: MBW_ENCH_ARMOR },
    { id: 'thorns', name: 'Thorns', max: 3, on: ['shirt'] },
    { id: 'respiration', name: 'Respiration', max: 3, on: ['cap'] },
    { id: 'aguaAffinity', name: 'Aqua Affinity', max: 1, on: ['cap'] },
    { id: 'protectionFalling', name: 'Feather Falling', max: 3, on: ['shoes'] },
    { id: 'depthStrider', name: 'Depth Strider', max: 3, on: ['shoes'] },
    { id: 'frostWalker', name: 'Frost Walker', max: 2, on: ['shoes'] },
    // Caña de pescar
    { id: 'lure', name: 'Lure', max: 3, on: ['rod'] },
    { id: 'luckOfTheSea', name: 'Luck of the Sea', max: 3, on: ['rod'] }
];
// Pares que no se pueden juntar (wiki: Fortune y Silk Touch)
var MBW_ENCH_EXCLUSIVE = [['fortune', 'silkTouch']];
// Nombres con los que este editor escribía las claves antes (todo en minúsculas) -> familia real del juego
var MBW_ENCH_LEGACY = {
    fireprotection: 'protectionFire', blastprotection: 'protectionBlast', projectileprotection: 'protectionProjectile',
    featherfalling: 'protectionFalling', baneofarthropods: 'baneOfArthropods', fireaspect: 'fireAspect', silktouch: 'silkTouch',
    luckofthesea: 'luckOfTheSea', aquaaffinity: 'aguaAffinity', depthstrider: 'depthStrider', frostwalker: 'frostWalker'
};
var MBW_ENCH_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function mbwEnchFamily(id) {
    for (var i = 0; i < MBW_ENCHANTS.length; i++) if (MBW_ENCHANTS[i].id === id) return MBW_ENCHANTS[i];
    return null;
}
function mbwEnchKey(famId, level) {
    var f = mbwEnchFamily(famId);
    if (!f) return famId + (level || 1);
    return f.max === 1 ? f.id : f.id + level;
}
// "sharpness4" -> { fam: <familia>, level: 4 }.  Entiende las claves del juego y las que escribía el editor antes. null si no la conoce.
function mbwEnchParse(key) {
    if (typeof key !== 'string') return null;
    var m = /^([A-Za-z]+?)(\d{0,2})$/.exec(key);
    if (!m) return null;
    var base = m[1], lvl = m[2] === '' ? 1 : parseInt(m[2], 10);
    var fam = mbwEnchFamily(base);
    if (!fam) {
        var lower = base.toLowerCase();
        var legacy = MBW_ENCH_LEGACY[lower];
        if (legacy) fam = mbwEnchFamily(legacy);
        if (!fam) {
            for (var i = 0; i < MBW_ENCHANTS.length; i++) if (MBW_ENCHANTS[i].id.toLowerCase() === lower) { fam = MBW_ENCHANTS[i]; break; }
        }
    }
    if (!fam || !(lvl >= 1)) return null;
    return { fam: fam, level: lvl };
}
function mbwEnchLabelOf(fam, level) {
    if (fam.max === 1) return fam.name;
    return fam.name + ' ' + (MBW_ENCH_ROMAN[level] || level);
}
function mbwEnchLabel(key) {
    var p = mbwEnchParse(key);
    return p ? mbwEnchLabelOf(p.fam, p.level) : String(key);
}
// Búsqueda por nombre: "sharp" -> todas las claves de Sharpness; "sharpness iv" o "sharpness 4" -> solo el nivel IV.
// Compara con el nombre, el nivel (romano y número) y la clave del juego. Devuelve las claves en el orden de la tabla.
function mbwEnchSearch(query) {
    var q = String(query || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!q) return [];
    var out = [];
    MBW_ENCHANTS.forEach(function (fam) {
        for (var lvl = 1; lvl <= fam.max; lvl++) {
            var key = mbwEnchKey(fam.id, lvl);
            var hay = [fam.name + ' ' + (fam.max === 1 ? '' : MBW_ENCH_ROMAN[lvl]), fam.name + ' ' + lvl, key].join('|').toLowerCase().replace(/\s+/g, ' ');
            if (hay.indexOf(q) >= 0 && out.indexOf(key) < 0) out.push(key);
        }
    });
    return out;
}
// Devuelve una COPIA con las claves de encantamiento en el formato del juego (las demás claves no se tocan).
function mbwEnchNormalize(obj) {
    var out = {}, best = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(function (k) {
        if (obj[k] !== 'enchant') { out[k] = obj[k]; return; }
        var p = mbwEnchParse(k);
        if (!p) { out[k] = obj[k]; return; }          // clave desconocida: se respeta tal cual
        if (!best[p.fam.id] || p.level > best[p.fam.id]) best[p.fam.id] = p.level;
    });
    Object.keys(best).forEach(function (fid) { out[mbwEnchKey(fid, best[fid])] = 'enchant'; });
    return out;
}
// ¿Qué tipo de objeto es? (según su id)
function mbwEnchKind(id) {
    id = String(id || '');
    if (id === 'book' || id === 'ebook') return 'book';
    if (/Cap$/.test(id)) return 'cap';
    if (/Shirt$/.test(id)) return 'shirt';
    if (/Pants$/.test(id)) return 'pants';
    if (/Shoes$/.test(id)) return 'shoes';
    if (/Sword$/.test(id)) return 'sword';
    if (/Pickaxe$/.test(id)) return 'pickaxe';
    if (/Shovel$/.test(id)) return 'shovel';
    if (/Hoe$/.test(id)) return 'hoe';
    if (/Axe$/.test(id)) return 'axe';
    if (id === 'Shear') return 'shear';
    if (id === 'bow') return 'bow';
    if (id === 'fr') return 'rod';
    if (id === 'fas') return 'tool';              // encendedor
    return 'other';
}
function mbwEnchFamiliesFor(itemId) {
    var kind = mbwEnchKind(itemId);
    if (kind === 'book') return MBW_ENCHANTS.slice();                 // un libro encantado puede llevar cualquiera
    return MBW_ENCHANTS.filter(function (f) { return f.on.indexOf(kind) >= 0; });
}
function mbwEnchTable() {
    var t = {};
    MBW_ENCHANTS.forEach(function (f) {
        for (var l = 1; l <= f.max; l++) t[mbwEnchKey(f.id, l)] = mbwEnchLabelOf(f, l);
    });
    return t;
}
function mbwEnchConflicts(famA, famB) {
    for (var i = 0; i < MBW_ENCH_EXCLUSIVE.length; i++) {
        var p = MBW_ENCH_EXCLUSIVE[i];
        if ((p[0] === famA && p[1] === famB) || (p[1] === famA && p[0] === famB)) return true;
    }
    return false;
}
// Lista de textos de los encantamientos de unos "extras" (para tooltips y chapitas)
function mbwEnchListOf(extras) {
    var out = [];
    if (!extras || typeof extras !== 'object') return out;
    Object.keys(extras).forEach(function (k) { if (extras[k] === 'enchant') out.push(mbwEnchLabel(k)); });
    return out;
}

// ------------------------------------------------------------------------------------------
// Selector con acordeones
//   host   : elemento donde se dibuja
//   o.item : id del objeto (decide qué encantamientos salen)  — o  o.families: lista de familias
//   o.data : objeto con los encantamientos { clave: 'enchant' } (se modifica directamente)
//   o.open : (opcional) objeto { familia: true } para recordar qué acordeones están abiertos
//   o.onChange(data) : se llama después de cada cambio
// Un encantamiento con varios niveles es un acordeón; al abrirlo salen todos sus niveles (se marca uno solo).
// Uno de un solo nivel (Silk Touch, Flame...) es un botón normal.
// Devuelve { refresh() } para repintar los estados si el objeto "data" cambió por fuera.
// ------------------------------------------------------------------------------------------
(function () {
    var st = document.createElement('style');
    st.id = 'mbw-ench-css';
    st.textContent = [
        '.ench-acc{display:block;margin:0 0 4px 0}',
        '.ench-acc>summary{list-style:none;cursor:pointer}',
        '.ench-acc>summary::-webkit-details-marker{display:none}',
        '.ench-acc>summary::before{content:"\\25B8";display:inline-block;width:14px;flex:0 0 14px;position:relative;z-index:10;pointer-events:none}',
        '.ench-acc[open]>summary::before{content:"\\25BE"}',
        '.ench-sum,.ench-single{box-sizing:border-box;padding:8px 10px;font-weight:bold;user-select:none;justify-content:space-between}',
        '.ench-name{position:relative;z-index:10;pointer-events:none;flex:1}',
        '.ench-badge{position:relative;z-index:10;pointer-events:none;margin-left:8px;font-size:12px;color:#7a2bd6;display:none}',
        '.ench-acc .active-enchant .ench-badge,.enchant-option.active-enchant .ench-badge{display:inline;color:#ffaa00}',
        '.ench-levels{display:flex;flex-wrap:wrap;gap:4px;padding:4px 0 2px 14px}',
        '.ench-lvl{box-sizing:border-box;padding:6px 10px;font-weight:bold;user-select:none;min-height:30px!important}',
        '.ench-lvl>span{position:relative;z-index:10;pointer-events:none}',
        '.ench-empty{padding:10px;color:#222;font-size:13px}'
    ].join('\n');
    document.head.appendChild(st);
})();

function mbwEnchPicker(host, o) {
    o = o || {};
    var data = o.data || {};
    var open = o.open || {};
    host.innerHTML = '';
    // o.free = "cualquier encantamiento en cualquier objeto": todos los encantamientos y sin los que se excluyen entre sí
    var fams = o.families || (o.free ? MBW_ENCHANTS.slice() : mbwEnchFamiliesFor(o.item));
    // los más fáciles de encontrar: por orden alfabético
    fams = fams.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!fams.length) {
        var none = document.createElement('div');
        none.className = 'ench-empty';
        none.textContent = typeof t === 'function' ? t('ench_none') : "This item can't be enchanted.";
        host.appendChild(none);
        return { refresh: function () {} };
    }
    var rows = [];

    function activeLevel(fam) {
        var best = 0;
        Object.keys(data).forEach(function (k) {
            if (data[k] !== 'enchant') return;
            var p = mbwEnchParse(k);
            if (p && p.fam.id === fam.id && p.level > best) best = p.level;
        });
        return best;
    }
    function setLevel(fam, level) {      // level 0 = quitar
        Object.keys(data).forEach(function (k) {
            var p = mbwEnchParse(k);
            if (data[k] === 'enchant' && p && p.fam.id === fam.id) delete data[k];
        });
        if (level > 0) data[mbwEnchKey(fam.id, level)] = 'enchant';
    }
    function activeFamilies() {
        var out = {};
        Object.keys(data).forEach(function (k) {
            var p = mbwEnchParse(k);
            if (data[k] === 'enchant' && p) out[p.fam.id] = true;
        });
        return out;
    }
    function refresh() {
        var act = activeFamilies();
        rows.forEach(function (r) {
            var lvl = activeLevel(r.fam);
            var blocked = false;
            if (!o.free) Object.keys(act).forEach(function (fid) { if (fid !== r.fam.id && mbwEnchConflicts(fid, r.fam.id)) blocked = true; });
            r.head.classList.toggle('active-enchant', lvl > 0);
            r.head.classList.toggle('disabled-enchant', blocked && lvl === 0);
            if (r.badge) r.badge.textContent = lvl > 0 ? (MBW_ENCH_ROMAN[lvl] || String(lvl)) : '';
            r.levels.forEach(function (b) {
                b.el.classList.toggle('active-enchant', b.level === lvl);
            });
        });
    }
    function change() { refresh(); if (typeof o.onChange === 'function') o.onChange(data); }

    fams.forEach(function (fam) {
        var cur = activeLevel(fam);
        var row = { fam: fam, levels: [], badge: null, head: null };
        if (fam.max === 1) {
            var btn = document.createElement('div');
            btn.className = 'enchant-option ench-single';
            btn.dataset.enchKey = mbwEnchKey(fam.id, 1);
            btn.dataset.fam = fam.id;
            btn.innerHTML = '<span class="ench-name"></span>';
            btn.firstChild.textContent = fam.name;
            btn.onclick = function () {
                if (btn.classList.contains('disabled-enchant')) return;
                setLevel(fam, activeLevel(fam) > 0 ? 0 : 1);
                change();
            };
            row.head = btn;
            row.levels.push({ level: 1, el: btn });
            host.appendChild(btn);
        } else {
            var det = document.createElement('details');
            det.className = 'ench-acc';
            det.dataset.fam = fam.id;
            det.open = !!open[fam.id] || cur > 0;
            det.addEventListener('toggle', function () { open[fam.id] = det.open; });
            var sum = document.createElement('summary');
            sum.className = 'enchant-option ench-sum';
            var nm = document.createElement('span'); nm.className = 'ench-name'; nm.textContent = fam.name;
            var bd = document.createElement('span'); bd.className = 'ench-badge';
            sum.appendChild(nm); sum.appendChild(bd);
            det.appendChild(sum);
            var box = document.createElement('div');
            box.className = 'ench-levels';
            var top = Math.max(fam.max, cur);               // si un objeto trae un nivel más alto que el máximo, se muestra para poder quitarlo
            for (var l = 1; l <= top; l++) {
                (function (level) {
                    var b = document.createElement('div');
                    b.className = 'enchant-option ench-lvl';
                    b.dataset.enchKey = mbwEnchKey(fam.id, level);
                    b.dataset.fam = fam.id;
                    b.dataset.level = String(level);
                    var sp = document.createElement('span'); sp.textContent = mbwEnchLabelOf(fam, level);
                    b.appendChild(sp);
                    b.onclick = function () {
                        setLevel(fam, activeLevel(fam) === level ? 0 : level);     // clic en el nivel puesto = quitarlo
                        change();
                    };
                    box.appendChild(b);
                    row.levels.push({ level: level, el: b });
                })(l);
            }
            det.appendChild(box);
            row.head = sum;
            row.badge = bd;
            host.appendChild(det);
        }
        rows.push(row);
    });
    refresh();
    return { refresh: refresh };
}
