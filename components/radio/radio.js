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
      var len = ctx.sampleRate * 0.45;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d   = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(800, ctx.currentTime);
      f.frequency.linearRampToValueAtTime(3200, ctx.currentTime + 0.2);
      f.Q.value = 0.8;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(); src.stop(ctx.currentTime + 0.45);
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
