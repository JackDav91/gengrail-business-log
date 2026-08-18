const C='gengrail-log-v24.8.0-consistency-private-ebay';
const A=['./','./index.html','./manifest.json','./gengrail-theme.css','./gengrail-ebay.js','./gengrail-profit-engine.js','./profit-engine-diagnostic.js','./gengrail-consistency-patch.js','./home-compact.css','./grail-hub.css','./grail-hub.js','./graded-market-engine.js','./graded-integration.js','./graded-stock-ui.js','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url),path=u.pathname;
 if(path.endsWith('/gengrail-business-log/')||path.endsWith('/gengrail-business-log/index.html')||path.endsWith('/index.html')){
  const req=new Request(e.request,{cache:'reload'});
  e.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request)));
  return;
 }
 /* grail-hub.js is already loaded last in index.html. Bundle the consistency policy directly
    after it so every existing global function is available before the policy hooks run. */
 if(path.endsWith('/grail-hub.js')){
  e.respondWith((async()=>{
   try{
    const [hub,policy]=await Promise.all([
     fetch(new Request(e.request,{cache:'reload'})),
     fetch(new URL('./gengrail-consistency-patch.js',self.location.href),{cache:'reload'})
    ]);
    if(!hub.ok||!policy.ok)throw new Error('consistency_bundle_fetch_failed');
    const body=(await hub.text())+'\n\n/* bundled consistency policy */\n'+(await policy.text());
    return new Response(body,{status:200,headers:{'content-type':'application/javascript;charset=UTF-8','cache-control':'no-store'}});
   }catch(err){
    console.error('[Gengrail SW] consistency bundle failed',err);
    return fetch(new Request(e.request,{cache:'reload'})).catch(()=>caches.match(e.request));
   }
  })());
  return;
 }
 const forceReload=path.endsWith('/gengrail-consistency-patch.js')||path.endsWith('/gengrail-profit-engine.js')||path.endsWith('/gengrail-ebay.js')||path.endsWith('/profit-engine-diagnostic.js')||path.endsWith('/gengrail-theme.css')||path.endsWith('/graded-market-engine.js')||path.endsWith('/graded-integration.js')||path.endsWith('/graded-stock-ui.js');
 const req=forceReload?new Request(e.request,{cache:'reload'}):e.request;
 e.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request)));
});