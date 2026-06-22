document.addEventListener('DOMContentLoaded', function () {
  var botoes = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
  botoes.forEach(function (link) {
    link.addEventListener('click', function () {
      var produto = link.getAttribute('data-produto')
        || (link.closest('[data-produto]') ? link.closest('[data-produto]').getAttribute('data-produto') : null)
        || 'nao_identificado';
      if (typeof gtag === 'function') {
        gtag('event', 'clique_encomendar', { produto: produto });
      }
    });
  });
});
