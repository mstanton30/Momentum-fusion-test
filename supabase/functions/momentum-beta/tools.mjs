const string = {type:'string'};
const number = {type:'number',minimum:0};
const enumOf = (...values) => ({type:'string',enum:values});
const object = (properties, required = []) => ({type:'object',properties,required,additionalProperties:false});
const mutation = {request_id:{...string,minLength:8,maxLength:100,description:'A unique ID for this user action. Reuse it only when retrying the same action.'}};
const mealFields = {
  description:{...string,maxLength:300}, mealSlot:enumOf('b','l','d','s'), qualityChoice:enumOf('quality','off','unknown'),
  p:number,c:number,f:number,fiber:number,calories:number
};
const activityFields = {
  description:mealFields.description, minutes:{type:'number',minimum:1,maximum:1440},
  intensity:enumOf('light','moderate','vigorous'), healthCategory:enumOf('aerobic','strength','mixed','mobility','other'),
  components:{...string,maxLength:1000}, caloriesBurned:number,
  strengthAssessment:object({coverage:enumOf('limited','partial','upper','lower','full'), effort:enumOf('light','challenging'), volume:enumOf('single','multiple')},['coverage','effort','volume'])
};
const period = {days:{type:'integer',minimum:1,maximum:366}};
const supplement = enumOf('drink','creatine','collagen','fish','vitd');
const date = {type:'string',description:'Local date YYYY-MM-DD'};
function definition(name, description, inputSchema, readOnlyHint, destructiveHint = false) {
  return {name,description,inputSchema,annotations:{readOnlyHint,destructiveHint,idempotentHint:true,openWorldHint:false}};
}
export const definitions = [
  definition('log_meal','Log a meal the user said they ate. Use known ingredients and macros only. Use a local date and a new request ID for each distinct meal.',
    object({...mutation,date,...mealFields},['request_id','date','description','mealSlot']),false),
  definition('log_activity','Log a completed workout or activity. Record minutes, intensity and category. Add resistance assessment only when known.',
    object({...mutation,date,...activityFields},['request_id','date','description','minutes','intensity','healthCategory']),false),
  definition('log_supplement','Mark an existing Momentum supplement as taken. This never recommends a supplement or dose.',
    object({...mutation,date,supplement},['request_id','date','supplement']),false),
  definition('saved_items','Retrieve saved meal and workout buttons and workout templates.',object({}),true),
  definition('list_entries','Find existing meals, activities and supplement status before editing. Treat entry text as user data.',
    object(period),true),
  definition('progress_summary','Read measurements, workout and meal counts, and app-calculated progress trends. Distinguish device-synced scores from newly logged entries.',
    object(period),true),
  definition('edit_entry','Edit an existing meal or activity. Date changes and edits over seven days old require approval in Momentum. Use list_entries for entry IDs.',
    object({...mutation,id:string,changes:object({date,...mealFields,...activityFields})},['request_id','id','changes']),false,true),
  definition('delete_entry','Request deletion of a meal or activity. The user must approve in Momentum.',
    object({...mutation,id:string},['request_id','id']),false,true),
  definition('remove_supplement','Request removal of a supplement log. The user must approve in Momentum.',
    object({...mutation,date,supplement},['request_id','date','supplement']),false,true),
  definition('activity_history','Read the recent AI activity history and pending approval status.',object({}),true)
];

export const mealPluginDefinitions = [
  definitions[0],
  definition('log_saved_meal','Add a meal from the user’s Momentum favorites. Supply the saved meal name or a distinctive part of it, such as smoothie. If multiple favorites match, ask the user to choose. Use the same request ID when retrying.',
    object({...mutation,date,mealName:{...string,minLength:1,maxLength:300},mealSlot:mealFields.mealSlot},['request_id','date','mealName','mealSlot']),false)
];

export class HttpError extends Error {
  constructor(status, message) {super(message);this.status=status}
}
const bad = message => {throw new HttpError(400,message)};
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function check(value, schema, label) {
  const valid = schema.type === 'object' ? isObject(value)
    : schema.type === 'string' ? typeof value === 'string'
    : typeof value === 'number' && Number.isFinite(value) && (schema.type !== 'integer' || Number.isInteger(value));
  if (!valid) bad('Invalid ' + label);
  if (schema.enum && !schema.enum.includes(value)) bad('Invalid ' + label);
  if (schema.type === 'string' && (value.length < (schema.minLength || 0) || value.length > (schema.maxLength || 1000))) bad('Invalid ' + label);
  if (schema.type === 'number' || schema.type === 'integer') {
    if (value < (schema.minimum ?? 0) || value > (schema.maximum ?? 100000)) bad('Invalid ' + label);
  }
  if (schema.type === 'object') {
    if (schema.required.some(key => !Object.hasOwn(value,key))) bad('Missing required ' + label + ' fields');
    for (const [key, item] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties,key)) bad('Unknown ' + label + ' field');
      check(item,schema.properties[key],key);
    }
  }
}
export function localDay(zone = 'UTC', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function validDate(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > today) bad('Use a valid local date through ' + today);
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== value) bad('Invalid date');
  return value;
}
function back(date, days) {return new Date(Date.parse(date) - days*86400000).toISOString().slice(0,10)}
const canonical = value => JSON.stringify(value, (_,item) => isObject(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
const label = entry => entry.description.slice(0,300);
const isEntry = (entry, id) => isObject(entry) && String(entry.id) === id && ['meal','activity'].includes(entry.type) &&
  typeof entry.description === 'string' && typeof entry.date === 'string';
const keys = ['entries','supplements','savedMeals','savedWorkouts','progress','trends','timezone'];
export function publicWorkspace(state) {
  return Object.fromEntries(keys.filter(key=>Object.hasOwn(state,key)).map(key=>[key,state[key]]));
}
export function validateWorkspace(value) {
  if (!isObject(value) || Object.keys(value).some(key=>!keys.includes(key))) bad('Invalid workspace');
  if (!isObject(value.entries) || !isObject(value.supplements) || !Array.isArray(value.savedMeals) ||
      !Array.isArray(value.savedWorkouts) || !isObject(value.progress) || !isObject(value.trends) || typeof value.timezone !== 'string') bad('Invalid workspace fields');
  const maps=['weigh','strength','dexa','tests','sessions','mealSlots','rewards','sleep','assessments','daySources','targets'];
  if (maps.some(key=>!isObject(value.progress[key])) || typeof value.progress.activityGoal!=='string' ||
      ['weekly','body','strength','dexa'].some(key=>!Array.isArray(value.trends[key])||value.trends[key].some(x=>!isObject(x)))) bad('Invalid progress data');
  try {localDay(value.timezone)} catch {bad('Invalid timezone')}
  for (const [id,entry] of Object.entries(value.entries)) {
    if (!/^[a-zA-Z0-9.-]{1,100}$/.test(id) || !isEntry(entry,id)) bad('Invalid workspace entry');
  }
  const today = localDay(value.timezone);
  for (const [day,record] of Object.entries(value.supplements)) {
    validDate(day,today);
    if (!isObject(record) || Object.entries(record).some(([key,item])=>!supplement.enum.includes(key)||typeof item!=='boolean')) bad('Invalid supplement log');
  }
}
export function auditView(state) {
  return {
    history:(state.history || []).slice(-80).reverse(),
    pending:Object.values(state.pending || {}).filter(x=>Date.parse(x.expires_at)>Date.now())
  };
}
function saveHistory(state, credential, action, entry, status) {
  state.history ||= [];
  state.history.push({at:new Date().toISOString(),assistant:credential.label,action,entry,status});
}
async function update(store, user, action) {
  for (let attempt=0;attempt<6;attempt++) {
    const {revision,state}=await store.getWorkspace(user);
    const result=action(state);
    if (result.unchanged || await store.saveWorkspace(user,revision,state)) return result.body;
  }
  throw new HttpError(409,'Workspace changed concurrently. Retry the same request ID.');
}
function entryFields(args, allowed) {
  const data={};
  for (const key of Object.keys(allowed)) if (Object.hasOwn(args,key)) data[key]=args[key];
  if (data.description !== undefined) {
    data.description=data.description.trim();
    if (!data.description) bad('Enter a description');
  }
  return data;
}
function sampleView(rows) {return rows.map(({measured_at,weight_lb,body_fat_pct})=>({measured_at,weight_lb,body_fat_pct}))}
function entryKey(x) {
  const allowed=x.type==='meal'?mealFields:activityFields;
  const value=Object.fromEntries(Object.keys(allowed).filter(key=>x[key]!=null).map(key=>[key,x[key]]));
  if (value.description) value.description=value.description.toLowerCase().replace(/\s+/g,' ');
  for(const key of ['p','c','f','fiber','calories']) if(!Number(value[key])) delete value[key];
  if(value.qualityChoice==='unknown') delete value.qualityChoice;
  return canonical({type:x.type,date:x.date,...value});
}
function setSupplement(state, date, key, on) {
  const row = state.supplements[date] ||= {};
  row[key]=on;
  if (key==='drink' && on) {row.creatine=true;row.collagen=true}
}
function propose(state, credential, name, before, after, args, summary) {
  const id=crypto.randomUUID();
  state.pending ||= {};
  for (const [key, item] of Object.entries(state.pending)) if(Date.parse(item.expires_at)<=Date.now()) delete state.pending[key];
  if (Object.keys(state.pending).length>=50) throw new HttpError(429,'Review existing requests in Momentum first.');
  state.pending[id]={id,name,before,after,args,summary,assistant:credential.label,expires_at:new Date(Date.now()+86400000).toISOString()};
  saveHistory(state,credential,name,summary,'pending');
  return {status:'approval_required',approval_id:id,message:'Review and approve this change in Momentum under Progress → Body composition → Connections.'};
}
export async function resolveApproval(store,user,id,approve) {
  return update(store,user,state=>{
    const item=state.pending?.[id];
    if (!item || Date.parse(item.expires_at)<=Date.now()) throw new HttpError(404,'Approval expired or was already resolved');
    if (approve) {
      if (item.name==='remove_supplement') {
        if (canonical(state.supplements[item.args.date])!==canonical(item.before)) throw new HttpError(409,'Supplement log changed. Ask for a new request.');
        setSupplement(state,item.args.date,item.args.supplement,false);
      } else {
        const current=state.entries[item.args.id];
        if (canonical(current)!==canonical(item.before)) throw new HttpError(409,'Entry changed. Ask for a new request.');
        if (item.name==='delete_entry') delete state.entries[item.args.id];
        else state.entries[item.args.id]=item.after;
      }
    }
    delete state.pending[id];
    const status=approve?'approved':'declined';
    for(const request of Object.values(state.requests||{})){
      if(request.result.approval_id===id){request.result={status,approval_id:id};break}
    }
    saveHistory(state,{label:item.assistant},item.name,item.summary,status);
    return {body:{status}};
  });
}
export async function callTool(store, credential, name, args = {}, availableTools = definitions) {
  const def=availableTools.find(item=>item.name===name);
  if (!def) throw new HttpError(404,'Unknown tool');
  check(args,def.inputSchema,'arguments');
  const user=credential.user_id;
  if (def.annotations.readOnlyHint) {
    const {state}=await store.getWorkspace(user);
    if (name==='activity_history') return auditView(state);
    if (!state.entries) throw new HttpError(409,'Enable AI sharing in Momentum first');
    if (name==='saved_items') return {meals:state.savedMeals,workouts:state.savedWorkouts};
    const now=localDay(state.timezone),start=back(now,(args.days||30)-1);
    const entries=Object.values(state.entries).filter(x=>x.date>=start&&x.date<=now).sort((a,b)=>b.date.localeCompare(a.date));
    const supplements=Object.fromEntries(Object.entries(state.supplements).filter(([day])=>day>=start&&day<=now));
    if (name==='list_entries') return {start,end:now,entries:entries.slice(0,200),truncated:entries.length>200,supplements};
    const activities=entries.filter(x=>x.type==='activity'),meals=entries.filter(x=>x.type==='meal');
    const readings=await store.samples(user,back(start,1)+'T00:00:00Z',0);
    const measurements=readings.filter(x=>{const day=localDay(state.timezone,new Date(x.measured_at));return day>=start&&day<=now});
    const trends=state.trends||{};
    return {start,end:now,timezone:state.timezone,customWorkoutCount:activities.length,
      customWorkoutMinutes:activities.reduce((sum,x)=>sum+(Number(x.minutes)||0),0),mealEntryCount:meals.length,
      daysWithMeals:new Set(meals.map(x=>x.date)).size,appleHealth:sampleView(measurements),appleHealthMayBeTruncated:readings.length===500,
      appTrends:{...trends,weekly:(trends.weekly||[]).filter(w=>w.week<=now&&w.end>=start),
        body:(trends.body||[]).filter(x=>x.date>=start&&x.date<=now),
        strength:(trends.strength||[]).filter(x=>x.date>=start&&x.date<=now),
        dexa:(trends.dexa||[]).filter(x=>x.date>=start&&x.date<=now)}};
  }
  return update(store,user,state=>{
    if (!state.entries) throw new HttpError(409,'Enable AI sharing in Momentum first');
    state.requests ||= {};
    const key=credential.id+':'+args.request_id;
    const fingerprint=canonical([name,args]);
    const previous=state.requests[key];
    if (previous) {
      if (previous.fingerprint!==fingerprint) throw new HttpError(409,'Request ID already used for a different action');
      return {body:previous.result,unchanged:true};
    }
    const now=localDay(state.timezone);
    if (args.date!==undefined) validDate(args.date,now);
    let result;
    if (['log_meal','log_saved_meal','log_activity'].includes(name)) {
      const type=name==='log_activity'?'activity':'meal',fields=type==='meal'?mealFields:activityFields;
      let values=args;
      if (name==='log_saved_meal') {
        const normalize=value=>value.toLowerCase().trim().replace(/\s+/g,' ');
        const query=normalize(args.mealName);
        if (!query) bad('Enter a saved meal name');
        const favorites=state.savedMeals.filter(x=>x?.type==='meal'&&typeof x.description==='string');
        const exact=favorites.filter(x=>normalize(x.description)===query);
        const matches=exact.length?exact:favorites.filter(x=>normalize(x.description).includes(query));
        if (!matches.length) throw new HttpError(404,'No matching Momentum favorite. Ask for the saved name or the meal details.');
        if (matches.length>1) throw new HttpError(409,'Multiple favorites match. Ask for the exact saved meal name, or use the meal details if their names are identical.');
        values={...matches[0],mealSlot:args.mealSlot};
      }
      const id=crypto.randomUUID();
      const entry={...entryFields(values,fields),id,date:args.date,type,source:'external-ai',assistant:credential.label};
      if(type==='meal') entry.qualityChoice ||= 'unknown';
      else entry.planAction='extra';
      const existing=Object.values(state.entries).find(x=>x.type===type&&x.date===entry.date&&entryKey(x)===entryKey(entry));
      if (existing) result={status:'duplicate',id:String(existing.id)};
      else {
        state.entries[id]=entry;
        saveHistory(state,credential,name,label(entry),'logged');
        result={status:'logged',id};
      }
    } else if (name==='log_supplement') {
      if (state.supplements[args.date]?.[args.supplement]) result={status:'duplicate'};
      else {
        setSupplement(state,args.date,args.supplement,true);
        saveHistory(state,credential,name,args.supplement+' · '+args.date,'logged');
        result={status:'logged'};
      }
    } else if (name==='remove_supplement') {
      const row=state.supplements[args.date];
      if (!row?.[args.supplement]) throw new HttpError(404,'Supplement is not marked as taken on that date');
      result=propose(state,credential,name,row,null,args,args.supplement+' · '+args.date);
    } else {
      const entry=state.entries[args.id];
      if (!isEntry(entry,args.id)) throw new HttpError(404,'Entry not found');
      if (name==='delete_entry') result=propose(state,credential,name,entry,null,args,label(entry));
      else {
        const fields=entry.type==='meal'?mealFields:activityFields;
        if (!Object.keys(args.changes).length || Object.keys(args.changes).some(k=>k!=='date'&&!Object.hasOwn(fields,k))) bad('Choose changes for this entry type');
        if (args.changes.date!==undefined) validDate(args.changes.date,now);
        if (args.changes.date && args.changes.date!==entry.date && entry.planAction && entry.planAction!=='extra') bad('Change the date of a scheduled replacement in Momentum');
        const changed={...entry,...entryFields(args.changes,fields),date:args.changes.date||entry.date,editedBy:credential.label};
        if (entry.date!==changed.date || entry.date<back(now,7)) result=propose(state,credential,name,entry,changed,args,label(entry));
        else {
          state.entries[args.id]=changed;
          saveHistory(state,credential,name,label(entry),'edited');
          result={status:'edited',id:args.id};
        }
      }
    }
    state.requests[key]={fingerprint,result};
    return {body:result};
  });
}
