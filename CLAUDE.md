# ChronoBudget — Claude Code Project Context

## Project purpose
ChronoBudget is an offline-first mobile expense tracker designed for OLED dark-mode phones.
It helps users track spending in three categories: Needs, Wants, and Savings.
Users can set monthly limits per category, review history, and keep all data fully on-device in SQLite with no backend and no account system.

## Product principles
- Simple enough to understand in minutes, not days.
- Specific to sinking funds and irregular expenses, not generic budgeting.
- Budget-aware, but not methodology-heavy.
- Account-aware, so users can track where money actually sits.
- Calm and visually premium, so the experience feels lighter than existing finance apps.

## Current stage
The project is still in its early stages.
Prioritize clean structure, maintainability, and future extensibility over premature complexity.
When making changes, prefer patterns that make later optimization and feature expansion easier.

## Tech stack
- Expo SDK 56
- React Native 0.85.3
- Expo Router (file-based tabs)
- expo-sqlite with WAL mode
- Schema versioning via `PRAGMA user_version`
- Zustand 5
- react-native-reanimated 4
- Plain `StyleSheet.create` + static `theme` object
- `@expo/vector-icons` (MaterialCommunityIcons)
- expo-linear-gradient
- react-native-safe-area-context

## Vault location
Project root:
`C:\Users\imad_\Desktop\MY\DEV\MyApps\ChronoBudget`

Obsidian vault:
`C:\Users\imad_\Desktop\MY\DEV\MyApps\ChronoBudget\vault`

## Vault map
- `vault/Projects/ChronoBudget.md` — source of truth for overview, stack, status, and next steps
- `vault/Architecture/Overview.md` — system architecture and high-level design
- `vault/Architecture/Components.md` — file-by-file and component-level explanations
- `vault/Architecture/DataFlow.md` — how data moves through the app
- `vault/Architecture/APIs.md` — SQLite schema and database functions
- `vault/Decisions/` — ADR-style technical decisions
- `vault/Issues/open-issues.md` — active issues and resolved history
- `vault/Sessions/` — chronological work-session logs

## Read-first workflow
At the start of a new session:
1. Read `vault/Projects/ChronoBudget.md`
2. Read the latest file in `vault/Sessions/`
3. Read `vault/Issues/open-issues.md`
4. Read architecture notes only if the task touches structure, database, navigation, or state management

Do not ask the user to restate information already captured in these notes.

## Working rules
- Use the vault as persistent memory to reduce token usage and avoid re-scanning the entire codebase unnecessarily.
- Prefer reading the relevant vault note before reading large parts of the repository.
- Keep implementation aligned with the product principles, especially simplicity and a calm premium feel.
- Keep the architecture easy to extend for future features such as CSV export, charts/trends, recurring transactions, and account-aware budgeting.
- Do not invent undocumented behavior; infer only from code or confirmed notes.
- When significant changes are made, update the relevant vault note.
- When a technical decision is made, add or update a note in `vault/Decisions/`.
- When a session ends, update or create a session note in `vault/Sessions/`.
- When bugs are found or resolved, update `vault/Issues/open-issues.md`.

## Coding conventions
- Prefer simple, explicit React Native patterns over abstraction-heavy solutions.
- Keep styling in plain `StyleSheet.create` and the existing static theme approach unless the user explicitly requests a redesign of the styling system.
- Respect the current SQLite approach, including WAL mode and schema migration via `PRAGMA user_version`, unless there is a clear reason to change it.
- Avoid introducing unnecessary libraries.

## Done criteria
A task is not complete until:
1. The implementation works.
2. Relevant notes in the vault are updated if the change affects architecture, issues, decisions, or project status.
3. The user can continue in a future session without having to re-explain the change.