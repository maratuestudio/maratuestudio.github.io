/* MARATU — painel novo (24/10/2026). Escrito do zero, em paralelo ao admin.html.
   Mesmo Worker, mesmo banco, mesmo login (localStorage "maratu.token").
   Hoje é uma fila: cada coisa a fazer vira um cartão; arrastar pra direita resolve,
   pra esquerda adia. Lançar e editar acontecem em folhas que sobem de baixo.
   Toda gravação relê o estado do servidor antes do PUT, porque o Worker apaga a tabela
   inteira e regrava (o admin antigo aberto noutro aparelho não pode ser atropelado). */
(function () {
  "use strict";

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var PIX = "estudio@maratu.com.br";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- utilidades ---------- */
  function pad2(n) { return String(n).padStart(2, "0"); }
  function isoDe(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function hoje() { return isoDe(new Date()); }
  function somaDias(iso, n) { var p = iso.split("-").map(Number); return isoDe(new Date(p[0], p[1] - 1, p[2] + n)); }
  function dataDe(iso) { var p = String(iso).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function diasEntre(a, b) { return Math.round((dataDe(b) - dataDe(a)) / 864e5); }
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var SEM3 = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dataLonga(iso) { var d = dataDe(iso); return cap(SEM[d.getDay()]) + ", " + d.getDate() + " de " + MESES[d.getMonth()]; }
  function dm(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? m[3] + "/" + m[2] : ""; }
  function diaLocal(ts) { var d = new Date(ts); return isNaN(d) ? String(ts || "").slice(0, 10) : isoDe(d); }
  function quandoRel(iso) {
    var n = diasEntre(hoje(), iso);
    if (n === 0) return "hoje"; if (n === 1) return "amanhã"; if (n === -1) return "ontem";
    if (n < 0) return "desde " + dm(iso);
    return dm(iso);
  }
  function brl(v) { return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function oculto() { try { return localStorage.getItem("maratu.fatHidden") === "1"; } catch (e) { return false; } }
  function brlV(v) { return oculto() ? "R$ •••" : brl(v); }
  function brlCurtoV(v) { return oculto() ? "R$ •••" : brlCurto(v); }
  function brlCurto(v) { var n = Number(v || 0); return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function num(v) { var t = String(v == null ? "" : v).replace(/[^\d,.-]/g, ""); if (t.indexOf(",") > -1) t = t.replace(/\./g, "").replace(",", "."); var n = parseFloat(t); return isFinite(n) ? n : 0; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid(pre) { return (pre || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function lerLS(k, padrao) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } }
  function gravarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function kv(notas) { var o = {}; String(notas || "").split(";").forEach(function (p) { var i = p.indexOf(":"); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return o; }
  function soDigitos(s) { return String(s || "").replace(/\D/g, ""); }
  function waLink(tel, texto) { var d = soDigitos(tel); if (d.length >= 10 && d.length <= 11) d = "55" + d; return "https://wa.me/" + (d.length >= 12 ? d : "") + (texto ? "?text=" + encodeURIComponent(texto) : ""); }
  function abrir(url) { window.open(url, "_blank", "noopener"); }
  function copiar(txt) { try { if (navigator.clipboard) return navigator.clipboard.writeText(txt); } catch (e) {} return Promise.reject(); }

  var IC = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg>',
    adiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    seta: '<svg class="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    esq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    dir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>',
    olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    olhoFechado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    entrada: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg>',
    evento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    lead: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    carne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    nota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
    site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18"/></svg>',
    fora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>'
  };

  /* ---------- servidor ---------- */
  function token() { try { return localStorage.getItem("maratu.token") || ""; } catch (e) { return ""; } }
  function paraLogin() { try { localStorage.setItem("maratu.volta", "/painel.html"); localStorage.removeItem("maratu.painel.cache"); } catch (e) {} location.replace("/login.html"); }
  function api(rota, op) {
    op = op || {};
    var h = Object.assign({ Authorization: "Bearer " + token() }, op.body ? { "Content-Type": "application/json" } : {});
    return fetch(API + rota, { method: op.method || "GET", headers: h, credentials: "include", body: op.body ? JSON.stringify(op.body) : undefined })
      .then(function (r) {
        if (r.status === 401) { paraLogin(); throw new Error("sessão"); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
  }

  var S = { eventos: [], lancamentos: [], notas: [], params: {}, prospec: [], leads: [], pedidos: [], pedidosTodos: null, uso: null, teto: 900, buscas: [], pronto: false, carregadoEm: 0 };

  function carregar() {
    return Promise.all([
      api("/api/state"),
      api("/api/prospec").catch(function () { return null; }),
      api("/api/leads").catch(function () { return null; }),
      api("/api/pedidos?status=aberto").catch(function () { return null; }),
      api("/api/mei/dashboard").catch(function () { return null; }),
      api("/api/impressora").catch(function () { return null; }),
      api("/api/selos/resumo").catch(function () { return null; })
    ]).then(function (r) {
      S.extras = { mei: r[4] && r[4].das_meses ? r[4] : null, imp: r[5] && r[5].conectada != null ? r[5] : null, selos: r[6] && r[6].por_status ? r[6] : null };
      var st = r[0] || {};
      S.eventos = st.eventos || []; S.lancamentos = st.lancamentos || []; S.notas = st.notas || []; S.params = st.params || {};
      if (r[1]) { S.prospec = r[1].prospec || []; S.uso = r[1].uso; S.teto = r[1].teto || 900; S.buscas = r[1].buscas || []; }
      if (r[2]) S.leads = r[2].leads || [];
      if (r[3]) S.pedidos = r[3].pedidos || [];
      S.pronto = true; S.carregadoEm = Date.now();
      guardaCache();
    });
  }
  /* cópia do último estado no aparelho: o painel abre na hora e atualiza por baixo */
  var CACHE = "maratu.painel.cache";
  function guardaCache() {
    try { localStorage.setItem(CACHE, JSON.stringify({ v: 1, em: Date.now(), eventos: S.eventos, lancamentos: S.lancamentos, notas: S.notas, params: S.params, prospec: S.prospec, leads: S.leads, pedidos: S.pedidos, uso: S.uso, teto: S.teto, buscas: S.buscas, extras: S.extras ? { mei: S.extras.mei, selos: S.extras.selos } : null })); } catch (e) {}
  }
  function lerCache() {
    var c = lerLS(CACHE, null);
    if (!c || c.v !== 1 || Date.now() - (c.em || 0) > 7 * 864e5) return false;
    ["eventos", "lancamentos", "notas", "params", "prospec", "leads", "pedidos", "uso", "teto", "buscas", "extras"].forEach(function (k) { if (c[k] != null) S[k] = c[k]; });
    S.pronto = true;
    return true;
  }

  /* fila de gravação: uma por vez, sempre em cima do que está no servidor agora */
  var gravando = Promise.resolve();
  function gravarTabela(nome, transforma) {
    gravando = gravando.then(function () {
      var ler = nome === "leads" ? api("/api/leads").then(function (d) { return d.leads || []; })
        : api("/api/state").then(function (d) { return d[nome] || []; });
      return ler.then(function (atual) {
        var novo = transforma(atual.slice());
        return api("/api/" + nome, { method: "PUT", body: novo }).then(function () { S[nome] = novo; guardaCache(); });
      });
    }).catch(function (e) { aviso("Não salvou. Confira a internet."); console.error(e); return carregar().then(render); });
    return gravando;
  }
  function trocaItem(arr, id, mudar) { return arr.map(function (x) { return String(x.id) === String(id) ? Object.assign({}, x, mudar) : x; }); }

  /* ---------- aviso com desfazer ---------- */
  var pendente = null, avisoTimer = null;
  function aviso(txt, desfazer) {
    var a = $("aviso");
    $("avisoTxt").textContent = txt;
    $("avisoBt").hidden = !desfazer;
    a.classList.toggle("com-bt", !!desfazer);
    a.classList.add("on");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { a.classList.remove("on"); }, desfazer ? 4200 : 2400);
  }
  $("avisoBt").addEventListener("click", function () {
    if (!pendente) return;
    var p = pendente; pendente = null;
    clearTimeout(p.t); p.volta(); if (p.c) contaFeito(-1, p.c); $("aviso").classList.remove("on"); render();
  });
  /* o que foi resolvido hoje neste aparelho, pra barra de progresso e o fechamento do dia */
  var FEITOS = "maratu.painel.feitos", contaPendente = null;
  function feitosHoje() { var f = lerLS(FEITOS, null); return f && f.data === hoje() ? f : { data: hoje(), n: 0 }; }
  function contaFeito(delta) { var f = feitosHoje(); f.n = Math.max(0, f.n + delta); gravarLS(FEITOS, f); }
  /* aplica na tela já, grava depois de 4s (ou quando a página sair de cena) */
  function executar(txt, aplica, volta, grava) {
    descarregar();
    aplica();
    var c = contaPendente; contaPendente = null; if (c) contaFeito(1, c);
    var p = { volta: volta, grava: grava, c: c };
    p.t = setTimeout(function () { if (pendente === p) { pendente = null; grava(); } }, 4200);
    pendente = p;
    aviso(txt, true);
    render(true);
  }
  function descarregar() { if (pendente) { var p = pendente; pendente = null; clearTimeout(p.t); p.grava(); } }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") descarregar();
    else if (S.pronto && Date.now() - S.carregadoEm > 60000 && !folhaAberta) carregar().then(function () { render(true); }).catch(function () {});
  });
  window.addEventListener("pagehide", descarregar);

  /* adiar no aparelho: o cartão some até amanhã */
  var ADIAR = "maratu.painel.adiar";
  function adiado(k) { var m = lerLS(ADIAR, {}); return m[k] && m[k] > hoje(); }
  function adiar(k, ate) { var m = lerLS(ADIAR, {}), h = hoje(); Object.keys(m).forEach(function (x) { if (m[x] <= h) delete m[x]; }); m[k] = ate || somaDias(h, 1); gravarLS(ADIAR, m); }
  function desadiar(k) { var m = lerLS(ADIAR, {}); delete m[k]; gravarLS(ADIAR, m); }

  /* ---------- regras de negócio ---------- */
  var PASSO = ["Primeiro contato", "Amostra", "Preço", "Despedida"];
  function amostraUrl(p) {
    var mei = p.tipo === "mei";
    var q = new URLSearchParams({ ramo: p.ramo || (mei ? "saude" : "cafe"), nome: p.nome || "" });
    if (!mei) { if (p.bairro) q.set("bairro", p.bairro); if (p.cidade) q.set("cidade", p.cidade); }
    return "https://maratu.com.br/modelos/" + (mei ? "painel-mei" : "amostra-pagina") + "/?" + q.toString();
  }
  function linkSite(p) { return p.previa || amostraUrl(p); }
  function mensagem(p) {
    var n = p.nome || "", passo = Math.min(Number(p.passo) || 0, 3);
    if (p.tipo === "mei") return [
      "Oi! Aqui é o Raphael, da MARATU. Montei um painel pro " + n + ": agenda com lembrete pro cliente, cobrança de parcela e quanto falta pro limite do MEI. Dá uma olhada: " + linkSite(p) + " Se gostar, me responde aqui.",
      "Conseguiu ver o painel? Uso o mesmo na minha empresa. Se quiser ver com os seus clientes de verdade, me manda os nomes que eu coloco.",
      "Os apps de agenda cobram de R$40 a R$100 por mês, pra sempre. O painel sai por R$1.200, pago uma vez, e fica seu. Os detalhes estão em maratu.com.br/servicos",
      "Vou parar por aqui pra não encher. O painel continua no link, se um dia quiser: " + linkSite(p)
    ][passo];
    return [
      "Oi! Aqui é o Raphael, da MARATU, um estúdio que faz sites pra pequeno negócio. Fiz uma página pro " + n + " pra mostrar como o site de vocês poderia ficar: " + linkSite(p) + " Se gostarem, me respondam aqui. Se não, sem problema.",
      "Conseguiram ver a página? Aqui estão outros sites que fiz: maratu.com.br/servicos",
      "Pra colocar no ar com o endereço de vocês, sai por R$900, pago uma vez. Dá pra trocar o que quiser: texto, foto, horário. Se fizer sentido, é só responder aqui.",
      "Vou parar por aqui pra não encher. A página continua no link, se um dia quiserem: " + linkSite(p)
    ][passo];
  }
  function igUrl(p) {
    if (p.instagram) return "https://www.instagram.com/" + encodeURIComponent(p.instagram) + "/";
    return "https://www.google.com/search?q=" + encodeURIComponent(p.nome + " " + (p.cidade || "") + " instagram");
  }
  function vistasTxt(p) {
    if (!p.ex_slug) return "";
    var n = Number(p.ex_vistas) || 0;
    return n ? "abriu o site " + n + (n === 1 ? " vez" : " vezes") : "ainda não abriu o site";
  }
  function prospecGrupos() {
    var h = hoje();
    var vivos = S.prospec.filter(function (p) { return (p.status === "fila" || p.status === "enviando") && !!p.previa; });
    return {
      doDia: vivos.filter(function (p) { return p.proximo && p.proximo <= h; }),
      depois: vivos.filter(function (p) { return !p.proximo || p.proximo > h; }),
      escolhidos: S.prospec.filter(function (p) { return p.status === "selecionado"; }),
      reserva: S.prospec.filter(function (p) { return p.status === "fila" && !p.previa && !(Number(p.passo) > 0); }),
      noAr: S.prospec.filter(function (p) { return !!p.ex_slug && p.status !== "parou" && p.status !== "encerrado"; })
    };
  }
  function semanaAbordagem() {
    var lim = new Date(Date.now() - 7 * 864e5).toISOString(), env = 0, resp = 0;
    S.prospec.forEach(function (p) { try { JSON.parse(p.historico || "[]").forEach(function (x) { if (x.ts >= lim) { if (x.acao === "enviei") env++; if (x.acao === "respondeu") resp++; } }); } catch (e) {} });
    return { env: env, resp: resp };
  }

  function eventosVivos() { return S.eventos.filter(function (e) { return e.tipo !== "__mark"; }); }
  function msgCobranca(ev) {
    var p = kv(ev.notas), d = diasEntre(hoje(), ev.data);
    var quando = d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : d > 1 ? "vence em " + d + " dias (" + dm(ev.data) + ")" : "venceu em " + dm(ev.data);
    return "Oi " + (ev.cliente || "") + "! Passando pra lembrar da parcela " + (p.parc || "") + (p.prod ? " (" + p.prod + ")" : "") + ": " + brl(num(p.valor)) + ", " + quando + ". Pode pagar no Pix: " + PIX + ". Qualquer coisa me chama!";
  }
  function fonteDe(l) {
    var id = String(l.id || ""), lab = String(l.label || "");
    if (id.indexOf("mp-") === 0) return "mp";
    if (id.indexOf("btg-") === 0) return "pix";
    if (id.indexOf("lanc-") === 0 || /^carn[eê]/i.test(lab)) return "carne";
    return "manual";
  }
  var FONTE = { pix: "Pix", mp: "Cartão", manual: "Manual", carne: "Carnê" };
  function tituloEntrada(l) {
    var f = fonteDe(l), lab = String(l.label || "");
    if (f === "pix") return lab.replace(/^Pix recebido de\s*/i, "").trim() || "Pix";
    if (f === "mp") { var m = lab.match(/Mercado Pago[·\s]+([^·]+?)(?:\s+\d+x|\s+·|$)/); var n = m && m[1].trim(); return n && !/@/.test(n) ? n : "Mercado Pago"; }
    return lab || "Entrada";
  }
  function somaMes(ano, mes, ateDia) {
    var pre = ano + "-" + pad2(mes + 1) + "-";
    return S.lancamentos.reduce(function (a, l) {
      var d = String(l.data || "");
      if (d.indexOf(pre) !== 0) return a;
      if (ateDia && Number(d.slice(8, 10)) > ateDia) return a;
      return a + num(l.valor);
    }, 0);
  }
  function meta() { return num(S.params && S.params.fixo) + num(S.params && S.params.retirada); }
  function resumoMes() {
    var d = new Date(), a = d.getFullYear(), m = d.getMonth(), dia = d.getDate();
    var total = somaMes(a, m), ant = new Date(a, m - 1, 1);
    var ultimoAnt = new Date(a, m, 0).getDate();
    var antParcial = somaMes(ant.getFullYear(), ant.getMonth(), Math.min(dia, ultimoAnt));
    return { total: total, meta: meta(), mes: MESES[m], ant: antParcial, mesAnt: MESES[ant.getMonth()], dia: Math.min(dia, ultimoAnt) };
  }

  /* ---------- itens da fila ---------- */
  function itensHoje() {
    var h = hoje(), out = [];
    prospecGrupos().doDia.forEach(function (p) {
      out.push({
        k: "site:" + p.id, tipo: "site", rot: "Site", ordem: 2, data: p.proximo,
        titulo: "Mandar pro " + p.nome, sub: [PASSO[Math.min(Number(p.passo) || 0, 3)], p.cidade, vistasTxt(p)].filter(Boolean).join(", "),
        quando: p.proximo < h ? quandoRel(p.proximo) : (Number(p.ex_vistas) ? "abriu " + p.ex_vistas + "x" : ""),
        acoes: '<button class="bt preto" data-ig="' + esc(p.id) + '">' + IC.ig + 'Copiar e abrir</button><button class="bt" data-ver="' + esc(p.id) + '">Ver o site</button>',
        dir: { rot: "Enviei", fn: function () { acaoProspec(p, "enviei", "Próximo toque agendado"); } },
        esq: { rot: "Amanhã", fn: function () { acaoProspec(p, "pular", "Fica pra amanhã"); } },
        abre: function () { folhaSite(p); }
      });
    });
    S.leads.forEach(function (l) {
      if (l.status === "fechado" || l.status === "perdido" || !l.followup || l.followup > h) return;
      var tel = soDigitos(l.contato);
      out.push({
        k: "lead:" + l.id, tipo: "lead", rot: "Lead", ordem: 3, data: l.followup,
        titulo: "Responder " + (l.nome || "lead"), sub: [l.interesse, l.origem ? "via " + l.origem : ""].filter(Boolean).join(", "),
        quando: quandoRel(l.followup),
        acoes: tel.length >= 10 ? '<a class="bt preto" href="' + esc(waLink(l.contato)) + '" target="_blank" rel="noopener">' + IC.wa + "WhatsApp</a>" : "",
        dir: { rot: "Falei", fn: function () { leadFalei(l); } },
        esq: { rot: "Amanhã", fn: function () { leadAdia(l); } },
        abre: function () { folhaLead(l); }
      });
    });
    eventosVivos().forEach(function (e) {
      if (e.feito) return;
      var fim = e.data_fim && e.data_fim > e.data ? e.data_fim : e.data;
      if (e.tipo === "cobranca") {
        if (e.data > h) return;
        var p = kv(e.notas);
        out.push({
          k: "ev:" + e.id, tipo: "carne", rot: "Carnê", ordem: 1, data: e.data,
          titulo: "Cobrar " + (e.cliente || "") + " " + (p.parc || ""), sub: [p.prod, brlV(num(p.valor))].filter(Boolean).join(", "),
          quando: quandoRel(e.data),
          acoes: '<a class="bt preto" href="' + esc(waLink(p.tel, msgCobranca(e))) + '" target="_blank" rel="noopener">' + IC.wa + "Cobrar</a>",
          dir: { rot: "Recebi", fn: function () { parcelaPaga(e, true); } },
          esq: { rot: "Amanhã", fn: function () { adiarCartao("ev:" + e.id); } },
          abre: function () { folhaParcela(e); }
        });
        return;
      }
      if (e.data > h || fim < somaDias(h, -7)) return;   // atrasado há mais de uma semana sai da fila e fica na agenda
      if (fim < h || e.data <= h) {
        var emAndamento = e.data < h && fim >= h;
        out.push({
          k: "ev:" + e.id, tipo: "agenda", rot: e.tipo && e.tipo !== "evento" ? e.tipo : "Agenda", ordem: e.hora ? 0 : 4, data: emAndamento ? h : e.data, hora: e.hora || "",
          titulo: e.titulo || "Compromisso", sub: [e.cliente, e.hora ? e.hora + (e.hora_fim ? " às " + e.hora_fim : "") : "", emAndamento ? "até " + dm(fim) : ""].filter(Boolean).join(", "),
          quando: e.data < h && !emAndamento ? quandoRel(e.data) : (e.hora || "hoje"),
          dir: { rot: "Feito", fn: function () { eventoFeito(e, true); } },
          esq: { rot: "Amanhã", fn: function () { adiarCartao("ev:" + e.id); } },
          abre: function () { folhaEvento(e); }
        });
      }
    });
    S.notas.forEach(function (n) {
      if (n.feito || !n.data || n.data > h) return;
      out.push({
        k: "nota:" + n.id, tipo: "nota", rot: "Lembrete", ordem: 5, data: n.data,
        titulo: n.titulo, sub: n.detalhe || "", quando: quandoRel(n.data),
        dir: { rot: "Feito", fn: function () { notaFeita(n, true); } },
        esq: { rot: "Amanhã", fn: function () { adiarCartao("nota:" + n.id); } },
        abre: function () { folhaNota(n); }
      });
    });
    S.pedidos.forEach(function (p) {
      if (p.status !== "aberto") return;
      var itens = (p.itens || []).map(function (i) { return (i.qtd > 1 ? i.qtd + "x " : "") + i.nome; }).join(", ");
      out.push({
        k: "ped:" + p.codigo, tipo: "loja", rot: "Pedido", ordem: 2.5, data: diaLocal(p.criado_em) || h,
        titulo: itens || "Pedido " + p.codigo, sub: "Código " + p.codigo + ", " + brlV(Number(p.total || 0) / 100),
        quando: quandoRel(diaLocal(p.criado_em || Date.now())),
        dir: { rot: "Atendido", fn: function () { pedidoStatus(p, "atendido"); } },
        esq: { rot: "Amanhã", fn: function () { adiarCartao("ped:" + p.codigo); } },
        abre: function () { folhaPedido(p); }
      });
    });
    out = out.concat(avisosDoSistema()).filter(function (i) { return !adiado(i.k); });
    out.forEach(function (i) { i.atraso = i.data < h; });
    out.sort(function (a, b) {
      if (a.atraso !== b.atraso) return a.atraso ? -1 : 1;
      if (a.atraso && a.data !== b.data) return a.data < b.data ? -1 : 1;
      if (a.ordem !== b.ordem) return a.ordem - b.ordem;
      return (a.hora || "99") < (b.hora || "99") ? -1 : 1;
    });
    return out;
  }

  /* ---------- ações ---------- */
  function adiarCartao(k, ate) {
    executar(ate ? "Visto" : "Fica pra amanhã", function () { adiar(k, ate); }, function () { desadiar(k); }, function () {});
  }
  function conta(tipo) { if (!contaPendente) contaPendente = tipo; }
  function acaoProspec(p, acao, txt) {
    var antes = { status: p.status, proximo: p.proximo };
    if (acao === "enviei" || acao === "respondeu" || acao === "parar") conta("site");
    executar(txt, function () {
      if (acao === "pular") p.proximo = somaDias(hoje(), 1);
      else if (acao === "enviei") p.proximo = somaDias(hoje(), 3);
      else if (acao === "respondeu" || acao === "parar") { p.status = acao === "parar" ? "parou" : "respondeu"; p.proximo = null; }
      else if (acao === "escolher") p.status = "selecionado";
      else if (acao === "devolver") p.status = "fila";
    }, function () { p.status = antes.status; p.proximo = antes.proximo; }, function () {
      api("/api/prospec/acao", { method: "POST", body: { id: p.id, acao: acao } })
        .then(function () { return Promise.all([api("/api/prospec"), acao === "respondeu" ? api("/api/leads") : null]); })
        .then(function (r) { S.prospec = r[0].prospec || S.prospec; if (r[1]) S.leads = r[1].leads || S.leads; guardaCache(); render(true); })
        .catch(function () { aviso("Não salvou. Confira a internet."); });
    });
  }
  function leadFalei(l) {
    var antes = { status: l.status, followup: l.followup }, depois = { status: l.status === "novo" ? "conversando" : l.status, followup: somaDias(hoje(), 3) };
    conta("lead");
    executar("Volta em 3 dias", function () { Object.assign(l, depois); }, function () { Object.assign(l, antes); },
      function () { gravarTabela("leads", function (a) { return trocaItem(a, l.id, depois); }); });
  }
  function leadAdia(l) {
    var antes = l.followup, novo = somaDias(hoje(), 1);
    executar("Fica pra amanhã", function () { l.followup = novo; }, function () { l.followup = antes; },
      function () { gravarTabela("leads", function (a) { return trocaItem(a, l.id, { followup: novo }); }); });
  }
  function eventoFeito(e, feito) {
    if (feito) conta("agenda");
    executar(feito ? "Feito" : "Reaberto", function () { e.feito = feito; }, function () { e.feito = !feito; },
      function () { gravarTabela("eventos", function (a) { return trocaItem(a, e.id, { feito: feito }); }); });
  }
  function notaFeita(n, feito) {
    if (feito) conta("nota");
    executar(feito ? "Feito" : "Reaberto", function () { n.feito = feito; }, function () { n.feito = !feito; },
      function () { gravarTabela("notas", function (a) { return trocaItem(a, n.id, { feito: feito }); }); });
  }
  function parcelaPaga(e, paga) {
    var p = kv(e.notas), lid = "lanc-" + e.id;
    var lanc = { id: lid, data: hoje(), label: "Carnê " + (e.cliente || "") + " " + (p.parc || ""), valor: num(p.valor) };
    if (paga) conta("carne");
    executar(paga ? "Recebido " + brl(lanc.valor) : "Parcela reaberta", function () {
      e.feito = paga;
      S.lancamentos = paga ? S.lancamentos.filter(function (x) { return x.id !== lid; }).concat([lanc]) : S.lancamentos.filter(function (x) { return x.id !== lid; });
    }, function () {
      e.feito = !paga;
      S.lancamentos = !paga ? S.lancamentos.concat([lanc]) : S.lancamentos.filter(function (x) { return x.id !== lid; });
    }, function () {
      gravarTabela("lancamentos", function (a) { a = a.filter(function (x) { return x.id !== lid; }); return paga ? a.concat([lanc]) : a; });
      gravarTabela("eventos", function (a) { return trocaItem(a, e.id, { feito: paga }); });
    });
  }
  function pedidoStatus(p, status) {
    var antes = p.status;
    if (status === "atendido") conta("loja");
    executar(status === "atendido" ? "Pedido atendido" : status === "cancelado" ? "Pedido cancelado" : "Pedido reaberto",
      function () { p.status = status; }, function () { p.status = antes; },
      function () { api("/api/pedidos/status", { method: "POST", body: { codigo: p.codigo, status: status } }).then(guardaCache).catch(function () { aviso("Não salvou. Confira a internet."); }); });
  }

  /* ---------- telas ---------- */
  var pcMQ = window.matchMedia("(min-width: 1024px)");
  function pc() { return pcMQ.matches; }
  (pcMQ.addEventListener ? pcMQ.addEventListener.bind(pcMQ, "change") : pcMQ.addListener.bind(pcMQ))(function () { fecharFolha(); render(true); });
  var vista = lerLS("maratu.painel.vista", "hoje"), filtro = "tudo", lojaSeg = "caixa", lojaMesDesloc = 0, diaSel = hoje(), verAtendidos = false;
  var ORDEM_VISTAS = ["hoje", "sites", "loja", "agenda", "estudio"];
  if (ORDEM_VISTAS.indexOf(vista) < 0) vista = "hoje";

  function render(semAnim, direcao) {
    if (!S.pronto) return;
    var wk = document.querySelector(".wk-corpo"), wkTop = wk ? wk.scrollTop : null;
    var html = vista === "sites" ? telaSites() : vista === "loja" ? telaLoja() : vista === "agenda" ? telaAgenda() : vista === "estudio" ? telaEstudio() : telaHoje();
    var main = $("tela");
    main.innerHTML = '<div class="vista' + (semAnim ? "" : direcao === "esq" ? " entra-esq" : " entra-dir") + '">' + html + "</div>";
    ligar(main);
    if (vista === "estudio") ligarEstudio(main);
    var wk2 = main.querySelector(".wk-corpo");
    if (wk2) wk2.scrollTop = wkTop != null ? wkTop : Math.max(0, (new Date().getHours() - HORA_INI - 1) * SLOT);
    dicaArrastar(main);
    var n = itensHoje().length;
    document.querySelectorAll('[data-v="hoje"]').forEach(function (b) { b.setAttribute("data-n", String(n)); });
    var cont = document.querySelector('.lateral [data-v="hoje"] .cont'); if (cont) cont.textContent = n;
    document.querySelectorAll(".barra [data-v], .lateral [data-v]").forEach(function (b) { if (b.dataset.v === vista) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $("btMais").setAttribute("aria-pressed", String(vista === "estudio"));
  }
  /* mostra que o cartão anda pro lado, sem texto: só até a pessoa arrastar uma vez */
  var dicaNestaSessao = false;
  function dicaArrastar(raiz) {
    if (dicaNestaSessao || pc() || vista !== "hoje" || lerLS("maratu.painel.arrastou", false)) return;
    if (lerLS("maratu.painel.dica", 0) >= 3 || !raiz.querySelector(".slot")) return;
    dicaNestaSessao = true;
    setTimeout(function () {
      var slot = $("tela").querySelector(".slot"); if (!slot || vista !== "hoje" || folhaAberta) return;
      gravarLS("maratu.painel.dica", lerLS("maratu.painel.dica", 0) + 1);
      slot.classList.add("dica"); setTimeout(function () { slot.classList.remove("dica"); }, 1500);
    }, 1200);
  }
  function irPara(v) {
    if (v === vista) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    var dir = ORDEM_VISTAS.indexOf(v) < ORDEM_VISTAS.indexOf(vista) ? "esq" : "dir";
    vista = v; gravarLS("maratu.painel.vista", v);
    window.scrollTo(0, 0); mostrarTopo();
    render(false, dir);
  }

  var itensAtuais = {};
  function cartaHTML(i) {
    itensAtuais[i.k] = i;
    return '<div class="slot" data-k="' + esc(i.k) + '">' +
      '<div class="fundo dir"><span>' + IC.check + esc(i.dir.rot) + "</span></div>" +
      '<div class="fundo esq"><span>' + esc(i.esq.rot) + IC.adiar + "</span></div>" +
      '<article class="cartao carta">' +
        '<div class="l1"><span class="tipo t-' + i.tipo + '">' + esc(i.rot) + '</span><span class="quando' + (i.atraso ? " atraso" : "") + '">' + esc(i.quando || "") + "</span></div>" +
        "<h3>" + esc(i.titulo) + "</h3>" +
        (i.sub ? '<p class="sub">' + esc(i.sub) + "</p>" : "") +
        (i.msg ? '<div class="msg">' + esc(i.msg) + "</div>" : "") +
        '<div class="acoes' + (i.acoes ? "" : " so-pc") + '">' + (i.acoes || "") +
          '<span class="acoes-pc"><button class="ico-bt pc-esq" data-pc="esq" aria-label="' + esc(i.esq.rot) + '" title="' + esc(i.esq.rot) + '">' + IC.adiar + '</button><button class="ico-bt pc-dir" data-pc="dir" aria-label="' + esc(i.dir.rot) + '" title="' + esc(i.dir.rot) + '">' + IC.check + "</button></span></div>" +
      "</article></div>";
  }
  function colunas(a, b) { return pc() ? '<div class="pc-cols"><div class="col">' + a + '</div><aside class="col">' + b + "</aside></div>" : a + b; }

  function cartaoMes(grande) {
    var r = resumoMes(), pct = r.meta ? Math.min(100, r.total / r.meta * 100) : 0;
    if (!grande) return '<button class="cartao mes mini" data-ir="loja">' +
      '<div class="mini-mes"><b style="font-size:15px;">' + cap(r.mes) + '</b><div class="barra-meta"><i style="width:' + pct.toFixed(1) + '%"></i></div><span class="valor" style="font-size:14px;">' + brlCurtoV(r.total) + "</span></div>" +
      '<div class="rodape"><span>' + (r.meta ? "Meta " + brlCurtoV(r.meta) : "Sem meta") + "</span><span>" + (oculto() ? "" : compTxt(r)) + "</span></div></button>";
    var olho = '<button class="ico-bt olho" data-olho aria-label="' + (oculto() ? "Mostrar valores" : "Esconder valores") + '" aria-pressed="' + oculto() + '">' + (oculto() ? IC.olhoFechado : IC.olho) + "</button>";
    return '<div class="cartao mes"><div class="topo-mes"><span class="grande">' + brlCurtoV(r.total) + '</span><span class="comp ' + (!r.ant || oculto() ? "" : r.total >= r.ant ? "sobe" : "desce") + '">' + (oculto() ? "" : compTxt(r)) + "</span>" + olho + "</div>" +
      '<div class="barra-meta"><i style="width:' + pct.toFixed(1) + '%"></i></div><div class="rodape"><span>' + cap(r.mes) + "</span><span>" + (r.meta ? (oculto() ? "Meta " + brlCurtoV(r.meta) : Math.round(pct) + "% de " + brlCurto(r.meta)) : "Sem meta") + "</span></div></div>";
  }

  function telaHoje() {
    var itens = itensHoje(), h = hoje();
    var cont = { site: 0, lead: 0, carne: 0, agenda: 0, loja: 0, nota: 0 };
    itens.forEach(function (i) { cont[i.tipo]++; });
    if (filtro !== "tudo" && !cont[filtro]) filtro = "tudo";
    var vis = filtro === "tudo" ? itens : itens.filter(function (i) { return i.tipo === filtro; });
    var NOMES = [["site", "Sites"], ["lead", "Leads"], ["carne", "Carnê"], ["agenda", "Agenda"], ["loja", "Pedidos"], ["nota", "Lembretes"]];
    var hora = new Date().getHours(), oi = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    var f = feitosHoje(), total = f.n + itens.length;
    var prog = total && f.n ? '<div class="progresso-dia"><div class="barra-meta"><i style="width:' + (f.n / total * 100).toFixed(1) + '%"></i></div><span>' + f.n + " de " + total + (total === 1 ? " feito" : " feitos") + "</span></div>" : "";
    var a = '<div class="cab"><h1>' + (itens.length ? itens.length + " pra hoje" : oi) + "</h1><p>" + dataLonga(h) + "</p></div>" + prog + faixaImpressora() +
      (itens.length > 1 ? '<div class="filtros">' + '<button class="chip-bt" data-filtro="tudo" aria-pressed="' + (filtro === "tudo") + '">Tudo</button>' +
        NOMES.filter(function (n) { return cont[n[0]]; }).map(function (n) { return '<button class="chip-bt" data-filtro="' + n[0] + '" aria-pressed="' + (filtro === n[0]) + '">' + n[1] + ' <span class="n">' + cont[n[0]] + "</span></button>"; }).join("") + "</div>" : "") +
      (vis.length ? '<div class="fila">' + vis.map(cartaHTML).join("") + "</div>" :
        (f.n ? diaFechado(f) : '<div class="cartao"><h3 style="margin:0;font-size:18px;font-weight:900;">Nada pendente</h3></div>'));
    if (!pc()) return a + cartaoMes(false);
    var doDia = itensDoDia(h);
    agendaItens = doDia;
    var g = prospecGrupos();
    var b = '<div class="secao" style="margin-top:6px;">' + cap(MESES[new Date().getMonth()]) + '<button class="bt-link" data-ir="loja">Loja</button></div>' + cartaoMes(true) +
      '<div class="secao">Agenda de hoje<button class="bt-link" data-ir="agenda">Agenda</button></div>' +
      (doDia.length ? '<div class="cartao lista">' + doDia.map(function (x, idx) {
        return '<div class="linha toca" data-item="' + idx + '"' + (x.feito ? ' style="opacity:.55"' : "") + '><span class="hora-pc">' + esc(x.hora || "dia") + '</span><div class="o"><b>' + esc(x.tit) + "</b>" + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + '</div><span class="tipo t-' + x.tipo + '">' + esc(x.rot) + "</span></div>";
      }).join("") + "</div>" : '<p class="vazio">Nada marcado.</p>') +
      (g.noAr.length ? '<div class="secao">Sites no ar<button class="bt-link" data-ir="sites">Sites</button></div><div class="cartao lista">' + g.noAr.slice(0, 5).map(function (p) {
        var n = Number(p.ex_vistas) || 0;
        return '<div class="linha toca" data-site="' + esc(p.id) + '"><div class="o"><b>' + esc(p.nome) + "</b><small>" + (n ? "abriu " + n + "x" : "não abriu ainda") + "</small></div>" + IC.seta + "</div>";
      }).join("") + "</div>" : "");
    return colunas(a, b);
  }
  function diaFechado(f) {
    var h = hoje(), envios = 0;
    S.prospec.forEach(function (p) { try { JSON.parse(p.historico || "[]").forEach(function (x) { if (x.acao === "enviei" && diaLocal(x.ts) === h) envios++; }); } catch (e) {} });
    var entrou = S.lancamentos.filter(function (l) { return l.data === h; }).reduce(function (a, l) { return a + num(l.valor); }, 0);
    return '<div class="cartao fechado"><div class="fechado-cab">' + IC.check + '<h3>Dia fechado</h3></div>' +
      '<div class="nums"><div class="num"><b>' + envios + '</b><span>' + (envios === 1 ? "prévia enviada" : "prévias enviadas") + '</span></div><div class="num"><b>' + brlCurtoV(entrou) + '</b><span>entrou hoje</span></div><div class="num"><b>' + f.n + "</b><span>" + (f.n === 1 ? "resolvido" : "resolvidos") + "</span></div></div></div>";
  }
  function compTxt(r) {
    if (!r.ant) return r.mesAnt + " até dia " + r.dia + ": nada";
    var d = (r.total - r.ant) / r.ant * 100;
    return (d >= 0 ? "+" : "") + Math.round(d) + "% vs. " + r.mesAnt.slice(0, 3) + " até dia " + r.dia;
  }

  function telaSites() {
    var g = prospecGrupos(), s = semanaAbordagem();
    var leadsAtivos = S.leads.filter(function (l) { return l.status !== "fechado" && l.status !== "perdido"; });
    var leadsFim = S.leads.filter(function (l) { return l.status === "fechado" || l.status === "perdido"; });
    var itens = itensHoje().filter(function (i) { return i.tipo === "site"; });
    var STL = { novo: ["Novo", "t-site"], conversando: ["Conversando", "t-lead"], fechado: ["Fechado", "t-feito"], perdido: ["Perdido", "t-loja"] };
    var a = '<div class="cab"><h1>Sites</h1><p>' + (S.uso ? "Google " + (Number(S.uso.n) || 0) + " de " + (Number(S.teto) || 0) + " no mês" : "Abordagem") + "</p></div>" +
      metasSites() +
      '<div class="nums"><div class="num"><b>' + g.doDia.length + '</b><span>pra hoje</span></div><div class="num"><b>' + s.resp + '</b><span>respostas na semana</span></div><div class="num"><b>' + g.noAr.length + "</b><span>no ar</span></div></div>" +
      (itens.length ? '<div class="secao">Pra hoje</div><div class="fila">' + itens.map(cartaHTML).join("") + "</div>" : (pc() ? '<p class="vazio">Nenhum envio pra hoje.</p>' : "")) +
      '<div class="grade-bts" style="margin-top:4px;"><button class="bt" data-reserva>Escolher na reserva</button><button class="bt acento" data-buscar>Buscar negócios</button></div>';
    var b = (g.noAr.length ? '<div class="secao">No ar <small>' + g.noAr.length + '</small></div><div class="cartao lista">' + g.noAr.map(function (p) {
        var n = Number(p.ex_vistas) || 0;
        return '<div class="linha toca" data-site="' + esc(p.id) + '"><div class="o"><b>' + esc(p.nome) + "</b><small>" + (n ? "abriu " + n + "x" : "não abriu ainda") + (p.ex_expira ? ", sai do ar em " + dm(String(p.ex_expira).slice(0, 10)) : "") + "</small></div>" + IC.seta + "</div>";
      }).join("") + "</div>" : "") +
      (g.depois.length ? '<div class="secao">Aguardando <small>' + g.depois.length + '</small></div><div class="cartao lista">' + g.depois.slice().sort(function (x, y) { return (x.proximo || "9") < (y.proximo || "9") ? -1 : 1; }).map(function (p) {
        return '<div class="linha toca" data-site="' + esc(p.id) + '"><div class="o"><b>' + esc(p.nome) + "</b><small>" + PASSO[Math.min(Number(p.passo) || 0, 3)] + (p.proximo ? " em " + dm(p.proximo) : "") + "</small></div>" + IC.seta + "</div>";
      }).join("") + "</div>" : "") +
      (g.escolhidos.length ? '<div class="secao">Escolhidos pra virar site <small>' + g.escolhidos.length + '</small></div><div class="cartao lista">' + g.escolhidos.map(function (p) {
        return '<div class="linha"><div class="o"><b>' + esc(p.nome) + "</b><small>" + esc([p.consulta || p.ramo, p.cidade].filter(Boolean).join(", ")) + '</small></div><button class="bt" data-devolver="' + esc(p.id) + '">Devolver</button></div>';
      }).join("") + "</div>" : "") +
      '<div class="secao">Leads <small>' + leadsAtivos.length + '</small><button class="bt-link" data-novo="lead">Novo lead</button></div>' +
      (S.leads.length ? '<div class="cartao lista">' + leadsAtivos.concat(leadsFim).map(function (l) {
        var st = STL[l.status] || [l.status || "", "t-loja"];
        var atras = l.followup && l.followup < hoje() && l.status !== "fechado" && l.status !== "perdido";
        return '<div class="linha toca" data-lead="' + esc(l.id) + '"' + (l.status === "fechado" || l.status === "perdido" ? ' style="opacity:.6"' : "") + '><div class="o"><b>' + esc(l.nome || "Sem nome") + "</b><small>" + esc([l.interesse, l.followup ? (l.status === "fechado" ? "fechado em " : l.status === "perdido" ? "" : atras ? "atrasado desde " : "falar em ") + (l.status === "perdido" ? "" : dm(l.followup)) : ""].filter(Boolean).join(", ")) + '</small></div><span class="tipo ' + st[1] + '">' + esc(st[0]) + "</span></div>";
      }).join("") + "</div>" : '<p class="vazio">Nenhum lead.</p>');
    return colunas(a, b);
  }

  /* metas do plano de venda: 30 contatos por semana, 4 sites fechados por mês */
  var META_CONTATOS = 30, META_SITES = 4;
  function metasSites() {
    var h = hoje(), seg = somaDias(h, -((dataDe(h).getDay() + 6) % 7)), env = 0, mes = h.slice(0, 7);
    S.prospec.forEach(function (p) { try { JSON.parse(p.historico || "[]").forEach(function (x) { if (x.acao === "enviei" && diaLocal(x.ts) >= seg) env++; }); } catch (e) {} });
    var fechados = S.leads.filter(function (l) { return l.status === "fechado" && /site|p[aá]gina|painel|portf/i.test(l.interesse || "") && String(l.followup || "").slice(0, 7) === mes; }).length;
    var meta = function (n, alvo, txt) { return '<div class="cartao meta"><div class="meta-num"><b>' + n + "</b><span>de " + alvo + " " + txt + '</span></div><div class="barra-meta"><i style="width:' + Math.min(100, n / alvo * 100).toFixed(1) + '%"></i></div></div>'; };
    return '<div class="metas">' + meta(env, META_CONTATOS, "contatos na semana") + meta(fechados, META_SITES, "sites fechados no mês") + "</div>";
  }
  var lojaFonte = "todas";
  var FONTE_COR = { pix: "var(--feito)", mp: "var(--c-lead)", manual: "var(--c-loja)", carne: "var(--c-carne)" };
  function taxaCartao(l) { var m = String(l.label || "").match(/bruto R\$\s*([\d.]+)/); var b = m ? parseFloat(m[1]) : null; return b != null && b - num(l.valor) > 0.005 ? b - num(l.valor) : 0; }
  function lojaCaixa() {
    var d = new Date(); d = new Date(d.getFullYear(), d.getMonth() + lojaMesDesloc, 1);
    var pre = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-";
    var doMes = S.lancamentos.filter(function (l) { return String(l.data || "").indexOf(pre) === 0; }).sort(function (a, b) { return a.data < b.data ? 1 : -1; });
    var totalMes = doMes.reduce(function (a, l) { return a + num(l.valor); }, 0);
    var porFonte = { pix: 0, mp: 0, manual: 0, carne: 0 }, nFonte = { pix: 0, mp: 0, manual: 0, carne: 0 }, taxa = 0;
    doMes.forEach(function (l) { var f = fonteDe(l); porFonte[f] += num(l.valor); nFonte[f]++; if (f === "mp") taxa += taxaCartao(l); });
    if (lojaFonte !== "todas" && !nFonte[lojaFonte]) lojaFonte = "todas";
    var vis = lojaFonte === "todas" ? doMes : doMes.filter(function (l) { return fonteDe(l) === lojaFonte; });
    var porDia = {}; vis.forEach(function (l) { (porDia[l.data] = porDia[l.data] || []).push(l); });
    var ordem = ["pix", "mp", "manual", "carne"].filter(function (f) { return nFonte[f]; });
    var resumo = totalMes > 0 ? '<div class="cartao origem"><div class="origem-barra">' + ordem.map(function (f) { return '<i style="width:' + (porFonte[f] / totalMes * 100).toFixed(2) + "%;background:" + FONTE_COR[f] + '"></i>'; }).join("") + "</div>" +
      '<div class="origem-leg">' + ordem.map(function (f) { return '<span><i style="background:' + FONTE_COR[f] + '"></i>' + FONTE[f] + " <b>" + brlCurtoV(porFonte[f]) + "</b></span>"; }).join("") + "</div>" +
      (taxa > 0 ? '<p class="taxa">Taxa do cartão no mês: <b>' + brlV(taxa) + "</b></p>" : "") + "</div>" : "";
    var filtros = ordem.length > 1 ? '<div class="filtros">' + '<button class="chip-bt" data-fonte="todas" aria-pressed="' + (lojaFonte === "todas") + '">Todas</button>' +
      ordem.map(function (f) { return '<button class="chip-bt" data-fonte="' + f + '" aria-pressed="' + (lojaFonte === f) + '">' + FONTE[f] + ' <span class="n">' + nFonte[f] + "</span></button>"; }).join("") + "</div>" : "";
    return '<div class="nav-dia"><button class="ico-bt" data-mesnav="-1" aria-label="Mês anterior">' + IC.esq + '</button><div class="cab" style="text-align:center;"><h1 style="font-size:20px;">' + cap(MESES[d.getMonth()]) + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "") + "</h1><p>" + brlV(totalMes) + ", " + doMes.length + (doMes.length === 1 ? " entrada" : " entradas") + '</p></div><button class="ico-bt" data-mesnav="1" aria-label="Mês seguinte"' + (lojaMesDesloc >= 0 ? ' disabled style="visibility:hidden"' : "") + ">" + IC.dir + "</button></div>" +
      resumo + filtros +
      (vis.length ? Object.keys(porDia).sort().reverse().map(function (dia) {
        var soma = porDia[dia].reduce(function (a, l) { return a + num(l.valor); }, 0);
        return '<div class="dia-rot"><span>' + (dia === hoje() ? "Hoje" : dia === somaDias(hoje(), -1) ? "Ontem" : SEM3[dataDe(dia).getDay()] + " " + dm(dia)) + '</span><span class="valor">+' + brlCurtoV(soma) + '</span></div><div class="cartao lista">' +
          porDia[dia].map(function (l) { var f = fonteDe(l); return '<div class="linha toca" data-lanc="' + esc(l.id) + '"><span class="tipo ' + (f === "pix" ? "t-feito" : f === "mp" ? "t-lead" : f === "carne" ? "t-carne" : "t-loja") + '">' + FONTE[f] + '</span><div class="o"><b>' + esc(tituloEntrada(l)) + '</b></div><span class="valor">' + brlV(num(l.valor)) + "</span></div>"; }).join("") + "</div>";
      }).join("") : '<p class="vazio">Nenhuma entrada nesse mês.</p>');
  }
  function lojaPedidos() {
    var lista = verAtendidos ? (S.pedidosTodos || []) : S.pedidos.filter(function (p) { return p.status === "aberto"; });
    return (lista.length ? '<div class="cartao lista">' + lista.map(function (p) {
      var itens = (p.itens || []).map(function (i) { return (i.qtd > 1 ? i.qtd + "x " : "") + i.nome; }).join(", ");
      return '<div class="linha toca" data-ped="' + esc(p.codigo) + '"' + (p.status !== "aberto" ? ' style="opacity:.6"' : "") + '><div class="o"><b>' + esc(itens || p.codigo) + "</b><small>" + esc(p.codigo + ", " + quandoRel(diaLocal(p.criado_em)) + (p.status !== "aberto" ? ", " + p.status : "")) + '</small></div><span class="valor">' + brl(Number(p.total || 0) / 100) + "</span></div>";
    }).join("") + "</div>" : '<p class="vazio">' + (verAtendidos ? "Nenhum pedido." : "Nenhum pedido em aberto.") + "</p>") +
      '<button class="bt-link" data-atendidos style="color:var(--tinta-sobre-tela);justify-self:start;">' + (verAtendidos ? "Só os em aberto" : "Ver todos os pedidos") + "</button>";
  }
  function lojaCarne() {
    var carnes = {};
    eventosVivos().forEach(function (e) { if (e.tipo !== "cobranca") return; var p = kv(e.notas); var id = p.carne || e.cliente || e.id; (carnes[id] = carnes[id] || []).push(e); });
    var ids = Object.keys(carnes);
    var aberto = function (id) { return carnes[id].some(function (e) { return !e.feito; }); };
    ids.sort(function (a, b) { var x = aberto(a), y = aberto(b); if (x !== y) return x ? -1 : 1; return proxVenc(carnes[a]) < proxVenc(carnes[b]) ? -1 : 1; });
    var falta = 0; ids.forEach(function (id) { carnes[id].forEach(function (e) { if (!e.feito) falta += num(kv(e.notas).valor); }); });
    return '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + brlCurtoV(falta) + '</b><span>a receber</span></div><div class="num"><b>' + ids.filter(aberto).length + "</b><span>carnês abertos</span></div></div>" +
      (ids.length ? '<div class="cartao lista">' + ids.map(function (id) {
        var evs = carnes[id].slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }), pagas = evs.filter(function (e) { return e.feito; }).length;
        var prox = evs.filter(function (e) { return !e.feito; })[0], p0 = kv(evs[0].notas);
        var atras = prox && prox.data < hoje();
        return '<div class="linha toca" data-carne="' + esc(id) + '"' + (!prox ? ' style="opacity:.6"' : "") + '><div class="o"><b>' + esc(evs[0].cliente || "Cliente") + (p0.prod ? " · " + esc(p0.prod) : "") + "</b><small" + (atras ? ' style="color:var(--c-site);font-weight:900"' : "") + ">" + pagas + " de " + evs.length + " pagas" + (prox ? ", " + (atras ? "atrasada desde " : "próxima ") + dm(prox.data) + " " + brlCurtoV(num(kv(prox.notas).valor)) : ", quitado") + "</small></div>" + IC.seta + "</div>";
      }).join("") + "</div>" : '<p class="vazio">Nenhum carnê.</p>');
  }
  var LINK_ANTIGO = '<a class="cartao linha toca" href="/admin.html" style="text-decoration:none;margin-top:6px;padding:4px 14px;"><div class="o"><b>Produtos, preços e selos</b><small>No painel antigo</small></div>' + IC.fora + "</a>";
  function telaLoja() {
    if (pc()) {
      return colunas('<div class="cab"><h1>Caixa</h1></div>' + lojaCaixa(),
        '<div class="secao" style="margin-top:6px;">' + cap(MESES[new Date().getMonth()]) + "</div>" + cartaoMes(true) +
        '<div class="secao">Pedidos' + (S.pedidos.length ? " <small>" + S.pedidos.length + "</small>" : "") + "</div>" + lojaPedidos() +
        '<div class="secao">Carnê</div>' + lojaCarne() + LINK_ANTIGO);
    }
    return '<div class="cab"><h1>Loja</h1></div>' + cartaoMes(true) +
      '<div class="seg" role="group"><button data-seg="caixa" aria-pressed="' + (lojaSeg === "caixa") + '">Caixa</button><button data-seg="pedidos" aria-pressed="' + (lojaSeg === "pedidos") + '">Pedidos' + (S.pedidos.length ? " " + S.pedidos.length : "") + '</button><button data-seg="carne" aria-pressed="' + (lojaSeg === "carne") + '">Carnê</button></div>' +
      (lojaSeg === "caixa" ? lojaCaixa() : lojaSeg === "pedidos" ? lojaPedidos() : lojaCarne()) + LINK_ANTIGO;
  }
  function proxVenc(evs) { var p = evs.filter(function (e) { return !e.feito; }).map(function (e) { return e.data; }).sort()[0]; return p || "9999"; }

  function itensDoDia(iso) {
    var out = [];
    eventosVivos().forEach(function (e) {
      var fim = e.data_fim && e.data_fim > e.data ? e.data_fim : e.data;
      if (iso < e.data || iso > fim) return;
      var meio = iso !== e.data;
      out.push({ e: e, hora: meio ? "" : (e.diaInteiro ? "" : e.hora || ""), tit: e.titulo, sub: [e.cliente, !meio && e.hora_fim ? "até " + e.hora_fim : "", fim !== e.data ? "até " + dm(fim) : ""].filter(Boolean).join(", "), tipo: e.tipo === "cobranca" ? "carne" : "agenda", rot: e.tipo === "cobranca" ? "Carnê" : e.tipo && e.tipo !== "evento" ? e.tipo : "Evento", feito: !!e.feito });
    });
    S.notas.forEach(function (n) { if (n.data === iso) out.push({ n: n, hora: n.hora || "", tit: n.titulo, sub: n.detalhe || "", tipo: "nota", rot: "Lembrete", feito: !!n.feito }); });
    out.sort(function (a, b) { return (a.hora || "") < (b.hora || "") ? -1 : (a.hora || "") > (b.hora || "") ? 1 : 0; });
    return out;
  }
  /* ---------- marcas de dia: indisponível e cor (mesmo formato do painel antigo) ----------
     ficam na tabela de eventos como tipo "__mark", com "dc:<cor>;off:<0|1>" nas notas */
  var CORES_DIA = [["", "Nenhuma"], ["azul", "Azul"], ["verde", "Verde"], ["amarelo", "Amarelo"], ["laranja", "Laranja"]];
  function lerMarca(ev) { var n = ev.notas || "", c = /dc:([a-z]*)/.exec(n); return { id: ev.id, data: ev.data, cor: c ? c[1] : "", off: /off:1/.test(n) }; }
  function marcas() { var m = {}; S.eventos.forEach(function (e) { if (e.tipo === "__mark" && !m[e.data]) m[e.data] = lerMarca(e); }); return m; }
  function aplicaMarca(arr, iso, patch) {
    var m = arr.filter(function (e) { return e.tipo === "__mark" && e.data === iso; })[0];
    var cur = m ? lerMarca(m) : { cor: "", off: false };
    Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
    var notas = "dc:" + (cur.cor || "") + ";off:" + (cur.off ? 1 : 0);
    if (!m) arr = arr.concat([{ id: uid("mk"), tipo: "__mark", titulo: "", data: iso, hora: null, diaInteiro: true, cliente: null, notas: notas, feito: false, publico: false, data_fim: null, hora_fim: null }]);
    else arr = arr.map(function (e) { return e === m ? Object.assign({}, e, { notas: notas, titulo: "" }) : e; });
    return arr.filter(function (e) { if (e.tipo !== "__mark") return true; var d = lerMarca(e); return d.cor || d.off; });
  }
  function marcarDia(iso, patch) {
    descarregar();
    S.eventos = aplicaMarca(S.eventos, iso, patch);
    render(true);
    gravarTabela("eventos", function (a) { return aplicaMarca(a, iso, patch); });
  }
  function classeMarca(m) { return m ? (m.off ? " dia-off" : "") + (m.cor ? " dia-" + m.cor : "") : ""; }
  function folhaDia(iso) {
    var m = marcas()[iso] || { cor: "", off: false };
    abrirFolha(dataLonga(iso),
      '<label class="marcar interruptor"><input type="checkbox" id="dOff"' + (m.off ? " checked" : "") + "> Dia indisponível</label>" +
      '<div class="rot">Cor do dia</div>' +
      '<div class="cores-dia" data-pil="cor">' + CORES_DIA.map(function (c) { return '<button type="button" data-val="' + c[0] + '" aria-pressed="' + (c[0] === (m.cor || "")) + '" class="cd-' + (c[0] || "nada") + '"><i></i>' + c[1] + "</button>"; }).join("") + "</div>" +
      '<button class="bt cheio" id="dEv">' + IC.mais + "Evento neste dia</button>",
      function (c) {
        c.querySelector("#dOff").addEventListener("change", function () { marcarDia(iso, { off: this.checked }); aviso(this.checked ? "Dia indisponível" : "Dia liberado"); });
        c.querySelectorAll(".cores-dia button").forEach(function (b) {
          b.onclick = function () {
            c.querySelectorAll(".cores-dia button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
            marcarDia(iso, { cor: b.dataset.val });
          };
        });
        c.querySelector("#dEv").onclick = function () { folhaLancar("evento", iso); };
      });
  }

  /* ---------- mover evento (botões rápidos e arrastar na semana) ---------- */
  function minutos(hm) { var p = String(hm || "").split(":"); return p.length === 2 ? +p[0] * 60 + +p[1] : null; }
  function hm(min) { min = Math.max(0, Math.min(23 * 60 + 59, Math.round(min))); return pad2(Math.floor(min / 60)) + ":" + pad2(min % 60); }
  function moverEvento(e, novaData, novaHora) {
    var antes = { data: e.data, hora: e.hora, hora_fim: e.hora_fim, data_fim: e.data_fim, diaInteiro: e.diaInteiro };
    var dif = diasEntre(e.data, novaData), depois = { data: novaData };
    if (novaHora !== undefined) {
      depois.hora = novaHora; depois.diaInteiro = !novaHora;
      var ini = minutos(e.hora), fim = minutos(e.hora_fim), nova = minutos(novaHora);
      if (ini != null && fim != null && nova != null) depois.hora_fim = hm(fim + (nova - ini));
    }
    if (e.data_fim) depois.data_fim = somaDias(e.data_fim, dif);
    executar("Movido pra " + dm(novaData) + (depois.hora ? " às " + depois.hora : ""), function () { Object.assign(e, depois); }, function () { Object.assign(e, antes); },
      function () { gravarTabela("eventos", function (a) { return trocaItem(a, e.id, depois); }); });
  }

  /* ---------- semana com horários (computador) ---------- */
  var HORA_INI = 7, HORA_FIM = 22, SLOT = 52;
  var agendaModo = lerLS("maratu.painel.agmodo", "dia");
  function semanaPC() {
    var h = hoje(), dow = (dataDe(diaSel).getDay() + 6) % 7, seg = somaDias(diaSel, -dow), mk = marcas();
    var agora = new Date(), agoraMin = agora.getHours() * 60 + agora.getMinutes();
    var cab = '<div class="wk-cab"><span></span>', topo = '<div class="wk-todo"><span class="wk-rot">dia</span>', corpo = '<div class="wk-corpo"><div class="wk-horas">';
    for (var hr = HORA_INI; hr < HORA_FIM; hr++) corpo += '<span style="height:' + SLOT + 'px">' + pad2(hr) + ":00</span>";
    corpo += "</div>";
    semanaEvs = {};
    for (var i = 0; i < 7; i++) {
      var d = somaDias(seg, i), dd = dataDe(d), m = mk[d];
      cab += '<button class="wk-dia' + (d === h ? " hoje" : "") + (d === diaSel ? " sel" : "") + classeMarca(m) + '" data-wkdia="' + d + '"><small>' + SEM3[dd.getDay()] + "</small><b>" + dd.getDate() + "</b></button>";
      var itens = itensDoDia(d), todo = itens.filter(function (x) { return !x.hora; }), comHora = itens.filter(function (x) { return x.hora; });
      topo += '<div class="wk-todo-col' + classeMarca(m) + '">' + todo.map(function (x) { var k = "t" + i + "_" + Math.random().toString(36).slice(2, 7); semanaEvs[k] = x; return '<button class="wk-chip t-' + x.tipo + (x.feito ? " feito" : "") + '" data-wk="' + k + '">' + esc(x.tit) + "</button>"; }).join("") + "</div>";
      // faixas pra eventos que se sobrepõem
      var blocos = comHora.map(function (x) {
        var ini = minutos(x.hora), fim = minutos(x.e && x.e.hora_fim);
        if (x.e && x.e.data_fim && x.e.data_fim > x.e.data) fim = HORA_FIM * 60;
        if (fim == null || fim <= ini) fim = ini + 60;
        return { x: x, ini: ini, fim: fim };
      }).sort(function (a, b) { return a.ini - b.ini; });
      var faixas = [];
      blocos.forEach(function (b) { var f = 0; while (faixas[f] != null && faixas[f] > b.ini) f++; faixas[f] = Math.max(b.fim, b.ini + 30); b.f = f; });
      var nf = Math.max(1, faixas.length);
      corpo += '<div class="wk-col' + (d === h ? " hoje" : "") + classeMarca(m) + '" data-wkcol="' + d + '" style="height:' + (HORA_FIM - HORA_INI) * SLOT + 'px">';
      blocos.forEach(function (b) {
        var k = "e" + i + "_" + Math.random().toString(36).slice(2, 7); semanaEvs[k] = b.x;
        var top = (b.ini - HORA_INI * 60) / 60 * SLOT, alt = Math.max(24, (b.fim - b.ini) / 60 * SLOT - 3);
        top = Math.max(0, Math.min(top, (HORA_FIM - HORA_INI) * SLOT - 24));
        corpo += '<div class="wk-ev t-' + b.x.tipo + (b.x.feito ? " feito" : "") + '" data-wk="' + k + '" style="top:' + top + "px;height:" + alt + "px;left:calc(" + (b.f * 100 / nf) + "% + 2px);width:calc(" + (100 / nf) + '% - 4px)"><b>' + esc(b.x.tit) + "</b><small>" + esc(b.x.hora + (b.x.e && b.x.e.hora_fim ? " às " + b.x.e.hora_fim : "")) + "</small></div>";
      });
      if (d === h && agoraMin >= HORA_INI * 60 && agoraMin < HORA_FIM * 60) corpo += '<div class="wk-agora" style="top:' + ((agoraMin - HORA_INI * 60) / 60 * SLOT) + 'px"></div>';
      corpo += "</div>";
    }
    var ini = dataDe(seg), fimS = dataDe(somaDias(seg, 6));
    var titulo = '<div class="nav-dia"><div class="cab"><h1 style="font-size:26px;">' + ini.getDate() + (ini.getMonth() !== fimS.getMonth() ? " de " + MESES[ini.getMonth()] : "") + " a " + fimS.getDate() + " de " + MESES[fimS.getMonth()] + "</h1></div>" +
      (seg !== somaDias(h, -((dataDe(h).getDay() + 6) % 7)) ? '<button class="chip-bt" data-dia="' + h + '">Hoje</button>' : "") +
      '<button class="ico-bt" data-dia="' + somaDias(diaSel, -7) + '" aria-label="Semana anterior">' + IC.esq + '</button><button class="ico-bt" data-dia="' + somaDias(diaSel, 7) + '" aria-label="Semana seguinte">' + IC.dir + "</button>" + modoAgendaBts() + "</div>";
    return titulo + '<div class="cartao semana-pc">' + cab + "</div>" + topo + "</div>" + corpo + "</div></div>";
  }
  var semanaEvs = {};
  function modoAgendaBts() { return pc() ? '<div class="seg seg-mini"><button data-agmodo="dia" aria-pressed="' + (agendaModo !== "semana") + '">Dia</button><button data-agmodo="semana" aria-pressed="' + (agendaModo === "semana") + '">Semana</button></div>' : ""; }
  function abreItem(x) { if (!x) return; if (x.e) { if (x.e.tipo === "cobranca") folhaParcela(x.e); else folhaEvento(x.e); } else if (x.n) folhaNota(x.n); }
  function ligarSemana(raiz) {
    raiz.querySelectorAll("[data-wkdia]").forEach(function (b) { b.onclick = function () { folhaDia(b.dataset.wkdia); }; });
    raiz.querySelectorAll(".wk-chip[data-wk]").forEach(function (b) { b.onclick = function () { abreItem(semanaEvs[b.dataset.wk]); }; });
    raiz.querySelectorAll(".wk-col").forEach(function (col) {
      col.addEventListener("click", function (ev) {
        if (ev.target !== col) return;
        var y = ev.clientY - col.getBoundingClientRect().top, min = HORA_INI * 60 + Math.floor(y / SLOT * 2) * 30;
        folhaLancar("evento", col.dataset.wkcol, hm(min));
      });
    });
    raiz.querySelectorAll(".wk-ev[data-wk]").forEach(function (el) {
      var x = semanaEvs[el.dataset.wk], x0, y0, dy0, arrastando = false, id = null;
      el.addEventListener("pointerdown", function (ev) {
        if (ev.button !== 0) return;
        id = ev.pointerId; x0 = ev.clientX; y0 = ev.clientY; dy0 = ev.clientY - el.getBoundingClientRect().top; arrastando = false;
        try { el.setPointerCapture(id); } catch (e) {}
      });
      el.addEventListener("pointermove", function (ev) {
        if (ev.pointerId !== id) return;
        if (!arrastando && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 5) return;
        if (!x.e || x.e.tipo === "__mark" || x.e.tipo === "cobranca" || (x.e.data !== el.parentNode.dataset.wkcol && !arrastando)) return;
        arrastando = true; el.classList.add("arrastando");
        var cols = raiz.querySelectorAll(".wk-col"), alvo = null;
        cols.forEach(function (c) { var r = c.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) alvo = c; });
        if (!alvo) return;
        if (el.parentNode !== alvo) { alvo.appendChild(el); try { el.setPointerCapture(id); } catch (e) {} }
        var r = alvo.getBoundingClientRect(), min = HORA_INI * 60 + Math.round(((ev.clientY - r.top - dy0) / SLOT * 60) / 15) * 15;
        min = Math.max(HORA_INI * 60, Math.min(HORA_FIM * 60 - 15, min));
        el.style.top = ((min - HORA_INI * 60) / 60 * SLOT) + "px"; el.style.left = "2px"; el.style.width = "calc(100% - 4px)";
        el.dataset.novo = alvo.dataset.wkcol + "|" + hm(min);
        el.querySelector("small").textContent = hm(min);
      });
      el.addEventListener("pointerup", function (ev) {
        if (ev.pointerId !== id) return; id = null;
        if (!arrastando) { abreItem(x); return; }
        el.classList.remove("arrastando");
        var nv = (el.dataset.novo || "").split("|");
        if (nv.length === 2 && (nv[0] !== x.e.data || nv[1] !== x.e.hora)) moverEvento(x.e, nv[0], nv[1]); else render(true);
      });
      el.addEventListener("pointercancel", function () { id = null; render(true); });
    });
  }

  /* ---------- telas da agenda ---------- */
  function gradeMes(ym) {
    var p = ym.split("-").map(Number), ano = p[0], mes = p[1] - 1, mk = marcas();
    var prim = new Date(ano, mes, 1), ini = somaDias(isoDe(prim), -((prim.getDay() + 6) % 7));
    var g = '<div class="mes-grade">' + ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map(function (d) { return '<span class="dsem">' + d + "</span>"; }).join("");
    for (var i = 0; i < 42; i++) {
      var d = somaDias(ini, i), dd = dataDe(d), n = itensDoDia(d).filter(function (x) { return !x.feito; }).length;
      g += '<button data-pdia="' + d + '" class="' + (dd.getMonth() !== mes ? "fora " : "") + (d === hoje() ? "hoje " : "") + (d === diaSel ? "sel" : "") + classeMarca(mk[d]) + '">' + dd.getDate() + "<i>" + (n ? "<em></em>" : "") + (n > 1 ? "<em></em>" : "") + (n > 2 ? "<em></em>" : "") + "</i></button>";
    }
    return g + "</div>";
  }
  function navMes(ym, attr) {
    var p = ym.split("-").map(Number), ant = isoDe(new Date(p[0], p[1] - 2, 1)).slice(0, 7), prox = isoDe(new Date(p[0], p[1], 1)).slice(0, 7);
    return '<div class="nav-dia"><button class="ico-bt" ' + attr + '="' + ant + '" aria-label="Mês anterior">' + IC.esq + '</button><b style="flex:1;text-align:center;font-size:17px;font-weight:900;">' + cap(MESES[p[1] - 1]) + " " + p[0] + '</b><button class="ico-bt" ' + attr + '="' + prox + '" aria-label="Mês seguinte">' + IC.dir + "</button></div>";
  }
  var agendaMes = null;
  function telaAgenda() {
    if (pc() && agendaModo === "semana") return semanaPC();
    var h = hoje(), sel = dataDe(diaSel), dow = (sel.getDay() + 6) % 7, seg = somaDias(diaSel, -dow), mk = marcas(), mDia = mk[diaSel];
    var itens = itensDoDia(diaSel), ehHoje = diaSel === h, agora = new Date(), agoraHM = pad2(agora.getHours()) + ":" + pad2(agora.getMinutes());
    var entrou = S.lancamentos.filter(function (l) { return l.data === diaSel; }), somaEntrou = entrou.reduce(function (a, l) { return a + num(l.valor); }, 0);
    var linhas = "", pos = false;
    itens.forEach(function (x, idx) {
      if (ehHoje && !pos && x.hora && x.hora > agoraHM) { linhas += '<div class="agora"><span>agora ' + agoraHM + "</span></div>"; pos = true; }
      linhas += '<div class="ponto-dia' + (x.feito ? " feito" : "") + '" data-item="' + idx + '"><span class="hora">' + esc(x.hora || "dia") + '</span><div class="cartao toca" style="cursor:pointer;"><span class="tipo t-' + x.tipo + '">' + esc(x.rot) + '</span><div class="o"><b>' + esc(x.tit) + "</b>" + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + "</div></div></div>";
    });
    if (ehHoje && !pos) linhas += '<div class="agora"><span>agora ' + agoraHM + "</span></div>";
    agendaItens = itens;
    var titulo = '<div class="nav-dia"><div class="cab"><h1 style="font-size:26px;">' + (mDia && mDia.cor ? '<i class="ponto-cor dia-' + mDia.cor + '"></i>' : "") + (ehHoje ? "Hoje" : diaSel === somaDias(h, 1) ? "Amanhã" : diaSel === somaDias(h, -1) ? "Ontem" : cap(SEM[sel.getDay()])) + "</h1><p>" + sel.getDate() + " de " + MESES[sel.getMonth()] + (sel.getFullYear() !== new Date().getFullYear() ? " de " + sel.getFullYear() : "") + "</p></div>" +
      (!ehHoje ? '<button class="chip-bt" data-dia="' + h + '">Hoje</button>' : "") +
      '<button class="ico-bt" data-diamenu aria-label="Opções do dia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></svg></button>' +
      (pc() ? '<button class="ico-bt" data-dia="' + somaDias(diaSel, -1) + '" aria-label="Dia anterior">' + IC.esq + '</button><button class="ico-bt" data-dia="' + somaDias(diaSel, 1) + '" aria-label="Dia seguinte">' + IC.dir + "</button>" + modoAgendaBts() : '<button class="chip-bt" data-mesfolha>Mês</button>') + "</div>";
    var dia = (mDia && mDia.off ? '<button class="cartao dia-indisp" data-diamenu>Dia indisponível</button>' : "") +
      (somaEntrou ? '<div class="cartao entrou"><span class="tipo">Entrou</span><span class="valor">' + brlV(somaEntrou) + '</span><span style="color:var(--suave);font-weight:700;">' + entrou.length + (entrou.length === 1 ? " entrada" : " entradas") + "</span></div>" : "") +
      '<div class="linha-dia" id="linhaDia">' + (itens.length || ehHoje ? linhas : "") + (!itens.length ? '<p class="vazio" style="margin:6px 0 0;">Nada marcado.</p>' : "") + "</div>" +
      '<button class="bt cheio" data-novo="evento">' + IC.mais + "Evento em " + dm(diaSel) + "</button>";
    if (pc()) {
      var ym = agendaMes || diaSel.slice(0, 7);
      return colunas(titulo + dia, '<div class="cartao">' + navMes(ym, "data-agm") + gradeMes(ym) + "</div>");
    }
    var semana = "";
    for (var i = 0; i < 7; i++) {
      var d = somaDias(seg, i), tem = itensDoDia(d).some(function (x) { return !x.feito; });
      semana += '<button data-dia="' + d + '" aria-pressed="' + (d === diaSel) + '" class="' + (tem ? "tem " : "") + (d === h ? "hoje" : "") + classeMarca(mk[d]) + '"><small>' + SEM3[dataDe(d).getDay()] + "</small><b>" + dataDe(d).getDate() + "</b><i></i></button>";
    }
    return titulo + '<div class="semana" id="semana">' + semana + "</div>" + dia;
  }
  var agendaItens = [];

  /* ---------- ligações da tela ---------- */
  function porId(arr, id, campo) { campo = campo || "id"; return arr.filter(function (x) { return String(x[campo]) === String(id); })[0]; }
  function ligar(raiz) {
    raiz.querySelectorAll(".slot").forEach(function (s) { arrastavel(s, itensAtuais[s.dataset.k]); });
    raiz.querySelectorAll("[data-filtro]").forEach(function (b) { b.onclick = function () { filtro = b.dataset.filtro; render(true); }; });
    raiz.querySelectorAll("[data-ir]").forEach(function (b) { b.onclick = function () { irPara(b.dataset.ir); }; });
    raiz.querySelectorAll("[data-ig]").forEach(function (b) {
      b.onclick = function (ev) { ev.stopPropagation(); var p = porId(S.prospec, b.dataset.ig); if (!p) return; copiar(mensagem(p)).then(function () { aviso("Mensagem copiada"); }).catch(function () {}); abrir(igUrl(p)); };
    });
    raiz.querySelectorAll("[data-ver]").forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var p = porId(S.prospec, b.dataset.ver); if (p) verSite(p); }; });
    raiz.querySelectorAll("[data-site]").forEach(function (b) { b.onclick = function () { var p = porId(S.prospec, b.dataset.site); if (p) folhaSite(p); }; });
    raiz.querySelectorAll("[data-devolver]").forEach(function (b) { b.onclick = function () { var p = porId(S.prospec, b.dataset.devolver); if (p) acaoProspec(p, "devolver", "Voltou pra reserva"); }; });
    raiz.querySelectorAll("[data-reserva]").forEach(function (b) { b.onclick = folhaReserva; });
    raiz.querySelectorAll("[data-buscar]").forEach(function (b) { b.onclick = folhaBuscarNegocios; });
    raiz.querySelectorAll("[data-lead]").forEach(function (b) { b.onclick = function () { var l = porId(S.leads, b.dataset.lead); if (l) folhaLead(l); }; });
    raiz.querySelectorAll("[data-novo]").forEach(function (b) { b.onclick = function () { folhaLancar(b.dataset.novo, b.dataset.novo === "evento" ? diaSel : null); }; });
    raiz.querySelectorAll("[data-seg]").forEach(function (b) {
      b.onclick = function () {
        lojaSeg = b.dataset.seg; render(true);
        if (lojaSeg === "pedidos" && verAtendidos && !S.pedidosTodos) carregarPedidosTodos();
      };
    });
    raiz.querySelectorAll("[data-mesnav]").forEach(function (b) { b.onclick = function () { if (b.disabled) return; lojaMesDesloc = Math.min(0, lojaMesDesloc + Number(b.dataset.mesnav)); render(true); }; });
    raiz.querySelectorAll("[data-lanc]").forEach(function (b) { b.onclick = function () { var l = porId(S.lancamentos, b.dataset.lanc); if (l) folhaEntrada(l); }; });
    raiz.querySelectorAll("[data-ped]").forEach(function (b) { b.onclick = function () { var p = porId(S.pedidosTodos || [], b.dataset.ped, "codigo") || porId(S.pedidos, b.dataset.ped, "codigo"); if (p) folhaPedido(p); }; });
    raiz.querySelectorAll("[data-atendidos]").forEach(function (b) { b.onclick = function () { verAtendidos = !verAtendidos; render(true); if (verAtendidos && !S.pedidosTodos) carregarPedidosTodos(); }; });
    raiz.querySelectorAll("[data-carne]").forEach(function (b) { b.onclick = function () { folhaCarne(b.dataset.carne); }; });
    raiz.querySelectorAll("[data-dia]").forEach(function (b) { b.onclick = function () { var dir = b.dataset.dia < diaSel ? "esq" : "dir"; diaSel = b.dataset.dia; agendaMes = null; render(false, dir); }; });
    raiz.querySelectorAll("[data-mesfolha]").forEach(function (b) { b.onclick = function () { folhaMes(diaSel.slice(0, 7)); }; });
    raiz.querySelectorAll("[data-pdia]").forEach(function (b) { b.onclick = function () { var dir = b.dataset.pdia < diaSel ? "esq" : "dir"; diaSel = b.dataset.pdia; render(false, dir); }; });
    raiz.querySelectorAll("[data-agm]").forEach(function (b) { b.onclick = function () { agendaMes = b.dataset.agm; render(true); }; });
    raiz.querySelectorAll(".ponto-dia, .linha[data-item]").forEach(function (b) {
      b.onclick = function () { var x = agendaItens[Number(b.dataset.item)]; if (!x) return; if (x.e) { if (x.e.tipo === "cobranca") folhaParcela(x.e); else folhaEvento(x.e); } else if (x.n) folhaNota(x.n); };
    });
    var ld = raiz.querySelector("#linhaDia"); if (ld) arrastaDia(ld);
    raiz.querySelectorAll("[data-diamenu]").forEach(function (b) { b.onclick = function () { folhaDia(diaSel); }; });
    raiz.querySelectorAll("[data-agmodo]").forEach(function (b) { b.onclick = function () { agendaModo = b.dataset.agmodo; gravarLS("maratu.painel.agmodo", agendaModo); render(false); }; });
    raiz.querySelectorAll("[data-olho]").forEach(function (b) { b.onclick = function () { try { localStorage.setItem("maratu.fatHidden", oculto() ? "0" : "1"); } catch (e) {} render(true); }; });
    raiz.querySelectorAll("[data-fonte]").forEach(function (b) { b.onclick = function () { lojaFonte = b.dataset.fonte; render(true); }; });
    if (vista === "agenda" && pc() && agendaModo === "semana") ligarSemana(raiz);
  }
  function carregarPedidosTodos() {
    api("/api/pedidos?limite=60").then(function (d) { S.pedidosTodos = d.pedidos || []; render(true); }).catch(function () { aviso("Não carregou os pedidos."); });
  }
  function verSite(p) { var ok = /^https:\/\//.test(p.previa || ""); abrir(ok ? p.previa + (p.previa.indexOf("?") < 0 ? "?" : "&") + "eu=1" : amostraUrl(p)); }

  /* ---------- arrastar cartão ---------- */
  function arrastavel(slot, item) {
    if (!item) return;
    var carta = slot.querySelector(".carta"), fDir = slot.querySelector(".fundo.dir"), fEsq = slot.querySelector(".fundo.esq");
    var x0 = 0, y0 = 0, t0 = 0, dx = 0, modo = null, id = null, moveu = false, saiu = false;
    carta.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0 || ev.target.closest("button, a")) return;
      x0 = ev.clientX; y0 = ev.clientY; t0 = Date.now(); dx = 0; modo = "?"; id = ev.pointerId; moveu = false;
      carta.classList.remove("solta");
    });
    carta.addEventListener("pointermove", function (ev) {
      if (ev.pointerId !== id || !modo) return;
      var mx = ev.clientX - x0, my = ev.clientY - y0;
      if (modo === "?") {
        if (Math.abs(mx) > 9 && Math.abs(mx) > Math.abs(my) * 1.2) { modo = "x"; moveu = true; try { carta.setPointerCapture(id); } catch (e) {} }
        else if (Math.abs(my) > 9) { modo = null; return; }
        else return;
      }
      dx = mx;
      carta.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 60).toFixed(2) + "deg)";
      var w = slot.offsetWidth, p = Math.min(1, Math.abs(dx) / (w * 0.3));
      fDir.style.opacity = dx > 0 ? p : 0; fEsq.style.opacity = dx < 0 ? p : 0;
      fDir.style.filter = dx > 0 && p >= 1 ? "none" : "saturate(.6)"; fEsq.style.filter = dx < 0 && p >= 1 ? "none" : "saturate(.6)";
    });
    function sai(lado) {
      if (saiu) return; saiu = true;
      if (lado > 0) conta(item.tipo);
      gravarLS("maratu.painel.arrastou", true);
      var w = slot.offsetWidth;
      carta.classList.add("solta");
      carta.style.transform = "translateX(" + (lado * w * 1.25) + "px) rotate(" + (lado * 8) + "deg)";
      fDir.style.opacity = lado > 0 ? 1 : 0; fEsq.style.opacity = lado < 0 ? 1 : 0;
      setTimeout(function () {
        slot.style.height = slot.offsetHeight + "px"; void slot.offsetHeight;
        slot.style.height = "0px"; slot.style.marginTop = "-10px"; slot.classList.add("saindo");
        setTimeout(function () { (lado > 0 ? item.dir : item.esq).fn(); }, 260);
      }, 180);
    }
    slot.querySelectorAll("[data-pc]").forEach(function (b) { b.addEventListener("click", function (ev) { ev.stopPropagation(); sai(b.dataset.pc === "dir" ? 1 : -1); }); });
    carta.addEventListener("click", function (ev) { if (moveu || saiu) { setTimeout(function () { moveu = false; }, 0); return; } if (pc() && !ev.target.closest("button, a")) item.abre(); });
    function solta(ev) {
      if (ev.pointerId !== id) return;
      var m = modo; modo = null; id = null;
      if (m === "?") {
        if (!pc() && Date.now() - t0 < 450) item.abre();
        return;
      }
      if (m !== "x") return;
      var w = slot.offsetWidth, vel = Math.abs(dx) / Math.max(1, Date.now() - t0);
      var vai = Math.abs(dx) > w * 0.3 || (vel > 0.6 && Math.abs(dx) > 50);
      carta.classList.add("solta");
      if (!vai) { carta.style.transform = ""; fDir.style.opacity = 0; fEsq.style.opacity = 0; return; }
      sai(dx > 0 ? 1 : -1);
    }
    carta.addEventListener("pointerup", solta);
    carta.addEventListener("pointercancel", function (ev) { if (ev.pointerId === id) { modo = null; carta.classList.add("solta"); carta.style.transform = ""; fDir.style.opacity = 0; fEsq.style.opacity = 0; } });
  }

  /* arrastar a linha do dia troca o dia */
  function arrastaDia(el) {
    var x0 = 0, y0 = 0, ativo = false, horiz = false;
    el.addEventListener("touchstart", function (e) { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; ativo = true; horiz = false; }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      if (!ativo) return; var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (!horiz && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) horiz = true;
      if (horiz) el.style.transform = "translateX(" + dx * 0.5 + "px)";
    }, { passive: true });
    el.addEventListener("touchend", function (e) {
      if (!ativo) return; ativo = false; el.style.transform = "";
      if (!horiz) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 70) { diaSel = somaDias(diaSel, dx < 0 ? 1 : -1); render(false, dx < 0 ? "dir" : "esq"); }
    });
  }

  /* ---------- topo que some ao rolar ---------- */
  var ultimoY = 0;
  function mostrarTopo() { $("topo").classList.remove("escondido"); }
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    if (y > ultimoY + 6 && y > 70) $("topo").classList.add("escondido");
    else if (y < ultimoY - 6 || y < 40) mostrarTopo();
    ultimoY = y;
  }, { passive: true });

  /* ---------- folha ---------- */
  var folhaAberta = false, aoFechar = null, folhaVolta = null;
  function abrirFolha(titulo, html, montar, fechar) {
    if (!folhaAberta) folhaVolta = document.activeElement;
    $("folhaTit").textContent = titulo;
    var corpo = $("folhaCorpo");
    corpo.innerHTML = html; corpo.scrollTop = 0;
    aoFechar = fechar || null;
    $("folha").classList.add("on"); $("veu").classList.add("on");
    document.body.style.overflow = "hidden";
    folhaAberta = true;
    if (montar) montar(corpo);
  }
  function fecharFolha() {
    if (!folhaAberta) return;
    folhaAberta = false;
    var f = $("folha");
    f.classList.remove("on", "arrastando"); f.style.transform = "";
    $("veu").classList.remove("on");
    document.body.style.overflow = "";
    $("btLancar").setAttribute("aria-expanded", "false");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var cb = aoFechar; aoFechar = null; if (cb) cb();
    if (folhaVolta && folhaVolta.focus) { try { folhaVolta.focus({ preventScroll: true }); } catch (e) {} }
    folhaVolta = null;
  }
  $("veu").addEventListener("click", function () { if (buscaAberta) fecharBusca(); else fecharFolha(); });
  $("folhaFecha").addEventListener("click", fecharFolha);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharFolha(); });
  (function () {
    var f = $("folha"), y0 = 0, dy = 0, t0 = 0, id = null;
    function desce(ev) {
      if (pc() || ev.target.closest("button")) return;
      y0 = ev.clientY; dy = 0; t0 = Date.now(); id = ev.pointerId; f.classList.add("arrastando");
      try { ev.currentTarget.setPointerCapture(id); } catch (e) {}
    }
    function move(ev) { if (ev.pointerId !== id) return; dy = Math.max(0, ev.clientY - y0); f.style.transform = "translate(-50%, " + dy + "px)"; }
    function sobe(ev) {
      if (ev.pointerId !== id) return; id = null; f.classList.remove("arrastando");
      var vel = dy / Math.max(1, Date.now() - t0);
      if (dy > 110 || (vel > 0.5 && dy > 30)) fecharFolha(); else f.style.transform = "";
    }
    [$("alca"), $("cabFolha")].forEach(function (el) {
      el.addEventListener("pointerdown", desce); el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", sobe); el.addEventListener("pointercancel", sobe);
    });
  })();

  function campo(rot, input) { return '<div class="campo"><label>' + rot + "</label>" + input + "</div>"; }
  function pilulas(nome, opcoes, atual) {
    return '<div class="pilulas" data-pil="' + nome + '">' + opcoes.map(function (o) { return '<button type="button" data-val="' + esc(o[0]) + '" aria-pressed="' + (o[0] === atual) + '">' + esc(o[1]) + "</button>"; }).join("") + "</div>";
  }
  function ligaPilulas(c) {
    c.querySelectorAll("[data-pil]").forEach(function (g) {
      g.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; g.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); });
    });
  }
  function pil(c, nome) { var b = c.querySelector('[data-pil="' + nome + '"] [aria-pressed="true"]'); return b ? b.dataset.val : ""; }
  function confirmaDuplo(bt, txt, fn) {
    var armado = false;
    bt.addEventListener("click", function () {
      if (!armado) { armado = true; var o = bt.innerHTML; bt.textContent = txt; bt.classList.add("acento"); setTimeout(function () { armado = false; bt.innerHTML = o; bt.classList.remove("acento"); }, 3000); return; }
      fn();
    });
  }

  /* --- site (abordagem) --- */
  function folhaSite(p) {
    var passo = Math.min(Number(p.passo) || 0, 3), vivo = (p.status === "fila" || p.status === "enviando") && !!p.previa;
    abrirFolha(p.nome,
      '<p class="sub" style="margin:0;color:var(--suave);font-size:14px;">' + esc([p.consulta || p.ramo, [p.bairro, p.cidade].filter(Boolean).join(", ")].filter(Boolean).join(", ")) + "</p>" +
      (p.ex_slug ? '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + (Number(p.ex_vistas) || 0) + '</b><span>vezes que abriu</span></div><div class="num"><b>' + (p.ex_expira ? dm(String(p.ex_expira).slice(0, 10)) : "-") + "</b><span>sai do ar</span></div></div>" : "") +
      (vivo ? '<div class="rot">' + PASSO[passo] + (p.proximo ? ", " + quandoRel(p.proximo) : "") + '</div><div class="msg-grande">' + esc(mensagem(p)) + "</div>" +
        '<button class="bt preto cheio" id="fIg">' + IC.ig + "Copiar e abrir Instagram</button>" : "") +
      '<div class="grade-bts"><button class="bt" id="fVer">' + IC.olho + "Ver o site</button>" + (/^https:\/\//.test(p.maps || "") ? '<button class="bt" id="fMaps">Maps</button>' : '<button class="bt" id="fInsta">Instagram</button>') + "</div>" +
      (vivo ? '<div class="grade-bts"><button class="bt acento" data-ac="enviei">Enviei</button><button class="bt lead-bt" data-ac="respondeu">Respondeu</button><button class="bt" data-ac="pular">Amanhã</button><button class="bt" data-ac="parar">Parar</button></div>' : "") +
      (p.status === "selecionado" ? '<button class="bt cheio" data-ac="devolver">Devolver pra reserva</button>' : "") +
      (p.status === "fila" && !p.previa ? '<button class="bt preto cheio" data-ac="escolher">Escolher pra virar site</button>' : ""),
      function (c) {
        var ig = c.querySelector("#fIg"); if (ig) ig.onclick = function () { copiar(mensagem(p)).then(function () { aviso("Mensagem copiada"); }).catch(function () {}); abrir(igUrl(p)); };
        c.querySelector("#fVer").onclick = function () { verSite(p); };
        var mp = c.querySelector("#fMaps"); if (mp) mp.onclick = function () { abrir(p.maps); };
        var ins = c.querySelector("#fInsta"); if (ins) ins.onclick = function () { abrir(igUrl(p)); };
        c.querySelectorAll("[data-ac]").forEach(function (b) {
          b.onclick = function () {
            var a = b.dataset.ac; fecharFolha();
            acaoProspec(p, a, { enviei: "Próximo toque agendado", respondeu: "Virou lead", pular: "Fica pra amanhã", parar: "Parado", devolver: "Voltou pra reserva", escolher: "Escolhido pra virar site" }[a]);
          };
        });
      });
  }
  function folhaReserva() {
    var lim = 30, f = "";
    var cand = prospecGrupos().reserva.sort(function (a, b) { return (Number(b.seguidores) || 0) - (Number(a.seguidores) || 0) || (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0); });
    abrirFolha("Reserva", campo("Filtrar", '<input id="rFil" type="search" autocomplete="off">') + '<div class="cartao lista" id="rLista" style="box-shadow:none;"></div>', function (c) {
      function pinta() {
        var q = f.toLowerCase().trim();
        var vis = q ? cand.filter(function (p) { return [p.nome, p.ramo, p.consulta, p.cidade, p.bairro].join(" ").toLowerCase().indexOf(q) >= 0; }) : cand;
        c.querySelector("#rLista").innerHTML = (vis.length ? vis.slice(0, lim).map(function (p) {
          var meta = [p.consulta || p.ramo, p.cidade, p.seguidores ? Number(p.seguidores).toLocaleString("pt-BR") + " seguidores" : ""].filter(Boolean).join(", ");
          return '<div class="linha"><div class="o"><b>' + esc(p.nome) + "</b><small>" + esc(meta) + '</small></div><button class="bt" data-insta="' + esc(p.id) + '" aria-label="Instagram">' + IC.ig + '</button><button class="bt preto" data-esc="' + esc(p.id) + '">Escolher</button></div>';
        }).join("") : '<p class="vazio" style="color:var(--suave);padding:12px 0;">Nada com esse filtro.</p>') +
          (vis.length > lim ? '<button class="bt-link" id="rMais">Mais 30 de ' + vis.length + "</button>" : "");
        c.querySelectorAll("[data-esc]").forEach(function (b) {
          b.onclick = function () { var p = porId(S.prospec, b.dataset.esc); if (!p) return; cand = cand.filter(function (x) { return x !== p; }); acaoProspec(p, "escolher", "Escolhido pra virar site"); pinta(); };
        });
        c.querySelectorAll("[data-insta]").forEach(function (b) { b.onclick = function () { var p = porId(S.prospec, b.dataset.insta); if (p) abrir(igUrl(p)); }; });
        var m = c.querySelector("#rMais"); if (m) m.onclick = function () { lim += 30; pinta(); };
      }
      c.querySelector("#rFil").addEventListener("input", function (e) { f = e.target.value; lim = 30; pinta(); });
      pinta();
    });
  }
  var NICHOS = {
    "Comércio": [["cafeteria", "cafe"], ["padaria", "cafe"], ["açaí", "cafe"], ["sorveteria", "cafe"], ["restaurante", "restaurante"], ["lanchonete", "restaurante"], ["hamburgueria", "restaurante"], ["pizzaria", "restaurante"], ["salão de beleza", "beleza"], ["barbearia", "beleza"], ["clínica de estética", "beleza"], ["pet shop", "loja"], ["loja de roupas", "loja"], ["floricultura", "loja"], ["ótica", "loja"], ["clínica odontológica", "saude"], ["academia", "saude"]],
    "MEI autônomo": [["fisioterapeuta", "saude"], ["nutricionista", "saude"], ["psicólogo", "saude"], ["personal trainer", "saude"], ["manicure", "beleza"], ["designer de sobrancelha", "beleza"], ["maquiadora", "beleza"], ["cabeleireira", "beleza"], ["confeitaria", "encomenda"], ["bolos caseiros", "encomenda"], ["salgados para festa", "encomenda"], ["costureira", "encomenda"], ["eletricista", "tecnico"], ["encanador", "tecnico"], ["instalação de ar condicionado", "tecnico"]]
  };
  function folhaBuscarNegocios() {
    var grupos = Object.keys(NICHOS).map(function (g) { return '<optgroup label="' + g + '">' + NICHOS[g].map(function (n) { return '<option value="' + (g === "Comércio" ? "comercio" : "mei") + "|" + n[1] + "|" + n[0] + '">' + n[0] + "</option>"; }).join("") + "</optgroup>"; }).join("");
    abrirFolha("Buscar negócios",
      campo("Nicho", '<select id="bN">' + grupos + "</select>") +
      campo("Onde", '<select id="bO"><option value="capitais">As 27 capitais</option><option value="grandes">As 40 maiores cidades</option><option value="cidade">Uma cidade</option></select>') +
      '<div id="bCid" hidden>' + campo("Cidade", '<input id="bC" autocomplete="off">') + "</div>" +
      '<label class="marcar"><input type="checkbox" id="bS" checked> Repetir toda segunda</label>' +
      '<button class="bt acento cheio" id="bOk">Buscar</button><p class="sub" id="bRes" style="margin:0;font-size:14px;font-weight:700;"></p>',
      function (c) {
        c.querySelector("#bO").onchange = function () { c.querySelector("#bCid").hidden = this.value !== "cidade"; };
        c.querySelector("#bOk").onclick = function () {
          var v = c.querySelector("#bN").value.split("|"), b = { consulta: v[2], tipo: v[0], ramo: v[1] };
          b.cidade = c.querySelector("#bO").value === "cidade" ? c.querySelector("#bC").value.trim() : c.querySelector("#bO").value;
          if (!b.cidade) return;
          var ok = this; ok.disabled = true; c.querySelector("#bRes").textContent = "Buscando no Google…";
          api("/api/prospec/buscar", { method: "POST", body: b }).then(function (d) {
            ok.disabled = false;
            if (d.erro) { c.querySelector("#bRes").textContent = "Erro: " + d.erro; return; }
            c.querySelector("#bRes").textContent = d.agendado ? "Buscando em " + d.agendado + " cidades. Os negócios entram aos poucos." : d.vistos + " vistos, " + d.novos + " novos na reserva.";
            if (c.querySelector("#bS").checked && !S.buscas.some(function (x) { return x.consulta === b.consulta && x.cidade === b.cidade; })) {
              S.buscas.push(b); api("/api/prospec/buscas", { method: "PUT", body: { buscas: S.buscas } }).catch(function () {});
            }
            api("/api/prospec").then(function (d2) { S.prospec = d2.prospec || S.prospec; render(true); });
          }).catch(function () { ok.disabled = false; c.querySelector("#bRes").textContent = "Não deu pra buscar agora."; });
        };
      });
  }

  /* --- lead --- */
  var ST_LEAD = [["novo", "Novo"], ["conversando", "Conversando"], ["fechado", "Fechado"], ["perdido", "Perdido"]];
  var ORIGENS = [["instagram", "Instagram"], ["whatsapp", "WhatsApp"], ["indicacao", "Indicação"], ["feira", "Feira"], ["site", "Site"], ["prospeccao", "Abordagem"]];
  function formLead(l) {
    l = l || {};
    return campo("Nome", '<input id="lNome" value="' + esc(l.nome || "") + '" autocomplete="off">') +
      campo("WhatsApp ou contato", '<input id="lCont" value="' + esc(l.contato || "") + '" inputmode="tel" autocomplete="off">') +
      campo("Interesse", '<input id="lInt" value="' + esc(l.interesse || "") + '" autocomplete="off">') +
      '<div class="rot">Situação</div>' + pilulas("st", ST_LEAD, l.status || "novo") +
      '<div class="rot">De onde veio</div>' + pilulas("or", ORIGENS, l.origem || "") +
      campo("Falar de novo em", '<input id="lFol" type="date" value="' + esc(l.followup || hoje()) + '">') +
      campo("Notas", '<textarea id="lNot">' + esc(l.notas || "") + "</textarea>");
  }
  function lerLead(c) {
    return { nome: c.querySelector("#lNome").value.trim(), contato: c.querySelector("#lCont").value.trim(), interesse: c.querySelector("#lInt").value.trim(),
      status: pil(c, "st") || "novo", origem: pil(c, "or") || null, followup: c.querySelector("#lFol").value || null, notas: c.querySelector("#lNot").value.trim() || null };
  }
  function folhaLead(l) {
    var tel = soDigitos(l.contato);
    abrirFolha(l.nome || "Lead",
      (tel.length >= 10 ? '<a class="bt preto cheio" href="' + esc(waLink(l.contato)) + '" target="_blank" rel="noopener">' + IC.wa + "Abrir no WhatsApp</a>" : "") +
      formLead(l) + '<button class="bt cheio perigo" id="lApaga">Apagar lead</button><div class="fixo"><button class="bt acento cheio" id="lSalva">Salvar</button></div>',
      function (c) {
        ligaPilulas(c);
        c.querySelector("#lSalva").onclick = function () {
          var m = lerLead(c); if (!m.nome) return c.querySelector("#lNome").focus();
          var fechou = m.status === "fechado" && l.status !== "fechado";
          if (fechou) m.followup = hoje();
          Object.assign(l, m); fecharFolha(); render(true); aviso(fechou ? "Fechado" : "Lead salvo");
          gravarTabela("leads", function (a) { return trocaItem(a, l.id, m); });
        };
        confirmaDuplo(c.querySelector("#lApaga"), "Toque de novo pra apagar", function () {
          fecharFolha(); var antes = S.leads.slice();
          executar("Lead apagado", function () { S.leads = S.leads.filter(function (x) { return x.id !== l.id; }); }, function () { S.leads = antes; },
            function () { gravarTabela("leads", function (a) { return a.filter(function (x) { return x.id !== l.id; }); }); });
        });
      });
  }

  /* --- evento --- */
  var TIPOS_EV = [["evento", "Evento"], ["projeto", "Projeto"], ["entrega", "Entrega"], ["post", "Post"], ["marketing", "Marketing"]];
  function formEvento(e, dia, hora) {
    e = e || {};
    var tipos = TIPOS_EV.slice(); if (e.tipo && !tipos.some(function (t) { return t[0] === e.tipo; })) tipos.push([e.tipo, cap(e.tipo)]);
    return campo("O quê", '<input id="eTit" value="' + esc(e.titulo || "") + '" autocomplete="off">') +
      pilulas("tp", tipos, e.tipo || "evento") +
      '<div class="duas">' + campo("Dia", '<input id="eData" type="date" value="' + esc(e.data || dia || hoje()) + '">') + campo("Hora", '<input id="eHora" type="time" value="' + esc(e.hora || hora || "") + '">') + "</div>" +
      '<div class="duas">' + campo("Termina dia", '<input id="eDFim" type="date" value="' + esc(e.data_fim || "") + '">') + campo("Hora fim", '<input id="eHFim" type="time" value="' + esc(e.hora_fim || "") + '">') + "</div>" +
      campo("Cliente", '<input id="eCli" value="' + esc(e.cliente || "") + '" autocomplete="off">') +
      (e.tipo === "cobranca" ? "" : campo("Notas", '<textarea id="eNot">' + esc(e.notas || "") + "</textarea>")) +
      '<label class="marcar"><input type="checkbox" id="ePub"' + (e.publico ? " checked" : "") + "> Agenda pública</label>";
  }
  function lerEvento(c, e) {
    var data = c.querySelector("#eData").value || hoje(), dfim = c.querySelector("#eDFim").value || null, hora = c.querySelector("#eHora").value || null;
    var nt = c.querySelector("#eNot");
    return { titulo: c.querySelector("#eTit").value.trim(), tipo: pil(c, "tp") || "evento", data: data, hora: hora, diaInteiro: !hora,
      data_fim: dfim && dfim > data ? dfim : null, hora_fim: c.querySelector("#eHFim").value || null, cliente: c.querySelector("#eCli").value.trim() || null,
      notas: nt ? nt.value.trim() || null : (e && e.notas) || null, publico: c.querySelector("#ePub").checked };
  }
  function folhaEvento(e) {
    abrirFolha(e.titulo || "Evento", formEvento(e) +
      '<div class="rot">Mover</div><div class="pilulas mover"><button type="button" data-mv="1h"' + (e.hora ? "" : " hidden") + '>+1 hora</button><button type="button" data-mv="amanha">Pro dia seguinte</button><button type="button" data-mv="semana">Pra semana que vem</button></div>' +
      '<button class="bt cheio perigo" id="eApaga">Apagar</button>' +
      '<div class="fixo grade-bts"><button class="bt acento" id="eSalva">Salvar</button><button class="bt' + (e.feito ? "" : " verde") + '" id="eFeito">' + (e.feito ? "Reabrir" : IC.check + "Feito") + "</button></div>",
      function (c) {
        ligaPilulas(c);
        c.querySelector("#eSalva").onclick = function () {
          var m = lerEvento(c, e); if (!m.titulo) return c.querySelector("#eTit").focus();
          descarregar();
          Object.assign(e, m); fecharFolha(); render(true); aviso("Salvo");
          gravarTabela("eventos", function (a) { return trocaItem(a, e.id, m); });
        };
        c.querySelector("#eFeito").onclick = function () { fecharFolha(); eventoFeito(e, !e.feito); };
        c.querySelectorAll("[data-mv]").forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.mv; fecharFolha();
            if (k === "1h") moverEvento(e, e.data, hm(minutos(e.hora) + 60));
            else moverEvento(e, somaDias(e.data, k === "semana" ? 7 : 1), e.hora || null);
          };
        });
        confirmaDuplo(c.querySelector("#eApaga"), "Toque de novo pra apagar", function () {
          fecharFolha(); var antes = S.eventos.slice();
          executar("Apagado", function () { S.eventos = S.eventos.filter(function (x) { return x.id !== e.id; }); }, function () { S.eventos = antes; },
            function () { gravarTabela("eventos", function (a) { return a.filter(function (x) { return x.id !== e.id; }); }); });
        });
      });
  }

  /* --- lembrete --- */
  function folhaNota(n) {
    abrirFolha("Lembrete",
      campo("O quê", '<input id="nTit" value="' + esc(n.titulo || "") + '" autocomplete="off">') +
      campo("Detalhe", '<textarea id="nDet">' + esc(n.detalhe || "") + "</textarea>") +
      '<div class="duas">' + campo("Dia", '<input id="nData" type="date" value="' + esc(n.data || "") + '">') + campo("Hora", '<input id="nHora" type="time" value="' + esc(n.hora || "") + '">') + "</div>" +
      '<button class="bt cheio perigo" id="nApaga">Apagar</button>' +
      '<div class="fixo grade-bts"><button class="bt acento" id="nSalva">Salvar</button><button class="bt' + (n.feito ? "" : " verde") + '" id="nFeito">' + (n.feito ? "Reabrir" : IC.check + "Feito") + "</button></div>",
      function (c) {
        c.querySelector("#nSalva").onclick = function () {
          var m = { titulo: c.querySelector("#nTit").value.trim(), detalhe: c.querySelector("#nDet").value.trim() || null, data: c.querySelector("#nData").value || null, hora: c.querySelector("#nHora").value || null };
          if (!m.titulo) return; Object.assign(n, m); fecharFolha(); render(true); aviso("Salvo");
          gravarTabela("notas", function (a) { return trocaItem(a, n.id, m); });
        };
        c.querySelector("#nFeito").onclick = function () { fecharFolha(); notaFeita(n, !n.feito); };
        confirmaDuplo(c.querySelector("#nApaga"), "Toque de novo pra apagar", function () {
          fecharFolha(); var antes = S.notas.slice();
          executar("Apagado", function () { S.notas = S.notas.filter(function (x) { return x.id !== n.id; }); }, function () { S.notas = antes; },
            function () { gravarTabela("notas", function (a) { return a.filter(function (x) { return x.id !== n.id; }); }); });
        });
      });
  }

  /* --- carnê --- */
  function folhaParcela(e) {
    var p = kv(e.notas);
    abrirFolha((e.cliente || "Cliente") + " " + (p.parc || ""),
      '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + brlCurto(num(p.valor)) + '</b><span>parcela</span></div><div class="num"><b>' + dm(e.data) + "</b><span>" + (e.feito ? "paga" : quandoRel(e.data) === "hoje" ? "vence hoje" : diasEntre(hoje(), e.data) < 0 ? "venceu" : "vence") + "</span></div></div>" +
      (p.prod ? '<p class="sub" style="margin:0;font-size:14px;color:var(--suave);">' + esc(p.prod) + "</p>" : "") +
      (!e.feito ? '<a class="bt preto cheio" href="' + esc(waLink(p.tel, msgCobranca(e))) + '" target="_blank" rel="noopener">' + IC.wa + "Cobrar no WhatsApp</a>" : "") +
      '<button class="bt cheio ' + (e.feito ? "" : "verde") + '" id="pPaga">' + (e.feito ? "Desfazer o recebimento" : IC.check + "Recebi") + "</button>" +
      (p.carne ? '<button class="bt-link" id="pTodas">Ver o carnê inteiro</button>' : ""),
      function (c) {
        c.querySelector("#pPaga").onclick = function () { fecharFolha(); parcelaPaga(e, !e.feito); };
        var t = c.querySelector("#pTodas"); if (t) t.onclick = function () { folhaCarne(p.carne); };
      });
  }
  function folhaCarne(id) {
    var evs = eventosVivos().filter(function (e) { if (e.tipo !== "cobranca") return false; var p = kv(e.notas); return (p.carne || e.cliente || e.id) === id; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (!evs.length) return;
    var p0 = kv(evs[0].notas), total = evs.reduce(function (a, e) { return a + num(kv(e.notas).valor); }, 0), pago = evs.filter(function (e) { return e.feito; }).reduce(function (a, e) { return a + num(kv(e.notas).valor); }, 0);
    abrirFolha((evs[0].cliente || "Carnê") + (p0.prod ? " · " + p0.prod : ""),
      '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + brlCurto(pago) + '</b><span>recebido</span></div><div class="num"><b>' + brlCurto(total - pago) + "</b><span>falta</span></div></div>" +
      '<div class="cartao lista" style="box-shadow:none;">' + evs.map(function (e, i) {
        var p = kv(e.notas), atras = !e.feito && e.data < hoje();
        return '<div class="linha"><div class="o"><b>' + esc(p.parc || (i + 1) + "/" + evs.length) + " · " + brl(num(p.valor)) + "</b><small" + (atras ? ' style="color:var(--c-site);font-weight:900"' : "") + ">" + (e.feito ? "paga" : (atras ? "venceu " : "vence ") + dm(e.data)) + '</small></div><button class="bt ' + (e.feito ? "" : "verde") + '" data-parc="' + esc(e.id) + '">' + (e.feito ? "Desfazer" : "Recebi") + "</button></div>";
      }).join("") + "</div>",
      function (c) {
        c.querySelectorAll("[data-parc]").forEach(function (b) { b.onclick = function () { var e = porId(S.eventos, b.dataset.parc); if (!e) return; fecharFolha(); parcelaPaga(e, !e.feito); }; });
      });
  }

  /* --- caixa e pedidos --- */
  function folhaEntrada(l) {
    var f = fonteDe(l), auto = f === "pix" || f === "mp", evCarne = f === "carne" && String(l.id).indexOf("lanc-") === 0 ? porId(S.eventos, String(l.id).slice(5)) : null;
    var taxa = f === "mp" ? taxaCartao(l) : 0;
    abrirFolha(tituloEntrada(l),
      '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + brlCurto(num(l.valor)) + '</b><span>' + FONTE[f] + (taxa ? ", taxa " + brl(taxa) : "") + '</span></div><div class="num"><b>' + dm(l.data) + "</b><span>" + quandoRel(l.data) + "</span></div></div>" +
      '<p class="sub" style="margin:0;font-size:14px;color:var(--suave);">' + esc(l.label || "") + "</p>" +
      (evCarne ? '<button class="bt cheio" id="eCarne">Desfazer o recebimento da parcela</button>' :
        '<button class="bt cheio perigo" id="eApaga">' + (auto ? "Não é venda, apagar de vez" : "Apagar entrada") + "</button>"),
      function (c) {
        var bc = c.querySelector("#eCarne"); if (bc) { bc.onclick = function () { fecharFolha(); parcelaPaga(evCarne, false); }; return; }
        var b = c.querySelector("#eApaga"); if (!b) return;
        confirmaDuplo(b, "Toque de novo pra apagar", function () {
          fecharFolha(); var antes = S.lancamentos.slice();
          executar("Entrada apagada", function () { S.lancamentos = S.lancamentos.filter(function (x) { return x.id !== l.id; }); }, function () { S.lancamentos = antes; },
            function () {
              if (auto) api("/api/entradas/ignorar", { method: "POST", body: { id: l.id, motivo: "apagado no painel" } }).then(guardaCache).catch(function () { aviso("Não salvou. Confira a internet."); carregar().then(function () { render(true); }).catch(function () {}); });
              else gravarTabela("lancamentos", function (a) { return a.filter(function (x) { return x.id !== l.id; }); });
            });
        });
      });
  }
  function folhaPedido(p) {
    abrirFolha("Pedido " + p.codigo,
      '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + brlCurto(Number(p.total || 0) / 100) + '</b><span>calculado pelo site</span></div><div class="num"><b>' + dm(diaLocal(p.criado_em)) + "</b><span>" + esc(p.status) + "</span></div></div>" +
      '<div class="cartao lista" style="box-shadow:none;">' + (p.itens || []).map(function (i) { return '<div class="linha"><div class="o"><b>' + esc((i.qtd > 1 ? i.qtd + "x " : "") + i.nome) + "</b>" + (i.variacao ? "<small>" + esc(i.variacao) + "</small>" : "") + '</div><span class="valor">' + brl(i.qtd * i.preco_unit / 100) + "</span></div>"; }).join("") + "</div>" +
      (p.nota ? '<p class="sub" style="margin:0;font-size:14px;">' + esc(p.nota) + "</p>" : "") +
      (p.status === "aberto" ? '<div class="grade-bts"><button class="bt verde" data-st="atendido">' + IC.check + 'Atendido</button><button class="bt" data-st="cancelado">Cancelar</button></div>' : '<button class="bt cheio" data-st="aberto">Reabrir</button>'),
      function (c) {
        c.querySelectorAll("[data-st]").forEach(function (b) {
          b.onclick = function () {
            var st = b.dataset.st; fecharFolha();
            if (st === "aberto" && !porId(S.pedidos, p.codigo, "codigo")) S.pedidos.push(p);
            pedidoStatus(p, st);
          };
        });
      });
  }

  /* --- mês --- */
  function folhaMes(ym) {
    var p = ym.split("-").map(Number);
    abrirFolha(cap(MESES[p[1] - 1]) + " " + p[0], navMes(ym, "data-m") + gradeMes(ym), function (c) {
      c.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { folhaMes(b.dataset.m); }; });
      c.querySelectorAll("[data-pdia]").forEach(function (b) { b.onclick = function () { diaSel = b.dataset.pdia; fecharFolha(); render(false); }; });
    });
  }

  /* --- lançar --- */
  var TIPOS_LANCAR = [["entrada", "Entrada", IC.entrada], ["evento", "Evento", IC.evento], ["lead", "Lead", IC.lead], ["carne", "Carnê", IC.carne], ["nota", "Lembrete", IC.nota]];
  function folhaLancar(tipo, dia, hora) {
    tipo = tipo || lerLS("maratu.painel.lancar", "entrada");
    $("btLancar").setAttribute("aria-expanded", "true");
    abrirFolha("Lançar",
      '<div class="tipos">' + TIPOS_LANCAR.map(function (t) { return '<button type="button" data-tl="' + t[0] + '" aria-pressed="' + (t[0] === tipo) + '">' + t[2] + t[1] + "</button>"; }).join("") + "</div>" +
      '<div id="lForm" style="display:grid;gap:12px;"></div>',
      function (c) {
        function monta(t) {
          tipo = t; gravarLS("maratu.painel.lancar", t);
          c.querySelectorAll("[data-tl]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tl === t)); });
          var f = c.querySelector("#lForm");
          if (t === "entrada") f.innerHTML = campo("Valor", '<input id="xVal" class="valor-grande" inputmode="decimal" placeholder="0,00" autocomplete="off">') + campo("O que foi", '<input id="xLab" autocomplete="off">') + campo("Dia", '<input id="xData" type="date" value="' + hoje() + '">') + '<div class="fixo"><button class="bt acento cheio" id="xOk">Lançar entrada</button></div>';
          else if (t === "evento") f.innerHTML = formEvento(null, dia, hora) + '<div class="fixo"><button class="bt acento cheio" id="xOk">Criar evento</button></div>';
          else if (t === "lead") f.innerHTML = formLead(null) + '<div class="fixo"><button class="bt acento cheio" id="xOk">Criar lead</button></div>';
          else if (t === "carne") f.innerHTML = campo("Cliente", '<input id="cCli" autocomplete="off">') + campo("WhatsApp", '<input id="cTel" inputmode="tel" autocomplete="off">') + campo("Produto", '<input id="cProd" autocomplete="off">') +
            '<div class="duas">' + campo("Total", '<input id="cTot" inputmode="decimal" placeholder="0,00" autocomplete="off">') + campo("Parcelas", '<input id="cN" type="number" inputmode="numeric" min="1" max="24" value="3">') + "</div>" +
            '<div class="duas">' + campo("1ª parcela", '<input id="cD1" type="date" value="' + somaDias(hoje(), 30) + '">') + campo("A cada (dias)", '<input id="cInt" type="number" inputmode="numeric" min="1" value="30">') + "</div>" +
            '<p class="sub" id="cPrev" style="margin:0;font-size:14px;font-weight:700;"></p><div class="fixo"><button class="bt acento cheio" id="xOk">Criar carnê</button></div>';
          else f.innerHTML = campo("O quê", '<input id="nTit" autocomplete="off">') + campo("Detalhe", '<textarea id="nDet"></textarea>') + '<div class="duas">' + campo("Dia", '<input id="nData" type="date" value="' + hoje() + '">') + campo("Hora", '<input id="nHora" type="time">') + "</div>" + '<div class="fixo"><button class="bt acento cheio" id="xOk">Criar lembrete</button></div>';
          ligaPilulas(f);
          if (t === "evento") ligaQuando(f);
          if (t === "carne") {
            var prev = function () { var tot = num(f.querySelector("#cTot").value), n = Math.max(1, parseInt(f.querySelector("#cN").value, 10) || 1); f.querySelector("#cPrev").textContent = tot ? n + "x de " + brl(Math.floor(tot / n * 100) / 100) : ""; };
            f.querySelector("#cTot").addEventListener("input", prev); f.querySelector("#cN").addEventListener("input", prev);
          }
          f.querySelector("#xOk").onclick = function () { salvarLancamento(t, f); };
          var primeiro = f.querySelector("input"); if (primeiro && matchMedia("(hover: hover)").matches) primeiro.focus();
        }
        c.querySelectorAll("[data-tl]").forEach(function (b) { b.onclick = function () { monta(b.dataset.tl); }; });
        monta(tipo);
      });
  }
  function salvarLancamento(t, f) {
    var q = function (s) { return f.querySelector(s); };
    if (t === "entrada") {
      var v = num(q("#xVal").value); if (!v) return q("#xVal").focus();
      var l = { id: uid("m"), data: q("#xData").value || hoje(), label: q("#xLab").value.trim() || "Entrada", valor: v };
      S.lancamentos.push(l); fecharFolha(); render(true); aviso("Entrou " + brl(v));
      gravarTabela("lancamentos", function (a) { return a.concat([l]); });
    } else if (t === "evento") {
      var m = lerEvento(f, null);
      var lq = lerQuando(q("#eTit").value, { semData: !!q("#eData").dataset.mexeu, semHora: !!q("#eHora").dataset.mexeu });
      if (lq.achou && lq.resto) m.titulo = lq.resto;
      if (!m.titulo) return q("#eTit").focus();
      var e = Object.assign({ id: uid("e"), feito: false }, m);
      S.eventos.push(e); fecharFolha(); diaSel = e.data; render(true); aviso("Evento criado em " + dm(e.data));
      gravarTabela("eventos", function (a) { return a.concat([e]); });
    } else if (t === "lead") {
      var ml = lerLead(f); if (!ml.nome) return q("#lNome").focus();
      if (ml.status === "fechado") ml.followup = hoje();
      var ld = Object.assign({ id: uid("L"), criado: new Date().toISOString() }, ml);
      S.leads.unshift(ld); fecharFolha(); render(true); aviso("Lead criado");
      gravarTabela("leads", function (a) { return [ld].concat(a); });
    } else if (t === "carne") {
      var cli = q("#cCli").value.trim(), tot = num(q("#cTot").value), n = Math.max(1, Math.min(24, parseInt(q("#cN").value, 10) || 1));
      if (!cli) return q("#cCli").focus(); if (!tot) return q("#cTot").focus();
      var d1 = q("#cD1").value || hoje(), inter = Math.max(1, parseInt(q("#cInt").value, 10) || 30), carneId = uid("cb");
      var base = Math.floor(tot / n * 100) / 100, ult = Math.round((tot - base * (n - 1)) * 100) / 100, evs = [];
      for (var i = 0; i < n; i++) {
        var val = i === n - 1 ? ult : base;
        evs.push({ id: uid("cb"), titulo: "Cobrar " + cli + " " + (i + 1) + "/" + n + " · R$" + val.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), tipo: "cobranca",
          data: somaDias(d1, inter * i), hora: "09:00", diaInteiro: false, cliente: cli,
          notas: "carne:" + carneId + ";parc:" + (i + 1) + "/" + n + ";valor:" + val.toFixed(2) + ";tel:" + soDigitos(q("#cTel").value) + ";prod:" + q("#cProd").value.trim().replace(/;/g, ","),
          feito: false, publico: false, data_fim: null, hora_fim: null });
      }
      S.eventos = S.eventos.concat(evs); fecharFolha(); render(true); aviso("Carnê criado, " + n + " parcelas");
      gravarTabela("eventos", function (a) { return a.concat(evs); });
    } else {
      var tit = q("#nTit").value.trim(); if (!tit) return q("#nTit").focus();
      var nt = { id: uid("n"), titulo: tit, detalhe: q("#nDet").value.trim() || null, categoria: null, data: q("#nData").value || null, hora: q("#nHora").value || null, feito: false, criado: new Date().toISOString() };
      S.notas.unshift(nt); fecharFolha(); render(true); aviso("Lembrete criado");
      gravarTabela("notas", function (a) { return [nt].concat(a); });
    }
  }

  /* "reunião Wordtech sexta 14h" vira título, dia e hora */
  var DIAS_SEM = [["domingo", "dom"], ["segunda", "seg"], ["terca", "ter"], ["quarta", "qua"], ["quinta", "qui"], ["sexta", "sex"], ["sabado", "sab"]];
  var MESES_SA = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function semAcento(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  /* próxima data >= hoje com esse dia (e mês, se vier); devolve null se não existir em 12 meses */
  function proximoDia(n, mes) {
    var b = dataDe(hoje()), h = hoje();
    for (var k = 0; k < 24; k++) {
      var d = mes == null ? new Date(b.getFullYear(), b.getMonth() + k, n) : new Date(b.getFullYear() + k, mes, n);
      if (d.getDate() === n && (mes == null || d.getMonth() === mes) && isoDe(d) >= h) return isoDe(d);
    }
    return null;
  }
  function lerQuando(txt, op) {
    op = op || {};
    // o texto composto (NFC) e a versão sem acento têm o mesmo comprimento, então os índices batem
    var orig = String(txt || "").normalize("NFC"), s = semAcento(orig).toLowerCase(), o = { achou: false, data: null, hora: null };
    var tiraData = [], tiraHora = [], h0 = hoje(), m;
    // hora: 14h, 14h30, 14:30, "às 9" (sem palavra logo depois, pra "as 3 amostras" não virar 03:00)
    if ((m = /\b(?:as\s+|a partir das\s+)?(\d{1,2})[:h](\d{2})\b/.exec(s)) && +m[1] < 24 && +m[2] < 60) { o.hora = pad2(+m[1]) + ":" + m[2]; tiraHora.push(m); }
    else if ((m = /\b(?:as\s+)?(\d{1,2})\s?h(?:s|oras?)?\b/.exec(s)) && +m[1] < 24) { o.hora = pad2(+m[1]) + ":00"; tiraHora.push(m); }
    else if ((m = /\bas\s+(\d{1,2})\b(?!\s*[a-z0-9])/.exec(s)) && +m[1] < 24) { o.hora = pad2(+m[1]) + ":00"; tiraHora.push(m); }
    // dia
    if ((m = /\bdepois de amanha\b/.exec(s))) { o.data = somaDias(h0, 2); tiraData.push(m); }
    else if ((m = /\b(?:pra\s+)?amanha\b/.exec(s))) { o.data = somaDias(h0, 1); tiraData.push(m); }
    else if ((m = /\bhoje\b/.exec(s))) { o.data = h0; tiraData.push(m); }
    else if ((m = /\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(s))) {
      var dd = +m[1], mm = +m[2] - 1;
      if (m[3]) { var ano = m[3].length === 2 ? 2000 + +m[3] : +m[3], d = new Date(ano, mm, dd); if (d.getDate() === dd && d.getMonth() === mm) { o.data = isoDe(d); tiraData.push(m); } }
      else if (mm >= 0 && mm < 12) { var p = proximoDia(dd, mm); if (p) { o.data = p; tiraData.push(m); } }
    } else if ((m = new RegExp("\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(" + MESES_SA.join("|") + ")\\b").exec(s))) {
      var p2 = proximoDia(+m[1], MESES_SA.indexOf(m[2])); if (p2) { o.data = p2; tiraData.push(m); }
    } else if ((m = /\bdia\s+(\d{1,2})\b/.exec(s)) && +m[1] >= 1 && +m[1] <= 31) {
      var p3 = proximoDia(+m[1], null); if (p3) { o.data = p3; tiraData.push(m); }
    } else {
      for (var i = 0; i < 7 && !o.data; i++) {
        // nome inteiro sempre; forma curta (seg, ter, dom...) só com "na/no/próxima" antes, pra "ter reunião" e "Dom Pedro" não virarem data
        var re = new RegExp("\\b(?:(n[ao]|proxim[ao])\\s+)?(?:(" + DIAS_SEM[i][0] + ")(?:-feira)?|(" + DIAS_SEM[i][1] + "))\\b"), mm2 = re.exec(s);
        if (mm2 && (mm2[2] || mm2[1])) {
          var dif = (i - dataDe(h0).getDay() + 7) % 7;
          if (dif === 0 && /^proxim/.test(mm2[1] || "")) dif = 7;
          o.data = somaDias(h0, dif); tiraData.push(mm2);
        }
      }
    }
    o.achou = !!(o.data || o.hora);
    var tira = (op.semData ? [] : tiraData).concat(op.semHora ? [] : tiraHora), r = orig;
    tira.sort(function (x, y) { return y.index - x.index; }).forEach(function (x) { r = r.slice(0, x.index) + " " + r.slice(x.index + x[0].length); });
    o.resto = r.replace(/\s+(?:no|na|em|de|dia|pra|para|às|as)\s*$/i, "").replace(/\s{2,}/g, " ").trim();
    return o;
  }
  function ligaQuando(f) {
    var tit = f.querySelector("#eTit"), dt = f.querySelector("#eData"), hr = f.querySelector("#eHora");
    var lido = document.createElement("p"); lido.className = "quando-lido"; lido.hidden = true;
    tit.parentNode.appendChild(lido);
    [dt, hr].forEach(function (x) { x.addEventListener("input", function () { x.dataset.mexeu = "1"; }); });
    var dataPadrao = dt.value, horaPadrao = hr.value;
    tit.addEventListener("input", function () {
      var o = lerQuando(tit.value);
      if (!dt.dataset.mexeu) dt.value = o.data || dataPadrao;
      if (!hr.dataset.mexeu) hr.value = o.hora || horaPadrao;
      if (!o.achou) { lido.hidden = true; return; }
      var d = dt.value || o.data, dd = dataDe(d);
      lido.hidden = false;
      lido.innerHTML = IC.evento + "<span>" + esc(cap(SEM[dd.getDay()]) + ", " + dm(d) + (hr.value ? " às " + hr.value : "")) + "</span>";
    });
  }

  /* --- busca: caixa no topo da tela, acha registro e roda comando --- */
  var buscaAberta = false, buscaSel = 0, buscaLista = [];
  function norm(s) { return semAcento(s).toLowerCase(); }
  var COMANDOS = [
    ["Ir", "Hoje", function () { irPara("hoje"); }, IC.dir], ["Ir", "Sites", function () { irPara("sites"); }, IC.site],
    ["Ir", "Loja", function () { irPara("loja"); }, IC.entrada], ["Ir", "Agenda", function () { irPara("agenda"); }, IC.evento],
    ["Lançar", "Entrada", function () { folhaLancar("entrada"); }, IC.entrada], ["Lançar", "Evento", function () { folhaLancar("evento", vista === "agenda" ? diaSel : null); }, IC.evento],
    ["Lançar", "Lead", function () { folhaLancar("lead"); }, IC.lead], ["Lançar", "Carnê", function () { folhaLancar("carne"); }, IC.carne],
    ["Lançar", "Lembrete", function () { folhaLancar("nota"); }, IC.nota],
    ["Sites", "Buscar negócios", function () { folhaBuscarNegocios(); }, IC.site], ["Sites", "Escolher na reserva", function () { folhaReserva(); }, IC.site],
    ["Ir", "Estúdio", function () { irPara("estudio"); }, IC.dir], ["Estúdio", "Ligar notificações", function () { irPara("estudio"); }, IC.dir]
  ];
  function abrirBusca() {
    if (folhaAberta) fecharFolha();
    buscaAberta = true;
    $("busca").classList.add("on"); $("veu").classList.add("on"); document.body.style.overflow = "hidden";
    var inp = $("qB"); inp.value = ""; inp.focus();
    pintaBusca();
  }
  function fecharBusca() {
    if (!buscaAberta) return;
    buscaAberta = false;
    $("busca").classList.remove("on"); $("veu").classList.remove("on"); document.body.style.overflow = "";
    $("qB").blur();
  }
  function pintaBusca() {
    var bruto = $("qB").value.trim(), q = norm(bruto), res = $("qRes"), html = [];
    buscaLista = [];
    function grupo(rot, itens) {
      if (!itens.length) return;
      html.push('<div class="grupo-rot">' + rot + "</div>");
      itens.forEach(function (it) {
        var i = buscaLista.length; buscaLista.push(it.fn);
        html.push('<div class="opcao" role="option" data-i="' + i + '">' + (it.ico || "") + '<div class="o"><b>' + esc(it.tit) + "</b>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</div>" + (it.tipo ? '<span class="tipo t-' + it.tipo + '">' + esc(it.rot) + "</span>" : "") + "</div>");
      });
    }
    if (q.length >= 2) {
      var tem = function () { return norm(Array.prototype.slice.call(arguments).join(" ")).indexOf(q) >= 0; }, achados = [];
      S.leads.forEach(function (l) { if (tem(l.nome, l.contato, l.interesse, l.notas)) achados.push({ tipo: "lead", rot: "Lead", tit: l.nome, sub: l.interesse || l.status, fn: function () { folhaLead(l); } }); });
      S.prospec.forEach(function (p) { if (tem(p.nome, p.cidade, p.ramo)) achados.push({ tipo: "site", rot: "Site", tit: p.nome, sub: [p.cidade, p.status].filter(Boolean).join(", "), fn: function () { folhaSite(p); } }); });
      eventosVivos().forEach(function (e) { if (tem(e.titulo, e.cliente)) achados.push({ tipo: e.tipo === "cobranca" ? "carne" : "agenda", rot: e.tipo === "cobranca" ? "Carnê" : "Agenda", tit: e.titulo, sub: dm(e.data) + (e.feito ? ", feito" : ""), fn: function () { if (e.tipo === "cobranca") folhaParcela(e); else folhaEvento(e); } }); });
      (S.pedidosTodos || S.pedidos).forEach(function (p) { var nomes = (p.itens || []).map(function (i) { return i.nome; }).join(", "); if (tem(p.codigo, nomes)) achados.push({ tipo: "loja", rot: "Pedido", tit: p.codigo, sub: nomes, fn: function () { folhaPedido(p); } }); });
      S.lancamentos.forEach(function (l) { if (tem(l.label)) achados.push({ tipo: "feito", rot: "Entrada", tit: tituloEntrada(l), sub: dm(l.data) + ", " + brl(num(l.valor)), fn: function () { folhaEntrada(l); } }); });
      S.notas.forEach(function (n) { if (tem(n.titulo, n.detalhe)) achados.push({ tipo: "nota", rot: "Lembrete", tit: n.titulo, sub: n.data ? dm(n.data) : "", fn: function () { folhaNota(n); } }); });
      var porTipo = {};
      grupo("Resultados", achados.filter(function (a) { porTipo[a.rot] = (porTipo[a.rot] || 0) + 1; return porTipo[a.rot] <= 6; }).slice(0, 30));
    }
    var cmds = COMANDOS.filter(function (c) { return !q || norm(c[0] + " " + c[1]).indexOf(q) >= 0; });
    grupo(q ? "Ações" : "Ir e lançar", cmds.map(function (c) { return { tit: c[0] === "Ir" ? c[1] : c[0] + " " + c[1].toLowerCase(), ico: c[3], fn: c[2] }; }));
    res.innerHTML = html.length ? html.join("") : '<p class="busca-vazia">Nada com “' + esc(bruto) + '”.</p>';
    buscaSel = 0; marcaSel();
    res.querySelectorAll(".opcao").forEach(function (el) {
      el.addEventListener("mousemove", function () { if (buscaSel !== +el.dataset.i) { buscaSel = +el.dataset.i; marcaSel(); } });
      el.addEventListener("click", function () { roda(+el.dataset.i); });
    });
  }
  function marcaSel(rolar) {
    $("qRes").querySelectorAll(".opcao").forEach(function (el) {
      var s = +el.dataset.i === buscaSel; el.setAttribute("aria-selected", String(s));
      if (s && rolar && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    });
  }
  function roda(i) { var fn = buscaLista[i]; if (!fn) return; fecharBusca(); fn(); }
  $("qB").addEventListener("input", pintaBusca);
  $("qB").addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); buscaSel = Math.min(buscaLista.length - 1, buscaSel + 1); marcaSel(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); buscaSel = Math.max(0, buscaSel - 1); marcaSel(true); }
    else if (e.key === "Enter") { e.preventDefault(); roda(buscaSel); }
    else if (e.key === "Escape") { e.preventDefault(); fecharBusca(); }
  });
  $("buscaFecha").addEventListener("click", fecharBusca);

  /* ---------- Estúdio: o que se usa de vez em quando, e os ajustes ---------- */
  var CHAVE_PUSH = "BMjhxXrHo64T09xYPoBZcPq92bv7_FBFTtWCKae0pPZf2clPvPFW6ZA6gNrtfl37-4KFG1TdNZTlPJcGhzKPTzQ";
  var ajustes = { push: null, pushMsg: "", feed: null, totp: null, passkeys: null, carregado: false, carregando: false };
  function b64urlParaBytes(s) { s = String(s || "").replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var bin = atob(s), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function bytesParaB64url(buf) { var a = new Uint8Array(buf), bin = ""; for (var i = 0; i < a.length; i++) bin += String.fromCharCode(a[i]); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function pushSuportado() { return "serviceWorker" in navigator && !!navigator.serviceWorker && "PushManager" in window && "Notification" in window; }
  function noApp() { try { return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; } catch (e) { return false; } }
  var ehIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function inscricaoPush() {
    if (!pushSuportado()) return Promise.resolve(null);
    return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).catch(function () { return null; });
  }
  function estadoPush() {
    if (!pushSuportado()) return "indisponível";
    if (ehIOS && !noApp()) return "só no app";
    if (Notification.permission === "denied") return "bloqueadas";
    return ajustes.push ? "ligadas" : "desligadas";
  }
  function carregarAjustes() {
    if (ajustes.carregando) return; ajustes.carregando = true;
    return Promise.all([
      inscricaoPush(),
      api("/api/config").catch(function () { return null; }),
      api("/api/totp/status").catch(function () { return null; }),
      api("/api/webauthn/list").catch(function () { return null; })
    ]).then(function (r) {
      ajustes.push = r[0]; ajustes.feed = r[1] && r[1].feedUrl || null;
      ajustes.totp = r[2] ? !!r[2].enabled : null; ajustes.passkeys = r[3] && r[3].passkeys ? r[3].passkeys.length : null;
      ajustes.carregado = true;
      if (vista === "estudio") render(true);
    });
  }
  function ligarPush() {
    ajustes.pushMsg = "Pedindo permissão…"; render(true);
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error("permissão negada");
      return Promise.all([navigator.serviceWorker.ready, api("/api/push/chave").then(function (d) { return d && d.publica || CHAVE_PUSH; }).catch(function () { return CHAVE_PUSH; })]);
    }).then(function (r) {
      return r[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlParaBytes(r[1]) });
    }).then(function (sub) {
      return api("/api/push/sub", { method: "POST", body: { endpoint: sub.endpoint, p256dh: bytesParaB64url(sub.getKey("p256dh")), auth: bytesParaB64url(sub.getKey("auth")) } }).then(function (d) { if (d && d.error) throw new Error(d.error); return sub; });
    }).then(function (sub) {
      ajustes.push = sub; ajustes.pushMsg = ""; render(true); aviso("Notificações ligadas");
    }).catch(function (e) { ajustes.pushMsg = "Não ligou: " + (e && e.message || e); render(true); });
  }
  function desligarPush() {
    var sub = ajustes.push; if (!sub) return;
    var ep = sub.endpoint;
    sub.unsubscribe().then(function () { return api("/api/push/unsub", { method: "POST", body: { endpoint: ep } }); })
      .then(function () { ajustes.push = null; ajustes.pushMsg = ""; render(true); aviso("Notificações desligadas"); })
      .catch(function () { aviso("Não desligou. Tente de novo."); });
  }
  var ATALHOS = [
    ["Números", "Site, Instagram e relatório", "/admin.html", '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
    ["Divulgação", "Conteúdo e newsletter", "/admin.html", '<path d="M3 11l18-7v16L3 13z"/><path d="M7 13v5a2 2 0 0 0 4 0v-4"/>'],
    ["Empresa", "MEI, DAS e limite do ano", "/admin.html", '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'],
    ["Produtos e selos", "Catálogo, fotos e selos", "/admin.html", '<path d="M5 8h14l-1.5 12h-11z"/><path d="M9 8a3 3 0 0 1 6 0"/>']
  ];
  function telaEstudio() {
    if (!ajustes.carregado) carregarAjustes();
    var tema = ""; try { tema = localStorage.getItem("maratu.painel.tema") || ""; } catch (e) {}
    var est = estadoPush(), podeLigar = est === "ligadas" || est === "desligadas";
    var linhaAj = function (attr, tit, estado, sub, seta) {
      return '<div class="linha' + (attr ? ' toca" ' + attr : '"') + '><div class="o"><b>' + tit + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + '</div><span class="estado-aj">' + esc(estado || "") + "</span>" + (seta === false ? "" : IC.seta) + "</div>";
    };
    var a = '<div class="cab"><h1>Estúdio</h1></div>' +
      '<div class="atalhos">' + ATALHOS.map(function (t) {
        return '<a class="cartao atalho" href="' + t[2] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + t[3] + "</svg><b>" + t[0] + "</b><small>" + t[1] + '</small><span class="no-antigo">painel antigo</span></a>';
      }).join("") + "</div>";
    var b = '<div class="secao">Ajustes</div>' +
      '<div class="cartao lista">' +
        '<div class="linha"><div class="o"><b>Cor</b></div>' + pilulas("tema", [["", "Areia"], ["laranja", "Laranja"], ["noite", "Noite"]], tema) + "</div>" +
        linhaAj(podeLigar ? 'data-aj="push"' : "", "Notificações", est, ajustes.pushMsg, podeLigar) +
        (ajustes.push ? linhaAj('data-aj="teste"', "Mandar notificação de teste", "", "", false) : "") +
        linhaAj(ajustes.feed ? 'data-aj="feed"' : "", "Agenda no Apple Calendar", ajustes.feed ? "assinar" : "", "") +
        linhaAj('data-aj="passkey"', "Entrar com Face ID", ajustes.passkeys == null ? "" : ajustes.passkeys ? ajustes.passkeys + (ajustes.passkeys === 1 ? " aparelho" : " aparelhos") : "nenhum", "") +
        linhaAj('data-aj="2fa"', "Verificação em duas etapas", ajustes.totp == null ? "" : ajustes.totp ? "ligada" : "desligada", "") +
      "</div>" +
      '<div class="cartao lista">' +
        linhaAj('data-aj="atualizar"', "Atualizar os dados", "", "", false) +
        linhaAj('data-aj="antigo"', "Abrir o painel antigo", "", "", true) +
        '<div class="linha toca" data-aj="sair"><div class="o"><b class="perigo">Sair</b></div></div>' +
      "</div>";
    return colunas(a, b);
  }
  function ligarEstudio(raiz) {
    var tp = raiz.querySelector('[data-pil="tema"]');
    if (tp) {
      ligaPilulas(raiz);
      tp.addEventListener("click", function () {
        var t = pil(raiz, "tema");
        try { localStorage.setItem("maratu.painel.tema", t); } catch (e) {}
        if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
        corDaBarra();
      });
    }
    raiz.querySelectorAll("[data-aj]").forEach(function (el) {
      var k = el.dataset.aj;
      if (k === "sair") { confirmaDuplo(el, "Toque de novo pra sair", sair); return; }
      el.onclick = function () {
        if (k === "push") { if (ajustes.push) desligarPush(); else ligarPush(); }
        else if (k === "teste") api("/api/push/teste", { method: "POST", body: {} }).then(function () { aviso("Teste enviado"); }).catch(function () { aviso("Não enviou"); });
        else if (k === "feed" && ajustes.feed) { var w = ajustes.feed.replace(/^https?:/, "webcal:"); copiar(ajustes.feed).catch(function () {}); location.href = w; }
        else if (k === "passkey") location.href = "/passkey.html";
        else if (k === "2fa") location.href = "/2fa.html";
        else if (k === "atualizar") carregar().then(function () { render(true); aviso("Atualizado"); }).catch(function () { aviso("Sem conexão"); });
        else if (k === "antigo") location.href = "/admin.html";
      };
    });
  }
  function sair() {
    descarregar();
    try { fetch(API + "/api/logout", { method: "POST", keepalive: true, credentials: "include" }); } catch (e) {}
    try { localStorage.removeItem("maratu.token"); localStorage.removeItem(CACHE); } catch (e) {}
    location.replace("/login.html?logout=1");
  }

  /* ---------- avisos do sistema: MEI, impressora, selos ---------- */
  function avisosDoSistema() {
    var out = [], h = hoje(), x = S.extras || {};
    var mei = x.mei;
    var dasAbertos = mei && mei.das_meses ? mei.das_meses.filter(function (m) { return !m.paid && m.dias_ate_vencimento <= 5; }).sort(function (a, b) { return a.vencimento < b.vencimento ? 1 : -1; }) : [];
    var dasMostrar = dasAbertos.filter(function (m) { return !m.atrasado; }).concat(dasAbertos.filter(function (m) { return m.atrasado; }).slice(0, 1));
    dasMostrar.forEach(function (m) {
      var nome = MESES[m.month - 1];
      out.push({
        k: "das:" + m.year + "-" + m.month, tipo: "aviso", rot: "MEI", ordem: 1.5, data: m.vencimento < h ? m.vencimento : h,
        titulo: "Pagar o DAS de " + nome, sub: m.atrasado ? "Venceu em " + dm(m.vencimento) : "Vence " + quandoRel(m.vencimento),
        quando: m.atrasado ? quandoRel(m.vencimento) : "",
        dir: { rot: "Paguei", fn: function () { dasPago(m); } },
        esq: { rot: "Amanhã", fn: function () { adiarCartao("das:" + m.year + "-" + m.month); } },
        abre: function () { location.href = "/admin.html"; }
      });
    });
    if (mei && mei.dasn && !mei.dasn.done && mei.dasn.dias_ate_deadline <= 30) {
      var dn = mei.dasn;
      out.push({
        k: "dasn:" + dn.year, tipo: "aviso", rot: "MEI", ordem: 1.5, data: dn.deadline < h ? dn.deadline : h,
        titulo: "Declaração anual do MEI", sub: dn.atrasado ? "Venceu em " + dm(dn.deadline) : "Prazo " + dm(dn.deadline),
        quando: dn.atrasado ? quandoRel(dn.deadline) : "",
        dir: { rot: "Feita", fn: function () { dasnFeita(dn.year); } },
        esq: { rot: "Amanhã", fn: function () { adiarCartao("dasn:" + dn.year); } },
        abre: function () { location.href = "/admin.html"; }
      });
    }
    var imp = x.imp;
    if (imp && imp.conectada && imp.estado && idadeImp(imp) < 1800) {
      var ruins = (imp.saude || []).filter(function (s) { return !s.ok; });
      if (imp.estado.estado === "error" || (ruins.length && ["printing", "paused"].indexOf(imp.estado.estado) >= 0)) {
        out.push({
          k: "imp:" + (imp.estado.job || "x") + ":" + (imp.estado.estado || ""), tipo: "aviso", rot: "Impressora", ordem: 0.5, data: h,
          titulo: imp.estado.estado === "error" ? "A impressora parou com erro" : "Impressão com problema",
          sub: [nomeArquivo(imp.estado.arquivo)].concat(ruins.map(function (s) { return s.rot + " " + s.txt; })).join(", "),
          quando: "agora",
          dir: { rot: "Visto", fn: function () { adiarCartao("imp:" + (imp.estado.job || "x") + ":" + (imp.estado.estado || ""), somaDias(h, 30)); } },
          esq: { rot: "Amanhã", fn: function () { adiarCartao("imp:" + (imp.estado.job || "x") + ":" + (imp.estado.estado || "")); } },
          abre: function () { location.href = "/admin.html"; }
        });
      }
    }
    var sel = x.selos;
    var nSel = sel ? Number(sel.alertas) || 0 : 0;
    if (nSel > 0) {
      out.push({
        k: "selos:" + nSel, tipo: "aviso", rot: "Selos", ordem: 3.5, data: h,
        titulo: nSel + (nSel === 1 ? " selo com alerta" : " selos com alerta"), sub: "",
        quando: "",
        dir: { rot: "Visto", fn: function () { adiarCartao("selos:" + nSel, somaDias(h, 7)); } },
        esq: { rot: "Amanhã", fn: function () { adiarCartao("selos:" + nSel); } },
        abre: function () { location.href = "/admin.html"; }
      });
    }
    return out;
  }
  function idadeImp(imp) { var t = Date.parse(imp.recebido); return isNaN(t) ? 1e9 : (Date.now() - t) / 1e3; }
  function nomeArquivo(a) { return String(a || "").split("/").pop().replace(/\.gcode$/i, "").replace(/[_-]+/g, " ").trim() || "peça"; }
  function dasPago(m) {
    var antes = m.paid; conta("aviso");
    executar("DAS de " + MESES[m.month - 1] + " pago", function () { m.paid = true; }, function () { m.paid = antes; },
      function () {
        var cfg = S.extras && S.extras.mei && S.extras.mei.config || {}, corpo = { year: m.year, month: m.month };
        if (Number(cfg.das_valor_centavos) > 0) corpo.valor_centavos = Number(cfg.das_valor_centavos);
        api("/api/mei/das/pay", { method: "POST", body: corpo }).then(guardaCache).catch(function (e) { m.paid = false; aviso(/HTTP 400/.test(String(e && e.message)) ? "Falta o valor do DAS no painel antigo" : "Não salvou. Confira a internet."); render(true); });
      });
  }
  function dasnFeita(ano) {
    var dn = S.extras.mei.dasn, antes = dn.done; conta("aviso");
    executar("Declaração marcada como feita", function () { dn.done = true; }, function () { dn.done = antes; },
      function () { api("/api/mei/dasn/done", { method: "POST", body: { year: ano } }).then(guardaCache).catch(function () { dn.done = antes; render(true); aviso("Não salvou. Confira a internet."); }); });
  }
  /* faixa da impressora no topo do Hoje, só enquanto imprime */
  function faixaImpressora() {
    var imp = S.extras && S.extras.imp;
    if (!imp || !imp.conectada || !imp.estado || ["printing", "paused"].indexOf(imp.estado.estado) < 0) return "";
    var idade = idadeImp(imp); if (idade > 1800) return "";
    var an = imp.analise || {}, pct = Math.max(0, Math.min(100, Math.round((Number(an.progresso != null ? an.progresso : imp.estado.progresso) || 0) * 100)));
    var termina = an.termina ? new Date(an.termina) : null, semSinal = idade > 180;
    var txt = semSinal ? "sem sinal há " + Math.round(idade / 60) + " min" : imp.estado.estado === "paused" ? "pausada" : termina && !isNaN(termina) ? "termina " + pad2(termina.getHours()) + ":" + pad2(termina.getMinutes()) : "";
    return '<a class="cartao faixa-imp" href="/admin.html"><span class="pulso' + (imp.estado.estado === "paused" || semSinal ? " parado" : "") + '"></span><div class="o"><b>' + esc(nomeArquivo(imp.estado.arquivo)) + "</b><small>" + pct + "%" + (txt ? ", " + txt : "") + '</small></div><div class="barra-meta"><i style="width:' + pct + '%"></i></div></a>';
  }

  function corDaBarra() {
    var t = document.documentElement.getAttribute("data-theme") || "";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "laranja" ? "#C8501A" : t === "noite" ? "#0D0D0B" : "#E8E2D6");
  }

  /* ---------- barra ---------- */
  document.querySelectorAll(".barra [data-v], .lateral [data-v]").forEach(function (b) { b.addEventListener("click", function () { fecharFolha(); irPara(b.dataset.v); }); });
  $("ltLancar").addEventListener("click", function () { folhaLancar(null, vista === "agenda" ? diaSel : null); });
  $("btBuscaPc").addEventListener("click", abrirBusca);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && buscaAberta) { e.preventDefault(); fecharBusca(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key || "").toLowerCase() === "k") { e.preventDefault(); if (buscaAberta) fecharBusca(); else if (!folhaAberta) abrirBusca(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, campo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (campo || folhaAberta || buscaAberta) return;
    var k = (e.key || "").toLowerCase(); if (e.isComposing) return;
    if (k === "n") { e.preventDefault(); folhaLancar(null, vista === "agenda" ? diaSel : null); }
    else if (e.key === "/") { e.preventDefault(); abrirBusca(); }
    else if (/^[1-5]$/.test(e.key)) irPara(ORDEM_VISTAS[Number(e.key) - 1]);
    else if (vista === "agenda" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { diaSel = somaDias(diaSel, e.key === "ArrowLeft" ? -1 : 1); agendaMes = null; render(false, e.key === "ArrowLeft" ? "esq" : "dir"); }
  });
  $("btLancar").addEventListener("click", function () { if (folhaAberta && $("btLancar").getAttribute("aria-expanded") === "true") fecharFolha(); else folhaLancar(null, vista === "agenda" ? diaSel : null); });
  $("btBusca").addEventListener("click", abrirBusca);
  $("btMais").addEventListener("click", function () { fecharFolha(); irPara(vista === "estudio" ? "hoje" : "estudio"); });

  /* ---------- início ---------- */
  corDaBarra();
  if (!token()) { try { localStorage.removeItem(CACHE); } catch (e) {} return; }
  function lerEndereco() {
    var h = (location.hash || "").replace("#", ""), mapa = { caixa: "loja", loja: "loja", agenda: "agenda", marketing: "sites", sites: "sites", mei: "hoje", estudio: "estudio", hoje: "hoje" };
    if (!h) return false;
    if (!mapa[h]) { try { history.replaceState(null, "", location.pathname); } catch (e) {} return false; }
    vista = mapa[h]; if (h === "caixa") lojaSeg = "caixa";
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    return true;
  }
  lerEndereco();
  window.addEventListener("hashchange", function () { if (lerEndereco()) { fecharFolha(); render(false); } });
  var doCache = lerCache();
  if (doCache) render(true);
  carregar().then(function () { render(true); }).catch(function (e) {
    if (String(e && e.message) === "sessão") return;
    if (doCache) { aviso("Sem conexão. Mostrando os últimos dados."); return; }
    $("tela").innerHTML = '<div class="vista"><div class="cartao"><h3 style="margin:0 0 6px;font-weight:900;">Sem conexão</h3><p class="sub" style="margin:0 0 12px;color:var(--suave);">Os dados não carregaram.</p><button class="bt preto" id="tenta">Tentar de novo</button></div></div>';
    $("tenta").onclick = function () { location.reload(); };
  });
  setInterval(function () { if (vista === "agenda" && diaSel === hoje() && !folhaAberta && !document.hidden) render(true); }, 60000);
})();
