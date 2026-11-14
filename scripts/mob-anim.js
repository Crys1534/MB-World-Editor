// ==========================================================
// 🐺 MOBS ANIMADOS (va antes de main.js)
//
// Los dibujos de assets/mobs/ (números = cuadros del juego) se juntaron en tiras de assets/mobs/anim/, todos los cuadros
// del mismo tamaño y en su lugar. Se animan igual que Mine Blocks (Entity_Mob.renderMob: animations idle / walk con
// frameDelay; Entity_Mob_<Mob>.frames dice qué dibujo va en cada cuadro):
//   · zombie, zombie pigman, skeleton, pig, cow / mooshroom, sheep (cuerpo sin lana + la lana pintada de su color),
//     wolf / dog (la cola va aparte y se mueve; el collar del perro va aparte y se pinta de su color), rabbit (8 colores).
//   · En el editor se ven quietos (cuadro 1); jugando, caminan cuando el mob camina.
// ==========================================================
(function () {
    'use strict';
    const BASE = 'assets/mobs/anim/';
    const strips = {};
    function strip(name) {
        let s = strips[name];
        if (!s) {
            s = strips[name] = new Image();
            s.onload = () => { if (typeof worldDirty !== 'undefined') try { worldDirty = true; } catch (e) { /* nada */ } };
            s.src = BASE + name + '.png';
        }
        return s.complete && s.naturalWidth > 0 ? s : null;
    }
    // Colores de Mine Blocks (Colors.colors)
    const COLORS = { red: [190, 0, 0], green: [41, 144, 0], blue: [0, 0, 210], brown: [80, 51, 20], cyan: [46, 209, 150], lightblue: [0, 204, 255],
        lightgreen: [107, 201, 0], magenta: [182, 9, 115], orange: [255, 96, 0], pink: [255, 170, 170], purple: [133, 39, 165], white: [247, 247, 247],
        yellow: [230, 202, 0], lightgray: [204, 204, 204], gray: [102, 102, 102], black: [51, 51, 51] };
    const WALK3 = [0, 0, 1, 2, 1, 3, 0];                                  // zombie / pigman / skeleton: Entity_Mob_*.frames
    const DEF = {
        zombie:       { s: 'zombie', w: 13, h: 21, k: 2.858276, img: (f) => WALK3[f], walk: [2, 3, 4, 5, 6], delay: 6 },
        zombiepigman: { s: 'zombiepigman', w: 13, h: 22, k: 2.858276, img: (f) => WALK3[f], walk: [2, 3, 4, 5, 6], delay: 4 },
        skeleton:     { s: 'skeleton', w: 12, h: 21, k: 2.858276, img: (f) => WALK3[f], walk: [2, 3, 4, 5, 6], delay: 4 },
        pig:          { s: 'pig', w: 20, h: 15, k: 3, img: (f) => [0, 0, 1, 0, 2][f], walk: [2, 3, 4, 4, 4], delay: 8 },
        cow:          { s: 'cow', w: 22, h: 20, k: 3, img: (f, m) => (m.variant === 'mooshroom' ? 3 : 0) + f - 1, walk: [2, 1, 3], delay: 8, skip: (m) => m.variant === 'cowctus' },
        sheep:        { s: 'sheep', w: 22, h: 17, k: 2.4, img: (f) => [0, 0, 1, 2, 3, 4][f], walk: [2, 2, 1, 3], delay: 8 },
        wolf:         { s: 'wolf', w: 22, h: 18, k: 2.7, img: (f) => f - 1, walk: [2, 3, 4, 5, 5], delay: 4 },
        rabbit:       { s: 'rabbit', w: 12, h: 16, k: 1.919922, img: (f, m) => (f - 1) * 8 + (rabbitType(m) - 1) }
    };
    function rabbitType(m) {
        const n = String(m.name || '').toLowerCase();
        if (n === 'toast') return 7;
        if (n === 'moose') return 8;
        const t = Number(m.rabbitType) | 0;
        return t >= 1 && t <= 8 ? t : 1;
    }
    function defOf(m) {
        const d = m && DEF[m.type];
        if (!d || (d.skip && d.skip(m))) return null;
        return d;
    }
    window.mbwMobAnimSize = function (m) {                                  // [ancho, alto] en cuadros (o null: el dibujo de siempre)
        const d = defOf(m);
        return d ? [d.w * d.k / 30, d.h * d.k / 30] : null;
    };

    // ¿Está caminando? Jugando, lo dice su IA (teclas izquierda / derecha); si no (invitado en multijugador), si se movió hace poco.
    const seen = new Map();
    function walking(key, m) {
        const now = performance.now();
        if (window.mbwPlay && typeof window.mbwPlay.mobMoving === 'function') {
            const r = window.mbwPlay.mobMoving(key);
            if (r !== null && r !== undefined) return r;
        }
        if (!window.mbwPlaying) return false;
        let s = seen.get(key);
        const x = Number(m.x);
        if (!s) { s = { x: x, t: 0 }; seen.set(key, s); }
        if (Math.abs(x - s.x) > .01) { s.t = now; s.x = x; }
        return now - s.t < 250;
    }
    function frameOf(key, m, d) {
        if (m.type === 'rabbit') {                                          // 🐇 1 quieto, 2 subiendo, 3 bajando
            if (!window.mbwPlaying || !m.falling) return 1;
            return Number(m.speedY) > 0 ? 2 : 3;
        }
        const off = m.type === 'wolf' && m.tamed === true ? 5 : 0;           // 🐶 el perro usa los cuadros 6 a 11
        if (m.type === 'wolf' && m.sitting && m.tamed) return 6 + off;
        if (!window.mbwPlaying || !walking(key, m)) return 1 + off;
        const tick = Math.floor(performance.now() / (1000 / 30));
        return d.walk[Math.floor(tick / d.delay) % d.walk.length] + off;
    }

    // Lienzos con el color ya puesto (lana, collar), uno por color
    const tinted = {};
    function tint(src, sx, sy, w, h, rgb) {
        const k = src.src + '|' + sx + ',' + sy + '|' + rgb.join(',');
        if (tinted[k]) return tinted[k];
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const t = c.getContext('2d'); t.imageSmoothingEnabled = false;
        t.drawImage(src, sx, sy, w, h, 0, 0, w, h);
        t.globalCompositeOperation = 'multiply'; t.fillStyle = 'rgb(' + rgb.join(',') + ')'; t.fillRect(0, 0, w, h);
        t.globalCompositeOperation = 'destination-in'; t.drawImage(src, sx, sy, w, h, 0, 0, w, h);
        tinted[k] = c;
        return c;
    }
    function rainbow() { const h = (performance.now() / 12) % 360, f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (.5 - .5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; }

    const TAIL_ROT = [45, 30, 21.3, 15, 23.3, -15, -15, -15, -15, -15, -15], TAIL_OFF = [0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 5], COLLAR = [0, 0, 0, 0, 0, 1, 2, 2, 1, 1, 1];

    // Dibuja el mob en el rectángulo (x, y, w, h) — el contexto ya viene girado si mira al otro lado. true = lo dibujó.
    window.mbwMobAnimDraw = function (c, key, m, x, y, w, h) {
        const d = defOf(m);
        if (!d) return false;
        const img = strip(d.s);
        if (!img) return false;
        const f = frameOf(key, m, d), i = d.img(f, m);
        if (!(i >= 0) || (i + 1) * d.w > img.naturalWidth) return false;
        const px = w / d.w;                                                  // (tamaño de 1 pixel del dibujo)
        c.drawImage(img, i * d.w, 0, d.w, d.h, x, y, w, h);
        if (m.type === 'sheep' && !(m.sheared === true || m.sheared === 1)) {   // 🐑 la lana, de su color
            const wool = strip('sheepwool');
            if (wool) {
                const wi = [0, 0, 0, 0, 1, 2][f] || 0, rgb = m.color === 'rainbow' ? rainbow().map((v) => v & ~7) : (COLORS[m.color] || COLORS.white);
                c.drawImage(tint(wool, wi * 22, 0, 22, 17, rgb), 0, 0, 22, 17, x, y + (f === 1 ? px : 0), w, h);
            }
        }
        if (m.type === 'wolf') {                                             // 🐺 cola (se mueve) y 🐶 collar
            const parts = strip('wolfparts');
            if (parts) {
                const hp = Number(m.health);
                const rot = TAIL_ROT[f - 1] + (f <= 5 || f === 11 ? 0 : 4 * (20 - (isFinite(hp) ? hp : 20)));
                c.save();
                c.translate(x + 18.5 * px, y + (10 + TAIL_OFF[f - 1]) * px);
                c.rotate(-rot / 180 * Math.PI);
                c.drawImage(parts, (f > 5 ? 1 : 0) * 8, 0, 8, 4, 0, -2 * px, 8 * px, 4 * px);
                c.restore();
                const ct = COLLAR[f - 1];
                if (ct > 0) {
                    const rgb = COLORS[m.collarColor] || COLORS.white;
                    c.drawImage(tint(parts, (1 + ct) * 8, 0, 5, 4, rgb), 0, 0, 5, 4, x + (4 + (f === 11 ? 1 : 0)) * px, y + (8 + (f === 10 ? -1 : 0)) * px, 5 * px, 4 * px);
                }
            }
        }
        return true;
    };
})();
