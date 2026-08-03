/* MARATU admin — pagina de Ajustes redesenhada (proposta aprovada em 03/08/2026).

   O que mudou, e por que:
   - o rotulo do grupo sai de dentro do cartao e vira etiqueta de secao. Antes,
     "Aparencia", "Seguranca" e "Conta e ferramentas" gastavam uma linha inteira
     dentro do proprio cartao, com borda e tudo, pra cinco linhas de conteudo.
   - toda linha passa a mostrar o estado a direita. "Notificacoes · indisponivel"
     em cinza parecia defeito; com ponto colorido e motivo, vira informacao.
   - bloco de conta no topo: nao havia nada dizendo quem esta logado, quando
     sincronizou nem qual versao roda. O "sync D1" do rodape nunca muda, e enfeite.
   - os numeros do negocio (filamento, maquina, mao de obra, margem, fixo, meta)
     vem da aba Orcamento pra ca: sao ajuste, nao operacao do dia.
   - modo diagnostico virou botao. So dava pra ligar com ?diag=1 na URL, o que e
     impossivel no app em tela cheia (o Rapha nao tem barra de endereco no PWA).

   COMO ISTO NAO QUEBRA O RESTO: nada e recriado do zero. Os nos que ja existiam
   (#themeSeg, #ajPkList, #ajPkMsg, #appleSub, #btnSair) sao MOVIDOS pras linhas
   novas, com os listeners do core intactos. O #ajPkReg segue no painel antigo e e
   acionado por clique programatico. E o #headMenu continua vivo e
   sendo o cartao de Ferramentas, porque admin-push.js e admin-mei.js injetam
   dentro dele; se eu o recriasse, os dois passariam a injetar no vazio.

   Os numeros gravam por MaratuStore.setParams e depois chamam fillAjustes() e
   recalc(), que sao as funcoes do proprio core: assim a aba Orcamento continua
   mostrando os mesmos valores, sem duas fontes de verdade. */
(function () {
  "use strict";
  if (window.__maratuAjustes2) return;
  window.__maratuAjustes2 = true;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- estilo ---------------- */
  var CSS = [
    "#aj2{display:flex;flex-direction:column;gap:18px;max-width:560px}",
    /* No desktop as duas colunas fixas davam um lado com o dobro do outro (numeros
       e ferramentas de um lado, aparencia e seguranca do outro), e o cartao de
       conta gastava 280px de altura pra tres informacoes.
       Agora: a conta vira uma faixa de uma linha no topo, e os grupos restantes
       entram em colunas de altura equilibrada pelo proprio browser. Equilibrar por
       CSS e nao na mao importa porque admin-push.js e admin-mei.js injetam linhas
       em Ferramentas: a altura desse cartao muda sozinha. */
    "@media (min-width:900px){",
    "  #aj2{max-width:none;display:block;columns:2;column-gap:26px}",
    "  #aj2 .g{break-inside:avoid;-webkit-column-break-inside:avoid;margin:0 0 18px}",
    "  #aj2 .g.conta-faixa{column-span:all;margin-bottom:22px}",
    "  #aj2 .conta-faixa .card{display:flex;align-items:center;justify-content:space-between;",
    "    gap:18px;padding:0 18px;flex-wrap:wrap}",
    "  #aj2 .conta-faixa .conta{padding:14px 0;flex:0 0 auto}",
    "  #aj2 .conta-faixa .ln{border-top:none;width:auto;flex:0 0 auto;padding:14px 0 14px 22px;",
    "    gap:10px;border-left:1px solid var(--linha)}",
    "  #aj2 .conta-faixa .ln .n{color:var(--muted);font-weight:700}",
    "}",
    "@media (min-width:900px) and (hover:hover){",
    /* no Mac o alvo nao precisa dos 48px de dedo */
    "  #aj2 .ln,#aj2 .card .hm-btn,#aj2 .card .aj-linha{min-height:42px;padding:10px 15px}",
    "}",
    "#aj2 .g{display:flex;flex-direction:column;gap:7px}",
    "#aj2 .g > .lbl{font-size:var(--fs-1,11px);font-weight:700;letter-spacing:.2em;",
    "  text-transform:uppercase;color:var(--muted);margin-left:4px}",
    "#aj2 .card{background:var(--areia);border:1.5px solid var(--borda);border-radius:13px;",
    "  box-shadow:3px 3px 0 0 var(--sombra-hard);overflow:hidden}",
    "#aj2 .ln{display:flex;align-items:center;justify-content:space-between;gap:12px;",
    "  padding:13px 15px;border-top:1px solid var(--linha);min-height:48px;",
    "  background:none;border-left:none;border-right:none;border-bottom:none;width:100%;",
    "  font-family:var(--clother);text-align:left;color:inherit}",
    "#aj2 .card > .ln:first-child{border-top:none}",
    "#aj2 button.ln{cursor:pointer}",
    "#aj2 button.ln:active{background:var(--areia-sombra)}",
    "#aj2 .n{font-weight:700;font-size:var(--fs-2,13px);color:var(--preto)}",
    "#aj2 .v{font-size:var(--fs-2,13px);color:var(--muted);display:flex;align-items:center;",
    "  gap:7px;white-space:nowrap}",
    "#aj2 .seta{opacity:.45}",
    "#aj2 .pt{width:8px;height:8px;border-radius:50%;flex:none;box-shadow:0 0 0 1.5px var(--linha)}",
    "#aj2 .pt.ok{background:#357550}#aj2 .pt.off{background:var(--linha-forte)}",
    "#aj2 .pt.avi{background:var(--dourado)}",
    ':root[data-theme="noite"] #aj2 .pt.ok{background:#449869}',
    "#aj2 .conta{display:flex;align-items:center;gap:12px;padding:15px}",
    "#aj2 .conta svg{width:34px;height:auto;flex:none}",
    "#aj2 .conta svg path{fill:var(--preto)}",
    "#aj2 .conta b{font-weight:900;font-size:var(--fs-4,17px);display:block;line-height:1.2;color:var(--preto)}",
    "#aj2 .conta span{font-size:var(--fs-1,11px);color:var(--muted);letter-spacing:.02em}",
    /* o core da border-top no .sair porque antes ele fechava a lista de ferramentas.
       Agora tem cartao proprio, e a borda virava um fio solto no topo do cartao.
       Dois ids no seletor de proposito: a regra do core e "#panel-ajustes .sair",
       de mesma especificidade, e mora num <style> que vem depois deste no documento. */
    "#panel-ajustes #aj2 .sair{display:block;width:100%;padding:15px;text-align:center;",
    "  font-family:var(--clother);font-weight:700;font-size:var(--fs-2,13px);color:var(--laranja);",
    "  background:none;border:none;cursor:pointer}",
    "#aj2 .edit{display:flex;align-items:center;gap:8px;padding:11px 15px;border-top:1px solid var(--linha)}",
    "#aj2 .edit input{flex:1;min-width:0;font-family:var(--clother);font-size:var(--fs-3,15px);",
    "  font-weight:700;padding:9px 11px;border:1.5px solid var(--linha-forte);border-radius:9px;",
    "  background:var(--areia-fundo);color:var(--preto)}",
    "#aj2 .edit button{font-family:var(--clother);font-weight:700;font-size:var(--fs-1,11px);",
    "  letter-spacing:.14em;text-transform:uppercase;padding:9px 13px;border-radius:999px;cursor:pointer;",
    "  border:1.5px solid var(--borda);background:var(--areia)}",
    "#aj2 .edit button.ok{background:var(--preto);color:var(--areia)}",
    /* o que admin-push.js e admin-mei.js injetam no #headMenu chega com as classes
       antigas (.hm-btn, .aj-linha): 56px de altura e 15px de fonte contra 48px e
       13px das linhas novas. Sem isto, o cartao Ferramentas fica com duas alturas. */
    "#aj2 .card .hm-btn,#aj2 .card .aj-linha{padding:13px 15px;min-height:48px;",
    "  font-size:var(--fs-2,13px);border-radius:0}",
    "#aj2 .card .hm-btn .hm-lbl,#aj2 .card .aj-nome{font-size:var(--fs-2,13px);font-weight:700}",
    /* lista e mensagem de passkey, agora dentro do cartao de Seguranca */
    "#aj2 .pk-lista:empty,#aj2 .pk-msg:empty{display:none}",
    "#aj2 .pk-lista{display:flex;flex-direction:column;gap:6px;padding:11px 15px;",
    "  border-top:1px solid var(--linha);font-size:var(--fs-1,11px);color:var(--muted)}",
    "#aj2 .pk-msg{display:block;padding:10px 15px;border-top:1px solid var(--linha);",
    "  font-size:var(--fs-1,11px);color:var(--muted)}",
    /* o painel antigo some, mas continua no DOM: os nos dele foram movidos pra ca */
    "#panel-ajustes .aj-wrap{display:none}",
    "#panel-ajustes .aj-head{margin-bottom:16px}"
  ].join("");

  function estilo() {
    if ($("aj2-css")) return;
    var st = document.createElement("style");
    st.id = "aj2-css";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------------- peças ---------------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function grupo(rotulo) {
    var g = el("div", "g");
    if (rotulo) g.appendChild(el("span", "lbl", rotulo));
    var c = el("div", "card");
    g.appendChild(c);
    g._card = c;
    return g;
  }
  function linha(nome, botao) {
    var l = el(botao ? "button" : "div", "ln");
    if (botao) l.type = "button";
    l.appendChild(el("span", "n", nome));
    var v = el("span", "v");
    l.appendChild(v);
    l._v = v;
    return l;
  }
  function ponto(tipo) { return el("span", "pt " + tipo); }
  function estado(linha, tipo, texto, seta) {
    var v = linha._v;
    v.textContent = "";
    if (tipo) v.appendChild(ponto(tipo));
    /* span e nao textNode: o gap do flex nao se aplica a texto solto, e a seta
       acabava colada no valor ("1 aparelho›") */
    if (texto) v.appendChild(el("span", "", texto));
    if (seta) v.appendChild(el("span", "seta", seta));
  }

  /* ---------------- dados de estado ---------------- */
  var horaSync = null;
  function marcarSync() { horaSync = new Date(); }
  function textoSync() {
    if (!horaSync) return "carregando…";
    var min = Math.floor((Date.now() - horaSync.getTime()) / 60000);
    if (min < 1) return "agora há pouco";
    if (min < 60) return "há " + min + " min";
    return horaSync.getHours() + "h" + String(horaSync.getMinutes()).padStart(2, "0");
  }
  function versao() {
    var s = document.querySelector('script[src*="admin.js"]');
    var m = s && s.src.match(/v=(\d{4})(\d{2})(\d{2})([a-z]?)/);
    if (!m) return "—";
    return m[3] + "/" + m[2] + "/" + m[1] + (m[4] ? " · " + m[4] : "");
  }
  var MOEDA = { filamento: 1, maquina: 1, maodeobra: 1, fixo: 1, retirada: 1 };
  var NUMEROS = [
    ["filamento", "Filamento (kg)"],
    ["maquina", "Custo por hora"],
    ["maodeobra", "Mão de obra por hora"],
    ["margem", "Margem"],
    ["fixo", "Fixo mensal"],
    ["retirada", "Meta do mês"]
  ];
  function brlLocal(v) {
    return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function mostraNumero(chave, valor) {
    if (chave === "margem") return Number(valor || 0).toLocaleString("pt-BR") + "×";
    return brlLocal(valor);
  }

  /* ---------------- montagem ---------------- */
  function montar() {
    var painel = $("panel-ajustes");
    if (!painel || $("aj2")) return true;
    var themeSeg = $("themeSeg"), headMenu = $("headMenu"), btnSair = $("btnSair");
    if (!themeSeg || !headMenu) return false;   /* o core ainda nao montou */

    estilo();
    var raiz = el("div", "");
    raiz.id = "aj2";
    /* sem coluna intermediaria: os grupos sao filhos diretos e quem equilibra as
       colunas no desktop e o CSS (columns + break-inside). Com um wrapper flex no
       meio, o multi-column do WebKit ignorava o equilibrio e voltava tudo pra um lado. */

    /* ---- conta ---- */
    var gConta = grupo("");
    gConta.classList.add("conta-faixa");
    var crab = document.createElement("div");
    crab.className = "conta";
    crab.innerHTML = '<svg viewBox="0 0 221.06 106.21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M110.53,106.21c36.93,0,66.86-29.94,66.86-66.86H43.66c0,36.93,29.94,66.86,66.86,66.86Z"/>' +
      '<path d="M0,72.78c0,18.46,14.97,33.43,33.43,33.43V39.35C14.97,39.35,0,54.31,0,72.78Z"/>' +
      '<path d="M187.62,39.35v66.86c18.46,0,33.43-14.97,33.43-33.43s-14.97-33.43-33.43-33.43Z"/>' +
      '<path d="M77.1,0c-6.16,0-11.15,4.99-11.15,11.15v17.05h22.29V11.15c0-6.16-4.99-11.15-11.15-11.15Z"/>' +
      '<path d="M143.96,0c-6.16,0-11.15,4.99-11.15,11.15v17.05h22.29V11.15c0-6.16-4.99-11.15-11.15-11.15Z"/></svg>' +
      '<span><b>Raphael</b><span>fundador · Aracaju</span></span>';
    gConta._card.appendChild(crab);
    var lSync = linha("Sincronizado");
    var lVer = linha("Versão");
    gConta._card.appendChild(lSync);
    gConta._card.appendChild(lVer);
    estado(lSync, "ok", textoSync());
    estado(lVer, "", versao());
    raiz.appendChild(gConta);

    /* ---- aparência ---- */
    var gApar = grupo("Aparência");
    var lTema = linha("Modo de cor");
    spanTema = el("span", "", nomeTema());   /* guardado: o observer atualiza por
      referencia. Buscar por "#aj2 .ln .v span" pegava o primeiro span do painel,
      que e o texto de "Sincronizado", e trocar de tema escrevia "Noite" ali. */
    lTema._v.appendChild(spanTema);
    lTema._v.appendChild(themeSeg);
    gApar._card.appendChild(lTema);
    var lAuto = linha("Seguir o iPhone", true);
    gApar._card.appendChild(lAuto);
    raiz.appendChild(gApar);

    /* ---- segurança ----
       a lista e a mensagem vem junto: presas no painel antigo (display:none) o
       Rapha perdia o "×" pra remover uma passkey e nao via retorno nenhum do
       registro (sucesso, erro, cancelado). */
    var gSeg = grupo("Segurança");
    var lPk = linha("Face ID / Touch ID", true);
    gSeg._card.appendChild(lPk);
    var pkList = $("ajPkList"), pkMsg = $("ajPkMsg");
    if (pkList) { pkList.classList.add("pk-lista"); gSeg._card.appendChild(pkList); }
    if (pkMsg) { pkMsg.classList.add("pk-msg"); gSeg._card.appendChild(pkMsg); }
    
    /* ---- números do negócio ---- */
    var gNum = grupo("Números do negócio");
    NUMEROS.forEach(function (par) {
      var l = linha(par[1], true);
      l.dataset.chave = par[0];
      gNum._card.appendChild(l);
      l.addEventListener("click", function () { editar(l, par[0], par[1]); });
    });
    raiz.appendChild(gNum);
    /* segue depois do bloco grande de proposito: com "aparencia, numeros, seguranca,
       ferramentas, sair" o equilibrio das duas colunas no desktop fica em ~40px.
       Na ordem antiga (seguranca antes de numeros) sobrava 358px numa coluna. */
    raiz.appendChild(gSeg);

    /* ---- ferramentas: o proprio #headMenu vira o cartao ---- */
    var gFer = grupo("Ferramentas");
    gFer._card.remove();
    headMenu.className = "card";
    gFer.appendChild(headMenu);
    gFer._card = headMenu;
    var tit = headMenu.querySelector(".aj-grupo-tit");
    if (tit) tit.remove();
    var lDiag = linha("Modo diagnóstico", true);
    var lZero = linha("Recarregar do zero", true);
    headMenu.appendChild(lDiag);
    headMenu.appendChild(lZero);
    raiz.appendChild(gFer);

    /* ---- sair ---- */
    var gSair = grupo("");
    if (btnSair) {
      btnSair.className = "sair";
      gSair._card.appendChild(btnSair);
    }
    raiz.appendChild(gSair);

    painel.appendChild(raiz);

    ligar(lAuto, lPk, lDiag, lZero, lSync);
    atualizar();
    return true;
  }

  /* ---------------- estado das linhas ---------------- */
  function nomeTema() {
    var t = document.documentElement.getAttribute("data-theme") || "";
    return t === "dia" ? "Dia" : t === "noite" ? "Noite" : "Original";
  }
  function autoLigado() {
    try { return localStorage.getItem("maratu.themeAuto") === "1"; } catch (e) { return false; }
  }
  function diagLigado() {
    try { return localStorage.getItem("maratu.diag") === "1" || localStorage.getItem("maratu.diagbarra") === "1"; }
    catch (e) { return false; }
  }

  var refs = {}, spanTema = null;
  function ligar(lAuto, lPk, lDiag, lZero, lSync) {
    refs = { lAuto: lAuto, lPk: lPk, lDiag: lDiag, lZero: lZero, lSync: lSync };

    lAuto.addEventListener("click", function () {
      var novo = !autoLigado();
      try { localStorage.setItem("maratu.themeAuto", novo ? "1" : "0"); } catch (e) {}
      if (novo) aplicarAuto();
      atualizar();
    });

    lPk.addEventListener("click", function () {
      var b = $("ajPkReg");
      if (b) b.click();
    });

    lDiag.addEventListener("click", function () {
      var novo = !diagLigado();
      try {
        if (novo) { localStorage.setItem("maratu.diag", "1"); localStorage.setItem("maratu.diagbarra", "1"); }
        else { localStorage.removeItem("maratu.diag"); localStorage.removeItem("maratu.diagbarra"); }
      } catch (e) {}
      location.reload();
    });

    var armado = false;
    lZero.addEventListener("click", function () {
      if (!armado) {
        armado = true;
        estado(lZero, "avi", "toque de novo pra confirmar");
        setTimeout(function () { armado = false; atualizar(); }, 4000);
        return;
      }
      estado(lZero, "", "limpando…");
      Promise.resolve()
        .then(function () {
          if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) return null;
          return navigator.serviceWorker.getRegistrations().then(function (rs) {
            return Promise.all(rs.map(function (r) { return r.unregister(); }));
          });
        })
        .then(function () { return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : null; })
        .catch(function () {})
        .then(function () { location.reload(); });
    });

    /* o tema pode mudar por fora (pelo proprio seletor): refletir o nome */
    themeObserver();
  }

  function themeObserver() {
    try {
      new MutationObserver(function () {
        if (spanTema) spanTema.textContent = nomeTema();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) {}
    /* o registro de passkey escreve em #ajPkMsg; sem isto, o retorno (sucesso,
       erro, cancelado) so apareceria no proximo ciclo de 60s */
    try {
      var m = $("ajPkMsg"), l = $("ajPkList");
      var obs = new MutationObserver(function () { atualizar(); });
      if (m) obs.observe(m, { childList: true, characterData: true, subtree: true });
      if (l) obs.observe(l, { childList: true, subtree: true });
    } catch (e) {}
  }

  function aplicarAuto() {
    if (!autoLigado()) return;
    var escuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var alvo = escuro ? "noite" : "";
    if ((document.documentElement.getAttribute("data-theme") || "") === alvo) return;
    var b = document.querySelector('#themeSeg button[data-theme="' + alvo + '"]');
    if (b) b.click();   /* passa pelo caminho do core: aplica, salva e pinta o theme-color */
  }
  if (window.matchMedia) {
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", aplicarAuto);
    } catch (e) {}
  }

  function atualizar() {
    if (!refs.lAuto) return;
    estado(refs.lAuto, autoLigado() ? "ok" : "off", autoLigado() ? "ligado" : "desligado");
    var msg = (($("ajPkMsg") || {}).textContent || "").trim();
    /* contar so filho com conteudo: a lista vem com no vazio quando nao ha passkey,
       e a contagem crua dizia "1 aparelho" sem nenhum registrado */
    /* a lista nao vem vazia quando nao ha passkey: o core escreve dentro dela um
       span "nenhum dispositivo". Contar filhos crus dizia "1 aparelho" sem nenhum. */
    var lista = $("ajPkList");
    var n = 0;
    if (lista) {
      [].forEach.call(lista.children, function (c) {
        var t = (c.textContent || "").trim();
        if (t && !/nenhum|nao ha|não há/i.test(t)) n++;
      });
    }
    /* o core desabilita o botao e escreve "passkey nao suportado" quando o
       navegador nao tem PublicKeyCredential. Sem refletir isso, a linha parecia
       clicavel e o toque nao fazia nada. */
    var btnPk = $("ajPkReg");
    if (btnPk && btnPk.disabled) {
      estado(refs.lPk, "off", (btnPk.textContent || "não disponível neste aparelho").trim());
      refs.lPk.disabled = true;
    } else {
      refs.lPk.disabled = false;
      estado(refs.lPk, n ? "ok" : "off", n ? (n === 1 ? "1 aparelho" : n + " aparelhos") : (msg || "nenhum aparelho"), "›");
    }
    /* a lista do core escreve "nenhum dispositivo" quando esta vazia, repetindo o
       que a propria linha ja diz. So aparece quando tem aparelho pra remover. */
    if (lista) lista.style.display = n ? "" : "none";
    estado(refs.lDiag, diagLigado() ? "avi" : "off", diagLigado() ? "ligado" : "desligado");
    estado(refs.lZero, "", "", "›");
    if (refs.lSync) estado(refs.lSync, "ok", textoSync());
    NUMEROS.forEach(function (par) {
      var l = document.querySelector('#aj2 .ln[data-chave="' + par[0] + '"]');
      if (!l) return;
      var p = (typeof MaratuStore !== "undefined" && MaratuStore.getParams()) || {};
      estado(l, "", mostraNumero(par[0], p[par[0]]), "›");
    });
  }

  /* ---------------- editar um número ---------------- */
  function editar(linhaEl, chave, rotulo) {
    if (linhaEl.nextElementSibling && linhaEl.nextElementSibling.classList.contains("edit")) return;
    var p = (typeof MaratuStore !== "undefined" && MaratuStore.getParams()) || {};
    var caixa = el("div", "edit");
    var inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = "decimal";
    inp.value = String(p[chave] == null ? "" : p[chave]).replace(".", ",");
    inp.setAttribute("aria-label", rotulo);
    var ok = el("button", "ok", "salvar");
    var no = el("button", "", "cancelar");
    caixa.appendChild(inp); caixa.appendChild(ok); caixa.appendChild(no);
    linhaEl.parentNode.insertBefore(caixa, linhaEl.nextSibling);
    inp.focus();
    inp.select();

    function fecha() { caixa.remove(); }
    no.addEventListener("click", fecha);
    ok.addEventListener("click", function () {
      var v = parseFloat(String(inp.value).replace(/\s/g, "").replace(",", "."));
      if (isNaN(v) || v < 0) { inp.focus(); return; }
      var atual = MaratuStore.getParams() || {};
      var novo = {
        filamento: atual.filamento, maquina: atual.maquina, maodeobra: atual.maodeobra,
        margem: atual.margem, fixo: atual.fixo, retirada: atual.retirada
      };
      novo[chave] = v;
      MaratuStore.setParams(novo);
      /* as duas funcoes do core: a aba Orcamento continua com os mesmos valores */
      try { if (typeof fillAjustes === "function") fillAjustes(); } catch (e) {}
      try { if (typeof recalc === "function") recalc(); } catch (e) {}
      try { if (typeof renderPainel === "function") renderPainel(); } catch (e) {}
      marcarSync();
      fecha();
      atualizar();
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); ok.click(); }
      if (e.key === "Escape") fecha();
    });
  }

  /* ---------------- partida ---------------- */
  function tentar(gasto) {
    if (montar()) {
      if (typeof MaratuStore !== "undefined" && MaratuStore.ready && MaratuStore.ready.then) {
        MaratuStore.ready.then(function () { marcarSync(); atualizar(); });
      } else { marcarSync(); atualizar(); }
      aplicarAuto();
      setInterval(atualizar, 60000);
      return;
    }
    if (gasto > 12000) return;
    setTimeout(function () { tentar(gasto + 200); }, 200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { tentar(0); });
  else tentar(0);
})();
