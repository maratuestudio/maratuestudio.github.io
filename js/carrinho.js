/* ══ CARRINHO DA MARATU ══
   Não é loja com checkout: é uma lista que o visitante monta no navegador e que vira
   uma mensagem só no WhatsApp. Nada sai daqui sem ele mandar.

   Onde mora: localStorage, na chave maratu_carrinho_v1. Sem login, sem servidor.
   Por que revalida: preço muda no admin e peça sai do ar. Um carrinho de três dias
   atrás não pode gerar pedido com preço velho, então ao abrir a gaveta a lista é
   conferida contra /api/catalog antes de virar mensagem.

   O módulo traz o próprio CSS porque roda em duas páginas com folhas diferentes
   (a home e /produto/<id>); as variáveis de cor existem nas duas.

   Uso: MaratuCarrinho.add({ id, nome, variacao, qtd, preco, img })  — preco em centavos. */
(function () {
  'use strict';

  var CHAVE = 'maratu_carrinho_v1';
  var API = 'https://maratu-api.raphaelnascimento.workers.dev/api/catalog';
  var IMG = 'https://maratu-api.raphaelnascimento.workers.dev/img/';
  var WA_NUM = '5579991957415';
  var TAMS = ['A4', 'A3', 'A2', 'A1'];
  // Acima disso o WhatsApp começa a cortar a mensagem em alguns celulares, então o
  // resumo vira a versão curta: quantidade e nome, sem valor por linha.
  var LIMITE_MSG = 1200;

  var itens = [];
  var aberto = false;

  // ── estado ──
  function le() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      return Array.isArray(v) ? v.filter(valido) : [];
    } catch (e) { return []; }
  }
  function valido(i) {
    return i && typeof i.id === 'string' && i.id && typeof i.nome === 'string' &&
      isFinite(i.qtd) && i.qtd > 0 && isFinite(i.preco) && i.preco >= 0;
  }
  function grava() {
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) {}
    pintaBotao();
    // com a gaveta aberta, quem adiciona por trás dela precisa ver a lista mudar;
    // antes disso, quem repintava era o abre(), que deixou de rodar a cada adição
    if (aberto) pinta();
    document.dispatchEvent(new CustomEvent('maratu:carrinho', { detail: { n: conta() } }));
  }
  function conta() {
    return itens.reduce(function (s, i) { return s + i.qtd; }, 0);
  }
  function total() {
    return itens.reduce(function (s, i) { return s + i.preco * i.qtd; }, 0);
  }
  // duas linhas do mesmo produto só se juntam quando a variação também bate
  function mesmaLinha(a, b) {
    return a.id === b.id && (a.variacao || '') === (b.variacao || '');
  }

  function reais(centavos) {
    return String(Math.round(centavos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── API pública ──
  var API_PUB = {
    add: function (item) {
      if (!valido(item)) return false;
      var novo = {
        id: item.id, nome: item.nome, variacao: item.variacao || '',
        qtd: Math.max(1, Math.min(99, Math.round(item.qtd))),
        preco: Math.round(item.preco), img: item.img || ''
      };
      var achou = null;
      for (var i = 0; i < itens.length; i++) if (mesmaLinha(itens[i], novo)) { achou = itens[i]; break; }
      if (achou) achou.qtd = Math.min(99, achou.qtd + novo.qtd);
      else itens.push(novo);
      grava();
      if (typeof gtag === 'function') {
        gtag('event', 'add_to_cart', {
          items: [{ item_id: novo.id, item_name: novo.nome, quantity: novo.qtd, price: Math.round(novo.preco / 100) }]
        });
      }
      // não abre a gaveta: quem avisa é a barra do pé, e assim ninguém é interrompido
      // no meio da loja. A gaveta abre quando o visitante pedir.
      return true;
    },
    abrir: abre,
    fechar: fecha,
    itens: function () { return itens.slice(); },
    quantos: conta
  };

  // ── botão flutuante ──
  var botao;
  function montaBotao() {
    if (botao) return;
    /* Barra presa no pé da tela, e não uma bolha no canto: é assim que loja de celular
       mostra o carrinho, e o total fica sempre à vista sem cobrir a página. */
    botao = document.createElement('div');
    botao.className = 'mc-barra';
    botao.innerHTML =
      '<button type="button" class="mc-barra__ver" aria-label="ver carrinho">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l-1.2 12.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z"/>' +
        '<path d="M9 7V5.5A3 3 0 0 1 12 2.5h0A3 3 0 0 1 15 5.5V7"/></svg>' +
        '<span class="mc-barra__txt">carrinho<b class="mc-barra__n">0 itens</b></span>' +
      '</button>' +
      '<button type="button" class="mc-barra__btn">Finalizar compra</button>';
    botao.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', abre); });
    document.body.appendChild(botao);
    pintaBotao();
  }
  function pintaBotao() {
    if (!botao) return;
    var n = conta();
    botao.querySelector('.mc-barra__n').textContent =
      n + (n === 1 ? ' item' : ' itens') + ' · R$' + reais(total());
    botao.classList.toggle('on', n > 0);
    // a barra cobre o pé da página; o corpo cede a altura dela enquanto estiver à vista
    document.body.style.paddingBottom = n > 0 ? '72px' : '';
  }

  // ── gaveta ──
  var caixa, corpo, rodape, statusEl;
  function montaGaveta() {
    if (caixa) return;
    caixa = document.createElement('div');
    caixa.className = 'mc-fundo';
    caixa.hidden = true;
    caixa.innerHTML =
      '<aside class="mc-gaveta" role="dialog" aria-modal="true" aria-label="meu carrinho">' +
        '<div class="mc-topo">' +
          '<p class="mc-tit">Meu carrinho</p>' +
          '<button type="button" class="mc-fechar">fechar</button>' +
        '</div>' +
        '<p class="mc-status" hidden></p>' +
        '<div class="mc-lista"></div>' +
        '<div class="mc-pe"></div>' +
      '</aside>';
    document.body.appendChild(caixa);
    corpo = caixa.querySelector('.mc-lista');
    rodape = caixa.querySelector('.mc-pe');
    statusEl = caixa.querySelector('.mc-status');
    caixa.querySelector('.mc-fechar').addEventListener('click', fecha);
    caixa.addEventListener('click', function (e) { if (e.target === caixa) fecha(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && aberto) fecha(); });

    // um ouvinte só para toda a lista: os botões nascem e morrem a cada pintura
    corpo.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mc]');
      if (!b) return;
      var idx = Number(b.getAttribute('data-i'));
      var item = itens[idx];
      if (!item) return;
      var acao = b.getAttribute('data-mc');
      if (acao === 'mais') item.qtd = Math.min(99, item.qtd + 1);
      else if (acao === 'menos') item.qtd -= 1;
      else if (acao === 'tira') item.qtd = 0;
      if (item.qtd <= 0) itens.splice(idx, 1);
      grava();
      pinta();
    });
  }

  function abre() {
    montaGaveta();
    caixa.hidden = false;
    aberto = true;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { caixa.classList.add('on'); });
    pinta();
    revalida();
    if (typeof gtag === 'function') gtag('event', 'view_cart', { value: Math.round(total() / 100) });
  }
  function fecha() {
    if (!caixa) return;
    caixa.classList.remove('on');
    aberto = false;
    document.body.style.overflow = '';
    setTimeout(function () { if (!aberto) caixa.hidden = true; }, 200);
  }

  function pinta() {
    if (!corpo) return;
    if (!itens.length) {
      corpo.innerHTML = '<p class="mc-vazio">Seu carrinho está vazio. Escolha um produto na loja.</p>';
      rodape.innerHTML = '<a class="mc-btn mc-btn--fraco" href="/#loja">continuar comprando</a>';
      return;
    }
    corpo.innerHTML = itens.map(function (i, idx) {
      return '<div class="mc-linha">' +
        (i.img ? '<img class="mc-linha__img" src="' + esc(i.img) + '" alt="" loading="lazy">' : '<div class="mc-linha__img"></div>') +
        '<div class="mc-linha__txt">' +
          '<p class="mc-linha__nome">' + esc(i.nome) + '</p>' +
          (i.variacao ? '<p class="mc-linha__var">' + esc(i.variacao) + '</p>' : '') +
          '<p class="mc-linha__preco">R$' + reais(i.preco * i.qtd) + '</p>' +
        '</div>' +
        '<div class="mc-linha__acoes">' +
          '<div class="mc-qtd">' +
            '<button type="button" data-mc="menos" data-i="' + idx + '" aria-label="menos um">-</button>' +
            '<span>' + i.qtd + '</span>' +
            '<button type="button" data-mc="mais" data-i="' + idx + '" aria-label="mais um">+</button>' +
          '</div>' +
          '<button type="button" class="mc-tira" data-mc="tira" data-i="' + idx + '">remover</button>' +
        '</div>' +
      '</div>';
    }).join('');
    rodape.innerHTML =
      '<div class="mc-total"><span>Total</span><strong>R$' + reais(total()) + '</strong></div>' +
      (total() >= 15000 ? '<p class="mc-parcela">ou 3x de R$' + reais(Math.round(total() / 3)) + ' sem juros</p>' : '') +
      '<a class="mc-btn" id="mc-fechar-pedido" target="_blank" rel="noopener" data-produto="carrinho" data-origem="carrinho">Finalizar compra pelo WhatsApp</a>' +
      '<p class="mc-nota">Você finaliza a compra pelo WhatsApp. Nada é cobrado neste site.</p>';
    var cta = rodape.querySelector('#mc-fechar-pedido');
    cta.setAttribute('href', linkWhats());
    cta.addEventListener('click', function () {
      if (typeof gtag === 'function') {
        gtag('event', 'begin_checkout', {
          value: Math.round(total() / 100), currency: 'BRL',
          items: itens.map(function (i) {
            return { item_id: i.id, item_name: i.nome, quantity: i.qtd, price: Math.round(i.preco / 100) };
          })
        });
      }
    });
  }

  function linhaTexto(i, curto) {
    var nome = i.nome + (i.variacao ? ' (' + i.variacao + ')' : '');
    return curto ? '- ' + i.qtd + 'x ' + nome
                 : '- ' + i.qtd + 'x ' + nome + ' — R$' + reais(i.preco * i.qtd);
  }
  function montaMsg(curto) {
    return 'Olá! Quero finalizar esta compra:\n\n' +
      itens.map(function (i) { return linhaTexto(i, curto); }).join('\n') +
      '\n\nTotal: R$' + reais(total()) +
      '\nMontei no site: maratu.com.br';
  }
  function linkWhats() {
    var msg = montaMsg(false);
    if (encodeURIComponent(msg).length > LIMITE_MSG) msg = montaMsg(true);
    return 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(msg);
  }

  /* ── revalidação ──
     Confere a lista contra o catálogo antes de virar mensagem: peça que saiu do ar
     é removida, preço que mudou é corrigido. O visitante fica sabendo dos dois. */
  function precoDoTamanho(p, tam, base) {
    var custom = p.precos_custom || {};
    var v = Number(custom[tam] || (base && base[tam]) || 0);
    return v > 0 ? v : null;
  }
  function revalida() {
    if (!itens.length) return;
    fetch(API, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (dados) {
        var porId = {};
        (dados.produtos || []).forEach(function (p) { if (p.ativo) porId[p.id] = p; });
        var base = dados.precos_base || null;
        var sumiram = [], mudaram = [], esgotaram = [];
        itens = itens.filter(function (i) {
          var p = porId[i.id];
          if (!p) { sumiram.push(i.nome); return false; }
          // peça marcada como indisponível não pode seguir num pedido que vai virar recado
          if (p.indisponivel) { esgotaram.push(p.nome); return false; }
          var novo = i.preco;
          if (i.variacao && TAMS.indexOf(i.variacao) >= 0) {
            var pt = precoDoTamanho(p, i.variacao, base);
            if (pt) novo = pt;
          } else if (p.subcategoria !== 'posteres') {
            novo = p.preco;
          }
          if (novo !== i.preco) { mudaram.push(i.nome); i.preco = novo; }
          i.nome = p.nome;
          return true;
        });
        grava();
        var avisos = [];
        if (sumiram.length) avisos.push(sumiram.join(', ') + (sumiram.length > 1 ? ' ficaram' : ' ficou') + ' indisponível');
        if (esgotaram.length) avisos.push(esgotaram.join(', ') + (esgotaram.length > 1 ? ' ficaram' : ' ficou') + ' esgotado');
        if (mudaram.length) avisos.push('preço atualizado: ' + mudaram.join(', '));
        if (avisos.length) {
          statusEl.textContent = avisos.join(' · ');
          statusEl.hidden = false;
        } else {
          statusEl.hidden = true;
        }
        pinta();
      })
      .catch(function (e) {
        // offline ou API fora: o pedido continua valendo, só não dá pra conferir agora
        console.warn('[carrinho] não deu pra conferir o catálogo:', e);
      });
  }

  // ── estilo ──
  var CSS =
    '.mc-barra{position:fixed;left:0;right:0;bottom:0;z-index:95;display:none;align-items:center;' +
      'gap:10px;padding:10px clamp(12px,3vw,20px);padding-bottom:max(env(safe-area-inset-bottom,0px),10px);' +
      'background:var(--preto,#0D0D0B);color:var(--areia,#F0ECE4);' +
      'border-top:1.5px solid var(--preto,#0D0D0B);' +
      'font-family:Clother,sans-serif;-webkit-tap-highlight-color:transparent}' +
    '.mc-barra.on{display:flex}' +
    '.mc-barra__ver{display:flex;align-items:center;gap:9px;background:none;border:0;padding:0;' +
      'color:inherit;cursor:pointer;text-align:left;font-family:inherit}' +
    '.mc-barra__ver svg{width:20px;height:20px;flex:0 0 auto;fill:none;stroke:currentColor;' +
      'stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
    '.mc-barra__txt{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;' +
      'line-height:1.25}' +
    '.mc-barra__n{display:block;font-weight:900;font-size:14px;letter-spacing:0;opacity:1;' +
      'font-variant-numeric:tabular-nums}' +
    '.mc-barra__btn{margin-left:auto;background:var(--dourado,#D4960A);color:var(--preto,#0D0D0B);' +
      'border:1.5px solid var(--areia,#F0ECE4);border-radius:999px;padding:11px 16px;cursor:pointer;' +
      'font-family:inherit;font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;' +
      'white-space:nowrap;transition:transform .12s ease}' +
    '.mc-barra__btn:active{transform:translateY(2px)}' +

    '.mc-fundo{position:fixed;inset:0;z-index:130;background:rgba(13,13,11,.55);' +
      '-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .2s ease}' +
    '.mc-fundo.on{opacity:1}' +
    '.mc-fundo[hidden]{display:none}' +
    '.mc-gaveta{position:absolute;top:0;right:0;height:100%;width:min(420px,92vw);' +
      'background:var(--areia,#F0ECE4);color:var(--preto,#0D0D0B);border-left:1.5px solid var(--preto,#0D0D0B);' +
      'display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease-out;' +
      'padding:max(env(safe-area-inset-top,0px),20px) 20px max(env(safe-area-inset-bottom,0px),20px)}' +
    '.mc-fundo.on .mc-gaveta{transform:translateX(0)}' +
    '.mc-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}' +
    '.mc-tit{font-family:Clother,sans-serif;font-weight:900;font-size:1.2rem;text-transform:uppercase;margin:0}' +
    '.mc-fechar{background:none;border:1.5px solid var(--preto,#0D0D0B);border-radius:999px;' +
      'padding:6px 12px;font-family:Clother,sans-serif;font-weight:700;font-size:.62rem;' +
      'letter-spacing:.1em;text-transform:uppercase;cursor:pointer;box-shadow:2px 2px 0 0 var(--preto,#0D0D0B);' +
      'color:inherit;transition:all .12s ease}' +
    '.mc-fechar:hover{background:var(--dourado,#D4960A);transform:translate(1px,1px);' +
      'box-shadow:1px 1px 0 0 var(--preto,#0D0D0B)}' +
    '.mc-status{font-family:Clother,sans-serif;font-size:.62rem;letter-spacing:.06em;' +
      'background:var(--laranja,#C8501A);color:var(--areia,#F0ECE4);border-radius:8px;' +
      'padding:8px 10px;margin:0 0 12px}' +
    '.mc-lista{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}' +
    '.mc-vazio{font-family:Clother,sans-serif;font-size:.8rem;opacity:.55;margin:24px 0}' +
    '.mc-linha{display:grid;grid-template-columns:58px 1fr auto;gap:11px;align-items:center;' +
      'padding:11px 0;border-bottom:1px solid rgba(13,13,11,.14)}' +
    '.mc-linha__img{width:58px;height:58px;border-radius:6px;object-fit:cover;' +
      'background:#e4dfd6;border:1.5px solid var(--preto,#0D0D0B)}' +
    '.mc-linha__nome{font-family:Clother,sans-serif;font-weight:700;font-size:.76rem;' +
      'text-transform:uppercase;line-height:1.2;margin:0}' +
    '.mc-linha__var{font-family:Clother,sans-serif;font-size:.6rem;letter-spacing:.1em;' +
      'text-transform:uppercase;opacity:.5;margin:3px 0 0}' +
    '.mc-linha__preco{font-family:Clother,sans-serif;font-weight:900;font-size:.85rem;margin:5px 0 0}' +
    '.mc-linha__acoes{display:flex;flex-direction:column;align-items:flex-end;gap:6px}' +
    '.mc-qtd{display:flex;align-items:center;border:1.5px solid var(--preto,#0D0D0B);border-radius:999px;' +
      'overflow:hidden;background:var(--areia,#F0ECE4)}' +
    '.mc-qtd button{width:28px;height:28px;border:0;background:none;cursor:pointer;' +
      'font-family:Clother,sans-serif;font-weight:900;font-size:13px;color:inherit;' +
      '-webkit-tap-highlight-color:transparent}' +
    '.mc-qtd span{min-width:24px;text-align:center;font-family:Clother,sans-serif;font-weight:900;' +
      'font-size:12px;font-variant-numeric:tabular-nums}' +
    '.mc-tira{background:none;border:0;padding:0;cursor:pointer;font-family:Clother,sans-serif;' +
      'font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;opacity:.45;color:inherit;' +
      'text-decoration:underline}' +
    '.mc-tira:hover{opacity:.85;color:var(--laranja,#C8501A)}' +
    '.mc-pe{padding-top:14px;border-top:1.5px solid var(--preto,#0D0D0B);margin-top:6px}' +
    '.mc-total{display:flex;align-items:baseline;justify-content:space-between;' +
      'font-family:Clother,sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:.66rem}' +
    '.mc-total strong{font-size:1.5rem;font-weight:900;letter-spacing:-.02em}' +
    '.mc-parcela{font-family:Clother,sans-serif;font-size:.6rem;letter-spacing:.08em;' +
      'text-transform:uppercase;opacity:.55;margin:2px 0 0}' +
    '.mc-btn{display:block;text-align:center;margin-top:12px;padding:13px 18px;border-radius:999px;' +
      'background:var(--dourado,#D4960A);color:var(--preto,#0D0D0B);border:1.5px solid var(--preto,#0D0D0B);' +
      'box-shadow:3px 3px 0 0 var(--preto,#0D0D0B);font-family:Clother,sans-serif;font-weight:700;' +
      'font-size:12px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:all .15s ease}' +
    '.mc-btn:hover{box-shadow:1px 1px 0 0 var(--preto,#0D0D0B);transform:translate(2px,2px)}' +
    '.mc-btn:active{box-shadow:0 0 0 0 var(--preto,#0D0D0B);transform:translate(3px,3px)}' +
    '.mc-btn--fraco{background:transparent}' +
    '.mc-nota{font-family:Clother,sans-serif;font-size:.58rem;letter-spacing:.06em;opacity:.5;' +
      'margin:10px 0 0;text-align:center}' +
    '@media (prefers-reduced-motion:reduce){.mc-gaveta,.mc-fundo,.mc-bolha{transition:none}}';

  function montaCss() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── partida ──
  function inicia() {
    itens = le();
    montaCss();
    montaBotao();
    // outra aba mexeu no pedido: a lista aqui acompanha
    window.addEventListener('storage', function (e) {
      if (e.key !== CHAVE) return;
      itens = le();
      pintaBotao();
      if (aberto) pinta();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicia);
  else inicia();

  window.MaratuCarrinho = API_PUB;
})();
