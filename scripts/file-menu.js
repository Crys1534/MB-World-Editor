// =========================================================
// 📂 FILE MENU (FULLSCREEN DYNAMIC THEMES) - CÓDIGO UNIFICADO
// =========================================================

const projectTemplates = [
	{
        filename: 'Superflat World.mbw',
        name: 'Superflat World',
        version: '1.27.1',
        seed: '153366',
        author: 'Carlos Petit',
        image: 'assets/Superflat World.png'
    },
	{
        filename: 'Biomes 1.1 - Nether Update.mbw',
        name: 'Biomes 1.1 - Nether Update',
        version: '1.31.1',
        seed: 'Crystal',
        author: 'Crystal',
        image: 'assets/Biomes 1_1 - Nether Update.png'
    },
    {
        filename: '1.31.2 - All block tiles test.mbw',
        name: '1.31.2 - All block tiles test',
        version: '1.31.2',
        seed: '150167',
        author: 'WSDguy2014',
        image: 'assets/All block tiles test.png'
    }
];

document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Pantalla Completa dependiente de los Temas */
        #backstage-menu {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: var(--bg-panel); color: var(--text);
            z-index: 999999; display: none; flex-direction: row; 
            font-family: inherit;
        }

        /* Barra Lateral Izquierda */
        .backstage-sidebar {
            width: 280px; background-color: var(--bg-header);
            display: flex; flex-direction: column;
            box-shadow: 2px 0 10px rgba(0,0,0,0.5);
            z-index: 2;
        }

        .backstage-back-btn {
            background: transparent; color: var(--text); border: none; font-size: 22px;
            text-align: left; padding: 15px 20px; cursor: pointer; font-weight: bold;
            margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .backstage-back-btn:hover { background-color: var(--input-bg); }

        .backstage-nav-btn {
            background: transparent; color: var(--text); border: none; font-size: 16px; font-weight: bold;
            text-align: left; padding: 15px 25px; cursor: pointer; transition: background 0.2s;
            border-left: 5px solid transparent; display: flex; align-items: center; gap: 10px;
        }
        .backstage-nav-btn:hover { background-color: var(--input-bg); }
        .backstage-nav-btn.active { 
            background-color: var(--bg-panel); 
            border-left: 5px solid #4DA6FF; 
            color: #4DA6FF; 
        }

        /* Área de Contenido Derecho */
        .backstage-content {
            flex: 1; padding: 50px 80px; background-color: var(--bg-panel);
            overflow-y: auto; color: var(--text);
        }

        .backstage-panel { display: none; animation: fadeIn 0.3s ease; }
        .backstage-panel.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* ✨ Estilos Unificados de Tarjetas (Usa var y efectos Hover) */
        .template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 30px; }
        .template-card {
            background-color: var(--bg-dark); border: 2px solid var(--border); border-radius: 6px;
            display: flex; flex-direction: column; cursor: pointer; overflow: hidden; height: auto; min-height: 310px;
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        .template-card:hover { 
            transform: translateY(-5px); 
            border-color: #4DA6FF; 
            box-shadow: 0 8px 20px rgba(0,0,0,0.5); 
        }
        .template-thumb {
            width: 100%; height: 160px; background-color: var(--input-bg); background-size: cover; background-position: center; 
            image-rendering: pixelated; border-bottom: 2px solid var(--border); display: flex; justify-content: center; align-items: center;
        }
        .template-info { padding: 15px; display: flex; flex-direction: column; gap: 5px; text-align: left; }
        .t-name { font-size: 18px; font-weight: bold; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t-meta { font-size: 13px; color: var(--text); opacity: 0.7; }
    `;
    document.head.appendChild(style);

    const backstageHTML = `
        <div class="backstage-sidebar">
            <button class="backstage-back-btn" onclick="closeFileMenu()"><span>⬅️</span> Back</button>
            <button id="nav-btn-my-worlds" class="backstage-nav-btn active" onclick="switchBackstageTab('my-worlds')">📁 My Worlds</button>
            <button id="nav-btn-templates" class="backstage-nav-btn" onclick="switchBackstageTab('templates')">🌍 Templates</button>
            <div style="height: 1px; background: var(--border); margin: 20px 25px;"></div>
            <button class="backstage-nav-btn" onclick="document.getElementById('file-input').click(); closeFileMenu();" style="font-weight: normal; font-size: 14px; opacity: 0.8;">📥 Load External (.mbw)</button>
            <button class="backstage-nav-btn" onclick="if(typeof fileManager !== 'undefined') fileManager.export(); closeFileMenu();" style="font-weight: normal; font-size: 14px; opacity: 0.8;">💾 Export Current</button>
        </div>
        
        <div class="backstage-content">
            <div id="panel-my-worlds" class="backstage-panel active">
                <h1 style="margin-top: 0; font-size: 42px; border-bottom: 2px solid var(--border); padding-bottom: 15px; color: var(--text);">My Worlds</h1>
                <p style="color: var(--text); opacity: 0.7; margin-bottom: 30px; font-size: 16px;">Worlds saved securely in your browser's local storage.</p>
                <div id="fs-local-worlds-list" style="display: flex; flex-direction: column; max-width: 900px;"></div>
            </div>
            <div id="panel-templates" class="backstage-panel">
                <h1 style="margin-top: 0; font-size: 42px; border-bottom: 2px solid var(--border); padding-bottom: 15px; color: var(--text);">Templates</h1>
                <p style="color: var(--text); opacity: 0.7; margin-bottom: 30px; font-size: 16px;">Start a new project from a blank canvas or a pre-built structure.</p>
                <div id="template-grid-container" class="template-grid"></div>
            </div>
        </div>
    `;
    const container = document.createElement('div');
    container.id = 'backstage-menu';
    container.innerHTML = backstageHTML;
    document.body.appendChild(container);

    generateTemplateCards();
});

// =====================================
// ✨ MOTOR ÚNICO DE TARJETAS (Unificado)
// =====================================
function createUnifiedWorldCard(data) {
    let imageStyle = data.image ? `background-image: url('${data.image}');` : '';
    let fallbackIcon = data.image ? '' : '<span style="font-size:60px; opacity:0.3; color: var(--text);">🌍</span>';
    
    let deleteBtnHTML = !data.isTemplate ? `
        <button class="delete-btn" onclick="event.stopPropagation(); deleteSavedLocalWorld('${data.name}');" 
                style="position: absolute; top: 10px; right: 10px; background: rgba(231, 76, 60, 0.9); color: white; border: 2px solid #c0392b; border-radius: 4px; width: 34px; height: 34px; font-size: 18px; cursor: pointer; display: flex; justify-content: center; align-items: center; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"
                title="Delete World">🗑️</button>
    ` : '';

    let dateHTML = data.dateStr ? `<div class="t-meta">📆 ${data.dateStr}</div>` : '';
    let sizeHTML = data.sizeStr ? `<div class="t-meta">📄 ${data.sizeStr}</div>` : '';
    let vStr = data.version ? data.version : "";
    let aStr = data.author ? data.author : "";

    return `
        <div class="template-card" style="position: relative;">
            ${deleteBtnHTML}
            <div class="template-thumb" style="${imageStyle}" onclick="${data.onClick}">
                ${fallbackIcon}
            </div>
            <div class="template-info" onclick="${data.onClick}">
                <div class="t-name" title="${data.name}">${data.name}</div>
                <div class="t-meta"><b>Version:</b> ${vStr}</div>
                <div class="t-meta"><b>Author:</b> ${aStr}</div>
                ${dateHTML}
                ${sizeHTML}
            </div>
        </div>
    `;
}

// =====================================
// LÓGICA DE INTERFAZ DEL BACKSTAGE
// =====================================
window.openFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'flex';
    switchBackstageTab('my-worlds');
};

window.closeFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'none';
};

window.switchBackstageTab = function(tabName) {
    document.querySelectorAll('.backstage-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.backstage-nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById('panel-' + tabName).classList.add('active');
    document.getElementById('nav-btn-' + tabName).classList.add('active');

    if(tabName === 'my-worlds') { renderFullscreenWorldsList(); }
};

// =====================================
// GENERAR TEMPLATES
// =====================================
function generateTemplateCards() {
    const grid = document.getElementById('template-grid-container');
    if (!grid) return;
    
    let cardsHTML = '';
    for (let t of projectTemplates) {
        cardsHTML += createUnifiedWorldCard({
            isTemplate: true,
            name: t.name,
            author: t.author,
            version: t.version,
            image: t.image,
            onClick: `loadTemplate('${t.filename}')`
        });
    }
    grid.innerHTML = cardsHTML;
}

window.loadTemplate = function(filename) {
    const url = 'dev-maps/' + filename;
    if (typeof updateLoadingBar === 'function') updateLoadingBar(10, "Downloading template...");
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("File not found");
            return response.blob();
        })
        .then(blob => {
            const file = new File([blob], filename, { type: "application/octet-stream" });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change')); 
            }
            closeFileMenu(); 
        })
        .catch(err => {
            alert("Error loading template: " + err.message);
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'none';
        });
};

// =====================================
// GENERAR MY WORLDS
// =====================================
window.renderFullscreenWorldsList = async function() {
    const listDiv = document.getElementById("fs-local-worlds-list");
    if(!listDiv) return;

    listDiv.innerHTML = "<p style='color: var(--text); font-size: 20px; font-weight:bold;'>Loading worlds...</p>";
    
    if(typeof localDB === 'undefined') {
        listDiv.innerHTML = "<p style='color:#e74c3c; font-size: 18px; font-weight:bold;'>Database engine is offline.</p>";
        return;
    }

    const worlds = await localDB.getWorlds();
    
    if(worlds.length === 0) {
        listDiv.style.cssText = "display: flex; flex-direction: column; max-width: 900px;";
        listDiv.className = "";
        listDiv.innerHTML = `
            <div style="text-align: center; padding: 60px; background: var(--bg-dark); border-radius: 12px; border: 2px dashed var(--border);">
                <div style="font-size: 60px; opacity: 0.3; margin-bottom: 15px;">📭</div>
                <h3 style="color: var(--text); font-size: 24px; margin: 0 0 10px 0;">No saved worlds yet</h3>
                <p style="color: var(--text); opacity: 0.7; font-size: 16px; font-weight: bold;">Turn on the AutoSave switch or click the floppy disk icon in the editor to save your progress.</p>
                <button onclick="switchBackstageTab('templates')" style="margin-top: 25px; padding: 10px 30px; background: #4DA6FF; color: #FFF; border: none; font-weight: bold; cursor: pointer; font-size: 16px; border-radius: 4px;">Start from a Template</button>
            </div>
        `;
        return;
    }

    worlds.sort((a, b) => b.date - a.date);
    
    listDiv.style.cssText = ""; 
    listDiv.className = "template-grid";
    let cardsHTML = '';

    worlds.forEach(w => {
        const dateObj = new Date(w.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const bytes = new Blob([w.data]).size;
        let sizeText = bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + " MB" : (bytes / 1024).toFixed(2) + " KB";

        cardsHTML += createUnifiedWorldCard({
            isTemplate: false,
            name: w.name,
            author: w.fileInfo ? w.fileInfo.author : "", 
            version: w.fileInfo ? w.fileInfo.version : "", 
            image: w.thumb,
            dateStr: dateStr,
            sizeStr: sizeText,
            onClick: `loadSavedLocalWorld('${w.name}'); closeFileMenu();`
        });
    });

    listDiv.innerHTML = cardsHTML;
};

window.deleteSavedLocalWorld = async function(name) {
    if(confirm('Are you sure you want to PERMANENTLY DELETE "'+name+'"?')) {
        await localDB.deleteWorld(name);
        renderFullscreenWorldsList(); 
    }
};