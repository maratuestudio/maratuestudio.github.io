/* MARATU admin — modulo "Diario" (Diario de Mare). Botao ao lado do Newsletter, na aba
   Marketing. Lista as entradas, escreve com formatacao e publica em /mare/<slug>.
   O texto vai pro D1 (mare_posts) via /api/mare; o Worker renderiza a pagina publica
   injetando na casca /mare/index.html. Imagem sobe pro R2 pelo /api/catalog/upload.
   Nao toca no admin.js minificado. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuMare) return;
  window.__maratuMare = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var PRETO = "#0D0D0B", AREIA = "#F0ECE4", LARANJA = "#C8501A";
  var EDITORIAS = [
    { k: "oficina", lbl: "Oficina", cor: "#C8501A" },
    { k: "prova",   lbl: "Prova",   cor: "#0E3272" },
    { k: "achado",  lbl: "Achado",  cor: "#D4960A" },
    { k: "recado",  lbl: "Recado",  cor: "#0D0D0B" }
  ];

  var posts = [];
  var atual = null;      // post em edicao
  var back = null;

  /* ---------- utils ---------- */
  function $id(x) { return document.getElementById(x); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function hojeISO() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function edInfo(k) {
    for (var i = 0; i < EDITORIAS.length; i++) if (EDITORIAS[i].k === k) return EDITORIAS[i];
    return EDITORIAS[0];
  }
  function toast(txt) {
    var t = document.createElement("div");
    t.textContent = txt;
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100001;background:" +
      PRETO + ";color:" + AREIA + ";padding:11px 18px;border-radius:999px;font-family:var(--clother);" +
      "font-size:13px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.28);";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  var IC = {
    livro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:-2px;margin-right:6px"><path d="M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2H20z"/></svg>',
    neg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg>',
    ita: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="15" height="15"><path d="M15 5h-5M14 19H9M14 5l-4 14"/></svg>',
    tit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M6 5v14M18 5v14M6 12h12"/></svg>',
    dest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M4 6h16M4 12h10M4 18h13"/><path d="M20 11v8"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M3 8h3l2-2h8l2 2h3v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    limpa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M4 20h16M6 16 16 6a2.8 2.8 0 0 1 4 4L10 20z"/></svg>'
  };

  /* ---------- API ---------- */
  function carregar() {
    return fetch(API + "/api/mare", { headers: { Authorization: "Bearer " } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { posts = (d && d.posts) || []; return posts; })
      .catch(function () { posts = []; return posts; });
  }
  function salvar(p) {
    return fetch(API + "/api/mare", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " },
      body: JSON.stringify(p)
    }).then(function (r) { return r.json(); });
  }
  function apagar(slug) {
    return fetch(API + "/api/mare/apagar", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " },
      body: JSON.stringify({ slug: slug })
    }).then(function (r) { return r.json(); });
  }
  // foto de celular vem com 4000px e as vezes em HEIC. Reduz e converte antes de subir,
  // igual o admin-news.js faz — a home ja carrega imagem demais.
  function reduzir(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var MAX = 1600, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, MAX / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("canvas")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("imagem nao suportada")); };
      img.src = url;
    });
  }
  function subirImagem(file) {
    var nome = Date.now() + "-" + slugify(file.name.replace(/\.[^.]+$/, "")) + ".jpg";
    return reduzir(file).then(function (blob) {
      return fetch(API + "/api/catalog/upload?slug=mare&filename=" + encodeURIComponent(nome), {
        method: "POST", headers: { "Content-Type": "image/jpeg", Authorization: "Bearer " },
        body: blob
      });
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.url) throw new Error("upload falhou");
      return d.url;
    });
  }

  /* ---------- limpeza do HTML do editor ----------
     O contenteditable produz <b>, <div>, <span style>, cola de Word e afins. Aqui sai só o
     vocabulário que a página de entrada conhece, senão o texto publicado desmonta o layout. */
  var PERMITIDAS = { P: 1, STRONG: 1, EM: 1, H3: 1, UL: 1, OL: 1, LI: 1, A: 1, BR: 1, FIGURE: 1, IMG: 1, DIV: 1 };
  function limpaNo(no, saida) {
    for (var i = 0; i < no.childNodes.length; i++) {
      var n = no.childNodes[i];
      if (n.nodeType === 3) { saida.push(esc(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      var tag = n.tagName;
      if (tag === "B") tag = "STRONG";
      if (tag === "I") tag = "EM";
      if (tag === "BLOCKQUOTE") tag = "DESTAQUE";
      if (tag === "DIV" && n.classList.contains("destaque")) tag = "DESTAQUE";
      if (tag === "SPAN" || tag === "FONT") {
        // Safari as vezes aplica negrito/italico como span com style em vez de <b>/<i>
        var st = (n.getAttribute("style") || "").toLowerCase();
        var d2 = []; limpaNo(n, d2); var t2 = d2.join("");
        if (/font-weight:\s*(bold|[6-9]00)/.test(st)) t2 = "<strong>" + t2 + "</strong>";
        if (/font-style:\s*italic/.test(st)) t2 = "<em>" + t2 + "</em>";
        saida.push(t2);
        continue;
      }

      if (tag === "IMG") {
        var src = n.getAttribute("src") || "";
        if (/^https?:/.test(src)) saida.push('<img src="' + esc(src) + '" alt="' + esc(n.getAttribute("alt") || "") + '">');
        continue;
      }
      if (tag === "FIGURE") {
        var dentro = [];
        limpaNo(n, dentro);
        var dh = dentro.join("");
        // figura sem imagem viraria um retangulo laranja vazio no site
        if (dh.indexOf("<img") >= 0) saida.push('<figure class="ent-figura">' + dh + "</figure>");
        continue;
      }
      if (tag === "DESTAQUE") {
        var d = []; limpaNo(n, d);
        saida.push('<div class="destaque">' + d.join("") + "</div>");
        continue;
      }
      if (tag === "A") {
        var href = n.getAttribute("href") || "";
        if (/^javascript:/i.test(href)) href = "#";
        var a = []; limpaNo(n, a);
        saida.push('<a href="' + esc(href) + '" rel="noopener">' + a.join("") + "</a>");
        continue;
      }
      if (tag === "DIV") { // div solta do contenteditable vira paragrafo
        var dv = []; limpaNo(n, dv);
        var txt = dv.join("").trim();
        if (txt) saida.push("<p>" + txt + "</p>");
        continue;
      }
      if (!PERMITIDAS[tag]) { limpaNo(n, saida); continue; }
      var f = []; limpaNo(n, f);
      var conteudo = f.join("");
      if (tag === "BR") { saida.push("<br>"); continue; }
      if (!conteudo.trim() && tag !== "IMG") continue;
      saida.push("<" + tag.toLowerCase() + ">" + conteudo + "</" + tag.toLowerCase() + ">");
    }
  }
  function limpaCorpo(el) {
    var out = [];
    limpaNo(el, out);
    return out.join("").replace(/<p>\s*<\/p>/g, "").trim();
  }

  /* ---------- UI: botao na aba Marketing ---------- */
  function criarBtn() {
    var b = document.createElement("button");
    b.type = "button";
    b.id = "mktMare";
    b.className = "mk-rbtn";
    b.style.cssText = "background:var(--areia);color:var(--preto);flex:1;";
    b.innerHTML = IC.livro + "Diário";
    b.addEventListener("click", abrir);
    return b;
  }
  function addBtn() {
    var news = $id("mktNews");
    var meu = $id("mktMare");
    // ja no lugar certo: ao lado do Newsletter
    if (meu && news && meu.parentElement === news.parentElement) return;
    if (meu) meu.remove();          // nasceu fora do grupo; migra
    if (news && news.parentNode) { news.parentNode.appendChild(criarBtn()); return; }
    var nova = $id("mkNova");
    if (nova && nova.parentNode) nova.parentNode.appendChild(criarBtn());
  }

  /* ---------- UI: modal ---------- */
  function montaModal() {
    if (back) return back;
    back = document.createElement("div");
    back.className = "modal-back";
    back.id = "mareBack";
    back.innerHTML =
      '<div class="modal-card" style="max-width:720px;max-height:90vh;overflow-y:auto;">' +
        '<div class="modal-head"><h3>Diário de Maré</h3>' +
        '<button type="button" class="modal-close" id="mrClose" aria-label="Fechar">&times;</button></div>' +
        '<div id="mrLista"></div>' +
        '<div id="mrEditor" style="display:none;"></div>' +
      "</div>";
    document.body.appendChild(back);
    back.addEventListener("click", function (e) { if (e.target === back) fechar(); });
    $id("mrClose").addEventListener("click", fechar);
    return back;
  }

  function pintaLista() {
    var el = $id("mrLista");
    var linhas = posts.map(function (p) {
      var ed = edInfo(p.editoria);
      return '<div class="mr-item" data-slug="' + esc(p.slug) + '" style="display:flex;gap:10px;align-items:center;' +
        'padding:11px 12px;border:1.5px solid rgba(13,13,11,.18);border-radius:12px;margin-bottom:8px;cursor:pointer;">' +
        '<span style="flex:0 0 auto;background:' + ed.cor + ';color:#F0ECE4;border-radius:999px;padding:3px 9px;' +
        'font-size:9.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">' + ed.lbl + "</span>" +
        '<span style="flex:1;min-width:0;"><b style="display:block;font-size:13.5px;line-height:1.25;">' + esc(p.titulo) + "</b>" +
        '<span style="font-size:11px;opacity:.55;">' + esc(p.data || "") +
        (p.publicado ? "" : ' · <span style="color:' + LARANJA + ';font-weight:700;">rascunho</span>') + "</span></span>" +
        "</div>";
    }).join("");
    el.innerHTML =
      '<button type="button" class="btn" id="mrNovo" style="width:100%;margin-bottom:14px;">Escrever entrada nova</button>' +
      (linhas || '<p style="font-family:var(--clother);font-size:.85rem;opacity:.6;margin:8px 2px;">Nenhuma entrada ainda.</p>') +
      (posts.length ? '<p style="font-family:var(--clother);font-size:.72rem;opacity:.5;margin:12px 2px 0;">Toque numa entrada pra editar.</p>' : "");
    $id("mrNovo").onclick = function () { editar(null); };
    Array.prototype.forEach.call(el.querySelectorAll(".mr-item"), function (d) {
      d.onclick = function () {
        var s = d.getAttribute("data-slug");
        for (var i = 0; i < posts.length; i++) if (posts[i].slug === s) return editar(posts[i]);
      };
    });
  }

  function editar(p) {
    atual = p;
    var novo = !p;
    var ficha = [];
    try { ficha = JSON.parse((p && p.ficha) || "[]"); } catch (e) {}

    $id("mrLista").style.display = "none";
    var ed = $id("mrEditor");
    ed.style.display = "";
    ed.innerHTML =
      '<button type="button" class="btn ghost" id="mrVoltar" style="margin-bottom:12px;">← voltar</button>' +
      '<div class="form-section-title">Cabeçalho</div>' +
      '<label class="f"><span>Editoria</span><div id="mrEd" style="display:flex;gap:6px;flex-wrap:wrap;"></div></label>' +
      '<label class="f"><span>Data</span><input id="mrData" type="date" value="' + esc((p && p.data) || hojeISO()) + '" /></label>' +
      '<label class="f"><span>Título</span><input id="mrTitulo" placeholder="ex: A carranca empenou três vezes" value="' + esc((p && p.titulo) || "") + '" /></label>' +
      '<label class="f"><span>Linha fina</span><textarea id="mrOlho" rows="2" placeholder="Uma ou duas frases que resumem a entrada.">' + esc((p && p.olho) || "") + "</textarea></label>" +
      '<label class="f"><span>Endereço da página</span><div style="display:flex;gap:6px;align-items:center;">' +
        '<span style="font-size:12px;opacity:.55;white-space:nowrap;">/mare/</span>' +
        '<input id="mrSlug" placeholder="sai do título" value="' + esc((p && p.slug) || "") + '" style="flex:1;min-width:0;" /></div></label>' +

      '<div class="form-section-title">Imagem de capa</div>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input id="mrCapa" placeholder="escolha uma imagem ou cole um link" value="' + esc((p && p.capa) || "") + '" style="flex:1;min-width:0;" />' +
        '<button type="button" class="btn ghost" id="mrCapaBtn" style="flex:0 0 auto;white-space:nowrap;">' + IC.img + " Escolher</button></div>" +
      '<input type="file" id="mrCapaFile" accept="image/*" style="display:none;">' +
      '<img id="mrCapaPrev" alt="" style="' + ((p && p.capa) ? "" : "display:none;") + 'margin-top:8px;max-width:170px;max-height:120px;object-fit:cover;border-radius:10px;border:1.5px solid rgba(13,13,11,.25);" src="' + esc((p && p.capa) || "") + '">' +
      '<label class="f" style="margin-top:8px;"><span>Legenda da capa</span><input id="mrCapaLeg" placeholder="opcional" value="' + esc((p && p.capa_legenda) || "") + '" /></label>' +

      '<div class="form-section-title">Texto</div>' +
      '<div id="mrBarra" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;"></div>' +
      '<div id="mrCorpo" contenteditable="true" style="min-height:220px;max-height:44vh;overflow-y:auto;' +
        'border:1.5px solid rgba(13,13,11,.25);border-radius:12px;padding:14px 16px;background:#fff;' +
        'font-family:var(--clother);font-size:15px;line-height:1.7;outline:none;">' + ((p && p.corpo) || "<p><br></p>") + "</div>" +
      '<p style="font-family:var(--clother);font-size:.7rem;opacity:.5;margin:6px 2px 0;">Enter começa parágrafo novo. Selecione o texto e use os botões.</p>' +

      '<div class="form-section-title">Ficha técnica</div>' +
      '<div id="mrFicha"></div>' +
      '<button type="button" class="btn ghost" id="mrFichaAdd" style="margin-top:6px;">+ linha</button>' +

      '<div class="form-section-title">Publicação</div>' +
      '<label style="display:flex;gap:9px;align-items:center;font-family:var(--clother);font-size:13.5px;margin:2px 2px 14px;">' +
        '<input type="checkbox" id="mrPub" ' + ((p && p.publicado) ? "checked" : "") + ' style="width:18px;height:18px;">' +
        "Visível no site</label>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" class="btn" id="mrSalvar" style="flex:1;">Salvar</button>' +
        (novo ? "" : '<a class="btn ghost" id="mrVer" target="_blank" rel="noopener" href="https://maratu.com.br/mare/' + esc(p.slug) + '" style="flex:0 0 auto;text-decoration:none;text-align:center;">Ver no site</a>') +
        (novo ? "" : '<button type="button" class="btn ghost" id="mrApagar" style="flex:0 0 auto;color:' + LARANJA + ';">Apagar</button>') +
      "</div>";

    // editoria
    var box = $id("mrEd");
    var escolhida = (p && p.editoria) || "oficina";
    EDITORIAS.forEach(function (e) {
      var b = document.createElement("button");
      b.type = "button"; b.dataset.k = e.k; b.textContent = e.lbl;
      b.style.cssText = "border:1.5px solid " + PRETO + ";border-radius:999px;padding:6px 13px;cursor:pointer;" +
        "font-family:var(--clother);font-weight:900;font-size:11px;letter-spacing:.06em;text-transform:uppercase;";
      b.onclick = function () { escolhida = e.k; pintaEd(); };
      box.appendChild(b);
    });
    function pintaEd() {
      Array.prototype.forEach.call(box.children, function (b) {
        var on = b.dataset.k === escolhida;
        var cor = edInfo(b.dataset.k).cor;
        b.style.background = on ? cor : "transparent";
        b.style.color = on ? AREIA : PRETO;
      });
    }
    pintaEd();

    // barra de formatacao
    var barra = $id("mrBarra"), corpo = $id("mrCorpo");
    function cmd(nome, arg) {
      corpo.focus();
      document.execCommand(nome, false, arg || null);
    }
    [["Negrito", IC.neg, function () { cmd("bold"); }],
     ["Itálico", IC.ita, function () { cmd("italic"); }],
     ["Subtítulo", IC.tit, function () { cmd("formatBlock", "h3"); }],
     ["Destaque", IC.dest, function () { cmd("formatBlock", "blockquote"); }],
     ["Lista", IC.lista, function () { cmd("insertUnorderedList"); }],
     ["Link", IC.link, function () {
        var u = prompt("Endereço do link:", "https://");
        if (u) cmd("createLink", u);
     }],
     ["Imagem", IC.img, function () { $id("mrImgFile").click(); }],
     ["Tirar formatação", IC.limpa, function () { cmd("removeFormat"); }]
    ].forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.title = t[0]; b.innerHTML = t[1];
      b.style.cssText = "border:1.5px solid rgba(13,13,11,.25);background:var(--areia);border-radius:9px;" +
        "padding:7px 9px;cursor:pointer;display:flex;align-items:center;color:" + PRETO + ";";
      b.onclick = t[2];
      barra.appendChild(b);
    });
    var fInput = document.createElement("input");
    fInput.type = "file"; fInput.accept = "image/*"; fInput.id = "mrImgFile"; fInput.style.display = "none";
    barra.appendChild(fInput);
    fInput.onchange = function () {
      var f = fInput.files && fInput.files[0];
      if (!f) return;
      toast("Subindo imagem…");
      subirImagem(f).then(function (url) {
        corpo.focus();
        document.execCommand("insertHTML", false,
          '<figure class="ent-figura"><img src="' + url + '" alt=""></figure><p><br></p>');
        toast("Imagem no texto.");
      }).catch(function () { toast("Upload falhou."); });
      fInput.value = "";
    };
    // cola sem formatacao: evita trazer estilo de outro site junto
    corpo.addEventListener("paste", function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, t);
    });

    // capa
    $id("mrCapaBtn").onclick = function () { $id("mrCapaFile").click(); };
    $id("mrCapaFile").onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      toast("Subindo capa…");
      subirImagem(f).then(function (url) {
        $id("mrCapa").value = url;
        var prev = $id("mrCapaPrev"); prev.src = url; prev.style.display = "";
        toast("Capa pronta.");
      }).catch(function () { toast("Upload falhou."); });
    };
    $id("mrCapa").addEventListener("input", function () {
      var prev = $id("mrCapaPrev");
      prev.src = this.value; prev.style.display = this.value ? "" : "none";
    });

    // ficha tecnica
    function linhaFicha(rot, val) {
      var d = document.createElement("div");
      d.style.cssText = "display:flex;gap:6px;margin-bottom:6px;";
      d.innerHTML = '<input placeholder="Peça" value="' + esc(rot || "") + '" style="flex:1;min-width:0;">' +
                    '<input placeholder="Carranca, chaveiro" value="' + esc(val || "") + '" style="flex:1.4;min-width:0;">' +
                    '<button type="button" class="btn ghost" style="flex:0 0 auto;padding:6px 10px;">×</button>';
      d.querySelector("button").onclick = function () { d.remove(); };
      $id("mrFicha").appendChild(d);
    }
    ficha.forEach(function (f) { linhaFicha(f[0], f[1]); });
    $id("mrFichaAdd").onclick = function () { linhaFicha("", ""); };

    $id("mrVoltar").onclick = function () {
      ed.style.display = "none"; $id("mrLista").style.display = "";
    };

    $id("mrSalvar").onclick = function () {
      var titulo = $id("mrTitulo").value.trim();
      if (!titulo) return toast("Falta o título.");
      var fichaOut = [];
      Array.prototype.forEach.call($id("mrFicha").children, function (d) {
        var i = d.querySelectorAll("input");
        if (i[0].value.trim() || i[1].value.trim()) fichaOut.push([i[0].value.trim(), i[1].value.trim()]);
      });
      var corpoLimpo = limpaCorpo($id("mrCorpo"));
      var dados = {
        slug: slugify($id("mrSlug").value || titulo),
        slug_antigo: p ? p.slug : "",
        titulo: titulo,
        olho: $id("mrOlho").value.trim(),
        editoria: escolhida,
        data: $id("mrData").value || hojeISO(),
        capa: $id("mrCapa").value.trim(),
        capa_legenda: $id("mrCapaLeg").value.trim(),
        corpo: corpoLimpo,
        ficha: fichaOut,
        publicado: $id("mrPub").checked ? 1 : 0
      };
      this.disabled = true;
      var btn = this;
      salvar(dados).then(function (r) {
        btn.disabled = false;
        if (r && r.error) return toast("Erro: " + r.error);
        toast(dados.publicado ? "Publicado." : "Rascunho salvo.");
        carregar().then(function () {
          ed.style.display = "none"; $id("mrLista").style.display = "";
          pintaLista();
        });
      }).catch(function () { btn.disabled = false; toast("Não deu pra salvar."); });
    };

    if ($id("mrApagar")) $id("mrApagar").onclick = function () {
      if (!confirm("Apagar a entrada \"" + p.titulo + "\"? Não dá pra desfazer.")) return;
      apagar(p.slug).then(function () {
        toast("Apagada.");
        carregar().then(function () {
          ed.style.display = "none"; $id("mrLista").style.display = "";
          pintaLista();
        });
      });
    };
  }

  function abrir() {
    montaModal();
    back.classList.add("on");
    document.body.style.overflow = "hidden";
    $id("mrEditor").style.display = "none";
    $id("mrLista").style.display = "";
    $id("mrLista").innerHTML = '<p style="font-family:var(--clother);opacity:.6;">carregando…</p>';
    carregar().then(pintaLista);
  }
  function fechar() {
    if (!back) return;
    back.classList.remove("on");
    document.body.style.overflow = "";
  }

  /* ---------- boot ----------
     O admin-mkt.js reescreve o innerHTML de #mkConteudo a cada salvar/filtrar, e leva o botao
     junto. Observer reancora, igual o admin-news.js faz com o dele. */
  function vigiar() {
    var alvo = $id("mkConteudo") || $id("panel-marketing");
    if (!alvo) return false;
    try {
      new MutationObserver(function () { try { addBtn(); } catch (e) {} })
        .observe(alvo, { childList: true, subtree: true });
    } catch (e) {}
    return true;
  }
  function boot() { addBtn(); vigiar(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  var n = 0;
  var timer = setInterval(function () {
    addBtn();
    if (vigiar() || ++n > 60) clearInterval(timer);
  }, 500);
})();
