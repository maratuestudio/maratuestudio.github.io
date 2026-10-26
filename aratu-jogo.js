/* MARATU — "Corre, Aratu!": o joguinho escondido no rodapé.
   Só carrega quando alguém consegue pegar o Aratu que foge.
   Dinâmica de corredor infinito (a do dinossauro do Chrome): um botão só, pular.
   Gravidade constante, salto por impulso, segurar pula mais alto, a areia acelera devagar até um teto.
   Obstáculos do mangue: coco, garrafa, pedras no chão; a gaivota voa baixo e quem pula nela perde. */
(function () {
  'use strict';
  if (window.maratuJogo) return;

  var W = 320, H = 120, CHAO = 100;  // W encolhe no celular pra o Aratu sair maior
  var COR = { fundo: '#0D0D0B', areia: '#F0ECE4', laranja: '#C8501A', mangue: '#26241F', mangue2: '#1A1916', agua: '#17302E', coco: '#7A4B2A', garrafa: '#5E8C7A', pedra: '#8A8577', gaivota: '#F0ECE4' };
  var G = 0.5, PULO = -7.6, PULO_CURTO = -3.5, VEL0 = 3, ACEL = 0.0012, VMAX = 7;

  var PECAS = {
    garraE: 'M0,104.77c0,26.58,21.55,48.13,48.13,48.13V56.65C21.55,56.65,0,78.19,0,104.77Z',
    garraD: 'M270.11,56.65v96.26c26.58,0,48.13-21.55,48.13-48.13s-21.55-48.13-48.13-48.13Z',
    corpo: 'M159.12,152.9c53.16,0,96.26-43.1,96.26-96.26H62.86c0,53.16,43.1,96.26,96.26,96.26Z',
    olhoD: 'M224.82,24.08c0-13.3-10.78-24.08-24.08-24.08v48.16c13.3,0,24.08-10.78,24.08-24.08Z',
    olhoE: 'M117.49,48.16V0c-13.3,0-24.08,10.78-24.08,24.08s10.78,24.08,24.08,24.08Z'
  };
  function spriteAratu(passo, cor) {
    var c = document.createElement('canvas'); c.width = 28; c.height = 14;
    var ctx = c.getContext('2d'), K = 28 / 318.24;
    ctx.save(); ctx.scale(K, K); ctx.fillStyle = cor;
    var p = function (n, dy) { ctx.save(); ctx.translate(0, dy); ctx.fill(new Path2D(PECAS[n])); ctx.restore(); };
    p('corpo', 6); p('garraE', passo ? -10 : 6); p('garraD', passo ? 6 : -10); p('olhoE', 6); p('olhoD', 6);
    ctx.restore();
    var img = ctx.getImageData(0, 0, 28, 14), px = img.data;
    for (var i = 3; i < px.length; i += 4) px[i] = px[i] > 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // números em pixel, 3x5
  var DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
  function numero(ctx, n, xDir, y, cor) {
    var s = String(n), x = xDir - s.length * 4;
    ctx.fillStyle = cor;
    for (var k = 0; k < s.length; k++) {
      var d = DIG[+s[k]];
      for (var i = 0; i < 15; i++) if (d[i] === '1') ctx.fillRect(x + k * 4 + (i % 3), y + Math.floor(i / 3), 1, 1);
    }
  }

  var el = null, cv, ctx, txt, frames, rodando = false, raf = 0, voltaFoco = null;
  var st, recorde = 0;
  /* mangue: árvores de copa redonda em cima de raízes em arco, em duas camadas */
  var PERIODO = W + 60;
  function arvores(n, semente) {
    var a = [];
    for (var i = 0; i < n; i++) { var r = Math.abs(Math.sin((i + 1) * semente)); a.push({ x: Math.round(i * PERIODO / n + r * 10), h: 10 + Math.round(r * 12), c: 5 + Math.round(Math.abs(Math.cos(i * semente)) * 5) }); }
    return a;
  }
  var CAMADAS = [{ vel: 0.15, base: 78, cor: '#1A1916', arv: arvores(9, 2.3) }, { vel: 0.35, base: 86, cor: '#26241F', arv: arvores(7, 1.7) }];

  function novo() {
    st = { estado: 'pronto', y: CHAO, vy: 0, noChao: true, segurando: false, vel: VEL0, dist: 0, pontos: 0, obs: [], prox: 120, fundo: 0, passo: 0, piscaPontos: 0, fimEm: 0 };
  }
  function tipoObs() {
    var r = Math.random();
    if (st.pontos > 250 && r < 0.18) return { t: 'gaivota', w: 12, h: 6, y: CHAO - 30 - Math.round(Math.random() * 4) };
    if (r < 0.45) return { t: 'coco', w: 8, h: 8 };
    if (r < 0.75) return { t: 'garrafa', w: 5, h: 13 };
    return { t: 'pedra', w: st.vel > 4.5 && Math.random() < 0.5 ? 20 : 12, h: 7 };
  }
  function pula() {
    if (st.estado === 'pronto') { st.estado = 'jogando'; txt.textContent = ''; }
    if (st.estado === 'fim') { if (Date.now() - st.fimEm > 450) { novo(); st.estado = 'jogando'; txt.textContent = ''; } return; }
    if (st.noChao) { st.vy = PULO; st.noChao = false; st.segurando = true; }
  }
  function solta() { st.segurando = false; if (st.vy < PULO_CURTO) st.vy = PULO_CURTO; }

  function passo(f) {
    if (st.estado !== 'jogando') return;
    st.vel = Math.min(VMAX, st.vel + ACEL * f);
    var dx = st.vel * f;
    st.dist += dx; st.fundo += dx;
    var p = Math.floor(st.dist / 10);
    if (p !== st.pontos) { st.pontos = p; if (p && p % 100 === 0) st.piscaPontos = 40; }
    if (!st.noChao) {
      st.vy += G * f; st.y += st.vy * f;
      if (st.y >= CHAO) { st.y = CHAO; st.vy = 0; st.noChao = true; }
    }
    st.passo += f;
    // obstáculos: a distância mínima cresce com a velocidade, pra dar tempo de pular
    st.prox -= dx;
    if (st.prox <= 0) {
      var o = tipoObs(); o.x = W + 4; if (o.y == null) o.y = CHAO - o.h;
      st.obs.push(o);
      var min = 70 + st.vel * 14;
      st.prox = min + Math.random() * min * 0.6;
    }
    var cx = 30 + 4, cy = st.y - 12, cw = 20, ch = 10;
    for (var k = st.obs.length - 1; k >= 0; k--) {
      var ob = st.obs[k];
      ob.x -= dx * (ob.t === 'gaivota' ? 1.15 : 1);
      if (ob.x + ob.w < -4) { st.obs.splice(k, 1); continue; }
      if (cx < ob.x + ob.w - 1 && cx + cw > ob.x + 1 && cy < ob.y + ob.h - 1 && cy + ch > ob.y + 1) {
        st.estado = 'fim'; st.fimEm = Date.now();
        recorde = Math.max(recorde, st.pontos);
        txt.textContent = st.pontos + (st.pontos === 1 ? ' ponto' : ' pontos') + (recorde > st.pontos ? ', recorde ' + recorde : st.pontos ? ', novo recorde' : '') + '. Toque pra correr de novo.';
        if (navigator.vibrate) navigator.vibrate(60);
        try { if (window.gtag) window.gtag('event', 'aratu_jogo', { acao: 'fim', pontos: st.pontos }); } catch (e) {}
      }
    }
  }

  function desenha() {
    ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, H);
    // lua laranja e estrelas paradas
    ctx.fillStyle = COR.laranja;
    var lx = W - 52, ly = 22;
    for (var a = -7; a <= 7; a++) for (var b = -7; b <= 7; b++) if (a * a + b * b <= 46) ctx.fillRect(lx + a, ly + b, 1, 1);
    ctx.fillStyle = '#3A3830';
    [[20, 12], [60, 30], [110, 8], [150, 26], [200, 14], [236, 40], [300, 52], [90, 46]].forEach(function (s) { ctx.fillRect(s[0], s[1], 1, 1); });
    // água ao fundo e o mangue em duas camadas, cada uma no seu ritmo
    ctx.fillStyle = COR.agua; ctx.fillRect(0, 74, W, 26);
    CAMADAS.forEach(function (cam) {
      ctx.fillStyle = cam.cor;
      var off = (st.fundo * cam.vel) % PERIODO;
      cam.arv.forEach(function (t) {
        for (var rep = -1; rep <= 1; rep++) {
          var x = Math.round(t.x - off + rep * PERIODO);
          if (x < -20 || x > W + 20) continue;
          var topo = cam.base - t.h;
          ctx.fillRect(x, topo, 2, t.h - 3);
          for (var dy = -t.c; dy <= t.c; dy++) { var meia = Math.round(Math.sqrt(t.c * t.c - dy * dy) * 1.4); ctx.fillRect(x + 1 - meia, topo + Math.round(dy * 0.7), meia * 2, 1); }
          for (var k = 1; k <= 4; k++) { ctx.fillRect(x - k, cam.base - 4 + k, 1, 1); ctx.fillRect(x + 1 + k, cam.base - 4 + k, 1, 1); ctx.fillRect(x - k - 3, cam.base - 1, 1, 1); }
        }
      });
    });
    // areia
    ctx.fillStyle = COR.areia; ctx.fillRect(0, CHAO, W, 1);
    ctx.fillStyle = '#8A8577';
    var g = Math.floor(st.fundo % 24);
    for (var x = -24; x < W + 24; x += 24) { ctx.fillRect(x - g + 5, CHAO + 4, 2, 1); ctx.fillRect(x - g + 15, CHAO + 9, 1, 1); ctx.fillRect(x - g + 20, CHAO + 14, 3, 1); }
    // obstáculos
    st.obs.forEach(function (o) {
      var x = Math.round(o.x), y = Math.round(o.y);
      if (o.t === 'coco') { ctx.fillStyle = COR.coco; ctx.fillRect(x + 1, y, 6, 8); ctx.fillRect(x, y + 1, 8, 6); ctx.fillStyle = '#3B2414'; ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + 4, y + 2, 1, 1); }
      else if (o.t === 'garrafa') { ctx.fillStyle = COR.garrafa; ctx.fillRect(x + 1, y, 3, 3); ctx.fillRect(x, y + 3, 5, 10); ctx.fillStyle = COR.areia; ctx.fillRect(x + 1, y + 6, 3, 3); }
      else if (o.t === 'pedra') { ctx.fillStyle = COR.pedra; for (var k = 0; k < o.w; k += 6) { ctx.fillRect(x + k, y + 2, 6, 5); ctx.fillRect(x + k + 1, y, 4, 2); } }
      else { ctx.fillStyle = COR.gaivota; var asa = Math.floor(st.passo / 8) % 2; ctx.fillRect(x + 3, y + 2, 6, 2); ctx.fillRect(x + 9, y + 1, 2, 2); ctx.fillStyle = COR.laranja; ctx.fillRect(x + 11, y + 2, 1, 1); ctx.fillStyle = COR.gaivota; if (asa) { ctx.fillRect(x, y, 4, 1); ctx.fillRect(x + 4, y + 1, 2, 1); } else { ctx.fillRect(x, y + 4, 4, 1); ctx.fillRect(x + 4, y + 3, 2, 1); } }
    });
    // o Aratu
    var quadro = st.estado === 'jogando' && st.noChao ? Math.floor(st.passo / 6) % 2 : 0;
    ctx.drawImage(frames[quadro], 30, Math.round(st.y) - 14);
    // pontos
    if (st.piscaPontos > 0) st.piscaPontos--;
    if (!(st.piscaPontos > 0 && Math.floor(st.piscaPontos / 5) % 2)) numero(ctx, st.pontos, W - 6, 6, COR.areia);
    if (recorde) numero(ctx, recorde, W - 6 - (String(st.pontos).length * 4) - 10, 6, '#6B675E');
  }

  function laco(t) {
    if (!rodando) { raf = 0; return; }
    raf = requestAnimationFrame(laco);
    var f = laco.ant ? Math.min(3, (t - laco.ant) / (1000 / 60)) : 1;
    laco.ant = t;
    passo(f);
    desenha();
  }

  function escala() {
    var cabe = Math.min(window.innerWidth - 60, 960) / W, k = cabe >= 2 ? Math.floor(cabe) : Math.max(1, cabe);
    cv.style.width = W * k + 'px'; cv.style.height = H * k + 'px';
  }
  function tecla(e) {
    if (!el || !el.classList.contains('on')) return;
    if (e.key === 'Escape') { fechar(); return; }
    if (e.key === 'Tab') { e.preventDefault(); var x = el.querySelector('.aj-x'); (document.activeElement === x ? el.querySelector('.aj-card') : x).focus(); return; }
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); if (!e.repeat) pula(); }
  }
  function teclaSolta(e) { if (!el || !el.classList.contains('on')) return; if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); solta(); } }
  function pausa() { rodando = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function volta() { if (el && el.classList.contains('on') && !document.hidden && !rodando) { rodando = true; laco.ant = 0; if (!raf) raf = requestAnimationFrame(laco); } }

  function monta() {
    var css = document.createElement('style');
    css.textContent =
      '.aj-veu{position:fixed;inset:0;z-index:100010;touch-action:none;overscroll-behavior:contain;background:rgba(13,13,11,.72);display:none;align-items:center;justify-content:center;padding:16px}' +
      '.aj-veu.on{display:flex}' +
      '.aj-card{outline:none;touch-action:none;user-select:none;-webkit-user-select:none;background:#0D0D0B;color:#F0ECE4;border:1.5px solid #F0ECE4;border-radius:18px;box-shadow:6px 6px 0 #C8501A;padding:14px 14px 12px;max-width:100%;font-family:var(--clother,"Helvetica Neue",sans-serif)}' +
      '.aj-cab{display:flex;align-items:center;gap:12px;margin:0 2px 10px}' +
      '.aj-cab b{font-size:18px;font-weight:900;letter-spacing:-.01em}' +
      '.aj-x{margin-left:auto;width:36px;height:36px;border-radius:50%;border:1.5px solid #F0ECE4;background:none;color:#F0ECE4;font-size:20px;line-height:1;cursor:pointer}' +
      '.aj-cv{display:block;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:8px;touch-action:none;cursor:pointer;max-width:100%}' +
      '.aj-txt{margin:10px 2px 0;font-size:14px;font-weight:700;opacity:.8;min-height:1.3em}';
    document.head.appendChild(css);
    el = document.createElement('div');
    el.className = 'aj-veu';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Corre, Aratu!');
    el.innerHTML = '<div class="aj-card" tabindex="-1"><div class="aj-cab"><b>Corre, Aratu!</b><button class="aj-x" type="button" aria-label="Fechar">&times;</button></div>' +
      '<canvas class="aj-cv" width="' + W + '" height="' + H + '" role="img" aria-label="Aratu correndo no mangue"></canvas><p class="aj-txt" aria-live="polite"></p></div>';
    document.body.appendChild(el);
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    txt = el.querySelector('.aj-txt');
    frames = [spriteAratu(false, COR.laranja), spriteAratu(true, COR.laranja)];
    el.querySelector('.aj-x').onclick = fechar;
    el.addEventListener('click', function (e) { if (e.target === el) fechar(); });
    // no celular o cartão inteiro vira botão de pular, menos o fechar
    var card = el.querySelector('.aj-card');
    card.addEventListener('pointerdown', function (e) { if (e.target.closest('.aj-x')) return; e.preventDefault(); pula(); });
    card.addEventListener('pointerup', solta); card.addEventListener('pointercancel', solta);
    document.addEventListener('keydown', tecla); document.addEventListener('keyup', teclaSolta);
    document.addEventListener('visibilitychange', function () { if (document.hidden) pausa(); else volta(); });
    window.addEventListener('blur', pausa); window.addEventListener('focus', volta);
    window.addEventListener('resize', function () { if (el.classList.contains('on')) escala(); });
  }

  function abrir() {
    W = window.innerWidth < 600 ? 220 : 320;
    if (!el) monta();
    cv.width = W; ctx.imageSmoothingEnabled = false;
    novo();
    txt.textContent = 'Toque ou aperte espaço pra pular.';
    escala();
    el.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    voltaFoco = document.activeElement;
    el.querySelector('.aj-card').focus({ preventScroll: true });
    rodando = true; laco.ant = 0;
    if (!raf) raf = requestAnimationFrame(laco);
    try { if (window.gtag) window.gtag('event', 'aratu_jogo', { acao: 'abriu' }); } catch (e) {}
  }
  function fechar() {
    if (!el) return;
    el.classList.remove('on');
    document.documentElement.style.overflow = '';
    pausa();
    if (voltaFoco && voltaFoco.focus) { try { voltaFoco.focus({ preventScroll: true }); } catch (e) {} }
    voltaFoco = null;
  }

  window.maratuJogo = { abrir: abrir, fechar: fechar, estado: function () { return st; } };
})();
