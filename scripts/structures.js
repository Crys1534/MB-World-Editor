/* SISTEMA DE ESTRUCTURAS - DATABASE Y LÓGICA */

const defaultStructures = [
  {
    title: "Tree 1",
    author: "Mine Blocks",
    category: "vanilla",
    subcategory: "Structure",
    data: [
      { "dx": 0, "dy": 4, "state": { "type": "lv" } },
      { "dx": 0, "dy": 5, "state": { "type": "lv" } },
      { "dx": 1, "dy": 3, "state": { "type": "lv" } },
      { "dx": 1, "dy": 4, "state": { "type": "lv" } },
      { "dx": 1, "dy": 5, "state": { "type": "lv" } },
      { "dx": 1, "dy": 6, "state": { "type": "lv" } },
      { "dx": 2, "dy": 0, "state": { "type": "wd1" } },
      { "dx": 2, "dy": 1, "state": { "type": "wd1" } },
      { "dx": 2, "dy": 2, "state": { "type": "wd1" } },
      { "dx": 2, "dy": 3, "state": { "type": "wd1" } },
      { "dx": 2, "dy": 4, "state": { "type": "wd1" } },
      { "dx": 2, "dy": 5, "state": { "type": "lv" } },
      { "dx": 2, "dy": 6, "state": { "type": "lv" } },
      { "dx": 3, "dy": 3, "state": { "type": "lv" } },
      { "dx": 3, "dy": 4, "state": { "type": "lv" } },
      { "dx": 3, "dy": 5, "state": { "type": "lv" } },
      { "dx": 3, "dy": 6, "state": { "type": "lv" } },
      { "dx": 4, "dy": 4, "state": { "type": "lv" } },
      { "dx": 4, "dy": 5, "state": { "type": "lv" } }
    ],
  }
];

let structureDB = [...defaultStructures];
let currentStructCategory = 'saved'; 
let currentStructSubCategory = 'all'; 
let selectedStructure = null;
let tempSaveData = null; 
let isInputBlocked = false; // Flag maestro para bloqueo de teclado

// --- CARGA ---
function loadSavedStructures() {
    try {
        const savedJson = localStorage.getItem('mbw_saved_structures');
        if (savedJson) {
            const savedItems = JSON.parse(savedJson);
            structureDB = [...defaultStructures, ...savedItems];
            console.log(`Loaded ${savedItems.length} custom structures.`);
        }
    } catch (e) { console.error(e); }
    
    // Actualizar el ribbon al iniciar
    updateRibbonQuickAccess();
}
loadSavedStructures();

// --- KEYBOARD TRAP (BLOQUEO DE TECLAS) ---
window.addEventListener('keydown', function(e) {
    if (isInputBlocked) {
        // 1. Permitir F12 para depuración
        if (e.key === 'F12') return;

        // 2. Permitir interacción normal dentro de Inputs/Selects
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
            // Permitir que Escape cierre el modal incluso estando en un input
            if (e.key === 'Escape') {
                closeModal('save-structure-modal');
                closeModal('structures-modal');
            }
            return; 
        }

        // 3. Cerrar modales con Escape si no estamos escribiendo
        if (e.key === 'Escape') {
            closeModal('save-structure-modal');
            closeModal('structures-modal');
        }

        // 4. Bloquear todo lo demás
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
}, true); 

// --- IMPORT/EXPORT/RESET ---
function exportSavedStructures() {
    const savedStructs = structureDB.filter(s => s.category === 'saved');
    if (savedStructs.length === 0) { alert("No saved structures."); return; }
    
    const blob = new Blob([JSON.stringify(savedStructs, null, 2)], { type: "application/json" });
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
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error("Not an array");
            let count = 0;
            imported.forEach(s => {
                if (s.title && s.data) {
                    s.category = 'saved';
                    structureDB.push(s);
                    count++;
                }
            });
            updateLocalStorage();
            filterStructures('saved', 'all');
            alert(`Imported ${count} structures.`);
            
            // Actualizar el ribbon tras importar
            updateRibbonQuickAccess();
        } catch (err) { alert("Error importing file."); }
    };
    reader.readAsText(file);
    input.value = '';
}

function resetSavedStructures() {
    if (confirm("Delete ALL saved structures?")) {
        structureDB = structureDB.filter(s => s.category !== 'saved');
        updateLocalStorage();
        filterStructures('saved', 'all');
        
        // Actualizar el ribbon tras resetear
        updateRibbonQuickAccess();
    }
}

// --- GESTIÓN DE MODALES Y BLOQUEO ---
function openStructuresModal() {
    document.getElementById('structures-modal').style.display = 'flex';
    isInputBlocked = true; 
    filterStructures('saved', 'all');
}

// Override seguro para liberar teclado al cerrar
const originalCloseModal = window.closeModal;
window.closeModal = function(modalId) {
    if (modalId === 'structures-modal' || modalId === 'save-structure-modal') {
        isInputBlocked = false; 
    }
    
    if (typeof originalCloseModal === 'function') {
        originalCloseModal(modalId);
    } else {
        const m = document.getElementById(modalId);
        if(m) m.style.display = 'none';
    }
}

// DETECTOR DE CLIC FUERA
window.addEventListener('click', function(e) {
    if (e.target.id === 'structures-modal') {
        closeModal('structures-modal');
    }
    if (e.target.id === 'save-structure-modal') {
        closeModal('save-structure-modal');
    }
});

function filterStructures(category, subcategory = null) {
    currentStructCategory = category;
    if (subcategory) currentStructSubCategory = subcategory;

    document.querySelectorAll('.struct-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-struct-${category}`).classList.add('active');

    const subtabs = document.getElementById('struct-subtabs');
    if (category === 'community' || category === 'saved') { 
        subtabs.style.display = 'flex'; 
    } else { 
        subtabs.style.display = 'none'; 
        currentStructSubCategory = null; 
    }

    const actionsDiv = document.getElementById('struct-saved-actions');
    if (actionsDiv) actionsDiv.style.display = (category === 'saved') ? 'flex' : 'none';

    selectedStructure = null;
    document.getElementById('struct-info-title').innerText = "Select an item";
    document.getElementById('struct-info-author').innerText = "-";
    document.getElementById('struct-info-sub').innerText = "-";
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
        grid.innerHTML = '<div style="color:#FFF; grid-column: 1/-1; text-align:center; padding-top:20px;">No structures found.</div>';
        return;
    }

    filtered.forEach(struct => {
        const item = document.createElement('div');
        item.className = 'struct-item';
        
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 64; previewCanvas.height = 64;
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
    document.getElementById('struct-info-author').innerText = struct.author;
    document.getElementById('struct-info-sub').innerText = struct.subcategory || 'Misc';
    
    const canvas = document.getElementById('struct-preview-canvas');
    canvas.style.imageRendering = 'pixelated';
    renderPreviewOnCanvas(canvas, struct.data, true);

    const btnDel = document.getElementById('btn-delete-struct');
    if (btnDel) btnDel.style.display = (struct.category === 'saved') ? 'block' : 'none';
}

function loadStructureToClipboard() {
    if (!selectedStructure) return;
    loadSpecificStructure(selectedStructure);
    closeModal('structures-modal'); 
}

function deleteSavedStructure() {
    if (!selectedStructure || selectedStructure.category !== 'saved') return;
    if (!confirm(`Delete "${selectedStructure.title}"?`)) return;
    structureDB = structureDB.filter(s => s !== selectedStructure);
    updateLocalStorage();
    filterStructures('saved', 'all');
    
    // Actualizar el ribbon tras borrar
    updateRibbonQuickAccess();
}

function updateLocalStorage() {
    try {
        const toSave = structureDB.filter(s => s.category === 'saved');
        localStorage.setItem('mbw_saved_structures', JSON.stringify(toSave));
    } catch (e) {
        console.error("Save failed:", e);
        alert("Error: Storage might be full.");
    }
}

// --- SAVE MODAL ---
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
            if (typeof isPointSelected === 'function') {
                 if (!isPointSelected(x,y)) continue;
            } else if (window.selection.type === 'poly') { 
                 if (!isPointInPolygon(x, y, window.selection.path)) continue; 
            }
            
            const state = mbwom.getBlockState(x, y);
            if (state && state.type != null) {
                data.push({ dx: x - minX, dy: y - minY, state: JSON.parse(JSON.stringify(state)) });
            }
        }
    }
    
    if (data.length === 0) { alert("Area empty!"); return; }

    tempSaveData = data;
    
    // BLOQUEAR UI GLOBAL
    isInputBlocked = true; 
    document.getElementById('save-structure-modal').style.display = 'flex';
    document.getElementById('input-struct-title').value = '';
    
    // BLOQUEAR PROPAGACIÓN EN INPUTS LOCALES
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
    
    filterStructures('saved', 'all');
    closeModal('save-structure-modal'); 
    alert("Saved!");
    
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = []; window.selection.subRects = [];
    if(typeof checkSelectionState === 'function') checkSelectionState();

    // Actualizar el ribbon tras guardar
    updateRibbonQuickAccess();
}

function renderPreviewOnCanvas(canvas, blockData, fit = true, forceCover = false) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#333"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!blockData || blockData.length === 0) return;
    
    const xs = blockData.map(b => b.dx); const ys = blockData.map(b => b.dy);
    const w = Math.max(...xs) - Math.min(...xs) + 1;
    const h = Math.max(...ys) - Math.min(...ys) + 1;

    let tileSize = 16;
    if (forceCover) {
        let m = 2; 
        while ((w * m * 16 < canvas.width) && (h * m * 16 < canvas.height)) m += 2;
        tileSize = 16 * m;
    } else if (fit) {
        const maxSize = Math.max(w, h);
        tileSize = Math.floor(Math.min(canvas.width, canvas.height) / maxSize);
        if (tileSize < 1) tileSize = 1;
    }

    const totalW = w * tileSize; const totalH = h * tileSize;
    const offsetX = (canvas.width - totalW) / 2;
    const offsetY = (canvas.height - totalH) / 2;
    const imgs = window.images;

    blockData.forEach(block => {
        const drawX = offsetX + block.dx * tileSize;
        const drawY = canvas.height - (offsetY + block.dy * tileSize) - tileSize;
        if (imgs && imgs.blocks && imgs.blocks.complete) {
            try {
                const renderer = window.blockData ? window.blockData[block.state.type] : null;
                if (renderer) {
                    const tex = renderer(block.state);
                    ctx.drawImage(imgs.blocks, tex.x, tex.y, 16, 16, drawX, drawY, tileSize, tileSize);
                } else ctx.fillStyle = '#888', ctx.fillRect(drawX, drawY, tileSize, tileSize);
            } catch(e) { ctx.fillStyle = '#F0F'; ctx.fillRect(drawX, drawY, tileSize, tileSize); }
        } else { ctx.fillStyle = '#555'; ctx.fillRect(drawX, drawY, tileSize, tileSize); }
    });
}

// ==========================================
// 🆕 LÓGICA PARA QUICK ACCESS EN EL RIBBON
// ==========================================

function updateRibbonQuickAccess() {
    const container = document.getElementById('recent-structures-ribbon');
    if (!container) return;
    
    container.innerHTML = ''; // Limpiar contenedor

    // Filtrar solo las guardadas ('saved')
    const savedStructs = structureDB.filter(s => s.category === 'saved');
    
    // Obtener las últimas 4 (usando slice y reverse para que la más nueva salga primero)
    const last3 = savedStructs.slice(-4).reverse();

    if (last3.length === 0) {
        container.innerHTML = '<span style="font-size: 10px; color: #555; font-style: italic; padding: 0 5px;">No saved items</span>';
        return;
    }

    last3.forEach(struct => {
        // Crear botón contenedor
        const btn = document.createElement('button');
        btn.className = 'ribbon-btn-small'; // Reusamos estilo
        btn.title = `Load "${struct.title}"`;
        btn.style.width = '66px';
        btn.style.height = '66px';
        btn.style.padding = '2px';
        btn.style.border = '1px solid #555';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.justifyContent = 'center';
        btn.style.alignItems = 'center';
        btn.style.background = '#8B8B8B';

        // Crear Canvas para la preview
        const canvas = document.createElement('canvas');
        canvas.width = 60;
        canvas.height = 60;
        
        // Renderizar la estructura (delay para asegurar carga)
        setTimeout(() => {
             renderPreviewOnCanvas(canvas, struct.data, true); 
        }, 100);

        // Evento Click: Cargar al portapapeles directamente
        btn.onclick = () => loadSpecificStructure(struct);

        btn.appendChild(canvas);
        container.appendChild(btn);
    });
}

// Función auxiliar para cargar sin abrir el modal
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
    
    activatePasteMode(); // Activa la herramienta de pegar del tools.js
    
    console.log(`Structure "${struct.title}" loaded to clipboard.`);
}