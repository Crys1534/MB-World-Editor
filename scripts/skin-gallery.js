// =====================================================================
// 🖼️ GALERÍA DE SPAWNSKINS
// =====================================================================
// Qué hace:
//   • Ventana con skins de Mine Blocks (miniaturas): buscar por nombre / autor, ver las más nuevas, guardarlas en
//     favoritas, y "poner en el mundo" (deja activa la herramienta Spawn Mob con esa skin: se hace clic en el mapa).
//   • También se abre desde el Mob Browser (campo "ID de la skin"): ahí el botón principal es "Usar esta skin".
//   • Se abre desde la pestaña View → grupo "Skins": un botón grande y, al lado, las últimas skins usadas (clic = dejar lista esa skin
//     para ponerla en el mapa, sin abrir la ventana).
//   • Pestañas: Mine Blocks (por defecto: Destacadas / Nuevas / Mejores, igual que la web; escribiendo: búsqueda)
//     · En este mundo (skins que ya usan los mobs del mundo) · Favoritas. Estas dos funcionan sin internet.
//     (Las "recientes" ya no son pestaña: siguen en la tira del grupo Skins de la pestaña View.)
//   • Cada fila (Destacadas / Nuevas / Mejores) muestra 4 tarjetas pegadas con una flecha a cada lado: las flechas CAMBIAN de página
//     (cuando hace falta se pide la página siguiente al servidor). La búsqueda, "En este mundo" y Favoritas usan una cuadrícula de 8 con las mismas flechas.
//   • A la derecha, pegada al borde, la vista previa: un clic en una skin la muestra grande con sus botones; doble clic = poner en el mundo / usar.
//
// De dónde salen las skins (SIN VERIFICAR contra el servidor real: desde donde se programó no se puede entrar a mineblocks.com;
// el formato sale de la documentación pública de la librería MBSkinAPI):
//   POST https://mineblocks.com/1/scripts/returnSkins.php   con FormData { type: 'new' | 'search', page: 1, key: texto }
//   Destacadas y Mejores: la documentación no las trae. Se prueba type 'featured' y la búsqueda 'best:true' (así busca la web);
//   si el servidor no las entiende (devuelve lo mismo que "nuevas" o nada) esa sección se oculta sola.
//   → lista JSON [{ id, name, author }, ...]  ("0" o vacío = no hay más). A veces trae avisos de PHP antes del JSON: se limpian.
//   Las imágenes siguen siendo https://mineblocks.com/1/skins/images/{id}.png (las pide getSpawnskinImage de main.js).
//   Si el servidor no deja leer la respuesta (CORS) o no hay internet, la pestaña 🌐 dice que no se pudo conectar; las demás siguen.
//   COMPROBADO por el usuario (consola del navegador): mineblocks.com NO manda el permiso CORS (Access-Control-Allow-Origin), así que
//   desde otra página (github.io) el navegador no deja leer la lista. Las IMÁGENES de las skins sí cargan (se dibujan con <img>).
//   Solución sin tocar su servidor: un "puente" propio gratis (ver docs del Project: proxy-skins-cloudflare.md). Ya viene puesto de
//   fábrica (DEFAULT_API = Cloudflare Worker del dueño del editor). Quien quiera otro lo pega en el cuadro de la ventana (se guarda
//   en su navegador: mbw_skin_api); window.SKIN_LIST_URL también lo reemplaza. Pegar la dirección de Mine Blocks vuelve a "directo".
//
// Se guarda solo en este navegador (localStorage): mbw_skin_favs, mbw_skin_recent. Nunca se escribe en el .mbw.
// Todo el texto que llega del servidor se muestra como TEXTO (nunca como HTML) y solo se aceptan IDs numéricos.
// =====================================================================
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const tr = (k, fb) => { const v = (typeof window.t === 'function') ? window.t(k) : k; return (v && v !== k) ? v : (fb || k); };
    const ID_RE = /^[0-9]{1,12}$/;
    const MAX_RECENT = 30;
    const MODAL_ID = 'sg-modal';
    function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
    function loadList(k) { try { const a = JSON.parse(lsGet(k, '[]')); return Array.isArray(a) ? a.filter(validItem) : []; } catch (e) { return []; } }
    function validItem(s) { return !!s && typeof s === 'object' && ID_RE.test(String(s.id)); }
    function cleanItem(s) { return { id: String(s.id), name: String(s.name == null ? '' : s.name).slice(0, 80), author: String(s.author == null ? '' : s.author).slice(0, 60) }; }

    const st = {
        home: null, homeCache: null, open: false, tab: 'web', query: '', filter: 'all',
        srch: null,                                  // lista de la búsqueda en el servidor (con texto escrito)
        lview: {},                                   // página actual de las pestañas locales (In this world / Favorites)
        sel: null,                                   // skin seleccionada (se ve en la vista previa de la derecha)
        token: 0,
        pick: null,                                  // función que recibe el ID cuando la galería se abrió para ELEGIR (Mob Browser)
        favs: loadList('mbw_skin_favs'), recent: loadList('mbw_skin_recent'),
        newest: loadList('mbw_skin_newest'),         // las 3 más nuevas de "New skins" (para la tira de la cinta cuando aún no usaste ninguna)
        meta: loadMeta()                             // id -> { name, author } lo que se sabe de cada skin (se guarda en el navegador)
    };
    // Nombre y autor de cada skin vista: se guardan en el navegador (hasta 600) para mostrarlos aunque no haya internet
    function loadMeta() {
        try {
            const o = JSON.parse(lsGet('mbw_skin_meta', '{}')), out = {};
            if (o && typeof o === 'object') Object.keys(o).forEach((id) => { const m = o[id]; if (ID_RE.test(id) && m && typeof m === 'object') out[id] = { name: String(m.name || '').slice(0, 80), author: String(m.author || '').slice(0, 60) }; });
            return out;
        } catch (e) { return {}; }
    }
    function saveMetaSoon() {
        clearTimeout(saveMetaSoon.t);
        saveMetaSoon.t = setTimeout(function () {
            const ids = Object.keys(st.meta);
            if (ids.length > 600) ids.slice(0, ids.length - 600).forEach((id) => { delete st.meta[id]; });
            lsSet('mbw_skin_meta', JSON.stringify(st.meta));
        }, 800);
    }
    function rememberMeta(s) {
        if (!s || !ID_RE.test(String(s.id))) return;
        const name = String(s.name || '').slice(0, 80), author = String(s.author || '').slice(0, 60);
        const cur = st.meta[s.id];
        if (cur && ((!name && !author) || (cur.name === name && cur.author === author))) return;
        st.meta[s.id] = { name: name || (cur && cur.name) || '', author: author || (cur && cur.author) || '' };
        saveMetaSoon();
    }
    st.favs.concat(st.recent).forEach(rememberMeta);
    const isFav = (id) => st.favs.some((f) => f.id === id);

    // ------------------------------------------------------------------ servidor
    // Dirección real de Mine Blocks: desde otra página el navegador NO deja leer su respuesta (falta el permiso CORS).
    const DIRECT_API = 'https://mineblocks.com/1/scripts/returnSkins.php';
    // "Puente" propio de fábrica (Cloudflare Worker del dueño del editor): hace la misma consulta y devuelve la respuesta con el permiso CORS.
    // Se puede cambiar por usuario (cuadro de la ventana → localStorage mbw_skin_api) o por página (window.SKIN_LIST_URL).
    const DEFAULT_API = 'https://mbwe-skins.crystalsnow1534.workers.dev/';
    const NET_DETAIL = 'no connection or blocked by the browser';
    function customApi() { return window.SKIN_LIST_URL || lsGet('mbw_skin_api', ''); }
    function apiUrl() { return customApi() || DEFAULT_API; }
    // El mismo puente sirve las imágenes de las skins (versión 2 del puente): main.js lo usa para bajarlas "limpias"
    function bridgeBase() { const u = apiUrl(); return (u && u !== DIRECT_API && validApi(u)) ? u : null; }
    function validApi(u) { return /^https:\/\/[^\s"'<>]{4,300}$/i.test(u); }
    // Un fallo "de red" con internet encendido cuando se consulta Mine Blocks directo casi siempre es su bloqueo CORS
    function errText(detail) {
        if (detail === NET_DETAIL && navigator.onLine !== false && apiUrl() === DIRECT_API) return tr('sg_error_cors', 'mineblocks.com does not let other websites read its skin list, so the list and the search cannot load here. You can still type a skin ID number above, or use the other tabs.');
        return tr('sg_error', 'Could not connect to mineblocks.com (no internet, or the server does not allow it). The other tabs still work.') + ' [' + detail + ']';
    }
    // Cuadro para pegar la dirección del "puente" propio (solo sale cuando falla la conexión)
    function proxyBox() {
        const d = document.createElement('div'); d.className = 'sg-proxy';
        const lab = document.createElement('div'); lab.className = 'sg-proxy-l'; lab.textContent = tr('sg_proxy_label', 'Have a bridge address? Paste it here:');
        const row = document.createElement('div'); row.className = 'sg-proxy-row';
        const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'sg-proxy-in'; inp.placeholder = 'https://....workers.dev'; inp.spellcheck = false; inp.maxLength = 300; inp.autocomplete = 'off';
        inp.value = lsGet('mbw_skin_api', '');
        const msg = document.createElement('div'); msg.className = 'sg-proxy-msg';
        const save = document.createElement('button'); save.type = 'button'; save.className = 'ex-btn ex-primary sg-proxy-save'; save.textContent = tr('sg_proxy_save', 'Save');
        const apply = function (v) { lsSet('mbw_skin_api', v); st.homeCache = null; st.token++; reload(); };
        save.onclick = function () {
            const v = inp.value.trim();
            if (v && !validApi(v)) { msg.textContent = tr('sg_proxy_bad', 'That address does not look right (it must start with https://).'); return; }
            apply(v);
        };
        inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') save.onclick(); });
        row.appendChild(inp); row.appendChild(save);
        if (lsGet('mbw_skin_api', '')) {
            const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'ex-btn sg-proxy-reset'; rs.textContent = tr('sg_proxy_reset', 'Use the default address');
            rs.onclick = function () { apply(''); };
            row.appendChild(rs);
        }
        d.appendChild(lab); d.appendChild(row); d.appendChild(msg);
        return d;
    }
    // Respuesta del servidor -> lista de skins. Quita etiquetas y avisos de PHP; "0" = sin resultados.
    function parseSkinList(text) {
        let t = String(text == null ? '' : text);
        if (t.trim() === '0' || t.trim() === '') return [];
        let data = null;
        // 1) lo normal: el JSON empieza en el primer "[{" (o "[]") y termina en el último "]"; lo que haya antes (avisos de PHP) se ignora.
        //    Así un nombre de skin con símbolos como <algo> no se daña.
        const a0 = t.search(/\[\s*(\{|\])/), b0 = t.lastIndexOf(']');
        if (a0 >= 0 && b0 > a0) { try { data = JSON.parse(t.substring(a0, b0 + 1)); } catch (e) { data = null; } }
        // 2) si no se pudo leer: se quitan etiquetas y avisos de PHP (como hace MBSkinAPI) y se vuelve a intentar
        if (!Array.isArray(data)) {
            t = t.replace(/<[^>]*>/g, '').replace(/(Warning|Notice|Deprecated|Fatal error):[^\[\n]*/gi, '').trim();
            if (t === '0') return [];
            const a = t.indexOf('['), b = t.lastIndexOf(']');
            if (a < 0 || b <= a) throw new Error('parse');
            data = JSON.parse(t.substring(a, b + 1));
        }
        if (!Array.isArray(data)) throw new Error('parse');
        const out = [];
        data.forEach((s) => { if (s && typeof s === 'object' && ID_RE.test(String(s.id))) out.push(cleanItem(s)); });
        return out;
    }
    window.mbwParseSkinList = parseSkinList;
    function fail(kind, detail) { const e = new Error(kind); e.detail = detail || kind; return e; }
    async function fetchRemote(type, key, page) {
        const fd = new FormData();
        fd.append('type', type);
        fd.append('page', String(page));
        if (key) fd.append('key', key);
        let res;
        try { res = await fetch(apiUrl(), { method: 'POST', body: fd }); }
        catch (e) { throw fail('net', NET_DETAIL); }
        if (!res || !res.ok) throw fail('http', 'HTTP ' + (res ? res.status : '?'));
        const txt = await res.text();
        try { return parseSkinList(txt); }
        catch (e) { throw fail('parse', 'unreadable answer: ' + String(txt).replace(/\s+/g, ' ').slice(0, 50)); }
    }

    // ------------------------------------------------------------------ listas con páginas (flechas a los lados, como la web)
    // Cada lista (Destacadas / Nuevas / Mejores / resultados de búsqueda) guarda lo que ya bajó y en qué página está; las flechas
    // CAMBIAN la página que se ve (no se agregan skins hacia abajo). Si la página siguiente aún no se ha pedido, se pide al servidor.
    const ROW = 4;                                                       // tarjetas por fila en la pantalla de inicio (la web muestra 4 por página)
    const GRID_COLS = 4, GRID_ROWS = 2, PER_GRID = GRID_COLS * GRID_ROWS; // búsqueda, "In this world" y Favorites
    function newList() { return { items: [], page: 1, hasMore: true, loading: false, err: '', loaded: false, off: false, view: 0 }; }
    // Pide páginas al servidor hasta tener al menos "need" skins (o hasta que ya no haya más). false = llegó tarde (otra búsqueda la reemplazó).
    async function fillList(L, fetcher, need, token, filterFn, maxPages) {
        let guard = 0;
        while (L.items.length < need && L.hasMore && guard++ < (maxPages || 6)) {
            const list = await fetcher(L.page);
            if (token !== st.token) return false;
            list.forEach(rememberMeta);
            const known = {}; L.items.forEach((s) => { known[s.id] = 1; });
            const add = (filterFn ? list.filter(filterFn) : list).filter((s) => !known[s.id]);
            L.items = L.items.concat(add);
            L.loaded = true;
            if (!list.length) L.hasMore = false; else L.page++;
        }
        return true;
    }

    // Todo lo que pide páginas de UNA lista va en fila (uno después de otro): así "preparar las siguientes" y "pasar de página"
    // nunca piden la misma página dos veces.
    function enqueue(L, job) { const run = function () { return job(); }; L.chain = (L.chain || Promise.resolve()).then(run, run); return L.chain; }
    // Prepara en segundo plano las páginas siguientes (lista + imágenes), sin mostrar "Cargando" ni cambiar de página
    function prefetchList(L, fetcher, upTo, filterFn, maxPages) {
        const token = st.token;
        return enqueue(L, async function () {
            if (token !== st.token || L.off || !L.hasMore || L.items.length >= upTo) return;
            try { await fillList(L, fetcher, upTo, token, filterFn, maxPages); } catch (e) { /* se vuelve a intentar al pedir esa página */ }
        }).then(function () {
            if (token !== st.token) return;
            if (typeof window.mbwSkinPrefetch === 'function') window.mbwSkinPrefetch(L.items.slice(0, upTo).map((s) => s.id), false);
            if (st.open) refreshArrows();
        });
    }

    // ------------------------------------------------------------------ pantalla de inicio: Destacadas / Nuevas / Mejores (como la web)
    const SECTIONS = [['featured', 'sg_sec_featured', 'Featured skins'], ['new', 'sg_sec_new', 'New skins'], ['best', 'sg_sec_best', 'Best skins']];
    function homeInit() {
        st.home = {};
        SECTIONS.forEach((s) => { st.home[s[0]] = newList(); });
    }
    async function fetchSection(k, page) {
        if (k === 'new') return fetchRemote('new', '', page);
        if (k === 'featured') {
            try { const l = await fetchRemote('featured', '', page); if (l.length) return l; } catch (e) { /* se prueba la otra forma */ }
            return fetchRemote('search', 'featured:true', page);
        }
        try { const l = await fetchRemote('search', 'best:true', page); if (l.length) return l; } catch (e) { /* se prueba la otra forma */ }
        return fetchRemote('best', '', page);
    }
    // Un tipo que el servidor no conoce suele devolver la lista de "nuevas": si es igual, esa sección no existe.
    function sameAsNew(list) {
        const ref = st.home.new.items;
        return !!list.length && ref.length >= list.length && list.every((s, i) => ref[i] && ref[i].id === s.id);
    }
    // dir 0 = primera carga de la sección; dir 1 = pasar a la página siguiente (pidiéndola si todavía no se tiene)
    async function homeLoad(k, dir) {
        const h = st.home && st.home[k];
        if (!h || h.loading || h.off) return;
        const token = st.token;
        h.loading = true; h.err = '';
        renderResults();
        try {
            const target = h.view + (dir ? 1 : 0);
            const ok = await enqueue(h, function () { return fillList(h, homeFetcher(k, h), (target + 1) * ROW, token); });
            if (!ok) return;
            if (h.items.length > target * ROW) h.view = target;
        } catch (e) {
            if (token !== st.token) return;
            h.err = (e && e.detail) || 'net'; if (!h.items.length) h.hasMore = false;   // con skins ya mostradas, "Retry" vuelve a pedir la página que falló
        }
        if (token === st.token) { h.loading = false; renderResults(); homePrefetch(k); }
    }
    function homeFetcher(k, h) {
        return async function (p) {
            const list = await fetchSection(k, p);
            if (k !== 'new' && p === 1 && sameAsNew(list)) { h.off = true; return []; }
            return list;
        };
    }
    function homePrefetch(k) { const h = st.home && st.home[k]; if (h && !h.off && !h.err) prefetchList(h, homeFetcher(k, h), (h.view + 2) * ROW, null, 3); }
    function homeGo(k, dir) {
        const h = st.home && st.home[k];
        if (!h || h.loading) return;
        if (dir < 0) { if (h.view > 0) { h.view--; renderResults(); } return; }
        if (h.items.length > (h.view + 1) * ROW) { h.view++; renderResults(); homePrefetch(k); return; }
        if (h.hasMore) { h.err = ''; homeLoad(k, 1); }
    }
    async function homeStart() {
        const c = st.homeCache;
        if (c && Date.now() - c.t < 300000 && c.h.new.items.length && SECTIONS.every((d) => !c.h[d[0]].loading)) { st.home = c.h; renderResults(); return; }
        homeInit();
        st.homeCache = { t: Date.now(), h: st.home };
        const mine = st.token;
        await homeLoad('new', 0);
        if (mine !== st.token || !st.open || homeMode() === false) return;
        if (st.home.new.err && !st.home.new.items.length) return;           // sin conexión: no se insiste con Destacadas / Mejores
        homeLoad('featured', 0);
        homeLoad('best', 0);
    }
    function homeMode() { return st.tab === 'web' && !st.query; }

    // Una sección con título (opcional), fila de tarjetas PEGADAS con una flecha a cada lado, y "Page N" abajo.
    // o = { title, items, view, per, cols, hasMore, loading, err, onPrev, onNext, onRetry, empty }
    function buildSection(o) {
        const sec = document.createElement('div'); sec.className = 'sg-sec';
        if (o.title) { const hd = document.createElement('div'); hd.className = 'sg-sec-h'; hd.textContent = o.title; sec.appendChild(hd); }
        const start = o.view * o.per;
        const slice = o.items.slice(start, start + o.per);
        const canPrev = !o.loading && o.view > 0;
        // (o.liveLen: cuántas hay AHORA en la lista; las páginas que se preparan en segundo plano la hacen crecer)
        const nextOk = function () { const n = o.liveLen ? o.liveLen() : o.items.length; return !o.loading && (n > (o.view + 1) * o.per || !!(o.list ? o.list.hasMore : o.hasMore)); };
        const canNext = nextOk();
        sec._canNext = nextOk;
        const arrow = function (cls, title, on, fn) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'sg-arrow ' + cls; b.title = title; b.setAttribute('aria-label', title);
            b.disabled = !on; b.onclick = fn; return b;
        };
        const row = document.createElement('div'); row.className = 'sg-pager' + (o.loading ? ' busy' : '');
        row.appendChild(arrow('sg-prev', tr('sg_prev', 'Previous page'), canPrev, o.onPrev));
        const grid = document.createElement('div'); grid.className = 'sg-grid'; grid.style.setProperty('--cols', String(o.cols));
        slice.forEach((it) => grid.appendChild(makeCard(it)));
        if (!slice.length) { const e = document.createElement('div'); e.className = 'sg-grid-empty'; e.textContent = o.loading ? tr('sg_loading', 'Loading...') : (o.empty || tr('sg_none', 'Nothing to show.')); grid.appendChild(e); }
        row.appendChild(grid);
        row.appendChild(arrow('sg-next', tr('sg_next', 'Next page'), canNext, o.onNext));
        sec.appendChild(row);
        if (o.showPage && (slice.length || o.view > 0)) {             // "Página N" solo en los resultados de una búsqueda
            const pn = document.createElement('div'); pn.className = 'sg-pagenum'; pn.textContent = tr('sg_page', 'Page {n}').replace('{n}', String(o.view + 1));
            sec.appendChild(pn);
        }
        if (o.err) sec.appendChild(errNote(o.err, o.onRetry));
        return sec;
    }
    // Cuando termina de prepararse una página en segundo plano, las flechas "→" se ponen al día (sin volver a dibujar las tarjetas)
    function refreshArrows() {
        const box = $('sg-results'); if (!box) return;
        Array.prototype.forEach.call(box.querySelectorAll('.sg-sec'), function (sec) {
            const b = sec.querySelector('.sg-next');
            if (b && typeof sec._canNext === 'function') b.disabled = !sec._canNext();
        });
    }
    // Aviso de error con botón "Retry" (y, si hace falta, el cuadro para pegar otra dirección)
    function errNote(err, onRetry) {
        const note = document.createElement('div'); note.className = 'sg-sec-note err';
        note.textContent = errText(err);
        if (onRetry) {
            const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'ex-btn sg-retry'; rb.textContent = tr('sg_retry', 'Retry');
            rb.onclick = onRetry;
            note.appendChild(document.createElement('br')); note.appendChild(rb);
        }
        if (err === NET_DETAIL || customApi()) note.appendChild(proxyBox());
        return note;
    }
    function renderHome(box) {
        SECTIONS.forEach((def) => {
            const k = def[0], h = st.home[k];
            if (h.off) return;
            if (k !== 'new' && h.loaded && !h.items.length && !h.err) return;       // el servidor no tiene esa sección
            if (k !== 'new' && h.err && !h.items.length) return;                    // no hubo manera de pedirla: no estorba
            if (k !== 'new' && !h.loaded && !h.loading && !h.items.length) return;  // todavía no se pide (o no se va a pedir): no sale vacía
            if (h.err && !h.items.length) {                                         // New sin conexión: título + aviso con Retry (sin fila vacía)
                const sec = document.createElement('div'); sec.className = 'sg-sec';
                const hd = document.createElement('div'); hd.className = 'sg-sec-h'; hd.textContent = tr(def[1], def[2]); sec.appendChild(hd);
                sec.appendChild(errNote(h.err, function () { st.token++; homeStart(); }));
                box.appendChild(sec);
                return;
            }
            box.appendChild(buildSection({
                title: tr(def[1], def[2]), items: h.items, view: h.view, per: ROW, cols: ROW, hasMore: h.hasMore, list: h, liveLen: function () { return h.items.length; }, loading: h.loading, err: h.err,
                onPrev: function () { homeGo(k, -1); }, onNext: function () { homeGo(k, 1); }, onRetry: function () { homeGo(k, 1); }
            }));
        });
    }

    // ------------------------------------------------------------------ miniaturas
    // El primer cuadro (16x22) de la tira de la skin. getSpawnskinImage (main.js) la baja y la guarda; si todavía no llegó se espera.
    function paintThumb(cv, id) {
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (typeof window.getSpawnskinImage !== 'function') return;
        const sk = window.getSpawnskinImage(id);
        if (!sk) {                                    // todavía bajando: se vuelve a pintar cuando llegue
            try { if (typeof skinWaiters !== 'undefined') (skinWaiters[id] = skinWaiters[id] || []).push(function () { if (cv.isConnected) paintThumb(cv, id); }); } catch (e) { /* sin aviso */ }
            cv.dataset.state = 'loading';
            return;
        }
        if (sk.hasFailed) { cv.dataset.state = 'failed'; ctx.fillStyle = '#5E5E5E'; ctx.fillRect(2, 2, 12, 18); return; }
        try {
            const w = sk.naturalWidth || sk.width || 16, h = sk.naturalHeight || sk.height || 22;
            ctx.drawImage(sk, 0, 0, Math.min(16, w), Math.min(22, h), 0, 0, Math.min(16, w), Math.min(22, h));
            cv.dataset.state = 'ok';
        } catch (e) { cv.dataset.state = 'failed'; }
    }

    // ------------------------------------------------------------------ guardados en el navegador
    function saveFavs() { lsSet('mbw_skin_favs', JSON.stringify(st.favs)); }
    function toggleFav(item) {
        const i = st.favs.findIndex((f) => f.id === item.id);
        if (i >= 0) st.favs.splice(i, 1); else st.favs.unshift(cleanItem(item));
        saveFavs();
    }
    function addRecent(item) {
        const c = cleanItem(item);
        st.recent = [c].concat(st.recent.filter((r) => r.id !== c.id)).slice(0, MAX_RECENT);
        lsSet('mbw_skin_recent', JSON.stringify(st.recent));
        renderRecentStrip();
    }

    // Tira de skins del grupo Skins de la cinta: las 3 últimas que usaste; si todavía no usaste ninguna, las 3 más nuevas de
    // "New skins" (se piden a la web unos segundos después de abrir el editor). Un clic deja lista esa skin para el mapa.
    const STRIP_MAX = 3;
    function renderRecentStrip() {
        const box = $('recent-skins-ribbon');
        if (!box) return;
        box.textContent = '';
        const useNew = !st.recent.length;
        const list = (useNew ? st.newest : st.recent).slice(0, STRIP_MAX);
        box.classList.toggle('sg-recent-new', useNew && list.length > 0);
        if (!list.length) {
            const e = document.createElement('span'); e.className = 'empty-text'; e.textContent = tr('lbl_empty', 'Empty');
            box.appendChild(e);
            return;
        }
        list.forEach((item) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'sg-rs-item'; b.dataset.id = item.id;
            b.title = (useNew ? tr('sg_rs_new_tip', 'New skin: {name}. Click to place it.') : tr('sg_rs_tip', 'Place the skin: {name}')).replace('{name}', labelOf(item) + (item.author ? ' (' + item.author + ')' : ''));
            const cv = document.createElement('canvas'); cv.width = 16; cv.height = 22;
            b.appendChild(cv);
            b.onclick = function () { placeInWorld(item); };
            box.appendChild(b);
            paintThumb(cv, item.id);
        });
    }

    // ------------------------------------------------------------------ skins que ya usa el mundo
    function worldSkins() {
        const ids = [];
        const seen = {};
        function scan(mobs) {
            if (!mobs || typeof mobs !== 'object') return;
            Object.keys(mobs).forEach((k) => {
                const m = mobs[k];
                if (m && m.type === 'spawnskin' && m.skin != null && ID_RE.test(String(m.skin)) && !seen[String(m.skin)]) { seen[String(m.skin)] = 1; ids.push(String(m.skin)); }
            });
        }
        try {
            if (typeof mbwom !== 'undefined' && mbwom) {
                scan(mbwom.mobs);
                if (mbwom.world) for (let n = 1; n <= 3; n++) scan(mbwom.world['mobs' + n]);
            }
        } catch (e) { /* sin mundo */ }
        return ids.map((id) => { const m = st.meta[id] || {}; return { id: id, name: m.name || '', author: m.author || '' }; });
    }

    // ------------------------------------------------------------------ acciones
    function toast(msg) {
        let t = $('sg-toast');
        if (!t) { t = document.createElement('div'); t.id = 'sg-toast'; document.body.appendChild(t); }
        t.textContent = msg;
        t.classList.add('on');
        clearTimeout(toast.tm);
        toast.tm = setTimeout(function () { t.classList.remove('on'); }, 4500);
    }
    function labelOf(item) { return item.name || ('#' + item.id); }
    // Deja lista la herramienta Spawn Mob con esa skin: el siguiente clic en el mapa pone la spawnskin.
    function placeInWorld(item) {
        const me = window.__mobEditor;
        if (!me || typeof selectMobToSpawn !== 'function') return false;
        const spec = me.defaultSpec('spawnskin');
        spec.extra.skin = String(item.id);
        const clean = me.normalizeSpec ? me.normalizeSpec(JSON.parse(JSON.stringify(spec))) : spec;
        addRecent(item);
        closeGallery();
        selectMobToSpawn('spawnskin', clean);
        toast(tr('sg_toast_place', 'Click on the map to place the skin: {name}').replace('{name}', labelOf(item)));
        return true;
    }
    function useSkin(item) {
        const cb = st.pick;
        addRecent(item);
        closeGallery();
        if (typeof cb === 'function') { try { cb(String(item.id), item); } catch (e) { /* el panel ya no existe */ } }
    }
    function copyId(item, btn) {
        let ok = false;
        try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(String(item.id)); ok = true; } } catch (e) { ok = false; }
        if (btn) { const old = btn.textContent; btn.textContent = ok ? '✔' : '#' + item.id; setTimeout(function () { btn.textContent = old; }, 1200); }
    }

    // ------------------------------------------------------------------ ventana
    function ensureModal() {
        let m = $(MODAL_ID);
        if (m) return m;
        m = document.createElement('div');
        m.id = MODAL_ID; m.className = 'modal'; m.style.zIndex = '6000';
        m.innerHTML =
            '<div class="modal-content mbw-standard-modal sg-window">' +
            '<div class="mbw-modal-header"><h3 id="sg-title"></h3><span class="mbw-close-btn" id="sg-close">&times;</span></div>' +
            '<div class="sg-layout">' +
            '<div class="sg-main">' +
            '<div class="sg-tabs" id="sg-tabs"></div>' +
            '<div class="sg-search"><input type="text" id="sg-q" autocomplete="off" spellcheck="false" maxlength="60">' +
            '<select id="sg-filter"></select></div>' +
            '<div class="sg-status" id="sg-status"></div>' +
            '<div class="sg-results" id="sg-results"></div>' +
            '</div>' +
            '<aside class="sg-preview" id="sg-preview"></aside>' +
            '</div></div>';
        document.body.appendChild(m);
        $('sg-close').onclick = closeGallery;
        m.addEventListener('mousedown', function (e) { if (e.target === m) closeGallery(); });
        const q = $('sg-q');
        let timer = null;
        q.addEventListener('input', function () {
            st.query = q.value.trim();
            clearTimeout(timer);
            timer = setTimeout(function () { reload(); }, 450);
        });
        q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timer); st.query = q.value.trim(); reload(); } });
        $('sg-filter').addEventListener('change', function () { st.filter = this.value; reload(); });
        window.addEventListener('keydown', function (e) {
            if (!st.open || e.key !== 'Escape') return;
            e.stopImmediatePropagation(); e.preventDefault();
            closeGallery();
        }, true);
        return m;
    }

    const TABS = ['web', 'world', 'favs'];
    function texts() {
        $('sg-title').textContent = st.pick ? tr('sg_title_pick', '🖼️ Choose a skin') : tr('sg_title', '🖼️ Skin Gallery');
        $('sg-q').placeholder = tr('sg_search_ph', 'Search by name, author or ID...');
        const f = $('sg-filter');
        const cur = st.filter;
        f.innerHTML = '';
        [['all', tr('sg_filter_all', 'Name + author')], ['name', tr('sg_filter_name', 'Name only')], ['author', tr('sg_filter_author', 'Author only')]].forEach(function (o) {
            const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; f.appendChild(op);
        });
        f.value = cur;
        const tabs = $('sg-tabs');
        tabs.innerHTML = '';
        [['web', tr('sg_tab_web', '🌐 Mine Blocks')], ['world', tr('sg_tab_world', '🌍 In this world')], ['favs', tr('sg_tab_favs', '⭐ Favorites')]].forEach(function (o) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'sg-tab' + (st.tab === o[0] ? ' on' : ''); b.dataset.tab = o[0]; b.textContent = o[1];
            b.onclick = function () { setTab(o[0]); };
            tabs.appendChild(b);
        });
    }

    function setTab(t) { st.tab = TABS.indexOf(t) >= 0 ? t : 'web'; texts(); reload(); }

    // Texto que se busca en las pestañas locales (nombre / autor / ID)
    function matches(item) {
        const q = st.query.toLowerCase();
        if (!q) return true;
        const n = item.name.toLowerCase(), a = item.author.toLowerCase();
        if (st.filter === 'name') return n.includes(q);
        if (st.filter === 'author') return a.includes(q);
        return n.includes(q) || a.includes(q) || item.id.includes(q);
    }
    function localList() {
        const base = st.tab === 'world' ? worldSkins() : st.favs;
        return base.map((s) => { const m = st.meta[s.id]; return (m && (!s.name || !s.author)) ? { id: s.id, name: s.name || m.name, author: s.author || m.author } : s; }).filter(matches);
    }
    // Escribir solo un número ofrece usar directamente ese ID (cualquier pestaña): esa tarjeta va primero
    function idCardFor(list) {
        if (!ID_RE.test(st.query) || list.some((s) => s.id === st.query)) return null;
        const m = st.meta[st.query] || {};
        return { id: st.query, name: m.name || '', author: m.author || '' };
    }

    function reload() {
        st.token++;
        st.lview = {};
        const box = $('sg-results'); if (box) box.scrollTop = 0;
        st.srch = newList();
        if (homeMode()) homeStart();
        else if (st.tab === 'web') searchLoad(0);
        else renderResults();
    }
    // Búsqueda en el servidor (con texto escrito). dir 0 = primera página; dir 1 = pasar a la siguiente.
    async function searchLoad(dir) {
        const L = st.srch;
        if (!L || L.loading) return;
        const token = st.token;
        L.loading = true; L.err = '';
        renderResults();
        try {
            const extra = idCardFor(L.items) ? 1 : 0;
            const target = L.view + (dir ? 1 : 0);
            const ok = await enqueue(L, function () { return fillList(L, searchFetcher(), (target + 1) * PER_GRID - extra, token, st.filter !== 'all' ? matches : null, 8); });
            if (!ok) return;
            if (L.items.length + extra > target * PER_GRID) L.view = target;
        } catch (e) {
            if (token !== st.token) return;
            L.err = (e && e.detail) || 'net';
            if (!L.items.length) L.hasMore = false;
        }
        if (token === st.token) { L.loading = false; renderResults(); searchPrefetch(); }
    }
    function searchFetcher() { const q = st.query; return function (p) { return fetchRemote('search', q, p); }; }
    // Deja listas las 4 páginas siguientes de la búsqueda (sus skins y sus imágenes), por si la persona sigue pasando páginas
    function searchPrefetch() {
        const L = st.srch;
        if (!L || L.err) return;
        prefetchList(L, searchFetcher(), (L.view + 5) * PER_GRID, st.filter !== 'all' ? matches : null, 10);
    }
    function searchGo(dir) {
        const L = st.srch;
        if (!L || L.loading) return;
        const extra = idCardFor(L.items) ? 1 : 0;
        if (dir < 0) { if (L.view > 0) { L.view--; renderResults(); } return; }
        if (L.items.length + extra > (L.view + 1) * PER_GRID) { L.view++; renderResults(); searchPrefetch(); return; }
        if (L.hasMore) { L.err = ''; searchLoad(1); }
    }
    function localGo(dir) {
        st.lview[st.tab] = Math.max(0, (st.lview[st.tab] || 0) + dir);
        renderResults();
    }

    // ------------------------------------------------------------------ tarjetas y vista previa
    function primary(item) { if (st.pick) useSkin(item); else placeInWorld(item); }
    function select(item) {
        st.sel = cleanItem(item);
        const m = st.meta[st.sel.id];
        if (m) { if (!st.sel.name) st.sel.name = m.name; if (!st.sel.author) st.sel.author = m.author; }
        Array.prototype.forEach.call(document.querySelectorAll('#sg-results .sg-card'), function (c) { c.classList.toggle('sel', c.dataset.id === st.sel.id); });
        renderPreview();
    }
    function makeCard(item) {
        const d = document.createElement('div');
        d.className = 'sg-card' + (st.sel && st.sel.id === item.id ? ' sel' : ''); d.dataset.id = item.id;
        // La skin de pie sobre un fondo cuadriculado; un clic la muestra en la vista previa, doble clic hace la acción principal
        const stage = document.createElement('div'); stage.className = 'sg-stage';
        const cv = document.createElement('canvas');
        cv.width = 16; cv.height = 22; cv.className = 'sg-thumb';
        stage.appendChild(cv);
        const fav = document.createElement('button'); fav.type = 'button'; fav.className = 'sg-fav sg-favimg' + (isFav(item.id) ? ' on' : '');
        fav.textContent = isFav(item.id) ? '★' : '☆'; fav.title = tr('sg_fav_tip', 'Favorite');
        fav.onclick = function (e) { e.stopPropagation(); toggleFavAndRefresh(item); };
        stage.appendChild(fav);
        d.appendChild(stage);
        const info = document.createElement('div');
        info.className = 'sg-info';
        const nm = document.createElement('div'); nm.className = 'sg-name'; nm.textContent = item.name || tr('sg_unnamed', 'Skin');
        nm.title = item.name || '';
        const au = document.createElement('div'); au.className = 'sg-author'; au.textContent = item.author ? tr('sg_by', 'by {name}').replace('{name}', item.author) : '';
        info.appendChild(nm); info.appendChild(au);
        d.appendChild(info);
        d.onclick = function () { select(item); };
        d.ondblclick = function () { primary(item); };
        paintThumb(cv, item.id);
        return d;
    }
    function toggleFavAndRefresh(item) {
        toggleFav(item);
        if (st.tab === 'favs') renderResults();
        else Array.prototype.forEach.call(document.querySelectorAll('#sg-results .sg-card'), function (c) {
            if (c.dataset.id !== item.id) return;
            const b = c.querySelector('.sg-fav'); if (b) { b.textContent = isFav(item.id) ? '★' : '☆'; b.classList.toggle('on', isFav(item.id)); }
        });
        renderPreview();
    }
    // Panel de la derecha: la skin seleccionada en grande + sus datos + las acciones
    function renderPreview() {
        const p = $('sg-preview');
        if (!p) return;
        p.innerHTML = '';
        const hd = document.createElement('div'); hd.className = 'sg-pv-head'; hd.textContent = tr('sg_pv_title', 'Preview'); p.appendChild(hd);
        const it = st.sel;
        const stage = document.createElement('div'); stage.className = 'sg-pv-stage';
        if (!it) {
            stage.classList.add('empty');
            const e = document.createElement('div'); e.className = 'sg-pv-empty'; e.textContent = tr('sg_pv_empty', 'Click a skin to see it here.'); stage.appendChild(e);
            p.appendChild(stage);
            return;
        }
        const cv = document.createElement('canvas'); cv.width = 16; cv.height = 22; cv.className = 'sg-pv-cv'; stage.appendChild(cv);
        p.appendChild(stage);
        const nm = document.createElement('div'); nm.className = 'sg-pv-name'; nm.textContent = it.name || tr('sg_unnamed', 'Skin'); p.appendChild(nm);
        const au = document.createElement('div'); au.className = 'sg-pv-author'; au.textContent = it.author ? tr('sg_by', 'by {name}').replace('{name}', it.author) : ''; p.appendChild(au);
        const idl = document.createElement('div'); idl.className = 'sg-pv-id'; idl.textContent = 'ID ' + it.id; p.appendChild(idl);
        const acts = document.createElement('div'); acts.className = 'sg-pv-acts';
        const mk = function (cls, text, title, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ex-btn ' + cls; b.textContent = text; if (title) b.title = title; b.onclick = function () { fn(b); }; acts.appendChild(b); return b; };
        if (st.pick) mk('sg-use ex-primary', tr('sg_use', 'Use this skin'), '', function () { useSkin(it); });
        mk('sg-place' + (st.pick ? '' : ' ex-primary'), tr('sg_place', '🌍 Place in world'), tr('sg_place_tip', 'Select the Spawn Mob tool with this skin'), function () { placeInWorld(it); });
        const pf = mk('sg-pv-fav' + (isFav(it.id) ? ' on' : ''), '', '', function () { toggleFavAndRefresh(it); });
        const pfi = document.createElement('span'); pfi.className = 'sg-favimg sg-pv-favimg' + (isFav(it.id) ? ' on' : ''); pfi.setAttribute('aria-hidden', 'true'); pfi.textContent = isFav(it.id) ? '★' : '☆';
        pf.appendChild(pfi); pf.appendChild(document.createTextNode(' ' + tr('sg_fav_tip', 'Favorite')));
        mk('sg-copy', '# ' + tr('sg_copy_tip', 'Copy ID'), '', function (b) { copyId(it, b); });
        p.appendChild(acts);
        const tip = document.createElement('div'); tip.className = 'sg-pv-tip';
        tip.textContent = st.pick ? tr('sg_pv_tip_use', 'Tip: double-click a skin to use it.') : tr('sg_pv_tip_place', 'Tip: double-click a skin to place it.');
        p.appendChild(tip);
        paintThumb(cv, it.id);
    }

    function renderResults() {
        const box = $('sg-results'), status = $('sg-status');
        if (!box) return;
        const prevScroll = box.scrollTop;
        box.innerHTML = '';
        if (homeMode() && st.home) {
            renderHome(box);
            box.scrollTop = prevScroll;
            status.textContent = ''; status.className = 'sg-status';
            prioritizeVisible();
            return;
        }
        let msg = '', isErr = false;
        if (st.tab === 'web') {
            const L = st.srch || newList();
            const idc = idCardFor(L.items);
            const items = (idc ? [idc] : []).concat(L.items);
            if (items.length || L.loading) {
                box.appendChild(buildSection({
                    items: items, view: L.view, per: PER_GRID, cols: GRID_COLS, hasMore: L.hasMore, list: L, liveLen: function () { return L.items.length + (idCardFor(L.items) ? 1 : 0); }, loading: L.loading, showPage: true,
                    onPrev: function () { searchGo(-1); }, onNext: function () { searchGo(1); }
                }));
            }
            if (L.err) {
                isErr = true; msg = errText(L.err);
                const note = document.createElement('div'); note.className = 'sg-sec-note err';
                const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'ex-btn sg-retry'; rb.textContent = tr('sg_retry', 'Retry');
                rb.onclick = function () { L.err = ''; L.hasMore = true; st.token++; if (L.items.length) searchLoad(1); else { st.srch = newList(); searchLoad(0); } };
                note.appendChild(rb);
                if (L.err === NET_DETAIL || customApi()) note.appendChild(proxyBox());
                box.appendChild(note);
            } else if (L.loading) msg = tr('sg_loading', 'Loading...');
            else if (!items.length) msg = tr('sg_none_search', 'No skins found.');
        } else {
            let list = localList();
            const idc = idCardFor(list);
            if (idc) list = [idc].concat(list);
            const pages = Math.max(1, Math.ceil(list.length / PER_GRID));
            const view = Math.min(st.lview[st.tab] || 0, pages - 1);
            st.lview[st.tab] = view;
            if (list.length) {
                box.appendChild(buildSection({
                    items: list, view: view, per: PER_GRID, cols: GRID_COLS, hasMore: false, loading: false,
                    onPrev: function () { localGo(-1); }, onNext: function () { localGo(1); }
                }));
            } else msg = st.tab === 'world' ? tr('sg_empty_world', 'No mob in this world uses a skin yet.') : tr('sg_empty_favs', 'No favorites yet: press ☆ on a skin.');
        }
        box.scrollTop = prevScroll;
        status.textContent = msg;
        status.className = 'sg-status' + (isErr ? ' err' : '');
        prioritizeVisible();
        if (st.tab === 'world') lookupMeta(localList().filter((x) => !x.author || !x.name).map((x) => x.id));
    }
    // Las imágenes de las skins que se ven AHORA van primero en la fila de descargas
    function prioritizeVisible() {
        if (typeof window.mbwSkinPrefetch !== 'function') return;
        const box = $('sg-results'); if (!box) return;
        const ids = Array.prototype.map.call(box.querySelectorAll('.sg-card'), function (c) { return c.dataset.id; });
        if (st.sel) ids.unshift(st.sel.id);
        window.mbwSkinPrefetch(ids, true);
    }
    // "In this world": las skins del mundo de las que no se sabe el nombre/autor se buscan por su ID en la web (de a 2 a la vez)
    const lookup = { q: [], state: {}, active: 0 };
    function lookupMeta(ids) {
        ids.forEach(function (id) {
            if (!ID_RE.test(String(id)) || lookup.state[id]) return;
            const m = st.meta[id];
            if (m && m.name && m.author) return;
            lookup.state[id] = 'queued'; lookup.q.push(String(id));
        });
        pumpLookup();
    }
    function pumpLookup() {
        while (lookup.active < 2 && lookup.q.length) {
            const id = lookup.q.shift();
            lookup.active++;
            fetchRemote('search', id, 1).then(function (list) {
                const hit = list.find(function (x) { return x.id === id; });
                if (hit) { rememberMeta(hit); lookup.state[id] = 'done'; } else lookup.state[id] = 'none';
            }, function () { delete lookup.state[id]; })                   // sin conexión: se vuelve a intentar la próxima vez
                .then(function () {
                    lookup.active--;
                    if (st.open && st.tab === 'world' && lookup.state[id] === 'done') { clearTimeout(pumpLookup.t); pumpLookup.t = setTimeout(renderResults, 120); }
                    pumpLookup();
                });
        }
    }

    function openGallery(opts) {
        const m = ensureModal();
        st.pick = (opts && typeof opts.pick === 'function') ? opts.pick : null;
        st.open = true;
        st.favs = loadList('mbw_skin_favs'); st.recent = loadList('mbw_skin_recent');
        st.tab = (opts && opts.tab) || st.tab || 'web';
        if (TABS.indexOf(st.tab) < 0) st.tab = 'web';
        if (opts && typeof opts.query === 'string') st.query = opts.query;
        m.style.display = 'block';
        texts();
        $('sg-q').value = st.query;
        renderPreview();
        reload();
        setTimeout(function () { try { $('sg-q').focus(); } catch (e) { /* sin foco */ } }, 30);
    }
    function closeGallery() {
        const m = $(MODAL_ID);
        if (m) m.style.display = 'none';
        st.open = false; st.pick = null; st.token++;
    }

    window.openSkinGallery = openGallery;
    window.closeSkinGallery = closeGallery;
    // Las 3 skins más nuevas de la web para la tira (una vez por sesión)
    function refreshNewest() {
        fetchRemote('new', '', 1).then(function (list) {
            if (!list.length) return;
            list.forEach(rememberMeta);
            st.newest = list.slice(0, STRIP_MAX).map(cleanItem);
            lsSet('mbw_skin_newest', JSON.stringify(st.newest));
            renderRecentStrip();
            if (typeof window.mbwSkinPrefetch === 'function') window.mbwSkinPrefetch(st.newest.map((x) => x.id), false);
        }).catch(function () { /* sin conexión: se queda la lista guardada */ });
    }
    setTimeout(refreshNewest, 4000);
    window.mbwSkinGallery = { state: st, place: placeInWorld, worldSkins: worldSkins, reload: reload, renderStrip: renderRecentStrip, select: select, bridgeBase: bridgeBase, refreshNewest: refreshNewest };
    window.skinGalleryOnLanguageChanged = function () { renderRecentStrip(); if (st.open) { texts(); renderResults(); renderPreview(); } };
    renderRecentStrip();
    window.addEventListener('load', renderRecentStrip);   // por si las miniaturas aún no podían bajarse cuando cargó la página
})();
