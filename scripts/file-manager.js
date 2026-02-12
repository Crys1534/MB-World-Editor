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
   
   mbwom.loadScene(1);

   // --- ACTUALIZADO: Cargar logros usando data-index ---
   if (typeof checkboxes !== 'undefined') {
       checkboxes.forEach(cb => {
           const index = parseInt(cb.getAttribute('data-index'));
           if (!isNaN(index)) {
               cb.checked = mbwom.getAchievement(index);
           }
       });
   }

   // Nombre de archivo
   const filenameInput = document.getElementById("filename-display");
   if (filenameInput && fileManager.file) {
       filenameInput.value = fileManager.file.name.replace(/\.mbw$/i, "");
   }

   initializeWorldCache();
   mainLoop();
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
   
   mbwom.world.gamemode = gamemodeEl ? gamemodeEl.value : 0;
   mbwom.world.cheats = cheatsEl ? cheatsEl.checked : false;

   // --- ACTUALIZADO: Guardar logros usando data-index ---
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