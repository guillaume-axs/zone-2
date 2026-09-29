/**
 * La marque de l'application : un tracé d'ECG.
 *
 * Elle vit ici et nulle part ailleurs. Le dessin était recopié dans le
 * formulaire de séance ; il apparaît maintenant sur plusieurs écrans, et quatre
 * copies d'un même tracé finissent toujours par diverger. Sa forme est dans
 * `base.css`, classe `.marque`.
 *
 * `aria-hidden` : c'est une décoration, elle ne dit rien qu'un titre voisin ne
 * dise déjà.
 */
export default function Marque() {
  return (
    <svg className="marque" viewBox="0 0 30 11" aria-hidden="true">
      <path d="M0,5.5 L7,5.5 L9.5,1.5 L13,9.5 L16,5.5 L30,5.5" />
    </svg>
  )
}
