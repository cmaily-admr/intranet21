/**
 * Construit, au moment du build, l'index de recherche globale :
 * la liste de tous les documents de toutes les rubriques, avec leur
 * titre, la rubrique et la section où ils se trouvent.
 *
 * Chaque entrée porte deux liens :
 *   - « lien »  : la destination du clic. Pour un document c'est le fichier
 *                 lui-même (via la visionneuse), pour un lien utile l'adresse
 *                 externe, sinon la page à la bonne section.
 *   - « page »  : toujours la page de la rubrique, ancrée sur la section,
 *                 pour le petit lien « dans la rubrique ».
 *
 * Les ancres (#s3, #s3-b7) sont calculées à partir du RANG des sections et
 * des blocs dans le JSON. rubrique.liquid pose exactement les mêmes
 * identifiants en bouclant sur les mêmes tableaux : les deux restent donc
 * alignés même si Florian réordonne ou renomme une section.
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

  /**
   * Nettoie un texte Markdown pour la recherche : retire les marques de mise
   * en forme et les puces de début de ligne, mais conserve les traits d'union
   * à l'intérieur des mots (Pros-Consulte, Saint-Jean…).
   */
  function texteCherchable(md) {
    return String(md || "")
      // Codes de mise en forme maison : [[sepa:x]], [[encadre:x]] … [[/encadre]].
      // Decap ajoute parfois des antislashes d'échappement, d'où les \\? .
      .replace(/\\?\[\\?\[\/?(?:sepa|encadre)(?::[a-z0-9]+)?\\?\]\\?\]/gi, " ")
      // {orange|mon texte} -> mon texte
      .replace(/\{(?:vert|orange|bleu|rouge|prune)\|([^}]*)\}/gi, "$1")
      .replace(/^[ \t]*[-*+]\s+/gm, " ")
      .replace(/^[ \t]*#{1,6}\s*/gm, " ")
      .replace(/[*_>`\[\]()!]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

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

    sections.forEach((section, iSection) => {
      const nomSection = section.titre || "";
      const blocs = Array.isArray(section.blocs) ? section.blocs : [];
      const ancreSection = "#s" + (iSection + 1);
      const pageSection = lien + ancreSection;

      blocs.forEach((bloc, iBloc) => {
        const ancreFiche = ancreSection + "-b" + (iBloc + 1);
        // On indexe les documents (titre_doc) et les boutons de lien (libelle).
        if (bloc.type === "document" && bloc.titre_doc) {
          index.push({
            titre: bloc.titre_doc,
            rubrique: nomRubrique,
            section: nomSection,
            // Clic = la visionneuse ouvre directement le PDF.
            lien: bloc.fichier ? "/voir-pdf.html?doc=" + bloc.fichier : pageSection,
            page: pageSection,
            fichier: bloc.fichier || "",
            type: "document",
          });
        } else if (bloc.type === "bouton" && bloc.libelle) {
          index.push({
            titre: bloc.libelle,
            rubrique: nomRubrique,
            section: nomSection,
            lien: bloc.url || pageSection,
            page: pageSection,
            externe: !!bloc.url,
            type: "lien",
          });
        } else if (bloc.type === "texte" && bloc.texte) {
          // Texte libre : pas de titre propre. On garde le texte comme
          // matière de recherche, et on affiche un extrait comme titre.
          const brut = texteCherchable(bloc.texte);
          const extrait = brut.length > 70 ? brut.slice(0, 70) + "…" : brut;
          if (brut) {
            index.push({
              titre: extrait,
              texte: brut,               // texte complet pour la recherche
              rubrique: nomRubrique,
              section: nomSection,
              lien: pageSection,
              page: pageSection,
              type: "texte",
            });
          }
        } else if (bloc.type === "image" && bloc.legende) {
          index.push({
            titre: bloc.legende,
            rubrique: nomRubrique,
            section: nomSection,
            lien: pageSection,
            page: pageSection,
            type: "image",
          });
        } else if (bloc.type === "video" && bloc.titre_video) {
          index.push({
            titre: bloc.titre_video,
            rubrique: nomRubrique,
            section: nomSection,
            lien: pageSection,
            page: pageSection,
            type: "vidéo",
          });
        } else if (bloc.type === "fiche" && bloc.titre_fiche) {
          // Une fiche est cherchable sur tout son contenu, encadrés compris.
          const encadres = Array.isArray(bloc.encadres) ? bloc.encadres : [];
          const corps = texteCherchable(
            [bloc.chapo || ""]
              .concat(encadres.map((e) => `${e.titre_encadre || ""} ${e.contenu || ""}`))
              .join(" ")
          );
          index.push({
            titre: bloc.titre_fiche,
            texte: corps,
            rubrique: nomRubrique,
            section: nomSection,
            lien: lien + ancreFiche,
            page: pageSection,
            type: "fiche",
          });
        }
      });
    });

    // Les "liens utiles" de fin de rubrique sont aussi indexés.
    const liens = Array.isArray(data.liens_utiles) ? data.liens_utiles : [];
    for (const l of liens) {
      if (l.libelle) {
        index.push({
          titre: l.libelle,
          rubrique: nomRubrique,
          section: "Liens utiles",
          lien: l.url || lien,
          page: lien,
          externe: !!l.url,
          type: "lien",
        });
      }
    }
  }

  return index;
};
