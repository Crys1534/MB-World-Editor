// ==============================================================
// ✨ FUNCIÓN PARA ACTUALIZAR LA BARRA (Ponla antes de fileManager)
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
   // 1. Iniciamos la barra al 30%
   updateLoadingBar(30, "Decoding file...");

   // Primer respiro para el navegador
   setTimeout(() => {
       const jsonString = mbwAlgorithm.decode(event.target.result);
       
       // 2. Actualizamos al 60%
       updateLoadingBar(60, "Analizing terrain...");

       // Segundo respiro
       setTimeout(() => {
           const parsedWorld = JSON.parse(jsonString);
           
           // 3. Actualizamos al 85%
           updateLoadingBar(85, "Loading entities and settings...");

           // Tercer respiro: Aquí metemos TODO tu código original
           setTimeout(() => {
               
               // --- 🛠️ FIX DE LA PESTAÑA DEFAULT ---
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

               // ==============================================================
               // ✨ LECTURA DE MOBS: DICCIONARIO NATIVO (Haxe) ✨
               // ==============================================================
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

               window.fileInfo = mbwom.world.fileInfo || { version: "Unknown", seed: "" };
               window.cheats = mbwom.world.cheats || false;
               window.defeatedEnder = mbwom.world.defeatedEnder || false;
               
               if (typeof populateWorldInfo === 'function') populateWorldInfo();
               
               const gamemodeEl = document.getElementById("gamemode");
               const cheatsEl = document.getElementById("cheats");
               
               if (gamemodeEl) {
                   if (mbwom.world.gamemode !== undefined) {
                       gamemodeEl.value = mbwom.world.gamemode;
                   } 
                   else if (mbwom.world.creative) {
                       gamemodeEl.value = "1";
                   } 
                   else {
                       gamemodeEl.value = "0";
                   }
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
               if (xpEl && mbwom.world.experience !== undefined) {
                   xpEl.value = Math.floor(mbwom.world.experience / 100);
               }

               if (timeEl && mbwom.world.tim !== undefined) timeEl.value = mbwom.world.tim;
               if (weatherEl && mbwom.world.raining !== undefined) {
                   weatherEl.value = mbwom.world.raining > 0 ? "rain" : "clear";
               }
               if (dayEl && mbwom.world.day !== undefined) {
                   dayEl.value = mbwom.world.day;
               }
               
               mbwom.loadScene(1);

               if (typeof checkboxes !== 'undefined') {
                   checkboxes.forEach(cb => {
                       const index = parseInt(cb.getAttribute('data-index'));
                       if (!isNaN(index)) {
                           cb.checked = mbwom.getAchievement(index);
                       }
                   });
               }

               const filenameInput = document.getElementById("filename-display");
               if (filenameInput && fileManager.file) {
                   let cleanName = fileManager.file.name.replace(/\.mbw$/i, "");
                   if (typeof updateFilename === 'function') {
                       updateFilename(cleanName);
                   } else {
                       filenameInput.value = cleanName;
                   }
               }

               if (typeof initializeWorldCache === 'function') {
                   initializeWorldCache();
               }
               
               if (!window.isMainLoopRunning) {
                   if (typeof mainLoop === 'function') mainLoop();
                   window.isMainLoopRunning = true; 
               }

               // ==============================================================
               // ✨ FIX DEL CLIMA: DISPARAR ANIMACIÓN AL CARGAR ✨
               // ==============================================================
               const forceWeatherEl = document.getElementById("gr-weather");
               if (forceWeatherEl) forceWeatherEl.dispatchEvent(new Event('change'));

               console.log("World loaded succesfully with functional Mobs and Weather.");

               // ✨ 4. COMPLETAMOS LA BARRA AL 100% Y LA OCULTAMOS
               updateLoadingBar(100, "World Ready!");
               setTimeout(() => {
                   const overlay = document.getElementById('loading-overlay');
                   if (overlay) overlay.style.display = 'none';
               }, 600); // 600 milisegundos para que se alcance a ver el 100%

           }, 50); // Fin Timeout 3
       }, 50); // Fin Timeout 2
   }, 50); // Fin Timeout 1

  } catch (error) {
   console.error("Error cargando mundo:", error);
   alert("Error al cargar el archivo.");
   
   // Si hay un error, también ocultamos la pantalla de carga para no dejar al usuario atrapado
   const overlay = document.getElementById('loading-overlay');
   if (overlay) overlay.style.display = 'none';
  }
 },
 export: function () {
  if (mbwom.world) {
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
           if (!isNaN(index)) {
               mbwom.setAchievement(cb.checked, index);
           }
       });
   }

   if (window.fileInfo) {
       const filenameInput = document.getElementById("filename-display");
       if (filenameInput) {
           window.fileInfo.name = filenameInput.value.trim();
       }
       mbwom.world.fileInfo = window.fileInfo;
   }
   if (typeof window.defeatedEnder !== 'undefined') {
       mbwom.world.defeatedEnder = window.defeatedEnder;
   }

   // ==============================================================
   // ✨ GUARDADO DE MOBS: DICCIONARIO NATIVO (Haxe) ✨
   // ==============================================================
   const knownMobs = [
       "zombie", "skeleton", "creeper", "spider", "slime", "pig", "cow", "chicken", "sheep",
       "zombiepigman", "ghast", "blaze", "magmacube", "nethereye", "enderman", "enderdragon", "snowgolem", "bat", "rabbit"
   ];

   mbwom.world.mobs1 = {};
   mbwom.world.mobs2 = {};
   mbwom.world.mobs3 = {};

   let mobCounts = {};
   let globalMobCount = { 1: 0, 2: 0, 3: 0 };

   for(let s=1; s<=3; s++) {
       knownMobs.forEach(t => { mobCounts[t + "Num" + s] = 0; });
   }

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
           
           if (mobCounts[m.type + "Num" + s] !== undefined) {
               mobCounts[m.type + "Num" + s]++;
           } else {
               mobCounts[m.type + "Num" + s] = 1;
           }
       }
   }

   mbwom.world.mobNum1 = globalMobCount[1];
   mbwom.world.mobNum2 = globalMobCount[2];
   mbwom.world.mobNum3 = globalMobCount[3];

   for (let counterKey in mobCounts) {
       mbwom.world[counterKey] = mobCounts[counterKey];
   }
   // ==============================================================

   if (typeof limpiarMundoParaGuardar === 'function') {
       limpiarMundoParaGuardar(); // ✨ AQUÍ LLAMAS A LA LIMPIEZA
   }

   const jsonString = JSON.stringify(mbwom.world);
   const text = mbwAlgorithm.encode(jsonString);
   const blob = new Blob([text], { type: "text/plain" });
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   
   const filenameInput = document.getElementById("filename-display");
   let downloadName = filenameInput && filenameInput.value.trim() !== "" 
                      ? filenameInput.value.trim() + ".mbw" 
                      : "world.mbw";

   a.download = downloadName;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   URL.revokeObjectURL(url);
  } else {
      alert("No hay mundo cargado.");
  }
 }
};

// ==============================================================
// ✨ AQUÍ ESTÁ EL PUNTO 3.3 (Para el botón de abrir normal) ✨
// ==============================================================
if (fileManager.input) {
    fileManager.input.addEventListener("change", function (event) {
     fileManager.file = event.target.files[0];
     if (fileManager.file) {
      
      updateLoadingBar(10, "Leyendo archivo..."); // <-- AQUÍ SE ACTIVA

      const reader = new FileReader();
      reader.onload = fileManager.load;
      reader.readAsText(fileManager.file);
      event.target.value = ''; 
     }
    });
}

function limpiarMundoParaGuardar() {
    let eliminados = 0;
    
    // Mine Blocks tiene 3 dimensiones (scene1 = Overworld, scene2 = Nether, scene3 = End)
    for (let s = 1; s <= 3; s++) {
        let scene = mbwom.world["scene" + s];
        if (!scene) continue;
        
        // Recorremos cada columna (X) del mapa
        for (let x = 0; x < scene.length; x++) {
            let col = scene[x];
            
            // Verificamos que la columna exista y sea un Array
            if (!col || !Array.isArray(col)) continue;

            // 1. EL RECORTADOR (LA MAGIA PARA BAJAR EL PESO)
            // Revisamos la columna desde arriba hacia abajo. Si el último bloque es 
            // un "hueco", aire o null, lo destruimos usando .pop() para encoger el Array.
            while (col.length > 0) {
                let ultimoBloque = col[col.length - 1];
                
                if (!ultimoBloque || ultimoBloque === null || ultimoBloque.type === null || ultimoBloque.type === "air" || ultimoBloque.type === 0 || ultimoBloque.type === "0") {
                    col.pop(); // 🔥 Esto SÍ destruye el espacio y encoge el archivo
                    eliminados++;
                } else {
                    // Si chocamos con un bloque sólido (tierra, piedra), dejamos de recortar esa columna
                    break; 
                }
            }

            // 2. APLANADOR SUBTERRÁNEO
            // Si dejaste bloques de "air" debajo de la tierra, los convertimos a "null".
            // Un objeto {"type": "air"} pesa mucho más en texto que la simple palabra null.
            for (let y = 0; y < col.length; y++) {
                let b = col[y];
                if (b && (b.type === "air" || b.type === 0 || b.type === "0" || b.type === "")) {
                    col[y] = null; 
                    eliminados++;
                }
            }
        }
    }
    console.log(`🧹 ¡Limpieza profunda! Se encogieron las columnas y se purgaron ${eliminados} bloques inútiles.`);
}

// ==========================================
// ✨ DRAG AND DROP (Con Interfaz Visual) ✨
// ==========================================
const dropZone = document.body; 
const dragOverlay = document.getElementById('drag-overlay');
let dragCounter = 0; // El contador mágico anti-parpadeos

// 1. Detectar cuando un archivo ENTRA a la pantalla
dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragOverlay) dragOverlay.style.display = "flex"; // Mostramos el cartel gigante
});

// Mantener activo el modo de arrastre
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
});

// 2. Detectar cuando un archivo SALE de la pantalla (Si te arrepientes)
dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    
    // Solo si el contador llega a cero (salió de verdad de la ventana), ocultamos el cartel
    if (dragCounter === 0 && dragOverlay) {
        dragOverlay.style.display = "none";
    }
});

// 3. Lógica al soltar el archivo
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0; // Reiniciamos la cuenta
    if (dragOverlay) dragOverlay.style.display = "none"; // Ocultamos el cartel de inmediato

    // Verificamos si soltaron un archivo
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileManager.file = e.dataTransfer.files[0];
        
        if (fileManager.file.name.toLowerCase().endsWith('.mbw')) {
            
            // ==============================================================
            // ✨ AQUÍ ESTÁ EL PUNTO 3.3 (Para cuando arrastras el archivo) ✨
            // ==============================================================
            updateLoadingBar(10, "Reading world..."); // <-- AQUÍ SE ACTIVA

            const reader = new FileReader();
            reader.onload = fileManager.load;
            reader.readAsText(fileManager.file);
            console.log("¡World ready!");
        } else {
            alert("⚠️ Por favor, suelta un archivo válido de Mine Blocks (.mbw)");
        }
    }
});