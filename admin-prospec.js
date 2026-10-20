/* MARATU admin — modulo "Abordagem" (prospecção). Fila de negócios sem site achados no
   Google (tabela prospec no Worker, GET /api/prospec). Cada um tem a amostra e a mensagem
   do toque do dia prontas: dia 0, 3, 7 e 14. O envio é manual (um toque abre o Instagram
   com a mensagem copiada); "Enviei" agenda o próximo toque, "Respondeu" vira lead.
   Fica no topo da subaba Leads da aba Marketing. Não toca no admin.js minificado. */
(function () {
  "use strict";
  if (window.__maratuProspec) return;
  window.__maratuProspec = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var AREIA = "#F0ECE4", PRETO = "#0D0D0B", LARANJA = "#C8501A";
  var lista = [], buscas = [], temChave = true, loaded = false, abertos = false;

  function pad2(n) { return String(n).padStart(2, "0"); }
  function hoje() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fmtBR(iso) { var p = (iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nota(n) { return n == null ? "" : String(Number(n).toFixed(1)).replace(".", ","); }

  /* ---------- amostra e mensagem ---------- */
  var RAMO_PAGINA = ["cafe", "restaurante", "beleza", "saude", "loja"];
  var RAMO_PAINEL = ["saude", "beleza", "encomenda", "tecnico"];
  function amostraUrl(p) {
    var mei = p.tipo === "mei";
    var q = new URLSearchParams({ ramo: p.ramo || (mei ? "saude" : "cafe"), nome: p.nome || "" });
    if (!mei) { if (p.bairro) q.set("bairro", p.bairro); if (p.cidade) q.set("cidade", p.cidade); if (p.nota) q.set("nota", nota(p.nota)); if (p.avaliacoes) q.set("avaliacoes", p.avaliacoes); }
    return "https://maratu.com.br/modelos/" + (mei ? "painel-mei" : "amostra-pagina") + "/?" + q.toString();
  }
  function quem(p) { return p.circulo === "aracaju" ? "Faço sites pra negócio daqui de Aracaju." : "Faço sites pra negócio de todo o Brasil, tudo por WhatsApp."; }
  function mensagem(p) {
    var n = p.nome || "", passo = Number(p.passo) || 0, onde = p.cidade ? " em " + p.cidade : "";
    var google = nota(p.nota) + " de nota e " + (p.avaliacoes || "") + " avaliações";
    if (p.tipo === "mei") {
      return [
        "Oi! Achei o " + n + " no Google: " + google + ". Uma pergunta: hoje a agenda, quem te deve e quanto já faturou no ano ficam no WhatsApp e no caderno? Eu faço um painel pra isso, pra MEI. Posso montar um com o nome do " + n + " pra você ver como fica?",
        "Montei o painel do " + n + " pra você ver: " + amostraUrl(p) + " Tem a agenda da semana com lembrete pro cliente, as parcelas a cobrar e quanto falta pro limite do MEI. É o mesmo que eu uso na minha empresa.",
        "Os apps de agenda cobram de R$40 a R$100 por mês, pra sempre. O painel sai por R$1.200, pago uma vez, e é seu. Os preços estão em maratu.com.br/servicos",
        "Vou parar por aqui. O painel com o nome do " + n + " fica no link. Se quiser usar de verdade, é só responder."
      ][Math.min(passo, 3)];
    }
    return [
      "Oi! Procurei " + ({ cafe: "café", restaurante: "restaurante", beleza: "salão de beleza", saude: "clínica", loja: "loja" }[p.ramo] || "negócio") + onde + " no Google e achei o " + n + ": " + google + ". Mas não tem site, então quem chega por ali não vê o que vocês oferecem nem como pedir. " + quem(p) + " Posso montar uma prévia da página de vocês, sem custo e sem compromisso?",
      "Montei a prévia do " + n + " pra você ver em vez de imaginar: " + amostraUrl(p) + " O botão de pedido já abre o WhatsApp de vocês com a mensagem escrita. Se servir, a gente conversa. Se não, fica de presente.",
      "Uma página dessas sai por R$900, paga uma vez. O site da MARATU, que eu fiz, aparece em primeiro quando alguém procura o estúdio no Google. Os preços estão em maratu.com.br/servicos",
      "Vou parar por aqui pra não encher. A prévia continua sua. Se um dia quiser colocar no ar, é só responder essa mensagem."
    ][Math.min(passo, 3)];
  }
  var PASSO = ["Primeiro contato", "Amostra", "Preço", "Despedida"];
  function igUrl(p) {
    if (p.instagram) return "https://www.instagram.com/" + encodeURIComponent(p.instagram) + "/";
    return "https://www.google.com/search?q=" + encodeURIComponent(p.nome + " " + (p.cidade || "") + " instagram");
  }

  /* ---------- servidor ---------- */
  function carregar() {
    return fetch(API + "/api/prospec", { headers: { Authorization: "Bearer " } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { lista = (d && d.prospec) || []; buscas = (d && d.buscas) || []; temChave = !d || d.chave !== false; loaded = true; render(); })
      .catch(function () { loaded = true; render(); });
  }
  function acao(id, a) {
    return fetch(API + "/api/prospec/acao", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " }, body: JSON.stringify({ id: id, acao: a }) })
      .then(function (r) { return r.json(); })
      .then(function () { return carregar(); })
      .then(function () { if (a === "respondeu") try { location.reload(); } catch (e) {} });
  }
  function toast(txt) {
    var t = document.createElement("div");
    t.textContent = txt;
    t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;background:" + PRETO + ";color:" + AREIA + ";font-family:inherit;font-weight:700;font-size:13px;padding:10px 16px;border-radius:999px;";
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200);
  }

  /* ---------- busca ---------- */
  function abrirBusca() {
    var m = document.createElement("div");
    m.style.cssText = "position:fixed;inset:0;z-index:9998;background:rgba(13,13,11,.45);display:flex;align-items:flex-end;justify-content:center;";
    var campo = "width:100%;padding:11px 12px;border:1.5px solid " + PRETO + ";border-radius:10px;font-family:inherit;font-size:15px;background:#fff;color:" + PRETO + ";margin:4px 0 12px;";
    var rot = "font-family:inherit;font-size:12px;font-weight:800;color:" + PRETO + ";";
    var opt = function (arr, lbl) { return arr.map(function (v, i) { return '<option value="' + v + '">' + (lbl ? lbl[i] : v) + "</option>"; }).join(""); };
    m.innerHTML = '<div style="width:min(520px,100%);background:' + AREIA + ';border:1.5px solid ' + PRETO + ';border-radius:18px 18px 0 0;padding:20px 18px 26px;max-height:90vh;overflow:auto;">' +
      '<h3 style="font-family:inherit;font-weight:900;font-size:18px;margin:0 0 14px;color:' + PRETO + ';">Buscar negócios</h3>' +
      '<label style="' + rot + '">O que buscar</label><input id="pbQ" style="' + campo + '" value="cafeteria">' +
      '<label style="' + rot + '">Cidade</label><input id="pbC" style="' + campo + '" value="Aracaju">' +
      '<label style="' + rot + '">Círculo</label><select id="pbCi" style="' + campo + '">' + opt(["aracaju", "nordeste", "brasil"], ["Aracaju", "Capitais do Nordeste", "Resto do Brasil"]) + '</select>' +
      '<label style="' + rot + '">Cliente</label><select id="pbT" style="' + campo + '">' + opt(["comercio", "mei"], ["Comércio (Página)", "MEI autônomo (Painel)"]) + '</select>' +
      '<label style="' + rot + '">Amostra</label><select id="pbR" style="' + campo + '"></select>' +
      '<label style="display:flex;gap:8px;align-items:center;' + rot + 'margin-bottom:16px;"><input type="checkbox" id="pbS" checked> Repetir toda segunda</label>' +
      '<div style="display:flex;gap:10px;"><button id="pbOk" style="flex:1;padding:12px;border:1.5px solid ' + PRETO + ';border-radius:10px;background:' + LARANJA + ';color:' + AREIA + ';font-family:inherit;font-weight:900;font-size:14px;box-shadow:2px 2px 0 0 ' + PRETO + ';">Buscar</button>' +
      '<button id="pbX" style="padding:12px 16px;border:1.5px solid ' + PRETO + ';border-radius:10px;background:#fff;font-family:inherit;font-weight:800;font-size:14px;">Fechar</button></div>' +
      '<div id="pbRes" style="font-family:inherit;font-size:13px;margin-top:12px;color:' + PRETO + ';"></div></div>';
    document.body.appendChild(m);
    var $ = function (s) { return m.querySelector(s); };
    var ramos = function () {
      var mei = $("#pbT").value === "mei";
      $("#pbR").innerHTML = mei ? opt(RAMO_PAINEL, ["Saúde e corpo", "Beleza", "Encomenda", "Serviço técnico"]) : opt(RAMO_PAGINA, ["Café", "Restaurante", "Beleza", "Saúde", "Loja"]);
    };
    $("#pbT").addEventListener("change", ramos); ramos();
    $("#pbX").addEventListener("click", function () { m.remove(); });
    m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
    $("#pbOk").addEventListener("click", function () {
      var b = { consulta: $("#pbQ").value.trim(), cidade: $("#pbC").value.trim(), circulo: $("#pbCi").value, tipo: $("#pbT").value, ramo: $("#pbR").value };
      if (!b.consulta || !b.cidade) return;
      $("#pbOk").disabled = true; $("#pbRes").textContent = "Buscando no Google…";
      fetch(API + "/api/prospec/buscar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " }, body: JSON.stringify(b) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          $("#pbOk").disabled = false;
          if (d.erro) { $("#pbRes").textContent = "Erro: " + d.erro; return; }
          $("#pbRes").textContent = d.vistos + " negócios vistos, " + d.novos + " novos na fila.";
          if ($("#pbS").checked) {
            var ja = buscas.some(function (x) { return x.consulta === b.consulta && x.cidade === b.cidade; });
            if (!ja) { buscas.push(b); fetch(API + "/api/prospec/buscas", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " }, body: JSON.stringify({ buscas: buscas }) }); }
          }
          carregar();
        })
        .catch(function () { $("#pbOk").disabled = false; $("#pbRes").textContent = "Não deu pra buscar agora."; });
    });
  }

  /* ---------- tela ---------- */
  function secao() {
    var sec = document.getElementById("prospecSec");
    if (sec) return sec;
    var slot = document.getElementById("mkLeads") || document.getElementById("panel-marketing");
    if (!slot) return null;
    sec = document.createElement("div");
    sec.id = "prospecSec";
    sec.style.cssText = "margin:4px 0 26px;";
    slot.insertBefore(sec, slot.firstChild);
    return sec;
  }
  function bt(txt, attr, cor, fundo) {
    return '<button type="button" ' + attr + ' style="flex:0 0 auto;padding:8px 13px;border:1.5px solid ' + PRETO + ';border-radius:9px;background:' + (fundo || "#fff") + ';color:' + (cor || PRETO) + ';font-family:inherit;font-weight:800;font-size:12.5px;cursor:pointer;">' + txt + "</button>";
  }
  function cartao(p) {
    var passo = Math.min(Number(p.passo) || 0, 3);
    var local = [p.bairro, p.cidade].filter(Boolean).join(", ");
    return '<div style="border:1.5px solid ' + PRETO + ';border-radius:14px;background:#fff;padding:13px 14px;margin-bottom:10px;box-shadow:2px 2px 0 0 rgba(13,13,11,.12);">' +
      '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">' +
        '<b style="font-family:inherit;font-size:15px;color:' + PRETO + ';">' + esc(p.nome) + "</b>" +
        '<span style="font-family:inherit;font-size:12px;color:' + PRETO + ';opacity:.6;">' + esc(local) + (p.nota ? " · " + nota(p.nota) + " (" + esc(p.avaliacoes) + ")" : "") + "</span>" +
        '<span style="margin-left:auto;font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:' + LARANJA + ';padding:3px 9px;border-radius:20px;">' + PASSO[passo] + "</span>" +
      "</div>" +
      '<div data-msg style="font-family:inherit;font-size:13.5px;line-height:1.5;color:' + PRETO + ';background:' + AREIA + ';border-radius:10px;padding:10px 12px;margin:10px 0;">' + esc(mensagem(p)) + "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        bt("Copiar e abrir Instagram", 'data-ig="' + esc(p.id) + '"', AREIA, PRETO) +
        bt("Amostra", 'data-am="' + esc(p.id) + '"') +
        (/^https:\/\//.test(p.maps || "") ? bt("Maps", 'data-mp="' + esc(p.id) + '"') : "") +
      "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
        bt("Enviei", 'data-ac="' + esc(p.id) + '|enviei"', AREIA, LARANJA) +
        bt("Respondeu", 'data-ac="' + esc(p.id) + '|respondeu"', "#fff", "#2E6BB8") +
        bt("Amanhã", 'data-ac="' + esc(p.id) + '|pular"') +
        bt("Parar", 'data-ac="' + esc(p.id) + '|parar"') +
      "</div></div>";
  }
  function render() {
    var sec = secao();
    if (!sec) return;
    var d = hoje();
    var vivos = lista.filter(function (p) { return p.status === "fila" || p.status === "enviando"; });
    var doDia = vivos.filter(function (p) { return p.proximo && p.proximo <= d; });
    var depois = vivos.filter(function (p) { return !p.proximo || p.proximo > d; });
    var semana = new Date(Date.now() - 7 * 864e5).toISOString();
    var env7 = 0, resp = 0;
    lista.forEach(function (p) { try { JSON.parse(p.historico || "[]").forEach(function (h) { if (h.ts >= semana && h.acao === "enviei") env7++; if (h.ts >= semana && h.acao === "respondeu") resp++; }); } catch (e) {} });
    var tile = function (n, l) { return '<div style="flex:1;min-width:0;border:1.5px solid ' + PRETO + ';border-radius:12px;background:#fff;padding:10px 12px;"><b style="display:block;font-family:inherit;font-size:20px;color:' + PRETO + ';">' + n + '</b><span style="font-family:inherit;font-size:11.5px;color:' + PRETO + ';opacity:.6;">' + l + "</span></div>"; };
    sec.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<h2 style="font-family:inherit;font-weight:900;font-size:17px;color:' + PRETO + ';margin:0;">Abordagem</h2>' +
        '<button type="button" id="pbNova" style="padding:9px 14px;border:1.5px solid ' + PRETO + ';border-radius:10px;background:' + LARANJA + ';color:' + AREIA + ';font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;box-shadow:2px 2px 0 0 ' + PRETO + ';">Buscar negócios</button>' +
      "</div>" +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' + tile(doDia.length, "pra hoje") + tile(env7, "enviadas em 7 dias") + tile(resp, "responderam") + tile(depois.length, "aguardando") + "</div>" +
      (!temChave ? '<div style="font-family:inherit;font-size:13px;color:#B23A2E;margin-bottom:10px;">Busca desligada</div>' : "") +
      (!loaded ? '<div style="font-family:inherit;font-size:13px;opacity:.5;">carregando…</div>' :
        doDia.length ? doDia.map(cartao).join("") : '<div style="font-family:inherit;font-size:13px;color:' + PRETO + ';opacity:.55;margin-bottom:6px;">Nada pra hoje.</div>') +
      (depois.length ? '<button type="button" id="pbDepois" style="margin-top:4px;border:none;background:none;font-family:inherit;font-weight:800;font-size:13px;color:' + PRETO + ';text-decoration:underline;cursor:pointer;padding:0;">' + (abertos ? "Esconder" : "Ver") + (depois.length === 1 ? " o que está aguardando" : " os " + depois.length + " que estão aguardando") + "</button>" +
        (abertos ? '<div style="margin-top:10px;">' + depois.map(function (p) { return '<div style="display:flex;justify-content:space-between;gap:10px;font-family:inherit;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(13,13,11,.12);color:' + PRETO + ';"><span><b>' + esc(p.nome) + "</b> · " + esc(p.cidade || "") + "</span><span style=\"opacity:.6;\">" + PASSO[Math.min(Number(p.passo) || 0, 3)] + " em " + esc(fmtBR(p.proximo)) + "</span></div>"; }).join("") + "</div>" : "") : "");
    sec.querySelector("#pbNova").addEventListener("click", abrirBusca);
    var dep = sec.querySelector("#pbDepois"); if (dep) dep.addEventListener("click", function () { abertos = !abertos; render(); });
    var porId = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
    sec.querySelectorAll("[data-ig]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = porId(b.getAttribute("data-ig")); if (!p) return;
        var txt = mensagem(p);
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast("Mensagem copiada"); }).catch(function () {});
        window.open(igUrl(p), "_blank", "noopener");
      });
    });
    sec.querySelectorAll("[data-am]").forEach(function (b) { b.addEventListener("click", function () { var p = porId(b.getAttribute("data-am")); if (p) window.open(amostraUrl(p), "_blank", "noopener"); }); });
    sec.querySelectorAll("[data-mp]").forEach(function (b) { b.addEventListener("click", function () { var p = porId(b.getAttribute("data-mp")); if (p && /^https:\/\//.test(p.maps || "")) window.open(p.maps, "_blank", "noopener"); }); });
    sec.querySelectorAll("[data-ac]").forEach(function (b) {
      b.addEventListener("click", function () {
        var raw = b.getAttribute("data-ac"), cut = raw.lastIndexOf("|"), v = [raw.slice(0, cut), raw.slice(cut + 1)];
        b.disabled = true;
        acao(v[0], v[1]).then(function () { toast({ enviei: "Próximo toque agendado", respondeu: "Virou lead", parar: "Parado", pular: "Fica pra amanhã" }[v[1]] || "Feito"); });
      });
    });
  }

  // espera a aba Marketing montar a subaba Leads; depois carrega
  var tent = 0, t = setInterval(function () {
    tent++;
    if (document.getElementById("mkLeads") || tent > 40) { clearInterval(t); carregar(); }
  }, 300);
})();
