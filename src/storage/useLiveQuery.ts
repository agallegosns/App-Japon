import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

export type LiveResult<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ok'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: unknown };

/** Suscripción reactiva a una consulta de Dexie (se actualiza al cambiar los datos). */
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[]): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ status: 'loading', data: undefined, error: undefined });
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (data) => setState({ status: 'ok', data, error: undefined }),
      error: (error: unknown) => setState({ status: 'error', data: undefined, error }),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las dependencias las indica el llamador
  }, deps);
  return state;
}
