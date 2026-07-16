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

  /* ---- botao na aba Marketing (pedido do Rapha: la, nao em Ajustes) ---- */
  function addMarketingBtn() {
    var panel = $id("panel-marketing");
    if (!panel || $id("mktNews")) return;
    var bar = document.createElement("div");
    bar.id = "mktNewsBar";
    bar.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px;";
    bar.innerHTML = '<h2 class="title" style="margin:0;">Newsletter</h2>'
      + '<button type="button" class="btn blue" id="mktNews">✉️ Contatos &amp; envio</button>';
    panel.insertBefore(bar, panel.firstElementChild);
    bar.querySelector("#mktNews").addEventListener("click", openNews);
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
      + '<label class="f"><span>Assunto do email</span><input id="nwAssunto" placeholder="ex: Novidades fresquinhas do mangue 🦀" /></label>'
      + '<label class="f"><span>Título (opcional)</span><input id="nwTitulo" placeholder="ex: Chegou a coleção nova" /></label>'
      + '<label class="f"><span>Texto</span><textarea id="nwTexto" rows="6" placeholder="Escreve como quiser — linha em branco separa parágrafos."></textarea></label>'
      + '<label class="f"><span>URL da imagem (opcional)</span><input id="nwImagem" placeholder="cola o link de uma imagem (R2/site)" /></label>'
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

  /* "Enviar pra todos" pede confirmacao no 2o clique */
  var confirmando = false, confirmTimer = null;
  function wireEnviarTodos(btn) {
    btn.addEventListener("click", function () {
      if (!confirmando) {
        var p = payload(false);
        if (!p.assunto || !p.texto) { $id("nwMsg").textContent = "precisa de assunto e texto"; return; }
        confirmando = true;
        btn.textContent = "Confirmar envio?";
        btn.style.background = "var(--laranja, #C8501A)";
        confirmTimer = setTimeout(resetEnviarTodos, 5000);
        return;
      }
      clearTimeout(confirmTimer);
      enviar(false);
    });
  }
  function resetEnviarTodos() {
    confirmando = false;
    var btn = $id("nwEnviar");
    if (btn) { btn.textContent = "Enviar pra todos" + (cache ? " (" + cache.ativos + ")" : ""); btn.style.background = ""; }
  }

  /* boot */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addMarketingBtn);
  else addMarketingBtn();
  setTimeout(addMarketingBtn, 1500);
})();
