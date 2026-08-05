/* MARATU admin — modulo "Selos" (selos de autenticidade). Botao ao lado do Diario, na aba
   Marketing. Cinco telas num modal so: Lote (gera codigos e monta a folha A4 pra imprimir),
   Vincular (le o QR pela camera e amarra o selo a um produto), Lista, Alertas e Produtos.
   Os dados vao pro D1 (maratu-catalog: selos/reivindicacoes/acessos) via /api/selos/*;
   o Worker renderiza a pagina publica em /a/<codigo>.
   A folha do lote e montada AQUI, no navegador: montar 200 QRs no Worker estoura o teto
   de CPU por requisicao. O fetch() ja e envelopado pelo admin.js pra injetar o token.
   Nao toca no admin.js minificado. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuSelos) return;
  window.__maratuSelos = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var SITE = "https://maratu.com.br";
  var PRETO = "#0D0D0B", AREIA = "#F0ECE4", LARANJA = "#C8501A";
  var ESTADOS = [
    { k: "branco",       lbl: "Branco",     cor: "#8A8577" },
    { k: "ativo",        lbl: "Ativo",      cor: "#2E6BB8" },
    { k: "vendido",      lbl: "Vendido",    cor: "#C8501A" },
    { k: "reivindicado", lbl: "Registrado", cor: "#3E7D4F" },
    { k: "bloqueado",    lbl: "Bloqueado",  cor: "#0D0D0B" }
  ];
  /* Tamanhos de adesivo. A celula guarda o QR mais a linha do codigo, e a largura sai de
     dividir a area util do A4 (210 - 2x8mm de margem = 194mm) pelo numero de colunas, pra
     folha na tela sair igual a folha no papel. Altura escolhida pra fechar 280mm de linhas. */
  var UTIL_MM = 194;
  var TAMANHOS = [
    { k: "30", lbl: "30 mm", qr: 30, cols: 5, alt: 46.8 },
    { k: "40", lbl: "40 mm", qr: 40, cols: 4, alt: 56 },
    { k: "50", lbl: "50 mm", qr: 50, cols: 3, alt: 70 }
  ];
  TAMANHOS.forEach(function (t) { t.cel = UTIL_MM / t.cols; });

  var back = null, aba = "lote";
  var selos = [], produtos = [], alertas = [];
  var camera = null;   // { stream, video, timer, detector }

  /* ---------- utils ---------- */
  function $id(x) { return document.getElementById(x); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function hojeISO() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fmtBR(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function estInfo(k) { for (var i = 0; i < ESTADOS.length; i++) if (ESTADOS[i].k === k) return ESTADOS[i]; return ESTADOS[0]; }
  function tamInfo(k) { for (var i = 0; i < TAMANHOS.length; i++) if (TAMANHOS[i].k === k) return TAMANHOS[i]; return TAMANHOS[1]; }
  /* Mesmo alfabeto do Worker: sem 0, O, 1, I, L, U. Aqui so pra limpar o que foi digitado. */
  function normaliza(s) { return String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 10); }
  /* Aceita a URL inteira lida do QR ou so o codigo. */
  function codigoDaLeitura(txt) {
    var m = String(txt || "").match(/\/a\/([0-9A-Za-z]{1,14})/);
    return normaliza(m ? m[1] : txt);
  }
  function toast(txt) {
    var t = document.createElement("div");
    t.textContent = txt;
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100001;background:" +
      PRETO + ";color:" + AREIA + ";padding:11px 18px;border-radius:999px;font-family:var(--clother);" +
      "font-size:13px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.28);max-width:88vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }
  function pedeJson(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || ("erro " + r.status));
        return d;
      });
    });
  }
  function selo(k) {
    var e = estInfo(k);
    return '<span style="flex:0 0 auto;background:' + e.cor + ';color:#F0ECE4;border-radius:999px;padding:3px 9px;' +
      'font-size:9.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">' + e.lbl + "</span>";
  }

  var IC = {
    selo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:-2px;margin-right:6px"><path d="M12 3l1.9 1.4 2.3-.2.9 2.1 2.1.9-.2 2.3L20.4 12l-1.4 1.9.2 2.3-2.1.9-.9 2.1-2.3-.2L12 20.4l-1.9-1.4-2.3.2-.9-2.1-2.1-.9.2-2.3L3.6 12 5 10.1l-.2-2.3 2.1-.9.9-2.1 2.3.2z"/><path d="M9.4 12.2l1.9 1.9 3.4-3.4"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" style="vertical-align:-3px;margin-right:6px"><path d="M3 8h3l2-2h8l2 2h3v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    impressora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" style="vertical-align:-3px;margin-right:6px"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" style="vertical-align:-3px;margin-right:6px"><path d="M12 4.5 21 19H3z"/><path d="M12 10v4M12 16.6v.1"/></svg>',
    olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/></svg>'
  };

  /* ---------- bibliotecas sob demanda ---------- */
  /* O gerador e o leitor de QR so entram na pagina quando a tela pede. O admin abre
     dezenas de vezes por dia e nao pode carregar 150 KB de lib a toa. */
  var carregados = {};
  function carregaScript(src) {
    if (carregados[src]) return carregados[src];
    carregados[src] = new Promise(function (ok, erro) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { ok(); };
      s.onerror = function () { carregados[src] = null; erro(new Error("nao carregou " + src)); };
      document.head.appendChild(s);
    });
    return carregados[src];
  }
  function libGerador() { return carregaScript("/vendor/qrcode.min.js?v=1").then(function () { return window.qrcode; }); }
  function libLeitor() { return carregaScript("/vendor/jsQR.min.js?v=1").then(function () { return window.jsQR; }); }

  /* ---------- API ---------- */
  function carregaProdutos() {
    if (produtos.length) return Promise.resolve(produtos);
    return pedeJson(API + "/api/selos/produtos").then(function (d) { produtos = d.produtos || []; return produtos; });
  }
  function carregaSelos(filtros) {
    var q = [];
    if (filtros && filtros.status) q.push("status=" + encodeURIComponent(filtros.status));
    if (filtros && filtros.sku) q.push("sku=" + encodeURIComponent(filtros.sku));
    if (filtros && filtros.q) q.push("q=" + encodeURIComponent(filtros.q));
    return pedeJson(API + "/api/selos" + (q.length ? "?" + q.join("&") : "")).then(function (d) { selos = d.selos || []; return selos; });
  }

  /* ---------- botao na aba Marketing ---------- */
  function criarBtn() {
    var b = document.createElement("button");
    b.type = "button";
    b.id = "mktSelos";
    b.className = "mk-rbtn";
    b.style.cssText = "background:var(--areia);color:var(--preto);flex:1;";
    b.innerHTML = IC.selo + "Selos";
    b.addEventListener("click", abrir);
    return b;
  }
  function addBtn() {
    var mare = $id("mktMare"), meu = $id("mktSelos");
    if (meu && mare && meu.parentElement === mare.parentElement) return;
    if (meu) meu.remove();
    if (mare && mare.parentNode) { mare.parentNode.appendChild(criarBtn()); return; }
    var news = $id("mktNews");
    if (news && news.parentNode) { news.parentNode.appendChild(criarBtn()); return; }
    var nova = $id("mkNova");
    if (nova && nova.parentNode) nova.parentNode.appendChild(criarBtn());
  }

  /* ---------- modal ---------- */
  function montaModal() {
    if (back) return back;
    back = document.createElement("div");
    back.className = "modal-back";
    back.id = "seloBack";
    back.innerHTML =
      '<div class="modal-card" style="max-width:760px;max-height:90vh;overflow-y:auto;">' +
        '<div class="modal-head"><h3>Selos de autenticidade</h3>' +
        '<button type="button" class="modal-close" id="slClose" aria-label="Fechar">&times;</button></div>' +
        '<div id="slAbas" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;"></div>' +
        '<div id="slCorpo"></div>' +
      "</div>";
    document.body.appendChild(back);
    back.addEventListener("click", function (e) { if (e.target === back) fechar(); });
    $id("slClose").addEventListener("click", fechar);
    return back;
  }
  function pintaAbas() {
    var abas = [
      { k: "lote", lbl: "Lote" },
      { k: "vincular", lbl: "Vincular" },
      { k: "lista", lbl: "Lista" },
      { k: "alertas", lbl: "Alertas" },
      { k: "produtos", lbl: "Produtos" }
    ];
    $id("slAbas").innerHTML = abas.map(function (a) {
      var on = a.k === aba;
      return '<button type="button" class="chip" data-aba="' + a.k + '" aria-pressed="' + on + '" style="' +
        "padding:7px 13px;border-radius:999px;border:1.5px solid " + (on ? PRETO : "rgba(13,13,11,.22)") + ";" +
        "background:" + (on ? PRETO : "transparent") + ";color:" + (on ? AREIA : PRETO) + ";" +
        'font-family:var(--clother);font-size:12.5px;font-weight:700;cursor:pointer;">' + a.lbl + "</button>";
    }).join("");
    Array.prototype.forEach.call($id("slAbas").querySelectorAll("[data-aba]"), function (b) {
      b.onclick = function () { vaiPara(b.getAttribute("data-aba")); };
    });
  }
  function vaiPara(k) {
    paraCamera();
    aba = k;
    pintaAbas();
    if (k === "lote") telaLote();
    else if (k === "vincular") telaVincular();
    else if (k === "lista") telaLista();
    else if (k === "alertas") telaAlertas();
    else telaProdutos();
  }
  function abrir() {
    montaModal();
    back.classList.add("on");
    vaiPara("lote");
  }
  function fechar() {
    paraCamera();
    if (back) back.classList.remove("on");
  }
  function carregando() { $id("slCorpo").innerHTML = '<p style="font-family:var(--clother);font-size:.85rem;opacity:.6;margin:14px 2px;">carregando…</p>'; }
  function falhou(e) {
    $id("slCorpo").innerHTML = '<p style="font-family:var(--clother);font-size:.85rem;color:' + LARANJA + ';margin:14px 2px;">' +
      esc(String((e && e.message) || e)) + "</p>";
  }

  /* ================= TELA: LOTE ================= */
  function telaLote() {
    $id("slCorpo").innerHTML =
      '<div class="form-section-title">Selos em branco</div>' +
      '<p style="font-family:var(--clother);font-size:.78rem;opacity:.62;margin:0 2px 12px;line-height:1.5;">' +
        "Gera os códigos e monta a folha A4 pra imprimir. O selo nasce em branco: só vira peça " +
        "depois de vincular a um produto na tela ao lado.</p>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">' +
        '<label class="f" style="flex:0 0 110px;margin:0;"><span>Quantidade</span>' +
          '<input id="slQtd" type="number" min="1" max="500" value="30" inputmode="numeric"></label>' +
        '<label class="f" style="flex:0 0 130px;margin:0;"><span>Adesivo</span>' +
          '<select id="slTam">' + TAMANHOS.map(function (t) {
            return '<option value="' + t.k + '"' + (t.k === "40" ? " selected" : "") + ">" + t.lbl + "</option>";
          }).join("") + "</select></label>" +
        '<button type="button" class="btn" id="slGerar" style="flex:1;min-width:150px;">Gerar e montar folha</button>' +
      "</div>" +
      '<div id="slLoteSaida" style="margin-top:14px;"></div>' +

      '<div class="form-section-title" style="margin-top:26px;">Peça já vendida (retroativo)</div>' +
      '<p style="font-family:var(--clother);font-size:.78rem;opacity:.62;margin:0 2px 12px;line-height:1.5;">' +
        "Peça que saiu antes do sistema existir. Nasce vinculada e já vendida, pra reivindicação abrir. " +
        "Sem adesivo: o link vai por email. Campo que você não souber fica vazio — data chutada, nunca.</p>" +
      '<label class="f"><span>Produto</span><select id="slRetProd"></select></label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<label class="f" style="flex:0 0 100px;"><span>Quantos</span><input id="slRetN" type="number" min="1" max="200" value="1" inputmode="numeric"></label>' +
        '<label class="f" style="flex:1;min-width:140px;"><span>Impressa em (se souber)</span><input id="slRetData" type="date"></label>' +
      "</div>" +
      '<button type="button" class="btn ghost" id="slRetGerar" style="width:100%;">Criar selos retroativos</button>' +
      '<div id="slRetSaida" style="margin-top:12px;"></div>';

    carregaProdutos().then(function () {
      $id("slRetProd").innerHTML = produtos.filter(function (p) { return p.ativo; })
        .map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + "</option>"; }).join("");
    }).catch(function () {});

    $id("slGerar").onclick = function () {
      var n = Number($id("slQtd").value) || 0;
      if (n < 1 || n > 500) return toast("de 1 a 500 selos por lote");
      var tam = tamInfo($id("slTam").value);
      var btn = this;
      btn.disabled = true;
      btn.textContent = "gerando…";
      pedeJson(API + "/api/selos/lote", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: n })
      }).then(function (d) {
        return montaFolha(d.codigos || [], tam).then(function () {
          $id("slLoteSaida").innerHTML =
            '<p style="font-family:var(--clother);font-size:.85rem;margin:0 2px;">' +
            "<b>" + (d.codigos || []).length + " selos</b> gerados. A folha abriu por cima; use Imprimir e salve em PDF se quiser.</p>";
        });
      }).catch(function (e) { toast(String(e.message || e)); })
        .then(function () { btn.disabled = false; btn.innerHTML = "Gerar e montar folha"; });
    };

    $id("slRetGerar").onclick = function () {
      var sku = $id("slRetProd").value;
      var n = Number($id("slRetN").value) || 0;
      if (!sku) return toast("escolha o produto");
      if (n < 1 || n > 200) return toast("de 1 a 200 por vez");
      var btn = this;
      btn.disabled = true;
      pedeJson(API + "/api/selos/retroativo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: sku, n: n, data_impressao: $id("slRetData").value || null })
      }).then(function (d) {
        var links = (d.codigos || []).map(function (c) {
          return '<div style="display:flex;gap:8px;align-items:center;padding:7px 2px;border-bottom:1px solid rgba(13,13,11,.1);">' +
            '<code style="font-size:12.5px;letter-spacing:.06em;">' + esc(c) + "</code>" +
            '<a href="' + SITE + "/a/" + esc(c) + '" target="_blank" rel="noopener" style="font-size:11.5px;color:' + LARANJA + ';margin-left:auto;">abrir</a>' +
            '<button type="button" class="btn ghost" data-copia="' + SITE + "/a/" + esc(c) + '" style="padding:4px 10px;font-size:11px;">copiar link</button></div>';
        }).join("");
        $id("slRetSaida").innerHTML = '<p style="font-family:var(--clother);font-size:.82rem;margin:0 2px 8px;">' +
          (d.codigos || []).length + " selos criados. Mande o link pra quem comprou.</p>" + links;
        Array.prototype.forEach.call($id("slRetSaida").querySelectorAll("[data-copia]"), function (b) {
          b.onclick = function () {
            var t = b.getAttribute("data-copia");
            if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("link copiado"); });
            else toast(t);
          };
        });
      }).catch(function (e) { toast(String(e.message || e)); })
        .then(function () { btn.disabled = false; });
    };
  }

  /* ---------- folha A4 pra impressao ---------- */
  /* Montada aqui no navegador, em SVG (vetor nao serrilha na impressora). Correcao de erro
     nivel M: aguenta adesivo riscado sem virar QR gigante. */
  function montaFolha(codigos, tam) {
    return libGerador().then(function (qrcode) {
      var cels = codigos.map(function (c) {
        var qr = qrcode(0, "M");
        qr.addData(SITE + "/a/" + c);
        qr.make();
        // margin 8 = 4 modulos de zona de silencio dentro do proprio SVG. Sem ela o texto do
        // codigo encosta no QR e o leitor erra; com ela o quadrado de 40 mm ja vem completo.
        var svg = qr.createSvgTag({ cellSize: 2, margin: 8, scalable: true });
        return '<div class="sf-cel"><div class="sf-qr">' + svg + "</div><div class=\"sf-cod\">" + esc(c) + "</div></div>";
      }).join("");

      var folha = $id("seloFolha");
      if (folha) folha.remove();
      folha = document.createElement("div");
      folha.id = "seloFolha";
      folha.innerHTML =
        '<div class="sf-barra">' +
          '<span class="sf-tit">' + codigos.length + " selos · " + tam.lbl + "</span>" +
          '<button type="button" class="btn" id="sfImprimir">' + IC.impressora + "Imprimir</button>" +
          '<button type="button" class="btn ghost" id="sfFechar">Fechar</button>' +
        "</div>" +
        '<div class="sf-grade">' + cels + "</div>";
      document.body.appendChild(folha);
      document.body.classList.add("selo-imprimindo");

      var st = $id("seloFolhaCss");
      if (!st) { st = document.createElement("style"); st.id = "seloFolhaCss"; document.head.appendChild(st); }
      st.textContent =
        "#seloFolha{position:fixed;inset:0;z-index:100002;background:#fff;overflow-y:auto;padding:0 0 40px;}" +
        "#seloFolha .sf-barra{position:sticky;top:0;z-index:2;display:flex;gap:10px;align-items:center;" +
          "padding:12px 16px;background:" + AREIA + ";border-bottom:1.5px solid rgba(13,13,11,.15);}" +
        "#seloFolha .sf-tit{font-family:var(--clother);font-size:13px;font-weight:700;flex:1;}" +
        "#seloFolha .sf-grade{display:flex;flex-wrap:wrap;align-content:flex-start;gap:0;" +
          "width:" + UTIL_MM + "mm;max-width:100%;margin:8mm auto;}" +
        "#seloFolha .sf-cel{width:" + tam.cel.toFixed(2) + "mm;height:" + tam.alt + "mm;display:flex;flex-direction:column;" +
          "align-items:center;justify-content:center;gap:1.5mm;break-inside:avoid;page-break-inside:avoid;" +
          /* marca de corte discreta: tracejado claro pra guiar a tesoura, sem sangria */
          "outline:.2mm dashed #c9c9c9;outline-offset:-.1mm;}" +
        "#seloFolha .sf-qr{width:" + tam.qr + "mm;height:" + tam.qr + "mm;}" +
        "#seloFolha .sf-qr svg{width:100%;height:100%;display:block;}" +
        "#seloFolha .sf-cod{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
          "font-size:" + (tam.qr / 10).toFixed(1) + "mm;letter-spacing:.05em;color:#000;}" +
        "@media print{@page{size:A4;margin:8mm;}" +
          "body.selo-imprimindo>*:not(#seloFolha){display:none !important;}" +
          "#seloFolha{position:static;overflow:visible;padding:0;}" +
          "#seloFolha .sf-barra{display:none;}" +
          "#seloFolha .sf-grade{margin:0;}}";

      $id("sfImprimir").onclick = function () { window.print(); };
      $id("sfFechar").onclick = function () {
        folha.remove();
        document.body.classList.remove("selo-imprimindo");
      };
    });
  }

  /* ================= TELA: VINCULAR ================= */
  function telaVincular() {
    $id("slCorpo").innerHTML =
      '<p style="font-family:var(--clother);font-size:.78rem;opacity:.62;margin:0 2px 12px;line-height:1.5;">' +
        "Leia o QR do adesivo com a câmera, ou digite o código. Selo em branco abre o vínculo " +
        "com a data de hoje já preenchida.</p>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" class="btn" id="slCam" style="flex:1;min-width:150px;">' + IC.camera + "Abrir câmera</button>" +
      "</div>" +
      '<div id="slCamBox" style="display:none;margin-top:12px;position:relative;">' +
        '<video id="slVideo" playsinline muted style="width:100%;max-height:46vh;object-fit:cover;border-radius:14px;background:#000;"></video>' +
        '<canvas id="slCanvas" style="display:none;"></canvas>' +
        '<p id="slCamMsg" style="font-family:var(--clother);font-size:.75rem;opacity:.62;margin:8px 2px 0;">apontando…</p>' +
      "</div>" +
      '<div style="display:flex;gap:8px;align-items:flex-end;margin-top:14px;">' +
        '<label class="f" style="flex:1;margin:0;"><span>Ou digite o código</span>' +
          '<input id="slCod" placeholder="ex: K7M2X9PQ4A" autocapitalize="characters" autocomplete="off" spellcheck="false" ' +
          'style="font-family:ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;"></label>' +
        '<button type="button" class="btn ghost" id="slBuscar" style="flex:0 0 auto;">Buscar</button>' +
      "</div>" +
      '<div id="slVincSaida" style="margin-top:14px;"></div>';

    $id("slCam").onclick = ligaCamera;
    $id("slBuscar").onclick = function () { abreSelo(normaliza($id("slCod").value)); };
    $id("slCod").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); abreSelo(normaliza($id("slCod").value)); }
    });
    carregaProdutos().catch(function () {});
  }

  /* BarcodeDetector quando existe (Android/Chrome), jsQR quando nao (o caso do Safari).
     Assim funciona nos dois sem decidir plataforma agora. */
  function ligaCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return toast("este navegador não abre a câmera; digite o código");
    }
    var box = $id("slCamBox"), video = $id("slVideo"), msg = $id("slCamMsg");
    box.style.display = "";
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(function (stream) {
        camera = { stream: stream, video: video, timer: null, detector: null, parado: false };
        video.srcObject = stream;
        video.setAttribute("playsinline", "");
        return video.play();
      })
      .then(function () {
        if (window.BarcodeDetector) {
          return window.BarcodeDetector.getSupportedFormats().then(function (fs) {
            if (fs.indexOf("qr_code") >= 0) {
              camera.detector = new window.BarcodeDetector({ formats: ["qr_code"] });
              msg.textContent = "procurando o QR…";
              return null;
            }
            return libLeitor();
          }).catch(function () { return libLeitor(); });
        }
        msg.textContent = "carregando o leitor…";
        return libLeitor();
      })
      .then(function (jsQR) {
        if (jsQR) camera.jsqr = jsQR;
        msg.textContent = "procurando o QR…";
        varre();
      })
      .catch(function (e) {
        msg.textContent = "não consegui usar a câmera: " + (e && e.message || e);
        paraCamera();
      });
  }

  function varre() {
    if (!camera || camera.parado) return;
    var v = camera.video;
    var seguinte = function () { camera.timer = setTimeout(varre, 220); };
    if (!v.videoWidth) return seguinte();

    var achou = function (txt) {
      var c = codigoDaLeitura(txt);
      if (!c) return seguinte();
      if (navigator.vibrate) navigator.vibrate(40);
      paraCamera();
      $id("slCamBox").style.display = "none";
      abreSelo(c);
    };

    if (camera.detector) {
      camera.detector.detect(v).then(function (cods) {
        if (cods && cods.length) return achou(cods[0].rawValue);
        seguinte();
      }).catch(seguinte);
      return;
    }
    if (camera.jsqr) {
      var cv = $id("slCanvas");
      var l = Math.min(v.videoWidth, v.videoHeight, 640);
      cv.width = l; cv.height = l;
      var ctx = cv.getContext("2d");
      // recorta o meio do quadro: menos pixel pra varrer, e é onde a pessoa mira
      ctx.drawImage(v, (v.videoWidth - l) / 2, (v.videoHeight - l) / 2, l, l, 0, 0, l, l);
      var img = ctx.getImageData(0, 0, l, l);
      var r = camera.jsqr(img.data, l, l, { inversionAttempts: "dontInvert" });
      if (r && r.data) return achou(r.data);
    }
    seguinte();
  }

  function paraCamera() {
    if (!camera) return;
    camera.parado = true;
    if (camera.timer) clearTimeout(camera.timer);
    try { camera.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { camera.video.srcObject = null; } catch (e) {}
    camera = null;
  }

  function abreSelo(codigo) {
    var saida = $id("slVincSaida");
    if (!saida) return;
    if (!codigo) return toast("código vazio");
    saida.innerHTML = '<p style="font-family:var(--clother);font-size:.85rem;opacity:.6;margin:6px 2px;">procurando ' + esc(codigo) + "…</p>";
    pedeJson(API + "/api/selos/um?codigo=" + encodeURIComponent(codigo)).then(function (d) {
      var s = d.selo;
      if (s.status !== "branco") return mostraOcupado(s);
      formVinculo(s);
    }).catch(function (e) {
      saida.innerHTML = '<div style="padding:12px 14px;border-radius:12px;background:rgba(200,80,26,.1);' +
        'font-family:var(--clother);font-size:.85rem;">Selo <b>' + esc(codigo) + "</b> não existe no sistema. " +
        "Confira os caracteres — o código não tem 0, O, 1, I, L nem U.</div>";
    });
  }

  /* Selo ja usado nao se sobrescreve: mostra o estado e para por ai. */
  function mostraOcupado(s) {
    var e = estInfo(s.status);
    $id("slVincSaida").innerHTML =
      '<div style="padding:14px 15px;border-radius:14px;border:1.5px solid ' + e.cor + ';">' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">' + selo(s.status) +
          '<code style="font-size:13px;letter-spacing:.06em;">' + esc(s.codigo) + "</code></div>" +
        '<p style="font-family:var(--clother);font-size:.85rem;margin:0 0 4px;line-height:1.5;">' +
          "Este selo já está " + e.lbl.toLowerCase() + (s.produto_nome ? ", na peça <b>" + esc(s.produto_nome) + "</b>" : "") + ". " +
          "Não dá pra vincular por cima.</p>" +
        (s.data_impressao ? '<p style="font-family:var(--clother);font-size:.75rem;opacity:.6;margin:0;">impressa em ' + esc(fmtBR(s.data_impressao)) + "</p>" : "") +
        (s.dono_nome && s.confirmado_em ? '<p style="font-family:var(--clother);font-size:.75rem;opacity:.6;margin:4px 0 0;">registrada por ' + esc(s.dono_nome) + "</p>" : "") +
        '<p style="margin:10px 0 0;"><a href="' + SITE + "/a/" + esc(s.codigo) + '" target="_blank" rel="noopener" ' +
          'style="font-size:12px;color:' + LARANJA + ';font-weight:700;">abrir a página pública</a></p>' +
      "</div>";
  }

  function formVinculo(s) {
    carregaProdutos().then(function () {
      $id("slVincSaida").innerHTML =
        '<div style="padding:14px 15px;border-radius:14px;border:1.5px solid rgba(13,13,11,.18);">' +
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">' + selo("branco") +
            '<code style="font-size:13px;letter-spacing:.06em;">' + esc(s.codigo) + "</code></div>" +
          '<label class="f"><span>Produto</span><select id="slVProd">' +
            produtos.filter(function (p) { return p.ativo; }).map(function (p) {
              return '<option value="' + esc(p.id) + '">' + esc(p.nome) + "</option>";
            }).join("") + "</select></label>" +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<label class="f" style="flex:1;min-width:130px;"><span>Impressa em</span>' +
              '<input id="slVData" type="date" value="' + hojeISO() + '"></label>' +
            '<label class="f" style="flex:1;min-width:130px;"><span>Feita em</span>' +
              '<input id="slVCidade" value="Aracaju, Sergipe"></label>' +
          "</div>" +
          '<label class="f"><span>Nota (opcional)</span><input id="slVNota" placeholder="só pra você; não sai no certificado"></label>' +
          '<button type="button" class="btn" id="slVSalvar" style="width:100%;">Vincular</button>' +
        "</div>";
      $id("slVSalvar").onclick = function () {
        var btn = this;
        btn.disabled = true;
        pedeJson(API + "/api/selos/vincular", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: s.codigo, sku: $id("slVProd").value,
            data_impressao: $id("slVData").value || null,
            cidade: $id("slVCidade").value || null,
            nota: $id("slVNota").value || null
          })
        }).then(function (d) {
          toast("selo vinculado a " + d.produto);
          $id("slVincSaida").innerHTML =
            '<div style="padding:14px 15px;border-radius:14px;background:rgba(62,125,79,.12);font-family:var(--clother);font-size:.88rem;">' +
              "<b>" + esc(s.codigo) + "</b> agora é " + esc(d.produto) + ". " +
              '<a href="' + SITE + "/a/" + esc(s.codigo) + '" target="_blank" rel="noopener" style="color:' + LARANJA + ';font-weight:700;">ver a página</a></div>';
          $id("slCod").value = "";
        }).catch(function (e) { toast(String(e.message || e)); btn.disabled = false; });
      };
    });
  }

  /* ================= TELA: LISTA ================= */
  function telaLista() {
    carregando();
    Promise.all([carregaProdutos(), carregaSelos({})]).then(function () {
      $id("slCorpo").innerHTML =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
          '<select id="slFStatus" style="flex:1;min-width:120px;"><option value="">todos os estados</option>' +
            ESTADOS.map(function (e) { return '<option value="' + e.k + '">' + e.lbl + "</option>"; }).join("") + "</select>" +
          '<select id="slFProd" style="flex:1;min-width:120px;"><option value="">todos os produtos</option>' +
            produtos.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + "</option>"; }).join("") + "</select>" +
        "</div>" +
        '<div id="slTabela"></div>';
      $id("slFStatus").onchange = recarrega;
      $id("slFProd").onchange = recarrega;
      pintaTabela();
    }).catch(falhou);
  }
  function recarrega() {
    carregaSelos({ status: $id("slFStatus").value, sku: $id("slFProd").value }).then(pintaTabela).catch(falhou);
  }
  function pintaTabela() {
    var el = $id("slTabela");
    if (!el) return;
    if (!selos.length) {
      el.innerHTML = '<p style="font-family:var(--clother);font-size:.85rem;opacity:.6;margin:10px 2px;">Nenhum selo com esse filtro.</p>';
      return;
    }
    el.innerHTML = selos.map(function (s) {
      return '<div class="sl-linha" data-cod="' + esc(s.codigo) + '" style="display:flex;gap:9px;align-items:center;' +
        'padding:10px 11px;border:1.5px solid rgba(13,13,11,.14);border-radius:12px;margin-bottom:7px;cursor:pointer;">' +
        selo(s.status) +
        '<span style="flex:1;min-width:0;">' +
          '<code style="display:block;font-size:12.5px;letter-spacing:.06em;">' + esc(s.codigo) + "</code>" +
          '<span style="font-size:11px;opacity:.6;">' + esc(s.produto_nome || "sem peça") +
            (s.data_impressao ? " · " + esc(fmtBR(s.data_impressao)) : "") +
            (s.origem === "retroativo" ? " · retroativo" : "") + "</span></span>" +
        '<span style="flex:0 0 auto;font-size:11px;opacity:.55;display:flex;align-items:center;gap:4px;">' +
          IC.olho + (s.acessos || 0) + "</span>" +
        "</div>";
    }).join("") +
    '<p style="font-family:var(--clother);font-size:.72rem;opacity:.5;margin:10px 2px 0;">Toque num selo pra ver as ações.</p>';
    Array.prototype.forEach.call(el.querySelectorAll(".sl-linha"), function (d) {
      d.onclick = function () {
        var c = d.getAttribute("data-cod");
        for (var i = 0; i < selos.length; i++) if (selos[i].codigo === c) return acoes(selos[i]);
      };
    });
  }

  function acoes(s) {
    var e = estInfo(s.status);
    var b = document.createElement("div");
    b.className = "modal-back on";
    b.style.zIndex = "100003";
    var podeVender = s.status === "ativo";
    var podeLiberar = s.status === "reivindicado" || s.status === "vendido";
    var podeBloquear = s.status !== "bloqueado";
    var podeSoltar = s.status === "bloqueado";
    b.innerHTML =
      '<div class="modal-card" style="max-width:420px;">' +
        '<div class="modal-head"><h3>' + esc(s.codigo) + "</h3>" +
        '<button type="button" class="modal-close" data-fecha aria-label="Fechar">&times;</button></div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">' + selo(s.status) +
          '<span style="font-family:var(--clother);font-size:.85rem;">' + esc(s.produto_nome || "sem peça vinculada") + "</span></div>" +
        (s.dono_nome && s.confirmado_em ? '<p style="font-family:var(--clother);font-size:.8rem;opacity:.7;margin:0 0 10px;">registrada por ' + esc(s.dono_nome) + "</p>" : "") +
        (s.pedido_ref ? '<p style="font-family:var(--clother);font-size:.8rem;opacity:.7;margin:0 0 10px;">pedido ' + esc(s.pedido_ref) + "</p>" : "") +
        (podeVender ? '<label class="f"><span>Referência do pedido (opcional)</span><input id="slPedido" placeholder="ex: WA 12/07"></label>' : "") +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          (podeVender ? '<button type="button" class="btn" data-ac="vendido">Marcar como vendido</button>' : "") +
          (podeLiberar ? '<button type="button" class="btn ghost" data-ac="liberar">Liberar reivindicação</button>' : "") +
          (podeBloquear ? '<button type="button" class="btn ghost" data-ac="bloqueado" style="color:' + LARANJA + ';">Bloquear</button>' : "") +
          (podeSoltar ? '<button type="button" class="btn ghost" data-ac="ativo">Desbloquear</button>' : "") +
          '<a class="btn ghost" href="' + SITE + "/a/" + esc(s.codigo) + '" target="_blank" rel="noopener" ' +
            'style="text-decoration:none;text-align:center;">Abrir a página pública</a>' +
        "</div>" +
      "</div>";
    document.body.appendChild(b);
    var fecha = function () { b.remove(); };
    b.addEventListener("click", function (ev) { if (ev.target === b) fecha(); });
    b.querySelector("[data-fecha]").onclick = fecha;
    Array.prototype.forEach.call(b.querySelectorAll("[data-ac]"), function (btn) {
      btn.onclick = function () {
        var ac = btn.getAttribute("data-ac");
        btn.disabled = true;
        var pedido = b.querySelector("#slPedido");
        var p = ac === "liberar"
          ? pedeJson(API + "/api/selos/liberar", {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: s.codigo })
            })
          : pedeJson(API + "/api/selos/status", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ codigo: s.codigo, status: ac, pedido_ref: (pedido && pedido.value) || null })
            });
        p.then(function () {
          toast(ac === "liberar" ? "reivindicação apagada, selo voltou pra ativo" : "selo agora está " + estInfo(ac).lbl.toLowerCase());
          fecha();
          recarrega();
        }).catch(function (er) { toast(String(er.message || er)); btn.disabled = false; });
      };
    });
  }

  /* ================= TELA: ALERTAS ================= */
  function telaAlertas() {
    carregando();
    pedeJson(API + "/api/selos/alertas").then(function (d) {
      alertas = d.alertas || [];
      $id("slCorpo").innerHTML =
        '<p style="font-family:var(--clother);font-size:.78rem;opacity:.62;margin:0 2px 12px;line-height:1.5;">' +
          "O código não impede cópia; o comportamento é que denuncia. Aparece aqui o selo com mais de " +
          "15 acessos, o que foi aberto de três regiões ou mais, e o que continua sendo consultado depois de registrado.</p>" +
        (alertas.length
          ? alertas.map(function (a) {
              return '<div class="sl-alerta" data-cod="' + esc(a.codigo) + '" style="display:flex;gap:9px;align-items:center;' +
                'padding:11px 12px;border:1.5px solid rgba(200,80,26,.35);border-radius:12px;margin-bottom:7px;cursor:pointer;">' +
                '<span style="flex:0 0 auto;color:' + LARANJA + ';">' + IC.alerta + "</span>" +
                '<span style="flex:1;min-width:0;">' +
                  '<code style="display:block;font-size:12.5px;letter-spacing:.06em;">' + esc(a.codigo) + "</code>" +
                  '<span style="font-size:11px;opacity:.65;">' + esc(a.produto_nome || "sem peça") + " · " + esc(a.motivos.join(" · ")) + "</span>" +
                "</span>" + selo(a.status) + "</div>";
            }).join("")
          : '<p style="font-family:var(--clother);font-size:.85rem;opacity:.6;margin:10px 2px;">Nenhum selo com padrão estranho.</p>');
      Array.prototype.forEach.call($id("slCorpo").querySelectorAll(".sl-alerta"), function (d2) {
        d2.onclick = function () {
          var c = d2.getAttribute("data-cod");
          for (var i = 0; i < alertas.length; i++) if (alertas[i].codigo === c) return acoes(alertas[i]);
        };
      });
    }).catch(falhou);
  }

  /* ================= TELA: PRODUTOS ================= */
  /* Dimensoes e texto de origem: escritos uma vez por produto, herdados por toda unidade.
     O resto do cadastro continua na tela de produtos da loja; aqui so o que o certificado usa. */
  function telaProdutos() {
    carregando();
    produtos = [];
    carregaProdutos().then(function () {
      $id("slCorpo").innerHTML =
        '<p style="font-family:var(--clother);font-size:.78rem;opacity:.62;margin:0 2px 12px;line-height:1.5;">' +
          "O que o certificado mostra além do que já existe na loja. Escreve uma vez, vale pra " +
          "todas as peças daquele produto. Campo em branco não aparece no certificado.</p>" +
        produtos.map(function (p, i) {
          return '<div style="padding:12px 13px;border:1.5px solid rgba(13,13,11,.14);border-radius:12px;margin-bottom:8px;' +
            (p.ativo ? "" : "opacity:.6;") + '">' +
            '<b style="font-family:var(--clother);font-size:13.5px;">' + esc(p.nome) + "</b>" +
            (p.ativo ? "" : '<span style="font-size:10.5px;opacity:.7;margin-left:7px;">despublicado</span>') +
            '<label class="f" style="margin-top:8px;"><span>Dimensões</span>' +
              '<input data-dim="' + i + '" value="' + esc(p.dimensoes || "") + '" placeholder="ex: 29,7 × 42 cm"></label>' +
            '<label class="f"><span>Texto de origem</span>' +
              '<textarea data-org="' + i + '" rows="2" placeholder="ex: Impressa em PLA e acabada à mão na oficina do estúdio.">' +
              esc(p.origem_texto || "") + "</textarea></label>" +
            '<button type="button" class="btn ghost" data-salva="' + i + '" style="width:100%;">Salvar</button>' +
          "</div>";
        }).join("");
      Array.prototype.forEach.call($id("slCorpo").querySelectorAll("[data-salva]"), function (b) {
        b.onclick = function () {
          var i = b.getAttribute("data-salva");
          var p = produtos[i];
          var dim = $id("slCorpo").querySelector('[data-dim="' + i + '"]').value.trim();
          var org = $id("slCorpo").querySelector('[data-org="' + i + '"]').value.trim();
          b.disabled = true;
          pedeJson(API + "/api/selos/produto", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sku: p.id, dimensoes: dim || null, origem_texto: org || null })
          }).then(function () {
            p.dimensoes = dim; p.origem_texto = org;
            toast("salvo");
          }).catch(function (e) { toast(String(e.message || e)); })
            .then(function () { b.disabled = false; });
        };
      });
    }).catch(falhou);
  }

  /* ---------- boot ---------- */
  function boot() {
    addBtn();
    // a aba Marketing se repinta sozinha; o botao volta pro lugar quando isso acontece
    var alvo = $id("panel-marketing");
    if (alvo && window.MutationObserver) {
      new MutationObserver(function () { addBtn(); }).observe(alvo, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
