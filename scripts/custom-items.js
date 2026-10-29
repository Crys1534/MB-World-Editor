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

// La lista de encantamientos (niveles máximos, en qué objetos va cada uno) está en scripts/enchants.js.
let ciEnchantOpen = {};          // qué acordeones están abiertos (se recuerda mientras no cambies de objeto)
let ciOpenFor = null;            // objeto al que pertenece ciEnchantOpen

let currentCiBaseItem = null;
let currentCiEnchants = {};
let currentCiEditIndex = null;

// ✨ DIBUJA EL CANVAS BASADO EN LA ID REAL
function updateCiPreviewCanvas() {
    let ctx = document.getElementById('ci-preview-canvas').getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.canvas.__itemTok = 'ci' + Math.random();       // (si antes mostraba un objeto animado, deja de animarse)
    ctx.imageSmoothingEnabled = false;
    
    // Ahora simplemente dibuja la ID que tengamos, ya que la cambiaremos dinámicamente
    let renderObj = typeof getBlockObject === 'function' ? getBlockObject({type: currentCiBaseItem}) : null;
    if (renderObj && window.images && window.images.blocks && window.images.blocks.complete) {
        ctx.drawImage(window.images.blocks, renderObj.x, renderObj.y, 16, 16, 0, 0, 64, 64);
        if (window.mbwAnimIcon) window.mbwAnimIcon(ctx, renderObj, 0, 0, 64, 64);   // lana arcoíris / magma / fuego: animado
    }
}

// ✨ 2. ABRIR EL INVENTARIO EN MODO CREADOR
function openCustomItemsModal() {
    if (typeof isBuildingChest !== 'undefined') isBuildingChest = false;
    isCreatingCustomItem = true;
    
    const modal = document.getElementById('inventory-modal');
    const modalContent = modal.querySelector('.modal-content'); // ✨ NUEVO: Buscamos la caja gris principal
    const chestPanel = document.getElementById('chest-builder-panel');
    const customPanel = document.getElementById('custom-item-builder-panel');
    const title = document.getElementById('inventory-modal-title');
    const hotbarContainer = document.getElementById('modal-hotbar-container');
    
    if (typeof playerInvReset === 'function') playerInvReset();
    modal.style.display = 'block';
    
    // ✨ NUEVO: Estiramos la ventana a 2 columnas (1190px) para que quepa el panel de items
    if (modalContent) modalContent.style.width = '1190px';

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
    if (ciOpenFor !== itemID) { ciEnchantOpen = {}; ciOpenFor = itemID; }   // otro objeto: los acordeones vuelven a empezar cerrados
    currentCiBaseItem = itemID;
    currentCiEditIndex = editIndex; 
    
    // Las claves viejas que escribía el editor (fireprotection1, luckofthesea...) se convierten a las que usa el juego
    currentCiEnchants = existingNbt ? mbwEnchNormalize(JSON.parse(JSON.stringify(existingNbt))) : {};
    
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

    updateCiGlow();
    updateCiPreviewCanvas();
    renderEnchantmentList();
}

function hasCiEnchants() {
    return Object.keys(currentCiEnchants).some(k => currentCiEnchants[k] === 'enchant');
}
function updateCiGlow() {
    const slot = document.getElementById('ci-preview-slot');
    if (!slot) return;
    if (hasCiEnchants()) slot.classList.add('enchanted-slot'); else slot.classList.remove('enchanted-slot');
}

// ✨ 4. DIBUJAR LA LISTA (acordeones: un encantamiento = un acordeón con todos sus niveles) Y TRANSFORMAR ID
function renderEnchantmentList() {
    const list = document.getElementById('ci-enchantments-list');
    list.innerHTML = '';
    mbwEnchPicker(list, {
        item: currentCiBaseItem,
        free: ciAnyEnchant(),
        data: currentCiEnchants,
        open: ciEnchantOpen,
        onChange: () => {
            const hasEnchants = hasCiEnchants();
            // ✨ TRANSFORMACIÓN DE ID REAL ✨
            // Sube de nivel a ebook si tiene magias, o lo regresa a book si se las quitas todas
            if (hasEnchants && currentCiBaseItem === 'book') {
                currentCiBaseItem = 'ebook';
            } else if (!hasEnchants && currentCiBaseItem === 'ebook') {
                currentCiBaseItem = 'book';
            }
            updateCiGlow();
            // Redibuja usando la ID actual
            updateCiPreviewCanvas();
        }
    });
}

// 🔓 Casilla "Any enchantment on any item": cualquier objeto puede llevar cualquier encantamiento
// (sin la regla de en qué objetos va cada uno, ni la de los que no se pueden juntar). Se recuerda en este navegador.
function ciAnyEnchant() {
    try { return localStorage.getItem('mbw_ci_any_ench') === '1'; } catch (e) { return false; }
}
function ciSetAnyEnchant(on) {
    try { localStorage.setItem('mbw_ci_any_ench', on ? '1' : '0'); } catch (e) { /* no se recuerda */ }
    const cb = document.getElementById('ci-any-ench');
    if (cb) cb.checked = !!on;
    if (currentCiBaseItem) renderEnchantmentList();
}
window.ciSetAnyEnchant = ciSetAnyEnchant;
document.addEventListener('DOMContentLoaded', function () {
    const cb = document.getElementById('ci-any-ench');
    if (cb) cb.checked = ciAnyEnchant();
});

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