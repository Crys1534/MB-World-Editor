// ==========================================
// ✨ PERFIL UNIFICADO (foto y nombre de usuario)
// ==========================================
// Antes esto estaba duplicado en dos lugares a la vez (un <script> suelto
// dentro de index.html, y otra copia en main.js). Como main.js se cargaba
// después, la copia de index.html —que era la mejor, porque comprime la
// foto antes de guardarla— nunca se llegaba a usar. Aquí queda una sola
// versión, la buena, centralizada.

// ¿Este nombre cuenta como "todavía no elegí nombre"? (vacío o "Player", sin importar mayúsculas)
window.isDefaultUsername = function(name) {
    const n = String(name == null ? '' : name).trim().toLowerCase();
    return n === '' || n === 'player';
};

// ==========================================
// 🔒 PERFIL OBLIGATORIO (si el nombre de usuario es "Player")
// ==========================================
// Quien todavía se llama "Player" (el nombre de fábrica) tiene que elegir uno propio antes de usar el editor:
// la ventana "My Profile" se abre sola, no tiene la "×", no se cierra tocando afuera ni con Esc, y solo se puede salir con
// el botón Save cuando el nombre es distinto de "Player". Mientras está abierta, el teclado del editor no hace nada (input.js).
window.profileLocked = false;

function updateProfileLockUI() {
    const input = document.getElementById('global-profile-username');
    const err = document.getElementById('profile-lock-error');
    const btn = document.getElementById('profile-save-btn');
    const bad = window.isDefaultUsername(input ? input.value : '');
    if (btn) { btn.disabled = bad; btn.style.opacity = bad ? '0.5' : '1'; btn.style.cursor = bad ? 'not-allowed' : 'pointer'; }
    // El mensaje de error solo sale si la persona ya escribió algo (o dejó "Player"), no con el cuadro vacío al principio
    if (err) err.style.display = (window.profileLocked && bad && input && input.value.trim() !== '') ? 'block' : 'none';
}
window.updateProfileLockUI = updateProfileLockUI;

function setProfileLock(on) {
    window.profileLocked = !!on;
    const closeBtn = document.getElementById('profile-close-btn');
    const lockHint = document.getElementById('profile-lock-hint');
    const saveBtn = document.getElementById('profile-save-btn');
    if (closeBtn) closeBtn.style.display = on ? 'none' : '';
    if (lockHint) lockHint.style.display = on ? 'block' : 'none';
    if (saveBtn) saveBtn.style.display = on ? 'inline-block' : 'none';
    updateProfileLockUI();
}

window.openUnifiedProfile = function(options) {
    const locked = !!(options && options.locked === true);
    openModal('unified-profile-modal');
    const savedPic = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    const savedName = localStorage.getItem('mbw_username') || "Player";
    document.getElementById('modal-global-pfp').src = savedPic;
    const nameInput = document.getElementById('global-profile-username');
    // En el perfil obligatorio el cuadro empieza vacío (así no hay que borrar "Player" para escribir)
    nameInput.value = (locked && window.isDefaultUsername(savedName)) ? '' : savedName;
    setProfileLock(locked);

    // El aviso de bienvenida solo se muestra cuando el perfil se abre por el primer guardado
    const firstSave = !locked && !!(options && options.firstSave === true);
    const hint = document.getElementById('profile-first-hint');
    if (hint) hint.style.display = firstSave ? 'block' : 'none';
    if (firstSave || locked) { nameInput.focus(); nameInput.select(); }
};

// Botón Save (y Enter) del perfil obligatorio: guarda el nombre y deja salir solo si es válido
window.saveLockedProfile = function() {
    if (!window.profileLocked) return;
    const input = document.getElementById('global-profile-username');
    const name = input ? input.value.trim() : '';
    if (window.isDefaultUsername(name)) { updateProfileLockUI(); if (input) input.focus(); return; }
    window.handleGlobalUsernameChange(name, true);
    try { localStorage.setItem('mbw_profile_prompted', '1'); } catch (e) {}
    setProfileLock(false);
    closeModal('unified-profile-modal');
    if (typeof window.dmUpdateUserPanel === 'function') { try { window.dmUpdateUserPanel(); } catch (e) {} }
};

// Si el nombre guardado es "Player" (o no hay ninguno), se abre el perfil obligatorio
window.checkForcedProfile = function() {
    let name = null;
    try { name = localStorage.getItem('mbw_username'); } catch (e) { name = null; }
    if (window.isDefaultUsername(name)) window.openUnifiedProfile({ locked: true });
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

window.handleGlobalUsernameChange = function(newName, force) {
    // En el perfil obligatorio el nombre se guarda solo al pulsar Save (aquí solo se revisa si es válido)
    if (window.profileLocked && !force) { updateProfileLockUI(); return; }
    let cleanName = newName.trim() || 'Player';
    localStorage.setItem('mbw_username', cleanName);

    // Actualiza input multijugador
    const mpUsernameInput = document.getElementById('mp-username-input');
    if (mpUsernameInput) mpUsernameInput.value = cleanName;

    // Sincroniza con Firebase
    if (typeof myPresenceRef !== 'undefined' && myPresenceRef) myPresenceRef.update({ username: cleanName });

    // Avisa al Analytics (la sesión actual guarda el nombre nuevo; ver el script de visitas al final de index.html)
    if (typeof window.mbwAnalyticsSetName === 'function') { try { window.mbwAnalyticsSetName(cleanName); } catch (e) {} }
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

    // Si todavía se llama "Player", hay que elegir un nombre de usuario antes de empezar
    window.checkForcedProfile();
});
