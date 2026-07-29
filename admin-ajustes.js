/* MARATU admin — a engrenagem abre a PAGINA de ajustes, nao mais um popup.

   O botao continua sendo o mesmo `.head-menu-btn` de sempre: no desktop um botao redondo
   de 38px so com o icone, no celular um item da barra de baixo. Nao virou aba comum de
   proposito — o pedido era manter o botao.

   Como o admin.js so liga a troca de painel em `#tabs .tab`, e a engrenagem nao tem essa
   classe, a troca e feita aqui, repetindo o que ele faz: marca o aria-selected e acende o
   painel. Nao toca no admin.js minificado. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuAjustes) return;
  window.__maratuAjustes = true;

  function abas() {
    return [].slice.call(document.querySelectorAll("#tabs .tab"));
  }

  function abreAjustes() {
    var btn = document.getElementById("headMenuBtn");
    var painel = document.getElementById("panel-ajustes");
    if (!painel) return;
    abas().forEach(function (t) { t.setAttribute("aria-selected", "false"); });
    if (btn) btn.setAttribute("aria-selected", "true");
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("on"); });
    painel.classList.add("on");
  }

  /* Quando o usuario volta pra outra aba, a engrenagem tem que apagar. O admin.js mexe no
     aria-selected das abas mas nao conhece o botao, entao escuto e acompanho. */
  function vigia() {
    var tabs = document.getElementById("tabs");
    if (!tabs) return false;
    try {
      new MutationObserver(function () {
        var btn = document.getElementById("headMenuBtn");
        if (!btn) return;
        var outraAtiva = abas().some(function (t) { return t.getAttribute("aria-selected") === "true"; });
        if (outraAtiva) btn.setAttribute("aria-selected", "false");
      }).observe(tabs, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
    } catch (e) {}
    return true;
  }

  function liga() {
    var btn = document.getElementById("headMenuBtn");
    if (!btn || btn.dataset.mrtLigado) return !!btn;
    btn.dataset.mrtLigado = "1";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      abreAjustes();
    });
    vigia();
    return true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", liga);
  else liga();
  var n = 0;
  var t = setInterval(function () { if (liga() || ++n > 40) clearInterval(t); }, 250);
})();
