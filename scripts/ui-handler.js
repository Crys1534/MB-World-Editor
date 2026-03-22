// --- CONFIGURACIÓN DE PESTAÑAS E INVENTARIO ---

let activeInventoryTab = 'all'; 

// =================================================================
// ⬇️ LISTA COMPLETA DE BLOQUES ⬇️
// =================================================================
const inventoryCategories = {
    // La pestaña "all" se llena automáticamente, no necesitas editar 'items' aquí.
    all: { icon: 'chest', items: [] }, 

// 🗡️ Ítems Creados
    Custom: { 
        icon: 'chest', 
        items: [] // Se llena por LocalStorage
    },
	
    // 🧱 Blocks
    Blocks: { 
        icon: 'bricks', 
        items: [
'br', 'dt', 'dt_1', 'farm', 'myc', 'gdt', 'cdt', 'r', 'cs',
'ms', 'sb', 'clore', 'in', 'gd', 'dmore', 'rs', 'os', 'lap',
'to', 'egem', 'wd1', 'wd_1', 'wd_2', 'wp', 'bbb', 'top', 'ib',
'gb', 'db', 'lapb', 'clb', 'sd', 'ss', 'cy1', 'bricks', 'books',
'b', 'j', 'snowblock', 'ice', 'fice', 'fice_1', 'fice_2', 'fice_3', 'fice_4', 'gv',
'cloth_white', 'cloth_lightgray', 'cloth_gray', 'cloth_black', 'cloth_brown', 'cloth_purple', 'cloth_magenta', 'cloth_red', 'cloth_orange',
'cloth_pink', 'cloth_yellow', 'cloth_lightgreen', 'cloth_green', 'cloth_cyan', 'cloth_lightblue', 'cloth_blue', 'cloth_rainbow', 'gs',
'gs_white', 'gs_lightgray', 'gs_gray', 'gs_black', 'gs_brown', 'gs_purple', 'gs_magenta', 'gs_redg', 'gs_orange',
'gs_pink', 'gs_yellow', 'gs_lightgreen', 'gs_green', 'gs_cyan', 'gs_lightblue', 'gs_blue', 'bddt', 'bdr',
'bdcs', 'bdbbb', 'bdbricks', 'bdbooks', 'bdsb', 'bdcloth_white', 'bdcloth_lightgray', 'bdcloth_gray', 'bdcloth_black',
'bdcloth_brown', 'bdcloth_purple', 'bdcloth_magenta', 'bdcloth_red', 'bdcloth_orange', 'bdcloth_pink', 'bdcloth_yellow', 'bdcloth_lightgreen', 'bdcloth_green',
'bdcloth_cyan', 'bdcloth_lightblue', 'bdcloth_blue', 'bdcloth_rainbow', 'bdgs', 'bdgs_white', 'bdgs_lightgray', 'bdgs_gray', 'bdgs_black',
'bdgs_brown', 'bdgs_purple', 'bdgs_magenta', 'bdwp', 'bdgs_redg', 'bdgs_orange', 'bdgs_pink', 'bdgs_yellow', 'bdgs_lightgreen',
'bdgs_green', 'bdgs_cyan', 'bdgs_lightblue', 'bdgs_blue', 'pk', 'pk_2', 'pk_3', 'pk_4', 'pk_5', 'pk_6', 'pk_7', 'pk_8', 'pk_9', 'pk_10', 'pk_11', 'hai_1',
        ]
    },

    // 🌿 Decoration
    Decoration: { 
        icon: 'shrub', 
        items: [
            'craft', 'oven', 'chest', 'echest', 'cmp', 'enchant', 'anvil', 'ntag', 'bed1_red', 'dr2', 'idr2', 'bdr2', 'td1', 'sign', 'sl', 'lv', 'lv1', 'lv2', 'lv3', 'lv4', 'st', 'ladder', 'fnc', 'fncg', 'nfnc', 'nfncg', 'ibar', 'th_1',
        ]
    },
	
    // 🌿 Transportation
    Transportation: { 
        icon: 'rail', 
        items: [
            'rail', 'rail_1', 'rail_2', 'railp', 'railp_1', 'railp_2', 'raila', 'raila_1', 'raila_2', 'raild', 'raild_1', 'raild_2',
        ]
    },

    // 🌿 Tools
    Tools: { 
        icon: 'DiamondPickaxe', 
        items: [
            'WoodenPickaxe', 'StonePickaxe', 'IronPickaxe', 'GoldPickaxe', 'DiamondPickaxe', 'ObsidianPickaxe',
            'WoodenSword', 'StoneSword', 'IronSword', 'GoldSword', 'DiamondSword',
            'WoodenAxe', 'StoneAxe', 'IronAxe', 'GoldAxe', 'DiamondAxe',
            'WoodenShovel', 'StoneShovel', 'IronShovel', 'GoldShovel', 'DiamondShovel',
            'WoodenHoe', 'StoneHoe', 'IronHoe', 'GoldHoe', 'DiamondHoe'
        ]
    },
    
    // 🌿 Armor
    Armor: { // Corregido el nombre de la categoría (antes decía Tools de nuevo)
        icon: 'DiamondShirt', 
        items: [
            'LeatherCap', 'LeatherShirt', 'LeatherPants', 'LeatherShoes', 'IronCap', 'IronShirt', 'IronPants', 'IronShoes', 'GoldCap', 
            'GoldShirt', 'GoldPants', 'GoldShoes', 'DiamondCap', 'DiamondShirt', 'DiamondPants', 'DiamondShoes', 'DragonCap', 'DragonShirt', 
            'DragonPants', 'DragonShoes','SnowCap', 'AfroCap', 'PartyCap', 'ShadesCap', 'MustacheCap',
        ]
    },
};

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
}

// --- GESTIÓN DE MODALES ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
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
    body.classList.remove('theme-white', 'theme-pastel', 'theme-darkblue', 'theme-winxp');
    if (themeName !== 'dark') {
        body.classList.add('theme-' + themeName);
    }
    localStorage.setItem('mbw_theme', themeName);
    const select = document.getElementById('theme-select');
    if (select) select.value = themeName;
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('mbw_theme') || 'dark';
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


function toggleInventory() {
    const modal = document.getElementById('inventory-modal');
    const chestPanel = document.getElementById('chest-builder-panel');
    const title = document.getElementById('inventory-modal-title');

    if (modal.style.display === 'block') {
        modal.style.display = 'none';
        heldItem = null; 
        updateFloatingItem();
        isBuildingChest = false; 
    } else {
        modal.style.display = 'block';
        
        if (title) title.innerText = "Inventory";
        if (chestPanel) chestPanel.style.display = 'none'; 

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

    // --- LÓGICA ESPECIAL PARA PESTAÑA CUSTOM ---
    if (activeInventoryTab === 'Custom') {
        let savedCustomItems = JSON.parse(localStorage.getItem('mbw_custom_items')) || [];
        
        savedCustomItems.forEach((customItemData, index) => {
            let itemID = customItemData[0];
            let itemCount = customItemData[1];
            let itemDamage = customItemData[2];
            let enchantments = customItemData[3];

            const item = document.createElement('div');
            item.className = 'inv-item';
            item.title = String(itemID).replace(/([A-Z])/g, ' $1').trim() + " (Custom)";
            
            // Lógica de Recogida (Soporta NBT)
            item.onclick = () => {
                heldItem = { type: itemID, count: itemCount, states1: itemDamage, nbt: enchantments };
                updateFloatingItem();
            };

            // Eliminar con Clic Derecho
            item.oncontextmenu = (e) => {
                e.preventDefault();
                savedCustomItems.splice(index, 1);
                localStorage.setItem('mbw_custom_items', JSON.stringify(savedCustomItems));
                populateInventory(); // Recargar
            };

            item.style.width = '64px'; item.style.height = '64px';
            item.style.minWidth = '64px'; item.style.minHeight = '64px';
            item.style.flexShrink = '0';
            item.style.background = '#8B8B8B'; item.style.border = '4px inset #FFF'; 
            item.style.display = 'flex'; item.style.justifyContent = 'center';
            item.style.alignItems = 'center'; item.style.boxSizing = 'border-box';
            item.style.cursor = 'pointer'; item.style.position = 'relative';

            let isEnchanted = enchantments && Object.keys(enchantments).length > 0;
            if (isEnchanted) item.classList.add('enchanted-slot');

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

            // Inyectar Tooltip Global
            if (isEnchanted) {
                let tooltipDiv = document.createElement('div');
                tooltipDiv.className = 'enchant-tooltip';
                let itemNameStr = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                let enchantTooltipHTML = formatEnchantments(enchantments);
                tooltipDiv.innerHTML = `<strong>${itemNameStr}</strong>${enchantTooltipHTML}`;
                item.appendChild(tooltipDiv);
            }

            item.onmouseenter = () => { item.style.background = '#A0A0A0'; };
            item.onmouseleave = () => { item.style.background = '#8B8B8B'; };

            grid.appendChild(item);
        });
        
        return; // Detenemos la función para que no cargue bloques normales
    }
    // ---------------------------------------------

    const allBlocks = (typeof window.blockData !== 'undefined') ? Object.keys(window.blockData) : [];
    let blocksToShow = [];

    if (activeInventoryTab === 'all') {
        blocksToShow = allBlocks;
    } else {
        const categoryItems = inventoryCategories[activeInventoryTab].items;
        blocksToShow = categoryItems.filter(item => allBlocks.includes(item));
    }

    blocksToShow.forEach(blockType => {
        const item = document.createElement('div');
        item.className = 'inv-item';
        item.title = blockType; 
        
        item.onclick = () => pickupItemFromInventory(blockType);
        
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
    const items = document.querySelectorAll('.inv-item');
    query = query.toLowerCase();
    items.forEach(item => {
        const name = item.title.toLowerCase();
        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
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

    let tempState = { type: heldItem.type };
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

    // --- AQUÍ AÑADIMOS TU BOTÓN EXACTO AL FINAL DE LA HOTBAR ---
    const invBtn = document.createElement('button');
    invBtn.className = 'ribbon-btn-small';
    invBtn.onclick = toggleInventory;
    invBtn.title = "Open Inventory (E)";
    
    // Usé tu estilo exacto. Solo cambié el "height" a 34px para que coincida 
    // con la altura de los slots de tu hotbar, pero si lo quieres más alto ponle 66px.
    invBtn.style.cssText = "margin-left: 2px; height: 34px; width: 20px; background: #999; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px outset #FFF; box-sizing: border-box;";
    invBtn.innerHTML = '<span style="font-size:14px; font-weight: bold; color: #333;">»</span>';
    
    container.appendChild(invBtn);
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
    customChestInventory = new Array(27).fill(null); 
    
    const modal = document.getElementById('inventory-modal');
    const chestPanel = document.getElementById('chest-builder-panel');
    const title = document.getElementById('inventory-modal-title');
    
    modal.style.display = 'block';
    
    if (title) title.innerText = "Create Loot Chest";
    if (chestPanel) chestPanel.style.display = 'block'; 
    
    const nameInput = document.getElementById('custom-chest-name');
    if (nameInput) nameInput.value = 'Loot Chest';

    renderInventoryTabs(); 
    populateInventory();
    renderChestBuilder(); 
    renderModalHotbar(); 
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
                let temp = slotData ? { type: slotData.type, states1: slotData.states1, count: slotData.count } : null;
                let newState = { type: heldItem.type, count: heldItem.count };
                if (heldItem.states1 !== undefined) newState.states1 = heldItem.states1;
                
                customChestInventory[i] = newState;
                heldItem = temp; 
            } else {
                if (slotData && slotData.type) {
                    heldItem = { type: slotData.type, states1: slotData.states1, count: slotData.count || 1 };
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
        return [item.type, item.count || 1, item.states1 || 0];
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
        
        if (command.startsWith('/tp ')) {
            const parts = command.split(' ');
            const x = parts[1] ? parts[1] : '0';
            const y = parts[2] ? parts[2] : '0';
            
            // --- NUEVO: LÓGICA REAL DE TELETRANSPORTE ---
            const targetX = Number(x);
            const targetY = Number(y);
            
            if (!isNaN(targetX) && !isNaN(targetY)) {
                camera.x = targetX;
                camera.y = targetY;
                worldDirty = true; // Obliga al editor a redibujar el mapa en la nueva zona
            }
            // ---------------------------------------------
            
            // Crear el mensaje visual
            const historyDiv = document.getElementById('console-history');
            const msgNode = document.createElement('div');
            msgNode.className = 'console-msg';
            msgNode.innerText = `[INFO] WHOOSH! Teleported to [X: ${x}, Y: ${y}].`;
            
            // Añadirlo a la pantalla
            historyDiv.appendChild(msgNode);
            
            // Limpiar el input
            this.value = '';
            
            // Hacer que desaparezca en 6 segundos (6000 ms)
            setTimeout(() => {
                msgNode.classList.add('fade-out');
            }, 6000);
        }
    }
});



// --- DICCIONARIO Y FORMATEO GLOBAL DE ENCANTAMIENTOS ---
const enchantTranslations = {
    // Generales
    "unbreaking1": "Unbreaking I", "unbreaking2": "Unbreaking II", "unbreaking3": "Unbreaking III",
    "mending1": "Mending",

    // Herramientas y Armas
    "sharpness1": "Sharpness I", "sharpness2": "Sharpness II", "sharpness3": "Sharpness III", "sharpness4": "Sharpness IV", "sharpness5": "Sharpness V",
    "smite1": "Smite I", "smite2": "Smite II", "smite3": "Smite III", "smite4": "Smite IV", "smite5": "Smite V",
    "baneofarthropods1": "Bane of Arthropods I", "baneofarthropods2": "Bane of Arthropods II", "baneofarthropods3": "Bane of Arthropods III", "baneofarthropods4": "Bane of Arthropods IV", "baneofarthropods5": "Bane of Arthropods V",
    "knockback1": "Knockback I", "knockback2": "Knockback II",
    "fireaspect1": "Fire Aspect I", "fireaspect2": "Fire Aspect II",
    "looting1": "Looting I", "looting2": "Looting II", "looting3": "Looting III",
    "efficiency1": "Efficiency I", "efficiency2": "Efficiency II", "efficiency3": "Efficiency III", "efficiency4": "Efficiency IV", "efficiency5": "Efficiency V",
    "silktouch1": "Silk Touch",
    "fortune1": "Fortune I", "fortune2": "Fortune II", "fortune3": "Fortune III",
    
    // Arcos
    "power1": "Power I", "power2": "Power II", "power3": "Power III", "power4": "Power IV", "power5": "Power V",
    "punch1": "Punch I", "punch2": "Punch II",
    "flame1": "Flame",
    "infinity1": "Infinity",
    
    // Armadura
    "protection1": "Protection I", "protection2": "Protection II", "protection3": "Protection III", "protection4": "Protection IV",
    "fireprotection1": "Fire Protection I", "fireprotection2": "Fire Protection II", "fireprotection3": "Fire Protection III", "fireprotection4": "Fire Protection IV",
    "featherfalling1": "Feather Falling I", "featherfalling2": "Feather Falling II", "featherfalling3": "Feather Falling III", "featherfalling4": "Feather Falling IV",
    "blastprotection1": "Blast Protection I", "blastprotection2": "Blast Protection II", "blastprotection3": "Blast Protection III", "blastprotection4": "Blast Protection IV",
    "projectileprotection1": "Projectile Protection I", "projectileprotection2": "Projectile Protection II", "projectileprotection3": "Projectile Protection III", "projectileprotection4": "Projectile Protection IV",
    "respiration1": "Respiration I", "respiration2": "Respiration II", "respiration3": "Respiration III",
    "aquaaffinity1": "Aqua Affinity",
    "thorns1": "Thorns I", "thorns2": "Thorns II", "thorns3": "Thorns III"
};

// Función auxiliar para formatear el texto
function formatEnchantments(enchantmentsObj) {
    if (!enchantmentsObj) return "";
    let enchantText = "";
    for (let key in enchantmentsObj) {
        if (enchantmentsObj[key] === "enchant") {
            let niceName = enchantTranslations[key] || key; 
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
        // Reconstruimos la "foto" del lienzo basada en los datos recién cargados
        if (typeof initializeWorldCache === 'function') {
            initializeWorldCache();
        }
        
        // 3. Actualizamos la interfaz (el nombre de archivo en la barra superior)
        const world = this.openWorlds.find(w => w.id === id);
        if (world) {
            const display = document.getElementById('filename-display');
            if (display) display.value = world.filename.replace('.mbw', '');
        }

        this.renderTabs();
        
        // 4. Forzar al motor gráfico a redibujar el lienzo
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    },

    // ==========================================
    // LÓGICA DE MEMORIA RAM (SAVE / LOAD)
    // ==========================================

    saveCurrentWorldStateToMemory: function(id) {
        const world = this.openWorlds.find(w => w.id === id);
        if (!world) return;

        // Clonamos las variables del mundo de Mine Blocks
        world.mbwomData = this.cloneData(mbwom);
        
        // Clonamos la posición de la cámara
        if (typeof camera !== 'undefined') {
            world.cameraData = { x: camera.x, y: camera.y, zoom: camera.zoom };
        }
        
        // Clonamos el historial (Para no perder los Ctrl+Z de esta pestaña)
        if (typeof historyManager !== 'undefined') {
            world.historyData = {
                undoStack: this.cloneData(historyManager.undoStack),
                redoStack: this.cloneData(historyManager.redoStack)
            };
        }
    },

    loadWorldStateFromMemory: function(id) {
        const world = this.openWorlds.find(w => w.id === id);
        if (!world) return;

        if (world.mbwomData) {
            // Restauramos los datos del mundo en la variable global mbwom
            for (let key in world.mbwomData) {
                // Solo sobreescribimos los datos, no las funciones de mbwom
                if (typeof mbwom[key] !== 'function') {
                    mbwom[key] = this.cloneData(world.mbwomData[key]);
                }
            }
        } else {
            // Si no tiene datos guardados, significa que es una pestaña nueva/vacía
            this.resetGlobalWorldState();
        }

        // Restauramos la cámara
        if (world.cameraData && typeof camera !== 'undefined') {
            camera.x = world.cameraData.x;
            camera.y = world.cameraData.y;
            if (world.cameraData.zoom !== undefined) camera.zoom = world.cameraData.zoom;
        } else if (typeof camera !== 'undefined') {
            camera.x = 0; camera.y = 0;
        }

        // Restauramos el historial
        if (world.historyData && typeof historyManager !== 'undefined') {
            historyManager.undoStack = this.cloneData(world.historyData.undoStack);
            historyManager.redoStack = this.cloneData(world.historyData.redoStack);
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
            // Si es la última pestaña, simplemente la limpiamos
            this.resetGlobalWorldState();
            this.openWorlds[0].filename = "nuevo_mundo.mbw";
            this.switchWorld(id);
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