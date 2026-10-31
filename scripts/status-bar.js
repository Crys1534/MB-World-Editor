// ==========================================================
// 📊 BARRA DE ESTADO (la franja de abajo)
// ----------------------------------------------------------
// Aquí viven:
//   · El medidor de FPS real (con semáforo de colores)
//   · El medidor de memoria (RAM)
//   · Los botones de zoom  ( − / + / 100% )
//   · El botón de pantalla completa
//
// (Antes todo esto estaba al final de ui-handler.js. Un "update"
//  lo borró por accidente y por eso el contador siempre decía
//  "60 FPS" y los botones no hacían nada.)
// ==========================================================


// ─────────────────────────────────────────────
// 🔍 ZOOM: botones − y + (sincronizados con la barra deslizable)
// ─────────────────────────────────────────────
window.zoomHUD = function (direction) {
    // direction es -1 (alejar) o 1 (acercar)
    if (typeof currentZoomIndex === 'undefined' || typeof ZOOM_LEVELS === 'undefined') return;
    const newIndex = currentZoomIndex + direction;
    // Que no se salga de los límites
    if (newIndex >= 0 && newIndex < ZOOM_LEVELS.length) {
        updateZoomSlider(newIndex); // función original de main.js
    }
};

// Clic en el porcentaje ("100%") = volver al zoom normal
window.resetZoomHUD = function () {
    if (typeof ZOOM_LEVELS === 'undefined') return;
    const index100 = ZOOM_LEVELS.indexOf(100);
    if (index100 !== -1) updateZoomSlider(index100);
};


// ─────────────────────────────────────────────
// ⛶ PANTALLA COMPLETA
// ─────────────────────────────────────────────
window.toggleFullscreenHUD = function () {
    if (!document.fullscreenElement) {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
            try {
                const p = req.call(el);
                if (p && p.catch) p.catch(err => { console.log('Error while fullscreen: ' + err.message); });
            } catch (err) { console.log('Error while fullscreen: ' + err.message); }
        }
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
};


// ─────────────────────────────────────────────
// ⚡ MEDIDOR DE FPS REAL (semáforo de rendimiento)
// ─────────────────────────────────────────────
// Cuenta los cuadros que el navegador dibuja de verdad cada segundo.
//   Verde    = 50 FPS o más   (fluido)
//   Amarillo = 30 a 49 FPS    (bajón leve)
//   Rojo     = menos de 30    (lag fuerte)
(function startFpsMeter() {
    const fpsDisplay = document.getElementById('fps-display');
    if (!fpsDisplay) return;

    let windowStart = performance.now();
    let frames = 0;
    // Se cuentan los cuadros que el editor DIBUJÓ de verdad (main.js suma window.framesDrawn en cada uno):
    // con el límite de FPS activado (Ajustes > Display) el contador marca 30 o 60, no los cuadros que "pasa" el navegador.
    let drawnAtStart = (typeof window.framesDrawn === 'number') ? window.framesDrawn : 0;

    function tick(now) {
        frames++;
        const elapsed = now - windowStart;

        if (elapsed >= 1000) {
            // Si la pestaña estuvo oculta (el navegador pausa los cuadros),
            // esa medición no sirve: se descarta en vez de mostrar "1 FPS".
            if (elapsed < 3000) {
                let drawn = (typeof window.framesDrawn === 'number') ? window.framesDrawn - drawnAtStart : 0;
                // Sin ningún mundo abierto el editor todavía no dibuja nada: se cuentan los cuadros del navegador (con el tope del límite, si hay)
                if (drawn <= 0) drawn = window.fpsLimit > 0 ? Math.min(frames, Math.ceil(window.fpsLimit * elapsed / 1000)) : frames;
                const fps = Math.max(0, Math.round(drawn * 1000 / elapsed));
                window.currentFPS = fps;
                fpsDisplay.innerText = fps + ' FPS';
                // El semáforo se mide contra la meta: 60 sin límite, o el límite elegido (a 30 FPS "30" es lo esperado, no un bajón)
                const ratio = fps / (window.fpsLimit > 0 ? window.fpsLimit : 60);
                fpsDisplay.style.color = ratio >= 50 / 60 ? '#2ecc71'   // verde
                                       : ratio >= 0.5     ? '#f1c40f'   // amarillo
                                       :                    '#e74c3c';  // rojo
            }
            frames = 0;
            drawnAtStart = (typeof window.framesDrawn === 'number') ? window.framesDrawn : 0;
            windowStart = now;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();


// ─────────────────────────────────────────────
// 🔋 MEDIDOR DE MEMORIA (RAM del editor)
// ─────────────────────────────────────────────
// Solo funciona en Chrome / Edge (otros navegadores no dan este dato).
// Se actualiza solo cada 2 segundos.
(function startMemoryMeter() {
    const memoryDisplay = document.getElementById('memory-display');
    if (!memoryDisplay || !window.performance || !window.performance.memory) return;

    function update() {
        const memoryMB = Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024));
        memoryDisplay.innerText = 'MEM: ' + memoryMB + ' MB';
        // Más de 800 MB = rojo, más de 400 MB = amarillo, si no gris
        memoryDisplay.style.color = memoryMB > 800 ? '#e74c3c'
                                  : memoryMB > 400 ? '#f1c40f'
                                  :                  '#bdc3c7';
    }
    update();
    setInterval(update, 2000);
})();
