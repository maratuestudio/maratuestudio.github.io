/* Radio MARATU */
(function () {
  var PLAYLIST = '1JwBGozDx60NsCv4e4oalJ';
  var btn   = document.getElementById('mr-btn');
  var drop  = document.getElementById('mr-drop');
  var inner = document.getElementById('mr-drop-inner');
  var disp  = document.getElementById('mr-display');
  if (!btn || !drop || !inner) return;

  var on = false;

  function playStatic() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var dur = 0.9;
      var sr  = ctx.sampleRate;

      /* ruído rosa suave — base do chiado */
      var buf = ctx.createBuffer(1, sr * dur, sr);
      var data = buf.getChannelData(0);
      var b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (var i = 0; i < data.length; i++) {
        var w = Math.random() * 2 - 1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.05;
        b6 = w * 0.115926;
      }
      var noise = ctx.createBufferSource();
      noise.buffer = buf;

      /* filtro que varre frequências — efeito sintonizando */
      var filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = 1.2;
      filt.frequency.setValueAtTime(400, ctx.currentTime);
      filt.frequency.linearRampToValueAtTime(1800, ctx.currentTime + 0.35);
      filt.frequency.linearRampToValueAtTime(900,  ctx.currentTime + 0.6);
      filt.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.9);

      /* envelope suave: entra e sai devagar */
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.45);
      gain.gain.linearRampToValueAtTime(0,    ctx.currentTime + dur);

      noise.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      noise.start(); noise.stop(ctx.currentTime + dur);
    } catch(e) {}
  }

  function toggle() {
    on = !on;
    playStatic();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-expanded', String(on));
    if (disp) disp.textContent = on ? 'NO\nAR' : '88.5\nFM';
    if (on) {
      inner.innerHTML = '<iframe src="https://open.spotify.com/embed/playlist/' + PLAYLIST + '?utm_source=generator&theme=0" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>';
      drop.classList.add('open');
    } else {
      drop.classList.remove('open');
      setTimeout(function() { if (!on) inner.innerHTML = ''; }, 380);
    }
  }

  btn.addEventListener('click', toggle);
  btn.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  document.addEventListener('click', function(e) {
    if (on && !btn.contains(e.target) && !drop.contains(e.target)) {
      on = false; playStatic();
      btn.classList.remove('on');
      btn.setAttribute('aria-expanded', 'false');
      if (disp) disp.textContent = '88.5\nFM';
      drop.classList.remove('open');
      setTimeout(function() { inner.innerHTML = ''; }, 380);
    }
  });
})();
