/* MARATU admin — acertos de celular.

   Cinco coisas que o Rapha apontou, todas medidas antes de mexer (iPhone 390x844):

   1. O botao "Selos" da aba Marketing nascia FORA DA TELA. A fileira e um flex com
      flex-wrap:nowrap e quatro botoes: Nova ideia + Newsletter + Diario + Selos somam
      411px de conteudo em 326px de espaco. O Selos ia de 356 a 443 numa tela de 390,
      ou seja 53px pendurados pra fora, sem scroll pra alcancar.
   2. As cinco abas do modal de Selos ocupavam DUAS linhas (471px de chips em 320px).
      Viram icone + rotulo curto, numa linha so.
   3. Popup e barra de baixo dividiam os mesmos 26px: o card ia ate y=802 e a #tabs
      comeca em y=776. Agora a barra sai de cena enquanto QUALQUER popup do admin
      estiver aberto — foi o que ele pediu, e vale pro admin todo, nao so pros Selos.
   4. Altura de popup media em `vh`, que no Safari do iPhone e a viewport GRANDE (a de
      barra de endereco escondida). O card ficava mais alto que o visivel e o rodape
      caia embaixo do aparelho. Passa a medir em `dvh` e a descontar a safe area.
   5. A camera de vincular selo ganha foco: toque pra focar onde o dedo encostou, botao
      de focar de novo, e zoom quando o aparelho deixa. Adesivo de 15mm e alvo pequeno;
      sem foco de perto o QR nao fecha.

   ARMADILHAS RESPEITADAS AQUI:
   - Nada de `transform` na #tabs. Transform nela cria containing block pro que estiver
     dentro, que e exatamente a causa do bug que o admin-barra-ancora.js foi escrever pra
     corrigir. Aqui a barra sai por opacity + visibility + pointer-events.
   - `pintaAbas` e `ligaCamera` do admin-selos.js sao internos ao IIFE, nao globais: nao
     da pra envelopar. Entao a ligacao aqui e por MutationObserver no DOM que eles montam.
   - Sem emoji em lugar nenhum: os icones sao SVG, no mesmo traco dos do admin-selos.js
     (stroke 1.9, currentColor). */
(function () {
  "use strict";
  if (window.__maratuMobile) return;
  window.__maratuMobile = true;

  var MQ = "(max-width:720px)";
  var mob = function () { return window.matchMedia(MQ).matches; };
  var $id = function (i) { return document.getElementById(i); };

  /* ---------- icones das abas de Selos (mesmo traco do admin-selos.js) ---------- */
  var IC = {
    lote: '<path d="M4 7h16v13H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M9.5 11.5h5"/>',
    vincular: '<path d="M3 8h3l2-2h8l2 2h3v12H3z"/><circle cx="12" cy="13" r="3.4"/>',
    lista: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6v.1M4 12v.1M4 18v.1"/>',
    alertas: '<path d="M12 4.5 21 19H3z"/><path d="M12 10v4M12 16.6v.1"/>',
    produtos: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    mira: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="8.4"/>',
    luz: '<path d="M9 3h6v3l-1.6 2.4V21h-2.8V8.4L9 6z"/><path d="M9.4 12h5.2"/>'
  };
  var ROTULO = { lote: "Lote", vincular: "Ler QR", lista: "Lista", alertas: "Alertas", produtos: "Produtos" };
  function svg(d, tam) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" width="' + tam + '" height="' + tam + '" aria-hidden="true">' + d + "</svg>";
  }

  /* ================= CSS ================= */
  var CSS =
    "@media " + MQ + "{" +
    /* 1. a fileira de acoes da Marketing quebra em DUAS POR LINHA em vez de vazar.
       So `flex-wrap:wrap` nao bastava: com `flex:1` os quatro continuavam numa linha,
       comprimidos ate o "Newsletter" estourar a borda e o icone do Selos virar risco. */
    "  .mm-linha-acoes{flex-wrap:wrap!important}" +
    "  .mm-linha-acoes>*{flex:1 1 calc(50% - 8px)!important;min-width:0}" +
    "  .mm-linha-acoes>* svg{flex:0 0 auto}" +

    /* 2. abas do modal de Selos: cinco numa linha, icone em cima do rotulo */
    "  #slAbas{flex-wrap:nowrap!important;gap:4px!important;margin-bottom:12px!important}" +
    "  #slAbas [data-aba]{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;" +
    "    justify-content:center;gap:3px;padding:8px 2px!important;border-radius:14px!important;" +
    "    letter-spacing:0!important;font-size:9.5px!important;line-height:1.1;text-transform:none}" +
    "  #slAbas [data-aba] .mm-lbl{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    "  #slAbas [data-aba] svg{display:block;flex:0 0 auto}" +

    /* 3. + 4. o card do popup respeita a tela real (dvh) e a safe area de baixo */
    "  .modal-back>.modal-card{max-height:calc(100dvh - 24px - env(safe-area-inset-bottom,0px))!important;" +
    "    max-width:calc(100vw - 20px)!important}" +
    /* rodape de acoes ganha folga pra nunca encostar na borda de baixo */
    "  .modal-back>.modal-card>.form-actions,.modal-back>.modal-card #slCorpo{padding-bottom:env(safe-area-inset-bottom,0px)}" +

    /* 3. barra de baixo sai de cena enquanto houver popup aberto */
    /* Os !important aqui sao defensivos, nao corrigem colisao conhecida: nao existe hoje
       nenhuma regra de opacity pra .tabs/#tabs no admin.html nem nos modulos. Esta <style>
       entra por ultimo no <head>, entao ganharia mesmo sem eles; ficam porque o CSS do
       admin.html e cheio de bloco @media repetido e um dia pode ganhar uma. */
    "  html.mm-popup #tabs{opacity:0!important;visibility:hidden!important;pointer-events:none!important;" +
    "    transition:opacity .18s ease}" +

    /* os dois filtros da tela Lista dividiam 156px cada e cortavam o proprio rotulo
       ("todos os estados" saia como "todos os estado:"). Um por linha, largura cheia. */
    "  #slCorpo select#slFStatus,#slCorpo select#slFProd{flex:1 1 100%!important;min-width:0!important}" +

    /* 5. controles da camera */
    "  #mmCamCtl{display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap}" +
    "}" +
    /* fora do mobile tambem vale esconder a barra sob popup: no desktop a .tabs e do fluxo,
       entao a regra acima e de proposito so no mobile. Nada a fazer aqui. */
    "#mmCamCtl .mm-btn{font-family:var(--clother);font-size:11.5px;font-weight:700;padding:7px 11px;" +
    "  border-radius:999px;border:1.5px solid rgba(13,13,11,.22);background:transparent;color:var(--preto,#0D0D0B);cursor:pointer}" +
    "#mmCamCtl .mm-btn[hidden]{display:none}" +
    "#mmCamCtl input[type=range]{flex:1 1 90px;min-width:90px;accent-color:#C8501A}" +
    "#mmFoco{position:absolute;width:62px;height:62px;margin:-31px 0 0 -31px;border:2px solid #F0ECE4;" +
    "  border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.35);pointer-events:none;opacity:0;transition:opacity .25s ease}" +
    "#mmFoco.on{opacity:1}" +
    "#slVideo{cursor:crosshair}";

  var st = document.createElement("style");
  st.id = "mm-css";
  st.textContent = CSS;
  document.head.appendChild(st);

  /* ================= 1. fileira de acoes da Marketing ================= */
  /* O pai do #mktSelos nao tem classe. Marca ele em vez de depender de :has(). */
  function marcaLinhaAcoes() {
    // o Selos e o Diario sao .mk-rbtn criados por modulo; o "Nova ideia" e do admin-mkt.js
    var alvos = document.querySelectorAll(".mk-rbtn, #mkNova, #mktSelos, #mktMare");
    Array.prototype.forEach.call(alvos, function (el) {
      var p = el.parentElement;
      /* O `contains` aqui NAO e otimizacao, e o que impede um laco. `classList.add` de uma
         classe que ja esta la ainda emite um MutationRecord de atributo (mesmo valor, mesmo
         oldValue), e esse record reacorda o observer, que chama isto de novo: medi 2388
         mutacoes em 3 segundos com a tela parada. Escrever so quando muda de verdade. */
      if (p && !p.classList.contains("mm-linha-acoes")) p.classList.add("mm-linha-acoes");
    });
  }

  /* ================= 2. abas do modal de Selos ================= */
  /* Em pe o iPhone tem 390px e cai no media query; DEITADO tem 844px e sai dele. Se os
     icones ficassem la sem o CSS que os arruma, a fileira ficaria torta ao girar. Por isso
     aqui pinta E despinta, guardando o rotulo original no proprio botao. */
  function pintaIcones() {
    var box = $id("slAbas");
    if (!box) return;
    var emMobile = mob();
    Array.prototype.forEach.call(box.querySelectorAll("[data-aba]"), function (b) {
      var k = b.getAttribute("data-aba");
      if (!IC[k]) return;
      if (emMobile) {
        if (b.getAttribute("data-mm") === k) return;            // ja pintado
        if (!b.hasAttribute("data-mm-orig")) b.setAttribute("data-mm-orig", b.innerHTML);
        b.setAttribute("data-mm", k);
        b.innerHTML = svg(IC[k], 17) + '<span class="mm-lbl">' + (ROTULO[k] || k) + "</span>";
        b.setAttribute("title", ROTULO[k] || k);
      } else if (b.hasAttribute("data-mm")) {
        b.innerHTML = b.getAttribute("data-mm-orig") || (ROTULO[k] || k);
        b.removeAttribute("data-mm");
        b.removeAttribute("title");
      }
    });
  }

  /* ================= 3. barra sai sob popup ================= */
  /* Qualquer .modal-back.on conta, inclusive os criados depois (o #seloBack nasce no
     primeiro clique). Por isso o observer olha o body inteiro, nao uma lista fixa. */
  function algumPopupAberto() {
    var abertos = document.querySelectorAll(".modal-back.on, .modal-back.aberto, .modal-back[open]");
    for (var i = 0; i < abertos.length; i++) {
      var s = getComputedStyle(abertos[i]);
      if (s.display !== "none" && s.visibility !== "hidden") return true;
    }
    return false;
  }
  var ultimo = null;
  function sincronizaBarra() {
    var tem = algumPopupAberto();
    if (tem === ultimo) return;
    ultimo = tem;
    document.documentElement.classList.toggle("mm-popup", tem);
    // escondida pra vista tambem sai do leitor de tela, como o resto do admin faz
    var t = $id("tabs");
    if (t) {
      if (tem && mob()) t.setAttribute("aria-hidden", "true");
      else t.removeAttribute("aria-hidden");
    }
  }

  /* ================= 5. camera com foco ================= */
  var camCtl = null;
  function trilhaDoVideo() {
    var v = $id("slVideo");
    if (!v || !v.srcObject) return null;
    var ts = v.srcObject.getVideoTracks ? v.srcObject.getVideoTracks() : [];
    return ts && ts.length ? ts[0] : null;
  }
  function capsDe(tr) {
    try { return (tr.getCapabilities && tr.getCapabilities()) || {}; } catch (e) { return {}; }
  }
  function aplica(tr, obj) {
    try {
      return tr.applyConstraints({ advanced: [obj] }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }

  function montaControles() {
    var box = $id("slCamBox");
    var tr = trilhaDoVideo();
    if (!box || !tr || $id("mmCamCtl")) return;

    var caps = capsDe(tr);
    var temFoco = !!(caps.focusMode && caps.focusMode.length);
    var temZoom = !!(caps.zoom && typeof caps.zoom.min === "number");
    var temLuz = !!caps.torch;

    // pede o quadro mais nitido que o aparelho der: QR de 15mm perde em 640px de largura
    aplica(tr, { width: { ideal: 1920 }, height: { ideal: 1080 } });
    // foco continuo de perto, quando existe
    if (temFoco && caps.focusMode.indexOf("continuous") >= 0) aplica(tr, { focusMode: "continuous" });

    var ctl = document.createElement("div");
    ctl.id = "mmCamCtl";
    var html = "";
    if (temFoco) html += '<button type="button" class="mm-btn" id="mmRefocar">' + svg(IC.mira, 13) + " Focar</button>";
    if (temLuz) html += '<button type="button" class="mm-btn" id="mmLuz" aria-pressed="false">' + svg(IC.luz, 13) + " Luz</button>";
    if (temZoom) {
      html += '<button type="button" class="mm-btn" id="mmZoomMenos" aria-label="menos zoom">&minus;</button>' +
        '<input type="range" id="mmZoom" aria-label="zoom" min="' + caps.zoom.min + '" max="' + caps.zoom.max +
        '" step="' + (caps.zoom.step || 0.1) + '" value="' + (tr.getSettings().zoom || caps.zoom.min) + '">' +
        '<button type="button" class="mm-btn" id="mmZoomMais" aria-label="mais zoom">+</button>';
    }
    ctl.innerHTML = html;
    if (!html) {
      // nada regulavel neste aparelho: diz a verdade em vez de fingir controle
      ctl.innerHTML = '<span style="font-family:var(--clother);font-size:11px;opacity:.55;">' +
        "este aparelho não deixa ajustar o foco; aproxime até o QR ficar nítido</span>";
    }
    box.appendChild(ctl);
    camCtl = ctl;

    // marcador de onde o dedo pediu foco
    if (!$id("mmFoco")) {
      var m = document.createElement("div");
      m.id = "mmFoco";
      box.appendChild(m);
    }

    var rf = $id("mmRefocar");
    if (rf) rf.onclick = function () {
      var t = trilhaDoVideo(); if (!t) return;
      // um pulso manual->continuo faz o modulo procurar foco de novo
      aplica(t, { focusMode: "manual" });
      setTimeout(function () { aplica(t, { focusMode: "continuous" }); }, 120);
      piscaMarcador(null);
    };
    var lz = $id("mmLuz");
    if (lz) lz.onclick = function () {
      var t = trilhaDoVideo(); if (!t) return;
      var on = lz.getAttribute("aria-pressed") !== "true";
      lz.setAttribute("aria-pressed", on ? "true" : "false");
      lz.style.background = on ? "var(--preto,#0D0D0B)" : "transparent";
      lz.style.color = on ? "var(--areia,#F0ECE4)" : "var(--preto,#0D0D0B)";
      aplica(t, { torch: on });
    };
    var zi = $id("mmZoom");
    if (zi) {
      var setZ = function (v) {
        var t = trilhaDoVideo(); if (!t) return;
        var c = capsDe(t); if (!c.zoom) return;
        v = Math.max(c.zoom.min, Math.min(c.zoom.max, v));
        zi.value = v; aplica(t, { zoom: v });
      };
      zi.oninput = function () { setZ(parseFloat(zi.value)); };
      var passo = (caps.zoom.step || 0.1) * 4;
      $id("mmZoomMais").onclick = function () { setZ(parseFloat(zi.value) + passo); };
      $id("mmZoomMenos").onclick = function () { setZ(parseFloat(zi.value) - passo); };
    }

    // toque no video: foca naquele ponto quando o aparelho aceita ponto de interesse
    var v = $id("slVideo");
    if (v && !v.__mmToque) {
      v.__mmToque = true;
      v.addEventListener("click", function (e) {
        var t = trilhaDoVideo(); if (!t) return;
        var r = v.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        piscaMarcador({ x: e.clientX - r.left, y: e.clientY - r.top });
        var c = capsDe(t);
        if (c.pointsOfInterest) aplica(t, { pointsOfInterest: [{ x: x, y: y }] });
        if (c.focusMode && c.focusMode.indexOf("single-shot") >= 0) aplica(t, { focusMode: "single-shot" });
        else if (c.focusMode && c.focusMode.indexOf("continuous") >= 0) {
          aplica(t, { focusMode: "manual" });
          setTimeout(function () { aplica(t, { focusMode: "continuous" }); }, 120);
        }
      });
    }
  }
  function piscaMarcador(pt) {
    var m = $id("mmFoco"), v = $id("slVideo");
    if (!m || !v) return;
    if (pt) { m.style.left = pt.x + "px"; m.style.top = pt.y + "px"; }
    else { m.style.left = v.clientWidth / 2 + "px"; m.style.top = v.clientHeight / 2 + "px"; }
    m.classList.add("on");
    clearTimeout(piscaMarcador._t);
    piscaMarcador._t = setTimeout(function () { m.classList.remove("on"); }, 900);
  }
  function limpaControles() {
    if (camCtl && camCtl.parentNode) camCtl.parentNode.removeChild(camCtl);
    camCtl = null;
    var m = $id("mmFoco");
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }
  function olhaCamera() {
    var v = $id("slVideo");
    if (!v) return limpaControles();
    /* `srcObject` e propriedade JS, nao atributo: setar ela NAO gera mutacao de DOM e o
       observer nao acorda. Quem avisa que a camera entrou no ar e o proprio <video>. */
    if (!v.__mmEventos) {
      v.__mmEventos = true;
      ["loadedmetadata", "playing", "resize"].forEach(function (ev) {
        v.addEventListener(ev, function () { setTimeout(montaControles, 260); });
      });
    }
    if (v.srcObject && !$id("mmCamCtl")) setTimeout(montaControles, 260);
    if (!v.srcObject && $id("mmCamCtl")) limpaControles();
  }

  /* ================= liga tudo ================= */
  function passo() {
    marcaLinhaAcoes();
    pintaIcones();
    sincronizaBarra();
    olhaCamera();
  }

  /* Agrupa em MICROTASK, e a escolha importa nas duas pontas:

     - `requestAnimationFrame` NAO serve: nao roda quando a aba nao esta pintando (pegou no
       headless durante screenshot, e vale pro PWA em segundo plano). A barra ficava
       escondida depois de fechar o popup.
     - `setTimeout(...,0)` tambem NAO serve: e macrotask, roda DEPOIS do browser ter chance
       de pintar. Como o `pintaAbas` do admin-selos.js reescreve o `#slAbas.innerHTML` do
       zero a cada troca de aba, os cinco chips voltavam ao texto completo (duas linhas) por
       um quadro antes de virarem icone de novo. Piscava a cada toque, e nenhum screenshot
       pos-settle pega isso.
     - Microtask roda no fim da task atual, antes do paint: o conserto entra no mesmo quadro. */
  var obs = new MutationObserver(function () {
    if (obs._t) return;
    obs._t = true;
    Promise.resolve().then(function () {
      /* Desliga enquanto conserta e descarta os records que eu mesmo gerei. Sem isso,
         qualquer escrita minha no DOM observado volta como mutacao e, em microtask, a
         cadeia nunca devolve o controle ao event loop: a pagina TRAVA (foi o que
         aconteceu, confirmado por bissecao). O `contains` do marcaLinhaAcoes ja evita a
         causa conhecida; isto e o cinto de seguranca pra causa futura. */
      obs.disconnect();
      try { passo(); } finally {
        obs.takeRecords();
        liga();
        obs._t = false;
      }
    });
  });
  function liga() {
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  }
  liga();

  window.addEventListener("resize", passo);
  window.addEventListener("orientationchange", function () { setTimeout(passo, 260); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", passo);
  else passo();
})();
