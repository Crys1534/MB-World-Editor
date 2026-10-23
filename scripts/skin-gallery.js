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
//     · En este mundo (skins que ya usan los mobs del mundo) · Favoritas · Recientes. Las tres últimas funcionan sin internet.
//
// De dónde salen las skins (SIN VERIFICAR contra el servidor real: desde donde se programó no se puede entrar a mineblocks.com;
// el formato sale de la documentación pública de la librería MBSkinAPI):
//   POST https://mineblocks.com/1/scripts/returnSkins.php   con FormData { type: 'new' | 'search', page: 1, key: texto }
//   Destacadas y Mejores: la documentación no las trae. Se prueba type 'featured' y la búsqueda 'best:true' (así busca la web);
//   si el servidor no las entiende (devuelve lo mismo que "nuevas" o nada) esa sección se oculta sola.
//   → lista JSON [{ id, name, author }, ...]  ("0" o vacío = no hay más). A veces trae avisos de PHP antes del JSON: se limpian.
//   Las imágenes siguen siendo https://mineblocks.com/1/skins/images/{id}.png (las pide getSpawnskinImage de main.js).
//   Si el servidor no deja leer la respuesta (CORS) o no hay internet, la pestaña 🌐 dice que no se pudo conectar; las demás siguen.
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
        page: 1, loading: false, hasMore: true, items: [], error: '', token: 0,
        pick: null,                                  // función que recibe el ID cuando la galería se abrió para ELEGIR (Mob Browser)
        favs: loadList('mbw_skin_favs'), recent: loadList('mbw_skin_recent'),
        meta: {}                                     // id -> { name, author } lo último que se vio en la web
    };
    function rememberMeta(s) { st.meta[s.id] = { name: s.name, author: s.author }; }
    st.favs.concat(st.recent).forEach(rememberMeta);
    const isFav = (id) => st.favs.some((f) => f.id === id);

    // ------------------------------------------------------------------ servidor
    function apiUrl() { return window.SKIN_LIST_URL || 'https://mineblocks.com/1/scripts/returnSkins.php'; }
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
        catch (e) { throw fail('net', 'no connection or blocked by the browser'); }
        if (!res || !res.ok) throw fail('http', 'HTTP ' + (res ? res.status : '?'));
        const txt = await res.text();
        try { return parseSkinList(txt); }
        catch (e) { throw fail('parse', 'unreadable answer: ' + String(txt).replace(/\s+/g, ' ').slice(0, 50)); }
    }

    // ------------------------------------------------------------------ pantalla de inicio: Destacadas / Nuevas / Mejores (como la web)
    const SECTIONS = [['featured', 'sg_sec_featured', 'Featured skins'], ['new', 'sg_sec_new', 'New skins'], ['best', 'sg_sec_best', 'Best skins']];
    const HOME_PAGES = 2;                                              // páginas que se bajan al abrir (la web muestra 4 por página)
    function homeInit() {
        st.home = {};
        SECTIONS.forEach((s) => { st.home[s[0]] = { items: [], page: 1, loading: false, hasMore: true, err: '', loaded: false, off: false }; });
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
    async function homeLoad(k, pages) {
        const h = st.home && st.home[k];
        if (!h || h.loading || h.off) return;
        const token = st.token;
        h.loading = true; h.err = '';
        renderResults();
        try {
            for (let n = 0; n < (pages || 1) && h.hasMore; n++) {
                let list = await fetchSection(k, h.page);
                if (token !== st.token) return;
                if (k !== 'new' && h.page === 1 && sameAsNew(list)) { h.off = true; list = []; }
                list.forEach(rememberMeta);
                const known = {}; h.items.forEach((s) => { known[s.id] = 1; });
                h.items = h.items.concat(list.filter((s) => !known[s.id]));
                h.loaded = true;
                if (!list.length) h.hasMore = false; else h.page++;
            }
        } catch (e) {
            if (token !== st.token) return;
            h.err = (e && e.detail) || 'net'; h.hasMore = false;
        }
        if (token === st.token) { h.loading = false; renderResults(); }
    }
    async function homeStart() {
        const c = st.homeCache;
        if (c && Date.now() - c.t < 300000 && c.h.new.items.length && SECTIONS.every((d) => !c.h[d[0]].loading)) { st.home = c.h; renderResults(); return; }
        homeInit();
        st.homeCache = { t: Date.now(), h: st.home };
        const mine = st.token;
        await homeLoad('new', HOME_PAGES);
        if (mine !== st.token || !st.open || homeMode() === false) return;
        homeLoad('featured', HOME_PAGES);
        homeLoad('best', HOME_PAGES);
    }
    function homeMode() { return st.tab === 'web' && !st.query; }
    function renderHome(box) {
        let shown = 0;
        SECTIONS.forEach((def) => {
            const h = st.home[def[0]];
            if (h.off) return;
            if (def[0] !== 'new' && h.loaded && !h.items.length && !h.err) return;       // el servidor no tiene esa sección
            if (def[0] !== 'new' && h.err && !h.items.length) return;                   // no hubo manera de pedirla: no estorba
            shown++;
            const hd = document.createElement('div'); hd.className = 'sg-sec-h'; hd.textContent = tr(def[1], def[2]); box.appendChild(hd);
            h.items.forEach((it) => box.appendChild(makeCard(it)));
            const note = document.createElement('div'); note.className = 'sg-sec-note';
            if (h.loading) note.textContent = tr('sg_loading', 'Loading...');
            else if (h.err && def[0] === 'new') {
                note.className += ' err';
                note.textContent = tr('sg_error', 'Could not connect to mineblocks.com (no internet, or the server does not allow it). The other tabs still work.') + ' [' + h.err + ']';
                const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'ex-btn'; rb.textContent = tr('sg_retry', 'Retry');
                rb.onclick = function () { st.token++; homeStart(); };
                note.appendChild(document.createElement('br')); note.appendChild(rb);
            } else if (h.hasMore && h.items.length) {
                const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'ex-btn'; mb.textContent = tr('sg_more', 'Load more');
                mb.onclick = function () { homeLoad(def[0], 1); };
                note.appendChild(mb);
            } else if (!h.items.length) note.textContent = tr('sg_none', 'Nothing to show.');
            if (note.firstChild || note.textContent) box.appendChild(note);
        });
        void shown;
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

    // Tira de skins recientes del ribbon (pestaña View → Skins): las últimas 4, un clic deja lista esa skin para el mapa
    const STRIP_MAX = 4;
    function renderRecentStrip() {
        const box = $('recent-skins-ribbon');
        if (!box) return;
        box.textContent = '';
        const list = st.recent.slice(0, STRIP_MAX);
        if (!list.length) {
            const e = document.createElement('span'); e.className = 'empty-text'; e.textContent = tr('lbl_empty', 'Empty');
            box.appendChild(e);
            return;
        }
        list.forEach((item) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'sg-rs-item'; b.dataset.id = item.id;
            b.title = tr('sg_rs_tip', 'Place the skin: {name}').replace('{name}', labelOf(item));
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
            '<div class="sg-body">' +
            '<div class="sg-tabs" id="sg-tabs"></div>' +
            '<div class="sg-search"><input type="text" id="sg-q" autocomplete="off" spellcheck="false" maxlength="60">' +
            '<select id="sg-filter"></select></div>' +
            '<div class="sg-status" id="sg-status"></div>' +
            '<div class="sg-results" id="sg-results"></div>' +
            '<div class="sg-more"><button type="button" class="ex-btn" id="sg-more"></button></div>' +
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
        $('sg-filter').addEventListener('change', function () { st.filter = this.value; if (st.tab === 'web') renderResults(); else renderResults(); });
        $('sg-more').onclick = function () { loadMore(); };
        $('sg-results').addEventListener('scroll', function () {
            const r = this;
            if (st.tab === 'web' && st.query && r.scrollHeight > r.clientHeight + 20 && r.scrollTop + r.clientHeight >= r.scrollHeight - 80) loadMore();
        });
        window.addEventListener('keydown', function (e) {
            if (!st.open || e.key !== 'Escape') return;
            e.stopImmediatePropagation(); e.preventDefault();
            closeGallery();
        }, true);
        return m;
    }

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
        [['web', tr('sg_tab_web', '🌐 Mine Blocks')], ['world', tr('sg_tab_world', '🌍 In this world')], ['favs', tr('sg_tab_favs', '⭐ Favorites')], ['recent', tr('sg_tab_recent', '🕘 Recent')]].forEach(function (o) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'sg-tab' + (st.tab === o[0] ? ' on' : ''); b.dataset.tab = o[0]; b.textContent = o[1];
            b.onclick = function () { setTab(o[0]); };
            tabs.appendChild(b);
        });
        $('sg-more').textContent = tr('sg_more', 'Load more');
    }

    function setTab(t) { st.tab = t; texts(); reload(); }

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
        const base = st.tab === 'world' ? worldSkins() : (st.tab === 'favs' ? st.favs : st.recent);
        return base.map((s) => { const m = st.meta[s.id]; return (m && (!s.name || !s.author)) ? { id: s.id, name: s.name || m.name, author: s.author || m.author } : s; }).filter(matches);
    }

    function reload() {
        st.token++;
        st.loading = false;                                         // si había una descarga en curso, ya no vale: esta búsqueda la reemplaza
        const box = $('sg-results'); if (box) box.scrollTop = 0;
        st.page = 1; st.hasMore = true; st.items = []; st.error = '';
        if (homeMode()) homeStart();
        else if (st.tab === 'web') loadMore(true);
        else renderResults();
    }
    async function loadMore(first) {
        if (st.tab !== 'web' || st.loading || (!st.hasMore && !first)) return;
        const token = st.token;
        st.loading = true; st.error = '';
        renderResults();
        try {
            const list = await fetchRemote(st.query ? 'search' : 'new', st.query, st.page);
            if (token !== st.token) return;                           // llegó tarde: ya hay otra búsqueda
            list.forEach(rememberMeta);
            let add = list;
            if (st.query && st.filter !== 'all') add = list.filter(matches);          // el servidor busca en todo: el filtro se aplica aquí
            const known = {}; st.items.forEach((s) => { known[s.id] = 1; });
            add = add.filter((s) => !known[s.id]);
            st.items = st.items.concat(add);
            if (!list.length) st.hasMore = false; else st.page++;
        } catch (e) {
            if (token !== st.token) return;
            st.error = (e && e.detail) || 'net';
            st.hasMore = false;
        }
        if (token === st.token) { st.loading = false; renderResults(); }
    }

    function makeCard(item) {
        const d = document.createElement('div');
        d.className = 'sg-card'; d.dataset.id = item.id;
        // La skin se ve grande, de pie sobre un fondo como el del editor; un clic en ella hace la acción principal
        const stage = document.createElement('div'); stage.className = 'sg-stage';
        const cv = document.createElement('canvas');
        cv.width = 16; cv.height = 22; cv.className = 'sg-thumb';
        stage.appendChild(cv);
        stage.onclick = function () { if (st.pick) useSkin(item); else placeInWorld(item); };
        d.appendChild(stage);
        const info = document.createElement('div');
        info.className = 'sg-info';
        const nm = document.createElement('div'); nm.className = 'sg-name'; nm.textContent = item.name || tr('sg_unnamed', 'Skin');
        nm.title = item.name || '';
        const au = document.createElement('div'); au.className = 'sg-author'; au.textContent = item.author ? tr('sg_by', 'by {name}').replace('{name}', item.author) : '';
        const idl = document.createElement('div'); idl.className = 'sg-id'; idl.textContent = 'ID ' + item.id;
        info.appendChild(nm); info.appendChild(au); info.appendChild(idl);
        d.appendChild(info);
        const acts = document.createElement('div');
        acts.className = 'sg-acts';
        const mk = (cls, text, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ex-btn ' + cls; b.textContent = text; if (title) b.title = title; b.onclick = function (e) { e.stopPropagation(); fn(b); }; acts.appendChild(b); return b; };
        if (st.pick) mk('sg-use ex-primary', tr('sg_use', 'Use this skin'), '', function () { useSkin(item); });
        mk('sg-place' + (st.pick ? '' : ' ex-primary'), tr('sg_place', '🌍 Place in world'), tr('sg_place_tip', 'Select the Spawn Mob tool with this skin'), function () { placeInWorld(item); });
        const fav = mk('sg-fav', isFav(item.id) ? '★' : '☆', tr('sg_fav_tip', 'Favorite'), function (b) { toggleFav(item); b.textContent = isFav(item.id) ? '★' : '☆'; b.classList.toggle('on', isFav(item.id)); if (st.tab === 'favs') renderResults(); });
        fav.classList.toggle('on', isFav(item.id));
        mk('sg-copy', '#', tr('sg_copy_tip', 'Copy ID'), function (b) { copyId(item, b); });
        d.appendChild(acts);
        paintThumb(cv, item.id);
        return d;
    }

    function renderResults() {
        const box = $('sg-results'), status = $('sg-status'), more = $('sg-more');
        if (!box) return;
        const prevScroll = box.scrollTop;
        box.innerHTML = '';
        if (homeMode() && st.home) {
            renderHome(box);
            box.scrollTop = prevScroll;
            status.textContent = ''; status.className = 'sg-status';
            more.style.display = 'none';
            return;
        }
        let list = st.tab === 'web' ? st.items : localList();
        // escribir solo un número ofrece usar directamente ese ID (cualquier pestaña)
        if (ID_RE.test(st.query) && !list.some((s) => s.id === st.query)) {
            const m = st.meta[st.query] || {};
            list = [{ id: st.query, name: m.name || '', author: m.author || '' }].concat(list);
        }
        list.forEach((it) => box.appendChild(makeCard(it)));
        box.scrollTop = prevScroll;
        let msg = '';
        if (st.tab === 'web') {
            if (st.loading) msg = tr('sg_loading', 'Loading...');
            else if (st.error) msg = tr('sg_error', 'Could not connect to mineblocks.com (no internet, or the server does not allow it). The other tabs still work.') + ' [' + st.error + ']';
            else if (!list.length) msg = st.query ? tr('sg_none_search', 'No skins found.') : tr('sg_none', 'Nothing to show.');
        } else if (!list.length) {
            msg = st.tab === 'world' ? tr('sg_empty_world', 'No mob in this world uses a skin yet.') : (st.tab === 'favs' ? tr('sg_empty_favs', 'No favorites yet: press ☆ on a skin.') : tr('sg_empty_recent', 'Skins you use will appear here.'));
        }
        status.textContent = msg;
        status.className = 'sg-status' + (st.error ? ' err' : '');
        more.style.display = (st.tab === 'web' && st.hasMore && !st.loading && !st.error && st.items.length) ? '' : 'none';
        if (st.tab === 'web' && st.error) { more.style.display = ''; more.textContent = tr('sg_retry', 'Retry'); more.onclick = function () { st.error = ''; st.hasMore = true; st.token++; loadMore(true); }; }
        else { more.textContent = tr('sg_more', 'Load more'); more.onclick = function () { loadMore(); }; }
    }

    function openGallery(opts) {
        const m = ensureModal();
        st.pick = (opts && typeof opts.pick === 'function') ? opts.pick : null;
        st.open = true;
        st.favs = loadList('mbw_skin_favs'); st.recent = loadList('mbw_skin_recent');
        st.tab = (opts && opts.tab) || st.tab || 'web';
        if (opts && typeof opts.query === 'string') st.query = opts.query;
        m.style.display = 'block';
        texts();
        $('sg-q').value = st.query;
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
    window.mbwSkinGallery = { state: st, place: placeInWorld, worldSkins: worldSkins, reload: reload, renderStrip: renderRecentStrip };
    window.skinGalleryOnLanguageChanged = function () { renderRecentStrip(); if (st.open) { texts(); renderResults(); } };
    renderRecentStrip();
    window.addEventListener('load', renderRecentStrip);   // por si las miniaturas aún no podían bajarse cuando cargó la página
})();
