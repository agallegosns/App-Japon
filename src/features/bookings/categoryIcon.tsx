import type { ComponentType } from 'react';
import { BedDouble, MoreHorizontal, Plane, TrainFront, Ticket, UtensilsCrossed, type LucideProps } from 'lucide-react';
import type { BookingCategory, BookingStatus } from '../../models/types';
import type { Tone } from '../../ui/StatusTag';

const ICONS: Record<BookingCategory, ComponentType<LucideProps>> = {
  vuelo: Plane,
  alojamiento: BedDouble,
  restaurante: UtensilsCrossed,
  entrada: Ticket,
  transporte: TrainFront,
  otro: MoreHorizontal,
};

export function CategoryIcon({ category, size = 20 }: { category: BookingCategory; size?: number }) {
  const Icon = ICONS[category];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export const STATUS_TONE: Record<BookingStatus, Tone> = {
  pendiente: 'warning',
  confirmada: 'success',
  cancelada: 'neutral',
};
