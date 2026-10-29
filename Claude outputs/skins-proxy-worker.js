// =====================================================================
// Puente (proxy) para la galería de skins de MB World Editor  ·  versión 2
// =====================================================================
// Para qué sirve: mineblocks.com no deja que otras páginas lean su lista de skins ni usen sus imágenes "limpias"
// (el navegador lo bloquea). Este pequeño programa corre GRATIS en Cloudflare Workers y hace dos cosas, nada más:
//   1) POST  /              → la lista de skins (tipo, página y texto de búsqueda), igual que la web de Mine Blocks
//   2) GET   /skin/123.png  → la imagen de la skin 123 (versión 2: así el editor puede mostrar TODAS las skins)
// Las dos respuestas salen con el permiso que le falta (CORS). No sirve para nada más.
const UPSTREAM = 'https://mineblocks.com/1/scripts/returnSkins.php';
const IMAGES = 'https://mineblocks.com/1/skins/images/';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // 2) imagen de una skin (solo números en el ID)
    if (request.method === 'GET') {
      const m = new URL(request.url).pathname.match(/^\/skin\/([0-9]{1,12})\.png$/);
      if (!m) return new Response('Use POST', { status: 405, headers: CORS });
      let res;
      try { res = await fetch(IMAGES + m[1] + '.png', { cf: { cacheTtl: 86400, cacheEverything: true } }); }
      catch (e) { return new Response('Upstream error', { status: 502, headers: CORS }); }
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !/^image\//i.test(type)) return new Response('Not found', { status: res.ok ? 404 : res.status, headers: CORS });
      return new Response(res.body, { status: 200, headers: { ...CORS, 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
    }
    if (request.method !== 'POST') return new Response('Use POST', { status: 405, headers: CORS });

    // 1) lista de skins
    let form;
    try { form = await request.formData(); } catch (e) { return new Response('Bad request', { status: 400, headers: CORS }); }
    const type = String(form.get('type') || '');
    const page = String(form.get('page') || '1');
    const key = String(form.get('key') || '').slice(0, 60);
    if (!/^[a-z]{1,12}$/.test(type) || !/^[0-9]{1,5}$/.test(page)) return new Response('Bad request', { status: 400, headers: CORS });

    const out = new FormData();
    out.append('type', type);
    out.append('page', page);
    if (key) out.append('key', key);

    let res;
    try { res = await fetch(UPSTREAM, { method: 'POST', body: out }); }
    catch (e) { return new Response('Upstream error', { status: 502, headers: CORS }); }
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};
