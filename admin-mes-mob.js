/* MARATU admin — no celular a agenda abre no MES, nao na semana.

   Motivo, medido no WebKit 26 com iPhone 14 Pro Max antes de mexer: a semana de
   7 colunas da 51px por dia, o bloco do evento fica com 42px, e o titulo precisa
   de 50px tendo 23px de espaco. Todo compromisso saia cortado ("Reunia Wordt")
   e vazava 93px de texto numa caixa de 44px. No mes a celula vira ponto por tipo
   (CSS no admin.html) e o toque abre o painel do dia, que ja existia.

   NAO forca a vista toda hora. Se o Rapha trocar pra semana no celular, a escolha
   fica guardada e passa a valer nas proximas aberturas. O mes so entra quando
   ainda nao ha escolha nenhuma.

   ARMADILHA 1: nao dar new na vista pelo estado interno (calView) nem chamar
   renderMonth direto. O toggle do core faz tres coisas (troca calView, move a
   classe .on e liga/desliga o display de #calGrid e #calWeek). Clicar no botao
   passa por esse caminho inteiro. Como o listener do core so existe depois que o
   admin.js roda, aqui insiste ate o clique pegar de verdade.

   ARMADILHA 2, que quebrou a producao em 03/08/2026: nao basta o botao existir,
   os EVENTOS precisam ter chegado. Clicando antes do /api/state responder, o
   renderMonth ia em eventsByDay -> calItems -> getEventos, e o wrap de marks faz
   `rawGet().filter(...)` em cima de undefined. Com o Worker stubado a resposta era
   instantanea e isso nunca aparecia; no 4G do celular aparecia sempre. Por isso a
   espera aqui e por DADO, chamando o proprio calItems() dentro de try, e nao por
   tempo. E o clique vai dentro de try/catch: essa melhoria nao pode ser capaz de
   derrubar o admin. */
(function () {
  "use strict";
  if (window.__maratuMesMob) return;
  window.__maratuMesMob = true;

  var MQ = "(max-width:720px)";
  var CHAVE = "maratu.calview.mob";
  var LIMITE = 15000, PASSO = 200; /* 4G demora bem mais que os 2s de antes */

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

  /* Os eventos ja chegaram? Pergunta pra propria funcao que o mes vai usar.
     Enquanto o /api/state nao volta, calItems() lanca, e a resposta e "ainda nao". */
  function temDados() {
    if (typeof calItems !== "function") return false;
    try { return Array.isArray(calItems()); } catch (err) { return false; }
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
    if (!temDados()) return false;

    try {
      b.click();
    } catch (err) {
      /* se o core mudar e o clique passar a quebrar, o admin fica na semana,
         que e o comportamento antigo. Melhor do que uma tela de erro. */
      if (window.console && console.warn) console.warn("mes-mob: clique falhou,", err);
      return true;
    }
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
