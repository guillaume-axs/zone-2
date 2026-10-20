import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Le greffon natif `SeancePlugin.kt`, pont vers le service de séance.
 *
 * Événements : `fc` `{ bpm, enZoneS }` à chaque trame, `etat` `{ etat }` avec
 * un nom de `Ceinture.Etat` ou `MUETTE` (connectée, rien depuis 5 s).
 */
export interface SeancePlugin {
  /** Lance le service, qui se connecte et relaie la FC sans rien écrire. `false` : Bluetooth refusé. */
  ecouter(): Promise<{ lance: boolean }>;
  /** Arrête le service, sauf séance en cours. */
  lacher(): Promise<void>;
  /** Ouvre l'enregistrement ; bornes absentes = pas de zone réglée. Rejeté si `ecouter` n'a pas tourné. */
  demarrer(o: {
    min?: number;
    max?: number;
  }): Promise<{ id: string; debutMs: number }>;
  /** Répond après la fermeture du journal ; `null` s'il n'y avait pas de séance. */
  terminer(): Promise<{ id: string | null }>;
  /** Vide s'il n'y a pas de séance tenue par un service vivant. */
  seanceActive(): Promise<{ id?: string; debutMs?: number }>;
  /** `{ etat, bpm?, derniereTrameMs?, debutMs?, enZoneS }`, ou `{}` sans service. */
  instantane(): Promise<unknown>;
  /** Les journaux à ranger, celui de la séance en cours excepté. */
  journaux(): Promise<{ journaux: { id: string; contenu: string }[] }>;
  /** Rejeté pour la séance en cours ou un id qui n'est pas un UUID. */
  effacer(o: { id: string }): Promise<void>;
  exemptionBatterie(): Promise<void>;
  addListener(e: "fc" | "etat", f: (d: unknown) => void): Promise<unknown>;
}

export const Seance = registerPlugin<SeancePlugin>("Seance");

/** Dans le navigateur (`npm run dev`), le greffon n'existe pas. */
export const natif = Capacitor.isPluginAvailable("Seance");
