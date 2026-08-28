/* MARATU admin — "Carrinho do site": os pedidos que saíram da loja pro WhatsApp.

   O carrinho do visitante mora no navegador dele, então o valor que ele vê não vale como
   prova. Ao finalizar, o site chama /api/pedido, o Worker soma pelo catálogo e devolve um
   código curto que entra na mensagem. Aqui ficam esses pedidos, com o valor que o servidor
   calculou: é por onde se confere se o que chegou no WhatsApp bate.

   A aba entra em #orcSeg, entre Caixa e Produtos do site. O admin.js minificado percorre
   uma lista fixa de sub-abas ("medida","ajustes","produtos","vendas") e prende o ouvinte
   nos botões que existiam no carregamento, então a troca desta aba é feita aqui.
   Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuCarrinhos) return;
  window.__maratuCarrinhos = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var SUBS = ["medida", "ajustes", "produtos", "vendas"];
  var filtro = "aberto";
  var cache = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function reais(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function quando(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " · " +
             d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return String(iso || "").slice(0, 16); }
  }
  // o admin.js embrulha o fetch pra pôr o token; aqui é só chamar
  function api(rota, opcoes) {
    return fetch(API + rota, opcoes).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // ── a aba e o painel ──
  function monta() {
    var seg = document.getElementById("orcSeg");
    var painel = document.getElementById("sub-produtos");
    if (!seg || !painel || document.getElementById("sub-carrinhos")) return false;

    var btn = document.createElement("button");
    btn.setAttribute("role", "tab");
    btn.setAttribute("data-sub", "carrinhos");
    btn.setAttribute("aria-selected", "false");
    btn.id = "btnSubCarrinhos";
    btn.textContent = "Carrinho do site";
    var alvo = seg.querySelector('[data-sub="produtos"]');
    seg.insertBefore(btn, alvo);

    var box = document.createElement("div");
    box.className = "sub-off";
    box.id = "sub-carrinhos";
    box.innerHTML =
      '<p class="hint">Pedidos fechados na loja. O valor aqui é o que o site calculou na ' +
      'hora, pelo catálogo, então não muda se o cliente mexer no aparelho dele.</p>' +
      '<div class="seg" role="tablist" id="pedSeg" style="margin-bottom:12px;">' +
        '<button role="tab" data-ped="aberto" aria-selected="true">Em aberto</button>' +
        '<button role="tab" data-ped="atendido" aria-selected="false">Atendidos</button>' +
        '<button role="tab" data-ped="" aria-selected="false">Todos</button>' +
      "</div>" +
      '<div id="pedLista"></div>';
    painel.parentNode.insertBefore(box, painel);

    // troca de sub-aba: a daqui e as que o admin.js já conhece
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-sub]");
      if (!b) return;
      var meu = b.getAttribute("data-sub") === "carrinhos";
      seg.querySelectorAll("button").forEach(function (o) {
        o.setAttribute("aria-selected", o === b ? "true" : "false");
      });
      box.className = meu ? "sub-on" : "sub-off";
      if (meu) {
        SUBS.forEach(function (n) {
          var el = document.getElementById("sub-" + n);
          if (el) el.className = "sub-off";
        });
        carrega();
      }
    });

    box.querySelector("#pedSeg").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-ped]");
      if (!b) return;
      box.querySelectorAll("#pedSeg button").forEach(function (o) {
        o.setAttribute("aria-selected", o === b ? "true" : "false");
      });
      filtro = b.getAttribute("data-ped");
      carrega();
    });

    box.querySelector("#pedLista").addEventListener("click", function (e) {
      var b = e.target.closest("[data-acao]");
      if (!b) return;
      acao(b.getAttribute("data-acao"), b.getAttribute("data-codigo"));
    });
    return true;
  }

  // ── dados ──
  function carrega() {
    var lista = document.getElementById("pedLista");
    if (!lista) return;
    lista.innerHTML = '<div class="vendas-empty">carregando…</div>';
    api("/api/pedidos" + (filtro ? "?status=" + filtro : ""))
      .then(function (d) {
        cache = d.pedidos || [];
        pinta();
      })
      .catch(function (e) {
        lista.innerHTML = '<div class="vendas-empty">não deu pra carregar: ' + esc(e.message) + "</div>";
      });
  }

  function pinta() {
    var lista = document.getElementById("pedLista");
    if (!lista) return;
    if (!cache.length) {
      lista.innerHTML = '<div class="vendas-empty">' +
        (filtro === "aberto" ? "Nenhum pedido em aberto." : "Nenhum pedido por aqui.") + "</div>";
      return;
    }
    lista.innerHTML = cache.map(function (p) {
      var itens = (p.itens || []).map(function (i) {
        return '<div class="ped-item"><span>' + i.qtd + "× " + esc(i.nome) +
          (i.variacao ? ' <em style="opacity:.6">(' + esc(i.variacao) + ")</em>" : "") + "</span>" +
          "<span>R$ " + reais(i.preco_unit * i.qtd) + "</span></div>";
      }).join("");
      var st = p.status || "aberto";
      return '<div class="ped-card" data-codigo="' + esc(p.codigo) + '">' +
        '<div class="ped-topo">' +
          '<div><b class="ped-cod">' + esc(p.codigo) + "</b>" +
            '<span class="ped-quando">' + esc(quando(p.criado_em)) + "</span></div>" +
          '<span class="ped-status ped-status--' + esc(st) + '">' + esc(st) + "</span>" +
        "</div>" +
        '<div class="ped-itens">' + itens + "</div>" +
        '<div class="ped-pe">' +
          '<b class="ped-total">R$ ' + reais(p.total) + "</b>" +
          '<div class="ped-acoes">' +
            (st === "atendido"
              ? '<button class="btn ghost" data-acao="aberto" data-codigo="' + esc(p.codigo) + '">Reabrir</button>'
              : '<button class="btn blue" data-acao="atendido" data-codigo="' + esc(p.codigo) + '">Dar check</button>') +
            '<button class="btn ghost" data-acao="caixa" data-codigo="' + esc(p.codigo) + '">Lançar na caixa</button>' +
            '<button class="btn ghost" data-acao="apagar" data-codigo="' + esc(p.codigo) + '">Apagar</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    }).join("");
  }

  function acao(qual, codigo) {
    var pedido = cache.filter(function (p) { return p.codigo === codigo; })[0];
    if (!pedido) return;

    if (qual === "caixa") {
      lancaNaCaixa(pedido);
      return;
    }
    if (qual === "apagar") {
      if (!confirm("Apagar o pedido " + codigo + "? Isso não desfaz a conversa no WhatsApp.")) return;
      api("/api/pedidos/apagar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigo })
      }).then(carrega).catch(function (e) { alert("Falhou: " + e.message); });
      return;
    }
    api("/api/pedidos/status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: codigo, status: qual })
    }).then(carrega).catch(function (e) { alert("Falhou: " + e.message); });
  }

  /* Lançar na caixa: o valor do pedido vira lançamento do dia, com o código no rótulo pra
     dar pra cruzar depois. lancamentos.valor é em REAIS, não em centavos. */
  function lancaNaCaixa(p) {
    if (!window.MaratuStore || !MaratuStore.getLancamentos) {
      alert("A caixa não está carregada nesta tela.");
      return;
    }
    var jaTem = MaratuStore.getLancamentos().some(function (l) {
      return String(l.label || "").indexOf(p.codigo) >= 0;
    });
    if (jaTem && !confirm("O pedido " + p.codigo + " já parece estar na caixa. Lançar de novo?")) return;

    var hoje = new Date();
    var iso = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0") +
      "-" + String(hoje.getDate()).padStart(2, "0");
    var nomes = (p.itens || []).map(function (i) { return i.qtd + "× " + i.nome; }).join(", ");
    MaratuStore.setLancamentos(MaratuStore.getLancamentos().concat([{
      id: "ped-" + p.codigo + "-" + Date.now(),   // o código fica no rótulo, pro cruzamento
      data: iso,
      label: "Pedido " + p.codigo + (nomes ? " · " + nomes : ""),
      // valor em reais com centavos: arredondar aqui viraria R$50 num pedido de R$49,90
      valor: Number(p.total || 0) / 100
    }]));
    if (typeof renderVendas === "function") renderVendas();
    if (typeof renderPainel === "function") renderPainel();
    acao("atendido", p.codigo);
  }

  // ── estilo, no vocabulário do admin ──
  var CSS =
    /* A régua de sub-abas foi desenhada para três botões. Com o quarto, em tela estreita
       o último ficava cortado na borda. Aqui ela passa a rolar de lado, e cada botão fica
       numa linha só em vez de quebrar em duas. */
    "@media (max-width:640px){" +
      "#orcSeg{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}" +
      "#orcSeg::-webkit-scrollbar{display:none}" +
      "#orcSeg button{flex:0 0 auto;white-space:nowrap}" +
    "}" +
    "#sub-carrinhos .ped-card{border:1px solid var(--line,#e3ddd2);border-radius:12px;" +
      "padding:12px 14px;margin-bottom:10px;background:var(--areia)}" +
    "#sub-carrinhos .ped-topo{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    "#sub-carrinhos .ped-cod{font-family:var(--clother),sans-serif;font-weight:900;font-size:15px;" +
      "letter-spacing:.04em}" +
    "#sub-carrinhos .ped-quando{display:block;font-size:11px;opacity:.55;margin-top:2px}" +
    "#sub-carrinhos .ped-status{font-size:10px;letter-spacing:.1em;text-transform:uppercase;" +
      "padding:3px 9px;border-radius:999px;border:1px solid var(--line,#e3ddd2)}" +
    "#sub-carrinhos .ped-status--aberto{background:var(--dourado,#D4960A);color:#0D0D0B;border-color:var(--preto,#0D0D0B)}" +
    "#sub-carrinhos .ped-status--atendido{background:var(--preto,#0D0D0B);color:var(--areia,#F0ECE4);border-color:var(--preto,#0D0D0B)}" +
    "#sub-carrinhos .ped-itens{margin:10px 0 8px;font-size:13px}" +
    "#sub-carrinhos .ped-item{display:flex;justify-content:space-between;gap:12px;padding:3px 0;" +
      "border-bottom:1px dashed rgba(13,13,11,.12)}" +
    "#sub-carrinhos .ped-item:last-child{border-bottom:0}" +
    "#sub-carrinhos .ped-pe{display:flex;align-items:center;justify-content:space-between;gap:10px;" +
      "flex-wrap:wrap;margin-top:6px}" +
    "#sub-carrinhos .ped-total{font-family:var(--clother),sans-serif;font-weight:900;font-size:17px}" +
    "#sub-carrinhos .ped-acoes{display:flex;gap:6px;flex-wrap:wrap}" +
    "#sub-carrinhos .ped-acoes .btn{padding:7px 11px;font-size:11px}";

  function css() {
    var s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var t = 0, iv = setInterval(function () {
    if (monta() || ++t > 60) { clearInterval(iv); }
  }, 250);
  css();
})();
