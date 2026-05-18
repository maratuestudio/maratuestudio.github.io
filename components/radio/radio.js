/* Radio MARATU — lógica do player
   Playlist Spotify: 1JwBGozDx60NsCv4e4oalJ */
(function() {
  const radio = document.getElementById('maratu-radio');
  const body = document.getElementById('mr-body');
  const panel = document.getElementById('mr-panel');
  const iframeWrap = document.getElementById('mr-iframe-wrap');
  const display = document.getElementById('mr-display');
  const bottomLabel = document.getElementById('mr-bottom-label');

  const PLAYLIST_ID = '1JwBGozDx60NsCv4e4oalJ';
  const embedHTML = `<iframe src="https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?utm_source=generator&theme=0" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;

  let on = false;

  function toggle() {
    on = !on;
    if (on) {
      radio.classList.add('on');
      display.textContent = 'NO AR';
      bottomLabel.textContent = 'TOCANDO';
      iframeWrap.innerHTML = embedHTML;
      panel.classList.add('open');
    } else {
      radio.classList.remove('on');
      display.textContent = '88.5 FM';
      bottomLabel.textContent = 'DESLIGADO';
      panel.classList.remove('open');
      setTimeout(() => { if (!on) iframeWrap.innerHTML = ''; }, 400);
    }
  }

  body.addEventListener('click', toggle);
  body.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
})();
