export type Role = 'ADMIN' | 'RECEPCIONISTA';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE' | 'RESERVED';

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'NEQUI_SALOMON' | 'NEQUI_BRAYAN';

export interface User {
  token: string;
  username: string;
  fullName: string;
  role: Role;
}

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