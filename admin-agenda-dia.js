/* MARATU admin — modulo "Agenda: acoes do dia" (anexado, nao toca no admin.js minificado).
   No painel do dia (#dayEvents), pros eventos (kind evento) troca os botoes
   ✓concluir/.ics/apagar por dois icones: lapis (editar -> openEvDetail) e X (apagar).
   Clicar na linha do evento tambem abre a edicao. So SVG, sem emoji.
   Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuAgendaDia) return;
  window.__maratuAgendaDia = true;

  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' + paths + '</svg>';
  }
  var IC_EDIT = '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  var IC_X = '<path d="M6 6l12 12M18 6L6 18"/>';
  var IC_CHECK = '<path d="M20 6L9 17l-5-5"/>';
  var IC_UNDO = '<path d="M3 10h11a4 4 0 0 1 0 8h-1"/><path d="M7 6l-4 4 4 4"/>';

  function injectStyles() {
    if (document.getElementById("dayActStyles")) return;
    var s = document.createElement("style");
    s.id = "dayActStyles";
    s.textContent =
      "#dayEvents .ev{cursor:pointer}" +
      "#dayEvents .ev .acts{display:flex;gap:8px;align-items:center;flex:0 0 auto}" +
      "#dayEvents .da-ic{width:34px;height:34px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;" +
        "border:1.5px solid var(--preto,#0D0D0B);border-radius:10px;background:var(--areia,#F0ECE4);" +
        "color:var(--preto,#0D0D0B);cursor:pointer;padding:0;box-shadow:2px 2px 0 0 var(--preto,#0D0D0B);" +
        "-webkit-tap-highlight-color:transparent}" +
      "#dayEvents .da-ic:hover{color:var(--laranja,#C8501A)}" +
      "#dayEvents .ev-done .da-ic.da-check{opacity:.55}" +
      "#dayEvents .da-ic.da-del:hover{color:#fff;background:#C0392B;border-color:#C0392B;box-shadow:2px 2px 0 0 var(--preto,#0D0D0B)}";
    document.head.appendChild(s);
  }

  function rerender() {
    if (typeof renderCal === "function") renderCal();
    if (typeof renderDay === "function") renderDay();
    if (typeof renderPainel === "function") renderPainel();
    if (typeof renderUpcoming === "function") renderUpcoming();
  }

  function delEvento(id) {
    var evs = MaratuStore.getEventos().filter(function (e) { return String(e.id) !== String(id); });
    MaratuStore.setEventos(evs);
    rerender();
  }

  function toggleFeito(id) {
    var evs = MaratuStore.getEventos().map(function (e) {
      return String(e.id) === String(id) ? Object.assign({}, e, { feito: e.feito ? 0 : 1 }) : e;
    });
    MaratuStore.setEventos(evs);
    rerender();
  }

  function reformar() {
    var list = document.getElementById("dayEvents");
    if (!list) return;
    injectStyles();
    list.querySelectorAll(".ev").forEach(function (row) {
      var acts = row.querySelector(".acts");
      if (!acts) return;
      var del = acts.querySelector("[data-del]");
      if (!del) return; // so eventos tem data-del; notas/outros ficam como estao
      if (row.getAttribute("data-da-done") === "1") return;
      row.setAttribute("data-da-done", "1");
      var id = del.getAttribute("data-del");
      var feito = row.classList.contains("ev-done");
      var lblFeito = feito ? "Desmarcar" : "Concluir";

      acts.innerHTML =
        '<button type="button" class="da-ic da-check" title="' + lblFeito + '" aria-label="' + lblFeito + '">' + svg(feito ? IC_UNDO : IC_CHECK) + "</button>" +
        '<button type="button" class="da-ic da-edit" title="Editar" aria-label="Editar">' + svg(IC_EDIT) + "</button>" +
        '<button type="button" class="da-ic da-del" title="Apagar" aria-label="Apagar">' + svg(IC_X) + "</button>";

      acts.querySelector(".da-check").addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFeito(id);
      });
      acts.querySelector(".da-edit").addEventListener("click", function (e) {
        e.stopPropagation();
        if (typeof openEvDetail === "function") openEvDetail("evento", id);
      });
      acts.querySelector(".da-del").addEventListener("click", function (e) {
        e.stopPropagation();
        delEvento(id);
      });

      // clicar na linha (fora dos botoes) abre a edicao
      row.addEventListener("click", function (e) {
        if (e.target.closest(".acts")) return;
        if (typeof openEvDetail === "function") openEvDetail("evento", id);
      });
    });
  }

  function wrap() {
    if (typeof window.renderDay !== "function") return false;
    var _rd = window.renderDay;
    window.renderDay = function () {
      _rd.apply(this, arguments);
      try { reformar(); } catch (e) {}
    };
    try { reformar(); } catch (e) {}
    return true;
  }

  if (!wrap()) {
    var tries = 0;
    var iv = setInterval(function () { tries++; if (wrap() || tries > 40) clearInterval(iv); }, 200);
  }
})();
