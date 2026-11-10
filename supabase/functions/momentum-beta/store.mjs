const workspace = 'momentum_beta_workspace';
const credentials = 'momentum_beta_credentials';
const health = 'momentum_health_samples';
const mealInbox = 'momentum_beta_meal_inbox';
const eq = value => 'eq.' + value;

export function supabaseStore(url, publicKey, serviceKey, request = fetch) {
  async function query(table, filters = {}, options = {}) {
    const params = new URLSearchParams(filters);
    const res = await request(url + '/rest/v1/' + table + '?' + params, {
      method: options.method || 'GET',
      headers: {
        apikey: serviceKey, Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation'
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    if (!res.ok) throw new Error('Beta storage request failed (' + res.status + ')');
    return res.status === 204 ? null : res.json();
  }

  return {
    async user(token) {
      const res = await request(url + '/auth/v1/user', {
        headers: {apikey: publicKey, Authorization: 'Bearer ' + token}
      });
      if (!res.ok) return null;
      const user = await res.json();
      return user.id && !user.is_anonymous ? user : null;
    },
    async getWorkspace(user) {
      return (await query(workspace, {user_id:eq(user), select:'state,revision'}))[0] ||
        {state:{}, revision:0};
    },
    async pendingMeals(user) {
      return query(mealInbox, {
        user_id:eq(user), status:'eq.pending', select:'id,payload',
        order:'created_at.asc,id.asc', limit:'20'
      });
    },
    async finishInboxMeal(user, id, status) {
      await query(mealInbox, {user_id:eq(user),id:eq(id),status:'eq.pending'}, {
        method:'PATCH',body:{status,processed_at:new Date().toISOString()},prefer:'return=minimal'
      });
    },
    async saveWorkspace(user, revision, state) {
      const row = {revision:revision + 1, state, updated_at:new Date().toISOString()};
      const result = revision === 0
        ? await query(workspace, {}, {method:'POST', body:{...row, user_id:user}, prefer:'resolution=ignore-duplicates,return=representation'})
        : await query(workspace, {user_id:eq(user), revision:eq(revision)}, {method:'PATCH', body:row});
      return result.length ? {revision:row.revision,state} : null;
    },
    async getCredential(kind, hash, field = 'secret_hash') {
      return (await query(credentials, {kind:eq(kind), [field]:eq(hash), limit:'1'}))[0] || null;
    },
    async createCredential(row) {
      return (await query(credentials, {}, {method:'POST', body:row}))[0];
    },
    async useCode(row) {
      return !!(await query(credentials, {id:eq(row.id), secret_hash:eq(row.secret_hash)}, {method:'DELETE'})).length;
    },
    async rotateCredential(row, next) {
      return !!(await query(credentials, {id:eq(row.id), refresh_hash:eq(row.refresh_hash)}, {method:'PATCH', body:next})).length;
    },
    async connections(user) {
      return query(credentials, {
        user_id:eq(user),kind:'in.(ai,health)',
        select:'id,kind,label,expires_at,refresh_expires_at,last_used_at',
        order:'created_at.desc'
      });
    },
    async revoke(user, id) {
      await query(credentials, {user_id:eq(user),id:eq(id)}, {method:'DELETE'});
    },
    async lastHealthSync(user) {
      return (await query('momentum_beta_health_status', {user_id:eq(user),select:'synced_at'}))[0]?.synced_at || null;
    },
    async samples(user, since, offset) {
      return query(health, {
        user_id:eq(user), source:'eq.apple_health', measured_at:'gte.' + since,
        select:'id,measured_at,weight_lb,body_fat_pct',
        order:'measured_at.desc,id.asc',limit:'500',offset:String(offset)
      });
    },
    async ingest(row, samples) {
      return query('rpc/momentum_beta_health_import', {}, {
        method:'POST',body:{p_id:row.id,p_hash:row.secret_hash,p_samples:samples}
      });
    }
  };
}
