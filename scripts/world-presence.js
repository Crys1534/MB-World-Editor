// =====================================================================
// 🌍 "¿Tengo un mundo abierto?" para la lista En línea
// =====================================================================
// Cada persona avisa en su presencia (online_users/<id>/hasWorld) si tiene un mundo abierto. En la lista En línea,
// el botón "Join" (pedir entrar a su mundo) solo sale si la otra persona tiene un mundo abierto: sin mundo no hay nada a lo que entrar.
// (Solo se guarda un sí/no. Las personas con una versión vieja del editor no mandan este dato: para ellas el botón sigue saliendo.)
(function () {
    'use strict';
    let last = null, lastRef = null;
    function tabs() { try { return (typeof WorldTabsManager !== 'undefined') ? WorldTabsManager : null; } catch (e) { return null; } }
    window.mbwHasWorldOpen = function () {
        const T = tabs();
        if (T && Array.isArray(T.openWorlds)) return T.openWorlds.length > 0;
        return typeof mbwom !== 'undefined' && !!(mbwom.scene && mbwom.scene.length);
    };
    function publish() {
        const ref = window.myPresenceRef;
        if (!ref) { last = null; lastRef = null; return; }
        const now = window.mbwHasWorldOpen();
        if (now === last && ref === lastRef) return;   // (si la presencia se volvió a crear, se manda otra vez)
        last = now; lastRef = ref;
        try { ref.update({ hasWorld: now }); } catch (e) { last = null; }
    }
    setInterval(publish, 1500);
    setTimeout(publish, 500);
})();
