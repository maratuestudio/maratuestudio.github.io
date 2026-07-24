/* MARATU admin — modulo "Relatorio semanal" (anexado, nao toca no admin.js minificado).
   O core ja gera Vendas/Agenda/Marketing/Trafego/Orcamentos/Notas/Sinais em
   buildRelatorioMD(). Aqui a gente:
     1. envelopa gerarRelatorio() pra buscar Leads e Newsletter no Worker ANTES de montar;
     2. envelopa buildRelatorioMD() pra acrescentar Instagram, Leads, Newsletter e Carne;
     3. poe um bloco de INSTRUCOES no topo do arquivo, pro Rapha so jogar o .md no Claude.
   Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuRelat) return;
  window.__maratuRelat = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var extraLeads = null;   // array de leads (ou null se nao carregou)
  var extraNews = null;    // {contatos:[], ativos:N} (ou null)

  /* ---- globais do core com fallback ---- */
  function BRL(v) { try { if (typeof brl === "function") return brl(v); } catch (e) {} return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ","); }
  function NUM(v) { try { if (typeof num === "function") return num(v); } catch (e) {} return Number(v) || 0; }
  function HOJE() { try { if (typeof todayStr === "function") return todayStr(); } catch (e) {} var d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function p2(n) { return String(n).padStart(2, "0"); }
  function DATA(iso) {
    try { if (typeof fmtDataMD === "function") return fmtDataMD(iso); } catch (e) {}
    var p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : (iso || "—");
  }
  function diasAte(iso) {
    var a = HOJE().split("-").map(Number), b = String(iso || "").split("-").map(Number);
    if (b.length !== 3) return null;
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 864e5);
  }
  function inicioSemana() {
    var d = new Date(); d.setDate(d.getDate() - 6);
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  }

  /* ---- busca o que o core nao conhece ---- */
  function carregarExtras() {
    var l = fetch(API + "/api/leads", { headers: { Authorization: "Bearer " } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { extraLeads = (d && d.leads) || []; })
      .catch(function () { extraLeads = null; });
    var n = fetch(API + "/api/newsletter/lista")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { extraNews = d || null; })
      .catch(function () { extraNews = null; });
    return Promise.all([l, n]);
  }

  /* ---- secoes novas ---- */
  function secaoInstagram(out) {
    out.push("", "## Instagram");
    var ig = window._chicoIg || null;
    if (!ig) { out.push("_Instagram sem dados carregados (abra o card do Instagram no painel antes de gerar)_"); return; }
    out.push("- Seguidores: **" + (ig.followers != null ? ig.followers : "—") + "**");
    out.push("- Alcance (" + (ig.rangeLabel || "7 dias") + "): **" + (ig.reachSum || 0) + "**");
    out.push("- Posts no período: **" + (ig.posts || 0) + "** · curtidas: **" + (ig.likes || 0) + "** · comentários: **" + (ig.comments || 0) + "**");
    var eng = (ig.posts || 0) > 0 ? Math.round(((ig.likes || 0) + (ig.comments || 0)) / ig.posts) : 0;
    out.push("- Média de interações por post: **" + eng + "**");
  }

  function secaoLeads(out) {
    out.push("", "## Leads");
    if (extraLeads === null) { out.push("_não consegui carregar os leads (Worker fora do ar ou sessão expirada)_"); return; }
    if (!extraLeads.length) { out.push("_nenhum lead cadastrado_"); return; }
    var porStatus = { novo: [], conversando: [], fechado: [], perdido: [] };
    extraLeads.forEach(function (l) { (porStatus[l.status] || porStatus.novo).push(l); });
    var abertos = porStatus.novo.length + porStatus.conversando.length;
    out.push("- Total: **" + extraLeads.length + "** · em aberto: **" + abertos +
      "** (novo " + porStatus.novo.length + ", conversando " + porStatus.conversando.length + ")");
    out.push("- Fechados: **" + porStatus.fechado.length + "** · perdidos: **" + porStatus.perdido.length + "**");
    var ini = inicioSemana(), hoje = HOJE();
    var novosSemana = extraLeads.filter(function (l) { return (l.criado || "") >= ini && (l.criado || "") <= hoje; });
    out.push("- Entraram nos últimos 7 dias: **" + novosSemana.length + "**");

    var atrasados = extraLeads.filter(function (l) {
      return l.followup && l.followup < hoje && l.status !== "fechado" && l.status !== "perdido";
    });
    if (atrasados.length) {
      out.push("", "**Follow-up atrasado (" + atrasados.length + "):**");
      atrasados.sort(function (a, b) { return (a.followup || "").localeCompare(b.followup || ""); })
        .forEach(function (l) {
          out.push("- " + DATA(l.followup) + " — " + (l.nome || "—") + (l.contato ? " · " + l.contato : "") +
            (l.interesse ? " · quer: " + l.interesse : ""));
        });
    }
    var proximos = extraLeads.filter(function (l) {
      return l.followup && l.followup >= hoje && l.status !== "fechado" && l.status !== "perdido";
    }).sort(function (a, b) { return (a.followup || "").localeCompare(b.followup || ""); }).slice(0, 10);
    if (proximos.length) {
      out.push("", "**Próximos follow-ups:**");
      proximos.forEach(function (l) {
        out.push("- " + DATA(l.followup) + " — " + (l.nome || "—") + (l.origem ? " (" + l.origem + ")" : ""));
      });
    }
    var semFollow = extraLeads.filter(function (l) {
      return !l.followup && l.status !== "fechado" && l.status !== "perdido";
    });
    if (semFollow.length) {
      out.push("", "**Em aberto e sem follow-up marcado (" + semFollow.length + "):** " +
        semFollow.slice(0, 15).map(function (l) { return l.nome || "—"; }).join(", "));
    }
  }

  function secaoNewsletter(out) {
    out.push("", "## Newsletter");
    if (extraNews === null) { out.push("_não consegui carregar a lista da newsletter_"); return; }
    var contatos = extraNews.contatos || [];
    var ativos = extraNews.ativos != null ? extraNews.ativos : contatos.filter(function (c) { return c.ativo; }).length;
    out.push("- Inscritos: **" + contatos.length + "** · ativos: **" + ativos + "**");
    var porOrigem = {};
    contatos.forEach(function (c) { var o = c.origem || "sem origem"; porOrigem[o] = (porOrigem[o] || 0) + 1; });
    var linhas = Object.keys(porOrigem).sort(function (a, b) { return porOrigem[b] - porOrigem[a]; });
    if (linhas.length) out.push("- Por origem: " + linhas.map(function (o) { return o + " " + porOrigem[o]; }).join(" · "));
  }

  function secaoCarne(out) {
    out.push("", "## Carnê");
    var evs;
    try { evs = (MaratuStore.getEventos() || []).filter(function (e) { return e.tipo === "cobranca"; }); }
    catch (e) { out.push("_não consegui ler as cobranças_"); return; }
    if (!evs.length) { out.push("_nenhuma cobrança de carnê cadastrada_"); return; }

    function meta(notas) {
      var o = {};
      String(notas || "").split(";").forEach(function (kv) {
        var i = kv.indexOf(":"); if (i > 0) o[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
      });
      return o;
    }
    var carnes = {};
    evs.forEach(function (e) {
      var m = meta(e.notas), k = m.carne || ("solto-" + e.id);
      if (!carnes[k]) carnes[k] = { cliente: e.cliente || "—", prod: m.prod || "", parcelas: [] };
      carnes[k].parcelas.push({ ev: e, valor: parseFloat(m.valor) || 0, parc: m.parc || "", pago: !!e.feito });
    });
    var hoje = HOJE(), aberto = 0, atrasado = 0, recebido = 0;
    var linhasAtraso = [], linhasProx = [];

    Object.keys(carnes).forEach(function (k) {
      var c = carnes[k];
      c.parcelas.sort(function (a, b) { return (a.ev.data || "").localeCompare(b.ev.data || ""); });
      c.parcelas.forEach(function (p) {
        if (p.pago) { recebido += p.valor; return; }
        aberto += p.valor;
        if ((p.ev.data || "") < hoje) {
          atrasado += p.valor;
          linhasAtraso.push("- **" + c.cliente + "** " + p.parc + " · " + BRL(p.valor) +
            " · venceu " + DATA(p.ev.data) + " (" + Math.abs(diasAte(p.ev.data) || 0) + " dias)");
        } else {
          var d = diasAte(p.ev.data);
          if (d != null && d <= 14) {
            linhasProx.push("- " + DATA(p.ev.data) + " — **" + c.cliente + "** " + p.parc + " · " + BRL(p.valor) +
              (d === 0 ? " (hoje)" : " (em " + d + " dia" + (d === 1 ? "" : "s") + ")"));
          }
        }
      });
    });

    out.push("- Carnês ativos: **" + Object.keys(carnes).length + "**");
    out.push("- Já recebido: **" + BRL(recebido) + "** · a receber: **" + BRL(aberto) + "**");
    out.push("- Em atraso: **" + BRL(atrasado) + "**");
    if (linhasAtraso.length) { out.push("", "**Parcelas atrasadas:**"); linhasAtraso.forEach(function (l) { out.push(l); }); }
    if (linhasProx.length) {
      out.push("", "**Vence nos próximos 14 dias:**");
      linhasProx.sort().forEach(function (l) { out.push(l); });
    }
  }

  /* ---- bloco de instrucoes (vai no TOPO do arquivo) ---- */
  function instrucoes() {
    return [
      "<!-- INSTRUÇÕES PRA IA — leia antes de responder -->",
      "",
      "## Como analisar este relatório",
      "",
      "Você é o analista de negócios da MARATU, um estúdio criativo de Aracaju/SE que vende",
      "pôsteres, chaveiros, adesivos e peças 3D autorais, e também presta serviços de design,",
      "sites e sistemas de gestão pra pequenos negócios. O dono é o Rapha, que toca tudo sozinho.",
      "",
      "Este arquivo é o retrato dos últimos 7 dias. Com base **só nos dados abaixo**, devolva:",
      "",
      "1. **Leitura da semana** — 3 a 5 frases curtas sobre o que realmente aconteceu.",
      "   Compare com a meta do mês e com o período anterior quando o dado existir.",
      "   Se um número estiver faltando, diga que falta em vez de estimar.",
      "2. **O que preocupa** — riscos concretos: parcela atrasada, lead esfriando, queda de",
      "   tráfego ou de alcance, mês longe da meta. Nomeie cliente e valor quando houver.",
      "3. **Fazer nos próximos 7 dias** — no máximo 5 ações, em ordem de impacto, cada uma",
      "   com o porquê ligado a um número deste relatório. Nada genérico.",
      "4. **Ideias de conteúdo** — 3 posts pro Instagram (@maratuestudio) que puxem dos",
      "   produtos e serviços que mais apareceram aqui. Diga o formato (reel, carrossel, foto),",
      "   o gancho da primeira linha e a chamada pra ação.",
      "5. **Leads e marketing** — quem cobrar, quem reativar, o que mandar na newsletter.",
      "",
      "Regras de escrita: frase curta, voz ativa, sem travessão, sem emoji, sem palavra de",
      "conquista (\"incrível\", \"transformador\", \"potencializar\"). Fale português brasileiro",
      "direto, como quem conversa com o dono do negócio. Valores sempre em reais.",
      "",
      "---",
      "",
      ""
    ].join("\n");
  }

  /* ---- wrap do buildRelatorioMD ---- */
  function wrapBuild() {
    if (typeof window.buildRelatorioMD !== "function") return false;
    var _orig = window.buildRelatorioMD;
    window.buildRelatorioMD = function () {
      var base = _orig.apply(this, arguments);
      var out = [];
      try { secaoInstagram(out); } catch (e) { out.push("", "## Instagram", "_erro ao montar_"); }
      try { secaoLeads(out); } catch (e) { out.push("", "## Leads", "_erro ao montar_"); }
      try { secaoNewsletter(out); } catch (e) { out.push("", "## Newsletter", "_erro ao montar_"); }
      try { secaoCarne(out); } catch (e) { out.push("", "## Carnê", "_erro ao montar_"); }
      return instrucoes() + base + "\n" + out.join("\n") + "\n";
    };
    return true;
  }

  /* ---- busca os extras ANTES de montar o .md ----
     O core registra o botao com addEventListener("click", gerarRelatorio), entao o
     listener guarda a referencia antiga — reatribuir o global nao adianta. Intercepta
     o clique em CAPTURA (para o listener do core), busca os dados e chama gerarRelatorio()
     por nome, que ai resolve o global e cai no buildRelatorioMD ja envelopado. */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest("#relatGerar");
    if (!btn) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    var txt = btn.textContent;
    btn.disabled = true; btn.textContent = "Buscando dados…";
    carregarExtras().then(function () {
      btn.disabled = false; btn.textContent = txt;
      try { gerarRelatorio(); } catch (err) { alert("Não consegui gerar o relatório."); }
    });
  }, true);

  if (!wrapBuild()) {
    var tries = 0;
    var iv = setInterval(function () { tries++; if (wrapBuild() || tries > 40) clearInterval(iv); }, 200);
  }
})();
