module.exports = function (eleventyConfig) {
  // Le back-office Decap : source dans public/admin, publié sur /admin
  eleventyConfig.addPassthroughCopy({ "public/admin": "admin" });

  // Ressources statiques
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("uploads");

  // Redéclenche le build quand un document est ajouté
  eleventyConfig.addWatchTarget("./uploads/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
