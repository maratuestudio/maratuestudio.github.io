/* MARATU admin — tirar imagem de produto, e não deixar lixo no balde.

   Antes daqui só dava pra trocar: escolher outro arquivo. A imagem antiga continuava no
   R2 para sempre, e a de hover, uma vez posta, não saía mais do produto.

   O que este módulo faz:
     · põe um "remover" em cada slot de imagem do formulário;
     · ao salvar, manda imagem_hover null quando ela foi removida;
     · apaga do R2 o arquivo que saiu de cena — o que foi removido e o que foi trocado —
       junto com a miniatura e a versão com marca d'água.

   Sem cirurgia no admin.js: a seção é injetada e o fetch é embrulhado, no mesmo desenho
   do admin-prevenda.js e do admin-peca.js. Ver reference_maratu_admin_js. */
(function () {
  "use strict";
  if (window.__maratuImgLimpa) return;
  window.__maratuImgLimpa = true;

  var API = "https://maratu-api.raphaelnascimento.workers.dev";
  var imagens = {};          // id do produto -> { principal, hover }
  var removido = { hover: false, principal: false };

  function idAtual() {
    var el = document.getElementById("fId");
    return el ? String(el.value || "") : "";
  }
  function daPeca() { return imagens[idAtual()] || {}; }

  function guarda(produtos) {
    setTimeout(mostraBotoes, 60);
    (produtos || []).forEach(function (p) {
      if (!p || p.id == null) return;
      imagens[String(p.id)] = {
        principal: p.imagem_principal || "",
        hover: p.imagem_hover || ""
      };
    });
  }

  // some com o arquivo e com os dois derivados; falha aqui não trava o salvamento
  function apaga(chaves) {
    var lista = (chaves || []).filter(function (k) {
      return typeof k === "string" && k.indexOf("products/") === 0;
    });
    if (!lista.length) return;
    try {
      window.fetch(API + "/api/img/apagar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chaves: lista })
      }).catch(function () {});
    } catch (e) {}
  }

  // ── os botões no formulário ──
  function monta() {
    var alvo = document.getElementById("fImgHoverPreview");
    if (!alvo || document.getElementById("btnImgHoverX")) return false;

    [["principal", "fImgPrincipalPreview"], ["hover", "fImgHoverPreview"]].forEach(function (par) {
      var qual = par[0];
      var prev = document.getElementById(par[1]);
      if (!prev || !prev.parentNode) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn danger";   // mesma classe do "Excluir produto"
      b.id = "btnImg" + (qual === "hover" ? "Hover" : "Principal") + "X";
      b.textContent = "remover";
      b.style.cssText = "padding:5px 10px;font-size:10px;margin-left:auto;align-self:center;";
      // o slot é um <label for=input file>: clique dentro dele abriria o seletor
      b.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        limpa(qual);
      });
      prev.parentNode.appendChild(b);

      /* Escolher arquivo novo desfaz a remoção. Sem isto, remover e em seguida escolher
         outra imagem subia o arquivo pro R2 e salvava o produto sem hover: a imagem nova
         nascia órfã, que é justamente o que este módulo existe pra evitar. */
      var input = document.getElementById(qual === "hover" ? "fImgHover" : "fImgPrincipal");
      if (input) input.addEventListener("change", function () {
        if (input.files && input.files.length) {
          removido[qual] = false;
          var h = document.getElementById(qual === "hover" ? "fImgHoverHint" : "fImgPrincipalHint");
          if (h) h.textContent = "imagem nova escolhida";
        }
        setTimeout(mostraBotoes, 50);
      });
    });
    return true;
  }

  /* O botão só aparece quando há imagem: num slot vazio ele seria um convite pra nada. */
  function mostraBotoes() {
    var atual = daPeca();
    [["principal", "btnImgPrincipalX", "fImgPrincipal"], ["hover", "btnImgHoverX", "fImgHover"]]
      .forEach(function (par) {
        var b = document.getElementById(par[1]);
        if (!b) return;
        var input = document.getElementById(par[2]);
        var temArquivo = input && input.files && input.files.length > 0;
        var tem = (!removido[par[0]] && !!atual[par[0]]) || temArquivo;
        b.style.display = tem ? "" : "none";
      });
  }

  function limpa(qual) {
    var atual = daPeca()[qual] || "";
    if (qual === "principal" && !confirm(
      "Remover a imagem principal? O produto não salva sem uma; escolha outra antes de salvar.")) return;
    removido[qual] = true;

    var prev = document.getElementById(qual === "hover" ? "fImgHoverPreview" : "fImgPrincipalPreview");
    if (prev) {
      prev.innerHTML = "";
      prev.style.backgroundImage = "";
      prev.className = "up-preview empty";
      prev.textContent = "img";
    }
    var input = document.getElementById(qual === "hover" ? "fImgHover" : "fImgPrincipal");
    if (input) input.value = "";
    var hint = document.getElementById(qual === "hover" ? "fImgHoverHint" : "fImgPrincipalHint");
    if (hint) {
      /* A principal é obrigatória: salvar sem escolher outra mantém a que já estava.
         Prometer que ela "some ao salvar" seria mentira. */
      hint.textContent = qual === "principal"
        ? "escolha outra imagem — sem isso a atual continua"
        : (atual ? "removida — some do site ao salvar" : "nenhuma imagem");
    }
    mostraBotoes();
    // o arquivo só sai do balde quando o produto for salvo, senão desistir da edição
    // deixaria o produto apontando pra uma imagem que não existe mais
  }

  // ── o fetch ──
  var _f = window.fetch;
  window.fetch = function (input, init) {
    var url = "";
    try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) {}
    var metodo = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var ehCatalogo = /\/api\/catalog(\/[^/?]+)?(\?|$)/.test(url) && !/\/(upload|reorder|layout|all)\b/.test(url);

    if (ehCatalogo && (metodo === "POST" || metodo === "PUT") && init && typeof init.body === "string") {
      try {
        var corpo = JSON.parse(init.body);
        if (corpo && typeof corpo === "object" && corpo.nome) {
          var antes = daPeca();
          var inputHover = document.getElementById("fImgHover");
          var escolheuHover = inputHover && inputHover.files && inputHover.files.length;
          if (removido.hover && !escolheuHover) corpo.imagem_hover = null;
          init = Object.assign({}, init, { body: JSON.stringify(corpo) });

          /* Some com o que saiu de cena: o removido e o que foi trocado por outro
             arquivo. Compara com o que estava gravado antes desta edição. */
          var sobrando = [];
          if (antes.hover && corpo.imagem_hover !== antes.hover) sobrando.push(antes.hover);
          if (antes.principal && corpo.imagem_principal !== antes.principal) sobrando.push(antes.principal);
          if (sobrando.length) setTimeout(function () { apaga(sobrando); }, 1200);
          removido = { hover: false, principal: false };
        }
      } catch (e) {}
    }
    var r = _f.call(this, input, init);
    if (/\/api\/catalog(\/all)?(\?|$)/.test(url) && metodo === "GET") {
      r.then(function (res) {
        try { res.clone().json().then(function (d) { if (d && d.produtos) guarda(d.produtos); }).catch(function () {}); } catch (e) {}
      }).catch(function () {});
    }
    return r;
  };

  function boot() {
    var modal = document.getElementById("prodModal");
    if (!modal) return false;
    if (!monta()) return false;
    new MutationObserver(function () {
      if (!modal.classList.contains("on")) return;
      // formulário reaberto: nada foi removido ainda nesta rodada
      removido = { hover: false, principal: false };
      setTimeout(mostraBotoes, 60);
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    return true;
  }
  var t = 0, iv = setInterval(function () { if (boot() || ++t > 60) clearInterval(iv); }, 250);
})();
