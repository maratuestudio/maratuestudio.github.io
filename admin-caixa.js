/* MARATU admin — modulo "Caixa" (redesign da aba Orcamento > Lancamentos).
   Reconstroi #sub-vendas: resumo (liquido, barra por origem, taxa MP, meta) +
   acoes (Entrada, Novo carne) + filtros + lista agrupada por dia com selo de origem.
   Sobrescreve window.renderVendas. Usa vars de tema do admin (--areia/--preto/--laranja/
   --muted/--line) pra adaptar dia/noite. So SVG, sem emoji. Depende de
   MaratuStore.getLancamentos/setLancamentos/getParams e dos globais brl/num/esc/uid/todayStr.
   Aciona window.MaratuCarne.open() e window.MaratuEntradas.sync(). Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuCaixa) return;
  window.__maratuCaixa = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";

  var FONTES = {
    pix:    { lbl: "Pix",    cor: "#3E7D4F" },
    mp:     { lbl: "MP",     cor: "#2E6BB8" },
    manual: { lbl: "Manual", cor: "#8A8577" },
    carne:  { lbl: "Carnê",  cor: "#C8501A" }
  };
  var ORDEM_FONTE = ["mp", "pix", "manual", "carne"];
  var filtro = "todas";
  var cxHidden = false;
  try { cxHidden = localStorage.getItem("maratu.fatHidden") === "1"; } catch (e) {}

  /* ---- globais do core com fallback ---- */
  function BRL(v) { try { if (typeof brl === "function") return brl(v); } catch (e) {} return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function NUM(v) { try { if (typeof num === "function") return num(v); } catch (e) {} return parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0; }
  // valor no store ja e numero; num() so serve pra string BR do usuario
  function toNum(v) { if (typeof v === "number") return v; if (v == null || v === "") return 0; return NUM(v); }
  function ESC(s) { try { if (typeof esc === "function") return esc(s); } catch (e) {} return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function UID() { try { if (typeof uid === "function") return uid(); } catch (e) {} return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function HOJE() { try { if (typeof todayStr === "function") return todayStr(); } catch (e) {} var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function getLancs() { try { return MaratuStore.getLancamentos() || []; } catch (e) { return []; } }
  function setLancs(a) { try { MaratuStore.setLancamentos(a); return true; } catch (e) { return false; } }
  function getMeta() { try { var p = MaratuStore.getParams() || {}; return toNum(p.fixo) + toNum(p.retirada); } catch (e) { return 0; } }

  /* ---- ocultar valores/nomes (igual "olho" da home; mesma chave localStorage) ---- */
  function MASKV() { try { if (typeof maskBRL === "function") return maskBRL(); } catch (e) {} return "R$ •••••"; }
  function money(v) { return cxHidden ? MASKV() : BRL(v); }
  function plain(v) { return cxHidden ? "•••••" : BRL(v).replace(/^R\$\s*/, ""); }
  function maskName(s) { return cxHidden ? "••••••" : ESC(s); }
  function maskMeta(s) { var e = ESC(s); return cxHidden ? e.replace(/R\$\s*[\d.,]+/g, "R$ •••") : e; }
  function setHidden(on) {
    cxHidden = !!on;
    try { localStorage.setItem("maratu.fatHidden", cxHidden ? "1" : "0"); } catch (e) {}
    // mantem a home em sincronia (fatHidden/applyFatEye/renderPainel sao globais do admin.js)
    try { fatHidden = cxHidden; } catch (e) {}
    try { if (typeof applyFatEye === "function") applyFatEye(); } catch (e) {}
    try { if (typeof renderPainel === "function") renderPainel(); } catch (e) {}
  }

  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function toast(txt) {
    var t = document.createElement("div");
    t.textContent = txt;
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100000;background:#0D0D0B;color:#F0ECE4;" +
      "font-family:inherit;font-size:13px;font-weight:700;padding:12px 18px;border-radius:12px;box-shadow:3px 3px 0 0 #C8501A;max-width:88vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }

  /* ---- origem e parse ---- */
  function fonteDe(l) {
    var id = String(l.id || ""), lab = String(l.label || "");
    if (id.indexOf("mp-") === 0) return "mp";
    if (id.indexOf("btg-") === 0) return "pix";
    if (id.indexOf("lanc-") === 0 || /^carn[eê]/i.test(lab)) return "carne";
    return "manual";
  }
  function parseItem(l) {
    var f = fonteDe(l), lab = String(l.label || ""), valor = toNum(l.valor), title = lab || "—", meta = "";
    if (f === "mp") {
      var mBruto = lab.match(/bruto R\$\s*([\d.]+)/);
      var bruto = mBruto ? parseFloat(mBruto[1]) : null;
      var mParc = lab.match(/(\d+)x/);
      var mNome = lab.match(/Mercado Pago[·\s]+([^·]+?)(?:\s+\d+x|\s+·|$)/);
      var nome = (mNome && mNome[1].trim()) || "";
      title = (nome && !/@/.test(nome)) ? nome : "Mercado Pago";
      var partes = ["Cartão"];
      if (mParc) partes.push(mParc[1] + "x");
      if (bruto != null) { partes.push("bruto " + BRL(bruto)); if (bruto - valor > 0.005) partes.push("taxa " + BRL(bruto - valor)); }
      meta = partes.join(" · ");
    } else if (f === "pix") {
      title = lab.replace(/^Pix recebido de\s*/i, "").trim() || "Pix";
      meta = "Pix · conta BTG";
    } else if (f === "carne") {
      title = lab;
      meta = "crediário · recebida";
    } else {
      title = lab;
      meta = "lançado à mão";
    }
    return { fonte: f, title: title, meta: meta, valor: valor };
  }

  function svg(paths, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="' + (w || 17) + '" height="' + (w || 17) + '">' + paths + '</svg>'; }
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12h5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>'
  };

  /* ---- estilos (usam vars de tema do admin) ---- */
  function injectStyles() {
    if (document.getElementById("cxStyles")) return;
    var s = document.createElement("style");
    s.id = "cxStyles";
    s.textContent =
      "#sub-vendas .cx{display:flex;flex-direction:column;gap:13px}" +
      ".cx-resumo{background:var(--areia);border:2px solid var(--preto);border-radius:18px;box-shadow:4px 4px 0 0 var(--preto);padding:16px 16px 14px}" +
      ".cx-cap{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}" +
      ".cx-num{font-size:36px;font-weight:900;letter-spacing:-.03em;line-height:1;margin:6px 0 3px;color:var(--preto);font-variant-numeric:tabular-nums}" +
      ".cx-num small{font-size:19px;font-weight:800;color:var(--muted)}" +
      ".cx-sub{font-size:12.5px;color:var(--muted);font-weight:600}.cx-sub b{color:var(--laranja)}" +
      ".cx-bar{display:flex;height:12px;border-radius:20px;overflow:hidden;margin:13px 0 10px;border:1.5px solid var(--preto)}" +
      ".cx-bar span{display:block;height:100%}" +
      ".cx-leg{display:flex;flex-wrap:wrap;gap:6px 14px}" +
      ".cx-leg div{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--muted)}" +
      ".cx-dot{width:10px;height:10px;border-radius:3px;flex:0 0 auto}" +
      ".cx-meta{margin-top:13px;padding-top:12px;border-top:1px solid var(--line)}" +
      ".cx-meta-row{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px}" +
      ".cx-meta-bar{height:8px;border-radius:20px;background:var(--line);overflow:hidden}" +
      ".cx-meta-fill{height:100%;background:var(--laranja);border-radius:20px}" +
      ".cx-acoes{display:flex;gap:10px}" +
      ".cx-acoes button{flex:1;padding:12px;border:1.5px solid var(--preto);border-radius:13px;font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;box-shadow:2px 2px 0 0 var(--preto);display:flex;align-items:center;justify-content:center;gap:7px;-webkit-tap-highlight-color:transparent}" +
      ".cx-b1{background:var(--laranja);color:#F0ECE4}.cx-b2{background:var(--areia);color:var(--preto)}" +
      ".cx-refresh{border:none;background:none;color:var(--muted);cursor:pointer;padding:3px;display:flex;opacity:.5;-webkit-tap-highlight-color:transparent}" +
      ".cx-refresh:hover{opacity:1;color:var(--laranja)}" +
      "@media(prefers-reduced-motion:no-preference){.cx-spin{animation:cxspin .7s linear}}@keyframes cxspin{to{transform:rotate(360deg)}}" +
      ".cx-add{background:var(--areia);border:1.5px solid var(--preto);border-radius:13px;box-shadow:2px 2px 0 0 var(--preto);padding:12px;display:none;gap:8px;flex-wrap:wrap}" +
      ".cx-add.on{display:flex}" +
      ".cx-add input{flex:1;min-width:110px;box-sizing:border-box;padding:10px 11px;border:1.5px solid var(--preto);border-radius:9px;background:var(--areia-fundo,#fff);font-family:inherit;font-size:14px;color:var(--preto)}" +
      ".cx-add input.v{flex:0 0 96px;min-width:0}" +
      ".cx-add button{padding:10px 14px;border:1.5px solid var(--preto);border-radius:9px;background:var(--laranja);color:#F0ECE4;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer}" +
      ".cx-filtros{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}" +
      ".cx-chip{white-space:nowrap;padding:7px 13px;border:1.5px solid var(--preto);border-radius:20px;background:var(--areia);color:var(--preto);font-size:12.5px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      ".cx-chip.on{background:var(--preto);color:var(--areia)}" +
      ".cx-grupo{margin-top:2px}" +
      ".cx-ghead{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:0 4px 7px}" +
      ".cx-lista{background:var(--areia);border:1.5px solid var(--preto);border-radius:15px;box-shadow:2px 2px 0 0 var(--preto);overflow:hidden}" +
      ".cx-item{display:flex;align-items:center;gap:11px;padding:11px 12px}" +
      ".cx-item+.cx-item{border-top:1px solid var(--line)}" +
      ".cx-tag{flex:0 0 auto;font-size:9.5px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;color:#fff;padding:4px 8px;border-radius:7px;min-width:50px;text-align:center}" +
      ".cx-mid{flex:1;min-width:0}" +
      ".cx-nome{font-size:14px;font-weight:700;color:var(--preto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".cx-imeta{font-size:11px;color:var(--muted);font-weight:600;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".cx-val{font-size:15px;font-weight:800;color:var(--preto);white-space:nowrap;font-variant-numeric:tabular-nums}" +
      ".cx-del{border:none;background:none;color:var(--muted);cursor:pointer;padding:2px;display:flex;opacity:.5}" +
      ".cx-del:hover{opacity:1;color:var(--laranja)}" +
      ".cx-empty{text-align:center;font-size:13px;color:var(--muted);padding:26px 10px}";
    document.head.appendChild(s);
  }

  /* ---- layout ---- */
  function buildLayout() {
    var host = document.getElementById("sub-vendas");
    if (!host || host.querySelector(".cx")) return !!host;
    injectStyles();
    host.innerHTML =
      '<div class="cx">' +
        '<div class="cx-resumo" id="cxResumo"></div>' +
        '<div class="cx-acoes">' +
          '<button class="cx-b1" id="cxAddBtn">' + svg(IC.plus, 17) + 'Entrada</button>' +
          '<button class="cx-b2" id="cxCarneBtn">' + svg(IC.receipt, 17) + 'Novo carnê</button>' +
        '</div>' +
        '<div class="cx-add" id="cxAddForm">' +
          '<input id="cxLabel" placeholder="Ex: kit vendido" autocomplete="off">' +
          '<input id="cxValor" class="v" inputmode="decimal" placeholder="Valor" autocomplete="off">' +
          '<button id="cxSalvar">Lançar</button>' +
        '</div>' +
        '<div class="cx-filtros" id="cxFiltros"></div>' +
        '<div id="cxList"></div>' +
      '</div>';

    host.querySelector("#cxAddBtn").addEventListener("click", function () {
      var f = host.querySelector("#cxAddForm"); f.classList.toggle("on");
      if (f.classList.contains("on")) setTimeout(function () { host.querySelector("#cxLabel").focus(); }, 30);
    });
    host.querySelector("#cxCarneBtn").addEventListener("click", function () {
      try { if (window.MaratuCarne && window.MaratuCarne.open) window.MaratuCarne.open(null); } catch (e) {}
    });
    host.querySelector("#cxSalvar").addEventListener("click", salvarEntrada);
    host.querySelector("#cxValor").addEventListener("keydown", function (e) { if (e.key === "Enter") salvarEntrada(); });
    return true;
  }

  function salvarEntrada() {
    var host = document.getElementById("sub-vendas");
    var lab = host.querySelector("#cxLabel").value.trim();
    var val = toNum(host.querySelector("#cxValor").value);
    if (!lab || val <= 0) return;
    setLancs(getLancs().concat([{ id: UID(), data: HOJE(), label: lab, valor: val }]));
    host.querySelector("#cxLabel").value = ""; host.querySelector("#cxValor").value = "";
    host.querySelector("#cxAddForm").classList.remove("on");
    render();
    try { if (typeof renderPainel === "function") renderPainel(); } catch (e) {}
  }

  /* ---- render ---- */
  function fmtDia(iso) {
    var hoje = HOJE();
    if (iso === hoje) return "Hoje";
    var p = iso.split("-");
    return p[2] + " " + (MESES[parseInt(p[1], 10) - 1] || p[1]);
  }
  function render() {
    var host = document.getElementById("sub-vendas");
    if (!host || !host.querySelector(".cx")) return;
    var mes = HOJE().slice(0, 7);
    var lancs = getLancs().filter(function (l) { return (l.data || "").slice(0, 7) === mes; })
      .sort(function (a, b) { return (b.data || "").localeCompare(a.data || ""); });

    var total = 0, porFonte = { pix: 0, mp: 0, manual: 0, carne: 0 }, mpFee = 0;
    var itens = lancs.map(function (l) {
      var it = parseItem(l); it.id = l.id; it.data = l.data;
      total += it.valor; porFonte[it.fonte] += it.valor;
      if (it.fonte === "mp") { var mB = String(l.label || "").match(/bruto R\$\s*([\d.]+)/); if (mB) { var b = parseFloat(mB[1]); if (b - it.valor > 0.005) mpFee += b - it.valor; } }
      return it;
    });
    var meta = getMeta(), pct = meta > 0 ? Math.min(100, total / meta * 100) : 0;

    // resumo
    var barSeg = ORDEM_FONTE.filter(function (f) { return porFonte[f] > 0; }).map(function (f) {
      var w = total > 0 ? (porFonte[f] / total * 100) : 0;
      return '<span style="width:' + w + '%;background:' + FONTES[f].cor + '"></span>';
    }).join("");
    var leg = ORDEM_FONTE.filter(function (f) { return porFonte[f] > 0; }).map(function (f) {
      return '<div><span class="cx-dot" style="background:' + FONTES[f].cor + '"></span>' + FONTES[f].lbl + " " + money(porFonte[f]) + "</div>";
    }).join("");
    host.querySelector("#cxResumo").innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
        '<div class="cx-cap">Entrou em ' + (MESES[parseInt(mes.slice(5), 10) - 1] || "") + " (líquido)</div>" +
        '<div style="display:flex;gap:4px;align-items:center">' +
          '<button type="button" id="cxEye" class="cx-refresh" title="' + (cxHidden ? "Mostrar valores" : "Ocultar valores") + '" aria-label="' + (cxHidden ? "Mostrar valores" : "Ocultar valores") + '" aria-pressed="' + (cxHidden ? "true" : "false") + '">' + svg(cxHidden ? IC.eyeOff : IC.eye, 15) + "</button>" +
          '<button type="button" id="cxSync" class="cx-refresh" title="Atualizar" aria-label="Atualizar">' + svg(IC.refresh, 14) + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="cx-num"><small>R$</small> ' + plain(total) + "</div>" +
      '<div class="cx-sub">' + itens.length + " entrada" + (itens.length === 1 ? "" : "s") +
        (mpFee > 0 ? " · o Mercado Pago levou <b>" + money(mpFee) + "</b> em taxas" : "") + "</div>" +
      (barSeg ? '<div class="cx-bar">' + barSeg + "</div><div class=\"cx-leg\">" + leg + "</div>" : "") +
      (meta > 0 ? '<div class="cx-meta"><div class="cx-meta-row"><span>Meta do mês</span><span>' + plain(total) + " / " + plain(meta) + '</span></div><div class="cx-meta-bar"><div class="cx-meta-fill" style="width:' + pct + '%"></div></div></div>' : "");
    var ey = host.querySelector("#cxEye");
    if (ey) ey.addEventListener("click", function () { setHidden(!cxHidden); render(); });
    var sy = host.querySelector("#cxSync");
    if (sy) sy.addEventListener("click", function () {
      sy.classList.add("cx-spin");
      var done = function () { sy.classList.remove("cx-spin"); };
      try { var r = (window.MaratuEntradas && window.MaratuEntradas.sync) ? window.MaratuEntradas.sync(true) : null; if (r && r.then) r.then(done); else setTimeout(done, 700); } catch (e) { done(); }
    });

    // filtros
    var counts = { todas: itens.length, pix: 0, mp: 0, manual: 0, carne: 0 };
    itens.forEach(function (it) { counts[it.fonte]++; });
    var chips = [["todas", "Todas"], ["pix", "Pix"], ["mp", "Mercado Pago"], ["manual", "Manual"], ["carne", "Carnê"]];
    host.querySelector("#cxFiltros").innerHTML = chips.filter(function (c) { return c[0] === "todas" || counts[c[0]] > 0; })
      .map(function (c) { return '<div class="cx-chip' + (filtro === c[0] ? " on" : "") + '" data-f="' + c[0] + '">' + c[1] + "</div>"; }).join("");
    host.querySelectorAll("#cxFiltros .cx-chip").forEach(function (ch) {
      ch.addEventListener("click", function () { filtro = ch.getAttribute("data-f"); render(); });
    });

    // lista agrupada
    var vis = itens.filter(function (it) { return filtro === "todas" || it.fonte === filtro; });
    var list = host.querySelector("#cxList");
    if (!vis.length) { list.innerHTML = '<div class="cx-empty">Nenhuma entrada' + (filtro !== "todas" ? " nesse filtro" : " neste mês ainda") + ".</div>"; return; }
    var grupos = [], mapa = {};
    vis.forEach(function (it) { if (!mapa[it.data]) { mapa[it.data] = []; grupos.push(it.data); } mapa[it.data].push(it); });
    list.innerHTML = grupos.map(function (dia) {
      var arr = mapa[dia], sub = arr.reduce(function (s, it) { return s + it.valor; }, 0);
      return '<div class="cx-grupo"><div class="cx-ghead"><span>' + fmtDia(dia) + "</span><span>+ " + money(sub) + '</span></div><div class="cx-lista">' +
        arr.map(function (it) {
          return '<div class="cx-item">' +
            '<span class="cx-tag" style="background:' + FONTES[it.fonte].cor + '">' + FONTES[it.fonte].lbl + "</span>" +
            '<div class="cx-mid"><div class="cx-nome">' + maskName(it.title) + '</div><div class="cx-imeta">' + maskMeta(it.meta) + "</div></div>" +
            '<div class="cx-val">' + money(it.valor) + "</div>" +
            '<button class="cx-del" data-del="' + ESC(it.id) + '" aria-label="Remover">' + svg(IC.x, 15) + "</button>" +
          "</div>";
        }).join("") + "</div></div>";
    }).join("");
    list.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () { apagar(b.getAttribute("data-del")); });
    });
  }

  /* Apagar e definitivo. Entrada automatica (Pix do BTG, Mercado Pago) volta no proximo
     cron se so sumir da lista, entao o id tambem entra na lista de ignorados do Worker. */
  function apagar(id) {
    var lanc = null;
    getLancs().forEach(function (l) { if (String(l.id) === String(id)) lanc = l; });
    if (!lanc) return;
    var it = parseItem(lanc);
    var auto = /^(btg-|mp-)/.test(String(id));
    if (!confirm("Apagar " + it.title + " (" + BRL(it.valor) + ")?\n\n" +
      (auto ? "Some do caixa pra sempre — nem a sincronização traz de volta." : "Não dá pra desfazer."))) return;
    setLancs(getLancs().filter(function (l) { return String(l.id) !== String(id); }));
    render();
    try { if (typeof renderPainel === "function") renderPainel(); } catch (e) {}
    if (!auto) return;
    fetch(API + "/api/entradas/ignorar", {
      method: "POST",
      headers: { Authorization: "Bearer ", "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, motivo: "apagado na Caixa" })
    }).then(function (r) { if (!r.ok) toast("Apaguei da lista, mas pode voltar na sincronização"); })
      .catch(function () { toast("Sem conexão — pode voltar na sincronização"); });
  }

  /* ---- boot: monta, sobrescreve renderVendas, renderiza ---- */
  function boot() {
    var t = 0, iv = setInterval(function () {
      t++;
      if (buildLayout()) {
        clearInterval(iv);
        window.renderVendas = render;
        render();
      } else if (t > 60) clearInterval(iv);
    }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
