// 3D da peça na página /produto/<id>.
// Um botão "3D" sobre a foto troca a imagem por um palco onde a peça se monta parte por
// parte e depois gira devagar; arrastar gira à mão. three.js só carrega no clique,
// então a página continua leve para quem não usa.
const ID = location.pathname.split('/').filter(Boolean).pop();
const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;

// partes: nome do nó no GLB -> [etapa, deslocamento de onde vem (x,y,z), giro de chegada]
const RELOGIO = {
  modulo_baixo: [0, [0, 0.12, 0], [0, -0.5, 0]], arco_b1: [1, [0.45, 0.25, 0.35], [0, 0, 0.5]], arco_b2: [1, [-0.35, 0.25, -0.45], [0.5, 0, 0]],
  cavilha0: [2, [0, 0.35, 0], [0, 3, 0]], cavilha1: [2, [0, 0.42, 0], [0, 3, 0]], cavilha2: [2, [0, 0.5, 0], [0, 3, 0]],
  modulo_cima: [3, [0, 0.62, 0], [0, 0.5, 0]], arco_c1: [4, [0.45, 0.3, 0.35], [0, 0, -0.5]], arco_c2: [4, [-0.35, 0.3, -0.45], [-0.5, 0, 0]],
  ponteiro_hora: [5, [0.5, 0.2, 0.2], [0, 0, 0]], ponteiro_min: [5, [0.6, 0.3, 0.25], [0, 0, 0]], ponteiro_seg: [5, [0.7, 0.4, 0.3], [0, 0, 0]], eixo: [5, [0.4, 0.1, 0.15], [0, 0, 0]],
};
const COBOGO = { bloco0: [0, [-0.5, 0.35, 0.5], [0, 0, -1.2]], bloco1: [1, [0.5, 0.35, 0.5], [0, 0, 1.2]], bloco2: [2, [-0.5, -0.1, 0.6], [1.2, 0, 0]], bloco3: [3, [0.5, -0.1, 0.6], [-1.2, 0, 0]] };
const UM = (no, cor) => ({ glb: 'cobogo', so: no, cor, partes: { [no]: [0, [0, 0.4, 0.4], [0, 0, 1]] }, az: 10, el: 12 });
const PECAS = {
  'relogio-farol': { glb: 'relogio-farol', partes: RELOGIO, az: 135, el: 14, relogio: true },
  'kit-cobogo-praia': { glb: 'cobogo', partes: COBOGO, az: 18, el: 14, cores: { bloco0: '#A7A6A2', bloco1: '#E8C340', bloco2: '#2B4FB8', bloco3: '#C2402F' } },
  'cobogo-ondas': UM('bloco0', '#A7A6A2'),
  'cobogo-arcos': UM('bloco1', '#E8C340'),
  'cobogo-chico': UM('bloco2', '#2B4FB8'),
  'cobogo-por-do-sol': UM('bloco3', '#C2402F'),
  'carranca-chaveiro': { glb: 'chaveiro-carranca', az: 20, el: 10, cor: '#2A2A2A' },
  'arcos-chaveiro': { glb: 'chaveiro-arcos', az: 0, el: 6, cor: '#2456B4' },
  'relogio-chaveiro': { glb: 'chaveiro-relogio', az: 20, el: 10, cor: '#F07A2E' },
};
const P = PECAS[ID];
const foto = document.querySelector('.pd-foto');
if (P && foto) iniciar();

function iniciar() {
  const css = document.createElement('style');
  css.textContent = `
  .pd-foto{position:relative}
  .pd3d-btn{position:absolute;left:14px;bottom:14px;z-index:4;display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border:0;border-radius:999px;background:#0D0D0B;color:#F0ECE4;font-family:inherit;font-weight:700;font-size:.82rem;line-height:1;letter-spacing:.04em;cursor:pointer;box-shadow:0 8px 20px -8px rgba(0,0,0,.5)}
  .pd3d-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
  .pd3d-palco{position:absolute;inset:0;z-index:2;border-radius:inherit;overflow:hidden;background:radial-gradient(90% 80% at 50% 45%,#FBF8F2 0%,#E9E2D5 100%);opacity:0;transition:opacity .5s;touch-action:none;cursor:grab}
  .pd3d-palco.on{opacity:1}.pd3d-palco:active{cursor:grabbing}
  .pd3d-palco canvas{width:100%!important;height:100%!important;display:block}`;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'pd3d-btn'; btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg><span>3D</span>';
  foto.appendChild(btn);
  let palco = null, cena = null, contou = false;
  const desligar = () => { btn.setAttribute('aria-pressed', 'false'); btn.querySelector('span').textContent = '3D'; if (palco) palco.classList.remove('on'); cena && cena.then((c) => c && c.pausar()); };
  btn.addEventListener('click', async () => {
    const ligar = btn.getAttribute('aria-pressed') !== 'true';
    if (!ligar) return desligar();
    btn.setAttribute('aria-pressed', 'true'); btn.querySelector('span').textContent = 'foto';
    if (!palco) { palco = document.createElement('div'); palco.className = 'pd3d-palco'; foto.appendChild(palco); }
    requestAnimationFrame(() => palco.classList.add('on'));
    if (!cena) cena = montar(palco).catch(() => null); else cena.then((c) => c && c.reiniciar());
    const c = await cena;
    // sem WebGL, sem importmap ou sem rede: volta pra foto e some com o botão
    if (!c) { desligar(); palco.remove(); palco = null; cena = null; btn.remove(); return; }
    if (!contou && window.gtag) { contou = true; gtag('event', 'ver_3d', { produto: ID }); }
  });
  // trocar de foto na galeria volta pra foto
  document.querySelectorAll('[data-pd-foto]').forEach((t) => t.addEventListener('click', desligar));
}

async function montar(el) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('/vendor/three/GLTFLoader.js');
  const { RoomEnvironment } = await import('/vendor/three/RoomEnvironment.js');
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(r.domElement);
  const cena = new THREE.Scene();
  cena.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  cena.add(new THREE.HemisphereLight(0xfff3e4, 0x7d705f, 0.8));
  const sol = new THREE.DirectionalLight(0xffffff, 2.6); sol.position.set(-3, 6, 4); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); sol.shadow.radius = 5; sol.shadow.bias = -0.0004;
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 }); cena.add(sol);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.18 }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; cena.add(chao);

  const gltf = await new GLTFLoader().loadAsync('/portfolio/3d/' + P.glb + '.glb');
  const raiz = gltf.scene, grupo = new THREE.Group(); grupo.add(raiz); cena.add(grupo);
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    o.castShadow = true; o.material.side = THREE.DoubleSide; o.material.envMapIntensity = 0.55;
    if (P.so && o.name !== P.so) o.visible = false;
    const cor = (P.cores && P.cores[o.name]) || (P.cor && (!P.so || o.name === P.so) ? P.cor : null);
    if (cor) { o.material = o.material.clone(); o.material.color.set(cor); }
  });
  // enquadra só o que aparece
  const caixa = new THREE.Box3(); raiz.updateMatrixWorld(true);
  raiz.traverse((o) => { if (o.isMesh && o.visible) caixa.expandByObject(o); });
  const tam = caixa.getSize(new THREE.Vector3()), esc = 2.2 / Math.max(tam.x, tam.y, tam.z);
  raiz.scale.setScalar(esc);
  raiz.position.set(-(caixa.min.x + caixa.max.x) / 2 * esc, -caixa.min.y * esc, -(caixa.min.z + caixa.max.z) / 2 * esc);
  const altura = tam.y * esc, larg = Math.max(tam.x, tam.z) * esc;

  const partes = [];
  raiz.traverse((o) => {
    const cfg = o.isMesh && ((P.partes && P.partes[o.name]) || (!P.partes && [0, [0, 0.35, 0], [0, 1.6, 0]]));
    if (!cfg || !o.visible) return;
    o.geometry.computeBoundingBox();
    partes.push({ o, passo: cfg[0], d: new THREE.Vector3(...cfg[1]).multiplyScalar(2.2 / esc), r: cfg[2], p0: o.position.clone(), q0: o.quaternion.clone(), c: o.geometry.boundingBox.getCenter(new THREE.Vector3()) });
  });
  const etapas = partes.length ? Math.max(...partes.map((p) => p.passo)) + 1 : 1;
  // ponteiros giram em volta do eixo
  if (P.relogio) {
    const eixo = partes.find((p) => p.o.name === 'eixo');
    if (eixo) {
      const c = eixo.c.clone().add(eixo.o.position);
      partes.filter((p) => /^ponteiro_/.test(p.o.name)).forEach((p) => { p.o.geometry.translate(-c.x, -c.y, -c.z); p.o.position.add(c); p.p0 = p.o.position.clone(); p.c.sub(c); p.ponteiro = true; });
    }
  }

  const suave = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  let t0 = performance.now(), rodando = true, yaw = 0, pitch = 0, arrasto = null, ultimoToque = 0;
  const DUR = reduzir ? 1 : 2600;
  function medir() { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  medir(); new ResizeObserver(medir).observe(el);
  el.addEventListener('pointerdown', (ev) => { arrasto = { x: ev.clientX, y: ev.clientY, yaw, pitch }; el.setPointerCapture(ev.pointerId); });
  el.addEventListener('pointermove', (ev) => { if (!arrasto) return; yaw = arrasto.yaw + (ev.clientX - arrasto.x) * 0.01; pitch = Math.max(-0.5, Math.min(0.6, arrasto.pitch + (ev.clientY - arrasto.y) * 0.006)); ultimoToque = performance.now(); });
  el.addEventListener('pointerup', () => { arrasto = null; });

  function quadro(agora) {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    const t = (agora - t0) / DUR;
    partes.forEach((p) => {
      const k = (t - p.passo / etapas) * etapas * 1.05, a = suave(k), cresce = suave(k * 2.4);
      p.o.visible = k > 0;
      p.o.scale.setScalar(Math.max(0.001, cresce));
      p.o.position.copy(p.p0).addScaledVector(p.d, 1 - a).addScaledVector(p.c, 1 - cresce);
      p.o.quaternion.copy(p.q0); if (a < 1) p.o.quaternion.multiply(q.setFromEuler(e.set(p.r[0] * (1 - a), p.r[1] * (1 - a), p.r[2] * (1 - a))));
      if (p.ponteiro && a >= 1) {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Maceio' }));
        const ang = p.o.name === 'ponteiro_hora' ? ((d.getHours() % 12) + d.getMinutes() / 60) / 12 : p.o.name === 'ponteiro_min' ? (d.getMinutes() + d.getSeconds() / 60) / 60 : d.getSeconds() / 60;
        p.o.rotation.x = -ang * Math.PI * 2;
      }
    });
    // sem tocar há 2 s: gira sozinho, devagar
    if (!arrasto && agora - ultimoToque > 2000 && !reduzir) yaw += 0.0035;
    const az = (P.az || 0) * Math.PI / 180 + yaw, el_ = (P.el || 12) * Math.PI / 180 + pitch;
    const dist = Math.max(altura, larg) * 2.7 * (1 + 0.2 * (1 - suave(t)));
    const alvo = new THREE.Vector3(0, altura * 0.5, 0);
    cam.position.set(Math.sin(az) * Math.cos(el_) * dist, alvo.y + Math.sin(el_) * dist, Math.cos(az) * Math.cos(el_) * dist);
    cam.lookAt(alvo);
    r.render(cena, cam);
  }
  requestAnimationFrame(quadro);
  return {
    pausar() { rodando = false; },
    reiniciar() { t0 = performance.now(); if (!rodando) { rodando = true; requestAnimationFrame(quadro); } },
  };
}
