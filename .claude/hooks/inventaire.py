#!/usr/bin/env python3
"""Le vocabulaire visuel de l'application, relu depuis les sources.

Rien ici n'est écrit à la main : ce texte est reconstruit à chaque démarrage de
session et après chaque `/compact`, puis injecté dans le contexte de Claude. Il
ne peut donc pas mentir sur l'état du code, et il n'y a pas de fichier généré à
tenir à jour.

Il existe parce que les décisions survivent à la compaction mais pas les
détails : le 2026-09-26, le toast d'une maquette a été rebâti sans son anneau
qui se vide, et la marque ECG de l'application a été déclarée inexistante alors
qu'elle vit dans `SessionForm.tsx`. Les deux étaient sous les yeux, dans des
fichiers qu'on n'avait pas ouverts. D'où les deux moitiés de cet inventaire :
les classes CSS, et les SVG écrits directement dans le TSX — ces derniers sont
invisibles pour qui ne lit que les feuilles de style.
"""

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
SOURCE = RACINE / "src"

# Les propriétés qui disent la forme d'un composant. Les autres (transitions,
# marges de détail) alourdiraient l'inventaire sans aider à le reconnaître.
FORMES = (
    "position", "display", "flex", "gap", "width", "height", "min-height",
    "padding", "font-family", "font-size", "font-weight", "letter-spacing",
    "text-transform", "color", "background", "border", "border-top",
    "border-bottom", "border-radius", "stroke", "stroke-width", "fill",
    "animation", "box-shadow", "opacity",
)
COMBIEN = 4

# À quoi sert chaque feuille. Un nom de fichier ne dit pas toujours l'écran.
ROLES = {
    "styles/tokens.css": "la charte : couleurs, polices, filets (sujet 7)",
    "styles/base.css": "socle du document et classes partagées par tous les écrans",
    "styles/fonts.css": "les fontes",
    "ecrans/Onglets.css": "gabarit commun : barre du bas, bouton flottant, toasts",
    "ecrans/Accueil.css": "Accueil",
    "ecrans/Bilan.css": "briques de lecture de chiffres, partagées Accueil/Efficience",
    "ecrans/Efficience.css": "Efficience (le détail derrière le héros)",
    "ecrans/Historique.css": "Historique",
    "forms/SessionForm.css": "saisie d'une séance",
    "poc/Survie.css": "écran de diagnostic du PoC — temporaire",
}


def sans_commentaires(css: str) -> str:
    """Les commentaires du projet citent des classes en exemple (`.mon-bouton`
    dans `base.css`). Les lire ferait inventer du vocabulaire qui n'existe pas."""
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def classes(css: str):
    """Les classes déclarées, dans l'ordre du fichier, avec leur forme.

    Un même nom peut revenir (état `.row.off`, variante `.value.ghost`) : on ne
    garde que sa première déclaration, celle qui le définit.
    """
    vues = set()
    for bloc in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        selecteur, corps = bloc.group(1), bloc.group(2)
        if selecteur.lstrip().startswith("@") or "%" in selecteur:
            continue
        retenues = []
        for prop in FORMES:
            m = re.search(rf"(?<![-\w]){prop}\s*:\s*([^;}}]+)", corps)
            if m:
                valeur = " ".join(m.group(1).split())
                retenues.append(f"{prop}:{valeur[:34]}")
            if len(retenues) == COMBIEN:
                break
        for nom in dict.fromkeys(re.findall(r"\.(-?[A-Za-z_][\w-]*)", selecteur)):
            if nom in vues:
                continue
            vues.add(nom)
            yield nom, " · ".join(retenues)


def dessins(tsx: str):
    """Les dessins du fichier, dans l'ordre des lignes.

    Deux relevés distincts, jamais rattachés l'un à l'autre : l'ouverture d'un
    `<svg>` (sa classe, sa boîte) et chaque tracé. Les icônes de la barre du bas
    sont du JSX rangé dans un tableau, hors de tout `<svg>` — les chercher
    seulement à l'intérieur d'une balise les rendrait invisibles. Et la classe
    d'un `<svg>` n'est pas celle de ses enfants : `.toast__piste` désigne le
    cercle du minuteur, pas la croix du bouton qui ferme.
    """
    vus = []
    for m in re.finditer(r"<svg\b[^>]*>", tsx):
        nom = re.search(r'className="([^"]+)"', m.group(0))
        boite = re.search(r'viewBox="([^"]+)"', m.group(0))
        vus.append((m.start(), f"<svg> {'.' + nom.group(1) if nom else 'sans classe'}"
                              f" · viewBox {boite.group(1) if boite else '?'}"))
    for m in re.finditer(r'\bd="([^"]+)"', tsx):
        vus.append((m.start(), "d=" + " ".join(m.group(1).split())[:110]))
    # Un tracé n'est pas toujours un `<path>`. L'icône des Réglages est deux
    # traits *et deux cercles* ; ne relever que les `d="…"` la montrait à moitié,
    # ce qui est pire que ne pas la montrer du tout.
    for m in re.finditer(r"<(circle|rect|line|polyline|polygon|ellipse)\b([^>]*)>", tsx):
        attrs = " ".join(
            f"{a}={v}" for a, v in re.findall(r'\b(c?[xy]\d?|r[xy]?|width|height|points)="([^"]+)"', m.group(2))
        )
        vus.append((m.start(), f"<{m.group(1)}> {attrs}"[:120]))
    for place, quoi in sorted(vus):
        yield tsx[:place].count("\n") + 1, quoi


def main() -> int:
    if not SOURCE.is_dir():
        return 0
    sortie = [
        "# Vocabulaire visuel de l'application (relu à l'instant depuis src/)",
        "",
        "Réutiliser ces classes telles quelles. En créer une nouvelle est un",
        "arbitrage à soumettre au PO, jamais un choix silencieux. Reprendre un",
        "composant veut dire le reprendre **entier** : ses sous-classes sont",
        "listées juste sous lui.",
        "",
    ]

    for chemin in sorted(SOURCE.rglob("*.css")):
        rel = chemin.relative_to(SOURCE).as_posix()
        texte = chemin.read_text(encoding="utf-8")
        trouvees = list(classes(sans_commentaires(texte)))
        if not trouvees:
            continue
        sortie.append(f"## src/{rel} — {ROLES.get(rel, '?')}")
        for nom, forme in trouvees:
            sortie.append(f"  .{nom}" + (f"  {forme}" if forme else ""))
        sortie.append("")

    sortie += [
        "## SVG écrits dans le TSX",
        "",
        "Aucune feuille de style ne les montre. « sans classe » veut dire que le",
        "dessin n'est réutilisable qu'en le recopiant depuis ce fichier.",
        "",
    ]
    for chemin in sorted(SOURCE.rglob("*.tsx")):
        releve = list(dessins(chemin.read_text(encoding="utf-8")))
        if not releve:
            continue
        sortie.append(f"  src/{chemin.relative_to(SOURCE).as_posix()}")
        for ligne, quoi in releve:
            sortie.append(f"    l.{ligne}  {quoi}")
    sortie.append("")

    sys.stdout.write("\n".join(sortie))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
