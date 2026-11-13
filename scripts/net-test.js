// ==========================================================
// 🩺 PRUEBA DE CONEXIÓN (Multijugador > "Probar mi conexión")
//
//  Revisa, paso por paso, si este aparato puede jugar en línea con otros y por qué no:
//   1. ¿El navegador deja usar conexiones directas (WebRTC)? (una prueba dentro del mismo aparato)
//   2. ¿Llega al servidor que presenta a los jugadores (PeerJS)?
//   3. ¿Puede salir a internet para conectarse directo? (STUN de Google y de Cloudflare)
//   4. ¿Su red cambia el puerto en cada conexión (NAT estricta)? Así las conexiones directas suelen fallar.
//   5. ¿Responde el "puente" (TURN) para cuando no se puede directo?
//  Al final dice en palabras simples si va a poder conectarse, y se puede copiar el resultado o mandar una captura.
// ==========================================================
(function () {
    'use strict';
    function tr(k, fb, vars) { return typeof window.tmsg === 'function' ? window.tmsg(k, fb, vars) : String(fb).replace(/\{(\w+)\}/g, (m, v) => (vars && vars[v] !== undefined ? vars[v] : m)); }
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const STUN_G = [{ urls: 'stun:stun.l.google.com:19302' }], STUN_C = [{ urls: 'stun:stun.cloudflare.com:3478' }];
    function turnServers() { return (typeof window.mbwIceServers === 'function' ? window.mbwIceServers() : []).filter(s => [].concat(s.urls).some(u => /^turns?:/.test(u))); }

    function parseCand(c) {
        const p = String(c || '').split(' ');
        const i = p.indexOf('typ');
        return { proto: (p[2] || '').toLowerCase(), ip: p[4] || '', port: Number(p[5]) || 0, type: i > 0 ? p[i + 1] : '' };
    }
    // junta las "direcciones" que este aparato puede usar con esos servidores
    function gather(iceServers, policy, ms) {
        return new Promise(function (resolve) {
            let pc, cands = [], finished = false;
            const done = function (err) { if (finished) return; finished = true; try { pc && pc.close(); } catch (e) { /* nada */ } resolve({ cands: cands, err: err || null }); };
            try { pc = new RTCPeerConnection({ iceServers: iceServers, iceTransportPolicy: policy || 'all' }); } catch (e) { done(String(e && e.message || e)); return; }
            const t = setTimeout(done, ms || 7000);
            pc.onicecandidate = function (e) { if (!e.candidate) { clearTimeout(t); done(); return; } if (e.candidate.candidate) cands.push(parseCand(e.candidate.candidate)); };
            try { pc.createDataChannel('t'); pc.createOffer().then(o => pc.setLocalDescription(o)).catch(err => { clearTimeout(t); done(String(err && err.message || err)); }); } catch (e) { clearTimeout(t); done(String(e && e.message || e)); }
        });
    }
    // dos conexiones dentro del mismo aparato: ¿se pueden mandar algo?
    function loopback(ms) {
        return new Promise(function (resolve) {
            let a, b, finished = false;
            const done = function (ok, why) { if (finished) return; finished = true; try { a.close(); b.close(); } catch (e) { /* nada */ } resolve({ ok: ok, why: why || '' }); };
            try { a = new RTCPeerConnection(); b = new RTCPeerConnection(); } catch (e) { done(false, String(e && e.message || e)); return; }
            const t = setTimeout(() => done(false, 'timeout'), ms || 6000);
            a.onicecandidate = e => { if (e.candidate) b.addIceCandidate(e.candidate).catch(() => {}); };
            b.onicecandidate = e => { if (e.candidate) a.addIceCandidate(e.candidate).catch(() => {}); };
            b.ondatachannel = e => { e.channel.onmessage = m => { if (m.data === 'hola') { clearTimeout(t); done(true); } }; };
            const ch = a.createDataChannel('x');
            ch.onopen = () => { try { ch.send('hola'); } catch (e) { /* nada */ } };
            a.createOffer().then(o => a.setLocalDescription(o)).then(() => b.setRemoteDescription(a.localDescription))
                .then(() => b.createAnswer()).then(o => b.setLocalDescription(o)).then(() => a.setRemoteDescription(b.localDescription))
                .catch(err => { clearTimeout(t); done(false, String(err && err.message || err)); });
        });
    }
    function signaling(ms) {
        return new Promise(function (resolve) {
            if (typeof Peer === 'undefined') { resolve({ ok: false, why: 'PeerJS no cargó' }); return; }
            let p, finished = false;
            const t0 = Date.now();
            const done = function (ok, why) { if (finished) return; finished = true; try { p && p.destroy(); } catch (e) { /* nada */ } resolve({ ok: ok, why: why || '', ms: Date.now() - t0 }); };
            try { p = typeof window.mbwNewPeer === 'function' ? window.mbwNewPeer() : new Peer(); } catch (e) { done(false, String(e && e.message || e)); return; }
            const t = setTimeout(() => done(false, 'timeout'), ms || 12000);
            p.on('open', () => { clearTimeout(t); done(true); });
            p.on('error', err => { clearTimeout(t); done(false, String(err && (err.type || err.message) || err)); });
        });
    }

    async function run(onStep) {
        const R = { at: new Date().toLocaleString(), user: localStorage.getItem('mbw_username') || 'Player', ver: '', ua: navigator.userAgent, net: '' };
        try { const a = document.querySelector('#about-modal'); const m = a && /v\d+ - Snapshot \d+/.exec(a.textContent); R.ver = m ? m[0] : ''; } catch (e) { /* nada */ }
        try { const c = navigator.connection; if (c) R.net = [c.type, c.effectiveType].filter(Boolean).join(' / '); } catch (e) { /* nada */ }
        R.app = /wv\)|; wv|MBWE/i.test(navigator.userAgent) || document.body.classList.contains('is-app');
        const step = (k, st, txt) => { R[k] = { st: st, txt: txt }; if (onStep) onStep(R); };
        // 1. WebRTC
        if (typeof RTCPeerConnection === 'undefined') { step('rtc', 'bad', tr('nt_rtc_none', 'This browser does not have WebRTC (needed to play together).')); }
        else {
            step('rtc', 'run', tr('nt_running', 'Testing…'));
            const lb = await loopback(6000);
            step('rtc', lb.ok ? 'ok' : 'bad', lb.ok ? tr('nt_rtc_ok', 'The browser allows direct connections.') : tr('nt_rtc_bad', 'The browser blocks direct connections (an extension, privacy mode or the browser itself).') + (lb.why ? ' (' + lb.why + ')' : ''));
        }
        // 2. PeerJS
        step('sig', 'run', tr('nt_running', 'Testing…'));
        const sg = await signaling(12000);
        step('sig', sg.ok ? 'ok' : 'bad', sg.ok ? tr('nt_sig_ok', 'Reaches the server that introduces the players ({ms} ms).', { ms: sg.ms }) : tr('nt_sig_bad', 'Cannot reach the server that introduces the players (blocked by the network, a firewall or an ad blocker).') + (sg.why ? ' (' + sg.why + ')' : ''));
        // 3 y 4. STUN (Google y Cloudflare) → dirección pública y tipo de NAT
        step('stun', 'run', tr('nt_running', 'Testing…'));
        const [g, c] = await Promise.all([gather(STUN_G, 'all', 7000), gather(STUN_C, 'all', 7000)]);
        const sg1 = g.cands.filter(x => x.type === 'srflx' && x.proto === 'udp'), sc1 = c.cands.filter(x => x.type === 'srflx' && x.proto === 'udp');
        const host = g.cands.concat(c.cands).filter(x => x.type === 'host');
        R.hostCount = host.length;
        if (!sg1.length && !sc1.length) step('stun', 'bad', tr('nt_stun_bad', 'Cannot go out to the internet for direct connections (UDP is blocked on this network).'));
        else step('stun', 'ok', tr('nt_stun_ok', 'Can go out to the internet for direct connections.'));
        const pub = (sg1[0] || sc1[0] || {}).ip || '';
        R.pubMasked = pub ? pub.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.x.x') : '';
        if (sg1.length && sc1.length) {
            const sym = sg1[0].port !== sc1[0].port || sg1[0].ip !== sc1[0].ip;
            R.symmetric = sym;
            step('nat', sym ? 'warn' : 'ok', sym ? tr('nt_nat_sym', 'Strict network (symmetric NAT): it changes the port for every connection, so direct connections with other players usually fail. Common with mobile data and shared networks.') : tr('nt_nat_ok', 'Normal network: other players can connect directly.'));
        } else if (sg1.length || sc1.length) step('nat', 'warn', tr('nt_nat_unknown', 'Could only check with one server: unknown.'));
        else step('nat', 'bad', tr('nt_nat_none', 'No public address: direct connections will not work.'));
        // 5. TURN (puente): el propio de Cloudflare (si ya está) y el de PeerJS
        if (window.mbwTurnLoading) { try { await Promise.race([window.mbwTurnLoading, sleep(4000)]); } catch (e) { /* nada */ } }
        R.ownTurn = Array.isArray(window.MBW_TURN) && window.MBW_TURN.length > 0;
        const ts = turnServers();
        if (!ts.length) step('turn', 'warn', tr('nt_turn_none', 'There is no bridge (TURN) set up.'));
        else {
            step('turn', 'run', tr('nt_running', 'Testing…'));
            const tg = await gather(ts, 'relay', 9000);
            const relay = tg.cands.filter(x => x.type === 'relay');
            R.relay = relay.length > 0;
            step('turn', relay.length ? 'ok' : 'bad', (relay.length ? tr('nt_turn_ok', 'The bridge (TURN) answers: if a direct connection is not possible, it can go through the bridge.') : tr('nt_turn_bad', 'The bridge (TURN) does not answer from this network.')) + ' ' + (R.ownTurn ? tr('nt_turn_own', '(own bridge: Cloudflare)') : tr('nt_turn_peerjs', '(PeerJS bridge only)')));
        }
        // veredicto
        let v;
        if ((R.rtc && R.rtc.st === 'bad')) v = ['bad', tr('nt_v_rtc', 'This browser blocks multiplayer. Turn off privacy extensions / VPN, or try Chrome or the app.')];
        else if (R.sig && R.sig.st === 'bad') v = ['bad', tr('nt_v_sig', 'This network (or an ad blocker / firewall) blocks the server that connects the players. Try another network or turn off the blocker.')];
        else if (R.stun && R.stun.st === 'bad') v = R.relay ? ['warn', tr('nt_v_relay_only', 'Direct connections are blocked here; it can only work through the bridge (TURN), which is slower and not always available. Better to try another network (Wi-Fi / mobile data).')] : ['bad', tr('nt_v_blocked', 'This network blocks playing online with others. Try another network (Wi-Fi / mobile data).')];
        else if (R.symmetric) v = R.relay ? ['warn', tr('nt_v_sym_relay', 'Strict network: with some players it will only connect through the bridge (TURN), and it may fail. If you cannot connect with someone, try another network (Wi-Fi / mobile data).')] : ['bad', tr('nt_v_sym', 'Strict network and the bridge does not answer: connecting with other players will probably fail. Try another network (Wi-Fi / mobile data).')];
        else v = ['ok', tr('nt_v_ok', 'This connection is fine for playing online.')];
        R.verdict = { st: v[0], txt: v[1] };
        if (onStep) onStep(R);
        return R;
    }

    // ------------------------------------------------------------------ la ventana
    const ROWS = [['rtc', 'nt_r_rtc', 'Browser (WebRTC)'], ['sig', 'nt_r_sig', 'Player server (PeerJS)'], ['stun', 'nt_r_stun', 'Direct connection (STUN)'], ['nat', 'nt_r_nat', 'Network type (NAT)'], ['turn', 'nt_r_turn', 'Bridge (TURN)']];
    const ICON = { ok: '✅', warn: '⚠️', bad: '❌', run: '⏳' };
    function textOf(R) {
        const L = ['🩺 ' + tr('nt_title', 'Connection test') + ' — ' + R.user + ' — ' + R.at, (R.ver || '') + (R.app ? ' · app' : ' · web') + (R.net ? ' · ' + R.net : '')];
        ROWS.forEach(r => { const x = R[r[0]]; if (x) L.push((ICON[x.st] || '') + ' ' + tr(r[1], r[2]) + ': ' + x.txt); });
        if (R.verdict) L.push('', (ICON[R.verdict.st] || '') + ' ' + R.verdict.txt);
        L.push('UA: ' + R.ua);
        return L.join('\n');
    }
    function open() {
        let el = document.getElementById('nt-modal');
        if (el) el.remove();
        el = document.createElement('div'); el.id = 'nt-modal';
        el.innerHTML = '<div class="nt-win"><div class="nt-head">🩺 <span>' + esc(tr('nt_title', 'Connection test')) + '</span><button type="button" class="nt-x">✕</button></div>' +
            '<p class="nt-sub">' + esc(tr('nt_sub', 'Checks whether this device can play online with other players. It takes about 20 seconds. Send a screenshot of the result to whoever is helping you.')) + '</p>' +
            '<div class="nt-meta"></div><div class="nt-rows"></div><div class="nt-verdict"></div>' +
            '<div class="nt-btns"><button type="button" class="nt-again">↻ ' + esc(tr('nt_again', 'Test again')) + '</button><button type="button" class="nt-copy">📋 ' + esc(tr('nt_copy', 'Copy result')) + '</button></div></div>';
        ['pointerdown', 'keydown', 'wheel'].forEach(n => el.addEventListener(n, e => e.stopPropagation()));
        document.body.appendChild(el);
        el.querySelector('.nt-x').onclick = () => el.remove();
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        let last = null;
        const paint = function (R) {
            last = R;
            el.querySelector('.nt-meta').textContent = R.user + ' · ' + R.at + (R.ver ? ' · ' + R.ver : '') + (R.app ? ' · app' : ' · web') + (R.net ? ' · ' + R.net : '');
            el.querySelector('.nt-rows').innerHTML = ROWS.map(r => { const x = R[r[0]] || { st: 'run', txt: tr('nt_wait', 'Waiting…') }; return '<div class="nt-row nt-' + x.st + '"><span class="nt-ic">' + ICON[x.st] + '</span><div><b>' + esc(tr(r[1], r[2])) + '</b><span>' + esc(x.txt) + '</span></div></div>'; }).join('');
            const v = el.querySelector('.nt-verdict');
            if (R.verdict) { v.className = 'nt-verdict nt-v-' + R.verdict.st; v.textContent = ICON[R.verdict.st] + ' ' + R.verdict.txt; v.style.display = ''; } else v.style.display = 'none';
            el.querySelector('.nt-again').disabled = !R.verdict;
        };
        const go = function () { paint({ user: localStorage.getItem('mbw_username') || 'Player', at: new Date().toLocaleString() }); run(paint).then(paint).catch(e => console.warn('net test', e)); };
        el.querySelector('.nt-again').onclick = go;
        el.querySelector('.nt-copy').onclick = function () {
            if (!last) return;
            const t = textOf(last);
            try { navigator.clipboard.writeText(t).then(() => { this.textContent = '✓ ' + tr('nt_copied', 'Copied'); }); } catch (e) { /* nada */ }
        };
        go();
    }
    window.mbwNetTest = { open: open, run: run, gather: gather, loopback: loopback, text: textOf };
})();
