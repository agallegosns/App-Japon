import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

// Los tests NUNCA usan la red real: en GitHub Actions hay Internet y una respuesta tardía de la cotización
// del BCE cambiaría los importes esperados. Los tests que necesitan fetch lo sustituyen con su propio mock.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch (sin red en los tests)');
    }),
  );
});
