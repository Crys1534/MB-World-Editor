const fileManager = {
 input: document.getElementById("file-input"),
 load: function (event) {
  try {
   const jsonString = mbwAlgorithm.decode(event.target.result);
   mbwom.world = JSON.parse(jsonString);
   
   const gamemodeEl = document.getElementById("gamemode");
   const cheatsEl = document.getElementById("cheats");
   
   if (gamemodeEl) gamemodeEl.value = mbwom.world.gamemode;
   if (cheatsEl) cheatsEl.checked = mbwom.world.cheats;
   
   // --- LECTURA DE GAME RULES Y JUGADOR ---
   if (mbwom.world.gameRules) {
       const keepInvEl = document.getElementById("gr-keepinventory");
       const daylightEl = document.getElementById("gr-dodaylightcycle");
       if (keepInvEl) keepInvEl.checked = mbwom.world.gameRules.keepinventory || false;
       if (daylightEl) daylightEl.checked = mbwom.world.gameRules.dodaylightcycle !== false;
   }
   
   const healthEl = document.getElementById("player-health");
   const xpEl = document.getElementById("player-xp");
   if (healthEl && mbwom.world.health !== undefined) healthEl.value = mbwom.world.health;
if (xpEl && mbwom.world.experience !== undefined) {
    // Dividimos entre 100 para mostrar un número más pequeño en el editor
    xpEl.value = Math.floor(mbwom.world.experience / 100);
}
   
   mbwom.loadScene(1);

   // --- NOTA: Código de carga de SpawnPoint eliminado a petición ---

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
   
   // --- CÓDIGO CORREGIDO: PREVENIR ACELERACIÓN DE CÁMARA ---
   // Validamos si el mainLoop ya fue iniciado previamente.
   if (!window.isMainLoopRunning) {
       if (typeof mainLoop === 'function') mainLoop();
       window.isMainLoopRunning = true; // Marcamos que ya está corriendo
   }
   // ---------------------------------------------------------

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
   
   mbwom.world.gamemode = gamemodeEl ? parseInt(gamemodeEl.value) : 0;
   mbwom.world.cheats = cheatsEl ? cheatsEl.checked : false;

   // --- GUARDADO DE GAME RULES Y JUGADOR ---
   if (!mbwom.world.gameRules) mbwom.world.gameRules = {};
   
   const keepInvEl = document.getElementById("gr-keepinventory");
   const daylightEl = document.getElementById("gr-dodaylightcycle");
   if (keepInvEl) mbwom.world.gameRules.keepinventory = keepInvEl.checked;
   if (daylightEl) mbwom.world.gameRules.dodaylightcycle = daylightEl.checked;
   
   const healthEl = document.getElementById("player-health");
   const xpEl = document.getElementById("player-xp");
   if (healthEl) mbwom.world.health = parseInt(healthEl.value) || 20;
if (xpEl) {
       let x = parseInt(xpEl.value);
       // Multiplicamos por 100 el valor introducido
       mbwom.world.experience = isNaN(x) ? 0 : (x * 100);
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