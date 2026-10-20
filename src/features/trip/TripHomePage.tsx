import {
  AlertTriangle,
  Banknote,
  BedDouble,
  ChevronRight,
  CloudDownload,
  Compass,
  Languages,
  Map,
  Pencil,
  Plane,
  Settings,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnline } from '../../app/useConnectivity';
import { calendarMarkers, monthOf } from '../../models/calendar';
import { homeDay } from '../../models/dayEvents';
import { formatDateRange, formatLdt, nowInZone } from '../../models/datetime';
import { CATEGORY_LABEL } from '../../models/labels';
import { hasAnyData, useAppData, type AppData } from '../../storage/appData';
import { backupReminder } from '../../storage/meta';
import { getStorageInfo, type StorageInfo } from '../../storage/persistence';
import { LinkButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { StatusTag } from '../../ui/StatusTag';
import { useSync } from '../../sync/service';
import { DayAgenda } from './DayAgenda';
import { TripCalendar } from './TripCalendar';
import { pendingInfo } from './pendingInfo';
import { currentDay, nextBooking, tripPhase } from './tripStatus';

export function TripHomePage() {
  const result = useAppData();
  return (
    <>
      <PageHeader
        title="Viaje"
        actions={
          <>
            <LinkButton to="/sin-conexion" variant="ghost" icon={<CloudDownload size={22} />} label="Preparar Japón sin conexión" />
            <LinkButton to="/ajustes" variant="ghost" icon={<Settings size={22} />} label="Ajustes" />
          </>
        }
      />
      {result.status === 'loading' && <LoadingState />}
      {result.status === 'error' && <ErrorState error={result.error} title="No se pudieron leer los datos" />}
      {result.status === 'ok' && <TripHome data={result.data} />}
    </>
  );
}

function TripHome({ data }: { data: AppData }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const today = nowInZone(data.trip?.tz ?? 'Asia/Tokyo', now).date;
  const [selected, setSelected] = useState<string>(
    () => homeDay(today, data.days, data.activities, data.bookings) ?? (data.trip && today < data.trip.startDate ? data.trip.startDate : today),
  );
  const [expanded, setExpanded] = useState(false);
  const [anchor, setAnchor] = useState(selected);
  const [month, setMonth] = useState(() => monthOf(selected));
  const markers = useMemo(() => calendarMarkers(data.activities, data.bookings), [data.activities, data.bookings]);
  const reminder = backupReminder(data.backup, hasAnyData(data), now);

  const select = (date: string) => {
    setSelected(date);
    setAnchor(date);
    setMonth(monthOf(date));
  };

  return (
    <div className="stack-lg">
      {reminder && (
        <Notice tone="warning">
          <strong>Haz una copia de seguridad.</strong> <span title={reminder}>Protege tus datos.</span> <Link to="/ajustes">Hacerla ahora</Link>
        </Notice>
      )}

      <TripSummary data={data} now={now} />

      {data.trip && (
        <>
          <TripCalendar
            expanded={expanded}
            onToggle={() => {
              if (!expanded) setMonth(monthOf(selected));
              else setAnchor(selected);
              setExpanded((v) => !v);
            }}
            month={month}
            onMonthChange={setMonth}
            weekAnchor={anchor}
            onWeekChange={setAnchor}
            selected={selected}
            onSelect={select}
            today={today}
            tripStart={data.trip.startDate}
            tripEnd={data.trip.endDate}
            markers={markers}
          />
          <DayAgenda date={selected} today={today} data={data} />
        </>
      )}

      <QuickLinks />
      <Upcoming data={data} now={now} />
      <StatusStrip />
    </div>
  );
}

/** Próxima reserva y lo que falta por completar, en una sola tarjeta. */
function Upcoming({ data, now }: { data: AppData; now: number }) {
  const b = nextBooking(data.bookings, now);
  const pending = pendingInfo(data);
  return (
    <Card title="Lo próximo y lo pendiente">
      <div className="stack">
        {b ? (
          <Link to={`/reservas/${b.id}`} className="card-link-row">
            <div className="grow">
              <p className="small muted">Próxima reserva</p>
              <p className="card-title">{b.name}</p>
              <p className="muted small">
                {CATEGORY_LABEL[b.category]} · {formatLdt(b.start ?? b.checkIn)}
              </p>
            </div>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        ) : (
          <div className="stack">
            <p className="muted">No hay reservas próximas con fecha.</p>
            <LinkButton to="/reservas/nueva" variant="secondary" icon={<Ticket size={18} />}>
              Añadir reserva
            </LinkButton>
          </div>
        )}
        {pending.length > 0 && (
          <details className="pending-details">
            <summary>
              <AlertTriangle size={16} aria-hidden="true" />
              <span className="grow">
                {pending.length} {pending.length === 1 ? 'cosa por completar' : 'cosas por completar'}
              </span>
              <ChevronRight size={16} aria-hidden="true" className="pending-chevron" />
            </summary>
            <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {pending.slice(0, 8).map((p) => (
                <li key={p.key}>
                  <Link to={p.to} className="list-item">
                    <span className="grow small">{p.text}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {pending.length > 8 && <p className="muted small">Y {pending.length - 8} más.</p>}
          </details>
        )}
      </div>
    </Card>
  );
}

function TripSummary({ data, now }: { data: AppData; now: number }) {
  const { trip } = data;
  if (!trip) {
    return (
      <Card>
        <EmptyState
          icon={<Compass size={26} />}
          title="Aún no has creado el viaje"
          action={
            <LinkButton to="/viaje/editar" variant="primary">
              Crear viaje
            </LinkButton>
          }
        >
          Indica el nombre, las fechas y las ciudades. Los días del itinerario se crean automáticamente.
        </EmptyState>
      </Card>
    );
  }
  const phase = tripPhase(trip, now);
  const today = phase.phase === 'during' ? currentDay(data.days, trip, now) : null;
  return (
    <section className="hero hero-compact" aria-label="Resumen del viaje">
      <div className="hero-top">
        <div className="grow">
          <p className="hero-kicker">{formatDateRange(trip.startDate, trip.endDate)}</p>
          <h2 className="hero-title">{trip.name}</h2>
        </div>
        <LinkButton to="/viaje/editar" variant="ghost" small icon={<Pencil size={18} />} label="Editar viaje" className="hero-edit" />
      </div>
      {phase.phase === 'before' && (
        <p className="hero-count">
          <span className="hero-number">{phase.daysLeft}</span>
          <span>{phase.daysLeft === 1 ? 'día para salir' : 'días para salir'}</span>
        </p>
      )}
      {phase.phase === 'during' && (
        <p className="hero-count">
          <span className="hero-number">Día {phase.dayNumber}</span>
          <span>
            de {phase.totalDays} · {today?.city ? today.city : 'ciudad sin asignar'}
          </span>
        </p>
      )}
      {phase.phase === 'after' && <p className="hero-count"><span>El viaje ha terminado.</span></p>}
    </section>
  );
}

function QuickLinks() {
  const items = [
    { to: '/reservas?cat=alojamiento', label: 'Hoteles', icon: BedDouble },
    { to: '/reservas?cat=vuelo', label: 'Vuelos', icon: Plane },
    { to: '/mapa', label: 'Mapa', icon: Map },
    { to: '/traductor', label: 'Traductor', icon: Languages },
    { to: '/conversor', label: 'Yenes', icon: Banknote },
  ];
  return (
    <nav aria-label="Accesos rápidos" className="quick-links">
      {items.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="quick-link">
          <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Estado de un vistazo: conexión, almacenamiento y sincronización con la pareja. */
function StatusStrip() {
  const online = useOnline();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getStorageInfo()
      .then(setInfo)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  const sync = useSync();
  return (
    <section className="status-strip" aria-label="Estado de la app">
      <span className={`offline-pill${online ? '' : ' is-offline'}`}>
        <span className="dot" aria-hidden="true" />
        {online ? 'En línea' : 'Sin conexión'}
      </span>
      {error ? (
        <StatusTag tone="danger">Almacenamiento: error</StatusTag>
      ) : info === null ? (
        <StatusTag>Almacenamiento…</StatusTag>
      ) : info.persisted ? (
        <StatusTag tone="success" icon={<ShieldCheck size={12} />}>Datos protegidos</StatusTag>
      ) : (
        <StatusTag tone="warning">Almacenamiento no concedido</StatusTag>
      )}
      <Link to="/ajustes" className="sync-status-link" aria-label="Compartir con tu pareja">
        {sync.config === null ? (
          <StatusTag>Pareja: no activado</StatusTag>
        ) : sync.error ? (
          <StatusTag tone="danger">Pareja: error</StatusTag>
        ) : sync.syncing ? (
          <StatusTag tone="info">Pareja: sincronizando…</StatusTag>
        ) : (
          <StatusTag tone="success">{sync.config.lastSyncAt ? 'Pareja: sincronizado' : 'Pareja: pendiente'}</StatusTag>
        )}
      </Link>
      <LinkButton to="/sin-conexion" variant="ghost" small icon={<CloudDownload size={16} />}>
        Preparar sin conexión
      </LinkButton>
    </section>
  );
}
