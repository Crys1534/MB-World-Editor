let shapeIndex = 0;
let slotIndex = 0;
let currentTool = 'pencil'; 
let toolSize = 1;  
let toolRounded = false;
let toolSpray = false; // NUEVO: Estado del modo Spray
let isShiftPressed = false; 

// Estructura actualizada para soportar múltiples selecciones
// Agregamos points y pointSet para manejar la varita mágica
window.selection = { 
    p1: null, 
    p2: null, 
    path: [], 
    type: 'rect', 
    dragging: false, 
    subRects: [],
    points: [], 
    pointSet: new Set() 
};
// (window.clipboard — el portapapeles — se declara en scripts/clipboard.js)

// Detectores globales de Shift
window.addEventListener('keydown', (e) => { if(e.key === 'Shift') isShiftPressed = true; });
window.addEventListener('keyup', (e) => { if(e.key === 'Shift') isShiftPressed = false; });

// --- Verificar estado del botón Guardar ---
function checkSelectionState() {
    const btn = document.getElementById('btn-save-struct');
    if (!btn) return;

    let hasSelection = false;
    if (window.selection.type === 'rect' && ((window.selection.p1 && window.selection.p2) || window.selection.subRects.length > 0)) {
        hasSelection = true;
    } else if (window.selection.type === 'poly' && window.selection.path.length > 2) {
        hasSelection = true;
    } else if (window.selection.type === 'magic' && window.selection.points.length > 0) {
        // Validamos la selección mágica
        hasSelection = true;
    }

    if (hasSelection) {
        btn.disabled = false;
        btn.title = "Save selected area";
        btn.style.filter = "none";
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    } else {
        btn.disabled = true;
        btn.title = "Select an area first to save";
        btn.style.filter = "grayscale(100%)";
        btn.style.opacity = "0.4";
        btn.style.cursor = "not-allowed";
    }
}

function selectTool(toolName) {
    currentTool = toolName;
    if (typeof hideMobDropsTip === 'function') hideMobDropsTip();   // el cuadro de drops de un mob solo existe con la herramienta Move
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    
    // ✨ FIX: Si es una forma, activamos el botón agrupado. Si no, buscamos el botón normal.
    let btnId = ['line', 'rect-shape', 'circle'].includes(toolName) ? 'tool-shapes-main' : 'tool-' + toolName;
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
    
    const selOverlay = document.getElementById('selection-overlay');
    if (selOverlay) selOverlay.style.display = 'none';

    // Reseteamos las selecciones
    if (toolName !== 'select' && toolName !== 'lasso') {
        window.selection.dragging = false; 
        window.selection.path = []; 
        window.selection.p1 = null; 
        window.selection.p2 = null;
        window.selection.subRects = [];
    }
    
    // `shapeState` ya no se define en ningún archivo (era de una versión vieja de las formas).
    // Sin este "if", selectTool() fallaba con un error en cada cambio de herramienta y nunca
    // llegaba a la línea de abajo (que actualiza el botón de "guardar estructura").
    if (window.shapeState) {
        window.shapeState.isDrawing = false;
        window.shapeState.startX = null;
    }
    
    setTimeout(checkSelectionState, 10);
}

function updateSelectionInfo() {
    const overlay = document.getElementById('selection-overlay');
    if (!overlay) return;
    
    let width = 0; let height = 0;
    if (window.selection.type === 'rect' && window.selection.p1 && window.selection.p2) {
        width = Math.abs(window.selection.p1.x - window.selection.p2.x) + 1;
        height = Math.abs(window.selection.p1.y - window.selection.p2.y) + 1;
    } else if (window.selection.type === 'poly' && window.selection.path.length > 0) {
        const xs = window.selection.path.map(p => p.x); const ys = window.selection.path.map(p => p.y);
        width = (Math.max(...xs) - Math.min(...xs)) + 1;
        height = (Math.max(...ys) - Math.min(...ys)) + 1;
    } else {
        overlay.style.display = 'none'; return;
    }
    overlay.innerText = `W: ${width} H: ${height}`; overlay.style.display = 'block';
}

function updateToolSize(val, source) {
    let size = parseInt(val); 
    
    // Si el cuadro está vacío porque el usuario borró el número para escribir otro, esperamos.
    if (isNaN(size)) {
        if (source === 'blur') size = 1; // Si da clic afuera estando vacío, lo regresamos a 1
        else return; 
    }
    
    // Frenos de seguridad
    if (size < 1) size = 1; 
    if (size > 100) size = 100; 
    
    toolSize = size;
    
    const display = document.getElementById('tool-size-display');
    const slider = document.getElementById('tool-size-slider');
    
    // ✨ LA MAGIA DE LA SINCRONIZACIÓN: Solo actualizamos el que NO estemos usando.
    if (source === 'slider' && display) {
        display.value = toolSize; // Si movemos la barra, cambiamos el texto
    } 
    else if (source === 'display' && slider) {
        slider.value = toolSize; // Si escribimos en el texto, movemos la barra
    }
    else if (source === 'blur' && display) {
        // Al terminar de escribir y dar clic afuera, aplicamos límites visuales
        display.value = toolSize; 
        if (slider) slider.value = toolSize;
    }
}

function updateToolRounded(isRounded) { toolRounded = isRounded; }
function updateToolSpray(isSpray) { toolSpray = isSpray; } // NUEVA FUNCIÓN

// --- GESTIÓN DE ATAJOS DE TECLADO ---
window.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === '+' || e.code === 'NumpadAdd') updateToolSize(toolSize + 1);
    if (e.key === '-' || e.code === 'NumpadSubtract') updateToolSize(toolSize - 1);
    if (e.key === 'Delete' || e.code === 'Delete') deleteSelection();
});

// --- NUEVO SISTEMA DE SCREENSHOT CON RECORTE Y SCROLL (WASD + ZOOM) ---
let snipState = {
    active: false, isDragging: false,
    startX: 0, startY: 0, currentX: 0, currentY: 0,
    camX: 0, camY: 0,
    keys: {},
    camLoop: null, tileSize: 16
};

// ✨ BLOQUEO GLOBAL DE TECLAS (Evita que el juego principal se mueva)
if (!window.snipKeysAttached) {
    window.addEventListener('keydown', (e) => {
        if (snipState.active) {
            const k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
                snipState.keys[k] = true;
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }
    }, { capture: true });

    window.addEventListener('keyup', (e) => {
        if (snipState.active) {
            const k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
                snipState.keys[k] = false;
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }
    }, { capture: true });
    window.snipKeysAttached = true;
}

window.takeScreenshot = function() {
    initSnippingUI();
    snipState.active = true;
    snipState.keys = {}; 
    snipState.tileSize = 16; // Restablecer el zoom al abrir
    
    const zoomBtn = document.getElementById('btn-snip-zoom');
    if (zoomBtn) zoomBtn.innerText = `Zoom: 16x`;
    
    snipState.camX = (typeof camera !== 'undefined' ? Math.floor(camera.x) : 0);
    snipState.camY = (typeof camera !== 'undefined' ? Math.floor(camera.y) : 0);
    
    document.getElementById('snip-modal').style.display = 'flex';
    renderSnipPreview();
    
    if (!snipState.camLoop) {
        snipState.camLoop = requestAnimationFrame(snipCamLoop);
    }
};

function initSnippingUI() {
    if (document.getElementById('snip-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'snip-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:999999; display:none; flex-direction:column; align-items:center; justify-content:center;';

    modal.innerHTML = `
        <div style="color:white; font-family:'Pixeltype', sans-serif; font-size:32px; margin-bottom:10px; text-shadow:2px 2px 0 #000;">
            📷 Select Area to Capture <span style="font-size:18px; color:#aaa;">(Use WASD to move)</span>
        </div>
        <div id="snip-container" style="position:relative; width:80vw; height:70vh; border:4px solid #555; background:#7385b9; overflow:hidden; cursor:crosshair; box-shadow:0 10px 30px rgba(0,0,0,0.8);">
            <canvas id="snip-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; image-rendering:pixelated;"></canvas>
        </div>
        <div style="margin-top:15px; display:flex; gap:15px;">
            <button onclick="confirmScreenshot()" style="background:#2ecc71; color:white; border:none; padding:10px 20px; font-family:'Pixeltype', sans-serif; font-size:24px; border-radius:4px; cursor:pointer;">Download Image</button>
            <button id="btn-snip-zoom" onclick="cycleSnipZoom()" style="background:#3498db; color:white; border:none; padding:10px 20px; font-family:'Pixeltype', sans-serif; font-size:24px; border-radius:4px; cursor:pointer;">Zoom: 16x</button>
            <button onclick="closeSnippingUI()" style="background:#e74c3c; color:white; border:none; padding:10px 20px; font-family:'Pixeltype', sans-serif; font-size:24px; border-radius:4px; cursor:pointer;">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);

    const cvs = document.getElementById('snip-canvas');
    
    // Anula el menú del clic derecho
    cvs.addEventListener('contextmenu', (e) => e.preventDefault());
    
    function getMouseGridCoords(e) {
        const rect = cvs.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        const wx = Math.floor(mx / snipState.tileSize) + Math.floor(snipState.camX);
        const wy = Math.floor((cvs.height - my) / snipState.tileSize) + Math.floor(snipState.camY);
        return {wx, wy};
    }

    cvs.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // ✨ FILTRO DE CLIC IZQUIERDO
        
        cvs.width = cvs.parentElement.clientWidth;
        cvs.height = cvs.parentElement.clientHeight;
        snipState.isDragging = true;
        
        const coords = getMouseGridCoords(e);
        snipState.startX = coords.wx;
        snipState.startY = coords.wy;
        snipState.currentX = coords.wx;
        snipState.currentY = coords.wy;
        renderSnipPreview();
    });

    window.addEventListener('mousemove', (e) => {
        if (!snipState.active) return;
        if (snipState.isDragging) {
            const coords = getMouseGridCoords(e);
            snipState.currentX = coords.wx;
            snipState.currentY = coords.wy;
            renderSnipPreview();
        }
    });

    window.addEventListener('mouseup', () => { 
        if (snipState.active) snipState.isDragging = false; 
    });
}

// ✨ FUNCIÓN PARA CICLAR EL ZOOM
window.cycleSnipZoom = function() {
    const levels = [16, 8, 4, 2, 1];
    let idx = levels.indexOf(snipState.tileSize);
    idx = (idx + 1) % levels.length;
    snipState.tileSize = levels[idx];
    
    const btn = document.getElementById('btn-snip-zoom');
    if (btn) btn.innerText = `Zoom: ${snipState.tileSize}x`;
    
    renderSnipPreview();
};

window.closeSnippingUI = function() {
    document.getElementById('snip-modal').style.display = 'none';
    snipState.active = false;
    snipState.isDragging = false;
};

function snipCamLoop() {
    if (snipState.active) {
        const speed = (16 / snipState.tileSize) * 0.5; // Ajusta la velocidad según el zoom
        let moved = false;

        if (snipState.keys['w'] || snipState.keys['arrowup']) { snipState.camY += speed; moved = true; }
        if (snipState.keys['s'] || snipState.keys['arrowdown']) { snipState.camY -= speed; moved = true; }
        if (snipState.keys['a'] || snipState.keys['arrowleft']) { snipState.camX -= speed; moved = true; }
        if (snipState.keys['d'] || snipState.keys['arrowright']) { snipState.camX += speed; moved = true; }

        if (moved) renderSnipPreview();
        
        snipState.camLoop = requestAnimationFrame(snipCamLoop);
    } else {
        snipState.camLoop = null;
    }
}

function renderSnipPreview() {
    const cvs = document.getElementById('snip-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    
    cvs.width = cvs.parentElement.clientWidth;
    cvs.height = cvs.parentElement.clientHeight;

    ctx.fillStyle = '#7385b9';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.imageSmoothingEnabled = false;

    const startWX = Math.floor(snipState.camX);
    const startWY = Math.floor(snipState.camY);
    const endWX = Math.ceil(snipState.camX + cvs.width / snipState.tileSize);
    const endWY = Math.ceil(snipState.camY + cvs.height / snipState.tileSize);

    if (typeof mbwom !== 'undefined' && mbwom.scene) {
        for (let x = startWX; x <= endWX; x++) {
            if (!mbwom.scene[x]) continue;
            for (let y = startWY; y <= endWY; y++) {
                let rawBlock = typeof mbwom.getBlockState === 'function' ? mbwom.getBlockState(x, y) : mbwom.scene[x][y];
                
                if (!rawBlock || !rawBlock.type || rawBlock.type === 'air' || rawBlock.type === 0 || rawBlock.type === '0') continue;

                let safeState = { type: rawBlock.type };
                if (rawBlock.states1 !== undefined) safeState.states1 = rawBlock.states1;

                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(safeState) : null;
                if (!renderObj && window.blockData && window.blockData[safeState.type]) {
                    renderObj = window.blockData[safeState.type](safeState);
                }
                if (!renderObj) continue;

                const drawX = (x - Math.floor(snipState.camX)) * snipState.tileSize;
                const drawY = cvs.height - ((y - Math.floor(snipState.camY)) * snipState.tileSize) - snipState.tileSize;

                if (window.images && window.images.blocks && window.images.blocks.complete) {
                    ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, drawX, drawY, snipState.tileSize, snipState.tileSize);
                }
            }
        }
    }

    if (snipState.isDragging || (snipState.startX !== 0 || snipState.startY !== 0)) {
        const minX = Math.min(snipState.startX, snipState.currentX);
        const maxX = Math.max(snipState.startX, snipState.currentX);
        const minY = Math.min(snipState.startY, snipState.currentY);
        const maxY = Math.max(snipState.startY, snipState.currentY);

        const boxX = (minX - Math.floor(snipState.camX)) * snipState.tileSize;
        const boxY = cvs.height - ((maxY - Math.floor(snipState.camY)) * snipState.tileSize) - snipState.tileSize;
        const boxW = (maxX - minX + 1) * snipState.tileSize;
        const boxH = (maxY - minY + 1) * snipState.tileSize;

        ctx.fillStyle = 'rgba(52, 152, 219, 0.4)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
    }
}

window.confirmScreenshot = function() {
    if (snipState.startX === snipState.currentX && snipState.startY === snipState.currentY) {
        alert("Please drag to select an area first!");
        return;
    }

    const minX = Math.floor(Math.min(snipState.startX, snipState.currentX));
    const maxX = Math.floor(Math.max(snipState.startX, snipState.currentX));
    const minY = Math.floor(Math.min(snipState.startY, snipState.currentY));
    const maxY = Math.floor(Math.max(snipState.startY, snipState.currentY));

    const exportSize = 16;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = (maxX - minX + 1) * exportSize;
    finalCanvas.height = (maxY - minY + 1) * exportSize;
    const ctx = finalCanvas.getContext('2d');
    
    ctx.fillStyle = '#7385b9';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    ctx.imageSmoothingEnabled = false;

    if (typeof mbwom !== 'undefined' && mbwom.scene) {
        for (let x = minX; x <= maxX; x++) {
            if (!mbwom.scene[x]) continue;
            for (let y = minY; y <= maxY; y++) {
                let rawBlock = typeof mbwom.getBlockState === 'function' ? mbwom.getBlockState(x, y) : mbwom.scene[x][y];
                
                if (!rawBlock || !rawBlock.type || rawBlock.type === 'air' || rawBlock.type === 0 || rawBlock.type === '0') continue;

                let safeState = { type: rawBlock.type };
                if (rawBlock.states1 !== undefined) safeState.states1 = rawBlock.states1;

                let renderObj = typeof getBlockObject === 'function' ? getBlockObject(safeState) : null;
                if (!renderObj && window.blockData && window.blockData[safeState.type]) {
                    renderObj = window.blockData[safeState.type](safeState);
                }
                if (!renderObj) continue;

                const drawX = (x - minX) * exportSize;
                const drawY = (maxY - y) * exportSize;

                if (window.images && window.images.blocks && window.images.blocks.complete) {
                    ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, drawX, drawY, exportSize, exportSize);
                }
            }
        }
    }

    const imageBase64 = finalCanvas.toDataURL("image/png");
    const date = new Date();
    const pad = num => num.toString().padStart(2, '0');
    const filename = `MBW_Snip_${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;

    const link = document.createElement("a");
    link.href = imageBase64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    closeSnippingUI();
};

function isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function isPointSelected(x, y) {
    // NUEVO: Compatibilidad con la Varita Mágica
    if (window.selection.type === 'magic') {
        return window.selection.pointSet.has(x + "," + y);
    }

    if (window.selection.type === 'poly' && window.selection.path.length > 2) {
        for (let i = 0; i < window.selection.path.length; i++) {
            if (window.selection.path[i].x === x && window.selection.path[i].y === y) return true;
        }
        return isPointInPolygon(x + 0.5, y + 0.5, window.selection.path);
    }
    
    if (window.selection.p1 && window.selection.p2) {
        const minX = Math.min(window.selection.p1.x, window.selection.p2.x);
        const maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
        const minY = Math.min(window.selection.p1.y, window.selection.p2.y);
        const maxY = Math.max(window.selection.p1.y, window.selection.p2.y);
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
    }

    if (window.selection.subRects && window.selection.subRects.length > 0) {
        for (let r of window.selection.subRects) {
            const minX = Math.min(r.p1.x, r.p2.x);
            const maxX = Math.max(r.p1.x, r.p2.x);
            const minY = Math.min(r.p1.y, r.p2.y);
            const maxY = Math.max(r.p1.y, r.p2.y);
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
        }
    }
    return false;
}

function getSelectionBounds() {
    // NUEVO: Varita mágica
    if (window.selection.type === 'magic' && window.selection.points.length > 0) {
        return { 
            minX: window.selection.p1.x, maxX: window.selection.p2.x, 
            minY: window.selection.p1.y, maxY: window.selection.p2.y 
        };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    if (window.selection.type === 'poly' && window.selection.path.length > 0) {
        const xs = window.selection.path.map(p => p.x); const ys = window.selection.path.map(p => p.y);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    }

    const allRects = [...window.selection.subRects];
    if (window.selection.p1 && window.selection.p2) {
        allRects.push({ p1: window.selection.p1, p2: window.selection.p2 });
    }

    if (allRects.length === 0) return null;

    allRects.forEach(r => {
        minX = Math.min(minX, r.p1.x, r.p2.x);
        maxX = Math.max(maxX, r.p1.x, r.p2.x);
        minY = Math.min(minY, r.p1.y, r.p2.y);
        maxY = Math.max(maxY, r.p1.y, r.p2.y);
    });

    return { minX, maxX, minY, maxY };
}

// Agregamos un parámetro extra: isCtrlPressed
window.handleSelectionInput = function(action, worldX, worldY, isCtrlPressed = false) {
    // Detectar dinámicamente si estamos usando Lasso o Select cuadrado
    let selType = (typeof currentTool !== 'undefined' && currentTool === 'lasso') ? 'poly' : 'rect';

    if (action === 'start') {
        if (!isCtrlPressed) {
            window.selection = {
                type: selType, 
                p1: { x: worldX, y: worldY },
                p2: { x: worldX, y: worldY },
                subRects: [],
                pointSet: new Set(),
                path: [{ x: worldX, y: worldY }],
                dragging: true
            };
        } 
        else {
            if (!window.selection || window.selection.type !== selType) {
                window.selection = { 
                    type: selType, subRects: [], pointSet: new Set(), path: [{ x: worldX, y: worldY }],
                    p1: { x: worldX, y: worldY }, p2: { x: worldX, y: worldY }, dragging: true 
                };
            } else {
                if (selType === 'rect' && window.selection.p1 && window.selection.p2) {
                    window.selection.subRects.push({ 
                        p1: { ...window.selection.p1 }, p2: { ...window.selection.p2 } 
                    });
                }
                window.selection.p1 = { x: worldX, y: worldY };
                window.selection.p2 = { x: worldX, y: worldY };
                if (selType === 'poly') window.selection.path = [{ x: worldX, y: worldY }];
                window.selection.dragging = true;
            }
        }
    } 
    else if (action === 'move' && window.selection && window.selection.dragging) {
        window.selection.p2 = { x: worldX, y: worldY };
        
        // La magia del Lasso (Free Form)
        if (window.selection.type === 'poly') {
            let path = window.selection.path;
            let lastPoint = path[path.length - 1];
            if (!lastPoint || lastPoint.x !== worldX || lastPoint.y !== worldY) {
                path.push({ x: worldX, y: worldY });
            }
        }
        window.worldDirty = true;
    } 
    else if (action === 'end' && window.selection) {
        window.selection.dragging = false;
        
        // Auto-cerrar el Lasso
        if (window.selection.type === 'poly' && window.selection.path.length > 2) {
            let firstPoint = window.selection.path[0];
            let lastPoint = window.selection.path[window.selection.path.length - 1];
            if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
                window.selection.path.push({ x: firstPoint.x, y: firstPoint.y });
            }
        }
        
        window.worldDirty = true;
        if (typeof updateSelectionInfo === 'function') updateSelectionInfo();
        if (typeof checkSelectionState === 'function') checkSelectionState();
    }
};

function setSelectionPoint(point, x, y) {
    window.selection.type = 'rect'; 
    if (point === 1) window.selection.p1 = { x, y };
    if (point === 2) window.selection.p2 = { x, y };
    updateSelectionInfo(); checkSelectionState(); 
}

// 📋 copySelection() y cutSelection() ahora viven en scripts/clipboard.js

function deleteSelection(isFromNetwork = false, networkDeletedBlocks = [], networkDeletedMobs = [], alsoBlocksInLasso = false) {
    // Si la orden viene de internet, solo borramos lo que nos indica el amigo
    if (isFromNetwork) {
        if (typeof mbwom !== 'undefined' && mbwom.scene) {
            networkDeletedBlocks.forEach(pos => {
                if (mbwom.scene[pos.x] && mbwom.scene[pos.x][pos.y]) {
                    delete mbwom.scene[pos.x][pos.y];
                    if (typeof renderBlock === 'function') renderBlock(pos.x, pos.y);
                }
            });
            networkDeletedMobs.forEach(key => { delete mbwom.mobs[key]; });
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
        return;
    }

    const bounds = getSelectionBounds();
    if (!bounds && window.selection.type !== 'poly') return;

    historyManager.startAction();
    let changed = false;
    let deletedBlocksToSync = [];
    let deletedMobsToSync = [];
    const isLasso = window.selection.type === 'poly';

    // LAZO: borra los MOBS de dentro (con historial: Ctrl+Z los devuelve). Los bloques solo se cortan con Ctrl+X (alsoBlocksInLasso).
    if (isLasso) {
        if (typeof mbwom !== 'undefined' && mbwom.mobs) {
            for (let key in mbwom.mobs) {
                let m = mbwom.mobs[key];
                if (!m) continue;
                let mobWorldX = Math.round(Number(m.x));
                let mobWorldY = Math.round(-Number(m.y)); 
                if (isPointSelected(mobWorldX, mobWorldY)) {
                    historyManager.recordMobChange(key, m, null);
                    delete mbwom.mobs[key]; 
                    changed = true;
                    deletedMobsToSync.push(key);
                }
            }
        }
        if (changed && typeof worldDirty !== 'undefined') worldDirty = true;
    }

    // SELECT / VARITA: borran los BLOQUES. LAZO: solo cuando se corta (Ctrl+X).
    if ((!isLasso || alsoBlocksInLasso) && bounds) {
        let blocksChanged = false;
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                if (!isPointSelected(x, y)) continue;
                blocksChanged = true; 
                if (mbwom.scene[x] && mbwom.scene[x][y]) {
                    // Se guarda el estado COMPLETO del bloque (cofres con objetos, variantes...), no solo su nombre: así Ctrl+Z lo devuelve igual
                    historyManager.recordChange(x, y, mbwom.getBlockState(x, y), null);
                    delete mbwom.scene[x][y];
                    renderBlock(x, y);
                    deletedBlocksToSync.push({x: x, y: y}); // Recolectamos para la red
                }
            }
        }
        if (blocksChanged) changed = true;

        // Recortamos las columnas
        if (blocksChanged && typeof mbwom !== 'undefined' && mbwom.scene) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                let col = mbwom.scene[x];
                if (!col || !Array.isArray(col)) continue;
                for (let y = bounds.minY; y <= bounds.maxY; y++) {
                    if (isPointSelected(x, y)) {
                        let b = col[y];
                        if (b && (b.type === "air" || b.type === 0 || b.type === "0" || b.type === "")) col[y] = null; 
                    }
                }
                while (col.length > 0) {
                    let ultimoBloque = col[col.length - 1];
                    if (!ultimoBloque || ultimoBloque.type === null || ultimoBloque.type === "air" || ultimoBloque.type === 0 || ultimoBloque.type === "") {
                        col.pop(); 
                    } else break; 
                }
            }
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
    }

    // ✨ MULTIPLAYER: Avisar a la red lo que borramos
    if (typeof enviarMensajeEnRed === 'function') {
        if (deletedBlocksToSync.length > 0 || deletedMobsToSync.length > 0) {
            enviarMensajeEnRed({ 
                tipo: "accion_borrar_seleccion", 
                bloques: deletedBlocksToSync, 
                mobs: deletedMobsToSync 
            });
        }
    }

    historyManager.commitAction();
    const overlay = document.getElementById('selection-overlay');
    if (overlay) overlay.style.display = 'none';
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = []; window.selection.subRects = [];
    checkSelectionState(); 
}

// 📋 activatePasteMode() y performPaste() ahora viven en scripts/clipboard.js

const hotbar = { offset: { x: 0, y: 0 }, slots: [{ type: "dt" }, { type: "dt_1" }, { type: "ib" }, { type: "clb" }, { type: "tob" }, { type: "lapb" }, { type: "wp" }, { type: "fire" }, { type: "b" }] }

function eyedropper(x, y) {
 const states = mbwom.getBlockState(x, y);
 if (states && states.type != null) {
     hotbar.slots[slotIndex] = structuredClone(states);
     if (typeof renderHotbarUI === 'function') renderHotbarUI();
 }
}

// === ROTAR EL BLOQUE DE LA BARRA RÁPIDA (botón "Rotate" y tecla R) ===
// Se gira el bloque que traes en la mano (el de la casilla elegida de la barra rápida), SIN tener que copiarlo con Select.
// Cada vez que se rota, el bloque pasa a la siguiente variante de su "familia" (siempre en el sentido del reloj).
// La variante es el número states1 del bloque (ver scripts/clipboard.js para saber qué significa cada número).
const ROTATE_CYCLES = {
    stair:  [1, 2, 4, 3],   // la esquina vacía de la escalera va: arriba-izquierda -> arriba-derecha -> abajo-derecha -> abajo-izquierda
    slab:   [1, 2],         // losa: abajo <-> arriba (en el juego no existen losas verticales)
    facing: [3, 2, 4, 1],   // dispenser y dropper: arriba -> derecha -> abajo -> izquierda
    wall:   [1, 2, 3]       // palanca y botón (solo tienen 2 dibujos, así que alternan 1 <-> 2)
};
window.ROTATE_CYCLES = ROTATE_CYCLES;

// Estos bloques NO se giran con Rotate (ni con el botón ni con la tecla R): las antorchas (th, ortorch, rstorch) y la linterna (lant).
// Ojo: Mirror sí los sigue volteando (clipboard.js); esto solo afecta a Rotate.
const ROTATE_EXCLUDED_TYPES = ['th', 'ortorch', 'rstorch', 'lant'];
window.ROTATE_EXCLUDED_TYPES = ROTATE_EXCLUDED_TYPES;

// ¿Este bloque tiene una variante que se pueda girar?
function canRotateBlock(state) {
    if (!state || typeof variantFamilyFor !== 'function') return false;
    if (ROTATE_EXCLUDED_TYPES.includes(state.type)) return false;
    return !!variantFamilyFor(state.type);
}
window.canRotateBlock = canRotateBlock;

// Cambia states1 de `state` a la siguiente variante. Devuelve true si cambió algo.
function rotateBlockVariant(state) {
    if (!canRotateBlock(state)) return false;
    const cycle = ROTATE_CYCLES[variantFamilyFor(state.type)];
    if (!cycle) return false;
    const raw = state.states1;
    // Un bloque sin variante (o con un número raro) cuenta como "la primera variante"
    const cur = (raw === undefined || raw === null || raw === '' || isNaN(Number(raw))) ? cycle[0] : Number(raw);
    let idx = cycle.indexOf(cur);
    if (idx < 0) idx = cycle.length - 1; // número desconocido: la siguiente es la primera del ciclo
    const tex = window.texturesMap || {};
    for (let i = 1; i <= cycle.length; i++) {
        const cand = cycle[(idx + i) % cycle.length];
        if (cand === cur) continue;
        // Solo variantes que de verdad tienen dibujo (la palanca, por ejemplo, solo tiene 2)
        if (!tex[state.type + '_' + cand]) continue;
        state.states1 = (typeof raw === 'string' && raw !== '') ? String(cand) : cand;   // si venía como texto ("2") sigue siendo texto
        return true;
    }
    return false;
}
window.rotateBlockVariant = rotateBlockVariant;

// Rota el bloque de la casilla elegida de la barra rápida. Devuelve true si cambió.
function rotateHeldBlock() {
    const slot = hotbar.slots[slotIndex];
    if (!slot) return false;
    const copy = structuredClone(slot);
    if (!rotateBlockVariant(copy)) return false;
    hotbar.slots[slotIndex] = copy;
    if (typeof renderHotbarUI === 'function') renderHotbarUI();
    if (typeof worldDirty !== 'undefined') worldDirty = true;
    return true;
}
window.rotateHeldBlock = rotateHeldBlock;

// Herramientas que ponen el bloque de la barra rápida. Si el botón Rotate se usa con otra herramienta (Select, Move, Paste...),
// se cambia al Lápiz para que se vea el bloque girado.
const TOOLS_USING_HOTBAR_BLOCK = ['pencil', 'bucket', 'line', 'rect-shape', 'circle'];
function rotateFromButton() {
    if (!canRotateBlock(hotbar.slots[slotIndex])) return false;   // este bloque no se gira: no pasa nada (ni cambia de herramienta)
    if (typeof currentTool !== 'undefined' && !TOOLS_USING_HOTBAR_BLOCK.includes(currentTool) && typeof selectTool === 'function') selectTool('pencil');
    return rotateHeldBlock();
}
// El botón Rotate se ve apagado cuando el bloque de la mano no se puede girar (tierra, antorchas, linterna, casilla vacía…)
let _rotateBtnState = null;
function updateRotateButtonState() {
    const btn = document.getElementById('btn-rotate');
    if (!btn || typeof hotbar === 'undefined' || !hotbar.slots) return;
    const ok = canRotateBlock(hotbar.slots[slotIndex]);
    if (ok === _rotateBtnState) return;
    _rotateBtnState = ok;
    btn.classList.toggle('rotate-unavailable', !ok);
    btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
}
window.updateRotateButtonState = updateRotateButtonState;
window.rotateFromButton = rotateFromButton;

// === HERRAMIENTA BORRADOR ===
function eraser(cx, cy) {
    const offsetStart = Math.floor(toolSize / 2);
    const offsetEnd = Math.floor((toolSize - 1) / 2);
    const centerX = cx - offsetStart + (toolSize - 1) / 2;
    const centerY = cy - offsetStart + (toolSize - 1) / 2;
    const radiusSq = (toolSize / 2) ** 2;

    for (let x = cx - offsetStart; x <= cx + offsetEnd; x++) {
        for (let y = cy - offsetStart; y <= cy + offsetEnd; y++) {
            if (toolRounded && ((x - centerX)**2 + (y - centerY)**2 > radiusSq)) continue;
            
            if (mbwom.scene[x]?.[y]) {
                // Estado COMPLETO del bloque (no solo su nombre): así Ctrl+Z devuelve también cofres con objetos, variantes, etc.
                historyManager.recordChange(x, y, mbwom.getBlockState(x, y), null);
                delete mbwom.scene[x][y]; 
                renderBlock(x, y);
                if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: "actualizar_bloque", x, y, estado: null });
            }
        }
    }
}

// Variante de un bloque (states1): 0, '', null y undefined significan "sin variante".
function blockVariantKey(state) {
    const v = state ? state.states1 : undefined;
    if (v === undefined || v === null || v === '' || v === 0 || v === '0') return '';
    return String(v);
}
// ¿Es EXACTAMENTE el mismo bloque (mismo tipo y misma variante)? Si no, el Lápiz y la Cubeta sí lo cambian.
function sameBlockKind(a, b) {
    return !!a && !!b && a.type === b.type && blockVariantKey(a) === blockVariantKey(b);
}

// === HERRAMIENTA PINCEL ===
function brush(cx, cy) {
    const target = hotbar.slots[slotIndex];
    
    if (toolSize === 1) {
         const current = mbwom.getBlockState(cx, cy);
         if (sameBlockKind(current, target)) return;
         
         historyManager.recordChange(cx, cy, current, target);
         mbwom.setBlockState(cx, cy, target); 
         renderBlock(cx, cy);
         
         if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: "actualizar_bloque", x: cx, y: cy, estado: target });
         return;
    }

    const offsetStart = Math.floor(toolSize / 2);
    const offsetEnd = Math.floor((toolSize - 1) / 2);
    const centerX = cx - offsetStart + (toolSize - 1) / 2;
    const centerY = cy - offsetStart + (toolSize - 1) / 2;
    const radiusSq = (toolSize / 2) ** 2;

    for (let x = cx - offsetStart; x <= cx + offsetEnd; x++) {
        for (let y = cy - offsetStart; y <= cy + offsetEnd; y++) {
            if (toolRounded && ((x - centerX)**2 + (y - centerY)**2 > radiusSq)) continue;
            if (toolSpray && Math.random() > 0.1) continue;
            
            const current = mbwom.getBlockState(x, y);
            if (sameBlockKind(current, target)) continue;
            
            historyManager.recordChange(x, y, current, target);
            mbwom.setBlockState(x, y, target); 
            renderBlock(x, y);
            
            if (typeof enviarMensajeEnRed === 'function') enviarMensajeEnRed({ tipo: "actualizar_bloque", x, y, estado: target });
        }
    }
}

// Casillas entre dos puntos (línea de Bresenham). No incluye el primero y sí el último.
function cellsBetween(x0, y0, x1, y1) {
    const pts = [];
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (x !== x1 || y !== y1) {
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
        pts.push([x, y]);
    }
    return pts;
}

// Dónde estaba el mouse en el cuadro anterior mientras se pintaba/borraba (para unir los dos puntos si se movió rápido)
let strokePrev = null;

function mineAndPlace() {
    const paints = (currentTool === 'pencil' || currentTool === 'eraser') && (mouse.left || mouse.right);
    if (!paints || mouse.worldX == null || mouse.worldY == null) { strokePrev = null; return; }

    const x = mouse.worldX, y = mouse.worldY;
    let pts = [[x, y]];
    const p = strokePrev;
    // Con el mouse rápido, entre un cuadro y otro se saltaban casillas: se rellena la línea desde la posición anterior
    if (p && p.tool === currentTool && p.left === mouse.left && p.right === mouse.right && (p.x !== x || p.y !== y)) {
        if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= 400) pts = cellsBetween(p.x, p.y, x, y);
    }
    strokePrev = { x: x, y: y, tool: currentTool, left: mouse.left, right: mouse.right };

    for (let i = 0; i < pts.length; i++) {
        if (currentTool === 'pencil') {
            if (mouse.left) eraser(pts[i][0], pts[i][1]);
            if (mouse.right) brush(pts[i][0], pts[i][1]);
        } else {
            eraser(pts[i][0], pts[i][1]);
        }
    }
}

// ==========================================
// ✨ FIX GLOBAL DEL HISTORIAL (1 Clic = 1 Undo)
// ==========================================
window.addEventListener('mousedown', function(e) {
    if (e.target.id !== 'canvas' && e.target.tagName !== 'CANVAS') return;
    
    // Al presionar el ratón, ABRIMOS la bolsa del historial
    if (typeof historyManager !== 'undefined') {
        historyManager.startAction();
    }
});

window.addEventListener('mouseup', function(e) {
    // Al soltar el ratón, CERRAMOS la bolsa y la guardamos como 1 solo paso de Undo
    if (typeof historyManager !== 'undefined') {
        historyManager.commitAction();
    }
});

function magicWandSelect(startX, startY) {
    // 1. LÓGICA DE SHIFT: Si NO está presionado, o venimos de otra herramienta, limpiamos la selección
    if (!isShiftPressed || window.selection.type !== 'magic') {
        window.selection.points = [];
        window.selection.pointSet.clear();
    }
    
    window.selection.type = 'magic';
    window.selection.path = [];
    window.selection.subRects = [];
    window.selection.p1 = null;
    window.selection.p2 = null;

    const startBlock = mbwom.getBlockState(startX, startY);
    const startType = startBlock ? startBlock.type : null;
    
    const maxPixels = 50000; 
    let pixelsChanged = 0;
    
    const queue = [[startX, startY]]; 
    const visited = new Set();

    historyManager.startAction();

    while(queue.length > 0) {
        if (pixelsChanged > maxPixels) break;
        const [x, y] = queue.shift();
        const key = x + "," + y;
        
        if (visited.has(key)) continue; 
        visited.add(key);
        
        if (x < 0 || x > 6000 || y < 0 || y > 1000) continue; 

        const currentBlock = mbwom.getBlockState(x, y);
        const currentType = currentBlock ? currentBlock.type : null;
        
        if (currentType === startType) {
            // 2. EVITAR DUPLICADOS: Solo agregamos el bloque si no fue seleccionado en un Shift+Clic anterior
            if (!window.selection.pointSet.has(key)) {
                window.selection.points.push({x, y});
                window.selection.pointSet.add(key);
                pixelsChanged++;
            }

            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    // 3. RECALCULAR BOUNDING BOX: Calculamos los límites totales incluyendo las selecciones pasadas sumadas
    if (window.selection.points.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < window.selection.points.length; i++) {
            const p = window.selection.points[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        window.selection.p1 = { x: minX, y: minY };
        window.selection.p2 = { x: maxX, y: maxY };
    }

    updateSelectionInfo();
    checkSelectionState();
}

function bucketFill(startX, startY, isFromNetwork = false, networkState = null) {
    // Si viene de la red, usa la pintura del amigo, si no, usa nuestra hotbar
    const targetState = isFromNetwork ? networkState : hotbar.slots[slotIndex];
    
    // ✨ FIX: Función auxiliar para unificar todos los tipos de "vacío" o "aire"
    const isAir = (val) => val === undefined || val === null || val === "air" || val === 0 || val === "0" || val === "";
    
    const startBlock = mbwom.getBlockState(startX, startY);
    const startType = startBlock ? startBlock.type : null;
    const targetType = targetState ? targetState.type : null;

    const isStartAir = isAir(startType);
    const isTargetAir = isAir(targetType);

    // Evitar bucles infinitos si pintamos con lo mismo que ya hay o si ambos son "aire"
    const startVariant = blockVariantKey(startBlock);
    if ((isStartAir && isTargetAir) || (!isStartAir && startType === targetType && startVariant === blockVariantKey(targetState))) return;
    
    historyManager.startAction();
    const maxPixels = 2000; 
    let pixelsChanged = 0;
    const queue = [[startX, startY]]; 
    const visited = new Set();
    
    while(queue.length > 0) {
        if (pixelsChanged > maxPixels) break;
        const [x, y] = queue.shift();
        const key = x + "," + y;
        
        if (visited.has(key)) continue; 
        visited.add(key);
        
        // ✨ FIX: Límites dinámicos correctos (Cambiamos el símbolo a Y > 2000)
        const maxWidth = (mbwom.scene && mbwom.scene.length) ? mbwom.scene.length : 100000;
        if (x < 0 || x >= maxWidth || y < 0 || y > 2000) continue;
        
        const currentBlock = mbwom.getBlockState(x, y);
        const currentType = currentBlock ? currentBlock.type : null;
        const isCurrentAir = isAir(currentType);

        // Verificamos si es el mismo bloque original o si ambos son tipos de "aire"
        if ((isStartAir && isCurrentAir) || (!isStartAir && currentType === startType && blockVariantKey(currentBlock) === startVariant)) {
            historyManager.recordChange(x, y, currentBlock, targetState);
            
            // Si el bloque que pintamos es "aire" (borrador), eliminamos la referencia limpia
            if (isTargetAir) {
                if (mbwom.scene[x]) delete mbwom.scene[x][y];
            } else {
                mbwom.setBlockState(x, y, targetState);
            }
            
            if (typeof renderBlock === 'function') renderBlock(x, y);
            pixelsChanged++;
            
            // Agregamos los vecinos a la cola
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }
    
    // Forzar redibujado
    if (typeof worldDirty !== 'undefined') worldDirty = true;
    historyManager.commitAction();

    // ✨ MULTIPLAYER: Avisar a la red para que el amigo ejecute el balde
    if (!isFromNetwork && typeof enviarMensajeEnRed === 'function') {
        enviarMensajeEnRed({ tipo: "accion_balde", x: startX, y: startY, estado: targetState });
    }
}

// Variable global para el estado de la herramienta de Spawn
let isSettingSpawn = false;

function toggleSetSpawnMode() {
    isSettingSpawn = !isSettingSpawn;
    
    const btn = document.getElementById('btn-set-spawn');
    const canvas = document.getElementById('canvas');
    
    if (isSettingSpawn) {
        // ACTIVAR MODO
        if (btn) btn.classList.add('active-tool'); 
        
        // Cambiar cursor para indicar que se debe hacer clic
        if (canvas) canvas.style.cursor = "crosshair";
    } else {
        // DESACTIVAR MODO
        if (btn) btn.classList.remove('active-tool');
        
        // Restaurar cursor
        if (canvas) canvas.style.cursor = "default";
    }
}

// ==========================================
// ✨ FIX: SINCRONIZAR TAMAÑO DE HERRAMIENTA AL RECARGAR
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const savedSlider = document.getElementById('tool-size-slider');
    const savedDisplay = document.getElementById('tool-size-display');
    
    // Leemos el valor que el navegador haya restaurado en la caja de texto (o en la barra)
    let restoredSize = 1;
    if (savedDisplay && savedDisplay.value) {
        restoredSize = savedDisplay.value;
    } else if (savedSlider && savedSlider.value) {
        restoredSize = savedSlider.value;
    }

    // Si existe la función, la disparamos simulando un 'blur' para que empate el código con la UI
    if (typeof updateToolSize === 'function') {
        updateToolSize(restoredSize, 'blur');
    }
});

// 📋 flipClipboardHorizontal() ahora vive en scripts/clipboard.js

// Variable para recordar qué forma estamos usando actualmente
window.currentShapeTool = 'line';

// 1. Mostrar/Ocultar el submenú con clic derecho
window.toggleShapeMenu = function(e) {
    e.preventDefault(); // Evita que salga el menú feo del navegador
    const menu = document.getElementById('shape-dropdown');
    
    // Si ya está abierto, lo cierra. Si está cerrado, lo abre.
    if (menu) menu.classList.toggle('show');
};

// 2. Elegir una forma desde el submenú
window.selectShapeTool = function(toolName, iconEmoji) {
    window.currentShapeTool = toolName;
    
    // Cambiamos el icono del botón principal por la figura elegida
    const mainBtn = document.getElementById('tool-shapes-main');
    if (mainBtn) {
        mainBtn.innerText = iconEmoji;
        mainBtn.title = "Shape Tool: " + toolName + " (Right Click for more)";
    }
    
    // Ocultamos el submenú
    const menu = document.getElementById('shape-dropdown');
    if (menu) menu.classList.remove('show');
    
    // Seleccionamos la herramienta en el sistema central
    selectTool(toolName);
};

// 3. ✨ EXTRA: Ocultar el menú emergente si hacemos clic en cualquier otro lado
document.addEventListener('click', function(e) {
    const shapeMenu = document.getElementById('shape-dropdown');
    const shapeBtnContainer = e.target.closest('.tool-btn-container');
    
    // Si hicimos clic en cualquier parte de la pantalla que NO sea el contenedor del botón
    if (shapeMenu && shapeMenu.classList.contains('show') && !shapeBtnContainer) {
        shapeMenu.classList.remove('show');
    }
});