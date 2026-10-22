// ============================================================================
// 📰 SISTEMA DE NOTICIAS (News / Updates)
// ----------------------------------------------------------------------------
// ESTE ARCHIVO ES EL "MOTOR": lee el texto de scripts/news-data.js y dibuja las notas.
// ➜ Para agregar o cambiar notas NO hace falta tocar este archivo: edita scripts/news-data.js
// ============================================================================

// ---------- 1) Convertir el texto simple de news-data.js en notas ----------

function newsEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Para poner un texto dentro de un atributo ("...") de HTML
function newsAttr(s) {
    return newsEsc(s).replace(/"/g, '&quot;');
}

// Una línea de texto -> HTML.  isItem = true si es un punto de la lista (ahí también valen las etiquetas [fixed], [beta]...)
function newsInline(raw, isItem) {
    let s = newsEsc(String(raw).trim());
    let prefix = '';
    if (isItem) {
        // Etiquetas al principio: [fixed] [beta] [change] ... -> cajita gris
        let m;
        while ((m = s.match(/^\[([A-Za-z][A-Za-z0-9 _-]{0,19})\]\s*/))) {
            prefix += '<code class="code-tag">[' + m[1] + ']</code> ';
            s = s.slice(m[0].length);
        }
    }
    s = s.replace(/`([^`]+)`/g, '<code class="code-tag">$1</code>')   // `C`  -> tecla / código
         .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')                       // **negrita**
         .replace(/__(.+?)__/g, '<u>$1</u>');                          // __subrayado__
    return prefix + s;
}

// El texto de abajo de la línea "---" -> HTML (títulos, listas con sub-listas y párrafos)
function newsBodyToHtml(lines) {
    let html = '';
    const stack = [];        // sangría (espacios) de cada lista abierta
    let blocks = 0;          // cuántos bloques (título / lista / párrafo) llevamos
    const closeTo = (n) => { while (stack.length > n) { html += '</li></ul>'; stack.pop(); } };

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed === '' || trimmed.startsWith('//')) continue;      // vacías y comentarios: se ignoran

        const bullet = rawLine.match(/^(\s*)[-•*]\s+(.*)$/);
        if (bullet && !/^\*\*/.test(trimmed)) {
            const ind = bullet[1].length;
            while (stack.length && ind < stack[stack.length - 1]) { html += '</li></ul>'; stack.pop(); }
            if (stack.length && ind === stack[stack.length - 1]) {
                html += '</li><li>';
            } else if (stack.length) {
                html += '<ul class="pixel-list" style="margin-top: 5px; margin-bottom: 5px;"><li>';
                stack.push(ind);
            } else {
                html += '<ul class="pixel-list"><li>';
                stack.push(ind);
                blocks++;
            }
            html += newsInline(bullet[2], true);
            continue;
        }

        closeTo(0);
        const head = trimmed.match(/^#+\s*(.*)$/);
        if (head) {
            html += '<h3 style="margin-top: ' + (blocks === 0 ? '0' : '16px') + '; color: #333;">' + newsInline(head[1], false) + '</h3>';
        } else {
            html += '<p style="margin: 6px 0; font-size: 14px; color: #000;">' + newsInline(trimmed, false) + '</p>';
        }
        blocks++;
    }
    closeTo(0);
    return html;
}

// Nombres que se aceptan en la parte de arriba de cada nota (en inglés o en español)
const NEWS_KEYS = {
    title: 'title', titulo: 'title', 'título': 'title',
    date: 'date', fecha: 'date',
    image: 'image', imagen: 'image',
    hero: 'hero', heroimage: 'hero', 'hero-image': 'hero', 'imagen-grande': 'hero',
    excerpt: 'excerpt', summary: 'excerpt', resumen: 'excerpt',
    gallery: 'gallery', galeria: 'gallery', 'galería': 'gallery',
    hidden: 'hidden', oculta: 'hidden', oculto: 'hidden', borrador: 'hidden', draft: 'hidden'
};

// Texto completo de news-data.js -> { notes: [...], problems: [...] }
// Las notas salen en el mismo orden del archivo (la más nueva primero) y los números (id) se ponen solos:
// la más vieja (la de más abajo) es la 1, la siguiente la 2, etc.
function parseNewsText(text) {
    const problems = [];
    const lines = String(text || '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n');

    // 1) Partir en bloques: cada línea que empieza con ===== abre una nota nueva
    const blocks = [];
    let cur = null;
    lines.forEach((line) => {
        if (/^\s*={3,}/.test(line)) { cur = []; blocks.push(cur); }
        else if (cur) cur.push(line);       // lo que esté antes de la primera ===== se ignora
    });

    // 2) Leer cada bloque
    const parsed = [];
    blocks.forEach((blk, bi) => {
        const label = 'Nota #' + (bi + 1) + ' del archivo';
        const note = { gallery: [] };
        let hidden = false;
        let i = 0;
        // Parte de arriba: "clave: valor" hasta la línea "---"
        for (; i < blk.length; i++) {
            const t = blk[i].trim();
            if (/^-{3,}$/.test(t)) { i++; break; }                       // fin de la parte de arriba
            if (t === '' || t.startsWith('//')) continue;
            if (/^(#|[-•]\s)/.test(t)) break;                            // se les olvidó el "---": el texto ya empezó
            const m = t.match(/^([^:]+):\s*(.*)$/);
            if (!m) { problems.push(label + ': no entiendo esta línea de arriba: "' + t.slice(0, 50) + '"'); continue; }
            const key = NEWS_KEYS[m[1].trim().toLowerCase()];
            if (!key) { problems.push(label + ': no conozco el dato "' + m[1].trim() + '"'); continue; }
            const val = m[2].trim();
            if (key === 'gallery') { if (val) note.gallery.push(val); }
            else if (key === 'hidden') { hidden = /^(yes|si|sí|true|1|x)$/i.test(val); }
            else note[key] = val;
        }
        if (hidden) return;
        if (!note.title) { problems.push(label + ': falta "title:" (no se muestra esta nota)'); return; }
        if (!note.date) problems.push(label + ' (' + note.title + '): falta "date:"');
        if (!note.excerpt) problems.push(label + ' (' + note.title + '): falta "excerpt:"');
        if (!note.image) { problems.push(label + ' (' + note.title + '): falta "image:" (se usa el ícono por defecto)'); note.image = 'favicon.ico'; }
        note.content = newsBodyToHtml(blk.slice(i));
        parsed.push(note);
    });

    // 3) Números (id): la de más abajo = 1 ... la de más arriba = total
    const total = parsed.length;
    const notes = parsed.map((n, idx) => ({
        id: total - idx,
        type: 'updates',
        title: n.title,
        date: n.date || '',
        image: n.image,
        heroImage: n.hero || n.image,
        excerpt: n.excerpt || '',
        content: n.content,
        gallery: n.gallery
    }));
    return { notes, problems };
}

// Construye (o reconstruye) la lista de notas. Si se le da un texto, usa ese; si no, usa el de news-data.js
function rebuildNewsDatabase(text) {
    let src = text;
    if (src === undefined) {
        if (typeof NEWS_TEXT === 'undefined') {
            window.newsProblems = ['No se pudo leer scripts/news-data.js (¿se escribió "*/" dentro de las notas, o falta el archivo?)'];
            console.error('[News] ' + window.newsProblems[0]);
            window.newsDatabase = [];
            return window.newsDatabase;
        }
        src = NEWS_TEXT;
    }
    const res = parseNewsText(src);
    window.newsProblems = res.problems;
    window.newsDatabase = res.notes;
    if (res.problems.length) res.problems.forEach((p) => console.warn('[News] ' + p));
    if (!res.notes.length) console.warn('[News] No hay ninguna nota. Revisa scripts/news-data.js (cada nota empieza con una línea "===== NOTA").');
    if (typeof checkUnreadNews === 'function') checkUnreadNews();
    return window.newsDatabase;
}

// ---------- 2) Dibujar las notas ----------

function openNewsModal() {
    openModal('news-modal'); // Asume que tienes una función openModal general
    showNewsList();

    // Al abrir el panel, marcamos las noticias como "leídas"
    const latestNewsId = newsDatabase.length ? Math.max(...newsDatabase.map(n => n.id)) : 0;
    try { localStorage.setItem('mbw_last_seen_news', latestNewsId); } catch (e) {}
    checkUnreadNews(); // Quita el brillo del botón
}

function showNewsList() {
    document.getElementById('news-list-view').style.display = 'block';
    document.getElementById('news-detail-view').style.display = 'none';

    // Mostramos las pestañas de navegación cuando estamos en la lista
    const tabsContainer = document.getElementById('news-tab-updates')?.parentElement;
    if (tabsContainer) tabsContainer.style.display = 'flex';

    const listContainer = document.getElementById('news-list-view');
    listContainer.innerHTML = '';

    // Ordenamos para que la más nueva (ID más alto) salga arriba
    const sortedNews = newsDatabase.slice().sort((a, b) => b.id - a.id);

    // Si no hay notas, mostramos un mensaje
    if (sortedNews.length === 0) {
        listContainer.innerHTML = `<p style="text-align:center; color:#555; margin-top: 20px; font-weight:bold;">There is no news here yet.</p>`;
        return;
    }

    sortedNews.forEach(news => {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.onclick = () => showNewsDetail(news.id);

        card.innerHTML = `
    <img src="${newsAttr(news.image)}" alt="News" onerror="this.src='favicon.ico'" style="image-rendering: auto;">
    <div>
        <h4 style="margin: 0 0 5px 0; color: #333; font-size: 18px;">${newsEsc(news.title)}</h4>
        <span style="font-size: 11px; color: #444; font-weight: bold; display: block; margin-bottom: 5px;">${newsEsc(news.date)}</span>

        <p style="margin: 0; font-size: 12px; color: #000;">${newsEsc(news.excerpt)}</p>
    </div>
`;
        listContainer.appendChild(card);
    });
}

function showNewsDetail(id) {
    const news = newsDatabase.find(n => n.id === id);
    if (!news) return;

    document.getElementById('news-list-view').style.display = 'none';
    document.getElementById('news-detail-view').style.display = 'block';

    // Ocultamos las pestañas cuando estamos leyendo el artículo
    const tabsContainer = document.getElementById('news-tab-updates')?.parentElement;
    if (tabsContainer) tabsContainer.style.display = 'none';

    // Usa la imagen héroe si existe, sino usa la miniatura estándar
    document.getElementById('news-detail-image').src = news.heroImage ? news.heroImage : news.image;

    document.getElementById('news-detail-title').innerText = news.title;
    document.getElementById('news-detail-date').innerText = news.date;

    // Inyectamos el texto HTML
    let contentHTML = news.content;

    // Si la noticia tiene galería, inyectamos las imágenes usando las clases CSS correctas
    if (news.gallery && news.gallery.length > 0) {
        contentHTML += `<div class="news-gallery">`;
        news.gallery.forEach(imgSrc => {
            // Comillas simples/dobles dentro de la dirección romperían el onclick: se escriben como %27 / %22 (es lo mismo para el navegador)
            const safe = String(imgSrc).replace(/'/g, '%27').replace(/"/g, '%22');
            contentHTML += `<img src="${safe}" class="news-gallery-img" onclick="openLightbox('${safe}')" title="Click to enlarge">`;
        });
        contentHTML += `</div>`;
    }

    document.getElementById('news-detail-content').innerHTML = contentHTML;
}

// ==========================================
// 🔍 LIGHTBOX (Visor de imágenes grande)
// ==========================================
function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-modal').style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('lightbox-modal').style.display = 'none';
}

// ==========================================
// 🔔 SISTEMA DE ALERTA DE NOTICIAS NO LEÍDAS
// ==========================================
function checkUnreadNews() {
    if (!newsDatabase || newsDatabase.length === 0) return;

    const latestNewsId = Math.max(...newsDatabase.map(n => n.id));
    let lastSeenNewsId = 0;
    try { lastSeenNewsId = parseInt(localStorage.getItem('mbw_last_seen_news')) || 0; } catch (e) {}

    const newsBtn = document.getElementById('news-btn');
    if (newsBtn) {
        // Se compara con "distinto" y no con "mayor": antes las noticias de Snapshots (ids 100 y 101) eran las de número más alto, así que
        // quien ya había abierto News tiene guardado un número MAYOR que el de la última noticia de verdad. Con "mayor" nunca se encendería el brillo.
        if (latestNewsId !== lastSeenNewsId) {
            newsBtn.classList.add('news-unread'); // Enciende el brillo
        } else {
            newsBtn.classList.remove('news-unread'); // Apaga el brillo
        }
    }
}

// ---------- 3) Arranque ----------
rebuildNewsDatabase();

// Comprueba si hay noticias nuevas cuando arranca el programa
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', checkUnreadNews);
else checkUnreadNews();
