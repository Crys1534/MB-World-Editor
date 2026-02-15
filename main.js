const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// --- OPTIMIZACIÓN: Buffer Fuera de Pantalla ---
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
offscreenCtx.imageSmoothingEnabled = false;

let worldDirty = true;
let lastCameraX = null;
let lastCameraY = null;
let lastGridWidth = null;

const uiElements = {
    topBar: document.getElementById('top-bar'),
    ribbon: document.getElementById('ribbon'),
};

const ZOOM_LEVELS = [25, 50, 100, 150, 200];
let currentZoomIndex = 2; 
let currentZoom = 100;
const BASE_TILE_SIZE = 16;
let showGrid = false;
const grid = { width: 60, height: 30 };
let tileSize = BASE_TILE_SIZE;

const images = { names: ["blocks", "hotbar", "slot"] }
images.names.forEach((name) => {
    images[name] = new Image;
    images[name].src = `assets/${name}.png`;
});

// Velocidad fija en 1 para evitar decimales
const camera = { x: 0, y: 148, speed: 1 }

function resizeCanvas() {
    const workspace = document.getElementById('workspace');
    if (workspace) {
        canvas.width = workspace.clientWidth;
        canvas.height = workspace.clientHeight;
    } else {
        canvas.width = window.innerWidth - 60;
        canvas.height = window.innerHeight - 112;
    }
    
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    offscreenCtx.imageSmoothingEnabled = false;
    
    ctx.imageSmoothingEnabled = false; 
    updateGridDimensions();
    
    worldDirty = true;
}

function updateGridDimensions() {
    tileSize = BASE_TILE_SIZE * (currentZoom / 100);
    grid.width = Math.ceil(canvas.width / tileSize);
    grid.height = Math.ceil(canvas.height / tileSize);
    
    camera.speed = 1; 
    camera.x = Math.round(camera.x);
    camera.y = Math.round(camera.y);

    worldDirty = true; 
}

window.addEventListener('resize', resizeCanvas);
window.onload = resizeCanvas;

function updateZoomSlider(value) {
    const index = parseInt(value);
    if (ZOOM_LEVELS[index] !== undefined) {
        currentZoom = ZOOM_LEVELS[index];
        currentZoomIndex = index;
    }
    document.getElementById('zoom-value').innerText = currentZoom + "%";
    const slider = document.getElementById('zoom-slider');
    if (slider) slider.value = currentZoomIndex;
    updateGridDimensions();
}

const zoomContainer = document.getElementById('zoom-floating');
if (zoomContainer) {
    zoomContainer.addEventListener('wheel', function(e) {
        e.preventDefault();
        if (e.deltaY < 0) {
            if (currentZoomIndex < ZOOM_LEVELS.length - 1) {
                currentZoomIndex++;
                updateZoomSlider(currentZoomIndex);
            }
        } else {
            if (currentZoomIndex > 0) {
                currentZoomIndex--;
                updateZoomSlider(currentZoomIndex);
            }
        }
    });
}

function toggleGrid(enabled) {
    showGrid = enabled;
    worldDirty = true;
}

function initializeWorldCache() {
    window.worldCache = [];
    for (let x = 0; x < mbwom.scene.length; x++) {
        for (let y = 0; y < mbwom.scene[x].length; y++) {
            renderBlock(x, y);
        }
    }
    worldDirty = true;
}

function renderBlock(x, y) {
    if (!worldCache[x]) worldCache[x] = [];
    const states = mbwom.getBlockState(x, y);
    if (states.type != null) {
        worldCache[x][y] = getBlockObject(states);
    } else {
        delete worldCache[x][y]
    }
    worldDirty = true;
}

function drawBlock(texture, values, targetCtx = ctx) {
    targetCtx.drawImage(images.blocks, texture.x, texture.y, 16, 16, values.x, values.y, values.width, values.height);
}

function renderWorldToBuffer() {
    offscreenCtx.fillStyle = "#778fa5";
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
            const currentX = Math.floor(x + camera.x);
            const currentY = Math.floor(y + camera.y);
            
            const blockObject = getBlockCache(currentX, currentY);
            if (blockObject != null) {
                const values = {
                    x: x * tileSize,
                    y: canvas.height - y * tileSize,
                    width: tileSize,
                    height: -tileSize,
                }
                drawBlock(blockObject, values, offscreenCtx);
            }
        }
    }
    
    if (showGrid) {
        offscreenCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        offscreenCtx.lineWidth = 1;
        offscreenCtx.beginPath();
        for (let x = 0; x <= grid.width; x++) {
            const xPos = x * tileSize;
            offscreenCtx.moveTo(xPos, 0);
            offscreenCtx.lineTo(xPos, offscreenCanvas.height);
        }
        for (let y = 0; y <= grid.height; y++) {
            const yPos = offscreenCanvas.height - (y * tileSize);
            offscreenCtx.moveTo(0, yPos);
            offscreenCtx.lineTo(offscreenCanvas.width, yPos);
        }
        offscreenCtx.stroke();
    }
}

function drawWorld() {
    if (camera.x !== lastCameraX || camera.y !== lastCameraY || grid.width !== lastGridWidth) {
        worldDirty = true;
        lastCameraX = camera.x;
        lastCameraY = camera.y;
        lastGridWidth = grid.width;
    }

    if (worldDirty) {
        renderWorldToBuffer();
        worldDirty = false;
    }
    
    ctx.drawImage(offscreenCanvas, 0, 0);
}

function getBlockCache(x, y) {
    if (worldCache[x]) return worldCache[x][y];
}

function getBlockObject(states) {
    const renderer = blockData[states.type] || renderers.default;
    return renderer(states);
}

function drawUI() {
    const coordsDiv = document.getElementById('coords-overlay');
    if (coordsDiv) {
        coordsDiv.innerText = `X: ${Math.floor(mouse.worldX)} Y: ${Math.floor(mouse.worldY)}`;
    }
    
    // --- CURSOR INTELIGENTE (Contorno Limpio) ---
    if (currentTool !== 'paste' && currentTool !== 'select' && currentTool !== 'lasso') {
        const size = (typeof toolSize !== 'undefined') ? toolSize : 1;
        const range = size - 1;
        
        ctx.strokeStyle = "#4DA6FF"; // Celeste
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(77, 166, 255, 0.2)"; // Relleno suave

        // Función helper para saber si un punto está dentro del pincel
        const isInside = (dx, dy) => {
             // Si es redondeado, usamos fórmula de círculo
             if (typeof toolRounded !== 'undefined' && toolRounded && size > 1) {
                 return (dx*dx + dy*dy) <= (range * range + 0.1);
             }
             // Si es cuadrado, verificamos límites del rectángulo
             return dx >= -range && dx <= range && dy >= -range && dy <= range;
        };

        // 1. DIBUJAR RELLENO (FILL)
        // Dibujamos todos los bloques activos primero
        ctx.beginPath();
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (isInside(dx, dy)) {
                    const absX = mouse.worldX + dx;
                    const absY = mouse.worldY + dy;
                    const drawX = (absX - camera.x) * tileSize;
                    const drawY = canvas.height - (absY - camera.y) * tileSize;
                    
                    // Relleno individual para cada bloque activo
                    ctx.fillRect(drawX, drawY, tileSize, -tileSize);
                }
            }
        }

        // 2. DIBUJAR CONTORNO (STROKE)
        // Verificamos vecindad para dibujar solo los bordes externos
        ctx.beginPath();
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (isInside(dx, dy)) {
                    const absX = mouse.worldX + dx;
                    const absY = mouse.worldY + dy;
                    const drawX = (absX - camera.x) * tileSize;
                    const drawY = canvas.height - (absY - camera.y) * tileSize; // Y en pantalla (esquina inferior izq visualmente)

                    // Coordenadas del bloque en pantalla
                    // drawY es la parte de abajo del bloque porque height es -tileSize
                    const left = drawX;
                    const right = drawX + tileSize;
                    const bottom = drawY; 
                    const top = drawY - tileSize;

                    // Si el vecino de la DERECHA está vacío, dibujamos borde derecho
                    if (!isInside(dx + 1, dy)) {
                        ctx.moveTo(right, bottom);
                        ctx.lineTo(right, top);
                    }
                    // Si el vecino de la IZQUIERDA está vacío, dibujamos borde izquierdo
                    if (!isInside(dx - 1, dy)) {
                        ctx.moveTo(left, bottom);
                        ctx.lineTo(left, top);
                    }
                    // Si el vecino de ARRIBA está vacío, dibujamos borde superior
                    if (!isInside(dx, dy + 1)) {
                        ctx.moveTo(left, top);
                        ctx.lineTo(right, top);
                    }
                    // Si el vecino de ABAJO está vacío, dibujamos borde inferior
                    if (!isInside(dx, dy - 1)) {
                        ctx.moveTo(left, bottom);
                        ctx.lineTo(right, bottom);
                    }
                }
            }
        }
        ctx.stroke(); // Ejecutamos el trazo del contorno
    }

    if (currentTool === 'paste' && window.clipboard) {
        ctx.save();
        ctx.globalAlpha = 0.5;

        window.clipboard.data.forEach(blockData => {
            if (!blockData.state) return;
            const absX = mouse.worldX + blockData.dx;
            const absY = mouse.worldY + blockData.dy;
            
            const screenX = (absX - camera.x) * tileSize;
            const screenY = canvas.height - (absY - camera.y) * tileSize;

            const values = { x: screenX, y: screenY, width: tileSize, height: -tileSize };
            const texture = getBlockObject(blockData.state);
            drawBlock(texture, values);
        });
        
        ctx.restore();

        const startScreenX = (mouse.worldX - camera.x) * tileSize;
        const startScreenY = canvas.height - (mouse.worldY - camera.y) * tileSize;
        ctx.strokeStyle = "#00FFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(startScreenX, startScreenY, window.clipboard.width * tileSize, -(window.clipboard.height * tileSize));
    }

    if (window.selection.type === 'rect' && window.selection.p1 && window.selection.p2) {
        const minX = Math.min(window.selection.p1.x, window.selection.p2.x);
        const maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
        const minY = Math.min(window.selection.p1.y, window.selection.p2.y);
        const maxY = Math.max(window.selection.p1.y, window.selection.p2.y);

        const screenX = (minX - camera.x) * tileSize;
        const screenY = canvas.height - (minY - camera.y) * tileSize;
        const screenW = (maxX - minX + 1) * tileSize;
        const screenH = -(maxY - minY + 1) * tileSize;

        ctx.fillStyle = "rgba(0, 255, 255, 0.2)"; 
        ctx.fillRect(screenX, screenY, screenW, screenH);

        ctx.strokeStyle = "#87CEFA";
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, screenW, screenH);
    }
    
    if (window.selection.type === 'poly' && window.selection.path.length > 0) {
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        window.selection.path.forEach((point, index) => {
            const screenX = (point.x - camera.x) * tileSize + (tileSize / 2); 
            const screenY = canvas.height - (point.y - camera.y) * tileSize - (tileSize / 2);
            
            if (index === 0) {
                ctx.moveTo(screenX, screenY);
            } else {
                ctx.lineTo(screenX, screenY);
            }
        });
        
        if (!window.selection.dragging && window.selection.path.length > 2) {
            ctx.closePath();
            ctx.fillStyle = "rgba(255, 215, 0, 0.1)"; 
            ctx.fill();
        }
        
        ctx.stroke();
    }
}

function mainLoop() {
    mouse.calculateCoordinates();
    cameraMovement();
    if (typeof mineAndPlace === 'function') mineAndPlace();
    drawWorld();
    drawUI();
    requestAnimationFrame(mainLoop);
}

document.getElementById("dimension").addEventListener("change", function () {
    if (mbwom.world) {
        const sceneIndex = parseInt(this.value);
        if (mbwom.world["scene" + sceneIndex]) {
            mbwom.loadScene(sceneIndex);
            initializeWorldCache();
        }
    }
});