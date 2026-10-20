import type { Activity } from './types';

type Sortable = Pick<Activity, 'allDay' | 'startTime' | 'order'>;

/** Grupo de orden: 0 = todo el día, 1 = con hora, 2 = sin hora. */
function group(a: Sortable): number {
  if (a.allDay) return 0;
  return a.startTime ? 1 : 2;
}

/** Orden cronológico: primero las de todo el día, luego por hora y, al final, las que no tienen hora. */
export function compareByTime(a: Sortable, b: Sortable): number {
  const ga = group(a);
  const gb = group(b);
  if (ga !== gb) return ga - gb;
  if (ga === 1) {
    const t = (a.startTime ?? '').localeCompare(b.startTime ?? '');
    if (t !== 0) return t;
  }
  return a.order - b.order;
}

/** ¿Las actividades (ya en su orden manual) están ordenadas por hora? */
export function isChronological(list: Sortable[]): boolean {
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    if (prev && cur && compareByTime(prev, cur) > 0) return false;
  }
  return true;
}
