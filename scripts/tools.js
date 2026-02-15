let shapeIndex = 0;
let slotIndex = 0;
let currentTool = 'pencil'; 

// Variables globales de selección
window.selection = { 
    p1: null, 
    p2: null, 
    path: [], 
    type: 'rect', 
    dragging: false 
};
window.clipboard = null; 

function selectTool(toolName) {
    currentTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById('tool-' + toolName);
    if (btn) btn.classList.add('active');
    
    if (toolName !== 'select' && toolName !== 'lasso') {
        window.selection.dragging = false;
        window.selection.path = [];
        window.selection.p1 = null;
        window.selection.p2 = null;
    }
}

// --- SCREENSHOT ---
function takeScreenshot() {
    try {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `MBWorld_${timestamp}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("Captura tomada exitosamente.");
    } catch (e) {
        console.error("Error al tomar screenshot:", e);
        alert("No se pudo tomar la captura.");
    }
}

// --- CONSOLA ---
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
            const x = parseInt(match[2]);
            const y = parseInt(match[3]);
            camera.x = x - Math.floor(grid.width / 2); 
            camera.y = y - Math.floor(grid.height / 2);
            this.value = '';
            document.getElementById('console-overlay').style.display = 'none';
        } else {
            this.style.borderColor = "red";
            setTimeout(() => this.style.borderColor = "#555", 500);
        }
    }
});

// --- ALGORITMO: PUNTO EN POLÍGONO ---
function isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- LÓGICA DE SELECCIÓN ---
function handleSelectionInput(action, x, y) {
    if (currentTool === 'lasso') {
        if (action === 'start') {
            window.selection.type = 'poly';
            window.selection.path = [{x, y}];
            window.selection.dragging = true;
            window.selection.p1 = null; 
            window.selection.p2 = null;
        } 
        else if (action === 'move' && window.selection.dragging) {
            const last = window.selection.path[window.selection.path.length - 1];
            if (last.x !== x || last.y !== y) {
                window.selection.path.push({x, y});
            }
        } 
        else if (action === 'end') {
            window.selection.dragging = false;
            console.log("Selección libre definida:", window.selection.path.length, "puntos");
        }
        return;
    }

    window.selection.type = 'rect';
    if (action === 'start') {
        window.selection.path = [];
        window.selection.p1 = { x, y };
        window.selection.p2 = { x, y }; 
        window.selection.dragging = true;
    } 
    else if (action === 'move' && window.selection.dragging) {
        window.selection.p2 = { x, y };
    } 
    else if (action === 'end') {
        window.selection.dragging = false;
        if (!window.selection.p2 && window.selection.p1) {
            window.selection.p2 = { x, y };
        }
        console.log("Selección rectangular definida:", window.selection);
    }
}

function setSelectionPoint(point, x, y) {
    window.selection.type = 'rect'; 
    if (point === 1) window.selection.p1 = { x, y };
    if (point === 2) window.selection.p2 = { x, y };
}

// --- COPIAR ---
function copySelection() {
    let minX, maxX, minY, maxY;

    if (window.selection.type === 'poly') {
        if (window.selection.path.length < 3) {
            alert("Dibuja un área cerrada válida (mínimo 3 puntos).");
            return;
        }
        const xs = window.selection.path.map(p => p.x);
        const ys = window.selection.path.map(p => p.y);
        minX = Math.min(...xs);
        maxX = Math.max(...xs);
        minY = Math.min(...ys);
        maxY = Math.max(...ys);
    } else {
        if (!window.selection.p1 || !window.selection.p2) {
            alert("Usa la herramienta de Selección o Lazo para marcar un área primero.");
            return;
        }
        minX = Math.min(window.selection.p1.x, window.selection.p2.x);
        maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
        minY = Math.min(window.selection.p1.y, window.selection.p2.y);
        maxY = Math.max(window.selection.p1.y, window.selection.p2.y);
    }

    const data = [];
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            
            if (window.selection.type === 'poly') {
                if (!isPointInPolygon(x, y, window.selection.path)) {
                    continue; 
                }
            }

            const state = mbwom.getBlockState(x, y);
            
            let stateToSave = null;
            if (state && state.type != null) {
                stateToSave = structuredClone(state);
            }

            data.push({
                dx: x - minX,
                dy: y - minY,
                state: stateToSave 
            });
        }
    }

    window.clipboard = {
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        data: data
    };

    window.selection.p1 = null;
    window.selection.p2 = null;
    window.selection.path = [];
    
    console.log(`Copiado al portapapeles: ${data.length} bloques (incluyendo aire).`);
}

// --- PEGAR ---
function activatePasteMode() {
    if (!window.clipboard) {
        alert("Portapapeles vacío. Copia algo con Ctrl+C.");
        return;
    }
    selectTool('paste');
}

function performPaste(targetX, targetY) {
    if (!window.clipboard) return;
    
    historyManager.startAction();
    window.clipboard.data.forEach(blockData => {
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

// --- HOTBAR DATA ---
const hotbar = {
 offset: { x: 0, y: 0 },
 slots: [
  { type: "db" }, { type: "gb" }, { type: "ib" }, { type: "clb" },
  { type: "tob" }, { type: "lapb" }, { type: "j" }, { type: "fire" }, { type: "b" }
 ]
}

// Mantener función vacía por si es llamada externamente
function drawHotbar() {
 if (!images.hotbar.complete) return;
}

// --- GOTERO ---
function eyedropper(x, y) {
 const states = mbwom.getBlockState(x, y);
 if (states && states.type != null) {
     hotbar.slots[slotIndex] = structuredClone(states);
     
     // Actualizar UI
     if (typeof renderHotbarUI === 'function') {
         renderHotbarUI();
     }
     
     selectTool('pencil');
     
     // FIX: Consumir el clic para evitar borrado inmediato
     mouse.left = false; 
 }
}

function eraser(x, y) {
    if (mbwom.scene[x] && mbwom.scene[x][y]) {
        historyManager.recordChange(x, y, mbwom.scene[x][y], null);
        delete mbwom.scene[x][y];
        renderBlock(x, y);
    }
}

function brush(x, y) {
    const current = mbwom.getBlockState(x, y);
    const target = hotbar.slots[slotIndex];
    if (current && current.type === target.type) return;
    
    historyManager.recordChange(x, y, current, target);
    mbwom.setBlockState(x, y, target);
    renderBlock(x, y);
}

function bucketFill(startX, startY) {
    const targetState = hotbar.slots[slotIndex];
    const startBlock = mbwom.getBlockState(startX, startY);
    const startType = startBlock ? startBlock.type : null;
    if (targetState.type === startType) return;

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
    if (currentTool === 'pencil') {
        if (mouse.left) eraser(mouse.worldX, mouse.worldY);
        if (mouse.right) brush(mouse.worldX, mouse.worldY);
    } 
    else if (currentTool === 'eraser') {
        if (mouse.left || mouse.right) eraser(mouse.worldX, mouse.worldY);
    }
    else if (currentTool === 'eyedropper') {
        if (mouse.left) eyedropper(mouse.worldX, mouse.worldY);
    }
}
