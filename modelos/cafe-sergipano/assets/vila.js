// Site do Café Sergipano (marca fictícia, modelo MARATU). Tudo que aparece aqui vem dos dados do painel.
// Nenhum evento, item ou texto é escrito à mão nesta camada.
(() => {
  const L = window.LOJA, D = L.ler();
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pagina = document.body.dataset.pagina;
  const params = new URLSearchParams(location.search);

  // Movimento reduzido no sistema suaviza; ?motion força tudo (o Mac do Rapha usa reduzido)
  let forcaMov = params.has("motion") || params.has("demo");
  try { if (forcaMov) sessionStorage.setItem("vila-mov", 1); else forcaMov = !!sessionStorage.getItem("vila-mov"); } catch (_) {}
  if (forcaMov) document.documentElement.classList.add("forca-mov");
  const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches && !forcaMov;

  /* ---------- Formatos ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const fSem = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
  const fReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const data = iso => {
    const d = new Date(iso + "T12:00:00");
    return { d, dia: d.getDate(), mes: fMes.format(d).replace(".", ""), semana: fSem.format(d).replace("-feira", ""), sem3: fSem.format(d).slice(0, 3) };
  };
  const hora = h => (h ? h.replace(/^0/, "").replace(":00", "h").replace(":", "h") : "");
  const reais = n => fReais.format(n);
  // preço vazio = não informado (não mostra nada); 0 = entrada livre
  const precoTxt = e => (e.preco === "" || e.preco == null ? "" : Number(e.preco) > 0 ? reais(Number(e.preco)) : "Entrada livre");
  const quandoTxt = (e, d) => [`${d.sem3} ${d.dia} ${d.mes}`, hora(e.inicio)].filter(Boolean).join(", ");
  const TIPOS = { oficina: "Oficina", festa: "Festa" };
  const linhas = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
  const seta = () => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10.5 5 15.5 10l-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const desenho = (nome, cls = "") => `<span class="desenho ${cls}" style="--src:url(/modelos/cafe-sergipano/assets/svg/${nome}.svg)" aria-hidden="true"></span>`;

  // selo de situação: o mesmo texto em qualquer lugar do site
  const situacao = e => {
    const st = L.status(e), r = L.restantes(e);
    if (st === "esgotado") return { cls: "esgotado", txt: "Esgotado" };
    if (st === "ultimas") return { cls: "ultimas", txt: r === 1 ? "Última vaga" : `Últimas ${r} vagas` };
    return null;
  };

  // cartaz: a arte cadastrada; sem arte, um cartaz gerado nas cores da marca
  const cartaz = (e, cls = "") => e.cartaz
    ? `<span class="cartaz ${cls}"><img src="${esc(e.cartaz)}" alt="Cartaz: ${esc(e.titulo)}" loading="lazy" decoding="async" width="800" height="1000"></span>`
    : `<span class="cartaz gerado ${cls}" role="img" aria-label="${esc(e.titulo)}">
        <span class="g-tipo">${esc(TIPOS[e.tipo] || "")}</span>
        <span class="g-titulo">${esc(e.titulo)}</span>
        ${desenho("casa-cheia", "g-casa")}
      </span>`;

  /* ---------- Topo e rodapé ---------- */
  const navAtual = p => (pagina === p ? ' aria-current="page"' : "");
  const inicio = pagina === "inicio" ? "" : "/modelos/cafe-sergipano/";
  document.body.insertAdjacentHTML("afterbegin", `
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <header class="topo">
      <div class="miolo">
        <a class="marca marca-txt" href="/modelos/cafe-sergipano/" aria-label="Café Sergipano, página inicial" translate="no">café sergipano</a>
        <span class="aberto" id="aberto"><i></i><span class="txt"></span></span>
        <nav id="menu" aria-label="Principal">
          <a href="${inicio}#agenda"${navAtual("evento")}>Agenda</a>
          <a href="${inicio}#cardapio">Cardápio</a>
          <a href="${inicio}#vila">O café</a>
          <a href="${inicio}#duvidas">Dúvidas</a>
        </nav>
        <button class="menu-bt" aria-controls="menu" aria-expanded="false" aria-label="Abrir menu"><span></span></button>
      </div>
    </header>`);

  // aberto agora, pelo horário cadastrado
  (() => {
    const chip = $("#aberto"), hs = D.config.horario || [];
    if (!hs.length) { chip.remove(); return; }
    const min = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
    const fmt = s => (s === "24:00" || s === "00:00" ? "meia-noite" : hora(s));
    const n = new Date(), hoje = n.getDay(), agora = n.getHours() * 60 + n.getMinutes();
    const t = hs.find(x => x.dias.includes(hoje));
    if (t && agora >= min(t.abre) && agora < min(t.fecha)) {
      chip.classList.add("sim");
      $(".txt", chip).innerHTML = `Aberto agora<span class="txt-longo">, fecha ${fmt(t.fecha) === "meia-noite" ? "à" : "às"} ${fmt(t.fecha)}</span>`;
    } else {
      let i = 0, prox;
      for (; i < 8 && !prox; i++) { const d = (hoje + i) % 7, tt = hs.find(x => x.dias.includes(d)); if (tt && (i > 0 || agora < min(tt.abre))) prox = tt; }
      i--;
      const quando = i === 0 ? "hoje" : i === 1 ? "amanhã" : fSem.format(new Date(n.getFullYear(), n.getMonth(), n.getDate() + i)).replace("-feira", "");
      $(".txt", chip).innerHTML = `Fechado<span class="txt-longo">, abre ${quando} às ${fmt(prox.abre)}</span>`;
    }
  })();

  const rotuloDias = dias => {
    const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const ds = [...dias].sort((a, b) => a - b);
    const seguidos = ds.every((d, i) => !i || d === ds[i - 1] + 1);
    if (ds.length === 1) return nomes[ds[0]];
    if (ds.length === 2 || !seguidos) return ds.map((d, i) => (i ? nomes[d].toLowerCase() : nomes[d])).join(", ").replace(/, ([^,]+)$/, " e $1");
    return `${nomes[ds[0]]} a ${nomes[ds[ds.length - 1]].toLowerCase()}`;
  };
  const faixaHora = h => `${hora(h.abre)} ${h.fecha === "24:00" ? "à meia-noite" : "às " + hora(h.fecha)}`;
  const C = D.config;
  document.body.insertAdjacentHTML("beforeend", `
    <footer class="rodape azulejo">
      <div class="miolo">
        <div class="alto">
          <span class="marca marca-txt rodape-marca">café<br>sergipano</span>
          <div>
            <h3>Horário</h3>
            ${(C.horario || []).map(h => `<p>${rotuloDias(h.dias)}: ${faixaHora(h)}</p>`).join("") || "<p>Consulte no Instagram</p>"}
          </div>
          <div>
            <h3>Onde e contato</h3>
            ${C.endereco ? `<p>${esc(C.endereco)}</p>` : ""}
            ${C.mapa ? `<p><a href="${esc(C.mapa)}" target="_blank" rel="noopener">Como chegar</a></p>` : ""}
            ${C.instagram ? `<p><a href="https://instagram.com/${esc(C.instagram)}" target="_blank" rel="noopener">@${esc(C.instagram)}</a></p>` : ""}
            ${C.whatsapp ? `<p><a href="${esc(C.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></p>` : ""}
          </div>
        </div>
        <div class="baixo">
          <span>Café Sergipano é uma marca fictícia.</span>
          <span>Modelo de site feito pela <a href="/servicos" target="_top">MARATU</a></span>
        </div>
      </div>
    </footer>`);

  const bt = $(".menu-bt");
  bt.addEventListener("click", () => {
    const aberto = document.body.classList.toggle("menu-aberto");
    bt.setAttribute("aria-expanded", aberto);
    bt.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
  });
  $("#menu").addEventListener("click", e => { if (e.target.closest("a")) { document.body.classList.remove("menu-aberto"); bt.setAttribute("aria-expanded", "false"); } });

  const main = $("main");
  if (main) main.insertAdjacentHTML("beforebegin", '<span id="conteudo"></span>');

  /* ---------- Capa (foto cadastrada) ---------- */
  const abertura = $(".abertura");
  if (abertura && C.capa) { abertura.classList.add("com-foto"); abertura.style.setProperty("--foto", `url("${C.capa}")`); }

  /* ---------- Agenda ---------- */
  const eventos = L.eventosVisiveis(D);
  const urlEvento = e => `/modelos/cafe-sergipano/evento.html?e=${encodeURIComponent(e.id)}`;

  const proximos = $("#proximos");
  if (proximos) {
    const lista = eventos.slice(0, 8);
    const sec = proximos.closest("section");
    if (!lista.length) {
      sec.querySelector(".trilho-wrap").outerHTML = `<p class="vazio miolo">Programação em breve.</p>`;
      const nav = sec.querySelector(".trilho-nav"); if (nav) nav.remove();
    } else {
      proximos.innerHTML = lista.map(e => {
        const d = data(e.data), s = situacao(e);
        return `<li><a class="peca" href="${urlEvento(e)}">
          <span class="peca-arte">${cartaz(e)}${s ? `<span class="selo ${s.cls}">${s.txt}</span>` : ""}</span>
          <span class="peca-quando">${quandoTxt(e, d)}</span>
          <span class="peca-titulo">${esc(e.titulo)}</span>
          ${precoTxt(e) ? `<span class="peca-preco">${precoTxt(e)}</span>` : ""}
        </a></li>`;
      }).join("");
      const trilho = proximos;
      const passo = () => trilho.querySelector("li").offsetWidth + 20;
      sec.querySelectorAll("[data-trilho]").forEach(b => b.addEventListener("click", () => trilho.scrollBy({ left: passo() * (b.dataset.trilho === "prox" ? 1 : -1), behavior: semMovimento ? "auto" : "smooth" })));
      const atualiza = () => {
        const a = sec.querySelector('[data-trilho="ant"]'), p = sec.querySelector('[data-trilho="prox"]');
        a.disabled = trilho.scrollLeft < 8;
        p.disabled = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 8;
        sec.querySelector(".trilho-nav").hidden = a.disabled && p.disabled;
      };
      trilho.addEventListener("scroll", atualiza, { passive: true }); addEventListener("resize", atualiza); requestAnimationFrame(atualiza);
    }
  }

  const lista = $("#lista");
  if (lista) {
    const sec = lista.closest(".agenda-completa");
    if (!eventos.length) sec.hidden = true;
    else {
      lista.innerHTML = eventos.map(e => {
        const d = data(e.data), s = situacao(e);
        const acao = s && s.cls === "esgotado" ? `<span class="pilula acao esgotado">Esgotado</span>`
          : `<span class="pilula acao">${precoTxt(e) || "Ver detalhes"}${seta()}</span>`;
        return `<li data-tipo="${e.tipo}"><a class="linha-agenda" href="${urlEvento(e)}">
          <span class="pilula quando"><b>${d.dia} ${d.mes}</b><span>${[d.sem3, hora(e.inicio)].filter(Boolean).join(", ")}</span></span>
          <span class="pilula tipo t-${e.tipo}">${TIPOS[e.tipo]}</span>
          <span class="pilula titulo"><span>${esc(e.titulo)}</span>${s && s.cls === "ultimas" ? `<small>${s.txt}</small>` : ""}</span>
          ${acao}
        </a></li>`;
      }).join("");
      const tipos = [...new Set(eventos.map(e => e.tipo))];
      const f = $("#filtros");
      if (tipos.length > 1) {
        const nomes = { oficina: "Oficinas", festa: "Festas" };
        f.innerHTML = [["", "Tudo"], ...tipos.map(t => [t, nomes[t]])].map(([v, n], i) => `<button class="filtro" type="button" aria-pressed="${i === 0}" data-tipo="${v}">${n}</button>`).join("");
        f.addEventListener("click", ev => {
          const b = ev.target.closest(".filtro"); if (!b) return;
          $$(".filtro", f).forEach(x => x.setAttribute("aria-pressed", x === b));
          $$("li", lista).forEach(li => (li.hidden = !!b.dataset.tipo && li.dataset.tipo !== b.dataset.tipo));
        });
      } else f.remove();
    }
  }

  /* ---------- Cardápio ---------- */
  const card = $("#cardapio-conteudo");
  if (card) {
    const secoes = D.cardapio.map(s => ({ ...s, itens: s.itens.filter(i => i.disponivel !== false) })).filter(s => s.itens.length);
    if (!secoes.length) {
      card.innerHTML = `<div class="vazio-card">${desenho("vilo-selo", "vazio-vilo")}<p>Cardápio em breve.</p></div>`;
    } else {
      card.innerHTML = `
        <div class="abas" role="tablist" aria-label="Seções do cardápio">${secoes.map((s, i) => `<button class="filtro" role="tab" id="aba-${s.id}" aria-controls="sec-${s.id}" aria-selected="${i === 0}" aria-pressed="${i === 0}">${esc(s.nome)}</button>`).join("")}</div>
        ${secoes.map((s, i) => `<ul class="itens" role="tabpanel" id="sec-${s.id}" aria-labelledby="aba-${s.id}"${i ? " hidden" : ""}>
          ${s.itens.map(it => `<li class="item${it.foto ? " com-foto" : ""}">
            ${it.foto ? `<img src="${esc(it.foto)}" alt="" loading="lazy" width="96" height="96">` : ""}
            <span class="item-txt"><span class="item-nome">${esc(it.nome)}</span>${it.descricao ? `<span class="item-desc">${esc(it.descricao)}</span>` : ""}</span>
            <span class="item-preco">${it.preco ? reais(Number(it.preco)) : ""}</span>
          </li>`).join("")}
        </ul>`).join("")}`;
      $(".abas", card).addEventListener("click", ev => {
        const b = ev.target.closest("[role=tab]"); if (!b) return;
        $$("[role=tab]", card).forEach(x => { const on = x === b; x.setAttribute("aria-selected", on); x.setAttribute("aria-pressed", on); $("#" + x.getAttribute("aria-controls")).hidden = !on; });
      });
    }
  }

  /* ---------- O café ---------- */
  const sobre = $("#sobre");
  if (sobre) { if (C.sobre) sobre.innerHTML = linhas(C.sobre).map(p => `<p>${esc(p)}</p>`).join(""); else sobre.remove(); }
  const fotos = $("#fotos");
  if (fotos) {
    const fs = (C.fotos || []).slice(0, 7);
    if (fs.length) { fotos.innerHTML = fs.map((f, i) => `<figure class="foto f${i}"><img src="${esc(f)}" alt="" loading="lazy" decoding="async"></figure>`).join(""); fotos.dataset.n = fs.length; }
    else fotos.remove();
  }
  const hor = $("#horario");
  if (hor) {
    const hs = C.horario || [], hoje = new Date().getDay();
    const fechados = [0, 1, 2, 3, 4, 5, 6].filter(d => !hs.some(h => h.dias.includes(d)));
    hor.innerHTML = `<h3>Horário</h3>` + hs.map(h => `<div${h.dias.includes(hoje) ? ' class="hoje"' : ""}><span>${rotuloDias(h.dias)}</span><span>${faixaHora(h)}</span></div>`).join("")
      + (fechados.length ? `<div${fechados.includes(hoje) ? ' class="hoje"' : ""}><span>${fechados.length === 1 ? rotuloDias(fechados) : "Outros dias"}</span><span>Fechado</span></div>` : "");
  }
  const comunidade = $("#comunidade");
  if (comunidade) { if (C.comunidade) comunidade.querySelector("a").href = C.comunidade; else comunidade.remove(); }

  /* ---------- Dúvidas ---------- */
  const faq = $("#faq");
  if (faq) {
    faq.innerHTML = D.duvidas.map(q => `<details><summary>${esc(q.p)}</summary><div class="resp"><p>${esc(q.r)}</p></div></details>`).join("");
    $$("details", faq).forEach(det => {
      const resp = $(".resp", det);
      $("summary", det).addEventListener("click", ev => {
        if (semMovimento) return;
        ev.preventDefault();
        if (det.open) resp.animate([{ height: resp.offsetHeight + "px" }, { height: "0px" }], { duration: 240, easing: "cubic-bezier(.4,0,.2,1)" }).onfinish = () => (det.open = false);
        else { det.open = true; resp.animate([{ height: "0px" }, { height: resp.offsetHeight + "px" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" }); }
      });
    });
  }

  /* ---------- Página do evento ---------- */
  if (pagina === "evento") {
    const e = D.eventos.find(x => x.id === params.get("e") && x.publicado);
    const alvo = $("#evento");
    if (!e || L.status(e) === "encerrado") {
      document.title = "Evento encerrado | Café Sergipano";
      alvo.innerHTML = `<section class="secao"><div class="miolo vazio-evento">${desenho("vilo-oculos", "vazio-vilo")}<h1 class="t2">${e ? "Esse evento já passou" : "Evento não encontrado"}</h1><a class="bt" href="/modelos/cafe-sergipano/#agenda">Ver a agenda</a></div></section>`;
    } else {
      const d = data(e.data), st = L.status(e), r = L.restantes(e);
      const pago = Number(e.preco) > 0;
      document.title = `${e.titulo} | Café Sergipano`;
      const acao = st === "esgotado"
        ? `<button class="bt" type="button" id="abre-espera">Entrar na lista de espera</button>`
        : e.sympla ? `<a class="bt" href="${esc(e.sympla)}" target="_blank" rel="noopener">Garantir vaga no Sympla</a>`
        : `<a class="bt" href="${esc(C.mapa || "#")}" target="_blank" rel="noopener">Como chegar</a>`;
      const bloco = (t, v, lista) => (lista ? linhas(v).length : v) ? `<div class="bloco"><h2>${t}</h2>${lista ? `<ul>${linhas(v).map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p>${esc(v)}</p>`}</div>` : "";
      const corpo = bloco("O que você vai fazer", e.fazer, true) + bloco("Está incluso", e.inclui, true) + bloco("O que levar", e.levar) + bloco("Quem conduz", e.conduz);
      alvo.innerHTML = `
        <section class="ev-topo">
          <div class="miolo">
            <div class="ev-arte">${cartaz(e, "grande")}</div>
            <div class="ev-texto">
              <a class="voltar" href="/modelos/cafe-sergipano/#agenda"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Agenda</a>
              <span class="pilula tipo t-${e.tipo}">${TIPOS[e.tipo]}${e.categoria && e.categoria !== TIPOS[e.tipo] ? `, ${esc(e.categoria)}` : ""}</span>
              <h1 class="t1 ev-titulo">${esc(e.titulo)}</h1>
              ${e.resumo ? `<p class="lead">${esc(e.resumo)}</p>` : ""}
              <dl class="ficha">
                <div><dt>Quando</dt><dd>${d.semana}, ${d.dia} de ${d.mes}</dd></div>
                ${e.inicio ? `<div><dt>Horário</dt><dd>${hora(e.inicio)}${e.fim ? ` às ${hora(e.fim)}` : ""}</dd></div>` : ""}
                ${precoTxt(e) ? `<div><dt>Valor</dt><dd>${precoTxt(e)}</dd></div>` : ""}
                ${r !== null ? `<div><dt>Vagas</dt><dd>${st === "esgotado" ? "Esgotado" : `${r} de ${e.vagas}`}</dd></div>` : ""}
              </dl>
              <div class="ev-acoes">${acao}<button class="link-sec compartilhar" type="button" aria-live="polite">Copiar link</button></div>
              ${st === "esgotado" ? `<form class="espera" id="espera" hidden novalidate>
                <div class="campo"><label for="esp-nome">Nome</label><input id="esp-nome" name="nome" autocomplete="name" required></div>
                <div class="campo"><label for="esp-tel">WhatsApp</label><input id="esp-tel" name="telefone" type="tel" inputmode="tel" autocomplete="tel" required></div>
                <p class="erro" role="alert"></p>
                <button class="bt" type="submit">Entrar na lista</button>
              </form>` : ""}
            </div>
          </div>
        </section>
        ${corpo ? `<section class="secao ev-corpo"><div class="miolo">${corpo}</div></section>` : ""}
        <div class="barra-compra">
          <div><b>${precoTxt(e) || esc(e.titulo)}</b><small>${quandoTxt(e, d)}</small></div>
          ${acao}
        </div>`;
      $(".compartilhar").addEventListener("click", async ev => {
        const b = ev.currentTarget;
        try {
          if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: e.titulo, url: location.href });
          else { await navigator.clipboard.writeText(location.href); b.textContent = "Link copiado"; setTimeout(() => (b.textContent = "Copiar link"), 2200); }
        } catch (_) {}
      });
      const fEsp = $("#espera");
      if (fEsp) {
        $$("#abre-espera").forEach(b => b.addEventListener("click", () => { fEsp.hidden = false; $("#esp-nome").focus(); fEsp.scrollIntoView({ block: "center", behavior: semMovimento ? "auto" : "smooth" }); }));
        fEsp.addEventListener("submit", ev => {
          ev.preventDefault();
          const nome = fEsp.nome.value.trim(), tel = fEsp.telefone.value.replace(/\D/g, "");
          const err = $(".erro", fEsp);
          if (!nome) { err.textContent = "Falta o nome."; fEsp.nome.focus(); return; }
          if (tel.length < 10) { err.textContent = "Confira o número do WhatsApp."; fEsp.telefone.focus(); return; }
          L.entrarEspera(e.id, { nome, telefone: tel });
          fEsp.outerHTML = `<p class="espera-ok" role="status">Você está na lista de espera.</p>`;
          $$("#abre-espera").forEach(b => b.remove());
        });
      }
      const barra = $(".barra-compra");
      new IntersectionObserver(([en]) => barra.classList.toggle("visivel", !en.isIntersecting && en.boundingClientRect.top < 0)).observe($(".ev-acoes"));
    }
  }

  /* ---------- Botões: texto que rola + círculo de seta ---------- */
  const montaBotoes = (raiz = document) => $$(".bt:not([data-ok])", raiz).forEach(b => {
    b.dataset.ok = 1;
    const txt = b.textContent.trim();
    b.innerHTML = `<span class="bt-txt"><span>${txt}</span><span aria-hidden="true">${txt}</span></span>` + (b.classList.contains("sem-ico") ? "" : `<span class="bt-ico" aria-hidden="true">${seta()}</span>`);
    requestAnimationFrame(() => b.style.setProperty("--cresce", Math.ceil((b.offsetWidth * 2.2) / 44)));
  });
  montaBotoes();

  /* ---------- Aviso de demonstração ---------- */
  

  window.VILA_UTIL = { data, reais, hora, esc, desenho, cartaz, situacao, montaBotoes, semMovimento, $, $$ };

  
})();
