import { FlaskConical, Map } from 'lucide-react';
import { LinkButton } from '../../ui/Button';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState } from '../../ui/States';

export function MapPage() {
  return (
    <>
      <PageHeader title="Mapa" />
      <EmptyState
        icon={<Map size={26} />}
        title="En desarrollo — próxima fase"
        action={
          <LinkButton to="/lab#mapas" variant="secondary" icon={<FlaskConical size={18} />}>
            Ver la prueba de mapas sin conexión
          </LinkButton>
        }
      >
        El mapa sin conexión todavía no está disponible. Mientras tanto, las paradas con coordenadas o enlace se pueden
        abrir en Mapas de Apple (con conexión).
      </EmptyState>
    </>
  );
}
