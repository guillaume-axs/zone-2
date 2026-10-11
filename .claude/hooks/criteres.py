#!/usr/bin/env python3
"""Refuse de modifier un écran tant que la feature n'a pas sa liste de critères.

Motif (2026-10-11, sujet 17) : le banc ne vérifie que ce qu'on lui apprend. Un
test écrit après le code vérifie ce que le code fait, pas ce que le PO a
demandé. La liste des critères se construit donc avant la première ligne, et
le PO la valide avec l'approche. Une règle écrite se contourne sans la voir ;
ce hook est un mur, comme maquette-charte.py.

La liste vit dans le plan de la branche : `docs/superpowers/plans/*-<nom>.md`,
où <nom> est le nom de la branche sans son préfixe (feat/export-import →
*-export-import.md). Elle tient sous un titre `## Critères`, en tableau
« critère | vérifié par » : une ligne au moins.

Seuls les écrans sont gardés (src/ecrans, src/forms) — ce que le banc parcourt.

Les commandes shell aussi (2026-10-11) : `sed -i`, une redirection, `tee`, `cp`,
`mv`, `perl -i` ou un `open(..., "w")` qui visent un écran passent par le même
contrôle. Une lecture (`grep`, `cat`) n'est pas gardée.
"""
import glob
import json
import os
import re
import subprocess
import sys

ECRANS = re.compile(r"/src/(ecrans|forms)/[^/]+\.(tsx|css)$")
CHEMIN = r"([\w./-]*src/(?:ecrans|forms)/[\w.-]+\.(?:tsx|css))"
ECRITURES = [
    re.compile(r"\b(?:sed|perl)\s+(?:-\w+\s+)*-\w*i[^|;&]*?" + CHEMIN),
    re.compile(r">>?\s*['\"]?" + CHEMIN),
    re.compile(r"\btee\s+(?:-\w+\s+)*['\"]?" + CHEMIN),
    re.compile(r"\b(?:cp|mv)\s[^|;&]*?" + CHEMIN + r"['\"]?\s*(?:$|[|;&])", re.M),
    re.compile(r"open\(\s*['\"]" + CHEMIN + r"['\"]\s*,\s*['\"][wa]"),
]


def refuser(message):
    print(message, file=sys.stderr)
    sys.exit(2)


def git(dossier, *args):
    return subprocess.run(
        ["git", "-C", dossier, *args], capture_output=True, text=True
    ).stdout.strip()


try:
    charge = json.load(sys.stdin)
except Exception:
    sys.exit(0)

entree = charge.get("tool_input") or {}
if charge.get("tool_name") == "Bash":
    commande = entree.get("command") or ""
    vises = [m.group(1) for r in ECRITURES for m in r.finditer(commande)]
    if not vises:
        sys.exit(0)
    chemin = os.path.join(charge.get("cwd") or os.getcwd(), vises[0])
else:
    chemin = entree.get("file_path") or ""
if not ECRANS.search(os.path.abspath(chemin)):
    sys.exit(0)
chemin = os.path.abspath(chemin)

dossier = os.path.dirname(chemin)
racine = git(dossier, "rev-parse", "--show-toplevel")
branche = git(dossier, "rev-parse", "--abbrev-ref", "HEAD")
if not racine or not branche:
    sys.exit(0)

if branche in ("main", "master"):
    refuser("Un écran ne se modifie pas sur main : créer d'abord la branche de la feature.")

nom = branche.split("/")[-1]
plans = glob.glob(os.path.join(racine, "docs/superpowers/plans", f"*-{nom}.md"))

for plan in plans:
    with open(plan, encoding="utf-8") as f:
        texte = f.read()
    section = re.search(r"^## Critères\s*$(.*?)(?=^## |\Z)", texte, re.M | re.S)
    if not section:
        continue
    lignes = [
        l for l in section.group(1).splitlines()
        if l.startswith("|") and not re.fullmatch(r"[|\s:-]+", l)
    ]
    # La première ligne est l'en-tête du tableau.
    if len(lignes) >= 2:
        sys.exit(0)

refuser(
    f"Pas de liste de critères pour la branche « {branche} ».\n"
    f"Avant de toucher un écran : créer docs/superpowers/plans/AAAA-MM-JJ-{nom}.md "
    "avec une section `## Critères` en tableau « Critère | Vérifié par », bâtie "
    "depuis la demande du PO, DECISIONS.md et les états fixes (vide, chargement, "
    "erreur, texte long, clavier, retour, hors ligne) — puis la soumettre au PO "
    "avec l'approche. Sujet 17 de DECISIONS.md."
)
