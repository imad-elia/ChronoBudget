# Data Flow

## App startup

```
app/_layout.tsx mounts
  └─ app/(tabs)/index.tsx mounts
       └─ initDb()
            ├─ opens chronobudget.db
            ├─ runs PRAGMA user_version migrations (v1→v3)
            └─ returns
       └─ getSetting('onboarding_complete')
            ├─ null  → setShowOnboarding(true)
            └─ '1'   → skip
       └─ fetchCategoryTotals()  → setTotals()
       └─ fetchRecentTransactions(30) → setTransactions()
       └─ fetchLimits() → useBudgetStore.getState().setLimits()
```

## Adding a transaction (Fast mode)

```
User: picks category chip, types amount, taps Add
  └─ ExpenseInput.handleSubmit()
       └─ insertTransaction(amount, category, '', '')
            └─ SQLite INSERT into transactions
       └─ triggerRefresh()  ← increments Zustand refreshCounter
            └─ DashboardScreen useEffect fires
                 ├─ fetchCategoryTotals() → updates totals state
                 └─ fetchRecentTransactions() → updates list state
```

## Adding a transaction (Detailed mode)

Same as Fast mode but `insertTransaction(amount, category, subcategory, note)` includes the resolved subcategory (predefined chip value or custom text).

## Deleting a transaction

```
User taps ✕ on a TransactionRow or HistoryRow
  └─ deleteTransaction(id)
       └─ SQLite DELETE FROM transactions WHERE id = ?
  └─ triggerRefresh()
       └─ Both Dashboard and History useEffects re-fetch
          (History watches refreshCounter from Zustand)
```

## Setting budget limits

```
User opens LimitsModal, edits values, taps Save
  └─ setLimit(cat, amount) × 3
       └─ SQLite UPSERT into budget_limits
          (DELETE if amount ≤ 0)
  └─ fetchLimits() → useBudgetStore.setLimits()
  └─ triggerRefresh() → BentoCards re-render with new ratios
```

## Onboarding persistence

```
OnboardingOverlay.handleDone()
  └─ setSetting('onboarding_complete', '1')
       └─ SQLite UPSERT into app_settings
  └─ onDone() → setShowOnboarding(false)
```

## Input mode persistence

```
ExpenseInput.switchMode(m)
  └─ setSetting('input_mode', m)
       └─ SQLite UPSERT into app_settings
  — on next mount:
  └─ getSetting('input_mode') → setMode()
```

## Related notes

- [[Components]] — which component owns each step
- [[APIs]] — SQLite schema details
