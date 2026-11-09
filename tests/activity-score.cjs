// Run: node tests/activity-score.cjs (requires Playwright and Chromium).
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync('index.html','utf8').replace('\nrender();\n})();',`\nwindow.testApp={healthWeekly,strengthPoints,healthClassify,dayPoints,dayNutrition,planFor,fsave,save,render,fAI,
 get S(){return S},get F(){return F},setTab(value){tab=value;sel='2026-11-03';nutDay=sel},
 reset(){S=structuredClone(DEFAULT);F.entries=[];F.daySources={};F.strengthAssessments={};F.healthGoal='health'}};
 render();\n})();`);
 await page.route('http://127.0.0.1:8000/',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://127.0.0.1:8000/',{waitUntil:'networkidle'});
 const results=await page.evaluate(()=>{
  const a=window.testApp,results=[],ref=new Date('2026-11-04T12:00:00');
  function check(name,fn){a.reset();fn();results.push(name)}
  function eq(actual,expected){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(JSON.stringify({actual,expected}))}
  const assessment=coverage=>({coverage,effort:'challenging',volume:'multiple'});
  function log(date,cat,minutes=30,extra={}){a.F.entries.push({id:a.F.entries.length,date,type:'activity',description:cat,healthCategory:cat,minutes,intensity:'moderate',planAction:'extra',...extra})}
  check('empty week',()=>eq(a.healthWeekly(ref).score,0));
  check('personalized targets and vigorous equivalence',()=>{for(const [goal,min] of [['health',150],['enhanced',300],['weight',225]]){a.F.entries=[];a.F.healthGoal=goal;log('2026-11-02','aerobic',min/2,{intensity:'vigorous'});eq(a.healthWeekly(ref).cardio,70)}});
  check('aerobic cap, light and mobility exclusion',()=>{log('2026-11-02','aerobic',1000);log('2026-11-02','mobility',100);eq(a.healthWeekly(ref).cardio,70);a.F.entries=[];log('2026-11-02','aerobic',100,{intensity:'light'});eq(a.healthWeekly(ref).cardio,0)});
  check('5/10/15 rubric and incomplete assessment',()=>eq([a.strengthPoints(),a.strengthPoints({}),a.strengthPoints({...assessment('full'),effort:'light'}),a.strengthPoints({...assessment('full'),volume:'single'}),a.strengthPoints(assessment('partial')),a.strengthPoints(assessment('upper'))],[5,5,5,10,10,15]));
  check('two split days and total 100 cap',()=>{log('2026-11-02','aerobic',300);for(const [date,c] of [['2026-11-03','upper'],['2026-11-05','lower'],['2026-11-06','full']])log(date,'strength',30,{strengthAssessment:assessment(c)});eq(a.healthWeekly(ref).score,100)});
  check('upper only capped at 25',()=>{for(const date of ['2026-11-03','2026-11-05'])log(date,'strength',30,{strengthAssessment:assessment('upper')});eq(a.healthWeekly(ref).strength,25)});
  check('same day score once and coverage independent of order',()=>{log('2026-11-03','strength',30,{strengthAssessment:assessment('upper')});log('2026-11-03','strength',30,{strengthAssessment:assessment('lower')});eq(a.healthWeekly(ref).strength,15);eq(a.healthWeekly(ref).coverageComplete,true);a.F.entries.reverse();eq(a.healthWeekly(ref).coverageComplete,true)});
  check('custom mixed splits minutes once',()=>{log('2026-11-03','mixed',60,{intensity:'vigorous',strengthAssessment:assessment('full')});eq([a.healthWeekly(ref).aerobic,a.healthWeekly(ref).strength],[60,15])});
  check('planned bootcamp and replacement exclude original',()=>{a.S.sess['2026-11-07']={main:{done:true,min:60}};eq(a.healthWeekly(ref).aerobic,60);log('2026-11-07','mixed',30,{planAction:'skip'});eq(a.healthWeekly(ref).aerobic,15)});
  check('planned strength assessments and mobility',()=>{for(const date of ['2026-11-03','2026-11-05']){a.S.sess[date]={main:{done:true,min:30},mob:{done:true,min:15}};a.F.strengthAssessments[date]=assessment('full')}eq([a.healthWeekly(ref).strength,a.healthWeekly(ref).aerobic],[30,0])});
  check('nutrition slot consolidation remains independent',()=>{a.S.meals['2026-11-03']={b:{p:1,v:1,q:1}};for(let i=0;i<2;i++)a.F.entries.push({type:'meal',date:'2026-11-03',mealSlot:'b',qualityChoice:'quality',p:20});eq(a.dayNutrition('2026-11-03').q,1);eq(a.healthWeekly(ref).score,0)});
  check('custom day retains planned data without scoring it',()=>{a.S.sess['2026-11-04']={main:{done:true,min:45}};a.F.daySources['2026-11-04']='custom';eq(a.healthWeekly(ref).aerobic,0);eq(a.S.sess['2026-11-04'].main.done,true)});
  check('zero invalid minutes and outside week excluded',()=>{for(const minutes of [0,-1,Infinity,'bad'])log('2026-11-03','strength',minutes);log('2026-10-20','aerobic',150);eq(a.healthWeekly(ref).score,0)});
  check('HIIT has no implied resistance; bootcamp remains mixed',()=>eq([a.healthClassify('HIIT running'),a.healthClassify('bootcamp'),a.healthClassify('cardio and strength')],['aerobic','mixed','mixed']));
  check('score is read only and independent of nutrition and habit points',()=>{a.S.plans={'2026-11':{tue:{text:'My plan',link:'https://example.com'}}};a.S.meals['2026-11-03']={b:{p:1,v:1,q:1}};const before=JSON.stringify(a.S),points=a.dayPoints('2026-11-03'),nutrition=JSON.stringify(a.dayNutrition('2026-11-03'));log('2026-11-03','strength',30,{strengthAssessment:assessment('full')});a.healthWeekly(ref);eq(JSON.stringify(a.S),before);a.F.entries=[];eq(a.dayPoints('2026-11-03'),points);eq(JSON.stringify(a.dayNutrition('2026-11-03')),nutrition);eq(a.planFor('2026-11-03').text,'My plan')});
  a.S.profile={name:'Test',age:40,sex:'m',heightIn:70,weightLb:180,start:'2026-11-01'};
  a.F.workoutTemplates=[{name:'Lower workout',description:'Strength',minutes:40,intensity:'moderate',healthCategory:'strength',strengthAssessment:assessment('lower')}];
  a.setTab('workout');a.render();
  return results;
 });
 await page.locator('[data-ftemplate="0"]').click();
 assert.equal(await page.locator('#fActivity [name=strengthCoverage]').inputValue(),'lower');
 assert.equal(await page.locator('#fActivity [name=strengthEffort]').inputValue(),'challenging');
 await page.locator('[data-fai="activity"]').click();
 assert.match(await page.locator('body').innerText(),/RULE-BASED SUGGESTION/);
 await page.locator('#fActivity [type=submit]').click();
 assert.equal(await page.evaluate(()=>testApp.F.entries.at(-1).strengthAssessment.coverage),'lower');
 for(const tab of ['home','workout','nutrition','supps','perks','track','coach','import']){
  await page.evaluate(tab=>{testApp.setTab(tab);testApp.render()},tab);
  assert.ok(await page.locator('#main').innerText());
 }
 await page.evaluate(()=>{testApp.fsave();testApp.save()});
 const stored=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('momentum'))));
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>testApp.F.entries.at(-1).strengthAssessment.coverage),'lower');
 assert.equal(await page.evaluate(()=>testApp.S.profile.name),'Test');
 assert.ok(Object.keys(stored).length>=2);
 assert.deepEqual(errors,[]);
 console.log(`${results.length+4} checks passed:\n${results.join('\n')}\nTemplate assessment restored\nAI suggestion and activity submit\nNavigation without JavaScript errors\nExisting storage survives reload`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
