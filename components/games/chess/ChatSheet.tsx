"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	X,
	Search,
	Bell,
	BellOff,
	MessageSquare,
	MessageSquareOff,
} from "lucide-react";
import {
	ChatLimits,
	chatEntryText,
	type ChatEntry,
	type SenderAppearance,
} from "@/lib/kalpix-web-sdk/chat";
import {
	PickerApi,
	type PickerPack,
	type PickerSticker,
	type TrendingPack,
} from "@/lib/kalpix-web-sdk/picker";
import type { KalpixHttp } from "@/lib/kalpix-web-sdk/rpc";
import { motion } from "framer-motion";

/**
 * In-match chess chat, matching Tero's sheet.
 *
 * Layout is deliberately copied from lib/features/games/tero/.../uno_bottom_sheets.dart
 * rather than reinvented, because the two games sit behind the same tab bar and
 * any difference reads as one of them being broken:
 *
 *   - preset chips: the RAW preset strings ("gg", "nice"), sent as plain text,
 *     34px tall, 14px radius, hairline white border
 *   - composer: one rounded field with the sticker button INSIDE it as a
 *     prefix, and a bare send arrow outside — not a circular button
 *   - stickers: their own sheet over the chat, with a pack rail, a search
 *     field, a section header per pack and a grid
 */

export interface ChatSheetProps {
	open: boolean;
	onClose(): void;
	entries: ChatEntry[];
	myUserId: string;
	disabled: boolean;
	canToggle: boolean;
	onSendText(text: string): void;
	onSendSticker(stickerId: string): void;
	onSetDisabled(disabled: boolean): void;
	quickPresets: string[];
	http: KalpixHttp | null;
	muted: boolean;
	onToggleMute(): void;
}

/**
 * Themed chat-bubble frame, ported from Plak's _NinePatchBubbleDecoration
 * (lib/core/components/app_chat_bubble.dart).
 *
 * The art is NOT a nine-patch with a pixel centre-slice — that is the bundled
 * default bubble, and using its numbers here is what dragged the tail across
 * the text in earlier attempts. The themed frame is defined as FRACTIONS of an
 * 866x473 template, with fixed corners and strips that TILE between them:
 *
 *   side insets 0.30 of width, top 0.391 / bottom 0.486 of height,
 *   drawn at 0.26 art-px -> logical-px.
 *
 * That maps exactly onto CSS border-image with percentage slices and
 * `repeat` — corners fixed, edges tiled — which is the piece I had wrong
 * before (I was stretching, not tiling).
 *
 * The dragon sits bottom-LEFT on received art and bottom-RIGHT on sent, which
 * is why Plak swaps the side insets rather than mirroring the image.
 */
const ART_H = 473;
const INSET_SIDE = 0.3;
const INSET_TOP = 0.391;
const INSET_BOTTOM = 0.486;
const ART_SCALE = 0.26;

// Frame thickness in CSS px: fraction x art dimension x display scale. The
// side value uses the art HEIGHT-derived scale the same way Plak does, so a
// bubble keeps its proportions at any text length.
const FRAME_TOP = Math.round(INSET_TOP * ART_H * ART_SCALE); // 48
const FRAME_BOTTOM = Math.round(INSET_BOTTOM * ART_H * ART_SCALE); // 60
const FRAME_SIDE = Math.round(INSET_SIDE * ART_H * ART_SCALE); // 37

/** Relative luminance of #rrggbb, 0..1. Rec. 709 weights. */
function luminance(hex: string): number | null {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return (
		(0.2126 * ((n >> 16) & 255) +
			0.7152 * ((n >> 8) & 255) +
			0.0722 * (n & 255)) /
		255
	);
}

/** Readable text colour for a painted background. */
function textOn(
	background: string | undefined,
	preferred: string | undefined,
): string {
	const bg = background ? luminance(background) : null;
	if (bg === null) return "#ffffff";
	const pref = preferred ? luminance(preferred) : null;
	if (preferred && pref !== null && Math.abs(pref - bg) > 0.4) return preferred;
	return bg > 0.55 ? "#111827" : "#ffffff";
}

function bubbleStyle(
	appearance: SenderAppearance | undefined,
	mine: boolean,
): React.CSSProperties {
	const url = mine
		? appearance?.rightBubbleUrl?.trim()
		: appearance?.leftBubbleUrl?.trim();
	const accent = appearance?.accentColor?.trim();

	if (url) {
		const styleColor = mine
			? appearance?.sentTextColor
			: appearance?.receivedTextColor;
		return {
			borderImageSource: `url(${url})`,
			// Percentages of the source image, `fill` so the middle is painted too.
			borderImageSlice: `${INSET_TOP * 100}% ${INSET_SIDE * 100}% ${INSET_BOTTOM * 100}% ${INSET_SIDE * 100}% fill`,
			// repeat, not stretch: the strips between the corners tile.
			borderImageRepeat: "repeat",
			borderImageWidth: `${FRAME_TOP}px ${FRAME_SIDE}px ${FRAME_BOTTOM}px ${FRAME_SIDE}px`,
			borderStyle: "solid",
			borderColor: "transparent",
			borderWidth: 0,
			// Keeps the text off the decorated frame, mirroring themedContentInset.
			padding: `${Math.round(FRAME_TOP * 0.55)}px ${Math.round(FRAME_SIDE * 0.6)}px ${Math.round(FRAME_BOTTOM * 0.5)}px`,
			color: styleColor?.trim() || "#ffffff",
			minWidth: 60,
			// The frame is drawn OUTSIDE the content box (border-image-width adds
			// ~37px a side), so without these a long message pushes the bubble past
			// the 78% column and off the screen edge.
			maxWidth: "100%",
			boxSizing: "border-box",
		};
	}

	// No bubble equipped: accent-tinted, with text picked for contrast.
	const background = mine ? accent || "#4f46e5" : "rgba(255,255,255,0.12)";
	return {
		background,
		borderRadius: 18,
		padding: "10px 16px",
		color: mine ? textOn(accent, appearance?.sentTextColor) : "#ffffff",
	};
}

export default function ChatSheet(p: ChatSheetProps) {
	const [draft, setDraft] = useState("");
	const [pickerOpen, setPickerOpen] = useState(false);
	const listRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!p.open) return;
		const el = listRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [p.entries.length, p.open]);

	const send = useCallback(() => {
		const text = draft.trim();
		if (!text) return;
		p.onSendText(text.slice(0, ChatLimits.MaxTextLen));
		setDraft("");
	}, [draft, p]);

	if (!p.open) return null;

	return (
		<div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/55">
			<button
				aria-label="Close chat"
				className="absolute inset-0 cursor-default"
				onClick={p.onClose}
			/>

			<div className="relative flex max-h-[72%] flex-col rounded-t-3xl bg-[#12172a] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
				<div className="flex items-center gap-1 px-5 pt-4">
					<div className="flex-1 text-2xl font-semibold text-white">Chat</div>
					<button
						onClick={p.onToggleMute}
						aria-label={p.muted ? "Unmute chat" : "Mute chat"}
						className={`grid h-9 w-9 place-items-center rounded-full ${
							p.muted ? "text-amber-300" : "text-white/70 hover:bg-white/10"
						}`}
					>
						{p.muted ? (
							<BellOff className="h-5 w-5" />
						) : (
							<Bell className="h-5 w-5" />
						)}
					</button>
					{p.canToggle && (
						<button
							onClick={() => p.onSetDisabled(!p.disabled)}
							aria-label={
								p.disabled ? "Enable match chat" : "Disable match chat"
							}
							className={`grid h-9 w-9 place-items-center rounded-full ${
								p.disabled ? "text-red-300" : "text-white/70 hover:bg-white/10"
							}`}
						>
							{p.disabled ? (
								<MessageSquareOff className="h-5 w-5" />
							) : (
								<MessageSquare className="h-5 w-5" />
							)}
						</button>
					)}
					<button
						onClick={p.onClose}
						aria-label="Close"
						className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Messages */}
				<div
					ref={listRef}
					className="mt-2 min-h-[80px] flex-1 space-y-2 overflow-y-auto px-5"
				>
					{p.entries.map((e) => {
						const mine = e.senderId === p.myUserId;
						return (
							<div
								key={`${e.seq}-${e.tsMs}`}
								className={`flex ${mine ? "justify-end" : "justify-start"}`}
							>
								<div
									className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}
								>
									{!mine && e.username && (
										<span className="mb-1 text-[13px] text-white/45">
											{e.username}
										</span>
									)}
									{e.kind === "sticker" ? (
										e.stickerUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={e.stickerUrl}
												alt="sticker"
												className="h-24 w-24 object-contain"
											/>
										) : (
											<div className="h-24 w-24 rounded-lg bg-white/5" />
										)
									) : (
										<div
											className="text-[15px]"
											style={bubbleStyle(e.appearance, mine)}
										>
											{chatEntryText(e)}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{p.disabled ? (
					<p className="px-5 py-3 text-center text-sm text-white/70">
						{p.canToggle
							? "Chat is off. Use the switch above to turn it back on."
							: "Chat is disabled by the match creator."}
					</p>
				) : (
					<>
						{/* Preset chips — raw preset text, sent as a normal message, exactly
                as Tero does. Rendering a prettified label would show one word
                and send another. */}
						{p.quickPresets.length > 0 && (
							<div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
								{p.quickPresets.map((preset) => (
									<button
										key={preset}
										onClick={() => p.onSendText(preset)}
										className="h-[34px] shrink-0 rounded-[14px] border border-white/15 bg-black/40 px-3 text-xs text-white"
									>
										{preset}
									</button>
								))}
							</div>
						)}

						{/* Composer: sticker button inside the field, bare arrow outside. */}
						<div className="mt-2 flex items-center gap-2.5 px-5">
							<div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/10 px-2 py-1.5">
								<button
									onClick={() => setPickerOpen(true)}
									aria-label="Stickers"
									className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80 hover:bg-white/20"
								>
									<StickerIcon />
								</button>
								<input
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") send();
									}}
									maxLength={ChatLimits.MaxTextLen}
									placeholder="Write something"
									className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] text-white placeholder:text-white/40 focus:outline-none"
								/>
							</div>
							<button
								onClick={send}
								aria-label="Send"
								className="shrink-0 text-white/90 disabled:opacity-40"
								disabled={!draft.trim()}
							>
								<SendIcon />
							</button>
						</div>
					</>
				)}
			</div>

			{/* Sibling of the chat sheet, not a child: as a child, `bottom-0` and a
          percentage height resolved against the chat sheet — which is sized by
          its content — so with a short conversation the picker collapsed to a
          sliver. Anchored here it measures against the viewport. */}
			{pickerOpen && !p.disabled && (
				<StickerSheet
					http={p.http}
					onClose={() => setPickerOpen(false)}
					onPick={(s) => {
						p.onSendSticker(s.stickerId);
						setPickerOpen(false);
					}}
				/>
			)}
		</div>
	);
}

/** Filled arrow, matching Tero's send glyph rather than a circular button. */
function SendIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			width="34"
			height="34"
			fill="currentColor"
			aria-hidden="true"
		>
			<path d="M2.5 21 23 12 2.5 3 2.5 10l14 2-14 2z" />
		</svg>
	);
}

function StickerIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			aria-hidden="true"
		>
			<path d="M4 4h16v10l-6 6H4z" strokeLinejoin="round" />
			<path d="M20 14h-6v6" strokeLinejoin="round" />
			<circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" />
			<circle cx="14" cy="9.5" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}

/**
 * The sticker sheet: pack rail, search, then a grid per pack — Tero's layout.
 *
 * Sits ABOVE the chat sheet rather than inline under the composer: inline, the
 * grid either squeezed the conversation to nothing or pushed the composer off
 * screen on a short device.
 */
function StickerSheet({
	http,
	onPick,
	onClose,
}: {
	http: KalpixHttp | null;
	onPick(sticker: PickerSticker): void;
	onClose(): void;
}) {
	const api = useMemo(() => (http ? new PickerApi(http) : null), [http]);
	const [packs, setPacks] = useState<PickerPack[]>([]);
	const [activePack, setActivePack] = useState<string>("");
	const [stickers, setStickers] = useState<PickerSticker[]>([]);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PickerSticker[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [trending, setTrending] = useState<TrendingPack[]>([]);

	useEffect(() => {
		if (!api) return;
		let cancelled = false;
		// One call: picker/screen carries the pinned packs (with stickers inlined)
		// AND the trending preview, so the strip costs nothing extra.
		api
			.screen()
			.then(({ packs: list, trending: hot }) => {
				if (cancelled) return;
				setPacks(list);
				setTrending(hot);
				if (list.length > 0) setActivePack(list[0].packId);
				setLoading(false);
			})
			.catch(
				() =>
					!cancelled &&
					(setError("Could not load your stickers."), setLoading(false)),
			);
		return () => {
			cancelled = true;
		};
	}, [api]);

	// No second call: picker/screen inlines each pack's first page of stickers,
	// so switching packs is instant and a slow network cannot leave the grid
	// empty while a follow-up request is in flight.
	useEffect(() => {
		const pack = packs.find((x) => x.packId === activePack);
		setStickers(pack?.stickers ?? []);
	}, [packs, activePack]);

	// Debounced so typing doesn't fire an RPC per keystroke.
	useEffect(() => {
		if (!api) return;
		const q = query.trim();
		if (!q) {
			setResults(null);
			return;
		}
		let cancelled = false;
		const t = setTimeout(() => {
			api
				.search(q)
				.then((list) => !cancelled && setResults(list))
				.catch(() => !cancelled && setResults([]));
		}, 300);
		return () => {
			cancelled = true;
			clearTimeout(t);
		};
	}, [api, query]);

	const activeName =
		packs.find((x) => x.packId === activePack)?.name ?? "Stickers";
	const shown = results ?? stickers;

	/**
	 * Sheet height, dragged with framer-motion rather than hand-rolled pointer
	 * maths.
	 *
	 * The hand-rolled version did not work on a device: it read the viewport
	 * height on every pointermove, never set `touch-action: none` on the handle
	 * (so WKWebView claimed the gesture as a page scroll), and did not guard
	 * setPointerCapture — the same three things Board.tsx had to get right for
	 * chess moves. framer-motion listens on window, manages touch-action itself
	 * and is already a dependency used across this app, so this is one less
	 * bespoke gesture implementation to maintain.
	 *
	 * Opens at 0.75 of the viewport — the same fraction Plak's
	 * StickerPickerSheet uses (MediaQuery.sizeOf(context).height * 0.75).
	 */
	const OPEN_PCT = 0.75;
	const MIN_PCT = 0.4;
	const MAX_PCT = 0.95;
	const [heightPct, setHeightPct] = useState(OPEN_PCT);
	// Captured once per gesture: reading innerHeight mid-drag makes the sheet
	// jump when the keyboard or URL bar changes the viewport underneath it.
	const startRef = useRef({ pct: OPEN_PCT, vh: 0 });

	return (
		<motion.div
			className="absolute inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-[#efeaf7] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
			style={{ height: `${Math.round(heightPct * 100)}vh` }}
			initial={{ y: "100%" }}
			animate={{ y: 0 }}
			transition={{ type: "spring", stiffness: 420, damping: 38 }}
		>
			{/* Drag handle. touch-none is what stops WKWebView treating the drag as
          a page scroll; select-none stops it starting a text selection. */}
			<motion.div
				drag="y"
				dragMomentum={false}
				dragElastic={0}
				// Constrained to zero so the handle never actually translates — the
				// gesture only feeds the height below.
				dragConstraints={{ top: 0, bottom: 0 }}
				onDragStart={() => {
					startRef.current = { pct: heightPct, vh: window.innerHeight || 1 };
				}}
				onDrag={(_, info) => {
					const { pct, vh } = startRef.current;
					// Dragging UP is negative offset.y, and up should GROW the sheet.
					const next = pct - info.offset.y / vh;
					setHeightPct(Math.min(MAX_PCT, Math.max(MIN_PCT, next)));
				}}
				className="flex touch-none select-none cursor-grab justify-center py-3 active:cursor-grabbing"
			>
				<div className="h-1.5 w-24 rounded-full bg-black/25" />
			</motion.div>

			{/* Pack rail */}
			<div className="flex items-center gap-3 px-4 pt-3">
				<button
					onClick={onClose}
					aria-label="Close stickers"
					className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/60"
				>
					<X className="h-5 w-5" />
				</button>
				{packs.map((pack) => (
					<button
						key={pack.packId}
						onClick={() => {
							setActivePack(pack.packId);
							setQuery("");
						}}
						aria-label={pack.name}
						className={`h-12 w-12 shrink-0 overflow-hidden rounded-full ${
							activePack === pack.packId && !results
								? "ring-2 ring-violet-400"
								: ""
						}`}
					>
						{pack.iconUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={pack.iconUrl}
								alt={pack.name}
								className="h-full w-full object-contain"
							/>
						) : (
							<span className="grid h-full w-full place-items-center bg-black/5 text-[10px] text-black/60">
								{pack.name.slice(0, 2)}
							</span>
						)}
					</button>
				))}
			</div>

			{/* Search */}
			<div className="px-4 pt-3">
				<div className="flex h-12 items-center gap-2 rounded-2xl bg-black/5 px-4">
					<Search className="h-5 w-5 shrink-0 text-black/40" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search stickers"
						className="min-w-0 flex-1 bg-transparent text-[15px] text-black placeholder:text-black/40 focus:outline-none"
					/>
				</div>
			</div>

			<div className="mt-3 flex-1 overflow-y-auto px-4 pb-4">
				{error && (
					<p className="py-6 text-center text-sm text-red-600">{error}</p>
				)}

				{!error && packs.length === 0 && !loading && (
					<p className="py-8 text-center text-sm text-black/50">
						You don&rsquo;t own any sticker packs yet.
					</p>
				)}

				{/* Trending: a discovery strip of packs, shown only while browsing.
            Tiles are packs, not stickers — you cannot send from a pack you do
            not own, so tapping one is a browse action, not a send. */}
				{!error && results === null && trending.length > 0 && (
					<div className="pb-3">
						<h3 className="pb-2 text-lg font-semibold text-black">Trending</h3>
						<div className="flex gap-3 overflow-x-auto">
							{trending.map((t) => (
								<div key={t.packId} className="w-16 shrink-0 text-center">
									<div className="h-16 w-16 overflow-hidden rounded-2xl bg-black/5">
										{t.iconUrl && (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={t.iconUrl}
												alt={t.name}
												className="h-full w-full object-contain"
											/>
										)}
									</div>
									<p className="truncate pt-1 text-[11px] text-black/60">
										{t.name}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{!error && (results !== null || packs.length > 0) && (
					<h3 className="pb-2 text-lg font-semibold text-black">
						{results !== null ? "Results" : activeName}
					</h3>
				)}

				{loading && (
					<p className="py-6 text-center text-sm text-black/40">Loading…</p>
				)}

				{!loading && results !== null && results.length === 0 && (
					<p className="py-6 text-center text-sm text-black/50">
						No stickers match “{query}”.
					</p>
				)}

				{!loading && shown.length > 0 && (
					<div className="grid grid-cols-4 gap-3">
						{shown.map((s) => (
							<button
								key={s.stickerId}
								onClick={() => onPick(s)}
								className="aspect-square rounded-xl p-1 active:scale-95"
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={s.imageUrl}
									alt="sticker"
									className="h-full w-full object-contain"
								/>
							</button>
						))}
					</div>
				)}
			</div>
		</motion.div>
	);
}
