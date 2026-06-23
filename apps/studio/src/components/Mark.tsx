/**
 * The KawnGraph mark: a central ringed project planet linked by graph edges to
 * three orbiting planets — code (blue), docs (amber), data (green) — crossed by
 * two restrained orbital paths. Pure geometry, flat fills (no gradients), no
 * raster, no font dependency — so it stays crisp at any header size.
 * Mirrors brand/mark.svg; keep the two in sync.
 */
import { type ReactNode } from "react";

export function Mark({
  size = 20,
  className,
  title = "KawnGraph",
}: {
  size?: number;
  className?: string;
  title?: string;
}): ReactNode {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      focusable="false"
    >
      {/* two restrained orbital paths */}
      <g fill="none" stroke="#4C8DFF" strokeWidth="1.2" opacity="0.34">
        <ellipse cx="32" cy="32" rx="23" ry="9" transform="rotate(-20 32 32)" />
        <ellipse cx="32" cy="32" rx="10" ry="23" transform="rotate(15 32 32)" />
      </g>
      {/* subtle graph connections: centre to each planet */}
      <g stroke="#22C7A9" strokeWidth="1.3" opacity="0.55" strokeLinecap="round">
        <line x1="32" y1="32" x2="42" y2="14" />
        <line x1="32" y1="32" x2="43" y2="50" />
        <line x1="32" y1="32" x2="11" y2="32" />
      </g>
      {/* orbiting planets: code / docs / data */}
      <circle cx="42" cy="14" r="4.2" fill="#4C8DFF" />
      <circle cx="43" cy="50" r="4" fill="#F6C85F" />
      <circle cx="11" cy="32" r="4.6" fill="#42D392" />
      {/* central project planet + ring */}
      <circle cx="32" cy="32" r="8.5" fill="#22C7A9" />
      <ellipse cx="32" cy="32" rx="15" ry="5" fill="none" stroke="#A9B6C5" strokeWidth="2" transform="rotate(-22 32 32)" />
    </svg>
  );
}
