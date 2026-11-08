import { ShogiMonthlyResult } from '../types/shogi';
import supplementMatchesJson from '../data/specialMatchesSupplement.json';

const supplementMatches = supplementMatchesJson as ShogiMonthlyResult[];

// Map grouped by month (YYYYMM)
const supplementByMonth = new Map<string, ShogiMonthlyResult[]>();
for (const match of supplementMatches) {
  const m = match.month || match.date.replace(/[^0-9]/g, '').slice(0, 6);
  if (!supplementByMonth.has(m)) {
    supplementByMonth.set(m, []);
  }
  supplementByMonth.get(m)!.push(match);
}

/**
 * Normalizes tournament names (e.g., "N H K杯" -> "NHK杯").
 */
export function cleanTournamentName(rawName?: string): string {
  if (!rawName) return '公式戦';
  let t = rawName.trim();
  if (/N\s*H\s*K杯/i.test(t) || /Ｎ\s*Ｈ\s*Ｋ杯/.test(t)) {
    t = t.replace(/N\s*H\s*K杯/gi, 'NHK杯').replace(/Ｎ\s*Ｈ\s*Ｋ杯/g, 'NHK杯');
  }
  return t;
}

/**
 * Returns any supplemental special tournament matches (NHK Cup finals, Ginga-sen, etc.)
 * available for a given month (YYYYMM).
 */
export function getSupplementMatchesForMonth(month: string): ShogiMonthlyResult[] {
  const normalizedMonth = month.replace(/[^0-9]/g, '');
  return supplementByMonth.get(normalizedMonth) || [];
}

/**
 * Enriches official monthly results by safely merging missing special tournament matches
 * (such as NHK Cup finals and Ginga-sen finals) that are not provided in official monthly listings.
 * Also ensures tournament name consistency (NHK杯, etc.).
 */
export function enrichMonthlyResultsWithSupplements(
  month: string,
  officialResults: ShogiMonthlyResult[]
): ShogiMonthlyResult[] {
  const normalizedMonth = month.replace(/[^0-9]/g, '');
  const supplements = getSupplementMatchesForMonth(normalizedMonth);

  // Normalize existing tournament names
  const cleanOfficial = (officialResults || []).map((r) => {
    if (r.tournament && (/N\s*H\s*K杯/i.test(r.tournament) || /Ｎ\s*Ｈ\s*Ｋ杯/.test(r.tournament))) {
      return { ...r, tournament: cleanTournamentName(r.tournament) };
    }
    return r;
  });

  if (supplements.length === 0) {
    return cleanOfficial;
  }

  // Build an index of existing matches to prevent duplicates
  // Keys: `${date}_${sortedSenteGote}_${tournament}`
  const existingKeys = new Set<string>();
  for (const r of cleanOfficial) {
    const pKey = [r.sente.replace(/\s+/g, ''), r.gote.replace(/\s+/g, '')].sort().join('_');
    const tKey = cleanTournamentName(r.tournament);
    existingKeys.add(`${r.date}_${pKey}_${tKey}`);
    // Also add looser key without tournament if date and players match
    existingKeys.add(`${r.date}_${pKey}`);
  }

  const toAdd: ShogiMonthlyResult[] = [];
  for (const supp of supplements) {
    const pKey = [supp.sente.replace(/\s+/g, ''), supp.gote.replace(/\s+/g, '')].sort().join('_');
    const tKey = cleanTournamentName(supp.tournament);
    const specificKey = `${supp.date}_${pKey}_${tKey}`;
    const broadKey = `${supp.date}_${pKey}`;

    if (!existingKeys.has(specificKey) && !existingKeys.has(broadKey)) {
      toAdd.push(supp);
      existingKeys.add(specificKey);
      existingKeys.add(broadKey);
    }
  }

  const merged = [...cleanOfficial, ...toAdd];
  // Sort descending by date
  merged.sort((a, b) => b.date.localeCompare(a.date));
  return merged;
}

/**
 * Batch-enriches a multi-month result record (e.g. 202504..202703).
 */
export function enrichAllResultsWithSupplements(
  resultsRecord: Record<string, ShogiMonthlyResult[]>
): Record<string, ShogiMonthlyResult[]> {
  const enriched: Record<string, ShogiMonthlyResult[]> = { ...resultsRecord };

  // Enrich all months present in supplementByMonth
  for (const [month, supps] of supplementByMonth.entries()) {
    const current = enriched[month] || [];
    enriched[month] = enrichMonthlyResultsWithSupplements(month, current);
  }

  return enriched;
}
