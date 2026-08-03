/* MARATU admin — a barra de baixo para de subir ao trocar de aba.

   O SINTOMA (so no iPhone em PWA): trocando de aba, a barra flutuante do rodape ia parar
   uns 40pt acima do lugar. Medindo os prints: na aba Painel a folga ate o fundo era ~32pt,
   que e o certo (o valor da safe area), e na aba Orcamento ~72pt.

   O MECANISMO: a barra e `position:fixed`, mas mora DENTRO do `.wrap`. Fixed so se ancora
   na tela enquanto nenhum ancestral tiver transform, filter, backdrop-filter, perspective,
   will-change ou contain. Se qualquer um deles aparecer, mesmo por um instante de animacao,
   o `.wrap` vira o containing block e o `bottom` passa a contar a partir do fim do WRAP.
   Numa aba curta o wrap termina antes do fim da tela: e exatamente ai que a barra sobe.
   Confirmado no WebKit: com um transform no `.wrap`, a folga vai de 8px para -78px.

   Como o gatilho e de runtime e nao aparece no emulador, aqui vao duas defesas em vez de
   uma cura para uma causa que eu nao consegui isolar:

   1. TIRA A BARRA DE DENTRO DO WRAP. No celular ela passa a ser filha do <body>, entao
      nenhum estilo aplicado la dentro alcanca mais ela. E o mesmo remedio que ja foi usado
      no menu Ajustes quando ele ficava clipado. No desktop ela volta pro lugar de origem,
      porque la ela e um elemento no fluxo, nao um balao fixo.

   2. VIGIA A POSICAO. Depois de cada troca de aba, giro de tela ou mudanca de viewport,
      mede a folga real ate o fundo e compara com a esperada (a safe area do aparelho, ou
      8px onde nao houver). Se divergir, corrige o `bottom`. Assim, se o gatilho for outro
      (safe area contada duas vezes, viewport visual deslocada pelo teclado), a barra volta
      pro lugar sozinha.

   Corrige `bottom`, nunca `transform`: transform na barra criaria containing block para o
   que estiver dentro dela, que e o tipo de armadilha que causou o problema em primeiro lugar. */
(function () {
  "use strict";
  if (window.__maratuBarraAncora) return;
  window.__maratuBarraAncora = true;

  var MQ = "(max-width:720px)";
  var TOLERANCIA = 1.5;   /* px de erro que nao vale mexer */
  var LIMITE = 400;       /* correcao maior que isso e medida bizarra, melhor nao mexer */
  var origem = null;      /* de onde a barra saiu, pra saber devolver */
  var movendo = false;    /* o resize que eu mesmo disparo nao pode reentrar aqui */

  function barra() { return document.getElementById("tabs") || document.querySelector(".tabs"); }

  /* le env(safe-area-inset-bottom) deste aparelho */
  var sonda = null;
  function safeArea() {
    if (!sonda) {
      sonda = document.createElement("div");
      sonda.style.cssText = "position:fixed;left:-9999px;bottom:0;width:0;height:0;" +
        "padding-bottom:env(safe-area-inset-bottom);pointer-events:none";
      (document.body || document.documentElement).appendChild(sonda);
    }
    var v = parseFloat(getComputedStyle(sonda).paddingBottom);
    return isNaN(v) ? 0 : v;
  }

  function mobile() { return window.matchMedia(MQ).matches; }

  function mover() {
    var t = barra();
    if (!t || movendo) return;
    if (mobile()) {
      if (t.parentElement === document.body) return;
      origem = { pai: t.parentElement, depois: t.nextElementSibling };
      movendo = true;
      document.body.appendChild(t);
      window.dispatchEvent(new Event("resize")); /* admin-barra.js recoloca a pilula */
      movendo = false;
    } else if (origem && t.parentElement === document.body) {
      movendo = true;
      if (origem.depois && origem.depois.parentElement === origem.pai) origem.pai.insertBefore(t, origem.depois);
      else origem.pai.appendChild(t);
      origem = null;
      t.style.bottom = "";
      window.dispatchEvent(new Event("resize"));
      movendo = false;
    }
  }

  function ajustar() {
    var t = barra();
    if (!t) return;
    var cs = getComputedStyle(t);
    if (cs.position !== "fixed") { t.style.bottom = ""; return; }

    var alvo = Math.max(safeArea(), 8);
    var r = t.getBoundingClientRect();
    if (!r.height) return;
    var erro = (window.innerHeight - r.bottom) - alvo;
    if (Math.abs(erro) <= TOLERANCIA || Math.abs(erro) > LIMITE) return;

    var atual = parseFloat(cs.bottom);
    if (isNaN(atual)) atual = alvo;
    t.style.bottom = (atual - erro) + "px";
  }

  function conferir() {
    mover();
    ajustar();
    /* uma segunda passada: a primeira correcao pode mudar a propria medida */
    requestAnimationFrame(ajustar);
  }

  function agendar() {
    conferir();
    setTimeout(conferir, 120);
    setTimeout(conferir, 400);  /* depois da animacao de troca de painel (190ms) */
  }

  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("[data-tab]")) agendar();
  }, true);

  window.addEventListener("resize", agendar);
  window.addEventListener("orientationchange", function () { setTimeout(agendar, 150); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", conferir);
    window.visualViewport.addEventListener("scroll", conferir);
  }

  function iniciar() { agendar(); setTimeout(conferir, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
