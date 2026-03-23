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
        this.alignedX = this.gridX * tileSize;
        this.alignedY = canvas.height - this.gridY * tileSize;
        // Aplicamos Math.floor para forzar siempre números enteros (Alineación perfecta del Lasso con Zoom)
        this.worldX = Math.floor(camera.x) + this.gridX;
        this.worldY = Math.floor(camera.y) + this.gridY;
    }
}

function cameraMovement() {
    // Inicializamos acumuladores internos para manejar velocidades con decimales
    if (typeof camera.accX === 'undefined') { 
        camera.accX = 0; 
        camera.accY = 0; 
    }

    let moveX = 0;
    let moveY = 0;

    if (keys.KeyW) moveY += camera.speed;
    if (keys.KeyS) moveY -= camera.speed;
    if (keys.KeyD) moveX += camera.speed;
    if (keys.KeyA) moveX -= camera.speed;

    // Sumamos el movimiento fraccionario al acumulador
    camera.accX += moveX;
    camera.accY += moveY;

    // Solo movemos la cámara real cuando hemos acumulado al menos 1 bloque entero
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
window.addEventListener("keydown", function (event) {
    
    // 1. Evitar que los atajos se activen si estás escribiendo en CUALQUIER caja de texto
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        // Excepción: Si estás en el buscador del inventario y presionas 'E', ciérralo.
        if (event.code === 'KeyE' && document.activeElement.id === 'inventory-search') {
            event.preventDefault();
            try { toggleInventory(); } catch(e) { console.error("Error al cerrar inventario:", e); }
        }
        return; 
    }

    if (keys.hasOwnProperty(event.code)) keys[event.code] = true;

    if (event.code === 'Tab') {
        teleportSwitch();
        event.preventDefault();
    }

    // --- Atajos de Control (Ctrl / Cmd) ---
    const isCtrl = event.ctrlKey || event.metaKey;

    if (isCtrl && event.code === 'KeyZ') {
        event.preventDefault();
        historyManager.undo();
    }
    if (isCtrl && event.code === 'KeyY') {
        event.preventDefault();
        historyManager.redo();
    }
    if (isCtrl && event.code === 'KeyC') {
        event.preventDefault();
        if (typeof copySelection === 'function') copySelection();
    }
    if (isCtrl && event.code === 'KeyX') {
        event.preventDefault();
        if (typeof cutSelection === 'function') cutSelection();
    }
    if (isCtrl && event.code === 'KeyV') {
        event.preventDefault();
        if (typeof activatePasteMode === 'function') activatePasteMode();
    }

    // --- Atajos de Herramientas ---
    if (event.code === 'KeyZ' && !isCtrl) {
        if (typeof setSelectionPoint === 'function') setSelectionPoint(1, mouse.worldX, mouse.worldY);
    }
    if (event.code === 'KeyX' && !isCtrl) { 
        if (typeof setSelectionPoint === 'function') setSelectionPoint(2, mouse.worldX, mouse.worldY);
    }
    
    if (event.code === 'KeyC' && !isCtrl) {
         if (typeof eyedropper === 'function') eyedropper(mouse.worldX, mouse.worldY);
    }

    // --- MENÚS (Inventario y Estructuras) ---
    if (event.code === 'KeyE' && !isCtrl) {
        event.preventDefault(); 
        try { 
            toggleInventory(); 
        } catch(e) { 
            console.error("No se encontró la función toggleInventory(). Revisa ui-handler.js", e); 
        }
    }

    if (event.code === 'KeyR' && !isCtrl) {
        event.preventDefault(); 
        try { 
            openStructuresModal(); 
        } catch(e) { 
            console.error("No se encontró la función openStructuresModal(). Revisa structures.js", e); 
        }
    }

    // --- HOTBAR (Números 1-9) ---
    if (event.code.startsWith('Digit')) {
        let num = parseInt(event.code.charAt(5));
        if (!isNaN(num) && num > 0) {
            slotIndex = num - 1;
            if (typeof updateHotbarSelection === 'function') updateHotbarSelection();
        }
    }
});

window.addEventListener("keyup", function (event) {
    if (keys.hasOwnProperty(event.code)) keys[event.code] = false;
});

canvas.addEventListener("mousemove", (event) => {
    mouse.canvasX = event.offsetX;
    mouse.canvasY = canvas.height - event.offsetY;
    mouse.gridX = Math.floor(mouse.canvasX / tileSize);
    mouse.gridY = Math.floor(mouse.canvasY / tileSize);
    mouse.calculateCoordinates(); 

    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('move', mouse.worldX, mouse.worldY);
    }
    
    // --- NUEVO: LÓGICA DEL TOOLTIP DE COFRE FLOTANTE ---
    updateChestTooltip(event.offsetX, event.offsetY);
});

// --- HERRAMIENTAS GLOBALES (Para poder reusarlas en otros archivos) ---
const maxDurabilityMap = {
    "WoodenPickaxe": 60, "StonePickaxe": 132, "IronPickaxe": 251, "GoldPickaxe": 33, "DiamondPickaxe": 1562, "ObsidianPickaxe": 2500,
    "WoodenSword": 60, "StoneSword": 132, "IronSword": 251, "GoldSword": 33, "DiamondSword": 1562,
    "WoodenAxe": 60, "StoneAxe": 132, "IronAxe": 251, "GoldAxe": 33, "DiamondAxe": 1562,
    "WoodenShovel": 60, "StoneShovel": 132, "IronShovel": 251, "GoldShovel": 33, "DiamondShovel": 1562,
    "WoodenHoe": 60, "StoneHoe": 132, "IronHoe": 251, "GoldHoe": 33, "DiamondHoe": 1562
};

// --- DIBUJANTE UNIVERSAL DE INVENTARIOS ---
// Toma los datos de un bloque y los dibuja adentro del contenedor que le pidas
// --- DIBUJANTE UNIVERSAL DE INVENTARIOS ---
// Toma los datos de un bloque y los dibuja adentro del contenedor que le pidas
function renderChestOrOvenUI(blockState, gridContainer) {
    gridContainer.innerHTML = ''; 
    if (!blockState) return false;

    // --- LÓGICA DEL COFRE ---
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

            // Extractor Inteligente (Detecta si es Array u Objeto)
            if (Array.isArray(item)) {
                itemID = item[0]; itemCount = item[1]; itemDamage = item[2] || 0; enchantments = item[3];
            } else if (item && typeof item === 'object') {
                itemID = item.id || item.type; 
                itemCount = item.count || 1; 
                itemDamage = item.damage || item.states1 || 0; 
                enchantments = item.nbt;
            }

            let isEnchanted = enchantments && Object.keys(enchantments).length > 0;

            if (itemID && itemID !== "air" && itemID !== "0" && itemID !== 0) { 
                let cvs = document.createElement('canvas');
                cvs.width = 16; cvs.height = 16;
                cvs.style.width = '16px'; cvs.style.height = '16px';
                let ctx = cvs.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                let tempState = { type: itemID }; 
                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;

                if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                    ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
                    let maxDur = typeof maxDurabilityMap !== 'undefined' ? maxDurabilityMap[itemID] : null;
                    if (maxDur && typeof drawDurabilityBar === 'function') {
                        drawDurabilityBar(ctx, 0, 0, 16, 16, itemDamage, maxDur);
                    }
                } else {
                    ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
                }

                slot.appendChild(cvs);

                // --- APLICAR EFECTO MAGIA CON EL NUEVO SISTEMA MAESTRO ---
                if (isEnchanted) {
                    slot.classList.add('enchanted-slot');
                    slot.title = ""; // Matamos el tooltip nativo
                    
                    let itemNameStr = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                    let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
                    
                    // Guardamos el texto mágico invisiblemente para que el Tooltip Maestro lo lea
                    slot.dataset.enchantTooltip = `<strong>${itemNameStr}</strong>${enchantTooltipHTML}`;
                } else {
                    // Si no es mágico, solo mostramos el nombre normal con el tooltip nativo
                    slot.title = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                }

                if (itemCount > 1) {
                    let countTag = document.createElement('span');
                    countTag.innerText = itemCount;
                    countTag.style.position = 'absolute'; countTag.style.bottom = '-2px'; countTag.style.right = '2px';
                    countTag.style.color = 'white'; countTag.style.fontSize = '10px'; countTag.style.fontWeight = 'bold';
                    countTag.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
                    countTag.style.lineHeight = '1';
                    slot.appendChild(countTag);
                }
            }
            gridContainer.appendChild(slot);
        }
        return true;
    }

    // --- LÓGICA DEL HORNO ---
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

            // Extractor Inteligente (Detecta si es Array u Objeto)
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
                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;

                if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                    ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
                    let maxDur = typeof maxDurabilityMap !== 'undefined' ? maxDurabilityMap[itemID] : null;
                    if (maxDur && typeof drawDurabilityBar === 'function') {
                        drawDurabilityBar(ctx, 0, 0, 16, 16, itemDamage, maxDur);
                    }
                } else {
                    ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
                }
                slot.appendChild(cvs);

                // --- APLICAR EFECTO MAGIA CON EL NUEVO SISTEMA MAESTRO ---
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

// --- FUNCIÓN DEL TOOLTIP FLOTANTE (Ahora mucho más limpia) ---
function updateChestTooltip(screenX, screenY) {
    const tooltip = document.getElementById('chest-tooltip-overlay');
    if (!tooltip) return;

    const blockState = typeof mbwom !== 'undefined' ? mbwom.getBlockState(mouse.worldX, mouse.worldY) : null;
    const gridContainer = document.getElementById('chest-tooltip-grid');

    // Usamos el Dibujante Universal. Si nos dice que dibujó algo (true), mostramos el tooltip
    if (renderChestOrOvenUI(blockState, gridContainer)) {
        tooltip.style.display = 'block';
        tooltip.style.left = screenX + 'px';
        tooltip.style.top = screenY + 'px';
    } else {
        tooltip.style.display = 'none';
    }
}

canvas.addEventListener("mousedown", function (event) {
    if (event.button == 0) mouse.left = true;
    if (event.button == 2) mouse.right = true;

    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('start', mouse.worldX, mouse.worldY);
    } 
    // NUEVO: Evento para la varita mágica
    else if (currentTool === 'magic' && mouse.left) {
        magicWandSelect(mouse.worldX, mouse.worldY);
    }
    else if (currentTool === 'paste' && mouse.left) {
        performPaste(mouse.worldX, mouse.worldY, event.shiftKey);
    }
    else if (mouse.left || mouse.right) {
        if (currentTool === 'bucket' && mouse.left) {
            bucketFill(mouse.worldX, mouse.worldY);
        } else if (currentTool !== 'eyedropper') {
            historyManager.startAction();
        }
    }
});

window.addEventListener("mouseup", function (event) {
    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('end', mouse.worldX, mouse.worldY);
    }

    if (event.button == 0) mouse.left = false;
    if (event.button == 2) mouse.right = false;

    if (currentTool !== 'eyedropper' && currentTool !== 'bucket' && currentTool !== 'select' && currentTool !== 'lasso' && currentTool !== 'paste') {
        historyManager.commitAction();
    }
});

canvas.addEventListener("mouseleave", function() {
    if (mouse.left || mouse.right) {
        if (currentTool !== 'select' && currentTool !== 'lasso') historyManager.commitAction();
        mouse.left = false;
        mouse.right = false;
    }
});

canvas.addEventListener("contextmenu", e => e.preventDefault());