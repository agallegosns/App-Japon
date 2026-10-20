import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { errorMessage } from '../ui/States';
import { usePwaState } from './pwaState';
import { isStandalone } from './standalone';

/** Avisos que se muestran en todas las pantallas. */
export function GlobalBanners() {
  const pwa = usePwaState();
  const [standalone] = useState(isStandalone);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  return (
    <div className="global-banners">
      {!standalone && (
        <Notice tone="warning" role="status">
          <strong>Instala la app para que tus datos se conserven.</strong>
          <br />
          Safari: Compartir → «Añadir a pantalla de inicio» y ábrela desde ese icono.
        </Notice>
      )}
      {pwa.needRefresh && pwa.applyUpdate && (
        <div className="update-banner" role="status" aria-live="polite">
          <div className="update-banner-head">
            <span className="update-banner-icon" aria-hidden="true">
              <Sparkles size={22} />
            </span>
            <div>
              <strong className="update-banner-title">Actualización disponible</strong>
              <span className="update-banner-text">Hay una versión nueva de la app. Tus datos no se tocan.</span>
            </div>
          </div>
          <Button
            variant="secondary"
            block
            icon={updating ? <RefreshCw size={20} className="spin" /> : <Download size={20} />}
            disabled={updating}
            onClick={async () => {
              setUpdating(true);
              setUpdateError(null);
              try {
                await pwa.applyUpdate?.();
              } catch (e) {
                setUpdateError(errorMessage(e));
                setUpdating(false);
              }
            }}
          >
            {updating ? 'Actualizando…' : 'Actualizar ahora'}
          </Button>
          {updateError && <p className="update-banner-error">{updateError}</p>}
        </div>
      )}
    </div>
  );
}
