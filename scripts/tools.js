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
window.clipboard = null;

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
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById('tool-' + toolName);
    if (btn) btn.classList.add('active');
    
    const selOverlay = document.getElementById('selection-overlay');
    if (selOverlay) selOverlay.style.display = 'none';

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
function updateToolSpray(isSpray) { toolSpray = isSpray; } // NUEVA FUNCIÓN

// --- GESTIÓN DE ATAJOS DE TECLADO ---
window.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === '+' || e.code === 'NumpadAdd') updateToolSize(toolSize + 1);
    if (e.key === '-' || e.code === 'NumpadSubtract') updateToolSize(toolSize - 1);
    if (e.key === 'Delete' || e.code === 'Delete') deleteSelection();

    // LÍNEAS DE Ctrl+X, Ctrl+C y Ctrl+V FUERON ELIMINADAS AQUÍ.
});

window.takeScreenshot = function() {
    const canvas = document.getElementById("canvas");
    if (!canvas) {
        console.error("No se encontró el canvas para tomar la foto.");
        return;
    }

    // ✨ LA MAGIA: Tomamos la foto EXACTA de lo que tu pantalla muestra ahora mismo
    const imageBase64 = canvas.toDataURL("image/png");

    // Generamos un nombre automático con la fecha y hora (Ej: Screenshot_20260407_143000.png)
    const date = new Date();
    const pad = (num) => num.toString().padStart(2, '0');
    const filename = `Screenshot_${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;

    // Creamos un enlace invisible para forzar la descarga en tu navegador
    const link = document.createElement("a");
    link.href = imageBase64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log("¡Screenshot guardado con éxito!");
};

function toggleConsole() {
    const consoleDiv = document.getElementById('console-overlay');
    const input = document.getElementById('console-input');
    if (consoleDiv.style.display === 'flex') {
        consoleDiv.style.display = 'none';
    } else {
        consoleDiv.style.display = 'flex';
        input.focus();
    }
	
// Agrega esto en tu función toggleConsole() cuando se muestra la consola
document.querySelectorAll('.console-msg').forEach(msg => msg.classList.remove('fade-out'));
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

function copySelection(keepSelection = false) {
    const bounds = getSelectionBounds();
    if (!bounds) { alert("Select an area."); return; }
    if (window.selection.type === 'poly' && window.selection.path.length < 3) { alert("Invalid area."); return; }

    const data = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            
            // MAGIA: Solo guarda en memoria los bloques de la silueta azul
            if (!isPointSelected(x, y)) continue;

            const state = mbwom.getBlockState(x, y);
            let stateToSave = null;
            if (state && state.type != null) stateToSave = structuredClone(state);
            data.push({ dx: x - bounds.minX, dy: y - bounds.minY, state: stateToSave });
        }
    }
    
    // Guardamos los datos sin borrar las funciones del objeto
window.clipboard.width = bounds.maxX - bounds.minX + 1;
window.clipboard.height = bounds.maxY - bounds.minY + 1;
window.clipboard.data = data;
    
    if (!keepSelection) {
        window.selection.p1 = null; window.selection.p2 = null; window.selection.path = []; window.selection.subRects = [];
        const overlay = document.getElementById('selection-overlay');
        if (overlay) overlay.style.display = 'none';
        checkSelectionState(); 
    }
    console.log("Copied.");
}

function cutSelection() {
    copySelection(true);
    deleteSelection();
}

function deleteSelection(isFromNetwork = false, networkDeletedBlocks = [], networkDeletedMobs = []) {
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

    if (window.selection.type === 'poly') {
        if (typeof mbwom !== 'undefined' && mbwom.mobs) {
            for (let key in mbwom.mobs) {
                let m = mbwom.mobs[key];
                if (!m) continue;
                let mobWorldX = Math.round(Number(m.x));
                let mobWorldY = Math.round(-Number(m.y)); 
                if (isPointSelected(mobWorldX, mobWorldY)) {
                    delete mbwom.mobs[key]; 
                    changed = true;
                    deletedMobsToSync.push(key);
                }
            }
        }
        if (changed && typeof worldDirty !== 'undefined') worldDirty = true;

    } else {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                if (!isPointSelected(x, y)) continue;
                changed = true; 
                if (mbwom.scene[x] && mbwom.scene[x][y]) {
                    historyManager.recordChange(x, y, mbwom.scene[x][y], null);
                    delete mbwom.scene[x][y];
                    renderBlock(x, y);
                    deletedBlocksToSync.push({x: x, y: y});
                }
            }
        }
        if (changed && typeof mbwom !== 'undefined' && mbwom.scene) {
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

    if (typeof enviarMensajeEnRed === 'function') {
        if (deletedBlocksToSync.length > 0 || deletedMobsToSync.length > 0) {
            enviarMensajeEnRed({ tipo: "accion_borrar_seleccion", bloques: deletedBlocksToSync, mobs: deletedMobsToSync });
        }
    }

    historyManager.commitAction();
    const overlay = document.getElementById('selection-overlay');
    if (overlay) overlay.style.display = 'none';
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = []; window.selection.subRects = [];
    checkSelectionState(); 
}

function activatePasteMode() {
    if (!window.clipboard) { alert("Clipboard empty."); return; }
    selectTool('paste');
}

function performPaste(targetX, targetY, replaceAir = false, isFromNetwork = false, networkClipboard = null) {
    const currentClipboard = isFromNetwork ? networkClipboard : window.clipboard;
    if (!currentClipboard) return;
    historyManager.startAction();

    // PEGAMOS LA ESTRUCTURA: Solo iteramos sobre los puntos exactos que fueron copiados (la forma azul)
    currentClipboard.data.forEach(blockData => {
        // Si NO está presionado Shift (!replaceAir), ignoramos el aire
        // Si SÍ está presionado Shift (replaceAir), sobrescribimos SOLO los puntos de la selección azul
        if (!replaceAir && (!blockData.state || blockData.state.type === "air" || blockData.state.type === "0" || blockData.state.type === 0)) return;

        const absX = targetX + blockData.dx; 
        const absY = targetY + blockData.dy;
        const oldState = mbwom.getBlockState(absX, absY);
        
        // Ahorro de memoria: si en el destino hay aire y pegamos aire, no hacemos nada
        if (!oldState && !blockData.state) return;
        
        historyManager.recordChange(absX, absY, oldState, blockData.state);
        
        if (blockData.state) {
            mbwom.setBlockState(absX, absY, blockData.state);
        } else {
            if (mbwom.scene[absX]) delete mbwom.scene[absX][absY]; 
        }
        
        if (typeof renderBlock === 'function') renderBlock(absX, absY);
    });
    
    if (!isFromNetwork && typeof enviarMensajeEnRed === 'function') {
        enviarMensajeEnRed({ 
            tipo: "accion_pegar", x: targetX, y: targetY, replaceAir: replaceAir, clipboard: currentClipboard 
        });
    }
    
    if (typeof worldDirty !== 'undefined') worldDirty = true;
    historyManager.commitAction();
}

function setSelectionPoint(point, x, y) {
    window.selection.type = 'rect'; 
    if (point === 1) window.selection.p1 = { x, y };
    if (point === 2) window.selection.p2 = { x, y };
    updateSelectionInfo(); checkSelectionState(); 
}

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
    deleteSelection();
}

function deleteSelection(isFromNetwork = false, networkDeletedBlocks = [], networkDeletedMobs = []) {
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

    if (window.selection.type === 'poly') {
        // MODO LASSO: SOLO ELIMINA MOBS
        if (typeof mbwom !== 'undefined' && mbwom.mobs) {
            for (let key in mbwom.mobs) {
                let m = mbwom.mobs[key];
                if (!m) continue;
                let mobWorldX = Math.round(Number(m.x));
                let mobWorldY = Math.round(-Number(m.y)); 
                if (isPointSelected(mobWorldX, mobWorldY)) {
                    delete mbwom.mobs[key]; 
                    changed = true;
                    deletedMobsToSync.push(key);
                }
            }
        }
        if (changed && typeof worldDirty !== 'undefined') worldDirty = true;

    } else {
        // MODO SELECT / MAGIC: SOLO ELIMINA BLOQUES
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                if (!isPointSelected(x, y)) continue;
                changed = true; 
                if (mbwom.scene[x] && mbwom.scene[x][y]) {
                    historyManager.recordChange(x, y, mbwom.scene[x][y], null);
                    delete mbwom.scene[x][y];
                    renderBlock(x, y);
                    deletedBlocksToSync.push({x: x, y: y}); // Recolectamos para la red
                }
            }
        }

        // Recortamos las columnas
        if (changed && typeof mbwom !== 'undefined' && mbwom.scene) {
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
    
    // ✨ MULTIPLAYER: Mandamos la estructura entera al amigo
    if (!isFromNetwork && typeof enviarMensajeEnRed === 'function') {
        enviarMensajeEnRed({ 
            tipo: "accion_pegar", 
            x: targetX, 
            y: targetY, 
            replaceAir: replaceAir, 
            clipboard: currentClipboard 
        });
    }
    
    if (typeof worldDirty !== 'undefined') worldDirty = true;
    historyManager.commitAction();
}

const hotbar = { offset: { x: 0, y: 0 }, slots: [{ type: "dt" }, { type: "dt_1" }, { type: "ib" }, { type: "clb" }, { type: "tob" }, { type: "lapb" }, { type: "wp" }, { type: "fire" }, { type: "b" }] }
function drawHotbar() { if (!images.hotbar.complete) return; }
function eyedropper(x, y) {
 const states = mbwom.getBlockState(x, y);
 if (states && states.type != null) {
     hotbar.slots[slotIndex] = structuredClone(states);
     if (typeof renderHotbarUI === 'function') renderHotbarUI();
     selectTool('pencil'); mouse.left = false; 
 }
}

// === HERRAMIENTA BORRADOR (ACTUALIZADA PARA MULTIJUGADOR) ===
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
                
                // ✨ MULTIPLAYER: Avisamos que rompimos este bloque
                if (typeof enviarMensajeEnRed === 'function') {
                    enviarMensajeEnRed({ tipo: "actualizar_bloque", x: x, y: y, estado: null });
                }
            }
        }
    }
    if (toolSize > 1) historyManager.commitAction();
}

// === HERRAMIENTA PINCEL (ACTUALIZADA PARA MULTIJUGADOR) ===
function brush(cx, cy) {
    const target = hotbar.slots[slotIndex];
    const range = toolSize - 1;
    if (toolSize > 1) historyManager.startAction();
    
    // Si el tamaño es 1, no aplicamos spray (es solo un punto)
    if (toolSize === 1) {
         const current = mbwom.getBlockState(cx, cy);
         if (current && current.type === target.type) return;
         historyManager.recordChange(cx, cy, current, target);
         mbwom.setBlockState(cx, cy, target);
         renderBlock(cx, cy);
         
         // ✨ MULTIPLAYER: Avisamos que pusimos este bloque
         if (typeof enviarMensajeEnRed === 'function') {
             enviarMensajeEnRed({ tipo: "actualizar_bloque", x: cx, y: cy, estado: target });
         }
         
         if (toolSize > 1) historyManager.commitAction();
         return;
    }

    // Para pinceles grandes
    for (let x = cx - range; x <= cx + range; x++) {
        for (let y = cy - range; y <= cy + range; y++) {
            
            // 1. Lógica Rounded
            if (toolRounded) { 
                const dx = x - cx; const dy = y - cy; 
                if ((dx*dx + dy*dy) > (range * range + 0.1)) continue; 
            }

            // 2. Lógica Spray 
            if (toolSpray && Math.random() > 0.1) continue;

            const current = mbwom.getBlockState(x, y);
            if (current && current.type === target.type) continue;
            
            historyManager.recordChange(x, y, current, target);
            mbwom.setBlockState(x, y, target);
            renderBlock(x, y);
            
            // ✨ MULTIPLAYER: Avisamos que pusimos este bloque
            if (typeof enviarMensajeEnRed === 'function') {
                enviarMensajeEnRed({ tipo: "actualizar_bloque", x: x, y: y, estado: target });
            }
        }
    }
    if (toolSize > 1) historyManager.commitAction();
}

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
    if ((isStartAir && isTargetAir) || (!isStartAir && startType === targetType)) return;
    
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
        if ((isStartAir && isCurrentAir) || (!isStartAir && currentType === startType)) {
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

function mineAndPlace() {
    if (currentTool === 'pencil') { if (mouse.left) eraser(mouse.worldX, mouse.worldY); if (mouse.right) brush(mouse.worldX, mouse.worldY); } 
    else if (currentTool === 'eraser') { if (mouse.left || mouse.right) eraser(mouse.worldX, mouse.worldY); }
    else if (currentTool === 'eyedropper') { if (mouse.left) eyedropper(mouse.worldX, mouse.worldY); }
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
        
        // Opcional: Desactivar otras herramientas si es necesario
        // selectTool(null); 
    } else {
        // DESACTIVAR MODO
        if (btn) btn.classList.remove('active-tool');
        
        // Restaurar cursor
        if (canvas) canvas.style.cursor = "default";
    }
}


