const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');

test('nutrition portion checks preserve food groups and legacy servings',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const main=html.match(/<script>\s*(\(function\(\)\{\s*"use strict";[\s\S]*?)<\/script>/)[1]
  .replace('\nif(cloudClient&&authCode)void finishCloudAuthCallback(authCode);\n})();','\nwindow.testApp={setMealRating,plateRating,setPlate,localMealCheck,dayNutrition,trendNote,get S(){return S},get F(){return F},render,ymd,shiftDate,healthWeekly,dailyCards,lessonFor,LESSONS,workspaceData,mergeWorkspace,connectedHtml,setCloudSession(session){cloudSession=session},setHealth(rows){healthReadings=rows},reviewScan(data){healthExtracted=data;renderHealthExtract()}};render();\n})();');
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
 const d=date(today); app.F.entries=[];
 for(const text of ['chicken and broccoli with several cups of pasta','chicken and salad with a large pile of fries','chicken and broccoli with two cups of rice']) {
  const result=app.localMealCheck(text); assert.equal(result.rating,'m',text); assert.equal(result.protein,true); assert.equal(result.produce,true); assert.match(result.fix,/fist/);
 }
 assert.equal(app.localMealCheck('chicken and broccoli with rice').rating,'q');
 assert.equal(app.localMealCheck('chicken').rating,'m');
 assert.equal(app.localMealCheck('broccoli').rating,'m');
 app.setMealRating(d,'l','m',true,true);
 assert.equal(app.S.meals[d].l.rating,'m'); assert.equal(app.S.meals[d].l.p,1); assert.equal(app.S.meals[d].l.f,1); assert.equal(app.S.meals[d].l.rest,'more');
 app.setMealRating(d,'s','m',false,true); assert.equal(app.S.meals[d].s.p,0); assert.equal(app.S.meals[d].s.f,1);
 app.S.meals[d].b={p:1,f:0,v:2,rating:'q'};
 app.setPlate(d,'b',{p:2}); assert.equal(app.S.meals[d].b.f,2); assert.equal(app.S.meals[d].b.v,0); assert.equal(app.S.meals[d].b.rating,'q');
 app.setPlate(d,'b',{f:1}); assert.equal(app.S.meals[d].b.f,1); assert.equal(app.S.meals[d].b.v,0);
 app.setPlate(d,'b',{rest:'more'}); assert.equal(app.S.meals[d].b.rating,'m'); assert.equal(app.S.meals[d].b.f,1);
 app.setPlate(d,'b',{rest:'ok'}); assert.equal(app.S.meals[d].b.rating,'q');
 assert.doesNotMatch(html,/That is muscle\./);
 assert.match(html,/these readings alone cannot confirm it/);
});
