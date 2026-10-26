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
    envelope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    copia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    post: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/></svg>',
    selo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3"/></svg>',
    imp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16M6 21V9h12v12M9 9V4h6v5M10 14h4"/></svg>',
    site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>',
    engrenagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
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

  /* módulos herdados do painel antigo chamam fetch sem token; aqui ele entra, como no admin.js */
  (function () {
    var orig = window.fetch;
    window.fetch = function (entrada, init) {
      try {
        var url = typeof entrada === "string" ? entrada : (entrada && entrada.url) || "";
        if (typeof entrada === "string" && url.indexOf(API) === 0) {
          init = init || {};
          var h = new Headers(init.headers || {}), cur = h.get("Authorization") || "";
          if (!cur || /^Bearer\s*$/.test(cur)) h.set("Authorization", "Bearer " + token());
          init.headers = h; if (!init.credentials) init.credentials = "include";
        }
      } catch (e) {}
      return orig.call(this, entrada, init);
    };
  })();
  var S = { eventos: [], lancamentos: [], notas: [], params: {}, prospec: [], leads: [], clientes: [], pedidos: [], pedidosTodos: null, uso: null, teto: 900, buscas: [], pronto: false, carregadoEm: 0 };

  function carregar() {
    return Promise.all([
      api("/api/state"),
      api("/api/prospec").catch(function () { return null; }),
      api("/api/leads").catch(function () { return null; }),
      api("/api/pedidos?status=aberto").catch(function () { return null; }),
      api("/api/mei/dashboard").catch(function () { return null; }),
      api("/api/impressora").catch(function () { return null; }),
      api("/api/selos/resumo").catch(function () { return null; }),
      api("/api/eventos/publicos").catch(function () { return null; }),
      api("/api/clientes").catch(function () { return null; })
    ]).then(function (r) {
      if (r[8] && Array.isArray(r[8].clientes)) S.clientes = r[8].clientes;
      if (r[7] && Array.isArray(r[7].ids)) S.publicos = r[7].ids;
      S.extras = { mei: r[4] && r[4].das_meses ? r[4] : null, imp: r[5] && r[5].conectada != null ? r[5] : null, selos: r[6] && r[6].por_status ? r[6] : null };
      var st = r[0] || {};
      S.eventos = st.eventos || []; S.lancamentos = st.lancamentos || []; S.notas = st.notas || []; S.params = st.params || {}; S.orcamentos = st.orcamentos || []; S.marketing = st.marketing || [];
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
    try { localStorage.setItem(CACHE, JSON.stringify({ v: 1, em: Date.now(), eventos: S.eventos, lancamentos: S.lancamentos, notas: S.notas, params: S.params, prospec: S.prospec, leads: S.leads, clientes: S.clientes, pedidos: S.pedidos, marketing: S.marketing, publicos: S.publicos, uso: S.uso, teto: S.teto, buscas: S.buscas, extras: S.extras ? { mei: S.extras.mei, selos: S.extras.selos } : null })); } catch (e) {}
  }
  function lerCache() {
    var c = lerLS(CACHE, null);
    if (!c || c.v !== 1 || Date.now() - (c.em || 0) > 7 * 864e5) return false;
    ["eventos", "lancamentos", "notas", "params", "prospec", "leads", "clientes", "pedidos", "uso", "teto", "buscas", "extras", "marketing", "publicos"].forEach(function (k) { if (c[k] != null) S[k] = c[k]; });
    S.pronto = true;
    return true;
  }

  /* fila de gravação: uma por vez, sempre em cima do que está no servidor agora */
  var gravando = Promise.resolve();
  function gravarTabela(nome, transforma) {
    gravando = gravando.then(function () {
      var ler = nome === "leads" ? api("/api/leads").then(function (d) { return d.leads || []; })
        : nome === "clientes" ? api("/api/clientes").then(function (d) { return d.clientes || []; })
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
    (S.marketing || []).forEach(function (p) {
      if (p.status !== "aprovado" || !p.data || p.data > h) return;
      out.push({
        k: "post:" + p.id, tipo: "post", rot: "Post", ordem: 2.8, data: p.data, hora: p.hora || "",
        titulo: "Publicar: " + (p.titulo || "post"), sub: [p.formato, p.rede, p.hora].filter(Boolean).join(", "), quando: p.data < h ? quandoRel(p.data) : (p.hora || "hoje"),
        dir: { rot: "Publiquei", fn: function () { postPublicado(p, true); } },
        esq: { rot: "Amanhã", fn: function () { adiarCartao("post:" + p.id); } },
        abre: function () { folhaPost(p); }
      });
    });
    out = out.concat(avisosDoSistema(), itensClientes()).filter(function (i) { return !adiado(i.k); });
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
  var vista = lerLS("maratu.painel.vista", "hoje"), filtro = "tudo", lojaMesDesloc = 0, diaSel = hoje(), verAtendidos = false;
  var ORDEM_VISTAS = ["hoje", "sites", "financas", "agenda", "oficina", "divulgacao", "ajustes"], NA_BARRA = ["hoje", "sites", "financas", "agenda"];
  if (vista === "loja") vista = "financas";
  if (ORDEM_VISTAS.indexOf(vista) < 0) vista = "hoje";

  function render(semAnim, direcao) {
    if (!S.pronto) return;
    var wk = document.querySelector(".wk-corpo"), wkTop = wk ? wk.scrollTop : null;
    var html = vista === "sites" ? telaSites() : vista === "financas" ? telaFinancas() : vista === "agenda" ? telaAgenda() : vista === "oficina" ? telaOficina() : vista === "divulgacao" ? telaDivulgacaoArea() : vista === "ajustes" ? telaAjustes() : telaHoje();
    var main = $("tela");
    main.innerHTML = '<div class="vista' + (semAnim ? "" : direcao === "esq" ? " entra-esq" : " entra-dir") + '">' + html + "</div>";
    ligar(main); ligarArea(main);
    var abaOn = main.querySelector('.abas [aria-pressed="true"]'); if (abaOn && abaOn.parentNode.scrollWidth > abaOn.parentNode.clientWidth) abaOn.parentNode.scrollLeft = abaOn.offsetLeft - 12;
    var wk2 = main.querySelector(".wk-corpo");
    if (wk2) wk2.scrollTop = wkTop != null ? wkTop : Math.max(0, (new Date().getHours() - HORA_INI - 1) * SLOT);
    dicaArrastar(main);
    var n = itensHoje().length;
    document.querySelectorAll('[data-v="hoje"]').forEach(function (b) { b.setAttribute("data-n", String(n)); });
    var cont = document.querySelector('.lateral [data-v="hoje"] .cont'); if (cont) cont.textContent = n;
    document.querySelectorAll(".barra [data-v], .lateral [data-v]").forEach(function (b) { if (b.dataset.v === vista) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $("btMais").setAttribute("aria-pressed", String(NA_BARRA.indexOf(vista) < 0));
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
    if (!grande) return '<button class="cartao mes mini" data-ir="financas">' +
      '<div class="mini-mes"><b style="font-size:15px;">' + cap(r.mes) + '</b><div class="barra-meta"><i style="width:' + pct.toFixed(1) + '%"></i></div><span class="valor" style="font-size:14px;">' + brlCurtoV(r.total) + "</span></div>" +
      '<div class="rodape"><span>' + (r.meta ? "Meta " + brlCurtoV(r.meta) : "Sem meta") + "</span><span>" + (oculto() ? "" : compTxt(r)) + "</span></div></button>";
    var olho = '<button class="ico-bt olho" data-olho aria-label="' + (oculto() ? "Mostrar valores" : "Esconder valores") + '" aria-pressed="' + oculto() + '">' + (oculto() ? IC.olhoFechado : IC.olho) + "</button>";
    return '<div class="cartao mes"><div class="topo-mes"><span class="grande">' + brlCurtoV(r.total) + '</span><span class="comp ' + (!r.ant || oculto() ? "" : r.total >= r.ant ? "sobe" : "desce") + '">' + (oculto() ? "" : compTxt(r)) + "</span>" + olho + "</div>" +
      '<div class="barra-meta"><i style="width:' + pct.toFixed(1) + '%"></i></div><div class="rodape"><span>' + cap(r.mes) + "</span><span>" + (r.meta ? (oculto() ? "Meta " + brlCurtoV(r.meta) : Math.round(pct) + "% de " + brlCurto(r.meta)) : "Sem meta") + "</span></div></div>";
  }

  function telaHoje() {
    var itens = itensHoje(), h = hoje();
    var cont = { site: 0, lead: 0, carne: 0, agenda: 0, loja: 0, nota: 0, post: 0, aviso: 0 };
    itens.forEach(function (i) { cont[i.tipo]++; });
    if (filtro !== "tudo" && !cont[filtro]) filtro = "tudo";
    var vis = filtro === "tudo" ? itens : itens.filter(function (i) { return i.tipo === filtro; });
    var NOMES = [["site", "Sites"], ["lead", "Leads"], ["carne", "Cobranças"], ["agenda", "Agenda"], ["loja", "Pedidos"], ["post", "Posts"], ["nota", "Lembretes"], ["aviso", "Avisos"]];
    var hora = new Date().getHours(), oi = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    var f = feitosHoje(), total = f.n + itens.length;
    var prog = total && f.n ? '<div class="progresso-dia"><div class="barra-meta"><i style="width:' + (f.n / total * 100).toFixed(1) + '%"></i></div><span>' + f.n + " de " + total + (total === 1 ? " feito" : " feitos") + "</span></div>" : "";
    var a = '<div class="cab"><h1>' + (itens.length ? itens.length + " pra hoje" : oi) + "</h1><p>" + dataLonga(h) + "</p></div>" + prog + faixaImpressora() +
      (itens.length > 1 ? '<div class="filtros">' + '<button class="chip-bt" data-filtro="tudo" aria-pressed="' + (filtro === "tudo") + '">Tudo</button>' +
        NOMES.filter(function (n) { return cont[n[0]]; }).map(function (n) { return '<button class="chip-bt" data-filtro="' + n[0] + '" aria-pressed="' + (filtro === n[0]) + '">' + n[1] + ' <span class="n">' + cont[n[0]] + "</span></button>"; }).join("") + "</div>" : "") +
      (vis.length ? '<div class="fila">' + vis.map(cartaHTML).join("") + "</div>" :
        (f.n ? diaFechado(f) : ""));
    var doDia = itensDoDia(h);
    agendaItens = doDia;
    var amanha = !vis.length ? hojeAmanha() : "";
    if (!pc()) return a + amanha + cartaoMes(false) + hojeAgenda(doDia, true) + hojeSinais();
    var b = '<div class="secao" style="margin-top:6px;">' + cap(MESES[new Date().getMonth()]) + '<button class="bt-link" data-ir="financas">Finanças</button></div>' + cartaoMes(true) +
      hojeAgenda(doDia, false) + hojeSinais();
    return colunas(a + amanha, b);
  }
  /* agenda do dia: no celular só aparece quando tem algo marcado */
  function hojeAgenda(doDia, soSeTem) {
    if (soSeTem && !doDia.length) return "";
    return '<div class="secao">Agenda de hoje<button class="bt-link" data-ir="agenda">Agenda</button></div>' +
      (doDia.length ? '<div class="cartao lista">' + doDia.map(function (x, idx) {
        return '<div class="linha toca" data-item="' + idx + '"' + (x.feito ? ' style="opacity:.55"' : "") + '><span class="hora-pc">' + esc(x.hora || "dia") + '</span><div class="o"><b>' + esc(x.tit) + "</b>" + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + '</div><span class="tipo t-' + x.tipo + '">' + esc(x.rot) + "</span></div>";
      }).join("") + "</div>" : '<p class="vazio">Nada marcado.</p>');
  }
  /* quem abriu o site de amostra nos últimos dois dias: hora boa pra puxar conversa */
  function hojeSinais() {
    var lim = Date.now() - 2 * 864e5;
    var quentes = S.prospec.filter(function (p) { var t = Date.parse(p.ex_ultima || ""); return !isNaN(t) && t >= lim; }).sort(function (a, b) { return String(b.ex_ultima) < String(a.ex_ultima) ? -1 : 1; });
    var novos = S.leads.filter(function (l) { return l.status === "novo"; });
    if (!quentes.length && !novos.length) return "";
    return '<div class="secao">Sinais</div><div class="cartao lista">' +
      quentes.slice(0, 5).map(function (p) { var t = new Date(p.ex_ultima); return '<div class="linha toca" data-site="' + esc(p.id) + '"><span class="tipo t-site">Abriu</span><div class="o"><b>' + esc(p.nome) + "</b><small>" + (Number(p.ex_vistas) || 0) + "x, a última " + quandoRel(isoDe(t)) + " " + pad2(t.getHours()) + ":" + pad2(t.getMinutes()) + "</small></div>" + IC.seta + "</div>"; }).join("") +
      (novos.length ? '<div class="linha toca" data-aba="sites:conversas"><span class="tipo t-lead">Leads</span><div class="o"><b>' + novos.length + (novos.length === 1 ? " lead novo" : " leads novos") + "</b><small>" + esc(novos.slice(0, 3).map(function (l) { return l.nome; }).join(", ")) + "</small></div>" + IC.seta + "</div>" : "") + "</div>";
  }
  /* fila vazia: mostra o que vem amanhã */
  function hojeAmanha() {
    var am = somaDias(hoje(), 1), ag = itensDoDia(am).filter(function (x) { return !x.feito; });
    var sites = prospecGrupos().depois.filter(function (p) { return p.proximo === am; }).length;
    var leads = S.leads.filter(function (l) { return l.followup === am && l.status !== "fechado" && l.status !== "perdido"; }).length;
    var partes = [];
    if (ag.length) partes.push(ag.length + (ag.length === 1 ? " na agenda" : " na agenda"));
    if (sites) partes.push(sites + (sites === 1 ? " site pra mandar" : " sites pra mandar"));
    if (leads) partes.push(leads + (leads === 1 ? " lead pra responder" : " leads pra responder"));
    return '<button class="cartao amanha toca" data-dia-ag="' + am + '"><span class="tipo t-agenda">Amanhã</span><div class="o"><b>' + (partes.length ? cap(partes.join(", ")) : "Nada marcado") + "</b>" +
      (ag.length ? "<small>" + esc(ag.slice(0, 3).map(function (x) { return (x.hora ? x.hora + " " : "") + x.tit; }).join(", ")) + "</small>" : "") + "</div>" + IC.seta + "</button>";
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

  /* metas do plano de venda: 30 contatos por semana, 4 sites fechados por mês */
  var META_CONTATOS = 30, META_SITES = 4;
  function metasSites() {
    var h = hoje(), seg = somaDias(h, -((dataDe(h).getDay() + 6) % 7)), env = 0, mes = h.slice(0, 7);
    S.prospec.forEach(function (p) { try { JSON.parse(p.historico || "[]").forEach(function (x) { if (x.acao === "enviei" && diaLocal(x.ts) >= seg) env++; }); } catch (e) {} });
    var comCli = {}, fechados = 0, mp = metasParam();
    clientes().forEach(function (c) { if (c.lead_id) comCli[c.lead_id] = 1; if (String(c.fechado_em || "").slice(0, 7) === mes) fechados++; });
    fechados += S.leads.filter(function (l) { return !comCli[l.id] && l.status === "fechado" && /site|p[aá]gina|painel|portf/i.test(l.interesse || "") && String(l.followup || "").slice(0, 7) === mes; }).length;
    var meta = function (n, alvo, txt) { return '<div class="cartao meta"><div class="meta-num"><b>' + n + "</b><span>de " + alvo + " " + txt + '</span></div><div class="barra-meta"><i style="width:' + Math.min(100, n / alvo * 100).toFixed(1) + '%"></i></div></div>'; };
    return '<div class="metas">' + meta(env, mp.contatos, "contatos na semana") + meta(fechados, mp.sites, "sites fechados no mês") + "</div>";
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
      resumo + filtros + '<button class="bt-link" data-buscaent style="justify-self:start;color:var(--tinta-sobre-tela);">Buscar entradas no banco agora</button>' +
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
  function lojaCarne(semNums) {
    var carnes = {};
    eventosVivos().forEach(function (e) { if (e.tipo !== "cobranca") return; var p = kv(e.notas); var id = p.carne || e.cliente || e.id; (carnes[id] = carnes[id] || []).push(e); });
    var ids = Object.keys(carnes);
    var aberto = function (id) { return carnes[id].some(function (e) { return !e.feito; }); };
    ids.sort(function (a, b) { var x = aberto(a), y = aberto(b); if (x !== y) return x ? -1 : 1; return proxVenc(carnes[a]) < proxVenc(carnes[b]) ? -1 : 1; });
    var falta = 0; ids.forEach(function (id) { carnes[id].forEach(function (e) { if (!e.feito) falta += num(kv(e.notas).valor); }); });
    return (semNums ? "" : '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + brlCurtoV(falta) + '</b><span>a receber</span></div><div class="num"><b>' + ids.filter(aberto).length + "</b><span>carnês abertos</span></div></div>") +
      (ids.length ? '<div class="cartao lista">' + ids.map(function (id) {
        var evs = carnes[id].slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }), pagas = evs.filter(function (e) { return e.feito; }).length;
        var prox = evs.filter(function (e) { return !e.feito; })[0], p0 = kv(evs[0].notas);
        var atras = prox && prox.data < hoje();
        return '<div class="linha toca" data-carne="' + esc(id) + '"' + (!prox ? ' style="opacity:.6"' : "") + '><div class="o"><b>' + esc(evs[0].cliente || "Cliente") + (p0.prod ? " · " + esc(p0.prod) : "") + "</b><small" + (atras ? ' style="color:var(--c-site);font-weight:900"' : "") + ">" + pagas + " de " + evs.length + " pagas" + (prox ? ", " + (atras ? "atrasada desde " : "próxima ") + dm(prox.data) + " " + brlCurtoV(num(kv(prox.notas).valor)) : ", quitado") + "</small></div>" + IC.seta + "</div>";
      }).join("") + "</div>" : '<p class="vazio">Nenhum carnê.</p>');
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
      return colunas(titulo + dia, '<div class="cartao">' + navMes(ym, "data-agm") + gradeMes(ym) + "</div>" + listaLembretes());
    }
    var semana = "";
    for (var i = 0; i < 7; i++) {
      var d = somaDias(seg, i), tem = itensDoDia(d).some(function (x) { return !x.feito; });
      semana += '<button data-dia="' + d + '" aria-pressed="' + (d === diaSel) + '" class="' + (tem ? "tem " : "") + (d === h ? "hoje" : "") + classeMarca(mk[d]) + '"><small>' + SEM3[dataDe(d).getDay()] + "</small><b>" + dataDe(d).getDate() + "</b><i></i></button>";
    }
    return titulo + '<div class="semana" id="semana">' + semana + "</div>" + dia + listaLembretes();
  }
  var agendaItens = [];

  /* ---------- ligações da tela ---------- */
  function porId(arr, id, campo) { campo = campo || "id"; return arr.filter(function (x) { return String(x[campo]) === String(id); })[0]; }
  function ligar(raiz) {
    raiz.querySelectorAll(".slot").forEach(function (s) { arrastavel(s, itensAtuais[s.dataset.k]); });
    raiz.querySelectorAll("[data-filtro]").forEach(function (b) { b.onclick = function () { filtro = b.dataset.filtro; render(true); }; });
    raiz.querySelectorAll("[data-ir]").forEach(function (b) { b.onclick = function () { irPara(b.dataset.ir); }; });
    raiz.querySelectorAll("[data-rola]").forEach(function (b) { b.onclick = function () { var alvo = $(b.dataset.rola); if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" }); }; });
    raiz.querySelectorAll("[data-dia-ag]").forEach(function (b) { b.onclick = function () { diaSel = b.dataset.diaAg; agendaMes = null; irPara("agenda"); }; });
    raiz.querySelectorAll("[data-relatorio]").forEach(function (b) { b.onclick = folhaRelatorio; });
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
    raiz.querySelectorAll("[data-buscaent]").forEach(function (b) { b.onclick = function () { buscarEntradas(b); }; });
    raiz.querySelectorAll("[data-nota]").forEach(function (b) { b.onclick = function () { var n = porId(S.notas, b.dataset.nota); if (n) folhaNota(n); }; });
    raiz.querySelectorAll("[data-fonte]").forEach(function (b) { b.onclick = function () { lojaFonte = b.dataset.fonte; render(true); }; });
    if (vista === "agenda" && pc() && agendaModo === "semana") ligarSemana(raiz);
    if (vista === "oficina" && abaDe("oficina") === "pecas") ligarProdutos(raiz);
    raiz.querySelectorAll("[data-impfolha]").forEach(function (x) { x.onclick = function (ev) { ev.preventDefault(); folhaImpressora(); }; });
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
      (l.status !== "perdido" && !clientes().some(function (c) { return c.lead_id === l.id; }) ? '<button class="bt verde cheio" id="lCli">' + IC.check + "Virou cliente</button>" : "") +
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
        var vc = c.querySelector("#lCli");
        if (vc) vc.onclick = function () {
          fecharFolha();
          if (l.status !== "fechado") { var m = { status: "fechado", followup: hoje() }; Object.assign(l, m); gravarTabela("leads", function (a) { return trocaItem(a, l.id, m); }); }
          folhaCliente(null, { nome: l.nome, contato: l.contato, tipo: tipoDoInteresse(l.interesse), lead_id: l.id, notas: l.notas || null });
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
      '<label class="marcar"><input type="checkbox" id="ePub"' + (ehPublico(e) ? " checked" : "") + "> Agenda pública</label>";
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
          marcarPublico(e, m.publico);
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
            function () { gravarTabela("eventos", function (a) { return a.filter(function (x) { return x.id !== e.id; }); }); if (ehPublico(e)) marcarPublico(e, false); });
        });
      });
  }

  /* --- lembrete --- */
  function folhaNota(n) {
    abrirFolha("Lembrete",
      campo("O quê", '<input id="nTit" value="' + esc(n.titulo || "") + '" autocomplete="off">') +
      campo("Detalhe", '<textarea id="nDet">' + esc(n.detalhe || "") + "</textarea>") +
      campo("Categoria", '<input id="nCat" value="' + esc(n.categoria || "") + '" autocomplete="off" list="nCats"><datalist id="nCats">' + categoriasNotas().map(function (x) { return '<option value="' + esc(x) + '">'; }).join("") + "</datalist>") +
      '<div class="duas">' + campo("Dia", '<input id="nData" type="date" value="' + esc(n.data || "") + '">') + campo("Hora", '<input id="nHora" type="time" value="' + esc(n.hora || "") + '">') + "</div>" +
      '<button class="bt cheio perigo" id="nApaga">Apagar</button>' +
      '<div class="fixo grade-bts"><button class="bt acento" id="nSalva">Salvar</button><button class="bt' + (n.feito ? "" : " verde") + '" id="nFeito">' + (n.feito ? "Reabrir" : IC.check + "Feito") + "</button></div>",
      function (c) {
        c.querySelector("#nSalva").onclick = function () {
          var m = { titulo: c.querySelector("#nTit").value.trim(), detalhe: c.querySelector("#nDet").value.trim() || null, categoria: c.querySelector("#nCat").value.trim() || null, data: c.querySelector("#nData").value || null, hora: c.querySelector("#nHora").value || null };
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
      (p.status === "aberto" ? '<div class="grade-bts"><button class="bt verde" data-st="atendido">' + IC.check + 'Atendido</button><button class="bt" data-st="cancelado">Cancelar</button></div>' : '<button class="bt cheio" data-st="aberto">Reabrir</button>') +
      '<button class="bt cheio perigo" id="pedApaga">Apagar pedido</button>',
      function (c) {
        c.querySelectorAll("[data-st]").forEach(function (b) {
          b.onclick = function () {
            var st = b.dataset.st; fecharFolha();
            if (st === "aberto" && !porId(S.pedidos, p.codigo, "codigo")) S.pedidos.push(p);
            pedidoStatus(p, st);
          };
        });
        confirmaDuplo(c.querySelector("#pedApaga"), "Toque de novo pra apagar", function () {
          api("/api/pedidos/apagar", { method: "POST", body: { codigo: p.codigo } }).then(function () {
            S.pedidos = S.pedidos.filter(function (x) { return x.codigo !== p.codigo; }); if (S.pedidosTodos) S.pedidosTodos = S.pedidosTodos.filter(function (x) { return x.codigo !== p.codigo; });
            guardaCache(); fecharFolha(); render(true); aviso("Pedido apagado");
          }).catch(function () { aviso("Não apagou. Confira a internet."); });
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
  var TIPOS_LANCAR = [["entrada", "Entrada", IC.entrada], ["evento", "Evento", IC.evento], ["lead", "Lead", IC.lead], ["carne", "Carnê", IC.carne], ["nota", "Lembrete", IC.nota], ["orcamento", "Orçamento", IC.calc], ["post", "Post", IC.post]];
  function folhaLancar(tipo, dia, hora) {
    tipo = tipo || lerLS("maratu.painel.lancar", "entrada");
    if (tipo === "selos") tipo = "entrada";
    $("btLancar").setAttribute("aria-expanded", "true");
    abrirFolha("Lançar",
      '<div class="tipos">' + TIPOS_LANCAR.map(function (t) { return '<button type="button" data-tl="' + t[0] + '" aria-pressed="' + (t[0] === tipo) + '">' + t[2] + t[1] + "</button>"; }).join("") + "</div>" +
      '<div id="lForm" style="display:grid;gap:12px;"></div>',
      function (c) {
        var orc = null;
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
          else if (t === "orcamento") f.innerHTML = formOrcamento();
          else if (t === "post") f.innerHTML = formPost(null) + '<div class="fixo"><button class="bt acento cheio" id="xOk">Criar post</button></div>';
          else f.innerHTML = campo("O quê", '<input id="nTit" autocomplete="off">') + campo("Detalhe", '<textarea id="nDet"></textarea>') + '<div class="duas">' + campo("Dia", '<input id="nData" type="date" value="' + hoje() + '">') + campo("Hora", '<input id="nHora" type="time">') + "</div>" + '<div class="fixo"><button class="bt acento cheio" id="xOk">Criar lembrete</button></div>';
          ligaPilulas(f);
          if (t === "evento") ligaQuando(f);
          if (t === "orcamento") orc = ligaOrcamento(f);
          if (t === "carne") {
            var prev = function () { var tot = num(f.querySelector("#cTot").value), n = Math.max(1, parseInt(f.querySelector("#cN").value, 10) || 1); f.querySelector("#cPrev").textContent = tot ? n + "x de " + brl(Math.floor(tot / n * 100) / 100) : ""; };
            f.querySelector("#cTot").addEventListener("input", prev); f.querySelector("#cN").addEventListener("input", prev);
          }
          f.querySelector("#xOk").onclick = function () { if (t === "orcamento") orc.lancar(); else salvarLancamento(t, f); };
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
      if (m.publico) marcarPublico(e, true);
    } else if (t === "post") {
      var mp = lerPost(f, null); if (!mp.titulo) return q("#poTit").focus();
      var po = Object.assign({ id: uid("p"), criado: new Date().toISOString() }, mp);
      S.marketing = [po].concat(S.marketing || []); fecharFolha(); render(true); aviso(po.data ? "Post programado pra " + dm(po.data) : "Ideia guardada");
      gravarTabela("marketing", function (a) { return [po].concat(a); });
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

  /* ---------- Produtos do site ---------- */
  var PROD = { lista: null, layout: null, carregando: false, busca: "", marca: "todas", faixa: "todas", ordenando: false };
  var FAIXA_NOME = { chaveiros: "Chaveiros", adesivos: "Adesivos", blusas: "Blusas", posteres: "Pôsteres", essenciais: "Essenciais", decor: "Decor" };
  var COLECOES = [["origens", "Origens"], ["manguehaus", "Manguehaus"], ["kit", "Kit"]];
  var FLAGS = [["ativo", "Ativo"], ["novo", "Novo"], ["prevenda", "Pré-venda"], ["indisponivel", "Indisponível"], ["oculto", "Sem destaque"]];
  var TAM_POSTER = ["A4", "A3", "A2", "A1"];
  function nomeFaixa(f) { return FAIXA_NOME[f] || cap(String(f || "")); }
  function imgUrl(k, v) { return k ? API + "/img/" + String(k).split("/").map(encodeURIComponent).join("/") + (v ? "?" + v + "=1" : "") : ""; }
  function carregarProdutos(forcar) {
    if (PROD.carregando || (PROD.lista && !forcar)) return Promise.resolve();
    PROD.carregando = true;
    PROD.erro = false;
    return api("/api/catalog/all").then(function (d) { PROD.lista = d.produtos || []; PROD.layout = d.layout || null; })
      .catch(function () { PROD.erro = true; })
      .then(function () { PROD.carregando = false; if (vista === "oficina" && abaDe("oficina") === "pecas") render(true); });
  }
  function faixasDe(lista) {
    var vistas = {}; lista.forEach(function (p) { vistas[p.subcategoria] = 1; });
    return Object.keys(Object.assign({ chaveiros: 1, adesivos: 1, blusas: 1, posteres: 1, essenciais: 1 }, vistas));
  }
  function produtosVisiveis() {
    var q = norm(PROD.busca).trim();
    return (PROD.lista || []).filter(function (p) {
      if (PROD.marca !== "todas" && p.marca !== PROD.marca) return false;
      if (PROD.faixa !== "todas" && p.subcategoria !== PROD.faixa) return false;
      return !q || norm([p.nome, p.subtitulo, p.id, p.subcategoria].join(" ")).indexOf(q) >= 0;
    }).sort(function (a, b) { return (a.marca + a.subcategoria).localeCompare(b.marca + b.subcategoria) || (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome); });
  }
  function lojaProdutos() {
    if (!PROD.lista) {
      if (PROD.erro) return '<div class="cartao"><h3 style="margin:0 0 8px;font-weight:900;">Os produtos não carregaram</h3><button class="bt preto" data-prodtenta>Tentar de novo</button></div>';
      carregarProdutos(); return '<div class="esqueleto"></div><div class="esqueleto"></div>';
    }
    var lista = PROD.lista, faixas = faixasDe(lista), vis = produtosVisiveis();
    var cont = {}; lista.forEach(function (p) { if (PROD.marca === "todas" || p.marca === PROD.marca) cont[p.subcategoria] = (cont[p.subcategoria] || 0) + 1; });
    var topo = '<div class="prod-topo"><div class="campo prod-busca"><input id="prodBusca" type="search" placeholder="Buscar peça" value="' + esc(PROD.busca) + '" autocomplete="off"></div>' +
      '<button class="bt acento" data-prodnovo>' + IC.mais + "Peça nova</button></div>" +
      '<div class="filtros">' + [["todas", "Todas"], ["use", "USE"], ["casa", "CASA"]].map(function (m) { return '<button class="chip-bt" data-pmarca="' + m[0] + '" aria-pressed="' + (PROD.marca === m[0]) + '">' + m[1] + "</button>"; }).join("") +
      '<span class="sep-filtro"></span><button class="chip-bt" data-pfaixa="todas" aria-pressed="' + (PROD.faixa === "todas") + '">Todas as faixas</button>' +
      faixas.filter(function (f) { return cont[f]; }).map(function (f) { return '<button class="chip-bt" data-pfaixa="' + esc(f) + '" aria-pressed="' + (PROD.faixa === f) + '">' + esc(nomeFaixa(f)) + ' <span class="n">' + cont[f] + "</span></button>"; }).join("") + "</div>";
    if (PROD.ordenando) return topo + telaOrdenar(vis);
    return topo +
      '<div class="prod-acoes"><button class="bt-link" data-faixas style="color:var(--tinta-sobre-tela);">Ordem das faixas</button>' +
      (PROD.faixa !== "todas" && vis.length > 1 && !PROD.busca ? '<button class="bt-link" data-ordenar style="justify-self:start;color:var(--tinta-sobre-tela);">Mudar a ordem de ' + esc(nomeFaixa(PROD.faixa)) + "</button>" : "") + "</div>" +
      (vis.length ? '<div class="prod-grade">' + vis.map(function (p) {
        var selos = [!p.ativo ? "Inativo" : "", p.prevenda ? "Pré-venda" : "", p.indisponivel ? "Indisponível" : "", p.oculto ? "Sem destaque" : "", p.novo ? "Novo" : ""].filter(Boolean);
        return '<button class="cartao prod' + (!p.ativo ? " inativo" : "") + '" data-prod="' + esc(p.id) + '"><span class="prod-img">' + (p.imagem_principal ? '<img loading="lazy" alt="" src="' + esc(imgUrl(p.imagem_principal, "t")) + '">' : "") + "</span>" +
          '<span class="prod-txt"><b>' + esc(p.nome) + "</b><small>" + esc(nomeFaixa(p.subcategoria)) + ", " + esc(String(p.marca || "").toUpperCase()) + '</small><span class="valor">' + brl(num(p.preco)) + "</span>" +
          (selos.length ? '<span class="prod-selos">' + selos.map(function (s) { return "<i>" + s + "</i>"; }).join("") + "</span>" : "") + "</span></button>";
      }).join("") + "</div>" : '<p class="vazio">Nenhuma peça com esse filtro.</p>');
  }
  /* ordem dentro da faixa, arrastando a linha */
  function telaOrdenar(vis) {
    return '<div class="cartao lista ordem-lista" id="ordemLista">' + vis.map(function (p) {
      return '<div class="linha ordem-item" data-oid="' + esc(p.id) + '"><span class="pega" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 6h8M8 12h8M8 18h8"/></svg></span>' +
        (p.imagem_principal ? '<img alt="" loading="lazy" decoding="async" src="' + esc(imgUrl(p.imagem_principal, "t")) + '">' : "") + '<div class="o"><b>' + esc(p.nome) + "</b></div></div>";
    }).join("") + '</div><div class="grade-bts"><button class="bt" data-ordemsai>Cancelar</button><button class="bt acento" data-ordemsalva>Salvar a ordem</button></div>';
  }
  function ligarOrdenar(raiz) {
    var box = raiz.querySelector("#ordemLista"); if (!box) return;
    box.querySelectorAll(".ordem-item .pega").forEach(function (alca) {
      var it = alca.parentNode;
      alca.addEventListener("pointerdown", function (ev) {
        if (ev.button !== 0) return;
        ev.preventDefault(); it.classList.add("pegando");
        var move = function (e) {
          var irmaos = Array.prototype.slice.call(box.querySelectorAll(".ordem-item")).filter(function (x) { return x !== it; });
          var depois = irmaos.filter(function (x) { var r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; })[0];
          if (depois) { if (it.nextSibling !== depois) box.insertBefore(it, depois); } else if (box.lastElementChild !== it) box.appendChild(it);
        };
        var solta = function () { it.classList.remove("pegando"); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", solta); window.removeEventListener("pointercancel", solta); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", solta); window.addEventListener("pointercancel", solta);
      });
    });
    raiz.querySelector("[data-ordemsai]").onclick = function () { PROD.ordenando = false; render(true); };
    raiz.querySelector("[data-ordemsalva]").onclick = function () {
      var ids = Array.prototype.map.call(box.querySelectorAll(".ordem-item"), function (x) { return x.dataset.oid; });
      api("/api/catalog/reorder", { method: "POST", body: { ids: ids } }).then(function () {
        ids.forEach(function (id, i) { var p = porId(PROD.lista, id); if (p) p.ordem = (i + 1) * 10; });
        PROD.ordenando = false; render(true); aviso("Ordem salva");
      }).catch(function () { aviso("Não salvou a ordem."); });
    };
  }
  function ligarProdutos(raiz) {
    var b = raiz.querySelector("#prodBusca");
    if (b) b.addEventListener("input", function () { PROD.busca = b.value; var pos = b.selectionStart; render(true); var n = $("prodBusca"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
    raiz.querySelectorAll("[data-pmarca]").forEach(function (x) { x.onclick = function () { PROD.marca = x.dataset.pmarca; render(true); }; });
    raiz.querySelectorAll("[data-pfaixa]").forEach(function (x) { x.onclick = function () { PROD.faixa = x.dataset.pfaixa; PROD.ordenando = false; render(true); }; });
    raiz.querySelectorAll("[data-prod]").forEach(function (x) { x.onclick = function () { var p = porId(PROD.lista, x.dataset.prod); if (p) folhaProduto(p); }; });
    raiz.querySelectorAll("[data-prodnovo]").forEach(function (x) { x.onclick = function () { folhaProduto(null); }; });
    raiz.querySelectorAll("[data-ordenar]").forEach(function (x) { x.onclick = function () { PROD.ordenando = true; render(true); }; });
    raiz.querySelectorAll("button[data-faixas]").forEach(function (x) { x.onclick = folhaFaixas; });
    raiz.querySelectorAll("[data-prodtenta]").forEach(function (x) { x.onclick = function () { PROD.erro = false; render(true); }; });
    ligarOrdenar(raiz);
  }

  /* --- fotos: o original sobe intacto; o navegador gera a miniatura limpa e a versão com marca d'água --- */
  var ESPEC_MARCA = { largura: 1400, qualidade: 0.82, texto: "maratu", corpo: 0.075, giro: -30, passoX: 2.30, passoY: 4.20, alfaClaro: 0.11, alfaEscuro: 0.09, desloca: 0.055, cantoTexto: "maratu.com.br", cantoCorpo: 0.021, cantoAlfa: 0.42, cantoMargem: 0.030 };
  var MINI = { largura: 1000, qualidade: 0.78 }, TETO_KB = { mini: 200, marca: 360 }, ESCADA_Q = [0.78, 0.68, 0.58, 0.48, 0.40];
  function ladrilhoMarca(ctx, w, h, e) {
    var corpo = Math.max(12, Math.round(w * e.corpo));
    ctx.save(); ctx.font = corpo + "px Jack"; ctx.textBaseline = "top";
    var passoX = Math.max(1, Math.round(ctx.measureText(e.texto).width * e.passoX)), passoY = Math.max(1, Math.round(corpo * e.passoY)), desl = Math.max(1, Math.round(corpo * e.desloca)), lado = Math.round((w + h) * 1.15);
    ctx.translate(w / 2, h / 2); ctx.rotate(-e.giro * Math.PI / 180); ctx.translate(-lado / 2, -lado / 2);
    for (var y = -passoY, linha = 0; y < lado + passoY; y += passoY, linha++) {
      for (var x = -passoX + (linha % 2 ? Math.floor(passoX / 2) : 0); x < lado + passoX; x += passoX) {
        ctx.fillStyle = "rgba(13,13,11," + e.alfaEscuro + ")"; ctx.fillText(e.texto, x + desl, y + desl);
        ctx.fillStyle = "rgba(255,255,255," + e.alfaClaro + ")"; ctx.fillText(e.texto, x, y);
      }
    }
    ctx.restore();
  }
  function cantoMarca(ctx, w, h, e) {
    var corpo = Math.max(9, Math.round(w * e.cantoCorpo));
    ctx.save(); ctx.font = "700 " + corpo + "px Clother"; ctx.textBaseline = "top";
    var margem = Math.round(w * e.cantoMargem), x = w - ctx.measureText(e.cantoTexto).width - margem, y = h - corpo - margem, desl = Math.max(1, Math.round(corpo * 0.09));
    ctx.fillStyle = "rgba(13,13,11," + (e.cantoAlfa * 0.7) + ")"; ctx.fillText(e.cantoTexto, x + desl, y + desl);
    ctx.fillStyle = "rgba(255,255,255," + e.cantoAlfa + ")"; ctx.fillText(e.cantoTexto, x, y);
    ctx.restore();
  }
  var _webpOk = null;
  function webpOk() { if (_webpOk === null) { try { var c = document.createElement("canvas"); c.width = c.height = 1; _webpOk = c.toDataURL("image/webp").indexOf("data:image/webp") === 0; } catch (e) { _webpOk = false; } } return _webpOk; }
  function codificar(canvas, tipo, q) { return new Promise(function (ok, falha) { canvas.toBlob(function (b) { b ? ok(b) : falha(new Error("toBlob vazio")); }, tipo, q); }); }
  function blobLeve(canvas, q, tetoKB) {
    var tipo = webpOk() ? "image/webp" : "image/jpeg";
    return codificar(canvas, tipo, q).then(function cabe(b, i) {
      i = i || 0;
      while (i < ESCADA_Q.length && ESCADA_Q[i] >= q) i++;
      if (b.size <= tetoKB * 1024 || i >= ESCADA_Q.length) return { blob: b, tipo: tipo };
      var qi = ESCADA_Q[i]; q = qi;
      return codificar(canvas, tipo, qi).then(function (b2) { return cabe(b2, i + 1); });
    });
  }
  function desenhar(bmp, largura) {
    var escala = Math.min(1, largura / bmp.width), w = Math.max(1, Math.round(bmp.width * escala)), h = Math.max(1, Math.round(bmp.height * escala));
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, w, h);
    return { canvas: c, ctx: ctx, w: w, h: h };
  }
  function subirArquivo(blob, slug, nome, variante, tipo) {
    var u = "/api/catalog/upload?slug=" + encodeURIComponent(slug) + "&filename=" + encodeURIComponent(nome) + (variante ? "&variant=" + variante : "");
    return fetch(API + u, { method: "POST", headers: { Authorization: "Bearer " + token(), "Content-Type": tipo || blob.type || "application/octet-stream" }, credentials: "include", body: blob })
      .then(function (r) { if (r.status === 401) { paraLogin(); throw new Error("sessão"); } if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function subirFoto(file, slug) {
    var base = Date.now().toString(36) + "-" + semAcento(file.name || "foto").toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    var ext = (/\.([a-z0-9]{3,4})$/i.exec(file.name || "") || [0, file.type === "image/png" ? "png" : "jpg"])[1].toLowerCase();
    var key;
    return subirArquivo(file, slug, base + "." + ext).then(function (d) {
      key = d.key;
      return createImageBitmap(file).then(function (bmp) {
        var m = desenhar(bmp, MINI.largura);
        return blobLeve(m.canvas, MINI.qualidade, TETO_KB.mini).then(function (mini) {
          return (document.fonts && document.fonts.load ? Promise.all([document.fonts.load("100px Jack"), document.fonts.load("700 20px Clother")]).catch(function () {}) : Promise.resolve()).then(function () {
            var g = desenhar(bmp, ESPEC_MARCA.largura); ladrilhoMarca(g.ctx, g.w, g.h, ESPEC_MARCA); cantoMarca(g.ctx, g.w, g.h, ESPEC_MARCA);
            return blobLeve(g.canvas, ESPEC_MARCA.qualidade, TETO_KB.marca).then(function (marca) {
              if (bmp.close) bmp.close();
              return Promise.all([subirArquivo(mini.blob, slug, base + ".webp", "thumb", mini.tipo), subirArquivo(marca.blob, slug, base + ".webp", "wm", marca.tipo)]);
            });
          });
        });
      }).catch(function (e) { console.warn("variantes da foto falharam", e); });
    }).then(function () { return key; });
  }

  /* --- folha da peça --- */
  function slugify(s) { return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
  function folhaProduto(p0) {
    var novo = !p0, p = p0 ? JSON.parse(JSON.stringify(p0)) : { marca: "use", subcategoria: PROD.faixa !== "todas" ? PROD.faixa : "chaveiros", ativo: true, colecoes: [], tamanhos: [], cores: [], precos_custom: null };
    var ficha = {}; try { ficha = typeof p.ficha === "string" ? JSON.parse(p.ficha || "{}") || {} : p.ficha || {}; } catch (e) { ficha = {}; }
    var galeria = []; try { galeria = typeof p.galeria === "string" ? JSON.parse(p.galeria || "[]") || [] : p.galeria || []; } catch (e) { galeria = []; }
    var rel = []; try { rel = typeof p.relacionados === "string" ? JSON.parse(p.relacionados || "[]") || [] : p.relacionados || []; } catch (e) { rel = []; }
    var faixas = faixasDe(PROD.lista || []), flags = FLAGS.filter(function (f) { return f[0] === "ativo" ? p.ativo !== false : !!p[f[0]]; }).map(function (f) { return f[0]; });
    var chavesAntes = [p.imagem_principal, p.imagem_hover].concat(galeria).concat((p.cores || []).map(function (c) { return c && c.img; })).filter(Boolean);
    var slot = function (k, rot, chave) { return '<div class="foto-slot' + (chave ? " tem" : "") + '" data-slot="' + k + '" data-key="' + esc(chave || "") + '"><label class="foto-img">' + (chave ? '<img alt="" src="' + esc(imgUrl(chave, "t")) + '">' : IC.mais) + '<input type="file" accept="image/*" hidden></label><small>' + rot + '</small><button type="button" class="foto-tira" aria-label="Tirar a foto"' + (chave ? "" : " hidden") + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'; };
    var corLinha = function (c) { c = c || {}; return '<div class="cor-linha" data-img="' + esc(c.img || "") + '"><input class="cor-hex" type="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(c.hex || "") ? c.hex : "#0d0d0b") + '"' + (c.hex ? "" : ' data-vazio="1"') + '><input class="cor-nome" value="' + esc(c.nome || "") + '" placeholder="Nome da cor" autocomplete="off"><label class="cor-foto' + (c.img ? " tem" : "") + '" title="Foto desta cor">' + (c.img ? '<img alt="" src="' + esc(imgUrl(c.img, "t")) + '">' : IC.entrada) + '<input type="file" accept="image/*" hidden></label><button type="button" class="ico-bt cor-tira" aria-label="Tirar a cor"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'; };
    var fichaLinha = function (k, v) { return '<div class="ficha-linha"><input class="f-k" maxlength="40" value="' + esc(k || "") + '" placeholder="Item" autocomplete="off"><input class="f-v" maxlength="80" value="' + esc(v || "") + '" placeholder="Detalhe" autocomplete="off"><button type="button" class="ico-bt f-tira" aria-label="Tirar a linha"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'; };
    var tamNome = function (e) { return e && typeof e === "object" ? String(e.t || "") : String(e); };
    var tamTexto = (p.tamanhos || []).map(tamNome).join(", ");
    var outros = (PROD.lista || []).filter(function (x) { return !p0 || x.id !== p0.id; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    var html =
      '<div class="rot">Fotos</div><div class="fotos">' + slot("principal", "Principal", p.imagem_principal) + slot("hover", "Segunda", p.imagem_hover) +
        [0, 1, 2, 3, 4, 5].map(function (i) { return slot("g" + i, i ? "" : "Galeria", galeria[i]); }).join("") + "</div>" +
      campo("Nome", '<input id="pNome" value="' + esc(p.nome || "") + '" autocomplete="off">') +
      campo("Subtítulo", '<input id="pSub" value="' + esc(p.subtitulo || "") + '" autocomplete="off">') +
      '<div class="duas">' + campo("Preço", '<input id="pPreco" inputmode="decimal" value="' + (p.preco != null ? esc(String(p.preco).replace(".", ",")) : "") + '" autocomplete="off">') + campo("Preço riscado", '<input id="pCheio" inputmode="decimal" value="' + (p.preco_cheio != null ? esc(String(p.preco_cheio).replace(".", ",")) : "") + '" autocomplete="off">') + "</div>" +
      '<div class="rot">Marca</div>' + pilulas("marca", [["use", "USE"], ["casa", "CASA"]], p.marca || "use") +
      '<div class="rot">Faixa da loja</div>' + pilulas("faixa", faixas.map(function (f) { return [f, nomeFaixa(f)]; }), p.subcategoria) +
      '<div class="poster" ' + (p.subcategoria === "posteres" ? "" : "hidden") + '><div class="rot">Preço por tamanho</div><div class="tam-precos">' + TAM_POSTER.map(function (t) { var v = p.precos_custom && p.precos_custom[t]; return campo(t, '<input data-tam="' + t + '" inputmode="decimal" value="' + (v != null ? esc(String(v).replace(".", ",")) : "") + '" autocomplete="off">'); }).join("") + "</div></div>" +
      '<div class="rot">Situação</div><div class="pilulas multi" data-multi="flags">' + FLAGS.map(function (f) { return '<button type="button" data-val="' + f[0] + '" aria-pressed="' + (flags.indexOf(f[0]) >= 0) + '">' + f[1] + "</button>"; }).join("") + "</div>" +
      '<div class="rot">Coleções</div><div class="pilulas multi" data-multi="col">' + COLECOES.concat((p.colecoes || []).filter(function (c) { return !COLECOES.some(function (x) { return x[0] === c; }); }).map(function (c) { return [c, cap(c)]; })).map(function (c) { return '<button type="button" data-val="' + esc(c[0]) + '" aria-pressed="' + ((p.colecoes || []).indexOf(c[0]) >= 0) + '">' + esc(c[1]) + "</button>"; }).join("") + "</div>" +
      campo("Tamanhos", '<input id="pTam" value="' + esc(tamTexto) + '" autocomplete="off">') +
      '<div class="rot">Cores</div><div id="pCores" class="cores-lista">' + (p.cores || []).map(corLinha).join("") + '</div><button type="button" class="bt-link" id="pCorMais">Adicionar cor</button>' +
      '<details class="pagina-peca"' + (p.descricao || Object.keys(ficha).length || rel.length ? " open" : "") + '><summary>Página da peça</summary>' +
        campo("Descrição", '<textarea id="pDesc" maxlength="2000">' + esc(p.descricao || "") + "</textarea>") +
        '<div class="rot">Ficha técnica</div><div id="pFicha">' + Object.keys(ficha).map(function (k) { return fichaLinha(k, ficha[k]); }).join("") + '</div><button type="button" class="bt-link" id="pFichaMais">Adicionar linha</button>' +
        '<div class="rot">MARATU recomenda (até 4)</div><div id="pRel" class="rel-lista">' + rel.map(function (id) { var x = porId(PROD.lista || [], id); return '<span class="rel" data-id="' + esc(id) + '">' + esc(x ? x.nome : id) + '<button type="button" aria-label="Tirar">×</button></span>'; }).join("") + "</div>" +
        '<div class="campo"><select id="pRelAdd"><option value="">Escolher peça…</option>' + outros.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.nome) + "</option>"; }).join("") + "</select></div>" +
        '<div class="duas">' + campo("Máximo por pedido", '<input id="pMax" type="number" min="1" max="99" inputmode="numeric" value="' + esc(p.qtd_max || "") + '">') + campo("Código no WhatsApp", '<input id="pSku" value="' + esc(p.sku_whatsapp && p.sku_whatsapp !== p.id ? p.sku_whatsapp : "") + '" inputmode="numeric" autocomplete="off">') + "</div>" +
      "</details>" +
      (novo ? "" : '<details class="pagina-peca" id="pCert"><summary>Certificado do selo</summary>' + campo("Dimensões", '<input id="pDim" autocomplete="off">') + campo("Texto de origem", '<textarea id="pOrig" maxlength="400"></textarea>') + "</details>") +
      (novo ? "" : '<div class="grade-bts"><a class="bt" href="https://maratu.com.br/produto/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">' + IC.fora + 'Ver na loja</a><button class="bt perigo" id="pApaga">Apagar peça</button></div>') +
      '<div class="fixo"><button class="bt acento cheio" id="pSalva">' + (novo ? "Criar peça" : "Salvar") + "</button></div>";
    abrirFolha(novo ? "Peça nova" : p.nome, html, function (c) {
      ligaPilulas(c);
      c.querySelectorAll("[data-multi] button").forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); }; });
      c.querySelector('[data-pil="faixa"]').addEventListener("click", function () { c.querySelector(".poster").hidden = pil(c, "faixa") !== "posteres"; });
      var subindo = 0, slugFotos = p.id || slugify(c.querySelector("#pNome").value) || "peca";
      var subir = function (file, aplica) {
        subindo++; $("pSalva").disabled = true; $("pSalva").textContent = "Subindo foto…";
        return subirFoto(file, p.id || slugify(c.querySelector("#pNome").value) || slugFotos).then(aplica).catch(function () { aplica(null); aviso("A foto não subiu. Tente de novo."); })
          .then(function () { subindo--; if (!subindo) { $("pSalva").disabled = false; $("pSalva").textContent = novo ? "Criar peça" : "Salvar"; } });
      };
      c.querySelectorAll(".foto-slot").forEach(function (s) {
        var inp = s.querySelector("input[type=file]");
        inp.addEventListener("change", function () {
          var f = inp.files && inp.files[0]; if (!f) return;
          var url = URL.createObjectURL(f), vez = (s._vez = (s._vez || 0) + 1);
          s.querySelector(".foto-img").innerHTML = '<img alt="" src="' + url + '"><span class="subindo"></span>'; s.querySelector(".foto-img").appendChild(inp);
          subir(f, function (key) {
            if (s._vez !== vez) return;
            var sp = s.querySelector(".subindo"); if (sp) sp.remove();
            if (key) { s.dataset.key = key; s.classList.add("tem"); s.querySelector(".foto-tira").hidden = false; }
            else { s.dataset.key = ""; s.classList.remove("tem"); s.querySelector(".foto-img").innerHTML = IC.mais; s.querySelector(".foto-img").appendChild(inp); inp.value = ""; }
          });
        });
        s.querySelector(".foto-tira").onclick = function () { s._vez = (s._vez || 0) + 1; s.dataset.key = ""; s.classList.remove("tem"); this.hidden = true; s.querySelector(".foto-img").innerHTML = IC.mais; s.querySelector(".foto-img").appendChild(inp); inp.value = ""; };
      });
      var ligaCor = function (row) {
        row.querySelector(".cor-tira").onclick = function () { row.remove(); };
        row.querySelector(".cor-hex").addEventListener("input", function () { delete this.dataset.vazio; });
        var inp = row.querySelector("input[type=file]");
        inp.addEventListener("change", function () {
          var f = inp.files && inp.files[0]; if (!f) return;
          var lab = row.querySelector(".cor-foto"); lab.innerHTML = '<img alt="" src="' + URL.createObjectURL(f) + '">'; lab.appendChild(inp); lab.classList.add("tem");
          subir(f, function (key) { if (key) row.dataset.img = key; });
        });
      };
      c.querySelectorAll(".cor-linha").forEach(ligaCor);
      c.querySelector("#pCorMais").onclick = function () { var d = document.createElement("div"); d.innerHTML = corLinha(null); var row = d.firstChild; c.querySelector("#pCores").appendChild(row); ligaCor(row); row.querySelector(".cor-nome").focus(); };
      var ligaFicha = function (row) { row.querySelector(".f-tira").onclick = function () { row.remove(); }; };
      c.querySelectorAll(".ficha-linha").forEach(ligaFicha);
      c.querySelector("#pFichaMais").onclick = function () { if (c.querySelectorAll(".ficha-linha").length >= 8) return; var d = document.createElement("div"); d.innerHTML = fichaLinha("", ""); var row = d.firstChild; c.querySelector("#pFicha").appendChild(row); ligaFicha(row); row.querySelector(".f-k").focus(); };
      var ligaRel = function (el) { el.querySelector("button").onclick = function () { el.remove(); }; };
      c.querySelectorAll(".rel").forEach(ligaRel);
      c.querySelector("#pRelAdd").addEventListener("change", function () {
        var id = this.value; this.value = ""; if (!id) return;
        var box = c.querySelector("#pRel"); if (box.children.length >= 4 || box.querySelector('[data-id="' + id + '"]')) return;
        var x = porId(PROD.lista || [], id), sp = document.createElement("span"); sp.className = "rel"; sp.dataset.id = id; sp.innerHTML = esc(x ? x.nome : id) + '<button type="button" aria-label="Tirar">×</button>'; box.appendChild(sp); ligaRel(sp);
      });
      if (!novo) carregaSelProdutos().then(function (lista) {
        var sp = porId(lista, p.id), d = c.querySelector("#pDim"), o = c.querySelector("#pOrig"); if (!d || !folhaAberta) return;
        d.value = sp && sp.dimensoes || ""; o.value = sp && sp.origem_texto || ""; d.dataset.antes = d.value; o.dataset.antes = o.value; d.dataset.carregado = "1";
        if (d.value || o.value) c.querySelector("#pCert").open = true;
      }).catch(function () {});
      var ap = c.querySelector("#pApaga");
      if (ap) confirmaDuplo(ap, "Toque de novo pra apagar", function () {
        api("/api/catalog/" + encodeURIComponent(p.id), { method: "DELETE" }).then(function () {
          PROD.lista = PROD.lista.filter(function (x) { return x.id !== p.id; }); fecharFolha(); render(true); aviso("Peça apagada");
        }).catch(function () { aviso("Não apagou. Confira a internet."); });
      });
      c.querySelector("#pSalva").onclick = function () {
        if (subindo) return;
        var q = function (s) { return c.querySelector(s); };
        var nome = q("#pNome").value.trim(); if (!nome) { q("#pNome").focus(); return; }
        var preco = num(q("#pPreco").value); if (!(preco > 0)) { q("#pPreco").focus(); aviso("Preço inválido"); return; }
        var principal = q('[data-slot="principal"]').dataset.key; if (!principal) { aviso("Falta a foto principal"); return; }
        var multi = function (k) { return Array.prototype.map.call(c.querySelectorAll('[data-multi="' + k + '"] [aria-pressed="true"]'), function (b) { return b.dataset.val; }); };
        var fl = multi("flags"), faixa = pil(c, "faixa") || p.subcategoria, pc = {};
        if (faixa === "posteres") c.querySelectorAll("[data-tam]").forEach(function (i) { if (i.value.trim() && num(i.value) > 0) pc[i.dataset.tam] = num(i.value); });
        var fic = {}; c.querySelectorAll(".ficha-linha").forEach(function (r) { var k = r.querySelector(".f-k").value.trim(), v = r.querySelector(".f-v").value.trim(); if (k && v) fic[k] = v; });
        var id = p.id || slugify(nome);
        if (novo && (PROD.lista || []).some(function (x) { return x.id === id; })) id = id + "-" + Date.now().toString(36).slice(-4);
        var corpo = {
          id: id, nome: nome, subtitulo: q("#pSub").value.trim() || null, marca: pil(c, "marca") || "use", subcategoria: faixa,
          preco: preco, preco_cheio: q("#pCheio").value.trim() ? num(q("#pCheio").value) : null,
          sku_whatsapp: q("#pSku").value.trim() || (novo ? id : (p.sku_whatsapp || id)),
          imagem_principal: principal, imagem_hover: q('[data-slot="hover"]').dataset.key || null,
          colecoes: multi("col"), tamanhos: (function () {
            var txt = q("#pTam").value;
            if (txt.trim() === tamTexto.trim()) return p.tamanhos || [];
            var orig = p.tamanhos || [], objetos = orig.some(function (e) { return e && typeof e === "object"; });
            return txt.split(",").map(function (s) { return s.trim(); }).filter(Boolean).map(function (n) {
              var velho = orig.filter(function (e) { return tamNome(e) === n; })[0];
              return velho !== undefined ? velho : objetos ? { t: n } : n;
            });
          })(),
          cores: Array.prototype.map.call(c.querySelectorAll(".cor-linha"), function (r) { var n = r.querySelector(".cor-nome").value.trim(), hx = r.querySelector(".cor-hex"); return { nome: n, hex: hx.dataset.vazio ? "" : hx.value, img: r.dataset.img || "" }; }).filter(function (x) { return x.nome || x.img; }).map(function (x) { var o = { nome: x.nome }; if (x.hex) o.hex = x.hex; if (x.img) o.img = x.img; return o; }),
          precos_custom: Object.keys(pc).length ? pc : null, ordem: p.ordem || 0,
          ativo: fl.indexOf("ativo") >= 0, novo: fl.indexOf("novo") >= 0, prevenda: fl.indexOf("prevenda") >= 0, indisponivel: fl.indexOf("indisponivel") >= 0, oculto: fl.indexOf("oculto") >= 0,
          descricao: q("#pDesc").value.trim() || null, ficha: Object.keys(fic).length ? fic : null,
          galeria: [0, 1, 2, 3, 4, 5].map(function (i) { return q('[data-slot="g' + i + '"]').dataset.key; }).filter(Boolean),
          relacionados: Array.prototype.map.call(c.querySelectorAll("#pRel .rel"), function (x) { return x.dataset.id; }),
          qtd_max: q("#pMax").value ? Number(q("#pMax").value) : null
        };
        var bt = this; bt.disabled = true; bt.textContent = "Salvando…";
        (novo ? api("/api/catalog", { method: "POST", body: corpo }) : api("/api/catalog/" + encodeURIComponent(p.id), { method: "PUT", body: corpo })).then(function () {
          var agora = [corpo.imagem_principal, corpo.imagem_hover].concat(corpo.galeria).concat(corpo.cores.map(function (x) { return x.img; })).filter(Boolean);
          var soltas = chavesAntes.filter(function (k) { return agora.indexOf(k) < 0; });
          if (soltas.length) api("/api/img/apagar", { method: "POST", body: { chaves: soltas } }).catch(function () {});
          var salvo = Object.assign({}, p0 || {}, corpo, { ficha: corpo.ficha ? JSON.stringify(corpo.ficha) : null, galeria: corpo.galeria.length ? JSON.stringify(corpo.galeria) : null, relacionados: corpo.relacionados.length ? JSON.stringify(corpo.relacionados) : null });
          if (novo) PROD.lista.push(salvo); else PROD.lista = PROD.lista.map(function (x) { return x.id === p.id ? salvo : x; });
          var dimV = c.querySelector("#pDim"), orgV = c.querySelector("#pOrig");
          if (dimV && dimV.dataset.carregado && (dimV.value.trim() !== dimV.dataset.antes || orgV.value.trim() !== orgV.dataset.antes)) {
            api("/api/selos/produto", { method: "POST", body: { sku: corpo.id, dimensoes: dimV.value.trim() || null, origem_texto: orgV.value.trim() || null } })
              .then(function () { SEL.produtos = null; }).catch(function () { aviso("O certificado não salvou"); });
          }
          fecharFolha(); render(true); aviso(novo ? "Peça criada" : "Peça salva");
        }).catch(function (e) {
          bt.disabled = false; bt.textContent = novo ? "Criar peça" : "Salvar";
          aviso("Não salvou: " + (/HTTP 400/.test(String(e && e.message)) ? "falta campo obrigatório" : "confira a internet"));
        });
      };
    });
  }

  /* ---------- Oficina: orçamento, custos, selos e impressora ---------- */
  function paramsOrc() { var p = S.params || {}; return { filamento: num(p.filamento), maquina: num(p.maquina), maodeobra: num(p.maodeobra), margem: num(p.margem) || 1 }; }
  function contaOrc(g, h, pos) {
    var p = paramsOrc(), mat = g / 1000 * p.filamento, maq = h * p.maquina, mao = pos / 60 * p.maodeobra, piso = mat + maq + mao;
    return { mat: mat, maq: maq, mao: mao, piso: piso, preco: piso * p.margem, margem: p.margem };
  }
  function formOrcamento() {
    var p = paramsOrc();
    return '<div class="duas">' + campo("Gramas", '<input id="oG" inputmode="decimal" autocomplete="off">') + campo("Horas de impressão", '<input id="oH" inputmode="decimal" autocomplete="off">') + "</div>" +
      campo("Acabamento (minutos)", '<input id="oP" inputmode="decimal" autocomplete="off">') +
      '<div class="cartao orc-conta" id="oConta">' +
        '<div class="orc-l"><span>Material</span><b id="oMat">R$ 0,00</b></div><div class="orc-l"><span>Máquina</span><b id="oMaq">R$ 0,00</b></div><div class="orc-l"><span>Mão de obra</span><b id="oMao">R$ 0,00</b></div>' +
        '<div class="orc-l piso"><span>Custo</span><b id="oPiso">R$ 0,00</b></div>' +
        '<div class="orc-preco"><span>Preço sugerido</span><b id="oPreco">R$ 0,00</b><small>margem ' + String(p.margem).replace(".", ",") + "x sobre o custo</small></div>" +
      "</div>" +
      campo("Cliente", '<input id="oCli" autocomplete="off">') +
      '<button type="button" class="bt-link" id="oCustos" style="justify-self:start;">Custos e tabela do pôster</button>' +
      '<div id="oHist"></div>' +
      '<div class="fixo grade-bts"><button class="bt" id="oSalva">Salvar orçamento</button><button class="bt acento" id="xOk">Lançar como entrada</button></div>';
  }
  function ligaOrcamento(f) {
    var q = function (s) { return f.querySelector(s); };
    var calc = function () { var c = contaOrc(num(q("#oG").value), num(q("#oH").value), num(q("#oP").value)); q("#oMat").textContent = brl(c.mat); q("#oMaq").textContent = brl(c.maq); q("#oMao").textContent = brl(c.mao); q("#oPiso").textContent = brl(c.piso); q("#oPreco").textContent = brl(c.preco); return c; };
    ["#oG", "#oH", "#oP"].forEach(function (s) { q(s).addEventListener("input", calc); });
    q("#oCustos").onclick = function () { folhaCustos(); };
    setTimeout(function () { var t = q("#oTodos"); if (t) t.onclick = folhaOrcamentos; }, 0);
    var hist = (S.orcamentos || []).slice().sort(function (a, b) { return String(b.data) < String(a.data) ? -1 : 1; }).slice(0, 5);
    q("#oHist").innerHTML = hist.length ? '<div class="rot" style="display:flex;justify-content:space-between;">Últimos orçamentos<button type="button" class="bt-link" id="oTodos" style="min-height:0;padding:0;">Ver todos</button></div><div class="cartao lista" style="box-shadow:none;">' + hist.map(function (o) { return '<div class="linha"><div class="o"><b>' + esc(o.cliente || "Sem nome") + "</b><small>" + dm(o.data) + ", " + esc(String(o.gramas || 0).replace(".", ",")) + " g, " + esc(String(o.horas || 0).replace(".", ",")) + ' h</small></div><span class="valor">' + brl(num(o.total)) + "</span></div>"; }).join("") + "</div>" : "";
    var novoOrc = function () {
      var c = calc(); if (!(c.preco > 0)) { q("#oG").focus(); aviso("Preencha gramas e horas"); return null; }
      return { id: uid("o"), data: hoje(), cliente: q("#oCli").value.trim() || "Sem nome", tipo: "medida", gramas: num(q("#oG").value), horas: num(q("#oH").value), pos: num(q("#oP").value), total: Math.round(c.preco * 100) / 100 };
    };
    q("#oSalva").onclick = function () {
      var o = novoOrc(); if (!o) return;
      S.orcamentos = (S.orcamentos || []).concat([o]); fecharFolha(); aviso("Orçamento salvo: " + brl(o.total));
      gravarTabela("orcamentos", function (a) { return a.concat([o]); });
    };
    return { lancar: function () {
      var o = novoOrc(); if (!o) return;
      var l = { id: uid("m"), data: hoje(), label: o.cliente === "Sem nome" ? "Orçamento" : "Orçamento " + o.cliente, valor: o.total };
      S.orcamentos = (S.orcamentos || []).concat([o]); S.lancamentos.push(l); fecharFolha(); render(true); aviso("Entrou " + brl(o.total));
      gravarTabela("orcamentos", function (a) { return a.concat([o]); });
      gravarTabela("lancamentos", function (a) { return a.concat([l]); });
    } };
  }
  function folhaCustos() {
    var p = S.params || {};
    var v = function (x) { return x != null && x !== "" ? esc(String(x).replace(".", ",")) : ""; };
    abrirFolha("Custos",
      '<div class="rot">Peça</div>' +
      '<div class="duas">' + campo("Filamento (R$/kg)", '<input id="cFil" inputmode="decimal" value="' + v(p.filamento) + '">') + campo("Margem (vezes o custo)", '<input id="cMar" inputmode="decimal" value="' + v(p.margem) + '">') + "</div>" +
      '<div class="duas">' + campo("Máquina (R$/h)", '<input id="cMaq" inputmode="decimal" value="' + v(p.maquina) + '">') + campo("Mão de obra (R$/h)", '<input id="cMao" inputmode="decimal" value="' + v(p.maodeobra) + '">') + "</div>" +
      '<div class="rot">Mês</div>' +
      '<div class="duas">' + campo("Custo fixo (R$)", '<input id="cFix" inputmode="decimal" value="' + v(p.fixo) + '">') + campo("Retirada (R$)", '<input id="cRet" inputmode="decimal" value="' + v(p.retirada) + '">') + "</div>" +
      '<div class="rot">Vendas de site</div>' +
      '<div class="duas">' + campo("Contatos por semana", '<input id="cMc" type="number" min="1" inputmode="numeric" value="' + esc(metasParam().contatos) + '">') + campo("Sites por mês", '<input id="cMs" type="number" min="1" inputmode="numeric" value="' + esc(metasParam().sites) + '">') + "</div>" +
      '<div class="rot">Tabela do pôster</div><div class="tam-precos" id="cPb">' + TAM_POSTER.map(function (t) { return campo(t, '<input data-pb="' + t + '" inputmode="decimal">'); }).join("") + "</div>" +
      '<div class="fixo"><button class="bt acento cheio" id="cSalva">Salvar custos</button></div>',
      function (c) {
        var base = null;
        api("/api/settings/precos_base").then(function (d) {
          base = d && d.precos_base || {};
          c.querySelectorAll("[data-pb]").forEach(function (i) { var cents = base[i.dataset.pb]; if (cents != null) i.value = String(Math.round(cents) / 100).replace(".", ","); });
        }).catch(function () {});
        c.querySelector("#cSalva").onclick = function () {
          var q = function (s) { return c.querySelector(s); };
          var mudou = { filamento: num(q("#cFil").value), margem: num(q("#cMar").value) || 1, maquina: num(q("#cMaq").value), maodeobra: num(q("#cMao").value), fixo: num(q("#cFix").value), retirada: num(q("#cRet").value), meta_contatos: Math.max(1, parseInt(q("#cMc").value, 10) || META_CONTATOS), meta_sites: Math.max(1, parseInt(q("#cMs").value, 10) || META_SITES) };
          var pb = {}; c.querySelectorAll("[data-pb]").forEach(function (i) { if (num(i.value) > 0) pb[i.dataset.pb] = Math.round(num(i.value) * 100); });
          if (base && Object.keys(pb).length && Object.keys(pb).length < 4) { aviso("Preencha os quatro tamanhos do pôster"); return; }
          var bt = this; bt.disabled = true;
          api("/api/state").then(function (st) {
            var novo = Object.assign({}, st && st.params || S.params || {}, mudou);
            return api("/api/settings/params", { method: "PUT", body: novo }).then(function () { S.params = novo; guardaCache(); });
          }).then(function () {
            return base && Object.keys(pb).length === 4 ? api("/api/settings/precos_base", { method: "PUT", body: pb }) : null;
          }).then(function () { fecharFolha(); render(true); aviso("Custos salvos"); })
            .catch(function () { bt.disabled = false; aviso("Não salvou. Confira a internet."); });
        };
      });
  }

  /* impressora */
  var ESTADO_IMP = { printing: "Imprimindo", paused: "Pausada", complete: "Terminou", standby: "Parada", error: "Com erro", cancelled: "Cancelada" };
  function duracaoTxt(seg) { seg = Math.round(Number(seg) || 0); var h = Math.floor(seg / 3600), m = Math.round(seg % 3600 / 60); return h ? h + " h " + pad2(m) : m + " min"; }
  function folhaImpressora() {
    abrirFolha("Impressora K1C", '<div class="esqueleto"></div>', function (c) {
      api("/api/impressora").then(function (imp) {
        S.extras = S.extras || {}; S.extras.imp = imp;
        if (!folhaAberta || !c.querySelector(".esqueleto")) return;
        if (!imp || !imp.conectada) { c.innerHTML = '<p class="vazio" style="color:var(--suave);">A impressora ainda não mandou notícia.</p>'; return; }
        c.innerHTML = impHTML(imp);
      }).catch(function () { if (folhaAberta && c.querySelector(".esqueleto")) c.innerHTML = '<p class="vazio" style="color:var(--suave);">Não carregou. Confira a internet.</p>'; });
    });
  }

  /* ---------- Estúdio por dentro: Empresa (MEI) e Números ---------- */
  var NUM = { range: "7d", ga4: {}, ig: {}, carregando: {} }, MEI = { dash: null, carregando: false, erro: false };
  function centavos(c) { return brl(Number(c || 0) / 100); }
  function centavosCurto(c) { return brlCurto(Number(c || 0) / 100); }

  /* gráficos: barras e linha, desenhados em SVG com a mesma escala dos rótulos */
  function graficoBarras(vals, rots, destaque) {
    var max = Math.max.apply(null, vals.concat([1])), n = vals.length, w = 320, h = 120, gap = 6, bw = (w - gap * (n - 1)) / n;
    var barras = vals.map(function (v, i) { var bh = v > 0 ? Math.max(3, v / max * (h - 18)) : 0, x = i * (bw + gap); return '<rect x="' + x.toFixed(1) + '" y="' + (h - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" class="' + (i === destaque ? "b-hoje" : "b") + '"/>'; }).join("");
    return '<div class="grafico"><svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">' + barras + '</svg><div class="grafico-rot" style="grid-template-columns:repeat(' + n + ',1fr)">' + rots.map(function (r) { return "<span>" + esc(r) + "</span>"; }).join("") + "</div></div>";
  }
  function graficoLinha(vals) {
    if (vals.length < 2) return "";
    var max = Math.max.apply(null, vals.concat([1])), w = 320, h = 70, pts = vals.map(function (v, i) { return (i / (vals.length - 1) * w).toFixed(1) + "," + (h - 4 - v / max * (h - 10)).toFixed(1); });
    return '<svg class="linha-g" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,' + h + " " + pts.join(" ") + " " + w + "," + h + '" class="area"/><polyline points="' + pts.join(" ") + '" class="traco"/></svg>';
  }

  /* --- Empresa: MEI --- */
  function carregarMei() {
    if (MEI.carregando) return; MEI.carregando = true; MEI.erro = false;
    api("/api/mei/dashboard").then(function (d) { MEI.dash = d; S.extras = S.extras || {}; S.extras.mei = d; guardaCache(); })
      .catch(function () { MEI.erro = true; })
      .then(function () { MEI.carregando = false; if (vista === "financas" && abaDe("financas") === "mei") render(true); });
  }
  function telaEmpresa() {
    var d = MEI.dash;
    if (!d) { if (!MEI.erro) carregarMei(); return (MEI.erro ? '<div class="cartao"><h3 style="margin:0 0 8px;font-weight:900;">O MEI não carregou</h3><button class="bt preto" data-meitenta>Tentar de novo</button></div>' : '<div class="esqueleto"></div>'); }
    var f = d.faturamento || {}, pct = f.pct_usado || 0, cfg = d.config || {};
    var limite = '<div class="cartao mes"><div class="topo-mes"><span class="grande">' + (oculto() ? "R$ •••" : centavosCurto(f.total_ano_centavos)) + '</span><span class="comp' + (f.alerta ? " desce" : "") + '">projeção ' + (oculto() ? "•••" : centavosCurto(f.projecao_anual_centavos)) + "</span></div>" +
      '<div class="barra-meta"><i style="width:' + Math.min(100, pct) + "%" + (f.alerta ? ";background:var(--c-aviso)" : "") + '"></i></div><div class="rodape"><span>Faturado em ' + esc(f.ano || d.ano_atual) + "</span><span>" + pct + "% do limite de " + centavosCurto(f.limite_anual_centavos) + "</span></div></div>";
    var das = '<div class="secao">DAS</div><div class="cartao lista">' + (d.das_meses || []).slice().reverse().map(function (m) {
      var est = m.paid ? "pago" : m.atrasado ? "atrasado" : "a pagar";
      return '<div class="linha"><div class="o"><b>' + cap(MESES[m.month - 1]) + " " + m.year + "</b><small>" + (m.paid ? "Pago" + (m.paid_at ? " em " + dm(m.paid_at) : "") + (m.valor_centavos && !oculto() ? ", " + centavos(m.valor_centavos) : "") : (m.atrasado ? "Venceu " : "Vence ") + dm(m.vencimento)) + '</small></div><span class="tipo ' + (m.paid ? "t-feito" : m.atrasado ? "t-aviso" : "t-loja") + '">' + est + '</span><button class="bt" data-das="' + m.year + "-" + m.month + '">' + (m.paid ? "Desfazer" : "Paguei") + "</button></div>";
    }).join("") + "</div>";
    var dn = d.dasn || {};
    var dasn = '<div class="secao">Declaração anual</div><div class="cartao lista"><div class="linha"><div class="o"><b>Declaração de ' + esc(dn.year || d.ano_atual) + "</b><small>" + (dn.done ? "Entregue" + (dn.done_at ? " em " + dm(dn.done_at) : "") : (dn.atrasado ? "Venceu em " : "Prazo ") + dm(dn.deadline)) + '</small></div><button class="bt" data-dasn>' + (dn.done ? "Desfazer" : "Feita") + "</button></div></div>";
    var meses = f.meses || [], mesAtual = d.mes_atual || new Date().getMonth() + 1;
    var fat = '<div class="secao">Faturamento por mês</div><div class="cartao' + (oculto() ? " g-oculto" : "") + '">' + graficoBarras(meses.map(function (m) { return m.month <= mesAtual ? Number(m.total_centavos) || 0 : 0; }), meses.map(function (m) { return MESES[m.month - 1].slice(0, 1).toUpperCase(); }), mesAtual - 1) + "</div>" +
      '<div class="cartao lista">' + meses.filter(function (m) { return m.month <= mesAtual; }).reverse().map(function (m) {
        return '<div class="linha toca" data-fatmes="' + m.month + '"><div class="o"><b>' + cap(MESES[m.month - 1]) + "</b><small>" + (m.lancamentos || 0) + (m.lancamentos === 1 ? " entrada" : " entradas") + (m.ajuste_centavos && !oculto() ? ", ajuste " + centavos(m.ajuste_centavos) : "") + (m.nota ? ", " + esc(m.nota) : "") + '</small></div><span class="valor">' + (oculto() ? "R$ •••" : centavos(m.total_centavos)) + "</span>" + IC.seta + "</div>";
      }).join("") + "</div>";
    var conf = '<div class="cartao lista"><div class="linha toca" data-meiconf><div class="o"><b>Configuração do MEI</b><small>DAS de ' + (oculto() ? "R$ •••" : centavos(cfg.das_valor_centavos)) + ", vence dia " + esc(cfg.das_vencimento_dia || 20) + '</small></div>' + IC.seta + '</div><div class="linha toca" data-aba="financas:metas"><div class="o"><b>Custos e metas</b><small>Preço da peça e meta do mês</small></div>' + IC.seta + "</div></div>";
    return colunas(limite + das + dasn, fat + conf);
  }
  function ligarEmpresa(raiz) {
    raiz.querySelectorAll("[data-meitenta]").forEach(function (b) { b.onclick = function () { MEI.erro = false; render(true); }; });
    raiz.querySelectorAll("[data-das]").forEach(function (b) {
      b.onclick = function () {
        var p = b.dataset.das.split("-").map(Number), m = (MEI.dash.das_meses || []).filter(function (x) { return x.year === p[0] && x.month === p[1]; })[0]; if (!m) return;
        var corpo = { year: m.year, month: m.month }, cfg = MEI.dash.config || {};
        if (!m.paid && Number(cfg.das_valor_centavos) > 0) corpo.valor_centavos = Number(cfg.das_valor_centavos);
        b.disabled = true;
        api(m.paid ? "/api/mei/das/unpay" : "/api/mei/das/pay", { method: "POST", body: corpo }).then(function () { aviso(m.paid ? "DAS reaberto" : "DAS pago"); carregarMei(); })
          .catch(function (e) { b.disabled = false; aviso(/HTTP 400/.test(String(e && e.message)) ? "Falta o valor do DAS na configuração" : "Não salvou. Confira a internet."); });
      };
    });
    raiz.querySelectorAll("[data-dasn]").forEach(function (b) {
      b.onclick = function () {
        var dn = MEI.dash.dasn || {}; b.disabled = true;
        api(dn.done ? "/api/mei/dasn/undo" : "/api/mei/dasn/done", { method: "POST", body: { year: dn.year } }).then(function () { aviso(dn.done ? "Declaração reaberta" : "Declaração entregue"); carregarMei(); })
          .catch(function () { b.disabled = false; aviso("Não salvou. Confira a internet."); });
      };
    });
    raiz.querySelectorAll("[data-fatmes]").forEach(function (b) { b.onclick = function () { folhaAjusteMes(Number(b.dataset.fatmes)); }; });
    raiz.querySelectorAll("[data-meiconf]").forEach(function (b) { b.onclick = folhaConfigMei; });
  }
  function folhaAjusteMes(mes) {
    var f = MEI.dash.faturamento || {}, m = (f.meses || []).filter(function (x) { return x.month === mes; })[0] || {};
    abrirFolha(cap(MESES[mes - 1]) + " " + (f.ano || MEI.dash.ano_atual),
      '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + (oculto() ? "R$ •••" : centavosCurto(m.auto_centavos)) + '</b><span>das entradas</span></div><div class="num"><b>' + (oculto() ? "R$ •••" : centavosCurto(m.total_centavos)) + "</b><span>total do mês</span></div></div>" +
      campo("Ajuste (R$)", '<input id="ajV" inputmode="decimal" value="' + (m.ajuste_centavos ? esc(String(m.ajuste_centavos / 100).replace(".", ",")) : "") + '" autocomplete="off">') +
      campo("Nota", '<input id="ajN" maxlength="120" value="' + esc(m.nota || "") + '" autocomplete="off">') +
      '<div class="fixo"><button class="bt acento cheio" id="ajOk">Salvar ajuste</button></div>',
      function (c) {
        c.querySelector("#ajOk").onclick = function () {
          var t = c.querySelector("#ajV").value.trim(), neg = /^-/.test(t), v = Math.round(num(t.replace(/^-/, "")) * 100) * (neg ? -1 : 1);
          this.disabled = true;
          api("/api/mei/faturamento/ajuste", { method: "POST", body: { year: f.ano || MEI.dash.ano_atual, month: mes, ajuste_centavos: v, nota: c.querySelector("#ajN").value.trim() || null } })
            .then(function () { fecharFolha(); aviso("Ajuste salvo"); carregarMei(); })
            .catch(function () { aviso("Não salvou. Confira a internet."); });
        };
      });
  }
  function folhaConfigMei() {
    var c0 = MEI.dash.config || {}, r = function (x) { return x ? esc(String(x / 100).replace(".", ",")) : ""; };
    abrirFolha("Configuração do MEI",
      '<div class="duas">' + campo("Valor do DAS (R$)", '<input id="mDas" inputmode="decimal" value="' + r(c0.das_valor_centavos) + '">') + campo("Vence todo dia", '<input id="mVenc" type="number" min="1" max="28" inputmode="numeric" value="' + esc(c0.das_vencimento_dia || 20) + '">') + "</div>" +
      campo("Limite do ano (R$)", '<input id="mLim" inputmode="decimal" value="' + r(c0.limite_anual_centavos) + '">') +
      '<div class="duas">' + campo("Prazo da declaração (dia)", '<input id="mDd" type="number" min="1" max="31" inputmode="numeric" value="' + esc(c0.dasn_deadline_day || "") + '">') + campo("Mês", '<input id="mDm" type="number" min="1" max="12" inputmode="numeric" value="' + esc(c0.dasn_deadline_month || "") + '">') + "</div>" +
      '<div class="fixo"><button class="bt acento cheio" id="mOk">Salvar</button></div>',
      function (c) {
        c.querySelector("#mOk").onclick = function () {
          var q = function (s) { return c.querySelector(s).value; };
          var faixa = function (v, a, b, pad) { v = Math.round(Number(v)); return v >= a && v <= b ? v : pad; };
          var corpo = { das_valor_centavos: Math.round(num(q("#mDas")) * 100), limite_anual_centavos: Math.round(num(q("#mLim")) * 100), das_vencimento_dia: faixa(q("#mVenc"), 1, 28, 20) };
          var dmes = q("#mDm") ? faixa(q("#mDm"), 1, 12, null) : null, ddia = q("#mDd") ? faixa(q("#mDd"), 1, [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(dmes || 5) - 1], null) : null;
          if (q("#mDm") && dmes == null) { aviso("Mês da declaração vai de 1 a 12"); return; }
          if (q("#mDd") && ddia == null) { aviso("Dia da declaração inválido pra esse mês"); return; }
          if (ddia) corpo.dasn_deadline_day = ddia; if (dmes) corpo.dasn_deadline_month = dmes;
          this.disabled = true;
          api("/api/mei/config", { method: "PUT", body: corpo }).then(function () { fecharFolha(); aviso("Configuração salva"); carregarMei(); })
            .catch(function () { aviso("Não salvou. Confira os valores."); });
        };
      });
  }

  /* --- Números: entradas, site e Instagram --- */
  function carregarNumeros() {
    var r = NUM.range;
    ["ga4", "ig"].forEach(function (k) {
      if ((NUM[k][r] && !(NUM[k][r].falhaEm && Date.now() - NUM[k][r].falhaEm > 30000)) || NUM.carregando[k + r]) return;
      NUM.carregando[k + r] = true;
      api(k === "ga4" ? "/api/analytics/ga4?range=" + r : "/api/analytics/instagram?range=" + r)
        .then(function (d) { NUM[k][r] = d; }).catch(function () { NUM[k][r] = { error: "falhou", falhaEm: Date.now() }; })
        .then(function () { NUM.carregando[k + r] = false; if (vista === "divulgacao" && abaDe("divulgacao") === "numeros") render(true); });
    });
  }
  function ga4Linhas(rep) { return rep && rep.rows ? rep.rows : []; }
  function ga4Total(d, qual) {
    var row = ga4Linhas(d.totals).filter(function (r) { return (r.dimensionValues || []).some(function (v) { return v.value === qual; }); })[0];
    return row ? row.metricValues.map(function (m) { return Number(m.value) || 0; }) : null;
  }
  function variacao(a, b) { if (!b) return ""; var d = Math.round((a - b) / b * 100); return '<em class="' + (d >= 0 ? "sobe" : "desce") + '">' + (d >= 0 ? "+" : "") + d + "%</em>"; }
  function telaNumeros() {
    carregarNumeros();
    var r = NUM.range, ga = NUM.ga4[r], ig = NUM.ig[r];
    var chips = '<div class="filtros">' + [["1d", "Ontem"], ["7d", "7 dias"], ["28d", "28 dias"], ["90d", "90 dias"]].map(function (x) { return '<button class="chip-bt" data-nrange="' + x[0] + '" aria-pressed="' + (r === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>";
    var site;
    if (!ga) site = '<div class="esqueleto"></div>';
    else if (ga.error && !ga.totals) site = '<p class="vazio">O Google não respondeu agora.</p>';
    else {
      var cur = ga4Total(ga, "current") || ga4Linhas(ga.totals)[0] && ga4Linhas(ga.totals)[0].metricValues.map(function (m) { return Number(m.value) || 0; }) || [0, 0, 0, 0, 0], prev = ga4Total(ga, "previous") || [];
      var serie = ga4Linhas(ga.main).map(function (row) { return Number(row.metricValues[0].value) || 0; });
      var tempo = Math.round(cur[4] || 0), wa = ga4Linhas(ga.top), src = ga4Linhas(ga.src);
      site = '<div class="cartao g-cartao"><div class="nums">' +
        '<div class="num"><b>' + cur[0] + variacao(cur[0], prev[0]) + '</b><span>visitas</span></div><div class="num"><b>' + cur[1] + variacao(cur[1], prev[1]) + '</b><span>pessoas</span></div><div class="num"><b>' + Math.round((cur[3] || 0) * 100) + '%</b><span>engajamento</span></div></div>' +
        graficoLinha(serie) + '<p class="g-nota">' + cur[2] + " páginas vistas, " + Math.floor(tempo / 60) + " min " + pad2(tempo % 60) + " por visita</p></div>" +
        (wa.length ? '<div class="cartao lista g-lista"><div class="g-tit">Cliques no WhatsApp</div>' + wa.map(function (row) { return '<div class="linha"><div class="o"><b>' + esc(String(row.dimensionValues[0].value).replace(/^wa_/, "").replace(/_/g, " ")) + '</b></div><span class="valor">' + esc(row.metricValues[0].value) + "</span></div>"; }).join("") + "</div>" : "") +
        (src.length ? '<div class="cartao lista g-lista"><div class="g-tit">De onde vieram</div>' + src.map(function (row) { return '<div class="linha"><div class="o"><b>' + esc(row.dimensionValues[0].value === "(direct)" ? "direto" : row.dimensionValues[0].value) + '</b></div><span class="valor">' + esc(row.metricValues[0].value) + "</span></div>"; }).join("") + "</div>" : "");
    }
    var insta;
    if (!ig) insta = '<div class="esqueleto"></div>';
    else if (ig.error && !ig.account) insta = '<p class="vazio">O Instagram não respondeu agora.</p>';
    else {
      var vals = (ig.reach && ig.reach.data && ig.reach.data[0] && ig.reach.data[0].values || []).map(function (v) { return Number(v.value) || 0; }), alc = vals.reduce(function (a, b) { return a + b; }, 0), ac = ig.account || {};
      insta = '<div class="cartao g-cartao"><div class="nums"><div class="num"><b>' + alc.toLocaleString("pt-BR") + '</b><span>alcance somado</span></div><div class="num"><b>' + Number(ac.followers_count || 0).toLocaleString("pt-BR") + '</b><span>seguidores</span></div><div class="num"><b>' + esc(ac.media_count || 0) + "</b><span>posts</span></div></div>" + graficoLinha(vals) + "</div>" +
        ((ig.media && ig.media.data || []).length ? '<div class="ig-grade">' + ig.media.data.slice(0, 6).map(function (m) {
          var img = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
          var link = /^https:\/\//.test(m.permalink || ""), tag = link ? 'a class="ig-post" href="' + esc(m.permalink) + '" target="_blank" rel="noopener"' : 'div class="ig-post"';
          return "<" + tag + ">" + (img && /^https:\/\//.test(img) ? '<img loading="lazy" alt="" src="' + esc(img) + '">' : "") + "<span>" + esc(m.like_count || 0) + " curtidas, " + esc(m.comments_count || 0) + " comentários</span></" + (link ? "a" : "div") + ">";
        }).join("") + "</div>" : "");
    }
    var a = chips + '<div class="secao">Site</div>' + site +
      '<div class="cartao lista"><div class="linha toca" data-relatorio><div class="o"><b>Relatório da semana</b><small>Pronto pra copiar</small></div>' + IC.seta + "</div></div>";
    var b = '<div class="secao">Instagram' + (ig && ig.account && ig.account.username ? " <small>@" + esc(ig.account.username) + "</small>" : "") + "</div>" + insta;
    return colunas(a, b);
  }
  function relatorioSemana() {
    var h = hoje(), ini = somaDias(h, -6), linhas = [];
    var ent = S.lancamentos.filter(function (l) { return l.data >= ini && l.data <= h; }), soma = ent.reduce(function (a, l) { return a + num(l.valor); }, 0);
    linhas.push("MARATU, semana de " + dm(ini) + " a " + dm(h), "");
    linhas.push("ENTRADAS: " + brl(soma) + " em " + ent.length + (ent.length === 1 ? " entrada" : " entradas"));
    ent.slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).forEach(function (l) { linhas.push("  " + dm(l.data) + "  " + brl(num(l.valor)) + "  " + tituloEntrada(l)); });
    var r = resumoMes(); linhas.push("", "MÊS: " + brl(r.total) + (r.meta ? " de " + brl(r.meta) + " (" + Math.round(r.total / r.meta * 100) + "%)" : ""));
    var env = 0, resp = 0, lim = new Date(Date.now() - 7 * 864e5).toISOString();
    S.prospec.forEach(function (p) { try { JSON.parse(p.historico || "[]").forEach(function (x) { if (x.ts >= lim) { if (x.acao === "enviei") env++; if (x.acao === "respondeu") resp++; } }); } catch (e) {} });
    linhas.push("", "PROSPECÇÃO: " + env + " contatos enviados, " + resp + " responderam, " + prospecGrupos().noAr.length + " no ar");
    var novos = S.leads.filter(function (l) { return String(l.criado || "").slice(0, 10) >= ini; }), fechados = S.leads.filter(function (l) { return l.status === "fechado" && String(l.followup || "") >= ini; });
    linhas.push("LEADS: " + novos.length + " novos, " + fechados.length + " fechados");
    var prox = eventosVivos().filter(function (e) { return !e.feito && e.data > h && e.data <= somaDias(h, 7); }).sort(function (a, b) { return a.data + (a.hora || "") < b.data + (b.hora || "") ? -1 : 1; });
    linhas.push("", "PRÓXIMOS 7 DIAS: " + (prox.length ? "" : "nada marcado"));
    prox.forEach(function (e) { linhas.push("  " + dm(e.data) + (e.hora ? " " + e.hora : "") + "  " + e.titulo); });
    var ga = NUM.ga4["7d"], cur = ga && !ga.error ? ga4Total(ga, "current") : null;
    if (cur) linhas.push("", "SITE: " + cur[0] + " visitas, " + cur[1] + " pessoas");
    var ig = NUM.ig["7d"]; if (ig && ig.account) { var alc = (ig.reach && ig.reach.data && ig.reach.data[0] && ig.reach.data[0].values || []).reduce(function (a, v) { return a + (Number(v.value) || 0); }, 0); linhas.push("INSTAGRAM: " + alc + " de alcance, " + ig.account.followers_count + " seguidores"); }
    return linhas.join("\n");
  }
  function carregarSemana() {
    var ps = ["ga4", "ig"].map(function (k) {
      if (NUM[k]["7d"] && !NUM[k]["7d"].error) return null;
      return api(k === "ga4" ? "/api/analytics/ga4?range=7d" : "/api/analytics/instagram?range=7d").then(function (d) { NUM[k]["7d"] = d; }).catch(function () {});
    });
    return Promise.all(ps);
  }
  function folhaRelatorio() {
    abrirFolha("Relatório da semana", '<div class="esqueleto"></div>');
    carregarSemana().then(function () { if (folhaAberta && $("folhaTit").textContent === "Relatório da semana") folhaRelatorioPronto(); });
  }
  function folhaRelatorioPronto() {
    var txt = relatorioSemana();
    abrirFolha("Relatório da semana", '<pre class="relatorio" id="relTxt">' + esc(txt) + '</pre><div class="fixo"><button class="bt acento cheio" id="relCopia">Copiar</button></div>', function (c) {
      c.querySelector("#relCopia").onclick = function () { copiar(txt).then(function () { aviso("Relatório copiado"); }).catch(function () { var r = document.createRange(); r.selectNodeContents(c.querySelector("#relTxt")); var s = getSelection(); s.removeAllRanges(); s.addRange(r); aviso("Texto selecionado"); }); };
    });
  }
  function ligarNumeros(raiz) {
    raiz.querySelectorAll("[data-nrange]").forEach(function (b) { b.onclick = function () { NUM.range = b.dataset.nrange; render(true); }; });
  }

  /* ---------- Divulgação: conteúdo, newsletter e links da bio ---------- */
  var ETAPAS_POST = [["ideia", "Ideias"], ["aprovado", "Programados"], ["publicado", "Publicados"]];
  var FORMATOS_POST = ["Reels", "Carrossel", "Story", "Post", "Vídeo"], REDES_POST = ["Instagram", "TikTok", "YouTube", "Todas"];
  /* os destinos moram no Worker (GO_DEST); aqui só o nome de cada um */
  var LINKS_BIO = [["loja", "Loja"], ["servicos", "Serviços"], ["wpp", "WhatsApp, encomenda"], ["contato", "WhatsApp, contato"], ["news", "Newsletter"], ["agenda", "Agenda"], ["parceiros", "Parceiros"], ["ig", "Instagram"], ["tiktok", "TikTok"]];
  var DIV = { etapa: "ideia", links: null, news: null };
  function posts() { return S.marketing || []; }
  function ligarDivulgacao(raiz) {
    raiz.querySelectorAll("[data-etapa]").forEach(function (b) { b.onclick = function () { DIV.etapa = b.dataset.etapa; render(true); }; });
    raiz.querySelectorAll("[data-post]").forEach(function (b) { b.onclick = function () { var p = porId(posts(), b.dataset.post); if (p) folhaPost(p); }; });
    raiz.querySelectorAll("[data-novopost]").forEach(function (b) { b.onclick = function () { folhaLancar("post"); }; });
    raiz.querySelectorAll("[data-news]").forEach(function (b) { b.onclick = abrirNews; });
    raiz.querySelectorAll("[data-golink]").forEach(function (b) { b.onclick = function () { var u = "https://maratu.com.br/go/" + b.dataset.golink + "?s=bio"; copiar(u).then(function () { aviso("Link copiado"); }).catch(function () { aviso(u); }); }; });
  }
  function formPost(p) {
    p = p || {};
    return campo("Título", '<input id="poTit" value="' + esc(p.titulo || "") + '" autocomplete="off">') +
      campo("Ideia", '<textarea id="poIdeia">' + esc(p.ideia || "") + "</textarea>") +
      '<div class="rot">Formato</div>' + pilulas("pform", FORMATOS_POST.map(function (f) { return [f, f]; }), p.formato || "Reels") +
      '<div class="rot">Rede</div>' + pilulas("prede", REDES_POST.map(function (f) { return [f, f]; }), p.rede || "Instagram") +
      '<div class="duas">' + campo("Dia de publicar", '<input id="poData" type="date" value="' + esc(p.data || "") + '">') + campo("Hora", '<input id="poHora" type="time" value="' + esc(p.hora || "") + '">') + "</div>" +
      (p.id ? '<div class="rot">Etapa</div>' + pilulas("petapa", ETAPAS_POST.map(function (e) { return [e[0], e[1].replace(/s$/, "")]; }), p.status || "ideia") : "");
  }
  function lerPost(c, p) {
    var data = c.querySelector("#poData").value || null, st = c.querySelector('[data-pil="petapa"]') ? pil(c, "petapa") : null;
    if (!st) st = data ? "aprovado" : "ideia";
    if (st === "ideia" && data && p && p.status === "ideia") st = "aprovado";
    return { titulo: c.querySelector("#poTit").value.trim(), ideia: c.querySelector("#poIdeia").value.trim() || null, formato: pil(c, "pform"), rede: pil(c, "prede"), data: data, hora: c.querySelector("#poHora").value || null, status: st };
  }
  function folhaPost(p) {
    abrirFolha(p.titulo || "Post", formPost(p) + '<button class="bt cheio perigo" id="poApaga">Apagar</button><div class="fixo grade-bts"><button class="bt acento" id="poSalva">Salvar</button><button class="bt' + (p.status === "publicado" ? "" : " verde") + '" id="poPub">' + (p.status === "publicado" ? "Voltar pra programado" : IC.check + "Publiquei") + "</button></div>",
      function (c) {
        ligaPilulas(c);
        c.querySelector("#poSalva").onclick = function () {
          var m = lerPost(c, p); if (!m.titulo) return c.querySelector("#poTit").focus();
          descarregar(); Object.assign(p, m); fecharFolha(); render(true); aviso("Salvo");
          gravarTabela("marketing", function (a) { return trocaItem(a, p.id, m); });
        };
        c.querySelector("#poPub").onclick = function () { fecharFolha(); postPublicado(p, p.status !== "publicado"); };
        confirmaDuplo(c.querySelector("#poApaga"), "Toque de novo pra apagar", function () {
          fecharFolha(); var antes = (S.marketing || []).slice();
          executar("Apagado", function () { S.marketing = S.marketing.filter(function (x) { return x.id !== p.id; }); }, function () { S.marketing = antes; },
            function () { gravarTabela("marketing", function (a) { return a.filter(function (x) { return x.id !== p.id; }); }); });
        });
      });
  }
  function postPublicado(p, sim) {
    var antes = p.status, depois = sim ? "publicado" : "aprovado";
    if (sim) conta("post");
    executar(sim ? "Publicado" : "Voltou pra programado", function () { p.status = depois; }, function () { p.status = antes; },
      function () { gravarTabela("marketing", function (a) { return trocaItem(a, p.id, { status: depois }); }); });
  }
  var newsCarregando = null;
  function abrirNews() {
    if (window.maratuNews) { window.maratuNews.abrir(); return; }
    if (newsCarregando) return;
    newsCarregando = new Promise(function (ok, falha) { var s = document.createElement("script"); s.src = "/admin-news.js?v=20261030a"; s.onload = ok; s.onerror = falha; document.body.appendChild(s); })
      .then(function () { if (window.maratuNews) window.maratuNews.abrir(); else aviso("A newsletter não abriu"); })
      .catch(function () { aviso("A newsletter não abriu. Confira a internet."); })
      .then(function () { newsCarregando = null; });
  }

  /* ---------- o que faltava do painel antigo ---------- */
  /* agenda pública: o site lê a lista "agenda_publicos" do Worker, não a coluna do evento */
  function ehPublico(e) { return !!e && (S.publicos || []).map(String).indexOf(String(e.id)) >= 0; }
  function marcarPublico(e, sim) {
    if (ehPublico(e) === !!sim) return;
    S.publicos = (S.publicos || []).filter(function (x) { return String(x) !== String(e.id); });
    if (sim) S.publicos.push(e.id);
    var antes = (S.publicos || []).slice();
    api("/api/eventos/publico", { method: "POST", body: { id: e.id, publico: !!sim } }).then(guardaCache).catch(function () { S.publicos = antes; aviso("A agenda pública não salvou"); });
  }

  /* arrastar pela alça pra reordenar uma lista (produtos e faixas) */
  function arrastaPorAlca(box, sel) {
    box.querySelectorAll(sel + " .pega").forEach(function (alca) {
      var it = alca.closest(sel);
      alca.addEventListener("pointerdown", function (ev) {
        if (ev.button !== 0) return;
        ev.preventDefault(); it.classList.add("pegando");
        var move = function (e) {
          var irmaos = Array.prototype.slice.call(box.querySelectorAll(sel)).filter(function (x) { return x !== it; });
          var depois = irmaos.filter(function (x) { var r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; })[0];
          if (depois) { if (it.nextSibling !== depois) box.insertBefore(it, depois); } else if (box.lastElementChild !== it) box.appendChild(it);
        };
        var solta = function () { it.classList.remove("pegando"); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", solta); window.removeEventListener("pointercancel", solta); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", solta); window.addEventListener("pointercancel", solta);
      });
    });
  }
  var ALCA = '<span class="pega" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 6h8M8 12h8M8 18h8"/></svg></span>';

  /* ordem das faixas da loja e de qual marca vem primeiro */
  function folhaFaixas() {
    if (!PROD.lista) { aviso("As peças não carregaram. Tente de novo."); return; }
    var lay = PROD.layout || {}, marcasOrdem = (lay.marcas && lay.marcas.length ? lay.marcas : ["use", "casa"]).slice();
    ["use", "casa"].forEach(function (m) { if (marcasOrdem.indexOf(m) < 0) marcasOrdem.push(m); });
    var faixasDaMarca = function (m) {
      var usadas = []; (PROD.lista || []).forEach(function (p) { if (p.marca === m && usadas.indexOf(p.subcategoria) < 0) usadas.push(p.subcategoria); });
      var salvas = (lay.faixas && lay.faixas[m] || []).filter(function (f) { return usadas.indexOf(f) >= 0; });
      return salvas.concat(usadas.filter(function (f) { return salvas.indexOf(f) < 0; }));
    };
    abrirFolha("Ordem das faixas",
      '<div class="rot">Marca que aparece primeiro</div>' + pilulas("marca1", [["use", "USE"], ["casa", "CASA"]], marcasOrdem[0]) +
      ["use", "casa"].map(function (m) {
        var fx = faixasDaMarca(m);
        return '<div class="rot">' + m.toUpperCase() + '</div><div class="cartao lista ordem-lista" data-faixas="' + m + '" style="box-shadow:none;">' + (fx.length ? fx.map(function (f) { return '<div class="linha ordem-item" data-f="' + esc(f) + '">' + ALCA + '<div class="o"><b>' + esc(nomeFaixa(f)) + "</b></div></div>"; }).join("") : '<p class="vazio" style="color:var(--suave);padding:10px 0;">Nenhuma peça.</p>') + "</div>";
      }).join("") +
      '<div class="fixo"><button class="bt acento cheio" id="fxSalva">Salvar a ordem</button></div>',
      function (c) {
        ligaPilulas(c);
        c.querySelectorAll("[data-faixas]").forEach(function (box) { arrastaPorAlca(box, ".ordem-item"); });
        c.querySelector("#fxSalva").onclick = function () {
          var primeira = pil(c, "marca1") || "use", faixas = {};
          c.querySelectorAll("[data-faixas]").forEach(function (box) {
            var m = box.dataset.faixas, tela = Array.prototype.map.call(box.querySelectorAll("[data-f]"), function (x) { return x.dataset.f; });
            // faixa salva que hoje não tem peça continua no fim, pra não perder a posição
            faixas[m] = tela.concat((lay.faixas && lay.faixas[m] || []).filter(function (f) { return tela.indexOf(f) < 0; }));
          });
          var corpo = { marcas: primeira === "casa" ? ["casa", "use"] : ["use", "casa"], faixas: faixas };
          this.disabled = true;
          api("/api/catalog/layout", { method: "POST", body: corpo }).then(function () { PROD.layout = corpo; fecharFolha(); aviso("Ordem das faixas salva"); })
            .catch(function () { aviso("Não salvou. Confira a internet."); });
        };
      });
  }

  /* entradas do banco agora, sem esperar o robô de cada hora */
  function buscarEntradas(bt) {
    if (bt) bt.disabled = true;
    api("/api/entradas/sync", { method: "POST", body: {} }).then(function (r) {
      var n = r && r.novos ? r.novos.length : 0;
      if (r && r.erro) { aviso("O banco respondeu com erro"); return; }
      return carregar().then(function () { render(true); aviso(n ? n + (n === 1 ? " entrada nova" : " entradas novas") : "Nenhuma entrada nova"); });
    }).catch(function () { aviso("O banco não respondeu agora"); }).then(function () { if (bt) bt.disabled = false; });
  }

  /* orçamentos: todos, com apagar */
  function folhaOrcamentos() {
    var lista = (S.orcamentos || []).slice().sort(function (a, b) { return String(b.data) < String(a.data) ? -1 : 1; });
    abrirFolha("Orçamentos", lista.length ? '<div class="cartao lista" style="box-shadow:none;">' + lista.map(function (o) {
      return '<div class="linha"><div class="o"><b>' + esc(o.cliente || "Sem nome") + "</b><small>" + dm(o.data) + ", " + esc(String(o.gramas || 0).replace(".", ",")) + " g, " + esc(String(o.horas || 0).replace(".", ",")) + ' h</small></div><span class="valor">' + brl(num(o.total)) + '</span><button class="ico-bt copia-link" data-orcapaga="' + esc(o.id) + '" aria-label="Apagar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    }).join("") + "</div>" : '<p class="vazio" style="color:var(--suave);">Nenhum orçamento.</p>', function (c) {
      c.querySelectorAll("[data-orcapaga]").forEach(function (b) {
        confirmaDuplo(b, "Apagar?", function () {
          var id = b.dataset.orcapaga; S.orcamentos = (S.orcamentos || []).filter(function (x) { return String(x.id) !== id; });
          b.closest(".linha").remove(); aviso("Orçamento apagado");
          gravarTabela("orcamentos", function (a) { return a.filter(function (x) { return String(x.id) !== id; }); });
        });
      });
    });
  }

  /* lembretes sem dia (e os que vêm), com categoria */
  function categoriasNotas() { var c = []; S.notas.forEach(function (n) { if (n.categoria && c.indexOf(n.categoria) < 0) c.push(n.categoria); }); return c; }
  function listaLembretes() {
    var h = hoje(), sem = S.notas.filter(function (n) { return !n.feito && !n.data; }), prox = S.notas.filter(function (n) { return !n.feito && n.data && n.data > h; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (!sem.length && !prox.length) return "";
    var linha = function (n) { return '<div class="linha toca" data-nota="' + esc(n.id) + '"><div class="o"><b>' + esc(n.titulo) + "</b><small>" + esc([n.categoria, n.data ? quandoRel(n.data) : "", n.detalhe].filter(Boolean).join(", ")) + "</small></div>" + IC.seta + "</div>"; };
    return '<div class="secao">Lembretes</div><div class="cartao lista">' + sem.concat(prox).slice(0, 30).map(linha).join("") + "</div>";
  }

  /* --- busca: caixa no topo da tela, acha registro e roda comando --- */
  var buscaAberta = false, buscaSel = 0, buscaLista = [];
  function norm(s) { return semAcento(s).toLowerCase(); }
  function vaiAba(v, a) { return function () { irAba(v, a); }; }
  var COMANDOS = [
    ["Lançar", "Entrada", function () { folhaLancar("entrada"); }, IC.entrada], ["Lançar", "Evento", function () { folhaLancar("evento", vista === "agenda" ? diaSel : null); }, IC.evento],
    ["Lançar", "Lead", function () { folhaLancar("lead"); }, IC.lead], ["Lançar", "Carnê", function () { folhaLancar("carne"); }, IC.carne],
    ["Lançar", "Lembrete", function () { folhaLancar("nota"); }, IC.nota], ["Lançar", "Orçamento", function () { folhaLancar("orcamento"); }, IC.calc],
    ["Lançar", "Post", function () { folhaLancar("post"); }, IC.post],
    ["Ir", "Hoje", function () { irPara("hoje"); }, IC.dir],
    ["Sites", "Abordar", vaiAba("sites", "abordar"), IC.site], ["Sites", "Prospectar", vaiAba("sites", "prospectar"), IC.site],
    ["Sites", "Conversas e leads", vaiAba("sites", "conversas"), IC.lead], ["Sites", "Clientes de site", vaiAba("sites", "clientes"), IC.site],
    ["Sites", "Novo cliente", function () { folhaCliente(null); }, IC.mais],
    ["Sites", "Buscar negócios", function () { folhaBuscarNegocios(); }, IC.site], ["Sites", "Escolher na reserva", function () { folhaReserva(); }, IC.site],
    ["Finanças", "Caixa", vaiAba("financas", "caixa"), IC.entrada], ["Finanças", "A receber", vaiAba("financas", "receber"), IC.carne],
    ["Finanças", "MEI e DAS", vaiAba("financas", "mei"), IC.entrada], ["Finanças", "Metas e custos", vaiAba("financas", "metas"), IC.calc],
    ["Finanças", "Buscar entradas no banco", function () { buscarEntradas(null); }, IC.entrada],
    ["Finanças", "Relatório da semana", function () { folhaRelatorio(); }, IC.nota],
    ["Ir", "Agenda", function () { irPara("agenda"); }, IC.evento],
    ["Oficina", "Peças", vaiAba("oficina", "pecas"), IC.entrada], ["Oficina", "Pedidos", vaiAba("oficina", "pedidos"), IC.entrada],
    ["Oficina", "Orçamentos", vaiAba("oficina", "orcamentos"), IC.calc], ["Oficina", "Produção", vaiAba("oficina", "producao"), IC.imp],
    ["Oficina", "Peça nova", function () { irAba("oficina", "pecas"); carregarProdutos().then(function () { folhaProduto(null); }); }, IC.mais],
    ["Oficina", "Ordem das faixas", function () { carregarProdutos().then(folhaFaixas); }, IC.entrada],
    ["Oficina", "Selos", function () { irAba("oficina", "producao"); }, IC.selo], ["Oficina", "Selar uma peça", function () { folhaSelar(); }, IC.ler],
    ["Oficina", "Imprimir folha de selos", function () { folhaImprimirSelos(); }, IC.imp], ["Oficina", "Lista de selos", function () { folhaListaSelos(""); }, IC.selo],
    ["Oficina", "Impressora", function () { irAba("oficina", "producao"); }, IC.imp],
    ["Divulgação", "Conteúdo", vaiAba("divulgacao", "conteudo"), IC.post], ["Divulgação", "Newsletter", vaiAba("divulgacao", "newsletter"), IC.envelope],
    ["Divulgação", "Links da bio", vaiAba("divulgacao", "links"), IC.copia], ["Divulgação", "Números", vaiAba("divulgacao", "numeros"), IC.dir],
    ["Ir", "Ajustes", function () { irPara("ajustes"); }, IC.engrenagem], ["Ajustes", "Ligar notificações", function () { irPara("ajustes"); }, IC.engrenagem],

  ];
  function abrirBusca() {
    if (folhaAberta) fecharFolha();
    buscaAberta = true;
    $("busca").classList.add("on"); $("veu").classList.add("on"); document.body.style.overflow = "hidden";
    var inp = $("qB"); inp.value = ""; inp.focus();
    if (!PROD.erro) carregarProdutos();
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
      (PROD.lista || []).forEach(function (pr) { if (tem(pr.nome, pr.subtitulo, pr.id)) achados.push({ tipo: "loja", rot: "Peça", tit: pr.nome, sub: nomeFaixa(pr.subcategoria) + ", " + brl(num(pr.preco)), fn: function () { folhaProduto(pr); } }); });
      S.lancamentos.forEach(function (l) { if (tem(l.label)) achados.push({ tipo: "feito", rot: "Entrada", tit: tituloEntrada(l), sub: dm(l.data) + ", " + brl(num(l.valor)), fn: function () { folhaEntrada(l); } }); });
      (S.marketing || []).forEach(function (p) { if (tem(p.titulo, p.ideia)) achados.push({ tipo: "post", rot: "Post", tit: p.titulo, sub: [p.formato, p.data ? dm(p.data) : ""].filter(Boolean).join(", "), fn: function () { folhaPost(p); } }); });
      clientes().forEach(function (c) { if (tem(c.nome, c.contato, c.tipo, c.notas)) achados.push({ tipo: "site", rot: "Cliente", tit: c.nome, sub: [c.tipo, (ETAPAS_CLI.filter(function (x) { return x[0] === c.etapa; })[0] || [])[1]].filter(Boolean).join(", "), fn: function () { folhaCliente(c); } }); });
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
      if (vista === "ajustes") render(true);
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
        else if (k === "atualizar") (NUM.ga4 = {}, NUM.ig = {}, MEI.dash = null, PROD.lista = null, carregar()).then(function () { render(true); aviso("Atualizado"); }).catch(function () { aviso("Sem conexão"); });
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

  /* ---------- áreas com abas: Sites, Finanças, Oficina, Divulgação ---------- */
  var ABAS = {
    sites: [["abordar", "Abordar"], ["prospectar", "Prospectar"], ["conversas", "Conversas"], ["clientes", "Clientes"]],
    financas: [["caixa", "Caixa"], ["receber", "A receber"], ["mei", "MEI"], ["metas", "Metas"]],
    oficina: [["pecas", "Peças"], ["pedidos", "Pedidos"], ["orcamentos", "Orçamentos"], ["producao", "Produção"]],
    divulgacao: [["conteudo", "Conteúdo"], ["newsletter", "Newsletter"], ["links", "Links"], ["numeros", "Números"]]
  };
  var NOME_AREA = { hoje: "Hoje", sites: "Sites", financas: "Finanças", agenda: "Agenda", oficina: "Oficina", divulgacao: "Divulgação", ajustes: "Ajustes" };
  var aba = Object.assign({ sites: "abordar", financas: "caixa", oficina: "pecas", divulgacao: "conteudo" }, lerLS("maratu.painel.abas", {}));
  function abaDe(v) { var l = ABAS[v] || [], a = aba[v]; return l.some(function (x) { return x[0] === a; }) ? a : (l[0] || [])[0]; }
  function irAba(v, a) {
    aba[v] = a; gravarLS("maratu.painel.abas", aba);
    if (v === "oficina") PROD.ordenando = false;
    if (vista !== v) { irPara(v); return; }
    window.scrollTo(0, 0); render(true);
  }
  function abasHTML(v, cont) {
    return '<div class="abas" role="tablist">' + ABAS[v].map(function (x) {
      var n = cont && cont[x[0]];
      return '<button role="tab" data-aba="' + v + ":" + x[0] + '" aria-pressed="' + (abaDe(v) === x[0]) + '">' + x[1] + (n ? ' <span class="n">' + n + "</span>" : "") + "</button>";
    }).join("") + "</div>";
  }
  function cabArea(v, sub, extra) { return '<div class="cab cab-area"><h1>' + NOME_AREA[v] + "</h1>" + (sub ? "<p>" + sub + "</p>" : "") + (extra || "") + "</div>"; }
  /* número clicável: leva pra aba ou abre algo */
  function numBt(n, rot, attr) { return '<button class="num num-bt" ' + attr + "><b>" + n + "</b><span>" + rot + "</span></button>"; }
  function ligarArea(raiz) {
    raiz.querySelectorAll("[data-aba]").forEach(function (b) { b.onclick = function () { var p = b.dataset.aba.split(":"); irAba(p[0], p[1]); }; });
    raiz.querySelectorAll("[data-cli]").forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var c = porId(clientes(), b.dataset.cli); if (c) folhaCliente(c); }; });
    raiz.querySelectorAll("[data-clinovo]").forEach(function (b) { b.onclick = function () { folhaCliente(null); }; });
    raiz.querySelectorAll("[data-clirecebi]").forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var c = porId(clientes(), b.dataset.clirecebi); if (c) folhaRecebiCliente(c, b.dataset.qual || "site"); }; });
    raiz.querySelectorAll("[data-leadst]").forEach(function (b) { b.onclick = function () { leadFiltro = b.dataset.leadst; render(true); }; });
    raiz.querySelectorAll("[data-esc]").forEach(function (b) { b.onclick = function () { var p = porId(S.prospec, b.dataset.esc); if (p) acaoProspec(p, "escolher", "Escolhido pra virar site"); }; });
    raiz.querySelectorAll("[data-insta]").forEach(function (b) { b.onclick = function () { var p = porId(S.prospec, b.dataset.insta); if (p) abrir(igUrl(p)); }; });
    raiz.querySelectorAll("[data-buscatira]").forEach(function (b) {
      confirmaDuplo(b, "Tirar?", function () {
        var i = Number(b.dataset.buscatira); S.buscas = S.buscas.filter(function (x, j) { return j !== i; }); render(true); aviso("Busca semanal tirada");
        api("/api/prospec/buscas", { method: "PUT", body: { buscas: S.buscas } }).catch(function () { aviso("Não salvou. Confira a internet."); });
      });
    });
    raiz.querySelectorAll("[data-orcapaga]").forEach(function (b) {
      confirmaDuplo(b, "Apagar?", function () {
        var id = b.dataset.orcapaga; S.orcamentos = (S.orcamentos || []).filter(function (x) { return String(x.id) !== id; });
        render(true); aviso("Orçamento apagado");
        gravarTabela("orcamentos", function (a) { return a.filter(function (x) { return String(x.id) !== id; }); });
      });
    });
    if (vista === "oficina" && abaDe("oficina") === "producao") ligarSelos(raiz);
    raiz.querySelectorAll("[data-custos]").forEach(function (b) { b.onclick = folhaCustos; });
    raiz.querySelectorAll("[data-newsst]").forEach(function (b) {
      b.onclick = function () {
        var i = porId(DIV.news.inscritos || [], b.dataset.newsst); if (!i) return;
        var novo = i.ativo ? 0 : 1; i.ativo = novo; DIV.news.ativos = (DIV.news.inscritos || []).filter(function (x) { return x.ativo; }).length; render(true);
        api("/api/newsletter/status", { method: "POST", body: { id: i.id, ativo: !!novo } }).catch(function () { i.ativo = novo ? 0 : 1; render(true); aviso("Não salvou. Confira a internet."); });
      };
    });
    raiz.querySelectorAll("[data-mais]").forEach(function (b) { b.onclick = function () { fecharFolha(); irPara(b.dataset.mais); }; });
    if (vista === "divulgacao") ligarDivulgacao(raiz);
    if (vista === "divulgacao" && abaDe("divulgacao") === "numeros") ligarNumeros(raiz);
    if (vista === "financas" && abaDe("financas") === "mei") ligarEmpresa(raiz);
    if (vista === "ajustes") ligarEstudio(raiz);
  }

  /* ---------- Sites ---------- */
  var leadFiltro = "ativos";
  function telaSites() {
    var g = prospecGrupos(), s = semanaAbordagem(), a = abaDe("sites");
    var leadsAtivos = S.leads.filter(function (l) { return l.status !== "fechado" && l.status !== "perdido"; });
    var emObra = clientes().filter(function (c) { return c.etapa !== "noar"; }).length;
    var topo = cabArea("sites", S.uso ? "Google " + (Number(S.uso.n) || 0) + " de " + (Number(S.teto) || 0) + " no mês" : "") +
      abasHTML("sites", { abordar: g.doDia.length, conversas: leadsAtivos.length, clientes: emObra });
    if (a === "prospectar") return topo + sitesProspectar(g);
    if (a === "conversas") return topo + sitesConversas();
    if (a === "clientes") return topo + sitesClientes();
    var itens = itensHoje().filter(function (i) { return i.tipo === "site"; });
    var esq = metasSites() +
      '<div class="nums">' + numBt(g.doDia.length, "pra hoje", 'data-rola="filaSites"') + numBt(s.resp, "respostas na semana", 'data-aba="sites:conversas"') + numBt(g.noAr.length, "no ar", 'data-rola="noAr"') + "</div>" +
      (itens.length ? '<div class="secao" id="filaSites">Pra hoje</div><div class="fila">' + itens.map(cartaHTML).join("") + "</div>" :
        '<div class="cartao vazio-acao" id="filaSites"><b>Nenhum envio pra hoje</b><button class="bt acento" data-aba="sites:prospectar">Escolher novos</button></div>');
    var dir = (g.noAr.length ? '<div class="secao" id="noAr">No ar <small>' + g.noAr.length + '</small></div><div class="cartao lista">' + g.noAr.slice().sort(function (x, y) { return (Number(y.ex_vistas) || 0) - (Number(x.ex_vistas) || 0); }).map(function (p) {
        var n = Number(p.ex_vistas) || 0;
        return '<div class="linha toca" data-site="' + esc(p.id) + '"><div class="o"><b>' + esc(p.nome) + "</b><small>" + (n ? "abriu " + n + "x" + (p.ex_ultima ? ", última " + quandoRel(diaLocal(p.ex_ultima)) : "") : "não abriu ainda") + (p.ex_expira ? ", sai do ar em " + dm(String(p.ex_expira).slice(0, 10)) : "") + "</small></div>" + IC.seta + "</div>";
      }).join("") + "</div>" : "") +
      (g.depois.length ? '<div class="secao">Aguardando <small>' + g.depois.length + '</small></div><div class="cartao lista">' + g.depois.slice().sort(function (x, y) { return (x.proximo || "9") < (y.proximo || "9") ? -1 : 1; }).map(function (p) {
        return '<div class="linha toca" data-site="' + esc(p.id) + '"><div class="o"><b>' + esc(p.nome) + "</b><small>" + PASSO[Math.min(Number(p.passo) || 0, 3)] + (p.proximo ? " em " + dm(p.proximo) : "") + "</small></div>" + IC.seta + "</div>";
      }).join("") + "</div>" : "");
    if (!dir) dir = '<div class="secao">No ar</div><p class="vazio">Nenhum site no ar.</p>';
    return topo + colunas(esq, dir);
  }
  function sitesProspectar(g) {
    var res = g.reserva.slice().sort(function (a, b) { return (Number(b.seguidores) || 0) - (Number(a.seguidores) || 0) || (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0); });
    var esq = '<div class="nums">' + numBt(res.length, "na reserva", "data-reserva") + numBt(g.escolhidos.length, "escolhidos", 'data-rola="escolhidos"') + numBt((S.buscas || []).length, "buscas semanais", 'data-rola="buscasSem"') + "</div>" +
      '<div class="grade-bts"><button class="bt" data-reserva>Ver a reserva toda</button><button class="bt acento" data-buscar>Buscar negócios</button></div>' +
      '<div class="secao" id="escolhidos">Escolhidos pra virar site <small>' + g.escolhidos.length + "</small></div>" +
      (g.escolhidos.length ? '<div class="cartao lista">' + g.escolhidos.map(function (p) {
        return '<div class="linha"><div class="o"><b>' + esc(p.nome) + "</b><small>" + esc([p.consulta || p.ramo, p.cidade].filter(Boolean).join(", ")) + '</small></div><button class="bt" data-devolver="' + esc(p.id) + '">Devolver</button></div>';
      }).join("") + "</div>" : '<p class="vazio">Nenhum escolhido.</p>') +
      '<div class="secao" id="buscasSem">Buscas toda segunda</div>' +
      ((S.buscas || []).length ? '<div class="cartao lista">' + S.buscas.map(function (b, i) {
        return '<div class="linha"><div class="o"><b>' + esc(b.consulta) + "</b><small>" + esc(b.cidade === "capitais" ? "as 27 capitais" : b.cidade === "grandes" ? "as 40 maiores cidades" : b.cidade) + '</small></div><button class="ico-bt copia-link" data-buscatira="' + i + '" aria-label="Tirar">' + IC.x + "</button></div>";
      }).join("") + "</div>" : '<p class="vazio">Nenhuma busca semanal.</p>');
    var dir = '<div class="secao">Melhores da reserva</div>' + (res.length ? '<div class="cartao lista">' + res.slice(0, 12).map(function (p) {
      var meta = [p.consulta || p.ramo, p.cidade, p.seguidores ? Number(p.seguidores).toLocaleString("pt-BR") + " seguidores" : ""].filter(Boolean).join(", ");
      return '<div class="linha"><div class="o"><b>' + esc(p.nome) + "</b><small>" + esc(meta) + '</small></div><button class="bt" data-insta="' + esc(p.id) + '" aria-label="Instagram">' + IC.ig + '</button><button class="bt preto" data-esc="' + esc(p.id) + '">Escolher</button></div>';
    }).join("") + "</div>" + (res.length > 12 ? '<button class="bt-link" data-reserva style="justify-self:start;color:var(--tinta-sobre-tela);">Mais ' + (res.length - 12) + " na reserva</button>" : "") :
      '<div class="cartao vazio-acao"><b>A reserva está vazia</b><button class="bt acento" data-buscar>Buscar negócios</button></div>');
    return colunas(esq, dir);
  }
  var STL = { novo: ["Novo", "t-site"], conversando: ["Conversando", "t-lead"], fechado: ["Fechado", "t-feito"], perdido: ["Perdido", "t-loja"] };
  function sitesConversas() {
    var cont = { ativos: 0, novo: 0, conversando: 0, fechado: 0, perdido: 0 };
    S.leads.forEach(function (l) { cont[l.status] = (cont[l.status] || 0) + 1; if (l.status !== "fechado" && l.status !== "perdido") cont.ativos++; });
    var vis = S.leads.filter(function (l) { return leadFiltro === "ativos" ? l.status !== "fechado" && l.status !== "perdido" : l.status === leadFiltro; })
      .sort(function (a, b) { return (a.followup || "9") < (b.followup || "9") ? -1 : 1; });
    if (leadFiltro === "fechado" || leadFiltro === "perdido") vis.reverse();
    var temCli = {}; clientes().forEach(function (c) { if (c.lead_id) temCli[c.lead_id] = 1; });
    return '<div class="filtros">' + [["ativos", "Em aberto"], ["novo", "Novos"], ["conversando", "Conversando"], ["fechado", "Fechados"], ["perdido", "Perdidos"]].map(function (x) {
        return '<button class="chip-bt" data-leadst="' + x[0] + '" aria-pressed="' + (leadFiltro === x[0]) + '">' + x[1] + ' <span class="n">' + (cont[x[0]] || 0) + "</span></button>";
      }).join("") + "</div>" +
      '<button class="bt acento cheio" data-novo="lead">' + IC.mais + "Novo lead</button>" +
      (vis.length ? '<div class="cartao lista">' + vis.map(function (l) {
        var st = STL[l.status] || [l.status || "", "t-loja"], fim = l.status === "fechado" || l.status === "perdido";
        var atras = l.followup && l.followup < hoje() && !fim;
        var quando = l.followup && l.status !== "perdido" ? (l.status === "fechado" ? "fechado em " : atras ? "atrasado desde " : "falar " ) + (l.status === "fechado" || atras ? dm(l.followup) : quandoRel(l.followup)) : "";
        return '<div class="linha toca" data-lead="' + esc(l.id) + '"><div class="o"><b>' + esc(l.nome || "Sem nome") + "</b><small" + (atras ? ' style="color:var(--atraso);font-weight:900"' : "") + ">" + esc([l.interesse, quando, temCli[l.id] ? "virou cliente" : ""].filter(Boolean).join(", ")) + '</small></div><span class="tipo ' + st[1] + '">' + esc(st[0]) + "</span></div>";
      }).join("") + "</div>" : '<p class="vazio">Nenhum lead aqui.</p>');
  }

  /* ---------- Clientes de site: contrato, etapa e mensalidade ---------- */
  var TIPOS_SITE = ["Página", "Site", "Site + painel", "Painel", "Portfólio"];
  var ETAPAS_CLI = [["briefing", "Briefing"], ["fazendo", "Fazendo"], ["aprovacao", "Aprovação"], ["noar", "No ar"]];
  function clientes() { return S.clientes || []; }
  function saldoCli(c) { return Math.max(0, num(c.valor) - num(c.pago)); }
  function mesDe(iso) { return String(iso || hoje()).slice(0, 7); }
  function nomeMes(ym) { return MESES[Number(String(ym).slice(5, 7)) - 1] || ""; }
  /* a mensalidade do mês conta a partir do dia combinado, e só depois de o site ir pro ar */
  function mensalDevida(c, ym) {
    ym = ym || mesDe();
    if (!(num(c.manut_valor) > 0) || c.etapa !== "noar") return false;
    if (c.manut_inicio && c.manut_inicio > ym) return false;
    if (ym === mesDe() && Number(hoje().slice(8)) < Math.min(28, Math.max(1, Number(c.manut_dia) || 10))) return false;
    return (c.manut_pagos || []).indexOf(ym) < 0;
  }
  function aReceberSites() { return clientes().reduce(function (a, c) { return a + saldoCli(c) + (mensalDevida(c) ? num(c.manut_valor) : 0); }, 0); }
  function etapaTag(c) { var e = ETAPAS_CLI.filter(function (x) { return x[0] === c.etapa; })[0] || ETAPAS_CLI[0]; return '<span class="tipo ' + (c.etapa === "noar" ? "t-feito" : c.etapa === "aprovacao" ? "t-lead" : "t-site") + '">' + e[1] + "</span>"; }
  function linhaCliente(c) {
    var saldo = saldoCli(c), info = [c.tipo, num(c.valor) ? (saldo ? "falta " + brlCurtoV(saldo) : "pago") : "", num(c.manut_valor) ? brlCurtoV(num(c.manut_valor)) + " por mês" + (mensalDevida(c) ? ", " + nomeMes(mesDe()) + " em aberto" : "") : ""].filter(Boolean).join(", ");
    return '<div class="linha toca" data-cli="' + esc(c.id) + '"><div class="o"><b>' + esc(c.nome || "Cliente") + "</b><small>" + esc(info) + "</small></div>" + etapaTag(c) + "</div>";
  }
  function sitesClientes() {
    var l = clientes(), obra = l.filter(function (c) { return c.etapa !== "noar"; }), noar = l.filter(function (c) { return c.etapa === "noar"; });
    var ordem = { briefing: 0, fazendo: 1, aprovacao: 2 };
    obra.sort(function (a, b) { return (ordem[a.etapa] || 0) - (ordem[b.etapa] || 0); });
    var mensal = noar.reduce(function (a, c) { return a + num(c.manut_valor); }, 0);
    var esq = '<div class="nums">' + numBt(obra.length, "em produção", 'data-rola="cliObra"') + numBt(brlCurtoV(aReceberSites()), "a receber", 'data-aba="financas:receber"') + numBt(brlCurtoV(mensal), "por mês", 'data-rola="cliNoar"') + "</div>" +
      '<button class="bt acento cheio" data-clinovo>' + IC.mais + "Novo cliente</button>" +
      '<div class="secao" id="cliObra">Em produção <small>' + obra.length + "</small></div>" +
      (obra.length ? '<div class="cartao lista">' + obra.map(linhaCliente).join("") + "</div>" : '<p class="vazio">Nenhum site em produção. Um lead que fecha vira cliente pelo botão na ficha dele.</p>');
    var dir = '<div class="secao" id="cliNoar">No ar <small>' + noar.length + "</small></div>" +
      (noar.length ? '<div class="cartao lista">' + noar.map(linhaCliente).join("") + "</div>" : '<p class="vazio">Nenhum cliente no ar.</p>');
    return colunas(esq, dir);
  }
  function tipoDoInteresse(t) { t = norm(t); return /painel/.test(t) && /site/.test(t) ? "Site + painel" : /painel/.test(t) ? "Painel" : /portf/.test(t) ? "Portfólio" : /pagina/.test(t) ? "Página" : "Site"; }
  function folhaCliente(c, base) {
    var novo = !c; c = c || Object.assign({ etapa: "briefing", tipo: "Site", fechado_em: hoje(), manut_dia: 10 }, base || {});
    var v = function (x) { return num(x) ? esc(String(num(x)).replace(".", ",")) : ""; }, tel = soDigitos(c.contato), saldo = saldoCli(c);
    var pagosTxt = (c.manut_pagos || []).slice().sort().reverse().slice(0, 6).map(function (m) { return nomeMes(m).slice(0, 3); }).join(", ");
    abrirFolha(novo ? "Novo cliente" : c.nome || "Cliente",
      (!novo ? '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + brlCurtoV(num(c.pago)) + '</b><span>recebido de ' + brlCurtoV(num(c.valor)) + '</span></div><div class="num"><b>' + (num(c.manut_valor) ? (mensalDevida(c) ? "em aberto" : "em dia") : "-") + "</b><span>" + (pagosTxt ? "pagou " + esc(pagosTxt) : "mensalidade") + "</span></div></div>" +
        '<div class="grade-bts">' + (saldo > 0 ? '<button class="bt verde" id="kRec">' + IC.check + "Recebi do projeto</button>" : "") + (mensalDevida(c) ? '<button class="bt verde" id="kMen">' + IC.check + "Mensalidade de " + nomeMes(mesDe()) + "</button>" : "") +
        (tel.length >= 10 ? '<a class="bt preto" href="' + esc(waLink(c.contato)) + '" target="_blank" rel="noopener">' + IC.wa + "WhatsApp</a>" : "") + (/^https?:\/\//.test(c.site || "") ? '<button class="bt" id="kSite">' + IC.olho + "Ver o site</button>" : "") + "</div>" : "") +
      campo("Nome", '<input id="kNome" value="' + esc(c.nome || "") + '" autocomplete="off">') +
      campo("WhatsApp", '<input id="kTel" value="' + esc(c.contato || "") + '" inputmode="tel" autocomplete="off">') +
      '<div class="rot">O que é</div>' + pilulas("ktipo", TIPOS_SITE.map(function (t) { return [t, t]; }), c.tipo || "Site") +
      '<div class="rot">Etapa</div>' + pilulas("ketapa", ETAPAS_CLI, c.etapa || "briefing") +
      '<div class="duas">' + campo("Valor do projeto (R$)", '<input id="kVal" inputmode="decimal" value="' + v(c.valor) + '" autocomplete="off">') + campo("Fechou em", '<input id="kFec" type="date" value="' + esc(c.fechado_em || "") + '">') + "</div>" +
      (novo ? campo("Já recebi (R$)", '<input id="kPago" inputmode="decimal" autocomplete="off">') : "") +
      '<div class="duas">' + campo("Mensalidade (R$)", '<input id="kMan" inputmode="decimal" value="' + v(c.manut_valor) + '" autocomplete="off">') + campo("Vence todo dia", '<input id="kDia" type="number" min="1" max="28" inputmode="numeric" value="' + esc(c.manut_dia || 10) + '">') + "</div>" +
      campo("Endereço do site", '<input id="kUrl" type="url" inputmode="url" value="' + esc(c.site || "") + '" autocomplete="off">') +
      campo("Notas", '<textarea id="kNot">' + esc(c.notas || "") + "</textarea>") +
      (novo ? "" : '<button class="bt cheio perigo" id="kApaga">Apagar cliente</button>') +
      '<div class="fixo"><button class="bt acento cheio" id="kSalva">' + (novo ? "Criar cliente" : "Salvar") + "</button></div>",
      function (f) {
        ligaPilulas(f);
        var q = function (s) { return f.querySelector(s); };
        if (q("#kRec")) q("#kRec").onclick = function () { fecharFolha(); folhaRecebiCliente(c, "site"); };
        if (q("#kMen")) q("#kMen").onclick = function () { fecharFolha(); mensalidadePaga(c); };
        if (q("#kSite")) q("#kSite").onclick = function () { abrir(c.site); };
        q("#kSalva").onclick = function () {
          var m = { nome: q("#kNome").value.trim(), contato: q("#kTel").value.trim(), tipo: pil(f, "ktipo") || "Site", etapa: pil(f, "ketapa") || "briefing", valor: num(q("#kVal").value),
            fechado_em: q("#kFec").value || null, manut_valor: num(q("#kMan").value), manut_dia: Math.min(28, Math.max(1, parseInt(q("#kDia").value, 10) || 10)), site: q("#kUrl").value.trim() || null, notas: q("#kNot").value.trim() || null };
          if (!m.nome) return q("#kNome").focus();
          if (m.etapa === "noar" && c.etapa !== "noar" && !c.manut_inicio) m.manut_inicio = somaMesYM(mesDe(), 1);
          if (novo) {
            var pago = num(q("#kPago").value), n = Object.assign({ id: uid("c"), criado: new Date().toISOString(), pago: pago, manut_pagos: [], lead_id: c.lead_id || null }, m);
            if (n.etapa === "noar" && !n.manut_inicio) n.manut_inicio = somaMesYM(mesDe(), 1);
            S.clientes = clientes().concat([n]); fecharFolha(); aba.sites = "clientes"; gravarLS("maratu.painel.abas", aba); render(true); aviso("Cliente criado");
            gravarTabela("clientes", function (a) { return a.concat([n]); });
            if (pago > 0) lancarEntradaCliente(n, pago, "sinal");
            return;
          }
          Object.assign(c, m); fecharFolha(); render(true); aviso("Salvo");
          gravarTabela("clientes", function (a) { return trocaItem(a, c.id, m); });
        };
        if (q("#kApaga")) confirmaDuplo(q("#kApaga"), "Toque de novo pra apagar", function () {
          fecharFolha(); var antes = clientes().slice();
          executar("Cliente apagado", function () { S.clientes = clientes().filter(function (x) { return x.id !== c.id; }); }, function () { S.clientes = antes; },
            function () { gravarTabela("clientes", function (a) { return a.filter(function (x) { return x.id !== c.id; }); }); });
        });
      });
  }
  function somaMesYM(ym, n) { var p = ym.split("-").map(Number), d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
  function lancarEntradaCliente(c, valor, rotulo) {
    var l = { id: uid("m"), data: hoje(), label: "Site " + (c.nome || "") + ", " + rotulo, valor: valor };
    S.lancamentos.push(l);
    gravarTabela("lancamentos", function (a) { return a.concat([l]); });
    return l;
  }
  function folhaRecebiCliente(c, qual) {
    if (qual === "mensal") { mensalidadePaga(c); return; }
    var saldo = saldoCli(c);
    abrirFolha("Recebi de " + (c.nome || "cliente"),
      campo("Valor", '<input id="rV" class="valor-grande" inputmode="decimal" value="' + (saldo ? esc(String(saldo).replace(".", ",")) : "") + '" autocomplete="off">') +
      '<p class="sub" style="margin:0;font-size:14px;font-weight:700;">Falta ' + brl(saldo) + " de " + brl(num(c.valor)) + "</p>" +
      '<div class="fixo"><button class="bt acento cheio" id="rOk">Lançar entrada</button></div>',
      function (f) {
        f.querySelector("#rOk").onclick = function () {
          var v = num(f.querySelector("#rV").value); if (!v) return f.querySelector("#rV").focus();
          var pago = num(c.pago) + v; c.pago = pago; fecharFolha();
          lancarEntradaCliente(c, v, pago >= num(c.valor) ? "quitado" : "parcela");
          conta("carne"); render(true); aviso("Entrou " + brl(v));
          gravarTabela("clientes", function (a) { return trocaItem(a, c.id, { pago: pago }); });
        };
      });
  }
  function mensalidadePaga(c) {
    var ym = mesDe(), antes = (c.manut_pagos || []).slice(), depois = antes.concat([ym]), v = num(c.manut_valor), l = null;
    conta("carne");
    executar("Mensalidade de " + nomeMes(ym) + " recebida", function () { c.manut_pagos = depois; }, function () { c.manut_pagos = antes; },
      function () {
        l = lancarEntradaCliente(c, v, "mensalidade de " + nomeMes(ym));
        gravarTabela("clientes", function (a) { return a.map(function (x) { return x.id === c.id ? Object.assign({}, x, { manut_pagos: (x.manut_pagos || []).concat((x.manut_pagos || []).indexOf(ym) < 0 ? [ym] : []) }) : x; }); });
      });
  }
  /* cartões da fila: mensalidade do mês e o resto do projeto depois que o site vai pro ar */
  function itensClientes() {
    var out = [], h = hoje(), ym = mesDe();
    clientes().forEach(function (c) {
      var tel = soDigitos(c.contato);
      if (mensalDevida(c)) {
        var venc = ym + "-" + pad2(Math.min(28, Math.max(1, Number(c.manut_dia) || 10)));
        out.push({
          k: "mensal:" + c.id + ":" + ym, tipo: "carne", rot: "Mensalidade", ordem: 1, data: venc,
          titulo: "Mensalidade do " + (c.nome || "site"), sub: [c.tipo, brlV(num(c.manut_valor))].filter(Boolean).join(", "), quando: quandoRel(venc),
          acoes: tel.length >= 10 ? '<a class="bt preto" href="' + esc(waLink(c.contato, "Oi, " + (c.nome || "") + "! Passando pra lembrar da mensalidade do site de " + nomeMes(ym) + ", " + brl(num(c.manut_valor)) + ". Pix: " + PIX)) + '" target="_blank" rel="noopener">' + IC.wa + "Cobrar</a>" : "",
          dir: { rot: "Recebi", fn: function () { mensalidadePaga(c); } },
          esq: { rot: "Amanhã", fn: function () { adiarCartao("mensal:" + c.id + ":" + ym); } },
          abre: function () { folhaCliente(c); }
        });
      }
      if (c.etapa === "noar" && saldoCli(c) > 0) {
        out.push({
          k: "saldo:" + c.id + ":" + num(c.pago), tipo: "carne", rot: "Site", ordem: 1.2, data: h,
          titulo: "Receber o resto do " + (c.nome || "site"), sub: "Falta " + brlV(saldoCli(c)) + " de " + brlV(num(c.valor)), quando: "",
          acoes: tel.length >= 10 ? '<a class="bt preto" href="' + esc(waLink(c.contato)) + '" target="_blank" rel="noopener">' + IC.wa + "WhatsApp</a>" : "",
          dir: { rot: "Recebi", fn: function () { folhaRecebiCliente(c, "site"); } },
          esq: { rot: "Depois", fn: function () { adiarCartao("saldo:" + c.id + ":" + num(c.pago), somaDias(h, 3)); } },
          abre: function () { folhaCliente(c); }
        });
      }
    });
    return out;
  }

  /* ---------- Finanças ---------- */
  function telaFinancas() {
    var a = abaDe("financas"), r = resumoMes();
    var cont = { receber: carnesAbertos() + clientes().filter(function (c) { return saldoCli(c) > 0 || mensalDevida(c); }).length };
    var x = S.extras && S.extras.mei; if (x && x.das_meses) cont.mei = x.das_meses.filter(function (m) { return !m.paid && m.dias_ate_vencimento <= 5; }).length;
    var topo = cabArea("financas", cap(r.mes) + ", " + brlCurtoV(r.total), '<button class="ico-bt olho" data-olho aria-label="' + (oculto() ? "Mostrar valores" : "Esconder valores") + '" aria-pressed="' + oculto() + '">' + (oculto() ? IC.olhoFechado : IC.olho) + "</button>") + abasHTML("financas", cont);
    if (a === "receber") return topo + finReceber();
    if (a === "mei") return topo + telaEmpresa();
    if (a === "metas") return topo + finMetas();
    if (pc()) return topo + colunas(lojaCaixa(), '<div class="secao" style="margin-top:6px;">Meta do mês</div>' + cartaoMes(true) + resumoReceber());
    return topo + lojaCaixa();
  }
  function carnesAbertos() {
    var ids = {}; eventosVivos().forEach(function (e) { if (e.tipo === "cobranca" && !e.feito) ids[kv(e.notas).carne || e.cliente || e.id] = 1; });
    return Object.keys(ids).length;
  }
  function faltaCarne() { var t = 0; eventosVivos().forEach(function (e) { if (e.tipo === "cobranca" && !e.feito) t += num(kv(e.notas).valor); }); return t; }
  function resumoReceber() {
    var c = faltaCarne(), s = aReceberSites();
    return '<div class="secao">A receber<button class="bt-link" data-aba="financas:receber">Ver tudo</button></div><div class="cartao lista">' +
      '<div class="linha toca" data-aba="financas:receber"><div class="o"><b>Carnês</b><small>' + carnesAbertos() + " em aberto</small></div><span class=\"valor\">" + brlCurtoV(c) + "</span></div>" +
      '<div class="linha toca" data-aba="financas:receber"><div class="o"><b>Sites</b><small>projetos e mensalidades</small></div><span class="valor">' + brlCurtoV(s) + "</span></div></div>";
  }
  function finReceber() {
    var cl = clientes(), comSaldo = cl.filter(function (c) { return saldoCli(c) > 0; }), manut = cl.filter(function (c) { return num(c.manut_valor) > 0 && c.etapa === "noar"; });
    var ym = mesDe(), pagas = manut.filter(function (c) { return (c.manut_pagos || []).indexOf(ym) >= 0; }).length;
    var esq = '<div class="nums">' + numBt(brlCurtoV(faltaCarne() + aReceberSites()), "a receber", 'data-rola="recCarne"') + numBt(carnesAbertos(), "carnês abertos", 'data-rola="recCarne"') + numBt(pagas + "/" + manut.length, "mensalidades de " + nomeMes(ym).slice(0, 3), 'data-rola="recMensal"') + "</div>" +
      '<div class="secao" id="recCarne">Carnê<button class="bt-link" data-novo="carne">Novo carnê</button></div>' + lojaCarne(true);
    var dir = '<div class="secao" id="recMensal">Mensalidades de ' + nomeMes(ym) + "</div>" +
      (manut.length ? '<div class="cartao lista">' + manut.map(function (c) {
        var paga = (c.manut_pagos || []).indexOf(ym) >= 0, devida = mensalDevida(c);
        return '<div class="linha toca" data-cli="' + esc(c.id) + '"' + (paga ? ' style="opacity:.6"' : "") + '><div class="o"><b>' + esc(c.nome) + "</b><small>" + (paga ? "paga" : devida ? "venceu dia " + (c.manut_dia || 10) : c.manut_inicio && c.manut_inicio > ym ? "começa em " + nomeMes(c.manut_inicio) : "vence dia " + (c.manut_dia || 10)) + '</small></div><span class="valor">' + brlCurtoV(num(c.manut_valor)) + "</span>" +
          (devida ? '<button class="bt verde" data-clirecebi="' + esc(c.id) + '" data-qual="mensal">Recebi</button>' : "") + "</div>";
      }).join("") + "</div>" : '<p class="vazio">Nenhum site com mensalidade.</p>') +
      '<div class="secao">Projetos com saldo</div>' +
      (comSaldo.length ? '<div class="cartao lista">' + comSaldo.map(function (c) {
        return '<div class="linha toca" data-cli="' + esc(c.id) + '"><div class="o"><b>' + esc(c.nome) + "</b><small>recebido " + brlCurtoV(num(c.pago)) + " de " + brlCurtoV(num(c.valor)) + '</small></div><span class="valor">' + brlCurtoV(saldoCli(c)) + '</span><button class="bt verde" data-clirecebi="' + esc(c.id) + '">Recebi</button></div>';
      }).join("") + "</div>" : '<p class="vazio">Nenhum projeto com saldo.</p>');
    return colunas(esq, dir);
  }
  function metasParam() { var p = S.params || {}; return { contatos: num(p.meta_contatos) || META_CONTATOS, sites: num(p.meta_sites) || META_SITES }; }
  function finMetas() {
    var h = hoje(), dias = [], vals7 = [];
    for (var i = 6; i >= 0; i--) { var d = somaDias(h, -i); dias.push(SEM3[dataDe(d).getDay()].slice(0, 3)); vals7.push(S.lancamentos.filter(function (l) { return l.data === d; }).reduce(function (a, l) { return a + num(l.valor); }, 0)); }
    var hoj = new Date(), meses = [], vals6 = [];
    for (var k = 5; k >= 0; k--) { var dt = new Date(hoj.getFullYear(), hoj.getMonth() - k, 1); meses.push(MESES[dt.getMonth()].slice(0, 3)); vals6.push(somaMes(dt.getFullYear(), dt.getMonth())); }
    var soma7 = vals7.reduce(function (a, b) { return a + b; }, 0), soma6 = vals6.reduce(function (a, b) { return a + b; }, 0), p = S.params || {};
    var linha = function (rot, val) { return '<div class="linha toca" data-custos><div class="o"><b>' + rot + '</b></div><span class="valor">' + val + "</span></div>"; };
    var esq = '<div class="secao" style="margin-top:6px;">Meta do mês</div>' + cartaoMes(true) + '<div class="secao">Vendas de site</div>' + metasSites() +
      '<div class="secao">Entradas</div><div class="cartao g-cartao' + (oculto() ? " g-oculto" : "") + '"><div class="g-cab"><b>Últimos 7 dias</b><span class="valor">' + brlCurtoV(soma7) + "</span></div>" + graficoBarras(vals7, dias, 6) + "</div>" +
      '<div class="cartao g-cartao' + (oculto() ? " g-oculto" : "") + '"><div class="g-cab"><b>Últimos 6 meses</b><span class="valor">' + brlCurtoV(soma6) + "</span></div>" + graficoBarras(vals6, meses, 5) + "</div>";
    var dir = '<div class="secao">Mês<button class="bt-link" data-custos>Mudar</button></div><div class="cartao lista">' + linha("Custo fixo", brlCurtoV(num(p.fixo))) + linha("Retirada", brlCurtoV(num(p.retirada))) + linha("Contatos por semana", metasParam().contatos) + linha("Sites por mês", metasParam().sites) + "</div>" +
      '<div class="secao">Peça impressa<button class="bt-link" data-custos>Mudar</button></div><div class="cartao lista">' + linha("Filamento", brlCurto(num(p.filamento)) + "/kg") + linha("Máquina", brlCurto(num(p.maquina)) + "/h") + linha("Mão de obra", brlCurto(num(p.maodeobra)) + "/h") + linha("Margem", String(num(p.margem) || 1).replace(".", ",") + "x") + "</div>" +
      '<div class="cartao lista"><div class="linha toca" data-relatorio><div class="o"><b>Relatório da semana</b><small>Pronto pra copiar</small></div>' + IC.seta + "</div></div>";
    return colunas(esq, dir);
  }

  /* ---------- Oficina ---------- */
  var IMP_PEDIDA = 0;
  function telaOficina() {
    var a = abaDe("oficina"), abertos = S.pedidos.filter(function (p) { return p.status === "aberto"; }).length;
    var topo = cabArea("oficina") + abasHTML("oficina", { pedidos: abertos, orcamentos: 0 });
    if (a === "pedidos") return topo + lojaPedidos();
    if (a === "orcamentos") return topo + oficinaOrcamentos();
    if (a === "producao") return topo + oficinaProducao();
    return topo + lojaProdutos();
  }
  function oficinaOrcamentos() {
    var lista = (S.orcamentos || []).slice().sort(function (a, b) { return String(b.data) < String(a.data) ? -1 : 1; }), p = paramsOrc();
    var mes = mesDe(), doMes = lista.filter(function (o) { return mesDe(o.data) === mes; });
    var esq = '<div class="nums">' + '<div class="num"><b>' + lista.length + '</b><span>orçamentos</span></div><div class="num"><b>' + doMes.length + "</b><span>em " + nomeMes(mes).slice(0, 3) + '</span></div><div class="num"><b>' + brlCurtoV(doMes.reduce(function (s, o) { return s + num(o.total); }, 0)) + "</b><span>orçado no mês</span></div></div>" +
      '<button class="bt acento cheio" data-novo="orcamento">' + IC.mais + "Novo orçamento</button>" +
      (lista.length ? '<div class="cartao lista">' + lista.map(function (o) {
        return '<div class="linha"><div class="o"><b>' + esc(o.cliente || "Sem nome") + "</b><small>" + dm(o.data) + ", " + esc(String(o.gramas || 0).replace(".", ",")) + " g, " + esc(String(o.horas || 0).replace(".", ",")) + ' h</small></div><span class="valor">' + brl(num(o.total)) + '</span><button class="ico-bt copia-link" data-orcapaga="' + esc(o.id) + '" aria-label="Apagar">' + IC.x + "</button></div>";
      }).join("") + "</div>" : '<p class="vazio">Nenhum orçamento.</p>');
    var dir = '<div class="secao">Conta usada</div><div class="cartao lista">' +
      [["Filamento", brlCurto(p.filamento) + "/kg"], ["Máquina", brlCurto(p.maquina) + "/h"], ["Mão de obra", brlCurto(p.maodeobra) + "/h"], ["Margem", String(p.margem).replace(".", ",") + "x"]].map(function (x) { return '<div class="linha toca" data-custos><div class="o"><b>' + x[0] + '</b></div><span class="valor">' + x[1] + "</span></div>"; }).join("") + "</div>";
    return colunas(esq, dir);
  }
  function impHTML(imp) {
    if (!imp || !imp.conectada) return '<p class="vazio">A impressora ainda não mandou notícia.</p>';
    var d = imp.estado || {}, an = imp.analise || {}, idade = idadeImp(imp), ativo = ["printing", "paused"].indexOf(d.estado) >= 0;
    var pct = Math.round((Number(an.progresso != null ? an.progresso : d.progresso) || 0) * 100), termina = an.termina ? new Date(an.termina) : null;
    return '<div class="cartao imp-estado"><div class="imp-l1"><span class="pulso' + (ativo && idade < 180 ? "" : " parado") + '"></span><b>' + esc(ESTADO_IMP[d.estado] || d.estado || "Sem estado") + '</b><small>sinal há ' + (idade < 90 ? Math.round(idade) + " s" : idade < 5400 ? Math.round(idade / 60) + " min" : Math.round(idade / 3600) + " h") + "</small></div>" +
        (ativo ? '<p class="imp-peca">' + esc(nomeArquivo(d.arquivo)) + '</p><div class="barra-meta"><i style="width:' + pct + '%"></i></div><div class="rodape-imp"><span>' + pct + "%" + (d.camada ? ", camada " + esc(d.camada) + (d.camadas ? " de " + esc(d.camadas) : "") : "") + "</span><span>" + (termina && !isNaN(termina) ? "termina " + pad2(termina.getHours()) + ":" + pad2(termina.getMinutes()) : an.restante ? "faltam " + duracaoTxt(an.restante) : "") + "</span></div>" : "") +
      "</div>" +
      ((imp.saude || []).filter(function (s) { return s.k !== "sinal"; }).length ? '<div class="imp-saude">' + imp.saude.filter(function (s) { return s.k !== "sinal"; }).map(function (s) { return '<div class="num' + (s.ok ? "" : " ruim") + '"><b>' + esc(s.txt) + "</b><span>" + esc(s.rot) + "</span></div>"; }).join("") + "</div>" : "") +
      ((imp.historico || []).length ? '<div class="rot">Últimas impressões</div><div class="cartao lista">' + imp.historico.map(function (h) {
        var ok = h.status === "completed" || h.status === "complete";
        return '<div class="linha"><div class="o"><b>' + esc(h.nome || nomeArquivo(h.arquivo)) + "</b><small>" + (h.inicio ? esc(dm(diaLocal(h.inicio))) + ", " : "") + (h.duracao ? duracaoTxt(h.duracao) : "") + '</small></div><span class="tipo ' + (ok ? "t-feito" : h.status === "printing" ? "t-lead" : "t-aviso") + '">' + esc(ok ? "pronta" : h.status === "printing" ? "agora" : h.status || "?") + "</span></div>";
      }).join("") + "</div>" : "");
  }
  function oficinaProducao() {
    if (Date.now() - IMP_PEDIDA > 60000) {
      IMP_PEDIDA = Date.now();
      api("/api/impressora").then(function (imp) { S.extras = S.extras || {}; S.extras.imp = imp; if (vista === "oficina" && abaDe("oficina") === "producao" && !folhaAberta) render(true); }).catch(function () {});
    }
    return colunas(telaSelos(), '<div class="secao" style="margin-top:6px;">Impressora K1C</div>' + impHTML(S.extras && S.extras.imp));
  }

  /* ---------- Divulgação ---------- */
  function telaDivulgacaoArea() {
    var a = abaDe("divulgacao"), lista = posts(), prog = lista.filter(function (p) { return p.status === "aprovado"; }).length;
    if (!DIV.links) { DIV.links = "carregando"; api("/api/links/stats").then(function (d) { DIV.links = d.stats || []; }).catch(function () { DIV.links = []; }).then(function () { if (vista === "divulgacao") render(true); }); }
    if (!DIV.news) { DIV.news = "carregando"; api("/api/newsletter/lista").then(function (d) { DIV.news = d; }).catch(function () { DIV.news = {}; }).then(function () { if (vista === "divulgacao") render(true); }); }
    var ativos = DIV.news && typeof DIV.news === "object" && DIV.news.ativos != null ? DIV.news.ativos : 0;
    var topo = cabArea("divulgacao") + abasHTML("divulgacao", { conteudo: prog, newsletter: ativos });
    if (a === "newsletter") return topo + divNewsletter();
    if (a === "links") return topo + divLinks();
    if (a === "numeros") return topo + telaNumeros();
    return topo + divConteudo();
  }
  function divConteudo() {
    var lista = posts(), h = hoje(), cont = {};
    lista.forEach(function (p) { cont[p.status || "ideia"] = (cont[p.status || "ideia"] || 0) + 1; });
    var prox = lista.filter(function (p) { return p.status === "aprovado" && p.data; }).sort(function (a, b) { return (a.data + (a.hora || "")) < (b.data + (b.hora || "")) ? -1 : 1; });
    var vis = lista.filter(function (p) { return (p.status || "ideia") === DIV.etapa; }).sort(function (a, b) { return DIV.etapa === "ideia" ? (String(b.criado) < String(a.criado) ? -1 : 1) : (String(a.data || "9") < String(b.data || "9") ? (DIV.etapa === "publicado" ? 1 : -1) : (DIV.etapa === "publicado" ? -1 : 1)); });
    var linhaPost = function (p) {
      var atras = p.status === "aprovado" && p.data && p.data < h;
      return '<div class="linha toca" data-post="' + esc(p.id) + '"><div class="o"><b>' + esc(p.titulo || "Sem título") + "</b><small" + (atras ? ' style="color:var(--atraso);font-weight:900"' : "") + ">" + esc([p.formato, p.rede, p.data ? (atras ? "era pra " : "") + quandoRel(p.data) + (p.hora ? " " + p.hora : "") : ""].filter(Boolean).join(", ")) + "</small></div>" + IC.seta + "</div>";
    };
    var esq = '<div class="nums">' + ETAPAS_POST.map(function (e) { return numBt(cont[e[0]] || 0, e[1].toLowerCase(), 'data-etapa="' + e[0] + '"'); }).join("") + "</div>" +
      '<button class="bt acento cheio" data-novopost>' + IC.mais + "Nova ideia de post</button>" +
      '<div class="seg" role="group">' + ETAPAS_POST.map(function (e) { return '<button data-etapa="' + e[0] + '" aria-pressed="' + (DIV.etapa === e[0]) + '">' + e[1] + "</button>"; }).join("") + "</div>" +
      (vis.length ? '<div class="cartao lista">' + vis.map(linhaPost).join("") + "</div>" : '<p class="vazio">Nada aqui.</p>');
    var dir = '<div class="secao">Próximos a publicar</div>' + (prox.length ? '<div class="cartao lista">' + prox.slice(0, 8).map(linhaPost).join("") + "</div>" : '<p class="vazio">Nenhum post com dia marcado.</p>');
    return colunas(esq, dir);
  }
  function divNewsletter() {
    var n = DIV.news;
    if (n === "carregando") return '<div class="esqueleto"></div>';
    var ins = n && n.inscritos || [], mes = mesDe(), novos = ins.filter(function (i) { return mesDe(diaLocal(i.ts)) === mes; }).length;
    var esq = '<div class="nums"><div class="num"><b>' + (n && n.ativos || 0) + '</b><span>ativos</span></div><div class="num"><b>' + ins.length + '</b><span>inscritos</span></div><div class="num"><b>' + novos + "</b><span>novos em " + nomeMes(mes).slice(0, 3) + "</span></div></div>" +
      '<button class="bt acento cheio" data-news>' + IC.envelope + "Escrever e enviar</button>";
    var dir = '<div class="secao">Inscritos</div>' + (ins.length ? '<div class="cartao lista">' + ins.slice(0, 60).map(function (i) {
      return '<div class="linha"' + (i.ativo ? "" : ' style="opacity:.55"') + '><div class="o"><b>' + esc(i.email) + "</b><small>" + esc([i.origem, dm(diaLocal(i.ts))].filter(Boolean).join(", ")) + '</small></div><button class="bt" data-newsst="' + esc(i.id) + '">' + (i.ativo ? "Pausar" : "Voltar") + "</button></div>";
    }).join("") + "</div>" : '<p class="vazio">Ninguém inscrito ainda.</p>');
    return colunas(esq, dir);
  }
  function divLinks() {
    if (DIV.links === "carregando") return '<div class="esqueleto"></div>';
    var porSlug = {}, total = 0, mes = 0;
    if (Array.isArray(DIV.links)) DIV.links.forEach(function (s) { var k = String(s.slug || ""); (porSlug[k] = porSlug[k] || { n: 0, ultimo: 0, origens: [] }); porSlug[k].n += Number(s.n) || 0; total += Number(s.n) || 0; porSlug[k].ultimo = Math.max(porSlug[k].ultimo, Number(s.ultimo) || 0); porSlug[k].origens.push([s.origem || "sem origem", Number(s.n) || 0]); });
    var melhor = LINKS_BIO.slice().sort(function (a, b) { return ((porSlug[b[0]] || {}).n || 0) - ((porSlug[a[0]] || {}).n || 0); })[0];
    var esq = '<div class="nums" style="grid-template-columns:1fr 1fr;"><div class="num"><b>' + total + '</b><span>cliques nos links</span></div><div class="num"><b>' + esc(melhor && (porSlug[melhor[0]] || {}).n ? melhor[1] : "-") + "</b><span>mais clicado</span></div></div>" +
      '<div class="cartao lista">' + LINKS_BIO.map(function (l) {
        var s = porSlug[l[0]] || { n: 0, ultimo: 0, origens: [] };
        var ori = s.origens.sort(function (x, y) { return y[1] - x[1]; }).slice(0, 3).map(function (o) { return o[0] + " " + o[1]; }).join(", ");
        return '<div class="linha"><div class="o"><b>' + esc(l[1]) + "</b><small>maratu.com.br/go/" + esc(l[0]) + (ori ? ", " + esc(ori) : "") + '</small></div><span class="valor">' + s.n + '</span><button class="ico-bt copia-link" data-golink="' + esc(l[0]) + '" aria-label="Copiar o link">' + IC.copia + "</button></div>";
      }).join("") + "</div>";
    return esq;
  }

  /* ---------- Ajustes ---------- */
  function telaAjustes() {
    if (!ajustes.carregado) carregarAjustes();
    var tema = ""; try { tema = localStorage.getItem("maratu.painel.tema") || ""; } catch (e) {}
    var est = estadoPush(), podeLigar = est === "ligadas" || est === "desligadas";
    var linhaAj = function (attr, tit, estado, sub, seta) {
      return '<div class="linha' + (attr ? ' toca" ' + attr : '"') + '><div class="o"><b>' + tit + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + '</div><span class="estado-aj">' + esc(estado || "") + "</span>" + (seta === false ? "" : IC.seta) + "</div>";
    };
    var a = '<div class="secao" style="margin-top:6px;">Aparelho</div><div class="cartao lista">' +
        '<div class="linha"><div class="o"><b>Cor</b></div>' + pilulas("tema", [["", "Areia"], ["laranja", "Laranja"], ["noite", "Noite"]], tema) + "</div>" +
        linhaAj(podeLigar ? 'data-aj="push"' : "", "Notificações", est, ajustes.pushMsg, podeLigar) +
        (ajustes.push ? linhaAj('data-aj="teste"', "Mandar notificação de teste", "", "", false) : "") +
        linhaAj(ajustes.feed ? 'data-aj="feed"' : "", "Agenda no Apple Calendar", ajustes.feed ? "assinar" : "", "") +
      "</div>" +
      '<div class="secao">Segurança</div><div class="cartao lista">' +
        linhaAj('data-aj="passkey"', "Entrar com Face ID", ajustes.passkeys == null ? "" : ajustes.passkeys ? ajustes.passkeys + (ajustes.passkeys === 1 ? " aparelho" : " aparelhos") : "nenhum", "") +
        linhaAj('data-aj="2fa"', "Verificação em duas etapas", ajustes.totp == null ? "" : ajustes.totp ? "ligada" : "desligada", "") +
      "</div>";
    var b = '<div class="secao" style="margin-top:6px;">Dados</div><div class="cartao lista">' +
        linhaAj('data-aj="atualizar"', "Atualizar os dados", S.carregadoEm ? "às " + pad2(new Date(S.carregadoEm).getHours()) + ":" + pad2(new Date(S.carregadoEm).getMinutes()) : "", "", false) +
        linhaAj('data-aj="antigo"', "Abrir o painel antigo", "", "", true) +
        '<div class="linha toca" data-aj="sair"><div class="o"><b class="perigo">Sair</b></div></div>' +
      "</div>";
    return cabArea("ajustes") + colunas(a, b);
  }

  /* ---------- Selos: selar peça, imprimir folha, lista e alertas (antes era o módulo do painel antigo) ---------- */
  var SITE = "https://maratu.com.br";
  var EST_SELO = { branco: ["Em branco", "e-branco"], ativo: ["Na peça", "e-ativo"], vendido: ["Vendido", "e-vendido"], reivindicado: ["Com dono", "e-dono"], bloqueado: ["Bloqueado", "e-bloq"] };
  var SEL = { lista: null, alertas: null, produtos: null, pedindo: {} };
  function estSelo(k) { var e = EST_SELO[k] || [k || "?", "e-branco"]; return '<span class="est ' + e[1] + '">' + esc(e[0]) + "</span>"; }
  function normCodigo(s) { return String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 10); }
  function codigoDaLeitura(txt) { var m = /\/a\/([0-9A-Za-z]{6,12})/.exec(String(txt || "")); return m ? normCodigo(m[1]) : (/^[0-9A-Za-z]{6,12}$/.test(String(txt || "").trim()) ? normCodigo(txt) : ""); }
  function carregaSelos(forcar) {
    if (SEL.pedindo.lista || (SEL.lista && !forcar)) return SEL.pedindo.lista || Promise.resolve(SEL.lista);
    SEL.pedindo.lista = api("/api/selos?limit=1000").then(function (d) { SEL.lista = d.selos || []; return SEL.lista; })
      .then(function (x) { SEL.pedindo.lista = null; return x; }, function (e) { SEL.pedindo.lista = null; throw e; });
    return SEL.pedindo.lista;
  }
  function carregaAlertas(forcar) {
    if (SEL.pedindo.alertas || (SEL.alertas && !forcar)) return SEL.pedindo.alertas || Promise.resolve(SEL.alertas);
    SEL.pedindo.alertas = api("/api/selos/alertas").then(function (d) { SEL.alertas = d.alertas || []; return SEL.alertas; })
      .then(function (x) { SEL.pedindo.alertas = null; return x; }, function (e) { SEL.pedindo.alertas = null; throw e; });
    return SEL.pedindo.alertas;
  }
  function carregaSelProdutos() {
    if (SEL.produtos) return Promise.resolve(SEL.produtos);
    return api("/api/selos/produtos").then(function (d) { SEL.produtos = d.produtos || []; return SEL.produtos; });
  }
  /* "está tudo bem" fica guardado no aparelho, junto com o motivo: se o motivo mudar, o alerta volta */
  var SEL_OK = "maratu.selos.ok";
  function chaveAlerta(a) { return a.codigo + ":" + (a.motivos || []).join("|"); }
  function alertasAtivos() { var ok = lerLS(SEL_OK, {}); return (SEL.alertas || []).filter(function (a) { return !ok[chaveAlerta(a)]; }); }
  function alertaDe(codigo) { return alertasAtivos().filter(function (a) { return a.codigo === codigo; })[0] || null; }
  function recarregaSelos() {
    SEL.lista = null; SEL.alertas = null;
    api("/api/selos/resumo").then(function (d) { S.extras = S.extras || {}; S.extras.selos = d; guardaCache(); }).catch(function () {})
      .then(function () { if (vista === "oficina" && abaDe("oficina") === "producao" && !folhaAberta) render(true); });
  }
  function fotoPeca(sku) { var p = porId(PROD.lista || [], sku); return p && p.imagem_principal ? '<img class="miniprod" alt="" loading="lazy" src="' + esc(imgUrl(p.imagem_principal, "t")) + '">' : '<span class="miniprod sem-foto">' + esc(String((p && p.nome) || "?").charAt(0)) + "</span>"; }
  function linhaSelo(s) {
    var al = alertaDe(s.codigo);
    return '<div class="linha toca" data-selo="' + esc(s.codigo) + '">' + fotoPeca(s.sku) + '<div class="o"><b>' + esc(s.produto_nome || s.nome_peca || "Sem peça") + '</b><small><span class="codigo">' + esc(s.codigo) + "</span>" +
      (s.status === "branco" ? "" : ", " + (Number(s.acessos) || 0) + (Number(s.acessos) === 1 ? " acesso" : " acessos")) + (s.data_impressao ? ", " + dm(s.data_impressao) : "") + "</small></div>" +
      (al ? '<span class="est e-vendido">Alerta</span>' : estSelo(s.status)) + "</div>";
  }
  function telaSelos() {
    var sel = S.extras && S.extras.selos, por = sel && sel.por_status || {};
    if (sel && sel.alertas && !SEL.alertas) carregaAlertas().then(function () { if (vista === "oficina" && abaDe("oficina") === "producao" && !folhaAberta) render(true); }).catch(function () {});
    if (!SEL.lista) carregaSelos().then(function () { if (vista === "oficina" && abaDe("oficina") === "producao" && !folhaAberta) render(true); }).catch(function () {});
    if (!PROD.lista && !PROD.erro && !PROD.carregando) carregarProdutos().then(function () { if (vista === "oficina" && abaDe("oficina") === "producao" && !folhaAberta) render(true); }).catch(function () {});
    var als = alertasAtivos(), nAl = SEL.alertas ? als.length : (sel && sel.alertas) || 0;
    var recentes = (SEL.lista || []).filter(function (s) { return s.status !== "branco"; }).sort(function (a, b) { return String(b.data_impressao || "") < String(a.data_impressao || "") ? -1 : 1; }).slice(0, 4);
    return '<div class="sl-acao">' +
        '<button class="sl-grande prim" data-selar>' + IC.ler + "Selar uma peça<small>" + (por.ativo || 0) + " na peça</small></button>" +
        '<button class="sl-grande sec" data-imprimirselos>' + IC.imp + "Imprimir folha<small>" + (por.branco || 0) + " em branco</small></button></div>" +
      (nAl ? '<div class="cartao alerta-c"><div class="l"><span class="est e-vendido">Alerta</span><b>' + nAl + (nAl === 1 ? " selo com acesso estranho" : " selos com acesso estranho") + "</b></div>" +
        (als.length ? "<p>" + esc(als.slice(0, 2).map(function (a) { return (a.produto_nome || a.codigo) + ": " + a.motivos.join(", "); }).join(". ")) + "</p>" : "<p></p>") +
        '<button class="bt cheio" data-sellista="alerta">Ver ' + (nAl === 1 ? "o alerta" : "os " + nAl) + "</button></div>" : "") +
      '<div class="nums">' + numBt(por.branco || 0, "em branco", 'data-sellista="branco"') + numBt(por.ativo || 0, "na peça", 'data-sellista="ativo"') + numBt((por.reivindicado || 0) + (por.vendido || 0), "com dono", 'data-sellista="reivindicado"') + "</div>" +
      '<div class="secao">Últimos selados<button class="bt-link" data-sellista="">Todos</button></div>' +
      (SEL.lista ? (recentes.length ? '<div class="cartao lista">' + recentes.map(linhaSelo).join("") + "</div>" : '<p class="vazio">Nenhuma peça selada.</p>') : '<div class="esqueleto"></div>') +
      '<div class="cartao lista"><div class="linha toca" data-selespecial><div class="o"><b>Selo de peça especial</b></div>' + IC.seta + "</div></div>";
  }
  function ligarSelos(raiz) {
    raiz.querySelectorAll("[data-selar]").forEach(function (b) { b.onclick = function () { folhaSelar(); }; });
    raiz.querySelectorAll("[data-imprimirselos]").forEach(function (b) { b.onclick = folhaImprimirSelos; });
    raiz.querySelectorAll("[data-sellista]").forEach(function (b) { b.onclick = function () { folhaListaSelos(b.dataset.sellista); }; });
    raiz.querySelectorAll("[data-selespecial]").forEach(function (b) { b.onclick = folhaSeloEspecial; });
    raiz.querySelectorAll("[data-selo]").forEach(function (b) { b.onclick = function () { abrirSelo(b.dataset.selo); }; });
  }

  /* --- câmera: BarcodeDetector quando existe, jsQR no Safari --- */
  var libs = {};
  function carregaLib(src) {
    if (libs[src]) return libs[src];
    libs[src] = new Promise(function (ok, falha) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { libs[src] = null; falha(new Error("lib")); }; document.head.appendChild(s); });
    return libs[src];
  }
  var cam = null;
  function paraCamera() {
    if (!cam) return; cam.parado = true; clearTimeout(cam.timer);
    try { cam.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { cam.video.srcObject = null; } catch (e) {}
    cam = null;
  }
  function ligaCamera(video, msg, achou) {
    paraCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = "Sem câmera aqui. Digite o código."; return; }
    var meu = { video: video, parado: false };
    cam = meu;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(function (stream) {
      if (meu.parado) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      meu.stream = stream; video.srcObject = stream; video.setAttribute("playsinline", ""); return video.play();
    }).then(function () {
      if (meu.parado) return;
      if (window.BarcodeDetector) return window.BarcodeDetector.getSupportedFormats().then(function (fs) { if (fs.indexOf("qr_code") >= 0) meu.detector = new window.BarcodeDetector({ formats: ["qr_code"] }); else return carregaLib("/vendor/jsQR.min.js?v=1"); }).catch(function () { return carregaLib("/vendor/jsQR.min.js?v=1"); });
      return carregaLib("/vendor/jsQR.min.js?v=1");
    }).then(function () {
      if (meu.parado) return;
      msg.textContent = "Aponte pro adesivo";
      var cv = document.createElement("canvas");
      var varre = function () {
        if (meu.parado) return;
        var seguinte = function () { meu.timer = setTimeout(varre, 220); };
        if (!video.videoWidth) return seguinte();
        var pegou = function (txt) { var c = codigoDaLeitura(txt); if (!c) return seguinte(); if (navigator.vibrate) navigator.vibrate(40); paraCamera(); achou(c); };
        if (meu.detector) { meu.detector.detect(video).then(function (r) { if (r && r.length) pegou(r[0].rawValue); else seguinte(); }).catch(seguinte); return; }
        if (window.jsQR) {
          var l = Math.min(video.videoWidth, video.videoHeight, 640); cv.width = l; cv.height = l;
          var ctx = cv.getContext("2d"); ctx.drawImage(video, (video.videoWidth - l) / 2, (video.videoHeight - l) / 2, l, l, 0, 0, l, l);
          var r = window.jsQR(ctx.getImageData(0, 0, l, l).data, l, l, { inversionAttempts: "dontInvert" });
          if (r && r.data) return pegou(r.data);
        }
        seguinte();
      };
      varre();
    }).catch(function (e) { if (!meu.parado) msg.textContent = "A câmera não abriu. Digite o código."; paraCamera(); });
  }

  /* --- selar uma peça: ler, escolher, pronto --- */
  function folhaSelar() {
    abrirFolha("Selar uma peça",
      '<div class="camera-sl"><video id="slVideo" playsinline muted></video><div class="mira"></div><div class="dica-c" id="slMsg">Abrindo a câmera…</div></div>' +
      '<div class="digitar-sl"><input id="slCod" class="codigo" placeholder="Código do adesivo" autocapitalize="characters" autocomplete="off" spellcheck="false"><button class="bt" id="slIr">Abrir</button></div>',
      function (c) {
        var ir = function (cod) { cod = normCodigo(cod); if (!cod) return c.querySelector("#slCod").focus(); paraCamera(); passoPeca(cod); };
        c.querySelector("#slIr").onclick = function () { ir(c.querySelector("#slCod").value); };
        c.querySelector("#slCod").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); ir(this.value); } });
        if (!PROD.lista && !PROD.erro) carregarProdutos();
        ligaCamera(c.querySelector("#slVideo"), c.querySelector("#slMsg"), ir);
      }, paraCamera);
  }
  function maisSeladas() {
    var desde = somaDias(hoje(), -30), n = {};
    (SEL.lista || []).forEach(function (s) { if (s.sku && s.status !== "branco" && String(s.data_impressao || "") >= desde) n[s.sku] = (n[s.sku] || 0) + 1; });
    return n;
  }
  function gradePecas(sel, filtro) {
    var n = maisSeladas(), lista = (SEL.produtos || []).filter(function (p) { return p.ativo || p.id === sel; });
    var q = norm(filtro || "");
    if (q) lista = lista.filter(function (p) { return norm(p.nome + " " + (p.subtitulo || "")).indexOf(q) >= 0; });
    lista.sort(function (a, b) { return (n[b.id] || 0) - (n[a.id] || 0) || String(a.nome).localeCompare(String(b.nome)); });
    return lista.length ? lista.map(function (p) {
      var pr = porId(PROD.lista || [], p.id);
      return '<button type="button" class="gp' + (p.id === sel ? " sel" : "") + '" data-gp="' + esc(p.id) + '">' + (pr && pr.imagem_principal ? '<img alt="" loading="lazy" src="' + esc(imgUrl(pr.imagem_principal, "t")) + '">' : '<i class="gp-sem">' + esc(String(p.nome).charAt(0)) + "</i>") +
        "<span>" + esc(p.nome) + "</span><small>" + (n[p.id] ? n[p.id] + " no mês" : esc(nomeFaixa(p.subcategoria || ""))) + "</small></button>";
    }).join("") : '<p class="vazio" style="grid-column:1/-1;color:var(--suave)">Nenhuma peça com esse nome.</p>';
  }
  function escolhePeca(c, atual, aoEscolher) {
    var sel = atual || "";
    var pinta = function () {
      c.querySelector("#gpGrade").innerHTML = gradePecas(sel, c.querySelector("#gpBusca").value);
      c.querySelectorAll("[data-gp]").forEach(function (b) { b.onclick = function () { sel = b.dataset.gp; c.querySelectorAll("[data-gp]").forEach(function (x) { x.classList.toggle("sel", x === b); }); aoEscolher(sel); }; });
    };
    c.querySelector("#gpBusca").addEventListener("input", pinta);
    pinta();
  }
  function passoPeca(cod) {
    abrirFolha("Selar uma peça", '<div class="esqueleto"></div>', function (c) {
      Promise.all([api("/api/selos/um?codigo=" + encodeURIComponent(cod)), carregaSelProdutos(), carregaSelos().catch(function () {}), PROD.lista ? null : carregarProdutos()]).then(function (r) {
        var s = r[0].selo;
        if (!folhaAberta) return;
        if (s.status !== "branco") { abrirSelo(s.codigo, s); return; }
        var escolhida = "", dataI = hoje();
        abrirFolha("Qual é a peça?",
          '<div class="sl-cod">' + estSelo("branco") + '<span class="codigo">' + esc(s.codigo) + "</span></div>" +
          '<div class="campo"><input id="gpBusca" type="search" placeholder="Buscar peça" autocomplete="off"></div>' +
          '<div class="grade-prod" id="gpGrade"></div>' +
          '<details class="sl-data"><summary>Impressa hoje, mudar</summary><div class="duas">' + campo("Impressa em", '<input id="slData" type="date" value="' + dataI + '">') + campo("Feita em", '<input id="slCidade" value="Aracaju, Sergipe">') + "</div></details>" +
          '<div class="fixo"><button class="bt acento cheio" id="slOk" disabled>Escolha a peça</button></div>',
          function (f) {
            var ok = f.querySelector("#slOk");
            escolhePeca(f, "", function (id) { escolhida = id; var p = porId(SEL.produtos, id); ok.disabled = false; ok.textContent = "Selar como " + (p ? p.nome : id); });
            f.querySelector("#slData").addEventListener("change", function () { f.querySelector(".sl-data summary").textContent = this.value === hoje() ? "Impressa hoje, mudar" : "Impressa em " + dm(this.value) + ", mudar"; });
            ok.onclick = function () {
              if (!escolhida) return;
              ok.disabled = true; ok.textContent = "Selando…";
              var corpo = { codigo: s.codigo, sku: escolhida, data_impressao: f.querySelector("#slData").value || hoje(), cidade: f.querySelector("#slCidade").value.trim() || null };
              api("/api/selos/vincular", { method: "POST", body: corpo }).then(function (d) {
                conta("aviso"); recarregaSelos();
                passoPronto(s.codigo, d.produto || (porId(SEL.produtos, escolhida) || {}).nome, corpo.data_impressao);
              }).catch(function (e) { ok.disabled = false; ok.textContent = "Tentar de novo"; aviso(/409/.test(String(e && e.message)) ? "Esse selo já foi usado" : "Não selou. Confira a internet."); });
            };
          }, paraCamera);
      }).catch(function (e) {
        if (!folhaAberta) return;
        var naoExiste = /404/.test(String(e && e.message));
        abrirFolha("Selar uma peça", '<div class="cartao" style="box-shadow:none"><b style="font-weight:900">' + (naoExiste ? esc(cod) + " não existe" : "Não carregou. Confira a internet.") + '</b></div><button class="bt acento cheio" id="slDeNovo">Ler de novo</button>',
          function (f) { f.querySelector("#slDeNovo").onclick = folhaSelar; });
      });
    }, paraCamera);
  }
  function passoPronto(cod, nome, data) {
    abrirFolha("Selada",
      '<div class="ok-grande"><div class="bola">' + IC.check + "</div><b>" + esc(nome || "Peça") + '</b><span class="codigo">' + esc(cod) + "</span></div>" +
      '<div class="cert"><div class="l1"><span>Certificado</span><span>maratu.com.br/a/' + esc(cod) + "</span></div><b>" + esc(nome || "") + "</b><span>Impressa em " + dm(data) + "/" + String(data).slice(0, 4) + "</span></div>" +
      '<div class="grade-bts"><a class="bt" href="' + SITE + "/a/" + esc(cod) + '" target="_blank" rel="noopener">' + IC.fora + 'Ver certificado</a><button class="bt" id="slTroca">Trocar a peça</button></div>' +
      '<div class="fixo grade-bts"><button class="bt" id="slFim">Terminei</button><button class="bt acento" id="slProx">Selar a próxima</button></div>',
      function (f) {
        f.querySelector("#slProx").onclick = folhaSelar;
        f.querySelector("#slFim").onclick = fecharFolha;
        f.querySelector("#slTroca").onclick = function () { folhaTrocarPeca({ codigo: cod }); };
      });
  }

  /* --- imprimir folha de selos em branco --- */
  /* mesma receita do adesivo do painel antigo: 15 ou 20 mm, folga de 2 módulos, Aratu no meio */
  var TAM_SELO = [{ k: "15", qr: 15 }, { k: "20", qr: 20 }];
  TAM_SELO.forEach(function (t) { t.cel = t.qr; t.txt = Math.max(1.6, t.qr / 9); t.alt = t.qr + t.txt * 1.5; t.cols = Math.floor(194 / t.cel); t.linhas = Math.floor(281 / t.alt); t.porFolha = t.cols * t.linhas; });
  var ARATU_D = ["M0,72.78c0,18.46,14.97,33.43,33.43,33.43V39.35C14.97,39.35,0,54.31,0,72.78Z", "M187.62,39.35v66.86c18.46,0,33.43-14.97,33.43-33.43s-14.97-33.43-33.43-33.43Z", "M110.53,106.21c36.93,0,66.86-29.94,66.86-66.86H43.66c0,36.93,29.94,66.86,66.86,66.86Z", "M156.17,16.73c0-9.24-7.49-16.73-16.73-16.73v33.45c9.24,0,16.73-7.49,16.73-16.73Z", "M81.61,33.45V0c-9.24,0-16.73,7.49-16.73,16.73s7.49,16.73,16.73,16.73Z"];
  function qrDoSelo(qrcode, codigo) {
    var qr = qrcode(0, "Q"); qr.addData("maratu.com.br/a/" + codigo); qr.make();
    var n = qr.getModuleCount(), F = 2, total = n + F * 2, aW = n * 0.28, aH = aW * (106.21 / 221.06), aX = F + (n - aW) / 2, aY = F + (n - aH) / 2, fo = 0.6;
    var jX = aX - fo, jY = aY - fo, jW = aW + fo * 2, jH = aH + fo * 2, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      var x = F + c, y = F + r;
      if (x + 1 > jX && x < jX + jW && y + 1 > jY && y < jY + jH) continue;
      d += "M" + x + " " + y + "h1v1h-1z";
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + " " + total + '" shape-rendering="crispEdges"><rect width="' + total + '" height="' + total + '" fill="#fff"/><path fill="#000" d="' + d + '"/>' +
      '<g fill="#000" transform="translate(' + aX.toFixed(3) + " " + aY.toFixed(3) + ") scale(" + (aW / 221.06).toFixed(5) + ')">' + ARATU_D.map(function (p) { return '<path d="' + p + '"/>'; }).join("") + "</g></svg>";
  }
  function folhaImprimirSelos() {
    var tam = lerLS("maratu.selos.tam", "15"), folhas = 1;
    var t = function () { return TAM_SELO.filter(function (x) { return x.k === tam; })[0] || TAM_SELO[0]; };
    abrirFolha("Imprimir folha",
      '<div class="seg" role="group" id="slTam">' + TAM_SELO.map(function (x) { return '<button data-tam="' + x.k + '" aria-pressed="' + (x.k === tam) + '">' + x.k + " mm</button>"; }).join("") + "</div>" +
      '<div class="qtd" id="slQtd"></div><div class="folha-a4" id="slA4"></div>' +
      '<div class="fixo"><button class="bt acento cheio" id="slMonta"></button></div>',
      function (c) {
        var pinta = function () {
          var x = t();
          c.querySelectorAll("[data-tam]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tam === tam)); });
          c.querySelector("#slQtd").innerHTML = [1, 2, 3].filter(function (k) { return k * x.porFolha <= 500; }).map(function (k) { return '<button data-folhas="' + k + '" aria-pressed="' + (k === folhas) + '">' + k + "<small>" + (k * x.porFolha) + " selos</small></button>"; }).join("");
          var a4 = c.querySelector("#slA4"); a4.style.gridTemplateColumns = "repeat(" + x.cols + ", 1fr)"; a4.innerHTML = new Array(x.porFolha + 1).join("<span></span>");
          c.querySelector("#slMonta").textContent = "Montar " + (folhas * x.porFolha) + " selos";
          c.querySelectorAll("[data-folhas]").forEach(function (b) { b.onclick = function () { folhas = Number(b.dataset.folhas); pinta(); }; });
        };
        c.querySelectorAll("[data-tam]").forEach(function (b) { b.onclick = function () { tam = b.dataset.tam; gravarLS("maratu.selos.tam", tam); pinta(); }; });
        pinta();
        c.querySelector("#slMonta").onclick = function () {
          var x = t(), n = Math.min(500, folhas * x.porFolha), bt = this;
          bt.disabled = true; bt.textContent = "Gerando…";
          Promise.all([api("/api/selos/lote", { method: "POST", body: { n: n } }), carregaLib("/vendor/qrcode.min.js?v=1")]).then(function (r) {
            fecharFolha(); folhaA4(r[0].codigos || [], x); recarregaSelos();
          }).catch(function () { bt.disabled = false; bt.textContent = "Tentar de novo"; aviso("Não gerou. Confira a internet."); });
        };
      });
  }
  function folhaA4(codigos, tam) {
    var velha = $("seloFolha"); if (velha) velha.remove();
    var f = document.createElement("div"); f.id = "seloFolha";
    f.innerHTML = '<div class="sf-barra"><b>' + codigos.length + " selos, " + tam.k + ' mm</b><button class="bt acento" id="sfImprimir">' + IC.imp + 'Imprimir</button><button class="bt" id="sfFechar">Fechar</button></div>' +
      '<div class="sf-grade" style="width:' + (tam.cel * tam.cols).toFixed(2) + 'mm">' + codigos.map(function (c) {
        return '<div class="sf-cel" style="width:' + tam.cel.toFixed(2) + "mm;height:" + tam.alt.toFixed(2) + 'mm"><div class="sf-qr" style="width:' + tam.qr + "mm;height:" + tam.qr + 'mm">' + qrDoSelo(window.qrcode, c) + '</div><div class="sf-cod" style="font-size:' + tam.txt.toFixed(2) + 'mm">' + esc(c) + "</div></div>";
      }).join("") + "</div>";
    document.body.appendChild(f); document.body.classList.add("selo-imprimindo");
    $("sfImprimir").onclick = function () { window.print(); };
    $("sfFechar").onclick = function () { f.remove(); document.body.classList.remove("selo-imprimindo"); };
  }

  /* --- lista com chips no lugar dos menus --- */
  function folhaListaSelos(filtro) {
    var f0 = filtro || "", busca = "";
    abrirFolha("Selos", '<div class="campo"><input id="slBusca" type="search" placeholder="Código ou peça" autocomplete="off"></div><div class="filtros" id="slChips"></div><div id="slLista"><div class="esqueleto"></div></div>', function (c) {
      var pinta = function () {
        var todos = SEL.lista || [], cont = { "": todos.length, alerta: alertasAtivos().length };
        todos.forEach(function (s) { var k = s.status === "vendido" ? "reivindicado" : s.status; cont[k] = (cont[k] || 0) + 1; });
        c.querySelector("#slChips").innerHTML = [["", "Todos"], ["alerta", "Alerta"], ["branco", "Em branco"], ["ativo", "Na peça"], ["reivindicado", "Com dono"], ["bloqueado", "Bloqueados"]].filter(function (x) { return x[0] === "" || cont[x[0]] || x[0] === f0; })
          .map(function (x) { return '<button class="chip-bt" data-slf="' + x[0] + '" aria-pressed="' + (f0 === x[0]) + '">' + x[1] + ' <span class="n">' + (cont[x[0]] || 0) + "</span></button>"; }).join("");
        c.querySelectorAll("[data-slf]").forEach(function (b) { b.onclick = function () { f0 = b.dataset.slf; pinta(); }; });
        var q = norm(busca), alertas = {}; alertasAtivos().forEach(function (a) { alertas[a.codigo] = 1; });
        var vis = todos.filter(function (s) {
          if (f0 === "alerta" && !alertas[s.codigo]) return false;
          if (f0 && f0 !== "alerta" && (f0 === "reivindicado" ? ["reivindicado", "vendido"].indexOf(s.status) < 0 : s.status !== f0)) return false;
          return !q || norm(s.codigo + " " + (s.produto_nome || "") + " " + (s.nome_peca || "")).indexOf(q) >= 0;
        });
        if (f0 === "alerta") vis.sort(function (a, b) { return (Number(b.acessos) || 0) - (Number(a.acessos) || 0); });
        c.querySelector("#slLista").innerHTML = SEL.lista ? (vis.length ? '<div class="cartao lista" style="box-shadow:none">' + vis.slice(0, 120).map(linhaSelo).join("") + "</div>" + (vis.length > 120 ? '<p class="vazio" style="color:var(--suave)">Mostrando 120 de ' + vis.length + ". Busque pelo código.</p>" : "") : '<p class="vazio" style="color:var(--suave)">Nenhum selo aqui.</p>') : '<div class="esqueleto"></div>';
        c.querySelectorAll("[data-selo]").forEach(function (b) { b.onclick = function () { abrirSelo(b.dataset.selo); }; });
      };
      c.querySelector("#slBusca").addEventListener("input", function () { busca = this.value; pinta(); });
      Promise.all([carregaSelos(), carregaAlertas().catch(function () { return []; })]).then(function () { if (folhaAberta) pinta(); }).catch(function () { c.querySelector("#slLista").innerHTML = '<p class="vazio">Não carregou. Confira a internet.</p>'; });
      if (!PROD.lista && !PROD.erro) carregarProdutos().then(function () { if (folhaAberta && SEL.lista) pinta(); });
      pinta();
    });
  }

  /* --- um selo: estado, alerta e o que dá pra fazer --- */
  function abrirSelo(codigo, ja) {
    var monta = function (s) {
      var al = alertaDe(s.codigo), dono = s.dono_nome && s.confirmado_em;
      abrirFolha(s.produto_nome || s.nome_peca || s.codigo,
        '<div class="sl-cod">' + (al ? '<span class="est e-vendido">Alerta</span>' : "") + estSelo(s.status) + '<span class="codigo">' + esc(s.codigo) + "</span></div>" +
        '<div class="nums"><div class="num"><b>' + (Number(s.acessos) || 0) + '</b><span>acessos</span></div><div class="num"><b>' + (al && al.regioes ? Number(al.regioes) || 0 : s.data_impressao ? dm(s.data_impressao) : "-") + "</b><span>" + (al && al.regioes ? "regiões" : "impressa em") + '</span></div><div class="num"><b>' + esc(dono ? String(s.dono_nome).split(" ")[0] : "-") + "</b><span>dono</span></div></div>" +
        (al ? '<div class="resp">' + esc(cap(al.motivos.join(", "))) + ". Pode ser cópia do adesivo.</div>" + '<div class="grade-bts"><button class="bt preto" data-slac="bloqueado">Bloquear</button><button class="bt" id="slTudoBem">Está tudo bem</button></div>' : "") +
        '<div class="grade-bts"><a class="bt" href="' + SITE + "/a/" + esc(s.codigo) + '" target="_blank" rel="noopener">' + IC.fora + "Ver certificado</a>" + (s.status === "branco" ? '<button class="bt acento" id="slUsar">Selar agora</button>' : '<button class="bt" id="slTroca">Trocar a peça</button>') + "</div>" +
        (s.status === "branco" ? "" : '<details class="sl-data"><summary>Texto só desta peça</summary>' + campo("Texto", '<textarea id="slTexto" placeholder="' + esc(s.produto_origem ? "Usa o da peça" : "") + '">' + esc(s.texto_selo || "") + "</textarea>") + '<button class="bt cheio" id="slTextoOk">Salvar o texto</button></details>') +
        '<div class="cartao lista" style="box-shadow:none">' +
          (s.status === "reivindicado" || s.status === "vendido" ? '<div class="linha toca" data-slac="liberar"><div class="o"><b>Apagar o registro do dono</b></div></div>' : "") +
          (s.status === "bloqueado" ? '<div class="linha toca" data-slac="ativo"><div class="o"><b>Desbloquear</b></div></div>' : !al ? '<div class="linha toca" data-slac="bloqueado"><div class="o"><b>Bloquear</b></div></div>' : "") +
          '<div class="linha toca" id="slApaga"><div class="o"><b class="perigo">Apagar este selo</b></div></div>' +
        "</div>",
        function (f) {
          var q = function (x) { return f.querySelector(x); };
          if (q("#slUsar")) q("#slUsar").onclick = function () { passoPeca(s.codigo); };
          if (q("#slTroca")) q("#slTroca").onclick = function () { folhaTrocarPeca(s); };
          if (q("#slTudoBem")) q("#slTudoBem").onclick = function () { var ok = lerLS(SEL_OK, {}); ok[chaveAlerta(al)] = 1; gravarLS(SEL_OK, ok); fecharFolha(); render(true); aviso("Alerta guardado"); };
          if (q("#slTextoOk")) q("#slTextoOk").onclick = function () {
            var txt = q("#slTexto").value.trim(), bt = this; bt.disabled = true;
            api("/api/selos/texto", { method: "POST", body: { codigo: s.codigo, texto_selo: txt || null } }).then(function () { s.texto_selo = txt; bt.disabled = false; aviso(txt ? "Texto salvo" : "Volta a usar o texto da peça"); }).catch(function () { bt.disabled = false; aviso("Não salvou. Confira a internet."); });
          };
          f.querySelectorAll("[data-slac]").forEach(function (b) {
            b.onclick = function () {
              var ac = b.dataset.slac;
              var req = ac === "liberar" ? api("/api/selos/liberar", { method: "POST", body: { codigo: s.codigo } }) : api("/api/selos/status", { method: "POST", body: { codigo: s.codigo, status: ac } });
              fecharFolha();
              req.then(function () { aviso(ac === "liberar" ? "Registro apagado" : ac === "bloqueado" ? "Selo bloqueado" : "Selo desbloqueado"); recarregaSelos(); }).catch(function () { aviso("Não salvou. Confira a internet."); });
            };
          });
          confirmaDuplo(q("#slApaga"), "Toque de novo pra apagar de vez", function () {
            fecharFolha();
            api("/api/selos/apagar", { method: "POST", body: { codigo: s.codigo } }).then(function () { aviso("Selo apagado"); recarregaSelos(); }).catch(function () { aviso("Não apagou. Confira a internet."); });
          });
        });
    };
    if (ja) { monta(ja); return; }
    abrirFolha(codigo, '<div class="esqueleto"></div>');
    Promise.all([api("/api/selos/um?codigo=" + encodeURIComponent(codigo)), carregaAlertas().catch(function () { return []; })]).then(function (r) { if (folhaAberta) monta(r[0].selo); })
      .catch(function () { if (folhaAberta) $("folhaCorpo").innerHTML = '<p class="vazio" style="color:var(--suave)">Não carregou. Confira a internet.</p>'; });
  }
  function folhaTrocarPeca(s0) {
    abrirFolha("Trocar a peça", '<div class="esqueleto"></div>', function () {
      Promise.all([api("/api/selos/um?codigo=" + encodeURIComponent(s0.codigo)), carregaSelProdutos(), PROD.lista ? null : carregarProdutos()]).then(function (r) {
        var s = r[0].selo, escolhida = s.sku || "";
        if (!folhaAberta) return;
        abrirFolha("Trocar a peça",
          '<div class="sl-cod">' + estSelo(s.status) + '<span class="codigo">' + esc(s.codigo) + "</span></div>" +
          (s.dono_nome && s.confirmado_em ? '<div class="resp">' + esc(s.dono_nome) + " já registrou. O certificado dele muda junto.</div>" : "") +
          '<div class="campo"><input id="gpBusca" type="search" placeholder="Buscar peça" autocomplete="off"></div><div class="grade-prod" id="gpGrade"></div>' +
          '<div class="fixo"><button class="bt acento cheio" id="trOk">Salvar</button></div>',
          function (f) {
            escolhePeca(f, escolhida, function (id) { escolhida = id; });
            f.querySelector("#trOk").onclick = function () {
              if (!escolhida) return;
              var bt = this; bt.disabled = true;
              api("/api/selos/editar", { method: "POST", body: { codigo: s.codigo, sku: escolhida, nome_peca: null, sub_peca: null, data_impressao: s.data_impressao || null, cidade: s.cidade || null, nota: s.nota || null } })
                .then(function (d) { fecharFolha(); aviso(s.codigo + " agora é " + (d.peca || "outra peça")); recarregaSelos(); })
                .catch(function () { bt.disabled = false; aviso("Não salvou. Confira a internet."); });
            };
          });
      }).catch(function () { if (folhaAberta) $("folhaCorpo").innerHTML = '<p class="vazio" style="color:var(--suave)">Não carregou. Confira a internet.</p>'; });
    });
  }

  /* --- peça especial: selo sem adesivo, já vinculado --- */
  function folhaSeloEspecial() {
    abrirFolha("Selo de peça especial", '<div class="esqueleto"></div>', function () {
      carregaSelProdutos().then(function (prods) {
        if (!folhaAberta) return;
        abrirFolha("Selo de peça especial",
          campo("Peça", '<select id="esProd"><option value="">Fora do catálogo</option>' + prods.filter(function (p) { return p.ativo; }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + "</option>"; }).join("") + "</select>") +
          '<div id="esFora">' + campo("Nome da peça", '<input id="esNome" autocomplete="off">') + campo("Linha de baixo", '<input id="esSub" autocomplete="off">') + "</div>" +
          '<div class="duas">' + campo("Quantos", '<input id="esN" type="number" min="1" max="200" inputmode="numeric" value="1">') + campo("Impressa em", '<input id="esData" type="date">') + "</div>" +
          campo("Texto desta peça", '<textarea id="esTxt"></textarea>') +
          '<div id="esSaida"></div><div class="fixo"><button class="bt acento cheio" id="esOk">Criar selo</button></div>',
          function (f) {
            var q = function (x) { return f.querySelector(x); };
            q("#esProd").onchange = function () { q("#esFora").hidden = !!this.value; };
            q("#esOk").onclick = function () {
              var sku = q("#esProd").value, nome = q("#esNome").value.trim(), n = Number(q("#esN").value) || 0;
              if (!sku && !nome) { q("#esNome").focus(); return; }
              if (n < 1 || n > 200) { aviso("De 1 a 200 por vez"); return; }
              var bt = this; bt.disabled = true;
              api("/api/selos/especial", { method: "POST", body: { sku: sku || null, n: n, nome_peca: sku ? null : nome, sub_peca: sku ? null : (q("#esSub").value.trim() || null), data_impressao: q("#esData").value || null, texto_selo: q("#esTxt").value.trim() || null } }).then(function (d) {
                bt.disabled = false; recarregaSelos();
                q("#esSaida").innerHTML = '<div class="rot">Criados</div><div class="cartao lista" style="box-shadow:none">' + (d.codigos || []).map(function (c) {
                  return '<div class="linha"><div class="o"><b class="codigo">' + esc(c) + "</b><small>maratu.com.br/a/" + esc(c) + '</small></div><button class="ico-bt copia-link" data-escopia="' + esc(c) + '" aria-label="Copiar o link">' + IC.copia + "</button></div>";
                }).join("") + "</div>";
                q("#esSaida").querySelectorAll("[data-escopia]").forEach(function (b) { b.onclick = function () { var u = SITE + "/a/" + b.dataset.escopia; copiar(u).then(function () { aviso("Link copiado"); }).catch(function () { aviso(u); }); }; });
              }).catch(function () { bt.disabled = false; aviso("Não criou. Confira a internet."); });
            };
          });
      }).catch(function () { if (folhaAberta) $("folhaCorpo").innerHTML = '<p class="vazio" style="color:var(--suave)">Não carregou. Confira a internet.</p>'; });
    });
  }

  /* ---------- Mais: o que não cabe na barra do celular ---------- */
  function folhaMais() {
    var abertos = S.pedidos.filter(function (p) { return p.status === "aberto"; }).length, prog = posts().filter(function (p) { return p.status === "aprovado"; }).length;
    var linha = function (v, ico, sub) { return '<button class="cartao linha toca mais-item" data-mais="' + v + '">' + ico + '<div class="o"><b>' + NOME_AREA[v] + "</b><small>" + sub + "</small></div>" + IC.seta + "</button>"; };
    abrirFolha("Mais",
      linha("oficina", IC.imp, abertos ? abertos + (abertos === 1 ? " pedido em aberto" : " pedidos em aberto") : "Nenhum pedido em aberto") +
      linha("divulgacao", IC.post, prog ? prog + (prog === 1 ? " post programado" : " posts programados") : "Nenhum post programado") +
      linha("ajustes", IC.engrenagem, "Notificações " + estadoPush()),
      function (c) { c.querySelectorAll("[data-mais]").forEach(function (b) { b.onclick = function () { fecharFolha(); irPara(b.dataset.mais); }; }); });
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
        abre: function () { irAba("financas", "mei"); }
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
        abre: function () { irAba("financas", "mei"); }
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
          abre: function () { folhaImpressora(); }
        });
      }
    }
    var sel = x.selos;
    var nSel = SEL.alertas ? alertasAtivos().length : sel ? Number(sel.alertas) || 0 : 0;
    if (sel && sel.alertas && !SEL.alertas) carregaAlertas().then(function () { if (vista === "hoje" && !folhaAberta) render(true); }).catch(function () {});
    if (nSel > 0) {
      out.push({
        k: "selos:" + nSel, tipo: "aviso", rot: "Selos", ordem: 3.5, data: h,
        titulo: nSel + (nSel === 1 ? " selo com alerta" : " selos com alerta"), sub: "",
        quando: "",
        dir: { rot: "Visto", fn: function () { adiarCartao("selos:" + nSel, somaDias(h, 7)); } },
        esq: { rot: "Amanhã", fn: function () { adiarCartao("selos:" + nSel); } },
        abre: function () { folhaListaSelos("alerta"); }
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
        api("/api/mei/das/pay", { method: "POST", body: corpo }).then(guardaCache).catch(function (e) { m.paid = false; aviso(/HTTP 400/.test(String(e && e.message)) ? "Falta o valor do DAS em Finanças, MEI" : "Não salvou. Confira a internet."); render(true); });
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
    return '<a class="cartao faixa-imp" href="#" data-impfolha><span class="pulso' + (imp.estado.estado === "paused" || semSinal ? " parado" : "") + '"></span><div class="o"><b>' + esc(nomeArquivo(imp.estado.arquivo)) + "</b><small>" + pct + "%" + (txt ? ", " + txt : "") + '</small></div><div class="barra-meta"><i style="width:' + pct + '%"></i></div></a>';
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
    if (e.key === "Escape" && $("seloFolha")) { e.preventDefault(); $("sfFechar").click(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key || "").toLowerCase() === "k") { e.preventDefault(); if (buscaAberta) fecharBusca(); else if (!folhaAberta) abrirBusca(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, campo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (campo || folhaAberta || buscaAberta) return;
    var k = (e.key || "").toLowerCase(); if (e.isComposing) return;
    if (k === "n") { e.preventDefault(); folhaLancar(null, vista === "agenda" ? diaSel : null); }
    else if (e.key === "/") { e.preventDefault(); abrirBusca(); }
    else if (/^[1-7]$/.test(e.key)) irPara(ORDEM_VISTAS[Number(e.key) - 1]);
    else if (vista === "agenda" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { diaSel = somaDias(diaSel, e.key === "ArrowLeft" ? -1 : 1); agendaMes = null; render(false, e.key === "ArrowLeft" ? "esq" : "dir"); }
  });
  $("btLancar").addEventListener("click", function () { if (folhaAberta && $("btLancar").getAttribute("aria-expanded") === "true") fecharFolha(); else folhaLancar(null, vista === "agenda" ? diaSel : null); });
  $("btBusca").addEventListener("click", abrirBusca);
  $("btMais").addEventListener("click", function () { if (folhaAberta) fecharFolha(); folhaMais(); });

  /* ---------- início ---------- */
  corDaBarra();
  if (!token()) { try { localStorage.removeItem(CACHE); } catch (e) {} return; }
  function lerEndereco() {
    var h = (location.hash || "").replace("#", ""), mapa = { caixa: "financas", financas: "financas", mei: "financas", receber: "financas", loja: "oficina", oficina: "oficina", pedidos: "oficina", agenda: "agenda", marketing: "divulgacao", divulgacao: "divulgacao", sites: "sites", leads: "sites", clientes: "sites", estudio: "hoje", ajustes: "ajustes", hoje: "hoje" };
    if (!h) return false;
    if (!mapa[h]) { try { history.replaceState(null, "", location.pathname); } catch (e) {} return false; }
    vista = mapa[h];
    var abaDoHash = { caixa: ["financas", "caixa"], mei: ["financas", "mei"], receber: ["financas", "receber"], pedidos: ["oficina", "pedidos"], leads: ["sites", "conversas"], clientes: ["sites", "clientes"] }[h];
    if (abaDoHash) aba[abaDoHash[0]] = abaDoHash[1];
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
