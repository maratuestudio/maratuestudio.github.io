/* Portal de projetos: conta do cliente (criar, entrar, sair) e a lista dos projetos ligados a ela.
   API do Worker em /projetos/api/*; a sessão fica num cookie HttpOnly (rv_s). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const volta = (() => { const v = new URLSearchParams(location.search).get('volta') || ''; return /^\/projetos\/[a-z0-9-]+\/$/.test(v) ? v : ''; })();

  /* entrar ou criar conta */
  const forms = { entrar: $('#f-entrar'), criar: $('#f-criar') };
  let modoAtual = 'entrar';
  function modo(k, foca) {
    modoAtual = k;
    for (const n in forms) forms[n].hidden = n !== k;
    if (foca) { const i = forms[k].querySelector('input'); i && i.focus(); }
  }
  document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => modo(b.dataset.modo, true)));

  /* envio */
  async function envia(form, rota) {
    const erro = $('.pt-erro', form), btn = $('button[type=submit]', form);
    const dados = Object.fromEntries(new FormData(form));
    erro.textContent = '';
    btn.disabled = true;
    const rot = btn.textContent; btn.style.minWidth = btn.offsetWidth + 'px'; btn.textContent = 'Aguarde…';
    try {
      const r = await fetch('/projetos/api/' + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados), credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { erro.textContent = j.erro || 'Algo falhou. Tente de novo.'; return; }
      form.reset();
      await carrega(true);
    } catch (e) {
      erro.textContent = 'Sem conexão. Tente de novo.';
    } finally { btn.disabled = false; btn.textContent = rot; }
  }
  forms.entrar.addEventListener('submit', (e) => { e.preventDefault(); envia(forms.entrar, 'entrar'); });
  forms.criar.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = forms.criar, erro = $('.pt-erro', f);
    if (f.nome.value.trim().length < 2) { erro.textContent = 'Informe seu nome.'; f.nome.focus(); return; }
    if (f.whatsapp.value.replace(/\D/g, '').length < 10) { erro.textContent = 'WhatsApp com DDD.'; f.whatsapp.focus(); return; }
    if (!f.email.checkValidity() || !f.email.value) { erro.textContent = 'E-mail inválido.'; f.email.focus(); return; }
    if (f.senha.value.length < 8) { erro.textContent = 'Senha com 8 caracteres ou mais.'; f.senha.focus(); return; }
    envia(f, 'criar');
  });
  // WhatsApp: máscara leve enquanto digita
  forms.criar.whatsapp.addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  $('.pt-sair').addEventListener('click', async () => {
    await fetch('/projetos/api/sair', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    carrega();
  });

  /* estado */
  const SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  async function carrega(depoisDeEntrar) {
    let j = null;
    try { j = await (await fetch('/projetos/api/eu', { credentials: 'same-origin', cache: 'no-store' })).json(); } catch (e) {}
    const eu = j && j.eu;
    $('.pt-fora').hidden = !!eu; $('.pt-dentro').hidden = !eu; $('.pt-sair').hidden = !eu;
    if (!eu) { modo(modoAtual); return; }
    const projetos = j.projetos || [];
    if (volta && projetos.some((p) => '/projetos/' + p.slug + '/' === volta)) { location.replace(volta); return; }
    if (depoisDeEntrar && projetos.length === 1) { location.href = '/projetos/' + projetos[0].slug + '/'; return; }
    $('.pt-nome').textContent = eu.nome.split(' ')[0];
    $('.pt-espera').hidden = !!projetos.length;
    $('.pt-lista').innerHTML = projetos.map((p) => `
      <li><a class="pt-proj" href="/projetos/${esc(p.slug)}/">
        <span class="pt-proj__txt"><span class="pt-proj__nome">${esc(p.nome)}</span>
        <span class="pt-proj__meta"><span>${p.abertas} ${p.abertas === 1 ? 'nota aberta' : 'notas abertas'}</span><span>${p.feitas} ${p.feitas === 1 ? 'concluída' : 'concluídas'}</span></span></span>
        <span class="pt-proj__ir">${SETA}</span></a></li>`).join('');
  }
  carrega();
})();
