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
window.images = { names: ["blocks", "hotbar", "slot", "nether-bg", "end-bg", "zombie", "skeleton", "creeper", "enderman", "nethereye", "spawnskin", "enderdragon", "pig", "cow", "chicken", "Player", "slime", "magmacube", "chicken", "blaze", "squid", "ghast", "rabbit", "cowctus cow", "mushroom cow", "dog", "sheep", "snowgolem", "wolf", "spider", "snowgolem", "zombiepigman", "bat", "zombie_supremo"] };

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
    
    // 4. Dibujamos la cuadrícula si está activada
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
// 🎨 LECTOR DE SKINS DESDE LA BÓVEDA
// ==========================================
window.skinCache = window.skinCache || {}; 
window.skinFetchInProgress = window.skinFetchInProgress || {};

window.getSpawnskinImage = function(skinID) {
    // 1. Si ya está en la memoria RAM lista para usarse, la entregamos
    if (window.skinCache[skinID]) {
        return window.skinCache[skinID];
    }

    // 2. Si no está en RAM y no la estamos buscando aún, vamos a la Bóveda (IndexedDB)
    if (!window.skinFetchInProgress[skinID]) {
        window.skinFetchInProgress[skinID] = true; // Bloqueamos para no buscarla 100 veces por segundo
        
        skinDB.getSkin(skinID).then(base64Data => {
            if (base64Data) {
                // ¡La encontró en la bóveda! La preparamos para el Canvas
                const img = new Image();
                img.onload = function() {
                    if (typeof worldDirty !== 'undefined') worldDirty = true; // Forzamos un redibujado
                };
                img.src = base64Data;
                window.skinCache[skinID] = img;
            } else {
                // No está en la bóveda. El usuario no la ha importado.
                window.skinCache[skinID] = { hasFailed: true };
                if (typeof worldDirty !== 'undefined') worldDirty = true;
            }
        });
    }

    // 3. Mientras la busca (o si falló), devolvemos null para que el Canvas dibuje la caja rosa
    return null;
};

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
                mobWidth = tileSize * 1; mobHeight = tileSize * 1; 
            } else if (mob.type === 'enderdragon') { 
                mobWidth = tileSize * 24; mobHeight = tileSize * 8; 
            } else if (mob.type === 'nethereye' || mob.type === 'rabbit' || mob.type === 'bat') { 
                mobWidth = tileSize * 0.75; mobHeight = tileSize * 0.75; 
            } else if (mob.type === 'pig' || mob.type === 'wolf' || mob.type === 'spider' || mob.type === 'sheep') { 
                mobWidth = tileSize * 2; mobHeight = tileSize * 1.2; 
            } else if (mob.type === 'enderman') { 
                mobWidth = tileSize * 1.2; mobHeight = tileSize * 3; 
            } else if (mob.type === 'squid') { 
                mobWidth = tileSize * 1; mobHeight = tileSize * 2; 
            } else if (mob.type === 'cow' || mob.type === 'cowctus cow' || mob.type === 'mushroom cow') { 
                mobWidth = tileSize * 2.6; mobHeight = tileSize * 2; 
            }

            // ✨ LÓGICA DE SKINS LOCALES ✨
            let mobImg = null;
            let isCustomSkin = false;

            if (mob.type === 'spawnskin' && mob.skin) {
                mobImg = window.getSpawnskinImage(mob.skin);
                isCustomSkin = true;
                mobWidth = tileSize * 1.4; // Ajuste para que se vea bien la skin
                mobHeight = tileSize * 2.0; 
            } else {
                mobImg = window.images[mob.type];
            }

            // Si es un spawnskin y no encontró la imagen en la carpeta, usamos la por defecto
            if (isCustomSkin && mobImg && mobImg.hasFailed) {
                mobImg = window.images['spawnskin']; 
            }

            // DIBUJAMOS LA IMAGEN
            if (mobImg && mobImg.complete && mobImg.naturalWidth > 0) {
                ctx.save(); 
                ctx.translate(screenX, screenY);
                if (mob.direction === 1) ctx.scale(-1, 1);
                ctx.imageSmoothingEnabled = false;

                // ✨ LA MAGIA DEL RECORTE (SPRITE CROPPING) ✨
                let sourceX = 0;
                let sourceY = 0;
                let sourceWidth = mobImg.naturalWidth;
                let sourceHeight = mobImg.naturalHeight;

                // Si es un spawnskin, ignoramos el tamaño de la hoja de sprites
                // y "recortamos" estrictamente el rectángulo de 16x22px
                if (isCustomSkin) {
                    sourceWidth = 16;
                    sourceHeight = 22;
                }

                ctx.drawImage(
                    mobImg, 
                    sourceX, sourceY, sourceWidth, sourceHeight,     // QUÉ parte de la imagen original tomar
                    -(mobWidth / 2), -mobHeight, mobWidth, mobHeight // DÓNDE y de qué tamaño dibujarlo en el Canvas
                );
                
                ctx.restore(); 

                // Si falló y estamos usando la textura de reemplazo, avisamos
                if (isCustomSkin && window.skinCache[mob.skin] && window.skinCache[mob.skin].hasFailed) {
                    ctx.fillStyle = "#FF5555";
                    ctx.font = "bold 10px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText("Falta " + mob.skin + ".png", screenX, screenY - (mobHeight / 2));
                }
            } else {
                // MIENTRAS CARGA LA IMAGEN
                let color = "rgba(255, 0, 0, 0.4)"; 
                if (mob.type === 'zombie') color = "rgba(46, 125, 50, 0.5)";
                else if (mob.type === 'skeleton') color = "rgba(224, 224, 224, 0.5)";
                else if (mob.type === 'enderman') color = "rgba(49, 27, 146, 0.5)";
                else if (mob.type === 'spawnskin') color = "rgba(255, 0, 255, 0.5)";
                
                ctx.fillStyle = color;
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
            }

            // ✨ EFECTO DE SELECCIÓN ESTILO "ARCHIVO WINDOWS" ✨
            if (typeof selectedMob !== 'undefined' && mob === selectedMob && typeof currentTool !== 'undefined' && currentTool === 'move') {
                ctx.fillStyle = "rgba(0, 120, 215, 0.3)";
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                
                ctx.strokeStyle = "#0078D7";
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                ctx.lineWidth = 1; 
            }
            
            // Nombre
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.shadowColor = "black"; ctx.shadowBlur = 4;
            let displayName = mob.name ? String(mob.name) : (mob.type === 'spawnskin' && mob.skin ? "Skin: " + mob.skin : String(mob.type).toUpperCase());
            ctx.fillText(displayName, screenX, screenY - mobHeight - 8);
            ctx.shadowBlur = 0; 
            
            // Barra de Vida
            if (mob.health !== undefined) {
                let maxHp = mob.maxHealth || (typeof MOBS_HP_DB !== 'undefined' ? MOBS_HP_DB[mob.type] : 20) || 20;
                let currentHealth = Math.ceil(Number(mob.health));
                let hpPercent = Math.max(0, Math.min(1, currentHealth / maxHp)); 
                
                ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fillRect(screenX - (mobWidth/2), screenY - mobHeight - 4, mobWidth, 4);
                
                ctx.fillStyle = hpPercent > 0.3 ? "#00FF00" : "#FF0000";
                ctx.fillRect(screenX - (mobWidth/2), screenY - mobHeight - 4, mobWidth * hpPercent, 4);
            }
            
            // Indicador Multijugador
            let miNombre = localStorage.getItem('mbw_username') || "Player";
            
            if (mob.lockedBy && mob.lockedBy !== miNombre && mob.lastMoveTime && (Date.now() - mob.lastMoveTime < 500)) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                
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

    // --- ✨ PREVIEW FANTASMA DEL PIXEL ART ---
    if (typeof currentTool !== 'undefined' && currentTool === 'pixelart' && window.pendingPixelArt && window.pendingPixelArt.imgCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.5; // 70% de visibilidad fantasma
        ctx.imageSmoothingEnabled = false; // Mantiene los píxeles nítidos

        const startX = Math.floor(mouse.worldX);
        const startY = Math.floor(mouse.worldY);

        const screenX = (startX - camera.x) * tileSize;
        // startY es la fila superior. Su esquina superior en pantalla está a -tileSize
        const screenY = canvas.height - (startY - camera.y) * tileSize;
        const drawY = screenY - tileSize; 

        const drawWidth = window.pendingPixelArt.width * tileSize;
        const drawHeight = window.pendingPixelArt.height * tileSize;

        // Dibujamos la imagen completa sobre el mapa
        ctx.drawImage(window.pendingPixelArt.imgCanvas, screenX, drawY, drawWidth, drawHeight);

        // Agregamos un borde animado para que resalte
        ctx.strokeStyle = "#FFD700"; // Borde Dorado
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -(Date.now() / 50); // Animación estilo Photoshop
        ctx.strokeRect(screenX, drawY, drawWidth, drawHeight);
        
        ctx.restore();
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


// Función para mostrar/ocultar el menú
window.toggleAddonsMenu = function() {
    document.getElementById("addons-dropdown").classList.toggle("show");
};

// Cerrar el menú automáticamente si el usuario hace clic afuera de él
document.addEventListener('click', function(event) {
    const isAddonBtn = event.target.closest('#addons-dropdown-container');
    if (!isAddonBtn) {
        const dropdown = document.getElementById("addons-dropdown");
        if (dropdown && dropdown.classList.contains('show')) {
            dropdown.classList.remove("show");
        }
    }
});


// ==========================================
// 🗄️ BÓVEDA DE SKINS (IndexedDB)
// ==========================================
const skinDB = {
    dbName: "MBW_SkinsDB",
    storeName: "skins",
    init: function() {
        return new Promise((resolve, reject) => {
            let request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },
    saveSkin: async function(id, base64Data) {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let tx = db.transaction(this.storeName, "readwrite");
            // ✨ Guardamos la imagen y el TIEMPO EXACTO en el que se subió
            tx.objectStore(this.storeName).put({ data: base64Data, time: Date.now() }, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject();
        });
    },
    getSkin: async function(id) {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let tx = db.transaction(this.storeName, "readonly");
            let req = tx.objectStore(this.storeName).get(id);
            req.onsuccess = () => {
                let res = req.result;
                // Retrocompatibilidad: Si es vieja devuelve el texto, si es nueva devuelve res.data
                resolve(res ? (res.data || res) : null);
            };
            req.onerror = () => resolve(null);
        });
    },
    // ✨ NUEVO: Extrae todo de una vez y lo ordena por fecha
    getAllSorted: async function() {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let tx = db.transaction(this.storeName, "readonly");
            let store = tx.objectStore(this.storeName);
            let reqValues = store.getAll();
            let reqKeys = store.getAllKeys();
            
            tx.oncomplete = () => {
                let values = reqValues.result || [];
                let keys = reqKeys.result || [];
                
                let combined = keys.map((key, index) => {
                    let val = values[index];
                    return {
                        id: key,
                        time: val.time || 0, // Si es vieja, le pone tiempo 0 (se va al fondo)
                        base64: val.data || val 
                    };
                });
                
                // Ordenar: Mayor a menor tiempo (Las más recientes arriba)
                combined.sort((a, b) => b.time - a.time);
                resolve(combined);
            };
            tx.onerror = () => resolve([]);
        });
    }
};

// ==========================================
// 🎨 LÓGICA DEL ADDON DE SPAWNSKINS
// ==========================================

// Abrir el modal y refrescar la barra lateral
window.openSpawnskinsModal = function() {
    if (typeof openModal === 'function') openModal('spawnskins-addon-modal');
    refreshLoadedSkinsList();
};

// ==========================================
// 🔄 ACTUALIZAR LISTA CON PREVIEW (32x44px) Y ORDENADA
// ==========================================
window.refreshLoadedSkinsList = async function() {
    const listDiv = document.getElementById('loaded-skins-list');
    if (!listDiv) return;
    
    listDiv.innerHTML = "<div style='text-align:center; color:#333; font-size:12px; margin-top: 10px;'>Buscando...</div>";
    
    try {
        // ✨ Le pedimos a la bóveda la lista completa ya ORDENADA
        const skins = await skinDB.getAllSorted();
        listDiv.innerHTML = "";
        
        if (skins.length === 0) {
            listDiv.innerHTML = "<div style='text-align:center; color:#333; font-size:12px; margin-top: 10px; font-weight: bold;'>Ninguna skin cargada aún</div>";
            return;
        }
        
        // Iteramos la lista (los más nuevos vienen primero)
        for (let skin of skins) {
            const item = document.createElement('div');
            item.style.cssText = `
                background: #fff; border: 1px solid #555; padding: 4px 6px; 
                font-size: 11px; font-family: monospace; color: #000; 
                border-radius: 3px; font-weight: bold;
                display: flex; justify-content: space-between; align-items: center;
            `;
            
            const textSpan = document.createElement('span');
            textSpan.innerText = "📄 " + skin.id + ".png";
            
            const previewWrapper = document.createElement('div');
            previewWrapper.style.cssText = `
                width: 32px; height: 44px; border: 1px solid #ccc;
                border-radius: 2px; flex-shrink: 0; overflow: hidden;
                background: #8B8B8B; 
            `;

            const previewDiv = document.createElement('div');
            previewDiv.style.cssText = `
                width: 16px; height: 22px; 
                background-image: url('${skin.base64}'); 
                background-position: left top; background-repeat: no-repeat;
                image-rendering: pixelated; transform: scale(2);
                transform-origin: top left;
            `;
            
            previewWrapper.appendChild(previewDiv);
            item.appendChild(textSpan);
            item.appendChild(previewWrapper);
            listDiv.appendChild(item);
        }
    } catch (e) {
        listDiv.innerHTML = "<div style='text-align:center; color:#c0392b; font-size:12px;'>Error al cargar lista</div>";
    }
};

// Cerrar el modal y limpiar la lista lateral
window.closeSpawnskinsModal = function() {
    // Cerramos el modal usando tu función general
    if (typeof closeModal === 'function') {
        closeModal('spawnskins-addon-modal');
    }
    
    // Vaciamos el contenido de la lista para que no consuma memoria en segundo plano
    const listDiv = document.getElementById('loaded-skins-list');
    if (listDiv) {
        listDiv.innerHTML = ""; 
    }
};

// 📥 Importación y guardado
window.importLocalSkins = function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let loadedCount = 0;
    for (let file of files) {
        const skinID = file.name.replace(/\.[^/.]+$/, "");
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64 = e.target.result; 
            
            // Guardar en la base de datos
            await skinDB.saveSkin(skinID, base64);
            
            // Refrescar en memoria RAM para el Canvas
            const img = new Image();
            img.onload = () => { if (typeof worldDirty !== 'undefined') worldDirty = true; };
            img.src = base64;
            
            window.skinCache = window.skinCache || {};
            window.skinCache[skinID] = img;
            
            loadedCount++;
            if (loadedCount === files.length) {
                // Limpiar el input
                document.getElementById('skin-upload-input').value = "";
                
                // ✨ ACTUALIZAMOS LA BARRA LATERAL AL TERMINAR ✨
                refreshLoadedSkinsList();
            }
        };
        reader.readAsDataURL(file);
    }
};

// ==========================================
// 🖼️ ADDON: PIXEL ART AUTO-BUILDER (CORREGIDO)
// ==========================================

window.openPixelArtModal = function() {
    if (typeof openModal === 'function') openModal('pixelart-addon-modal');
};

// ==========================================
// ✨ PALETA MASIVA DE BLOQUES (RGB Calibrado 1:1 con el Sprite Sheet)
// ==========================================
const blockPalette = {
    // 🧶 LANAS (Colores Base - y:187)
    "cloth_white": [225, 225, 225], "cloth_lightgray": [160, 160, 160], "cloth_gray": [85, 85, 85],
    "cloth_black": [25, 25, 25], "cloth_brown": [85, 55, 30], "cloth_purple": [120, 50, 155],
    "cloth_magenta": [185, 65, 175], "cloth_red": [165, 45, 45], "cloth_orange": [225, 115, 35],
    "cloth_pink": [235, 140, 165], "cloth_yellow": [225, 200, 45], "cloth_lightgreen": [115, 185, 25],
    "cloth_green": [65, 105, 35], "cloth_cyan": [45, 115, 135], "cloth_lightblue": [105, 155, 210],
    "cloth_blue": [45, 60, 150], "cloth_rainbow": [200, 200, 200],

    // 🌍 TIERRA, PIEDRA Y NATURALEZA
    "br": [80, 80, 80], "r": [120, 120, 120], "cs": [105, 105, 105], "ms": [95, 115, 80],
    "ms1": [95, 115, 80], "ms2": [95, 115, 80], "dt": [134, 96, 67], "dt_1": [110, 140, 65], 
    "farm": [102, 70, 46], "myc": [111, 99, 105], "gdt": [119, 85, 58], "cdt": [119, 85, 58],
    "sb": [218, 210, 158], "sd": [218, 210, 158], "ss": [215, 205, 150], "ssd": [215, 205, 150],
    "rsd": [190, 100, 30], "rsd_1": [190, 100, 30], "hcl": [150, 95, 65], "gv": [130, 125, 120],
    "cy1": [160, 166, 179], "snowblock": [240, 250, 250], "ice": [160, 200, 255], 
    "fice": [160, 200, 255], "fice_1": [160, 200, 255], "fice_2": [160, 200, 255], 
    "fice_3": [160, 200, 255], "fice_4": [160, 200, 255],

    // 🪵 MADERAS, HOJAS Y CULTIVOS DECORATIVOS
    "wp": [160, 130, 80], "wd1": [100, 80, 50], "wd_1": [100, 80, 50], "wd_2": [100, 80, 50],
    "fw1": [100, 80, 50], "fw2": [100, 80, 50], "j": [150, 110, 80], "hai_1": [200, 180, 40],
    "hay": [200, 170, 30], "hay_1": [200, 170, 30], "hay_2": [200, 170, 30],
    "lv": [65, 125, 45], "lv1": [70, 110, 50], "lv2": [50, 90, 60], "lv3": [80, 130, 40], "lv4": [60, 100, 40],
    "lgr": [130, 200, 40], "pk": [220, 140, 30], "pk_2": [220, 140, 30], "pk_3": [220, 140, 30],
    "pk_4": [220, 140, 30], "pk_5": [220, 140, 30], "pk_6": [220, 140, 30], "pk_7": [220, 140, 30],
    "pk_8": [220, 140, 30], "pk_9": [220, 140, 30], "pk_10": [220, 140, 30], "pk_11": [220, 140, 30],
    "jl": [250, 150, 30], "mel": [100, 140, 50], "lemonb": [245, 230, 70],

    // 🧱 CONSTRUCCIÓN, MINERALES Y BLOQUES VALIOSOS
    "bricks": [145, 80, 70], "books": [115, 90, 55], "bbb": [220, 220, 210], "dsb": [55, 55, 60],
    "clore": [90, 90, 90], "in": [135, 130, 125], "gd": [140, 135, 120], "dmore": [110, 130, 135],
    "rs": [130, 90, 90], "os": [25, 20, 35], "lap": [90, 100, 130], "egem": [100, 130, 100],
    "to": [140, 125, 90], "ib": [230, 230, 230], "gb": [248, 224, 70], "db": [99, 219, 213],
    "lapb": [39, 67, 138], "clb": [20, 20, 20], "top": [255, 180, 50], "tob": [255, 165, 45],

    // 🌋 END, NETHER Y DECORACIONES EXÓTICAS
    "n": [110, 55, 55], "nb": [45, 20, 25], "rnb": [95, 30, 35], "magma": [210, 95, 30],
    "glow": [235, 195, 100], "light": [255, 240, 180], "coral": [230, 115, 145],
    "es": [220, 225, 165], "pf": [165, 115, 165], "pf_2": [165, 115, 165], "portalstone": [55, 115, 120],

    // 🌑 BACKDROPS / FONDOS (y:190 a y:200 - Colores oscurecidos exactos)
    "bdcloth_white": [112, 112, 112], "bdcloth_lightgray": [80, 80, 80], "bdcloth_gray": [42, 42, 42],
    "bdcloth_black": [12, 12, 12], "bdcloth_brown": [42, 27, 15], "bdcloth_purple": [60, 25, 77],
    "bdcloth_magenta": [92, 32, 87], "bdcloth_red": [82, 22, 22], "bdcloth_orange": [112, 57, 17],
    "bdcloth_pink": [117, 70, 82], "bdcloth_yellow": [112, 100, 22], "bdcloth_lightgreen": [57, 92, 12],
    "bdcloth_green": [32, 52, 17], "bdcloth_cyan": [22, 57, 67], "bdcloth_lightblue": [52, 77, 105],
    "bdcloth_blue": [22, 30, 75], "bdcloth_rainbow": [100, 100, 100],
    "bddt": [67, 48, 33], "bdr": [60, 60, 60], "bdcs": [52, 52, 52], "bdbbb": [110, 110, 105],
    "bdbricks": [72, 40, 35], "bdbooks": [57, 45, 27], "bdsb": [109, 101, 80], "bdwp": [80, 65, 40],
    "bdnb": [22, 10, 12], "bb": [57, 45, 27]
};

function getClosestBlock(r, g, b) {
    let closestBlock = "cloth_white";
    let minDistance = Infinity;
    for (let block in blockPalette) {
        let [br, bg, bb] = blockPalette[block];
        let distance = Math.sqrt(Math.pow(r - br, 2) + Math.pow(g - bg, 2) + Math.pow(b - bb, 2));
        if (distance < minDistance) {
            minDistance = distance;
            closestBlock = block;
        }
    }
    return closestBlock;
}

// 2. Procesar y guardar en memoria
window.processPixelArt = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const maxWidth = parseInt(document.getElementById('pixelart-max-width').value) || 64;
    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let scale = 1;
            if (img.width > maxWidth) scale = maxWidth / img.width;
            
            const finalWidth = Math.floor(img.width * scale);
            const finalHeight = Math.floor(img.height * scale);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = finalWidth;
            tempCanvas.height = finalHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0, finalWidth, finalHeight);
            
            const imageData = tempCtx.getImageData(0, 0, finalWidth, finalHeight).data;

            // ✨ GUARDAMOS EN MEMORIA (Y AHORA TAMBIÉN LA IMAGEN PARA EL FANTASMA)
            window.pendingPixelArt = {
                data: imageData,
                width: finalWidth,
                height: finalHeight,
                imgCanvas: tempCanvas // <--- ¡Esta es la clave visual!
            };

            // Activar "Modo Pegar"
            if (typeof currentTool !== 'undefined') currentTool = 'pixelart';
            
            alert("¡Imagen lista! Cierra esta ventana y HAZ CLIC en cualquier lugar del mapa para construirla.");
            
            if (typeof closeModal === 'function') closeModal('pixelart-addon-modal');
            document.getElementById('pixelart-upload').value = ""; 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

// 3. ✨ FIX: Constructor oficial en el mundo (Soporta Ctrl+Z y Caché Visual)
window.buildPixelArtInWorld = function(pixelData, width, height, startX, startY) {
    if (typeof historyManager !== 'undefined') historyManager.startAction();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4; 
            const alpha = pixelData[index + 3];

            if (alpha < 50) continue; // Ignorar pixeles transparentes

            const r = pixelData[index];
            const g = pixelData[index + 1];
            const b = pixelData[index + 2];

            const blockType = getClosestBlock(r, g, b);
            
            const blockX = Math.floor(startX + x);
            const blockY = Math.floor(startY - y); // De arriba hacia abajo
            
            if (typeof mbwom !== 'undefined' && typeof mbwom.setBlockState === 'function') {
                const currentState = mbwom.getBlockState(blockX, blockY);
                const newState = { type: blockType };
                
                // Guardar en el historial (Para que sirva el Ctrl+Z)
                if (typeof historyManager !== 'undefined') {
                    historyManager.recordChange(blockX, blockY, currentState, newState);
                }
                
                // Poner el bloque y decirle a la memoria que lo dibuje
                mbwom.setBlockState(blockX, blockY, newState);
                if (typeof renderBlock === 'function') renderBlock(blockX, blockY);
            }
        }
    }
    
    if (typeof worldDirty !== 'undefined') worldDirty = true;
    if (typeof historyManager !== 'undefined') historyManager.commitAction();
};

// 4. ✨ FIX: Vigilante de clics usando las coordenadas globales del ratón
function setupPixelArtClicker() {
    const mainCanvas = document.getElementById('canvas') || document.querySelector('canvas');
    if (!mainCanvas) return;

    mainCanvas.addEventListener('mousedown', function(event) {
        if (window.pendingPixelArt && typeof currentTool !== 'undefined' && currentTool === 'pixelart') {
            
            // Usamos las coordenadas exactas que ya calcula tu juego
            const worldX = Math.floor(mouse.worldX);
            const worldY = Math.floor(mouse.worldY);

            // ¡Construimos!
            buildPixelArtInWorld(
                window.pendingPixelArt.data, 
                window.pendingPixelArt.width, 
                window.pendingPixelArt.height, 
                worldX, 
                worldY
            );

            // Limpiamos y regresamos a la herramienta mover
            window.pendingPixelArt = null;
            if (typeof selectTool === 'function') {
                selectTool('move');
            } else {
                currentTool = 'move'; 
            }
            
            alert("¡Pixel Art pegado con éxito! (Puedes usar Ctrl+Z si te equivocaste)");
        }
    });
}

// Ejecutamos el vigilante al cargar la página
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPixelArtClicker);
} else {
    setupPixelArtClicker();
}


// ==========================================
// ⌨️ SISTEMA DE ATAJOS DE TECLADO (KEYBINDS)
// ==========================================

const DEFAULT_KEYBINDS = {
    inventory: { key: 'e', label: '🎒 Open Inventory' },
    structures: { key: 'r', label: '🏘️ Open Structures' },
    mobs: { key: 'm', label: '🐷 Open Mobs Browser' },
    brush_up: { key: '+', label: '🖌️ Brush Size +' },
    brush_down: { key: '-', label: '🖌️ Brush Size -' },
    delete: { key: 'delete', label: '💥 Delete Selection' },
    undo: { key: 'z', ctrl: true, label: '↶ Undo' },
    redo: { key: 'y', ctrl: true, label: '↷ Redo' },
    copy: { key: 'c', ctrl: true, label: '📄 Copy Selection' },
    cut: { key: 'x', ctrl: true, label: '✂️ Cut Selection' },
    paste: { key: 'v', ctrl: true, label: '📋 Paste' }
};

window.userKeybinds = JSON.parse(localStorage.getItem('mbw_keybinds')) || JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
let isWaitingForKey = null; // Variable para saber si estamos esperando que el usuario presione una tecla

window.openKeybindsModal = function() {
    if (typeof openModal === 'function') openModal('keybinds-modal');
    renderKeybinds();
};

window.renderKeybinds = function() {
    const container = document.getElementById('keybinds-list');
    if (!container) return;
    container.innerHTML = '';

    for (let action in userKeybinds) {
        const bind = userKeybinds[action];
        
        let displayKey = bind.key;
        if (displayKey === ' ') displayKey = 'Space';
        else if (displayKey && displayKey.length === 1) displayKey = displayKey.toUpperCase();
        
        // Formatear si tiene Control
        if (bind.ctrl) displayKey = 'Ctrl + ' + displayKey;

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #A0A0A0; padding: 6px 12px; border: 2px solid #555; border-radius: 3px;';

        row.innerHTML = `
            <span style="color: black; font-weight: bold; font-size: 14px;">${bind.label}</span>
            <button id="btn-bind-${action}" onclick="startRebind('${action}')" style="min-width: 90px; padding: 4px 8px; background: #222; color: #FFF; border: 2px inset #555; cursor: pointer; font-family: 'Consolas', monospace; font-weight: bold; font-size: 14px; text-transform: capitalize;">
                ${displayKey}
            </button>
        `;
        container.appendChild(row);
    }
};

window.startRebind = function(action) {
    // Si la acción no se puede modificar (ej. Ctrl+Z es universal), bloqueamos (Opcional)
    // if(action === 'undo' || action === 'redo') return alert("This shortcut cannot be changed.");
    
    isWaitingForKey = action;
    const btn = document.getElementById(`btn-bind-${action}`);
    btn.innerText = "Press key...";
    btn.style.background = "#e67e22";
    btn.style.borderColor = "#d35400";
    btn.style.color = "#FFF";
};

window.resetKeybinds = function() {
    window.userKeybinds = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
    localStorage.setItem('mbw_keybinds', JSON.stringify(window.userKeybinds));
    renderKeybinds();
};

// ==========================================
// 🧠 DETECTOR GLOBAL DE TECLAS Y ACCIONES
// ==========================================
window.addEventListener('keydown', function(e) {
    // 1. SI ESTAMOS REASIGNANDO UNA TECLA
    if (isWaitingForKey) {
        e.preventDefault();
        // Evitamos que las teclas modificadoras solas se guarden (ej: presionar solo 'Ctrl')
        if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(e.key)) return;

        window.userKeybinds[isWaitingForKey].key = e.key.toLowerCase();
        window.userKeybinds[isWaitingForKey].ctrl = e.ctrlKey;
        
        localStorage.setItem('mbw_keybinds', JSON.stringify(window.userKeybinds));
        isWaitingForKey = null;
        renderKeybinds();
        return;
    }

    // 2. SI EL USUARIO ESTÁ ESCRIBIENDO EN EL CHAT O EN UN IMPUT, IGNORAR ATAJOS
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // 3. EJECUTAR LAS ACCIONES BASADAS EN LOS KEYBINDS DEL USUARIO
    const k = e.key.toLowerCase();
    const isCtrl = e.ctrlKey;

    const binds = window.userKeybinds;

    if (k === binds.brush_up.key && isCtrl === (binds.brush_up.ctrl || false)) {
        e.preventDefault();
        if (typeof updateToolSize === 'function') updateToolSize(toolSize + 1);
    }
    else if (k === binds.brush_down.key && isCtrl === (binds.brush_down.ctrl || false)) {
        e.preventDefault();
        if (typeof updateToolSize === 'function') updateToolSize(toolSize - 1);
    }
    else if (k === binds.delete.key && isCtrl === (binds.delete.ctrl || false)) {
        e.preventDefault();
        if (typeof deleteSelection === 'function') deleteSelection();
    }
    else if (k === binds.inventory.key && isCtrl === (binds.inventory.ctrl || false)) {
        e.preventDefault();
        if (typeof toggleInventory === 'function') toggleInventory();
    }
    else if (k === binds.structures.key && isCtrl === (binds.structures.ctrl || false)) {
        e.preventDefault();
        if (typeof openStructuresModal === 'function') openStructuresModal();
    }
    else if (k === binds.mobs.key && isCtrl === (binds.mobs.ctrl || false)) {
        e.preventDefault();
        if (typeof openMobModal === 'function') openMobModal();
    }
    else if (k === binds.undo.key && isCtrl === (binds.undo.ctrl || false)) {
        e.preventDefault();
        if (typeof historyManager !== 'undefined') historyManager.undo();
    }
    else if (k === binds.redo.key && isCtrl === (binds.redo.ctrl || false)) {
        e.preventDefault();
        if (typeof historyManager !== 'undefined') historyManager.redo();
    }
    else if (k === binds.copy.key && isCtrl === (binds.copy.ctrl || false)) {
        e.preventDefault();
        if (typeof copySelection === 'function') copySelection();
    }
    else if (k === binds.cut.key && isCtrl === (binds.cut.ctrl || false)) {
        e.preventDefault();
        if (typeof cutSelection === 'function') cutSelection();
    }
    else if (k === binds.paste.key && isCtrl === (binds.paste.ctrl || false)) {
        e.preventDefault();
        if (typeof activatePasteMode === 'function') activatePasteMode();
    }
});


// ==========================================
// ⚙️ CONTROLADOR DE PESTAÑAS (CONFIGURACIÓN)
// ==========================================
window.openSettingsTab = function(tabId) {
    // 1. Ocultamos todos los paneles y quitamos la clase 'active'
    document.querySelectorAll('.settings-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));

    // 2. Mostramos el panel elegido
    const targetPane = document.getElementById('set-tab-' + tabId);
    if (targetPane) targetPane.classList.add('active');

    // 3. Pintamos la pestaña seleccionada en la barra lateral
    const activeTab = document.querySelector(`.settings-tab[onclick*="${tabId}"]`);
    if (activeTab) activeTab.classList.add('active');

    // ✨ NUEVO: Si abrimos la pestaña de controles, dibujamos la lista
    if (tabId === 'controls' && typeof renderKeybinds === 'function') {
        renderKeybinds();
    }
};