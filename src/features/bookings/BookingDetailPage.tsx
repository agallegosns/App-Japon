import {
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Languages,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  QrCode,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDateShort, formatLdt } from '../../models/datetime';
import { ATTACHMENT_KIND_LABEL, BOOKING_STATUS_LABEL, CATEGORY_LABEL } from '../../models/labels';
import type { Attachment, AttachmentKind, Booking } from '../../models/types';
import { bookingWarnings } from '../../models/warnings';
import { addAttachment, deleteAttachment, inferKind, listAttachments, setAttachmentKind } from '../../storage/attachments';
import { deleteBooking, getBooking } from '../../storage/bookings';
import { getDb } from '../../storage/db';
import { formatBytes } from '../../storage/persistence';
import { useLiveQuery } from '../../storage/useLiveQuery';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button, LinkButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { copyText } from '../../ui/copy';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { ErrorState, LoadingState, errorMessage } from '../../ui/States';
import { StatusTag } from '../../ui/StatusTag';
import { useToast } from '../../ui/Toast';
import { AttachmentViewer } from './AttachmentViewer';
import { CategoryIcon, STATUS_TONE } from './categoryIcon';
import { JapaneseAddressView } from './JapaneseAddressView';

async function load(id: string) {
  const db = getDb();
  const booking = await getBooking(db, id);
  if (!booking) return null;
  const [attachments, activities] = await Promise.all([
    listAttachments(db, id),
    db.activities.where('bookingId').equals(id).toArray(),
  ]);
  return { booking, attachments, activities: activities.sort((a, b) => a.date.localeCompare(b.date)) };
}

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const result = useLiveQuery(() => load(id), [id]);
  return (
    <>
      {result.status === 'loading' && (
        <>
          <PageHeader title="Reserva" back="/reservas" />
          <LoadingState />
        </>
      )}
      {result.status === 'error' && (
        <>
          <PageHeader title="Reserva" back="/reservas" />
          <ErrorState error={result.error} />
        </>
      )}
      {result.status === 'ok' && result.data === null && (
        <>
          <PageHeader title="Reserva" back="/reservas" />
          <ErrorState title="Reserva no encontrada" error="Puede que se haya eliminado." />
        </>
      )}
      {result.status === 'ok' && result.data && <Detail {...result.data} />}
    </>
  );
}

function Detail({ booking: b, attachments, activities }: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const navigate = useNavigate();
  const toast = useToast();
  const [showJa, setShowJa] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const warnings = bookingWarnings(b);

  const copy = async (text: string, what: string) => {
    try {
      await copyText(text);
      toast.show(`${what} copiado`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title={b.name}
        subtitle={CATEGORY_LABEL[b.category]}
        back="/reservas"
        actions={<LinkButton to={`/reservas/${b.id}/editar`} variant="ghost" icon={<Pencil size={22} />} label="Editar reserva" />}
      />
      <div className="row-wrap">
        <span className="booking-icon">
          <CategoryIcon category={b.category} />
        </span>
        <StatusTag tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</StatusTag>
      </div>

      {warnings.length > 0 && (
        <Notice tone="warning">
          {warnings.join(' · ')}. <Link to={`/reservas/${b.id}/editar`}>Completar</Link>
        </Notice>
      )}

      {b.addressJa && (
        <Button variant="primary" block icon={<Languages size={20} />} onClick={() => setShowJa(true)}>
          Mostrar dirección en japonés
        </Button>
      )}

      <Card title="Fechas">
        <dl className="kv">
          <DateRows booking={b} />
        </dl>
      </Card>

      {(b.address || b.addressJa || b.phone || b.contact) && (
        <Card title="Lugar y contacto">
          <div className="stack">
            {b.address && (
              <div className="stack" style={{ gap: 'var(--sp-1)' }}>
                <span className="muted small">Dirección</span>
                <p className="break">{b.address}</p>
                <Button small icon={<Copy size={16} />} onClick={() => copy(b.address, 'Dirección')}>
                  Copiar dirección
                </Button>
              </div>
            )}
            {b.addressJa && (
              <div className="stack" style={{ gap: 'var(--sp-1)' }}>
                <span className="muted small">Dirección en japonés</span>
                <p lang="ja" className="break" style={{ fontSize: 'var(--fs-lg)' }}>
                  {b.addressJa}
                </p>
                <Button small icon={<Copy size={16} />} onClick={() => copy(b.addressJa, 'Dirección en japonés')}>
                  Copiar dirección en japonés
                </Button>
              </div>
            )}
            {b.phone && (
              <div className="spread">
                <span>
                  <span className="muted small" style={{ display: 'block' }}>
                    Teléfono
                  </span>
                  {b.phone}
                </span>
                <a className="btn btn-secondary btn-sm" href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>
                  <Phone size={16} aria-hidden="true" /> Llamar
                </a>
              </div>
            )}
            {b.contact && (
              <div>
                <span className="muted small" style={{ display: 'block' }}>
                  Contacto
                </span>
                {b.contact}
              </div>
            )}
          </div>
        </Card>
      )}

      {(b.confirmationCode || b.price) && (
        <Card title="Reserva">
          <div className="stack">
            {b.confirmationCode && (
              <div className="spread">
                <span>
                  <span className="muted small" style={{ display: 'block' }}>
                    Localizador
                  </span>
                  <span className="mono" style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, letterSpacing: '0.06em' }}>
                    {b.confirmationCode}
                  </span>
                </span>
                <Button small icon={<Copy size={16} />} onClick={() => copy(b.confirmationCode, 'Localizador')}>
                  Copiar
                </Button>
              </div>
            )}
            {b.price && (
              <div>
                <span className="muted small" style={{ display: 'block' }}>
                  Precio
                </span>
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: b.price.currency }).format(b.price.amount)}
              </div>
            )}
          </div>
        </Card>
      )}

      {b.notes && (
        <Card title="Notas">
          <p className="break" style={{ whiteSpace: 'pre-wrap' }}>
            {b.notes}
          </p>
        </Card>
      )}

      {b.links.length > 0 && (
        <Card title="Enlaces">
          <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {b.links.map((l, i) => (
              <li key={i}>
                <a className="list-item" href={l.url} target="_blank" rel="noopener noreferrer">
                  <span className="grow break">{l.label || l.url}</span>
                  <ExternalLink size={18} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ marginTop: 'var(--sp-2)' }}>
            Los enlaces externos necesitan conexión.
          </p>
        </Card>
      )}

      <Attachments booking={b} attachments={attachments} />

      {activities.length > 0 && (
        <Card title="En el itinerario">
          <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {activities.map((a) => (
              <li key={a.id}>
                <Link className="list-item" to={`/itinerario?fecha=${a.date}`}>
                  <span className="grow">
                    {a.title}
                    <span className="muted small" style={{ display: 'block' }}>
                      {formatDateShort(a.date)}
                      {a.startTime ? `, ${a.startTime}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Button variant="secondary" block icon={<Trash2 size={18} />} onClick={() => setConfirmDelete(true)} style={{ color: 'var(--c-danger)' }}>
        Eliminar reserva
      </Button>

      {showJa && <JapaneseAddressView name={b.name} address={b.addressJa} onClose={() => setShowJa(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar esta reserva?"
        message={
          <>
            Se borrarán «{b.name}» y sus {attachments.length} adjunto(s). Las actividades asociadas se mantienen, sin
            reserva. No se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await deleteBooking(getDb(), b.id);
            toast.show('Reserva eliminada');
            navigate('/reservas', { replace: true });
          } catch (e) {
            toast.error(errorMessage(e));
            setConfirmDelete(false);
          }
        }}
      />
    </>
  );
}

function DateRows({ booking: b }: { booking: Booking }) {
  const rows: [string, string][] = [];
  if (b.category === 'alojamiento') {
    rows.push(['Check-in', formatLdt(b.checkIn)], ['Check-out', formatLdt(b.checkOut)]);
    if (b.arrival) rows.push(['Llegada prevista', formatLdt(b.arrival)]);
  } else {
    const isTransport = b.category === 'vuelo' || b.category === 'transporte';
    rows.push([isTransport ? 'Salida' : 'Fecha', formatLdt(b.start)]);
    if (b.arrival || isTransport) rows.push([isTransport ? 'Llegada' : 'Llegada prevista', formatLdt(b.arrival)]);
  }
  return (
    <>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </>
  );
}

const KIND_ICON: Record<AttachmentKind, typeof FileText> = { pdf: FileText, image: ImageIcon, code: QrCode };

function Attachments({ booking, attachments }: { booking: Booking; attachments: Attachment[] }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const [menu, setMenu] = useState<Attachment | null>(null);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);
  const [pendingKind, setPendingKind] = useState<'image' | 'code'>('image');

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        const inferred = inferKind(file.type);
        const kind = inferred === 'image' ? pendingKind : (inferred ?? undefined);
        await addAttachment(getDb(), booking.id, file, file.name, kind);
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      }
    }
    setBusy(false);
    if (ok) toast.show(ok === 1 ? 'Adjunto guardado' : `${ok} adjuntos guardados`);
    if (input.current) input.current.value = '';
  };

  const pick = (kind: 'image' | 'code') => {
    setPendingKind(kind);
    input.current?.click();
  };

  return (
    <Card title="Adjuntos" action={<StatusTag icon={<Paperclip size={12} />}>{attachments.length}</StatusTag>}>
      <div className="stack">
        {attachments.length === 0 && <p className="muted small">Sin adjuntos. Añade el PDF de la reserva, capturas o el código QR.</p>}
        {attachments.length > 0 && (
          <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {attachments.map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <li key={a.id} className="row" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <button type="button" className="list-item" style={{ borderTop: 0 }} onClick={() => setViewing(a)}>
                    <Icon size={22} aria-hidden="true" />
                    <span className="grow">
                      <span className="break">{a.name}</span>
                      <span className="muted small" style={{ display: 'block' }}>
                        {ATTACHMENT_KIND_LABEL[a.kind]} · {formatBytes(a.size)}
                      </span>
                    </span>
                  </button>
                  <Button variant="ghost" icon={<MoreHorizontal size={20} />} label={`Opciones de ${a.name}`} onClick={() => setMenu(a)} />
                </li>
              );
            })}
          </ul>
        )}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/*"
          multiple
          hidden
          onChange={(e) => void onFiles(e.target.files)}
        />
        <div className="input-row">
          <Button icon={<Paperclip size={18} />} disabled={busy} onClick={() => pick('image')}>
            PDF o imagen
          </Button>
          <Button icon={<QrCode size={18} />} disabled={busy} onClick={() => pick('code')}>
            QR / código
          </Button>
        </div>
        {busy && <p className="muted small">Guardando…</p>}
      </div>

      {viewing && <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />}

      <BottomSheet open={!!menu} title={menu?.name ?? ''} onClose={() => setMenu(null)}>
        {menu && (
          <div className="stack">
            {menu.kind !== 'pdf' && (
              <Button
                block
                icon={menu.kind === 'code' ? <ImageIcon size={18} /> : <QrCode size={18} />}
                onClick={async () => {
                  try {
                    await setAttachmentKind(getDb(), menu.id, menu.kind === 'code' ? 'image' : 'code');
                    toast.show('Tipo cambiado');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                  setMenu(null);
                }}
              >
                {menu.kind === 'code' ? 'Tratar como imagen normal' : 'Tratar como QR / código de barras'}
              </Button>
            )}
            <Button
              block
              icon={<Trash2 size={18} />}
              style={{ color: 'var(--c-danger)' }}
              onClick={() => {
                setToDelete(menu);
                setMenu(null);
              }}
            >
              Eliminar adjunto
            </Button>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!toDelete}
        title="¿Eliminar el adjunto?"
        message={<>Se borrará «{toDelete?.name}» del dispositivo. No se puede deshacer.</>}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteAttachment(getDb(), toDelete.id);
            toast.show('Adjunto eliminado');
          } catch (e) {
            toast.error(errorMessage(e));
          }
          setToDelete(null);
        }}
      />
    </Card>
  );
}

