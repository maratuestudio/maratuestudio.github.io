// Gera a amostra do painel (MEI) com nome, logo e cor: computador e celular lado a lado.
// uso: node tools/amostras/painel.js '{"ramo":"saude","nome":"Fisio Atalaia","logo":"logos/x.jpg","cor":"#2B4C7E"}' saida.png
// ramos: saude, beleza, encomenda, tecnico. Precisa do servidor da prévia rodando na 8750.
const { webkit, devices } = require("/Users/raphael/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const { execFileSync } = require('child_process');
const dados = JSON.parse(process.argv[2] || '{}'), saida = process.argv[3] || 'amostra-painel.png';
(async () => {
  const url = 'http://localhost:8750/modelos/painel-mei/?' + new URLSearchParams(dados);
  const b = await webkit.launch();
  const tira = async (ctx, arq) => { const p = await (await b.newContext(ctx)).newPage(); await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2000); await p.screenshot({ path: arq }); };
  await tira({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, saida + '.desk.png');
  await tira({ ...devices['iPhone 14 Pro'], deviceScaleFactor: 2 }, saida + '.cel.png');
  await b.close();
  execFileSync('/usr/bin/python3', ['-c', `
from PIL import Image
d=Image.open('${saida}.desk.png').convert('RGB'); c=Image.open('${saida}.cel.png').convert('RGB')
W,H=2200,1300; fundo=Image.new('RGB',(W,H),(236,232,224))
d=d.resize((1360,850)); fundo.paste(d,(70,(H-850)//2))
ch=1000; c=c.resize((int(c.width*ch/c.height),ch))
m=Image.new('RGB',(c.width+28,c.height+28),(20,20,18)); m.paste(c,(14,14))
fundo.paste(m,(W-m.width-70,(H-m.height)//2))
fundo.save('${saida}', quality=90)
`]);
  require('fs').unlinkSync(saida + '.desk.png'); require('fs').unlinkSync(saida + '.cel.png');
  console.log(saida);
})();
