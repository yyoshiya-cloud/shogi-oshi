export * from './turso';

import * as turso from './turso';

export function isTursoActive(): boolean {
  return true;
}

export function getStorageBackendInfo(): { mode: 'turso'; label: string } {
  const target = turso.getTursoSafeTargetLabel();
  const isCloud = Boolean(
    process.env.TURSO_DATABASE_URL &&
    (process.env.TURSO_DATABASE_URL.startsWith('libsql://') || process.env.TURSO_DATABASE_URL.startsWith('https://'))
  );
  return {
    mode: 'turso',
    label: isCloud ? `Turso Cloud (${target.host})` : `Turso libSQL File (${target.dbName})`,
  };
}

export async function initDatabase(): Promise<void> {
  await turso.ensureTursoInitialized();
}

export function closeDatabase(): void {
  turso.closeTurso();
}
