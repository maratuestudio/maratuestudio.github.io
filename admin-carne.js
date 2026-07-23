/* MARATU admin — modulo "Carne" (crediario informal).
   Cadastra uma compra parcelada e gera eventos de cobranca (tipo:"cobranca") na
   agenda, um por vencimento. O feed .ics do Worker ja emite alarme (vespera + no
   dia) + PRIORITY:1 SO nesses eventos, entao o Apple Calendar assinado avisa sozinho.
   Nao toca no admin.js minificado: injeta UI e usa MaratuStore.get/setEventos
   (raw, preserva os __mark). Ver reference_maratu_admin_js / reference_maratu_ics_feed. */
(function () {
  "use strict";
  if (window.__maratuCarne) return;
  window.__maratuCarne = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var PIX = "estudio@maratu.com.br";
  var AREIA = "#F0ECE4", PRETO = "#0D0D0B", LARANJA = "#C8501A";
  var feedUrl = "";

  /* ---------- utils ---------- */
  function uid() { return "cb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function isoAddDays(iso, days) {
    var p = iso.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2] + days);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function fmtBR(iso) { var p = (iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : iso; }
  function money(n) { return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function parseMoney(s) {
    var t = String(s || "").replace(/[^\d,.-]/g, "");
    if (t.indexOf(",") > -1) t = t.replace(/\./g, "").replace(",", ".");
    return parseFloat(t) || 0;
  }
  function diasEntre(isoA, isoB) {
    var a = isoA.split("-").map(Number), b = isoB.split("-").map(Number);
    var da = Date.UTC(a[0], a[1] - 1, a[2]), db = Date.UTC(b[0], b[1] - 1, b[2]);
    return Math.round((db - da) / 864e5);
  }

  /* ---------- estado dos eventos (via core, preserva __mark) ---------- */
  function addEvents(novos) {
    try {
      if (typeof MaratuStore !== "undefined" && MaratuStore.getEventos && MaratuStore.setEventos) {
        MaratuStore.setEventos((MaratuStore.getEventos() || []).concat(novos));
        rerender(); return true;
      }
    } catch (e) {}
    try {
      if (typeof getEventos === "function" && typeof setEventos === "function") {
        setEventos((getEventos() || []).concat(novos));
        rerender(); return true;
      }
    } catch (e) {}
    return false;
  }
  function findEvento(id) {
    try {
      if (typeof MaratuStore !== "undefined" && MaratuStore.getEventos)
        return (MaratuStore.getEventos() || []).filter(function (e) { return String(e.id) === String(id); })[0];
    } catch (e) {}
    try {
      if (typeof getEventos === "function")
        return (getEventos() || []).filter(function (e) { return String(e.id) === String(id); })[0];
    } catch (e) {}
    return null;
  }
  function rerender() {
    ["renderCal", "renderPainel", "renderUpcoming"].forEach(function (fn) {
      try { if (typeof window[fn] === "function") window[fn](); } catch (e) {}
    });
  }

  /* ---------- feed assinado (Apple Calendar) ---------- */
  function activateFeed() {
    fetch(API + "/api/config", { headers: { Authorization: "Bearer " } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.feedUrl) {
          feedUrl = d.feedUrl;
          window.__MARATU_FEED = feedUrl;
          try { if (typeof setupApple === "function") setupApple(); } catch (e) {}
          var link = document.getElementById("cnFeedLink");
          if (link) { link.href = feedUrl.replace(/^https?:/, "webcal:"); link.style.display = ""; }
        }
      }).catch(function () {});
  }

  /* ---------- decodificar metadados da parcela (guardados em notas) ---------- */
  function parseParcela(notas) {
    var o = {}; String(notas || "").split(";").forEach(function (kv) {
      var i = kv.indexOf(":"); if (i > 0) o[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    });
    return o;
  }

  /* ---------- gerar as cobrancas ---------- */
  function gerarCobrancas(o) {
    var carneId = uid(), evs = [];
    var base = Math.floor((o.total / o.nparc) * 100) / 100;
    var ultima = Math.round((o.total - base * (o.nparc - 1)) * 100) / 100;
    for (var i = 0; i < o.nparc; i++) {
      var val = (i === o.nparc - 1) ? ultima : base;
      var venc = i === 0 ? o.data1 : isoAddDays(o.data1, o.intervalo * i);
      evs.push({
        id: uid(),
        titulo: "Cobrar " + o.cliente + " " + (i + 1) + "/" + o.nparc + " · R$" + money(val),
        tipo: "cobranca",
        data: venc,
        hora: "09:00",
        diaInteiro: false,
        cliente: o.cliente,
        notas: "carne:" + carneId + ";parc:" + (i + 1) + "/" + o.nparc + ";valor:" + val.toFixed(2) +
               ";tel:" + (o.tel || "") + ";prod:" + (o.prod || ""),
        feito: 0, publico: 0, data_fim: null, hora_fim: null
      });
    }
    return evs;
  }

  /* ---------- mensagem de cobranca (WhatsApp) ---------- */
  function msgCobranca(ev) {
    var p = parseParcela(ev.notas);
    var dias = diasEntre(todayISO(), ev.data);
    var quando = dias === 0 ? "vence hoje" : dias === 1 ? "vence amanha" :
      dias > 1 ? "vence em " + dias + " dias (" + fmtBR(ev.data) + ")" :
      "venceu em " + fmtBR(ev.data);
    var prod = p.prod ? " (" + p.prod + ")" : "";
    var val = p.valor ? money(parseFloat(p.valor)) : "";
    return "Oi " + (ev.cliente || "") + "! Passando pra lembrar da parcela " + (p.parc || "") +
      prod + ": R$ " + val + ", " + quando + ". Pode pagar no Pix: " + PIX + ". Qualquer coisa me chama!";
  }
  function waLink(ev) {
    var tel = (parseParcela(ev.notas).tel || "").replace(/\D/g, "");
    var base = tel ? "https://wa.me/55" + tel : "https://wa.me/";
    return base + "?text=" + encodeURIComponent(msgCobranca(ev));
  }

  /* ---------- toast ---------- */
  function toast(txt) {
    var t = document.createElement("div");
    t.textContent = txt;
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100000;" +
      "background:" + PRETO + ";color:" + AREIA + ";font-family:inherit;font-size:13px;font-weight:700;" +
      "padding:12px 18px;border-radius:12px;box-shadow:3px 3px 0 0 " + LARANJA + ";max-width:88vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }

  /* ---------- modal Novo carne ---------- */
  var modal = null;
  function fieldCss() {
    return "width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid " + PRETO + ";border-radius:10px;" +
      "background:#fff;font-family:inherit;font-size:15px;color:" + PRETO + ";margin-top:5px;";
  }
  function labCss() { return "display:block;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:" + PRETO + ";opacity:.7;margin-top:13px;"; }

  function buildModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "modal-back";
    modal.id = "carneModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;" +
      "background:rgba(13,13,11,.55);padding:16px;";
    modal.innerHTML =
      '<div class="modal-card" style="background:' + AREIA + ';border:2px solid ' + PRETO + ';border-radius:20px;' +
        'box-shadow:8px 8px 0 0 ' + PRETO + ';max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:20px 20px 22px;">' +
        '<div class="modal-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
          '<h3 style="font-family:inherit;font-weight:900;font-size:20px;letter-spacing:-.01em;color:' + PRETO + ';margin:0;">Novo carnê</h3>' +
          '<button type="button" id="cnClose" aria-label="Fechar" style="border:none;background:none;font-size:26px;line-height:1;cursor:pointer;color:' + PRETO + ';">×</button>' +
        '</div>' +
        '<p style="font-family:inherit;font-size:12.5px;color:' + PRETO + ';opacity:.65;margin:2px 0 6px;">Parcela no Pix e o app cria os lembretes de cobrança na agenda.</p>' +
        '<label style="' + labCss() + '">Cliente</label>' +
        '<input id="cnCliente" style="' + fieldCss() + '" placeholder="Nome" autocomplete="off">' +
        '<label style="' + labCss() + '">WhatsApp <span style="opacity:.5;font-weight:400">(DDD + número)</span></label>' +
        '<input id="cnTel" style="' + fieldCss() + '" placeholder="79 99999-9999" inputmode="tel" autocomplete="off">' +
        '<label style="' + labCss() + '">Produto <span style="opacity:.5;font-weight:400">(opcional)</span></label>' +
        '<input id="cnProd" style="' + fieldCss() + '" placeholder="ex: blusa azulejo" autocomplete="off">' +
        '<label style="' + labCss() + '">Valor total (R$)</label>' +
        '<input id="cnTotal" style="' + fieldCss() + '" placeholder="150,00" inputmode="decimal" autocomplete="off">' +
        '<div style="display:flex;gap:12px;">' +
          '<div style="flex:1;"><label style="' + labCss() + '">Parcelas</label>' +
            '<input id="cnParc" style="' + fieldCss() + '" value="3" inputmode="numeric"></div>' +
          '<div style="flex:1;"><label style="' + labCss() + '">A cada (dias)</label>' +
            '<input id="cnInt" style="' + fieldCss() + '" value="30" inputmode="numeric"></div>' +
        '</div>' +
        '<label style="' + labCss() + '">1ª parcela vence em</label>' +
        '<input id="cnData1" type="date" style="' + fieldCss() + '">' +
        '<div id="cnPreview" style="font-family:inherit;font-size:12.5px;color:' + PRETO + ';background:#fff;border:1.5px dashed ' + PRETO + ';border-radius:10px;padding:10px 12px;margin-top:14px;line-height:1.6;"></div>' +
        '<button type="button" id="cnGerar" style="width:100%;margin-top:16px;padding:14px;border:2px solid ' + PRETO + ';border-radius:12px;' +
          'background:' + LARANJA + ';color:' + AREIA + ';font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;box-shadow:3px 3px 0 0 ' + PRETO + ';">Gerar cobranças</button>' +
        '<a id="cnFeedLink" href="#" style="display:none;margin-top:12px;text-align:center;font-family:inherit;font-size:12.5px;font-weight:700;color:' + LARANJA + ';text-decoration:none;">📅 Assinar as cobranças no Apple Calendar</a>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector("#cnClose").addEventListener("click", closeModal);
    modal.querySelector("#cnGerar").addEventListener("click", onGerar);
    ["cnTotal", "cnParc", "cnInt", "cnData1", "cnCliente"].forEach(function (id) {
      modal.querySelector("#" + id).addEventListener("input", updatePreview);
    });
    if (feedUrl) { var l = modal.querySelector("#cnFeedLink"); l.href = feedUrl.replace(/^https?:/, "webcal:"); l.style.display = ""; }
    return modal;
  }

  function readForm() {
    var q = function (id) { return modal.querySelector("#" + id).value.trim(); };
    return {
      cliente: q("cnCliente"),
      tel: q("cnTel"),
      prod: q("cnProd"),
      total: parseMoney(q("cnTotal")),
      nparc: Math.max(1, Math.min(24, parseInt(q("cnParc"), 10) || 3)),
      intervalo: Math.max(1, parseInt(q("cnInt"), 10) || 30),
      data1: q("cnData1") || todayISO()
    };
  }
  function updatePreview() {
    var o = readForm(), box = modal.querySelector("#cnPreview");
    if (!o.total || !o.cliente) { box.innerHTML = "Preencha cliente e valor pra ver as parcelas."; return; }
    var evs = gerarCobrancas(o);
    box.innerHTML = evs.map(function (e) {
      var p = parseParcela(e.notas);
      return "<b>" + p.parc + "</b> · R$ " + money(parseFloat(p.valor)) + " → " + fmtBR(e.data);
    }).join("<br>");
  }
  function onGerar() {
    var o = readForm();
    if (!o.cliente) { toast("Coloque o nome do cliente"); return; }
    if (!o.total || o.total <= 0) { toast("Coloque o valor total"); return; }
    var evs = gerarCobrancas(o);
    if (!addEvents(evs)) { toast("Erro ao salvar (recarregue a página)"); return; }
    closeModal();
    toast(o.nparc + " cobranças criadas na agenda ✓");
  }
  function openModal() {
    buildModal();
    if (!modal.querySelector("#cnData1").value) modal.querySelector("#cnData1").value = todayISO();
    updatePreview();
    modal.style.display = "flex";
    setTimeout(function () { try { modal.querySelector("#cnCliente").focus(); } catch (e) {} }, 40);
  }
  function closeModal() { if (modal) modal.style.display = "none"; }

  /* ---------- botao "Novo carne" (depois do #calQuick) ---------- */
  function injectBtn() {
    if (document.getElementById("carneBtn")) return true;
    var q = document.getElementById("calQuick");
    if (!q || !q.parentNode) return false;
    var b = document.createElement("button");
    b.id = "carneBtn"; b.type = "button";
    b.innerHTML = "💰 Novo carnê <span style='opacity:.65;font-weight:600'>(compra parcelada)</span>";
    b.style.cssText = "display:block;width:100%;margin:0 0 12px;padding:12px 14px;border:1.5px solid " + PRETO + ";" +
      "border-radius:12px;background:" + AREIA + ";color:" + PRETO + ";font-family:inherit;font-weight:800;font-size:13.5px;" +
      "cursor:pointer;box-shadow:2px 2px 0 0 " + PRETO + ";-webkit-tap-highlight-color:transparent;text-align:left;";
    b.addEventListener("click", openModal);
    q.parentNode.insertBefore(b, q.nextSibling);
    return true;
  }

  /* ---------- botao "Cobrar no WhatsApp" no editor de evento ---------- */
  function injectCobrarBtn(id) {
    var body = document.getElementById("evDetailBody");
    if (!body) return;
    var old = document.getElementById("cnCobrarWrap");
    if (old) old.remove();
    var ev = findEvento(id);
    if (!ev || ev.tipo !== "cobranca") return;
    var wrap = document.createElement("div");
    wrap.id = "cnCobrarWrap";
    wrap.style.cssText = "margin:14px 0 2px;";
    var pago = ev.feito == 1 || ev.feito === true;
    wrap.innerHTML =
      '<a href="' + waLink(ev) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;' +
        'padding:13px;border:2px solid ' + PRETO + ';border-radius:12px;background:#25D366;color:#0b3d1f;font-family:inherit;' +
        'font-weight:900;font-size:14px;text-decoration:none;box-shadow:3px 3px 0 0 ' + PRETO + ';">💬 Cobrar no WhatsApp</a>' +
      '<div style="font-family:inherit;font-size:11px;color:' + PRETO + ';opacity:.55;text-align:center;margin-top:7px;">' +
        (pago ? "✓ marcada como paga" : "marque “feito” quando ela pagar") + "</div>";
    var fa = body.querySelector(".form-actions");
    if (fa) body.insertBefore(wrap, fa); else body.appendChild(wrap);
  }

  function wrapEditor() {
    if (typeof window.openEvDetail !== "function") return false;
    var _oed = window.openEvDetail;
    window.openEvDetail = function (kind, id) {
      _oed.apply(this, arguments);
      if (kind === "evento") { try { injectCobrarBtn(id); } catch (e) {} }
    };
    return true;
  }

  /* ---------- boot ---------- */
  function boot() {
    injectBtn();
    if (!wrapEditor()) {
      var n = 0, iv = setInterval(function () { n++; if (wrapEditor() || n > 40) clearInterval(iv); }, 200);
    }
    activateFeed();
    var t = 0, ib = setInterval(function () { t++; if (injectBtn() || t > 40) clearInterval(ib); }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
