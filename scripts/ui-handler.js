// --- GESTIÓN DE PESTAÑAS (RIBBON) ---
function openTab(tabName) {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const panes = document.querySelectorAll('.tab-pane');
    panes.forEach(pane => pane.classList.remove('active'));

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    const targetPane = document.getElementById('tab-' + tabName);
    if (targetPane) {
        targetPane.classList.add('active');
    }
}

// --- GESTIÓN DE MODALES ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
    }
}

// --- GESTIÓN DE LOGROS ---
const checkboxes = document.querySelectorAll('#achievements-list input[type="checkbox"]');

function toggleAchievements(checked) {
    checkboxes.forEach(cb => cb.checked = checked);
}

// --- GESTIÓN DE NOMBRE DE ARCHIVO ---
let currentFilename = "world";

function updateFilename(value) {
    currentFilename = value.replace(/[^a-zA-Z0-9-_ ]/g, "");
}

// --- UI DESDE MUNDO ---
function updateUIFromWorld() {
    if (typeof mbwom === 'undefined' || !mbwom.world) return;

    const gm = document.getElementById("gamemode");
    if (gm) gm.value = mbwom.world.gamemode;

    const ch = document.getElementById("cheats");
    if (ch) ch.checked = mbwom.world.cheats;

    if (checkboxes) {
        checkboxes.forEach((cb, i) => {
             const index = parseInt(cb.getAttribute('data-index'));
             if (!isNaN(index)) {
                 cb.checked = mbwom.getAchievement(index);
             }
        });
    }
}

// --- GESTIÓN DE TEMAS CON PERSISTENCIA ---
function setTheme(themeName) {
    const body = document.body;
    body.classList.remove('theme-white', 'theme-pastel', 'theme-darkblue');
    
    if (themeName !== 'dark') {
        body.classList.add('theme-' + themeName);
    }
    
    // Guardar en localStorage
    localStorage.setItem('mbw_theme', themeName);
    
    // Actualizar el selector si se llama programáticamente
    const select = document.getElementById('theme-select');
    if (select) select.value = themeName;
}

// Cargar tema al inicio
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('mbw_theme') || 'dark';
    setTheme(savedTheme);
});