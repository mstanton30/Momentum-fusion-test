const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {parseHTML}=require('linkedom');const backup=require('../backup.js');
const S={profile:{name:'Fixture',start:'2026-01-01'},weigh:[{id:1,d:'2026-11-13',wt:'180',photo:'data:image/jpeg;base64,AA=='}],plans:{},lessons:{'2026-11-13':true}};
const F={entries:[{id:2,type:'meal',date:'2026-11-13',description:'Fixture meal'}],favorites:[],customReminders:[],weeklyPlanHistory:[{from:'2026-11-13',days:[[],[],[],[],[],[],[]]}],backupSyncPaused:true};
test('versioned and old exports roundtrip without credentials; health snapshot survives',()=>{
 const value=backup.create(S,F,[{id:'cloud-one',measured_at:'2026-11-13T10:00:00Z',weight_lb:180}],{accountId:'fixture-account',appVersion:'9.15.1'});
 const parsed=backup.parse(JSON.stringify(value));assert.deepEqual(parsed.S,S);assert.equal(parsed.F.entries[0].description,'Fixture meal');assert.equal(parsed.F.backupSyncPaused,undefined);assert.equal(parsed.F.backupHealthReadings.length,1);assert.equal(parsed.accountId,'fixture-account');
 const legacy=backup.parse(JSON.stringify({...S,fusion:F}));assert.equal(legacy.legacy,true);assert.deepEqual(legacy.S,S);
});
test('rejects malformed, future, wrong application, prototype and invalid record shapes',()=>{
 for(const text of ['no json','[]','{}',JSON.stringify({format:'other',version:1}),JSON.stringify({...backup.create(S,F),version:2}),'{"profile":null,"fusion":{"__proto__":{"polluted":true}}}',JSON.stringify({profile:[],fusion:{}}),JSON.stringify({profile:null,weigh:[null],fusion:{}}),JSON.stringify({profile:null,fusion:{entries:'bad'}}),JSON.stringify({profile:null,fusion:{weeklyPlanHistory:[{days:[]}]}})])assert.throws(()=>backup.parse(text));
 assert.equal({}.polluted,undefined);
});
test('storage failure rolls back both keys and leaves unrelated account untouched',()=>{
 const m=new Map([['a','old-a'],['b','old-b'],['account','untouched']]);let failed=false;
 const storage={getItem:k=>m.get(k)??null,removeItem:k=>m.delete(k),setItem(k,v){if(k==='b'&&!failed){failed=true;throw Error('quota')}m.set(k,v)}};
 assert.throws(()=>backup.persist(storage,[['a','new-a'],['b','new-b']]));assert.equal(m.get('a'),'old-a');assert.equal(m.get('b'),'old-b');assert.equal(m.get('account'),'untouched');
});
function harness(){
 const html=fs.readFileSync('index.html','utf8');const {document,window}=parseHTML(html);window.scrollTo=()=>{};window.matchMedia=()=>({matches:false});window.MomentumBackup=backup;
 const values=new Map([['momentumfusion.beta.v1',JSON.stringify(S)],['momentumfusion.beta.extra.v1',JSON.stringify(F)]]);
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 window.MOMENTUM_BETA_CONFIG={};let agrees=true;
 const script=html.match(/<script>\s*(\(function\(\)\{\s*"use strict";[\s\S]*?)<\/script>/)[1].replace('\nif(cloudClient&&authCode)void finishCloudAuthCallback(authCode);\n})();','\nwindow.testBackup={get S(){return S},get F(){return F},get health(){return healthReadings},importBackupFile,bodyRows,syncWorkspace,activateWorkspace,workspaceData,setAccount(id){activeWorkspace=id;cloudSession={user:{id}}},setBusy(v){cloudBusy=v}};render();\n})();');
 const context={window,document,localStorage:storage,sessionStorage:storage,location:new URL('https://fixture.invalid/#progress'),navigator:{},history:{replaceState(){}},structuredClone,TextEncoder,Intl,URL,URLSearchParams,Date,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},console,confirm:()=>agrees};
 vm.runInNewContext(script,context);return {app:window.testBackup,document,values,agree:v=>agrees=v};
}
const file=data=>({size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)});
test('UI restore confirms replacement, pauses cloud sync, persists and renders health snapshot',async()=>{
 const h=harness();assert.ok(h.document.querySelector('#backup-import'));assert.ok(h.document.querySelector('#export'));
 const bundle=backup.create({...S,profile:{...S.profile,name:'Restored'}},F,[{id:'cloud-1',measured_at:'2026-11-13T12:00:00Z',weight_lb:171}]);
 h.agree(false);await h.app.importBackupFile(file(bundle));assert.equal(h.app.S.profile.name,'Fixture');
 h.agree(true);await h.app.importBackupFile(file(bundle));assert.equal(h.app.S.profile.name,'Restored');assert.equal(h.app.F.backupSyncPaused,true);assert.equal(JSON.parse(h.values.get('momentumfusion.beta.v1')).profile.name,'Restored');assert.ok(h.app.bodyRows().some(x=>x.wt===171));
 h.app.setAccount('fixture-account');await h.app.syncWorkspace(); // Must return before trying to use absent network client.
 assert.equal(h.app.F.backupSyncPaused,true);
});
test('bad records, incompatible rendered data and wrong account leave prior state intact',async()=>{
 const h=harness(),before=h.values.get('momentumfusion.beta.v1');
 await h.app.importBackupFile(file({profile:null,fusion:{entries:'bad'}}));assert.equal(h.values.get('momentumfusion.beta.v1'),before);
 h.app.setAccount('alice');await h.app.importBackupFile(file(backup.create(S,F,[],{accountId:'bob'})));assert.equal(h.app.S.profile.name,'Fixture');assert.match(h.document.querySelector('#backup-status').textContent,/different account/);
 h.app.setBusy(true);await h.app.importBackupFile(file(backup.create(S,F)));assert.match(h.document.querySelector('#backup-status').textContent,/Wait for cloud sync/);
});
test('restored local records win over a cached account until explicit sync resume',async()=>{
 const h=harness();await h.app.importBackupFile(file(backup.create({...S,profile:{...S.profile,name:'Restore first'}},F)));
 h.app.activateWorkspace('alice',{S:{...S,profile:{...S.profile,name:'Old cached'}},F:{},base:{}});assert.equal(h.app.S.profile.name,'Restore first');assert.equal(h.app.F.backupSyncPaused,true);
});
