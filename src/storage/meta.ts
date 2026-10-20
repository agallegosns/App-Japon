import type { NihonDB } from './db';

export const META = {
  lastBackupAt: 'lastBackupAt',
  changesSinceBackup: 'changesSinceBackup',
  attachmentsSinceBackup: 'attachmentsSinceBackup',
} as const;

export async function getMeta<T>(db: NihonDB, key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(db: NihonDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Registra un cambio de datos para el aviso de copia de seguridad. Llamar dentro de una transacción que incluya `meta`. */
export async function recordChange(db: NihonDB, opts: { attachment?: boolean } = {}): Promise<void> {
  const changes = (await getMeta<number>(db, META.changesSinceBackup)) ?? 0;
  await setMeta(db, META.changesSinceBackup, changes + 1);
  if (opts.attachment) {
    const att = (await getMeta<number>(db, META.attachmentsSinceBackup)) ?? 0;
    await setMeta(db, META.attachmentsSinceBackup, att + 1);
  }
}

export interface BackupStatus {
  lastBackupAt: number | null;
  changesSinceBackup: number;
  attachmentsSinceBackup: number;
}

export async function getBackupStatus(db: NihonDB): Promise<BackupStatus> {
  return {
    lastBackupAt: (await getMeta<number>(db, META.lastBackupAt)) ?? null,
    changesSinceBackup: (await getMeta<number>(db, META.changesSinceBackup)) ?? 0,
    attachmentsSinceBackup: (await getMeta<number>(db, META.attachmentsSinceBackup)) ?? 0,
  };
}

export async function markBackupDone(db: NihonDB, at: number = Date.now()): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    await setMeta(db, META.lastBackupAt, at);
    await setMeta(db, META.changesSinceBackup, 0);
    await setMeta(db, META.attachmentsSinceBackup, 0);
  });
}

export const BACKUP_MAX_DAYS = 14;
export const BACKUP_MAX_CHANGES = 15;

/** Motivo para recomendar una copia, o null si no hace falta. */
export function backupReminder(status: BackupStatus, hasData: boolean, now: number = Date.now()): string | null {
  if (!hasData) return null;
  if (status.lastBackupAt === null) return 'Aún no has hecho ninguna copia de seguridad.';
  const days = Math.floor((now - status.lastBackupAt) / 86_400_000);
  if (days >= BACKUP_MAX_DAYS) return `Tu última copia tiene ${days} días.`;
  if (status.attachmentsSinceBackup > 0)
    return `Has añadido ${status.attachmentsSinceBackup} adjunto(s) desde la última copia.`;
  if (status.changesSinceBackup >= BACKUP_MAX_CHANGES)
    return `Hay ${status.changesSinceBackup} cambios desde la última copia.`;
  return null;
}
