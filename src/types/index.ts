export type Role = 'ADMIN' | 'RECEPCIONISTA';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE' | 'RESERVED';

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED';

export type OccupantType = 'INDIVIDUAL' | 'PAREJA' | 'MULTIPLE_PERSON';

/**
 * Código del método de pago. Ya no es un union type fijo —
 * los valores vienen dinámicamente desde la tabla payment_methods en BD.
 * Ejemplos: "CASH", "CARD", "NEQUI_SALOMON", o cualquier código que cree el admin.
 */
export type PaymentMethod = string;

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

export interface ReservationResponse {
  id: string;
  reservationNumber: string;

  guestId: string;
  guestName: string;
  guestPhone: string;
  guestHasObservations: boolean;

  roomTypeId: string;
  roomTypeName: string;

  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  numberOfGuests: number;
  occupantType: OccupantType;
  approximateArrivalTime: string | null;

  status: ReservationStatus;
  statusLabel: string;

  depositAmount: number | null;
  depositPaid: boolean | null;
  estimatedTotal: number | null;

  specialRequests: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string | null;

  companions: ReservationCompanion[];

  roomId?: string;
  roomNumber?: string;
}

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