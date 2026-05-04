'use client';

import { useEffect, useRef, useState } from 'react';

export interface ClockProps {
  /** Authoritative milliseconds remaining at the moment of `serverNowMs`. */
  ms: number;
  /** Wall clock (Date.now()) when this `ms` snapshot was received. */
  serverNowMs: number;
  /** Whether this side is currently to move (clock should tick down). */
  ticking: boolean;
  label: string; // "You" / "Opponent" / username
}

/**
 * Smooth countdown display. Re-renders ~10× per second locally between server
 * updates, then resyncs whenever a fresh `ms`/`serverNowMs` pair arrives.
 */
export default function Clock(props: ClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!props.ticking) {
      setNow(Date.now());
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setNow(Date.now());
      rafRef.current = window.setTimeout(tick, 100) as unknown as number;
    };
    tick();
    return () => {
      cancelled = true;
      if (rafRef.current !== null) clearTimeout(rafRef.current);
    };
  }, [props.ticking, props.serverNowMs]);

  const elapsed = props.ticking ? Math.max(0, now - props.serverNowMs) : 0;
  const remaining = Math.max(0, props.ms - elapsed);
  const flagging = remaining < 10_000;

  return (
    <div
      className={`flex items-baseline justify-between gap-3 rounded-md px-3 py-2 font-mono text-2xl tabular-nums ${
        props.ticking
          ? 'bg-white/10 text-white'
          : 'bg-black/30 text-white/60'
      } ${flagging && props.ticking ? 'text-red-400' : ''}`}
    >
      <span className="text-sm font-sans tracking-wide opacity-70">
        {props.label}
      </span>
      <span>{formatClock(remaining)}</span>
    </div>
  );
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (ms < 10_000) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${min}:${sec.toString().padStart(2, '0')}.${tenths}`;
  }
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
