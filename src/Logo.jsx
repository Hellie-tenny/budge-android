// The Sprout mark: two leaves growing from a coin. It takes its colours from the theme (light or dark), so it
// always has contrast on the page behind it. The app icon files in branding/ use the white-on-navy version.
export default function Logo({ size = 48, className = '' }) {
  return (
    <svg viewBox="26 22 68 83" height={size} width={(size * 68) / 83} className={className} aria-hidden="true">
      <path d="M30 84 v8 a30 9 0 0 0 60 0 v-8 z" style={{ fill: 'var(--color-navy)' }} />
      <ellipse cx="60" cy="84" rx="30" ry="9" style={{ fill: 'var(--color-azure)' }} />
      <path d="M60 84 V50" style={{ stroke: 'var(--color-navy)' }} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M60 64 C42 64 32 53 32 38 C49 38 60 47 60 64 Z" style={{ fill: 'var(--color-azure)' }} />
      <path d="M60 54 C60 36 72 26 90 26 C90 44 78 54 60 54 Z" style={{ fill: 'var(--color-up)' }} />
    </svg>
  )
}
