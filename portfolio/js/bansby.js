(() => {
const { DPR, $, mouse, clamp, eio, eout, carrega, AMARELO } = PF;
/* ================= BANSBY ================= */
const bansby = (() => {
  const selo = PF.selo;
  const cv = $('#b-cv'), ctx = cv.getContext('2d'), sec = $('#bansby');
  const mira = $('.mira'), miraT = mira.querySelector('b');
  const AM = '#E39B2D';
  const MONO = 'ui-monospace, Menlo, monospace';
  const frase = 'Streetwear identidade autoral tipografia própria desenhada à mão como a língua de outro mundo minimalismo brutalismo e cor no volume máximo exploring new worlds i came in peace cartazes fachada moletom papelaria outdoor símbolo'.split(' ');
  const FOTOS = [
    ['/portfolio/img/bansby-cartazes.webp', 'Cartazes'],
    ['/portfolio/img/b-semente.webp', 'Símbolo'],
    ['/portfolio/img/bansby-sinal.webp', 'Fachada'],
    ['/portfolio/img/b-mar.webp', 'Outdoor'],
    ['/portfolio/img/bansby-moletom.webp', 'Moletom'],
    ['/portfolio/img/bansby-papelaria.webp', 'Papelaria'],
  ];
  let glifos = [], tinta = [], palavras = [], linhas = [], logoImg, peace, fotos = [];
  let W = 0, H = 0, LH = 12, pronto = false;
  const mosaicos = new Map();

  async function prepara() {
    const txt = await (await fetch('/portfolio/bansby-logo.svg')).text();
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
    const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tmp.style.cssText = 'position:absolute;left:-9999px;width:10px;height:10px';
    document.body.appendChild(tmp);
    const paths = [...doc.querySelectorAll('path')].map(p => p.getAttribute('d'));
    glifos = await Promise.all(paths.map(async d => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); tmp.appendChild(p);
      const b = p.getBBox();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${-(b.y + b.height)} ${b.width} ${b.height}"><path transform="scale(1,-1)" fill="#fff" d="${d}"/></svg>`;
      const im = await carrega('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
      return { im, ar: b.width / b.height };
    }));
    tmp.remove();
    // glifo pintado de laranja, em tamanho pequeno, pro mosaico
    tinta = glifos.map(g => { const c = document.createElement('canvas'); c.width = 48; c.height = 48; const x = c.getContext('2d');
      const w = g.ar > 1 ? 44 : 44 * g.ar, h = g.ar > 1 ? 44 / g.ar : 44; x.drawImage(g.im, 24 - w / 2, 24 - h / 2, w, h);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = AM; x.fillRect(0, 0, 48, 48); return c; });
    // ordena por tinta: o glifo mais "cheio" representa o tom mais claro
    tinta = tinta.map(c => { const d = c.getContext('2d').getImageData(0, 0, 48, 48).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return { c, s }; }).sort((a, b) => a.s - b.s).map(o => o.c);
    logoImg = await carrega('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt));
    fotos = await Promise.all(FOTOS.map(async ([src, nome]) => ({ im: await carrega(src), nome })));
  }

  function sprite(n) {
    const h = Math.round(7 * DPR), gap = Math.round(1.5 * DPR);
    const seq = Array.from({ length: n }, () => ({ g: glifos[Math.random() * glifos.length | 0], f: Math.random() < .5 ? -1 : 1, v: Math.random() < .25 ? -1 : 1 }));
    const gw = s => Math.max(3, Math.round(h * s.g.ar * .55));
    const w = seq.reduce((a, s) => a + gw(s) + gap, 0);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    let px = 0;
    for (const s of seq) { const g = gw(s); x.save(); x.translate(px + g / 2, h / 2); x.scale(s.f, s.v); x.drawImage(s.g.im, -g / 2, -h / 2, g, h); x.restore(); px += g + gap; }
    return c;
  }

  function monta() {
    W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR;
    LH = W < 700 ? 11 : 12;
    if (!palavras.length) palavras = Array.from({ length: 90 }, () => sprite(2 + (Math.random() * 5 | 0)));
    const mw = Math.min(W * .78, H * 1.25), mh = mw * 1101 / 1896;
    const mc = document.createElement('canvas'); mc.width = W; mc.height = H; const mx = mc.getContext('2d');
    mx.drawImage(logoImg, (W - mw) / 2, (H - mh) / 2 - H * .03, mw, mh);
    const md = mx.getImageData(0, 0, W, H).data;
    const dentro = (x, y) => { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < W && y < H && md[(y * W + x) * 4 + 3] > 40; };
    linhas = []; let k = 0;
    for (let i = 0; i < Math.ceil(H / LH) + 1; i++) {
      const y = i * LH + LH / 2;
      const larg = W * (.55 + .35 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .31)));
      let x = (W - larg) / 2 + (Math.random() - .5) * 30; const fimX = x + larg, ps = [];
      while (x < fimX) { const sp = palavras[Math.random() * palavras.length | 0], w = sp.width / DPR;
        ps.push({ sp, x, w, ox: 0, vx: 0, txt: frase[k++ % frase.length], logo: dentro(x + w / 2, y) }); x += w + 6 * (.6 + Math.random()); }
      linhas.push({ y, ps });
    }
    mosaicos.clear();
    pronto = true;
  }

  // janela da foto: cabe em 62% da tela, um pouco à esquerda
  function janela(im) {
    const mw = W < 700 ? W * .86 : W * .6, mh = H * .62, ar = im.naturalWidth / im.naturalHeight;
    let w = mw, h = mw / ar; if (h > mh) { h = mh; w = mh * ar; }
    const cx = W < 700 ? W / 2 : W * .43;
    return { x: Math.round(cx - w / 2), y: Math.round(H * .46 - h / 2), w: Math.round(w), h: Math.round(h) };
  }
  // a foto refeita em glifos: cada célula vira um glifo pelo tom
  function mosaico(i, cel, r) {
    const chave = i + ':' + cel + ':' + r.w;
    if (mosaicos.has(chave)) return mosaicos.get(chave);
    const cw = Math.ceil(r.w / cel), ch = Math.ceil(r.h / cel);
    const p = document.createElement('canvas'); p.width = cw; p.height = ch; const px = p.getContext('2d');
    px.drawImage(fotos[i].im, 0, 0, cw, ch); const d = px.getImageData(0, 0, cw, ch).data;
    const c = document.createElement('canvas'); c.width = r.w * DPR; c.height = r.h * DPR; const x = c.getContext('2d'); x.scale(DPR, DPR);
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
      const o = (yy * cw + xx) * 4, l = (d[o] * .3 + d[o + 1] * .59 + d[o + 2] * .11) / 255;
      if (l < .12) continue;
      x.globalAlpha = .25 + l * .75;
      x.drawImage(tinta[Math.min(tinta.length - 1, Math.floor(l * tinta.length))], xx * cel, yy * cel, cel * .92, cel * .92);
    }
    mosaicos.set(chave, c); return c;
  }

  const prog = () => { const r = sec.getBoundingClientRect(); return clamp(-r.top / (r.height - 2 * innerHeight)); };
  const fase = (p, a, b) => clamp((p - a) / (b - a));
  const degrau = (k, n) => Math.floor(k * n) / n;

  function parede(alfa, L) {
    const R = W < 700 ? 70 : 110;
    ctx.font = `9px ${MONO}`; ctx.textBaseline = 'middle';
    for (const l of linhas) for (const w of l.ps) {
      const cx = w.x + w.w / 2 + w.ox, dy = l.y - mouse.y, dx = cx - mouse.x, d = Math.hypot(dx, dy);
      const empurra = mouse.ativo && d < R ? Math.sign(dx || 1) * (R - d) * .55 : 0;
      w.vx += (empurra - w.ox) * .12; w.vx *= .72; w.ox += w.vx;
      const x = w.x + w.ox;
      if (mouse.ativo && d < R * .75) { ctx.globalAlpha = 1; ctx.fillStyle = AM; ctx.fillText(w.txt, x, l.y); continue; }
      ctx.globalAlpha = alfa * (w.logo ? 1 : 1 - L * .92);
      ctx.drawImage(w.sp, x, l.y - 3.5, w.w, 7);
      if (w.logo && L > 0) { ctx.globalAlpha = alfa * L; ctx.fillStyle = AM; ctx.fillRect(x, l.y - 3.5, w.w, 7); }
    }
    ctx.globalAlpha = 1;
  }

  function especime(k) {
    const lista = [...glifos.slice(1), glifos[0]];   // o símbolo da Bansby fecha a linha
    // o alfabeto em construção: linhas-guia, caixas, lista e medidas, em degraus
    const s = degrau(k, 4);
    // a linha inteira cabe na tela: o último glifo fecha a linha, nada sai pela borda
    const n = lista.length, gh = Math.min(H * .26, W * .9 / (lista.reduce((a, g) => a + g.ar, 0) + .28 * (n - 1)));
    const gap = gh * .28, total = lista.reduce((a, g) => a + g.ar * gh, 0) + gap * (n - 1);
    let x = (W - total) / 2; const base = H * .58, topo = base - gh;
    ctx.fillStyle = '#0b0b0b'; ctx.globalAlpha = .82; ctx.fillRect(0, topo - 70, W, gh + 150); ctx.globalAlpha = 1;
    ctx.strokeStyle = AM; ctx.lineWidth = 1;
    if (s >= .25) {
      [[topo, 'altura'], [topo + gh * .5, 'meio'], [base, 'base']].forEach(([y, nome]) => {
        ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.setLineDash(nome === 'meio' ? [3, 4] : []); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = AM; ctx.font = `10px ${MONO}`; ctx.fillText(nome, 16, y - 8);
      });
    }
    ctx.font = `10px ${MONO}`;
    lista.forEach((g, i) => {
      const w = g.ar * gh;
      if (s >= .5) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(Math.round(x) + .5, Math.round(topo) + .5, Math.round(w), Math.round(gh)); }
      if (s >= .75) ctx.drawImage(g.im, x, topo, w, gh);
      if (s >= 1) { ctx.fillStyle = '#fff'; ctx.fillText(`${String(Math.round(x)).padStart(4, '0')} ${String(Math.round(topo)).padStart(4, '0')}`, x, base + 22); ctx.fillStyle = AM; ctx.fillText(`${Math.round(w)} × ${Math.round(gh)}`, x, base + 38); }
      x += w + gap;
    });
    if (s >= .25) { ctx.fillStyle = '#fff'; ctx.font = `12px ${MONO}`; ctx.fillText('Alfabeto Bansby, desenhado à mão', 16, topo - 46); }
  }

  function fotoQuadro(i, k) {
    const f = fotos[i], r = janela(f.im);
    const abre = degrau(clamp(k / .12), 3);                // a janela abre em 3 degraus
    const dec = clamp((k - .12) / .3);                     // e a foto se decodifica em 3 degraus
    const rw = Math.round(r.w * Math.max(abre, .001)), rh = Math.round(r.h * Math.max(abre, .001));
    const rx = r.x + (r.w - rw) / 2, ry = r.y + (r.h - rh) / 2;
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(rx - 10, ry - 10, rw + 20, rh + 20);
    if (abre < 1) { ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip(); ctx.drawImage(mosaico(i, 26, r), r.x, r.y, r.w, r.h); ctx.restore(); }
    else {
      if (dec < 1) { const cel = [26, 13, 7][Math.min(2, Math.floor(dec * 3))]; ctx.drawImage(mosaico(i, cel, r), r.x, r.y, r.w, r.h); }
      else ctx.drawImage(f.im, r.x, r.y, r.w, r.h);
    }
    // cantoneiras
    ctx.strokeStyle = AM; ctx.lineWidth = 1.5; const c = 14, o = 8;
    [[rx - o, ry - o, 1, 1], [rx + rw + o, ry - o, -1, 1], [rx - o, ry + rh + o, 1, -1], [rx + rw + o, ry + rh + o, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(x + c * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + c * sy); ctx.stroke(); });
    // ficha
    if (abre >= 1) {
      const fx = W < 700 ? r.x : r.x + r.w + 34, fy = W < 700 ? r.y + r.h + 26 : r.y + 4;
      ctx.font = `12px ${MONO}`; ctx.fillStyle = '#fff'; ctx.fillText(f.nome, fx, fy);
      ctx.font = `10px ${MONO}`; ctx.fillStyle = AM;
      ctx.fillText(`${String(i + 1).padStart(2, '0')} / ${String(fotos.length).padStart(2, '0')}`, fx, fy + 18);
      ctx.fillText(`${f.im.naturalWidth} × ${f.im.naturalHeight}`, fx, fy + 32);
      ctx.fillText(dec < 1 ? `decodificando ${Math.round(dec * 100)}%` : 'ok', fx, fy + 46);
    }
  }

  // a última janela da Bansby é redonda: o selo da Jelly Lab, que cresce até a tela ficar branca
  function abreSelo(D) {
    const { tam, cx, cy } = selo.geo(), Rs = tam / 2, diag = Math.hypot(W, H) / 2 + 4;
    const a = eio(clamp(D / .45)), b = eio(clamp((D - .55) / .45));
    const R = b > 0 ? Rs + (diag - Rs) * b : Math.max(.5, Rs * degrau(a, 5) * 1.0001);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); selo.desenha(ctx);
    ctx.restore();
    if (b === 0) {
      ctx.strokeStyle = AM; ctx.lineWidth = 1.5; const c = 14, o = 12;
      [[cx - R - o, cy - R - o, 1, 1], [cx + R + o, cy - R - o, -1, 1], [cx - R - o, cy + R + o, 1, -1], [cx + R + o, cy + R + o, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(x + c * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + c * sy); ctx.stroke(); });
      if (a >= 1) { ctx.font = `12px ${MONO}`; ctx.fillStyle = '#fff'; ctx.fillText('Tropicalíssima', cx + R + 34, cy - R + 4);
        ctx.font = `10px ${MONO}`; ctx.fillStyle = AM; ctx.fillText('próximo projeto', cx + R + 34, cy - R + 22); }
    }
  }

  function quadro() {
    if (!pronto) return;
    const r = sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) return;
    const p = prog();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, W, H);
    const L = fase(p, .05, .14);
    const S = fase(p, .18, .27), Sout = fase(p, .31, .33);
    const F0 = .34, F1 = .92, D = fase(p, .935, 1);
    let alfa = 1;
    if (p > .17) alfa = .22;
    parede(alfa, p < .17 ? L : 0);
    if (p >= .18 && p < .33) { ctx.globalAlpha = 1 - Sout; especime(S); ctx.globalAlpha = 1; }
    if (p >= F0 && p < F1 + .02) {
      const seg = (F1 - F0) / fotos.length, i = Math.min(fotos.length - 1, Math.floor((p - F0) / seg));
      fotoQuadro(i, clamp((p - F0 - i * seg) / seg));
    }
    if (D > 0) abreSelo(D);
    if (mouse.ativo) {
      mira.style.transform = `translate(${mouse.x}px,${mouse.y}px)`;
      miraT.textContent = `${String(Math.round(mouse.x)).padStart(4, '0')} X ${String(Math.round(mouse.y)).padStart(4, '0')} Y`;
    }
  }
  const pronta = Promise.all([prepara(), selo.pronta]).then(monta);
  addEventListener('resize', () => { if (glifos.length) monta(); });
  const branco = () => prog() > .935 + .065 * .55;
  return { pronta, quadro, branco, entra() { mira.classList.add('on'); document.body.classList.add('cursor-off'); }, sai() { mira.classList.remove('on'); document.body.classList.remove('cursor-off'); } };
})();
PF.registra({ id: 'bansby', cor: '#0b0b0b', ...bansby, cede: bansby.branco });
})();
