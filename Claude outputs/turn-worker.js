// =====================================================================
// Puente (TURN) para el multijugador de MB World Editor  ·  Cloudflare Worker
// =====================================================================
// Para qué sirve: cuando la red de un jugador es "estricta" (NAT simétrica: datos móviles, redes compartidas…), dos editores
// no se pueden conectar directo. Entonces la conexión pasa por el servidor TURN de Cloudflare (Cloudflare Realtime).
// Este Worker hace UNA cosa: le pide a Cloudflare un usuario y contraseña de TURN que duran 24 horas y se los da al editor.
// Así la llave secreta nunca está en el código del editor.
//
//   GET /ice  →  { "iceServers": [ { urls: [...] }, { urls: [...], username, credential } ] }
//
// Necesita dos "secretos" en el Worker (Settings > Variables and Secrets):
//   TURN_KEY_ID         = el "Turn Token ID" de la llave TURN
//   TURN_KEY_API_TOKEN  = el "API Token" de esa misma llave
// =====================================================================
const ALLOWED = [/^https:\/\/crys1534\.github\.io$/i, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i, /^(null|file:\/\/|app:\/\/.*)$/i];

function cors(origin) {
  const ok = !origin || ALLOWED.some(r => r.test(origin));
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? (origin || '*') : 'https://crys1534.github.io',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const c = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
    const path = new URL(request.url).pathname;
    if (request.method !== 'GET' || path !== '/ice') return new Response('Not found', { status: 404, headers: c.headers });
    if (!c.ok) return new Response('Forbidden', { status: 403, headers: c.headers });
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return new Response('TURN key not set up', { status: 500, headers: c.headers });

    let res;
    try {
      res = await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/' + env.TURN_KEY_ID + '/credentials/generate-ice-servers', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 }),
      });
    } catch (e) { return new Response('Upstream error', { status: 502, headers: c.headers }); }
    if (!res.ok) return new Response('Upstream error ' + res.status, { status: 502, headers: c.headers });
    const data = await res.json();
    // (el puerto 53 lo bloquean los navegadores: se quita para que no haga esperar)
    const list = [].concat(data.iceServers || []).map(s => ({ ...s, urls: [].concat(s.urls || []).filter(u => !/:53(\?|$)/.test(u)) })).filter(s => s.urls.length);
    return new Response(JSON.stringify({ iceServers: list, ttl: 86400 }), {
      status: 200,
      headers: { ...c.headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};
