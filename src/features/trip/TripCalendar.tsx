import { ChevronLeft, ChevronRight, Plane, TrainFront } from 'lucide-react';
import { addMonths, monthGrid, monthLabel, monthOf, type DayMarkers, type YearMonth } from '../../models/calendar';
import { formatDayLong } from '../../models/datetime';
import { Button } from '../../ui/Button';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
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

/** Calendario mensual del viaje: cada día muestra de un vistazo si hay vuelo, actividades, reservas o cambio de hotel. */
export function TripCalendar({ month, onMonthChange, selected, onSelect, today, tripStart, tripEnd, markers }: Props) {
  const weeks = monthGrid(month);
  const showToday = monthOf(today) !== month || selected !== today;
  return (
    <section className="cal" aria-label="Calendario del viaje">
      <div className="cal-head">
        <Button variant="ghost" icon={<ChevronLeft size={22} />} label="Mes anterior" onClick={() => onMonthChange(addMonths(month, -1))} />
        <h2 className="cal-title" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <Button variant="ghost" icon={<ChevronRight size={22} />} label="Mes siguiente" onClick={() => onMonthChange(addMonths(month, 1))} />
      </div>
      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {weeks.flat().map((date) => {
          const m = markers.get(date);
          const inMonth = monthOf(date) === month;
          const inTrip = tripStart !== null && tripEnd !== null && date >= tripStart && date <= tripEnd;
          const cls = ['cal-day', !inMonth && 'is-outside', inTrip && 'in-trip', date === today && 'is-today', date === selected && 'is-selected']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={date}
              type="button"
              className={cls}
              aria-pressed={date === selected}
              aria-current={date === today ? 'date' : undefined}
              aria-label={describe(date, m, today)}
              onClick={() => {
                onSelect(date);
                if (!inMonth) onMonthChange(monthOf(date));
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
        {showToday && (
          <button
            type="button"
            className="cal-today"
            onClick={() => {
              onSelect(today);
              onMonthChange(monthOf(today));
            }}
          >
            Ir a hoy
          </button>
        )}
      </div>
    </section>
  );
}
