/**
 * Checks the theme's text colours against WCAG AA contrast minimums.
 *
 * The palette is a deliberately low-glare OLED dark theme, which puts several
 * greys close to the floor. One has already shipped too faint to read: the
 * BentoCard "Remaining" line used textMuted at 10px and was invisible against
 * the card gradient until it was raised to textSecondary.
 *
 * A script can only judge a foreground against a flat background, so this
 * checks each text token against the app's real surface colours. Text over
 * gradients and translucent overlays still needs a human eye — see T-A11Y-03.
 *
 * Run: node scripts/check-contrast.ts  (or via `npm run check`)
 */
import { theme } from '../theme/index.ts';
import { report, type Violation } from './lib/scan.ts';

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg: string, bg: string): number {
  const a = luminance(parseHex(fg));
  const b = luminance(parseHex(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const colors = theme.colors as Record<string, string>;

interface Pair {
  fg: string;
  bg: string;
  /** WCAG AA floor for the size this token is used at: 4.5 body, 3.0 large. */
  min: number;
  where: string;
  /**
   * Set for pairs that are known to fail and have been accepted for now. These
   * report as warnings instead of failing the build — and if one later starts
   * passing, the check fails to make you remove the marker, so the pair goes
   * back to being protected.
   */
  known?: string;
}

/** Pairs that actually occur in the UI. */
const PAIRS: Pair[] = [
  { fg: 'textPrimary',   bg: 'bgPrimary',   min: 4.5, where: 'body copy on the app background' },
  { fg: 'textPrimary',   bg: 'bgSecondary', min: 4.5, where: 'body copy on bottom sheets' },
  { fg: 'textPrimary',   bg: 'surface',     min: 4.5, where: 'body copy on cards and inputs' },
  { fg: 'textSecondary', bg: 'bgPrimary',   min: 4.5, where: 'secondary copy on the app background' },
  { fg: 'textSecondary', bg: 'surface',     min: 4.5, where: 'secondary copy on cards (BentoCard "Remaining")' },

  // textMuted (#4A5168) fails AA on both grounds. Raising it changes the calm,
  // low-glare look the palette exists for, so this is a product decision, not
  // a mechanical fix — baselined rather than silently corrected or silently
  // ignored. Tracked in vault/Issues/open-issues.md; drop `known` once decided.
  { fg: 'textMuted', bg: 'bgSecondary', min: 4.5, where: 'hints and empty states on sheets', known: 'pending design decision' },
  { fg: 'textMuted', bg: 'surface',     min: 4.5, where: 'placeholders inside inputs',       known: 'pending design decision' },
];

const violations: Violation[] = [];
const accepted: Violation[] = [];

for (const { fg, bg, min, where, known } of PAIRS) {
  if (!colors[fg] || !colors[bg]) {
    violations.push({
      file: 'theme/index.ts',
      line: 1,
      message: `contrast pair references unknown token "${!colors[fg] ? fg : bg}" — update scripts/check-contrast.ts`,
    });
    continue;
  }

  const ratio = contrast(colors[fg], colors[bg]);

  if (ratio < min) {
    const entry: Violation = {
      file: 'theme/index.ts',
      line: 1,
      message: `${fg} on ${bg} is ${ratio.toFixed(2)}:1, below the ${min}:1 AA floor — ${where}`,
    };
    (known ? accepted : violations).push(entry);
  } else if (known) {
    violations.push({
      file: 'theme/index.ts',
      line: 1,
      message: `${fg} on ${bg} now passes at ${ratio.toFixed(2)}:1 — remove its "known" marker so a regression fails the build`,
    });
  }
}

report('theme contrast (WCAG AA)', violations, {
  hint: 'Raise the token, or use a larger/bolder style so the 3:1 large-text floor applies.',
});

if (accepted.length > 0) {
  report('theme contrast — accepted, awaiting a decision', accepted, { warnOnly: true });
}
