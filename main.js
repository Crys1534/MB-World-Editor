const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// UI Variables
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
    
    ctx.imageSmoothingEnabled = false; 
    updateGridDimensions();
    
    if (typeof hotbar !== 'undefined') {
        hotbar.offset.x = canvas.width / 2 - 94;
        hotbar.offset.y = canvas.height - 44;
    }
}

function updateGridDimensions() {
    tileSize = BASE_TILE_SIZE * (currentZoom / 100);
    grid.width = Math.ceil(canvas.width / tileSize);
    grid.height = Math.ceil(canvas.height / tileSize);
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
}

function drawGridOverlay() {
    if (!showGrid) return;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= grid.width; x++) {
        const xPos = x * tileSize;
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, canvas.height);
    }
    for (let y = 0; y <= grid.height; y++) {
        const yPos = canvas.height - (y * tileSize);
        ctx.moveTo(0, yPos);
        ctx.lineTo(canvas.width, yPos);
    }
    ctx.stroke();
}

function initializeWorldCache() {
    window.worldCache = [];
    for (let x = 0; x < mbwom.scene.length; x++) {
        for (let y = 0; y < mbwom.scene[x].length; y++) {
            renderBlock(x, y);
        }
    }
}

function renderBlock(x, y) {
    if (!worldCache[x]) worldCache[x] = [];
    const states = mbwom.getBlockState(x, y);
    if (states.type != null) {
        worldCache[x][y] = getBlockObject(states);
    } else {
        delete worldCache[x][y]
    }
}

function drawBlock(texture, values) {
    ctx.drawImage(images.blocks, texture.x, texture.y, 16, 16, values.x, values.y, values.width, values.height);
}

function drawWorld() {
    for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
            const currentX = x + camera.x;
            const currentY = y + camera.y;
            const blockObject = getBlockCache(currentX, currentY);
            if (blockObject != null) {
                const values = {
                    x: x * tileSize,
                    y: canvas.height - y * tileSize,
                    width: tileSize,
                    height: -tileSize,
                }
                drawBlock(blockObject, values);
            }
        }
    }
    drawGridOverlay();
}

function getBlockCache(x, y) {
    if (worldCache[x]) return worldCache[x][y];
}

function getBlockObject(states) {
    const renderer = blockData[states.type] || renderers.default;
    return renderer(states);
}

function fillRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, canvas.width, canvas.height);
}

function drawBackgrond() {
    fillRect(0, 0, canvas.width, canvas.height, "#778fa5");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// --- FUNCIÓN drawUI MODIFICADA ---
function drawUI() {
    const coordsDiv = document.getElementById('coords-overlay');
    if (coordsDiv) {
        coordsDiv.innerText = `X: ${mouse.worldX} Y: ${mouse.worldY}`;
    }
    
    // Dibujar bloque cursor (excepto si estamos en modo paste o select)
    if (currentTool !== 'paste' && currentTool !== 'select') {
        drawBlock({ x: 0, y: 3232 }, { x: mouse.alignedX, y: mouse.alignedY, width: tileSize, height: -tileSize });
    }

    // --- MODO PEGAR: PREVISUALIZACIÓN ---
    if (currentTool === 'paste' && window.clipboard) {
        ctx.save();
        ctx.globalAlpha = 0.5; // Transparencia 50%

        window.clipboard.data.forEach(blockData => {
            const absX = mouse.worldX + blockData.dx;
            const absY = mouse.worldY + blockData.dy;
            
            // Renderizado relativo a la cámara
            const screenX = (absX - camera.x) * tileSize;
            const screenY = canvas.height - (absY - camera.y) * tileSize;

            const values = { x: screenX, y: screenY, width: tileSize, height: -tileSize };
            const texture = getBlockObject(blockData.state);
            drawBlock(texture, values);
        });
        
        ctx.restore();

        // Borde Celeste para el área de pegado
        const startScreenX = (mouse.worldX - camera.x) * tileSize;
        const startScreenY = canvas.height - (mouse.worldY - camera.y) * tileSize;
        ctx.strokeStyle = "#00FFFF"; // Celeste
        ctx.lineWidth = 2;
        ctx.strokeRect(startScreenX, startScreenY, window.clipboard.width * tileSize, -(window.clipboard.height * tileSize));
    }

    // --- DIBUJAR SELECCIÓN (Visual Celeste) ---
    if (window.selection.p1 && window.selection.p2) {
        const minX = Math.min(window.selection.p1.x, window.selection.p2.x);
        const maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
        const minY = Math.min(window.selection.p1.y, window.selection.p2.y);
        const maxY = Math.max(window.selection.p1.y, window.selection.p2.y);

        const screenX = (minX - camera.x) * tileSize;
        const screenY = canvas.height - (minY - camera.y) * tileSize;
        const screenW = (maxX - minX + 1) * tileSize;
        const screenH = -(maxY - minY + 1) * tileSize;

        // Relleno Celeste Ligeramente Transparente
        ctx.fillStyle = "rgba(0, 255, 255, 0.2)"; 
        ctx.fillRect(screenX, screenY, screenW, screenH);

        // Borde Azul Claro 2px
        ctx.strokeStyle = "#87CEFA"; // LightSkyBlue
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, screenW, screenH);
    }
}

function mainLoop() {
    mouse.calculateCoordinates();
    cameraMovement();
    if (typeof mineAndPlace === 'function') mineAndPlace();
    drawBackgrond();
    drawWorld();
    drawUI();
    if (typeof drawHotbar === 'function') drawHotbar();
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