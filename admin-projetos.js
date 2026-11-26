/* MARATU admin — aba "Projetos": clientes do portal (maratu.com.br/projetos), projetos de site,
   envio da pasta do site, notas dos clientes (comentários e caneta) com resposta.
   Fala com o Worker em /api/projetos* (checkAuth). Não toca no admin.js minificado:
   cria a aba e o painel e replica a troca de abas. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuProjetos) return;
  window.__maratuProjetos = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var SITE = "https://maratu.com.br";
  var dados = { clientes: [], projetos: [] };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function quando(iso) {
    if (!iso) return "";
    var d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + ", " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function api(caminho, op) {
    op = op || {};
    op.headers = op.headers || {};
    if (!op.headers.Authorization) op.headers.Authorization = "Bearer ";
    return fetch(API + caminho, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || j.error || ("erro " + r.status)); return j; }); });
  }
  function toast(txt) {
    var t = document.createElement("div");
    t.className = "apj-toast"; t.textContent = txt;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 300); }, 2600);
  }

  /* ---------- estilo ---------- */
  var css = document.createElement("style");
  css.textContent = [
    "#panel-projetos,.apj-modal{--a:#F0ECE4;--p:#0D0D0B;--l:#C8501A;--d:#D4960A}",
    ".apj-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 14px}",
    ".apj-topo h2{margin:0;font-family:inherit;font-weight:900;font-size:22px;letter-spacing:-.01em}",
    ".apj-sub{margin:26px 0 10px;font-family:inherit;font-weight:900;font-size:17px;display:flex;align-items:center;gap:8px}",
    ".apj-sub small{opacity:.5;font-weight:700;font-size:13px}",
    ".apj-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 14px;border:1.5px solid var(--p);border-radius:999px;background:var(--a);color:var(--p);font-family:inherit;font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:2px 2px 0 0 var(--p);text-decoration:none;white-space:nowrap;transition:transform .12s cubic-bezier(.23,1,.32,1),box-shadow .12s cubic-bezier(.23,1,.32,1)}",
    ".apj-btn:active{transform:translate(2px,2px);box-shadow:0 0 0 0 var(--p)}",
    ".apj-btn--pri{background:var(--d)}",
    ".apj-btn--leve{box-shadow:none;background:none}",
    ".apj-btn:disabled{opacity:.5;cursor:default}",
    ".apj-btn:focus-visible,.apj-card:focus-visible{outline:2px solid var(--l);outline-offset:2px}",
    ".apj-lista{display:grid;gap:10px}",
    ".apj-card{background:#fff;color:var(--p);border:1.5px solid var(--p);border-radius:16px;padding:14px 16px;display:grid;gap:8px}",
    ".apj-card__l1{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}",
    ".apj-card__nome{font-weight:900;font-size:17px;letter-spacing:-.01em}",
    ".apj-card__meta{font-size:13px;opacity:.65;display:flex;gap:10px;flex-wrap:wrap;font-variant-numeric:tabular-nums}",
    ".apj-card__acoes{display:flex;gap:8px;flex-wrap:wrap}",
    "@media (max-width:720px){.apj-toast{bottom:calc(96px + env(safe-area-inset-bottom))}}",
    ".apj-chip{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:#F0ECE4;font-size:12.5px;font-weight:700}",
    ".apj-chip--alerta{background:var(--l);color:#fff}",
    ".apj-vazio{padding:18px;border:1.5px dashed rgba(13,13,11,.35);border-radius:14px;font-size:14px;opacity:.7;color:inherit}",
    ".apj-modal{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(13,13,11,.55);padding:16px}",
    ".apj-modal.on{display:flex}",
    ".apj-caixa{background:#F0ECE4;color:#0D0D0B;border:2px solid #0D0D0B;border-radius:20px;box-shadow:8px 8px 0 0 #0D0D0B;width:100%;max-width:520px;max-height:92vh;overflow:auto;padding:20px}",
    ".apj-caixa h3{margin:0;font-family:inherit;font-weight:900;font-size:20px}",
    ".apj-caixa__topo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}",
    ".apj-x{min-width:44px;min-height:44px;border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:#0D0D0B;border-radius:999px}",
    ".apj-campo{display:grid;gap:5px;margin-top:12px;font-size:12px;font-weight:800;opacity:.85}",
    ".apj-campo input,.apj-campo textarea{width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #0D0D0B;border-radius:10px;background:#fff;font-family:inherit;font-size:16px;font-weight:400;color:#0D0D0B}",
    ".apj-marca{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border:1.5px solid rgba(13,13,11,.25);border-radius:12px;background:#fff;font-size:14px;cursor:pointer}",
    ".apj-marca input{width:20px;height:20px;accent-color:#C8501A}",
    ".apj-marca small{opacity:.6}",
    ".apj-marcas{display:grid;gap:6px;margin-top:6px;max-height:240px;overflow:auto}",
    ".apj-rodape{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}",
    ".apj-nota{background:#fff;border:1.5px solid #0D0D0B;border-radius:14px;padding:12px 14px;display:grid;gap:6px}",
    ".apj-nota.feita{opacity:.6}",
    ".apj-nota__meta{font-size:12.5px;opacity:.65;display:flex;gap:8px;flex-wrap:wrap}",
    ".apj-nota__txt{font-size:15px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".apj-nota img{max-width:100%;max-height:200px;border-radius:8px;border:1px solid rgba(13,13,11,.2);justify-self:start}",
    ".apj-nota__resp{display:flex;gap:6px}",
    ".apj-nota__resp input{flex:1;min-width:0;padding:9px 10px;border:1.5px solid #0D0D0B;border-radius:10px;font-family:inherit;font-size:16px}",
    ".apj-prog{margin-top:12px;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}",
    ".apj-toast{position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100000;background:#0D0D0B;color:#F0ECE4;font-size:13px;font-weight:700;padding:12px 18px;border-radius:12px;box-shadow:3px 3px 0 0 #C8501A;max-width:88vw;text-align:center;transition:opacity .3s}",
  ].join("\n");
  document.head.appendChild(css);

  /* ---------- aba e painel ---------- */
  function montaAba() {
    var tabs = document.getElementById("tabs");
    var ref = document.getElementById("panel-marketing");
    if (!tabs || !ref || document.getElementById("panel-projetos")) return !!document.getElementById("panel-projetos");
    var mk = tabs.querySelector('[data-tab="marketing"]');
    var b = document.createElement("button");
    b.className = "tab"; b.setAttribute("role", "tab"); b.dataset.tab = "projetos"; b.setAttribute("aria-selected", "false");
    b.innerHTML = '<svg class="tab-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8.5h18"/><path d="M7 13.5l2.5 2-2.5 2M12 17.5h4"/></svg><span class="tab-lbl">Projetos</span>';
    if (mk && mk.nextSibling) tabs.insertBefore(b, mk.nextSibling); else tabs.appendChild(b);
    var sec = document.createElement("section");
    sec.className = "panel"; sec.id = "panel-projetos";
    sec.innerHTML =
      '<div class="apj-topo"><h2>Projetos</h2><button type="button" class="apj-btn apj-btn--pri" data-a="novo">+ Novo projeto</button></div>' +
      '<div class="apj-lista" id="apjProjetos"></div>' +
      '<h3 class="apj-sub">Clientes <small id="apjNClientes"></small></h3>' +
      '<div class="apj-lista" id="apjClientes"></div>';
    ref.parentNode.insertBefore(sec, ref.nextSibling);
    b.addEventListener("click", function () {
      document.querySelectorAll("#tabs .tab").forEach(function (t) { t.setAttribute("aria-selected", t === b ? "true" : "false"); });
      document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("on"); });
      sec.classList.add("on");
      try { b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); } catch (e) {}
      carrega();
    });
    sec.addEventListener("click", aoClicar);
    return true;
  }

  function carrega() {
    return api("/api/projetos").then(function (j) { dados = j; pinta(); }).catch(function (e) { toast("Projetos: " + e.message); });
  }
  function clientePor(id) { return dados.clientes.filter(function (c) { return c.id === id; })[0]; }
  function projetosDo(id) { return dados.projetos.filter(function (p) { return p.membros.indexOf(id) >= 0; }); }

  function pinta() {
    var lp = document.getElementById("apjProjetos"), lc = document.getElementById("apjClientes");
    if (!lp) return;
    lp.innerHTML = dados.projetos.length ? dados.projetos.map(function (p) {
      var membros = p.membros.map(clientePor).filter(Boolean);
      return '<div class="apj-card">' +
        '<div class="apj-card__l1"><span class="apj-card__nome">' + esc(p.nome) + '</span>' +
          (p.abertas ? '<span class="apj-chip apj-chip--alerta">' + p.abertas + (p.abertas === 1 ? ' nota aberta' : ' notas abertas') + '</span>' : '') +
          (!p.ativo ? '<span class="apj-chip">Desligado</span>' : '') + '</div>' +
        '<div class="apj-card__meta"><span>/projetos/' + esc(p.slug) + '</span><span>' + (membros.length ? membros.map(function (c) { return esc(c.nome); }).join(", ") : "Sem cliente") + '</span>' +
          (p.ultima ? '<span>última nota ' + quando(p.ultima) + '</span>' : '') + '</div>' +
        '<div class="apj-card__acoes">' +
          '<a class="apj-btn" href="' + SITE + '/projetos/' + esc(p.slug) + '/?k=' + encodeURIComponent(p.chave) + '" target="_blank" rel="noopener">Abrir</a>' +
          '<button type="button" class="apj-btn" data-a="notas" data-s="' + esc(p.slug) + '">Notas ' + (p.abertas + p.feitas) + '</button>' +
          '<button type="button" class="apj-btn" data-a="enviar" data-s="' + esc(p.slug) + '">Enviar site</button>' +
          '<button type="button" class="apj-btn apj-btn--leve" data-a="editar" data-s="' + esc(p.slug) + '">Editar</button>' +
        '</div></div>';
    }).join("") : '<div class="apj-vazio">Nenhum projeto ainda.</div>';

    document.getElementById("apjNClientes").textContent = dados.clientes.length || "";
    lc.innerHTML = dados.clientes.length ? dados.clientes.map(function (c) {
      var ps = projetosDo(c.id);
      var zap = String(c.whatsapp || "").replace(/\D/g, "");
      if (zap && zap.length <= 11) zap = "55" + zap;
      return '<div class="apj-card">' +
        '<div class="apj-card__l1"><span class="apj-card__nome">' + esc(c.nome) + '</span>' + (c.empresa ? '<span>' + esc(c.empresa) + '</span>' : '') +
          (ps.length ? '' : '<span class="apj-chip apj-chip--alerta">Sem projeto</span>') + '</div>' +
        '<div class="apj-card__meta"><span>' + esc(c.email) + '</span><span>' + esc(c.whatsapp || "") + '</span><span>cadastro ' + quando(c.criado) + '</span>' +
          (c.ultimo ? '<span>último acesso ' + quando(c.ultimo) + '</span>' : '') + '</div>' +
        (ps.length ? '<div class="apj-card__meta"><span>' + ps.map(function (p) { return esc(p.nome); }).join(", ") + '</span></div>' : '') +
        '<div class="apj-card__acoes">' +
          (ps.length ? '' : '<button type="button" class="apj-btn apj-btn--pri" data-a="novo" data-c="' + esc(c.id) + '">Criar projeto</button>') +
          (zap ? '<a class="apj-btn" href="https://wa.me/' + zap + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
          '<button type="button" class="apj-btn apj-btn--leve" data-a="senha" data-c="' + esc(c.id) + '">Nova senha</button>' +
        '</div></div>';
    }).join("") : '<div class="apj-vazio">Ninguém se cadastrou ainda. O endereço é maratu.com.br/projetos</div>';
  }

  /* ---------- modal genérico ---------- */
  var modal = document.createElement("div");
  modal.className = "apj-modal";
  modal.innerHTML = '<div class="apj-caixa" role="dialog" aria-modal="true"></div>';
  var caixa = modal.firstChild;
  modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest(".apj-x")) fecha(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("on")) fecha(); });
  function abre(titulo, html) {
    if (!modal.isConnected) document.body.appendChild(modal);
    caixa.innerHTML = '<div class="apj-caixa__topo"><h3>' + esc(titulo) + '</h3><button type="button" class="apj-x" aria-label="Fechar">×</button></div>' + html;
    modal.classList.add("on");
    var f = caixa.querySelector("input,textarea"); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function fecha() { modal.classList.remove("on"); }

  /* ---------- projeto: criar e editar ---------- */
  function slugDe(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
  function formProjeto(slug, clienteInicial) {
    var p = slug ? dados.projetos.filter(function (x) { return x.slug === slug; })[0] : null;
    var c0 = clienteInicial ? clientePor(clienteInicial) : null;
    var membros = p ? p.membros : (c0 ? [c0.id] : []);
    var nome = p ? p.nome : (c0 ? (c0.empresa || c0.nome) : "");
    abre(p ? "Editar projeto" : "Novo projeto",
      '<label class="apj-campo">Nome do projeto<input id="apjNome" value="' + esc(nome) + '" placeholder="Café Botânico" autocomplete="off"></label>' +
      '<label class="apj-campo">Endereço<input id="apjSlug" value="' + esc(p ? p.slug : slugDe(nome)) + '"' + (p ? ' disabled' : '') + ' autocomplete="off" spellcheck="false"></label>' +
      '<div class="apj-campo">Clientes com acesso<div class="apj-marcas">' + (dados.clientes.length ? dados.clientes.map(function (c) {
        return '<label class="apj-marca"><input type="checkbox" value="' + esc(c.id) + '"' + (membros.indexOf(c.id) >= 0 ? " checked" : "") + '><span>' + esc(c.nome) + (c.empresa ? ' <small>' + esc(c.empresa) + '</small>' : '') + '</span></label>';
      }).join("") : '<span style="font-weight:400;opacity:.7">Nenhum cliente cadastrado.</span>') + '</div></div>' +
      (p ? '<label class="apj-marca" style="margin-top:12px"><input type="checkbox" id="apjAtivo"' + (p.ativo ? " checked" : "") + '><span>Projeto ligado</span></label>' : '') +
      '<div class="apj-rodape"><button type="button" class="apj-btn apj-btn--leve apj-x" style="font-size:13.5px">Cancelar</button><button type="button" class="apj-btn apj-btn--pri" id="apjSalvar">Salvar</button></div>');
    var fNome = caixa.querySelector("#apjNome"), fSlug = caixa.querySelector("#apjSlug");
    var mexeuSlug = !!p;
    fSlug.addEventListener("input", function () { mexeuSlug = true; });
    fNome.addEventListener("input", function () { if (!mexeuSlug) fSlug.value = slugDe(fNome.value); });
    caixa.querySelector("#apjSalvar").addEventListener("click", function (e) {
      var btn = e.currentTarget; btn.disabled = true;
      var corpo = {
        novo: !p, slug: p ? p.slug : slugDe(fSlug.value), nome: fNome.value.trim(),
        membros: Array.prototype.map.call(caixa.querySelectorAll(".apj-marcas input:checked"), function (i) { return i.value; }),
      };
      var at = caixa.querySelector("#apjAtivo"); if (at) corpo.ativo = at.checked;
      api("/api/projetos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
        .then(function () { fecha(); toast(p ? "Projeto salvo" : "Projeto criado"); return carrega(); })
        .catch(function (er) { toast(er.message); btn.disabled = false; });
    });
  }

  /* ---------- enviar a pasta do site ---------- */
  function formEnviar(slug) {
    abre("Enviar site",
      '<p style="margin:0;font-size:14px;line-height:1.45">Pasta com o index.html na raiz. Substitui a versão atual.</p>' +
      '<div class="apj-rodape" style="justify-content:flex-start"><label class="apj-btn apj-btn--pri">Escolher pasta<input type="file" id="apjPasta" webkitdirectory directory multiple hidden></label></div>' +
      '<div class="apj-prog" id="apjProg" role="status"></div>');
    caixa.querySelector("#apjPasta").addEventListener("change", function (e) {
      var arqs = Array.prototype.filter.call(e.target.files, function (f) { return !/(^|\/)\./.test(f.webkitRelativePath || f.name); });
      var prog = caixa.querySelector("#apjProg");
      if (!arqs.length) return;
      // tira a pasta de cima: "cafe/index.html" vira "index.html"
      var rel = function (f) { var r = f.webkitRelativePath || f.name; return r.indexOf("/") >= 0 ? r.slice(r.indexOf("/") + 1) : r; };
      if (!arqs.some(function (f) { return rel(f) === "index.html"; })) { prog.textContent = "Falta o index.html na raiz da pasta."; return; }
      var feitos = 0, erros = 0;
      Promise.resolve().then(function () {
        var fila = arqs.slice();
        function proximo() {
          var f = fila.shift(); if (!f) return Promise.resolve();
          return fetch(API + "/api/projetos/" + slug + "/arquivo?c=" + encodeURIComponent(rel(f)), { method: "PUT", headers: { Authorization: "Bearer " }, body: f })
            .then(function (r) { if (!r.ok) erros++; }).catch(function () { erros++; })
            .then(function () { feitos++; prog.textContent = "Enviando " + feitos + " de " + arqs.length; return proximo(); });
        }
        return Promise.all([proximo(), proximo(), proximo(), proximo()]);
      }).then(function () {
        prog.textContent = erros ? erros + " arquivo(s) falharam. Envie de novo." : arqs.length + " arquivos no ar.";
        if (!erros) toast("Site enviado");
      }).catch(function (er) { prog.textContent = er.message; });
    });
  }

  /* ---------- notas do projeto ---------- */
  function formNotas(slug) {
    var p = dados.projetos.filter(function (x) { return x.slug === slug; })[0];
    abre("Notas de " + (p ? p.nome : slug), '<div class="apj-lista" id="apjNotas"><div class="apj-vazio">Carregando…</div></div>');
    api("/api/projetos/" + slug + "/notas").then(function (j) {
      var ns = (j.notas || []).map(function (n, i) { n.n = i + 1; return n; }).reverse();
      ns.sort(function (a, b) { return (a.status === "feita") - (b.status === "feita"); });
      var box = caixa.querySelector("#apjNotas");
      if (!box) return;
      box.innerHTML = ns.length ? ns.map(function (n) {
        return '<div class="apj-nota' + (n.status === "feita" ? " feita" : "") + '" data-id="' + esc(n.id) + '">' +
          '<div class="apj-nota__meta"><b>' + n.n + '</b><span>' + esc(n.autor) + '</span><span>' + quando(n.criado) + '</span><span>' + esc(n.pagina || "/") + '</span>' +
            (n.tipo === "desenho" ? '<span>caneta</span>' : '') + (n.vista ? '<span>' + (Number(n.vista.w) | 0) + 'px' + ((Number(n.vista.w) | 0) < 700 ? ', celular' : '') + '</span>' : '') + '</div>' +
          (n.texto ? '<div class="apj-nota__txt">' + esc(n.texto) + '</div>' : '') +
          (n.link && /^https?:\/\//i.test(n.link) ? '<a href="' + esc(n.link) + '" target="_blank" rel="noopener" style="font-weight:700;color:#C8501A;overflow-wrap:anywhere">' + esc(n.link) + '</a>' : '') +
          (n.ancora && n.ancora.txt ? '<div class="apj-nota__meta"><span>em: “' + esc(n.ancora.txt.slice(0, 80)) + '”</span></div>' : '') +
          (n.imagem ? '<img loading="lazy" alt="Referência" data-img="' + esc(n.imagem) + '">' : '') +
          (n.status === "feita"
            ? '<div class="apj-nota__meta"><span>Concluída ' + quando(n.feito_em) + (n.resposta ? ': ' + esc(n.resposta) : '') + '</span></div><div><button type="button" class="apj-btn apj-btn--leve" data-n="reabre">Reabrir</button></div>'
            : '<div class="apj-nota__resp"><input placeholder="O que foi feito (o cliente vê)" maxlength="2000"><button type="button" class="apj-btn apj-btn--pri" data-n="conclui">Concluir</button></div>') +
          '</div>';
      }).join("") : '<div class="apj-vazio">Nenhuma nota.</div>';
      // imagem de referência precisa do token: busca e vira blob
      box.querySelectorAll("img[data-img]").forEach(function (im) {
        fetch(API + "/api/projetos/" + slug + "/imagem/" + encodeURIComponent(im.dataset.img), { headers: { Authorization: "Bearer " } })
          .then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) { if (b) im.src = URL.createObjectURL(b); });
      });
      box.addEventListener("click", function (e) {
        var b = e.target.closest("[data-n]"); if (!b) return;
        var card = b.closest(".apj-nota"), id = card.dataset.id;
        var resp = card.querySelector("input");
        b.disabled = true;
        api("/api/projetos/" + slug + "/notas/" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b.dataset.n === "conclui" ? { status: "feita", resposta: resp ? resp.value.trim() : "" } : { status: "aberta" }) })
          .then(function () { toast(b.dataset.n === "conclui" ? "Nota concluída" : "Nota reaberta"); carrega(); formNotas(slug); })
          .catch(function (er) { toast(er.message); b.disabled = false; });
      });
    }).catch(function (er) { toast(er.message); });
  }

  /* ---------- senha nova ---------- */
  function novaSenha(id) {
    var c = clientePor(id); if (!c) return;
    abre("Nova senha", '<p style="margin:0;font-size:15px;line-height:1.45">Gera uma senha nova para <b>' + esc(c.nome) + '</b> e encerra os acessos abertos.</p>' +
      '<div class="apj-rodape"><button type="button" class="apj-btn apj-btn--leve apj-x" style="font-size:13.5px">Cancelar</button><button type="button" class="apj-btn apj-btn--pri" id="apjGera">Gerar senha</button></div>');
    caixa.querySelector("#apjGera").addEventListener("click", function (e) {
      e.currentTarget.disabled = true;
      api("/api/projetos/clientes/" + id + "/senha", { method: "POST" }).then(function (j) {
        var zap = String(c.whatsapp || "").replace(/\D/g, ""); if (zap && zap.length <= 11) zap = "55" + zap;
        var msg = "Olá, " + c.nome.split(" ")[0] + "! Sua senha nova do portal de projetos da MARATU: " + j.senha + "\nEntre em maratu.com.br/projetos";
        abre("Senha gerada", '<p style="margin:0 0 10px;font-size:15px">Senha de <b>' + esc(c.nome) + '</b>:</p>' +
          '<p style="margin:0;font-size:26px;font-weight:900;letter-spacing:.04em;font-variant-numeric:tabular-nums;user-select:all">' + esc(j.senha) + '</p>' +
          '<div class="apj-rodape">' + (zap ? '<a class="apj-btn apj-btn--pri" target="_blank" rel="noopener" href="https://wa.me/' + zap + '?text=' + encodeURIComponent(msg) + '">Mandar no WhatsApp</a>' : '') + '</div>');
      }).catch(function (er) { toast(er.message); });
    });
  }

  function aoClicar(e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.dataset.a;
    if (a === "novo") formProjeto(null, b.dataset.c);
    else if (a === "editar") formProjeto(b.dataset.s);
    else if (a === "enviar") formEnviar(b.dataset.s);
    else if (a === "notas") formNotas(b.dataset.s);
    else if (a === "senha") novaSenha(b.dataset.c);
  }

  // espera o admin montar as abas
  var tentativas = 0;
  (function espera() {
    if (montaAba()) { carrega(); return; }
    if (++tentativas < 60) setTimeout(espera, 250);
  })();
})();
