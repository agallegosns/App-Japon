import { X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { Portal, useModalBehavior } from './Modal';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const panelRef = useModalBehavior(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return (
    <Portal>
      <div className="overlay" onClick={onClose}>
        <div
          ref={panelRef}
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sheet-grip" aria-hidden="true" />
          <div className="sheet-header">
            <h2 id={titleId}>{title}</h2>
            <Button variant="ghost" icon={<X size={22} />} label="Cerrar" onClick={onClose} />
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}
