const markdownIt = require("markdown-it");

module.exports = function(eleventyConfig) {
  // Recopie tel quel : admin (interface CMS), images, documents
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("uploads");

  // Pages encore 100 % statiques : recopiées telles quelles, PAS traitées.
  // On les recopie via glob pour conserver l'URL exacte (/cse.html, etc.)
  eleventyConfig.addPassthroughCopy("cse.html");
  eleventyConfig.addPassthroughCopy("voir-pdf.html");

  // On dit à Eleventy d'ignorer ces fichiers en tant que gabarits,
  // pour qu'ils ne soient QUE recopiés (et gardent leur nom .html).
  eleventyConfig.ignores.add("cse.html");
  eleventyConfig.ignores.add("voir-pdf.html");
  eleventyConfig.ignores.add("admin/index.html");

  // Convertit le Markdown (champ "contenu" du CMS) en HTML
  const md = new markdownIt({ html: true, linkify: true, breaks: false });
  eleventyConfig.addFilter("markdown", (str) => {
    if (!str) return "";
    return md.render(str);
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
