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

// --- IMÁGENES GLOBALES ---
// Agrega aquí los nombres de los PNGs que vayas metiendo a la carpeta assets/
window.images = { names: ["blocks", "hotbar", "slot", "zombie", "skeleton", "creeper", "enderman", "nethereye", "enderdragon", "pig", "cow", "chicken"] };

window.images.names.forEach((name) => {
    window.images[name] = new Image();
    window.images[name].src = `assets/${name}.png`;
    
    window.images[name].onload = () => {
        worldDirty = true;
        const structCanvas = document.getElementById('struct-preview-canvas');
        if (structCanvas && structCanvas.offsetParent !== null) {
            // Opcional: refresco de preview
        }
    };
});

// Velocidad fija en 1
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
    
    // CAMBIO AQUÍ:
    // Antes: camera.speed = 1;
    // Ahora: La velocidad se ajusta para mantener una sensación constante
    // (Más lento con zoom in, más rápido con zoom out)
    camera.speed = 100 / currentZoom; 
    
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
    if (window.images.blocks && window.images.blocks.complete && window.images.blocks.naturalWidth !== 0) {
        targetCtx.drawImage(window.images.blocks, texture.x, texture.y, 16, 16, values.x, values.y, values.width, values.height);
    }
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
    // Optimización: Aplicar Math.floor para redibujar el buffer solo al cruzar enteros
    const camX = Math.floor(camera.x);
    const camY = Math.floor(camera.y);

    if (camX !== lastCameraX || camY !== lastCameraY || grid.width !== lastGridWidth) {
        worldDirty = true;
        lastCameraX = camX;
        lastCameraY = camY;
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

// ==========================================
// ✨ RENDERIZADO DE ENTIDADES / MOBS ✨
// ==========================================
function drawMobs() {
    if (typeof mbwom === 'undefined' || !mbwom.mobs) return;
    
    for (let key in mbwom.mobs) {
        try {
            const mob = mbwom.mobs[key];
            if (!mob || !mob.type) {
                delete mbwom.mobs[key];
                continue;
            }

            const mobWorldX = Number(mob.x);
            const mobWorldY = -Number(mob.y); 
            
            const screenX = (mobWorldX - camera.x) * tileSize;
            const screenY = canvas.height - (mobWorldY - camera.y) * tileSize;
            
            if (screenX < -200 || screenX > canvas.width + 200 || screenY < -200 || screenY > canvas.height + 200) {
                continue;
            }
            
            let mobWidth = tileSize * 1;
            let mobHeight = tileSize * 2;
            if (mob.type === 'chicken' || mob.type === 'pig' || mob.type === 'spider' || mob.type === 'slime') mobHeight = tileSize * 1;
            if (mob.type === 'enderdragon') { mobWidth = tileSize * 24; mobHeight = tileSize * 8; }
            if (mob.type === 'nethereye') { mobWidth = tileSize * 0.75; mobHeight = tileSize * 0.75; }
            if (mob.type === 'pig') { mobWidth = tileSize * 2; mobHeight = tileSize * 1.2; }
            if (mob.type === 'enderman') { mobWidth = tileSize * 1.2; mobHeight = tileSize * 3; }
            if (mob.type === 'cow') { mobWidth = tileSize * 2.2; mobHeight = tileSize * 2; }
            
            let mobImg = window.images[mob.type];

            if (mobImg && mobImg.complete && mobImg.naturalWidth > 0) {
                ctx.save(); 
                ctx.translate(screenX, screenY);
                if (mob.direction === 0) ctx.scale(-1, 1);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(
                    mobImg, 
                    0, 0, mobImg.naturalWidth, mobImg.naturalHeight,
                    -(mobWidth / 2), -mobHeight, mobWidth, mobHeight 
                );
                ctx.restore(); 
            } else {
                let color = "rgba(255, 0, 0, 0.4)"; 
                if (mob.type === 'zombie') color = "rgba(46, 125, 50, 0.5)";
                else if (mob.type === 'skeleton') color = "rgba(224, 224, 224, 0.5)";
                else if (mob.type === 'enderman') color = "rgba(49, 27, 146, 0.5)";
                
                ctx.fillStyle = color;
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
            }

            // ✨ EFECTO DE SELECCIÓN ESTILO "ARCHIVO WINDOWS" ✨
            if (typeof selectedMob !== 'undefined' && mob === selectedMob && typeof currentTool !== 'undefined' && currentTool === 'move') {
                ctx.fillStyle = "rgba(0, 120, 215, 0.3)"; // Fondo celeste translúcido
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                
                ctx.strokeStyle = "#0078D7"; // Borde azul sólido
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                ctx.lineWidth = 1; 
            }
            
            // Nombre
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.shadowColor = "black"; ctx.shadowBlur = 4;
            let displayName = mob.name ? String(mob.name) : String(mob.type).toUpperCase();
            ctx.fillText(displayName, screenX, screenY - mobHeight - 8);
            ctx.shadowBlur = 0; 
            
            // Barra de Vida
            if (mob.health !== undefined) {
                let maxHp = mob.maxHealth || ((typeof MOBS_DB !== 'undefined' && MOBS_DB[mob.type]) ? MOBS_DB[mob.type].hp : 20);
                if (mob.type === 'enderdragon' && !mob.maxHealth) maxHp = 333;
                if (mob.type === 'enderman' && !mob.maxHealth) maxHp = 40;
                
                let hpPercent = Math.max(0, Math.min(1, Number(mob.health) / Number(maxHp))); 
                
                ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fillRect(screenX - (mobWidth/2), screenY - mobHeight - 4, mobWidth, 4);
                ctx.fillStyle = hpPercent > 0.3 ? "#00FF00" : "#FF0000";
                ctx.fillRect(screenX - (mobWidth/2), screenY - mobHeight - 4, mobWidth * hpPercent, 4);
            }
        } catch (e) {
            console.error("Mob inválido saltado");
        }
    }
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

        const isInside = (dx, dy) => {
             if (typeof toolRounded !== 'undefined' && toolRounded && size > 1) {
                 return (dx*dx + dy*dy) <= (range * range + 0.1);
             }
             return dx >= -range && dx <= range && dy >= -range && dy <= range;
        };

        ctx.beginPath();
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (isInside(dx, dy)) {
                    const absX = mouse.worldX + dx;
                    const absY = mouse.worldY + dy;
                    const drawX = (absX - camera.x) * tileSize;
                    const drawY = canvas.height - (absY - camera.y) * tileSize;
                    
                    ctx.fillRect(drawX, drawY, tileSize, -tileSize);
                }
            }
        }

        ctx.beginPath();
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (isInside(dx, dy)) {
                    const absX = mouse.worldX + dx;
                    const absY = mouse.worldY + dy;
                    const drawX = (absX - camera.x) * tileSize;
                    const drawY = canvas.height - (absY - camera.y) * tileSize; 

                    const left = drawX;
                    const right = drawX + tileSize;
                    const bottom = drawY; 
                    const top = drawY - tileSize;

                    if (!isInside(dx + 1, dy)) { ctx.moveTo(right, bottom); ctx.lineTo(right, top); }
                    if (!isInside(dx - 1, dy)) { ctx.moveTo(left, bottom); ctx.lineTo(left, top); }
                    if (!isInside(dx, dy + 1)) { ctx.moveTo(left, top); ctx.lineTo(right, top); }
                    if (!isInside(dx, dy - 1)) { ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); }
                }
            }
        }
        ctx.stroke(); 
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


// --- MAGIC WAND (Varita Mágica) ---
    if (window.selection.type === 'magic' && window.selection.points && window.selection.points.length > 0) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.2)"; // Un rosa translúcido para identificar la magia
        ctx.strokeStyle = "#87CEFA"; // Borde rosa fuerte
        ctx.lineWidth = 2;

        ctx.beginPath();
        
        // Iteramos sobre todos los puntos que atrapó la varita
        window.selection.points.forEach(point => {
            const screenX = (point.x - camera.x) * tileSize;
            const screenY = canvas.height - (point.y - camera.y) * tileSize;
            
            // Dibujamos el relleno de cada bloque
            ctx.fillRect(screenX, screenY, tileSize, -tileSize);

            // --- DIBUJO DE BORDES INTELIGENTES ---
            // Solo dibujamos la línea si no hay un bloque contiguo seleccionado
            const left = screenX;
            const right = screenX + tileSize;
            const bottom = screenY; 
            const top = screenY - tileSize;

            if (!window.selection.pointSet.has((point.x + 1) + "," + point.y)) { 
                ctx.moveTo(right, bottom); ctx.lineTo(right, top); 
            }
            if (!window.selection.pointSet.has((point.x - 1) + "," + point.y)) { 
                ctx.moveTo(left, bottom); ctx.lineTo(left, top); 
            }
            if (!window.selection.pointSet.has(point.x + "," + (point.y + 1))) { 
                ctx.moveTo(left, top); ctx.lineTo(right, top); 
            }
            if (!window.selection.pointSet.has(point.x + "," + (point.y - 1))) { 
                ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); 
            }
        });
        
        ctx.stroke();
    }


    // --- SELECCIONES MÚLTIPLES (Rect) ---
    if (window.selection.type === 'rect') {
        // Combinamos la selección actual (p1, p2) con las guardadas (subRects)
        const rectsToDraw = [...window.selection.subRects];
        if (window.selection.p1 && window.selection.p2) {
            rectsToDraw.push({ p1: window.selection.p1, p2: window.selection.p2 });
        }

        rectsToDraw.forEach(r => {
            const minX = Math.min(r.p1.x, r.p2.x);
            const maxX = Math.max(r.p1.x, r.p2.x);
            const minY = Math.min(r.p1.y, r.p2.y);
            const maxY = Math.max(r.p1.y, r.p2.y);

            const screenX = (minX - camera.x) * tileSize;
            const screenY = canvas.height - (minY - camera.y) * tileSize;
            const screenW = (maxX - minX + 1) * tileSize;
            const screenH = -(maxY - minY + 1) * tileSize;

            ctx.fillStyle = "rgba(0, 255, 255, 0.2)"; 
            ctx.fillRect(screenX, screenY, screenW, screenH);

            ctx.strokeStyle = "#87CEFA";
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX, screenY, screenW, screenH);
        });
    }
    
// --- POLY (Lasso) ---
    if (window.selection.type === 'poly' && window.selection.path.length > 0) {
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        window.selection.path.forEach((point, index) => {
            const screenX = (point.x - camera.x) * tileSize; 
            const screenY = canvas.height - (point.y - camera.y) * tileSize;
            
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
    // 1. Primero actualizamos la posición de la cámara
    cameraMovement();
    
    // 2. Luego calculamos el mouse basándonos en la nueva cámara
    mouse.calculateCoordinates();
    
    // 3. Ahora sí, interacciones y dibujo sincronizados
    if (typeof mineAndPlace === 'function') mineAndPlace();
    drawWorld();
    drawMobs(); // ✨ AÑADIMOS ESTA LÍNEA AQUÍ
    drawUI();
    
    requestAnimationFrame(mainLoop);
}

function changeDimension(sceneIndex) {
    if (typeof mbwom !== 'undefined' && mbwom.world) {
        // Verificar si la escena existe (scene1, scene2, scene3)
        if (mbwom.world["scene" + sceneIndex]) {
            mbwom.loadScene(sceneIndex);
            initializeWorldCache(); // Recargar caché visual
            closeModal('dimensions-modal'); // Cerrar el modal
            
            // --- ACTUALIZAR ICONO EN LA INTERFAZ ---
            const iconElement = document.getElementById('current-dim-icon');
            if (iconElement) {
                switch(sceneIndex) {
                    case 1:
                        iconElement.src = "assets/Underworld icon.png";
                        break;
                    case 2:
                        iconElement.src = "assets/Nether icon.png";
                        break;
                    case 3:
                        iconElement.src = "assets/End icon.png";
                        break;
                }
            }
            
            console.log("Switched to dimension:", sceneIndex);
        } else {
            alert("This dimension is not generated in the current world.");
        }
    }
}