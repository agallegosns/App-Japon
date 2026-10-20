import { CalendarPlus, ChevronRight, Plane, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { capitalize, formatDayLong, nowInZone } from '../../models/datetime';
import { dayTimeline, homeDay, type TimelineEntry } from '../../models/dayEvents';
import type { Trip } from '../../models/types';
import type { AppData } from '../../storage/appData';
import { LinkButton } from '../../ui/Button';
import { Card } from '../../ui/Card';

const MAX_ROWS = 5;

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

/** Itinerario en la pantalla de inicio: el plan de hoy (o del próximo día con plan). */
export function DayPlan({ data, trip }: { data: AppData; trip: Trip | null }) {
  const today = nowInZone(trip?.tz ?? 'Asia/Tokyo').date;
  const date = trip ? homeDay(today, data.days, data.activities, data.bookings) : null;

  if (!trip || !date) {
    return (
      <Card title="Itinerario">
        <div className="stack">
          <p className="muted">
            {trip ? 'Todavía no hay nada planificado. Añade actividades a los días del viaje.' : 'Crea el viaje y añade actividades a cada día.'}
          </p>
          <LinkButton to={trip ? '/itinerario/nueva' : '/viaje/editar'} variant="secondary" icon={<CalendarPlus size={18} />}>
            {trip ? 'Añadir actividad' : 'Crear viaje'}
          </LinkButton>
        </div>
      </Card>
    );
  }

  const entries = dayTimeline(date, data.activities, data.bookings);
  const isToday = date === today;
  const dayNumber = data.days.findIndex((d) => d.date === date) + 1;
  return (
    <Card
      title={isToday ? 'Itinerario de hoy' : 'Próximo día con plan'}
      action={dayNumber > 0 ? <span className="plan-day-tag">Día {dayNumber}</span> : undefined}
    >
      <p className="muted small plan-date">{capitalize(formatDayLong(date))}</p>
      {entries.length === 0 ? (
        <p className="muted">Hoy no hay nada planificado.</p>
      ) : (
        <ol className="plan-list">
          {entries.slice(0, MAX_ROWS).map((e) => (
            <Row key={e.id} e={e} />
          ))}
        </ol>
      )}
      {entries.length > MAX_ROWS && <p className="muted small">Y {entries.length - MAX_ROWS} más.</p>}
      <LinkButton to={`/itinerario?fecha=${date}`} variant="secondary" block>
        Ver el itinerario completo
      </LinkButton>
    </Card>
  );
}
