// Camada de dados do site. O protótipo guarda no navegador (localStorage).
// Na versão final, ler() e gravar() viram chamadas à API (Cloudflare Worker + D1)
// e o resto do site não muda: as páginas só conversam com window.LOJA.
(() => {
  const CHAVE = "cafe-sergipano-v1";
  const copia = o => JSON.parse(JSON.stringify(o));

  const ler = () => {
    try { const s = localStorage.getItem(CHAVE); if (s) return JSON.parse(s); } catch (_) {}
    return copia(window.VILA_SEMENTE);
  };
  const gravar = dados => {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); return true; }
    catch (e) { return false; } // cota estourada (cartaz grande demais)
  };
  const zerar = () => { try { localStorage.removeItem(CHAVE); } catch (_) {} };

  /* ---------- Regras: como um cadastro vira o que aparece no site ---------- */
  const agora = () => new Date();
  const fimDoEvento = e => {
    // sem horário de fim, considera 4 horas depois do início
    const [h, m] = (e.fim || e.inicio || "23:00").split(":").map(Number);
    const d = new Date(e.data + "T00:00:00");
    d.setHours(h + (e.fim ? 0 : 4), m || 0);
    return d;
  };
  const status = e => {
    if (fimDoEvento(e) < agora()) return "encerrado";
    if (e.esgotado) return "esgotado";
    if (e.vagas) {
      const resta = e.vagas - (e.vendidos || 0);
      if (resta <= 0) return "esgotado";
      if (resta <= Math.max(3, Math.ceil(e.vagas * 0.25))) return "ultimas";
    }
    return "aberto";
  };
  const restantes = e => (e.vagas ? Math.max(0, e.vagas - (e.vendidos || 0)) : null);

  // eventos que o público vê: publicados, não encerrados, em ordem de data e hora
  const eventosVisiveis = dados =>
    dados.eventos
      .filter(e => e.publicado && status(e) !== "encerrado")
      .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));

  // Lista de espera feita pelo site (na versão final: POST na API).
  const entrarEspera = (id, pessoa) => {
    const d = ler(), e = d.eventos.find(x => x.id === id);
    if (!e) return false;
    (e.espera ||= []).push({ ...pessoa, em: Date.now() });
    (d.atividade ||= []).unshift({ tipo: "espera", evento: id, nome: pessoa.nome, em: Date.now() });
    return gravar(d);
  };

  window.LOJA = { ler, gravar, zerar, status, restantes, eventosVisiveis, fimDoEvento, entrarEspera };
})();
