import { X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Portal, useModalBehavior } from '../../ui/Modal';
import { useWakeLock } from '../../ui/useWakeLock';

/** Dirección en japonés a pantalla completa, letra muy grande y alto contraste. */
export function JapaneseAddressView({ name, address, onClose }: { name: string; address: string; onClose: () => void }) {
  const ref = useModalBehavior(true, onClose);
  useWakeLock(true);
  return (
    <Portal>
      <div ref={ref} className="fullscreen ja-address" role="dialog" aria-modal="true" aria-label="Dirección en japonés" tabIndex={-1}>
        <div className="fullscreen-bar">
          <span className="ja-address-name">{name}</span>
          <Button variant="secondary" icon={<X size={24} />} label="Cerrar" onClick={onClose} data-autofocus />
        </div>
        <div className="fullscreen-body ja-address-body">
          <p lang="ja" className="ja-address-text">
            {address}
          </p>
        </div>
      </div>
    </Portal>
  );
}
