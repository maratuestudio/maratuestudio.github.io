/* MARATU admin — no celular a agenda abre no MES, nao na semana.

   Motivo, medido no WebKit 26 com iPhone 14 Pro Max antes de mexer: a semana de
   7 colunas da 51px por dia, o bloco do evento fica com 42px, e o titulo precisa
   de 50px tendo 23px de espaco. Todo compromisso saia cortado ("Reunia Wordt")
   e vazava 93px de texto numa caixa de 44px. No mes a celula vira ponto por tipo
   (CSS no admin.html) e o toque abre o painel do dia, que ja existia.

   NAO forca a vista toda hora. Se o Rapha trocar pra semana no celular, a escolha
   fica guardada e passa a valer nas proximas aberturas. O mes so entra quando
   ainda nao ha escolha nenhuma.

   ARMADILHA: nao dar new na vista pelo estado interno (calView) nem chamar
   renderMonth direto. O toggle do core faz tres coisas (troca calView, move a
   classe .on e liga/desliga o display de #calGrid e #calWeek). Clicar no botao
   passa por esse caminho inteiro. Como o listener do core so existe depois que o
   admin.js roda, aqui tenta por ate 2s ate o clique pegar de verdade. */
(function () {
  "use strict";
  if (window.__maratuMesMob) return;
  window.__maratuMesMob = true;

  var MQ = "(max-width:720px)";
  var CHAVE = "maratu.calview.mob";
  var LIMITE = 2000, PASSO = 120;

  function botao(vista) {
    return document.querySelector('#calViewToggle button[data-view="' + vista + '"]');
  }

  /* guarda a escolha assim que ele encostar no toggle, no celular */
  function lembrar() {
    var wrap = document.getElementById("calViewToggle");
    if (!wrap) return;
    wrap.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-view]");
      if (!b || !window.matchMedia(MQ).matches) return;
      try { localStorage.setItem(CHAVE, b.dataset.view); } catch (err) {}
    });
  }

  function aplicar() {
    if (!window.matchMedia(MQ).matches) return true;

    var escolhido = null;
    try { escolhido = localStorage.getItem(CHAVE); } catch (err) {}
    var alvo = escolhido || "month";
    if (alvo === "week") return true;

    var b = botao(alvo);
    if (!b) return false;
    if (b.classList.contains("on")) return true;
    b.click();
    return b.classList.contains("on");
  }

  function insistir(gasto) {
    if (aplicar()) return;
    if (gasto >= LIMITE) return;
    setTimeout(function () { insistir(gasto + PASSO); }, PASSO);
  }

  function iniciar() { lembrar(); insistir(0); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
