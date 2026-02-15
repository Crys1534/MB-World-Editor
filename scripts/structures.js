/* SISTEMA DE ESTRUCTURAS MEJORADO */

// --- BASE DE DATOS DE ESTRUCTURAS ---
const structureDB = [
    {
        "title": "Oak Tree",
        "author": "System",
        "category": "vanilla",
        "subcategory": "nature",
        "data": [
            { "dx": 0, "dy": 0, "state": { "type": "tob" } },
            { "dx": 0, "dy": 1, "state": { "type": "tob" } },
            { "dx": 0, "dy": 2, "state": { "type": "tob" } },
            { "dx": -1, "dy": 3, "state": { "type": "l" } },
            { "dx": 0, "dy": 3, "state": { "type": "l" } },
            { "dx": 1, "dy": 3, "state": { "type": "l" } },
            { "dx": -1, "dy": 4, "state": { "type": "l" } },
            { "dx": 0, "dy": 4, "state": { "type": "l" } },
            { "dx": 1, "dy": 4, "state": { "type": "l" } },
            { "dx": 0, "dy": 5, "state": { "type": "l" } }
        ]
    }


    // PEGA AQUÍ TUS ESTRUCTURAS DE LA CONSOLA...
];

let currentStructCategory = 'community';
let currentStructSubCategory = 'all'; 
let selectedStructure = null;
let tempSaveData = null; 

// --- GESTIÓN DE TEMAS ---
function updateStructureTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.style.setProperty('--struct-bg', '#333'); root.style.setProperty('--struct-bg-dark', '#222');
        root.style.setProperty('--struct-text', '#fff'); root.style.setProperty('--struct-border', '#555');
        root.style.setProperty('--struct-item-bg', '#444'); root.style.setProperty('--struct-accent', '#fff');
    } else if (theme === 'white') {
        root.style.setProperty('--struct-bg', '#f0f0f0'); root.style.setProperty('--struct-bg-dark', '#e0e0e0');
        root.style.setProperty('--struct-text', '#000'); root.style.setProperty('--struct-border', '#ccc');
        root.style.setProperty('--struct-item-bg', '#fff'); root.style.setProperty('--struct-accent', '#000');
    } else if (theme === 'pastel') {
        root.style.setProperty('--struct-bg', '#fdf6e3'); root.style.setProperty('--struct-bg-dark', '#eee8d5');
        root.style.setProperty('--struct-text', '#586e75'); root.style.setProperty('--struct-border', '#93a1a1');
        root.style.setProperty('--struct-item-bg', '#fff'); root.style.setProperty('--struct-accent', '#2aa198');
    } else if (theme === 'darkblue') {
        root.style.setProperty('--struct-bg', '#002b36'); root.style.setProperty('--struct-bg-dark', '#073642');
        root.style.setProperty('--struct-text', '#839496'); root.style.setProperty('--struct-border', '#586e75');
        root.style.setProperty('--struct-item-bg', '#002b36'); root.style.setProperty('--struct-accent', '#268bd2');
    }
}

// --- BROWSER MODAL ---
function openStructuresModal() {
    const themeSelect = document.getElementById('theme-select');
    if(themeSelect) updateStructureTheme(themeSelect.value);
    document.getElementById('structures-modal').style.display = 'flex';
    filterStructures('community'); 
}

function filterStructures(category, subcategory = null) {
    currentStructCategory = category;
    if (subcategory) currentStructSubCategory = subcategory;
    
    document.querySelectorAll('.struct-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-struct-${category}`).classList.add('active');

    const subtabs = document.getElementById('struct-subtabs');
    if (category === 'community') { subtabs.style.display = 'flex'; } 
    else { subtabs.style.display = 'none'; currentStructSubCategory = null; }
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
            return item.subcategory.toLowerCase() === currentStructSubCategory.toLowerCase();
        }
        return true;
    });

    filtered.forEach((struct) => {
        const item = document.createElement('div');
        item.className = 'struct-item';
        
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 64; thumbCanvas.height = 64; thumbCanvas.style.marginBottom = "5px";
        setTimeout(() => renderPreviewOnCanvas(thumbCanvas, struct.data, true), 10);

        const name = document.createElement('div');
        name.className = 'struct-name'; name.innerText = struct.title;

        item.appendChild(thumbCanvas); item.appendChild(name);
        item.onclick = () => selectStructure(struct);
        grid.appendChild(item);
    });
}

function selectStructure(struct) {
    selectedStructure = struct;
    document.getElementById('struct-info-title').innerText = struct.title;
    document.getElementById('struct-info-author').innerText = "Author: " + struct.author;
    const canvas = document.getElementById('struct-preview-canvas');
    renderPreviewOnCanvas(canvas, struct.data, true); 
}

function loadStructureToClipboard() {
    if (!selectedStructure) return;
    const xs = selectedStructure.data.map(b => b.dx); const ys = selectedStructure.data.map(b => b.dy);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const height = Math.max(...ys) - Math.min(...ys) + 1;
    window.clipboard = { width: width, height: height, data: JSON.parse(JSON.stringify(selectedStructure.data)) };
    closeModal('structures-modal');
    activatePasteMode(); 
    showNotification("Structure loaded to cursor!");
}

// --- SAVE MODAL ---
function openSaveStructureModal() {
    const themeSelect = document.getElementById('theme-select');
    if(themeSelect) updateStructureTheme(themeSelect.value);

    if (!window.selection.p1 || (!window.selection.p2 && window.selection.path.length === 0)) {
        showNotification("Select an area first!", true); return;
    }

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
                data.push({ dx: x - minX, dy: y - minY, state: structuredClone(state) });
            }
        }
    }

    if (data.length === 0) { showNotification("Area empty!", true); return; }

    tempSaveData = data;
    document.getElementById('save-structure-modal').style.display = 'flex';
    document.getElementById('input-struct-title').value = '';
    document.getElementById('input-struct-author').value = 'User';
    document.getElementById('input-struct-category').value = 'community';
    document.getElementById('input-struct-subcategory').value = 'House';

    const canvas = document.getElementById('struct-save-preview');
    renderPreviewOnCanvas(canvas, tempSaveData, false, true); 
}

function saveNewStructure() {
    const title = document.getElementById('input-struct-title').value.trim();
    const author = document.getElementById('input-struct-author').value.trim();
    const category = document.getElementById('input-struct-category').value;
    const subcategory = document.getElementById('input-struct-subcategory').value;

    if (!title) { showNotification("Please enter a title.", true); return; }

    const newStruct = {
        title: title, author: author || "Anonymous", category: category, subcategory: subcategory, data: tempSaveData
    };

    structureDB.push(newStruct);
    
    // --- FORMATO PERSONALIZADO PARA LA CONSOLA ---
    // Construimos el string manualmente para obtener el formato compacto
    let output = `    {\n`;
    output += `        "title": "${newStruct.title}",\n`;
    output += `        "author": "${newStruct.author}",\n`;
    output += `        "category": "${newStruct.category}",\n`;
    output += `        "subcategory": "${newStruct.subcategory}",\n`;
    output += `        "data": [\n`;
    
    // Mapeamos cada bloque a una línea con espacios bonitos
    const dataLines = newStruct.data.map(block => {
        // Convertimos a JSON y agregamos espacios después de : y ,
        let line = JSON.stringify(block);
        line = line.replace(/:/g, ': ').replace(/,/g, ', ');
        return `            ${line}`;
    });
    
    output += dataLines.join(",\n");
    output += `\n        ]\n    },`;

    console.clear();
    console.log("%c STRUCTURE SAVED! COPY BELOW:", "color: lime; font-size: 14px; font-weight: bold;");
    console.log(output); 
    console.log("%c Paste this into structureDB inside scripts/structures.js", "color: #aaa;");
    // ---------------------------------------------

    closeModal('save-structure-modal');
    showNotification("Structure saved! Check Console (F12)");
    
    window.selection.p1 = null; window.selection.p2 = null; window.selection.path = [];
    if(typeof checkSelectionState === 'function') checkSelectionState();
}

// --- RENDERIZADO PREVIEW ---
function renderPreviewOnCanvas(canvas, blockData, fit = true, forceCover = false) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!blockData || blockData.length === 0) return;

    const xs = blockData.map(b => b.dx); const ys = blockData.map(b => b.dy);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const height = Math.max(...ys) - Math.min(...ys) + 1;

    let tileSize = 16;
    if (forceCover) {
        let multiplier = 2;
        while ((width * multiplier * 16 < canvas.width) && (height * multiplier * 16 < canvas.height)) { multiplier += 2; }
        tileSize = 16 * multiplier;
    } else if (fit) {
        const maxSize = Math.max(width, height);
        tileSize = Math.floor((Math.min(canvas.width, canvas.height) - 4) / maxSize);
        if (tileSize < 1) tileSize = 1;
    }

    const totalW = width * tileSize; const totalH = height * tileSize;
    const offsetX = (canvas.width - totalW) / 2;
    const offsetY = (canvas.height - totalH) / 2;
    ctx.imageSmoothingEnabled = false;

    blockData.forEach(block => {
        const drawX = offsetX + block.dx * tileSize;
        const drawY = canvas.height - (offsetY + block.dy * tileSize) - tileSize;

        if (window.images && window.images.blocks && window.blockData) {
            try {
                const renderer = window.blockData[block.state.type];
                if (renderer) {
                    const tex = renderer(block.state);
                    ctx.drawImage(window.images.blocks, tex.x, tex.y, 16, 16, drawX, drawY, tileSize, tileSize);
                } else { ctx.fillStyle = '#FF00FF'; ctx.fillRect(drawX, drawY, tileSize, tileSize); }
            } catch(e) { }
        } else { ctx.fillStyle = '#888'; ctx.fillRect(drawX, drawY, tileSize, tileSize); }
    });
}

// --- NOTIFICACIÓN NATIVA ---
function showNotification(message, isError = false) {
    let notif = document.getElementById('native-notification');
    if (!notif) {
        notif = document.createElement('div'); notif.id = 'native-notification'; document.body.appendChild(notif);
    }
    notif.innerText = message; notif.style.backgroundColor = isError ? '#d32f2f' : '#4CAF50';
    notif.classList.add('show');
    setTimeout(() => { notif.classList.remove('show'); }, 3000);
}