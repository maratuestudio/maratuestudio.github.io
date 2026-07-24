/* MARATU admin — modulo "Marketing" (redesign da aba). Divide em sub-abas
   Conteudo | Leads. Conteudo: resumo (pipeline em 3 numeros + Nova ideia) + "Proximos
   a publicar" + pipeline (Ideias/Programados/Publicados) com cards e avancar estagio.
   Mata o planner. Sobrescreve renderMarketing/renderMkt*. Leads: move o #leadsSec pra ca.
   So SVG, sem emoji. Usa vars de tema do admin. Depende de MaratuStore.getMarketing/
   setMarketing e do global uid. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuMkt) return;
  window.__maratuMkt = true;

  var STAGES = [
    { k: "ideia", lbl: "Ideias", cor: "#8A8577" },
    { k: "aprovado", lbl: "Programados", cor: "#2E6BB8" },
    { k: "publicado", lbl: "Publicados", cor: "#3E7D4F" }
  ];
  var FORMATOS = ["Reels", "Carrossel", "Story", "Post", "Vídeo"];
  var REDES = ["Instagram", "TikTok", "YouTube", "Todas"];
  var sub = "conteudo", filtro = "ideia", editId = null;

  function UID() { try { if (typeof uid === "function") return uid(); } catch (e) {} return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function ESC(s) { try { if (typeof esc === "function") return esc(s); } catch (e) {} return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function HOJE() { try { if (typeof todayStr === "function") return todayStr(); } catch (e) {} var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function getMkt() { try { return MaratuStore.getMarketing() || []; } catch (e) { return []; } }
  function setMkt(a) { try { MaratuStore.setMarketing(a); return true; } catch (e) { return false; } }
  function redeDot(r) { return { Instagram: "#C8501A", TikTok: "#444", YouTube: "#C0392B", Todas: "#8A8577" }[r] || "#8A8577"; }
  function nextStatus(s) { return s === "ideia" ? "aprovado" : s === "aprovado" ? "publicado" : "publicado"; }
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function diaChip(iso) { var p = (iso || "").split("-"); return { d: p[2] || "", m: MESES[parseInt(p[1], 10) - 1] || "" }; }

  function svg(p, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="' + (w || 16) + '" height="' + (w || 16) + '">' + p + "</svg>"; }
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'
  };

  function injectStyles() {
    if (document.getElementById("mkStyles")) return;
    var s = document.createElement("style");
    s.id = "mkStyles";
    s.textContent =
      "#panel-marketing .mk-hide{display:none!important}" +
      ".mk{display:flex;flex-direction:column;gap:13px}" +
      ".mk-seg{display:flex;gap:6px;background:var(--areia);border:1.5px solid var(--preto);border-radius:12px;padding:4px;box-shadow:2px 2px 0 0 var(--preto)}" +
      ".mk-seg button{flex:1;padding:8px;border:none;border-radius:8px;background:none;font-family:inherit;font-weight:800;font-size:13px;color:var(--muted);cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      ".mk-seg button.on{background:var(--preto);color:var(--areia)}" +
      ".mk-resumo{background:var(--areia);border:2px solid var(--preto);border-radius:18px;box-shadow:4px 4px 0 0 var(--preto);padding:16px}" +
      ".mk-cap{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:12px}" +
      ".mk-tiles{display:flex;gap:8px;margin-bottom:14px}" +
      ".mk-tile{flex:1;text-align:center;border:1.5px solid var(--preto);border-radius:12px;padding:10px 4px}" +
      ".mk-tile b{display:block;font-size:23px;font-weight:900;line-height:1}" +
      ".mk-tile span{display:block;font-size:9.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin-top:4px}" +
      ".mk-rbtn{width:100%;padding:12px;border:1.5px solid var(--preto);border-radius:12px;background:var(--laranja);color:#F0ECE4;font-family:inherit;font-weight:900;font-size:14px;cursor:pointer;box-shadow:2px 2px 0 0 var(--preto);display:flex;align-items:center;justify-content:center;gap:7px}" +
      ".mk-seccap{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:0 4px 8px}" +
      ".mk-prox{display:flex;flex-direction:column;gap:9px}" +
      ".mk-pcard{display:flex;align-items:center;gap:12px;background:var(--areia);border:1.5px solid var(--preto);border-radius:14px;box-shadow:2px 2px 0 0 var(--preto);padding:11px 13px}" +
      ".mk-date{flex:0 0 auto;width:44px;text-align:center;border-right:1.5px solid var(--line);padding-right:11px}" +
      ".mk-date b{display:block;font-size:19px;font-weight:900;line-height:1;color:var(--preto)}" +
      ".mk-date span{display:block;font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}" +
      ".mk-mid{flex:1;min-width:0}" +
      ".mk-nome{font-size:14px;font-weight:700;color:var(--preto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".mk-pills{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap}" +
      ".mk-pill{font-size:10px;font-weight:700;border:1.2px solid var(--line);border-radius:20px;padding:2px 8px;color:var(--muted);display:flex;align-items:center;gap:4px;white-space:nowrap}" +
      ".mk-pdot{width:7px;height:7px;border-radius:50%;flex:0 0 auto}" +
      ".mk-pipeseg{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}" +
      ".mk-chip{white-space:nowrap;padding:7px 12px;border:1.5px solid var(--preto);border-radius:20px;background:var(--areia);color:var(--preto);font-size:12.5px;font-weight:700;cursor:pointer;display:flex;gap:6px;align-items:center}" +
      ".mk-chip.on{background:var(--preto);color:var(--areia)}" +
      ".mk-chip i{font-style:normal;font-size:11px;font-weight:800;opacity:.55}" +
      ".mk-cards{display:flex;flex-direction:column;gap:9px;margin-top:4px}" +
      ".mk-card{background:var(--areia);border:1.5px solid var(--preto);border-radius:14px;box-shadow:2px 2px 0 0 var(--preto);padding:12px 13px}" +
      ".mk-ctop{display:flex;align-items:flex-start;gap:10px}" +
      ".mk-cnome{flex:1;font-size:14.5px;font-weight:700;color:var(--preto);line-height:1.3}" +
      ".mk-acts{display:flex;gap:12px;flex:0 0 auto;margin-left:10px}" +
      ".mk-ic{border:1.5px solid var(--preto);background:var(--areia);border-radius:8px;padding:6px;cursor:pointer;color:var(--preto);display:flex;-webkit-tap-highlight-color:transparent}" +
      ".mk-ic.go{background:var(--laranja);color:#F0ECE4}" +
      ".mk-empty{text-align:center;font-size:13px;color:var(--muted);padding:22px 10px;border:1.5px dashed var(--line);border-radius:14px}" +
      /* modal */
      ".mk-mback{position:fixed;inset:0;z-index:99985;display:none;align-items:flex-start;justify-content:center;background:rgba(13,13,11,.55);padding:20px 14px;overflow:auto}" +
      ".mk-mcard{background:var(--areia);border:2px solid var(--preto);border-radius:18px;box-shadow:6px 6px 0 0 var(--preto);max-width:460px;width:100%;padding:18px;margin:auto}" +
      ".mk-mhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}" +
      ".mk-mhead h3{font-family:inherit;font-weight:900;font-size:19px;color:var(--preto);margin:0}" +
      ".mk-lab{display:block;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);margin-top:13px}" +
      ".mk-f{width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid var(--preto);border-radius:10px;background:var(--card,#fff);font-family:inherit;font-size:15px;color:var(--preto);margin-top:5px}" +
      ".mk-g2{display:flex;gap:12px}.mk-g2>div{flex:1}" +
      ".mk-save{width:100%;margin-top:16px;padding:14px;border:2px solid var(--preto);border-radius:12px;background:var(--laranja);color:#F0ECE4;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;box-shadow:3px 3px 0 0 var(--preto)}" +
      ".mk-del{width:100%;margin-top:9px;padding:10px;border:none;background:none;color:#8A8577;font-family:inherit;font-weight:700;font-size:12.5px;cursor:pointer;display:none}";
    document.head.appendChild(s);
  }

  /* ---- modal criar/editar ---- */
  var modal = null;
  function buildModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.className = "mk-mback"; modal.id = "mkModal";
    modal.innerHTML =
      '<div class="mk-mcard">' +
        '<div class="mk-mhead"><h3 id="mkMTitle">Nova ideia</h3><button type="button" id="mkMClose" aria-label="Fechar" style="border:none;background:none;font-size:26px;line-height:1;cursor:pointer;color:var(--preto)">×</button></div>' +
        '<label class="mk-lab">Título</label><input id="mkT" class="mk-f" placeholder="Ex: Bastidores da carranca" autocomplete="off">' +
        '<div class="mk-g2">' +
          '<div><label class="mk-lab">Formato</label><select id="mkF" class="mk-f">' + FORMATOS.map(function (o) { return "<option>" + o + "</option>"; }).join("") + "</select></div>" +
          '<div><label class="mk-lab">Rede</label><select id="mkR" class="mk-f">' + REDES.map(function (o) { return "<option>" + o + "</option>"; }).join("") + "</select></div>" +
        "</div>" +
        '<label class="mk-lab">Ideia / roteiro</label><textarea id="mkI" class="mk-f" rows="3" style="resize:vertical"></textarea>' +
        '<div class="mk-g2">' +
          '<div><label class="mk-lab">Data (opcional)</label><input id="mkD" type="date" class="mk-f"></div>' +
          '<div><label class="mk-lab">Hora (opcional)</label><input id="mkH" type="time" class="mk-f"></div>' +
        "</div>" +
        '<button type="button" id="mkSave" class="mk-save">Salvar</button>' +
        '<button type="button" id="mkDel" class="mk-del">Excluir</button>' +
      "</div>";
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector("#mkMClose").addEventListener("click", closeModal);
    modal.querySelector("#mkSave").addEventListener("click", onSave);
    modal.querySelector("#mkDel").addEventListener("click", onDel);
  }
  function openModal(id) {
    buildModal();
    editId = id || null;
    var it = id ? getMkt().filter(function (x) { return x.id === id; })[0] : null;
    modal.querySelector("#mkMTitle").textContent = it ? "Editar" : "Nova ideia";
    modal.querySelector("#mkT").value = it ? (it.titulo || "") : "";
    modal.querySelector("#mkF").value = it ? (it.formato || "Reels") : "Reels";
    modal.querySelector("#mkR").value = it ? (it.rede || "Instagram") : "Instagram";
    modal.querySelector("#mkI").value = it ? (it.ideia || "") : "";
    modal.querySelector("#mkD").value = it ? (it.data || "") : "";
    modal.querySelector("#mkH").value = it ? (it.hora || "") : "";
    modal.querySelector("#mkDel").style.display = it ? "block" : "none";
    modal.style.display = "flex";
    setTimeout(function () { try { modal.querySelector("#mkT").focus(); } catch (e) {} }, 40);
  }
  function closeModal() { if (modal) modal.style.display = "none"; }
  function onSave() {
    var q = function (id) { return modal.querySelector("#" + id).value.trim(); };
    var titulo = q("mkT");
    if (!titulo) { modal.querySelector("#mkT").focus(); return; }
    var data = q("mkD"), arr = getMkt();
    if (editId) {
      arr = arr.map(function (x) {
        return x.id === editId ? Object.assign({}, x, { titulo: titulo, formato: q("mkF"), rede: q("mkR"), ideia: q("mkI"), data: data || null, hora: q("mkH") || null }) : x;
      });
    } else {
      arr = [{ id: UID(), titulo: titulo, formato: q("mkF"), rede: q("mkR"), ideia: q("mkI"), status: data ? "aprovado" : "ideia", data: data || null, hora: q("mkH") || null, criado: new Date().toISOString() }].concat(arr);
    }
    setMkt(arr); render(); closeModal();
  }
  function onDel() {
    if (!editId) return;
    setMkt(getMkt().filter(function (x) { return x.id !== editId; }));
    render(); closeModal();
  }
  function setStatus(id, st) {
    setMkt(getMkt().map(function (x) { return x.id === id ? Object.assign({}, x, { status: st }) : x; }));
    render();
  }

  /* ---- layout: sub-abas + containers ---- */
  function buildLayout() {
    var host = document.getElementById("panel-marketing");
    if (!host) return false;
    if (document.getElementById("mkWrap")) return true;
    injectStyles();
    // esconde os blocos antigos
    ["mkt-stats", "mkt-planner-head", "mkt-backlog-head"].forEach(function (c) {
      var el = host.querySelector("." + c); if (el) el.classList.add("mk-hide");
    });
    ["mktPlanner", "mktFormWrap", "mktLista"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.classList.add("mk-hide");
    });
    var wrap = document.createElement("div");
    wrap.id = "mkWrap";
    wrap.innerHTML =
      '<div class="mk">' +
        '<div class="mk-seg" id="mkSubSeg"><button data-s="conteudo" class="on">Conteúdo</button><button data-s="leads">Leads</button></div>' +
        '<div id="mkConteudo"></div>' +
        '<div id="mkLeads"></div>' +
      "</div>";
    host.insertBefore(wrap, host.firstChild);
    wrap.querySelectorAll("#mkSubSeg button").forEach(function (b) {
      b.addEventListener("click", function () { sub = b.getAttribute("data-s"); renderSub(); });
    });
    return true;
  }

  function moveLeads() {
    var sec = document.getElementById("leadsSec"), slot = document.getElementById("mkLeads");
    if (sec && slot && sec.parentNode !== slot) slot.appendChild(sec);
  }

  function renderSub() {
    document.querySelectorAll("#mkSubSeg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-s") === sub); });
    var con = document.getElementById("mkConteudo"), lea = document.getElementById("mkLeads");
    if (con) con.style.display = sub === "conteudo" ? "" : "none";
    if (lea) lea.style.display = sub === "leads" ? "" : "none";
    moveLeads();
  }

  function pills(it) {
    return '<span class="mk-pill"><span class="mk-pdot" style="background:' + redeDot(it.rede) + '"></span>' + ESC(it.rede || "Instagram") + "</span>" +
      (it.formato ? '<span class="mk-pill">' + ESC(it.formato) + "</span>" : "");
  }

  function render() {
    if (!buildLayout()) return;
    var con = document.getElementById("mkConteudo");
    if (!con) return;
    var arr = getMkt();
    var cnt = { ideia: 0, aprovado: 0, publicado: 0 };
    arr.forEach(function (x) { var s = x.status || "ideia"; if (cnt[s] != null) cnt[s]++; });

    // proximos: programados com data >= hoje
    var hoje = HOJE();
    var prox = arr.filter(function (x) { return (x.status === "aprovado") && x.data && x.data >= hoje; })
      .sort(function (a, b) { return (a.data + (a.hora || "")).localeCompare(b.data + (b.hora || "")); }).slice(0, 4);

    var tiles = STAGES.map(function (st) {
      return '<div class="mk-tile"><b style="color:' + st.cor + '">' + cnt[st.k] + "</b><span>" + st.lbl + "</span></div>";
    }).join("");

    var proxHtml = "";
    if (prox.length) {
      proxHtml = '<div><div class="mk-seccap">Próximos a publicar</div><div class="mk-prox">' +
        prox.map(function (it) {
          var d = diaChip(it.data);
          return '<div class="mk-pcard" data-edit="' + ESC(it.id) + '"><div class="mk-date"><b>' + d.d + "</b><span>" + d.m + '</span></div><div class="mk-mid"><div class="mk-nome">' + ESC(it.titulo) + '</div><div class="mk-pills">' + pills(it) + "</div></div></div>";
        }).join("") + "</div></div>";
    }

    var lista = arr.filter(function (x) { return (x.status || "ideia") === filtro; })
      .sort(function (a, b) { return String(b.criado || "").localeCompare(String(a.criado || "")); });
    var listaHtml = lista.length ? lista.map(function (it) {
      var st = it.status || "ideia";
      var goBtn = st !== "publicado" ? '<button class="mk-ic go" data-go="' + ESC(it.id) + "|" + nextStatus(st) + '" title="' + (st === "ideia" ? "Programar" : "Publicar") + '">' + svg(IC.arrow, 15) + "</button>" : "";
      return '<div class="mk-card"><div class="mk-ctop"><div class="mk-cnome">' + ESC(it.titulo) + '</div><div class="mk-acts">' +
        '<button class="mk-ic" data-edit="' + ESC(it.id) + '" title="Editar">' + svg(IC.edit, 15) + "</button>" + goBtn +
        '</div></div><div class="mk-pills">' + pills(it) + (it.data ? '<span class="mk-pill">' + diaChip(it.data).d + " " + diaChip(it.data).m + "</span>" : "") + "</div></div>";
    }).join("") : '<div class="mk-empty">Nada em ' + STAGES.filter(function (s) { return s.k === filtro; })[0].lbl.toLowerCase() + ".</div>";

    con.innerHTML =
      '<div class="mk-resumo"><div class="mk-cap">Conteúdo</div><div class="mk-tiles">' + tiles + '</div><button class="mk-rbtn" id="mkNova">' + svg(IC.plus, 17) + "Nova ideia</button></div>" +
      proxHtml +
      '<div style="margin-top:18px"><div class="mk-pipeseg">' +
        STAGES.map(function (st) { return '<div class="mk-chip' + (filtro === st.k ? " on" : "") + '" data-f="' + st.k + '">' + st.lbl + ' <i>' + cnt[st.k] + "</i></div>"; }).join("") +
      '</div><div class="mk-cards">' + listaHtml + "</div></div>";

    con.querySelector("#mkNova").addEventListener("click", function () { openModal(null); });
    con.querySelectorAll("[data-f]").forEach(function (c) { c.addEventListener("click", function () { filtro = c.getAttribute("data-f"); render(); }); });
    con.querySelectorAll("[data-edit]").forEach(function (c) { c.addEventListener("click", function () { openModal(c.getAttribute("data-edit")); }); });
    con.querySelectorAll("[data-go]").forEach(function (c) { c.addEventListener("click", function (e) { e.stopPropagation(); var p = c.getAttribute("data-go").split("|"); setStatus(p[0], p[1]); }); });

    renderSub();
  }

  /* ---- boot ---- */
  function boot() {
    var t = 0, iv = setInterval(function () {
      t++;
      if (buildLayout()) {
        clearInterval(iv);
        window.renderMarketing = render;
        window.renderMktStats = render; window.renderMktPlanner = function () {}; window.renderMktBacklog = render;
        window.MaratuMkt = { openLeads: function () { sub = "leads"; try { render(); } catch (e) {} renderSub(); } };
        render();
        // move leads quando existir
        var l = 0, lv = setInterval(function () { l++; moveLeads(); if (document.getElementById("leadsSec") && document.getElementById("leadsSec").parentNode === document.getElementById("mkLeads")) { clearInterval(lv); renderSub(); } else if (l > 60) clearInterval(lv); }, 300);
      } else if (t > 60) clearInterval(iv);
    }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
