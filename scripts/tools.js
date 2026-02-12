let shapeIndex = 0;
let slotIndex = 0;
let currentTool = 'pencil'; 

// Variables globales de selección para Copy/Paste
window.selection = { p1: null, p2: null, dragging: false };
window.clipboard = null; 

function selectTool(toolName) {
    currentTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById('tool-' + toolName);
    if (btn) btn.classList.add('active');
    
    // Resetear dragging si cambiamos de herramienta
    if (toolName !== 'select') {
        window.selection.dragging = false;
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

// --- LÓGICA DE SELECCIÓN (ARRASTRE) ---
function handleSelectionInput(action, x, y) {
    if (action === 'start') {
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
        console.log("Selección definida:", window.selection);
    }
}

// Mantener compatibilidad con teclas Z/X antiguas si se desea
function setSelectionPoint(point, x, y) {
    if (point === 1) window.selection.p1 = { x, y };
    if (point === 2) window.selection.p2 = { x, y };
}

// --- COPIAR ---
function copySelection() {
    if (!window.selection.p1 || !window.selection.p2) {
        alert("Usa la herramienta de Selección (⛶) para marcar un área primero.");
        return;
    }

    const minX = Math.min(window.selection.p1.x, window.selection.p2.x);
    const maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
    const minY = Math.min(window.selection.p1.y, window.selection.p2.y);
    const maxY = Math.max(window.selection.p1.y, window.selection.p2.y);

    const data = [];
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const state = mbwom.getBlockState(x, y);
            if (state && state.type != null) {
                data.push({
                    dx: x - minX,
                    dy: y - minY,
                    state: structuredClone(state)
                });
            }
        }
    }

    window.clipboard = {
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        data: data
    };

    // --- NUEVO: Deseleccionar área tras copiar ---
    window.selection.p1 = null;
    window.selection.p2 = null;
    
    console.log("Copiado al portapapeles y selección limpiada.");
}

// --- PEGAR ---
function activatePasteMode() {
    if (!window.clipboard) {
        alert("Portapapeles vacío. Copia algo con Ctrl+C.");
        return;
    }
    selectTool('paste'); // Activamos modo pegar
}

function performPaste(targetX, targetY) {
    if (!window.clipboard) return;
    
    historyManager.startAction();
    window.clipboard.data.forEach(blockData => {
        const absX = targetX + blockData.dx;
        const absY = targetY + blockData.dy;
        
        const oldState = mbwom.getBlockState(absX, absY);
        historyManager.recordChange(absX, absY, oldState, blockData.state);
        
        mbwom.setBlockState(absX, absY, blockData.state);
        renderBlock(absX, absY);
    });
    historyManager.commitAction();
}

// --- DIBUJO ---
const hotbar = {
 offset: { x: 0, y: 0 },
 slots: [
  { type: "db" }, { type: "gb" }, { type: "ib" }, { type: "clb" },
  { type: "tob" }, { type: "lapb" }, { type: "j" }, { type: "fire" }, { type: "b" }
 ]
}

function drawHotbar() {
 if (!images.hotbar.complete) return;
 let x = hotbar.offset.x + 3;
 ctx.drawImage(images.hotbar, hotbar.offset.x, hotbar.offset.y);
 ctx.drawImage(images.slot, hotbar.offset.x + 20 * slotIndex, hotbar.offset.y);
 hotbar.slots.forEach((states, index) => {
  drawBlock(
   getBlockObject(states),
   { x: (x + index * 20), y: hotbar.offset.y + 3, width: 16, height: 16 }
  );
 });
}

function eyedropper(x, y) {
 const states = mbwom.getBlockState(x, y);
 if (states && states.type != null) {
     hotbar.slots[slotIndex] = structuredClone(states);
     selectTool('pencil');
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
    // 'select' y 'paste' se manejan por eventos en input.js
}