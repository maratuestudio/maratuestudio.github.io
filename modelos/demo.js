/* Modo demonstração dos sites-modelo da MARATU.
   Com ?demo na URL, a página se apresenta sozinha: rola, move um cursor, passa por cima,
   clica e arrasta, seguindo o roteiro em <script type="application/json" id="demo-roteiro">.
   Sem ?demo, este arquivo não faz nada.

   Passos do roteiro:
     ["espera", s]                  pausa
     ["rola", alvo, s]              alvo = número, seletor, "+300" ou "fim"
     ["cursor", seletor | [x,y], s] leva o cursor até lá (dispara os eventos de hover)
     ["clica", seletor]             leva o cursor e clica
     ["arrasta", de, para, s]       arrasta com eventos de ponteiro
     ["recomeca"]                   recarrega a página (o loop começa de novo)
   Opções no objeto: { "toque": true } troca a seta por um dedo. */
(() => {
  const qs = new URLSearchParams(location.search);
  if (!qs.has('demo')) return;
  const el = document.getElementById('demo-roteiro');
  if (!el) return;
  const R = JSON.parse(el.textContent);
  const passos = R.passos || [];
  document.documentElement.classList.add('em-demo');

  const css = document.createElement('style');
  css.textContent = `
    html.em-demo, html.em-demo body { scrollbar-width: none; }
    html.em-demo::-webkit-scrollbar { display: none; }
    .demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; will-change: transform; transition: opacity .3s; }
    .demo-cursor svg { display: block; width: 22px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.3)); transition: transform .12s; }
    .demo-cursor.dedo span { display: block; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; background: rgba(255,255,255,.55); border: 2px solid rgba(0,0,0,.35); backdrop-filter: blur(2px); transition: transform .15s; }
    .demo-cursor.aperta svg { transform: scale(.82); }
    .demo-cursor.aperta span { transform: scale(.7); }`;
  document.head.appendChild(css);

  const cur = document.createElement('div');
  cur.className = 'demo-cursor' + (R.toque ? ' dedo' : '');
  cur.innerHTML = R.toque ? '<span></span>' : '<svg viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.6L9.6 21z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  cur.style.opacity = 0;
  let x = innerWidth * 0.7, y = innerHeight * 0.6, sobre = null;

  const espera = (s) => new Promise((r) => setTimeout(r, s * 1000));
  const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const quadros = (s, cada) => new Promise((ok) => {
    const t0 = performance.now(), d = Math.max(1, s * 1000);
    (function f(t) { const k = Math.min(1, (t - t0) / d); cada(suave(k), k); if (k < 1) requestAnimationFrame(f); else ok(); })(t0);
  });
  const ponto = (alvo) => {
    if (Array.isArray(alvo)) return { x: alvo[0] * (alvo[0] <= 1 ? innerWidth : 1), y: alvo[1] * (alvo[1] <= 1 ? innerHeight : 1) };
    const e = document.querySelector(alvo);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, e };
  };
  const evento = (tipo, alvo, extra = {}) => {
    const C = tipo.startsWith('pointer') ? PointerEvent : MouseEvent;
    alvo.dispatchEvent(new C(tipo, { bubbles: !/enter|leave/.test(tipo), cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: R.toque ? 'touch' : 'mouse', isPrimary: true, buttons: extra.buttons || 0, view: window }));
  };
  // o que estiver embaixo do cursor recebe os eventos de hover, como com um mouse de verdade
  const mexe = (botao) => {
    cur.style.transform = `translate(${x}px, ${y}px)`;
    const e = document.elementFromPoint(x, y) || document.body;
    if (e !== sobre) {
      if (sobre) { evento('pointerout', sobre); evento('mouseout', sobre); evento('pointerleave', sobre); evento('mouseleave', sobre); }
      evento('pointerover', e); evento('mouseover', e); evento('pointerenter', e); evento('mouseenter', e);
      sobre = e;
    }
    evento('pointermove', e, { buttons: botao ? 1 : 0 }); evento('mousemove', e, { buttons: botao ? 1 : 0 });
  };
  const leva = async (alvo, s = 0.8, botao = false) => {
    const p = ponto(alvo); if (!p) return null;
    cur.style.opacity = 1;
    const x0 = x, y0 = y;
    await quadros(s, (k) => { x = x0 + (p.x - x0) * k; y = y0 + (p.y - y0) * k; mexe(botao); });
    return p;
  };
  const rolarAte = (alvo) => {
    const max = document.scrollingElement.scrollHeight - innerHeight;
    if (alvo === 'fim') return max;
    if (typeof alvo === 'number') return Math.min(max, alvo);
    if (typeof alvo === 'string' && /^[+-]\d/.test(alvo)) return Math.max(0, Math.min(max, scrollY + Number(alvo)));
    const e = document.querySelector(alvo);
    return e ? Math.min(max, e.getBoundingClientRect().top + scrollY) : scrollY;
  };
  // a demonstração conduz a rolagem quadro a quadro; com Lenis, só posiciona (immediate),
  // pra não depender do aviso de fim dele, que falha se a página ainda está medindo
  const rola = async (alvo, s) => {
    const fim = rolarAte(alvo), ini = scrollY;
    await quadros(s, (k) => {
      const v = ini + (fim - ini) * k, lenis = window.__lenis;
      if (lenis && lenis.scrollTo) lenis.scrollTo(v, { immediate: true, force: true });
      else window.scrollTo(0, v);
    });
    mexe(false);
  };

  const acoes = {
    espera,
    rola,
    cursor: (alvo, s) => leva(alvo, s),
    async clica(alvo, s = 0.7) {
      const p = await leva(alvo, s); if (!p) return;
      const e = document.elementFromPoint(x, y) || p.e;
      cur.classList.add('aperta');
      evento('pointerdown', e, { buttons: 1 }); evento('mousedown', e, { buttons: 1 });
      await espera(0.12);
      evento('pointerup', e); evento('mouseup', e);
      (p.e && p.e.contains(e) ? e : p.e || e).click();
      cur.classList.remove('aperta');
    },
    async arrasta(de, para, s = 1.2) {
      const a = await leva(de, 0.7); if (!a) return;
      cur.classList.add('aperta');
      evento('pointerdown', document.elementFromPoint(x, y) || a.e, { buttons: 1 });
      await espera(0.15);
      await leva(para, s, true);
      const e = document.elementFromPoint(x, y) || document.body;
      evento('pointerup', e); evento('mouseup', e);
      cur.classList.remove('aperta');
    },
    recomeca: () => { location.reload(); return new Promise(() => {}); },
  };

  const rodar = async () => {
    document.body.appendChild(cur);
    // espera a página ficar de pé antes de começar
    window.__demoPasso = 'inicio'; await espera(R.inicio ?? 1);
    for (;;) {
      for (const [nome, ...args] of passos) {
        window.__demoPasso = nome + ' ' + JSON.stringify(args);
        if (!acoes[nome]) { console.warn('passo desconhecido', nome); continue; }
        await acoes[nome](...args);
      }
      if (!passos.some(([n]) => n === 'recomeca')) { await rola(0, 1.6); await espera(0.6); }
    }
  };
  if (document.readyState === 'complete') rodar(); else addEventListener('load', rodar);
})();
