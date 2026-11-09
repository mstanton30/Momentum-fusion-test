const CACHE='momentum-shell-9.9.2';
const ASSETS=['./index.html','./manifest.json','./version.json','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('momentum-shell-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin)return;if(r.mode==='navigate'||u.pathname.endsWith('/version.json')){e.respondWith(fetch(r,{cache:'no-store'}).catch(()=>caches.match(r)));return}e.respondWith(fetch(r).catch(()=>caches.match(r)))});
self.addEventListener('push',e=>{let d={};try{d=e.data?.json()||{}}catch{d={body:e.data?.text()||''}}e.waitUntil(self.registration.showNotification(d.title||'Momentum',{body:d.body||'Your reminder is ready.',icon:'./icon-192.png',badge:'./icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.openWindow(new URL(e.notification.data?.url||'./',self.registration.scope).href))});
