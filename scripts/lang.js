// Diccionario de traducciones
const i18n = {
    en: {
        // Interfaz general
        "btn_export": "💾 Export",
        "btn_import": "📥 Import",
        "modal_inventory": "Inventory",
        
        // Alertas
        "msg_select_first": "Please select an item first.",
        "msg_item_saved": "Item saved to 'Custom' tab!"
    },
    es: {
        // Interfaz general
        "btn_export": "💾 Exportar",
        "btn_import": "📥 Importar",
        "modal_inventory": "Inventario",
        
        // Alertas
        "msg_select_first": "Por favor, selecciona un ítem primero.",
        "msg_item_saved": "¡Ítem guardado en la pestaña 'Personalizado'!"
    }
};

// Leemos el idioma guardado en el navegador (por defecto inglés)
let currentLang = localStorage.getItem('mbw_lang') || 'en';

// Función mágica para traducir textos directamente en JavaScript
function t(key) {
    return i18n[currentLang][key] || key; // Si no encuentra la traducción, muestra la clave
}