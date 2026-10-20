import { AlertTriangle, ChevronRight, Paperclip, Plus, Ticket } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDateLong, formatLdt } from '../../models/datetime';
import { BOOKING_STATUS_LABEL, CATEGORY_LABEL } from '../../models/labels';
import { BOOKING_CATEGORIES, type Booking, type BookingCategory } from '../../models/types';
import { bookingWarnings } from '../../models/warnings';
import { sortBookings } from '../../storage/bookings';
import { getDb } from '../../storage/db';
import { useLiveQuery } from '../../storage/useLiveQuery';
import { LinkButton } from '../../ui/Button';
import { PageHeader } from '../../ui/PageHeader';
import { Segmented } from '../../ui/Segmented';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { StatusTag } from '../../ui/StatusTag';
import { CategoryIcon, STATUS_TONE } from './categoryIcon';

type View = 'fecha' | 'categoria';

async function load() {
  const db = getDb();
  const [bookings, attachments] = await Promise.all([db.bookings.toArray(), db.attachments.toArray()]);
  const counts = new Map<string, number>();
  for (const a of attachments) counts.set(a.bookingId, (counts.get(a.bookingId) ?? 0) + 1);
  return { bookings: sortBookings(bookings), counts };
}

export function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('vista') === 'categoria' ? 'categoria' : 'fecha';
  const catParam = params.get('cat');
  const cat = BOOKING_CATEGORIES.includes(catParam as BookingCategory) ? (catParam as BookingCategory) : null;
  const result = useLiveQuery(load, []);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(
    () => (result.status === 'ok' ? result.data.bookings.filter((b) => !cat || b.category === cat) : []),
    [result, cat],
  );

  return (
    <>
      <PageHeader
        title="Reservas"
        actions={<LinkButton to="/reservas/nueva" variant="primary" icon={<Plus size={20} />} label="Nueva reserva" />}
      />
      <Segmented<View>
        label="Agrupar reservas"
        value={view}
        onChange={(v) => setParam('vista', v === 'fecha' ? null : v)}
        options={[
          { value: 'fecha', label: 'Por fecha' },
          { value: 'categoria', label: 'Por categoría' },
        ]}
      />
      <div className="chips" role="group" aria-label="Filtrar por categoría">
        <button type="button" className="chip" aria-pressed={cat === null} onClick={() => setParam('cat', null)}>
          Todas
        </button>
        {BOOKING_CATEGORIES.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setParam('cat', c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {result.status === 'loading' && <LoadingState />}
      {result.status === 'error' && <ErrorState error={result.error} />}
      {result.status === 'ok' &&
        (filtered.length === 0 ? (
          <EmptyState
            icon={<Ticket size={26} />}
            title={cat ? `No hay reservas de tipo «${CATEGORY_LABEL[cat]}»` : 'Aún no hay reservas'}
            action={
              <LinkButton to={cat ? `/reservas/nueva?cat=${cat}` : '/reservas/nueva'} variant="primary" icon={<Plus size={18} />}>
                Añadir reserva
              </LinkButton>
            }
          >
            Guarda vuelos, hoteles, restaurantes y entradas con sus documentos y códigos QR.
          </EmptyState>
        ) : (
          <Groups bookings={filtered} view={view} counts={result.data.counts} />
        ))}
    </>
  );
}

function Groups({ bookings, view, counts }: { bookings: Booking[]; view: View; counts: Map<string, number> }) {
  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = view === 'categoria' ? b.category : (b.start ?? b.checkIn ?? b.arrival)?.date ?? '';
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const keys = [...groups.keys()];
  if (view === 'categoria') keys.sort((a, b) => BOOKING_CATEGORIES.indexOf(a as BookingCategory) - BOOKING_CATEGORIES.indexOf(b as BookingCategory));
  return (
    <div className="stack-lg">
      {keys.map((key) => (
        <section key={key || 'sin-fecha'} className="stack" aria-label={groupTitle(key, view)}>
          <h2 className="section-title">{groupTitle(key, view)}</h2>
          <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(groups.get(key) ?? []).map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} attachments={counts.get(b.id) ?? 0} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function groupTitle(key: string, view: View): string {
  if (view === 'categoria') return CATEGORY_LABEL[key as BookingCategory];
  return key ? formatDateLong(key) : 'Sin fecha';
}

function BookingRow({ booking: b, attachments }: { booking: Booking; attachments: number }) {
  const warnings = bookingWarnings(b).filter((w) => w !== 'Sin confirmar');
  return (
    <Link to={`/reservas/${b.id}`} className="list-item">
      <span className="booking-icon">
        <CategoryIcon category={b.category} />
      </span>
      <span className="grow">
        <span className="row" style={{ justifyContent: 'space-between' }}>
          <strong className="break" style={b.status === 'cancelada' ? { textDecoration: 'line-through' } : undefined}>
            {b.name}
          </strong>
        </span>
        <span className="muted small" style={{ display: 'block' }}>
          {formatLdt(b.start ?? b.checkIn ?? b.arrival)}
        </span>
        <span className="row-wrap" style={{ marginTop: 4 }}>
          <StatusTag tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</StatusTag>
          {attachments > 0 && (
            <StatusTag icon={<Paperclip size={12} />}>{attachments}</StatusTag>
          )}
          {warnings.length > 0 && (
            <StatusTag tone="warning" icon={<AlertTriangle size={12} />}>
              {warnings.length} aviso{warnings.length > 1 ? 's' : ''}
            </StatusTag>
          )}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}
