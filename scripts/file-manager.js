// ==============================================================
// ✨ GENERADOR DE TEXTURA DE EXPERIENCIA (Estilo Minecraft)
// ==============================================================
window.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement("canvas"), m = c.getContext("2d");
    c.width = 16; c.height = 16;
    const createNoise = (r, g, b, alpha) => {
        const imgData = m.createImageData(16, 16);
        for(let o = 0; o < 1024; o += 4) {
            let i = Math.floor(30 * Math.random() - 15); 
            imgData.data[o]   = Math.min(255, Math.max(0, r + i));
            imgData.data[o+1] = Math.min(255, Math.max(0, g + i));
            imgData.data[o+2] = Math.min(255, Math.max(0, b + i));
            imgData.data[o+3] = alpha;
        }
        m.putImageData(imgData, 0, 0); 
        return c.toDataURL();
    };
    document.documentElement.style.setProperty('--xp-bg', `url(${createNoise(0, 34, 0, 191)})`);
    document.documentElement.style.setProperty('--xp-fill', `url(${createNoise(0, 170, 0, 255)})`);
});

// ==============================================================
// ✨ FUNCIÓN PARA ACTUALIZAR LA BARRA
// ==============================================================
function updateLoadingBar(percent, text) {
    const overlay = document.getElementById('loading-overlay');
    const fill = document.getElementById('loading-progress');
    const textEl = document.getElementById('loading-text');

    if (overlay) overlay.style.display = 'flex';
    if (fill) fill.style.width = percent + '%';
    if (textEl) textEl.innerText = text;
}

// ==============================================================
// ✨ TU FILE MANAGER COMPLETO Y ACTUALIZADO
// ==============================================================
const fileManager = {
 input: document.getElementById("file-input"),
 
 load: function (event) {
  try {
   updateLoadingBar(30, "Decoding world...");

   setTimeout(() => {
       const jsonString = mbwAlgorithm.decode(event.target.result);
       updateLoadingBar(60, "Analyzing terrain...");

       setTimeout(() => {
           const parsedWorld = JSON.parse(jsonString);
           updateLoadingBar(85, "Loading entities and settings...");

           setTimeout(() => {
               
               if (typeof WorldTabsManager !== 'undefined' && fileManager.file) {
                   const isDefault = WorldTabsManager.openWorlds.length === 1 && WorldTabsManager.openWorlds[0].filename === "world.mbw";
                   
                   if (isDefault) {
                       WorldTabsManager.openWorlds[0].filename = fileManager.file.name;
                       WorldTabsManager.renderTabs();
                   } else {
                       WorldTabsManager.addWorld(fileManager.file.name, true, false);
                   }
               }

               mbwom.world = parsedWorld;

               mbwom.mobs = {};
               for (let sceneId = 1; sceneId <= 3; sceneId++) {
                   let sceneMobs = mbwom.world["mobs" + sceneId];
                   if (sceneMobs) {
                       for (let mobKey in sceneMobs) {
                           let m = sceneMobs[mobKey];
                           let mId = mobKey + "_scene" + sceneId;
                           mbwom.mobs[mId] = m;
                           
                           mbwom.mobs[mId].x = Number(m.x) || 0;
                           mbwom.mobs[mId].y = Number(m.y) || 0;
                           mbwom.mobs[mId].scene = sceneId;
                       }
                   }
               }

               window.fileInfo = mbwom.world.fileInfo || { version: "", seed: "", author: "" };
               window.cheats = mbwom.world.cheats || false;
               
               const authorEl = document.getElementById("sidebar-world-author");
               if (authorEl) authorEl.value = window.fileInfo.author || "";
               window.defeatedEnder = mbwom.world.defeatedEnder || false;
               
               if (typeof populateWorldInfo === 'function') populateWorldInfo();
               
               const gamemodeEl = document.getElementById("gamemode");
               const cheatsEl = document.getElementById("cheats");
               
               if (gamemodeEl) {
                   if (mbwom.world.gamemode !== undefined) gamemodeEl.value = mbwom.world.gamemode;
                   else if (mbwom.world.creative) gamemodeEl.value = "1";
                   else gamemodeEl.value = "0";
               }
               if (cheatsEl) cheatsEl.checked = mbwom.world.cheats;

               const diffEl = document.getElementById("gr-difficulty");
               if (diffEl && mbwom.world.difficulty) {
                   const diffMap = { "peaceful": "0", "easy": "1", "normal": "2", "hard": "3" };
                   diffEl.value = diffMap[mbwom.world.difficulty] || "2";
               }
               
               if (mbwom.world.gameRules) {
                   const keepInvEl = document.getElementById("gr-keepinventory");
                   const daylightEl = document.getElementById("gr-dodaylightcycle");
                   const fireTickEl = document.getElementById("gr-dofiretick");
                   const mobLootEl = document.getElementById("gr-domobloot");
                   const mobGriefingEl = document.getElementById("gr-mobgriefing");

                   if (keepInvEl) keepInvEl.checked = mbwom.world.gameRules.keepinventory || false;
                   if (daylightEl) daylightEl.checked = mbwom.world.gameRules.dodaylightcycle !== false;
                   if (fireTickEl) fireTickEl.checked = mbwom.world.gameRules.dofiretick !== false;
                   if (mobLootEl) mobLootEl.checked = mbwom.world.gameRules.domobloot !== false;
                   if (mobGriefingEl) mobGriefingEl.checked = mbwom.world.gameRules.mobgriefing !== false;
               }
               
               const healthEl = document.getElementById("player-health");
               const hungerEl = document.getElementById("player-hunger"); 
               const xpEl = document.getElementById("player-xp");
               const timeEl = document.getElementById("gr-time");
               const weatherEl = document.getElementById("gr-weather");
               const dayEl = document.getElementById("gr-day"); 

               if (healthEl && mbwom.world.health !== undefined) healthEl.value = mbwom.world.health;
               if (hungerEl && mbwom.world.food !== undefined) hungerEl.value = mbwom.world.food; 
               if (xpEl && mbwom.world.experience !== undefined) xpEl.value = Math.floor(mbwom.world.experience / 100);
               if (timeEl && mbwom.world.tim !== undefined) timeEl.value = mbwom.world.tim;
               if (weatherEl && mbwom.world.raining !== undefined) weatherEl.value = mbwom.world.raining > 0 ? "rain" : "clear";
               if (dayEl && mbwom.world.day !== undefined) dayEl.value = mbwom.world.day;
               
               mbwom.loadScene(1);

               if (typeof checkboxes !== 'undefined') {
                   checkboxes.forEach(cb => {
                       const index = parseInt(cb.getAttribute('data-index'));
                       if (!isNaN(index)) cb.checked = mbwom.getAchievement(index);
                   });
               }

               const filenameInput = document.getElementById("filename-display");
               if (filenameInput && fileManager.file) {
                   let cleanName = fileManager.file.name.replace(/\.mbw$/i, "");
                   if (typeof updateFilename === 'function') updateFilename(cleanName);
                   else filenameInput.value = cleanName;
               }

               if (typeof initializeWorldCache === 'function') initializeWorldCache();
               
               if (!window.isMainLoopRunning) {
                   if (typeof mainLoop === 'function') mainLoop();
                   window.isMainLoopRunning = true; 
               }

               const forceWeatherEl = document.getElementById("gr-weather");
               if (forceWeatherEl) forceWeatherEl.dispatchEvent(new Event('change'));

               console.log("World loaded succesfully.");

               updateLoadingBar(100, "World Ready!");
               setTimeout(() => {
                   const overlay = document.getElementById('loading-overlay');
                   if (overlay) overlay.style.display = 'none';
               }, 600); 

           }, 50); 
       }, 50); 
   }, 50); 

  } catch (error) {
   console.error("Error cargando mundo:", error);
   alert("Error al cargar el archivo.");
   const overlay = document.getElementById('loading-overlay');
   if (overlay) overlay.style.display = 'none';
  }
 },

 // ✨ LA LÓGICA DE EMPAQUETADO
 prepareData: function() {
    if (!mbwom.world) return null;

    const gamemodeEl = document.getElementById("gamemode");
    const cheatsEl = document.getElementById("cheats");
    
    if (gamemodeEl) {
        mbwom.world.gamemode = parseInt(gamemodeEl.value);
        mbwom.world.creative = (gamemodeEl.value === "1");
    }
    if (cheatsEl) mbwom.world.cheats = cheatsEl.checked;

    const diffEl = document.getElementById("gr-difficulty");
    if (diffEl) {
        const diffMap = { "0": "peaceful", "1": "easy", "2": "normal", "3": "hard" };
        mbwom.world.difficulty = diffMap[diffEl.value] || "normal";
    }

    if (!mbwom.world.gameRules) mbwom.world.gameRules = {};
    
    const keepInvEl = document.getElementById("gr-keepinventory");
    const daylightEl = document.getElementById("gr-dodaylightcycle");
    const fireTickEl = document.getElementById("gr-dofiretick");
    const mobLootEl = document.getElementById("gr-domobloot");
    const mobGriefingEl = document.getElementById("gr-mobgriefing");

    if (keepInvEl) mbwom.world.gameRules.keepinventory = keepInvEl.checked;
    if (daylightEl) mbwom.world.gameRules.dodaylightcycle = daylightEl.checked;
    if (fireTickEl) mbwom.world.gameRules.dofiretick = fireTickEl.checked;
    if (mobLootEl) mbwom.world.gameRules.domobloot = mobLootEl.checked;
    if (mobGriefingEl) mbwom.world.gameRules.mobgriefing = mobGriefingEl.checked;
    
    const healthEl = document.getElementById("player-health");
    const hungerEl = document.getElementById("player-hunger"); 
    const xpEl = document.getElementById("player-xp");
    const timeEl = document.getElementById("gr-time");
    const weatherEl = document.getElementById("gr-weather");

    if (healthEl) mbwom.world.health = parseInt(healthEl.value) || 20;
    if (hungerEl) mbwom.world.food = parseInt(hungerEl.value) || 20; 
    if (xpEl) {
        let x = parseInt(xpEl.value);
        mbwom.world.experience = isNaN(x) ? 0 : (x * 100);
    }
    if (timeEl) {
        let t = parseInt(timeEl.value);
        mbwom.world.tim = isNaN(t) ? 0 : t;
    }
    if (weatherEl) {
        mbwom.world.raining = weatherEl.value === "clear" ? 0 : 1;
        if (weatherEl.value !== "clear") mbwom.world.rainDay = mbwom.world.day || 1;
    }

    if (typeof checkboxes !== 'undefined') {
        checkboxes.forEach(cb => {
            const index = parseInt(cb.getAttribute('data-index'));
            if (!isNaN(index)) mbwom.setAchievement(cb.checked, index);
        });
    }

    const filenameInput = document.getElementById("filename-display");
    let baseName = "world";
    if (filenameInput && filenameInput.value.trim() !== "") {
        baseName = filenameInput.value.trim();
    }

    if (!window.fileInfo) window.fileInfo = { version: "", seed: "", author: "" };
    window.fileInfo.name = baseName;
    const authorInput = document.getElementById("sidebar-world-author");
    
    // ✨ MAGIA DE AUTORÍA: 
    // Intenta usar el autor escrito en el Sidebar. Si está vacío, usa el nombre del Perfil Global.
    let finalAuthor = "";
    if (authorInput && authorInput.value.trim() !== "") {
        finalAuthor = authorInput.value.trim();
    } else {
        const profileName = localStorage.getItem('mbw_username');
        if (profileName && profileName !== "Username") {
            finalAuthor = profileName; // Asigna el nombre si no es el default "Username"
        }
    }
    
    window.fileInfo.author = finalAuthor;
    mbwom.world.fileInfo = window.fileInfo;

    if (typeof window.defeatedEnder !== 'undefined') mbwom.world.defeatedEnder = window.defeatedEnder;

    const knownMobs = [
        "zombie", "skeleton", "creeper", "spider", "slime", "pig", "cow", "chicken", "sheep",
        "zombiepigman", "ghast", "blaze", "magmacube", "nethereye", "enderman", "enderdragon", "snowgolem", "bat", "rabbit",
    ];

    mbwom.world.mobs1 = {}; mbwom.world.mobs2 = {}; mbwom.world.mobs3 = {};
    let mobCounts = {}; let globalMobCount = { 1: 0, 2: 0, 3: 0 };
    for(let s=1; s<=3; s++) knownMobs.forEach(t => { mobCounts[t + "Num" + s] = 0; });

    if (mbwom.mobs) {
        for (let key in mbwom.mobs) {
            let m = mbwom.mobs[key];
            if (!m || !m.type || m.type.startsWith('custom_')) continue; 
            
            let s = m.scene || 1; 
            globalMobCount[s]++;
            let internalId = "mob" + globalMobCount[s];
            m.id = internalId; 
            m.x = isNaN(Number(m.x)) ? 0 : Number(m.x);
            m.y = isNaN(Number(m.y)) ? 0 : Number(m.y);
            
            mbwom.world["mobs" + s][internalId] = m;
            mobCounts[m.type + "Num" + s] = (mobCounts[m.type + "Num" + s] || 0) + 1;
        }
    }

    mbwom.world.mobNum1 = globalMobCount[1];
    mbwom.world.mobNum2 = globalMobCount[2];
    mbwom.world.mobNum3 = globalMobCount[3];

    for (let counterKey in mobCounts) mbwom.world[counterKey] = mobCounts[counterKey];

    if (typeof limpiarMundoParaGuardar === 'function') limpiarMundoParaGuardar();

    const jsonString = JSON.stringify(mbwom.world);
    const text = mbwAlgorithm.encode(jsonString);
    
    return { name: baseName, textData: text };
 },

 export: function () {
    const data = this.prepareData();
    if (!data) { alert("No hay mundo cargado."); return; }

    const blob = new Blob([data.textData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.name + ".mbw";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
 },

saveLocal: async function(isAutoSave = false) {
    const data = this.prepareData();
    if (!data) { 
        if (!isAutoSave) alert("No hay mundo cargado para guardar."); 
        return; 
    }
    
    // ✨ ¡AQUÍ TOMAMOS LA FOTO DEL CANVAS (CON PROTECCIÓN ANTI-CRASH)! ✨
    let thumbnailBase64 = "";
    try {
        const mainCanvas = document.getElementById('canvas');
        if (mainCanvas) {
            // Formato JPEG a 50% de calidad
            thumbnailBase64 = mainCanvas.toDataURL('image/jpeg', 0.5); 
        }
    } catch (error) {
        console.warn("El navegador bloqueó la foto por seguridad (CORS). Se guardará sin miniatura.");
    }
    
    // Guardamos el nombre, el código, la foto y la info del mundo
    await localDB.saveWorld(data.name, data.textData, thumbnailBase64, window.fileInfo);
    
    if (!isAutoSave) {
        alert(`¡Mundo "${data.name}" guardado exitosamente en tu navegador!`);
    } else {
        console.log(`[Auto-Save] Mundo "${data.name}" saving at ${new Date().toLocaleTimeString()}`);
        const toast = document.createElement('div');
        toast.innerText = "💾 Auto-saved";
        toast.style = "position:fixed; bottom:20px; right:20px; background:rgba(0,0,0,0.8); color:#00FF00; padding:10px 20px; border-radius:5px; z-index:999999; font-weight:bold; border:2px solid #004d00; pointer-events:none;";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
 }
};

if (fileManager.input) {
    fileManager.input.addEventListener("change", function (event) {
     fileManager.file = event.target.files[0];
     if (fileManager.file) {
      updateLoadingBar(10, "Reading file...");
      const reader = new FileReader();
      reader.onload = fileManager.load;
      reader.readAsText(fileManager.file);
      event.target.value = ''; 
     }
    });
}

function limpiarMundoParaGuardar() {
    let eliminados = 0;
    
    // 1. Limpieza de bloques de aire y nulos en el escenario
    for (let s = 1; s <= 3; s++) {
        let scene = mbwom.world["scene" + s];
        if (!scene) continue;
        for (let x = 0; x < scene.length; x++) {
            let col = scene[x];
            if (!col || !Array.isArray(col)) continue;
            while (col.length > 0) {
                let ultimoBloque = col[col.length - 1];
                if (!ultimoBloque || ultimoBloque === null || ultimoBloque.type === null || ultimoBloque.type === "air" || ultimoBloque.type === 0 || ultimoBloque.type === "0") {
                    col.pop(); 
                    eliminados++;
                } else {
                    break; 
                }
            }
            for (let y = 0; y < col.length; y++) {
                let b = col[y];
                if (b && (b.type === "air" || b.type === 0 || b.type === "0" || b.type === "")) {
                    col[y] = null; 
                    eliminados++;
                }
            }
        }
    }

    // 2. ✨ NUEVA LIMPIEZA: Eliminar basura acumulada en "toGrow" (LA QUE FALTABA)
    let toGrowEliminados = 0;
    for (let s = 1; s <= 3; s++) {
        let toGrow = mbwom.world["toGrow" + s];
        if (toGrow) {
            for (let key in toGrow) {
                // Si la coordenada está vacía (null), la borramos del registro por completo
                if (toGrow[key] === null) {
                    delete toGrow[key];
                    toGrowEliminados++;
                }
            }
        }
    }
    
    console.log(`🧹 ¡Limpieza profunda! Se purgaron ${eliminados} bloques inútiles y ${toGrowEliminados} datos nulos de crecimiento.`);
}

// ==========================================
// ✨ DRAG AND DROP (Con Interfaz Visual)
// ==========================================
const dropZone = document.body; 
const dragOverlay = document.getElementById('drag-overlay');
let dragCounter = 0;

dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragOverlay) dragOverlay.style.display = "flex"; 
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0 && dragOverlay) dragOverlay.style.display = "none";
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0; 
    if (dragOverlay) dragOverlay.style.display = "none"; 

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileManager.file = e.dataTransfer.files[0];
        
        if (fileManager.file.name.toLowerCase().endsWith('.mbw')) {
            updateLoadingBar(10, "Reading file...");
            const reader = new FileReader();
            reader.onload = fileManager.load;
            reader.readAsText(fileManager.file);
        } else {
            alert("⚠️ Please, drop a valid Mine Blocks file (.mbw)");
        }
    }
});

// ==============================================================
// ✨ MOTOR DE BASE DE DATOS LOCAL (IndexedDB)
// ==============================================================
const localDB = {
    dbName: "MBEditorDB",
    dbVersion: 1,
    storeName: "savedWorlds",
    init: function() {
        return new Promise((resolve, reject) => {
            let request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "name" });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },
    saveWorld: async function(name, dataString, thumbnail = "", fileInfo = {}) {
        let db = await this.init();
        let transaction = db.transaction(this.storeName, "readwrite");
        let store = transaction.objectStore(this.storeName);
        store.put({ name: name, data: dataString, date: Date.now(), thumb: thumbnail, fileInfo: fileInfo });
    },
    getWorlds: async function() {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let request = db.transaction(this.storeName, "readonly").objectStore(this.storeName).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    loadWorld: async function(name) {
        let db = await this.init();
        return new Promise((resolve, reject) => {
            let request = db.transaction(this.storeName, "readonly").objectStore(this.storeName).get(name);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    },
    deleteWorld: async function(name) {
        let db = await this.init();
        let transaction = db.transaction(this.storeName, "readwrite");
        transaction.objectStore(this.storeName).delete(name);
    }
};

// ==============================================================
// ✨ LÓGICA DE PESTAÑAS Y MENÚ FILE
// ==============================================================
function openFileMenu() {
    const modal = document.getElementById('file-modal');
    if (modal) {
        modal.style.display = 'flex';
    } else if (typeof openModal === 'function') {
        openModal('file-modal');
    }
    
    document.getElementById('tab-my-worlds').style.display = 'block';
    document.getElementById('tab-templates').style.display = 'none';
    
    document.getElementById('btn-tab-my-worlds').classList.add('active');
    document.getElementById('btn-tab-my-worlds').style.background = '#c6c6c6';
    document.getElementById('btn-tab-my-worlds').style.borderBottom = '3px solid #FFF';
    document.getElementById('btn-tab-my-worlds').style.color = '#000';
    
    document.getElementById('btn-tab-templates').classList.remove('active');
    document.getElementById('btn-tab-templates').style.background = 'transparent';
    document.getElementById('btn-tab-templates').style.borderBottom = 'none';
    document.getElementById('btn-tab-templates').style.color = '#333';
    
    loadMyWorldsList(); 
}

function switchFileTab(event, tabId) {
    document.getElementById('tab-my-worlds').style.display = 'none';
    document.getElementById('tab-templates').style.display = 'none';
    
    const btnMy = document.getElementById('btn-tab-my-worlds');
    const btnTemp = document.getElementById('btn-tab-templates');
    
    btnMy.style.background = 'transparent';
    btnMy.style.borderBottom = 'none';
    btnMy.style.color = '#333';
    
    btnTemp.style.background = 'transparent';
    btnTemp.style.borderBottom = 'none';
    btnTemp.style.color = '#333';
    
    document.getElementById('tab-' + tabId).style.display = 'block';
    
    event.currentTarget.style.background = '#c6c6c6';
    event.currentTarget.style.borderBottom = '3px solid #FFF';
    event.currentTarget.style.color = '#000';

    if(tabId === 'my-worlds') {
        loadMyWorldsList();
    }
}

async function loadMyWorldsList() {
    const listDiv = document.getElementById("local-worlds-list");
    if(!listDiv) return;

    listDiv.innerHTML = "<p style='color:#333; text-align:center;'>Loading world...</p>";
    const worlds = await localDB.getWorlds();
    
    if(worlds.length === 0) {
        listDiv.innerHTML = "<p style='color:#333; font-weight:bold; text-align:center; padding: 20px;'>There's not saved worlds.<br>Save manually with the 💾 icon!</p>";
        return;
    }

    worlds.sort((a, b) => b.date - a.date);
    listDiv.innerHTML = "";

    worlds.forEach(w => {
        const date = new Date(w.date).toLocaleString();
        const bytes = new Blob([w.data]).size;
        let sizeText = bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + " MB" : (bytes / 1024).toFixed(2) + " KB";

        const div = document.createElement('div');
        div.style = "display:flex; justify-content:space-between; align-items:center; background:#8B8B8B; border: 2px solid #373737; padding:10px;";

        div.innerHTML = `
            <div>
                <h4 style="margin:0; font-size:18px; color:#000;">${w.name}</h4>
                <small style="color:#222; font-weight:bold;">Saved: ${date} • ${sizeText}</small>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-load-struct" onclick="loadSavedLocalWorld('${w.name}')" style="padding: 5px 15px; font-size: 14px;">Load</button>
                <button class="btn-delete-action" onclick="deleteSavedLocalWorld('${w.name}')" style="padding: 5px 10px; font-size: 14px; background:#C0392B; color:white; border:2px solid #922B21;">🗑️</button>
            </div>
        `;
        listDiv.appendChild(div);
    });
}

async function loadSavedLocalWorld(name) {
    const textData = await localDB.loadWorld(name);
    if(!textData) { alert("Error while reading the file."); return; }
    
    if (typeof closeModal === 'function') closeModal('file-modal');
    else document.getElementById('file-modal').style.display = 'none';

    fileManager.file = { name: name + ".mbw", size: new Blob([textData]).size };
    updateLoadingBar(10, "Loading from the browser...");
    
    setTimeout(() => {
        fileManager.load({ target: { result: textData } });
    }, 100);
}

async function deleteSavedLocalWorld(name) {
    if(confirm(`¿Are you sure to DELETE "${name}" ?`)) {
        await localDB.deleteWorld(name);
        loadMyWorldsList(); 
    }
}

// ==============================================================
// ✨ LÓGICA SINCRONIZADA DEL AUTOGUARDADO
// ==============================================================
let autoSaveIntervalId = null;

// 1. Se llama cuando haces clic en el switch de la barra superior
window.toggleAutoSave = function() {
    const toggle = document.getElementById('autosave-toggle');
    const select = document.getElementById('autosave-interval');
    
    if (toggle && toggle.checked) {
        if (select) select.value = "1"; // Lo ajusta a 1 minuto visualmente en Settings
        startAutoSaveInterval(1);
    } else {
        if (select) select.value = "0"; // Lo apaga visualmente en Settings
        stopAutoSaveInterval();
    }
}

// 2. Se llama cuando cambias la lista desplegable en la ventana Settings
window.applyAutoSaveSettings = function() {
    const toggle = document.getElementById('autosave-toggle');
    const select = document.getElementById('autosave-interval');
    
    if (!select) return;
    const minutes = parseInt(select.value);
    
    if (minutes > 0) {
        if (toggle) toggle.checked = true; // Prende el switch de arriba
        startAutoSaveInterval(minutes);
    } else {
        if (toggle) toggle.checked = false; // Apaga el switch de arriba
        stopAutoSaveInterval();
    }
}

// 3. El motor real que cuenta el tiempo
function startAutoSaveInterval(minutes) {
    stopAutoSaveInterval(); // Limpia cualquier reloj anterior para evitar dobles guardados
    
    autoSaveIntervalId = setInterval(() => {
        if (typeof mbwom !== 'undefined' && mbwom.world) {
            fileManager.saveLocal(true); // true = Guardado silencioso
        }
    }, minutes * 60 * 1000); 
    
    console.log(`⏱️ Auto save ON (Every ${minutes} mins).`);
}

function stopAutoSaveInterval() {
    if (autoSaveIntervalId) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
    }
    console.log("⏱️ Auto save disabled.");
}