import { Map } from 'lucide-react';
import { OnlineGate } from '../../ui/OnlineGate';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState } from '../../ui/States';

export function MapPage() {
  return (
    <>
      <PageHeader title="Mapa" />
      <OnlineGate feature="El mapa">
        <EmptyState icon={<Map size={26} />} title="Mapa en desarrollo">
          El mapa necesitará conexión a Internet. Mientras tanto, las actividades del itinerario con coordenadas o enlace se pueden abrir en Mapas
          de Apple desde su menú.
        </EmptyState>
      </OnlineGate>
    </>
  );
}
