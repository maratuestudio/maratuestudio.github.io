/* MARATU admin — modulo "Agenda publica" (anexado, nao toca no admin.js minificado).
   Injeta um checkbox "Mostrar na Agenda publica" no editor de evento (openEvDetail).
   Persiste numa lista de ids (setting `agenda_publicos` no Worker) via POST /api/eventos/publico
   — INDEPENDENTE do PUT de eventos, entao editar/salvar evento nao reseta o publico.
   O /bio -> /go/agenda -> pagina /agenda mostra so os eventos dessa lista. */
(function () {
  "use strict";
  if (window.__maratuAgendaPub) return;
  window.__maratuAgendaPub = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var pubSet = null; // Set de ids publicos (cache)

  function loadPub() {
    return fetch(API + "/api/eventos/publicos")
      .then(function (r) { return r.json(); })
      .then(function (d) { pubSet = new Set(((d && d.ids) || []).map(String)); })
      .catch(function () { pubSet = new Set(); });
  }
  loadPub();

  function injectToggle(id) {
    var body = document.getElementById("evDetailBody");
    if (!body) return;
    var wrap = document.getElementById("edPublicoWrap");
    if (!wrap) {
      wrap = document.createElement("label");
      wrap.id = "edPublicoWrap";
      wrap.style.cssText = "display:flex;align-items:center;gap:9px;margin:14px 0 2px;padding:12px 14px;" +
        "border:1.5px solid #0D0D0B;border-radius:12px;background:#F0ECE4;cursor:pointer;font-family:inherit;" +
        "font-size:12px;font-weight:700;color:#0D0D0B;box-shadow:2px 2px 0 0 #0D0D0B;-webkit-tap-highlight-color:transparent;";
      wrap.innerHTML =
        '<input type="checkbox" id="edPublico" style="width:19px;height:19px;flex:0 0 auto;accent-color:#C8501A;cursor:pointer;">' +
        '<span>Mostrar na Agenda pública <span style="opacity:.5;font-weight:400">(link da bio)</span></span>' +
        '<span id="edPublicoMsg" style="margin-left:auto;font-weight:700;font-size:11px;opacity:.6"></span>';
      /* ACIMA do form-actions (Apagar/Cancelar/Salvar), dentro do body do editor */
      var fa = body.querySelector(".form-actions");
      if (fa) body.insertBefore(wrap, fa);
      else body.appendChild(wrap);
    }
    var cb = wrap.querySelector("#edPublico");
    var msg = wrap.querySelector("#edPublicoMsg");
    msg.textContent = "";

    if (id == null || id === "" || id === "undefined") {
      cb.checked = false; cb.disabled = true; wrap.style.opacity = "0.55";
      msg.textContent = "salve o evento 1º";
      return;
    }
    cb.disabled = false; wrap.style.opacity = "1";
    cb.checked = pubSet ? pubSet.has(String(id)) : false;

    cb.onchange = function () {
      var on = cb.checked;
      cb.disabled = true; msg.textContent = "salvando…";
      fetch(API + "/api/eventos/publico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, publico: on ? 1 : 0 })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            if (on) { pubSet && pubSet.add(String(id)); } else { pubSet && pubSet["delete"](String(id)); }
            msg.textContent = on ? "na agenda ✓" : "";
          } else { cb.checked = !on; msg.textContent = "erro"; }
        })
        .catch(function () { cb.checked = !on; msg.textContent = "falhou"; })
        .then(function () { cb.disabled = false; });
    };
  }

  function wrap() {
    if (typeof window.openEvDetail !== "function") return false;
    var _oed = window.openEvDetail;
    window.openEvDetail = function (kind, id) {
      _oed.apply(this, arguments);
      if (kind === "evento") { try { injectToggle(id); } catch (e) {} }
    };
    return true;
  }
  // openEvDetail ja e reatribuido por outro modulo anexado; espera existir
  if (!wrap()) {
    var tries = 0;
    var iv = setInterval(function () { tries++; if (wrap() || tries > 40) clearInterval(iv); }, 200);
  }
})();
