/** Logo Bouck : un « b » dont la hampe est un marque-page */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="100" height="100" rx="24" fill="#6b9080" />
      <circle cx="57" cy="57" r="17.5" fill="none" stroke="#ffffff" strokeWidth="12" />
      <path
        d="M28 18 a4 4 0 0 1 4 -4 h7 a4 4 0 0 1 4 4 V88 L35.5 81.5 L28 88 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** Icône + nom, pour la barre de navigation */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-xl font-semibold tracking-tight">Bouck</span>
    </span>
  );
}
