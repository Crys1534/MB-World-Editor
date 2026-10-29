// ==============================================================
// MOB BROWSER + ventana "Custom Mob" + pestaña "Custom"
// ==============================================================
// Qué hace este archivo (todo lo del Mob Browser vive aquí):
//   - Dibuja la cuadrícula de mobs (pestañas Animals / Overworld / Nether / End / Custom).
//   - Al elegir un mob, la barra lateral del Mob Browser SOLO lo muestra: su imagen, su nombre, sus datos
//     (Health, Charged, Aggro...) y una casilla por cada drop. Tiene dos botones: "Spawn Mob" y "Customize Mob".
//   - "Customize Mob" abre la ventana "Custom Mob" (#custom-mob-modal): son dos ventanas pegadas.
//     Izquierda = imagen y nombre del mob. Derecha = todo lo que se edita, en 4 columnas:
//     Basic | Equipment | Custom Drops | Mob-Specific, y abajo los botones (Apply to this mob, Save to Custom, Reset...).
//     Cada mob muestra SOLO los datos que admite (por ejemplo: zombie => armadura, creeper => cargado, slime => tamaño,
//     oveja => color...). La lista de qué mob admite qué sale de la wiki de Mine Blocks (Data tags > Mob Tags)
//     y de los mundos reales; está en la tabla SCHEMA de abajo.
//   - "Spawn Mob" activa la herramienta de spawn con esos datos: cada clic en el mundo
//     crea un mob NUEVO con los valores del panel (ver applyMobSpec).
//   - "Save to Custom" guarda lo del panel como plantilla en la pestaña Custom
//     (se guarda en el navegador, en localStorage, clave 'mbw_mob_presets').
//   - Los objetos (mano, armadura, drops) se eligen con el MISMO inventario del editor
//     (la tecla E): pickItem() lo abre en "modo elegir" y ui-handler.js le devuelve el objeto.
//
// FORMATOS (verificados con mundos reales .mbw: "Biomes 1.2", "SnowyLand 1.4 - Survival Update", etc.):
//   - Confirmados: name, health, defaultDrops, persists, variant, handDropChances, armorDropChances,
//     armor de un mob = 4 objetos [id, 1, 0, {extras}] (vacío = ["air",0,0,{}]), el campo babyTimer
//     (0 en los adultos), charged, size, color, sheared, tamed, collarColor, teleportDistance, hanging.
//   - Drops de un mob = { type, quantity, randomBonus, lootBonus, properties:{}, extras:{} }.
//     El nombre de un objeto va en extras.nameChange (igual que en los objetos de cofres, inventario y armadura).
//   - Nombre de un objeto = "nameChange" (NO "name"). Un objeto se escribe [id, cantidad, st, extras].
//   - Ronda 16, confirmado en SnowyLand / Biomes: una spawnskin SÍ lleva armadura (4 piezas, igual que el zombie)
//     y "aggro" ("hostile" / "neutral" / "passive"; si falta, es passive). El color del cuero es extras.type (LeatherCap {"type":"cyan"}).
//     Camel City y SnowyLand 31: canDestroy / canPlaceOn son SIEMPRE listas de nombres de bloque ("stone", "iron_bars"...; con
//     el comando {canDestroy:"all"} el juego guarda ["all"]) dentro de los extras del objeto,
//     y lootBonus de un drop puede valer más que 0 (22 drops con 12).
//   - Siguen SIN VERIFICAR: el VALOR de babyTimer en una cría (ningún mundo trae crías; se usa 24000),
//     la clave "chance" de un drop (viene de la wiki; ningún drop real la usa), los objetos en la mano
//     (todos los mobs reales tienen handItems vacío), las condiciones de un drop (variant, sheared, isBaby, color, onFire,
//     size, tamed: vienen de la wiki y se guardan en "properties"; ningún mundo subido las usa) y "unbreakable"
//     (wiki: Boolean, se omite si es false). Cada uno se escribe en UNA sola función de abajo
//     (applyMobSpec / toDropEntry / cleanNbt), así que corregirlos es cambiar pocas líneas.
// ==============================================================
(function () {
 'use strict';

 const PRESETS_KEY = 'mbw_mob_presets';
 const BABY_TIMER = 24000;                 // SIN VERIFICAR: valor de babyTimer para una cría (el campo sí existe: 0 en los adultos)
 const SIZE_HP = { 1: 1, 2: 4, 3: 16 };    // vida típica por tamaño (2 y 3 vistos en mundos reales)
 const COLORS = ['white', 'lightgray', 'gray', 'black', 'brown', 'purple', 'magenta', 'red',
  'orange', 'pink', 'yellow', 'lightgreen', 'green', 'cyan', 'lightblue', 'blue'];
 const COLOR_NAMES = {
  en: { white: 'White', lightgray: 'Light gray', gray: 'Gray', black: 'Black', brown: 'Brown', purple: 'Purple', magenta: 'Magenta', red: 'Red', orange: 'Orange', pink: 'Pink', yellow: 'Yellow', lightgreen: 'Light green', green: 'Green', cyan: 'Cyan', lightblue: 'Light blue', blue: 'Blue' },
  es: { white: 'Blanco', lightgray: 'Gris claro', gray: 'Gris', black: 'Negro', brown: 'Marrón', purple: 'Morado', magenta: 'Magenta', red: 'Rojo', orange: 'Naranja', pink: 'Rosa', yellow: 'Amarillo', lightgreen: 'Verde claro', green: 'Verde', cyan: 'Cian', lightblue: 'Celeste', blue: 'Azul' },
  pt: { white: 'Branco', lightgray: 'Cinza claro', gray: 'Cinza', black: 'Preto', brown: 'Marrom', purple: 'Roxo', magenta: 'Magenta', red: 'Vermelho', orange: 'Laranja', pink: 'Rosa', yellow: 'Amarelo', lightgreen: 'Verde claro', green: 'Verde', cyan: 'Ciano', lightblue: 'Azul claro', blue: 'Azul' }
 };
 const VARIANTS = ['', 'mooshroom', 'cowctus'];
 const MOB_NAMES = {
  zombiepigman: 'Zombie Pigman', magmacube: 'Magma Cube', nethereye: 'Nether Eye', snowgolem: 'Snow Golem',
  enderdragon: 'Ender Dragon', mushroom: 'Mooshroom', cowctus: 'Cowctus', spawnskin: 'Spawnskin'
 };
 const ARMOR_SLOTS = [
  { key: 'helmet', suffix: 'Cap', label: 'mobed_helmet' },
  { key: 'chest', suffix: 'Shirt', label: 'mobed_chest' },
  { key: 'legs', suffix: 'Pants', label: 'mobed_legs' },
  { key: 'boots', suffix: 'Shoes', label: 'mobed_boots' }
 ];

 // --- Qué datos admite cada mob del Mob Browser (por el id de su casilla) ---
 // baby / variant / hand / armor: secciones especiales.  fields: "Específico del mob".
 const F = {
  charged: { key: 'charged', type: 'bool' },
  size: { key: 'size', type: 'select', num: true, options: [1, 2, 3] },
  color: { key: 'color', type: 'select', colors: true, options: COLORS },
  sheared: { key: 'sheared', type: 'bool' },
  tamed: { key: 'tamed', type: 'bool' },
  sitting: { key: 'sitting', type: 'bool', needs: 'tamed' },                 // (needs = solo se muestra si esa casilla está marcada)
  collarColor: { key: 'collarColor', type: 'select', colors: true, options: [''].concat(COLORS), needs: 'tamed' },
  teleportDistance: { key: 'teleportDistance', type: 'int', min: 1, max: 100 },
  hanging: { key: 'hanging', type: 'bool' },
  skin: { key: 'skin', type: 'skin' },         // ID de la skin (solo dígitos; en el mob se guarda como NÚMERO)
  // aggro de una spawnskin (wiki): hostile = ataca al verla, neutral = solo si le pegan, passive = no hace daño (por defecto, la clave se omite)
  aggro: { key: 'aggro', type: 'select', options: ['passive', 'neutral', 'hostile'], omit: 'passive', i18n: 'mobed_aggro_' }
 };
 const SCHEMA = {
  zombie: { armor: true },
  zombiepigman: { hand: true },
  enderman: { hand: true, fields: [F.teleportDistance] },
  creeper: { fields: [F.charged] },
  slime: { fields: [F.size] },
  magmacube: { fields: [F.size] },
  sheep: { baby: true, fields: [F.color, F.sheared] },
  wolf: { baby: true, fields: [F.tamed, F.sitting, F.collarColor] },
  dog: { baby: true, fields: [F.tamed, F.sitting, F.collarColor] },
  cow: { baby: true, variant: true },
  cowctus: { baby: true, variant: true },
  mushroom: { baby: true, variant: true },
  chicken: { baby: true },
  pig: { baby: true },
  rabbit: { baby: true },
  bat: { fields: [F.hanging] },
  spawnskin: { armor: true, fields: [F.skin, F.aggro] }     // armadura confirmada en mundos reales; la mano: sin verificar, no se ofrece
 };

 // ---------------------------------------------------------------- utilidades
 const el = (id) => document.getElementById(id);
 const tr = (k) => (typeof window.t === 'function' ? window.t(k) : k);
 const clone = (o) => JSON.parse(JSON.stringify(o));
 function mk(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
 }
 function clampInt(v, min, max, def) {
  v = Math.round(Number(v));
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, v));
 }
 function clampNum(v, min, max, def) {
  v = Number(v);
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, v));
 }
 const pct = (x) => Math.round(Number(x) * 1000) / 10;      // 0.085 -> 8.5
 const unpct = (p) => +(Number(p) / 100).toFixed(5);         // 8.5 -> 0.085
 const niceMob = (id) => MOB_NAMES[id] || (id.charAt(0).toUpperCase() + id.slice(1));
 function prettyItem(id) {
  return String(id).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
 }
 function colorName(c) {
  if (c === '') return tr('mobed_none');
  const lang = (typeof currentLang !== 'undefined' && COLOR_NAMES[currentLang]) ? currentLang : 'en';
  return COLOR_NAMES[lang][c] || c;
 }
 function tpl(base) { return typeof window.getMobTemplate === 'function' ? window.getMobTemplate(base) : null; }
 // ID de skin: solo dígitos, sin ceros a la izquierda, máximo 12 (igual que acepta el cargador de skins de main.js). '' = sin skin.
 function cleanSkin(v) { return String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, '').slice(0, 12); }

 // ---------------------------------------------------------------- objetos { id, st, nbt }
 // Es el mismo formato del inventario y de los cofres del editor: [id, cantidad, st, nbt].
 //   id  = id del objeto ('air' = casilla vacía)
 //   st  = "states1" del inventario (color, orientación...), null si no tiene
 //   nbt = extras del objeto: nameChange (nombre personalizado), type (color), encantamientos... (null si no tiene)
 // canDestroy / canPlaceOn: SIEMPRE una lista de ids de bloque ("stone", "iron_bars"...; "all" también va dentro de la lista).
 // El juego guarda `give stone 1 0 {canDestroy:"all"}` como "canDestroy":["all"]; el texto suelto "all" hacía que el juego se cerrara,
 // así que un texto (de una versión anterior del editor) se convierte en lista de un elemento. null = nada que guardar.
 function cleanBlockList(v) {
  if (typeof v === 'string') v = [v];
  if (!Array.isArray(v)) return null;
  const out = [];
  v.forEach(function (x) {
   if (typeof x !== 'string') return;
   x = x.trim().slice(0, 64);
   if (x && out.indexOf(x) < 0 && out.length < 64) out.push(x);
  });
  return out.length ? out : null;
 }
 function cleanNbt(n) {
  if (!n || typeof n !== 'object' || Array.isArray(n)) return null;
  let c;
  try { c = JSON.parse(JSON.stringify(n)); } catch (e) { return null; }
  // El juego guarda el nombre de un objeto como "nameChange". El creador de objetos del editor y la versión
  // anterior de este panel usaban "name": se convierte aquí. (Un nombre de un solo espacio " " es válido: oculta el nombre.)
  if (typeof c.name === 'string' && c.nameChange === undefined) c.nameChange = c.name;
  delete c.name;
  if (typeof c.nameChange === 'string' && c.nameChange.length) c.nameChange = c.nameChange.slice(0, 64); else delete c.nameChange;
  // Data tags de objeto (wiki > Data tags > Item Tags): unbreakable (Boolean; se omite si es false) y canDestroy / canPlaceOn (texto o lista de ids)
  if (!c.unbreakable) delete c.unbreakable;
  ['canDestroy', 'canPlaceOn'].forEach(function (k) {
   if (!(k in c)) return;
   const v = cleanBlockList(c[k]);
   if (v === null) delete c[k]; else c[k] = v;
  });
  if (typeof mbwEnchNormalize === 'function') c = mbwEnchNormalize(c);     // fireprotection1 -> protectionFire1 (las claves que usa el juego)
  if (!Object.keys(c).length) return null;
  try { if (JSON.stringify(c).length > 4000) return null; } catch (e) { return null; }
  return c;
 }
 function cleanSt(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(999, Math.round(v)));
  if (typeof v === 'string' && /^[A-Za-z0-9_-]{1,16}$/.test(v)) return v;
  return null;
 }
 function emptyItem() { return { id: 'air', st: null, nbt: null }; }
 const isEmpty = function (it) { return !it || !it.id || it.id === 'air'; };
 function cleanItem(raw) {
  if (!raw || typeof raw.id !== 'string' || !raw.id || raw.id === 'air') return emptyItem();
  const nbt = cleanNbt(raw.nbt);
  let id = raw.id.slice(0, 64);
  // un libro con encantamientos es un libro encantado ('ebook') para el juego
  if (id === 'book' && nbt && Object.keys(nbt).some(function (k) { return nbt[k] === 'enchant'; })) id = 'ebook';
  return { id: id, st: cleanSt(raw.st), nbt: nbt };
 }
 function itemName(it) { return (it && it.nbt && typeof it.nbt.nameChange === 'string') ? it.nbt.nameChange : ''; }
 function setItemName(it, v) {
  const nbt = it.nbt || (it.nbt = {});       // se cambia el MISMO objeto (el selector de encantamientos guarda una referencia a él)
  delete nbt.name;
  if (v) nbt.nameChange = v; else delete nbt.nameChange;
 }
 // Copia un objeto elegido sobre un destino (mano / pieza / drop). Si el destino ya tenía un nombre
 // escrito y el objeto nuevo no trae uno propio, el nombre se conserva.
 function assignItem(target, it) {
  const keep = itemName(target);
  target.id = it.id; target.st = it.st; target.nbt = it.nbt;
  if (keep && !itemName(target)) setItemName(target, keep);
 }
 function clearItem(target) { target.id = 'air'; target.st = null; target.nbt = null; }
 // objeto -> [id, cantidad, st, nbt] (como se guarda en el mundo)
 function toItemArray(it) {
  if (isEmpty(it)) return ['air', 0, 0, {}];
  return [it.id, 1, it.st == null ? 0 : it.st, it.nbt ? clone(it.nbt) : {}];
 }

 // ---------------------------------------------------------------- datos del mob (spec)
 // "spec" = lo que muestra el panel. Es también lo que se guarda en Custom.
 function handFromTemplate(tp) {
  const h = tp && tp.handItems && tp.handItems[0];
  return Array.isArray(h) ? cleanItem({ id: h[0], st: h[2], nbt: h[3] }) : emptyItem();
 }
 function defaultSpec(base) {
  const tp = tpl(base) || {};
  const sch = SCHEMA[base] || {};
  const spec = {
   base: base,
   name: '',
   health: clampInt(tp.health, 1, 99999, 20),
   defaultDrops: tp.defaultDrops !== false,
   variant: VARIANTS.indexOf(tp.variant) >= 0 ? tp.variant : '',
   baby: false,
   hand: Object.assign(handFromTemplate(tp), { drop: pct((tp.handDropChances || [0.085])[0]) }),
   armor: ARMOR_SLOTS.map(function (s, i) { return Object.assign(emptyItem(), { drop: pct((tp.armorDropChances || [])[i] !== undefined ? tp.armorDropChances[i] : 0.085) }); }),
   drops: [],
   tags: [],
   extra: {}
  };
  (sch.fields || []).forEach(function (f) {
   let v = tp[f.key];
   if (f.type === 'bool') v = !!v;
   else if (f.type === 'int') v = clampInt(v, f.min, f.max, 10);
   else if (f.type === 'skin') v = cleanSkin(v);
   else if (v === undefined || f.options.indexOf(v) < 0) v = f.options[0];
   spec.extra[f.key] = v;
  });
  return spec;
 }

 // ---------------------------------------------------------------- tags (solo para organizar en el editor)
 // Un mob de la pestaña Custom puede llevar tags. NO se escriben en el mundo: sirven solo para buscar en la pestaña Custom.
 // La lista de tags que existen se calcula siempre a partir de los mobs guardados, así que cuando ya ningún mob usa un tag, ese tag desaparece solo.
 const MAX_TAGS = 8, MAX_TAG_LEN = 24;
 function cleanTagText(x) { return String(x == null ? '' : x).replace(/[#,]/g, '').trim().replace(/\s+/g, '-').slice(0, MAX_TAG_LEN); }
 function cleanTags(arr) {
  const out = [], seen = {};
  if (!Array.isArray(arr)) return out;
  arr.forEach(function (x) {
   const t = cleanTagText(x), k = t.toLowerCase();
   if (t && !seen[k] && out.length < MAX_TAGS) { seen[k] = 1; out.push(t); }
  });
  return out;
 }
 // [{ tag, count }] de todos los mobs guardados en Custom, en orden alfabético (sin distinguir mayúsculas)
 function tagVocab() {
  const map = {}, order = [];
  loadPresets().forEach(function (p) {
   (p.spec.tags || []).forEach(function (t) {
    const k = t.toLowerCase();
    if (!map[k]) { map[k] = { tag: t, count: 0 }; order.push(k); }
    map[k].count++;
   });
  });
  return order.map(function (k) { return map[k]; }).sort(function (a, b) { return a.tag.toLowerCase().localeCompare(b.tag.toLowerCase()); });
 }
 // Si ya existe un tag con otras mayúsculas ("boss" y "Boss"), se usa el que ya existe
 function canonicalTag(text) {
  const t = cleanTagText(text);
  if (!t) return '';
  const hit = tagVocab().filter(function (v) { return v.tag.toLowerCase() === t.toLowerCase(); })[0];
  return hit ? hit.tag : t;
 }
 // Búsqueda de la pestaña Custom: varias palabras (todas deben cumplirse).
 //   #boss  = tiene un tag que empieza con "boss"      boss  = está en el nombre, en el tipo de mob o en un tag
 function matchPreset(p, q) {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const name = (((p.spec.name || '').trim() || p.name) + ' ' + niceMob(p.spec.base)).toLowerCase();
  const tags = (p.spec.tags || []).map(function (t) { return t.toLowerCase(); });
  return terms.every(function (term) {
   if (term.charAt(0) === '#') {
    const w = term.slice(1);
    return w === '' ? tags.length > 0 : tags.some(function (t) { return t.indexOf(w) === 0; });
   }
   return name.indexOf(term) >= 0 || tags.some(function (t) { return t.indexOf(term) >= 0; });
  });
 }

 // ---------------------------------------------------------------- condiciones de un drop (wiki > Data tags > Loot Tags)
 // Un drop solo cae si el mob cumple la condición. Se guardan en "properties" del drop. SIN VERIFICAR en un mundo real
 // (ningún mundo subido las trae): los nombres y valores salen de la wiki.
 //   isBaby / onFire = todos los mobs   variant = los que tienen variante   sheared = oveja   color = oveja y perro
 //   size = slime y magma cube          tamed = lobo / perro
 const COND = [
  { key: 'isBaby', type: 'bool', all: true, not: ['spawnskin'] },     // una spawnskin nunca es cría
  { key: 'onFire', type: 'bool', all: true },
  { key: 'variant', type: 'variant', test: function (b) { return !!(SCHEMA[b] || {}).variant; } },
  { key: 'sheared', type: 'bool', bases: ['sheep'] },
  { key: 'color', type: 'color', bases: ['sheep', 'wolf', 'dog'] },
  { key: 'size', type: 'size', bases: ['slime', 'magmacube'] },
  { key: 'tamed', type: 'bool', bases: ['wolf', 'dog'] }
 ];
 function condApplies(c, base) { if (c.not && c.not.indexOf(base) >= 0) return false; return !!(c.all || (c.bases && c.bases.indexOf(base) >= 0) || (c.test && c.test(base))); }
 // properties de un drop: solo valores simples (texto corto, número, sí/no)
 function cleanProps(p) {
  const out = {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) return out;
  Object.keys(p).slice(0, 24).forEach(function (k) {
   const v = p[k];
   if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(k)) return;
   if (typeof v === 'boolean') out[k] = v;
   else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
   else if (typeof v === 'string' && v.length <= 40) out[k] = v;
  });
  return out;
 }
 // chance de un drop tal como viene del mundo: { seed, min, max, lootOffset }. Se conserva entera mientras el % no se toque.
 function cleanChanceObj(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || !Number.isFinite(Number(o.max))) return null;
  const n = function (v, lo, hi, d) { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  return { seed: Math.round(n(o.seed, 0, 1e9, 0)), min: n(o.min, -10, 10, 0), max: n(o.max, -10, 10, 1), lootOffset: n(o.lootOffset, -10, 10, 0) };
 }

 // Acepta cualquier cosa (por ejemplo algo guardado en localStorage) y devuelve un spec válido.
 function normalizeSpec(raw) {
  const base = (raw && typeof raw.base === 'string' && tpl(raw.base)) ? raw.base : 'zombie';
  const d = defaultSpec(base);
  if (!raw || typeof raw !== 'object') return d;
  if (typeof raw.name === 'string') d.name = raw.name.slice(0, 64);
  d.health = clampInt(raw.health, 1, 99999, d.health);
  ['defaultDrops', 'baby'].forEach(function (k) { if (typeof raw[k] === 'boolean') d[k] = raw[k]; });
  if (VARIANTS.indexOf(raw.variant) >= 0) d.variant = raw.variant;
  d.tags = cleanTags(raw.tags);
  if (raw.hand && typeof raw.hand.id === 'string' && raw.hand.id) d.hand = Object.assign(cleanItem(raw.hand), { drop: clampNum(raw.hand.drop, 0, 100, d.hand.drop) });
  if (Array.isArray(raw.armor)) {
   d.armor = d.armor.map(function (a, i) {
    const r = raw.armor[i];
    return (r && typeof r.id === 'string' && r.id) ? Object.assign(cleanItem(r), { drop: clampNum(r.drop, 0, 100, a.drop) }) : a;
   });
  }
  if (Array.isArray(raw.drops)) {
   // (los guardados con la versión anterior usaban "item" en vez de "id")
   d.drops = raw.drops.filter(function (x) { const id = x && (x.id || x.item); return typeof id === 'string' && id !== '' && id !== 'air'; }).slice(0, 30).map(function (x) {
    const it = cleanItem({ id: x.id || x.item, st: x.st, nbt: x.nbt });
    const o = Object.assign(it, { qty: clampInt(x.qty, 1, 999, 1), bonus: clampInt(x.bonus, 0, 999, 0), lootBonus: clampInt(x.lootBonus, 0, 999, 0), chance: clampNum(x.chance, 1, 100, 100), props: cleanProps(x.props) });
    const co = cleanChanceObj(x.chanceObj);
    if (co) o.chanceObj = co;
    if (base === 'spawnskin') delete o.props.isBaby;      // una spawnskin nunca es cría: esa condición no existe para ella
    return o;
   });
  }
  if (raw.extra && typeof raw.extra === 'object') {
   ((SCHEMA[base] || {}).fields || []).forEach(function (f) {
    if (!(f.key in raw.extra)) return;
    const v = raw.extra[f.key];
    if (f.type === 'bool') d.extra[f.key] = !!v;
    else if (f.type === 'int') d.extra[f.key] = clampInt(v, f.min, f.max, d.extra[f.key]);
    else if (f.type === 'skin') d.extra[f.key] = cleanSkin(v);
    else {
     const val = f.num ? Number(v) : String(v);
     if (f.options.indexOf(val) >= 0) d.extra[f.key] = val;
    }
   });
  }
  return d;
 }

 // Un drop del panel -> un drop guardado en el mob.
 // Formato REAL (visto en 355 drops de mundos reales):
 //   { type: id del objeto, quantity, randomBonus, lootBonus, properties: {}, extras: { nameChange, type, encantamientos... } }
 // El nombre del drop y los demás datos del objeto van en "extras" (los mismos datos que tiene el objeto en un cofre).
 // Único dato SIN VERIFICAR: "chance" (de la wiki, { seed, min, max, lootOffset }); ningún drop real lo trae,
 // así que solo se escribe si la probabilidad es menor de 100 %.
 function toDropEntry(d, i) {
  const e = {
   type: d.id,
   quantity: d.qty,
   randomBonus: d.bonus,
   lootBonus: d.lootBonus || 0,
   properties: d.props ? clone(d.props) : {},
   extras: d.nbt ? clone(d.nbt) : {}
  };
  if (d.chanceObj && pct(d.chanceObj.max) === d.chance) {
   e.chance = clone(d.chanceObj);              // venía así del mundo y el % no se tocó: se conserva tal cual (semilla, mínimo...)
  } else if (d.chance < 100) {
   // cada drop usa su propia semilla para que las tiradas sean independientes
   e.chance = { seed: i + 1, min: 0, max: unpct(d.chance), lootOffset: 0 };
  }
  return e;
 }

 // Aplica un spec a un mob recién creado desde su plantilla. NO toca x, y, id ni scene.
 window.applyMobSpec = function (mob, rawSpec) {
  if (!mob || !rawSpec) return mob;
  const spec = normalizeSpec(rawSpec);
  const sch = SCHEMA[spec.base] || {};

  mob.name = spec.name.trim();
  mob.health = spec.health;
  mob.defaultDrops = spec.defaultDrops;
  if (sch.variant) mob.variant = spec.variant;
  if (sch.baby && spec.baby) mob.babyTimer = BABY_TIMER;               // SIN VERIFICAR

  if (sch.hand) {
   // wiki: "holding" (enderman, zombie pigman) = handItems[0]; item = [id, cantidad, durabilidad, extras]
   const prev = Array.isArray(mob.handItems) ? mob.handItems.slice() : [];
   prev[0] = toItemArray(spec.hand);
   mob.handItems = prev;
   const hdc = Array.isArray(mob.handDropChances) ? mob.handDropChances.slice() : [0.085, 0.085];
   hdc[0] = unpct(spec.hand.drop);
   mob.handDropChances = hdc;
  }

  if (sch.armor) {
   // armor de un mob: 4 piezas en orden casco, peto, pantalón, botas, cada una [id, 1, 0, extras]
   // (formato confirmado en mobs reales; vacío = ["air", 0, 0, {}]). Los extras llevan nameChange, type (color)...
   const any = spec.armor.some(function (a) { return !isEmpty(a); });
   if (any) mob.armor = spec.armor.map(toItemArray);
   mob.armorDropChances = spec.armor.map(function (a) { return unpct(a.drop); });
  }

  if (spec.drops.length) mob.drops = spec.drops.map(toDropEntry);

  (sch.fields || []).forEach(function (f) {
   if (!(f.key in spec.extra)) return;
   if (f.type === 'skin') {                       // la skin va como NÚMERO; sin ID = sin la propiedad
    if (spec.extra[f.key] === '') delete mob[f.key]; else mob[f.key] = Number(spec.extra[f.key]);
    return;
   }
   if (f.omit !== undefined && spec.extra[f.key] === f.omit) delete mob[f.key];     // el valor por defecto (aggro passive) no se escribe
   else mob[f.key] = spec.extra[f.key];
  });
  return mob;
 };

 // ---------------------------------------------------------------- mob del mundo -> panel del Mob Browser
 // Es lo contrario de applyMobSpec: lee un mob que ya está en el mundo y arma el "spec" del panel (nombre, vida, mano, armadura,
 // drops y datos propios). Devuelve null si ese tipo de mob no existe en el Mob Browser (por ejemplo una skin).
 function baseOfMob(mob) {
  const ty = mob && mob.type;
  if (typeof ty !== 'string') return null;
  if (ty === 'cow') return mob.variant === 'mooshroom' ? 'mushroom' : (mob.variant === 'cowctus' ? 'cowctus' : 'cow');
  if (ty === 'wolf' || ty === 'dog') return mob.tamed ? 'dog' : 'wolf';
  const all = [].concat(MOBS_BY_DIMENSION.Animals, MOBS_BY_DIMENSION.Overworld, MOBS_BY_DIMENSION.Nether, MOBS_BY_DIMENSION.End);
  return all.indexOf(ty) >= 0 && tpl(ty) ? ty : null;
 }
 function dimensionOf(base) {
  const keys = Object.keys(MOBS_BY_DIMENSION);
  for (let i = 0; i < keys.length; i++) if (MOBS_BY_DIMENSION[keys[i]].indexOf(base) >= 0) return keys[i];
  return 'Overworld';
 }
 const itemFromArr = function (a) { return (Array.isArray(a) && typeof a[0] === 'string') ? cleanItem({ id: a[0], st: a[2] === 0 ? null : a[2], nbt: a[3] }) : emptyItem(); };   // 0 = sin desgaste = "sin dato" (igual que lo escribe toItemArray)
 // Los drops propios de un mob que ya está en el mundo (mob.drops), leídos al formato del panel. [] si no tiene.
 function dropsOfMob(mob) {
  if (!mob || !Array.isArray(mob.drops)) return [];
  return mob.drops.filter(function (d) { return d && typeof d.type === 'string' && d.type && d.type !== 'air'; }).slice(0, 30).map(function (d, i) {
   const it = cleanItem({ id: d.type, st: null, nbt: d.extras });
   const ch = d.chance && Number.isFinite(Number(d.chance.max)) ? pct(d.chance.max) : 100;
   const o = Object.assign(it, { qty: clampInt(d.quantity, 1, 999, 1), bonus: clampInt(d.randomBonus, 0, 999, 0), lootBonus: clampInt(d.lootBonus, 0, 999, 0), chance: clampNum(ch, 1, 100, 100), props: cleanProps(d.properties) });
   // el "chance" del mundo se guarda entero solo si NO es el que el editor escribiría solo (semilla = lugar del drop, desde 0, sin Looting)
   const co = cleanChanceObj(d.chance);
   if (co && !(co.min === 0 && co.lootOffset === 0 && co.seed === i + 1)) o.chanceObj = co;
   return o;
  });
 }
 // Vista previa de los drops de un mob del mundo, con casillas como la de un cofre (la usa input.js cuando el mouse pasa por encima de un
 // mob con la herramienta Move). Rellena "box" y devuelve true; si el mob no tiene drops propios no toca nada y devuelve false.
 window.mobDropsPreview = function (mob, box) {
  const list = dropsOfMob(mob);
  if (!list.length || !box) return false;
  box.innerHTML = '';
  box.style.display = 'grid';
  box.style.gridTemplateColumns = 'repeat(' + Math.min(9, list.length) + ', 24px)';
  box.style.gap = '0px'; box.style.padding = '0px'; box.style.alignItems = 'start';
  list.forEach(function (d) {
   const sl = mk('div', 'chest-tooltip-slot' + (enchList(d).length || d.id === 'ebook' ? ' enchanted-slot' : ''));
   sl.style.width = '24px'; sl.style.height = '24px'; sl.style.background = '#8B8B8B'; sl.style.border = '1px inset #FFF';
   sl.style.display = 'flex'; sl.style.justifyContent = 'center'; sl.style.alignItems = 'center'; sl.style.position = 'relative'; sl.style.boxSizing = 'border-box';
   sl.appendChild(icon(d, 16));
   if (d.qty > 1 || d.bonus > 0) {
    const c = mk('span', '', String(d.qty) + (d.bonus > 0 ? '+' : ''));
    c.style.cssText = 'position:absolute;bottom:-2px;right:2px;color:#fff;font-size:10px;font-weight:bold;text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;';
    sl.appendChild(c);
   }
   box.appendChild(sl);
  });
  return true;
 };
 window.specFromMob = function (mob) {
  const base = baseOfMob(mob);
  if (!base) return null;
  const sch = SCHEMA[base] || {};
  const sp = defaultSpec(base);
  if (typeof mob.name === 'string') sp.name = mob.name.slice(0, 64);
  if (Number.isFinite(Number(mob.health))) sp.health = clampInt(mob.health, 1, 99999, sp.health);
  sp.defaultDrops = mob.defaultDrops !== false;
  if (VARIANTS.indexOf(mob.variant) >= 0) sp.variant = mob.variant;
  if (sch.baby) sp.baby = Number(mob.babyTimer) > 0;
  if (sch.hand && Array.isArray(mob.handItems)) {
   sp.hand = Object.assign(itemFromArr(mob.handItems[0]), { drop: pct(Array.isArray(mob.handDropChances) && mob.handDropChances[0] !== undefined ? mob.handDropChances[0] : 0.085) });
  }
  if (sch.armor) {
   sp.armor = ARMOR_SLOTS.map(function (slot, i) {
    const a = Array.isArray(mob.armor) ? mob.armor[i] : null;
    const dc = Array.isArray(mob.armorDropChances) && mob.armorDropChances[i] !== undefined ? mob.armorDropChances[i] : 0.085;
    return Object.assign(itemFromArr(a), { drop: pct(dc) });
   });
  }
  if (Array.isArray(mob.drops)) sp.drops = dropsOfMob(mob);
  (sch.fields || []).forEach(function (f) {
   if (f.type === 'skin') sp.extra[f.key] = cleanSkin(mob[f.key]);
   else if (f.key in mob) sp.extra[f.key] = mob[f.key];
  });
  return normalizeSpec(sp);
 };

 // id con el que está guardado un mob en el mundo (se busca por el objeto mismo)
 function worldKeyOf(mob) {
  if (typeof mbwom === 'undefined' || !mbwom.mobs) return null;
  const keys = Object.keys(mbwom.mobs);
  for (let i = 0; i < keys.length; i++) if (mbwom.mobs[keys[i]] === mob) return keys[i];
  return null;
 }
 // Doble clic con Move sobre un mob: abre el Mob Browser con ese mob elegido (la barra lateral muestra sus datos) y, encima,
 // la ventana "Custom Mob" con TODOS sus datos cargados para editarlos.
 // Por sí solo no cambia el mob del mundo: se puede mirar, guardar en Custom o crear una copia.
 // El botón "Apply to this mob" (applyToWorldMob) es el que escribe el panel encima de ese mob del mundo.
 window.openMobFromWorld = function (mob) {
  const spec = window.specFromMob(mob);
  if (!spec) return false;
  closeArmorPop();
  S.spec = spec;
  S.presetId = null;
  S.hpTouched = true;
  const modal = el('mobs-modal');
  if (!modal) return false;
  modal.style.display = 'block';
  window.filterMobs(dimensionOf(spec.base), true);   // marca la casilla de ese mob y deja el panel como está
  currentlyPreviewedMob = spec.base;
  S.worldKey = worldKeyOf(mob);                       // así el botón "Aplicar a este mob" sabe a cuál escribir
  renderAll(); resetFormScroll();
  window.openCustomMob();
  const shown = spec.name.trim() || niceMob(spec.base);
  status('📥 ' + tr('mobed_loaded_from_world') + ': ' + shown);
  return true;
 };

 // Botón "Customize Mob": abre la ventana "Custom Mob" (dos ventanas pegadas) para el mob que está elegido en el Mob Browser.
 window.openCustomMob = function () {
  const m = el('custom-mob-modal');
  if (!m) return false;
  if (!S.spec) window.previewMob(activeMobTab === 'Custom' ? 'zombie' : (currentlyPreviewedMob || 'zombie'));
  closeArmorPop();
  bindSideSync();
  renderAll();
  m.style.display = 'block';
  resetFormScroll();
  return true;
 };
 window.closeCustomMob = function () {
  closeArmorPop();
  const m = el('custom-mob-modal');
  if (m) m.style.display = 'none';
 };
 // Cualquier cambio dentro de la ventana Custom Mob (escribir, marcar, elegir, pulsar) se refleja en la barra lateral del Mob Browser
 let sideBound = false;
 function bindSideSync() {
  if (sideBound) return;
  const m = el('custom-mob-modal');
  if (!m) return;
  sideBound = true;
  ['input', 'change', 'click'].forEach(function (ev) { m.addEventListener(ev, function () { syncSide(); }); });
 }

 // Vida máxima "normal" de un mob (para la barra de vida del editor).
 window.getMobMaxHealth = function (mob) {
  const t = mob && mob.type;
  if (!t) return 20;
  if ((t === 'slime' || t === 'magmacube') && SIZE_HP[mob.size]) return SIZE_HP[mob.size];
  if (t === 'wolf' && mob.tamed) return 20;
  const tp = tpl(t);
  return (tp && tp.health) || 20;
 };

 // ---------------------------------------------------------------- Custom (guardado)
 function loadPresets() {
  try {
   const a = JSON.parse(localStorage.getItem(PRESETS_KEY));
   if (!Array.isArray(a)) return [];
   return a.filter(function (p) { return p && typeof p.id === 'string' && p.spec && typeof p.spec.base === 'string' && tpl(p.spec.base); })
    .map(function (p) { return { id: p.id, name: typeof p.name === 'string' ? p.name : niceMob(p.spec.base), spec: normalizeSpec(p.spec) }; });
  } catch (e) { return []; }
 }
 function storePresets(arr) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(arr)); return true; } catch (e) { return false; }
 }

 // ---------------------------------------------------------------- estado del panel
 const S = { spec: null, presetId: null, worldKey: null, search: '', hpTouched: false, statusTimer: null, delTimer: null, delArmed: false };

 function cleanSpec() {
  return normalizeSpec(clone(S.spec));
 }
 function imgKey(spec) {
  const sch = SCHEMA[spec.base] || {};
  if (sch.variant) return spec.variant === 'mooshroom' ? 'mushroom' : (spec.variant === 'cowctus' ? 'cowctus' : 'cow');
  if (spec.base === 'wolf' || spec.base === 'dog') return spec.extra.tamed ? 'dog' : 'wolf';
  return spec.base;
 }
 function imgSrc(k) {
  return (window.images && window.images[k] && window.images[k].src) ? window.images[k].src : ('assets/mobs/' + k + '.png');
 }
 function setImg(img, k) {
  // Si antes esta misma imagen mostraba una spawnskin que todavía se estaba cargando, ese "pintor" sigue trabajando en segundo plano
  // (se repite cada 150 ms o cada 4 s) y unos segundos después borraba o pisaba el mob nuevo. Subir el número lo cancela.
  img._skTok = (img._skTok || 0) + 1;
  if (img.style.objectViewBox) img.style.objectViewBox = '';
  img.onerror = function () { this.onerror = null; this.src = 'assets/mobs/' + k + '.png'; };
  img.src = imgSrc(k);
 }

 // Imagen de una spawnskin: la tira de la skin trae 17 cuadros de 16x22 y SIEMPRE se muestra solo el primero (el de "Idle"):
 // los primeros 16 px de ancho y 22 de alto, desde la esquina de arriba de la imagen. Nunca se muestra la tira entera.
 // La skin se pide con getSpawnskinImage (main.js): local -> mineblocks.com, así que puede tardar. Mientras llega la imagen
 // se ve el recuadro vacío (NO la spawnskin genérica); la genérica (spawnskin.png) solo sale cuando la skin no se pudo cargar
 // (sin internet, o un ID que no existe) o cuando no hay ID.
 const SKIN_W = 16, SKIN_H = 22;
 const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
 let genericFrameURL = null;
 // undefined = la imagen aún no está lista · null = no se pudo leer (lienzo "manchado") · texto = el primer cuadro (16x22) como data URL
 function frameOf(src) {
  try {
   const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
   if (!w || !h || (src.complete === false)) return undefined;
   const c = document.createElement('canvas'); c.width = SKIN_W; c.height = SKIN_H;
   c.getContext('2d').drawImage(src, 0, 0, Math.min(SKIN_W, w), Math.min(SKIN_H, h), 0, 0, Math.min(SKIN_W, w), Math.min(SKIN_H, h));
   return c.toDataURL('image/png');
  } catch (e) { return null; }
 }
 // La spawnskin genérica del editor (también solo su primer cuadro). Si todavía no cargó, se espera a que cargue.
 function showGeneric(img, tok) {
  if (genericFrameURL) { if (img.src !== genericFrameURL) img.src = genericFrameURL; return; }
  const g = (window.images && window.images.spawnskin) || null;
  const use = function (im) {
   const u = frameOf(im);
   if (u) genericFrameURL = u;
   if (u && img._skTok === tok) img.src = u;
  };
  if (g && g.complete && g.naturalWidth) { use(g); if (genericFrameURL) return; }
  img.src = BLANK_IMG;                                                      // (nunca la tira entera)
  if (g && !g.complete) g.addEventListener('load', function () { use(g); }, { once: true });
  else if (!g) { const t = new Image(); t.onload = function () { use(t); }; t.src = imgSrc('spawnskin'); }
 }
 // La casilla "Spawnskin" de la LISTA del Mob Browser se ve con assets/Player.png (la imagen grande de la derecha y la ventana
 // Custom Mob siguen mostrando la skin real que va a tener el mob).
 const PLAYER_IMG = 'assets/Player.png';
 function setPlayerImg(img) {
  img._skTok = (img._skTok || 0) + 1;      // (cancela cualquier pintado de skin pendiente sobre esta imagen)
  if (img.style.objectViewBox) img.style.objectViewBox = '';
  img.onerror = null;
  img.src = PLAYER_IMG;
 }
 // Recorta lo que se ve de la imagen a su primer cuadro (16 x 22) sin leer sus píxeles (object-view-box). sk = null: quita el recorte.
 function cropFirst(img, sk) {
  try {
   if (!sk) { if (img.style.objectViewBox) img.style.objectViewBox = ''; return false; }
   const w = sk.naturalWidth || sk.width, h = sk.naturalHeight || sk.height;
   if (!w || !h || !('objectViewBox' in img.style)) return false;
   img.style.objectViewBox = 'inset(0px ' + Math.max(0, w - SKIN_W) + 'px ' + Math.max(0, h - SKIN_H) + 'px 0px)';
   return true;
  } catch (e) { return false; }
 }
 function paintSkinImg(img, id) {
  const tok = (img._skTok = (img._skTok || 0) + 1);
  const sid = cleanSkin(id);
  let tries = 0;
  (function step() {
   if (img._skTok !== tok || (tries > 0 && !document.body.contains(img))) return;   // (la imagen aún no está en la página en el primer intento)
   let state = 'none', url = null, raw = null;
   if (sid && typeof window.getSpawnskinImage === 'function') {
    const sk = window.getSpawnskinImage(sid);
    if (!sk) state = 'loading';
    else if (sk.hasFailed) state = 'failed';
    else {
     const f = frameOf(sk);
     if (f) url = f;
     else if (f === null && sk.src) raw = sk;                           // llegó "sin permiso": no se pueden leer sus píxeles
     else state = f === undefined ? 'loading' : 'failed';
    }
   }
   if (url) { cropFirst(img, null); img.src = url; return; }             // la skin pedida
   // sin permiso: se muestra igual la imagen de la skin, recortada en pantalla a su primer cuadro
   if (raw && cropFirst(img, raw)) { if (img.src !== raw.src) img.src = raw.src; return; }
   cropFirst(img, null);
   if (state === 'loading') {                                           // llegando: el recuadro queda vacío hasta que llegue
    if (tries === 0 || img.src !== BLANK_IMG) img.src = BLANK_IMG;
    if (++tries < 400) setTimeout(step, 150);                           // (hasta ~1 minuto)
    return;
   }
   showGeneric(img, tok);                                               // sin ID, sin internet o un ID que no existe
   if (state === 'failed' && ++tries < 40) setTimeout(step, 4000);      // por si vuelve el internet: el juego reintenta cada minuto y aquí se repinta sola
  })();
 }
 // Imagen de un mob del panel / de una casilla Custom (la spawnskin lleva su propia skin)
 function setSpecImg(img, spec) {
  if (spec.base === 'spawnskin') paintSkinImg(img, spec.extra.skin);
  else setImg(img, imgKey(spec));
 }

 function status(msg) {
  // el mensaje sale en la ventana Custom Mob y también en la barra lateral del Mob Browser
  const box = ['mob-ed-status', 'mob-side-status'].map(el).filter(Boolean);
  box.forEach(function (s) { s.textContent = msg || ''; });
  clearTimeout(S.statusTimer);
  if (msg) S.statusTimer = setTimeout(function () { box.forEach(function (s) { s.textContent = ''; }); }, 3500);
 }

 // ---------------------------------------------------------------- iconos / inventario del editor
 // it puede ser un id (texto) o un objeto { id, st, nbt }.
 function paintItem(cvs, it) {
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 16, 16);
  cvs.__itemTok = 0;                                  // (si una cabeza estaba esperando su skin para este lienzo, ya no)
  const o = (typeof it === 'string') ? { id: it } : (it || {});
  if (!o.id || o.id === 'air') return;
  const state = { type: o.id };
  if (o.st !== null && o.st !== undefined) state.states1 = o.st;
  if (o.nbt) state.nbt = o.nbt;
  let ro = null;
  try { ro = getBlockObject(state); } catch (e) { ro = null; }
  const sheet = window.images && window.images.blocks;
  if (ro && sheet && sheet.complete && sheet.naturalWidth) {
   try { drawItemIcon(ctx, ro, o.id, o.nbt, 0, 0, 16, 16); return; } catch (e) { /* cae al cuadro rosa */ }
  }
  ctx.fillStyle = '#ff00ff'; ctx.fillRect(4, 4, 8, 8);
 }
 function icon(it, size) {
  const c = mk('canvas', 'mob-ico');
  c.width = 16; c.height = 16;
  c.style.width = size + 'px'; c.style.height = size + 'px';
  paintItem(c, it);
  return c;
 }

 // Elegir un objeto con el MISMO inventario que ya tiene el editor (tecla E):
 //   1) se abre el inventario en "modo elegir" (sin la hotbar, con otro título);
 //   2) al hacer clic en un objeto, ui-handler.js (updateFloatingItem) llama a mobEditorInvIntercept,
 //      que cierra el inventario y le entrega el objeto a quien lo pidió (cb);
 //   3) si el inventario se cierra sin elegir (×, tecla E), ui-handler.js llama a mobEditorInvClosed.
 // "tab" (opcional) = pestaña con la que se abre; la pestaña de antes se restaura al terminar. (La armadura ya no usa esto: tiene su propio menú.)
 window.mobInvPick = null;
 function pickItem(cb, tab) {
  const modal = el('inventory-modal');
  if (!modal || typeof toggleInventory !== 'function') return;
  window.mobInvPick = { cb: cb, prevTab: activeInventoryTab };
  if (modal.style.display !== 'block') toggleInventory();
  const title = el('inventory-modal-title');
  if (title) title.innerText = tr('mobed_inv_title');
  const hb = el('modal-hotbar-container');
  if (hb) hb.style.display = 'none';
  if (tab && window.inventoryCategories && window.inventoryCategories[tab]) {
   activeInventoryTab = tab;
   renderInventoryTabs();
   populateInventory();
  }
 }
 window.mobEditorInvIntercept = function () {
  const st = window.mobInvPick;
  if (!st || !heldItem) return false;
  const it = cleanItem({ id: heldItem.type, st: heldItem.states1, nbt: heldItem.nbt });
  window.mobInvPick = null;                 // antes de cerrar: así el cierre no cuenta como "cancelado"
  activeInventoryTab = st.prevTab;
  heldItem = null;
  toggleInventory();
  if (!isEmpty(it)) st.cb(it);
  return true;
 };
 window.mobEditorInvClosed = function () {
  const st = window.mobInvPick;
  window.mobInvPick = null;
  if (st) activeInventoryTab = st.prevTab;
 };

 // ---------------------------------------------------------------- menú de piezas de armadura
 // Al pulsar una casilla de armadura NO se abre todo el inventario: sale un menú pequeño con SOLO las piezas
 // de esa parte del cuerpo (casco = todo lo que va en la cabeza, peto, pantalón, botas).
 // Las piezas salen de la pestaña Armor del inventario del editor y se filtran por cómo termina su id
 // (Cap / Shirt / Pants / Shoes). Los objetos de la pestaña Custom del inventario (con nombre, encantamientos…)
 // que sean de esa misma parte salen en una segunda fila, para no perder esa opción.
 const ARMOR_FALLBACK = ['LeatherCap', 'LeatherShirt', 'LeatherPants', 'LeatherShoes', 'IronCap', 'IronShirt', 'IronPants', 'IronShoes',
  'GoldCap', 'GoldShirt', 'GoldPants', 'GoldShoes', 'DiamondCap', 'DiamondShirt', 'DiamondPants', 'DiamondShoes',
  'DragonCap', 'DragonShirt', 'DragonPants', 'DragonShoes', 'SnowCap', 'AfroCap', 'PartyCap', 'ShadesCap', 'MustacheCap'];
 function armorChoices(suffix) {
  let list = null;
  try { const c = window.inventoryCategories; list = c && c.Armor && c.Armor.items; } catch (e) { list = null; }
  if (!Array.isArray(list) || !list.length) list = ARMOR_FALLBACK;
  return list.filter(function (id) { return typeof id === 'string' && id.slice(-suffix.length) === suffix; });
 }
 function customArmorChoices(suffix, allowed) {
  let raw = [];
  try { raw = JSON.parse(localStorage.getItem('mbw_custom_items')) || []; } catch (e) { raw = []; }
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach(function (r) {
   if (!Array.isArray(r) || typeof r[0] !== 'string' || allowed.indexOf(r[0]) < 0) return;
   const it = cleanItem({ id: r[0], st: r[2], nbt: r[3] });
   if (!isEmpty(it) && out.length < 40) out.push(it);
  });
  return out;
 }
 let armorPop = null;
 function closeArmorPop() {
  if (!armorPop) return;
  document.removeEventListener('mousedown', armorPop.onDown, true);
  document.removeEventListener('keydown', armorPop.onKey, true);
  document.removeEventListener('scroll', armorPop.onScroll, true);
  window.removeEventListener('resize', armorPop.close);
  if (armorPop.el.parentNode) armorPop.el.parentNode.removeChild(armorPop.el);
  armorPop = null;
 }
 function openArmorPop(anchor, label, suffix, current, onPick, onClear) {
  closeArmorPop();
  const pop = mk('div', 'mob-armorpop');
  pop.setAttribute('role', 'dialog');
  pop.appendChild(mk('div', 'mob-armorpop-title', label));
  function tile(it, isCurrent) {
   const b = mk('button', 'mob-slot mob-armorpop-tile');
   b.type = 'button';
   b.title = itemName(it) || prettyItem(it.id);
   if (isCurrent) b.classList.add('current');
   b.appendChild(icon(it, 32));
   b.onclick = function () { closeArmorPop(); onPick(cleanItem(it)); };
   return b;
  }
  const ids = armorChoices(suffix);
  const grid = mk('div', 'mob-armorpop-grid');
  ids.forEach(function (id) { grid.appendChild(tile({ id: id, st: null, nbt: null }, !!current && current.id === id)); });
  if (onClear && current && !isEmpty(current)) {           // casilla "quitar" (la usa el Player Inventory; en Equipment ya está la ✕)
   const rm = mk('button', 'mob-slot mob-armorpop-tile mob-armorpop-clear', '✕');
   rm.type = 'button';
   rm.title = tr('mobed_clear_slot');
   rm.onclick = function () { closeArmorPop(); onClear(); };
   grid.appendChild(rm);
  }
  pop.appendChild(grid);
  const customs = customArmorChoices(suffix, ids);
  if (customs.length) {
   pop.appendChild(mk('div', 'mob-armorpop-sub', tr('mobed_armor_custom')));
   const g2 = mk('div', 'mob-armorpop-grid');
   customs.forEach(function (it) { g2.appendChild(tile(it, false)); });
   pop.appendChild(g2);
  }
  pop.style.visibility = 'hidden';
  document.body.appendChild(pop);
  // posición: a la izquierda de la casilla (para no tapar el formulario); si no cabe, debajo (o arriba)
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(v, Math.max(lo, hi))); };
  let left, top;
  if (r.left - w - 8 >= 8) {
   left = r.left - w - 8; top = clamp(r.top - 6, 8, vh - h - 8);
  } else {
   left = clamp(r.left, 8, vw - w - 8);
   top = (r.bottom + 6 + h <= vh - 8) ? r.bottom + 6 : clamp(r.top - h - 6, 8, vh - h - 8);
  }
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  pop.style.visibility = '';
  armorPop = {
   el: pop, anchor: anchor, close: closeArmorPop,
   // clic fuera = cerrar (clic en la misma casilla: lo resuelve su propio onclick, para poder abrir y cerrar con ella)
   onDown: function (e) {
    if (pop.contains(e.target) || anchor.contains(e.target)) return;
    // un clic en el fondo oscuro de la ventana solo cierra el menú (no debe cerrar también la ventana de debajo)
    const overlay = !!(e.target && e.target.classList && e.target.classList.contains('modal'));
    closeArmorPop();
    if (overlay) {
     const eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); window.removeEventListener('click', eat, true); };
     window.addEventListener('click', eat, true);
     setTimeout(function () { window.removeEventListener('click', eat, true); }, 500);
    }
   },
   onKey: function (e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeArmorPop(); } },
   onScroll: function (e) { if (!pop.contains(e.target)) closeArmorPop(); }
  };
  document.addEventListener('mousedown', armorPop.onDown, true);
  document.addEventListener('keydown', armorPop.onKey, true);
  document.addEventListener('scroll', armorPop.onScroll, true);
  window.addEventListener('resize', armorPop.close);
 }

 // Lo usa también el Player Inventory (scripts/player-inventory.js): al pulsar una casilla de armadura sale este mismo menú.
 //   toggle(ancla, titulo, 'Cap'|'Shirt'|'Pants'|'Shoes', piezaActual {id, st, nbt}|null, alElegir(objeto), alQuitar?)
 window.mobArmorMenu = {
  toggle: function (anchor, label, suffix, current, onPick, onClear) {
   if (armorPop && armorPop.anchor === anchor) closeArmorPop(); else openArmorPop(anchor, label, suffix, current, onPick, onClear);
  },
  close: closeArmorPop,
  isOpen: function () { return !!armorPop; }
 };

 // ---------------------------------------------------------------- piezas del formulario
 function fieldBox(label, hintTitle) {
  const row = mk('div', 'mob-field');
  const l = mk('label', 'mob-flabel', label);
  if (hintTitle) l.title = hintTitle;
  row.appendChild(l);
  return row;
 }
 function fText(label, value, onChange, o) {
  o = o || {};
  const row = fieldBox(label);
  const i = mk('input'); i.type = 'text'; i.value = value;
  if (o.placeholder) i.placeholder = o.placeholder;
  if (o.maxLength) i.maxLength = o.maxLength;
  i.addEventListener('input', function () { onChange(i.value); });
  row.appendChild(i);
  return row;
 }
 function fNumber(label, value, onChange, o) {
  o = o || {};
  const row = fieldBox(label, o.title);
  const i = mk('input'); i.type = 'number'; i.value = value;
  let last = value;
  if (o.min !== undefined) i.min = o.min;
  if (o.max !== undefined) i.max = o.max;
  if (o.id) i.id = o.id;
  i.addEventListener('input', function () { last = i.value === '' ? NaN : Number(i.value); onChange(last); });
  i.addEventListener('blur', function () {
   const v = clampInt(i.value, o.min !== undefined ? o.min : -1e9, o.max !== undefined ? o.max : 1e9, value);
   i.value = v;
   if (v !== last) { last = v; onChange(v); }
  });
  row.appendChild(i);
  return row;
 }
 function fSelect(label, options, value, onChange) {
  const row = fieldBox(label);
  const s = mk('select');
  options.forEach(function (op) {
   const o = mk('option', '', op.label); o.value = String(op.value);
   s.appendChild(o);
  });
  s.value = String(value);
  s.addEventListener('change', function () { onChange(s.value); });
  row.appendChild(s);
  return row;
 }
 function fCheck(label, checked, onChange, hint) {
  const row = mk('div', 'mob-field mob-check');
  const l = mk('label');
  const c = mk('input'); c.type = 'checkbox'; c.checked = !!checked;
  c.addEventListener('change', function () { onChange(c.checked); });
  l.appendChild(c);
  l.appendChild(mk('span', '', label));
  if (hint) l.title = hint;
  row.appendChild(l);
  if (hint) row.appendChild(mk('small', '', hint));
  return row;
 }
 function dropPctBox(value, onChange) {
  const box = mk('div', 'mob-pctbox');
  const i = mk('input'); i.type = 'number'; i.min = 0; i.max = 100; i.step = 0.5; i.value = value;
  i.title = tr('mobed_drop_pct');
  i.addEventListener('input', function () { onChange(clampNum(i.value, 0, 100, 0)); });
  box.appendChild(i);
  box.appendChild(mk('span', '', '%'));
  return box;
 }
 // Columna del panel "Custom Mob" (Basic / Equipment / Custom Drops / Mob-Specific). Cada una tiene su propio desplazamiento.
 function column(key, title, fill) {
  const c = mk('section', 'mob-col');
  c.dataset.col = key;
  c.appendChild(mk('h4', 'mob-col-head', title));
  const b = mk('div', 'mob-col-body');
  c.appendChild(b);
  fill(b);
  return c;
 }

 // Casilla de objeto (solo la imagen). Clic = elegir; clic derecho o la ✕ = quitar.
 //   kind = null  -> se elige con el inventario completo del editor (mano, drops)
 //   kind = 'Cap' | 'Shirt' | 'Pants' | 'Shoes' -> sale el menú pequeño con solo las piezas de esa parte
 // Si está vacía muestra una silueta tenue (ghostId) para saber qué va ahí.
 function slotButton(it, ghostId, label, kind, onPick, onClear) {
  const empty = isEmpty(it);
  const wrap = mk('div', 'mob-slotwrap');
  const b = mk('button', 'mob-slot');
  b.type = 'button';
  b.title = empty ? (label + ' — ' + tr('mobed_pick')) : (prettyItem(it.id) + (onClear ? ' (' + tr('mobed_clear_slot') + ': ✕)' : ''));
  const c = icon(empty ? ghostId : it, 32);
  if (empty) c.classList.add('ghost');
  b.appendChild(c);
  b.onclick = function () {
   if (!kind) { pickItem(onPick, null); return; }
   if (armorPop && armorPop.anchor === b) closeArmorPop(); else openArmorPop(b, label, kind, it, onPick);
  };
  b.oncontextmenu = function (e) { e.preventDefault(); if (!empty && onClear) onClear(); };
  wrap.appendChild(b);
  if (!empty && onClear) {
   const x = mk('button', 'mob-slot-x', '✕');
   x.type = 'button'; x.title = tr('mobed_clear_slot');
   x.onclick = function (e) { e.stopPropagation(); onClear(); };
   wrap.appendChild(x);
  }
  return wrap;
 }
 // Campo para ponerle nombre al objeto (se guarda en nbt.nameChange, igual que los objetos con nombre del juego)
 function itemNameInput(it) {
  const empty = isEmpty(it);
  const i = mk('input', 'mob-itemname');
  i.type = 'text'; i.maxLength = 64; i.autocomplete = 'off';
  i.value = itemName(it);
  i.placeholder = empty ? tr('mobed_item_name_ph') : prettyItem(it.id);
  i.title = tr('mobed_item_name_ph');
  i.disabled = empty;
  i.addEventListener('input', function () { setItemName(it, i.value); });
  return i;
 }
 // Una tarjeta de objeto: [casilla] [nombre del objeto] [% de drop] y debajo los botones ✨ / 🏷 (y 🎯 en los drops).
 //   o.ghost = silueta de la casilla vacía   o.label = nombre de la pieza   o.kind = null (inventario completo) | 'Cap'|'Shirt'|'Pants'|'Shoes'
 //   o.withPct = muestra el % de drop   o.remove = botón ✕ extra   o.clear === false = sin la ✕ de la casilla
 //   o.mid = elemento que va entre la fila y los botones   o.tools = qué botones ofrece (ver cardTools)   o.caption = rótulo chiquito arriba
 function itemCard(target, o) {
  const card = mk('div', 'mob-icard');
  if (o.caption) card.appendChild(mk('div', 'mob-icard-cap', o.caption));
  const line = mk('div', 'mob-line mob-itemrow');
  const slotEl = slotButton(target, o.ghost, o.label, o.kind,
   function (it) { assignItem(target, it); renderForm(); },
   o.clear === false ? null : function () { clearItem(target); renderForm(); });
  line.appendChild(slotEl);
  line.appendChild(itemNameInput(target));
  if (o.withPct) line.appendChild(dropPctBox(target.drop, function (v) { target.drop = v; }));
  if (o.remove) line.appendChild(o.remove);
  card.appendChild(line);
  if (o.mid) card.appendChild(o.mid);
  if (!isEmpty(target)) { const tools = cardTools(target, slotEl, o.tools || {}); if (tools) card.appendChild(tools); }
  return card;
 }

 // Campo de tags del panel: chips con ✕ + caja para escribir (Enter o coma añade) + sugerencias de los tags que ya existen.
 function renderTags(sp) {
  const row = fieldBox(tr('mobed_tags'), tr('mobed_tags_hint'));
  row.classList.add('mob-tagsfield');
  const chips = mk('div', 'mob-chips');
  const inp = mk('input', 'mob-taginput');
  inp.type = 'text'; inp.maxLength = MAX_TAG_LEN + 4; inp.autocomplete = 'off'; inp.spellcheck = false;
  inp.placeholder = tr('mobed_tags_ph');
  inp.title = tr('mobed_tags_hint');
  const sug = mk('div', 'mob-tagsug');
  sug.style.display = 'none';
  function paintChips() {
   chips.textContent = '';
   sp.tags.forEach(function (t, i) {
    const c = mk('span', 'mob-chip');
    c.appendChild(mk('span', 'mob-chip-t', '#' + t));
    const x = mk('button', 'mob-chip-x', '✕'); x.type = 'button'; x.title = tr('mobed_btn_remove');
    x.onclick = function () { sp.tags.splice(i, 1); paintChips(); paintSug(); };
    c.appendChild(x);
    chips.appendChild(c);
   });
   inp.style.display = sp.tags.length >= MAX_TAGS ? 'none' : '';
  }
  function addTag(text) {
   const t = canonicalTag(text);
   if (!t || sp.tags.length >= MAX_TAGS) return false;
   if (sp.tags.some(function (x) { return x.toLowerCase() === t.toLowerCase(); })) return false;
   sp.tags.push(t);
   return true;
  }
  function paintSug() {
   const typed = inp.value.replace(/[#,]/g, '').trim().toLowerCase();
   const used = sp.tags.map(function (x) { return x.toLowerCase(); });
   const list = tagVocab().filter(function (v) { return used.indexOf(v.tag.toLowerCase()) < 0 && (!typed || v.tag.toLowerCase().indexOf(typed) >= 0); });
   sug.textContent = '';
   if (!list.length || document.activeElement !== inp) { sug.style.display = 'none'; return; }
   list.slice(0, 12).forEach(function (v) {
    const it = mk('div', 'mob-sug-item');
    it.appendChild(mk('span', '', '#' + v.tag));
    it.appendChild(mk('em', '', String(v.count)));
    it.onmousedown = function (e) { e.preventDefault(); if (addTag(v.tag)) { inp.value = ''; paintChips(); } paintSug(); };
    sug.appendChild(it);
   });
   sug.style.display = 'block';
  }
  function commit() { if (inp.value.trim() && addTag(inp.value)) paintChips(); inp.value = ''; }
  inp.addEventListener('keydown', function (e) {
   if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); paintSug(); }
   else if (e.key === 'Backspace' && inp.value === '' && sp.tags.length) { sp.tags.pop(); paintChips(); paintSug(); }
   else if (e.key === 'Escape' && sug.style.display !== 'none') { e.stopPropagation(); sug.style.display = 'none'; }
  });
  inp.addEventListener('input', paintSug);
  inp.addEventListener('focus', paintSug);
  inp.addEventListener('blur', function () { commit(); sug.style.display = 'none'; });
  const line = mk('div', 'mob-tagline');
  line.appendChild(chips); line.appendChild(inp);
  row.appendChild(line);
  row.appendChild(sug);
  paintChips();
  return row;
 }

 function renderHand(body, sp) {
  const row = fieldBox(tr('mobed_hand'));
  row.appendChild(itemCard(sp.hand, { ghost: 'IronSword', label: tr('mobed_hand'), kind: null, withPct: true }));
  body.appendChild(row);
 }

 // Armadura: la casilla (con una silueta tenue de la pieza), el nombre y el %; un rótulo chiquito dice qué pieza es.
 function renderArmor(body, sp) {
  const GHOST = ['IronCap', 'IronShirt', 'IronPants', 'IronShoes'];
  ARMOR_SLOTS.forEach(function (slot, i) {
   body.appendChild(itemCard(sp.armor[i], { ghost: GHOST[i], label: tr(slot.label), kind: slot.suffix, withPct: true, caption: tr(slot.label) }));
  });
 }

 // ---------------------------------------------------------------- botones de una tarjeta de objeto
 // Debajo de cada objeto salen hasta tres botones; al pulsar uno se abre su panel (solo uno a la vez):
 //   ✨ Encantamientos  el mismo selector con acordeones del Creador de objetos (solo los que sirven para ese objeto).
 //                      Si el objeto tiene alguno, aparece al lado un librito encantado (ebook) con un tooltip que los dice.
 //   🏷 Data tags       color del cuero, unbreakable, canDestroy, canPlaceOn (ver dtApplicable)
 //   🎯 Condiciones     solo en los drops: el drop cae únicamente si el mob cumple la condición (isBaby, sheared, color...)
 const cardPanel = new WeakMap();          // objeto -> panel abierto ('ench' | 'tags' | 'cond') o null
 const enchFamOpen = {};                   // acordeones abiertos (por encantamiento), se recuerdan al redibujar
 function escHtml(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
 function enchList(it) { return (typeof mbwEnchListOf === 'function' && it && it.nbt) ? mbwEnchListOf(it.nbt) : []; }
 function enchTip(it) {
  let h = '<strong>' + escHtml(itemName(it) || (it.id === 'ebook' ? 'Enchanted Book' : prettyItem(it.id))) + '</strong>';
  enchList(it).forEach(function (n) {
   h += '<span class="tooltip-enchant" style="color: #FFFF; display: block; line-height: 0.6; margin-top: 2px;">' + escHtml(n) + '</span>';
  });
  return h;
 }

 // ---- data tags de un objeto
 function catItems(name) { try { const c = window.inventoryCategories; return (c && c[name] && Array.isArray(c[name].items)) ? c[name].items : []; } catch (e) { return []; } }
 function isToolId(id) { return catItems('Tools').indexOf(id) >= 0 || /(Pickaxe|Sword|Axe|Shovel|Hoe|Shear)$/.test(id); }
 function isArmorId(id) { return catItems('Armor').indexOf(id) >= 0 || /(Cap|Shirt|Pants|Shoes)$/.test(id); }
 function isBlockId(id) { return ['Blocks', 'Decoration', 'Transportation'].some(function (c) { return catItems(c).indexOf(id) >= 0; }); }
 // Qué data tags tienen sentido para este objeto (los que YA trae siempre se muestran, para poder quitarlos):
 //   color (type)  armadura de cuero      unbreakable  herramientas ("all tools")
 //   canDestroy    todo menos la armadura  canPlaceOn   bloques ("only applies to blocks")
 function dtApplicable(it) {
  const n = it.nbt || {};
  const r = {
   color: /^Leather(Cap|Shirt|Pants|Shoes)$/.test(it.id),
   unbreakable: isToolId(it.id) || !!n.unbreakable,
   canDestroy: !isArmorId(it.id) || n.canDestroy !== undefined,
   canPlaceOn: isBlockId(it.id) || n.canPlaceOn !== undefined
  };
  r.any = r.color || r.unbreakable || r.canDestroy || r.canPlaceOn;
  return r;
 }
 function dtCount(it) {
  const n = it.nbt || {}, ap = dtApplicable(it);
  return (ap.color && n.type ? 1 : 0) + (n.unbreakable ? 1 : 0) + (n.canDestroy !== undefined ? 1 : 0) + (n.canPlaceOn !== undefined ? 1 : 0);
 }
 function readBlockList(it, key) {
  const v = it.nbt ? it.nbt[key] : undefined;
  const arr = typeof v === 'string' ? [v] : (Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []);
  return { all: arr.indexOf('all') >= 0, ids: arr.filter(function (x) { return x !== 'all'; }) };
 }
 // Siempre una LISTA: "all" solo = ["all"] (igual que el comando give); "all" + ids = lista que empieza con "all" (la wiki: el valor especial all invierte la lista)
 function writeBlockList(it, key, st) {
  const nbt = it.nbt || (it.nbt = {});          // siempre el MISMO objeto (el selector de encantamientos guarda una referencia)
  if (st.all) nbt[key] = ['all'].concat(st.ids);
  else if (st.ids.length) nbt[key] = st.ids.slice();
  else delete nbt[key];
 }
 function cleanBlockId(x) { return String(x == null ? '' : x).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_:.\-]/g, '').slice(0, 64); }
 // Nombres de bloque vistos en mundos reales (Camel City). El juego los escribe así ("stone", "iron_bars"), no con los códigos cortos del editor.
 const BLOCK_ID_HINTS = ['stone', 'slab_stone_brick', 'iron_bars', 'backdrop_wool'];
 function ensureBlockDatalist() {
  if (document.getElementById('mob-blockid-list')) return;
  const dl = document.createElement('datalist');
  dl.id = 'mob-blockid-list';
  BLOCK_ID_HINTS.forEach(function (id) { const o = document.createElement('option'); o.value = id; dl.appendChild(o); });
  document.body.appendChild(dl);
 }
 function blockListField(it, key, label, hint, onChange) {
  ensureBlockDatalist();
  const row = fieldBox(label, hint);
  row.classList.add('mob-blocklist');
  row.dataset.key = key;
  const line = mk('div', 'mob-tagline');
  const chips = mk('div', 'mob-chips');
  const inp = mk('input', 'mob-taginput');
  inp.type = 'text'; inp.maxLength = 64; inp.autocomplete = 'off'; inp.spellcheck = false;
  inp.placeholder = tr('mobed_dt_block_ph');
  inp.title = hint;
  inp.setAttribute('list', 'mob-blockid-list');
  line.appendChild(chips); line.appendChild(inp);
  row.appendChild(line);
  const allRow = fCheck(tr('mobed_dt_all'), readBlockList(it, key).all, function (v) {
   const st = readBlockList(it, key); st.all = v; writeBlockList(it, key, st); onChange();
  }, null);
  allRow.classList.add('mob-blocklist-all');
  allRow.title = tr('mobed_dt_all_hint');
  row.appendChild(allRow);
  function paint() {
   const st = readBlockList(it, key);
   chips.textContent = '';
   st.ids.forEach(function (id) {
    const c = mk('span', 'mob-chip');
    c.appendChild(mk('span', 'mob-chip-t', id));
    const x = mk('button', 'mob-chip-x', '✕'); x.type = 'button'; x.title = tr('mobed_btn_remove');
    x.onclick = function () { const s2 = readBlockList(it, key); s2.ids = s2.ids.filter(function (e) { return e !== id; }); writeBlockList(it, key, s2); paint(); onChange(); };
    c.appendChild(x);
    chips.appendChild(c);
   });
  }
  function commit() {
   const id = cleanBlockId(inp.value);
   inp.value = '';
   if (!id) return;
   const st = readBlockList(it, key);
   if (id === 'all') { st.all = true; const cb = allRow.querySelector('input'); if (cb) cb.checked = true; }
   else if (st.ids.indexOf(id) < 0 && st.ids.length < 63) st.ids.push(id);
   writeBlockList(it, key, st); paint(); onChange();
  }
  inp.addEventListener('keydown', function (e) {
   if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
   else if (e.key === 'Backspace' && inp.value === '') {
    const st = readBlockList(it, key);
    if (st.ids.length) { st.ids.pop(); writeBlockList(it, key, st); paint(); onChange(); }
   }
  });
  inp.addEventListener('change', commit);       // al elegir una sugerencia de la lista
  inp.addEventListener('blur', commit);
  paint();
  return row;
 }
 function dataTagsPanel(host, it, onChange) {
  const ap = dtApplicable(it);
  const nbt = function () { return it.nbt || (it.nbt = {}); };
  if (ap.color) {
   const opts = [{ value: '', label: tr('mobed_none') }].concat(COLORS.map(function (c) { return { value: c, label: colorName(c) }; }));
   host.appendChild(fSelect(tr('mobed_dt_color'), opts, (it.nbt && it.nbt.type) || '', function (v) { if (v) nbt().type = v; else if (it.nbt) delete it.nbt.type; onChange(); }));
  }
  if (ap.unbreakable) {
   host.appendChild(fCheck(tr('mobed_dt_unbreakable'), !!(it.nbt && it.nbt.unbreakable), function (v) { if (v) nbt().unbreakable = true; else if (it.nbt) delete it.nbt.unbreakable; onChange(); }, tr('mobed_dt_unbreakable_hint')));
  }
  if (ap.canDestroy) host.appendChild(blockListField(it, 'canDestroy', tr('mobed_dt_candestroy'), tr('mobed_dt_candestroy_hint'), onChange));
  if (ap.canPlaceOn) host.appendChild(blockListField(it, 'canPlaceOn', tr('mobed_dt_canplaceon'), tr('mobed_dt_canplaceon_hint'), onChange));
  if (!ap.any) host.appendChild(mk('p', 'mob-note', tr('mobed_dt_none')));
 }

 // ---- condiciones de un drop
 function condPanel(host, d, onChange) {
  const base = S.spec ? S.spec.base : 'zombie';
  const any = { value: '', label: tr('mobed_cond_any') };
  COND.filter(function (c) { return condApplies(c, base); }).forEach(function (c) {
   let opts;
   if (c.type === 'bool') opts = [any, { value: 'true', label: tr('mobed_true') }, { value: 'false', label: tr('mobed_false') }];
   else if (c.type === 'variant') opts = [any, { value: 'normal', label: tr('mobed_var_normal') }, { value: 'mooshroom', label: tr('mobed_var_mooshroom') }, { value: 'cowctus', label: tr('mobed_var_cowctus') }];
   else if (c.type === 'color') opts = [any].concat(COLORS.map(function (k) { return { value: k, label: colorName(k) }; }));
   else opts = [any, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }];
   const cur = d.props ? d.props[c.key] : undefined;
   host.appendChild(fSelect(tr('mobed_cond_' + c.key), opts, cur === undefined ? '' : String(cur), function (v) {
    const props = d.props || (d.props = {});
    if (v === '') delete props[c.key];
    else props[c.key] = c.type === 'bool' ? v === 'true' : (c.type === 'size' ? Number(v) : v);
    onChange();
   }));
  });
  host.appendChild(mk('small', 'mob-hint', tr('mobed_cond_hint')));
 }

 function cardTools(d, slotWrap, o) {
  const fams = (o.ench !== false && typeof mbwEnchFamiliesFor === 'function') ? mbwEnchFamiliesFor(d.id) : [];
  const parts = [];
  if (o.ench !== false && (fams.length || enchList(d).length)) parts.push('ench');
  if (o.tags !== false && dtApplicable(d).any) parts.push('tags');
  if (o.cond) parts.push('cond');
  if (!parts.length) return null;
  const box = mk('div', 'mob-ench');
  const line = mk('div', 'mob-line mob-enchline');
  const badge = mk('span', 'mob-enchbadge');
  badge.appendChild(icon('ebook', 22));
  line.appendChild(badge);
  const LABEL = { ench: ['✨', 'mobed_ench_btn'], tags: ['🏷', 'mobed_dt_btn'], cond: ['🎯', 'mobed_cond_btn'] };
  const COUNT = {
   ench: function () { return enchList(d).length; },
   tags: function () { return dtCount(d); },
   cond: function () { return d.props ? Object.keys(d.props).length : 0; }
  };
  const btns = {}, panels = {};
  function paintBadge() {
   const n = enchList(d).length;
   badge.style.display = n ? 'inline-flex' : 'none';
   badge.classList.toggle('enchanted-slot', n > 0);
   if (n) badge.dataset.enchantTooltip = enchTip(d); else delete badge.dataset.enchantTooltip;
   badge.setAttribute('aria-label', n ? enchList(d).join(', ') : '');
  }
  function paintBtns() {
   parts.forEach(function (k) {
    const n = COUNT[k]();
    btns[k].textContent = LABEL[k][0] + ' ' + tr(LABEL[k][1]) + (n ? ' (' + n + ')' : '') + (cardPanel.get(d) === k ? ' ▴' : ' ▾');
    btns[k].classList.toggle('on', n > 0);
   });
  }
  function changed() { paintBadge(); paintBtns(); }
  function build(k) {
   const pn = panels[k];
   if (pn.built) return;
   pn.built = true;
   if (k === 'ench') {
    if (!d.nbt) d.nbt = {};
    mbwEnchPicker(pn.el, {
     families: fams.length ? fams : undefined,
     item: d.id,
     data: d.nbt,
     open: enchFamOpen,
     onChange: function () {
      if (d.id === 'book' && enchList(d).length) {            // un libro con encantamientos pasa a ser 'ebook'
       d.id = 'ebook';
       const cv = slotWrap && slotWrap.querySelector('canvas');
       if (cv) paintItem(cv, d);
      }
      changed();
     }
    });
   } else if (k === 'tags') dataTagsPanel(pn.el, d, changed);
   else condPanel(pn.el, d, changed);
  }
  function show() {
   const open = cardPanel.get(d);
   parts.forEach(function (k) {
    panels[k].el.style.display = open === k ? 'block' : 'none';
    if (open === k) build(k);
   });
   paintBtns();
  }
  parts.forEach(function (k) {
   const b = mk('button', k === 'ench' ? 'mob-enchbtn' : 'mob-toolbtn');
   b.type = 'button';
   b.dataset.tool = k;
   b.onclick = function () { cardPanel.set(d, cardPanel.get(d) === k ? null : k); show(); };
   line.appendChild(b);
   btns[k] = b;
  });
  box.appendChild(line);
  parts.forEach(function (k) {
   const pn = mk('div', k === 'ench' ? 'mob-enchpanel' : 'mob-enchpanel mob-subpanel');
   pn.dataset.tool = k;
   pn.style.display = 'none';
   box.appendChild(pn);
   panels[k] = { el: pn, built: false };
  });
  show(); paintBadge();
  return box;
 }

 function renderDrops(body, sp) {
  const hint = mk('small', 'mob-hint', sp.defaultDrops ? tr('mobed_drops_hint_on') : tr('mobed_drops_hint_off'));
  hint.id = 'mob-drops-hint';
  body.appendChild(hint);
  const list = mk('div', 'mob-drops-list');
  body.appendChild(list);
  if (!sp.drops.length) list.appendChild(mk('p', 'mob-note', tr('mobed_drops_empty')));
  sp.drops.forEach(function (d, i) {
   const del = mk('button', 'mob-x', '✕'); del.type = 'button'; del.title = tr('mobed_btn_remove');
   del.onclick = function () { sp.drops.splice(i, 1); renderForm(); };
   const nums = mk('div', 'mob-line mob-dropnums');
   // (el orden importa: cantidad, extra al azar y probabilidad primero; "Looting" al final)
   [['mobed_drop_qty', 'qty', 1, 999, 'mobed_drop_qty_hint'], ['mobed_drop_bonus', 'bonus', 0, 999, 'mobed_drop_bonus_hint'], ['mobed_drop_chance', 'chance', 1, 100, 'mobed_drop_chance_hint'], ['mobed_drop_loot', 'lootBonus', 0, 999, 'mobed_drop_loot_hint']].forEach(function (c) {
    const w = mk('label', 'mob-mini');
    w.title = tr(c[4]);
    w.appendChild(mk('span', '', tr(c[0])));
    const inp = mk('input'); inp.type = 'number'; inp.min = c[2]; inp.max = c[3]; inp.value = d[c[1]] === undefined ? c[2] : d[c[1]];
    inp.addEventListener('input', function () { d[c[1]] = clampNum(inp.value, c[2], c[3], c[2]); });
    inp.addEventListener('blur', function () { d[c[1]] = clampInt(inp.value, c[2], c[3], c[2]); inp.value = d[c[1]]; });
    w.appendChild(inp);
    if (c[1] === 'chance') w.appendChild(mk('em', '', '%'));
    nums.appendChild(w);
   });
   const card = itemCard(d, { ghost: 'air', label: tr('mobed_pick'), kind: null, clear: false, remove: del, mid: nums, tools: { cond: true } });
   card.classList.add('mob-drop');
   list.appendChild(card);
  });
  const add = mk('button', 'mob-addbtn', tr('mobed_drops_add')); add.type = 'button';
  add.onclick = function () {
   pickItem(function (it) {
    sp.drops.push(Object.assign(it, { qty: 1, bonus: 0, lootBonus: 0, chance: 100, props: {} }));
    renderForm();
   }, null);
  };
  body.appendChild(add);
 }

 function renderSpecific(body, sp, sch) {
  // Las opciones que dependen de otra (Sitting y Collar color dependen de Tamed) solo se ven con esa casilla marcada
  const deps = [];
  function syncDeps() { deps.forEach(function (d) { d.node.style.display = sp.extra[d.needs] ? '' : 'none'; }); }
  (sch.fields || []).forEach(function (f) {
   const label = tr('mobed_f_' + f.key);
   const cur = sp.extra[f.key];
   const before = body.childNodes.length;
   if (f.type === 'bool') {
    body.appendChild(fCheck(label, cur, function (v) { sp.extra[f.key] = v; if (f.key === 'tamed') refreshImage(); syncDeps(); }));
   } else if (f.type === 'int') {
    body.appendChild(fNumber(label, cur, function (v) { if (Number.isFinite(v)) sp.extra[f.key] = clampInt(v, f.min, f.max, cur); }, { min: f.min, max: f.max }));
   } else if (f.type === 'skin') {
    // ID de la skin: solo números. La imagen sale de mineblocks.com/1/skins/images/{ID}.png (o de las skins que ya tiene el editor)
    const row = fText(label, cur, function (v) {
     sp.extra[f.key] = cleanSkin(v);
     clearTimeout(S.skinTimer); S.skinTimer = setTimeout(refreshImage, 350);   // no se pide una imagen por cada tecla
    }, { placeholder: '1234', maxLength: 12 });
    const inp = row.querySelector('input');
    inp.id = 'mobed-skin'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
    inp.addEventListener('input', function () { const c = inp.value.replace(/\D/g, ''); if (c !== inp.value) inp.value = c; });
    body.appendChild(row);
    body.appendChild(mk('small', 'mob-hint', tr('mobed_skin_hint')));
    // Galería de skins: buscar por nombre / autor y elegir (la skin elegida se escribe en este campo)
    const gal = mk('button', 'ex-btn sg-open-btn', tr('sg_open_btn', '🖼️ Skin gallery'));
    gal.type = 'button'; gal.id = 'mobed-skin-gallery';
    gal.onclick = function () {
     if (typeof window.openSkinGallery !== 'function') return;
     window.openSkinGallery({ pick: function (id) { const i = el('mobed-skin'); if (i) { i.value = id; i.dispatchEvent(new Event('input', { bubbles: true })); } } });
    };
    body.appendChild(gal);
   } else {
    const opts = f.options.map(function (o) { return { value: o, label: f.colors ? colorName(o) : (f.i18n ? tr(f.i18n + o) : String(o)) }; });
    body.appendChild(fSelect(label, opts, cur, function (v) {
     sp.extra[f.key] = f.num ? Number(v) : v;
     if (f.key === 'size' && !S.hpTouched) {
      sp.health = SIZE_HP[Number(v)] || sp.health;
      const h = el('mobed-health'); if (h) h.value = sp.health;
     }
    }));
   }
   if (f.needs) for (let i = before; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (node.nodeType === 1) { node.setAttribute('data-needs', f.needs); deps.push({ node: node, needs: f.needs }); }
   }
  });
  syncDeps();
 }

 function renderForm() {
  const root = el('mob-form');
  if (!root || !S.spec) return;
  closeArmorPop();
  const keep = Array.prototype.map.call(root.querySelectorAll('.mob-col-body'), function (b) { return b.scrollTop; });
  root.textContent = '';
  const sp = S.spec, sch = SCHEMA[sp.base] || {};

  const basicCol = column('basic', tr('mobed_sec_basic'), function (b) {
   // Nombre y Vida (cada uno en su fila: la columna es angosta)
   const fn = fText(tr('mobed_name'), sp.name, function (v) { sp.name = v; renderTitle(); }, { placeholder: tr('mobed_name_ph'), maxLength: 64 });
   const fh = fNumber(tr('mobed_health'), sp.health, function (v) { if (Number.isFinite(v)) { sp.health = v; S.hpTouched = true; } }, { min: 1, max: 99999, id: 'mobed-health', title: tr('mobed_health_hint') });
   b.appendChild(fn); b.appendChild(fh);
   b.appendChild(renderTags(sp));
   if (sch.variant) {
    b.appendChild(fSelect(tr('mobed_variant'), [
     { value: '', label: tr('mobed_var_normal') }, { value: 'mooshroom', label: tr('mobed_var_mooshroom') }, { value: 'cowctus', label: tr('mobed_var_cowctus') }
    ], sp.variant, function (v) { sp.variant = v; refreshImage(); }));
   }
   if (sch.baby) b.appendChild(fCheck(tr('mobed_baby'), sp.baby, function (v) { sp.baby = v; }));
   b.appendChild(fCheck('defaultDrops', sp.defaultDrops, function (v) {
    sp.defaultDrops = v;
    const h = el('mob-drops-hint'); if (h) h.textContent = v ? tr('mobed_drops_hint_on') : tr('mobed_drops_hint_off');
   }, tr('mobed_defaultdrops_hint')));
  });
  // Mob-Specific va DEBAJO de Basic, en la misma columna. Si el mob no tiene opciones propias, esa sección no existe (se esconde por completo).
  if ((sch.fields || []).length) {
   const stack = mk('div', 'mob-colstack');
   stack.appendChild(basicCol);
   stack.appendChild(column('specific', tr('mobed_sec_specific'), function (b) { renderSpecific(b, sp, sch); }));
   root.appendChild(stack);
  } else root.appendChild(basicCol);

  // Equipment solo existe si el mob puede llevar algo (armadura: zombie y spawnskin; un objeto en la mano: zombie pigman y enderman).
  // Si no puede, la columna se esconde por completo.
  const hasEquip = !!(sch.hand || sch.armor);
  if (hasEquip) {
   root.appendChild(column('equip', tr('mobed_sec_equip'), function (b) {
    if (sch.hand) renderHand(b, sp);
    if (sch.armor) renderArmor(b, sp);
   }));
  }
  root.dataset.cols = hasEquip ? '3' : '2';   // el CSS reparte el ancho según cuántas columnas hay
  root.appendChild(column('drops', tr('mobed_sec_drops') + (sp.drops.length ? ' (' + sp.drops.length + ')' : ''), function (b) { renderDrops(b, sp); }));
  root.querySelectorAll('.mob-col-body').forEach(function (b, i) { b.scrollTop = keep[i] || 0; });
  syncSide();
 }
 function resetFormScroll() {
  const root = el('mob-form');
  if (root) root.querySelectorAll('.mob-col-body').forEach(function (b) { b.scrollTop = 0; });
 }

 // ---------------------------------------------------------------- barra lateral del Mob Browser (solo muestra)
 function renderTitle() {
  if (!S.spec) return;
  const typed = (S.spec.name || '').trim();
  const preset = S.presetId ? loadPresets().filter(function (p) { return p.id === S.presetId; })[0] : null;
  const sub = preset ? ('Custom · ' + niceMob(S.spec.base)) : (typed ? niceMob(S.spec.base) : '');
  ['mob-info-title', 'cm-title'].forEach(function (id) { const t = el(id); if (t) t.textContent = typed || niceMob(S.spec.base); });
  ['mob-info-sub', 'cm-sub'].forEach(function (id) { const t = el(id); if (t) t.textContent = sub; });
 }
 function refreshImage() {
  if (!S.spec) return;
  ['mob-preview-image', 'cm-preview-image'].forEach(function (id) { const img = el(id); if (img) setSpecImg(img, S.spec); });
 }
 const yesNo = function (v) { return v ? tr('mobed_true') : tr('mobed_false'); };
 // Los datos que muestra la barra lateral: [nombre, valor]. Salen del panel (ya limpios), así que siempre son valores válidos.
 function infoLines(spec) {
  const sch = SCHEMA[spec.base] || {}, L = [];
  L.push([tr('mobed_health'), String(spec.health)]);
  if (sch.variant) L.push([tr('mobed_variant'), tr('mobed_var_' + (spec.variant || 'normal'))]);
  if (sch.baby) L.push([tr('mobed_baby'), yesNo(spec.baby)]);
  (sch.fields || []).forEach(function (f) {
   if (f.needs && !spec.extra[f.needs]) return;                 // (Sitting / Collar color sin Tamed: no aplican)
   const v = spec.extra[f.key];
   let shown;
   if (f.type === 'bool') shown = yesNo(v);
   else if (f.type === 'skin') shown = v === '' ? '—' : String(v);
   else if (f.colors) shown = colorName(v);
   else if (f.i18n) shown = tr(f.i18n + v);
   else shown = String(v);
   L.push([tr('mobed_f_' + f.key), shown]);
  });
  L.push(['defaultDrops', yesNo(spec.defaultDrops)]);
  if (sch.hand && !isEmpty(spec.hand)) L.push([tr('mobed_hand'), itemName(spec.hand) || prettyItem(spec.hand.id)]);
  if (sch.armor) {
   const n = spec.armor.filter(function (a) { return !isEmpty(a); }).length;
   if (n) L.push([tr('mobed_info_armor'), n + '/4']);
  }
  if (spec.tags.length) L.push([tr('mobed_tags'), spec.tags.map(function (t) { return '#' + t; }).join(' ')]);
  return L;
 }
 function renderInfo() {
  const box = el('mob-info-lines');
  if (!box || !S.spec) return;
  box.textContent = '';
  infoLines(cleanSpec()).forEach(function (l) {
   const row = mk('div', 'mob-info-line');
   row.appendChild(mk('span', 'mob-info-k', l[0] + ':'));
   row.appendChild(mk('span', 'mob-info-v', l[1]));
   box.appendChild(row);
  });
 }
 // Una casilla por cada drop (con la cantidad abajo a la derecha y un tooltip con todos sus datos)
 function dropTip(d) {
  let h = enchTip(d);
  const line = function (t) { return '<span class="tooltip-enchant" style="color: #BBBB; display: block; line-height: 0.8; margin-top: 3px;">' + escHtml(t) + '</span>'; };
  h += line('x' + d.qty + (d.bonus ? ' (+0-' + d.bonus + ')' : ''));
  if (d.lootBonus) h += line(tr('mobed_drop_loot') + ': ' + d.lootBonus);
  if (d.chance < 100) h += line(tr('mobed_drop_chance') + ': ' + d.chance + '%');
  Object.keys(d.props || {}).forEach(function (k) { h += line(k + ': ' + String(d.props[k])); });
  const n = dtCount(d);
  if (n) h += line('🏷 ' + n);
  return h;
 }
 function renderDropsPreview() {
  const box = el('mob-drops-preview');
  if (!box || !S.spec) return;
  box.textContent = '';
  const sp = cleanSpec();
  if (!sp.drops.length) { box.appendChild(mk('p', 'mob-note', tr('mobed_drops_empty'))); return; }
  sp.drops.forEach(function (d) {
   const s = mk('div', 'mob-dslot ' + (enchList(d).length || d.id === 'ebook' ? 'enchanted-slot' : 'pinv-tip'));
   s.dataset.enchantTooltip = dropTip(d);
   s.appendChild(icon(d, 32));
   if (d.qty > 1 || d.bonus > 0) s.appendChild(mk('span', 'mob-dslot-n', String(d.qty) + (d.bonus > 0 ? '+' : '')));
   box.appendChild(s);
  });
 }
 // Se llama cada vez que algo cambia en la ventana Custom Mob: la barra lateral siempre muestra lo último.
 function syncSide() {
  if (!S.spec) return;
  renderInfo(); renderDropsPreview();
 }
 function renderAll() {
  renderTitle(); refreshImage(); renderForm(); renderButtons();
 }

 // Botones de abajo de la ventana Custom Mob (el de "Spawn Mob" ya no está aquí: vive en la barra lateral del Mob Browser)
 function renderButtons() {
  const box = el('mob-ed-buttons');
  if (!box) return;
  box.textContent = '';
  clearTimeout(S.delTimer); S.delArmed = false;
  const row = mk('div', 'mob-btnrow cm-btnrow');
  // El mob se abrió desde el mundo (doble clic) y sigue allí: se puede escribir el panel encima de ese mob
  if (S.worldKey && typeof mbwom !== 'undefined' && mbwom.mobs && mbwom.mobs[S.worldKey]) {
   const ap = mk('button', 'mob-sbtn btn-apply-mob', tr('mobed_btn_apply_world'));
   ap.type = 'button'; ap.id = 'mob-apply-world'; ap.title = tr('mobed_apply_hint');
   ap.onclick = applyToWorldMob;
   row.appendChild(ap);
  }
  const save = mk('button', 'mob-sbtn', tr('mobed_btn_save')); save.type = 'button'; save.onclick = saveAsNew;
  const reset = mk('button', 'mob-sbtn', tr('mobed_btn_reset')); reset.type = 'button'; reset.onclick = resetPanel;
  row.appendChild(save); row.appendChild(reset);
  if (S.presetId) {
   const upd = mk('button', 'mob-sbtn', tr('mobed_btn_update')); upd.type = 'button'; upd.onclick = updatePreset;
   const del = mk('button', 'mob-sbtn mob-danger', tr('mobed_btn_delete')); del.type = 'button';
   del.onclick = function () {
    if (!S.delArmed) {
     S.delArmed = true; del.textContent = tr('mobed_btn_delete_confirm');
     S.delTimer = setTimeout(function () { S.delArmed = false; del.textContent = tr('mobed_btn_delete'); }, 3000);
     return;
    }
    deletePreset();
   };
   row.appendChild(upd); row.appendChild(del);
  }
  box.appendChild(row);
  const st = mk('div', 'mob-status'); st.id = 'mob-ed-status';
  box.appendChild(st);
 }

 // ---------------------------------------------------------------- acciones
 // "Aplicar a este mob": escribe el panel encima del mob del mundo que se abrió con doble clic (NO crea otro:
 // conserva su posición, su id y su escena). Solo se cambia lo que se tocó en el panel; lo demás queda como estaba.
 // Se puede deshacer con Ctrl+Z y, en multijugador, se avisa a los demás.
 function applyToWorldMob() {
  const key = S.worldKey;
  const mob = (key && typeof mbwom !== 'undefined' && mbwom.mobs) ? mbwom.mobs[key] : null;
  if (!mob) { S.worldKey = null; renderButtons(); status(tr('mobed_apply_gone')); return; }
  const spec = cleanSpec();
  const sch = SCHEMA[spec.base] || {};
  const before = clone(mob);
  const orig = window.specFromMob(before);        // el panel tal como estaba cuando se abrió el mob
  const canon = function (o) { return JSON.stringify(o, function (k, v) { if (v && typeof v === 'object' && !Array.isArray(v)) { const r = {}; Object.keys(v).sort().forEach(function (x) { r[x] = v[x]; }); return r; } return v; }); };   // sin importar el orden de las claves
  const eq = function (a, b) { return canon(a) === canon(b); };
  const same = function (k) { return !!orig && eq(orig[k], spec[k]); };

  // applyMobSpec solo escribe; no borra. Por eso primero se deja en blanco lo que el panel controla.
  delete mob.drops;
  if (sch.baby) mob.babyTimer = 0;
  if (sch.armor) { mob.armor = []; delete mob.armorDropChances; }
  window.applyMobSpec(mob, spec);

  // Lo que no cambió en el panel se vuelve a dejar EXACTAMENTE como estaba (así no se pierden datos que el panel no muestra).
  const restore = function (keys) { keys.forEach(function (k) { if (k in before) mob[k] = clone(before[k]); else delete mob[k]; }); };
  if (orig) {
   if (orig.name.trim() === spec.name.trim()) restore(['name']);
   if (same('health')) restore(['health']);
   if (same('defaultDrops')) restore(['defaultDrops']);
   if (sch.variant && same('variant')) restore(['variant']);
   if (sch.baby && same('baby')) restore(['babyTimer']);
   if (sch.hand && same('hand')) restore(['handItems', 'handDropChances']);
   if (sch.armor && same('armor')) restore(['armor', 'armorDropChances']);
   if (same('drops')) restore(['drops']);
   (sch.fields || []).forEach(function (f) { if (eq(orig.extra[f.key], spec.extra[f.key])) restore([f.key]); });
  }

  // las claves vuelven a su orden de siempre (el archivo del mundo queda igual de ordenado que antes)
  const ordered = {};
  Object.keys(before).forEach(function (k) { if (k in mob) ordered[k] = mob[k]; });
  Object.keys(mob).forEach(function (k) { if (!(k in ordered)) ordered[k] = mob[k]; });
  Object.keys(mob).forEach(function (k) { delete mob[k]; });
  Object.assign(mob, ordered);

  if (eq(before, mob)) { status(tr('mobed_apply_nochange')); return; }
  if (typeof historyManager !== 'undefined') {
   historyManager.startAction();
   historyManager.recordMobChange(key, before, clone(mob));
   historyManager.commitAction();
  }
  if (typeof worldDirty !== 'undefined') worldDirty = true;
  if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'accion_spawn_mob', id: key, mob: mob });   // (en la red "spawn" con el mismo id = reemplazar ese mob)
  if (typeof toggleMobInfo === 'function') { try { toggleMobInfo(false); } catch (e) { /* sin panel */ } }
  S.hpTouched = true;
  status('✔ ' + tr('mobed_applied_world'));
 }

 function saveAsNew() {
  const spec = cleanSpec();
  const typed = spec.name.trim();
  const name = typed || (niceMob(spec.base) + ' (custom)');
  const list = loadPresets();
  const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  list.push({ id: id, name: name, spec: spec });
  if (!storePresets(list)) { status(tr('mobed_storage_err')); return; }
  // Se cierra la ventana donde se personaliza el mob y el Mob Browser muestra la pestaña Custom con el mob recién guardado elegido
  S.presetId = id;
  window.closeCustomMob();
  const mm = el('mobs-modal');
  if (mm) mm.style.display = 'block';
  window.filterMobs('Custom', true);
  const mine = document.querySelector('#mobs-grid .mob-item[data-preset="' + id + '"]');
  if (mine && mine.scrollIntoView) { try { mine.scrollIntoView({ block: 'nearest' }); } catch (e) { /* sin scroll */ } }
  status('✔ ' + tr('mobed_saved') + ': ' + name);
  const tab = el('tab-mob-custom');
  if (tab) { tab.classList.remove('flash'); void tab.offsetWidth; tab.classList.add('flash'); }
 }
 function updatePreset() {
  const list = loadPresets();
  const p = list.filter(function (x) { return x.id === S.presetId; })[0];
  if (!p) { status(''); return; }
  p.spec = cleanSpec();
  p.name = p.spec.name.trim() || p.name;
  if (!storePresets(list)) { status(tr('mobed_storage_err')); return; }
  window.filterMobs('Custom', true);
  status('✔ ' + tr('mobed_updated'));
 }
 function deletePreset() {
  const list = loadPresets().filter(function (x) { return x.id !== S.presetId; });
  if (!storePresets(list)) { status(tr('mobed_storage_err')); return; }
  S.presetId = null;
  window.filterMobs('Custom');
  if (!list.length) window.previewMob('zombie');
  status(tr('mobed_deleted'));
 }
 function resetPanel() {
  const keepId = S.presetId;
  if (keepId) {
   const p = loadPresets().filter(function (x) { return x.id === keepId; })[0];
   if (p) { window.previewMob(p.spec.base, keepId); return; }
  }
  window.previewMob(S.spec.base);
 }

 // ---------------------------------------------------------------- Mob Browser
 window.openMobModal = function () {
  closeArmorPop();
  bindSideSync();
  el('mobs-modal').style.display = 'block';
  window.filterMobs(activeMobTab, true);
 };

 window.previewMob = function (base, presetId) {
  let spec;
  S.presetId = null;
  S.worldKey = null;      // se eligió otro mob: ya no se está editando el mob del mundo
  if (presetId) {
   const p = loadPresets().filter(function (x) { return x.id === presetId; })[0];
   if (p) { spec = clone(p.spec); S.presetId = p.id; }
  }
  if (!spec) spec = defaultSpec(tpl(base) ? base : 'zombie');
  S.spec = spec;
  S.hpTouched = false;
  currentlyPreviewedMob = spec.base;
  document.querySelectorAll('#mobs-grid .mob-item').forEach(function (n) {
   const on = presetId ? n.dataset.preset === presetId : (!n.dataset.preset && n.dataset.mob === spec.base);
   n.classList.toggle('selected', on);
  });
  renderAll(); resetFormScroll();   // un mob distinto: el panel vuelve arriba
  try { if (typeof audioManager !== 'undefined' && spec.base !== 'spawnskin') audioManager.playMobSound(spec.base); } catch (e) { /* sin sonido */ }   // (la spawnskin no tiene sonido propio)
 };

 // Casillas de la pestaña Custom (con el filtro del buscador). Devuelve la primera casilla y si la elegida sigue visible.
 function fillCustomGrid(grid, sel) {
  const all = loadPresets();
  const q = (S.search || '').trim();
  const list = q ? all.filter(function (p) { return matchPreset(p, q); }) : all;
  let firstTarget = null, keepOk = false;
  if (!all.length) {
   const m = mk('p', 'mob-empty');
   m.innerHTML = tr('mobed_custom_empty');
   grid.appendChild(m);
  } else if (!list.length) {
   grid.appendChild(mk('p', 'mob-empty', tr('mobed_search_empty')));
  }
  list.forEach(function (p) {
   const d = mk('div', 'mob-item selectable');
   d.dataset.preset = p.id;
   const shown = (p.spec.name || '').trim() || p.name;
   const tg = (p.spec.tags || []).map(function (x) { return '#' + x; }).join(' ');
   d.title = shown + ' (' + niceMob(p.spec.base) + ')' + (tg ? '\n' + tg : '');
   const im = document.createElement('img'); setSpecImg(im, p.spec);
   d.appendChild(im);
   d.appendChild(mk('span', 'mob-name', shown));
   if (tg) d.appendChild(mk('span', 'mob-tile-tags', tg));
   d.onclick = function () { window.previewMob(p.spec.base, p.id); };
   grid.appendChild(d);
   if (!firstTarget) firstTarget = [p.spec.base, p.id];
  });
  // el mob elegido cuenta como "sigue ahí" aunque el buscador lo esconda (así un cambio de idioma no cambia de mob)
  if (sel && sel.preset && all.some(function (x) { return x.id === sel.preset; })) keepOk = true;
  return { firstTarget: firstTarget, keepOk: keepOk };
 }
 // Al escribir en el buscador solo se vuelve a filtrar la lista (el panel de la derecha NO cambia de mob)
 function refreshCustomGrid() {
  if (activeMobTab !== 'Custom') return;
  const grid = el('mobs-grid');
  if (!grid) return;
  grid.textContent = '';
  fillCustomGrid(grid, null);
  grid.querySelectorAll('.mob-item').forEach(function (n) { n.classList.toggle('selected', !!S.presetId && n.dataset.preset === S.presetId); });
 }
 // Sugerencias de tags del buscador: al hacer clic en la barra salen todos los tags que existen
 function currentToken(inp) {
  const v = inp.value;
  const m = /(\S*)$/.exec(v);
  return { text: m ? m[1] : '', start: v.length - (m ? m[1].length : 0) };
 }
 function hideSearchSug() { const b = el('mob-search-sug'); if (b) b.style.display = 'none'; }
 function paintSearchSug() {
  const inp = el('mob-search'), box = el('mob-search-sug');
  if (!inp || !box) return;
  box.textContent = '';
  if (document.activeElement !== inp) { box.style.display = 'none'; return; }
  const tok = currentToken(inp).text.toLowerCase();
  const word = tok.charAt(0) === '#' ? tok.slice(1) : tok;
  const used = inp.value.toLowerCase().split(/\s+/).filter(function (x) { return x.charAt(0) === '#'; });
  const list = tagVocab().filter(function (v) {
   const lo = v.tag.toLowerCase();
   if (used.indexOf('#' + lo) >= 0 && '#' + lo !== tok) return false;
   if (!word) return true;
   return tok.charAt(0) === '#' ? lo.indexOf(word) === 0 : lo.indexOf(word) >= 0;
  });
  if (!list.length) {
   if (!tagVocab().length) { box.appendChild(mk('div', 'mob-sug-none', tr('mobed_tags_none'))); box.style.display = 'block'; }
   else box.style.display = 'none';
   return;
  }
  box.appendChild(mk('div', 'mob-sug-head', tr('mobed_tags_sug')));
  list.slice(0, 20).forEach(function (v) {
   const it = mk('div', 'mob-sug-item');
   it.dataset.tag = v.tag;
   it.appendChild(mk('span', '', '#' + v.tag));
   it.appendChild(mk('em', '', String(v.count)));
   it.onmousedown = function (e) {
    e.preventDefault();
    const t = currentToken(inp);
    inp.value = inp.value.slice(0, t.start) + '#' + v.tag + ' ';
    S.search = inp.value;
    refreshCustomGrid();
    paintSearchSug();
   };
   box.appendChild(it);
  });
  box.style.display = 'block';
 }
 let searchBound = false;
 function bindSearch() {
  if (searchBound) return;
  const inp = el('mob-search');
  if (!inp) return;
  searchBound = true;
  inp.addEventListener('input', function () { S.search = inp.value; refreshCustomGrid(); paintSearchSug(); });
  inp.addEventListener('focus', paintSearchSug);
  inp.addEventListener('click', paintSearchSug);
  inp.addEventListener('blur', hideSearchSug);
  inp.addEventListener('keydown', function (e) {
   if (e.key === 'Escape') { e.stopPropagation(); hideSearchSug(); inp.blur(); }
  });
 }

 window.filterMobs = function (dimension, keep) {
  bindSearch();
  activeMobTab = dimension;
  ['animals', 'overworld', 'nether', 'end', 'custom'].forEach(function (n) {
   const tab = el('tab-mob-' + n);
   if (tab) tab.classList.toggle('active', n === dimension.toLowerCase());
  });
  const grid = el('mobs-grid');
  if (!grid) return;
  grid.textContent = '';

  let firstTarget = null;
  const sel = S.spec ? { base: S.spec.base, preset: S.presetId } : null;
  let keepOk = false;

  const swrap = el('mob-search-wrap');
  if (swrap) swrap.style.display = dimension === 'Custom' ? '' : 'none';
  if (dimension !== 'Custom') hideSearchSug();

  if (dimension === 'Custom') {
   const r = fillCustomGrid(grid, sel);
   firstTarget = r.firstTarget; keepOk = r.keepOk;
  } else {
   (MOBS_BY_DIMENSION[dimension] || []).forEach(function (id) {
    const d = mk('div', 'mob-item selectable');
    d.dataset.mob = id;
    d.title = niceMob(id);
    const im = document.createElement('img');
    if (id === 'spawnskin') setPlayerImg(im); else setImg(im, id);
    d.appendChild(im);
    d.appendChild(mk('span', 'mob-name', niceMob(id)));
    d.onclick = function () { window.previewMob(id); };
    grid.appendChild(d);
    if (!firstTarget) firstTarget = [id, null];
    if (sel && !sel.preset && sel.base === id) keepOk = true;
   });
  }

  if (keep && keepOk) {
   // se queda lo que ya estaba elegido (y editado); solo se vuelve a marcar la casilla
   grid.querySelectorAll('.mob-item').forEach(function (n) {
    n.classList.toggle('selected', sel.preset ? n.dataset.preset === sel.preset : (!n.dataset.preset && n.dataset.mob === sel.base));
   });
   if (sel.preset) renderAll();
  } else if (firstTarget) {
   window.previewMob(firstTarget[0], firstTarget[1]);
  } else if (!S.spec) {
   window.previewMob('zombie');
  } else {
   // pestaña Custom vacía: el panel sigue con el mob que estaba (se puede guardar desde ahí)
   S.presetId = null; renderAll();
  }
 };

 window.spawnPreviewedMob = function () {
  if (!S.spec) return;
  const spec = cleanSpec();
  if (typeof selectMobToSpawn === 'function') selectMobToSpawn(spec.base, spec);
 };

 // Cuando se cambia el idioma, se vuelven a pintar los textos que se arman por código.
 window.mobEditorOnLanguageChanged = function () {
  if (S.spec) renderAll();
  const m = el('mobs-modal');
  if (m && m.style.display === 'block') window.filterMobs(activeMobTab, true);
 };

 // Pruebas / depuración
 window.__mobEditor = { S: S, defaultSpec: defaultSpec, normalizeSpec: normalizeSpec, SCHEMA: SCHEMA, loadPresets: loadPresets, pickItem: pickItem };
})();
