const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');

test('Beta copies local records, preserves original keys, and renders five tabs and progress ranges',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const main=html.match(/<script>\s*(\(function\(\)\{\s*"use strict";[\s\S]*?)<\/script>/)[1]
  .replace('\nif(cloudClient&&authCode)void finishCloudAuthCallback(authCode);\n})();','\nwindow.testApp={get S(){return S},get F(){return F},render,ymd,shiftDate,healthWeekly,dailyCards,lessonFor,LESSONS,workspaceData,mergeWorkspace,connectedHtml,setCloudSession(session){cloudSession=session},setHealth(rows){healthReadings=rows},reviewScan(data){healthExtracted=data;renderHealthExtract()}};render();\n})();');
 const today=new Date();
 const date=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const prior=new Date(today);prior.setDate(prior.getDate()-61);
 const priorYear=new Date(today);priorYear.setFullYear(priorYear.getFullYear()-2);
 const s={profile:{name:'Fixture',age:40,sex:'m',heightIn:70,weightLb:180,start:date(prior)},weigh:[{id:1,d:date(prior),wt:'180',bf:'24',mm:'112'}],
  extras:[{id:2,d:date(priorYear),kind:'DEXA body fat %',v:'25.2',note:'Earlier scan'},{id:3,d:date(today),kind:'DEXA body fat %',v:'23.2'},{id:4,d:date(today),kind:'Vitamin D (ng/mL)',v:'32'}]};
 const f={favorites:[{id:2,type:'meal',description:'Fixture oatmeal',p:22}],entries:[{id:3,type:'meal',description:'Fixture smoothie',date:date(today),mealSlot:'b',p:22,qualityChoice:'quality'}]};
 const values=new Map([['momentumfusion.v1',JSON.stringify(s)],['momentumfusion.extra.v1',JSON.stringify(f)]]);
 const makeStorage=(map=new Map())=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
 const {document,window}=parseHTML(html);
 window.scrollTo=()=>{};
 window.matchMedia=()=>({matches:false});
 window.MOMENTUM_BETA_CONFIG={supabaseUrl:'https://beta.invalid',publishableKey:'fixture',apiUrl:'https://beta.invalid/api',aiEnabled:true};
 window.supabase={createClient:()=>({auth:{onAuthStateChange(){}}})};
 const location=new URL('https://momentum.example/beta/#progress');
 const context={window,document,location,localStorage:makeStorage(values),sessionStorage:makeStorage(),navigator:{},structuredClone,
  Intl,URL,URLSearchParams,Date,setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>{},console,history:{replaceState(){}},confirm:()=>true};
 vm.runInNewContext(main,context);
 const app=window.testApp;
 assert.equal(app.LESSONS.length,365);
 assert.equal(app.lessonFor(app.S.profile.start).n,1);
 assert.equal(app.lessonFor(app.shiftDate(app.S.profile.start,364)).n,365);
 assert.equal(app.lessonFor(app.shiftDate(app.S.profile.start,365)).n,1);
 const fixtureDay=date(today), weekday=today.getDay();
 const days=Array.from({length:7},()=>[]);
 days[weekday]=[{id:'fixture-plan',name:'My scheduled strength',minutes:30,category:'strength'}];
 app.F.weeklyPlanHistory=[{from:fixtureDay,days}];
 assert.match(app.dailyCards().join(''),/My scheduled strength/);
 assert.doesNotMatch(app.dailyCards().join(''),/data-sess=/);
 app.F.entries.push({id:'fixture-log',type:'activity',date:fixtureDay,weeklySessionId:'fixture-plan',description:'Completed plan',minutes:30,healthCategory:'strength'});
 assert.doesNotMatch(app.dailyCards().join(''),/My scheduled strength|data-sess=/);
 app.F.entries.pop();
 days[weekday]=[];
 assert.match(app.dailyCards().join(''),/data-sess=/);
 delete app.F.weeklyPlanHistory;

 assert.deepEqual([...document.querySelectorAll('#tabbar button')].map(x=>x.textContent),['Home','Workout','Nutrition','Benefits','Progress']);
 assert.match(document.querySelector('main h1').textContent,/Progress/);
 assert.match(app.connectedHtml(),/Create account/);
 assert.match(app.connectedHtml(),/Forgot password/);
 app.setCloudSession({user:{email:'fixture@example.com'}});
 const connections=app.connectedHtml();
 assert.match(connections,/Set up AI sharing/);
 assert.doesNotMatch(connections,/Set up iPhone Shortcut|Create Shortcut credential|Refresh measurements|shortcuts:\/\/run-shortcut/);
 assert.match(document.querySelector('#momentumConnections summary').textContent,/^AI connections$/);
 app.setCloudSession(null);
 assert.match(document.querySelector('main').textContent,/Earlier scan/);
 assert.match(document.querySelector('main').textContent,/Vitamin D \(ng\/mL\)/);
 const weight=()=>[...document.querySelectorAll('.card')].find(x=>x.querySelector('h3')?.textContent==='Weight').textContent;
 assert.match(weight(),/No entries/);
 function click(selector){const target=document.querySelector(selector);assert.ok(target,selector);target.dispatchEvent(new window.Event('click',{bubbles:true}))}
 click('[data-progress-range="90"]');
 assert.match(weight(),/180 lb latest/);
 const score=app.healthWeekly().score;
 app.setHealth([{measured_at:new Date().toISOString(),weight_lb:177.3,body_fat_pct:null}]);
 app.render();
 assert.match(weight(),/177.3 lb latest/);
 assert.equal(app.healthWeekly().score,score);
 click('[data-progress-pane="fitness"]');
 assert.match(document.querySelector('main').textContent,/Weekly Activity Score/);
 assert.match(document.querySelector('main').textContent,/Strength results/);
 click('[data-progress-pane="nutrition"]');
 assert.match(document.querySelector('main').textContent,/High fives a day/);
 click('[data-tab="benefits"]');
 assert.match(document.querySelector('main').textContent,/Post-workout recovery drink/);
 click('[data-benefit="perks"]');
 assert.match(document.querySelector('main').textContent,/Sauna/);
 for(const [tab,heading] of [['home','SD Health Stack'],['workout','SD Health Stack'],['nutrition','Nutrition'],['progress','Progress']]){
  click(`[data-tab="${tab}"]`);
  assert.match(document.querySelector('main h1').textContent,new RegExp(heading,'i'));
 }
 click('[data-go="coach"]');
 assert.match(document.querySelector('main').textContent,/Coach/i);
 click('[data-tab="progress"]');
 click('[data-progress-pane="body"]');
 click('[data-go="import"]');
 assert.match(document.querySelector('main').textContent,/Import/i);
 const scale={kind:'weight',source:'RENPHO',date:null,confidence:'high',weight:174.2,bodyFat:20.5,muscle:112};
 app.reviewScan(scale);
 click('[data-health-save]');
 assert.match(document.getElementById('healthImportMessage').textContent,/Choose a valid date/);
 document.getElementById('healthConfirmedDate').value=date(today);
 click('[data-health-save]');
 app.reviewScan({...scale,source:'Renpho',date:date(today),bodyFat:21.9,metrics:{body_water_pct:54.2,protein_pct:17.8}});
 document.querySelector('[data-health-value="protein_pct"]').value='18';
 click('[data-health-save]');
 assert.equal(app.F.healthImports.filter(x=>x.kind==='weight').length,1);
 const scan=app.S.weigh.find(x=>x.source==='RENPHO image');
 assert.equal(scan.bf,'20.5');
 assert.equal(scan.metrics.body_water_pct,54.2);
 assert.equal(scan.metrics.protein_pct,18);
 click('[data-tab="progress"]');
 click('[data-progress-pane="body"]');
 assert.match(document.querySelector('main').textContent,/Body water/);
 assert.equal(app.F.favorites[0].description,'Fixture oatmeal');
 assert.equal(app.S.extras.length,3);
 assert.equal(values.get('momentumfusion.v1'),JSON.stringify(s));
 assert.equal(values.get('momentumfusion.extra.v1'),JSON.stringify(f));
 assert.ok(values.has('momentumfusion.beta.v1'));
 assert.ok(values.has('momentumfusion.beta.extra.v1'));
 const base=app.workspaceData(),local=structuredClone(base),remote=structuredClone(base);
 local.supplements[date(today)]={creatine:true};remote.supplements[date(today)]={fish:true};
 remote.entries['new-ai-entry']={id:'new-ai-entry',type:'meal',description:'An AI meal',date:date(today)};
 const merged=app.mergeWorkspace(base,local,remote);
 assert.equal(merged.conflict,false);
 assert.ok(merged.data.supplements[date(today)].fish&&merged.data.supplements[date(today)].creatine);
 assert.equal(merged.data.entries['new-ai-entry'].description,'An AI meal');
 local.entries['3'].description='Device edit';remote.entries['3'].description='AI edit';
 assert.equal(app.mergeWorkspace(base,local,remote).conflict,true);
 assert.equal(app.mergeWorkspace(base,local,remote,'remote').data.entries['3'].description,'AI edit');
});


test('a recovery callback opens a password form without a local Momentum profile',async()=>{
 const html=fs.readFileSync('index.html','utf8');
 const main=html.match(/<script>\s*(\(function\(\)\{\s*"use strict";[\s\S]*?)<\/script>/)[1];
 const {document,window}=parseHTML(html);
 const location=new URL('https://momentum.example/beta/?code=recovery-code');
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const session={user:{id:'recovery-user',email:'fixture@example.com'}};
 let optionsSeen,codeSeen,passwordSeen;
 window.scrollTo=()=>{};
 window.MOMENTUM_BETA_CONFIG={supabaseUrl:'https://beta.invalid',publishableKey:'fixture',apiUrl:'https://beta.invalid/api'};
 window.supabase={createClient:(_url,_key,options)=>{
  optionsSeen=options;
  return {auth:{onAuthStateChange(){},async exchangeCodeForSession(code){codeSeen=code;return {data:{session,redirectType:'PASSWORD_RECOVERY'}}},
    async updateUser({password}){passwordSeen=password;return {data:{user:session.user}}}}};
 }};
 const context={window,document,location,localStorage:storage,sessionStorage:storage,navigator:{},structuredClone,Intl,URL,URLSearchParams,Date,
  setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>{},console,history:{replaceState(_state,_unused,url){location.href=url}},
  FormData:class {constructor(form){this.form=form}get(name){return this.form.querySelector('[name="'+name+'"]').value}}};
 vm.runInNewContext(main,context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(optionsSeen.auth.detectSessionInUrl,false);
 assert.equal(codeSeen,'recovery-code');
 assert.equal(location.searchParams.has('code'),false);
 assert.match(document.querySelector('main h1').textContent,/Set a new password/);
 assert.equal(storage.getItem('momentumfusion.beta.recovery'),session.user.id);
 const form=document.getElementById('fCloudResetUpdate');
 form.querySelector('[name=password]').value='example-password';
 form.querySelector('[name=confirmation]').value='mismatch';
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(passwordSeen,undefined);
 assert.equal(document.getElementById('fCloudResetUpdate'),form);
 assert.match(document.getElementById('cloudStatus').textContent,/same new password twice/);
 form.querySelector('[name=confirmation]').value='example-password';
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(passwordSeen,'example-password');
 assert.match(document.querySelector('main h1').textContent,/Password updated/);
 assert.equal(storage.getItem('momentumfusion.beta.recovery'),null);
});
