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
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnline } from '../../app/useConnectivity';
import { capitalize, formatDateRange, formatDayLong, formatLdt } from '../../models/datetime';
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
import { DayPlan } from './DayPlan';
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
  const reminder = backupReminder(data.backup, hasAnyData(data), now);
  const pending = pendingInfo(data);

  return (
    <div className="stack-lg">
      {reminder && (
        <Notice tone="warning">
          <strong>Haz una copia de seguridad.</strong> {reminder}{' '}
          <Link to="/ajustes">Ir a Ajustes</Link>
        </Notice>
      )}

      <TripSummary data={data} now={now} />

      <QuickLinks />

      <DayPlan data={data} trip={data.trip} />

      <Card title="Próxima reserva">
        {(() => {
          const b = nextBooking(data.bookings, now);
          if (!b)
            return (
              <div className="stack">
                <p className="muted">No hay reservas próximas con fecha.</p>
                <LinkButton to="/reservas/nueva" variant="secondary" icon={<Ticket size={18} />}>
                  Añadir reserva
                </LinkButton>
              </div>
            );
          return (
            <Link to={`/reservas/${b.id}`} className="card-link-row">
              <div className="grow">
                <p className="card-title">{b.name}</p>
                <p className="muted small">
                  {CATEGORY_LABEL[b.category]} · {formatLdt(b.start ?? b.checkIn)}
                </p>
              </div>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          );
        })()}
      </Card>

      {pending.length > 0 && (
        <Card
          title="Información pendiente"
          action={<StatusTag tone="warning" icon={<AlertTriangle size={12} />}>{pending.length}</StatusTag>}
        >
          <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {pending.slice(0, 6).map((p) => (
              <li key={p.key}>
                <Link to={p.to} className="list-item">
                  <span className="grow small">{p.text}</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {pending.length > 6 && <p className="muted small" style={{ marginTop: 'var(--sp-2)' }}>Y {pending.length - 6} más.</p>}
        </Card>
      )}

      <OfflineStatus />
    </div>
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
    <section className="hero" aria-label="Resumen del viaje">
      <div className="hero-top">
        <div className="grow">
          <p className="hero-kicker">
            {formatDateRange(trip.startDate, trip.endDate)}
            {trip.cities.length > 0 && ` · ${trip.cities.join(', ')}`}
          </p>
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
            de {phase.totalDays} · {capitalize(formatDayLong(phase.today))}
            {' · '}
            {today?.city ? today.city : 'ciudad sin asignar'}
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

function OfflineStatus() {
  const online = useOnline();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getStorageInfo()
      .then(setInfo)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return (
    <Card title="Estado sin conexión">
      <div className="stack">
        <div className="spread">
          <span>Conexión</span>
          <span className={`offline-pill${online ? '' : ' is-offline'}`}>
            <span className="dot" aria-hidden="true" />
            {online ? 'En línea' : 'Sin conexión'}
          </span>
        </div>
        <div className="spread">
          <span>Almacenamiento persistente</span>
          {error ? (
            <StatusTag tone="danger">Error</StatusTag>
          ) : info === null ? (
            <StatusTag>Comprobando…</StatusTag>
          ) : info.persisted ? (
            <StatusTag tone="success" icon={<ShieldCheck size={12} />}>Concedido</StatusTag>
          ) : (
            <StatusTag tone="warning">No concedido</StatusTag>
          )}
        </div>
        <LinkButton to="/sin-conexion" variant="secondary" block icon={<CloudDownload size={18} />}>
          Preparar Japón sin conexión
        </LinkButton>
      </div>
    </Card>
  );
}
