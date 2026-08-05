export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const redirectUri = `${url.origin}/api/callback`;
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo,user");
  authUrl.searchParams.set("state", crypto.randomUUID());

  return Response.redirect(authUrl.toString(), 302);
}
