// Calendário MARATU: o ano em pontos, um por dia, com a paleta mudando todo dia.
// O mesmo código monta a imagem na página (canvas) e no gerador do link diário
// (Worker, SVG -> PNG). Mexeu aqui, as duas saídas mudam juntas.
// Sem DOM e sem dependência: roda no navegador e no Cloudflare Worker.

const DIA = 86400000;
const C = { azul:'#0E3272', azulc:'#2E6FC4', laranja:'#C8501A', areia:'#F0ECE4', preto:'#0D0D0B', dourado:'#D4960A' };

// Uma paleta por dia, sempre das cores da marca: [nome, fundo, dias passados, hoje].
// A ordem alterna claro/escuro pra dois dias seguidos nunca ficarem parecidos.
// Depende só da data, então o mesmo dia dá a mesma imagem em qualquer lugar.
const GIRO = [
  ['Maré',           C.azul,    C.areia,   C.laranja],
  ['Cajá',           C.areia,   C.laranja, C.azul],
  ['Mangue',         C.preto,   C.dourado, C.areia],
  ['Brasa',          C.laranja, C.areia,   C.preto],
  ['Fundo do mar',   C.azul,    C.dourado, C.areia],
  ['Maresia',        C.areia,   C.azul,    C.laranja],
  ['São João',       C.preto,   C.laranja, C.dourado],
  ['Dendê',          C.dourado, C.preto,   C.areia],
  ['Céu de Aracaju', C.azulc,   C.areia,   C.dourado],
  ['Areia',          C.areia,   C.preto,   C.laranja],
  ['Farol',          C.preto,   C.areia,   C.laranja],
  ['Barro',          C.laranja, C.preto,   C.areia],
  ['Pôr do sol',     C.dourado, C.azul,    C.laranja],
  ['Coqueiral',      C.azulc,   C.preto,   C.areia],
];

const LOGO = [
  'M38.05 19.28 32.47 0 0 0 0 23.92 31.53 29.14 0 29.14 0 53.57 32.47 53.57 32.47 29.94 38.13 47.91 43.71 29.94 43.71 53.57 76.11 53.57 76.11 0 43.71 0Z',
  'M78.37,0v23.85l32.55,4.93h-32.62v24.79h13.41c11.23,0,19.35-9.13,19.72-24.72l6.74,24.5v.22h32.4v-23.05l.07-.07L136.64,0h-58.28Z',
  'M223.28,15.08c0-11.23-7.39-15.08-26.02-15.08h-44.43l.14,53.57h32.33v-28.56c4.28.14,5.36,1.3,5.36,4.13v2.97h-5.36c3.62,16.89,17.69,21.46,29.28,21.46h8.05v-21.46h-28.99c21.82-1.23,29.65-5.36,29.65-17.03Z',
  'M225.54,0v23.85l32.55,4.93h-32.62v24.79h13.41c11.24,0,19.35-9.13,19.72-24.72l6.74,24.5v.22h32.4v-23.05l.07-.07-13.99-30.44h-58.28Z',
  'M299.99 26.38 318.25 26.38 318.25 53.57 350.58 53.57 350.58 26.38 368.92 26.38 368.92 0 299.99 0Z',
  'M407.71,0v21.53h-.87c-2.32,0-3.33-.87-3.33-4.2V0h-32.4v28.12c0,18.56,4.78,25.95,17.61,25.95,14.86,0,17.83-8.26,18.99-31.02v30.52h32.33V0h-32.33Z',
];
const LOGO_W = 440.04;

// O Chico, aratu em pixel da MARATU (o mesmo de projetos-app/chico.js, de óculos).
// o = corpo laranja, p = armação preta, b = lente branca. 40 x 20 pixels.
const CHICO = [
  '.........pppppppp......pppppppp.........',
  '........pppppppppppppppppppppppp........',
  '........pbbbbbbbbppppppbbbbbbbbp........',
  '........pbbbboobbp....pbboobbbbp........',
  '........pbbbboobbp....pbboobbbbp........',
  '........pbbbboobbp....pbboobbbbp........',
  '........pbbbbbbbbp....pbbbbbbbbp........',
  '.........pppppppp......pppppppp.........',
  '....oo..oooooooooooooooooooooooo..oo....',
  '..oooo..oooooooooooooooooooooooo..oooo..',
  '.ooooo..oooooooooooooooooooooooo..ooooo.',
  '.ooooo..oooooooooooooooooooooooo..ooooo.',
  'oooooo...oooooooooooooooooooooo...oooooo',
  'oooooo...oooooooooooooooooooooo...oooooo',
  'oooooo....oooooooooooooooooooo....oooooo',
  'oooooo.....oooooooooooooooooo.....oooooo',
  'oooooo.....oooooooooooooooooo.....oooooo',
  '.ooooo.......oooooooooooooo.......ooooo.',
  '..oooo........oooooooooooo........oooo..',
  '...ooo..........oooooooo..........ooo...',
];
const CHICO_COR = { o:'#E06A2C', p:'#0D0D0B', b:'#FFFFFF' };
// contorno de 1 pixel em volta do Chico, pra ele aparecer em qualquer fundo (até no laranja)
const CHICO_CONTORNO = (() => {
  const H = CHICO.length, W = CHICO[0].length, cheio = (x, y) => y >= 0 && y < H && x >= 0 && x < W && CHICO[y][x] !== '.';
  const out = [];
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++)
    if (!cheio(x, y) && (cheio(x-1, y) || cheio(x+1, y) || cheio(x, y-1) || cheio(x, y+1))) out.push([x, y]);
  return out;
})();
// pixels agrupados em faixas horizontais da mesma cor: [x, y, largura, letra]
const CHICO_FAIXAS = CHICO.flatMap((linha, y) => {
  const f = []; let x = 0;
  while (x < linha.length) { const c = linha[x]; let w = 1; while (linha[x+w] === c) w++; if (c !== '.') f.push([x, y, w, c]); x += w; }
  return f;
});

// ── datas como número de dia (UTC), pra não sofrer com fuso e horário de verão ──
const dn = (a, m, d) => Math.floor(Date.UTC(a, m, d) / DIA);           // m de 0 a 11
const deDn = n => { const d = new Date(n * DIA); return { a: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), sem: d.getUTCDay() }; };
const isoDn = n => { const x = deDn(n); return `${x.a}-${String(x.m+1).padStart(2,'0')}-${String(x.d).padStart(2,'0')}`; };
function hojeEm(tz, agora = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
      .formatToParts(agora).map(x => [x.type, x.value]));
    return dn(+p.year, +p.month - 1, +p.day);
  } catch { return dn(agora.getFullYear(), agora.getMonth(), agora.getDate()); }
}

// ── cores ──
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n>>16},${n>>8&255},${n&255},${a})`; };
const claro = hex => { const n = parseInt(hex.slice(1), 16); return (0.299*(n>>16) + 0.587*(n>>8&255) + 0.114*(n&255)) > 150; };
const sombra = hex => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(v*.88).toString(16).padStart(2,'0'); return '#'+f(n>>16)+f(n>>8&255)+f(n&255); };
const paletaDoDia = diaN => GIRO[((diaN % GIRO.length) + GIRO.length) % GIRO.length];
function temaDoDia(diaN) {
  const [nome, bg, feito, hoje] = paletaDoDia(diaN), txt = claro(bg) ? C.preto : C.areia;
  return { nome, bg, bg2: sombra(bg), feito, falta: rgba(txt, claro(bg) ? .13 : .16), hoje, txt, sub: rgba(txt, .6), marca: hoje };
}

// ── configuração <-> link: só o tamanho da tela e o fuso ──
function cfgDeParams(sp) {
  return {
    w: Math.min(2000, Math.max(320, +sp.get('w') || 1179)),
    h: Math.min(4000, Math.max(480, +sp.get('h') || 2556)),
    tz: sp.get('tz') || 'America/Sao_Paulo',
  };
}
const paramsDeCfg = c => new URLSearchParams({ w: c.w, h: c.h, tz: c.tz }).toString();

// ── composição: devolve uma lista de formas, sem desenhar nada ──
function compor(cfg, hoje) {
  const W = +cfg.w, H = +cfg.h, u = W / 100, T = temaDoDia(hoje), hj = deDn(hoje);
  const ini = dn(hj.a, 0, 1), dias = dn(hj.a + 1, 0, 1) - ini, n = hoje - ini;
  const linha = `faltam ${dias - n - 1} dias · ${Math.round(n / dias * 100)}%`;
  const out = [{ t:'fundo', c1:T.bg, c2:T.bg2 }];

  // grade corrida de 15 colunas na área livre abaixo do relógio do sistema
  const box = { x: u*9, y: H*.355, w: W - u*18, h: H*.425 }, cols = 15, linhas = Math.ceil(dias / cols);
  const passo = Math.min(box.w / cols, box.h / linhas);
  const x0 = box.x + (box.w - passo*cols)/2 + passo/2, y0 = box.y + (box.h - passo*linhas)/2 + passo/2;
  for (let i = 0; i < dias; i++) {
    const tipo = i < n ? 'feito' : i === n ? 'hoje' : 'falta';
    out.push({ t:'ponto', x: x0 + (i % cols)*passo, y: y0 + Math.floor(i / cols)*passo, r: passo*.3, tipo, cor: T[tipo] });
  }

  // a trilha do ano: o Chico anda por ela, do 1º de janeiro (esquerda) ao 31 de dezembro (direita)
  const gx0 = x0 - passo*.3, gx1 = x0 + (cols-1)*passo + passo*.3, pct = (n + .5) / dias;
  const yTrilha = box.y + box.h + H*.052, esp = u*.45, xc = gx0 + (gx1 - gx0)*pct;
  out.push({ t:'barra', x: gx0, y: yTrilha, w: gx1 - gx0, h: esp, cor: T.falta });
  out.push({ t:'barra', x: gx0, y: yTrilha, w: xc - gx0, h: esp, cor: T.feito });
  const px = u*.38, cw = 40*px, chx = Math.min(Math.max(xc - cw/2, gx0 - px*2), gx1 - cw + px*2);
  out.push({ t:'chico', x: chx, y: yTrilha - 20*px - px*.5, px, contorno: T.txt });

  const yLinha = yTrilha + H*.055;
  out.push({ t:'texto', s:`${hj.a} · ${T.nome}`.toUpperCase(), x:W/2, y:yLinha - u*5.4, tam:u*2.6, cor:T.sub, peso:900, esp:u*.4 });
  out.push({ t:'texto', s:linha, x:W/2, y:yLinha, tam:u*3.6, cor:T.txt, peso:700, esp:u*.05 });
  const lw = u*16; out.push({ t:'logo', x: W/2 - lw/2, y: H*.905, w: lw, cor: T.marca });
  return { W, H, tema: T, linha, formas: out };
}

// ── saída 1: canvas (página) ──
function pintarCanvas(ctx, { W, H, formas }, familia = 'Clother') {
  for (const f of formas) {
    if (f.t === 'fundo') { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, f.c1); g.addColorStop(1, f.c2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    else if (f.t === 'ponto') {
      ctx.fillStyle = f.cor; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
      if (f.tipo === 'hoje') { ctx.strokeStyle = f.cor; ctx.lineWidth = f.r*.32; ctx.beginPath(); ctx.arc(f.x, f.y, f.r*1.75, 0, Math.PI*2); ctx.stroke(); }
    }
    else if (f.t === 'texto') {
      ctx.font = `${f.peso} ${f.tam}px ${familia}, system-ui, sans-serif`;
      ctx.fillStyle = f.cor; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${f.esp}px`;
      ctx.fillText(f.s, f.x, f.y);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    else if (f.t === 'barra') { ctx.fillStyle = f.cor; ctx.beginPath(); ctx.roundRect(f.x, f.y, Math.max(f.w, 0), f.h, f.h/2); ctx.fill(); }
    else if (f.t === 'chico') {
      const q = f.px, sx = v => Math.round(f.x + v*q), sy = v => Math.round(f.y + v*q);
      ctx.fillStyle = f.contorno;
      for (const [x, y] of CHICO_CONTORNO) ctx.fillRect(sx(x), sy(y), sx(x+1) - sx(x), sy(y+1) - sy(y));
      for (const [x, y, w, c] of CHICO_FAIXAS) { ctx.fillStyle = CHICO_COR[c]; ctx.fillRect(sx(x), sy(y), sx(x+w) - sx(x), sy(y+1) - sy(y)); }
    }
    else if (f.t === 'logo') { const s = f.w / LOGO_W; ctx.save(); ctx.translate(f.x, f.y); ctx.scale(s, s); ctx.fillStyle = f.cor; LOGO.forEach(d => ctx.fill(new Path2D(d))); ctx.restore(); }
  }
}

// ── saída 2: SVG (gerador do link diário) ──
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const n2 = v => Math.round(v * 100) / 100;
const pintura = cor => { const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(cor); return m ? `fill="rgb(${m[1]},${m[2]},${m[3]})" fill-opacity="${m[4]}"` : `fill="${cor}"`; };
function paraSVG({ W, H, formas }, familia = 'TRY Clother') {
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`];
  for (const f of formas) {
    if (f.t === 'fundo') p.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.c1}"/><stop offset="1" stop-color="${f.c2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`);
    else if (f.t === 'ponto') {
      p.push(`<circle cx="${n2(f.x)}" cy="${n2(f.y)}" r="${n2(f.r)}" ${pintura(f.cor)}/>`);
      if (f.tipo === 'hoje') p.push(`<circle cx="${n2(f.x)}" cy="${n2(f.y)}" r="${n2(f.r*1.75)}" fill="none" stroke="${f.cor}" stroke-width="${n2(f.r*.32)}"/>`);
    }
    else if (f.t === 'texto') {
      // o Black vem numa família própria no arquivo da fonte
      const fam = f.peso >= 900 ? `${familia} Black` : familia;
      p.push(`<text x="${n2(f.x)}" y="${n2(f.y)}" font-family="${fam}" font-weight="${f.peso}" font-size="${n2(f.tam)}" letter-spacing="${n2(f.esp)}" text-anchor="middle" ${pintura(f.cor)}>${esc(f.s)}</text>`);
    }
    else if (f.t === 'barra') p.push(`<rect x="${n2(f.x)}" y="${n2(f.y)}" width="${n2(Math.max(f.w, 0))}" height="${n2(f.h)}" rx="${n2(f.h/2)}" ${pintura(f.cor)}/>`);
    else if (f.t === 'chico') {
      // pixels de verdade: sem suavizar as bordas
      const r = (x, y, w, cor) => `<rect x="${x}" y="${y}" width="${w}" height="1" ${cor}/>`;
      p.push(`<g transform="translate(${n2(f.x)} ${n2(f.y)}) scale(${f.px})" shape-rendering="crispEdges">`);
      p.push(CHICO_CONTORNO.map(([x, y]) => r(x, y, 1, pintura(f.contorno))).join(''));
      p.push(CHICO_FAIXAS.map(([x, y, w, c]) => r(x, y, w, `fill="${CHICO_COR[c]}"`)).join(''));
      p.push('</g>');
    }
    else if (f.t === 'logo') p.push(`<g transform="translate(${n2(f.x)} ${n2(f.y)}) scale(${f.w / LOGO_W})" fill="${f.cor}">${LOGO.map(d => `<path d="${d}"/>`).join('')}</g>`);
  }
  p.push('</svg>');
  return p.join('');
}

export const Cal = { DIA, GIRO, dn, deDn, isoDn, hojeEm, paletaDoDia, temaDoDia, cfgDeParams, paramsDeCfg, compor, pintarCanvas, paraSVG };
