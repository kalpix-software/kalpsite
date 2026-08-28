/**
 * Jigsaw shape profiles — the admin half of the contract.
 *
 * A shape is ONE tab curve along a unit edge, stored as an SVG path subset
 * (M/L/C) with the bump drawn upward (negative y). The Flutter client composes
 * every piece from four replays of it and falls back to the classic knob on any
 * parse failure — so the uploader's job is to hand it something that parses,
 * and this module is where arbitrary designer drawings become that.
 *
 * normalizeProfile() is deliberately forgiving where the client parser is
 * deliberately strict: the admin draws at any size, position or slant, and the
 * affine normalisation here maps their curve onto the unit edge. What gets
 * SAVED is already normalised, which is why the client can afford to refuse
 * anything else.
 */

export type ProfileSegment =
  | { kind: 'L'; x: number; y: number }
  | { kind: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

export interface NormalizedProfile {
  /** The canonical string to store in metadata.profile. */
  path: string;
  /** Segments in unit-edge SVG space (y negative = bump outward). */
  segments: ProfileSegment[];
  /** Human-readable adjustments made while normalising ("scaled to fit…"). */
  notices: string[];
}

type Point = { x: number; y: number };

/**
 * Mirrors plak's PuzzleConfiguration.tabRatio: the tab margin is 26% of the
 * shortest cell side, and the STORED profile's y unit is one tab. Dividing the
 * drawing's proportions by it is what makes authoring WYSIWYG — a bump drawn
 * 26% as tall as the edge is long stores as y = 1 and renders at exactly one
 * tab, i.e. exactly the proportion that was drawn. Without this, drawings
 * rendered ~4x flatter than they looked in the design tool.
 */
const TAB_RATIO = 0.26;

/** Commands as strings, numbers as numbers; null on an illegal character. */
function tokenize(source: string): (string | number)[] | null {
  const out: (string | number)[] = [];
  const number = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;
  let rest = source.trim();
  while (rest.length > 0) {
    const ch = rest[0];
    if (ch === ',' || /\s/.test(ch)) {
      rest = rest.slice(1);
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      out.push(ch);
      rest = rest.slice(1);
      continue;
    }
    const m = number.exec(rest);
    if (!m) return null;
    out.push(parseFloat(m[0]));
    rest = rest.slice(m[0].length);
  }
  return out;
}

/**
 * Parses M/L/C (absolute and relative, implicit line-tos) into absolute
 * segments, or an error naming what was refused. No normalisation yet.
 */
function parseRaw(source: string): { start: Point; segments: ProfileSegment[] } | { error: string } {
  const tokens = tokenize(source);
  if (!tokens || tokens.length === 0) return { error: 'Not an SVG path.' };

  let index = 0;
  let current: Point = { x: 0, y: 0 };
  let start: Point | null = null;
  const segments: ProfileSegment[] = [];

  const number = (): number | null => {
    const t = tokens[index];
    if (typeof t !== 'number') return null;
    index++;
    return t;
  };
  const pair = (relative: boolean): Point | null => {
    const x = number();
    const y = number();
    if (x === null || y === null) return null;
    return relative ? { x: current.x + x, y: current.y + y } : { x, y };
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (typeof token !== 'string') return { error: 'A number where a command belongs.' };
    const relative = token === token.toLowerCase();
    const command = token.toLowerCase();
    index++;

    if (command === 'm') {
      if (start) return { error: 'Two subpaths — a profile is one curve.' };
      const p = pair(relative);
      if (!p) return { error: 'Malformed move-to.' };
      start = p;
      current = p;
      while (typeof tokens[index] === 'number') {
        const q = pair(relative);
        if (!q) return { error: 'Malformed coordinates after move-to.' };
        segments.push({ kind: 'L', ...q });
        current = q;
      }
    } else if (command === 'l') {
      if (!start) return { error: 'The path must begin with a move-to.' };
      do {
        const p = pair(relative);
        if (!p) return { error: 'Malformed line-to.' };
        segments.push({ kind: 'L', ...p });
        current = p;
      } while (typeof tokens[index] === 'number');
    } else if (command === 'c') {
      if (!start) return { error: 'The path must begin with a move-to.' };
      do {
        const c1 = pair(relative);
        const c2 = pair(relative);
        const p = pair(relative);
        if (!c1 || !c2 || !p) return { error: 'Malformed curve-to.' };
        segments.push({ kind: 'C', x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: p.x, y: p.y });
        current = p;
      } while (typeof tokens[index] === 'number');
    } else if (command === 'z') {
      return { error: 'Close (Z) is not allowed — a profile is an open curve.' };
    } else {
      return { error: `Command "${token}" is outside the contract — only M, L and C.` };
    }
  }

  if (!start) return { error: 'Empty path.' };
  if (segments.length === 0) return { error: 'The path never draws anything.' };
  return { start, segments };
}

/** y of a cubic at t, for the extent sampling. */
function cubicAt(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/**
 * Normalises an arbitrary drawing onto the unit edge: translate the start to
 * the origin, rotate the end onto the x-axis, scale to unit length, and shrink
 * the bump (with a notice) if it overflows the tab margin. The admin never
 * thinks in unit coordinates — this is where their Figma export becomes the
 * wire format.
 */
export function normalizeProfile(source: string): NormalizedProfile | { error: string } {
  // A whole SVG export (Illustrator's File > Export, Figma's Copy as SVG)
  // pastes as markup; the curve is its first path's d attribute.
  let pathData = source;
  if (source.includes('<')) {
    const d = /\bd\s*=\s*"([^"]+)"|\bd\s*=\s*'([^']+)'/.exec(source);
    if (!d) return { error: 'SVG markup with no <path d="…"> in it.' };
    pathData = d[1] ?? d[2];
  }
  const raw = parseRaw(pathData);
  if ('error' in raw) return raw;

  const { start, segments } = raw;
  const last = segments[segments.length - 1];
  const end: Point = { x: last.x, y: last.y };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return { error: 'The curve ends where it starts — it has no edge to sit on.' };

  // Affine map: start -> (0,0), end -> (1,0), everything else along for the ride.
  const cos = dx / length;
  const sin = dy / length;
  const map = (p: Point): Point => {
    const tx = p.x - start.x;
    const ty = p.y - start.y;
    return { x: (tx * cos + ty * sin) / length, y: (-tx * sin + ty * cos) / length };
  };
  // x lands in edge units; y is then converted from edge units into TAB units
  // so drawn proportions survive to the screen — see TAB_RATIO.
  const toTabs = (p: Point): Point => ({ x: p.x, y: p.y / TAB_RATIO });
  const mapped: ProfileSegment[] = segments.map((s) =>
    s.kind === 'L'
      ? { kind: 'L', ...toTabs(map({ x: s.x, y: s.y })) }
      : {
          kind: 'C',
          x1: toTabs(map({ x: s.x1, y: s.y1 })).x,
          y1: toTabs(map({ x: s.x1, y: s.y1 })).y,
          x2: toTabs(map({ x: s.x2, y: s.y2 })).x,
          y2: toTabs(map({ x: s.x2, y: s.y2 })).y,
          ...toTabs(map({ x: s.x, y: s.y })),
        },
  );

  const notices: string[] = [];

  // On-curve outward extent, sampled. Controls may exceed it.
  let extent = 0;
  let prev: Point = { x: 0, y: 0 };
  for (const s of mapped) {
    if (s.kind === 'L') {
      extent = Math.max(extent, Math.abs(s.y));
      prev = { x: s.x, y: s.y };
    } else {
      for (let i = 0; i <= 16; i++) {
        extent = Math.max(extent, Math.abs(cubicAt(prev.y, s.y1, s.y2, s.y, i / 16)));
      }
      prev = { x: s.x, y: s.y };
    }
  }
  if (extent > 1) {
    const k = 1 / extent;
    for (const s of mapped) {
      s.y *= k;
      if (s.kind === 'C') {
        s.y1 *= k;
        s.y2 *= k;
      }
    }
    notices.push(
      `Drawn ${(extent * TAB_RATIO * 100).toFixed(0)}% as tall as the edge — the tab margin allows ${(TAB_RATIO * 100).toFixed(0)}%, so it was scaled down to fit rather than be clipped on every piece.`,
    );
  }
  if (extent < 0.05) {
    notices.push('Nearly flat — this will cut close to the square shape.');
  }

  const n = (v: number) => {
    const r = Math.round(v * 10000) / 10000;
    return Object.is(r, -0) ? '0' : String(r);
  };
  const parts = ['M 0 0'];
  for (const s of mapped) {
    parts.push(
      s.kind === 'L'
        ? `L ${n(s.x)} ${n(s.y)}`
        : `C ${n(s.x1)} ${n(s.y1)} ${n(s.x2)} ${n(s.y2)} ${n(s.x)} ${n(s.y)}`,
    );
  }
  return { path: parts.join(' '), segments: mapped, notices };
}

/** The profile traversed the other way — what the blank side of a boundary replays. */
function mirrored(segments: ProfileSegment[]): ProfileSegment[] {
  const starts: Point[] = [{ x: 0, y: 0 }];
  for (const s of segments) starts.push({ x: s.x, y: s.y });
  const flip = (p: Point): Point => ({ x: 1 - p.x, y: p.y });
  const out: ProfileSegment[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    const target = flip(starts[i]);
    const s = segments[i];
    out.push(
      s.kind === 'L'
        ? { kind: 'L', ...target }
        : {
            kind: 'C',
            x1: 1 - s.x2,
            y1: s.y2,
            x2: 1 - s.x1,
            y2: s.y1,
            ...target,
          },
    );
  }
  return out;
}

export type EdgeKind = 'flat' | 'tab' | 'blank';

/**
 * One piece outline as a Path2D, replaying the profile exactly the way the
 * Flutter builder does — same normal convention, same mirror rule for blanks —
 * so what the preview shows is what the game cuts.
 *
 * Stored y is SVG-down (bump negative); "out of the piece" for the canvas is
 * therefore -y along the outward normal, matching the client's flip.
 */
export function buildPiecePath(
  cell: { w: number; h: number },
  tab: number,
  edges: { top: EdgeKind; right: EdgeKind; bottom: EdgeKind; left: EdgeKind },
  profile: ProfileSegment[],
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Path2D {
  const left = origin.x + tab;
  const top = origin.y + tab;
  const right = left + cell.w;
  const bottom = top + cell.h;
  const corners = {
    tl: { x: left, y: top },
    tr: { x: right, y: top },
    br: { x: right, y: bottom },
    bl: { x: left, y: bottom },
  };

  const path = new Path2D();
  path.moveTo(corners.tl.x, corners.tl.y);
  const mirror = mirrored(profile);

  const addEdge = (start: Point, end: Point, kind: EdgeKind) => {
    if (kind === 'flat' || profile.length === 0) {
      path.lineTo(end.x, end.y);
      return;
    }
    const ax = end.x - start.x;
    const ay = end.y - start.y;
    const len = Math.hypot(ax, ay);
    const dirX = ax / len;
    const dirY = ay / len;
    const sign = kind === 'tab' ? 1 : -1;
    // Clockwise traversal: this normal points out of the piece; stored y is
    // SVG-down so outward displacement is -y.
    const outX = dirY * sign;
    const outY = -dirX * sign;
    const point = (p: Point): Point => ({
      x: start.x + dirX * (p.x * len) + outX * (-p.y * tab),
      y: start.y + dirY * (p.x * len) + outY * (-p.y * tab),
    });
    const replay = kind === 'tab' ? profile : mirror;
    for (const s of replay) {
      if (s.kind === 'L') {
        const t = point({ x: s.x, y: s.y });
        path.lineTo(t.x, t.y);
      } else {
        const c1 = point({ x: s.x1, y: s.y1 });
        const c2 = point({ x: s.x2, y: s.y2 });
        const t = point({ x: s.x, y: s.y });
        path.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, t.x, t.y);
      }
    }
  };

  addEdge(corners.tl, corners.tr, edges.top);
  addEdge(corners.tr, corners.br, edges.right);
  addEdge(corners.br, corners.bl, edges.bottom);
  addEdge(corners.bl, corners.tl, edges.left);
  path.closePath();
  return path;
}
