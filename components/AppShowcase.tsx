"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useCallback, useEffect, useState } from "react";
import { Moon, Sun, Smartphone } from "lucide-react";
import {
  SHOWCASE_PAIRS,
  SHOWCASE_SHOP,
  type ShowcaseTheme,
} from "@/lib/showcase-screens";

/** Phone-style tiles: full screenshot visible (letterboxed if needed). */
function ShowcasePhone({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  const onError = useCallback(() => {
    setBroken(true);
  }, []);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (broken) {
    return (
      <div className="mx-auto flex aspect-[9/19] w-full max-w-[min(90vw,280px)] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-600/80 bg-slate-900/40 px-4 text-center">
        <Smartphone className="mb-2 h-10 w-10 text-slate-500" aria-hidden />
        <p className="text-xs text-slate-500">
          Add{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">
            public{src}
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[min(90vw,280px)] min-h-0 overflow-hidden rounded-3xl border border-slate-600/50 bg-slate-950 p-1.5 shadow-2xl shadow-black/40 ring-1 ring-white/5 sm:max-w-[260px]">
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-2xl bg-slate-900">
        <Image
          key={src}
          src={src}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          sizes="(max-width: 640px) 90vw, 260px"
          className="object-contain object-top"
          onError={onError}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/80 to-transparent sm:h-24"
        aria-hidden
      />
    </div>
  );
}

function ThemeToggle({
  value,
  onChange,
  hasLight,
}: {
  value: ShowcaseTheme;
  onChange: (t: ShowcaseTheme) => void;
  hasLight: boolean;
}) {
  if (!hasLight) return null;

  return (
    <div
      className="inline-flex w-fit shrink-0 items-stretch gap-px rounded-full border border-slate-600/70 bg-slate-900/80 p-px shadow-sm"
      role="group"
      aria-label="Screenshot theme"
    >
      <button
        type="button"
        aria-label="Show dark mode screenshot"
        aria-pressed={value === "dark"}
        onClick={() => onChange("dark")}
        title="Dark"
        className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-2 text-xs font-medium transition-colors sm:h-8 sm:min-w-0 sm:gap-1.5 sm:px-2.5 ${
          value === "dark"
            ? "bg-slate-600 text-white"
            : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
        }`}
      >
        <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Dark</span>
      </button>
      <button
        type="button"
        aria-label="Show light mode screenshot"
        aria-pressed={value === "light"}
        onClick={() => onChange("light")}
        title="Light"
        className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-2 text-xs font-medium transition-colors sm:h-8 sm:min-w-0 sm:gap-1.5 sm:px-2.5 ${
          value === "light"
            ? "bg-slate-600 text-white"
            : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
        }`}
      >
        <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Light</span>
      </button>
    </div>
  );
}

function PairCard({
  pair,
  index,
}: {
  pair: (typeof SHOWCASE_PAIRS)[number];
  index: number;
}) {
  const [theme, setTheme] = useState<ShowcaseTheme>("dark");
  const hasLight = Boolean(pair.lightSrc);
  const src =
    theme === "light" && pair.lightSrc ? pair.lightSrc : pair.darkSrc;

  return (
    <motion.article
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      className="min-h-0 rounded-2xl border border-slate-700/80 bg-slate-800/40 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 sm:pr-4">
          <h3 className="text-lg font-semibold text-white sm:text-xl">
            {pair.title}
          </h3>
          <p className="mt-1 text-sm text-slate-400">{pair.subtitle}</p>
        </div>
        <ThemeToggle value={theme} onChange={setTheme} hasLight={hasLight} />
      </div>
      <ShowcasePhone
        src={src}
        alt={`${pair.title} — ${theme} mode`}
        priority={index === 0}
      />
    </motion.article>
  );
}

/** Shop uses the same phone frame as feature pairs for visual consistency. */
function ShopCard() {
  const [theme, setTheme] = useState<ShowcaseTheme>("dark");
  const hasAlt = Boolean(SHOWCASE_SHOP.altSrc);
  const src =
    hasAlt && theme === "light"
      ? (SHOWCASE_SHOP.altSrc as string)
      : SHOWCASE_SHOP.primarySrc;

  return (
    <motion.article
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ duration: 0.55, delay: 0.2 }}
      className="min-h-0 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-slate-800/50 to-violet-950/20 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white sm:text-xl">
            {SHOWCASE_SHOP.title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {SHOWCASE_SHOP.subtitle}
          </p>
        </div>
        {hasAlt ? (
          <ThemeToggle value={theme} onChange={setTheme} hasLight />
        ) : null}
      </div>
      <ShowcasePhone
        src={src}
        alt={
          hasAlt
            ? `${SHOWCASE_SHOP.title} — ${theme} mode`
            : `${SHOWCASE_SHOP.title} screenshot`
        }
        priority={false}
      />
    </motion.article>
  );
}

export default function AppShowcase() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.06 });

  return (
    <section
      id="showcase"
      ref={ref}
      className="relative scroll-mt-20 px-3 py-16 sm:scroll-mt-24 sm:px-6 sm:py-24 md:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-10 text-center sm:mb-16"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.55 }}
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-violet-400/90 sm:text-sm">
            Inside the app
          </p>
          <h2 className="mb-3 text-3xl font-bold leading-tight sm:mb-4 sm:text-4xl md:text-5xl">
            <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Chat, avatars & shop
            </span>
          </h2>
          <p className="mx-auto max-w-2xl px-1 text-base text-slate-400 sm:text-lg">
            Real screens from Plazy — flip between dark and light to see how
            Kalpix feels day and night.
          </p>
        </motion.div>

        <div className="grid min-h-0 grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 md:items-start">
          {SHOWCASE_PAIRS.map((pair, index) => (
            <PairCard key={pair.title} pair={pair} index={index} />
          ))}
          <ShopCard />
        </div>
      </div>
    </section>
  );
}
