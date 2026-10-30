// Se ejecuta en la página del editor ANTES que todo lo demás, solo dentro de la app de Android.
(function () {
    if (window.__mbweApp) return;
    window.__mbweApp = true;

    function send(o) {
        try { window.MBWEAndroid.postMessage(JSON.stringify(o)); } catch (e) { /* fuera de la app */ }
    }

    // 1) Descargas (exportar .mbw, respaldos .zip, capturas): el WebView no sabe bajar archivos "blob:",
    //    así que la página le pasa el archivo a la app y la app pregunta dónde guardarlo.
    var blobs = new Map();
    var origCreate = URL.createObjectURL, origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = function (obj) {
        var u = origCreate.call(URL, obj);
        try { if (obj instanceof Blob) blobs.set(u, obj); } catch (e) { /* nada */ }
        return u;
    };
    URL.revokeObjectURL = function (u) {
        setTimeout(function () { blobs.delete(u); try { origRevoke.call(URL, u); } catch (e) { /* nada */ } }, 120000);
    };
    function saveBlob(blob, name) {
        var r = new FileReader();
        r.onload = function () {
            var s = String(r.result), i = s.indexOf(',');
            send({ type: 'save', name: name || 'download', mime: blob.type || 'application/octet-stream', data: s.slice(i + 1) });
        };
        r.readAsDataURL(blob);
    }
    function handleAnchor(a) {
        if (!a || !a.hasAttribute || !a.hasAttribute('download')) return false;
        var href = a.href || '', name = a.getAttribute('download') || 'download';
        if (href.indexOf('blob:') === 0) {
            var b = blobs.get(href);
            if (b) saveBlob(b, name);
            else fetch(href).then(function (r) { return r.blob(); }).then(function (bb) { saveBlob(bb, name); }).catch(function () { /* nada */ });
            return true;
        }
        if (href.indexOf('data:') === 0) {
            fetch(href).then(function (r) { return r.blob(); }).then(function (bb) { saveBlob(bb, name); }).catch(function () { /* nada */ });
            return true;
        }
        return false;
    }
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (handleAnchor(this)) return;
        return origClick.apply(this, arguments);
    };
    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
        if (a && handleAnchor(a)) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // 2) Botón "atrás" del celular: cierra lo que esté abierto (menú File, ventanas, cajón de la cinta).
    //    Si no hay nada abierto, la app pregunta si quieres salir.
    function shown(el) { return !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'; }
    window.mbwAppBack = function () {
        try {
            if (window.profileLocked) return true;                       // primero hay que elegir nombre de usuario
            var fm = document.getElementById('backstage-menu');
            if (shown(fm) && typeof window.closeFileMenu === 'function') { window.closeFileMenu(); return true; }
            var mods = Array.prototype.filter.call(document.querySelectorAll('.modal, .mbw-modal-overlay'), shown);
            if (mods.length) {
                var m = mods[mods.length - 1];
                var btn = m.querySelector('.mbw-close-btn, .btn-close-large, .close-btn, .close, .modal-close, .btn-close, [onclick*="close"], [onclick*="Close"]');
                if (btn) btn.click(); else m.style.display = 'none';
                return true;
            }
            if (document.body.classList.contains('ribbon-open') && window.mbwMobile) { window.mbwMobile.closeDrawer(); return true; }
        } catch (e) { /* nada */ }
        return false;
    };

    // 3) La página sabe que está dentro de la app (por ejemplo, para no mostrar el botón de pantalla completa)
    if (document.documentElement) document.documentElement.classList.add('is-app');
    else document.addEventListener('DOMContentLoaded', function () { document.documentElement.classList.add('is-app'); });
})();
