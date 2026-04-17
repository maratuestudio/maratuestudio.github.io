// ============================================================
// MARATU - TESTE DE REDESIGN
// interações base
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // ---------- CURSOR CUSTOM ----------
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  document.body.appendChild(cursor);

  let mouseX = 0, mouseY = 0, cursorX = 0, cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.2;
    cursorY += (mouseY - cursorY) * 0.2;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // hover states
  const hoverables = document.querySelectorAll('a, button, .produto, .vitrine__item, .indice__item');
  hoverables.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });

  // ---------- SCROLL REVEAL ----------
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -80px 0px' });

  reveals.forEach(el => observer.observe(el));

  // ---------- HEADER HIDE ON SCROLL DOWN ----------
  const header = document.querySelector('.header');
  let lastScroll = 0;

  if (header) {
    window.addEventListener('scroll', () => {
      const current = window.pageYOffset;
      if (current > 120 && current > lastScroll) {
        header.classList.add('hidden');
      } else {
        header.classList.remove('hidden');
      }
      lastScroll = current <= 0 ? 0 : current;
    });
  }

  // ---------- MOBILE MENU ----------
  const menuToggle = document.querySelector('.header__menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const menuClose = document.querySelector('.mobile-menu__close');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (menuClose && mobileMenu) {
    menuClose.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // ---------- TOGGLE GRID (debug/easter egg: tecla G) ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') {
      document.body.classList.toggle('grid-visible');
    }
  });

  // ---------- SELETOR DE TAMANHO (página de produto) ----------
  const tamanhos = document.querySelectorAll('.tamanho-btn');
  tamanhos.forEach(btn => {
    btn.addEventListener('click', () => {
      tamanhos.forEach(b => b.classList.remove('selecionado'));
      btn.classList.add('selecionado');

      const tam = btn.dataset.tamanho;
      const preco = btn.dataset.preco;
      const nome = document.querySelector('.produto-page__nome')?.textContent || 'produto';
      const cta = document.querySelector('.produto-page__cta');
      if (cta) {
        const msg = `olá, quero encomendar o ${nome.trim()} no tamanho ${tam} por R$ ${preco}`;
        cta.href = `https://wa.me/5579999999999?text=${encodeURIComponent(msg)}`;
      }
    });
  });

  // ---------- NEWSLETTER (placeholder) ----------
  const newsletterForm = document.querySelector('.newsletter__form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector('.newsletter__input');
      const btn = newsletterForm.querySelector('.newsletter__btn');
      if (input.value) {
        btn.textContent = 'assinado';
        input.value = '';
        setTimeout(() => { btn.textContent = 'assinar'; }, 2500);
      }
    });
  }

});
