import dotenv from 'dotenv';
import {
  isTursoConfigured,
  getTursoSafeTargetLabel,
  pushLocalSqliteToTurso,
  getDatabaseOverview,
  closeTurso,
} from '../src/db/turso';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

async function main() {
  if (!isTursoConfigured()) {
    console.error('Error: TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) must be set in environment variables.');
    process.exit(1);
  }

  const target = getTursoSafeTargetLabel();
  console.log(`[Turso Migration] Connecting to ${target.host} (${target.dbName})...`);

  const summary = await pushLocalSqliteToTurso();
  console.log('[Turso Migration] Migration completed:', summary);

  const overview = await getDatabaseOverview();
  console.log('[Turso Migration] Verified remote counts:', overview.counts);
  closeTurso();
}

main().catch((err) => {
  console.error('[Turso Migration] Failed:', err?.message || err);
  closeTurso();
  process.exit(1);
});
