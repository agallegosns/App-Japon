import { BedDouble, ChevronRight, MapPin, Plane, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatLdt } from '../../models/datetime';
import { type FlightOnDay } from '../../models/dayEvents';
import { formatMinutes, layoverMinutes, legMinutes } from '../../models/flights';
import { CATEGORY_LABEL } from '../../models/labels';
import { dayLodging, lodgingChangesOn } from '../../models/lodging';
import type { Booking, Day } from '../../models/types';
import { setDayCity, setDayLodging } from '../../storage/trips';
import { getDb } from '../../storage/db';
import { StatusTag } from '../../ui/StatusTag';
import { errorMessage } from '../../ui/States';
import { useToast } from '../../ui/Toast';

/** Bloque destacado de un día con vuelos: ruta, horas locales y escalas. */
export function FlightDayCard({ flights }: { flights: FlightOnDay[] }) {
  if (flights.length === 0) return null;
  return (
    <section className="flight-day" aria-label="Día de vuelo">
      <div className="flight-day-head">
        <span className="flight-day-icon" aria-hidden="true">
          <Plane size={20} />
        </span>
        <strong>Día de vuelo</strong>
      </div>
      {flights.map((f) => (
        <Link key={f.booking.id} to={`/reservas/${f.booking.id}`} className="flight-day-item">
          <div className="grow">
            <p className="flight-day-name break">{f.booking.name}</p>
            <ul className="flight-legs">
              {f.legs.map((l) => {
                const i = f.allLegs.findIndex((x) => x.id === l.id);
                const prev = i > 0 ? f.allLegs[i - 1] : undefined;
                const gap = prev ? layoverMinutes(prev, l) : null;
                const dur = legMinutes(l);
                return (
                  <li key={l.id}>
                    {gap !== null && gap >= 0 && prev && (
                      <p className="flight-layover">
                        Escala en {prev.to || 'la escala'}: {formatMinutes(gap)}
                      </p>
                    )}
                    <p className="flight-route">
                      {(l.from || l.to) ? `${l.from || '?'} → ${l.to || '?'}` : 'Vuelo'}
                      {l.flightNumber ? <span className="muted"> · {l.flightNumber}</span> : null}
                    </p>
                    <p className="small muted">
                      Sale {l.depart ? formatLdt(l.depart) : 'sin hora'}
                      <br />
                      Llega {l.arrive ? formatLdt(l.arrive) : 'sin hora'}
                      {dur !== null ? ` · ${formatMinutes(dur)}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      ))}
    </section>
  );
}

/** Reservas de ese día (restaurantes, entradas, trenes…) que no están ya en una actividad. */
export function DayBookings({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) return null;
  return (
    <section className="day-bookings" aria-label="Reservas de este día">
      <h3 className="section-title">Reservas de este día</h3>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {bookings.map((b) => (
          <li key={b.id}>
            <Link to={`/reservas/${b.id}`} className="booking-chip">
              <Ticket size={18} aria-hidden="true" />
              <span className="grow break">
                <strong>{b.start?.time ?? 'Sin hora'}</strong> · {b.name}
                <span className="muted small" style={{ display: 'block' }}>
                  {CATEGORY_LABEL[b.category]}
                  {b.address ? ` · ${b.address}` : ''}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface HeaderProps {
  date: string;
  title: string;
  day: Day | null;
  dayNumber: number | null;
  totalDays: number;
  cities: string[];
  bookings: Booking[];
}

/** Cabecera compacta del día: número de día, ciudad, dónde se duerme y cambios de hotel. */
export function DayHeader({ date, title, day, dayNumber, totalDays, cities, bookings }: HeaderProps) {
  const toast = useToast();
  const lodging = dayLodging(date, day, bookings);
  const changes = lodgingChangesOn(date, bookings);
  const hotels = bookings.filter((b) => b.category === 'alojamiento' && b.status !== 'cancelada');
  const sleeps = lodging.source === 'manual' ? [lodging.booking] : lodging.source === 'auto' ? lodging.bookings : [];
  const cityOptions = [...new Set([...cities, ...(day?.city && !cities.includes(day.city) ? [day.city] : [])])];

  return (
    <section className="day-head" aria-label="Resumen del día">
      <p className="day-head-kicker">{dayNumber ? `Día ${dayNumber} de ${totalDays}` : 'Fuera de las fechas del viaje'}</p>
      <h2 className="day-head-title">{title}</h2>

      <div className="day-meta">
        {day && cityOptions.length > 0 && (
          <label className="chip-select">
            <MapPin size={16} aria-hidden="true" />
            <span className="sr-only">Ciudad del día</span>
            <select
              value={day.city}
              onChange={(e) => setDayCity(getDb(), day.id, e.target.value).catch((err: unknown) => toast.error(errorMessage(err)))}
            >
              <option value="">Ciudad sin asignar</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        {sleeps.map((b) => (
          <Link key={b.id} to={`/reservas/${b.id}`} className="chip-link">
            <BedDouble size={16} aria-hidden="true" />
            <span className="break">Duermes en {b.name}</span>
          </Link>
        ))}
        {sleeps.length === 0 && hotels.length > 0 && (
          <span className="chip-link is-empty">
            <BedDouble size={16} aria-hidden="true" /> Sin alojamiento esta noche
          </span>
        )}
      </div>

      {(changes.checkOut.length > 0 || changes.checkIn.length > 0) && (
        <div className="row-wrap">
          {changes.checkOut.map((b) => (
            <StatusTag key={`o-${b.id}`} tone="warning">
              Check-out hoy: {b.name}
            </StatusTag>
          ))}
          {changes.checkIn.map((b) => (
            <StatusTag key={`i-${b.id}`} tone="info">
              Check-in hoy: {b.name}
            </StatusTag>
          ))}
        </div>
      )}

      {day && hotels.length > 0 && (
        <details className="day-more">
          <summary>Cambiar el alojamiento de esta noche</summary>
          <select
            className="input"
            aria-label="Alojamiento de esta noche"
            value={day.lodgingId ?? ''}
            onChange={(e) => setDayLodging(getDb(), day.id, e.target.value || null).catch((err: unknown) => toast.error(errorMessage(err)))}
          >
            <option value="">Automático (según check-in y check-out)</option>
            {hotels.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </details>
      )}
    </section>
  );
}
