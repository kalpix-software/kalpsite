'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Layers,
  PenLine,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  CompileResult,
  DRAW_MATERIALS,
  DailyEntry,
  DrawChapter,
  DrawGraph,
  DrawLevel,
  DrawPuzzle,
  adminClearDaily,
  adminCompile,
  adminDeleteChapter,
  adminDeletePuzzle,
  adminIngestPuzzle,
  adminListChapters,
  adminListDaily,
  adminListLevels,
  adminListPuzzles,
  adminRecompilePuzzle,
  adminRemoveLevel,
  adminReorderLevels,
  adminSetChapterActive,
  adminSetDaily,
  adminSetLevel,
  adminUpdatePuzzle,
  adminUpsertChapter,
  edgePath,
  trailPath,
} from '@/lib/draw-api';

// One Stroke admin — chapters, the ladder inside each, the daily schedule,
// and the studio: Vectorpea embedded in the page, so an admin draws a
// figure, presses Compile, sees the backend's verdict, and adds it to the
// chapter without an SVG ever touching the filesystem.
//
// The bridge is the Photopea Live Messaging API, which vectorpea.com runs:
// post a script string into the iframe, receive the document back as an
// ArrayBuffer. The backend compiles; this page only draws what it is told.
//
// Layer convention the compiler reads (a group named, or containing):
//   outline  the puzzle (default for unnamed art)
//   reveal   colour shown on completion
//   start    one dot marking the intended start
//   dots     the dot grid under a kolam figure

const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm';
const btnCls = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
const btnPrimary = `${btnCls} bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50`;
const btnGhost = `${btnCls} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50`;
const btnDanger = `${btnCls} bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-800`;

const TEMPLATE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">' +
  '<g id="dots"></g><g id="reveal"></g>' +
  '<g id="outline"><path d="M300,700 L700,700 L700,400 L500,250 L300,400 L700,400 L300,700 L300,400 L700,700" ' +
  'fill="none" stroke="#1e2440" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></g>' +
  '<g id="start"><circle cx="300" cy="700" r="12" fill="#a33420"/></g></svg>';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
}

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function DrawAdminPage() {
  const [chapters, setChapters] = useState<DrawChapter[]>([]);
  const [selected, setSelected] = useState<DrawChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (keepSelection = true) => {
    setLoading(true);
    setError('');
    try {
      const list = await adminListChapters();
      setChapters(list);
      setSelected((prev) => {
        if (!keepSelection || !prev) return prev;
        return list.find((c) => c.chapterId === prev.chapterId) ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chapters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <PenLine className="w-6 h-6 text-emerald-400" /> One Stroke
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Chapters of one-line figures, the daily figure, and the studio. Draw in Vectorpea, press Compile, add to the ladder.
          </p>
        </div>
        <button className={btnGhost} onClick={() => void refresh()}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-200 text-sm">{error}</div>}
      {notice && (
        <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-800 text-emerald-200 text-sm">{notice}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <ChapterList
            chapters={chapters}
            loading={loading}
            selected={selected}
            onSelect={setSelected}
            onChanged={() => void refresh()}
            onError={setError}
          />
          <DailyScheduler onError={setError} onNotice={setNotice} />
        </div>
        <div className="xl:col-span-2 space-y-6">
          {selected ? (
            <ChapterDetail
              key={selected.chapterId}
              chapter={selected}
              onChanged={() => void refresh()}
              onError={setError}
              onNotice={setNotice}
            />
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm text-center">
              Select a chapter — or create one — to open the studio and its ladder.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

function ChapterList({
  chapters,
  loading,
  selected,
  onSelect,
  onChanged,
  onError,
}: {
  chapters: DrawChapter[];
  loading: boolean;
  selected: DrawChapter | null;
  onSelect: (c: DrawChapter) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<DrawChapter | 'new' | null>(null);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4" /> Chapters
        </h2>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" /> New chapter
        </button>
      </div>

      {editing && (
        <ChapterForm
          chapter={editing === 'new' ? null : editing}
          nextSort={chapters.length}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
          onCancel={() => setEditing(null)}
          onError={onError}
        />
      )}

      <div className="divide-y divide-slate-700/60">
        {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
        {!loading && chapters.length === 0 && <div className="p-4 text-sm text-slate-500">No chapters yet.</div>}
        {chapters.map((c, i) => (
          <div
            key={c.chapterId}
            className={`p-4 cursor-pointer hover:bg-slate-800/60 ${
              selected?.chapterId === c.chapterId ? 'bg-slate-800/80 border-l-2 border-emerald-500' : ''
            }`}
            onClick={() => onSelect(c)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-slate-100 font-medium truncate flex items-center gap-2">
                  <span className="text-slate-500 font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
                  {c.name || c.slug}
                  {!c.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">HIDDEN</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{c.material}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {c.slug} · {c.levelCount} levels
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                  title="Edit chapter"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(c);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                  title={c.isActive ? 'Hide from players' : 'Show to players'}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await adminSetChapterActive(c.chapterId, !c.isActive);
                      onChanged();
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                >
                  <Power className={`w-4 h-4 ${c.isActive ? 'text-emerald-400' : ''}`} />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-red-900/60 text-slate-400 hover:text-red-300"
                  title="Delete chapter (ladder rows and player progress cascade; puzzles stay in the library)"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (
                      !confirm(
                        `Delete chapter "${c.name || c.slug}"?\n\nIts ladder and every player's progress on it go with it. The puzzles stay in the library. Hide it instead if anyone may be mid-chapter.`,
                      )
                    )
                      return;
                    try {
                      await adminDeleteChapter(c.chapterId);
                      onChanged();
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChapterForm({
  chapter,
  nextSort,
  onDone,
  onCancel,
  onError,
}: {
  chapter: DrawChapter | null;
  nextSort: number;
  onDone: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [slug, setSlug] = useState(chapter?.slug ?? '');
  const [name, setName] = useState(chapter?.name ?? '');
  const [description, setDescription] = useState(chapter?.description ?? '');
  const [material, setMaterial] = useState(chapter?.material ?? 'paper');
  const [sortOrder, setSortOrder] = useState(chapter?.sortOrder ?? nextSort);
  const [saving, setSaving] = useState(false);

  return (
    <div className="p-4 border-b border-slate-700 bg-slate-900/60 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="slug (e.g. first_strokes)" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!!chapter} />
        <input className={inputCls} placeholder="Name (e.g. First Strokes)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <input className={inputCls} placeholder="What this chapter teaches" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <select className={inputCls} value={material} onChange={(e) => setMaterial(e.target.value)}>
          {DRAW_MATERIALS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input className={inputCls} type="number" placeholder="Sort order" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
      </div>
      <p className="text-xs text-slate-500">
        Material is the paper and ink the app draws this chapter with. Chapters unlock in sort order once the previous one is fully cleared.
      </p>
      <div className="flex gap-2 justify-end">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button
          className={btnPrimary}
          disabled={saving || !slug.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await adminUpsertChapter({
                chapterId: chapter?.chapterId,
                slug: slugify(slug),
                name: name.trim(),
                description: description.trim(),
                material,
                sortOrder,
              });
              onDone();
            } catch (err) {
              onError(err instanceof Error ? err.message : 'Failed to save chapter');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Save className="w-4 h-4" /> {chapter ? 'Save chapter' : 'Create chapter'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chapter detail: the studio and the ladder
// ---------------------------------------------------------------------------

function ChapterDetail({
  chapter,
  onChanged,
  onError,
  onNotice,
}: {
  chapter: DrawChapter;
  onChanged: () => void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
}) {
  const [levels, setLevels] = useState<DrawLevel[]>([]);

  const load = useCallback(async () => {
    try {
      setLevels(await adminListLevels(chapter.chapterId));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load the ladder');
    }
  }, [chapter.chapterId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Studio
        chapter={chapter}
        onIngested={(r) => {
          onNotice(
            `Added "${r.puzzle.name || r.puzzle.slug}" as level ${r.level} — ${r.report.edges} lines, ${r.report.vertices} vertices, difficulty ${r.puzzle.difficulty}` +
              (r.report.warnings.length ? ` · ${r.report.warnings.length} warning(s)` : ''),
          );
          void load();
          onChanged();
        }}
        onError={onError}
      />
      <Ladder
        chapter={chapter}
        levels={levels}
        onChanged={() => {
          void load();
          onChanged();
        }}
        onError={onError}
        onNotice={onNotice}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// The studio: Vectorpea + compile + preview + add
// ---------------------------------------------------------------------------

function Studio({
  chapter,
  onIngested,
  onError,
}: {
  chapter: DrawChapter;
  onIngested: (r: { puzzle: DrawPuzzle; report: CompileResult['report']; level: number }) => void;
  onError: (msg: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<((svg: string) => void) | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [split, setSplit] = useState(true);
  const [openEnds, setOpenEnds] = useState(false);
  const [daily, setDaily] = useState(false);
  const [duel, setDuel] = useState(false);
  const [difficulty, setDifficulty] = useState(0);

  const [svg, setSvg] = useState('');
  const [result, setResult] = useState<CompileResult | null>(null);
  const [busy, setBusy] = useState<'idle' | 'pull' | 'compile' | 'add'>('idle');

  const editorUrl = useMemo(() => {
    const config = {
      files: ['data:image/svg+xml;base64,' + btoa(TEMPLATE_SVG)],
      environment: { intro: false },
    };
    return 'https://www.vectorpea.com#' + encodeURIComponent(JSON.stringify(config));
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data === 'done') {
        setEditorReady(true);
        return;
      }
      if (e.data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(new Uint8Array(e.data));
        const resolve = pendingRef.current;
        pendingRef.current = null;
        resolve?.(text);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const pullFromEditor = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const wnd = iframeRef.current?.contentWindow;
      if (!wnd) {
        reject(new Error('Vectorpea has not loaded'));
        return;
      }
      pendingRef.current = resolve;
      wnd.postMessage('app.activeDocument.saveToOE("svg");', '*');
      setTimeout(() => {
        if (pendingRef.current === resolve) {
          pendingRef.current = null;
          reject(new Error('Vectorpea did not answer — is a document open?'));
        }
      }, 8000);
    });
  }, []);

  const compile = useCallback(
    async (source: string) => {
      setBusy('compile');
      try {
        const r = await adminCompile(source, split);
        setSvg(source);
        setResult(r);
        if (!slug && !name) {
          // Nothing named yet: propose something from the chapter and count.
          setSlug(slugify(`${chapter.slug}_${chapter.levelCount + 1}`));
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Compile failed');
      } finally {
        setBusy('idle');
      }
    },
    [split, slug, name, chapter.slug, chapter.levelCount, onError],
  );

  const playable = !!result && result.report.errors.length === 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          <Wand2 className="w-4 h-4" /> Studio
        </h3>
        <span className={`text-xs ${editorReady ? 'text-emerald-400' : 'text-slate-500'}`}>
          {editorReady ? 'Vectorpea ready' : 'Loading Vectorpea…'}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        Draw the figure with the pen and line tools. Put colour to show on completion on a layer named <span className="font-mono">reveal</span>,
        one dot marking the intended start on <span className="font-mono">start</span>, and a kolam dot grid on <span className="font-mono">dots</span>.
        Everything else is the puzzle. Lines that cross become corners you can turn at unless you untick the box below.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
          <iframe ref={iframeRef} src={editorUrl} title="Vectorpea" className="w-full" style={{ height: 560 }} />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <input className={inputCls} placeholder="slug (e.g. house)" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <input className={inputCls} placeholder="Name shown to players (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
              <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
              Crossings are corners (untick to make them bridges)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
              <input type="checkbox" checked={openEnds} onChange={(e) => setOpenEnds(e.target.checked)} />
              Show the open ends (teaching aid)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
              <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
              Daily-eligible
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
              <input type="checkbox" checked={duel} onChange={(e) => setDuel(e.target.checked)} />
              Duel-eligible
            </label>
            <label className="text-sm text-slate-300 flex items-center gap-2">
              Difficulty
              <select className={`${inputCls} w-auto`} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
                <option value={0}>auto</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <button
              className={btnPrimary}
              disabled={busy !== 'idle' || !editorReady}
              onClick={async () => {
                setBusy('pull');
                try {
                  const source = await pullFromEditor();
                  await compile(source);
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'Could not read the drawing');
                  setBusy('idle');
                }
              }}
            >
              <Wand2 className="w-4 h-4" />
              {busy === 'pull' ? 'Reading Vectorpea…' : busy === 'compile' ? 'Compiling…' : 'Compile from Vectorpea'}
            </button>
            <button className={btnGhost} disabled={busy !== 'idle'} onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Compile an .svg file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const source = await file.text();
                if (!slug) setSlug(slugify(file.name.replace(/\.svg$/i, '')));
                await compile(source);
                e.target.value = '';
              }}
            />
            <button
              className={btnPrimary}
              disabled={busy !== 'idle' || !playable || !slug.trim()}
              title={playable ? 'Store the puzzle and append it to this chapter' : 'Compile a playable figure first'}
              onClick={async () => {
                setBusy('add');
                try {
                  const r = await adminIngestPuzzle({
                    chapterId: chapter.chapterId,
                    slug: slugify(slug),
                    name: name.trim(),
                    svg,
                    splitCrossings: split,
                    difficulty: difficulty || undefined,
                    showOpenEnds: openEnds,
                    dailyEligible: daily,
                    duelEligible: duel,
                  });
                  onIngested({ puzzle: r.puzzle, report: r.report, level: r.level ?? 0 });
                  setSlug('');
                  setName('');
                  setResult(null);
                  setSvg('');
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'Could not add the puzzle');
                } finally {
                  setBusy('idle');
                }
              }}
            >
              <Plus className="w-4 h-4" /> {busy === 'add' ? 'Adding…' : `Add to “${chapter.name || chapter.slug}”`}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-700">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <GraphPreview graph={result.graph} trail={result.report.trail} revealSvg={result.revealSvg} dotsSvg={result.dotsSvg} size={320} />
          </div>
          <ReportCard result={result} />
        </div>
      )}
    </div>
  );
}

function ReportCard({ result }: { result: CompileResult }) {
  const r = result.report;
  const ok = r.errors.length === 0;
  const start =
    r.startHint >= 0
      ? `vertex ${r.startHint} (marked)`
      : r.startVertices.length === 2
        ? `vertex ${r.startVertices[0]} or ${r.startVertices[1]}`
        : r.startVertices.length > 2
          ? 'anywhere — it is a circuit'
          : '—';
  return (
    <div className="space-y-2 text-sm">
      <div className={`font-semibold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{ok ? '✓ One stroke' : '✗ Not playable yet'}</div>
      <table className="w-full text-xs font-mono text-slate-300">
        <tbody>
          <tr><td className="py-0.5 text-slate-500">Vertices</td><td>{r.vertices}</td><td className="text-slate-500">Edges</td><td>{r.edges}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Odd</td><td>{r.oddCount}{r.oddVertices.length ? ` (${r.oddVertices.join(', ')})` : ''}</td><td className="text-slate-500">Crossings</td><td>{r.crossings}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Curves</td><td>{r.curves}</td><td className="text-slate-500">Branching</td><td>{r.branching}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Shortest</td><td>{(r.shortestEdge * 100).toFixed(1)}%</td><td className="text-slate-500">Min angle</td><td>{r.minAngleDeg.toFixed(0)}°</td></tr>
          <tr><td className="py-0.5 text-slate-500">Difficulty</td><td>{r.difficulty}</td><td className="text-slate-500">Score</td><td>{r.score.toFixed(1)}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Start</td><td colSpan={3}>{start}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Layers</td><td colSpan={3}>{[result.hasReveal && 'reveal', result.hasDots && 'dots'].filter(Boolean).join(', ') || 'outline only'}</td></tr>
        </tbody>
      </table>
      {r.errors.map((e, i) => (
        <div key={`e${i}`} className="flex items-start gap-2 text-red-300 bg-red-900/30 border border-red-800 rounded-lg p-2">
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{e}</span>
        </div>
      ))}
      {r.warnings.map((w, i) => (
        <div key={`w${i}`} className="flex items-start gap-2 text-amber-300 bg-amber-900/30 border border-amber-800 rounded-lg p-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

// GraphPreview draws the compiled graph exactly as the app will: edges in
// the figure's own frame, odd vertices marked, the marked start ringed, and
// the compiler's witness trail animated over it.
function GraphPreview({
  graph,
  trail,
  revealSvg,
  dotsSvg,
  size,
}: {
  graph: DrawGraph;
  trail: number[];
  revealSvg?: string;
  dotsSvg?: string;
  size: number;
}) {
  const pad = 0.06;
  const w = graph.width || 1;
  const h = graph.height || 1;
  const odd = new Set<number>();
  const deg = new Array(graph.vertices.length).fill(0);
  for (const e of graph.edges) {
    deg[e.a]++;
    deg[e.b]++;
  }
  deg.forEach((d, i) => {
    if (d % 2 === 1) odd.add(i);
  });
  const stroke = Math.max(graph.strokeWidth || 0.018, 0.012);
  const route = trailPath(graph, trail);

  return (
    <div className="flex flex-col items-center gap-2">
      <style>{`@keyframes drawTrace { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }`}</style>
      <div className="relative" style={{ width: size, height: size * (h / w) }}>
        {dotsSvg && <div className="absolute inset-0 opacity-70" dangerouslySetInnerHTML={{ __html: dotsSvg }} />}
        {revealSvg && <div className="absolute inset-0 opacity-60" dangerouslySetInnerHTML={{ __html: revealSvg }} />}
        <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {graph.edges.map((e, i) => (
            <path key={i} d={edgePath(graph, e)} fill="none" stroke="#475569" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {route && (
            <path
              d={route}
              fill="none"
              stroke="#34d399"
              strokeWidth={stroke * 0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1000}
              strokeDasharray="1000"
              style={{ animation: 'drawTrace 5s linear infinite' }}
            />
          )}
          {graph.vertices.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={stroke * 0.9} fill={odd.has(i) ? '#f87171' : '#e2e8f0'} />
              {graph.startHint === i && <circle cx={x} cy={y} r={stroke * 1.8} fill="none" stroke="#fbbf24" strokeWidth={stroke * 0.35} />}
              <text x={x + stroke * 1.4} y={y - stroke * 1.2} fontSize={0.035} fill="#94a3b8" fontFamily="ui-monospace, monospace">
                {i}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="text-[11px] text-slate-500">grey = figure · green = a valid route · red = odd vertex · gold ring = marked start</div>
    </div>
  );
}

function Thumb({ graph, size = 56 }: { graph: DrawGraph; size?: number }) {
  const pad = 0.08;
  const w = graph.width || 1;
  const h = graph.height || 1;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`} width={size} height={size} preserveAspectRatio="xMidYMid meet" className="rounded bg-slate-900 border border-slate-700">
      {graph.edges.map((e, i) => (
        <path key={i} d={edgePath(graph, e)} fill="none" stroke="#cbd5e1" strokeWidth={0.04} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

function Ladder({
  chapter,
  levels,
  onChanged,
  onError,
  onNotice,
}: {
  chapter: DrawChapter;
  levels: DrawLevel[];
  onChanged: () => void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
}) {
  const [busy, setBusy] = useState('');

  const reorder = async (from: number, to: number) => {
    if (to < 0 || to >= levels.length) return;
    const order = levels.map((l) => l.puzzleId);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    setBusy(levels[from].puzzleId);
    try {
      await adminReorderLevels(chapter.chapterId, order);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Reorder failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="font-semibold text-slate-200">Ladder · {levels.length} levels</div>
        <div className="text-xs text-slate-500">Stars are stored by rung number — reorder before players have progress here.</div>
      </div>
      {levels.length === 0 && <div className="p-4 text-sm text-slate-500">No levels yet — compile a figure above and add it.</div>}
      <div className="divide-y divide-slate-700/60">
        {levels.map((l, i) => (
          <div key={l.puzzleId} className={`p-3 flex items-center gap-3 ${!l.puzzleActive ? 'opacity-60' : ''}`}>
            <div className="text-xs font-mono text-slate-500 w-6 text-right">{l.level}</div>
            <Thumb graph={l.graph} />
            <div className="min-w-0 flex-1">
              <div className="text-slate-100 text-sm font-medium truncate flex items-center gap-2">
                {l.name || l.slug}
                {!l.puzzleActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">HIDDEN</span>}
                {l.showOpenEnds && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300">OPEN ENDS</span>}
              </div>
              <div className="text-xs text-slate-500">
                {l.slug} · {l.edgeCount} lines · {l.oddCount} odd · difficulty {l.difficulty}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30" title="Move up" disabled={i === 0 || !!busy} onClick={() => void reorder(i, i - 1)}>
                <ArrowUp className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30" title="Move down" disabled={i === levels.length - 1 || !!busy} onClick={() => void reorder(i, i + 1)}>
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                title={l.showOpenEnds ? 'Stop showing the open ends' : 'Show the open ends on this level'}
                onClick={async () => {
                  try {
                    await adminSetLevel({ chapterId: chapter.chapterId, level: l.level, puzzleId: l.puzzleId, showOpenEnds: !l.showOpenEnds });
                    onChanged();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Failed');
                  }
                }}
              >
                <Sparkles className={`w-4 h-4 ${l.showOpenEnds ? 'text-sky-400' : ''}`} />
              </button>
              <button
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                title="Recompile from the stored SVG with the current compiler"
                onClick={async () => {
                  try {
                    const r = await adminRecompilePuzzle(l.puzzleId);
                    onNotice(`Recompiled "${l.name || l.slug}" — ${r.report.edges} lines, ${r.report.vertices} vertices` + (r.report.warnings.length ? ` · ${r.report.warnings.join(' · ')}` : ''));
                    onChanged();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Recompile failed');
                  }
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                title="Remove from this ladder (the puzzle stays in the library)"
                onClick={async () => {
                  if (!confirm(`Remove "${l.name || l.slug}" from the ladder?\n\nThe puzzle stays in the library and any pool it is tagged for.`)) return;
                  try {
                    await adminRemoveLevel(chapter.chapterId, l.level);
                    onChanged();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Failed');
                  }
                }}
              >
                <X className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 rounded hover:bg-red-900/60 text-slate-400 hover:text-red-300"
                title="Delete the puzzle (deactivated instead if anyone has drawn it)"
                onClick={async () => {
                  if (!confirm(`Delete puzzle "${l.name || l.slug}"?\n\nIf a player has drawn it, it is hidden instead so their progress keeps its meaning.`)) return;
                  try {
                    const r = await adminDeletePuzzle(l.puzzleId);
                    onNotice(r.deleted ? 'Puzzle deleted' : 'Puzzle hidden — a player had already drawn it');
                    onChanged();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Failed');
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily schedule
// ---------------------------------------------------------------------------

function DailyScheduler({ onError, onNotice }: { onError: (msg: string) => void; onNotice: (msg: string) => void }) {
  const [pool, setPool] = useState<DrawPuzzle[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [busyDate, setBusyDate] = useState('');
  const start = todayIST();

  const load = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([adminListPuzzles(false, 'daily'), adminListDaily(start, 30)]);
      setPool(p);
      setEntries(e);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load the daily schedule');
    }
  }, [start, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = new Map(entries.map((e) => [e.playDate, e]));
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40">
      <div className="p-4 border-b border-slate-700">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Daily Stroke
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          One figure a day, the same for everyone, timed. Days are Asia/Kolkata. Only puzzles tagged daily-eligible appear here ({pool.length} available).
        </p>
      </div>
      <div className="divide-y divide-slate-700/60">
        {days.map((d) => {
          const e = byDate.get(d);
          return (
            <div key={d} className="p-3 flex items-center gap-2">
              <div className="font-mono text-xs text-slate-400 w-24">{d}{d === start ? ' ·' : ''}</div>
              <select
                className={`${inputCls} flex-1`}
                value={e?.puzzleId ?? ''}
                disabled={busyDate === d}
                onChange={async (ev) => {
                  const puzzleId = ev.target.value;
                  setBusyDate(d);
                  try {
                    if (puzzleId) {
                      await adminSetDaily(d, puzzleId);
                    } else {
                      await adminClearDaily(d);
                    }
                    onNotice(puzzleId ? `Scheduled ${d}` : `Cleared ${d}`);
                    await load();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : 'Failed to schedule');
                  } finally {
                    setBusyDate('');
                  }
                }}
              >
                <option value="">— nothing scheduled —</option>
                {pool.map((p) => (
                  <option key={p.puzzleId} value={p.puzzleId}>
                    {p.name || p.slug} · d{p.difficulty} · {p.edgeCount} lines
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
