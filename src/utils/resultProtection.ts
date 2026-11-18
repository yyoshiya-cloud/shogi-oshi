import type { ShogiMonthlyResult } from '../types/shogi';

/**
 * Returns true when a match result was registered via 対局手動入力機能 or CSV一括インポート機能
 * and must be protected from deletion or overwrite during official match data syncs.
 */
export function isProtectedMatchResult(r?: Partial<ShogiMonthlyResult> | null): boolean {
  if (!r) return false;
  if (r.isProtected === true) return true;
  if (r.entrySource === 'manual' || r.entrySource === 'csv') return true;
  const id = String(r.id || '');
  return id.startsWith('db-manual-') || id.startsWith('csv-');
}

function buildProtectedMatchKey(r: Partial<ShogiMonthlyResult>): string {
  const date = String(r.date || '').trim();
  const s = String(r.sente || '').replace(/\s+/g, '');
  const g = String(r.gote || '').replace(/\s+/g, '');
  const pair = [s, g].sort().join('_');
  return `${date}_${pair}`;
}

/**
 * Merges incoming official match results with existing results while guaranteeing that
 * all manual-input and CSV-imported results are never deleted or overwritten.
 */
export function mergeProtectedWithOfficialResults(
  existingResults: ShogiMonthlyResult[],
  incomingOfficialResults: ShogiMonthlyResult[]
): ShogiMonthlyResult[] {
  const existing = Array.isArray(existingResults) ? existingResults : [];
  const incoming = Array.isArray(incomingOfficialResults) ? incomingOfficialResults : [];

  const protectedEntries = existing.filter((r) => isProtectedMatchResult(r));
  if (protectedEntries.length === 0) {
    return incoming;
  }

  const protectedIds = new Set(protectedEntries.map((r) => r.id));
  const protectedBroadKeys = new Set(protectedEntries.map((r) => buildProtectedMatchKey(r)));

  const filteredIncoming = incoming.filter((item) => {
    if (!item || !item.id) return false;
    if (protectedIds.has(item.id)) return false;
    const key = buildProtectedMatchKey(item);
    if (protectedBroadKeys.has(key)) return false;
    return true;
  });

  return [...protectedEntries, ...filteredIncoming].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || ''))
  );
}
