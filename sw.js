const CACHE='momentum-shell-9.2.1';
const SHELL=['./index.html','./manifest.json','./version.json','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('momentum-shell-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request, url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'||url.pathname.endsWith('/version.json')||url.pathname.endsWith('/sw.js')){
  event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));
  return;
 }
 event.respondWith(fetch(req).catch(()=>caches.match(req)));
});
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
 event.waitUntil(self.registration.showNotification(data.title||'Momentum',{body:data.body||'Your reminder is ready.',icon:'./icon-192.png',badge:'./icon-192.png',data:{url:data.url||'./'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.openWindow(new URL(event.notification.data?.url||'./',self.registration.scope).href));
});
