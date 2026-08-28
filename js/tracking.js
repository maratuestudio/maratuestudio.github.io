/* MARATU — tracking GA4:
   - clique_encomendar: um unico evento com parametro produto (loja) — INALTERADO
   - clique_servico:    evento separado {servico, origem} (pagina /servicos e links pra ela)
   Os dois nunca colidem: quem tem [data-servico] dispara clique_servico e sai antes
   de chegar no bloco do clique_encomendar. */
(function () {
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;

    // clique_servico — qualquer elemento marcado com data-servico
    // (CTAs de WhatsApp da /servicos e links que levam pra /servicos: card da loja, rodape, menu)
    var sv = t.closest('[data-servico]');
    if (sv) {
      if (typeof gtag === 'function') {
        gtag('event', 'clique_servico', {
          servico: sv.getAttribute('data-servico') || 'geral',
          origem: sv.getAttribute('data-origem') || 'pagina_servicos'
        });
      }
      return; // separa os eventos: nao deixa cair no clique_encomendar
    }

    // clique_encomendar — loja (inalterado)
    var el = t.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"], .btn-encomendar[data-produto]');
    if (!el) return;

    /* "Avisar quando voltar", da peça sem estoque, também abre o WhatsApp, mas não é
       encomenda: se cair no clique_encomendar, a demanda por produto do painel passa a
       contar interesse como pedido. Evento próprio, mesma ideia do clique_servico. */
    if (el.getAttribute('data-origem') === 'indisponivel') {
      if (typeof gtag === 'function') {
        gtag('event', 'avisar_voltar', { produto: el.getAttribute('data-produto') || 'nao_identificado' });
      }
      return;
    }

    /* O botão do card virou carrinho: "Adicionar" põe no carrinho e "Escolher" abre a
       página. Nenhum dos dois é encomenda. Quem conta esses cliques é o add_to_cart e o
       select_item; deixar cair aqui inflaria a demanda por produto do painel. */
    var origem = el.getAttribute('data-origem');
    if (origem === 'card' || origem === 'card-escolher') return;
    var produto = el.getAttribute('data-produto')
      || (el.closest('[data-produto]') ? el.closest('[data-produto]').getAttribute('data-produto') : null)
      || 'nao_identificado';
    if (typeof gtag === 'function') {
      gtag('event', 'clique_encomendar', { produto: produto });
    }
  }, true);
})();
