// =====================================================================
// 🎒 INVENTARIO DEL JUGADOR  (pestaña View → grupo "Player Inventory")
// =====================================================================
// Qué hace:
//   • Muestra y edita lo que lleva el jugador en el mundo que está abierto: la hotbar, los 36 espacios de la
//     mochila y las 4 piezas de armadura. Se guarda dentro del mundo (se escribe al guardar el .mbw).
//   • El grupo "Player Inventory" de la pestaña View tiene una mini hotbar (como la de Home) y un botón » que abre
//     la ventana. La ventana reutiliza #inventory-modal (el mismo del inventario creativo): el panel del jugador
//     es #player-inv-panel y el botón "Show creative inventory" abre a su lado el inventario creativo del editor
//     para tomar objetos y pasarlos al jugador (el objeto tomado se queda en el cursor: heldItem).
//
// Dónde se guarda (mbwom.world):
//   inventoryList          45 espacios  [id, cantidad, daño, extras]      índices 0-8 = hotbar, 9-44 = mochila (4 filas de 9)
//   armors                 4 piezas     [id, daño, extras]                cabeza, pecho, piernas, pies
//   selectedInventoryItem  0-8          espacio de la hotbar elegido
//   Un espacio vacío es ["air", 0, 0, {}] (en la armadura ["air", 0, {}]). Los mundos Superflat usan [null, 0, 0, {}].
//   Colores y variantes van en extras.type (p. ej. ["bed", 1, 0, {"type": "white"}]); el nombre en extras.nameChange.
//
// SIN VERIFICAR en el juego (se dedujo de mundos reales): que la hotbar sean los índices 0-8 y la mochila 9-44.
//
// MODO COFRE (clic derecho sobre un cofre con la herramienta Move):
//   La misma ventana muestra arriba los 27 espacios del cofre (3 × 9) y debajo el inventario del jugador, así se pueden
//   pasar objetos de un lado a otro (clic, clic derecho, Shift + clic) o tomarlos del inventario creativo.
//   Los cambios se escriben directo en mbwom.chests["blockX{x}Y{y}"] (mismo formato que el resto de cofres del mundo:
//   [id, cantidad, daño, extras]; vacío = ["air", 0, 0, {}]). Al cerrar la ventana, si algo cambió, se guarda UN paso
//   en el historial (Ctrl+Z lo deshace) y se avisa a los demás jugadores (actualizar_bloque).
// =====================================================================
(function () {
 'use strict';

 const TOTAL = 45;                 // espacios del inventario
 const HOTBAR = 9;                 // los primeros 9 son la hotbar
 // Piezas de armadura, en el orden en que se guardan (cabeza → pies). "ghost" = objeto cuya silueta se ve en el espacio vacío.
 const PARTS = [
  { suffix: 'Cap',   ghost: 'IronCap',   key: 'pinv_part_head',  fallback: 'Helmet' },
  { suffix: 'Shirt', ghost: 'IronShirt', key: 'pinv_part_chest', fallback: 'Chestplate' },
  { suffix: 'Pants', ghost: 'IronPants', key: 'pinv_part_legs',  fallback: 'Leggings' },
  { suffix: 'Shoes', ghost: 'IronShoes', key: 'pinv_part_feet',  fallback: 'Boots' }
 ];
 // Objetos que no se apilan (siempre de 1 en 1). Todo lo demás se apila hasta 64.
 // Deducido de un mundo real (SnowyLand): herramientas y armaduras siempre van de 1, y estos ids nunca pasaron de 1:
 // arco (bow), cama (bed), libro con comando (cbook), libro encantado (ebook), cabeza de mob (mh), cubetas (b, wr, lbk, wbk, bk, mbk),
 // caña (fr), mechero (fas), silla (saddle), brújula (compass), pastel (cake).
 const NO_STACK = /(Sword|Pickaxe|Axe|Shovel|Hoe|Cap|Shirt|Pants|Shoes|Shear)$/;
 const NO_STACK_IDS = ['bow', 'bed', 'cbook', 'ebook', 'mh', 'b', 'wr', 'lbk', 'wbk', 'bk', 'mbk', 'fr', 'fas', 'saddle', 'compass', 'cake'];

 // id del objeto en el mundo -> id con el que el editor tiene la textura (la cama del mundo es "bed"; el editor la dibuja como "bed1")
 const TEX_ID = { bed: 'bed1' };

 // ---- Durabilidad máxima por objeto (la usan las ranuras, los tooltips y el editor de durabilidad)
 // Herramientas: valores que ya usaba el editor (clásicos de Minecraft). Armaduras: valores clásicos de Minecraft (cuero, hierro, oro, diamante);
 // la de dragón usa los mismos que el diamante. SIN VERIFICAR en Mine Blocks (el juego no los publica).
 const TOOL_DUR = { Wooden: 60, Stone: 132, Iron: 251, Gold: 33, Diamond: 1562 };
 const TOOL_RE = /^(Wooden|Stone|Iron|Gold|Diamond)(Pickaxe|Sword|Axe|Shovel|Hoe)$/;
 const ARMOR_DUR = { Leather: [55, 80, 75, 65], Iron: [165, 240, 225, 195], Gold: [77, 112, 105, 91], Diamond: [363, 528, 495, 429], Dragon: [363, 528, 495, 429] };
 const ARMOR_RE = /^(Leather|Iron|Gold|Diamond|Dragon)(Cap|Shirt|Pants|Shoes)$/;
 const ARMOR_IDX = { Cap: 0, Shirt: 1, Pants: 2, Shoes: 3 };
 function maxDurability(id) {
  id = String(id || '');
  if (id === 'ObsidianPickaxe') return 2500;
  let m = TOOL_RE.exec(id);
  if (m) return TOOL_DUR[m[1]];
  m = ARMOR_RE.exec(id);
  if (m) return ARMOR_DUR[m[1]][ARMOR_IDX[m[2]]];
  return 0;
 }
 window.itemMaxDurability = maxDurability;
 // Barra de durabilidad abajo del objeto (solo si ya tiene desgaste): verde lleno -> rojo casi roto. "size" = lado del lienzo en px.
 function drawDurBar(ctx, size, dmg, id) {
  const max = maxDurability(id);
  dmg = Number(dmg) || 0;
  if (!max || dmg <= 0) return;
  const p = Math.max(0, Math.min(1, (max - dmg) / max));
  const u = size / 16;
  ctx.fillStyle = '#000';
  ctx.fillRect(2 * u, 13 * u, 12 * u, 2 * u);
  ctx.fillStyle = 'hsl(' + Math.round(p * 120) + ',100%,45%)';
  ctx.fillRect(2 * u, 13 * u, Math.max(u, Math.round(12 * u * p)), u * 1.2);
 }
 window.mbwDrawDurBar = drawDurBar;

 const st = { open: false, expanded: false, chest: null, furnace: null, craft: null };   // craft = { size: 2|3, grid: [objetos], table: {x, y}|null } (▶ Modo Jugar)     // ventana abierta / inventario creativo visible / cofre que se está editando { x, y, key, before }

 const $ = (id) => document.getElementById(id);
 const tr = (k, fb) => { const v = (typeof window.t === 'function') ? window.t(k) : k; return (v && v !== k) ? v : (fb || k); };
 const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
 const num = (v) => { v = Number(v); return Number.isFinite(v) ? v : 0; };
 function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; } }
 function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
 function stable(o) {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
  return JSON.stringify(o);
 }

 // ------------------------------------------------------------------ datos del mundo
 function world() { return (typeof mbwom !== 'undefined' && mbwom && mbwom.world) ? mbwom.world : null; }

 // Antes de ESCRIBIR: crea lo que falte (mundos sin inventario) sin tocar lo que ya existe.
 function ensure() {
  const w = world();
  if (!w) return null;
  if (!Array.isArray(w.inventoryList)) w.inventoryList = [];
  while (w.inventoryList.length < TOTAL) w.inventoryList.push(['air', 0, 0, {}]);
  if (!Array.isArray(w.armors)) w.armors = [];
  while (w.armors.length < 4) w.armors.push(['air', 0, {}]);
  if (typeof w.selectedInventoryItem !== 'number') w.selectedInventoryItem = 0;
  return w;
 }

 // Un objeto = { id, qty, dmg, extras, legacy }.  legacy = variante guardada (mal) como texto en el 3.er dato.
 function readItem(a, armor) {
  if (!Array.isArray(a) || !a[0] || a[0] === 'air') return null;
  const it = { id: String(a[0]), qty: 1, dmg: 0, extras: {}, legacy: undefined };
  if (armor) {
   it.dmg = num(a[1]);
   if (isObj(a[2])) it.extras = a[2];
  } else {
   it.qty = Math.max(1, Math.floor(num(a[1])) || 1);
   if (typeof a[2] === 'string') it.legacy = a[2]; else it.dmg = num(a[2]);
   if (isObj(a[3])) it.extras = a[3];
  }
  return it;
 }
 function itemToArr(it, armor, prev) {
  if (!it) {
   if (!armor && (prev === null || prev === 0)) return prev;      // algunos cofres guardan el espacio vacío como null o 0: se respeta
   const nul = Array.isArray(prev) && prev[0] === null;          // los mundos Superflat usan null en vez de "air"
   return armor ? ['air', 0, {}] : [nul ? null : 'air', 0, 0, {}];
  }
  const ex = clone(it.extras || {});
  if (it.legacy && ex.type === undefined) ex.type = it.legacy;
  return armor ? [it.id, it.dmg || 0, ex] : [it.id, it.qty, it.dmg || 0, ex];
 }
 // Un espacio: { k: 'i', i: 0-44 } = inventario, { k: 'a', i: 0-3 } = armadura, { k: 'c', i: 0-26 } = cofre que se está editando
 // Combustibles del horno: los objetos que tienen "fuel" en BlockData del juego (código decompilado de Mine Blocks 2.0.0).
 // El número es cuánto dura cada uno (en "tics" del horno; un objeto se cocina cada 10).
 const FUEL_IDS = ['cl', 'cl2', 'clb', 'wd', 'wp', 'st', 'sl', 'fnc', 'fncg', 'bb', 'bbb', 'hay', 'magma', 'lbk', 'WoodenPickaxe', 'WoodenAxe', 'WoodenShovel', 'WoodenHoe', 'WoodenSword'];
 const F_KEYS = ['input', 'fuel', 'output'];
 const isFuel = (id) => FUEL_IDS.indexOf(String(id)) >= 0;
 window.mbwFurnaceFuelIds = FUEL_IDS;
 const CHEST_SLOTS = 27;
 // Datos del horno que se está editando: mbwom.toSmelt["blockX{x}Y{y}"] = { input, fuel, output, fuelTimer, fuelTimerTotal, smeltTimer }
 function furnaceData(create) {
  if (!st.furnace || typeof mbwom === 'undefined' || !mbwom) return null;
  let d = mbwom.toSmelt;
  if (!isObj(d)) {
   if (!create) return null;
   d = {};
   mbwom.toSmelt = d;
   if (mbwom.world && mbwom.currentScene !== undefined) mbwom.world['toSmelt' + mbwom.currentScene] = d;
  }
  let f = d[st.furnace.key];
  if (!isObj(f)) {
   if (!create) return null;
   f = { output: ['air', 0, 0, {}], fuelTimerTotal: 0, smeltTimer: 0, input: ['air', 0, 0, {}], fuel: ['air', 0, 0, {}], fuelTimer: 0 };
   d[st.furnace.key] = f;
  }
  F_KEYS.forEach((k) => { if (!Array.isArray(f[k])) f[k] = ['air', 0, 0, {}]; });
  return f;
 }
 // cuántos espacios tiene lo que está abierto: cofre 27; dispenser / dropper 9 (cuadro de 3×3, como en el juego)
 const boxSlots = () => (st.chest && st.chest.kind === 'disp') ? 9 : CHEST_SLOTS;
 function chestList() {
  if (!st.chest || typeof mbwom === 'undefined' || !mbwom) return null;
  if (st.chest.kind === 'disp') {                               // dispenser / dropper: sus cosas van en states["blockX..Y.._2"]
   let sd = mbwom.states;
   if (!isObj(sd)) { sd = {}; mbwom.states = sd; if (mbwom.world && mbwom.currentScene !== undefined) mbwom.world['states' + mbwom.currentScene] = sd; }
   const k2 = st.chest.key + '_2';
   if (!Array.isArray(sd[k2])) sd[k2] = [];
   const l2 = sd[k2];
   while (l2.length < 9) l2.push(['air', 0, 0, {}]);
   return l2;
  }
  let d = mbwom.chests;
  if (!isObj(d)) {                                            // la dimensión no tenía diccionario de cofres (viene como 0): se crea
   d = {};
   mbwom.chests = d;
   if (mbwom.world && mbwom.currentScene !== undefined) mbwom.world['chests' + mbwom.currentScene] = d;
  }
  if (!Array.isArray(d[st.chest.key])) d[st.chest.key] = [];
  const list = d[st.chest.key];
  while (list.length < CHEST_SLOTS) list.push(['air', 0, 0, {}]);
  return list;
 }
 function slotArr(a) {
  if (a.k === 'c') { const l = chestList(); return l ? l[a.i] : null; }
  if (a.k === 'f') { const f = furnaceData(true); return f ? f[F_KEYS[a.i]] : null; }
  const w = world(); if (!w) return null; return ((a.k === 'a' ? w.armors : w.inventoryList) || [])[a.i];
 }
 function getSlot(a) {
  if (a.k === 'k') return st.craft ? (st.craft.grid[a.i] || null) : null;           // 🛠 cuadrícula de crafteo
  if (a.k === 'o') { const o = craftOut(); return o ? readItem(o, false) : null; }  // 🛠 lo que sale (no se puede poner nada)
  return readItem(slotArr(a), a.k === 'a');
 }
 function craftOut() {
  if (!st.craft || !window.mbwCraft) return null;
  if (st.craft.grid.some((it) => it && it.missing)) return null;      // 📖 falta algo (en rojo): no se puede crear
  return window.mbwCraft.match(st.craft.grid, st.craft.size);
 }
 function setSlot(a, it) {
  if (a.k === 'k') { if (st.craft) st.craft.grid[a.i] = it ? copy(it, it.qty) : null; return; }
  if (a.k === 'o') return;
  if (a.k === 'c') {
   const l = chestList();
   if (l) l[a.i] = itemToArr(it, false, l[a.i]);
   return;
  }
  if (a.k === 'f') {
   const f = furnaceData(true);
   if (f) f[F_KEYS[a.i]] = itemToArr(it, false, f[F_KEYS[a.i]]);
   return;
  }
  const w = ensure();
  if (!w) return;
  const list = a.k === 'a' ? w.armors : w.inventoryList;
  list[a.i] = itemToArr(it, a.k === 'a', list[a.i]);
 }
 function variantOf(it) {
  const t = it && it.extras && it.extras.type;
  return (typeof t === 'string' && t) ? t : (it ? it.legacy : undefined);
 }
 function normKey(it) {
  const ex = clone(it.extras || {});
  if (it.legacy && ex.type === undefined) ex.type = it.legacy;
  return it.id + '|' + (it.dmg || 0) + '|' + stable(ex);
 }
 const same = (a, b) => normKey(a) === normKey(b);
 const maxStack = (it) => (NO_STACK.test(it.id) || NO_STACK_IDS.indexOf(it.id) >= 0) ? 1 : 64;
 const copy = (it, qty) => ({ id: it.id, qty: qty, dmg: it.dmg || 0, extras: it.extras, legacy: it.legacy });

 // ------------------------------------------------------------------ cursor (heldItem, el mismo del inventario creativo)
 function toHeld(it) {
  const h = { type: it.id, count: it.qty, nbt: clone(it.extras || {}), dmg: it.dmg || 0, src: 'inv' };
  if (it.legacy && h.nbt.type === undefined) h.nbt.type = it.legacy;
  const v = variantOf(it);
  if (v !== undefined) h.states1 = v;
  // el cursor dibuja el objeto con el id del editor (la cama real "bed" se dibuja como "bed1")
  if (TEX_ID[it.id]) h.iconType = TEX_ID[it.id];
  return h;
 }
 // Objeto del cursor -> objeto del jugador. Un objeto del inventario creativo trae el color/variante en states1
 // (p. ej. cloth + "red"): en el mundo real eso se guarda en extras.type.
 function fromHeld(h) {
  if (!h || !h.type || h.type === 'air') return null;
  const ex = isObj(h.nbt) ? clone(h.nbt) : {};
  // el creador de objetos del editor guarda el nombre como "name"; el juego lo llama "nameChange"
  if (typeof ex.name === 'string' && ex.nameChange === undefined) ex.nameChange = ex.name;
  delete ex.name;
  if (typeof h.states1 === 'string' && h.states1 && ex.type === undefined) ex.type = h.states1;
  // Los objetos del inventario creativo usan ids de bloque del editor; en el mundo el objeto se llama distinto:
  let id = String(h.type);
  if (id === 'bed1' || id === 'bed2') id = 'bed';                                      // la cama (el color va en extras.type)
  if (id === 'book' && Object.keys(ex).some((k) => ex[k] === 'enchant')) id = 'ebook'; // libro con encantamientos = libro encantado
  return { id: id, qty: Math.max(1, Math.floor(num(h.count)) || 1), dmg: num(h.dmg), extras: ex, legacy: undefined };
 }
 function refreshCursor() { if (typeof updateFloatingItem === 'function') updateFloatingItem(); try { document.body.classList.toggle('pinv-holding', !!heldItem); } catch (e) { /* nada */ } }

 // ------------------------------------------------------------------ dibujo
 function ready() { return !!(window.images && window.images.blocks && window.images.blocks.complete); }
 // Dibuja un objeto en un canvas cuadrado de "size" px. Si el editor no tiene textura para ese id (hay objetos del juego
 // que el editor no dibuja), sale una casilla gris con las primeras letras del id para que se pueda reconocer.
 function paintId(cvs, id, variant, size, extras, dmg) {
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  cvs.__itemTok = 0;                                  // (si una cabeza estaba esperando su skin para este lienzo, ya no)
  let ro = null;
  const miss = window.texturesMap && window.texturesMap.missing;
  try { ro = (typeof getBlockObject === 'function') ? getBlockObject({ type: TEX_ID[id] || id, states1: variant, nbt: extras }) : null; } catch (e) { ro = null; }
  if (ro && ro !== miss && ready()) { drawItemIcon(ctx, ro, id, extras, 0, 0, size, size); drawDurBar(ctx, size, dmg, id); return; }
  ctx.fillStyle = '#5E5E5E'; ctx.fillRect(1, 1, size - 2, size - 2);
  ctx.strokeStyle = '#2B2B2B'; ctx.lineWidth = 1; ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.round(size / 3.4) + 'px monospace';
  ctx.fillText(String(id).slice(0, size > 30 ? 4 : 2), size / 2, size / 2 + 1);
 }
 function prettyName(it) {
  const n = it.extras && it.extras.nameChange;
  if (typeof n === 'string' && n.trim()) return n;
  let name = String(it.id).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  const v = variantOf(it);
  if (v && it.id !== 'potion') name += ' (' + v + ')';
  return name;
 }
 function tooltipHtml(it, withHint) {
  let html = '<strong>' + esc(prettyName(it)) + '</strong>';
  const ex = it.extras || {};
  const tl = (typeof enchantTranslations !== 'undefined') ? enchantTranslations : {};
  Object.keys(ex).forEach((k) => {
   if (ex[k] === 'enchant') html += '<span class="tooltip-enchant" style="color: #FFFF; display: block; line-height: 0.6; margin-top: 2px;">' + esc(tl[k] || k) + '</span>';
  });
  const max = maxDurability(it.id);
  if (max) {                                                         // herramientas y armaduras: durabilidad que le queda
   const left = Math.max(0, max - (it.dmg || 0));
   html += '<span class="tooltip-dur" style="color: #BFBFBF; display: block; margin-top: 4px;">' + esc(tr('pinv_durability', 'Durability')) + ': ' + left + ' / ' + max + '</span>';
   if (withHint !== false) html += '<span class="tooltip-dur-hint" style="color: #8A8A8A; display: block; font-size: 0.8em;">' + esc(tr('pinv_dur_hint', 'Ctrl + click: edit durability')) + '</span>';
  }
  return html;
 }
 // Los tooltips los pinta el "tooltip maestro" de ui-handler.js (clase enchanted-slot o pinv-tip + data-enchant-tooltip).
 // enchanted-slot además le pone el brillo morado: solo se usa en objetos encantados y pociones.
 function decorate(div, it, noHint) {
  if (!it) return;
  const ex = it.extras || {};
  const glow = it.id === 'potion' || it.id === 'ebook' || Object.keys(ex).some((k) => ex[k] === 'enchant');
  div.classList.add(glow ? 'enchanted-slot' : 'pinv-tip');
  div.dataset.enchantTooltip = tooltipHtml(it, !noHint);
 }

 let ribbonTimer = null;
 function renderRibbon() {
  const box = $('player-hotbar-container');
  if (!box) return;
  clearTimeout(ribbonTimer);
  if (!ready()) ribbonTimer = setTimeout(renderRibbon, 400);       // las texturas aún no cargaron: se vuelve a pintar
  const w = world();
  const sel = w ? num(w.selectedInventoryItem) : -1;
  box.innerHTML = '';
  for (let i = 0; i < HOTBAR; i++) {
   const it = readItem(w && Array.isArray(w.inventoryList) ? w.inventoryList[i] : null, false);
   const d = document.createElement('div');
   d.className = 'phb-slot' + (i === sel ? ' active' : '');
   d.onclick = () => select(i);
   const c = document.createElement('canvas');
   c.width = 24; c.height = 24;
   if (it) { paintId(c, it.id, variantOf(it), 24, it.extras, it.dmg); decorate(d, it, true); }
   d.appendChild(c);
   box.appendChild(d);
  }
 }

 function slotEl(addr, ghostPart) {
  const it = getSlot(addr);
  const d = document.createElement('div');
  d.className = 'pinv-slot';
  d.__addr = addr;
  d.onclick = (e) => { if (dragEat(e)) return; onSlot(addr, e, false); };
  d.oncontextmenu = (e) => { e.preventDefault(); ctxFired = true; if (dragEat(e)) return; onSlot(addr, e, true); };
  d.addEventListener('pointerdown', (e) => dragStart(addr, d, e));
  if (it && it.missing) d.classList.add('pinv-missing');             // 📖 (recetario) falta este material
  if (it) {
   const c = document.createElement('canvas');
   c.width = 48; c.height = 48;
   paintId(c, it.id, variantOf(it), 48, it.extras, it.dmg);
   d.appendChild(c);
   if (it.qty > 1) {
    const n = document.createElement('span');
    n.className = 'pinv-count';
    n.textContent = it.qty;
    d.appendChild(n);
   }
   decorate(d, it);
  } else if (ghostPart) {
   // espacio de armadura vacío: silueta de la pieza
   const c = document.createElement('canvas');
   c.width = 48; c.height = 48;
   c.className = 'pinv-ghost';
   paintId(c, ghostPart.ghost, undefined, 48);
   d.appendChild(c);
   d.title = tr(ghostPart.key, ghostPart.fallback);
  }
  return d;
 }

 function closeArmorMenu() { if (window.mobArmorMenu && window.mobArmorMenu.isOpen()) window.mobArmorMenu.close(); }
 function renderPanel() {
  if (!st.open) return;
  closeArmorMenu();
  const w = world();
  const armor = $('pinv-armor'), main = $('pinv-main'), hot = $('pinv-hotbar'), trash = $('pinv-trash');
  if (!armor || !main || !hot || !trash) return;
  armor.innerHTML = ''; main.innerHTML = ''; hot.innerHTML = ''; trash.innerHTML = '';
  // el tooltip del espacio que se acaba de redibujar ya no corresponde a nada
  if (typeof masterTooltip !== 'undefined') masterTooltip.style.display = 'none';
  if (typeof lastHoveredSlot !== 'undefined') lastHoveredSlot = null;
  const chestBox = $('pinv-chest-box'), chestGrid = $('pinv-chest');
  if (chestBox) chestBox.style.display = st.chest ? '' : 'none';
  if (chestGrid) {
   chestGrid.innerHTML = '';
   chestGrid.classList.toggle('pinv-grid-3', !!(st.chest && st.chest.kind === 'disp'));
   if (st.chest) for (let i = 0; i < boxSlots(); i++) chestGrid.appendChild(slotEl({ k: 'c', i: i }));
  }
  const fbox = $('pinv-furnace-box'), fgrid = $('pinv-furnace');
  if (fbox) fbox.style.display = st.furnace ? '' : 'none';
  if (fgrid) {
   fgrid.innerHTML = '';
   if (st.furnace) {
    const mk = (i, cls) => { const e = slotEl({ k: 'f', i: i }); e.classList.add(cls); return e; };
    const left = document.createElement('div'); left.className = 'pinv-f-col';
    left.appendChild(mk(0, 'pinv-f-in'));
    const fire = document.createElement('div'); fire.className = 'pinv-f-fire'; fire.textContent = '🔥'; left.appendChild(fire);
    left.appendChild(mk(1, 'pinv-f-fuel'));
    const arrow = document.createElement('div'); arrow.className = 'pinv-f-arrow'; arrow.textContent = '➡️';
    if (window.mbwPlaying) {                                       // ▶ Modo Jugar: el horno funciona → se ve si está prendido y cuánto le falta
     const fd = furnaceData(false) || {};
     const ft = Number(fd.fuelTimer) || 0, ftt = Number(fd.fuelTimerTotal) || 0, sm = Number(fd.smeltTimer) || 0;
     fire.classList.toggle('off', !(ft > 0));
     fire.style.setProperty('--fuel', ftt > 0 ? Math.max(0, Math.min(1, ft / ftt)) : 0);
     const bar = document.createElement('i'); bar.className = 'pinv-f-prog'; bar.style.width = Math.round(Math.min(1, sm / 10) * 100) + '%';
     arrow.appendChild(bar);
    }
    fgrid.appendChild(left); fgrid.appendChild(arrow); fgrid.appendChild(mk(2, 'pinv-f-out'));
   }
  }
  renderCraft();
  renderFuelPalette();
  renderSkin();
  bookSetup(); renderBook();
  for (let i = 0; i < 4; i++) armor.appendChild(slotEl({ k: 'a', i: i }, PARTS[i]));
  for (let i = HOTBAR; i < TOTAL; i++) main.appendChild(slotEl({ k: 'i', i: i }));
  const sel = w ? num(w.selectedInventoryItem) : -1;
  for (let i = 0; i < HOTBAR; i++) {
   const cell = document.createElement('div');
   cell.className = 'pinv-hcell' + (i === sel ? ' sel' : '');
   const bar = document.createElement('div');
   bar.className = 'pinv-bar';
   bar.onclick = () => select(i);
   cell.appendChild(bar);
   cell.appendChild(slotEl({ k: 'i', i: i }));
   hot.appendChild(cell);
  }
  // papelera: lo que se suelta aquí se borra
  const t = document.createElement('div');
  t.className = 'pinv-slot';
  t.title = tr('pinv_trash', 'Trash');
  t.onclick = t.oncontextmenu = (e) => { e.preventDefault(); if (heldItem) { heldItem = null; refreshCursor(); } };
  const ic = document.createElement('span');
  ic.className = 'pinv-trash-icon';
  ic.textContent = '🗑️';
  t.appendChild(ic);
  trash.appendChild(t);
 }
 // 🛠 Crafteo (▶ Modo Jugar): 2×2 en el inventario, 3×3 en la mesa de crafteo, una flecha y lo que sale
 function renderCraft() {
  const box = $('pinv-craft-box'), grid = $('pinv-craft');
  if (box) box.style.display = st.craft ? '' : 'none';
  if (!grid) return;
  grid.innerHTML = '';
  if (!st.craft) return;
  grid.classList.toggle('pinv-craft-3', st.craft.size === 3);
  const g = document.createElement('div'); g.className = 'pinv-craft-grid';
  for (let i = 0; i < st.craft.size * st.craft.size; i++) g.appendChild(slotEl({ k: 'k', i: i }));
  const arrow = document.createElement('div'); arrow.className = 'pinv-f-arrow pinv-craft-arrow'; arrow.textContent = '➡️';
  const o = slotEl({ k: 'o', i: 0 }); o.classList.add('pinv-craft-out');
  grid.appendChild(g); grid.appendChild(arrow); grid.appendChild(o);
  const lbl = $('pinv-craft-label'); if (lbl) lbl.textContent = tr('pinv_crafting', 'Crafting');
 }
 // se toma lo que sale: clic = al cursor (o se suma a lo que ya llevas si es igual); Shift + clic = todo lo que se pueda, a la mochila
 function takeCraft(ev) {
  const o = craftOut(); if (!o) return;
  const it = readItem(o, false); if (!it) return;
  if (ev.shiftKey) {
   for (let n = 0; n < 64; n++) {
    const cur = craftOut(); if (!cur || normKey(readItem(cur, false)) !== normKey(it)) break;
    const w = ensure(); const snap = JSON.stringify(w.inventoryList);
    const left = insertRange(readItem(cur, false), 0, TOTAL - 1);
    if (left > 0) { w.inventoryList = JSON.parse(snap); break; }      // ya no cabe: se deja como estaba (no se gasta nada)
    window.mbwCraft.consume(st.craft.grid);
    crafted(it);
   }
   renderAll();
   return;
  }
  const held = fromHeld(heldItem);
  if (held) {
   if (!same(held, it) || held.qty + it.qty > maxStack(it)) return;
   heldItem.count = held.qty + it.qty;
  } else {
   heldItem = toHeld(it);
   heldItem.from = null;
  }
  window.mbwCraft.consume(st.craft.grid);
  crafted(it);
  refreshCursor();
  renderAll();
 }
 function crafted(it) { if (window.mbwPlay && typeof window.mbwPlay.onCrafted === 'function') { try { window.mbwPlay.onCrafted(it.id, it.qty); } catch (e) { /* nada */ } } }
 // al cerrar: lo que quedó en la cuadrícula vuelve al inventario (lo que no cabe cae al suelo)
 function returnCraft() {
  if (!st.craft) return;
  const g = st.craft.grid;
  st.craft = null;
  g.forEach((it) => {
   if (!it || it.missing) return;
   const left = insertRange(it, 0, TOTAL - 1);
   if (left > 0 && window.mbwPlay && typeof window.mbwPlay.dropItem === 'function') window.mbwPlay.dropItem(it.id, left, it.dmg || 0, it.extras || {});
  });
 }
 // Columna de la izquierda (solo en el horno): los objetos que sirven de combustible. Clic = tomar una pila en el cursor.
 function renderFuelPalette() {
  const box = $('pinv-fuel-box'), grid = $('pinv-fuel-grid');
  const show = !!st.furnace && !window.mbwPlaying;                 // ▶ en Modo Jugar no hay combustible gratis: se usa el del inventario
  if (box) box.style.display = show ? '' : 'none';
  document.body.classList.toggle('pinv-no-fuel', !!st.furnace && !show);
  if (!grid) return;
  grid.innerHTML = '';
  if (!show) return;
  FUEL_IDS.forEach((id) => {
   const it = { id: id, qty: 1, dmg: 0, extras: {}, legacy: undefined };
   const d = document.createElement('div');
   d.className = 'pinv-slot pinv-fuel-slot';
   const c = document.createElement('canvas');
   c.width = 48; c.height = 48;
   paintId(c, id, undefined, 48);
   d.appendChild(c);
   decorate(d, it, true);
   d.onclick = d.oncontextmenu = (e) => {
    e.preventDefault();
    if (heldItem) { heldItem = null; refreshCursor(); renderAll(); return; }           // con algo en el cursor: se suelta (descarta)
    const h = toHeld(copy(it, maxStack(it)));
    delete h.src;                                                                         // viene del "catálogo": no sale de ningún espacio
    heldItem = h;
    refreshCursor();
   };
   grid.appendChild(d);
  });
 }
 function renderAll() { renderRibbon(); renderPanel(); }

 function flash(addr) {
  let d = null;
  if (addr.k === 'a') { const root = $('pinv-armor'); d = root && root.children[addr.i]; }
  else if (addr.k === 'f') { const root = $('pinv-furnace'); d = root && root.querySelectorAll('.pinv-slot')[addr.i]; }
  if (!d) return;
  d.classList.remove('pinv-flash');
  void d.offsetWidth;
  d.classList.add('pinv-flash');
  d.title = tr('pinv_wrong_slot', "That item doesn't go in this slot");
 }

 // ------------------------------------------------------------------ mover objetos
 function accepts(addr, it) {
  if (addr.k === 'f' && addr.i === 1) return isFuel(it.id);                    // el espacio de combustible solo acepta combustibles
  return addr.k !== 'a' || PARTS[addr.i].suffix === String(it.id).slice(-PARTS[addr.i].suffix.length);
 }

 // Mete un objeto en un rango de espacios (primero completa pilas iguales, luego usa espacios vacíos). Devuelve lo que no cupo.
 function insertRange(it, from, to, kind) {
  const k = kind || 'i';
  let left = it.qty;
  const max = maxStack(it);
  for (let i = from; i <= to && left > 0; i++) {
   const cur = getSlot({ k: k, i: i });
   if (cur && same(cur, it) && cur.qty < max) {
    const m = Math.min(left, max - cur.qty);
    setSlot({ k: k, i: i }, copy(cur, cur.qty + m));
    left -= m;
   }
  }
  for (let i = from; i <= to && left > 0; i++) {
   if (!getSlot({ k: k, i: i })) {
    const m = Math.min(left, max);
    setSlot({ k: k, i: i }, copy(it, m));
    left -= m;
   }
  }
  return left;
 }

 // Shift + clic (solo espacios del inventario): la hotbar manda a la mochila y la mochila a la hotbar;
 // una pieza de armadura de la mochila se pone sola si su espacio está libre.
 function quickMove(addr, it) {
  if (addr.k === 'k') {                                              // 🛠 de la cuadrícula de crafteo al inventario
   setSlot(addr, null);
   const left = insertRange(it, 0, TOTAL - 1);
   if (left > 0) setSlot(addr, copy(it, left));
   return;
  }
  if (st.craft && st.craft.table) {                                  // 🛠 mesa de crafteo: del inventario a la cuadrícula
   setSlot(addr, null);
   const left = insertRange(it, 0, st.craft.size * st.craft.size - 1, 'k');
   if (left > 0) setSlot(addr, copy(it, left));
   return;
  }
  if (st.furnace) {                                                 // modo horno: del horno al jugador; del jugador al combustible (si arde) o a la entrada
   const toF = addr.k !== 'f';
   setSlot(addr, null);
   let left;
   if (toF) {
    const dst = isFuel(it.id) ? 1 : 0;
    const cur = getSlot({ k: 'f', i: dst });
    if (!cur) { setSlot({ k: 'f', i: dst }, copy(it, Math.min(it.qty, maxStack(it)))); left = it.qty - Math.min(it.qty, maxStack(it)); }
    else if (same(cur, it) && cur.qty < maxStack(it)) { const m = Math.min(it.qty, maxStack(it) - cur.qty); setSlot({ k: 'f', i: dst }, copy(cur, cur.qty + m)); left = it.qty - m; }
    else left = it.qty;
   } else left = insertRange(it, 0, TOTAL - 1, 'i');
   if (left > 0) setSlot(addr, copy(it, left));
   return;
  }
  if (st.chest) {                                                   // modo cofre: del cofre al jugador y del jugador al cofre
   const toChest = addr.k !== 'c';
   setSlot(addr, null);
   const left = toChest ? insertRange(it, 0, boxSlots() - 1, 'c') : insertRange(it, 0, TOTAL - 1, 'i');
   if (left > 0) setSlot(addr, copy(it, left));
   return;
  }
  const pi = PARTS.findIndex((p) => String(it.id).slice(-p.suffix.length) === p.suffix);
  if (pi >= 0 && !getSlot({ k: 'a', i: pi })) {
   setSlot({ k: 'a', i: pi }, copy(it, 1));
   setSlot(addr, it.qty > 1 ? copy(it, it.qty - 1) : null);
   return;
  }
  setSlot(addr, null);                                              // se quita primero para no apilarse consigo mismo
  const left = addr.i < HOTBAR ? insertRange(it, HOTBAR, TOTAL - 1) : insertRange(it, 0, HOTBAR - 1);
  if (left > 0) setSlot(addr, copy(it, left));                       // lo que no cupo se queda donde estaba
 }

 // Mini menú de armaduras (el mismo de Equipment en el Mob Browser, con las piezas de esa parte del cuerpo).
 // Clic izquierdo = elegir pieza; clic derecho = recoger la puesta; Shift + clic = mandarla a la mochila.
 function openArmorMenu(addr, ev, cur) {
  const menu = window.mobArmorMenu;
  if (!menu || typeof menu.toggle !== 'function') return false;
  const part = PARTS[addr.i];
  const anchor = (ev && ev.currentTarget) || null;
  if (!anchor) return false;
  const label = tr(part.key, part.fallback);
  const current = cur ? { id: cur.id, st: null, nbt: cur.extras } : null;
  menu.toggle(anchor, label, part.suffix, current, function (it) {
   const old = getSlot(addr);
   const ex = isObj(it.nbt) ? clone(it.nbt) : {};
   if (old && old.id === it.id && stable(old.extras) === stable(ex)) { renderAll(); return; }
   setSlot(addr, { id: it.id, qty: 1, dmg: 0, extras: ex, legacy: undefined });
   renderAll();
  }, cur ? function () { setSlot(addr, null); renderAll(); } : null);
  return true;
 }

 // ---- Editor de durabilidad (Ctrl + clic en una herramienta o armadura)
 let durPop = null;
 function closeDurPop() {
  if (!durPop) return;
  document.removeEventListener('mousedown', durOutside, true);
  document.removeEventListener('keydown', durKey, true);
  durPop.remove();
  durPop = null;
 }
 function durOutside(e) { if (durPop && !durPop.contains(e.target)) closeDurPop(); }
 function durKey(e) { if (e.key === 'Escape') { e.stopImmediatePropagation(); closeDurPop(); } }
 function openDurEditor(addr, anchor) {
  const it0 = getSlot(addr);
  const max = it0 ? maxDurability(it0.id) : 0;
  if (!it0 || !max) return false;
  closeDurPop();
  const pop = document.createElement('div');
  pop.id = 'pinv-dur-pop';
  pop.className = 'pinv-dur-pop';
  const title = document.createElement('div');
  title.className = 'pinv-dur-title';
  title.textContent = prettyName(it0);
  const lab = document.createElement('div');
  lab.className = 'pinv-dur-label';
  lab.textContent = tr('pinv_dur_remaining', 'Durability left') + ' (1 – ' + max + ')';
  const row = document.createElement('div');
  row.className = 'pinv-dur-row';
  const range = document.createElement('input');
  range.type = 'range'; range.min = 1; range.max = max; range.id = 'pinv-dur-range';
  const numIn = document.createElement('input');
  numIn.type = 'number'; numIn.min = 1; numIn.max = max; numIn.id = 'pinv-dur-num';
  row.appendChild(range); row.appendChild(numIn);
  const btns = document.createElement('div');
  btns.className = 'pinv-dur-btns';
  const mk = (id, key, fb) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = tr(key, fb); btns.appendChild(b); return b; };
  const bFull = mk('pinv-dur-full', 'pinv_dur_full', 'Repair (full)');
  const bLow = mk('pinv-dur-low', 'pinv_dur_low', 'Almost broken');
  const bOk = mk('pinv-dur-ok', 'pinv_dur_ok', 'Close');
  pop.appendChild(title); pop.appendChild(lab); pop.appendChild(row); pop.appendChild(btns);
  document.body.appendChild(pop);
  durPop = pop;
  const cur0 = Math.max(1, Math.min(max, max - (it0.dmg || 0)));
  range.value = cur0; numIn.value = cur0;
  // aplica un valor: durabilidad que queda -> desgaste guardado (dmg = máximo - lo que queda)
  const apply = (left, from) => {
   left = Math.max(1, Math.min(max, Math.round(Number(left)) || 1));
   if (from !== 'range') range.value = left;
   if (from !== 'num') numIn.value = left;
   const it = getSlot(addr);
   if (!it || it.id !== it0.id) { closeDurPop(); return; }
   const nd = max - left;
   if ((it.dmg || 0) === nd) return;
   setSlot(addr, { id: it.id, qty: it.qty, dmg: nd, extras: it.extras, legacy: it.legacy });
   renderAll();
  };
  range.oninput = () => apply(range.value, 'range');
  numIn.onchange = () => apply(numIn.value, 'num');
  numIn.onkeydown = (e) => { if (e.key === 'Enter') { apply(numIn.value, 'num'); closeDurPop(); } };
  bFull.onclick = () => apply(max);
  bLow.onclick = () => apply(1);
  bOk.onclick = () => { apply(numIn.value, 'num'); closeDurPop(); };
  // posición: al lado de la casilla, sin salirse de la pantalla
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 200, top: 200, right: 264, bottom: 264 };
  const pw = pop.offsetWidth || 240, ph = pop.offsetHeight || 140;
  let x = r.right + 8, y = r.top;
  if (x + pw > window.innerWidth - 8) x = Math.max(8, r.left - pw - 8);
  if (y + ph > window.innerHeight - 8) y = Math.max(8, window.innerHeight - ph - 8);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
  setTimeout(() => { if (durPop === pop) { document.addEventListener('mousedown', durOutside, true); document.addEventListener('keydown', durKey, true); } }, 0);
  return true;
 }

 // ------------------------------------------------------------------ 🖱 arrastrar para repartir (como en Minecraft)
 // Con un objeto en el cursor: mantener el clic IZQUIERDO y pasar por varias casillas = se reparte en partes iguales;
 // mantener el clic DERECHO = 1 en cada casilla. En el celular: mantener el dedo y deslizarlo = partes iguales.
 // Sirve en la cuadrícula de crafteo, el inventario y los cofres.
 let drag = null, eatUntil = 0, ctxFired = false;
 const DRAG_KINDS = { k: 1, i: 1, c: 1 };
 function dragEat(e) { if (performance.now() < eatUntil) { e.preventDefault(); e.stopPropagation(); return true; } return false; }
 function slotAt(x, y) { const el = document.elementFromPoint(x, y); const s = el && el.closest ? el.closest('.pinv-slot') : null; return s && s.__addr ? s : null; }
 function dragStart(addr, el, e) {
  if (!heldItem || !DRAG_KINDS[addr.k] || !st.open) return;
  const held = fromHeld(heldItem); if (!held) return;
  ctxFired = false;
  drag = { btn: e.pointerType === 'touch' ? 0 : e.button, touch: e.pointerType === 'touch', slots: [addr], els: [el], id: e.pointerId };
  el.classList.add('pinv-drag');
  window.addEventListener('pointermove', dragMove, true);
  window.addEventListener('pointerup', dragEnd, true);
  window.addEventListener('pointercancel', dragCancel, true);
 }
 function dragMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const s = slotAt(e.clientX, e.clientY); if (!s) return;
  const a = s.__addr;
  if (!DRAG_KINDS[a.k] || drag.slots.some((q) => q.k === a.k && q.i === a.i)) return;
  const held = fromHeld(heldItem), cur = getSlot(a);
  if (!held || (cur && (!same(cur, held) || cur.qty >= maxStack(held)))) return;       // (otra cosa o ya está llena)
  if (drag.btn === 2 ? drag.slots.length >= held.qty : drag.slots.length >= held.qty) return;   // (ya no alcanza para más casillas)
  drag.slots.push(a); drag.els.push(s); s.classList.add('pinv-drag');
  if (drag.touch) e.preventDefault();
 }
 function dragOff() {
  window.removeEventListener('pointermove', dragMove, true);
  window.removeEventListener('pointerup', dragEnd, true);
  window.removeEventListener('pointercancel', dragCancel, true);
  if (drag) drag.els.forEach((el) => el.classList.remove('pinv-drag'));
 }
 function dragCancel() { dragOff(); drag = null; }
 function dragEnd(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; dragOff(); drag = null;
  if (d.slots.length < 2) return;                                     // una sola casilla: es un clic normal
  const held = fromHeld(heldItem); if (!held) return;
  let left = held.qty;
  const one = d.btn === 2;
  const firstDone = one && ctxFired;                                  // (en Linux / Mac el clic derecho ya puso 1 en la primera)
  const list = firstDone ? d.slots.slice(1) : d.slots;
  if (firstDone) { /* la primera ya tiene la suya */ }
  const per = one ? 1 : Math.max(1, Math.floor(left / list.length));
  list.forEach((a) => {
   if (left <= 0) return;
   const cur = getSlot(a), room = cur ? maxStack(held) - cur.qty : maxStack(held);
   const n = Math.min(per, left, room); if (n <= 0) return;
   setSlot(a, cur ? copy(cur, cur.qty + n) : copy(held, n));
   left -= n;
  });
  if (left > 0) heldItem.count = left; else heldItem = null;
  eatUntil = performance.now() + 350;                                 // (el clic que viene al soltar no cuenta)
  refreshCursor();
  renderAll();
 }
 window.playerInvDragTest = function (addrs, button) {              // (lo usan las pruebas: reparte como si se arrastrara)
  if (!heldItem) return false;
  drag = { btn: button || 0, touch: false, slots: addrs.slice(), els: [], id: -7 }; ctxFired = false;
  dragEnd({ pointerId: -7 });
  return true;
 };

 // ------------------------------------------------------------------ 📖 recetario (celular, mesa de crafteo, supervivencia)
 // Una lista de lo que se puede fabricar, con buscador. Al tocar uno, se buscan los materiales en el inventario y se ponen
 // en la mesa; si falta alguno, se pone igual pero en rojo y no se puede crear (como el libro de recetas de Minecraft).
 const BOOK_TYPES = { relative: 1, absolute: 1, contains: 1, 'large box': 1 };
 function bookOn() {
  return !!(st.open && st.craft && st.craft.table && window.mbwPlaying && document.body.classList.contains('is-touch') && document.body.classList.contains('play-survival'));
 }
 // cómo va cada receta en la cuadrícula: [{ i: casilla, ty, ty2, damage, type, extra }] o null si no cabe
 function recipeCells(rc, size) {
  if (rc.t === 'large box') { if (size < 3) return null; const out = []; for (let i = 0; i < 9; i++) out.push({ i: i, ty: rc.i }); return out; }
  if (rc.t === 'contains') {
   if (rc.i.length > size * size) return null;
   return rc.i.map((q, k) => typeof q === 'string' ? { i: k, ty: q } : { i: k, ty: q.ty, extra: q.extra, exact: q.exactExtras == 1 });
  }
  let mx = 0, my = 0;
  if (rc.t === 'relative') { mx = Math.min.apply(null, rc.i.map((q) => q.x)); my = Math.min.apply(null, rc.i.map((q) => q.y)); }
  const out = [];
  for (let k = 0; k < rc.i.length; k++) {
   const q = rc.i[k], x = q.x - mx, y = q.y - my;
   if (x < 0 || y < 0 || x >= size || y >= size) return null;
   out.push({ i: y * size + x, ty: q.ty, ty2: q.ty2, damage: q.damage, type: q.type });
  }
  return out;
 }
 function fitsCell(it, c) {
  if (!it || it.missing) return false;
  const okExtra = (o) => !c.extra || Object.keys(c.extra).every((k) => (o.extras || {})[k] == c.extra[k]);
  const okOne = (id, dmg, type) => it.id === id && (dmg == null || (it.dmg || 0) == dmg) && (type == null || (it.extras || {}).type == type);
  return (okOne(c.ty, c.damage, c.type) || (c.ty2 != null && okOne(c.ty2, null, null))) && okExtra(it);
 }
 function bookList() {
  const R = window.MB_RECIPES || [], seen = {}, out = [];
  R.forEach((rc, n) => {
   if (!BOOK_TYPES[rc.t] || !recipeCells(rc, 3)) return;
   const o = rc.o, k = o[0] + '|' + JSON.stringify(o[3] || {});
   if (seen[k]) return; seen[k] = 1;
   out.push({ n: n, id: o[0], qty: o[1], extras: o[3] || {} });
  });
  return out;
 }
 // ¿tengo todo para esta receta? (cuenta lo del inventario y lo que ya está en la mesa)
 function haveFor(rc) {
  const cells = recipeCells(rc, st.craft ? st.craft.size : 3); if (!cells) return false;
  const pool = [];
  for (let i = 0; i < TOTAL; i++) { const it = getSlot({ k: 'i', i: i }); if (it) pool.push(copy(it, it.qty)); }
  (st.craft ? st.craft.grid : []).forEach((it) => { if (it && !it.missing) pool.push(copy(it, it.qty)); });
  for (let k = 0; k < cells.length; k++) { const p = pool.find((it) => it.qty > 0 && fitsCell(it, cells[k])); if (!p) return false; p.qty--; }
  return true;
 }
 window.playerInvBookFill = function (n) {                           // pone la receta n en la mesa (lo usa el recetario)
  const rc = (window.MB_RECIPES || [])[n]; if (!rc || !st.craft) return false;
  const cells = recipeCells(rc, st.craft.size); if (!cells) return false;
  if (heldItem) { giveBackCursor(); heldItem = null; refreshCursor(); }
  // lo que había en la mesa vuelve al inventario
  const g = st.craft.grid;
  for (let i = 0; i < g.length; i++) { const it = g[i]; g[i] = null; if (it && !it.missing) { const left = insertRange(it, 0, TOTAL - 1); if (left > 0 && window.mbwPlay && window.mbwPlay.dropItem) window.mbwPlay.dropItem(it.id, left, it.dmg || 0, it.extras || {}); } }
  let missing = 0;
  cells.forEach((c) => {
   let got = null;
   for (let i = 0; i < TOTAL && !got; i++) {
    const a = { k: 'i', i: i }, it = getSlot(a);
    if (fitsCell(it, c)) { got = copy(it, 1); setSlot(a, it.qty > 1 ? copy(it, it.qty - 1) : null); }
   }
   if (got) g[c.i] = got;
   else { g[c.i] = { id: c.ty, qty: 1, dmg: c.damage || 0, extras: c.type != null ? { type: c.type } : clone(c.extra || {}), missing: true }; missing++; }
  });
  renderAll();
  return missing === 0;
 };
 function renderBook() {
  const box = $('pinv-book');
  const on = bookOn();
  document.body.classList.toggle('pinv-book-open', on);
  if (!box) return;
  box.style.display = on ? '' : 'none';
  if (!on) return;
  const inp = box.querySelector('.pinv-book-q'), grid = box.querySelector('.pinv-book-grid');
  box.querySelector('.pinv-book-t').textContent = '📖 ' + tr('pinv_book', 'Recipes');
  inp.placeholder = tr('pinv_book_search', 'Search items...');
  const q = (inp.value || '').trim().toLowerCase();
  grid.innerHTML = '';
  const R = window.MB_RECIPES || [];
  const list = bookList().map((r) => ({ r: r, ok: haveFor(R[r.n]), name: prettyName({ id: r.id, qty: 1, dmg: 0, extras: r.extras }) }))
   .filter((x) => !q || x.name.toLowerCase().indexOf(q) >= 0 || x.r.id.toLowerCase().indexOf(q) >= 0)
   .sort((a, b) => (b.ok - a.ok));
  list.forEach((x) => {
   const d = document.createElement('div');
   d.className = 'pinv-slot pinv-book-it' + (x.ok ? '' : ' pinv-book-no');
   const c = document.createElement('canvas'); c.width = c.height = 48;
   paintId(c, x.r.id, undefined, 48, x.r.extras, 0); d.appendChild(c);
   if (x.r.qty > 1) { const k = document.createElement('span'); k.className = 'pinv-count'; k.textContent = x.r.qty; d.appendChild(k); }
   d.title = x.name;
   d.onclick = () => window.playerInvBookFill(x.r.n);
   grid.appendChild(d);
  });
  if (!list.length) { const e = document.createElement('div'); e.className = 'pinv-book-empty'; e.textContent = tr('pinv_book_none', 'Nothing found'); grid.appendChild(e); }
 }
 function bookSetup() {
  let box = $('pinv-book');
  if (box) return box;
  const cols = document.querySelector('#inventory-modal .inv-main-columns'); if (!cols) return null;
  box = document.createElement('div'); box.id = 'pinv-book'; box.className = 'pinv-book'; box.style.display = 'none';
  box.innerHTML = '<div class="pinv-label pinv-book-t"></div><input type="text" class="pinv-book-q" autocomplete="off" spellcheck="false"><div class="pinv-book-grid"></div>';
  cols.insertBefore(box, cols.firstChild);
  const inp = box.querySelector('.pinv-book-q');
  ['keydown', 'keyup', 'keypress'].forEach((n) => inp.addEventListener(n, (e) => e.stopPropagation()));   // (las teclas no mueven al jugador)
  inp.addEventListener('input', () => renderBook());
  return box;
 }

 // ------------------------------------------------------------------ 🧍 la skin del jugador con su armadura (▶ Modo Jugar)
 function renderSkin() {
  const top = document.querySelector('#inventory-modal .pinv-top'); if (!top) return;
  let c = $('pinv-skin');
  const on = !!(window.mbwPlaying && st.open && !st.chest && !st.furnace && !(st.craft && st.craft.table));
  if (!on) { if (c) c.style.display = 'none'; return; }
  if (!c) { c = document.createElement('canvas'); c.id = 'pinv-skin'; c.className = 'pinv-skin'; c.width = 160; c.height = 220; }
  const armorBox = $('pinv-armor'); const after = armorBox && armorBox.parentNode;
  if (after && after.parentNode === top && after.nextSibling !== c) top.insertBefore(c, after.nextSibling);
  c.style.display = '';
  const ok = window.mbwPlay && typeof window.mbwPlay.drawPreview === 'function' && window.mbwPlay.drawPreview(c);
  if (!ok) setTimeout(() => { if (st.open) renderSkin(); }, 400);     // (la skin todavía se está bajando)
 }

 function onSlot(addr, ev, right) {
  if (!ensure()) return;
  if (addr.k === 'o') { takeCraft(ev); return; }
  const cur = getSlot(addr);
  const held = fromHeld(heldItem);
  const armor = addr.k === 'a';

  // Ctrl + clic en una herramienta o armadura: editor de durabilidad
  if ((ev.ctrlKey || ev.metaKey) && !right && !held && cur && maxDurability(cur.id) && openDurEditor(addr, ev.currentTarget || ev.target)) return;

  // clic en una casilla de armadura: mini menú de piezas (armadura gratis). ▶ En Modo Jugar solo en creativo: si no, la armadura se pone
  // arrastrándola desde el inventario, como en el juego
  const freeArmor = !window.mbwPlaying || document.body.classList.contains('play-survival') === false;
  if (!held && armor && !right && !ev.shiftKey && freeArmor && openArmorMenu(addr, ev, cur)) return;

  if (cur && cur.missing) { setSlot(addr, null); renderAll(); return; }   // 📖 un material que falta (rojo): se quita
  if (!held) {                                                         // cursor vacío: recoger
   if (!cur) return;
   if (ev.shiftKey && !right) {
    if (armor) {                                                       // la armadura puesta pasa a la mochila
     setSlot(addr, null);
     const left = insertRange(cur, HOTBAR, TOTAL - 1);
     if (left > 0) setSlot(addr, copy(cur, left));
    } else quickMove(addr, cur);
    renderAll();
    return;
   }
   const take = (right && cur.qty > 1) ? Math.ceil(cur.qty / 2) : cur.qty;
   setSlot(addr, take < cur.qty ? copy(cur, cur.qty - take) : null);
   heldItem = toHeld(copy(cur, take));
   heldItem.from = { k: addr.k, i: addr.i };                         // de dónde salió (al cerrar la ventana vuelve ahí si sigue libre)
   refreshCursor();
   renderAll();
   return;
  }

  // cursor con objeto: soltar
  if ((armor || addr.k === 'f') && !accepts(addr, held)) { flash(addr); return; }
  const fromCreative = heldItem.src !== 'inv';
  const max = armor ? 1 : maxStack(held);
  let n = right ? 1 : held.qty;
  if (armor) n = 1;
  else if (fromCreative) n = Math.min(n, max);
  let rest = held.qty;

  if (!cur) {
   setSlot(addr, copy(held, n));
   rest = held.qty - n;
  } else if (same(cur, held)) {
   const room = max - cur.qty;
   if (armor || room <= 0) return;
   const m = Math.min(n, room);
   setSlot(addr, copy(cur, cur.qty + m));
   rest = held.qty - m;
  } else if (!right) {                                                 // objetos distintos: se intercambian
   if (armor && held.qty > 1) { flash(addr); return; }
   setSlot(addr, copy(held, armor ? 1 : n));
   heldItem = toHeld(cur);
   refreshCursor();
   renderAll();
   return;
  } else return;

  if (rest > 0) heldItem.count = rest; else heldItem = null;
  refreshCursor();
  renderAll();
 }

 function select(i) {
  const w = ensure();
  if (!w) return;
  w.selectedInventoryItem = Math.max(0, Math.min(HOTBAR - 1, i));
  renderAll();
 }

 // ------------------------------------------------------------------ ventana
 // La ventana es #inventory-modal. Tres formas de abrirla (inventario normal, cofre, objeto custom) y esta; las otras
 // llaman a playerInvReset() para dejar la ventana como siempre.
 function layout() {
  const m = $('inventory-modal');
  if (!m) return;
  const content = m.querySelector('.modal-content');
  const left = m.querySelector('.inv-left-col');
  const wrap = m.querySelector('.inv-grid-wrapper');
  if (content) { content.style.width = 'max-content'; content.style.height = 'auto'; }
  if (left) left.style.display = st.expanded ? '' : 'none';
  if (wrap) { wrap.style.height = 'auto'; wrap.style.flex = '1 1 0'; wrap.style.minHeight = '0'; }
  ['chest-builder-panel', 'custom-item-builder-panel'].forEach((id) => { const e = $(id); if (e) e.style.display = 'none'; });
  const hb = $('modal-hotbar-container');                          // la hotbar del editor no pinta nada aquí
  if (hb) hb.style.display = 'none';
  document.body.classList.toggle('pinv-furnace-open', !!st.furnace);
  document.body.classList.toggle('pinv-chest-open', !!st.chest);
  document.body.classList.add('pinv-open');
  const panel = $('player-inv-panel');
  if (panel) panel.style.display = 'block';
  const top = m.querySelector('.pinv-top');                       // armadura + papelera: no se muestran al editar un cofre
  if (top) top.style.display = (st.chest || st.furnace || (st.craft && st.craft.table)) ? 'none' : '';
  // ▶ Modo Jugar: se ve como el inventario del juego (blanco, letra de píxeles); la armadura en columna, la skin y a la derecha
  // el crafteo 2×2; sin papelera (en el juego no hay)
  const game = !!window.mbwPlaying;
  m.classList.toggle('pinv-game', game);
  const cbox = $('pinv-craft-box'), ppanel = $('player-inv-panel'), trashEl = $('pinv-trash');
  if (cbox && top && ppanel) {
   if (game && st.craft && !st.craft.table) { if (cbox.parentNode !== top) top.appendChild(cbox); }
   else if (cbox.parentNode !== ppanel) ppanel.insertBefore(cbox, top);
  }
  if (trashEl && trashEl.parentNode) trashEl.parentNode.style.display = game ? 'none' : '';
  document.body.classList.toggle('pinv-craft-open', !!st.craft);
  const search = $('inventory-search');
  if (search) search.style.display = st.expanded ? '' : 'none';
  const btn = $('pinv-creative-btn');
  if (btn) { btn.style.display = ''; btn.textContent = tr(st.expanded ? 'pinv_hide_creative' : 'pinv_show_creative'); }
  const title = $('inventory-modal-title');
  if (title && st.furnace) title.innerText = tr('pinv_furnace_title', 'Furnace') + '  (X: ' + st.furnace.x + ', Y: ' + st.furnace.y + ')';
  else if (title && st.craft && st.craft.table) title.innerText = tr('pinv_craft_table', 'Crafting Table');
  else if (title) title.innerText = st.chest ? (boxTitle() + '  (X: ' + st.chest.x + ', Y: ' + st.chest.y + ')') : tr('pinv_title', 'Player Inventory');
  const lbl = $('pinv-chest-label');
  if (lbl) { lbl.textContent = !st.chest || st.chest.kind !== 'disp' ? tr('pinv_chest_label', 'Chest contents') : st.chest.type === 'dropper' ? tr('pinv_dropper_label', 'Dropper contents') : tr('pinv_dispenser_label', 'Dispenser contents'); lbl.title = tr('pinv_chest_delete_hint', 'Tip: press Delete to discard the item on the cursor'); }
 }
 // el título: "Chest" / "Dispenser" / "Dropper" (o el nombre que le pusieron al dispenser / dropper, como en el juego)
 function boxTitle() {
  if (!st.chest || st.chest.kind !== 'disp') return tr('pinv_chest_title', 'Chest');
  let nm = '';
  try { nm = mbwom.states && typeof mbwom.states[st.chest.key + '_3'] === 'string' ? mbwom.states[st.chest.key + '_3'] : ''; } catch (e) { nm = ''; }
  return nm || (st.chest.type === 'dropper' ? tr('pinv_dropper_title', 'Dropper') : tr('pinv_dispenser_title', 'Dispenser'));
 }
 function resetLayout() {
  const m = $('inventory-modal');
  if (!m) return;
  const content = m.querySelector('.modal-content');
  const left = m.querySelector('.inv-left-col');
  const wrap = m.querySelector('.inv-grid-wrapper');
  if (content) content.style.height = '';
  if (left) left.style.display = '';
  if (wrap) { wrap.style.height = ''; wrap.style.flex = ''; wrap.style.minHeight = ''; }
  document.body.classList.remove('pinv-furnace-open', 'pinv-chest-open', 'pinv-open', 'pinv-craft-open', 'pinv-book-open');
  m.classList.remove('pinv-game');
  const bk = $('pinv-book'); if (bk) { bk.style.display = 'none'; const q = bk.querySelector('.pinv-book-q'); if (q) q.value = ''; }
  const ccb = $('pinv-craft-box'); if (ccb) ccb.style.display = 'none';
  const panel = $('player-inv-panel');
  if (panel) panel.style.display = 'none';
  const search = $('inventory-search');
  if (search) search.style.display = '';
  const btn = $('pinv-creative-btn');
  if (btn) btn.style.display = 'none';
  const cb = $('pinv-chest-box');
  if (cb) cb.style.display = 'none';
  ['pinv-furnace-box', 'pinv-fuel-box'].forEach((id) => { const e = $(id); if (e) e.style.display = 'none'; });
  const top = m.querySelector('.pinv-top');
  if (top) top.style.display = '';
 }

 // Al cerrar la ventana: un objeto que se había sacado del inventario y quedó en el cursor vuelve a la mochila (no se pierde).
 function giveBackCursor() {
  if (heldItem && heldItem.src === 'inv' && ensure()) {
   const it = fromHeld(heldItem);
   if (it) {
    let left = it.qty;
    if (st.furnace) {
     const f = heldItem.from;
     if (f && f.k === 'f' && !getSlot(f) && accepts(f, it)) { setSlot(f, it); heldItem = null; return; }
     left = insertRange(it, 0, TOTAL - 1, 'i');
    } else if (st.chest) {                                       // lo que se sacó del cofre vuelve primero al cofre
     const f = heldItem.from;
     if (f && f.k === 'c' && !getSlot(f)) { setSlot(f, it); heldItem = null; return; }   // a su casilla de origen, si sigue vacía
     const back = insertRange(it, 0, boxSlots() - 1, 'c');
     left = back;
     if (back > 0) left = insertRange(copy(it, back), 0, TOTAL - 1, 'i');
    } else {
     left = insertRange(it, 0, TOTAL - 1);
    }
    if (left > 0) { /* no cabe en ningún lado: se descarta */ }
   }
  }
  heldItem = null;
 }
 // Al cerrar la ventana de un cofre: si cambió algo, queda UN paso en el historial y se avisa a los demás jugadores.
 function commitChest() {
  const c = st.chest;
  st.chest = null;
  if (!c || typeof mbwom === 'undefined' || !mbwom.scene) return;
  let after = null;
  try { after = mbwom.getBlockState(c.x, c.y); } catch (e) { after = null; }
  if (!after || !(c.kind === 'disp' ? after.states2 : after.chests)) return;
  if (JSON.stringify(c.before) === JSON.stringify(after)) return;                 // no cambió nada
  if (typeof historyManager !== 'undefined') {
   historyManager.startAction();
   historyManager.recordChange(c.x, c.y, c.before, after);
   historyManager.commitAction();
  }
  if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'actualizar_bloque', x: c.x, y: c.y, estado: after });
  if (typeof worldDirty !== 'undefined') worldDirty = true;
 }
 // Al cerrar la ventana de un horno: igual que el cofre, un paso en el historial y aviso a los demás.
 function commitFurnace() {
  const c = st.furnace;
  st.furnace = null;
  if (!c || typeof mbwom === 'undefined' || !mbwom.scene) return;
  const d = mbwom.toSmelt;
  const f = isObj(d) ? d[c.key] : null;
  if (isObj(f) && !c.before.toSmelt) {                                           // el horno no tenía datos y siguen vacíos: no se deja nada creado
   if (F_KEYS.every((k) => !readItem(f[k], false))) { delete d[c.key]; return; }
  }
  let after = null;
  try { after = mbwom.getBlockState(c.x, c.y); } catch (e) { after = null; }
  if (!after || !after.toSmelt) return;
  if (JSON.stringify(c.before) === JSON.stringify(after)) return;
  if (typeof historyManager !== 'undefined') {
   historyManager.startAction();
   historyManager.recordChange(c.x, c.y, c.before, after);
   historyManager.commitAction();
  }
  if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: 'actualizar_bloque', x: c.x, y: c.y, estado: after });
  if (typeof worldDirty !== 'undefined') worldDirty = true;
 }
 function closed() {
  if (!st.open) return;
  closeArmorMenu();
  closeDurPop();
  st.open = false;
  st.expanded = false;
  giveBackCursor();
  returnCraft();
  commitChest();
  commitFurnace();
  resetLayout();
  refreshCursor();
  renderRibbon();
 }

 window.playerInvClosed = closed;       // la llama toggleInventory() al cerrar
 window.playerInvReset = function () {  // la llaman el inventario normal, el creador de cofres y el de objetos al abrirse
  if (st.open) closed(); else resetLayout();
 };
 window.playerInvRefresh = renderAll;   // mundo nuevo / pestaña de mundo / pestaña Player
 window.playerInvOnLanguageChanged = function () {
  renderRibbon();
  if (st.open) { layout(); renderPanel(); }
 };

 window.togglePlayerInventory = function () {
  const m = $('inventory-modal');
  if (!m || typeof toggleInventory !== 'function') return;
  if (m.style.display === 'block') {
   const wasMine = st.open;
   toggleInventory();                   // cierra lo que esté abierto (si era el del jugador, llama a playerInvClosed)
   if (wasMine) return;
  }
  if (!world()) { alert(tr('pinv_no_world', 'Open or create a world first')); return; }
  st.chest = null;
  st.furnace = null;
  st.craft = window.mbwPlaying ? { size: 2, grid: [null, null, null, null], table: null } : null;   // ▶ Modo Jugar: crafteo 2×2
  st.open = true;
  st.expanded = false;
  heldItem = null;
  refreshCursor();
  m.style.display = 'block';
  layout();
  renderAll();
 };

 // Abre el editor del cofre que hay en (x, y) de la dimensión actual. Devuelve true si lo abrió.
 window.openChestEditor = function (x, y) {
  const m = $('inventory-modal');
  if (!m || typeof toggleInventory !== 'function') return false;
  if (typeof mbwom === 'undefined' || !mbwom || !mbwom.scene) return false;
  x = Math.floor(Number(x)); y = Math.floor(Number(y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let bs = null;
  try { bs = mbwom.getBlockState(x, y); } catch (e) { bs = null; }
  if (!bs || bs.type !== 'chest') return false;
  if (!world()) return false;
  if (m.style.display === 'block') toggleInventory();            // cierra lo que esté abierto (guarda lo del cofre anterior si lo había)
  st.furnace = null; st.craft = null;
  st.chest = { x: x, y: y, key: 'blockX' + x + 'Y' + y, before: null };
  chestList();                                                    // completa los 27 espacios si faltaban
  st.chest.before = JSON.parse(JSON.stringify(mbwom.getBlockState(x, y)));
  st.open = true;
  st.expanded = false;
  heldItem = null;
  refreshCursor();
  m.style.display = 'block';
  layout();
  renderAll();
  return true;
 };
 // Abre el editor del horno (bloque "oven") que hay en (x, y). A la izquierda salen los combustibles para tomar.
 window.openFurnaceEditor = function (x, y) {
  const m = $('inventory-modal');
  if (!m || typeof toggleInventory !== 'function') return false;
  if (typeof mbwom === 'undefined' || !mbwom || !mbwom.scene) return false;
  x = Math.floor(Number(x)); y = Math.floor(Number(y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let bs = null;
  try { bs = mbwom.getBlockState(x, y); } catch (e) { bs = null; }
  if (!bs || bs.type !== 'oven') return false;
  if (!world()) return false;
  if (m.style.display === 'block') toggleInventory();
  st.chest = null; st.craft = null;
  st.furnace = { x: x, y: y, key: 'blockX' + x + 'Y' + y, before: null };
  st.furnace.before = JSON.parse(JSON.stringify(mbwom.getBlockState(x, y)));
  furnaceData(true);                                              // completa los 3 espacios si faltaban (si queda vacío no se guarda)
  st.open = true;
  st.expanded = false;
  heldItem = null;
  refreshCursor();
  m.style.display = 'block';
  layout();
  renderAll();
  return true;
 };
 // Abre el dispenser o el dropper que hay en (x, y): 9 espacios (3×3), como en el juego. Devuelve true si lo abrió.
 window.openDispenserEditor = function (x, y) {
  const m = $('inventory-modal');
  if (!m || typeof toggleInventory !== 'function') return false;
  if (typeof mbwom === 'undefined' || !mbwom || !mbwom.scene) return false;
  x = Math.floor(Number(x)); y = Math.floor(Number(y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let bs = null;
  try { bs = mbwom.getBlockState(x, y); } catch (e) { bs = null; }
  if (!bs || (bs.type !== 'dispense' && bs.type !== 'dropper')) return false;
  if (!world()) return false;
  if (m.style.display === 'block') toggleInventory();
  st.furnace = null; st.craft = null;
  st.chest = { x: x, y: y, key: 'blockX' + x + 'Y' + y, before: null, kind: 'disp', type: bs.type };
  st.chest.before = JSON.parse(JSON.stringify(mbwom.getBlockState(x, y)));
  chestList();                                                    // completa los 9 espacios si faltaban
  st.open = true;
  st.expanded = false;
  heldItem = null;
  refreshCursor();
  m.style.display = 'block';
  layout();
  renderAll();
  return true;
 };
 // 🛠 Abre la mesa de crafteo que hay en (x, y): cuadrícula de 3×3 (▶ Modo Jugar). Devuelve true si la abrió.
 window.openCraftingTable = function (x, y) {
  const m = $('inventory-modal');
  if (!m || typeof toggleInventory !== 'function' || !world()) return false;
  if (m.style.display === 'block') toggleInventory();
  st.chest = null; st.furnace = null;
  st.craft = { size: 3, grid: [null, null, null, null, null, null, null, null, null], table: { x: Math.floor(x), y: Math.floor(y) } };
  st.open = true;
  st.expanded = false;
  heldItem = null;
  refreshCursor();
  m.style.display = 'block';
  layout();
  renderAll();
  return true;
 };
 window.playerInvCraft = function () { return st.craft ? { size: st.craft.size, grid: st.craft.grid.map((it) => it ? [it.id, it.qty] : null), out: craftOut(), table: !!st.craft.table } : null; };   // (lo usan las pruebas)
 window.playerInvChestOpen = function () { return !!st.chest; };
 // ▶ Modo Jugar: el horno avanzó (se fundió algo / se gastó combustible) → se vuelve a pintar si está abierto
 window.playerInvFurnaceTick = function () { if (st.open && st.furnace) renderAll(); };

 window.playerInvToggleCreative = function () {
  if (!st.open) return;
  st.expanded = !st.expanded;
  layout();
  if (st.expanded) {
   const s = $('inventory-search');
   if (s) s.value = '';
   if (typeof renderInventoryTabs === 'function') renderInventoryTabs();
   if (typeof populateInventory === 'function') populateInventory();
   const hb = $('modal-hotbar-container');
   if (hb) hb.style.display = 'none';
  }
 };

 // Si la ventana se cierra de otra forma (clic fuera, etc.) también se limpia.
 function watchModal() {
  const m = $('inventory-modal');
  if (!m || typeof MutationObserver === 'undefined') return;
  new MutationObserver(function () { if (st.open && m.style.display !== 'block') closed(); }).observe(m, { attributes: true, attributeFilter: ['style'] });
 }

 // Con la ventana abierta, las teclas 1-9 eligen el espacio de la hotbar del jugador (y no el de la hotbar del editor).
 window.addEventListener('keydown', function (e) {
  if (!st.open) return;
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if ((st.chest || st.furnace) && (e.code === 'Delete' || e.code === 'Backspace') && typeof heldItem !== 'undefined' && heldItem) {   // sin papelera: Supr tira lo que llevas en el cursor
   e.preventDefault();
   heldItem = null;
   refreshCursor();
   return;
  }
  const m = /^Digit([1-9])$/.exec(e.code || '');
  if (!m) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  select(Number(m[1]) - 1);
 }, true);

 function init() { watchModal(); renderRibbon(); }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
