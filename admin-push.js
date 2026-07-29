/* MARATU admin — modulo "Notificacoes". Liga o push do PWA: pede permissao, inscreve no
   PushManager e manda a inscricao pro Worker (POST /api/push/sub). Quem dispara e o cron
   do Worker: resumo as 9h, vespera as 18h e aviso 30 min antes de cada hora marcada.
   No iOS so funciona com o painel aberto pela tela de inicio (standalone) — no Safari
   comum a API existe mas a inscricao falha. Injeta a UI dentro do menu Ajustes, nao toca
   no admin.js minificado. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuPush) return;
  window.__maratuPush = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var CHAVE_PUB = "BMjhxXrHo64T09xYPoBZcPq92bv7_FBFTtWCKae0pPZf2clPvPFW6ZA6gNrtfl37-4KFG1TdNZTlPJcGhzKPTzQ";

  var elBtn, elTeste, elMsg;

  /* ---------- utils ---------- */
  function b64urlParaBytes(s) {
    s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesParaB64url(buf) {
    var arr = new Uint8Array(buf), bin = "";
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function naTelaDeInicio() {
    try {
      return window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    } catch (e) { return false; }
  }
  function suportado() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }
  function msg(t, erro) {
    if (!elMsg) return;
    elMsg.textContent = t || "";
    elMsg.style.color = erro ? "#C8501A" : "";
  }

  /* ---------- API ---------- */
  function apiPost(rota, corpo) {
    return fetch(API + rota, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " },
      body: JSON.stringify(corpo || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function chavePublica() {
    return fetch(API + "/api/push/chave", { headers: { Authorization: "Bearer " } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.publica) || CHAVE_PUB; })
      .catch(function () { return CHAVE_PUB; });
  }

  /* ---------- estado ---------- */
  function inscricaoAtual() {
    if (!suportado()) return Promise.resolve(null);
    return navigator.serviceWorker.ready
      .then(function (reg) { return reg.pushManager.getSubscription(); })
      .catch(function () { return null; });
  }

  function pinta(sub) {
    if (!elBtn) return;
    if (!suportado()) {
      elBtn.disabled = true;
      elBtn.textContent = "Não disponível neste navegador";
      return;
    }
    if (!naTelaDeInicio()) {
      elBtn.disabled = true;
      elBtn.textContent = "Abra pelo ícone da tela de início";
      msg("O iOS só entrega push para o painel instalado na tela de início.");
      return;
    }
    if (Notification.permission === "denied") {
      elBtn.disabled = true;
      elBtn.textContent = "Bloqueado nos Ajustes do iPhone";
      msg("Libere em Ajustes > MARATU > Notificações.", true);
      return;
    }
    elBtn.disabled = false;
    elBtn.textContent = sub ? "Desligar notificações" : "Ligar notificações";
    elBtn.dataset.ligado = sub ? "1" : "";
    if (elTeste) elTeste.style.display = sub ? "" : "none";
  }

  /* ---------- ligar e desligar ---------- */
  function ligar() {
    msg("Pedindo permissão…");
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") { msg("Permissão negada.", true); pinta(null); return; }
      return Promise.all([navigator.serviceWorker.ready, chavePublica()]).then(function (r) {
        return r[0].pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64urlParaBytes(r[1])
        });
      }).then(function (sub) {
        return apiPost("/api/push/sub", {
          endpoint: sub.endpoint,
          p256dh: bytesParaB64url(sub.getKey("p256dh")),
          auth: bytesParaB64url(sub.getKey("auth"))
        }).then(function (d) {
          if (d && d.error) throw new Error(d.error);
          msg("Ligado. Chega resumo às 9h, véspera às 18h e aviso 30 min antes.");
          pinta(sub);
        });
      });
    }).catch(function (e) {
      msg("Falhou: " + (e && e.message || e), true);
    });
  }

  function desligar() {
    msg("Desligando…");
    return inscricaoAtual().then(function (sub) {
      if (!sub) { pinta(null); return; }
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () {
        return apiPost("/api/push/unsub", { endpoint: ep });
      }).then(function () { msg("Desligado."); pinta(null); });
    }).catch(function (e) { msg("Falhou: " + (e && e.message || e), true); });
  }

  function teste() {
    msg("Enviando…");
    return apiPost("/api/push/teste", {}).then(function (d) {
      if (d && d.enviados) msg("Enviado para " + d.enviados + " aparelho(s).");
      else msg("Nada enviado. " + JSON.stringify(d).slice(0, 120), true);
    }).catch(function (e) { msg("Falhou: " + (e && e.message || e), true); });
  }

  /* ---------- UI dentro do menu Ajustes ---------- */
  function monta() {
    var menu = document.getElementById("headMenu");
    if (!menu || document.getElementById("ajPushBtn")) return;

    var lbl = document.createElement("span");
    lbl.className = "hm-lbl";
    lbl.textContent = "Notificações";

    elBtn = document.createElement("button");
    elBtn.className = "hm-btn";
    elBtn.type = "button";
    elBtn.id = "ajPushBtn";
    elBtn.textContent = "Ligar notificações";
    elBtn.addEventListener("click", function () {
      if (elBtn.disabled) return;
      (elBtn.dataset.ligado ? desligar() : ligar());
    });

    elTeste = document.createElement("button");
    elTeste.className = "hm-btn";
    elTeste.type = "button";
    elTeste.id = "ajPushTeste";
    elTeste.textContent = "Enviar teste";
    elTeste.style.display = "none";
    elTeste.addEventListener("click", teste);

    elMsg = document.createElement("div");
    elMsg.className = "hm-msg";
    elMsg.id = "ajPushMsg";

    // Entra logo antes de "Manutenção" pra ficar perto de Calendário.
    var antes = null;
    var lbls = menu.querySelectorAll(".hm-lbl");
    for (var i = 0; i < lbls.length; i++) {
      if (/Manuten/i.test(lbls[i].textContent)) { antes = lbls[i]; break; }
    }
    [lbl, elBtn, elTeste, elMsg].forEach(function (n) {
      if (antes) menu.insertBefore(n, antes); else menu.appendChild(n);
    });

    inscricaoAtual().then(pinta);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", monta);
  } else {
    monta();
  }
})();
