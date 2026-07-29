/* MARATU admin — corrige a mira do arraste na semana da agenda.

   O problema: ao soltar um evento, o admin.js calcula o horario a partir de `clientY`,
   que e a posicao do PONTEIRO. Pegando o bloco pelo meio, a imagem que voce arrasta mostra
   o topo do bloco numa linha e o horario gravado sai meia hora depois. O que a tela mostra
   nao era o que o codigo usava.

   A correcao: guardo, no inicio do arraste, a distancia entre o ponteiro e o topo do bloco.
   Na hora de soltar, desconto essa distancia do `clientY` antes que o handler do admin.js
   leia. Assim o horario passa a sair do TOPO do bloco, que e o que voce enxerga.

   Feito na fase de captura, redefinindo `clientY` so naquele evento. Nao toca no admin.js
   minificado. Ver reference_maratu_admin_js.

   AVISO PRO PROXIMO: a troca do `clientY` vale pro objeto de evento inteiro, e ele continua
   subindo. Hoje nao ha outro listener de "drop" no admin, entao ninguem mais ve. Se um dia
   alguem escutar "drop" no document (upload por arraste, por exemplo), vai receber o valor ja
   corrigido sem saber. Se isso acontecer, restrinja aqui pelo alvo antes de mexer. */
(function () {
  "use strict";
  if (window.__maratuArrasteAgenda) return;
  window.__maratuArrasteAgenda = true;

  var pegouEm = 0;          // px entre o ponteiro e o topo do bloco
  var arrastando = false;   // flag propria: pegouEm pode ser 0 legitimamente, se pegar no topo

  document.addEventListener("dragstart", function (e) {
    var bloco = e.target && e.target.closest && e.target.closest(".wk-ev, .wk-ad");
    if (!bloco) { arrastando = false; pegouEm = 0; return; }
    var r = bloco.getBoundingClientRect();
    pegouEm = e.clientY - r.top;
    // se pegou fora do bloco por algum motivo, nao inventa deslocamento
    if (!(pegouEm >= 0 && pegouEm <= r.height)) pegouEm = 0;
    arrastando = true;
  }, true);

  document.addEventListener("dragend", function () { arrastando = false; pegouEm = 0; }, true);

  document.addEventListener("drop", function (e) {
    if (!arrastando) return;
    // so na grade de hora da semana; no mes o alvo e o dia inteiro e deslocamento nao existe
    var col = e.target && e.target.closest && e.target.closest(".wk-daycol");
    if (!col) return;
    var topo = e.clientY - pegouEm;
    try {
      Object.defineProperty(e, "clientY", { value: topo, configurable: true });
    } catch (err) { /* navegador que nao deixa: fica o comportamento antigo */ }
  }, true);
})();
