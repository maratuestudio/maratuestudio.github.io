(() => {
const { DPR, $, mouse, clamp, eio, eout, carrega, AMARELO } = PF;
/* ================= TROPICALÍSSIMA: abertura com o selo ================= */
const tSelo = (() => {
  // em camadas SVG giradas por CSS: no Safari, girar um canvas grande abre emendas no anel
  const selo = PF.selo;
  const sec = $('.t-heroi'), caixa = $('#s-svg');
  const anel = caixa.querySelector('.s-anel'), maca = caixa.querySelector('.s-maca'), amarelo = caixa.querySelector('.s-amarelo');
  sec.addEventListener('pointerdown', selo.quica);
  function quadro() {
    const H = innerHeight, r = sec.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - H));
    // o selo é fixo na tela (position: fixed): o Safari rola a página antes do JS, então nada aqui depende da rolagem pra ficar no lugar
    if (r.top >= H || r.bottom < 0 || p > .3) { caixa.style.visibility = 'hidden'; return; }
    caixa.style.visibility = 'visible';
    // o selo gira, depois encolhe e some enquanto as manchas crescem do centro
    const sai = eio(clamp((p - .15) / .1));
    const { tam, cx, cy } = selo.geo(), e = selo.estado();
    caixa.style.width = caixa.style.height = tam + 'px';
    caixa.style.transform = `translate(${cx - tam / 2}px, ${cy - tam / 2}px) scale(${1 - sai * .6})`;
    caixa.style.opacity = 1 - sai;
    anel.style.transform = `rotate(${(clamp(p / .25) * 162).toFixed(2)}deg)`;
    const amassa = `scale(${(1 + e.s * .5).toFixed(4)}, ${(1 - e.s).toFixed(4)})`;
    maca.style.transform = amassa;
    amarelo.style.transform = `translate(${(e.DX * tam + e.x).toFixed(2)}px, ${e.y.toFixed(2)}px) ${amassa}`;
  }
  return { quadro };
})();

/* ================= TROPICALÍSSIMA: composição com as manchas ================= */
const trop = (() => {
  const palco = $('#t-palco'), cv = $('#t-cv'), ctx = cv.getContext('2d'), heroi = $('.t-heroi');
  const tA = $('#t-a'), tB = $('#t-b'), tC = $('#t-c');
  let linhas, corpos = [], W = 0, H = 0, s = 0, ox = 0, oy = 0, escA = 1, pronto = false, tp = -10;
  // a arte original tem 5000 px; o recorte da arte começa em (1300, 950) e o contorno está em meia escala
  const CX = 1300, CY = 950, ESC = 2;
  // cada boom troca a cor da marca e faz uma foto surgir dentro de cada mancha
  const BOOMS = [
    { em: .2, fundo: '#fff', mancha: '#F9BF00', tinta: '#111', fotos: ['ig06', 'ig11'] },
    { em: .45, fundo: '#0b0b0b', mancha: '#F0338C', tinta: '#fff', fotos: ['ig12', 'ig10'] },
    { em: .7, fundo: '#F9BF00', mancha: '#7A1426', tinta: '#111', fotos: ['ig18', 'ig14'] },
  ];
  let fotos = [];
  const voltaComSobra = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  async function prepara() {
    const polys = await (await fetch('/portfolio/trop-blob.json')).json();
    linhas = await carrega('/portfolio/img/trop-linhas.png');
    fotos = await Promise.all(BOOMS.map(b => Promise.all(b.fotos.map(f => carrega(`/portfolio/img/${f}.webp`)))));
    corpos = polys.map(poly => {
      // reamostra o contorno em N pontos igualmente espaçados
      const pts = poly.map(([x, y]) => [CX + x * ESC, CY + y * ESC]);
      let tot = 0; const seg = []; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); tot += l; }
      const N = 96, out = []; let i = 0, acc = 0;
      for (let k = 0; k < N; k++) { const alvo = k * tot / N; while (acc + seg[i] < alvo) { acc += seg[i]; i++; } const t = (alvo - acc) / seg[i];
        out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); }
      const c = out.reduce((a, q) => [a[0] + q[0] / N, a[1] + q[1] / N], [0, 0]);
      return { c, rest: out, p: out.map(q => [...q]), v: out.map(() => [0, 0]) };
    });
    await document.fonts.load('500 20px Montserrat');
  }
  function monta() {
    W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR;
    s = Math.min(H * .96, W * .96); ox = (W - s) / 2; oy = (H - s) / 2;
    const deitado = W / H > 1.15;
    // a arte ocupa a altura toda; o nome vai pras laterais, fora das fotos
    escA = deitado ? Math.min(H * .9 / 2850, W * .56 / 2500) : Math.min(H * .62 / 2850, W * .9 / 2500);
    ox = W / 2 - 2550 * escA; oy = H / 2 - (deitado ? 2370 : 2300) * escA;
    [tA, tB, tC].forEach(el => el.classList.toggle('lado', deitado));
    if (deitado) {
      const fs = Math.min(H * .085, W * .06);
      tA.style.cssText = `font-size:${fs}px;left:${W * .04}px;right:auto;top:50%;`;
      tB.style.cssText = `font-size:${fs}px;right:${W * .04}px;left:auto;top:50%;`;
      tC.style.cssText = `font-size:${fs * .26}px;right:${W * .04 + fs * 1.4}px;left:auto;top:auto;bottom:${H * .08}px;`;
    } else {
      const fs = Math.min(W * .1, 60), artTopo = oy + 950 * escA, artBase = oy + 3800 * escA;
      tA.style.cssText = `font-size:${fs}px;top:${artTopo - fs * 1.1}px;line-height:1;`;
      tB.style.cssText = `font-size:${fs}px;top:${artBase + fs * .2}px;line-height:1;`;
      tC.style.cssText = `font-size:${fs * .3}px;top:${artBase + fs * 1.5}px;line-height:1;`;
    }
    pronto = true;
  }
  palco.addEventListener('pointerdown', () => { tp = performance.now() / 1000; });


  function quadro(ms) {
    if (!pronto) return;
    const t = PF.tempo(ms);
    const r = heroi.getBoundingClientRect();
    if (r.top < H && r.bottom > 0) {
      const p = clamp((clamp(-r.top / (r.height - H)) - .18) / .82);   // as manchas começam quando o selo sai
      const k0 = eout(clamp(p / .14));    // as manchas crescem do centro enquanto o selo sai
      // qual boom está valendo e quanto ele já inchou
      let bi = -1; BOOMS.forEach((b, i) => { if (p >= b.em) bi = i; });
      const B = bi < 0 ? { fundo: '#fff', mancha: AMARELO, tinta: '#111' } : BOOMS[bi];
      const kb = bi < 0 ? 0 : clamp((p - B.em) / .09);
      const incha = bi < 0 ? 1 : 1 + .12 * voltaComSobra(kb);
      const foto = bi < 0 ? 0 : clamp(kb * 2.2);
      const esc = escA;
      palco.style.setProperty('--fundo', B.fundo); palco.style.setProperty('--tinta', B.tinta);
      const cor = B.mancha;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      // mouse no espaço da arte
      const mx = (mouse.x - ox) / esc, my = (mouse.y - oy) / esc;
      const enc = 1;
      const meio = [2500, 2400];
      const desl = [(mouse.x - W / 2) * .02 / esc, (mouse.y - H / 2) * .02 / esc]; // cor fora de registro, como impressão
      const dt = t - tp;
      for (const b of corpos) {
        const N = b.p.length;
        for (let i = 0; i < N; i++) {
          const q = b.p[i], v = b.v[i], rq = b.rest[i];
          const nx = rq[0] - b.c[0], ny = rq[1] - b.c[1], nl = Math.hypot(nx, ny) || 1;
          const resp = Math.sin(t * 1.4 + i * .33) * 10 + Math.sin(t * .9 - i * .21) * 8;
          let ax = (rq[0] + nx / nl * resp - q[0]) * .06, ay = (rq[1] + ny / nl * resp - q[1]) * .06;
          // vizinhos seguram a forma
          const a = b.p[(i + N - 1) % N], c = b.p[(i + 1) % N];
          ax += ((a[0] + c[0]) / 2 - q[0]) * .08; ay += ((a[1] + c[1]) / 2 - q[1]) * .08;
          // o dedo afunda a gelatina
          const ddx = q[0] * enc + meio[0] * (1 - enc) - mx, ddy = q[1] * enc + meio[1] * (1 - enc) - my, d = Math.hypot(ddx, ddy);
          if (mouse.ativo && d < 340) { const f = (340 - d) / 340; ax += ddx / d * f * 26; ay += ddy / d * f * 26; }
          if (dt < 1.6) { const f = Math.sin(dt * 18 - i * .4) * Math.exp(-dt * 3) * 9; ax += nx / nl * f; ay += ny / nl * f; }
          v[0] = (v[0] + ax) * .86; v[1] = (v[1] + ay) * .86; q[0] += v[0]; q[1] += v[1];
        }
      }
      // mancha: escala enorme no começo (tela toda amarela) até o tamanho certo
      const grande = Math.max(.001, k0) * incha;
      const caminho = (b, dx, dy) => {
        const P = b.p.map(q => [ox + (b.c[0] + (q[0] - b.c[0]) * grande + dx) * esc, oy + (b.c[1] + (q[1] - b.c[1]) * grande + dy) * esc]);
        const N = P.length; ctx.beginPath();
        ctx.moveTo((P[N - 1][0] + P[0][0]) / 2, (P[N - 1][1] + P[0][1]) / 2);
        for (let i = 0; i < N; i++) { const a = P[i], c = P[(i + 1) % N]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + c[0]) / 2, (a[1] + c[1]) / 2); }
        ctx.closePath(); return P;
      };
      corpos.forEach((b, i) => {
        // cor fora de registro atrás
        ctx.fillStyle = cor; caminho(b, -desl[0] - (foto ? 90 : 0), -desl[1] - (foto ? 60 : 0)); ctx.fill();
        if (foto > 0 && fotos[bi]) {
          const P = caminho(b, 0, 0);
          const xs = P.map(q => q[0]), ys = P.map(q => q[1]);
          const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
          ctx.save(); ctx.clip(); ctx.globalAlpha = foto;
          PF.cobre(ctx, fotos[bi][i], x0, y0 - h * .04 * (1 - kb), w, h * 1.04);
          ctx.restore(); ctx.globalAlpha = 1;
        }
      });
      // traço das folhas por cima
      const la = clamp((k0 - .4) / .6);
      if (la > 0) {
        ctx.globalAlpha = la;
        const lw = 2500 * esc * enc, lh = 2850 * esc * enc;
        const lx = ox + (CX * enc + meio[0] * (1 - enc)) * esc, ly = oy + (CY * enc + meio[1] * (1 - enc)) * esc;
        if (B.tinta === '#fff') { ctx.filter = 'invert(1)'; }
        ctx.drawImage(linhas, lx, ly, lw, lh);
        ctx.filter = 'none'; ctx.globalAlpha = 1;
      }
      // nome: entra apertando o espaçamento, sai quando o anel chega
      const tr = (.42 + (1 - k0) * (tA.classList.contains('lado') ? .35 : 1.6)).toFixed(3) + 'em';
      [tA, tB].forEach(el => { el.style.letterSpacing = tr; el.style.opacity = clamp((k0 - .3) / .5); });
      tC.style.opacity = clamp((k0 - .7) / .3);
    }
  }
  const pronta = prepara().then(monta);
  addEventListener('resize', () => monta());
  return { pronta, quadro, entra() {}, sai() {} };
})();
PF.registra({ id: 'trop', cor: '#fff', pronta: trop.pronta, quadro(ms) { tSelo.quadro(ms); trop.quadro(ms); }, entra: trop.entra, sai: trop.sai });
})();
