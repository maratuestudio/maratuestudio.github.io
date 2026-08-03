/* MARATU admin — diagnostico da barra de baixo que "sobe ao trocar de aba".

   NAO faz nada a menos que a pagina seja aberta com ?diag=barra. Desliga com ?diag=0.

   Por que existe: o sintoma so aparece no iPhone em PWA. No WebKit emulado a barra fica
   sempre a 8px do fundo, em todas as abas, rolada ou nao. Medindo os prints do Rapha:
   na aba Painel a barra estava a ~32pt do fundo (que e o certo, o valor da safe area) e
   na aba Orcamento a ~72pt, ou seja 40pt acima do lugar. Falta saber POR QUE, e as
   hipoteses (containing block em algum ancestral, safe area contada duas vezes, viewport
   visual deslocada pelo teclado) dao numeros diferentes aqui. Este quadro mostra os tres
   ao mesmo tempo, a cada troca de aba.

   Uso: abrir https://maratu.com.br/admin.html?diag=barra , trocar de aba ate a barra subir,
   e mandar o print do quadro. */
(function () {
  "use strict";
  if (window.__maratuDiagBarra) return;

  var ligado = false;
  try {
    ligado = /[?&]diag=barra/.test(location.search) || localStorage.getItem("maratu.diagbarra") === "1";
    if (/[?&]diag=barra/.test(location.search)) localStorage.setItem("maratu.diagbarra", "1");
    if (/[?&]diag=0/.test(location.search)) { localStorage.removeItem("maratu.diagbarra"); ligado = false; }
  } catch (e) {}
  if (!ligado) return;
  window.__maratuDiagBarra = true;

  var box = document.createElement("div");
  box.style.cssText = "position:fixed;left:6px;top:6px;z-index:2147483647;pointer-events:none;" +
    "max-width:min(94vw,520px);background:rgba(13,13,11,.93);color:#F0ECE4;" +
    "font:10.5px/1.5 ui-monospace,Menlo,monospace;padding:8px 10px;border-radius:9px;" +
    "white-space:pre-wrap;word-break:break-word;box-shadow:0 4px 18px rgba(0,0,0,.45);";
  (function poe() { if (document.body) document.body.appendChild(box); else setTimeout(poe, 60); })();

  /* le o valor real de env(safe-area-inset-bottom) neste aparelho */
  var sonda = document.createElement("div");
  sonda.style.cssText = "position:fixed;left:-9999px;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom)";
  (function poe2() { if (document.body) document.body.appendChild(sonda); else setTimeout(poe2, 60); })();
  function safeArea() {
    try { return Math.round(parseFloat(getComputedStyle(sonda).paddingBottom) || 0); } catch (e) { return -1; }
  }

  function barra() { return document.getElementById("tabs") || document.querySelector(".tabs"); }

  /* quem, subindo a arvore, esta servindo de containing block pro position:fixed */
  function culpado() {
    var n = barra();
    if (!n) return "sem barra";
    n = n.parentElement;
    while (n && n !== document.documentElement) {
      var c = getComputedStyle(n);
      if (c.transform !== "none" || c.filter !== "none" || c.perspective !== "none" ||
          c.backdropFilter !== "none" || (c.willChange && /transform|filter/.test(c.willChange)) ||
          (c.contain && /paint|layout|strict|content/.test(c.contain))) {
        return (n.id || n.className || n.tagName).toString().slice(0, 18) +
          " [" + (c.transform !== "none" ? "transform" : c.filter !== "none" ? "filter" :
          c.backdropFilter !== "none" ? "backdrop" : c.willChange !== "auto" ? "will-change" : "contain") + "]";
      }
      n = n.parentElement;
    }
    return "nenhum";
  }

  var linhas = [];
  function medir(motivo) {
    var t = barra();
    if (!t) return;
    var r = t.getBoundingClientRect();
    var vv = window.visualViewport;
    var aba = (document.querySelector('[data-tab][aria-selected="true"]') || {}).dataset;
    linhas.unshift(
      (aba && aba.tab ? aba.tab : "?").padEnd(9) + " " + motivo + "\n" +
      "  folga=" + Math.round(innerHeight - r.bottom) + "  safeArea=" + safeArea() +
      "  scrollY=" + Math.round(window.scrollY) + "\n" +
      "  innerH=" + innerHeight + "  vv.h=" + (vv ? Math.round(vv.height) : "-") +
      "  vv.top=" + (vv ? Math.round(vv.offsetTop) : "-") + "\n" +
      "  docH=" + Math.round(document.documentElement.scrollHeight) +
      "  ancestral=" + culpado()
    );
    if (linhas.length > 4) linhas.pop();
    box.textContent = "DIAG DA BARRA — mande print\n(folga certa = safeArea)\n\n" + linhas.join("\n\n");
  }

  document.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest || !e.target.closest("[data-tab]")) return;
    setTimeout(function () { medir("logo apos o toque"); }, 60);
    setTimeout(function () { medir("assentado"); }, 700);
  }, true);

  window.addEventListener("scroll", function () { medir("rolando"); }, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () { medir("viewport mudou"); });
    window.visualViewport.addEventListener("scroll", function () { medir("viewport rolou"); });
  }
  setTimeout(function () { medir("abertura"); }, 1200);
})();
