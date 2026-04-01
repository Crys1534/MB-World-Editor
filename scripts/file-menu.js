// =========================================================
// 📂 FILE MENU (Temático y Manual)
// =========================================================

// ✨ 1. AQUÍ CONFIGURAS TUS MUNDOS MANUALMENTE ✨
// Simplemente llena los datos para cada mundo que quieras mostrar.
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
    },

];

document.addEventListener("DOMContentLoaded", () => {
    // 2. INYECTAR CSS ADAPTATIVO A LOS TEMAS
    const style = document.createElement('style');
    style.innerHTML = `
        /* Pantalla Completa usando colores del Theme */
        #backstage-menu {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: var(--bg-panel); color: var(--text);
            z-index: 99999; display: none; flex-direction: row; 
            font-family: inherit;
        }

        /* Barra Lateral Izquierda */
        .backstage-sidebar {
            width: 250px; background-color: var(--bg-header);
            display: flex; flex-direction: column; padding-top: 10px;
            box-shadow: 2px 0 5px rgba(0,0,0,0.5);
        }

        .backstage-back-btn {
            background: transparent; color: var(--text); border: none; font-size: 20px;
            text-align: left; padding: 15px 20px; cursor: pointer; font-weight: bold;
            margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .backstage-back-btn:hover { background-color: var(--input-bg); }

        .backstage-nav-btn {
            background: transparent; color: var(--text); border: none; font-size: 16px; font-weight: bold;
            text-align: left; padding: 8px 16px; cursor: pointer; transition: background 0.2s;
        }
        .backstage-nav-btn:hover { background-color: var(--input-bg); }
        .backstage-nav-btn.active { 
            background-color: var(--bg-panel); font-weight: bold; 
            border-top: 2px inset var(--border); border-bottom: 2px inset var(--border); 
        }

        /* Área de Contenido Derecho */
        .backstage-content {
            flex: 1; padding: 50px; background-color: var(--bg-panel);
            overflow-y: auto; color: var(--text);
        }

        .backstage-panel { display: none; }
        .backstage-panel.active { display: block; }

        /* Tarjetas de Plantillas Mejoradas */
        .template-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 30px; }

        .template-card {
            background-color: var(--bg-dark); border: 2px inset var(--border); border-radius: 4px;
            width: 296px; display: flex; flex-direction: column; cursor: pointer;
            transition: transform 0.2s, border-color 0.2s; overflow: hidden; box-sizing: border-box;
            box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
			height: 306px;
        }
        .template-card:hover { transform: translateY(-4px); border: 2px solid var(--text); }
        
        .template-thumb {
            width: 296px; height: 196px; background-color: var(--input-bg);
            background-size: cover; background-position: center; image-rendering: pixelated;
            border-bottom: 2px solid var(--border);
            display: flex; justify-content: center; align-items: center;
        }
        .template-thumb span { font-size: 40px; opacity: 0.3; }
        
        .template-info { padding: 10px; display: flex; flex-direction: column; gap: 5px; text-align: left; }
        .t-name { font-size: 16px; font-weight: bold; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t-meta { font-size: 12px; color: var(--text); opacity: 0.8; }
    `;
    document.head.appendChild(style);

    // 3. INYECTAR ESTRUCTURA HTML
    const backstageHTML = `
        <div class="backstage-sidebar">
            <button class="backstage-back-btn" onclick="closeFileMenu()">
                <span>⬅️</span> Back
            </button>
            <button id="nav-btn-menu" class="backstage-nav-btn active" onclick="switchBackstageTab('menu')">Menu</button>
            <button id="nav-btn-new" class="backstage-nav-btn" onclick="loadTemplate('New World.mbw')">New World</button>
            
            <button id="nav-btn-load" class="backstage-nav-btn" onclick="document.getElementById('file-input').click(); closeFileMenu();">Load World</button>
            <button id="nav-btn-export" class="backstage-nav-btn" onclick="if(typeof fileManager !== 'undefined') fileManager.export(); closeFileMenu();">Export World</button>
        </div>
        
        <div class="backstage-content">
            <div id="panel-menu" class="backstage-panel active">
                <h1 style="margin-top: 0; font-size: 36px;">Templates</h1>

                
                <div id="template-grid-container" class="template-grid">
                    </div>
            </div>

        </div>
    `;
    const container = document.createElement('div');
    container.id = 'backstage-menu';
    container.innerHTML = backstageHTML;
    document.body.appendChild(container);

    // 4. DIBUJAR LAS TARJETAS AL INICIAR
    generateTemplateCards();
});

// =====================================
// LÓGICA DE INTERFAZ Y ARCHIVOS
// =====================================

window.openFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'flex';
};

window.closeFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'none';
};

window.switchBackstageTab = function(tabName) {
    document.querySelectorAll('.backstage-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.backstage-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('panel-' + tabName).classList.add('active');
    document.getElementById('nav-btn-' + tabName).classList.add('active');
};

function generateTemplateCards() {
    const grid = document.getElementById('template-grid-container');
    if (!grid) return;
    
    let cardsHTML = '';

    // Recorre directamente la lista manual que creaste arriba
    for (let t of projectTemplates) {
        let imageStyle = t.image ? `background-image: url('${t.image}');` : '';
        let fallbackIcon = t.image ? '' : '<span>🌍</span>';

        cardsHTML += `
            <div class="template-card" onclick="loadTemplate('${t.filename}')">
                <div class="template-thumb" style="${imageStyle}">
                    ${fallbackIcon}
                </div>
                <div class="template-info">
                    <div class="t-name" title="${t.name}">${t.name}</div>
                    <div class="t-meta"><b>Version:</b> ${t.version}</div>
                    <div class="t-meta"><b>Seed:</b> ${t.seed}</div>
                    <div class="t-meta"><b>Author:</b> ${t.author}</div>
                </div>
            </div>
        `;
    }

    grid.innerHTML = cardsHTML;
}

window.loadTemplate = function(filename) {
    const url = 'dev-maps/' + filename;
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
            alert("Error loading template: " + err.message + "\n\n(Recuerda usar Live Server / GitHub Pages para poder cargar desde carpetas locales)");
        });
};