/* MARATU admin — flag "Pre-venda" do produto. O chip mora no #fFlags do admin.html, mas
   quem monta o payload e o admin.js minificado, que so conhece ativo/novo/oculto. Em vez
   de operar o minificado, este modulo embrulha o fetch: injeta prevenda no corpo do POST
   /api/catalog e do PUT /api/catalog/<id>, e guarda a resposta do /api/catalog/all pra
   marcar o chip quando o form abre. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuPrevenda) return;
  window.__maratuPrevenda = true;

  var cache = {};   // id do produto -> prevenda (bool)

  function chip() { return document.querySelector('#fFlags [data-flag="prevenda"]'); }
  function ligado() { var c = chip(); return !!c && c.getAttribute("aria-pressed") === "true"; }
  function ligar(on) { var c = chip(); if (c) c.setAttribute("aria-pressed", on ? "true" : "false"); }

  function guardar(produtos) {
    (produtos || []).forEach(function (p) { if (p && p.id != null) cache[String(p.id)] = !!p.prevenda; });
  }

  /* embrulha o fetch por fora do embrulho do admin.js (que poe o token) */
  var _f = window.fetch;
  window.fetch = function (input, init) {
    var url = "";
    try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) {}
    var metodo = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var ehCatalogo = /\/api\/catalog(\/[^/?]+)?(\?|$)/.test(url) && !/\/(upload|reorder|layout|all)\b/.test(url);

    if (ehCatalogo && (metodo === "POST" || metodo === "PUT") && init && typeof init.body === "string") {
      try {
        var corpo = JSON.parse(init.body);
        if (corpo && typeof corpo === "object" && corpo.nome) {
          corpo.prevenda = ligado() ? 1 : 0;
          init = Object.assign({}, init, { body: JSON.stringify(corpo) });
        }
      } catch (e) {}
    }
    var r = _f.call(this, input, init);
    if (/\/api\/catalog(\/all)?(\?|$)/.test(url) && metodo === "GET") {
      r.then(function (res) {
        try { res.clone().json().then(function (d) { if (d && d.produtos) guardar(d.produtos); }).catch(function () {}); } catch (e) {}
      }).catch(function () {});
    }
    return r;
  };

  /* o admin.js zera as flags que nao conhece toda vez que abre o form; corrijo depois */
  function boot() {
    var modal = document.getElementById("prodModal");
    if (!modal) return false;
    new MutationObserver(function () {
      if (!modal.classList.contains("on")) return;
      var el = document.getElementById("fId");
      var id = el ? String(el.value || "") : "";
      ligar(!!id && cache[id] === true);
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    return true;
  }
  var t = 0, iv = setInterval(function () { if (boot() || ++t > 60) clearInterval(iv); }, 250);
})();
