/* MARATU admin — modulo "Barra". So no rodape do celular (<=720px), onde .tabs vira barra fixa.

   Comportamento copiado da barra do iOS 26, conferido antes de escrever:
     - encostar e arrastar move o realce junto com o dedo, 1 pra 1, sem atraso;
     - o rotulo por onde o dedo passa acende na hora;
     - a troca de aba so acontece quando o dedo SOLTA, nunca durante o arraste;
     - ao soltar, a peca assenta na aba com mola.
   Fica de fora o efeito de vidro (lente e aberracao), que o Rapha disse nao precisar.

   Como e feito: um <span> absoluto atras das abas, com outro dentro. Duas camadas de
   proposito: a de fora anda, a de dentro estica. Numa camada so as duas animacoes disputam
   a mesma transicao e o estico praticamente nao aparece (medido: ficava em 1.02).
   Durante o arraste a transicao da camada de fora e desligada, senao ela corre atras do
   dedo em vez de acompanhar.

   As abas sao flex:1 1 0, entao todas tem a mesma largura e nao e preciso animar width,
   que forcaria layout a cada quadro. Nao toca no admin.js minificado: le o aria-selected
   que ele mantem, e no fim do arraste dispara o click que ele ja escuta. */
(function () {
  "use strict";
  if (window.__maratuBarra) return;
  window.__maratuBarra = true;

  var MQ = "(max-width:720px)";
  var LIMIAR = 7;             // px de movimento pra virar arraste em vez de toque
  var ind = null, pilula = null, tabs = null;
  var ultimoX = null, volta = null;
  var arrastando = false, comecouEm = 0, alvo = null, xAnterior = 0, tAnterior = 0;

  var CSS =
    "@media " + MQ + "{" +
    /* NAO adicionar position aqui: o .tabs original ja faz fixed nesta media query, e
       repetir com especificidade de ID grudaria o valor se um dia mudar pra sticky. */
    "  #tabs{touch-action:none}" +
    "  #tabs .tab{position:relative;z-index:1;background:transparent!important;" +
    "    transition:color .32s ease}" +
    "  #tabs .tab[aria-selected=\"true\"]{color:var(--selected-fg,var(--areia))}" +
    /* durante o arraste quem manda e o dedo, nao o aria-selected */
    "  #tabs.mrt-arrastando .tab{color:var(--preto);transition:color .12s ease}" +
    "  #tabs.mrt-arrastando .tab.mrt-alvo{color:var(--selected-fg,var(--areia))}" +
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

  function abas() { return tabs ? [].slice.call(tabs.querySelectorAll(".tab")) : []; }
  function selecionada() { return tabs && tabs.querySelector('.tab[aria-selected="true"]'); }
  function menosMovimento() { return window.matchMedia("(prefers-reduced-motion:reduce)").matches; }
  function medidas(el) { return { x: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight, t: el.offsetTop }; }

  /* posiciona a peca. animar=false gruda sem transicao (carga, giro de tela, arraste) */
  function poe(x, m, animar, estica) {
    ind.style.width = m.w + "px";
    ind.style.height = m.h + "px";
    ind.style.top = m.t + "px";
    if (!animar) {
      ind.classList.add("parada");
      ind.style.transform = "translateX(" + x + "px)";
      void ind.offsetHeight;
      ind.classList.remove("parada");
    } else {
      ind.style.transform = "translateX(" + x + "px)";
    }
    if (estica != null && !menosMovimento()) {
      pilula.style.transform = "scaleX(" + estica.toFixed(3) + ")";
      clearTimeout(volta);
      volta = setTimeout(function () { pilula.style.transform = "scaleX(1)"; }, 195);
    }
    ultimoX = x;
  }

  /* fora do arraste: vai pra aba selecionada */
  function paraSelecionada(animar) {
    if (!ind || !window.matchMedia(MQ).matches) return;
    var el = selecionada();
    if (!el || !el.offsetWidth) return;
    var m = medidas(el);
    var estica = null;
    if (animar && ultimoX !== null) {
      var dist = Math.abs(m.x - ultimoX);
      estica = Math.min(1.16, 1 + dist / (m.w * 6));
    }
    poe(m.x, m, animar && ultimoX !== null, estica);
  }

  /* ---------- arraste ---------- */

  function abaSob(clientX) {
    var lista = abas();
    if (!lista.length) return null;
    var r = tabs.getBoundingClientRect();
    var melhor = lista[0], menor = Infinity;
    for (var i = 0; i < lista.length; i++) {
      var m = medidas(lista[i]);
      var d = Math.abs(clientX - (r.left + m.x + m.w / 2));
      if (d < menor) { menor = d; melhor = lista[i]; }
    }
    return melhor;
  }

  function marcaAlvo(el) {
    if (alvo === el) return;
    abas().forEach(function (b) { b.classList.toggle("mrt-alvo", b === el); });
    alvo = el;
  }

  function aoDescer(e) {
    if (!window.matchMedia(MQ).matches || !ind) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!(e.target.closest && e.target.closest(".tab"))) return;
    comecouEm = e.clientX;
    xAnterior = e.clientX; tAnterior = e.timeStamp;
    arrastando = false;
    try { tabs.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function aoMover(e) {
    if (!comecouEm || !ind) return;
    if (!arrastando) {
      if (Math.abs(e.clientX - comecouEm) < LIMIAR) return;
      arrastando = true;
      tabs.classList.add("mrt-arrastando");
      marcaAlvo(selecionada());
    }
    e.preventDefault();

    var lista = abas();
    if (!lista.length) return;
    var pri = medidas(lista[0]), ult = medidas(lista[lista.length - 1]);
    var r = tabs.getBoundingClientRect();
    var m = medidas(selecionada() || lista[0]);
    // centro da peca no dedo, presa dentro da barra
    var x = Math.max(pri.x, Math.min(ult.x, e.clientX - r.left - m.w / 2));

    // estica conforme a velocidade do dedo, como a peca da Apple faz
    var dt = Math.max(1, e.timeStamp - tAnterior);
    var v = Math.abs(e.clientX - xAnterior) / dt;      // px por ms
    xAnterior = e.clientX; tAnterior = e.timeStamp;

    poe(x, m, false, null);                            // 1 pra 1, sem transicao
    if (!menosMovimento()) {
      clearTimeout(volta);
      pilula.style.transform = "scaleX(" + Math.min(1.18, 1 + v * 0.16).toFixed(3) + ")";
    }
    marcaAlvo(abaSob(e.clientX));
  }

  function aoSubir(e) {
    if (!comecouEm) return;
    var eraArraste = arrastando;
    var destino = alvo;
    comecouEm = 0; arrastando = false;
    try { tabs.releasePointerCapture(e.pointerId); } catch (err) {}
    tabs.classList.remove("mrt-arrastando");
    abas().forEach(function (b) { b.classList.remove("mrt-alvo"); });
    alvo = null;
    clearTimeout(volta);
    pilula.style.transform = "scaleX(1)";

    if (!eraArraste) return;                           // foi toque: o click nativo resolve
    e.preventDefault();
    suprimeProximoClique();
    if (destino && destino.getAttribute("aria-selected") !== "true") destino.click();
    var m = medidas(destino || selecionada());
    poe(m.x, m, true, null);                           // assenta com mola
  }

  /* O navegador dispara um click no fim do arraste, na aba onde o dedo comecou. Sem
     suprimir, a aba de origem seria reselecionada por baixo dos panos.
     So o click do navegador (isTrusted) e barrado: o que eu disparo no destino tem que
     passar, senao o arraste nao troca aba nenhuma. */
  function suprimeProximoClique() {
    var f = function (ev) { if (ev.isTrusted) { ev.stopPropagation(); ev.preventDefault(); } };
    tabs.addEventListener("click", f, true);
    setTimeout(function () { tabs.removeEventListener("click", f, true); }, 350);
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

    try {
      new MutationObserver(function () { if (!arrastando) paraSelecionada(true); })
        .observe(tabs, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
    } catch (e) {}

    tabs.addEventListener("pointerdown", aoDescer);
    tabs.addEventListener("pointermove", aoMover, { passive: false });
    tabs.addEventListener("pointerup", aoSubir);
    tabs.addEventListener("pointercancel", function () {
      comecouEm = 0; arrastando = false;
      tabs.classList.remove("mrt-arrastando");
      abas().forEach(function (b) { b.classList.remove("mrt-alvo"); });
      alvo = null;
      paraSelecionada(true);
    });

    addEventListener("resize", function () { paraSelecionada(false); });
    addEventListener("orientationchange", function () { setTimeout(function () { paraSelecionada(false); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { paraSelecionada(false); });

    paraSelecionada(false);
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
