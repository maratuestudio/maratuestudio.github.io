/* MARATU admin — modulo "Orcamento tweaks". Move os Parametros pra dentro de
   Precificar peca: uma engrenagem (SVG) no bloco "Peca" abre #sub-ajustes num modal
   (chama fillAjustes() pra popular; move o elemento real, entao os ids e os listeners
   do core -- pSave/pbSave -- continuam funcionando). Sem emoji. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuOrc) return;
  window.__maratuOrc = true;
  var modal = null;

  function buildModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.id = "parModalBack";
    modal.style.cssText = "position:fixed;inset:0;z-index:99980;display:none;align-items:flex-start;justify-content:center;background:rgba(13,13,11,.55);padding:20px 14px;overflow:auto;-webkit-overflow-scrolling:touch;";
    var card = document.createElement("div");
    card.id = "parModalCard";
    card.style.cssText = "background:var(--areia);border:2px solid var(--preto);border-radius:18px;box-shadow:6px 6px 0 0 var(--preto);max-width:520px;width:100%;padding:16px 16px 18px;margin:auto;";
    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
        '<h3 style="font-family:inherit;font-weight:900;font-size:19px;letter-spacing:-.01em;color:var(--preto);margin:0;">Parâmetros</h3>' +
        '<button type="button" id="parClose" aria-label="Fechar" style="border:none;background:none;font-size:26px;line-height:1;cursor:pointer;color:var(--preto);">×</button>' +
      '</div><div id="parSlot"></div>';
    document.body.appendChild(modal);
    modal.appendChild(card);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    card.querySelector("#parClose").addEventListener("click", closeModal);
  }
  function openModal() {
    buildModal();
    var aj = document.getElementById("sub-ajustes");
    if (!aj) return;
    var slot = modal.querySelector("#parSlot");
    if (aj.parentNode !== slot) slot.appendChild(aj);
    aj.className = "sub-on";
    try { if (typeof fillAjustes === "function") fillAjustes(); } catch (e) {}
    modal.style.display = "flex";
  }
  function closeModal() { if (modal) modal.style.display = "none"; }

  function gearSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  }
  function injectGear() {
    if (document.getElementById("pecaGear")) return true;
    var med = document.getElementById("sub-medida");
    if (!med) return false;
    var pecaTitle = null;
    med.querySelectorAll(".orc-section-title").forEach(function (t) { if (/Peça/i.test(t.textContent)) pecaTitle = t; });
    if (!pecaTitle) return false;
    pecaTitle.style.display = "flex";
    pecaTitle.style.alignItems = "center";
    pecaTitle.style.justifyContent = "space-between";
    var g = document.createElement("button");
    g.id = "pecaGear"; g.type = "button"; g.title = "Parâmetros"; g.setAttribute("aria-label", "Parâmetros");
    g.style.cssText = "flex:0 0 auto;border:1.5px solid var(--preto);background:var(--areia);border-radius:9px;padding:5px;cursor:pointer;display:flex;color:var(--preto);box-shadow:1.5px 1.5px 0 0 var(--preto);-webkit-tap-highlight-color:transparent;";
    g.innerHTML = gearSvg();
    g.addEventListener("click", openModal);
    pecaTitle.appendChild(g);
    return true;
  }

  function boot() {
    var t = 0, iv = setInterval(function () { t++; if (injectGear() || t > 60) clearInterval(iv); }, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
