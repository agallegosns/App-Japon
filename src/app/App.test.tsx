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
