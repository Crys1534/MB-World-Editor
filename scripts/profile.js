// ==========================================
// ✨ PERFIL UNIFICADO (foto y nombre de usuario)
// ==========================================
// Antes esto estaba duplicado en dos lugares a la vez (un <script> suelto
// dentro de index.html, y otra copia en main.js). Como main.js se cargaba
// después, la copia de index.html —que era la mejor, porque comprime la
// foto antes de guardarla— nunca se llegaba a usar. Aquí queda una sola
// versión, la buena, centralizada.

window.openUnifiedProfile = function(options) {
    openModal('unified-profile-modal');
    const savedPic = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    const savedName = localStorage.getItem('mbw_username') || "Player";
    document.getElementById('modal-global-pfp').src = savedPic;
    const nameInput = document.getElementById('global-profile-username');
    nameInput.value = savedName;

    // El aviso de bienvenida solo se muestra cuando el perfil se abre por el primer guardado
    const firstSave = !!(options && options.firstSave === true);
    const hint = document.getElementById('profile-first-hint');
    if (hint) hint.style.display = firstSave ? 'block' : 'none';
    if (firstSave) { nameInput.focus(); nameInput.select(); }
};

// ✨ Primer mundo guardado en "My Worlds": se abre el perfil para que la persona
// elija su nombre de usuario y su foto. Si lo cierra sin tocar nada, se queda
// el nombre por defecto ("Player"). Solo se pregunta UNA vez, y no se pregunta
// si ya eligió nombre y foto por su cuenta.
window.promptProfileAfterFirstSave = function() {
    try {
        if (localStorage.getItem('mbw_profile_prompted')) return;
        localStorage.setItem('mbw_profile_prompted', '1');
        const name = (localStorage.getItem('mbw_username') || '').trim();
        const hasCustomName = name !== '' && name !== 'Player';
        const hasCustomPic = !!localStorage.getItem('mbw_profile_pic');
        if (hasCustomName && hasCustomPic) return;
    } catch (e) { /* sin localStorage: igual mostramos el perfil esta vez */ }
    openUnifiedProfile({ firstSave: true });
};

window.handleGlobalProfileUpload = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // --- PROCESAMIENTO DE IMAGEN ---
                const MAX_SIZE = 156; // El tamaño que pediste
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Recorte cuadrado (Center Crop) para que no se estire
                let width = img.width;
                let height = img.height;
                let offsetX = 0;
                let offsetY = 0;

                if (width > height) {
                    offsetX = (width - height) / 2;
                    width = height;
                } else {
                    offsetY = (height - width) / 2;
                    height = width;
                }

                canvas.width = MAX_SIZE;
                canvas.height = MAX_SIZE;

                // Dibujamos la imagen optimizada
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, offsetX, offsetY, width, height, 0, 0, MAX_SIZE, MAX_SIZE);

                // Convertimos a JPEG al 70% de calidad (0.7)
                const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                // --- GUARDADO Y ACTUALIZACIÓN ---
                localStorage.setItem('mbw_profile_pic', optimizedBase64);

                // Actualiza el modal
                document.getElementById('modal-global-pfp').src = optimizedBase64;

                // Actualiza el botón de la barra superior (si existe)
                const topImg = document.getElementById('top-profile-img');
                if (topImg) topImg.src = optimizedBase64;

                // Actualiza la miniatura en el menú multijugador
                const mpPreview = document.getElementById('mp-pfp-preview');
                if (mpPreview) mpPreview.style.backgroundImage = `url('${optimizedBase64}')`;

                // Sincroniza con Firebase (enviando solo los pocos KB optimizados)
                if (typeof myPresenceRef !== 'undefined' && myPresenceRef) {
                    myPresenceRef.update({ pfp: optimizedBase64 });
                }

                console.log("✅ Optimized and synchronized image!");
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};

window.handleGlobalUsernameChange = function(newName) {
    let cleanName = newName.trim() || 'Player';
    localStorage.setItem('mbw_username', cleanName);

    // Actualiza input multijugador
    const mpUsernameInput = document.getElementById('mp-username-input');
    if (mpUsernameInput) mpUsernameInput.value = cleanName;

    // Sincroniza con Firebase
    if (typeof myPresenceRef !== 'undefined' && myPresenceRef) myPresenceRef.update({ username: cleanName });
};

// Al cargar: pintar la foto guardada, unificar los clics de perfil, y
// restaurar si la cuadrícula estaba visible.
window.addEventListener('DOMContentLoaded', () => {
    const tImg = document.getElementById('top-profile-img');
    if (tImg) tImg.src = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";

    document.body.addEventListener('click', e => {
        if (e.target && (['mp-pfp-preview', 'mp-username-input'].includes(e.target.id) || e.target.closest('#mp-pfp-preview'))) {
            e.preventDefault(); openUnifiedProfile();
        }
    });

    // Restaurar la cuadrícula con memoria
    const savedGridState = localStorage.getItem('mbw_show_grid');
    if (savedGridState !== null) {
        showGrid = (savedGridState === 'true'); // Convertimos el texto a booleano
    }

    // Forzar a que la casilla visual coincida con la memoria de JavaScript
    const gridCheckboxes = document.querySelectorAll('input[onchange*="toggleGrid"], input[onclick*="toggleGrid"]');
    gridCheckboxes.forEach(cb => {
        cb.checked = showGrid;
    });

    // Asegurarnos de que el mapa se dibuje correctamente con o sin cuadrícula al inicio
    if (typeof worldDirty !== 'undefined') worldDirty = true;
});
