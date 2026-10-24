/* /servicos: o site da MARATU que se monta, os tipos de site rodando ao vivo, o Aratu em pixel no painel e os modelos */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const celular = () => matchMedia('(max-width: 900px)').matches;
  // ?motion força a animação mesmo com "reduzir movimento" ligado no sistema
  const forca = /[?&]motion\b/.test(location.search);
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches && !forca;

  /* ---------- sites ao vivo: iframe com ?demo, escalado pra caber na moldura ---------- */
  const TAM = { tela: [1440, 900], fone: [390, 844] };
  function ligar(caixa) {
    if (caixa.querySelector('iframe:not(.saindo)')) return;
    const [w, h] = 'celular' in caixa.dataset ? TAM.fone : TAM.tela;
    const f = document.createElement('iframe');
    f.src = caixa.dataset.site + (reduzir ? '' : '?demo');
    f.title = 'Demonstração ao vivo';
    f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true');
    Object.assign(f.style, { width: w + 'px', height: h + 'px' });
    const escala = () => { f.style.transform = `scale(${caixa.clientWidth / w})`; };
    escala();
    caixa._ro && caixa._ro.disconnect();
    caixa._ro = new ResizeObserver(escala); caixa._ro.observe(caixa);
    // a capa fica até o site estar de pé
    f.addEventListener('load', () => setTimeout(() => f.classList.add('pronto'), 600));
    caixa.appendChild(f);
  }
  function desligar(caixa) {
    $$('iframe', caixa).forEach((f) => f.remove());
    caixa._ro && caixa._ro.disconnect();
  }
  const vigia = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? ligar(e.target) : desligar(e.target))), { threshold: 0.35 });

  if (gsap && ST) gsap.registerPlugin(ST);
  const ok = gsap && ST && !reduzir;

  /* ---------- ABERTURA: o site se monta sozinho ao abrir a página e vira o site de verdade ---------- */
  const mini = $('#mini'), vivo = $('#mont-vivo'), url = $('#mont-url');
  const URL_FINAL = url.textContent;
  if (celular()) vivo.dataset.celular = '';
  // a home de verdade só existe enquanto a abertura está na tela
  let abertoVisivel = true, querVivo = false;
  new IntersectionObserver(([e]) => {
    abertoVisivel = e.isIntersecting;
    if (!abertoVisivel) desligar(vivo); else if (querVivo) ligar(vivo);
  }).observe($('.mont'));
  const pedeVivo = () => { querVivo = true; if (abertoVisivel) ligar(vivo); };

  if (!ok) {
    document.documentElement.classList.add('sem-mov');
    pedeVivo();
  } else {
    const grade = $$('#mini-grade span'), fios = $$('.w__fio', mini);
    const txt = $$('.m-txt, .mini__card-pe', mini), imgs = $$('.m-img', mini), cards = $$('.m-card', mini);
    const cursor = $('#mini-cursor'), alvo = $('.m-alvo', mini), faixa = $('#mini-faixa');

    // estado inicial: tela vazia, só a barra do navegador
    gsap.set(grade, { scaleY: 0 });
    gsap.set(fios, { opacity: 0 });
    gsap.set(txt, { opacity: 0, y: 14 });
    gsap.set(imgs, { clipPath: 'inset(0 0 100% 0)' });
    gsap.set(cards, { borderColor: 'transparent', boxShadow: '0 0 0 0 rgba(0,0,0,0)', backgroundColor: 'transparent' });
    gsap.set('.mini__faixa', { backgroundColor: 'transparent' });
    gsap.set(cursor, { opacity: 0 });
    url.textContent = '';

    // o texto entra uma vez, sem depender da rolagem
    gsap.from('.mont__h1 .linha > span', { yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
    gsap.from('.mont__p, .mont__acoes', { y: 18, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.45 });

    // posição do cursor em relação ao mini-site
    const ponto = (el, fx = 0.5, fy = 0.5) => {
      const r = el.getBoundingClientRect(), m = mini.getBoundingClientRect();
      return { x: r.left - m.left + r.width * fx, y: r.top - m.top + r.height * fy };
    };

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });  // toca sozinha, não depende da rolagem
    const digita = { n: 0 };
    tl.to(digita, { n: URL_FINAL.length, duration: 1, ease: 'none', onUpdate: () => { url.textContent = URL_FINAL.slice(0, Math.round(digita.n)); } }, 0)
      // 1. grade
      .to(grade, { scaleY: 1, duration: 1.2, stagger: 0.06, ease: 'power3.inOut' }, 0.4)
      // 2. caixas tracejadas onde cada coisa vai ficar
      .to(fios, { opacity: 1, duration: 0.6, stagger: 0.08 }, 1.4)
      // 3. texto
      .to(txt, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05 }, 2.4)
      // 4. foto e cor
      .to(imgs, { clipPath: 'inset(0 0 0% 0)', duration: 1, stagger: 0.1, ease: 'power3.inOut' }, 3.4)
      .to('.mini__faixa', { backgroundColor: '#C8501A', duration: 0.6 }, 3.6)
      .to(cards, { borderColor: '#0D0D0B', backgroundColor: '#FFFFFF', boxShadow: '0.35cqw 0.35cqw 0 0 #0D0D0B', duration: 0.6, stagger: 0.06 }, 3.8)
      .to(fios, { opacity: 0, duration: 0.5 }, 4.4)
      // 5. vida: a faixa corre e o cursor aperta um botão
      .fromTo(faixa, { xPercent: 0 }, { xPercent: -30, duration: 3, ease: 'none' }, 4.6)
      .to(cursor, { opacity: 1, duration: 0.2 }, 4.8)
      .fromTo(cursor, { x: () => mini.clientWidth * 0.85, y: () => mini.clientHeight * 0.18 },
        { x: () => ponto(alvo, 0.55, 0.6).x, y: () => ponto(alvo, 0.55, 0.6).y, duration: 1.1, ease: 'power3.inOut' }, 4.8)
      .to(alvo, { scale: 0.92, duration: 0.12, yoyo: true, repeat: 1 }, 5.95)
      .to(alvo.closest('.m-card'), { y: () => -mini.clientWidth * 0.008, duration: 0.3 }, 5.9)
      .to(grade, { opacity: 0, duration: 0.6 }, 6.2)
      // 6. vira o site de verdade, rodando
      .to(cursor, { opacity: 0, duration: 0.3 }, 7)
      .to(vivo, { opacity: 1, duration: 0.9, ease: 'power2.inOut' }, 7.1)
      .to({}, { duration: 0.6 });

    // roda sozinha assim que a página abre; a home carrega por trás no meio da montagem
    setTimeout(pedeVivo, 2500);   // depois da grade, pra não disputar com a abertura
    tl.timeScale(1.2).delay(0.7);
  }

  /* ---------- TIPOS: cada site liga quando aparece; título por máscara ---------- */
  $$('.tipo .vivo').forEach((c) => vigia.observe(c));
  if (ok) {
    $$('.tipo').forEach((t) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: t, start: 'top 72%', once: true }, defaults: { ease: 'expo.out' } });
      tl.from($('.tipo__palco', t), { y: 60, opacity: 0, duration: 1.4 }, 0)
        .from($$('.tipo__h2 .linha > span', t), { yPercent: 105, duration: 1.2 }, 0.1)
        .from($$('.tipo__quem, .tipo__p, .tipo__preco, .tipo__texto .lnk', t), { y: 16, opacity: 0, duration: 1, stagger: 0.08 }, 0.3);
    });
  }

  /* ---------- DO GOOGLE AO WHATSAPP: os quatro momentos acontecem em sequência quando a seção aparece ---------- */
  if (ok) {
    const campo = $('.mock__busca-campo'), BUSCA = campo.textContent;
    const res = $$('.mock__busca-url, .mock__busca-tit, .mock__busca-desc');
    const card = $('.mock--agenda'), cardIn = $$('.mock--agenda > span'), bt = $('.mock__agenda-btn');
    const balao = $('.mock__zap-balao');
    const nums = $$('.mock__rel-linha b:last-child');
    const finais = nums.map((n) => n.textContent);
    const linhas = $$('.mock__rel-tit, .mock__rel-linha');
    // o dedo que toca em Reservar
    const dedo = document.createElement('span');
    dedo.className = 'mock__dedo';
    card.appendChild(dedo);
    // número embaralhando como código até parar no valor certo
    const embaralha = (el, final, dur) => {
      const t0 = performance.now();
      (function f(t) {
        const p = (t - t0) / (dur * 1000);
        if (p >= 1) { el.textContent = final; return; }
        const fixos = Math.floor(final.length * Math.max(0, (p - 0.35) / 0.65));
        el.textContent = final.split('').map((c, i) => (i < fixos || !/[0-9]/.test(c) ? c : String(Math.floor(Math.random() * 10)))).join('');
        requestAnimationFrame(f);
      })(t0);
    };
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    const digita = { n: 0 };
    // os quatro acontecem juntos, pra nenhum bloco ficar vazio esperando a vez
    tl.set(campo, { textContent: '' })
      .set(res, { opacity: 0, y: 10 })
      .set(cardIn, { opacity: 0, y: 12 })
      .set(dedo, { opacity: 0, x: 60, y: 40, scale: 1 })
      .set(balao, { scale: 0, opacity: 0, transformOrigin: '100% 100%' })
      .set(linhas, { opacity: 0, y: 8 })
      .set(nums, { textContent: '' })
      // 19h02: digita a busca e o resultado sobe
      .to(digita, { n: BUSCA.length, duration: 1.2, ease: 'none', onUpdate: () => { campo.textContent = BUSCA.slice(0, Math.round(digita.n)); } }, 0.1)
      .to(res, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 1.3)
      // 19h03: o card do forró se arruma e o dedo toca em Reservar
      .to(cardIn, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.1)
      .to(dedo, { opacity: 1, duration: 0.2 }, 0.7)
      .to(dedo, { x: () => bt.offsetLeft + bt.offsetWidth * 0.55 - 17, y: () => bt.offsetTop + bt.offsetHeight * 0.5 - 17, duration: 0.8, ease: 'power3.inOut' }, 0.7)
      .to(dedo, { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 1.55)
      .to(bt, { scale: 0.92, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 1.55)
      .to(dedo, { opacity: 0, duration: 0.3 }, 2)
      // 19h05: o balão estoura no WhatsApp
      .to(balao, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.4)' }, 0.5)
      // dia 1º: o relatório chega e os números rodam até o valor final
      .to(linhas, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.1)
      .add(() => nums.forEach((n, i) => embaralha(n, finais[i], 1.4 + i * 0.25)), 0.3);
    ST.create({ trigger: '.exemplo__linha', start: 'top 70%', onEnter: () => tl.restart(), onEnterBack: () => tl.restart() });
  }


  /* ---------- o Aratu (as formas do logo) em pixel, andando em cima de cada janela ---------- */
  const PECAS = {
    garraE: 'M0,104.77c0,26.58,21.55,48.13,48.13,48.13V56.65C21.55,56.65,0,78.19,0,104.77Z',
    garraD: 'M270.11,56.65v96.26c26.58,0,48.13-21.55,48.13-48.13s-21.55-48.13-48.13-48.13Z',
    corpo: 'M159.12,152.9c53.16,0,96.26-43.1,96.26-96.26H62.86c0,53.16,43.1,96.26,96.26,96.26Z',
    olhoD: 'M224.82,24.08c0-13.3-10.78-24.08-24.08-24.08v48.16c13.3,0,24.08-10.78,24.08-24.08Z',
    olhoE: 'M117.49,48.16V0c-13.3,0-24.08,10.78-24.08,24.08s10.78,24.08,24.08,24.08Z',
  };
  // desenha com as garras subindo e descendo e os olhos que piscam; depois tira o antialias (vira pixel)
  function aratu(cv, passo, pisca) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, K = W / 318.24;
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.scale(K, K); ctx.fillStyle = '#E06A2C';
    const p = (nome, dy = 0) => { ctx.save(); ctx.translate(0, dy); ctx.fill(new Path2D(PECAS[nome])); ctx.restore(); };
    p('corpo', 6); p('garraE', passo ? -8 : 6); p('garraD', passo ? 6 : -8);
    if (!pisca) { p('olhoE', 6); p('olhoD', 6); }
    ctx.restore();
    const img = ctx.getImageData(0, 0, W, H), px = img.data;
    for (let i = 3; i < px.length; i += 4) px[i] = px[i] > 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
  }
  // um Aratu por janela: anda de um lado pro outro em cima dela
  $$('.passeio').forEach((bar, k) => {
    const cv = $('.passeio__aratu', bar);
    let x = 0, dir = k % 2 ? -1 : 1, tPasso = 0, passo = false, visivel = false;
    aratu(cv, false, false);
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(bar.parentElement);
    if (k % 2) x = Math.max(0, bar.clientWidth - cv.clientWidth);
    cv.style.transform = `translateX(${x}px)`;
    if (reduzir) return;
    let ant = performance.now();
    (function anda(t) {
      if (!visivel) { ant = t; requestAnimationFrame(anda); return; }
      const dt = Math.min(0.05, (t - ant) / 1000); ant = t;
      const max = bar.clientWidth - cv.clientWidth;
      x += dir * 42 * dt;
      if (x > max) { x = max; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
      tPasso += dt;
      if (tPasso > 0.22) { tPasso = 0; passo = !passo; aratu(cv, passo, Math.random() < 0.06); }
      cv.style.transform = `translateX(${x}px)`;
      requestAnimationFrame(anda);
    })(ant);
  });

  /* ---------- modelos: cada celular roda quando aparece ---------- */
  $$('.mod__fone.vivo').forEach((c) => vigia.observe(c));

  /* ---------- planos: o exemplo flutua junto do mouse ----------
     Só com mouse de verdade e sem "economizar dados". Nada carrega antes da primeira
     passada. Uma janela só, que segue o cursor com mola e inclina pela velocidade;
     a capa aparece na hora e o modelo ao vivo entra por cima quando estiver de pé. */
  const comMouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const poupa = navigator.connection && navigator.connection.saveData;
  document.documentElement.classList.toggle('reduz', reduzir);
  if (comMouse && !poupa) {
    const [W, H] = TAM.tela;
    let peek, janela, tela, nome, atual = null, saida = 0, espera = 0, limpa = 0, andando = false, ultimo = 0;
    const alvo = { x: 0, y: 0 }, pos = { x: 0, y: 0 };
    const monta = () => {
      peek = document.createElement('div');
      peek.className = 'peek'; peek.setAttribute('aria-hidden', 'true'); peek.inert = true;
      peek.innerHTML = '<div class="peek__janela"><div class="peek__barra"><i></i><i></i><i></i><span class="peek__nome"></span></div><div class="peek__tela"></div></div>';
      document.body.appendChild(peek);
      janela = $('.peek__janela', peek); tela = $('.peek__tela', peek); nome = $('.peek__nome', peek);
    };
    // onde a janela quer ficar: ao lado do cursor, virando de lado perto da borda
    const destino = () => {
      const pw = peek.offsetWidth, ph = peek.offsetHeight;
      let x = alvo.x + 28, y = alvo.y + 24;
      if (x + pw > innerWidth - 12) x = alvo.x - pw - 28;
      if (y + ph > innerHeight - 12) y = alvo.y - ph - 24;
      return { x: Math.max(12, x), y: Math.max(12, y) };
    };
    const quadro = (t) => {
      if (!peek.classList.contains('on')) { andando = false; return; }
      const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
      const k = reduzir ? 1 : 1 - Math.exp(-dt * 11);
      const d = destino();
      pos.x += (d.x - pos.x) * k; pos.y += (d.y - pos.y) * k;
      const atraso = d.x - pos.x;
      peek.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
      janela.style.transform = reduzir ? '' : `rotate(${Math.max(-7, Math.min(7, atraso * 0.05)).toFixed(2)}deg)`;
      requestAnimationFrame(quadro);
    };
    const viva = (card) => {
      const f = document.createElement('iframe');
      f.src = card.dataset.prev + '?demo';
      f.title = 'Demonstração ao vivo'; f.tabIndex = -1;
      Object.assign(f.style, { width: W + 'px', height: H + 'px', transform: `scale(${tela.clientWidth / W})` });
      f.addEventListener('load', () => setTimeout(() => f.classList.add('pronto'), 500));
      tela.appendChild(f);
    };
    const entra = (card, e) => {
      if (e.pointerType !== 'mouse') return;   // notebook com tela de toque: o dedo não aciona
      if (!peek) monta();
      clearTimeout(saida); clearTimeout(limpa);
      alvo.x = e.clientX; alvo.y = e.clientY;
      if (atual !== card) {
        atual = card;
        clearTimeout(espera);
        tela.replaceChildren();
        tela.style.backgroundImage = card.dataset.prevCapa ? `url('${card.dataset.prevCapa}')` : '';
        nome.textContent = card.dataset.prevNome || '';
        if (!reduzir) espera = setTimeout(() => { if (atual === card) viva(card); }, 220);
      }
      if (!peek.classList.contains('on')) {
        const d = destino(); pos.x = d.x; pos.y = d.y;
        peek.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        peek.classList.add('on');
      }
      if (!andando) { andando = true; ultimo = performance.now(); requestAnimationFrame(quadro); }
    };
    const sai = () => {
      clearTimeout(saida);
      // um respiro: ao passar de um cartão pro vizinho a janela continua no ar
      saida = setTimeout(() => {
        atual = null; clearTimeout(espera);
        peek.classList.remove('on');
        limpa = setTimeout(() => { if (!atual) tela.replaceChildren(); }, 500);
      }, 90);
    };
    $$('[data-prev]').forEach((card) => {
      card.addEventListener('pointerenter', (e) => entra(card, e));
      card.addEventListener('pointermove', (e) => { alvo.x = e.clientX; alvo.y = e.clientY; });
      card.addEventListener('pointerleave', sai);
    });
  }
})();
