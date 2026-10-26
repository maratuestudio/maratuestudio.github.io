/* MARATU — Mascote Aratu
   Easter egg: aparece ao rolar até o rodapé.
   Anda dentro do footer em pixel (as formas do logo, como na /servicos) e foge do mouse/toque.
   Quem conseguir encostar nele abre o joguinho (aratu-jogo.js, carregado só nessa hora). */

(function() {
  'use strict';

  var PECAS = {
    garraE: 'M0,104.77c0,26.58,21.55,48.13,48.13,48.13V56.65C21.55,56.65,0,78.19,0,104.77Z',
    garraD: 'M270.11,56.65v96.26c26.58,0,48.13-21.55,48.13-48.13s-21.55-48.13-48.13-48.13Z',
    corpo: 'M159.12,152.9c53.16,0,96.26-43.1,96.26-96.26H62.86c0,53.16,43.1,96.26,96.26,96.26Z',
    olhoD: 'M224.82,24.08c0-13.3-10.78-24.08-24.08-24.08v48.16c13.3,0,24.08-10.78,24.08-24.08Z',
    olhoE: 'M117.49,48.16V0c-13.3,0-24.08,10.78-24.08,24.08s10.78,24.08,24.08,24.08Z'
  };
  // garras sobem e descem, olho pisca; depois tira o antialias e vira pixel
  function desenha(cv, passo, pisca) {
    var ctx = cv.getContext('2d', { willReadFrequently: true }), W = cv.width, H = cv.height, K = W / 318.24;
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.scale(K, K); ctx.fillStyle = '#C8501A';
    var p = function (nome, dy) { ctx.save(); ctx.translate(0, dy); ctx.fill(new Path2D(PECAS[nome])); ctx.restore(); };
    p('corpo', 6); p('garraE', passo ? -8 : 6); p('garraD', passo ? 6 : -8);
    if (!pisca) { p('olhoE', 6); p('olhoD', 6); }
    ctx.restore();
    var img = ctx.getImageData(0, 0, W, H), px = img.data;
    for (var i = 3; i < px.length; i += 4) px[i] = px[i] > 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
  }

  function init() {
    var container = document.querySelector('.aratu-mascote');
    if (!container) return;
    var footer = container.parentElement;

    container.innerHTML = '<canvas width="40" height="20"></canvas>';
    var cv = container.firstChild;
    desenha(cv, false, false);
    container.setAttribute('role', 'button');
    container.setAttribute('aria-label', 'Aratu, o caranguejo. Pegue pra abrir o jogo');
    container.removeAttribute('aria-hidden');

    var WALK_SPEED = 0.6;
    var FLEE_RADIUS = 80;
    var FLEE_BOOST = 3.5;
    var FLEE_RECOVERY_MS = 200;

    var posX = 0, direction = 1, velocityBoost = 0, lastFleeTime = 0;
    var mouseX = -9999, mouseY = -9999;
    var passo = false, ultimoPasso = 0, piscaAte = 0;
    var crabWidth = container.offsetWidth || 60;
    var arenaWidth = footer.offsetWidth || window.innerWidth;

    window.addEventListener('resize', function() {
      crabWidth = container.offsetWidth || 60;
      arenaWidth = footer.offsetWidth || window.innerWidth;
    });
    window.addEventListener('mousemove', function(e) { mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('touchstart', function(e) {
      if (e.touches.length > 0) { mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY; }
    }, { passive: true });
    window.addEventListener('touchmove', function(e) {
      if (e.touches.length > 0) { mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY; }
    }, { passive: true });
    window.addEventListener('touchend', function() { mouseX = -9999; mouseY = -9999; });

    // pegou o Aratu: o jogo só carrega agora
    var abrindo = false;
    function pegou() {
      if (abrindo) return;
      if (window.maratuJogo) { window.maratuJogo.abrir(); return; }
      abrindo = true;
      var s = document.createElement('script');
      s.src = '/aratu-jogo.js?v=1';
      s.onload = function () { abrindo = false; if (window.maratuJogo) window.maratuJogo.abrir(); };
      s.onerror = function () { abrindo = false; };
      document.head.appendChild(s);
    }
    container.addEventListener('click', pegou);
    container.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pegou(); } });
    container.tabIndex = 0;

    // Só anima com o rodapé na tela.
    var visible = false;
    var rafId = 0;

    function animate() {
      if (!visible) { rafId = 0; return; }
      rafId = requestAnimationFrame(animate);
      var now = Date.now();

      var r = container.getBoundingClientRect();
      var dx = r.left + crabWidth / 2 - mouseX;
      var dy = r.top + r.height / 2 - mouseY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < FLEE_RADIUS && dist > 0) {
        direction = dx > 0 ? 1 : -1;
        velocityBoost = FLEE_BOOST;
        lastFleeTime = now;
      } else {
        var t = now - lastFleeTime;
        velocityBoost = t < FLEE_RECOVERY_MS ? FLEE_BOOST * (1 - t / FLEE_RECOVERY_MS) : 0;
      }

      posX += (WALK_SPEED + velocityBoost) * direction;
      // encurralado na borda ele para: é aí que dá pra pegar
      if (posX <= 0) { posX = 0; direction = 1; }
      else if (posX >= arenaWidth - crabWidth) { posX = arenaWidth - crabWidth; direction = -1; }

      var fugindo = velocityBoost > 0.5;
      if (now - ultimoPasso > (fugindo ? 90 : 240)) {
        ultimoPasso = now; passo = !passo;
        if (!piscaAte && Math.random() < 0.05) piscaAte = now + 160;
        if (piscaAte && now > piscaAte) piscaAte = 0;
        desenha(cv, passo, !!piscaAte);
      }
      var wiggle = Math.sin(now / (fugindo ? 80 : 200)) * (fugindo ? 2 : 0.8);
      container.style.transform = 'translate(' + posX + 'px, ' + wiggle.toFixed(2) + 'px) scaleX(' + direction + ')';
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(entries) {
        visible = entries[0].isIntersecting;
        if (visible) {
          arenaWidth = footer.offsetWidth || window.innerWidth;
          crabWidth = container.offsetWidth || 60;
          if (!rafId) rafId = requestAnimationFrame(animate);
        }
      }).observe(footer);
    } else {
      visible = true;
      rafId = requestAnimationFrame(animate);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
