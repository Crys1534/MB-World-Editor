// ✨ VARIABLES GLOBALES PARA MOBS ✨
let selectedMob = null;
let selectedMobKey = null;
// (mobClipboard — el mob copiado — se declara en scripts/clipboard.js)
let draggedMob = null;
let isDraggingMob = false;
let dragOffset = { x: 0, y: 0 };

const keys = {
    KeyW: false, KeyA: false, KeyS: false, KeyD: false,
    KeyC: false, Tab: false, KeyQ: false, KeyE: false,
    KeyZ: false, KeyX: false, KeyV: false 
};

const mouse = {
    canvasX: null, canvasY: null, gridX: null, gridY: null,
    alignedX: null, alignedY: null, worldX: null, worldY: null,
    right: false, left: false,
    calculateCoordinates: function () {
        // ✨ FIX: Si las variables maestras aún no cargan, no hacemos matemáticas
        if (typeof tileSize === 'undefined' || typeof camera === 'undefined') return;
        
        // Desplazamiento fluido: la cámara puede estar entre dos cuadros y se mueve aunque el mouse esté quieto,
        // así que el cuadro bajo el mouse se calcula con la posición exacta del mouse (no con gridX / gridY).
        if (window.smoothScroll && this.canvasX !== null && this.canvasY !== null) {
            this.worldX = Math.floor(camera.x + this.canvasX / tileSize);
            this.worldY = Math.floor(camera.y + this.canvasY / tileSize);
            this.gridX = this.worldX - Math.floor(camera.x);
            this.gridY = this.worldY - Math.floor(camera.y);
            this.alignedX = (this.worldX - camera.x) * tileSize;
            this.alignedY = canvas.height - (this.worldY - camera.y) * tileSize;
            return;
        }
        this.alignedX = this.gridX * tileSize;
        this.alignedY = canvas.height - this.gridY * tileSize;
        this.worldX = Math.floor(camera.x) + this.gridX;
        this.worldY = Math.floor(camera.y) + this.gridY;
    }
}

// Cámara fluida: cuánto tarda en acelerar al apretar una tecla y en frenar al soltarla (milisegundos)
const CAMERA_START_MS = 25;
const CAMERA_STOP_MS = 60;

// Cuántos "cuadros de 60 FPS" vale cada cuadro que se dibuja (1 si no hay límite; 2 si el límite es de 30 FPS)
function frameScale() {
    const lim = window.fpsLimit | 0;
    return lim > 0 && lim < 60 ? 60 / lim : 1;
}

function cameraMovement() {
    // ✨ MODO ESPECTADOR: la cámara sigue la CÁMARA del jugador que se está viendo (scripts/mp-live.js), no su cursor.
    // Mientras tanto el teclado no mueve la cámara.
    if (window.spectatingTargetId && typeof window.mpSpectateStep === 'function' && window.mpSpectateStep(frameScale())) return;
    
    if (typeof camera.accX === 'undefined') { camera.accX = 0; camera.accY = 0; }
    let moveX = 0; let moveY = 0;

    // Sin desplazamiento fluido la cámara avanza "por cuadro dibujado" (pensado para 60 FPS): con un límite de 30 FPS
    // cada cuadro dibuja el doble de lejos, para que la velocidad real sea la misma.
    const step = camera.speed * frameScale();
    if (keys.KeyW) moveY += step;
    if (keys.KeyS) moveY -= step;
    if (keys.KeyD) moveX += step;
    if (keys.KeyA) moveX -= step;

    // Desplazamiento fluido: la cámara avanza en decimales (no en cuadros enteros) y según el TIEMPO que pasó,
    // así va igual de rápido a 60 que a 144 fotogramas por segundo. La velocidad es la misma de siempre
    // (camera.speed cuadros por fotograma a 60 fps).
    if (window.smoothScroll) {
        const now = performance.now();
        const dt = camera.lastMoveTime ? Math.min(now - camera.lastMoveTime, 50) : (1000 / 60);
        camera.lastMoveTime = now;
        const f = dt / (1000 / 60);

        // La cámara NO frena de golpe: tiene una velocidad (camera.velX / velY) que sube rápido hacia la velocidad
        // de las teclas (CAMERA_START_MS) y, al soltar las teclas, baja poco a poco hasta cero (CAMERA_STOP_MS).
        // Es la misma curva a 60 que a 144 fps, porque depende del TIEMPO (dt) y no del número de fotogramas.
        // La posición "de verdad" (_tx / _ty) lleva todos los decimales: main.js la ajusta al píxel para dibujar
        // (snapSmoothCamera), y sin esta copia los últimos movimientos, más chicos que un píxel, se perderían.
        if (camera.velX === undefined) { camera.velX = 0; camera.velY = 0; }
        if (camera._tx === undefined || Math.abs(camera.x - camera._tx) * tileSize > 0.51 || Math.abs(camera.y - camera._ty) * tileSize > 0.51) {
            camera._tx = camera.x; camera._ty = camera.y;   // alguien movió la cámara (teletransporte, zoom, otra pestaña...): se parte de ahí
            camera.velX = 0; camera.velY = 0;               // y no sigue deslizando con la velocidad de antes (sería un salto raro tras teletransportarse)
        }
        const ease = function (vel, target) {
            const tau = target === 0 ? CAMERA_STOP_MS : CAMERA_START_MS;
            let v = vel + (target - vel) * (1 - Math.exp(-dt / tau));
            if (target === 0 && Math.abs(v) < camera.speed * 0.02) v = 0;   // ya casi parada: se detiene del todo
            return v;
        };
        const vx = ease(camera.velX, moveX), vy = ease(camera.velY, moveY);
        if (vx !== 0 || vy !== 0 || camera.velX !== 0 || camera.velY !== 0) {
            camera._tx += (camera.velX + vx) / 2 * f;
            camera._ty += (camera.velY + vy) / 2 * f;
            camera.x = camera._tx;
            camera.y = camera._ty;
        }
        camera.velX = vx; camera.velY = vy;
        return;
    }

    camera.accX += moveX;
    camera.accY += moveY;

    if (Math.abs(camera.accX) >= 1) {
        let stepX = Math.trunc(camera.accX);
        camera.x += stepX;
        camera.accX -= stepX;
    }
    if (Math.abs(camera.accY) >= 1) {
        let stepY = Math.trunc(camera.accY);
        camera.y += stepY;
        camera.accY -= stepY;
    }
}

function teleportSwitch() {
    if (!tpToggle) {
        lastPosition[0].x = camera.x;
        lastPosition[0].y = camera.y;
        if (!firstTime) {
            camera.x = lastPosition[1].x;
            camera.y = lastPosition[1].y;
        }
        tpToggle = true;
    } else {
        lastPosition[1].x = camera.x;
        lastPosition[1].y = camera.y;
        camera.x = lastPosition[0].x;
        camera.y = lastPosition[0].y;
        tpToggle = false;
        firstTime = false;
    }
}

let tpToggle = false;
let firstTime = true;
let lastPosition = [{}, {}];

// --- TECLADO ---
// ¿La tecla que se acaba de presionar es la que está asignada a esta acción en Settings > Controls?
// (Si no hay nada guardado, se usa la tecla de fábrica `fallbackKey`.) Ctrl tiene que coincidir con lo que dice el atajo.
function keybindMatches(event, action, fallbackKey) {
    const kb = window.userKeybinds && window.userKeybinds[action];
    const key = (kb && kb.key) ? String(kb.key).toLowerCase() : fallbackKey;
    const wantCtrl = !!(kb && kb.ctrl);
    const isCtrl = !!(event.ctrlKey || event.metaKey);
    return typeof event.key === 'string' && event.key.toLowerCase() === key && wantCtrl === isCtrl;
}

window.addEventListener("keydown", function (event) {
    // Mientras la ventana "My Profile" obligatoria está abierta (usuario "Player"), el editor no responde al teclado
    if (window.profileLocked) return;
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        if (event.code === 'KeyE' && document.activeElement.id === 'inventory-search') {
            event.preventDefault();
            try { toggleInventory(); } catch(e) { }
        }
        return; 
    }

    if (keys.hasOwnProperty(event.code)) keys[event.code] = true;

    if (event.code === 'Tab') {
        // Tab es el teletransporte de la cámara; si la persona le puso Tab al Modo Zen (Settings > Controls), manda el Zen
        if (!keybindMatches(event, 'zen', 'h')) teleportSwitch();
        event.preventDefault();
    }

    if (event.code === 'Delete' || event.code === 'Backspace') {
        if (typeof currentTool !== 'undefined' && currentTool === 'move' && selectedMobKey && typeof mbwom !== 'undefined' && mbwom.mobs && mbwom.mobs[selectedMobKey]) {
            
    // ✨ ADD HISTORY: Borrar Mob
            historyManager.startAction();
            historyManager.recordMobChange(selectedMobKey, mbwom.mobs[selectedMobKey], null);
            historyManager.commitAction();
            
            // ==========================================
            // ✨ MULTIPLAYER C: Avisar que borramos el Mob
            // ==========================================
            if (typeof enviarMensajeEnRed === 'function') {
                enviarMensajeEnRed({ tipo: "accion_eliminar_mob", id: selectedMobKey });
            }
            
            delete mbwom.mobs[selectedMobKey];
            selectedMob = null;
            selectedMobKey = null;
            if (typeof toggleMobInfo === 'function') toggleMobInfo(false);
            if (typeof worldDirty !== 'undefined') worldDirty = true;
            event.preventDefault();
        }
    }

    const isCtrl = event.ctrlKey || event.metaKey;

    if (isCtrl && event.code === 'KeyZ') { event.preventDefault(); historyManager.undo(); }
    if (isCtrl && event.code === 'KeyY') { event.preventDefault(); historyManager.redo(); }
    
    // ✨ COPIAR CLON O ESTRUCTURA (Ctrl + C)
    if (isCtrl && event.code === 'KeyC') { 
        if (typeof currentTool !== 'undefined' && currentTool === 'move' && selectedMob) {
            event.preventDefault(); // Bloqueamos el navegador solo si vamos a copiar un Mob
            copyMobToClipboard(selectedMob);   // scripts/clipboard.js
        } else if (typeof currentTool !== 'undefined' && (currentTool === 'select' || currentTool === 'lasso' || currentTool === 'magic')) {
            event.preventDefault(); // Bloqueamos el navegador solo si estamos usando herramientas de selección
            if (typeof copySelection === 'function') copySelection(); 
        }
        // Si no se cumple nada de arriba, el navegador hará su copia de texto normal sin interrupciones.
    }

    // ✨ CORTAR (Ctrl + X)
    if (isCtrl && event.code === 'KeyX') { 
        if (typeof currentTool !== 'undefined' && (currentTool === 'select' || currentTool === 'lasso' || currentTool === 'magic')) {
            event.preventDefault(); 
            if (typeof cutSelection === 'function') cutSelection(); 
        }
    }
    
    // ✨ PEGAR CLON O ESTRUCTURA (Ctrl + V)
    if (isCtrl && event.code === 'KeyV') { 
        if (typeof currentTool !== 'undefined' && currentTool === 'move' && hasMobInClipboard()) {
            event.preventDefault(); 
            pasteMobFromClipboard();   // scripts/clipboard.js
        } else if (typeof currentTool !== 'undefined' && (currentTool === 'select' || currentTool === 'lasso' || currentTool === 'magic')) {
            event.preventDefault(); 
            if (typeof activatePasteMode === 'function') activatePasteMode(); 
        }
    }

    if (event.code === 'KeyZ' && !isCtrl) { if (typeof setSelectionPoint === 'function') setSelectionPoint(1, mouse.worldX, mouse.worldY); }
    if (event.code === 'KeyX' && !isCtrl) { if (typeof setSelectionPoint === 'function') setSelectionPoint(2, mouse.worldX, mouse.worldY); }
    if (event.code === 'KeyC' && !isCtrl) { if (typeof eyedropper === 'function') eyedropper(mouse.worldX, mouse.worldY); }
    // Atajos que se pueden cambiar en Settings > Controls (de fábrica: E = Inventory, Y = Structures Browser, M = Mobs Browser, R = Rotate)
    if (keybindMatches(event, 'inventory', 'e')) { event.preventDefault(); try { toggleInventory(); } catch(e) { } }
    if (keybindMatches(event, 'structures', 'y')) { event.preventDefault(); try { openStructuresModal(); } catch(e) { } }
    if (keybindMatches(event, 'mobs', 'm')) { event.preventDefault(); try { openMobModal(); } catch(e) { } }
    // R: gira el bloque de la barra rápida (el mismo trabajo que el botón Rotate); si el bloque no se puede girar, no pasa nada
    if (keybindMatches(event, 'rotate', 'r')) { event.preventDefault(); try { rotateHeldBlock(); } catch(e) { } }
    // H (de fábrica): Modo Zen. Si se deja la tecla apretada no parpadea (solo cuenta la primera vez)
    if (keybindMatches(event, 'zen', 'h')) { event.preventDefault(); if (!event.repeat) { try { toggleZenMode(); } catch(e) { } } }

    if (event.code.startsWith('Digit')) {
        let num = parseInt(event.code.charAt(5));
        if (!isNaN(num) && num > 0 && num <= 9) { // (Le puse límite a 9 por seguridad)
            slotIndex = num - 1;
            
            // Al elegir una casilla de la hotbar con un número (1-9) siempre se vuelve al lápiz, venga de la herramienta que venga
            // (así también se suelta una estructura que estuviera flotando). Con Ctrl/Alt/Cmd no se toca nada: son atajos del navegador.
            if (!event.ctrlKey && !event.metaKey && !event.altKey && typeof currentTool !== 'undefined' && currentTool !== 'pencil') {
                if (typeof selectTool === 'function') selectTool('pencil');
            }
            
            if (typeof updateHotbarSelection === 'function') updateHotbarSelection();
        }
    }
});

window.addEventListener("keyup", function (event) {
    if (keys.hasOwnProperty(event.code)) keys[event.code] = false;
});

// --- Ctrl mantenido = Move Tool (mientras se mantenga) ---
// Con el Pencil (o colocando mobs / vehículos), mantener Ctrl cambia a la herramienta Move;
// al soltar Ctrl se regresa a la herramienta de antes. Así se puede colocar un mob y moverlo
// o seleccionarlo enseguida, sin ir a la barra de herramientas.
// Si se suelta Ctrl a mitad de un arrastre, se espera a soltar el clic para regresar.
(function () {
    const FROM = ['pencil', 'spawn_mob', 'spawn_vehicle'];
    let from = null, waitMouse = false;
    function typing() {
        const a = document.activeElement;
        if (!a) return false;
        const tag = a.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!a.isContentEditable;
    }
    function restore() {
        waitMouse = false;
        if (!from) return;
        const back = from;
        from = null;
        if (typeof currentTool === 'undefined' || currentTool !== 'move') return;   // la persona eligió otra herramienta mientras tanto
        if (typeof selectTool === 'function') selectTool(back); else currentTool = back;
    }
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'Control' && e.key !== 'Meta') return;
        if (e.repeat || from || window.profileLocked || typing()) return;
        if (typeof currentTool === 'undefined' || FROM.indexOf(currentTool) < 0) return;
        if (typeof mouse !== 'undefined' && mouse.left) return;   // a mitad de un trazo con el lápiz: no se cambia
        if (typeof snipState !== 'undefined' && snipState && snipState.active) return;
        from = currentTool;
        if (typeof selectTool === 'function') selectTool('move'); else currentTool = 'move';
    });
    window.addEventListener('keyup', function (e) {
        if (e.key !== 'Control' && e.key !== 'Meta') return;
        if (!from) return;
        if (typeof mouse !== 'undefined' && mouse.left) { waitMouse = true; return; }
        restore();
    });
    window.addEventListener('mouseup', function () {
        if (waitMouse) setTimeout(restore, 0);   // después de que el editor termine de soltar lo que se arrastraba
    });
    window.addEventListener('blur', restore);
    window.mbwCtrlMoveState = function () { return { from: from, waitMouse: waitMouse }; };
})();

// --- MOUSE MOVE ---
canvas.addEventListener("mousemove", (event) => {
    // ✨ FIX: Salimos inmediatamente si main.js no ha terminado de cargar
    if (typeof tileSize === 'undefined') return;
    
    mouse.canvasX = event.offsetX;
    mouse.canvasY = canvas.height - event.offsetY;
    mouse.gridX = Math.floor(mouse.canvasX / tileSize);
    mouse.gridY = Math.floor(mouse.canvasY / tileSize);
    mouse.calculateCoordinates(); 

    // ✨ FIX FASE 5: Usamos la función optimizada de red (Throttling)
    if (typeof window.sendNetworkCursorOptimized === 'function') {
        window.sendNetworkCursorOptimized(mouse.worldX, mouse.worldY);
    }
    
    // (A partir de aquí sigue lo de arrastrar mobs, etc.)
    if (typeof currentTool !== 'undefined' && currentTool === 'move' && isDraggingMob && draggedMob) {
        let exactWorldX = camera.x + (mouse.canvasX / tileSize);
        let exactWorldY = camera.y + (mouse.canvasY / tileSize);
        
        draggedMob.x = exactWorldX + dragOffset.x;
        draggedMob.y = -(exactWorldY + dragOffset.y); 
        if (typeof worldDirty !== 'undefined') worldDirty = true;

        // ==========================================
        // ✨ MULTIPLAYER D: Sincronización de Mob en Vivo
        // ==========================================
        if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
            if (!window.lastMobSend) window.lastMobSend = 0;
            // Enviamos la posición del mob máximo 20 veces por segundo (cada 50ms)
            if (Date.now() - window.lastMobSend > 50) { 
                let miNombre = localStorage.getItem('mbw_username') || "Player";
                // Usamos enviarMensajeEnRed (tu función centralizada)
                if (typeof enviarMensajeEnRed === 'function' && selectedMobKey) {
                    enviarMensajeEnRed({ 
                        tipo: "accion_mover_mob_live", 
                        id: selectedMobKey, 
                        x: draggedMob.x, 
                        y: draggedMob.y,
                        autor: miNombre
                    });
                }
                window.lastMobSend = Date.now();
            }
        }
    }

    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('move', mouse.worldX, mouse.worldY);
    }
    
    updateChestTooltip(event.offsetX, event.offsetY);
});

// --- DIBUJANTE DE TOOLTIPS (COFRES) ---
const maxDurabilityMap = {
    "WoodenPickaxe": 60, "StonePickaxe": 132, "IronPickaxe": 251, "GoldPickaxe": 33, "DiamondPickaxe": 1562, "ObsidianPickaxe": 2500,
    "WoodenSword": 60, "StoneSword": 132, "IronSword": 251, "GoldSword": 33, "DiamondSword": 1562,
    "WoodenAxe": 60, "StoneAxe": 132, "IronAxe": 251, "GoldAxe": 33, "DiamondAxe": 1562,
    "WoodenShovel": 60, "StoneShovel": 132, "IronShovel": 251, "GoldShovel": 33, "DiamondShovel": 1562,
    "WoodenHoe": 60, "StoneHoe": 132, "IronHoe": 251, "GoldHoe": 33, "DiamondHoe": 1562
};

function renderChestOrOvenUI(blockState, gridContainer) {
    gridContainer.innerHTML = ''; 
    if (!blockState) return false;

    if (blockState.type === 'chest' && blockState.chests && Array.isArray(blockState.chests)) {
        gridContainer.style.display = 'grid'; 
        gridContainer.style.gridTemplateColumns = 'repeat(9, 24px)';
        gridContainer.style.gap = '0px';
        gridContainer.style.padding = '0px';
        gridContainer.style.alignItems = 'start';

        const inventory = blockState.chests;
        
        for (let i = 0; i < inventory.length; i++) {
            let slot = document.createElement('div');
            slot.className = 'chest-tooltip-slot';
            slot.style.width = '24px'; slot.style.height = '24px';
            slot.style.background = '#8B8B8B'; slot.style.border = '1px inset #FFF';
            slot.style.display = 'flex'; slot.style.justifyContent = 'center';
            slot.style.alignItems = 'center'; slot.style.position = 'relative';
            slot.style.boxSizing = 'border-box';
            
            let item = inventory[i];
            let itemID, itemCount, itemDamage = 0, enchantments = null;

            if (Array.isArray(item)) {
                itemID = item[0]; itemCount = item[1]; itemDamage = item[2] || 0; enchantments = item[3];
            } else if (item && typeof item === 'object') {
                itemID = item.id || item.type; itemCount = item.count || 1; itemDamage = item.damage || item.states1 || 0; enchantments = item.nbt;
            }

            let isEnchanted = enchantments && Object.keys(enchantments).length > 0;

            if (itemID && itemID !== "air" && itemID !== "0" && itemID !== 0) { 
                let cvs = document.createElement('canvas');
                cvs.width = 16; cvs.height = 16;
                cvs.style.width = '16px'; cvs.style.height = '16px';
                let ctx = cvs.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                let tempState = { type: itemID }; 
                const texVar = window.itemTexVariant ? window.itemTexVariant(itemID, itemDamage, enchantments) : undefined;   // lana de color, etc.
                if (texVar !== undefined) tempState.states1 = texVar;
                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;

                if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                    drawItemIcon(ctx, renderObj, itemID, enchantments, 0, 0, 16, 16);
                } else {
                    ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
                }

                slot.appendChild(cvs);

                if (isEnchanted) {
                    slot.classList.add('enchanted-slot');
                    slot.title = ""; 
                    let itemNameStr = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                    let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
                    slot.dataset.enchantTooltip = `<strong>${itemNameStr}</strong>${enchantTooltipHTML}`;
                } else {
                    slot.title = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                }

                if (itemCount > 1) {
                    let countTag = document.createElement('span');
                    countTag.innerText = itemCount;
                    countTag.style.position = 'absolute'; countTag.style.bottom = '-2px'; countTag.style.right = '2px';
                    countTag.style.color = 'white'; countTag.style.fontSize = '10px'; countTag.style.fontWeight = 'bold';
                    countTag.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
                    slot.appendChild(countTag);
                }
            }
            gridContainer.appendChild(slot);
        }
        return true;
    }
    else if (blockState.toSmelt) {
        gridContainer.style.display = 'flex'; 
        gridContainer.style.alignItems = 'center';
        gridContainer.style.gap = '0px';
        gridContainer.style.padding = '0px';

        let ovenData = blockState.toSmelt;

        function buildOvenSlot(itemData, isLarge=false) {
            let slot = document.createElement('div');
            let size = isLarge ? '28px' : '20px';
            slot.style.width = size; slot.style.height = size;
            slot.style.background = '#8B8B8B'; slot.style.border = '1px inset #FFF';
            slot.style.position = 'relative'; slot.style.display = 'flex';
            slot.style.justifyContent = 'center'; slot.style.alignItems = 'center';

            let itemID, itemCount, itemDamage = 0, enchantments = null;

            if (Array.isArray(itemData)) {
                itemID = itemData[0]; itemCount = itemData[1]; itemDamage = itemData[2] || 0; enchantments = itemData[3];
            } else if (itemData && typeof itemData === 'object') {
                itemID = itemData.id || itemData.type; itemCount = itemData.count || 1; itemDamage = itemData.damage || itemData.states1 || 0; enchantments = itemData.nbt;
            }

            let isEnchanted = enchantments && Object.keys(enchantments).length > 0;

            if (itemID && itemID !== "air" && itemID !== 0 && itemID !== "0") {
                let cvs = document.createElement('canvas');
                cvs.width = 16; cvs.height = 16;
                cvs.style.width = isLarge ? '20px' : '14px'; cvs.style.height = isLarge ? '20px' : '14px';
                cvs.style.imageRendering = 'pixelated';
                let ctx = cvs.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                let tempState = { type: itemID }; 
                const texVar = window.itemTexVariant ? window.itemTexVariant(itemID, itemDamage, enchantments) : undefined;   // lana de color, etc.
                if (texVar !== undefined) tempState.states1 = texVar;
                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;

                if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                    drawItemIcon(ctx, renderObj, itemID, enchantments, 0, 0, 16, 16);
                } else {
                    ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
                }
                slot.appendChild(cvs);

                if (isEnchanted) {
                    slot.classList.add('enchanted-slot');
                    slot.title = ""; 
                    let itemNameStr = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                    let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
                    slot.dataset.enchantTooltip = `<strong>${itemNameStr}</strong>${enchantTooltipHTML}`;
                } else {
                    slot.title = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                }

                if (itemCount > 1) {
                    let countTag = document.createElement('span');
                    countTag.innerText = itemCount;
                    countTag.style.position = 'absolute'; countTag.style.bottom = '-2px'; countTag.style.right = '0px';
                    countTag.style.color = 'white'; countTag.style.fontSize = '10px'; countTag.style.fontWeight = 'bold';
                    countTag.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
                    slot.appendChild(countTag);
                }
            }
            return slot;
        }

        let leftCol = document.createElement('div');
        leftCol.style.display = 'flex'; leftCol.style.flexDirection = 'column';
        leftCol.style.gap = '5px'; leftCol.style.alignItems = 'center';

        leftCol.appendChild(buildOvenSlot(ovenData.input));
        
        let fire = document.createElement('div');
        fire.innerText = ovenData.fuelTimer > 0 ? '🔥' : '♨️';
        fire.style.fontSize = '10px';
        leftCol.appendChild(fire);
        
        leftCol.appendChild(buildOvenSlot(ovenData.fuel));

        let arrow = document.createElement('div');
        arrow.innerText = '➡️'; arrow.style.fontSize = '16px';

        let rightCol = document.createElement('div');
        rightCol.appendChild(buildOvenSlot(ovenData.output, true));

        gridContainer.appendChild(leftCol);
        gridContainer.appendChild(arrow);
        gridContainer.appendChild(rightCol);

        return true;
    }
    return false;
}

// =====================================================================================================================
// 🧰 CUADRO DE CASILLAS DE UN MOB (drops), UN COFRE O UN HORNO
// Sale al pasar el mouse por encima. Ya NO sigue al cursor: queda FIJO justo DEBAJO del objeto, centrado con él, y se
// queda ahí aunque se mueva el mouse (si se mueve la cámara o el mob, el cuadro se mueve con el objeto). Si no cabe
// abajo, sale arriba. Al quitar el mouse del objeto el cuadro espera medio segundo y se esconde con un desvanecido (fade);
// si el mouse vuelve al objeto (o se mete al cuadro, que en los cofres/hornos recibe el mouse para leer los objetos) en
// ese tiempo, no se esconde. El cuadro de los drops de un mob (solo con Move) NO recibe el mouse (pointer-events: none).
// =====================================================================================================================
const TIP_HIDE_DELAY = 500;   // ms que puede estar el mouse fuera del objeto antes de que el cuadro empiece a esconderse
const TIP_FADE_MS = 250;      // lo que dura el desvanecido (debe coincidir con style.css: #chest-tooltip-overlay.tip-fade)
const TIP_GAP = 6;            // píxeles entre el objeto y el cuadro

let chestTipAt = null;        // el cofre / horno que muestra ahora el cuadro ({x, y, type}); null = ninguno (o es el de un mob)
let tipTarget = null;         // lo que muestra ahora el cuadro: { kind: 'mob' | 'block', id, sig, mobKey | bx, by }
let tipHideTimer = null, tipFadeTimer = null, tipRaf = 0, tipOverTip = false, tipSigAt = 0;

function tipOverlay() { return document.getElementById('chest-tooltip-overlay'); }

// ¿Qué hay bajo el mouse que merezca el cuadro? Un mob con drops propios (solo con Move) o un cofre / horno. Si no, null.
function findTipTarget() {
    if (typeof mbwom === 'undefined' || !mbwom.scene) return null;
    if (mouse.left || mouse.right || (typeof isDraggingMob !== 'undefined' && isDraggingMob)) return null;   // mientras se hace clic / se arrastra no sale
    if (typeof currentTool !== 'undefined' && currentTool === 'move' && mbwom.mobs && typeof tileSize !== 'undefined' && typeof window.mobDropsPreview === 'function') {
        const hit = findMobAt(camera.x + (mouse.canvasX / tileSize), camera.y + (mouse.canvasY / tileSize));
        if (hit && hit.mob && Array.isArray(hit.mob.drops) && hit.mob.drops.length) {
            return { kind: 'mob', id: 'm:' + hit.key, mobKey: hit.key, mob: hit.mob, sig: hit.key + '|' + JSON.stringify(hit.mob.drops) };
        }
    }
    const bs = mbwom.getBlockState(mouse.worldX, mouse.worldY);
    if (bs && ((bs.type === 'chest' && Array.isArray(bs.chests)) || bs.toSmelt)) {
        return { kind: 'block', id: 'b:' + mouse.worldX + ',' + mouse.worldY, bx: mouse.worldX, by: mouse.worldY, bs: bs, sig: JSON.stringify(bs.type === 'chest' ? bs.chests : bs.toSmelt) };
    }
    return null;
}

// El objeto de un target en pantalla: centro en X, borde de abajo y borde de arriba (en píxeles del espacio de trabajo)
function tipAnchor(target) {
    if (typeof tileSize === 'undefined' || typeof camera === 'undefined' || typeof canvas === 'undefined') return null;
    if (target.kind === 'mob') {
        const m = (typeof mbwom !== 'undefined' && mbwom.mobs) ? mbwom.mobs[target.mobKey] : null;
        if (!m) return null;
        const info = getMobDrawInfo(m, true);
        const bottom = canvas.height - (-Number(m.y) - camera.y) * tileSize;
        return { cx: (Number(m.x) - camera.x) * tileSize, bottom: bottom, top: bottom - info.h * tileSize };
    }
    const bottom = canvas.height - (target.by - camera.y) * tileSize;
    return { cx: (target.bx + 0.5 - camera.x) * tileSize, bottom: bottom, top: bottom - tileSize };
}

// Pone el cuadro justo debajo del objeto, centrado. Devuelve false si el objeto ya no existe o salió de la pantalla.
function placeTip() {
    const tooltip = tipOverlay();
    if (!tooltip || !tipTarget) return false;
    const a = tipAnchor(tipTarget);
    if (!a) return false;
    const ws = document.getElementById('workspace');
    const W = ws ? ws.clientWidth : Infinity, H = ws ? ws.clientHeight : Infinity;
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    if (a.bottom < 0 || a.top > H || a.cx < -w / 2 || a.cx > W + w / 2) return false;   // el objeto salió de la vista
    let left = a.cx - w / 2, top = a.bottom + TIP_GAP;
    if (top + h > H) top = a.top - TIP_GAP - h;            // no cabe abajo: sale arriba
    left = Math.max(0, Math.min(left, W - w));
    top = Math.max(0, Math.min(top, H - h));
    left = Math.round(left); top = Math.round(top);
    if (tooltip._tl !== left) { tooltip.style.left = left + 'px'; tooltip._tl = left; }
    if (tooltip._tt !== top) { tooltip.style.top = top + 'px'; tooltip._tt = top; }
    return true;
}

// ¿Sigue existiendo lo que muestra el cuadro? (se borró el mob, se cambió el cofre, otra escena...)
function tipTargetAlive() {
    if (!tipTarget) return false;
    if (tipTarget.kind === 'mob') return !!(typeof mbwom !== 'undefined' && mbwom.mobs && mbwom.mobs[tipTarget.mobKey]);
    const bs = (typeof mbwom !== 'undefined' && mbwom.scene) ? mbwom.getBlockState(tipTarget.bx, tipTarget.by) : null;
    return !!(bs && ((bs.type === 'chest' && Array.isArray(bs.chests)) || bs.toSmelt));
}

// Mientras el cuadro se ve, sigue al objeto (si la cámara o el mob se mueven) y se pone al día si cambió su contenido
function tipFrame(now) {
    tipRaf = 0;
    const tooltip = tipOverlay();
    if (!tooltip || !tipTarget || tooltip.style.display === 'none') return;
    if (!tipTargetAlive()) { hideTip(false); return; }
    if (now - tipSigAt > 250) {
        tipSigAt = now;
        const fresh = tipTarget.kind === 'mob'
            ? (mbwom.mobs[tipTarget.mobKey] && tipTarget.mobKey + '|' + JSON.stringify(mbwom.mobs[tipTarget.mobKey].drops))
            : (() => { const bs = mbwom.getBlockState(tipTarget.bx, tipTarget.by); return JSON.stringify(bs.type === 'chest' ? bs.chests : bs.toSmelt); })();
        if (fresh !== tipTarget.sig) {
            const t = tipTarget;
            if (t.kind === 'mob') { if (!window.mobDropsPreview(mbwom.mobs[t.mobKey], document.getElementById('chest-tooltip-grid'))) { hideTip(false); return; } }
            else renderChestOrOvenUI(mbwom.getBlockState(t.bx, t.by), document.getElementById('chest-tooltip-grid'));
            t.sig = fresh;
        }
    }
    if (!placeTip()) { hideTip(false); return; }
    tipRaf = requestAnimationFrame(tipFrame);
}
function startTipFollow() { if (!tipRaf) tipRaf = requestAnimationFrame(tipFrame); }

function cancelTipHide() {
    if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
    const tooltip = tipOverlay();
    if (tooltip && tooltip.classList.contains('tip-fade') && tooltip.style.display !== 'none') {   // ya se estaba desvaneciendo: vuelve a aparecer
        if (tipFadeTimer) { clearTimeout(tipFadeTimer); tipFadeTimer = null; }
        tooltip.classList.remove('tip-fade');
        startTipFollow();
    }
}

// El mouse dejó el objeto: se espera medio segundo y entonces se esconde con fade
function scheduleTipHide() {
    const tooltip = tipOverlay();
    if (!tooltip || tooltip.style.display === 'none' || tooltip.classList.contains('tip-fade')) return;
    if (tipOverTip || tipHideTimer) return;     // con el mouse metido en el cuadro no se esconde; y el medio segundo ya está corriendo
    tipHideTimer = setTimeout(function () { tipHideTimer = null; if (!tipOverTip) hideTip(false); }, TIP_HIDE_DELAY);
}

// Esconde el cuadro. instant = true: de golpe (para cuando se abre otra ventana encima); si no, con el desvanecido
function hideTip(instant) {
    const tooltip = tipOverlay();
    if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
    if (tipFadeTimer) { clearTimeout(tipFadeTimer); tipFadeTimer = null; }
    if (!tooltip) return;
    const done = function () {
        tipFadeTimer = null;
        tooltip.style.display = 'none';
        tooltip.classList.remove('tip-fade');
        tooltip.classList.remove('mob-drops-tip');
        tipTarget = null; chestTipAt = null; tipOverTip = false;
    };
    if (tooltip.style.display === 'none') { done(); return; }
    if (instant) { done(); return; }
    tipOverTip = false;
    tooltip.classList.add('tip-fade');
    tipFadeTimer = setTimeout(done, TIP_FADE_MS + 30);
}

// Compatibilidad: otros archivos llaman a esta función (por ejemplo al cambiar de herramienta). Solo esconde el cuadro de un MOB.
function hideMobDropsTip() {
    if (tipTarget && tipTarget.kind === 'mob') hideTip(false);
}

function updateChestTooltip() {
    const tooltip = tipOverlay();
    if (!tooltip) return;
    const target = findTipTarget();
    if (!target) { scheduleTipHide(); return; }

    const grid = document.getElementById('chest-tooltip-grid');
    const hidden = tooltip.style.display === 'none';
    const same = !!tipTarget && tipTarget.id === target.id;
    if (hidden || !same || tipTarget.sig !== target.sig) {
        // Solo se vuelven a dibujar las casillas si cambió el objeto o su contenido (no en cada movimiento del mouse)
        const ok = target.kind === 'mob' ? window.mobDropsPreview(target.mob, grid) : renderChestOrOvenUI(target.bs, grid);
        if (!ok) { scheduleTipHide(); return; }
    }
    // Cuadro de un mob: no recibe el mouse. Cuadro de cofre / horno: sí (para leer los objetos y, con Move, editar el cofre con clic derecho)
    tooltip.classList.toggle('mob-drops-tip', target.kind === 'mob');
    const hint = document.getElementById('chest-tooltip-hint');
    if (hint) {
        const canEdit = target.kind === 'block' && typeof currentTool !== 'undefined' && currentTool === 'move' && target.bs.type === 'chest';
        hint.style.display = canEdit ? 'block' : 'none';
        if (canEdit) hint.textContent = (typeof t === 'function' ? t('chest_edit_hint') : 'Right-click to edit');
    }
    tipTarget = target;
    chestTipAt = target.kind === 'block' ? { x: target.bx, y: target.by, type: target.bs.type } : null;

    if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
    if (hidden) {
        // aparece con un fade corto: se pone invisible, se muestra y en el siguiente cuadro se vuelve visible
        tooltip.classList.add('tip-fade');
        tooltip.style.display = 'block';
        if (tipFadeTimer) { clearTimeout(tipFadeTimer); tipFadeTimer = null; }
        if (!placeTip()) { hideTip(true); return; }
        void tooltip.offsetWidth;
        tooltip.classList.remove('tip-fade');
        tipSigAt = performance.now();
    } else {
        if (tooltip.classList.contains('tip-fade')) {   // se estaba desvaneciendo y el mouse volvió: aparece otra vez
            if (tipFadeTimer) { clearTimeout(tipFadeTimer); tipFadeTimer = null; }
            tooltip.classList.remove('tip-fade');
        }
        if (!placeTip()) { hideTip(false); return; }
    }
    startTipFollow();
}

// El cuadro de un cofre / horno recibe el mouse (así se pueden leer los objetos con el cursor encima): mientras el mouse esté
// dentro de él no se esconde. Con la herramienta Move, el clic derecho sobre el cuadro abre el inventario del cofre que se está
// viendo, igual que sobre el cofre mismo.
(function () {
    const ov = tipOverlay();
    if (!ov) return;
    ov.addEventListener('mouseenter', function () { tipOverTip = true; cancelTipHide(); });
    ov.addEventListener('mouseleave', function () { tipOverTip = false; scheduleTipHide(); });
    ov.addEventListener('mousedown', function (e) {
        if (e.button !== 2 || typeof currentTool === 'undefined' || currentTool !== 'move') return;
        if (!chestTipAt || chestTipAt.type !== 'chest' || typeof openChestEditor !== 'function') return;
        if (openChestEditor(chestTipAt.x, chestTipAt.y)) { e.preventDefault(); hideTip(true); }
    });
    ov.addEventListener('contextmenu', function (e) { e.preventDefault(); });
})();

// --- ¿QUÉ MOB HAY BAJO EL MOUSE? ---
// Antes el área de clic de cada mob se calculaba con el tamaño de su ARCHIVO de imagen (ancho / 16), que no tiene
// nada que ver con el tamaño con que se dibuja: una skin (el archivo es una tira de 272 px) tenía un área de
// 17 cuadros de ancho, y el zombi, el cerdo o la vaca un área más chica que su dibujo. Con dos mobs cerca ganaba
// siempre el primero de la lista. Ahora:
//  1) el área es EXACTAMENTE la que se dibuja (getMobDrawInfo, en main.js);
//  2) si dos áreas se cruzan, gana el mob cuyo dibujo está de verdad bajo el cursor (píxel no transparente) y, si
//     hay varios, el que se ve ENCIMA (el último que se dibuja); si el cursor está en una parte transparente de
//     todos, gana el que tiene su centro más cerca del cursor.
const mobAlphaCache = new WeakMap();   // imagen -> { w, h, data } con la transparencia de cada píxel (se lee una sola vez)
function mobPixelOpaque(img, srcW, srcH, fx, fy) {
    // fx, fy: de 0 a 1 dentro del dibujo (fy = 0 arriba). Devuelve true / false, o null si no se puede leer la imagen.
    try {
        let c = mobAlphaCache.get(img);
        if (!c || c.sw !== srcW || c.sh !== srcH) {
            const cv = document.createElement('canvas');
            cv.width = srcW; cv.height = srcH;
            const cx = cv.getContext('2d', { willReadFrequently: true });
            cx.drawImage(img, 0, 0, srcW, srcH, 0, 0, srcW, srcH);
            c = { sw: srcW, sh: srcH, data: cx.getImageData(0, 0, srcW, srcH).data };
            mobAlphaCache.set(img, c);
        }
        const px = Math.min(srcW - 1, Math.max(0, Math.floor(fx * srcW)));
        const py = Math.min(srcH - 1, Math.max(0, Math.floor(fy * srcH)));
        return c.data[(py * srcW + px) * 4 + 3] > 24;
    } catch (e) {
        return null;   // imagen "contaminada" (por ejemplo, abierta desde un archivo local): se usa solo el área
    }
}

function findMobAt(wx, wy) {
    if (typeof mbwom === 'undefined' || !mbwom.mobs) return null;
    let topOpaque = null, nearest = null, nearestDist = Infinity;
    for (let key in mbwom.mobs) {
        const m = mbwom.mobs[key];
        if (!m || !m.type) continue;
        const info = getMobDrawInfo(m, true);   // true = no empezar descargas de skins solo por hacer clic
        const mx = Number(m.x), bottom = -Number(m.y);
        const left = mx - info.w / 2, right = mx + info.w / 2, top = bottom + info.h;
        if (wx < left || wx > right || wy < bottom || wy > top) continue;

        let opaque = false;
        const img = info.img;
        if (img && img.complete && img.naturalWidth > 0) {
            let fx = (wx - left) / info.w;
            if (m.direction === 1) fx = 1 - fx;                    // el dibujo va volteado
            const fy = (top - wy) / info.h;
            const srcW = info.isCustomSkin ? 16 : img.naturalWidth;
            const srcH = info.isCustomSkin ? 22 : img.naturalHeight;
            const r = mobPixelOpaque(img, Math.min(srcW, img.naturalWidth), Math.min(srcH, img.naturalHeight), fx, fy);
            opaque = (r === null) ? true : r;
        } else {
            opaque = true;   // todavía sin imagen: se ve un rectángulo de color, todo el área es "sólida"
        }
        if (opaque) { topOpaque = { key, mob: m }; continue; }   // el último en la lista es el que se dibuja encima
        const d = Math.hypot(wx - mx, wy - (bottom + info.h / 2));
        if (d < nearestDist) { nearestDist = d; nearest = { key, mob: m }; }
    }
    return topOpaque || nearest;
}

// --- CLICS PRINCIPALES (MOUSEDOWN) ---
canvas.addEventListener("mousedown", function (event) {
    if (typeof mbwom === 'undefined' || !mbwom.scene) return;   // sin mundo abierto no hay nada que tocar
    if (event.button == 0) mouse.left = true;
    if (event.button == 2) mouse.right = true;
    if (event.button == 0) hideTip(false);   // al hacer clic (dibujar, mover, seleccionar) el cuadro de casillas se esconde con su fade

    // ✨ CLIC DERECHO CON MOVE SOBRE UN COFRE: abre su inventario para editar los objetos (scripts/player-inventory.js)
    if (currentTool === 'move' && event.button == 2 && typeof openChestEditor === 'function') {
        const bs = mbwom.getBlockState(mouse.worldX, mouse.worldY);
        if (bs && bs.type === 'chest' && openChestEditor(mouse.worldX, mouse.worldY)) {
            mouse.right = false;
            event.preventDefault();
            hideTip(true);   // se abre la ventana del cofre: el cuadro se quita de golpe
            return;
        }
    }

    // ✨ CLIC DERECHO CON MOVE SOBRE UN LETRERO: abre el editor de texto (scripts/world-extras.js)
    if (currentTool === 'move' && event.button == 2 && typeof openSignEditor === 'function') {
        const bs = mbwom.getBlockState(mouse.worldX, mouse.worldY);
        if (bs && bs.type === 'sign' && openSignEditor(mouse.worldX, mouse.worldY)) {
            mouse.right = false;
            event.preventDefault();
            hideTip(true);
            return;
        }
    }

    // ✨ SELECCIONAR Y MOVER MOB (MOVE)
    if (currentTool === 'move' && mouse.left) {
        hideMobDropsTip();
        let clickedOnMob = false;
        let exactWorldX = camera.x + (mouse.canvasX / tileSize);
        let exactWorldY = camera.y + (mouse.canvasY / tileSize);

        const hit = findMobAt(exactWorldX, exactWorldY);
        if (hit) {
            const m = hit.mob, key = hit.key;
            selectedMob = m;
            selectedMobKey = key;
            draggedMob = m;
            isDraggingMob = true;
            clickedOnMob = true;

            // ✨ ADD HISTORY: Tomar foto inicial antes de arrastrar
            window.mobInitialStateForHistory = JSON.parse(JSON.stringify(m));

            dragOffset.x = Number(m.x) - exactWorldX;
            dragOffset.y = -Number(m.y) - exactWorldY;

            if (typeof toggleMobInfo === 'function') toggleMobInfo(true);
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }

        if (!clickedOnMob) {
            selectedMob = null;
            selectedMobKey = null;
            if (typeof toggleMobInfo === 'function') toggleMobInfo(false);
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
    }
    // ✨ PONER UN MOB GUARDADO CUSTOMIZADO (INDEPENDIENTE)
    else if (currentTool === 'paste_custom_mob' && mouse.left && window.mobToPaste) {
        if (typeof mbwom !== 'undefined' && mbwom.world) {
            // Vincular Mobs a la dimensión actual
            if (!mbwom.mobs) {
                mbwom.mobs = {};
                if (mbwom.world && mbwom.currentScene) {
                    mbwom.world["mobs" + mbwom.currentScene] = mbwom.mobs;
                }
            }
            
            // Clonar el objeto guardado para no editar el original de la memoria
            let newMob = JSON.parse(JSON.stringify(window.mobToPaste));
            
            // Asignar ID único y coordenadas actuales del ratón (exactas)
            const newId = "saved_mob_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
            let exactWorldX = camera.x + (mouse.canvasX / tileSize);
            let exactWorldY = camera.y + (mouse.canvasY / tileSize);

            newMob.id = newId;
            newMob.x = exactWorldX;
            newMob.y = -exactWorldY; // Y invertida
            newMob.scene = typeof mbwom.currentScene !== 'undefined' ? mbwom.currentScene : 1;
            
            // Guardar el historial si es necesario (opcional)
            if (typeof historyManager !== 'undefined') historyManager.recordMobPlacement(newId, null, newMob);
            
            // Inyectar en el objeto del mundo
            mbwom.mobs[newMob.id] = newMob;
            
            // Multiplayer
            if (typeof isMultiplayer !== 'undefined' && isMultiplayer && typeof enviarMensajeEnRed === 'function') {
                enviarMensajeEnRed({ tipo: "accion_spawn_mob", id: newId, mob: mbwom.mobs[newId] });
            }

            // Efecto visual/sonido
            if (typeof audioManager !== 'undefined') audioManager.playTone(300, 'triangle', 0.1, 0.1);
            if (typeof worldDirty !== 'undefined') worldDirty = true;
            mouse.left = false; // Detener el spawn continuo
        }
    }
    // ✨ PONER UN MOB EN EL MUNDO (SPAWN CON LA PLANTILLA PERFECTA DEL CERDO)
    else if (currentTool === 'spawn_mob' && mouse.left) {
    if (typeof mbwom !== 'undefined') {
        // VINCULACIÓN CRÍTICA:
        if (!mbwom.mobs) {
            mbwom.mobs = {};
            // Si el objeto de la dimensión no existe, lo vinculamos ahora
            if (mbwom.world && mbwom.currentScene) {
                mbwom.world["mobs" + mbwom.currentScene] = mbwom.mobs;
            }
        }

            const newId = "mob_spawn_" + Date.now() + Math.floor(Math.random() * 1000);

            let exactWorldX = camera.x + (mouse.canvasX / tileSize);
            let exactWorldY = camera.y + (mouse.canvasY / tileSize);

            let mobTypeToSpawn = typeof currentMobToSpawn !== 'undefined' ? currentMobToSpawn : 'zombie';
            let baseType = mobTypeToSpawn;
            let hp = 20;

            if (mobTypeToSpawn && String(mobTypeToSpawn).startsWith('custom_')) {
                let parts = String(mobTypeToSpawn).split('_');
                let idx = parseInt(parts[1]);
                let customMobs = [];
                try { customMobs = JSON.parse(localStorage.getItem('mbw_custom_mobs')) || []; } catch(e){}
                
                let cMob = customMobs[idx];
                if (cMob && cMob.baseType) {
                    baseType = cMob.baseType; 
                    hp = parseInt(cMob.hp) || 20;
                } else {
                    baseType = 'zombie'; 
                }
            } else {
                hp = (typeof MOBS_DB !== 'undefined' && MOBS_DB[mobTypeToSpawn]) ? parseInt(MOBS_DB[mobTypeToSpawn].hp) : 20;
            }

            // =====================================================================
            // ✨ PLANTILLA PERFECTA (LA RADIOGRAFÍA DEL CERDO DE TU ARCHIVO) ✨
            // (Limpiamos la velocidad y cooldowns para que nazca relajado y sano)
            // =====================================================================
            const BASE_MOB_TEMPLATE = {
                "id": newId,
                "type": String(baseType),
                "name": "",
                "x": exactWorldX,
                "y": -exactWorldY, // Respetamos la Y Invertida
                "health": hp,
                "scene": (typeof mbwom.currentScene !== 'undefined' ? mbwom.currentScene : 1),
                "direction": 0,
                "speedX": 0,
                "speedY": 0,
                "falling": true,
                "wasFalling": true,
                "wasFallingSpeed": 0,
                "air": 11,
                "airTimer": 60,
                "startUnderwaterTimer": 0,
                "animationType": "idle",
                "animationFrame": 0,
                "variant": "",
                "babyTimer": 0,
                "breedTimer": 0,
                "aggressiveness": 0,
                "target": null,
                "focus": null,
                "riding": null,
                "riddenBy": null,
                "leash": null,
                "keys": {
                    "right": false,
                    "up": false,
                    "left": false
                },
                "inventory": [],
                "handItems": [],
                "armor": [],
                "handDropChances": [0.085, 0.085],
                "armorDropChances": [0.085, 0.085, 0.085, 0.085],
                "defaultDrops": true,
                "effects": {},
                "attackCooldown": 0,
                "hitCooldown": 0,
                "lastDamageType": "",
                "lastDamageID": "",
                "ticksSinceLastDamageID": 0,
                "persists": false,
                "saddleItem": ["air", 1, 0, {}]
            };

            // 1. Buscamos la plantilla en nuestra nueva base de datos
            // getMobTemplate entiende los nombres de casilla del Mob Browser (ej. "mushroom" = vaca mooshroom)
            const template = (typeof getMobTemplate === 'function' && getMobTemplate(currentMobToSpawn)) || BASE_MOB_TEMPLATE;

            if (template) {
                // 2. Clonamos la plantilla para que cada mob sea único
                mbwom.mobs[newId] = JSON.parse(JSON.stringify(template));
                
                // 3. Ajustamos su posición e ID
                mbwom.mobs[newId].x = exactWorldX;
                mbwom.mobs[newId].y = -exactWorldY;
                mbwom.mobs[newId].id = newId;
                if (typeof window.mbwFixMob === 'function') window.mbwFixMob(mbwom.mobs[newId]);   // (si la plantilla fuera la básica, un creeper se quedaría sin "fuse")
                
                // ✨ FIX CRÍTICO: Asignar al mob la escena actual para que no se escape al Overworld
                mbwom.mobs[newId].scene = typeof mbwom.currentScene !== 'undefined' ? mbwom.currentScene : 1;

                // ✨ Datos personalizados del panel del Mob Browser (nombre, vida, armadura, drops...)
                if (window.currentMobSpec && typeof applyMobSpec === 'function') {
                    applyMobSpec(mbwom.mobs[newId], window.currentMobSpec);
                }

                // ✨ ADD HISTORY: Crear Mob Nuevo
                historyManager.startAction();
                historyManager.recordMobChange(newId, null, mbwom.mobs[newId]);
                historyManager.commitAction();
                
                console.log(`Spawned ${currentMobToSpawn} with template!`);
            } else {
                console.error(`Error: No existe una plantilla para el mob: ${currentMobToSpawn}`);
            }

            if (typeof worldDirty !== 'undefined') worldDirty = true; 
            console.log("Mob generated from Perfect Preset:", baseType);

            // ==========================================
            // ✨ MULTIPLAYER A: Avisar que creamos un Mob
            // ==========================================
            if (typeof enviarMensajeEnRed === 'function') {
                enviarMensajeEnRed({ tipo: "accion_spawn_mob", id: newId, mob: mbwom.mobs[newId] });
            }
            mouse.left = false; // Detener spawn continuo
        }
    }
    // HERRAMIENTAS DE BLOQUES
    else if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        // Le pasamos el estado de Ctrl (event.ctrlKey || event.metaKey)
        handleSelectionInput('start', mouse.worldX, mouse.worldY, (event.ctrlKey || event.metaKey));
    }
    else if (currentTool === 'magic' && mouse.left) {
        magicWandSelect(mouse.worldX, mouse.worldY);
    }
    else if (currentTool === 'paste' && mouse.left) {
        performPaste(mouse.worldX, mouse.worldY, event.shiftKey);
    }
    else if (mouse.left || mouse.right) {
        if (currentTool === 'bucket' && mouse.left) {
            bucketFill(mouse.worldX, mouse.worldY);
        } else {
            historyManager.startAction();
        }
    }
});

// --- DOBLE CLIC CON MOVE SOBRE UN MOB: abre el Mob Browser con los datos de ese mob (scripts/mob-editor.js) ---
canvas.addEventListener("dblclick", function (event) {
    if (typeof mbwom === 'undefined' || !mbwom.scene) return;
    if (currentTool !== 'move' || event.button !== 0 || typeof openMobFromWorld !== 'function') return;
    const wx = camera.x + (event.offsetX / tileSize);
    const wy = camera.y + ((canvas.height - event.offsetY) / tileSize);
    const hit = findMobAt(wx, wy);
    if (hit) openMobFromWorld(hit.mob);
});

// --- SOLTAR CLICS (MOUSEUP) ---
window.addEventListener("mouseup", function (event) {
    if (typeof isDraggingMob !== 'undefined' && isDraggingMob) {
        
        // ✨ ADD HISTORY: Tomar foto final y guardar el movimiento
        if (window.mobInitialStateForHistory) {
            if (window.mobInitialStateForHistory.x !== draggedMob.x || window.mobInitialStateForHistory.y !== draggedMob.y) {
                historyManager.startAction();
                historyManager.recordMobChange(selectedMobKey, window.mobInitialStateForHistory, draggedMob);
                historyManager.commitAction();
            }
            window.mobInitialStateForHistory = null; // Limpiar para el siguiente
        }
        
        // ==========================================
        // ✨ MULTIPLAYER B: Avisar posición final del Mob
        // ==========================================
        if (typeof enviarMensajeEnRed === 'function' && selectedMobKey && mbwom.mobs[selectedMobKey]) {
            enviarMensajeEnRed({ 
                tipo: "accion_mover_mob", 
                id: selectedMobKey, 
                x: mbwom.mobs[selectedMobKey].x, 
                y: mbwom.mobs[selectedMobKey].y 
            });
        }
        
        isDraggingMob = false;
        draggedMob = null;
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }

    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('end', mouse.worldX, mouse.worldY);
    }

    if (event.button == 0) mouse.left = false;
    if (event.button == 2) mouse.right = false;

    if (currentTool !== 'bucket' && currentTool !== 'select' && currentTool !== 'lasso' && currentTool !== 'paste' && currentTool !== 'move' && currentTool !== 'spawn_mob') {
        historyManager.commitAction();
    }
});

canvas.addEventListener("mouseleave", function() {
    scheduleTipHide();   // el cursor salió del lienzo: el cuadro de casillas se esconde (con fade) medio segundo después, salvo que el mouse se meta en él
    if (mouse.left || mouse.right) {
        if (currentTool !== 'select' && currentTool !== 'lasso') historyManager.commitAction();
        mouse.left = false;
        mouse.right = false;
    }
});

canvas.addEventListener("contextmenu", e => e.preventDefault());

// El menú del navegador (clic derecho) no se usa en el editor: el clic derecho tiene funciones propias (editar cofres,
// recoger la mitad de una pila, menús del chat...). Se desactiva en TODA la página; la única excepción son las cajas de
// texto, para poder copiar / pegar con el mouse.
document.addEventListener("contextmenu", function (e) {
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && /^(text|search|url|email|password|number|tel)?$/i.test(t.type || '')) || (t && t.isContentEditable)) return;
    e.preventDefault();
}, true);