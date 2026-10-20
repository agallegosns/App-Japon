import { Hammer } from 'lucide-react';
import { EmptyState } from '../ui/States';

/** Estado honesto para pantallas que se construyen en la fase 3. */
export function PendingPhase({ what }: { what: string }) {
  return (
    <EmptyState icon={<Hammer size={26} />} title="En desarrollo — fase 3">
      {what}
    </EmptyState>
  );
}
