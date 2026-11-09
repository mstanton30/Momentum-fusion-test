import {createHandler} from './server.mjs';
import {supabaseStore} from './store.mjs';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Missing environment setting ' + name);
  return value;
}

const url = required('SUPABASE_URL');
const app = Deno.env.get('MOMENTUM_BETA_APP_URL') || 'https://mstanton30.github.io/Momentum-fusion-test/';
const base = Deno.env.get('MOMENTUM_BETA_API_URL') || url + '/functions/v1/momentum-beta';

Deno.serve(createHandler({
  store: supabaseStore(url, required('SUPABASE_ANON_KEY'), required('SUPABASE_SERVICE_ROLE_KEY')),
  base,
  app,
  signingKey: Deno.env.get('MOMENTUM_BETA_OAUTH_KEY')
}));
