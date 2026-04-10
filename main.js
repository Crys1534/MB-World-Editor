window.liveTimeEnabled = false; // Apagado por defecto
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

// Agregamos el 10, 250 y 300
const ZOOM_LEVELS = [10, 25, 50, 100, 150, 200, 250, 300];

// El 100% ahora está en la posición 3 (0=10, 1=25, 2=50, 3=100)
let currentZoomIndex = 3; 
let currentZoom = 100;
const BASE_TILE_SIZE = 16;
let showGrid = false;
const grid = { width: 60, height: 30 };
let tileSize = BASE_TILE_SIZE;

// --- IMÁGENES GLOBALES ---
// Agrega aquí los nombres de los PNGs que vayas metiendo a la carpeta assets/
window.images = { names: ["blocks", "hotbar", "slot", "zombie", "skeleton", "creeper", "enderman", "nethereye", "enderdragon", "pig", "cow", "chicken", "Player",] };

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

// ✨ FIX: Radar de scroll apuntando a la nueva barra de estado
const statusRightZone = document.querySelector('.status-right');
if (statusRightZone) {
    statusRightZone.addEventListener('wheel', function(e) {
        e.preventDefault(); // Evita que la página haga scroll
        if (e.deltaY < 0) {
            // Scroll arriba (Zoom In)
            if (currentZoomIndex < ZOOM_LEVELS.length - 1) {
                currentZoomIndex++;
                updateZoomSlider(currentZoomIndex);
            }
        } else {
            // Scroll abajo (Zoom Out)
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
    
    // ✨ FIX: Solo intentamos inicializar el caché si existe mbwom Y la escena ya tiene datos adentro
    if (typeof mbwom !== 'undefined' && mbwom.scene && Array.isArray(mbwom.scene)) {
        for (let x = 0; x < mbwom.scene.length; x++) {
            // Un segundo seguro: verificamos que la columna 'x' también exista
            if (mbwom.scene[x]) {
                for (let y = 0; y < mbwom.scene[x].length; y++) {
                    renderBlock(x, y);
                }
            }
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
            if (mob.type === 'cow') { mobWidth = tileSize * 2.6; mobHeight = tileSize * 2; }
            
            let mobImg = window.images[mob.type];

            if (mobImg && mobImg.complete && mobImg.naturalWidth > 0) {
                ctx.save(); 
                ctx.translate(screenX, screenY);
                if (mob.direction === 1) ctx.scale(-1, 1);
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
			
			// ==========================================
            // ✨ INDICADOR MULTIJUGADOR (MOB BLOQUEADO)
            // ==========================================
            let miNombre = localStorage.getItem('mbw_username') || "Player";
            
            // Si alguien más lo movió en los últimos 2 segundos, consideramos que lo tiene "agarrado"
            if (mob.lockedBy && mob.lockedBy !== miNombre && mob.lastMoveTime && (Date.now() - mob.lastMoveTime < 500)) {
                
                // Pintamos un recuadro rojo suave encima del mob
                ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                
                // Mostramos un candado y el nombre de quién lo está moviendo
                ctx.fillStyle = "#FF5555";
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "center";
                ctx.shadowColor = "black"; ctx.shadowBlur = 3;
                ctx.fillText("🔒 " + mob.lockedBy, screenX, screenY - mobHeight - 22);
                ctx.shadowBlur = 0;
            }
        } catch (e) {
            console.error("Mob inválido saltado");
        }
    }
}

// ==========================================
// ✨ RENDERIZADO DEL JUGADOR ✨
// ==========================================
function drawPlayer() {
    // Verificamos que el mundo exista y tenga coordenadas del jugador
    if (typeof mbwom === 'undefined' || !mbwom.world) return;
    if (mbwom.world.worldX === undefined || mbwom.world.worldY === undefined) return;

    // Solo dibujamos al jugador si estamos en la dimensión correcta (Overworld = 1, Nether = 2, End = 3)
    // El juego nativo guarda la dimensión en la que te quedaste. Si no la tiene, asumimos 1.
    const playerScene = mbwom.world.scene || 1; 
    const currentScene = typeof mbwom.currentScene !== 'undefined' ? mbwom.currentScene : 1;
    if (playerScene !== currentScene) return;

    const playerWorldX = Number(mbwom.world.worldX);
    const playerWorldY = -Number(mbwom.world.worldY); // Y invertida nativa

    const screenX = (playerWorldX - camera.x) * tileSize;
    const screenY = canvas.height - (playerWorldY - camera.y) * tileSize;

    // Ignorar si está muy lejos de la pantalla para ahorrar RAM
    if (screenX < -200 || screenX > canvas.width + 200 || screenY < -200 || screenY > canvas.height + 200) {
        return;
    }

    const playerWidth = tileSize * 1.4;
    const playerHeight = tileSize * 2.0; // Altura de casi 2 bloques

    let playerImg = window.images['Player'];

    // Si tienes un archivo 'player.png' en assets, lo dibuja:
    if (playerImg && playerImg.complete && playerImg.naturalWidth > 0) {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            playerImg, 
            0, 0, playerImg.naturalWidth, playerImg.naturalHeight,
            -(playerWidth / 2), -playerHeight, playerWidth, playerHeight 
        );
        ctx.restore();
    } else {
        // Si no tienes imagen, dibuja un "Holograma de Steve" (Azul y Piel)
        ctx.fillStyle = "rgba(0, 100, 255, 0.6)"; // Camisa azul celeste
        ctx.fillRect(screenX - (playerWidth / 2), screenY - playerHeight, playerWidth, playerHeight);
        
        ctx.fillStyle = "rgba(255, 200, 150, 0.8)"; // Cabeza color piel
        ctx.fillRect(screenX - (playerWidth / 2), screenY - playerHeight, playerWidth, playerHeight * 0.3);

        ctx.strokeStyle = "#FFFFFF";
        ctx.strokeRect(screenX - (playerWidth / 2), screenY - playerHeight, playerWidth, playerHeight);
    }

    // Texto flotante brillante para no confundirlo con los monstruos
    ctx.fillStyle = "#00FFFF"; // Cyan neón
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "black"; ctx.shadowBlur = 4;
    ctx.fillText("PLAYER", screenX, screenY - playerHeight - 8);
    ctx.shadowBlur = 0;
}

// ✨ RELLENAR SELECCIÓN AL ESTILO PHOTOSHOP
window.fillSelectionWithBucket = function(blockState) {
    if (!window.selection || !window.selection.type) return false; // Falso si no hay selección
    
    let blocksUpdated = 0;

    // 1. Si es Varita Mágica
    if (window.selection.type === 'magic' && window.selection.points) {
        window.selection.points.forEach(p => {
            mbwom.setBlockState(p.x, p.y, blockState); // Cambiamos el bloque en el motor
            if (typeof renderBlock === 'function') renderBlock(p.x, p.y); // Actualizamos el caché
            blocksUpdated++;
        });
    } 
    // 2. Si es Selección Cuadrada
    else if (window.selection.type === 'rect') {
        const rects = [...window.selection.subRects];
        if (window.selection.p1 && window.selection.p2) rects.push({p1: window.selection.p1, p2: window.selection.p2});
        
        rects.forEach(r => {
            const minX = Math.min(r.p1.x, r.p2.x);
            const maxX = Math.max(r.p1.x, r.p2.x);
            const minY = Math.min(r.p1.y, r.p2.y);
            const maxY = Math.max(r.p1.y, r.p2.y);
            
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    mbwom.setBlockState(x, y, blockState);
                    if (typeof renderBlock === 'function') renderBlock(x, y);
                    blocksUpdated++;
                }
            }
        });
    }
    
    if (blocksUpdated > 0) {
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        // Opcional: Puedes descomentar la siguiente línea si quieres que la selección desaparezca tras pintar
        // window.selection = { type: null }; 
        return true; // Verdadero si pintó algo
    }
    
    return false;
};

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
		
		// ✨ MAGIA DE PHOTOSHOP: Línea punteada en movimiento
        ctx.setLineDash([6, 6]); // 6px de línea, 6px de espacio
        ctx.lineDashOffset = -(Date.now() / 50); // El tiempo hace que se mueva

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
		
		// ✨ IMPORTANTE: Reiniciar la línea a normal para que no afecte otros dibujos
        ctx.setLineDash([]);
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
			
			// ✨ MAGIA DE PHOTOSHOP
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -(Date.now() / 50);
			
            ctx.strokeRect(screenX, screenY, screenW, screenH);
			
			// ✨ REINICIAR
            ctx.setLineDash([]);
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
	
	// ==========================================
    // ✨ PREVISUALIZACIÓN FANTASMA DEL MOB ✨
    // ==========================================
    if (typeof currentTool !== 'undefined' && currentTool === 'spawn_mob' && typeof currentMobToSpawn !== 'undefined' && currentMobToSpawn) {
        let mobImg = window.images[currentMobToSpawn];
        
        if (mobImg && mobImg.complete && mobImg.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.6; // 👻 60% de transparencia
            ctx.imageSmoothingEnabled = false; // Mantiene el Pixel Art nítido
            
            // Calculamos el tamaño base usando tu tileSize
            let tSize = typeof tileSize !== 'undefined' ? tileSize : 16;
            let drawWidth = tSize * 1.2; 
            
            // Ajustes para monstruos de proporciones diferentes
            if (currentMobToSpawn === 'enderdragon') drawWidth = tSize * 6;
            if (currentMobToSpawn === 'ghast' || currentMobToSpawn === 'slime' || currentMobToSpawn === 'magmacube') drawWidth = tSize * 2.5;
            if (currentMobToSpawn === 'spider') drawWidth = tSize * 1.5;

            // Calculamos la altura para no deformar el sprite original
            let ratio = mobImg.naturalHeight / mobImg.naturalWidth;
            let drawHeight = drawWidth * ratio; 
            
            // Convertimos las coordenadas de tu ratón para que coincidan con la pantalla
            // (Tu mouse.canvasY está invertido, así que lo revertimos para dibujar)
            let screenX = mouse.canvasX;
            let screenY = canvas.height - mouse.canvasY;

            // Dibujamos el mob centrado horizontalmente y con los pies tocando la punta de tu cursor
            ctx.drawImage(
                mobImg, 
                0, 0, mobImg.naturalWidth, mobImg.naturalHeight,
                screenX - (drawWidth / 2), screenY - drawHeight, drawWidth, drawHeight
            );
            
            ctx.restore();
        }
    }
	
	// ✨ INDICADOR DE ESPECTADOR (OJO ROJO EN LA ESQUINA SUPERIOR DERECHA)
    if (typeof window.mySpectators !== 'undefined' && window.mySpectators.size > 0) {
        ctx.save();
        
        // Creamos el texto uniendo a todos los que nos están viendo
        const text = "👁️ " + Array.from(window.mySpectators).join(", ");
        ctx.font = "bold 16px Arial";
        
        const paddingX = 15;
        const paddingY = 8;
        const textWidth = ctx.measureText(text).width;
        const boxWidth = textWidth + (paddingX * 2);
        const boxHeight = 34;
        
        // Lo posicionamos arriba a la derecha
        const startX = canvas.width - boxWidth - 20;
        const startY = 20;

        // Fondo semitransparente oscuro
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(startX, startY, boxWidth, boxHeight);
        
        // Borde rojo que parpadea ligeramente
        ctx.strokeStyle = Math.floor(Date.now() / 500) % 2 === 0 ? "#ff7675" : "#e74c3c";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, boxWidth, boxHeight);

        // Texto
        ctx.fillStyle = "#ff7675";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, startX + (boxWidth / 2), startY + (boxHeight / 2));
        
        ctx.restore();
    }
}

function mainLoop() {
    // 1. Primero actualizamos la posición de la cámara
    cameraMovement();
    
    // 2. Luego calculamos el mouse basándonos en la nueva cámara
    mouse.calculateCoordinates();
    
    // 3. Ahora sí, interacciones y dibujo sincronizados
    // ✨ FIX: Solo permitimos usar herramientas (minar/colocar) si NO estamos espectando
    if (!window.spectatingTargetId) {
        if (typeof mineAndPlace === 'function') mineAndPlace();
    }
// 1. Dibujamos el mundo y personajes (tu código actual)
    drawWorld();
    if (typeof drawMobs === 'function') drawMobs(); 
    drawPlayer();

    // ==========================================
    // ✨ CICLO DE DÍA Y NOCHE (LIVE TIME INTEGRADO)
    // ==========================================
    const liveTimeToggle = document.getElementById('live-time-toggle');
    const timeInput = document.getElementById('gr-time');

    if (liveTimeToggle && liveTimeToggle.checked && timeInput) {
        
        // 1. Hacemos que el tiempo (0-99) avance automáticamente
        if (typeof window.lastTimeUpdate === 'undefined') window.lastTimeUpdate = Date.now();
        
        let ahora = Date.now();
        // 12000ms = 12 segundos (12s * 100 ticks = 1200s = 20 minutos)
        if (ahora - window.lastTimeUpdate >= 12000) { 
            let nuevoTiempo = Number(timeInput.value) + 1;
            if (nuevoTiempo > 99) nuevoTiempo = 0; // Reinicia al amanecer
            timeInput.value = nuevoTiempo;
            window.lastTimeUpdate = ahora;
		}

        // 2. Calculamos la oscuridad (Progreso del 0.0 al 1.0)
        let tiempo = Number(timeInput.value);
        let progreso = tiempo / 99; 
        
        let oscuridad = 0;
        let oscuridadMaxima = 0.75; // 75% negro
        
        // 🌅 Atardecer (Oscurece entre el 45 y 50)
        if (progreso > 0.45 && progreso <= 0.5) {
            oscuridad = ((progreso - 0.45) / 0.05) * oscuridadMaxima;
        } 
        // 🌌 Noche Cerrada (Entre el 50 y el 90)
        else if (progreso > 0.5 && progreso <= 0.9) {
            oscuridad = oscuridadMaxima;
        } 
        // 🌄 Amanecer (Aclara entre el 90 y el 99)
        else if (progreso > 0.9) {
            oscuridad = oscuridadMaxima - (((progreso - 0.9) / 0.1) * oscuridadMaxima);
        }

        // 3. Pintamos el cielo oscuro sobre el canvas
        if (oscuridad > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(5, 5, 20, ${oscuridad})`; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
    }

    // 2. DESPUÉS de la oscuridad, dibujamos la interfaz
    if (typeof drawUI === 'function') drawUI();
    
	// ✨ DIBUJAR CURSORES MULTIJUGADOR
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && window.networkCursors) {
        let ahora = Date.now();
        for (let autor in window.networkCursors) {
            let cursor = window.networkCursors[autor];
            
            // Si el amigo no ha movido el ratón en 5 segundos, ocultamos su cursor
            if (ahora - cursor.lastUpdate > 60000) continue; 

            // Convertimos sus coordenadas del mundo a la pantalla
            let screenX = (cursor.x - camera.x) * tileSize;
            let screenY = canvas.height - ((cursor.y - camera.y) * tileSize) - tileSize;

            // 1. Dibujamos el recuadro azul en el bloque
            ctx.fillStyle = "rgba(77, 166, 255, 0.4)";
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
            ctx.strokeStyle = "#4DA6FF";
            ctx.strokeRect(screenX, screenY, tileSize, tileSize);

            // 2. Dibujamos su nombre con sombra para que se lea perfecto
            ctx.fillStyle = "white";
            ctx.font = "16px 'Pixeltype', sans-serif";
            ctx.textAlign = "center";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            ctx.fillText(autor, screenX + (tileSize/2), screenY - 5);
            ctx.shadowBlur = 0; // Apagamos la sombra para lo demás

            // 3. ✨ DIBUJAMOS EL CURSOR FANTASMA (Flechita de ratón) ✨
            ctx.save();
            // Movemos el origen al centro del bloque para que la flecha apunte ahí
            ctx.translate(screenX + (tileSize / 2), screenY + (tileSize / 2));
            
            ctx.beginPath();
            ctx.moveTo(0, 0);       // Punta de la flecha
            ctx.lineTo(0, 17);      // Baja recto
            ctx.lineTo(4, 13);      // Quiebre interior
            ctx.lineTo(8, 20);      // Pata larga izquierda
            ctx.lineTo(11, 18);     // Pata larga derecha
            ctx.lineTo(7, 12);      // Quiebre interior derecho
            ctx.lineTo(13, 12);     // Lado derecho
            ctx.closePath();
            
            // La pintamos de blanco semi-transparente con borde negro
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)"; 
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
            ctx.stroke();
            
            ctx.restore();
        }
    }
	
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
                        iconElement.src = "assets/Overworld icon.png";
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


// ==========================================
// ✨ LÓGICA DEL MODAL MULTIJUGADOR (WIZARD)
// ==========================================

let multiplayerPlayerLimit = 2; // Por defecto

function setMpView(viewName) {
    // 1. Ocultar todas las vistas
    document.getElementById('mp-view-home').style.display = 'none';
    document.getElementById('mp-view-create-1').style.display = 'none';
    document.getElementById('mp-view-create-2').style.display = 'none';
    document.getElementById('mp-view-join').style.display = 'none';
    
    // Ocultar Status y Perfil por defecto
    document.getElementById('multiplayer-status').style.display = 'none';
    document.getElementById('mp-shared-profile').style.display = 'none';

    // 2. Mostrar la vista solicitada y cambiar el título
    const title = document.getElementById('mp-modal-title');
    
    if (viewName === 'home') {
        title.innerText = "🌐 Multiplayer";
        document.getElementById('mp-view-home').style.display = 'flex';
    } 
    else if (viewName === 'create-1') {
        title.innerText = "Create Server";
        document.getElementById('mp-shared-profile').style.display = 'flex';
        document.getElementById('mp-view-create-1').style.display = 'block';
        loadMpProfile(); // Cargar datos guardados
    }
    else if (viewName === 'create-2') {
        title.innerText = "Server Active";
        document.getElementById('mp-view-create-2').style.display = 'block';
        document.getElementById('multiplayer-status').style.display = 'block'; // Mostrar status
    }
    else if (viewName === 'join') {
        title.innerText = "Join Server";
        document.getElementById('mp-shared-profile').style.display = 'flex';
        document.getElementById('mp-view-join').style.display = 'block';
        document.getElementById('multiplayer-status').style.display = 'block'; // Mostrar status
        loadMpProfile(); // Cargar datos guardados
		
		// ✨ FIREBASE: Iniciar la búsqueda de servidores al instante
        if (typeof loadPublicServers === 'function') loadPublicServers();
    }
}

// Controlar los botones de Límite de Jugadores (1 al 6)
function setMpLimit(limit) {
    multiplayerPlayerLimit = limit;
    
    // Quitar la clase dorada a todos
    const btns = document.querySelectorAll('.mp-limit-btn');
    btns.forEach(btn => btn.classList.remove('selected-limit'));
    
    // Ponérsela solo al presionado
    btns[limit - 1].classList.add('selected-limit');
}

// Copiar el ID al dar clic
function copyRoomId() {
    const idInput = document.getElementById('my-peer-id');
    if (idInput.value.trim() !== "") {
        navigator.clipboard.writeText(idInput.value).then(() => {
            const hint = document.getElementById('copy-hint');
            hint.style.visibility = 'visible';
            setTimeout(() => { hint.style.visibility = 'hidden'; }, 2000);
        });
    }
}
// ==========================================
// ✨ PERFIL UNIFICADO EN TIEMPO REAL
// ==========================================

window.openUnifiedProfile = function() {
    openModal('unified-profile-modal');
    
    const savedPic = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    const savedName = localStorage.getItem('mbw_username') || "Player";
    
    document.getElementById('modal-global-pfp').src = savedPic;
    document.getElementById('global-profile-username').value = savedName;
};

window.handleGlobalProfileUpload = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Img = e.target.result;
            localStorage.setItem('mbw_profile_pic', base64Img);
            
            // 1. Actualiza el modal
            document.getElementById('modal-global-pfp').src = base64Img;
            
            // 2. Actualiza el botón de la barra superior
            const topImg = document.getElementById('top-profile-img');
            if (topImg) topImg.src = base64Img;
            
            // 3. Actualiza la vista del menú multijugador (si está abierta)
            const mpPreview = document.getElementById('mp-pfp-preview');
            if (mpPreview) mpPreview.style.backgroundImage = `url(${base64Img})`;

            // 4. Sincroniza con Firebase en tiempo real
            if (typeof myPresenceRef !== 'undefined' && myPresenceRef) {
                myPresenceRef.update({ pfp: base64Img });
            }
        };
        reader.readAsDataURL(file);
    }
};

window.handleGlobalUsernameChange = function(newName) {
    let cleanName = newName.trim() || 'Player';
    localStorage.setItem('mbw_username', cleanName);
    
    // Actualiza el input del menú multijugador por si estaba abierto
    const mpUsernameInput = document.getElementById('mp-username-input');
    if (mpUsernameInput) mpUsernameInput.value = cleanName;

    // Sincroniza con Firebase en tiempo real
    if (typeof myPresenceRef !== 'undefined' && myPresenceRef) {
        myPresenceRef.update({ username: cleanName });
    }
};

// Al cargar la página, restaurar datos y escuchar los clics
window.addEventListener('DOMContentLoaded', () => {
    const savedPic = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    const topImg = document.getElementById('top-profile-img');
    if (topImg) topImg.src = savedPic;

    // MAGIA: Esto hace que al dar clic en la foto del menú Multijugador (o en el input de nombre) se abra el Perfil Unificado
    document.body.addEventListener('click', (e) => {
        if (e.target && (e.target.id === 'mp-pfp-preview' || e.target.id === 'mp-username-input' || e.target.closest('#mp-pfp-preview'))) {
            // Evitamos comportamientos raros y abrimos la ventana
            e.preventDefault();
            openUnifiedProfile();
        }
    });
});


// ✨ FUNCIONES PARA EL MENÚ HELP
window.toggleHelpMenu = function() {
    document.getElementById("help-dropdown").classList.toggle("show");
};

window.closeHelpMenu = function() {
    let dropdown = document.getElementById("help-dropdown");
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove("show");
    }
};

// Cerrar el menú si el usuario hace clic fuera de él
document.addEventListener('click', function(event) {
    if (!event.target.matches('.icon-btn') && !event.target.closest('.dropdown-container')) {
        window.closeHelpMenu();
    }
});


// ==========================================
// ✨ ZOOM INTELIGENTE CON SCROLL EN EL CANVAS
// ==========================================
const canvasElement = document.getElementById('canvas');

if (canvasElement) {
    canvasElement.addEventListener('wheel', function(e) {
        e.preventDefault(); 

        let mX = (typeof mouse !== 'undefined' && mouse.canvasX !== null) ? mouse.canvasX : canvasElement.width / 2;
        let mY = (typeof mouse !== 'undefined' && mouse.canvasY !== null) ? mouse.canvasY : canvasElement.height / 2;

        // 1. Calculamos la posición EXACTA del mundo bajo el cursor
        let exactWorldX = camera.x + (mX / tileSize);
        let exactWorldY = camera.y + (mY / tileSize);

        let zoomed = false;
        if (e.deltaY < 0) {
            if (currentZoomIndex < ZOOM_LEVELS.length - 1) { currentZoomIndex++; zoomed = true; }
        } else {
            if (currentZoomIndex > 0) { currentZoomIndex--; zoomed = true; }
        }

        if (zoomed) {
            let nextZoom = ZOOM_LEVELS[currentZoomIndex];
            let newTileSize = BASE_TILE_SIZE * (nextZoom / 100);

            // 2. Ajustamos la cámara PRIMERO para el nuevo centro
            camera.x = exactWorldX - (mX / newTileSize);
            camera.y = exactWorldY - (mY / newTileSize);

            // 3. Llamamos a tu función de interfaz (esto actualiza tileSize globalmente y REDONDEA la cámara a enteros)
            updateZoomSlider(currentZoomIndex);

            // 4. ✨ EL FIX: Forzamos al ratón a recalcular su posición instantáneamente con el nuevo tamaño
            if (typeof mouse !== 'undefined' && mouse.canvasX !== null) {
                mouse.gridX = Math.floor(mouse.canvasX / tileSize);
                mouse.gridY = Math.floor(mouse.canvasY / tileSize);
                mouse.calculateCoordinates();
            }

            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
    }, { passive: false });
}