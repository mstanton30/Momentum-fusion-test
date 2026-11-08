const CACHE='momentum-beta-shell-v1';
const ASSETS=['./manifest.json','./icon-192.png','./icon-512.png','./icon-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));caches.open(CACHE).then(c=>c.add('./index.html')).catch(()=>{});self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('momentum-beta-shell-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return}e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
self.addEventListener('push',e=>{let d={};try{d=e.data?.json()||{}}catch{d={body:e.data?.text()||''}};e.waitUntil(self.registration.showNotification(d.title||'Momentum',{body:d.body||'Your reminder is ready.',icon:'./icon-192.png',badge:'./icon-192.png',data:{url:d.url||'./#home'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.openWindow(new URL(e.notification.data?.url||'./#home',self.registration.scope).href))});
