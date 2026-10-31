window.liveTimeEnabled = false; // Apagado por defecto
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// --- OPTIMIZACIÓN: Buffer Fuera de Pantalla ---
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
offscreenCtx.imageSmoothingEnabled = false;

// Lienzos del desplazamiento fluido (se crean solo cuando se activa; ver más abajo)
let bgCanvas = null, bgCtx = null, blocksCanvas = null, blocksCtx = null;

let worldDirty = true;
let lastCameraX = null;
let lastCameraY = null;
let lastGridWidth = null;

const uiElements = {
    topBar: document.getElementById('top-bar'),
    ribbon: document.getElementById('ribbon'),
};

const ZOOM_LEVELS = [3, 4, 5, 8, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600];
let currentZoomIndex = 8; 
let currentZoom = 100;
const BASE_TILE_SIZE = 16;
let showGrid = false;
window.hideMobNames = false; // Variable global para controlar la visibilidad de los nombres
window.toggleMobNames = function(isHidden) {
    window.hideMobNames = isHidden;
    worldDirty = true; // Forzamos a que el lienzo se vuelva a dibujar
};
const grid = { width: 60, height: 30 };
let tileSize = BASE_TILE_SIZE;

window.images = { names: ["blocks", "hotbar", "slot", "nether-bg", "end-bg", "overworld-bg", "zombie", "skeleton", "creeper", "enderman", "nethereye", "enderdragon", "pig", "cow", "cowctus", "mushroom", "chicken", "Player", "slime", "magmacube", "chicken", "blaze", "squid", "ghast", "rabbit", "dog", "sheep", "snowgolem", "wolf", "spider", "snowgolem", "zombiepigman", "bat", "spawnskin", "sun", "moon"] };

window.images.names.forEach((name) => {
    window.images[name] = new Image();
    window.images[name].src = `assets/${name}.png`;
    
    window.images[name].onload = () => {
        worldDirty = true;
        // la hotbar se dibuja con los bloques de esta imagen: si se dibujó antes de que llegara, quedaba VACÍA
        if (name === 'blocks' && typeof renderHotbarUI === 'function') { try { renderHotbarUI(); } catch (e) { /* aún no hay barra */ } }
    };
});

// ¡Sintaxis reparada aquí!
const camera = { x: 0, y: 148, speed: 1 };

// Cuando el lienzo cambia de tamaño (pantalla completa, Modo Zen, paneles que se esconden, cambiar el tamaño de la ventana...)
// la cámara se corre para que lo que estaba en el CENTRO de la vista siga en el centro: el mundo no "salta" y el zoom no cambia.
// La cámara solo puede quedar en cuadros enteros (sin desplazamiento fluido) o en píxeles enteros (con desplazamiento fluido);
// lo que sobra al redondear se guarda (carry) y se suma en el siguiente cambio. Así entrar y salir de pantalla completa
// deja la cámara EXACTAMENTE donde estaba, sin irse corriendo medio cuadro cada vez.
const viewCarry = { x: 0, y: 0, sx: null, sy: null };
function keepViewCentered(oldW, oldH) {
    if (!(oldW > 0 && oldH > 0) || !(tileSize > 0)) return;
    if (oldW === canvas.width && oldH === canvas.height) return;
    if (viewCarry.sx !== camera.x || viewCarry.sy !== camera.y) { viewCarry.x = 0; viewCarry.y = 0; }   // la cámara se movió por otro lado: se parte de cero
    // Se cuenta en "pasos" de la cámara: 1 cuadro (normal) o 1 píxel (fluido)
    const smooth = !!window.smoothScroll;
    const toSteps = (tiles) => smooth ? tiles * tileSize : tiles;
    const toTiles = (steps) => smooth ? steps / tileSize : steps;
    const nx = toSteps(camera.x) + toSteps((oldW - canvas.width) / 2 / tileSize) + viewCarry.x;
    const ny = toSteps(camera.y) + toSteps((oldH - canvas.height) / 2 / tileSize) + viewCarry.y;
    const rx = Math.round(nx), ry = Math.round(ny);
    viewCarry.x = nx - rx; viewCarry.y = ny - ry;
    camera.x = toTiles(rx); camera.y = toTiles(ry);
    viewCarry.sx = camera.x; viewCarry.sy = camera.y;
}
let canvasSizedOnce = false;   // la primera vez el lienzo trae el tamaño de fábrica (300x150): no hay nada que conservar

function resizeCanvas() {
    const workspace = document.getElementById('workspace');
    const oldW = canvasSizedOnce ? canvas.width : 0, oldH = canvasSizedOnce ? canvas.height : 0;
    if (workspace) {
        canvas.width = workspace.clientWidth;
        canvas.height = workspace.clientHeight;
    } else {
        canvas.width = window.innerWidth - 60;
        canvas.height = window.innerHeight - 112;
    }
    canvasSizedOnce = true;
    keepViewCentered(oldW, oldH);
    
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
    camera.speed = 100 / currentZoom; 
    // Con el desplazamiento fluido la cámara SÍ puede quedar entre dos cuadros (así el zoom no la mueve)
    if (!window.smoothScroll) {
        camera.x = Math.round(camera.x);
        camera.y = Math.round(camera.y);
    }
    sizeSmoothBuffers();
    worldDirty = true; 
}

window.addEventListener('resize', resizeCanvas);
window.onload = resizeCanvas;

function updateZoomSlider(value) {
    const index = parseInt(value);
    // 👁 con la relación de aspecto puesta el zoom no cambia (scripts/aspect-view.js)
    if (window.mbwAspect && window.mbwAspect.active && !window.mbwAspect.allowZoom && ZOOM_LEVELS[index] !== currentZoom) {
        const back = ZOOM_LEVELS.indexOf(currentZoom);
        if (back >= 0) currentZoomIndex = back;      // (algunos botones ya habían movido el número antes de llamar aquí)
        const sl = document.getElementById('zoom-slider');
        if (sl) sl.value = currentZoomIndex;
        window.mbwAspect.zoomBlocked();
        return;
    }
    if (ZOOM_LEVELS[index] !== undefined) {
        currentZoom = ZOOM_LEVELS[index];
        currentZoomIndex = index;
    }
    document.getElementById('zoom-value').innerText = currentZoom + "%";
    const slider = document.getElementById('zoom-slider');
    if (slider) slider.value = currentZoomIndex;
    updateGridDimensions();
}

const statusRightZone = document.querySelector('.status-right');
if (statusRightZone) {
    statusRightZone.addEventListener('wheel', function(e) {
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

window.toggleGrid = function(enabled) {
    showGrid = enabled;
    localStorage.setItem('mbw_show_grid', enabled);
    worldDirty = true;
};

window.showDimBackgrounds = true;

window.toggleDimBackgrounds = function(enabled) {
    window.showDimBackgrounds = enabled;
    worldDirty = true; 
};

// ==========================================================
// "FOTO" DEL MUNDO (worldCache): la textura que se dibuja en cada bloque.
// Antes se llamaba a renderBlock() por cada bloque, y cada llamada pedía 12 datos
// del bloque aunque casi todos los bloques solo necesitan 2 (tipo y variante). Con un mundo
// grande (380 mil bloques) eso tardaba ~1.6 s. Ahora solo se piden todos los datos a los
// bloques "especiales" (horno, pociones, agua, cultivos) y el resultado es exactamente el mismo.
// ==========================================================
window.worldCacheSource = new WeakMap();   // para cada foto del mundo: de qué mapa (escena) salió. Lo usan las pestañas para saber si pueden reutilizarla.
let worldCacheToken = 0;                    // si empieza una construcción nueva, la anterior (en tandas) se cancela sola

// ==========================================================
// 🪵 FENCE QUE SE CONECTA (solo se ve así en el editor · Ronda 15)
// El bloque guardado en el mundo sigue siendo "fnc" de siempre: solo cambia el DIBUJO según lo que tenga al lado.
//   · nada a la izquierda ni a la derecha  -> assets/fncalone.png (solo el poste)
//   · algo a la derecha (otro fence o cualquier bloque) -> assets/fncright.png
//   · algo a la izquierda                    -> assets/fncleft.png
//   · algo a los dos lados                   -> los dos juntos (fncleft + fncright), poste con travesaños a ambos lados
// Si alguna imagen no carga (o todavía no llega), se sigue viendo el fence de siempre.
// ==========================================================
window.fenceVisual = (function () {
    const files = { alone: 'assets/fncalone.png', left: 'assets/fncleft.png', right: 'assets/fncright.png' };
    const tex = {};
    // "both" (algo a los dos lados) no tiene imagen propia: se arma juntando fncleft y fncright, así los travesaños quedan a la misma altura que en los vecinos
    tex.both = { x: 0, y: 0, img: null };
    const buildBoth = function () {
        if (tex.both.img) return;
        const l = tex.left.img, r = tex.right.img;
        if (!(l.complete && l.naturalWidth > 0 && r.complete && r.naturalWidth > 0)) return;
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        const g = c.getContext('2d');
        g.drawImage(l, 0, 0, 16, 16); g.drawImage(r, 0, 0, 16, 16);
        tex.both.img = c;
    };
    Object.keys(files).forEach(function (k) {
        const img = new Image();
        img.onload = function () { buildBoth(); if (typeof worldDirty !== 'undefined') worldDirty = true; };   // ya llegó: se vuelve a pintar el mundo
        img.src = files[k];
        tex[k] = { x: 0, y: 0, img: img };   // x e y se llenan con el fence de siempre (por si algo lo dibuja sin pasar por drawBlock)
    });
    const baseTex = function () { return window.texturesMap && window.texturesMap.fnc; };
    return {
        tex: tex,
        // ¿Qué dibujo le toca al fence que está en (x, y)? "base" es el dibujo normal (el de siempre): se usa mientras las imágenes no hayan cargado.
        pick: function (scene, x, y, base) {
            const left = scene[x - 1], right = scene[x + 1];
            const hasL = !!left && left[y] != null, hasR = !!right && right[y] != null;
            const t = (hasL && hasR) ? tex.both : (hasR ? tex.right : (hasL ? tex.left : tex.alone));
            const b = base || baseTex();
            if (b) { t.x = b.x; t.y = b.y; }
            return t;
        },
        // Vuelve a dibujar (en la foto del mundo) el fence de (x, y) si hay uno ahí. Se usa con los vecinos de un bloque que cambió.
        refreshAt: function (x, y) {
            const scene = (typeof mbwom !== 'undefined') ? mbwom.scene : null;
            if (!scene || !scene[x] || scene[x][y] !== 'fnc') return;
            if (!window.worldCache[x]) window.worldCache[x] = [];
            window.worldCache[x][y] = this.pick(scene, x, y, getBlockObject(mbwom.getBlockState(x, y)));
        }
    };
})();

function makeWorldCacheBuilder() {
    const scene = mbwom.scene, states = mbwom.states || {};
    const defaultRenderer = window.renderers.default, specialRenderers = window.blockData;
    const textureByType = new Map();   // textura de cada tipo de bloque que no tiene variante (se calcula una sola vez por tipo)
    return function buildColumn(x, cache) {
        const col = scene[x];
        if (!col || !col.length) return;   // igual que antes: una columna vacía no crea nada en la foto
        const out = cache[x] = [];
        for (let y = 0; y < col.length; y++) {
            const type = col[y];
            if (type == null) continue;
            const renderer = specialRenderers[type] || defaultRenderer;
            let texture;
            if (type === 'fnc') {
                // el fence se dibuja según lo que tenga a los lados (solo visual)
                out[y] = window.fenceVisual.pick(scene, x, y, getTexture(type, states['blockX' + x + 'Y' + y]));
                continue;
            }
            if (renderer === defaultRenderer) {
                const variant = states['blockX' + x + 'Y' + y];
                if (variant === undefined) {
                    texture = textureByType.get(type);
                    if (texture === undefined) { texture = window.rainbowAnim.map(getTexture(type, undefined)); textureByType.set(type, texture); }   // (magma / fuego: el dibujo animado)
                } else {
                    texture = window.rainbowAnim.map(getTexture(type, variant));   // la lana arcoíris usa el dibujo animado
                }
            } else {
                texture = renderer(mbwom.getBlockState(x, y));   // bloques especiales: el camino de siempre
            }
            out[y] = texture;
        }
    };
}

function initializeWorldCache() {
    worldCacheToken++;
    window.worldCache = [];
    if (typeof mbwom !== 'undefined' && mbwom.scene && Array.isArray(mbwom.scene)) {
        const build = makeWorldCacheBuilder();
        for (let x = 0; x < mbwom.scene.length; x++) build(x, window.worldCache);
        window.worldCacheSource.set(window.worldCache, mbwom.scene);
    }
    worldDirty = true;
}

// Lo mismo que initializeWorldCache(), pero por tandas de ~60 ms para poder mostrar una barra
// de progreso REAL (onProgress recibe un número de 0 a 1) sin congelar la pantalla.
function initializeWorldCacheAsync(onProgress) {
    return new Promise(resolve => {
        const token = ++worldCacheToken;
        const cache = window.worldCache = [];
        const scene = (typeof mbwom !== 'undefined' && mbwom.scene && Array.isArray(mbwom.scene)) ? mbwom.scene : null;
        if (!scene) { worldDirty = true; resolve(); return; }
        const build = makeWorldCacheBuilder();
        const total = scene.length;
        let x = 0;
        const step = () => {
            if (token !== worldCacheToken) { resolve(); return; }   // otra construcción empezó: esta ya no hace falta
            const t0 = performance.now();
            while (x < total && performance.now() - t0 < 60) { build(x, cache); x++; }
            if (onProgress) onProgress(total ? x / total : 1);
            if (x < total) {
                (window.nextPaint ? window.nextPaint() : Promise.resolve()).then(step);
            } else {
                window.worldCacheSource.set(cache, scene);
                worldDirty = true;
                resolve();
            }
        };
        step();
    });
}

function renderBlock(x, y) {
    if (!worldCache[x]) worldCache[x] = [];
    const states = mbwom.getBlockState(x, y);
    if (states.type != null) {
        worldCache[x][y] = window.rainbowAnim.map(getBlockObject(states));
        if (states.type === 'fnc') worldCache[x][y] = window.fenceVisual.pick(mbwom.scene, x, y, worldCache[x][y]);
    } else {
        delete worldCache[x][y];
    }
    // un fence que está al lado cambia de dibujo cuando aquí se pone o se quita un bloque
    window.fenceVisual.refreshAt(x - 1, y);
    window.fenceVisual.refreshAt(x + 1, y);
    worldDirty = true;
}

function drawBlock(texture, values, targetCtx = ctx) {
    if (texture.img) {   // dibujo suelto (el fence que se conecta): si su imagen todavía no cargó, se usa el fence de siempre
        const im = texture.img;
        if (im.tagName === 'CANVAS' || (im.complete && im.naturalWidth > 0)) { targetCtx.drawImage(im, 0, 0, 16, 16, values.x, values.y, values.width, values.height); return; }
    }
    if (window.images.blocks && window.images.blocks.complete && window.images.blocks.naturalWidth !== 0) {
        targetCtx.drawImage(window.images.blocks, texture.x, texture.y, 16, 16, values.x, values.y, values.width, values.height);
    }
}

// Pinta el color de fondo y el fondo de la dimensión (Overworld / Nether / End) sobre un lienzo de tw x th.
// (Antes vivía dentro de renderWorldToBuffer; se separó para que el desplazamiento fluido pueda pintarlo aparte.)
function paintWorldBackground(tctx, tw, th) {
    tctx.fillStyle = "#7385B9"; 
    tctx.fillRect(0, 0, tw, th);

    let cS = 1;
    if (typeof mbwom !== 'undefined') {
        cS = mbwom.currentScene || 1; 
    }

    // ✨ 2. Dibujamos el fondo correcto con Zoom dinámico
    if (window.showDimBackgrounds) {
        const escalaZoom = currentZoom / 100;
        
        // --- OVERWORLD ---
        if (cS === 1 && window.images['overworld-bg']?.complete && window.images['overworld-bg'].naturalWidth > 0) {
            const bgImg = window.images['overworld-bg'];
            
            const escalaBase = th / bgImg.naturalHeight;
            const drawWidth = (bgImg.naturalWidth * escalaBase) * escalaZoom;
            const drawHeight = th * escalaZoom; 
            
            const bgY = th - drawHeight;
            
            // ✨ FIX: Redondeamos hacia arriba y le sumamos un pequeño margen de seguridad
            const renderW = Math.ceil(drawWidth) + 0.8;
            const renderH = Math.ceil(drawHeight) + 0.8;
            
            if (drawWidth > 0) {
                // Avanzamos matemáticamente con el decimal, pero pintamos redondeando
                for (let bgX = 0; bgX < tw; bgX += drawWidth) {
                    tctx.drawImage(bgImg, Math.floor(bgX), Math.floor(bgY), renderW, renderH);
                }
            }
        }
        // --- NETHER Y END ---
        else {
            let bgImg = null;
            if (cS === 2 && window.images['nether-bg']?.complete) bgImg = window.images['nether-bg'];
            if (cS === 3 && window.images['end-bg']?.complete) bgImg = window.images['end-bg'];

            if (bgImg && bgImg.naturalWidth > 0) {
                const drawWidth = bgImg.naturalWidth * escalaZoom;
                const drawHeight = bgImg.naturalHeight * escalaZoom;

                // ✨ FIX: Margen de seguridad para tapar las grietas
                const renderW = Math.ceil(drawWidth) + 0.8;
                const renderH = Math.ceil(drawHeight) + 0.8;

                if (drawWidth > 0 && drawHeight > 0) {
                    for (let bgX = 0; bgX < tw; bgX += drawWidth) {
                        for (let bgY = 0; bgY < th; bgY += drawHeight) {
                            tctx.drawImage(bgImg, Math.floor(bgX), Math.floor(bgY), renderW, renderH);
                        }
                    }
                }
            }
        }
    }

}

function renderWorldToBuffer() {
    paintWorldBackground(offscreenCtx, offscreenCanvas.width, offscreenCanvas.height);

    for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
            const currentX = Math.floor(x + camera.x);
            const currentY = Math.floor(y + camera.y);
            
            let blockObject = getBlockCache(currentX, currentY);
            if (blockObject != null) {
                if (blockObject.rb || blockObject.an) blockObject = window.mbwAnimatedTile(blockObject, currentX, currentY);   // lana arcoíris / magma / fuego: su dibujo de este momento
                const values = {
                    x: Math.floor(x * tileSize),
                    y: Math.floor(canvas.height - y * tileSize),
                    width: Math.ceil(tileSize) + 0.8,
                    height: -(Math.ceil(tileSize) + 0.8),
                };
                drawBlock(blockObject, values, offscreenCtx);
            }
        }
    }
    
    if (showGrid) {
        if (tileSize >= 4) {
            let baseOpacity = window.gridOpacity !== undefined ? window.gridOpacity / 100 : 0.2;
            let gridOpacity = baseOpacity;
            if (tileSize < 12) {
                gridOpacity = baseOpacity * ((tileSize - 4) / (12 - 4)); 
            }
            
            offscreenCtx.strokeStyle = `rgba(255, 255, 255, ${gridOpacity})`;
            offscreenCtx.lineWidth = 3;
            offscreenCtx.beginPath();
            
            const startX = Math.floor(camera.x);
            const startY = Math.floor(camera.y);
            const endX = startX + grid.width;
            const endY = startY + grid.height;

            const offsetX = (camera.x - startX) * tileSize;
            const offsetY = (camera.y - startY) * tileSize;

            for (let x = 0; x <= grid.width + 1; x++) {
                const xPos = Math.round(x * tileSize - offsetX);
                offscreenCtx.moveTo(xPos, 0);
                offscreenCtx.lineTo(xPos, offscreenCanvas.height);
            }
            for (let y = 0; y <= grid.height + 1; y++) {
                const yPos = Math.round(offscreenCanvas.height - (y * tileSize - offsetY));
                offscreenCtx.moveTo(0, yPos);
                offscreenCtx.lineTo(offscreenCanvas.width, yPos);
            }
            offscreenCtx.stroke();
        }
    }
}

// ==========================================================
// DESPLAZAMIENTO FLUIDO (Configuration > Display)
// Normal: la cámara salta de cuadro en cuadro y el mundo se dibuja ya alineado a la cuadrícula.
// Fluido: la cámara puede estar entre dos cuadros. Para no volver a dibujar todos los bloques en cada
// fotograma, el mundo se dibuja UNA vez (cuando cambia el cuadro entero o se edita algo) en un lienzo con
// un cuadro extra a la derecha y arriba, y en cada fotograma solo se "desliza" ese lienzo unos píxeles
// (un solo drawImage). El fondo de la dimensión va en otro lienzo, porque NO se mueve con la cámara.
// ==========================================================
window.smoothScroll = false;
function sizeSmoothBuffers() {
    if (!window.smoothScroll) return;
    if (!blocksCanvas) {
        bgCanvas = document.createElement('canvas');
        bgCtx = bgCanvas.getContext('2d', { alpha: false });
        blocksCanvas = document.createElement('canvas');
        blocksCtx = blocksCanvas.getContext('2d');
    }
    const W = canvas.width, H = canvas.height;
    const pad = Math.max(1, Math.ceil(tileSize));
    if (bgCanvas.width !== W || bgCanvas.height !== H) {
        bgCanvas.width = W; bgCanvas.height = H;
        bgCtx.imageSmoothingEnabled = false;
    }
    if (blocksCanvas.width !== W + pad || blocksCanvas.height !== H + pad) {
        blocksCanvas.width = W + pad; blocksCanvas.height = H + pad;
        blocksCtx.imageSmoothingEnabled = false;
    }
    worldDirty = true;
}

// Deja la cámara en un píxel exacto de la pantalla (así bloques, mobs y jugador no "tiemblan" entre sí)
function snapSmoothCamera() {
    if (!window.smoothScroll || !(tileSize > 0)) return;
    camera.x = Math.round(camera.x * tileSize) / tileSize;
    camera.y = Math.round(camera.y * tileSize) / tileSize;
}

// Teletransporta la cámara (sin animación) para que el Player quede en el CENTRO de la pantalla.
// Se usa al cargar un mundo. Si el mundo no trae posición del Player (mundo nuevo vacío), la cámara no se mueve.
// worldX / worldY son los pies del Player (worldY va invertida, igual que en drawPlayer); el dibujo mide 2 casillas de alto hacia arriba,
// por eso se centra en worldY + 1 (el medio del cuerpo).
window.centerCameraOnPlayer = function() {
    const w = (typeof mbwom !== 'undefined') ? mbwom.world : null;
    if (!w || w.worldX === undefined || w.worldX === null || w.worldY === undefined || w.worldY === null) return false;
    const px = Number(w.worldX), py = -Number(w.worldY);
    if (!isFinite(px) || !isFinite(py) || !(tileSize > 0)) return false;
    camera.x = px - (canvas.width / tileSize) / 2;
    camera.y = (py + 1) - (canvas.height / tileSize) / 2;
    if (!window.smoothScroll) { camera.x = Math.round(camera.x); camera.y = Math.round(camera.y); }
    else snapSmoothCamera();
    camera.velX = 0; camera.velY = 0; camera.accX = 0; camera.accY = 0; camera.lastMoveTime = null;
    camera._tx = camera.x; camera._ty = camera.y;
    worldDirty = true;
    return true;
};

window.toggleSmoothScroll = function(enabled) {
    window.smoothScroll = !!enabled;
    try { localStorage.setItem('mbw_smooth_scroll', enabled ? '1' : '0'); } catch (e) { /* sin almacenamiento: solo no se recuerda */ }
    if (!window.smoothScroll) {
        // al apagarlo la cámara vuelve a la cuadrícula
        camera.x = Math.round(camera.x);
        camera.y = Math.round(camera.y);
        camera.accX = 0; camera.accY = 0;
    }
    camera.velX = 0; camera.velY = 0; camera._tx = undefined; camera._ty = undefined;   // sin velocidad guardada al cambiar de modo
    camera.lastMoveTime = null;
    sizeSmoothBuffers();
    worldDirty = true;
};

// Lo guardado en el navegador: se aplica al arrancar y se marca la casilla
(function loadSmoothScrollSetting() {
    // De fábrica está ENCENDIDO: solo se apaga si la persona lo apagó ella misma (queda guardado '0')
    let on = true;
    try { const saved = localStorage.getItem('mbw_smooth_scroll'); if (saved !== null) on = saved === '1'; } catch (e) { on = true; }
    window.smoothScroll = on;
    const sync = function() {
        const box = document.getElementById('smooth-scroll-toggle');
        if (box) box.checked = window.smoothScroll;
    };
    sync();
    window.addEventListener('DOMContentLoaded', sync);
})();

function renderSmoothBuffers() {
    sizeSmoothBuffers();
    paintWorldBackground(bgCtx, bgCanvas.width, bgCanvas.height);

    const bw = blocksCanvas.width, bh = blocksCanvas.height;
    blocksCtx.clearRect(0, 0, bw, bh);
    const cx = Math.floor(camera.x + 1e-6), cy = Math.floor(camera.y + 1e-6);
    const ts = tileSize;
    const tw = Math.ceil(ts) + 0.8;

    // un cuadro más a la derecha y arriba (grid.width / grid.height incluidos) para cubrir el hueco al deslizar
    for (let x = 0; x <= grid.width; x++) {
        for (let y = 0; y <= grid.height; y++) {
            let blockObject = getBlockCache(cx + x, cy + y);
            if (blockObject != null) {
                if (blockObject.rb || blockObject.an) blockObject = window.mbwAnimatedTile(blockObject, cx + x, cy + y);   // lana arcoíris / magma / fuego: su dibujo de este momento
                drawBlock(blockObject, { x: Math.floor(x * ts), y: Math.floor(bh - y * ts), width: tw, height: -tw }, blocksCtx);
            }
        }
    }

    if (showGrid && ts >= 4) {
        let baseOpacity = window.gridOpacity !== undefined ? window.gridOpacity / 100 : 0.2;
        let gridOpacity = baseOpacity;
        if (ts < 12) gridOpacity = baseOpacity * ((ts - 4) / (12 - 4));
        blocksCtx.strokeStyle = `rgba(255, 255, 255, ${gridOpacity})`;
        blocksCtx.lineWidth = 3;
        blocksCtx.beginPath();
        // la cuadrícula va dentro del mismo lienzo, así se desliza junto con los bloques
        for (let x = 0; x <= grid.width + 1; x++) {
            const xPos = Math.round(x * ts);
            blocksCtx.moveTo(xPos, 0);
            blocksCtx.lineTo(xPos, bh);
        }
        for (let y = 0; y <= grid.height + 1; y++) {
            const yPos = Math.round(bh - y * ts);
            blocksCtx.moveTo(0, yPos);
            blocksCtx.lineTo(bw, yPos);
        }
        blocksCtx.stroke();
    }
}

function drawWorldSmooth() {
    sizeSmoothBuffers();
    const camX = Math.floor(camera.x + 1e-6);
    const camY = Math.floor(camera.y + 1e-6);
    if (camX !== lastCameraX || camY !== lastCameraY || grid.width !== lastGridWidth) {
        worldDirty = true;
        lastCameraX = camX;
        lastCameraY = camY;
        lastGridWidth = grid.width;
    }
    if (worldDirty) {
        renderSmoothBuffers();
        worldDirty = false;
    }
    const W = canvas.width, H = canvas.height;
    const pad = blocksCanvas.height - H;
    // cuánto está la cámara pasada del cuadro entero, en píxeles de pantalla
    const fx = camera.x - camX, fy = camera.y - camY;
    let sx = Math.round(fx * tileSize);
    let sy = Math.round(pad - fy * tileSize);      // hacia arriba en el mundo = hacia abajo en la pantalla
    sx = Math.max(0, Math.min(sx, blocksCanvas.width - W));
    sy = Math.max(0, Math.min(sy, blocksCanvas.height - H));
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.drawImage(blocksCanvas, sx, sy, W, H, 0, 0, W, H);
}

function drawWorld() {
    if (window.smoothScroll) { drawWorldSmooth(); return; }
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

// Tamaño (en cuadros) y dibujo de cada mob. Lo usan drawMobs() y la selección con el mouse (input.js).
// Devuelve { w, h, img, isCustomSkin }: w y h son el ancho y alto con que se DIBUJA el mob, en cuadros.
function getMobDrawInfo(mob, noFetch) {
    let w = 1, h = 2;
    const t = mob.type;
    // Dimensiones personalizadas por tipo de mob
    if (t === 'chicken' || t === 'slime' || t === 'magmacube') {
        w = 1; h = 1;
    } else if (t === 'enderdragon') {
        w = 24; h = 8;
    } else if (t === 'nethereye' || t === 'rabbit' || t === 'bat') {
        w = 0.75; h = 0.75;
    } else if (t === 'pig' || t === 'wolf' || t === 'spider' || t === 'sheep') {
        w = 2; h = 1.2;
    } else if (t === 'enderman') {
        w = 1.2; h = 3;
    } else if (t === 'squid') {
        w = 1; h = 2;
    } else if (t === 'cow' || t === 'cowctus' || t === 'mushroom') {
        w = 2.6; h = 2;
    }

    let img = null;
    let isCustomSkin = false;
    if (t === 'spawnskin' && mob.skin) {
        img = window.getSpawnskinImage(mob.skin, noFetch);
        isCustomSkin = true;
        w = 1.4; h = 2;
    } else if (t === 'spawnskin') {
        // Spawnskin sin ID: la genérica del editor, un solo cuadro de 16x22 (antes se veía toda la tira aplastada)
        img = window.images['spawnskin'];
        isCustomSkin = true;
        w = 1.4; h = 2;
    } else if (t === 'wolf' && mob.tamed === true) {
        // ✨ MAGIA PARA EL PERRO: Si es un lobo y está domesticado, forzamos el sprite 'dog'
        img = window.images['dog'];
    } else {
        // En el juego la mooshroom y la cowctus son una "cow" con variant: se dibuja su sprite
        let spriteKey = t;
        if (t === 'cow') {
            if (mob.variant === 'mooshroom') spriteKey = 'mushroom';
            else if (mob.variant === 'cowctus') spriteKey = 'cowctus';
        }
        img = window.images[spriteKey];
    }
    if (isCustomSkin && img && img.hasFailed) img = window.images['spawnskin'];
    return { w, h, img, isCustomSkin };
}

// ==========================================
// 🛡️ ARMADURA SOBRE EL MOB
// ==========================================
// Cada pieza de armadura que lleva puesta el mob (casco, peto, pantalón, botas) tiene su propia imagen en assets/UI/.
// Se dibuja ENCIMA de la skin: solo el primer cuadro (16x22 px, desde la izquierda y arriba) de la tira, con el mismo
// tamaño, posición y giro que el mob. Si el mob solo lleva algunas piezas, solo se ven esas.
// Para agregar otro material basta con una línea nueva por pieza en MOB_ARMOR_PIECES (ya están: diamante, cuero, hierro, oro y escamas de dragón).
const MOB_ARMOR_PIECES = {
    DiamondCap:   'assets/UI/diamond-helmet_mob.png',
    DiamondShirt: 'assets/UI/diamond-chestplate_mob.png',
    DiamondPants: ['assets/UI/diamond-leggings_mob.png', 'assets/UI/diamond-leggings.png'],   // (si hay varias direcciones, se prueba la siguiente cuando una no existe)
    DiamondShoes: 'assets/UI/diamond-boots_mob.png',
    // Cuero (si el objeto está teñido, extras.type = el color, se pinta de ese color; si no, café de siempre)
    LeatherCap:   'assets/UI/leather-helmet_mob.png',
    LeatherShirt: 'assets/UI/leather-chestplate_mob.png',
    LeatherPants: ['assets/UI/leather-leggings_mob.png', 'assets/UI/leather-leggings.png'],
    LeatherShoes: ['assets/UI/leather-boots_mob.png', 'assets/UI/leather-boots_armor.png'],
    // Hierro
    IronCap:      'assets/UI/iron-helmet_mob.png',
    IronShirt:    'assets/UI/iron-chestplate_mob.png',
    IronPants:    ['assets/UI/iron-leggings_mob.png', 'assets/UI/iron-leggings.png'],
    IronShoes:    'assets/UI/iron-boots_mob.png',
    // Oro (en el juego los objetos se llaman Gold..., los dibujos se llaman golden-...)
    GoldCap:      'assets/UI/golden-helmet_mob.png',
    GoldShirt:    'assets/UI/golden-chestplate_mob.png',
    GoldPants:    ['assets/UI/golden-leggings_mob.png', 'assets/UI/golden-leggings.png'],
    GoldShoes:    'assets/UI/golden-boots_mob.png',
    // Escamas de dragón (en el juego los objetos se llaman Dragon..., los dibujos se llaman dragonscale-...)
    DragonCap:    'assets/UI/dragonscale-helmet_mob.png',
    DragonShirt:  ['assets/UI/dragonscale-chestplate_mob.png', 'assets/UI/dragonscale-chestplate_,mob.png'],   // (el archivo hoy tiene una coma de más en el nombre: "chestplate_,mob"; si lo renombras a "chestplate_mob" también funciona)
    DragonPants:  'assets/UI/dragonscale-leggings_mob.png',
    DragonShoes:  'assets/UI/dragonscale-boots_mob.png'
};
// mob.armor trae 4 objetos en este orden: 0 casco, 1 peto, 2 pantalón, 3 botas.
// Orden de prioridad (lo que queda más arriba): 1. botas  2. casco  3. pantalón  4. peto  5. el mob.
// Por eso se dibujan de abajo hacia arriba así: peto, pantalón, casco, botas.
const MOB_ARMOR_DRAW_ORDER = [1, 2, 0, 3];
const MOB_ARMOR_FRAME = { x: 0, y: 0, w: 16, h: 22 };   // la parte de la imagen que se usa: desde la izquierda y arriba, 16x22 px
window.mobArmorImages = {};

// La imagen de una pieza, por el id del objeto (se pide una sola vez; cuando llega, se vuelve a dibujar el mundo)
function getMobArmorImage(pieceId) {
    const def = MOB_ARMOR_PIECES[pieceId];
    if (!def) return null;
    let img = window.mobArmorImages[pieceId];
    if (!img) {
        const srcs = Array.isArray(def) ? def.slice() : [def];
        img = new Image();
        img.onload = () => { worldDirty = true; };
        img.onerror = () => {
            if (srcs.length) img.src = srcs.shift();      // probar la siguiente dirección
            else img.hasFailed = true;                    // ninguna existe: no se dibuja esa pieza
        };
        img.src = srcs.shift();
        window.mobArmorImages[pieceId] = img;
    }
    return img;
}

// ¿Hay alguna imagen de armadura todavía bajando? (el Screenshot espera a que lleguen)
function mobArmorPending() {
    return Object.values(window.mobArmorImages).some(i => !i.hasFailed && !(i.complete && i.naturalWidth > 0));
}

// Las piezas que lleva puestas el mob y que tienen imagen, YA en el orden en que se dibujan (de abajo hacia arriba): [{ id, extras }].
// mob.armor son 4 objetos [id, 1, 0, {extras}] (también se acepta { id, extras }); un hueco vacío es ["air", 0, 0, {}].
function getMobArmorItems(mob) {
    const arm = mob && mob.armor;
    if (!Array.isArray(arm)) return [];
    const out = [];
    MOB_ARMOR_DRAW_ORDER.forEach(slot => {
        const it = arm[slot];
        let id = Array.isArray(it) ? it[0] : (it && typeof it === 'object' ? (it.id || it.type) : it);
        if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(MOB_ARMOR_PIECES, id)) {
            let extras = Array.isArray(it) ? it[3] : (it && typeof it === 'object' ? it.extras : null);
            if (!extras || typeof extras !== 'object') extras = {};
            out.push({ id: id, extras: extras });
        }
    });
    return out;
}

// Solo los ids (lo que usan el Screenshot y las pruebas)
function getMobArmorPieces(mob) {
    return getMobArmorItems(mob).map(p => p.id);
}

// ---------------------------------------------------------------------------------------------
// 🎨 Cuero teñido: el color va en extras.type (LeatherCap {"type":"blue"}). Se pinta el dibujo de cuero de ese color.
// ✨ Brillo de encantamiento: si el objeto tiene algún encantamiento (un valor "enchant" en extras) se le pasa encima un brillo morado en movimiento
// (los mobs se dibujan en cada cuadro, así que el movimiento sale solo de la hora: no hace falta redibujar nada más).
// ---------------------------------------------------------------------------------------------
const MOB_LEATHER_IDS = { LeatherCap: true, LeatherShirt: true, LeatherPants: true, LeatherShoes: true };
const MOB_DYE_RGB = {   // los mismos colores de la lana
    white: [230, 230, 230], lightgray: [190, 190, 190], gray: [95, 95, 95], black: [47, 47, 47], brown: [74, 47, 18], purple: [123, 36, 153],
    magenta: [169, 8, 107], red: [177, 0, 0], orange: [238, 89, 0], pink: [238, 158, 158], yellow: [214, 188, 0], lightgreen: [100, 187, 0],
    green: [38, 134, 0], cyan: [42, 195, 140], lightblue: [0, 190, 238], blue: [0, 0, 196]
};
window.mobArmorTinted = {};     // { "LeatherCap|0,0,196": canvas }
window.mobArmorGlints = {};     // { "LeatherCap|0,0,196|3": canvas }
const MOB_GLINT_STEPS = 8, MOB_GLINT_MS = 110;

// El color [r, g, b] de un cuero teñido, o null (sin teñir, color que no existe o el cuero café de siempre).
function mobDyeRgb(type) {
    if (typeof type !== 'string') return null;
    const k = type.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MOB_DYE_RGB, k)) return MOB_DYE_RGB[k];
    const m = /^#?([0-9a-f]{6})$/.exec(k);
    return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : null;
}

function mobArmorIsEnchanted(extras) {
    return !!extras && typeof extras === 'object' && Object.keys(extras).some(k => extras[k] === 'enchant');
}

// El dibujo del cuero pintado de ese color (un lienzo con el mismo recorte de 16x22). null si la imagen todavía no llega.
function getTintedMobArmor(id, rgb, img) {
    const key = id + '|' + rgb.join(',');
    if (window.mobArmorTinted[key]) return window.mobArmorTinted[key];
    if (!(img && img.complete && img.naturalWidth > 0)) return null;
    const f = MOB_ARMOR_FRAME, sw = Math.min(f.w, img.naturalWidth), sh = Math.min(f.h, img.naturalHeight);
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
    const t = cv.getContext('2d'); t.imageSmoothingEnabled = false;
    try { t.filter = 'grayscale(1) brightness(2.8) contrast(1.15)'; } catch (e) { /* navegador viejo: se pinta sin aclarar */ }
    t.drawImage(img, f.x, f.y, sw, sh, 0, 0, sw, sh);
    t.filter = 'none';
    t.globalCompositeOperation = 'multiply';                // gris x color = el cuero de ese color
    t.fillStyle = 'rgb(' + rgb.join(',') + ')'; t.fillRect(0, 0, sw, sh);
    t.globalCompositeOperation = 'destination-in';           // y solo donde había armadura
    t.drawImage(img, f.x, f.y, sw, sh, 0, 0, sw, sh);
    window.mobArmorTinted[key] = cv;
    return cv;
}

// El brillo morado de una pieza (lienzo del mismo tamaño que la pieza) en el paso "phase" de la animación.
function getMobArmorGlint(key, src, sw, sh, phase) {
    const gk = key + '|' + phase;
    if (window.mobArmorGlints[gk]) return window.mobArmorGlints[gk];
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
    const t = cv.getContext('2d'); t.imageSmoothingEnabled = false;
    t.fillStyle = 'rgba(110, 40, 200, 0.18)'; t.fillRect(0, 0, sw, sh);                 // base morada suave
    t.fillStyle = 'rgba(205, 140, 255, 0.50)';                                           // rayas en diagonal que se van moviendo
    for (let k = -sh; k < sw + sh; k += MOB_GLINT_STEPS) {
        const o = k + phase;
        t.beginPath(); t.moveTo(o, 0); t.lineTo(o + 2, 0); t.lineTo(o + 2 - sh, sh); t.lineTo(o - sh, sh); t.closePath(); t.fill();
    }
    t.globalCompositeOperation = 'destination-in';                                       // solo sobre la armadura
    t.drawImage(src, 0, 0, sw, sh, 0, 0, sw, sh);
    window.mobArmorGlints[gk] = cv;
    return cv;
}

// Dibuja las piezas encima del mob. (x, y, w, h) = el mismo rectángulo donde se dibujó su skin; el contexto ya viene girado si el mob mira a la izquierda.
function drawMobArmorOverlay(c, mob, x, y, w, h) {
    const items = getMobArmorItems(mob);
    if (!items.length) return;
    const f = MOB_ARMOR_FRAME;
    items.forEach(p => {
        const img = getMobArmorImage(p.id);
        if (!(img && img.complete && img.naturalWidth > 0)) return;
        let src = img, sw = Math.min(f.w, img.naturalWidth), sh = Math.min(f.h, img.naturalHeight), sx = f.x, sy = f.y, tag = p.id;
        const rgb = MOB_LEATHER_IDS[p.id] ? mobDyeRgb(p.extras.type) : null;
        if (rgb) {
            const tc = getTintedMobArmor(p.id, rgb, img);
            if (tc) { src = tc; sx = 0; sy = 0; tag = p.id + '|' + rgb.join(','); }
        }
        c.drawImage(src, sx, sy, sw, sh, x, y, w, h);
        if (mobArmorIsEnchanted(p.extras)) {
            const phase = Math.floor(Date.now() / MOB_GLINT_MS) % MOB_GLINT_STEPS;
            c.drawImage(getMobArmorGlint(tag, src, sw, sh, phase), 0, 0, sw, sh, x, y, w, h);   // (el brillo se recorta con la misma pieza)
        }
    });
}

// ID de la skin que tendrá la spawnskin que se va a poner con la herramienta Spawn Mob (la misma regla que usa el clic):
// si el panel del Mob Browser trae el campo skin, se usa ese ('' = sin skin); si no, la que trae la plantilla.
function getSpawnGhostSkinId() {
    const sp = window.currentMobSpec;
    let sid;
    if (sp && sp.extra && Object.prototype.hasOwnProperty.call(sp.extra, 'skin')) sid = sp.extra.skin;
    else {
        const tp = (typeof getMobTemplate === 'function') ? getMobTemplate('spawnskin') : null;
        sid = tp ? tp.skin : '';
    }
    sid = String(sid == null ? '' : sid);
    return /^[0-9]{1,12}$/.test(sid) ? sid : '';
}

// La "sombra" que sigue al mouse con la spawnskin: la skin REAL del ID (primer cuadro de 16x22, igual que en el mundo).
// Mientras la skin carga, si no existe o si no hay ID, se ve la spawnskin genérica del editor (también un solo cuadro).
function drawSpawnskinGhost() {
    if (typeof mouse === 'undefined' || mouse.canvasX == null || mouse.canvasY == null) return;
    const sid = getSpawnGhostSkinId();
    let img = null;
    if (sid && typeof window.getSpawnskinImage === 'function') {
        const sk = window.getSpawnskinImage(sid);
        if (sk && !sk.hasFailed) img = sk;
    }
    if (!(img && img.complete !== false && img.naturalWidth > 0)) img = window.images['spawnskin'];
    if (!(img && img.complete !== false && img.naturalWidth > 0)) return;
    const w = tileSize * 1.4, h = tileSize * 2;             // mismo tamaño que una spawnskin ya puesta (getMobDrawInfo)
    const screenX = mouse.canvasX;
    const screenY = canvas.height - mouse.canvasY;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, Math.min(16, img.naturalWidth), Math.min(22, img.naturalHeight), screenX - (w / 2), screenY - h, w, h);
    ctx.restore();
}

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
            
            // Tamaño y dibujo del mob: salen de getMobDrawInfo(), la MISMA función que usa el clic del mouse,
            // así el área donde se puede hacer clic es exactamente la que se ve en pantalla.
            const info = getMobDrawInfo(mob);
            const mobWidth = tileSize * info.w;
            const mobHeight = tileSize * info.h;
            const isCustomSkin = info.isCustomSkin;
            const mobImg = info.img;

            if (mobImg && mobImg.complete && mobImg.naturalWidth > 0) {
                ctx.save(); 
                ctx.translate(screenX, screenY);
                if (mob.direction === 1) ctx.scale(-1, 1);
                ctx.imageSmoothingEnabled = false;

                let sourceX = 0;
                let sourceY = 0;
                let sourceWidth = mobImg.naturalWidth;
                let sourceHeight = mobImg.naturalHeight;

                if (isCustomSkin) {
                    sourceWidth = 16;
                    sourceHeight = 22;
                }

                ctx.drawImage(
                    mobImg, 
                    sourceX, sourceY, sourceWidth, sourceHeight,
                    -(mobWidth / 2), -mobHeight, mobWidth, mobHeight
                );

                // 🛡️ Armadura: cada pieza puesta se dibuja encima de la skin, con el mismo tamaño y giro
                drawMobArmorOverlay(ctx, mob, -(mobWidth / 2), -mobHeight, mobWidth, mobHeight);
                
                ctx.restore(); 

                if (isCustomSkin && window.skinCache[mob.skin] && window.skinCache[mob.skin].hasFailed) {
                    ctx.fillStyle = "#FF5555";
                    ctx.font = "bold 10px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText("Falta " + mob.skin + ".png", screenX, screenY - (mobHeight / 2));
                }
            } else {
                let color = "rgba(255, 0, 0, 0.4)"; 
                if (mob.type === 'zombie') color = "rgba(46, 125, 50, 0.5)";
                else if (mob.type === 'skeleton') color = "rgba(224, 224, 224, 0.5)";
                else if (mob.type === 'enderman') color = "rgba(49, 27, 146, 0.5)";
                else if (mob.type === 'spawnskin') color = "rgba(255, 0, 255, 0.5)";
                
                ctx.fillStyle = color;
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
            }

            if (typeof selectedMob !== 'undefined' && mob === selectedMob && typeof currentTool !== 'undefined' && currentTool === 'move') {
                ctx.fillStyle = "rgba(0, 120, 215, 0.3)"; 
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                
                ctx.strokeStyle = "#0078D7"; 
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                ctx.lineWidth = 1; 
            }
            
            // ✨ FIX: Verificamos si los nombres están ocultos antes de dibujarlos
            if (!window.hideMobNames) {
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 12px Arial";
                ctx.textAlign = "center";
                ctx.shadowColor = "black"; ctx.shadowBlur = 4;
                let displayName = mob.name ? String(mob.name) : String(mob.type).toUpperCase();
                ctx.fillText(displayName, screenX, screenY - mobHeight - 8);
                ctx.shadowBlur = 0; 
                
                // Si quieres que también se oculte la barra de vida cuando ocultas el nombre,
                // mueve el bloque de `if (mob.health !== undefined)` AQUÍ ADENTRO. 
                // Si quieres que la barra de vida siempre se vea, déjalo afuera de este IF.
            }
            
            if (mob.health !== undefined) {
                let maxHp = mob.maxHealth || (typeof getMobMaxHealth === 'function' ? getMobMaxHealth(mob) : (typeof MOBS_HP_DB !== 'undefined' ? MOBS_HP_DB[mob.type] : 20)) || 20;
                let currentHealth = Math.ceil(Number(mob.health));
                let hpPercent = Math.max(0, Math.min(1, currentHealth / maxHp)); 
                
                ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fillRect(screenX - (mobWidth/2), screenY - mobHeight - 4, mobWidth, 4);
                
                ctx.fillStyle = hpPercent > 0.3 ? "#00FF00" : "#FF0000";
                ctx.fillRect(screenX - (mobWidth/2), screenY - mobHeight - 4, mobWidth * hpPercent, 4);
            }
            
            let miNombre = localStorage.getItem('mbw_username') || "Player";
            
            if (mob.lockedBy && mob.lockedBy !== miNombre && mob.lastMoveTime && (Date.now() - mob.lastMoveTime < 500)) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
                ctx.fillRect(screenX - (mobWidth / 2), screenY - mobHeight, mobWidth, mobHeight);
                
                ctx.fillStyle = "#FF5555";
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "center";
                ctx.shadowColor = "black"; ctx.shadowBlur = 3;
                const lockY = screenY - mobHeight - 22, lockW = ctx.measureText(mob.lockedBy).width;
                if (window.mbwDrawIcon && window.mbwDrawIcon(ctx, 'lock', screenX - lockW / 2 - 4, lockY - 4, 11, '#FF5555')) ctx.fillText(mob.lockedBy, screenX + 4, lockY);   // (candado dibujado, sin emoji)
                else ctx.fillText(mob.lockedBy, screenX, lockY);
                ctx.shadowBlur = 0;
            }
        } catch (e) {
            console.error("Mob inválido saltado");
        }
    }
}

// La armadura que lleva puesta el jugador (world.armors = 4 piezas [id, daño, extras]: cabeza, pecho, piernas, pies),
// con la misma forma que la de un mob para dibujarla con drawMobArmorOverlay.
window.mbwPlayerArmorMob = function () {
    const w = (typeof mbwom !== 'undefined' && mbwom.world) ? mbwom.world : null;
    const arr = w && Array.isArray(w.armors) ? w.armors : null;
    if (!arr) return null;
    return { armor: [0, 1, 2, 3].map(i => {
        const a = arr[i];
        if (!Array.isArray(a)) return ['air', 0, 0, {}];
        const ex = (a[2] && typeof a[2] === 'object') ? a[2] : ((a[3] && typeof a[3] === 'object') ? a[3] : {});
        return { id: a[0], extras: ex };
    }) };
};

function drawPlayer() {
    if (typeof mbwom === 'undefined' || !mbwom.world || mbwom.world.worldX === undefined || mbwom.world.worldY === undefined) return;
    const playerScene = mbwom.world.scene || 1; 
    const currentScene = typeof mbwom.currentScene !== 'undefined' ? mbwom.currentScene : 1;
    if (playerScene !== currentScene) return;

    const playerWorldX = Number(mbwom.world.worldX);
    const playerWorldY = -Number(mbwom.world.worldY);

    const screenX = (playerWorldX - camera.x) * tileSize;
    const screenY = canvas.height - (playerWorldY - camera.y) * tileSize;

    if (screenX < -200 || screenX > canvas.width + 200 || screenY < -200 || screenY > canvas.height + 200) {
        return;
    }

    const playerWidth = tileSize * 1.4;
    const playerHeight = tileSize * 2.0;

    let playerImg = window.images['Player'];

    if (playerImg && playerImg.complete && playerImg.naturalWidth > 0) {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            playerImg, 
            0, 0, playerImg.naturalWidth, playerImg.naturalHeight,
            -(playerWidth / 2), -playerHeight, playerWidth, playerHeight 
        );
        const pArmor = window.mbwPlayerArmorMob();                     // su armadura puesta, encima (igual que en los mobs)
        if (pArmor) drawMobArmorOverlay(ctx, pArmor, -(playerWidth / 2), -playerHeight, playerWidth, playerHeight);
        ctx.restore();
    } else {
        ctx.fillStyle = "rgba(0, 100, 255, 0.6)"; 
        ctx.fillRect(screenX - (playerWidth / 2), screenY - playerHeight, playerWidth, playerHeight);
        
        ctx.fillStyle = "rgba(255, 200, 150, 0.8)"; 
        ctx.fillRect(screenX - (playerWidth / 2), screenY - playerHeight, playerWidth, playerHeight * 0.3);

        ctx.strokeStyle = "#FFFFFF";
        ctx.strokeRect(screenX - (playerWidth / 2), screenY - playerHeight, playerWidth, playerHeight);
    }

    ctx.fillStyle = "#00FFFF"; 
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "black"; ctx.shadowBlur = 4;
    ctx.fillText("PLAYER", screenX, screenY - playerHeight - 8);
    ctx.shadowBlur = 0;
}

// 🌐 Multijugador: manda a los demás un montón de bloques cambiados de una vez (en tandas de 2000)
window.mbwSendBlockBatch = function (cambios) {
    if (!cambios || !cambios.length || typeof enviarMensajeEnRed !== 'function') return;
    for (let i = 0; i < cambios.length; i += 2000) enviarMensajeEnRed({ tipo: "accion_lote", cambios: cambios.slice(i, i + 2000) });
};

window.fillSelectionWithBucket = function(blockState) {
    if (!window.selection || !window.selection.type) return false; 
    let blocksUpdated = 0;

    const netChanges = [];
    if (window.selection.type === 'magic' && window.selection.points) {
        window.selection.points.forEach(p => {
            mbwom.setBlockState(p.x, p.y, blockState); 
            if (typeof renderBlock === 'function') renderBlock(p.x, p.y); 
            netChanges.push([p.x, p.y, blockState]);
            blocksUpdated++;
        });
    } 
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
                    netChanges.push([x, y, blockState]);
                    blocksUpdated++;
                }
            }
        });
    }
    
    if (blocksUpdated > 0) {
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        window.mbwSendBlockBatch(netChanges);
        return true; 
    }
    return false;
};

function drawUI() {
    if (typeof updateRotateButtonState === 'function') updateRotateButtonState();   // (apaga el botón Rotate si el bloque de la mano no se gira)
    const coordsDiv = document.getElementById('coords-overlay');
    if (coordsDiv) {
        coordsDiv.innerText = `X: ${Math.floor(mouse.worldX)} Y: ${Math.floor(mouse.worldY)}` + (window.mbwBiomeLabel ? window.mbwBiomeLabel(Math.floor(mouse.worldX)) : '');
    }
    
    const selDiv = document.getElementById('selection-overlay');
    if (selDiv) {
        if (window.selection && window.selection.type === 'rect' && window.selection.p1 && window.selection.p2) {
            let w = Math.abs(window.selection.p2.x - window.selection.p1.x) + 1;
            let h = Math.abs(window.selection.p2.y - window.selection.p1.y) + 1;
            selDiv.innerText = `W: ${w} H: ${h}`;
            selDiv.style.display = 'block'; 
        } else {
            selDiv.style.display = 'none'; 
        }
    }
    
    if (typeof currentTool !== 'undefined' && currentTool !== 'paste' && currentTool !== 'select' && currentTool !== 'lasso' && currentTool !== 'aspect') {
        // Solo el Lápiz y el Borrador usan el tamaño del pincel; Move, Cubeta y Varita actúan sobre 1 sola casilla
        const size = ((currentTool === 'pencil' || currentTool === 'eraser') && typeof toolSize !== 'undefined') ? toolSize : 1;
        
        const offsetStart = Math.floor(size / 2);
        const offsetEnd = Math.floor((size - 1) / 2);
        
        ctx.strokeStyle = "#4DA6FF"; 
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(77, 166, 255, 0.2)"; 

        const centerX = -offsetStart + (size - 1) / 2;
        const centerY = -offsetStart + (size - 1) / 2;
        const radiusSq = (size / 2) ** 2;

        const isInside = (dx, dy) => {
            if (dx < -offsetStart || dx > offsetEnd || dy < -offsetStart || dy > offsetEnd) return false;
            if (typeof toolRounded !== 'undefined' && toolRounded && size > 1) {
                return ((dx - centerX)**2 + (dy - centerY)**2 <= radiusSq);
            }
            return true;
        };

        // 👻 Fantasma del bloque: con el Lápiz (y la Cubeta) se ve, siguiendo al cursor, el bloque de la barra rápida que se va a poner
        // (con su variante: escalera girada, antorcha inclinada, etc.), en las mismas casillas que marca el contorno azul.
        if (currentTool === 'pencil' || currentTool === 'bucket') {
            const slotObj = (typeof hotbar !== 'undefined' && hotbar.slots) ? hotbar.slots[slotIndex] : null;
            let ghostTex = null;
            if (slotObj && slotObj.type) { try { ghostTex = getBlockObject(slotObj); } catch (e) { ghostTex = null; } }
            if (ghostTex && typeof ghostTex.x === 'number') {
                ctx.save();
                ctx.globalAlpha = 0.6;
                for (let dx = -offsetStart; dx <= offsetEnd; dx++) {
                    for (let dy = -offsetStart; dy <= offsetEnd; dy++) {
                        if (!isInside(dx, dy)) continue;
                        const gX = (mouse.worldX + dx - camera.x) * tileSize;
                        const gY = canvas.height - (mouse.worldY + dy - camera.y) * tileSize;
                        // Con pinceles muy grandes no se dibujan las casillas que quedan fuera de la pantalla
                        if (gX + tileSize < 0 || gX > canvas.width || gY < 0 || gY - tileSize > canvas.height) continue;
                        drawBlock(ghostTex, { x: gX, y: gY, width: tileSize, height: -tileSize });
                    }
                }
                ctx.restore();
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

                    if (!isInside(dx + 1, dy)) { ctx.moveTo(right, bottom); ctx.lineTo(right, top); }
                    if (!isInside(dx - 1, dy)) { ctx.moveTo(left, bottom); ctx.lineTo(left, top); }
                    if (!isInside(dx, dy + 1)) { ctx.moveTo(left, top); ctx.lineTo(right, top); }
                    if (!isInside(dx, dy - 1)) { ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); }
                }
            }
        }
        ctx.stroke(); 
    }

    if (typeof currentTool !== 'undefined' && currentTool === 'paste' && window.clipboard) {
        ctx.save();
        ctx.globalAlpha = 0.5;

        const pasteFilterNow = window.pasteFilter;   // "pegar solo sobre…": el fantasma solo muestra lo que se va a cambiar de verdad
        window.clipboard.data.forEach(blockData => {
            if (!blockData.state) return;
            const absX = mouse.worldX + blockData.dx;
            const absY = mouse.worldY + blockData.dy;
            if (pasteFilterNow && !window.pasteFilterMatches(pasteFilterNow, mbwom.getBlockState(absX, absY))) return;
            
            const screenX = (absX - camera.x) * tileSize;
            const screenY = canvas.height - (absY - camera.y) * tileSize;

            const values = { x: screenX, y: screenY, width: tileSize, height: -tileSize };
            const texture = getBlockObject(blockData.state);
            drawBlock(texture, values);
        });
        
        // Mobs que vienen en el portapapeles (copiados con el Lazo): un cuadro punteado con su tamaño
        if (window.clipboard.mobs && window.clipboard.mobs.length) {
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = "#00FFFF";
            ctx.lineWidth = 2;
            window.clipboard.mobs.forEach(e => {
                const info = (typeof getMobDrawInfo === 'function') ? getMobDrawInfo(e.mob, true) : { w: 1, h: 2 };
                const cx = (mouse.worldX + e.dx - camera.x) * tileSize;
                const cy = canvas.height - (mouse.worldY + e.dy - camera.y) * tileSize;
                ctx.strokeRect(cx - info.w * tileSize / 2, cy, info.w * tileSize, -info.h * tileSize);
            });
            ctx.setLineDash([]);
        }
        ctx.restore();

        const startScreenX = (mouse.worldX - camera.x) * tileSize;
        const startScreenY = canvas.height - (mouse.worldY - camera.y) * tileSize;
        ctx.strokeStyle = "#00FFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(startScreenX, startScreenY, window.clipboard.width * tileSize, -(window.clipboard.height * tileSize));
    }

    if (window.selection.type === 'magic' && window.selection.points && window.selection.points.length > 0) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.2)"; 
        ctx.strokeStyle = "#87CEFA"; 
        ctx.lineWidth = 2;
        
        ctx.setLineDash([6, 6]); 
        ctx.lineDashOffset = -(Date.now() / 50); 

        ctx.beginPath();
        
        window.selection.points.forEach(point => {
            const screenX = (point.x - camera.x) * tileSize;
            const screenY = canvas.height - (point.y - camera.y) * tileSize;
            
            ctx.fillRect(screenX, screenY, tileSize, -tileSize);

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
        ctx.setLineDash([]);
    }

    if (window.selection.type === 'rect') {
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
            
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -(Date.now() / 50);
            
            ctx.strokeRect(screenX, screenY, screenW, screenH);
            
            ctx.setLineDash([]);
        });
    }
    
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
    
    if (typeof currentTool !== 'undefined' && currentTool === 'spawn_mob' && typeof currentMobToSpawn !== 'undefined' && currentMobToSpawn === 'spawnskin') {
        drawSpawnskinGhost();
    } else if (typeof currentTool !== 'undefined' && currentTool === 'spawn_mob' && typeof currentMobToSpawn !== 'undefined' && currentMobToSpawn) {
        let mobImg = window.images[currentMobToSpawn];

        if (mobImg && mobImg.complete && mobImg.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.6; 
            ctx.imageSmoothingEnabled = false; 
            
            let tSize = typeof tileSize !== 'undefined' ? tileSize : 16;
            let drawWidth = tSize * 1.2; // Tamaño por defecto (ej. Zombies, Esqueletos)
            
            // ✨ FIX: Le enseñamos al fantasma el ancho real de todos los animales anchos/pequeños
            if (currentMobToSpawn === 'enderdragon') drawWidth = tSize * 6;
            if (currentMobToSpawn === 'ghast' || currentMobToSpawn === 'slime' || currentMobToSpawn === 'magmacube') drawWidth = tSize * 2.5;
            if (currentMobToSpawn === 'spider') drawWidth = tSize * 1.5;
            if (currentMobToSpawn === 'cow' || currentMobToSpawn === 'cowctus' || currentMobToSpawn === 'mushroom') drawWidth = tSize * 2.6;
            if (currentMobToSpawn === 'pig' || currentMobToSpawn === 'wolf' || currentMobToSpawn === 'dog' || currentMobToSpawn === 'sheep') drawWidth = tSize * 2.0;
            if (currentMobToSpawn === 'rabbit' || currentMobToSpawn === 'bat' || currentMobToSpawn === 'nethereye') drawWidth = tSize * 0.75;

            let ratio = mobImg.naturalHeight / mobImg.naturalWidth;
            let drawHeight = drawWidth * ratio; 
            
            let screenX = mouse.canvasX;
            let screenY = canvas.height - mouse.canvasY;

            ctx.drawImage(
                mobImg, 
                0, 0, mobImg.naturalWidth, mobImg.naturalHeight,
                screenX - (drawWidth / 2), screenY - drawHeight, drawWidth, drawHeight
            );
            
            ctx.restore();
        }
    }
    
    if (typeof window.mySpectators !== 'undefined' && window.mySpectators.size > 0) {
        ctx.save();
        
        const text = Array.from(window.mySpectators).join(", ");
        ctx.font = "bold 16px Arial";
        
        const paddingX = 15;
        const paddingY = 8;
        const eyeW = 24;                                  // el ojo (ícono dibujado) va a la izquierda del texto
        const textWidth = ctx.measureText(text).width + eyeW;
        const boxWidth = textWidth + (paddingX * 2);
        const boxHeight = 34;
        
        const startX = canvas.width - boxWidth - 20;
        const startY = 20;

        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(startX, startY, boxWidth, boxHeight);
        
        ctx.strokeStyle = Math.floor(Date.now() / 500) % 2 === 0 ? "#ff7675" : "#e74c3c";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, boxWidth, boxHeight);

        ctx.fillStyle = "#ff7675";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (window.mbwDrawIcon) window.mbwDrawIcon(ctx, 'eye', startX + paddingX + 9, startY + (boxHeight / 2), 18, '#ff7675');
        ctx.fillText(text, startX + (boxWidth / 2) + eyeW / 2, startY + (boxHeight / 2));
        
        ctx.restore();
    }
    
    if (typeof currentTool !== 'undefined' && currentTool === 'pixelart' && window.pendingPixelArt && window.pendingPixelArt.imgCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.5; 
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

window.updateTimeIcon = function() {
    const timeInput = document.getElementById('gr-time');
    const timeIcon = document.getElementById('live-time-icon');
    
    if (timeInput && timeIcon) {
        const val = Number(timeInput.value);
        const expectedImg = (val >= 50) ? 'assets/moon.png' : 'assets/sun.png';
        
        if (!timeIcon.src.includes(expectedImg)) {
            timeIcon.src = expectedImg;
        }
    }
};

// Límite de FPS (Ajustes > Display): 0 = sin límite, 30 o 60. Se salta cuadros hasta que toca dibujar el siguiente.
// nextFrameAt va "sumando" el intervalo (no usa la hora de cada cuadro), así en pantallas de 120 o 144 Hz el límite de 60 sale 60 de verdad.
let nextFrameAt = 0;
window.framesDrawn = 0;   // cuántos cuadros se dibujaron de verdad (lo lee el medidor de FPS de la barra de estado)
function mainLoop(ts) {
    const limit = window.fpsLimit | 0;
    if (limit > 0) {
        const now = (typeof ts === 'number') ? ts : performance.now();
        const interval = 1000 / limit;
        if (now < nextFrameAt - 1) { requestAnimationFrame(mainLoop); return; }   // todavía no toca
        nextFrameAt = (nextFrameAt === 0 || now - nextFrameAt > interval * 2) ? now + interval : nextFrameAt + interval;
    } else {
        nextFrameAt = 0;
    }
    window.framesDrawn++;
    // Sin mundo abierto (por ejemplo, al cerrar la última pestaña) no hay nada que dibujar ni mover:
    // se deja el lienzo vacío y el bucle sigue vivo para cuando se abra otro mundo.
    if (typeof mbwom === 'undefined' || !mbwom.scene) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(mainLoop);
        return;
    }
    cameraMovement();
    snapSmoothCamera();
    mouse.calculateCoordinates();
    
    if (!window.spectatingTargetId) {
        if (typeof mineAndPlace === 'function') mineAndPlace();
    }
    
    drawWorld();
    // scripts/world-extras.js: texto de letreros y vagonetas / balsas van debajo de los mobs; marcadores y fantasma de vagoneta encima
    if (window.mbwExtras) { try { window.mbwExtras.beforeMobs(); } catch (e) { if (!window.mbwExtrasErr) { window.mbwExtrasErr = true; console.error('world-extras:', e); } } }
    if (typeof drawMobs === 'function') drawMobs(); 
    if (window.mbwExtras) { try { window.mbwExtras.afterMobs(); } catch (e) { if (!window.mbwExtrasErr) { window.mbwExtrasErr = true; console.error('world-extras:', e); } } }
    drawPlayer();
    if (window.mbwDarkness) window.mbwDarkness.draw(ctx);   // 🌑 oscuridad bajo tierra + auras de luz + 🗺️ franja de biomas (scripts/darkness.js)

    const liveTimeToggle = document.getElementById('live-time-toggle');
    const timeInput = document.getElementById('gr-time');

    if (liveTimeToggle && liveTimeToggle.checked && timeInput) {
        if (typeof window.lastTimeUpdate === 'undefined') window.lastTimeUpdate = Date.now();
        
        let ahora = Date.now();
        if (ahora - window.lastTimeUpdate >= 12000) { 
            let nuevoTiempo = Number(timeInput.value) + 1;
            if (nuevoTiempo > 99) nuevoTiempo = 0; 
            timeInput.value = nuevoTiempo;
            window.lastTimeUpdate = ahora;
            
            if (typeof updateTimeIcon === 'function') updateTimeIcon();
        }

        let progreso = Number(timeInput.value) / 99; 
        let oscuridad = 0;
        
        if (progreso > 0.30 && progreso <= 0.50) {
            oscuridad = ((progreso - 0.30) / 0.20) * 0.75;
        } 
        else if (progreso > 0.50 && progreso <= 0.90) {
            oscuridad = 0.75;
        } 
        else if (progreso > 0.90) {
            oscuridad = 0.75 - (((progreso - 0.90) / 0.10) * 0.75);
        }

        if (oscuridad > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(5, 5, 20, ${oscuridad})`; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
    }
    
    if (typeof drawUI === 'function') drawUI();
    
    // 👥 lo que seleccionan los demás jugadores (scripts/mp-live.js)
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && typeof window.mpDrawRemoteSelections === 'function') {
        try { window.mpDrawRemoteSelections(ctx); } catch (e) { /* nada */ }
    }

    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && window.networkCursors) {
        let ahora = Date.now();
        for (let key in window.networkCursors) {
            let cursor = window.networkCursors[key];
            if (ahora - cursor.lastUpdate > 60000) continue; 
            if (typeof window.mpCursorVisible === 'function' && !window.mpCursorVisible(key, cursor)) continue;   // otra dimensión u otro mundo
            const autor = cursor.name || key;
            const pc = typeof window.mpPlayerColor === 'function' ? window.mpPlayerColor(autor) : "#4DA6FF";
            const pcA = typeof window.mpPlayerColor === 'function' ? window.mpPlayerColor(autor, 0.35) : "rgba(77, 166, 255, 0.4)";

            let screenX = (cursor.x - camera.x) * tileSize;
            let screenY = canvas.height - ((cursor.y - camera.y) * tileSize) - tileSize;

            ctx.fillStyle = pcA;
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
            ctx.strokeStyle = pc;
            ctx.strokeRect(screenX, screenY, tileSize, tileSize);

            ctx.fillStyle = "white";
            ctx.font = "16px 'Pixeltype', sans-serif";
            ctx.textAlign = "center";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            ctx.fillText(autor, screenX + (tileSize/2), screenY - 5);
            ctx.shadowBlur = 0; 

            ctx.save();
            ctx.translate(screenX + (tileSize / 2), screenY + (tileSize / 2));
            
            ctx.beginPath();
            ctx.moveTo(0, 0);       
            ctx.lineTo(0, 17);      
            ctx.lineTo(4, 13);      
            ctx.lineTo(8, 20);      
            ctx.lineTo(11, 18);     
            ctx.lineTo(7, 12);      
            ctx.lineTo(13, 12);     
            ctx.closePath();
            
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)"; 
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
            ctx.stroke();
            
            ctx.restore();
        }
    }

    // 👁 Relación de aspecto: solo se ve el área elegida (scripts/aspect-view.js)
    if (window.mbwAspect) { try { window.mbwAspect.draw(ctx); } catch (e) { /* nada */ } }
    
    requestAnimationFrame(mainLoop);
}

function changeDimension(sceneIndex) {
    if (typeof mbwom !== 'undefined' && mbwom.world) {
        if (mbwom.world["scene" + sceneIndex]) {
            mbwom.loadScene(sceneIndex);
            mbwom.currentScene = sceneIndex; 
            
            initializeWorldCache(); 
            closeModal('dimensions-modal'); 
            
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
            alert(tmsg('msg_dim_not_generated', "This dimension is not generated in the current world."));
        }
    }
}

// Pone el ícono de dimensión (Overworld / Nether / End) según la dimensión que está abierta ahora.
// Se usa al abrir un mundo y al cambiar de pestaña, para que el ícono no se quede con el de otro mundo.
window.syncDimensionIcon = function () {
    const iconElement = document.getElementById('current-dim-icon');
    if (!iconElement || typeof mbwom === 'undefined') return;
    const icons = { 1: "assets/Overworld icon.png", 2: "assets/Nether icon.png", 3: "assets/End icon.png" };
    iconElement.src = icons[mbwom.currentScene || 1] || icons[1];
};

// ✨ setMpView / setMpLimit / copyRoomId / multiplayerPlayerLimit: se quitaron de aquí
// porque ya existían versiones (mejores) en scripts/multiplayer.js, y como ese archivo
// se carga después de main.js, estas copias nunca se estaban ejecutando (código muerto).
//
// ✨ openUnifiedProfile / handleGlobalProfileUpload / handleGlobalUsernameChange: se
// movieron a scripts/profile.js (junto con la versión que de verdad se usaba, la de
// index.html, que además comprime la foto de perfil antes de guardarla).

window.toggleHelpMenu = function() {
    document.getElementById("help-dropdown").classList.toggle("show");
};

window.closeHelpMenu = function() {
    let dropdown = document.getElementById("help-dropdown");
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove("show");
    }
};

document.addEventListener('click', function(event) {
    if (!event.target.matches('.icon-btn') && !event.target.closest('.dropdown-container')) {
        window.closeHelpMenu();
    }
});


const canvasElement = document.getElementById('canvas');

if (canvasElement) {
    canvasElement.addEventListener('wheel', function(e) {
        e.preventDefault(); 
        if (window.mbwAspect && window.mbwAspect.active) { window.mbwAspect.zoomBlocked(); return; }   // 👁 zoom bloqueado

        let mX = (typeof mouse !== 'undefined' && mouse.canvasX !== null) ? mouse.canvasX : canvasElement.width / 2;
        let mY = (typeof mouse !== 'undefined' && mouse.canvasY !== null) ? mouse.canvasY : canvasElement.height / 2;

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

            if (window.smoothScroll) {
                // con el desplazamiento fluido la cámara puede quedar entre dos cuadros: el punto bajo el cursor se queda casi exacto
                camera.x = exactWorldX - (mX / newTileSize);
                camera.y = exactWorldY - (mY / newTileSize);
            } else {
                // sin él la cámara solo puede quedar en cuadros enteros (y redondear al más cercano a veces pasaba el cursor al cuadro de al lado):
                // se elige el único entero con el que el CUADRO que estaba bajo el cursor sigue bajo el cursor
                camera.x = Math.ceil(Math.floor(exactWorldX) - (mX / newTileSize) - 1e-9);
                camera.y = Math.ceil(Math.floor(exactWorldY) - (mY / newTileSize) - 1e-9);
            }

            updateZoomSlider(currentZoomIndex);

            if (typeof mouse !== 'undefined' && mouse.canvasX !== null) {
                mouse.gridX = Math.floor(mouse.canvasX / tileSize);
                mouse.gridY = Math.floor(mouse.canvasY / tileSize);
                mouse.calculateCoordinates();
            }

            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
    }, { passive: false });
}

window.toggleAddonsMenu = function() {
    const menu = document.getElementById('addons-dropdown');
    const container = document.getElementById('addons-dropdown-container');
    const btn = container.querySelector('.tab-btn');

    menu.classList.toggle('show');
    
    if (menu.classList.contains('show')) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
};

window.skinCache = window.skinCache || {};
window.skinFetchInProgress = window.skinFetchInProgress || {};

// ---------------------------------------------------------------------------------------------------------------
// Imagen de una spawnskin por su ID.
//   0) assets/spawnskins/{id}.png  SOLO si el ID está en window.LOCAL_SPAWNSKINS (hoy el editor no trae ninguna: antes se
//      probaba siempre y cada skin perdía tiempo esperando un "no existe" antes de bajarse de internet)
//   Luego, de internet, en este orden (la primera fuente que funciona se recuerda y las siguientes skins van directo a ella):
//   1) el "puente" propio (Cloudflare Worker, versión 2):  <puente>/skin/{id}.png  — trae el permiso CORS, así la imagen
//      NO "ensucia" el lienzo: se le quita el fondo blanco y las capturas de pantalla la incluyen
//   2) "espejo" público de imágenes (wsrv.nl, gratis): la MISMA imagen de mineblocks.com, idéntica píxel por píxel
//      (comprobado 29 oct), pero con el permiso CORS. Sirve mientras el puente siga en la versión 1 (que solo da la lista)
//   3) mineblocks.com sin pedir permiso: la skin SE VE, pero el navegador no deja leer sus píxeles (no se le quita el fondo
//      y las capturas la dibujan como la spawnskin genérica). Solo si las dos de arriba fallan.
//   (mineblocks.com pidiendo el permiso no se intenta: COMPROBADO 28 oct, no lo da y llena la consola de errores)
// Algunas skins de la web traen el fondo en un color sólido (blanco) en vez de transparente: ese fondo se vuelve
// transparente (solo la parte que toca el borde, así los ojos blancos de la skin se quedan).
// Prioridad: window.mbwSkinPrefetch(ids, true) pone esas skins al frente de la fila (la galería lo usa con la página que
// estás viendo) y con false las agrega al final (las páginas siguientes, para tenerlas listas).
// ---------------------------------------------------------------------------------------------------------------
window.SKIN_REMOTE_URL = 'https://mineblocks.com/1/skins/images/';
// Las skins que vienen dentro del editor (carpeta assets/spawnskins/): se cargan de ahí primero (misma página = sin problemas de permiso).
// Si agregas o quitas archivos de esa carpeta, agrega o quita su número en esta lista (las que no están aquí se bajan de internet).
window.LOCAL_SPAWNSKINS = window.LOCAL_SPAWNSKINS || (function () {
    const o = {};
    '1 7 174 180 329 1080 1327 1973 2115 7111 8526 12693 13806 19644 20651 21068 24843 25616 27363 27397 27573 28573 30121 33287 33662 34547 34999 37260 39838 41063 42817 42906 43120 49044 49549 52187 55906 56245 57308 58300 58333 58445 58650 58779 58882 58923 58936 59364 59694 59829 60217 60720 61101 61200 61288 61392 61536 61868 62919 63095 64318 65038 65039 65053 65245 65512 65565 65629 65779 65965 66093 66200 66425 66479 66519 66842 66935 67095 67300 67690 68179 68255 68897 69016 69080 69350 69575 69653 70142 70290 70403 70453 70496 70783 70804 70819 70915 70940 71364 71365 71369 71435 71530 71553 71555 71576 71620 71644 71691 71695 71718 71726 71746 71748 71751 71754 71765 72407 72747 72814 72815 73087 73727 73792 74085 74584 74788 75528 75560 75884 76169 76442'.split(' ').forEach(function (id) { if (id) o[id] = true; });
    return o;
})();
window.skinRemoteEnabled = true;                 // se puede apagar con window.skinRemoteEnabled = false
const SKIN_REMOTE_MAX = 8;                       // descargas a la vez
const SKIN_REMOTE_RETRY_MS = 60000;              // si falló (sin internet...), se vuelve a intentar pasado este tiempo
let skinRemoteActive = 0;
const skinRemoteQueue = [];
const skinRemoteLoading = {};                    // las que se están bajando en este momento (no se vuelven a pedir)
const SKIN_SOURCES = ['bridge', 'mirror', 'plain'];   // (mineblocks.com no da permiso CORS: pedirla "con permiso" siempre falla y llena la consola de errores)
window.SKIN_MIRROR_URL = 'https://wsrv.nl/?url=mineblocks.com/1/skins/images/';
const skinSource = { ok: null, dead: {} };       // la fuente que ya funcionó · las que no sirven (no se vuelven a probar)
window.mbwSkinSourceState = function () { return { ok: skinSource.ok, dead: Object.keys(skinSource.dead) }; };

function skinRemoteAllowed(id) { return window.skinRemoteEnabled !== false && /^[0-9]{1,12}$/.test(String(id)); }   // solo IDs numéricos: nada de rutas raras que vengan en un mundo

// Si la esquina de arriba a la izquierda es un color sólido, ese color (la parte conectada con el borde) pasa a ser transparente.
function skinKeyBackground(img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const im = x.getImageData(0, 0, w, h), d = im.data;
    if (d[3] !== 255) return img;                                   // ya es transparente: se usa tal cual
    const kr = d[0], kg = d[1], kb = d[2];
    const isKey = (i) => d[i + 3] === 255 && d[i] === kr && d[i + 1] === kg && d[i + 2] === kb;
    const seen = new Uint8Array(w * h), stack = [];
    const push = (px, py) => { if (px < 0 || py < 0 || px >= w || py >= h) return; const k = py * w + px; if (seen[k] || !isKey(k * 4)) return; seen[k] = 1; stack.push(k); };
    for (let px = 0; px < w; px++) { push(px, 0); push(px, h - 1); }
    for (let py = 0; py < h; py++) { push(0, py); push(w - 1, py); }
    for (let px = 0; px < w; px += 16) { for (let py = 0; py < h; py++) { push(px, py); push(px + 15, py); } }   // bordes de cada cuadro de 16 px de la tira
    while (stack.length) {
        const k = stack.pop(), px = k % w, py = (k / w) | 0;
        d[k * 4 + 3] = 0;
        push(px + 1, py); push(px - 1, py); push(px, py + 1); push(px, py - 1);
    }
    x.putImageData(im, 0, 0);
    return c;
}

// Dirección del puente para imágenes (la misma que usa la galería para la lista), o null si no hay puente
function skinBridgeBase() {
    try {
        const g = window.mbwSkinGallery;
        const b = g && typeof g.bridgeBase === 'function' ? g.bridgeBase() : null;
        return (typeof b === 'string' && /^https:\/\//i.test(b)) ? b : null;
    } catch (e) { return null; }
}
function skinSourceUrl(src, id) {
    if (src === 'bridge') { const b = skinBridgeBase(); return b ? b.replace(/\/+$/, '') + '/skin/' + id + '.png' : null; }
    if (src === 'mirror') return window.SKIN_MIRROR_URL ? window.SKIN_MIRROR_URL + id + '.png' : null;
    return window.SKIN_REMOTE_URL + id + '.png';
}
function skinLoadImg(url, cors) {
    return new Promise((resolve, reject) => {
        const im = new Image();
        if (cors) im.crossOrigin = 'anonymous';
        im.onload = () => (im.naturalWidth > 0 ? resolve(im) : reject(new Error('empty')));
        im.onerror = () => reject(new Error('load'));
        im.src = url;
    });
}
// La imagen ya bajada, lista para usar (sin fondo blanco si se pueden leer sus píxeles)
function skinFinish(im, id) {
    return new Promise((resolve, reject) => {
        let out;
        try { out = skinKeyBackground(im); } catch (e) { im.__tainted = true; resolve(im); return; }   // no se pueden leer sus píxeles: tal cual
        if (out === im) { resolve(im); return; }
        const fin = new Image();                                       // el lienzo ya procesado, convertido en una imagen normal
        fin.onload = () => resolve(fin);
        fin.onerror = () => reject(new Error('skin ' + id));
        fin.src = out.toDataURL('image/png');
    });
}
async function skinRemoteLoad(id) {
    const order = skinSource.ok ? [skinSource.ok].concat(SKIN_SOURCES.filter(s => s !== skinSource.ok)) : SKIN_SOURCES.slice();
    const failed = [];
    for (const src of order) {
        if (skinSource.dead[src]) continue;
        const url = skinSourceUrl(src, id);
        if (!url) continue;
        let im;
        try { im = await skinLoadImg(url, src !== 'plain'); }
        catch (e) {
            failed.push(src);
            // el puente ya funcionó antes con otras skins: si ahora no la da, es que esa skin no existe (no se pide otra vez por otro lado)
            if (src === 'bridge' && skinSource.ok === 'bridge') break;
            continue;
        }
        // Esta fuente sirve. Las que fallaron antes con ESTA MISMA skin (que sí existe) no sirven: no se vuelven a probar
        // (salvo que alguna vez hayan funcionado: entonces fue un tropiezo de esa skin)
        failed.forEach(f => { if (skinSource.ok !== f) skinSource.dead[f] = true; });
        if (!skinSource.ok || skinSource.dead[skinSource.ok]) skinSource.ok = src;
        if (src === 'plain') { im.__tainted = true; return im; }
        return skinFinish(im, id);
    }
    throw new Error('skin ' + id);
}

function skinRemotePump() {
    while (skinRemoteActive < SKIN_REMOTE_MAX && skinRemoteQueue.length) {
        const id = skinRemoteQueue.shift();
        if (skinRemoteLoading[id]) continue;
        skinRemoteActive++;
        skinRemoteLoading[id] = true;
        skinRemoteLoad(id).then(img => { window.skinCache[id] = img; })
            .catch(() => { window.skinCache[id] = { hasFailed: true, remoteFailedAt: Date.now() }; })
            .then(() => {
                skinRemoteActive--;
                delete skinRemoteLoading[id];
                delete window.skinFetchInProgress[id];
                if (typeof worldDirty !== 'undefined') worldDirty = true;
                skinSettled(id);
                skinRemotePump();
            });
    }
}
function skinRemoteQueueAdd(id, front) {
    if (skinRemoteLoading[id]) return;                       // ya se está bajando
    const at = skinRemoteQueue.indexOf(id);
    if (at >= 0 && front) skinRemoteQueue.splice(at, 1);
    if (at < 0 || front) { if (front) skinRemoteQueue.unshift(id); else skinRemoteQueue.push(id); }
    window.skinFetchInProgress[id] = true;
    skinRemotePump();
}

// noFetch = true: solo mira lo que ya está en memoria (sin empezar ninguna descarga). Lo usa la selección con el mouse.
window.getSpawnskinImage = function(skinID, noFetch) {
    const cached = window.skinCache[skinID];
    if (cached) {
        // Una que falló (sin internet, por ejemplo) se vuelve a intentar pasado un rato
        if (!noFetch && cached.hasFailed && cached.remoteFailedAt && !window.skinFetchInProgress[skinID] && Date.now() - cached.remoteFailedAt > SKIN_REMOTE_RETRY_MS && skinRemoteAllowed(skinID)) skinRemoteQueueAdd(skinID);
        return cached;
    }
    if (noFetch) return null;
    if (!window.skinFetchInProgress[skinID]) {
        window.skinFetchInProgress[skinID] = true;
        const giveUp = function() {
            if (skinRemoteAllowed(skinID)) { skinRemoteQueueAdd(skinID); return; }   // de internet
            window.skinCache[skinID] = { hasFailed: true };
            delete window.skinFetchInProgress[skinID];
            if (typeof worldDirty !== 'undefined') worldDirty = true;
            skinSettled(skinID);
        };
        if (!window.LOCAL_SPAWNSKINS[String(skinID)]) { giveUp(); return null; }
        const localImg = new Image();
        localImg.onload = function() { window.skinCache[skinID] = localImg; delete window.skinFetchInProgress[skinID]; if (typeof worldDirty !== 'undefined') worldDirty = true; skinSettled(skinID); };
        localImg.onerror = giveUp;   // no está entre las que trae el editor: se baja de internet
        localImg.src = `assets/spawnskins/${skinID}.png`;
    }
    return null;
};
// Pide varias skins de una vez: front = true las pone al FRENTE de la fila (lo que estás viendo); false, al final (para después)
window.mbwSkinPrefetch = function (ids, front) {
    // (al frente: se recorren al revés para que el primero quede primero en la fila; al final: en orden, la página siguiente antes que las otras)
    const list = (Array.isArray(ids) ? ids : []).slice();
    if (front) list.reverse();
    list.forEach(function (id) {
        id = String(id);
        if (!skinRemoteAllowed(id)) return;
        const c = window.skinCache[id];
        if (c && !c.hasFailed) return;
        if (window.skinFetchInProgress[id]) { if (front) skinRemoteQueueAdd(id, true); return; }
        if (c && c.hasFailed) return;                                  // (los que fallaron se reintentan solos más tarde)
        if (front) { window.skinFetchInProgress[id] = true; skinRemoteQueueAdd(id, true); }
        else window.getSpawnskinImage(id);
    });
};
// ¿Se puede usar esta imagen en una captura? (las que vienen "sin permiso" no: el navegador no dejaría guardar la captura)
window.mbwImageExportable = function (img) { return !!img && !img.__tainted; };

// ---------------------------------------------------------------------------------------------------------------
// 🗣️ CABEZAS DE MOB (el objeto "mh")
// En el mundo una cabeza se guarda así: ["mh", 1, 0, { type: "7", nameChange: "..." }]. El "type" es el ID de la skin
// (una spawnskin): la cabeza que se ve es esa skin recortada a 16x9 px (desde la izquierda y desde arriba).
// Si el "type" es el nombre de un mob (zombie, skeleton, creeper, enderdragon) se usa el dibujo de esa cabeza que ya trae blocks.png.
// Las skins que no cargan (o están vacías) y cualquier otro "type" muestran la cabeza de Steve de siempre.
// drawItemIcon() es la función que usan todos los lugares que dibujan objetos (cofres, inventario, hotbar, drops de mobs...).
// ---------------------------------------------------------------------------------------------------------------
const MOB_HEAD_CROP = { w: 16, h: 9 };       // la parte de la skin que se usa: 16x9 px desde la izquierda y arriba
const MOB_HEAD_SPRITES = { zombie: 'mh_8', skeleton: 'mh_2', creeper: 'mh_4', enderdragon: 'mh_6' };   // cabezas de mob con nombre -> su dibujo en textures.js
const MOB_HEAD_TOP = 7;                      // la cabeza va pegada abajo en la casilla de 16x16 (igual que los dibujos de las demás cabezas)
const skinWaiters = {};                      // dibujos que están esperando a que llegue una skin: { id: [función, ...] }
const mobHeadBlankCache = {};                // skins cuyo recorte 16x9 está vacío (transparente): { id: true/false }
let itemIconToken = 0;

// Cuando una skin termina de cargarse (o de fallar) se vuelven a dibujar las casillas que la estaban esperando.
function skinSettled(id) {
    const list = skinWaiters[id];
    if (!list) return;
    delete skinWaiters[id];
    list.forEach(function (fn) { try { fn(); } catch (e) { /* esa casilla ya no existe */ } });
}

// ID de la skin de una cabeza de mob: solo para el objeto "mh" con un "type" numérico. Si no, null.
window.mobHeadSkinId = function (itemId, extras) {
    if (itemId !== 'mh' || !extras || typeof extras !== 'object') return null;
    const t = extras.type;
    if (t === undefined || t === null) return null;
    const s = String(t).trim();
    return /^[0-9]{1,12}$/.test(s) ? s : null;
};

// Dibujo (de textures.js) de una cabeza cuyo "type" es el nombre de un mob. null si no es una de esas.
window.mobHeadSpriteKey = function (itemId, extras) {
    if (itemId !== 'mh' || !extras || typeof extras !== 'object' || typeof extras.type !== 'string') return null;
    const k = extras.type.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(MOB_HEAD_SPRITES, k) ? MOB_HEAD_SPRITES[k] : null;
};

// Una skin vacía (todo transparente en el recorte) no se usa: se vería una casilla sin nada. Se revisa una sola vez por skin.
function mobHeadIsBlank(id, img) {
    if (mobHeadBlankCache[id] !== undefined) return mobHeadBlankCache[id];
    let blank = false;
    try {
        const c = document.createElement('canvas');
        c.width = MOB_HEAD_CROP.w; c.height = MOB_HEAD_CROP.h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, Math.min(MOB_HEAD_CROP.w, img.naturalWidth || img.width), Math.min(MOB_HEAD_CROP.h, img.naturalHeight || img.height), 0, 0, Math.min(MOB_HEAD_CROP.w, img.naturalWidth || img.width), Math.min(MOB_HEAD_CROP.h, img.naturalHeight || img.height));
        const d = x.getImageData(0, 0, c.width, c.height).data;
        blank = true;
        for (let i = 3; i < d.length; i += 4) { if (d[i] > 0) { blank = false; break; } }
    } catch (e) { blank = false; }                   // (si el navegador no deja leer los píxeles, se usa la skin tal cual)
    mobHeadBlankCache[id] = blank;
    return blank;
}

// Dibuja el objeto "itemId" en el rectángulo (dx, dy, dw, dh) de ctx. "ro" es lo que devolvió getBlockObject (el dibujo del editor
// dentro de blocks.png) y "extras" son los datos del objeto (para "mh": extras.type = ID de la skin).
window.drawItemIcon = function (ctx, ro, itemId, extras, dx, dy, dw, dh) {
    const cvs = ctx.canvas;
    const tok = ++itemIconToken;
    if (cvs) cvs.__itemTok = tok;                                   // la última cosa que se dibujó en este lienzo
    const skin = window.mobHeadSkinId(itemId, extras);
    if (skin) {
        const img = window.getSpawnskinImage(skin);                 // null = todavía no llega (ya se está pidiendo)
        const w = img ? (img.naturalWidth || img.width || 0) : 0, h = img ? (img.naturalHeight || img.height || 0) : 0;
        if (img && !img.hasFailed && w > 0 && h > 0 && !mobHeadIsBlank(skin, img)) {
            const sw = Math.min(MOB_HEAD_CROP.w, w), sh = Math.min(MOB_HEAD_CROP.h, h);
            ctx.clearRect(dx, dy, dw, dh);                          // (borra la cabeza provisional, si ya se había dibujado)
            ctx.drawImage(img, 0, 0, sw, sh, dx, dy + dh * MOB_HEAD_TOP / 16, dw * sw / 16, dh * sh / 16);
            return;
        }
        if (!img) {                                                 // mientras llega la skin, se vuelve a dibujar en cuanto esté
            (skinWaiters[skin] = skinWaiters[skin] || []).push(function () {
                if (cvs && cvs.__itemTok !== tok) return;           // ese lienzo ya muestra otra cosa
                window.drawItemIcon(ctx, ro, itemId, extras, dx, dy, dw, dh);
            });
        }
        // provisional (o si la skin no existe / está vacía): la cabeza de siempre
        if (window.texturesMap && window.texturesMap.mh) ro = window.texturesMap.mh;
        ctx.clearRect(dx, dy, dw, dh);
    }
    const spriteKey = window.mobHeadSpriteKey(itemId, extras);      // cabeza de zombie / skeleton / creeper / enderdragon
    if (spriteKey && window.texturesMap && window.texturesMap[spriteKey]) ro = window.texturesMap[spriteKey];
    if (ro) {
        if (ro.w === 32) ctx.drawImage(window.images.blocks, ro.x, ro.y, 32, 16, dx, dy + dh / 4, dw, dh / 2);   // dibujos anchos (vagoneta, balsa): las dos mitades, a lo ancho de la casilla
        else if (!(window.mbwAnimIcon && window.mbwAnimIcon(ctx, ro, dx, dy, dw, dh))) ctx.drawImage(window.images.blocks, ro.x, ro.y, 16, 16, dx, dy, dw, dh);   // (lana arcoíris, magma, fuego: ícono animado)
    }
};

// Variante de dibujo de un objeto guardado en el mundo ([id, cantidad, daño, extras]). El color va en extras.type
// ("cloth" + { type: "orange" } = lana naranja, igual que las camas); en mundos viejos puede venir en el 3er dato ("orange").
// Solo se usa si existe ese dibujo (cloth_orange...). Las cabezas de mob (mh) se dibujan aparte (su "type" es el ID de una skin).
window.itemTexVariant = function (itemId, damage, extras) {
    const TM = window.texturesMap || {};
    if (!itemId || itemId === 'mh') return undefined;
    const t = (extras && typeof extras === 'object') ? extras.type : undefined;
    if (typeof t === 'string' && t && TM[itemId + '_' + t]) return t;
    if (typeof damage === 'string' && damage && isNaN(Number(damage)) && TM[itemId + '_' + damage]) return damage;
    return undefined;
};

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
                    
                    if (typeof currentTool !== 'undefined') currentTool = 'pixelart';
                    else window.currentTool = 'pixelart';
                    
                    alert(tmsg('msg_pixel_ready', "✅ Image processed! Close this menu and click on the map to paste it."));
                    
                    if (typeof closeModal === 'function') closeModal('pixelart-addon-modal');
                    const uploadInput = document.getElementById('pixelart-upload');
                    if(uploadInput) uploadInput.value = "";
                } catch(err) {
                    alert(tmsg('msg_pixel_error', "Error processing the image: {e}", { e: err.message }));
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } catch(err) {
        alert(tmsg('msg_read_error_detail', "Read error: {e}", { e: err.message }));
    }
};


window.buildPixelArtInWorld = function(pD, w, h, sX, sY, useDithering) {
    try {
        if (typeof historyManager !== 'undefined') historyManager.startAction();
        
        let floatData = new Float32Array(pD);
        const netChanges = [];
        
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4; 
                if (floatData[i + 3] < 50) continue; 

                const oldR = floatData[i];
                const oldG = floatData[i + 1];
                const oldB = floatData[i + 2];

                const bT = getClosestBlock(oldR, oldG, oldB);
                const paletteColor = blockPalette[bT] || [255, 255, 255];
                const newR = paletteColor[0];
                const newG = paletteColor[1];
                const newB = paletteColor[2];

                const bX = Math.floor(sX + x);
                const bY = Math.floor(sY - y);
                
                if (typeof mbwom !== 'undefined' && typeof mbwom.setBlockState === 'function') {
                    const cS = mbwom.getBlockState(bX, bY);
                    const nS = { type: bT };
                    if (typeof historyManager !== 'undefined') historyManager.recordChange(bX, bY, cS, nS);
                    mbwom.setBlockState(bX, bY, nS); 
                    if (typeof renderBlock === 'function') renderBlock(bX, bY);
                    netChanges.push([bX, bY, nS]);
                }

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
        window.mbwSendBlockBatch(netChanges);
        
        return true;
    } catch(e) {
        alert(tmsg('msg_build_error', "Error building in the world: {e}", { e: e.message }));
        return false;
    }
};


function setupPixelArtClicker() {
    window.removeEventListener('mousedown', handlePixelArtClick);
    window.addEventListener('mousedown', handlePixelArtClick);
}

function handlePixelArtClick(e) {
    if (e.target.id !== 'canvas' && e.target.tagName !== 'CANVAS') return;
    
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
            
            alert(tmsg('msg_pixel_done', "🎨 Pixel Art pasted successfully!"));
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPixelArtClicker); 
} else {
    setupPixelArtClicker(); 
}

window.addEventListener('click', function(e) {
    
    const addonsContainer = document.getElementById('addons-dropdown-container');
    const addonsMenu = document.getElementById('addons-dropdown');
    
    if (addonsContainer && !addonsContainer.contains(e.target)) {
        if (addonsMenu && addonsMenu.classList.contains('show')) {
            addonsMenu.classList.remove('show');
            const addonsBtn = addonsContainer.querySelector('.tab-btn');
            if (addonsBtn) addonsBtn.classList.remove('active');
        }
    }

    const clickedTab = e.target.closest('.tab-btn');
    
    if (clickedTab && clickedTab.id !== 'btn-world-info') {
        const sidebar = document.getElementById('world-info-sidebar');
        
        if (sidebar && sidebar.style.display === 'flex') {
            sidebar.style.display = 'none'; 
            
            const infoBtn = document.getElementById('btn-world-info');
            if (infoBtn) infoBtn.classList.remove('active');
            
            const zoomControl = document.getElementById('zoom-floating');
            if (zoomControl) zoomControl.style.right = '20px'; 
        }
    }
});

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
