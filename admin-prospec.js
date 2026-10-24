/* MARATU admin — modulo "Abordagem" (prospecção). Fila de negócios sem site achados no
   Google (tabela prospec no Worker, GET /api/prospec). Cada um tem a amostra e a mensagem
   do toque do dia prontas: dia 0, 3, 7 e 14. O envio é manual (um toque abre o Instagram
   com a mensagem copiada); "Enviei" agenda o próximo toque, "Respondeu" vira lead.
   Fica no topo da subaba Leads da aba Marketing. Não toca no admin.js minificado.
   24/10: o primeiro toque leva um site feito pro negócio (maratu.com.br/exemplo/<slug>/).
   Ele escolhe na reserva quem vira site ("Escolher"); o Claude faz e publica com
   tools/publicar-exemplo.mjs, que grava o link em previa e põe o negócio no "pra hoje". */
(function () {
  "use strict";
  if (window.__maratuProspec) return;
  window.__maratuProspec = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var AREIA = "#F0ECE4", PRETO = "#0D0D0B", LARANJA = "#C8501A";
  var lista = [], buscas = [], temChave = true, loaded = false, abertos = false, uso = null, teto = 900, job = null;
  var verReserva = false, filtro = "", limite = 30;

  function pad2(n) { return String(n).padStart(2, "0"); }
  function hoje() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fmtBR(iso) { var p = (iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nota(n) { return n == null ? "" : String(Number(n).toFixed(1)).replace(".", ","); }

  /* ---------- amostra e mensagem ---------- */
  var NICHOS = {
    "Comércio": [["cafeteria", "cafe"], ["padaria", "cafe"], ["açaí", "cafe"], ["sorveteria", "cafe"], ["restaurante", "restaurante"], ["lanchonete", "restaurante"], ["hamburgueria", "restaurante"], ["pizzaria", "restaurante"], ["salão de beleza", "beleza"], ["barbearia", "beleza"], ["clínica de estética", "beleza"], ["pet shop", "loja"], ["loja de roupas", "loja"], ["floricultura", "loja"], ["ótica", "loja"], ["clínica odontológica", "saude"], ["academia", "saude"]],
    "MEI autônomo": [["fisioterapeuta", "saude"], ["nutricionista", "saude"], ["psicólogo", "saude"], ["personal trainer", "saude"], ["manicure", "beleza"], ["designer de sobrancelha", "beleza"], ["maquiadora", "beleza"], ["cabeleireira", "beleza"], ["confeitaria", "encomenda"], ["bolos caseiros", "encomenda"], ["salgados para festa", "encomenda"], ["costureira", "encomenda"], ["eletricista", "tecnico"], ["encanador", "tecnico"], ["instalação de ar condicionado", "tecnico"]]
  };
  var RAMO_PAGINA = ["cafe", "restaurante", "beleza", "saude", "loja"];
  var RAMO_PAINEL = ["saude", "beleza", "encomenda", "tecnico"];
  function amostraUrl(p) {
    var mei = p.tipo === "mei";
    var q = new URLSearchParams({ ramo: p.ramo || (mei ? "saude" : "cafe"), nome: p.nome || "" });
    if (!mei) { if (p.bairro) q.set("bairro", p.bairro); if (p.cidade) q.set("cidade", p.cidade); }
    return "https://maratu.com.br/modelos/" + (mei ? "painel-mei" : "amostra-pagina") + "/?" + q.toString();
  }
  /* Primeiro toque já leva a prévia pronta, com a logo e a cor do negócio. Nada de nota do Google
     nem de dado que mostre que o contato saiu de uma lista: quem recebe vê o trabalho feito. */
  function link(p) { return p.previa || amostraUrl(p); }
  function mensagem(p) {
    var n = p.nome || "", passo = Number(p.passo) || 0, mei = p.tipo === "mei";
    if (mei) {
      return [
        "Oi! Aqui é o Raphael, da MARATU. Montei um painel pro " + n + ": agenda com lembrete pro cliente, cobrança de parcela e quanto falta pro limite do MEI. Dá uma olhada: " + link(p) + " Se gostar, me responde aqui.",
        "Conseguiu ver o painel? Uso o mesmo na minha empresa. Se quiser ver com os seus clientes de verdade, me manda os nomes que eu coloco.",
        "Os apps de agenda cobram de R$40 a R$100 por mês, pra sempre. O painel sai por R$1.200, pago uma vez, e fica seu. Os detalhes estão em maratu.com.br/servicos",
        "Vou parar por aqui pra não encher. O painel continua no link, se um dia quiser: " + link(p)
      ][Math.min(passo, 3)];
    }
    return [
      "Oi! Aqui é o Raphael, da MARATU, um estúdio que faz sites pra pequeno negócio. Fiz uma página pro " + n + " pra mostrar como o site de vocês poderia ficar: " + link(p) + " Se gostarem, me respondam aqui. Se não, sem problema.",
      "Conseguiram ver a página? Aqui estão outros sites que fiz: maratu.com.br/servicos",
      "Pra colocar no ar com o endereço de vocês, sai por R$900, pago uma vez. Dá pra trocar o que quiser: texto, foto, horário. Se fizer sentido, é só responder aqui.",
      "Vou parar por aqui pra não encher. A página continua no link, se um dia quiserem: " + link(p)
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
      .then(function (d) { lista = (d && d.prospec) || []; buscas = (d && d.buscas) || []; temChave = !d || d.chave !== false; uso = d && d.uso; teto = (d && d.teto) || 900; job = d && d.job; loaded = true; render(); })
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
    var grupos = Object.keys(NICHOS).map(function (g) { return '<optgroup label="' + g + '">' + NICHOS[g].map(function (n) { return '<option value="' + (g === "Comércio" ? "comercio" : "mei") + "|" + n[1] + "|" + n[0] + '">' + n[0] + "</option>"; }).join("") + "</optgroup>"; }).join("");
    m.innerHTML = '<div style="width:min(520px,100%);background:' + AREIA + ';border:1.5px solid ' + PRETO + ';border-radius:18px 18px 0 0;padding:20px 18px 26px;max-height:90vh;overflow:auto;">' +
      '<h3 style="font-family:inherit;font-weight:900;font-size:18px;margin:0 0 14px;color:' + PRETO + ';">Buscar negócios</h3>' +
      '<label style="' + rot + '">Nicho</label><select id="pbN" style="' + campo + '">' + grupos + '<option value="outro">Outro</option></select>' +
      '<div id="pbOutro" hidden><label style="' + rot + '">O que buscar</label><input id="pbQ" style="' + campo + '">' +
        '<label style="' + rot + '">Cliente</label><select id="pbT" style="' + campo + '">' + opt(["comercio", "mei"], ["Comércio", "MEI autônomo"]) + '</select>' +
        '<label style="' + rot + '">Amostra</label><select id="pbR" style="' + campo + '"></select></div>' +
      '<label style="' + rot + '">Onde</label><select id="pbO" style="' + campo + '">' + opt(["capitais", "grandes", "cidade"], ["As 27 capitais", "As 40 maiores cidades", "Uma cidade"]) + '</select>' +
      '<div id="pbCid" hidden><label style="' + rot + '">Cidade</label><input id="pbC" style="' + campo + '"></div>' +
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
    $("#pbN").addEventListener("change", function () { $("#pbOutro").hidden = $("#pbN").value !== "outro"; });
    $("#pbO").addEventListener("change", function () { $("#pbCid").hidden = $("#pbO").value !== "cidade"; });
    $("#pbX").addEventListener("click", function () { m.remove(); });
    m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
    $("#pbOk").addEventListener("click", function () {
      var n = $("#pbN").value, b;
      if (n === "outro") b = { consulta: $("#pbQ").value.trim(), tipo: $("#pbT").value, ramo: $("#pbR").value };
      else { var v = n.split("|"); b = { consulta: v[2], tipo: v[0], ramo: v[1] }; }
      b.cidade = $("#pbO").value === "cidade" ? $("#pbC").value.trim() : $("#pbO").value;
      if (!b.consulta || !b.cidade) return;
      $("#pbOk").disabled = true; $("#pbRes").textContent = "Buscando no Google…";
      fetch(API + "/api/prospec/buscar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " }, body: JSON.stringify(b) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          $("#pbOk").disabled = false;
          if (d.erro) { $("#pbRes").textContent = "Erro: " + d.erro; return; }
          $("#pbRes").textContent = d.agendado ? "Buscando em " + d.agendado + " cidades. Os negócios entram aos poucos." : d.vistos + " negócios vistos, " + d.novos + " novos na fila.";
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
  // quantas vezes o negócio abriu o site de exemplo (robô de prévia e o próprio estúdio não contam)
  function vistas(p) {
    var n = Number(p.ex_vistas) || 0;
    if (!p.ex_slug) return "";
    var txt = n ? "Abriu o site " + n + (n === 1 ? " vez" : " vezes") + (p.ex_ultima ? ", a última em " + esc(fmtBR(String(p.ex_ultima).slice(0, 10))) : "") : "Ainda não abriu o site";
    return '<div style="font-family:inherit;font-size:12px;font-weight:800;margin-top:6px;color:' + (n ? "#2E6BB8" : PRETO) + ';opacity:' + (n ? 1 : .5) + ';">' + txt + "</div>";
  }
  function linha(p, botao) {
    var meta = [p.consulta || p.ramo, p.cidade, p.nota ? nota(p.nota) + " (" + (Number(p.avaliacoes) || 0) + ")" : "", p.seguidores ? Number(p.seguidores).toLocaleString("pt-BR") + " seguidores" : ""].filter(Boolean).join(" · ");
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(13,13,11,.12);">' +
      '<div style="flex:1;min-width:0;font-family:inherit;color:' + PRETO + ';"><b style="font-size:14px;">' + esc(p.nome) + '</b><div style="font-size:12px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(meta) + "</div></div>" +
      '<a href="' + esc(igUrl(p)) + '" target="_blank" rel="noopener" style="font-family:inherit;font-size:12px;font-weight:800;color:' + PRETO + ';">Insta</a>' +
      (/^https:\/\//.test(p.maps || "") ? '<a href="' + esc(p.maps) + '" target="_blank" rel="noopener" style="font-family:inherit;font-size:12px;font-weight:800;color:' + PRETO + ';">Maps</a>' : "") +
      botao + "</div>";
  }
  function cartao(p) {
    var passo = Math.min(Number(p.passo) || 0, 3);
    var local = [p.bairro, p.cidade].filter(Boolean).join(", ");
    return '<div style="border:1.5px solid ' + PRETO + ';border-radius:14px;background:#fff;padding:13px 14px;margin-bottom:10px;box-shadow:2px 2px 0 0 rgba(13,13,11,.12);">' +
      '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">' +
        '<b style="font-family:inherit;font-size:15px;color:' + PRETO + ';">' + esc(p.nome) + "</b>" +
        '<span style="font-family:inherit;font-size:12px;color:' + PRETO + ';opacity:.6;">' + esc(local) + (p.nota ? " · " + nota(p.nota) + " (" + esc(p.avaliacoes) + ")" : "") + "</span>" +
        '<span style="margin-left:auto;font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:' + LARANJA + ';padding:3px 9px;border-radius:20px;">' + PASSO[passo] + "</span>" +
      "</div>" + vistas(p) +
      '<div data-msg style="font-family:inherit;font-size:13.5px;line-height:1.5;color:' + PRETO + ';background:' + AREIA + ';border-radius:10px;padding:10px 12px;margin:10px 0;">' + esc(mensagem(p)) + "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        bt("Copiar e abrir Instagram", 'data-ig="' + esc(p.id) + '"', AREIA, PRETO) +
        bt(p.previa ? "Ver o site" : "Amostra", 'data-am="' + esc(p.id) + '"') +
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
    var todos = lista.filter(function (p) { return p.status === "fila" || p.status === "enviando"; });
    var escolhidos = lista.filter(function (p) { return p.status === "selecionado"; });
    var vivos = todos.filter(function (p) { return !!p.previa; });
    var reserva = todos.length - vivos.length;
    var doDia = vivos.filter(function (p) { return p.proximo && p.proximo <= d; });
    var depois = vivos.filter(function (p) { return !p.proximo || p.proximo > d; });
    var semana = new Date(Date.now() - 7 * 864e5).toISOString();
    var env7 = 0, resp = 0;
    lista.forEach(function (p) { try { JSON.parse(p.historico || "[]").forEach(function (h) { if (h.ts >= semana && h.acao === "enviei") env7++; if (h.ts >= semana && h.acao === "respondeu") resp++; }); } catch (e) {} });
    var tile = function (n, l) { return '<div style="flex:1;min-width:0;border:1.5px solid ' + PRETO + ';border-radius:12px;background:#fff;padding:10px 12px;"><b style="display:block;font-family:inherit;font-size:20px;color:' + PRETO + ';">' + n + '</b><span style="font-family:inherit;font-size:11.5px;color:' + PRETO + ';opacity:.6;">' + l + "</span></div>"; };
    sec.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<h2 style="font-family:inherit;font-weight:900;font-size:17px;color:' + PRETO + ';margin:0;">Abordagem' + (uso ? ' <span style="opacity:.5;font-weight:700;font-size:12px;">Google ' + (Number(uso.n) || 0) + "/" + (Number(teto) || 0) + " no mês</span>" : "") + '</h2>' +
        '<button type="button" id="pbNova" style="padding:9px 14px;border:1.5px solid ' + PRETO + ';border-radius:10px;background:' + LARANJA + ';color:' + AREIA + ';font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;box-shadow:2px 2px 0 0 ' + PRETO + ';">Buscar negócios</button>' +
      "</div>" +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' + tile(doDia.length, "pra hoje") + tile(env7, "enviadas em 7 dias") + tile(resp, "responderam") + tile(escolhidos.length, "escolhidos") + tile(reserva, "na reserva") + "</div>" +
      (job ? '<div style="font-family:inherit;font-size:13px;font-weight:700;color:' + PRETO + ';margin-bottom:10px;">Buscando: ' + (Number(job.feito) || 0) + " de " + (Number(job.total) || 0) + " cidades, " + (Number(job.novos) || 0) + " novos</div>" : "") +
      (!temChave ? '<div style="font-family:inherit;font-size:13px;color:#B23A2E;margin-bottom:10px;">Busca desligada</div>' : "") +
      (!loaded ? '<div style="font-family:inherit;font-size:13px;opacity:.5;">carregando…</div>' :
        doDia.length ? doDia.map(cartao).join("") : '<div style="font-family:inherit;font-size:13px;color:' + PRETO + ';opacity:.55;margin-bottom:6px;">Nenhuma prévia pronta pra hoje.</div>') +
      (depois.length ? '<button type="button" id="pbDepois" style="margin-top:4px;border:none;background:none;font-family:inherit;font-weight:800;font-size:13px;color:' + PRETO + ';text-decoration:underline;cursor:pointer;padding:0;">' + (abertos ? "Esconder" : "Ver") + (depois.length === 1 ? " o que está aguardando" : " os " + depois.length + " que estão aguardando") + "</button>" +
        (abertos ? '<div style="margin-top:10px;">' + depois.map(function (p) { return '<div style="display:flex;justify-content:space-between;gap:10px;font-family:inherit;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(13,13,11,.12);color:' + PRETO + ';"><span><b>' + esc(p.nome) + "</b> · " + esc(p.cidade || "") + (Number(p.ex_vistas) ? ' · <b style="color:#2E6BB8;">abriu ' + Number(p.ex_vistas) + "x</b>" : "") + "</span><span style=\"opacity:.6;\">" + PASSO[Math.min(Number(p.passo) || 0, 3)] + " em " + esc(fmtBR(p.proximo)) + "</span></div>"; }).join("") + "</div>" : "") : "") +
      (escolhidos.length ? '<div style="margin-top:18px;border:1.5px solid ' + PRETO + ';border-radius:14px;background:#fff;padding:12px 14px;">' +
        '<b style="font-family:inherit;font-size:14px;color:' + PRETO + ';">Escolhidos para virar site (' + escolhidos.length + ")</b>" +
        '<div style="font-family:inherit;font-size:12px;color:' + PRETO + ';opacity:.6;margin:2px 0 4px;">No Claude: “faça os sites dos escolhidos”.</div>' +
        escolhidos.map(function (p) { return linha(p, bt("Devolver", 'data-ac="' + esc(p.id) + '|devolver"')); }).join("") + "</div>" : "") +
      (loaded && reserva ? '<button type="button" id="pbRes" style="margin-top:14px;border:none;background:none;font-family:inherit;font-weight:800;font-size:13px;color:' + PRETO + ';text-decoration:underline;cursor:pointer;padding:0;">' + (verReserva ? "Fechar a reserva" : "Escolher na reserva") + "</button>" +
        (verReserva ? '<div style="margin-top:10px;border:1.5px solid ' + PRETO + ';border-radius:14px;background:#fff;padding:12px 14px;"><input id="pbFiltro" placeholder="Filtrar por nome, ramo ou cidade" value="' + esc(filtro) + '" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid ' + PRETO + ';border-radius:10px;font-family:inherit;font-size:14px;background:#fff;color:' + PRETO + ';"><div id="pbResLista"></div></div>' : "") : "");
    sec.querySelector("#pbNova").addEventListener("click", abrirBusca);
    var dep = sec.querySelector("#pbDepois"); if (dep) dep.addEventListener("click", function () { abertos = !abertos; render(); });
    var porId = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
    var rb = sec.querySelector("#pbRes"); if (rb) rb.addEventListener("click", function () { verReserva = !verReserva; limite = 30; render(); });
    // candidatos: quem ainda não tem site feito, os de mais seguidores e avaliações primeiro
    var candidatos = todos.filter(function (p) { return !p.previa && p.status === "fila" && !(Number(p.passo) > 0); }).sort(function (a, b) { return (Number(b.seguidores) || 0) - (Number(a.seguidores) || 0) || (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0); });
    var pinta = function () {
      var box = sec.querySelector("#pbResLista"); if (!box) return;
      var f = filtro.toLowerCase().trim();
      var vis = f ? candidatos.filter(function (p) { return [p.nome, p.ramo, p.consulta, p.cidade, p.bairro].join(" ").toLowerCase().indexOf(f) >= 0; }) : candidatos;
      box.innerHTML = vis.slice(0, limite).map(function (p) { return linha(p, bt("Escolher", 'data-ac="' + esc(p.id) + '|escolher"', AREIA, PRETO)); }).join("") +
        (vis.length > limite ? '<button type="button" id="pbMais" style="margin-top:10px;border:none;background:none;font-family:inherit;font-weight:800;font-size:13px;color:' + PRETO + ';text-decoration:underline;cursor:pointer;padding:0;">Mais 30 de ' + vis.length + "</button>" : "") +
        (!vis.length ? '<div style="font-family:inherit;font-size:13px;opacity:.55;padding:10px 0;">Nada com esse filtro.</div>' : "");
      var mais = box.querySelector("#pbMais"); if (mais) mais.addEventListener("click", function () { limite += 30; pinta(); });
      liga(box);
    };
    var fi = sec.querySelector("#pbFiltro"); if (fi) fi.addEventListener("input", function () { filtro = fi.value; limite = 30; pinta(); });
    sec.querySelectorAll("[data-ig]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = porId(b.getAttribute("data-ig")); if (!p) return;
        var txt = mensagem(p);
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast("Mensagem copiada"); }).catch(function () {});
        window.open(igUrl(p), "_blank", "noopener");
      });
    });
    sec.querySelectorAll("[data-am]").forEach(function (b) { b.addEventListener("click", function () { var p = porId(b.getAttribute("data-am")); if (!p) return; var ok = /^https:\/\//.test(p.previa || ""); window.open(ok ? p.previa + (p.previa.indexOf("?") < 0 ? "?" : "&") + "eu=1" : amostraUrl(p), "_blank", "noopener"); }); });
    sec.querySelectorAll("[data-mp]").forEach(function (b) { b.addEventListener("click", function () { var p = porId(b.getAttribute("data-mp")); if (p && /^https:\/\//.test(p.maps || "")) window.open(p.maps, "_blank", "noopener"); }); });
    function liga(raiz) {
      raiz.querySelectorAll("[data-ac]").forEach(function (b) {
        if (b._ligado) return; b._ligado = true;
        b.addEventListener("click", function () {
          var raw = b.getAttribute("data-ac"), cut = raw.lastIndexOf("|"), v = [raw.slice(0, cut), raw.slice(cut + 1)];
          b.disabled = true;
          acao(v[0], v[1]).then(function () { toast({ enviei: "Próximo toque agendado", respondeu: "Virou lead", parar: "Parado", pular: "Fica pra amanhã", escolher: "Escolhido para virar site", devolver: "Voltou pra reserva" }[v[1]] || "Feito"); });
        });
      });
    }
    liga(sec);
    pinta();
  }

  // espera a aba Marketing montar a subaba Leads; depois carrega
  var tent = 0, t = setInterval(function () {
    tent++;
    if (document.getElementById("mkLeads") || tent > 40) { clearInterval(t); carregar(); }
  }, 300);
})();
