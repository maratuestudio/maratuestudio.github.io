/* MARATU — "Ver na parede".
   Poe o poster na parede do cliente, no tamanho real, usando o AR nativo do
   aparelho. Nada de app, nada de biblioteca no carregamento da pagina.

   Tres degraus, do melhor pro que sempre funciona:
     1. iPhone/iPad  -> AR Quick Look (arquivo .usdz, link com rel="ar")
     2. Android      -> Scene Viewer (arquivo .glb, via intent)
     3. resto        -> visualizador 3D no modal (model-viewer sob demanda);
                        se nem isso rolar, cai no guia de tamanhos que ja existe.

   Os modelos vivem no R2 (um por poster por tamanho, porque quem manda na
   escala do AR e o arquivo). Gerados por tools/gerar-ar.py.
   O botao le o tamanho selecionado na hora do clique, entao nao precisa de
   gancho no selecionarTam().
   Ver reference_maratu_loja_hydration: os cards sao reescritos pela hidratacao,
   por isso a insercao roda de novo a cada mudanca no grid. */
(function () {
  "use strict";
  if (window.__maratuAR) return;
  window.__maratuAR = true;

  /* Os modelos moram no R2, mas passam pelo Worker: o dominio publico do R2
     (r2.dev) nao devolve CORS, e sem CORS o fetch do manifesto e o carregamento
     do .glb no visualizador quebram. O /img/ do Worker ja manda CORS e cache
     imutavel, e preserva o content-type gravado no objeto. */
  var BASE = "https://maratu-api.raphaelnascimento.workers.dev/img/ar/";
  /* Os modelos vao com Cache-Control imutavel de um ano, entao trocar o arquivo
     no R2 nao basta: quem ja abriu continua com o antigo. Subir esta versao a
     cada regeracao dos modelos. v2 = usdz deitado e com a arte de volta. */
  var VERSAO = "3";

  /* Acabamentos de moldura. A ordem aqui e a ordem que aparece na tela. */
  var MOLDURAS = [
    { id: "preta",   rotulo: "Preta",   amostra: "#151513" },
    { id: "branca",  rotulo: "Branca",  amostra: "#EDEAE2" },
    { id: "madeira", rotulo: "Madeira", amostra: "linear-gradient(120deg,#7A4E28,#5C3A1D 60%,#8A5B32)" }
  ];
  var MOLDURA_PADRAO = "preta";
  var CHAVE_MOLDURA = "maratu_ar_moldura";

  function molduraEscolhida() {
    try {
      var m = localStorage.getItem(CHAVE_MOLDURA);
      for (var i = 0; i < MOLDURAS.length; i++) if (MOLDURAS[i].id === m) return m;
    } catch (e) {}
    return MOLDURA_PADRAO;
  }

  function guardarMoldura(m) {
    try { localStorage.setItem(CHAVE_MOLDURA, m); } catch (e) {}
  }
  var MODEL_VIEWER = "vendor/model-viewer.min.js";
  var MEDIDAS = {
    A4: "21 × 29,7 cm",
    A3: "29,7 × 42 cm",
    A2: "42 × 59,4 cm",
    A1: "59,4 × 84,1 cm"
  };

  /* Quem tem modelo esta no manifesto que o gerador sobe junto com os arquivos.
     Assim poster novo ganha o botao sozinho, sem mexer neste arquivo. Enquanto
     o manifesto nao chega, nenhum botao aparece — melhor que botao quebrado. */
  var comModelo = null;

  var ICONE =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M3 21h18"/>' +
    '<path d="m7 14 3.5-4L14 14l2-2.5L19 15"/></svg>';

  /* --- aparelho ---------------------------------------------------------- */
  function ehIOS() {
    var ua = navigator.userAgent || "";
    // iPad novo se apresenta como Mac; o toque entrega
    return /iPad|iPhone|iPod/.test(ua) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function temQuickLook() {
    var a = document.createElement("a");
    return !!(a.relList && a.relList.supports && a.relList.supports("ar")) && ehIOS();
  }

  function ehAndroid() {
    return /android/i.test(navigator.userAgent || "");
  }

  /* --- GA4 --------------------------------------------------------------- */
  function medir(produto, tamanho, moldura, modo) {
    if (typeof gtag === "function") {
      // beacon: no Android a pagina sai pro Scene Viewer logo depois daqui
      gtag("event", "ver_na_parede", {
        produto: produto, tamanho: tamanho, moldura: moldura, modo: modo,
        transport_type: "beacon"
      });
    }
  }

  /* --- dados do card ----------------------------------------------------- */
  function tamanhoDoCard(card) {
    var sel = card.querySelector(".tam-btn.selected");
    var t = sel && sel.dataset.tam;
    return MEDIDAS[t] ? t : "A4";
  }

  function nomeDoCard(card) {
    var n = card.querySelector(".produto-nome");
    return (n && n.textContent.trim()) || "Pôster";
  }

  function idDoCard(card) {
    var btn = card.querySelector(".tam-btn[data-poster]");
    return btn ? btn.dataset.poster : null;
  }

  function arquivo(pid, tam, moldura, ext) {
    return BASE + pid + "-" + tam + "-" + moldura + "." + ext + "?v=" + VERSAO;
  }

  /* --- degrau 1: iOS ----------------------------------------------------- */
  function abrirQuickLook(pid, tam, moldura, nome) {
    var a = document.createElement("a");
    a.setAttribute("rel", "ar");
    a.href = arquivo(pid, tam, moldura, "usdz");
    // o Safari so entra no Quick Look se o link tiver uma imagem dentro
    var img = document.createElement("img");
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    img.alt = "";
    a.appendChild(img);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 1000);
    medir(nome, tam, moldura, "quick-look");
  }

  /* --- degrau 2: Android ------------------------------------------------- */
  function abrirSceneViewer(pid, tam, moldura, nome) {
    var volta = location.origin + location.pathname + "#ver3d=" + pid + "-" + tam + "-" + moldura;
    var alvo = "https://arvr.google.com/scene-viewer/1.0" +
      "?file=" + encodeURIComponent(arquivo(pid, tam, moldura, "glb")) +
      "&mode=ar_preferred" +
      "&enable_vertical_placement=true" +
      "&resizable=false" +          // o poster tem tamanho real; nao e pra esticar
      "&title=" + encodeURIComponent(nome + " · " + MEDIDAS[tam]);
    var intent = "intent://" + alvo.replace("https://", "") +
      "#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;" +
      "S.browser_fallback_url=" + encodeURIComponent(volta) + ";end;";
    medir(nome, tam, moldura, "scene-viewer");
    // se o Scene Viewer nao existir, o proprio Android abre o fallback
    location.href = intent;
  }

  /* --- degrau 3: modal 3D ------------------------------------------------ */
  var modal = null;
  var DICA = "Arraste pra girar. No celular, o botão abre a câmera e o pôster sai no tamanho real.";

  function montarModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "tam-popup-overlay";
    modal.id = "ar-overlay";
    modal.innerHTML =
      '<div class="tam-popup ar-popup">' +
        '<button class="tam-popup-close" type="button" data-ar-fechar>fechar ✕</button>' +
        '<p class="tam-popup-title" id="ar-titulo">Ver na parede</p>' +
        '<p class="tam-popup-sub" id="ar-medida"></p>' +
        '<div class="ar-palco" id="ar-palco"></div>' +
        '<p class="ar-dica" id="ar-dica">' + DICA + '</p>' +
      '</div>';
    modal.addEventListener("click", function (ev) {
      if (ev.target === modal || ev.target.closest("[data-ar-fechar]")) fecharModal();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function fecharModal() {
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";   // igual aos outros popups da loja
    var palco = modal.querySelector("#ar-palco");
    if (palco) palco.innerHTML = "";     // descarrega o WebGL ao fechar
  }

  function carregarModelViewer() {
    if (window.__mvCarregando) return window.__mvCarregando;
    window.__mvCarregando = new Promise(function (ok, falhou) {
      if (customElements.get("model-viewer")) return ok();
      var s = document.createElement("script");
      s.type = "module";
      s.src = MODEL_VIEWER;
      s.onload = function () {
        customElements.whenDefined("model-viewer").then(ok, falhou);
      };
      s.onerror = falhou;
      document.head.appendChild(s);
    });
    return window.__mvCarregando;
  }

  function semWebGL() {
    try {
      var c = document.createElement("canvas");
      return !(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) { return true; }
  }

  function abrirModal(pid, tam, moldura, nome) {
    montarModal();
    modal.querySelector("#ar-titulo").textContent = nome;
    modal.querySelector("#ar-medida").textContent = "Impresso em " + tam + " · " + MEDIDAS[tam];
    var palco = modal.querySelector("#ar-palco");
    var dica = modal.querySelector("#ar-dica");
    dica.textContent = DICA;   // pode ter virado o botao do guia numa abertura anterior
    palco.innerHTML = '<p class="ar-carregando">carregando o modelo…</p>';
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    medir(nome, tam, moldura, "modelo-3d");

    if (semWebGL()) return caiPraTabela(palco, dica);

    carregarModelViewer().then(function () {
      var mv = document.createElement("model-viewer");
      mv.setAttribute("src", arquivo(pid, tam, moldura, "glb"));
      mv.setAttribute("alt", nome + " em 3D");
      mv.setAttribute("camera-controls", "");
      mv.setAttribute("disable-zoom", "");
      // sem isto o enquadramento padrao deixa o poster pequeno demais no palco
      mv.setAttribute("camera-orbit", "12deg 80deg auto");
      mv.setAttribute("field-of-view", "24deg");
      mv.setAttribute("shadow-intensity", "1");
      mv.setAttribute("exposure", "1.05");
      mv.setAttribute("ar", "");
      mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
      mv.setAttribute("ar-placement", "wall");
      mv.setAttribute("ios-src", arquivo(pid, tam, moldura, "usdz"));
      mv.addEventListener("error", function () { caiPraTabela(palco, dica); });
      palco.innerHTML = "";
      palco.appendChild(mv);
    }).catch(function () { caiPraTabela(palco, dica); });
  }

  /* ultimo degrau: o guia de tamanhos que a loja ja tem */
  function caiPraTabela(palco, dica) {
    palco.innerHTML = '<p class="ar-carregando">Seu navegador não abre o modelo 3D.</p>';
    dica.innerHTML = '<button type="button" class="ar-btn-principal">Ver o guia de tamanhos</button>';
    var b = dica.querySelector(".ar-btn-principal");
    b.addEventListener("click", function () {
      fecharModal();
      if (typeof window.abrirTamPopup === "function") window.abrirTamPopup();
    });
  }

  /* --- aviso da primeira vez --------------------------------------------- */
  /* No celular o clique cai direto na camera, entao o modal 3D nunca aparece e
     nao ha onde explicar o gesto. Este aviso sai uma vez so, na primeira vez,
     e depois some pra nao virar pedagio. */
  var CHAVE_AVISO = "maratu_ar_avisado";
  var aviso = null;

  function jaAvisado() {
    try { return localStorage.getItem(CHAVE_AVISO) === "1"; } catch (e) { return true; }
  }

  function marcarAvisado() {
    try { localStorage.setItem(CHAVE_AVISO, "1"); } catch (e) {}
  }

  function fecharEscolha() {
    if (!aviso) return;
    aviso.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* Uma tela so pras duas decisoes: qual moldura e seguir pro AR. As instrucoes
     de como apontar aparecem so enquanto a pessoa nao usou o recurso nenhuma vez. */
  function molduraDoPoster(pid) {
    var info = comModelo && comModelo[pid];
    var lista = info && info.molduras;
    if (!lista || !lista.length) return MOLDURAS;
    return MOLDURAS.filter(function (m) { return lista.indexOf(m.id) !== -1; });
  }

  function mostrarEscolha(pid, tam, seguir, rotuloBotao, comCamera) {
    var disponiveis = molduraDoPoster(pid);
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.className = "tam-popup-overlay";
      aviso.innerHTML =
        '<div class="tam-popup ar-aviso">' +
          '<button class="tam-popup-close" type="button" data-ar-fechar>fechar ✕</button>' +
          '<p class="tam-popup-title">Escolha a moldura</p>' +
          '<p class="tam-popup-sub" id="ar-medida-escolha"></p>' +
          '<div class="ar-molduras" id="ar-molduras">' +
            disponiveis.map(function (m) {
              return '<button type="button" class="ar-moldura" data-moldura="' + m.id + '" aria-pressed="false">' +
                '<span class="ar-moldura__amostra" style="background:' + m.amostra + '"></span>' +
                '<span class="ar-moldura__rotulo">' + m.rotulo + '</span>' +
              '</button>';
            }).join("") +
          '</div>' +
          '<ul class="ar-passos" id="ar-passos">' +
            '<li>Aponte pra parede e mova o celular devagar.</li>' +
            '<li>Parede lisa e clara demora mais. Mire perto de uma quina, de um rodapé ou de outro quadro.</li>' +
            '<li>Não pince pra ajustar. O tamanho já sai no real.</li>' +
          '</ul>' +
          '<button type="button" class="ar-btn-principal" data-ar-seguir>Abrir a câmera</button>' +
        '</div>';
      document.body.appendChild(aviso);
      aviso.addEventListener("click", function (ev) {
        if (ev.target === aviso || ev.target.closest("[data-ar-fechar]")) fecharEscolha();
        var op = ev.target.closest(".ar-moldura");
        if (op) {
          guardarMoldura(op.dataset.moldura);
          marcarEscolhida();
        }
      });
    }

    marcarEscolhida();
    aviso.querySelector("#ar-medida-escolha").textContent =
      "Pôster " + tam + " · " + MEDIDAS[tam] + " de papel";
    // as dicas so fazem sentido pra quem vai apontar a camera, e so na estreia
    aviso.querySelector("#ar-passos").style.display =
      (comCamera && !jaAvisado()) ? "" : "none";

    var botao = aviso.querySelector("[data-ar-seguir]");
    botao.textContent = rotuloBotao;
    botao.onclick = function () {
      fecharEscolha();
      marcarAvisado();
      seguir(molduraEscolhida());   // segue no mesmo toque, que e o que o iOS exige
    };
    aviso.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function marcarEscolhida() {
    var atual = molduraEscolhida();
    aviso.querySelectorAll(".ar-moldura").forEach(function (b) {
      var ativa = b.dataset.moldura === atual;
      b.classList.toggle("selecionada", ativa);
      b.setAttribute("aria-pressed", ativa ? "true" : "false");
    });
  }

  /* --- clique ------------------------------------------------------------ */
  function aoClicar(ev) {
    var card = ev.currentTarget.closest(".produto-card");
    if (!card) return;
    var pid = idDoCard(card);
    if (!pid) return;
    var tam = tamanhoDoCard(card);
    var nome = nomeDoCard(card);

    var seguir, rotulo, comCamera = true;
    if (temQuickLook()) {
      seguir = function (m) { abrirQuickLook(pid, tam, m, nome); };
      rotulo = "Abrir a câmera";
    } else if (ehAndroid()) {
      seguir = function (m) { abrirSceneViewer(pid, tam, m, nome); };
      rotulo = "Abrir a câmera";
    } else {
      seguir = function (m) { abrirModal(pid, tam, m, nome); };
      rotulo = "Ver em 3D";
      comCamera = false;
    }
    mostrarEscolha(pid, tam, seguir, rotulo, comCamera);
  }

  /* --- injecao no card --------------------------------------------------- */
  function aplicar() {
    if (!comModelo) return;
    document.querySelectorAll('.produto-card[data-tipo="poster"]').forEach(function (card) {
      if (card.querySelector(".btn-ar")) return;
      var pid = idDoCard(card);
      if (!pid || !comModelo[pid]) return;
      var encomendar = card.querySelector(".btn-encomendar");
      if (!encomendar) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-ar";
      btn.innerHTML = ICONE + "<span>Ver na parede</span>";
      btn.addEventListener("click", aoClicar);
      encomendar.parentNode.insertBefore(btn, encomendar);
    });
  }

  /* volta do Scene Viewer quando o aparelho nao tem AR: abre o modal 3D */
  function verHash() {
    // o id vem do D1 e tem hifen (poster-atalaia, farol-de-atalaia)
    var m = /#ver3d=([a-z0-9-]+)-(A[1-4])-([a-z]+)$/i.exec(location.hash || "");
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    var pid = m[1], tam = m[2].toUpperCase(), moldura = m[3].toLowerCase();
    var card = document.querySelector('.tam-btn[data-poster="' + pid + '"]');
    var nome = card ? nomeDoCard(card.closest(".produto-card")) : "Pôster";
    abrirModal(pid, tam, moldura, nome);
  }

  function init() {
    // a hidratacao do catalogo reescreve o grid; reaplica quando isso acontece.
    // So a secao da loja: no body inteiro o observer acordaria a cada mudanca de
    // popup, mascote ou radio, e a home ja gasta CPU de sobra com as animacoes.
    var alvo = document.getElementById("loja") || document.body;
    var obs = new MutationObserver(function () {
      obs.disconnect();
      aplicar();
      obs.observe(alvo, { childList: true, subtree: true });
    });
    obs.observe(alvo, { childList: true, subtree: true });

    fetch(BASE + "manifesto.json", { cache: "default" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        comModelo = (m && m.posteres) || null;
        aplicar();
        verHash();
      })
      .catch(function () { /* sem manifesto, a loja fica exatamente como era */ });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fecharModal();
    });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
