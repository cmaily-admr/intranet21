const markdownIt = require("markdown-it");

module.exports = function(eleventyConfig) {
  // Recopie tel quel : admin (interface CMS), images, documents
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("uploads");

  // CRUCIAL : les fonctions Cloudflare Pages (OAuth GitHub pour Decap).
  // Sans cette ligne, /api/auth renvoie 404 et le « Login with GitHub » échoue.
  eleventyConfig.addPassthroughCopy("functions");

  // voir-pdf.html reste une page statique (visionneuse PDF.js) : recopiée telle quelle.
  eleventyConfig.addPassthroughCopy("voir-pdf.html");
  eleventyConfig.ignores.add("voir-pdf.html");
  eleventyConfig.ignores.add("admin/index.html");

  // NB : cse.html + les 4 autres rubriques sont désormais des GABARITS
  // (ils lisent _data/rubriques/*.json). On ne les ignore donc plus.

  // Convertit le Markdown (champs "texte"/"contenu" du CMS) en HTML
  const md = new markdownIt({ html: true, linkify: true, breaks: true });
  eleventyConfig.addFilter("markdown", (str) => {
    if (!str) return "";
    return md.render(str);
  });

  // Transforme un objet (dossier de données Eleventy) en tableau de ses valeurs,
  // pour pouvoir trier/boucler. Ex. : {{ actualites | valeurs | sort: "date" }}
  eleventyConfig.addFilter("valeurs", (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    return Object.values(obj);
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
