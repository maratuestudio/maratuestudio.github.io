(() => {
const { DPR, $, mouse, clamp, eio, eout, carrega, AMARELO } = PF;
/* ================= SELO DA JELLY LAB (logo redondo) ================= */
const selo = (() => {
  const camadas = {};
  const DX = -156 / 2548;            // o amarelo é a maçã deslocada, como no logo
  let cache = { tam: 0 };
  const pronta = Promise.all(['anel', 'maca', 'amarelo'].map(async n => { camadas[n] = await carrega(`/portfolio/selo-${n}.svg`); }));
  function raster(tam) {
    if (cache.tam === tam) return cache;
    const r = n => { const c = document.createElement('canvas'); c.width = c.height = Math.round(tam * DPR); c.getContext('2d').drawImage(camadas[n], 0, 0, c.width, c.height); return c; };
    cache = { tam, anel: r('anel'), maca: r('maca'), amarelo: r('amarelo') };
    return cache;
  }
  // mola do amarelo e quique da maçã: um estado só, atualizado uma vez por quadro
  const am = { x: 0, y: 0, vx: 0, vy: 0 }, ap = { v: 0, s: 0 };
  function passo() {
    const { tam, cx, cy } = geo();
    const alvoX = mouse.ativo ? clamp((mouse.x - cx) * .06, -tam * .08, tam * .08) : 0;
    const alvoY = mouse.ativo ? clamp((mouse.y - cy) * .06, -tam * .08, tam * .08) : 0;
    am.vx = (am.vx + (alvoX - am.x) * .07) * .84; am.vy = (am.vy + (alvoY - am.y) * .07) * .84; am.x += am.vx; am.y += am.vy;
    ap.v = (ap.v - ap.s * .22) * .8; ap.s += ap.v;
  }
  const quica = () => { ap.s = .16; ap.v = 0; };
  const geo = () => { const tam = Math.round(Math.min(innerWidth, innerHeight) * .64); return { tam, cx: innerWidth / 2, cy: innerHeight / 2 }; };
  // desenha o selo; rot gira só o anel, desl move o amarelo, amassa achata a maçã
  function desenha(ctx, { rot = 0, esc = 1 } = {}) {
    const desl = [am.x, am.y], amassa = ap.s;
    const { tam, cx, cy } = geo(), c = raster(tam), t = tam * esc;
    ctx.save(); ctx.translate(cx, cy);
    ctx.save(); ctx.rotate(rot); ctx.drawImage(c.anel, -t / 2, -t / 2, t, t); ctx.restore();
    // maçã: pivô na base da fruta
    const base = t * .24;
    ctx.translate(0, base); ctx.scale(1 + amassa * .5, 1 - amassa); ctx.translate(0, -base);
    ctx.drawImage(c.amarelo, -t / 2 + t * DX + desl[0], -t / 2 + desl[1], t, t);
    ctx.drawImage(c.maca, -t / 2, -t / 2, t, t);
    ctx.restore();
  }
  const estado = () => ({ x: am.x, y: am.y, s: ap.s, DX });
  return { pronta, desenha, geo, passo, quica, estado };
})();
PF.selo = selo;
PF.antes = () => selo.passo();
})();
