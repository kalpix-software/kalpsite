/**
 * Marketing screenshots for the public site.
 *
 * Default: WebP files in `public/showcase/` (see `public/showcase/README.md`).
 * Recommended: 9:19 or 9:16 phone aspect, ~1080px wide.
 */

export type ShowcaseTheme = "dark" | "light";

export type ShowcasePair = {
  /** Short heading on the site */
  title: string;
  /** One line under the title */
  subtitle: string;
  darkSrc: string;
  /** Omit if you only have one theme for this feature */
  lightSrc?: string;
};

/** Three features with dark + light; shop is often a single wide shot (7 files total). */
export const SHOWCASE_PAIRS: ShowcasePair[] = [
  {
    title: "Avatar customization",
    subtitle: "Spine-powered looks you can tune to match your style.",
    darkSrc: "/showcase/avatar-dark.webp",
    lightSrc: "/showcase/avatar-light.webp",
  },
  {
    title: "Chat",
    subtitle: "Channels, presence, and realtime updates built for play.",
    darkSrc: "/showcase/chat-dark.webp",
    lightSrc: "/showcase/chat-light.webp",
  },
  {
    title: "Conversations",
    subtitle: "DMs and threads that stay in sync across sessions.",
    darkSrc: "/showcase/conversation-dark.webp",
    lightSrc: "/showcase/conversation-light.webp",
  },
];

/** Single image (use dark OR light export). Optional second for theme toggle. */
export const SHOWCASE_SHOP: {
  title: string;
  subtitle: string;
  /** Default frame (e.g. `shop.webp` or `shop-dark.webp`). */
  primarySrc: string;
  /** Optional second frame for a dark/light toggle on the shop card. */
  altSrc?: string;
} = {
  title: "Shop & economy",
  subtitle: "Coins, gems, deals, and cosmetics — same flows as in Plazy.",
  primarySrc: "/showcase/shop.webp",
  // e.g. altSrc: "/showcase/shop-light.webp" for a second store screenshot + toggle.
  altSrc: undefined,
};
