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
    // Lámpara de redstone: encendida si le llega señal (hasSignal = [fuerza, ...], fuerza > 0) o si viene marcada como encendida
    lamp: function (states) {
        const h = states.hasSignal, s = states.states1;
        const on = (Array.isArray(h) ? Number(h[0]) > 0 : (typeof h === 'number' ? h > 0 : h === true)) || s === true || s === 'true' || s === 1;
        const TM = window.texturesMap;
        return (on ? TM.light_true : TM.light) || getTexture(states.type, s);
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
// 🎞️ BLOQUES ANIMADOS
// Configuration > Display > "Animations" las apaga (window.mbwAnimationsOn = false): entonces cada bloque se ve con su dibujo fijo de siempre.
// Los cuadros de cada animación se pueden cambiar en el editor secreto de animaciones (scripts/anim-editor.js), que guarda los cambios
// en este navegador (mbw_anim_frames) y también puede descargar scripts/anim-frames.js para dejarlos fijos para todos.
// Cada cuadro es [columna, fila] de blocks.png (en cuadros de 16 px); con 'flip' al final se dibuja volteado de izquierda a derecha.
// ==========================================
window.MBW_ANIM_DEFAULTS = {
    magma: { frames: [[0, 181], [1, 181], [2, 181], [3, 181]], ms: 300 },
    fire: { frames: [[0, 182], [0, 182, 'flip']], ms: 180, alpha: 0.75 },        // (en el mundo el fuego se ve al 75%)
    cloth_rainbow: { frames: null, ms: 1000, blend: true },                         // frames null = las 12 lanas de colores (ver ORDER abajo)
    bdcloth_rainbow: { frames: null, ms: 1000, blend: true },
    carpet_rainbow: { frames: null, ms: 1000, blend: true }
};
(function () {
    let on = true;
    try { on = localStorage.getItem('mbw_animations') !== '0'; } catch (e) { /* sin almacenamiento: encendidas */ }
    window.mbwAnimationsOn = on;
})();
// Los cuadros que valen ahora para cada bloque: los de fábrica, los de scripts/anim-frames.js (si existe) y los guardados en este navegador
window.mbwAnimConfig = function (name) {
    const D = window.MBW_ANIM_DEFAULTS[name];
    if (!D) return null;
    let o = Object.assign({}, D);
    const F = window.MBW_ANIM_FRAMES;                                                // (scripts/anim-frames.js)
    if (F && F[name] && typeof F[name] === 'object') o = Object.assign(o, F[name]);
    try {
        const L = JSON.parse(localStorage.getItem('mbw_anim_frames') || 'null');
        if (L && L[name] && typeof L[name] === 'object') o = Object.assign(o, L[name]);
    } catch (e) { /* datos rotos: se ignoran */ }
    if (!(o.ms >= 30 && o.ms <= 60000)) o.ms = D.ms;
    if (Array.isArray(o.frames)) {
        o.frames = o.frames.filter(f => Array.isArray(f) && f.length >= 2 && f[0] >= 0 && f[1] >= 0 && f[0] < 17 && f[1] < 234);
        if (!o.frames.length) o.frames = D.frames ? D.frames.slice() : null;
    }
    return o;
};

// ==========================================
// 🌈 LANA ARCOÍRIS ANIMADA (con fundido)
// cloth_rainbow / bdcloth_rainbow / carpet_rainbow pasan por los colores de lana (sin blanco, gris claro, gris ni negro, como se pidió),
// y cada color se FUNDE poco a poco con el siguiente (rosa → rojo cierra el círculo). Además cada bloque va un poquito adelantado según su lugar en el mundo, como en el juego:
// de un bloque al de al lado el color cambia solo un poquito (en 6 bloques seguidos se pasa de rosa a rojo); todo el dibujo se desplaza con el tiempo.
//   · cada bloque del mundo guarda el objeto "vivo" (live[...]) como señal; al pintar, main.js le pide a tileAt(señal, x, y) el dibujo que le toca.
//   · los dibujos intermedios (color A mezclado con color B) se arman una sola vez en pequeños lienzos de 16×16 y se guardan.
// Los íconos del inventario (cofres, hotbar...) también se animan: ver window.mbwAnimIcon más abajo.
// ==========================================
window.rainbowAnim = (function () {
    const ORDER = ['red', 'brown', 'orange', 'yellow', 'lightgreen', 'green', 'cyan', 'lightblue', 'blue', 'purple', 'magenta', 'pink'];
    const N = ORDER.length, SUB = 30;                  // SUB = pasos de mezcla entre un color y el siguiente (muchos = cambio suave)
    const KINDS = { cloth_rainbow: 'cloth_', bdcloth_rainbow: 'bdcloth_', carpet_rainbow: 'carpet_' };
    const NAME_OF = { cloth_: 'cloth_rainbow', bdcloth_: 'bdcloth_rainbow', carpet_: 'carpet_rainbow' };
    const live = {};                                   // objetos { x, y, rb } que comparte todo el mundo (señal de "lana arcoíris")
    const T = window.texturesMap || {};
    Object.keys(KINDS).forEach(function (k) { if (T[k]) live[k] = { x: T[k].x, y: T[k].y, rb: KINDS[k] }; });
    // period: milisegundos que tarda en pasar de un color al siguiente · stepX / stepY: cuánto "adelanta" cada bloque hacia la derecha / hacia arriba (en pasos de color)
    const A = { frame: 0, q: 0, t: 0, period: 1000, sub: SUB, stepX: 1 / 5, stepY: 1 / 6, live: live, order: ORDER };
    let blends = {};                                   // "cloth_|3|5" -> { x: 0, y: 0, img: lienzo 16×16 }
    let frameCache = {};                               // "cloth_" -> [dibujo de cada color]
    // Los colores (dibujos) del círculo de cada tipo: las 12 lanas, o los cuadros elegidos en el editor de animaciones
    function framesOf(prefix) {
        if (frameCache[prefix]) return frameCache[prefix];
        const TM = window.texturesMap;
        const cfg = window.mbwAnimConfig ? window.mbwAnimConfig(NAME_OF[prefix]) : null;
        let out;
        if (cfg && Array.isArray(cfg.frames) && cfg.frames.length) out = cfg.frames.map(f => ({ x: f[0] * 16, y: f[1] * 16 }));
        else out = ORDER.map(c => TM[prefix + c]).filter(Boolean);
        return (frameCache[prefix] = out);
    }
    A.framesOf = framesOf;
    A.reset = function () { blends = {}; frameCache = {}; };
    // Si el dibujo es el fijo del arcoíris, devuelve el objeto vivo; si no, el mismo de siempre
    // (los otros bloques animados, magma y fuego, también se cambian aquí por su objeto vivo: ver window.blockAnim)
    A.map = function (tex) {
        if (!tex) return tex;
        const TM = window.texturesMap;
        if (tex === TM.cloth_rainbow) return live.cloth_rainbow || tex;
        if (tex === TM.bdcloth_rainbow) return live.bdcloth_rainbow || tex;
        if (tex === TM.carpet_rainbow) return live.carpet_rainbow || tex;
        if (window.blockAnim) return window.blockAnim.map(tex);
        return tex;
    };
    A.isLive = function (tex) { return !!tex && (tex === live.cloth_rainbow || tex === live.bdcloth_rainbow || tex === live.carpet_rainbow || !!tex.an); };
    // Mezcla del color i (puro) con el color i+1 en s/SUB. null si todavía no cargó la imagen de bloques.
    function blend(prefix, i, s) {
        const key = prefix + i + '|' + s;
        const hit = blends[key];
        if (hit) return hit;
        const img = window.images && window.images.blocks;
        const F = framesOf(prefix), n = F.length;
        const a = F[i], b = F[(i + 1) % n];
        if (!img || !img.complete || !img.naturalWidth || !a || !b) return null;
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(img, a.x, a.y, 16, 16, 0, 0, 16, 16);
        g.globalAlpha = s / SUB;
        g.drawImage(img, b.x, b.y, 16, 16, 0, 0, 16, 16);
        return (blends[key] = { x: 0, y: 0, img: c });
    }
    function qAt(n, x, y) {
        const total = n * SUB;
        let q = Math.floor((A.t + x * A.stepX + y * A.stepY) * SUB + 1e-6);
        return ((q % total) + total) % total;
    }
    // En qué punto del círculo de colores está el bloque de (x, y) ahora: color i, mezclado con el siguiente en s/SUB (s = 0 → color puro)
    A.stateAt = function (x, y) {
        const q = qAt(N, x, y);
        return { i: Math.floor(q / SUB), s: q % SUB };
    };
    // Para el bloque de lana arcoíris en (x, y): el dibujo que le toca en este momento (puro o mezclado)
    A.tileAt = function (mark, x, y) {
        const F = framesOf(mark.rb), n = F.length;
        if (!n) return mark;
        const q = qAt(n, x, y);
        const i = Math.floor(q / SUB), s = q % SUB;
        if (s === 0) return F[i] || mark;
        return blend(mark.rb, i, s) || mark;
    };
    // Pone el reloj de la animación en el paso q (cada paso = 1/SUB de un cambio de color); devuelve true si cambió
    A.setClock = function (q) {
        if (q === A.q && A.started) return false;
        A.q = q; A.t = q / SUB; A.started = true;
        A.frame = ((Math.floor(A.t) % N) + N) % N;
        Object.keys(KINDS).forEach(function (k) {   // respaldo: lo que se vería si algo dibuja la señal sin pasar por tileAt
            const F = framesOf(KINDS[k]);
            if (!F.length) return;
            const src = F[((Math.floor(A.t) % F.length) + F.length) % F.length];
            if (src && live[k]) { live[k].x = src.x; live[k].y = src.y; }
        });
        return true;
    };
    // Compatibilidad: poner la animación justo en el color n
    A.setFrame = function (n) { return A.setClock(((n % N) + N) % N * SUB); };
    return A;
})();
// Los dibujos de la lana arcoíris del mundo (objeto vivo) y el fijo del inventario, por tipo
window.rainbowAnim.KIND_OF_LIVE = function (mark) { return mark && mark.rb ? ({ cloth_: 'cloth_rainbow', bdcloth_: 'bdcloth_rainbow', carpet_: 'carpet_rainbow' })[mark.rb] : null; };

// ==========================================
// 🔥 MAGMA Y FUEGO (cuadros que se van turnando, todos los bloques iguales a la vez)
// En el mundo cada bloque guarda el objeto vivo { x, y, an: 'magma' } como señal (como la lana arcoíris) y al pintar se pide el cuadro de este momento.
// ==========================================
window.blockAnim = (function () {
    const NAMES = ['magma', 'fire'];
    const live = {};
    const T = window.texturesMap || {};
    NAMES.forEach(function (k) { if (T[k]) live[k] = { x: T[k].x, y: T[k].y, an: k }; });
    let cache = {};            // "fire|w" (mundo, con su transparencia) / "fire|i" (ícono) -> [cuadros]
    const B = { live: live, names: NAMES };
    B.reset = function () { cache = {}; };
    // Los cuadros ya listos para dibujar: { x, y } de blocks.png o { x: 0, y: 0, img: lienzo } (volteado o con transparencia)
    B.frames = function (name, forWorld) {
        const key = name + (forWorld ? '|w' : '|i');
        if (cache[key]) return cache[key];
        const cfg = window.mbwAnimConfig(name);
        if (!cfg || !Array.isArray(cfg.frames)) return [];
        const img = window.images && window.images.blocks;
        const ready = img && img.complete && img.naturalWidth > 0;
        const alpha = forWorld && cfg.alpha !== undefined ? cfg.alpha : 1;
        let pending = false;
        const out = cfg.frames.map(function (f) {
            const x = f[0] * 16, y = f[1] * 16, flip = f[2] === 'flip';
            if (!flip && alpha === 1) return { x: x, y: y };
            if (!ready) { pending = true; return { x: x, y: y }; }
            const c = document.createElement('canvas'); c.width = 16; c.height = 16;
            const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
            g.globalAlpha = alpha;
            if (flip) { g.translate(16, 0); g.scale(-1, 1); }
            g.drawImage(img, x, y, 16, 16, 0, 0, 16, 16);
            return { x: 0, y: 0, img: c };
        });
        if (!pending) cache[key] = out;
        return out;
    };
    B.ms = function (name) { const c = window.mbwAnimConfig(name); return c ? c.ms : 1000; };
    // Qué cuadro toca ahora (con las animaciones apagadas, siempre el primero)
    B.index = function (name, n) {
        if (!window.mbwAnimationsOn || n < 2) return 0;
        return Math.floor(performance.now() / B.ms(name)) % n;
    };
    B.tileAt = function (mark, forWorld) {
        const F = B.frames(mark.an, forWorld !== false);
        if (!F.length) return mark;
        return F[B.index(mark.an, F.length)] || mark;
    };
    // Un número que cambia cada vez que algún bloque animado cambia de cuadro (para saber cuándo repintar)
    B.clock = function () {
        if (!window.mbwAnimationsOn) return 0;
        let k = 0;
        NAMES.forEach(function (n, i) { k += Math.floor(performance.now() / B.ms(n)) * (i + 1) * 7919; });
        return k;
    };
    B.map = function (tex) {
        if (!tex) return tex;
        const TM = window.texturesMap;
        for (let i = 0; i < NAMES.length; i++) if (tex === TM[NAMES[i]]) return live[NAMES[i]] || tex;
        return tex;
    };
    return B;
})();

// El dibujo que toca AHORA para un bloque del mundo en (x, y). Lo usan el mundo, la foto (Screenshot) y la mini vista.
// Con las animaciones apagadas: la lana arcoíris se ve con su dibujo fijo y el magma / fuego con su primer cuadro.
window.mbwAnimatedTile = function (o, x, y) {
    if (!o) return o;
    if (!o.rb && !o.an) o = window.rainbowAnim.map(o);     // (el dibujo fijo de un bloque animado → su objeto vivo; la foto del mundo pasa por aquí)
    if (o.rb) {
        if (!window.mbwAnimationsOn) { const k = window.rainbowAnim.KIND_OF_LIVE(o); return (k && window.texturesMap[k]) || o; }
        return window.rainbowAnim.tileAt(o, x, y);
    }
    if (o.an) return window.blockAnim.tileAt(o, true);
    return o;
};

// ==========================================
// 🖼️ ÍCONOS ANIMADOS (inventario, cofres, hotbar...): lana / alfombra arcoíris, magma y fuego
// drawItemIcon (main.js) llama a mbwAnimIcon después de dibujar; si el objeto es animado, ese lienzo se vuelve a pintar solo cada poco.
// ==========================================
(function () {
    let list = [];
    let timer = null;
    function kindOf(ro) {
        const TM = window.texturesMap || {};
        if (!ro) return null;
        if (ro === TM.cloth_rainbow) return 'cloth_rainbow';
        if (ro === TM.carpet_rainbow) return 'carpet_rainbow';
        if (ro === TM.bdcloth_rainbow) return 'bdcloth_rainbow';
        if (ro === TM.magma) return 'magma';
        if (ro === TM.fire) return 'fire';
        return null;
    }
    function frameFor(kind) {
        if (kind === 'magma' || kind === 'fire') return window.blockAnim.tileAt({ an: kind }, false);
        const pre = { cloth_rainbow: 'cloth_', carpet_rainbow: 'carpet_', bdcloth_rainbow: 'bdcloth_' }[kind];
        if (!window.mbwAnimationsOn) return window.texturesMap[kind];
        return window.rainbowAnim.tileAt({ rb: pre }, 0, 0);
    }
    function paint(e) {
        const img = window.images && window.images.blocks;
        if (!img || !img.complete || !img.naturalWidth) return;
        const f = frameFor(e.kind);
        if (!f) return;
        const key = f.img ? f.img : (f.x + ',' + f.y);
        if (e.last === key) return;
        e.last = key;
        const c = e.ctx;
        c.save();
        c.imageSmoothingEnabled = false;
        c.clearRect(e.dx, e.dy, e.dw, e.dh);
        if (f.img) c.drawImage(f.img, 0, 0, 16, 16, e.dx, e.dy, e.dw, e.dh);
        else c.drawImage(img, f.x, f.y, 16, 16, e.dx, e.dy, e.dw, e.dh);
        c.restore();
    }
    function tick() {
        const keep = [];
        for (let i = 0; i < list.length; i++) {
            const e = list[i], cv = e.ctx.canvas;
            if (!cv || !cv.isConnected || cv.__itemTok !== e.tok) continue;     // ya no está en la página o ya muestra otra cosa
            keep.push(e);
            if (cv.offsetParent === null && getComputedStyle(cv).position !== 'fixed') continue;   // escondido: no se pinta
            paint(e);
        }
        list = keep;
        if (!list.length) { clearInterval(timer); timer = null; }
    }
    window.mbwAnimIcon = function (ctx, ro, dx, dy, dw, dh) {
        const kind = kindOf(ro);
        if (!kind || !ctx || !ctx.canvas) return false;
        const cv = ctx.canvas;
        if (cv.__itemTok === undefined) cv.__itemTok = 'anim' + Math.random();
        const e = { ctx: ctx, kind: kind, dx: dx, dy: dy, dw: dw, dh: dh, tok: cv.__itemTok, last: null };
        list = list.filter(o => !(o.ctx === ctx && o.dx === dx && o.dy === dy));
        list.push(e);
        paint(e);
        if (!timer) timer = setInterval(tick, 66);
        return true;
    };
    window.mbwAnimIconCount = function () { return list.length; };
    window.mbwAnimIconRefresh = function () { list.forEach(e => { e.last = null; paint(e); }); };
})();

// Prender / apagar las animaciones (Configuration > Display)
window.setAnimationsEnabled = function (on) {
    window.mbwAnimationsOn = !!on;
    try { localStorage.setItem('mbw_animations', on ? '1' : '0'); } catch (e) { /* no se recuerda */ }
    const cb = document.getElementById('animations-toggle');
    if (cb) cb.checked = !!on;
    if (window.mbwAnimIconRefresh) window.mbwAnimIconRefresh();
    if (typeof worldDirty !== 'undefined') worldDirty = true;
};
// Después de cambiar los cuadros en el editor de animaciones: se rehacen los dibujos guardados y se repinta todo
window.mbwAnimReload = function () {
    window.rainbowAnim.reset();
    window.blockAnim.reset();
    window.rainbowAnim.started = false;
    if (window.mbwAnimIconRefresh) window.mbwAnimIconRefresh();
    if (typeof worldDirty !== 'undefined') worldDirty = true;
};

// Lista base de bloques con lógica especial
window.blockData = {
    oven: window.renderers.furnace,
    brew: window.renderers.brewingStand,
    wr: window.renderers.liquid,
    la: window.renderers.liquid,
    ad: window.renderers.liquid,
    light: window.renderers.lamp,
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