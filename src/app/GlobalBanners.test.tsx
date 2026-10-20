import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobalBanners } from './GlobalBanners';
import { setPwaState } from './pwaState';

afterEach(() => setPwaState({ needRefresh: false, applyUpdate: null }));

describe('aviso de actualización', () => {
  it('no aparece si no hay versión nueva', () => {
    render(<GlobalBanners />);
    expect(screen.queryByText('Actualización disponible')).toBeNull();
  });

  it('aparece grande y «Actualizar ahora» aplica la actualización', async () => {
    const apply = vi.fn(async () => undefined);
    render(<GlobalBanners />);
    act(() => setPwaState({ needRefresh: true, applyUpdate: apply }));
    expect(await screen.findByText('Actualización disponible')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('si la actualización falla, muestra el error y deja volver a intentarlo', async () => {
    const apply = vi.fn(async () => {
      throw new Error('sin red');
    });
    render(<GlobalBanners />);
    act(() => setPwaState({ needRefresh: true, applyUpdate: apply }));
    await userEvent.click(await screen.findByRole('button', { name: 'Actualizar ahora' }));
    expect(await screen.findByText('sin red')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar ahora' })).toBeEnabled();
  });
});
