import { WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useOnline } from '../app/useConnectivity';
import { EmptyState } from './States';

/**
 * Pantallas que necesitan Internet (traductor, mapa): sin conexión muestran un aviso claro.
 * Las reservas y el itinerario no pasan por aquí: funcionan siempre.
 */
export function OnlineGate({ feature, children }: { feature: string; children: ReactNode }) {
  const online = useOnline();
  if (online) return <>{children}</>;
  return (
    <EmptyState icon={<WifiOff size={26} />} title="Sin conexión en este momento">
      {feature} necesita Internet. Tus reservas, documentos e itinerario siguen disponibles sin conexión.
    </EmptyState>
  );
}
