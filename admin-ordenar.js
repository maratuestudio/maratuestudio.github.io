/* MARATU admin — módulo "Ordenar produtos" (Plano A).
   Anexado ao admin (não toca no admin.js minificado). Usa o shim de fetch que já
   injeta o Bearer token. Reordena produtos DENTRO de uma faixa (subcategoria) via
   drag-and-drop (pointer events → funciona no touch do iPhone) e salva em
   POST /api/catalog/reorder { ids:[...] }. */
(function () {
  "use strict";
  if (window.__maratuOrdenar) return;
  window.__maratuOrdenar = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var IMG = API + "/img/";
  var FAIXAS = [
    { v: "posteres", l: "Pôsteres" },
    { v: "essenciais", l: "Decor" },
    { v: "blusas", l: "Blusas" },
    { v: "chaveiros", l: "Chaveiros" },
    { v: "adesivos", l: "Adesivos" }
  ];
  var state = { produtos: [], faixa: "posteres", dirty: false };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function imgUrl(v) {
    if (!v) return "";
    return /^https?:/.test(v) ? v : IMG + v;
  }

  /* ---------------- estilos ---------------- */
  var css =
    ".ordm-back{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;" +
    "background:rgba(13,13,11,.55);padding:16px;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}" +
    ".ordm-back.on{display:flex}" +
    ".ordm-card{background:var(--areia,#F0ECE4);color:var(--preto,#0D0D0B);width:100%;max-width:440px;max-height:88vh;" +
    "display:flex;flex-direction:column;border:1.5px solid var(--preto,#0D0D0B);border-radius:16px;" +
    "box-shadow:6px 6px 0 0 var(--preto,#0D0D0B);overflow:hidden;font-family:var(--clother,'Helvetica Neue',sans-serif)}" +
    ".ordm-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px}" +
    ".ordm-head h3{font-size:1rem;font-weight:900;letter-spacing:.02em;margin:0}" +
    ".ordm-close{background:none;border:none;font-size:1.5rem;line-height:1;cursor:pointer;color:var(--preto,#0D0D0B);padding:0 4px}" +
    ".ordm-faixas{display:flex;gap:6px;flex-wrap:wrap;padding:0 18px 12px}" +
    ".ordm-fx{background:transparent;border:1.5px solid rgba(13,13,11,.3);border-radius:999px;padding:4px 12px;" +
    "font-family:inherit;font-size:.66rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(13,13,11,.6);cursor:pointer}" +
    ".ordm-fx.on{background:var(--preto,#0D0D0B);color:var(--areia,#F0ECE4);border-color:var(--preto,#0D0D0B)}" +
    ".ordm-hint{padding:0 18px 8px;font-size:.68rem;color:rgba(13,13,11,.55);font-weight:700}" +
    ".ordm-list{list-style:none;margin:0;padding:4px 14px 6px;overflow-y:auto;flex:1;min-height:60px}" +
    ".ord-row{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid var(--preto,#0D0D0B);" +
    "border-radius:12px;padding:7px 10px;margin:0 0 8px;user-select:none}" +
    ".ord-row.ord-holder{opacity:.35}" +
    ".ord-clone{position:fixed;z-index:10001;pointer-events:none;margin:0;box-shadow:4px 6px 0 0 rgba(13,13,11,.35);border-radius:12px;background:#fff;border:1.5px solid var(--preto,#0D0D0B);display:flex;align-items:center;gap:10px;padding:7px 10px}" +
    ".ord-handle{flex:0 0 auto;cursor:grab;font-size:1.1rem;line-height:1;color:rgba(13,13,11,.4);padding:2px 4px;touch-action:none}" +
    ".ord-thumb{flex:0 0 auto;width:38px;height:38px;border-radius:8px;object-fit:cover;background:rgba(13,13,11,.06);border:1px solid rgba(13,13,11,.12)}" +
    ".ord-thumb--empty{display:inline-block}" +
    ".ord-name{flex:1;font-size:.82rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".ord-pos{flex:0 0 auto;font-size:.66rem;font-weight:900;color:rgba(13,13,11,.35);min-width:20px;text-align:right}" +
    ".ordm-empty{padding:24px 18px;text-align:center;color:rgba(13,13,11,.5);font-weight:700;font-size:.8rem}" +
    ".ordm-foot{display:flex;align-items:center;gap:12px;padding:12px 18px 16px;border-top:1px solid rgba(13,13,11,.1)}" +
    ".ordm-msg{font-size:.72rem;font-weight:700;flex:1}" +
    ".ordm-save{background:var(--azul,#1f3a63);color:#fff;border:1.5px solid var(--preto,#0D0D0B);border-radius:999px;" +
    "padding:8px 18px;font-family:inherit;font-weight:800;font-size:.8rem;cursor:pointer}" +
    ".ordm-save[disabled]{opacity:.45;cursor:default}";
  var styleEl = document.createElement("style");
  styleEl.id = "ordm-style";
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------------- markup do modal ---------------- */
  var back = document.createElement("div");
  back.className = "ordm-back";
  back.innerHTML =
    '<div class="ordm-card" role="dialog" aria-modal="true" aria-label="Ordenar produtos">' +
    '<div class="ordm-head"><h3>Ordenar produtos</h3><button type="button" class="ordm-close" aria-label="Fechar">×</button></div>' +
    '<div class="ordm-faixas"></div>' +
    '<div class="ordm-hint">Arraste pelo ⠿ pra mudar a ordem. O 1º aparece primeiro no site.</div>' +
    '<ul class="ordm-list"></ul>' +
    '<div class="ordm-foot"><span class="ordm-msg"></span><button type="button" class="ordm-save">Salvar ordem</button></div>' +
    "</div>";
  document.body.appendChild(back);

  var faixasEl = back.querySelector(".ordm-faixas");
  var listEl = back.querySelector(".ordm-list");
  var msgEl = back.querySelector(".ordm-msg");
  var saveBtn = back.querySelector(".ordm-save");

  FAIXAS.forEach(function (f) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ordm-fx" + (f.v === state.faixa ? " on" : "");
    b.textContent = f.l;
    b.dataset.faixa = f.v;
    b.addEventListener("click", function () {
      if (state.faixa === f.v) return;
      state.faixa = f.v;
      faixasEl.querySelectorAll(".ordm-fx").forEach(function (x) { x.classList.toggle("on", x.dataset.faixa === f.v); });
      render();
    });
    faixasEl.appendChild(b);
  });

  back.querySelector(".ordm-close").addEventListener("click", close);
  back.addEventListener("click", function (e) { if (e.target === back) close(); });
  saveBtn.addEventListener("click", save);

  function msg(t) { msgEl.textContent = t || ""; }
  function show() { back.classList.add("on"); }
  function close() { back.classList.remove("on"); }

  /* ---------------- render ---------------- */
  function render() {
    var items = state.produtos
      .filter(function (p) { return p.subcategoria === state.faixa; })
      .sort(function (a, b) { return (a.ordem - b.ordem) || String(a.nome).localeCompare(String(b.nome)); });
    if (!items.length) {
      listEl.innerHTML = '<li class="ordm-empty">Nenhum produto nessa faixa.</li>';
      return;
    }
    listEl.innerHTML = items.map(function (p) {
      var u = imgUrl(p.imagem_principal);
      return '<li class="ord-row" data-id="' + esc(p.id) + '">' +
        '<span class="ord-handle" aria-label="arrastar">⠿</span>' +
        (u ? '<img class="ord-thumb" src="' + esc(u) + '" alt="" loading="lazy">' : '<span class="ord-thumb ord-thumb--empty"></span>') +
        '<span class="ord-name">' + esc(p.nome) + "</span>" +
        '<span class="ord-pos"></span></li>';
    }).join("");
    renumber();
    listEl.querySelectorAll(".ord-handle").forEach(function (h) {
      h.addEventListener("pointerdown", onDown);
    });
  }
  function renumber() {
    Array.prototype.slice.call(listEl.querySelectorAll(".ord-row")).forEach(function (r, i) {
      var pos = r.querySelector(".ord-pos");
      if (pos) pos.textContent = i + 1 + "º";
    });
  }

  /* ---------------- drag (pointer events) ---------------- */
  var drag = null;
  function onDown(e) {
    var handle = e.currentTarget;
    var row = handle.closest(".ord-row");
    if (!row) return;
    e.preventDefault();
    var rect = row.getBoundingClientRect();
    var clone = row.cloneNode(true);
    clone.classList.remove("ord-row");
    clone.classList.add("ord-clone");
    clone.style.width = rect.width + "px";
    clone.style.left = rect.left + "px";
    clone.style.top = rect.top + "px";
    document.body.appendChild(clone);
    row.classList.add("ord-holder");
    drag = { row: row, clone: clone, offY: e.clientY - rect.top, handle: handle };
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }
  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    drag.clone.style.top = e.clientY - drag.offY + "px";
    var rows = Array.prototype.slice.call(listEl.querySelectorAll(".ord-row"));
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r === drag.row) continue;
      var rc = r.getBoundingClientRect();
      if (e.clientY < rc.top + rc.height / 2) { target = r; break; }
    }
    if (target) {
      if (drag.row.nextSibling !== target) { listEl.insertBefore(drag.row, target); renumber(); state.dirty = true; }
    } else if (listEl.lastElementChild !== drag.row) {
      listEl.appendChild(drag.row); renumber(); state.dirty = true;
    }
  }
  function onUp(e) {
    if (!drag) return;
    var h = drag.handle;
    h.removeEventListener("pointermove", onMove);
    h.removeEventListener("pointerup", onUp);
    h.removeEventListener("pointercancel", onUp);
    try { h.releasePointerCapture(e.pointerId); } catch (err) {}
    drag.clone.remove();
    drag.row.classList.remove("ord-holder");
    drag = null;
  }

  /* ---------------- salvar ---------------- */
  function save() {
    var ids = Array.prototype.slice.call(listEl.querySelectorAll(".ord-row")).map(function (r) { return r.dataset.id; });
    if (!ids.length) { msg("Nada pra salvar."); return; }
    saveBtn.disabled = true;
    msg("Salvando…");
    fetch(API + "/api/catalog/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        saveBtn.disabled = false;
        if (d && d.ok) {
          // reflete ordem localmente (10,20,30…) pra não desordenar se trocar de faixa e voltar
          ids.forEach(function (id, i) {
            var p = state.produtos.find(function (x) { return x.id === id; });
            if (p) p.ordem = (i + 1) * 10;
          });
          state.dirty = false;
          msg("Ordem salva ✓");
        } else {
          msg("Erro: " + ((d && d.error) || "desconhecido"));
        }
      })
      .catch(function () { saveBtn.disabled = false; msg("Falha de rede."); });
  }

  /* ---------------- abrir ---------------- */
  function open() {
    show();
    msg("Carregando…");
    listEl.innerHTML = "";
    fetch(API + "/api/catalog/all")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.produtos = (d && d.produtos) || [];
        msg("");
        render();
      })
      .catch(function () { msg("Falha ao carregar produtos."); });
  }
  window.__maratuOrdenarOpen = open; // hook p/ debug/entrada alternativa

  /* ---------------- botão na toolbar de produtos ---------------- */
  function injectBtn() {
    var tb = document.querySelector("#sub-produtos .prod-toolbar");
    if (!tb || tb.querySelector("#ordBtn")) return true;
    var b = document.createElement("button");
    b.id = "ordBtn";
    b.type = "button";
    b.className = "btn ghost";
    b.textContent = "⇅ Ordenar";
    b.addEventListener("click", open);
    tb.appendChild(b);
    return true;
  }
  if (!injectBtn()) {
    var tries = 0;
    var iv = setInterval(function () { tries++; if (injectBtn() || tries > 40) clearInterval(iv); }, 250);
  }
})();
