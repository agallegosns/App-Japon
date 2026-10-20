import type { ActivityStatus, AttachmentKind, BookingCategory, BookingStatus } from './types';

export const CATEGORY_LABEL: Record<BookingCategory, string> = {
  vuelo: 'Vuelo',
  alojamiento: 'Alojamiento',
  restaurante: 'Restaurante',
  entrada: 'Entrada / actividad',
  transporte: 'Tren / transporte',
  otro: 'Otro',
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
};

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  pendiente: 'Pendiente',
  hecha: 'Hecha',
  omitida: 'Omitida',
};

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  pdf: 'PDF',
  image: 'Imagen',
};
