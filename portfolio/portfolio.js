// Portfólio · Raphael Nascimento · MARATU
// Ideia central: tudo chega desmontado e se monta. As letras, os objetos e o selo.
import * as THREE from 'three';
import { GLTFLoader } from '/vendor/three/GLTFLoader.js';
import { RoomEnvironment } from '/vendor/three/RoomEnvironment.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches && !new URLSearchParams(location.search).has('motion');
const toque = matchMedia('(hover: none)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t) => 1 - Math.pow(1 - clamp(t), 4);                 // expo-ish out, barato
const PALETA = ['#C8501A', '#0E3272', '#1D6E4F', '#D4960A', '#EDE6DA', '#1E1C1A', '#E07A4F', '#2E6FC4'];

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!gsap || !ScrollTrigger) document.documentElement.classList.add('sem-motion');
gsap && gsap.registerPlugin(ScrollTrigger);

/* ================= util ================= */
function partir(el) {
  // troca o texto por palavras > letras, preservando espaços
  const txt = el.textContent.trim();
  const rotulo = el.getAttribute('aria-label');
  el.textContent = '';
  if (!rotulo) { const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = txt; el.appendChild(sr); }
  txt.split(' ').forEach((p, i, arr) => {
    const w = document.createElement('span'); w.className = 'pal'; w.setAttribute('aria-hidden', 'true');
    [...p].forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); });
    el.appendChild(w);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return $$('.ch', el);
}

const loader = new GLTFLoader();
const cacheGLB = {};
function glb(nome) {
  if (!cacheGLB[nome]) cacheGLB[nome] = loader.loadAsync('/portfolio/3d/' + nome + '.glb').then((g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.castShadow = true; o.receiveShadow = true;
      o.material.side = THREE.DoubleSide;
      o.material.envMapIntensity = 0.55;
    });
    return g.scene;
  });
  return cacheGLB[nome];
}

function renderizador(el) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, toque ? 1.5 : 1.75));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(r.domElement);
  return r;
}
function adaptar(renderer, medir) {
  let soma = 0, n = 0, ant = 0;
  return (agora) => {
    if (ant) { soma += agora - ant; n++; }
    ant = agora;
    if (n < 45) return;
    const media = soma / n; soma = 0; n = 0;
    const pr = renderer.getPixelRatio();
    if (media > 20 && pr > 1.25) { renderer.setPixelRatio(Math.max(1.25, pr - 0.25)); medir(); }
  };
}
function ambiente(renderer, cena) {
  const pm = new THREE.PMREMGenerator(renderer);
  cena.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
}
function visivel(el, cb) {
  const io = new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: '120px' });
  io.observe(el);
}

/* ================= rolagem suave ================= */
let lenis = null;
if (gsap && !reduzir && window.Lenis) {
  lenis = new Lenis({ lerp: 0.13, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const alvo = $(a.getAttribute('href')); if (!alvo) return;
    e.preventDefault(); lenis.scrollTo(alvo, { duration: 1.6 });
  }));
}

/* ================= cursor ================= */
const cursor = $('#cursor'), cursorTxt = $('#cursor-txt');
const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.nx = (e.clientX / innerWidth) * 2 - 1; mouse.ny = -(e.clientY / innerHeight) * 2 + 1;
}, { passive: true });
if (!toque && gsap) {
  const cx = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' }), cy = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', () => { cursor.style.opacity = 1; cx(mouse.x); cy(mouse.y); }, { passive: true });
  const rotulo = (el) => el.closest('[data-cursor]')?.dataset.cursor
    || (el.closest('.col, .ilustra__card') ? 'ver' : '');
  addEventListener('pointerover', (e) => {
    const t = rotulo(e.target);
    cursor.classList.toggle('is-grande', !!t); cursorTxt.textContent = t || '';
  });
}

/* ================= botões magnéticos ================= */
if (!toque && gsap) $$('[data-magnetico]').forEach((b) => {
  const mx = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' }), my = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * 0.35); my((e.clientY - r.top - r.height / 2) * 0.35); });
  b.addEventListener('pointerleave', () => { mx(0); my(0); });
});

/* ================= cor do topo conforme o fundo ================= */
const topo = $('#topo');
function corTopo() {
  let escuro = false;
  for (const s of $$('[data-tema]')) {
    const r = s.getBoundingClientRect();
    if (r.top <= 36 && r.bottom >= 36) escuro = s.dataset.tema === 'escuro';
  }
  topo.classList.toggle('is-claro', escuro);
}
let topoPedido = false;
addEventListener('scroll', () => { if (!topoPedido) { topoPedido = true; requestAnimationFrame(() => { topoPedido = false; corTopo(); }); } }, { passive: true });

/* ================= hora de Aracaju ================= */
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
const horaTeste = new URLSearchParams(location.search).get('hora');
const horaAju = () => {
  if (horaTeste) { const [hh, mm] = horaTeste.split(':').map(Number); return { h: hh, m: mm, s: 0 }; }
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Maceio', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }).formatToParts(new Date());
  const g = (t) => +p.find((x) => x.type === t).value;
  return { h: g('hour') % 24, m: g('minute'), s: g('second') };
};
const relogioTxt = () => { $('#hora-aju').textContent = fmtHora.format(new Date()); };
relogioTxt(); setInterval(relogioTxt, 15000);

/* ================= letras que se montam ================= */
function montarTitulos() {
  $$('[data-montar]').forEach((el) => {
    const chs = partir(el);
    if (!gsap || reduzir) return;
    chs.forEach((c) => {
      gsap.set(c, {
        x: gsap.utils.random(-220, 220), y: gsap.utils.random(-160, 160),
        rotation: gsap.utils.random(-120, 120), opacity: 0, scale: gsap.utils.random(0.4, 1.6),
      });
    });
    gsap.to(chs, {
      x: 0, y: 0, rotation: 0, opacity: 1, scale: 1, ease: 'expo.out', stagger: { each: 0.02, from: 'random' },
      scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 42%', scrub: 0.8 },
    });
  });
}

/* ================= ABERTURA: peças com física ================= */
async function abertura() {
  const el = $('#palco-hero'); const hero = $('.hero');
  const renderer = renderizador(el);
  const cena = new THREE.Scene(); ambiente(renderer, cena);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 0, 14);
  cena.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7a66, 0.9));
  const sol = new THREE.DirectionalLight(0xffffff, 2.4); sol.position.set(-5, 9, 7); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 });
  sol.shadow.radius = 4; sol.shadow.bias = -0.0005; cena.add(sol);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.ShadowMaterial({ opacity: 0.16 }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; cena.add(chao);

  let W = 1, H = 1, meiaA = 1, meiaL = 1, pisoY = -3, xMin = -5, xMax = 5;
  const raio = toque ? [0.32, 0.46] : [0.42, 0.62];
  function medir() {
    W = el.clientWidth; H = el.clientHeight; renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix();
    meiaA = Math.tan(THREE.MathUtils.degToRad(15)) * 14; meiaL = meiaA * cam.aspect;
    // o chão encosta no texto de baixo: no celular acima do lema, no desktop no pé da tela
    const pe = $('.hero__pe').getBoundingClientRect(), hr = hero.getBoundingClientRect();
    const yTela = W < 700 ? pe.top - hr.top - 26 : H - 18;
    pisoY = meiaA - (yTela / H) * 2 * meiaA;
    chao.position.y = pisoY;
    xMin = W < 700 ? -meiaL + 0.2 : -meiaL * 0.1; xMax = meiaL - 0.2;
  }
  medir(); addEventListener('resize', medir);

  const nomes = ['chaveiro-carranca', 'chaveiro-relogio', 'chaveiro-arcos', 'chaveiro-tag', 'aratu'];
  const modelos = await Promise.all(nomes.map(glb));
  const N = toque ? 15 : 28;
  const corpos = [];
  for (let i = 0; i < N; i++) {
    const base = modelos[i % modelos.length];
    const obj = base.clone(true);
    const cor = new THREE.Color(PALETA[i % PALETA.length]);
    obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = cor; o.material.roughness = 0.62; } });
    // centra e normaliza pelo raio da esfera envolvente
    const caixa = new THREE.Box3().setFromObject(obj), esf = caixa.getBoundingSphere(new THREE.Sphere());
    const r = THREE.MathUtils.lerp(raio[0], raio[1], Math.random()) * (nomes[i % nomes.length] === 'aratu' ? 1.25 : 1);
    const pivo = new THREE.Group(); obj.position.sub(esf.center); obj.scale.setScalar(1); pivo.add(obj);
    pivo.scale.setScalar(r / esf.radius);
    pivo.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    pivo.visible = false; cena.add(pivo);
    corpos.push({ g: pivo, r: r * 0.82, p: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3(), nasce: 0.15 + i * 0.075, vivo: false });
  }
  function soltar(c) {
    c.p.set(THREE.MathUtils.lerp(xMin + 0.5, xMax - 0.5, Math.random()), meiaA + 1 + Math.random() * 3, (Math.random() - 0.5) * 1.2);
    c.v.set((Math.random() - 0.5) * 2, -2 - Math.random() * 3, 0); c.w.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
    c.vivo = true; c.g.visible = true;
  }

  // ponteiro no plano z=0
  const ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ptr = new THREE.Vector3(), ptrAnt = new THREE.Vector3(), ptrV = new THREE.Vector3();
  let ptrAtivo = false;
  function lerPtr(e) {
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam); ray.ray.intersectPlane(plano, ptr); ptrAtivo = true;
  }
  hero.addEventListener('pointermove', lerPtr, { passive: true });
  hero.addEventListener('pointerleave', () => { ptrAtivo = false; });
  // clique: quebra de expectativa, tudo pula
  hero.addEventListener('pointerdown', (e) => {
    lerPtr(e);
    corpos.forEach((c) => {
      if (!c.vivo) return;
      const d = c.p.clone().sub(ptr); const dist = Math.max(0.6, d.length());
      c.v.add(d.normalize().multiplyScalar(9 / dist)).add(new THREE.Vector3(0, 7 + Math.random() * 5, 0));
      c.w.set(Math.random() * 16 - 8, Math.random() * 16 - 8, Math.random() * 16 - 8);
    });
  });

  const G = -22, dq = new THREE.Quaternion(), tmp = new THREE.Vector3();
  function passo(dt) {
    ptrV.copy(ptr).sub(ptrAnt).divideScalar(Math.max(dt, 1e-3)); ptrAnt.copy(ptr);
    for (const c of corpos) {
      if (!c.vivo) continue;
      c.v.y += G * dt; c.p.addScaledVector(c.v, dt);
      if (c.p.y - c.r < pisoY) {
        c.p.y = pisoY + c.r; if (c.v.y < 0) c.v.y *= -0.32;
        c.v.x *= 0.93; c.v.z *= 0.93;
        c.w.lerp(tmp.set(c.v.z / c.r, c.w.y * 0.9, -c.v.x / c.r), 0.3);
      }
      if (c.p.x - c.r < xMin) { c.p.x = xMin + c.r; c.v.x = Math.abs(c.v.x) * 0.4; }
      if (c.p.x + c.r > xMax) { c.p.x = xMax - c.r; c.v.x = -Math.abs(c.v.x) * 0.4; }
      if (Math.abs(c.p.z) > 0.7) { c.p.z = Math.sign(c.p.z) * 0.7; c.v.z *= -0.3; }
      if (ptrAtivo) {
        const d = tmp.copy(c.p).sub(ptr); d.z = 0; const dist = d.length(), lim = c.r + 0.75;
        if (dist < lim && dist > 1e-4) {
          d.divideScalar(dist);
          c.p.addScaledVector(d, (lim - dist) * 0.5);
          c.v.addScaledVector(d, 3 + Math.min(14, ptrV.length() * 0.35));
          c.w.x += (Math.random() - 0.5) * 6; c.w.z += (Math.random() - 0.5) * 6;
        }
      }
    }
    for (let i = 0; i < corpos.length; i++) {
      const a = corpos[i]; if (!a.vivo) continue;
      for (let j = i + 1; j < corpos.length; j++) {
        const b = corpos[j]; if (!b.vivo) continue;
        const d = tmp.copy(b.p).sub(a.p); const dist = d.length(), min = a.r + b.r;
        if (dist >= min || dist < 1e-5) continue;
        d.divideScalar(dist); const sob = (min - dist) / 2;
        a.p.addScaledVector(d, -sob); b.p.addScaledVector(d, sob);
        const vr = (b.v.x - a.v.x) * d.x + (b.v.y - a.v.y) * d.y + (b.v.z - a.v.z) * d.z;
        if (vr < 0) { const imp = -(1.25) * vr / 2; a.v.addScaledVector(d, -imp); b.v.addScaledVector(d, imp); }
        a.v.multiplyScalar(0.995); b.v.multiplyScalar(0.995);
      }
    }
    for (const c of corpos) {
      if (!c.vivo) continue;
      c.w.multiplyScalar(0.985);
      const ang = c.w.length() * dt;
      if (ang > 1e-5) { dq.setFromAxisAngle(tmp.copy(c.w).normalize(), ang); c.g.quaternion.premultiply(dq); }
      c.g.position.copy(c.p);
    }
  }

  let rodando = false, t0 = 0, relogio = 0, comecou = false, quieto = 0;
  const ajusta = adaptar(renderer, medir);
  // acorda a simulação quando o mouse mexe nas peças
  ['pointermove', 'pointerdown'].forEach((ev) => hero.addEventListener(ev, () => { quieto = 0; }, { passive: true }));
  addEventListener('resize', () => { quieto = 0; });
  function quadro(agora) {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    const dt = Math.min(0.033, (agora - t0) / 1000 || 0.016); t0 = agora;
    // a luz acompanha o mouse: a sombra corre pelo chão
    const solX = -5 + mouse.nx * 7, solMove = Math.abs(solX - sol.position.x) > 0.01;
    // tudo assentado e nada mexendo: não simula nem desenha
    if (quieto > 30 && !solMove && !ptrAtivo) return;
    if (comecou) {
      relogio += dt;
      for (const c of corpos) if (!c.vivo && relogio > c.nasce) soltar(c);
      passo(dt / 2); passo(dt / 2);
      const parado = corpos.every((c) => c.vivo && c.v.lengthSq() < 0.0004 && c.w.lengthSq() < 0.0025);
      quieto = parado ? quieto + 1 : 0;
    }
    sol.position.x += (solX - sol.position.x) * 0.06;
    renderer.render(cena, cam);
    ajusta(agora);
  }
  visivel(el, (v) => { if (v && !rodando) { rodando = true; t0 = performance.now(); requestAnimationFrame(quadro); } else if (!v) rodando = false; });

  if (reduzir) {           // sem animação: pilha já assentada
    corpos.forEach((c) => soltar(c)); for (let k = 0; k < 900; k++) passo(1 / 120);
    renderer.render(cena, cam);
  }
  return { comecar: () => { comecou = true; } };
}

/* ================= MONTAGEM: objetos explodidos que se juntam ================= */
const OBJETOS = [
  {
    id: 'relogio-farol', nome: 'Relógio Farol', fundo: '#F2B705',
    desc: 'O farol de Aracaju vira relógio de quina. Duas torres empilhadas, janelas em arco e o tempo passando por dentro delas.',
    passos: ['Módulo de baixo', 'Arcos nas janelas', 'Três cavilhas', 'Módulo de cima', 'Arcos brancos', 'Ponteiros'],
    ficha: [['13', 'peças'], ['0', 'parafusos']],
    az: 135, el: 14, giro: -0.9, zoom: 1.2,
    partes: {
      modulo_baixo: [0, [0, 0.12, 0], [0, -0.5, 0]], arco_b1: [1, [0.45, 0.25, 0.35], [0, 0, 0.5]], arco_b2: [1, [-0.35, 0.25, -0.45], [0.5, 0, 0]],
      cavilha0: [2, [0, 0.35, 0], [0, 3, 0]], cavilha1: [2, [0, 0.42, 0], [0, 3, 0]], cavilha2: [2, [0, 0.5, 0], [0, 3, 0]],
      modulo_cima: [3, [0, 0.62, 0], [0, 0.5, 0]], arco_c1: [4, [0.45, 0.3, 0.35], [0, 0, -0.5]], arco_c2: [4, [-0.35, 0.3, -0.45], [-0.5, 0, 0]],
      ponteiro_hora: [5, [0.5, 0.2, 0.2], [0, 0, 0]], ponteiro_min: [5, [0.6, 0.3, 0.25], [0, 0, 0]], ponteiro_seg: [5, [0.7, 0.4, 0.3], [0, 0, 0]], eixo: [5, [0.4, 0.1, 0.15], [0, 0, 0]],
    },
  },
  {
    id: 'porta-incenso', nome: 'Porta-incenso Arco', fundo: '#EE6A2E',
    desc: 'Um arco da Orla de Atalaia vira objeto. A vareta pende do alto e a cinza cai no pratinho.',
    passos: ['Tablado com pilares', 'Pratinho', 'Arco da Orla', 'Vareta acesa'],
    ficha: [['3', 'peças'], ['1', 'arco da Orla']],
    az: 28, el: 10, giro: 1.1,
    partes: { base: [0, [0, 0.05, 0], [0, -0.8, 0]], pratinho: [1, [0, 0.45, 0.45], [0.9, 0, 0]], arco: [2, [0, 0.7, 0], [0, 1.6, 0]] },
  },
  {
    id: 'luminaria-mangue', nome: 'Luminária Mangue', fundo: '#2F6FD8', claro: true, escuroNoFim: '#0B1430',
    desc: 'Raízes de mangue se torcem e sobem até a luz. A cúpula estriada pousa por cima e esconde o encaixe.',
    passos: ['Base torcida', 'Anel de encaixe', 'Cúpula estrela', 'Acende'],
    ficha: [['3', 'peças'], ['1', 'encaixe escondido']],
    az: 20, el: 22, giro: -1.4,
    partes: { base: [0, [0, 0.05, 0], [0, -2.4, 0]], anel: [1, [0, 0.45, 0], [0, 2, 0]], cupula: [2, [0, 0.6, 0], [0, 1.4, 0]] },
  },
  {
    id: 'cobogo', nome: 'Cobogó MARATU', fundo: '#FF8FB1',
    desc: 'Ondas e arcos da Orla vazados em bloco. O sol atravessa e a cidade aparece desenhada no chão.',
    passos: ['Ondas', 'Arcos', 'Chico', 'Círculos', 'Luz e sombra'],
    ficha: [['4', 'blocos'], ['15 cm', 'cada']],
    az: 18, el: 16, giro: 0.6, zoom: 1.3,
    partes: { bloco0: [0, [-0.5, 0.35, 0.5], [0, 0, -1.2]], bloco1: [1, [0.5, 0.35, 0.5], [0, 0, 1.2]], bloco2: [2, [-0.5, -0.1, 0.6], [1.2, 0, 0]], bloco3: [3, [0.5, -0.1, 0.6], [-1.2, 0, 0]] },
  },
];

async function montagem() {
  const sec = $('#objetos'), el = $('#palco-montagem'), trilho = $('#m-trilho');
  const FAIXA = toque ? 200 : 240;                                   // vh por objeto
  trilho.style.height = OBJETOS.length * FAIXA + 'vh';
  $('#m-total').textContent = String(OBJETOS.length).padStart(2, '0');

  const renderer = renderizador(el);
  const cena = new THREE.Scene(); ambiente(renderer, cena);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const hemi = new THREE.HemisphereLight(0xfff3e4, 0x7d705f, 0.8); cena.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 2.6); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02; sol.shadow.radius = 5;
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
  cena.add(sol, sol.target);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; cena.add(chao);
  // luz interna da luminária
  const lampada = new THREE.PointLight(0xffb15c, 0, 6, 1.6); lampada.castShadow = false; lampada.shadow.mapSize.set(1024, 1024); lampada.shadow.bias = -0.002; cena.add(lampada);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrilho(), color: 0xffb46a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  cena.add(halo);

  // fumaça do incenso
  const fumaca = criarFumaca(); cena.add(fumaca.grupo);

  let W = 1, H = 1;
  function medir() {
    W = el.clientWidth; H = el.clientHeight; renderer.setSize(W, H, false); cam.aspect = W / H;
    // desloca a imagem: no desktop o objeto vai pra direita do texto, no celular sobe
    if (W > 860) cam.setViewOffset(W, H, -W * 0.2, 0, W, H); else cam.setViewOffset(W, H, 0, H * 0.1, W, H);
    cam.updateProjectionMatrix();
  }
  medir(); addEventListener('resize', medir);

  // carrega e prepara cada objeto
  const itens = await Promise.all(OBJETOS.map(async (d) => {
    const raiz = (await glb(d.id)).clone(true);
    const grupo = new THREE.Group(); grupo.add(raiz); grupo.visible = false; cena.add(grupo);
    const caixa = new THREE.Box3().setFromObject(raiz), tam = caixa.getSize(new THREE.Vector3());
    const esc = 2.2 / Math.max(tam.x, tam.y, tam.z); raiz.scale.setScalar(esc);
    raiz.position.set(-(caixa.min.x + caixa.max.x) / 2 * esc, -caixa.min.y * esc, -(caixa.min.z + caixa.max.z) / 2 * esc);
    const altura = tam.y * esc, larg = Math.max(tam.x, tam.z) * esc;
    const partes = [];
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      const cfg = d.partes[o.name] || d.partes[o.parent?.name];
      if (!cfg) return;
      if (d.id === 'luminaria-mangue' && o.name === 'cupula') o.castShadow = false;
      partes.push({ o, passo: cfg[0], d: new THREE.Vector3(...cfg[1]).multiplyScalar(2.2 / esc), r: new THREE.Euler(...cfg[2]), p0: o.position.clone(), q0: o.quaternion.clone() });
    });
    return { d, grupo, raiz, esc, altura, larg, partes, extra: {} };
  }));

  // ponteiros do relógio: reposiciona o pivô no eixo
  const rel = itens[0];
  {
    const eixo = rel.partes.find((p) => p.o.name === 'eixo');
    // centro do eixo no espaço do próprio nó (irmão dos ponteiros); a matriz de mundo ainda não foi atualizada aqui
    eixo.o.geometry.computeBoundingBox();
    const c = eixo.o.geometry.boundingBox.getCenter(new THREE.Vector3()).add(eixo.o.position);
    ['ponteiro_hora', 'ponteiro_min', 'ponteiro_seg'].forEach((n) => {
      const p = rel.partes.find((x) => x.o.name === n);
      p.o.geometry.translate(-c.x, -c.y, -c.z); p.o.position.add(c); p.p0 = p.o.position.clone(); p.ponteiro = n;
    });
  }
  // vareta de incenso pendurada no topo do arco
  const inc = itens[1];
  {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 8), new THREE.MeshStandardMaterial({ color: 0x5a2e1a, roughness: 0.9 }));
    const brasa = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
    v.add(brasa); brasa.position.y = -0.58; v.castShadow = true;
    inc.grupo.add(v); v.position.set(0, inc.altura - 0.62, 0); v.visible = false; inc.extra.vareta = v; inc.extra.brasa = brasa;
  }

  // ---------- passos na interface ----------
  const ui = { idx: $('#m-idx'), nome: $('#m-nome'), desc: $('#m-desc'), passos: $('#m-passos'), ficha: $('#m-ficha'), barra: $('#m-barra'), camada: $('#m-camada') };
  let atual = -1;
  function trocar(i) {
    atual = i; const d = OBJETOS[i];
    itens.forEach((it, k) => { it.grupo.visible = k === i; });
    ui.idx.textContent = String(i + 1).padStart(2, '0');
    ui.nome.textContent = d.nome; ui.desc.textContent = d.desc;
    ui.passos.innerHTML = d.passos.map((p) => `<li>${p}</li>`).join('');
    ui.ficha.innerHTML = d.ficha.map(([a, b]) => `<span><b>${a}</b>${b}</span>`).join('');
    if (gsap && !reduzir) {
      const chs = partir(ui.nome);
      gsap.fromTo(chs, { yPercent: 110, rotation: 8 }, { yPercent: 0, rotation: 0, duration: 1.1, ease: 'expo.out', stagger: 0.025 });
      gsap.fromTo([ui.desc, ui.passos], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.1 });
    }
    sec.style.backgroundColor = d.fundo; if (typeof ult !== 'undefined') ult.bg = d.fundo;
  }

  // ---------- estado por rolagem ----------
  let prog = 0;
  if (ScrollTrigger) ScrollTrigger.create({ trigger: trilho, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { prog = s.progress; } });

  const alvo = new THREE.Vector3(), luzAlvo = new THREE.Vector3();
  let rodando = false, tAnt = 0, tempo = 0;
  const ajusta = adaptar(renderer, medir);
  const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler();
  const ult = { prog: -1, nx: 9, ny: 9, ativo: -1, camada: '', p: '', ficha: null, bg: '', escuro: null, seg: -1 };
  function quadro(agora) {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (agora - tAnt) / 1000 || 0.016); tAnt = agora; tempo += dt;
    // nada mudou (rolagem, mouse, luz, efeito vivo): pula o quadro inteiro
    const seg = new Date().getSeconds();
    const vivo = ult.vivo || sol.position.distanceToSquared(luzAlvo) > 0.0004;
    if (prog === ult.prog && mouse.nx === ult.nx && mouse.ny === ult.ny && !vivo && seg === ult.seg) return;
    ult.prog = prog; ult.nx = mouse.nx; ult.ny = mouse.ny; ult.seg = seg;
    const total = OBJETOS.length, pos = clamp(prog) * total;
    const i = Math.min(total - 1, Math.floor(pos)), local = clamp(pos - i);
    if (i !== atual) trocar(i);
    const it = itens[i], d = it.d, n = d.passos.length;
    // 0–0.78: monta; 0.78–1: efeito final com o objeto pronto
    const t = clamp(local / 0.78 + 0.05);
    const pecasPassos = Math.max(...it.partes.map((p) => p.passo)) + 1;
    // cada peça só aparece na sua etapa: surge pequena, cresce e voa até o lugar
    it.partes.forEach((p) => {
      const ini = p.passo / pecasPassos, k = (t - ini) / (1 / pecasPassos) * 1.05;
      const e = suave(k), cresce = suave(k * 2.4);
      p.o.visible = k > 0;
      if (!p.centro) { p.o.geometry.computeBoundingBox(); p.centro = p.o.geometry.boundingBox.getCenter(new THREE.Vector3()); }
      p.o.scale.setScalar(Math.max(0.001, cresce));
      p.o.position.copy(p.p0).addScaledVector(p.d, 1 - e).addScaledVector(p.centro, 1 - cresce);
      p.o.quaternion.copy(p.q0); if (e < 1) p.o.quaternion.multiply(qTmp.setFromEuler(eTmp.set(p.r.x * (1 - e), p.r.y * (1 - e), p.r.z * (1 - e))));
    });
    // passo em destaque e barra de "impressão"
    const ativo = local >= 0.8 ? n - 1 : Math.min(n - 1, Math.floor(t * pecasPassos));
    if (ativo !== ult.ativo) { ult.ativo = ativo; [...ui.passos.children].forEach((li, k) => { li.classList.toggle('is-agora', k === ativo); li.classList.toggle('is-feito', k < ativo); }); }
    const pTxt = local.toFixed(3); if (pTxt !== ult.p) { ult.p = pTxt; ui.barra.style.setProperty('--p', pTxt); }
    const cTxt = local >= 0.78 ? 'montado' : 'camada ' + String(Math.round(t * 400)).padStart(3, '0');
    if (cTxt !== ult.camada) { ult.camada = cTxt; ui.camada.textContent = cTxt; }
    const fOn = local >= 0.78; if (fOn !== ult.ficha) { ult.ficha = fOn; ui.ficha.classList.toggle('is-on', fOn); }

    // giro do objeto: gira enquanto monta e para de frente quando fica pronto
    it.grupo.rotation.y = d.giro * (1 - suave(t)) + mouse.nx * 0.18;

    // câmera enquadra o objeto
    const dist = Math.max(it.altura, it.larg) * (W > 860 ? 2.55 : 3.7) * (1 + 0.15 * (1 - suave(t))) * (d.zoom || 1);
    const az = THREE.MathUtils.degToRad(d.az), el_ = THREE.MathUtils.degToRad(d.el + mouse.ny * 3);
    alvo.set(0, it.altura * 0.5, 0);
    cam.position.set(Math.sin(az) * Math.cos(el_) * dist, alvo.y + Math.sin(el_) * dist, Math.cos(az) * Math.cos(el_) * dist);
    cam.lookAt(alvo);

    // luz principal segue o mouse
    luzAlvo.set(-3 + mouse.nx * 6, 6 + mouse.ny * 2, 4);
    sol.position.lerp(luzAlvo, 0.08); sol.target.position.set(0, it.altura * 0.4, 0);

    // ----- efeitos finais -----
    const fim = clamp((local - 0.78) / 0.18);
    // relógio: ponteiros giram e param na hora de Aracaju
    if (d.id === 'relogio-farol') {
      const h = horaAju(), minAng = (h.m + h.s / 60) / 60 * Math.PI * 2, horAng = ((h.h % 12) + h.m / 60) / 12 * Math.PI * 2;
      const voltas = (1 - suave(fim)) * Math.PI * 6;
      it.partes.forEach((p) => {
        if (p.ponteiro === 'ponteiro_min') p.o.rotation.x = -(minAng + voltas * 1.0);
        if (p.ponteiro === 'ponteiro_hora') p.o.rotation.x = -(horAng + voltas / 12);
        if (p.ponteiro === 'ponteiro_seg') p.o.rotation.x = -(h.s / 60 * Math.PI * 2 + voltas * 3);
      });
    }
    // incenso: vareta aparece e a fumaça sobe
    if (d.id === 'porta-incenso') {
      it.extra.vareta.visible = fim > 0.02;
      it.extra.vareta.position.y = it.altura - 0.62 + (1 - suave(fim)) * 1.2;
      const ponta = it.extra.brasa.getWorldPosition(new THREE.Vector3());
      fumaca.atualizar(dt, fim > 0.4 ? ponta : null, it.grupo);
      it.extra.brasa.material.color.setHSL(0.06, 1, 0.5 + Math.sin(tempo * 7) * 0.08);
    } else fumaca.limpar();
    // luminária: o ambiente escurece e ela acende
    const lum = d.id === 'luminaria-mangue' ? suave(fim) : 0;
    lampada.intensity = lum * 9; lampada.castShadow = lum > 0; halo.material.opacity = lum * 0.55;
    if (lum > 0) {
      const top = it.altura * 0.8; lampada.position.set(0, top, 0); halo.position.set(0, top, 0); halo.scale.setScalar(1.6 + Math.sin(tempo * 3) * 0.04);
    }
    hemi.intensity = 0.8 - lum * 0.62; sol.intensity = 2.6 - lum * 2.3; renderer.toneMappingExposure = 1.05 + lum * 0.15;
    chao.material.opacity = (0.06 + 0.14 * suave(t)) + lum * 0.25;
    const escuro = !!d.claro || lum > 0.5;
    if (escuro !== ult.escuro) { ult.escuro = escuro; sec.classList.toggle('is-escuro', escuro); sec.dataset.tema = escuro ? 'escuro' : 'claro'; }
    let bg = lum > 0 ? misturar(d.fundo, d.escuroNoFim, lum) : d.fundo;
    // placa: balança no prego
    // cobogó: o sol atravessa e a sombra corre no chão
    if (d.id === 'cobogo' && fim > 0) {
      const a = THREE.MathUtils.lerp(-1.2, 1.2, fim);
      sol.position.set(Math.sin(a) * 6, 2.2 + Math.cos(a) * 1.2, -5); sol.intensity = 3.2;
      chao.material.opacity = 0.32;
      bg = misturar(d.fundo, '#FFC857', Math.sin(fim * Math.PI) * 0.7);
    }
    if (bg !== ult.bg) { ult.bg = bg; sec.style.backgroundColor = bg; }
    // efeitos que se mexem sozinhos mantêm o desenho ligado
    ult.vivo = (d.id === 'relogio-farol' && fim > 0 && fim < 1) || (d.id === 'porta-incenso' && fim > 0.02) || lum > 0;
    renderer.render(cena, cam);
    ajusta(agora);
  }
  visivel(sec, (v) => { if (v && !rodando) { rodando = true; tAnt = performance.now(); requestAnimationFrame(quadro); } else if (!v) rodando = false; });
  trocar(0);
}

function misturar(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), clamp(t)).getHexString(); }
function texturaBrilho() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function criarFumaca() {
  const grupo = new THREE.Group(), mapa = texturaBrilho(), parts = [];
  for (let i = 0; i < 60; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mapa, color: 0x8f877c, transparent: true, opacity: 0, depthWrite: false }));
    s.userData = { vida: -Math.random() * 3, v: new THREE.Vector3(), dur: 2.6 + Math.random() * 1.4 }; grupo.add(s); parts.push(s);
  }
  return {
    grupo,
    limpar() { parts.forEach((s) => { s.material.opacity = 0; s.userData.ok = false; s.userData.vida = -Math.random() * 3; }); },
    atualizar(dt, origem) {
      parts.forEach((s) => {
        const u = s.userData; u.vida += dt;
        if (u.vida < 0) { s.material.opacity = 0; return; }
        if (u.vida > u.dur || !s.userData.ok) {
          if (!origem) { s.material.opacity = Math.max(0, s.material.opacity - dt); s.userData.ok = false; return; }
          s.position.copy(origem); u.vida = 0; u.ok = true; u.v.set((Math.random() - 0.5) * 0.05, 0.28 + Math.random() * 0.12, (Math.random() - 0.5) * 0.05);
        }
        const k = u.vida / u.dur;
        s.position.addScaledVector(u.v, dt); s.position.x += Math.sin(u.vida * 2.2 + s.id) * 0.0025;
        s.scale.setScalar(0.08 + k * 0.6); s.material.opacity = Math.sin(k * Math.PI) * 0.5;
      });
    },
  };
}

/* ================= MANIFESTO ================= */
function manifesto() {
  const linhas = $$('#manifesto .mf');
  const chs = linhas.map(partir);
  $$('.pal', linhas[2]).forEach((w) => { if (/mão/.test(w.textContent)) w.style.color = 'var(--laranja)'; });
  const pecas = $$('.manifesto__pecas span');
  if (!gsap || reduzir) { pecas.forEach((p) => p.classList.add('is-on')); return; }
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.manifesto', start: 'top top', end: 'bottom bottom', scrub: 0.6,
    onUpdate: (s) => pecas.forEach((p, k) => p.classList.toggle('is-on', s.progress > 0.12 + k * 0.16)) } });
  // cada frase chega solta e se monta; a anterior apaga um pouco quando a próxima entra
  chs.forEach((c, i) => {
    if (i > 0) tl.to(linhas[i - 1], { opacity: 0.28, duration: 0.4 }, '<0.2');
    tl.fromTo(c, { x: () => gsap.utils.random(-300, 300), y: () => gsap.utils.random(-260, 260), rotation: () => gsap.utils.random(-160, 160), opacity: 0 },
      { x: 0, y: 0, rotation: 0, opacity: 1, ease: 'expo.out', stagger: { each: 0.015, from: 'random' }, duration: 1 });
  });
  tl.to(linhas.slice(0, 2), { opacity: 1, duration: 0.5 }, '+=0.2');
  tl.to({}, { duration: 0.3 });
}

/* ================= MARCAS: colagem com profundidade ================= */
function marcas() {
  if (!gsap || reduzir || innerWidth < 760) return;
  $$('.cap').forEach((cap) => {
    $$('.col', cap).forEach((f) => {
      const v = +f.dataset.vel || 0;
      if (innerWidth > 860) gsap.fromTo(f, { y: 160 * v + 80 }, { y: -260 * v, ease: 'none', scrollTrigger: { trigger: cap, start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo(f, { clipPath: 'inset(100% 0% 0% 0% round 16px)' }, { clipPath: 'inset(0% 0% 0% 0% round 16px)', ease: 'expo.out', duration: 1.4, scrollTrigger: { trigger: f, start: 'top 90%' } });
      const img = f.querySelector('img'); gsap.fromTo(img, { scale: 1.25 }, { scale: 1, ease: 'expo.out', duration: 1.8, scrollTrigger: { trigger: f, start: 'top 90%' } });
    });
    const logo = $('.cap__logo .logo', cap);
    if (logo) gsap.fromTo(logo, { yPercent: 30, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { yPercent: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: cap, start: 'top 70%' } });
    gsap.fromTo($('.cap__info', cap), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', delay: 0.15, scrollTrigger: { trigger: cap, start: 'top 70%' } });
  });
}

/* ================= SELO: gira como moeda e o código se embaralha ================= */
function selo() {
  const moeda = $('#selo-moeda'), cod = $('#selo-cod');
  const gRb = $('#mrtRb'), gSp = $('#mrtSpec'), rbr = $('#mrt-rbr');
  const ALF = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  const final = () => Array.from({ length: 10 }, () => ALF[Math.floor(Math.random() * ALF.length)]).join('');
  let alvoCod = final(), embaralhando = 0;
  const fmt = (s) => 'maratu.com.br/a/' + s;
  cod.textContent = fmt(alvoCod);
  function embaralhar() {
    alvoCod = final(); embaralhando = 1; const t0 = performance.now();
    (function f(t) {
      const k = clamp((t - t0) / 1100);
      const s = alvoCod.split('').map((c, i) => (i / 10 < k ? c : ALF[Math.floor(Math.random() * ALF.length)])).join('');
      cod.textContent = fmt(s); if (k < 1) requestAnimationFrame(f); else embaralhando = 0;
    })(t0);
  }
  let ry = 0, rx = 0;
  function brilho(p) {
    const mx = mouse.nx * 18, my = mouse.ny * 14;
    gRb.setAttribute('gradientTransform', `translate(${(p * 260 + mx * 6).toFixed(1)},${(-my * 6).toFixed(1)})`);
    gSp.setAttribute('gradientTransform', `translate(${(-p * 300 - mx * 7).toFixed(1)},${(my * 7).toFixed(1)})`);
    rbr.setAttribute('opacity', (0.45 + Math.abs(Math.sin(p * Math.PI * 3)) * 0.4).toFixed(2));
  }
  if (!gsap || reduzir) { brilho(0.3); return; }
  let ultimo = 0;
  ScrollTrigger.create({
    trigger: '.selo', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (s) => {
      const p = s.progress, e = suave(p * 1.15);
      ry = (1 - e) * 1080; rx = Math.sin(p * Math.PI) * 12;
      moeda.style.transform = `rotateX(${(rx + mouse.ny * 8).toFixed(2)}deg) rotateY(${(ry + mouse.nx * 14).toFixed(2)}deg) scale(${(0.35 + e * 0.65).toFixed(3)})`;
      brilho(p);
      if (p > 0.62 && ultimo <= 0.62 && !embaralhando) embaralhar();
      ultimo = p;
    },
  });
  addEventListener('pointermove', () => {
    if (!moeda.getBoundingClientRect().top || ry > 1) return;
    moeda.style.transform = `rotateX(${(rx + mouse.ny * 8).toFixed(2)}deg) rotateY(${(mouse.nx * 14).toFixed(2)}deg) scale(1)`;
    brilho(1);
  }, { passive: true });
  $('#selo-palco').addEventListener('click', embaralhar);
  gsap.fromTo('.selo__pe', { y: 40, opacity: 0 }, { y: 0, opacity: 1, ease: 'expo.out', scrollTrigger: { trigger: '.selo', start: '55% bottom', end: '75% bottom', scrub: 0.6 } });
}

/* ================= ILUSTRAÇÃO: sketchbook que folheia ================= */
function ilustra() {
  const livro = $('#livro'), folhas = $$('.folha', livro), N = folhas.length;
  function pintar(p) {
    // p vai de 0 a N: cada unidade vira uma folha
    livro.classList.toggle('is-aberto', p > 0.15);
    folhas.forEach((f, i) => {
      const k = clamp(p - i), ang = -180 * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      // leque: folhas ainda fechadas abrem um pouco, como no caderno real
      const leque = k === 0 ? Math.max(0, 6 - (i - p) * 2.2) : 0;
      const z = k < 0.5 ? (N - i) * 0.6 : i * 0.6;
      f.style.transform = `translateZ(${z}px) rotateY(${(ang - leque).toFixed(2)}deg)`;
      f.style.zIndex = k < 0.5 ? N - i : i + 1;
      f.style.setProperty('--sombra', (Math.sin(k * Math.PI) * 0.35).toFixed(3));
    });
  }
  pintar(0);
  if (!gsap || reduzir) { pintar(1); return; }
  ScrollTrigger.create({ trigger: '.ilustra', start: 'top top', end: 'bottom bottom', scrub: 0.6, onUpdate: (s) => pintar(s.progress * (N + 0.2)) });
  // o caderno inclina de leve com o mouse
  if (!toque) addEventListener('pointermove', () => { livro.style.transform = `rotateY(${(mouse.nx * 6).toFixed(2)}deg) rotateX(${(mouse.ny * 3).toFixed(2)}deg)`; }, { passive: true });
}

/* ================= números ================= */
function numeros() {
  $$('[data-contar]').forEach((b) => {
    const fim = +b.dataset.contar, suf = b.dataset.suf || '';
    if (!gsap || reduzir) { b.textContent = fim + suf; return; }
    const o = { v: 0 };
    gsap.to(o, { v: fim, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: b, start: 'top 85%' }, onUpdate: () => { b.textContent = Math.round(o.v) + suf; } });
  });
  if (gsap && !reduzir) $$('.trajetoria li, .tec__card, .sobre__texto p').forEach((li) => gsap.fromTo(li, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 90%' } }));
}

/* ================= CARREGAMENTO + início ================= */
async function iniciar() {
  const carga = $('#carga');
  // trava de segurança: aconteça o que acontecer, a página aparece
  setTimeout(() => { if (!document.documentElement.classList.contains('pronto')) { document.documentElement.classList.add('pronto'); lenis && lenis.start(); } }, 9000);
  const heroChs = $$('.hero__linha').map(partir);
  montarTitulos(); manifesto(); marcas(); selo(); ilustra(); numeros(); corTopo();

  if (!gsap || reduzir) {
    document.documentElement.classList.add('pronto');
    const h = await abertura().catch(() => null); h && h.comecar(); montagem().catch(() => {}); return;
  }
  lenis && lenis.stop(); scrollTo(0, 0);
  gsap.set(heroChs.flat(), { yPercent: 115, rotation: 6 });
  gsap.set(['.hero__topo', '.hero__pe', '.topo'], { opacity: 0, y: 20 });

  const tinta = $('#carga-tinta'), num = $('#carga-num'), bico = $('#carga-bico');
  const estado = { real: 0, mostrado: 0 };
  const heroPronto = abertura().then((h) => { estado.real = 1; return h; }).catch(() => { estado.real = 1; return null; });
  const minimo = 1700, t0 = performance.now();
  const CAM = 240;
  await new Promise((ok) => {
    (function f(t) {
      const porTempo = clamp((t - t0) / minimo);
      const alvo = Math.min(porTempo, 0.86 + estado.real * 0.14);
      estado.mostrado += (alvo - estado.mostrado) * 0.12;
      if (alvo >= 1 && estado.mostrado > 0.995) estado.mostrado = 1;
      const camada = Math.round(estado.mostrado * CAM);
      num.textContent = String(camada).padStart(3, '0');
      // a tinta sobe em degraus de 1/24 da altura: cada degrau é uma faixa de camadas
      const degrau = Math.floor(estado.mostrado * 24) / 24;
      tinta.style.clipPath = `inset(${(100 - degrau * 100).toFixed(2)}% 0 0 0)`;
      bico.style.opacity = estado.mostrado < 1 ? 1 : 0;
      bico.style.bottom = (degrau * 100).toFixed(2) + '%';
      bico.style.left = (Math.abs(Math.sin(t / 220)) * 96).toFixed(1) + '%';
      if (estado.mostrado >= 1 || t - t0 > 7000) ok(); else requestAnimationFrame(f);
    })(t0);
  });
  const hero = await Promise.race([heroPronto, new Promise((ok) => setTimeout(() => ok(null), 4000))]);
  const tl = gsap.timeline();
  tl.to(carga, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' })
    .add(() => { document.documentElement.classList.add('pronto'); lenis && lenis.start(); hero && hero.comecar(); })
    .to(heroChs.flat(), { yPercent: 0, rotation: 0, duration: 1.2, ease: 'expo.out', stagger: 0.035 }, '-=0.35')
    .to(['.hero__topo', '.hero__pe', '.topo'], { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, '-=0.9');
  if (!hero) heroPronto.then((h) => h && h.comecar());
  montagem().then(() => ScrollTrigger.refresh()).catch(() => {});
}
iniciar();
