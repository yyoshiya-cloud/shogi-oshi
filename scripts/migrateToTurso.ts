import dotenv from 'dotenv';
import {
  getTursoSafeTargetLabel,
  ensureTursoInitialized,
  getDatabaseOverview,
  closeTurso,
} from '../src/db/turso';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

async function main() {
  const target = getTursoSafeTargetLabel();
  console.log(`[Turso Check] Connecting to ${target.host} (${target.dbName})...`);

  await ensureTursoInitialized();
  const overview = await getDatabaseOverview();
  console.log('[Turso Check] Verified database counts:', overview.counts);
  closeTurso();
}

main().catch((err) => {
  console.error('[Turso Check] Failed:', err?.message || err);
  closeTurso();
  process.exit(1);
});
