import { scrapeAllActivePlayers } from '../src/services/playerSyncService';
import { scrapeMatchPlan, scrapeIncrementalResults } from '../src/services/matchSyncService';
import { enrichAllResultsWithSupplements } from '../src/services/matchSupplementService';
import { updateMatchStatsData } from '../src/utils/yearRecordsGenerator';
import { saveStoredFiscalResults } from '../src/utils/storage';

/**
 * Standalone Shogi Data Synchronization Worker (Background Worker / Cron Task).
 * Automatically scrapes official shogi.or.jp & shogidata.info for player profiles,
 * match schedules, and monthly game results, enriches with special tournament supplements,
 * and updates local cache & Firestore.
 */
async function runSyncWorker() {
  console.log('==================================================');
  console.log('[Shogi Sync Worker] Starting automated data synchronization...');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('==================================================');

  try {
    // 1. Sync Players & Profiles
    console.log('[1/3] Scraping and syncing player profiles from official Shogi Federation & LPSA...');
    const playerResult = await scrapeAllActivePlayers(true);
    console.log(`-> Successfully synced ${playerResult.count} players.`);

    // 2. Sync Match Schedules (Official upcoming match plans)
    console.log('[2/3] Scraping official match schedules (shogidata.info / shogi.or.jp)...');
    const scheduleResult = await scrapeMatchPlan(true);
    console.log(`-> Successfully synced ${scheduleResult.count} upcoming match schedules.`);

    // 3. Sync Monthly Match Results (Incremental / Full 2025-2026 results)
    console.log('[3/3] Scraping official monthly match results and applying TV tournament supplements...');
    const incrementalResult = await scrapeIncrementalResults({}, true);
    const enrichedResults = enrichAllResultsWithSupplements(incrementalResult.merged);

    // Update stats and save locally / persist
    updateMatchStatsData(enrichedResults);
    saveStoredFiscalResults(enrichedResults);

    console.log('==================================================');
    console.log('[Shogi Sync Worker] Data synchronization completed successfully!');
    console.log(`Updated months: ${incrementalResult.updatedMonths.join(', ') || 'None'}`);
    console.log('==================================================');
    process.exit(0);
  } catch (error: any) {
    console.error('==================================================');
    console.error('[Shogi Sync Worker] Error during synchronization:', error?.message || error);
    console.error('==================================================');
    process.exit(1);
  }
}

runSyncWorker();
