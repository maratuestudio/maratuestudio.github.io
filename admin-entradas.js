/* MARATU admin — modulo "Entradas BTG". Puxa as entradas (Pix recebido) que a
   automacao no-code do BTG Empresas ("Gestao de caixa" -> Google Planilhas) grava
   numa planilha, e cria um lancamento por entrada (dedup por Identificador do BTG).
   Fonte de dados: GET /api/btg/entradas (Worker le o CSV da planilha). Persiste via
   MaratuStore.setLancamentos (alimenta o faturamento). De graca, sem API paga do BTG.
   Ver project_maratu_entradas_btg. */
(function () {
  "use strict";
  if (window.__maratuEntradas) return;
  window.__maratuEntradas = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var PRETO = "#0D0D0B", AREIA = "#F0ECE4", LARANJA = "#C8501A";

  function getLancs() {
    try { if (typeof MaratuStore !== "undefined" && MaratuStore.getLancamentos) return MaratuStore.getLancamentos() || []; } catch (e) {}
    return null;
  }
  function setLancs(a) {
    try { if (typeof MaratuStore !== "undefined" && MaratuStore.setLancamentos) { MaratuStore.setLancamentos(a); return true; } } catch (e) {}
    return false;
  }
  function rerender() {
    ["renderVendas", "renderPainel", "renderUpcoming"].forEach(function (fn) {
      try { if (typeof window[fn] === "function") window[fn](); } catch (e) {}
    });
  }
  function toast(txt) {
    var t = document.createElement("div");
    t.textContent = txt;
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100000;background:" + PRETO +
      ";color:" + AREIA + ";font-family:inherit;font-size:13px;font-weight:700;padding:12px 18px;border-radius:12px;box-shadow:3px 3px 0 0 " + LARANJA + ";max-width:88vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }

  function sync(manual) {
    return fetch(API + "/api/btg/entradas", { headers: { Authorization: "Bearer " } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.entradas) { if (manual) toast("Não consegui ler a planilha do BTG"); return; }
        var atuais = getLancs();
        if (atuais === null) { if (manual) toast("Recarregue a página"); return; }
        var ids = {};
        atuais.forEach(function (l) { ids[String(l.id)] = 1; });
        var novos = d.entradas
          .filter(function (e) { return e.id && !ids[String(e.id)]; })
          .map(function (e) { return { id: e.id, data: e.data, label: e.label, valor: e.valor }; });
        if (!novos.length) { if (manual) toast("Nenhuma entrada nova"); return; }
        setLancs(atuais.concat(novos));
        rerender();
        toast(novos.length + " entrada" + (novos.length > 1 ? "s" : "") + " do BTG importada" + (novos.length > 1 ? "s" : "") + " ✓");
      })
      .catch(function () { if (manual) toast("Erro ao sincronizar o BTG"); });
  }

  function injectBtn() {
    if (document.getElementById("btgSyncBtn")) return true;
    var ql = document.querySelector("#sub-vendas .quick-lanc");
    var host = ql || document.getElementById("sub-vendas");
    if (!host) return false;
    var b = document.createElement("button");
    b.id = "btgSyncBtn"; b.type = "button";
    b.innerHTML = "🔄 Sincronizar entradas do BTG <span style='opacity:.65;font-weight:600'>(Pix recebido)</span>";
    b.style.cssText = "display:block;width:100%;margin:10px 0 0;padding:12px 14px;border:1.5px solid " + PRETO + ";" +
      "border-radius:12px;background:#fff;color:" + PRETO + ";font-family:inherit;font-weight:800;font-size:13.5px;" +
      "cursor:pointer;box-shadow:2px 2px 0 0 " + PRETO + ";-webkit-tap-highlight-color:transparent;text-align:left;";
    b.addEventListener("click", function () {
      b.disabled = true; b.style.opacity = ".6";
      sync(true).then(function () { b.disabled = false; b.style.opacity = "1"; });
    });
    var after = document.getElementById("carneBtn") || ql;
    if (after && after.parentNode) after.parentNode.insertBefore(b, after.nextSibling);
    else host.insertBefore(b, host.firstChild);
    return true;
  }

  function boot() {
    var t = 0, iv = setInterval(function () { t++; if (injectBtn() || t > 40) clearInterval(iv); }, 300);
    // auto-sync 1x quando o MaratuStore estiver pronto
    var s = 0, sv = setInterval(function () {
      s++;
      if (getLancs() !== null) { clearInterval(sv); sync(false); }
      else if (s > 60) clearInterval(sv);
    }, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
