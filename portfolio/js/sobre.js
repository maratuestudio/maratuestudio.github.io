// Sobre e contato: o retrato é a foto; onde o mouse passa, ela vira as meias-luas da MARATU, que giram e somem devagar.
(() => {
const { $, mouse, clamp, eio, visivel, carrega } = PF;
const sec = $('#sobre'), cv = $('#so-retrato'), ctx = cv.getContext('2d'), hora = $('#so-hora');
const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
let cels = [], N = 0, LADO = 0, foto = null, calor = new Float32Array(0);
const marca = $('.so-nome .marca');

function amostra() {
  if (!foto) return;
  N = innerWidth < 700 ? 30 : 40;
  const t = document.createElement('canvas'); t.width = t.height = N;
  const x = t.getContext('2d'); x.drawImage(foto, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data, L = (i, j) => d[(clamp(j, 0, N - 1) * N + clamp(i, 0, N - 1)) * 4] / 255;
  cels = []; calor = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const esc = Math.pow(clamp((.6 - L(i, j)) / .48), .8);   // o fundo cinza some, cabelo e camisa pesam
    if (esc < .02) continue;
    const gx = L(i + 1, j) - L(i - 1, j), gy = L(i, j + 1) - L(i, j - 1);
    const alvo = Math.round(Math.atan2(gy, gx) / (Math.PI / 2)) * Math.PI / 2;   // a curva acompanha o contorno
    cels.push({ i, j, esc, alvo, caos: hash(i, j) * 6.3, sx: (hash(j + 3, i) - .5) * 1.4, sy: (hash(i + 7, j + 1) - .5) * 1.4, gira: 0, giraV: 0, ult: 0, calor: 0 });
  }
}
function mede() {
  LADO = cv.clientWidth; const d = PF.DPR;
  cv.width = cv.height = Math.round(LADO * d); ctx.setTransform(d, 0, 0, d, 0, 0);
}
function meiaLua(x, y, r, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.arc(0, -r * .42, r, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.restore();
}
function quadro(ms) {
  hora.textContent = fmt.format(new Date());
  if (!visivel(cv) || !cels.length) return;
  const r = cv.getBoundingClientRect();
  const k = eio(clamp((innerHeight - r.top) / (innerHeight * .9)));
  const passo = LADO / N, mx = mouse.x - r.left, my = mouse.y - r.top;
  ctx.clearRect(0, 0, LADO, LADO);
  marca.style.setProperty('--m', (k * 100).toFixed(1) + '%');
  // a foto fica no fundo; onde o mouse passa, ela vira meias-luas
  ctx.globalAlpha = k; ctx.drawImage(foto, 0, 0, LADO, LADO); ctx.globalAlpha = 1;
  const dentro = mouse.ativo && mx > -passo * 4 && my > -passo * 4 && mx < LADO + passo * 4 && my < LADO + passo * 4;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const n = j * N + i, cx = (i + .5) * passo, cy = (j + .5) * passo;
    if (dentro) { const d = Math.hypot(mx - cx, my - cy) / (passo * 3.6); if (d < 1) calor[n] = Math.max(calor[n], 1 - d * d); }
    calor[n] *= .975;
    if (calor[n] < .02) continue;
    ctx.globalAlpha = Math.min(1, calor[n] * 1.6); ctx.fillStyle = '#F4F4F1';
    ctx.fillRect(i * passo, j * passo, passo + .6, passo + .6);
  }
  for (const c of cels) {
    const q = Math.min(1, calor[c.j * N + c.i] * 1.6); if (q < .03) continue;
    const cx = (c.i + .5) * passo, cy = (c.j + .5) * passo;
    if (Math.hypot(mx - cx, my - cy) < passo * 2.4 && ms - c.ult > 550) { c.gira += Math.PI / 2; c.ult = ms; }
    c.giraV += (c.gira - c.giraV) * .16;
    ctx.globalAlpha = q; ctx.fillStyle = q > .6 ? '#C8501A' : '#0D0D0B';
    meiaLua(cx, cy, passo * .5 * Math.max(.35, Math.sqrt(c.esc)) * 1.08, c.alvo + c.giraV);
  }
  ctx.globalAlpha = 1;
}
const pronta = carrega('/portfolio/img/rn-retrato.webp').then(im => { foto = im; mede(); amostra(); });
addEventListener('resize', () => { const n = N; mede(); if ((innerWidth < 700 ? 30 : 40) !== n) amostra(); });
PF.registra({ id: 'sobre', cor: '#F4F4F1', pronta, quadro });
})();
