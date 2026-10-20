import { Download, RefreshCw } from 'lucide-react';
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
        <Notice tone="info" role="status">
          <div className="spread">
            <span>
              <strong>Actualización disponible.</strong> Tus datos no se tocan.
            </span>
            <Button
              variant="primary"
              small
              icon={updating ? <RefreshCw size={16} /> : <Download size={16} />}
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
              Actualizar
            </Button>
          </div>
          {updateError && <p className="field-error">{updateError}</p>}
        </Notice>
      )}
    </div>
  );
}
