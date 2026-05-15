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
const ZOOM_LEVELS = [2, 5, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600];

// El 100% ahora está en la posición 3 (0=10, 1=25, 2=50, 3=100)
let currentZoomIndex = 6; 
let currentZoom = 100;
const BASE_TILE_SIZE = 16;
let showGrid = false;
const grid = { width: 60, height: 30 };
let tileSize = BASE_TILE_SIZE;

// --- IMÁGENES GLOBALES ---
// Agrega aquí los nombres de los PNGs que vayas metiendo a la carpeta assets/
window.images = { names: ["blocks", "hotbar", "slot", "nether-bg", "end-bg", "zombie", "skeleton", "creeper", "enderman", "nethereye", "enderdragon", "pig", "cow", "chicken", "Player", "slime", "magmacube", "chicken", "blaze", "squid", "ghast", "rabbit", "cowctus cow", "mushroom cow", "dog", "sheep", "snowgolem", "wolf", "spider", "snowgolem", "zombiepigman", "bat", "zombie_supremo"] };

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

window.toggleGrid = function(enabled) {
    showGrid = enabled;
    localStorage.setItem('mbw_show_grid', enabled); // Guardamos la decisión
    worldDirty = true;
};

// ✨ VARIABLE Y FUNCIÓN PARA CONTROLAR LOS FONDOS
window.showDimBackgrounds = true;

window.toggleDimBackgrounds = function(enabled) {
    window.showDimBackgrounds = enabled;
    worldDirty = true; // Forzamos al motor a redibujar el canvas al instante
};

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
    offscreenCtx.fillStyle = "#778fa5"; // Color base por defecto
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // 1. Detectamos la dimensión activa
    let currentScene = 1;
    if (typeof mbwom !== 'undefined') {
        currentScene = mbwom.currentScene || 1; 
    }

    // ✨ 2. Dibujamos el fondo correcto SOLO si la casilla está activada
    if (window.showDimBackgrounds) {
        if (currentScene === 2 && window.images['nether-bg'] && window.images['nether-bg'].complete) {
            offscreenCtx.drawImage(window.images['nether-bg'], 0, 0, offscreenCanvas.width, offscreenCanvas.height);
        } 
        else if (currentScene === 3 && window.images['end-bg'] && window.images['end-bg'].complete) {
            offscreenCtx.drawImage(window.images['end-bg'], 0, 0, offscreenCanvas.width, offscreenCanvas.height);
        }
    }

    // 3. Dibujamos los bloques
    for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
            const currentX = Math.floor(x + camera.x);
            const currentY = Math.floor(y + camera.y);
            
            const blockObject = getBlockCache(currentX, currentY);
            if (blockObject != null) {
                // ✨ FIX: Solapamiento Anti-Líneas para zooms extremos
                const values = {
                    x: Math.floor(x * tileSize),
                    y: Math.floor(canvas.height - y * tileSize),
                    
                    // Le sumamos un pequeño margen extra (0.8) para tapar los huecos decimales
                    width: Math.ceil(tileSize) + 0.8,
                    height: -(Math.ceil(tileSize) + 0.8),
                }
                drawBlock(blockObject, values, offscreenCtx);
            }
        }
    }
    
    // 4. Dibujamos la cuadrícula si está activada
    if (showGrid) {
        // ✨ FIX: Cuadrícula dinámica Anti-Neblina
        // Si el tamaño del bloque es menor a 4 píxeles, ni siquiera la dibujamos (evita lag y bloqueos visuales)
        if (tileSize >= 4) {
            
            // Calculamos una opacidad basada en el zoom.
            // A zoom normal (16px) se ve al 0.2 (20%). Si bajas de 10px, se va desvaneciendo hasta 0.
            let gridOpacity = 0.2;
            if (tileSize < 12) {
                // Matemáticas para desvanecer: (tamaño actual - mínimo) / (tamaño máximo - mínimo)
                gridOpacity = 0.2 * ((tileSize - 4) / (12 - 4)); 
            }
            
            offscreenCtx.strokeStyle = `rgba(255, 255, 255, ${gridOpacity})`;
            offscreenCtx.lineWidth = 2;
            offscreenCtx.beginPath();
            
            // Un pequeño ajuste para que las líneas se dibujen exactamente en el borde del píxel
            const offset = 0.5; 
            
            for (let x = 0; x <= grid.width; x++) {
                const xPos = Math.floor(x * tileSize) + offset;
                offscreenCtx.moveTo(xPos, 0);
                offscreenCtx.lineTo(xPos, offscreenCanvas.height);
            }
            for (let y = 0; y <= grid.height; y++) {
                const yPos = Math.floor(offscreenCanvas.height - (y * tileSize)) + offset;
                offscreenCtx.moveTo(0, yPos);
                offscreenCtx.lineTo(offscreenCanvas.width, yPos);
            }
            offscreenCtx.stroke();
        }
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
			
			if (mob.type === 'chicken' || mob.type === 'slime' || mob.type === 'magmacube') { 
			mobWidth = tileSize * 1; mobHeight = tileSize * 1; }
			
            if (mob.type === 'enderdragon') { 
			mobWidth = tileSize * 24; mobHeight = tileSize * 8; }
			
            if (mob.type === 'nethereye' || mob.type === 'rabbit' || mob.type === 'bat') { 
			mobWidth = tileSize * 0.75; mobHeight = tileSize * 0.75; }
			
            if (mob.type === 'pig' || mob.type === 'wolf' || mob.type === 'spider' || mob.type === 'sheep') { 
			mobWidth = tileSize * 2; mobHeight = tileSize * 1.2; }
			
            if (mob.type === 'enderman') { 
			mobWidth = tileSize * 1.2; mobHeight = tileSize * 3; }
			
			if (mob.type === 'squid') { 
			mobWidth = tileSize * 1; mobHeight = tileSize * 2; }
			
            if (mob.type === 'cow' || mob.type === 'cowctus cow' || mob.type === 'mushroom cow') { 
			mobWidth = tileSize * 2.6; mobHeight = tileSize * 2; }
            
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
    // 1. Buscamos en tu base de datos de ui-handler.js
    // Si no está ahí, asume 20 por defecto para evitar errores
    let maxHp = mob.maxHealth || (typeof MOBS_HP_DB !== 'undefined' ? MOBS_HP_DB[mob.type] : 20) || 20;
    
    // 2. Redondear la vida actual para evitar decimales extraños
    let currentHealth = Math.ceil(Number(mob.health));

    // 4. Calcular el porcentaje
    let hpPercent = Math.max(0, Math.min(1, currentHealth / maxHp)); 
    
    // 5. Dibujar el fondo oscuro de la barra
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(screenX - (mobWidth/2), screenY - mobHeight - 4, mobWidth, 4);
    
    // 6. Dibujar la barra verde/roja
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
    
    // ✨ FIX: Mostrar Width y Height al usar la herramienta Select
    const selDiv = document.getElementById('selection-overlay');
    if (selDiv) {
        // Verificamos si estamos arrastrando un cuadro de selección
        if (window.selection && window.selection.type === 'rect' && window.selection.p1 && window.selection.p2) {
            let w = Math.abs(window.selection.p2.x - window.selection.p1.x) + 1;
            let h = Math.abs(window.selection.p2.y - window.selection.p1.y) + 1;
            
            selDiv.innerText = `W: ${w} H: ${h}`;
            selDiv.style.display = 'block'; // Lo hacemos visible
        } else {
            selDiv.style.display = 'none'; // Lo ocultamos si no estamos seleccionando
        }
    }
    
    // --- CURSOR INTELIGENTE (Contorno Limpio) ---
    if (currentTool !== 'paste' && currentTool !== 'select' && currentTool !== 'lasso') {
        const size = (typeof toolSize !== 'undefined') ? toolSize : 1;
        
        // ✨ MAGIA: Calculamos el inicio y fin exacto para igualar el área real del pincel
        const offsetStart = Math.floor(size / 2);
        const offsetEnd = Math.floor((size - 1) / 2);
        
        ctx.strokeStyle = "#4DA6FF"; // Celeste
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(77, 166, 255, 0.2)"; // Relleno suave

        // Matemáticas para cortar las esquinas en modo círculo
        const centerX = -offsetStart + (size - 1) / 2;
        const centerY = -offsetStart + (size - 1) / 2;
        const radiusSq = (size / 2) ** 2;

        const isInside = (dx, dy) => {
            // Fuera de la caja cuadrada
            if (dx < -offsetStart || dx > offsetEnd || dy < -offsetStart || dy > offsetEnd) return false;
            // Fuera del círculo (si está activado)
            if (typeof toolRounded !== 'undefined' && toolRounded && size > 1) {
                return ((dx - centerX)**2 + (dy - centerY)**2 <= radiusSq);
            }
            return true;
        };

        ctx.beginPath();
        for (let dx = -offsetStart; dx <= offsetEnd; dx++) {
            for (let dy = -offsetStart; dy <= offsetEnd; dy++) {
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
        for (let dx = -offsetStart; dx <= offsetEnd; dx++) {
            for (let dy = -offsetStart; dy <= offsetEnd; dy++) {
                if (isInside(dx, dy)) {
                    const absX = mouse.worldX + dx;
                    const absY = mouse.worldY + dy;
                    const drawX = (absX - camera.x) * tileSize;
                    const drawY = canvas.height - (absY - camera.y) * tileSize; 

                    const left = drawX;
                    const right = drawX + tileSize;
                    const bottom = drawY; 
                    const top = drawY - tileSize;

                    // Dibujar borde solo en las orillas
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
	
	// --- ✨ PREVIEW FANTASMA DEL PIXEL ART ---
    if (typeof currentTool !== 'undefined' && currentTool === 'pixelart' && window.pendingPixelArt && window.pendingPixelArt.imgCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.5; // 70% de visibilidad fantasma
        ctx.imageSmoothingEnabled = false; 
        const startX = Math.floor(mouse.worldX);
        const startY = Math.floor(mouse.worldY);
        const screenX = (startX - camera.x) * tileSize;
        const screenY = canvas.height - (startY - camera.y) * tileSize;
        const drawY = screenY - tileSize; 
        const drawWidth = window.pendingPixelArt.width * tileSize;
        const drawHeight = window.pendingPixelArt.height * tileSize;

        ctx.drawImage(window.pendingPixelArt.imgCanvas, screenX, drawY, drawWidth, drawHeight);

        ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -(Date.now() / 50); 
        ctx.strokeRect(screenX, drawY, drawWidth, drawHeight);
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
            
            // ✨ AQUÍ ESTÁ EL CAMBIO: Le decimos al motor en qué dimensión estamos ✨
            mbwom.currentScene = sceneIndex; 
            
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

// ==========================================
// ⚙️ MENÚ ADDONS - TOGGLE
// ==========================================
window.toggleAddonsMenu = function() {
    const menu = document.getElementById('addons-dropdown');
    const container = document.getElementById('addons-dropdown-container');
    const btn = container.querySelector('.tab-btn');

    menu.classList.toggle('show');
    
    // ✨ Si el menú está abierto, le ponemos tu clase .active
    if (menu.classList.contains('show')) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
};

// ==========================================
// 🗄️ BÓVEDA DE SKINS (IndexedDB) Y LECTOR RAM
// ==========================================
const skinDB = {
    dbName: "MBW_SkinsDB", storeName: "skins",
    init: function() {
        return new Promise((resolve, reject) => {
            let request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => { let db = e.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName); };
            request.onsuccess = (e) => resolve(e.target.result); request.onerror = (e) => reject(e.target.error);
        });
    },
    saveSkin: async function(id, base64Data) {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let tx = db.transaction(this.storeName, "readwrite");
            tx.objectStore(this.storeName).put({ data: base64Data, time: Date.now() }, String(id));
            tx.oncomplete = () => resolve(); tx.onerror = () => reject();
        });
    },
    getSkin: async function(id) {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let tx = db.transaction(this.storeName, "readonly");
            let req = tx.objectStore(this.storeName).get(String(id));
            req.onsuccess = () => { let res = req.result; resolve(res ? (res.data || res) : null); };
            req.onerror = () => resolve(null);
        });
    },
    getAllSorted: async function() {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let tx = db.transaction(this.storeName, "readonly");
            let store = tx.objectStore(this.storeName);
            let reqValues = store.getAll(); let reqKeys = store.getAllKeys();
            tx.oncomplete = () => {
                let values = reqValues.result || []; let keys = reqKeys.result || [];
                let combined = keys.map((key, index) => { return { id: key, time: values[index].time || 0, base64: values[index].data || values[index] }; });
                combined.sort((a, b) => b.time - a.time); resolve(combined);
            };
            tx.onerror = () => resolve([]);
        });
    }
};

window.skinCache = window.skinCache || {}; 
window.skinFetchInProgress = window.skinFetchInProgress || {};

window.getSpawnskinImage = function(skinID) {
    if (window.skinCache[skinID]) return window.skinCache[skinID];
    if (!window.skinFetchInProgress[skinID]) {
        window.skinFetchInProgress[skinID] = true;
        const localImg = new Image();
        localImg.onload = function() { window.skinCache[skinID] = localImg; if (typeof worldDirty !== 'undefined') worldDirty = true; };
        localImg.onerror = function() {
            skinDB.getSkin(skinID).then(base64Data => {
                if (base64Data) {
                    const img = new Image();
                    img.onload = function() { if (typeof worldDirty !== 'undefined') worldDirty = true; };
                    img.src = base64Data; window.skinCache[skinID] = img;
                } else {
                    window.skinCache[skinID] = { hasFailed: true };
                    if (typeof worldDirty !== 'undefined') worldDirty = true;
                }
            });
        };
        localImg.src = `assets/spawnskins/${skinID}.png`;
    }
    return null;
};

window.openSpawnskinsModal = function() { if (typeof openModal === 'function') openModal('spawnskins-addon-modal'); refreshLoadedSkinsList(); };
window.closeSpawnskinsModal = function() { if (typeof closeModal === 'function') closeModal('spawnskins-addon-modal'); const listDiv = document.getElementById('loaded-skins-list'); if (listDiv) listDiv.innerHTML = ""; };

window.refreshLoadedSkinsList = async function() {
    const listDiv = document.getElementById('loaded-skins-list'); if (!listDiv) return;
    listDiv.innerHTML = "<div style='text-align:center; color:#333; font-size:12px; margin-top: 10px;'>Buscando...</div>";
    try {
        const skins = await skinDB.getAllSorted(); listDiv.innerHTML = "";
        if (skins.length === 0) { listDiv.innerHTML = "<div style='text-align:center; color:#333; font-size:12px; margin-top: 10px; font-weight: bold;'>Ninguna skin cargada aún</div>"; return; }
        for (let skin of skins) {
            const item = document.createElement('div');
            item.style.cssText = `background: #fff; border: 1px solid #555; padding: 4px 6px; font-size: 11px; font-family: monospace; color: #000; border-radius: 3px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;`;
            item.innerHTML = `<span>📄 ${skin.id}.png</span><div style="width: 32px; height: 44px; border: 1px solid #ccc; border-radius: 2px; flex-shrink: 0; overflow: hidden; background: #8B8B8B;"><div style="width: 16px; height: 22px; background-image: url('${skin.base64}'); background-position: left top; background-repeat: no-repeat; image-rendering: pixelated; transform: scale(2); transform-origin: top left;"></div></div>`;
            listDiv.appendChild(item);
        }
    } catch (e) { listDiv.innerHTML = "<div style='text-align:center; color:#c0392b; font-size:12px;'>Error al cargar lista</div>"; }
};

window.importLocalSkins = function(event) {
    const files = event.target.files; if (!files || files.length === 0) return;
    let loadedCount = 0;
    for (let file of files) {
        const skinID = file.name.replace(/\.[^/.]+$/, ""); const reader = new FileReader();
        reader.onload = async function(e) {
            const base64 = e.target.result; await skinDB.saveSkin(skinID, base64);
            const img = new Image(); img.onload = () => { if (typeof worldDirty !== 'undefined') worldDirty = true; }; img.src = base64;
            window.skinCache[skinID] = img; loadedCount++;
            if (loadedCount === files.length) { document.getElementById('skin-upload-input').value = ""; refreshLoadedSkinsList(); }
        };
        reader.readAsDataURL(file);
    }
};

window.processSpawnskinUpload = function(event) {
    var file = event.target.files[0]; if (!file) return;
    var listContainer = document.getElementById('loaded-skins-list');
    if (listContainer) listContainer.innerHTML = "<em style='color: white;'>Procesando archivo...</em>";
    var reader = new FileReader();
    reader.onload = function(e) {
        var encodedString = e.target.result; var worldData = null;
        try { worldData = JSON.parse(encodedString); } catch (error) {
            try {
                var decodedString = "";
                for (var a = 0, b = encodedString.length; a < b; ) {
                    var c = a++; var characterCode = encodedString.charCodeAt(c) - (c * 5 % 33 + 1);
                    if (characterCode < 0) characterCode = 0; 
                    decodedString += String.fromCodePoint(characterCode);
                }
                worldData = JSON.parse(decodedString);
            } catch (err2) { if (listContainer) listContainer.innerHTML = "<strong style='color:#ff6b6b;'>Error: Archivo corrupto.</strong>"; event.target.value = ""; return; }
        }
        var skinsEncontradas = []; var skinsProcesadas = new Set();
        if (worldData) {
            var gruposMobs = [worldData.mobs1, worldData.mobs2, worldData.mobs3];
            gruposMobs.forEach(function(grupo) {
                if (grupo) {
                    for (var key in grupo) {
                        var mob = grupo[key];
                        if (mob.type === "spawnskin" && mob.skin && !skinsProcesadas.has(mob.skin)) {
                            skinsProcesadas.add(mob.skin); skinsEncontradas.push({ name: mob.name || "Sin nombre", skinId: mob.skin });
                        }
                    }
                }
            });
        }
        if (skinsEncontradas.length > 0) {
            window.editorImportedSkins = skinsEncontradas;
            var html = "<div style='color: white; margin-bottom: 5px; font-size: 12px;'>Skins importadas: " + skinsEncontradas.length + "</div>";
            skinsEncontradas.forEach(function(skin) {
                html += `<div style='background: #E0E0E0; border: 2px solid #555; padding: 5px; border-radius: 3px; display: flex; align-items: center; gap: 8px; margin-bottom: 5px;'>  <img src='https://mineblocks.com/1/skins/${skin.skinId}.png' alt='Skin' style='width: 32px; height: 32px; object-fit: contain; image-rendering: pixelated; border: 1px solid #999; background: #fff;' onerror='this.style.display="none"'>  <div style='font-size: 11px; line-height: 1.2; word-break: break-all; color: #000;'>    <strong>${skin.name}</strong><br>    <span style='color: #444;'>ID: ${skin.skinId}</span>  </div></div>`;
            });
            if (listContainer) listContainer.innerHTML = html;
        } else {
            if (listContainer) listContainer.innerHTML = "<em style='color: white; font-size: 12px;'>No se encontraron skins.</em>";
        }
        event.target.value = "";
    };
    reader.readAsText(file);
};

// ==========================================
// 🖼️ ADDON: PIXEL ART AUTO-BUILDER
// ==========================================
window.openPixelArtModal = function() { if (typeof openModal === 'function') openModal('pixelart-addon-modal'); };
const blockPalette = {
    "cloth_white": [225, 225, 225], "cloth_lightgray": [160, 160, 160], "cloth_gray": [85, 85, 85], "cloth_black": [25, 25, 25], "cloth_brown": [85, 55, 30], "cloth_purple": [120, 50, 155], "cloth_magenta": [185, 65, 175], "cloth_red": [165, 45, 45], "cloth_orange": [225, 115, 35], "cloth_pink": [235, 140, 165], "cloth_yellow": [225, 200, 45], "cloth_lightgreen": [115, 185, 25], "cloth_green": [65, 105, 35], "cloth_cyan": [45, 115, 135], "cloth_lightblue": [105, 155, 210], "cloth_blue": [45, 60, 150], "cloth_rainbow": [200, 200, 200],
    "br": [80, 80, 80], "r": [120, 120, 120], "cs": [105, 105, 105], "ms": [95, 115, 80], "ms1": [95, 115, 80], "ms2": [95, 115, 80], "dt": [134, 96, 67], "dt_1": [110, 140, 65], "farm": [102, 70, 46], "myc": [111, 99, 105], "gdt": [119, 85, 58], "cdt": [119, 85, 58], "sb": [218, 210, 158], "sd": [218, 210, 158], "ss": [215, 205, 150], "ssd": [215, 205, 150], "gv": [130, 125, 120], "cy1": [160, 166, 179], "snowblock": [240, 250, 250], "ice": [160, 200, 255], "fice": [160, 200, 255], "fice_1": [160, 200, 255], "fice_2": [160, 200, 255], "fice_3": [160, 200, 255], "fice_4": [160, 200, 255],
    "wp": [160, 130, 80], "wd1": [100, 80, 50], "wd_1": [100, 80, 50], "wd_2": [100, 80, 50], "fw1": [100, 80, 50], "fw2": [100, 80, 50], "j": [150, 110, 80], "hai_1": [200, 180, 40], "hay": [200, 170, 30], "hay_1": [200, 170, 30], "hay_2": [200, 170, 30], "lv": [65, 125, 45], "lv1": [70, 110, 50], "lv2": [50, 90, 60], "lv3": [80, 130, 40], "lv4": [60, 100, 40], "lgr": [130, 200, 40], "pk": [220, 140, 30], "jl": [250, 150, 30], "mel": [100, 140, 50], "lemonb": [245, 230, 70],
    "bricks": [145, 80, 70], "books": [115, 90, 55], "bbb": [220, 220, 210], "dsb": [55, 55, 60], "clore": [90, 90, 90], "in": [135, 130, 125], "gd": [140, 135, 120], "dmore": [110, 130, 135], "rs": [130, 90, 90], "os": [25, 20, 35], "lap": [90, 100, 130], "egem": [100, 130, 100], "to": [140, 125, 90], "ib": [230, 230, 230], "gb": [248, 224, 70], "db": [99, 219, 213], "lapb": [39, 67, 138], "clb": [20, 20, 20], "top": [255, 180, 50], "tob": [255, 165, 45], "ob": [25, 15, 35],
    "n": [110, 55, 55], "nb": [45, 20, 25], "rnb": [95, 30, 35], "magma": [210, 95, 30], "glow": [235, 195, 100], "light": [255, 240, 180], "coral": [230, 115, 145], "es": [220, 225, 165], "pf": [165, 115, 165], "portalstone": [55, 115, 120],
    "bdcloth_white": [112, 112, 112], "bdcloth_black": [12, 12, 12], "bddt": [67, 48, 33], "bdr": [60, 60, 60], "bdcs": [52, 52, 52], "bdbbb": [110, 110, 105], "bdbricks": [72, 40, 35], "bdbooks": [57, 45, 27], "bdsb": [109, 101, 80], "bdwp": [80, 65, 40], "bdnb": [22, 10, 12], "bb": [57, 45, 27], "bdob": [12, 7, 18]
};

function getClosestBlock(r, g, b) {
    let closestBlock = "cloth_white"; let minDistance = Infinity;
    for (let block in blockPalette) {
        let [br, bg, bb] = blockPalette[block];
        let distance = Math.sqrt(Math.pow(r - br, 2) + Math.pow(g - bg, 2) + Math.pow(b - bb, 2));
        if (distance < minDistance) { minDistance = distance; closestBlock = block; }
    }
    return closestBlock;
}

// 1. EL PROCESADOR DE IMAGEN (Lee el archivo y activa la herramienta)
window.processPixelArt = function(event) {
    try {
        const file = event.target.files[0]; 
        if (!file) return;
        
        const widthInput = document.getElementById('pixelart-max-width');
        const maxWidth = widthInput ? parseInt(widthInput.value) || 64 : 64;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    let scale = 1; 
                    if (img.width > maxWidth) scale = maxWidth / img.width;
                    const finalWidth = Math.floor(img.width * scale); 
                    const finalHeight = Math.floor(img.height * scale);
                    
                    const tempCanvas = document.createElement('canvas'); 
                    tempCanvas.width = finalWidth; 
                    tempCanvas.height = finalHeight;
                    const tempCtx = tempCanvas.getContext('2d'); 
                    tempCtx.drawImage(img, 0, 0, finalWidth, finalHeight);
                    
                    const ditherCheckbox = document.getElementById('pixelart-dithering');
                    const wantsDithering = ditherCheckbox ? ditherCheckbox.checked : true;
                    
                    window.pendingPixelArt = { 
                        data: tempCtx.getImageData(0, 0, finalWidth, finalHeight).data, 
                        width: finalWidth, 
                        height: finalHeight, 
                        imgCanvas: tempCanvas,
                        dithering: wantsDithering
                    };
                    
                    // ✨ FIX: Cambiar la herramienta de forma segura
                    if (typeof currentTool !== 'undefined') currentTool = 'pixelart';
                    else window.currentTool = 'pixelart';
                    
                    alert("✅ ¡Imagen procesada!\nCierra este menú y haz clic en el mapa para pegarla.");
                    
                    if (typeof closeModal === 'function') closeModal('pixelart-addon-modal');
                    const uploadInput = document.getElementById('pixelart-upload');
                    if(uploadInput) uploadInput.value = "";
                } catch(err) {
                    alert("Error al procesar la imagen: " + err.message);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } catch(err) {
        alert("Error de lectura: " + err.message);
    }
};


// 2. EL CONSTRUCTOR (Pega los bloques en el mundo con Dithering opcional)
window.buildPixelArtInWorld = function(pD, w, h, sX, sY, useDithering) {
    try {
        if (typeof historyManager !== 'undefined') historyManager.startAction();
        
        let floatData = new Float32Array(pD);
        
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4; 
                // Ignorar transparencias
                if (floatData[i + 3] < 50) continue; 

                const oldR = floatData[i];
                const oldG = floatData[i + 1];
                const oldB = floatData[i + 2];

                // Buscar bloque más cercano
                const bT = getClosestBlock(oldR, oldG, oldB);
                const paletteColor = blockPalette[bT] || [255, 255, 255];
                const newR = paletteColor[0];
                const newG = paletteColor[1];
                const newB = paletteColor[2];

                const bX = Math.floor(sX + x);
                const bY = Math.floor(sY - y);
                
                // Colocar en el mapa
                if (typeof mbwom !== 'undefined' && typeof mbwom.setBlockState === 'function') {
                    const cS = mbwom.getBlockState(bX, bY);
                    const nS = { type: bT };
                    if (typeof historyManager !== 'undefined') historyManager.recordChange(bX, bY, cS, nS);
                    mbwom.setBlockState(bX, bY, nS); 
                    if (typeof renderBlock === 'function') renderBlock(bX, bY);
                }

                // Aplicar Dithering (Floyd-Steinberg)
                if (useDithering) {
                    const errR = oldR - newR;
                    const errG = oldG - newG;
                    const errB = oldB - newB;

                    const addErr = (nx, ny, factor) => {
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            const ni = (ny * w + nx) * 4;
                            floatData[ni] += errR * factor;
                            floatData[ni + 1] += errG * factor;
                            floatData[ni + 2] += errB * factor;
                        }
                    };

                    addErr(x + 1, y,     7 / 16);
                    addErr(x - 1, y + 1, 3 / 16);
                    addErr(x,     y + 1, 5 / 16);
                    addErr(x + 1, y + 1, 1 / 16);
                }
            }
        }
        
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        if (typeof historyManager !== 'undefined') historyManager.commitAction();
        
        return true;
    } catch(e) {
        alert("Error al construir en el mundo: " + e.message);
        return false;
    }
};


// 3. EL EVENTO CLIC (Detecta el ratón en el canvas)
function setupPixelArtClicker() {
    window.removeEventListener('mousedown', handlePixelArtClick);
    window.addEventListener('mousedown', handlePixelArtClick);
}

function handlePixelArtClick(e) {
    // Evitar que reaccione si haces clic en menús o la barra superior
    if (e.target.id !== 'canvas' && e.target.tagName !== 'CANVAS') return;
    
    // Leer la herramienta correcta
    let activeTool = typeof currentTool !== 'undefined' ? currentTool : window.currentTool;
    
    if (window.pendingPixelArt && activeTool === 'pixelart') {
        const worldX = Math.floor(mouse.worldX); 
        const worldY = Math.floor(mouse.worldY);
        
        const success = window.buildPixelArtInWorld(
            window.pendingPixelArt.data, 
            window.pendingPixelArt.width, 
            window.pendingPixelArt.height, 
            worldX, 
            worldY,
            window.pendingPixelArt.dithering
        );
        
        if (success) {
            window.pendingPixelArt = null; 
            if (typeof selectTool === 'function') selectTool('move'); 
            else if (typeof currentTool !== 'undefined') currentTool = 'move';
            
            alert("🎨 ¡Pixel Art pegado con éxito!");
        }
    }
}

// Inicializar el evento sin importar cuándo cargue la página
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPixelArtClicker); 
} else {
    setupPixelArtClicker(); 
}

// Inicializador seguro
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPixelArtClicker); 
} else {
    setupPixelArtClicker(); 
}
if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", setupPixelArtClicker); } else { setupPixelArtClicker(); }

// ==========================================
// 🖱️ LIMPIADOR GLOBAL DE CLICS (Cerrar menús y paneles)
// ==========================================
window.addEventListener('click', function(e) {
    
    // --- 1. LÓGICA PARA ADDONS (Lo que ya teníamos) ---
    const addonsContainer = document.getElementById('addons-dropdown-container');
    const addonsMenu = document.getElementById('addons-dropdown');
    
    if (addonsContainer && !addonsContainer.contains(e.target)) {
        if (addonsMenu && addonsMenu.classList.contains('show')) {
            addonsMenu.classList.remove('show');
            const addonsBtn = addonsContainer.querySelector('.tab-btn');
            if (addonsBtn) addonsBtn.classList.remove('active');
        }
    }

    // --- 2. ✨ NUEVO: CERRAR WORLD INFO AL CAMBIAR DE PESTAÑA ---
    // Detectamos si el clic ocurrió dentro de cualquier botón con la clase .tab-btn
    const clickedTab = e.target.closest('.tab-btn');
    
    // Si hicimos clic en un .tab-btn, y ese botón NO ES el de World Info...
    if (clickedTab && clickedTab.id !== 'btn-world-info') {
        const sidebar = document.getElementById('world-info-sidebar');
        
        // Verificamos si el panel lateral está abierto
        if (sidebar && sidebar.style.display === 'flex') {
            sidebar.style.display = 'none'; // Lo cerramos
            
            // Apagamos la pestaña
            const infoBtn = document.getElementById('btn-world-info');
            if (infoBtn) infoBtn.classList.remove('active');
            
            // Regresamos el control de zoom a su posición original
            const zoomControl = document.getElementById('zoom-floating');
            if (zoomControl) zoomControl.style.right = '20px'; 
        }
    }
});

// ==========================================
// 🛑 BLOQUEADOR DE ATAJOS MIENTRAS SE ESCRIBE
// ==========================================
window.addEventListener('keydown', function(e) {
    // Lista de los IDs donde no queremos que funcionen los atajos
    const inputsProtegidos = ['inventory-search', 'ci-preview-title', 'custom-chest-name'];
    
    // Si el elemento donde estamos escribiendo tiene uno de esos IDs...
    if (inputsProtegidos.includes(e.target.id)) {
        e.stopPropagation(); // 🛡️ Detiene la tecla para que no active los atajos globales
    }
}, true); // <-- ¡Ese 'true' al final es la magia! Atrapa la tecla ANTES que el resto de tu código.

// ==========================================
// 🖱️ CAMBIAR TAMAÑO DE HERRAMIENTA CON LA RUEDA DEL RATÓN
// ==========================================
const toolSizeSlider = document.getElementById('tool-size-slider');
const toolSizeDisplay = document.getElementById('tool-size-display'); // Opcional: También en la cajita de texto

function handleWheelZoom(e) {
    e.preventDefault(); // 🛡️ Evita que toda la página haga scroll hacia abajo/arriba

    let currentVal = parseInt(toolSizeSlider.value);
    
    // Si la rueda va hacia arriba (negativo), sumamos 1. Si va hacia abajo (positivo), restamos 1.
    if (e.deltaY < 0) {
        currentVal++;
    } else {
        currentVal--;
    }

    // Usamos el 'blur' mágico que configuramos antes para que actualice la barra Y el texto al mismo tiempo
    if (typeof updateToolSize === 'function') {
        updateToolSize(currentVal, 'blur');
    }
}

// Le agregamos el detector a la barra deslizante
if (toolSizeSlider) {
    toolSizeSlider.addEventListener('wheel', handleWheelZoom, { passive: false });
}

// Opcional y muy recomendado: Se lo agregamos también al numerito por si el usuario pone el ratón ahí
if (toolSizeDisplay) {
    toolSizeDisplay.addEventListener('wheel', handleWheelZoom, { passive: false });
}