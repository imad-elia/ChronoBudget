export const theme = {
  colors: {
    bgPrimary: '#000000',
    bgSecondary: '#0A0A0F',
    bgTertiary: '#0F0F1A',

    surface: '#111827',
    surfaceRaised: '#1A2035',
    glassBorder: 'rgba(255,255,255,0.08)',
    glassHighlight: 'rgba(255,255,255,0.04)',

    neonGreen: '#00FF87',
    neonPink: '#FF2D78',
    neonBlue: '#00BFFF',

    glowGreen: 'rgba(0,255,135,0.15)',
    glowPink: 'rgba(255,45,120,0.15)',
    glowBlue: 'rgba(0,191,255,0.15)',

    textPrimary: '#F8F9FF',
    textSecondary: '#8B92A5',
    textMuted: '#4A5168',

    border: 'rgba(255,255,255,0.06)',
    divider: 'rgba(255,255,255,0.04)',
    overlay: 'rgba(0,0,0,0.72)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    full: 9999,
  },

  typography: {
    displayLarge:  { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1.5 },
    displayMedium: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1 },
    headingLarge:  { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.5 },
    headingMedium: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.25 },
    bodyLarge:     { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0 },
    bodyMedium:    { fontSize: 14, fontWeight: '400' as const, letterSpacing: 0.1 },
    labelLarge:    { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.8 },
    labelSmall:    { fontSize: 10, fontWeight: '600' as const, letterSpacing: 1.2 },
  },
} as const;

export type AppTheme = typeof theme;
