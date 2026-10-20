import { newId } from '../models/id';
import type { Attachment, AttachmentKind } from '../models/types';
import type { NihonDB } from './db';
import { recordChange } from './meta';

export const MAX_ATTACHMENT_BYTES = 60 * 1024 * 1024;

export function inferKind(mime: string): AttachmentKind | null {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

export async function addAttachment(
  db: NihonDB,
  bookingId: string,
  blob: Blob,
  name: string,
  kind?: AttachmentKind,
): Promise<Attachment> {
  const resolved = kind ?? inferKind(blob.type);
  if (!resolved) throw new Error('Tipo de archivo no admitido. Usa PDF o imágenes.');
  if (resolved === 'pdf' && blob.type !== 'application/pdf') throw new Error('El archivo no es un PDF.');
  if (resolved !== 'pdf' && !blob.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  if (blob.size === 0) throw new Error('El archivo está vacío.');
  if (blob.size > MAX_ATTACHMENT_BYTES)
    throw new Error(`El archivo supera ${MAX_ATTACHMENT_BYTES / 1048576} MB.`);
  const attachment: Attachment = {
    id: newId(),
    bookingId,
    kind: resolved,
    name: name.trim() || 'archivo',
    mime: blob.type,
    size: blob.size,
    blob,
    createdAt: Date.now(),
  };
  await db.transaction('rw', db.attachments, db.bookings, db.meta, async () => {
    if (!(await db.bookings.get(bookingId))) throw new Error('La reserva no existe.');
    await db.attachments.add(attachment);
    await recordChange(db, { attachment: true });
  });
  return attachment;
}

export async function listAttachments(db: NihonDB, bookingId: string): Promise<Attachment[]> {
  const list = await db.attachments.where('bookingId').equals(bookingId).toArray();
  return list.sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name, 'es'));
}

export async function setAttachmentKind(db: NihonDB, id: string, kind: AttachmentKind): Promise<void> {
  await db.transaction('rw', db.attachments, db.meta, async () => {
    const att = await db.attachments.get(id);
    if (!att) throw new Error('El adjunto no existe.');
    if (kind === 'pdf' && att.mime !== 'application/pdf') throw new Error('Solo un PDF puede marcarse como PDF.');
    if (kind !== 'pdf' && !att.mime.startsWith('image/')) throw new Error('Solo una imagen puede ser QR o imagen.');
    await db.attachments.update(id, { kind });
    await recordChange(db);
  });
}

export async function deleteAttachment(db: NihonDB, id: string): Promise<void> {
  await db.transaction('rw', db.attachments, db.meta, async () => {
    await db.attachments.delete(id);
    await recordChange(db);
  });
}
