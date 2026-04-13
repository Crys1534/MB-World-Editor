// ✨ 1. INYECTAMOS TU ESTILO MÁGICO Y PROTECCIONES ANTI-CORTES DESDE JS
const magicStyles = document.createElement('style');
magicStyles.innerHTML = `
/* Tu estilo mágico intacto */
.enchant-option.active-enchant {
    background-color: #07104ae0 !important; 
    border: 2px solid #a200ff !important;   
    color: #ffaa00 !important;              
    text-shadow: 1px 1px 0 #000 !important;
    position: relative !important;
    overflow: hidden !important;
    box-shadow: 0 0 6px #a200ff !important;
}
.enchant-option.active-enchant::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
        110deg,
        transparent 25%,
        rgba(255, 255, 255, 0.4) 40%,
        rgba(255, 255, 255, 0.9) 50%,
        rgba(224, 102, 255, 0.6) 60%,
        transparent 75%
    );
    background-size: 300% 100%;
    animation: shine-glint 2s infinite ease-in-out;
    pointer-events: none;
    z-index: 5;
}

/* ✨ PROTECCIÓN PARA LA FUENTE PIXELADA Y TEXTOS LARGOS */
.enchant-option {
    line-height: 1.3 !important;       
    white-space: normal !important;    
    word-wrap: break-word !important;  
    display: flex !important;          
    align-items: center !important;
    min-height: 36px !important;       
}
`;
document.head.appendChild(magicStyles);

const enchantFilters = {
    melee: ["sharpness", "smite", "baneofarthropods", "knockback", "fireaspect", "looting", "unbreaking", "mending"],
    tools: ["efficiency", "silktouch", "fortune", "unbreaking", "mending"],
    bows: ["power", "punch", "flame", "infinity", "unbreaking", "mending"],
    fishingrods: ["lure", "luckofthesea"],
    armor_all: ["protection", "fireprotection", "blastprotection", "projectileprotection", "thorns", "unbreaking", "mending"],
    armor_head: ["respiration", "aquaaffinity"],
    armor_feet: ["featherfalling"]
};

let currentCiBaseItem = null;
let currentCiEnchants = {};
let currentCiEditIndex = null;

// ✨ DIBUJA EL CANVAS BASADO EN LA ID REAL
function updateCiPreviewCanvas() {
    let ctx = document.getElementById('ci-preview-canvas').getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    
    // Ahora simplemente dibuja la ID que tengamos, ya que la cambiaremos dinámicamente
    let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: currentCiBaseItem}) : null;
    if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
        ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 64, 64);
    }
}

// ✨ 2. ABRIR EL INVENTARIO EN MODO CREADOR
function openCustomItemsModal() {
    if (typeof isBuildingChest !== 'undefined') isBuildingChest = false;
    isCreatingCustomItem = true;
    
    const modal = document.getElementById('inventory-modal');
    const chestPanel = document.getElementById('chest-builder-panel');
    const customPanel = document.getElementById('custom-item-builder-panel');
    const title = document.getElementById('inventory-modal-title');
    const hotbarContainer = document.getElementById('modal-hotbar-container');
    
    modal.style.display = 'block';
    if (title) title.innerText = "Create Custom Item";
    
    // ✨ FIX: Apagamos el Cofre y Encendemos el Item
    if (chestPanel) chestPanel.style.display = 'none';
    if (customPanel) customPanel.style.display = 'flex';
    
    if (hotbarContainer) hotbarContainer.style.display = 'grid'; 
    
    currentCiBaseItem = null;
    currentCiEnchants = {};
    currentCiEditIndex = null;
    
    let titleEl = document.getElementById('ci-preview-title');
    if (titleEl) {
        titleEl.value = "Select an item";
        titleEl.disabled = true;
    }
    document.getElementById('save-custom-item').style.display = 'none';
    document.getElementById('ci-enchantments-list').innerHTML = '';
    
    let ctx = document.getElementById('ci-preview-canvas').getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    document.getElementById('ci-preview-slot').classList.remove('enchanted-slot');
    
    if (typeof renderInventoryTabs === 'function') renderInventoryTabs();
    if (typeof populateInventory === 'function') populateInventory();
    
    if (typeof renderModalHotbar === 'function') renderModalHotbar();
}

// ✨ 3. AL SELECCIONAR UN ÍTEM
function selectCustomItem(itemID, existingNbt = null, editIndex = null) {
    currentCiBaseItem = itemID;
    currentCiEditIndex = editIndex; 
    
    currentCiEnchants = existingNbt ? JSON.parse(JSON.stringify(existingNbt)) : {};
    
    let customName = String(itemID).replace(/([A-Z])/g, ' $1').trim();
    if (currentCiEnchants.name) {
        customName = currentCiEnchants.name;
        delete currentCiEnchants.name; 
    }
    
    let titleEl = document.getElementById('ci-preview-title');
    if (titleEl) {
        titleEl.value = customName;
        titleEl.disabled = false; 
    }
    
    document.getElementById('save-custom-item').style.display = 'block';

    if (Object.keys(currentCiEnchants).length > 0) {
        document.getElementById('ci-preview-slot').classList.add('enchanted-slot');
    } else {
        document.getElementById('ci-preview-slot').classList.remove('enchanted-slot');
    }

    updateCiPreviewCanvas();

    let validEnchants = [];
    // ✨ SOPORTE PARA EBOOK: Si editas un ebook ya creado, mostrará todas las magias
    if (itemID === 'book' || itemID === 'ebook') {
        validEnchants = Object.keys(enchantTranslations);
    } else if (itemID.includes('Cap') || itemID.includes('Shirt') || itemID.includes('Pants') || itemID.includes('Shoes')) {
        let armorMagics = [...enchantFilters.armor_all];
        if (itemID.includes('Cap')) armorMagics = armorMagics.concat(enchantFilters.armor_head);
        if (itemID.includes('Shoes')) armorMagics = armorMagics.concat(enchantFilters.armor_feet);
        validEnchants = getFilteredEnchants(armorMagics);
    } else if (itemID === 'bow') {
        validEnchants = getFilteredEnchants(enchantFilters.bows);
    } else if (itemID === 'fr') {
        validEnchants = getFilteredEnchants(enchantFilters.fishingrods);
    } else if (itemID.includes('Sword') || itemID.includes('Axe')) {
        validEnchants = getFilteredEnchants([...enchantFilters.melee, ...enchantFilters.tools]);
    } else if (itemID.includes('Pickaxe') || itemID.includes('Shovel') || itemID.includes('Hoe') || itemID === 'Shear') {
        validEnchants = getFilteredEnchants(enchantFilters.tools);
    } else {
        validEnchants = getFilteredEnchants(["unbreaking", "mending"]);
    }

    renderEnchantmentList(validEnchants);
}

function getFilteredEnchants(allowedPrefixes) {
    let result = [];
    for (let key in enchantTranslations) {
        let baseName = key.replace(/[0-9]/g, '');
        if (allowedPrefixes.includes(baseName)) result.push(key);
    }
    return result;
}

// ✨ 4. DIBUJAR LA LISTA Y TRANSFORMAR ID
function renderEnchantmentList(enchantsArray) {
    const list = document.getElementById('ci-enchantments-list');
    list.innerHTML = '';

    enchantsArray.sort((a, b) => {
        let nameA = enchantTranslations[a];
        let nameB = enchantTranslations[b];
        return nameA.localeCompare(nameB);
    });

    enchantsArray.forEach(enchKey => {
        let btn = document.createElement('div');
        btn.className = 'enchant-option';
        
        btn.style.boxSizing = 'border-box';
        btn.style.padding = '8px 10px'; 
        btn.style.fontWeight = 'bold';
        btn.style.userSelect = 'none';

        btn.innerHTML = `<span style="position: relative; z-index: 10; pointer-events: none; width: 100%;">${enchantTranslations[enchKey]}</span>`;
        btn.dataset.enchKey = enchKey; 
        
        if (currentCiEnchants[enchKey]) {
            btn.classList.add('active-enchant');
        }

        btn.onclick = () => {
            if (btn.classList.contains('disabled-enchant')) return;

            if (currentCiEnchants[enchKey]) {
                delete currentCiEnchants[enchKey];
                btn.classList.remove('active-enchant');
            } else {
                currentCiEnchants[enchKey] = "enchant";
                btn.classList.add('active-enchant');
            }
            
            let hasEnchants = Object.keys(currentCiEnchants).length > 0;

            // ✨ TRANSFORMACIÓN DE ID REAL ✨
            // Sube de nivel a ebook si tiene magias, o lo regresa a book si se las quitas todas
            if (hasEnchants && currentCiBaseItem === 'book') {
                currentCiBaseItem = 'ebook';
            } else if (!hasEnchants && currentCiBaseItem === 'ebook') {
                currentCiBaseItem = 'book';
            }
            
            if (hasEnchants) {
                document.getElementById('ci-preview-slot').classList.add('enchanted-slot');
            } else {
                document.getElementById('ci-preview-slot').classList.remove('enchanted-slot');
            }
            updateEnchantmentUIState();
            
            // Redibuja usando la ID actual
            updateCiPreviewCanvas();
        };
        list.appendChild(btn);
    });
    updateEnchantmentUIState();
}

function updateEnchantmentUIState() {
    const buttons = document.querySelectorAll('#ci-enchantments-list .enchant-option');
    let activeBaseNames = {};
    for (let activeKey in currentCiEnchants) {
        let base = activeKey.replace(/[0-9]/g, ''); 
        activeBaseNames[base] = activeKey; 
    }

    buttons.forEach(btn => {
        let enchKey = btn.dataset.enchKey;
        let baseName = enchKey.replace(/[0-9]/g, ''); 
        
        if (activeBaseNames[baseName] && activeBaseNames[baseName] !== enchKey) {
            btn.classList.add('disabled-enchant');
            btn.style.opacity = '0.4';
            btn.style.filter = 'grayscale(100%)';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.classList.remove('disabled-enchant');
            btn.style.opacity = '1';
            btn.style.filter = 'none';
            if (!btn.classList.contains('active-enchant')) {
                btn.style.cursor = 'pointer';
            }
        }
    });
}

// ✨ 5. GUARDAR Y ACTUALIZAR
function saveCustomItem() {
    if (!currentCiBaseItem) return;

    let nbtData = Object.keys(currentCiEnchants).length > 0 ? JSON.parse(JSON.stringify(currentCiEnchants)) : {};
    
    let titleEl = document.getElementById('ci-preview-title');
    if (titleEl) {
        let customName = titleEl.value.trim();
        let defaultName = String(currentCiBaseItem).replace(/([A-Z])/g, ' $1').trim();
        
        // Evitamos guardar nombres como "Ebook" si el jugador no escribió nada
        if (defaultName === "Ebook" && Object.keys(nbtData).length > 0) defaultName = "Enchanted Book";
        
        if (customName !== "" && customName !== defaultName && customName !== "Select an item") {
            nbtData.name = customName; 
        }
    }
    
    // Al guardar, utilizará la ID oficial que esté activa ('book' o 'ebook')
    let newItem = [currentCiBaseItem, 1, 0, nbtData];
    let savedItems = JSON.parse(localStorage.getItem('mbw_custom_items')) || [];

    if (currentCiEditIndex !== null && currentCiEditIndex >= 0 && currentCiEditIndex < savedItems.length) {
        savedItems[currentCiEditIndex] = newItem;
    } else {
        savedItems.push(newItem);
        currentCiEditIndex = savedItems.length - 1; 
    }
    
    localStorage.setItem('mbw_custom_items', JSON.stringify(savedItems));

    if (typeof populateInventory === 'function') populateInventory();
}