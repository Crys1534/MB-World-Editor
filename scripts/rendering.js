// ==========================================
// ✨ CAPA TRANSPARENTE PARA LA CUADRÍCULA
// ==========================================
const gridCanvas = document.getElementById('grid-canvas');
const gridCtx = gridCanvas ? gridCanvas.getContext('2d') : null;

function resizeGridCanvas() {
    const workspace = document.getElementById('workspace');
    if (workspace && gridCanvas) {
        gridCanvas.width = workspace.clientWidth;
        gridCanvas.height = workspace.clientHeight;
    }
}
// Ajustamos el tamaño al abrir la página y al cambiar el tamaño de la ventana
if (gridCanvas) {
    window.addEventListener('resize', resizeGridCanvas);
    resizeGridCanvas();
}


window.renderers = {
    default: function (states) {
        const block = states.type;
        const state = states.states1;
        return getTexture(block, state); 
    },
    furnace: function (states) {
        const fuelTimer = states.toSmelt ? states.toSmelt.fuelTimer : 0;
        return getTexture(states.type, fuelTimer > 0);
    },
    brewingStand: function (states) {
        const toBrew = states.toBrew;
        let items = 0;
        if (toBrew != null) {
            for (let i = 0; i < 3; i++) {
                if (typeof mbwom !== 'undefined' && mbwom.isEmptyItem(toBrew.output[i])) items++;
            }
        }
        return getTexture(states.type, items);
    },
    liquid: function (states) {
        const water = states.water;
        let variant;
        if (water != null) {
            if (water[0] > water[1]) variant = 10 - water[0];
            if (water[0] < water[1]) variant = 10 - water[1] + "n";
        }
        return getTexture(states.type, variant);
    },
    wheat: function (states) {
        return getTexture(states.type, states.wheat);
    },
}

function getTexture(block, variant) {
    const textureID = `${block}_${variant}`;
    let texture = window.texturesMap[textureID];
    if (texture == null) {
        texture = window.texturesMap[block];
    }
    if (texture == null) {
        texture = window.texturesMap[`${block}_1`];
    }
    if (texture == null) {
        texture = window.texturesMap.missing;
    }
    return texture;
}

// ==========================================
// 🌈 LANA ARCOÍRIS ANIMADA (con fundido)
// cloth_rainbow / bdcloth_rainbow / carpet_rainbow pasan por los colores de lana (sin blanco, gris claro, gris ni negro, como se pidió),
// y cada color se FUNDE poco a poco con el siguiente (rosa → rojo cierra el círculo). Además cada bloque va un poquito adelantado según su lugar en el mundo, como en el juego:
// de un bloque al de al lado el color cambia solo un poquito (en 6 bloques seguidos se pasa de rosa a rojo); todo el dibujo se desplaza con el tiempo.
//   · cada bloque del mundo guarda el objeto "vivo" (live[...]) como señal; al pintar, main.js le pide a tileAt(señal, x, y) el dibujo que le toca.
//   · los dibujos intermedios (color A mezclado con color B) se arman una sola vez en pequeños lienzos de 16×16 y se guardan.
// Solo cambia en el mundo (la foto del mundo usa estos objetos "vivos"); los íconos del inventario siguen con el dibujo fijo.
// ==========================================
window.rainbowAnim = (function () {
    const ORDER = ['red', 'brown', 'orange', 'yellow', 'lightgreen', 'green', 'cyan', 'lightblue', 'blue', 'purple', 'magenta', 'pink'];
    const N = ORDER.length, SUB = 30;                  // SUB = pasos de mezcla entre un color y el siguiente (muchos = cambio suave)
    const KINDS = { cloth_rainbow: 'cloth_', bdcloth_rainbow: 'bdcloth_', carpet_rainbow: 'carpet_' };
    const live = {};                                   // objetos { x, y, rb } que comparte todo el mundo (señal de "lana arcoíris")
    const T = window.texturesMap || {};
    Object.keys(KINDS).forEach(function (k) { if (T[k]) live[k] = { x: T[k].x, y: T[k].y, rb: KINDS[k] }; });
    // period: milisegundos que tarda en pasar de un color al siguiente · stepX / stepY: cuánto "adelanta" cada bloque hacia la derecha / hacia arriba (en pasos de color)
    const A = { frame: 0, q: 0, t: 0, period: 1000, sub: SUB, stepX: 1 / 5, stepY: 1 / 6, live: live, order: ORDER };
    const blends = {};                                 // "cloth_|3|5" -> { x: 0, y: 0, img: lienzo 16×16 }
    // Si el dibujo es el fijo del arcoíris, devuelve el objeto vivo; si no, el mismo de siempre
    A.map = function (tex) {
        if (!tex) return tex;
        const TM = window.texturesMap;
        if (tex === TM.cloth_rainbow) return live.cloth_rainbow || tex;
        if (tex === TM.bdcloth_rainbow) return live.bdcloth_rainbow || tex;
        if (tex === TM.carpet_rainbow) return live.carpet_rainbow || tex;
        return tex;
    };
    A.isLive = function (tex) { return !!tex && (tex === live.cloth_rainbow || tex === live.bdcloth_rainbow || tex === live.carpet_rainbow); };
    // Mezcla del color i (puro) con el color i+1 en s/SUB. null si todavía no cargó la imagen de bloques.
    function blend(prefix, i, s) {
        const key = prefix + i + '|' + s;
        const hit = blends[key];
        if (hit) return hit;
        const img = window.images && window.images.blocks;
        const TM = window.texturesMap;
        const a = TM[prefix + ORDER[i]], b = TM[prefix + ORDER[(i + 1) % N]];
        if (!img || !img.complete || !img.naturalWidth || !a || !b) return null;
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(img, a.x, a.y, 16, 16, 0, 0, 16, 16);
        g.globalAlpha = s / SUB;
        g.drawImage(img, b.x, b.y, 16, 16, 0, 0, 16, 16);
        return (blends[key] = { x: 0, y: 0, img: c });
    }
    // En qué punto del círculo de colores está el bloque de (x, y) ahora: color i, mezclado con el siguiente en s/SUB (s = 0 → color puro)
    A.stateAt = function (x, y) {
        const total = N * SUB;
        let q = Math.floor((A.t + x * A.stepX + y * A.stepY) * SUB + 1e-6);
        q = ((q % total) + total) % total;
        return { i: Math.floor(q / SUB), s: q % SUB };
    };
    // Para el bloque de lana arcoíris en (x, y): el dibujo que le toca en este momento (puro o mezclado)
    A.tileAt = function (mark, x, y) {
        const total = N * SUB;
        let q = Math.floor((A.t + x * A.stepX + y * A.stepY) * SUB + 1e-6);
        q = ((q % total) + total) % total;
        const i = Math.floor(q / SUB), s = q % SUB;
        if (s === 0) return window.texturesMap[mark.rb + ORDER[i]] || mark;
        return blend(mark.rb, i, s) || mark;
    };
    // Pone el reloj de la animación en el paso q (cada paso = 1/SUB de un cambio de color); devuelve true si cambió
    A.setClock = function (q) {
        if (q === A.q && A.started) return false;
        A.q = q; A.t = q / SUB; A.started = true;
        A.frame = ((Math.floor(A.t) % N) + N) % N;
        const TM = window.texturesMap;
        Object.keys(KINDS).forEach(function (k) {   // respaldo: lo que se vería si algo dibuja la señal sin pasar por tileAt
            const src = TM[KINDS[k] + ORDER[A.frame]];
            if (src && live[k]) { live[k].x = src.x; live[k].y = src.y; }
        });
        return true;
    };
    // Compatibilidad: poner la animación justo en el color n
    A.setFrame = function (n) { return A.setClock(((n % N) + N) % N * SUB); };
    return A;
})();

// Lista base de bloques con lógica especial
window.blockData = {
    oven: window.renderers.furnace,
    brew: window.renderers.brewingStand,
    wr: window.renderers.liquid,
    la: window.renderers.liquid,
    ad: window.renderers.liquid,
    seed: window.renderers.wheat,
    potato: window.renderers.wheat,
    carrot: window.renderers.wheat,
    nw: window.renderers.wheat,
    bseed: window.renderers.wheat,

// --- SOLUCIÓN: ALIAS PARA BLOQUES CON VARIANTES DE COLOR ---
    cloth: window.renderers.default,
    bdcloth: window.renderers.default,
    carpet: window.renderers.default,
    bed1: window.renderers.default,
    bed2: window.renderers.default,
    cake: window.renderers.default,
    ccake: window.renderers.default
}

// --- AUTO-POBLADO ROBUSTO DEL INVENTARIO ---
// Si texturesMap existe, llenamos la lista de bloques
if (typeof window.texturesMap !== 'undefined') {
    Object.keys(window.texturesMap).forEach(key => {
        // 1. Si ya existe en blockData, saltar
        if (window.blockData[key]) return;

        // 2. Filtros para limpiar el inventario de variantes técnicas
        if (key === 'missing') return;
        if (key.includes('_n') && key.length > 3) return; 
        if (key.endsWith('_true') || key.endsWith('_false')) return;
        if (key.startsWith('bed2')) return; 
        // (solo las puertas: dr1_2, dr3_2... Antes este filtro también escondía el dropper: dropper_1..4 empiezan con "dr")
        if (/^dr[0-9]/.test(key) && key.length > 3 && key.includes('_')) return; 

        // 3. Agregar bloque exacto
        window.blockData[key] = window.renderers.default;

        // ✨ 4. LA SOLUCIÓN: Crear un "alias" automático para la base del bloque
        // Esto separa "stairr_1" y registra "stairr" automáticamente
        let baseName = key.split('_')[0];
        if (!window.blockData[baseName]) {
            window.blockData[baseName] = window.renderers.default;
        }
    });
} else {
    console.error("ERROR: texturesMap no encontrado. Asegúrate de cargar scripts/textures.js antes.");
}



// Pociones: el dibujo depende del tipo (healing, swiftness, ...) y de si es arrojadiza (category: "splash").
// "states" puede traer los datos del objeto en nbt / extras, y el tipo también en states1 (como lo manda el inventario).
window.blockData.potion = function (states) {
    const T = window.texturesMap;
    const data = (states && (states.nbt || states.extras)) || {};
    let type = (states && typeof states.states1 === 'string' && states.states1) ? states.states1 : data.type;
    const splash = data.category === 'splash' || (states && states.category === 'splash');
    const pre = splash ? 'splash_' : 'potion_';
    if (typeof type === 'string' && type) {
        type = type.toLowerCase();
        // "swiftness2", "fireresistance+" ... usan el dibujo del tipo base
        const base = type.replace(/[+0-9]+$/, '');
        if (T[pre + type]) return T[pre + type];
        if (T[pre + base]) return T[pre + base];
    }
    return splash ? (T.splash || T.potion) : T.potion;
};

function drawDurabilityBar(ctx, x, y, slotWidth, slotHeight, damage, maxDurability) {
    // Si no hay daño, no tiene durabilidad o está intacto, no dibujamos nada
    if (!damage || damage <= 0 || !maxDurability) return; 

    // Calculamos la vida restante
    const remaining = maxDurability - damage;
    let percentage = remaining / maxDurability;
    if (percentage < 0) percentage = 0;

    // Colores clásicos de Mine Blocks / Minecraft
    let color = '#00FF00'; // Verde (Sano)
    if (percentage <= 0.5) color = '#FFFF00'; // Amarillo (Mitad)
    if (percentage <= 0.25) color = '#FFAA00'; // Naranja (Grave)
    if (percentage <= 0.1) color = '#FF0000'; // Rojo (Casi roto)

    // Ajustamos la posición al fondo del slot
    const barX = x + 2;
    const barY = y + slotHeight - 2; // A 5 píxeles del fondo
    const barMaxWidth = slotWidth - 4; // Dejamos un margen a los lados

    // 1. Dibujar el fondo negro de la barra
    ctx.fillStyle = '#000000';
    ctx.fillRect(barX, barY, barMaxWidth, 3);

    // 2. Dibujar el relleno de color (la vida real)
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, Math.max(1, barMaxWidth * percentage), 2);
}