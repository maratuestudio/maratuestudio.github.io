/* MARATU — Mascote Aratu
   Easter egg: aparece ao rolar até o rodapé.
   Anda dentro do footer, foge do mouse/toque quando chega perto. */

(function() {
  'use strict';

  function init() {
    var container = document.querySelector('.aratu-mascote');
    if (!container) return;

    var footer = container.parentElement;
    var svg = container.querySelector('svg');
    var clawLeft = container.querySelector('[data-aratu="claw-left"]');
    var clawRight = container.querySelector('[data-aratu="claw-right"]');
    var bodyMain = container.querySelector('[data-aratu="body"]');
    var eyeLeft = container.querySelector('[data-aratu="eye-left"]');
    var eyeRight = container.querySelector('[data-aratu="eye-right"]');

    if (!svg || !clawLeft || !clawRight || !bodyMain || !eyeLeft || !eyeRight) return;

    var WALK_SPEED = 0.6;
    var FLEE_RADIUS = 80;
    var FLEE_BOOST = 3.5;
    var FLEE_RECOVERY_MS = 1200;

    var posX = 0;
    var direction = 1;
    var velocityBoost = 0;
    var lastFleeTime = 0;
    var mouseX = -9999;
    var mouseY = -9999;
    var lastBlinkTime = Date.now() + 2000;
    var isBlinking = false;
    var blinkStart = 0;
    var crabWidth = container.offsetWidth || 48;
    var arenaWidth = footer.offsetWidth || window.innerWidth;

    window.addEventListener('resize', function() {
      crabWidth = container.offsetWidth || 48;
      arenaWidth = footer.offsetWidth || window.innerWidth;
    });

    window.addEventListener('mousemove', function(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    window.addEventListener('touchmove', function(e) {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', function() {
      mouseX = -9999;
      mouseY = -9999;
      velocityBoost = 0;
      lastFleeTime = 0;
    });

    function animate() {
      requestAnimationFrame(animate);

      var footerRect = footer.getBoundingClientRect();
      if (footerRect.bottom < 0 || footerRect.top > window.innerHeight) return;

      var now = Date.now();
      arenaWidth = footer.offsetWidth || window.innerWidth;

      var containerRect = container.getBoundingClientRect();
      var crabCenterX = containerRect.left + crabWidth / 2;
      var crabCenterY = containerRect.top + containerRect.height / 2;

      var dx = crabCenterX - mouseX;
      var dy = crabCenterY - mouseY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < FLEE_RADIUS && dist > 0) {
        direction = dx > 0 ? 1 : -1;
        velocityBoost = FLEE_BOOST;
        lastFleeTime = now;
      } else {
        var timeSinceFlee = now - lastFleeTime;
        velocityBoost = timeSinceFlee < FLEE_RECOVERY_MS
          ? FLEE_BOOST * (1 - timeSinceFlee / FLEE_RECOVERY_MS)
          : 0;
      }

      var speed = WALK_SPEED + velocityBoost;
      posX += speed * direction;

      if (posX <= 0) { posX = 0; direction = 1; }
      else if (posX >= arenaWidth - crabWidth) { posX = arenaWidth - crabWidth; direction = -1; }

      var facing = direction === 1 ? 1 : -1;
      var isFleeing = velocityBoost > 0.5;

      var clawSpeed = isFleeing ? 120 : 380;
      var clawAmp = isFleeing ? 22 : 10;
      var clawWave = Math.sin(now / clawSpeed);
      clawLeft.setAttribute('transform', 'rotate(' + (clawWave * clawAmp) + ' 48.13 104.77)');
      clawRight.setAttribute('transform', 'rotate(' + (-clawWave * clawAmp) + ' 270.11 104.77)');

      var breatheSpeed = isFleeing ? 200 : 600;
      var breatheAmp = isFleeing ? 0.04 : 0.02;
      var breathe = 1 + Math.sin(now / breatheSpeed) * breatheAmp;
      bodyMain.setAttribute('transform', 'translate(159.12 152.9) scale(1 ' + breathe + ') translate(-159.12 -152.9)');

      if (!isBlinking && now - lastBlinkTime > 2500 + Math.random() * 2000) {
        isBlinking = true;
        blinkStart = now;
      }
      if (isBlinking) {
        var blinkProgress = (now - blinkStart) / 180;
        if (blinkProgress >= 1) {
          isBlinking = false;
          lastBlinkTime = now;
          eyeLeft.setAttribute('transform', 'translate(105.5 24.08) scale(1 1) translate(-105.5 -24.08)');
          eyeRight.setAttribute('transform', 'translate(212.74 24.08) scale(1 1) translate(-212.74 -24.08)');
        } else {
          var blinkScale = blinkProgress < 0.5
            ? 1 - blinkProgress * 2 * 0.9
            : 0.1 + (blinkProgress - 0.5) * 2 * 0.9;
          eyeLeft.setAttribute('transform', 'translate(105.5 24.08) scale(1 ' + blinkScale + ') translate(-105.5 -24.08)');
          eyeRight.setAttribute('transform', 'translate(212.74 24.08) scale(1 ' + blinkScale + ') translate(-212.74 -24.08)');
        }
      }

      var wiggleFreq = isFleeing ? 80 : 200;
      var wiggleAmp = isFleeing ? 2 : 0.8;
      var wiggle = Math.sin(now / wiggleFreq) * wiggleAmp;

      container.style.transform = 'translate(' + posX + 'px, ' + wiggle + 'px) scaleX(' + facing + ')';
    }

    animate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
