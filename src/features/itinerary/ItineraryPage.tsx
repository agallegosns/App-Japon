import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  GripVertical,
  Languages,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  SkipForward,
  Ticket,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { capitalize, formatDateLong, formatDateShort, formatDayMonth, nowInZone } from '../../models/datetime';
import { ACTIVITY_STATUS_LABEL } from '../../models/labels';
import type { Activity, Booking, Day } from '../../models/types';
import { activityWarnings, detectOverlaps } from '../../models/warnings';
import { deleteActivity, moveActivity, setActivityStatus } from '../../storage/activities';
import { useAppData, type AppData } from '../../storage/appData';
import { getDb } from '../../storage/db';
import { setDayCity } from '../../storage/trips';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button, LinkButton } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { copyText } from '../../ui/copy';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { ReorderList, type HandleProps } from '../../ui/ReorderList';
import { Segmented } from '../../ui/Segmented';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../ui/States';
import { StatusTag, type Tone } from '../../ui/StatusTag';
import { useToast } from '../../ui/Toast';
import { JapaneseAddressView } from '../bookings/JapaneseAddressView';
import { externalMapUrl } from './mapLinks';

type View = 'dia' | 'lista';

const STATUS_TONE: Record<Activity['status'], Tone> = { pendiente: 'neutral', hecha: 'success', omitida: 'neutral' };

export function ItineraryPage() {
  const result = useAppData();
  return (
    <>
      <PageHeader title="Itinerario" />
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
          <DayChips dates={dates} days={data.days} selected={selected} onSelect={(d) => setParam('fecha', d)} />
          {selected && (
            <DayView
              date={selected}
              day={data.days.find((d) => d.date === selected) ?? null}
              cities={data.trip?.cities ?? []}
              activities={data.activities.filter((a) => a.date === selected)}
              overlaps={overlaps}
              bookings={bookings}
            />
          )}
        </>
      ) : (
        <ChronoList activities={data.activities} overlaps={overlaps} bookings={bookings} />
      )}
    </>
  );
}

function DayChips({ dates, days, selected, onSelect }: { dates: string[]; days: Day[]; selected: string | null; onSelect: (d: string) => void }) {
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
            className={`day-chip${day ? '' : ' is-outside'}`}
            aria-pressed={date === selected}
            onClick={() => onSelect(date)}
            aria-label={`${formatDateLong(date)}${day?.city ? `, ${day.city}` : ''}`}
          >
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

function DayView({ date, day, cities, activities, overlaps, bookings }: ListProps & { date: string; day: Day | null; cities: string[]; activities: Activity[] }) {
  const toast = useToast();
  const sorted = [...activities].sort((a, b) => a.order - b.order);

  const move = async (id: string, to: number) => {
    try {
      await moveActivity(getDb(), id, to);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="stack" aria-label={formatDateLong(date)}>
      <div className="spread">
        <h2>{capitalize(formatDateLong(date))}</h2>
      </div>
      {day ? (
        cities.length > 0 && (
          <div className="field">
            <label className="field-label" htmlFor="day-city">
              Ciudad del día
            </label>
            <select
              id="day-city"
              className="input"
              value={day.city}
              onChange={(e) => setDayCity(getDb(), day.id, e.target.value).catch((err: unknown) => toast.error(errorMessage(err)))}
            >
              <option value="">Sin asignar</option>
              {[...new Set([...cities, ...(day.city && !cities.includes(day.city) ? [day.city] : [])])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )
      ) : (
        <Notice tone="warning">Este día queda fuera de las fechas del viaje.</Notice>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={<MapPin size={26} />} title="Sin paradas este día">
          Añade visitas, comidas o traslados.
        </EmptyState>
      ) : (
        <ReorderList
          label={`Paradas del ${formatDateShort(date)}`}
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
        Añadir parada
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
    <article className={`card activity-card${a.status === 'hecha' ? ' is-done' : ''}${a.status === 'omitida' ? ' is-skipped' : ''}`} aria-label={a.title}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {reorderable && (
          <span className="drag-handle" {...handle} aria-hidden="true" title="Arrastrar para reordenar">
            <GripVertical size={20} />
          </span>
        )}
        <div className="grow">
          <p className="muted small">
            {time}
            {a.durationMin ? ` · ${a.durationMin} min` : ''}
          </p>
          <p className="activity-title break">{a.title}</p>
          {a.location && <p className="small break">{a.location}</p>}
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
            Eliminar parada
          </Button>
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={confirm}
        title="¿Eliminar esta parada?"
        message={<>Se borrará «{a.title}» del itinerario. No se puede deshacer.</>}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await deleteActivity(getDb(), a.id);
            toast.show('Parada eliminada');
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
