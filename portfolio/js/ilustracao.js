// Ilustração: uma tela curva de cinema. A rolagem gira o anel e o fundo pega a cor da obra da vez.
(() => {
const { $, mouse, clamp, eio, progresso, visivel, carrega } = PF;
const sec = $('#ilustracao'), anel = $('#il-anel'), palco = $('.il-palco');
const OBRAS = ['distopia', 'moon', 'arara', 'sea-crown', 'xilo', 'dismorfia', 'star', 'olho', 'beija', 'disforia', 'sun', 'take', 'halteres', 'movimento'];
const cards = OBRAS.map(n => {
  const d = document.createElement('figure'); d.className = 'il-card';
  d.innerHTML = `<img src="/portfolio/img/ilu-${n}.webp" alt="" loading="lazy" decoding="async">`;
  anel.appendChild(d); return d;
});
// cor média de cada obra, pro fundo
const cores = OBRAS.map(() => [28, 27, 42]);
// as 14 obras carregam em segundo plano: não seguram a abertura
const carregando = Promise.all(OBRAS.map((n, i) => carrega(`/portfolio/img/ilu-${n}.webp`).then(im => {
  try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
    cores[i] = [r / 64 * .32, g / 64 * .32, b / 64 * .32]; } catch (e) {}
})));
const N = OBRAS.length, PASSO = 360 / N;
let cor = [28, 27, 42], ang = 0;
function medida() {
  const W = innerWidth, H = innerHeight;
  const ch = Math.min(H * .62, W * .62), cw = ch * .78;
  const R = (cw + 40) / (2 * Math.tan(Math.PI / N));
  cards.forEach((c, i) => { c.style.width = cw + 'px'; c.style.height = ch + 'px';
    c.style.transform = `translate(-50%,-50%) rotateY(${i * PASSO}deg) translateZ(${-R}px)`; });
  anel.style.setProperty('--R', R + 'px');
}
medida(); addEventListener('resize', medida);
function quadro() {
  if (!visivel(sec)) return;
  const p = progresso(palco.parentElement);
  const alvo = -p * (N - 1) * PASSO;
  ang += (alvo - ang) * .12;
  const tilt = (mouse.y / innerHeight - .5) * -6, gira = (mouse.x / innerWidth - .5) * 8;
  anel.style.transform = `translateZ(var(--R)) rotateX(${tilt.toFixed(2)}deg) rotateY(${(ang + gira).toFixed(2)}deg)`;
  const i = clamp(Math.round(-ang / PASSO), 0, N - 1);
  cards.forEach((c, k) => c.classList.toggle('on', k === i));
  const alvoCor = cores[i]; cor = cor.map((v, k) => v + (alvoCor[k] - v) * .06);
  // no fim, o fundo clareia até o tom do Sobre: a próxima cena entra sem linha
  const rr = sec.getBoundingClientRect(), fim = clamp(1 - (rr.bottom - innerHeight) / (innerHeight * .35));
  const final = cor.map((v, k) => v + ([244, 244, 241][k] - v) * fim);
  sec.style.background = `rgb(${final.map(Math.round).join(',')})`;
  palco.style.opacity = (1 - fim).toFixed(3);
  // as luzes apagam quando a sala começa
  const r = sec.getBoundingClientRect();
  sec.style.setProperty('--luz', clamp(r.top / innerHeight).toFixed(3));
}
PF.registra({ id: 'ilustracao', cor: '#1C1B2A', pronta: Promise.resolve(), quadro });
})();
