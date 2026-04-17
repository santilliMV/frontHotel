import apiClient from './client';
import type { ReservationResponse } from '../types';

export type DocumentType  = 'CC' | 'TI' | 'CE' | 'RC' | 'PASAPORTE';
export type OccupantType  = 'INDIVIDUAL' | 'PAREJA' | 'MULTIPLE_PERSON';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'NEQUI_SALOMON' | 'NEQUI_BRAYAN';

export interface GuestResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  phone: string;
  documentType: DocumentType | null;
  documentNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  occupation: string | null;
  vehiclePlate: string | null;
  observations: string | null;
  hasObservations: boolean;
  autoCreated: boolean;
  createdAt: string | null;
  lastStayDate: string | null;
}

export interface GuestRequest {
  firstName: string;
  lastName?: string;
  phone: string;
  documentType?: DocumentType;
  documentNumber?: string;
  address?: string;
  city?: string;
  country?: string;
  occupation?: string;
  vehiclePlate?: string;
  observations?: string;
}

export interface CompanionRequest {
  name: string;
  documentType?: DocumentType;
  documentNumber?: string;
  phone?: string;
}

export interface ReservationRequest {
  guestId: string;
  firstName: string;
  lastName?: string;
  phone: string;
  roomTypeId: string;
  roomId?: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  occupantType: OccupantType;
  approximateArrivalTime?: string;
  specialRequests?: string;
  notes?: string;
  depositAmount?: number;
  companions?: CompanionRequest[];
}

export interface CheckInRequest {
  reservationId: string;
  roomId?: string;
  earlyCheckInOption?: 'PREVIOUS_NIGHT' | 'CURRENT_NIGHT';
  towelsDelivered?: number;
  specialInstructions?: string;
  notes?: string;
}

export interface CheckInResponse {
  checkInId: string;
  reservationId: string;
  reservationNumber: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  floor: number;
  guestName: string;
  guestPhone: string;
  checkInDateTime: string;
  isEarlyCheckIn: boolean;
  earlyCheckInOption?: 'PREVIOUS_NIGHT' | 'CURRENT_NIGHT';
  towelsDelivered: number;
  checkedInBy: string;
  notes?: string;
}

export interface AvailableRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  roomTypeId?: string;
  roomTypeName?: string;
}

export interface RoomTypeOption {
  id: string;
  name: string;
  capacity: number;
}

export interface PriceResponse {
  totalPrice: number;
  numberOfNights: number;
  roomTypeId: string;
  occupantType: string;
  checkIn: string;
  checkOut: string;
  numberOfGuests: number;
}

// ─── Guests ───────────────────────────────────────────────────────────────────

export const guestsApi = {
  search: async (q: string): Promise<GuestResponse[]> => {
    const res = await apiClient.get('/guests/search', { params: { q } });
    return res.data;
  },
  findAll: async (): Promise<GuestResponse[]> => {
    const res = await apiClient.get('/guests');
    return res.data;
  },
  findById: async (id: string): Promise<GuestResponse> => {
    const res = await apiClient.get(`/guests/${id}`);
    return res.data;
  },
  create: async (data: GuestRequest): Promise<GuestResponse> => {
    const res = await apiClient.post('/guests', data);
    return res.data;
  },
  update: async (id: string, data: GuestRequest): Promise<GuestResponse> => {
    const res = await apiClient.put(`/guests/${id}`, data);
    return res.data;
  },
  withObservations: async (): Promise<GuestResponse[]> => {
    const res = await apiClient.get('/guests/with-observations');
    return res.data;
  },
  reservations: async (guestId: string): Promise<ReservationResponse[]> => {
    const res = await apiClient.get(`/reservations/guest/${guestId}`);
    return res.data;
  },
};

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const roomsApi = {
  getTypes: async (): Promise<RoomTypeOption[]> => {
    const res = await apiClient.get('/rooms/types');
    return res.data;
  },

  getAvailable: async (): Promise<AvailableRoom[]> => {
    const res = await apiClient.get('/rooms/available');
    return res.data;
  },

  /** Solo AVAILABLE, filtradas por tipo y ordenadas numéricamente */
  getAvailableByType: async (roomTypeId: string): Promise<AvailableRoom[]> => {
    const res = await apiClient.get('/rooms/available');
    const all: AvailableRoom[] = res.data;
    return all
      .filter((r) => r.roomTypeId === roomTypeId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  },

  /**
   * AVAILABLE + RESERVED, filtradas por tipo y ordenadas.
   * Usada cuando se viene desde planilla con una habitación pre-asignada (RESERVED).
   */
  getAvailableOrReservedByType: async (roomTypeId: string): Promise<AvailableRoom[]> => {
    const res = await apiClient.get('/rooms/available-or-reserved');
    const all: AvailableRoom[] = res.data;
    return all
      .filter((r) => r.roomTypeId === roomTypeId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  },

  /**
   * Calcula el precio total de una estadía.
   * Llama a GET /api/rooms/price
   */
  getPrice: async (params: {
    roomTypeId: string;
    occupantType: OccupantType;
    checkIn: string;
    checkOut: string;
    numberOfGuests: number;
  }): Promise<PriceResponse> => {
    const res = await apiClient.get('/rooms/price', { params });
    return res.data;
  },
};

// ─── CheckIn ─────────────────────────────────────────────────────────────────

export const checkInApi = {
  createReservation: async (data: ReservationRequest): Promise<ReservationResponse> => {
    const res = await apiClient.post('/reservations', data);
    return res.data;
  },
  doCheckIn: async (data: CheckInRequest): Promise<CheckInResponse> => {
    const res = await apiClient.post('/checkin', data);
    return res.data;
  },
};