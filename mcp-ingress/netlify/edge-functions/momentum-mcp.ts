const upstreamBase = 'https://gwsvhhjqgpjjzftmnsqf.supabase.co/functions/v1/momentum-beta';
export default async function proxy(request: Request) {
  const url = new URL(request.url);
  const upstream = new Request(upstreamBase + url.pathname + url.search, request);
  upstream.headers.delete('cookie');
  upstream.headers.delete('host');
  // Forward OAuth redirects to the client without following them with its credentials.
  return fetch(upstream, { redirect: 'manual' });
}

export const config = {
  path: [
    '/mcp', '/authorize', '/token', '/register',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp'
  ],
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
