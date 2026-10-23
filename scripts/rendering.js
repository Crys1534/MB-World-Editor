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
// 🌈 LANA ARCOÍRIS ANIMADA
// El dibujo de cloth_rainbow / bdcloth_rainbow / carpet_rainbow cambia pasando por TODOS los colores de lana.
// Solo cambia en el mundo (la foto del mundo usa estos objetos "vivos"); los íconos del inventario siguen con el dibujo fijo.
// ==========================================
window.rainbowAnim = (function () {
    const ORDER = ['red', 'orange', 'yellow', 'lightgreen', 'green', 'cyan', 'lightblue', 'blue', 'purple', 'magenta', 'pink', 'brown', 'black', 'gray', 'lightgray', 'white'];
    const KINDS = { cloth_rainbow: 'cloth_', bdcloth_rainbow: 'bdcloth_', carpet_rainbow: 'carpet_' };
    const live = {};                                   // objetos { x, y } que comparte todo el mundo
    const T = window.texturesMap || {};
    Object.keys(KINDS).forEach(function (k) { if (T[k]) live[k] = { x: T[k].x, y: T[k].y }; });
    const A = { frame: 0, period: 450, live: live, order: ORDER };
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
    // Pone el cuadro n de la animación; devuelve true si cambió
    A.setFrame = function (n) {
        n = ((n % ORDER.length) + ORDER.length) % ORDER.length;
        if (n === A.frame && A.started) return false;
        A.frame = n; A.started = true;
        const TM = window.texturesMap;
        Object.keys(KINDS).forEach(function (k) {
            const src = TM[KINDS[k] + ORDER[n]];
            if (src && live[k]) { live[k].x = src.x; live[k].y = src.y; }
        });
        return true;
    };
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