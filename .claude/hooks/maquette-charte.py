#!/usr/bin/env python3
"""Refuse la publication d'une maquette d'écran qui recopie la charte au lieu de
la charger.

Motif (2026-09-26) : une maquette bâtie sur les jetons recopiés de DECISIONS.md
a les bonnes couleurs et un vocabulaire de composants inventé — boutons
arrondis, champs réinventés, accent décoratif. Les composants réels ne vivent
que dans le CSS de l'application. Charger ce CSS rend l'écart visible : un
composant inventé apparaît nu.

Règle qui bloque : une page qui écrit en dur au moins trois couleurs de la
charte sans charger `tokens.css` est refusée. Étroite volontairement — une page
d'étude ou un graphique qui n'emploie pas la palette passe sans rien déclarer.

Règle qui rappelle (ne bloque pas) : une maquette qui charge `tokens.css` sans
aucune feuille de composants passe, avec un rappel.
"""
import json
import re
import sys

PALETTE = [
    "#0c0c0e", "#e8663d", "#f5f1e8", "#ede8de", "#c9c4b8",
    "#8a867c", "#5e5b54", "#46443f", "#232320", "#1a1a18",
    "#1c1c1f", "#2e2e2a", "#242428", "#313136", "#35332e",
]
COMPOSANTS = ["SessionForm.css", "Accueil.css", "Onglets.css",
              "Historique.css", "Efficience.css", "Bilan.css"]

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
    print(
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
        "graphique), ajouter la ligne `<!-- hors-app -->` et republier.",
        file=sys.stderr,
    )
    sys.exit(2)

if charge_jetons and not any(c in page for c in COMPOSANTS):
    print(
        "Rappel : la maquette charge les jetons mais aucune feuille de "
        "composants. Vérifier que boutons, champs et étiquettes reprennent "
        "bien les classes existantes de l'app."
    )

sys.exit(0)
