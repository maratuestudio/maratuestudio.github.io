/* MARATU admin — modulo "Barra". So no rodape do celular (<=720px), onde .tabs vira barra
   fixa. Hoje o preto da aba selecionada troca por fade: some de um lugar e aparece no outro.
   Aqui ele passa a ser UMA peca so, que corre pro lado e estica um pouco no caminho, como a
   barra do iOS. Sem vidro, so o movimento.

   Como funciona: um <span> absoluto atras das abas, com outro <span> dentro. As abas sao
   flex:1 1 0, entao tem todas a mesma largura e basta animar translateX — nada de width, que
   forcaria layout a cada quadro. Sao DUAS camadas de proposito: a de fora anda (mola de 400ms,
   que passa um triquinho do alvo e volta), a de dentro estica (190ms). Numa camada so as duas
   animacoes disputam a mesma transicao e o estico praticamente nao aparece.

   Nao toca no admin.js minificado: le o aria-selected que ele ja mantem. */
(function () {
  "use strict";
  if (window.__maratuBarra) return;
  window.__maratuBarra = true;

  var MQ = "(max-width:720px)";
  var ind = null, pilula = null, tabs = null, ultimoX = null, volta = null;

  var CSS =
    "@media " + MQ + "{" +
    /* NAO adicionar position aqui: o .tabs original ja faz fixed nesta media query, e
       repetir com especificidade de ID grudaria o valor se um dia mudar pra sticky. */
    "  #tabs .tab{position:relative;z-index:1;background:transparent!important;" +
    "    transition:color .32s ease}" +
    "  #tabs .tab[aria-selected=\"true\"]{color:var(--selected-fg,var(--areia))}" +
    "  .mrt-ind{position:absolute;left:0;top:0;z-index:0;pointer-events:none;" +
    "    transition:transform .32s cubic-bezier(.32,1.30,.42,1);" +
    "    will-change:transform}" +
    "  .mrt-ind>span{display:block;width:100%;height:100%;border-radius:999px;" +
    "    background:var(--selected-bg,var(--preto));transform-origin:center;" +
    "    transition:transform .19s cubic-bezier(.2,.9,.3,1);will-change:transform}" +
    "  .mrt-ind.parada,.mrt-ind.parada>span{transition:none}" +
    "}" +
    "@media (prefers-reduced-motion:reduce){.mrt-ind,.mrt-ind>span{transition:none!important}}";

  function estilo() {
    if (document.getElementById("mrt-barra-css")) return;
    var st = document.createElement("style");
    st.id = "mrt-barra-css";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function selecionada() {
    return tabs && tabs.querySelector('.tab[aria-selected="true"]');
  }

  function poe(animar) {
    if (!ind || !window.matchMedia(MQ).matches) return;
    var el = selecionada();
    if (!el || !el.offsetWidth) return;
    var x = el.offsetLeft;
    ind.style.width = el.offsetWidth + "px";
    ind.style.height = el.offsetHeight + "px";
    ind.style.top = el.offsetTop + "px";

    if (!animar || ultimoX === null) {
      ind.classList.add("parada");
      ind.style.transform = "translateX(" + x + "px)";
      pilula.style.transform = "scaleX(1)";
      void ind.offsetHeight;                    // aplica antes de devolver a transicao
      ind.classList.remove("parada");
      ultimoX = x;
      return;
    }

    ind.style.transform = "translateX(" + x + "px)";
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) { ultimoX = x; return; }
    // quanto mais longe o salto, mais ela estica. Teto baixo: passar disso vira borracha.
    var dist = Math.abs(x - ultimoX);
    var estica = Math.min(1.16, 1 + dist / (el.offsetWidth * 6));
    pilula.style.transform = "scaleX(" + estica.toFixed(3) + ")";
    clearTimeout(volta);
    volta = setTimeout(function () { pilula.style.transform = "scaleX(1)"; }, 195);
    ultimoX = x;
  }

  function monta() {
    tabs = document.getElementById("tabs");
    if (!tabs || ind) return !!ind;
    ind = document.createElement("span");
    ind.className = "mrt-ind";
    ind.setAttribute("aria-hidden", "true");
    pilula = document.createElement("span");
    ind.appendChild(pilula);
    tabs.insertBefore(ind, tabs.firstChild);

    // o admin.js troca o aria-selected; e so escutar
    try {
      new MutationObserver(function () { poe(true); })
        .observe(tabs, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
    } catch (e) {}

    addEventListener("resize", function () { poe(false); });
    addEventListener("orientationchange", function () { setTimeout(function () { poe(false); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { poe(false); });

    poe(false);
    return true;
  }

  function boot() {
    estilo();
    if (monta()) return;
    var n = 0;
    var t = setInterval(function () { if (monta() || ++n > 40) clearInterval(t); }, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
