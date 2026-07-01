# Decision: Remove react-native-unistyles

**Date:** 2026-06-28  
**Status:** Accepted

## Context

`react-native-unistyles v2` uses JSI (a native module). JSI is not available in Expo Go on Android, causing a hard crash: "Unistyles runtime is not available". The app was using it only for a single static dark theme.

## Decision

Uninstall `react-native-unistyles`. Replace with a plain TypeScript object exported from `theme/index.ts`. All components use `StyleSheet.create({ ... theme.colors.xxx ... })` directly.

## Rationale

- Only one static theme was ever used — no runtime theming needed
- A plain object has zero runtime overhead
- Works everywhere: Expo Go, development builds, web

## Consequences

- Cannot use `useStyles` hook or dynamic themes in future without re-adding a library
- All style values are resolved at module load time (acceptable for a single-theme app)
- The `theme/index.ts` object is the single source of truth for all design tokens

## Related notes

- [[Overview]] — current styling approach
