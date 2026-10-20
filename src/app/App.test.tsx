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
          id: 'l1', from: 'Madrid (MAD)', to: 'Doha (DOH)', flightNumber: 'QR150', car: '', seat: '', fare: '',
          depart: { date: '2030-05-01', time: '14:00', tz: 'Europe/Madrid' }, arrive: { date: '2030-05-01', time: '22:30', tz: 'Asia/Qatar' },
        },
        {
          id: 'l2', from: 'Doha (DOH)', to: 'Tokio (HND)', flightNumber: 'QR812', car: '', seat: '', fare: '',
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

  it('el inicio es un calendario que enseña automáticamente lo que hay el día seleccionado', async () => {
    await seed();
    window.location.hash = '#/';
    render(<App />);
    // El viaje aún no ha empezado: se selecciona el primer día con plan (el 1 de mayo, con el vuelo).
    expect(await screen.findByRole('region', { name: 'Calendario del viaje' })).toBeInTheDocument();
    expect(screen.getByText('Mayo de 2030')).toBeInTheDocument();
    const agenda = screen.getByRole('region', { name: /Agenda del/ });
    expect(within(agenda).getByText('Vuelo QR150 Madrid (MAD) → Doha (DOH)')).toBeInTheDocument();
    expect(screen.queryByText('Próxima actividad')).toBeNull();

    // Al tocar otro día, la agenda cambia sola.
    await userEvent.click(screen.getByRole('button', { name: /jueves 2 de mayo.*día de vuelo.*1 actividad/ }));
    const agenda2 = await screen.findByRole('region', { name: /Agenda del jueves 2 de mayo/ });
    expect(within(agenda2).getByText('Cena en Shinjuku')).toBeInTheDocument();
    expect(within(agenda2).getByText('Llega a las 18:00 (hora local)')).toBeInTheDocument();
    expect(within(agenda2).getByRole('link', { name: 'Abrir el día' })).toHaveAttribute('href', '#/itinerario?fecha=2030-05-02');
  });

  it('el calendario empieza en vista de semana y se despliega al mes completo', async () => {
    await seed();
    window.location.hash = '#/';
    render(<App />);
    expect(await screen.findByText('Mayo de 2030')).toBeInTheDocument();
    // Vista compacta: solo los 7 días de la semana (29 abr – 5 may); el resto del mes no aparece.
    expect(screen.getByRole('button', { name: /jueves 2 de mayo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /viernes 10 de mayo/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /de mayo|de abril/ }).filter((b) => b.className.includes('cal-day'))).toHaveLength(7);

    await userEvent.click(screen.getByRole('button', { name: /Ver el mes completo/ }));
    expect(screen.getByRole('button', { name: /viernes 10 de mayo/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('Junio de 2030')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ir a hoy' }));
    expect(screen.queryByText('Junio de 2030')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Ver solo la semana/ }));
    expect(screen.queryByRole('button', { name: /viernes 10 de mayo/ })).toBeNull();
  });

  it('en la vista de semana las flechas cambian de semana sin cambiar el día elegido', async () => {
    await seed();
    window.location.hash = '#/';
    render(<App />);
    await screen.findByText('Mayo de 2030');
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(screen.getByRole('button', { name: /viernes 10 de mayo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /jueves 2 de mayo/ })).toBeNull();
    // el día elegido (1 de mayo) sigue siendo el de la agenda
    expect(screen.getByRole('region', { name: /Agenda del miércoles 1 de mayo/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(screen.getByRole('button', { name: /jueves 2 de mayo/ })).toBeInTheDocument();
  });

  it('el inicio resume el día y junta la próxima reserva y lo pendiente en una sola tarjeta', async () => {
    await seed();
    window.location.hash = '#/';
    render(<App />);
    const agenda = await screen.findByRole('region', { name: /Agenda del miércoles 1 de mayo/ });
    expect(within(agenda).getByText('1 vuelo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /jueves 2 de mayo/ }));
    const agenda2 = await screen.findByRole('region', { name: /Agenda del jueves 2 de mayo/ });
    expect(within(agenda2).getByText('1 actividad · 1 vuelo')).toBeInTheDocument();
    expect(screen.getByText('Lo próximo y lo pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Información pendiente')).toBeNull();
    const estado = screen.getByRole('region', { name: 'Estado de la app' });
    expect(within(estado).getByText('Pareja: no activado')).toBeInTheDocument();
    expect(within(estado).getByRole('link', { name: /Preparar sin conexión/ })).toHaveAttribute('href', '#/sin-conexion');
  });

  it('un día sin nada lo dice y deja añadir una actividad', async () => {
    await seed();
    window.location.hash = '#/';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /viernes 3 de mayo/ }));
    const agenda = await screen.findByRole('region', { name: /Agenda del viernes 3 de mayo/ });
    expect(within(agenda).getByText('No hay nada planificado este día.')).toBeInTheDocument();
    expect(within(agenda).getByRole('link', { name: 'Añadir actividad' })).toHaveAttribute('href', '#/itinerario/nueva?fecha=2030-05-03');
  });

  it('el botón ¥ ⇄ € del menú abre el conversor en cualquier pantalla', async () => {
    localStorage.setItem(FX_KEY, JSON.stringify({ eurToJpy: 160, date: '2030-01-01', source: 'manual', fetchedAt: Date.now() }));
    reloadRateFromStorage();
    window.location.hash = '#/reservas';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir el conversor de yenes y euros' }));
    await userEvent.type(await screen.findByLabelText('Yenes (¥)'), '16000');
    expect(screen.getByLabelText('Euros (€)')).toHaveValue('100');
    localStorage.clear();
    reloadRateFromStorage();
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
    expect((await screen.findAllByText(/7,50 €/)).length).toBeGreaterThan(0);
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

describe('trenes entre ciudades', () => {
  async function seedTrain() {
    const db = getDb();
    const { saveTrip, listDays, setDayCity } = await import('../storage/trips');
    const { createBooking, emptyBooking } = await import('../storage/bookings');
    const trip = await saveTrip(db, { name: 'Viaje de prueba', startDate: '2030-05-04', endDate: '2030-05-06', cities: ['Tokio', 'Kioto'], tz: 'Asia/Tokyo' });
    const days = await listDays(db, trip.id);
    await setDayCity(db, days[0]!.id, 'Tokio');
    await setDayCity(db, days[1]!.id, 'Kioto');
    await createBooking(db, {
      ...emptyBooking('transporte'),
      name: 'Tokio → Kioto',
      legs: [
        {
          id: 't1', from: 'Tokio', to: 'Kioto', flightNumber: 'Nozomi 25', car: '7', seat: '12A', fare: 'reservado',
          depart: { date: '2030-05-05', time: '09:00', tz: 'Asia/Tokyo' }, arrive: { date: '2030-05-05', time: '11:15', tz: 'Asia/Tokyo' },
        },
        {
          id: 't2', from: 'Kioto', to: 'Nara', flightNumber: '', car: '', seat: '', fare: 'suica',
          depart: { date: '2030-05-05', time: '11:40', tz: 'Asia/Tokyo' }, arrive: { date: '2030-05-05', time: '12:20', tz: 'Asia/Tokyo' },
        },
      ],
    });
  }

  it('el formulario pide vagón y asiento salvo con Suica', async () => {
    window.location.hash = '#/reservas/nueva?cat=transporte';
    render(<App />);
    const fare = await screen.findByLabelText('Trayecto 1: tipo de billete');
    expect(screen.getByLabelText('Trayecto 1: origen')).toBeInTheDocument();
    await userEvent.selectOptions(fare, 'reservado');
    expect(screen.getByLabelText('Trayecto 1: vagón')).toBeInTheDocument();
    expect(screen.getByLabelText('Trayecto 1: asiento')).toBeInTheDocument();
    await userEvent.selectOptions(fare, 'suica');
    expect(screen.queryByLabelText('Trayecto 1: vagón')).toBeNull();
    expect(screen.queryByLabelText('Trayecto 1: asiento')).toBeNull();
  });

  it('el día del tren muestra «Hoy te mueves de Tokio a Kioto» con vagón, asiento y Suica', async () => {
    await seedTrain();
    window.location.hash = '#/itinerario?fecha=2030-05-05';
    render(<App />);
    const card = await screen.findByRole('region', { name: 'Día de traslado' });
    expect(within(card).getByText('Hoy te mueves de Tokio a Kioto')).toBeInTheDocument();
    expect(within(card).getByText('Vagón 7 · asiento 12A')).toBeInTheDocument();
    expect(within(card).getByText('Con Suica: pasa la tarjeta, sin asiento')).toBeInTheDocument();
    expect(within(card).getByText('Transbordo en Kioto: 25 min')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /día de traslado en tren/ })).toBeInTheDocument();
  });

  it('el calendario del inicio marca el día de tren y su agenda lo lista', async () => {
    await seedTrain();
    window.location.hash = '#/';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /domingo 5 de mayo.*día de traslado en tren/ }));
    const agenda = await screen.findByRole('region', { name: /Agenda del domingo 5 de mayo/ });
    expect(within(agenda).getByText('Nozomi 25: Tokio → Kioto')).toBeInTheDocument();
    expect(within(agenda).getByText('Vagón 7 · asiento 12A · llega a las 11:15')).toBeInTheDocument();
    expect(within(agenda).getByText('Con Suica · llega a las 12:20')).toBeInTheDocument();
  });
});

describe('compartir con tu pareja', () => {
  const ORIGIN = 'https://agallegosns.github.io';
  async function nube() {
    const { default: worker } = await import('../../cloudflare/worker.js');
    const { FakeKV } = await import('../test/fakeKv');
    const { SyncApi } = await import('../sync/api');
    const { resetSyncForTests } = await import('../sync/service');
    const kv = new FakeKV();
    const api = new SyncApi('https://sync.test', async (input, init) =>
      worker.fetch(new Request(input, { ...init, headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN } }), { DATA: kv }),
    );
    resetSyncForTests(api);
    return { kv, api };
  }
  afterEach(async () => {
    const { resetSyncForTests } = await import('../sync/service');
    resetSyncForTests();
  });

  it('crear el código sube los datos cifrados y deja ver, ocultar y copiar el código', async () => {
    const { kv } = await nube();
    const db = getDb();
    const { saveTrip } = await import('../storage/trips');
    const { createBooking, emptyBooking } = await import('../storage/bookings');
    await saveTrip(db, { name: 'Viaje secreto', startDate: '2030-05-01', endDate: '2030-05-02', cities: [], tz: 'Asia/Tokyo' });
    await createBooking(db, { ...emptyBooking('alojamiento'), name: 'Hotel Privado' });

    window.location.hash = '#/ajustes';
    render(<App />);
    expect(await screen.findByText('Compartir con tu pareja')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear código para compartir' }));
    expect(await screen.findByText('Compartiendo con tu pareja')).toBeInTheDocument();
    expect(await screen.findByText(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar código' }));
    expect(screen.getByText('•••••-•••••-•••••-•••••')).toBeInTheDocument();

    await waitFor(() => expect(kv.store.size).toBeGreaterThanOrEqual(4)); // viaje, 2 días y reserva
    const todo = JSON.stringify([...kv.store.values()].map((e) => e.value));
    expect(todo).not.toContain('Hotel Privado');
    expect(todo).not.toContain('Viaje secreto');
  });

  it('un código mal escrito da un error claro', async () => {
    await nube();
    window.location.hash = '#/ajustes';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ya tengo un código de mi pareja' }));
    await userEvent.type(screen.getByLabelText('Código del viaje'), 'ABC');
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    expect(await screen.findByText(/El código no es válido/)).toBeInTheDocument();
  });

  it('unirse con el código de tu pareja descarga su viaje en un móvil vacío', async () => {
    const { api } = await nube();
    const { freshDb } = await import('../test/helpers');
    const { deriveCredentials, generateCode } = await import('../sync/crypto');
    const { syncNow } = await import('../sync/engine');
    const { saveTrip } = await import('../storage/trips');
    const { createBooking, emptyBooking } = await import('../storage/bookings');
    const code = generateCode();
    const pareja = freshDb();
    await saveTrip(pareja, { name: 'Viaje de los dos', startDate: '2030-05-01', endDate: '2030-05-02', cities: [], tz: 'Asia/Tokyo' });
    await createBooking(pareja, { ...emptyBooking('restaurante'), name: 'Cena compartida' });
    await syncNow(pareja, api, await deriveCredentials(code));
    await pareja.delete();

    window.location.hash = '#/ajustes';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ya tengo un código de mi pareja' }));
    await userEvent.type(screen.getByLabelText('Código del viaje'), code.toLowerCase());
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    await waitFor(async () => expect(await getDb().bookings.count()).toBe(1));
    expect((await getDb().bookings.toArray())[0]?.name).toBe('Cena compartida');
    expect((await getDb().trips.toArray())[0]?.name).toBe('Viaje de los dos');
  });

  it('si este móvil ya tiene datos, pide confirmación antes de sustituirlos', async () => {
    const { api } = await nube();
    const { freshDb } = await import('../test/helpers');
    const { deriveCredentials, generateCode } = await import('../sync/crypto');
    const { syncNow } = await import('../sync/engine');
    const { createBooking, emptyBooking } = await import('../storage/bookings');
    const code = generateCode();
    const pareja = freshDb();
    await createBooking(pareja, { ...emptyBooking('otro'), name: 'De mi pareja' });
    await syncNow(pareja, api, await deriveCredentials(code));
    await pareja.delete();
    await createBooking(getDb(), { ...emptyBooking('otro'), name: 'Mío, se perderá' });

    window.location.hash = '#/ajustes';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ya tengo un código de mi pareja' }));
    await userEvent.type(screen.getByLabelText('Código del viaje'), code);
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    expect(await screen.findByText('Este móvil ya tiene datos')).toBeInTheDocument();
    expect((await getDb().bookings.toArray()).map((b) => b.name)).toEqual(['Mío, se perderá']); // todavía no se ha tocado nada
    await userEvent.click(screen.getByRole('button', { name: 'Sustituir por los de la nube' }));
    await waitFor(async () => expect((await getDb().bookings.toArray()).map((b) => b.name)).toEqual(['De mi pareja']));
  });

  it('dejar de compartir conserva los datos y vuelve a mostrar las opciones', async () => {
    await nube();
    const { createBooking, emptyBooking } = await import('../storage/bookings');
    await createBooking(getDb(), { ...emptyBooking('otro'), name: 'Se queda' });
    window.location.hash = '#/ajustes';
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Crear código para compartir' }));
    await screen.findByText('Compartiendo con tu pareja');
    await userEvent.click(screen.getByText('Opciones'));
    await userEvent.click(screen.getByRole('button', { name: 'Dejar de compartir en este móvil' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Dejar de compartir' }));
    expect(await screen.findByRole('button', { name: 'Crear código para compartir' })).toBeInTheDocument();
    expect(await getDb().bookings.count()).toBe(1);
  });
});
