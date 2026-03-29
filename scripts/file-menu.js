// =========================================================
// 📂 FILE MENU (Estilo Microsoft Word Backstage)
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    // 1. INYECTAR CSS AISLADO
    const style = document.createElement('style');
    style.innerHTML = `
        /* Pantalla Completa */
        #backstage-menu {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #1e1e1e; z-index: 99999; display: none;
            flex-direction: row; font-family: Arial, sans-serif;
        }

        /* Barra Lateral Izquierda */
        .backstage-sidebar {
            width: 250px; background: #2b579a; /* Azul MS Word */
            display: flex; flex-direction: column; padding-top: 10px;
            box-shadow: 2px 0 5px rgba(0,0,0,0.3); z-index: 2;
        }

        .backstage-back-btn {
            background: transparent; color: white; border: none; font-size: 20px;
            text-align: left; padding: 15px 20px; cursor: pointer;
            margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .backstage-back-btn:hover { background: rgba(255, 255, 255, 0.1); }

        .backstage-nav-btn {
            background: transparent; color: white; border: none; font-size: 16px;
            text-align: left; padding: 15px 25px; cursor: pointer; transition: background 0.2s;
        }
        .backstage-nav-btn:hover { background: rgba(255, 255, 255, 0.1); }
        .backstage-nav-btn.active { background: #1e1e1e; color: white; font-weight: bold; }

        /* Área de Contenido Derecho */
        .backstage-content {
            flex: 1; padding: 50px; background: #1e1e1e;
            overflow-y: auto; color: white;
        }

        .backstage-panel { display: none; }
        .backstage-panel.active { display: block; }

        /* Tarjetas de Plantillas */
        .template-grid { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 30px; }

        .template-card {
            background: #2a2a2a; border: 2px solid #444; border-radius: 6px;
            width: 160px; height: 160px; display: flex; flex-direction: column;
            align-items: center; justify-content: center; cursor: pointer;
            transition: transform 0.2s, border-color 0.2s; text-align: center;
            padding: 10px; box-sizing: border-box;
        }
        .template-card:hover { transform: translateY(-4px); border-color: #2b579a; background: #333; }
        .template-icon { font-size: 50px; margin-bottom: 15px; }
        .template-name { font-size: 14px; color: #ddd; line-height: 1.3; }
    `;
    document.head.appendChild(style);

    // 2. INYECTAR ESTRUCTURA HTML
    const backstageHTML = `
        <div class="backstage-sidebar">
            <button class="backstage-back-btn" onclick="closeFileMenu()">
                <span>⬅️</span> Back
            </button>
            <button id="nav-btn-menu" class="backstage-nav-btn active" onclick="switchBackstageTab('menu')">Menu</button>
            <button id="nav-btn-new" class="backstage-nav-btn" onclick="switchBackstageTab('new')">New World</button>
            
            <button id="nav-btn-load" class="backstage-nav-btn" onclick="document.getElementById('file-input').click(); closeFileMenu();">Load World</button>
            <button id="nav-btn-export" class="backstage-nav-btn" onclick="if(typeof saveWorld === 'function') saveWorld(); closeFileMenu();">Export World</button>
        </div>
        
        <div class="backstage-content">
            <div id="panel-menu" class="backstage-panel active">
                <h1 style="margin-top: 0; font-size: 36px; font-weight: normal;">Templates</h1>
                <p style="color: #aaa; font-size: 18px;">Start by loading a world from your project folder.</p>

                <div class="template-grid">
                    <div class="template-card" onclick="loadTemplate('1.31.2 - All block tiles test.mbw')">
                        <div class="template-icon">🌍</div>
                        <div class="template-name">All Block Tiles Test</div>
                    </div>
                    
                    <div class="template-card" onclick="loadTemplate('mi_otro_mapa.mbw')">
                        <div class="template-icon">🏝️</div>
                        <div class="template-name">Survival Island</div>
                    </div>
                </div>
            </div>

            <div id="panel-new" class="backstage-panel">
                <h1 style="margin-top: 0; font-size: 36px; font-weight: normal;">New World</h1>
                <p style="color: #aaa; font-size: 18px;">Coming soon...</p>
            </div>
        </div>
    `;
    const container = document.createElement('div');
    container.id = 'backstage-menu';
    container.innerHTML = backstageHTML;
    document.body.appendChild(container);
});

// 3. FUNCIONES LÓGICAS GLOBALES
window.openFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'flex';
};

window.closeFileMenu = function() {
    document.getElementById('backstage-menu').style.display = 'none';
};

window.switchBackstageTab = function(tabName) {
    // Limpiar clases activas
    document.querySelectorAll('.backstage-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.backstage-nav-btn').forEach(b => b.classList.remove('active'));

    // Activar el seleccionado
    document.getElementById('panel-' + tabName).classList.add('active');
    document.getElementById('nav-btn-' + tabName).classList.add('active');
};

window.loadTemplate = function(filename) {
    const url = 'dev-maps/' + filename;

    // Usamos fetch para descargar el archivo de la carpeta
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("File not found");
            return response.blob();
        })
        .then(blob => {
            // Creamos un archivo falso para engañar al sistema de tu editor
            const file = new File([blob], filename, { type: "application/octet-stream" });
            
            // Lo inyectamos directamente en tu botón de 'file-input' original
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change')); // Dispara la carga como si hubieras dado clic
            }
            
            closeFileMenu(); // Cerramos la pantalla gigante
        })
        .catch(err => {
            alert("Error loading template: " + err.message + "\\n\\n(Nota: Si abriste el editor con doble clic, el navegador bloqueará el acceso a tus carpetas por seguridad. Necesitas usar 'Live Server' o similar para cargar carpetas locales).");
        });
};