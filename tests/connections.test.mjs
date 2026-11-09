import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {createHandler} from '../supabase/functions/momentum-beta/server.mjs';
import {localDay} from '../supabase/functions/momentum-beta/tools.mjs';

const base='https://momentum-api.example';
const app='https://momentum-beta.example/app/';
const first='a'.repeat(40),second='b'.repeat(40);
const day=localDay();
const previousDay=new Date(Date.now()-10*86400000).toISOString().slice(0,10);
const copy=structuredClone;
const verifier='v'.repeat(64);
const digest=x=>createHash('sha256').update(x).digest('base64url');
const empty=()=>({entries:{},supplements:{},savedMeals:[],savedWorkouts:[],timezone:'UTC',
  trends:{weekly:[],body:[],strength:[],dexa:[]},progress:{
    weigh:{},strength:{},dexa:{},tests:{},sessions:{},mealSlots:{},rewards:{},sleep:{},assessments:{},daySources:{},activityGoal:'health',targets:{}
  }});

function fixture({enableAi=true,apiBase=base,oauthIssuer}={}){
  const workspaces=new Map(),credentials=new Map(),readings=new Map(),sync=new Map();
  const store={
    user:async token=>[first,second].includes(token)?{id:token}:null,
    getWorkspace:async user=>copy(workspaces.get(user)||{revision:0,state:{}}),
    saveWorkspace:async (user,revision,state)=>{
      if((workspaces.get(user)?.revision||0)!==revision)return null;
      const row={revision:revision+1,state:copy(state)};
      workspaces.set(user,row);
      return copy(row);
    },
    getCredential:async (kind,hash,field='secret_hash')=>copy([...credentials.values()].find(x=>x.kind===kind&&x[field]===hash)||null),
    createCredential:async row=>{const id=crypto.randomUUID();credentials.set(id,{id,...copy(row)});return{id}},
    useCode:async row=>credentials.delete(row.id),
    rotateCredential:async (row,next)=>{
      const current=credentials.get(row.id);
      if(current?.refresh_hash!==row.refresh_hash)return false;
      Object.assign(current,next);return true;
    },
    connections:async user=>[...credentials.values()].filter(x=>x.user_id===user&&x.kind!=='code').map(({id,kind,label,expires_at})=>({id,kind,label,expires_at})),
    revoke:async (user,id)=>{if(credentials.get(id)?.user_id===user)credentials.delete(id)},
    samples:async (user,since,offset)=>[...(readings.get(user)||new Map()).values()].filter(x=>Date.parse(x.measured_at)>=Date.parse(since)).slice(offset,offset+500),
    lastHealthSync:async user=>sync.get(user)||null,
    ingest:async (row,samples)=>{
      if(credentials.get(row.id)?.secret_hash!==row.secret_hash)return null;
      const values=readings.get(row.user_id)||new Map();
      const size=values.size;
      for(const x of samples)if(!values.has(x.sample_key))values.set(x.sample_key,{id:crypto.randomUUID(),...x});
      readings.set(row.user_id,values);
      const synced_at=new Date().toISOString();
      sync.set(row.user_id,synced_at);
      return {inserted:values.size-size,synced_at};
    }
  };
  const handler=createHandler({store,base:apiBase,app,oauthIssuer,signingKey:enableAi?'test-key-only-'.repeat(4):undefined});
  async function request(path,{token,method='GET',body,origin,form=false}={}){
    const res=await handler(new Request(apiBase+path,{method,
      headers:{...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{}),
        ...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{})},
      body:body?(form?new URLSearchParams(body):JSON.stringify(body)):undefined}));
    return {status:res.status,headers:res.headers,data:res.headers.get('Content-Type')?.includes('json')?await res.json():null};
  }
  async function enroll(user){
    return request('/workspace',{token:user,method:'PUT',body:{revision:0,data:empty()}});
  }
  async function oauth(user=first,provider='claude'){
    const redirect_uri=provider==='claude'?'https://claude.ai/api/mcp/auth_callback':'https://chatgpt.com/connector_platform_oauth_redirect';
    const register=await request('/register',{method:'POST',body:{redirect_uris:[redirect_uri],token_endpoint_auth_method:'none'}});
    assert.equal(register.status,201);
    const {client_id}=register.data;
    const auth={client_id,redirect_uri,response_type:'code',code_challenge_method:'S256',code_challenge:digest(verifier),state:'state-for-tests',resource:base+'/mcp'};
    const launch=await request('/authorize?'+new URLSearchParams(auth));
    assert.equal(launch.status,302);
    assert.equal(new URL(launch.headers.get('Location')).origin,new URL(app).origin);
    const consent=await request('/consent',{token:user,method:'POST',body:{request:auth,allow:true}});
    assert.equal(consent.status,200);
    const redirect=new URL(consent.data.redirect);
    assert.equal(redirect.searchParams.get('state'),auth.state);
    assert.equal(redirect.searchParams.get('iss'),base);
    const payload={client_id,redirect_uri,grant_type:'authorization_code',code:redirect.searchParams.get('code'),code_verifier:verifier,resource:base+'/mcp'};
    const exchange=overrides=>request('/token',{method:'POST',form:true,body:{...payload,...overrides}});
    assert.equal((await exchange({code_verifier:'w'.repeat(64)})).status,400);
    assert.equal((await exchange({resource:'https://other.example'})).status,400);
    const exchanged=await exchange();
    assert.equal(exchanged.status,200);
    assert.equal((await exchange()).status,400);
    return {...exchanged.data,client_id};
  }
  return {request,enroll,oauth};
}
const call=(request,token,name,args={})=>request('/api/tools',{token,method:'POST',body:{name,arguments:args}});
const meal=(id,date=day)=>({request_id:id,date,description:'Oat smoothie',mealSlot:'b',p:35,c:50});

test('discovery, exact redirect allowlist, PKCE, origin, refresh and revocation',async()=>{
  const {request,enroll,oauth}=fixture();
  assert.equal((await request('/workspace')).status,401);
  assert.equal((await request('/workspace',{token:first,origin:'https://untrusted.example'})).status,403);
  const noAuth=await request('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'initialize'}});
  assert.equal(noAuth.status,401);
  assert.match(noAuth.headers.get('WWW-Authenticate'),/resource_metadata/);
  assert.equal((await request('/.well-known/oauth-protected-resource/mcp')).data.resource,base+'/mcp');
  assert.deepEqual((await request('/.well-known/oauth-authorization-server')).data.code_challenge_methods_supported,['S256']);
  assert.equal((await request('/register',{method:'POST',body:{redirect_uris:['https://example.com/callback']}})).status,400);
  assert.equal((await enroll(first)).status,200);
  const ai=await oauth(first,'chatgpt');
  const mcp=(method,params,id=1,token=ai.access_token)=>request('/mcp',{token,method:'POST',body:{jsonrpc:'2.0',id,method,params}});
  assert.equal((await mcp('initialize',{protocolVersion:'2025-06-18'})).data.result.protocolVersion,'2025-06-18');
  assert.ok((await mcp('tools/list')).data.result.tools.some(x=>x.name==='log_meal'));
  assert.equal((await mcp('tools/call',{name:'log_meal',arguments:meal('meal-from-mcp')})).data.result.isError,undefined);
  const refresh=()=>request('/token',{method:'POST',form:true,body:{client_id:ai.client_id,grant_type:'refresh_token',refresh_token:ai.refresh_token}});
  const next=await refresh();
  assert.equal(next.status,200);
  assert.equal((await refresh()).status,400);
  assert.equal((await mcp('tools/list')).status,401);
  const devices=await request('/connections',{token:first});
  const id=devices.data.find(x=>x.kind==='ai').id;
  await request('/connections/'+id,{token:second,method:'DELETE'});
  assert.equal((await mcp('tools/list',{},1,next.data.access_token)).status,200);
  await request('/connections/'+id,{token:first,method:'DELETE'});
  assert.equal((await mcp('tools/list',{},1,next.data.access_token)).status,401);
});

test('account isolation, replay, edit and approval workflows',async()=>{
  const {request,enroll,oauth}=fixture();
  await enroll(first);await enroll(second);
  const ai=(await oauth()).access_token,other=(await oauth(second)).access_token;
  const [one,two]=await Promise.all([call(request,ai,'log_meal',meal('request-one')),call(request,ai,'log_meal',meal('request-two'))]);
  assert.deepEqual([one.data.status,two.data.status].sort(),['duplicate','logged']);
  const id=one.data.id;
  assert.equal(two.data.id,id);
  assert.equal((await call(request,ai,'log_meal',meal('request-one'))).data.id,id);
  assert.equal((await call(request,ai,'log_meal',{...meal('request-one'),c:90})).status,409);
  assert.deepEqual((await call(request,other,'list_entries')).data.entries,[]);
  assert.equal((await call(request,other,'edit_entry',{id,request_id:'foreign-edit',changes:{p:40}})).status,404);
  assert.equal((await call(request,ai,'edit_entry',{id,request_id:'normal-edit',changes:{p:40}})).data.status,'edited');
  assert.equal((await call(request,ai,'log_activity',{request_id:'activity-one',date:day,description:'Walk',minutes:25,intensity:'moderate',healthCategory:'aerobic'})).data.status,'logged');
  assert.equal((await call(request,ai,'log_supplement',{request_id:'supplement-one',date:day,supplement:'drink'})).data.status,'logged');
  assert.equal((await call(request,ai,'list_entries')).data.supplements[day].creatine,true);
  const old=await call(request,ai,'log_meal',meal('old-request',previousDay));
  const edit=await call(request,ai,'edit_entry',{id:old.data.id,request_id:'historical-edit',changes:{p:99}});
  assert.equal(edit.data.status,'approval_required');
  const path='/approvals/'+edit.data.approval_id;
  assert.equal((await request(path,{token:ai,method:'POST',body:{approve:true}})).status,401);
  assert.equal((await request(path,{token:second,method:'POST',body:{approve:true}})).status,404);
  assert.equal((await call(request,ai,'list_entries')).data.entries.find(x=>x.id===old.data.id).p,35);
  assert.equal((await request(path,{token:first,method:'POST',body:{approve:true}})).data.status,'approved');
  assert.equal((await call(request,ai,'list_entries')).data.entries.find(x=>x.id===old.data.id).p,99);
  const remove=await call(request,ai,'delete_entry',{id,request_id:'delete-meal'});
  assert.equal(remove.data.status,'approval_required');
  assert.equal((await request('/approvals/'+remove.data.approval_id,{token:first,method:'POST',body:{approve:false}})).data.status,'declined');
  assert.ok((await call(request,ai,'list_entries')).data.entries.some(x=>x.id===id));
  const retry=await call(request,ai,'delete_entry',{id,request_id:'delete-again'});
  assert.equal((await request('/approvals/'+retry.data.approval_id,{token:first,method:'POST',body:{approve:true}})).status,200);
  assert.ok(!(await call(request,ai,'list_entries')).data.entries.some(x=>x.id===id));
  assert.equal((await call(request,ai,'saved_items')).status,200);
  assert.equal((await call(request,ai,'progress_summary')).data.customWorkoutMinutes,25);
  assert.ok((await call(request,ai,'activity_history')).data.history.some(x=>x.assistant==='Claude'&&x.status==='approved'));
});

test('Shortcut authorization, account ownership, sample replay, empty sync and revocation',async()=>{
  const {request}=fixture();
  const credential=await request('/connections/health',{token:first,method:'POST'});
  assert.equal(credential.status,201);
  const token=credential.data.token;
  const measured_at=new Date(Date.now()-60000).toISOString();
  const sample={source:'apple_health',sample_key:'weight:first',measured_at,weight_lb:180.2};
  const body={user_id:second,samples:[sample,{source:'apple_health',sample_key:'fat:first',measured_at,body_fat_pct:21.5}]};
  const send=(input,auth=token)=>request('/health',{token:auth,method:'POST',body:input});
  assert.equal((await send(body,first)).status,401);
  assert.equal((await send(body)).data.inserted,2);
  assert.equal((await send(body)).data.inserted,0);
  assert.equal((await send({samples:[]})).data.inserted,0);
  assert.equal((await send({samples:[{...sample,measured_at:'2026-02-31T11:00:00Z'}]})).status,400);
  assert.equal((await send({samples:[{...sample,weight_lb:-1}]})).status,400);
  assert.equal((await request('/workspace',{token})).status,401);
  assert.equal((await request('/health',{token})).status,401);
  const read=await request('/health',{token:first});
  assert.ok(read.data.last_sync);
  assert.deepEqual(read.data.samples.map(x=>x.measured_at),[measured_at,measured_at]);
  assert.deepEqual((await request('/health',{token:second})).data.samples,[]);
  const id=(await request('/connections',{token:first})).data[0].id;
  await request('/connections/'+id,{token:first,method:'DELETE'});
  assert.equal((await send(body)).status,401);
  assert.ok((await request('/health',{token:first})).data.last_sync);
});

test('Apple Health can run before AI OAuth is configured',async()=>{
  const {request}=fixture({enableAi:false});
  assert.equal((await request('/mcp')).status,404);
  assert.equal((await request('/workspace',{token:first})).status,404);
  assert.equal((await request('/health')).status,401);
  assert.deepEqual((await request('/health',{token:first})).data.samples,[]);
  assert.equal((await request('/connections/health',{token:first,method:'POST'})).status,201);
});

test('public MCP issuer is independent from the Apple Health upload URL',async()=>{
  const apiBase='https://edge.example/functions/v1/momentum-beta';
  const {request,enroll,oauth}=fixture({apiBase,oauthIssuer:base});
  const discovery=await request('/.well-known/oauth-authorization-server');
  assert.equal(discovery.data.issuer,base);
  assert.equal(discovery.data.registration_endpoint,base+'/register');
  assert.deepEqual((await request('/.well-known/oauth-protected-resource/mcp')).data.authorization_servers,[base]);
  assert.equal((await request('/mcp')).headers.get('WWW-Authenticate'),
    `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="momentum:log"`);
  assert.equal((await request('/connections/health',{token:first,method:'POST'})).data.endpoint,apiBase+'/health');
  assert.equal((await enroll(first)).status,200);
  for(const provider of ['chatgpt','claude']){
    const {access_token}=await oauth(first,provider);
    const result=await request('/mcp',{token:access_token,method:'POST',body:{jsonrpc:'2.0',id:1,method:'tools/list'}});
    assert.equal(result.status,200);
    assert.ok(result.data.result.tools.some(x=>x.name==='log_meal'));
  }
});
