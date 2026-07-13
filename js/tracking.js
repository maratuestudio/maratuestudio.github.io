/* MARATU — tracking GA4: um unico evento clique_encomendar com parametro produto */
(function () {
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest &&
      ev.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"], .btn-encomendar[data-produto]');
    if (!el) return;
    var produto = el.getAttribute('data-produto')
      || (el.closest('[data-produto]') ? el.closest('[data-produto]').getAttribute('data-produto') : null)
      || 'nao_identificado';
    if (typeof gtag === 'function') {
      gtag('event', 'clique_encomendar', { produto: produto });
    }
  }, true);
})();
