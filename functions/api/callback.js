/**
 * Étape 2 du flux OAuth : échange le code contre un token,
 * puis le transmet à la fenêtre Decap via postMessage.
 */
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Vérification anti-CSRF
  const cookies = request.headers.get("Cookie") || "";
  const savedState = cookies.match(/oauth_state=([^;]+)/)?.[1];

  if (!code) return errorPage("Code d'autorisation manquant.", url.origin);
  if (!state || state !== savedState) {
    return errorPage("Vérification de sécurité échouée (state invalide).", url.origin);
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorPage("Configuration serveur incomplète.", url.origin);
  }

  let data;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "intranet21-decap-auth"
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/callback`
      })
    });
    data = await tokenRes.json();
  } catch (e) {
    return errorPage("Impossible de contacter GitHub.", url.origin);
  }

  if (!data.access_token) {
    return errorPage(
      data.error_description || data.error || "Aucun token reçu de GitHub.",
      url.origin
    );
  }

  return successPage(data.access_token, url.origin);
}

/* ---------- Réponses HTML ---------- */

function successPage(token, origin) {
  const payload = JSON.stringify({ token, provider: "github" });

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Connexion…</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;text-align:center;color:#363636}</style>
</head><body>
<p>Connexion réussie, fermeture de la fenêtre…</p>
<script>
(function () {
  var origin  = ${JSON.stringify(origin)};
  var payload = ${JSON.stringify(payload)};

  function receive(e) {
    if (e.origin !== origin) return;
    window.opener.postMessage("authorization:github:success:" + payload, origin);
    window.removeEventListener("message", receive, false);
    setTimeout(function () { window.close(); }, 300);
  }

  if (!window.opener) {
    document.body.innerHTML = "<p>Fenêtre parente introuvable. Fermez cet onglet et réessayez.</p>";
    return;
  }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:github", origin);
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Set-Cookie": "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
      "Cache-Control": "no-store"
    }
  });
}

function errorPage(message, origin) {
  const payload = JSON.stringify({ error: message });

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Erreur de connexion</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;text-align:center;color:#B0553A}</style>
</head><body>
<h2>Échec de la connexion</h2>
<p>${escapeHtml(message)}</p>
<script>
(function () {
  if (!window.opener) return;
  window.opener.postMessage(
    "authorization:github:error:" + ${JSON.stringify(payload)},
    ${JSON.stringify(origin)}
  );
})();
</script>
</body></html>`;

  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&", "<": "<", ">": ">", '"': """, "'": "'"
  })[c]);
}
