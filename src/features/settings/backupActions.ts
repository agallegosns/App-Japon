import { backupFileName, exportBackup } from '../../storage/backup';
import { getDb } from '../../storage/db';
import { markBackupDone } from '../../storage/meta';

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Exporta la copia completa y la entrega con la hoja de compartir del sistema
 * (Guardar en Archivos / iCloud Drive / AirDrop). Si no hay hoja de compartir, la descarga.
 */
export async function exportAndShare(): Promise<ExportOutcome> {
  const db = getDb();
  const now = new Date();
  const { bytes } = await exportBackup(db, now);
  const file = new File([bytes.slice().buffer as ArrayBuffer], backupFileName(now), { type: 'application/zip' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia de Nihon Trip' });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      throw e;
    }
    await markBackupDone(db, now.getTime());
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  await markBackupDone(db, now.getTime());
  return 'downloaded';
}
