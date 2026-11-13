/* Portable, versioned backups. No credentials, subscriptions or other accounts. */
(function(root){
'use strict';
const FORMAT='momentum-portable-backup',VERSION=1,MAX_BYTES=25*1024*1024;
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function checkTree(x,depth=0){
 if(depth>35)throw Error('Backup is nested too deeply.');
 if(Array.isArray(x)){if(x.length>100000)throw Error('Backup contains too many records.');for(const v of x)checkTree(v,depth+1)}
 else if(obj(x)){for(const [k,v]of Object.entries(x)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Unsafe backup key.');checkTree(v,depth+1)}}
 else if(typeof x==='number'&&!Number.isFinite(x))throw Error('Invalid number.');
}
function validate(S,F){
 if(!obj(S)||!obj(F)||!Object.hasOwn(S,'profile'))throw Error('This is not a Momentum backup.');
 if(S.profile!==null&&!obj(S.profile))throw Error('Invalid profile.');
 for(const k of ['weigh','strength','tests','heat','cold','medit','roll','light','extras','ftp'])if(S[k]!==undefined&&(!Array.isArray(S[k])||S[k].some(x=>!obj(x))))throw Error('Invalid '+k+' records.');
 for(const k of ['links','plans','sess','swaps','lessons','meals','rewards','supps','sleep'])if(S[k]!==undefined&&!obj(S[k]))throw Error('Invalid '+k+' data.');
 for(const k of ['entries','healthImports','favorites','workoutTemplates','coachNotes','customReminders','weeklyPlanHistory','groceryFoundation','backupHealthReadings'])if(F[k]!==undefined&&(!Array.isArray(F[k])||F[k].some(x=>!obj(x))))throw Error('Invalid '+k+' records.');
 for(const k of ['targets','substitutions','grocery','mealRecipes','mealPlans','coachPrefs','planChoices','rescheduled','daySources','strengthAssessments'])if(F[k]!==undefined&&!obj(F[k]))throw Error('Invalid '+k+' data.');
 for(const row of F.weeklyPlanHistory||[])if(!Array.isArray(row.days)||row.days.length!==7||row.days.some(d=>!Array.isArray(d)||d.some(x=>!obj(x))))throw Error('Invalid weekly workout plan.');
 for(const x of F.backupHealthReadings||[])if(typeof x.measured_at!=='string'||!Number.isFinite(Date.parse(x.measured_at)))throw Error('Invalid saved health reading.');
}
function create(S,F,healthReadings=[],meta={}){
 const cleanF=JSON.parse(JSON.stringify(F));delete cleanF.backupSyncPaused;delete cleanF.backupRestoreAccountId;
 const map=new Map([...(cleanF.backupHealthReadings||[]),...healthReadings].map(x=>[String(x.id||x.measured_at),x]));
 cleanF.backupHealthReadings=[...map.values()];
 validate(S,cleanF);
 return {format:FORMAT,version:VERSION,appVersion:meta.appVersion||'',exportedAt:new Date().toISOString(),accountId:meta.accountId||null,state:S,fusion:cleanF};
}
function parse(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Backup exceeds the 25 MB limit.');
 let value;try{value=JSON.parse(text)}catch{throw Error('Choose a valid JSON backup file.');}
 checkTree(value);
 if(!obj(value))throw Error('This is not a Momentum backup.');
 let S,F,accountId=null,legacy=false;
 if(value.format!==undefined){if(value.format!==FORMAT||value.version!==VERSION)throw Error('Unsupported backup format or version. Update the app before restoring.');S=value.state;F=value.fusion;accountId=value.accountId||null;}
 else {legacy=true;F=value.fusion;S={...value};delete S.fusion;}
 validate(S,F);
 const result=JSON.parse(JSON.stringify({S,F,accountId,legacy,exportedAt:value.exportedAt||null}));delete result.F.backupSyncPaused;delete result.F.backupRestoreAccountId;
 return result;
}
function persist(storage,entries){
 const before=entries.map(([k])=>[k,storage.getItem(k)]);
 try{for(const [k,v]of entries)storage.setItem(k,v)}catch(e){for(const [k,v]of before){try{v===null?storage.removeItem(k):storage.setItem(k,v)}catch{}}throw Error('Not enough device storage to restore. Existing data was kept; free space and try again.');}
}
const api={create,parse,persist,MAX_BYTES};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MomentumBackup=api;
})(typeof window!=='undefined'?window:globalThis);
