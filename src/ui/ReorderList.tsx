import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

export interface HandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  style: { touchAction: 'none'; cursor: 'grab' };
}

interface ReorderListProps<T extends { id: string }> {
  items: T[];
  onMove: (id: string, toIndex: number) => void;
  renderItem: (item: T, index: number, handle: HandleProps, dragging: boolean) => ReactNode;
  label: string;
}

interface DragState {
  id: string;
  from: number;
  to: number;
  startY: number;
  dy: number;
  /** Centros verticales de cada elemento al empezar el arrastre. */
  centers: number[];
  height: number;
}

/**
 * Lista reordenable arrastrando un asa (funciona con dedo y ratón mediante Pointer Events).
 * La alternativa accesible (botones subir/bajar) la pone cada elemento.
 */
export function ReorderList<T extends { id: string }>({ items, onMove, renderItem, label }: ReorderListProps<T>) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const update = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const start = (id: string, index: number) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const children = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    const rects = children.map((c) => c.getBoundingClientRect());
    const self = rects[index];
    if (!self) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    update({ id, from: index, to: index, startY: e.clientY, dy: 0, centers: rects.map((r) => r.top + r.height / 2), height: self.height });

    const onMovePointer = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dy = ev.clientY - d.startY;
      const center = (d.centers[d.from] ?? 0) + dy;
      let to = d.from;
      for (let i = 0; i < d.centers.length; i++) {
        const c = d.centers[i] ?? 0;
        if (i < d.from && center < c) {
          to = i;
          break;
        }
        if (i > d.from && center > c) to = i;
      }
      update({ ...d, dy, to });
    };
    const finish = (commit: boolean) => () => {
      handle.removeEventListener('pointermove', onMovePointer);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onCancel);
      const d = dragRef.current;
      update(null);
      if (commit && d && d.to !== d.from) onMove(d.id, d.to);
    };
    const onUp = finish(true);
    const onCancel = finish(false);
    handle.addEventListener('pointermove', onMovePointer);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onCancel);
  };

  const offsetFor = (index: number): number => {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -drag.height - 8;
    if (drag.from > drag.to && index < drag.from && index >= drag.to) return drag.height + 8;
    return 0;
  };

  return (
    <ol ref={listRef} className="reorder-list" aria-label={label}>
      {items.map((item, index) => {
        const isDragging = drag?.id === item.id;
        return (
          <li
            key={item.id}
            className={isDragging ? 'reorder-item is-dragging' : 'reorder-item'}
            style={{
              transform: `translateY(${offsetFor(index)}px)`,
              transition: isDragging || !drag ? 'none' : 'transform 0.15s ease',
              zIndex: isDragging ? 2 : undefined,
            }}
          >
            {renderItem(item, index, { onPointerDown: start(item.id, index), style: { touchAction: 'none', cursor: 'grab' } }, isDragging)}
          </li>
        );
      })}
    </ol>
  );
}
