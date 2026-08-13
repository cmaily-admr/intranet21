/**
 * Construit, au moment du build, l'index de recherche globale :
 * la liste de tous les documents de toutes les rubriques, avec leur
 * titre, la rubrique et la section où ils se trouvent, et le lien vers
 * la rubrique. Utilisé par la barre de recherche de l'accueil.
 *
 * Lecture directe des fichiers _data/rubriques/*.json (Eleventy exécute
 * ce fichier avant de rendre les pages).
 */

const fs = require("fs");
const path = require("path");

// Correspondance nom de fichier JSON -> page HTML de la rubrique
const PAGE = {
  "cse": "/cse.html",
  "demarche-qualite": "/demarche-qualite.html",
  "ressources-humaines": "/ressources-humaines.html",
  "communication": "/communication.html",
};

module.exports = function () {
  const dossier = path.join(__dirname, "rubriques");
  const index = [];

  let fichiers = [];
  try {
    fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith(".json"));
  } catch (e) {
    return index; // dossier absent : index vide, pas d'erreur de build
  }

  for (const fichier of fichiers) {
    const slug = fichier.replace(/\.json$/, "");
    const lien = PAGE[slug] || "/" + slug + ".html";

    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dossier, fichier), "utf8"));
    } catch (e) {
      continue; // fichier illisible : on l'ignore
    }

    const nomRubrique = data.titre || slug;
    const sections = Array.isArray(data.sections) ? data.sections : [];

    for (const section of sections) {
      const nomSection = section.titre || "";
      const blocs = Array.isArray(section.blocs) ? section.blocs : [];

      for (const bloc of blocs) {
        // On indexe les documents (titre_doc) et les boutons de lien (libelle).
        if (bloc.type === "document" && bloc.titre_doc) {
          index.push({
            titre: bloc.titre_doc,
            rubrique: nomRubrique,
            section: nomSection,
            lien: lien,
            type: "document",
          });
        } else if (bloc.type === "bouton" && bloc.libelle) {
          index.push({
            titre: bloc.libelle,
            rubrique: nomRubrique,
            section: nomSection,
            lien: lien,
            type: "lien",
          });
        } else if (bloc.type === "texte" && bloc.texte) {
          // Texte libre : pas de titre propre. On garde le texte comme
          // matière de recherche, et on affiche un extrait comme titre.
          const brut = bloc.texte
            .replace(/[#*_>`\[\]()!-]/g, " ")   // retire les marques Markdown
            .replace(/\s+/g, " ")
            .trim();
          const extrait = brut.length > 70 ? brut.slice(0, 70) + "…" : brut;
          if (brut) {
            index.push({
              titre: extrait,
              texte: brut,               // texte complet pour la recherche
              rubrique: nomRubrique,
              section: nomSection,
              lien: lien,
              type: "texte",
            });
          }
        } else if (bloc.type === "image" && bloc.legende) {
          index.push({
            titre: bloc.legende,
            rubrique: nomRubrique,
            section: nomSection,
            lien: lien,
            type: "image",
          });
        } else if (bloc.type === "video" && bloc.titre_video) {
          index.push({
            titre: bloc.titre_video,
            rubrique: nomRubrique,
            section: nomSection,
            lien: lien,
            type: "vidéo",
          });
        }
      }
    }

    // Les "liens utiles" de fin de rubrique sont aussi indexés.
    const liens = Array.isArray(data.liens_utiles) ? data.liens_utiles : [];
    for (const l of liens) {
      if (l.libelle) {
        index.push({
          titre: l.libelle,
          rubrique: nomRubrique,
          section: "Liens utiles",
          lien: lien,
          type: "lien",
        });
      }
    }
  }

  return index;
};
