/* Static shell only. Never cache API responses or user records. */
const CACHE='momentum-beta-shell-9.19.0-reviewed';
const ASSETS=['./backup.js','./index.html','./beta-config.js?v=9.19.0','./vendor/supabase-2.49.10.js','./manifest.json','./version.json','./sd-icon-180.png','./sd-icon-192.png','./sd-icon-512.png','./sd-logo.svg','./sd-icon-192.png?v=9.19.0','./sd-icon-180.png?v=9.19.0','./sd-icon-512.png?v=9.19.0'];
const root=new URL('./',self.registration.scope);
const shell=new URL('./index.html',root).href;
const assetURLs=new Set(ASSETS.map(path=>new URL(path,root).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('momentum-beta-shell-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
 const navigation=request.mode==='navigate';
 if(!navigation&&!assetURLs.has(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),key=navigation?shell:request;
  try{
   const response=await fetch(request,{cache:'no-store'});
   if(response.ok)await cache.put(key,response.clone());
   return response;
  }catch(error){const stored=await cache.match(key);if(stored)return stored;throw error}
 })());
});
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
 event.waitUntil(self.registration.showNotification(data.title||'SD Health Stack',{
  body:data.body||'Your reminder is ready.',icon:new URL('./sd-icon-192.png',root).href,
  badge:new URL('./sd-icon-192.png',root).href,data:{url:data.url||'./'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();let target=root;
 try{const candidate=new URL(event.notification.data?.url||'./',root);if(candidate.origin===root.origin&&candidate.pathname.startsWith(root.pathname))target=candidate}catch{}
 event.waitUntil(self.clients.openWindow(target.href));
});
