/* MARATU admin — a engrenagem abre a PAGINA de ajustes (#panel-ajustes), nao mais popup.

   O botao continua sendo o `.head-menu-btn` de sempre: no desktop um botao de 38px so com
   o icone, no celular um item da barra de baixo. Nao virou aba comum de proposito.

   O admin.js so liga troca de painel em `#tabs .tab`, e a engrenagem nao tem essa classe,
   entao a troca e feita aqui repetindo o que ele faz.

   NAO usar MutationObserver aqui. Ja tentei: escutar aria-selected e escrever aria-selected
   de volta se realimenta, porque setAttribute gera mutacao mesmo com valor igual. Isso
   congelou a pagina em producao. Ouvir o clique das abas resolve sem laco.

   Nao toca no admin.js minificado. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuAjustes) return;
  window.__maratuAjustes = true;

  function abas() { return [].slice.call(document.querySelectorAll("#tabs .tab")); }

  function abreAjustes() {
    var btn = document.getElementById("headMenuBtn");
    var painel = document.getElementById("panel-ajustes");
    if (!painel) return;
    abas().forEach(function (t) { t.setAttribute("aria-selected", "false"); });
    if (btn) btn.setAttribute("aria-selected", "true");
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("on"); });
    painel.classList.add("on");
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function apagaEngrenagem() {
    var btn = document.getElementById("headMenuBtn");
    if (btn && btn.getAttribute("aria-selected") === "true") {
      btn.setAttribute("aria-selected", "false");
    }
  }

  function liga() {
    var btn = document.getElementById("headMenuBtn");
    if (!btn) return false;
    if (!btn.dataset.mrtLigado) {
      btn.dataset.mrtLigado = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        abreAjustes();
      });
    }
    abas().forEach(function (t) {
      if (t.dataset.mrtLimpaGear) return;
      t.dataset.mrtLimpaGear = "1";
      t.addEventListener("click", apagaEngrenagem);
    });
    return true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", liga);
  else liga();
  var n = 0;
  var t = setInterval(function () { if (liga() || ++n > 40) clearInterval(t); }, 250);
})();
