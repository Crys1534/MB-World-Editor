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

               // ✨ FIX: Sincronizar el nombre al cargar un mundo
               const filenameInput = document.getElementById("filename-display");
               if (fileManager.file) {
                   let cleanName = fileManager.file.name.replace(/\.mbw$/i, "");
                   
                   // 1. Lo mostramos visualmente
                   if (filenameInput) filenameInput.value = cleanName;
                   if (typeof updateFilename === 'function') updateFilename(cleanName);
                   
                   // 2. Le avisamos explícitamente a Firebase que cambiamos de mundo
                   if (typeof window.myPresenceRef !== 'undefined' && window.myPresenceRef) {
                       window.myPresenceRef.update({ worldName: cleanName });
                   }
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

prepareData: function() {
    // ✨ FIX 1: Si empezamos un mundo de cero, creamos el contenedor para evitar bloqueos
    if (!mbwom.world) mbwom.world = {};

    // ✨ FIX 2 (CRÍTICO): Sincronizamos la RAM visual con el motor de guardado
    // Esto repara el error donde los bloques no se guardaban al usar pestañas
    let currentScene = (typeof mbwom.currentScene !== 'undefined') ? mbwom.currentScene : 1;
    if (typeof mbwom !== 'undefined' && mbwom.sceneList) {
        mbwom.sceneList.forEach(key => {
            if (mbwom[key] !== undefined) {
                mbwom.world[key + currentScene] = mbwom[key];
            }
        });
    }

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

    if (!window.fileInfo) window.fileInfo = { version: "1.31.2", seed: "", author: "" };
    window.fileInfo.name = baseName;
    const authorInput = document.getElementById("sidebar-world-author");
    
    let finalAuthor = "";
    if (authorInput && authorInput.value.trim() !== "") {
        finalAuthor = authorInput.value.trim();
    } else {
        const profileName = localStorage.getItem('mbw_username');
        if (profileName && profileName !== "Username") {
            finalAuthor = profileName; 
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
 
 saveAs: async function() {
    const data = this.prepareData();
    if (!data) { alert("No hay mundo cargado para exportar."); return; }

    try {
        // Verificamos si el navegador soporta la API moderna de Guardar Como
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: data.name + ".mbw",
                types: [{
                    description: 'Mine Blocks World',
                    accept: {'text/plain': ['.mbw']},
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(data.textData);
            await writable.close();
            console.log("¡Archivo físico guardado con éxito en la PC!");
        } else {
            // Fallback: Si el usuario usa un navegador viejo (o Firefox), se descarga normalmente
            alert("Tu navegador no soporta elegir la carpeta exacta. Se descargará en Descargas.");
            this.export();
        }
    } catch (err) {
        // Si el usuario cancela o cierra la ventana de Windows, lo ignoramos silenciosamente
        if (err.name !== 'AbortError') {
            console.error("Error en Save As:", err);
            alert("Ocurrió un error al intentar guardar el archivo.");
        }
    }
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
            // ✨ FIX: Formato PNG para calidad perfecta (Pixel-Perfect)
            thumbnailBase64 = mainCanvas.toDataURL('image/png'); 
        }
    } catch (error) {
        console.warn("El navegador bloqueó la foto por seguridad (CORS). Se guardará sin miniatura.");
    }
    
    // Guardamos el nombre, el código, la foto y la info del mundo
    await localDB.saveWorld(data.name, data.textData, thumbnailBase64, window.fileInfo);
    
    if (!isAutoSave) {
        
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
                // ✨ FIX: En Mine Blocks el array scene contiene STRINGS puros, no objetos
                if (!ultimoBloque || ultimoBloque === "air" || ultimoBloque === 0 || ultimoBloque === "0") {
                    col.pop(); 
                    eliminados++;
                } else {
                    break; 
                }
            }
            for (let y = 0; y < col.length; y++) {
                let b = col[y];
                // ✨ FIX: Validación reparada
                if (b === "air" || b === 0 || b === "0" || b === "") {
                    col[y] = null; 
                    eliminados++;
                }
            }
        }
    }

    // 2. Limpieza de toGrow
    let toGrowEliminados = 0;
    for (let s = 1; s <= 3; s++) {
        let toGrow = mbwom.world["toGrow" + s];
        if (toGrow) {
            for (let key in toGrow) {
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
// ✨ MOTOR DE BASE DE DATOS LOCAL (IndexedDB) CON BACKUPS
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
        return new Promise((resolve, reject) => {
            let transaction = db.transaction(this.storeName, "readwrite");
            let store = transaction.objectStore(this.storeName);
            
            // 1. Buscamos si el mundo ya existe para ver su estado actual
            let request = store.get(name);
            request.onsuccess = (e) => {
                let existing = e.target.result;
                let backups = (existing && existing.backups) ? existing.backups : [];
                
                // 2. Si el mundo ya existía y tiene datos nuevos, empujamos el viejo estado a los backups
                if (existing && existing.data && existing.data !== dataString) {
                    backups.push({
                        data: existing.data,
                        date: existing.date,
                        thumb: existing.thumb
                    });
                    // 3. Mantenemos el límite estricto de 10 versiones
                    if (backups.length > 10) backups.shift(); 
                }
                
                // 4. Guardamos el nuevo estado, adjuntando la lista de backups
                let putReq = store.put({ 
                    name: name, 
                    data: dataString, 
                    date: Date.now(), 
                    thumb: thumbnail, 
                    fileInfo: fileInfo,
                    backups: backups 
                });
                
                putReq.onsuccess = () => resolve();
                putReq.onerror = (err) => reject(err.target.error);
            };
            request.onerror = (err) => reject(err.target.error);
        });
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
// ✨ LÓGICA SINCRONIZADA Y PERSISTENTE DEL AUTOGUARDADO
// ==============================================================
let autoSaveIntervalId = null;

// 0. NUEVO: Leer la memoria al recargar la página
window.addEventListener('DOMContentLoaded', () => {
    // Revisamos qué guardó el usuario la última vez
    const isEnabled = localStorage.getItem('mb_autosave_enabled') === 'true';
    const savedInterval = parseInt(localStorage.getItem('mb_autosave_interval')) || 0;

    const toggle = document.getElementById('autosave-toggle');
    const select = document.getElementById('autosave-interval');

    // Si estaba activado, restauramos los botones y encendemos el motor
    if (isEnabled && savedInterval > 0) {
        if (toggle) toggle.checked = true;
        if (select) select.value = savedInterval.toString();
        startAutoSaveInterval(savedInterval);
    } else {
        if (toggle) toggle.checked = false;
        if (select) select.value = "0";
    }
});

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

// 3. El motor real que cuenta el tiempo (MEJORADO PARA TODOS LOS MUNDOS)
function startAutoSaveInterval(minutes) {
    if (typeof stopAutoSaveInterval === 'function') stopAutoSaveInterval(); // Limpia cualquier reloj anterior
    
    // Guardamos en la memoria del navegador para que sobreviva F5
    localStorage.setItem('mb_autosave_enabled', 'true');
    localStorage.setItem('mb_autosave_interval', minutes);
    
    autoSaveIntervalId = setInterval(async () => {
        console.log(`⏳ [Autosave] Guardando TODOS los mundos abiertos...`);
        
        // Verificamos si existe el sistema de pestañas
        if (typeof WorldTabsManager !== 'undefined' && WorldTabsManager.openWorlds && WorldTabsManager.openWorlds.length > 0) {
            
            // Recorremos cada pestaña abierta
            for (let i = 0; i < WorldTabsManager.openWorlds.length; i++) {
                let tab = WorldTabsManager.openWorlds[i];
                let currentFileName = (typeof fileManager !== 'undefined' && fileManager.file) ? fileManager.file.name : "";
                
                // ✨ CASO A: Es la pestaña activa (la que el usuario está viendo ahora mismo)
                if (tab.filename === currentFileName || tab.id === WorldTabsManager.activeWorldId) {
                    if (typeof fileManager !== 'undefined') await fileManager.saveLocal(true);
                } 
                // ✨ CASO B: Es una pestaña inactiva (está en el fondo)
                else {
                    // FIX: Usamos tab.mbwomData.world, que es donde realmente guardas los datos del mundo[cite: 7]
                    let backgroundWorldData = (tab.mbwomData && tab.mbwomData.world) ? tab.mbwomData.world : null; 
                    
                    if (backgroundWorldData && typeof localDB !== 'undefined') {
                        // Preparamos los datos crudos del mundo
                        let jsonString = JSON.stringify(backgroundWorldData);
                        let textData = typeof mbwAlgorithm !== 'undefined' ? mbwAlgorithm.encode(jsonString) : jsonString;
                        let cleanName = tab.filename.replace(/\.mbw$/i, "");
                        
                        // Guardado silencioso directo a la base de datos (sin foto para ahorrar memoria)
                        await localDB.saveWorld(cleanName, textData, "", backgroundWorldData.fileInfo || {});
                        console.log(`[Auto-Save] Mundo inactivo "${cleanName}" respaldado con éxito.`);
                    } else {
                         console.warn(`[Auto-Save] No se encontraron datos para guardar en la pestaña: ${tab.filename}`);
                    }
                }
            }
        } 
        // Respaldo de seguridad: Si no detecta pestañas, guarda el mundo activo normal
        else if (typeof fileManager !== 'undefined' && fileManager.saveLocal) {
            await fileManager.saveLocal(true); 
        }
        
    }, minutes * 60 * 1000); 
    
    console.log(`⏱️ Auto save ON (Cada ${minutes} mins). Protegiendo todos los mundos.`);
}

function stopAutoSaveInterval() {
    // ✨ Borramos el estado de la memoria
    localStorage.setItem('mb_autosave_enabled', 'false');
    
    if (autoSaveIntervalId) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
    }
    console.log("⏱️ Auto save disabled y borrado de memoria.");
}


// ==============================================================
// ✨ SISTEMA DE RESTAURACIÓN DE VERSIONES (MÁQUINA DEL TIEMPO) ✨
// ==============================================================

window.openBackupsModal = async function(worldName) {
    let modal = document.getElementById('backups-modal');
    
    // Inyectamos la ventana si no existe
    if (!modal) {
        const modalHTML = `
        <div id="backups-modal" class="modal" style="display:none; position:fixed; z-index:9999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.7); align-items:center; justify-content:center;">
            <div class="mbw-standard-modal" style="width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
                <div class="mbw-modal-header">
                    <h3>🕒 Version History: <span id="backups-world-name" style="color: #4DA6FF;"></span></h3>
                    <span class="mbw-close-btn" onclick="closeModal('backups-modal')">&times;</span>
                </div>
                <div class="mbw-modal-body" id="backups-list-container" style="overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                    <!-- Los backups cargarán aquí -->
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('backups-modal');
    }
    
    document.getElementById('backups-world-name').innerText = worldName;
    const container = document.getElementById('backups-list-container');
    container.innerHTML = '<p style="text-align:center; color: #333;">Searching for older versions...</p>';
    
    modal.style.display = 'flex';
    
    try {
        let db = await localDB.init();
        let request = db.transaction(localDB.storeName, "readonly").objectStore(localDB.storeName).get(worldName);
        
        request.onsuccess = () => {
            const world = request.result;
            if (!world || !world.backups || world.backups.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding: 40px; color: #555;"><span style="font-size: 40px; opacity:0.5;">📭</span><br><b>No previous versions found.</b><br>Play and save your world a few times to generate backups.</div>';
                return;
            }
            
            container.innerHTML = '';
            
            // Invertimos el array para que el guardado más reciente salga primero
            const reversedBackups = [...world.backups].reverse();
            
            reversedBackups.forEach((bkp, i) => {
                const realIndex = world.backups.length - 1 - i;
                const dateObj = new Date(bkp.date);
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
                const bytes = new Blob([bkp.data]).size;
                const sizeStr = typeof window.formatBytes === 'function' ? window.formatBytes(bytes) : (bytes/1024).toFixed(2) + " KB";
                
                const div = document.createElement('div');
                div.style = "display:flex; justify-content:space-between; align-items:center; background:#8B8B8B; border: 2px solid #555; padding:10px; border-radius: 4px; color: white;";
                div.innerHTML = `
                    <div>
                        <div style="font-weight:bold; font-size:16px; color:#000;">${worldName}</div>
                        <div style="font-size:12px; color:#333; font-weight:bold;">📅 ${dateStr} &nbsp;•&nbsp; 📄 ${sizeStr}</div>
                    </div>
                    <button onclick="restoreWorldBackup('${worldName}', ${realIndex})" style="background:#f39c12; color:black; border:2px solid #e67e22; padding:6px 12px; font-weight:bold; cursor:pointer; border-radius:4px; font-size: 14px;" onmouseover="this.style.background='#e67e22'" onmouseout="this.style.background='#f39c12'">Restore</button>
                `;
                container.appendChild(div);
            });
        };
    } catch (err) {
        container.innerHTML = '<p style="text-align:center; color:#e74c3c; font-weight:bold;">Error loading backups.</p>';
    }
};

window.restoreWorldBackup = async function(worldName, backupIndex) {
    if (!confirm("⚠️ WARNING!\n\nAre you sure you want to restore this version? Your CURRENT progress in this world will be overwritten!")) return;
    
    try {
        let db = await localDB.init();
        let tx = db.transaction(localDB.storeName, "readwrite");
        let store = tx.objectStore(localDB.storeName);
        
        let getReq = store.get(worldName);
        getReq.onsuccess = async () => {
            let world = getReq.result;
            if (world && world.backups && world.backups[backupIndex]) {
                const targetBackup = world.backups[backupIndex];
                
                // Medida de seguridad: el estado "destruido/actual" se va al fondo de los backups por si el usuario se arrepiente
                world.backups.push({
                    data: world.data,
                    date: world.date,
                    thumb: world.thumb
                });
                if (world.backups.length > 10) world.backups.shift(); 
                
                // Sustituimos los datos principales por los del backup
                world.data = targetBackup.data;
                world.date = Date.now(); // Marca de tiempo nueva
                world.thumb = targetBackup.thumb;
                
                let putReq = store.put(world);
                putReq.onsuccess = () => {
                    closeModal('backups-modal');
                    alert("✅ Time Machine successful! The world has been restored.");
                    
                    // Cargamos el mundo en el mapa y cerramos el menú
                    if (typeof loadSavedLocalWorld === 'function') {
                        loadSavedLocalWorld(worldName);
                        if (typeof closeFileMenu === 'function') closeFileMenu();
                    }
                };
            }
        };
    } catch (err) {
        alert("Error restoring backup.");
        console.error(err);
    }
};

// ==========================================
// ✨ BOTÓN: BACKUP GLOBAL DE MUNDOS (.ZIP)
// ==========================================
window.backupAllWorlds = async function() {
    if (typeof JSZip === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        document.head.appendChild(script);
        script.onload = () => backupAllWorlds();
        return;
    }

    try {
        // ✨ FIX: Apuntamos a localDB
        const db = await localDB.init();
        
        const transaction = db.transaction([localDB.storeName], 'readonly');
        const store = transaction.objectStore(localDB.storeName);
        const request = store.getAll();

        request.onsuccess = function() {
            const worlds = request.result;
            if (!worlds || worlds.length === 0) {
                alert("No tienes mundos locales para respaldar.");
                return;
            }

            document.body.style.cursor = 'wait';
            const zip = new JSZip();

            worlds.forEach(world => {
                let filename = world.name || "Mundo_Sin_Nombre";
                if (!filename.toLowerCase().endsWith('.mbw')) filename += '.mbw';
                zip.file(filename, world.data);
            });

            zip.generateAsync({ type: "blob" }).then(function(content) {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(content);
                const date = new Date();
                const fechaTxt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                link.download = `MBW_Backup_${fechaTxt}.zip`;
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                document.body.style.cursor = 'default';
                alert(`✅ Backup exitoso!\nSe comprimieron ${worlds.length} mundos.`);
            }).catch(function(err) {
                console.error("Error al empaquetar:", err);
                document.body.style.cursor = 'default';
                alert("Ocurrió un error al crear el archivo ZIP.");
            });
        };
        request.onerror = function() { alert("Error al intentar leer la base de datos."); };
    } catch (e) {
        console.error("Backup error:", e);
        document.body.style.cursor = 'default';
        alert("Fallo al acceder a los mundos locales.");
    }
};

// ==========================================
// ✨ BOTÓN: IMPORTAR MUNDOS (Desde .ZIP o .MBW)
// ==========================================
window.importBackupFiles = async function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (typeof JSZip === 'undefined') {
        await new Promise(resolve => {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
            document.head.appendChild(script);
            script.onload = resolve;
        });
    }

    document.body.style.cursor = 'wait';
    let mundosImportados = 0;

    const procesarMBW = async (filename, stringData) => {
        let worldName = filename.replace(/\.[^/.]+$/, ""); 
        
        // ✨ FIX: Apuntamos a localDB
        const db = await localDB.init();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction([localDB.storeName], "readwrite");
            const store = tx.objectStore(localDB.storeName);
            store.put({ name: worldName, data: stringData, lastModified: Date.now(), date: Date.now() });
            
            tx.oncomplete = () => { mundosImportados++; resolve(); };
            tx.onerror = () => reject();
        });
    };

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.name.toLowerCase().endsWith('.zip')) {
                const zip = await JSZip.loadAsync(file);
                
                for (let relativePath in zip.files) {
                    const zipEntry = zip.files[relativePath];
                    if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.mbw')) {
                        const contentString = await zipEntry.async("string");
                        await procesarMBW(relativePath, contentString);
                    }
                }
            } else if (file.name.toLowerCase().endsWith('.mbw')) {
                const contentString = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.readAsText(file);
                });
                await procesarMBW(file.name, contentString);
            }
        }

        document.body.style.cursor = 'default';
        event.target.value = ""; 
        
        // ✨ FIX: Refrescamos la lista forzando la recarga en el panel de Backstage
        if (typeof window.loadMyWorldsList === 'function') {
            window.loadMyWorldsList();
        } else if (typeof loadMyWorldsList !== 'undefined') {
            loadMyWorldsList();
        }
        
        alert(`✅ Importación finalizada!\nSe han cargado ${mundosImportados} mundo(s) en tu biblioteca local.`);
        
        // 🔄 Doble seguridad: Si la pestaña de "My Worlds" está abierta, simulamos un clic para que se refresque visualmente
        const myWorldsTabBtn = document.getElementById('btn-tab-my-worlds');
        if (myWorldsTabBtn) {
            myWorldsTabBtn.click();
        }

    } catch (err) {
        console.error("Error al importar:", err);
        document.body.style.cursor = 'default';
        event.target.value = "";
        alert("Ocurrió un error al intentar importar los archivos. Asegúrate de que no estén corruptos.");
    }
};