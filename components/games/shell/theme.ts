// Lobby theme tokens. Mirrors plazy's `lib/config/theme/theme_config.dart`
// dark-mode tokens so the webview lobbies feel like a continuation of the app.

export const lobbyTheme = {
  // Brand
  primary: '#285ac6',          // darkPrimary100 — match plazy dark mode
  primarySoft: 'rgba(40,90,198,0.18)',
  primaryBorder: 'rgba(40,90,198,0.55)',

  // Accents (rotate for queue rows)
  accentTeal: '#2ca1a3',       // secondary50
  accentRed: '#d6336c',        // pinkishRed100 (approx)
  accentYellow: '#f1c40f',     // yellow100 (approx)

  // Surfaces
  bg: '#0b0f1c',
  bgGrad1: '#0b1027',
  bgGrad2: '#10162e',
  bgGrad3: '#0a0f1a',
  card: '#141a2e',
  cardSoft: 'rgba(255,255,255,0.06)',
  divider: 'rgba(255,255,255,0.08)',

  // Text
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.65)',
  textDim: 'rgba(255,255,255,0.45)',

  // Misc
  success: '#058722',
  danger: '#e5484d',
} as const;

export const accentRotation = [
  lobbyTheme.accentTeal,
  lobbyTheme.accentRed,
  lobbyTheme.accentYellow,
];
