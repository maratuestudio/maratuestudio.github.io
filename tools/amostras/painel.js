// Gera a imagem de amostra do painel com o nome do negócio, pra abordagem de MEI e autônomo.
// uso: node tools/amostras/painel.js <ramo> "<nome do negócio>" "<nome do dono>" [cor] [saida.png]
// ramos: saude, beleza, encomenda, tecnico. Precisa do servidor da prévia rodando na 8750.
const { webkit } = require("/Users/raphael/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const [ramo = 'saude', nome = '', dono = '', cor = '', saida = `amostra-${ramo}.png`] = process.argv.slice(2);
(async () => {
  const q = new URLSearchParams({ ramo }); if (nome) q.set('nome', nome); if (dono) q.set('dono', dono); if (cor) q.set('cor', cor);
  const b = await webkit.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://localhost:8750/modelos/painel-mei/?' + q, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: saida });
  await b.close();
  console.log(saida);
})();
