export type Role = 'ADMIN' | 'RECEPCIONISTA';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE' | 'RESERVED';

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED';

export type OccupantType = 'INDIVIDUAL' | 'PAREJA' | 'MULTIPLE_PERSON';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'TRANSFER'
  | 'QR'
  | 'NEQUI_SALOMON'
  | 'NEQUI_BRAYAN';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  token: string;
  username: string;
  fullName: string;
  role: Role;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export interface RoomType {
  id: string;
  name: string;
  capacity: number;
}

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomType: RoomType;
  lastCleaned: string | null;
  observations: string | null;
}

// ─── Guests ───────────────────────────────────────────────────────────────────

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  documentType: string | null;
  documentNumber: string | null;
  observations: string | null;
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export interface ReservationCompanion {
  id: string;
  name: string;
  documentNumber: string | null;
  phone: string | null;
}

/**
 * Respuesta plana del backend — campos alineados con ReservationResponse.java
 */
export interface ReservationResponse {
  id: string;
  reservationNumber: string;

  // Huésped
  guestId: string;
  guestName: string;
  guestPhone: string;
  guestHasObservations: boolean;   // true si guest.observations != null/blank

  // Habitación (tipo, no específica)
  roomTypeId: string;
  roomTypeName: string;

  // Fechas
  checkInDate: string;             // LocalDate → "2024-04-15"
  checkOutDate: string;
  numberOfNights: number;
  numberOfGuests: number;
  occupantType: OccupantType;
  approximateArrivalTime: string | null;

  // Estado
  status: ReservationStatus;
  statusLabel: string;             // "Pendiente" | "Confirmada" | "En hotel" | "Salió" | "Cancelada"

  // Económico
  depositAmount: number | null;
  depositPaid: boolean | null;
  estimatedTotal: number | null;

  // Extras
  specialRequests: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string | null;        // LocalDateTime → ISO string

  // Acompañantes
  companions: ReservationCompanion[];

  // ── Campos opcionales que añade RoomService (planilla by-date) ──
  roomId?: string;                 // habitación pre-asignada (si la hay)
  roomNumber?: string;             // número de habitación pre-asignada
}

/**
 * Tipo legacy para el modelo anidado (entidad Reservation directa).
 * Usar ReservationResponse para todo lo que venga de la API.
 */
export interface Reservation {
  id: string;
  reservationNumber: string;
  guest: Guest;
  roomType: RoomType;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  numberOfGuests: number;
  status: string;
  depositAmount: number | null;
  estimatedTotal: number | null;
  approximateArrivalTime: string | null;
  specialRequests: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  rooms: {
    available: number;
    occupied: number;
    dirty: number;
    maintenance: number;
    total: number;
  };
  today: {
    checkIns: number;
    checkOuts: number;
  };
  towels: {
    clean: number;
    dirty: number;
    inLaundry: number;
    total: number;
  };
}