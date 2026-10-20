import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plane, TrainFront } from 'lucide-react';
import { addDays } from '../../models/datetime';
import { addMonths, monthGrid, monthLabel, monthOf, weekOf, type DayMarkers, type YearMonth } from '../../models/calendar';
import { formatDayLong } from '../../models/datetime';
import { Button } from '../../ui/Button';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  /** false = solo la semana (vista compacta); true = el mes entero. */
  expanded: boolean;
  onToggle: () => void;
  /** Mes que se enseña cuando está desplegado. */
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  /** Un día de la semana que se enseña en la vista compacta. */
  weekAnchor: string;
  onWeekChange: (anchor: string) => void;
  selected: string;
  onSelect: (date: string) => void;
  today: string;
  tripStart: string | null;
  tripEnd: string | null;
  markers: Map<string, DayMarkers>;
}

function describe(date: string, m: DayMarkers | undefined, today: string): string {
  const parts = [formatDayLong(date)];
  if (date === today) parts.push('hoy');
  if (m?.flight) parts.push('día de vuelo');
  if (m?.transit) parts.push('día de traslado en tren');
  if (m && m.activities > 0) parts.push(`${m.activities} ${m.activities === 1 ? 'actividad' : 'actividades'}`);
  if (m && m.bookings > 0) parts.push(`${m.bookings} ${m.bookings === 1 ? 'reserva' : 'reservas'}`);
  if (m?.lodging) parts.push('cambio de alojamiento');
  return parts.join(', ');
}

/**
 * Calendario del viaje. Por defecto enseña solo la semana (ocupa poco); un botón lo despliega al mes entero.
 * Cada día marca de un vistazo si hay vuelo, tren, actividades, reservas o cambio de hotel.
 */
export function TripCalendar(p: Props) {
  const weeks = p.expanded ? monthGrid(p.month) : [weekOf(p.weekAnchor)];
  const visibleMonth = p.expanded ? p.month : monthOf(weekOf(p.weekAnchor)[3] as string);
  const showToday = p.selected !== p.today || (p.expanded ? monthOf(p.today) !== p.month : !weekOf(p.weekAnchor).includes(p.today));

  const prev = () => (p.expanded ? p.onMonthChange(addMonths(p.month, -1)) : p.onWeekChange(addDays(p.weekAnchor, -7)));
  const next = () => (p.expanded ? p.onMonthChange(addMonths(p.month, 1)) : p.onWeekChange(addDays(p.weekAnchor, 7)));

  return (
    <section className={`cal${p.expanded ? '' : ' cal-compact'}`} aria-label="Calendario del viaje">
      <div className="cal-head">
        <Button variant="ghost" icon={<ChevronLeft size={22} />} label={p.expanded ? 'Mes anterior' : 'Semana anterior'} onClick={prev} />
        <h2 className="cal-title" aria-live="polite">
          {monthLabel(visibleMonth)}
        </h2>
        <Button variant="ghost" icon={<ChevronRight size={22} />} label={p.expanded ? 'Mes siguiente' : 'Semana siguiente'} onClick={next} />
      </div>
      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {weeks.flat().map((date) => {
          const m = p.markers.get(date);
          const inMonth = monthOf(date) === visibleMonth;
          const inTrip = p.tripStart !== null && p.tripEnd !== null && date >= p.tripStart && date <= p.tripEnd;
          const cls = ['cal-day', !inMonth && p.expanded && 'is-outside', inTrip && 'in-trip', date === p.today && 'is-today', date === p.selected && 'is-selected']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={date}
              type="button"
              className={cls}
              aria-pressed={date === p.selected}
              aria-current={date === p.today ? 'date' : undefined}
              aria-label={describe(date, m, p.today)}
              onClick={() => {
                p.onSelect(date);
                if (p.expanded && !inMonth) p.onMonthChange(monthOf(date));
              }}
            >
              <span className="cal-num">{Number(date.slice(8))}</span>
              <span className="cal-marks" aria-hidden="true">
                {m?.flight && <Plane size={11} className="cal-plane" />}
                {m?.transit && <TrainFront size={11} className="cal-train" />}
                {m && m.activities > 0 && <i className="cal-dot cal-dot-act" />}
                {m && m.bookings > 0 && <i className="cal-dot cal-dot-res" />}
                {m?.lodging && <i className="cal-dot cal-dot-hotel" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="cal-foot">
        {p.expanded && (
          <>
            <span className="cal-legend">
              <Plane size={12} aria-hidden="true" /> Vuelo
            </span>
            <span className="cal-legend">
              <TrainFront size={12} aria-hidden="true" /> Tren
            </span>
            <span className="cal-legend">
              <i className="cal-dot cal-dot-act" /> Actividades
            </span>
            <span className="cal-legend">
              <i className="cal-dot cal-dot-res" /> Reservas
            </span>
            <span className="cal-legend">
              <i className="cal-dot cal-dot-hotel" /> Hotel
            </span>
          </>
        )}
        <span className="cal-actions">
          {showToday && (
            <button type="button" className="cal-today" onClick={() => p.onSelect(p.today)}>
              Ir a hoy
            </button>
          )}
          <button type="button" className="cal-toggle" aria-expanded={p.expanded} onClick={p.onToggle}>
            {p.expanded ? (
              <>
                Ver solo la semana <ChevronUp size={16} aria-hidden="true" />
              </>
            ) : (
              <>
                Ver el mes completo <ChevronDown size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </span>
      </div>
    </section>
  );
}
