/* MARATU admin — modulo Newsletter (anexado, nao toca no admin.js minificado).
   Lista propria no D1 (via maratu-api) + compositor e disparo (Brevo = so carteiro invisivel).
   Item "Newsletter" no menu Ajustes -> modal com compositor + contatos.
   O fetch() ja e envelopado pelo admin.js pra injetar o token nas chamadas ao maratu-api. */
(function () {
  "use strict";
  if (window.__maratuNews) return;
  window.__maratuNews = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var cache = null; // { inscritos, total, ativos }

  function $id(x) { return document.getElementById(x); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---- botao "newsletter" na aba Marketing ----
     O layout novo (admin-mkt.js) escondeu o `.mkt-backlog-head`, que era onde o botao morava
     pendurado no "+ nova ideia" — e a newsletter sumiu da tela. Agora ele entra ao lado do
     "Nova ideia" (#mkNova), dentro do card de resumo do Conteudo. O `render()` do admin-mkt
     reescreve o #mkConteudo inteiro, entao um observer reinjeta o botao a cada render. */
  var IC_ENV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><rect x="3" y="5" width="18" height="14" rx="2"/>' +
    '<path d="M3 7l9 6 9-6"/></svg>';

  function criarBtn() {
    var btn = document.createElement("button");
    btn.type = "button"; btn.id = "mktNews";
    btn.addEventListener("click", openNews);
    return btn;
  }

  function addMarketingBtn() {
    var nova = $id("mkNova");
    var atual = $id("mktNews");
    if (nova && nova.parentNode) {                       // layout novo
      if (atual && atual.parentElement === nova.parentElement) return;  // ja esta no lugar
      if (atual) atual.remove();   // nasceu no head antigo (escondido); migra pra ca
      var btn = criarBtn();
      btn.className = "mk-rbtn";
      btn.style.cssText = "background:var(--areia);color:var(--preto);flex:1;";
      btn.innerHTML = IC_ENV + "Newsletter";
      var grp = document.createElement("div");
      grp.style.cssText = "display:flex;gap:8px;align-items:stretch;";
      nova.parentNode.insertBefore(grp, nova);
      nova.style.flex = "1";
      grp.appendChild(nova);
      grp.appendChild(btn);
      return;
    }
    // layout novo existe mas o #mkNova ainda nao renderizou: espera, nao usa o head antigo
    if ($id("mkWrap")) return;
    if (atual) return;
    var novaIdeia = $id("mktToggleNew");                  // layout antigo (fallback)
    if (!novaIdeia) return;
    var b2 = criarBtn();
    b2.className = "mkt-new";
    b2.innerHTML = IC_ENV + " newsletter";
    var g2 = document.createElement("div");
    g2.style.cssText = "display:flex;gap:8px;align-items:center;flex:0 0 auto;";
    novaIdeia.parentNode.insertBefore(g2, novaIdeia);
    g2.appendChild(b2);
    g2.appendChild(novaIdeia);
  }

  function vigiarConteudo() {
    var alvo = $id("mkConteudo") || $id("panel-marketing");
    if (!alvo) return false;
    try {
      new MutationObserver(function () { try { addMarketingBtn(); } catch (e) {} })
        .observe(alvo, { childList: true, subtree: true });
    } catch (e) {}
    return true;
  }

  /* ---- modal ---- */
  function ensureModal() {
    var back = $id("newsBack");
    if (back) return back;
    back = document.createElement("div");
    back.className = "modal-back"; back.id = "newsBack";
    back.innerHTML = '<div class="modal-card" style="max-width:560px;max-height:88vh;overflow-y:auto;">'
      + '<div class="modal-head"><h3>Newsletter</h3>'
      + '<button type="button" class="modal-close" id="nwClose" aria-label="Fechar">&times;</button></div>'
      + '<div id="nwStats" style="font-family:var(--clother);font-size:0.8rem;color:var(--muted);margin:2px 2px 16px;">carregando…</div>'

      + '<div class="form-section-title">Escrever & enviar</div>'
      + '<label class="f"><span>Assunto do email</span><input id="nwAssunto" placeholder="ex: Novidades fresquinhas do mangue" /></label>'
      + '<label class="f"><span>Título (opcional)</span><input id="nwTitulo" placeholder="ex: Chegou a coleção nova" /></label>'
      + '<label class="f"><span>Texto</span><textarea id="nwTexto" rows="6" placeholder="Escreve como quiser — linha em branco separa parágrafos."></textarea></label>'
      + '<label class="f"><span>Imagem (opcional)</span>'
      + '<div style="display:flex;gap:8px;align-items:center;">'
      + '<input id="nwImagem" placeholder="escolha uma imagem ou cole um link" style="flex:1;min-width:0;" />'
      + '<button type="button" class="btn ghost" id="nwImgBtn" style="flex:0 0 auto;white-space:nowrap;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:-2px;margin-right:5px"><path d="M3 8h3l2-2h8l2 2h3v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg>Escolher</button>'
      + '</div>'
      + '<input type="file" id="nwImgFile" accept="image/*" style="display:none;">'
      + '<img id="nwImgPrev" alt="" style="display:none;margin-top:8px;max-width:150px;max-height:110px;object-fit:cover;border-radius:10px;border:1.5px solid rgba(13,13,11,0.25);">'
      + '</label>'
      + '<div class="grid2">'
      + '<label class="f"><span>Texto do botão (opcional)</span><input id="nwBtnTexto" placeholder="ex: Ver na loja" /></label>'
      + '<label class="f"><span>Link do botão</span><input id="nwBtnLink" placeholder="https://maratu.com.br/…" /></label>'
      + '</div>'
      + '<label class="f"><span>Enviar teste pra</span><input id="nwTeste" type="email" placeholder="seu@email.com" /></label>'
      + '<div class="form-actions"><div id="nwMsg" style="font-family:var(--clother);font-size:0.78rem;color:var(--muted);align-self:center;"></div>'
      + '<div class="actions-right">'
      + '<button type="button" class="btn ghost" id="nwEnviarTeste">Enviar teste</button>'
      + '<button type="button" class="btn blue" id="nwEnviar">Enviar pra todos</button>'
      + '</div></div>'

      + '<div class="form-section-title" style="margin-top:18px;">Contatos</div>'
      + '<div id="nwLista" style="max-height:230px;overflow-y:auto;border:1.5px solid rgba(13,13,11,0.18);border-radius:12px;padding:6px 10px;font-family:var(--clother);font-size:0.8rem;"></div>'
      + '<div class="form-actions"><div></div><div class="actions-right">'
      + '<button type="button" class="btn ghost" id="nwCSV">Exportar CSV</button>'
      + '</div></div>'
      + '</div>';
    document.body.appendChild(back);
    back.querySelector("#nwClose").onclick = closeNews;
    back.addEventListener("click", function (e) { if (e.target === back) closeNews(); });
    back.querySelector("#nwCSV").onclick = exportCSV;
    back.querySelector("#nwImgBtn").onclick = function () { back.querySelector("#nwImgFile").click(); };
    back.querySelector("#nwImgFile").addEventListener("change", function () {
      if (this.files && this.files[0]) uploadImagem(this.files[0]);
      this.value = "";
    });
    back.querySelector("#nwImagem").addEventListener("change", function () {
      var pv = $id("nwImgPrev");
      if (this.value.trim()) { pv.src = this.value.trim(); pv.style.display = "block"; }
      else pv.style.display = "none";
    });
    back.querySelector("#nwEnviarTeste").onclick = function () { enviar(true); };
    wireEnviarTodos(back.querySelector("#nwEnviar"));
    return back;
  }
  function closeNews() { var b = $id("newsBack"); if (b) b.classList.remove("on"); }

  function openNews() {
    var back = ensureModal();
    back.classList.add("on");
    carregar();
  }

  /* ---- dados ---- */
  function carregar() {
    $id("nwStats").textContent = "carregando…";
    fetch(API + "/api/newsletter/lista")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        cache = d || { inscritos: [], total: 0, ativos: 0 };
        var fora = cache.total - cache.ativos;
        $id("nwStats").textContent = cache.ativos + " inscrito" + (cache.ativos === 1 ? "" : "s") + " ativo" + (cache.ativos === 1 ? "" : "s") + (fora > 0 ? " (" + (fora === 1 ? "1 saiu" : fora + " saíram") + ")" : "");
        renderLista();
        var b = $id("nwEnviar"); if (b) b.textContent = "Enviar pra todos (" + cache.ativos + ")";
      })
      .catch(function () { $id("nwStats").textContent = "erro ao carregar a lista"; });
  }

  function renderLista() {
    var el = $id("nwLista");
    var list = (cache && cache.inscritos) || [];
    if (!list.length) { el.innerHTML = '<div style="padding:10px 0;color:var(--muted);">Ninguém inscrito ainda.</div>'; return; }
    el.innerHTML = list.map(function (c) {
      var dt = c.ts ? new Date(c.ts).toLocaleDateString("pt-BR") : "";
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(13,13,11,0.08);' + (c.ativo ? "" : "opacity:0.45;") + '">'
        + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">' + esc(c.email) + '</span>'
        + '<span style="color:var(--muted);font-size:0.72rem;flex:0 0 auto;">' + esc(c.origem || "") + (c.origem ? " · " : "") + dt + (c.ativo ? "" : " · saiu") + '</span>'
        + '<button type="button" data-nw-toggle="' + c.id + '" data-nw-ativo="' + (c.ativo ? 1 : 0) + '" style="flex:0 0 auto;border:1px solid rgba(13,13,11,0.3);background:transparent;border-radius:8px;padding:3px 8px;font-size:0.68rem;cursor:pointer;color:inherit;">' + (c.ativo ? "remover" : "reativar") + '</button>'
        + '</div>';
    }).join("");
    el.querySelectorAll("[data-nw-toggle]").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.nwToggle, on = b.dataset.nwAtivo !== "1";
        b.disabled = true;
        fetch(API + "/api/newsletter/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, ativo: on ? 1 : 0 }) })
          .then(function (r) { return r.json(); })
          .then(function () { carregar(); })
          .catch(function () { b.disabled = false; });
      };
    });
  }

  function exportCSV() {
    var list = (cache && cache.inscritos) || [];
    var csv = "email,origem,data,ativo\n" + list.map(function (c) {
      return '"' + String(c.email).replace(/"/g, '""') + '","' + (c.origem || "") + '","' + (c.ts ? new Date(c.ts).toISOString().slice(0, 10) : "") + '",' + (c.ativo ? 1 : 0);
    }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "maratu-newsletter.csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  /* ---- imagem: redimensiona no navegador (foto de celular e gigante/HEIC; email quer JPEG leve) e sobe pro R2 ---- */
  function resizeToJpeg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var MAX = 1200, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, MAX / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("canvas")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("formato de imagem não suportado")); };
      img.src = url;
    });
  }
  function uploadImagem(file) {
    var msg = $id("nwMsg");
    msg.textContent = "preparando imagem…";
    resizeToJpeg(file)
      .then(function (blob) {
        msg.textContent = "enviando imagem…";
        return fetch(API + "/api/newsletter/upload?filename=news.jpg", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.url) {
          $id("nwImagem").value = d.url;
          var pv = $id("nwImgPrev"); pv.src = d.url; pv.style.display = "block";
          msg.textContent = "imagem pronta ✓";
        } else msg.textContent = "erro no upload";
      })
      .catch(function (e) { msg.textContent = "falha: " + e.message; });
  }

  /* ---- envio ---- */
  function payload(teste) {
    var p = {
      assunto: $id("nwAssunto").value.trim(),
      titulo: $id("nwTitulo").value.trim(),
      texto: $id("nwTexto").value.trim(),
      imagem: $id("nwImagem").value.trim(),
      btnTexto: $id("nwBtnTexto").value.trim(),
      btnLink: $id("nwBtnLink").value.trim()
    };
    if (teste) p.teste = $id("nwTeste").value.trim();
    return p;
  }

  function enviar(teste) {
    var msg = $id("nwMsg");
    var p = payload(teste);
    if (!p.assunto || !p.texto) { msg.textContent = "precisa de assunto e texto"; return; }
    if (teste && !p.teste) { msg.textContent = "preenche o email de teste"; return; }
    msg.textContent = teste ? "enviando teste…" : "enviando pra lista…";
    var btns = [$id("nwEnviarTeste"), $id("nwEnviar")];
    btns.forEach(function (b) { b.disabled = true; });
    fetch(API + "/api/newsletter/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) msg.textContent = (teste ? "teste enviado ✓" : "enviado pra " + d.enviados + " de " + d.total + " ✓") + (d.falhas && d.falhas.length ? " · falhas: " + d.falhas.length : "");
        else msg.textContent = "erro: " + ((d && d.error) || "?");
      })
      .catch(function () { msg.textContent = "falha de rede"; })
      .then(function () { btns.forEach(function (b) { b.disabled = false; }); resetEnviarTodos(); });
  }

  /* "Enviar pra todos" abre popup de confirmacao (pedido do Rapha: quase clicou sem querer) */
  function ensureConfirm() {
    var back = $id("nwConfBack");
    if (back) return back;
    back = document.createElement("div");
    back.className = "modal-back"; back.id = "nwConfBack";
    back.style.zIndex = "10060"; /* acima do modal da newsletter */
    back.innerHTML = '<div class="modal-card" style="max-width:370px;">'
      + '<div class="modal-head"><h3>Enviar pra todos?</h3>'
      + '<button type="button" class="modal-close" id="nwConfX" aria-label="Fechar">&times;</button></div>'
      + '<p id="nwConfMsg" style="margin:4px 2px 18px;font-family:var(--clother);color:var(--muted);font-size:0.92rem;line-height:1.55;"></p>'
      + '<div class="form-actions"><div></div><div class="actions-right">'
      + '<button type="button" class="btn ghost" id="nwConfNo">Cancelar</button>'
      + '<button type="button" class="btn blue" id="nwConfYes">Enviar agora</button>'
      + '</div></div></div>';
    document.body.appendChild(back);
    back.querySelector("#nwConfX").onclick = closeConf;
    back.querySelector("#nwConfNo").onclick = closeConf;
    back.addEventListener("click", function (e) { if (e.target === back) closeConf(); });
    return back;
  }
  function closeConf() { var b = $id("nwConfBack"); if (b) b.classList.remove("on"); }
  function wireEnviarTodos(btn) {
    btn.addEventListener("click", function () {
      var p = payload(false);
      if (!p.assunto || !p.texto) { $id("nwMsg").textContent = "precisa de assunto e texto"; return; }
      var back = ensureConfirm();
      var n = cache ? cache.ativos : 0;
      back.querySelector("#nwConfMsg").textContent = 'Vai disparar "' + p.assunto + '" pra ' + n + " inscrito" + (n === 1 ? "" : "s") + ". Tem certeza? Depois de enviado não tem volta.";
      back.querySelector("#nwConfYes").onclick = function () { closeConf(); enviar(false); };
      back.classList.add("on");
    });
  }
  function resetEnviarTodos() {
    var btn = $id("nwEnviar");
    if (btn) btn.textContent = "Enviar pra todos" + (cache ? " (" + cache.ativos + ")" : "");
  }

  /* boot */
  /* o #mkConteudo so nasce quando o admin-mkt monta o layout; tenta ate achar */
  function boot() {
    addMarketingBtn();
    if (vigiarConteudo()) return;
    var t = 0, iv = setInterval(function () {
      t++; addMarketingBtn();
      if (vigiarConteudo() || t > 60) clearInterval(iv);
    }, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
