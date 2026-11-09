const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {test} = require('node:test');
const {PGlite} = require('@electric-sql/pglite');

test('migration enforces ownership and atomically records health uploads', async () => {
  const db = new PGlite();
  const a='10000000-0000-0000-0000-000000000001';
  const b='10000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`
      create schema auth;
      create table auth.users(id uuid primary key);
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as
        $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;
      insert into auth.users values ('${a}'), ('${b}');
    `);
    await db.exec(readFileSync('supabase/migrations/20261109120000_momentum_beta_connections.sql','utf8'));
    const credential=(await db.query(`
      insert into momentum_beta_credentials(user_id,kind,secret_hash,label,expires_at)
      values ($1,'health','test-secret','test phone',now()+interval '1 day') returning id`,[a])).rows[0].id;
    const measured='2026-11-02T07:01:04-05:00';
    const samples=JSON.stringify([{sample_key:'weight:1',measured_at:measured,weight_lb:184.2},{sample_key:'fat:1',measured_at:measured,body_fat_pct:23}]);
    await db.exec('set role service_role');
    const upload=(payload=samples)=>db.query('select momentum_beta_health_import($1,$2,$3) as result',[credential,'test-secret',payload]);
    assert.equal((await upload()).rows[0].result.inserted,2);
    assert.equal((await upload()).rows[0].result.inserted,0);
    assert.ok((await upload('[]')).rows[0].result.synced_at);
    assert.equal((await db.query('select count(*)::int as n from momentum_beta_health_status')).rows[0].n,1);
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${b}'`);
    assert.equal((await db.query('select * from momentum_health_samples')).rows.length,0);
    await assert.rejects(db.query("insert into momentum_health_samples(user_id,source,sample_key,measured_at) values ($1,'apple_health','bad',now())",[a]),/row-level security/);
    await assert.rejects(db.query('select * from momentum_beta_workspace'),/permission denied/);
    await assert.rejects(upload(),/permission denied/);
    await db.exec(`set request.jwt.claim.sub = '${a}'`);
    const records=(await db.query('select measured_at from momentum_health_samples')).rows;
    assert.equal(records.length,2);
    assert.equal(records[0].measured_at.toISOString(),new Date(measured).toISOString());
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from momentum_health_samples'),/permission denied/);
    await db.exec('reset role; set role service_role');
    await db.query('delete from momentum_beta_credentials where id=$1',[credential]);
    assert.equal((await upload()).rows[0].result,null);
    assert.equal((await db.query('select count(*)::int as n from momentum_beta_health_status')).rows[0].n,1);
  } finally {await db.close()}
});
