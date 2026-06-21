/**
 * The KawnGraph mark: a geometric "K" of five orbital nodes around a central
 * anchor, with the upper diagonal drawn as the amber "evidence path". Pure
 * geometry — no raster, no font dependency — so it stays crisp at header sizes.
 * Mirrors brand/logo/kawngraph-mark.svg; keep the two in sync.
 */
import { useId, type ReactNode } from "react";

export function Mark({
  size = 20,
  className,
  title = "KawnGraph",
}: {
  size?: number;
  className?: string;
  title?: string;
}): ReactNode {
  // Unique per instance so multiple marks on a page never share gradient ids.
  const uid = useId();
  const edge = `kg-edge-${uid}`;
  const anchor = `kg-anchor-${uid}`;
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
      <defs>
        <linearGradient id={edge} x1="16" y1="16" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22C7A9" />
          <stop offset="1" stopColor="#4C8DFF" />
        </linearGradient>
        <radialGradient id={anchor} cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#3BE7C4" />
          <stop offset="1" stopColor="#22C7A9" />
        </radialGradient>
      </defs>
      <g fill="none" stroke={`url(#${edge})`} strokeWidth="4" strokeLinecap="round">
        <line x1="20" y1="14" x2="20" y2="50" />
        <line x1="20" y1="32" x2="46" y2="50" />
      </g>
      {/* evidence path */}
      <line x1="20" y1="32" x2="46" y2="14" fill="none" stroke="#F6C85F" strokeWidth="4" strokeLinecap="round" />
      <circle cx="20" cy="14" r="4.5" fill="#4C8DFF" />
      <circle cx="20" cy="50" r="4.5" fill="#22C7A9" />
      <circle cx="46" cy="50" r="4.5" fill="#4C8DFF" />
      <circle cx="46" cy="14" r="4.5" fill="#F6C85F" />
      <circle cx="20" cy="32" r="6.5" fill={`url(#${anchor})`} />
    </svg>
  );
}
