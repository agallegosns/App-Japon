import { render, screen, within } from '@testing-library/react';
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
    expect(await screen.findByText('En desarrollo — próxima fase')).toBeInTheDocument();
  });

  it('valida y crea una reserva desde el formulario', async () => {
    window.location.hash = '#/reservas/nueva';
    render(<App />);
    const save = await screen.findByRole('button', { name: 'Guardar reserva' });
    await userEvent.click(save);
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(await getDb().bookings.count()).toBe(0);

    await userEvent.type(screen.getByLabelText('Nombre'), 'Museo de prueba');
    await userEvent.type(screen.getByLabelText('Localizador'), 'XYZ9');
    await userEvent.click(save);
    expect(await screen.findByRole('heading', { name: 'Museo de prueba' })).toBeInTheDocument();
    expect(await screen.findByText('XYZ9')).toBeInTheDocument();
    expect(await getDb().bookings.count()).toBe(1);
  });
});
