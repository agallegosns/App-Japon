import { Sun, X } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { Attachment } from '../../models/types';
import { Button } from '../../ui/Button';
import { Portal, useModalBehavior } from '../../ui/Modal';
import { LoadingState } from '../../ui/States';
import { useObjectUrl } from '../../ui/useObjectUrl';
import { useWakeLock } from '../../ui/useWakeLock';

const PdfView = lazy(() => import('./PdfView').then((m) => ({ default: m.PdfView })));

/** Visor a pantalla completa de PDF, imágenes y códigos QR/de barras. */
export function AttachmentViewer({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const ref = useModalBehavior(true, onClose);
  const isCode = attachment.kind === 'code';
  const wake = useWakeLock(isCode);
  const url = useObjectUrl(attachment.kind === 'pdf' ? null : attachment.blob);

  return (
    <Portal>
      <div
        ref={ref}
        className={`fullscreen${isCode || attachment.kind === 'pdf' ? '' : ' fullscreen-dark'}`}
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
        {isCode && (
          <div className="code-hint" role="note">
            <Sun size={18} aria-hidden="true" />
            <span>
              Sube el brillo de la pantalla al máximo para que el lector lo detecte.
              {wake === 'active' && ' La pantalla no se apagará mientras esté abierto.'}
            </span>
          </div>
        )}
        <div className="fullscreen-body viewer-body">
          {attachment.kind === 'pdf' ? (
            <Suspense fallback={<LoadingState label="Cargando visor…" />}>
              <PdfView blob={attachment.blob} />
            </Suspense>
          ) : (
            url && <img src={url} alt={attachment.name} className={isCode ? 'viewer-code' : 'viewer-image'} />
          )}
        </div>
      </div>
    </Portal>
  );
}
