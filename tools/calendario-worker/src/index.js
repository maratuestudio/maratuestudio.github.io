// Gerador do papel de parede do dia — Calendário MARATU.
// GET /hoje.png?<config>  -> PNG do dia (o Atalho do iPhone chama este link toda madrugada)
// GET /hoje.svg?<config>  -> mesmo desenho em SVG, pra conferir
// A config é a mesma que a página monta (veja paramsDeCfg em calendario/calendario.js).
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import { Cal } from '../../../calendario/calendario.js';

const SITE = 'https://maratu.com.br'; // onde ficam as fontes (troque com a variável FONTES pra testar)
let pronto = null, fontes = null;

async function preparar(site) {
  if (!pronto) pronto = (async () => {
    await initWasm(resvgWasm);
    fontes = await Promise.all(['Bold', 'Black'].map(async f => {
      const r = await fetch(`${site}/TRYClother-${f}.ttf`, { cf: { cacheTtl: 86400 * 30 } });
      if (!r.ok) throw new Error(`fonte ${f}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    }));
  })().catch(e => { pronto = null; throw e; });
  return pronto;
}

// segundos até a próxima meia-noite no fuso da pessoa (o cache vence quando o dia vira)
function ateMeiaNoite(tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    return Math.max(60, 86400 - ((+p.hour % 24) * 3600 + +p.minute * 60 + +p.second));
  } catch { return 3600; }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (url.pathname === '/' ) return new Response('Calendário MARATU: use /hoje.png?m=ano&t=diario', { headers: { 'content-type': 'text/plain; charset=utf-8', ...cors } });
    const png = url.pathname === '/hoje.png', svg = url.pathname === '/hoje.svg';
    if (!png && !svg) return new Response('Não encontrado', { status: 404, headers: cors });

    const cfg = Cal.cfgDeParams(url.searchParams);
    const hoje = Cal.hojeEm(cfg.tz);
    const validade = ateMeiaNoite(cfg.tz);

    // a chave do cache leva a data: no dia seguinte é outra imagem
    const chave = new Request(`${url.origin}${url.pathname}?${Cal.paramsDeCfg(cfg)}&d=${Cal.isoDn(hoje)}`);
    const cache = caches.default;
    const guardado = await cache.match(chave);
    if (guardado) return guardado;

    const desenho = Cal.paraSVG(Cal.compor(cfg, hoje));
    let resp;
    if (svg) resp = new Response(desenho, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } });
    else {
      try { await preparar(env.FONTES || SITE); }
      catch (e) { return new Response(`Não deu pra carregar as fontes (${e.message}). Tente de novo em instantes.`, { status: 503, headers: cors }); }
      const img = new Resvg(desenho, { font: { fontBuffers: fontes, defaultFontFamily: 'TRY Clother', loadSystemFonts: false } }).render().asPng();
      resp = new Response(img, { headers: { 'content-type': 'image/png' } });
    }
    resp.headers.set('Cache-Control', `public, max-age=${validade}`);
    resp.headers.set('Content-Disposition', `inline; filename="maratu-calendario-${Cal.isoDn(hoje)}.${png ? 'png' : 'svg'}"`);
    for (const [k, v] of Object.entries(cors)) resp.headers.set(k, v);
    ctx.waitUntil(cache.put(chave, resp.clone()));
    return resp;
  },
};
