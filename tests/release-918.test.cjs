const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');

test('v9.18 share actions, recipes backups, snack tally and daily perk caps',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const main=html.match(/<script>\s*(\(function\(\)\{\s*"use strict";[\s\S]*?)<\/script>/)[1]
  .replace('\nif(cloudClient&&authCode)void finishCloudAuthCallback(authCode);\n})();','\nwindow.testApp={homeShareCard,shareCard,recipeSet,recipeGet,pointBreakdown,save,plateRating,setPlate,localMealCheck,dayNutrition,trendNote,get S(){return S},get F(){return F},render,ymd,shiftDate,healthWeekly,dailyCards,lessonFor,LESSONS,workspaceData,mergeWorkspace,connectedHtml,setCloudSession(session){cloudSession=session},setHealth(rows){healthReadings=rows},reviewScan(data){healthExtracted=data;renderHealthExtract()}};render();\n})();');
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
 assert.equal(app.shareCard.constructor.name,'AsyncFunction');
 assert.match(app.homeShareCard(),/data-share-go="day"/);
 assert.match(app.homeShareCard(),/data-recipe-go="smoothie"/);
 app.recipeSet('own','name','Fixture recipe'); app.recipeSet('own','text','Chicken\nCarrots'); app.save();
 assert.equal(app.recipeGet('own').text,'Chicken\nCarrots');
 const backup=require('../backup.js');
 const restored=backup.parse(JSON.stringify(backup.create(app.S,app.F)));
 assert.equal(restored.S.recipes.own.name,'Fixture recipe');
 assert.equal(restored.S.recipes.own.text,'Chicken\nCarrots');
 app.setPlate(d,'s',{p:5,f:6}); assert.equal(app.S.meals[d].s.p,5); assert.equal(app.S.meals[d].s.f,6);
 app.S.heat=[{id:1,d,min:20}]; const once=app.pointBreakdown(d).benefits;
 app.S.heat.push({id:2,d,min:20},{id:3,d,min:20}); assert.equal(app.pointBreakdown(d).benefits,once);
 app.S.heat.push({id:4,d,min:20,kind:'soak'}); assert.ok(app.pointBreakdown(d).benefits>once);
 assert.equal((html.match(/function shareCard\(/g)||[]).length,1);
});
