/* MARATU admin — conserta o clique desalinhado do Safari ao trocar de aba.
   Sintoma (2026-07-25): saindo do Painel (pagina comprida) rolado pra baixo e indo pra uma aba
   curta, o Safari mantem o scrollY antigo mesmo sem ter o que rolar (scrollY=246 com pagina de
   755 numa janela de 755). Ele PINTA no lugar certo mas calcula o clique com o deslocamento
   velho, entao todo clique cai fora e parece que a tela travou.
   Cura: ao trocar de aba, voltar pro topo; e um guarda que grampeia scrollY sempre que ele
   passar do maximo possivel. Ver reference_maratu_falso_travamento. */
(function () {
  "use strict";
  if (window.__maratuScrollFix) return;
  window.__maratuScrollFix = true;

  function maximo() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  /* Grampeia se o scroll passou do que a pagina comporta. Chamado depois de tudo que muda
     a altura da pagina. Retorna true se precisou corrigir. */
  function grampear() {
    var max = maximo();
    if (window.scrollY > max + 1) { window.scrollTo(0, max); return true; }
    return false;
  }

  function aoTopo() {
    try { window.scrollTo(0, 0); } catch (e) { document.documentElement.scrollTop = 0; }
  }

  // troca de aba: sempre comeca a aba nova pelo topo (e o que o usuario espera de qualquer jeito)
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest("[data-tab]") && !t.closest("#leadsCard")) return;
    // depois do handler do core trocar o painel e o layout assentar
    setTimeout(aoTopo, 0);
    setTimeout(aoTopo, 120);
  }, false);

  // rede de seguranca: qualquer mudanca de altura do painel (render, sub-aba, filtro)
  var pendente = null;
  function agendarGrampo() {
    clearTimeout(pendente);
    pendente = setTimeout(grampear, 90);
  }
  try {
    var alvo = document.querySelector("main") || document.body;
    new MutationObserver(agendarGrampo).observe(alvo, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  } catch (e) {}
  window.addEventListener("resize", agendarGrampo);
  window.addEventListener("orientationchange", agendarGrampo);
})();
