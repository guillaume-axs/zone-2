import { describe, expect, it } from "vitest";
import { lireJournal, minutesManquantes, trameSchema } from "./journal";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const lire = (lignes: string[], fin = "\n") =>
  lireJournal(lignes.join("\n") + fin, NOW);

describe("lireJournal", () => {
  it("range durée, FC moyenne et trames", () => {
    const lu = lire([
      "D,1000,u1,120,135",
      "B,2000,130,1,800",
      "B,3000,132,1,790;805",
      "S,4000",
    ]);
    expect(lu?.session).toMatchObject({
      id: "u1",
      durationS: 3,
      avgHrBpm: 131,
      source: "live",
      startedAt: new Date(1000).toISOString(),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(lu?.trames).toEqual([
      { t_ms: 1000, bpm: 130, rr: [800] },
      { t_ms: 2000, bpm: 132, rr: [790, 805] },
    ]);
  });

  it("sans S, la durée s'arrête à la dernière ligne", () => {
    expect(
      lire(["D,1000,u1,-,-", "B,5000,130,-,", "C,6000,PERDU"])?.session
        .durationS,
    ).toBe(5);
  });

  it('lit contact "-", rr vide, C et R sans les ranger', () => {
    const lu = lire([
      "D,0,u1,-,-",
      "B,1000,120,-,",
      "C,2000,CONNECTE",
      "R,3000",
    ]);
    expect(lu?.trames).toEqual([{ t_ms: 1000, bpm: 120, rr: [] }]);
  });

  it("dernière ligne coupée : le reste est rangé", () => {
    const lu = lire(["D,1000,u1,-,-", "B,2000,130,1,800"], "\nB,30");
    expect(lu?.trames).toHaveLength(1);
  });

  it("dernière ligne complète mais illisible : ignorée", () => {
    expect(
      lire(["D,1000,u1,-,-", "B,2000,130,1,800", "B,3000,zz,1,"])?.trames,
    ).toHaveLength(1);
  });

  it("fragment final sans \\n ignoré même lisible", () => {
    const lu = lire(["D,1000,u1,-,-", "B,2000,130,1,800"], "\nS,9000");
    expect(lu?.session.durationS).toBe(1);
  });

  it("ligne illisible au milieu : null", () => {
    expect(lire(["D,1000,u1,-,-", "B,2,x", "B,3000,130,1,800"])).toBeNull();
  });

  it("première ligne qui n'est pas D : null", () => {
    expect(lire(["B,2000,130,1,800", "D,1000,u1,-,-"])).toBeNull();
  });

  it("première ligne D illisible : null", () => {
    expect(lire(["D,1000"])).toBeNull();
    expect(lire(["D,x,u1,-,-", "S,2000"])).toBeNull();
  });

  it("texte vide : null", () => {
    expect(lireJournal("", NOW)).toBeNull();
    expect(lireJournal("D,1000,u1,-,-", NOW)).toBeNull();
  });

  it("trames à 0 bpm gardées, hors moyenne", () => {
    const lu = lire(["D,0,u1,-,-", "B,1000,0,0,", "B,2000,100,1,", "S,3000"]);
    expect(lu?.trames).toHaveLength(2);
    expect(lu?.session.avgHrBpm).toBe(100);
  });

  it("aucune trame : avgHrBpm absent", () => {
    const lu = lire(["D,0,u1,-,-", "S,5000"]);
    expect(lu?.session).not.toHaveProperty("avgHrBpm");
  });

  it("D puis S à la même ms : durationS 1", () => {
    expect(lire(["D,1000,u1,-,-", "S,1000"])?.session.durationS).toBe(1);
  });

  it("rr à 0 au milieu : null, en dernière ligne : ignoré", () => {
    expect(
      lire(["D,0,u1,-,-", "B,1000,120,1,0", "B,2000,120,1,800"]),
    ).toBeNull();
    expect(
      lire(["D,0,u1,-,-", "B,2000,120,1,800", "B,3000,120,1,0"])?.trames,
    ).toHaveLength(1);
  });

  it("ligne antérieure au D (t_ms négatif) : mauvaise ligne", () => {
    expect(
      lire(["D,5000,u1,-,-", "B,1000,120,1,800", "B,6000,120,1,800"]),
    ).toBeNull();
    expect(
      lire(["D,5000,u1,-,-", "B,6000,120,1,800", "B,1000,120,1,800"])?.trames,
    ).toHaveLength(1);
  });

  it("un second D est une mauvaise ligne", () => {
    expect(lire(["D,0,u1,-,-", "D,500,u2,-,-", "B,1000,120,1,800"])).toBeNull();
    expect(
      lire(["D,0,u1,-,-", "B,1000,120,1,800", "D,2000,u2,-,-"])?.session.id,
    ).toBe("u1");
  });

  it("bpm hors 0-255 : ligne illisible", () => {
    expect(lire(["D,0,u1,-,-", "B,1000,300,1,", "S,2000"])).toBeNull();
  });
});

describe("trameSchema", () => {
  it("borne bpm et rr", () => {
    expect(trameSchema.safeParse({ t_ms: 0, bpm: 255, rr: [1] }).success).toBe(
      true,
    );
    expect(trameSchema.safeParse({ t_ms: 0, bpm: 256, rr: [] }).success).toBe(
      false,
    );
    expect(trameSchema.safeParse({ t_ms: 0, bpm: 80, rr: [0] }).success).toBe(
      false,
    );
  });
});

describe("minutesManquantes", () => {
  const chaqueSeconde = Array.from({ length: 60 }, (_, i) => ({
    t_ms: (i + 1) * 1000,
    bpm: 120,
    rr: [],
  }));
  it("trames chaque seconde : 0", () => {
    expect(minutesManquantes(chaqueSeconde, 60)).toBe(0);
  });
  it("trou de 150 s : 2", () => {
    expect(
      minutesManquantes(
        [
          { t_ms: 1000, bpm: 1, rr: [] },
          { t_ms: 151_000, bpm: 1, rr: [] },
        ],
        152,
      ),
    ).toBe(2);
  });
  it("aucune trame sur 600 s : 10", () => {
    expect(minutesManquantes([], 600)).toBe(10);
  });
});
