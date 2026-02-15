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
        if (key.startsWith('dr') && key.length > 3 && key.includes('_')) return; 

        // 3. Agregar bloque válido
        window.blockData[key] = window.renderers.default;
    });
} else {
    console.error("ERROR: texturesMap no encontrado. Asegúrate de cargar scripts/textures.js antes.");
}