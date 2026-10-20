import { Compass } from 'lucide-react';
import { LinkButton } from '../ui/Button';
import { EmptyState } from '../ui/States';

export function NotFoundPage() {
  return (
    <EmptyState icon={<Compass size={26} />} title="Esta pantalla no existe" action={<LinkButton to="/" variant="primary">Ir a Viaje</LinkButton>} />
  );
}
