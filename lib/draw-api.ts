import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Typed wrappers over the draw/admin_* RPC surface (One Stroke). Shapes
// mirror src/models/draw.go's Admin* structs field for field — the backend
// is the source of truth; this file only names it for TypeScript.

export type DrawPoint = [number, number];

export interface DrawEdge {
  a: number;
  b: number;
  type: 'line' | 'cubic';
  c1?: DrawPoint;
  c2?: DrawPoint;
}

export interface DrawGraph {
  vertices: DrawPoint[];
  edges: DrawEdge[];
  startVertices: number[];
  startHint: number;
  closed: boolean;
  width: number;
  height: number;
  strokeWidth: number;
}

export interface DrawCompileReport {
  vertices: number;
  edges: number;
  oddCount: number;
  oddVertices: number[];
  crossings: number;
  curves: number;
  branching: number;
  connected: boolean;
  singleStroke: boolean;
  startHint: number;
  startVertices: number[];
  trail: number[];
  difficulty: number;
  score: number;
  shortestEdge: number;
  minAngleDeg: number;
  errors: string[];
  warnings: string[];
}

export interface DrawChapter {
  chapterId: string;
  slug: string;
  name: string;
  description: string;
  material: string;
  sortOrder: number;
  isActive: boolean;
  levelCount: number;
}

export interface DrawPuzzle {
  puzzleId: string;
  slug: string;
  name: string;
  vertexCount: number;
  edgeCount: number;
  oddCount: number;
  crossingCount: number;
  curveCount: number;
  difficulty: number;
  dailyEligible: boolean;
  duelEligible: boolean;
  splitCrossings: boolean;
  compilerVersion: number;
  isActive: boolean;
  hasReveal: boolean;
  hasDots: boolean;
  chapterId?: string;
  chapterSlug?: string;
  level?: number;
  graph: DrawGraph;
}

export interface DrawLevel {
  level: number;
  puzzleId: string;
  slug: string;
  name: string;
  difficulty: number;
  edgeCount: number;
  oddCount: number;
  showOpenEnds: boolean;
  isActive: boolean;
  puzzleActive: boolean;
  graph: DrawGraph;
}

export interface CompileResult {
  graph: DrawGraph;
  report: DrawCompileReport;
  hasReveal: boolean;
  hasDots: boolean;
  revealSvg?: string;
  dotsSvg?: string;
}

export interface IngestResult {
  puzzle: DrawPuzzle;
  report: DrawCompileReport;
  level?: number;
}

export interface DailyEntry {
  playDate: string;
  puzzleId: string;
  name: string;
  slug: string;
}

export const DRAW_MATERIALS = ['paper', 'grid', 'ledger', 'parchment', 'terracotta', 'slate'] as const;
export type DrawMaterial = (typeof DRAW_MATERIALS)[number];

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export async function adminListChapters(): Promise<DrawChapter[]> {
  const raw = await callAdminRpc('draw/admin_list_chapters');
  return unwrapAdminRpcData<{ chapters: DrawChapter[] }>(raw).chapters ?? [];
}

export interface UpsertChapterInput {
  chapterId?: string;
  slug: string;
  name: string;
  description: string;
  material: string;
  sortOrder: number;
}

export async function adminUpsertChapter(input: UpsertChapterInput): Promise<DrawChapter> {
  const raw = await callAdminRpc('draw/admin_upsert_chapter', JSON.stringify(input));
  return unwrapAdminRpcData<DrawChapter>(raw);
}

export async function adminSetChapterActive(chapterId: string, active: boolean): Promise<void> {
  await callAdminRpc('draw/admin_set_chapter_active', JSON.stringify({ chapterId, active }));
}

export async function adminDeleteChapter(chapterId: string): Promise<void> {
  await callAdminRpc('draw/admin_delete_chapter', JSON.stringify({ chapterId }));
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export async function adminListLevels(chapterId: string): Promise<DrawLevel[]> {
  const raw = await callAdminRpc('draw/admin_list_levels', JSON.stringify({ chapterId }));
  return unwrapAdminRpcData<{ levels: DrawLevel[] }>(raw).levels ?? [];
}

export async function adminSetLevel(input: {
  chapterId: string;
  level: number;
  puzzleId: string;
  showOpenEnds: boolean;
}): Promise<number> {
  const raw = await callAdminRpc('draw/admin_set_level', JSON.stringify(input));
  return unwrapAdminRpcData<{ level: number }>(raw).level;
}

export async function adminRemoveLevel(chapterId: string, level: number): Promise<void> {
  await callAdminRpc('draw/admin_remove_level', JSON.stringify({ chapterId, level }));
}

export async function adminReorderLevels(chapterId: string, puzzleIds: string[]): Promise<void> {
  await callAdminRpc('draw/admin_reorder_levels', JSON.stringify({ chapterId, puzzleIds }));
}

// ---------------------------------------------------------------------------
// Puzzles — compile, ingest, library
// ---------------------------------------------------------------------------

/** Dry run: compile and report, store nothing. */
export async function adminCompile(svg: string, splitCrossings: boolean): Promise<CompileResult> {
  const raw = await callAdminRpc('draw/admin_compile', JSON.stringify({ svg, splitCrossings }));
  return unwrapAdminRpcData<CompileResult>(raw);
}

export interface IngestInput {
  chapterId?: string;
  slug: string;
  name: string;
  svg: string;
  splitCrossings: boolean;
  difficulty?: number;
  showOpenEnds: boolean;
  dailyEligible: boolean;
  duelEligible: boolean;
}

/** Compile, store, and (with chapterId) append to the chapter's ladder. */
export async function adminIngestPuzzle(input: IngestInput): Promise<IngestResult> {
  const raw = await callAdminRpc('draw/admin_ingest_puzzle', JSON.stringify(input));
  return unwrapAdminRpcData<IngestResult>(raw);
}

export async function adminRecompilePuzzle(puzzleId: string): Promise<IngestResult> {
  const raw = await callAdminRpc('draw/admin_recompile_puzzle', JSON.stringify({ puzzleId }));
  return unwrapAdminRpcData<IngestResult>(raw);
}

export async function adminListPuzzles(includeInactive = true, pool?: 'daily' | 'duel'): Promise<DrawPuzzle[]> {
  const raw = await callAdminRpc('draw/admin_list_puzzles', JSON.stringify({ includeInactive, pool }));
  return unwrapAdminRpcData<{ puzzles: DrawPuzzle[] }>(raw).puzzles ?? [];
}

export async function adminUpdatePuzzle(input: {
  puzzleId: string;
  name: string;
  difficulty: number;
  dailyEligible: boolean;
  duelEligible: boolean;
}): Promise<void> {
  await callAdminRpc('draw/admin_update_puzzle', JSON.stringify(input));
}

export async function adminSetPuzzleActive(puzzleId: string, active: boolean): Promise<void> {
  await callAdminRpc('draw/admin_set_puzzle_active', JSON.stringify({ puzzleId, active }));
}

export async function adminDeletePuzzle(puzzleId: string): Promise<{ deleted: boolean; deactivated: boolean }> {
  const raw = await callAdminRpc('draw/admin_delete_puzzle', JSON.stringify({ puzzleId }));
  return unwrapAdminRpcData<{ deleted: boolean; deactivated: boolean }>(raw);
}

// ---------------------------------------------------------------------------
// Daily schedule
// ---------------------------------------------------------------------------

export async function adminListDaily(fromDate?: string, limit = 30): Promise<DailyEntry[]> {
  const raw = await callAdminRpc('draw/admin_list_daily', JSON.stringify({ fromDate, limit }));
  return unwrapAdminRpcData<{ entries: DailyEntry[] }>(raw).entries ?? [];
}

export async function adminSetDaily(playDate: string, puzzleId: string): Promise<void> {
  await callAdminRpc('draw/admin_set_daily', JSON.stringify({ playDate, puzzleId }));
}

export async function adminClearDaily(playDate: string): Promise<void> {
  await callAdminRpc('draw/admin_clear_daily', JSON.stringify({ playDate }));
}

// ---------------------------------------------------------------------------
// Rendering helpers shared by the page's previews
// ---------------------------------------------------------------------------

/** The SVG path data for one edge, in the graph's own 0..1 frame. */
export function edgePath(g: DrawGraph, e: DrawEdge): string {
  const [ax, ay] = g.vertices[e.a];
  const [bx, by] = g.vertices[e.b];
  if (e.type === 'cubic' && e.c1 && e.c2) {
    return `M${ax},${ay} C${e.c1[0]},${e.c1[1]} ${e.c2[0]},${e.c2[1]} ${bx},${by}`;
  }
  return `M${ax},${ay} L${bx},${by}`;
}

/**
 * One continuous path following a trail in order. Each edge is emitted in
 * the direction the stroke travels it, so a dash animation traces the
 * route the way a finger would.
 */
export function trailPath(g: DrawGraph, trail: number[]): string {
  if (trail.length === 0) return '';
  const first = g.edges[trail[0]];
  let at = first.a;
  if (trail.length > 1) {
    const second = g.edges[trail[1]];
    if (first.a === second.a || first.a === second.b) at = first.b;
  }
  const [sx, sy] = g.vertices[at];
  let d = `M${sx},${sy}`;
  for (const ei of trail) {
    const e = g.edges[ei];
    const forward = e.a === at;
    const to = forward ? e.b : e.a;
    const [tx, ty] = g.vertices[to];
    if (e.type === 'cubic' && e.c1 && e.c2) {
      const c1 = forward ? e.c1 : e.c2;
      const c2 = forward ? e.c2 : e.c1;
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${tx},${ty}`;
    } else {
      d += ` L${tx},${ty}`;
    }
    at = to;
  }
  return d;
}
