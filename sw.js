const C='gengrail-log-v24.8.2-direct-live-pricing';
const A=['./','./index.html','./manifest.json','./gengrail-theme.css','./gengrail-ebay.js','./gengrail-profit-engine.js','./profit-engine-diagnostic.js','./gengrail-consistency-patch.js','./gengrail-catalogue-live-pricing.js','./home-compact.css','./grail-hub.css','./grail-hub.js','./graded-market-engine.js','./graded-integration.js','./graded-stock-ui.js','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url),path=u.pathname;
 if(path.endsWith('/gengrail-business-log/')||path.endsWith('/gengrail-business-log/index.html')||path.endsWith('/index.html')){
  e.respondWith((async()=>{
   try{
    const r=await fetch(new Request(e.request,{cache:'reload'}));
    if(!r.ok)return r;
    let html=await r.text();
    const direct='<script src="gengrail-consistency-patch.js?v=24.8.2"></script><script src="gengrail-catalogue-live-pricing.js?v=24.8.2"></script>';
    if(!html.includes('gengrail-catalogue-live-pricing.js?v=24.8.2'))html=html.includes('</body>')?html.replace('</body>',direct+'</body>'):html+direct;
    return new Response(html,{status:r.status,statusText:r.statusText,headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store'}});
   }catch(err){return caches.match(e.request)}
  })());
  return;
 }
 if(path.endsWith('/grail-hub.js')){
  e.respondWith(fetch(new Request(e.request,{cache:'reload'})).catch(()=>caches.match(e.request)));
  return;
 }
 const forceReload=path.endsWith('/gengrail-consistency-patch.js')||path.endsWith('/gengrail-catalogue-live-pricing.js')||path.endsWith('/gengrail-profit-engine.js')||path.endsWith('/gengrail-ebay.js')||path.endsWith('/profit-engine-diagnostic.js')||path.endsWith('/gengrail-theme.css')||path.endsWith('/graded-market-engine.js')||path.endsWith('/graded-integration.js')||path.endsWith('/graded-stock-ui.js')||path.endsWith('/grail-hub.js');
 const req=forceReload?new Request(e.request,{cache:'reload'}):e.request;
 e.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request)));
});