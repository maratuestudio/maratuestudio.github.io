/* MARATU admin: bloco da impressora 3D no topo do Painel.

   A K1C relata pro Worker a cada 30 s (agente maratu-vigia, dentro dela). Aqui só lemos
   /api/impressora: estado, progresso, quanto falta e a saúde que o vigia do Worker calculou
   (temperatura, ritmo contra a estimativa do Orca, nota da câmera, sinal). O push de
   "pronta", "falhou" e "pausou" sai do Worker; este bloco é a vista ao vivo.
   O bloco entra antes do .wellbeing e não depende do renderPainel do admin.js. */
(function () {
  "use strict";
  if (window.__maratuImpressora) return;
  window.__maratuImpressora = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var ATIVOS = { printing: 1, paused: 1 };
  var dados = null;       // última resposta
  var desvio = 0;         // relógio do aparelho menos o do Worker
  var timer = null;
  var aberto = false;     // histórico à mostra

  var ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7 7.5h10"/><path d="M12 7.5v4"/>' +
    '<path d="M10.5 11.5h3l-1.5 2z"/><path d="M8 17h8"/></svg>';
  var SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function nomeDe(arq) {
    var s = String(arq || "").split("/").pop().replace(/\.gcode$/i, "").replace(/[_-]+/g, " ").trim();
    return s || "Peça sem nome";
  }
  function dur(s) {
    s = Math.max(0, Math.round(Number(s) || 0));
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    if (m === 60) { h++; m = 0; }
    if (h) return h + "h" + (m ? String(m).padStart(2, "0") : "");
    return Math.max(1, m) + " min";
  }
  function hora(ms) {
    return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function quando(iso) {
    if (!iso) return "";
    var d = new Date(iso), hoje = new Date();
    var ontem = new Date(hoje.getTime() - 864e5);
    var dia = d.toDateString() === hoje.toDateString() ? "hoje"
      : d.toDateString() === ontem.toDateString() ? "ontem"
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return dia + " às " + hora(d.getTime());
  }
  // o Klipper fala inglês; os motivos mais comuns em português
  function motivo(m) {
    m = String(m || "").trim();
    if (/runout|filament.*(sensor|detect)/i.test(m)) return "Acabou o filamento";
    if (/not heating at expected rate|heater.*(error|fault)/i.test(m)) return "Aquecimento falhou";
    if (/mcu.*shutdown|lost communication/i.test(m)) return "A placa da impressora desligou";
    if (/move out of range/i.test(m)) return "Movimento fora da área";
    return m;
  }
  function agoraServ() { return Date.now() - desvio; }

  function estilo() {
    if (document.getElementById("pnImpCss")) return;
    var st = document.createElement("style");
    st.id = "pnImpCss";
    st.textContent =
      ".pn-imp{background:var(--areia);border:1.5px solid var(--borda);border-radius:12px;" +
        "box-shadow:3px 3px 0 0 var(--sombra-hard);color:var(--preto);padding:20px 22px;margin-bottom:14px;}" +
      ".pn-imp:empty{display:none;}" +
      ".pn-imp .pi-top{display:flex;align-items:center;gap:16px;}" +
      ".pn-imp .pi-thumb{width:64px;height:64px;flex-shrink:0;border-radius:10px;border:1.5px solid var(--linha-forte);" +
        "background:var(--areia-sombra);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--muted);}" +
      ".pn-imp .pi-thumb img{width:100%;height:100%;object-fit:contain;}" +
      ".pn-imp .pi-thumb svg{width:30px;height:30px;}" +
      ".pn-imp .pi-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}" +
      ".pn-imp .pi-cap{font-family:var(--clother);font-weight:700;font-size:var(--fs-1);letter-spacing:0.22em;" +
        "text-transform:uppercase;color:var(--muted);}" +
      ".pn-imp .pi-nome{font-family:var(--clother);font-weight:900;font-size:var(--fs-4);line-height:1.15;" +
        "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".pn-imp .pi-sub{font-family:var(--clother);font-size:var(--fs-2);color:var(--muted);}" +
      ".pn-imp .pi-pill{font-family:var(--clother);font-weight:700;font-size:var(--fs-1);letter-spacing:0.16em;" +
        "text-transform:uppercase;padding:5px 11px;border-radius:999px;white-space:nowrap;flex-shrink:0;" +
        "border:1.5px solid var(--borda);background:var(--areia);color:var(--preto);}" +
      ".pn-imp .pi-pill.on{background:var(--laranja);border-color:var(--laranja);color:#fff;}" +
      ".pn-imp .pi-pill.pausa{background:var(--sol);border-color:var(--sol);color:#0D0D0B;}" +
      ".pn-imp .pi-pill.erro{background:var(--preto);border-color:var(--preto);color:var(--areia);}" +
      // contorno, não cheio: no tema escuro --laranja e --azul-claro são a mesma cor
      ".pn-imp .pi-pill.pronta{background:transparent;border-color:var(--azul-claro);color:var(--azul-claro);}" +
      ".pn-imp .pi-pill.mudo{color:var(--muted);border-color:var(--linha-forte);}" +
      ".pn-imp .pi-meio{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:16px 0 8px;flex-wrap:wrap;}" +
      ".pn-imp .pi-pct{font-family:var(--clother);font-weight:900;font-size:var(--fs-7);line-height:1;letter-spacing:-0.02em;}" +
      ".pn-imp .pi-falta{font-family:var(--clother);font-weight:700;font-size:var(--fs-3);text-align:right;}" +
      ".pn-imp .pi-falta small{display:block;font-weight:400;font-size:var(--fs-2);color:var(--muted);}" +
      ".pn-imp .pi-barra{height:14px;border:1.5px solid var(--borda);border-radius:999px;background:var(--areia-sombra);overflow:hidden;}" +
      ".pn-imp .pi-barra i{display:block;height:100%;background:var(--laranja);border-radius:999px;" +
        "transition:width .6s cubic-bezier(0.33,1,0.68,1);}" +
      ".pn-imp .pi-barra.pausa i{background:var(--sol);}" +
      ".pn-imp .pi-barra.erro i{background:var(--preto);}" +
      ".pn-imp .pi-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;}" +
      ".pn-imp .pi-chip{font-family:var(--clother);font-size:var(--fs-2);padding:4px 10px;border-radius:999px;" +
        "border:1px solid var(--linha-forte);display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}" +
      ".pn-imp .pi-chip b{font-weight:700;}" +
      ".pn-imp .pi-chip::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--azul-claro);}" +
      ".pn-imp .pi-chip.ruim{border-color:var(--laranja);background:rgba(var(--acento-rgb),0.12);}" +
      ".pn-imp .pi-chip.ruim::before{background:var(--laranja);}" +
      ".pn-imp .pi-hist-btn{background:transparent;border:none;color:var(--muted);cursor:pointer;padding:4px;" +
        "display:inline-flex;align-items:center;flex-shrink:0;}" +
      ".pn-imp .pi-hist-btn svg{width:18px;height:18px;transition:transform .2s;}" +
      ".pn-imp .pi-hist-btn[aria-expanded=true] svg{transform:rotate(180deg);}" +
      ".pn-imp .pi-hist{margin-top:14px;border-top:1px solid var(--linha);padding-top:10px;display:flex;flex-direction:column;}" +
      ".pn-imp .pi-hrow{display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-family:var(--clother);" +
        "font-size:var(--fs-2);border-bottom:1px solid var(--linha);}" +
      ".pn-imp .pi-hrow:last-child{border-bottom:none;}" +
      ".pn-imp .pi-hrow span:first-child{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}" +
      ".pn-imp .pi-hrow span:last-child{color:var(--muted);white-space:nowrap;}" +
      ".pn-imp.compacto{padding:14px 18px;}" +
      ".pn-imp.compacto .pi-thumb{width:44px;height:44px;}" +
      ".pn-imp.compacto .pi-thumb svg{width:24px;height:24px;}" +
      ".pn-imp.compacto .pi-nome{font-size:var(--fs-3);}" +
      // no celular a pílula desce pra baixo do nome, senão o nome corta
      "@media (max-width:560px){.pn-imp{padding:16px 16px;}.pn-imp .pi-thumb{width:52px;height:52px;}" +
        ".pn-imp .pi-pct{font-size:var(--fs-6);}" +
        ".pn-imp .pi-top{display:grid;grid-template-columns:auto minmax(0,1fr) auto;column-gap:12px;row-gap:8px;" +
          "grid-template-areas:'thumb txt seta' 'thumb pill seta';align-items:center;}" +
        ".pn-imp .pi-thumb{grid-area:thumb;align-self:start;}.pn-imp .pi-txt{grid-area:txt;}" +
        ".pn-imp .pi-pill{grid-area:pill;justify-self:start;}.pn-imp .pi-hist-btn{grid-area:seta;align-self:start;}" +
        ".pn-imp .pi-cap{letter-spacing:0.16em;}}";
    document.head.appendChild(st);
  }

  function monta() {
    var painel = document.getElementById("panel-painel");
    if (!painel) return null;
    var box = document.getElementById("pnImp");
    if (box) return box;
    estilo();
    box = document.createElement("div");
    box.className = "pn-imp compacto";
    box.id = "pnImp";
    painel.insertBefore(box, painel.firstChild);
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest(".pi-hist-btn");
      if (!b) return;
      aberto = !aberto;
      desenha();
    });
    return box;
  }

  function histHtml(h) {
    if (!aberto || !h || !h.length) return "";
    var rot = { completed: "pronta", cancelled: "cancelada", error: "falhou", printing: "imprimindo", klippy_shutdown: "falhou" };
    return '<div class="pi-hist">' + h.map(function (x) {
      var st = rot[x.status] || x.status || "";
      var info = st + (x.duracao ? " · " + dur(x.duracao) : "") + (x.inicio ? " · " + quando(x.fim || x.inicio) : "");
      return '<div class="pi-hrow"><span>' + esc(x.nome || nomeDe(x.arquivo)) + '</span><span>' + esc(info) + "</span></div>";
    }).join("") + "</div>";
  }

  function topo(thumb, cap, nome, sub, pill, pillCls, temHist) {
    return '<div class="pi-top">' +
      '<div class="pi-thumb">' + (thumb ? '<img alt="" src="' + esc(thumb) + '">' : ICONE) + "</div>" +
      '<div class="pi-txt"><div class="pi-cap">' + esc(cap) + '</div><div class="pi-nome">' + esc(nome) + "</div>" +
        (sub ? '<div class="pi-sub">' + esc(sub) + "</div>" : "") + "</div>" +
      (pill ? '<span class="pi-pill ' + pillCls + '">' + esc(pill) + "</span>" : "") +
      (temHist ? '<button type="button" class="pi-hist-btn" aria-label="Histórico de impressões" aria-expanded="' + aberto + '">' + SETA + "</button>" : "") +
      "</div>";
  }

  // só troca o HTML quando muda: o botão não perde o foco e a miniatura não recarrega
  function pinta(box, html) {
    if (box.__html !== html) { box.innerHTML = html; box.__html = html; }
  }

  function desenha() {
    var box = monta();
    if (!box) return;
    var j = dados;
    if (!j) return;
    var hist = j.historico || [];

    if (!j.conectada) {
      box.className = "pn-imp compacto";
      pinta(box, topo(null, "Impressora · K1C", "Ainda não conectada",
        "O vigia roda no Mac de casa e aparece aqui quando a impressora ligar.", "Aguardando", "mudo", false));
      return;
    }

    var d = j.estado || {}, a = j.analise || {};
    var passou = Math.max(0, (agoraServ() - Date.parse(j.recebido)) / 1e3);
    if (isNaN(passou)) passou = Infinity;
    var ativo = !!ATIVOS[d.estado];
    var semSinal = passou > (ativo ? 180 : 1800);

    if (ativo) {
      var pct = Math.round((a.progresso || 0) * 100);
      var pausa = d.estado === "paused";
      var falta = a.restante != null ? Math.max(0, a.restante - (pausa ? 0 : passou)) : null;
      var pill = semSinal ? "Sem sinal" : pausa ? "Pausada" : "Imprimindo";
      var cls = semSinal ? "mudo" : pausa ? "pausa" : "on";
      var sub = (d.camada && d.camadas ? "Camada " + d.camada + " de " + d.camadas : "") +
        (d.decorrido ? (d.camada && d.camadas ? " · " : "") + dur(d.decorrido) + " imprimindo" : "");
      var lado;
      if (semSinal) lado = (isFinite(passou) ? "Sem relato há " + dur(passou) : "Sem relato") + "<small>caiu a luz, o Wi-Fi, ou o Mac saiu de casa</small>";
      else if (pausa) lado = "Esperando você<small>" + esc(motivo(d.msg) || "confere a K1C") + "</small>";
      else if (falta != null) lado = "Faltam " + dur(falta) + "<small>pronta às " + hora(Date.now() + falta * 1e3) + "</small>";
      else lado = "Calculando<small>o tempo aparece depois dos primeiros minutos</small>";

      var chips = (j.saude || []).filter(function (s) { return s.k !== "sinal" || !s.ok; }).map(function (s) {
        return '<span class="pi-chip' + (s.ok ? "" : " ruim") + '"><b>' + esc(s.rot) + "</b> " + esc(s.txt) + "</span>";
      }).join("");

      box.className = "pn-imp";
      pinta(box, topo(j.thumb, "Impressora · K1C", nomeDe(d.arquivo), sub, pill, cls, hist.length > 1) +
        '<div class="pi-meio"><div class="pi-pct">' + pct + '%</div><div class="pi-falta">' + lado + "</div></div>" +
        '<div class="pi-barra' + (pausa ? " pausa" : "") + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
          '<i style="width:' + pct + '%"></i></div>' +
        (chips ? '<div class="pi-chips">' + chips + "</div>" : "") +
        histHtml(hist));
      return;
    }

    // parada: mostra como acabou a última
    var ult = hist[0];
    var nome = "Livre", sub2 = "", pill2 = "Livre", cls2 = "mudo";
    if (d.estado === "error") {
      nome = "Com erro"; pill2 = "Erro"; cls2 = "erro"; sub2 = motivo(d.msg) || "Confere a tela da impressora.";
    } else if (ult && ult.fim) {
      var recente = agoraServ() - Date.parse(ult.fim) < 6 * 3600e3;
      nome = recente ? (ult.nome || nomeDe(ult.arquivo)) : "Livre";
      var como = ult.status === "completed" ? "Pronta" : ult.status === "cancelled" ? "Cancelada" : "Falhou";
      sub2 = (recente ? como : "Última: " + (ult.nome || nomeDe(ult.arquivo)) + ", " + como.toLowerCase()) +
        " " + quando(ult.fim) + (ult.duracao ? " · " + dur(ult.duracao) : "");
      if (recente) { pill2 = como; cls2 = ult.status === "completed" ? "pronta" : ult.status === "cancelled" ? "mudo" : "erro"; }
    }
    if (semSinal) { pill2 = "Sem sinal"; cls2 = "mudo"; sub2 = "Último relato " + quando(j.recebido) + (sub2 ? " · " + sub2 : ""); }
    box.className = "pn-imp compacto";
    // "Livre" no título e na pílula seria repetir
    pinta(box, topo(null, "Impressora · K1C", nome, sub2, pill2 === nome ? "" : pill2, cls2, hist.length > 0) + histHtml(hist));
  }

  function visivel() {
    var p = document.getElementById("panel-painel");
    return document.visibilityState === "visible" && p && p.classList.contains("on");
  }

  function agenda() {
    clearTimeout(timer);
    var ativo = dados && dados.estado && ATIVOS[dados.estado.estado];
    timer = setTimeout(busca, ativo ? 20e3 : 120e3);
  }

  var buscando = false;
  function logado() {
    try { return !!localStorage.getItem("maratu.token"); } catch (e) { return false; }
  }
  function busca() {
    // sem login o Worker responde 401 e conta como tentativa de invasão no limitador
    if (!visivel() || !logado() || buscando) { agenda(); return; }
    buscando = true;
    fetch(API + "/api/impressora")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (j.agora) desvio = Date.now() - Date.parse(j.agora);
        dados = j;
        desenha();
      })
      .catch(function () { /* rede caiu: fica a última vista */ })
      .then(function () { buscando = false; agenda(); });
  }

  // o "faltam" anda sozinho entre uma busca e outra
  setInterval(function () { if (dados && visivel()) desenha(); }, 15e3);
  document.addEventListener("visibilitychange", function () { if (visivel()) busca(); });
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-tab="painel"]');
    if (t) setTimeout(busca, 50);
  }, true);

  function inicia() {
    if (!monta()) { setTimeout(inicia, 500); return; }
    busca();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicia);
  else inicia();
})();
