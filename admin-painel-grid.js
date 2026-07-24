/* MARATU admin — modulo "Painel em grid" (anexado, nao toca no admin.js minificado).
   O #panel-painel era uma pilha vertical (display:block + div.spacer). Aqui ele vira um
   grid de colunas fixas e cada bloco ganha uma largura padrao (P/M/G/L). Modo edicao:
   arrastar pra trocar de lugar e escolher a largura. Ordem e largura ficam em
   params.painelLayout (o Worker grava params como blob cru, entao chave nova sobrevive).
   Se este arquivo nao carregar, o painel volta ao empilhado de antes — os .spacer
   continuam no HTML e so sao escondidos daqui. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuPainelGrid) return;
  window.__maratuPainelGrid = true;

  var COLS = 4;                 // colunas no desktop
  var TAMANHOS = [1, 2, 3, 4];  // P, M, G, L (em colunas)
  var ROTULO = { 1: "P", 2: "M", 3: "G", 4: "L" };

  /* Largura padrao e largura minima de cada bloco. O minimo existe porque bloco com
     grid interno (ex: ga4Card) fica ilegivel espremido numa coluna so. */
  var PADRAO = {
    pnWellbeing: { tam: 4, min: 2 },
    pnPend:      { tam: 4, min: 2 },
    meiBlock:    { tam: 4, min: 2 },
    pnMainGrid:  { tam: 4, min: 2 },
    leadsCard:   { tam: 2, min: 1 },
    pnWeekCard:  { tam: 2, min: 1 },
    pnSparkCard: { tam: 2, min: 1 },
    pnSideGrid:  { tam: 4, min: 2 },
    ga4Card:     { tam: 2, min: 2 },
    igCard:      { tam: 2, min: 2 },
    pnRelatCard: { tam: 4, min: 1 }
  };
  var ORDEM_PADRAO = ["pnWellbeing", "pnPend", "meiBlock", "pnMainGrid", "leadsCard",
    "pnWeekCard", "pnSparkCard", "pnSideGrid", "ga4Card", "igCard", "pnRelatCard"];

  var editando = false;
  var layout = null;   // { ordem:[ids], tam:{id:n} }
  var arrastando = null;

  function painel() { return document.getElementById("panel-painel"); }
  function svg(paths, s) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" width="' + (s || 16) + '" height="' + (s || 16) + '">' + paths + "</svg>";
  }
  var IC_EDIT = '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  var IC_OK = '<path d="M20 6L9 17l-5-5"/>';
  var IC_GRAB = '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>';
  var IC_RESET = '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>';

  /* ---------- persistencia (params) ---------- */
  function lerLayout() {
    var p = {};
    try { p = MaratuStore.getParams() || {}; } catch (e) {}
    var L = p.painelLayout;
    var ordem = (L && L.ordem && L.ordem.length) ? L.ordem.slice() : ORDEM_PADRAO.slice();
    var tam = {};
    ORDEM_PADRAO.forEach(function (id) { tam[id] = (PADRAO[id] || {}).tam || 2; });
    if (L && L.tam) Object.keys(L.tam).forEach(function (id) { tam[id] = L.tam[id]; });
    // blocos que existem no DOM mas nao estao na ordem salva entram no fim
    ORDEM_PADRAO.forEach(function (id) { if (ordem.indexOf(id) < 0) ordem.push(id); });
    return { ordem: ordem, tam: tam };
  }
  function salvarLayout() {
    try {
      var p = MaratuStore.getParams() || {};
      p.painelLayout = { ordem: layout.ordem, tam: layout.tam };
      MaratuStore.setParams(p);
    } catch (e) {}
  }

  /* ---------- estilos ---------- */
  function estilos() {
    if (document.getElementById("pgStyles")) return;
    var s = document.createElement("style");
    s.id = "pgStyles";
    s.textContent =
      "#panel-painel.pg-on{display:grid;grid-template-columns:repeat(" + COLS + ",minmax(0,1fr));" +
        "gap:16px;align-items:start}" +
      "#panel-painel.pg-on > .spacer{display:none !important}" +
      /* zera margem de filho direto: o gap do grid ja cuida do respiro, e regras antigas
         como `.chart-card + .chart-card{margin-top:20px}` ou a margem inline do leadsCard
         desalinhavam blocos vizinhos na mesma linha. */
      /* !important porque o leadsCard traz `margin:14px 0 0` inline do admin-leads.js */
      "#panel-painel.pg-on > *{min-width:0;margin:0 !important}" +
      "@media (max-width:1000px){#panel-painel.pg-on{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media (max-width:640px){#panel-painel.pg-on{grid-template-columns:minmax(0,1fr);gap:14px}}" +

      /* barra de edicao */
      "#pgBar{grid-column:1/-1;display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:-4px}" +
      "#pgBar .pg-btn{display:inline-flex;align-items:center;gap:7px;border:1.5px solid var(--preto,#0D0D0B);" +
        "border-radius:12px;background:var(--areia,#F0ECE4);color:var(--preto,#0D0D0B);box-shadow:2px 2px 0 0 var(--preto,#0D0D0B);" +
        "font-family:inherit;font-size:12px;font-weight:800;padding:8px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      "#pgBar .pg-btn:active{transform:translate(1px,1px);box-shadow:1px 1px 0 0 var(--preto,#0D0D0B)}" +
      "#pgBar .pg-btn.pg-primary{background:var(--laranja,#C8501A);color:#fff}" +
      /* display:inline-flex ganha do [hidden] do navegador; sem isso o Padrao vaza fora da edicao */
      "#pgBar .pg-btn[hidden]{display:none}" +

      /* modo edicao */
      "#panel-painel.pg-edit{padding-top:10px}" +
      "#panel-painel.pg-edit > *:not(#pgBar){position:relative;outline:1.5px dashed rgba(13,13,11,.35);" +
        "outline-offset:3px;border-radius:12px;touch-action:none}" +
      /* na borda de cima do bloco (canto tipo iOS), pra cobrir o minimo de conteudo */
      "#panel-painel.pg-edit .pg-tools{position:absolute;top:-15px;right:10px;z-index:30;display:flex;gap:6px;align-items:center}" +
      ".pg-tools .pg-sizes{display:flex;gap:3px;background:var(--areia,#F0ECE4);border:1.5px solid var(--preto,#0D0D0B);" +
        "border-radius:10px;padding:3px;box-shadow:2px 2px 0 0 var(--preto,#0D0D0B)}" +
      ".pg-tools .pg-sz{border:none;background:transparent;color:var(--preto,#0D0D0B);font-family:inherit;font-size:11px;" +
        "font-weight:800;width:22px;height:22px;border-radius:7px;cursor:pointer;padding:0}" +
      ".pg-tools .pg-sz[aria-pressed=\"true\"]{background:var(--laranja,#C8501A);color:#fff}" +
      ".pg-tools .pg-sz:disabled{opacity:.28;cursor:default}" +
      ".pg-tools .pg-grab{display:flex;align-items:center;justify-content:center;width:30px;height:30px;cursor:grab;" +
        "background:var(--areia,#F0ECE4);border:1.5px solid var(--preto,#0D0D0B);border-radius:10px;" +
        "box-shadow:2px 2px 0 0 var(--preto,#0D0D0B);color:var(--preto,#0D0D0B);padding:0;touch-action:none}" +
      "#panel-painel.pg-edit .pg-arrasto{opacity:.55;outline-color:var(--laranja,#C8501A)}" +
      "#panel-painel.pg-edit .pg-alvo{outline:2px solid var(--laranja,#C8501A)}";
    document.head.appendChild(s);
  }

  /* ---------- aplicar ---------- */
  function colunasAgora() {
    var w = window.innerWidth;
    return w <= 640 ? 1 : (w <= 1000 ? 2 : COLS);
  }
  function aplicar() {
    var p = painel();
    if (!p) return;
    p.classList.add("pg-on");
    var cols = colunasAgora();
    layout.ordem.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (!el || el.parentNode !== p) return;
      var min = (PADRAO[id] || {}).min || 1;
      var t = Math.max(min, Math.min(layout.tam[id] || 2, COLS));
      el.style.order = String(i);
      el.style.gridColumn = "span " + Math.min(t, cols);
    });
    var bar = document.getElementById("pgBar");
    if (bar) bar.style.order = "-1";
  }

  /* ---------- barra ---------- */
  function barra() {
    var p = painel();
    if (!p || document.getElementById("pgBar")) return;
    var bar = document.createElement("div");
    bar.id = "pgBar";
    bar.innerHTML =
      '<button type="button" class="pg-btn" id="pgReset" hidden>' + svg(IC_RESET, 14) + "<span>Padrão</span></button>" +
      '<button type="button" class="pg-btn" id="pgToggle">' + svg(IC_EDIT, 14) + '<span id="pgToggleLbl">Editar painel</span></button>';
    p.insertBefore(bar, p.firstChild);
    bar.querySelector("#pgToggle").addEventListener("click", function () { modoEdicao(!editando); });
    bar.querySelector("#pgReset").addEventListener("click", function () {
      layout = { ordem: ORDEM_PADRAO.slice(), tam: {} };
      ORDEM_PADRAO.forEach(function (id) { layout.tam[id] = (PADRAO[id] || {}).tam || 2; });
      salvarLayout(); aplicar(); if (editando) { limparFerramentas(); ferramentas(); }
    });
  }

  /* ---------- ferramentas por bloco ---------- */
  function blocos() {
    var p = painel();
    if (!p) return [];
    return layout.ordem.map(function (id) { return document.getElementById(id); })
      .filter(function (el) { return el && el.parentNode === p && el.offsetParent !== null; });
  }
  function limparFerramentas() {
    var p = painel();
    if (!p) return;
    p.querySelectorAll(".pg-tools").forEach(function (t) { t.remove(); });
  }
  function ferramentas() {
    var cols = colunasAgora();
    blocos().forEach(function (el) {
      if (el.querySelector(":scope > .pg-tools")) return;
      var id = el.id;
      var min = (PADRAO[id] || {}).min || 1;
      var box = document.createElement("div");
      box.className = "pg-tools";
      // numa coluna so (celular) toda largura vira cheia, entao os chips nao fariam nada
      var chips = cols === 1 ? "" : '<div class="pg-sizes">' + TAMANHOS.map(function (t) {
        var off = t < min || t > cols;
        return '<button type="button" class="pg-sz" data-t="' + t + '"' + (off ? " disabled" : "") +
          ' aria-pressed="' + ((layout.tam[id] || 2) === t ? "true" : "false") + '" title="' + t + ' coluna' + (t > 1 ? "s" : "") + '">' + ROTULO[t] + "</button>";
      }).join("") + "</div>";
      box.innerHTML = chips +
        '<button type="button" class="pg-grab" aria-label="Mover">' + svg(IC_GRAB, 16) + "</button>";
      el.appendChild(box);
      box.querySelectorAll(".pg-sz").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          layout.tam[id] = Number(b.dataset.t);
          box.querySelectorAll(".pg-sz").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
          aplicar(); salvarLayout();
        });
      });
      box.querySelector(".pg-grab").addEventListener("pointerdown", function (e) { iniciarArrasto(e, el); });
    });
  }

  /* ---------- arrastar pra trocar de lugar ---------- */
  function iniciarArrasto(e, el) {
    e.preventDefault();
    arrastando = el;
    el.classList.add("pg-arrasto");
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}

    /* O painel e mais alto que a tela: sem isso nao da pra arrastar um bloco
       de baixo pra cima, porque o alvo nunca aparece. */
    var ultimoY = e.clientY, raf = null;
    var BORDA = 90, PASSO = 14;
    var rolar = function () {
      if (!arrastando) { raf = null; return; }
      var h = window.innerHeight, d = 0;
      if (ultimoY < BORDA) d = -PASSO * (1 - ultimoY / BORDA);
      else if (ultimoY > h - BORDA) d = PASSO * (1 - (h - ultimoY) / BORDA);
      if (d) window.scrollBy(0, d);
      raf = requestAnimationFrame(rolar);
    };
    raf = requestAnimationFrame(rolar);

    var mover = function (ev) {
      if (!arrastando) return;
      ultimoY = ev.clientY;
      var sob = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!sob) return;
      var alvo = sob.closest ? sob.closest("#panel-painel > *") : null;
      if (!alvo || alvo === arrastando || alvo.id === "pgBar") return;
      var p = painel();
      p.querySelectorAll(".pg-alvo").forEach(function (x) { x.classList.remove("pg-alvo"); });
      alvo.classList.add("pg-alvo");
      var de = layout.ordem.indexOf(arrastando.id), para = layout.ordem.indexOf(alvo.id);
      if (de < 0 || para < 0 || de === para) return;
      layout.ordem.splice(de, 1);
      layout.ordem.splice(para, 0, arrastando.id);
      aplicar();
    };
    var soltar = function () {
      if (!arrastando) return;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      arrastando.classList.remove("pg-arrasto");
      var p = painel();
      if (p) p.querySelectorAll(".pg-alvo").forEach(function (x) { x.classList.remove("pg-alvo"); });
      arrastando = null;
      salvarLayout();
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", soltar);
      document.removeEventListener("pointercancel", soltar);
    };
    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", soltar);
    document.addEventListener("pointercancel", soltar);
  }

  /* ---------- modo edicao ---------- */
  function modoEdicao(on) {
    editando = !!on;
    var p = painel();
    if (!p) return;
    p.classList.toggle("pg-edit", editando);
    var lbl = document.getElementById("pgToggleLbl");
    var tog = document.getElementById("pgToggle");
    var rst = document.getElementById("pgReset");
    if (lbl) lbl.textContent = editando ? "Pronto" : "Editar painel";
    if (tog) {
      tog.classList.toggle("pg-primary", editando);
      var ic = tog.querySelector("svg");
      if (ic) ic.outerHTML = svg(editando ? IC_OK : IC_EDIT, 14);
    }
    if (rst) rst.hidden = !editando;
    if (editando) ferramentas(); else limparFerramentas();
  }

  /* ---------- ligar ---------- */
  function iniciar() {
    var p = painel();
    if (!p) return false;
    estilos();
    layout = lerLayout();
    barra();
    aplicar();
    // blocos injetados por outros modulos (ex: leadsCard) chegam depois
    try {
      new MutationObserver(function () {
        aplicar();
        if (editando) ferramentas();
      }).observe(p, { childList: true });
    } catch (e) {}
    var to = null;
    window.addEventListener("resize", function () {
      clearTimeout(to);
      to = setTimeout(function () { aplicar(); if (editando) { limparFerramentas(); ferramentas(); } }, 180);
    });
    return true;
  }

  function pronto() {
    // espera o MaratuStore carregar os params, senao o layout salvo nao aparece
    try {
      if (MaratuStore && MaratuStore.ready && MaratuStore.ready.then) {
        MaratuStore.ready.then(function () { iniciar(); });
        return true;
      }
    } catch (e) {}
    return iniciar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pronto);
  else pronto();
})();
