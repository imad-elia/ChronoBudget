// English strings — the "properties file". Future locales are sibling files with
// the same keys (e.g. fr.ts, ar.ts) registered in lib/i18n.ts. Keys are dotted,
// grouped by screen/feature. Values may contain {placeholders} for t(key, vars).
export const en = {
  // Dashboard
  'dashboard.totalSpent': 'Spent This Month',
  'tabs.dashboard': 'Dashboard',
  'dashboard.settings': 'Settings',
  'dashboard.limits': 'Limits',

  // Categories
  'category.needs': 'Needs',
  'category.wants': 'Wants',
  'category.savings': 'Savings',

  // Subcategories
  'subcategory.rent': 'Rent',
  'subcategory.groceries': 'Groceries',
  'subcategory.transport': 'Transport',
  'subcategory.bills': 'Bills',
  'subcategory.health': 'Health',
  'subcategory.education': 'Education',
  'subcategory.dining': 'Dining',
  'subcategory.entertainment': 'Entertainment',
  'subcategory.shopping': 'Shopping',
  'subcategory.travel': 'Travel',
  'subcategory.subscriptions': 'Subscriptions',
  'subcategory.emergencyFund': 'Emergency Fund',
  'subcategory.investment': 'Investment',
  'subcategory.retirement': 'Retirement',
  'subcategory.goal': 'Goal',

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
  'input.errAmount': 'Enter a valid amount.',
  'input.errPositive': 'Amount must be greater than zero.',
  'input.errTooLarge': 'Amount is too large.',
  'input.errSave': 'Failed to save. Please try again.',

  // History
  'history.title': 'HISTORY',
  'history.filterAll': 'All',
  'history.empty': 'No transactions yet',
  'history.emptyHintAll': 'Add your first expense on the Dashboard.',
  'history.emptyHintFiltered': 'No {category} transactions yet.',
  'history.export': 'Export',
  'history.import': 'Import',
  'history.importSuccess': 'Imported {count} transactions. Importing the same file again will add duplicates.',
  'history.importSuccessSkipped': 'Imported {count} transactions, skipped {skipped}. Importing the same file again will add duplicates.',
  'history.importEmpty': 'No valid transactions found in that file.',
  'history.importError': 'Could not read that file.',
  'history.exportDialogTitle': 'Export transactions',

  // CSV export column headers
  'csv.header.date': 'Date',
  'csv.header.time': 'Time',
  'csv.header.category': 'Category',
  'csv.header.subcategory': 'Subcategory',
  'csv.header.note': 'Note',
  'csv.header.amount': 'Amount',

  // Trends
  'trends.title': 'TRENDS',
  'trends.subtitle': 'Last 6 months',
  'trends.empty': 'Not enough data yet',
  'trends.emptyHint': 'Add transactions on the Dashboard to see your spending trends here.',

  // Settings
  'settings.title': 'Settings',
  'settings.country': 'Country',
  'settings.currency': 'Currency',
  'settings.done': 'Done',
  'settings.regionHint': 'Sets your currency and number formatting.',
  'settings.language': 'Language',
  'settings.languageHint': 'Sets the app language and smart-input keyword matching.',

  // Dashboard budget limits + recent list
  'dashboard.limitsTitle': 'BUDGET LIMITS',
  'dashboard.limitsHint': 'Set monthly spending limits per category. Leave blank to remove.',
  'dashboard.noLimit': 'No limit',
  'dashboard.saving': 'Saving…',
  'dashboard.saveLimits': 'Save Limits',
  'dashboard.recent': 'RECENT',

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
  'recurring.startDate': 'Start date',
  'recurring.startDateDefault': 'Today',

  // Accounts (where money sits) + transfers
  'settings.accounts': 'Accounts',
  'accounts.title': 'Accounts',
  'accounts.subtitle': 'Track where your money actually sits.',
  'accounts.empty': 'No accounts yet',
  'accounts.add': 'Add account',
  'accounts.namePlaceholder': 'e.g. Checking',
  'accounts.balancePlaceholder': '0.00',
  'accounts.save': 'Save account',
  'accounts.done': 'Done',
  'accounts.deleteBlocked': 'This account has transactions and can’t be deleted.',
  'accounts.transfer': 'Transfer',
  'accounts.transferTitle': 'Transfer between accounts',
  'accounts.from': 'From',
  'accounts.to': 'To',
  'accounts.notePlaceholder': 'Add a note (optional)',
  'accounts.errSameAccount': 'Choose two different accounts.',
  'accounts.errNoAccounts': 'Add at least two accounts to transfer between them.',
  'input.account': 'Account',
  'input.noAccount': 'None',

  // Savings goals (sinking funds within Savings)
  'settings.goals': 'Goals',
  'goals.title': 'Goals',
  'goals.subtitle': 'Earmark savings toward something specific.',
  'goals.empty': 'No goals yet',
  'goals.add': 'Add goal',
  'goals.namePlaceholder': 'e.g. Car repair fund',
  'goals.targetPlaceholder': 'Target amount',
  'goals.save': 'Save goal',
  'goals.deleteBlocked': 'This goal has transactions and can’t be deleted.',
  'input.goal': 'Goal',
  'input.noGoal': 'None',

  // Edit transaction
  'edit.title': 'Edit transaction',
  'edit.save': 'Save',
  'edit.delete': 'Delete',
  'edit.cancel': 'Cancel',

  // Onboarding
  'onboarding.back': 'Back',
  'onboarding.next': 'Next →',
  'onboarding.gotIt': 'Got it ✓',
  'onboarding.skipTutorial': 'Skip tutorial',
  'onboarding.countryTitle': 'Where are you?',
  'onboarding.countrySubtitle': 'We’ll set your currency and formatting. You can change it later in Settings.',
  'onboarding.countryColumn': 'Country',
  'onboarding.currencyColumn': 'Currency',
  'onboarding.countryHint': 'Highlighted country applies if you tap Continue.',
  'onboarding.continue': 'Continue',
  'onboarding.balanceTitle': 'Starting balances',
  'onboarding.balanceSubtitle': 'Optionally set how much money you currently have per category — separate from monthly spending limits, which you can set later. Leave blank to skip — you can set this later in Settings.',
  'onboarding.balanceSkip': 'Skip for now',
  'onboarding.tourWelcomeTitle': 'Welcome to ChronoBudget',
  'onboarding.tourWelcomeBody': 'Track your spending in seconds. Split your money into Needs, Wants, and Savings — and stay on top of your budget effortlessly.',
  'onboarding.tourFastTitle': 'Fast Mode',
  'onboarding.tourFastBody': 'Tap ⚡ Fast for the quickest entry — just pick a category and type an amount. Done in two taps.',
  'onboarding.tourDetailedTitle': 'Detailed Mode',
  'onboarding.tourDetailedBody': 'Switch to ☰ Detailed to add a subcategory (e.g. Groceries, Rent) and an optional note for more context.',
  'onboarding.tourLimitsTitle': 'Budget Limits',
  'onboarding.tourLimitsBody': 'Tap the sliders icon at the top of the dashboard to set monthly spending limits — separate from the starting balance you entered earlier. Each category card shows your progress.',

  // Starting balances (settings + dashboard)
  'settings.balances': 'Starting balances',
  'settings.balancesHint': 'How much money you have per category. Leave blank for none.',
  'card.remaining': 'left',
  'card.over': 'OVER',

  // Manual keywords (settings + keywords modal)
  'settings.keywords': 'My Keywords',
  'keywords.title': 'My Keywords',
  'keywords.hint': 'Teach Fast input to recognize your own words.',
  'keywords.add': 'Add keyword',
  'keywords.wordPlaceholder': 'Word (e.g. "gymbox")',
  'keywords.empty': 'No custom keywords yet.',
  'keywords.save': 'Save',
  'keywords.cancel': 'Cancel',
  'keywords.errWord': 'Enter a word.',
  'keywords.errSubcategory': 'Choose a subcategory.',

  // Not-found (bad deep link)
  'notFound.title': 'Oops!',
  'notFound.message': "This screen doesn't exist.",
  'notFound.goHome': 'Go to home screen!',
} as const;

export type StringKey = keyof typeof en;
