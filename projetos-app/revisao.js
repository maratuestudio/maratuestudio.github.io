/* Revisão de projeto MARATU.
   O site do cliente roda num iframe da mesma origem (/projetos/<slug>/site/).
   Por cima: o Chico (Aratu em pixel, de óculos) abre Comentários, Caneta e Notas.
   Cada nota guarda onde foi feita: página, elemento (seletor + fração dentro dele),
   posição na página e o tamanho da tela. O desenho guarda os traços em pixels a partir
   do ponto de âncora. Tudo vai pra api/notas e o estúdio lê com tools/projetos.mjs. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, html) => {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const guarda = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  const SLUG = (location.pathname.match(/^\/projetos\/([a-z0-9-]+)\//) || [])[1] || 'demo';
  const NOME = ($('meta[name=rv-nome]') || {}).content || '';
  const AUTOR = ($('meta[name=rv-autor]') || {}).content || 'Cliente';
  const API = 'api/';
  const CORES = ['#FF3D1F', '#0D0D0B', '#1F6BFF'];

  const ICO = {
    comentar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/></svg>',
    desenhar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 4.5l4 4L9 19l-5 1 1-5z"/><path d="M13 7l4 4"/></svg>',
    notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    imagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8.5"/></svg>',
    fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    desfazer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  };

  const CW = 40, CH = 24;
  const pintaChico = window.ChicoPixel.pinta;

  /* ================= montagem da interface ================= */
  const site = $('#rv-site');
  const OY = () => site.getBoundingClientRect().top;   // a barra de prévia empurra o site pra baixo
  const moldura = el('div', { class: 'rv-moldura', 'aria-hidden': 'true' });
  const camada = el('div', { class: 'rv-camada' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  camada.appendChild(svg);
  const mira = el('div', { class: 'rv-mira', 'aria-hidden': 'true' });
  const risco = el('canvas', { class: 'rv-risco', 'aria-hidden': 'true' });

  const tour = el('div', { class: 'rv-tour', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Apresentação' });
  const tourLuz = el('div', { class: 'rv-tour__luz' });
  const tourCard = el('div', { class: 'rv-tour__card' });
  tour.append(tourLuz, tourCard);

  const chico = el('button', { class: 'rv-chico', type: 'button', 'aria-label': 'Chico: abrir ferramentas', 'aria-expanded': 'false', 'aria-controls': 'rv-menu' });
  const cv = el('canvas', { width: CW, height: CH });
  const badge = el('span', { class: 'rv-chico__n', hidden: '' });
  chico.append(cv, badge);

  const fala = el('div', { class: 'rv-fala', role: 'status', 'aria-live': 'polite' });

  const menu = el('div', { class: 'rv-menu', id: 'rv-menu', role: 'menu' });
  const bComentar = el('button', { class: 'rv-btn', type: 'button', role: 'menuitem' }, ICO.comentar + 'Comentários');
  const bDesenhar = el('button', { class: 'rv-btn', type: 'button', role: 'menuitem' }, ICO.desenhar + 'Caneta');
  const bNotas = el('button', { class: 'rv-btn', type: 'button', role: 'menuitem' }, ICO.notas + 'Notas <em></em>');
  const bAjuda = el('button', { class: 'rv-menu__ajuda', type: 'button', role: 'menuitem' }, 'Ajuda');
  menu.append(bComentar, bDesenhar, bNotas, bAjuda);

  const modo = el('div', { class: 'rv-modo', role: 'status' });
  const modoTxt = el('span');
  const modoSair = el('button', { type: 'button' }, 'Sair');
  modo.append(modoTxt, modoSair);

  const barra = el('div', { class: 'rv-barra', role: 'toolbar', 'aria-label': 'Desenho' });
  const bCores = CORES.map((c, i) => el('button', { class: 'rv-cor', type: 'button', 'aria-label': ['Vermelho', 'Preto', 'Azul'][i], 'aria-pressed': i === 0 ? 'true' : 'false' }, `<i style="background:${c}"></i>`));
  const bDesfaz = el('button', { class: 'rv-btn rv-btn--ico', type: 'button', 'aria-label': 'Desfazer' }, ICO.desfazer);
  const bPronto = el('button', { class: 'rv-btn rv-btn--pri', type: 'button', disabled: '' }, 'Pronto');
  barra.append(...bCores, el('span', { class: 'rv-barra__sep' }), bDesfaz, bPronto);

  // caixa de comentário
  const compor = el('form', { class: 'rv-compor', role: 'dialog', 'aria-label': 'Comentário', novalidate: '' });
  compor.innerHTML = `
    <textarea name="texto" placeholder="Comentário" maxlength="4000"></textarea>
    <div class="rv-compor__link"><input type="url" name="link" placeholder="https://" maxlength="800" inputmode="url"></div>
    <div class="rv-compor__img"><img alt=""><button type="button" class="rv-btn rv-btn--ico" aria-label="Tirar imagem">${ICO.fechar}</button></div>
    <p class="rv-compor__erro" role="alert"></p>
    <div class="rv-compor__pe">
      <button type="button" class="rv-btn rv-btn--ico rv-btn--leve" data-a="link" aria-label="Juntar link" aria-pressed="false" title="Link">${ICO.link}</button>
      <button type="button" class="rv-btn rv-btn--ico rv-btn--leve" data-a="img" aria-label="Juntar imagem" title="Imagem">${ICO.imagem}</button>
      <input type="file" accept="image/*" hidden>
      <button type="button" class="rv-compor__cancela" data-a="cancela">Cancelar</button>
      <button type="submit" class="rv-btn rv-btn--pri rv-compor__envia">Enviar</button>
    </div>`;

  const notas = el('aside', { class: 'rv-notas', 'aria-label': 'Notas', 'aria-hidden': 'true' });
  notas.innerHTML = `
    <div>
      <div class="rv-notas__topo"><h2>Notas</h2><button type="button" class="rv-btn rv-btn--ico" aria-label="Fechar notas">${ICO.fechar}</button></div>
      <div class="rv-notas__abas"><button type="button" data-f="abertas" aria-pressed="true">Abertas</button><button type="button" data-f="feitas" aria-pressed="false">Concluídas</button><button type="button" data-f="todas" aria-pressed="false">Todas</button></div>
    </div>
    <div class="rv-notas__lista"></div>`;
  const lista = $('.rv-notas__lista', notas);

  document.body.append(moldura, camada, mira, risco, tour, chico, fala, menu, modo, barra, compor, notas);
  // fechado = inerte (Tab não entra, leitor de tela não lê)
  const fechaveis = [menu, modo, barra, compor, notas];
  const sincroniza = (e) => { e.inert = !e.classList.contains('on'); };
  fechaveis.forEach((e) => { sincroniza(e); new MutationObserver(() => sincroniza(e)).observe(e, { attributes: true, attributeFilter: ['class'] }); });

  /* ================= Chico: parado, respirando, de vez em quando acena ================= */
  const anim = { corpo: 0, garras: [0, 0], brilho: null };
  pintaChico(cv, anim);
  let falando = 0;
  (function vive() {
    let t0 = performance.now(), proxAceno = 3000 + Math.random() * 4000, proxBrilho = 2000, acenando = 0, brilhando = -1;
    if (reduzir) return;
    function passo(t) {
      if (document.hidden) { t0 = t; requestAnimationFrame(passo); return; }
      const dt = t - t0; t0 = t;
      let muda = false;
      // respira: corpo sobe 1 pixel a cada ~1,1 s
      const resp = Math.floor(t / 1100) % 2 ? -8 : 0;
      if (resp !== anim.corpo) { anim.corpo = resp; muda = true; }
      // fala ou aceno: garras alternam a cada 0,22 s
      proxAceno -= dt;
      if (falando > 0 || acenando > 0) {
        if (acenando > 0) acenando -= dt;
        const f = Math.floor(t / 220) % 2;
        const g = f ? [-14, 6] : [6, -14];
        if (g[0] !== anim.garras[0]) { anim.garras = g; muda = true; }
      } else if (anim.garras[0] !== 0) { anim.garras = [0, 0]; muda = true; }
      if (proxAceno < 0) { acenando = 900; proxAceno = 6000 + Math.random() * 6000; }
      // brilho atravessa a lente
      proxBrilho -= dt;
      if (proxBrilho < 0 && brilhando < 0) { brilhando = 0; proxBrilho = 4000 + Math.random() * 5000; }
      if (brilhando >= 0) {
        const b = Math.floor(brilhando / 60);
        if (b > 6) { brilhando = -1; anim.brilho = null; muda = true; }
        else { if (anim.brilho !== b) { anim.brilho = b; muda = true; } brilhando += dt; }
      }
      if (muda) pintaChico(cv, anim);
      requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  })();

  let falaTimer = 0;
  function diz(html, ms = 5200) {
    clearTimeout(falaTimer);
    fala.innerHTML = html;
    fala.classList.add('on');
    falando = 1;
    setTimeout(() => { falando = 0; }, Math.min(1600, ms));
    if (ms) falaTimer = setTimeout(cala, ms);
  }
  function cala() { fala.classList.remove('on'); falando = 0; }
  fala.addEventListener('click', cala);

  /* ================= fundo atrás do Chico: claro ou escuro ================= */
  const amostra = document.createElement('canvas'); amostra.width = amostra.height = 8;
  function luzDe(cor) {
    const m = cor && cor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    if (!m || (m[4] !== undefined && +m[4] < 0.5)) return null;
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
  }
  function luzNoPonto(x, y) {
    const d = doc(), w = win();
    if (!d || !w || y < 0) return null;
    let n = d.elementFromPoint(x, y);
    while (n && n.nodeType === 1) {
      if (/^(IMG|VIDEO|CANVAS)$/.test(n.tagName)) {
        try {
          const r = n.getBoundingClientRect(), c = amostra.getContext('2d', { willReadFrequently: true });
          const iw = n.naturalWidth || n.videoWidth || n.width, ih = n.naturalHeight || n.videoHeight || n.height;
          // recorte de 60 px em volta do ponto, na escala da mídia
          const kx = iw / r.width, ky = ih / r.height;
          c.clearRect(0, 0, 8, 8);
          c.drawImage(n, Math.max(0, (x - r.left - 30) * kx), Math.max(0, (y - r.top - 30) * ky), 60 * kx, 60 * ky, 0, 0, 8, 8);
          const px = c.getImageData(0, 0, 8, 8).data; let t = 0, k = 0;
          for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128) { t += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; k++; }
          if (k) {
            // véu escuro por cima da foto (gradiente ou cor com transparência) puxa pra baixo
            return t / k / 255;
          }
        } catch (e) {}
      }
      const cs = w.getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)) {
        const cores = cs.backgroundImage.match(/rgba?\([^)]+\)/g) || [];
        const ls = cores.map(luzDe).filter((v) => v != null);
        if (ls.length) return ls.reduce((a, b) => a + b) / ls.length;
      }
      const l = luzDe(cs.backgroundColor);
      if (l != null) return l;
      n = n.parentElement;
    }
    return luzDe(w.getComputedStyle(d.body).backgroundColor) ?? 1;
  }
  let fundoPend = 0;
  function medeFundo() {
    if (fundoPend) return;
    fundoPend = requestAnimationFrame(() => {
      fundoPend = 0;
      const r = chico.getBoundingClientRect(), oy = OY();
      // amostra 3 pontos na coluna do Chico e do menu
      const ys = [r.top + r.height / 2, r.top - 40, r.top - 160].map((y) => y - oy);
      const ls = ys.map((y) => luzNoPonto(Math.min(innerWidth - 2, r.left + r.width / 2), Math.max(1, y))).filter((v) => v != null);
      const l = ls.length ? ls.reduce((a, b) => a + b) / ls.length : 1;
      document.documentElement.classList.toggle('fundo-escuro', l < 0.45);
    });
  }
  site.addEventListener('load', () => { const w = win(); if (!w) return; w.addEventListener('scroll', medeFundo, { passive: true }); setTimeout(medeFundo, 300); setTimeout(medeFundo, 1500); });
  addEventListener('resize', medeFundo);

  /* ================= menu ================= */
  function abreMenu(on) {
    menu.classList.toggle('on', on);
    chico.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { cala(); medeFundo(); bComentar.focus({ preventScroll: true }); }
  }
  chico.addEventListener('click', () => {
    if (estado.modo) { saiModo(); return; }
    abreMenu(!menu.classList.contains('on'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (tour.classList.contains('on')) { fimTour(); return; }
    if (compor.classList.contains('on')) { fechaCompor(); return; }
    if (notas.classList.contains('on')) { abreNotas(false); return; }
    if (estado.modo) { saiModo(); return; }
    abreMenu(false);
  });
  document.addEventListener('pointerdown', (e) => {
    if (menu.classList.contains('on') && !menu.contains(e.target) && !chico.contains(e.target)) abreMenu(false);
  });
  bComentar.addEventListener('click', () => { abreMenu(false); entraModo('comentar'); });
  bDesenhar.addEventListener('click', () => { abreMenu(false); entraModo('desenhar'); });
  bNotas.addEventListener('click', () => { abreMenu(false); abreNotas(true); });
  bAjuda.addEventListener('click', () => { abreMenu(false); comecaTour(); });

  /* ================= o site dentro do iframe ================= */
  const estado = { modo: null, notas: [], filtro: 'abertas', cor: CORES[0], tracos: [], ancoraNova: null, img: null, enviando: false, vistas: new Set() };
  const win = () => { try { return site.contentWindow; } catch (e) { return null; } };
  const doc = () => { try { return site.contentDocument; } catch (e) { return null; } };
  const pagina = () => { const w = win(); try { return w.location.pathname.replace(/^\/projetos\/[a-z0-9-]+\/site/, '') + (w.location.hash || ''); } catch (e) { return '/'; } };
  const paginaSemHash = () => pagina().replace(/#.*$/, '') || '/';

  site.addEventListener('load', () => {
    const w = win(); if (!w) return;
    w.addEventListener('scroll', redesenha, { passive: true });
    w.addEventListener('resize', redesenha);
    // o site pode crescer depois (imagem que carrega, animação): reposiciona
    try { new w.ResizeObserver(redesenha).observe(doc().documentElement); } catch (e) {}
    // link pra fora do projeto abre em aba nova, pra não sair da revisão
    doc().addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const u = new URL(a.href, w.location.href);
      if (u.origin !== location.origin || !u.pathname.startsWith('/projetos/' + SLUG + '/site')) {
        if (u.protocol === 'http:' || u.protocol === 'https:') { e.preventDefault(); window.open(u.href, '_blank', 'noopener'); }
      }
    }, true);
    redesenha();
  });

  /* seletor estável o bastante: id quando único, senão a trilha por nth-of-type */
  function seletor(alvo) {
    const d = alvo.ownerDocument, partes = [];
    let n = alvo;
    while (n && n.nodeType === 1 && n !== d.body && n !== d.documentElement) {
      if (n.id && d.querySelectorAll('#' + CSS.escape(n.id)).length === 1) { partes.unshift('#' + CSS.escape(n.id)); break; }
      let i = 1, s = n;
      while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
      partes.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
      n = n.parentElement;
    }
    if (!partes.length || !partes[0].startsWith('#')) partes.unshift('body');
    return partes.join(' > ');
  }
  function ancoraEm(x, y) {
    const d = doc(), w = win();
    let alvo = d && d.elementFromPoint(x, y);
    if (!alvo || alvo === d.documentElement) alvo = d && d.body;
    const r = alvo.getBoundingClientRect();
    return {
      sel: seletor(alvo),
      fx: r.width ? +((x - r.left) / r.width).toFixed(4) : 0,
      fy: r.height ? +((y - r.top) / r.height).toFixed(4) : 0,
      x: Math.round(x + w.scrollX), y: Math.round(y + w.scrollY),
      txt: (alvo.innerText || alvo.alt || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    };
  }
  // onde a âncora está agora, em coordenadas da tela
  function pontoDa(a) {
    const d = doc(), w = win();
    if (!d || !w) return null;
    let e = null;
    try { e = a.sel && d.querySelector(a.sel); } catch (er) {}
    if (e) {
      const r = e.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + a.fx * r.width, y: r.top + a.fy * r.height };
    }
    return { x: a.x - w.scrollX, y: a.y - w.scrollY };
  }

  /* ================= marcas na tela ================= */
  const pinos = new Map();
  function numero(n) { return estado.notas.indexOf(n) + 1; }
  function redesenha() {
    const pag = paginaSemHash();
    const W = innerWidth;
    let linhas = '';
    const vivos = new Set();
    for (const n of estado.notas) {
      if (!n.ancora || (n.pagina || '/').replace(/#.*$/, '') !== pag) continue;
      if (estado.filtro === 'abertas' && n.status === 'feita' && !estado.vistas.has(n.id)) continue;
      const p = pontoDa(n.ancora);
      if (!p) continue;
      vivos.add(n.id);
      let pin = pinos.get(n.id);
      if (!pin) {
        pin = el('button', { class: 'rv-pino', type: 'button' });
        pin.addEventListener('click', () => { abreNotas(true); focaNaLista(n.id); });
        camada.appendChild(pin); pinos.set(n.id, pin);
      }
      pin.className = 'rv-pino' + (n.status === 'feita' ? ' feito' : '') + (pin.classList.contains('pulsa') ? ' pulsa' : '');
      pin.innerHTML = '<span>' + numero(n) + '</span>';
      pin.setAttribute('aria-label', 'Nota ' + numero(n));
      pin.style.translate = `${Math.round(p.x)}px ${Math.round(p.y)}px`;
      // desenho só aparece com a tela parecida com a de quem desenhou
      if (n.desenho && n.vista && Math.abs(n.vista.w - W) < 140) {
        for (const tr of n.desenho.tracos || []) {
          let pts = '';
          for (let i = 0; i < tr.p.length; i += 2) pts += (p.x + tr.p[i]).toFixed(1) + ',' + (p.y + tr.p[i + 1]).toFixed(1) + ' ';
          linhas += `<polyline class="${n.status === 'feita' ? 'feito' : ''}" stroke="${esc(tr.c)}" points="${pts}"/>`;
        }
      }
    }
    // a nota que está sendo escrita
    if (estado.ancoraNova) {
      const p = pontoDa(estado.ancoraNova);
      let pin = pinos.get('_novo');
      if (!pin) { pin = el('div', { class: 'rv-pino novo', 'aria-hidden': 'true' }, '<span>+</span>'); camada.appendChild(pin); pinos.set('_novo', pin); }
      pin.style.translate = `${Math.round(p.x)}px ${Math.round(p.y)}px`;
      vivos.add('_novo');
      for (const tr of estado.tracosNovos || []) {
        let pts = '';
        for (let i = 0; i < tr.p.length; i += 2) pts += (p.x + tr.p[i]).toFixed(1) + ',' + (p.y + tr.p[i + 1]).toFixed(1) + ' ';
        linhas += `<polyline stroke="${esc(tr.c)}" points="${pts}"/>`;
      }
      posicionaCompor();
    }
    svg.innerHTML = linhas;
    for (const [id, pin] of pinos) if (!vivos.has(id)) { pin.remove(); pinos.delete(id); }
  }
  addEventListener('resize', () => { ajustaRisco(); redesenha(); });

  /* ================= modos ================= */
  function entraModo(m) {
    saiModo(true);
    estado.modo = m;
    document.documentElement.classList.add('modo-' + m);
    modoTxt.textContent = m === 'comentar' ? 'Clique no ponto que quer comentar' : 'Risque sobre o site';
    modo.classList.add('on');
    if (m === 'comentar') mira.classList.add('on');
    else { risco.classList.add('on'); barra.classList.add('on'); estado.tracos = []; ajustaRisco(); pintaRisco(); bPronto.disabled = true; }
    chico.setAttribute('aria-label', 'Sair do modo');
  }
  function saiModo(silencioso) {
    if (!estado.modo) return;
    document.documentElement.classList.remove('modo-' + estado.modo);
    estado.modo = null;
    mira.classList.remove('on'); risco.classList.remove('on'); barra.classList.remove('on'); modo.classList.remove('on');
    estado.tracos = [];
    pintaRisco();
    chico.setAttribute('aria-label', 'Chico: abrir ferramentas');
  }
  modoSair.addEventListener('click', () => { saiModo(); fechaCompor(); });

  // rolagem passa pro site enquanto a mira ou o risco estão por cima
  function repassaRoda(e) { const w = win(); if (w) { w.scrollBy(e.deltaX, e.deltaY); e.preventDefault(); } }
  mira.addEventListener('wheel', repassaRoda, { passive: false });
  risco.addEventListener('wheel', repassaRoda, { passive: false });

  // mira: toque curto marca, arrastar rola
  let toque = null;
  mira.addEventListener('pointerdown', (e) => { toque = { x: e.clientX, y: e.clientY, ux: e.clientX, uy: e.clientY, moveu: false, id: e.pointerId }; mira.setPointerCapture(e.pointerId); });
  mira.addEventListener('pointermove', (e) => {
    if (!toque || e.pointerId !== toque.id) return;
    if (Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 8) toque.moveu = true;
    if (toque.moveu && e.pointerType !== 'mouse') { const w = win(); w && w.scrollBy(toque.ux - e.clientX, toque.uy - e.clientY); }
    toque.ux = e.clientX; toque.uy = e.clientY;
  });
  mira.addEventListener('pointerup', (e) => {
    if (!toque || e.pointerId !== toque.id) return;
    const t = toque; toque = null;
    if (t.moveu) return;
    estado.ancoraNova = ancoraEm(e.clientX, e.clientY - OY());
    estado.tracosNovos = null;
    saiModo(true);
    abreCompor('comentario');
  });

  /* ---------- risco ---------- */
  let dpr = 1;
  function ajustaRisco() {
    dpr = Math.min(2, devicePixelRatio || 1);
    risco.width = Math.round(innerWidth * dpr); risco.height = Math.round(site.clientHeight * dpr);
    pintaRisco();
  }
  function pintaRisco() {
    const c = risco.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, risco.width, risco.height);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 4;
    const w = win(), sx = w ? w.scrollX : 0, sy = w ? w.scrollY : 0;
    for (const tr of estado.tracos) {
      c.strokeStyle = tr.c; c.beginPath();
      for (let i = 0; i < tr.p.length; i += 2) {
        const x = tr.p[i] - sx, y = tr.p[i + 1] - sy;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      if (tr.p.length === 2) c.lineTo(tr.p[0] - sx + .1, tr.p[1] - sy);
      c.stroke();
    }
  }
  let traco = null;
  risco.addEventListener('pointerdown', (e) => {
    const w = win();
    traco = { c: estado.cor, p: [e.clientX + w.scrollX, e.clientY - OY() + w.scrollY], id: e.pointerId };
    estado.tracos.push(traco);
    risco.setPointerCapture(e.pointerId);
    pintaRisco();
  });
  risco.addEventListener('pointermove', (e) => {
    if (!traco || e.pointerId !== traco.id) return;
    const w = win(), x = e.clientX + w.scrollX, y = e.clientY - OY() + w.scrollY;
    const n = traco.p.length;
    if (Math.hypot(x - traco.p[n - 2], y - traco.p[n - 1]) < 2) return;
    traco.p.push(Math.round(x), Math.round(y));
    pintaRisco();
  });
  const fimTraco = (e) => { if (traco && e.pointerId === traco.id) { traco = null; bPronto.disabled = !estado.tracos.length; } };
  risco.addEventListener('pointerup', fimTraco);
  risco.addEventListener('pointercancel', fimTraco);
  // rolar no meio do desenho: o canvas acompanha
  site.addEventListener('load', () => { const w = win(); w && w.addEventListener('scroll', () => { if (estado.modo === 'desenhar') pintaRisco(); }, { passive: true }); });

  bCores.forEach((b, i) => b.addEventListener('click', () => {
    estado.cor = CORES[i];
    bCores.forEach((o, j) => o.setAttribute('aria-pressed', i === j ? 'true' : 'false'));
  }));
  bDesfaz.addEventListener('click', () => { estado.tracos.pop(); pintaRisco(); bPronto.disabled = !estado.tracos.length; });
  bPronto.addEventListener('click', () => {
    if (!estado.tracos.length) return;
    // âncora no começo do primeiro traço; traços viram deslocamentos a partir dela
    const w = win();
    const t0 = estado.tracos[0];
    const ax = t0.p[0] - w.scrollX, ay = t0.p[1] - w.scrollY;
    const a = ancoraEm(Math.max(0, Math.min(innerWidth - 1, ax)), Math.max(0, Math.min(site.clientHeight - 1, ay)));
    a.x = t0.p[0]; a.y = t0.p[1];
    estado.ancoraNova = a;
    estado.tracosNovos = estado.tracos.map((tr) => ({ c: tr.c, p: tr.p.map((v, i) => i % 2 ? v - t0.p[1] : v - t0.p[0]) }));
    saiModo(true);
    abreCompor('desenho');
  });

  /* ================= caixa de comentário ================= */
  const fTexto = compor.elements.texto, fLink = compor.elements.link;
  const caixaLink = $('.rv-compor__link', compor), caixaImg = $('.rv-compor__img', compor);
  const fArq = $('input[type=file]', compor), erro = $('.rv-compor__erro', compor);
  const bEnviar = $('button[type=submit]', compor);
  let tipoNovo = 'comentario';

  function abreCompor(tipo) {
    tipoNovo = tipo;
    fTexto.value = ''; fLink.value = ''; caixaLink.classList.remove('on'); $('[data-a=link]', compor).setAttribute('aria-pressed', 'false'); tiraImg(); erro.textContent = '';
    fTexto.placeholder = tipo === 'desenho' ? 'Comentário (opcional)' : 'Comentário';
    compor.classList.add('on');
    redesenha();
    setTimeout(() => fTexto.focus({ preventScroll: true }), 30);
  }
  function fechaCompor() {
    compor.classList.remove('on');
    estado.ancoraNova = null; estado.tracosNovos = null;
    redesenha();
  }
  function posicionaCompor() {
    if (!estado.ancoraNova || !compor.classList.contains('on') && !compor.isConnected) return;
    const p = pontoDa(estado.ancoraNova);
    const w = compor.offsetWidth, h = compor.offsetHeight;
    const M = 12;
    const py = p.y + OY();
    let x = p.x + 22, y = py - 20, ox = '0%';
    if (x + w > innerWidth - M) { x = p.x - w - 14; ox = '100%'; }
    if (x < M) { x = Math.max(M, Math.min(innerWidth - w - M, p.x - w / 2)); ox = '50%'; }
    y = Math.max(M, Math.min(innerHeight - h - M, y));
    // fora da tela: a caixa fica, mas mostra que o ponto saiu de vista
    compor.classList.toggle('solta', p.y < 0 || p.y > site.clientHeight);
    compor.style.transformOrigin = ox + ' 0';
    compor.style.left = Math.round(x) + 'px'; compor.style.top = Math.round(y) + 'px';
  }
  compor.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'cancela') fechaCompor();
    if (a.dataset.a === 'link') { caixaLink.classList.toggle('on'); a.setAttribute('aria-pressed', caixaLink.classList.contains('on') ? 'true' : 'false'); if (caixaLink.classList.contains('on')) fLink.focus(); posicionaCompor(); }
    if (a.dataset.a === 'img') fArq.click();
  });
  $('.rv-compor__img button', compor).addEventListener('click', tiraImg);
  fArq.addEventListener('change', () => { if (fArq.files[0]) poeImg(fArq.files[0]); fArq.value = ''; });
  compor.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData && e.clipboardData.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); poeImg(f); }
  });
  compor.addEventListener('dragover', (e) => { e.preventDefault(); });
  compor.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = [...(e.dataTransfer && e.dataTransfer.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) poeImg(f);
  });
  function poeImg(f) {
    if (f.size > 12e6) { erro.textContent = 'Limite: 12 MB.'; return; }
    erro.textContent = '';
    if (estado.img && estado.img.url) URL.revokeObjectURL(estado.img.url);
    estado.img = { arquivo: f, url: URL.createObjectURL(f) };
    $('img', caixaImg).src = estado.img.url;
    caixaImg.classList.add('on');
    posicionaCompor();
  }
  function tiraImg() {
    if (estado.img && estado.img.url) URL.revokeObjectURL(estado.img.url);
    estado.img = null; caixaImg.classList.remove('on'); $('img', caixaImg).removeAttribute('src');
  }
  // imagem grande encolhe antes de subir (lado maior 2000 px, JPEG/WebP)
  async function encolhe(f) {
    if (f.size < 1.5e6 || f.type === 'image/gif') return f;
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise((ok) => c.toBlob((b) => ok(b || f), 'image/webp', 0.86));
    } catch (e) { return f; }
  }

  compor.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (estado.enviando) return;
    const autor = AUTOR;
    const texto = fTexto.value.trim();
    let link = fLink.value.trim();
    if (tipoNovo === 'comentario' && !texto && !estado.img && !link) { erro.textContent = 'Escreva um comentário.'; fTexto.focus(); return; }
    if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
    // guarda onde a nota foi feita: se o envio falhar, a caixa volta com a mesma posição e o mesmo desenho
    const ancoraGuardada = estado.ancoraNova, tracosGuardados = estado.tracosNovos;
    estado.enviando = true; bEnviar.disabled = true; bEnviar.textContent = 'Enviando…';
    erro.textContent = '';
    try {
      let imagem = null;
      if (estado.img) {
        const b = await encolhe(estado.img.arquivo);
        const r = await fetch(API + 'imagem', { method: 'POST', headers: { 'Content-Type': b.type || 'image/jpeg' }, body: b });
        if (!r.ok) throw new Error('imagem');
        imagem = (await r.json()).chave;
      }
      const w = win();
      const nota = {
        tipo: tipoNovo, autor, texto, link: link || null, imagem,
        pagina: pagina(), ancora: estado.ancoraNova,
        desenho: estado.tracosNovos ? { tracos: estado.tracosNovos } : null,
        vista: { w: innerWidth, h: site.clientHeight, sy: Math.round(w.scrollY), dpr: devicePixelRatio || 1, ua: navigator.userAgent.slice(0, 160) },
      };
      // aparece na hora; se a gravação falhar, volta atrás
      const temp = Object.assign({ id: '_t' + Date.now(), minha: true, status: 'aberta', criado: new Date().toISOString(), _temp: true }, nota);
      estado.notas.push(temp);
      fechaCompor();
      redesenha(); pintaLista();
      const r = await fetch(API + 'notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nota) });
      if (!r.ok) {
        estado.notas.splice(estado.notas.indexOf(temp), 1); redesenha(); pintaLista();
        throw new Error('nota');
      }
      const salva = await r.json();
      Object.assign(temp, salva.nota || {}); delete temp._temp;
      redesenha(); pintaLista(); contaBadge();
      const p = pinos.get(temp.id); if (p) { p.classList.add('pulsa'); setTimeout(() => p.classList.remove('pulsa'), 1900); }
      diz('Recebido. Seu pedido está em Notas.', 3200);
    } catch (er) {
      diz('Falha no envio.', 4000);
      estado.ancoraNova = ancoraGuardada; estado.tracosNovos = tracosGuardados;
      compor.classList.add('on');
      redesenha();
      erro.textContent = 'Falha no envio. Tente de novo.';
    } finally {
      estado.enviando = false; bEnviar.disabled = false; bEnviar.textContent = 'Enviar';
    }
  });

  /* ================= notas ================= */
  let primeiraCarga = false;
  async function carrega() {
    try {
      const r = await fetch(API + 'notas', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const temp = estado.notas.filter((n) => n._temp);
      estado.notas = (j.notas || []).concat(temp);
      redesenha(); pintaLista(); contaBadge();
      // ajustes novos desde a última visita (só conta como visto depois do passo a passo)
      if (!guarda.get('rv-tour-' + SLUG)) return;
      const vistoKey = 'rv-feitas-' + SLUG;
      let vistas; try { vistas = new Set(JSON.parse(guarda.get(vistoKey) || '[]')); } catch (e) { vistas = new Set(); }
      const novas = estado.notas.filter((n) => n.status === 'feita' && !vistas.has(n.id));
      if (novas.length) {
        diz(novas.length === 1 ? '<b>1 ajuste concluído.</b> Veja em Notas.' : `<b>${novas.length} ajustes concluídos.</b> Veja em Notas.`, 7000);
        guarda.set(vistoKey, JSON.stringify(estado.notas.filter((n) => n.status === 'feita').map((n) => n.id)));
      } else if (!primeiraCarga && !tour.classList.contains('on')) {
        diz('Clique em mim para comentar ou usar a caneta.', 3800);
      }
      primeiraCarga = true;
    } catch (e) {}
  }
  function contaBadge() {
    const abertas = estado.notas.filter((n) => n.status !== 'feita').length;
    badge.textContent = abertas; badge.hidden = !abertas;
    $('em', bNotas).textContent = estado.notas.length || '';
    $$('.rv-notas__abas button', notas).forEach((b) => {
      const f = b.dataset.f;
      const n = f === 'todas' ? estado.notas.length : estado.notas.filter((x) => (x.status === 'feita') === (f === 'feitas')).length;
      b.textContent = { abertas: 'Abertas', feitas: 'Concluídas', todas: 'Todas' }[f] + ' ' + n;
    });
  }
  function $$(s, r = document) { return [...r.querySelectorAll(s)]; }
  function quando(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const hoje = new Date();
    const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoje.toDateString()) return 'hoje, ' + hm;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hm;
  }
  function linkifica(t) { return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  function pintaLista() {
    const f = estado.filtro;
    const itens = estado.notas.filter((n) => f === 'todas' || (n.status === 'feita') === (f === 'feitas'));
    if (!itens.length) {
      lista.innerHTML = `<p class="rv-notas__vazio">${f === 'feitas' ? 'Nenhum ajuste concluído.' : f === 'abertas' ? 'Nenhuma nota aberta.' : 'Nenhuma nota.'}</p>`;
      return;
    }
    lista.innerHTML = '';
    for (const n of itens) {
      const b = el('div', { class: 'rv-nota' + (n.status === 'feita' ? ' feito' : ''), role: 'button', tabindex: '0', 'data-id': n.id });
      const pag = (n.pagina || '/').replace(/#.*$/, '');
      let h = `<span class="rv-nota__n">${numero(n)}</span>`;
      h += `<span class="rv-nota__meta"><span>${esc(n.autor || '')}</span><span>${quando(n.criado)}</span>${pag !== '/' ? `<span>${esc(pag)}</span>` : ''}${n.tipo === 'desenho' ? '<span>desenho</span>' : ''}</span>`;
      if (n.texto) h += `<span class="rv-nota__txt">${linkifica(n.texto)}</span>`;
      if (n.link) h += `<span class="rv-nota__txt"><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.link.replace(/^https?:\/\//, '').slice(0, 60))}</a></span>`;
      if (n.imagem) h += `<img class="rv-nota__img" src="${API}imagem/${encodeURIComponent(n.imagem)}" alt="Imagem de referência" loading="lazy" width="320" height="140">`;
      if (n.status === 'feita') h += `<span class="rv-nota__resp"><b>Concluído${n.feito_em ? ', ' + quando(n.feito_em) : ''}</b>${n.resposta ? linkifica(n.resposta) : ''}</span>`;
      else if (n.minha && !n._temp) h += `<button type="button" class="rv-nota__apaga" data-apaga="${esc(n.id)}">Apagar</button>`;
      b.innerHTML = h;
      lista.appendChild(b);
    }
  }
  lista.addEventListener('click', async (e) => {
    if (e.target.closest('a')) return;
    const ap = e.target.closest('[data-apaga]');
    if (ap) {
      e.stopPropagation();
      const id = ap.dataset.apaga;
      const i = estado.notas.findIndex((n) => n.id === id);
      if (i < 0) return;
      const [tirada] = estado.notas.splice(i, 1);
      redesenha(); pintaLista(); contaBadge();
      const r = await fetch(API + 'notas/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => null);
      if (!r || !r.ok) { estado.notas.splice(i, 0, tirada); redesenha(); pintaLista(); contaBadge(); diz('Falha ao apagar.'); }
      return;
    }
    const item = e.target.closest('.rv-nota');
    if (item) vaiPara(item.dataset.id);
  });
  lista.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('rv-nota')) { e.preventDefault(); vaiPara(e.target.dataset.id); } });
  $$('.rv-notas__abas button', notas).forEach((b) => b.addEventListener('click', () => {
    estado.filtro = b.dataset.f;
    $$('.rv-notas__abas button', notas).forEach((o) => o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
    pintaLista(); redesenha();
  }));
  $('.rv-notas__topo button', notas).addEventListener('click', () => abreNotas(false));

  function abreNotas(on) {
    notas.classList.toggle('on', on);
    notas.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on) { pintaLista(); $('.rv-notas__topo button', notas).focus({ preventScroll: true }); }
    else chico.focus({ preventScroll: true });
  }
  function focaNaLista(id) {
    const it = lista.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!it) { estado.filtro = 'todas'; $$('.rv-notas__abas button', notas).forEach((o) => o.setAttribute('aria-pressed', o.dataset.f === 'todas' ? 'true' : 'false')); pintaLista(); return focaNaLista(id); }
    it.scrollIntoView({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
    it.focus({ preventScroll: true });
  }
  function vaiPara(id) {
    const n = estado.notas.find((x) => x.id === id);
    if (!n || !n.ancora) return;
    if (n.status === 'feita') estado.vistas.add(n.id);
    const w = win();
    const pag = (n.pagina || '/').replace(/#.*$/, '');
    const rola = () => {
      const p = pontoDa(n.ancora);
      if (p) win().scrollBy({ top: p.y - site.clientHeight * 0.4, behavior: reduzir ? 'auto' : 'smooth' });
      setTimeout(() => { redesenha(); const pin = pinos.get(n.id); if (pin) { pin.classList.add('pulsa'); setTimeout(() => pin.classList.remove('pulsa'), 1900); } }, reduzir ? 0 : 450);
    };
    if (innerWidth < 641) abreNotas(false);
    if (pag !== paginaSemHash()) {
      site.addEventListener('load', () => setTimeout(rola, 300), { once: true });
      w.location.href = '/projetos/' + SLUG + '/site' + pag;
    } else rola();
  }

  /* ================= passo a passo ================= */
  const PASSOS = [
    { alvo: null, txt: () => (NOME ? '<b>' + esc(NOME) + '</b>. ' : '') + 'Esta é a prévia do seu site. Navegue à vontade e marque o que quer mudar.' },
    { alvo: () => chico, txt: () => '<b>Chico</b>. Clique nele para abrir as ferramentas.' },
    { alvo: () => bComentar, menu: true, txt: () => '<b>Comentários</b>. Clique em qualquer ponto do site e escreva o ajuste. Aceita link e imagem de referência.' },
    { alvo: () => bDesenhar, menu: true, txt: () => '<b>Caneta</b>. Risque direto sobre o site para marcar uma área ou mostrar uma ideia.' },
    { alvo: () => bNotas, menu: true, txt: () => '<b>Notas</b>. Todos os seus pedidos. Cada ajuste feito aparece como concluído.' },
  ];
  let passoAtual = 0;
  function comecaTour() { saiModo(true); fechaCompor(); abreNotas(false); passoAtual = 0; tour.classList.add('on'); mostraPasso(); }
  function fimTour() {
    tour.classList.remove('on'); menu.classList.remove('on'); menu.classList.remove('sem-anim'); chico.setAttribute('aria-expanded', 'false');
    guarda.set('rv-tour-' + SLUG, '1');
    diz('Estou aqui. Clique em mim quando precisar.', 3200);
  }
  function mostraPasso() {
    const p = PASSOS[passoAtual];
    const ultimo = passoAtual === PASSOS.length - 1;
    // no passo a passo o menu abre sem animação: a luz mede o botão já no lugar final
    menu.classList.add('sem-anim');
    menu.classList.toggle('on', !!p.menu);
    tourCard.innerHTML = `<p>${p.txt()}</p><div class="rv-tour__pe"><span class="rv-tour__conta">${passoAtual + 1} de ${PASSOS.length}</span>${ultimo ? '' : '<button type="button" class="rv-tour__pular">Pular</button>'}<button type="button" class="rv-btn rv-btn--pri" data-prox>${ultimo ? 'Começar' : 'Próximo'}</button></div>`;
    $('[data-prox]', tourCard).addEventListener('click', () => { if (ultimo) fimTour(); else { passoAtual++; mostraPasso(); } });
    const pul = $('.rv-tour__pular', tourCard); if (pul) pul.addEventListener('click', fimTour);
    // espera o menu abrir pra medir
    setTimeout(() => {
      const alvo = p.alvo && p.alvo();
      const cw = tourCard.offsetWidth, ch = tourCard.offsetHeight, M = 16;
      if (!alvo) {
        tourLuz.classList.remove('cheia');
        tourLuz.style.width = '0px'; tourLuz.style.height = '0px';
        tourLuz.style.transform = `translate(${innerWidth / 2}px, ${innerHeight * 0.48}px)`;
        tourCard.style.transform = `translate(${Math.round((innerWidth - cw) / 2)}px, ${Math.round(innerHeight * 0.46 - ch / 2)}px)`;
      } else {
        // inclui a sombra dura de 3 px, pra luz ficar centrada no botão inteiro
        const b = alvo.getBoundingClientRect(), sh = alvo === chico ? 0 : 3, pad = 7;
        const r = { left: b.left, top: b.top, width: b.width + sh, height: b.height + sh, right: b.right + sh };
        tourLuz.classList.add('cheia');
        tourLuz.style.width = r.width + pad * 2 + 'px'; tourLuz.style.height = r.height + pad * 2 + 'px';
        tourLuz.style.borderRadius = alvo === chico ? '22px' : '999px';
        tourLuz.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
        // cartão à esquerda do alvo; sem espaço, em cima
        let x = r.left - pad - cw - 16, y = r.top + r.height / 2 - ch / 2;
        if (x < M) { x = Math.max(M, Math.min(innerWidth - cw - M, r.right - cw)); y = r.top - pad - ch - 16; }
        y = Math.max(M, Math.min(innerHeight - ch - M, y));
        tourCard.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
      $('[data-prox]', tourCard).focus({ preventScroll: true });
    }, 40);
  }
  tour.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && passoAtual < PASSOS.length - 1) { passoAtual++; mostraPasso(); }
    if (e.key === 'ArrowLeft' && passoAtual > 0) { passoAtual--; mostraPasso(); }
  });
  addEventListener('resize', () => { if (tour.classList.contains('on')) mostraPasso(); });

  /* ================= começo ================= */
  setTimeout(carrega, 600);
  setInterval(() => { if (!document.hidden && !estado.enviando) carrega(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) carrega(); });
  if (!guarda.get('rv-tour-' + SLUG) || /[?&]tour\b/.test(location.search)) setTimeout(comecaTour, 700);
})();
