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
'b', 'magma', 'j', 'snowblock', 'ice', 'fice', 'fice_1', 'fice_2', 'fice_3', 'fice_4', 
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
			'carrot_1', 'carrot_2', 'carrot_3', 'carrot_4', 'carrot_5', 'carrot_6', 'carrot_7', 
			'wseed_1', 'wseed_2', 'wseed_3', 'wseed_4', 'wseed_5', 'wseed_6', 'wseed_7',
			'pseed_2', 'pseed_3', 'pseed_4', 'pseed_5', 'pseed_6', 'pseed_7',
			'pork', 'cpork', 'bacon', 'cbacon', 'beef', 'cbeef', 'chicken', 'cchicken', 'nugget',
			'mutton', 'cmutton', 'rabbit', 'crabbit', 'fi', 'cfi', 'salmon', 'csalmon', 'clown', 'puff',
			'rf', 'bowl', 'soup', 'rabbitsoup', 'beetsoup', 'lade', 'apade', 'orade', 'mbk', 
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
	
	// 🧪 Pociones
    Potions: {
        icon: 'potion', // Asegúrate de que exista un ícono base
        items: [] 
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
    
    // 1. Magia: Encontramos y borramos TODAS las clases que empiecen con "theme-"
    const classesToRemove = Array.from(body.classList).filter(c => c.startsWith('theme-'));
    classesToRemove.forEach(c => body.classList.remove(c));

    // 2. Aplicamos el nuevo tema seleccionado (si no es el 'dark' por defecto)
    if (themeName !== 'dark') {
        body.classList.add('theme-' + themeName);
    }
    
    // 3. Guardamos en memoria y actualizamos la lista desplegable
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
let isCreatingCustomItem = false; // ✨ NUEVA

function toggleInventory() {
    const modal = document.getElementById('inventory-modal');
    const chestPanel = document.getElementById('chest-builder-panel');
    const customPanel = document.getElementById('custom-item-builder-panel'); // ✨
    const title = document.getElementById('inventory-modal-title');
    const hotbarContainer = document.getElementById('modal-hotbar-container');

    if (modal.style.display === 'block') {
        modal.style.display = 'none';
        heldItem = null; 
        updateFloatingItem();
        isBuildingChest = false; 
        isCreatingCustomItem = false; // ✨
    } else {
        modal.style.display = 'block';
        
        if (title) title.innerText = "Inventory";
        if (chestPanel) chestPanel.style.display = 'none'; 
        if (customPanel) customPanel.style.display = 'none'; // ✨
        if (hotbarContainer) hotbarContainer.style.display = 'grid'; // Mostramos la hotbar

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
                // Verificamos si el Creador de Ítems está abierto
                if (typeof isCreatingCustomItem !== 'undefined' && isCreatingCustomItem) {
                    // Lo mandamos al panel para editar en lugar de agarrarlo
                    if (typeof selectCustomItem === 'function') {
                        selectCustomItem(itemID);
                    }
                } else {
                    // Si el panel NO está abierto, lo agarramos normal (tu drag custom)
                    heldItem = { type: itemID, count: itemCount, states1: itemDamage, nbt: enchantments };
                    updateFloatingItem();
                }
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
                item.title = ""; // Ocultamos el título nativo si tiene magia

                let enchantTooltipHTML = typeof formatEnchantments === 'function' ? formatEnchantments(enchantments) : "";
                item.dataset.enchantTooltip = `<strong>${itemNameStr}</strong>${enchantTooltipHTML}`;
            } else {
                // Si solo le cambiaron el nombre pero no tiene magias, usamos el tooltip normal
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

    blocksToShow.forEach(blockType => {
        const item = document.createElement('div');
        item.className = 'inv-item';
        item.title = blockType; 
        
        item.onclick = () => {
            // Si el creador de items está abierto, manda el bloque para allá
            if (typeof isCreatingCustomItem !== 'undefined' && isCreatingCustomItem) {
                if (typeof selectCustomItem === 'function') selectCustomItem(blockType);
            } else {
                pickupItemFromInventory(blockType); // Si no, recógelo normal en la mano
            }
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
    if (typeof isCreatingCustomItem !== 'undefined') isCreatingCustomItem = false;
    
    customChestInventory = new Array(27).fill(null); 
    
    const modal = document.getElementById('inventory-modal');
    const chestPanel = document.getElementById('chest-builder-panel');
    const customPanel = document.getElementById('custom-item-builder-panel'); // ✨ FIX: Agregamos la referencia
    const title = document.getElementById('inventory-modal-title');
    
    modal.style.display = 'block';
    
    if (title) title.innerText = "Create Loot Chest";
    
    // ✨ FIX: Apagamos el Item y Encendemos el Cofre
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
    "thorns1": "Thorns I", "thorns2": "Thorns II", "thorns3": "Thorns III",
	
	// Cañas de pescar
	"luckofthesea1": "Luck Of The Sea I", "luckofthesea2": "Luck Of The Sea II", "luckofthesea3": "Luck Of The Sea III", 
	"lure1": "Lure I", "lure2": "Lure II", "lure3": "Lure III", 
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
	
	// ==========================================
    // ✨ CALCULAR Y MOSTRAR EL PESO DEL ARCHIVO
    // ==========================================
    const sizeSpan = document.getElementById('world-info-size');
    if (sizeSpan && typeof fileManager !== 'undefined' && fileManager.file) {
        const bytes = fileManager.file.size; // Peso real del archivo cargado
        let sizeText = bytes + " B";
        
        // Lo convertimos a KB o MB para que sea fácil de leer
        if (bytes >= 1048576) {
            sizeText = (bytes / 1048576).toFixed(2) + " MB";
        } else if (bytes >= 1024) {
            sizeText = (bytes / 1024).toFixed(2) + " KB";
        }
        
        sizeSpan.innerText = sizeText;
    } else if (sizeSpan) {
        sizeSpan.innerText = "Unknown";
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
    "zombie", "skeleton", "creeper", "spider", "slime", "pig", "cow", "cowctus cow", "mushroom cow", "chicken", "sheep",
    "zombiepigman", "ghast", "blaze", "magmacube", "nethereye", "enderman", "enderdragon", "snowgolem", "bat", "rabbit", "squid", "zombie_supremo",
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
            <img src="${imgSrc}" alt="${niceName}" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;" onerror="this.onerror=null; this.src='assets/${mob}.png'">
        </button>
        `;
    });

    container.innerHTML = html;
}

// 2. Al seleccionar un mob, lo pasa al frente de la lista y activa la herramienta
function selectMobToSpawn(type) {
    currentMobToSpawn = type;
    currentTool = 'spawn_mob'; // Forzamos la herramienta

    // Actualizamos la lista de recientes (Lo movemos al inicio)
    recentMobsList = recentMobsList.filter(m => m !== type);
    recentMobsList.unshift(type);
    
    // Si la lista supera los 3, borramos el más antiguo
    if (recentMobsList.length > 3) {
        recentMobsList.pop();
    }

    renderRecentMobs(); // Re-dibujamos el menú superior
    
    // Cerramos el modal por si estaba abierto
    try { closeModal('mobs-modal'); } catch(e){}
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
    "sheep": 8, "pig": 8, "cow": 10, "ghast": 10, "slime": 16, "magmacube": 16,
    "zombie": 20, "skeleton": 20, "creeper": 20, "spider": 20, "zombiepigman": 20, "blaze": 20,
    "enderman": 40, "enderdragon": 333, "nethereye": 20,
	"zombie_supremo": 500 // ✨ SU VIDA DE JEFE
};

// Mobs organizados por dimensión
const MOBS_BY_DIMENSION = {
	"Animals": ["pig", "cow", "cowctus cow", "mushroom cow", "chicken", "sheep", "rabbit", "bat", "wolf", "dog"],
    "Overworld": ["zombie", "skeleton", "creeper", "spider", "slime", "snowgolem", "zombie_supremo"],
    "Nether": ["zombiepigman", "ghast", "blaze", "magmacube", "nethereye"],
    "End": ["enderman", "enderdragon"]
};

// Abre la ventana modal
function openMobModal() {
    document.getElementById('mobs-modal').style.display = 'block';
    filterMobs(activeMobTab); // Forzamos a cargar la pestaña activa
}

// Función que cambia de pestaña y carga los mobs correspondientes
function filterMobs(dimension) {
    activeMobTab = dimension;
    
    // 1. Actualizar el CSS de las pestañas
	document.getElementById('tab-mob-animals').classList.remove('active');
    document.getElementById('tab-mob-overworld').classList.remove('active');
    document.getElementById('tab-mob-nether').classList.remove('active');
    document.getElementById('tab-mob-end').classList.remove('active');
    
    document.getElementById('tab-mob-' + dimension.toLowerCase()).classList.add('active');

    // 2. Llenar la cuadrícula
    const container = document.getElementById('mobs-grid');
    if (!container) return;
    
    container.innerHTML = ''; 

    let mobsToShow = MOBS_BY_DIMENSION[dimension] || [];
    
    mobsToShow.forEach(mob => {
        let niceName = mob.charAt(0).toUpperCase() + mob.slice(1);
        let imgSrc = (window.images && window.images[mob] && window.images[mob].src) 
                     ? window.images[mob].src 
                     : `assets/mobs/${mob}.png`;

        // ✨ AQUÍ USAMOS LAS NUEVAS CLASES EXCLUSIVAS 'mob-item' y 'mob-name' ✨
        container.innerHTML += `
        <div class="mob-item" onclick="previewMob('${mob}')" title="${niceName}" style="margin: 0; height: 156px; border-bottom: 2px solid #272727; border-right: 2px solid #272727;">
            <img src="${imgSrc}" style="width: 90%; height: 90%; object-fit: contain; image-rendering: pixelated;" onerror="this.onerror=null; this.src='assets/${mob}.png'">
            <span class="mob-name" style="font-size: 11px; margin-top: 5px;">${niceName}</span>
        </div>
        `;
    });

    // 3. Auto-seleccionar el primer mob de la lista
    if (mobsToShow.length > 0) {
        previewMob(mobsToShow[0]);
    }
}

// Actualiza el panel lateral derecho con el mob seleccionado
function previewMob(mob) {
    currentlyPreviewedMob = mob;
    
    let niceName = mob.charAt(0).toUpperCase() + mob.slice(1);
    let imgSrc = (window.images && window.images[mob] && window.images[mob].src) 
                 ? window.images[mob].src 
                 : `assets/mobs/${mob}.png`;
                 
    // Actualizamos la imagen
    const imgEl = document.getElementById('mob-preview-image');
    if (imgEl) {
        imgEl.src = imgSrc;
        imgEl.onerror = function() { this.src = `assets/mobs/${mob}.png`; }; 
    }
    
    // Actualizamos los textos
    const titleEl = document.getElementById('mob-info-title');
    if (titleEl) titleEl.innerText = niceName;
    
    const hpEl = document.getElementById('mob-info-hp');
    if (hpEl) {
        let hp = MOBS_HP_DB[mob] || 20; 
        hpEl.innerText = `Health: ${hp} HP`;
    }

    // ✨ NUEVO: Disparamos el sonido del mob al previsualizarlo
    if (typeof audioManager !== 'undefined') {
        audioManager.playMobSound(mob);
    }
}

// Se ejecuta al darle al botón verde "Spawn Mob" del panel lateral
function spawnPreviewedMob() {
    if (currentlyPreviewedMob) {
        selectMobToSpawn(currentlyPreviewedMob);
    }
}

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
// ✨ LÓGICA DE LA BARRA DE ESTADO (STATUS BAR) ✨
// ==========================================

// 1. Botones de + y - (Sincronizado con tu barra deslizable)
window.zoomHUD = function(direction) {
    // direction es -1 (out) o 1 (in)
    if (typeof currentZoomIndex !== 'undefined' && typeof ZOOM_LEVELS !== 'undefined') {
        let newIndex = currentZoomIndex + direction;
        // Evitamos que se salga de los límites
        if (newIndex >= 0 && newIndex < ZOOM_LEVELS.length) {
            // Reutilizamos tu función original
            updateZoomSlider(newIndex);
        }
    }
};

// 2. Reiniciar Zoom al hacer clic en el porcentaje ("100%")
window.resetZoomHUD = function() {
    if (typeof ZOOM_LEVELS !== 'undefined') {
        let index100 = ZOOM_LEVELS.indexOf(100);
        if (index100 !== -1) {
            updateZoomSlider(index100);
        }
    }
};

// 3. Botón de Pantalla Completa
window.toggleFullscreenHUD = function() {
    if (!document.fullscreenElement) {
        // Entrar a pantalla completa
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error while fullscreen: ${err.message}`);
        });
    } else {
        // Salir de pantalla completa
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

// 4. Medidor de FPS Real en vivo (Con Semáforo de Rendimiento)
let lastFrameTime = performance.now();
let frameCount = 0;

function updateFPS() {
    const now = performance.now();
    frameCount++;
    
    // Cada 1000 milisegundos (1 segundo), actualizamos el texto
    if (now - lastFrameTime >= 1000) {
        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) {
            fpsDisplay.innerText = frameCount + " FPS";
            
            // ✨ MAGIA DE COLORES ✨
            if (frameCount >= 50) {
                fpsDisplay.style.color = "#2ecc71"; // Verde (Súper fluido)
            } else if (frameCount >= 30) {
                fpsDisplay.style.color = "#f1c40f"; // Amarillo (Bajón leve)
            } else {
                fpsDisplay.style.color = "#e74c3c"; // Rojo (Lag severo)
            }
        }
        
        // Reiniciamos los contadores para el siguiente segundo
        frameCount = 0;
        lastFrameTime = now;
    }
    
    requestAnimationFrame(updateFPS);
}

// Iniciar el contador de FPS
requestAnimationFrame(updateFPS);