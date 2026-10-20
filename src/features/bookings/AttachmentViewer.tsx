import { X } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { Attachment } from '../../models/types';
import { Button } from '../../ui/Button';
import { Portal, useModalBehavior } from '../../ui/Modal';
import { LoadingState } from '../../ui/States';
import { useObjectUrl } from '../../ui/useObjectUrl';

const PdfView = lazy(() => import('./PdfView').then((m) => ({ default: m.PdfView })));

/** Visor a pantalla completa de PDF e imágenes. */
export function AttachmentViewer({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const ref = useModalBehavior(true, onClose);
  const url = useObjectUrl(attachment.kind === 'pdf' ? null : attachment.blob);

  return (
    <Portal>
      <div
        ref={ref}
        className={`fullscreen${attachment.kind === 'pdf' ? '' : ' fullscreen-dark'}`}
        role="dialog"
        aria-modal="true"
        aria-label={attachment.name}
        tabIndex={-1}
      >
        <div className="fullscreen-bar">
          <span className="grow break small" style={{ fontWeight: 600 }}>
            {attachment.name}
          </span>
          <Button variant="secondary" icon={<X size={24} />} label="Cerrar" onClick={onClose} data-autofocus />
        </div>
        <div className="fullscreen-body viewer-body">
          {attachment.kind === 'pdf' ? (
            <Suspense fallback={<LoadingState label="Cargando visor…" />}>
              <PdfView blob={attachment.blob} />
            </Suspense>
          ) : (
            url && <img src={url} alt={attachment.name} className="viewer-image" />
          )}
        </div>
      </div>
    </Portal>
  );
}
