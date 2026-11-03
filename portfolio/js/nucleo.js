// Núcleo: o que todos os mundos dividem. Pílula, rolagem contínua, pulo e abertura em zapping.
(() => {
const DPR = Math.min(2, devicePixelRatio || 1);
const $ = s => document.querySelector(s);
const mouse = { x: innerWidth / 2, y: innerHeight / 2, ativo: false };
addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.ativo = true; }, { passive: true });
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const eout = k => 1 - Math.pow(1 - k, 4);
const carrega = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(i); i.src = src; });
const espera = ms => new Promise(r => setTimeout(r, ms));
// progresso 0..1 de uma seção alta com palco grudado
const progresso = (el, extra = 0) => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight * (1 + extra))); };

// tela cheia em WebGL com um fragment shader; texturas vêm de canvas ou imagem
function gl(cv, frag) {
  const g = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  const vs = 'attribute vec2 p; varying vec2 v; void main(){ v = p*.5+.5; gl_Position = vec4(p,0.,1.); }';
  const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) console.error(g.getShaderInfoLog(o)); return o; };
  const pg = g.createProgram(); g.attachShader(pg, sh(g.VERTEX_SHADER, vs)); g.attachShader(pg, sh(g.FRAGMENT_SHADER, 'precision highp float;\nvarying vec2 v;\n' + frag)); g.linkProgram(pg); g.useProgram(pg);
  const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
  const l = g.getAttribLocation(pg, 'p'); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, 2, g.FLOAT, false, 0, 0);
  const locs = {}, U = n => locs[n] || (locs[n] = g.getUniformLocation(pg, n));
  const texs = {};
  return {
    g,
    tamanho(w, h, esc = 1) { cv.width = Math.round(w * esc); cv.height = Math.round(h * esc); g.viewport(0, 0, cv.width, cv.height); },
    textura(nome, unidade, fonte) {
      const t = texs[nome] || (texs[nome] = g.createTexture());
      g.activeTexture(g.TEXTURE0 + unidade); g.bindTexture(g.TEXTURE_2D, t);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, fonte);
      [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T].forEach(k => g.texParameteri(g.TEXTURE_2D, k, g.CLAMP_TO_EDGE));
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.uniform1i(U(nome), unidade);
    },
    desenha(un) {
      for (const k in un) { const v = un[k], u = U(k); if (u === null) continue;
        if (typeof v === 'number') g.uniform1f(u, v); else if (v.length === 2) g.uniform2f(u, v[0], v[1]); else if (v.length === 3) g.uniform3f(u, v[0], v[1], v[2]); else g.uniform4f(u, v[0], v[1], v[2], v[3]); }
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    }
  };
}
// imagem desenhada cobrindo um retângulo (como object-fit: cover)
function cobre(ctx, im, x, y, w, h, ax = .5, ay = .5) {
  const ar = im.naturalWidth / im.naturalHeight, r = w / h;
  let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
  if (ar > r) { sw = sh * r; sx = (im.naturalWidth - sw) * ax; } else { sh = sw / r; sy = (im.naturalHeight - sh) * ay; }
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}
const visivel = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

// movimento reduzido: sem zapping e sem animação que corre sozinha (?motion força tudo)
const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches && !new URLSearchParams(location.search).has('motion');
const tempo = ms => reduzir ? 0 : ms / 1000;

const mundos = [];
const registra = m => { m.sec = document.getElementById(m.id); mundos.push(m); };
window.PF = { reduzir, tempo, extras: [], DPR, $, mouse, clamp, eio, eout, carrega, espera, progresso, registra, gl, cobre, visivel, AMARELO: '#F9BF00' };

const pill = () => [...document.querySelectorAll('.pill [data-ir]')];
let atual = null;
function qualMundo() {
  const meio = innerHeight / 2;
  // o mundo de baixo ganha quando dois se sobrepõem na troca
  const lista = mundos.slice().sort((a, b) => a.sec.offsetTop - b.sec.offsetTop);
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i], prox = lista[i + 1];
    if (m.cede && prox && m.cede() && m.sec.getBoundingClientRect().bottom > 0 && prox.sec.getBoundingClientRect().top < innerHeight) return prox.id;
  }
  for (const m of lista.slice().reverse()) { const r = m.sec.getBoundingClientRect(); if (r.top <= meio && r.bottom > meio) return m.id; }
  return lista[0].id;
}
function confere() {
  const id = qualMundo(); if (id === atual) return;
  const velho = mundos.find(m => m.id === atual), novo = mundos.find(m => m.id === id);
  velho && velho.sai && velho.sai(); novo.entra && novo.entra(); atual = id;
  document.body.dataset.mundo = id;
  pill().forEach(b => { const on = b.dataset.ir === id && !b.classList.contains('pill__eu'); b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  const nav = $('.pill'), b = nav.querySelector(`[data-ir="${id}"]:not(.pill__eu)`);
  if (b && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' });
  history.replaceState(null, '', '#' + id);
}

// clique na pílula: corte em faixas na cor do destino e pula
const veu = $('#veu'), vx = veu.getContext('2d');
let pulando = false;
async function pula(id) {
  const m = mundos.find(x => x.id === id); if (pulando || !m) return; pulando = true;
  const W = innerWidth, H = innerHeight; veu.width = W * DPR; veu.height = H * DPR; vx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cor = m.cor || '#0b0b0b', n = 14, h = H / n;
  for (let s = 1; s <= 4; s++) { vx.clearRect(0, 0, W, H); vx.fillStyle = cor; for (let i = 0; i < n; i++) { const w = W * Math.min(1, s / 3 + (i % 3) * .12); vx.fillRect(i % 2 ? W - w : 0, i * h, w, h + 1); } await espera(55); }
  scrollTo(0, m.sec.offsetTop + (m.chegada ? m.chegada() : 0));
  await espera(30);
  for (let s = 3; s >= 0; s--) { vx.clearRect(0, 0, W, H); vx.fillStyle = cor; for (let i = 0; i < n; i++) { const w = W * Math.max(0, s / 3 - (i % 3) * .1); vx.fillRect(i % 2 ? 0 : W - w, i * h, w, h + 1); } await espera(55); }
  vx.clearRect(0, 0, W, H); pulando = false;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) { e.preventDefault(); pula(b.dataset.ir); } });

// passagens: a seção nova sobe esfumada (máscara no CSS) e o conteúdo dela só aparece quando chega ao topo
const entradas = [];
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-entra]').forEach(el => entradas.push({ el, sec: el.closest('[data-passagem]') || el.parentElement }));
});
function passagens() {
  // a cena que sai se dissolve, ainda parada, na cor da seção (que é a cor da próxima); a próxima entra rolando
  const H = innerHeight;
  for (const e of entradas) {
    if ('fica' in e.el.dataset) continue;
    const r = e.sec.getBoundingClientRect(); if (r.top > H || r.bottom < 0) continue;
    e.el.style.opacity = clamp((r.bottom - H) / (H * .35)).toFixed(3);
  }
}
function loop(ms) { passagens(); PF.antes && PF.antes(ms); for (const m of mundos) m.quadro(ms); for (const f of PF.extras) f(ms); confere(); requestAnimationFrame(loop); }

// abertura: a construção do nome. As guias saem do desenho real da Clother Bold (lido com o opentype.js):
// base, altura das maiúsculas e compensação das redondas, uma vertical em cada haste, um círculo ajustado
// em cada curva, o espaço entre as letras medido em unidades da fonte. A cota de baixo conta o carregamento.
// No fim os círculos das curvas se partem em meias-luas e caem por cima da MARATU.
const leFonte = () => new Promise(r => {
  if (window.opentype) return r();
  const s = document.createElement('script'); s.src = '/vendor/opentype.min.js?v=1'; s.onload = r; s.onerror = r; document.head.appendChild(s);
}).then(() => fetch('/TRYClother-Bold.ttf')).then(x => x.arrayBuffer()).then(buf => opentype.parse(buf));
function ajustaCirculo(P) {
  // mínimos quadrados (Kasa): x² + y² + Dx + Ey + F = 0
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; const n = P.length;
  for (const [x, y] of P) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], B = [-sxz, -syz, -sz];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A); if (Math.abs(d) < 1e-9) return null;
  const col = k => A.map((l, i) => l.map((v, j) => j === k ? B[i] : v));
  const D = det(col(0)) / d, E = det(col(1)) / d, F = det(col(2)) / d;
  const cx = -D / 2, cy = -E / 2, r = Math.sqrt(Math.max(0, cx * cx + cy * cy - F));
  let erro = 0; for (const [x, y] of P) erro += (Math.hypot(x - cx, y - cy) - r) ** 2;
  return { cx, cy, r, erro: Math.sqrt(erro / n) };
}
function analisa(cmds, capH) {
  const hastes = [], barras = [], curvas = [];
  let px = 0, py = 0, run = [];
  const fecha = () => { if (run.length >= 7) { const c = ajustaCirculo(run);
      if (c && c.r > capH * .12 && c.r < capH * .7 && c.erro < c.r * .045) {
        const ang = run.map(([x, y]) => Math.atan2(y - c.cy, x - c.cx)).sort((a, b) => a - b);
        let maior = 0; for (let i = 1; i < ang.length; i++) maior = Math.max(maior, ang[i] - ang[i - 1]);
        maior = Math.max(maior, ang[0] + Math.PI * 2 - ang[ang.length - 1]);
        if (Math.PI * 2 - maior > 1.6) curvas.push(c);   // só arcos com mais de ~90°
      } } run = []; };
  for (const c of cmds) {
    if (c.type === 'M') { fecha(); px = c.x; py = c.y; }
    else if (c.type === 'L') { fecha(); const dx = c.x - px, dy = c.y - py;
      if (Math.abs(dx) < .6 && Math.abs(dy) > capH * .3) hastes.push(px);
      else if (Math.abs(dy) < .6 && Math.abs(dx) > capH * .18) barras.push({ y: py, x1: Math.min(px, c.x), x2: Math.max(px, c.x) });
      px = c.x; py = c.y; }
    else if (c.type === 'Q' || c.type === 'C') {
      if (!run.length) run.push([px, py]);
      for (const t of [.25, .5, .75, 1]) { const u = 1 - t; let x, y;
        if (c.type === 'Q') { x = u * u * px + 2 * u * t * c.x1 + t * t * c.x; y = u * u * py + 2 * u * t * c.y1 + t * t * c.y; }
        else { x = u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x; y = u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y; }
        run.push([x, y]); }
      px = c.x; py = c.y; }
    else if (c.type === 'Z') fecha();
  }
  fecha();
  return { hastes, barras, curvas };
}
function abertura(tudo, inicia) {
  const el = $('#abre'), svg = $('#abre-svg'), W = innerWidth, H = innerHeight, NS = 'http://www.w3.org/2000/svg';
  const AREIA = '#F0ECE4', LAR = '#C8501A', MONO = 'ui-monospace, Menlo, monospace';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const mk = (tag, at, pai = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); pai.appendChild(e); return e; };
  let carregou = false, pular = false; tudo.then(() => carregou = true);
  el.addEventListener('click', () => pular = true, { once: true });
  const falha = () => { el.classList.add('fora'); tudo.then(inicia); };
  return leFonte().then(font => new Promise(fim => {
    const upm = font.unitsPerEm, capU = (font.tables.os2 && font.tables.os2.sCapHeight) || 700;
    const fs = Math.min(W * .118, H * .17), k = fs / upm, capH = capU * k, gap = fs * 1.02;
    const l1 = H * .5 - gap * .5 + capH * .5 - fs * .08, l2 = l1 + gap;
    const gGrade = mk('g', { opacity: 0 }), gGuia = mk('g', { stroke: AREIA, 'stroke-width': 1, fill: 'none' }), gTxt = mk('g', { fill: AREIA, 'font-family': MONO, 'font-size': 10, opacity: 0 }),
      gNome = mk('g', {}), gCota = mk('g', { opacity: 0, stroke: LAR, 'stroke-width': 1 }), gQueda = mk('g', {});
    for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) mk('circle', { cx: x, cy: y, r: .9, fill: AREIA, opacity: .2 }, gGrade);
    const tracos = [];
    const traco = (tag, at, ini, dur, op, pai = gGuia) => { const e = mk(tag, { ...at, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: op }, pai); tracos.push({ e, ini, dur, op }); return e; };
    const linhas = [['RAPHAEL', l1], ['NASCIMENTO', l2]];
    const glifos = [], circulos = [];
    let topoRedondo = 0, fundoRedondo = 0;
    linhas.forEach(([txt, y], li) => {
      const w = font.getAdvanceWidth(txt, fs), x0 = (W - w) / 2;
      font.forEachGlyph(txt, x0, y, fs, {}, (g, gx) => {
        const path = g.getPath(gx, y, fs), bb = g.getBoundingBox();
        glifos.push({ li, ch: g.name, path, x1: gx + bb.x1 * k, x2: gx + bb.x2 * k, y });
        if (/^[OCSG]$/.test(g.name)) { topoRedondo = Math.max(topoRedondo, bb.y2 - capU); fundoRedondo = Math.min(fundoRedondo, bb.y1); }
      });
    });
    // linhas de métrica: base e altura das maiúsculas, e a compensação das letras redondas (tracejada)
    linhas.forEach(([, y], li) => {
      traco('line', { x1: 0, y1: y, x2: W, y2: y }, .1 + li * .1, .8, .34);
      traco('line', { x1: 0, y1: y - capH, x2: W, y2: y - capH }, .15 + li * .1, .8, .34);
      if (topoRedondo) { mk('line', { x1: 0, y1: y - capH - topoRedondo * k, x2: W, y2: y - capH - topoRedondo * k, 'stroke-dasharray': '3 5', opacity: .22 }, gGuia);
        mk('line', { x1: 0, y1: y - fundoRedondo * k, x2: W, y2: y - fundoRedondo * k, 'stroke-dasharray': '3 5', opacity: .22 }, gGuia); }
      const xe = 18;
      mk('text', { x: xe, y: y - 5 }, gTxt).textContent = 'base 0';
      mk('text', { x: xe, y: y - capH - 5 }, gTxt).textContent = 'altura ' + capU;
      if (topoRedondo && li === 0) mk('text', { x: W - 18, y: y - capH - topoRedondo * k - 5, 'text-anchor': 'end' }, gTxt).textContent = 'compensação +' + Math.round(topoRedondo);
    });
    // hastes, barras e curvas de cada letra
    glifos.forEach((g, gi) => {
      const a = analisa(g.path.commands, capH), topo = g.y - capH - fs * .22, pe = g.y + fs * .12;
      [...new Set(a.hastes.map(x => Math.round(x)))].forEach((x, i) => traco('line', { x1: x, y1: topo, x2: x, y2: pe }, .45 + gi * .045 + i * .02, .55, .2));
      a.barras.filter(b => Math.abs(b.y - g.y) > 2 && Math.abs(b.y - (g.y - capH)) > 2).forEach(b =>
        traco('line', { x1: b.x1 - fs * .12, y1: b.y, x2: b.x2 + fs * .12, y2: b.y }, .9 + gi * .03, .5, .3));
      a.curvas.forEach(c => { if (circulos.some(o => Math.hypot(o.cx - c.cx, o.cy - c.cy) < 3 && Math.abs(o.r - c.r) < 3)) return;
        const e = traco('circle', { cx: c.cx, cy: c.cy, r: c.r }, .95 + circulos.length * .07, .8, .4);
        const cruz = mk('g', { opacity: 0 }, gGuia);
        mk('line', { x1: c.cx - 4, y1: c.cy, x2: c.cx + 4, y2: c.cy }, cruz); mk('line', { x1: c.cx, y1: c.cy - 4, x2: c.cx, y2: c.cy + 4 }, cruz);
        mk('line', { x1: c.cx, y1: c.cy, x2: c.cx + c.r * .7071, y2: c.cy - c.r * .7071, opacity: .6 }, cruz);
        circulos.push({ ...c, e, cruz, ini: .95 + circulos.length * .07 }); });
    });
    // espaço entre as letras do RAPHAEL, em unidades da fonte
    const g1 = glifos.filter(g => g.li === 0), yEsp = l1 - capH - fs * .3, gEsp = mk('g', { opacity: 0, stroke: LAR, 'stroke-width': 1 });
    for (let i = 1; i < g1.length; i++) { const xa = g1[i - 1].x2, xb = g1[i].x1; if (xb - xa < 4) continue;
      mk('line', { x1: xa, y1: yEsp, x2: xb, y2: yEsp }, gEsp); [xa, xb].forEach(x => mk('line', { x1: x, y1: yEsp - 4, x2: x, y2: yEsp + 4 }, gEsp));
      mk('text', { x: (xa + xb) / 2, y: yEsp - 7, 'text-anchor': 'middle', 'font-size': 10, 'font-family': MONO, fill: LAR, stroke: 'none' }, gEsp).textContent = Math.round((xb - xa) / k); }
    // o nome em traço, letra por letra
    const letras = glifos.map((g, i) => ({ e: mk('path', { d: g.path.toPathData(2), fill: AREIA, 'fill-opacity': 0, stroke: AREIA, 'stroke-width': 1.1, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, gNome), ini: 1.1 + i * .07 }));
    // cota de baixo: conta o carregamento
    const g2 = glifos.filter(g => g.li === 1), xa = g2[0].x1, xb = g2[g2.length - 1].x2, yc = l2 + fs * .34;
    mk('line', { x1: xa, y1: yc, x2: xb, y2: yc }, gCota); [xa, xb].forEach(x => mk('line', { x1: x, y1: yc - 7, x2: x, y2: yc + 7 }, gCota));
    const num = mk('text', { x: W / 2, y: yc - 9, 'text-anchor': 'middle', 'font-size': 12, 'font-family': MONO, fill: LAR, stroke: 'none' }, gCota);
    const t0 = performance.now();
    let fase2 = 0, quedas = null;
    (function f(agora) {
      const T = (agora - t0) / 1000;
      gGrade.setAttribute('opacity', clamp(T / .5).toFixed(3));
      gTxt.setAttribute('opacity', (clamp((T - .6) / .4) * .55).toFixed(3));
      for (const s of tracos) s.e.setAttribute('stroke-dashoffset', (1 - eout(clamp((T - s.ini) / s.dur))).toFixed(4));
      for (const c of circulos) c.cruz.setAttribute('opacity', (clamp((T - c.ini - .5) / .3) * .5).toFixed(3));
      for (const l of letras) l.e.setAttribute('stroke-dashoffset', (1 - eio(clamp((T - l.ini) / .9))).toFixed(4));
      gEsp.setAttribute('opacity', clamp((T - 1.7) / .4).toFixed(3));
      gCota.setAttribute('opacity', clamp((T - .8) / .4).toFixed(3));
      num.textContent = String(Math.round(Math.min(clamp(T / 3), carregou ? 1 : .93) * 100)).padStart(3, '0');
      if (!fase2 && carregou && (T > 3.1 || pular)) { fase2 = agora; inicia(); }
      if (fase2) {
        const F = (agora - fase2) / 1000, kf = eout(clamp(F / .45));
        for (const l of letras) { l.e.setAttribute('fill-opacity', kf.toFixed(3)); l.e.setAttribute('stroke-dashoffset', 0); }
        const some = 1 - clamp((F - .6) / .4);
        for (const s of tracos) s.e.setAttribute('opacity', (s.op * some).toFixed(3));
        [gTxt, gEsp, gCota].forEach(g => g.setAttribute('opacity', (+g.getAttribute('opacity') * (1 - clamp((F - .3) / .3))).toFixed(3)));
        for (const c of circulos) c.cruz.setAttribute('opacity', (.5 * some).toFixed(3));
        // os círculos das curvas se partem em duas meias-luas e caem
        if (F > .7 && !quedas) {
          quedas = []; const cores = [LAR, '#2E6FC4', '#D4960A', AREIA];
          circulos.forEach((c, i) => { c.e.setAttribute('opacity', 0); [0, Math.PI].forEach(lado => {
            const p = mk('path', { d: `M${-c.r} 0 A${c.r} ${c.r} 0 0 1 ${c.r} 0 Z`, fill: cores[i % cores.length] }, gQueda);
            quedas.push({ p, x: c.cx, y: c.cy, a: lado, vx: (lado ? 1 : -1) * (30 + Math.random() * 80), vy: -100 - Math.random() * 150, va: (Math.random() - .5) * 5 }); }); });
          el.classList.add('solta');
        }
        if (quedas) {
          const dt = 1 / 60;
          for (const q of quedas) { q.vy += 1500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.a += q.va * dt;
            q.p.setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) rotate(${(q.a * 57.3).toFixed(1)})`); }
          const s = clamp((F - .9) / .45);
          gNome.setAttribute('opacity', (1 - s).toFixed(3)); gNome.setAttribute('transform', `translate(0 ${(-s * 40).toFixed(1)})`);
          gGrade.setAttribute('opacity', (1 - clamp((F - .7) / .5)).toFixed(3));
        }
        if (F > 2.4) { el.classList.add('fora'); return fim(); }
      }
      requestAnimationFrame(f);
    })(t0);
  })).catch(falha);
}

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
document.addEventListener('DOMContentLoaded', () => {
  // nada segura a página mais de 8 s, mesmo se algo não carregar
  const tudo = Promise.race([Promise.all(mundos.map(m => Promise.resolve(m.pronta).catch(() => {}))), espera(8000)]);
  const h = location.hash.slice(1), m = mundos.find(x => x.id === h);
  let foi = false;
  const inicia = () => { if (foi) return; foi = true; if (m && m.id !== 'maratu') scrollTo(0, m.sec.offsetTop + (m.chegada ? m.chegada() : 0)); requestAnimationFrame(loop); };
  if (!h && !reduzir) abertura(tudo, inicia);
  else tudo.then(() => { $('#abre').classList.add('fora'); inicia(); });
});
})();
