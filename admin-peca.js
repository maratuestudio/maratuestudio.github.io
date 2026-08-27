/* MARATU admin — o que a página da peça (/produto/<id>) mostra e o admin.js não conhece:
   descrição, ficha técnica, quem o "MARATU recomenda" e o teto de quantidade.

   Mesmo desenho do admin-prevenda.js: nada de cirurgia no minificado. A seção é injetada
   no #prodForm, o fetch é embrulhado por fora pra levar os campos no POST /api/catalog e
   no PUT /api/catalog/<id>, e a resposta do /api/catalog/all fica guardada pra preencher
   o formulário quando ele abre. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuPeca) return;
  window.__maratuPeca = true;

  var LINHAS_FICHA = 4;   // material, medidas, prazo, cuidados dão conta do catálogo de hoje
  var MAX_RECOMENDA = 4;
  var cache = {};         // id -> { descricao, ficha, galeria, relacionados, qtd_max, indisponivel }
  var lista = [];         // catálogo inteiro, pra montar os seletores de recomendação
  var sobraFicha = {};    // itens de ficha além das linhas da tela, da peça aberta agora

  /* Chip "Indisponível". Mora no #fFlags do admin.html, mas o admin.js minificado só
     conhece ativo/novo/oculto e apaga o resto toda vez que abre o formulário. Mesmo
     tratamento do admin-prevenda.js: o valor é lido do cache ao abrir e injetado no
     corpo ao salvar. */
  function chipOff() { return document.querySelector('#fFlags [data-flag="indisponivel"]'); }
  function offLigado() { var c = chipOff(); return !!c && c.getAttribute("aria-pressed") === "true"; }
  function ligaOff(on) { var c = chipOff(); if (c) c.setAttribute("aria-pressed", on ? "true" : "false"); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function idAtual() {
    var el = document.getElementById("fId");
    return el ? String(el.value || "") : "";
  }

  function guardar(produtos) {
    if (!Array.isArray(produtos)) return;
    lista = produtos.map(function (p) { return { id: String(p.id), nome: String(p.nome || p.id) }; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    produtos.forEach(function (p) {
      if (!p || p.id == null) return;
      cache[String(p.id)] = {
        descricao: p.descricao || "",
        ficha: p.ficha || null,
        // a galeria já aparece na página da peça, mas ainda não se edita por aqui:
        // fica guardada pra quando o formulário ganhar as imagens extras
        galeria: p.galeria || null,
        relacionados: p.relacionados || null,
        qtd_max: p.qtd_max || "",
        indisponivel: !!p.indisponivel
      };
    });
    pintaRecomenda();
  }

  // ── a seção no formulário ──
  function monta() {
    var form = document.getElementById("prodForm");
    if (!form || document.getElementById("fPecaBox")) return false;
    var acoes = form.querySelector(".form-actions");
    if (!acoes) return false;

    var box = document.createElement("div");
    box.id = "fPecaBox";
    var fichas = "";
    for (var i = 0; i < LINHAS_FICHA; i++) {
      fichas +=
        '<div class="grid2" style="margin-top:6px;">' +
          '<label class="f"><span>Item ' + (i + 1) + '</span>' +
            '<input class="fPecaFichaK" data-i="' + i + '" placeholder="Ex: Material" maxlength="40" /></label>' +
          '<label class="f"><span>Valor</span>' +
            '<input class="fPecaFichaV" data-i="' + i + '" placeholder="Ex: PLA reciclado" maxlength="80" /></label>' +
        "</div>";
    }
    var recos = "";
    for (var j = 0; j < MAX_RECOMENDA; j++) {
      recos += '<label class="f" style="margin-top:6px;"><span>Sugestão ' + (j + 1) + '</span>' +
        '<select class="fPecaReco" data-i="' + j + '"><option value="">— automático —</option></select></label>';
    }

    box.innerHTML =
      '<div class="form-section-title">Página da peça</div>' +
      '<div style="font-family:var(--clother);font-size:var(--fs-1);color:var(--muted);margin:0 0 10px;">' +
        'Aparece em <b>maratu.com.br/produto/' + '</b>&lt;id&gt;. Campo vazio some da página, não fica buraco.</div>' +
      '<label class="f"><span>Descrição</span>' +
        '<textarea id="fPecaDesc" rows="5" maxlength="2000" ' +
        'placeholder="O que é a peça, de onde veio, por que existe. Linha em branco separa parágrafo."></textarea></label>' +
      '<div class="form-section-title" style="margin-top:18px;">Ficha técnica</div>' + fichas +
      '<div class="form-section-title" style="margin-top:18px;">MARATU recomenda</div>' +
      '<div style="font-family:var(--clother);font-size:var(--fs-1);color:var(--muted);margin:0 0 4px;">' +
        'Deixe em automático pra sugerir por coleção e preço. O que você escolher vem primeiro, nesta ordem.</div>' +
      recos +
      '<label class="f" style="margin-top:18px;"><span>Máximo por pedido (opcional)</span>' +
        '<input id="fPecaQtd" inputmode="numeric" placeholder="20" maxlength="2" /></label>';

    acoes.parentNode.insertBefore(box, acoes);

    var ta = document.getElementById("fPecaDesc");
    if (ta) {
      // fundo, borda e foco vêm do CSS do admin, que já cobre textarea; aqui só o que
      // falta pra caixa de texto longa
      ta.style.cssText = "width:100%;font-family:var(--clother);font-size:var(--fs-2);line-height:1.5;resize:vertical;";
    }
    pintaRecomenda();
    return true;
  }

  function pintaRecomenda() {
    var sels = document.querySelectorAll(".fPecaReco");
    if (!sels.length || !lista.length) return;
    var eu = idAtual();
    sels.forEach(function (s) {
      var antes = s.value;
      s.innerHTML = '<option value="">— automático —</option>' +
        lista.filter(function (p) { return p.id !== eu; })
          .map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + "</option>"; })
          .join("");
      if (antes) s.value = antes;
    });
  }

  // ── preencher e ler ──
  function preenche() {
    var d = cache[idAtual()] || {};
    ligaOff(!!d.indisponivel);
    var desc = document.getElementById("fPecaDesc");
    if (desc) desc.value = d.descricao || "";
    var qtd = document.getElementById("fPecaQtd");
    if (qtd) qtd.value = d.qtd_max || "";

    var ficha = {};
    try { ficha = d.ficha ? (typeof d.ficha === "string" ? JSON.parse(d.ficha) : d.ficha) : {}; } catch (e) { ficha = {}; }
    var chaves = Object.keys(ficha || {});
    /* O formulário mostra 4 linhas, mas o Worker aceita 8. Peça que já tenha mais do
       que cabe aqui (import, edição direta no D1) não pode perder o resto só porque
       passou pelo admin: o excedente fica guardado e volta pro corpo no salvar. */
    sobraFicha = {};
    chaves.slice(LINHAS_FICHA).forEach(function (k) { sobraFicha[k] = ficha[k]; });
    document.querySelectorAll(".fPecaFichaK").forEach(function (el) {
      var i = Number(el.getAttribute("data-i"));
      el.value = chaves[i] || "";
    });
    document.querySelectorAll(".fPecaFichaV").forEach(function (el) {
      var i = Number(el.getAttribute("data-i"));
      el.value = chaves[i] ? ficha[chaves[i]] : "";
    });

    var rel = [];
    try { rel = d.relacionados ? (typeof d.relacionados === "string" ? JSON.parse(d.relacionados) : d.relacionados) : []; } catch (e) { rel = []; }
    pintaRecomenda();
    document.querySelectorAll(".fPecaReco").forEach(function (el) {
      var i = Number(el.getAttribute("data-i"));
      el.value = (Array.isArray(rel) && rel[i]) ? rel[i] : "";
    });
  }

  function leForm() {
    var desc = document.getElementById("fPecaDesc");
    if (!desc) return null;   // seção ainda não montou: melhor não mexer em nada
    var ficha = {};
    Object.keys(sobraFicha).forEach(function (k) { ficha[k] = sobraFicha[k]; });
    document.querySelectorAll(".fPecaFichaK").forEach(function (el) {
      var i = el.getAttribute("data-i");
      var v = document.querySelector('.fPecaFichaV[data-i="' + i + '"]');
      var k = (el.value || "").trim();
      var val = v ? (v.value || "").trim() : "";
      if (k && val) ficha[k] = val;
    });
    var rel = [];
    document.querySelectorAll(".fPecaReco").forEach(function (el) {
      var v = (el.value || "").trim();
      if (v && rel.indexOf(v) < 0) rel.push(v);
    });
    var qtd = document.getElementById("fPecaQtd");
    var n = qtd ? parseInt(qtd.value, 10) : NaN;
    return {
      descricao: (desc.value || "").trim(),
      ficha: Object.keys(ficha).length ? ficha : null,
      relacionados: rel.length ? rel : null,
      qtd_max: isFinite(n) && n >= 1 && n <= 99 ? n : null
    };
  }

  // ── o fetch, por fora do embrulho que o admin.js já faz pro token ──
  var _f = window.fetch;
  window.fetch = function (input, init) {
    var url = "";
    try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) {}
    var metodo = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var ehCatalogo = /\/api\/catalog(\/[^/?]+)?(\?|$)/.test(url) && !/\/(upload|reorder|layout|all)\b/.test(url);

    if (ehCatalogo && (metodo === "POST" || metodo === "PUT") && init && typeof init.body === "string") {
      try {
        var corpo = JSON.parse(init.body);
        var extras = leForm();
        // sem o chip na tela não dá pra afirmar nada: o campo fica fora do corpo e o
        // Worker preserva o que já estava gravado
        if (corpo && typeof corpo === "object" && corpo.nome && chipOff()) {
          corpo.indisponivel = offLigado() ? 1 : 0;
        }
        if (corpo && typeof corpo === "object" && corpo.nome && extras) {
          corpo.descricao = extras.descricao;
          corpo.ficha = extras.ficha;
          corpo.relacionados = extras.relacionados;
          corpo.qtd_max = extras.qtd_max;
          init = Object.assign({}, init, { body: JSON.stringify(corpo) });
        }
      } catch (e) {}
    }
    var r = _f.call(this, input, init);
    if (/\/api\/catalog(\/all)?(\?|$)/.test(url) && metodo === "GET") {
      r.then(function (res) {
        try {
          res.clone().json().then(function (d) { if (d && d.produtos) guardar(d.produtos); }).catch(function () {});
        } catch (e) {}
      }).catch(function () {});
    }
    return r;
  };

  /* Reforço: o embrulho acima só vê o catálogo quando o admin busca, e ele só busca
     quando a aba Catálogo abre. Quem entra direto na peça pelo painel ficaria sem a
     lista de sugestões e sem os textos já gravados. Esta chamada é a rota pública, sem
     token, e passa pelo mesmo embrulho, então cai no guardar() do mesmo jeito. */
  function puxaCatalogo() {
    try {
      window.fetch("https://maratu-api.raphaelnascimento.workers.dev/api/catalog", { cache: "no-store" })
        .catch(function () {});
    } catch (e) {}
  }

  /* O admin.js limpa o formulário toda vez que abre; os campos daqui ele não conhece,
     então quem recoloca é este observador, depois que o modal aparece. */
  function boot() {
    var modal = document.getElementById("prodModal");
    if (!modal) return false;
    if (!monta()) return false;
    puxaCatalogo();
    new MutationObserver(function () {
      if (!modal.classList.contains("on")) return;
      setTimeout(preenche, 0);
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    return true;
  }
  var t = 0, iv = setInterval(function () { if (boot() || ++t > 60) clearInterval(iv); }, 250);
})();
