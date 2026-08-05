const matter = require("gray-matter");

module.exports = function (eleventyConfig) {
  // Le back-office Decap : source dans public/admin, publié sur /admin
  eleventyConfig.addPassthroughCopy({ "public/admin": "admin" });

  // Ressources statiques
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("uploads");

  // Redéclenche le build quand un document est ajouté
  eleventyConfig.addWatchTarget("./uploads/");

  // Permet de lire les fichiers .md placés dans _data/
  eleventyConfig.addDataExtension("md", (contents) => {
    const parsed = matter(contents);
    return { ...parsed.data, body: parsed.content };
  });

  // Filtre pour convertir objet en array
  eleventyConfig.addFilter("values", (value) => {
    if (!value || typeof value !== "object") return [];
    return Array.isArray(value) ? value : Object.values(value);
  });

  // Filtre pour trier les actualités : épinglées d'abord, puis par date décroissante
  eleventyConfig.addFilter("actualitesOrdonnees", (items) => {
    return [...items].sort((a, b) => {
      const epingle = Number(Boolean(b.epingle)) - Number(Boolean(a.epingle));
      if (epingle) return epingle;
      return new Date(b.date) - new Date(a.date);
    });
  });

return {
  dir: {
    input: "src",
    output: "_site",
    data: "../_data"
  }
};
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
