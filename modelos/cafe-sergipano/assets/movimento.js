// Movimento da página: rolagem suave (Lenis), títulos com paralaxe leve e botões magnéticos.
// Regra: nada aqui depende de conteúdo cadastrado (eventos, itens). Só da estrutura fixa da página. Carrega as bibliotecas depois que a página já está de pé.
(() => {
  const { semMovimento } = window.VILA_UTIL;
  const fino = matchMedia("(pointer: fine)").matches;

  // Botões magnéticos: puxados de leve pelo cursor, voltam com mola. Funciona até no modo reduzido (é resposta a uma ação).
  if (fino) {
    document.addEventListener("pointermove", e => {
      const b = e.target.closest(".bt");
      document.querySelectorAll(".bt.ima").forEach(x => { if (x !== b) solta(x); });
      if (!b) return;
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.22, dy = (e.clientY - (r.top + r.height / 2)) * 0.35;
      b.classList.add("ima");
      b.style.transition = "transform .25s cubic-bezier(.2,.8,.2,1), color .45s cubic-bezier(.7,0,.2,1)";
      b.style.transform = `translate(${dx}px, ${dy}px)`;
    }, { passive: true });
    const solta = b => {
      b.classList.remove("ima");
      b.style.transition = "transform .7s cubic-bezier(.3,1.8,.5,1), color .45s cubic-bezier(.7,0,.2,1)";
      b.style.transform = "";
    };
  }

  if (semMovimento) return;

  const carrega = src => new Promise((ok, erro) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
  Promise.all([
    carrega("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"),
    carrega("https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"),
  ]).then(() => carrega("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js")).then(inicia).catch(() => {});

  function inicia() {
    const { gsap, ScrollTrigger, Lenis } = window;
    gsap.registerPlugin(ScrollTrigger);

    // rolagem suave só com mouse/trackpad; no toque o nativo é melhor
    if (fino) {
      const lenis = window.__lenis = new Lenis({ duration: 1.1, easing: t => 1 - Math.pow(1 - t, 4) });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      document.addEventListener("click", e => {
        const a = e.target.closest('a[href*="#"]');
        if (!a || a.pathname !== location.pathname) return;
        const alvo = document.querySelector(a.hash);
        if (!alvo) return;
        e.preventDefault();
        lenis.scrollTo(alvo, { offset: -76 });
        history.replaceState(null, "", a.hash);
      });
    }

    // títulos grandes andam de lado conforme a rolagem
    gsap.utils.toArray(".anda").forEach(el => {
      gsap.fromTo(el, { x: "6vw" }, { x: "-2vw", ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    });

  }
})();
