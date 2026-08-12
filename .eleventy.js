module.exports = function(eleventyConfig) {
  // Recopie tel quel : HTML, admin, images, documents
  eleventyConfig.addPassthroughCopy("*.html");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("uploads");

  return {
    dir: {
      input: ".",
      output: "_site"
    }
  };
};
