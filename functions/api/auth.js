export function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!env.GITHUB_CLIENT_ID) {
    return new Response("GITHUB_CLIENT_ID manquant", { status: 500 });
  }

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
  authUrl.searchParams.set("scope", "repo,user");
  authUrl.searchParams.set("state", crypto.randomUUID());

  return new Response(null, {
    status: 302,
    headers: { Location: authUrl.toString() }
  });
}
