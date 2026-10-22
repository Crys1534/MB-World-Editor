// ==========================================
// 📋 PORTAPAPELES (copiar, cortar, pegar y espejo)
// ==========================================
// Antes esto estaba repartido: la parte de bloques dentro de scripts/tools.js
// y la parte de mobs dentro del manejo de teclas de scripts/input.js, y este
// archivo contenía una versión vieja y sin uso (por eso estaba "muerto").
// Ahora el portapapeles vive aquí, completo y en un solo lugar:
//
//   - window.clipboard ........ lo último que se copió de bloques
//                               { width, height, data: [{dx, dy, state}] }
//   - copySelection() ......... Ctrl+C con una selección (rect / lazo / varita)
//   - cutSelection() .......... Ctrl+X
//   - activatePasteMode() ..... Ctrl+V: activa la herramienta "paste"
//   - performPaste() .......... pega de verdad (también lo usa la red en multijugador)
//   - flipClipboardHorizontal()  botón "Mirror" (espejo izquierda <-> derecha; también cambia la variante de antorchas, escaleras, losas, dispenser y dropper)
//   - variantFamilyFor(tipo)  dice a qué "familia" de variantes pertenece un bloque (la usan Mirror aquí y Rotate en scripts/tools.js)
//   - copyMobToClipboard() / pasteMobFromClipboard() ... lo mismo, pero para un mob
//
// Quienes lo usan: scripts/input.js (atajos de teclado), scripts/tools.js
// (la herramienta "paste" llama a performPaste), main.js (dibuja el "fantasma"
// de lo que se va a pegar), scripts/structures.js (cargar una estructura al
// portapapeles) y scripts/multiplayer.js (pegado remoto).
//
// OJO: no declares aquí `const clipboard`: el resto del código lo lee como
// window.clipboard, y una constante con ese nombre lo taparía.

window.clipboard = null;   // bloques copiados (null = vacío)
let mobClipboard = null;   // mob copiado (null = vacío)

// ------------------------------------------
// Bloques
// ------------------------------------------
function copySelection(keepSelection = false) {
    const bounds = getSelectionBounds();
    if (!bounds) { alert("Select an area."); return; }
    
    if (window.selection.type === 'poly' && window.selection.path.length < 3) { alert("Invalid area."); return; }

    const data = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            
            if (!isPointSelected(x, y)) continue;

            const state = mbwom.getBlockState(x, y);
            let stateToSave = null;
            if (state && state.type != null) stateToSave = structuredClone(state);
            data.push({ dx: x - bounds.minX, dy: y - bounds.minY, state: stateToSave });
        }
    }
    
    window.clipboard = { width: bounds.maxX - bounds.minX + 1, height: bounds.maxY - bounds.minY + 1, data: data };

    // LAZO: además de los bloques, se guardan los MOBS que quedan dentro (dx / dy = posición respecto a la esquina de la selección)
    if (window.selection.type === 'poly' && typeof mbwom !== 'undefined' && mbwom.mobs) {
        const mobs = [];
        for (const key in mbwom.mobs) {
            const m = mbwom.mobs[key];
            if (!m) continue;
            if (isPointSelected(Math.round(Number(m.x)), Math.round(-Number(m.y)))) {
                mobs.push({ dx: Number(m.x) - bounds.minX, dy: -Number(m.y) - bounds.minY, mob: JSON.parse(JSON.stringify(m)) });
            }
        }
        if (mobs.length) window.clipboard.mobs = mobs;
    }
    
    if (!keepSelection) {
        window.selection.p1 = null; 
        window.selection.p2 = null; 
        window.selection.path = []; 
        window.selection.subRects = [];
        
        const overlay = document.getElementById('selection-overlay');
        if (overlay) overlay.style.display = 'none';
        checkSelectionState(); 
    }
    
    console.log("Copied.");
}

function cutSelection() {
    copySelection(true);
    // Con el LAZO, cortar quita los bloques Y los mobs de dentro (todo en un solo paso de Ctrl+Z); con Select / Varita, solo bloques
    deleteSelection(false, [], [], true);
}

function activatePasteMode() {
    if (!window.clipboard) { alert("Clipboard empty."); return; }
    selectTool('paste');
}

function performPaste(targetX, targetY, replaceAir = false, isFromNetwork = false, networkClipboard = null) {
    // Si viene de la red, usamos la estructura que mandó el amigo, sino, usamos nuestro portapapeles
    const currentClipboard = isFromNetwork ? networkClipboard : window.clipboard;
    if (!currentClipboard) return;
    historyManager.startAction();

    // ✨ PEGAMOS LA ESTRUCTURA: Solo iteramos sobre los puntos exactos que fueron copiados (la forma azul)
    currentClipboard.data.forEach(blockData => {
        // Si NO está presionado Shift (!replaceAir), ignoramos el aire (Pegado Transparente)
        // Si SÍ está presionado Shift (replaceAir), sobrescribimos el destino, pero SOLO en los puntos de la selección azul
        if (!replaceAir && (!blockData.state || blockData.state.type === "air" || blockData.state.type === "0" || blockData.state.type === 0)) return;

        const absX = targetX + blockData.dx; 
        const absY = targetY + blockData.dy;
        const oldState = mbwom.getBlockState(absX, absY);
        
        // Si en el destino ya hay aire y lo que pegamos también es aire, no hacemos nada para ahorrar memoria
        if (!oldState && !blockData.state) return;
        
        historyManager.recordChange(absX, absY, oldState, blockData.state);
        
        // Colocamos el bloque, o lo borramos si el punto azul copiado era aire
        if (blockData.state) {
            mbwom.setBlockState(absX, absY, blockData.state);
        } else {
            if (mbwom.scene[absX]) delete mbwom.scene[absX][absY]; 
        }
        
        if (typeof renderBlock === 'function') renderBlock(absX, absY);
    });
    
    // Mobs guardados con el Lazo: se crean copias nuevas (con historial). Desde la red NO se crean aquí: el amigo manda cada mob con accion_spawn_mob.
    if (!isFromNetwork && currentClipboard.mobs && currentClipboard.mobs.length && typeof mbwom !== 'undefined') {
        if (!mbwom.mobs) {
            mbwom.mobs = {};
            if (mbwom.world && mbwom.currentScene) mbwom.world["mobs" + mbwom.currentScene] = mbwom.mobs;
        }
        currentClipboard.mobs.forEach(function (entry, i) {
            const newId = "mob_paste_" + Date.now() + "_" + i + Math.floor(Math.random() * 1000);
            const newMob = JSON.parse(JSON.stringify(entry.mob));
            newMob.id = newId;
            newMob.x = targetX + entry.dx;
            newMob.y = -(targetY + entry.dy);
            historyManager.recordMobChange(newId, null, newMob);
            mbwom.mobs[newId] = newMob;
            if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: "accion_spawn_mob", id: newId, mob: newMob });
        });
    }

    // ✨ MULTIPLAYER: Mandamos la estructura entera al amigo (sin los mobs: esos van aparte)
    if (!isFromNetwork && typeof enviarMensajeEnRed === 'function') {
        enviarMensajeEnRed({ 
            tipo: "accion_pegar", 
            x: targetX, 
            y: targetY, 
            replaceAir: replaceAir, 
            clipboard: { width: currentClipboard.width, height: currentClipboard.height, data: currentClipboard.data } 
        });
    }
    
    if (typeof worldDirty !== 'undefined') worldDirty = true;
    historyManager.commitAction();
}

// ------------------------------------------
// Espejo (botón "Mirror") del portapapeles
// ------------------------------------------
// Algunos bloques se guardan como "tipo + número de variante" (states1) y ese número dice hacia dónde miran.
// Un ejemplo es la antorcha (th): 1 = parada (recta), 2 = inclinada hacia un lado (en una pared), 3 = inclinada hacia el otro lado (las
// versiones 2 y 3 son el mismo dibujo volteado). Al voltear una estructura, la POSICIÓN de cada bloque cambia, y estos bloques
// además tienen que cambiar a su versión "espejo"; si no, una escalera que miraba a la derecha seguiría mirando a la derecha.
// Cada regla dice "variante actual -> variante después de voltear". Se comprobó con las imágenes de assets/blocks.png:
// los dibujos de cada par son uno el espejo del otro (y en un mundo real aparecen todos estos números).
// Ronda 9: se quitó el botón de espejo vertical (ahora para girar un bloque se usa Rotate, con el Lápiz), así que solo queda el horizontal.
const FLIP_WALL   = { h: { 2: 3, 3: 2 } };                                          // antorchas, palanca, botón, linterna
const FLIP_STAIR  = { h: { 1: 2, 2: 1, 3: 4, 4: 3 } };                              // escaleras: 1-2 normales, 3-4 de cabeza
const FLIP_SLAB   = {};                                                             // losas: 1 = abajo, 2 = arriba (no cambian con el espejo horizontal)
const FLIP_FACING = { h: { 1: 2, 2: 1 } };                                          // dispenser y dropper: 1 izquierda, 2 derecha, 3 arriba, 4 abajo
window.FLIP_VARIANT_RULES = { wall: FLIP_WALL, stair: FLIP_STAIR, slab: FLIP_SLAB, facing: FLIP_FACING };

// "Familia" de variantes de un bloque: 'wall' (antorchas, palanca, botón, linterna), 'facing' (dispenser y dropper),
// 'stair' (todas las escaleras), 'slab' (todas las losas) o null si el bloque no tiene variantes que girar.
function variantFamilyFor(type) {
    if (typeof type !== 'string') return null;
    if (type === 'th' || type === 'ortorch' || type === 'rstorch' || type === 'lever' || type === 'button' || type === 'lant') return 'wall';
    if (type === 'dispense' || type === 'dropper') return 'facing';
    // Todas las escaleras (stairr, staircs...) y losas (halfr, halfcs...): solo las que de verdad existen en el editor
    const known = (window.texturesMap && window.texturesMap[type + '_1']) ? true : false;
    if (known && /^stair[a-z]+$/.test(type)) return 'stair';
    if (known && /^half[a-z]+$/.test(type)) return 'slab';
    return null;
}
window.variantFamilyFor = variantFamilyFor;

function flipRulesFor(type) {
    const family = variantFamilyFor(type);
    return family ? window.FLIP_VARIANT_RULES[family] : null;
}

// Cambia states1 de un bloque a su versión espejo (axis: 'h'). Devuelve true si cambió algo.
function flipBlockVariant(state, axis) {
    if (!state) return false;
    const rules = flipRulesFor(state.type);
    const map = rules && rules[axis];
    if (!map) return false;
    const cur = Number(state.states1);
    if (state.states1 === '' || state.states1 == null || !Object.prototype.hasOwnProperty.call(map, cur)) return false;
    // Solo si el dibujo de destino existe (si no, la antorcha se vería como "missing")
    const tex = window.texturesMap;
    const to = map[cur];
    if (tex && !(tex[state.type + '_' + to] || tex[state.type])) return false;
    state.states1 = (typeof state.states1 === 'string') ? String(to) : to;
    return true;
}
window.flipBlockVariant = flipBlockVariant;

function flipClipboard(axis) {
    if (!window.clipboard || !window.clipboard.data) {
        console.log("No hay nada en el portapapeles para voltear.");
        return;
    }
    const width = window.clipboard.width, height = window.clipboard.height;

    window.clipboard.data.forEach(block => {
        // La nueva posición es (tamaño total - 1) menos su posición actual
        if (axis === 'h') block.dx = (width - 1) - block.dx;
        else block.dy = (height - 1) - block.dy;
        // Y los bloques que miran hacia algún lado pasan a su versión espejo
        if (block.state) flipBlockVariant(block.state, axis);
    });
    // Los mobs guardados (Lazo) también se espejean
    if (window.clipboard.mobs) window.clipboard.mobs.forEach(e => {
        if (axis === 'h') e.dx = width - e.dx; else e.dy = height - e.dy;
    });

    // Forzamos al cursor a redibujar el fantasma al instante
    if (typeof mouse !== 'undefined') mouse.calculateCoordinates();
    if (typeof worldDirty !== 'undefined') worldDirty = true;
}

// ✨ Espejo Horizontal (botón "Mirror")
window.flipClipboardHorizontal = function() { flipClipboard('h'); };

// ------------------------------------------
// Mobs (herramienta "move": Ctrl+C / Ctrl+V sobre una criatura)
// ------------------------------------------
function copyMobToClipboard(mob) {
    if (!mob) return;
    mobClipboard = JSON.parse(JSON.stringify(mob));
    console.log("Mob copiado nativamente:", mobClipboard.type);
}

function hasMobInClipboard() {
    return !!mobClipboard;
}

// Pega una copia del mob copiado en la posición del mouse (con historial para deshacer)
function pasteMobFromClipboard() {
    if (!mobClipboard) return;
    if (typeof mbwom === 'undefined') return;
    if (!mbwom.mobs) {
        mbwom.mobs = {};
        if (mbwom.world && mbwom.currentScene) {
            mbwom.world["mobs" + mbwom.currentScene] = mbwom.mobs;
        }
    }
    let newId = "mob_copy_" + Date.now() + Math.floor(Math.random() * 1000);

    let newMob = JSON.parse(JSON.stringify(mobClipboard));
    newMob.x = mouse.worldX;
    newMob.y = -mouse.worldY;
    newMob.id = newId;
    if (typeof window.mbwFixMob === 'function') window.mbwFixMob(newMob);   // un creeper sin "fuse" explota al instante en el juego real

    // ✨ ADD HISTORY: Pegar Mob
    historyManager.startAction();
    historyManager.recordMobChange(newId, null, newMob);
    historyManager.commitAction();

    mbwom.mobs[newId] = newMob;
    if (typeof worldDirty !== 'undefined') worldDirty = true;
}
