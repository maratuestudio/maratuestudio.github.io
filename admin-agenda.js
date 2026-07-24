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

  var CSS_WRAP = "display:flex;align-items:center;gap:9px;margin:14px 0 2px;padding:12px 14px;" +
    "border:1.5px solid #0D0D0B;border-radius:12px;background:#F0ECE4;cursor:pointer;font-family:inherit;" +
    "font-size:12px;font-weight:700;color:#0D0D0B;box-shadow:2px 2px 0 0 #0D0D0B;-webkit-tap-highlight-color:transparent;";
  var CSS_BOX = "width:19px;height:19px;flex:0 0 auto;accent-color:#C8501A;cursor:pointer;";
  var LBL = '<span>Mostrar na Agenda pública <span style="opacity:.5;font-weight:400">(link da bio)</span></span>';

  function setPublico(id, on) {
    return fetch(API + "/api/eventos/publico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, publico: on ? 1 : 0 })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error("falhou");
        if (pubSet) { if (on) pubSet.add(String(id)); else pubSet["delete"](String(id)); }
        return true;
      });
  }

  function injectToggle(id) {
    var body = document.getElementById("evDetailBody");
    if (!body) return;
    var wrap = document.getElementById("edPublicoWrap");
    if (!wrap) {
      wrap = document.createElement("label");
      wrap.id = "edPublicoWrap";
      wrap.style.cssText = CSS_WRAP;
      wrap.innerHTML =
        '<input type="checkbox" id="edPublico" style="' + CSS_BOX + '">' + LBL +
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
      setPublico(id, on)
        .then(function () { msg.textContent = on ? "na agenda ✓" : ""; })
        .catch(function () { cb.checked = !on; msg.textContent = "falhou"; })
        .then(function () { cb.disabled = false; });
    };
  }

  /* ---- mesmo toggle no modal "Novo evento" (#nvBack) ----
     O saveNew do core faz setEventos(getEventos().concat([ev])), entao o evento
     recem-criado e sempre o ULTIMO do array. Contamos antes (captura) e depois
     (bubble) do onclick do #nvSave pra saber se salvou de verdade. */
  function contaEventos() {
    try { return (MaratuStore.getEventos() || []).length; } catch (e) { return -1; }
  }

  function injectNewToggle() {
    var back = document.getElementById("nvBack");
    if (!back) return null;
    var wrap = document.getElementById("nvPublicoWrap");
    if (wrap) return wrap;
    wrap = document.createElement("label");
    wrap.id = "nvPublicoWrap";
    wrap.style.cssText = CSS_WRAP;
    wrap.innerHTML = '<input type="checkbox" id="nvPublico" style="' + CSS_BOX + '">' + LBL +
      '<span id="nvPublicoMsg" style="margin-left:auto;font-weight:700;font-size:11px;opacity:.6"></span>';
    var fa = back.querySelector(".form-actions");
    if (fa && fa.parentNode) fa.parentNode.insertBefore(wrap, fa);
    else { var card = back.querySelector(".modal-card"); if (card) card.appendChild(wrap); else return null; }
    // cada abertura do modal comeca desmarcada
    try {
      new MutationObserver(function () {
        if (back.classList.contains("on")) {
          var b = document.getElementById("nvPublico");
          var m = document.getElementById("nvPublicoMsg");
          if (b) { b.checked = false; b.disabled = false; }
          if (m) m.textContent = "";
        }
      }).observe(back, { attributes: true, attributeFilter: ["class"] });
    } catch (e) {}
    return wrap;
  }

  // o #nvBack so nasce no primeiro "+ Novo evento" — observa o body pra injetar na hora
  try {
    if (!injectNewToggle()) {
      new MutationObserver(function (recs, obs) {
        if (injectNewToggle()) obs.disconnect();
      }).observe(document.body, { childList: true });
    }
  } catch (e) {}

  var antesN = -1;
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest("#nvSave")) return;
    antesN = contaEventos();
  }, true);

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest("#nvSave")) return;
    var cb = document.getElementById("nvPublico");
    if (!cb || !cb.checked) return;
    var evs;
    try { evs = MaratuStore.getEventos() || []; } catch (err) { return; }
    if (antesN < 0 || evs.length <= antesN) return; // nao salvou (faltou data)
    var novo = evs[evs.length - 1];
    if (!novo || !novo.id) return;
    setPublico(novo.id, true).catch(function () {
      alert("O evento foi salvo, mas não entrou na Agenda pública. Abra o evento e marque de novo.");
    });
  }, false);

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
