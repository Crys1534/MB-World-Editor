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
        icon: 'ObsidianPickaxe', 
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
'b', 'j', 'snowblock', 'ice', 'fice', 'fice_1', 'fice_2', 'fice_3', 'fice_4', 
'gv', 'cloth_white', 'cloth_lightgray', 'cloth_gray', 'cloth_black', 'cloth_brown', 'cloth_purple', 'cloth_magenta', 'cloth_red', 
'cloth_orange', 'cloth_pink', 'cloth_yellow', 'cloth_lightgreen', 'cloth_green', 'cloth_cyan', 'cloth_lightblue', 'cloth_blue', 'cloth_rainbow', 
'gs', 'gs_white', 'gs_lightgray', 'gs_gray', 'gs_black', 'gs_brown', 'gs_purple', 'gs_magenta', 'gs_redg', 
'gs_orange', 'gs_pink', 'gs_yellow', 'gs_lightgreen', 'gs_green', 'gs_cyan', 'gs_lightblue', 'gs_blue', 'bddt', 
'bdr', 'bdcs', 'bdbbb', 'bdbricks', 'bdbooks', 'bdsb', 'bdcloth_white', 'bdcloth_lightgray', 'bdcloth_gray', 
'bdcloth_black', 'bdcloth_brown', 'bdcloth_purple', 'bdcloth_magenta', 'bdcloth_red', 'bdcloth_orange', 'bdcloth_pink', 'bdcloth_yellow', 'bdcloth_lightgreen', 
'bdcloth_green', 'bdcloth_cyan', 'bdcloth_lightblue', 'bdcloth_blue', 'bdcloth_rainbow', 'bdgs', 'bdgs_white', 'bdgs_lightgray', 'bdgs_gray', 
'bdgs_black', 'bdgs_brown', 'bdgs_purple', 'bdgs_magenta', 'bdwp', 'bdgs_redg', 'bdgs_orange', 'bdgs_pink', 'bdgs_yellow', 
'bdgs_lightgreen', 'bdgs_green', 'bdgs_cyan', 'bdgs_lightblue', 'bdgs_blue', 'pk', 'pk_2', 'pk_3', 'pk_4', 
'pk_5', 'pk_6', 'pk_7', 'pk_8', 'pk_9', 'pk_10', 'pk_11', 'hai_1', 'stairr_1', 
'stairr_2', 'stairr_3', 'stairr_4', 'staircs_1', 'staircs_2', 'staircs_3', 'staircs_4', 'stairsb_1', 'stairsb_2', 
'stairsb_3', 'stairsb_4', 'stairob_1', 'stairob_2', 'stairob_3', 'stairob_4', 'stairbr_1', 'stairbr_2', 'stairbr_3', 
'stairbr_4', 'stairwp_1', 'stairwp_2', 'stairwp_3', 'stairwp_4', 'stairib_1', 'stairib_2', 'stairib_3', 'stairib_4', 
'stairgb_1', 'stairgb_2', 'stairgb_3', 'stairgb_4', 'stairdb_1', 'stairdb_2', 'stairdb_3', 'stairdb_4', 'stairbrick_1', 
'stairbrick_2', 'stairbrick_3', 'stairbrick_4', 'stairn_1', 'stairn_2', 'stairn_3', 'stairn_4', 'stairbbb_1', 'stairbbb_2', 
'stairbbb_3', 'stairbbb_4', 'halfr_1', 'halfr_2', 'halfcs_1', 'halfcs_2', 'halfsb_1', 'halfsb_2', 'halfob_1', 
'halfob_2', 'halfbr_1', 'halfbr_2', 'halfwp_1', 'halfwp_2', 'halfib_1', 'halfib_2', 'halfgb_1', 'halfgb_2', 
'halfdb_1', 'halfdb_2', 'halfbrick_1', 'halfbrick_2', 'halfn_1', 'halfn_2', 'halfbbb_1', 'halfbbb_2'
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
            'WoodenHoe', 'StoneHoe', 'IronHoe', 'GoldHoe', 'DiamondHoe',
			'fr', 'frodcarrot', 'Shear',
        ]
    },
	
    // 🌿 Food and Crops
    Food: { 
        icon: 'bread', 
        items: [
            'egg', 'fireegg', 'cegg', 'or', 'lemon', 'gasd', 'gap', 'capple', 'crml', 
			'sugar', 'icec', 'potato', 'ppotato', 'bsed', 'beet', 'wseed', 'gmels', 'pseed', 
			'pkp', 'carrot', 'gcarrot', 'wheat', 'bread', 'cookie', 'ccane', 
			'cake_1', 'cake_2', 'cake_3', 'cake_4', 'cake_5', 'cake_6', 'cake_7', 
			'ccake_1', 'ccake_2', 'ccake_3', 'ccake_4', 'ccake_5', 'ccake_6', 'ccake_7', 
			'nw', 'nw_2', 'nw_3', 'nw_4', 'nw_5', 'nw_6', 'nw_7', 
			'seed', 'seed_2', 'seed_3', 'seed_4', 'seed_5', 'seed_6', 'seed_7', 
			'carrot', 'carrot_2', 'carrot_3', 'carrot_4', 'carrot_5', 'carrot_6', 'carrot_7', 
			'wseed_1', 'wseed_2', 'wseed_3', 'wseed_4', 'wseed_5', 'wseed_6', 'wseed_7',
			'pseed_2', 'pseed_3', 'pseed_4', 'pseed_5', 'pseed_6', 'pseed_7',
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
	
// 📚 Libros Encantados
    EnchantedBooks: {
        icon: 'ebook',
        items: [] 
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

    // ========================================================
    // --- LÓGICA ESPECIAL: PESTAÑA LIBROS ENCANTADOS (LIMPIA) ---
    // ========================================================
    if (activeInventoryTab === 'EnchantedBooks') {
        const enchants = Object.keys(enchantTranslations);
        
        enchants.forEach(enchantKey => {
            let enchantments = {};
            enchantments[enchantKey] = "enchant"; 

            const item = document.createElement('div');
            item.className = 'inv-item enchanted-slot'; // Añadimos la clase mágica aquí
            
            // ELIMINAMOS el item.title nativo y no inyectamos div in-line
            item.title = ""; 
            
            // GUARDAMOS EL TEXTO MÁGICO EN EL DATASET PARA EL TOOLTIP MAESTRO
            let niceName = enchantTranslations[enchantKey];
            let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
            item.dataset.enchantTooltip = `<strong>Enchanted Book</strong>${enchantTooltipHTML}`;

            // Lógica de Recogida (Soporta NBT)
            item.onclick = () => {
                heldItem = { type: 'book', count: 1, states1: 0, nbt: enchantments };
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

            // Dibujar el canvas del ítem (Usamos 'book' que sí existe en texturas)
            const cvs = document.createElement('canvas');
            cvs.width = 16; cvs.height = 16;
            cvs.style.width = '48px'; cvs.style.height = '48px';
            cvs.style.imageRendering = 'pixelated';
            const ctx = cvs.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: 'book'}) : null;
            if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
                ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
            } else {
                ctx.fillStyle = "magenta"; ctx.fillRect(4, 4, 8, 8);
            }
            item.appendChild(cvs);

            // Efecto Hover
            item.onmouseenter = () => { item.style.background = '#A0A0A0'; };
            item.onmouseleave = () => { item.style.background = '#8B8B8B'; };

            grid.appendChild(item);
        });
        
        return; // Detenemos la función para que no se rompa buscando texturas
    }

    // ========================================================
    // --- LÓGICA ESPECIAL: PESTAÑA CUSTOM (LIMPIA) ---
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

            let isEnchanted = enchantments && Object.keys(enchantments).length > 0;
            if (isEnchanted) {
                item.classList.add('enchanted-slot');
                item.title = ""; // Ocultamos el título nativo si tiene magia

                // GUARDAMOS EL TEXTO MÁGICO EN EL DATASET
                let itemNameStr = String(itemID).replace(/([A-Z])/g, ' $1').trim();
                let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
                item.dataset.enchantTooltip = `<strong>${itemNameStr}</strong>${enchantTooltipHTML}`;
            } else {
                item.title = String(itemID).replace(/([A-Z])/g, ' $1').trim() + " (Custom)";
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
    let slot = e.target.closest('.enchanted-slot');
    
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
// 📰 BASE DE DATOS DE NOTICIAS
// ==========================================
const newsDatabase = [

{
        id: 3,
        title: "v2.2 - Chests Update",
        date: "March 23, 2026", 
        image: "https://i.imgur.com/HX0oYeQ.png", 
        excerpt: "Huge update including new structures, magic wand, custom items, tabs system, and much more!",
        content: `
            <h3 style="margin-top: 0; color: #333;">Changelog:</h3>
            <ul class="pixel-list">
                <li><code class="code-tag">[Beta]</code><b>🏘️ Structures Library</b>
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>storage limit removed</li>
                        <li><u>Vanilla</u>
                            <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                                <li>Tree 3, Tree 4, Nether, Nether Portal, End Portal</li>
                            </ul>
                        </li>
                        <li><u>Community</u>
                            <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                                <li>Nether Portal (Minecraft), Special Items (v2), Overpowered Chest,</li>
                                <li>J Block (pixelart), Sheep (pixelart), Bad Apple (pixelart),</li>
                                <li>Nether Enhanced, The Four Wolves,</li>
                                <li>SkyWars - Candy Map, SkyWars - Nether Map,</li>
                                <li>SkyWars - Trees Map, SkyBlock, Dungeon Enhanced,</li>
                                <li>Armor "Stand" (Diamond), Frank (pixelart)</li>
                            </ul>
                        </li>
                    </ul>
                </li>
                <li><b>🪄 new tool: magic wand</b></li>
                <li><code class="code-tag">[Beta]</code> 🎒 Inventory
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>enchanted books</li>
                        <li>more items added</li>
                    </ul>
                </li>
                <li>🎨 new theme: Windows XP®</li>
                <li><b>🎁 Chest Creator</b>
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>random loot chest generator button</li>
                    </ul>
                </li>
                <li><b>📑 Gamerules</b>
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>keep inventory</li>
                        <li>do daylight cycle</li>
                        <li>mob griefing</li>
                        <li>mob loot</li>
                        <li>fire tick</li>
                    </ul>
                </li>
                <li><b>📂 ¡Tabs System!</b> - Ahora se pueden abrir múltiples mundos</li>
                <li><b>⛏️ Custom Items Creator</b></li>
                <li>window effects</li>
                <li>pasted structures now do paste the air blocks (shift+clic)</li>
                <li>player and world options
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>health</li>
                        <li>hunger</li>
                        <li>xp</li>
                        <li>time</li>
                        <li>weather</li>
                        <li>difficulty</li>
                    </ul>
                </li>
                <li>changes to the console (/tp)</li>
                <li><code class="code-tag">[Fixed]</code>  camera speed</li>
                <li><code class="code-tag">[Fixed]</code> the lasso/free form tool now can save structures</li>
                <li><code class="code-tag">[Fixed]</code>  some missing textures added</li>
                <li><code class="code-tag">[Fixed]</code>  screenshot tool</li>
            </ul>
        `,
		
		gallery: [
            "https://i.imgur.com/LgECGcx.png", 
            "https://i.imgur.com/JVCV5E1.png", 
            "https://i.imgur.com/ilXaPlD.png"
        ]
    },
{
        id: 2,
        title: "v2.1 - Structures Update",
        date: "February 23, 2026", // Ajusta la fecha real
        image: "https://i.imgur.com/8IIHD3d.png", // Cambia esto por la imagen que prefieras
        excerpt: "Structures library, improved tools, new UI, and bug fixes.",
        content: `
            <h3 style="margin-top: 0; color: #333;">Changelog:</h3>
            <ul class="pixel-list">
                <li><code class="code-tag">[Beta]</code>  🏘️ <b>Structures library!</b>
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>structures can be saved using the Select tool</li>
                        <li>tabs: Saved, Vanilla, and Community</li>
                        <li>backups</li>
                        <li>quick access to structures (vanilla)</li>
                    </ul>
                </li>
                <li>improved Select tool
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>now required to copy structures</li>
                        <li>multiple selection</li>
                    </ul>
                </li>
                <li>improved brush tool
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>brush/eraser sizes (1-7)</li>
                        <li>rounded mode</li>
                        <li>spray mode</li>
                    </ul>
                </li>
                <li><code class="code-tag">[Beta]</code> 🔊 Sound effects
                    <ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;">
                        <li>deleted structure</li>
                    </ul>
                </li>
                <li>optimization improvements</li>
                <li>cursor changed</li>
                <li>floating toolbar</li>
                <li>improved interface</li>
                <li>grid icon</li>
                <li>interface with icons to change dimensions</li>
                <li><code class="code-tag">[Fixed]</code>  camera fixed</li>
                <li><code class="code-tag">[Fixed]</code>  Fix Hardcore Mode option re-implemented</li>
            </ul>
        `
    },
{
        id: 1,
        title: "v2.0",
        date: "January 16, 2026", // Ajusta la fecha real
        image: "https://i.imgur.com/4ZYclOO.png", // Cambia esto por la imagen que prefieras
        excerpt: "New UI, Copy-Paste, Zoom, and more!",
        content: `
            <h3 style="margin-top: 0; color: #333;">Changelog:</h3>
            <ul class="pixel-list">
                <li>new UI</li>
                <li>copy-paste structures feature (select area, Ctrl+C)</li>
                <li>zoom (25, 50, 100, 150, and 200%)</li>
                <li><code class="code-tag">[Beta]</code> Inventory</li>
                <li>optimization improvements</li>
                <li>/tp command in-app</li>
            </ul>
        `
    },
];

// ==========================================
// 📰 FUNCIONES DEL SISTEMA DE NOTICIAS
// ==========================================
function openNewsModal() {
    openModal('news-modal'); // Asume que tienes una función openModal general
    showNewsList();
    
    // Al abrir el panel, marcamos las noticias como "leídas"
    let latestNewsId = Math.max(...newsDatabase.map(n => n.id));
    localStorage.setItem('mbw_last_seen_news', latestNewsId);
    checkUnreadNews(); // Quita el brillo del botón
}

function showNewsList() {
    document.getElementById('news-list-view').style.display = 'block';
    document.getElementById('news-detail-view').style.display = 'none';
    
    const listContainer = document.getElementById('news-list-view');
    listContainer.innerHTML = '';
    
    // Ordenamos para que la más nueva (ID más alto) salga arriba
    const sortedNews = [...newsDatabase].sort((a, b) => b.id - a.id);
    
    sortedNews.forEach(news => {
        let card = document.createElement('div');
        card.className = 'news-card';
        card.onclick = () => showNewsDetail(news.id);
        
        card.innerHTML = `
    <img src="${news.image}" alt="News" onerror="this.src='favicon.ico'" style="image-rendering: auto;">
    <div>
        <h4 style="margin: 0 0 5px 0; color: #333; font-size: 18px;">${news.title}</h4>
        <span style="font-size: 11px; color: #444; font-weight: bold; display: block; margin-bottom: 5px;">${news.date}</span>
        
        <p style="margin: 0; font-size: 12px; color: #000;">${news.excerpt}</p>
    </div>
`;
        listContainer.appendChild(card);
    });
}

function showNewsDetail(id) {
    const news = newsDatabase.find(n => n.id === id);
    if (!news) return;

    document.getElementById('news-list-view').style.display = 'none';
    document.getElementById('news-detail-view').style.display = 'block';

    document.getElementById('news-detail-image').src = news.image;
    document.getElementById('news-detail-title').innerText = news.title;
    document.getElementById('news-detail-date').innerText = news.date;
    
    // Inyectamos el texto HTML
    let contentHTML = news.content;
    
// Si la noticia tiene galería, inyectamos las imágenes usando las clases CSS correctas
    if (news.gallery && news.gallery.length > 0) {
        contentHTML += `<div class="news-gallery">`;
        news.gallery.forEach(imgSrc => {
            contentHTML += `<img src="${imgSrc}" class="news-gallery-img" onclick="openLightbox('${imgSrc}')" title="Click to enlarge">`;
        });
        contentHTML += `</div>`;
    }
    
    document.getElementById('news-detail-content').innerHTML = contentHTML;
}

// ==========================================
// 🔍 LIGHTBOX (Visor de imágenes grande)
// ==========================================
function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-modal').style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('lightbox-modal').style.display = 'none';
}

// ==========================================
// 🔔 SISTEMA DE ALERTA DE NOTICIAS NO LEÍDAS
// ==========================================
function checkUnreadNews() {
    if (!newsDatabase || newsDatabase.length === 0) return;

    let latestNewsId = Math.max(...newsDatabase.map(n => n.id));
    let lastSeenNewsId = parseInt(localStorage.getItem('mbw_last_seen_news')) || 0;

    let newsBtn = document.getElementById('news-btn');
    if (newsBtn) {
        if (latestNewsId > lastSeenNewsId) {
            newsBtn.classList.add('news-unread'); // Enciende el brillo
        } else {
            newsBtn.classList.remove('news-unread'); // Apaga el brillo
        }
    }
}

// Comprueba si hay noticias nuevas cuando arranca el programa
window.addEventListener('DOMContentLoaded', checkUnreadNews);


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
            if (val === 0) zoomScale = 0.5;      
            else if (val === 1) zoomScale = 0.75; 
            else if (val === 2) zoomScale = 1;    
            else if (val === 3) zoomScale = 2;    
            else if (val === 4) zoomScale = 3;    
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
function updateFilename(newName) {
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
    
    // C) Actualizar la pestaña activa en world-tabs
    const activeWorldTab = document.querySelector('#world-tabs .active');
    if (activeWorldTab) {
        // Asumiendo que el texto está directo en la pestaña. Si usas un span con clase, cámbialo aquí
        activeWorldTab.textContent = newName; 
    }
    
    // D) Actualizar la variable interna del mundo (si existe)
    if (typeof fileInfo !== 'undefined' && fileInfo !== null) {
        fileInfo.name = newName;
    }
}

// 2. Editar la Semilla (Seed) en tiempo real
function updateSeed(newSeed) {
    if (typeof fileInfo !== 'undefined' && fileInfo !== null) {
        fileInfo.seed = newSeed;
    }
}

// 3. Abrir/Cerrar el panel de World Info y Empujar el Zoom
function toggleWorldInfo() {
    const sidebar = document.getElementById('world-info-sidebar');
    const zoomControl = document.getElementById('zoom-floating'); // ✨ Buscamos el Zoom
    
    if (!sidebar) return;
    
    if (sidebar.style.display === 'none' || sidebar.style.display === '') {
        sidebar.style.display = 'flex';
        
        // ✨ Empujamos el zoom a la izquierda (Ancho del panel 250px + Margen original 20px)
        if (zoomControl) zoomControl.style.right = '270px'; 
        
        populateWorldInfo(); 
    } else {
        sidebar.style.display = 'none';
        
        // ✨ Regresamos el zoom a su posición original
        if (zoomControl) zoomControl.style.right = '20px'; 
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
}