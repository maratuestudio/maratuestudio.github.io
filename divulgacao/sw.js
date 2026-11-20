const C='maratu-divulg-v13';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('maratu-divulg-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.open(C).then(cache=>cache.match(e.request).then(hit=>{
    const net=fetch(e.request).then(resp=>{ if(resp&&resp.ok){ cache.put(e.request, resp.clone()); } return resp; }).catch(()=>hit);
    return hit||net;
  })));
});
