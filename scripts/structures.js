/* SISTEMA DE ESTRUCTURAS - DATABASE Y LÓGICA */

// 1. Estructuras por defecto (Vanilla/System)
const defaultStructures = [
    {
        title: "Oak Tree",
        author: "System",
        category: "vanilla",
        subcategory: "nature",
        data: [
            {dx:0, dy:0, state:{type:"tob"}}, {dx:0, dy:1, state:{type:"tob"}}, {dx:0, dy:2, state:{type:"tob"}},
            {dx:-1, dy:3, state:{type:"l"}}, {dx:0, dy:3, state:{type:"l"}}, {dx:1, dy:3, state:{type:"l"}},
            {dx:-1, dy:4, state:{type:"l"}}, {dx:0, dy:4, state:{type:"l"}}, {dx:1, dy:4, state:{type:"l"}},
            {dx:0, dy:5, state:{type:"l"}}
        ]
    }
];

// Array en memoria que combina defecto + guardadas
let structureDB = [...defaultStructures];

let currentStructCategory = 'saved'; 
let currentStructSubCategory = 'all'; 
let selectedStructure = null;
let tempSaveData = null; 
let isStructuresModalOpen = false; // Flag para control de teclado

// --- CARGAR DATOS PERSISTENTES ---
function loadSavedStructures() {
    try {
        const savedJson = localStorage.getItem('mbw_saved_structures');
        if (savedJson) {
            const savedItems = JSON.parse(savedJson);
            // Reconstruimos la DB combinando defecto + localStorage
            structureDB = [...defaultStructures, ...savedItems];
            console.log(`Loaded ${savedItems.length} custom structures from storage.`);
        }
    } catch (e) {
        console.error("Error loading structures:", e);
    }
}
loadSavedStructures();

// --- SISTEMA DE BLOQUEO DE ATAJOS (KEYBOARD TRAP) ---
window.addEventListener('keydown', function(e) {
    if (isStructuresModalOpen) {
        // Permitir F12 (DevTools) y Escape (Cerrar modal)
        if (e.key === 'F12' || e.key === 'Escape') return;

        // Detener cualquier otro atajo (WASD, Herramientas, etc.)
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
}, true); // Use Capture Phase para interceptar antes que otros scripts

// --- IMPORTAR / EXPORTAR / RESET ---

function exportSavedStructures() {
    const savedStructs = structureDB.filter(s => s.category === 'saved');
    if (savedStructs.length === 0) {
        alert("No saved structures found to export.");
        return;
    }
    const dataStr = JSON.stringify(savedStructs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mbw_structures_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importStructures() {
    document.getElementById('import-struct-input').click();
}

function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) {
                alert("Invalid file format. Expected a JSON array.");
                return;
            }

            let addedCount = 0;
            importedData.forEach(struct => {
                // Validación básica: debe tener titulo y datos
                if (struct.title && struct.data) {
                    // Forzar categoría 'saved' para que aparezcan en la pestaña correcta
                    // aunque vengan de otro usuario
                    struct.category = 'saved';
                    structureDB.push(struct);
                    addedCount++;
                }
            });

            updateLocalStorage();
            filterStructures('saved'); // Refrescar vista
            alert(`Successfully imported ${addedCount} structures.`);
        } catch (err) {
            console.error(err);
            alert("Error parsing JSON file.");
        }
    };
    reader.readAsText(file);
    input.value = ''; // Limpiar para permitir re-importar el mismo archivo
}

function resetSavedStructures() {
    if (!confirm("WARNING: This will delete ALL your saved structures.\nThis action cannot be undone.\nAre you sure?")) {
        return;
    }
    
    // Filtramos para dejar SOLO las que NO son 'saved' (es decir, las vanilla)
    structureDB = structureDB.filter(s => s.category !== 'saved');
    
    updateLocalStorage();
    filterStructures('saved');
}

// --- BROWSER MODAL ---
function openStructuresModal() {
    const modal = document.getElementById('structures-modal');
    modal.style.display = 'flex';
    isStructuresModalOpen = true; // Activar bloqueo de teclas
    
    // Abrir directamente en la pestaña "Saved"
    filterStructures('saved'); 
}

// Interceptamos el cierre del modal para liberar el teclado
const originalCloseModal = window.closeModal;
window.closeModal = function(modalId) {
    if (modalId === 'structures-modal' || modalId === 'save-structure-modal') {
        isStructuresModalOpen = false; // Desactivar bloqueo
    }
    if (originalCloseModal) originalCloseModal(modalId);
    else {
        const modal = document.getElementById(modalId);
        if(modal) modal.style.display = 'none';
    }
}

function filterStructures(category, subcategory = null) {
    currentStructCategory = category;
    if (subcategory) currentStructSubCategory = subcategory;

    document.querySelectorAll('.struct-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById(`tab-struct-${category}`);
    if(activeTab) activeTab.classList.add('active');

    // Manejo de subpestañas
    const subtabs = document.getElementById('struct-subtabs');
    if (category === 'community') { 
        subtabs.style.display = 'flex'; 
    } else { 
        subtabs.style.display = 'none'; 
        currentStructSubCategory = null; 
    }

    // --- MANEJO DE BOTONES DE ACCIÓN ---
    const actionsDiv = document.getElementById('struct-saved-actions');
    if (actionsDiv) {
        // Solo mostrar botones Export/Import/Reset en la pestaña SAVED
        actionsDiv.style.display = (category === 'saved') ? 'flex' : 'none';
    }

    // Resetear selección
    selectedStructure = null;
    document.getElementById('struct-info-title').innerText = "Select an item";
    document.getElementById('struct-info-author').innerText = "";
    document.getElementById('struct-info-sub').innerText = "";
    document.getElementById('btn-delete-struct').style.display = 'none';
    
    const canvas = document.getElementById('struct-preview-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    renderStructureGrid();
}

function filterSubCategory(sub) {
    currentStructSubCategory = sub;
    document.querySelectorAll('.struct-subtab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(`subtab-${sub}`);
    if(tab) tab.classList.add('active');
    renderStructureGrid();
}

function renderStructureGrid() {
    const grid = document.getElementById('structures-grid');
    grid.innerHTML = ''; 
    
    const filtered = structureDB.filter(item => {
        if (item.category !== currentStructCategory) return false;
        if (currentStructSubCategory && currentStructSubCategory !== 'all') {
            return item.subcategory && item.subcategory.toLowerCase() === currentStructSubCategory.toLowerCase();
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="color:#888; grid-column: 1/-1; text-align:center; padding-top:20px;">No structures found.</div>';
        return;
    }

    filtered.forEach(struct => {
        const item = document.createElement('div');
        item.className = 'struct-item';
        
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 64; 
        previewCanvas.height = 64;
        previewCanvas.style.marginBottom = '5px';
        previewCanvas.style.imageRendering = 'pixelated'; 
        
        renderPreviewOnCanvas(previewCanvas, struct.data, true);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'struct-name';
        nameDiv.innerText = struct.title;

        item.appendChild(previewCanvas);
        item.appendChild(nameDiv);

        item.onclick = () => selectStructure(struct);
        grid.appendChild(item);
    });
}

function selectStructure(struct) {
    selectedStructure = struct;
    document.getElementById('struct-info-title').innerText = struct.title;
    document.getElementById('struct-info-author').innerText = "Author: " + struct.author;
    if(document.getElementById('struct-info-sub')) {
        document.getElementById('struct-info-sub').innerText = `Type: ${struct.subcategory}`;
    }
    
    const canvas = document.getElementById('struct-preview-canvas');
    canvas.style.imageRendering = 'pixelated';
    renderPreviewOnCanvas(canvas, struct.data, true);

    const btnDel = document.getElementById('btn-delete-struct');
    if (btnDel) {
        btnDel.style.display = (struct.category === 'saved') ? 'block' : 'none';
    }
}

function loadStructureToClipboard() {
    if (!selectedStructure) return;
    const xs = selectedStructure.data.map(b => b.dx); const ys = selectedStructure.data.map(b => b.dy);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const height = Math.max(...ys) - Math.min(...ys) + 1;
    window.clipboard = { width: width, height: height, data: JSON.parse(JSON.stringify(selectedStructure.data)) };
    
    closeModal('structures-modal');
    activatePasteMode(); 
}

function deleteSavedStructure() {
    if (!selectedStructure || selectedStructure.category !== 'saved') return;
    if (!confirm(`Permanently delete "${selectedStructure.title}"?`)) return;

    structureDB = structureDB.filter(s => s !== selectedStructure);
    updateLocalStorage();
    filterStructures('saved');
}

function updateLocalStorage() {
    const toSave = structureDB.filter(s => s.category === 'saved');
    localStorage.setItem('mbw_saved_structures', JSON.stringify(toSave));
}

// --- SAVE MODAL ---
function openSaveStructureModal() {
    if (!window.selection.p1 || (!window.selection.p2 && window.selection.path.length === 0)) {
        alert("Select an area first!"); return;
    }
    
    isStructuresModalOpen = true; // Bloquear teclado

    let minX, maxX, minY, maxY;
    if (window.selection.type === 'poly') {
        const xs = window.selection.path.map(p => p.x); const ys = window.selection.path.map(p => p.y);
        minX = Math.min(...xs); maxX = Math.max(...xs); minY = Math.min(...ys); maxY = Math.max(...ys);
    } else {
        minX = Math.min(window.selection.p1.x, window.selection.p2.x); maxX = Math.max(window.selection.p1.x, window.selection.p2.x);
        minY = Math.min(window.selection.p1.y, window.selection.p2.y); maxY = Math.max(window.selection.p1.y, window.selection.p2.y);
    }

    const data = [];
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            if (window.selection.type === 'poly') { if (!isPointInPolygon(x, y, window.selection.path)) continue; }
            const state = mbwom.getBlockState(x, y);
            if (state && state.type != null) {
                const clonedState = JSON.parse(JSON.stringify(state));
                data.push({ dx: x - minX, dy: y - minY, state: clonedState });
            }
        }
    }
    if (data.length === 0) { 
        alert("Area empty!"); 
        isStructuresModalOpen = false; // Desbloquear si cancelamos por error
        return; 
    }

    tempSaveData = data;
    document.getElementById('save-structure-modal').style.display = 'flex';
    document.getElementById('input-struct-title').value = '';
    document.getElementById('input-struct-author').value = 'User';
    
    const canvas = document.getElementById('struct-save-preview');
    canvas.style.imageRendering = 'pixelated';
    renderPreviewOnCanvas(canvas, tempSaveData, false, true); 
}

function saveNewStructure() {
    const title = document.getElementById('input-struct-title').value.trim();
    const author = document.getElementById('input-struct-author').value.trim();
    const category = 'saved';
    const subcategory = document.getElementById('input-struct-subcategory').value;

    if (!title) { alert("Please enter a title."); return; }

    const newStruct = {
        title: title, author: author || "Anonymous", category: category, subcategory: subcategory,
        data: tempSaveData, timestamp: Date.now()
    };

    structureDB.push(newStruct);
    updateLocalStorage();
    closeModal('save-structure-modal');
    alert("Structure saved successfully!");
    
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = [];
    if(typeof checkSelectionState === 'function') checkSelectionState();
}

// --- ENGINE RENDERIZADO PREVIEW ---
function renderPreviewOnCanvas(canvas, blockData, fit = true, forceCover = false) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#333"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!blockData || blockData.length === 0) return;

    const xs = blockData.map(b => b.dx); const ys = blockData.map(b => b.dy);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const height = Math.max(...ys) - Math.min(...ys) + 1;

    let tileSize = 16;
    if (forceCover) {
        let multiplier = 2; 
        while ((width * multiplier * 16 < canvas.width) && (height * multiplier * 16 < canvas.height)) {
            multiplier += 2;
        }
        tileSize = 16 * multiplier;
    } else if (fit) {
        const maxSize = Math.max(width, height);
        tileSize = Math.floor(Math.min(canvas.width, canvas.height) / maxSize);
        if (tileSize < 1) tileSize = 1;
    }

    const totalW = width * tileSize; const totalH = height * tileSize;
    const offsetX = (canvas.width - totalW) / 2;
    const offsetY = (canvas.height - totalH) / 2;
    const imgs = window.images;

    blockData.forEach(block => {
        const drawX = offsetX + block.dx * tileSize;
        const drawY = canvas.height - (offsetY + block.dy * tileSize) - tileSize;

        if (imgs && imgs.blocks && imgs.blocks.complete && imgs.blocks.naturalWidth !== 0) {
            try {
                const renderer = window.blockData ? window.blockData[block.state.type] : null;
                if (renderer) {
                    const tex = renderer(block.state);
                    ctx.drawImage(imgs.blocks, tex.x, tex.y, 16, 16, drawX, drawY, tileSize, tileSize);
                } else {
                    ctx.fillStyle = '#888'; ctx.fillRect(drawX, drawY, tileSize, tileSize);
                }
            } catch(e) {
                ctx.fillStyle = '#F0F'; ctx.fillRect(drawX, drawY, tileSize, tileSize);
            }
        } else {
            ctx.fillStyle = '#555'; ctx.fillRect(drawX, drawY, tileSize, tileSize);
        }
    });
}