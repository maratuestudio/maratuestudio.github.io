/* MARATU admin — modulo "Leads" (CRM-lite). Captura interessados que ainda nao
   compraram (Instagram/WhatsApp/feira/indicacao), com status e follow-up. Lista +
   botao na aba Marketing; card de funil no Painel. Persiste em tabela propria no
   Worker (GET/PUT /api/leads) — o core (MaratuStore) nao conhece leads. Follow-up
   com data entra no feed .ics do Worker com alarme (tipo "followup"). Nao toca no
   admin.js minificado. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuLeads) return;
  window.__maratuLeads = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var AREIA = "#F0ECE4", PRETO = "#0D0D0B", LARANJA = "#C8501A";
  var ORIGENS = ["Instagram", "WhatsApp", "Feira", "Indicação", "Site", "Outro"];
  var STATUS = [
    { k: "novo", lbl: "Novo", cor: "#C8501A" },
    { k: "conversando", lbl: "Conversando", cor: "#2E6BB8" },
    { k: "fechado", lbl: "Fechado", cor: "#3E7D4F" },
    { k: "perdido", lbl: "Perdido", cor: "#8A8577" }
  ];
  var leads = [];
  var loaded = false;

  /* ---------- utils ---------- */
  function uid() { return "ld" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fmtBR(iso) { var p = (iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : iso; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function statusInfo(k) { for (var i = 0; i < STATUS.length; i++) if (STATUS[i].k === k) return STATUS[i]; return STATUS[0]; }
  function aberto(l) { return l.status !== "fechado" && l.status !== "perdido"; }

  /* ---------- persistencia ---------- */
  function loadLeads() {
    return fetch(API + "/api/leads", { headers: { Authorization: "Bearer " } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { leads = (d && d.leads) || []; loaded = true; renderAll(); })
      .catch(function () { leads = []; loaded = true; renderAll(); });
  }
  function saveLeads() {
    return fetch(API + "/api/leads", {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " },
      body: JSON.stringify(leads)
    }).catch(function () {});
  }

  /* ---------- WhatsApp ---------- */
  function waLink(l) {
    var tel = String(l.contato || "").replace(/\D/g, "");
    var base = tel ? "https://wa.me/55" + tel : "https://wa.me/";
    var msg = "Oi " + (l.nome || "") + "! Aqui é da MARATU Estúdio" + (l.interesse ? " Vi seu interesse em " + l.interesse + "." : "") + " Como posso te ajudar?";
    return base + "?text=" + encodeURIComponent(msg);
  }

  /* ---------- toast ---------- */
  function toast(txt) {
    var t = document.createElement("div");
    t.textContent = txt;
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100000;background:" + PRETO +
      ";color:" + AREIA + ";font-family:inherit;font-size:13px;font-weight:700;padding:12px 18px;border-radius:12px;box-shadow:3px 3px 0 0 " + LARANJA + ";max-width:88vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 320); }, 2400);
  }

  /* ---------- modal add/editar ---------- */
  var modal = null, editId = null;
  function fieldCss() { return "width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid " + PRETO + ";border-radius:10px;background:#fff;font-family:inherit;font-size:15px;color:" + PRETO + ";margin-top:5px;"; }
  function labCss() { return "display:block;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:" + PRETO + ";opacity:.7;margin-top:13px;"; }

  function buildModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "leadModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(13,13,11,.55);padding:16px;";
    modal.innerHTML =
      '<div style="background:' + AREIA + ';border:2px solid ' + PRETO + ';border-radius:20px;box-shadow:8px 8px 0 0 ' + PRETO + ';max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:20px 20px 22px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
          '<h3 id="ldTitle" style="font-family:inherit;font-weight:900;font-size:20px;letter-spacing:-.01em;color:' + PRETO + ';margin:0;">Novo lead</h3>' +
          '<button type="button" id="ldClose" aria-label="Fechar" style="border:none;background:none;font-size:26px;line-height:1;cursor:pointer;color:' + PRETO + ';">×</button>' +
        '</div>' +
        '<label style="' + labCss() + '">Nome</label><input id="ldNome" style="' + fieldCss() + '" placeholder="Nome" autocomplete="off">' +
        '<label style="' + labCss() + '">WhatsApp <span style="opacity:.5;font-weight:400">(DDD + número)</span></label><input id="ldContato" style="' + fieldCss() + '" placeholder="79 99999-9999" inputmode="tel" autocomplete="off">' +
        '<label style="' + labCss() + '">Interesse <span style="opacity:.5;font-weight:400">(o que quer)</span></label><input id="ldInteresse" style="' + fieldCss() + '" placeholder="ex: pôster A3, blusa..." autocomplete="off">' +
        '<div style="display:flex;gap:12px;">' +
          '<div style="flex:1;"><label style="' + labCss() + '">Origem</label><select id="ldOrigem" style="' + fieldCss() + '">' + ORIGENS.map(function (o) { return '<option>' + o + '</option>'; }).join("") + '</select></div>' +
          '<div style="flex:1;"><label style="' + labCss() + '">Status</label><select id="ldStatus" style="' + fieldCss() + '">' + STATUS.map(function (s) { return '<option value="' + s.k + '">' + s.lbl + '</option>'; }).join("") + '</select></div>' +
        '</div>' +
        '<label style="' + labCss() + '">Follow-up <span style="opacity:.5;font-weight:400">(lembrete no Apple Calendar, opcional)</span></label><input id="ldFollowup" type="date" style="' + fieldCss() + '">' +
        '<label style="' + labCss() + '">Notas <span style="opacity:.5;font-weight:400">(opcional)</span></label><textarea id="ldNotas" rows="2" style="' + fieldCss() + 'resize:vertical;"></textarea>' +
        '<button type="button" id="ldSalvar" style="width:100%;margin-top:16px;padding:14px;border:2px solid ' + PRETO + ';border-radius:12px;background:' + LARANJA + ';color:' + AREIA + ';font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;box-shadow:3px 3px 0 0 ' + PRETO + ';">Salvar lead</button>' +
        '<button type="button" id="ldExcluir" style="width:100%;margin-top:9px;padding:10px;border:none;background:none;color:#8A8577;font-family:inherit;font-weight:700;font-size:12.5px;cursor:pointer;display:none;">Excluir lead</button>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector("#ldClose").addEventListener("click", closeModal);
    modal.querySelector("#ldSalvar").addEventListener("click", onSalvar);
    modal.querySelector("#ldExcluir").addEventListener("click", onExcluir);
    return modal;
  }
  function openModal(id) {
    buildModal();
    editId = id || null;
    var l = id ? leads.filter(function (x) { return x.id === id; })[0] : null;
    modal.querySelector("#ldTitle").textContent = l ? "Editar lead" : "Novo lead";
    modal.querySelector("#ldNome").value = l ? (l.nome || "") : "";
    modal.querySelector("#ldContato").value = l ? (l.contato || "") : "";
    modal.querySelector("#ldInteresse").value = l ? (l.interesse || "") : "";
    modal.querySelector("#ldOrigem").value = l ? (l.origem || "Instagram") : "Instagram";
    modal.querySelector("#ldStatus").value = l ? (l.status || "novo") : "novo";
    modal.querySelector("#ldFollowup").value = l ? (l.followup || "") : "";
    modal.querySelector("#ldNotas").value = l ? (l.notas || "") : "";
    modal.querySelector("#ldExcluir").style.display = l ? "block" : "none";
    modal.style.display = "flex";
    setTimeout(function () { try { modal.querySelector("#ldNome").focus(); } catch (e) {} }, 40);
  }
  function closeModal() { if (modal) modal.style.display = "none"; }

  function onSalvar() {
    var q = function (id) { return modal.querySelector("#" + id).value.trim(); };
    var nome = q("ldNome");
    if (!nome) { toast("Coloque o nome"); return; }
    var obj = {
      id: editId || uid(), nome: nome, contato: q("ldContato"), interesse: q("ldInteresse"),
      origem: q("ldOrigem"), status: q("ldStatus"), followup: q("ldFollowup"), notas: q("ldNotas"),
      criado: editId ? (leads.filter(function (x) { return x.id === editId; })[0] || {}).criado || todayISO() : todayISO()
    };
    if (editId) leads = leads.map(function (x) { return x.id === editId ? obj : x; });
    else leads = [obj].concat(leads);
    saveLeads(); renderAll(); closeModal();
    toast(editId ? "Lead atualizado" : "Lead adicionado");
  }
  function onExcluir() {
    if (!editId) return;
    leads = leads.filter(function (x) { return x.id !== editId; });
    saveLeads(); renderAll(); closeModal(); toast("Lead excluído");
  }

  function setStatus(id, k) {
    leads = leads.map(function (x) { return x.id === id ? Object.assign({}, x, { status: k }) : x; });
    saveLeads(); renderAll();
  }

  /* ---------- render: lista na aba Marketing ---------- */
  function ensureSection() {
    var sec = document.getElementById("leadsSec");
    if (sec) return sec;
    var host = document.getElementById("panel-marketing");
    if (!host) return null;
    sec = document.createElement("div");
    sec.id = "leadsSec";
    sec.style.cssText = "margin-top:22px;padding-top:20px;border-top:2px solid rgba(13,13,11,.12);";
    sec.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<h2 style="font-family:inherit;font-weight:900;font-size:17px;color:' + PRETO + ';margin:0;">Leads <span id="leadsCount" style="opacity:.5;font-weight:700;font-size:13px;"></span></h2>' +
        '<button type="button" id="leadNovo" style="padding:9px 14px;border:1.5px solid ' + PRETO + ';border-radius:10px;background:' + LARANJA + ';color:' + AREIA + ';font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;box-shadow:2px 2px 0 0 ' + PRETO + ';">+ Novo lead</button>' +
      '</div>' +
      '<div id="leadsList"></div>';
    host.appendChild(sec);
    sec.querySelector("#leadNovo").addEventListener("click", function () { openModal(null); });
    return sec;
  }

  function leadRow(l) {
    var si = statusInfo(l.status);
    var fup = "";
    if (l.followup && aberto(l)) {
      var atrasado = l.followup < todayISO();
      fup = '<span style="font-size:11px;font-weight:700;color:' + (atrasado ? "#B23A2E" : LARANJA) + ';"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:-1px;margin-right:3px"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' + (atrasado ? "atrasado " : "") + fmtBR(l.followup) + '</span>';
    }
    var nextStatus = { novo: "conversando", conversando: "fechado", fechado: "perdido", perdido: "novo" };
    return '<div style="border:1.5px solid ' + PRETO + ';border-radius:12px;background:#fff;padding:12px 13px;margin-bottom:9px;box-shadow:2px 2px 0 0 rgba(13,13,11,.12);">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<b style="font-family:inherit;font-size:14.5px;color:' + PRETO + ';">' + esc(l.nome) + '</b>' +
        '<button type="button" data-cyc="' + l.id + '" title="mudar status" style="border:none;cursor:pointer;font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:' + si.cor + ';padding:3px 9px;border-radius:20px;">' + si.lbl + '</button>' +
        (l.origem ? '<span style="font-size:11px;font-weight:600;color:' + PRETO + ';opacity:.55;">via ' + esc(l.origem) + '</span>' : '') +
        '<span style="margin-left:auto;"></span>' + fup +
      '</div>' +
      (l.interesse ? '<div style="font-family:inherit;font-size:12.5px;color:' + PRETO + ';opacity:.8;margin-top:5px;">' + esc(l.interesse) + '</div>' : '') +
      '<div style="display:flex;gap:8px;margin-top:10px;">' +
        '<a href="' + waLink(l) + '" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:8px;border:1.5px solid ' + PRETO + ';border-radius:9px;background:#25D366;color:#0b3d1f;font-family:inherit;font-weight:800;font-size:12.5px;text-decoration:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="vertical-align:-2px;margin-right:4px"><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z"/></svg>WhatsApp</a>' +
        '<button type="button" data-edit="' + l.id + '" style="padding:8px 14px;border:1.5px solid ' + PRETO + ';border-radius:9px;background:' + AREIA + ';color:' + PRETO + ';font-family:inherit;font-weight:800;font-size:12.5px;cursor:pointer;">Editar</button>' +
      '</div>' +
      '<button type="button" data-nx="' + l.id + '|' + nextStatus[l.status || "novo"] + '" hidden></button>' +
    '</div>';
  }

  function renderLista() {
    var sec = ensureSection();
    if (!sec) return;
    var list = sec.querySelector("#leadsList");
    var cnt = sec.querySelector("#leadsCount");
    if (!loaded) { list.innerHTML = '<div style="font-family:inherit;font-size:13px;color:' + PRETO + ';opacity:.5;">carregando…</div>'; return; }
    if (!leads.length) { list.innerHTML = '<div style="font-family:inherit;font-size:13px;color:' + PRETO + ';opacity:.5;">Nenhum lead ainda. Anote quem te chamou no Direct, na feira, no WhatsApp.</div>'; cnt.textContent = ""; return; }
    var ordem = { novo: 0, conversando: 1, fechado: 2, perdido: 3 };
    var arr = leads.slice().sort(function (a, b) {
      var d = (ordem[a.status] || 0) - (ordem[b.status] || 0);
      if (d) return d;
      return (a.followup || "9999").localeCompare(b.followup || "9999");
    });
    cnt.textContent = "· " + leads.length;
    list.innerHTML = arr.map(leadRow).join("");
    list.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openModal(b.getAttribute("data-edit")); }); });
    list.querySelectorAll("[data-cyc]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-cyc");
        var l = leads.filter(function (x) { return x.id === id; })[0]; if (!l) return;
        var nx = { novo: "conversando", conversando: "fechado", fechado: "perdido", perdido: "novo" }[l.status || "novo"];
        setStatus(id, nx);
      });
    });
  }

  /* ---------- render: card de funil no Painel ---------- */
  function ensureCard() {
    var card = document.getElementById("leadsCard");
    if (card) return card;
    var host = document.getElementById("panel-painel");
    if (!host) return null;
    card = document.createElement("div");
    card.id = "leadsCard";
    card.style.cssText = "border:1.5px solid " + PRETO + ";border-radius:16px;background:" + AREIA + ";padding:15px 16px;box-shadow:3px 3px 0 0 " + PRETO + ";cursor:pointer;min-width:0;";
    card.title = "Ver leads";
    card.addEventListener("click", function () {
      try {
        var t = document.querySelector('[data-tab="marketing"]');
        if (t) t.click(); else if (typeof __gotoTab === "function") __gotoTab("marketing");
      } catch (e) {}
      setTimeout(function () { try { if (window.MaratuMkt && window.MaratuMkt.openLeads) window.MaratuMkt.openLeads(); } catch (e) {} }, 70);
    });
    // divide a linha com o "Próximos 7 dias" (grid de 2 colunas #pnProxGrid)
    var linha = document.getElementById("pnProxGrid");
    if (linha) { linha.appendChild(card); return card; }
    var grid = host.querySelector(".pn-main-grid");
    if (grid && grid.parentNode) grid.parentNode.insertBefore(card, grid.nextSibling);
    else host.appendChild(card);
    return card;
  }
  function renderCard() {
    var card = ensureCard();
    if (!card || !loaded) return;
    var novos = leads.filter(function (l) { return l.status === "novo"; }).length;
    var conv = leads.filter(function (l) { return l.status === "conversando"; }).length;
    var fech = leads.filter(function (l) { return l.status === "fechado"; }).length;
    var perd = leads.filter(function (l) { return l.status === "perdido"; }).length;
    var total = leads.length;
    var taxa = total ? Math.round(fech / total * 100) : 0;
    var pend = leads.filter(function (l) { return aberto(l) && l.followup && l.followup <= todayISO(); }).length;
    var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="vertical-align:-2px"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    var bell = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" style="vertical-align:-1px;margin-right:4px"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
    var eyebrow = '<div style="font-family:inherit;font-weight:800;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:' + PRETO + ';opacity:.55;">Leads</div>';

    if (!total) {
      card.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;">' + eyebrow +
        '<span style="font-family:inherit;font-size:12px;font-weight:800;color:' + LARANJA + ';">Ver ' + arrow + '</span></div>' +
        '<div style="font-family:inherit;font-size:13px;color:' + PRETO + ';opacity:.6;margin-top:10px;">Nenhum lead ainda. Anote quem te chamou no Direct, na feira, no WhatsApp.</div>';
      return;
    }

    var segs = [[novos, LARANJA], [conv, "#2E6BB8"], [fech, "#3E7D4F"], [perd, "#8A8577"]];
    var bar = segs.map(function (s) { return s[0] > 0 ? '<span style="width:' + (s[0] / total * 100) + '%;background:' + s[1] + '"></span>' : ""; }).join("");
    function tile(n, lbl, cor) {
      return '<div style="flex:1;border:1.5px solid ' + PRETO + ';border-radius:12px;padding:12px 5px;text-align:center;">' +
        '<div style="font-family:inherit;font-weight:900;font-size:25px;line-height:1;color:' + cor + ';">' + n + '</div>' +
        '<div style="font-family:inherit;font-size:9.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:' + PRETO + ';opacity:.55;margin-top:6px;">' + lbl + '</div></div>';
    }
    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;">' + eyebrow +
        (pend ? '<div style="font-family:inherit;font-size:11.5px;font-weight:800;color:' + LARANJA + ';">' + bell + pend + ' follow-up' + (pend > 1 ? 's' : '') + ' pra hoje</div>' : '') +
      '</div>' +
      '<div style="display:flex;height:8px;border-radius:20px;overflow:hidden;border:1.5px solid ' + PRETO + ';margin:12px 0 13px;">' + bar + '</div>' +
      '<div style="display:flex;gap:9px;">' +
        tile(novos, "Novos", LARANJA) + tile(conv, "Conversando", "#2E6BB8") + tile(fech, "Fechados", "#3E7D4F") + tile(perd, "Perdidos", "#8A8577") +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:13px;padding-top:11px;border-top:1px solid rgba(13,13,11,.12);font-family:inherit;font-size:11.5px;font-weight:700;color:' + PRETO + ';">' +
        '<span style="opacity:.55;">' + total + ' lead' + (total > 1 ? 's' : '') + ' · ' + taxa + '% de conversão</span>' +
        '<span style="color:' + LARANJA + ';font-weight:800;">Ver todos ' + arrow + '</span>' +
      '</div>';
  }

  function renderAll() { try { renderLista(); } catch (e) {} try { renderCard(); } catch (e) {} }

  /* ---------- boot ---------- */
  function boot() {
    renderAll();
    loadLeads();
    var t = 0, iv = setInterval(function () { t++; ensureSection(); ensureCard(); if (t > 40) clearInterval(iv); }, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
