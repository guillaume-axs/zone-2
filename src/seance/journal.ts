import { z } from "zod";
import type { Session, Trame } from "../db/schema";

/**
 * Lecture du journal de séance écrit par le service natif (format : Journal.kt).
 * Le service coupe tout reste de ligne avant de réécrire : une ligne illisible
 * au milieu est donc une vraie corruption.
 */

export interface Lu {
  session: Session;
  trames: Trame[];
}

const ms = z.number().int().nonnegative();

/** Trame telle que rangée : seul endroit où se fixent ses bornes. */
export const trameSchema = z.object({
  t_ms: ms,
  bpm: z.number().int().min(0).max(255),
  rr: z.array(z.number().int().positive()),
});

const nombre = z.string().regex(/^\d+$/).transform(Number);
const bornes = z.union([z.literal("-"), nombre]);
const rrSchema = z
  .string()
  .transform((s) => (s === "" ? [] : s.split(";")))
  .pipe(z.array(nombre));

const ligneD = z.tuple([
  z.literal("D"),
  nombre,
  z.string().min(1),
  bornes,
  bornes,
]);
const ligneB = z.tuple([
  z.literal("B"),
  nombre,
  nombre.pipe(trameSchema.shape.bpm),
  z.enum(["1", "0", "-"]),
  rrSchema,
]);
const ligneC = z.tuple([z.literal("C"), nombre, z.string().min(1)]);
const ligneR = z.tuple([z.literal("R"), nombre]);
const ligneS = z.tuple([z.literal("S"), nombre]);

const ligne = z.union([ligneD, ligneB, ligneC, ligneR, ligneS]);

function lireLigne(texte: string) {
  const r = ligne.safeParse(texte.split(","));
  return r.success ? r.data : null;
}

export function lireJournal(
  texte: string,
  maintenant: Date = new Date(),
): Lu | null {
  // Un reste sans `\n` final est une écriture coupée : jamais lu.
  const complet = texte.slice(0, texte.lastIndexOf("\n") + 1);
  if (complet === "") return null;
  const brutes = complet.slice(0, -1).split("\n");

  const lues: NonNullable<ReturnType<typeof lireLigne>>[] = [];
  for (let i = 0; i < brutes.length; i++) {
    const l = lireLigne(brutes[i]);
    if (l) lues.push(l);
    else if (i < brutes.length - 1) return null;
  }
  const depart = lues[0];
  if (depart?.[0] !== "D") return null;
  const debutMs = depart[1];

  const trames: Trame[] = [];
  let fin = debutMs;
  for (const l of lues) {
    fin = l[1];
    if (l[0] === "B")
      trames.push({ t_ms: l[1] - debutMs, bpm: l[2], rr: l[4] });
  }
  const stop = lues.find((l) => l[0] === "S");
  if (stop) fin = stop[1];

  const positifs = trames.filter((t) => t.bpm > 0);
  const iso = maintenant.toISOString();
  const session: Session = {
    id: depart[2],
    startedAt: new Date(debutMs).toISOString(),
    durationS: Math.max(1, Math.round((fin - debutMs) / 1000)),
    source: "live",
    createdAt: iso,
    updatedAt: iso,
  };
  if (positifs.length > 0) {
    session.avgHrBpm = Math.round(
      positifs.reduce((s, t) => s + t.bpm, 0) / positifs.length,
    );
  }
  return { session, trames };
}

const ECART_MS = 5_000;

/** Minutes entières sans trame : somme des écarts > 5 s entre 0, les trames et la fin. */
export function minutesManquantes(trames: Trame[], durationS: number): number {
  const instants = [0, ...trames.map((t) => t.t_ms), durationS * 1000];
  let trou = 0;
  for (let i = 1; i < instants.length; i++) {
    const ecart = instants[i] - instants[i - 1];
    if (ecart > ECART_MS) trou += ecart;
  }
  return Math.floor(trou / 60_000);
}
