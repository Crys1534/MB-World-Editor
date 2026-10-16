/* SISTEMA DE ESTRUCTURAS - DATABASE Y LÓGICA (VERSIÓN SIN LÍMITES) */

// --- SISTEMA DE FAVORITOS ---
const favManager = {
    getFavs: function() {
        try { return JSON.parse(localStorage.getItem('mbw_fav_structs')) || []; } 
        catch(e) { return []; }
    },
    isFav: function(struct) {
        // Usamos timestamp o el título+autor para identificar la estructura de forma única
        const id = struct.timestamp ? struct.timestamp.toString() : (struct.title + "_" + struct.author);
        return this.getFavs().includes(id);
    },
    toggleFav: function(struct) {
        let favs = this.getFavs();
        const id = struct.timestamp ? struct.timestamp.toString() : (struct.title + "_" + struct.author);
        if (favs.includes(id)) {
            favs = favs.filter(f => f !== id); // Si ya es fav, lo quita
        } else {
            favs.push(id); // Si no es fav, lo añade
        }
        localStorage.setItem('mbw_fav_structs', JSON.stringify(favs));
    }
};


// ==========================================
// 1. GESTOR DE BASE DE DATOS (INDEXEDDB)
// ==========================================
const DB_NAME = 'MBWEdit_DB';
const STORE_NAME = 'structures';
const DB_VERSION = 1;

const dbManager = {
    open: () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => reject(e.target.error);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Usamos 'timestamp' como ID único porque ya lo usabas en tu código original
                    db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
        });
    },

    save: async (structure) => {
        const db = await dbManager.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            // Asegurar que tenga timestamp (ID)
            if (!structure.timestamp) structure.timestamp = Date.now();
            
            const req = store.put(structure); // .put inserta o actualiza
            req.onsuccess = () => resolve(structure);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    delete: async (timestamp) => {
        const db = await dbManager.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(timestamp);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    },

    getAll: async () => {
        const db = await dbManager.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result.reverse());
            req.onerror = (e) => reject(e.target.error);
        });
    },

    clear: async () => {
        const db = await dbManager.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }
};

// ==========================================
// 2. VANILLA Y COMMUNITY (carga perezosa)
// ==========================================
// Antes, aqui vivia un array de ~8 MB con todas las estructuras de fabrica
// (Vanilla + Community), pegado directo al codigo. Eso significaba que el
// navegador tenia que descargar y leer esos 8 MB SIEMPRE al abrir el editor,
// aunque la persona nunca abriera el catalogo de estructuras.
//
// Ahora esos datos viven aparte, en scripts/structures-data/vanilla.js y
// scripts/structures-data/community.js (mas livianos: juntos pesan como
// una cuarta parte de lo que pesaba el archivo original), y solo se
// descargan la PRIMERA VEZ que la persona abre esa pestaña del catalogo.
// Si nunca la abre, nunca se descargan.
//
// Son archivos .js (que se agregan a la pagina con una etiqueta <script> en el
// momento de abrir la pestaña) y NO .json leidos con fetch(): asi tambien
// funciona si abres index.html con doble clic (file://), donde el navegador
// bloquea fetch() de archivos locales y las pestañas salian vacias.
//
// Dentro de esos archivos, cada estructura ya no repite "dx","dy","state" y
// "type" por cada bloque (eso era la mayor parte del peso): los bloques
// simples se agrupan por tipo como pares [dx,dy], y _expandCompactStruct
// los vuelve a armar en el formato de siempre ({dx,dy,state:{type}}) antes
// de que el resto del codigo los toque. Para el resto del programa, nada
// cambia: structureDB sigue teniendo exactamente la misma forma que antes.

const _defaultStructCategoriesLoaded = {};
const _defaultStructCategoryPromises = {};

function _expandCompactStruct(c) {
    const data = [];
    if (c.blocks) {
        for (const type in c.blocks) {
            for (const pair of c.blocks[type]) {
                data.push({ dx: pair[0], dy: pair[1], state: { type: type } });
            }
        }
    }
    if (c.extra) {
        for (const tup of c.extra) {
            data.push({ dx: tup[0], dy: tup[1], state: tup[2] });
        }
    }
    return { title: c.title, author: c.author, category: c.category, subcategory: c.subcategory, timestamp: c.timestamp, data: data };
}

// Devuelve una promesa que SIEMPRE se resuelve: true si las estructuras quedaron
// cargadas, false si hubo un error (en ese caso se puede volver a intentar).
function loadDefaultStructCategory(category) {
    if (_defaultStructCategoriesLoaded[category]) return Promise.resolve(true);
    if (_defaultStructCategoryPromises[category]) return _defaultStructCategoryPromises[category];

    _defaultStructCategoryPromises[category] = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `scripts/structures-data/${category}.js`;
        script.onload = () => {
            const compactList = window.MBW_STRUCT_DATA && window.MBW_STRUCT_DATA[category];
            if (!Array.isArray(compactList)) { reject(new Error('El archivo cargó pero no trae datos')); return; }
            resolve(compactList);
        };
        script.onerror = () => reject(new Error(`No se pudo cargar ${script.src}`));
        document.head.appendChild(script);
    })
        .then(compactList => {
            // .reverse(): se conserva el orden original (el más nuevo primero
            // en la grilla), que antes salía de un defaultStructures.reverse()
            // suelto al final del archivo.
            const expanded = compactList.map(_expandCompactStruct).reverse();
            structureDB.push(...expanded);
            _defaultStructCategoriesLoaded[category] = true;
            delete window.MBW_STRUCT_DATA[category]; // ya está expandido en structureDB: liberamos la copia compacta
            return true;
        })
        .catch(e => {
            console.error(`Error loading ${category} structures:`, e);
            _defaultStructCategoryPromises[category] = null; // permite reintentar al volver a abrir la pestaña
            return false;
        });

    return _defaultStructCategoryPromises[category];
}

// 'favs' puede tener favoritos de vanilla Y de community, asi que para esa
// pestaña asegura ambas categorias antes de filtrar.
function ensureDefaultStructuresFor(category) {
    if (category === 'vanilla') return loadDefaultStructCategory('vanilla');
    if (category === 'community') return loadDefaultStructCategory('community');
    if (category === 'favs') return Promise.all([loadDefaultStructCategory('vanilla'), loadDefaultStructCategory('community')]).then(r => r.every(Boolean));
    return Promise.resolve(true); // 'saved' no necesita nada: ya esta en IndexedDB
}


// Mantenemos una copia en memoria para la UI. Las estructuras de fábrica
// (vanilla/community) se agregan después, de forma perezosa (ver arriba).
let structureDB = [];

let currentStructCategory = 'saved'; 
let currentStructSubCategory = 'all'; 
let selectedStructure = null;
let tempSaveData = null; 
let isInputBlocked = false; 
let confirmCallback = null; 

// ==========================================
// 3. CARGA E INICIALIZACIÓN
// ==========================================
async function loadSavedStructures() {
    try {
        // 1. Intentar migrar desde localStorage (Antiguo) a IndexedDB (Nuevo)
        const legacyData = localStorage.getItem('mbw_saved_structures');
        if (legacyData) {
            console.log("Migrating legacy structures to IndexedDB...");
            const parsed = JSON.parse(legacyData);
            for (const item of parsed) {
                // Asegurar que tengan timestamp para usarse como ID
                if (!item.timestamp) item.timestamp = Date.now() + Math.random(); 
                await dbManager.save(item);
            }
            // Borrar el localStorage antiguo para no duplicar en el futuro
            localStorage.removeItem('mbw_saved_structures');
        }

        // 2. Cargar todo desde la Base de Datos
        const dbItems = await dbManager.getAll();
        
        // 3. Agregar lo guardado en IndexedDB (con push, no reemplazando structureDB,
        // para no borrar ninguna estructura de fábrica que ya se haya cargado mientras tanto)
        structureDB.push(...dbItems);
        console.log(`Loaded ${dbItems.length} custom structures from DB.`);

    } catch (e) { 
        console.error("Error loading structures:", e); 
    }
    
    // Actualizar la interfaz
    if (document.getElementById('structures-modal').style.display === 'flex') {
        filterStructures(currentStructCategory, currentStructSubCategory);
    }
    updateRibbonQuickAccess();
}

// Iniciar carga
loadSavedStructures();

// --- KEYBOARD TRAP ---
window.addEventListener('keydown', function(e) {
    if (isInputBlocked) {
        if (e.key === 'F12') return;

        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
            if (e.key === 'Escape') {
                closeModal('save-structure-modal');
                closeModal('structures-modal');
                closeModal('edit-info-modal');
                closeModal('custom-confirm-modal');
            }
            return; 
        }

        if (e.key === 'Escape') {
            closeModal('save-structure-modal');
            closeModal('structures-modal');
            closeModal('edit-info-modal');
            closeModal('custom-confirm-modal');
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
}, true); 

// --- IMPORT/EXPORT ---
function exportSavedStructures() {
    const savedStructs = structureDB.filter(s => s.category === 'saved');
    if (savedStructs.length === 0) { alert("No saved structures."); return; }
    
    // Preparar JSON bonito
    const formattedJson = "[\n" + savedStructs.map(struct => {
        const { data, ...meta } = struct;
        let metaString = JSON.stringify(meta, null, 2);
        const dataString = JSON.stringify(data);
        const content = metaString.substring(0, metaString.lastIndexOf('}')).trimEnd();
        return content + ',\n  "data": ' + dataString + '\n}';
    }).join(",\n") + "\n]";
    
    const blob = new Blob([formattedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mbw_structures_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importStructures() { document.getElementById('import-struct-input').click(); }

function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error("Not an array");
            let count = 0;
            
            for (const s of imported) {
                if (s.title && s.data) {
                    s.category = 'saved';
                    // Generar nuevo ID si hace falta para evitar colisiones
                    s.timestamp = Date.now() + Math.random(); 
                    await dbManager.save(s);
                    structureDB.push(s); // Actualizar cache local
                    count++;
                }
            }
            
            filterStructures('saved', 'all');
            alert(`Imported ${count} structures.`);
            updateRibbonQuickAccess();
        } catch (err) { 
            console.error(err);
            alert("Error importing file."); 
        }
    };
    reader.readAsText(file);
    input.value = '';
}

function resetSavedStructures() {
    showCustomConfirm("Delete ALL saved structures? This cannot be undone.", async function() {
        await dbManager.clear(); // Borrar DB real
        structureDB = structureDB.filter(s => s.category !== 'saved'); // Limpiar cache local
        filterStructures('saved', 'all');
        updateRibbonQuickAccess();
    });
}

// --- GESTIÓN DE MODALES ---
function openStructuresModal() {
    document.getElementById('structures-modal').style.display = 'flex';
    isInputBlocked = true; 
    filterStructures('saved', 'all');
}

const originalCloseModal = window.closeModal;
window.closeModal = function(modalId) {
    if (modalId === 'structures-modal' || modalId === 'save-structure-modal' || modalId === 'edit-info-modal' || modalId === 'custom-confirm-modal') {
        if ((modalId === 'edit-info-modal' || modalId === 'custom-confirm-modal') && 
            document.getElementById('structures-modal').style.display === 'flex') {
            isInputBlocked = true;
        } else {
            isInputBlocked = false; 
        }
    }
    
    if (typeof originalCloseModal === 'function') {
        originalCloseModal(modalId);
    } else {
        const m = document.getElementById(modalId);
        if(m) m.style.display = 'none';
    }
}

window.addEventListener('click', function(e) {
    if (e.target.id === 'structures-modal') closeModal('structures-modal');
    if (e.target.id === 'save-structure-modal') closeModal('save-structure-modal');
});

function showCustomConfirm(message, callback) {
    document.getElementById('confirm-msg').innerText = message;
    confirmCallback = callback;
    document.getElementById('custom-confirm-modal').style.display = 'flex';
    isInputBlocked = true;
}

document.getElementById('btn-confirm-yes').onclick = function() {
    if (confirmCallback) confirmCallback();
    closeModal('custom-confirm-modal');
};

// --- LOGICA PRINCIPAL DE ESTRUCTURAS ---
function filterStructures(category, subcategory = null) {
    currentStructCategory = category;
    if (subcategory) currentStructSubCategory = subcategory;

    // Actualizar pestañas principales
    document.querySelectorAll('.struct-tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(`tab-struct-${category}`);
    if(tab) tab.classList.add('active');

    // Mostrar/Ocultar el contenedor del selector y botón (Agregamos 'favs' aquí)
    const subtabs = document.getElementById('struct-subtabs');
    if (subtabs) {
        if (category === 'community' || category === 'saved' || category === 'favs') { 
            subtabs.style.display = 'flex'; 
        } else { 
            subtabs.style.display = 'none'; 
            currentStructSubCategory = 'all'; // Resetear a 'all' si se oculta
        }
    }

    // Actualizar el valor de la caja desplegable para que coincida visualmente
    const selectBox = document.getElementById('struct-subcategory-select');
    if (selectBox && currentStructSubCategory) {
        selectBox.value = currentStructSubCategory;
    }

    const actionsDiv = document.getElementById('struct-saved-actions');
    if (actionsDiv) actionsDiv.style.display = (category === 'saved') ? 'flex' : 'none';

    selectedStructure = null;
    const titleInfo = document.getElementById('struct-info-title');
    if(titleInfo) {
        titleInfo.innerText = "Select an item";
        document.getElementById('struct-info-author').innerText = "-";
        document.getElementById('struct-info-sub').innerText = "-";
    }
    
    const editCol = document.getElementById('struct-edit-actions');
    if(editCol) editCol.style.display = 'none';
    
    const canvas = document.getElementById('struct-preview-canvas');
    if(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Si esta pestaña necesita estructuras de fábrica (vanilla/community/favs)
    // y todavía no se descargaron, mostramos un aviso de carga y las pedimos.
    const needsDefaults = (category === 'vanilla' || category === 'community' || category === 'favs');
    const alreadyLoaded = category === 'vanilla' ? _defaultStructCategoriesLoaded['vanilla']
        : category === 'community' ? _defaultStructCategoriesLoaded['community']
        : category === 'favs' ? (_defaultStructCategoriesLoaded['vanilla'] && _defaultStructCategoriesLoaded['community'])
        : true;

    const grid = document.getElementById('structures-grid');
    if (needsDefaults && !alreadyLoaded) {
        if (grid) grid.innerHTML = '<div style="color:#FFF; grid-column: 1/-1; text-align:center; padding-top:20px;">Loading...</div>';
        ensureDefaultStructuresFor(category).then(ok => {
            // Si la persona ya se cambió a otra pestaña mientras cargaba, no pisamos su vista
            if (currentStructCategory !== category) return;
            if (ok === false) {
                // No dejamos la grilla vacía sin explicación: avisamos qué pasó
                const g = document.getElementById('structures-grid');
                if (g) g.innerHTML = '<div style="color:#FFF; grid-column: 1/-1; text-align:center; padding-top:20px;">Could not load the structures. Check that the folder <b>scripts/structures-data</b> is next to index.html, then reopen this tab.</div>';
                return;
            }
            renderStructureGrid();
        });
        return;
    }

    renderStructureGrid();
}

function filterSubCategory(sub) {
    currentStructSubCategory = sub;
    renderStructureGrid();
}

function renderStructureGrid() {
    const grid = document.getElementById('structures-grid');
    if(!grid) return;
    grid.innerHTML = ''; 
    
    const filtered = structureDB.filter(item => {
        // Si estamos en la pestaña Favs, solo mostrar los favoritos
        if (currentStructCategory === 'favs') {
            if (!favManager.isFav(item)) return false;
        } else {
            // Filtrado normal por pestaña
            if (item.category !== currentStructCategory) return false;
        }
        
        // Filtro de subcategoría (Chests, Houses, etc.)
        if (currentStructSubCategory && currentStructSubCategory !== 'all') {
            return item.subcategory && item.subcategory.toLowerCase() === currentStructSubCategory.toLowerCase();
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="color:#FFF; grid-column: 1/-1; text-align:center; padding-top:20px;">No structures found.</div>';
        return;
    }

    filtered.forEach(struct => {
        const item = document.createElement('div');
        item.className = 'struct-item';
        item.style.position = 'relative'; // Para que la estrella flote encima
        
// --- CREACIÓN DE LA ESTRELLA FAVORITA ---
        const star = document.createElement('img');
        star.style.position = 'absolute';
        star.style.top = '4px'; // Bajado un poquito para que encaje mejor la imagen
        star.style.right = '4px';
        star.style.width = '34px';
        star.style.height = '34px';
        star.style.cursor = 'pointer';
        star.style.zIndex = '10'; // Por encima del bloque general
        star.style.imageRendering = 'pixelated'; // Evita que se vea borroso
        star.title = "Favorite";

        // Estado inicial de la imagen
        star.src = favManager.isFav(struct) ? 'assets/UI/fav.png' : 'assets/UI/fav_2.png';

        // Efectos Hover (Mouse encima)
        star.onmouseenter = () => {
            // Ahora SIEMPRE cambia a fav_1.png al poner el ratón encima
            star.src = 'assets/UI/fav_1.png';
        };
        
        star.onmouseleave = () => {
            star.src = favManager.isFav(struct) ? 'assets/UI/fav.png' : 'assets/UI/fav_2.png';
        };

        // ¿Qué pasa al dar clic a la estrella?
        star.onclick = function(e) {
            e.stopPropagation(); // Evita que se seleccione toda la estructura
            favManager.toggleFav(struct);
            
            if (currentStructCategory === 'favs') {
                // Si estamos en Favs y desmarcamos, la estructura debe desaparecer de la vista
                renderStructureGrid(); 
            } else {
                // Cambiamos la imagen temporalmente para dar "feedback" visual de que el clic funcionó
                // (Volverá a la normalidad cuando el usuario quite el ratón gracias al onmouseleave)
                star.src = favManager.isFav(struct) ? 'assets/UI/fav.png' : 'assets/UI/fav_2.png';
            }
        };
        // ----------------------------------------
        
        if (selectedStructure && selectedStructure.title === struct.title && selectedStructure.timestamp === struct.timestamp) {
            item.classList.add('selected');
        }
        
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 144; previewCanvas.height = 144;
        previewCanvas.style.marginBottom = '2px';
        previewCanvas.style.imageRendering = 'pixelated'; 
        
        renderPreviewOnCanvas(previewCanvas, struct.data, true);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'struct-name';
        nameDiv.innerText = struct.title;

        // Añadimos los elementos (La estrella primero)
        item.appendChild(star);
        item.appendChild(previewCanvas);
        item.appendChild(nameDiv);

        item.onclick = function() {
            document.querySelectorAll('.struct-item').forEach(el => el.classList.remove('selected'));
            this.classList.add('selected');
            selectStructure(struct);
        };
        grid.appendChild(item);
    });
}

// --- NUEVA FUNCIÓN: MOSTRAR CONTENIDO DE COFRES ---
function selectStructure(struct) {
    selectedStructure = struct;
    document.getElementById('struct-info-title').innerText = struct.title;
// --- MOSTRAR INVENTARIO EN EL STRUCTURES BROWSER (MÁXIMA PRIORIDAD) ---
    const chestPreviewContainer = document.getElementById('struct-chest-preview');

    if (chestPreviewContainer) {
        chestPreviewContainer.innerHTML = ''; 
        
        let blocksData = struct.data || struct.blocks; 
        if (!Array.isArray(blocksData)) blocksData = [];

        let blockState = null;
        for (let b of blocksData) {
            let s = b.state || b;
            if (s && (s.type === 'chest' || s.type === 'echest' || s.toSmelt)) {
                blockState = s;
                break;
            }
        }

        if (blockState) {
            const maxDurabilityMap = {
                "WoodenPickaxe": 60, "StonePickaxe": 132, "IronPickaxe": 251, "GoldPickaxe": 33, "DiamondPickaxe": 1562, "ObsidianPickaxe": 2500,
                "WoodenSword": 60, "StoneSword": 132, "IronSword": 251, "GoldSword": 33, "DiamondSword": 1562,
                "WoodenAxe": 60, "StoneAxe": 132, "IronAxe": 251, "GoldAxe": 33, "DiamondAxe": 1562,
                "WoodenShovel": 60, "StoneShovel": 132, "IronShovel": 251, "GoldShovel": 33, "DiamondShovel": 1562,
                "WoodenHoe": 60, "StoneHoe": 132, "IronHoe": 251, "GoldHoe": 33, "DiamondHoe": 1562
            };

            // ESCÁNER RECURSIVO: Buscará la magia sin importar qué tan escondida esté en el JSON
            function extractEnchants(itemData) {
                let parsedEnchants = [];
                function deepScan(obj) {
                    if (!obj || typeof obj !== 'object') return;
                    for (let key in obj) {
                        if (obj[key] === "enchant" || obj[key] === "enchantment") {
                            parsedEnchants.push(key);
                        } else if (typeof obj[key] === 'object') {
                            deepScan(obj[key]); // Entra a buscar más profundo
                        }
                    }
                }
                deepScan(itemData);
                return parsedEnchants;
            }

            function formatEnchantText(rawEnchants) {
                return rawEnchants.map(raw => {
                    let name = raw.replace(/[0-9]/g, '');
                    let level = raw.replace(/[^0-9]/g, '');
                    name = name.charAt(0).toUpperCase() + name.slice(1);
                    return name + (level ? " " + level : "");
                }).join('<br>');
            }

            let inventory = blockState.chests || [];
            if (blockState.toSmelt) {
                inventory = [blockState.toSmelt.input, blockState.toSmelt.fuel, blockState.toSmelt.output];
            }

            if (inventory.length > 0) {
                chestPreviewContainer.style.display = 'grid'; 
                chestPreviewContainer.style.gridTemplateColumns = blockState.toSmelt ? 'repeat(3, 24px)' : 'repeat(9, 24px)';
                chestPreviewContainer.style.gap = '2px';
                chestPreviewContainer.style.justifyContent = 'center';
                
                for (let i = 0; i < inventory.length; i++) {
                    let item = inventory[i];
                    
                    let slot = document.createElement('div');
                    slot.className = 'chest-tooltip-slot';
                    slot.style.width = '24px'; slot.style.height = '24px';
                    slot.style.background = '#8B8B8B'; slot.style.border = '1px inset #FFF';
                    slot.style.display = 'flex'; slot.style.justifyContent = 'center';
                    slot.style.alignItems = 'center'; slot.style.position = 'relative';
                    slot.style.boxSizing = 'border-box';

                    if (!item || item === "air" || item === 0) { 
                        chestPreviewContainer.appendChild(slot); 
                        continue; 
                    }

                    let itemID = Array.isArray(item) ? item[0] : item.id;
                    let itemCount = Array.isArray(item) ? item[1] : item.count;
                    let itemDamage = Array.isArray(item) ? item[2] : item.damage;
                    
                    // Ejecutamos el súper escáner
                    let itemEnchants = extractEnchants(item);

                    if (itemID && itemID !== "air" && itemID !== "0" && itemID !== 0) { 
                        let cvs = document.createElement('canvas');
                        cvs.width = 16; cvs.height = 16;
                        cvs.style.width = '16px'; cvs.style.height = '16px';
                        let ctx = cvs.getContext('2d');
                        ctx.imageSmoothingEnabled = false;

                        let tempState = { type: itemID }; 
                        let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;
                        
                        if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                            ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
                            let maxDur = maxDurabilityMap[itemID];
                            if (maxDur && typeof drawDurabilityBar === 'function') {
                                drawDurabilityBar(ctx, 0, 0, 16, 16, itemDamage || 0, maxDur);
                            }
                        } else {
                            ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
                        }
                        slot.appendChild(cvs);

                        // --- APLICAR EFECTO MAGIA Y TOOLTIP ---
                        if (itemEnchants.length > 0) {
                            slot.classList.add('enchanted-slot');
                            
                            // FORZAMOS EL ESTILO CON JAVASCRIPT PARA QUE EL CSS NO LO BLOQUEE
                            slot.style.border = '2px solid rgba(162, 0, 255, 0.8)';
                            slot.style.boxShadow = '0 0 6px rgba(162, 0, 255, 0.8)';
                            slot.style.overflow = 'visible'; 
                            
                            let tooltipDiv = document.createElement('div');
                            tooltipDiv.className = 'enchant-tooltip';
                            tooltipDiv.style.display = 'none'; // Oculto al inicio
                            
                            let itemNameStr = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                            let nameHtml = `<span style="color: #55FF55; font-weight: bold; display: block; padding-bottom: 2px; margin-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.2);">${itemNameStr}</span>`;
                            
                            tooltipDiv.innerHTML = nameHtml + formatEnchantText(itemEnchants);
                            slot.appendChild(tooltipDiv);

                            // EVENTOS DEL RATÓN FORZADOS
                            slot.addEventListener('mouseenter', () => {
                                tooltipDiv.style.display = 'block';
                            });
                            slot.addEventListener('mouseleave', () => {
                                tooltipDiv.style.display = 'none';
                            });
                        }

                        if (itemCount > 1) {
                            let countTag = document.createElement('span');
                            countTag.innerText = itemCount;
                            countTag.style.position = 'absolute'; countTag.style.bottom = '-2px'; countTag.style.right = '2px';
                            countTag.style.color = 'white'; countTag.style.fontSize = '10px'; countTag.style.fontWeight = 'bold';
                            countTag.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
                            slot.appendChild(countTag);
                        }
                    }
                    chestPreviewContainer.appendChild(slot);
                }
            } else {
                chestPreviewContainer.style.display = 'none';
            }
        } else {
            chestPreviewContainer.style.display = 'none';
        }
    }
    document.getElementById('struct-info-author').innerText = struct.author || '-';
    document.getElementById('struct-info-sub').innerText = struct.subcategory || 'Misc';
    
    const canvas = document.getElementById('struct-preview-canvas');
    if (canvas) {
        canvas.style.imageRendering = 'pixelated';
        renderPreviewOnCanvas(canvas, struct.data, true);
    }

    const editCol = document.getElementById('struct-edit-actions');
    if (editCol) {
        if (struct.category === 'saved') {
            editCol.style.display = 'flex'; 
        } else {
            editCol.style.display = 'none'; 
        }
    }

    // Llamar a la función para dibujar los slots si es un cofre
    renderChestContents(struct);
}

// --- MOSTRAR CONTENIDO DE COFRES Y HORNOS (VERSIÓN OPTIMIZADA Y CORREGIDA) ---
function renderChestContents(struct) {
    const infoDiv = document.querySelector('.struct-info');
    if (!infoDiv) return;

    let existing = document.getElementById('struct-chest-preview');
    if (existing) existing.remove();

    // 1. Buscamos Cofres O Hornos (detectando la propiedad toSmelt)
    let containerBlock = struct.data.find(b => b.state && (b.state.chests || b.state.chest || b.state.items || b.state.toSmelt));
    if (!containerBlock) return;

    // 2. Creamos el contenedor principal con el diseño original (scale 0.9 para que quepa bien)
    let container = document.createElement('div');
    container.id = 'struct-chest-preview';
    container.style.marginTop = '5px';
    container.style.marginBottom = '10px';
    container.style.width = '100%';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.transform = 'scale(1.2)';

    // 3. Usamos nuestro Dibujante Universal
    if (typeof renderChestOrOvenUI === 'function') {
        let subContainer = document.createElement('div');
        let success = renderChestOrOvenUI(containerBlock.state, subContainer);
        
        if (success) {
            container.appendChild(subContainer);
            // EL TRUCO: Lo insertamos ANTES de la información (infoDiv), no adentro de él.
            infoDiv.parentNode.insertBefore(container, infoDiv);
        }
    }
}

// --- NUEVA FUNCIÓN: MOSTRAR CONTENIDO DE HORNOS ---
function renderOvenContents(struct) {
    const infoDiv = document.querySelector('.struct-info');
    if (!infoDiv) return;

    let ovenBlock = struct.data.find(b => b.state && b.state.toSmelt);
    if (!ovenBlock) return;

    let ovenData = ovenBlock.state.toSmelt;

    // Crear el contenedor principal del horno
    let container = document.createElement('div');
    container.id = 'struct-oven-preview';
    container.style.marginTop = '15px';
    container.style.width = '100%';
    container.style.background = '#C6C6C6';
    container.style.border = '2px solid #555';
    container.style.padding = '10px';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.gap = '20px';

    // Diccionario de durabilidad (por si meten herramientas al horno)
    const maxDurabilityMap = {
        "WoodenPickaxe": 60, "StonePickaxe": 132, "IronPickaxe": 251, "GoldPickaxe": 33, "DiamondPickaxe": 1562,
        "WoodenSword": 60, "StoneSword": 132, "IronSword": 251, "GoldSword": 33, "DiamondSword": 1562,
        "WoodenAxe": 60, "StoneAxe": 132, "IronAxe": 251, "GoldAxe": 33, "DiamondAxe": 1562,
        "WoodenShovel": 60, "StoneShovel": 132, "IronShovel": 251, "GoldShovel": 33, "DiamondShovel": 1562,
        "WoodenHoe": 60, "StoneHoe": 132, "IronHoe": 251, "GoldHoe": 33, "DiamondHoe": 1562
    };

    // Función interna para no repetir código al crear los 3 slots
    function createSlot(itemData, isLarge = false) {
        let slot = document.createElement('div');
        let size = isLarge ? '48px' : '36px';
        slot.style.width = size;
        slot.style.height = size;
        slot.style.background = '#8B8B8B';
        slot.style.border = '2px inset #FFF';
        slot.style.position = 'relative';
        slot.style.display = 'flex';
        slot.style.justifyContent = 'center';
        slot.style.alignItems = 'center';

        if (!itemData || itemData[0] === "air" || itemData[0] === 0 || itemData[0] === "0") {
            return slot; // Retorna slot vacío
        }

        let itemID = itemData[0];
        let itemCount = itemData[1];
        let itemDamage = itemData[2] || 0;

        let cvs = document.createElement('canvas');
        cvs.width = 16; cvs.height = 16;
        cvs.style.width = '80%'; cvs.style.height = '80%';
        cvs.style.imageRendering = 'pixelated';
        let ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        let tempState = { type: itemID }; 
        let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;

        if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
            ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
            let maxDur = maxDurabilityMap[itemID];
            if (maxDur && typeof drawDurabilityBar === 'function') {
                drawDurabilityBar(ctx, 0, 0, 16, 16, itemDamage, maxDur);
            }
        } else {
            ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
        }

        slot.appendChild(cvs);
        slot.title = `${itemID} (x${itemCount || 1})`; 

        if (itemCount > 1) {
            let countTag = document.createElement('span');
            countTag.innerText = itemCount;
            countTag.style.position = 'absolute';
            countTag.style.bottom = '0px'; countTag.style.right = '2px';
            countTag.style.color = 'white'; countTag.style.fontSize = '12px';
            countTag.style.fontWeight = 'bold';
            countTag.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
            slot.appendChild(countTag);
        }
        return slot;
    }

    // --- CONSTRUIR LA INTERFAZ DEL HORNO ---
    
    // Columna Izquierda (Input arriba, Fuel abajo)
    let leftCol = document.createElement('div');
    leftCol.style.display = 'flex';
    leftCol.style.flexDirection = 'column';
    leftCol.style.gap = '15px';
    leftCol.style.alignItems = 'center';

    let inputSlot = createSlot(ovenData.input);
    let fuelSlot = createSlot(ovenData.fuel);
    
    // Icono de fueguito entre los dos (opcional, decorativo)
    let fireIcon = document.createElement('div');
    fireIcon.innerText = ovenData.fuelTimer > 0 ? '🔥' : '♨️';
    fireIcon.style.fontSize = '14px';
    fireIcon.style.margin = '-8px 0';
    fireIcon.title = `Fuel Timer: ${ovenData.fuelTimer || 0}`;

    leftCol.appendChild(inputSlot);
    leftCol.appendChild(fireIcon);
    leftCol.appendChild(fuelSlot);

    // Flecha de progreso (Centro)
    let arrow = document.createElement('div');
    arrow.innerText = '➡️';
    arrow.style.fontSize = '24px';
    arrow.title = `Smelt Timer: ${ovenData.smeltTimer || 0}`;

    // Columna Derecha (Output grande)
    let rightCol = document.createElement('div');
    let outputSlot = createSlot(ovenData.output, true); // true = slot más grande
    rightCol.appendChild(outputSlot);

    // Unir todo
    container.appendChild(leftCol);
    container.appendChild(arrow);
    container.appendChild(rightCol);

    infoDiv.appendChild(container);
}


// --- CARGAR / BORRAR / EDITAR ---
function loadStructureToClipboard() {
    if (!selectedStructure) return;
    loadSpecificStructure(selectedStructure);
    closeModal('structures-modal'); 
}

function deleteSavedStructure() {
    if (!selectedStructure || selectedStructure.category !== 'saved') return;
    
    showCustomConfirm(`Delete "${selectedStructure.title}" permanently?`, async function() {
        // --- SONIDO ---
        if (typeof audioManager !== 'undefined') {
            audioManager.playSound('trash');
        }
        
        // 1. Borrar de la DB real
        if (selectedStructure.timestamp) {
            await dbManager.delete(selectedStructure.timestamp);
        }

        // 2. Actualizar memoria y UI
        structureDB = structureDB.filter(s => s !== selectedStructure);
        filterStructures('saved', 'all');
        updateRibbonQuickAccess();
    });
}

function openEditInfoModal() {
    if (!selectedStructure || selectedStructure.category !== 'saved') return;
    
    document.getElementById('edit-struct-title').value = selectedStructure.title;
    document.getElementById('edit-struct-author').value = selectedStructure.author;
    
    const subSelect = document.getElementById('edit-struct-subcategory');
    if (subSelect) {
        subSelect.value = selectedStructure.subcategory || 'Other';
    }
    
    document.getElementById('edit-info-modal').style.display = 'flex';
    isInputBlocked = true;
    
    ['edit-struct-title', 'edit-struct-author', 'edit-struct-subcategory'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.onkeydown = function(e) {
                e.stopPropagation();
                if(e.key === 'Escape') closeModal('edit-info-modal');
            };
        }
    });
}

async function saveEditedInfo() {
    if (!selectedStructure) return;
    
    const newTitle = document.getElementById('edit-struct-title').value.trim();
    const newAuthor = document.getElementById('edit-struct-author').value.trim();
    const newSubcategory = document.getElementById('edit-struct-subcategory').value;
    
    if (!newTitle) { alert("Title cannot be empty"); return; }
    
    // Actualizar objeto en memoria
    selectedStructure.title = newTitle;
    selectedStructure.author = newAuthor || "Anonymous";
    selectedStructure.subcategory = newSubcategory; 
    
    // Guardar en DB
    await dbManager.save(selectedStructure);
    
    filterStructures('saved', currentStructSubCategory); 
    selectStructure(selectedStructure); 
    updateRibbonQuickAccess(); 
    
    closeModal('edit-info-modal');
}

// --- GUARDAR NUEVA ESTRUCTURA ---
function openSaveStructureModal() {
    if (!window.selection.p1 || (!window.selection.p2 && window.selection.path.length === 0)) {
        alert("Select an area first!"); return;
    }
    
    let minX, maxX, minY, maxY;
    if (typeof getSelectionBounds === 'function') {
        const bounds = getSelectionBounds();
        if(!bounds) return;
        minX = bounds.minX; maxX = bounds.maxX; minY = bounds.minY; maxY = bounds.maxY;
    } else {
        if (window.selection.type === 'poly') {
            const xs = window.selection.path.map(p => p.x); const ys = window.selection.path.map(p => p.y);
            minX = Math.min(...xs); maxX = Math.max(...xs); minY = Math.min(...ys); maxY = Math.max(...ys);
        } else {
            minX = Math.min(window.selection.p1.x, window.selection.p2.x); maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
            minY = Math.min(window.selection.p1.y, window.selection.p2.y); maxY = Math.max(window.selection.p1.y, window.selection.p2.y);
        }
    }

    const data = [];
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            
            // 1. Validar que estemos dentro de la silueta azul
            if (typeof isPointSelected === 'function') {
                 if (!isPointSelected(x,y)) continue;
            } else if (window.selection.type === 'poly') { 
                 if (!isPointInPolygon(x, y, window.selection.path)) continue; 
            }
            
            // ✨ 2. LA MAGIA: Guardar el bloque, ¡incluso si es vacío (aire)!
            const state = mbwom.getBlockState(x, y);
            let stateToSave = null;
            if (state && state.type != null) {
                stateToSave = JSON.parse(JSON.stringify(state));
            }
            
            // Empujamos el dato (Sólido o null/aire) a la estructura
            data.push({ dx: x - minX, dy: y - minY, state: stateToSave });
        }
    }
    
    // 3. Revisamos si TODO lo que se seleccionó era solo aire
    const hasSolidBlocks = data.some(b => b.state !== null);
    if (!hasSolidBlocks) { alert("Area empty!"); return; }

    tempSaveData = data;
    
    isInputBlocked = true; 
    document.getElementById('save-structure-modal').style.display = 'flex';
    document.getElementById('input-struct-title').value = '';
    
    const inputsToIsolate = ['input-struct-title', 'input-struct-author', 'input-struct-subcategory'];
    inputsToIsolate.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.onkeydown = function(e) {
                e.stopPropagation(); 
                if(e.key === 'Escape') closeModal('save-structure-modal');
            };
        }
    });
    
    const canvas = document.getElementById('struct-save-preview');
    if (canvas) {
        canvas.style.imageRendering = 'pixelated';
        renderPreviewOnCanvas(canvas, tempSaveData, false, true); 
    }
}

async function saveNewStructure() {
    const title = document.getElementById('input-struct-title').value.trim();
    const author = document.getElementById('input-struct-author').value.trim();
    const category = 'saved'; 
    const subcategory = document.getElementById('input-struct-subcategory').value;

    if (!title) { alert("Please enter a title."); return; }

    const newStruct = {
        title: title, 
        author: author || "Anonymous", 
        category: category, 
        subcategory: subcategory,
        data: tempSaveData, 
        timestamp: Date.now() // ID para IndexedDB
    };

    // 1. Guardar en Base de Datos Real
    try {
        await dbManager.save(newStruct);
    } catch (e) {
        alert("Error saving to database: " + e);
        return;
    }

    // 2. Actualizar memoria
    structureDB.push(newStruct);
    
    filterStructures('saved', 'all');
    closeModal('save-structure-modal'); 
    
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = []; window.selection.subRects = [];
    if(typeof checkSelectionState === 'function') checkSelectionState();

    updateRibbonQuickAccess();
}

// ==========================================
// 🎨 RENDER PREVIEW
// ==========================================
function renderPreviewOnCanvas(canvas, blockData, fit = true, forceCover = false) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#333"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!blockData || blockData.length === 0) return;
    
    // --- GESTIÓN DE CARGA ---
    const imgs = window.images;
    if (!imgs || !imgs.blocks || !imgs.blocks.complete) {
        ctx.fillStyle = "#FFF";
        ctx.font = "10px monospace";
        ctx.fillText("Loading...", 5, canvas.height / 2);

        if (imgs && imgs.blocks) {
            setTimeout(() => renderPreviewOnCanvas(canvas, blockData, fit, forceCover), 100);
        }
        return; 
    }

    const xs = blockData.map(b => b.dx); const ys = blockData.map(b => b.dy);
    const w = Math.max(...xs) - Math.min(...xs) + 1;
    const h = Math.max(...ys) - Math.min(...ys) + 1;

    let tileSize = 16;
    if (forceCover) {
        let m = 2; 
        while ((w * m * 16 < canvas.width) && (h * m * 16 < canvas.height)) m += 2;
        tileSize = 16 * m;
    } else if (fit) {
        tileSize = Math.floor(canvas.height / h);
        if (tileSize < 1) tileSize = 1; 
    }

    const totalW = w * tileSize; const totalH = h * tileSize;
    const offsetX = (canvas.width - totalW) / 2;
    const offsetY = (canvas.height - totalH) / 2;

    blockData.forEach(block => {
        // ✨ LA CORRECCIÓN: Si el bloque es nuestro "aire invisible", lo ignoramos y no dibujamos nada
        if (!block.state || block.state.type === null || block.state.type === "air" || block.state.type === 0 || block.state.type === "0") {
            return; // Se queda transparente
        }

        const drawX = offsetX + block.dx * tileSize;
        const drawY = canvas.height - (offsetY + block.dy * tileSize) - tileSize;
        
        try {
            const renderer = window.blockData ? window.blockData[block.state.type] : null;
            if (renderer) {
                const tex = renderer(block.state);
                ctx.drawImage(imgs.blocks, tex.x, tex.y, 16, 16, drawX, drawY, tileSize, tileSize);
            } else { 
                ctx.fillStyle = '#888'; 
                ctx.fillRect(drawX, drawY, tileSize, tileSize);
            }
        } catch(e) { 
            // Si hay un error real (una textura que no existe), se pinta magenta
            ctx.fillStyle = '#F0F'; 
            ctx.fillRect(drawX, drawY, tileSize, tileSize); 
        }
    });
}

function updateRibbonQuickAccess() {
    const container = document.getElementById('recent-structures-ribbon');
    if (!container) return;
    
    container.innerHTML = ''; 

    const structList = structureDB.filter(s => s.category === 'saved');
    const displayItems = structList.slice(0, 3); 

    for (let i = 0; i < 3; i++) {
        const struct = displayItems[i];
        const btn = document.createElement('button');
        btn.className = 'quick-struct-btn'; 
        
        if (struct) {
            btn.title = `Load "${struct.title}"`;
            const canvas = document.createElement('canvas');
            canvas.width = 60; 
            canvas.height = 60;
            
            setTimeout(() => {
                 renderPreviewOnCanvas(canvas, struct.data, true); 
            }, 100);

            btn.appendChild(canvas);
            btn.onclick = function() {
                loadSpecificStructure(struct);
                const allBtns = container.querySelectorAll('.quick-struct-btn');
                allBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        } else {
            btn.classList.add('empty-slot');
            btn.title = "Empty Slot";
        }
        container.appendChild(btn);
    }
}

function loadSpecificStructure(struct) {
    if (!struct || !struct.data) return;
    
    const xs = struct.data.map(b => b.dx); 
    const ys = struct.data.map(b => b.dy);
    const w = Math.max(...xs) - Math.min(...xs) + 1;
    const h = Math.max(...ys) - Math.min(...ys) + 1;
    
    window.clipboard = { 
        width: w, 
        height: h, 
        data: JSON.parse(JSON.stringify(struct.data)) 
    };
    
    if (typeof activatePasteMode === 'function') {
        activatePasteMode(); 
    }
}



// Variable para llevar la cuenta de los cofres generados
let chestGenCount = 1;

// Variable global para llevar la cuenta de los cofres generados (por si no la tenías declarada fuera)
window.chestGenCount = window.chestGenCount || 1;

async function generateRandomLootChest() {
    let lootMode = 'normal';
    let typeSelect = document.getElementById('chest-loot-type');
    if (typeSelect) lootMode = typeSelect.value;
    
    // 1. La tabla de loot exacta (con pesos/probabilidades basados en el juego)
    let lootTable = [];
    
    if (lootMode === 'op') {
        lootTable = [
            // Herramientas OP
            { id: "DiamondSword", isTool: true, weight: 15 },
            { id: "DiamondPickaxe", isTool: true, weight: 15 },
            { id: "DiamondAxe", isTool: true, weight: 10 },
            
            // Tesoros Ultra Raros
            { id: "dm", min: 5, max: 15, weight: 20 },     
            { id: "gi", min: 5, max: 10, weight: 15 },    
            { id: "ep", min: 3, max: 8, weight: 15 },     
            { id: "gap", min: 3, max: 5, weight: 10 },    
            { id: "tag", min: 2, max: 4, weight: 10 },   
            { id: "bk", min: 3, max: 5, weight: 10 },    
            
            // Minerales Extra
            { id: "ii", min: 10, max: 24, weight: 15 },    
            { id: "rsd", min: 20, max: 40, weight: 15 },  
            { id: "topaz", min: 10, max: 20, weight: 15 },
            
            // Bloques premium
            { id: "obsidian", min: 5, max: 14, weight: 15 },
            { id: "enchantmenttable", min: 1, max: 1, weight: 5 },
            
            // Comida Buena
            { id: "cookedmeat", min: 10, max: 25, weight: 15 }
        ];
    } else {
        lootTable = [
            // Herramientas (1 unidad, daño aleatorio)
            { id: "StoneSword", isTool: true, weight: 15 },
            { id: "StonePickaxe", isTool: true, weight: 15 },
            { id: "StoneAxe", isTool: true, weight: 15 },
            { id: "StoneShovel", isTool: true, weight: 15 },
            
            // Tesoros y Raros
            { id: "dm", min: 1, max: 3, weight: 5 },     
            { id: "gi", min: 1, max: 3, weight: 10 },    
            { id: "ep", min: 1, max: 1, weight: 5 },     
            { id: "gap", min: 1, max: 2, weight: 5 },    
            { id: "tag", min: 1, max: 1, weight: 10 },   
            { id: "bk", min: 1, max: 1, weight: 10 },    
            { id: "gp", min: 1, max: 1, weight: 15 },    
            
            // Minerales
            { id: "ii", min: 1, max: 6, weight: 20 },    
            { id: "cl", min: 1, max: 6, weight: 25 },    
            { id: "rsd", min: 1, max: 10, weight: 30 },  
            { id: "or", min: 1, max: 5, weight: 15 },    
            { id: "topaz", min: 1, max: 5, weight: 20 }, 
            { id: "flint", min: 1, max: 4, weight: 25 }, 
            
            // Bloques y Comunes
            { id: "cs", min: 1, max: 15, weight: 30 },   
            { id: "wd", min: 1, max: 5, weight: 20 },    
            { id: "wp", min: 1, max: 8, weight: 20 },    
            { id: "bb", min: 2, max: 20, weight: 25 },   
            { id: "sw", min: 1, max: 9, weight: 15 },    
            { id: "oddrock", min: 1, max: 5, weight: 25 },
            
            // Naturaleza
            { id: "pseed", min: 1, max: 4, weight: 15 }, 
            { id: "bseed", min: 1, max: 4, weight: 15 }, 
            { id: "wseed", min: 1, max: 4, weight: 15 }, 
            { id: "ccb", min: 1, max: 6, weight: 15 },   
            { id: "fw1", min: 1, max: 3, weight: 15 },   
            { id: "fw2", min: 1, max: 3, weight: 15 }    
        ];
    }

    function getRandomLootItem() {
        let totalWeight = lootTable.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        for (let item of lootTable) {
            if (random < item.weight) return item;
            random -= item.weight;
        }
        return lootTable[0];
    }

    // 2. El array del cofre (27 elementos). Mine Blocks acepta '0' o '["air", 0, 0, {}]' para slots vacíos.
    let chestInventory = new Array(27).fill(0);
    
    // 3. Cantidad de slots ocupados (siempre entre 5 y 9 según los datos)
    let slotsToFill = Math.floor(Math.random() * (16 - 8 + 1)) + 5;
    
    // 4. Elegir slots al azar
    let availableSlots = Array.from({length: 27}, (_, i) => i);
    
    for (let i = 0; i < slotsToFill; i++) {
        const randomIndex = Math.floor(Math.random() * availableSlots.length);
        const slotIndex = availableSlots.splice(randomIndex, 1)[0];
        
        const loot = getRandomLootItem();
        
        if (loot.isTool) {
            // Desgaste aleatorio entre 50 y 100
            let damage = Math.floor(Math.random() * (100 - 50 + 1)) + 50;
            chestInventory[slotIndex] = [loot.id, 1, damage, {}];
        } else {
            // Cantidad aleatoria basada en los límites descubiertos
            let qty = Math.floor(Math.random() * (loot.max - loot.min + 1)) + loot.min;
            chestInventory[slotIndex] = [loot.id, qty, 0, {}];
        }
    }

    // 5. Creamos la estructura tal cual la lee tu algoritmo
    const newStruct = {
        title: `Dungeon Chest ${window.chestGenCount++}`,
        author: "System",
        category: "saved",
        subcategory: "Chests",
        timestamp: Date.now(),
        data: [
            { 
                dx: 0, 
                dy: 0, 
                state: { 
                    type: "chest", 
                    states1: "",
                    firstTimes: false,
                    chests: chestInventory // Pasamos el array listo
                } 
            }
        ]
    };

    try {
        // Usamos la base de datos IndexedDB
        if (typeof dbManager !== 'undefined') {
            await dbManager.save(newStruct);
        } else {
            console.warn("dbManager no encontrado.");
        }
        
        // Actualizamos la interfaz
        if (typeof structureDB !== 'undefined') {
            structureDB.push(newStruct);
        }
        
        if (typeof filterStructures === 'function') {
            filterStructures('saved', 'Chests'); // Filtra para mostrar el cofre nuevo
        }
        
        if (typeof updateRibbonQuickAccess === 'function') {
            updateRibbonQuickAccess();
        }
        
    } catch(e) {
        console.error("Error al generar el cofre:", e);
        alert("Hubo un error al generar el Loot Chest.");
    }
}