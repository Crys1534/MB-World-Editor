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

function handleSelectionInput(action, x, y) {
    // --- Lógica de la herramienta Lasso ---
    if (currentTool === 'lasso') {
        if (action === 'start') {
            window.selection.type = 'poly'; 
            window.selection.subRects = []; 
            window.selection.path = [{x, y}];
            window.selection.dragging = true; 
            window.selection.p1 = null; 
            window.selection.p2 = null;
            updateSelectionInfo(); checkSelectionState();
        } else if (action === 'move' && window.selection.dragging) {
            const last = window.selection.path[window.selection.path.length - 1];
            
            if (last.x !== x || last.y !== y) { 
                let dx = Math.abs(x - last.x);
                let dy = Math.abs(y - last.y);
                let sx = (last.x < x) ? 1 : -1;
                let sy = (last.y < y) ? 1 : -1;
                let err = dx - dy;
                let cx = last.x;
                let cy = last.y;

                while (true) {
                    if (cx !== last.x || cy !== last.y) {
                        window.selection.path.push({x: cx, y: cy});
                    }
                    if (cx === x && cy === y) break;
                    let e2 = 2 * err;
                    if (e2 > -dy) { err -= dy; cx += sx; }
                    if (e2 < dx) { err += dx; cy += sy; }
                }
                updateSelectionInfo(); 
            }

        } else if (action === 'end') {
            window.selection.dragging = false; 
            if (window.selection.path.length > 2) {
                const xs = window.selection.path.map(p => p.x);
                const ys = window.selection.path.map(p => p.y);
                window.selection.p1 = { x: Math.min(...xs), y: Math.min(...ys) };
                window.selection.p2 = { x: Math.max(...xs), y: Math.max(...ys) };
            }
            updateSelectionInfo(); checkSelectionState();
        }
        return;
    }
    
    // --- Lógica original de la herramienta Select (Rectangular) ---
    window.selection.type = 'rect';
    if (action === 'start') {
        window.selection.path = []; 
        if (!isShiftPressed) window.selection.subRects = [];
        else if (window.selection.p1 && window.selection.p2) {
            window.selection.subRects.push({ p1: window.selection.p1, p2: window.selection.p2 });
        }
        window.selection.p1 = { x, y }; 
        window.selection.p2 = { x, y }; 
        window.selection.dragging = true; 
        updateSelectionInfo(); checkSelectionState(); 

    } else if (action === 'move' && window.selection.dragging) {
        
        // ✨ LA MAGIA DEL CUADRADO (Shift presionado) ✨
        if (isShiftPressed && window.selection.p1) {
            let dx = x - window.selection.p1.x;
            let dy = y - window.selection.p1.y;
            
            // Tomamos la distancia más larga y obligamos a que el otro lado mida lo mismo
            let size = Math.max(Math.abs(dx), Math.abs(dy));
            let signX = dx >= 0 ? 1 : -1;
            let signY = dy >= 0 ? 1 : -1;
            
            x = window.selection.p1.x + (size * signX);
            y = window.selection.p1.y + (size * signY);
        }

        window.selection.p2 = { x, y }; 
        updateSelectionInfo();
        
    } else if (action === 'end') {
        window.selection.dragging = false;
        
        // Si soltó el clic manteniendo Shift, nos aseguramos de que el punto final sea cuadrado
        if (isShiftPressed && window.selection.p1) {
            let dx = x - window.selection.p1.x;
            let dy = y - window.selection.p1.y;
            let size = Math.max(Math.abs(dx), Math.abs(dy));
            let signX = dx >= 0 ? 1 : -1;
            let signY = dy >= 0 ? 1 : -1;
            x = window.selection.p1.x + (size * signX);
            y = window.selection.p1.y + (size * signY);
        }

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

function deleteSelection() {
    const bounds = getSelectionBounds();
    if (!bounds) return;

    if (window.selection.type === 'poly' && window.selection.path.length < 3) return; 

    historyManager.startAction();
    let changed = false;

    // ✨ DIVISIÓN DE HERRAMIENTAS ✨

    if (window.selection.type === 'poly') {
        // ==========================================
        // 🤠 MODO LASSO: SOLO ELIMINA MOBS
        // ==========================================
        if (typeof mbwom !== 'undefined' && mbwom.mobs) {
            for (let key in mbwom.mobs) {
                let m = mbwom.mobs[key];
                if (!m) continue;
                
                let mobWorldX = Math.round(Number(m.x));
                let mobWorldY = Math.round(-Number(m.y)); 
                
                if (isPointSelected(mobWorldX, mobWorldY)) {
                    delete mbwom.mobs[key]; // ¡Mob destruido!
                    changed = true;
                }
            }
        }
        if (changed && typeof worldDirty !== 'undefined') worldDirty = true;
        console.log("🤠 Lasso: Se atraparon y eliminaron los mobs.");

    } else {
        // ==========================================
        // 🧱 MODO SELECT / MAGIC: SOLO ELIMINA BLOQUES
        // ==========================================
        
        // 1. Borramos los bloques visuales
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                if (!isPointSelected(x, y)) continue;

                changed = true; 

                if (mbwom.scene[x] && mbwom.scene[x][y]) {
                    historyManager.recordChange(x, y, mbwom.scene[x][y], null);
                    delete mbwom.scene[x][y];
                    renderBlock(x, y);
                }
            }
        }

        // 2. Recortamos las columnas para bajar el peso del archivo
        if (changed && typeof mbwom !== 'undefined' && mbwom.scene) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                let col = mbwom.scene[x];
                if (!col || !Array.isArray(col)) continue;

                for (let y = bounds.minY; y <= bounds.maxY; y++) {
                    if (isPointSelected(x, y)) {
                        let b = col[y];
                        if (b && (b.type === "air" || b.type === 0 || b.type === "0" || b.type === "")) {
                            col[y] = null; 
                        }
                    }
                }

                while (col.length > 0) {
                    let ultimoBloque = col[col.length - 1];
                    if (!ultimoBloque || ultimoBloque === null || ultimoBloque.type === null || ultimoBloque.type === "air" || ultimoBloque.type === 0 || ultimoBloque.type === "0" || ultimoBloque.type === "") {
                        col.pop(); 
                    } else {
                        break; 
                    }
                }
            }
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
        console.log("🧱 Selección: Se eliminaron los bloques y se purgaron los huecos.");
    }

    // LIMPIEZA FINAL DE LA INTERFAZ
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
function performPaste(targetX, targetY, replaceAir = false) {
    if (!window.clipboard) return;
    historyManager.startAction();

    // 1. SI SHIFT ESTÁ PRESIONADO: Limpiamos toda el área primero
    if (replaceAir) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        // Calculamos la caja exacta que ocupa la estructura
        window.clipboard.data.forEach(blockData => {
            if (blockData.dx < minX) minX = blockData.dx;
            if (blockData.dx > maxX) maxX = blockData.dx;
            if (blockData.dy < minY) minY = blockData.dy;
            if (blockData.dy > maxY) maxY = blockData.dy;
        });

        // Recorremos esa caja y borramos todo (lo llenamos de aire)
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const absX = targetX + x;
                const absY = targetY + y;
                const oldState = mbwom.getBlockState(absX, absY);
                
                // Si había un bloque ahí, lo borramos y lo guardamos en el historial
                if (oldState) {
                    historyManager.recordChange(absX, absY, oldState, null);
                    if (mbwom.scene[absX]) delete mbwom.scene[absX][absY];
                    renderBlock(absX, absY);
                }
            }
        }
    }

    // 2. PEGAMOS LA ESTRUCTURA NORMALMENTE
    window.clipboard.data.forEach(blockData => {
        // Si NO estamos usando Shift y el bloque de la estructura es aire, lo ignoramos para no borrar el fondo
        if (!replaceAir && (!blockData.state || blockData.state.type === "air" || blockData.state.type === "0" || blockData.state.type === 0)) {
            return;
        }

        const absX = targetX + blockData.dx; 
        const absY = targetY + blockData.dy;
        const oldState = mbwom.getBlockState(absX, absY);
        
        if (!oldState && !blockData.state) return;
        
        historyManager.recordChange(absX, absY, oldState, blockData.state);
        
        if (blockData.state) {
            mbwom.setBlockState(absX, absY, blockData.state);
        } else { 
            if (mbwom.scene[absX]) delete mbwom.scene[absX][absY]; 
        }
        renderBlock(absX, absY);
    });
    
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
        
        if (x < 0 || x > 6000 || y < 0 || y > 500) continue; 

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