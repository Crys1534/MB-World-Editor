const customItemDb = {
    tools: [
        'WoodenPickaxe', 'StonePickaxe', 'IronPickaxe', 'GoldPickaxe', 'DiamondPickaxe', 'ObsidianPickaxe',
        'WoodenSword', 'StoneSword', 'IronSword', 'GoldSword', 'DiamondSword',
        'WoodenAxe', 'StoneAxe', 'IronAxe', 'GoldAxe', 'DiamondAxe',
        'WoodenShovel', 'StoneShovel', 'IronShovel', 'GoldShovel', 'DiamondShovel',
        'WoodenHoe', 'StoneHoe', 'IronHoe', 'GoldHoe', 'DiamondHoe', 'bow'
    ],
    armor: [
        'LeatherCap', 'LeatherShirt', 'LeatherPants', 'LeatherShoes', 
        'IronCap', 'IronShirt', 'IronPants', 'IronShoes', 
        'GoldCap', 'GoldShirt', 'GoldPants', 'GoldShoes', 
        'DiamondCap', 'DiamondShirt', 'DiamondPants', 'DiamondShoes',
		'DragonCap', 'DragonShirt', 'DragonPants', 'DragonShoes'
    ],
    books: ['book'] // Usamos el ID estándar del libro
};

// Mapeo inteligente para saber qué magias mostrar
const enchantFilters = {
    melee: ["sharpness", "smite", "baneofarthropods", "knockback", "fireaspect", "looting", "unbreaking", "mending"],
    tools: ["efficiency", "silktouch", "fortune", "unbreaking", "mending"],
    bows: ["power", "punch", "flame", "infinity", "unbreaking", "mending"],
    
    // --- MAGIAS DE ARMADURA SEPARADAS ---
    armor_all: ["protection", "fireprotection", "blastprotection", "projectileprotection", "thorns", "unbreaking", "mending"],
    armor_head: ["respiration", "aquaaffinity"],
    armor_feet: ["featherfalling"]
};

let currentCiBaseItem = null;
let currentCiEnchants = {}; // Aquí guardamos las magias activas

function openCustomItemsModal() {
    openModal('custom-items-modal');
    renderCustomGrid('tools');
    
    currentCiBaseItem = null;
    currentCiEnchants = {};
    document.getElementById('ci-preview-title').innerText = "Select an item";
    document.getElementById('save-custom-item').style.display = 'none';
    document.getElementById('ci-enchantments-list').innerHTML = '';
    
    let ctx = document.getElementById('ci-preview-canvas').getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    document.getElementById('ci-preview-slot').classList.remove('enchanted-slot');

    // --- DIBUJAR LOS ÍCONOS DE LAS PESTAÑAS ---
    drawCustomTabIcon('ci-icon-tools', 'ObsidianPickaxe');
    drawCustomTabIcon('ci-icon-armor', 'DragonShirt');
    drawCustomTabIcon('ci-icon-books', 'book');
}

function renderCustomGrid(category) {
    // Actualizar pestañas
    document.querySelectorAll('#custom-items-modal .struct-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-ci-' + category).classList.add('active');

    const grid = document.getElementById('custom-items-grid');
    grid.innerHTML = '';

    customItemDb[category].forEach(itemID => {
        let btn = document.createElement('div');
        btn.className = 'inv-item';
        btn.style.width = '64px'; btn.style.height = '64px';
        btn.style.background = '#8B8B8B'; btn.style.border = '4px inset #FFF';
        btn.style.display = 'flex'; btn.style.justifyContent = 'center'; btn.style.alignItems = 'center';
        
        let cvs = document.createElement('canvas');
        cvs.width = 16; cvs.height = 16;
        cvs.style.width = '48px'; cvs.style.height = '48px';
        cvs.style.imageRendering = 'pixelated';
        let ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: itemID}) : null;
        if (renderObj && window.images.blocks.complete) {
            ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
        }
        
        btn.appendChild(cvs);
        btn.onclick = () => selectCustomItem(itemID, category);
        
        btn.onmouseenter = () => { btn.style.background = '#A0A0A0'; };
        btn.onmouseleave = () => { btn.style.background = '#8B8B8B'; };
        
        grid.appendChild(btn);
    });
}

function selectCustomItem(itemID, category) {
    currentCiBaseItem = itemID;
    currentCiEnchants = {}; // Reseteamos al cambiar de ítem
    
    document.getElementById('ci-preview-title').innerText = String(itemID).replace(/([A-Z])/g, ' $1').trim();
    document.getElementById('save-custom-item').style.display = 'block';
    document.getElementById('ci-preview-slot').classList.remove('enchanted-slot');

    // Dibujar Preview en grande
    let ctx = document.getElementById('ci-preview-canvas').getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: itemID}) : null;
    if (renderObj && window.images.blocks.complete) {
        ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 64, 64);
    }

// Identificar qué grupo de encantamientos mostrar
    let validEnchants = [];
    if (category === 'books') {
        validEnchants = Object.keys(enchantTranslations); // El libro puede tener TODO
    } else if (category === 'armor') {
        // Magias que comparten todas las armaduras
        let armorMagics = [...enchantFilters.armor_all];
        
        // Magias exclusivas dependiendo de la pieza
        if (itemID.includes('Cap')) {
            armorMagics = armorMagics.concat(enchantFilters.armor_head);
        } else if (itemID.includes('Shoes')) {
            armorMagics = armorMagics.concat(enchantFilters.armor_feet);
        }
        
        validEnchants = getFilteredEnchants(armorMagics);
    } else if (itemID === 'bow') {
        validEnchants = getFilteredEnchants(enchantFilters.bows);
    } else if (itemID.includes('Sword') || itemID.includes('Axe')) {
        validEnchants = getFilteredEnchants([...enchantFilters.melee, ...enchantFilters.tools]);
    } else {
        validEnchants = getFilteredEnchants(enchantFilters.tools); // Picos, Palas, Azadas
    }

    renderEnchantmentList(validEnchants);
}

// Extrae del diccionario global solo los encantamientos que empiecen con los nombres permitidos
function getFilteredEnchants(allowedPrefixes) {
    let result = [];
    for (let key in enchantTranslations) {
        let baseName = key.replace(/[0-9]/g, '');
        if (allowedPrefixes.includes(baseName)) result.push(key);
    }
    return result;
}

function renderEnchantmentList(enchantsArray) {
    const list = document.getElementById('ci-enchantments-list');
    list.innerHTML = '';

    enchantsArray.forEach(enchKey => {
        let btn = document.createElement('div');
        btn.className = 'enchant-option';
        btn.innerText = enchantTranslations[enchKey];
        btn.dataset.enchKey = enchKey; // Guardamos el ID oculto en el botón
        
        if (currentCiEnchants[enchKey]) btn.classList.add('active-enchant');

        btn.onclick = () => {
            // Activar o desactivar
            if (currentCiEnchants[enchKey]) {
                delete currentCiEnchants[enchKey];
                btn.classList.remove('active-enchant');
            } else {
                currentCiEnchants[enchKey] = "enchant";
                btn.classList.add('active-enchant');
            }
            
            // Actualizar efecto de preview general
            if (Object.keys(currentCiEnchants).length > 0) {
                document.getElementById('ci-preview-slot').classList.add('enchanted-slot');
            } else {
                document.getElementById('ci-preview-slot').classList.remove('enchanted-slot');
            }

            // --- Lógica de bloqueo de niveles múltiples ---
            updateEnchantmentUIState();
        };

        list.appendChild(btn);
    });

    // Ejecutamos el bloqueo una vez al cargar por si el ítem ya tenía magias
    updateEnchantmentUIState();
}

// Nueva función que escanea y bloquea los niveles repetidos
function updateEnchantmentUIState() {
    const buttons = document.querySelectorAll('#ci-enchantments-list .enchant-option');
    
    // 1. Extraemos las "raíces" de las magias activas (ej: "sharpness" de "sharpness5")
    let activeBaseNames = {};
    for (let activeKey in currentCiEnchants) {
        let base = activeKey.replace(/[0-9]/g, ''); // Quita los números
        activeBaseNames[base] = activeKey; // Guarda qué nivel específico está activo
    }

    // 2. Revisamos todos los botones
    buttons.forEach(btn => {
        let enchKey = btn.dataset.enchKey;
        let baseName = enchKey.replace(/[0-9]/g, ''); // Raíz del botón actual

        // Si la magia raíz está activa, y NO es exactamente este botón... lo bloqueamos
        if (activeBaseNames[baseName] && activeBaseNames[baseName] !== enchKey) {
            btn.classList.add('disabled-enchant');
        } else {
            // Si está libre, le quitamos el bloqueo
            btn.classList.remove('disabled-enchant');
        }
    });
}

function saveCustomItem() {
    if (!currentCiBaseItem) return;

    // Si no le pusieron magias, lo guardamos vacío, de lo contrario clonamos el objeto
    let nbtData = Object.keys(currentCiEnchants).length > 0 ? JSON.parse(JSON.stringify(currentCiEnchants)) : {};
    
    // Formato de Mine Blocks: ["ItemID", Cantidad, Daño, {NBT}]
    let newItem = [currentCiBaseItem, 1, 0, nbtData];

    // Cargar LocalStorage
    let savedItems = JSON.parse(localStorage.getItem('mbw_custom_items')) || [];
    savedItems.push(newItem);
    localStorage.setItem('mbw_custom_items', JSON.stringify(savedItems));

    alert("Item saved to 'Custom' tab in your Inventory (E)!");
}



// --- FUNCIÓN PARA DIBUJAR LOS ÍCONOS EN LAS PESTAÑAS ---
function drawCustomTabIcon(canvasId, itemID) {
    let cvs = document.getElementById(canvasId);
    if (!cvs) return;
    let ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);

    let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: itemID}) : null;
    if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
        ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 16, 16);
    }
}