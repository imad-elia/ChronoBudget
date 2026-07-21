// English strings — the "properties file". Future locales are sibling files with
// the same keys (e.g. fr.ts, ar.ts) registered in lib/i18n.ts. Keys are dotted,
// grouped by screen/feature. Values may contain {placeholders} for t(key, vars).
export const en = {
  // Dashboard
  'dashboard.totalSpent': 'Total Spent',
  'dashboard.settings': 'Settings',
  'dashboard.limits': 'Limits',

  // Categories
  'category.needs': 'Needs',
  'category.wants': 'Wants',
  'category.savings': 'Savings',

  // Expense input
  'input.fast': 'Fast',
  'input.detailed': 'Detailed',
  'input.amountPlaceholder': '0.00',
  'input.smartPlaceholder': 'e.g. 15 coffee',
  'input.notePlaceholder': 'Add a note (optional)',
  'input.subcategoryPlaceholder': 'Subcategory name',
  'input.custom': 'Custom',
  'input.add': 'Add',
  'input.goesTo': 'goes to',
  'input.change': 'change',
  'input.errAmount': 'Enter a valid amount.',
  'input.errPositive': 'Amount must be greater than zero.',
  'input.errTooLarge': 'Amount is too large.',
  'input.errSave': 'Failed to save. Please try again.',

  // History
  'history.title': 'HISTORY',
  'history.filterAll': 'All',
  'history.empty': 'No transactions yet',
  'history.export': 'Export',

  // Trends
  'trends.title': 'TRENDS',
  'trends.empty': 'Not enough data yet',

  // Settings
  'settings.title': 'Settings',
  'settings.country': 'Country',
  'settings.currency': 'Currency',
  'settings.done': 'Done',
  'settings.regionHint': 'Sets your currency and number formatting.',

  // Recurring
  'recurring.title': 'Recurring',
  'recurring.subtitle': 'Rules post automatically each period. You can delete any posted transaction.',
  'recurring.add': 'Add recurring',
  'recurring.empty': 'No recurring rules yet',
  'recurring.weekly': 'Weekly',
  'recurring.monthly': 'Monthly',
  'recurring.yearly': 'Yearly',
  'recurring.frequency': 'Frequency',
  'recurring.next': 'next {date}',
  'recurring.amountPlaceholder': '0.00',
  'recurring.notePlaceholder': 'Add a note (optional)',
  'recurring.save': 'Save rule',
  'recurring.done': 'Done',

  // Edit transaction
  'edit.title': 'Edit transaction',
  'edit.save': 'Save',
  'edit.delete': 'Delete',
  'edit.cancel': 'Cancel',

  // Onboarding
  'onboarding.countryTitle': 'Where are you?',
  'onboarding.countrySubtitle': 'We’ll set your currency and formatting. You can change it later in Settings.',
  'onboarding.countryColumn': 'Country',
  'onboarding.currencyColumn': 'Currency',
  'onboarding.countryHint': 'Highlighted country applies if you tap Continue.',
  'onboarding.continue': 'Continue',
  'onboarding.balanceTitle': 'Starting balances',
  'onboarding.balanceSubtitle': 'Optionally set how much money you currently have per category. Leave blank to skip — you can set this later in Settings.',
  'onboarding.balanceSkip': 'Skip for now',

  // Starting balances (settings + dashboard)
  'settings.balances': 'Starting balances',
  'settings.balancesHint': 'How much money you have per category. Leave blank for none.',
  'card.remaining': 'left',
} as const;

export type StringKey = keyof typeof en;
