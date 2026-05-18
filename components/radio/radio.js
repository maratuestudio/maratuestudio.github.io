/* Radio MARATU — dropdown header + chiado via Web Audio API */
(function () {
  var PLAYLIST = '1JwBGozDx60NsCv4e4oalJ';
  var btn = document.getElementById('mr-btn');
  var drop = document.getElementById('mr-drop');
  var inner = document.getElementById('mr-drop-inner');
  if (!btn || !drop || !inner) return;

  var on = false;

  function playStatic() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var bufLen = ctx.sampleRate * 0.45;
      var buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

      var src = ctx.createBufferSource();
      src.buffer = buf;

      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(3200, ctx.currentTime + 0.2);
      filter.Q.value = 0.8;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  }

  function toggle() {
    on = !on;
    playStatic();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-expanded', String(on));
    if (on) {
      inner.innerHTML = '<iframe src="https://open.spotify.com/embed/playlist/' + PLAYLIST + '?utm_source=generator&theme=0" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>';
      drop.classList.add('open');
    } else {
      drop.classList.remove('open');
      setTimeout(function () { if (!on) inner.innerHTML = ''; }, 380);
    }
  }

  btn.addEventListener('click', toggle);
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  document.addEventListener('click', function (e) {
    if (on && !btn.contains(e.target) && !drop.contains(e.target)) {
      on = false;
      playStatic();
      btn.classList.remove('on');
      btn.setAttribute('aria-expanded', 'false');
      drop.classList.remove('open');
      setTimeout(function () { inner.innerHTML = ''; }, 380);
    }
  });
})();
