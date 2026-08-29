/**
 * Guards the store-submission config and the "offline, on-device only" claim.
 *
 * CI has only ever built and tested the web target, so nothing verifies the
 * native config until an EAS build runs — by which point a missing
 * bundleIdentifier or an undeclared privacy manifest is a failed submission
 * rather than a failed check. These assertions are cheap and catch the
 * mechanical half of that.
 *
 * Run: node scripts/check-release-config.ts  (or via `npm run check`)
 */
import * as fs from 'fs';
import * as path from 'path';
import { projectRoot, sourcePaths, report, type Violation } from './lib/scan.ts';

const root = projectRoot();
const violations: Violation[] = [];
const appJsonPath = 'app.json';

const app = JSON.parse(fs.readFileSync(path.join(root, appJsonPath), 'utf8')).expo;

function require_(value: unknown, field: string, why: string): void {
  const missing = value === undefined || value === null || value === '';
  if (missing) {
    violations.push({ file: appJsonPath, line: 1, message: `missing expo.${field} — ${why}` });
  }
}

// ─── Store identity and versioning ───────────────────────────────────────────
require_(app.version, 'version', 'both stores reject a build with no version');
require_(app.ios?.bundleIdentifier, 'ios.bundleIdentifier', 'required to build or submit for iOS');
require_(app.ios?.buildNumber, 'ios.buildNumber', 'App Store Connect rejects a reused build number');
require_(app.android?.package, 'android.package', 'required to build or submit for Android');
require_(app.android?.versionCode, 'android.versionCode', 'Play rejects a reused versionCode');

// ─── iOS privacy manifest ────────────────────────────────────────────────────
// expo-file-system reads file timestamps and free disk space for CSV export
// and import; both are "required reason" APIs Apple wants declared.
const declaredApis: string[] = (app.ios?.privacyManifests?.NSPrivacyAccessedAPITypes ?? []).map(
  (entry: { NSPrivacyAccessedAPIType: string }) => entry.NSPrivacyAccessedAPIType,
);
for (const required of [
  'NSPrivacyAccessedAPICategoryFileTimestamp',
  'NSPrivacyAccessedAPICategoryDiskSpace',
]) {
  if (!declaredApis.includes(required)) {
    violations.push({
      file: appJsonPath,
      line: 1,
      message: `privacy manifest does not declare ${required} — expo-file-system uses it for CSV export/import`,
    });
  }
}

// ─── Config plugins ──────────────────────────────────────────────────────────
// Pinned so adding a native module without considering whether it needs a
// config plugin fails here rather than in a production build.
const EXPECTED_PLUGINS = [
  'expo-router',
  'expo-splash-screen',
  'expo-sqlite',
  'expo-sharing',
  'expo-localization',
];
const actualPlugins: string[] = (app.plugins ?? []).map((p: string | [string, unknown]) =>
  Array.isArray(p) ? p[0] : p,
);
for (const expected of EXPECTED_PLUGINS) {
  if (!actualPlugins.includes(expected)) {
    violations.push({ file: appJsonPath, line: 1, message: `expected config plugin "${expected}" is no longer listed` });
  }
}
for (const actual of actualPlugins) {
  if (!EXPECTED_PLUGINS.includes(actual)) {
    violations.push({
      file: appJsonPath,
      line: 1,
      message: `unexpected config plugin "${actual}" — add it to EXPECTED_PLUGINS once you have confirmed it is intended`,
    });
  }
}

// ─── The offline claim ───────────────────────────────────────────────────────
// "No backend, no account, data stays on your device" is a store listing
// claim, a privacy-policy claim and a data-safety declaration. Any networking
// primitive appearing in app source contradicts all three.
const NETWORK_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bfetch\s*\(/, label: 'fetch(' },
  { re: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { re: /\bnew\s+WebSocket\b/, label: 'WebSocket' },
  { re: /\bfrom\s+['"]axios['"]/, label: 'axios import' },
  { re: /\bnavigator\.sendBeacon\b/, label: 'sendBeacon' },
];

for (const file of sourcePaths()) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((text, index) => {
    if (text.trimStart().startsWith('//') || text.trimStart().startsWith('*')) return;
    for (const { re, label } of NETWORK_PATTERNS) {
      if (re.test(text)) {
        violations.push({
          file: rel,
          line: index + 1,
          message: `${label} in app source contradicts the published "data never leaves your device" claim`,
        });
      }
    }
  });
}

report('release config and offline claim', violations, {
  hint: 'See vault/Decisions/store-submission-readiness.md.',
});
