/* O Chico (Aratu da MARATU) em pixel, de óculos de nerd. Usado na revisão e no portal.
   ChicoPixel.pinta(canvas 40x24, { corpo, garras: [e, d], brilho }) */
(() => {
  const PECAS = {
    garraE: 'M0,104.77c0,26.58,21.55,48.13,48.13,48.13V56.65C21.55,56.65,0,78.19,0,104.77Z',
    garraD: 'M270.11,56.65v96.26c26.58,0,48.13-21.55,48.13-48.13s-21.55-48.13-48.13-48.13Z',
    corpo: 'M159.12,152.9c53.16,0,96.26-43.1,96.26-96.26H62.86c0,53.16,43.1,96.26,96.26,96.26Z',
    olhoD: 'M224.82,24.08c0-13.3-10.78-24.08-24.08-24.08v48.16c13.3,0,24.08-10.78,24.08-24.08Z',
    olhoE: 'M117.49,48.16V0c-13.3,0-24.08,10.78-24.08,24.08s10.78,24.08,24.08,24.08Z',
  };
  // grade 40x24: o corpo desce 3 px pra caber a armação em cima
  const CW = 40, CH = 24, DESCE = 3;
  function pintaChico(cv, quadro) {
    const ctx = cv.getContext('2d'), K = CW / 318.24;
    // canvas maior que 40x24 ganha margem (pro contorno caber)
    const OX = Math.floor((cv.width - CW) / 2), OY = Math.floor((cv.height - CH) / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.translate(OX, OY);
    ctx.save(); ctx.translate(0, DESCE); ctx.scale(K, K); ctx.fillStyle = '#E06A2C';
    const p = (nome, dy = 0) => { ctx.save(); ctx.translate(0, dy); ctx.fill(new Path2D(PECAS[nome])); ctx.restore(); };
    const g = quadro.garras || [0, 0];
    p('corpo', quadro.corpo || 0); p('garraE', g[0]); p('garraD', g[1]);
    const pisca = quadro.brilho != null && quadro.brilho < 3;
    if (!pisca) { p('olhoE', quadro.corpo || 0); p('olhoD', quadro.corpo || 0); }
    ctx.restore();
    const img = ctx.getImageData(OX, OY, CW, CH), px = img.data;
    for (let i = 3; i < px.length; i += 4) px[i] = px[i] > 110 ? 255 : 0;
    ctx.putImageData(img, OX, OY);
    // óculos de nerd: armação preta grossa (mais grossa em cima), lente branca, olho laranja que pisca
    const dy = Math.round((quadro.corpo || 0) * K);
    const y0 = dy + DESCE;                                // topo do olho
    const P = '#0D0D0B';
    const lente = (x, olhoX) => {
      ctx.fillStyle = P; ctx.fillRect(x, y0 - 1, 10, 8);   // armação
      ctx.clearRect(x, y0 - 1, 1, 1); ctx.clearRect(x + 9, y0 - 1, 1, 1);
      ctx.clearRect(x, y0 + 6, 1, 1); ctx.clearRect(x + 9, y0 + 6, 1, 1);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 1, y0 + 1, 8, 5);   // lente
      ctx.fillStyle = '#E06A2C';
      if (pisca) ctx.fillRect(x + olhoX - 1, y0 + 3, 4, 1);
      else ctx.fillRect(x + olhoX, y0 + 2, 2, 3);
    };
    lente(8, 5); lente(22, 3);                            // olhos puxados pro meio
    ctx.fillStyle = P;
    ctx.fillRect(18, y0, 4, 2);                           // ponte
    // contorno de 1 pixel (pra fundo escuro): toda casa vazia vizinha de uma cheia
    if (quadro.contorno) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const W = cv.width, H = cv.height, im = ctx.getImageData(0, 0, W, H), d = im.data;
      const cheio = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
      const marca = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (!cheio(x, y) && (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1))) marca.push(x, y);
      ctx.fillStyle = quadro.contorno;
      for (let i = 0; i < marca.length; i += 2) ctx.fillRect(marca[i], marca[i + 1], 1, 1);
    }
  }

  window.ChicoPixel = { pinta: pintaChico, W: CW, H: CH };
})();
