// --- CONFIGURACIÓN DE PESTAÑAS E INVENTARIO ---

let activeInventoryTab = 'all';

// La lista completa de bloques/items ahora vive en scripts/items-data.js,
// como window.inventoryCategories, para no tener dos copias (esta y la de
// scripts/database.js) que con el tiempo terminan desincronizadas.
const inventoryCategories = window.inventoryCategories;

// =================================================================

// --- GESTIÓN DE PESTAÑAS (RIBBON) ---
function openTab(tabName) {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const panes = document.querySelectorAll('.tab-pane');
    panes.forEach(pane => pane.classList.remove('active'));

    const targetBtn = Array.from(buttons).find(b => b.textContent.toLowerCase().includes(tabName) || b.onclick.toString().includes(tabName));
    if (targetBtn) targetBtn.classList.add('active');

    const targetPane = document.getElementById('tab-' + tabName);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    // La mini hotbar del jugador (pestaña Player) se vuelve a pintar por si el mundo cambió mientras no se veía
    if (tabName === 'player' && typeof window.playerInvRefresh === 'function') window.playerInvRefresh();
}

// --- GESTIÓN DE MODALES ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
    // El perfil obligatorio (nombre "Player") no se puede cerrar hasta guardar un nombre válido (scripts/profile.js)
    if (modalId === 'unified-profile-modal' && window.profileLocked) return;
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    // La ventana "Custom Mob" va encima del Mob Browser: si se cierra el Mob Browser, se cierra ella también
    if (modalId === 'mobs-modal') { const cm = document.getElementById('custom-mob-modal'); if (cm) cm.style.display = 'none'; }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        if (event.target.id === 'unified-profile-modal' && window.profileLocked) return;
        event.target.style.display = "none";
    }
}

// --- GESTIÓN DE LOGROS ---
const checkboxes = document.querySelectorAll('#achievements-list input[type="checkbox"]');
function toggleAchievements(checked) {
    checkboxes.forEach(cb => cb.checked = checked);
}

// --- GESTIÓN DE TEMAS ---
function setTheme(themeName) {
    const body = document.body;
    
    // 1. Encontramos y borramos TODAS las clases de temas
    const classesToRemove = Array.from(body.classList).filter(c => c.startsWith('theme-'));
    classesToRemove.forEach(c => body.classList.remove(c));

    // 2. Aplicamos el nuevo tema seleccionado
    if (themeName !== 'dark') {
        body.classList.add('theme-' + themeName);
    }
    
    // 3. Actualizamos la lista desplegable visualmente
    const select = document.getElementById('theme-select');
    if (select) select.value = themeName;

    // 4. Intentamos guardar en memoria (con protección para navegadores estrictos)
    try {
        localStorage.setItem('mbw_theme', themeName);
    } catch (e) {
        console.warn("Memoria bloqueada por el navegador: no se pudo guardar el tema.");
    }
}

window.addEventListener('DOMContentLoaded', () => {
    let savedTheme = 'darkblue'; // Nuestro valor por defecto
    
    // Intentamos leer la memoria con protección
    try {
        savedTheme = localStorage.getItem('mbw_theme') || 'darkblue';
    } catch (e) {
        console.warn("Memoria bloqueada por el navegador: cargando tema por defecto.");
    }
    
    setTheme(savedTheme);
    setTimeout(renderHotbarUI, 500);
});

// =================================================================
// --- SISTEMA DE INVENTARIO (DRAG & DROP) ---
// =================================================================

let heldItem = null; // Variable global para guardar qué llevas en la mano

// Evento para que el ítem siga al ratón en toda la pantalla
document.addEventListener('mousemove', (e) => {
    const floater = document.getElementById('floating-held-item');
    if (floater && heldItem) {
        floater.style.left = e.clientX + 'px';
        floater.style.top = e.clientY + 'px';
    }
});

let isBuildingChest = false;
let customChestInventory = new Array(27).fill(null);
// Está en true mientras la ventana del inventario está abierta como "Create Custom Item" (scripts/custom-items.js).
// Mientras lo está, hacer clic en un objeto lo manda a la "mesa de encantamiento" en vez de pegarlo al cursor.
let isCreatingCustomItem = false;

function toggleInventory() {
    const modal = document.getElementById('inventory-modal');
    const modalContent = modal.querySelector('.modal-content'); 
    const chestPanel = document.getElementById('chest-builder-panel');
    const customPanel = document.getElementById('custom-item-builder-panel');
    const title = document.getElementById('inventory-modal-title');
    const hotbarContainer = document.getElementById('modal-hotbar-container');

    if (modal.style.display === 'block') {
        modal.style.display = 'none';
        // Si era el inventario del jugador, el objeto que quedó en el cursor vuelve a la mochila (antes de borrar el cursor)
        if (typeof playerInvClosed === 'function') playerInvClosed();
        heldItem = null;
        // Si el Mob Browser abrió el inventario para elegir un objeto y se cerró sin elegir, avisarle.
        if (window.mobInvPick && typeof mobEditorInvClosed === 'function') mobEditorInvClosed();
        updateFloatingItem();
        isBuildingChest = false;
        isCreatingCustomItem = false;
    } else {
        if (typeof playerInvReset === 'function') playerInvReset();   // deja la ventana como siempre (sin el panel del jugador)
        isCreatingCustomItem = false;                                  // abrir el inventario normal nunca es el creador de objetos
        modal.style.display = 'block';
        
        if (title) title.innerText = "Inventory";
        if (chestPanel) chestPanel.style.display = 'none'; 
        if (customPanel) customPanel.style.display = 'none'; 
        if (hotbarContainer) hotbarContainer.style.display = 'grid'; // Mostramos la hotbar

        if (modalContent) modalContent.style.width = '584px';

        const searchInput = document.getElementById('inventory-search');
        if(searchInput) {
            searchInput.value = ''; 
            searchInput.focus();
        }

        renderInventoryTabs(); 
        populateInventory();   
        renderModalHotbar(); 
    }
}

function renderInventoryTabs() {
    const container = document.getElementById('inventory-tabs-sidebar');
    if (!container) return;
    container.innerHTML = '';

    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.gap = '2px';
    container.style.padding = '8px 10px 0px 10px'; 
    container.style.background = 'lightgray';
    container.style.borderBottom = 'none'; 
    container.style.alignItems = 'flex-end'; 

    Object.keys(inventoryCategories).forEach(key => {
        const tabConfig = inventoryCategories[key];
        const isActive = activeInventoryTab === key;
        
        const tabBtn = document.createElement('div');
        
        // Estilo de Pestaña (Solo ícono)
        tabBtn.style.display = 'flex';
        tabBtn.style.alignItems = 'center';
        tabBtn.style.justifyContent = 'center';
        tabBtn.style.padding = '6px 12px'; // Un poco más cuadradas
        tabBtn.style.cursor = 'pointer';
        tabBtn.style.borderTopLeftRadius = '0px'; 
        tabBtn.style.borderTopRightRadius = '0px';
        tabBtn.style.border = '2px solid #555';
        
        // Tooltip: Se mostrará el nombre al pasar el ratón por encima
        tabBtn.title = key === 'all' ? 'All Items' : key; 
        
        if (isActive) {
            tabBtn.style.background = '#373737'; 
            tabBtn.style.borderBottom = '2px solid #373737'; 
            tabBtn.style.marginBottom = '-2px'; 
            tabBtn.style.paddingTop = '8px'; 
        } else {
            tabBtn.style.background = '#2A2A2A';
            tabBtn.style.borderBottom = '2px solid #555';
            tabBtn.style.marginBottom = '0px';
        }

        tabBtn.onclick = () => {
            activeInventoryTab = key;
            populateInventory();
            renderInventoryTabs(); 
        };

        // El Ícono (Canvas)
        const cvs = document.createElement('canvas');
        cvs.width = 16;
        cvs.height = 16;
        // Hacemos el ícono un poquito más grande (24px) ya que no hay texto
        cvs.style.width = '24px'; 
        cvs.style.height = '24px';
        cvs.style.imageRendering = 'pixelated';
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const tempState = { type: tabConfig.icon };
        let renderObj = null;
        if (typeof getBlockObject === 'function') {
            renderObj = getBlockObject(tempState);
        } else if (window.blockData && window.blockData[tabConfig.icon]) {
             const renderer = window.blockData[tabConfig.icon];
             renderObj = renderer(tempState);
        } else {
            renderObj = { x: 0, y: 0 }; 
        }

        if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
             ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
        }

        tabBtn.appendChild(cvs);

        // Efecto Hover
        tabBtn.onmouseenter = () => { if(!isActive) tabBtn.style.background = '#333'; };
        tabBtn.onmouseleave = () => { if(!isActive) tabBtn.style.background = '#2A2A2A'; };

        container.appendChild(tabBtn);
    });
}


// Un libro encantado (ebook) con UN encantamiento: lo usan la pestaña EnchantedBooks y los resultados del buscador.
function makeEnchantedBookTile(enchantKey) {
    let enchantments = {};
    enchantments[enchantKey] = "enchant"; 

    const item = document.createElement('div');
    item.className = 'inv-item enchanted-slot'; 
    item.title = ""; 
    // Texto que busca el buscador del inventario (nombre del encantamiento, nivel y clave del juego)
    item.dataset.search = (typeof mbwEnchLabel === 'function' ? mbwEnchLabel(enchantKey) : enchantKey) + ' ' + enchantKey + ' enchanted book';

    // GUARDAMOS EL TEXTO MÁGICO EN EL DATASET PARA EL TOOLTIP MAESTRO
    let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
    item.dataset.enchantTooltip = `<strong>Enchanted Book</strong>${enchantTooltipHTML}`;

    // Lógica de Recogida (Soporta NBT)
    item.onclick = () => {
        // En el Creador de objetos, un libro encantado va a la mesa como "ebook" con esa magia (se le pueden sumar más)
        if (isCreatingCustomItem && typeof selectCustomItem === 'function') { selectCustomItem('ebook', enchantments); return; }
        heldItem = { type: 'ebook', count: 1, states1: 0, nbt: enchantments };   // el juego guarda un libro encantado como 'ebook'
        updateFloatingItem();
    };

    // Estilos del slot
    item.style.width = '64px'; item.style.height = '64px';
    item.style.minWidth = '64px'; item.style.minHeight = '64px';
    item.style.flexShrink = '0';
    item.style.background = '#8B8B8B'; item.style.border = '4px inset #FFF'; 
    item.style.display = 'flex'; item.style.justifyContent = 'center';
    item.style.alignItems = 'center'; item.style.boxSizing = 'border-box';
    item.style.cursor = 'pointer'; item.style.position = 'relative';

    // Dibujar el canvas del ítem (textura 'ebook' = libro encantado)
    const cvs = document.createElement('canvas');
    cvs.width = 16; cvs.height = 16;
    cvs.style.width = '48px'; cvs.style.height = '48px';
    cvs.style.imageRendering = 'pixelated';
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: 'ebook'}) : null;
    if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
        ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
    } else {
        ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
    }
    item.appendChild(cvs);

    // Efecto Hover
    item.onmouseenter = () => { item.style.background = '#A0A0A0'; };
    item.onmouseleave = () => { item.style.background = '#8B8B8B'; };
    return item;
}

// Ronda 9: escaleras, losas, dispenser y dropper ya se giran con Rotate (botón o tecla R), así que en el Inventory solo se deja la
// variante _1 de cada una (menos casillas repetidas). NO se oculta nada de lo demás: antorchas (th), linternas (lant), etc. siguen
// completas, y tampoco las cosas con "_número" que NO son una orientación (pasteles mordidos, cultivos, niveles de agua...).
function isHiddenByRotate(blockId) {
    const m = /^(.*)_(\d+)$/.exec(String(blockId));
    if (!m || typeof variantFamilyFor !== 'function') return false;
    const family = variantFamilyFor(m[1]);
    return (family === 'stair' || family === 'slab' || family === 'facing') && Number(m[2]) !== 1;
}
window.isHiddenByRotate = isHiddenByRotate;

function populateInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    
    if (typeof images === 'undefined' || !images.blocks || !images.blocks.complete) {
        setTimeout(populateInventory, 500);
        return;
    }

    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(9, 64px)'; 
    grid.style.gap = '0px'; 
    grid.style.padding = '0px';
    grid.style.alignItems = 'start';
    grid.style.alignContent = 'start';
    grid.style.justifyContent = 'center';

    // ========================================================
    // --- LÓGICA ESPECIAL: PESTAÑA LIBROS ENCANTADOS (LIMPIA) ---
    // ========================================================
    if (activeInventoryTab === 'EnchantedBooks') {
        Object.keys(enchantTranslations).forEach(enchantKey => grid.appendChild(makeEnchantedBookTile(enchantKey)));
        const si = document.getElementById('inventory-search');
        if (si && si.value) filterInventory(si.value);
        return; 
    }

// ========================================================
    // --- LÓGICA ESPECIAL: PESTAÑA POCIONES ---
    // ========================================================
    if (activeInventoryTab === 'Potions') {
        const gamePotions = [
            // Normales
            { name: "Water Bottle", nbt: { type: "water", effects: null }, color: "#5555FF" },
            { name: "Potion of Healing", nbt: { type: "healing", effects: [{level:1, type:"instanthealth"}] }, color: "#F82423" },
            { name: "Potion of Harming", nbt: { type: "harming", effects: [{level:1, type:"instantdamage"}] }, color: "#430A09" },
            { name: "Potion of Swiftness", nbt: { type: "swiftness", effects: [{level:1, duration:180, type:"speed"}] }, color: "#7CAFC6" },
            { name: "Potion of Slowness", nbt: { type: "slowness", effects: [{level:1, duration:90, type:"slowness"}] }, color: "#5A6C81" },
            { name: "Potion of Poison", nbt: { type: "poison", effects: [{level:1, duration:45, type:"poison"}] }, color: "#4E9331" },
            { name: "Potion of Regeneration", nbt: { type: "regeneration", effects: [{level:1, duration:45, type:"regeneration"}] }, color: "#CD5CAB" },
            { name: "Potion of Strength", nbt: { type: "strength", effects: [{level:1, duration:180, type:"strength"}] }, color: "#932423" },
            { name: "Potion of Weakness", nbt: { type: "weakness", effects: [{level:1, duration:90, type:"weakness"}] }, color: "#484D48" },
            { name: "Potion of Fire Resistance", nbt: { type: "fireresistance", effects: [{level:1, duration:180, type:"fireresistance"}] }, color: "#E49A3A" },
            { name: "Potion of Water Breathing", nbt: { type: "waterbreathing", effects: [{level:1, duration:180, type:"waterbreathing"}] }, color: "#2E5299" },
            { name: "Potion of Leaping", nbt: { type: "leaping", effects: [{level:1, duration:180, type:"jumpboost"}] }, color: "#22FF4C" },
            { name: "Potion of Invisibility", nbt: { type: "invisibility", effects: [{level:1, duration:180, type:"invisibility"}] }, color: "#7F8392" },
            { name: "Potion of Night Vision", nbt: { type: "nightvision", effects: [{level:1, duration:180, type:"nightvision"}] }, color: "#1F1FA1" },
            
            // Arrojadizas (Splash)
            { name: "Splash Potion of Healing", nbt: { category: "splash", type: "healing", effects: [{level:1, type:"instanthealth"}] }, color: "#F82423" },
            { name: "Splash Potion of Harming", nbt: { category: "splash", type: "harming", effects: [{level:1, type:"instantdamage"}] }, color: "#430A09" },
            { name: "Splash Potion of Swiftness", nbt: { category: "splash", type: "swiftness", effects: [{level:1, duration:180, type:"speed"}] }, color: "#7CAFC6" },
            { name: "Splash Potion of Slowness", nbt: { category: "splash", type: "slowness", effects: [{level:1, duration:90, type:"slowness"}] }, color: "#5A6C81" },
            { name: "Splash Potion of Poison", nbt: { category: "splash", type: "poison", effects: [{level:1, duration:45, type:"poison"}] }, color: "#4E9331" },
            { name: "Splash Potion of Regeneration", nbt: { category: "splash", type: "regeneration", effects: [{level:1, duration:45, type:"regeneration"}] }, color: "#CD5CAB" },
            { name: "Splash Potion of Strength", nbt: { category: "splash", type: "strength", effects: [{level:1, duration:180, type:"strength"}] }, color: "#932423" },
            { name: "Splash Potion of Weakness", nbt: { category: "splash", type: "weakness", effects: [{level:1, duration:90, type:"weakness"}] }, color: "#484D48" },
            { name: "Splash Potion of Fire Resistance", nbt: { category: "splash", type: "fireresistance", effects: [{level:1, duration:180, type:"fireresistance"}] }, color: "#E49A3A" },
            { name: "Splash Potion of Water Breathing", nbt: { category: "splash", type: "waterbreathing", effects: [{level:1, duration:180, type:"waterbreathing"}] }, color: "#2E5299" },
            { name: "Splash Potion of Leaping", nbt: { category: "splash", type: "leaping", effects: [{level:1, duration:180, type:"jumpboost"}] }, color: "#22FF4C" },
            { name: "Splash Potion of Invisibility", nbt: { category: "splash", type: "invisibility", effects: [{level:1, duration:180, type:"invisibility"}] }, color: "#7F8392" },
            { name: "Splash Potion of Night Vision", nbt: { category: "splash", type: "nightvision", effects: [{level:1, duration:180, type:"nightvision"}] }, color: "#1F1FA1" }
        ];

        gamePotions.forEach(potionData => {
            const item = document.createElement('div');
            item.className = 'inv-item enchanted-slot'; 
            item.title = ""; 
            
            item.dataset.enchantTooltip = `<strong>${potionData.name}</strong><span class="tooltip-enchant" style="color: ${potionData.color}; display: block; line-height: 0.6; margin-top: 2px;">Potion Effect</span>`;

            item.onclick = () => {
                if (isCreatingCustomItem) return;   // las pociones no se editan en el Creador de objetos: no se pegan al cursor
                heldItem = { type: 'potion', count: 1, states1: 0, nbt: potionData.nbt };
                updateFloatingItem();
            };

            item.style.width = '64px'; item.style.height = '64px';
            item.style.minWidth = '64px'; item.style.minHeight = '64px';
            item.style.flexShrink = '0';
            item.style.background = '#8B8B8B'; item.style.border = '4px inset #FFF'; 
            item.style.display = 'flex'; item.style.justifyContent = 'center';
            item.style.alignItems = 'center'; item.style.boxSizing = 'border-box';
            item.style.cursor = 'pointer'; item.style.position = 'relative';

            const cvs = document.createElement('canvas');
            cvs.width = 16; cvs.height = 16;
            cvs.style.width = '48px'; cvs.style.height = '48px';
            cvs.style.imageRendering = 'pixelated';
            const ctx = cvs.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: 'potion', nbt: potionData.nbt}) : null;
            if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
            } else {
                ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
            }
            item.appendChild(cvs);

            item.onmouseenter = () => { item.style.background = '#A0A0A0'; };
            item.onmouseleave = () => { item.style.background = '#8B8B8B'; };

            grid.appendChild(item);
        });
        
        return; 
    }
    
    // ========================================================
    // --- LÓGICA ESPECIAL: PESTAÑA CUSTOM ---
    // ========================================================
    if (activeInventoryTab === 'Custom') {
        let savedCustomItems = JSON.parse(localStorage.getItem('mbw_custom_items')) || [];
        
        savedCustomItems.forEach((customItemData, index) => {
            let itemID = customItemData[0];
            let itemCount = customItemData[1];
            let itemDamage = customItemData[2];
            let enchantments = customItemData[3];

            const item = document.createElement('div');
            item.className = 'inv-item';
            
            item.onclick = () => {
                // Con el Creador de objetos abierto, el objeto guardado va a la mesa para EDITARLO (con sus magias y su nombre)
                if (isCreatingCustomItem && typeof selectCustomItem === 'function') {
                    selectCustomItem(itemID, enchantments, index);
                    return;
                }
                heldItem = { type: itemID, count: itemCount, states1: itemDamage, nbt: enchantments };
                updateFloatingItem();
            };

            item.oncontextmenu = (e) => {
                e.preventDefault();
                savedCustomItems.splice(index, 1);
                localStorage.setItem('mbw_custom_items', JSON.stringify(savedCustomItems));
                populateInventory(); 
            };

            item.style.width = '64px'; item.style.height = '64px';
            item.style.minWidth = '64px'; item.style.minHeight = '64px';
            item.style.flexShrink = '0';
            item.style.background = '#8B8B8B'; item.style.border = '4px inset #FFF'; 
            item.style.display = 'flex'; item.style.justifyContent = 'center';
            item.style.alignItems = 'center'; item.style.boxSizing = 'border-box';
            item.style.cursor = 'pointer'; item.style.position = 'relative';

// 1. Revisamos si tiene magias reales (ignorando el nombre)
            let isEnchanted = false;
            if (enchantments) {
                for (let k in enchantments) {
                    if (enchantments[k] === "enchant") isEnchanted = true;
                }
            }

            // 2. Buscamos si tiene nombre personalizado guardado en el NBT
            let itemNameStr = (enchantments && enchantments.name) ? enchantments.name : String(itemID).replace(/([A-Z])/g, ' $1').trim();

            if (isEnchanted) {
                item.classList.add('enchanted-slot');
                item.title = ""; 

                let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
                item.dataset.enchantTooltip = `<strong>${itemNameStr}</strong>${enchantTooltipHTML}`;
            } else {
                item.title = itemNameStr + " (Custom)";
            }

            const cvs = document.createElement('canvas');
            cvs.width = 16; cvs.height = 16;
            cvs.style.width = '48px'; cvs.style.height = '48px';
            cvs.style.imageRendering = 'pixelated';
            const ctx = cvs.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: itemID}) : null;
            if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
            } else {
                ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
            }
            item.appendChild(cvs);

            item.onmouseenter = () => { item.style.background = '#A0A0A0'; };
            item.onmouseleave = () => { item.style.background = '#8B8B8B'; };

            grid.appendChild(item);
        });
        
        return; 
    }

    // ========================================================
    // --- LÓGICA NORMAL: PESTAÑAS DEL JUEGO BASE ---
    // ========================================================
    const allBlocks = (typeof window.blockData !== 'undefined') ? Object.keys(window.blockData) : [];
    let blocksToShow = [];

    if (activeInventoryTab === 'all') {
        blocksToShow = allBlocks;
    } else {
        const categoryItems = inventoryCategories[activeInventoryTab].items;
        blocksToShow = categoryItems.filter(item => allBlocks.includes(item));
    }
    // Las variantes que Rotate ya produce (escaleras _2 a _4, losas _2, dispenser/dropper _2 a _4) no se muestran
    blocksToShow = blocksToShow.filter(item => !isHiddenByRotate(item));

    blocksToShow.forEach(blockType => {
        const item = document.createElement('div');
        item.className = 'inv-item';
        item.title = blockType; 
        
        item.onclick = () => {
            // Con el Creador de objetos abierto, el objeto va a la "mesa de encantamiento" en vez de pegarse al cursor
            if (isCreatingCustomItem && typeof selectCustomItem === 'function') selectCustomItem(String(blockType).split('_')[0]);   // el creador no guarda variantes (color, etc.): solo el objeto
            else pickupItemFromInventory(blockType);
        };
        
        item.style.width = '64px';
        item.style.height = '64px';
        item.style.minWidth = '64px';
        item.style.minHeight = '64px';
        item.style.flexShrink = '0';
        item.style.background = '#8B8B8B'; 
        item.style.border = '4px inset #FFF'; 
        item.style.display = 'flex';
        item.style.justifyContent = 'center';
        item.style.alignItems = 'center';
        item.style.boxSizing = 'border-box';
        item.style.cursor = 'pointer';
        
        const cvs = document.createElement('canvas');
        cvs.width = 16;  
        cvs.height = 16;
        cvs.style.width = '48px'; 
        cvs.style.height = '48px';
        cvs.style.imageRendering = 'pixelated';
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        const tempState = { type: blockType }; 
        let renderObj = null;

        if (typeof getBlockObject === 'function') {
            renderObj = getBlockObject(tempState);
        } else if (window.blockData && window.blockData[blockType]) {
             const renderer = window.blockData[blockType];
             renderObj = renderer(tempState);
        }

        if (renderObj && images.blocks && images.blocks.complete) {
             ctx.drawImage(images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
        } else {
             ctx.fillStyle = "magenta"; 
             ctx.fillRect(4, 4, 8, 8);
        }
        
        item.appendChild(cvs);

        item.onmouseenter = () => { item.style.background = '#A0A0A0'; };
        item.onmouseleave = () => { item.style.background = '#8B8B8B'; };

        grid.appendChild(item);
    });

    const searchInput = document.getElementById('inventory-search');
    if (searchInput && searchInput.value) {
        filterInventory(searchInput.value);
    }
}

function filterInventory(query) {
    const flat = (x) => String(x || '').toLowerCase().replace(/[\s_]+/g, '');   // "diamond sword" = "DiamondSword" = "diamond_sword"
    const rawQuery = String(query || '').toLowerCase().trim();
    query = flat(rawQuery);
    const grid = document.getElementById('inventory-grid');
    // Los libros que una búsqueda anterior agregó se quitan antes de buscar de nuevo
    if (grid) grid.querySelectorAll('.inv-enchbook-extra').forEach(e => e.remove());
    const items = document.querySelectorAll('.inv-item');
    items.forEach(item => {
        const name = flat(item.dataset.search || item.title);
        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
    // Buscar un encantamiento ("sharpness", "unbreaking iii"...) muestra los libros encantados (ebook) con ese encantamiento.
    // En la pestaña EnchantedBooks ya están todos y solo se filtran; en las demás se agregan al final.
    if (grid && rawQuery.length >= 3 && activeInventoryTab !== 'EnchantedBooks' && typeof mbwEnchSearch === 'function') {
        mbwEnchSearch(rawQuery).forEach(key => {
            const tile = makeEnchantedBookTile(key);
            tile.classList.add('inv-enchbook-extra');
            grid.appendChild(tile);
        });
    }
}

// --- RECOGER ÍTEMS DEL INVENTARIO ---
function pickupItemFromInventory(blockType) {
    let type = blockType;
    let states1 = undefined;
    
    if (blockType.includes('_')) {
        let parts = blockType.split('_');
        type = parts[0];
        states1 = isNaN(parts[1]) ? parts[1] : parseInt(parts[1]); 
    }

    if (heldItem && heldItem.type === type && heldItem.states1 === states1) {
        heldItem.count += 1;
        if (heldItem.count > 64) heldItem.count = 64; 
    } else {
        heldItem = { type: type, states1: states1, count: 1 };
    }
    
    updateFloatingItem();
}

// --- DIBUJAR EL ÍTEM FLOTANTE (TRANSPARENTE) ---
function updateFloatingItem() {
    // Modo "elegir objeto" (lo usa el Mob Browser para mano / armadura / drops): en vez de quedarse
    // en el cursor, el objeto recién tomado del inventario se entrega a quien lo pidió y se cierra el inventario.
    if (heldItem && window.mobInvPick && typeof mobEditorInvIntercept === 'function' && mobEditorInvIntercept()) return;

    let floater = document.getElementById('floating-held-item');

    if (!floater) {
        floater = document.createElement('div');
        floater.id = 'floating-held-item';
        floater.style.position = 'fixed';
        floater.style.pointerEvents = 'none'; 
        floater.style.zIndex = '999999';
        floater.style.opacity = '0.8'; 
        floater.style.width = '64px';
        floater.style.height = '64px';
        floater.style.transform = 'translate(-50%, -50%)'; 
        document.body.appendChild(floater);
    }

    if (!heldItem) {
        floater.style.display = 'none';
        return;
    }

    floater.style.display = 'block';
    floater.innerHTML = ''; 

    const cvs = document.createElement('canvas');
    cvs.width = 16; cvs.height = 16;
    cvs.style.width = '100%'; cvs.style.height = '100%';
    cvs.style.imageRendering = 'pixelated';
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let tempState = { type: heldItem.iconType || heldItem.type };   // iconType: objetos del jugador cuyo id del mundo no es el de la textura (bed -> bed1)
    if (heldItem.states1 !== undefined) tempState.states1 = heldItem.states1;

    let renderObj = typeof getBlockObject === 'function' ? getBlockObject(tempState) : null;
    if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
        ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
    } else {
        ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
    }
    floater.appendChild(cvs);

    if (heldItem.count > 1) {
        let countTag = document.createElement('span');
        countTag.innerText = heldItem.count;
        countTag.style.position = 'absolute';
        countTag.style.bottom = '-5px';
        countTag.style.right = '0px';
        countTag.style.color = 'white';
        countTag.style.fontSize = '18px';
        countTag.style.fontWeight = 'bold';
        countTag.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000';
        floater.appendChild(countTag);
    }
}


// --- DIBUJAR LA MOCHILA DEL JUGADOR (27 SLOTS) ---
function renderPlayerInventory() {
    const grid = document.getElementById('player-inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < 36; i++) {
        const slotDiv = document.createElement('div');
        slotDiv.style.width = '64px';
        slotDiv.style.height = '64px';
        slotDiv.style.background = '#8B8B8B';
        slotDiv.style.border = '4px inset #FFF';
        slotDiv.style.display = 'flex';
        slotDiv.style.justifyContent = 'center';
        slotDiv.style.alignItems = 'center';
        slotDiv.style.boxSizing = 'border-box';
        slotDiv.style.position = 'relative';
        slotDiv.style.cursor = 'pointer';

        const slotData = playerInventory[i];

        slotDiv.onclick = () => {
            if (heldItem) {
                let temp = slotData ? { type: slotData.type, states1: slotData.states1, count: slotData.count } : null;
                let newState = { type: heldItem.type, count: heldItem.count };
                if (heldItem.states1 !== undefined) newState.states1 = heldItem.states1;
                
                playerInventory[i] = newState;
                heldItem = temp; 
            } else {
                if (slotData && slotData.type) {
                    heldItem = { type: slotData.type, states1: slotData.states1, count: slotData.count || 1 };
                    playerInventory[i] = null;
                }
            }
            updateFloatingItem();
            renderPlayerInventory(); 
        };

        slotDiv.onmouseenter = () => { slotDiv.style.background = '#A0A0A0'; };
        slotDiv.onmouseleave = () => { slotDiv.style.background = '#8B8B8B'; };

        if (slotData && slotData.type) {
            const cvs = document.createElement('canvas');
            cvs.width = 16; cvs.height = 16;
            cvs.style.width = '48px'; 
            cvs.style.height = '48px';
            cvs.style.imageRendering = 'pixelated';
            const ctx = cvs.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            let renderObj = typeof getBlockObject === 'function' ? getBlockObject(slotData) : null;
            if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
            }
            slotDiv.appendChild(cvs);

            if (slotData.count && slotData.count > 1) {
                let countTag = document.createElement('span');
                countTag.innerText = slotData.count;
                countTag.style.position = 'absolute';
                countTag.style.bottom = '-2px';
                countTag.style.right = '4px';
                countTag.style.color = 'white';
                countTag.style.fontSize = '14px';
                countTag.style.fontWeight = 'bold';
                countTag.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000';
                slotDiv.appendChild(countTag);
            }
        }
        grid.appendChild(slotDiv);
    }
}


// --- CREAR LA HOTBAR DENTRO DEL INVENTARIO ---
function renderModalHotbar() {
    let container = document.getElementById('modal-hotbar-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'modal-hotbar-container';
        const grid = document.getElementById('inventory-grid');
        if (grid && grid.parentNode) {
            grid.parentNode.insertBefore(container, grid.nextSibling);
        } else return;
    }
    
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(9, 64px)'; // Cambiado a 64px
    container.style.gap = '0px';
    container.style.padding = '10px 10px 10px 10px';
    container.style.justifyContent = 'center';

    if (typeof hotbar === 'undefined' || !hotbar.slots) return;

    hotbar.slots.forEach((slot, index) => {
        const slotDiv = document.createElement('div');
        // --- TAMAÑO DEL SLOT: 64px ---
        slotDiv.style.width = '64px';
        slotDiv.style.height = '64px';
        slotDiv.style.background = '#8B8B8B';
        slotDiv.style.border = '4px inset #FFF';
        slotDiv.style.display = 'flex';
        slotDiv.style.justifyContent = 'center';
        slotDiv.style.alignItems = 'center';
        slotDiv.style.boxSizing = 'border-box';
        slotDiv.style.position = 'relative';
        slotDiv.style.cursor = 'pointer';

        slotDiv.onclick = () => {
            if (heldItem) {
                let newState = { type: heldItem.type };
                if (heldItem.states1 !== undefined) newState.states1 = heldItem.states1;
                if (heldItem.count > 1) newState.count = heldItem.count;

                hotbar.slots[index] = newState;
                heldItem = null; 
                
                updateFloatingItem();
                renderModalHotbar(); 
                if(typeof renderHotbarUI === 'function') renderHotbarUI(); 
            } else {
                if (slot && slot.type) {
                    heldItem = { type: slot.type, states1: slot.states1, count: slot.count || 1 };
                    hotbar.slots[index] = { type: null }; 
                    
                    updateFloatingItem();
                    renderModalHotbar();
                    if(typeof renderHotbarUI === 'function') renderHotbarUI();
                }
            }
        };
        
        slotDiv.onmouseenter = () => { slotDiv.style.background = '#A0A0A0'; };
        slotDiv.onmouseleave = () => { slotDiv.style.background = '#8B8B8B'; };

        if (slot && slot.type) {
            const cvs = document.createElement('canvas');
            cvs.width = 16; cvs.height = 16;
            // --- TAMAÑO DEL ÍTEM (CANVAS): 48px ---
            cvs.style.width = '48px'; 
            cvs.style.height = '48px';
            cvs.style.imageRendering = 'pixelated';
            const ctx = cvs.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            let renderObj = typeof getBlockObject === 'function' ? getBlockObject(slot) : null;
            if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
            }
            slotDiv.appendChild(cvs);

            if (slot.count && slot.count > 1) {
                let countTag = document.createElement('span');
                countTag.innerText = slot.count;
                countTag.style.position = 'absolute';
                countTag.style.bottom = '-2px';
                countTag.style.right = '4px';
                countTag.style.color = 'white';
                countTag.style.fontSize = '14px';
                countTag.style.fontWeight = 'bold';
                countTag.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000';
                slotDiv.appendChild(countTag);
            }
        }

        container.appendChild(slotDiv);
    });
}

function renderHotbarUI() {
    const container = document.getElementById('hotbar-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (typeof hotbar === 'undefined') return;

    hotbar.slots.forEach((slot, index) => {
        const slotDiv = document.createElement('div');
        slotDiv.className = `hotbar-slot ${index === slotIndex ? 'active' : ''}`;
        slotDiv.onclick = () => {
            slotIndex = index;
            updateHotbarSelection();
        };
        
        const cvs = document.createElement('canvas');
        cvs.width = 24;
        cvs.height = 24;
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        let renderObj = null;
        if (typeof getBlockObject === 'function') {
             renderObj = getBlockObject(slot);
        }
        
        if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
            ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 24, 24);
        }
        
        slotDiv.appendChild(cvs);
        container.appendChild(slotDiv);
    });
}

function updateHotbarSelection() {
    const slots = document.querySelectorAll('.hotbar-slot');
    slots.forEach((s, i) => {
        if (i === slotIndex) s.classList.add('active');
        else s.classList.remove('active');
    });
}

// ==========================================
// 🆕 LÓGICA DE MUNDO (HARDCORE)
// ==========================================

// Al elegir Creative, Adventure o Spectator se marca solita la casilla de comandos ("Cheats" en el archivo del mundo).
// Survival no la toca (ni la marca ni la desmarca). Cargar un mundo NO pasa por aquí: el mundo conserva lo que traía.
function onGamemodeChange(value) {
    if (value === '1' || value === '2' || value === '3') {
        const cheatsCheckbox = document.getElementById('cheats');
        if (cheatsCheckbox && !cheatsCheckbox.disabled) cheatsCheckbox.checked = true;
    }
}

function toggleHardcore(isHardcore) {
    const gmSelect = document.getElementById('gamemode');
    const cheatsCheckbox = document.getElementById('cheats');
    
    if (isHardcore) {
        gmSelect.value = "0"; 
        gmSelect.disabled = true; 
        
        if(cheatsCheckbox) cheatsCheckbox.checked = false;
        
    } else {
        gmSelect.disabled = false;
    }
}


// ==========================================
// 🎁 CREADOR DE COFRES (CHEST BUILDER)
// ==========================================

function openCreateChestModal() {
    isBuildingChest = true;
    isCreatingCustomItem = false;
    
    customChestInventory = new Array(27).fill(null); 
    
    const modal = document.getElementById('inventory-modal');
    const modalContent = modal.querySelector('.modal-content'); 
    const chestPanel = document.getElementById('chest-builder-panel');
    const customPanel = document.getElementById('custom-item-builder-panel');
    const title = document.getElementById('inventory-modal-title');
    
    if (typeof playerInvReset === 'function') playerInvReset();
    modal.style.display = 'block';
    
    if (modalContent) modalContent.style.width = '1190px';
    
    if (title) title.innerText = "Create Loot Chest";
    
    // Si antes se abrió "Create Custom Item" y se cerró, su panel se quedaba abierto y se mezclaba con el del cofre:
    // aquí se apaga siempre (igual que openCustomItemsModal apaga el del cofre).
    if (customPanel) customPanel.style.display = 'none';
    if (chestPanel) chestPanel.style.display = 'block'; 
    
    const nameInput = document.getElementById('custom-chest-name');
    if (nameInput) nameInput.value = 'Loot Chest';

    if (typeof renderInventoryTabs === 'function') renderInventoryTabs(); 
    if (typeof populateInventory === 'function') populateInventory();
    if (typeof renderChestBuilder === 'function') renderChestBuilder(); 
    if (typeof renderModalHotbar === 'function') renderModalHotbar(); 
}

function renderChestBuilder() {
    const grid = document.getElementById('chest-builder-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    for (let i = 0; i < 27; i++) {
        const slotDiv = document.createElement('div');
        // --- TAMAÑO DEL SLOT: 64px ---
        slotDiv.style.width = '64px';
        slotDiv.style.height = '64px';
        slotDiv.style.minWidth = '64px';
        slotDiv.style.minHeight = '64px';
        slotDiv.style.flexShrink = '0';
        slotDiv.style.background = '#8B8B8B';
        slotDiv.style.border = '4px inset #FFF';
        slotDiv.style.display = 'flex';
        slotDiv.style.justifyContent = 'center';
        slotDiv.style.alignItems = 'center';
        slotDiv.style.boxSizing = 'border-box';
        slotDiv.style.position = 'relative';
        slotDiv.style.cursor = 'pointer';

        const slotData = customChestInventory[i];

slotDiv.onclick = () => {
            if (heldItem) {
                // SALVAMOS EL NBT (LA MAGIA) AL INTERCAMBIAR
                let temp = slotData ? { type: slotData.type, states1: slotData.states1, count: slotData.count, nbt: slotData.nbt } : null;
                let newState = { type: heldItem.type, count: heldItem.count };
                if (heldItem.states1 !== undefined) newState.states1 = heldItem.states1;
                if (heldItem.nbt !== undefined) newState.nbt = heldItem.nbt; // <- AQUI GUARDAMOS LA MAGIA
                
                customChestInventory[i] = newState;
                heldItem = temp; 
            } else {
                if (slotData && slotData.type) {
                    heldItem = { type: slotData.type, states1: slotData.states1, count: slotData.count || 1, nbt: slotData.nbt };
                    customChestInventory[i] = null;
                }
            }
            updateFloatingItem();
            renderChestBuilder(); 
        };

        slotDiv.onmouseenter = () => { slotDiv.style.background = '#A0A0A0'; };
        slotDiv.onmouseleave = () => { slotDiv.style.background = '#8B8B8B'; };

        if (slotData && slotData.type) {
            const cvs = document.createElement('canvas');
            cvs.width = 16; cvs.height = 16;
            // --- TAMAÑO DEL ÍTEM (CANVAS): 48px ---
            cvs.style.width = '48px'; 
            cvs.style.height = '48px';
            cvs.style.imageRendering = 'pixelated';
            const ctx = cvs.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            let renderObj = typeof getBlockObject === 'function' ? getBlockObject(slotData) : null;
            if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
            }
            slotDiv.appendChild(cvs);

            if (slotData.count && slotData.count > 1) {
                let countTag = document.createElement('span');
                countTag.innerText = slotData.count;
                countTag.style.position = 'absolute';
                countTag.style.bottom = '-2px';
                countTag.style.right = '4px';
                countTag.style.color = 'white';
                countTag.style.fontSize = '14px';
                countTag.style.fontWeight = 'bold';
                countTag.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000';
                slotDiv.appendChild(countTag);
            }
        }
        grid.appendChild(slotDiv);
    }
}

async function saveCustomChest() {
    const titleInput = document.getElementById('custom-chest-name');
    let title = titleInput ? titleInput.value.trim() : 'Loot Chest';
    if (!title) title = 'Custom Chest';

// Convertimos el inventario del Creador al formato interno que usa Mine Blocks
    const formattedInventory = customChestInventory.map(item => {
        if (!item) return 0; // 0 significa slot vacío
        
        // RECUPERAMOS EL NBT Y LO AGREGAMOS AL ARRAY FINAL (INDICE 3)
        let nbtData = item.nbt ? item.nbt : {}; 
        
        return [item.type, item.count || 1, item.states1 || 0, nbtData];
    });

    // Creamos la "Estructura" de un solo bloque (El cofre)
    const chestData = [
        {
            dx: 0, dy: 0,
            state: {
                type: "chest",
                chests: formattedInventory
            }
        }
    ];

    const newStruct = {
        title: title,
        author: "Anonymous",
        category: "saved",
        subcategory: "Chests",
        data: chestData,
        timestamp: Date.now()
    };

    // 1. Guardar en Base de Datos Real
    if (typeof dbManager !== 'undefined') {
        await dbManager.save(newStruct);
    }
    
    // 2. Guardar en Memoria RAM
    if (typeof structureDB !== 'undefined') {
        structureDB.push(newStruct);
    }

    // 3. Cerramos el Inventario
    toggleInventory();

    // 4. Abrimos el menú de Estructuras y lo mandamos a la pestaña correcta
    if (typeof openStructuresModal === 'function') openStructuresModal();
    if (typeof filterStructures === 'function') {
        filterStructures('saved', 'Chests');
    }
}

document.getElementById('console-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const command = this.value.trim();
        const historyDiv = document.getElementById('console-history');
        
        // 1. COMANDO NORMAL: TELETRANSPORTE
        if (command.startsWith('/tp ')) {
            const parts = command.split(' ');
            const targetX = Number(parts[1] ? parts[1] : '0');
            const targetY = Number(parts[2] ? parts[2] : '0');
            
            if (!isNaN(targetX) && !isNaN(targetY)) {
                camera.x = targetX;
                camera.y = targetY;
                worldDirty = true; 
            }
            
            const msgNode = document.createElement('div');
            msgNode.className = 'console-msg';
            msgNode.innerText = `[INFO] WHOOSH! Teleported to [X: ${targetX}, Y: ${targetY}].`;
            historyDiv.appendChild(msgNode);
            
            this.value = '';
            setTimeout(() => { msgNode.classList.add('fade-out'); }, 6000);
            return;
        }

        // Si el comando no existe
        this.value = '';
    }
});

// --- DICCIONARIO Y FORMATEO GLOBAL DE ENCANTAMIENTOS ---
// La lista real (nombres, niveles máximos y claves que guarda el juego) vive en scripts/enchants.js.
// Aquí queda { clave: "Sharpness IV" } con TODAS las combinaciones, que usan la pestaña Enchanted Books y los tooltips.
const enchantTranslations = mbwEnchTable();

// Función auxiliar para formatear el texto
function formatEnchantments(enchantmentsObj) {
    if (!enchantmentsObj) return "";
    let enchantText = "";
    for (let key in enchantmentsObj) {
        if (enchantmentsObj[key] === "enchant") {
            let niceName = (typeof mbwEnchLabel === 'function') ? mbwEnchLabel(key) : (enchantTranslations[key] || key); 
            // Aquí agregamos line-height: 1.1 y margin: 0 para que queden pegaditos
            enchantText += `<span class="tooltip-enchant" style="color: #FFFF; display: block; line-height: 0.6; margin-top: 2px;">${niceName}</span>`;
        }
    }
    return enchantText;
}


// ==========================================
// 📂 MULTI-DOCUMENT TABS (Photoshop Style)
// ==========================================

const WorldTabsManager = {
    openWorlds: [],
    activeWorldId: null,

    // Inicializa la primera pestaña usando el mundo que ya está cargado al abrir el editor
    init: function() {
        if (this.openWorlds.length === 0) {
            this.addWorld("world.mbw", true, true); // El 'true' final indica que tome la RAM actual
        }
    },

    // Agrega una nueva pestaña
    // useCurrentMemory: Si es true, copia lo que hay actualmente en pantalla. Si es false, crea un mundo vacío.
    addWorld: function(filename, isActive = true, useCurrentMemory = false) {
        const newId = 'world_' + Date.now() + Math.floor(Math.random() * 1000); // ID único
        
        const newWorld = {
            id: newId,
            filename: filename,
            mbwomData: null,
            cameraData: null,
            historyData: null
        };

        // Si estamos abriendo el editor por primera vez, capturamos el estado base
        if (useCurrentMemory) {
            newWorld.mbwomData = this.cloneData(mbwom);
            if (typeof camera !== 'undefined') {
                newWorld.cameraData = { x: camera.x, y: camera.y, zoom: camera.zoom || 2 };
            }
            if (typeof historyManager !== 'undefined') {
                newWorld.historyData = { undoStack: [...historyManager.undoStack], redoStack: [...historyManager.redoStack] };
            }
        }

        this.openWorlds.push(newWorld);
        
        if (isActive) {
            this.switchWorld(newId);
        } else {
            this.renderTabs();
        }
    },

// Cambia de pestaña
    switchWorld: function(id) {
        if (this.activeWorldId === id) return; // Si ya estamos en esta pestaña, no hacemos nada

        // 1. GUARDAR: Capturamos la pantalla actual antes de irnos
        if (this.activeWorldId) {
            this.saveCurrentWorldStateToMemory(this.activeWorldId);
        }

        this.activeWorldId = id;
        
        // 2. CARGAR: Traemos los datos de la pestaña a la que vamos
        this.loadWorldStateFromMemory(id);

        // --- 🛠️ FIX DEL CLON VISUAL ---
        // La "foto" del lienzo tiene que ser la de ESTA pestaña. Si la pestaña ya tenía su foto armada y sigue siendo
        // válida (salió exactamente del mismo mapa que ahora está cargado), la reutilizamos al instante;
        // si no (pestaña nueva, o algo cambió), se arma de nuevo como siempre.
        const tabWorld = this.openWorlds.find(w => w.id === id);
        const saved = tabWorld && tabWorld.cacheData;
        const reusable = saved && saved.cache && window.worldCacheSource
            && window.worldCacheSource.get(saved.cache) === mbwom.scene && saved.scene === mbwom.scene;
        if (reusable) {
            window.worldCache = saved.cache;
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        } else if (typeof initializeWorldCache === 'function') {
            initializeWorldCache();
        }
        
        // 3. Actualizamos la interfaz (el nombre de archivo en la barra superior)
        const world = this.openWorlds.find(w => w.id === id);
        if (world) {
            const display = document.getElementById('filename-display');
            if (display) display.value = world.filename.replace('.mbw', '');
        }

        this.renderTabs();
        if (typeof window.syncDimensionIcon === 'function') window.syncDimensionIcon();
        if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh();   // la mini hotbar del jugador es de cada mundo
        
        // 4. Forzar al motor gráfico a redibujar el lienzo
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    },

    // ==========================================
    // LÓGICA DE MEMORIA RAM (SAVE / LOAD)
    // ==========================================

saveCurrentWorldStateToMemory: function(id) {
        const world = this.openWorlds.find(w => w.id === id);
        if (!world) return;

        // ✨ FIX: Sincronizar el lienzo antes de cambiar de pestaña 
        // para que el Auto-Save no guarde mapas obsoletos en el fondo
        let currentScene = (typeof mbwom.currentScene !== 'undefined') ? mbwom.currentScene : 1;
        if (typeof mbwom !== 'undefined' && mbwom.sceneList && mbwom.world) {
            mbwom.sceneList.forEach(key => {
                if (mbwom[key] !== undefined) {
                    mbwom.world[key + currentScene] = mbwom[key];
                }
            });
        }

        // Guardamos los datos del mundo de esta pestaña.
        // ANTES se hacía una copia profunda (JSON) de todo el mundo al cambiar de pestaña: con un mundo de
        // 14 MB eso congelaba el editor ~2 segundos CADA vez. AHORA solo se guardan "referencias": cada pestaña
        // tiene sus propios datos y ninguna otra los comparte, así que no hace falta copiarlos. Es instantáneo.
        const snapshot = {};
        Object.keys(mbwom).forEach(key => {
            if (typeof mbwom[key] !== 'function') snapshot[key] = mbwom[key];
        });
        world.mbwomData = snapshot;

        // Guardamos también la "foto" ya dibujada del mapa para no tener que armarla otra vez al volver
        world.cacheData = { cache: window.worldCache, scene: mbwom.scene };
        
        // Guardamos la posición de la cámara
        if (typeof camera !== 'undefined') {
            world.cameraData = { x: camera.x, y: camera.y, zoom: camera.zoom };
        }
        
        // Guardamos el historial (deshacer / rehacer)
        if (typeof historyManager !== 'undefined') {
            world.historyData = {
                undoStack: historyManager.undoStack,
                redoStack: historyManager.redoStack
            };
        }
    },
    
    loadWorldStateFromMemory: function(id) {
        const world = this.openWorlds.find(w => w.id === id);
        if (!world) return;

        if (world.mbwomData) {
            // Restauramos los datos del mundo en la variable global mbwom (sin copiarlos: ver saveCurrentWorldStateToMemory)
            for (let key in world.mbwomData) {
                // Solo sobreescribimos los datos, no las funciones de mbwom
                if (typeof mbwom[key] !== 'function') {
                    mbwom[key] = world.mbwomData[key];
                }
            }
            // Una pestaña que nunca cambió de dimensión está en el Overworld; no heredar la dimensión de la pestaña anterior
            if (!('currentScene' in world.mbwomData)) mbwom.currentScene = 1;
        } else {
            // Si no tiene datos guardados, significa que es una pestaña nueva/vacía
            this.resetGlobalWorldState();
            // Ya no se copian los mundos al cambiar de pestaña, así que la pestaña nueva NO puede seguir
            // compartiendo el objeto "world" de la anterior (escribir ahí dañaría el mundo de la otra pestaña).
            mbwom.world = this.freshWorldShell(mbwom.world);
        }

        // Restauramos la cámara
        if (world.cameraData && typeof camera !== 'undefined') {
            camera.x = world.cameraData.x;
            camera.y = world.cameraData.y;
            if (world.cameraData.zoom !== undefined) camera.zoom = world.cameraData.zoom;
        } else if (typeof camera !== 'undefined') {
            camera.x = 0; camera.y = 0;
        }
        if (typeof camera !== 'undefined') { camera.velX = 0; camera.velY = 0; }   // la cámara fluida no arrastra velocidad de la otra pestaña

        // Restauramos el historial
        if (world.historyData && typeof historyManager !== 'undefined') {
            historyManager.undoStack = world.historyData.undoStack;
            historyManager.redoStack = world.historyData.redoStack;
        } else if (typeof historyManager !== 'undefined') {
            historyManager.undoStack = [];
            historyManager.redoStack = [];
        }
    },

    // Limpia el lienzo para una pestaña nueva
    resetGlobalWorldState: function() {
        if (typeof mbwom !== 'undefined' && mbwom.sceneList) {
            mbwom.sceneList.forEach(key => {
                if (Array.isArray(mbwom[key])) mbwom[key] = [];
                else if (typeof mbwom[key] === 'object' && mbwom[key] !== null) mbwom[key] = {};
                else if (typeof mbwom[key] === 'number') mbwom[key] = 0;
            });
        }
        // Seguros adicionales
        if (typeof mbwom !== 'undefined') {
            mbwom.scene = [];
            mbwom.states = {};
            mbwom.chests = {};
        }
    },


    // Copia de un "world" SIN los datos pesados de los mapas (scene1, states2, mobs3...): solo los ajustes pequeños
    // (logros, inventario, versión, reglas...). Sirve para que una pestaña nueva tenga su propio "world".
    freshWorldShell: function(oldWorld) {
        if (!oldWorld || typeof oldWorld !== 'object') return oldWorld;
        const names = (typeof mbwom !== 'undefined' && mbwom.sceneList ? mbwom.sceneList : []).concat(['sceneBG']);
        const heavy = new RegExp('^(?:' + names.join('|') + ')\\d+$');
        const shell = {};
        Object.keys(oldWorld).forEach(k => { if (!heavy.test(k)) shell[k] = oldWorld[k]; });
        return this.cloneData(shell);
    },

    // Herramienta maestra para hacer copias profundas sin ataduras de referencias
    cloneData: function(data) {
        if (data === undefined) return undefined;
        // Al convertir a texto y luego a JSON rompemos cualquier vínculo de memoria (Deep Clone)
        return JSON.parse(JSON.stringify(data));
    },

    // ==========================================
    // LÓGICA VISUAL (CERRAR Y RENDERIZAR)
    // ==========================================

    closeWorld: function(id, event) {
        event.stopPropagation(); // Evita que al dar clic en la X se seleccione la pestaña accidentalmente

        const index = this.openWorlds.findIndex(w => w.id === id);
        if (index === -1) return;

        if (this.openWorlds.length === 1) {
            // Es la última pestaña: se cierra DE VERDAD (antes solo se borraban los mobs y el mapa seguía a la vista)
            this.closeLastWorld();
            return;
        }

        // Eliminamos el mundo de la RAM
        this.openWorlds.splice(index, 1);

        // Si cerramos la pestaña que estábamos viendo, saltamos a la de al lado
        if (this.activeWorldId === id) {
            const nextIndex = index > 0 ? index - 1 : 0;
            this.switchWorld(this.openWorlds[nextIndex].id);
        } else {
            this.renderTabs();
        }
    },

    // Cierra la última pestaña y deja el editor igual que cuando se abre por primera vez: SIN mundo.
    // Se borran el mapa, los mobs, el jugador, la "foto" dibujada, el historial y la selección.
    closeLastWorld: function() {
        this.openWorlds = [];
        this.activeWorldId = null;

        // 1. Fuera todos los datos del mundo (se dejan solo las funciones y la lista de nombres, como al arrancar)
        Object.keys(mbwom).forEach(key => {
            if (typeof mbwom[key] !== 'function' && key !== 'sceneList') delete mbwom[key];
        });
        mbwom.currentScene = 1;

        // 2. Fuera la "foto" del mapa y lo que dependía de él
        if (typeof initializeWorldCache === 'function') initializeWorldCache();   // sin mapa deja la foto vacía y cancela cualquier armado en curso
        window.fileInfo = { version: "", seed: "", author: "" };
        window.cheats = false;
        window.defeatedEnder = false;
        if (typeof selectedMob !== 'undefined') { selectedMob = null; selectedMobKey = null; }
        if (typeof draggedMob !== 'undefined') { draggedMob = null; isDraggingMob = false; }
        if (typeof toggleMobInfo === 'function') { try { toggleMobInfo(false); } catch (e) { /* el panel no estaba */ } }

        // 3. Cámara e historial desde cero
        if (typeof camera !== 'undefined') { camera.x = 0; camera.y = 0; camera.accX = 0; camera.accY = 0; camera.velX = 0; camera.velY = 0; camera.lastMoveTime = null; }
        if (typeof historyManager !== 'undefined') {
            historyManager.undoStack = [];
            historyManager.redoStack = [];
            if (typeof historyManager.updateButtonsUI === 'function') historyManager.updateButtonsUI();
        }

        // 4. Interfaz: nombre del archivo, pestañas, minihotbar del jugador, ícono de dimensión
        const display = document.getElementById('filename-display');
        if (display) display.value = 'world';
        const sideName = document.getElementById('sidebar-world-name');
        if (sideName) sideName.value = 'world';
        this.renderTabs();
        if (typeof window.syncDimensionIcon === 'function') window.syncDimensionIcon();
        if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh();
        if (typeof populateWorldInfo === 'function') { try { populateWorldInfo(); } catch (e) { /* panel cerrado */ } }
        if (typeof worldDirty !== 'undefined') worldDirty = true;

        // 5. Como al arrancar: se ofrece el menú File para abrir otro mundo
        if (typeof openFileMenu === 'function') openFileMenu();
    },

    renderTabs: function() {
        const container = document.getElementById('world-tabs');
        if (!container) return;
        
        container.innerHTML = '';

        this.openWorlds.forEach(world => {
            const tab = document.createElement('div');
            tab.className = `world-tab ${world.id === this.activeWorldId ? 'active' : ''}`;
            tab.onclick = () => this.switchWorld(world.id);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'world-tab-name';
            nameSpan.innerText = world.filename;
            nameSpan.title = world.filename; 

            const closeBtn = document.createElement('span');
            closeBtn.className = 'world-tab-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = (e) => this.closeWorld(world.id, e);

            tab.appendChild(nameSpan);
            tab.appendChild(closeBtn);
            container.appendChild(tab);
        });
    }
};

// Inicializamos las pestañas cuando cargue la página
window.addEventListener('DOMContentLoaded', () => {
    WorldTabsManager.init();
});


// ========================================================
// --- SISTEMA DE TOOLTIPS FLOTANTES GLOBALES (CORREGIDO Y UNIFICADO) ---
// ========================================================

// 1. INYECTAMOS EL CSS DEL TOOLTIP PERFECTO DENTRO DEL SCRIPT (A PRUEBA DE FALLAS)
//    He copiado y pulido el estilo morado de Minecraft para que se enrolle bien sobre el texto
//    y no se desconecte ni se corte.
const enchantedTooltipStyle = document.createElement('style');
enchantedTooltipStyle.innerHTML = `
    /* Ocultamos los tooltips viejos por si quedara alguno in-line */
    .enchant-slot .enchant-tooltip, .inv-item .enchant-tooltip {
        display: none !important; 
    }

    /* Estilo Definido para el Tooltip Maestro Flotante */
    .master-enchant-tooltip {
        position: fixed;
        z-index: 9999999 !important; /* Por encima de TODO */
        background-color: rgba(0, 34, 85, 0.95) !important; /* Fondo oscuro y sutil */
        border: 2px solid #0055ff !important; /* Borde morado oscuro */
        border-image: linear-gradient(to bottom, #2e0066, #160033) 1; /* Efecto de degradado en el borde */
        color: #ffffff !important; /* Texto gris claro por defecto */
        font-family: 'Pixeltype', sans-serif !important; /* Tu fuente pixel art */
        font-size: 22px !important;
        padding: 6px 10px !important;
        pointer-events: none; /* No interfiere con los clics */
        white-space: nowrap; /* Evita que el texto se parta en varias líneas */
        width: fit-content; /* Se ajusta exactamente al texto */
        box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5); /* Sombra nítida estilo Minecraft */
        display: none; /* Oculto por defecto */
    }

    /* Estilo para el título dorado dentro del tooltip */
    .master-enchant-tooltip strong {
        color: #ffffff !important; /* Dorado/Amarillo Minecraft */
        font-size: 26px !important; /* <--- AQUÍ LE DAS EL TAMAÑO AL NOMBRE DEL ÍTEM */
        display: block;
        margin-bottom: 0px;
    }
`;
document.head.appendChild(enchantedTooltipStyle);

// 2. Creamos el Tooltip Maestro único que flotará libremente
const masterTooltip = document.createElement('div');
masterTooltip.className = 'master-enchant-tooltip'; // Le asignamos la clase que acabamos de definir
document.body.appendChild(masterTooltip);

let lastHoveredSlot = null;

// 3. Lógica para seguir al ratón y actualizar el contenido dinámicamente
document.addEventListener('mousemove', (e) => {
    // Buscamos si el ratón está sobre un slot encantado
    let slot = e.target.closest('.enchanted-slot, .pinv-tip');   // pinv-tip: tooltips del inventario del jugador (sin brillo morado)
    
    if (slot) {
        // Si cambiamos de slot, actualizamos el contenido
        if (slot !== lastHoveredSlot) {
            // LEEMOS LA MAGIA DESDE EL DATASET (El atributo invisible data-enchant-tooltip)
            // Ya no buscamos tooltips in-line dentro del contenedor de la cuadrícula
            let tooltipHTML = slot.dataset.enchantTooltip;
            if (tooltipHTML) {
                masterTooltip.innerHTML = tooltipHTML;
            } else {
                masterTooltip.innerHTML = "";
            }
            lastHoveredSlot = slot;
        }
        // Mostramos el tooltip y lo posicionamos cerca del puntero
        masterTooltip.style.display = 'block';
        masterTooltip.style.left = (e.clientX + 15) + 'px';
        
        // Ajuste inteligente: si el tooltip es muy alto, lo movemos hacia arriba 
        // para que no se corte por abajo de la pantalla
        let tooltipHeight = masterTooltip.offsetHeight;
        if (e.clientY + tooltipHeight + 20 > window.innerHeight) {
            masterTooltip.style.top = (e.clientY - tooltipHeight - 10) + 'px';
        } else {
            masterTooltip.style.top = (e.clientY + 15) + 'px';
        }
    } else {
        // Si no estamos sobre un slot encantado, ocultamos el tooltip maestro
        masterTooltip.style.display = 'none';
        lastHoveredSlot = null;
    }
});

// ==========================================
// 📰 NOTICIAS (News / Updates)
// ==========================================
// El sistema de notas de actualización ya no vive aquí:
//   • scripts/news-data.js  -> las notas (es el ÚNICO archivo que hay que editar para agregar una nota)
//   • scripts/news.js       -> el código que lee esas notas y las muestra (lista, detalle, galería, brillo de "no leído")

// ==========================================
// 🌧️⚡ SISTEMA DE CLIMA COMPLETO (Lluvia, Zoom y Tormenta)
// ==========================================
const weatherCanvas = document.getElementById('weather-canvas');
const wCtx = weatherCanvas ? weatherCanvas.getContext('2d') : null;

// Variables principales
let rainDrops = [];
let isRaining = false;
let isThunder = false;
let flashSequence = [];

// 1. Ajusta el tamaño de la capa de lluvia
function resizeWeatherCanvas() {
    const workspace = document.getElementById('workspace');
    if (workspace && weatherCanvas) {
        weatherCanvas.width = workspace.clientWidth;
        weatherCanvas.height = workspace.clientHeight;
    }
}

// 2. Crea las propiedades de una gota de lluvia
function createDrop() {
    return {
        x: Math.random() * (weatherCanvas.width + 200),
        y: Math.random() * -100,
        speed: 15 + Math.random() * 10,  
        length: 10 + Math.random() * 10, 
        thickness: 0.5 + Math.random()     
    };
}

// Bucle de animación (AHORA RESPETA EL APAGADOR MAESTRO)
function animateWeather() {
    if (!wCtx) return;

    // 1. Siempre limpiamos el canvas en cada frame
    wCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);

    // ✨ 2. LA LLAVE MAESTRA: Solo dibuja si hay clima Y la animación está permitida
    if (isRaining && allowWeatherAnimation) {
        
        // --- APLICAR ZOOM ---
        const zoomSlider = document.getElementById('zoom-slider');
        let zoomScale = 1; 
        if (zoomSlider) {
            let val = parseInt(zoomSlider.value);
            if (val === 0) zoomScale = 0.1;       // 10%
            else if (val === 1) zoomScale = 0.25; // 25%
            else if (val === 2) zoomScale = 0.5;  // 50%
            else if (val === 3) zoomScale = 1;    // 100%
            else if (val === 4) zoomScale = 1.5;  // 150%
            else if (val === 5) zoomScale = 2;    // 200%
            else if (val === 6) zoomScale = 2.5;  // 250%
            else if (val === 7) zoomScale = 3;    // 300%
        }

        // --- DIBUJAR LLUVIA ---
        wCtx.strokeStyle = 'rgba(150, 170, 255, 0.6)';
        wCtx.lineCap = 'round';
        wCtx.beginPath();

        for (let i = 0; i < rainDrops.length; i++) {
            let p = rainDrops[i];
            
            wCtx.lineWidth = p.thickness * zoomScale;
            wCtx.moveTo(p.x, p.y);
            wCtx.lineTo(p.x - (p.speed / 4) * zoomScale, p.y + (p.length * zoomScale)); 
            
            p.y += p.speed;
            p.x -= (p.speed / 4);

            if (p.y > weatherCanvas.height || p.x < 0) {
                rainDrops[i] = createDrop();
                rainDrops[i].y = -20;
            }
        }
        wCtx.stroke();

        // --- DIBUJAR RELÁMPAGOS ---
        if (isThunder) {
            const mainCanvas = document.getElementById('canvas');

            if (flashSequence.length === 0 && Math.random() < 0.005) {
                const patterns = [
                    [0.8, 0.8, 0.0, 0.0, 0.6, 0.6, 0.0, 0.0, 0.0, 0.3, 0.3], 
                    [0.5, 0.5, 0.0, 0.9, 0.9, 0.2, 0.2, 0.0, 0.0, 0.4, 0.4], 
                    [0.9, 0.9, 0.7, 0.7, 0.0, 0.0, 0.5, 0.5, 0.0]            
                ];
                flashSequence = patterns[Math.floor(Math.random() * patterns.length)].slice();
            }

            if (flashSequence.length > 0) {
                let opacity = flashSequence.shift(); 
                
                if (mainCanvas) mainCanvas.style.transition = 'none';

                if (opacity > 0) {
                    wCtx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.15})`; 
                    wCtx.fillRect(0, 0, weatherCanvas.width, weatherCanvas.height);
                    
                    if (mainCanvas) mainCanvas.style.filter = `brightness(${0.66 + (opacity * 0.33)}) saturate(0.9)`;
                } else {
                    if (mainCanvas) mainCanvas.style.filter = '';
                }
            } else {
                if (mainCanvas) {
                    mainCanvas.style.transition = '';
                    mainCanvas.style.filter = '';
                }
            }
        }
    }

    requestAnimationFrame(animateWeather);
}

// 4. Inicializar el canvas al abrir el programa
if (weatherCanvas) {
    window.addEventListener('resize', resizeWeatherCanvas);
    resizeWeatherCanvas();
    animateWeather();
}

// Función que "prende" y "apaga" el clima desde el menú
function setWeatherEffect(weatherType) {
    const mainCanvas = document.getElementById('canvas'); 

    // Siempre limpiamos los filtros anteriores al cambiar de opción
    if (mainCanvas) {
        mainCanvas.classList.remove('canvas-raining', 'canvas-thunder');
    }

    if (weatherType === 'rain' || weatherType === 'thunder') {
        if (!isRaining) {
            isRaining = true;
            rainDrops = [];
            for(let i = 0; i < 150; i++) {
                rainDrops.push(createDrop());
            }
            resizeWeatherCanvas();
        }
        
        // ✨ LA REGLA DE ORO: Solo oscurece la pantalla si la opción está activada
        if (mainCanvas && allowWeatherAnimation) {
            if (weatherType === 'thunder') {
                mainCanvas.classList.add('canvas-thunder'); 
            } else {
                mainCanvas.classList.add('canvas-raining'); 
            }
        }
        
        // Determinar si hay relámpagos
        isThunder = (weatherType === 'thunder');
        if (!isThunder) flashSequence = [];
        
    } else {
        // Limpiar todo si seleccionan "Clear"
        isRaining = false; 
        isThunder = false; 
        flashSequence = [];
    }
}

// 6. Conectar el HTML con el sistema
const weatherSelect = document.getElementById('gr-weather');
if (weatherSelect) {
    weatherSelect.onchange = (e) => setWeatherEffect(e.target.value);
}


let allowWeatherAnimation = true; 

// Función que apaga o prende TODOS los efectos del clima
function toggleWeatherAnimation(isChecked) {
    allowWeatherAnimation = isChecked;
    const mainCanvas = document.getElementById('canvas');
    const weatherSelect = document.getElementById('gr-weather');
    const weatherType = weatherSelect ? weatherSelect.value : 'clear';
    
    if (!isChecked) {
        // APAGAR TODO: Limpiamos la pantalla, cancelamos relámpagos y quitamos CSS
        if (wCtx) wCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);
        flashSequence = []; 
        
        if (mainCanvas) {
            mainCanvas.style.transition = '';
            mainCanvas.style.filter = '';
            mainCanvas.classList.remove('canvas-raining', 'canvas-thunder');
        }
    } else {
        // PRENDER: Si la activan de nuevo, restauramos el filtro si había un clima seleccionado
        if (mainCanvas) {
            if (weatherType === 'thunder') {
                mainCanvas.classList.add('canvas-thunder');
            } else if (weatherType === 'rain') {
                mainCanvas.classList.add('canvas-raining');
            }
        }
    }
}


// ==========================================
// 🌍 WORLD INFO & METADATA SYNC
// ==========================================

// 1. Sincronizar el nombre en todas partes
// 1. Sincronizar el nombre en todas partes
window.updateFilename = function(newName) {
    // A) Actualizar el input de la barra superior (Top bar)
    const topInput = document.getElementById('filename-display');
    if (topInput && topInput.value !== newName) {
        topInput.value = newName;
    }
    
    // B) Actualizar el input del panel lateral
    const sidebarInput = document.getElementById('sidebar-world-name');
    if (sidebarInput && sidebarInput.value !== newName) {
        sidebarInput.value = newName;
    }
    
    // ✨ C) EL FIX: Actualizar la memoria del sistema de pestañas y MULTIJUGADOR
    if (typeof WorldTabsManager !== 'undefined' && WorldTabsManager.activeWorldId) {
        const activeWorld = WorldTabsManager.openWorlds.find(w => w.id === WorldTabsManager.activeWorldId);
        if (activeWorld) {
            
            // ✨ AVISAMOS A FIREBASE CÓMO SE LLAMA NUESTRO MUNDO AHORA
            if (typeof myPresenceRef !== 'undefined' && myPresenceRef) {
                myPresenceRef.update({ worldName: newName });
            }

            // Guardamos el nuevo nombre en la memoria, asegurando que tenga su extensión .mbw
            let safeName = newName.trim();
            if (!safeName.toLowerCase().endsWith('.mbw')) {
                safeName += '.mbw';
            }
            activeWorld.filename = safeName;
            WorldTabsManager.renderTabs();
        }
    }
};

// 2. Editar la Semilla (Seed) en tiempo real
function updateSeed(newSeed) {
    if (typeof fileInfo !== 'undefined' && fileInfo !== null) {
        fileInfo.seed = newSeed;
    }
}

// 3. Abrir/Cerrar el panel de World Info y Empujar el Zoom
function toggleWorldInfo() {
    const sidebar = document.getElementById('world-info-sidebar');
    const zoomControl = document.getElementById('zoom-floating'); 
    const btn = document.getElementById('btn-world-info'); // ✨ Buscamos el botón

    if (!sidebar) return;
    
    if (sidebar.style.display === 'none' || sidebar.style.display === '') {
        sidebar.style.display = 'flex';
        
        if (zoomControl) zoomControl.style.right = '270px'; 
        if (btn) btn.classList.add('active'); // ✨ Le ponemos tu clase .active
        
        populateWorldInfo(); 
    } else {
        sidebar.style.display = 'none';
        
        if (zoomControl) zoomControl.style.right = '20px'; 
        if (btn) btn.classList.remove('active'); // ✨ Le quitamos tu clase .active
    }
}

// 4. Buscar y Llenar los datos del mundo en el Sidebar
function populateWorldInfo() {
    // Sincronizar el nombre inicial
    const topInput = document.getElementById('filename-display');
    const sidebarInput = document.getElementById('sidebar-world-name');
    if (topInput && sidebarInput) {
        sidebarInput.value = topInput.value;
    }
    
    // Leer Versión y Seed desde fileInfo (La estructura que vimos en tu archivo)
    const versionInput = document.getElementById('sidebar-world-version');
    const seedInput = document.getElementById('sidebar-world-seed');
    
    if (typeof fileInfo !== 'undefined' && fileInfo !== null) {
        if (versionInput) versionInput.value = fileInfo.version || "Unknown";
        if (seedInput) seedInput.value = fileInfo.seed || "";
    } else {
        if (versionInput) versionInput.value = "No file loaded";
        if (seedInput) seedInput.value = "";
    }
    
    // Buscar si los Cheats están activados
    const cheatsDisplay = document.getElementById('sidebar-world-cheats');
    if (cheatsDisplay) {
        let areCheatsOn = false;
        if (typeof cheats !== 'undefined') {
            areCheatsOn = cheats; // Toma la variable global
        } else {
            const cheatsCheckbox = document.getElementById('cheats');
            if (cheatsCheckbox) areCheatsOn = cheatsCheckbox.checked; // Fallback al checkbox
        }
        cheatsDisplay.textContent = areCheatsOn ? "Yes" : "No";
        cheatsDisplay.style.color = areCheatsOn ? "#2E7D32" : "#C0392B"; // Verde o Rojo
    }
    
    // Buscar si el Enderdragon está derrotado
    const enderDisplay = document.getElementById('sidebar-world-ender');
    if (enderDisplay) {
        let isDefeated = false;
        if (typeof defeatedEnder !== 'undefined') {
            isDefeated = defeatedEnder;
        }
        enderDisplay.textContent = isDefeated ? "Yes" : "No";
        enderDisplay.style.color = isDefeated ? "#2E7D32" : "#C0392B";
    }
    
    // ==========================================
    // ✨ CALCULAR Y MOSTRAR EL PESO COMPRIMIDO (EXPORTADO)
    // ==========================================
    const sizeSpan = document.getElementById('world-info-size');
    if (sizeSpan && typeof fileManager !== 'undefined') {
        
        // Si no hay mundo creado, es desconocido
        const infoPanel = document.getElementById('world-info-sidebar');
        const panelOpen = !!infoPanel && infoPanel.style.display === 'flex';
        if (!mbwom || !mbwom.world) {
            sizeSpan.innerText = "Unknown";
        } else if (!panelOpen) {
            // Con el panel cerrado no se calcula: era lo más pesado de abrir un mundo grande (1.5 s) y nadie lo estaba viendo.
            // Se calcula en cuanto se abre el panel (toggleWorldInfo vuelve a llamar a esta función).
            sizeSpan.innerText = "-";
        } else {
            // Ponemos un texto temporal mientras calcula (porque comprimir toma unos ms)
            sizeSpan.innerText = "Calculating...";
            
            // Usamos setTimeout para no congelar la UI si el mundo es muy grande
            setTimeout(() => {
                // Si mientras tanto se cerró el panel, no hace falta calcularlo
                const stillOpen = document.getElementById('world-info-sidebar');
                if (!stillOpen || stillOpen.style.display !== 'flex') { sizeSpan.innerText = "-"; return; }
                try {
                    // Preparamos los datos tal cual se harían para exportar
                    let currentScene = (typeof mbwom.currentScene !== 'undefined') ? mbwom.currentScene : 1;
                    if (mbwom.sceneList) {
                        mbwom.sceneList.forEach(key => {
                            if (mbwom[key] !== undefined) mbwom.world[key + currentScene] = mbwom[key];
                        });
                    }
                    
                    // Comprimimos a string usando tu algoritmo base
                    const jsonString = JSON.stringify(mbwom.world);
                    const encodedText = mbwAlgorithm.encode(jsonString);
                    
                    // Calculamos el peso en bytes creando un Blob fantasma
                    const bytes = new Blob([encodedText]).size;
                    
                    let sizeText = bytes + " B";
                    if (bytes >= 1048576) {
                        sizeText = (bytes / 1048576).toFixed(2) + " MB";
                    } else if (bytes >= 1024) {
                        sizeText = (bytes / 1024).toFixed(2) + " KB";
                    }
                    
                    sizeSpan.innerText = sizeText;
                } catch (e) {
                    console.error("Error calculating world size:", e);
                    sizeSpan.innerText = "Error";
                }
            }, 10);
        }
    }

    // ==========================================
    // ✨ FIX: LLAMAR A LA FUNCIÓN DE COORDENADAS
    // ==========================================
    if (typeof populateLocationSettings === 'function') {
        populateLocationSettings();
    }
}


// ==========================================
// ✨ COMPROBADOR DE MUNDO ACTIVO (Habilita/Deshabilita World Info)
// ==========================================
setInterval(() => {
    const infoBtn = document.getElementById('btn-world-info');
    const sidebar = document.getElementById('world-info-sidebar');
    
    // ✨ FIX: Un mundo es válido si el objeto mbwom.world existe y tiene datos (no es un objeto vacío {})
    const hasWorld = (typeof mbwom !== 'undefined' && mbwom.world && Object.keys(mbwom.world).length > 0);
    
    if (hasWorld) {
        // MODO: MUNDO ABIERTO
        if (infoBtn) {
            infoBtn.disabled = false;
            infoBtn.style.opacity = '1';
            infoBtn.style.cursor = 'pointer';
        }
    } else {
        // MODO: SIN MUNDO
        if (infoBtn) {
            infoBtn.disabled = true;
            infoBtn.style.opacity = '0.5';
            infoBtn.style.cursor = 'not-allowed';
        }
        // Ocultar la barra lateral si la tenías abierta y cerraste el mundo
        if (sidebar && sidebar.style.display === 'flex') {
            toggleWorldInfo();
        }
    }
}, 500);


const potionDatabase = {
    'potion_empty': { type: 'potion', nbt: { type: 'empty', effects: null } },
    'potion_water': { type: 'potion', nbt: { type: 'water', effects: null } },
    'potion_healing': { type: 'potion', nbt: { type: 'healing', effects: [{level: 1, type: 'instanthealth'}] } },
    'potion_harming': { type: 'potion', nbt: { type: 'harming', effects: [{level: 1, type: 'instantdamage'}] } },
    'potion_swiftness': { type: 'potion', nbt: { type: 'swiftness', effects: [{level: 1, duration: 180, type: 'speed'}] } },
    'potion_slowness': { type: 'potion', nbt: { type: 'slowness', effects: [{level: 1, duration: 90, type: 'slowness'}] } },
    'potion_poison': { type: 'potion', nbt: { type: 'poison', effects: [{level: 1, duration: 45, type: 'poison'}] } },
    'potion_regeneration': { type: 'potion', nbt: { type: 'regeneration', effects: [{level: 1, duration: 45, type: 'regeneration'}] } },
    'potion_strength': { type: 'potion', nbt: { type: 'strength', effects: [{level: 1, duration: 180, type: 'strength'}] } },
    'potion_weakness': { type: 'potion', nbt: { type: 'weakness', effects: [{level: 1, duration: 90, type: 'weakness'}] } },
    'potion_fireresistance': { type: 'potion', nbt: { type: 'fireresistance', effects: [{level: 1, duration: 180, type: 'fireresistance'}] } },
    'potion_waterbreathing': { type: 'potion', nbt: { type: 'waterbreathing', effects: [{level: 1, duration: 180, type: 'waterbreathing'}] } },
    'potion_leaping': { type: 'potion', nbt: { type: 'leaping', effects: [{level: 1, duration: 180, type: 'jumpboost'}] } },
    'potion_invisibility': { type: 'potion', nbt: { type: 'invisibility', effects: [{level: 1, duration: 180, type: 'invisibility'}] } },
    'potion_nightvision': { type: 'potion', nbt: { type: 'nightvision', effects: [{level: 1, duration: 180, type: 'nightvision'}] } },
    
    // Splash Potions (Arrojadizas)
    'splash_potion_healing': { type: 'potion', nbt: { category: 'splash', type: 'healing', effects: [{level: 1, type: 'instanthealth'}] } },
    'splash_potion_harming': { type: 'potion', nbt: { category: 'splash', type: 'harming', effects: [{level: 1, type: 'instantdamage'}] } },
    'splash_potion_swiftness': { type: 'potion', nbt: { category: 'splash', type: 'swiftness', effects: [{level: 1, duration: 180, type: 'speed'}] } },
    'splash_potion_slowness': { type: 'potion', nbt: { category: 'splash', type: 'slowness', effects: [{level: 1, duration: 90, type: 'slowness'}] } },
    'splash_potion_poison': { type: 'potion', nbt: { category: 'splash', type: 'poison', effects: [{level: 1, duration: 45, type: 'poison'}] } },
    'splash_potion_regeneration': { type: 'potion', nbt: { category: 'splash', type: 'regeneration', effects: [{level: 1, duration: 45, type: 'regeneration'}] } },
    'splash_potion_strength': { type: 'potion', nbt: { category: 'splash', type: 'strength', effects: [{level: 1, duration: 180, type: 'strength'}] } },
    'splash_potion_weakness': { type: 'potion', nbt: { category: 'splash', type: 'weakness', effects: [{level: 1, duration: 90, type: 'weakness'}] } }
};


// ==========================================
// ✨ SISTEMA DE QUICK ACCESS: MOBS
// ==========================================

// Lista inicial por defecto
let recentMobsList = ['zombie', 'skeleton', 'creeper']; 

// Lista de todos los mobs soportados
const ALL_MOBS_DB = [
    "zombie", "skeleton", "creeper", "spider", "slime", "pig", "cow", "cowctus", "mushroom", "chicken", "sheep",
    "zombiepigman", "ghast", "blaze", "magmacube", "nethereye", "enderman", "enderdragon", "snowgolem", "bat", "rabbit", "squid",
    "wolf", "dog"
];

// 1. Dibuja los botones en el menú superior (Estilo Estructuras)
function renderRecentMobs() {
    const container = document.getElementById('recent-mobs-ribbon'); 
    if (!container) return;

    if (recentMobsList.length === 0) {
        container.innerHTML = '<span style="font-size: 10px; color: #555;">Empty</span>';
        return;
    }

    let html = '';
    
    recentMobsList.forEach(mob => {
        let niceName = mob.charAt(0).toUpperCase() + mob.slice(1);
        
        // Buscamos la imagen (He notado que tienes algunas en assets/mobs/)
        let imgSrc = (window.images && window.images[mob] && window.images[mob].src) 
                     ? window.images[mob].src 
                     : `assets/mobs/${mob}.png`; 

        // Usamos la misma clase que ya tienes para las estructuras!
        html += `
        <button class="quick-struct-btn" onclick="selectMobToSpawn('${mob}')" title="Spawn ${niceName}">
            <img src="${imgSrc}" alt="${niceName}" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;" onerror="this.onerror=null; this.src='assets/mobs/${mob}.png'">
        </button>
        `;
    });

    container.innerHTML = html;
}

// 2. Al seleccionar un mob, lo pasa al frente de la lista y activa la herramienta
// 'spec' (opcional) = los datos personalizados del panel del Mob Browser (nombre, vida, armadura...).
// Con 'spec', cada clic en el mundo crea un mob con esos datos (ver applyMobSpec en mob-editor.js).
// Sin 'spec' el mob sale tal cual su plantilla. Los mobs personalizados no entran a la lista de
// "recientes" de arriba (esa lista solo crea mobs normales); para reutilizarlos está la pestaña Custom.
function selectMobToSpawn(type, spec) {
    currentMobToSpawn = type;
    window.currentMobSpec = spec || null;
    currentTool = 'spawn_mob'; // Forzamos la herramienta

    if (!spec) {
        // Actualizamos la lista de recientes (Lo movemos al inicio)
        recentMobsList = recentMobsList.filter(m => m !== type);
        recentMobsList.unshift(type);

        // Si la lista supera los 3, borramos el más antiguo
        if (recentMobsList.length > 3) {
            recentMobsList.pop();
        }

        renderRecentMobs(); // Re-dibujamos el menú superior
    }
    
    // Cerramos el modal por si estaba abierto
    try { closeModal('mobs-modal'); closeModal('custom-mob-modal'); } catch(e){}
}

// 3. Abre la ventana modal y carga todos los mobs
// ==========================================
// ✨ LÓGICA DEL MOB BROWSER (CON PESTAÑAS)
// ==========================================

let currentlyPreviewedMob = null;
let activeMobTab = 'Overworld'; // Dimensión por defecto al abrir

// Base de datos rápida de vida para la previsualización (HP)
const MOBS_HP_DB = {
    "chicken": 4, "snowgolem": 4, "bat": 6, "rabbit": 3,
    "wolf": 8,
    "sheep": 8, "pig": 10, "cow": 10, "ghast": 20, "slime": 4, "magmacube": 4,
    "zombie": 20, "skeleton": 20, "creeper": 20, "spider": 20, "spawnskin": 20, "zombiepigman": 20, "blaze": 20, "nethereye": 20,
    "dog": 20,
    "enderman": 40, "enderdragon": 333
};

// Mobs organizados por dimensión
const MOBS_BY_DIMENSION = {
    "Animals": ["bat", "chicken", "pig", "cow", "cowctus", "mushroom", "rabbit", "sheep", "squid", "wolf", "dog"],
    "Overworld": ["creeper", "skeleton", "slime", "snowgolem", "spawnskin", "spider", "zombie"],
    "Nether": ["blaze", "ghast", "magmacube", "nethereye", "zombiepigman"],
    "End": ["enderman", "enderdragon"]
};

// ==========================================
// ✨ MOB BROWSER (ventana, pestañas, panel lateral y Custom)
// ==========================================
// Todo el código del Mob Browser (openMobModal, filterMobs, previewMob, spawnPreviewedMob)
// vive ahora en scripts/mob-editor.js. Aquí solo quedan los datos compartidos de arriba.

// Inicializamos la barra al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    // Si usas imágenes que cargan después, puedes meterle un ligero timeout para asegurar
    setTimeout(renderRecentMobs, 500); 
});


// ==========================================
// ✨ LIVE TIME + CLIMA + CULTIVOS (Random Ticks) ✨
// ==========================================
let liveTimeEngine = null;
let weatherEngine = null;
let weatherTimeout = null;
let cropEngine = null; // ✨ NUEVO: El motor de las plantas

function toggleLiveTime(checkbox) {
    if (checkbox.checked) {
        
        // --- 1. MOTOR DE TIEMPO (Escala 0-99) ---
        const velocidad = 1000; 

        liveTimeEngine = setInterval(() => {
            if (mbwom && mbwom.world && mbwom.world.tim !== undefined) {
                mbwom.world.tim = Number(mbwom.world.tim) + 1;

                if (mbwom.world.tim >= 100) {
                    mbwom.world.tim = 0; 
                    mbwom.world.day = Number(mbwom.world.day || 1) + 1; 
                    
                    const dayEl = document.getElementById("gr-day");
                    if (dayEl) dayEl.value = mbwom.world.day;
                }

                const timeEl = document.getElementById("gr-time");
                if (timeEl) timeEl.value = mbwom.world.tim;
            }
        }, velocidad);

        // --- 2. MOTOR DE CLIMA DINÁMICO ---
        const HORA_EN_MS = 60 * 60 * 1000; 

        weatherEngine = setInterval(() => {
            const weatherEl = document.getElementById("gr-weather");
            if (weatherEl && weatherEl.value === "clear") {
                if (Math.random() <= 0.20) {
                    let nuevoClima = Math.random() < 0.5 ? "rain" : "thunder";
                    weatherEl.value = nuevoClima;
                    weatherEl.dispatchEvent(new Event('change'));

                    const MIN_MS = 5 * 60 * 1000;
                    const MAX_MS = 10 * 60 * 1000;
                    const duracionTormenta = Math.floor(Math.random() * (MAX_MS - MIN_MS + 1)) + MIN_MS;

                    if (weatherTimeout) clearTimeout(weatherTimeout);
                    weatherTimeout = setTimeout(() => {
                        if (weatherEl.value !== "clear") {
                            weatherEl.value = "clear";
                            weatherEl.dispatchEvent(new Event('change'));
                        }
                    }, duracionTormenta);
                }
            }
        }, HORA_EN_MS);

        // --- 3. ✨ MOTOR DE CRECIMIENTO EXACTO (Sin Suerte) ✨ ---
        // Usamos la misma 'velocidad' que el Motor de Tiempo (ej. 1000ms)
        cropEngine = setInterval(() => {
            if (mbwom && mbwom.world && mbwom.world.blocks) {
                let cultivCrecio = false;
                const crops = ["nw", "seed", "carrot", "wseed", "pseed", "potato", "bseed"];

                // Escaneamos TODOS los bloques del mundo buscando cultivos
                for (let key in mbwom.world.blocks) {
                    const block = mbwom.world.blocks[key];
                    
                    if (block && crops.includes(block.type)) {
                        // 1. Aseguramos que la semilla tenga nivel inicial y su propio cronómetro
                        if (block.wheat === undefined || isNaN(block.wheat)) block.wheat = 1;
                        if (block.growthTimer === undefined) block.growthTimer = 0;

                        // 2. Si aún no llega al nivel 7 (máximo)
                        if (block.wheat < 7) {
                            // Le sumamos 1 unidad de tiempo a esta planta
                            block.growthTimer++;

                            // 3. Cuando junta 29 unidades de tiempo (Aprox 1.75 días en total para crecer por completo)
                            if (block.growthTimer >= 29) {
                                block.wheat++; // Sube a la siguiente fase (ej. _3 a _4)
                                block.growthTimer = 0; // Reinicia su cronómetro para la próxima fase
                                cultivCrecio = true;
                            }
                        }
                    }
                }

                // Si algún cultivo cambió de fase, repintamos el mapa
                if (cultivCrecio && typeof worldDirty !== 'undefined') {
                    worldDirty = true;
                }
            }
        }, 1000); // Se ejecuta al mismo ritmo que el reloj del juego
        
        console.log("⏱️ Live Time + Weather + Crops: ACTIVADOS");

    } else {
        // --- 4. APAGADO SEGURO ---
        if (liveTimeEngine) clearInterval(liveTimeEngine);
        if (weatherEngine) clearInterval(weatherEngine);
        if (weatherTimeout) clearTimeout(weatherTimeout);
        if (cropEngine) clearInterval(cropEngine); // ✨ Apagamos el motor de cultivos
        
        liveTimeEngine = null;
        weatherEngine = null;
        weatherTimeout = null;
        cropEngine = null;
        
        console.log("⏸️ Live Time: PAUSED");
    }
}


// ==========================================
// 📍 LÓGICA DE UBICACIÓN Y SPAWN POINT
// ==========================================

// Leer los datos del mundo y mostrarlos en los inputs
window.populateLocationSettings = function() {
    // ✨ FIX: Asegurarnos de buscar dentro de mbwom.world
    if (typeof mbwom === 'undefined' || !mbwom || !mbwom.world) return;
    
    const posX = document.getElementById('player-pos-x');
    const posY = document.getElementById('player-pos-y');
    const spawnX = document.getElementById('world-spawn-x');
    const spawnY = document.getElementById('world-spawn-y');

    // Redondeamos a 1 decimal para que no se vea feo (ej: 500.4 en vez de 500.456915)
    if (posX && mbwom.world.worldX !== undefined) posX.value = Math.round(mbwom.world.worldX * 10) / 10;
    // La Y del jugador se guarda "hacia abajo" (en el archivo es negativa: -40 = 40 bloques arriba del fondo), pero SOLO en pantalla se
    // muestra al revés (positiva), como las alturas de siempre. Lo que se guarda en el archivo no cambia: updatePlayerPos la voltea de vuelta.
    if (posY && mbwom.world.worldY !== undefined) posY.value = (Math.round(-mbwom.world.worldY * 10) / 10) || 0;

    // Spawn Point (Es un array [x, y])
    if (spawnX && mbwom.world.spawnPoint1) spawnX.value = Math.round(mbwom.world.spawnPoint1[0] * 10) / 10;
    if (spawnY && mbwom.world.spawnPoint1) spawnY.value = Math.round(mbwom.world.spawnPoint1[1] * 10) / 10;
};

// Guardar la nueva posición del jugador (Sin mover la cámara del editor)
window.updatePlayerPos = function(axis, value) {
    if (typeof mbwom === 'undefined' || !mbwom || !mbwom.world) return;
    const numValue = Number(value);
    
    if (axis === 'x') {
        mbwom.world.worldX = numValue;
    } else {
        // Lo que escribe la persona es la Y "de pantalla" (positiva); en el archivo va con el signo contrario (ver populateLocationSettings)
        mbwom.world.worldY = numValue ? -numValue : 0;
    }
    
    // Le decimos al editor que hay cambios por si necesitas redibujar el icono del jugador
    if (typeof worldDirty !== 'undefined') worldDirty = true; 
};

// ==========================================
// ✨ PANTALLA DE INICIO (FILE MENU VS EDITOR)
// ==========================================

// 1. Guardar la configuración cuando el usuario cambia el dropdown
window.updateStartupMenu = function(selectedValue) {
    localStorage.setItem('mbw_startup_screen', selectedValue);
};

// 2. Revisar la configuración apenas cargue la página
window.addEventListener('DOMContentLoaded', () => {
    // ✨ FIX: Cambiamos 'editor' por 'filemenu' como valor por defecto
    const startupPreference = localStorage.getItem('mbw_startup_screen') || 'filemenu';
    
    // Asignamos el valor al dropdown en la ventana de Configuración
    const startupSelect = document.getElementById('startup-screen-select');
    if (startupSelect) startupSelect.value = startupPreference;
    
    // Si eligió (o tiene por defecto) el File Menu, lo abrimos automáticamente
    if (startupPreference === 'filemenu' && typeof openFileMenu === 'function') {
        // Le damos un pequeñísimo respiro de 300ms para que la UI termine de cargar los estilos
        setTimeout(() => {
            openFileMenu();
        }, 300);
    }
});


// ==========================================
// ✨ MENÚ DESPLEGABLE DE EXPORTACIÓN
// ==========================================
window.toggleExportMenu = function() {
    document.getElementById("export-dropdown").classList.toggle("show");
};

window.closeExportMenu = function() {
    let dropdown = document.getElementById("export-dropdown");
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove("show");
    }
};

// Cerrar el menú si el usuario hace clic en cualquier otra parte de la pantalla
document.addEventListener('click', function(event) {
    if (!event.target.closest('#export-dropdown-container')) {
        if (typeof closeExportMenu === 'function') closeExportMenu();
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

    // ✨ 4. Si abrimos la pestaña de controles, dibujamos la lista de atajos
    if (tabId === 'controls' && typeof window.renderKeybinds === 'function') {
        window.renderKeybinds();
    }
};

// ==========================================
// ⌨️ SISTEMA DE ATAJOS DE TECLADO (KEYBINDS)
// ==========================================

const DEFAULT_KEYBINDS = {
    inventory: { key: 'e', label: '🎒 Open Inventory' },
    structures: { key: 'y', label: '🏘️ Open Structures' },
    mobs: { key: 'm', label: '🐷 Open Mobs Browser' },
    rotate: { key: 'r', label: '🔄 Rotate Block' },
    zen: { key: 'h', label: '🧘 Zen Mode' },
    brush_up: { key: '+', label: '🖌️ Brush Size +' },
    brush_down: { key: '-', label: '🖌️ Brush Size -' },
    delete: { key: 'delete', label: '💥 Delete Selection' },
    undo: { key: 'z', ctrl: true, label: '↶ Undo' },
    redo: { key: 'y', ctrl: true, label: '↷ Redo' },
    copy: { key: 'c', ctrl: true, label: '📄 Copy Selection' },
    cut: { key: 'x', ctrl: true, label: '✂️ Cut Selection' },
    paste: { key: 'v', ctrl: true, label: '📋 Paste' }
};

window.userKeybinds = (function() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('mbw_keybinds')); } catch (e) { saved = null; }
    if (!saved || typeof saved !== 'object') return JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
    // Ronda 9: Structures pasó de R a Y y apareció "Rotate" (R). Quien ya tenía atajos guardados no los pierde, pero:
    //   - si Structures seguía en la R de fábrica, pasa a la Y (si la había cambiado a otra tecla, se respeta)
    //   - se agregan los atajos nuevos que le falten
    let changed = false;
    if (saved.structures && saved.structures.key === 'r' && !saved.structures.ctrl && !localStorage.getItem('mbw_keybinds_v9')) {
        saved.structures.key = 'y'; changed = true;
    }
    for (const action in DEFAULT_KEYBINDS) {
        if (!saved[action]) { saved[action] = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS[action])); changed = true; }
    }
    try {
        localStorage.setItem('mbw_keybinds_v9', '1');
        if (changed) localStorage.setItem('mbw_keybinds', JSON.stringify(saved));
    } catch (e) {}
    return saved;
})();
let isWaitingForKey = null; 

// ✨ Esta es la función que te faltaba, la que dibuja la lista en la pantalla
window.renderKeybinds = function() {
    const container = document.getElementById('keybinds-list');
    if (!container) return;
    container.innerHTML = '';

    for (let action in window.userKeybinds) {
        const bind = window.userKeybinds[action];
        
        let displayKey = bind.key;
        if (displayKey === ' ') displayKey = 'Space';
        else if (displayKey && displayKey.length === 1) displayKey = displayKey.toUpperCase();
        
        if (bind.ctrl) displayKey = 'Ctrl + ' + displayKey;

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #A0A0A0; padding: 6px 12px; border: 2px solid #555; border-radius: 3px; margin-bottom: 4px;';

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
    window.renderKeybinds();
};

// ==========================================
// 🧠 DETECTOR PARA GUARDAR LA NUEVA TECLA
// ==========================================
window.addEventListener('keydown', function(e) {
    // Si dimos clic en el botón naranja y estamos esperando una tecla...
    if (isWaitingForKey) {
        e.preventDefault();
        // Ignoramos teclas de sistema para que no se guarde "Control" solo
        if (['control', 'shift', 'alt', 'meta', 'escape'].includes(e.key.toLowerCase())) return;
        // Esta tecla es solo para guardarla como atajo nuevo: que el resto del editor no la use también
        e.stopImmediatePropagation();

        window.userKeybinds[isWaitingForKey].key = e.key.toLowerCase();
        window.userKeybinds[isWaitingForKey].ctrl = e.ctrlKey; // Guarda si presionaste Ctrl al mismo tiempo
        
        localStorage.setItem('mbw_keybinds', JSON.stringify(window.userKeybinds));
        isWaitingForKey = null;
        window.renderKeybinds(); // Redibuja la lista al instante
    }
});

window.gridOpacity = 25; // Valor por defecto

window.changeGridOpacity = function(val) {
    window.gridOpacity = parseInt(val);
    document.getElementById('grid-opacity-display').innerText = val + '%';
    localStorage.setItem('mbw_grid_opacity', val);
    if (typeof worldDirty !== 'undefined') worldDirty = true;
};

// Cargar opacidad guardada cuando el editor arranca
window.addEventListener('DOMContentLoaded', () => {
    let savedOpacity = localStorage.getItem('mbw_grid_opacity');
    if (savedOpacity !== null) {
        window.gridOpacity = parseInt(savedOpacity);
        let slider = document.getElementById('grid-opacity-slider');
        let display = document.getElementById('grid-opacity-display');
        if (slider) slider.value = window.gridOpacity;
        if (display) display.innerText = window.gridOpacity + '%';
    }
});

// ==========================================
// 🛠️ CONFIGURACIÓN DE TOOLBAR
// ==========================================

const availableTools = [
    { id: 'tool-move', icon: '👆', name: 'Move Tool' },
    { id: 'tool-eraser', icon: '🧼', name: 'Eraser' },
    { id: 'tool-bucket', icon: '🪣', name: 'Bucket' },
    { id: 'tool-select', icon: '🔳', name: 'Select' },
    { id: 'tool-magic', icon: '🪄', name: 'Magic Wand' },
    { id: 'tool-lasso', icon: '➰', name: 'Lasso / Free Form' },
    { id: 'tool-screenshot', icon: '📷', name: 'Screenshot' },
];

window.toolbarConfig = {};

window.initToolbarSettings = function() {
    // Cargar config o crear una por defecto (todas encendidas)
    let saved = localStorage.getItem('mbw_toolbar_config');
    if (saved) {
        window.toolbarConfig = JSON.parse(saved);
    } else {
        availableTools.forEach(t => window.toolbarConfig[t.id] = true);
    }
    
    applyToolbarVisibility();
    renderToolbarSettingsList();
};

window.toggleToolVisibility = function(toolId, isVisible) {
    window.toolbarConfig[toolId] = isVisible;
    localStorage.setItem('mbw_toolbar_config', JSON.stringify(window.toolbarConfig));
    applyToolbarVisibility();
};

function applyToolbarVisibility() {
    availableTools.forEach(t => {
        let btn = document.getElementById(t.id);
        if (btn) {
            btn.style.display = window.toolbarConfig[t.id] ? 'inline-block' : 'none';
        }
    });
}

function renderToolbarSettingsList() {
    const list = document.getElementById('toolbar-visibility-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    availableTools.forEach(t => {
        let isChecked = window.toolbarConfig[t.id];
        
        let row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.5); padding: 8px; border-radius: 4px; border: 1px solid #999;';
        
        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">${t.icon}</span>
                <span style="font-weight: bold; color: #333;">${t.name}</span>
            </div>
            <label style="cursor: pointer; display: flex; align-items: center;">
                <input type="checkbox" onchange="toggleToolVisibility('${t.id}', this.checked)" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; margin: 0;">
            </label>
        `;
        list.appendChild(row);
    });
}

window.addEventListener('DOMContentLoaded', initToolbarSettings);


// (El medidor de FPS, la memoria, el zoom y la pantalla completa ahora viven en scripts/status-bar.js)
