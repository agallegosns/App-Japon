/** Fecha y hora local en una zona IANA. La hora es opcional. */
export interface LocalDateTime {
  /** AAAA-MM-DD */
  date: string;
  /** HH:mm (24 h) o null si no se conoce */
  time: string | null;
  /** Zona IANA, p. ej. Asia/Tokyo */
  tz: string;
}

export const DEFAULT_TZ = 'Asia/Tokyo';

export interface Trip {
  id: string;
  name: string;
  /** AAAA-MM-DD */
  startDate: string;
  /** AAAA-MM-DD */
  endDate: string;
  cities: string[];
  tz: string;
  createdAt: number;
  updatedAt: number;
}

export interface Day {
  id: string;
  tripId: string;
  /** AAAA-MM-DD */
  date: string;
  city: string;
  /**
   * Alojamiento elegido a mano para la noche de este día. null = automático
   * (según check-in y check-out de las reservas de alojamiento).
   */
  lodgingId: string | null;
}

export const BOOKING_CATEGORIES = [
  'vuelo',
  'alojamiento',
  'restaurante',
  'entrada',
  'transporte',
  'otro',
] as const;
export type BookingCategory = (typeof BOOKING_CATEGORIES)[number];

export const BOOKING_STATUSES = ['pendiente', 'confirmada', 'cancelada'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface ExternalLink {
  label: string;
  url: string;
}

export interface Money {
  amount: number;
  currency: string;
}

/** Un tramo de un vuelo (un vuelo con escalas tiene varios). */
export interface FlightLeg {
  id: string;
  /** Aeropuerto o ciudad de salida, p. ej. «Madrid (MAD)». */
  from: string;
  /** Aeropuerto o ciudad de llegada. */
  to: string;
  /** Número de vuelo (opcional). */
  flightNumber: string;
  depart: LocalDateTime | null;
  arrive: LocalDateTime | null;
}

export interface Booking {
  id: string;
  name: string;
  category: BookingCategory;
  status: BookingStatus;
  /** Fecha y hora principal (salida en vuelos y trenes; zona de origen). */
  start: LocalDateTime | null;
  /** Hora de llegada (en vuelos, con la zona de destino). */
  arrival: LocalDateTime | null;
  checkIn: LocalDateTime | null;
  checkOut: LocalDateTime | null;
  address: string;
  addressJa: string;
  /** Tramos de un vuelo con escalas. Vacío en el resto de categorías. */
  legs: FlightLeg[];
  price: Money | null;
  phone: string;
  contact: string;
  notes: string;
  links: ExternalLink[];
  /** Instante (ms) usado para ordenar; null si no hay fecha. Derivado. */
  sortAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export const ATTACHMENT_KINDS = ['pdf', 'image'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export interface Attachment {
  id: string;
  bookingId: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

export const ACTIVITY_STATUSES = ['pendiente', 'hecha', 'omitida'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export type MapRef =
  | { type: 'coords'; lat: number; lng: number }
  | { type: 'url'; url: string };

export interface Activity {
  id: string;
  title: string;
  /** AAAA-MM-DD */
  date: string;
  /** HH:mm o null */
  startTime: string | null;
  endTime: string | null;
  tz: string;
  location: string;
  address: string;
  addressJa: string;
  durationMin: number | null;
  notes: string;
  bookingId: string | null;
  status: ActivityStatus;
  mapRef: MapRef | null;
  /** Posición dentro del día (0, 1, 2…). */
  order: number;
  createdAt: number;
  updatedAt: number;
}
