/* MARATU admin — barra de baixo do celular (<=720px), onde .tabs vira barra fixa.

   Faz duas coisas:
   1. O preto da selecao deixa de piscar de um item pro outro e passa a ser UMA peca que
      corre, esticando um pouco no caminho.
   2. Arrastar o dedo pela barra leva a peca junto, 1 pra 1, acendendo o rotulo por onde
      passa. A aba so troca quando o dedo SOLTA. E o comportamento da barra do iOS 26.

   DUAS ARMADILHAS JA PAGAS, nao repetir:
   - NAO chamar setPointerCapture no pointerdown. A captura faz o click seguinte ser
     entregue ao #tabs em vez do item, e o admin.js escuta em CADA aba: tocar numa aba
     parava de trocar de painel. Aqui nao ha captura nenhuma; o movimento e escutado no
     document, que ja cobre o dedo saindo da barra.
   - Ao testar, ligar o listener em CADA aba, como o admin faz. Com listener delegado no
     container o teste passa mesmo com o bug.

   A engrenagem nao e uma .tab, e um botao proprio dentro de .gear-wrap. Pra geometria uso
   o wrap, que e quem ocupa a fatia na barra; o botao tem offsetParent proprio e daria
   offsetLeft zero. */
(function () {
  "use strict";
  if (window.__maratuBarra) return;
  window.__maratuBarra = true;

  var MQ = "(max-width:720px)";
  var LIMIAR = 8;             // px de movimento pra virar arraste em vez de toque
  var ind = null, pilula = null, tabs = null;
  var ultimoX = null, volta = null;
  var arrastando = false, comecouEm = null, alvo = null, xAnterior = 0, tAnterior = 0;

  var CSS =
    "@media " + MQ + "{" +
    /* sem isto o navegador trata o gesto como rolagem e CANCELA o ponteiro no primeiro
       movimento (chega um pointermove so, e vem pointercancel logo atras). Era o que
       o setPointerCapture mascarava; aqui a solucao e declarar a intencao no CSS. */
    "  #tabs{touch-action:none}" +
    "  #tabs .tab,#tabs .gear-wrap,#tabs .head-menu-btn{position:relative;z-index:1;" +
    "    background:transparent!important;transition:color .32s ease}" +
    "  #tabs .tab[aria-selected=\"true\"],#tabs .head-menu-btn[aria-selected=\"true\"]{" +
    "    color:var(--selected-fg,var(--areia))}" +
    "  #tabs.mrt-arrastando .tab,#tabs.mrt-arrastando .head-menu-btn{" +
    "    color:var(--preto);transition:color .12s ease}" +
    "  #tabs.mrt-arrastando .mrt-alvo,#tabs.mrt-arrastando .mrt-alvo .head-menu-btn{" +
    "    color:var(--selected-fg,var(--areia))}" +
    "  .mrt-ind{position:absolute;left:0;top:0;z-index:0;pointer-events:none;" +
    "    transition:transform .32s cubic-bezier(.32,1.30,.42,1);will-change:transform}" +
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

  function noToque() { return window.matchMedia(MQ).matches; }
  function menosMovimento() { return window.matchMedia("(prefers-reduced-motion:reduce)").matches; }
  function itens() { return tabs ? [].slice.call(tabs.querySelectorAll(".tab, .gear-wrap")) : []; }
  function medidas(el) { return { x: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight, t: el.offsetTop }; }

  function selecionado() {
    if (!tabs) return null;
    var t = tabs.querySelector('.tab[aria-selected="true"]');
    if (t) return t;
    var g = tabs.querySelector('.head-menu-btn[aria-selected="true"]');
    return g ? (g.closest(".gear-wrap") || g) : null;
  }

  function poe(x, m, animar) {
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
    ultimoX = x;
  }

  function paraSelecionado(animar) {
    if (!ind || !noToque()) return;
    var el = selecionado();
    if (!el || !el.offsetWidth) return;
    var m = medidas(el);
    var anima = animar && ultimoX !== null;
    var antes = ultimoX;
    poe(m.x, m, anima);
    if (anima && !menosMovimento()) {
      var estica = Math.min(1.16, 1 + Math.abs(m.x - antes) / (m.w * 6));
      pilula.style.transform = "scaleX(" + estica.toFixed(3) + ")";
      clearTimeout(volta);
      volta = setTimeout(function () { pilula.style.transform = "scaleX(1)"; }, 195);
    }
  }

  /* ---------- arraste ---------- */

  function sobODedo(clientX) {
    var lista = itens();
    if (!lista.length) return null;
    var r = tabs.getBoundingClientRect(), melhor = lista[0], menor = Infinity;
    for (var i = 0; i < lista.length; i++) {
      var m = medidas(lista[i]);
      var d = Math.abs(clientX - (r.left + m.x + m.w / 2));
      if (d < menor) { menor = d; melhor = lista[i]; }
    }
    return melhor;
  }

  function marcaAlvo(el) {
    if (alvo === el) return;
    itens().forEach(function (b) { b.classList.toggle("mrt-alvo", b === el); });
    alvo = el;
  }

  function limpa() {
    comecouEm = null; arrastando = false; alvo = null;
    if (tabs) tabs.classList.remove("mrt-arrastando");
    itens().forEach(function (b) { b.classList.remove("mrt-alvo"); });
    clearTimeout(volta);
    if (pilula) pilula.style.transform = "scaleX(1)";
  }

  function aoDescer(e) {
    if (!noToque() || !ind) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!(e.target.closest && e.target.closest(".tab, .gear-wrap"))) return;
    comecouEm = e.clientX;
    xAnterior = e.clientX; tAnterior = e.timeStamp;
    arrastando = false;
    // sem setPointerCapture de proposito: ele desviaria o click do item pro #tabs
  }

  function aoMover(e) {
    if (comecouEm === null || !ind) return;
    if (!arrastando) {
      if (Math.abs(e.clientX - comecouEm) < LIMIAR) return;
      arrastando = true;
      tabs.classList.add("mrt-arrastando");
      marcaAlvo(selecionado());
    }
    if (e.cancelable) e.preventDefault();

    var lista = itens();
    if (!lista.length) return;
    var pri = medidas(lista[0]), ult = medidas(lista[lista.length - 1]);
    var r = tabs.getBoundingClientRect();
    var m = medidas(selecionado() || lista[0]);
    var x = Math.max(pri.x, Math.min(ult.x, e.clientX - r.left - m.w / 2));

    var dt = Math.max(1, e.timeStamp - tAnterior);
    var v = Math.abs(e.clientX - xAnterior) / dt;
    xAnterior = e.clientX; tAnterior = e.timeStamp;

    poe(x, m, false);
    if (!menosMovimento()) {
      clearTimeout(volta);
      pilula.style.transform = "scaleX(" + Math.min(1.18, 1 + v * 0.16).toFixed(3) + ")";
    }
    marcaAlvo(sobODedo(e.clientX));
  }

  function aoSubir() {
    if (comecouEm === null) return;
    var eraArraste = arrastando, destino = alvo;
    limpa();
    if (!eraArraste) return;                    // foi toque: o click nativo resolve

    suprimeCliqueDoNavegador();
    if (destino) {
      var clicavel = destino.classList.contains("gear-wrap")
        ? destino.querySelector(".head-menu-btn") : destino;
      if (clicavel && clicavel.getAttribute("aria-selected") !== "true") clicavel.click();
    }
    var m = medidas(destino || selecionado() || itens()[0]);
    if (m) poe(m.x, m, true);
  }

  /* O navegador dispara um click no fim do arraste, no item onde o dedo comecou. Sem
     suprimir, ele reselecionaria a origem. So o click do navegador (isTrusted) e barrado:
     o que eu disparo no destino tem que passar. */
  function suprimeCliqueDoNavegador() {
    var solto = false;
    var f = function (ev) {
      if (solto || !ev.isTrusted) return;
      solto = true;                       // engole SO o clique do proprio arraste
      tabs.removeEventListener("click", f, true);
      ev.stopPropagation(); ev.preventDefault();
    };
    tabs.addEventListener("click", f, true);
    // rede de seguranca curta: se o navegador nao disparar clique nenhum, sai sozinho.
    // Antes eram 350ms fixos e um toque rapido logo apos o arraste era engolido junto.
    setTimeout(function () { tabs.removeEventListener("click", f, true); }, 120);
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

    // a peca acompanha a troca de aba feita pelo admin.js. So LE atributo, nunca escreve:
    // escrever aqui dentro realimentaria o observer e congelaria a pagina.
    try {
      new MutationObserver(function () { if (!arrastando) paraSelecionado(true); })
        .observe(tabs, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
    } catch (e) {}

    tabs.addEventListener("pointerdown", aoDescer);
    document.addEventListener("pointermove", aoMover, { passive: false });
    document.addEventListener("pointerup", aoSubir);
    document.addEventListener("pointercancel", function () { limpa(); paraSelecionado(true); });

    addEventListener("resize", function () { paraSelecionado(false); });
    addEventListener("orientationchange", function () { setTimeout(function () { paraSelecionado(false); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { paraSelecionado(false); });

    paraSelecionado(false);
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
