#!/usr/bin/env python3
"""Refuse la publication d'une maquette d'écran qui recopie la charte au lieu de
la charger, ou qui n'a pas regardé le marché avant de dessiner.

Motif du premier verrou (2026-09-26) : une maquette bâtie sur les jetons
recopiés de DECISIONS.md a les bonnes couleurs et un vocabulaire de composants
inventé — boutons arrondis, champs réinventés, accent décoratif. Les composants
réels ne vivent que dans le CSS de l'application. Charger ce CSS rend l'écart
visible : un composant inventé apparaît nu.

Motif du second verrou (2026-09-26, même journée) : la règle « étude UX avant
toute maquette » était écrite dans CLAUDE.md, et la maquette de Zone cible a
quand même été inventée — bâtie sur le *texte* des pages d'aide du marché, pas
sur ses *écrans*. Une page d'aide n'est pas un écran. Un texte de consigne est
un rappel qu'on contourne sans le voir ; ce hook est un mur.

Règles qui bloquent :
  1. une page qui écrit en dur au moins trois couleurs de la charte sans
     charger `tokens.css` ;
  2. une maquette (elle charge `tokens.css`) sans bloc SOURCES conforme : au
     moins deux écrans concurrents réellement regardés, fichiers présents sur
     le disque, et pour chacun ce qu'on garde et ce qu'on jette.

Les deux sont étroites volontairement — une page d'étude ou un graphique qui
n'emploie pas la palette passe sans rien déclarer, et `<!-- hors-app -->` sort
du champ une page qui n'est pas une maquette d'écran.

Il n'y a pas d'échappatoire au bloc SOURCES : un écran sans équivalent sur le
marché est un arbitrage à soumettre au PO, pas une case à cocher.

Règle qui rappelle (ne bloque pas) : une maquette qui charge `tokens.css` sans
aucune feuille de composants passe, avec un rappel.
"""
import json
import os
import re
import sys

PALETTE = [
    "#0c0c0e", "#e8663d", "#f5f1e8", "#ede8de", "#c9c4b8",
    "#8a867c", "#5e5b54", "#46443f", "#232320", "#1a1a18",
    "#1c1c1f", "#2e2e2a", "#242428", "#313136", "#35332e",
]
COMPOSANTS = ["SessionForm.css", "Accueil.css", "Onglets.css",
              "Historique.css", "Efficience.css", "Bilan.css"]

# Une entrée du bloc SOURCES : application · écran · fichier de la capture.
ENTREE = re.compile(r"^\s*(.+?)\s+·\s+(.+?)\s+·\s+(\S+)\s*$")

MODE_EMPLOI = (
    "Format attendu, en tête de la page :\n\n"
    "  <!-- SOURCES\n"
    "  Strava · écran de séance en cours · captures/strava-seance.png\n"
    "    garde : les trois chiffres empilés, le plus gros en haut\n"
    "    jette : la carte du parcours, sans objet sur un vélo de salle\n"
    "  Garmin Connect · écran de séance en cours · captures/garmin-seance.png\n"
    "    garde : le fond noir et le contraste élevé\n"
    "    jette : les jauges circulaires\n"
    "  -->\n\n"
    "Où trouver les écrans, dans cet ordre : la fiche Play Store ou App Store "
    "de l'app (5 à 8 captures officielles), les bancs d'essai (DC Rainmaker, "
    "the5krunner, Tom's Guide), la version web de l'app via Claude dans "
    "Chrome. Une page d'aide de l'éditeur ne compte pas : elle est en texte, "
    "elle ne montre pas l'écran."
)


def refuser(message):
    print(message, file=sys.stderr)
    sys.exit(2)


try:
    charge = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if charge.get("tool_name") != "Artifact":
    sys.exit(0)

entree = charge.get("tool_input") or {}
if entree.get("action") not in (None, "", "publish"):
    sys.exit(0)
if entree.get("asset"):
    sys.exit(0)

chemin = entree.get("file_path") or ""
if not chemin.endswith(".html"):
    sys.exit(0)

try:
    with open(chemin, encoding="utf-8", errors="replace") as f:
        page = f.read()
except OSError:
    sys.exit(0)

bas = page.lower()
if "<!-- hors-app -->" in bas:
    sys.exit(0)

# Les couleurs écrites en dur, hors déclaration de variable pointant vers l'app.
trouvees = sorted({c for c in PALETTE if c in bas})
charge_jetons = "tokens.css" in page

if len(trouvees) >= 3 and not charge_jetons:
    refuser(
        "Maquette refusée — la charte est recopiée au lieu d'être chargée.\n"
        f"Couleurs en dur trouvées : {', '.join(trouvees)}\n\n"
        "À faire avant de republier :\n"
        "  1. publier `src/styles/tokens.css` à côté de la page (paramètre "
        "`files`) et le charger par <link>, puis n'employer que var(--bg), "
        "var(--accent), var(--fg-hero)… — aucune couleur en dur ;\n"
        "  2. publier aussi le CSS de l'écran existant le plus proche "
        f"({', '.join(COMPOSANTS[:2])}…) et réutiliser ses classes : .save "
        "(carré, fond --fg-hero), .field, .tag, .stepper, .label. "
        "DECISIONS.md donne les jetons, ce CSS donne les composants ;\n"
        "  3. tout composant réellement nouveau se soumet comme arbitrage, "
        "avec son motif — jamais en douce.\n\n"
        "Si cette page n'est pas une maquette d'écran de l'app (page d'étude, "
        "graphique), ajouter la ligne `<!-- hors-app -->` et republier."
    )

# ---- Second verrou : le marché a-t-il été regardé ? ----
if charge_jetons:
    bloc = re.search(r"<!--\s*SOURCES\b(.*?)-->", page, re.S)
    if not bloc:
        refuser(
            "Maquette refusée — aucun écran du marché n'a été regardé.\n\n"
            "Avant de dessiner un écran, deux écrans concurrents au moins ont "
            "été ouverts comme images, et la maquette dit lesquels, ce qu'on "
            "leur prend et ce qu'on leur laisse. C'est la règle de "
            "CLAUDE.md : sans ça, on invente.\n\n" + MODE_EMPLOI
        )

    corps = bloc.group(1)
    dossier = os.path.dirname(os.path.abspath(chemin))
    sources, manquants = [], []
    for ligne in corps.splitlines():
        trouve = ENTREE.match(ligne)
        if not trouve:
            continue
        app, ecran, capture = trouve.groups()
        sources.append((app, ecran, capture))
        if not os.path.exists(os.path.join(dossier, capture)):
            manquants.append(capture)

    if len(sources) < 2:
        refuser(
            f"Maquette refusée — le bloc SOURCES cite {len(sources)} écran(s), "
            "il en faut deux.\n"
            "Un seul concurrent, c'est du calque ; deux, c'est une pratique du "
            "marché.\n\n" + MODE_EMPLOI
        )

    if manquants:
        refuser(
            "Maquette refusée — des captures citées n'existent pas sur le "
            "disque :\n  " + "\n  ".join(manquants) + "\n\n"
            "Les chemins sont relatifs à la page. Citer un écran qu'on n'a pas "
            "ouvert, c'est exactement l'erreur que ce garde-fou empêche."
        )

    minuscule = corps.lower()
    if minuscule.count("garde :") < len(sources) or minuscule.count("jette :") < len(sources):
        refuser(
            f"Maquette refusée — {len(sources)} écrans cités, mais il manque "
            "des lignes `garde :` et `jette :`.\n"
            "Chaque écran regardé en a une de chaque : ce qu'on lui prend, et "
            "ce qu'on écarte avec son motif. Sans ça on recopie sans "
            "comprendre.\n\n" + MODE_EMPLOI
        )

if charge_jetons and not any(c in page for c in COMPOSANTS):
    print(
        "Rappel : la maquette charge les jetons mais aucune feuille de "
        "composants. Vérifier que boutons, champs et étiquettes reprennent "
        "bien les classes existantes de l'app."
    )

sys.exit(0)
