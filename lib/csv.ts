import { detectCategory } from './detectCategory';
import type { Category } from '../store/useBudgetStore';

const HEADER = 'Date,Time,Category,Subcategory,Note,Amount';

export interface ParsedCsvRow {
  amount: number;
  category: Category;
  subcategory: string;
  note: string;
  timestamp: number;
}

export interface ParseCsvResult {
  rows: ParsedCsvRow[];
  skipped: number;
}

const VALID_CATEGORIES: Category[] = ['needs', 'wants', 'savings'];

/** Splits one CSV line into fields, honoring double-quoted fields with escaped `""`. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Parses a CSV exported by this app's own History → Export
 * (Date,Time,Category,Subcategory,Note,Amount — see app/(tabs)/history.tsx).
 * This is a round-trip parser, not a generic bank-CSV importer: rows that
 * don't fit the expected shape are skipped and counted rather than aborting
 * the whole import. A missing/invalid Category cell falls back to the smart
 * classifier on the Note text, same as a fresh manual entry would.
 */
export function parseCsv(text: string): ParseCsvResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], skipped: 0 };

  // Tolerate a missing/mismatched header — just skip a line that looks like one.
  const startIndex = lines[0].trim() === HEADER ? 1 : 0;

  const rows: ParsedCsvRow[] = [];
  let skipped = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    if (fields.length !== 6) { skipped++; continue; }
    const [date, time, categoryCell, subcategory, note, amountCell] = fields;

    const timestamp = new Date(`${date}T${time}:00`).getTime();
    if (isNaN(timestamp)) { skipped++; continue; }

    const amount = parseFloat(amountCell);
    if (isNaN(amount) || amount <= 0) { skipped++; continue; }

    let category: Category;
    let resolvedSubcategory = subcategory;
    const cell = categoryCell.trim().toLowerCase();
    if ((VALID_CATEGORIES as string[]).includes(cell)) {
      category = cell as Category;
    } else {
      const detection = detectCategory(note || subcategory);
      category = detection.category;
      if (!resolvedSubcategory) resolvedSubcategory = detection.subcategory;
    }

    rows.push({ amount, category, subcategory: resolvedSubcategory, note, timestamp });
  }

  return { rows, skipped };
}
