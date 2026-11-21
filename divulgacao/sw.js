const C='maratu-divulg-v17';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('maratu-divulg-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  // video vem em pedacos (206): o cache nao guarda isso, entao vai direto pra rede
  if(e.request.headers.has('range')||/\.mp4(\?|$)/.test(e.request.url)) return;
  // a pagina em si vem da rede primeiro (versao nova num carregamento so); sem internet, usa a guardada
  if(e.request.mode==='navigate'){
    const guardado=()=>caches.open(C).then(c=>c.match(e.request,{ignoreSearch:true})).then(r=>r||Response.error());
    // wifi ruim na feira: espera a rede ate 4 s, depois usa a copia guardada
    const rede=fetch(e.request).then(resp=>{ if(resp&&resp.ok){ const c2=resp.clone(); e.waitUntil(caches.open(C).then(c=>c.put(e.request,c2))); } return resp; });
    const prazo=new Promise((ok,falha)=>setTimeout(()=>falha('lento'),4000));
    e.respondWith(Promise.race([rede,prazo]).catch(()=>guardado().then(r=>r.type==='error'?rede:r)).catch(guardado));
    return;
  }
  e.respondWith(caches.open(C).then(cache=>cache.match(e.request).then(hit=>{
    const net=fetch(e.request).then(resp=>{ if(resp&&resp.ok){ cache.put(e.request, resp.clone()); } return resp; }).catch(()=>hit);
    return hit||net;
  })));
});
