import { BedDouble, CalendarPlus, ChevronRight, Plane, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { capitalize, formatDayLong } from '../../models/datetime';
import { dayTimeline, type TimelineEntry } from '../../models/dayEvents';
import { dayLodging, lodgingChangesOn } from '../../models/lodging';
import type { AppData } from '../../storage/appData';
import { LinkButton } from '../../ui/Button';
import { StatusTag } from '../../ui/StatusTag';

function Row({ e }: { e: TimelineEntry }) {
  return (
    <li>
      <Link to={e.to} className={`plan-row kind-${e.kind}${e.done ? ' is-done' : ''}`}>
        <span className={`plan-time${e.allDay ? ' is-allday' : ''}`}>{e.allDay ? 'Todo el día' : (e.time ?? '--:--')}</span>
        <span className="plan-dot" aria-hidden="true">
          {e.kind === 'flight' ? <Plane size={14} /> : e.kind === 'booking' ? <Ticket size={14} /> : null}
        </span>
        <span className="grow break">
          <strong className="plan-title">{e.title}</strong>
          {e.subtitle && <span className="muted small plan-sub">{e.subtitle}</span>}
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Lo que hay el día seleccionado en el calendario: vuelos, actividades, reservas y dónde se duerme. */
export function DayAgenda({ date, today, data }: { date: string; today: string; data: AppData }) {
  const entries = dayTimeline(date, data.activities, data.bookings);
  const day = data.days.find((d) => d.date === date) ?? null;
  const dayNumber = data.days.findIndex((d) => d.date === date) + 1;
  const lodging = dayLodging(date, day, data.bookings);
  const sleeps = lodging.source === 'manual' ? [lodging.booking] : lodging.source === 'auto' ? lodging.bookings : [];
  const changes = lodgingChangesOn(date, data.bookings);
  const label = date === today ? 'Hoy' : date < today ? 'Pasado' : null;

  return (
    <section className="agenda" aria-label={`Agenda del ${formatDayLong(date)}`} key={date}>
      <div className="agenda-head">
        <div className="grow">
          <p className="day-head-kicker">
            {dayNumber > 0 ? `Día ${dayNumber} de ${data.days.length}` : 'Fuera de las fechas del viaje'}
            {day?.city ? ` · ${day.city}` : ''}
          </p>
          <h2 className="agenda-title">{capitalize(formatDayLong(date))}</h2>
        </div>
        {label === 'Hoy' && <span className="plan-day-tag">Hoy</span>}
      </div>

      {(sleeps.length > 0 || changes.checkOut.length > 0 || changes.checkIn.length > 0) && (
        <div className="row-wrap">
          {sleeps.map((b) => (
            <Link key={b.id} to={`/reservas/${b.id}`} className="chip-link">
              <BedDouble size={16} aria-hidden="true" />
              <span className="break">Duermes en {b.name}</span>
            </Link>
          ))}
          {changes.checkOut.map((b) => (
            <StatusTag key={`o-${b.id}`} tone="warning">
              Check-out: {b.name}
            </StatusTag>
          ))}
          {changes.checkIn.map((b) => (
            <StatusTag key={`i-${b.id}`} tone="info">
              Check-in: {b.name}
            </StatusTag>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="muted">No hay nada planificado este día.</p>
      ) : (
        <ol className="plan-list">
          {entries.map((e) => (
            <Row key={e.id} e={e} />
          ))}
        </ol>
      )}

      <div className="input-row">
        <LinkButton to={`/itinerario?fecha=${date}`} variant="secondary">
          Abrir el día
        </LinkButton>
        <LinkButton to={`/itinerario/nueva?fecha=${date}`} variant="primary" icon={<CalendarPlus size={18} />} aria-label="Añadir actividad">
          Añadir
        </LinkButton>
      </div>
    </section>
  );
}
