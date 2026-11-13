const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const handlers={},stored=new Map(),deleted=[],notifications=[],opened=[];let offline=false,claimed=false;
 const cache={addAll:async assets=>{for(const path of assets)stored.set(new URL(path,'https://example.test/Momentum-fusion-test/').href,new Response(path))},put:async(k,v)=>stored.set(typeof k==='string'?k:k.url,v),match:async k=>stored.get(typeof k==='string'?k:k.url)?.clone()};
 const self={registration:{scope:'https://example.test/Momentum-fusion-test/',showNotification:async(...args)=>notifications.push(args)},clients:{claim:async()=>{claimed=true},openWindow:async url=>opened.push(url)},skipWaiting:async()=>{},addEventListener:(key,fn)=>handlers[key]=fn};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,URL,Set,caches:{open:async()=>cache,keys:async()=>['momentum-beta-shell-old','unrelated-private'],delete:async key=>deleted.push(key)},fetch:async()=>{if(offline)throw Error('offline');return new Response('fresh shell')}});
 async function event(name,props={}){let pending;handlers[name]({...props,waitUntil:p=>pending=p,respondWith:p=>pending=p});return await pending}
 return {event,stored,deleted,notifications,opened,setOffline:()=>offline=true,claimed:()=>claimed};
}
test('shell installs, activates safely and offline navigation works with query strings',async()=>{
 const h=harness();await h.event('install');await h.event('activate');assert.deepEqual(h.deleted,['momentum-beta-shell-old']);assert.equal(h.claimed(),true);
 await h.event('fetch',{request:{url:'https://example.test/Momentum-fusion-test/?update=1',method:'GET',mode:'navigate'}});
 h.setOffline();const result=await h.event('fetch',{request:{url:'https://example.test/Momentum-fusion-test/?update=2',method:'GET',mode:'navigate'}});assert.equal(await result.text(),'fresh shell');
 assert.equal(await h.event('fetch',{request:{url:'https://example.test/api/private',method:'GET'}}),undefined);
 assert.equal(await h.event('fetch',{request:{url:'https://backend.test/health',method:'GET'}}),undefined);
 assert.equal(await h.event('fetch',{request:{url:'https://example.test/Momentum-fusion-test/upload',method:'POST'}}),undefined);
});
test('push is visible and notification destinations remain inside app',async()=>{
 const h=harness();await h.event('push',{data:{json:()=>({body:'Synthetic reminder'})}});assert.equal(h.notifications[0][0],'SD Health Stack');assert.equal(h.notifications[0][1].body,'Synthetic reminder');
 let closed=false;await h.event('notificationclick',{notification:{close:()=>closed=true,data:{url:'https://evil.invalid'}}});assert.equal(closed,true);assert.equal(h.opened[0],'https://example.test/Momentum-fusion-test/');
 await h.event('notificationclick',{notification:{close(){},data:{url:'./#progress'}}});assert.equal(h.opened[1],'https://example.test/Momentum-fusion-test/#progress');
});
test('all precache assets exist and versioned config matches release',()=>{
 const source=fs.readFileSync('sw.js','utf8'), assets=JSON.parse(source.match(/const ASSETS=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
 for(const path of assets)assert.equal(fs.existsSync(path.split('?')[0]),true,path);
 const version=JSON.parse(fs.readFileSync('version.json')).version;
 assert.ok(assets.includes('./beta-config.js?v='+version));
});
