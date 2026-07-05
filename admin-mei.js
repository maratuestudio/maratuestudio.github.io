/* MARATU · MEI · bloco de obrigações
   Depende de /admin.js só pro fetch estar com credentials:'include' via monkey-patch. */
(function(){
  const API = "https://maratu-api.raphaelnascimento.workers.dev";
  const $ = (id)=>document.getElementById(id);
  const MONTH_ABBR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const MONTH_FULL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

  /* Dialog MARATU (usa .modal-back existente). Sub .alert/.confirm/.prompt nativos. */
  function mrtDialog(opts){
    return new Promise((resolve)=>{
      const back = document.createElement("div");
      back.className = "modal-back on";
      back.setAttribute("role","dialog");
      back.setAttribute("aria-modal","true");
      const showInput = opts.kind === "prompt";
      const okText = opts.okText || (opts.kind === "alert" ? "ok" : "confirmar");
      const cancelText = opts.cancelText || "cancelar";
      const title = opts.title || "MARATU · MEI";
      back.innerHTML =
        '<div class="modal-card" style="max-width:460px">'+
          '<div class="modal-head">'+
            '<h3></h3>'+
            '<button type="button" class="modal-close" data-mrt-cancel aria-label="Fechar">×</button>'+
          '</div>'+
          '<div style="font-family:var(--clother); font-size:0.95rem; color:var(--preto); line-height:1.5; margin-bottom:18px" data-mrt-msg></div>'+
          (showInput ? '<input type="text" data-mrt-input style="width:100%; padding:12px 14px; background:var(--areia); border:1.5px solid var(--borda); border-radius:8px; font-family:var(--clother); font-size:1rem; color:var(--preto); box-shadow:2px 2px 0 0 var(--sombra-hard); margin-bottom:18px" />' : '')+
          '<div style="display:flex; justify-content:flex-end; gap:10px">'+
            (opts.kind === "alert" ? '' : '<button type="button" class="btn" data-mrt-cancel style="background:var(--areia)"></button>')+
            '<button type="button" class="btn" data-mrt-ok style="background:var(--preto); color:var(--areia)"></button>'+
          '</div>'+
        '</div>';
      back.querySelector("h3").textContent = title;
      back.querySelector("[data-mrt-msg]").textContent = opts.message || "";
      const okBtn = back.querySelector("[data-mrt-ok]"); okBtn.textContent = okText;
      const cancelBtn = back.querySelector("button[data-mrt-cancel]:not(.modal-close)");
      if(cancelBtn) cancelBtn.textContent = cancelText;
      const inp = back.querySelector("[data-mrt-input]");
      if(inp && opts.defaultValue != null) inp.value = String(opts.defaultValue);

      function close(result){
        back.remove();
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }
      function onKey(ev){
        if(ev.key === "Escape") close({ ok:false, value:null });
        if(ev.key === "Enter"){ ev.preventDefault(); close({ ok:true, value: inp ? inp.value : null }); }
      }
      back.querySelectorAll("[data-mrt-cancel]").forEach(b=>b.addEventListener("click", ()=>close({ ok:false, value:null })));
      okBtn.addEventListener("click", ()=>close({ ok:true, value: inp ? inp.value : null }));
      back.addEventListener("click", (ev)=>{ if(ev.target === back) close({ ok:false, value:null }); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(back);
      if(inp){ inp.focus(); inp.select(); } else { okBtn.focus(); }
    });
  }
  const mrtAlert = (message, title)=>mrtDialog({ kind:"alert", message, title });
  const mrtConfirm = async (message, title)=>(await mrtDialog({ kind:"confirm", message, title })).ok;
  const mrtPrompt = async (message, defaultValue, title)=>{
    const r = await mrtDialog({ kind:"prompt", message, defaultValue, title });
    return r.ok ? r.value : null;
  };

  function brl(centavos){
    const v = Number(centavos||0) / 100;
    return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  }
  function parseCurrencyToCentavos(str){
    if(str == null) return 0;
    const s = String(str).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"");
    const n = parseFloat(s);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }
  async function jsonFetch(path, opts){
    const r = await fetch(API + path, Object.assign({ credentials:"include" }, opts||{}));
    if(r.status === 401){ location.replace("/login.html?expired=1"); throw new Error("unauth"); }
    return r.json();
  }

  let cachedDash = null;

  async function loadDashboard(){
    try {
      const d = await jsonFetch("/api/mei/dashboard");
      cachedDash = d;
      render(d);
    } catch(e){ console.error("mei dashboard:", e); }
  }

  function render(d){
    const block = $("meiBlock");
    if(!block) return;
    block.style.display = "";
    // DAS mês corrente (o último da lista das_meses)
    const das = d.das_meses[d.das_meses.length - 1];
    $("meiDasMes").textContent = MONTH_FULL[das.month-1] + "/" + String(das.year).slice(-2);
    const dasCard = $("meiDasCard");
    dasCard.classList.remove("ok","warn","danger");
    if(das.paid){
      $("meiDasVal").textContent = brl(das.valor_centavos) + " ✓";
      $("meiDasSub").textContent = "pago em " + fmtDate(das.paid_at);
      $("meiDasBtn").textContent = "desmarcar";
      $("meiDasBtn").classList.add("ghost");
      dasCard.classList.add("ok");
    } else {
      $("meiDasVal").textContent = brl(d.config.das_valor_centavos || 0);
      if(das.atrasado){
        $("meiDasSub").textContent = "ATRASADO — venceu " + fmtDate(das.vencimento) + " (" + Math.abs(das.dias_ate_vencimento) + "d)";
        dasCard.classList.add("danger");
      } else if(das.dias_ate_vencimento <= 7){
        $("meiDasSub").textContent = "vence em " + das.dias_ate_vencimento + "d (" + fmtDate(das.vencimento) + ")";
        dasCard.classList.add("warn");
      } else {
        $("meiDasSub").textContent = "vence " + fmtDate(das.vencimento) + " (" + das.dias_ate_vencimento + "d)";
      }
      $("meiDasBtn").textContent = "marcar pago";
      $("meiDasBtn").classList.remove("ghost");
    }
    $("meiDasBtn").dataset.year = das.year;
    $("meiDasBtn").dataset.month = das.month;
    $("meiDasBtn").dataset.paid = das.paid ? "1" : "0";

    // Faturamento
    const f = d.faturamento;
    $("meiFatAno").textContent = f.ano;
    $("meiFatVal").textContent = brl(f.total_ano_centavos);
    const bar = $("meiFatBar");
    bar.style.width = Math.min(100, f.pct_usado) + "%";
    bar.classList.remove("warn","danger");
    if(f.pct_usado >= 90) bar.classList.add("danger");
    else if(f.pct_usado >= 70) bar.classList.add("warn");
    const limite = brl(f.limite_anual_centavos);
    let sub = f.pct_usado + "% do limite " + limite;
    if(f.projecao_anual_centavos > 0){
      sub += " · projeção " + brl(f.projecao_anual_centavos) + " (" + f.pct_projecao + "%)";
    }
    $("meiFatSub").textContent = sub;
    $("meiFatCard").classList.remove("warn","danger");
    if(f.pct_projecao >= 90 || f.pct_usado >= 90) $("meiFatCard").classList.add("danger");
    else if(f.pct_projecao >= 70) $("meiFatCard").classList.add("warn");

    // DASN
    const n = d.dasn;
    $("meiDasnAno").textContent = n.year;
    const dasnCard = $("meiDasnCard");
    dasnCard.classList.remove("ok","warn","danger");
    if(n.done){
      $("meiDasnVal").textContent = "entregue ✓";
      $("meiDasnSub").textContent = "em " + fmtDate(n.done_at);
      $("meiDasnBtn").style.display = "";
      $("meiDasnBtn").textContent = "desmarcar";
      $("meiDasnBtn").classList.add("ghost");
      dasnCard.classList.add("ok");
    } else {
      if(n.atrasado){
        $("meiDasnVal").textContent = "ATRASADA";
        $("meiDasnSub").textContent = "prazo era " + fmtDate(n.deadline) + " (" + Math.abs(n.dias_ate_deadline) + "d)";
        $("meiDasnBtn").style.display = "";
        $("meiDasnBtn").textContent = "marcar entregue";
        $("meiDasnBtn").classList.remove("ghost");
        dasnCard.classList.add("danger");
      } else if(n.dias_ate_deadline <= 60){
        $("meiDasnVal").textContent = "pendente";
        $("meiDasnSub").textContent = n.dias_ate_deadline + " dias até " + fmtDate(n.deadline);
        $("meiDasnBtn").style.display = "";
        $("meiDasnBtn").textContent = "marcar entregue";
        $("meiDasnBtn").classList.remove("ghost");
        if(n.dias_ate_deadline <= 15) dasnCard.classList.add("danger");
        else if(n.dias_ate_deadline <= 30) dasnCard.classList.add("warn");
      } else {
        $("meiDasnVal").textContent = "—";
        $("meiDasnSub").textContent = "prazo " + fmtDate(n.deadline) + " (" + n.dias_ate_deadline + "d)";
        $("meiDasnBtn").style.display = "none";
      }
    }
    $("meiDasnBtn").dataset.year = n.year;
    $("meiDasnBtn").dataset.done = n.done ? "1" : "0";

    // Histórico (últimos 6 meses)
    const hist = $("meiHistory");
    hist.innerHTML = "";
    d.das_meses.forEach((m, idx)=>{
      const p = document.createElement("button");
      p.type = "button";
      p.className = "mei-pill";
      if(m.paid) p.classList.add("paid");
      else if(m.atrasado) p.classList.add("late");
      if(idx === d.das_meses.length - 1) p.classList.add("current");
      p.textContent = MONTH_ABBR[m.month-1] + "/" + String(m.year).slice(-2) + " " + (m.paid ? "✓" : (m.atrasado ? "!" : "○"));
      p.dataset.year = m.year;
      p.dataset.month = m.month;
      p.dataset.paid = m.paid ? "1" : "0";
      p.addEventListener("click", ()=>toggleDasFromPill(m));
      hist.appendChild(p);
    });
  }

  function fmtDate(iso){
    if(!iso) return "—";
    const [y,m,d] = String(iso).slice(0,10).split("-");
    return d + "/" + m + "/" + String(y).slice(-2);
  }

  async function toggleDasFromPill(m){
    if(m.paid){
      if(!(await mrtConfirm("Desmarcar DAS de " + MONTH_FULL[m.month-1] + "/" + m.year + " como não pago?"))) return;
      await jsonFetch("/api/mei/das/unpay", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ year:m.year, month:m.month })});
    } else {
      const cfg = cachedDash && cachedDash.config;
      if(!cfg || !cfg.das_valor_centavos){
        await mrtAlert("Antes de marcar como pago, configure o valor do DAS em 'config'.");
        return;
      }
      const v = await mrtPrompt("Valor pago do DAS (R$)?", (cfg.das_valor_centavos/100).toFixed(2).replace(".",","));
      if(v == null) return;
      const centavos = parseCurrencyToCentavos(v);
      if(centavos <= 0){ await mrtAlert("Valor inválido."); return; }
      await jsonFetch("/api/mei/das/pay", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ year:m.year, month:m.month, valor_centavos:centavos })});
    }
    await loadDashboard();
  }

  // Botão principal DAS
  document.addEventListener("click", async (ev)=>{
    const t = ev.target;
    if(t.id === "meiDasBtn"){
      const year = Number(t.dataset.year), month = Number(t.dataset.month), paid = t.dataset.paid === "1";
      await toggleDasFromPill({ year, month, paid });
    }
    if(t.id === "meiDasnBtn"){
      const year = Number(t.dataset.year), done = t.dataset.done === "1";
      if(done){
        if(!(await mrtConfirm("Desmarcar DASN " + year + " como entregue?"))) return;
        await jsonFetch("/api/mei/dasn/undo", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ year })});
      } else {
        await jsonFetch("/api/mei/dasn/done", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ year })});
      }
      await loadDashboard();
    }
    if(t.id === "meiDetailBtn"){ openDetailModal(); }
    if(t.id === "meiConfigBtn"){ openConfigModal(); }
    if(t.dataset && t.dataset.meiClose !== undefined){
      $("meiDetailModal").classList.remove("on");
      $("meiConfigModal").classList.remove("on");
    }
    if(t.classList && t.classList.contains("mei-mo-tab")){
      document.querySelectorAll(".mei-mo-tab").forEach(x=>x.classList.remove("on"));
      t.classList.add("on");
      const tab = t.dataset.meiTab;
      $("meiTabDas").style.display = tab === "das" ? "" : "none";
      $("meiTabFat").style.display = tab === "fat" ? "" : "none";
    }
  });

  // Modal detalhes
  function openDetailModal(){
    if(!cachedDash) return;
    $("meiDetailAno").textContent = cachedDash.ano_atual;
    renderDasTable();
    renderFatTable();
    $("meiDetailModal").classList.add("on");
  }
  function renderDasTable(){
    const rows = [];
    const cfg = cachedDash.config;
    // Gera 12 meses do ano atual
    for(let m=1; m<=12; m++){
      const found = cachedDash.das_meses.find(x=>x.year === cachedDash.ano_atual && x.month === m);
      // Para meses fora dos últimos 6, fazemos GET pontual? Simplificação: mostra apenas os da lista + placeholder
      rows.push({ year: cachedDash.ano_atual, month: m, data: found });
    }
    let html = '<table><thead><tr><th>Mês</th><th class="num">Valor pago</th><th>Pago em</th><th></th></tr></thead><tbody>';
    for(const r of rows){
      const d = r.data;
      if(d && d.paid){
        html += `<tr><td>${MONTH_FULL[r.month-1]}</td><td class="num">${brl(d.valor_centavos)}</td><td>${fmtDate(d.paid_at)}</td>` +
                `<td><button class="small danger" data-mei-das-unpay="${r.year}-${r.month}">desmarcar</button></td></tr>`;
      } else {
        html += `<tr><td>${MONTH_FULL[r.month-1]}</td><td class="num" style="color:var(--muted)">—</td><td style="color:var(--muted)">—</td>` +
                `<td><button class="small" data-mei-das-pay="${r.year}-${r.month}">marcar pago (${brl(cfg.das_valor_centavos)})</button></td></tr>`;
      }
    }
    html += '</tbody></table>';
    $("meiTabDas").innerHTML = html;
    $("meiTabDas").querySelectorAll("[data-mei-das-pay]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        const [y,m] = b.dataset.meiDasPay.split("-").map(Number);
        await toggleDasFromPill({ year:y, month:m, paid:false });
        openDetailModal();
      });
    });
    $("meiTabDas").querySelectorAll("[data-mei-das-unpay]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        const [y,m] = b.dataset.meiDasUnpay.split("-").map(Number);
        await toggleDasFromPill({ year:y, month:m, paid:true });
        openDetailModal();
      });
    });
  }
  function renderFatTable(){
    const f = cachedDash.faturamento;
    let html = '<table><thead><tr><th>Mês</th><th class="num">Auto (D1)</th><th class="num">Ajuste</th><th class="num">Total</th><th></th></tr></thead><tbody>';
    for(const m of f.meses){
      html += `<tr>` +
        `<td>${MONTH_FULL[m.month-1]}</td>` +
        `<td class="num">${brl(m.auto_centavos)} <small style="color:var(--muted)">(${m.lancamentos})</small></td>` +
        `<td class="num"><input type="text" data-mei-fat-mo="${m.month}" value="${m.ajuste_centavos ? (m.ajuste_centavos/100).toFixed(2).replace('.',',') : ''}" placeholder="0,00" style="max-width:110px" /></td>` +
        `<td class="num"><b>${brl(m.total_centavos)}</b></td>` +
        `<td><button class="small" data-mei-fat-save="${m.month}">salvar</button></td>` +
        `</tr>`;
    }
    html += `<tr><td colspan="3" style="text-align:right;color:var(--muted);font-size:0.75rem">Total ${f.ano}</td><td class="num"><b>${brl(f.total_ano_centavos)}</b></td><td></td></tr>`;
    html += '</tbody></table>';
    html += `<p style="font-size:0.75rem;color:var(--muted);margin-top:10px">Auto = soma dos <code>lancamentos</code> positivos do mês. Ajuste = adicional/desconto manual (aceita valor negativo).</p>`;
    $("meiTabFat").innerHTML = html;
    $("meiTabFat").querySelectorAll("[data-mei-fat-save]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        const mo = Number(b.dataset.meiFatSave);
        const input = $("meiTabFat").querySelector(`[data-mei-fat-mo="${mo}"]`);
        const centavos = parseCurrencyToCentavos(input.value);
        await jsonFetch("/api/mei/faturamento/ajuste", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ year: cachedDash.ano_atual, month: mo, ajuste_centavos: centavos })
        });
        await loadDashboard();
        openDetailModal();
      });
    });
  }

  // Modal config
  function openConfigModal(){
    if(!cachedDash) return;
    const c = cachedDash.config;
    $("meiCfgDasValor").value = c.das_valor_centavos ? (c.das_valor_centavos/100).toFixed(2) : "";
    $("meiCfgLimite").value = c.limite_anual_centavos ? (c.limite_anual_centavos/100).toFixed(2) : "";
    $("meiCfgVencDia").value = c.das_vencimento_dia || 20;
    $("meiCfgDasnMes").value = c.dasn_deadline_month || 5;
    $("meiCfgDasnDia").value = c.dasn_deadline_day || 31;
    $("meiCfgMsg").textContent = "";
    $("meiConfigModal").classList.add("on");
  }
  document.addEventListener("click", async (ev)=>{
    if(ev.target.id !== "meiCfgSave") return;
    const patch = {
      das_valor_centavos: parseCurrencyToCentavos($("meiCfgDasValor").value),
      limite_anual_centavos: parseCurrencyToCentavos($("meiCfgLimite").value),
      das_vencimento_dia: Number($("meiCfgVencDia").value) || 20,
      dasn_deadline_month: Number($("meiCfgDasnMes").value) || 5,
      dasn_deadline_day: Number($("meiCfgDasnDia").value) || 31
    };
    try {
      const r = await jsonFetch("/api/mei/config", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(patch) });
      if(r.error){ $("meiCfgMsg").textContent = "erro: " + r.error; $("meiCfgMsg").style.color = "#c02c1a"; return; }
      $("meiCfgMsg").textContent = "salvo ✓"; $("meiCfgMsg").style.color = "#1a7a3a";
      await loadDashboard();
      setTimeout(()=>{ $("meiConfigModal").classList.remove("on"); }, 700);
    } catch(e){ $("meiCfgMsg").textContent = "erro de rede"; $("meiCfgMsg").style.color = "#c02c1a"; }
  });

  // Fecha ao clicar fora
  ["meiDetailModal","meiConfigModal"].forEach(id=>{
    const m = $(id);
    if(m) m.addEventListener("click", (ev)=>{ if(ev.target === m) m.classList.remove("on"); });
  });

  // Boot: espera admin.js hidratar body-ready antes de disparar
  function boot(){ loadDashboard(); }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.MEI = { reload: loadDashboard };
})();
