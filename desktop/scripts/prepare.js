// Prepara lo que va DENTRO del instalador: una copia de la página (para usarla sin internet)
// y las librerías que la página baja de internet (Firebase, PeerJS, JSZip).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');          // la carpeta del proyecto (donde está index.html)
const OUT = path.join(__dirname, '..', 'build');
const SITE_OUT = path.join(OUT, 'site');
const VENDOR_OUT = path.join(OUT, 'vendor');

const SITE_ITEMS = ['index.html', 'style.css', 'main.js', 'chat-dm.css', 'favicon.ico', 'scripts', 'assets', 'dev-maps'];

function copy(src, dst) {
    const st = fs.statSync(src);
    if (st.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true });
        for (const n of fs.readdirSync(src)) copy(path.join(src, n), path.join(dst, n));
    } else fs.copyFileSync(src, dst);
}

async function main() {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(SITE_OUT, { recursive: true });
    for (const it of SITE_ITEMS) {
        const src = path.join(ROOT, it);
        if (fs.existsSync(src)) copy(src, path.join(SITE_OUT, it));
        else console.warn('  (no existe, se omite) ' + it);
    }
    // librerías de internet que usa index.html
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const urls = [...html.matchAll(/<script[^>]+src="(https:\/\/(?:www\.gstatic\.com|unpkg\.com|cdnjs\.cloudflare\.com)\/[^"]+)"/g)].map(m => m[1]);
    for (const url of urls) {
        const u = new URL(url);
        const dst = path.join(VENDOR_OUT, u.hostname, u.pathname.replace(/^\/+/, ''));
        const r = await fetch(url);
        if (!r.ok) throw new Error('No se pudo bajar ' + url + ' (' + r.status + ')');
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
        console.log('  librería: ' + url);
    }
    console.log('Listo: copia de la página en build/site, librerías en build/vendor');
}
main().catch(e => { console.error(e); process.exit(1); });
