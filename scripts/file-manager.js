const fileManager = {
 input: document.getElementById("file-input"),
load: function (event) {
  try {
   const jsonString = mbwAlgorithm.decode(event.target.result);
   const parsedWorld = JSON.parse(jsonString);

   // --- 🛠️ FIX DE LA PESTAÑA DEFAULT ---
   if (typeof WorldTabsManager !== 'undefined' && fileManager.file) {
       // Verificamos si la ÚNICA pestaña abierta es el mundo por defecto
       const isDefault = WorldTabsManager.openWorlds.length === 1 && WorldTabsManager.openWorlds[0].filename === "world.mbw";
       
       if (isDefault) {
           // Si es el por defecto, simplemente le cambiamos el nombre (No creamos pestaña extra)
           WorldTabsManager.openWorlds[0].filename = fileManager.file.name;
           WorldTabsManager.renderTabs();
       } else {
           // Si ya tienes un mundo real abierto, creamos una pestaña nueva y limpia
           WorldTabsManager.addWorld(fileManager.file.name, true, false);
       }
   }

   // Ahora inyectamos los datos cargados al mundo global
   mbwom.world = parsedWorld;
   
   const gamemodeEl = document.getElementById("gamemode");
   const cheatsEl = document.getElementById("cheats");
   
   // ... [Tu código sigue exactamente igual a partir de aquí] ...
   
   // --- Mapeo de Gamemode ---
   if (gamemodeEl) {
       // Primero intentamos leer el número exacto del gamemode
       if (mbwom.world.gamemode !== undefined) {
           gamemodeEl.value = mbwom.world.gamemode;
       } 
       // Si no existe, pero "creative" es true, lo ponemos en Creativo (1)
       else if (mbwom.world.creative) {
           gamemodeEl.value = "1";
       } 
       // Por defecto, Supervivencia (0)
       else {
           gamemodeEl.value = "0";
       }
   }
   if (cheatsEl) cheatsEl.checked = mbwom.world.cheats;

   // --- Mapeo de Dificultad (Texto a Select) ---
   const diffEl = document.getElementById("gr-difficulty");
   if (diffEl && mbwom.world.difficulty) {
       const diffMap = { "peaceful": "0", "easy": "1", "normal": "2", "hard": "3" };
       diffEl.value = diffMap[mbwom.world.difficulty] || "2";
   }
   
   // --- LECTURA DE GAME RULES Y JUGADOR ---
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
   const dayEl = document.getElementById("gr-day"); // <-- NUEVO

   if (healthEl && mbwom.world.health !== undefined) healthEl.value = mbwom.world.health;
   // Usamos mbwom.world.food para el hambre
   if (hungerEl && mbwom.world.food !== undefined) hungerEl.value = mbwom.world.food; 
   if (xpEl && mbwom.world.experience !== undefined) {
       xpEl.value = Math.floor(mbwom.world.experience / 100);
   }

// --- Lectura de Tiempo (tim), Clima (raining) y Día (day) ---
   if (timeEl && mbwom.world.tim !== undefined) timeEl.value = mbwom.world.tim;
   if (weatherEl && mbwom.world.raining !== undefined) {
       weatherEl.value = mbwom.world.raining > 0 ? "rain" : "clear";
   }
   // <-- NUEVO: Leemos y mostramos el día
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
       filenameInput.value = fileManager.file.name.replace(/\.mbw$/i, "");
   }

   if (typeof initializeWorldCache === 'function') {
       initializeWorldCache();
   }
   
   if (!window.isMainLoopRunning) {
       if (typeof mainLoop === 'function') mainLoop();
       window.isMainLoopRunning = true; 
   }

   

   console.log("Mundo cargado exitosamente.");

  } catch (error) {
   console.error("Error cargando mundo:", error);
   alert("Error al cargar el archivo.");
  }
 },
 export: function () {
  if (mbwom.world) {
   const gamemodeEl = document.getElementById("gamemode");
   const cheatsEl = document.getElementById("cheats");
   
   // --- Exportar Gamemode ---
   if (gamemodeEl) {
       // Guardamos el número (0, 1, 2 o 3)
       mbwom.world.gamemode = parseInt(gamemodeEl.value);
       // También actualizamos el booleano
       mbwom.world.creative = (gamemodeEl.value === "1");
   }
   if (cheatsEl) mbwom.world.cheats = cheatsEl.checked;

   // --- Exportar Dificultad (Select a Texto) ---
   const diffEl = document.getElementById("gr-difficulty");
   if (diffEl) {
       const diffMap = { "0": "peaceful", "1": "easy", "2": "normal", "3": "hard" };
       mbwom.world.difficulty = diffMap[diffEl.value] || "normal";
   }

   // --- GUARDADO DE GAME RULES Y JUGADOR ---
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
   // Guardamos en mbwom.world.food
   if (hungerEl) mbwom.world.food = parseInt(hungerEl.value) || 20; 
   if (xpEl) {
       let x = parseInt(xpEl.value);
       mbwom.world.experience = isNaN(x) ? 0 : (x * 100);
   }

   // --- Exportar Tiempo (tim) y Clima (raining) ---
   if (timeEl) {
       let t = parseInt(timeEl.value);
       mbwom.world.tim = isNaN(t) ? 0 : t;
   }
   if (weatherEl) {
       mbwom.world.raining = weatherEl.value === "clear" ? 0 : 1;
       // Si activamos la lluvia en el editor, aseguramos que el juego sepa que es un día de lluvia
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
}

if (fileManager.input) {
    fileManager.input.addEventListener("change", function (event) {
     fileManager.file = event.target.files[0];
     if (fileManager.file) {
      const reader = new FileReader();
      reader.onload = fileManager.load;
      reader.readAsText(fileManager.file);
      event.target.value = ''; 
     }
    });
}