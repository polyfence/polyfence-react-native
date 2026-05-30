import { StyleSheet } from 'react-native';

// Brand tokens — Polyfence (polyfence-brand/src/app/components/brand-tokens.ts)
export const Colors = {
  primary: '#00C2FF', // CYAN
  background: '#FAFBFC', // SURFACE
  card: '#FFFFFF',
  secondary: '#F3F4F6', // gray-100
  secondaryForeground: '#111111', // INK
  foreground: '#111111', // INK
  mutedForeground: '#6B7280', // TEXT_SECONDARY
  textTertiary: '#9CA3AF', // TEXT_TERTIARY
  border: '#E5E7EB', // BORDER (solid light gray) — outer card edge
  // Lighter divider between list rows inside cards (zone items, event
  // rows). Outer card border stays at the heavier `border` token.
  borderMuted: '#F3F4F6',
  destructive: '#EF4444',
  destructiveHover: '#DC2626',
  success: '#22C55E',
  warning: '#EAB308',
  // Zone type colors — pastel fill paired with a darker icon for contrast.
  circleZoneBg: '#DBEAFE', // blue-100
  circleZoneIcon: '#2563EB', // blue-600
  polygonZoneBg: '#F3E8FF', // purple-100
  polygonZoneIcon: '#9333EA', // purple-600
  white: '#FFFFFF',
  black: '#000000',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xl2: 24,
  xl3: 32,
};

export const Radius = {
  sm: 6,
  md: 8,
  lg: 8, // cards
  xl: 14,
  full: 999,
};

// Drop-shadow tokens. Each token spans both the iOS shadow props
// (shadowColor / shadowOffset / shadowOpacity / shadowRadius) and the
// Android `elevation` prop so the same key produces a comparable visual
// across platforms.
export const Shadows = {
  // Subtle drop — active GPS profile button, raised cards.
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  // Light overlay — map status tag, floating chips.
  overlay: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  // Prominent — tracking-button FAB.
  fab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
} as const;

// Per-weight Space Grotesk family names. Bundled as static TTFs under
// assets/fonts/ and linked into the native projects via
// react-native.config.js (run `npx react-native-asset` to copy them in).
// Use these where you want bulletproof weight rendering across iOS and
// Android — relying on fontWeight + a single family name leaves Android
// dependent on a font-config XML that RN doesn't generate.
export const Fonts = {
  regular: 'SpaceGrotesk-Regular',
  medium: 'SpaceGrotesk-Medium',
  semibold: 'SpaceGrotesk-SemiBold',
  bold: 'SpaceGrotesk-Bold',
};

// fontFamily is set explicitly per-preset (mapped from intended weight) so
// brand typography renders without relying on platform fallback or any
// runtime monkey-patch. On Android, fontWeight is ignored when a custom
// fontFamily is set to a single-weight TTF — so the weight is baked into
// the family name. The fontWeight value is retained as design intent (so
// a future reader sees "this is meant to be medium") and still applies on
// iOS as a synthetic-bold hint; it has no runtime effect on Android.
export const Typography = StyleSheet.create({
  displayLg: { fontSize: 24, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.foreground },
  displayMd: { fontSize: 20, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.foreground },
  displaySm: { fontSize: 18, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.foreground },
  bodyLg: { fontSize: 16, fontWeight: '400', fontFamily: Fonts.regular, color: Colors.foreground },
  bodyMd: { fontSize: 16, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.foreground },
  bodySm: { fontSize: 14, fontWeight: '400', fontFamily: Fonts.regular, color: Colors.foreground },
  labelLg: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.foreground },
  labelMd: { fontSize: 12, fontWeight: '400', fontFamily: Fonts.regular, color: Colors.foreground },
  labelSm: { fontSize: 12, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.foreground },
});
