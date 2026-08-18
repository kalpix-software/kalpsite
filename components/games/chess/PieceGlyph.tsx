'use client';

import type { ChessSide } from '@/lib/kalpix-web-sdk/chess';

/**
 * Built-in chess pieces, drawn as inline SVG.
 *
 * This is the floor every board falls back to when a side has no equipped set —
 * which is every bot, and every player who has not bought one. It therefore has
 * to work with no uploads, in every environment, forever. The previous fallback
 * was a hardcoded "classic" sprite folder that existed in no bucket, so those
 * pieces simply did not render.
 *
 * SVG rather than the Unicode chess glyphs (U+2654–265F) for two reasons:
 * the glyphs depend on a symbol font the device may not ship, and the block
 * defines white pieces as OUTLINES and black as SOLID, so a white king reads as
 * a hollow scribble on a busy board. Here both sides are the same solid
 * silhouette, separated by fill and stroke, which is what makes a real set
 * legible at thumbnail size.
 *
 * Drawn in-house rather than adapted from a known set: cburnett (lichess,
 * Wikipedia) and most other recognisable sets are GPL or CC-BY-SA, which carry
 * attribution and share-alike obligations that do not belong on a commercial
 * product's default art.
 *
 * Geometry is authored in a 45×45 box — the same convention the common sets
 * use — so a future drop-in replacement needs no rescaling.
 */

const PATHS: Record<string, string> = {
  // Pawn: head, collar, flared base.
  P: 'M22.5 10.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM17 20h11l-1.5 4h-8L17 20zm-2.5 5h16l2 9h-20l2-9z',

  // Rook: crenellated top, waist, base.
  R: 'M11 12h4v3h4v-3h5v3h4v-3h4v7l-2.5 3h-16L11 19v-7zm3.5 13h16l1 9h-18l1-9zm-3 10h22v4h-22v-4z',

  // Knight: stylised horse head facing left, on a base.
  N: 'M13 34c0-6 2-9 5-11.5 1-1 1.5-2 1.2-3.4-1 1-2.2 1.6-3.2 1.4-.6-1.6 0-3.2 1.2-4.5C19 14 21.5 12 24 11.2c1-2 .8-3 .3-4.2 2.6.6 4.6 2.4 5.8 4.8 1.3 2.6 1.6 5.7 1.4 9-.2 3.6-1.2 7.2-2.4 13.2H13z',

  // Bishop: mitre, collar, base. The diagonal slit across the mitre is the
  // feature that separates a bishop from a pawn at thumbnail size, so it is cut
  // out of the body rather than drawn over it — a stroked line on top would
  // vanish on the dark piece, where stroke and fill are nearly the same tone.
  B: 'M22.5 7c1.6 2 3.2 3.6 4.4 5.4 1.3 2 2 4 2 6 0 3.4-2.8 6.1-6.4 6.1s-6.4-2.7-6.4-6.1c0-2 .7-4 2-6C19.3 10.6 20.9 9 22.5 7zm-6 20h12l1.5 7h-15l1.5-7z M20.2 12.6l5.6 5.6-1.4 1.4-5.6-5.6z',

  // Queen: crown of five points over a flared body.
  Q: 'M9 14l3.5 8L15 13l3.5 9L22.5 12l4 10L30 13l2.5 9L36 14l-3 15h-21L9 14zm3.5 17h20l1.5 6h-23l1.5-6z',

  // King: cross finial over a domed body.
  K: 'M21 6h3v3h3v3h-3v4h-3v-4h-3V9h3V6zm1.5 12c5 0 9 3.4 9 7.8 0 3.4-2.4 5.6-4.6 7.2H18.1c-2.2-1.6-4.6-3.8-4.6-7.2 0-4.4 4-7.8 9-7.8zm-9 15h18l1 4h-20l1-4z',
};

/** FEN letter (case = side) → the glyph for that piece. */
export default function PieceGlyph({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const side: ChessSide = code === code.toUpperCase() ? 'white' : 'black';
  const path = PATHS[code.toUpperCase()];
  if (!path) return null;

  // The stroke is what keeps a white piece visible on a light square and a
  // black one on a dark square, so it is the opposite tone to the fill rather
  // than a fixed outline colour.
  const fill = side === 'white' ? '#f8fafc' : '#1e293b';
  const stroke = side === 'white' ? '#1e293b' : '#0f172a';

  return (
    <svg
      viewBox="0 0 45 45"
      className={className}
      width="100%"
      height="100%"
      // display:block so the svg fills its parent's content box instead of
      // sitting on a text baseline, which leaves a gap under every piece.
      style={{ display: 'block' }}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={path}
        fill={fill}
        // evenodd, not the default nonzero: the bishop's slit is a subpath
        // drawn INSIDE the mitre, and under nonzero it fills solid instead of
        // cutting through — turning the bishop back into a featureless
        // teardrop. Harmless for the other five, whose subpaths never overlap.
        fillRule="evenodd"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
