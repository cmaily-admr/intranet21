export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  // --- Vérification anti-CSRF ---
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch = cookieHeader.match(/oauth_state=([^;]+)/);
  const savedState = cookieMatch ? cookieMatch[1] : null;

  if (!returnedState || !savedState || returnedState !== savedState) {
    return new Response("Erreur : state invalide (protection CSRF).", {
      status: 403,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });
  }
  // --- Fin vérification ---

  if (!code) {
    return new Response("Erreur : pas de code reçu de GitHub", { status: 400 });
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response(
      "Configuration manquante : GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET absent.",
      { status: 500 }
    );
  }

  // Échange du code contre un access_token
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return new Response(
      `Erreur GitHub : ${tokenData.error_description || tokenData.error}`,
      { status: 400 }
    );
  }

  const token = tokenData.access_token;

  // Page HTML qui transmet le token à la popup Decap CMS
  const script = `
    <!DOCTYPE html>
    <html>
      <body>
        <script>
          (function() {
            function receiveMessage(message) {
              window.opener.postMessage(
                'authorization:github:success:${JSON.stringify({ token, provider: "github" })}',
                message.origin
              );
              window.removeEventListener("message", receiveMessage, false);
            }
            window.addEventListener("message", receiveMessage, false);
            window.opener.postMessage("authorizing:github", "*");
          })();
        </script>
      </body>
    </html>
  `;

  const headers = new Headers();
  headers.set("Content-Type", "text/html;charset=UTF-8");
  // Suppression du cookie oauth_state, il n'est plus utile
  headers.append(
    "Set-Cookie",
    "oauth_state=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0"
  );

  return new Response(script, { status: 200, headers });
}
