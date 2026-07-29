/* MARATU admin — modulo "Fluidez". So no toque (celular / PWA).

   O que estava faltando, depois de olhar o CSS existente:
     1. troca de aba era display:none -> block, sem nada no meio;
     2. modal aparecia de estalo, sem subir;
     3. o retangulo cinza de toque do iOS aparecia por cima do gesto da marca;
     4. chegar no fim de uma lista balancava a pagina inteira;
     5. item de lista gerado em runtime (agenda, caixa) nao tinha resposta ao toque.

   O que NAO foi mexido de proposito: .btn:active e .tab:active ja afundam na sombra dura,
   que e o gesto da marca. Continua igual.

   Regra que guiou tudo: animar so transform e opacity. Nada de altura ou top, que forcam
   reflow e mexeriam com o admin-scrollfix.js (ver reference_maratu_falso_travamento).
   Nao toca no admin.js minificado: injeta uma folha de estilo e mais nada. */
(function () {
  "use strict";
  if (window.__maratuFluido) return;
  window.__maratuFluido = true;

  var CSS = [
    /* ── 1. toque ─────────────────────────────────────────────────────────────
       O retangulo cinza do iOS e a cara de site, e ainda por cima cobre a
       animacao de apertar que o botao ja tem. */
    '*{-webkit-tap-highlight-color:transparent}',
    'button,a,.tab,[role="button"]{touch-action:manipulation}',

    /* Resposta ao toque so em linha que é de fato acionavel. Fora dessa lista de
       proposito: .card, que no Orcamento e so caixa de agrupar input — encolher ali
       prometeria um toque que nao existe.
       O :not(:has(...)) evita o movimento duplo: apertar o botao de excluir dentro da
       linha acendia :active na linha tambem, e os dois encolhiam juntos. */
    '.mr-item,.ev,.cx-item{',
    '  transition:transform .12s cubic-bezier(.2,.8,.2,1),filter .12s ease;',
    '}',
    '.mr-item:active:not(:has(button:active,a:active)),',
    '.ev:active:not(:has(button:active,a:active)),',
    '.cx-item:active:not(:has(button:active,a:active)){',
    '  transform:scale(.988);filter:brightness(.975);',
    '}',

    /* ── 2. troca de aba ──────────────────────────────────────────────────────
       190ms: rapido pra nao atrasar, longo pra o olho ver de onde o painel veio. */
    '@keyframes mrt-painel{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:none}}',
    '.panel.on{animation:mrt-painel .19s cubic-bezier(.22,1,.36,1) both}',

    /* ── 3. modal ─────────────────────────────────────────────────────────────
       No celular ele ja e um bottom-sheet ancorado. Faltava subir em vez de piscar. */
    '@keyframes mrt-fundo{from{opacity:0}to{opacity:1}}',
    '@keyframes mrt-sobe{from{opacity:0;transform:translate3d(0,22px,0) scale(.985)}to{opacity:1;transform:none}}',
    '.modal-back.on{animation:mrt-fundo .18s ease both}',
    '.modal-back.on .modal-card{animation:mrt-sobe .28s cubic-bezier(.22,1,.36,1) both}',

    /* ── 4. rolagem ───────────────────────────────────────────────────────────
       Sem contain, o fim de uma lista puxa a pagina toda por tras. */
    'body{overscroll-behavior-y:contain}',
    '.modal-back,.modal-card{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',

    /* ── 5. quem pediu menos movimento, recebe menos ─────────────────────────── */
    '@media (prefers-reduced-motion:reduce){',
    '  .panel.on,.modal-back.on,.modal-back.on .modal-card{animation:none}',
    '  .mr-item,.ev,.cx-item{transition:none}',
    '}'
  ].join("\n");

  function aplica() {
    if (document.getElementById("mrt-fluido-css")) return;
    var st = document.createElement("style");
    st.id = "mrt-fluido-css";
    /* So no toque. No desktop o hover ja da o retorno, e animar a troca de aba
       atrapalha quem navega de teclado. */
    st.textContent = "@media (hover:none) and (pointer:coarse){\n" + CSS + "\n}";
    (document.head || document.documentElement).appendChild(st);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplica);
  else aplica();
})();
