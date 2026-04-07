// =========================================================
// 📂 FILE MENU (FULLSCREEN BACKSTAGE)
// =========================================================

// 1. Tus mundos de plantilla
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
    // 2. INYECTAR CSS ADAPTATIVO DEL BACKSTAGE
    const style = document.createElement('style');
    style.innerHTML = `
        /* Pantalla Completa usando colores del Theme */
        #backstage-menu {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: var(--bg-panel); color: var(--text);
            z-index: 999999; display: none; flex-direction: row; 
            font-family: inherit;
        }

        /* Barra Lateral Izquierda */
        .backstage-sidebar {
            width: 280px; background-color: var(--bg-header);
            display: flex; flex-direction: column; padding-top: 10px;
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
            border-left: 5px solid transparent;
            display: flex; align-items: center; gap: 10px;
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

        /* Estilos de Tarjetas (Templates) */
        .template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 30px; }
        .template-card {
            background-color: var(--bg-dark); border: 2px solid var(--border); border-radius: 6px;
            display: flex; flex-direction: column; cursor: pointer;
            transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); height: 290px;
        }
        .template-card:hover { transform: translateY(-5px); border-color: #4DA6FF; box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
        .template-thumb {
            width: 100%; height: 160px; background-color: var(--input-bg);
            background-size: cover; background-position: center; image-rendering: pixelated;
            border-bottom: 2px solid var(--border); display: flex; justify-content: center; align-items: center;
        }
        .template-info { padding: 15px; display: flex; flex-direction: column; gap: 5px; text-align: left; }
        .t-name { font-size: 18px; font-weight: bold; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t-meta { font-size: 13px; color: var(--text); opacity: 0.7; }

        /* Estilos de Lista (My Worlds) */
        .local-world-item {
            display: flex; justify-content: space-between; align-items: center;
            background: var(--bg-dark); border: 2px solid var(--border);
            padding: 20px; border-radius: 8px; margin-bottom: 15px;
            transition: all 0.2s ease; box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        }
        .local-world-item:hover { border-color: #4DA6FF; transform: translateX(5px); }
    `;
    document.head.appendChild(style);

    // 3. INYECTAR ESTRUCTURA HTML A PANTALLA COMPLETA
    const backstageHTML = `
        <div class="backstage-sidebar">
            <button class="backstage-back-btn" onclick="closeFileMenu()">
                <span>⬅️</span> Back
            </button>
            <button id="nav-btn-my-worlds" class="backstage-nav-btn active" onclick="switchBackstageTab('my-worlds')">📁 My Worlds</button>
            <button id="nav-btn-templates" class="backstage-nav-btn" onclick="switchBackstageTab('templates')">🌍 Templates</button>
            
            <div style="height: 1px; background: var(--border); margin: 20px 25px;"></div>
            
            <button class="backstage-nav-btn" onclick="document.getElementById('file-input').click(); closeFileMenu();" style="font-weight: normal; font-size: 14px; opacity: 0.8;">📥 Load External (.mbw)</button>
            <button class="backstage-nav-btn" onclick="if(typeof fileManager !== 'undefined') fileManager.export(); closeFileMenu();" style="font-weight: normal; font-size: 14px; opacity: 0.8;">💾 Export Current</button>
        </div>
        
        <div class="backstage-content">
            
            <div id="panel-my-worlds" class="backstage-panel active">
                <h1 style="margin-top: 0; font-size: 42px; border-bottom: 2px solid var(--border); padding-bottom: 15px;">My Worlds</h1>
                <p style="color: #aaa; margin-bottom: 30px; font-size: 16px;">Worlds saved securely in your browser's local storage.</p>
                <div id="fs-local-worlds-list" style="display: flex; flex-direction: column; max-width: 900px;">
                    </div>
            </div>

            <div id="panel-templates" class="backstage-panel">
                <h1 style="margin-top: 0; font-size: 42px; border-bottom: 2px solid var(--border); padding-bottom: 15px;">Templates</h1>
                <p style="color: #aaa; margin-bottom: 30px; font-size: 16px;">Start a new project from a blank canvas or a pre-built structure.</p>
                <div id="template-grid-container" class="template-grid">
                    </div>
            </div>

        </div>
    `;
    const container = document.createElement('div');
    container.id = 'backstage-menu';
    container.innerHTML = backstageHTML;
    document.body.appendChild(container);

    // Generar las tarjetas al arrancar
    generateTemplateCards();
});

// =====================================
// LÓGICA DE INTERFAZ DEL BACKSTAGE
// =====================================

// Sobrescribimos la función openFileMenu para que abra este menú gigante
window.openFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'flex';
    switchBackstageTab('my-worlds'); // Siempre abre en "My Worlds" por defecto
};

window.closeFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'none';
};

window.switchBackstageTab = function(tabName) {
    document.querySelectorAll('.backstage-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.backstage-nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById('panel-' + tabName).classList.add('active');
    document.getElementById('nav-btn-' + tabName).classList.add('active');

    // Si entramos a My Worlds, actualizamos la lista
    if(tabName === 'my-worlds') {
        renderFullscreenWorldsList();
    }
};

// =====================================
// RENDER DE TARJETAS (TEMPLATES)
// =====================================
function generateTemplateCards() {
    const grid = document.getElementById('template-grid-container');
    if (!grid) return;
    
    let cardsHTML = '';
    for (let t of projectTemplates) {
        let imageStyle = t.image ? `background-image: url('${t.image}');` : '';
        let fallbackIcon = t.image ? '' : '<span style="font-size:60px; opacity:0.2;">🌍</span>';

        cardsHTML += `
            <div class="template-card" onclick="loadTemplate('${t.filename}')">
                <div class="template-thumb" style="${imageStyle}">${fallbackIcon}</div>
                <div class="template-info">
                    <div class="t-name" title="${t.name}">${t.name}</div>
                    <div class="t-meta"><b>Version:</b> ${t.version}</div>
                    <div class="t-meta"><b>Author:</b> ${t.author}</div>
                </div>
            </div>
        `;
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
// RENDER DE MUNDOS (MY WORLDS)
// =====================================
window.renderFullscreenWorldsList = async function() {
    const listDiv = document.getElementById("fs-local-worlds-list");
    if(!listDiv) return;

    listDiv.innerHTML = "<p style='color:var(--text); font-size: 20px;'>Loading worlds...</p>";
    
    if(typeof localDB === 'undefined') {
        listDiv.innerHTML = "<p style='color:#e74c3c; font-size: 18px;'>Database engine is offline.</p>";
        return;
    }

    const worlds = await localDB.getWorlds();
    
    if(worlds.length === 0) {
        // Restablecemos el estilo de lista por si estaba en cuadrícula
        listDiv.style.cssText = "display: flex; flex-direction: column; max-width: 900px;";
        listDiv.className = "";
        
        listDiv.innerHTML = `
            <div style="text-align: center; padding: 60px; background: rgba(0,0,0,0.1); border-radius: 12px; border: 2px dashed var(--border);">
                <div style="font-size: 60px; opacity: 0.3; margin-bottom: 15px;">📭</div>
                <h3 style="color: var(--text); font-size: 24px; margin: 0 0 10px 0;">No saved worlds yet</h3>
                <p style="color: #888; font-size: 16px;">Turn on the <b>AutoSave</b> switch or click the floppy disk icon in the editor to save your progress safely in your browser.</p>
                <button onclick="switchBackstageTab('templates')" style="margin-top: 25px; padding: 12px 30px; background: #4DA6FF; color: black; border: none; font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 16px;">Start from a Template</button>
            </div>
        `;
        return;
    }

    worlds.sort((a, b) => b.date - a.date);
    
    // ✨ MAGIA VISUAL: Le aplicamos la clase de cuadrícula de los Templates
    listDiv.style.cssText = ""; // Limpiamos estilos en línea conflictivos
    listDiv.className = "template-grid";
    listDiv.innerHTML = "";

    worlds.forEach(w => {
        // Formateo de datos
        const dateObj = new Date(w.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const bytes = new Blob([w.data]).size;
        let sizeText = bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + " MB" : (bytes / 1024).toFixed(2) + " KB";

        // ✨ LEEMOS LA FOTO DE LA BASE DE DATOS
        let imageStyle = w.thumb ? `background-image: url('${w.thumb}');` : '';
        // Si es un mundo viejo sin foto, le ponemos el icono del planeta
        let fallbackIcon = w.thumb ? '' : '<span style="font-size:60px; opacity:0.2;">🌍</span>';

        const div = document.createElement('div');
        div.className = 'template-card';
        div.style.position = 'relative'; // Para anclar el botón de borrar
        
        div.innerHTML = `
            <button onclick="event.stopPropagation(); deleteSavedLocalWorld('${w.name}');" 
                    style="position: absolute; top: 10px; right: 10px; background: rgba(231, 76, 60, 0.9); color: white; border: 2px solid #c0392b; border-radius: 4px; width: 34px; height: 34px; font-size: 18px; cursor: pointer; display: flex; justify-content: center; align-items: center; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"
                    title="Delete World">🗑️</button>

            <div class="template-thumb" style="${imageStyle}" onclick="loadSavedLocalWorld('${w.name}'); closeFileMenu();">
                ${fallbackIcon}
            </div>
            <div class="template-info" onclick="loadSavedLocalWorld('${w.name}'); closeFileMenu();">
                <div class="t-name" title="${w.name}">${w.name}</div>
                <div class="t-meta"><b>Saved:</b> ${dateStr}</div>
                <div class="t-meta"><b>Size:</b> ${sizeText}</div>
            </div>
        `;
        listDiv.appendChild(div);
    });
};

// Enganchamos el botón de borrar original para que actualice esta pantalla
window.deleteSavedLocalWorld = async function(name) {
    if(confirm('Are you sure you want to PERMANENTLY DELETE "'+name+'"?')) {
        await localDB.deleteWorld(name);
        renderFullscreenWorldsList(); 
    }
};