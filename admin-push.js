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

  var elBtn, elMsg;

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

  /* Linha, nao botao de largura cheia: nome fixo a esquerda e o ESTADO a direita.
     Antes o proprio rotulo mudava ("Ligar"/"Desligar") e nao dava pra saber a situacao
     sem interpretar o verbo. */
  function pinta(sub) {
    if (!elBtn) return;
    function linha(estado, ligado) {
      elBtn.innerHTML = "";
      var n = document.createElement("span");
      n.textContent = "Notificações";
      var e = document.createElement("span");
      e.className = "aj-estado";
      e.textContent = estado;
      elBtn.appendChild(n); elBtn.appendChild(e);
      elBtn.dataset.ligado = ligado ? "1" : "";
    }
    if (!suportado()) {
      elBtn.disabled = true; linha("indisponível", false); return;
    }
    if (!naTelaDeInicio()) {
      elBtn.disabled = true; linha("só no app", false);
      msg("Abra o painel pelo ícone na tela de início para receber notificação.");
      return;
    }
    if (Notification.permission === "denied") {
      elBtn.disabled = true; linha("bloqueado", false);
      msg("Libere em Ajustes > MARATU > Notificações.", true);
      return;
    }
    elBtn.disabled = false;
    linha(sub ? "ligadas" : "desligadas", !!sub);
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

  /* ---------- UI dentro do menu Ajustes ---------- */
  function monta() {
    var menu = document.getElementById("headMenu");
    if (!menu || document.getElementById("ajPushBtn")) return;


    elBtn = document.createElement("button");
    elBtn.className = "hm-btn";
    elBtn.type = "button";
    elBtn.id = "ajPushBtn";
    elBtn.textContent = "Ligar notificações";
    elBtn.addEventListener("click", function () {
      if (elBtn.disabled) return;
      (elBtn.dataset.ligado ? desligar() : ligar());
    });

    elMsg = document.createElement("div");
    elMsg.className = "hm-msg";
    elMsg.id = "ajPushMsg";

    /* Ancora: o #ajManutencao marca onde as ferramentas entram, antes do Sair. Antes eu
       procurava o rotulo "Manutencao" por texto — com o layout de linhas esse rotulo nao
       existe mais e o bloco caia depois do Sair. */
    var antes = document.getElementById("ajManutencao") || document.getElementById("btnSair");
    [elBtn, elMsg].forEach(function (n) {
      if (antes && antes.parentNode) antes.parentNode.insertBefore(n, antes);
      else menu.appendChild(n);
    });

    inscricaoAtual().then(pinta);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", monta);
  } else {
    monta();
  }
})();
