import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  GripVertical,
  Languages,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  SkipForward,
  Ticket,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { capitalize, formatDateLong, formatDateShort, formatDayLong, formatDayMonth, nowInZone } from '../../models/datetime';
import { ACTIVITY_STATUS_LABEL } from '../../models/labels';
import { bookingsOnDate, flightDates, flightsOnDate } from '../../models/dayEvents';
import type { Activity, Booking, Day } from '../../models/types';
import { activityWarnings, detectOverlaps } from '../../models/warnings';
import { deleteActivity, moveActivity, setActivityStatus } from '../../storage/activities';
import { useAppData, type AppData } from '../../storage/appData';
import { getDb } from '../../storage/db';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button, LinkButton } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { copyText } from '../../ui/copy';
import { PageHeader } from '../../ui/PageHeader';
import { ReorderList, type HandleProps } from '../../ui/ReorderList';
import { Segmented } from '../../ui/Segmented';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../ui/States';
import { StatusTag, type Tone } from '../../ui/StatusTag';
import { useToast } from '../../ui/Toast';
import { JapaneseAddressView } from '../bookings/JapaneseAddressView';
import { shareCalendar } from '../settings/calendarActions';
import { DayBookings, DayHeader, FlightDayCard } from './DayParts';
import { externalMapUrl } from './mapLinks';

type View = 'dia' | 'lista';

const STATUS_TONE: Record<Activity['status'], Tone> = { pendiente: 'neutral', hecha: 'success', omitida: 'neutral' };

export function ItineraryPage() {
  const result = useAppData();
  return (
    <>
      <PageHeader title="Itinerario" actions={<CalendarButton />} />
      {result.status === 'loading' && <LoadingState />}
      {result.status === 'error' && <ErrorState error={result.error} />}
      {result.status === 'ok' && <Itinerary data={result.data} />}
    </>
  );
}

function Itinerary({ data }: { data: AppData }) {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('vista') === 'lista' ? 'lista' : 'dia';
  const overlaps = useMemo(() => detectOverlaps(data.activities), [data.activities]);
  const flightDays = useMemo(() => flightDates(data.bookings), [data.bookings]);
  const bookings = useMemo(() => new Map(data.bookings.map((b) => [b.id, b])), [data.bookings]);

  const dates = useMemo(() => {
    const set = new Set<string>(data.days.map((d) => d.date));
    data.activities.forEach((a) => set.add(a.date));
    return [...set].sort();
  }, [data.days, data.activities]);

  const today = data.trip ? nowInZone(data.trip.tz).date : null;
  const requested = params.get('fecha');
  const selected =
    requested && dates.includes(requested) ? requested : today && dates.includes(today) ? today : (dates[0] ?? null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (!data.trip && data.activities.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={26} />}
        title="Crea primero el viaje"
        action={
          <LinkButton to="/viaje/editar" variant="primary">
            Crear viaje
          </LinkButton>
        }
      >
        Con las fechas del viaje se generan los días del itinerario.
      </EmptyState>
    );
  }

  return (
    <>
      <Segmented<View>
        label="Vista del itinerario"
        value={view}
        onChange={(v) => setParam('vista', v === 'dia' ? null : v)}
        options={[
          { value: 'dia', label: 'Por días' },
          { value: 'lista', label: 'Cronológica' },
        ]}
      />
      {view === 'dia' ? (
        <>
          <DayChips dates={dates} days={data.days} selected={selected} flights={flightDays} onSelect={(d) => setParam('fecha', d)} />
          {selected && (
            <DayView
              date={selected}
              day={data.days.find((d) => d.date === selected) ?? null}
              dayNumber={data.days.findIndex((d) => d.date === selected) + 1 || null}
              totalDays={data.days.length}
              cities={data.trip?.cities ?? []}
              activities={data.activities.filter((a) => a.date === selected)}
              overlaps={overlaps}
              bookings={bookings}
              allBookings={data.bookings}
            />
          )}
        </>
      ) : (
        <ChronoList activities={data.activities} overlaps={overlaps} bookings={bookings} />
      )}
    </>
  );
}

function CalendarButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      icon={<CalendarPlus size={24} />}
      label="Añadir el itinerario al Calendario del iPhone con avisos"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await shareCalendar();
          if (r.outcome !== 'cancelled') toast.show(`Calendario preparado: ${r.count} eventos con aviso`);
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function DayChips({ dates, days, selected, flights, onSelect }: { dates: string[]; days: Day[]; selected: string | null; flights: Set<string>; onSelect: (d: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selected]);
  const byDate = new Map(days.map((d) => [d.date, d]));
  return (
    <div className="chips" ref={ref} role="group" aria-label="Días del viaje">
      {dates.map((date) => {
        const day = byDate.get(date);
        const dayNumber = days.findIndex((d) => d.date === date) + 1;
        return (
          <button
            key={date}
            type="button"
            className={`day-chip${day ? '' : ' is-outside'}${flights.has(date) ? ' has-flight' : ''}`}
            aria-pressed={date === selected}
            onClick={() => onSelect(date)}
            aria-label={`${formatDateLong(date)}${day?.city ? `, ${day.city}` : ''}${flights.has(date) ? ', día de vuelo' : ''}`}
          >
            {flights.has(date) && <Plane size={14} className="day-chip-plane" aria-hidden="true" />}
            <span>{day ? `Día ${dayNumber}` : 'Fuera'}</span>
            <strong>{formatDayMonth(date)}</strong>
            <span className="break" style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {day?.city || ' '}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ListProps {
  overlaps: Map<string, string[]>;
  bookings: Map<string, Booking>;
}

function DayView({ date, day, dayNumber, totalDays, cities, activities, overlaps, bookings, allBookings }: ListProps & { date: string; day: Day | null; dayNumber: number | null; totalDays: number; cities: string[]; activities: Activity[]; allBookings: Booking[] }) {
  const toast = useToast();
  const sorted = [...activities].sort((a, b) => a.order - b.order);
  const flights = flightsOnDate(date, allBookings);
  const dayBookings = bookingsOnDate(date, allBookings, activities);

  const move = async (id: string, to: number) => {
    try {
      await moveActivity(getDb(), id, to);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="stack" aria-label={formatDateLong(date)}>
      <DayHeader
        date={date}
        title={capitalize(formatDayLong(date))}
        day={day}
        dayNumber={dayNumber}
        totalDays={totalDays}
        cities={cities}
        bookings={allBookings}
      />
      <FlightDayCard flights={flights} />
      <DayBookings bookings={dayBookings} />

      <h3 className="section-title">Actividades del día</h3>
      {sorted.length === 0 ? (
        <EmptyState icon={<MapPin size={26} />} title="Aún no hay actividades este día">
          Una actividad es algo que haréis ese día: una visita, una comida o un traslado. Añádela con su hora y su lugar.
        </EmptyState>
      ) : (
        <ReorderList
          label={`Actividades del ${formatDateShort(date)}`}
          items={sorted}
          onMove={move}
          renderItem={(a, i, handle) => (
            <ActivityCard
              activity={a}
              index={i}
              total={sorted.length}
              handle={handle}
              overlapsWith={(overlaps.get(a.id) ?? []).map((id) => activities.find((x) => x.id === id)?.title ?? '')}
              booking={a.bookingId ? (bookings.get(a.bookingId) ?? null) : null}
              onMove={move}
            />
          )}
        />
      )}
      <LinkButton to={`/itinerario/nueva?fecha=${date}`} variant="primary" block icon={<Plus size={20} />}>
        Añadir actividad
      </LinkButton>
    </section>
  );
}

function ChronoList({ activities, overlaps, bookings }: ListProps & { activities: Activity[] }) {
  if (activities.length === 0)
    return (
      <EmptyState icon={<CalendarDays size={26} />} title="Aún no hay actividades" action={<LinkButton to="/itinerario/nueva" variant="primary" icon={<Plus size={18} />}>Añadir actividad</LinkButton>} />
    );
  const sorted = [...activities].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') || a.order - b.order,
  );
  const groups = new Map<string, Activity[]>();
  sorted.forEach((a) => groups.set(a.date, [...(groups.get(a.date) ?? []), a]));
  return (
    <div className="stack-lg">
      {[...groups.entries()].map(([date, list]) => (
        <section key={date} className="stack" aria-label={formatDateLong(date)}>
          <h2 className="section-title">{formatDateLong(date)}</h2>
          <ul className="reorder-list">
            {list.map((a) => (
              <li key={a.id}>
                <ActivityCard
                  activity={a}
                  overlapsWith={(overlaps.get(a.id) ?? []).map((id) => activities.find((x) => x.id === id)?.title ?? '')}
                  booking={a.bookingId ? (bookings.get(a.bookingId) ?? null) : null}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface CardProps {
  activity: Activity;
  overlapsWith: string[];
  booking: Booking | null;
  index?: number;
  total?: number;
  handle?: HandleProps;
  onMove?: (id: string, to: number) => void;
}

function ActivityCard({ activity: a, overlapsWith, booking, index, total, handle, onMove }: CardProps) {
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [showJa, setShowJa] = useState(false);
  const warnings = activityWarnings(a);
  const mapUrl = externalMapUrl(a);
  const time = a.startTime ? `${a.startTime}${a.endTime ? `–${a.endTime}` : ''}` : 'Sin hora';
  const reorderable = handle && onMove && index !== undefined && total !== undefined;

  const setStatus = async (status: Activity['status']) => {
    try {
      await setActivityStatus(getDb(), a.id, status);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const copy = async (text: string) => {
    try {
      await copyText(text);
      toast.show('Dirección copiada');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <article className={`card activity-card status-${a.status}${a.status === 'hecha' ? ' is-done' : ''}${a.status === 'omitida' ? ' is-skipped' : ''}`} aria-label={a.title}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {reorderable && (
          <span className="drag-handle" {...handle} aria-hidden="true" title="Arrastrar para reordenar">
            <GripVertical size={20} />
          </span>
        )}
        <div className="act-time" aria-label={a.startTime ? `Hora ${time}` : 'Sin hora'}>
          <strong>{a.startTime ?? '--:--'}</strong>
          {a.endTime && <span>{a.endTime}</span>}
        </div>
        <div className="grow act-body">
          <p className="activity-title break">{a.title}</p>
          {(a.location || a.durationMin) && (
            <p className="act-loc break">
              {a.location && (
                <>
                  <MapPin size={14} aria-hidden="true" /> {a.location}
                </>
              )}
              {a.durationMin ? `${a.location ? ' · ' : ''}${a.durationMin} min` : ''}
            </p>
          )}
          <div className="row-wrap" style={{ marginTop: 4 }}>
            {a.status !== 'pendiente' && <StatusTag tone={STATUS_TONE[a.status]}>{ACTIVITY_STATUS_LABEL[a.status]}</StatusTag>}
            {booking && (
              <Link to={`/reservas/${booking.id}`} className="tag tag-info" style={{ textDecoration: 'none' }}>
                <Ticket size={12} aria-hidden="true" /> {booking.name}
              </Link>
            )}
            {overlapsWith.length > 0 && (
              <StatusTag tone="danger" icon={<AlertTriangle size={12} />}>
                Se solapa con {overlapsWith.map((t) => `«${t}»`).join(', ')}
              </StatusTag>
            )}
            {warnings.map((w) => (
              <StatusTag key={w} tone="warning">
                {w}
              </StatusTag>
            ))}
          </div>
        </div>
      </div>
      <div className="activity-actions">
        <Button
          variant={a.status === 'hecha' ? 'secondary' : 'ghost'}
          small
          icon={a.status === 'hecha' ? <RotateCcw size={18} /> : <Check size={18} />}
          onClick={() => setStatus(a.status === 'hecha' ? 'pendiente' : 'hecha')}
        >
          {a.status === 'hecha' ? 'Deshacer' : 'Hecha'}
        </Button>
        <div className="row">
          {reorderable && (
            <>
              <Button variant="ghost" icon={<ArrowUp size={18} />} label={`Subir «${a.title}»`} disabled={index === 0} onClick={() => onMove(a.id, index - 1)} />
              <Button variant="ghost" icon={<ArrowDown size={18} />} label={`Bajar «${a.title}»`} disabled={index === total - 1} onClick={() => onMove(a.id, index + 1)} />
            </>
          )}
          <Button variant="ghost" icon={<MoreHorizontal size={20} />} label={`Más opciones de «${a.title}»`} onClick={() => setMenu(true)} />
        </div>
      </div>

      <BottomSheet open={menu} title={a.title} onClose={() => setMenu(false)}>
        <div className="stack">
          <LinkButton to={`/itinerario/${a.id}/editar`} block icon={<Pencil size={18} />}>
            Editar
          </LinkButton>
          {a.address && (
            <Button block icon={<Copy size={18} />} onClick={() => { void copy(a.address); setMenu(false); }}>
              Copiar dirección
            </Button>
          )}
          {a.addressJa && (
            <Button block icon={<Languages size={18} />} onClick={() => { setShowJa(true); setMenu(false); }}>
              Mostrar dirección en japonés
            </Button>
          )}
          {mapUrl && (
            <a className="btn btn-secondary btn-block" href={mapUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={18} aria-hidden="true" /> Abrir en Mapas (requiere conexión)
            </a>
          )}
          {a.status !== 'omitida' ? (
            <Button block icon={<SkipForward size={18} />} onClick={() => { void setStatus('omitida'); setMenu(false); }}>
              Marcar como omitida
            </Button>
          ) : (
            <Button block icon={<RotateCcw size={18} />} onClick={() => { void setStatus('pendiente'); setMenu(false); }}>
              Volver a pendiente
            </Button>
          )}
          <Button block icon={<Trash2 size={18} />} style={{ color: 'var(--c-danger)' }} onClick={() => { setMenu(false); setConfirm(true); }}>
            Eliminar actividad
          </Button>
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={confirm}
        title="¿Eliminar esta actividad?"
        message={<>Se borrará «{a.title}» del itinerario. No se puede deshacer.</>}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await deleteActivity(getDb(), a.id);
            toast.show('Actividad eliminada');
          } catch (e) {
            toast.error(errorMessage(e));
          }
          setConfirm(false);
        }}
      />
      {showJa && <JapaneseAddressView name={a.title} address={a.addressJa} onClose={() => setShowJa(false)} />}
    </article>
  );
}
