/**
 * Indicateur de chargement (spinner). Apparaît après 350 ms seulement (voir globals.css).
 * Le nom du composant est conservé pour ne pas toucher aux pages qui l'utilisent.
 */
export default function BookLoader({
  label = "Chargement…",
  scale = 1,
  className = "",
}: {
  label?: string | null;
  /** 1 = 40 px */
  scale?: number;
  className?: string;
}) {
  const size = 40 * scale;
  return (
    <div role="status" aria-live="polite" className={`book-loader-wrap ${className}`}>
      <span
        className="book-loader"
        aria-hidden
        style={{ width: size, height: size, borderWidth: Math.max(3, size / 10) }}
      />
      {label ? <p className="text-sm">{label}</p> : <span className="sr-only">Chargement…</span>}
    </div>
  );
}
