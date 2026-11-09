import {createHandler} from './server.mjs';
import {supabaseStore} from './store.mjs';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Missing environment setting ' + name);
  return value;
}

Deno.serve(createHandler({
  store: supabaseStore(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), required('SUPABASE_SERVICE_ROLE_KEY')),
  base: required('MOMENTUM_BETA_API_URL'),
  app: required('MOMENTUM_BETA_APP_URL'),
  signingKey: required('MOMENTUM_BETA_OAUTH_KEY')
}));
