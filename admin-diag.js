/* MARATU admin — modo diagnostico de clique. NAO faz nada a menos que a pagina seja
   aberta com ?diag=1 (ou com localStorage "maratu.diag"="1"). Mostra num quadro fixo o que
   esta recebendo cada clique e se alguma coisa esta cobrindo a tela. Serve pra descobrir
   travamento que so acontece no navegador do Rapha. Pra desligar: abrir sem ?diag=1. */
(function () {
  "use strict";
  if (window.__maratuDiag) return;
  var ligado = false;
  try {
    ligado = /[?&]diag=1/.test(location.search) || localStorage.getItem("maratu.diag") === "1";
    if (/[?&]diag=1/.test(location.search)) localStorage.setItem("maratu.diag", "1");
    if (/[?&]diag=0/.test(location.search)) { localStorage.removeItem("maratu.diag"); ligado = false; }
  } catch (e) {}
  if (!ligado) return;
  window.__maratuDiag = true;

  var box = document.createElement("div");
  box.id = "maratuDiag";
  box.style.cssText = "position:fixed;left:8px;top:8px;z-index:2147483647;pointer-events:none;" +
    "max-width:min(92vw,560px);max-height:44vh;overflow:hidden;background:rgba(13,13,11,.92);color:#F0ECE4;" +
    "font:11px/1.45 ui-monospace,Menlo,monospace;padding:9px 11px;border-radius:10px;white-space:pre-wrap;" +
    "word-break:break-word;box-shadow:0 4px 18px rgba(0,0,0,.4);";
  function pronto() { if (document.body) document.body.appendChild(box); else setTimeout(pronto, 60); }
  pronto();

  var linhas = [];
  function log(t) {
    linhas.unshift(t);
    if (linhas.length > 9) linhas.pop();
    box.textContent = "DIAG do clique — mande print disto\n" + linhas.join("\n");
  }

  function desc(el) {
    if (!el) return "null";
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    else if (typeof el.className === "string" && el.className.trim()) s += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
    return s;
  }

  function cobrindo() {
    var vw = innerWidth, vh = innerHeight, achados = [];
    var todos = document.querySelectorAll("body *");
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i], cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") continue;
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      var r = el.getBoundingClientRect();
      if (r.width > vw * 0.6 && r.height > vh * 0.6) {
        achados.push(desc(el) + " z=" + cs.zIndex + " op=" + cs.opacity);
        if (achados.length > 2) break;
      }
    }
    return achados.length ? achados.join(" | ") : "nada cobrindo";
  }

  function abaAtiva() {
    var p = document.querySelector(".panel.on");
    return p ? p.id : "nenhuma";
  }

  ["pointerdown", "click"].forEach(function (tipo) {
    document.addEventListener(tipo, function (e) {
      try {
        var pilha = (document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : []).slice(0, 3).map(desc).join(" > ");
        log(tipo + " alvo=" + desc(e.target) + (e.defaultPrevented ? " [PREVENIDO]" : "") +
          "\n  no ponto: " + pilha);
      } catch (err) { log(tipo + " erro no diag: " + err); }
    }, true);
  });

  setInterval(function () {
    try {
      box.setAttribute("data-est", "");
      var base = "aba=" + abaAtiva() + " scrollY=" + Math.round(scrollY) + " alturaPag=" + Math.round(document.documentElement.scrollHeight) +
        " tela=" + innerWidth + "x" + innerHeight + "\ncobrindo: " + cobrindo();
      box.textContent = "DIAG do clique — mande print disto\n" + base + "\n" + linhas.join("\n");
    } catch (e) {}
  }, 1200);

  window.addEventListener("error", function (e) { log("ERRO JS: " + (e.message || "").slice(0, 90)); });
  log("ligado. clique onde nao responde.");
})();
