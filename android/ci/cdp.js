// Le pregunta algo a la página que está dentro de la app (solo el APK de prueba lo permite).
// Uso: node cdp.js <puerto> "<expresión JavaScript>"
const port = process.argv[2] || '9222';
const expr = process.argv[3] || 'location.href';
(async () => {
  const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  const page = list.find(p => /MB-World-Editor/.test(p.url)) || list[0];
  if (!page) throw new Error('no page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const out = await new Promise((res) => {
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) res(d.result); };
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  });
  console.log(JSON.stringify(out.result && out.result.value !== undefined ? out.result.value : out));
  ws.close();
})().catch(e => { console.log(JSON.stringify({ error: String(e) })); process.exit(0); });
