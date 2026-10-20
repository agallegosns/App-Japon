import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '../storage/db';
import { FX_KEY } from '../storage/fxRate';
import { reloadRateFromStorage } from '../storage/useFxRate';
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

describe('yenes y euros', () => {
  function fixedRate(eurToJpy = 160) {
    localStorage.setItem(FX_KEY, JSON.stringify({ eurToJpy, date: '2030-01-01', source: 'manual', fetchedAt: Date.now() }));
    reloadRateFromStorage();
  }
  afterEach(() => {
    localStorage.clear();
    reloadRateFromStorage();
    vi.unstubAllGlobals();
  });

  it('el conversor calcula en los dos sentidos', async () => {
    fixedRate(160);
    window.location.hash = '#/conversor';
    render(<App />);
    const yen = await screen.findByLabelText('Yenes (¥)');
    const eur = screen.getByLabelText('Euros (€)');
    await userEvent.type(yen, '16000');
    expect(eur).toHaveValue('100');
    await userEvent.clear(eur);
    await userEvent.type(eur, '2,5');
    expect(yen).toHaveValue('400');
    await userEvent.clear(yen);
    expect(eur).toHaveValue('');
  });

  it('desde el inicio se llega al conversor', async () => {
    window.location.hash = '#/';
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Yenes' })).toHaveAttribute('href', '#/conversor');
  });

  it('el precio de una reserva muestra el equivalente en la otra moneda', async () => {
    fixedRate(160);
    window.location.hash = '#/reservas/nueva';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: '¥ JPY' }));
    await userEvent.type(screen.getByLabelText('Importe (opcional)'), '16.000');
    expect(await screen.findByText(/100,00 €/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '€ EUR' }));
    expect(await screen.findByText(/2\.560.*¥/)).toBeInTheDocument();
  });

  it('un alojamiento permite añadir tasas y calcula su total', async () => {
    fixedRate(160);
    window.location.hash = '#/reservas/nueva?cat=alojamiento';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tasa de alojamiento' }));
    await userEvent.type(screen.getByLabelText('Tasa 1: importe'), '200');
    await userEvent.type(screen.getByLabelText('Check-in: fecha'), '2030-05-02');
    await userEvent.type(screen.getByLabelText('Check-out: fecha'), '2030-05-05');
    // 200 ¥ × 2 personas × 3 noches = 1.200 ¥ (7,50 € con 160 ¥/€)
    expect(await screen.findAllByText(/1\.200 ¥/)).not.toHaveLength(0);
    expect(screen.getAllByText(/7,50 €/).length).toBeGreaterThan(0);
  });

  it('ya no existe la dirección en japonés', async () => {
    window.location.hash = '#/reservas/nueva?cat=alojamiento';
    render(<App />);
    await screen.findByRole('button', { name: 'Guardar reserva' });
    expect(screen.queryByLabelText(/japonés/i)).toBeNull();
    expect(screen.queryByText(/japonés/i)).toBeNull();
  });
});

describe('línea de tiempo del día', () => {
  it('ofrece ordenar por hora cuando las actividades están desordenadas y lo hace', async () => {
    const db = getDb();
    const { saveTrip } = await import('../storage/trips');
    const { createActivity, emptyActivity } = await import('../storage/activities');
    await saveTrip(db, { name: 'Viaje', startDate: '2030-05-01', endDate: '2030-05-02', cities: ['Tokio'], tz: 'Asia/Tokyo' });
    await createActivity(db, { ...emptyActivity('2030-05-01'), title: 'Cena', startTime: '20:00' });
    await createActivity(db, { ...emptyActivity('2030-05-01'), title: 'Desayuno', startTime: '08:00' });
    window.location.hash = '#/itinerario?fecha=2030-05-01';
    render(<App />);
    const sort = await screen.findByRole('button', { name: 'Ordenar por hora' });
    const titles = () => screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(titles()).toEqual(['Cena', 'Desayuno']);
    await userEvent.click(sort);
    await waitFor(() => expect(titles()).toEqual(['Desayuno', 'Cena']));
    expect(screen.queryByRole('button', { name: 'Ordenar por hora' })).toBeNull();
  });
});
