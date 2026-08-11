/* admin-imagens.js — comprime e marca a imagem na hora do upload.

   O R2 guarda o original em resolucao de impressao (ate 2,5 MB por PNG). O
   card da loja mostra 300 px. Antes disso aqui um cliente abriu a loja pelo
   navegador do Instagram e os posteres nao chegaram a carregar.

   Toda imagem que sobe pelo admin passa a gerar, no proprio navegador, dois
   irmaos leves — o original continua intacto no R2:

     thumbs/<chave>.webp   1000 px, limpa        -> card da loja  (?t=1)
     wm/<chave>.webp       1400 px, com marca    -> tela cheia    (?w=1)

   A marca d'agua so existe na variante wm, entao ela aparece quando o
   visitante amplia a imagem e nunca na navegacao normal.

   O modulo nao toca no admin.js: ele embrulha window.fetch e reage ao POST
   de upload que o formulario ja faz. O embrulho de autenticacao do admin.js
   roda por dentro deste, entao as chamadas daqui saem autenticadas.

   A MESMA marca existe em tools/marca-dagua.py, que faz o lote das imagens
   antigas. As duas ESPEC precisam bater. */
(function () {
  var API = 'https://maratu-api.raphaelnascimento.workers.dev';

  // Fracoes da largura da imagem, pra marca sair igual em qualquer tamanho.
  // Espelho de ESPEC em tools/marca-dagua.py — mexeu aqui, mexa la.
  var ESPEC = {
    largura: 1400,
    qualidade: 0.82,
    texto: 'maratu',
    corpo: 0.075,
    giro: -30,
    passoX: 2.30,
    passoY: 4.20,
    alfaClaro: 0.11,
    alfaEscuro: 0.09,
    desloca: 0.055,
    cantoTexto: 'maratu.com.br',
    cantoCorpo: 0.021,
    cantoAlfa: 0.42,
    cantoMargem: 0.030
  };
  var MINIATURA = { largura: 1000, qualidade: 0.78 };
  // Teto por variante, em KB. Nem todo WebKit codifica webp no canvas; quando
  // cai em JPEG o arquivo incha, e ai a qualidade desce ate caber. E o teto
  // que garante imagem leve, nao o formato.
  var TETO = { miniatura: 200, marcada: 360 };
  var ESCADA = [0.78, 0.68, 0.58, 0.48, 0.40];

  /* ---------- desenho ---------- */

  function ladrilho(ctx, w, h, e) {
    var corpo = Math.max(12, Math.round(w * e.corpo));
    ctx.save();
    ctx.font = corpo + 'px Jack';
    ctx.textBaseline = 'top';
    var passoX = Math.max(1, Math.round(ctx.measureText(e.texto).width * e.passoX));
    var passoY = Math.max(1, Math.round(corpo * e.passoY));
    var desl = Math.max(1, Math.round(corpo * e.desloca));
    var lado = Math.round((w + h) * 1.15);
    // gira o plano inteiro e desenha a grade reta dentro dele, como o
    // rotate() da camada no Pillow. O sinal e invertido porque o rotate do
    // Pillow conta no sentido anti-horario e o do canvas no horario.
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-e.giro * Math.PI / 180);
    ctx.translate(-lado / 2, -lado / 2);
    var linha = 0;
    for (var y = -passoY; y < lado + passoY; y += passoY) {
      // meio passo de defasagem por linha, pra nao virar grade quadriculada
      var baseX = -passoX + (linha % 2 ? Math.floor(passoX / 2) : 0);
      for (var x = baseX; x < lado + passoX; x += passoX) {
        ctx.fillStyle = 'rgba(13,13,11,' + e.alfaEscuro + ')';
        ctx.fillText(e.texto, x + desl, y + desl);
        ctx.fillStyle = 'rgba(255,255,255,' + e.alfaClaro + ')';
        ctx.fillText(e.texto, x, y);
      }
      linha++;
    }
    ctx.restore();
  }

  function canto(ctx, w, h, e) {
    var corpo = Math.max(9, Math.round(w * e.cantoCorpo));
    ctx.save();
    ctx.font = '700 ' + corpo + 'px Clother';
    ctx.textBaseline = 'top';
    var margem = Math.round(w * e.cantoMargem);
    var x = w - ctx.measureText(e.cantoTexto).width - margem;
    var y = h - corpo - margem;
    var desl = Math.max(1, Math.round(corpo * 0.09));
    ctx.fillStyle = 'rgba(13,13,11,' + (e.cantoAlfa * 0.7) + ')';
    ctx.fillText(e.cantoTexto, x + desl, y + desl);
    ctx.fillStyle = 'rgba(255,255,255,' + e.cantoAlfa + ')';
    ctx.fillText(e.cantoTexto, x, y);
    ctx.restore();
  }

  /* ---------- codificacao ---------- */

  var _webp = null;
  function aceitaWebp() {
    if (_webp === null) {
      try {
        var c = document.createElement('canvas');
        c.width = c.height = 1;
        _webp = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      } catch (e) { _webp = false; }
    }
    return _webp;
  }

  function codifica(canvas, tipo, qualidade) {
    return new Promise(function (ok, falha) {
      canvas.toBlob(function (b) { b ? ok(b) : falha(new Error('toBlob vazio')); }, tipo, qualidade);
    });
  }

  async function paraBlob(canvas, qualidade, tetoKB) {
    // Sem webp o navegador cai em JPEG e o arquivo incha, ainda mais com o
    // ladrilho da marca, que e detalhe fino demais pro JPEG. Entao a qualidade
    // desce ate caber no teto. A chave no R2 continua terminando em .webp — e
    // so um nome; quem manda e o Content-Type, e ele vai certo.
    var tipo = aceitaWebp() ? 'image/webp' : 'image/jpeg';
    var blob = await codifica(canvas, tipo, qualidade);
    for (var i = 0; i < ESCADA.length && blob.size > tetoKB * 1024; i++) {
      if (ESCADA[i] >= qualidade) continue;
      blob = await codifica(canvas, tipo, ESCADA[i]);
    }
    return { blob: blob, tipo: tipo };
  }

  function desenha(bitmap, largura) {
    var escala = Math.min(1, largura / bitmap.width);
    var w = Math.max(1, Math.round(bitmap.width * escala));
    var h = Math.max(1, Math.round(bitmap.height * escala));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return { canvas: c, ctx: ctx, w: w, h: h };
  }

  async function fontesProntas() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([document.fonts.load('100px Jack'), document.fonts.load('700 20px Clother')]);
    } catch (e) { /* sem as fontes a marca sai na fonte padrao; melhor que travar */ }
  }

  async function derivados(blob) {
    var bitmap = await createImageBitmap(blob);
    try {
      var m = desenha(bitmap, MINIATURA.largura);
      var miniatura = await paraBlob(m.canvas, MINIATURA.qualidade, TETO.miniatura);

      await fontesProntas();
      var g = desenha(bitmap, ESPEC.largura);
      ladrilho(g.ctx, g.w, g.h, ESPEC);
      canto(g.ctx, g.w, g.h, ESPEC);
      var marcada = await paraBlob(g.canvas, ESPEC.qualidade, TETO.marcada);

      return { miniatura: miniatura, marcada: marcada };
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }

  /* ---------- aviso na tela ---------- */

  var aviso;
  function mostra(texto) {
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.setAttribute('role', 'status');
      aviso.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;' +
        'display:flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;' +
        'background:#F0EBE3;color:#0D0D0B;border:1.5px solid #0D0D0B;box-shadow:3px 3px 0 0 #0D0D0B;' +
        "font-family:'Clother',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;" +
        'text-transform:uppercase;opacity:0;transition:opacity .2s;pointer-events:none;max-width:88vw;';
      aviso.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' +
        '<path d="M21 15l-5-5L5 21"/></svg><span></span>';
      document.body.appendChild(aviso);
    }
    aviso.lastChild.textContent = texto;
    aviso.style.opacity = '1';
    clearTimeout(aviso._t);
    aviso._t = setTimeout(function () { aviso.style.opacity = '0'; }, 2600);
  }

  /* ---------- embrulho do upload ---------- */

  var anterior = window.fetch;

  window.fetch = function (entrada, init) {
    var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
    var metodo = ((init && init.method) || (entrada && entrada.method) || 'GET').toUpperCase();
    var corpo = init && init.body;
    var alvo = url.indexOf(API + '/api/catalog/upload') === 0;
    var jaEhVariante = url.indexOf('variant=') >= 0;
    // O Diario de Mare (admin-mare.js) sobe foto pelo mesmo endpoint, com
    // slug=mare. Aquilo nao e produto: ninguem le thumbs/mare nem wm/mare, e
    // marcar a foto do Diario so atrasaria a publicacao.
    var fora = /[?&]slug=mare(&|$)/.test(url);
    var ehImagem = corpo && typeof corpo === 'object' && typeof corpo.type === 'string' &&
      corpo.type.indexOf('image/') === 0 && typeof corpo.arrayBuffer === 'function';

    if (!(alvo && metodo === 'POST' && ehImagem && !jaEhVariante && !fora)) {
      return anterior.apply(this, arguments);
    }

    var resposta = anterior.apply(this, arguments);
    return resposta.then(async function (r) {
      if (!r.ok) return r;
      try {
        var u = new URL(url);
        var slug = u.searchParams.get('slug') || 'misc';
        var nome = (u.searchParams.get('filename') || 'img').replace(/\.[^./]+$/, '') + '.webp';
        mostra('Comprimindo e marcando…');
        var d = await derivados(corpo);
        await Promise.all([
          sobe(d.miniatura, slug, nome, 'thumb'),
          sobe(d.marcada, slug, nome, 'wm')
        ]);
        // fica registrado pra depuracao (e pro teste): o que de fato subiu
        window.__maratuImagens.ultimo = {
          nome: nome,
          original: corpo.size,
          miniatura: d.miniatura.blob.size,
          marcada: d.marcada.blob.size,
          tipo: d.marcada.tipo
        };
        var kb = Math.round((d.miniatura.blob.size + d.marcada.blob.size) / 1024);
        mostra('Imagem pronta · ' + kb + ' KB');
      } catch (e) {
        // O original ja subiu; sem as variantes o Worker cai nele sozinho.
        console.warn('[admin-imagens] variantes falharam:', e);
        mostra('Original salvo · variantes falharam');
      }
      return r;
    });
  };

  function sobe(item, slug, nome, variante) {
    var u = API + '/api/catalog/upload?slug=' + encodeURIComponent(slug) +
      '&filename=' + encodeURIComponent(nome) + '&variant=' + variante;
    return anterior(u, { method: 'POST', headers: { 'Content-Type': item.tipo }, body: item.blob })
      .then(function (r) { if (!r.ok) throw new Error(variante + ' ' + r.status); return r; });
  }

  /* ---------- o admin tambem pede miniatura ---------- */

  // A listagem de produtos e a previa do formulario montam <img> apontando pro
  // original em /img/<chave>, o mesmo PNG de impressao de ate 2,5 MB. Na tela
  // eles ocupam menos de 100 px. Aqui a gente so acrescenta ?t=1 no src depois
  // que o admin.js desenha — sem tocar no admin.js, que e minificado.
  function aliviaImagens(raiz) {
    var imgs = raiz.querySelectorAll ? raiz.querySelectorAll('img[src*="/img/"]') : [];
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute('src') || '';
      if (src.indexOf(API + '/img/') !== 0) continue;
      if (/[?&](t|w)=/.test(src)) continue;
      imgs[i].setAttribute('src', src + (src.indexOf('?') >= 0 ? '&' : '?') + 't=1');
    }
  }

  function observa() {
    aliviaImagens(document);
    new MutationObserver(function (regs) {
      for (var i = 0; i < regs.length; i++) {
        var novos = regs[i].addedNodes;
        for (var j = 0; j < novos.length; j++) {
          if (novos[j].nodeType === 1) aliviaImagens(novos[j]);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observa);
  else observa();

  window.__maratuImagens = { ESPEC: ESPEC, MINIATURA: MINIATURA, derivados: derivados, aliviaImagens: aliviaImagens };
})();
