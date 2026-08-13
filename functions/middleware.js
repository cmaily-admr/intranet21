/**
 * Middleware de protection par mot de passe des pages « rubriques ».
 *
 * - Protège uniquement les pages listées dans PAGES_PROTEGEES.
 * - Accepte n'importe quel mot de passe présent dans la variable
 *   d'environnement MOTS_DE_PASSE (liste séparée par des virgules).
 * - Après connexion réussie, pose un cookie signé valable 30 jours.
 * - Les autres pages (accueil, actus, associations, CMS, API) ne sont
 *   jamais interceptées.
 *
 * Variables d'environnement Cloudflare attendues :
 *   MOTS_DE_PASSE  : "motdepasse1,motdepasse2,..."
 *   CLE_SIGNATURE  : une longue chaîne aléatoire (secret de signature du cookie)
 */

const PAGES_PROTEGEES = [
  "/cse.html",
  "/demarche-qualite.html",
  "/ressources-humaines.html",
  "/communication.html",
  "/limites-professionnelles.html",
];

const COOKIE_NOM = "acces_rubriques";
const DUREE_JOURS = 30;

// --- Utilitaires de signature (HMAC-SHA256) ---------------------------------

async function importerCle(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function versBase64Url(buffer) {
  const octets = new Uint8Array(buffer);
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Génère la valeur signée du cookie : "<expiration>.<signature>"
async function fabriquerJeton(secret) {
  const expiration = Date.now() + DUREE_JOURS * 24 * 60 * 60 * 1000;
  const cle = await importerCle(secret);
  const donnee = new TextEncoder().encode(String(expiration));
  const sig = await crypto.subtle.sign("HMAC", cle, donnee);
  return `${expiration}.${versBase64Url(sig)}`;
}

// Vérifie un jeton : signature valide ET non expiré
async function jetonValide(jeton, secret) {
  if (!jeton || jeton.indexOf(".") === -1) return false;
  const [expirationStr, sigFournie] = jeton.split(".");
  const expiration = parseInt(expirationStr, 10);
  if (!expiration || Date.now() > expiration) return false;
  const cle = await importerCle(secret);
  const donnee = new TextEncoder().encode(String(expiration));
  const sigAttendue = versBase64Url(await crypto.subtle.sign("HMAC", cle, donnee));
  // Comparaison simple (les deux sont des chaînes base64url de même longueur)
  if (sigFournie.length !== sigAttendue.length) return false;
  let diff = 0;
  for (let i = 0; i < sigAttendue.length; i++) {
    diff |= sigFournie.charCodeAt(i) ^ sigAttendue.charCodeAt(i);
  }
  return diff === 0;
}

function lireCookie(request, nom) {
  const brut = request.headers.get("Cookie") || "";
  for (const part of brut.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === nom) return v.join("=");
  }
  return null;
}

// --- Page HTML de saisie du mot de passe ------------------------------------

function pageMotDePasse(destination, erreur) {
  const msg = erreur
    ? '<p class="err">Mot de passe incorrect. Merci de réessayer.</p>'
    : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Accès réservé — ADMR Côte-d'Or</title>
<style>
  :root { --vert-admr:#5B9B31; --vert-fonce:#2E5A1C; --fond:#F6F8F3; --gris:#363636; --orange:#E58A00; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
         background:var(--fond); color:var(--gris); padding:24px; }
  .carte { background:#fff; border:1px solid #E7EBE1; border-radius:16px; padding:34px 30px;
           max-width:420px; width:100%; box-shadow:0 6px 24px rgba(0,0,0,.06); }
  h1 { margin:0 0 6px; font-size:1.4rem; color:var(--vert-fonce); }
  p.sous { margin:0 0 22px; color:#6B6B6B; font-size:.95rem; }
  label { display:block; font-weight:700; margin-bottom:8px; font-size:.95rem; }
  input { width:100%; padding:13px 15px; font-size:1rem; border:1px solid #E7EBE1;
          border-radius:10px; margin-bottom:16px; }
  input:focus { outline:3px solid var(--orange); outline-offset:1px; border-color:transparent; }
  button { width:100%; padding:13px; font-size:1rem; font-weight:700; color:#fff;
           background:var(--vert-admr); border:none; border-radius:10px; cursor:pointer; }
  button:hover { background:var(--vert-fonce); }
  .err { color:#B00020; font-size:.9rem; margin:0 0 16px; }
  .aide { margin:18px 0 0; font-size:.85rem; color:#6B6B6B; }
</style>
</head>
<body>
  <div class="carte">
    <h1>Accès réservé</h1>
    <p class="sous">Cette rubrique est réservée aux salariés de l'ADMR de Côte-d'Or. Merci de saisir le mot de passe communiqué par votre association.</p>
    ${msg}
    <form method="POST" action="/_acces">
      <input type="hidden" name="destination" value="${destination}">
      <label for="mdp">Mot de passe</label>
      <input type="password" id="mdp" name="motdepasse" autocomplete="current-password" autofocus required>
      <button type="submit">Entrer</button>
    </form>
    <p class="aide">Vous restez connecté pendant ${DUREE_JOURS} jours sur cet appareil. En cas de souci, contactez la communication de la Fédération.</p>
  </div>
</body>
</html>`;
}

// --- Middleware principal ---------------------------------------------------

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const chemin = url.pathname;

  // 1) Traitement de la soumission du formulaire (POST /_acces)
  if (chemin === "/_acces" && request.method === "POST") {
    const form = await request.formData();
    const saisi = (form.get("motdepasse") || "").toString().trim();
    let destination = (form.get("destination") || "/").toString();
    // Sécurité : la destination doit être une des pages protégées
    if (!PAGES_PROTEGEES.includes(destination)) destination = "/";

    const liste = (env.MOTS_DE_PASSE || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    const ok = saisi.length > 0 && liste.includes(saisi);

    if (!ok) {
      return new Response(pageMotDePasse(destination, true), {
        status: 401,
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    const jeton = await fabriquerJeton(env.CLE_SIGNATURE || "cle-par-defaut-a-changer");
    const headers = new Headers();
    headers.set("Location", destination);
    headers.append(
      "Set-Cookie",
      `${COOKIE_NOM}=${jeton}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${DUREE_JOURS * 24 * 60 * 60}`
    );
    return new Response(null, { status: 302, headers });
  }

  // 2) Les pages non protégées passent directement
  if (!PAGES_PROTEGEES.includes(chemin)) {
    return next();
  }

  // 3) Page protégée : vérifier le cookie
  const jeton = lireCookie(request, COOKIE_NOM);
  const valide = await jetonValide(jeton, env.CLE_SIGNATURE || "cle-par-defaut-a-changer");

  if (valide) {
    return next(); // accès autorisé
  }

  // 4) Pas de cookie valide : afficher la page mot de passe
  return new Response(pageMotDePasse(chemin, false), {
    status: 401,
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}
