'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';

export interface MoveListProps {
  pgn: string;
}

/**
 * Render the move list in pairs (1. e4 e5  2. Nf3 Nc6 ...).
 * Auto-scrolls to the bottom as new moves arrive.
 */
export default function MoveList({ pgn }: MoveListProps) {
  const sans = useMemo(() => extractSans(pgn), [pgn]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sans.length]);

  const rows: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({ num: Math.floor(i / 2) + 1, white: sans[i], black: sans[i + 1] });
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-64 overflow-y-auto rounded-md bg-black/40 p-2 font-mono text-sm text-white/80"
    >
      {rows.length === 0 ? (
        <div className="px-1 py-2 text-white/40">No moves yet.</div>
      ) : (
        <table className="w-full">
          <tbody>
            {rows.map((r) => (
              <tr key={r.num} className="hover:bg-white/5">
                <td className="w-8 px-1 py-0.5 text-white/40">{r.num}.</td>
                <td className="px-1 py-0.5">{r.white}</td>
                <td className="px-1 py-0.5">{r.black ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function extractSans(pgn: string): string[] {
  if (!pgn) return [];
  try {
    const game = new Chess();
    game.loadPgn(pgn, { strict: false });
    return game.history();
  } catch {
    return [];
  }
}
