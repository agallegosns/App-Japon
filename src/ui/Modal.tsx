import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

let openCount = 0;

/** Base de overlays: portal, bloqueo de scroll, Escape y foco inicial/retorno. */
export function useModalBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    openCount++;
    document.body.style.overflow = 'hidden';
    const focusTarget = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current;
    focusTarget?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openCount--;
      if (openCount === 0) document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  return panelRef;
}

export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
