// Tropicalíssima, depois das manchas: o feed corre em duas faixas.
(() => {
const { DPR, $, mouse, clamp, eio, carrega, progresso, visivel } = PF;

/* ---------- fotos dentro das manchas ---------- */
let formas = [], linhas;
const fotos = [...document.querySelectorAll('canvas.bf')].map(cv => ({ cv, ctx: cv.getContext('2d'), forma: +cv.dataset.forma, giro: +cv.dataset.giro || 0, folha: cv.dataset.folha === '1', im: null, t0: Math.random() * 10 }));
const pronta = (async () => {
  const polys = await (await fetch('/portfolio/trop-blob.json')).json();
  // normaliza cada mancha para caber num quadrado -1..1, reamostrada em 72 pontos
  formas = polys.map(poly => {
    let tot = 0; const seg = []; for (let i = 0; i < poly.length - 1; i++) { const l = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]); seg.push(l); tot += l; }
    const pts = []; let i = 0, acc = 0;
    for (let k = 0; k < 72; k++) { const alvo = k * tot / 72; while (acc + seg[i] < alvo) { acc += seg[i]; i++; } const t = (alvo - acc) / seg[i];
      pts.push([poly[i][0] + (poly[i + 1][0] - poly[i][0]) * t, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * t]); }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
    return pts.map(([x, y]) => [(x - cx) / r, (y - cy) / r]);
  });
  linhas = await carrega('/portfolio/img/trop-linhas.png');
  await Promise.all(fotos.map(async f => { f.im = await carrega(f.cv.dataset.src); }));
  medeFotos();
})();
function medeFotos() { fotos.forEach(f => { const r = f.cv.getBoundingClientRect(); f.cv.width = r.width * DPR; f.cv.height = r.height * DPR; f.w = r.width; f.h = r.height; }); }
addEventListener('resize', () => formas.length && medeFotos());

function desenhaFoto(f, t) {
  const { ctx, w, h } = f; if (!w) return;
  const r = f.cv.getBoundingClientRect();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, w, h);
  const forma = formas[f.forma], cx = w / 2, cy = h / 2, raio = Math.min(w, h) * .47;
  const mx = mouse.x - r.left, my = mouse.y - r.top;
  const cos = Math.cos(f.giro), sin = Math.sin(f.giro);
  const P = forma.map(([x, y], i) => {
    let px = x * cos - y * sin, py = x * sin + y * cos;
    // gelatina: respira e afunda onde o mouse passa
    const resp = 1 + Math.sin(t * 1.6 + i * .35 + f.t0) * .018 + Math.sin(t * 1.1 - i * .22) * .014;
    let X = cx + px * raio * resp, Y = cy + py * raio * resp;
    const dx = X - mx, dy = Y - my, d = Math.hypot(dx, dy);
    if (mouse.ativo && d < 140) { const k = (140 - d) / 140; X -= (X - cx) * k * .09; Y -= (Y - cy) * k * .09; }
    return [X, Y];
  });
  const caminho = () => { ctx.beginPath(); const n = P.length; ctx.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } ctx.closePath(); };
  ctx.save(); caminho(); ctx.clip();
  // a foto anda um pouco dentro da mancha com a rolagem
  const des = (r.top + r.height / 2 - innerHeight / 2) / innerHeight * h * .08;
  PF.cobre(ctx, f.im, 0, -h * .06 + des, w, h * 1.12);
  ctx.restore();
  if (f.folha && linhas) {
    // traço das folhas por cima, fora de registro, como no logo
    const lw = Math.min(w, h) * .5, lh = lw * 2850 / 2500;
    const ox = (mouse.x / innerWidth - .5) * 10, oy = (mouse.y / innerHeight - .5) * 10;
    ctx.globalAlpha = .95;
    ctx.drawImage(linhas, w - lw * .9 + ox, h - lh * .95 + oy, lw, lh);
    ctx.globalAlpha = 1;
  }
}

/* ---------- feed que corre ---------- */
const feed = $('.t-feed'), filas = [...document.querySelectorAll('.t-feed__fila')];

function quadro(ms) {
  const t = PF.tempo(ms);
  if (formas.length) for (const f of fotos) if (visivel(f.cv)) desenhaFoto(f, t);
  if (visivel(feed)) {
    const p = progresso(feed);
    filas.forEach(fl => { const sobra = fl.scrollWidth - innerWidth, d = +fl.dataset.dir;
      fl.style.transform = `translateX(${(d > 0 ? -p * sobra : -(1 - p) * sobra).toFixed(1)}px)`; });
  }
}
PF.extras.push(quadro);
pronta.catch(() => {});
})();
