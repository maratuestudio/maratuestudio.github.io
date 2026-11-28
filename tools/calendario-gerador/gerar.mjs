// Gera o papel de parede de hoje (horário de Brasília) em todos os tamanhos de tela.
// Roda toda madrugada pela Action .github/workflows/calendario.yml, que publica os PNGs
// no branch calendario-imagens. O Atalho do iPhone busca de lá.
// Uso: node gerar.mjs <pasta de saída>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { Cal } from '../../calendario/calendario.js';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const saida = process.argv[2] || 'saida';
const TZ = 'America/Sao_Paulo';
// os mesmos tamanhos do seletor da página (calendario/index.html)
const TAMANHOS = ['1179x2556', '1206x2622', '1290x2796', '1320x2868', '1170x2532', '1080x2400', '1440x3120'];

const require = createRequire(import.meta.url);
await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
const fontes = ['Bold', 'Black'].map(f => new Uint8Array(readFileSync(`${RAIZ}TRYClother-${f}.ttf`)));

const hoje = Cal.hojeEm(TZ);
mkdirSync(saida, { recursive: true });
for (const t of TAMANHOS) {
  const [w, h] = t.split('x').map(Number);
  const svg = Cal.paraSVG(Cal.compor({ w, h, tz: TZ }, hoje));
  const png = new Resvg(svg, { font: { fontBuffers: fontes, defaultFontFamily: 'TRY Clother', loadSystemFonts: false } }).render().asPng();
  writeFileSync(`${saida}/${t}.png`, png);
  console.log(`${t}.png  ${(png.length / 1024).toFixed(0)} KB`);
}
const tema = Cal.temaDoDia(hoje);
writeFileSync(`${saida}/hoje.json`, JSON.stringify({ data: Cal.isoDn(hoje), paleta: tema.nome, tamanhos: TAMANHOS }, null, 2) + '\n');
console.log(`dia ${Cal.isoDn(hoje)} · paleta ${tema.nome}`);
