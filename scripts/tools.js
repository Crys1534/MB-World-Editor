let shapeIndex = 0;
let slotIndex = 0;
let currentTool = 'pencil'; 
let toolSize = 1; 
let toolRounded = false;
let isShiftPressed = false; // Estado de la tecla Shift

// Estructura actualizada para soportar múltiples selecciones
window.selection = { 
    p1: null, 
    p2: null, 
    path: [], 
    type: 'rect', 
    dragging: false, 
    subRects: [] // Array para guardar selecciones previas al usar Shift
};
window.clipboard = null; 

// Detectores globales de Shift
window.addEventListener('keydown', (e) => { if(e.key === 'Shift') isShiftPressed = true; });
window.addEventListener('keyup', (e) => { if(e.key === 'Shift') isShiftPressed = false; });

// --- Verificar estado del botón Guardar ---
function checkSelectionState() {
    const btn = document.getElementById('btn-save-struct');
    if (!btn) return;

    let hasSelection = false;
    // Verifica si hay selección activa o selecciones acumuladas
    if (window.selection.type === 'rect' && ((window.selection.p1 && window.selection.p2) || window.selection.subRects.length > 0)) {
        hasSelection = true;
    } else if (window.selection.type === 'poly' && window.selection.path.length > 2) {
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
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById('tool-' + toolName);
    if (btn) btn.classList.add('active');
    
    const selOverlay = document.getElementById('selection-overlay');
    if (selOverlay) selOverlay.style.display = 'none';

    // Al cambiar de herramienta (excepto entre selectores), limpiamos todo
    if (toolName !== 'select' && toolName !== 'lasso') {
        window.selection.dragging = false; 
        window.selection.path = []; 
        window.selection.p1 = null; 
        window.selection.p2 = null;
        window.selection.subRects = [];
    }
    
    setTimeout(checkSelectionState, 10);
}

function updateSelectionInfo() {
    const overlay = document.getElementById('selection-overlay');
    if (!overlay) return;
    
    let width = 0; let height = 0;
    // Solo mostramos dimensiones de lo que estás arrastrando actualmente
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

function updateToolSize(val) {
    let size = parseInt(val); if (isNaN(size)) size = 1; if (size < 1) size = 1; if (size > 7) size = 7;
    toolSize = size;
    const display = document.getElementById('tool-size-display');
    const slider = document.getElementById('tool-size-slider');
    if (display) display.innerText = toolSize; if (slider) slider.value = toolSize;
}

function updateToolRounded(isRounded) { toolRounded = isRounded; }

window.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '+' || e.code === 'NumpadAdd') updateToolSize(toolSize + 1);
    if (e.key === '-' || e.code === 'NumpadSubtract') updateToolSize(toolSize - 1);
    if (e.key === 'Delete' || e.code === 'Delete') deleteSelection();
});

function takeScreenshot() {
    try {
        const link = document.createElement('a');
        link.download = `MBWorld_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (e) { console.error(e); }
}

function toggleConsole() {
    const consoleDiv = document.getElementById('console-overlay');
    const input = document.getElementById('console-input');
    if (consoleDiv.style.display === 'flex') {
        consoleDiv.style.display = 'none';
    } else {
        consoleDiv.style.display = 'flex';
        input.focus();
    }
}

document.getElementById('console-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const command = this.value.trim().toLowerCase();
        const match = command.match(/^(\/)?tp\s+(-?\d+)\s+(-?\d+)$/);
        if (match) {
            const x = parseInt(match[2]); const y = parseInt(match[3]);
            camera.x = x - Math.floor(grid.width / 2); camera.y = y - Math.floor(grid.height / 2);
            this.value = ''; document.getElementById('console-overlay').style.display = 'none';
        } else {
            this.style.borderColor = "red"; setTimeout(() => this.style.borderColor = "#555", 500);
        }
    }
});

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

// Nueva función auxiliar: ¿Está el punto dentro de CUALQUIER selección?
function isPointSelected(x, y) {
    // 1. Polygon
    if (window.selection.type === 'poly' && window.selection.path.length > 2) {
        return isPointInPolygon(x, y, window.selection.path);
    }
    
    // 2. Rectángulo Activo
    if (window.selection.p1 && window.selection.p2) {
        const minX = Math.min(window.selection.p1.x, window.selection.p2.x);
        const maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
        const minY = Math.min(window.selection.p1.y, window.selection.p2.y);
        const maxY = Math.max(window.selection.p1.y, window.selection.p2.y);
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
    }

    // 3. Rectángulos Acumulados (Shift)
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

// Obtiene los límites totales de todas las selecciones combinadas
function getSelectionBounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Procesa Poly
    if (window.selection.type === 'poly' && window.selection.path.length > 0) {
        const xs = window.selection.path.map(p => p.x); const ys = window.selection.path.map(p => p.y);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    }

    // Recolecta todos los rectángulos (el activo + los acumulados)
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

function handleSelectionInput(action, x, y) {
    // --- LÓGICA LASSO MEJORADA ---
    if (currentTool === 'lasso') {
        if (action === 'start') {
            window.selection.type = 'poly'; 
            window.selection.subRects = []; // Lasso no combina con rects
            window.selection.path = [{x, y}];
            window.selection.dragging = true; 
            window.selection.p1 = null; 
            window.selection.p2 = null;
            updateSelectionInfo(); checkSelectionState();
        } else if (action === 'move' && window.selection.dragging) {
            const last = window.selection.path[window.selection.path.length - 1];
            
            // Si nos movemos, verificamos si es diagonal
            if (last.x !== x || last.y !== y) { 
                if (last.x !== x && last.y !== y) {
                    // Es diagonal. Insertamos punto intermedio (codo) para mantener 90 grados
                    window.selection.path.push({x: x, y: last.y}); 
                }
                // Insertamos el punto final
                window.selection.path.push({x, y}); 
                updateSelectionInfo(); 
            }

        } else if (action === 'end') {
            window.selection.dragging = false; updateSelectionInfo(); checkSelectionState();
        }
        return;
    }
    
    // --- LÓGICA RECTÁNGULO + SHIFT ---
    window.selection.type = 'rect';
    if (action === 'start') {
        window.selection.path = []; 
        
        // Si NO pulsamos Shift, limpiamos las selecciones anteriores
        if (!isShiftPressed) {
            window.selection.subRects = [];
        } else {
            // Si pulsamos Shift y ya había una selección activa, la guardamos
            if (window.selection.p1 && window.selection.p2) {
                window.selection.subRects.push({
                    p1: window.selection.p1, 
                    p2: window.selection.p2
                });
            }
        }

        // Empezamos el nuevo rectángulo activo
        window.selection.p1 = { x, y }; 
        window.selection.p2 = { x, y }; 
        window.selection.dragging = true; 
        updateSelectionInfo(); checkSelectionState(); 

    } else if (action === 'move' && window.selection.dragging) {
        window.selection.p2 = { x, y }; updateSelectionInfo();
    } else if (action === 'end') {
        window.selection.dragging = false;
        if (!window.selection.p2 && window.selection.p1) window.selection.p2 = { x, y };
        updateSelectionInfo(); checkSelectionState();
    }
}

function setSelectionPoint(point, x, y) {
    window.selection.type = 'rect'; 
    if (point === 1) window.selection.p1 = { x, y };
    if (point === 2) window.selection.p2 = { x, y };
    updateSelectionInfo(); checkSelectionState(); 
}

function copySelection() {
    const bounds = getSelectionBounds();
    if (!bounds) { alert("Select an area."); return; }
    
    if (window.selection.type === 'poly' && window.selection.path.length < 3) { alert("Invalid area."); return; }

    const data = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            
            // Usamos la nueva verificación global
            if (!isPointSelected(x, y)) continue;

            const state = mbwom.getBlockState(x, y);
            let stateToSave = null;
            if (state && state.type != null) stateToSave = structuredClone(state);
            data.push({ dx: x - bounds.minX, dy: y - bounds.minY, state: stateToSave });
        }
    }
    
    window.clipboard = { width: bounds.maxX - bounds.minX + 1, height: bounds.maxY - bounds.minY + 1, data: data };
    
    // Limpieza tras copiar
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = []; window.selection.subRects = [];
    
    const overlay = document.getElementById('selection-overlay');
    if (overlay) overlay.style.display = 'none';
    checkSelectionState(); 
    console.log("Copied.");
}

function deleteSelection() {
    const bounds = getSelectionBounds();
    if (!bounds) return;

    if (window.selection.type === 'poly' && window.selection.path.length < 3) return; 

    historyManager.startAction();
    let changed = false;
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            
            if (!isPointSelected(x, y)) continue;

            if (mbwom.scene[x] && mbwom.scene[x][y]) {
                historyManager.recordChange(x, y, mbwom.scene[x][y], null);
                delete mbwom.scene[x][y];
                renderBlock(x, y);
                changed = true;
            }
        }
    }
    historyManager.commitAction();
    const overlay = document.getElementById('selection-overlay');
    if (overlay) overlay.style.display = 'none';
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = []; window.selection.subRects = [];
    checkSelectionState(); 
}

function activatePasteMode() {
    if (!window.clipboard) { alert("Portapapeles vacío."); return; }
    selectTool('paste');
}
function performPaste(targetX, targetY) {
    if (!window.clipboard) return;
    historyManager.startAction();
    window.clipboard.data.forEach(blockData => {
        const absX = targetX + blockData.dx; const absY = targetY + blockData.dy;
        const oldState = mbwom.getBlockState(absX, absY);
        if (!oldState && !blockData.state) return;
        historyManager.recordChange(absX, absY, oldState, blockData.state);
        if (blockData.state) mbwom.setBlockState(absX, absY, blockData.state);
        else { if (mbwom.scene[absX]) delete mbwom.scene[absX][absY]; }
        renderBlock(absX, absY);
    });
    historyManager.commitAction();
}

const hotbar = { offset: { x: 0, y: 0 }, slots: [{ type: "db" }, { type: "gb" }, { type: "ib" }, { type: "clb" }, { type: "tob" }, { type: "lapb" }, { type: "j" }, { type: "fire" }, { type: "b" }] }
function drawHotbar() { if (!images.hotbar.complete) return; }
function eyedropper(x, y) {
 const states = mbwom.getBlockState(x, y);
 if (states && states.type != null) {
     hotbar.slots[slotIndex] = structuredClone(states);
     if (typeof renderHotbarUI === 'function') renderHotbarUI();
     selectTool('pencil'); mouse.left = false; 
 }
}
function eraser(cx, cy) {
    const range = toolSize - 1;
    if (toolSize > 1) historyManager.startAction();
    for (let x = cx - range; x <= cx + range; x++) {
        for (let y = cy - range; y <= cy + range; y++) {
            if (toolRounded) { const dx = x - cx; const dy = y - cy; if ((dx*dx + dy*dy) > (range * range + 0.1)) continue; }
            if (mbwom.scene[x] && mbwom.scene[x][y]) {
                historyManager.recordChange(x, y, mbwom.scene[x][y], null);
                delete mbwom.scene[x][y];
                renderBlock(x, y);
            }
        }
    }
    if (toolSize > 1) historyManager.commitAction();
}
function brush(cx, cy) {
    const target = hotbar.slots[slotIndex];
    const range = toolSize - 1;
    if (toolSize > 1) historyManager.startAction();
    for (let x = cx - range; x <= cx + range; x++) {
        for (let y = cy - range; y <= cy + range; y++) {
            if (toolRounded) { const dx = x - cx; const dy = y - cy; if ((dx*dx + dy*dy) > (range * range + 0.1)) continue; }
            const current = mbwom.getBlockState(x, y);
            if (current && current.type === target.type) continue;
            historyManager.recordChange(x, y, current, target);
            mbwom.setBlockState(x, y, target);
            renderBlock(x, y);
        }
    }
    if (toolSize > 1) historyManager.commitAction();
}
function bucketFill(startX, startY) {
    const targetState = hotbar.slots[slotIndex];
    const startBlock = mbwom.getBlockState(startX, startY);
    const startType = startBlock ? startBlock.type : null;
    if (targetState.type === startType) return;
    historyManager.startAction();
    const maxPixels = 2000; let pixelsChanged = 0;
    const queue = [[startX, startY]]; const visited = new Set();
    while(queue.length > 0) {
        if (pixelsChanged > maxPixels) break;
        const [x, y] = queue.shift();
        const key = x + "," + y;
        if (visited.has(key)) continue; visited.add(key);
        if (x < 0 || x >= mbwom.scene.length || y < 0 || y > 500) continue;
        const currentBlock = mbwom.getBlockState(x, y);
        const currentType = currentBlock ? currentBlock.type : null;
        if (currentType === startType) {
            historyManager.recordChange(x, y, currentBlock, targetState);
            mbwom.setBlockState(x, y, targetState);
            renderBlock(x, y);
            pixelsChanged++;
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }
    historyManager.commitAction();
}
function mineAndPlace() {
    if (currentTool === 'pencil') { if (mouse.left) eraser(mouse.worldX, mouse.worldY); if (mouse.right) brush(mouse.worldX, mouse.worldY); } 
    else if (currentTool === 'eraser') { if (mouse.left || mouse.right) eraser(mouse.worldX, mouse.worldY); }
    else if (currentTool === 'eyedropper') { if (mouse.left) eyedropper(mouse.worldX, mouse.worldY); }
}