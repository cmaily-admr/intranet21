const markdownIt = require("markdown-it");

module.exports = function(eleventyConfig) {
  // Recopie tel quel : admin (interface CMS), images, documents
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("uploads");

  // CRUCIAL : les fonctions Cloudflare Pages (OAuth GitHub pour Decap).
  // Sans cette ligne, /api/auth renvoie 404 et le « Login with GitHub » échoue.
  eleventyConfig.addPassthroughCopy("functions");

  // Sécurité / obscurité : robots.txt bloque les moteurs, _headers ajoute
  // l'en-tête noindex au niveau HTTP (y compris pour les PDF de /uploads).
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("_headers");

  // voir-pdf.html reste une page statique (visionneuse PDF.js) : recopiée telle quelle.
  eleventyConfig.addPassthroughCopy("voir-pdf.html");
  eleventyConfig.ignores.add("voir-pdf.html");
  eleventyConfig.ignores.add("admin/index.html");

  eleventyConfig.addPassthroughCopy("nos-associations.html");
  eleventyConfig.ignores.add("nos-associations.html");

  // NB : cse.html + les 4 autres rubriques sont désormais des GABARITS
  // (ils lisent _data/rubriques/*.json). On ne les ignore donc plus.

  // Convertit le Markdown (champs "texte"/"contenu" du CMS) en HTML
  const md = new markdownIt({ html: true, linkify: true, breaks: true });
  // Sérialise une valeur en JSON pour l'injecter dans un <script>.
  // Échappe < pour ne pas casser la balise script.
  // Convertit n'importe quel lien YouTube (youtu.be, watch?v=, embed, shorts)
  // vers le format d'intégration RGPD : youtube-nocookie.com/embed/ID.
  // Permet de coller le lien de partage YouTube directement dans le CMS.
  eleventyConfig.addFilter("youtubeEmbed", (url) => {
    if (!url) return "";
    url = String(url).trim();
    let id = "";
    let m;
    if ((m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/))) id = m[1];              // watch?v=ID
    else if ((m = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/))) id = m[1];   // youtu.be/ID
    else if ((m = url.match(/\/embed\/([A-Za-z0-9_-]{6,})/))) id = m[1];     // .../embed/ID
    else if ((m = url.match(/\/shorts\/([A-Za-z0-9_-]{6,})/))) id = m[1];    // .../shorts/ID
    else if ((m = url.match(/^([A-Za-z0-9_-]{6,})$/))) id = m[1];             // juste l'ID
    if (!id) return url; // format inconnu : on renvoie tel quel plutôt que de casser
    return "https://www.youtube-nocookie.com/embed/" + id;
  });

  eleventyConfig.addFilter("jsonifie", (valeur) => {
    return JSON.stringify(valeur || []).replace(/</g, "\\u003c");
  });

  eleventyConfig.addFilter("markdown", (str) => {
    if (!str) return "";
    return md.render(str);
  });

  // Table des séparateurs thématiques (code court -> fichier SVG).
  const SEPARATEURS = {
    "actu": "sepa_Actu.svg",
    "alerte": "sepa_Alerte.svg",
    "cse": "sepa_CSE.svg",
    "rh": "sepa_RHetinfo.svg",
    "branche": "sepa_La_branche.svg",
    "ag2r": "sepa_AG2R.svg",
    "logement": "sepa_Action_logement.svg",
    "aist": "sepa_AIST.svg",
    "fete": "sepa_Fete.svg",
  };

  // Remplace les codes [[sepa:nom]] par l'image du séparateur correspondant.
  // Utilisé dans le contenu Markdown des actualités.
  eleventyConfig.addFilter("separateurs", (str) => {
    if (!str) return "";
    return String(str).replace(/\[\[sepa:([a-z0-9]+)\]\]/gi, (bloc, nom) => {
      const fichier = SEPARATEURS[nom.toLowerCase()];
      if (!fichier) return ""; // code inconnu : on retire le code sans rien afficher
      return `<img class="separateur" src="/assets/separateurs/${fichier}" alt="" aria-hidden="true">`;
    });
  });

  // Transforme un objet (dossier de données Eleventy) en tableau de ses valeurs,
  // pour pouvoir trier/boucler. Ex. : {{ actualites | valeurs | sort: "date" }}
  eleventyConfig.addFilter("valeurs", (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    return Object.values(obj);
  });

  // Renvoie l'actualité à mettre à la une : la plus récente parmi celles
  // cochées « a_la_une ». Renvoie null si aucune n'est cochée.
  eleventyConfig.addFilter("actuALaUne", (obj) => {
    const liste = obj ? (Array.isArray(obj) ? obj : Object.values(obj)) : [];
    const cochees = liste.filter((a) => a && a.a_la_une);
    if (cochees.length === 0) return null;
    cochees.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return cochees[0];
  });

  // Renvoie toutes les actualités SAUF celle à la une, triées de la plus
  // récente à la plus ancienne.
  eleventyConfig.addFilter("actusPrecedentes", (obj) => {
    const liste = obj ? (Array.isArray(obj) ? obj : Object.values(obj)) : [];
    const cochees = liste.filter((a) => a && a.a_la_une);
    let uneDate = null;
    if (cochees.length > 0) {
      cochees.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      uneDate = cochees[0].date;
    }
    let restantes = liste.slice();
    if (uneDate !== null) {
      // On retire UNE seule occurrence : celle qui est à la une.
      const idx = restantes.findIndex((a) => a.a_la_une && a.date === uneDate);
      if (idx !== -1) restantes.splice(idx, 1);
    }
    restantes.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return restantes;
  });

  // Renvoie true si la date fournie remonte à moins de 30 jours (badge « Nouveau »).
  eleventyConfig.addFilter("estRecent", (value) => {
    if (!value) return false;
    const d = new Date(value);
    if (isNaN(d)) return false;
    const maintenant = Date.now();
    const trenteJours = 30 * 24 * 60 * 60 * 1000;
    return (maintenant - d.getTime()) < trenteJours && d.getTime() <= maintenant;
  });

  // Affiche une date ISO (AAAA-MM-JJ) au format français : « 28 juillet 2026 »
  eleventyConfig.addFilter("dateFr", (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d)) return value;
    const mois = ["janvier","février","mars","avril","mai","juin","juillet",
                  "août","septembre","octobre","novembre","décembre"];
    const jour = d.getUTCDate();
    const jourAff = jour === 1 ? "1er" : jour;
    return `${jourAff} ${mois[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });

  return {
    dir: {
      input: ".",
      output: "_site"
    }
  };
};
