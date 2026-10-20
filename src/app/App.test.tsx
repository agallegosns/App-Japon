import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '../storage/db';
import { App } from './App';

beforeAll(() => {
  // jsdom no implementa scrollTo/scrollIntoView
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(async () => {
  await getDb().delete();
  await getDb().open();
  window.location.hash = '';
});

describe('App', () => {
  it('muestra estados vacíos honestos y la navegación de 5 secciones', async () => {
    render(<App />);
    expect(await screen.findByText('Aún no has creado el viaje')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    for (const name of ['Viaje', 'Itinerario', 'Mapa', 'Traductor', 'Reservas']) {
      expect(nav).toHaveTextContent(name);
    }
    await userEvent.click(within(nav).getByRole('link', { name: /Mapa/ }));
    expect(await screen.findByText('Mapa en desarrollo')).toBeInTheDocument();
  });

  it('valida y crea una reserva desde el formulario', async () => {
    window.location.hash = '#/reservas/nueva';
    render(<App />);
    const save = await screen.findByRole('button', { name: 'Guardar reserva' });
    await userEvent.click(save);
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(await getDb().bookings.count()).toBe(0);

    await userEvent.type(screen.getByLabelText('Nombre'), 'Museo de prueba');
    expect(screen.queryByLabelText('Localizador')).toBeNull();
    await userEvent.click(save);
    expect(await screen.findByRole('heading', { name: 'Museo de prueba' })).toBeInTheDocument();
    expect(await getDb().bookings.count()).toBe(1);
  });
});

describe('pantallas que necesitan conexión', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });

  for (const [route, name] of [
    ['#/traductor', /Traductor/],
    ['#/mapa', /Mapa/],
  ] as const) {
    it(`${route}: sin conexión muestra el aviso y con conexión vuelve a funcionar`, async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.location.hash = route;
      render(<App />);
      expect(await screen.findByText('Sin conexión en este momento')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Abrir cámara' })).toBeNull();
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
      await waitFor(() => expect(screen.queryByText('Sin conexión en este momento')).toBeNull());
      expect(name).toBeDefined();
    });
  }

  it('el traductor con conexión ofrece abrir la cámara', async () => {
    window.location.hash = '#/traductor';
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Abrir cámara' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hacer una foto' })).toBeInTheDocument();
  });
});

describe('itinerario, día de vuelo y calendario', () => {
  async function seed() {
    const db = getDb();
    const { saveTrip } = await import('../storage/trips');
    const { createBooking, emptyBooking } = await import('../storage/bookings');
    const { createActivity, emptyActivity } = await import('../storage/activities');
    await saveTrip(db, { name: 'Viaje de prueba', startDate: '2030-05-01', endDate: '2030-05-03', cities: ['Tokio'], tz: 'Asia/Tokyo' });
    await createBooking(db, {
      ...emptyBooking('vuelo'),
      name: 'Madrid → Tokio',
      legs: [
        {
          id: 'l1', from: 'Madrid (MAD)', to: 'Doha (DOH)', flightNumber: 'QR150',
          depart: { date: '2030-05-01', time: '14:00', tz: 'Europe/Madrid' }, arrive: { date: '2030-05-01', time: '22:30', tz: 'Asia/Qatar' },
        },
        {
          id: 'l2', from: 'Doha (DOH)', to: 'Tokio (HND)', flightNumber: 'QR812',
          depart: { date: '2030-05-02', time: '01:15', tz: 'Asia/Qatar' }, arrive: { date: '2030-05-02', time: '18:00', tz: 'Asia/Tokyo' },
        },
      ],
    });
    await createActivity(db, { ...emptyActivity('2030-05-02'), title: 'Cena en Shinjuku', startTime: '20:00' });
  }

  it('un día con vuelo se distingue y las actividades se llaman «actividades»', async () => {
    await seed();
    window.location.hash = '#/itinerario?fecha=2030-05-02';
    render(<App />);
    expect(await screen.findByText('Día de vuelo')).toBeInTheDocument();
    expect(screen.getByText('Escala en Doha (DOH): 2 h 45 min')).toBeInTheDocument();
    // Los días 1 y 2 del selector están marcados como día de vuelo (salida y llegada).
    expect(screen.getAllByRole('button', { name: /día de vuelo/ })).toHaveLength(2);
    expect(screen.getByText('Actividades del día')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Añadir actividad' })).toBeInTheDocument();
    expect(screen.queryByText(/parada/i)).toBeNull();
  });

  it('un día sin vuelo no muestra el bloque de vuelo', async () => {
    await seed();
    window.location.hash = '#/itinerario?fecha=2030-05-03';
    render(<App />);
    expect(await screen.findByText('Aún no hay actividades este día')).toBeInTheDocument();
    expect(screen.queryByText('Día de vuelo')).toBeNull();
  });

  it('el inicio muestra el itinerario en lugar de «próxima actividad»', async () => {
    await seed();
    window.location.hash = '#/';
    render(<App />);
    expect(await screen.findByText('Próximo día con plan')).toBeInTheDocument();
    expect(screen.getByText('Vuelo QR150 Madrid (MAD) → Doha (DOH)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el itinerario completo' })).toBeInTheDocument();
    expect(screen.queryByText('Próxima actividad')).toBeNull();
  });

  it('Ajustes explica las notificaciones y avisa si no hay nada que exportar al calendario', async () => {
    window.location.hash = '#/ajustes';
    render(<App />);
    expect(await screen.findByText('Avisos en el iPhone')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Añadir al Calendario del iPhone' }));
    expect(await screen.findByText(/Aún no hay actividades ni reservas con fecha/)).toBeInTheDocument();
  });
});
