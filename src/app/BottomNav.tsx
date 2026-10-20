import { CalendarDays, Compass, Languages, Map, Ticket } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/', label: 'Viaje', icon: Compass, end: true },
  { to: '/itinerario', label: 'Itinerario', icon: CalendarDays, end: false },
  { to: '/mapa', label: 'Mapa', icon: Map, end: false },
  { to: '/traductor', label: 'Traductor', icon: Languages, end: false },
  { to: '/reservas', label: 'Reservas', icon: Ticket, end: false },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Secciones">
      <ul>
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
