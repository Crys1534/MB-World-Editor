// ✨ VARIABLES GLOBALES PARA MOBS ✨
let selectedMob = null;
let selectedMobKey = null;
let mobClipboard = null;
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
        this.alignedX = this.gridX * tileSize;
        this.alignedY = canvas.height - this.gridY * tileSize;
        this.worldX = Math.floor(camera.x) + this.gridX;
        this.worldY = Math.floor(camera.y) + this.gridY;
    }
}

function cameraMovement() {
    if (typeof camera.accX === 'undefined') { camera.accX = 0; camera.accY = 0; }
    let moveX = 0; let moveY = 0;

    if (keys.KeyW) moveY += camera.speed;
    if (keys.KeyS) moveY -= camera.speed;
    if (keys.KeyD) moveX += camera.speed;
    if (keys.KeyA) moveX -= camera.speed;

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
window.addEventListener("keydown", function (event) {
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
        teleportSwitch();
        event.preventDefault();
    }

    if (event.code === 'Delete' || event.code === 'Backspace') {
        if (typeof currentTool !== 'undefined' && currentTool === 'move' && selectedMobKey && typeof mbwom !== 'undefined' && mbwom.mobs && mbwom.mobs[selectedMobKey]) {
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
    
    // ✨ COPIAR CLON (Ctrl + C)
    if (isCtrl && event.code === 'KeyC') { 
        event.preventDefault(); 
        if (typeof currentTool !== 'undefined' && currentTool === 'move' && selectedMob) {
            mobClipboard = JSON.parse(JSON.stringify(selectedMob));
            console.log("Mob copiado nativamente:", mobClipboard.type);
        } else if (typeof copySelection === 'function') {
            copySelection(); 
        }
    }

    if (isCtrl && event.code === 'KeyX') { event.preventDefault(); if (typeof cutSelection === 'function') cutSelection(); }
    
    // ✨ PEGAR CLON (Ctrl + V)
    if (isCtrl && event.code === 'KeyV') { 
        event.preventDefault(); 
        if (typeof currentTool !== 'undefined' && currentTool === 'move' && mobClipboard) {
            if (typeof mbwom !== 'undefined') {
                if (!mbwom.mobs) mbwom.mobs = {};
                let newId = "mob_copy_" + Date.now() + Math.floor(Math.random() * 1000);
                
                let newMob = JSON.parse(JSON.stringify(mobClipboard));
                newMob.x = mouse.worldX;
                newMob.y = -mouse.worldY; 
                newMob.id = newId;
                
                mbwom.mobs[newId] = newMob;
                if (typeof worldDirty !== 'undefined') worldDirty = true;
            }
        } else if (typeof activatePasteMode === 'function') {
            activatePasteMode(); 
        }
    }

    if (event.code === 'KeyZ' && !isCtrl) { if (typeof setSelectionPoint === 'function') setSelectionPoint(1, mouse.worldX, mouse.worldY); }
    if (event.code === 'KeyX' && !isCtrl) { if (typeof setSelectionPoint === 'function') setSelectionPoint(2, mouse.worldX, mouse.worldY); }
    if (event.code === 'KeyC' && !isCtrl) { if (typeof eyedropper === 'function') eyedropper(mouse.worldX, mouse.worldY); }
    if (event.code === 'KeyE' && !isCtrl) { event.preventDefault(); try { toggleInventory(); } catch(e) { } }
    if (event.code === 'KeyR' && !isCtrl) { event.preventDefault(); try { openStructuresModal(); } catch(e) { } }
	if (event.code === 'KeyM' && !isCtrl) { event.preventDefault(); try { openMobModal(); } catch(e) { } }

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

// --- MOUSE MOVE ---
canvas.addEventListener("mousemove", (event) => {
    mouse.canvasX = event.offsetX;
    mouse.canvasY = canvas.height - event.offsetY;
    mouse.gridX = Math.floor(mouse.canvasX / tileSize);
    mouse.gridY = Math.floor(mouse.canvasY / tileSize);
    mouse.calculateCoordinates(); 

    if (typeof currentTool !== 'undefined' && currentTool === 'move' && isDraggingMob && draggedMob) {
        let exactWorldX = camera.x + (mouse.canvasX / tileSize);
        let exactWorldY = camera.y + (mouse.canvasY / tileSize);
        
        draggedMob.x = exactWorldX + dragOffset.x;
        draggedMob.y = -(exactWorldY + dragOffset.y); 
        if (typeof worldDirty !== 'undefined') worldDirty = true;
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
                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;

                if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                    ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
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
                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;

                if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                    ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
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

function updateChestTooltip(screenX, screenY) {
    const tooltip = document.getElementById('chest-tooltip-overlay');
    if (!tooltip) return;

    const blockState = typeof mbwom !== 'undefined' ? mbwom.getBlockState(mouse.worldX, mouse.worldY) : null;
    const gridContainer = document.getElementById('chest-tooltip-grid');

    if (renderChestOrOvenUI(blockState, gridContainer)) {
        tooltip.style.display = 'block';
        tooltip.style.left = screenX + 'px';
        tooltip.style.top = screenY + 'px';
    } else {
        tooltip.style.display = 'none';
    }
}

// --- CLICS PRINCIPALES (MOUSEDOWN) ---
canvas.addEventListener("mousedown", function (event) {
    if (event.button == 0) mouse.left = true;
    if (event.button == 2) mouse.right = true;

    // ✨ SELECCIONAR Y MOVER MOB (MOVE)
    if (currentTool === 'move' && mouse.left) {
        let clickedOnMob = false;
        let exactWorldX = camera.x + (mouse.canvasX / tileSize);
        let exactWorldY = camera.y + (mouse.canvasY / tileSize);

        if (typeof mbwom !== 'undefined' && mbwom.mobs) {
            for (let key in mbwom.mobs) {
                let m = mbwom.mobs[key];
                let img = window.images[m.type];
                if (!img || !img.complete) continue;

                let mobWidth = img.naturalWidth / 16;
                let mobHeight = img.naturalHeight / 16;

                let minX = Number(m.x) - (mobWidth / 2);
                let maxX = Number(m.x) + (mobWidth / 2);
                let minY = -Number(m.y);
                let maxY = -Number(m.y) + mobHeight;

                if (exactWorldX >= minX && exactWorldX <= maxX && 
                    exactWorldY >= minY && exactWorldY <= maxY) {
                    
                    selectedMob = m;
                    selectedMobKey = key;
                    draggedMob = m;
                    isDraggingMob = true;
                    clickedOnMob = true;
                    
                    dragOffset.x = Number(m.x) - exactWorldX;
                    dragOffset.y = -Number(m.y) - exactWorldY;
                    
                    if (typeof toggleMobInfo === 'function') toggleMobInfo(true);
                    if (typeof worldDirty !== 'undefined') worldDirty = true;
                    break; 
                }
            }
        }

        if (!clickedOnMob) {
            selectedMob = null;
            selectedMobKey = null;
            if (typeof toggleMobInfo === 'function') toggleMobInfo(false);
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
    }
    // ✨ PONER UN MOB EN EL MUNDO (SPAWN CON LA PLANTILLA PERFECTA DEL CERDO)
    else if (currentTool === 'spawn_mob' && mouse.left) {
        if (typeof mbwom !== 'undefined') {
            if (!mbwom.mobs) mbwom.mobs = {};

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

            // Clonamos la plantilla universal perfecta para inyectarla al nivel
            mbwom.mobs[newId] = JSON.parse(JSON.stringify(BASE_MOB_TEMPLATE));

            if (typeof worldDirty !== 'undefined') worldDirty = true; 
            console.log("Mob generado desde Plantilla Perfecta:", baseType);
        }
    }
    // HERRAMIENTAS DE BLOQUES
    else if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('start', mouse.worldX, mouse.worldY);
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
        } else if (currentTool !== 'eyedropper') {
            historyManager.startAction();
        }
    }
});

// --- SOLTAR CLICS (MOUSEUP) ---
window.addEventListener("mouseup", function (event) {
    if (typeof isDraggingMob !== 'undefined' && isDraggingMob) {
        isDraggingMob = false;
        draggedMob = null;
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }

    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('end', mouse.worldX, mouse.worldY);
    }

    if (event.button == 0) mouse.left = false;
    if (event.button == 2) mouse.right = false;

    if (currentTool !== 'eyedropper' && currentTool !== 'bucket' && currentTool !== 'select' && currentTool !== 'lasso' && currentTool !== 'paste' && currentTool !== 'move' && currentTool !== 'spawn_mob') {
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