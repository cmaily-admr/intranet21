/**
 * Étape 1 du flux OAuth : redirige vers GitHub.
 * Appelée par Decap CMS quand l'utilisateur clique « Login with GitHub ».
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  if (!env.GITHUB_CLIENT_ID) {
    return new Response(
      "Configuration manquante : GITHUB_CLIENT_ID n'est pas défini dans les variables d'environnement Cloudflare Pages.",
      { status: 500, headers: { "Content-Type": "text/plain;charset=UTF-8" } }
    );
  }

  // Jeton anti-CSRF, stocké en cookie httpOnly et revérifié au retour
  const state = crypto.randomUUID();

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
  authUrl.searchParams.set("scope", "repo,user");
  authUrl.searchParams.set("state", state);

  const headers = new Headers();
  headers.set("Location", authUrl.toString());
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`
  );

  return new Response(null, { status: 302, headers });
}
