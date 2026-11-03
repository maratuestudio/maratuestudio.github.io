// MARATU: meias-luas viram o aratu, MAR + ARATU vira o nome, a paleta sobe como maré, pôsteres, o site ao vivo e a pilha de objetos.
import * as THREE from 'three';
import { GLTFLoader } from '/vendor/three/GLTFLoader.js';
import { RoomEnvironment } from '/vendor/three/RoomEnvironment.js';

const { $, mouse, clamp, eio, eout, progresso, visivel } = PF;
const toque = matchMedia('(hover: none)').matches;
const sec = $('#maratu'), pilhaSec = $('.mr-pilha'), el = $('#mr-3d');
const agora = () => performance.now() / 1000;
const PALETA = ['#C8501A', '#0E3272', '#1D6E4F', '#D4960A', '#EDE6DA', '#1E1C1A', '#E07A4F', '#2E6FC4'];

/* ---------- pilha 3D com física simples (esferas) ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, toque ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
el.appendChild(renderer.domElement);
const cena = new THREE.Scene();
cena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
const cam = new THREE.PerspectiveCamera(30, 1, .1, 100); cam.position.set(0, 0, 14);
cena.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7a66, .9));
const sol = new THREE.DirectionalLight(0xffffff, 2.4); sol.position.set(-5, 9, 7); sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024); Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 });
sol.shadow.radius = 4; sol.shadow.bias = -.0005; cena.add(sol);
const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.ShadowMaterial({ opacity: .16 }));
chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; cena.add(chao);

let meiaA = 1, meiaL = 1, pisoY = -3, xMin = -5, xMax = 5;
function medir() {
  const W = el.clientWidth, H = el.clientHeight; renderer.setSize(W, H, false);
  cam.aspect = W / H; cam.updateProjectionMatrix();
  meiaA = Math.tan(THREE.MathUtils.degToRad(15)) * 14; meiaL = meiaA * cam.aspect;
  pisoY = -meiaA + .15; chao.position.y = pisoY;
  xMin = -meiaL + .2; xMax = meiaL - .2;
}
medir(); addEventListener('resize', medir);

const loader = new GLTFLoader();
const glb = n => loader.loadAsync('/portfolio/3d/' + n + '.glb').catch(() => null).then(g => {
  if (!g) return new THREE.Group();
  g.scene.traverse(o => { if (!o.isMesh) return; if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    o.castShadow = true; o.receiveShadow = true; o.material.side = THREE.DoubleSide; o.material.envMapIntensity = .55; });
  return g.scene;
});
const nomes = ['chaveiro-carranca', 'chaveiro-relogio', 'chaveiro-arcos', 'chaveiro-tag', 'aratu', 'relogio-farol', 'porta-incenso', 'cobogo'];
const corpos = [];
const pronta = Promise.all(nomes.map(glb)).then(modelos => {
  const N = toque ? 14 : 24;
  for (let i = 0; i < N; i++) {
    const k = i % modelos.length, obj = modelos[k].clone(true);
    const grande = k >= 5;   // relógio, incensário e cobogó entram maiores e com a cor deles
    if (!grande) { const cor = new THREE.Color(PALETA[i % PALETA.length]); obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = cor; o.material.roughness = .62; } }); }
    const esf = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
    const r = (toque ? .5 : .78) * (grande ? 1.5 : nomes[k] === 'aratu' ? 1.25 : 1) * (.85 + Math.random() * .3);
    const g = new THREE.Group(); obj.position.sub(esf.center); g.add(obj); g.scale.setScalar(r / esf.radius);
    g.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    g.visible = false; cena.add(g);
    corpos.push({ g, r: r * .82, p: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3(), nasce: .1 + i * .06, vivo: false });
  }
});
function soltar(c) {
  c.p.set(THREE.MathUtils.lerp(xMin + .5, xMax - .5, Math.random()), meiaA + 1 + Math.random() * 3, (Math.random() - .5) * 1.2);
  c.v.set((Math.random() - .5) * 2, -2 - Math.random() * 3, 0); c.w.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
  c.vivo = true; c.g.visible = true;
}
const ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ptr = new THREE.Vector3(), ptrAnt = new THREE.Vector3(), ptrV = new THREE.Vector3();
let ptrAtivo = false;
function lerPtr() {
  const r = el.getBoundingClientRect();
  const ndc = new THREE.Vector2(((mouse.x - r.left) / r.width) * 2 - 1, -((mouse.y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, cam); ray.ray.intersectPlane(plano, ptr);
  ptrAtivo = mouse.ativo && mouse.y > r.top && mouse.y < r.bottom;
}
el.addEventListener('pointerdown', () => {
  lerPtr();
  corpos.forEach(c => { if (!c.vivo) return;
    const d = c.p.clone().sub(ptr); const dist = Math.max(.6, d.length());
    c.v.add(d.normalize().multiplyScalar(9 / dist)).add(new THREE.Vector3(0, 7 + Math.random() * 5, 0));
    c.w.set(Math.random() * 16 - 8, Math.random() * 16 - 8, Math.random() * 16 - 8); });
});
const G = -22, dq = new THREE.Quaternion(), tmp = new THREE.Vector3();
function passo(dt) {
  ptrV.copy(ptr).sub(ptrAnt).divideScalar(Math.max(dt, 1e-3)); ptrAnt.copy(ptr);
  for (const c of corpos) {
    if (!c.vivo) continue;
    c.v.y += G * dt; c.p.addScaledVector(c.v, dt);
    if (c.p.y - c.r < pisoY) { c.p.y = pisoY + c.r; if (c.v.y < 0) c.v.y *= -.32; c.v.x *= .93; c.v.z *= .93; c.w.lerp(tmp.set(c.v.z / c.r, c.w.y * .9, -c.v.x / c.r), .3); }
    if (c.p.x - c.r < xMin) { c.p.x = xMin + c.r; c.v.x = Math.abs(c.v.x) * .4; }
    if (c.p.x + c.r > xMax) { c.p.x = xMax - c.r; c.v.x = -Math.abs(c.v.x) * .4; }
    if (Math.abs(c.p.z) > .7) { c.p.z = Math.sign(c.p.z) * .7; c.v.z *= -.3; }
    if (ptrAtivo) {
      const d = tmp.copy(c.p).sub(ptr); d.z = 0; const dist = d.length(), lim = c.r + .75;
      if (dist < lim && dist > 1e-4) { d.divideScalar(dist); c.p.addScaledVector(d, (lim - dist) * .5);
        c.v.addScaledVector(d, 3 + Math.min(14, ptrV.length() * .35)); c.w.x += (Math.random() - .5) * 6; c.w.z += (Math.random() - .5) * 6; }
    }
  }
  for (let i = 0; i < corpos.length; i++) { const a = corpos[i]; if (!a.vivo) continue;
    for (let j = i + 1; j < corpos.length; j++) { const b = corpos[j]; if (!b.vivo) continue;
      const d = tmp.copy(b.p).sub(a.p); const dist = d.length(), min = a.r + b.r;
      if (dist >= min || dist < 1e-5) continue;
      d.divideScalar(dist); const sob = (min - dist) / 2;
      a.p.addScaledVector(d, -sob); b.p.addScaledVector(d, sob);
      const vr = (b.v.x - a.v.x) * d.x + (b.v.y - a.v.y) * d.y + (b.v.z - a.v.z) * d.z;
      if (vr < 0) { const imp = -1.25 * vr / 2; a.v.addScaledVector(d, -imp); b.v.addScaledVector(d, imp); }
      a.v.multiplyScalar(.995); b.v.multiplyScalar(.995); } }
  for (const c of corpos) { if (!c.vivo) continue; c.w.multiplyScalar(.985);
    const ang = c.w.length() * dt; if (ang > 1e-5) { dq.setFromAxisAngle(tmp.copy(c.w).normalize(), ang); c.g.quaternion.premultiply(dq); }
    c.g.position.copy(c.p); }
}


const LARANJA = '#C8501A', SERGIPE = '#0E3272', ATALAIA = '#2E6FC4', AREIA = '#F0ECE4', MANGUE = '#0D0D0B', SOL = '#D4960A';
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------- o aratu é feito de meias-luas ----------
   cada peça é meia-lua: centro da borda reta (x, y), raio r, ângulo da curva (0 = curva pra baixo), haste do lado reto (em r) */
// medidas do aratu oficial (o Chico do painel), com o raio do casco = 1 e a origem no meio da borda reta do casco
const ARATU = [
  { x: 0, y: 0, r: 1, a: 0, h: 0 },                              // casco
  { x: -.433, y: -.338, r: .25, a: Math.PI / 2, h: 0 },          // olho esquerdo, curva pra fora
  { x: .432, y: -.338, r: .25, a: -Math.PI / 2, h: 0 },          // olho direito
  { x: -1.153, y: .5, r: .5, a: Math.PI / 2, h: 0 },             // garra esquerda
  { x: 1.153, y: .5, r: .5, a: -Math.PI / 2, h: 0 }              // garra direita
];
function meiaLua(ctx, x, y, r, a, h = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(-r, -h * r); ctx.lineTo(-r, 0); ctx.arc(0, 0, r, Math.PI, 0, true); ctx.lineTo(r, -h * r); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------- 1. meias-luas ---------- */
const luasSec = $('.mr-luas'), cvL = $('#mr-luas'), cL = cvL.getContext('2d');
const PAL = [LARANJA, SERGIPE, ATALAIA, AREIA, SOL, '#E07A4F'];
let tiles = [], LW = 0, LH = 0, ts = 80;
function medeLuas() {
  LW = innerWidth; LH = innerHeight; const d = PF.DPR;
  cvL.width = LW * d; cvL.height = LH * d; cL.setTransform(d, 0, 0, d, 0, 0);
  ts = Math.max(52, Math.min(110, Math.min(LW, LH) / 8.5));
  const cols = Math.ceil(LW / ts) + 1, rows = Math.ceil(LH / ts) + 1, ox = (LW - (cols - 1) * ts) / 2, oy = (LH - (rows - 1) * ts) / 2;
  tiles = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    tiles.push({ x: ox + i * ts, y: oy + j * ts, alvo: Math.floor(hash(i, j) * 4) * Math.PI / 2, caos: hash(j + 7, i + 3) * Math.PI * 2,
      cor: PAL[Math.floor(hash(i + 11, j + 5) * PAL.length)], gira: 0, giraV: 0, ult: 0, vel: (hash(i, j + 9) - .5) * 1.2 });
  }
  // cada peça do aratu nasce de uma meia-lua da grade
  const M = mascote();
  ARATU.forEach(p => {
    let melhor = null, dm = 1e9;
    for (const t of tiles) { const d = Math.hypot(t.x - (M.cx + p.x * M.R * 2.2), t.y - (M.cy + p.y * M.R * 2.2)); if (d < dm && !t.peca) { dm = d; melhor = t; } }
    if (melhor) { melhor.peca = true; p.de = melhor; }
  });
}
const mascote = () => { const R = Math.min(LW * .2, LH * .26); return { cx: LW / 2, cy: LH * .5 - R * .2, R }; };
function quadroLuas(ms) {
  const p = progresso(luasSec), T = PF.reduzir ? 0 : ms / 1000;
  const k1 = eio(clamp(p / .34)), k2 = eio(clamp((p - .32) / .4));
  cL.clearRect(0, 0, LW, LH);
  const M = mascote(), r = ts * .4;
  for (const t of tiles) {
    // o mouse passa e a meia-lua dá um quarto de volta
    if (mouse.ativo && Math.hypot(mouse.x - t.x, mouse.y - t.y) < ts * .75 && ms - t.ult > 650) { t.gira += Math.PI / 2; t.ult = ms; }
    t.giraV += (t.gira - t.giraV) * .14;
    if (t.peca && k2 > 0) continue;
    const dentro = Math.hypot((t.x - M.cx) / (M.R * 1.9), (t.y - M.cy - M.R * .15) / (M.R * 1.1)) < 1;
    const a = lerp(t.caos + T * t.vel, t.alvo, k1) + t.giraV;
    const cor = k2 > 0 ? mix(LARANJA, SERGIPE, k2) : mix(t.cor === LARANJA ? LARANJA : t.cor, LARANJA, k1);
    const alfa = dentro ? 1 - k2 : 1 - k2 * .35;
    if (alfa <= .01) continue;
    cL.globalAlpha = alfa; cL.fillStyle = k1 < 1 && k2 === 0 ? mix(t.cor, LARANJA, k1) : cor;
    const s = 1 - (dentro ? k2 * .6 : 0);
    meiaLua(cL, t.x - Math.sin(a) * r * .4 * -1, t.y - Math.cos(a) * r * .4, r * s, a);
  }
  cL.globalAlpha = 1;
  if (k2 > 0) {
    cL.fillStyle = LARANJA;
    ARATU.forEach((pc, i) => {
      const de = pc.de || { x: M.cx, y: M.cy, alvo: 0 };
      const k = eio(clamp((k2 - i * .06) / .76));
      const x = lerp(de.x, M.cx + pc.x * M.R, k), y = lerp(de.y, M.cy + pc.y * M.R, k), rr = lerp(r, pc.r * M.R, k);
      const a = lerp(de.alvo + de.giraV, pc.a, k);
      meiaLua(cL, x, y, rr, a, pc.h * k);
    });
  }
}

/* ---------- 2. MAR + ARATU ---------- */
const nomeSec = $('.mr-nome'), nomeEl = $('#mr-nome'), logoN = $('.mr-nome__logo'), estN = $('.mr-nome__estudio');
// MAR (linha de cima) e ARATU (linha de baixo); o AR de baixo cai em cima do AR de cima
const LETRAS = [['M', 0, 'mar'], ['A', 1, 'mar'], ['R', 2, 'mar'], ['A', 1, 'aratu', true], ['R', 2, 'aratu', true], ['A', 3, 'aratu'], ['T', 4, 'aratu'], ['U', 5, 'aratu']]
  .map(([ch, i, w, dup]) => {
    const d = document.createElement('div'); d.className = 'mr-letra';
    d.innerHTML = `<i class="foto">${ch}</i><i class="cheia">${ch}</i>${ch}`; d.style.color = 'transparent';
    nomeEl.appendChild(d);
    return { d, ch, i, w, dup, foto: d.children[0], cheia: d.children[1] };
  });
let F = 100, X = [], WD = [];
function medeNome() {
  F = Math.min(innerWidth * .155, innerHeight * .27);
  const m = document.createElement('div'); m.style.cssText = `position:absolute;visibility:hidden;font-family:Jack;font-size:${F}px;line-height:1;white-space:pre`;
  m.innerHTML = 'MARATU'.split('').map(c => `<span>${c}</span>`).join(''); nomeEl.appendChild(m);
  X = [...m.children].map(s => s.offsetLeft); WD = [...m.children].map(s => s.offsetWidth); m.remove();
  const wMar = X[2] + WD[2] - X[0], wAr = X[5] + WD[5] - X[1];
  LETRAS.forEach(L => {
    L.d.style.fontSize = F + 'px'; L.d.style.width = WD[L.i] + 'px'; L.d.style.height = F + 'px';
    const fx = L.w === 'mar' ? { im: 'mr-mar', h: Math.max(F * 1.7, (wMar + 240) / 2), x0: X[0], ww: wMar } : { im: 'mr-aratu', h: Math.max(F * 3.1, (wAr + 40) / 1.5), x0: X[1], ww: wAr };
    L.foto.style.backgroundImage = `url(/portfolio/img/${fx.im}.webp)`;
    L.foto.style.backgroundSize = `auto ${fx.h}px`;
    L.foto.dataset.bx = -(X[L.i] - fx.x0) - (fx.h * (L.w === 'mar' ? 2 : 1.5) - fx.ww) / 2;
    L.foto.dataset.by = -(fx.h - F) / 2;
    L.cheia.style.color = L.i <= 2 && L.w === 'mar' ? SERGIPE : LARANJA;
  });
}
function quadroNome() {
  const p = progresso(nomeSec), W = innerWidth, H = innerHeight;
  const wF = X[5] + WD[5] - X[0], L0 = (W - wF) / 2, wMar = X[2] + WD[2] - X[0];
  const sM = Math.min(2.1, W * .78 / wMar, H * .5 / F);
  const kIn = clamp(p / .1), kEnc = eio(clamp((p - .28) / .12)), kAnda = clamp((p - .32) / .22), kJunta = eio(clamp((p - .63) / .1));
  const kCheia = eio(clamp((p - .55) / .07)), kLogo = eio(clamp((p - .74) / .1));
  const y1 = H * .47 - F * 1.08, y2 = H * .47 + F * .02, yJ = H * .46 - F / 2;
  LETRAS.forEach((L, n) => {
    let x, y, s = 1, op = 1;
    const xf = L0 + X[L.i];
    if (L.w === 'mar') {
      const xBig = (W - wMar * sM) / 2 + (X[L.i] - X[0]) * sM, yBig = H * .44 - F * sM / 2;
      const kk = eout(clamp(kIn * 1.6 - n * .2));
      x = lerp(xBig, xf, kEnc); y = lerp(yBig + (1 - kk) * H * .3, y1, kEnc); s = lerp(sM, 1, kEnc); op = kk;
      y = lerp(y, yJ, kJunta);
    } else {
      // o aratu chega de lado, em passinhos
      const passo = kAnda * 5, sub = passo - Math.floor(passo), andou = Math.floor(passo) + eio(sub);
      const off = (1 - andou / 5) * (W - L0 - X[1] + 40);
      x = xf + off; y = y2 - (kAnda < 1 ? Math.abs(Math.sin(sub * Math.PI)) * F * .06 : 0);
      y = lerp(y, yJ, kJunta);
      op = kAnda > 0 ? 1 : 0;
      if (L.dup) op *= 1 - clamp((kJunta - .85) / .15);
    }
    op *= 1 - kLogo;
    L.d.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
    L.d.style.opacity = op.toFixed(3);
    const deriva = L.w === 'mar' ? Math.sin(p * 9) * 30 + (p - .2) * 260 : 0;
    L.foto.style.backgroundPosition = `${(+L.foto.dataset.bx + deriva).toFixed(1)}px ${L.foto.dataset.by}px`;
    L.foto.style.opacity = (1 - kCheia).toFixed(3); L.cheia.style.opacity = kCheia.toFixed(3);
  });
  logoN.style.opacity = kLogo.toFixed(3); estN.style.opacity = kLogo.toFixed(3);
  logoN.style.transform = `translate(-50%,-50%) scale(${(1.04 - kLogo * .04).toFixed(4)})`;
}

/* ---------- 3. paleta: os arcos sobem e a cor sobe como maré ---------- */
const palSec = $('.mr-paleta'), arcos = [...document.querySelectorAll('.mr-arco')], arcosBox = $('.mr-arcos');
const ALT = [70, 84, 62, 78, 74, 58];
arcos.forEach((a, i) => a.style.setProperty('--h', ALT[i] + '%'));
function quadroPaleta() {
  const p = progresso(palSec);
  arcos.forEach((a, i) => {
    const k = eout(clamp((p - i * .045) / .26)), m = eio(clamp((p - .34 - i * .05) / .2));
    a.style.transform = `translateY(${((1 - k) * 105).toFixed(2)}%)`;
    a.style.setProperty('--m', ((1 - m) * 100).toFixed(1) + '%');
    a.style.setProperty('--t', clamp(m * 1.4 - .3).toFixed(3));
    a.querySelector('img').style.transform = `translateY(${((p - .5) * 8).toFixed(2)}%) scale(1.12)`;
  });
  arcosBox.classList.toggle('pronto', p > .72);
}

/* ---------- 4. pôsteres em roda ---------- */
const posSec = $('.mr-posters'), posters = [...document.querySelectorAll('.mr-poster')], pnum = $('#mr-pnum'), pnome = $('#mr-pnome');
let ultP = -1;
function quadroPosters() {
  const p = progresso(posSec), n = posters.length, bruto = clamp(p * 1.06 - .03) * (n - 1);
  const c = Math.floor(bruto) + eio(bruto - Math.floor(bruto));
  const W = innerWidth, passo = Math.min(W * .26, 380), mx = (mouse.x / W - .5), my = (mouse.y / innerHeight - .5);
  posters.forEach((f, j) => {
    const d = j - c, ad = Math.abs(d), sg = Math.sign(d);
    const x = sg * (ad < 1 ? ad * passo : passo + (ad - 1) * passo * .42);
    const z = -Math.min(ad, 4) * 220, ry = -clamp(d, -1, 1) * 42 + (ad < .5 ? mx * 10 : 0), rx = ad < .5 ? -my * 8 : 0;
    f.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
    f.style.zIndex = 100 - Math.round(ad * 10);
    f.style.opacity = clamp(4.2 - ad).toFixed(3);
    f.style.filter = `brightness(${(1 - Math.min(ad, 3) * .18).toFixed(3)})`;
  });
  const atual = Math.round(c);
  if (atual !== ultP) { ultP = atual; pnum.textContent = String(atual + 1).padStart(2, '0'); pnome.textContent = posters[atual].dataset.nome; }
}

/* ---------- 5. o site ao vivo: a rolagem daqui rola o site de verdade ---------- */
const siteSec = $('.mr-site'), tela = $('#mr-tela'), cel = $('#mr-cel');
const SITES = [{ box: tela, vista: tela.querySelector('.mr-tela__vista'), fr: tela.querySelector('iframe'), w: 1440, h: 900 },
  { box: cel, vista: cel.querySelector('.mr-cel__vista'), fr: cel.querySelector('iframe'), w: 390, h: 844 }];
function medeSite() {
  SITES.forEach(s => {
    const esc = s.vista.clientWidth / s.w;
    s.vista.style.height = (s.h * esc) + 'px';
    Object.assign(s.fr.style, { width: s.w + 'px', height: s.h + 'px', transform: `scale(${esc})` });
  });
}
function quadroSite() {
  const r = siteSec.getBoundingClientRect();
  if (!SITES[0].fr.src && r.top < innerHeight * 2) SITES.forEach(s => { s.fr.src = '/?vitrine=portfolio'; });
  const p = progresso(siteSec), H = innerHeight;
  const kT = eout(clamp(p / .14)), kC = eout(clamp((p - .06) / .14)), k = eio(clamp((p - .14) / .78));
  tela.style.transform = `translateY(-50%) translateY(${((1 - kT) * H * .7).toFixed(1)}px) rotate(${((1 - kT) * -3).toFixed(2)}deg)`;
  cel.style.transform = `translateY(-50%) translateY(${((1 - kC) * H * .9 + (p - .5) * -60).toFixed(1)}px) rotate(${((1 - kC) * 6).toFixed(2)}deg)`;
  SITES.forEach((s, i) => {
    try {
      const w = s.fr.contentWindow, d = s.fr.contentDocument; if (!d || !d.documentElement) return;
      const max = d.documentElement.scrollHeight - s.h; if (max <= 0) return;
      const alvo = Math.round(max * (i ? clamp(k * 1.08) : k));
      if (Math.abs(w.scrollY - alvo) > 1) w.scrollTo({ top: alvo, behavior: 'instant' });
    } catch (e) {}
  });
}
let relogio = 0, t0 = 0, comecou = false;
function quadro(ms) {
  if (!visivel(sec)) { t0 = ms; return; }
  const dt = Math.min(.033, (ms - t0) / 1000 || .016); t0 = ms;
  if (visivel(luasSec)) quadroLuas(ms);
  if (visivel(nomeSec) && X.length) quadroNome();
  if (visivel(palSec)) quadroPaleta();
  if (visivel(posSec)) quadroPosters();
  if (visivel(siteSec)) quadroSite();
  if (visivel(pilhaSec) && corpos.length) {
    const r = pilhaSec.getBoundingClientRect();
    if (!comecou && r.top < innerHeight * .9) comecou = true;
    if (comecou) { relogio += dt; for (const c of corpos) if (!c.vivo && relogio > c.nasce) soltar(c); lerPtr(); passo(dt / 2); passo(dt / 2); }
    sol.position.x += ((-5 + (mouse.x / innerWidth - .5) * 14) - sol.position.x) * .06;
    renderer.render(cena, cam);
  }
}
medeLuas(); medeSite();
const fonte = document.fonts.load(`100px Jack`).catch(() => {}).then(medeNome);
addEventListener('resize', () => { medeLuas(); medeNome(); medeSite(); });
// movimento reduzido: a pilha já aparece assentada
if (PF.reduzir) pronta.then(() => { corpos.forEach(c => soltar(c)); for (let k = 0; k < 900; k++) passo(1 / 120); comecou = true; relogio = 99; });
PF.registra({ id: 'maratu', cor: '#0D0D0B', pronta: Promise.all([pronta, fonte]), quadro });
