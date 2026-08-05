export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

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

  return new Response(script, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}
