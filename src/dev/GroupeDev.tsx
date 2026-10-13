import { Button } from 'react-aria-components'
import { db } from '../db/db'
import { importerSeances } from '../db/sauvegarde'
import { jeuDeTest } from './jeu'

/**
 * Le groupe « Dev » des Réglages — sur l'app dev seulement (sujet 9, révisé le
 * 2026-10-11). `Reglages.tsx` ne l'affiche que si `VITE_DEV` est vrai : au
 * build de prod, la condition est fausse et ce module est retiré du paquet. La
 * CI fait échouer le build si un de ses textes y reste.
 *
 * Aucun toast : la ligne « Exporter » montre le compte des séances, la ligne
 * « Zone 2 » sa plage — le résultat se voit déjà.
 */
export default function GroupeDev() {
  return (
    <>
      <span className="t-titre reglages__groupe">Dev</span>
      <ul className="hist">
        <li>
          {/* Fusion par identifiant : charger deux fois n'ajoute rien. */}
          <Button className="hist__item reglages__ligne" onPress={() => importerSeances(jeuDeTest())}>
            <div>
              <div className="t-intitule reglages__intitule">Charger le jeu de test</div>
              <div className="reglages__etat t-precision">36 séances inventées</div>
            </div>
            <span className="t-valeur reglages__vide">Charger</span>
          </Button>
        </li>
        <li>
          {/* Effacement physique, sans confirmation : exemption du sujet 9,
              sur la dev seulement, où rien n'est réel. */}
          <Button className="hist__item reglages__ligne" onPress={vider}>
            <div>
              <div className="t-intitule reglages__intitule">Vider la base</div>
              <div className="reglages__etat t-precision">Séances et zone, sans retour</div>
            </div>
            <span className="t-valeur reglages__vide">Vider</span>
          </Button>
        </li>
      </ul>
    </>
  )
}

function vider() {
  return db.transaction('rw', db.sessions, db.zoneConfigs, () =>
    Promise.all([db.sessions.clear(), db.zoneConfigs.clear()]),
  )
}
